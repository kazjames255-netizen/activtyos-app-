import type { HubSettings } from "@/lib/hubConfig";
import type { Assessment, AttemptRow } from "../shared-assess/api";

// Read-only roll-ups for the tutor's assessment cards. Everything is derived from
// rows the API already returned (GET /attempts, /questions); no domain rule lives
// here (pass / fail comes from each row's server-set `passed` where present).

export const BUCKETS = 5;

export interface AssessStats {
  /** Handed-in papers (marked or waiting). */
  attempts: number;
  /** Marked papers with a score. */
  marked: number;
  toMark: number;
  students: number;
  avg: number | null;
  /** Count of marked scores per 20-point band: 0-19, 20-39, 40-59, 60-79, 80-100. */
  dist: number[];
  passed: number;
}

export function statsFor(a: Assessment, rows: AttemptRow[]): AssessStats {
  const mine = rows.filter((r) => r.assessmentId === a.id && r.status !== "in_progress");
  const marked = mine.filter((r) => r.status === "marked" && r.pct != null);
  const dist = Array.from({ length: BUCKETS }, () => 0);
  for (const r of marked) dist[Math.min(BUCKETS - 1, Math.floor((r.pct ?? 0) / (100 / BUCKETS)))]++;
  const avg = marked.length ? marked.reduce((s, r) => s + (r.pct ?? 0), 0) / marked.length : null;
  return {
    attempts: mine.length, marked: marked.length, toMark: mine.filter((r) => r.status === "pending_marking").length,
    students: new Set(mine.map((r) => r.childId)).size, avg, dist,
    passed: marked.filter((r) => r.passed === true).length,
  };
}

/** "3 Multiple choice · 1 Written" — how an assessment's questions break down by kind (from the list row's `kindCounts`). */
export function kindMix(a: Assessment, kinds: HubSettings["questionKinds"]): { label: string; n: number }[] {
  return Object.entries(a.kindCounts ?? {}).map(([k, n]) => ({ label: kinds.find((x) => x.id === k)?.label ?? k, n })).sort((x, y) => y.n - x.n);
}
