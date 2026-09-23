// Self-test for the Learning Hub's pure maths (marking, scoring, mastery, baseline).
// No Firestore, no network:   cd server && npx tsx src/hubSelfTest.ts
import assert from "node:assert/strict";
import { applyManualMark, inferRule, markResponse, normText, revealAllowed, scoreAttempt, toNumber, type MarkableQuestion, type ScoredAnswer } from "./lib/hubScoring";
import { baselines, bandFor, computeTopicMastery, rollupSubject, trendOf, weightedMastery, type AttemptLite } from "./lib/hubMastery";
import { HUB_DEFAULTS, mergeHub } from "../../lib/hubConfig";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };
const q = (o: Partial<MarkableQuestion> & { mark: MarkableQuestion["mark"] }): MarkableQuestion => ({ answer: null, marks: 2, ...o });

console.log("marking");
t("choice: all or nothing on the option id", () => {
  const k = q({ mark: "choice", answer: "b" });
  assert.deepEqual(markResponse(k, "b"), { correct: true, marksAwarded: 2, pending: false });
  assert.equal(markResponse(k, "a").correct, false);
  assert.equal(markResponse(k, "a").marksAwarded, 0);
  assert.equal(markResponse(k, ["b"]).correct, false, "a list is not an option id");
  assert.equal(markResponse(k, null).correct, false);
  assert.equal(markResponse(k, "").correct, false);
  assert.equal(markResponse(k, "B").correct, false, "option ids are case-sensitive");
});
t("multi: exact set, order-free, no partial credit", () => {
  const k = q({ mark: "multi", answer: ["a", "c"] });
  assert.equal(markResponse(k, ["c", "a"]).correct, true);
  assert.equal(markResponse(k, ["a"]).correct, false);
  assert.equal(markResponse(k, ["a", "b", "c"]).correct, false);
  assert.equal(markResponse(k, ["a", "a"]).correct, false, "duplicates don't stand in for a missing option");
  assert.equal(markResponse(k, []).correct, false);
  assert.equal(markResponse(k, "a").correct, false);
  assert.equal(markResponse(k, [1, 2]).correct, false);
});
t("exact: trim + case + inner whitespace, accepted alternatives", () => {
  const k = q({ mark: "exact", answer: "Isaac  Newton", acceptedAnswers: ["Newton"] });
  assert.equal(markResponse(k, "  isaac newton ").correct, true);
  assert.equal(markResponse(k, "NEWTON").correct, true);
  assert.equal(markResponse(k, "Isaac Newtonn").correct, false);
  assert.equal(markResponse(k, "").correct, false);
  assert.equal(markResponse(q({ mark: "exact", answer: "42" }), 42).correct, true, "a number typed into a text answer");
  assert.equal(markResponse(q({ mark: "exact", answer: "x" }), ["x"]).correct, false);
  assert.equal(normText("  A   b\tC "), "a b c");
});
t("numeric: within tolerance (inclusive), strings parse, junk fails", () => {
  const k = q({ mark: "numeric", answer: 3.14, tolerance: 0.01 });
  assert.equal(markResponse(k, 3.15).correct, true);
  assert.equal(markResponse(k, "3.13").correct, true);
  assert.equal(markResponse(k, 3.1401).correct, true);
  assert.equal(markResponse(k, 3.16).correct, false);
  assert.equal(markResponse(k, "abc").correct, false);
  assert.equal(markResponse(k, "3.14abc").correct, false);
  assert.equal(markResponse(k, "").correct, false);
  assert.equal(markResponse(k, NaN).correct, false);
  assert.equal(markResponse(k, Infinity).correct, false);
  const z = q({ mark: "numeric", answer: 0 });
  assert.equal(markResponse(z, 0).correct, true, "zero is a real answer");
  assert.equal(markResponse(z, "0").correct, true);
  assert.equal(markResponse(z, 0.0001).correct, false, "no tolerance = exact");
  assert.equal(markResponse(q({ mark: "numeric", answer: 0.3 }), 0.1 + 0.2).correct, true, "float noise");
  assert.equal(markResponse(q({ mark: "numeric", answer: -5, tolerance: 1 }), "-4.5").correct, true);
  assert.equal(toNumber(" 1e3 "), 1000);
  assert.equal(toNumber("1,000"), 1000, "a real thousands separator");
  assert.equal(toNumber("1,00"), null, "not a thousands group");
});
t("manual: waits for a tutor; a blank one is just zero", () => {
  const k = q({ mark: "manual", marks: 5 });
  assert.deepEqual(markResponse(k, "an essay"), { correct: null, marksAwarded: 0, pending: true });
  assert.deepEqual(markResponse(k, "   "), { correct: false, marksAwarded: 0, pending: false });
  assert.deepEqual(markResponse(k, null), { correct: false, marksAwarded: 0, pending: false });
});
t("inferRule falls back sensibly when a kind was dropped from settings", () => {
  assert.equal(inferRule({ options: [{}, {}], answer: "a" }), "choice");
  assert.equal(inferRule({ options: [{}, {}], answer: ["a"] }), "multi");
  assert.equal(inferRule({ answer: 3 }), "numeric");
  assert.equal(inferRule({ answer: "x" }), "exact");
  assert.equal(inferRule({ answer: null }), "manual");
});

