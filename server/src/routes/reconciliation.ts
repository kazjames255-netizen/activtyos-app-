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

// GET /api/reconciliation — the outstanding-money picture + a summary.
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
    .filter((b) => OWES.has(b.pay) && outstandingOf(b) > 0 && b.status !== "Cancelled" && b.status !== "Declined")
    .map((b) => ({
      ref: b.ref,
      booker: b.booker,
      email: b.email,
      listing: b.listing,
      child: b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child,
      method: b.method,
      pay: b.pay,
      amount: b.amount ?? 0,
      amountPaid: b.amountPaid ?? 0,
      outstanding: outstandingOf(b),
      voucherScheme: b.voucherScheme ?? null,
      voucherReceiveBy: b.voucherReceiveBy ?? null,
      // A voucher whose money should have arrived by now — the provider needs
      // to chase or accept. (Flag only; nothing auto-cancels — §Q.)
      overdue: b.pay === "Awaiting voucher payment" && !!b.voucherReceiveBy && b.voucherReceiveBy < today,
    }))
    .sort((a, b) => (a.overdue === b.overdue ? (a.ref < b.ref ? 1 : -1) : a.overdue ? -1 : 1));

  const byMethod: Record<string, { count: number; outstanding: number }> = {};
  for (const it of items) {
    const key = it.voucherScheme ? `Voucher · ${it.voucherScheme}` : it.method || "Other";
    const m = (byMethod[key] ??= { count: 0, outstanding: 0 });
    m.count += 1;
    m.outstanding = Math.round((m.outstanding + it.outstanding) * 100) / 100;
  }
  res.json({
    items,
    summary: {
      count: items.length,
      outstanding: Math.round(items.reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
      overdue: items.filter((i) => i.overdue).length,
      awaitingVoucher: items.filter((i) => i.pay === "Awaiting voucher payment").length,
      byMethod,
    },
  });
});
