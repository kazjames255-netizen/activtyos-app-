import test from "node:test";
import assert from "node:assert/strict";
import { daysWithOrders, hasLiveAddonOrders, kitForDay, kitNamesSentence, kitReminderKey, kitTally, kitUnticked, monthGrid, monthRange, nextDayWith, sevenDaySummary, type KitBooking } from "../../features/bookings/addons";
import { bellBody, bellTitle, BELL_BODY_MAX, BELL_TITLE_MAX } from "../../server/src/lib/bellText";

// ADD-ON ORDERS (formerly "Kit to prepare"): the strip of days with orders, the name filter, the month tally, the dashboard's next-7-days card, the
// sidebar rule, repeated orders on all days, and the evening-before reminder. Quantities only: no money anywhere.

const WEEK = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
const tshirt = (child: string, days = WEEK) => ({ child, label: "T-shirt × 1 (size: M)", price: 10, days, perDay: false, name: "T-shirt", answers: [{ label: "size", value: "M" }], qty: 1 });
const lunch = (child: string, days = WEEK) => ({ child, label: `Lunch × ${days.length}`, price: 3 * days.length, days, perDay: true, name: "Lunch", qty: days.length });
const bk = (ref: string, lines: unknown[], extra: Partial<KitBooking> & Record<string, unknown> = {}): KitBooking =>
  ({ ref, status: "Confirmed", days: WEEK, child: "sally", kids: [{ name: "sally" }], addonLines: lines, ...extra }) as unknown as KitBooking;

test("a REPEATED order (an extra bought for every day) shows on ALL its days; a one-off extra shows once, on the first day", () => {
  const b = bk("APF-1", [tshirt("sally"), lunch("sally")]);
  for (const d of WEEK) {
    const names = kitForDay([b], d).map((g) => g.name);
    assert.ok(names.includes("Lunch"), `lunch missing on ${d}`);
    assert.equal(names.includes("T-shirt"), d === WEEK[0], `t-shirt on ${d}`);
  }
  const t = kitTally([b], "2026-10-01", "2026-10-31");
  for (const d of WEEK) assert.equal(t.days[d].byName.Lunch, 1);
  assert.equal(t.days[WEEK[0]].items, 2);
  assert.equal(t.days[WEEK[1]].items, 1);
  assert.deepEqual(t.names, ["Lunch", "T-shirt"]);
});

test("two children on different days: each child's extras land on their own days", () => {
  const b = bk("APF-2", [lunch("sally", ["2026-10-26", "2026-10-27"]), lunch("paul", ["2026-10-28"]), tshirt("paul", ["2026-10-28", "2026-10-29"])], { kids: [{ name: "sally" }, { name: "paul" }] });
  const mon = kitForDay([b], "2026-10-26")[0].children.map((c) => c.child);
  assert.deepEqual(mon, ["sally"]);
  const wed = kitForDay([b], "2026-10-28").flatMap((g) => g.children.map((c) => `${g.name}:${c.child}`)).sort();
  assert.deepEqual(wed, ["Lunch:paul", "T-shirt:paul"]);
  assert.equal(kitForDay([b], "2026-10-29").length, 0);
});

test("a cancelled DAY (or a cancelled child) removes that child's extras; a one-off extra moves to the first day they still attend", () => {
  const b = bk("APF-3", [tshirt("sally"), lunch("sally")], { kids: [{ name: "sally", cancelledDays: ["2026-10-26", "2026-10-28"] }] });
  assert.equal(kitForDay([b], "2026-10-26").length, 0, "monday released: nothing");
  assert.deepEqual(kitForDay([b], "2026-10-27").map((g) => g.name).sort(), ["Lunch", "T-shirt"], "the T-shirt moves to Tuesday");
  assert.deepEqual(kitForDay([b], "2026-10-28").map((g) => g.name), [], "wednesday released");
  const gone = bk("APF-4", [tshirt("sally"), lunch("sally")], { kids: [{ name: "sally", cancelled: true }] });
  assert.equal(kitTally([gone], "2026-10-01", "2026-10-31").names.length, 0);
  assert.equal(hasLiveAddonOrders([gone], "2026-10-01"), false);
});

