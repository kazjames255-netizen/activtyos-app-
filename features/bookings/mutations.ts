// Pure booking mutations — the single source of truth for booking business
// rules. Imported by BOTH the client store (features/bookings/store.ts) and
// the Express API (server/src/routes/bookings.ts), so the two can never
// drift. No React/zustand/Firebase imports allowed here.

import type { Booking } from "./types";
import { bookingKids, dayIso, kidActiveDays, nowStr, paidSoFar, refundAwaitingTransfer, refundTransferAmount, unsentRefunds, refundableSoFar, refundedTotal, releaseValue, sessionDayLabel } from "./helpers";
import { followCancelledDays } from "./addonDays";
import { undoAddonStamps } from "./addonRefund";
import { accumulatePendingRelease } from "../../lib/cancellation";

export type RowAction =
  | "approve"
  | "decline"
  | "paid"
  | "recon"
  | "promote"
  | "refund-approve"
  | "refund-decline"
  // The provider confirms they have SENT an offline (bank transfer / cash / voucher) refund they had only recorded.
  | "refund-sent"
  // Approve / deny a parent's pending date-change request. Approve applies the
  // day swaps; both clear the pending flag.
  | "move-approve"
  | "move-deny"
  // Waiting list: offer the place with a 2-hour hold (vs "promote", the
  // operator's immediate — possibly overbooking — seat).
  | "offer";

export type BulkAction = "approve" | "decline" | "waitlist" | "cancel";

export type RefundType = "full" | "partial" | "none";

export interface CreateBookingInput {
  booker: string;
  email: string;
  child: string;
  age: number;
  listing: string;
  pass: string;
  dates: string;
  amount: number;
  method: string;
  /** The family's phone (checkout, or their record with the provider). Stored
   *  as given — never a "—" placeholder: staff ring this number at hand-over,
   *  and a placeholder hid the real one everywhere it was read (d10s8). */
  phone?: string;
}

// Recompute a booking's derived status/pay after per-child/per-day refunds.
function applyCancelState(b: Booking) {
  const kids = bookingKids(b);
  const allCancelled = kids.length > 0 && kids.every((k) => k.cancelled);
  if (allCancelled) b.status = "Cancelled";
  const r = refundedTotal(b);
  if (r > 0 && r >= b.amount - 0.001) b.pay = "Refunded";
  else if (r > 0) b.pay = "Partially refunded";
}

const nowIso = () => new Date().toISOString();

export function applyRowAction(b: Booking, action: RowAction): void {
  if (action === "approve") b.status = "Confirmed";
  else if (action === "decline") b.status = "Declined";
  // Marking it paid/voucher-received settles it IN FULL — record the money so
  // reconciliation sees nothing outstanding and auto-marks it reconciled.
  else if (action === "paid") { b.pay = (b.amount ?? 0) <= 0 ? "Funded" : "Paid"; b.amountPaid = b.amount ?? 0; }
  else if (action === "recon") b.recon = !b.recon;
  else if (action === "promote") {
    b.status = "Confirmed";
    b.note = "Promoted from waitlist.";
  } else if (action === "offer") {
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    b.status = "Offered";
    b.offeredAt = nowIso();
    b.offerExpiresAt = expires.toISOString();
    b.note = "Place offered — held for 2 hours.";
  } else if (action === "refund-approve") {
    // Only a refund that actually returns money makes the booking "Refunded" (a no-refund cancellation approved by mistake must not).
    if (b.cancel && b.cancel.refund !== "none" && (b.cancel.amount ?? 1) > 0.004) { b.cancel.refund = "approved"; b.pay = "Refunded"; }
    if (b.cancel) delete b.cancel.addonUndo; // approved: the marks are final
  } else if (action === "refund-sent") {
    if (refundAwaitingTransfer(b)) {
      // Every recorded offline refund still waiting is confirmed together: the provider sent what the screen showed (the sum of them all).
      const amount = refundTransferAmount(b), at = nowIso();
      for (const e of b.refundEntries ?? []) if (e.via === "offline" && e.status === "approved") { e.status = "sent"; e.sentAt = at; }
      if (b.cancel && b.cancel.refund === "approved" && b.cancel.refundVia === "offline") { b.cancel.refundTransfer = "sent"; b.cancel.refundSentAt = at; }
      b.lastRefundSent = { amount, at };
    }
  } else if (action === "refund-decline") {
    if (b.cancel) b.cancel.refund = "declined";
    undoAddonStamps(b); // nothing went back, so no extra is "refunded" on this refund's account
    if (b.pay === "Refund pending") b.pay = "Paid";
  } else if (action === "move-approve") {
    const req = b.dateChangeRequest;
    if (req) {
      // Each move changes only ITS child's day (matching on date alone moved the wrong child when two children shared a date).
      const swapOne = (arr: string[] | undefined, from: string, to: string) => arr?.map((d) => (d === from ? to : d));
      for (const m of req.moves) {
        const kid = b.kids?.find((k) => (m.childId && k.childId === m.childId) || k.name === m.childName);
        if (kid && kid.dates?.length) kid.dates = swapOne(kid.dates, m.from, m.to)!;
        else b.days = swapOne(b.days, m.from, m.to);
      }
      req.status = "approved";
      b.note = "Date change approved.";
    }
  } else if (action === "move-deny") {
    if (b.dateChangeRequest) { b.dateChangeRequest.status = "denied"; b.note = "Date change declined."; }
  }
}

