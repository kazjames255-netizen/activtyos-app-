import { db } from "../firebase";

// Every booking keeps Customers & families current: the booker becomes (or
// updates) a customer record in the listing's tenant, and the booked child
// is added to their children if new. Fire-and-forget from the booking
// writes — a failed upsert must never fail a booking.
export async function upsertCustomerFromBooking(
  tenantId: string,
  booking: { booker: string; email: string; phone?: string; child?: string; childId?: string; age?: number; uid?: string | null },
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
    const kid = booking.child?.trim()
      ? [{
          name: booking.child.trim(),
          ...(booking.childId ? { childId: booking.childId } : {}),
          ...(booking.age !== undefined ? { age: booking.age } : {}),
        }]
      : [];
    if (existing.empty) {
      await db.collection("customers").add({
        tenantId,
        name: booking.booker,
        email: booking.email,
        phone: booking.phone ?? "",
        // The account link (§K): customer ↔ parent account is now a real uid,
        // not just an email match, whenever a booking gives us one.
        ...(booking.uid ? { uid: booking.uid } : {}),
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
    if (Object.keys(patch).length) await doc.ref.update(patch);
  } catch (e) {
    console.error("[customers] upsert failed:", (e as Error).message);
  }
}
