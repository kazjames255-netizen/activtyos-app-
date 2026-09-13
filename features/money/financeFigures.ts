// ─────────────────────────────────────────────────────────────────────────
// Finance & analytics — the figures, as plain functions. Kept out of the
// component (FinanceAnalyticsApp.tsx) so the maths the page shows can be run
// and checked against the Dashboard on its own (acceptance d19s1/s2/s7).
// ─────────────────────────────────────────────────────────────────────────
import { collectedNet, isMoneyIn, owedNow, receivedOf } from "../bookings/helpers";
import type { Booking } from "../bookings/types";
import { ACT_C, money, colorFor } from "./finance-kit";

/** A payment record as GET /api/payments returns it (the fields we use). */
export interface PaymentRecord { id: string; refs?: string[]; email?: string; method?: string; amount: number; type?: string; status: string; createdAt: string; paidAt?: string; offline?: boolean; paymentIntentId?: string }

// Same hexes as the page's palette.
const BLUE = "#1d3a8f", GREEN = "#0f7a43";
export const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
export const monthOf = (b: Booking): string | null => { const s = b.createdAt || b.days?.[0] || ""; const m = s.slice(0, 7); return /^\d{4}-\d{2}$/.test(m) ? m : null; };
// "YYYY-MM" from an ISO stamp or the en-GB "13/09/2026, 10:30" refunds carry.
const monthOfStamp = (s?: string | null): string | null => {
  if (!s) return null;
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}` : null;
};
// Paid by card through the provider's payout account (not a voucher scheme).
const isCardBooking = (b: Booking) => /card/i.test(b.method || "") && !b.voucherScheme;
/** A settled card payment — the only kind that becomes a payout. */
export const isCardPayment = (p: PaymentRecord) => isMoneyIn(p) && p.status === "succeeded" && !p.offline && !!p.paymentIntentId;
export const bookerKey = (b: Booking) => (b.email || b.booker || "").trim().toLowerCase();
export const learnerNames = (b: Booking): string[] => (b.kids?.length ? b.kids.map((k) => k.name).filter(Boolean) : b.child ? [b.child] : []) as string[];
const bookingAges = (b: Booking): number[] => {
  const fromKids = (b.kids ?? []).map((k) => Number((k as { age?: number }).age)).filter((n) => Number.isFinite(n) && n > 0);
  if (fromKids.length) return fromKids;
  return Number.isFinite(Number(b.age)) && Number(b.age) > 0 ? [Number(b.age)] : [];
};
const SOURCE_OF = (b: Booking) => (b.pay === "Funded" ? "Childcare / voucher" : b.method || "Card");
const AGE_BUCKETS: [string, number, number][] = [["Under 5", 0, 4], ["5–7", 5, 7], ["8–10", 8, 10], ["11–13", 11, 13], ["14+", 14, 200]];

export type PayIndex = {
  byRef: Map<string, { month: string; at: string; amount: number; card: boolean }[]>;
  loneCard: { at: string; amount: number }[];
};

/**
 * Payment records by booking ref — when each booking's money actually came
 * in, and whether it came by card. A checkout covering several bookings is
 * split by each booking's price. Records with no booking (invoice pay-links,
 * meal orders) are kept aside: card money, but not any listing's.
 */
export function payIndex(bookings: Booking[], payments: PaymentRecord[]): PayIndex {
  const price = new Map(bookings.map((b) => [b.ref, b.amount || 0] as const));
  const byRef: PayIndex["byRef"] = new Map();
  const loneCard: PayIndex["loneCard"] = [];
  for (const p of payments) {
    if (!isMoneyIn(p)) continue;
    const at = p.paidAt ?? p.createdAt ?? "";
    const month = monthOfStamp(at);
    if (!month) continue;
    const card = !p.offline && !!p.paymentIntentId;
    const refs = p.refs ?? [];
    if (!refs.length) { if (card) loneCard.push({ at, amount: Number(p.amount) || 0 }); continue; }
    const tot = refs.reduce((n, r) => n + (price.get(r) ?? 0), 0);
    for (const r of refs) {
      const share = tot > 0 ? (price.get(r) ?? 0) / tot : 1 / refs.length;
      const list = byRef.get(r) ?? [];
      list.push({ month, at, amount: (Number(p.amount) || 0) * share, card });
      byRef.set(r, list);
    }
  }
  return { byRef, loneCard };
}

export interface FinanceInput {
  bookings: Booking[];
  payIdx: PayIndex;
  months: number;
  nowMs: number;
  season: string;
  venue: string;
  listingSeason: Record<string, string>;
  listingVenue: Record<string, string>;
  listingVenueId: Record<string, string>;
}

export function financeFigures({ bookings, payIdx, months, nowMs, season, venue, listingSeason, listingVenue, listingVenueId }: FinanceInput) {
  // Waitlisted places have paid nothing and hold no seat, so they're neither
  // revenue nor an attendee — exclude them (alongside Declined). Cancelled
  // stays IN so its retained/refunded money still nets out below.
  const all = bookings.filter((b) =>
    b.status !== "Declined" && b.status !== "Waitlisted"
    && (!season || listingSeason[b.listingId ?? ""] === season)
    && (!venue || listingVenueId[b.listingId ?? ""] === venue));
  const now = new Date(nowMs);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  const inWindow = new Set(keys);
  const windowStart = `${keys[0]}-01`;
  // The equal-length window immediately before, for period-on-period deltas.
  const prevKeys = new Set<string>();
  for (let i = 2 * months - 1; i >= months; i--) prevKeys.add(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));

  // Each figure moves with the period in its OWN sense (d19s2):
  //  - booked, customers, learners — by the month the booking was made;
  //  - collected — by the month the money was PAID, where a payment record
  //    says so (a March booking paid in September is September's money);
  //    the rest of it, with no record, stays on the booking's month;
  //  - refunds — by the month they were given;
  //  - owed — NOT windowed at all: it's what's owed now. A family still
  //    owing on a booking made seven months ago vanished from Debts at 6m.
  const collectedSplit = (b: Booking): [string, number][] => {
    const net = collectedNet(b);
    const booked = monthOf(b);
    if (net <= 0) return [];
    const recs = payIdx.byRef.get(b.ref) ?? [];
    const received = receivedOf(b);
    const recTotal = recs.reduce((s, r) => s + r.amount, 0);
    if (!recs.length || received <= 0) return booked ? [[booked, net]] : [];
    // Scaled so the parts always add up to collectedNet — the all-time
    // figure is unchanged, only when it lands moves.
    const k = net / Math.max(received, recTotal);
    const parts: [string, number][] = recs.map((r) => [r.month, r.amount * k]);
    if (received > recTotal && booked) parts.push([booked, (received - recTotal) * k]);
    return parts;
  };
  // refundedGross(), split by when each refund was given.
  const refundSplit = (b: Booking): [string | null, number][] => {
    const booked = monthOf(b);
    const parts: [string | null, number][] = (b.refundLog ?? []).map((e) => [monthOfStamp(e.on) ?? booked, e.amount || 0]);
    const c = b.cancel;
    if (c && (b.pay === "Refunded" || b.pay === "Partially refunded" || c.refund === "approved"))
      parts.push([monthOfStamp(c.refundedAt) ?? monthOfStamp(c.on) ?? booked, c.amount || 0]);
    return parts;
  };

  // First-seen (all time) so we can split new vs returning customers/learners.
  const firstBooker = new Map<string, string>();
  const firstLearner = new Map<string, string>();
  for (const b of all) {
    const when = b.createdAt || b.days?.[0] || "";
    const bk = bookerKey(b);
    if (bk && (!firstBooker.has(bk) || when < firstBooker.get(bk)!)) firstBooker.set(bk, when);
    for (const ln of learnerNames(b)) { const k = ln.toLowerCase(); if (!firstLearner.has(k) || when < firstLearner.get(k)!) firstLearner.set(k, when); }
  }

  const bookedByMonth = keys.map((k) => ({ label: k, value: 0 }));
  const collectedByMonth = keys.map((k) => ({ label: k, value: 0 }));
  const bySource = new Map<string, number>();
  // Keyed by listingId so same-named listings don't merge; carries venue.
  const byListing = new Map<string, { name: string; venue?: string; value: number }>();
  const byBooker = new Map<string, { name: string; value: number }>();
  const bookersInWin = new Set<string>();
  const learnersInWin = new Set<string>();
  const ages: number[] = [];
  const owing: { ref: string; name: string; listing: string; owed: number; when: string }[] = [];
  let booked = 0, collected = 0, refunds = 0, owed = 0, paidBookings = 0, paidSessions = 0, freeSessions = 0;
  let prevCollected = 0, prevBooked = 0;
  let newBookers = 0, returningBookers = 0, newLearners = 0, returningLearners = 0;
  const seenBooker = new Set<string>(), seenLearner = new Set<string>();

  for (const b of all) {
    const m = monthOf(b);
    const inWin = !!m && inWindow.has(m);
    if (m && prevKeys.has(m) && !isCancelled(b)) prevBooked += b.amount;
    // Collected, by the month it was paid.
    let col = 0;
    for (const [pm, amt] of collectedSplit(b)) {
      if (prevKeys.has(pm)) prevCollected += amt;
      if (inWindow.has(pm)) { collectedByMonth[keys.indexOf(pm)].value += amt; col += amt; }
    }
    collected += col;
    for (const [rm, amt] of refundSplit(b)) if (rm && inWindow.has(rm)) refunds += amt;
    // Owed NOW — the one rule the Dashboard uses too (owedNow, d19s7).
    const o = owedNow(b);
    if (o > 0) { owed += o; owing.push({ ref: b.ref, name: b.booker || b.email || "—", listing: b.listing || "", owed: o, when: b.createdAt || b.days?.[0] || "" }); }
    if (col > 0) { paidBookings++; bySource.set(SOURCE_OF(b), (bySource.get(SOURCE_OF(b)) ?? 0) + col); }
    if (!isCancelled(b) && (b.listingId || b.listing) && (inWin || col > 0)) {
      const key = b.listingId || b.listing!;
      const cur = byListing.get(key) ?? { name: b.listing || "—", venue: b.listingId ? listingVenue[b.listingId] : undefined, value: 0 };
      cur.value += col; byListing.set(key, cur);
    }
    if (col > 0) { const cur = byBooker.get(bookerKey(b)) ?? { name: b.booker || b.email || "—", value: 0 }; cur.value += col; byBooker.set(bookerKey(b), cur); }
    if (!inWin) continue;
    const i = keys.indexOf(m!);
    if (!isCancelled(b)) { bookedByMonth[i].value += b.amount; booked += b.amount; }
    const sess = b.sessions?.length || b.seats || 1;
    if (!isCancelled(b)) { if (b.amount > 0) paidSessions += sess; else freeSessions += sess; }

    const bk = bookerKey(b);
    if (bk && !bookersInWin.has(bk)) {
      bookersInWin.add(bk);
      if ((firstBooker.get(bk) ?? "") >= windowStart) newBookers++; else returningBookers++;
    }
    if (bk && !seenBooker.has(bk)) seenBooker.add(bk);
    for (const ln of learnerNames(b)) {
      const k = ln.toLowerCase();
      if (!learnersInWin.has(k)) { learnersInWin.add(k); if ((firstLearner.get(k) ?? "") >= windowStart) newLearners++; else returningLearners++; }
      if (!seenLearner.has(k)) seenLearner.add(k);
    }
    if (!isCancelled(b)) ages.push(...bookingAges(b));
  }

  // ── Payouts: CARD money only (d19s1) ──
  // Only card payments go through the provider's payout account. Cash, bank
  // transfer, vouchers and Tax-Free Childcare land with them directly — they
  // were being shown as a Stripe payout "on the way" with card fees taken
  // off. Card money = a card booking's takings (or the card part of a split
  // booking), less what went back to the card; dated by its card payment
  // record where there is one. Still estimates — labelled as such.
  const CARD_FEE = (gross: number) => gross * 0.014 + 0.2;
  const cardEvents: { gross: number; net: number; at: string }[] = [];
  for (const b of all) {
    const gross = isCardBooking(b) ? receivedOf(b) : Math.max(0, Math.min(b.cardPaid ?? 0, receivedOf(b)));
    if (gross <= 0) continue;
    const c = b.cancel;
    const backToCard = c?.refundVia === "card" ? Math.max(0, (b.refundedApproved ?? c.amount ?? 0) - (b.walletRefunded ?? 0)) : 0;
    const at = (payIdx.byRef.get(b.ref) ?? []).filter((r) => r.card).map((r) => r.at).sort().pop() || b.createdAt || "";
    cardEvents.push({ gross, net: Math.max(0, gross - backToCard), at });
  }
  // Card payments not tied to a booking (invoice pay-links, meal orders) —
  // card money too, but they belong to no listing, so only when unfiltered.
  if (!season && !venue) for (const p of payIdx.loneCard) cardEvents.push({ gross: p.amount, net: p.amount, at: p.at });

  const fees = cardEvents.filter((e) => { const m = monthOfStamp(e.at); return m != null && inWindow.has(m); }).reduce((s, e) => s + CARD_FEE(e.gross), 0);

  // Expected payout split: settled (older than 7 days) vs on-the-way (last 7 days).
  const weekAgo = nowMs - 7 * 86400000;
  let inTransit = 0, inBank = 0;
  for (const e of cardEvents) {
    const t = Date.parse(e.at.length === 10 ? `${e.at}T00:00:00Z` : e.at);
    if (Number.isNaN(t)) continue;
    const net = Math.max(0, e.net - CARD_FEE(e.gross));
    if (t >= weekAgo) inTransit += net; else inBank += net;
  }

  const ageDist = AGE_BUCKETS.map(([label, lo, hi], i) => ({ label, value: ages.filter((n) => n >= lo && n <= hi).length, sub: String(ages.filter((n) => n >= lo && n <= hi).length), color: ACT_C[i % ACT_C.length] }));
  const topListings = [...byListing.values()].sort((x, y) => y.value - x.value).slice(0, 8).map((v, i) => ({ label: v.name, venue: v.venue, value: v.value, sub: money(v.value), color: ACT_C[i % ACT_C.length] }));
  const topCustomers = [...byBooker.values()].sort((x, y) => y.value - x.value).slice(0, 8).map((v, i) => ({ label: v.name, value: v.value, sub: money(v.value), color: ACT_C[i % ACT_C.length] }));
  const sourceRows = [...bySource.entries()].sort((x, y) => y[1] - x[1]);
  // Period-on-period change (this window vs the one before it).
  const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

  return {
    keys, windowStart,
    bookedByMonth, collectedByMonth,
    booked, collected, refunds, owed, net: collected - fees, fees,
    prevCollected, prevBooked, collectedDelta: pctChange(collected, prevCollected), bookedDelta: pctChange(booked, prevBooked),
    inTransit, inBank,
    source: sourceRows.map(([label, value]) => ({ label, value, color: label.startsWith("Childcare") ? GREEN : label === "Card" ? BLUE : colorFor(label) })),
    topListings, topCustomers,
    owing: owing.sort((x, y) => y.owed - x.owed),
    totalBookers: bookersInWin.size, totalLearners: learnersInWin.size,
    newBookers, returningBookers, newLearners, returningLearners,
    paidSessions, freeSessions,
    spendPerCustomer: bookersInWin.size ? collected / bookersInWin.size : 0,
    ageDist, paidBookings,
  };
}
