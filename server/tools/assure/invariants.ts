// INVARIANTS: rules the bookings system must always obey, as pure functions over a Snapshot (no network, no Firestore).
// Each rule derives from the real domain code (blockDomain, waitlist, settlePayment, reconcileMath, discounts, wallet) so a broken rule means a real
// disagreement between what was stored and what the code itself says should be stored. Severity: money > capacity > state > email.
import { countsTowardCapacity, heldPlaces, type BlockDoc } from "../../src/lib/blockDomain";
import { bookingHasPass } from "../../src/lib/passBooking";
import type { Invariant, SnapBooking, SnapBlock, Snapshot, Violation } from "./types";

const TOL = 0.005;
const MONEY_TOL = 0.015;
const LIVE = ["Confirmed", "Approval needed", "Offered"];
const STATUSES = ["Approval needed", "Confirmed", "Waitlisted", "Offered", "Cancelled", "Declined"];
const GONE = ["Cancelled", "Declined"];
const SETTLED = ["succeeded", "recorded"];
const REFUND_OK = ["succeeded", "recorded", "credited", "to-reimburse"];
const MULTI_PERSON_PERCENT_ONLY_FROM = "2026-10-03";
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (s?: string) => (s ? Date.parse(s) : NaN);

function rule(id: string, severity: Violation["severity"], describe: string, check: (s: Snapshot) => Omit<Violation, "rule" | "severity">[]): Invariant {
  return { id, severity, describe, check: (s) => check(s).map((v) => ({ rule: id, severity, ...v })) };
}

const live = (b: SnapBooking) => LIVE.includes(b.status);
const holds = (b: SnapBooking) => countsTowardCapacity(b.status as never);
const blockOf = (s: Snapshot, b: SnapBooking) => s.blocks.find((x) => x.id === b.blockId);
const asBlockDoc = (b: SnapBlock, tenantId: string): BlockDoc => ({
  tenantId, listingId: b.listingId, name: b.id, startDate: b.startDate ?? "", endDate: b.endDate ?? "", capacity: b.capacity, bookedCount: b.bookedCount ?? 0,
  open: b.open !== false, sessions: b.dates.map((date) => ({ date, start: "00:00", end: "00:00" })), capacityScope: b.capacityScope, dayCounts: b.dayCounts ?? b.counts ?? {},
});
/** What the block SHOULD hold, recomputed from the live bookings (the server's own per-child aware rule). */

/** Seats the PROVIDER deliberately overbooked ("Promote now" on a waitlisted place is the operator's override and may exceed capacity, see routes/bookings.ts).
 *  Capacity rules allow exactly that much extra, per day, and nothing else. */
function promotedAllowance(s: Snapshot, blk: SnapBlock): { days: Record<string, number>; seats: number } {
  const days: Record<string, number> = {}; let seats = 0;
  for (const b of s.bookings) {
    if (b.blockId !== blk.id || !b.promoted || !holds(b)) continue;
    const h = heldPlaces({ status: b.status as never, seats: b.seats, days: b.days, kids: (b.kids ?? []) as never }, asBlockDoc(blk, s.tenantId));
    seats += h.seats; for (const [d, n] of Object.entries(h.days)) days[d] = (days[d] ?? 0) + n;
  }
  return { days, seats };
}

function recompute(s: Snapshot, blk: SnapBlock) {
  const doc = asBlockDoc(blk, s.tenantId);
  const days: Record<string, number> = {};
  let seats = 0;
  const holders: string[] = [];
  for (const b of s.bookings) {
    if (b.blockId !== blk.id || !holds(b)) continue;
    const h = heldPlaces({ status: b.status as never, seats: b.seats, days: b.days, kids: (b.kids ?? []) as never }, doc);
    seats += h.seats;
    holders.push(b.ref);
    for (const [d, n] of Object.entries(h.days)) days[d] = (days[d] ?? 0) + n;
  }
  return { days, seats, holders };
}
const paymentsFor = (s: Snapshot, ref: string, single = false) => s.payments.filter((p) => p.refs.includes(ref) && (!single || p.refs.length === 1) && p.kind !== "invoice");
const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
const refundPayment = (p: { type?: string }) => p.type === "refund";

