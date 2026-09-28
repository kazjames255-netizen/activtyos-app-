// Learning Hub — "Auto-plan a week". PURE (no Firestore, no clock unless passed): the route layer
// (routes/hub/planApi.ts) loads a child's/group's mastery + candidate content and calls buildPlan().
//
// It is a SUGGESTION for the tutor to review and accept — never auto-assigned, and deliberately NOT a
// "booster pack" (nothing is created or set here). Every rule is deterministic and explained by a `reason`.
//
// Rules (docs/auto-plan.md has the long form):
//  1. Weakness: topics whose mastery < SECURE_PCT (75). score = (100-pct)/100 x confidence (fewer marked
//     attempts = less sure; a baseline-only topic counts 0.6) x staleness (+10% if untouched 21+ days)
//     x group share (for a group: the share of students below the bar). A topic that already got homework
//     in the last 10 days is damped x0.6 so we don't hammer it.
//  2. Content per topic: worksheet+auto-marked quiz > standalone quiz nearest ~12 min > worksheet alone;
//     a lesson recap is paired in when mastery < 50 (or only a baseline exists). Year-group aware.
//  3. Never repeat: quizzes attempted in the last 10 days, or set as homework in the last 10 days, are skipped.
//  4. Workload: <= minutesPerDay per day (default 20), spread over school days, <= 2 items/day, and the same
//     subject is not stacked on back-to-back days when avoidable.
//  5. Support profile: noTimer/extraTime stretch the estimate; calm = 75% budget, 1 item/day, gentler wording.

export const SECURE_PCT = 75;
export const RECAP_BELOW_PCT = 50;
export const REPEAT_WINDOW_DAYS = 10;
export const STALE_DAYS = 21;
export const DEFAULT_MINUTES_PER_DAY = 20;
export const TARGET_QUIZ_MINS = 12;
const WORKSHEET_MINS = 15;
const DAY_MS = 86_400_000;

export interface PlanSupport { noTimer: boolean; extraTimePercent: number; calm: boolean }
export interface PlanTopic { id: string; subject: string; topic: string; subtopic: string | null }

/** One topic's weakness evidence, for a child (n/a group fields) or aggregated over a group. */
export interface TopicSignal {
  topicId: string;
  /** Current mastery (mean over the group's students that have one). */
  pct: number;
  /** Marked attempts behind it (0 = baseline only). Group: max over students. */
  attempts: number;
  lastAttemptAt: string | null;
  /** The newest marked slice's own score, for "scored 42% on ..." (null when only a baseline). */
  lastPct: number | null;
  baselineOnly: boolean;
  /** Group only. */
  weakCount?: number;
  total?: number;
}

export interface PlanQuiz { id: string; title: string; topicIds: string[]; timeLimitMins: number | null; questionCount: number }
export interface PlanNote {
  id: string; title: string; topicId: string; readMinutes: number; isLesson: boolean; hasWorksheet: boolean;
  /** Auto-marked quiz of the worksheet (an assessment id, already checked published by the caller). */
  worksheetQuiz: PlanQuiz | null; lessonYear: number | null;
}

export interface PlanInput {
  now: Date;
  days: number;
  minutesPerDay?: number;
  signals: TopicSignal[];
  topics: Map<string, PlanTopic>;
  /** Candidates the caller already filtered for access/franchise/audience. */
  quizzesByTopic: Map<string, PlanQuiz[]>;
  notesByTopic: Map<string, PlanNote[]>;
  /** assessmentId -> ISO of the last attempt/assignment; noteId -> ISO of last assignment. */
  recentAssessments: Map<string, string>;
  recentNotes: Map<string, string>;
  /** assessmentId -> ISO of ANY past attempt (novelty tie-break). */
  everAttempted?: Map<string, string>;
  /** topicId -> ISO of the last homework that covered it. */
  recentTopics?: Map<string, string>;
  yearNumber: number | null;
  support: PlanSupport;
  group?: { name: string; size: number } | null;
}

export type ReasonKind = "scored" | "baseline" | "group" | "stale";
export interface PlanReason { kind: ReasonKind; topic: string; pct: number; daysAgo: number | null; weak?: number; total?: number; attempts: number }
export type PlanChip = "weak" | "stale" | "quiz" | "lesson" | "worksheet" | "recap" | "fresh" | "untimed" | "extraTime" | "calm" | "groupShare";
export interface PlanPart { kind: "quiz" | "lesson" | "worksheet"; id: string; title: string; minutes: number }

