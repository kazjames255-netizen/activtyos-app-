// Franchise payouts - THE one place that decides what a booking is worth to a franchise royalty and how head office and a franchise settle up.
// Pure (no Firebase, no express): the royalty report (/api/splitfees), the Franchise payouts screen, a franchise's own statement and the head
// office overview ALL call this, so they cannot disagree.
//
// The model (owner decision 10 Oct 2026, option A): head office's Stripe account takes every card penny. Head office keeps X% of the money
// and owes the franchise the rest of its card money; money a franchise took itself (cash, bank transfer, voucher, Tax-Free Childcare) is the
// franchise's, so it owes head office X% of that. NET = card x (1 - X%) - direct x X%.
//
// What counts (the safe defaults): only money ACTUALLY RECEIVED on a Confirmed booking (or kept from a Cancelled one), net of every refund.
//  - never unpaid / awaiting payment / pending approval / waitlisted / offered / declined / card-hold-not-captured
//  - card = paid through Stripe (paymentIntentId, or the cardPaid part of a split); everything else received is "direct"
//  - wallet credit spent on a booking is NOT card money (it came from an earlier refund) and is never counted
//  - refunds come off first from the card part (an offline refund comes off the direct part first); a refund back to the wallet is a refund too
//  - a refund the provider has agreed but not yet sent is already taken off; a cancelled booking that kept a fee counts the kept amount only
//  - Stripe's own card fee is NOT deducted (head office absorbs it)
// Dates (CASH statement): money counts in the UK day it was RECEIVED and a refund in the UK day it was GIVEN, so a late payment or refund lands
// in the NEXT period instead of silently changing one already settled (a later period can be net negative: it is simply shown). The rate in
// force on that day applies. A booking is turned into signed "money events" (payments +, refunds -) by eventRows(); everything else adds them up.
import type { Booking } from "../../../features/bookings/types";
import { cashReceivedOf, refundedGross, refundOwedOf } from "../../../features/bookings/helpers";

export const DEFAULT_RATE = 10;
export interface RateStep { from: string; rate: number }

const ukFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
/** The UK calendar day (YYYY-MM-DD) of an ISO timestamp, or null when it is missing / not a date. A date-only value is returned as is. */
export function ukDay(iso?: string | null): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : ukFmt.format(new Date(t));
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toP = (n: number) => Math.round((n || 0) * 100);