test("an approved extra CANCEL (the line is gone) disappears; a pending request leaves a marker", () => {
  const withReq = bk("APF-5", [tshirt("sally")], { addonRequests: [{ key: "sally|T-shirt × 1 (size: M)", kind: "cancel", status: "pending" }] });
  assert.equal(kitForDay([withReq], WEEK[0])[0].children[0].pending, "cancel");
  const approved = bk("APF-5", []);
  assert.equal(kitForDay([approved], WEEK[0]).length, 0);
  assert.equal(Object.keys(kitTally([approved], "2026-10-01", "2026-10-31").days).length, 0);
});

test("Confirmed and awaiting-approval bookings show (labelled when unpaid / awaiting); waitlisted, cancelled, declined and offered never do", () => {
  for (const status of ["Waitlisted", "Cancelled", "Declined", "Offered"]) {
    const b = bk("APF-6", [tshirt("sally")], { status });
    assert.equal(kitForDay([b], WEEK[0]).length, 0, status);
    assert.equal(hasLiveAddonOrders([b], "2026-10-01"), false, status);
  }
  const waiting = bk("APF-6a", [tshirt("sally")], { status: "Approval needed" });
  assert.equal(kitForDay([waiting], WEEK[0])[0].children[0].flag, "awaiting-approval");
  const unpaid = bk("APF-6b", [tshirt("sally")], { pay: "Unpaid" });
  assert.equal(kitForDay([unpaid], WEEK[0])[0].children[0].flag, "not-paid");
  assert.equal(kitForDay([bk("APF-6c", [tshirt("sally")], { pay: "Paid" })], WEEK[0])[0].children[0].flag, undefined);
  assert.equal(hasLiveAddonOrders([waiting], "2026-10-01"), true);
});

test("days with orders (the strip) are sorted, and the arrows jump to the previous / next day WITH orders", () => {
  const t = kitTally([bk("A", [lunch("sally", ["2026-10-30", "2026-10-26"])]), bk("B", [tshirt("sally", ["2026-11-02"])], { days: ["2026-11-02"] })], "2026-10-01", "2026-11-30");
  const list = daysWithOrders(t);
  assert.deepEqual(list.map((d) => d.date), ["2026-10-26", "2026-10-30", "2026-11-02"]);
  const dates = list.map((d) => d.date);
  assert.equal(nextDayWith(dates, "2026-10-26", 1), "2026-10-30");
  assert.equal(nextDayWith(dates, "2026-10-27", 1), "2026-10-30", "from a day without orders");
  assert.equal(nextDayWith(dates, "2026-10-30", -1), "2026-10-26");
  assert.equal(nextDayWith(dates, "2026-11-02", 1), null);
  assert.equal(nextDayWith(dates, "2026-10-26", -1), null);
});

test("filter by add-on name: the day view and the tally keep only that add-on (case-insensitive)", () => {
  const b = bk("APF-7", [tshirt("sally"), lunch("sally")]);
  assert.deepEqual(kitForDay([b], WEEK[0], { name: "t-shirt" }).map((g) => g.name), ["T-shirt"]);
  const t = kitTally([b], "2026-10-01", "2026-10-31", { name: "Lunch" });
  assert.equal(t.days[WEEK[1]].items, 1);
  assert.deepEqual(t.names, ["Lunch", "T-shirt"], "the filter list still offers every add-on");
  assert.equal(Object.values(t.days).reduce((n, d) => n + d.items, 0), 5);
});

