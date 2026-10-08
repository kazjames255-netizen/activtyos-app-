import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "./bookingDoc";
import { SIBLING_MS, checkoutKey, inheritSplitOneOffs, type SplitBooking } from "../../../features/bookings/addons";

/**
 * Add-on orders and the register read the bookings of the sessions in view. A ONE-OFF extra (a T-shirt) lives on the FIRST reference of a split checkout,
 * which may be cancelled or in another week: this loads the sibling references (same booker email, same listing, createdAt within 3 ms - see
 * features/bookings/addons.ts "SIBLING RULE") and returns the addonLines the viewed bookings should DISPLAY, by ref (only the ones that changed).
 * Display only: nothing is written and no price moves.
 */
export async function splitOneOffLines(tenantId: string, viewed: SplitBooking[]): Promise<Map<string, NonNullable<SplitBooking["addonLines"]>>> {
  // Every createdAt that could belong to the same checkout as a viewed booking (the stamp and the few milliseconds either side of it).
  const stamps = new Set<string>();
  for (const b of viewed) {
    if (!checkoutKey(b)) continue;
    const t = Date.parse(b.createdAt as string);
    for (let d = -SIBLING_MS; d <= SIBLING_MS; d++) stamps.add(new Date(t + d).toISOString());
  }
  if (!stamps.size) return new Map();
  const have = new Map(viewed.map((b) => [b.ref, b]));
  const list = [...stamps];
  for (let i = 0; i < list.length; i += 30) {
    const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("createdAt", "in", list.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const b = fromDoc(d.data() as BookingDoc) as unknown as SplitBooking;
      if (!have.has(b.ref)) have.set(b.ref, b);
    }
  }
  const changed = inheritSplitOneOffs([...have.values()]);
  const viewedRefs = new Set(viewed.map((b) => b.ref));
  return new Map([...changed].filter(([ref]) => viewedRefs.has(ref)));
}

/** The viewed bookings with their displayed addonLines swapped in where a one-off moved to them. */
export async function withSplitOneOffs<B extends SplitBooking>(tenantId: string, viewed: B[]): Promise<B[]> {
  const lines = await splitOneOffLines(tenantId, viewed);
  return lines.size ? viewed.map((b) => (lines.has(b.ref) ? { ...b, addonLines: lines.get(b.ref) } : b)) : viewed;
}