console.log("scoring");
const ans = (topicId: string, awarded: number, max: number, pending = false): ScoredAnswer => ({ topicId, correct: pending ? null : awarded >= max, marksAwarded: awarded, marksMax: max, pending });
t("pct = round(Σawarded/Σmax×100); passed vs pass mark; byTopic", () => {
  const s = scoreAttempt([ans("a", 2, 2), ans("a", 0, 2), ans("b", 1, 3)], 50);
  assert.equal(s.scoreMarks, 3); assert.equal(s.maxMarks, 7); assert.equal(s.pct, 43);
  assert.equal(s.status, "marked"); assert.equal(s.passed, false);
  assert.deepEqual(s.byTopic, { a: { got: 2, max: 4 }, b: { got: 1, max: 3 } });
  assert.equal(scoreAttempt([ans("a", 1, 2)], 50).passed, true, "pct equal to the pass mark passes");
});
t("pending manual answers are excluded from pct until marked", () => {
  const s = scoreAttempt([ans("a", 2, 2), ans("a", 0, 6, true)], 70);
  assert.equal(s.status, "pending_marking"); assert.equal(s.pct, 100); assert.equal(s.maxMarks, 8); assert.equal(s.countedMax, 2);
  assert.equal(s.passed, null); assert.deepEqual(s.byTopic, { a: { got: 2, max: 2 } });
  const done = scoreAttempt([ans("a", 2, 2), ans("a", 3, 6)], 70);
  assert.equal(done.status, "marked"); assert.equal(done.pct, 63); assert.equal(done.passed, false);
});
t("empty / all-pending attempts don't divide by zero", () => {
  assert.equal(scoreAttempt([], 70).pct, 0);
  assert.equal(scoreAttempt([ans("a", 0, 5, true)], 70).pct, 0);
});
t("tutor marks are clamped to [0,max]; full marks = correct", () => {
  assert.deepEqual(applyManualMark(4, 9), { correct: true, marksAwarded: 4 });
  assert.deepEqual(applyManualMark(4, -3), { correct: false, marksAwarded: 0 });
  assert.deepEqual(applyManualMark(4, 2.5), { correct: false, marksAwarded: 2.5 });
  assert.deepEqual(applyManualMark(4, NaN), { correct: false, marksAwarded: 0 });
});
t("reveal policy: never inside a running attempt", () => {
  for (const p of ["after_pass", "after_submit", "after_marked", "never"] as const) assert.equal(revealAllowed(p, "in_progress"), false);
  assert.equal(revealAllowed("after_pass", "marked", false), false, "failed attempt: key held back");
  assert.equal(revealAllowed("after_pass", "marked", true), true, "passed: key opens");
  assert.equal(revealAllowed("after_pass", "pending_marking", false), false);
  assert.equal(revealAllowed("after_pass", "marked"), true, "no pass mark to speak of (a warm-up check): shown");
  assert.equal(revealAllowed("after_submit", "pending_marking"), true);
  assert.equal(revealAllowed("after_submit", "marked"), true);
  assert.equal(revealAllowed("after_marked", "pending_marking"), false);
  assert.equal(revealAllowed("after_marked", "marked"), true);
  assert.equal(revealAllowed("never", "marked"), false);
});

