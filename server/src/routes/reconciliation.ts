import { Router } from "express";
import { db } from "../firebase";
import { managerScope, canWrite, type Role } from "../middleware/role";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { ukToday } from "../lib/ukDate";
import { realPhone, refundableSoFar } from "../../../features/bookings/helpers";
import { bookingDocId } from "./bookings";
import {
  childcareOf, childcareRoute, isChildcare, isUnreconciled, loadChildcareSettings,
  childcareSettingsComplete, paymentRecordsOf, referenceProblem, looksLikeTfcRef,
  type ChildcareBooking, type ChildcarePayment,
} from "../lib/childcare";

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

type Scope = { role: string; tenantId: string | null; franchiseId: string | null };

// The bookings this account may see: its own tenant, narrowed to its own
// franchise for a franchise/staff token (the franchise lens every neighbouring
// route applies). Platform sees everything unless it names a tenant.
function scopedBookings(req: { query: Record<string, unknown> }, scope: Scope): FirebaseFirestore.Query {
  let q = db.collection("bookings") as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (t) q = q.where("tenantId", "==", t);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
    if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId) q = q.where("franchiseId", "==", scope.franchiseId);
  }
  return q;
}

// GET /api/reconciliation — the full payment ledger (reconciled + awaiting) with
// per-booking fields so the client can filter by method, status, date, season & listing.
reconciliation.get("/", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;

  const snap = await scopedBookings(req, scope).get();
  const today = ukToday();

  const items = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc) as ChildcareBooking)
    .filter((b) => relevant(b) || needsRefundOf(b) > 0)
    .map((b) => {
      // Childcare bookings carry the spec's block as well as the flat fields
      // (docs/tfc-build-spec.md). Additive — every existing field below is
      // untouched, so nothing reading this response has to change.
      const cc = isChildcare(b) ? childcareOf(b) : null;
      return {
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
      // ── Childcare (Part B) ────────────────────────────────────────────
      // `childcareRoute` is null on everything else, so a client can build the
      // "Unreconciled childcare" filter without re-deriving the rule from
      // method strings. `bankMatched` is OUR statement tick — deliberately
      // separate from `reconciled` above, which is the pay-state.
      childcareRoute: cc?.route ?? null,
      childcare: cc,
      bankMatched: cc?.reconciled ?? false,
      referenceProblem: cc ? referenceProblem(b) : null,
      };
    })
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
      // The headline childcare figures for the ledger page, unfiltered. The
      // date-ranged version (with the gross series) is GET /childcare below.
      // Cancelled bookings only appear in `items` when money is stuck on them
      // (needsRefund) — that's a refund to make, not childcare still to collect.
      childcare: rollUp(items.filter((i) => i.childcareRoute && i.status !== "Cancelled" && i.status !== "Declined")),
    },
  });
});

// ── Childcare analytics + the tick-off table (spec §B3/§B4) ──────────────
// Four figures over a date range, on TWO axes that must not be merged:
//   confirmed / unconfirmed   — the booker's promise (has money come in?)
//   reconciled / unreconciled — our bank match (has a human ticked it off?)
// plus the gross-bookings series behind the line chart. Computed here rather
// than in the browser so the date range actually applies to the figures (the
// client roll-up totals the whole ledger, whatever range is on screen) and so
// the numbers can't drift between the ledger, Bookings and any future export.
type Rolled = { amount: number; count: number; bookers: number };
type LedgerRow = { email?: string; booker: string; ref: string; amount: number; amountPaid: number; outstanding: number; bankMatched: boolean; referenceProblem: string | null };

function rollUp(rows: LedgerRow[]) {
  const bookers = (l: LedgerRow[]) => new Set(l.map((i) => (i.email || i.booker || i.ref).trim().toLowerCase())).size;
  const roll = (l: LedgerRow[], amount: number): Rolled => ({ amount: round2(amount), count: l.length, bookers: bookers(l) });
  const paid = rows.filter((i) => i.amountPaid > 0);
  const unpaid = rows.filter((i) => i.outstanding > 0);
  const matched = rows.filter((i) => i.bankMatched);
  const unmatched = rows.filter((i) => !i.bankMatched);
  return {
    gross: round2(rows.reduce((s, i) => s + i.amount, 0)),
    bookings: rows.length,
    // The booker's side.
    confirmed: roll(paid, paid.reduce((s, i) => s + i.amountPaid, 0)),
    unconfirmed: roll(unpaid, unpaid.reduce((s, i) => s + i.outstanding, 0)),
    // Our side.
    reconciled: roll(matched, matched.reduce((s, i) => s + i.amountPaid, 0)),
    unreconciled: roll(unmatched, unmatched.reduce((s, i) => s + (i.outstanding || i.amount), 0)),
    // Never a filter, only a flag: a parent who typed "Caelan" instead of a
    // reference still has a real booking and real money (§B3 note).
    missingReference: rows.filter((i) => i.referenceProblem === "missing").length,
    malformedReference: rows.filter((i) => i.referenceProblem === "malformed").length,
  };
}