/** Keep a stored rate history clean: valid steps only, oldest first, one step per day (the last one given wins). */
export function cleanHistory(h: unknown): RateStep[] {
  if (!Array.isArray(h)) return [];
  const byDay = new Map<string, number>();
  for (const s of h) {
    const from = typeof s?.from === "string" ? s.from : "";
    const rate = Number(s?.rate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && Number.isFinite(rate) && rate >= 0 && rate <= 100) byDay.set(from, round2(rate));
  }
  return [...byDay.entries()].map(([from, rate]) => ({ from, rate })).sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** The royalty percentage in force on a UK day. Before the first step (or with no history) the fallback applies. */
export function rateOn(history: RateStep[], day: string | null, fallback: number = DEFAULT_RATE): number {
  const h = cleanHistory(history);
  if (!h.length) return fallback;
  if (!day) return h[h.length - 1].rate;
  let rate = h[0].from > day ? fallback : h[0].rate;
  for (const s of h) if (s.from <= day) rate = s.rate;
  return rate;
}

/** Append a rate change without touching the past. Returns the new history. The first change records the old rate as the starting step. */
export function withRateChange(history: unknown, oldRate: number, newRate: number, effectiveFrom: string): RateStep[] {
  const h = cleanHistory(history);
  const base = h.length ? h : [{ from: "1970-01-01", rate: oldRate }];
  return cleanHistory([...base, { from: effectiveFrom, rate: newRate }]);
}

export interface BookingMoney {
  /** Could this booking carry payout money at all (Confirmed / Cancelled, no card hold, cash received)? */
  eligible: boolean;
  /** Does this booking count (eligible AND something kept after refunds)? */
  counts: boolean;
  /** Pence received (gross) and refunded, by card / direct: net = in - out. */
  cardIn: number; directIn: number; cardOut: number; directOut: number;
  /** Net card money (pounds), net of refunds, wallet excluded. */
  card: number;
  /** Net money the franchise took directly (pounds). */
  direct: number;
  total: number;
}
const NONE: BookingMoney = { eligible: false, counts: false, cardIn: 0, directIn: 0, cardOut: 0, directOut: 0, card: 0, direct: 0, total: 0 };

/** What one booking is worth for royalty / payouts. Pure; see the rules at the top of the file. */
export function bookingMoney(b: Booking): BookingMoney {
  if (b.status !== "Confirmed" && b.status !== "Cancelled") return NONE;
  const hold = b.cardHold?.state;
  if (hold === "awaiting" || hold === "held") return NONE;
  const cashP = toP(cashReceivedOf(b));
  if (cashP <= 0) return NONE;
  // Split between the card and everything else.
  const isCardSplit = typeof b.cardPaid === "number" && b.cardPaid > 0;
  const card0 = isCardSplit ? Math.min(toP(b.cardPaid ?? 0), cashP) : b.paymentIntentId ? cashP : 0;
  let cardP = card0;
  let directP = cashP - card0;
  // Refunds: the wallet part of a refund went back to the wallet, the rest is real money back.
  const walletBack = Math.min(Math.max(0, b.walletApplied ?? 0), Math.max(0, b.walletRefunded ?? 0));
  let refundP = Math.max(0, toP(refundedGross(b)) - toP(walletBack));
  if (b.status === "Cancelled") refundP += toP(refundOwedOf(b));
  refundP = Math.min(refundP, cashP);
  const offlineFirst = b.cancel?.refundVia === "offline";
  const take = (from: "card" | "direct", n: number) => {
    if (from === "card") { const t = Math.min(cardP, n); cardP -= t; return n - t; }
    const t = Math.min(directP, n); directP -= t; return n - t;
  };
  let left = refundP;
  left = take(offlineFirst ? "direct" : "card", left);
  take(offlineFirst ? "card" : "direct", left);
  return {
    eligible: true, counts: cardP + directP > 0,
    cardIn: card0, directIn: cashP - card0, cardOut: card0 - cardP, directOut: cashP - card0 - directP,
    card: cardP / 100, direct: directP / 100, total: (cardP + directP) / 100,
  };
}

/** The franchise a booking belongs to: its own stamp, else the owner of its listing, else null (head office's own). ONE rule for every screen. */
export function franchiseOf(raw: { franchiseId?: string | null; listingId?: string | null }, listingFr: Map<string, string | undefined | null>): string | null {
  return raw.franchiseId || (raw.listingId ? listingFr.get(raw.listingId) || null : null) || null;
}

/** A payment received on a UK day (from the payments ledger). */
export interface PayEvent { day: string | null; amount: number }
export interface PayoutItem {
  b: Booking; fid: string | null;
  /** Legacy / test shortcut: with no pay events the money is dated by the booking's creation day. */
  createdAt?: string;
  /** The payments ledger rows that brought this booking's money in (any number; weights only). */
  pays?: PayEvent[];
  /** The UK day to use when nothing else dates an event (the booking document's last change). */
  fallbackDay?: string | null;
}
/** A signed money event, small enough to keep in the 60-second cache: payments are positive, refunds negative, in pounds. */
export interface LiteMoney { fid: string | null; day: string | null; card: number; direct: number; /** 1 on the booking's first payment row when it counts, else 0. */ n: number }

/** Split `total` pence over `weights` (largest remainder), so the parts add back to the total exactly. */
function spread(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, v) => a + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]] += 1;
  return out;
}

