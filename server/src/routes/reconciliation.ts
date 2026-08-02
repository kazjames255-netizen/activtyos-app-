import { Router } from "express";
import { db } from "../firebase";
import { operatorScope } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";

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
const relevant = (b: Booking) => b.status !== "Cancelled" && b.status !== "Declined" && !isCardMethod(b) && ((b.amount ?? 0) > 0 || b.pay === "Funded" || !!b.voucherScheme);
// The booking's date for the date-range filter — first session day, else booked date.
const dateOf = (b: Booking) => b.days?.[0] || (b.createdAt ?? "").slice(0, 10) || "";

// GET /api/reconciliation — the full payment ledger (reconciled + awaiting) with
// per-booking fields so the client can filter by method, status, date, season & listing.
reconciliation.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;

  let q = db.collection("bookings") as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (t) q = q.where("tenantId", "==", t);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
    if (scope.role === "franchise") q = q.where("franchiseId", "==", scope.franchiseId);
  }
  const snap = await q.get();
  const today = new Date().toISOString().slice(0, 10);

  const items = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter(relevant)
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
      outstanding: outstandingOf(b),
      reconciled: isReconciled(b),
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
      phone: b.phone ?? "",
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
    summary: {
      count: awaiting.length,
      reconciledCount: items.filter((i) => i.reconciled).length,
      outstanding: Math.round(awaiting.reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
      overdue: items.filter((i) => i.overdue).length,
      awaitingVoucher: items.filter((i) => i.pay === "Awaiting voucher payment").length,
      byMethod,
    },
  });
});
