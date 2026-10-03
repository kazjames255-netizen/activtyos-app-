import { db } from "../firebase";
import { notify } from "./notify";
import type { Booking, Kid } from "../../../features/bookings/types";

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

  // 2 · Planned trips on a released day that list this child. The child comes
  // OFF the trip's attendee/consent list (so they're no longer counted, chased
  // for consent or taken on the day) — unless another live booking of the same
  // family still covers that day for them — and the provider is told either way.
  try {
    if (!childIds.size) return;
    const trips = await db.collection("trips").where("tenantId", "==", tenantId).where("status", "==", "planned").get();
    // Other live bookings of this family that might still cover the child (lazy: only read when a trip matches).
    let others: Booking[] | null = null;
    const stillCovered = async (childId: string | undefined, name: string, date: string) => {
      if (others === null) {
        const email = (b.email ?? "").trim();
        const snap = email ? await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).get() : null;
        others = (snap?.docs ?? []).map((x) => x.data() as Booking).filter((o) => o.ref !== b.ref && !["Cancelled", "Declined", "Waitlisted"].includes(o.status));
      }
      return others.some((o) => {
        const kidRows: Kid[] = o.kids?.length ? o.kids : [{ name: o.child, childId: o.childId, dates: o.days }];
        return kidRows.some((k) => {
          if (k.cancelled) return false;
          const mine = (childId && k.childId === childId) || (k.name ?? "").trim().toLowerCase() === name.trim().toLowerCase();
          const kd = k.dates?.length ? k.dates : k.days?.length ? k.days : o.days;
          return mine && !!kd?.includes(date) && !(k.cancelledDays ?? []).includes(date);
        });
      });
    };
    for (const d of trips.docs) {
      const t = d.data() as { date?: string; destination?: string; childIds?: string[]; childNames?: string[]; headcount?: number; attendees?: { childId?: string; n?: string; consent?: string }[] };
      if (!t.date || !days.has(t.date)) continue;
      const hit = (t.attendees ?? []).filter((a) => a.childId && childIds.has(a.childId));
      if (!hit.length) continue;
      const toRemove: typeof hit = [];
      for (const a of hit) if (!(await stillCovered(a.childId, a.n ?? "", t.date))) toRemove.push(a);
      if (toRemove.length) {
        const gone = new Set(toRemove.map((a) => a.childId));
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(d.ref);
          const cur = fresh.data() as typeof t | undefined;
          if (!cur) return;
          const attendees = (cur.attendees ?? []).filter((a) => !(a.childId && gone.has(a.childId)));
          const removedNames = new Set(toRemove.map((a) => (a.n ?? "").trim().toLowerCase()));
          tx.update(fresh.ref, {
            attendees,
            childIds: (cur.childIds ?? []).filter((id) => !gone.has(id)),
            childNames: (cur.childNames ?? []).filter((n) => !removedNames.has(String(n).trim().toLowerCase())),
            headcount: Math.max(0, (cur.headcount ?? (cur.attendees ?? []).length) - toRemove.length),
          });
        });
      }
      const alert = hit.filter((a) => a.consent !== "declined");
      if (!alert.length) continue;
      const removed = new Set(toRemove);
      await notify({
        tenantId,
        to: { kind: "tenant" },
        category: "trip",
        title: `${alert.map((a) => a.n).join(" and ")} — booking cancelled for the trip day`,
        body: `Booking ${b.ref} no longer covers ${t.date}. ${alert.every((a) => removed.has(a)) ? `They have been taken off the trip to ${t.destination ?? "a trip"} and its consent list.` : `They're still on the trip to ${t.destination ?? "a trip"} (another booking covers that day) - check whether they're still going.`}`,
        href: "/company/trips",
        ref: d.id,
      });
    }
  } catch (e) {
    console.error(`[cancel-cleanup] trips ${b.ref}:`, (e as Error).message);
  }
}
