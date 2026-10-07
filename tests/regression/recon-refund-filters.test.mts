// Reconciliation refund filters: the list, the "N shown" count, the method tab counts and the Refunds panel must always agree, for every
// combination of method tab x status chip x "Hide refunded". Pure: no database, no React.
import test from "node:test";
import assert from "node:assert/strict";
import { catCountsOf, filterItems, methodCat, parseFilterParams, refundPanelRows, withFilterParams, type FilterItem, type FilterRefundRow, type StatusFilter } from "../../features/reconciliation/refundFilters";
import { refundSummaryOf } from "../../server/src/lib/refundRows";

type It = FilterItem & { listingId: string | null };
const mk = (ref: string, over: Partial<It>): It => ({ ref, method: "Bank transfer", pay: "Paid", voucherScheme: null, reconciled: true, listingId: "L1", date: "2026-10-07", refundState: "none", refundedOnly: false, ...over });

const items: It[] = [
  mk("A-paid-bank", {}),                                                                                                   // bank, paid, reconciled
  mk("B-owes-bank", { pay: "Unpaid", reconciled: false }),                                                                // bank, still to match
  mk("C-card-refunded", { method: "card", pay: "Refunded", reconciled: false, refundState: "full", refundedOnly: true }),  // card, fully refunded, only on the list for the refund
  mk("D-bank-awaiting", { pay: "Refunded", reconciled: false, refundState: "awaiting", refundedOnly: true }),             // bank refund recorded, not yet transferred
  mk("E-bank-part", { refundState: "part" }),                                                                             // live bank booking with one day released
  mk("F-tfc", { method: "Tax-Free Childcare", pay: "Awaiting voucher payment", reconciled: false }),
];
const refunds: FilterRefundRow[] = [
  { ref: "C-card-refunded", method: "card", listingId: "L1", date: "2026-10-07", amount: 0.3 },
  { ref: "D-bank-awaiting", method: "Bank transfer", listingId: "L1", date: "2026-10-06", amount: 0.3 },
  { ref: "E-bank-part", method: "Bank transfer", listingId: "L1", date: "2026-10-05", amount: 0.1 },
];
const refs = (l: { ref: string }[]) => l.map((x) => x.ref).sort();

// An independent statement of the rules, written out by hand per combination (not by calling the code under test).
function expected(cat: string, status: StatusFilter, hide: boolean): string[] {
  return items
    .filter((it) => {
      const refunded = (it.refundState ?? "none") !== "none";
      if (hide && refunded) return false;
      if (cat !== "All" && methodCat(it) !== cat) return false;
      if (it.refundedOnly) return status === "all" || status === "refunded";
      if (status === "awaiting") return !it.reconciled;
      if (status === "reconciled") return it.reconciled;
      if (status === "refunded") return refunded;
      return true;
    })
    .map((it) => it.ref)
    .sort();
}

test("list: every tab x status x hide-refunded combination matches the rules", () => {
  for (const cat of ["All", "Bank transfer", "Card", "Tax-Free Childcare"]) {
    for (const status of ["all", "awaiting", "reconciled", "refunded"] as StatusFilter[]) {
      for (const hide of [false, true]) {
        const got = refs(filterItems(items, { cat, status, hideRefunded: hide }));
        assert.deepEqual(got, expected(cat, status, hide), `${cat} / ${status} / hide=${hide}`);
      }
    }
  }
});

test("Hide refunded removes every refunded row from the list, the tab counts and the panel together", () => {
  const o = { cat: "All", status: "all" as StatusFilter, hideRefunded: true };
  const list = filterItems(items, o);
  assert.ok(list.every((i) => (i.refundState ?? "none") === "none"));
  const counts = catCountsOf(items, "all", true);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), list.length);
  assert.deepEqual(refundPanelRows(refunds, items, o), []);
});

test("tab counts agree with the list for each tab (status All, hide off and on)", () => {
  for (const hide of [false, true]) {
    const counts = catCountsOf(items, "all", hide);
    for (const cat of ["Bank transfer", "Card", "Tax-Free Childcare"]) {
      assert.equal(counts.get(cat) ?? 0, filterItems(items, { cat, status: "all", hideRefunded: hide }).length, `${cat} hide=${hide}`);
    }
  }
});