/** The UK day of a stored refund date: "2026-10-12", an ISO timestamp, or the older "12/10/2026, 09:30" text. */
export function refundDay(on?: string | null): string | null {
  if (!on) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(on.trim());
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return ukDay(on);
}

/** Turn one booking into signed money events (see the header). [] when it cannot carry money. */
export function eventRows(it: PayoutItem): LiteMoney[] {
  const b = it.b;
  const m = bookingMoney(b);
  if (!m.eligible) return [];
  const fallback = it.fallbackDay ?? null;
  const pays: PayEvent[] = it.pays?.length ? it.pays : [{ day: ukDay(it.createdAt ?? b.createdAt) ?? fallback, amount: 1 }];
  const cardParts = spread(m.cardIn, pays.map((p) => p.amount));
  const directParts = spread(m.directIn, pays.map((p) => p.amount));
  const rows: LiteMoney[] = pays.map((p, i) => ({ fid: it.fid, day: p.day ?? fallback, card: cardParts[i] / 100, direct: directParts[i] / 100, n: m.counts && i === 0 ? 1 : 0 }));
  // Refunds, dated by the day each was given. What the log does not cover (an approved or owed cancellation refund) is dated by the cancellation.
  const logged = (b.refundLog || []).filter((x) => (x.amount || 0) > 0).map((x) => ({ day: refundDay(x.on) ?? fallback, amount: x.amount || 0 }));
  const loggedSum = logged.reduce((a, x) => a + x.amount, 0);
  const rest = Math.max(0, refundedGross(b) + (b.status === "Cancelled" ? refundOwedOf(b) : 0) - loggedSum);
  const events = rest > 0.004 ? [...logged, { day: refundDay(b.cancel?.refundedAt) ?? refundDay(b.cancel?.on) ?? fallback, amount: rest }] : logged;
  if (m.cardOut + m.directOut > 0) {
    const ev = events.length ? events : [{ day: fallback, amount: 1 }];
    const cardR = spread(m.cardOut, ev.map((e) => e.amount));
    const directR = spread(m.directOut, ev.map((e) => e.amount));
    ev.forEach((e, i) => { if (cardR[i] || directR[i]) rows.push({ fid: it.fid, day: e.day, card: -cardR[i] / 100, direct: -directR[i] / 100, n: 0 }); });
  }
  return rows;
}
export interface PayoutRow {
  franchiseId: string;
  /** Bookings that counted. */
  bookings: number;
  card: number;
  direct: number;
  /** card + direct. */
  total: number;
  /** Head office keeps (the % of card money). */
  hoKeepsCard: number;
  /** The franchise gets (card money less head office's %). */
  franchiseCard: number;
  /** Head office's % of the money the franchise took directly. */
  hoShareDirect: number;
  /** hoKeepsCard + hoShareDirect = the royalty owed to head office on everything. */
  royalty: number;
  /** Positive = head office pays the franchise; negative = the franchise owes head office. */
  net: number;
  /** The one rate used in the period, or null when it changed part-way (see rates). */
  rate: number | null;
  rates: number[];
}
export interface PayoutResult { franchises: Map<string, PayoutRow>; direct: { bookings: number; card: number; direct: number; total: number } }

export interface PayoutOptions {
  /** Inclusive UK days. */
  from?: string | null;
  to?: string | null;
  history?: RateStep[];
  /** Used before / without any history. */
  fallbackRate?: number;
}

export const inWindow = (day: string | null, from?: string | null, to?: string | null) => {
  if (!from && !to) return true;
  if (!day) return false;
  return !(from && day < from) && !(to && day > to);
};

/** THE calculation. Every franchise id in `knownFranchises` gets a row (even with no bookings). */
export function computePayouts(items: PayoutItem[], opts: PayoutOptions = {}, knownFranchises: Iterable<string> = []): PayoutResult {
  const lite: LiteMoney[] = [];
  for (const it of items) lite.push(...eventRows(it));
  return computeFromLite(lite, opts, knownFranchises);
}

