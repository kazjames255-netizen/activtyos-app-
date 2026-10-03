/**
 * Date-change (amend) rules + pass-sale rules (pure: no network, no Firestore).
 *
 * Run:   npm run test:amend
 *        (= tsx --test tests/amend-passes.test.mts)
 *
 * Oracle: lib/testTracker/catalogue.ts  AM-001..AM-012 (date changes), PP-001..PP-018 (passes/add-ons).
 * Covers: server/src/lib/dateChange.ts (amendMoveError, applyMoveApprove — extracted from routes/my.ts + bookings.ts),
 *         features/bookings/mutations.ts applyRowAction move-approve / move-deny, helpers.needsDecision,
 *         features/listings/passRules.ts (effectiveRule, pickDaySelection — extracted from booking.ts useBooking),
 *         server/src/lib/bundlePricing.ts (timing/period price), server/src/lib/addonPricing.ts (priceAddon — extracted from routes/my.ts).
 *
 * The "todo" tests at the bottom document Setup > Amending dates rules that the server does NOT enforce
 * (notice hours, fee, max moves, no-cheaper, self-service). They are reported as TODO, not failures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { amendMoveError, applyMoveApprove, isoOfLabel } from "../server/src/lib/dateChange";
import { daysHaveSpace, type BlockDoc } from "../server/src/lib/blockDomain";
import { applyRowAction } from "../features/bookings/mutations";
import { needsDecision } from "../features/bookings/helpers";
import { effectiveRule, pickDaySelection, weekMaxAndRunTotal, type PassWeek } from "../features/listings/passRules";
import { groupWeeks } from "../features/listings/format";
import { resolveBundlePricing, type BundleDoc, type PassDoc, type PeriodDoc } from "../server/src/lib/bundlePricing";
import { priceAddon, type LibAddonDef } from "../server/src/lib/addonPricing";
import type { Booking } from "../features/bookings/types";

const TODAY = "2026-10-03"; // Saturday
const bk = (o: Record<string, unknown>) => ({ ref: "R1", bid: "b", status: "Confirmed", pay: "Paid", amount: 54, ...o }) as unknown as Booking;

// ───────────────────────── (A) AM-*: date-change requests ─────────────────────────

const ctx = (o: Partial<Parameters<typeof amendMoveError>[2]> = {}) => ({
  onBooking: new Set(["2026-10-05", "2026-10-06", "2026-10-07"]),
  todayUk: TODAY,
  kidCount: 1,
  sessionDates: new Set(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-12", "2026-10-13"]),
  ...o,
});
const mv = (from: string, to: string) => ({ from, to });

test("AM-001: a valid future move to a running, non-full date is accepted", () => {
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-12"), [mv("2026-10-05", "2026-10-12")], ctx()), null);
});

test("AM-001: undated 'preferred date' shape (from='') is accepted when the day runs", () => {
  assert.equal(amendMoveError(mv("", "2026-10-13"), [mv("", "2026-10-13")], ctx()), null);
});

test("AM-001: refuses a 'from' that isn't on the booking, same date, and past dates", () => {
  assert.match(amendMoveError(mv("2026-10-08", "2026-10-12"), [], ctx())!, /isn't on this booking/);
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-05"), [], ctx()), "That's the same date");
  const past = ctx({ todayUk: "2026-10-06", onBooking: new Set(["2026-10-05", "2026-10-07"]) });
  assert.match(amendMoveError(mv("2026-10-05", "2026-10-12"), [], past)!, /has already passed/, "moving OFF a past day");
  assert.match(amendMoveError(mv("2026-10-07", "2026-10-05"), [], past)!, /has already passed/, "moving ONTO a past day");
});

test("AM-001: today itself is still movable to (boundary: only strictly-earlier days are 'passed')", () => {
  const c = ctx({ todayUk: "2026-10-12", onBooking: new Set(["2026-10-13"]), sessionDates: new Set(["2026-10-12", "2026-10-13"]) });
  assert.equal(amendMoveError(mv("2026-10-13", "2026-10-12"), [], c), null);
});

test("AM-001: refuses moving onto a day the booking already covers (single child), unless that day is itself being moved (swap)", () => {
  assert.match(amendMoveError(mv("2026-10-05", "2026-10-06"), [mv("2026-10-05", "2026-10-06")], ctx())!, /already covers/);
  const swap = [mv("2026-10-05", "2026-10-06"), mv("2026-10-06", "2026-10-05")];
  assert.equal(amendMoveError(swap[0], swap, ctx()), null, "swap of two own days is allowed");
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-06"), [], ctx({ kidCount: 2 })), null, "multi-child booking skips the check");
});

test("AM-001: refuses a date the activity doesn't run on", () => {
  assert.match(amendMoveError(mv("2026-10-05", "2026-10-14"), [], ctx())!, /doesn't run on/);
});

test("AM-006: move to a FULL date refused with '<date> is full'", () => {
  const block = { capacity: 2, dayCounts: { "2026-10-12": 2, "2026-10-13": 1 }, sessions: [] } as unknown as BlockDoc;
  const dayFull = (d: string) => !daysHaveSpace(block, { [d]: 1 }).fits;
  const c = ctx({ dayFull });
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-12"), [], c), "Mon 12 Oct is full");
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-13"), [], c), null, "13th has 1 place left");
});

test("AM-006: a full-listing-scope block (no dayFull check) lets the move through the day check", () => {
  assert.equal(amendMoveError(mv("2026-10-05", "2026-10-12"), [], ctx({ dayFull: undefined })), null);
});

const multi = () => bk({
  days: ["2026-10-05", "2026-10-06"],
  kids: [{ name: "Ava", dates: ["2026-10-05", "2026-10-06"] }, { name: "Ben", dates: ["2026-10-05", "2026-10-06"] }],
  dateChangeRequest: {
    status: "pending",
    moves: [
      { childName: "Ava", from: "2026-10-05", to: "2026-10-12" },
      { childName: "Ben", from: "2026-10-06", to: "2026-10-13" },
    ],
  },
});

test("AM-002: approve (all) moves every requested date, marks approved, stamps note", () => {
  const b = multi();
  applyMoveApprove(b);
  assert.deepEqual(b.kids![0].dates, ["2026-10-12", "2026-10-06"]);
  assert.deepEqual(b.kids![1].dates, ["2026-10-05", "2026-10-13"]);
  assert.equal(b.dateChangeRequest!.status, "approved");
  assert.ok(b.dateChangeRequest!.moves.every((m) => m.approved === true));
  assert.ok(b.dateChangeRequest!.resolvedAt);
  assert.equal(b.note, "Date change approved.");
});

test("AM-002: approving keeps kids[].dates and .days in sync and refreshes the headline range", () => {
  const b = multi();
  applyMoveApprove(b);
  assert.deepEqual(b.kids![0].days, b.kids![0].dates);
  assert.equal(b.dates, "5 Oct 2026 – 13 Oct 2026");
});

test("AM-003: partial approval applies ONLY the ticked move; the other is recorded approved=false", () => {
  const b = multi();
  applyMoveApprove(b, [0], "Ben's day is full of trips");
  assert.deepEqual(b.kids![0].dates, ["2026-10-12", "2026-10-06"], "Ava moved");
  assert.deepEqual(b.kids![1].dates, ["2026-10-05", "2026-10-06"], "Ben unchanged");
  assert.equal(b.dateChangeRequest!.moves[0].approved, true);
  assert.equal(b.dateChangeRequest!.moves[1].approved, false);
  assert.equal(b.dateChangeRequest!.reason, "Ben's day is full of trips");
  assert.equal(b.note, "Date change partly approved.");
  assert.equal(b.dateChangeRequest!.status, "approved", "request is resolved even when partial");
});

test("AM-003: approving with an empty index list moves nothing", () => {
  const b = multi();
  applyMoveApprove(b, []);
  assert.deepEqual(b.kids![0].dates, ["2026-10-05", "2026-10-06"]);
  assert.ok(b.dateChangeRequest!.moves.every((m) => m.approved === false));
});

test("AM-002: booking with no kids[] moves b.days; session-only bookings move the label and keep the time suffix", () => {
  const a = bk({ days: ["2026-10-05"], dateChangeRequest: { status: "pending", moves: [{ from: "2026-10-05", to: "2026-10-12" }] } });
  applyMoveApprove(a);
  assert.deepEqual(a.days, ["2026-10-12"]);
  const s = bk({ sessions: ["Mon 5 Oct 2026 · 09:00 – 15:30"], dateChangeRequest: { status: "pending", moves: [{ from: "2026-10-05", to: "2026-10-12" }] } });
  applyMoveApprove(s);
  assert.match(s.sessions![0], /12 Oct 2026 · 09:00 – 15:30$/);
  assert.equal(isoOfLabel("Mon 12 Oct 2026 · 09:00"), "2026-10-12");
  assert.equal(isoOfLabel("no date here"), null);
});

test("AM-002: no pending request = no-op", () => {
  const b = bk({ days: ["2026-10-05"] });
  applyMoveApprove(b);
  assert.deepEqual(b.days, ["2026-10-05"]);
  assert.equal(b.note, undefined);
});

test("AM-004: decline (operator's optimistic action) leaves dates unchanged and marks denied", () => {
  const b = multi();
  applyRowAction(b, "move-deny");
  assert.equal(b.dateChangeRequest!.status, "denied");
  assert.deepEqual(b.kids![0].dates, ["2026-10-05", "2026-10-06"]);
  assert.equal(b.note, "Date change declined.");
});

test("AM-002 (client applyRowAction move-approve, REAL BUG: matches moves by date only, ignoring the child)", () => {
  const b = multi();
  applyRowAction(b, "move-approve");
  assert.deepEqual(b.kids![0].dates, ["2026-10-12", "2026-10-06"]);
  assert.equal(b.dateChangeRequest!.status, "approved");
});

test("AM-001/004/005: needsDecision is true only while a request is pending (denied, approved and withdrawn=null are not)", () => {
  assert.equal(needsDecision(multi()), true);
  const d = multi(); applyRowAction(d, "move-deny");
  assert.equal(needsDecision(d), false, "declined");
  const a = multi(); applyMoveApprove(a);
  assert.equal(needsDecision(a), false, "approved");
  const w = multi(); w.dateChangeRequest = null; // exactly what POST /amend/withdraw writes
  assert.equal(needsDecision(w), false, "withdrawn");
});

// ───────────────────────── (B) PP-*: pass sale rules ─────────────────────────

// Two full weeks Mon-Fri: 5-9 Oct and 12-16 Oct, plus a 3rd week of 3 days.
const D = (iso: string) => iso;
const W1 = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
const W2 = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
const weeks: PassWeek[] = groupWeeks([...W1, ...W2]);
const { weekMax, runTotal } = weekMaxAndRunTotal(weeks, []);
const noPast = () => false;
const click = (sel: string[], iso: string, need: number, rule: "week" | "listing" | "blocks", extra: { datesOff?: string[]; past?: (i: string) => boolean; isSingle?: boolean } = {}) =>
  pickDaySelection({
    iso, weekMon: weeks.find((w) => w.days.includes(iso))!.mon, sel, need, rule,
    isSingle: extra.isSingle ?? need === 1, weeks, weekMax, datesOff: extra.datesOff ?? [], past: extra.past ?? noPast,
  });
const clicks = (isos: string[], need: number, rule: "week" | "listing" | "blocks", extra = {}) =>
  isos.reduce<string[]>((s, i) => click(s, i, need, rule, extra), []);

test("groupWeeks/weekMaxAndRunTotal basics", () => {
  assert.equal(weeks.length, 2);
  assert.deepEqual({ weekMax, runTotal }, { weekMax: 5, runTotal: 10 });
  assert.deepEqual(weekMaxAndRunTotal(weeks, [W1[0], W1[1]]), { weekMax: 5, runTotal: 8 }, "datesOff excluded");
});

test("PP-001: 'Any n days in a week' (3 days) — can tick 3 in week 1 but a 4th is ignored", () => {
  const three = clicks([W1[0], W1[2], W1[4]], 3, "week");
  assert.deepEqual(three, [W1[0], W1[2], W1[4]]);
  assert.deepEqual(click(three, W1[1], 3, "week"), three, "4th day refused");
});

test("PP-001: 'Any n days in a week' — a day in a DIFFERENT week is refused once one is picked", () => {
  const s = clicks([W1[0]], 3, "week");
  assert.deepEqual(click(s, W2[0], 3, "week"), s);
});

test("PP-001: clicking a ticked day unticks it", () => {
  assert.deepEqual(click([W1[0], W1[1]], W1[0], 3, "week"), [W1[1]]);
});

test("PP-001: a 5-day 'week' pass on a 5-day week takes the entire week from any click, and a 2nd click clears it", () => {
  const s = click([], W1[2], 5, "week");
  assert.deepEqual(s, W1);
  assert.deepEqual(click(s, W1[2], 5, "week"), []);
});

test("PP-002: 'Any n days, any week' — ticks across two weeks up to the pass number, then refuses more", () => {
  const s = clicks([W1[0], W1[1], W2[0]], 3, "listing");
  assert.deepEqual(s, [W1[0], W1[1], W2[0]]);
  assert.deepEqual(click(s, W2[1], 3, "listing"), s, "4th refused");
});

test("PP-002: pass covering the whole run (10 of 10 days) takes all days on any click", () => {
  assert.deepEqual(click([], W2[3], 10, "listing"), [...W1, ...W2]);
});

test("PP-003: 'Whole n-day block' (5 days) — one click selects that week's 5 days; click again clears", () => {
  const s = click([], W2[2], 5, "blocks");
  assert.deepEqual(s, W2);
  assert.deepEqual(click(s, W2[0], 5, "blocks"), []);
});

test("PP-003: whole-run block (10 days > week) takes every day in the run", () => {
  assert.deepEqual(click([], W1[0], 10, "blocks"), [...W1, ...W2]);
});

test("PP-003: block rule that is neither a week nor the whole run falls back to 'any n across the listing'", () => {
  assert.equal(effectiveRule("blocks", 3, weekMax, runTotal), "listing");
  assert.equal(effectiveRule("blocks", 5, weekMax, runTotal), "blocks");
  assert.equal(effectiveRule("blocks", 10, weekMax, runTotal), "blocks");
});

test("PP-001/002: a 'week' pass longer than any week falls back to 'listing'; otherwise rule unchanged", () => {
  assert.equal(effectiveRule("week", 6, weekMax, runTotal), "listing");
  assert.equal(effectiveRule("week", 5, weekMax, runTotal), "week");
  assert.equal(effectiveRule("listing", 99, weekMax, runTotal), "listing");
  assert.equal(effectiveRule("week", 6, 0, 0), "week", "no weeks known yet — don't change the rule");
});

test("PP-001: single-day pass lets you tick as many days as you like (each becomes its own 1-day pass)", () => {
  const s = clicks([W1[0], W1[1], W2[4]], 1, "week", { isSingle: true });
  assert.equal(s.length, 3);
});

test("PP-005: past days can't be picked by parents; unaffected days still can", () => {
  const past = (i: string) => i < "2026-10-07";
  assert.deepEqual(click([], W1[0], 3, "week", { past }), [], "5 Oct is past");
  assert.deepEqual(click([], W1[2], 3, "week", { past }), [W1[2]]);
});

test("PP-005: whole-block selection skips past days (so a part-gone week can't be 'bought whole')", () => {
  const past = (i: string) => i < "2026-10-07";
  assert.deepEqual(click([], W1[3], 5, "blocks", { past }), [W1[2], W1[3], W1[4]]);
});

test("PP-005: days switched off (datesOff) can never be picked", () => {
  assert.deepEqual(click([], W1[1], 3, "week", { datesOff: [W1[1]] }), []);
});

// Pricing: PP-004 / PP-013 / PP-017
const pass = (name: string, days: number): PassDoc & { id: string } => ({ id: name, tenantId: "t", name, days });
const period = (id: string, start: string, finish: string): PeriodDoc & { id: string } => ({ id, tenantId: "t", title: id, start, finish });
const bundle = (o: Partial<BundleDoc>): BundleDoc => ({
  tenantId: "t", name: "B", periodIds: ["full"], passIds: ["5 days", "3 days", "1 day"], listingIds: [], order: 0,
  archived: false, priced: true, masterPrice: 90, calcOn: true, passFlat: {}, passMode: {}, periodPrice: {}, ...o,
});
const passes = new Map([pass("5 days", 5), pass("3 days", 3), pass("1 day", 1)].map((p) => [p.id, p]));

test("PP-001/013: derived pass prices — master is the full price; '3 days' = £54 (3 x £18/day)", () => {
  const r = resolveBundlePricing(bundle({}), passes, new Map([["full", period("full", "09:00", "15:00")]]));
  assert.deepEqual(r.passes.map((p) => [p.name, p.price]), [["5 days", 90], ["3 days", 54], ["1 day", 18]]);
  assert.equal(r.perDay, 18);
});

test("PP-002: pass price is independent of which weeks are chosen (price is per pass, no date input)", () => {
  const a = resolveBundlePricing(bundle({}), passes, new Map([["full", period("full", "09:00", "15:00")]]));
  const b = resolveBundlePricing(bundle({}), passes, new Map([["full", period("full", "09:00", "15:00")]]));
  assert.deepEqual(a, b);
});

test("PP-004: timing price — shorter period costs proportionally less; an explicit periodPrice override wins", () => {
  const periods = new Map([["full", period("full", "08:00", "18:00")], ["half", period("half", "08:00", "13:00")]]);
  const calc = resolveBundlePricing(bundle({ periodIds: ["full", "half"] }), passes, periods);
  assert.equal(calc.timings["5 days_full"], 90);
  assert.equal(calc.timings["5 days_half"], 45, "5h of 10h");
  assert.equal(calc.timings["3 days_half"], 27);
  const over = resolveBundlePricing(bundle({ periodIds: ["full", "half"], periodPrice: { "3 days_half": 30 } }), passes, periods);
  assert.equal(over.timings["3 days_half"], 30, "override beats the formula");
  assert.equal(over.timings["5 days_half"], 45, "other timings unaffected");
});

test("PP-004: with calc off, a timing with no explicit price is £0 and flat pass prices are used", () => {
  const r = resolveBundlePricing(
    bundle({ calcOn: false, passFlat: { "3 days": 50, "1 day": 20 }, periodPrice: { "5 days_full": 90 } }),
    passes, new Map([["full", period("full", "09:00", "15:00")]]));
  assert.deepEqual(r.passes.map((p) => p.price), [90, 50, 20]);
  assert.equal(r.timings["5 days_full"], 90);
  assert.equal(r.timings["3 days_full"], 0);
});

test("PP-017: a £0 master price gives a £0 pass and £0 timings (free listing)", () => {
  const r = resolveBundlePricing(bundle({ masterPrice: 0 }), passes, new Map([["full", period("full", "09:00", "15:00")]]));
  assert.ok(r.passes.every((p) => p.price === 0));
  assert.equal(r.timings["5 days_full"], 0);
});

test("PP-001: unknown passIds are dropped and passes sort longest-first", () => {
  const r = resolveBundlePricing(bundle({ passIds: ["1 day", "ghost", "5 days"] }), passes, new Map());
  assert.deepEqual(r.passes.map((p) => p.name), ["5 days", "1 day"]);
});

// Add-ons: PP-006 / 007 / 008 / 016
const fail = (m: string): never => { throw new Error(m); };
const tshirt: LibAddonDef = {
  id: "ts", name: "T-shirt", type: "oneoff", price: 8,
  questions: [
    { id: "size", label: "Size", type: "choice", options: ["S", "M", "L"], required: true },
    { id: "print", label: "Name to print", type: "text" },
  ],
};
const late: LibAddonDef = { id: "lp", name: "Late pick-up", type: "perday", price: 3 };
const days3 = ["2026-10-05", "2026-10-06", "2026-10-07"];

test("PP-006: one-off add-on costs £8 once, label includes the answers", () => {
  const r = priceAddon(tshirt, { answers: { size: "M", print: "Ava" } }, days3, "Ava", fail);
  assert.equal(r.price, 8);
  assert.equal(r.label, "T-shirt (Size: M, Name to print: Ava)");
  assert.equal(r.perDay, false);
});

test("PP-006: one-off price does NOT scale with the days chosen", () => {
  assert.equal(priceAddon(tshirt, { days: days3.slice(0, 1), answers: { size: "S" } }, days3, "Ava", fail).price, 8);
  assert.equal(priceAddon(tshirt, { answers: { size: "S" } }, days3, "Ava", fail).price, 8);
});

test("PP-006: a size that isn't one of the options is refused", () => {
  assert.throws(() => priceAddon(tshirt, { answers: { size: "XXL" } }, days3, "Ava", fail), /"XXL" isn't one of the options for Size/);
});

test("PP-006: optional question left blank is fine and omitted from the label", () => {
  const r = priceAddon(tshirt, { answers: { size: "L" } }, days3, "Ava", fail);
  assert.equal(r.label, "T-shirt (Size: L)");
});

test("PP-007: per-day add-on on 2 of 3 days = £6 and reads 'Late pick-up × 2'", () => {
  const r = priceAddon(late, { days: days3.slice(0, 2) }, days3, "Ava", fail);
  assert.equal(r.price, 6);
  assert.equal(r.label, "Late pick-up × 2");
  assert.deepEqual(r.onDays, days3.slice(0, 2));
});

test("PP-007: per-day add-on with no days specified covers every pass day; duplicate days counted once", () => {
  assert.equal(priceAddon(late, {}, days3, "Ava", fail).price, 9);
  assert.equal(priceAddon(late, { days: [days3[0], days3[0]] }, days3, "Ava", fail).price, 3);
});

test("PP-007: per-day add-on on a day the pass doesn't include is refused", () => {
  assert.throws(() => priceAddon(late, { days: ["2026-10-20"] }, days3, "Ava", fail), /on a day the pass isn't/);
});

test("PP-008: required add-on question left blank (or whitespace) is refused, naming the question and child", () => {
  assert.throws(() => priceAddon(tshirt, {}, days3, "Ava", fail), /"T-shirt" needs an answer for Size \(Ava\)/);
  assert.throws(() => priceAddon(tshirt, { answers: { size: "   " } }, days3, "Ava", fail), /needs an answer for Size/);
});

test("PP-016: pass-with-timing plus add-on — add-on total is added on top of the timing price (£54 + £8 = £62)", () => {
  const r = resolveBundlePricing(bundle({}), passes, new Map([["full", period("full", "09:00", "15:00")]]));
  const base = r.timings["3 days_full"];
  const a = priceAddon(tshirt, { answers: { size: "M" } }, days3, "Ava", fail);
  assert.equal(Math.round((base + a.price) * 100) / 100, 62);
});

// ─────────── Setup > Amending dates rules (AM-008, AM-011, AM-012): enforcement audit ───────────

const serverSrc = ["../server/src/routes/my.ts", "../server/src/routes/bookings.ts"]
  .map((p) => readFileSync(new URL(p, import.meta.url), "utf8")).join("\n");

test("AM-008: server refuses an amend when 'Offer date changes at all' is off", () => {
  assert.match(serverSrc, /enabled\(settings, "allowDateChanges"\)[\s\S]{0,120}doesn't offer date changes/);
});

for (const [setting, label] of [
  ["amendNoticeHours", "notice hours (e.g. 48h) refuses a move too close to the date"],
  ["amendFee", "admin fee is charged / recorded on the request"],
  ["amendLimit", "max moves per booking is enforced"],
  ["amendAllowCheaper", "'no cheaper moves' is enforced"],
  ["amendSelfService", "'let parents move their own dates' applies instantly without approval"],
] as const) {
  test(`AM-011/012 ${label}`, { todo: `REAL GAP: ${setting} is saved in Setup and shown to parents but never read by the server amend/approve handlers` }, () => {
    assert.ok(new RegExp(setting).test(serverSrc), `${setting} is not referenced in server/src/routes/my.ts or bookings.ts`);
  });
}

// ── Notice rule actually enforced (AM-011) ────────────────────────────────────────────────────────────────────────────────────────────
import { amendNoticeError } from "../server/src/lib/dateChange";
test("amendNoticeError: Setup > Amending dates notice hours", async (t) => {
  const now = new Date("2026-10-03T12:00:00Z").getTime(); // Sat 3 Oct noon
  await t.test("48h notice: moving Mon 5 Oct (36h away) is refused with a plain reason", () => {
    const r = amendNoticeError([{ from: "2026-10-05", to: "2026-10-12" }], 48, now);
    assert.match(r ?? "", /too close to move.*48 hours/);
  });
  await t.test("48h notice: moving Wed 7 Oct is allowed", () => assert.equal(amendNoticeError([{ from: "2026-10-07", to: "2026-10-14" }], 48, now), null));
  await t.test("notice 0 or unset = no rule", () => {
    assert.equal(amendNoticeError([{ from: "2026-10-05", to: "2026-10-12" }], 0, now), null);
    assert.equal(amendNoticeError([{ from: "2026-10-05", to: "2026-10-12" }], undefined, now), null);
  });
  await t.test("an undated 'preferred date' request gives nothing up, so it is not refused", () => assert.equal(amendNoticeError([{ from: "", to: "2026-10-05" }], 48, now), null));
  await t.test("one close move in a batch refuses the request", () =>
    assert.ok(amendNoticeError([{ from: "2026-10-09", to: "2026-10-16" }, { from: "2026-10-05", to: "2026-10-12" }], 48, now)));
});
