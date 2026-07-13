// Pure booking mutations — the single source of truth for booking business
// rules. Imported by BOTH the client store (features/bookings/store.ts) and
// the Express API (server/src/routes/bookings.ts), so the two can never
// drift. No React/zustand/Firebase imports allowed here.

import type { Booking } from "./types";
import { bookingKids, kidActiveDays, nowStr, refundedTotal } from "./helpers";

export type RowAction =
  | "approve"
  | "decline"
  | "paid"
  | "recon"
  | "promote"
  | "refund-approve"
  | "refund-decline";

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

export function applyRowAction(b: Booking, action: RowAction): void {
  if (action === "approve") b.status = "Confirmed";
  else if (action === "decline") b.status = "Declined";
  else if (action === "paid") b.pay = "Paid";
  else if (action === "recon") b.recon = !b.recon;
  else if (action === "promote") {
    b.status = "Confirmed";
    b.note = "Promoted from waitlist.";
  } else if (action === "refund-approve") {
    if (b.cancel) b.cancel.refund = "approved";
    b.pay = "Refunded";
  } else if (action === "refund-decline") {
    if (b.cancel) b.cancel.refund = "declined";
  }
}

export function applyBulkAction(b: Booking, action: BulkAction): void {
  if (action === "approve") b.status = "Confirmed";
  else if (action === "decline") b.status = "Declined";
  else if (action === "waitlist") b.status = "Waitlisted";
  else if (action === "cancel") b.status = "Cancelled";
}

export function applyCancel(b: Booking, refund: RefundType, partialAmount?: number): void {
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
export function applyParentCancel(b: Booking, msg?: string): void {
  b.status = "Cancelled";
  b.cancel = {
    on: nowStr(),
    by: "Booker",
    refund: "pending",
    msg: msg || "Cancelled by the parent.",
  };
}

export function buildBooking(input: CreateBookingInput, bid: number): Booking {
  const haf = input.method.indexOf("HAF") > -1;
  return {
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
