import test from "node:test";
import assert from "node:assert/strict";
import { addonSentences, addonUnits, addonWithDays, addonFlag, bookingAddonLines, daysPhrase, inheritSplitOneOffs, kitForDay, kitTally, mergeAddonLines, moveAddonDays, type KitBooking } from "../../features/bookings/addons";
import { addonFigures } from "../../features/money/addonFigures";
import { financeFigures, payIndex } from "../../features/money/financeFigures";

// How add-ons are SHOWN (pure rules; the real-API behaviour tests are tests/emulator/addon-display.test.mts).
const WEEK = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
const tshirt = (child: string, days = WEEK) => ({ child, label: "T-shirt × 1 (size: M)", price: 10, days, perDay: false, name: "T-shirt", answers: [{ label: "size", value: "M" }], qty: 1 });
const lunch = (child: string, days = WEEK, price = 3 * days.length) => ({ child, label: `Lunch × ${days.length}`, price, days, perDay: true, name: "Lunch", qty: days.length });
const bk = (ref: string, lines: unknown[], extra: Partial<KitBooking> & Record<string, unknown> = {}): KitBooking =>
  ({ ref, status: "Confirmed", days: WEEK, child: "sally", kids: [{ name: "sally" }], addonLines: lines, ...extra }) as unknown as KitBooking;

test("one rule for a one-off extra's day: the earliest day the child still holds; a date move rewrites BOTH kinds of line", () => {
  const lines = [tshirt("sally", WEEK.slice(0, 3)), lunch("sally", WEEK.slice(0, 3)), tshirt("paul", [WEEK[0]])];
  moveAddonDays(lines, "sally", WEEK[0], WEEK[4]);
  assert.deepEqual(lines[0].days, [WEEK[1], WEEK[2], WEEK[4]], "the T-shirt's days moved with the day");
  assert.deepEqual(lines[1].days, [WEEK[1], WEEK[2], WEEK[4]]);
  assert.deepEqual(lines[2].days, [WEEK[0]], "a sibling's line is not touched");
  const b = bk("APF-9", lines, { days: [WEEK[1], WEEK[2], WEEK[4]], kids: [{ name: "sally" }, { name: "paul" }] });
  assert.deepEqual(kitForDay([b], WEEK[1]).filter((g) => g.name === "T-shirt").flatMap((g) => g.children.map((c) => c.child)), ["sally"]);
  assert.equal(kitForDay([b], WEEK[2]).filter((g) => g.name === "T-shirt" && g.children.some((c) => c.child === "sally")).length, 0, "the T-shirt shows once");
});

test("a split checkout (1 + 4 days) reads as ONE extra for 5 days with the summed price; units count days", () => {
  const a = bk("W1", [lunch("sally", [WEEK[0]], 3)], { days: [WEEK[0]] });
  const c = bk("W2", [lunch("sally", WEEK.slice(1), 12)], { days: WEEK.slice(1) });
  const merged = mergeAddonLines([...bookingAddonLines(a), ...bookingAddonLines(c)]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].days.length, 5);
  assert.equal(merged[0].price, 15);
  assert.equal(addonUnits(merged[0]), 5);
  assert.deepEqual(addonSentences({ addonLines: [...(a.addonLines ?? []), ...(c.addonLines ?? [])], kids: [{ name: "sally" }] } as never), ["sally: Lunch × 5 days — £15.00"]);
  // old records: each reference stamped the whole run - only the days the booking really holds count
  const old = bk("W3", [lunch("sally", WEEK, 3)], { days: [WEEK[0]] });
  assert.equal(kitTally([old], "2026-10-01", "2026-10-31").days[WEEK[1]], undefined);
  assert.equal(addonUnits(bookingAddonLines(old)[0], old.days), 1);
});

test("daysPhrase and addonWithDays name the days", () => {
  assert.equal(daysPhrase([WEEK[0]]), "Mon 26 Oct");
  assert.equal(daysPhrase(WEEK.slice(0, 3)), "Mon 26 Oct – Wed 28 Oct");
  assert.equal(daysPhrase([WEEK[0], WEEK[2]]), "Mon 26 Oct, Wed 28 Oct");
  assert.equal(addonWithDays(bookingAddonLines(bk("W4", [lunch("sally")]))[0]), "Lunch × 5 days (Mon 26 Oct – Fri 30 Oct)");
  assert.equal(addonWithDays(bookingAddonLines(bk("W5", [tshirt("sally")]))[0]), "T-shirt (M) on Mon 26 Oct");
});

