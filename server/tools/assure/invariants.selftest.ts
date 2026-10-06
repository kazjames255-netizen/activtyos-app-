// Self-test for the invariants: a hand-built CLEAN snapshot must raise nothing, and for EVERY rule a deliberately BROKEN copy must be flagged
// by that rule (the positive control: proof the rule can fail). Run:  server/node_modules/.bin/tsx server/tools/assure/invariants.selftest.ts [--count]
import { INVARIANTS, checkAll } from "./invariants";
import type { Snapshot, SnapBooking } from "./types";

const T0 = "2026-10-06T10:00:00.000Z";
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString();
const D1 = "2026-11-02", D2 = "2026-11-03", D3 = "2026-11-04";

function bk(over: Partial<SnapBooking>): SnapBooking {
  return {
    id: over.ref ?? "x", ref: "R0", listingId: "L1", blockId: "B1", tenantId: "T", email: "p1@x.test", status: "Confirmed", pay: "Paid", amount: 20, received: 20, refunded: 0,
    walletApplied: 0, days: [D1], seats: 1, kidsLive: 1, pass: "Day pass", method: "card", createdAt: at(0), discountOff: 0, listPrice: 20, amountPaid: 20, cancel: null,
    kids: [{ childId: "c1", name: "A" }], listingName: "Camp", childKey: "c1", ageGroup: undefined, ...over,
  };
}
function clean(): Snapshot {
  return {
    tenantId: "T", takenAt: "2026-10-06T12:00:00.000Z",
    listings: [{ id: "L1", status: "live", name: "Camp", ticketCaps: { "Day pass": 5 }, ageCaps: { g1: 3 }, waitlistMode: "auto", createdAt: "2026-09-01", discounts: [{ kind: "person", method: "percent", enabled: true }] }],
    blocks: [{ id: "B1", listingId: "L1", capacity: 10, capacityScope: "day", dates: [D1, D2, D3], dayCounts: { [D1]: 1, [D2]: 1, [D3]: 0 }, counts: { [D1]: 1, [D2]: 1, [D3]: 0 }, bookedCount: 2, open: true }],
    bookings: [
      bk({ ref: "R1" }),
      bk({ ref: "R2", email: "p2@x.test", status: "Waitlisted", pay: "Unpaid", amount: 20, received: 0, amountPaid: undefined, createdAt: at(5), kids: [{ childId: "c2", name: "B" }], childKey: "c2" }),
      bk({ ref: "R3", status: "Cancelled", pay: "Refunded", received: 20, refunded: 20, days: [D3], cancel: { on: at(100), refund: "approved", amount: 20 }, kids: [{ childId: "c3", name: "C" }], childKey: "c3", createdAt: at(1) }),
      bk({ ref: "R4", pay: "Funded", method: "HAF (funded £0)", amount: 0, received: 0, listPrice: 0, amountPaid: undefined, days: [D2], kids: [{ childId: "c4", name: "D" }], childKey: "c4", email: "p3@x.test", createdAt: at(2) }),
    ],
    payments: [
      { id: "pay1", refs: ["R1"], amount: 20, status: "succeeded", createdAt: at(1), paidAt: at(60), email: "p1@x.test", paymentIntentId: "pi_1" },
      { id: "pay3", refs: ["R3"], amount: 20, status: "succeeded", createdAt: at(1), paidAt: at(60), email: "p1@x.test", paymentIntentId: "pi_3" },
      { id: "ref3", refs: ["R3"], amount: 20, status: "succeeded", type: "refund", createdAt: at(120), email: "p1@x.test" },
    ],
    wallet: { "p1@x.test": 5 }, walletEntries: [{ email: "p1@x.test", delta: 5, ref: "R3" }],
    emailsSent: [
      { to: "p1@x.test", subject: "Payment received — Camp", kind: "payment-received", at: at(75) },
      { to: "p1@x.test", subject: "Booking confirmed — Camp", kind: "booking-confirmed", at: at(90) },
    ],
  };
}
const R = (s: Snapshot, ref: string) => s.bookings.find((b) => b.ref === ref)!;
const confirmedEmail = (to: string, sec: number) => ({ to, subject: "Booking confirmed — Camp", kind: "booking-confirmed", at: at(sec) });