/** After an approved refund moved the money: an OFFLINE refund (the app cannot send it) is only RECORDED until the provider confirms the transfer;
 *  `alreadySent` lets a provider who sent it first confirm in one step. Card / wallet refunds are not touched. */
export function markRefundRecorded(b: Booking, via: "wallet" | "card" | "offline", alreadySent: boolean, by?: string): void {
  if (!b.cancel || via !== "offline") return;
  const at = nowIso();
  b.cancel.refundRecordedAt = at;
  b.cancel.refundTransfer = alreadySent ? "sent" : "awaiting";
  if (alreadySent) { b.cancel.refundSentAt = at; if (by) b.cancel.refundSentBy = by; }
}

export function applyBulkAction(b: Booking, action: BulkAction): void {
  if (action === "approve") b.status = "Confirmed";
  else if (action === "decline") b.status = "Declined";
  else if (action === "waitlist") b.status = "Waitlisted";
  else if (action === "cancel") b.status = "Cancelled";
}

/** The single `cancel` record is overwritten by the next refund. An older booking whose approved bank / cash / voucher refund is still unsent has no
 *  entry for it yet: keep it as one BEFORE the record is replaced, so the money still owed to the family is never forgotten. */
export function archiveAwaitingRefund(b: Booking): void {
  if ((b.refundEntries ?? []).length) return;
  const open = unsentRefunds(b);
  if (!open.length) return;
  b.refundEntries = [{ id: `legacy-${open[0].since || "x"}`, amount: b.cancel?.amount ?? open[0].cash, cash: open[0].cash, via: "offline", status: "approved", approvedAt: open[0].since || nowIso(), note: "recorded before refunds were kept as entries" }];
}

export function applyCancel(b: Booking, refund: RefundType, partialAmount?: number, reason?: string): void {
  // "Full" gives back what was actually paid (incl. wallet credit), and a
  // partial refund can't exceed it — it used to refund `amount` whatever had
  // been paid, and take any partial figure typed in.
  const paid = refundableSoFar(b);
  let amt = refund === "full" ? paid : 0;
  if (refund === "partial") amt = Math.min(Math.max(0, partialAmount || 0), paid);
  if (b.past !== true) b.status = "Cancelled";
  archiveAwaitingRefund(b);
  b.cancel = {
    on: nowStr(),
    by: "Provider",
    refund,
    amount: amt,
    refundOnly: b.past === true,
    msg: b.past === true ? "Refund issued by provider." : "Cancelled by provider.",
    ...(reason ? { reason } : {}),
  };
  // Nothing has been paid back yet: the refund still has to be approved (which
  // moves the money). Until then the booking says so and the money still counts
  // as received — it flips to Refunded / Partially refunded on refund-approve.
  b.pay = refund !== "none" && amt > 0 ? "Refund pending" : b.pay;
}

export type ReleaseResolution = "refund" | "wallet" | "none";
export interface ReleaseOpts {
  /** What happens to the money. Default "refund" = a PENDING refund the provider
   *  sends themselves and then marks sent (nothing is recorded as refunded yet). */
  resolution?: ReleaseResolution;
  /** The provider's figure (defaults to the child's/day's share of what was paid). */
  amount?: number;
}
export interface ReleaseResult { resolution: ReleaseResolution; amount: number }

