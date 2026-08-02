// Pure booking mutations — the single source of truth for booking business
// rules. Imported by BOTH the client store (features/bookings/store.ts) and
// the Express API (server/src/routes/bookings.ts), so the two can never
// drift. No React/zustand/Firebase imports allowed here.

import type { Booking } from "./types";
import { bookingKids, kidActiveDays, nowStr, refundedTotal, sessionDayLabel } from "./helpers";

export type RowAction =
  | "approve"
  | "decline"
  | "paid"
  | "recon"
  | "promote"
  | "refund-approve"
  | "refund-decline"
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
}

// Recompute a booking's derived status/pay after per-child/per-day refunds.
function applyCancelState(b: Booking) {
  const kids = bookingKids(b);
  const allCancelled = kids.length > 0 && kids.every((k) => k.cancelled);
  if (allCancelled) b.status = "Cancelled";
  const r = refundedTotal(b);
  if (r >= b.amount - 0.001) b.pay = "Refunded";
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
    if (b.cancel) b.cancel.refund = "approved";
    b.pay = "Refunded";
  } else if (action === "refund-decline") {
    if (b.cancel) b.cancel.refund = "declined";
  } else if (action === "move-approve") {
    const req = b.dateChangeRequest;
    if (req) {
      const swap = (arr?: string[]) => arr?.map((d) => req.moves.find((m) => m.from === d)?.to ?? d);
      for (const m of req.moves) {
        const kid = b.kids?.find((k) => (m.childId && k.childId === m.childId) || k.name === m.childName);
        if (kid && kid.dates?.length) kid.dates = swap(kid.dates)!;
        else b.days = swap(b.days);
      }
      req.status = "approved";
      b.note = "Date change approved.";
    }
  } else if (action === "move-deny") {
    if (b.dateChangeRequest) { b.dateChangeRequest.status = "denied"; b.note = "Date change declined."; }
  }
}

export function applyBulkAction(b: Booking, action: BulkAction): void {
  if (action === "approve") b.status = "Confirmed";
  else if (action === "decline") b.status = "Declined";
  else if (action === "waitlist") b.status = "Waitlisted";
  else if (action === "cancel") b.status = "Cancelled";
}

export function applyCancel(b: Booking, refund: RefundType, partialAmount?: number, reason?: string): void {
  let amt = refund === "full" ? b.amount : 0;
  if (refund === "partial") amt = partialAmount || 0;
  if (b.past !== true) b.status = "Cancelled";
  b.cancel = {
    on: nowStr(),
    by: "Provider",
    refund,
    amount: amt,
    refundOnly: b.past === true,
    msg: b.past === true ? "Refund issued by provider." : "Cancelled by provider.",
    ...(reason ? { reason } : {}),
  };
  b.pay = refund === "full" ? "Refunded" : refund === "partial" ? "Partially refunded" : b.pay;
}

export function applyCancelChild(b: Booking, ki: number): void {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (!k || k.cancelled) return;
  const share = b.amount / (kids.length || 1);
  const done = share * ((k.cancelledDays || []).length / ((k.dates || []).length || 1));
  const refund = Math.max(0, Math.round((share - done) * 100) / 100);
  k.cancelled = true;
  k.cancelledDays = (k.dates || []).slice();
  (b.refundLog = b.refundLog || []).push({
    label: `${k.name || "Child"} — whole place`,
    amount: refund,
    on: nowStr(),
    by: "Provider",
    source: "Provider",
  });
  // kids came from bookingKids which may be a synthesised single-child array;
  // persist it back onto the booking so state survives.
  if (!b.kids) b.kids = kids;
  applyCancelState(b);
}

export function applyCancelDay(b: Booking, ki: number, dt: string): void {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (!k || k.cancelled) return;
  k.cancelledDays = k.cancelledDays || [];
  if (k.cancelledDays.indexOf(dt) > -1) return;
  k.cancelledDays.push(dt);
  const perday =
    Math.round((b.amount / (kids.length || 1) / ((k.dates || []).length || 1)) * 100) / 100;
  (b.refundLog = b.refundLog || []).push({
    label: `${k.name || "Child"} — ${dt}`,
    amount: perday,
    on: nowStr(),
    by: "Provider",
    source: "Provider",
  });
  if (kidActiveDays(k).length === 0) k.cancelled = true;
  if (!b.kids) b.kids = kids;
  applyCancelState(b);
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
  b.cancel = {
    on: nowStr(),
    by: "Booker",
    refund: "pending",
    msg: msg || "Cancelled by the parent.",
    ...(reason ? { reason } : {}),
  };
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
  for (const r of releases) {
    const k = kids.find((x) => (x.childId ?? x.name) === r.childKey);
    if (!k) continue;
    k.cancelledDays = k.cancelledDays || [];
    for (const d of r.days) {
      if (k.cancelledDays.indexOf(d) > -1) continue;
      k.cancelledDays.push(d);
      released.add(d);
    }
    if (kidActiveDays(k).length === 0) k.cancelled = true;
  }
  b.kids = kids;
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

export function buildBooking(input: CreateBookingInput, bid: number): Booking {
  const haf = input.method.indexOf("HAF") > -1;
  return {
    // When it was taken. Nothing recorded this before, so "newest first" had
    // to be inferred from the ref number — which works, but can't answer
    // "what came in this week".
    createdAt: new Date().toISOString(),
    ref: "APF-" + bid,
    bid: "03073" + bid,
    booker: input.booker,
    email: input.email,
    phone: "—",
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