/** rule id -> function that breaks a clean snapshot in exactly the way that rule exists to catch. */
const BREAK: Record<string, (s: Snapshot) => void> = {
  "money.amount-formula": (s) => { R(s, "R1").listPrice = 30; },
  "money.amount-bounds": (s) => { R(s, "R1").discountOff = -5; },
  "money.received-within-price": (s) => { R(s, "R1").received = 50; },
  "money.refund-within-received": (s) => { R(s, "R1").refunded = 30; },
  "money.payments-within-received": (s) => { s.payments.push({ id: "payX", refs: ["R1"], amount: 20, status: "succeeded", createdAt: at(3), paymentIntentId: "pi_X" }); },
  "money.paid-has-received": (s) => { R(s, "R1").amountPaid = 10; },
  "money.wallet-nonnegative": (s) => { s.wallet!["p1@x.test"] = -3; },
  "money.wallet-ledger-matches": (s) => { s.walletEntries![0].delta = 9; },
  "money.card-paid-equals-price": (s) => { R(s, "R1").amountPaid = 19; },
  "money.refund-state-consistent": (s) => { R(s, "R3").refunded = 5; },
  "money.addons-sane": (s) => { R(s, "R1").addonsTotal = -5; },
  "money.funded-owes-nothing": (s) => { R(s, "R4").amount = 10; },
  "money.early-bird-once": (s) => { R(s, "R1").earlyBirdScope = "season:s1"; s.bookings.push(bk({ ref: "R5", createdAt: at(900), earlyBirdScope: "season:s1", days: [D3], kids: [{ childId: "c5", name: "E" }], childKey: "c5" })); },
  "money.multi-person-percent-only": (s) => { s.listings[0].createdAt = "2026-10-05"; s.listings[0].discounts = [{ kind: "person", method: "amount", enabled: true }]; },
  "money.payment-intent-unique": (s) => { s.payments.push({ id: "payDup", refs: ["R1"], amount: 20, status: "succeeded", createdAt: at(4), paymentIntentId: "pi_1" }); },
  "money.card-paid-has-payment": (s) => { s.payments = s.payments.filter((p) => !p.refs.includes("R1")); },
  "money.payment-has-booking": (s) => { s.payments.push({ id: "orphan", refs: ["R404"], amount: 9, status: "succeeded", createdAt: at(5) }); },
  "money.split-bounds": (s) => { R(s, "R1").tfcAmount = 50; },
  "money.cancel-refund-bounded": (s) => { R(s, "R3").cancel!.amount = 99; },
  "money.refund-records-bounded": (s) => { s.payments.push({ id: "bigref", refs: ["R3"], amount: 50, status: "succeeded", type: "refund", createdAt: at(130) }); },

  "capacity.day-counts-match": (s) => { s.blocks[0].dayCounts![D1] = 3; s.blocks[0].counts![D1] = 3; },
  "capacity.booked-count-matches": (s) => { s.blocks[0].bookedCount = 7; },
  "capacity.day-stored-within-capacity": (s) => { s.blocks[0].dayCounts![D1] = 11; s.blocks[0].counts![D1] = 11; },
  "capacity.day-recomputed-within-capacity": (s) => { s.blocks[0].capacity = 0; s.blocks[0].dayCounts = {}; s.blocks[0].counts = {}; s.blocks[0].bookedCount = 0; },
  "capacity.listing-stored-within-capacity": (s) => { s.blocks[0].capacityScope = "listing"; s.blocks[0].bookedCount = 11; },
  "capacity.listing-recomputed-within-capacity": (s) => { s.blocks[0].capacityScope = "listing"; s.blocks[0].capacity = 1; },
  "capacity.ticket-caps": (s) => { s.listings[0].ticketCaps = { "Day pass": 0 }; },
  "capacity.age-caps": (s) => { R(s, "R1").ageGroup = "g1"; s.listings[0].ageCaps = { g1: 0 }; },
  "capacity.counts-sane": (s) => { s.blocks[0].dayCounts![D2] = -1; s.blocks[0].counts![D2] = -1; },
  "capacity.empty-block-is-empty": (s) => { R(s, "R1").status = "Cancelled"; R(s, "R4").status = "Cancelled"; },
  "capacity.confirmed-within-listing-capacity": (s) => { s.blocks[0].capacityScope = "listing"; s.blocks[0].capacity = 1; },

  "state.status-valid": (s) => { R(s, "R1").status = "Weird"; },
  "state.waitlisted-owes-nothing": (s) => { R(s, "R2").walletApplied = 2; },
  "state.offered-has-window": (s) => { R(s, "R2").status = "Offered"; R(s, "R2").offeredAt = undefined; R(s, "R2").offerExpiresAt = undefined; },
  "state.no-stale-offer": (s) => { const b = R(s, "R2"); b.status = "Offered"; b.offeredAt = "2026-10-06T07:00:00.000Z"; b.offerExpiresAt = "2026-10-06T09:00:00.000Z"; },
  "state.one-active-per-child-per-day": (s) => { s.bookings.push(bk({ ref: "R5", days: [D1] })); },
  "state.refs-unique": (s) => { R(s, "R4").ref = "R1"; },
  "state.days-within-block": (s) => { R(s, "R1").days = ["2099-01-01"]; },
  "state.cancelled-has-cancel-info": (s) => { R(s, "R3").cancel = null; },
  "state.live-has-no-cancel": (s) => { R(s, "R1").cancel = { on: at(10) }; },
  "state.seats-cover-kids": (s) => { R(s, "R1").kidsLive = 3; },
  "state.refs-resolve": (s) => { R(s, "R1").blockMissing = true; },
  "state.date-change-pending-has-moves": (s) => { R(s, "R1").dateChangeStatus = "pending"; R(s, "R1").dateChangeMoves = 0; },
  "state.date-change-orig-date-sane": (s) => { R(s, "R1").origFirstDate = "2026-10-01"; R(s, "R1").amendMovesApproved = 0; },
  "state.days-unique": (s) => { R(s, "R1").days = [D1, D1]; },
  "state.auto-waitlist-no-missed-offer": (s) => { R(s, "R2").createdAt = "2026-10-06T08:00:00.000Z"; s.listings[0].ticketCaps = {}; s.listings[0].ageCaps = undefined; },
  "state.homevisit-has-service-address": (s) => { s.listings[0].deliveryMode = "home-visit"; },
  "state.venue-has-no-service-address": (s) => { R(s, "R1").serviceAddress = { address: "1 High St", postcode: "NN5 7EA" }; },
  "state.service-address-in-coverage": (s) => { Object.assign(s.listings[0], { deliveryMode: "home-visit", coverageMode: "postcodePrefixes", coveragePrefixes: ["NN5"] }); R(s, "R1").serviceAddress = { address: "1 High St", postcode: "NN50 1AA" }; },
  "state.refund-pending-matches-cancel": (s) => { R(s, "R3").pay = "Refund pending"; R(s, "R3").cancel = { on: at(100), refund: "approved", amount: 20 }; },

  "email.one-confirmation-per-checkout": (s) => { s.emailsSent!.push(confirmedEmail("p1@x.test", 95)); },
  "email.one-payment-email-per-payment": (s) => { for (const sec of [80, 81]) s.emailsSent!.push({ to: "p1@x.test", subject: "Payment received — Camp", kind: "payment-received", at: at(sec) }); },
  "email.no-confirmation-before-card-payment": (s) => { s.emailsSent = [confirmedEmail("p1@x.test", 10)]; },
  "email.waitlisted-never-confirmed": (s) => { s.emailsSent!.push(confirmedEmail("p2@x.test", 90)); },
};