export const INVARIANTS: Invariant[] = [
  // ───────────── MONEY ─────────────
  rule("money.amount-formula", "money", "A booking's price equals list price - discount + date-change fees (+ wallet it was paid with)", (s) =>
    s.bookings.filter((b) => b.listPrice !== undefined && b.discountOff !== undefined && !b.hasPriceOverride)
      .filter((b) => Math.abs(b.amount + (b.walletApplied ?? 0) - (b.listPrice! - b.discountOff! + (b.amendFeesCharged ?? 0))) > MONEY_TOL)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: amount ${b.amount} + wallet ${b.walletApplied ?? 0} != list ${b.listPrice} - off ${b.discountOff} + fees ${b.amendFeesCharged ?? 0}` }))),
  rule("money.amount-bounds", "money", "Price and discount are finite, never negative, and a discount never exceeds the list price", (s) =>
    s.bookings.filter((b) => !Number.isFinite(b.amount) || b.amount < -TOL || (b.discountOff ?? 0) < -TOL || (b.listPrice !== undefined && (b.discountOff ?? 0) > b.listPrice + TOL))
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: amount ${b.amount}, discount ${b.discountOff}, list ${b.listPrice}` }))),
  rule("money.received-within-price", "money", "A live booking never holds more money than its price (+wallet) unless money was logged after cancel", (s) =>
    s.bookings.filter((b) => live(b) && !b.receivedAfterCancel && (b.received ?? 0) > b.amount + (b.walletApplied ?? 0) + MONEY_TOL)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: received ${b.received} > price ${b.amount} + wallet ${b.walletApplied ?? 0}` }))),
  rule("money.refund-within-received", "money", "Nothing is refunded beyond what was received", (s) =>
    s.bookings.filter((b) => (b.refunded ?? 0) > (b.received ?? 0) + MONEY_TOL).map((b) => ({ refs: [b.ref], message: `${b.ref}: refunded ${b.refunded} > received ${b.received}` }))),
  rule("money.payments-within-received", "money", "Settled payment records for a booking never exceed what the booking says it received", (s) =>
    s.bookings.flatMap((b) => {
      const paid = sum(paymentsFor(s, b.ref, true).filter((p) => !refundPayment(p) && SETTLED.includes(p.status)).map((p) => p.amount));
      const have = (b.received ?? 0) - (b.walletApplied ?? 0);
      return paid > have + MONEY_TOL ? [{ refs: [b.ref], message: `${b.ref}: payment records ${paid} > booking received ${r2(have)}` }] : [];
    })),
  rule("money.paid-has-received", "money", "A booking marked Paid has actually received its price", (s) =>
    s.bookings.filter((b) => live(b) && b.pay === "Paid" && b.amount > TOL && b.amountPaid !== undefined && b.amountPaid > 0 && b.amountPaid < b.amount - MONEY_TOL)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: Paid but amountPaid ${b.amountPaid} < price ${b.amount}` }))),
  rule("money.wallet-nonnegative", "money", "A family's wallet balance is never below zero", (s) =>
    Object.entries(s.wallet ?? {}).filter(([, n]) => n < -TOL).map(([e, n]) => ({ message: `wallet ${e} = ${n}` }))),
  rule("money.wallet-ledger-matches", "money", "A wallet balance equals the sum of its ledger lines", (s) =>
    Object.entries(s.wallet ?? {}).flatMap(([e, bal]) => {
      const lines = (s.walletEntries ?? []).filter((x) => x.email === e);
      if (!lines.length) return [];
      const total = sum(lines.map((x) => x.delta));
      return Math.abs(total - bal) > 0.02 ? [{ message: `wallet ${e}: balance ${bal} but ledger sums to ${total}` }] : [];
    })),
  rule("money.card-paid-equals-price", "money", "A fully paid card booking recorded exactly its (wallet-net) price", (s) =>
    s.bookings.filter((b) => live(b) && /^card$/i.test(b.method ?? "") && b.pay === "Paid" && b.amountPaid !== undefined && Math.abs(b.amountPaid - b.amount) > MONEY_TOL)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: card booking Paid with amountPaid ${b.amountPaid} but price ${b.amount}` }))),
  rule("money.refund-state-consistent", "money", "Refunded / Partially refunded labels match the money that really went back", (s) =>
    s.bookings.flatMap((b) => {
      const rec = b.received ?? 0, ref = b.refunded ?? 0;
      if (rec <= TOL || seededFixture(b)) return [];
      if (b.pay === "Refunded" && ref < rec - MONEY_TOL) return [{ refs: [b.ref], message: `${b.ref}: marked Refunded but refunded ${ref} < received ${rec}` }];
      if (b.pay === "Partially refunded" && (ref <= TOL || ref >= rec - MONEY_TOL)) return [{ refs: [b.ref], message: `${b.ref}: Partially refunded but refunded ${ref} of ${rec}` }];
      return [];
    })),
  rule("money.addons-sane", "money", "A booking's add-on lines are finite, never negative (a negative add-on price must not take money off) and never exceed the list price they are part of", (s) =>
    s.bookings.filter((b) => b.addonsTotal !== undefined && (!Number.isFinite(b.addonsTotal) || b.addonsTotal < -TOL || (b.listPrice !== undefined && b.addonsTotal > b.listPrice + TOL)))
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: add-ons total ${b.addonsTotal} vs list price ${b.listPrice}` }))),
  rule("money.funded-owes-nothing", "money", "A funded (HAF) booking costs nothing", (s) =>
    s.bookings.filter((b) => b.pay === "Funded" && /haf|funded/i.test(b.method ?? "") && b.amount > TOL).map((b) => ({ refs: [b.ref], message: `${b.ref}: Funded but price ${b.amount}` }))),
  rule("money.early-bird-once", "money", "A fixed-GBP early bird is used at most once per family per season", (s) => {
    // ONE checkout makes one booking row per child/week and all rows carry the same scope stamp and share the single early-bird saving (it is split
    // across them). So rows created within 3 seconds of each other by the same family are ONE use. Two uses = two separate checkouts.
    const groups = new Map<string, { t: number; refs: string[] }[]>();
    for (const b of s.bookings) {
      if (!live(b) || !b.earlyBirdScope) continue;
      const k = `${b.email}|${b.earlyBirdScope}`;
      const t = iso(b.createdAt);
      const list = groups.get(k) ?? [];
      const hit = list.find((g) => Math.abs(g.t - t) <= 3000);
      if (hit) hit.refs.push(b.ref); else list.push({ t, refs: [b.ref] });
      groups.set(k, list);
    }
    return [...groups.entries()].filter(([, g]) => g.length > 1).map(([k, g]) => ({ refs: g.flatMap((x) => x.refs), message: `early bird used in ${g.length} separate checkouts for ${k}` }));
  }),
  rule("money.multi-person-percent-only", "money", "New multi-person discount rules are percentages only", (s) =>
    s.listings.filter((l) => l.createdAt && l.createdAt >= MULTI_PERSON_PERCENT_ONLY_FROM)
      .filter((l) => (l.discounts ?? []).some((r) => r.kind === "person" && r.enabled !== false && r.method !== "percent"))
      .map((l) => ({ refs: [l.id], message: `listing ${l.id}: fixed-amount multi-person rule on a listing made after ${MULTI_PERSON_PERCENT_ONLY_FROM}` }))),
  rule("money.payment-intent-unique", "money", "One Stripe payment settles once (no two settled records share an intent)", (s) => {
    const by = new Map<string, string[]>();
    for (const p of s.payments) if (p.paymentIntentId && !refundPayment(p) && SETTLED.includes(p.status)) by.set(p.paymentIntentId, [...(by.get(p.paymentIntentId) ?? []), p.id]);
    return [...by.entries()].filter(([, ids]) => ids.length > 1).map(([pi, ids]) => ({ message: `payment intent ${pi} settled ${ids.length} times (${ids.join(", ")})` }));
  }),
  rule("money.card-paid-has-payment", "money", "A card booking marked Paid has a settled payment record behind it", (s) =>
    s.bookings.filter((b) => live(b) && /^card$/i.test(b.method ?? "") && b.pay === "Paid" && b.amount > TOL)
      .filter((b) => !seededFixture(b) && !paymentsFor(s, b.ref).some((p) => !refundPayment(p) && SETTLED.includes(p.status)))
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: Paid by card but no settled payment record` }))),
  rule("money.payment-has-booking", "money", "Every settled payment points at a booking that exists", (s) => {
    const refs = new Set(s.bookings.map((b) => b.ref));
    return s.payments.filter((p) => p.kind !== "invoice" && p.refs.length && SETTLED.includes(p.status) && p.refs.every((r) => !refs.has(r)))
      .map((p) => ({ message: `payment ${p.id} (${p.amount}) refs ${p.refs.join(",")} match no booking` }));
  }),
  rule("money.split-bounds", "money", "Part-paid TFC and card portions never exceed the price", (s) =>
    s.bookings.filter((b) => (b.tfcAmount ?? 0) > b.amount + MONEY_TOL || (b.cardPaid ?? 0) > b.amount + MONEY_TOL)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: tfc ${b.tfcAmount ?? 0} / card ${b.cardPaid ?? 0} exceed price ${b.amount}` }))),
  rule("money.cancel-refund-bounded", "money", "A cancellation's refund never exceeds what was received", (s) =>
    s.bookings.filter((b) => b.cancel && (b.cancel.amount ?? 0) > (b.received ?? 0) + MONEY_TOL).map((b) => ({ refs: [b.ref], message: `${b.ref}: cancel refund ${b.cancel!.amount} > received ${b.received}` }))),
  rule("money.refund-records-bounded", "money", "Refund records for a booking never exceed what was paid in", (s) =>
    s.bookings.flatMap((b) => {
      const mine = paymentsFor(s, b.ref, true);
      const inn = sum(mine.filter((p) => !refundPayment(p) && SETTLED.includes(p.status)).map((p) => p.amount));
      const out = sum(mine.filter((p) => refundPayment(p) && REFUND_OK.includes(p.status)).map((p) => p.amount));
      // A card booking with no gateway trace at all (no payment intent, no payment-in record) was seeded straight onto the booking by a test: nothing was ever taken to refund.
      if (inn < TOL && !b.paymentIntentId && /^card$/i.test(b.method ?? "")) return [];
      return out > inn + (b.walletApplied ?? 0) + MONEY_TOL ? [{ refs: [b.ref], message: `${b.ref}: refund records ${out} > payments in ${inn}` }] : [];
    })),

  // ───────────── CAPACITY ─────────────
  rule("capacity.day-counts-match", "capacity", "A block's per-day counts equal what its live bookings actually hold", (s) =>
    s.blocks.flatMap((blk) => {
      const want = recompute(s, blk).days;
      const have = blk.dayCounts ?? blk.counts ?? {};
      const out: Omit<Violation, "rule" | "severity">[] = [];
      for (const d of new Set([...Object.keys(want), ...Object.keys(have)])) if ((want[d] ?? 0) !== (have[d] ?? 0)) out.push({ refs: [blk.id], message: `block ${blk.id} ${d}: stored ${have[d] ?? 0} but live bookings hold ${want[d] ?? 0}` });
      return out;
    })),
  rule("capacity.booked-count-matches", "capacity", "A block's bookedCount equals the live seats held (no phantom or missing seats)", (s) =>
    s.blocks.flatMap((blk) => { const w = recompute(s, blk).seats; return (blk.bookedCount ?? 0) !== w ? [{ refs: [blk.id], message: `block ${blk.id}: bookedCount ${blk.bookedCount ?? 0} but live bookings hold ${w}` }] : []; })),
  rule("capacity.day-stored-within-capacity", "capacity", "Per-day blocks: stored counts never exceed capacity", (s) =>
    s.blocks.filter((b) => b.capacityScope === "day").flatMap((blk) => Object.entries(blk.dayCounts ?? blk.counts ?? {}).filter(([d, n]) => n > blk.capacity + (promotedAllowance(s, blk).days[d] ?? 0)).map(([d, n]) => ({ refs: [blk.id], message: `block ${blk.id} ${d}: ${n}/${blk.capacity}` })))),
  rule("capacity.day-recomputed-within-capacity", "capacity", "Per-day blocks: the live bookings themselves never exceed capacity on any day", (s) =>
    s.blocks.filter((b) => b.capacityScope === "day").flatMap((blk) => Object.entries(recompute(s, blk).days).filter(([d, n]) => n > blk.capacity + (promotedAllowance(s, blk).days[d] ?? 0)).map(([d, n]) => ({ refs: [blk.id], message: `block ${blk.id} ${d}: bookings hold ${n}/${blk.capacity}` })))),
  rule("capacity.listing-stored-within-capacity", "capacity", "Whole-listing blocks: stored bookedCount never exceeds capacity", (s) =>
    s.blocks.filter((b) => b.capacityScope !== "day" && (b.bookedCount ?? 0) > b.capacity + promotedAllowance(s, b).seats).map((b) => ({ refs: [b.id], message: `block ${b.id}: bookedCount ${b.bookedCount}/${b.capacity}` }))),
  rule("capacity.listing-recomputed-within-capacity", "capacity", "Whole-listing blocks: live bookings never hold more seats than capacity", (s) =>
    s.blocks.filter((b) => b.capacityScope !== "day").flatMap((blk) => { const w = recompute(s, blk).seats; return w > blk.capacity + promotedAllowance(s, blk).seats ? [{ refs: [blk.id], message: `block ${blk.id}: bookings hold ${w}/${blk.capacity}` }] : []; })),
  rule("capacity.ticket-caps", "capacity", "A capped ticket never holds more places on a day than its cap (0 = closed)", (s) =>
    s.listings.flatMap((l) => Object.entries(l.ticketCaps ?? {}).flatMap(([name, cap]) => {
      const held: Record<string, number> = {};
      for (const b of s.bookings) {
        if (b.listingId !== l.id || !holds(b) || b.promoted || !bookingHasPass(b.pass, name)) continue;
        const days = b.days.length ? b.days : (blockOf(s, b)?.dates ?? []);
        for (const d of days) held[d] = (held[d] ?? 0) + (b.kidsLive || b.seats || 1);
      }
      return Object.entries(held).filter(([, n]) => n > cap).map(([d, n]) => ({ refs: [l.id], message: `listing ${l.id} ticket "${name}" ${d}: ${n} > cap ${cap}` }));
    }))),
  rule("capacity.age-caps", "capacity", "A capped age group never holds more places on a day than its cap", (s) =>
    s.listings.flatMap((l) => Object.entries(l.ageCaps ?? {}).flatMap(([group, cap]) => {
      const held: Record<string, number> = {};
      for (const b of s.bookings) {
        if (b.listingId !== l.id || !holds(b) || b.promoted || b.ageGroup !== group) continue;
        for (const d of b.days.length ? b.days : (blockOf(s, b)?.dates ?? [])) held[d] = (held[d] ?? 0) + 1;
      }
      return Object.entries(held).filter(([, n]) => n > cap).map(([d, n]) => ({ refs: [l.id], message: `listing ${l.id} age group ${group} ${d}: ${n} > cap ${cap}` }));
    }))),
  rule("capacity.counts-sane", "capacity", "Capacity and counts are finite, non-negative numbers", (s) =>
    s.blocks.filter((b) => !Number.isFinite(b.capacity) || b.capacity < 0 || (b.bookedCount ?? 0) < 0 || Object.values(b.dayCounts ?? b.counts ?? {}).some((n) => !Number.isFinite(n) || n < 0))
      .map((b) => ({ refs: [b.id], message: `block ${b.id}: capacity ${b.capacity}, bookedCount ${b.bookedCount}, dayCounts has a negative or non-numeric value` }))),
  rule("capacity.empty-block-is-empty", "capacity", "A block with no live bookings holds nothing (cancelled places are always released)", (s) =>
    s.blocks.filter((blk) => !s.bookings.some((b) => b.blockId === blk.id && holds(b)))
      .filter((blk) => (blk.bookedCount ?? 0) > 0 || Object.values(blk.dayCounts ?? blk.counts ?? {}).some((n) => n > 0))
      .map((b) => ({ refs: [b.id], message: `block ${b.id}: no live bookings but bookedCount ${b.bookedCount ?? 0}` }))),
  rule("capacity.confirmed-within-listing-capacity", "capacity", "Whole-listing blocks: confirmed bookings alone never exceed capacity (sold out means sold out)", (s) =>
    s.blocks.filter((b) => b.capacityScope !== "day").flatMap((blk) => {
      const seats = s.bookings.filter((b) => b.blockId === blk.id && b.status === "Confirmed" && !b.promoted).reduce((n, b) => n + (b.kidsLive || b.seats || 1), 0);
      return seats > blk.capacity ? [{ refs: [blk.id], message: `block ${blk.id}: ${seats} confirmed seats > capacity ${blk.capacity}` }] : [];
    })),

  // ───────────── STATE ─────────────
  rule("state.status-valid", "state", "Every booking has a recognised status", (s) => s.bookings.filter((b) => !STATUSES.includes(b.status)).map((b) => ({ refs: [b.ref], message: `${b.ref}: unknown status "${b.status}"` }))),
  rule("state.waitlisted-owes-nothing", "state", "A waitlisted booking has taken no money and used no wallet", (s) =>
    s.bookings.filter((b) => b.status === "Waitlisted").filter((b) => (b.walletApplied ?? 0) > TOL || (b.amountPaid ?? 0) > TOL || paymentsFor(s, b.ref).some((p) => !refundPayment(p) && SETTLED.includes(p.status)))
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: Waitlisted but money has moved (wallet ${b.walletApplied ?? 0}, paid ${b.amountPaid ?? 0})` }))),
  rule("state.offered-has-window", "state", "An offered place has a valid hold window (offeredAt before offerExpiresAt)", (s) =>
    s.bookings.filter((b) => b.status === "Offered").filter((b) => !(iso(b.offerExpiresAt) > 0) || !(iso(b.offeredAt) > 0) || iso(b.offerExpiresAt) <= iso(b.offeredAt))
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: Offered with offeredAt ${b.offeredAt} / expires ${b.offerExpiresAt}` }))),
  rule("state.no-stale-offer", "state", "No offer stays Offered more than 10 minutes after it expired (the sweep should have moved it on)", (s) =>
    s.bookings.filter((b) => b.status === "Offered" && iso(b.offerExpiresAt) > 0 && iso(b.offerExpiresAt) < iso(s.takenAt) - 10 * 60_000)
      .map((b) => ({ refs: [b.ref], message: `${b.ref}: offer expired ${b.offerExpiresAt} but still Offered` }))),
  rule("state.one-active-per-child-per-day", "state", "A child holds at most one live place per listing per day", (s) => {
    const seen = new Map<string, string[]>();
    for (const b of s.bookings) {
      if (!live(b)) continue;
      const kids = (b.kids ?? []).filter((k) => !k.cancelled);
      const keys = kids.length ? kids.map((k) => (k.childId || k.name || "").toLowerCase()) : [b.childKey || ""];
      const days = b.days.length ? b.days : (blockOf(s, b)?.dates ?? []);
      for (const c of keys) { if (!c) continue; for (const d of days) { const k = `${b.listingId}|${c}|${d}`; seen.set(k, [...(seen.get(k) ?? []), b.ref]); } }
    }
    return [...seen.entries()].filter(([, refs]) => new Set(refs).size > 1).map(([k, refs]) => ({ refs: [...new Set(refs)], message: `child booked twice: ${k} in ${[...new Set(refs)].join(", ")}` }));
  }),
  rule("state.refs-unique", "state", "Booking references are unique", (s) => {
    const seen = new Map<string, number>();
    for (const b of s.bookings) seen.set(b.ref, (seen.get(b.ref) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([ref, n]) => ({ refs: [ref], message: `reference ${ref} used by ${n} bookings` }));
  }),
  rule("state.days-within-block", "state", "A booking's days are all sessions of its block", (s) =>
    s.bookings.flatMap((b) => { const blk = blockOf(s, b); if (!blk || !blk.dates.length || !b.days.length) return []; const bad = b.days.filter((d) => !blk.dates.includes(d)); return bad.length ? [{ refs: [b.ref], message: `${b.ref}: days ${bad.join(",")} are not sessions of block ${blk.id}` }] : []; })),
  rule("state.cancelled-has-cancel-info", "state", "A cancelled booking records when and by whom it was cancelled", (s) =>
    s.bookings.filter((b) => b.status === "Cancelled" && !b.cancel && !seededFixture(b)).map((b) => ({ refs: [b.ref], message: `${b.ref}: Cancelled with no cancel record` }))),
  rule("state.live-has-no-cancel", "state", "A live booking carries no whole-booking cancellation", (s) =>
    s.bookings.filter((b) => live(b) && b.cancel && b.cancel.on && !b.cancel.refundOnly).map((b) => ({ refs: [b.ref], message: `${b.ref}: ${b.status} but has a cancel record dated ${b.cancel!.on}` }))),
  rule("state.seats-cover-kids", "state", "Seats are a positive whole number and at least the children still on the booking", (s) =>
    s.bookings.filter((b) => !Number.isInteger(b.seats) || b.seats < 1 || b.kidsLive > b.seats).map((b) => ({ refs: [b.ref], message: `${b.ref}: seats ${b.seats} with ${b.kidsLive} live children` }))),
  rule("state.refs-resolve", "state", "A live booking points at a block and listing that exist", (s) =>
    s.bookings.filter((b) => live(b) && !seededFixture(b) && (b.blockMissing || b.listingMissing)).map((b) => ({ refs: [b.ref], message: `${b.ref}: ${b.blockMissing ? "block" : "listing"} missing` }))),
  rule("state.date-change-pending-has-moves", "state", "A pending date-change request actually lists moves", (s) =>
    s.bookings.filter((b) => b.dateChangeStatus === "pending" && !(b.dateChangeMoves && b.dateChangeMoves > 0)).map((b) => ({ refs: [b.ref], message: `${b.ref}: pending date change with no moves` }))),
  rule("state.date-change-orig-date-sane", "state", "A moved booking remembers an original first date no later than its first date now, and counts the moves", (s) =>
    s.bookings.filter((b) => b.origFirstDate && live(b)).flatMap((b) => {
      const first = [...b.days].sort()[0];
      const out: { refs: string[]; message: string }[] = [];
      if (first && b.origFirstDate! > first) out.push({ refs: [b.ref], message: `${b.ref}: original first date ${b.origFirstDate} is later than its first date now ${first}` });
      if (!(b.amendMovesApproved && b.amendMovesApproved > 0)) out.push({ refs: [b.ref], message: `${b.ref}: has an original first date but no approved moves counted` });
      return out;
    })),
  rule("state.days-unique", "state", "A booking never lists the same day twice", (s) =>
    s.bookings.filter((b) => new Set(b.days).size !== b.days.length).map((b) => ({ refs: [b.ref], message: `${b.ref}: days list repeats a date (${b.days.join(",")})` }))),
  rule("state.auto-waitlist-no-missed-offer", "state", "In automatic mode a waiting family is offered a free place within 20 minutes", (s) =>
    s.bookings.filter((b) => b.status === "Waitlisted" && b.createdAt && iso(b.createdAt) < iso(s.takenAt) - 20 * 60_000).flatMap((b) => {
      const l = s.listings.find((x) => x.id === b.listingId), blk = blockOf(s, b);
      if (!l || !blk || l.waitlistMode !== "auto" || Object.keys(l.ticketCaps ?? {}).length || Object.keys(l.ageCaps ?? {}).length) return [];
      const need = b.kidsLive || b.seats || 1;
      const days = b.days.length ? b.days : blk.dates;
      const free = blk.capacityScope === "day" ? days.every((d) => (blk.dayCounts?.[d] ?? 0) + need <= blk.capacity) : (blk.bookedCount ?? 0) + need <= blk.capacity;
      return free ? [{ refs: [b.ref], message: `${b.ref}: Waitlisted (auto) for over 20 min while the place is free` }] : [];
    })),
  rule("state.refund-pending-matches-cancel", "state", "'Refund pending' only appears while a cancellation refund really awaits approval", (s) =>
    s.bookings.filter((b) => b.pay === "Refund pending").filter((b) => !b.cancel || !["full", "partial", "pending"].includes(b.cancel.refund ?? "")).map((b) => ({ refs: [b.ref], message: `${b.ref}: Refund pending but cancel.refund is "${b.cancel?.refund ?? "none"}"` }))),

  // ───────────── EMAIL ─────────────
  rule("email.one-confirmation-per-checkout", "email", "A family gets one 'Booking confirmed' email per checkout (plus one per accepted offer)", (s) => {
    const out: Omit<Violation, "rule" | "severity">[] = [];
    const groups = new Map<string, SnapBooking[]>();
    for (const b of s.bookings) { const k = `${b.email}|${b.listingName ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), b]); }
    for (const [k, bs] of groups) {
      const [email, listing] = k.split("|");
      const sorted = bs.filter((b) => iso(b.createdAt) > 0).sort((a, b) => iso(a.createdAt) - iso(b.createdAt));
      // A "run" = bookings by this family for this listing less than 10 min apart (e2e re-runs reuse the address + listing name hours apart). Mail latency can exceed the gap between
      // two quick checkouts, so mail is counted per run and compared with the checkouts in it (a checkout = rows of one basket, created within a second of each other).
      const runs: SnapBooking[][] = [];
      for (const b of sorted) { const r = runs[runs.length - 1]; if (r && iso(b.createdAt) - iso(r[r.length - 1].createdAt) <= MAIL_WINDOW) r.push(b); else runs.push([b]); }
      runs.forEach((r, i) => {
        let checkouts = 0, last = -Infinity;
        for (const b of r) { if (iso(b.createdAt) - last > SAME_BASKET_MS) checkouts++; last = iso(b.createdAt); }
        const offered = r.filter((b) => b.offeredAt).length;
        const start = iso(r[0].createdAt) - MAIL_SKEW;
        const nextStart = i + 1 < runs.length ? iso(runs[i + 1][0].createdAt) - MAIL_SKEW : Infinity;
        const end = Math.min(nextStart, offered ? Infinity : iso(r[r.length - 1].createdAt) + MAIL_WINDOW);
        const sent = (s.emailsSent ?? []).filter((e) => e.kind === "booking-confirmed" && e.to === email && listingOf(e.subject) === listing && iso(e.at) >= start && iso(e.at) < end).length;
        const allowed = checkouts + offered;
        if (sent > allowed) out.push({ refs: r.map((b) => b.ref), message: `${email}: ${sent} 'Booking confirmed' emails for "${listing}" but only ${allowed} checkout(s)/accepted offer(s)` });
      });
    }
    return out;
  }),
  rule("email.one-payment-email-per-payment", "email", "A family gets one 'Payment received' email per settled payment", (s) => {
    const out: Omit<Violation, "rule" | "severity">[] = [];
    const sent = new Map<string, number>();
    for (const e of s.emailsSent ?? []) if (e.kind === "payment-received") { const k = `${e.to}|${listingOf(e.subject)}`; sent.set(k, (sent.get(k) ?? 0) + 1); }
    for (const [k, n] of sent) {
      const [email, listing] = k.split("|");
      const refs = new Set(s.bookings.filter((b) => b.email === email && (b.listingName ?? "") === listing).map((b) => b.ref));
      if (!refs.size) continue; // mail is pooled by family address across tenants: a listing with no booking in THIS tenant belongs to another tenant's snapshot
      const pays = s.payments.filter((p) => !refundPayment(p) && SETTLED.includes(p.status) && p.refs.length && p.refs.every((r) => refs.has(r))).length;
      // A provider marking a bank-transfer / cash / voucher booking Paid by hand (routes/bookings.ts) emails "Payment received" without writing a payment record: one per such booking.
      const byHand = s.bookings.filter((b) => b.email === email && (b.listingName ?? "") === listing && !/^card$/i.test(b.method ?? "") && (b.received ?? 0) > TOL).length;
      if (n > pays + byHand) out.push({ message: `${email}: ${n} 'Payment received' emails for "${listing}" but ${pays} settled payment(s) and ${byHand} hand-marked booking(s)` });
    }
    return out;
  }),
  rule("email.no-confirmation-before-card-payment", "email", "A card booking is only confirmed by email after its card payment has gone through", (s) =>
    s.bookings.filter((b) => /^card$/i.test(b.method ?? "") && b.amount > TOL && b.createdAt).flatMap((b) => {
      const paid = paymentsFor(s, b.ref).filter((p) => !refundPayment(p) && SETTLED.includes(p.status)).map((p) => iso(p.paidAt ?? p.createdAt)).filter((t) => t > 0);
      const first = paid.length ? Math.min(...paid) : Infinity;
      // The rule only means something for a booking that really went through the card gateway (a Stripe payment intent on it or on its payment). Test setups that write
      // "card" bookings straight onto Firestore and "record" a payment by hand have no gateway event to be "before", and are skipped.
      const viaGateway = !!b.paymentIntentId || paymentsFor(s, b.ref).some((p) => !refundPayment(p) && !!p.paymentIntentId);
      if (!viaGateway) return [];
      const win = mailWindow(s, b); win[1] = Math.min(win[1], first - 3000); // within 3 s of the payment record is the same request writing both (seeded/recorded payments), not a confirmation sent early
      const early = mailFor(s, b, "booking-confirmed", win);
      return early.length ? [{ refs: [b.ref], message: `${b.ref}: 'Booking confirmed' emailed before the card payment settled` }] : [];
    })),
  rule("email.waitlisted-never-confirmed", "email", "A family waiting for a place is never emailed 'Booking confirmed' for it", (s) =>
    s.bookings.filter((b) => (b.status === "Waitlisted" || b.status === "Offered") && b.createdAt).flatMap((b) => {
      const hasConfirmed = s.bookings.some((o) => o !== b && o.email === b.email && o.listingId === b.listingId && o.status === "Confirmed" && Math.abs(iso(o.createdAt) - iso(b.createdAt)) <= SAME_BASKET_MS);
      if (hasConfirmed) return [];
      const bad = mailFor(s, b, "booking-confirmed", mailWindow(s, b));
      return bad.length ? [{ refs: [b.ref], message: `${b.ref}: ${b.status} but the family was emailed 'Booking confirmed'` }] : [];
    })),
  rule("state.homevisit-has-service-address", "state", "A booking on a home-visit (or 'both') listing records where the session runs", (s) =>
    s.bookings.filter((b) => !seededFixture(b)).flatMap((b) => {
      const l = s.listings.find((x) => x.id === b.listingId);
      return l && (l.deliveryMode === "home-visit" || l.deliveryMode === "both") && !b.serviceAddress?.postcode?.trim() ? [{ refs: [b.ref], message: `${b.ref}: home-visit listing "${l.name}" but the booking has no service-address postcode` }] : [];
    })),
  rule("state.venue-has-no-service-address", "state", "A venue listing's booking never carries a home-visit service address", (s) =>
    s.bookings.filter((b) => !seededFixture(b) && b.serviceAddress && (b.serviceAddress.postcode || b.serviceAddress.address)).flatMap((b) => {
      const l = s.listings.find((x) => x.id === b.listingId);
      return l && (l.deliveryMode ?? "venue") === "venue" ? [{ refs: [b.ref], message: `${b.ref}: venue listing "${l.name}" but the booking carries a service address` }] : [];
    })),
  rule("state.service-address-in-coverage", "state", "A home-visit booking's postcode is inside the listing's postcode-prefix coverage (district-aware: NN5 is not NN50, SW1 is not SW10)", (s) =>
    s.bookings.filter((b) => !seededFixture(b) && b.serviceAddress?.postcode).flatMap((b) => {
      const l = s.listings.find((x) => x.id === b.listingId);
      if (!l || l.coverageMode !== "postcodePrefixes" || !l.coveragePrefixes?.length || (l.deliveryMode !== "home-visit" && l.deliveryMode !== "both")) return [];
      const pc = b.serviceAddress!.postcode!.toUpperCase().replace(/\s+/g, "");
      const outward = pc.length > 3 ? pc.slice(0, -3) : pc;
      const covered = l.coveragePrefixes.some((raw) => {
        const p = raw.toUpperCase().replace(/\s+/g, "");
        if (!p || !(outward.startsWith(p) || pc.startsWith(p))) return false;
        return !(/\d$/.test(p) && outward.length > p.length && outward.startsWith(p) && /\d/.test(outward[p.length]));
      });
      return covered ? [] : [{ refs: [b.ref], message: `${b.ref}: service postcode ${b.serviceAddress!.postcode} is outside "${l.name}" coverage [${l.coveragePrefixes.join(", ")}]` }];
    })),
];

/** E2E fixtures with OS-A or OS-B refs are written straight into Firestore (no payment / block / cancel docs behind them); the money/state rules that look for those docs skip them. */
const seededFixture = (b: SnapBooking) => /^OS-[AB]/i.test(b.ref);
/** Mail has no booking ref (mailLog keeps only to/subject/at), and e2e re-runs share listing names + addresses. So mail is attributed to ONE booking by time: from just before it
 *  was created until `capMs` later, and never past the next booking by the same family for the same listing (that booking owns later mail). */
/** Bookings of one basket are written within a few seconds of each other; a later booking by the same family for the same listing is a different checkout. */
const SAME_BASKET_MS = 1000;
const MAIL_SKEW = 1000, MAIL_WINDOW = 10 * 60_000;
function mailWindow(s: Snapshot, b: SnapBooking, capMs = MAIL_WINDOW): [number, number] {
  const start = iso(b.createdAt) - MAIL_SKEW;
  const next = s.bookings.filter((o) => o !== b && o.email === b.email && (o.listingName ?? "") === (b.listingName ?? "") && iso(o.createdAt) > iso(b.createdAt) + SAME_BASKET_MS).map((o) => iso(o.createdAt) - MAIL_SKEW);
  return [start, Math.min(iso(b.createdAt) + capMs, ...next)];
}
const mailFor = (s: Snapshot, b: SnapBooking, kind: string, win: [number, number]) =>
  (s.emailsSent ?? []).filter((e) => e.kind === kind && e.to === b.email && listingOf(e.subject) === (b.listingName ?? "") && iso(e.at) >= win[0] && iso(e.at) < win[1]);

function listingOf(subject: string): string { return subject.includes(" — ") ? subject.slice(subject.indexOf(" — ") + 3).trim() : ""; }

export function checkAll(s: Snapshot): Violation[] {
  return INVARIANTS.flatMap((i) => { try { return i.check(s); } catch (e) { return [{ rule: i.id, severity: i.severity, message: `rule crashed: ${(e as Error).message}` }]; } });
}

/** Rules grouped by severity (for reports). */
export const RULE_COUNT = INVARIANTS.length;
