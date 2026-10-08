import test from "node:test";
import assert from "node:assert/strict";
import { addonSentences, addonUnits, addonWithDays, addonFlag, bookingAddonLines, daysPhrase, kitForDay, kitTally, mergeAddonLines, moveAddonDays, type KitBooking } from "../../features/bookings/addons";
import { addonFigures } from "../../features/money/addonFigures";

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
