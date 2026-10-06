/**
 * Customer + provider booking-email content tests (pure: no network, no
 * Firestore, no real email is ever sent).
 *
 * Run:   npm run test:emails
 *        (= server/node_modules/.bin/tsx --test tests/emails.test.mts)
 *
 * Covers server/src/lib/emailTemplates.ts - the pure HTML builders that
 * server/src/lib/emails.ts (sendCustomerEmail etc.) wraps with Firestore
 * branding lookups and sendMail. The builders return { subject, title, body }
 * and layout() wraps them in the branded shell, exactly as production does.
 *
 * Catalogue refs: ME-001, ME-002, ME-003, ME-005, ME-006, ME-007, ME-008,
 * ME-009 (lib/testTracker/catalogue.ts). ME-004 / ME-010 / ME-011 are not here.
 *
 * Tests marked { todo } document content the catalogue expects but the code
 * does not currently produce - they are REPORTS, not weakened assertions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { BRAND } from "../server/src/lib/brand";
import {
  bankPayHtml,
  bookingConfirmedSpec,
  bookingDeclinedSpec,
  cancellationRequestNotice,
  escapeHtml,
  familyBookingCreatedEmail,
  gbp,
  layout,
  paymentLinkSpec,
  paymentReceivedSpec,
  placeOfferedSpec,
  refundApprovedSpec, waitlistJoinedSpec,
  requestReceivedSpec,
  type CustomerEmailSpec,
} from "../server/src/lib/emailTemplates";
import type { Booking } from "../features/bookings/types";

const WEB = "https://app.example.test";
const PROVIDER = "Sunny Sports Club";
const SCRIPT = "<script>alert(1)</script>";

const money = (n: number) => `£${n.toFixed(2)}`;

function booking(over: Record<string, unknown> = {}): Booking {
  return {
    ref: "SSC-1042",
    bid: "bid1",
    tenantId: "t1",
    booker: "Priya Patel",
    email: "priya@example.test",
    phone: "07000000000",
    child: "Asha",
    kids: [{ name: "Asha" }, { name: "Ravi" }],
    listing: "Football Camp",
    pass: "Full week",
    amount: 87.5,
    dates: "Mon 20 Jul - Fri 24 Jul 2026",
    sessions: [
      "Mon 20 Jul 2026 · 09:00 – 15:00",
      "Tue 21 Jul 2026 · 09:00 – 15:00",
      "Wed 22 Jul 2026 · 09:00 – 15:00",
    ],
    ...over,
  } as unknown as Booking;
}

/** Full email exactly as production assembles it: shell around spec. */
function render(spec: CustomerEmailSpec, b: Booking, ctx: Parameters<typeof layout>[4] = {}): string {
  return layout({ name: PROVIDER, hasLogo: false }, spec.title, spec.body, b, ctx, WEB);
}
/** Strip tags so we can assert on what a human reads. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&rsquo;|&#39;/g, "'").replace(/\s+/g, " ");
const noJunk = (label: string, s: string) =>
  assert.doesNotMatch(s, /\b(undefined|null|NaN|\[object Object\])\b/, `${label} contains an undefined/null/NaN string`);

// ───────────────────────── helpers ─────────────────────────

test("gbp always formats as pounds with two decimals", () => {
  assert.equal(gbp(87.5), "£87.50");
  assert.equal(gbp(0), "£0.00");
  assert.equal(gbp(12), "£12.00");
  assert.equal(gbp(0.1 + 0.2), "£0.30");
});

test("escapeHtml escapes every HTML-significant character and tolerates undefined", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(escapeHtml(undefined as unknown as string), "");
});

// ───────────────────────── ME-001 booking confirmed ─────────────────────────

test("ME-001 confirmed: subject names the activity and says confirmed", () => {
  const s = bookingConfirmedSpec(booking(), PROVIDER);
  assert.equal(s.subject, "Booking confirmed — Football Camp");
  assert.match(s.title, /booked in/i);
});

test("ME-001 confirmed: body thanks the booker by name and names the provider", () => {
  const html = render(bookingConfirmedSpec(booking(), PROVIDER), booking());
  assert.match(text(html), /Great news Priya Patel/);
  assert.match(text(html), /Sunny Sports Club has confirmed your booking/);
});

test("ME-001 confirmed: shows ALL children, the activity and the pass", () => {
  const t = text(render(bookingConfirmedSpec(booking(), PROVIDER), booking()));
  assert.match(t, /Child\s+Asha, Ravi/);
  assert.match(t, /Activity\s+Football Camp/);
  assert.match(t, /Pass\s+Full week/);
});

test("ME-001 confirmed: amount equals the booking amount, formatted GBP", () => {
  const b = booking({ amount: 87.5 });
  const t = text(render(bookingConfirmedSpec(b, PROVIDER), b));
  assert.match(t, /Total\s+£87\.50/);
  assert.doesNotMatch(t, /£87\.5\b(?!0)/);
});

test("DI-043 confirmed: shows price before discount and discount rows only when discounted", () => {
  const d = booking({ amount: 72, listPrice: 90, discountOff: 18 } as any);
  const t = text(render(bookingConfirmedSpec(d, PROVIDER), d));
  assert.match(t, /Price before discount\s+£90\.00/);
  assert.match(t, /Discount\s+−\s*£18\.00/);
  assert.match(t, /Total\s+£72\.00/);
  const plain = booking({ amount: 87.5 });
  assert.doesNotMatch(text(render(bookingConfirmedSpec(plain, PROVIDER), plain)), /Price before discount/);
});

test("ME-001 confirmed: every session date AND its time is listed", () => {
  const html = render(bookingConfirmedSpec(booking(), PROVIDER), booking());
  for (const d of ["Mon 20 Jul 2026", "Tue 21 Jul 2026", "Wed 22 Jul 2026"]) assert.ok(html.includes(d), d);
  assert.equal((html.match(/09:00 – 15:00/g) ?? []).length, 3);
  assert.match(html, /Dates &amp; times/);
});

test("ME-001 confirmed: the venue appears when the listing context supplies it", () => {
  const html = render(bookingConfirmedSpec(booking(), PROVIDER), booking(), { location: "Riverside Hall, 1 High St, Leeds" });
  assert.match(text(html), /Location\s+Riverside Hall, 1 High St, Leeds/);
});

test("ME-001 confirmed: asks the listing lookup for venue, what's included and the map", () => {
  assert.deepEqual(bookingConfirmedSpec(booking(), PROVIDER).enrich, { whatIncluded: true, map: true });
});

test("ME-001 confirmed: home-visit booking says 'We'll come to you' and labels the address", () => {
  const b = booking({ serviceAddress: { address: "5 Elm Rd", postcode: "LS1 1AA" } });
  const s = bookingConfirmedSpec(b, PROVIDER);
  assert.match(s.body, /We'll come to you!/);
  assert.doesNotMatch(s.body, /See you there/);
  assert.match(text(render(s, b, { location: "5 Elm Rd, LS1 1AA", homeVisit: true })), /We'll come to you at\s+5 Elm Rd, LS1 1AA/);
});

test("ME-001 confirmed: bank-transfer details (reference + amount) appear when supplied", () => {
  const bank = { bankName: "Monzo", accountName: "Sunny Sports", sortCode: "04-00-04", accountNumber: "12345678", reference: "SSC-1042", amount: 87.5 };
  const html = bookingConfirmedSpec(booking(), PROVIDER, bank).body;
  const t = text(html);
  assert.match(t, /Sort code\s+04-00-04/);
  assert.match(t, /Account number\s+12345678/);
  assert.match(t, /Payment reference\s+SSC-1042/);
  assert.match(t, /Amount\s+£87\.50/);
  assert.equal(bookingConfirmedSpec(booking(), PROVIDER, null).body.includes("bank transfer"), false);
});

test("ME-001 confirmed: bank details escape user text", () => {
  assert.ok(!bankPayHtml({ reference: SCRIPT, accountName: SCRIPT }).includes("<script>"));
});

test("ME-001 confirmed: 'View my booking' links to the booking in the parent dashboard", () => {
  const html = render(bookingConfirmedSpec(booking(), PROVIDER), booking());
  assert.ok(html.includes(`href="${WEB}/custdash/bookings?open=SSC-1042"`));
});

test("ME-001 confirmed: powered-by footer and provider name are present (brand is only in the footer)", () => {
  const html = render(bookingConfirmedSpec(booking(), PROVIDER), booking());
  assert.match(html, new RegExp(`Powered by <b[^>]*>${BRAND}`));
  assert.match(html, /a booking was made with Sunny Sports Club/);
});

test("ME-001 confirmed: no undefined/null/NaN anywhere, even for a sparse booking", () => {
  noJunk("full", render(bookingConfirmedSpec(booking(), PROVIDER), booking()));
  const sparse = booking({ kids: undefined, sessions: undefined, pass: undefined, serviceAddress: undefined });
  noJunk("sparse", render(bookingConfirmedSpec(sparse, PROVIDER), sparse));
});

test("ME-001 confirmed: a booking with a human-readable `dates` string but no `sessions` does NOT show them", () => {
  // Observation (not asserted as a bug): the shell only reads b.sessions, so
  // an older booking without sessions says "Dates to be confirmed".
  const b = booking({ sessions: undefined });
  assert.match(text(render(bookingConfirmedSpec(b, PROVIDER), b)), /Dates to be confirmed/);
});

// ───────────────────────── escaping (all builders) ─────────────────────────

test("HTML injection: <script> in booker, child, listing, pass and provider name is escaped in every customer email", () => {
  const b = booking({
    booker: SCRIPT, listing: SCRIPT, pass: SCRIPT, child: SCRIPT,
    kids: [{ name: SCRIPT }, { name: `"><img src=x onerror=alert(2)>` }],
    sessions: [`${SCRIPT} · ${SCRIPT}`],
  });
  const evil = `${SCRIPT} Inc`;
  const specs: Record<string, CustomerEmailSpec> = {
    received: requestReceivedSpec(b, evil),
    link: paymentLinkSpec(b, evil, `${WEB}/pay/b/abc`),
    confirmed: bookingConfirmedSpec(b, evil),
    declined: bookingDeclinedSpec(b, evil, SCRIPT),
    refund: refundApprovedSpec(b, evil),
    offered: placeOfferedSpec(b, evil, WEB),
    received2: paymentReceivedSpec(b, evil, { label: SCRIPT, amount: 5 }),
  };
  for (const [name, spec] of Object.entries(specs)) {
    const html = layout({ name: evil, hasLogo: false }, spec.title, spec.body, b, { location: SCRIPT }, WEB);
    assert.ok(!html.includes("<script>"), `${name}: raw <script> leaked`);
    assert.ok(!/<img src=x/.test(html), `${name}: injected <img> leaked`);
    assert.ok(html.includes("&lt;script&gt;"), `${name}: should contain the escaped form`);
  }
});

test("HTML injection: logo alt text and hero/map alt text are escaped", () => {
  const html = layout({ name: `"><script>x</script>`, hasLogo: true }, "t", "", booking({ listing: `"><b onmouseover=1>` }), { heroCid: "cid:h", mapCid: "cid:m", location: `"x` }, WEB);
  assert.ok(!html.includes(`"><script>`));
  assert.ok(!html.includes(`"><b onmouseover`));
});

test("HTML injection: family booking email escapes booker, provider and listing", () => {
  const b = booking({ booker: SCRIPT, listing: SCRIPT });
  const { html } = familyBookingCreatedEmail([b], SCRIPT, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`);
  assert.ok(!html.includes("<script>"));
});

// ───────────────────────── ME-002 request received ─────────────────────────

test("ME-002 request received: says the provider will approve and payment comes after", () => {
  const s = requestReceivedSpec(booking(), PROVIDER);
  assert.equal(s.subject, "Booking request received — Football Camp");
  const t = text(s.body);
  assert.match(t, /Thanks Priya Patel/);
  assert.match(t, /your request is with Sunny Sports Club for approval/);
  assert.match(t, /as soon as it's confirmed/);
  assert.match(t, /Payment is collected after approval/);
});

test("ME-002 request received: it is not worded as a confirmation", () => {
  const s = requestReceivedSpec(booking(), PROVIDER);
  assert.doesNotMatch(s.title + s.body, /you're booked|confirmed your booking/i);
  noJunk("received", render(s, booking()));
});

// ───────────────────────── ME-003 approved / declined ─────────────────────────

test("ME-003 declined: the provider's REASON is in the email, labelled with the provider", () => {
  const s = bookingDeclinedSpec(booking(), PROVIDER, "Sorry, the course is full for that week.");
  assert.equal(s.subject, "Booking update — Football Camp");
  assert.match(s.title, /declined/i);
  const t = text(s.body);
  assert.match(t, /Message from Sunny Sports Club/);
  assert.match(t, /Sorry, the course is full for that week\./);
});

test("ME-003 declined: tells the parent nothing has been charged", () => {
  assert.match(text(bookingDeclinedSpec(booking(), PROVIDER, "x").body), /Nothing has been charged/);
});

test("ME-003 declined: reason whitespace is trimmed and line breaks preserved; blank reason shows no reason box", () => {
  const withReason = bookingDeclinedSpec(booking(), PROVIDER, "  line1\nline2  ").body;
  assert.ok(withReason.includes("white-space:pre-wrap\">line1\nline2</div>"));
  for (const r of [undefined, "", "   "]) assert.ok(!bookingDeclinedSpec(booking(), PROVIDER, r).body.includes("Message from"));
});

test("ME-003 declined: a reason containing HTML is escaped", () => {
  const body = bookingDeclinedSpec(booking(), PROVIDER, `Use <b>this</b> & "that"`).body;
  assert.ok(body.includes("Use &lt;b&gt;this&lt;/b&gt; &amp; &quot;that&quot;"));
});

test("ME-003 approved: the approval email is the booking-confirmed email (provider approval -> confirmed)", () => {
  const s = bookingConfirmedSpec(booking(), PROVIDER);
  assert.match(s.subject, /confirmed/i);
});

// ───────────────────────── ME-005 cancellation request (provider) ─────────────────────────

test("ME-005 cancellation request: card refund, amount, kids, ref, reason and approve/decline prompt", () => {
  const b = booking({ cancel: { refundTo: "card", amount: 52.5, refund: "partial", reason: "Illness" } });
  const n = cancellationRequestNotice(b, money);
  assert.equal(n.title, "Priya Patel asked to cancel — Football Camp");
  assert.equal(n.subject, "Priya Patel — cancellation request");
  assert.match(n.body, /Booking SSC-1042/);
  assert.match(n.body, /Asha, Ravi/);
  assert.match(n.body, /Reason: Illness\./);
  assert.match(n.body, /£52\.50 refund requested back to their card\./);
});

test("ME-005 cancellation request: the parent's typed note is included, the stock fallback is not", () => {
  const typed = cancellationRequestNotice(booking({ cancel: { amount: 5, msg: "We are moving house" } }), money);
  assert.match(typed.body, /Reason: "We are moving house"\./);
  const both = cancellationRequestNotice(booking({ cancel: { amount: 5, reason: "Illness", msg: "Chickenpox" } }), money);
  assert.match(both.body, /Reason: Illness — "Chickenpox"\./);
  const stock = cancellationRequestNotice(booking({ cancel: { amount: 5, msg: "Cancelled by the parent. (Cancelled 21 days before it starts — your policy gives a full refund.)" } }), money);
  assert.doesNotMatch(stock.body, /Reason:/);
});

test("ME-005 cancellation request: wallet destination is named WALLET", () => {
  const n = cancellationRequestNotice(booking({ cancel: { refundTo: "wallet", amount: 20 } }), money);
  assert.match(n.body, /£20\.00 refund requested to their WALLET \(store credit\)/);
});

test("ME-005 cancellation request: voucher / Tax-Free Childcare bookings are routed via the scheme, never 'CARD'", () => {
  const v = cancellationRequestNotice(booking({ voucherScheme: "Kidsco", cancel: { amount: 10 } }), money);
  assert.match(v.body, /via Kidsco \(not a bank card\)/);
  const tfc = cancellationRequestNotice(booking({ method: "Tax-Free Childcare", cancel: { amount: 10 } }), money);
  assert.match(tfc.body, /via Tax-Free Childcare \(not a bank card\)/);
  assert.doesNotMatch(tfc.body, /card\./);
});

test("ME-005 cancellation request: no refund due under policy says so and does not mention an amount", () => {
  const n = cancellationRequestNotice(booking({ cancel: { refund: "none", amount: 0 } }), money);
  assert.match(n.body, /No refund is due under your cancellation policy\./);
  assert.doesNotMatch(n.body, /£/);
});

test("ME-005 cancellation request: falls back to the child name, then booker, when there is no kids list; no junk strings", () => {
  const n1 = cancellationRequestNotice(booking({ kids: undefined, dates: undefined, cancel: { amount: 5 } }), money);
  assert.match(n1.body, /· Asha\./);
  const n2 = cancellationRequestNotice(booking({ kids: undefined, dates: undefined, child: "", cancel: { amount: 5 } }), money);
  assert.match(n2.body, /· Priya Patel\./);
  noJunk("n1", n1.title + n1.subject + n1.body);
  noJunk("n2", n2.title + n2.subject + n2.body);
});

test("ME-005 cancellation request: duplicate kid names are listed once", () => {
  const n = cancellationRequestNotice(booking({ kids: [{ name: "Asha" }, { name: "Asha" }], dates: undefined, cancel: { amount: 5 } }), money);
  assert.match(n.body, /· Asha\./);
});

// ───────────────────────── ME-006 refund approved ─────────────────────────

test("ME-006 refund to wallet: says credit is already in the wallet (instant) with the amount", () => {
  const b = booking({ cancel: { refundTo: "wallet", amount: 30 } });
  const s = refundApprovedSpec(b, PROVIDER);
  assert.equal(s.subject, "Wallet credit added — Football Camp");
  const t = text(s.body);
  assert.match(t, /refund of £30\.00 as wallet credit/);
  assert.match(t, /already in your wallet/);
});

test("ME-006 refund to card: subject, amount shown, and payment-method wording", () => {
  const b = booking({ cancel: { refundTo: "card", amount: 30 } });
  const s = refundApprovedSpec(b, PROVIDER);
  assert.equal(s.subject, "Refund approved — Football Camp");
  assert.match(text(s.body), /Amount: £30\.00/);
  assert.match(text(s.body), /original payment method/);
});

test("ME-006 refund via voucher scheme / offline: names the scheme and never claims the card", () => {
  const b = booking({ voucherScheme: "Kidsco", cancel: { refundVia: "offline", amount: 30 } });
  const t = text(refundApprovedSpec(b, PROVIDER).body);
  assert.match(t, /returned through Kidsco/);
  assert.doesNotMatch(t, /original payment method/);
});

test("ME-006 refund approved: amount is omitted cleanly (no £0.00 / undefined) when there is none", () => {
  const body = refundApprovedSpec(booking({ cancel: { refundTo: "card" } }), PROVIDER).body;
  assert.doesNotMatch(body, /£/);
  noJunk("refund", render(refundApprovedSpec(booking({ cancel: undefined }), PROVIDER), booking()));
});

test("ME-006 card refund email says 5 to 10 working days", () => {
  const s = refundApprovedSpec(booking({ cancel: { refundTo: "card", amount: 30 } }), PROVIDER);
  assert.match(text(s.body), /5\s*(to|-|–)\s*10 working days/i);
});

// ───────────────────────── ME-007 waiting list ─────────────────────────

test("ME-007 offered: 2 hour hold, queue consequence and Accept-and-pay link to that booking", () => {
  const s = placeOfferedSpec(booking(), PROVIDER, WEB);
  assert.equal(s.subject, "A place has opened up — Football Camp");
  assert.match(text(s.body), /held for you for 2 hours/);
  assert.match(text(s.body), /passes to the next family in the queue/);
  assert.ok(s.body.includes(`href="${WEB}/custdash/bookings?pay=SSC-1042"`));
  assert.match(s.body, />Accept and pay</);
});

test("ME-007 offered: shows the expiry time (HH:MM) when an offer deadline is set, none when not", () => {
  const withExp = placeOfferedSpec(booking({ offerExpiresAt: "2026-07-20T14:30:00" }), PROVIDER, WEB).body;
  assert.match(text(withExp), /for 2 hours \(until \d{2}:\d{2}\)/);
  const without = placeOfferedSpec(booking({ offerExpiresAt: undefined }), PROVIDER, WEB).body;
  assert.doesNotMatch(without, /until/);
  noJunk("offered", withExp + without);
});

test("ME-007 offered: pay link encodes an unusual booking ref", () => {
  assert.ok(placeOfferedSpec(booking({ ref: "A B&C" }), PROVIDER, WEB).body.includes("pay=A%20B%26C"));
});

test("ME-007 waiting list JOINED email: says waiting list, nothing to pay, never 'approval'", () => {
  const s = waitlistJoinedSpec(booking(), PROVIDER);
  assert.match(s.subject, /on the waiting list/i);
  assert.match(text(s.body), /nothing to pay now/i);
  assert.doesNotMatch(text(s.body), /approval|approve/i);
  assert.doesNotMatch(s.body, /undefined|null|NaN/);
});

// ───────────────────────── ME-008 payment received ─────────────────────────

test("ME-008 payment received: amount, method label and fully-paid statement", () => {
  const s = paymentReceivedSpec(booking(), PROVIDER, { label: "voucher", amount: 87.5 });
  assert.equal(s.subject, "Payment received — Football Camp");
  assert.match(s.title, /Payment received/);
  const t = text(s.body);
  assert.match(t, /received your voucher payment of £87\.50/);
  assert.match(t, /fully paid/);
});

test("ME-008 payment received: the amount in the email is the amount passed, not the booking total", () => {
  const b = booking({ amount: 100 });
  const t = text(render(paymentReceivedSpec(b, PROVIDER, { label: "cash", amount: 40 }), b));
  assert.match(t, /payment of £40\.00/);
  assert.match(t, /Total\s+£100\.00/);
});

test("ME-008 payment received: includes dates, children and venue context like the other emails", () => {
  const b = booking();
  const t = text(render(paymentReceivedSpec(b, PROVIDER, { label: "cash", amount: 5 }), b, { location: "Riverside Hall" }));
  assert.match(t, /Tue 21 Jul 2026/);
  assert.match(t, /Asha, Ravi/);
  assert.match(t, /Riverside Hall/);
  noJunk("pay-received", t);
});

test("ME-008 payment received: amounts with floating-point noise format cleanly", () => {
  assert.match(paymentReceivedSpec(booking(), PROVIDER, { label: "cash", amount: 19.999999 }).body, /£20\.00/);
});

// ───────────────────────── ME-009 payment-link email ─────────────────────────

test("ME-009 payment link: Pay button uses the public /pay/b/{token} URL it is given", () => {
  const url = `${WEB}/pay/b/4f9d2c1e-7a3b-4c55-9f10-2b6e8d0a1c33`;
  const s = paymentLinkSpec(booking(), PROVIDER, url);
  assert.ok(s.body.includes(`href="${url}"`));
  assert.ok(!s.body.includes("/custdash/bookings?pay="), "must not fall back to the signed-in page when a token URL is supplied");
});

test("ME-009 payment link: button states the exact booking amount", () => {
  const s = paymentLinkSpec(booking({ amount: 87.5 }), PROVIDER, `${WEB}/pay/b/t`);
  assert.match(text(s.body), /Pay £87\.50 securely/);
  assert.match(text(s.body), /No account or sign-in needed/);
});

test("ME-009 payment link: subject and title tell the family to complete the booking", () => {
  const s = paymentLinkSpec(booking(), PROVIDER, `${WEB}/pay/b/t`);
  assert.equal(s.subject, "Complete your booking — Football Camp");
  assert.match(s.title, /payment inside/);
  assert.match(text(s.body), /Sunny Sports Club has reserved this booking for you/);
});

test("ME-009 payment link: full email still carries dates, children and total", () => {
  const b = booking();
  const t = text(render(paymentLinkSpec(b, PROVIDER, `${WEB}/pay/b/t`), b));
  assert.match(t, /Total\s+£87\.50/);
  assert.match(t, /Mon 20 Jul 2026/);
  noJunk("link", t);
});

test("ME-009 family-created email: single paid booking uses the supplied /pay/b/ URL; amount on the button", () => {
  const url = `${WEB}/pay/b/abc`;
  const { html, subject } = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: false, passwordLink: null }, url);
  assert.equal(subject, "Your booking with Sunny Sports Club (SSC-1042)");
  assert.ok(html.includes(`href="${url}"`));
  assert.match(text(html), /Pay £87\.50/);
});

test("ME-009 family-created email: multiple bookings sum the total, list every ref and say 'refs'", () => {
  const bs = [booking({ ref: "A-1", amount: 10 }), booking({ ref: "A-2", amount: 15.5 })];
  const { html, subject } = familyBookingCreatedEmail(bs, PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/custdash/bookings?pay=A-1`);
  assert.equal(subject, "Your booking with Sunny Sports Club (A-1, A-2)");
  assert.match(text(html), /Booking refs\s+A-1, A-2/);
  assert.match(text(html), /Total\s+£25\.50/);
  assert.match(text(html), /Pay £25\.50/);
});

test("ME-009 family-created email: £0 booking says nothing to pay and has no Pay button", () => {
  const { html } = familyBookingCreatedEmail([booking({ amount: 0 })], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/x`);
  assert.match(text(html), /nothing to pay/);
  assert.doesNotMatch(html, />Pay £/);
});

test("ME-009 family-created email: set-password link appears only for a newly created account", () => {
  const link = "https://auth.example.test/set?oob=abc";
  const yes = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: true, passwordLink: link }, `${WEB}/pay/b/x`).html;
  assert.ok(yes.includes(`href="${link}"`));
  assert.match(text(yes), /Set my password/);
  const no = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: false, passwordLink: link }, `${WEB}/pay/b/x`).html;
  assert.ok(!no.includes(link));
  noJunk("family", yes + no);
});

// ──── KNOWN QUESTION: what does each confirmation email include vs ME-001? ────

test("KNOWN QUESTION: shell-based confirmation (emailBookingConfirmed) includes dates, times, children, amount (+ venue via listing lookup)", () => {
  const b = booking();
  const t = text(render(bookingConfirmedSpec(b, PROVIDER), b, { location: "Riverside Hall" }));
  for (const needle of ["Mon 20 Jul 2026", "09:00 – 15:00", "Asha, Ravi", "£87.50", "Riverside Hall"]) assert.ok(t.includes(needle), needle);
});

test("KNOWN QUESTION: provider-made 'Your booking is confirmed' email (emailFamilyBookingCreated) includes ref, activity, dates, total", () => {
  const { html } = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`);
  const t = text(html);
  assert.match(t, /Your booking is confirmed/);
  for (const needle of ["SSC-1042", "Football Camp", "Mon 20 Jul - Fri 24 Jul 2026", "£87.50"]) assert.ok(t.includes(needle), needle);
});

test("ME-001 provider-made confirmation names the CHILD", { todo: "FINDING: familyBookingCreatedEmail deliberately omits child data (see its comment: a mistyped address must not leak a child's details). ME-001 expects children." }, () => {
  const { html } = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`);
  assert.match(text(html), /Asha/);
});

test("ME-001 provider-made confirmation shows session TIMES", () => {
  const { html } = familyBookingCreatedEmail([{ ...booking(), sessions: ["Mon 20 Jul 2026 · 09:00 – 15:00"] }], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`);
  assert.match(text(html), /09:00/);
});

test("ME-001 provider-made confirmation shows the VENUE", () => {
  const { html } = familyBookingCreatedEmail([booking()], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`, "Riverside Hall, 1 High St, Milton Keynes");
  assert.match(text(html), /Location|Venue|Where/i);
});

test("family-created email: `dates` and refs are interpolated WITHOUT escaping (FINDING, low risk: system-generated)", () => {
  // Documents current behaviour rather than asserting it is right: b.dates and
  // the refs are put in raw. They are generated server-side today, so this is
  // low risk, but the other fields in the same template are escaped.
  const { html } = familyBookingCreatedEmail([booking({ dates: "<i>x</i>" })], PROVIDER, { accountCreated: false, passwordLink: null }, `${WEB}/pay/b/x`);
  assert.ok(html.includes("<i>x</i>"));
});

// ───────────────────────── cross-cutting ─────────────────────────

test("every customer email subject is single-line, names the activity and never leaks the raw ref placeholder", () => {
  const b = booking({ cancel: { amount: 5 } });
  const subjects = [
    requestReceivedSpec(b, PROVIDER), paymentLinkSpec(b, PROVIDER, `${WEB}/pay/b/t`), bookingConfirmedSpec(b, PROVIDER),
    bookingDeclinedSpec(b, PROVIDER), refundApprovedSpec(b, PROVIDER), placeOfferedSpec(b, PROVIDER, WEB),
    paymentReceivedSpec(b, PROVIDER, { label: "cash", amount: 5 }),
  ].map((s) => s.subject);
  for (const s of subjects) {
    assert.ok(!s.includes("\n"));
    assert.ok(s.includes("Football Camp"), s);
    noJunk(s, s);
  }
  assert.equal(new Set(subjects).size, subjects.length, "subjects should be distinct per email type");
});

test("every customer email renders clean HTML with no junk strings for the standard booking", () => {
  const b = booking({ cancel: { amount: 5, refundTo: "card" }, offerExpiresAt: "2026-07-20T14:30:00" });
  const specs = [
    requestReceivedSpec(b, PROVIDER), paymentLinkSpec(b, PROVIDER, `${WEB}/pay/b/t`), bookingConfirmedSpec(b, PROVIDER),
    bookingDeclinedSpec(b, PROVIDER, "no"), refundApprovedSpec(b, PROVIDER), placeOfferedSpec(b, PROVIDER, WEB),
    paymentReceivedSpec(b, PROVIDER, { label: "cash", amount: 5 }),
  ];
  for (const s of specs) {
    const html = render(s, b);
    noJunk(s.subject, html);
    noJunk(s.subject, s.subject + s.title);
    assert.ok(html.includes(WEB), "links should be absolute to the web origin");
  }
});
