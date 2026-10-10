// Privacy fixes (10 Oct, areas PV01/PV04, PV39, PV42): the pure parts. No network, no Firestore.
import test from "node:test";
import assert from "node:assert/strict";
import { emailVariants, normEmail } from "../server/src/lib/emailCase";
import { badPathSegment, MAX_SEGMENT } from "../server/src/lib/idGuard";
import { suppressSplit, type GenderSplit } from "../features/money/genderSplit";

test("emailVariants: lower case first, the usual mixed-case spellings, bounded for one `in` query", () => {
  const v = emailVariants("pa-x1@emu.test");
  assert.equal(v[0], "pa-x1@emu.test");
  for (const stored of ["Pa-x1@Emu.Test", "Pa-X1@Emu.Test", "PA-X1@EMU.TEST", "Pa-x1@emu.test", "pa-x1@Emu.Test"]) assert.ok(v.includes(stored), `${stored} must be matched`);
  assert.ok(v.length <= 30, "Firestore `in` allows 30 values");
  assert.deepEqual(emailVariants("  Pa@Example.com "), emailVariants("pa@example.com"));
  assert.deepEqual(emailVariants(""), []);
  assert.equal(normEmail(" Pa@Example.COM "), "pa@example.com");
});

test("idGuard: ids that cannot be real ids are refused, real ones are not", () => {
  assert.equal(badPathSegment("/api/my/bookings/" + "x".repeat(2000) + "/cancel"), true);
  assert.equal(badPathSegment("/api/my/bookings/" + "x".repeat(MAX_SEGMENT + 1)), true);
  assert.equal(badPathSegment("/api/my/bookings/a%00b/cancel"), true);
  assert.equal(badPathSegment("/api/my/bookings/a%5Cb/cancel"), true);
  assert.equal(badPathSegment("/api/my/bookings/%E0%A4%A/cancel"), true); // broken %-escape
  assert.equal(badPathSegment("/api/my/bookings/PV-A1_2/cancel"), false);
  assert.equal(badPathSegment("/api/my/bookings/" + "x".repeat(MAX_SEGMENT)), false);
  assert.equal(badPathSegment("/api/my/children/a%2Fb"), false); // the existing Firestore-path handling answers this one (404)
});

const split = (o: Partial<GenderSplit>): GenderSplit => ({ boy: 0, girl: 0, other: 0, na: 0, unknown: 0, known: 0, total: 0, ...o });
const withTotals = (o: Partial<GenderSplit>) => { const s = split(o); s.known = s.boy + s.girl + s.other + s.na; s.total = s.known + s.unknown; return s; };

test("gender split: every cell of 1-4 is hidden, and a lone hidden cell cannot be got back by subtraction", () => {
  const a = suppressSplit(withTotals({ boy: 40, girl: 3, other: 12 }));
  assert.equal(a.cells.girl, null);
  assert.equal(a.cells.other, null, "complement: the smallest other non-zero cell is hidden too");
  assert.equal(a.cells.boy, 40);
  assert.equal(a.known, null);
  assert.equal(a.total, null);
  assert.equal(a.ratio, null);
  const b = suppressSplit(withTotals({ boy: 20, girl: 30, other: 4, na: 6 }));
  assert.deepEqual([b.cells.other, b.cells.na], [null, null], "other hidden, so its complement (the smallest remaining cell, na) is hidden as well");
  for (const s of [a, b]) for (const v of Object.values(s.cells)) assert.ok(v === null || v >= 5 || v === 0, `shown cell ${v} must be 0 or >= 5`);
});

test("gender split: 0 stays 0, big cells are shown with their totals and ratio", () => {
  const s = suppressSplit(withTotals({ boy: 30, girl: 20, unknown: 4 }));
  assert.deepEqual(s.cells, { boy: 30, girl: 20, other: 0, na: 0 });
  assert.equal(s.known, 50);
  assert.equal(s.total, 54);
  assert.equal(s.ratio, "60:40");
  assert.deepEqual(s.suppressed, []);
  const none = suppressSplit(split({}));
  assert.equal(none.ratio, null);
});

test("gender split: exactly five is shown, four is not", () => {
  assert.equal(suppressSplit(withTotals({ boy: 5, girl: 5 })).cells.boy, 5);
  assert.equal(suppressSplit(withTotals({ boy: 4, girl: 9 })).cells.boy, null);
});
