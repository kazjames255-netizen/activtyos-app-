import { db } from "../firebase";
import { capsViolation } from "./capRules";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { applyRowAction } from "../../../features/bookings/mutations";
import { bookingDays, countsUpdate, daysHaveSpace, type BlockDoc } from "./blockDomain";
import { emailPlaceOffered } from "./emails";
import { notify } from "./notify";
import { passCap, bookingHasPass } from "./passBooking";
import { loadSettings } from "./tenantLibrary";

// ─────────────────────────────────────────────────────────────────────────
// The waiting list (handoff §E). A waitlisted BOOKING is the queue entry —
// no separate collection. Queues are per DATE (the booking's `days`), FIFO
// by booking ref (refs are sequential). "Offered" holds the seat for 2
// hours; expiry returns it to the queue and, in auto mode, passes the
// offer down. Cancellations call triggerWaitlist so a freed seat is
// offered to position 1 automatically (auto mode only — manual mode the
// operator chooses whom to offer).
// ─────────────────────────────────────────────────────────────────────────

import { positionsFrom, sortQueue } from "./waitlistQueue";

/** Waitlisted bookings on a block, queue order (oldest ref first). */
async function queuedBookings(blockId: string): Promise<Booking[]> {
  const snap = await db.collection("bookings").where("blockId", "==", blockId).get();
  // FIFO by ref, except a family whose offer lapsed re-joins at the back
  // (otherwise the oldest ref is re-offered every sweep and nobody else
  // ever gets the place — p2-o15). See waitlistQueue.ts.
  return sortQueue(snap.docs.map((d) => fromDoc(d.data() as BookingDoc)).filter((b) => b.status === "Waitlisted"));
}

/** Per-date queue positions for the given refs ("2nd in line for 12 Aug"). */
export async function queuePositions(
  blockId: string,
  refs: string[],
): Promise<{ ref: string; date: string; position: number }[]> {
  const queued = await queuedBookings(blockId);
  const blockSnap = await db.collection("blocks").doc(blockId).get();
  const block = blockSnap.exists ? (blockSnap.data() as BlockDoc) : null;
  return positionsFrom(queued, refs, (b) => (block ? bookingDays(b as Booking, block) : (b as Booking).days ?? []));
}

/** How many are queued for a specific date (the overbook warning number). */
export async function waitingCount(blockId: string, dates: string[]): Promise<number> {
  const queued = await queuedBookings(blockId);
  const blockSnap = await db.collection("blocks").doc(blockId).get();
  const block = blockSnap.exists ? (blockSnap.data() as BlockDoc) : null;
  const set = new Set(dates);
  return queued.filter((b) => (block ? bookingDays(b, block) : (b.days ?? [])).some((d) => set.has(d))).length;
}


/** The per-ticket and per-age-group daily caps a place must ALSO respect (the block's own room is checked by the caller). A seat freed
 *  elsewhere on the block does not make room on a capped ticket, so an offer for a pass or age group that is still at its cap would
 *  overbook it. Returns a plain-words reason, or null when the place fits. Reads only — call it before any write in the transaction. */
