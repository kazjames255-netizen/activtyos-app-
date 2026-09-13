import { Router } from "express";
import { db } from "../firebase";
import { operatorScope, managerScope } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { ukToday } from "../lib/ukDate";
import { realPhone, refundableSoFar } from "../../../features/bookings/helpers";

// ─────────────────────────────────────────────────────────────────────────
// Reconciliation — "the admin job providers dread most" (the doc). What money
// is owed, from whom, by which route, and what's overdue. Card is auto (via
// Stripe); Tax-Free Childcare, vouchers, bank transfer and cash all land
// off-platform on their own timetable, so they're matched by hand here.
//
// This view reads bookings; the marking-received write lives on the bookings
// route (POST /:ref/record-payment) so it shares the payment-record trail.
// ─────────────────────────────────────────────────────────────────────────

export const reconciliation = Router();

// A booking still owes money when it holds a place, isn't cancelled, and
// hasn't been fully paid or written off as funded/refunded.
const OWES = new Set(["Unpaid", "Invoice sent", "Awaiting voucher payment", "Partially paid"]);
const outstandingOf = (b: Booking) => Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0));
// Reconciled = the money is in and fully accounted for.
const isReconciled = (b: Booking) => (b.pay === "Paid" || b.pay === "Funded") && outstandingOf(b) <= 0;
// Card settles automatically through Stripe — it isn't reconciled here (a failed
// card is handled in the booking area instead), so it's kept off this ledger.
const isCardMethod = (b: Booking) => /card/i.test(b.method || "") && !b.voucherScheme;
// Payable off-platform bookings worth showing on the reconciliation ledger.
// Waitlisted / offered / approval-needed bookings have no place yet, so nothing
// is owed on them — counting them inflated "outstanding" with money for places
// that don't exist. Kept identical to isUnreconciled() in
// features/bookings/helpers.ts, which powers the Bookings "Unreconciled" tab.
const NO_PLACE_YET = ["Waitlisted", "Offered", "Approval needed"];
const relevant = (b: Booking) => b.status !== "Cancelled" && b.status !== "Declined" && !NO_PLACE_YET.includes(b.status) && !isCardMethod(b) && ((b.amount ?? 0) > 0 || b.pay === "Funded" || !!b.voucherScheme);
// Money that needs handing back or crediting (acceptance d8s7/d8s8):
//  • overpaid — more logged than the booking costs (live bookings);
//  • needsRefund — logged AFTER the booking was cancelled/declined, not yet
//    refunded. It used to vanish: cancelled bookings drop off the ledger.
// Both stay on the ledger (unreconciled) until someone deals with them.
const overpaidOf = (b: Booking) => round2(Math.max(0, (b.amountPaid ?? 0) - (b.amount ?? 0)));
const cancelledish = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
const needsRefundOf = (b: Booking) => (cancelledish(b) && (b.receivedAfterCancel ?? 0) > 0 ? round2(Math.min(b.receivedAfterCancel ?? 0, refundableSoFar(b))) : 0);
// The booking's date for the date-range filter — first session day, else booked date.
const dateOf = (b: Booking) => b.days?.[0] || (b.createdAt ?? "").slice(0, 10) || "";