/** Money for a cancelled child/day. "refund" raises a pending request (cancel.refund
 *  = "pending"), counted as OWED until refund-approve; "wallet" is credit, instant
 *  and logged now (the server credits the wallet); "none" moves nothing. */
function settleRelease(b: Booking, label: string, value: number, opts?: ReleaseOpts): ReleaseResult {
  const resolution = opts?.resolution ?? "refund";
  const prior = b.cancel && b.cancel.refundOnly && b.cancel.refund === "pending" ? Math.max(0, b.cancel.amount ?? 0) : 0;
  const room = Math.max(0, refundableSoFar(b) - prior);
  const asked = opts?.amount != null && Number.isFinite(opts.amount) ? Math.max(0, opts.amount) : value;
  const amt = resolution === "none" ? 0 : Math.round(Math.min(asked, room) * 100) / 100;
  if (amt > 0 && resolution === "wallet") {
    (b.refundLog = b.refundLog || []).push({ label: `${label} — wallet credit`, amount: amt, on: nowStr(), by: "Provider", source: "Wallet" });
  } else if (amt > 0) {
    archiveAwaitingRefund(b);
    b.cancel = {
      on: nowStr(),
      by: "Provider",
      refund: "pending",
      amount: accumulatePendingRelease(b.cancel, amt, refundableSoFar(b)),
      refundOnly: true, // the booking itself stands (or is already cancelled by its children)
      msg: `${label} cancelled by the provider.`,
    };
  }
  return { resolution, amount: amt };
}

/** ONE money rule for anything that removes a share from a booking (a cancelled day, an approved request to cancel extras):
 *    new amount = old amount - removed share;  refund = max(0, paid - new amount)  (never more than is still refundable).
 *  A part-paid booking whose new amount is still above what was paid refunds nothing (it simply owes less); a booking paid in full refunds the share;
 *  one paid a little less than in full refunds only the overpaid part. `opts.amount` is the provider's own (smaller) figure. The booking itself stands. */
export function settleShareRemoval(b: Booking, label: string, share: number, opts?: ReleaseOpts): ReleaseResult {
  // Keep what was actually paid on the record before the amount moves (a joint booking stores no amountPaid, only a Paid status).
  const settled = b.pay === "Paid" || b.pay === "Refund pending" || b.pay === "Refunded" || b.pay === "Partially refunded";
  if (settled) b.amountPaid = Math.max(b.amountPaid ?? 0, b.amount ?? 0);
  const prior = b.cancel && b.cancel.refundOnly && b.cancel.refund === "pending" ? Math.max(0, b.cancel.amount ?? 0) : 0;
  // WALLET: `amount` is the CASH due, net of the wallet credit spent at checkout, while "paid" adds that credit back. So compare on the GROSS price
  // (cash due + wallet spent, less any share already taken off the wallet part): the share leaves the cash due first, then the wallet part.
  const take = Math.max(0, share);
  const cash = b.amount ?? 0;
  const wallet = Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0));
  const fromWallet = Math.min(wallet, Math.max(0, take - cash));
  b.amount = Math.round(Math.max(0, cash - take) * 100) / 100;
  if (fromWallet > 0) b.walletRelieved = Math.round(((b.walletRelieved ?? 0) + fromWallet) * 100) / 100;
  const newGross = Math.round((b.amount + wallet - fromWallet) * 100) / 100;
  const overpaid = Math.round(Math.max(0, refundableSoFar(b) - prior - newGross) * 100) / 100;
  // The provider's own figure replaces the default (capped, as always, at what is still refundable).
  return settleRelease(b, label, overpaid, { resolution: opts?.resolution, amount: opts?.amount });
}

/** A refund of a price difference on an old stored change request (new requests carry none): a plain release of that amount. */
export function applyAddonRelease(b: Booking, label: string, amount: number, resolution: ReleaseResolution): ReleaseResult {
  return settleRelease(b, `${label} (extra)`, amount, { resolution, amount });
}

/** What ONE cancelled day (or `n` days) of a child is worth in the PASS price: the pass part of the amount (the amount less the extras) shared
 *  over the days still standing, so the share stays steady as days are removed. Call BEFORE the day is marked cancelled. */