console.log("mastery");
t("weights 0.5^i newest-first; only the last 5 count; max=0 slices skipped", () => {
  assert.equal(weightedMastery([]), null);
  assert.equal(weightedMastery([{ got: 0, max: 0 }]), null);
  assert.equal(weightedMastery([{ got: 1, max: 1 }]), 100);
  // newest 100%, then 0%: (1·1 + 0.5·0) / 1.5 = 66.67 → 67
  assert.equal(weightedMastery([{ got: 1, max: 1 }, { got: 0, max: 1 }]), 67);
  // newest 0%, then 100%: (0 + 0.5) / 1.5 = 33.3 → 33
  assert.equal(weightedMastery([{ got: 0, max: 1 }, { got: 1, max: 1 }]), 33);
  // a 6th (oldest) slice is ignored
  const five = Array.from({ length: 5 }, () => ({ got: 1, max: 2 }));
  assert.equal(weightedMastery([...five, { got: 0, max: 2 }]), 50);
  assert.equal(weightedMastery([{ got: 0, max: 0 }, { got: 1, max: 2 }]), 50, "an empty slice doesn't take a weight slot");
  // partial slices: 3/4 newest, 1/2 next → (0.75 + 0.25) / 1.5 = 66.67 → 67
  assert.equal(weightedMastery([{ got: 3, max: 4 }, { got: 1, max: 2 }]), 67);
});
t("bands: highest min ≤ pct, unsorted input ok", () => {
  const bands = [{ min: 80, label: "Secure" }, { min: 0, label: "Learning" }, { min: 50, label: "Developing" }];
  assert.equal(bandFor(0, bands), "Learning"); assert.equal(bandFor(49, bands), "Learning");
  assert.equal(bandFor(50, bands), "Developing"); assert.equal(bandFor(79, bands), "Developing");
  assert.equal(bandFor(80, bands), "Secure"); assert.equal(bandFor(100, bands), "Secure");
  assert.equal(bandFor(null, bands), null);
  assert.equal(bandFor(10, [{ min: 20, label: "x" }]), null, "below every band");
  assert.equal(bandFor(85, mergeHub(undefined).masteryBands), "Secure");
});