// ── Refunds ──────────────────────────────────────────────────────────────
// Every refund on the bookings list, dated, so a day's refunds can be totalled
// against it (acceptance d9s7 — this route used to return none at all, and
// refunded bookings drop out of `items` because they're cancelled). Read from
// the booking itself — refundedApproved + refundLog, the same figures the
// bookings list shows — so the two agree by construction, whichever way the
// money went back (card, wallet credit, or offline).
// Refund dates come in two shapes: ISO, or the en-GB "13/09/2026, 10:30"
// that nowStr() writes. Anything else is left undated rather than guessed.
function refundDay(v?: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) { const t = new Date(v); return Number.isNaN(t.getTime()) ? null : ukToday(t); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
type RefundRow = {
  ref: string; booker: string; listing: string; listingId: string | null; method: string;
  /** Where the money went: "card", "wallet", "offline" (paid back by hand), or
   *  null when the booking doesn't say (a provider-recorded day refund). */
  via: "card" | "wallet" | "offline" | null;
  kind: "cancellation" | "released";
  label: string; amount: number; date: string | null;
};
function refundsOf(b: Booking): RefundRow[] {
  const base = { ref: b.ref, booker: b.booker, listing: b.listing, listingId: b.listingId ?? null, method: b.voucherScheme ? `Voucher · ${b.voucherScheme}` : b.method };
  const out: RefundRow[] = [];
  // An APPROVED cancellation refund — refundedApproved is what actually moved
  // (older bookings predate it: fall back to the approved cancel amount).
  const c = b.cancel;
  const approved = b.refundedApproved ?? (c?.refund === "approved" ? c.amount ?? 0 : 0);
  if (approved > 0) out.push({ ...base, via: c?.refundVia ?? null, kind: "cancellation", label: c?.refundOnly ? "Refund" : "Cancellation refund", amount: round2(approved), date: refundDay(c?.refundedAt) ?? refundDay(c?.on) });
  // Released days / children — each logged with its own date.
  for (const e of b.refundLog ?? []) {
    if (!(e.amount > 0)) continue;
    out.push({ ...base, via: /wallet/i.test(`${e.source ?? ""} ${e.label ?? ""}`) ? "wallet" : null, kind: "released", label: e.label || "Refund", amount: round2(e.amount), date: refundDay(e.on) });
  }
  return out;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/reconciliation — the full payment ledger (reconciled + awaiting) with
// per-booking fields so the client can filter by method, status, date, season & listing.
reconciliation.get("/", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;

  let q = db.collection("bookings") as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (t) q = q.where("tenantId", "==", t);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
    if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId) q = q.where("franchiseId", "==", scope.franchiseId);
  }
  const snap = await q.get();
  const today = ukToday();

  const items = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => relevant(b) || needsRefundOf(b) > 0)
    .map((b) => ({
      ref: b.ref,
      booker: b.booker,
      email: b.email,
      listing: b.listing,
      listingId: b.listingId ?? null,
      child: b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child,
      method: b.method,
      pay: b.pay,
      amount: b.amount ?? 0,
      amountPaid: b.amountPaid ?? 0,
      outstanding: cancelledish(b) ? 0 : outstandingOf(b),
      reconciled: !cancelledish(b) && isReconciled(b) && overpaidOf(b) <= 0,
      status: b.status,
      overpaid: cancelledish(b) ? 0 : overpaidOf(b),
      needsRefund: needsRefundOf(b),
      reconciledBy: b.reconciledBy ?? null,
      voucherScheme: b.voucherScheme ?? null,
      voucherReceiveBy: b.voucherReceiveBy ?? null,
      paymentRef: b.paymentRef ?? null,
      payRefs: b.payRefs ?? null,
      cardPaid: b.cardPaid ?? 0,
      reconNotes: b.reconNotes ?? [],
      nudges: b.nudges ?? 0,
      lastNudgedAt: b.lastNudgedAt ?? null,
      dates: b.dates ?? "",
      sessions: b.sessions ?? [],
      phone: realPhone(b.phone),
      date: dateOf(b),
      createdAt: b.createdAt ?? null,
      // A voucher whose money should have arrived by now — the provider needs
      // to chase or accept. (Flag only; nothing auto-cancels — §Q.)
      overdue: b.pay === "Awaiting voucher payment" && !!b.voucherReceiveBy && b.voucherReceiveBy < today,
    }))
    // Awaiting first (overdue at the very top), then most-recent.
    .sort((a, b) => {
      if (a.reconciled !== b.reconciled) return a.reconciled ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

  // Refunds across EVERY booking in scope — cancelled ones included.
  const refunds = snap.docs
    .flatMap((d) => refundsOf(fromDoc(d.data() as BookingDoc)))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const refundsToday = refunds.filter((r) => r.date === today);
  const byVia: Record<string, { count: number; amount: number }> = {};
  for (const r of refunds) {
    const v = (byVia[r.via ?? "recorded"] ??= { count: 0, amount: 0 });
    v.count += 1;
    v.amount = round2(v.amount + r.amount);
  }

  const awaiting = items.filter((i) => !i.reconciled && i.outstanding > 0);
  const byMethod: Record<string, { count: number; outstanding: number }> = {};
  for (const it of awaiting) {
    const key = it.voucherScheme ? `Voucher · ${it.voucherScheme}` : it.method || "Other";
    const m = (byMethod[key] ??= { count: 0, outstanding: 0 });
    m.count += 1;
    m.outstanding = Math.round((m.outstanding + it.outstanding) * 100) / 100;
  }
  res.json({
    items,
    refunds,
    summary: {
      count: awaiting.length,
      reconciledCount: items.filter((i) => i.reconciled).length,
      outstanding: Math.round(awaiting.reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
      overdue: items.filter((i) => i.overdue).length,
      awaitingVoucher: items.filter((i) => i.pay === "Awaiting voucher payment").length,
      byMethod,
      overpaid: { count: items.filter((i) => i.overpaid > 0).length, total: round2(items.reduce((s, i) => s + i.overpaid, 0)) },
      needsRefund: { count: items.filter((i) => i.needsRefund > 0).length, total: round2(items.reduce((s, i) => s + i.needsRefund, 0)) },
      refunds: {
        count: refunds.length,
        total: round2(refunds.reduce((s, r) => s + r.amount, 0)),
        todayCount: refundsToday.length,
        today: round2(refundsToday.reduce((s, r) => s + r.amount, 0)),
        byVia,
      },
    },
  });
});
