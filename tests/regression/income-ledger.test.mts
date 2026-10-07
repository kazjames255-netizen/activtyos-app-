import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLedger, bookingMoney, matchesShow, sumRows } from "../../features/money/incomeRows";
import { bookingNetIn, isStandaloneInvoiceIn } from "../../features/money/bookingIncome";

// Booking helpers: only the fields the money rules read.
const bk = (o: Record<string, unknown>) => ({ ref: "APF-1", status: "Confirmed", pay: "Paid", method: "card", amount: 0.3, amountPaid: 0.3, createdAt: "2026-10-06T10:00:00Z", booker: "Kaz", listing: "Camp", ...o }) as never;

const paid = bk({ ref: "APF-10", amount: 0.6, amountPaid: 0.6 });
const refundedCard = bk({ ref: "APF-11", status: "Cancelled", pay: "Refunded", cancel: { refund: "approved", amount: 0.3, refundVia: "card", on: "", by: "p" }, refundLog: [{ label: "Refund approved", amount: 0.3, on: "07/10/2026, 12:00", by: "Provider", source: "Card" }] });
const partRefunded = bk({ ref: "APF-12", amount: 1, amountPaid: 1, pay: "Partially refunded", refundLog: [{ label: "Day released", amount: 0.4, on: "2026-10-08", by: "Provider", source: "Card" }] });
const bankRefunded = bk({ ref: "APF-13", method: "bank", status: "Cancelled", pay: "Refunded", cancel: { refund: "approved", amount: 0.3, refundVia: "offline", on: "", by: "p" }, refundLog: [{ label: "Refund approved", amount: 0.3, on: "07/10/2026, 12:00", by: "Provider", source: "Offline" }] });
const unpaid = bk({ ref: "APF-14", pay: "Unpaid", amountPaid: 0 });
const invoices = [{ id: "i1", status: "paid", amount: 5, paidAt: "2026-10-07" }, { id: "i2", status: "paid", amount: 9, paidAt: "2026-10-07", bookingSettledAt: "2026-10-07" }, { id: "i3", status: "sent", amount: 7 }];
const logged = [{ id: "l1", date: "2026-10-01", category: "Grants", amount: 2.5 }];

test("a fully refunded booking is listed (net 0) so the list explains the refunded figure", () => {
  const rows = buildLedger({ bookings: [paid, refundedCard, partRefunded, bankRefunded, unpaid], invoices, logged });
  const ids = rows.map((r) => r.id);
  assert.ok(ids.includes("bk-APF-11") && ids.includes("bk-APF-13") && ids.includes("bk-APF-12"));
  assert.ok(!ids.includes("bk-APF-14"), "a booking that received nothing is not income");
  assert.ok(!ids.includes("inv-i2") && !ids.includes("inv-i3"), "settled-a-booking and unpaid invoices are not standalone income");
  const full = rows.find((r) => r.id === "bk-APF-11")!;
  assert.equal(full.amount, 0); assert.equal(full.received, 0.3); assert.equal(full.refunded, 0.3);
  assert.equal(full.money?.state, "full"); assert.equal(full.money?.refundedOn, "2026-10-07");
});

test("tiles == sum of rows for All: net, received and refunded all agree with the Money in maths", () => {
  const rows = buildLedger({ bookings: [paid, refundedCard, partRefunded, bankRefunded, unpaid], invoices, logged });
  const t = sumRows(rows);
  const bks = [paid, refundedCard, partRefunded, bankRefunded, unpaid].map((b) => bookingNetIn(b)).filter((x) => x.got > 0);
  const expectNet = Math.round((bks.reduce((s, x) => s + x.net, 0) + invoices.filter(isStandaloneInvoiceIn).reduce((s, v) => s + v.amount, 0) + 2.5) * 100) / 100;
  const expectBack = Math.round(bks.reduce((s, x) => s + x.back, 0) * 100) / 100;
  assert.equal(t.net, expectNet);
  assert.equal(t.refunded, expectBack);
  assert.equal(Math.round((t.net + t.refunded) * 100) / 100, t.received, "received = net + refunded");
});

test("states and the Show filter", () => {
  assert.equal(bookingMoney(paid)?.state, "none");
  assert.equal(bookingMoney(partRefunded)?.state, "part");
  assert.equal(bookingMoney(refundedCard)?.state, "full");
  assert.equal(bookingMoney(bankRefunded)?.state, "awaiting", "a recorded bank refund is awaiting your transfer");
  assert.equal(bookingMoney(bk({ ref: "APF-15", cancel: { refund: "approved", amount: 0.3, refundVia: "offline", refundSentAt: "2026-10-08T10:00:00Z", on: "", by: "p" }, pay: "Refunded", refundLog: [{ label: "Refund approved", amount: 0.3, on: "2026-10-08", by: "p", source: "Offline" }] }))?.state, "full", "once the provider says it was sent it is just refunded");
  assert.equal(bookingMoney(unpaid), null);
  const rows = buildLedger({ bookings: [paid, refundedCard, partRefunded, bankRefunded], invoices, logged });
  const pick = (s: "all" | "received" | "refunded" | "awaiting") => rows.filter((r) => matchesShow(r, s)).map((r) => r.id).sort();
  assert.deepEqual(pick("all").length, rows.length);
  assert.deepEqual(pick("refunded"), ["bk-APF-11", "bk-APF-12", "bk-APF-13"]);
  assert.deepEqual(pick("awaiting"), ["bk-APF-13"]);
  assert.ok(!pick("received").includes("bk-APF-11") && pick("received").includes("bk-APF-12") && pick("received").includes("inv-i1") && pick("received").includes("l1"));
});
