// Learning Hub — mastery maths. PURE (no Firestore): the route layer loads a
// child's attempts and topics, calls these, and stores the result in `hubMastery`.
// Rules live in docs/learning-hub.md ("Mastery", "Diagnostic").

export interface Slice { got: number; max: number }

/** The parts of a stored attempt mastery cares about. */
export interface AttemptLite {
  id: string;
  assessmentType: "quiz" | "diagnostic";
  status: string;
  subject: string;
  submittedAt: string | null;
  byTopic: Record<string, Slice>;
  /** A tutor reset-baseline flags the diagnostic so it no longer sets the baseline. */
  baselineReset?: boolean;
}

export const MASTERY_WINDOW = 5;

/** Weighted mastery from per-topic slices, NEWEST FIRST: the last 5 with max>0,
 *  weight 0.5^i (newest i=0): Σw·(got/max)/Σw × 100, rounded. null = nothing yet. */
export function weightedMastery(slicesNewestFirst: Slice[]): number | null {
  const use = slicesNewestFirst.filter((s) => s.max > 0).slice(0, MASTERY_WINDOW);
  if (!use.length) return null;
  let num = 0;
  let den = 0;
  use.forEach((s, i) => { const w = Math.pow(0.5, i); num += w * (s.got / s.max); den += w; });
  return Math.round((num / den) * 100);
}

/** The highest band whose `min ≤ pct` (bands need not arrive sorted). */
export function bandFor(pct: number | null, bands: { min: number; label: string }[]): string | null {
  if (pct === null || !bands.length) return null;
  let best: { min: number; label: string } | null = null;
  for (const b of bands) if (b.min <= pct && (!best || b.min > best.min)) best = b;
  return best?.label ?? null;
}

export interface TopicMastery {
  topicId: string;
  /** Subject of the attempt(s) that produced this row. */
  subject: string;
  /** null = only a baseline exists so far (diagnostic taken, no quiz yet). */
  masteryPct: number | null;
  /** Number of marked quiz slices behind masteryPct. */
  attempts: number;
  baselinePct: number | null;
  lastAttemptAt: string | null;
}

const byNewest = (a: AttemptLite, b: AttemptLite) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");

/** Per-subject baseline: the EARLIEST marked, not-reset diagnostic sets it, once —
 *  a later diagnostic never overwrites it (only a reset flag lets a retake replace it). */
export function baselines(attempts: AttemptLite[]): Map<string, { subject: string; pct: number }> {
  const out = new Map<string, { subject: string; pct: number }>(); // topicId → baseline
  const bySubject = new Set<string>();
  const diag = attempts
    .filter((a) => a.assessmentType === "diagnostic" && a.status === "marked" && !a.baselineReset && a.submittedAt)
    .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  for (const a of diag) {
    const key = a.subject.toLowerCase();
    if (bySubject.has(key)) continue;
    bySubject.add(key);
    for (const [topicId, s] of Object.entries(a.byTopic ?? {})) {
      if (s.max > 0) out.set(topicId, { subject: a.subject, pct: Math.round((s.got / s.max) * 100) });
    }
  }
  return out;
}

/** Rebuild every per-topic mastery row for ONE child from their attempts.
 *  Quiz attempts (status "marked") feed the trend; diagnostics only set the baseline. */
export function computeTopicMastery(attempts: AttemptLite[]): Map<string, TopicMastery> {
  const quizzes = attempts.filter((a) => a.assessmentType === "quiz" && a.status === "marked" && a.submittedAt).sort(byNewest);
  const perTopic = new Map<string, { subject: string; slices: Slice[]; last: string }>();
  for (const a of quizzes) {
    for (const [topicId, s] of Object.entries(a.byTopic ?? {})) {
      if (!(s.max > 0)) continue;
      const e = perTopic.get(topicId) ?? { subject: a.subject, slices: [], last: a.submittedAt! };
      e.slices.push(s); // already newest first
      perTopic.set(topicId, e);
    }
  }
  const base = baselines(attempts);
  const out = new Map<string, TopicMastery>();
  for (const [topicId, e] of perTopic) {
    out.set(topicId, {
      topicId, subject: e.subject, masteryPct: weightedMastery(e.slices), attempts: e.slices.length,
      baselinePct: base.get(topicId)?.pct ?? null, lastAttemptAt: e.last,
    });
  }
  for (const [topicId, b] of base) {
    if (!out.has(topicId)) out.set(topicId, { topicId, subject: b.subject, masteryPct: null, attempts: 0, baselinePct: b.pct, lastAttemptAt: null });
  }
  return out;
}

export interface SubjectRollup {
  subject: string;
  /** Mean of the attempted topics' mastery; null when none attempted. */
  masteryPct: number | null;
  /** attempted topics / topics with published content (0..1, 2dp). */
  coverage: number;
  /** Mean of the topics' baselines; null without a diagnostic. */
  baselinePct: number | null;
  /** Mean of (mastery − baseline) over topics that have both; null otherwise. */
  growthPct: number | null;
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Subject rollup from that subject's topic rows. `publishedTopics` is the number
 *  of topics in the subject that have published content (the coverage denominator);
 *  attempted topics outside that set still count so coverage never exceeds 1. */
export function rollupSubject(subject: string, rows: TopicMastery[], publishedTopics: number, publishedTopicIds?: Set<string>): SubjectRollup {
  const attempted = rows.filter((r) => r.masteryPct !== null);
  const extra = publishedTopicIds ? attempted.filter((r) => !publishedTopicIds.has(r.topicId)).length : 0;
  const denom = Math.max(publishedTopics + extra, attempted.length);
  const both = attempted.filter((r) => r.baselinePct !== null);
  return {
    subject,
    masteryPct: mean(attempted.map((r) => r.masteryPct as number)),
    coverage: denom > 0 ? Math.round((attempted.length / denom) * 100) / 100 : 0,
    baselinePct: mean(rows.filter((r) => r.baselinePct !== null).map((r) => r.baselinePct as number)),
    growthPct: both.length ? Math.round(both.reduce((a, r) => a + ((r.masteryPct as number) - (r.baselinePct as number)), 0) / both.length) : null,
  };
}

/** Last N submitted, marked QUIZ attempts (oldest → newest, for charting). */
export function trendOf<T extends { assessmentType: string; status: string; submittedAt: string | null }>(attempts: T[], n = 20): T[] {
  return attempts
    .filter((a) => a.assessmentType === "quiz" && a.status === "marked" && a.submittedAt)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
    .slice(0, n)
    .reverse();
}
