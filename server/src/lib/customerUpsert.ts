import { db } from "../firebase";

// Every booking keeps Customers & families current: the booker becomes (or
// updates) a customer record in the listing's tenant, and the booked child
// is added to their children if new. Fire-and-forget from the booking
// writes — a failed upsert must never fail a booking.
export async function upsertCustomerFromBooking(
  tenantId: string,
  booking: { booker: string; email: string; phone?: string; child?: string; age?: number },
): Promise<void> {
  if (!booking.email) return;
  try {
    const existing = await db
      .collection("customers")
      .where("tenantId", "==", tenantId)
      .where("email", "==", booking.email)
      .limit(1)
      .get();
    const kid = booking.child?.trim()
      ? [{ name: booking.child.trim(), ...(booking.age !== undefined ? { age: booking.age } : {}) }]
      : [];
    if (existing.empty) {
      await db.collection("customers").add({
        tenantId,
        name: booking.booker,
        email: booking.email,
        phone: booking.phone ?? "",
        children: kid,
      });
      return;
    }
    const doc = existing.docs[0];
    const children: { name: string }[] = doc.data().children ?? [];
    const missing = kid.filter((k) => !children.some((c) => c.name === k.name));
    if (missing.length) await doc.ref.update({ children: [...children, ...missing] });
  } catch (e) {
    console.error("[customers] upsert failed:", (e as Error).message);
  }
}
