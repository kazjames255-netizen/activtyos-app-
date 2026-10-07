import test from "node:test";
import assert from "node:assert/strict";
import { toGender } from "../../lib/childGender";
import { attachGender } from "../../server/src/lib/childGender";
import { genderSplit } from "../../features/money/genderSplit";

// Insights "Gender split" (7 Oct): the families record a child's gender on the child's own record; the provider's customer list carries it
// across (booked children only), and the analytics counts each CHILD once. It is never guessed from a name.

test("toGender: any stored spelling maps to one value; junk and blanks map to nothing", () => {
  assert.equal(toGender("boy"), "boy");
  assert.equal(toGender("Boy"), "boy");
  assert.equal(toGender("Girl"), "girl");
  assert.equal(toGender("Non-binary or other"), "other");
  assert.equal(toGender("other"), "other");
  assert.equal(toGender("Prefer not to say"), "na");
  assert.equal(toGender("na"), "na");
  assert.equal(toGender(""), "");
  assert.equal(toGender(undefined), "");
  assert.equal(toGender("banana"), "");
});

test("attachGender: copies the family's gender onto the customer's child by id, then by name, and never overwrites one already there", () => {
  const kids = [{ name: "Sally James", childId: "c1" }, { name: "Paul James" }, { name: "Jack", sex: "boy" }, { name: "Mia" }];
  const recs = [{ id: "c1", name: "Sally James", sex: "girl" }, { id: "c2", name: "Paul James", sex: "other" }, { id: "c3", name: "Jack", sex: "girl" }];
  const out = attachGender(kids, recs);
  assert.equal(out[0].sex, "girl");
  assert.equal(out[1].sex, "other"); // by name (no id on the entry)
  assert.equal(out[2].sex, "boy"); // already set: kept
  assert.equal(out[3].sex, undefined); // no record: nothing invented
});

test("attachGender: a record with no gender attaches nothing", () => {
  const out = attachGender([{ name: "Sam" }], [{ id: "x", name: "Sam" }]);
  assert.equal(out[0].sex, undefined);
});

test("genderSplit: each child is counted once for the period however many bookings they have", () => {
  const bookings = [
    { kids: [{ name: "Sally James", childId: "c1" }, { name: "Paul James", childId: "c2" }] },
    { kids: [{ name: "Sally James", childId: "c1" }] },
    { child: "Sally James", childId: "c1" },
  ] as never[];
  const s = genderSplit(bookings, [{ id: "c1", name: "Sally James", sex: "girl" }, { id: "c2", name: "Paul James", sex: "boy" }]);
  assert.equal(s.total, 2);
  assert.equal(s.girl, 1);
  assert.equal(s.boy, 1);
  assert.equal(s.known, 2);
});

test("genderSplit: prefer-not-to-say is recorded (known) but kept separate; no record = unknown", () => {
  const bookings = [{ kids: [{ name: "A", childId: "a" }, { name: "B", childId: "b" }, { name: "C", childId: "c" }, { name: "D", childId: "d" }] }] as never[];
  const s = genderSplit(bookings, [{ id: "a", sex: "other" }, { id: "b", sex: "na" }, { id: "c", sex: "girl" }]);
  assert.deepEqual({ boy: s.boy, girl: s.girl, other: s.other, na: s.na, unknown: s.unknown, known: s.known, total: s.total }, { boy: 0, girl: 1, other: 1, na: 1, unknown: 1, known: 3, total: 4 });
});

test("genderSplit: gender is never inferred from a name", () => {
  const s = genderSplit([{ child: "Sally" }, { child: "Paul" }] as never[], []);
  assert.equal(s.known, 0);
  assert.equal(s.unknown, 2);
});

test("genderSplit: the same child seen once with an id and once by name only is still one child", () => {
  const bookings = [{ kids: [{ name: "Sally James", childId: "c1" }] }, { child: "sally james" }] as never[];
  const s = genderSplit(bookings, [{ id: "c1", name: "Sally James", sex: "girl" }]);
  assert.equal(s.total, 1);
  assert.equal(s.girl, 1);
});

test("genderSplit: capitalised stored values (old custom options) still count", () => {
  const s = genderSplit([{ kids: [{ name: "Tom", childId: "t" }] }] as never[], [{ id: "t", sex: "Boy" }]);
  assert.equal(s.boy, 1);
});