/** Shape the Set-homework flow can prefill (see routes/hub/homeworkApi.ts homeworkBody). */
export interface PlanItem {
  id: string;
  rank: number;
  topicId: string;
  subject: string;
  topicLabel: string;
  score: number;
  title: string;
  instructions: string;
  /** ISO due date (the school day the tutor should expect it back) and its YYYY-MM-DD. */
  dueAt: string;
  dueDay: string;
  assessmentId: string | null;
  noteIds: string[];
  worksheetNoteIds: string[];
  minutes: number;
  reason: PlanReason;
  reasonText: string;
  chips: PlanChip[];
  parts: PlanPart[];
}

export interface PlanGap { topicId: string; topicLabel: string; subject: string; pct: number; why: "no_content" | "no_room" }
export interface PlanOut {
  items: PlanItem[];
  gaps: PlanGap[];
  summary: { days: number; minutesPerDay: number; totalMinutes: number; weakTopics: number; considered: number };
}

// ── small helpers ────────────────────────────────────────────────────────────
export const topicLabel = (t: PlanTopic) => (t.subtopic ? `${t.topic}: ${t.subtopic}` : t.topic);
const daysBetween = (aIso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(aIso)) / DAY_MS));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** English "when" wording used in reasonText: "today" / "yesterday" / "3 days ago" / "last week" / "N weeks ago". */
export function whenText(daysAgo: number | null): string {
  if (daysAgo === null) return "";
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 14) return "last week";
  return `${Math.floor(daysAgo / 7)} weeks ago`;
}

/** Build one child's signals from their per-topic mastery rows (lib/hubMastery computeTopicMastery) and their marked
 *  quiz attempts NEWEST FIRST (for the last slice score). */
export function childSignals(
  rows: { topicId: string; masteryPct: number | null; attempts: number; baselinePct: number | null; lastAttemptAt: string | null }[],
  lastSlice: Map<string, number>,
): TopicSignal[] {
  const out: TopicSignal[] = [];
  for (const r of rows) {
    const pct = r.masteryPct ?? r.baselinePct;
    if (pct === null || pct === undefined) continue;
    out.push({ topicId: r.topicId, pct, attempts: r.masteryPct === null ? 0 : r.attempts, lastAttemptAt: r.lastAttemptAt, lastPct: lastSlice.get(r.topicId) ?? null, baselineOnly: r.masteryPct === null });
  }
  return out;
}

/** Aggregate several children's signals into a group's: mean pct, shares below the bar. */
export function groupSignals(perChild: TopicSignal[][], size: number): TopicSignal[] {
  const by = new Map<string, TopicSignal[]>();
  for (const list of perChild) for (const s of list) { const l = by.get(s.topicId); if (l) l.push(s); else by.set(s.topicId, [s]); }
  const out: TopicSignal[] = [];
  for (const [topicId, ss] of by) {
    const mean = Math.round(ss.reduce((a, s) => a + s.pct, 0) / ss.length);
    const lasts = ss.map((s) => s.lastPct).filter((x): x is number => x !== null);
    out.push({
      topicId, pct: mean, attempts: Math.max(...ss.map((s) => s.attempts)),
      lastAttemptAt: ss.map((s) => s.lastAttemptAt ?? "").sort().pop() || null,
      lastPct: lasts.length ? Math.round(lasts.reduce((a, b) => a + b, 0) / lasts.length) : null,
      baselineOnly: ss.every((s) => s.baselineOnly),
      weakCount: ss.filter((s) => s.pct < SECURE_PCT).length, total: Math.max(size, ss.length),
    });
  }
  return out;
}

export function weaknessScore(s: TopicSignal, now: Date, recentTopicAt?: string): number {
  if (s.pct >= SECURE_PCT) return 0;
  let v = (100 - s.pct) / 100;
  v *= s.baselineOnly ? 0.6 : s.attempts >= 3 ? 1 : s.attempts === 2 ? 0.9 : 0.75;
  if (s.lastAttemptAt && daysBetween(s.lastAttemptAt, now) >= STALE_DAYS) v *= 1.1;
  if (s.total && s.weakCount !== undefined) v *= 0.5 + 0.5 * (s.weakCount / s.total);
  if (recentTopicAt && daysBetween(recentTopicAt, now) < REPEAT_WINDOW_DAYS) v *= 0.6;
  return Math.round(v * 1000) / 1000;
}

const stretch = (mins: number, sup: PlanSupport) =>
  Math.ceil(mins * (sup.noTimer ? 1.25 : 1 + sup.extraTimePercent / 100));
