import test from "node:test";
import assert from "node:assert/strict";
import { addonCount, addonOnDay, addonSentences, addonsByChild, bookingAddonLines, kitForDay, kitKey, parseAddonLabel } from "../../features/bookings/addons";

const structured = {
  ref: "APF-1", status: "Confirmed", child: "sally james", days: ["2026-10-28"],
  addonLines: [
    { child: "sally james", label: "tshirty (size: m)", price: 10, days: ["2026-10-28"], perDay: false, name: "tshirty", answers: [{ label: "size", value: "m" }], qty: 1 },
    { child: "paul james", label: "water bottle (red or blue: red)", price: 5, days: ["2026-10-28"], perDay: false },
  ],
  addons: ["tshirty (size: m) — £10.00", "water bottle (red or blue: red) — £5.00"],
  kids: [{ name: "sally james" }, { name: "paul james" }],
};

test("parseAddonLabel reads the name, quantity and choices out of a stored label", () => {
  assert.deepEqual(parseAddonLabel("tshirty × 2 (size: m, colour: red)"), { name: "tshirty", qty: 2, answers: [{ label: "size", value: "m" }, { label: "colour", value: "red" }], meal: false });
  const meal = parseAddonLabel("🍽 Pasta · Mon 5 Oct");
  assert.equal(meal.meal, true);
  assert.equal(meal.name, "Pasta");
});

test("bookingAddonLines: structured lines carry child, item, choice and price; labels are parsed when the structured fields are absent", () => {
  const l = bookingAddonLines(structured);
  assert.equal(l.length, 2);
  assert.equal(l[0].child, "sally james");
  assert.equal(l[0].name, "Tshirty");
  assert.equal(l[0].choice, "size: m");
  assert.equal(l[0].choiceValue, "m");
  assert.equal(l[1].child, "paul james");
  assert.equal(l[1].choiceValue, "red");
  assert.equal(l[1].price, 5);
  assert.equal(addonCount(structured), 2);
});

test("bookingAddonLines: an old booking with only the flat strings still reads (one child: the child's name)", () => {
  const l = bookingAddonLines({ child: "sally james", kids: [{ name: "sally james" }], addons: ["T-shirt (size: M) — £10.00"] });
  assert.equal(l.length, 1);
  assert.equal(l[0].child, "sally james");
  assert.equal(l[0].price, 10);
  assert.equal(l[0].choiceValue, "M");
});

test("addonsByChild groups per child in order, and addonSentences names the child and the price", () => {
  const g = addonsByChild(structured);
  assert.deepEqual(g.map((x) => x.child), ["sally james", "paul james"]);
  assert.deepEqual(addonSentences(structured), ["sally james: Tshirty (m) — £10.00", "paul james: Water bottle (red) — £5.00"]);
  assert.deepEqual(addonSentences(structured, false)[0], "sally james: Tshirty (m)");
});

test("a one-off extra is due on the FIRST day only; a per-day extra on each of its days", () => {
  const once = bookingAddonLines({ addonLines: [{ child: "a", label: "Hoodie", price: 20, days: ["2026-10-26", "2026-10-27"], perDay: false }] })[0];
  assert.equal(addonOnDay(once, "2026-10-26"), true);
  assert.equal(addonOnDay(once, "2026-10-27"), false);
  const daily = bookingAddonLines({ addonLines: [{ child: "a", label: "Snack × 2", price: 2, days: ["2026-10-26", "2026-10-27"], perDay: true }] })[0];
  assert.equal(addonOnDay(daily, "2026-10-27"), true);
  assert.equal(addonOnDay(daily, "2026-10-28"), false);
});

test("kitForDay groups by item and choice, counts plainly, skips unconfirmed bookings and carries NO money", () => {
  const second = { ...structured, ref: "APF-2", child: "marnie", kids: [{ name: "marnie" }], addonLines: [{ child: "marnie", label: "tshirty (size: m)", price: 10, days: ["2026-10-28"], perDay: false, name: "tshirty", answers: [{ label: "size", value: "m" }] }] };
  const cancelled = { ...structured, ref: "APF-3", status: "Cancelled" };
  const g = kitForDay([structured, second, cancelled], "2026-10-28");
  const tee = g.find((x) => x.name === "Tshirty" && x.choiceValue === "m")!;
  assert.equal(tee.total, 2);
  assert.deepEqual(tee.children.map((c) => c.child), ["marnie", "sally james"]);
  assert.equal(g.find((x) => x.name === "Water bottle")!.total, 1);
  assert.equal(JSON.stringify(g).includes("price"), false);
  assert.equal(kitForDay([structured], "2026-10-29").length, 0);
});

test("kitKey is stable (a tick is idempotent) and differs per child, item, choice and day", () => {
  const a = kitKey("APF-1", "sally james", "Tshirty", "m", "2026-10-28");
  assert.equal(a, kitKey("APF-1", "Sally  James", "tshirty", "M", "2026-10-28"));
  assert.notEqual(a, kitKey("APF-1", "paul james", "Tshirty", "m", "2026-10-28"));
  assert.notEqual(a, kitKey("APF-1", "sally james", "Tshirty", "l", "2026-10-28"));
  assert.notEqual(a, kitKey("APF-1", "sally james", "Tshirty", "m", "2026-10-29"));
});
