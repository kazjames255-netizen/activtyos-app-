// Run: server/node_modules/.bin/tsx server/src/lib/hubPlan.selftest.ts
import { buildPlan, groupSignals, weaknessScore, planDays, type PlanInput, type PlanNote, type PlanQuiz, type TopicSignal } from "./hubPlan";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const now = new Date("2026-09-21T10:00:00Z"); // a Monday
const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const T = (id: string, subject: string, topic: string) => [id, { id, subject, topic, subtopic: null }] as const;
const topics = new Map([T("frac", "Maths", "Fractions"), T("geo", "Maths", "Geometry"), T("spell", "English", "Spelling"), T("bio", "Science", "Cells"), T("ok", "Maths", "Number")]);
const q = (id: string, topic: string, mins: number | null, qs = 10): PlanQuiz => ({ id, title: `Quiz ${id}`, topicIds: [topic], timeLimitMins: mins, questionCount: qs });
const lesson = (id: string, topic: string, year: number | null = 4): PlanNote => ({ id, title: `Lesson ${id}`, topicId: topic, readMinutes: 6, isLesson: true, hasWorksheet: false, worksheetQuiz: null, lessonYear: year });
const sig = (topicId: string, pct: number, attempts = 3, days = 5, extra: Partial<TopicSignal> = {}): TopicSignal => ({ topicId, pct, attempts, lastAttemptAt: iso(days), lastPct: pct, baselineOnly: false, ...extra });
const base = (): PlanInput => ({
  now, days: 7, signals: [sig("frac", 42, 3, 7), sig("geo", 60), sig("spell", 55), sig("bio", 30, 1), sig("ok", 90)], topics,
  quizzesByTopic: new Map([["frac", [q("q1", "frac", 10), q("q2", "frac", 25)]], ["geo", [q("q3", "geo", null, 8)]], ["spell", [q("q4", "spell", 12)]], ["bio", [q("q5", "bio", 15)]]]),
  notesByTopic: new Map([["frac", [lesson("n1", "frac"), lesson("n1far", "frac", 9)]], ["bio", [lesson("n2", "bio")]]]),
  recentAssessments: new Map(), recentNotes: new Map(), yearNumber: 4, support: { noTimer: false, extraTimePercent: 0, calm: false },
});

// scoring
ok(weaknessScore(sig("x", 80), now) === 0, "secure topics score 0");
ok(weaknessScore(sig("x", 40, 3), now) > weaknessScore(sig("x", 60, 3), now), "lower pct = weaker");
ok(weaknessScore(sig("x", 40, 1), now) < weaknessScore(sig("x", 40, 3), now), "one attempt is less certain");
ok(weaknessScore(sig("x", 40, 3), now, iso(2)) < weaknessScore(sig("x", 40, 3), now), "recently-set topic damped");

let p = buildPlan(base());
ok(p.items.length === 4, `4 weak topics planned (got ${p.items.length})`);
ok(!p.items.some((i) => i.topicId === "ok"), "secure topic not planned");
const byRank = [...p.items].sort((a, b) => a.rank - b.rank).map((i) => i.topicId);
ok(byRank[0] === "bio" || byRank[0] === "frac", `weakest first (${byRank.join(",")})`);
const frac = p.items.find((i) => i.topicId === "frac")!;
ok(frac.assessmentId === "q1", "quiz nearest 12 min chosen (q1=10, not q2=25)");
ok(frac.noteIds.join() === "n1", "recap lesson (year-matched) paired for <50%");
ok(/Scored 42% on Fractions last week/.test(frac.reasonText), `reason line: ${frac.reasonText}`);
ok(p.items.find((i) => i.topicId === "geo")!.noteIds.length === 0, "no lesson for 60% topic");
ok(p.items.every((i) => i.dueAt > now.toISOString() && !/-(?:0[0-9]|1[0-9])T/.test("") ), "due dates in future");
ok(new Set(p.items.map((i) => i.dueDay)).size >= 3, "spread across days");
const perDay = new Map<string, number>(); for (const i of p.items) perDay.set(i.dueDay, (perDay.get(i.dueDay) ?? 0) + i.minutes);
ok([...perDay.values()].every((m) => m <= 30), `daily minutes bounded (${[...perDay.values()]})`);
ok(p.items.every((i) => ![0, 6].includes(new Date(i.dueAt).getUTCDay())), "weekdays only");
ok(planDays(now, 7).length === 5 && planDays(now, 7)[0] === "2026-09-22", "planDays from tomorrow, Mon-Fri");