// GET /api/reconciliation/childcare?from&to&route&scheme[&tenantId]
//   from/to — inclusive ISO days, on the booking's date (first session day,
//             else the day it was booked) — the same `date` the ledger filters.
//   route   — "Tax-Free Childcare" | "Childcare vouchers" (omit for both).
//   scheme  — one voucher company, e.g. "Edenred".
reconciliation.get("/childcare", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId ?? (typeof req.query.tenantId === "string" ? req.query.tenantId : null);
  const str = (k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string).trim() : "");
  const from = str("from");
  const to = str("to");
  const route = str("route");
  const scheme = str("scheme");

  const snap = await scopedBookings(req, scope).get();
  const bookings = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc) as ChildcareBooking)
    // The same population the ledger counts: a waitlisted / offered /
    // approval-needed booking has no place yet, so nothing is promised and
    // nothing is owed. Counting them would make "gross childcare bookings"
    // disagree with the ledger sitting underneath it.
    .filter((b) => isChildcare(b) && !cancelledish(b) && !NO_PLACE_YET.includes(b.status))
    .filter((b) => {
      const d = dateOf(b);
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      if (route && childcareRoute(b) !== route) return false;
      if (scheme && (childcareOf(b).scheme ?? "") !== scheme) return false;
      return true;
    });

  // The tick-off table, in the spec's column order.
  const rows = bookings.map((b) => {
    const cc = childcareOf(b);
    return {
      ref: b.ref,                                   // Booking ID
      bid: b.bid,
      date: dateOf(b),                              // Booking date
      bookedOn: (b.createdAt ?? "").slice(0, 10) || null,
      learner: b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child,  // Learner name
      booker: b.booker,
      email: b.email,
      listing: b.listing,
      listingId: b.listingId ?? null,
      route: cc.route,
      scheme: cc.scheme,                            // Childcare scheme
      reference: cc.reference,                      // Childcare reference (may be junk — shown, never keyed on)
      referenceLooksValid: cc.route === "Tax-Free Childcare" ? looksLikeTfcRef(cc.reference) : !!(cc.reference ?? "").trim(),
      referenceProblem: referenceProblem(b),
      amount: b.amount ?? 0,                        // Childcare payment (booking total)
      childcareAmount: cc.amount ?? 0,              // …less anything taken by card at checkout
      amountPaid: b.amountPaid ?? 0,
      cardPaid: b.cardPaid ?? 0,
      outstanding: round2(Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0))),
      // A booking can hold more than one payment record: a reference per
      // sibling, plus the card/bank remainder of a split (Part A, Step 4).
      payments: paymentRecordsOf(b),
      pay: b.pay,
      status: b.status,
      // The booker's promise…
      confirmed: cc.confirmed,
      promisedAt: cc.promisedAt,
      confirmedAt: cc.confirmedAt,
      // …and our bank match. Different question, own column (§B3 last column).
      bankMatched: cc.reconciled,                   // Reconciled against bank statement ☐/☑
      reconciledAt: cc.reconciledAt,
      reconciledBy: cc.reconciledBy,
      unreconciled: isUnreconciled(b),
      reconNotes: b.reconNotes ?? [],
    };
  }).sort((a, b) => (a.bankMatched !== b.bankMatched ? (a.bankMatched ? 1 : -1) : (b.date || "").localeCompare(a.date || "")));

  // Gross childcare bookings per day, for the line chart. Dense enough to plot
  // as-is: only days with bookings, ascending.
  const byDay = new Map<string, { gross: number; bookings: number }>();
  for (const r of rows) {
    if (!r.date) continue;
    const d = byDay.get(r.date) ?? { gross: 0, bookings: 0 };
    d.gross = round2(d.gross + r.amount);
    d.bookings += 1;
    byDay.set(r.date, d);
  }
  const series = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));

  // By scheme — which voucher company is slowest to pay.
  const byScheme: Record<string, { count: number; gross: number; outstanding: number; unmatched: number }> = {};
  for (const r of rows) {
    const k = r.scheme || r.route || "Childcare";
    const s = (byScheme[k] ??= { count: 0, gross: 0, outstanding: 0, unmatched: 0 });
    s.count += 1;
    s.gross = round2(s.gross + r.amount);
    s.outstanding = round2(s.outstanding + r.outstanding);
    if (!r.bankMatched) s.unmatched += 1;
  }

  const settings = tenantId ? await loadChildcareSettings(tenantId, scope.franchiseId) : null;
  res.json({
    range: { from: from || null, to: to || null, route: route || null, scheme: scheme || null },
    // What a parent must add in their HMRC account before they can pay us.
    settings,
    settingsComplete: settings ? childcareSettingsComplete(settings) : false,
    rows,
    series,
    byScheme,
    summary: rollUp(rows),
  });
});

