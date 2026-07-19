import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { applyRowAction } from "../../../features/bookings/mutations";
import { bookingDays, countsUpdate, daysHaveSpace, type BlockDoc } from "./blockDomain";
import { emailPlaceOffered } from "./emails";

// ─────────────────────────────────────────────────────────────────────────
// The waiting list (handoff §E). A waitlisted BOOKING is the queue entry —
// no separate collection. Queues are per DATE (the booking's `days`), FIFO
// by booking ref (refs are sequential). "Offered" holds the seat for 2
// hours; expiry returns it to the queue and, in auto mode, passes the
// offer down. Cancellations call triggerWaitlist so a freed seat is
// offered to position 1 automatically (auto mode only — manual mode the
// operator chooses whom to offer).
// ─────────────────────────────────────────────────────────────────────────

const refNum = (ref: string) => parseInt(ref.replace(/\D/g, ""), 10) || 0;

/** Waitlisted bookings on a block, queue order (oldest ref first). */
async function queuedBookings(blockId: string): Promise<Booking[]> {
  const snap = await db.collection("bookings").where("blockId", "==", blockId).get();
  return snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => b.status === "Waitlisted")
    .sort((a, b) => refNum(a.ref) - refNum(b.ref));
}

/** Per-date queue positions for the given refs ("2nd in line for 12 Aug"). */
export async function queuePositions(
  blockId: string,
  refs: string[],
): Promise<{ ref: string; date: string; position: number }[]> {
  const queued = await queuedBookings(blockId);
  const blockSnap = await db.collection("blocks").doc(blockId).get();
  const block = blockSnap.exists ? (blockSnap.data() as BlockDoc) : null;
  const perDate = new Map<string, string[]>();
  for (const b of queued) {
    const days = block ? bookingDays(b, block) : (b.days ?? []);
    for (const d of days) perDate.set(d, [...(perDate.get(d) ?? []), b.ref]);
  }
  const out: { ref: string; date: string; position: number }[] = [];
  for (const [date, order] of perDate) {
    for (const ref of refs) {
      const i = order.indexOf(ref);
      if (i >= 0) out.push({ ref, date, position: i + 1 });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** How many are queued for a specific date (the overbook warning number). */
export async function waitingCount(blockId: string, dates: string[]): Promise<number> {
  const queued = await queuedBookings(blockId);
  const blockSnap = await db.collection("blocks").doc(blockId).get();
  const block = blockSnap.exists ? (blockSnap.data() as BlockDoc) : null;
  const set = new Set(dates);
  return queued.filter((b) => (block ? bookingDays(b, block) : (b.days ?? [])).some((d) => set.has(d))).length;
}

/** Offer one waitlisted booking its place (2h hold). Transactional: checks
 * the seat is really free and the booking still queued. Returns the updated
 * booking, or null when it no longer fits/exists. */
export async function makeOffer(tenantId: string, ref: string): Promise<Booking | null> {
  const bookingRef = db.collection("bookings").doc(`${tenantId}_${ref}`);
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) return null;
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.status !== "Waitlisted" || !b.blockId) return null;
      const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
      if (!blockSnap.exists) return null;
      const block = blockSnap.data() as BlockDoc;
      const days = bookingDays(b, block);
      const seats = b.seats ?? 1;
      const scope = block.capacityScope ?? "listing";
      const fits =
        scope === "day"
          ? daysHaveSpace(block, Object.fromEntries(days.map((d) => [d, seats]))).fits
          : block.bookedCount + seats <= block.capacity;
      if (!fits) return null;
      applyRowAction(b, "offer"); // Offered + offeredAt + 2h expiry
      tx.set(bookingRef, toDoc(b));
      tx.update(blockSnap.ref, { ...countsUpdate(block, seats, days) }); // hold the seat
      return b;
    });
    return updated;
  } catch (e) {
    console.error("[waitlist] offer failed:", (e as Error).message);
    return null;
  }
}

/** AUTO mode: offer freed places to the front of the queue. Fire-and-forget
 * after anything that releases seats on a block. Manual mode does nothing —
 * the operator chooses whom to offer. */
export async function triggerWaitlist(blockId: string): Promise<void> {
  try {
    const blockSnap = await db.collection("blocks").doc(blockId).get();
    if (!blockSnap.exists) return;
    const block = blockSnap.data() as BlockDoc;
    const listingSnap = await db.collection("listings").doc(block.listingId).get();
    const listing = listingSnap.data() as
      | { waitlistMode?: string; status?: string; archived?: boolean; tenantName?: string; name?: string }
      | undefined;
    if (!listing || listing.waitlistMode !== "auto") return;
    if ((listing.status ?? "live") !== "live" || listing.archived) return;

    // Try the queue in order; makeOffer re-checks space transactionally, so
    // we just stop once nothing more fits.
    for (const b of await queuedBookings(blockId)) {
      const offered = await makeOffer(block.tenantId, b.ref);
      if (offered && offered.email.includes("@"))
        emailPlaceOffered(offered, listing.tenantName ?? listing.name ?? "Your activity provider");
      if (!offered) {
        // Someone deeper in the queue may still fit (day scope: different
        // dates) — keep walking; capacity checks are cheap.
        continue;
      }
    }
  } catch (e) {
    console.error("[waitlist] trigger failed:", (e as Error).message);
  }
}

/** Return expired offers to the queue and pass the place down (sweep — run
 * on an interval and at startup). */
export async function expireOffers(): Promise<void> {
  try {
    const snap = await db.collection("bookings").where("status", "==", "Offered").get();
    const now = Date.now();
    const touchedBlocks = new Set<string>();
    for (const doc of snap.docs) {
      const b = fromDoc(doc.data() as BookingDoc);
      if (!b.offerExpiresAt || new Date(b.offerExpiresAt).getTime() > now) continue;
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return;
        const cur = fromDoc(fresh.data() as BookingDoc);
        if (cur.status !== "Offered") return;
        let blockUpdate: { ref: FirebaseFirestore.DocumentReference; counts: ReturnType<typeof countsUpdate> } | null = null;
        if (cur.blockId) {
          const blockSnap = await tx.get(db.collection("blocks").doc(cur.blockId));
          if (blockSnap.exists) {
            const block = blockSnap.data() as BlockDoc;
            blockUpdate = {
              ref: blockSnap.ref,
              counts: countsUpdate(block, -(cur.seats ?? 1), bookingDays(cur, block)),
            };
          }
        }
        cur.status = "Waitlisted";
        cur.note = "Offer expired — back in the queue.";
        tx.set(fresh.ref, toDoc(cur));
        if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
      });
      if (b.blockId) touchedBlocks.add(b.blockId);
    }
    for (const blockId of touchedBlocks) await triggerWaitlist(blockId);
  } catch (e) {
    console.error("[waitlist] expiry sweep failed:", (e as Error).message);
  }
}