test("a refunded-only booking is never counted as a payment to reconcile (Awaiting / Reconciled tab counts)", () => {
  for (const status of ["awaiting", "reconciled"] as StatusFilter[]) {
    const counts = catCountsOf(items, status, false);
    assert.equal(counts.get("Card") ?? 0, 0, `Card tab under ${status}`);
  }
  assert.equal(catCountsOf(items, "refunded", false).get("Card"), 1);
});

test("Refunds panel follows the tab: Bank transfer shows bank refunds only, Card shows card refunds only; totals add up", () => {
  const sum = (r: { amount: number }[]) => Math.round(r.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const bank = refundPanelRows(refunds, items, { cat: "Bank transfer", status: "all", hideRefunded: false });
  const card = refundPanelRows(refunds, items, { cat: "Card", status: "all", hideRefunded: false });
  const all = refundPanelRows(refunds, items, { cat: "All", status: "all", hideRefunded: false });
  assert.deepEqual(refs(bank), ["D-bank-awaiting", "E-bank-part"]);
  assert.deepEqual(refs(card), ["C-card-refunded"]);
  assert.equal(sum(all), sum(bank) + sum(card));
  // the status chips describe the payment ledger, so they do not hide the panel
  assert.equal(refundPanelRows(refunds, items, { cat: "All", status: "awaiting", hideRefunded: false }).length, 3);
});

test("Refunds panel follows listing and date filters", () => {
  assert.equal(refundPanelRows(refunds, items, { cat: "All", status: "all", hideRefunded: false, from: "2026-10-06" }).length, 2);
  assert.equal(refundPanelRows(refunds, items, { cat: "All", status: "all", hideRefunded: false, to: "2026-10-05" }).length, 1);
  assert.equal(refundPanelRows(refunds, items, { cat: "All", status: "all", hideRefunded: false, listingId: "L2" }).length, 0);
});

test("URL params: status and hideRefunded round-trip; defaults stay out of the URL", () => {
  assert.deepEqual(parseFilterParams("?status=refunded&hideRefunded=1"), { status: "refunded", hideRefunded: true });
  assert.deepEqual(parseFilterParams("?status=nonsense"), {});
  assert.equal(withFilterParams("", "awaiting", false), "");
  assert.equal(withFilterParams("?x=1", "refunded", true), "?x=1&status=refunded&hideRefunded=1");
  assert.equal(withFilterParams("?status=all&hideRefunded=1", "awaiting", false), "");
});

// ---- the server's per-booking refund position -------------------------------------------------------------------------------------------------
const bk = (o: Record<string, unknown>) => ({ ref: "X", booker: "K", listing: "L", listingId: "L1", method: "Bank transfer", pay: "Paid", amount: 0.3, amountPaid: 0.3, status: "Cancelled", ...o }) as never;

test("refundSummaryOf: card refund sent = full; offline refund not yet transferred = awaiting; offline marked sent = full; part", () => {
  assert.equal(refundSummaryOf(bk({ method: "card", pay: "Refunded", refundedApproved: 0.3, cancel: { on: "", by: "", refund: "approved", amount: 0.3, refundVia: "card", refundedAt: "2026-10-07" } })).state, "full");
  const awaiting = refundSummaryOf(bk({ pay: "Refunded", refundedApproved: 0.3, cancel: { on: "", by: "", refund: "approved", amount: 0.3, refundVia: "offline", refundedAt: "2026-10-06" } }));
  assert.equal(awaiting.state, "awaiting");
  assert.equal(awaiting.awaitingAmount, 0.3);
  const sent = refundSummaryOf(bk({ pay: "Refunded", refundedApproved: 0.3, cancel: { on: "", by: "", refund: "approved", amount: 0.3, refundVia: "offline", refundedAt: "2026-10-06", refundSentAt: "2026-10-08" } }));
  assert.equal(sent.state, "full");
  assert.equal(sent.awaitingAmount, 0);
  const part = refundSummaryOf(bk({ status: "Confirmed", pay: "Partially refunded", amount: 0.6, amountPaid: 0.6, refundLog: [{ label: "Day released", amount: 0.3, on: "2026-10-05", by: "Provider", source: "Card" }] }));
  assert.equal(part.state, "part");
  assert.equal(part.amount, 0.3);
  assert.equal(refundSummaryOf(bk({ pay: "Paid" })).state, "none");
});
