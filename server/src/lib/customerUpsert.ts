import { db } from "../firebase";

// Every booking keeps Customers & families current: the booker becomes (or
// updates) a customer record in the listing's tenant, and the booked child
// is added to their children if new. Fire-and-forget from the booking
// writes — a failed upsert must never fail a booking.
export async function upsertCustomerFromBooking(
  tenantId: string,
  booking: { booker: string; email: string; phone?: string; postcode?: string; child?: string; childId?: string; age?: number; uid?: string | null },
): Promise<void> {
  if (!booking.email) return;
  try {
    const existing = await db
      .collection("customers")
      .where("tenantId", "==", tenantId)
      .where("email", "==", booking.email)
      .limit(1)
      .get();
    // The customer's thin child list keeps a childId when we have one, so the
    // Families page and §K family read can join to the real record.
    // A multi-child booking carries one joined string ("Bella James, Ava James"): that is several children, never one. The id and age
    // only belong to a single named child, so they are kept only when there is exactly one.
    const names = (booking.child ?? "").split(/\s*(?:,|&|\band\b)\s*/i).map((n) => n.trim()).filter(Boolean);
    const kid = names.map((name) => ({
      name,
      ...(names.length === 1 && booking.childId ? { childId: booking.childId } : {}),
      ...(names.length === 1 && booking.age !== undefined ? { age: booking.age } : {}),
    }));
    if (existing.empty) {
      await db.collection("customers").add({
        tenantId,
        name: booking.booker,
        email: booking.email,
        phone: booking.phone ?? "",
        // The account link (§K): customer ↔ parent account is now a real uid,
        // not just an email match, whenever a booking gives us one.
        ...(booking.uid ? { uid: booking.uid } : {}),
        ...(booking.postcode ? { postcode: booking.postcode } : {}),
        children: kid,
      });
      return;
    }
    const doc = existing.docs[0];
    const children: { name?: string; childId?: string }[] = doc.data().children ?? [];
    // Match on childId when present, else name — so a saved child isn't
    // duplicated on the customer record just because the name shifted.
    const missing = kid.filter(
      (k) => !children.some((c) => (k.childId && c.childId === k.childId) || c.name === k.name),
    );
    const patch: Record<string, unknown> = {};
    if (missing.length) patch.children = [...children, ...missing];
    if (booking.uid && doc.data().uid !== booking.uid) patch.uid = booking.uid;
    // Fill a MISSING postcode from the booking — never overwrite one the
    // provider already has on file (same rule as phone in the basket upsert).
    if (booking.postcode && !((doc.data().postcode as string | undefined) ?? "").trim()) patch.postcode = booking.postcode;
    if (Object.keys(patch).length) await doc.ref.update(patch);
  } catch (e) {
    console.error("[customers] upsert failed:", (e as Error).message);
  }
}


// One customer write for a whole basket (a basket is one family). Calling the
// single-booking upsert per child races — N reads all see "no customer yet"
// and create N duplicate rows. This merges all the basket's children into one
// upsert instead.
export async function upsertFamilyFromBasket(
  tenantId: string,
  family: {
    booker: string;
    email: string;
    phone?: string;
    postcode?: string;
    uid?: string | null;
    children: { name?: string; childId?: string; age?: number }[];
  },
): Promise<void> {
  if (!family.email) return;
  try {
    const existing = await db
      .collection("customers")
      .where("tenantId", "==", tenantId)
      .where("email", "==", family.email)
      .limit(1)
      .get();
    // Distinct children (by childId, else name).
    const seen = new Set<string>();
    const kids = family.children
      .filter((k) => (k.name ?? "").trim())
      .map((k) => ({
        name: (k.name ?? "").trim(),
        ...(k.childId ? { childId: k.childId } : {}),
        ...(k.age !== undefined ? { age: k.age } : {}),
      }))
      .filter((k) => {
        const key = k.childId ?? k.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (existing.empty) {
      await db.collection("customers").add({
        tenantId,
        name: family.booker,
        email: family.email,
        phone: family.phone ?? "",
        ...(family.uid ? { uid: family.uid } : {}),
        ...(family.postcode ? { postcode: family.postcode } : {}),
        children: kids,
      });
      return;
    }
    const doc = existing.docs[0];
    const children: { name?: string; childId?: string }[] = doc.data().children ?? [];
    const missing = kids.filter(
      (k) => !children.some((c) => (k.childId && c.childId === k.childId) || c.name === k.name),
    );
    const patch: Record<string, unknown> = {};
    if (missing.length) patch.children = [...children, ...missing];
    if (family.uid && doc.data().uid !== family.uid) patch.uid = family.uid;
    // Fill a MISSING phone from what the family gave at checkout — but never
    // overwrite one the provider already has on file.
    if (family.phone?.trim() && !((doc.data().phone as string | undefined) ?? "").trim()) patch.phone = family.phone.trim();
    // Same rule for postcode — filled from the account's stored postcode,
    // never overwriting a value the provider already holds.
    if (family.postcode && !((doc.data().postcode as string | undefined) ?? "").trim()) patch.postcode = family.postcode;
    if (Object.keys(patch).length) await doc.ref.update(patch);
  } catch (e) {
    console.error("[customers] family upsert failed:", (e as Error).message);
  }
}