// POST /api/reconciliation/:ref/bank-match — the manual tick from §B3's last
// column: "reconciled against bank statement". `{ matched: false }` unticks it.
//
// This is NOT the same action as POST /api/bookings/:ref/reconcile. That one
// says "the money is in" and settles the booking (Paid, family emailed). This
// one says "I have found the line on my bank statement", which is the operator
// confirming OUR end of the match — it moves no money and tells the family
// nothing, so an accidental tick is harmless and reversible.
//
// It deliberately takes an OPTIONAL statement reference and matches on nothing:
// the parent's own reference may be junk ("Caelan" in the spec's own table), so
// keying the tick on it would make exactly the rows that need a human
// impossible to tick. A note is stored instead, for whoever asks later.
reconciliation.post("/:ref/bank-match", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  if (!canWrite(scope.role as Role)) {
    res.status(403).json({ error: "Your account is read-only for bookings" });
    return;
  }
  const tenantId = scope.tenantId ?? (typeof req.query.tenantId === "string" ? req.query.tenantId : null);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId required for platform accounts" });
    return;
  }
  const body = (req.body ?? {}) as { matched?: unknown; statementRef?: unknown; note?: unknown };
  const matched = body.matched === undefined ? true : body.matched === true;
  const statementRef = typeof body.statementRef === "string" ? body.statementRef.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const who = req.user?.name ?? req.user?.email ?? "operator";
  const at = new Date().toISOString();

  // Same lookup as the bookings route: the tenant-prefixed doc id, falling back
  // to a query for bookings written before that id scheme.
  const byId = db.collection("bookings").doc(bookingDocId(tenantId, req.params.ref));
  let ref = byId;
  if (!(await byId.get()).exists) {
    const q = await db.collection("bookings").where("tenantId", "==", tenantId).where("ref", "==", req.params.ref).limit(1).get();
    if (!q.empty) ref = q.docs[0].ref;
  }
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc) as ChildcareBooking;
      if (b.tenantId !== tenantId) throw new NotFound();
      // The franchise lens: a franchise may only tick off its own bookings.
      if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId && b.franchiseId !== scope.franchiseId) throw new NotFound();
      if (!isChildcare(b)) throw new NotChildcare();
      const prev = (b.childcare && typeof b.childcare === "object" ? b.childcare : {}) as ChildcarePayment;
      const cc = childcareOf(b);
      const next: ChildcarePayment = {
        // Persist what was only derived until now, so the block stops depending
        // on the flat fields once it has been touched.
        scheme: prev.scheme ?? cc.scheme ?? null,
        reference: prev.reference ?? cc.reference ?? null,
        amount: prev.amount ?? cc.amount ?? null,
        promisedAt: prev.promisedAt ?? cc.promisedAt ?? null,
        confirmedAt: prev.confirmedAt ?? null,
        reconciledAt: matched ? at : null,
        reconciledBy: matched ? { at, by: who, auto: false } : null,
      };
      b.childcare = next;
      // A running, attributed trail — the same provider-only notes the ledger
      // already shows, so an untick isn't a silent erasure.
      const line = matched
        ? `Ticked off against the bank statement${statementRef ? ` (bank ref ${statementRef})` : ""}.${note ? ` ${note}` : ""}`
        : `Bank-statement tick removed.${note ? ` ${note}` : ""}`;
      b.reconNotes = [...(b.reconNotes ?? []), { at, by: who, text: line }];
      tx.set(ref, toDoc(b));
      return b;
    });
    res.json({ ref: updated.ref, childcare: updated.childcare ?? null, bankMatched: matched, reconNotes: updated.reconNotes ?? [] });
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else if (e instanceof NotChildcare) res.status(400).json({ error: "This booking isn't paid by a childcare scheme — reconcile it from the payment ledger instead." });
    else throw e;
  }
});

class NotFound extends Error {}
class NotChildcare extends Error {}