const at = (id: string, type: "quiz" | "diagnostic", day: number, by: Record<string, [number, number]>, o: Partial<AttemptLite> = {}): AttemptLite => ({
  id, assessmentType: type, status: "marked", subject: "Maths", submittedAt: `2026-01-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  byTopic: Object.fromEntries(Object.entries(by).map(([k, [g, m]]) => [k, { got: g, max: m }])), ...o,
});
t("diagnostics set the baseline but never feed mastery / trend", () => {
  const rows = computeTopicMastery([at("d1", "diagnostic", 1, { alg: [1, 4] })]);
  const r = rows.get("alg")!;
  assert.equal(r.masteryPct, null); assert.equal(r.attempts, 0); assert.equal(r.baselinePct, 25);
  assert.deepEqual(trendOf([at("d1", "diagnostic", 1, { alg: [1, 4] })]), []);
});
t("baseline is set once: a later diagnostic never overwrites it", () => {
  const list = [at("d2", "diagnostic", 9, { alg: [4, 4] }), at("d1", "diagnostic", 1, { alg: [1, 4] })];
  assert.equal(baselines(list).get("alg")!.pct, 25);
  assert.equal(computeTopicMastery(list).get("alg")!.baselinePct, 25);
});
t("reset-baseline lets the retake set it; unmarked diagnostics don't", () => {
  const reset = [at("d1", "diagnostic", 1, { alg: [1, 4] }, { baselineReset: true }), at("d2", "diagnostic", 9, { alg: [4, 4] })];
  assert.equal(baselines(reset).get("alg")!.pct, 100);
  assert.equal(baselines([at("d1", "diagnostic", 1, { alg: [1, 4] }, { baselineReset: true })]).size, 0);
  assert.equal(baselines([at("d1", "diagnostic", 1, { alg: [1, 4] }, { status: "pending_marking" })]).size, 0);
});
t("baseline is per subject", () => {
  const b = baselines([at("m", "diagnostic", 1, { alg: [2, 4] }), at("s", "diagnostic", 2, { cells: [1, 2] }, { subject: "Science" })]);
  assert.equal(b.get("alg")!.pct, 50); assert.equal(b.get("cells")!.pct, 50);
});
t("quiz slices: newest first, marked only, growth vs baseline", () => {
  const list = [
    at("d", "diagnostic", 1, { alg: [1, 4] }),
    at("q1", "quiz", 2, { alg: [2, 4] }),
    at("q2", "quiz", 3, { alg: [4, 4] }),
    at("qp", "quiz", 4, { alg: [0, 4] }, { status: "pending_marking" }), // not marked → ignored
  ];
  const r = computeTopicMastery(list).get("alg")!;
  // newest marked is q2 (100%), then q1 (50%): (1 + 0.25)/1.5 = 83.3 → 83
  assert.equal(r.masteryPct, 83); assert.equal(r.attempts, 2); assert.equal(r.baselinePct, 25);
  assert.equal(r.lastAttemptAt, "2026-01-03T10:00:00.000Z");
  const roll = rollupSubject("Maths", [{ ...r, subject: "Maths" }], 2, new Set(["alg", "geo"]));
  assert.equal(roll.masteryPct, 83); assert.equal(roll.coverage, 0.5); assert.equal(roll.baselinePct, 25); assert.equal(roll.growthPct, 58);
  assert.equal(computeTopicMastery([]).size, 0);
});
t("subject rollup: mean of attempted topics; coverage; nothing attempted", () => {
  const row = (topicId: string, m: number | null, b: number | null) => ({ topicId, subject: "Maths", masteryPct: m, attempts: m === null ? 0 : 1, baselinePct: b, lastAttemptAt: null });
  const r = rollupSubject("Maths", [row("a", 80, null), row("b", 60, null), row("c", null, 40)], 4, new Set(["a", "b", "c", "d"]));
  assert.equal(r.masteryPct, 70); assert.equal(r.coverage, 0.5); assert.equal(r.baselinePct, 40); assert.equal(r.growthPct, null);
  const none = rollupSubject("Maths", [row("c", null, 40)], 4);
  assert.equal(none.masteryPct, null); assert.equal(none.coverage, 0);
  // attempted topic outside the published set can't push coverage above 1
  assert.equal(rollupSubject("Maths", [row("z", 50, null)], 0, new Set()).coverage, 1);
  assert.equal(rollupSubject("Maths", [], 0).coverage, 0);
});
t("trend: last 20 marked quiz attempts, oldest → newest", () => {
  const many = Array.from({ length: 25 }, (_, i) => at(`q${i}`, "quiz", i + 1, { a: [1, 1] }));
  const tr = trendOf(many);
  assert.equal(tr.length, 20); assert.equal(tr[0].id, "q5"); assert.equal(tr[19].id, "q24");
  assert.equal(trendOf([at("p", "quiz", 1, { a: [1, 1] }, { status: "pending_marking" })]).length, 0);
});

console.log("config");
t("hub defaults are complete and mergeHub keeps tenant lists whole", () => {
  assert.equal(HUB_DEFAULTS.questionKinds.length, 8); // + match, order, tool
  assert.deepEqual(mergeHub({ questionKinds: [{ id: "x", label: "X", mark: "exact" }] }).questionKinds.map((k) => k.id), ["x"]);
  assert.equal(mergeHub(undefined).revealAnswers, "after_pass"); // default: keep the key back until the quiz is passed (docs/learning-hub.md)
  assert.equal(mergeHub(undefined).retakeBreakAfter, 3);
  assert.equal(mergeHub({ revealAnswers: "after_submit" }).revealAnswers, "after_submit", "a tutor's own choice wins"); 
});

console.log(`\n${n} groups passed`);