const quizMins = (q: PlanQuiz, sup: PlanSupport) =>
  stretch(q.timeLimitMins && q.timeLimitMins > 0 ? q.timeLimitMins : Math.min(30, Math.max(5, Math.round(q.questionCount * 1.2))), sup);

function recentQuiz(id: string, input: PlanInput): boolean {
  const at = input.recentAssessments.get(id);
  return !!at && daysBetween(at, input.now) < REPEAT_WINDOW_DAYS;
}
function recentNote(id: string, input: PlanInput): boolean {
  const at = input.recentNotes.get(id);
  return !!at && daysBetween(at, input.now) < REPEAT_WINDOW_DAYS;
}

interface Draft { signal: TopicSignal; score: number; topic: PlanTopic; parts: PlanPart[]; assessmentId: string | null; noteIds: string[]; worksheetNoteIds: string[]; minutes: number; chips: PlanChip[]; recapTitle: string | null; mainTitle: string }

function pickContent(signal: TopicSignal, topic: PlanTopic, score: number, input: PlanInput): Draft | null {
  const sup = input.support;
  const chips: PlanChip[] = [];
  const parts: PlanPart[] = [];
  let assessmentId: string | null = null;
  const noteIds: string[] = [];
  const worksheetNoteIds: string[] = [];
  let mainTitle = "";

  const notes = (input.notesByTopic.get(signal.topicId) ?? []).filter((n) => !recentNote(n.id, input));
  const quizzes = (input.quizzesByTopic.get(signal.topicId) ?? []).filter((q) => !recentQuiz(q.id, input));

  // Year fit: closer to the child's year first; a lesson from a different year sorts after.
  const yr = input.yearNumber;
  const yearDist = (n: PlanNote) => (yr === null || n.lessonYear === null ? 1 : Math.abs(n.lessonYear - yr));
  const yearOk = (n: PlanNote) => yr === null || n.lessonYear === null || Math.abs(n.lessonYear - yr) <= 1;

  // 1. worksheet whose auto-marked quiz exists.
  const ws = notes.filter((n) => n.hasWorksheet && yearOk(n)).sort((a, b) => yearDist(a) - yearDist(b) || Number(!!b.worksheetQuiz) - Number(!!a.worksheetQuiz) || a.title.localeCompare(b.title));
  const wsQuiz = ws.find((n) => n.worksheetQuiz && !recentQuiz(n.worksheetQuiz.id, input));
  // 2. standalone quiz nearest the target length, never-attempted first.
  const ever = input.everAttempted ?? new Map<string, string>();
  const bestQuiz = [...quizzes].sort((a, b) =>
    Number(ever.has(a.id)) - Number(ever.has(b.id)) ||
    Math.abs(quizMins(a, sup) - TARGET_QUIZ_MINS) - Math.abs(quizMins(b, sup) - TARGET_QUIZ_MINS) || a.title.localeCompare(b.title))[0];

  if (wsQuiz) {
    const q = wsQuiz.worksheetQuiz!;
    const m = Math.max(quizMins(q, sup), stretch(WORKSHEET_MINS, sup));
    parts.push({ kind: "worksheet", id: wsQuiz.id, title: wsQuiz.title, minutes: m });
    worksheetNoteIds.push(wsQuiz.id); assessmentId = q.id; mainTitle = wsQuiz.title;
    chips.push("worksheet", "quiz");
    if (!ever.has(q.id)) chips.push("fresh");
  } else if (bestQuiz) {
    parts.push({ kind: "quiz", id: bestQuiz.id, title: bestQuiz.title, minutes: quizMins(bestQuiz, sup) });
    assessmentId = bestQuiz.id; mainTitle = bestQuiz.title; chips.push("quiz");
    if (!ever.has(bestQuiz.id)) chips.push("fresh");
  } else if (ws[0]) {
    parts.push({ kind: "worksheet", id: ws[0].id, title: ws[0].title, minutes: stretch(WORKSHEET_MINS, sup) });
    worksheetNoteIds.push(ws[0].id); mainTitle = ws[0].title; chips.push("worksheet");
  }

  // Recap lesson for the shakiest topics (or when we only have a diagnostic baseline).
  let recapTitle: string | null = null;
  if (signal.pct < RECAP_BELOW_PCT || signal.baselineOnly) {
    const lesson = notes.filter((n) => n.isLesson && yearOk(n) && !worksheetNoteIds.includes(n.id))
      .sort((a, b) => yearDist(a) - yearDist(b) || a.readMinutes - b.readMinutes || a.title.localeCompare(b.title))[0];
    if (lesson) {
      parts.unshift({ kind: "lesson", id: lesson.id, title: lesson.title, minutes: stretch(Math.max(3, lesson.readMinutes), sup) });
      noteIds.push(lesson.id); recapTitle = lesson.title; chips.unshift("recap", "lesson");
      if (!mainTitle) mainTitle = lesson.title;
    }
  }
  if (!parts.length) return null;
  if (signal.lastAttemptAt && daysBetween(signal.lastAttemptAt, input.now) >= STALE_DAYS) chips.unshift("stale");
  chips.unshift("weak");
  if (signal.total && signal.weakCount !== undefined) chips.push("groupShare");
  if (sup.noTimer) chips.push("untimed"); else if (sup.extraTimePercent) chips.push("extraTime");
  if (sup.calm) chips.push("calm");
  return { signal, score, topic, parts, assessmentId, noteIds, worksheetNoteIds, minutes: parts.reduce((a, p) => a + p.minutes, 0), chips, recapTitle, mainTitle };
}