test("addonFlag: awaiting approval, not paid yet, or nothing", () => {
  assert.equal(addonFlag({ status: "Approval needed", pay: "Unpaid" }), "awaiting-approval");
  assert.equal(addonFlag({ status: "Confirmed", pay: "Unpaid" }), "not-paid");
  assert.equal(addonFlag({ status: "Confirmed", pay: "Invoice sent" }), "not-paid");
  assert.equal(addonFlag({ status: "Confirmed", pay: "Paid" }), undefined);
  assert.equal(addonFlag({ status: "Confirmed", pay: "Funded" }), undefined);
});

test("Finance add-on figures count units: 7 + 3 bottle days = 10 units, £30, one booking", () => {
  const b = bk("F1", [lunch("a", WEEK, 21), lunch("b", WEEK.slice(0, 3), 9)], { days: WEEK, kids: [{ name: "a" }, { name: "b" }], addons: ["Lunch × 5 — £21.00", "Lunch × 3 — £9.00"] });
  const f = addonFigures([b as never]);
  assert.equal(f.addonUnits, 8);
  assert.equal(f.addonRevenue, 30);
  assert.equal(f.bookingsWithAddon, 1);
  assert.equal(f.byName.get("Lunch")?.count, 8);
});

// Q08: after cancel-day a single child's kids[] carries LABEL dates ("Mon 19 Oct 2026") beside ISO cancelledDays. The remaining days must still be read in ISO.
test("Q08: a split T-shirt whose holder is emptied still lands on the first remaining ISO day of the survivor, even after a cancel-day there", () => {
  const days2 = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
  const lbl = ["Mon 19 Oct 2026", "Tue 20 Oct 2026", "Wed 21 Oct 2026", "Thu 22 Oct 2026", "Fri 23 Oct 2026", "Sat 24 Oct 2026"];
  const line = { child: "K", label: "T-shirt (Size: M)", price: 8, days: ["2026-10-18", ...days2], perDay: false, name: "T-shirt", qty: 1 };
  const mk = (cancel1: string[], cancel2: string[]) => [
    { ref: "A", status: "Confirmed", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: [] as string[], kids: [{ name: "K", dates: ["Sun 18 Oct 2026"], cancelledDays: cancel1, cancelled: true }], addonLines: [line] },
    { ref: "B", status: "Confirmed", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: days2.filter((d) => !cancel2.includes(d)), kids: [{ name: "K", dates: lbl, cancelledDays: cancel2 }], addonLines: [] },
  ];
  const moved = (cancel1: string[], cancel2: string[]) => inheritSplitOneOffs(mk(cancel1, cancel2) as never).get("B")?.[0]?.days;
  assert.equal(moved(["2026-10-18"], [])?.[0], "2026-10-19", "holder emptied");
  assert.equal(moved(["2026-10-18"], ["2026-10-19"])?.[0], "2026-10-20", "holder emptied AND the survivor's first day cancelled");
  assert.equal(moved(["2026-10-18"], ["2026-10-19", "2026-10-20"])?.[0], "2026-10-21");
});

test("F04: Finance headline figures leave out an Offered (waiting-list, not accepted) place, like Declined and Waitlisted", () => {
  const base = { payIdx: payIndex([], []), months: 1, nowMs: Date.parse("2026-10-08T12:00:00Z"), season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} };
  const mkb = (status: string) => ({ ref: status, bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status, pay: "Unpaid", amount: 69, createdAt: "2026-10-05" }) as never;
  assert.equal(financeFigures({ ...base, bookings: [mkb("Confirmed")] }).booked, 69);
  assert.equal(financeFigures({ ...base, bookings: [mkb("Confirmed"), mkb("Offered")] }).booked, 69, "Offered is not booked");
  assert.equal(financeFigures({ ...base, bookings: [mkb("Offered")] }).booked, 0);
});