export function passDayShare(b: Booking, kids: NonNullable<Booking["kids"]>, n = 1): number {
  const extras = (b.addonLines ?? []).reduce((t, l) => t + (Number(l.price) || 0), 0);
  const pass = Math.max(0, (b.amount ?? 0) + Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0)) - extras); // gross: cash due + wallet spent
  const standing = kids.reduce((t, k) => t + (k.cancelled ? 0 : kidActiveDaysIso(k).length), 0);
  return standing > 0 ? Math.round(((pass / standing) * Math.min(n, standing)) * 100) / 100 : 0;
}
const kidActiveDaysIso = (k: { dates?: string[]; cancelledDays?: string[] }) => {
  const gone = (k.cancelledDays ?? []).map((d) => dayIso(d) ?? d);
  return (k.dates ?? []).filter((d) => gone.indexOf(dayIso(d) ?? d) < 0);
};

export function applyCancelChild(b: Booking, ki: number, opts?: ReleaseOpts): ReleaseResult | null {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (!k || k.cancelled) return null;
  const value = releaseValue(b, ki);
  k.cancelled = true;
  k.cancelledDays = (k.dates || []).slice();
  const res = settleRelease(b, `${k.name || "Child"} — whole place`, value, opts);
  // kids came from bookingKids which may be a synthesised single-child array;
  // persist it back onto the booking so state survives.
  if (!b.kids) b.kids = kids;
  applyCancelState(b);
  return res;
}

export function applyCancelDay(b: Booking, ki: number, dt: string, opts?: ReleaseOpts): ReleaseResult | null {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (!k || k.cancelled) return null;
  k.cancelledDays = k.cancelledDays || [];
  if (k.cancelledDays.some((d) => (dayIso(d) ?? d) === (dayIso(dt) ?? dt))) return null;
  const share = removedShare(b, kids, k.name, [dt]);
  k.cancelledDays.push(dt);
  const res = settleShareRemoval(b, `${k.name || "Child"} — ${dt}`, share, opts);
  if (kidActiveDays(k).length === 0) k.cancelled = true;
  if (!b.kids) b.kids = kids;
  applyCancelState(b);
  return res;
}

/** The share a child's cancelled days take off the booking: the pass price of those days, plus the child's DAILY extras for them (those lines lose
 *  the days and read x6, x5...). A one-off extra and a meal are not tied to a day and are never part of it. Edits the extra lines. */
function removedShare(b: Booking, kids: NonNullable<Booking["kids"]>, child: string, days: string[]): number {
  const pass = passDayShare(b, kids, days.length);
  return Math.round((pass + followCancelledDays(b, child, days.map((d) => dayIso(d) ?? d))) * 100) / 100;
}

export function applyChangeDayMutation(b: Booking, ki: number, oldDt: string, newDt: string): void {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (k && k.dates) {
    const ix = k.dates.indexOf(oldDt);
    if (ix > -1) k.dates[ix] = newDt;
    if (!b.kids) b.kids = kids;
  }
}

export function applyNote(b: Booking, text: string): void {
  b.note = text;
}

// Parent-initiated cancellation: a REQUEST, not a provider cancel. The refund
// sits "pending" until the provider uses refund-approve / refund-decline
// (applyRowAction above) — matching the legacy "cancelled by Booker" records.
export function applyParentCancel(b: Booking, msg?: string, reason?: string): void {
  b.status = "Cancelled";
  archiveAwaitingRefund(b);
  b.cancel = {
    on: nowStr(),
    by: "Booker",
    refund: "pending",
    msg: msg || "Cancelled by the parent.",
    ...(reason ? { reason } : {}),
  };
}

/** Once a parent's cancellation carries a refund (cancel.amount set from the policy / credit note), a booking that was
 *  fully paid reads "Refund pending" right away, exactly like an operator cancel — until the provider approves (then
 *  "Refunded") or declines (back to "Paid", see refund-decline). Unpaid / part-refunded bookings are left alone. */
export function markRefundPending(b: Booking): void {
  const c = b.cancel;
  if (b.status === "Cancelled" && c && c.refund !== "none" && c.refund !== "declined" && (c.amount ?? 0) > 0.004 && b.pay === "Paid") b.pay = "Refund pending";
}