test("month tally: counts per day add up to the month total, grid is Monday-first with padding, month range is exact", () => {
  const b = bk("APF-8", [tshirt("sally"), lunch("sally")]);
  const r = monthRange(2026, 9);
  assert.deepEqual(r, { from: "2026-10-01", to: "2026-10-31" });
  const t = kitTally([b], r.from, r.to);
  const total = Object.values(t.days).reduce((n, d) => n + d.items, 0);
  assert.equal(total, 6);
  const grid = monthGrid(2026, 9);
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(grid.flat().filter(Boolean).length, 31);
  assert.deepEqual(grid[0].slice(0, 4), [null, null, null, "2026-10-01"], "1 Oct 2026 is a Thursday");
  assert.equal(grid.flat().filter((d) => d && t.days[d]).length, 5);
});

test("dashboard card: today + next 6 days, per-add-on counts biggest first, a week total", () => {
  const b = bk("APF-9", [lunch("sally", ["2026-10-26", "2026-10-27"]), tshirt("sally", ["2026-10-26"]), lunch("paul", ["2026-10-26"])], { kids: [{ name: "sally" }, { name: "paul" }] });
  const s = sevenDaySummary(kitTally([b], "2026-10-26", "2026-11-01"), "2026-10-26");
  assert.equal(s.rows.length, 7);
  assert.deepEqual(s.rows.map((r) => r.date)[6], "2026-11-01");
  assert.equal(s.rows[0].items, 3);
  assert.deepEqual(s.rows[0].byName, [{ name: "Lunch", count: 2 }, { name: "T-shirt", count: 1 }]);
  assert.equal(s.rows[1].items, 1);
  assert.equal(s.rows[2].items, 0);
  assert.equal(s.total, 4);
});

test("sidebar / dashboard rule: live only while an extra still has a day to prepare today or later", () => {
  const b = bk("APF-10", [tshirt("sally", ["2026-10-26"])], { days: ["2026-10-26"] });
  assert.equal(hasLiveAddonOrders([b], "2026-10-26"), true);
  assert.equal(hasLiveAddonOrders([b], "2026-10-27"), false, "all past");
  assert.equal(hasLiveAddonOrders([bk("APF-11", [lunch("sally")])], "2026-10-30"), true, "a lunch still to come on Friday");
  assert.equal(hasLiveAddonOrders([bk("APF-12", [])], "2026-10-01"), false, "no extras at all");
  assert.equal(hasLiveAddonOrders([], "2026-10-01"), false);
});

test("evening-before reminder: counts only what is NOT ticked yet, once per provider per day, and the bell is short", () => {
  const b = bk("APF-13", [tshirt("sally"), lunch("sally")], { days: ["2026-10-26"] });
  const all = kitUnticked([b], "2026-10-26", new Set());
  assert.equal(all.items, 2);
  const key = kitForDay([b], "2026-10-26").find((g) => g.name === "Lunch")!.children[0].key;
  const left = kitUnticked([b], "2026-10-26", new Set([key]));
  assert.equal(left.items, 1);
  assert.deepEqual(left.byName, { "T-shirt": 1 });
  assert.equal(kitUnticked([b], "2026-10-26", new Set(kitForDay([b], "2026-10-26").flatMap((g) => g.children.map((c) => c.key)))).items, 0, "everything ticked: no reminder");
  assert.equal(kitReminderKey("t1", "2026-10-26"), kitReminderKey("t1", "2026-10-26"));
  assert.notEqual(kitReminderKey("t1", "2026-10-26"), kitReminderKey("t1", "2026-10-27"));
  assert.notEqual(kitReminderKey("t1", "2026-10-26"), kitReminderKey("t2", "2026-10-26"));
  assert.equal(kitNamesSentence({ Lunch: 2, "T-shirt": 3 }), "T-shirt ×3 · Lunch ×2");
  const title = bellTitle("addon-orders", "Mon 26 Oct");
  assert.equal(title, "Add-on orders · Mon 26 Oct");
  assert.ok(title.length <= BELL_TITLE_MAX);
  const body = bellBody(["12 items", "T-shirt ×7", "Water bottle ×5", "Lunch ×3"]);
  assert.ok(body.length <= BELL_BODY_MAX, body);
  assert.match(body, /^12 items · T-shirt ×7/);
  assert.doesNotMatch(body, /[()]|—/);
});
