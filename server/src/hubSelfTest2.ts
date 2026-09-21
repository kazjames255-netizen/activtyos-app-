// Self-test for the Learning Hub's teaching-side pure logic: spaced repetition
// (lib/hubSrs.ts) and the live-lesson join window / room naming
// (lib/hubVideo.ts). No Firestore, no network.
//   cd server && npx tsx src/hubSelfTest2.ts
import assert from "node:assert/strict";
import { buildQueue, DEFAULT_EASE, freshState, isQuality, sm2, type SrsState } from "./lib/hubSrs";
import { joinWindow, roomNameFor, windowState } from "./lib/hubVideo";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };
const DAY = 86_400_000;
const NOW = new Date("2026-03-10T12:00:00.000Z");
const MIN_EASE = 1.3;
const days = (iso: string) => Math.round((new Date(iso).getTime() - NOW.getTime()) / DAY);

console.log("SM-2");
t("only 1/3/4/5 are valid qualities", () => {
  for (const q of [1, 3, 4, 5]) assert.equal(isQuality(q), true);
  for (const q of [0, 2, 6, -1, "4", null, 4.5]) assert.equal(isQuality(q), false);
});
t("first Good review → 1 day, reps 1, EF unchanged at 2.5", () => {
  const r = sm2(null, 4, MIN_EASE, NOW);
  assert.equal(r.intervalDays, 1); assert.equal(r.repetitions, 1); assert.equal(r.easeFactor, 2.5);
  assert.equal(days(r.nextDueAt), 1);
  assert.equal(r.lastReviewedAt, NOW.toISOString());
});
t("Good ×3 → 1, 6, 15 days (round(6 × 2.5))", () => {
  let s: SrsState | null = null;
  const seen: number[] = [];
  for (let i = 0; i < 3; i++) { const r = sm2(s, 4, MIN_EASE, NOW); seen.push(r.intervalDays); s = r; }
  assert.deepEqual(seen, [1, 6, 15]);
});
t("Easy raises EF by 0.1 per review", () => {
  const a = sm2(null, 5, MIN_EASE, NOW);
  assert.equal(a.easeFactor, 2.6);
  assert.equal(sm2(a, 5, MIN_EASE, NOW).easeFactor, 2.7);
});
t("Hard lowers EF by 0.14 and still advances", () => {
  const a = sm2(null, 3, MIN_EASE, NOW);
  assert.equal(a.easeFactor, 2.36); assert.equal(a.repetitions, 1); assert.equal(a.intervalDays, 1);
});
t("Again resets reps and interval to 1 day and cuts EF", () => {
  const good = sm2(sm2(null, 4, MIN_EASE, NOW), 4, MIN_EASE, NOW); // reps 2, interval 6
  assert.equal(good.intervalDays, 6);
  const again = sm2(good, 1, MIN_EASE, NOW);
  assert.equal(again.repetitions, 0); assert.equal(again.intervalDays, 1);
  assert.equal(again.easeFactor, 1.96);
  assert.equal(days(again.nextDueAt), 1);
  // …and the next Good starts from 1 day again.
  assert.equal(sm2(again, 4, MIN_EASE, NOW).intervalDays, 1);
});
t("EF never drops below the tenant's floor", () => {
  let s: SrsState | null = null;
  for (let i = 0; i < 20; i++) s = sm2(s, 1, MIN_EASE, NOW);
  assert.equal(s!.easeFactor, 1.3);
  let s2: SrsState | null = null;
  for (let i = 0; i < 20; i++) s2 = sm2(s2, 1, 1.8, NOW);
  assert.equal(s2!.easeFactor, 1.8);
});
t("interval uses the ease BEFORE the review (classic SM-2)", () => {
  const prev: SrsState = { easeFactor: 2.0, intervalDays: 10, repetitions: 3 };
  assert.equal(sm2(prev, 3, MIN_EASE, NOW).intervalDays, 20);
});
t("a corrupt huge stored interval is clamped", () => {
  const r = sm2({ easeFactor: 3, intervalDays: 1e9, repetitions: 5 }, 5, MIN_EASE, NOW);
  assert.equal(r.intervalDays, 3650);
});
t("fresh state defaults", () => { assert.deepEqual(freshState(), { easeFactor: DEFAULT_EASE, intervalDays: 0, repetitions: 0 }); });

console.log("due queue");
t("due first (most overdue first), then new; future ones only counted", () => {
  const cards = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const rv = new Map([
    ["a", { cardId: "a", nextDueAt: new Date(NOW.getTime() - DAY).toISOString() }],
    ["b", { cardId: "b", nextDueAt: new Date(NOW.getTime() - 3 * DAY).toISOString() }],
    ["c", { cardId: "c", nextDueAt: new Date(NOW.getTime() + 2 * DAY).toISOString() }],
    ["d", { cardId: "d", nextDueAt: NOW.toISOString() }], // due exactly now counts as due
  ]);
  const q = buildQueue(cards, rv, NOW);
  assert.deepEqual(q.due.map((c) => c.id), ["b", "a", "d"]);
  assert.deepEqual(q.fresh.map((c) => c.id), ["e"]);
  assert.equal(q.upcoming, 1);
});

console.log("live-lesson join window");
t("opens 10 min before the start, closes 30 min after the end", () => {
  const w = joinWindow("2026-03-10T15:00:00.000Z", 60);
  assert.equal(w.opensAt.toISOString(), "2026-03-10T14:50:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2026-03-10T16:00:00.000Z");
  assert.equal(w.closesAt.toISOString(), "2026-03-10T16:30:00.000Z");
  const at = (iso: string) => windowState(new Date(iso), w);
  assert.equal(at("2026-03-10T14:49:59.000Z"), "early");
  assert.equal(at("2026-03-10T14:50:00.000Z"), "open");
  assert.equal(at("2026-03-10T15:30:00.000Z"), "open");
  assert.equal(at("2026-03-10T16:30:00.000Z"), "open");
  assert.equal(at("2026-03-10T16:30:01.000Z"), "closed");
});
t("room names are deterministic per lesson, distinct across lessons, and Daily-safe", () => {
  assert.equal(roomNameFor("abc"), roomNameFor("abc"));
  assert.notEqual(roomNameFor("abc"), roomNameFor("abd"));
  assert.match(roomNameFor("abc"), /^hub-[0-9a-f]{20}$/);
});

console.log(`\n${n} checks passed`);