let failed = 0;
const fail = (m: string) => { failed++; console.error("FAIL  " + m); };

if (process.argv.includes("--count")) { console.log(`RULES ${INVARIANTS.length}`); process.exit(0); }

const base = checkAll(clean());
if (base.length) fail(`clean snapshot raised ${base.length} violation(s): ${base.map((v) => v.rule + " (" + v.message + ")").join("; ")}`);

const ids = new Set(INVARIANTS.map((i) => i.id));
if (ids.size !== INVARIANTS.length) fail("duplicate rule ids");
for (const i of INVARIANTS) {
  const mutate = BREAK[i.id];
  if (!mutate) { fail(`${i.id}: no positive control in the selftest`); continue; }
  const s = structuredClone(clean());
  mutate(s);
  const got = i.check(s);
  if (!got.length) fail(`${i.id}: the deliberately broken snapshot was NOT flagged`);
  if (got.some((v) => v.rule !== i.id)) fail(`${i.id}: violations carry a different rule id`);
}
for (const id of Object.keys(BREAK)) if (!ids.has(id)) fail(`${id}: control exists for a rule that does not exist`);

// NEGATIVE controls (noise the time-window keying must NOT flag): e2e re-runs share address + listing name, so mail from a LATER booking must not count against an earlier one.
{
  const s = structuredClone(clean());
  const d = (sec: number) => new Date(Date.parse(at(0)) + sec * 1000).toISOString();
  const later = d(86_400);
  s.bookings.push(bk({ ref: "R9", email: "p1@x.test", createdAt: later, days: [], status: "Confirmed", pay: "Paid", method: "Cash" }));
  s.bookings.push(bk({ ref: "R8", email: "p2@x.test", status: "Waitlisted", pay: "Unpaid", amount: 20, received: 0, amountPaid: undefined, createdAt: at(5), kids: [{ childId: "c2", name: "B" }], childKey: "c2" }));
  s.emailsSent!.push(confirmedEmail("p1@x.test", 86_400 + 10)); // belongs to R9's checkout, not R1's
  for (const id of ["email.one-confirmation-per-checkout", "email.no-confirmation-before-card-payment"]) {
    const got = INVARIANTS.find((i) => i.id === id)!.check(s);
    if (got.length) fail(`${id}: flagged mail that belongs to a later checkout: ${got[0].message}`);
  }
  const w = structuredClone(clean()); w.bookings.push(bk({ ref: "R7", email: "p2@x.test", status: "Waitlisted", pay: "Unpaid", createdAt: d(86_400), kids: [{ childId: "c2", name: "B" }], childKey: "c2" }));
  w.emailsSent!.push(confirmedEmail("p2@x.test", 86_400 - 100)); // earlier run's mail, before this waitlisted booking existed
  if (INVARIANTS.find((i) => i.id === "email.waitlisted-never-confirmed")!.check(w).some((v) => v.refs?.includes("R7"))) fail("waitlisted-never-confirmed flagged mail from before the booking existed");
  const f = structuredClone(clean()); f.bookings.push(bk({ ref: "OS-A1", status: "Cancelled", pay: "Refunded", cancel: null, blockMissing: true }), bk({ ref: "OS-B1", method: "card", pay: "Paid", amount: 20, blockMissing: true }));
  for (const id of ["state.cancelled-has-cancel-info", "state.refs-resolve", "money.card-paid-has-payment"]) if (INVARIANTS.find((i) => i.id === id)!.check(f).some((v) => v.refs?.some((r) => r.startsWith("OS-")))) fail(`${id}: flagged an OS-A/OS-B seeded fixture`);
}

if (failed) { console.error(`INVARIANTS SELFTEST FAILED (${failed})`); process.exit(1); }
console.log(`INVARIANTS SELFTEST OK ${INVARIANTS.length} rules, each flags its broken case and the clean snapshot is silent`);