/** The same calculation on rows already boiled down by eventRows. The keep is rounded ONCE per franchise per calendar month and a longer window is
 *  the sum of its months, so the all-time total always equals the sum of the monthly figures. */
export function computeFromLite(rows: LiteMoney[], opts: PayoutOptions = {}, knownFranchises: Iterable<string> = []): PayoutResult {
  const history = cleanHistory(opts.history);
  const fallback = opts.fallbackRate ?? DEFAULT_RATE;
  type Acc = { bookings: number; cardP: number; directP: number; months: Map<string, { keepCard: number; keepDirect: number }>; rates: Set<number> };
  const acc = new Map<string, Acc>();
  const fresh = (): Acc => ({ bookings: 0, cardP: 0, directP: 0, months: new Map(), rates: new Set() });
  for (const f of knownFranchises) acc.set(f, fresh());
  const direct = { bookings: 0, cardP: 0, directP: 0 };
  for (const m of rows) {
    const day = m.day;
    if (!inWindow(day, opts.from, opts.to)) continue;
    if (!m.fid) { direct.bookings += m.n; direct.cardP += toP(m.card); direct.directP += toP(m.direct); continue; }
    const a = acc.get(m.fid) ?? fresh();
    const rate = rateOn(history, day, fallback);
    a.bookings += m.n; a.cardP += toP(m.card); a.directP += toP(m.direct);
    const mk = day ? day.slice(0, 7) : "none";
    const mo = a.months.get(mk) ?? { keepCard: 0, keepDirect: 0 };
    mo.keepCard += toP(m.card) * rate / 100; mo.keepDirect += toP(m.direct) * rate / 100;
    a.months.set(mk, mo);
    if (m.card || m.direct) a.rates.add(rate);
    acc.set(m.fid, a);
  }
  const franchises = new Map<string, PayoutRow>();
  const half = (x: number) => Math.round(x + (x >= 0 ? 1e-9 : -1e-9));
  for (const [fid, a] of acc) {
    let keepP = 0, shareP = 0;
    for (const mo of a.months.values()) { keepP += half(mo.keepCard); shareP += half(mo.keepDirect); }
    const rates = [...a.rates].sort((x, y) => x - y);
    franchises.set(fid, {
      franchiseId: fid, bookings: a.bookings,
      card: a.cardP / 100, direct: a.directP / 100, total: (a.cardP + a.directP) / 100,
      hoKeepsCard: keepP / 100, franchiseCard: (a.cardP - keepP) / 100, hoShareDirect: shareP / 100,
      royalty: (keepP + shareP) / 100, net: (a.cardP - keepP - shareP) / 100,
      rate: rates.length === 1 ? rates[0] : null, rates,
    });
  }
  return { franchises, direct: { bookings: direct.bookings, card: direct.cardP / 100, direct: direct.directP / 100, total: (direct.cardP + direct.directP) / 100 } };
}

/** The royalty a franchise owes head office on the report's basis: a % of the money (with the rate in force on each booking's day), or a flat fee per booking. */
export function royaltyFee(row: Pick<PayoutRow, "royalty" | "bookings">, basis: "revenue" | "perBooking", perBookingFee: number): number {
  return basis === "perBooking" ? round2(row.bookings * (perBookingFee || 0)) : row.royalty;
}

/** One line that shows the arithmetic, e.g. "£900.00 x (100% - 10%) - £200.00 x 10% = £790.00". Money is formatted by the caller (fmt). */
export function netSentence(r: PayoutRow, fmt: (n: number) => string): string {
  const pct = r.rate == null ? "rates" : `${r.rate}%`;
  return `${fmt(r.card)} card - ${fmt(r.hoKeepsCard)} (${pct}) = ${fmt(r.franchiseCard)}; less ${fmt(r.hoShareDirect)} (${pct} of ${fmt(r.direct)} direct) = ${fmt(r.net)}`;
}

/** Month picker helpers: the first and last UK day of "YYYY-MM". */
export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}