export async function capsProblem(tx: FirebaseFirestore.Transaction, b: Booking, block: BlockDoc, days: string[]): Promise<string | null> {
  if (!b.blockId || !block.listingId) return null;
  const listingSnap = await tx.get(db.collection("listings").doc(block.listingId));
  if (!listingSnap.exists) return null;
  const listing = listingSnap.data() as { ticketOverrides?: Record<string, { capacity?: string }>; ageCapsOn?: boolean; ageCaps?: Record<string, number>; franchiseId?: string | null };
  const ageCaps = listing.ageCaps ?? {};
  const ageOn = !!listing.ageCapsOn && Object.keys(ageCaps).length > 0;
  const capped = Object.entries(listing.ticketOverrides ?? {}).some(([n, o]) => passCap(o?.capacity) !== null && bookingHasPass(b.pass, n));
  if (!capped && !ageOn) return null;
  const live = await tx.get(db.collection("bookings").where("blockId", "==", b.blockId).where("status", "in", ["Confirmed", "Approval needed", "Offered"]));
  const seatsOf = (x: Booking) => {
    const kids = ((x as { kids?: { cancelled?: boolean }[] }).kids ?? []);
    return Math.max(1, kids.filter((k) => !k.cancelled).length || kids.length || 1);
  };
  const groups = ageOn ? ((((await loadSettings(block.tenantId, listing.franchiseId)).ratioGroups) ?? []) as { id: string; ageFrom: number; ageTo: number; name?: string }[]) : [];
  const lite = (x: Booking) => ({ ref: x.ref, pass: x.pass, age: x.age, days: x.days, seats: seatsOf(x) });
  return capsViolation(listing, lite(b), days, live.docs.map((d) => lite(fromDoc(d.data() as BookingDoc))), block.sessions.map((x) => x.date), groups);
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
      if (await capsProblem(tx, b, block, days)) return null; // a capped ticket / age group is still full: a seat freed elsewhere doesn't help
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

/** The family's bell for an offered place (the email alone is easy to miss, and is held back while mail isn't live). Used by the
 *  automatic offers; the provider's manual "Offer" raises the same bell in routes/bookings.ts. */
function bellPlaceOffered(b: Booking): void {
  const until = b.offerExpiresAt ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";
  void notify({
    tenantId: b.tenantId!,
    to: { kind: "parent", email: b.email },
    category: "booking",
    bellOnly: true,
    title: `A place is available · ${b.ref}`,
    body: `${b.listing}${b.child ? ` · ${b.child}` : ""} — a place has come up and is being held for you${until ? ` until ${until}` : ""}. Accept and pay to take it.`,
    href: `/custdash/bookings?pay=${encodeURIComponent(b.ref)}`,
    ref: b.ref,
  });
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
    if (!listing) return;
    if ((listing.status ?? "live") !== "live" || listing.archived) return;
    if (listing.waitlistMode !== "auto") {
      // MANUAL mode: nobody is offered anything automatically, so TELL THE PROVIDER the moment a queued family could now be given a place
      // (bell + email, deep-linked to that booking). Without this they would have to check the waiting list by hand, all the time.
      // Setup > Email > Automatic emails > "Alert me when a place frees up" (on by default; a provider may switch it off, with a warning).
      const { autoEmailPrefs } = await import("./autoEmails");
      if (!(await autoEmailPrefs(block.tenantId)).waitlistFreeAlert) return;
      const queue = await queuedBookings(blockId);
      const fitting = queue.filter((q) => {
        const days = bookingDays(q, block);
        const seats = q.seats ?? 1;
        return (block.capacityScope ?? "listing") === "day"
          ? daysHaveSpace(block, Object.fromEntries(days.map((d) => [d, seats]))).fits
          : block.bookedCount + seats <= block.capacity;
      });
      if (fitting.length) {
        const first = fitting[0];
        const sig = `${block.bookedCount}_${JSON.stringify((block as { counts?: unknown }).counts ?? {})}`;
        const { fireOnce } = await import("./scheduler");
        await fireOnce(`waitfree_${blockId}_${first.ref}_${sig}`, { tenantId: block.tenantId }, () =>
          notify({
            tenantId: block.tenantId,
            to: { kind: "tenant" },
            category: "booking",
            key: "waitlist-place-free",
            title: `A place has opened up · ${first.listing}`,
            body: `${fitting.length === 1 ? "1 family is" : `${fitting.length} families are`} waiting and a place is now free (first in line: ${first.child || first.booker}, booking ${first.ref}). Open it and press Offer place.`,
            subject: `A place has opened up for ${first.listing}`,
            href: `/company/bookings?ref=${encodeURIComponent(first.ref)}`,
            ref: first.ref,
          }),
        );
      }
      return;
    }

    // Try the queue in order; makeOffer re-checks space transactionally, so
    // we just stop once nothing more fits.
    for (const b of await queuedBookings(blockId)) {
      const offered = await makeOffer(block.tenantId, b.ref);
      if (offered && offered.email.includes("@")) {
        emailPlaceOffered(offered, listing.tenantName ?? listing.name ?? "Your activity provider");
        bellPlaceOffered(offered);
      }
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
        cur.requeuedAt = new Date().toISOString();
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