// never repeat
const rep = base(); rep.recentAssessments = new Map([["q1", iso(3)]]);
p = buildPlan(rep);
ok(p.items.find((i) => i.topicId === "frac")!.assessmentId === "q2", "recently-set quiz skipped");
rep.recentAssessments = new Map([["q1", iso(30)]]); rep.everAttempted = new Map([["q1", iso(30)]]);
ok(buildPlan(rep).items.find((i) => i.topicId === "frac")!.assessmentId === "q2", "never-attempted preferred over old repeat");
const nolesson = base(); nolesson.recentNotes = new Map([["n1", iso(2)]]);
ok(buildPlan(nolesson).items.find((i) => i.topicId === "frac")!.noteIds.length === 0, "recently-set lesson skipped");

// support
const calm = base(); calm.support = { noTimer: false, extraTimePercent: 0, calm: true };
p = buildPlan(calm);
const cd = new Map<string, number>(); for (const i of p.items) cd.set(i.dueDay, (cd.get(i.dueDay) ?? 0) + 1);
ok([...cd.values()].every((c) => c === 1), "calm: one item per day");
ok(p.items.every((i) => i.chips.includes("calm") && /no rush/.test(i.instructions)), "calm wording + chip");
ok(p.summary.minutesPerDay === 15, "calm budget 75%");
const et = base(); et.support = { noTimer: false, extraTimePercent: 50, calm: false };
ok(buildPlan(et).items.find((i) => i.topicId === "spell")!.minutes === 18, "50% extra time stretches 12 -> 18");
ok(buildPlan(et).items.find((i) => i.topicId === "spell")!.chips.includes("extraTime"), "extraTime chip");

// gaps / no content
const gap = base(); gap.quizzesByTopic = new Map(); gap.notesByTopic = new Map();
p = buildPlan(gap); ok(p.items.length === 0 && p.gaps.length === 4 && p.gaps.every((g) => g.why === "no_content"), "no content => gaps, no items");

// worksheet
const ws = base();
ws.notesByTopic = new Map([["geo", [{ id: "w1", title: "Angles worksheet", topicId: "geo", readMinutes: 4, isLesson: false, hasWorksheet: true, worksheetQuiz: q("wq1", "geo", null, 8), lessonYear: 4 }]]]);
const g = buildPlan(ws).items.find((i) => i.topicId === "geo")!;
ok(g.worksheetNoteIds.join() === "w1" && g.assessmentId === "wq1", "worksheet + auto-marked quiz preferred over standalone");

// group
const gs = groupSignals([[sig("frac", 30)], [sig("frac", 50)], [sig("frac", 90)]], 3);
ok(gs[0].pct === 57 && gs[0].weakCount === 2 && gs[0].total === 3, "group aggregate");
const gi = base(); gi.signals = gs; gi.group = { name: "Y4", size: 3 };
const gp = buildPlan(gi).items[0];
ok(/2 of 3 students are below 75% on Fractions/.test(gp.reasonText) && gp.chips.includes("groupShare"), `group reason: ${gp.reasonText}`);

// budget guard: huge quiz is deferred
const big = base(); big.quizzesByTopic = new Map([["frac", [q("huge", "frac", 90)]]]); big.signals = [sig("frac", 20)]; big.notesByTopic = new Map();
p = buildPlan(big); ok(p.items.length === 0 && p.gaps[0]?.why === "no_room", "oversized item deferred");
// deterministic
ok(JSON.stringify(buildPlan(base())) === JSON.stringify(buildPlan(base())), "deterministic");
// baseline-only
const bl = base(); bl.signals = [sig("frac", 35, 0, 40, { baselineOnly: true, lastPct: null })];
const b = buildPlan(bl).items[0]; ok(b.reason.kind === "baseline" && b.noteIds.length === 1, "baseline-only: explained + recap");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
