import type { HubSettings } from "@/lib/hubConfig";

// Home — pure helpers and the small shapes Home reads. Nothing here fetches or
// renders. Every rule that matters (marking, mastery, bands, join window) is
// the server's; this file only shapes rows for display.

export type Bands = HubSettings["masteryBands"];

export interface AttemptRow {
  id: string;
  assessmentId: string;
  assessmentTitle?: string;
  assessmentType?: "quiz" | "diagnostic";
  childId: string;
  childName?: string;
  status: "in_progress" | "pending_marking" | "marked";
  pct: number | null;
  passed?: boolean | null;
  subject?: string;
  submittedAt: string | null;
  startedAt?: string;
  homeworkId?: string | null;
  /** A tutor recorded this while the child sat beside them (an in-person lesson), not something the child did on a device. */
  inPerson?: boolean;
}
export interface OverviewStudent { childId: string; childName: string; subjects: { subject: string; masteryPct: number | null; band: string | null }[]; lastActive: string | null }
export interface FlashStatsLite { students: { childId: string; childName: string; due: number; new: number; reviewed: number }[] }
export interface DueLite { dueCount: number; newCount: number; upcoming: number }
export interface MasteryTopicLite { topicId: string; topic: string; subtopic: string | null; masteryPct: number | null; band: string | null; attempts: number }
export interface MasterySubjectLite { subject: string; masteryPct: number | null; band: string | null; coverage: number; growthPct: number | null; topics: MasteryTopicLite[] }
export interface MasteryLite { childId: string; childName: string; subjects: MasterySubjectLite[]; trend: { at: string; pct: number; subject: string; title: string }[]; /** The child's real attainment level (GET /mastery `overall`). */ overall?: import("../shared-assess/api").MasteryOverall | null }
export interface AssessmentLite {
  id: string; type: "quiz" | "diagnostic"; title: string; subject: string; questionCount?: number; timeLimitMins: number | null; passMarkPct: number;
  lastAttempt?: { id: string; pct: number; status: string; submittedAt: string | null } | null; done?: boolean; locked?: boolean; lockedReason?: string;
  /** Set when this quiz is the exit quiz of a lesson (take the lesson first). */
  lessonNoteId?: string | null;
}

// ── query strings ────────────────────────────────────────────────────────────
/** "/api/learning-hub/<path>" + the shell's ?tenantId= + any extra params. */
export function hubUrl(qs: string, path: string, extra: Record<string, string | null | undefined> = {}): string {
  const p = new URLSearchParams(qs.replace(/^\?/, ""));
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const s = p.toString();
  return `/api/learning-hub${path}${s ? `?${s}` : ""}`;
}

export const asArray = <T,>(r: unknown, key?: string): T[] => {
  if (Array.isArray(r)) return r as T[];
  const inner = key && r && typeof r === "object" ? (r as Record<string, unknown>)[key] : null;
  return Array.isArray(inner) ? (inner as T[]) : [];
};

// ── time ─────────────────────────────────────────────────────────────────────
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
export { DAY, HOUR, MIN };

export function relTime(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = now - t;
  if (d < 45_000) return "just now";
  if (d < HOUR) return `${Math.max(1, Math.round(d / MIN))} min ago`;
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`;
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const startOfDay = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** "Good morning" / afternoon / evening from the viewer's clock. */
export function greeting(now: number): string {
  const h = new Date(now).getHours();
  return h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export const firstName = (n: string | undefined | null) => (n ?? "").trim().split(/\s+/)[0] || "there";
export const initialsOf = (name: string) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

// ── mastery bands (from the tenant's config — labels are never assumed) ────────
export interface BandTone { fill: string; soft: string; label: string; index: number }

/** Index of the highest band whose min ≤ pct (bands arrive lowest first). */
export function bandIndex(pct: number | null | undefined, bands: Bands): number {
  if (pct == null || !bands.length) return -1;
  let best = -1;
  bands.forEach((b, i) => { if (b.min <= pct && (best < 0 || b.min > bands[best].min)) best = i; });
  return best;
}

/** Lowest third of the ladder is gold, the middle brand, the top green — same
 *  rule the Progress tab uses, so a band wears one colour across the hub. */
export function bandTone(pct: number | null | undefined, bands: Bands): BandTone | null {
  const i = bandIndex(pct, bands);
  if (i < 0) return null;
  const t = bands.length === 1 ? 0.5 : i / (bands.length - 1);
  const fill = t < 0.34 ? "var(--gold)" : t < 0.67 ? "var(--brand-2)" : "var(--green)";
  return { fill, soft: `color-mix(in srgb, ${fill} 22%, var(--surface))`, label: bands[i].label, index: i };
}

// ── attempts ─────────────────────────────────────────────────────────────────
export const attemptWhen = (a: AttemptRow) => a.submittedAt ?? a.startedAt ?? "";
const attemptMs = (a: AttemptRow) => { const t = new Date(attemptWhen(a)).getTime(); return Number.isNaN(t) ? 0 : t; };

/** Attempts per calendar day for the `days` days ending today (oldest first). Only submitted work counts. */
export function perDay(attempts: AttemptRow[], now: number, days = 14): { day: number; count: number }[] {
  const today = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, count: 0 }));
  const index = new Map(out.map((d, i) => [dayKey(d.day), i]));
  for (const a of attempts) {
    if (a.status === "in_progress" || !a.submittedAt) continue;
    const i = index.get(dayKey(new Date(a.submittedAt).getTime()));
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/** Consecutive active days ending today (or yesterday, so an evening streak isn't "lost" at breakfast). */
export function streakOf(activityMs: number[], now: number): number {
  const days = new Set(activityMs.map(dayKey));
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  let n = 0;
  while (days.has(dayKey(cursor))) { n++; cursor -= DAY; }
  return n;
}

/** Distinct days with activity in the last `days` days. */
export function activeDays(activityMs: number[], now: number, days = 14): number {
  const from = startOfDay(now) - (days - 1) * DAY;
  return new Set(activityMs.filter((t) => t >= from).map(dayKey)).size;
}

/** Latest marked quiz score vs the mean of up to 3 before it — a simple, honest "improving" signal. */
export function improvement(attempts: AttemptRow[]): { childId: string; childName: string; delta: number; latest: number }[] {
  const by = new Map<string, AttemptRow[]>();
  for (const a of attempts) if (a.status === "marked" && a.pct != null && a.assessmentType !== "diagnostic") by.set(a.childId, [...(by.get(a.childId) ?? []), a]);
  const out: { childId: string; childName: string; delta: number; latest: number }[] = [];
  for (const [childId, rows] of by) {
    rows.sort((x, y) => attemptMs(x) - attemptMs(y));
    if (rows.length < 2) continue;
    const latest = rows[rows.length - 1];
    const before = rows.slice(Math.max(0, rows.length - 4), rows.length - 1);
    const base = before.reduce((s, r) => s + (r.pct ?? 0), 0) / before.length;
    out.push({ childId, childName: latest.childName ?? "Student", delta: Math.round((latest.pct ?? 0) - base), latest: Math.round(latest.pct ?? 0) });
  }
  return out.sort((a, b) => b.delta - a.delta);
}

/** The last 7 calendar days (oldest first) and whether there was activity on each. */
export function weekDots(activityMs: number[], now: number): { day: number; letter: string; active: boolean; today: boolean }[] {
  const days = new Set(activityMs.map(dayKey));
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = today - (6 - i) * DAY;
    return { day, letter: new Date(day).toLocaleDateString("en-GB", { weekday: "narrow" }), active: days.has(dayKey(day)), today: i === 6 };
  });
}