// Q13 (owner decision): whether a one-off is refunded is an explicit YES/NO recorded with the refund (cancel.refundsAddons), never worked out from amounts.
// Until the cancel screens ask: refund "full" => yes; partial / none => no. Pending / approved / awaiting-transfer refunds count as completed.
test("Q13: a one-off follows its emptied holder unless the refund record says the add-on was refunded", () => {
  const days2 = ["2026-10-19", "2026-10-20"];
  const line = { child: "K", label: "T-shirt (Size: M)", price: 8, days: ["2026-10-18", ...days2], perDay: false, name: "T-shirt", qty: 1 };
  const follows = (cancel: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => inheritSplitOneOffs([
    { ref: "A", status: "Cancelled", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: [] as string[], amount: 28, cancel, ...extra, kids: [{ name: "K", dates: ["Sun 18 Oct 2026"], cancelled: true, cancelledDays: ["2026-10-18"] }], addonLines: [line] },
    { ref: "B", status: "Confirmed", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: days2, kids: [{ name: "K", dates: days2 }], addonLines: [] },
  ] as never).has("B");
  assert.equal(follows({ refund: "full", amount: 28 }), false, "full refund: the add-on is refunded by default");
  assert.equal(follows({ refund: "full", amount: 28, refundsAddons: false }), true, "full refund but the provider said NO to the add-on");
  assert.equal(follows({ refund: "pending", amount: 28 }), false, "refund pending for the whole booking counts as completed");
  assert.equal(follows({ refund: "approved", amount: 28 }), false, "refund approved / awaiting transfer for the whole booking");
  assert.equal(follows({ refund: "none" }), true, "cancelled without refund: follows");
  assert.equal(follows(null), true, "no record: follows");
  assert.equal(follows({ refund: "partial", amount: 5 }), true, "partial refund: follows");
  assert.equal(follows({ refund: "partial", amount: 27 }), true, "partial refund follows whatever the amount");
  assert.equal(follows({ refund: "partial", amount: 5, refundsAddons: true }), false, "partial refund with YES recorded: drops off");
  assert.equal(follows({ refund: "pending", amount: 5, refundOnly: true }), true, "a day-only refund is not a whole-booking refund");
  assert.equal(follows({ refund: "none", refundsAddons: true }), true, "no money moved: the answer means nothing");
  assert.equal(follows({ refund: "declined", amount: 28, refundsAddons: true }), true, "a declined refund moved no money");
  assert.equal(follows({ refund: "none" }, { refundedApproved: 20 }), true, "amounts earlier refunded do not link to the add-on");
});

// E01: Finance, its CSV export and the Dashboard agree on which bookings are SOLD: an Offered (waiting-list, not accepted) or Waitlisted place is not.
test("E01: Finance, the CSV and the Dashboard leave out the same not-yet-sold bookings (Offered, Waitlisted, Declined)", async () => {
  const { inFinance, financeFigures: ff, payIndex: pi } = await import("../../features/money/financeFigures");
  const { countsTowardBooked } = await import("../../features/bookings/sold");
  const base = { payIdx: pi([], []), months: 1, nowMs: Date.parse("2026-10-08T12:00:00Z"), season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} };
  for (const status of ["Confirmed", "Approval needed", "Offered", "Waitlisted", "Declined"]) {
    const b = { ref: status, bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status, pay: "Unpaid", amount: 69, createdAt: "2026-10-05" } as never;
    const sold = status === "Confirmed" || status === "Approval needed";
    assert.equal(inFinance(b), sold, `Finance / CSV: ${status}`);
    assert.equal(countsTowardBooked(b), sold, `Dashboard: ${status}`);
    assert.equal(ff({ ...base, bookings: [b] }).booked, sold ? 69 : 0, `booked: ${status}`);
  }
});

// Q13k: a one-day refund of £20 on the holder's only day must NOT hide the paid, unrefunded £8 T-shirt (refund amounts are not linked to add-ons).
test("Q13k: day-only refunds, wallet credit and a £28 partial follow the T-shirt unless refundsAddons true", () => {
  const days2 = ["2026-10-19", "2026-10-20"];
  const line = { child: "K", label: "T-shirt (Size: M)", price: 8, days: ["2026-10-18", ...days2], perDay: false, name: "T-shirt", qty: 1 };
  const follows = (cancel: Record<string, unknown> | null) => inheritSplitOneOffs([
    { ref: "A", status: "Confirmed", pay: "Paid", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: [] as string[], amount: 28, cancel, kids: [{ name: "K", dates: ["Sun 18 Oct 2026"], cancelled: true, cancelledDays: ["2026-10-18"] }], addonLines: [line] },
    { ref: "B", status: "Confirmed", email: "e", listingId: "l", createdAt: "x", checkoutId: "c1", days: days2, kids: [{ name: "K", dates: days2 }], addonLines: [] },
  ] as never).has("B");
  assert.equal(follows({ refund: "pending", amount: 20, refundOnly: true }), true, "cancel-day, one-day refund £20 (the Q13k scenario)");
  assert.equal(follows({ refund: "pending", amount: 28, refundOnly: true }), true, "day-only refund of £28 is still not a whole-booking refund");
  assert.equal(follows({ refund: "partial", amount: 28 }), true, "partial refund of £28 follows");
  assert.equal(follows({ refund: "pending", amount: 20, refundOnly: true, refundsAddons: true }), false, "day-only refund with YES recorded drops it");
  // WALLET CREDIT: a cancel-day / cancel-child credit to the wallet leaves no cancel record (only a refundLog line), so it never hides a one-off; a wallet credit
  // for the WHOLE booking is a cancel with refund "full"/pending and follows the same rule as money.
  assert.equal(follows(null), true, "wallet credit on a day: no cancel record, the T-shirt follows");
});
