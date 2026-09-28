import { get, post } from "@/lib/api";

// Typed client for "Auto-plan a week" (server/src/routes/hub/planApi.ts, rules in server/src/lib/hubPlan.ts).
// The API only SUGGESTS. Nothing is set until the tutor accepts and the caller posts homework (setPlanItems / toHomeworkBody).
// No imports from other learninghub files, so it can be dropped in anywhere.

export type PlanTarget = { childId: string; groupId?: undefined } | { groupId: string; childId?: undefined };

export type PlanReasonKind = "scored" | "baseline" | "group" | "stale";
export interface PlanReason { kind: PlanReasonKind; topic: string; pct: number; daysAgo: number | null; weak?: number; total?: number; attempts: number }
export type PlanChip = "weak" | "stale" | "quiz" | "lesson" | "worksheet" | "recap" | "fresh" | "untimed" | "extraTime" | "calm" | "groupShare";
export interface PlanPart { kind: "quiz" | "lesson" | "worksheet"; id: string; title: string; minutes: number }

/** One suggested homework, already in the shape POST /homework takes (title, instructions, dueAt, assessmentId, noteIds, worksheetNoteIds). */
export interface PlanItem {
  id: string;
  /** 1 = weakest topic (independent of the day it landed on). */
  rank: number;
  topicId: string;
  subject: string;
  topicLabel: string;
  score: number;
  title: string;
  instructions: string;
  dueAt: string;
  /** YYYY-MM-DD (UTC) of dueAt. */
  dueDay: string;
  assessmentId: string | null;
  noteIds: string[];
  worksheetNoteIds: string[];
  minutes: number;
  reason: PlanReason;
  /** English fallback of the reason line; the UI renders `reason` through i18n. */
  reasonText: string;
  chips: PlanChip[];
  parts: PlanPart[];
}
export interface PlanGap { topicId: string; topicLabel: string; subject: string; pct: number; why: "no_content" | "no_room" }
export interface PlanResponse {
  target: { kind: "child"; childId: string; childName: string } | { kind: "group"; groupId: string; name: string; size: number };
  yearGroup: string | null;
  generatedAt: string;
  support: { noTimer: boolean; extraTimePercent: number; calm: boolean };
  items: PlanItem[];
  gaps: PlanGap[];
  summary: { days: number; minutesPerDay: number; totalMinutes: number; weakTopics: number; considered: number };
}

const qsOf = (qs: string, extra: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams(qs.replace(/^\?/, ""));
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** GET /api/learning-hub/plan/suggest. `qs` = the panel's tenant scope string ("" or "?tenantId=…"), like the other hub panels. */
export function suggestPlan(target: PlanTarget, opts: { qs?: string; days?: number; minutesPerDay?: number; subject?: string } = {}): Promise<PlanResponse> {
  return get<PlanResponse>(`/api/learning-hub/plan/suggest${qsOf(opts.qs ?? "", { childId: target.childId, groupId: target.groupId, days: opts.days ?? 7, minutesPerDay: opts.minutesPerDay, subject: opts.subject })}`);
}

/** The POST /homework body for one accepted item (children and/or groups it is for). `dueAt` is the suggested day; pass an override to move it. */
export function toHomeworkBody(item: PlanItem, to: { childIds?: string[]; groupIds?: string[] }, overrides: Partial<{ dueAt: string; title: string; instructions: string }> = {}) {
  return {
    title: overrides.title ?? item.title,
    instructions: overrides.instructions ?? item.instructions,
    dueAt: overrides.dueAt ?? item.dueAt,
    assessmentId: item.assessmentId,
    noteIds: item.noteIds,
    worksheetNoteIds: item.worksheetNoteIds,
    assignedChildIds: to.childIds ?? [],
    ...(to.groupIds?.length ? { assignedGroupIds: to.groupIds } : {}),
  };
}

/** Convenience: post each accepted item as its own homework (sequential; stops at the first failure and reports how many landed). */
export async function setPlanItems(items: PlanItem[], to: { childIds?: string[]; groupIds?: string[] }, qs = ""): Promise<{ done: number }> {
  let done = 0;
  for (const it of items) {
    await post(`/api/learning-hub/homework${qsOf(qs, {})}`, toHomeworkBody(it, to));
    done++;
  }
  return { done };
}
