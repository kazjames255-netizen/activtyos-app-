import test from "node:test";
import assert from "node:assert/strict";
import { buildAwaiting, paymentRequestOut, reminderCount, type AwaitingBookingIn, type AwaitingInvoice } from "../../features/money/awaitingPayment";
import { owedNow } from "../../features/bookings/helpers";

// Money in -> 'Awaiting payment': sent invoices + bookings with a payment request out, one total, and an empty state that never claims
// 'all paid up' while Finance's 'Owed to you' (the owedNow rule) is above zero. Kaz saw '£0.00 · You're all paid up' beside £0.60 owed.

const bk = (o: Partial<AwaitingBookingIn> & { ref: string }): AwaitingBookingIn =>
  ({ status: "Confirmed", pay: "Unpaid", method: "card", amount: 0.6, amountPaid: 0, booker: "Kaz James", email: "k@example.com", listing: "October half term", ...o }) as AwaitingBookingIn;
const inv = (o: Partial<AwaitingInvoice> & { id: string }): AwaitingInvoice => ({ customerName: "Acme", amount: 10, status: "sent", ...o });

test("the exact case from the screenshot: £0.60 owed on an unpaid booking, no payment request out: NOT 'all paid up'", () => {
  const r = buildAwaiting([], [bk({ ref: "APF-10325" })]);
  assert.equal(r.rows.length, 0);
  assert.equal(r.total, 0);
  assert.equal(r.owedAll, 0.6);
  assert.equal(r.notRequestedOwed, 0.6);
  assert.equal(r.empty, "owedNoRequest");
});

test("the same booking once a payment link/invoice or a reminder is out: listed, total £0.60, matches Finance's owed", () => {
  for (const extra of [{ pay: "Invoice sent" }, { nudges: 2, lastNudgedAt: "2026-10-07T19:53:00Z" }, { reminders: { count: 1, lastAt: "2026-10-07T19:53:00Z" } }, { invoiceResends: { count: 3, lastAt: "2026-10-07T19:53:00Z" } }] as Partial<AwaitingBookingIn>[]) {
    const b = bk({ ref: "APF-10325", ...extra });
    const r = buildAwaiting([], [b]);
    assert.equal(paymentRequestOut(b), true, JSON.stringify(extra));
    assert.equal(r.empty, "list");
    assert.equal(r.rows.length, 1);
    assert.equal(r.total, 0.6);
    assert.equal(r.total, r.owedAll, "Money in and Finance (owedNow) agree");
    assert.equal(r.notRequestedOwed, 0);
    assert.equal(r.rows[0].bookingRef, "APF-10325");
  }
});

test("reminder count reads the unified log, the resend log and the old nudge counter (the largest wins)", () => {
  assert.equal(reminderCount(bk({ ref: "A", nudges: 1, reminders: { count: 3 } })), 3);
  assert.equal(reminderCount(bk({ ref: "A", invoiceResends: { count: 2 } })), 2);
  assert.equal(reminderCount(bk({ ref: "A" })), 0);
});

test("a booking that is also a sent invoice appears ONCE (as the invoice) and is not counted twice", () => {
  const r = buildAwaiting([inv({ id: "i1", reference: "APF-1", amount: 0.6 })], [bk({ ref: "APF-1", pay: "Invoice sent" })]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].kind, "invoice");
  assert.equal(r.total, 0.6);
  assert.equal(r.notRequestedOwed, 0);
});

test("invoices and bookings add up in one total; a paid / cancelled / waiting-list / approval booking never counts", () => {
  const r = buildAwaiting(
    [inv({ id: "i1", amount: 25 }), inv({ id: "i2", amount: 99, status: "paid" })],
    [
      bk({ ref: "B1", pay: "Invoice sent", amount: 0.6 }),
      bk({ ref: "B2", pay: "Paid", amountPaid: 0.3, amount: 0.3 }),
      bk({ ref: "B3", status: "Cancelled", pay: "Invoice sent" }),
      bk({ ref: "B4", status: "Waitlisted", pay: "Invoice sent" }),
      bk({ ref: "B5", status: "Approval needed", pay: "Invoice sent" }),
    ],
  );
  assert.equal(r.invoiceTotal, 25);
  assert.equal(r.bookingTotal, 0.6);
  assert.equal(r.total, 25.6);
  assert.equal(r.rows.map((x) => x.id).join(","), "inv-i1,bk-B1");
});

test("a part-paid booking lists only the balance", () => {
  const r = buildAwaiting([], [bk({ ref: "P1", pay: "Invoice sent", amount: 10, amountPaid: 4 })]);
  assert.equal(r.total, 6);
  assert.equal(r.owedAll, owedNow(bk({ ref: "P1", amount: 10, amountPaid: 4 })));
});

test("other owed money outside the list is reported so the panel can point to Who owes you", () => {
  const r = buildAwaiting([], [bk({ ref: "R1", pay: "Invoice sent", amount: 5 }), bk({ ref: "R2", amount: 0.6 })]);
  assert.equal(r.empty, "list");
  assert.equal(r.total, 5);
  assert.equal(r.notRequestedOwed, 0.6);
  assert.equal(r.owedAll, 5.6);
});

test("only when NOTHING is owed anywhere is it 'all paid up'", () => {
  assert.equal(buildAwaiting([], []).empty, "paidUp");
  assert.equal(buildAwaiting([inv({ id: "x", status: "paid" })], [bk({ ref: "Z", pay: "Paid", amountPaid: 0.6 })]).empty, "paidUp");
});