function reasonFor(s: TopicSignal, label: string, now: Date): PlanReason {
  const daysAgo = s.lastAttemptAt ? daysBetween(s.lastAttemptAt, now) : null;
  if (s.total && s.weakCount !== undefined && s.total > 1) return { kind: "group", topic: label, pct: s.pct, daysAgo, weak: s.weakCount, total: s.total, attempts: s.attempts };
  if (s.baselineOnly) return { kind: "baseline", topic: label, pct: s.pct, daysAgo, attempts: 0 };
  if (daysAgo !== null && daysAgo >= STALE_DAYS) return { kind: "stale", topic: label, pct: s.lastPct ?? s.pct, daysAgo, attempts: s.attempts };
  return { kind: "scored", topic: label, pct: s.lastPct ?? s.pct, daysAgo, attempts: s.attempts };
}

export function reasonText(r: PlanReason): string {
  const when = whenText(r.daysAgo);
  switch (r.kind) {
    case "group": return `${r.weak} of ${r.total} students are below ${SECURE_PCT}% on ${r.topic} (average ${r.pct}%)`;
    case "baseline": return `Placement test showed ${r.pct}% on ${r.topic}, with no quiz on it yet`;
    case "stale": return `Scored ${r.pct}% on ${r.topic} ${when}, not revisited since`;
    default: return `Scored ${r.pct}% on ${r.topic}${when ? ` ${when}` : ""}`;
  }
}

/** School days (Mon-Fri) starting TOMORROW within `days` calendar days; all days if that leaves none. */
export function planDays(now: Date, days: number): string[] {
  const all: Date[] = [];
  for (let i = 1; i <= days; i++) all.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i)));
  const school = all.filter((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6);
  return (school.length ? school : all).map(isoDay);
}

const gentle = (s: PlanSupport) => (s.calm ? " Take your time; there is no rush and no score to beat." : "");

function instructionsFor(d: Draft, dueDay: string): string {
  const lesson = d.parts.find((p) => p.kind === "lesson");
  const work = d.parts.filter((p) => p.kind !== "lesson");
  const bits: string[] = [];
  if (lesson) bits.push(`First read or watch "${lesson.title}".`);
  for (const p of work) bits.push(p.kind === "quiz" ? `${lesson ? "Then do" : "Do"} the quiz "${p.title}".` : `${lesson ? "Then work" : "Work"} through the worksheet "${p.title}".`);
  void dueDay;
  return `${bits.join(" ")} About ${d.minutes} minutes.`.trim();
}