/** A family releases individual days of a multi-day pass (partial cancel).
 *
 *  Releases are per child, in ISO dates. The booking stays Confirmed for
 *  whatever is left standing — a child who has released every one of their days
 *  is marked cancelled, and only when every child is does the booking itself
 *  become Cancelled.
 *
 *  What each field means afterwards matters, because the parent's per-day price
 *  is `amount ÷ total booked child-days`:
 *    · `kids[].dates`      — what was BOOKED. Never shrinks, or the per-day
 *                            price would inflate with every release.
 *    · `kids[].cancelledDays` — what has been released. Grows.
 *    · `days` / `sessions` — what is still ON. Shrinks, so registers, capacity
 *                            and the parent's session list stop showing it.
 *  `amount` is left alone for the same reason: it is the price of what was
 *  booked, and any money going back is tracked separately.
 */
export function applyPartialCancel(b: Booking, releases: { childKey: string; days: string[] }[]): void {
  const kids = bookingKids(b);
  const released = new Set<string>();
  let removed = 0;
  for (const r of releases) {
    const k = kids.find((x) => (x.childId ?? x.name) === r.childKey);
    if (!k) continue;
    k.cancelledDays = k.cancelledDays || [];
    // Days are compared as ISO (a child's days may be stored as labels), and a released day is stored the way that child's days are.
    const goneIso = k.cancelledDays.map((d) => dayIso(d) ?? d);
    const fresh = [...new Set(r.days.map((d) => dayIso(d) ?? d))].filter((d) => goneIso.indexOf(d) < 0);
    if (fresh.length) removed += removedShare(b, kids, k.name, fresh);
    for (const d of fresh) {
      k.cancelledDays.push((k.dates ?? []).find((x) => (dayIso(x) ?? x) === d) ?? d);
      released.add(d);
    }
    if (kidActiveDays(k).length === 0) k.cancelled = true;
  }
  b.kids = kids;
  // Nothing paid yet: the released days (their pass share and their daily extras) leave what is owed. A booking with money on it keeps its amount
  // here: the family's refund for released days is worked out by the cancellation policy (and the parent's preview divides this amount).
  if (removed > 0 && paidSoFar(b) <= 0.004) b.amount = Math.round(Math.max(0, (b.amount ?? 0) - removed) * 100) / 100;
  // A day only leaves the booking once NO child is still on it.
  const stillOn = new Set(kids.flatMap((k) => (k.cancelled ? [] : kidActiveDays(k))));
  const gone = [...released].filter((d) => !stillOn.has(d));
  if (gone.length) {
    if (b.days) b.days = b.days.filter((d) => !gone.includes(d));
    // `sessions` are display labels ("Mon 27 Jul 2026 · 09:00 – 15:00").
    const goneLabels = new Set(gone.map(sessionDayLabel));
    if (b.sessions) b.sessions = b.sessions.filter((s) => !goneLabels.has(s.split(" · ")[0]));
  }
  if (kids.length > 0 && kids.every((k) => k.cancelled)) b.status = "Cancelled";
}

export function buildBooking(input: CreateBookingInput, bid: number, refPrefix = "APF"): Booking {
  const haf = input.method.indexOf("HAF") > -1;
  return {
    // When it was taken. Nothing recorded this before, so "newest first" had
    // to be inferred from the ref number — which works, but can't answer
    // "what came in this week".
    createdAt: new Date().toISOString(),
    ref: refPrefix + "-" + bid,
    bid: "03073" + bid,
    booker: input.booker,
    email: input.email,
    phone: input.phone?.trim() ?? "",
    child: input.child || "—",
    age: input.age || 0,
    dob: "—",
    listing: input.listing,
    pass: input.pass,
    ticket: `${input.pass} · ${input.dates}`,
    dates: input.dates,
    sessions: [input.dates],
    status: "Confirmed",
    pay: haf ? "Funded" : "Invoice sent",
    method: haf ? "HAF" : input.method,
    amount: haf ? 0 : input.amount || 0,
    addons: [],
    answers: [],
    note: "Payment link sent to the parent — awaiting payment.",
    recon: input.method === "Tax-Free Childcare" ? false : null,
    evid: haf ? "Awaiting" : null,
    cancel: null,
  };
}
