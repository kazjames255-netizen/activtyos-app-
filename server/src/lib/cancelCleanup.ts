import { db } from "../firebase";
import { notify } from "./notify";
import type { Booking } from "../../../features/bookings/types";

// What a cancellation leaves behind besides the seat.
//
// Cancelling freed the place and the discount code, and nothing else: meals the
// family had ordered for those days stayed "placed" and on the kitchen's
// numbers, and a child down for a trip on a cancelled day stayed on it with
// nobody told. Register marks are deliberately NOT touched — they're the record
// of who was in your care, and a child signed in when the cancel lands stays on
// the register until collected (routes/registers.ts).

/**
 * @param releasedDays the dates that are no longer booked — every booked day
 *   for a whole-booking cancel, just the released ones for a partial cancel.
 *   An empty list means "all of this booking's days".
 */
export async function cleanupAfterCancel(tenantId: string, b: Booking, releasedDays: string[] = []): Promise<void> {
  const days = new Set(releasedDays.length ? releasedDays : (b.days ?? []));
  const childIds = new Set([b.childId, ...(b.kids ?? []).map((k) => k.childId)].filter(Boolean) as string[]);
  const names = new Set([b.child, ...(b.kids ?? []).map((k) => k.name)].filter(Boolean).map((n) => String(n).trim().toLowerCase()));
  const isTheirs = (o: { childId?: string; childName?: string }) =>
    (o.childId && childIds.has(o.childId)) || (!!o.childName && names.has(o.childName.trim().toLowerCase()));

  // 1 · Meals ordered separately (parent Meals page) for the released days.
  try {
    const email = (b.email ?? "").trim();
    // mealOrders store the family as `parentEmail`, lower-cased.
    const snaps = await Promise.all(
      [...new Set([email.toLowerCase()].filter(Boolean))].map((e) =>
        db.collection("mealOrders").where("tenantId", "==", tenantId).where("parentEmail", "==", e).get(),
      ),
    );
    const at = new Date().toISOString();
    for (const d of snaps.flatMap((s) => s.docs)) {
      const o = d.data() as { status?: string; date?: string; childId?: string; childName?: string; listingId?: string };
      if (o.status === "cancelled" || !o.date || !days.has(o.date)) continue;
      if (b.listingId && o.listingId && o.listingId !== b.listingId) continue;
      if (!isTheirs(o)) continue;
      await d.ref.set({ status: "cancelled", cancelledAt: at, cancelledReason: `Booking ${b.ref} cancelled` }, { merge: true });
    }
  } catch (e) {
    console.error(`[cancel-cleanup] meals ${b.ref}:`, (e as Error).message);
  }

  // 2 · Planned trips on a released day that list this child. Not removed
  // automatically (a trip isn't tied to one booking) — the provider is told.
  try {
    if (!childIds.size) return;
    const trips = await db.collection("trips").where("tenantId", "==", tenantId).where("status", "==", "planned").get();
    for (const d of trips.docs) {
      const t = d.data() as { date?: string; destination?: string; childIds?: string[]; attendees?: { childId?: string; n?: string; consent?: string }[] };
      if (!t.date || !days.has(t.date)) continue;
      const hit = (t.attendees ?? []).filter((a) => a.childId && childIds.has(a.childId) && a.consent !== "declined");
      if (!hit.length) continue;
      await notify({
        tenantId,
        to: { kind: "tenant" },
        category: "trip",
        title: `${hit.map((a) => a.n).join(" and ")} — booking cancelled for the trip day`,
        body: `Booking ${b.ref} no longer covers ${t.date}, but they're still on the trip to ${t.destination ?? "a trip"}. Check whether they're still going and update the trip.`,
        href: "/company/trips",
        ref: d.id,
      });
    }
  } catch (e) {
    console.error(`[cancel-cleanup] trips ${b.ref}:`, (e as Error).message);
  }
}