export function buildPlan(input: PlanInput): PlanOut {
  const days = Math.max(1, Math.min(14, Math.floor(input.days) || 7));
  const perDayRaw = Math.max(5, Math.min(90, Math.floor(input.minutesPerDay ?? DEFAULT_MINUTES_PER_DAY)));
  const budget = input.support.calm ? Math.max(5, Math.round(perDayRaw * 0.75)) : perDayRaw;
  const maxPerDay = input.support.calm ? 1 : 2;
  const dayList = planDays(input.now, days);
  const capacity = dayList.length * maxPerDay;

  const ranked = input.signals
    .map((s) => ({ s, score: weaknessScore(s, input.now, input.recentTopics?.get(s.topicId)) }))
    .filter((x) => x.score > 0 && input.topics.has(x.s.topicId))
    .sort((a, b) => b.score - a.score || (a.s.pct - b.s.pct) || a.s.topicId.localeCompare(b.s.topicId));

  const gaps: PlanGap[] = [];
  const drafts: Draft[] = [];
  for (const { s, score } of ranked) {
    if (drafts.length >= capacity) { gaps.push({ topicId: s.topicId, topicLabel: topicLabel(input.topics.get(s.topicId)!), subject: input.topics.get(s.topicId)!.subject, pct: s.pct, why: "no_room" }); continue; }
    const topic = input.topics.get(s.topicId)!;
    const d = pickContent(s, topic, score, input);
    if (d) drafts.push(d);
    else gaps.push({ topicId: s.topicId, topicLabel: topicLabel(topic), subject: topic.subject, pct: s.pct, why: "no_content" });
  }

  // Place each draft (rank order) on the least-loaded day with room; avoid the same subject as the day before.
  const load = new Map<string, number>(dayList.map((d) => [d, 0]));
  const count = new Map<string, number>(dayList.map((d) => [d, 0]));
  const subjectOn = new Map<string, Set<string>>(dayList.map((d) => [d, new Set()]));
  const placed: { d: Draft; day: string }[] = [];
  for (const d of drafts) {
    // Over budget on its own: drop the recap lesson first, then defer if still > 1.5 x budget.
    if (d.minutes > budget && d.noteIds.length) {
      const lesson = d.parts.find((p) => p.kind === "lesson");
      if (lesson && d.parts.length > 1) {
        d.parts = d.parts.filter((p) => p !== lesson); d.noteIds = []; d.minutes = d.parts.reduce((a, p) => a + p.minutes, 0);
        d.chips = d.chips.filter((c) => c !== "recap" && c !== "lesson"); d.recapTitle = null;
      }
    }
    if (d.minutes > budget * 1.5) { gaps.push({ topicId: d.signal.topicId, topicLabel: topicLabel(d.topic), subject: d.topic.subject, pct: d.signal.pct, why: "no_room" }); continue; }
    const options = dayList
      .map((day, i) => ({ day, i, l: load.get(day)!, c: count.get(day)! }))
      .filter((o) => o.c < maxPerDay && (o.c === 0 || o.l + d.minutes <= budget));
    if (!options.length) { gaps.push({ topicId: d.signal.topicId, topicLabel: topicLabel(d.topic), subject: d.topic.subject, pct: d.signal.pct, why: "no_room" }); continue; }
    const clash = (i: number) => {
      const near = [dayList[i - 1], dayList[i + 1], dayList[i]].filter(Boolean) as string[];
      return near.some((x) => subjectOn.get(x)!.has(d.topic.subject)) ? 1 : 0;
    };
    options.sort((a, b) => a.l - b.l || clash(a.i) - clash(b.i) || a.i - b.i);
    const pick = options[0];
    load.set(pick.day, pick.l + d.minutes); count.set(pick.day, pick.c + 1); subjectOn.get(pick.day)!.add(d.topic.subject);
    placed.push({ d, day: pick.day });
  }

  placed.sort((a, b) => a.day.localeCompare(b.day) || b.d.score - a.d.score);
  const items: PlanItem[] = placed.map(({ d, day }, i) => {
    const label = topicLabel(d.topic);
    const reason = reasonFor(d.signal, label, input.now);
    const title = d.recapTitle ? `Recap and practice: ${label}` : `Practice: ${label}`;
    return {
      id: `plan:${d.signal.topicId}:${i}`, rank: 0, topicId: d.signal.topicId, subject: d.topic.subject, topicLabel: label, score: d.score,
      title, instructions: instructionsFor(d, day) + gentle(input.support), dueAt: `${day}T17:00:00.000Z`, dueDay: day,
      assessmentId: d.assessmentId, noteIds: d.noteIds, worksheetNoteIds: d.worksheetNoteIds, minutes: d.minutes,
      reason, reasonText: reasonText(reason), chips: [...new Set(d.chips)], parts: d.parts,
    };
  });
  // rank = position by weakness (1 = weakest), independent of the day it landed on.
  [...items].sort((a, b) => b.score - a.score).forEach((it, i) => { it.rank = i + 1; });
  return {
    items,
    gaps,
    summary: { days: dayList.length, minutesPerDay: budget, totalMinutes: items.reduce((a, x) => a + x.minutes, 0), weakTopics: ranked.length, considered: input.signals.length },
  };
}
