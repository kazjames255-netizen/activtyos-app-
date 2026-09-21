import { groupMemberIds, type HubGroup } from "./types";
import type { RawRows } from "./useRosterInsights";

// What a group's Homework / Quiz / Lesson tiles say, and which rows a group-filtered tab shows.
//
// ONE rule of relevance (used by the tiles AND by the Homework / Quizzes / Live lessons filters, so a
// tile's count and the list it opens can never disagree): an item is relevant to group G if it was set
// for G (its `groupIds` includes G.id) OR it has a non-empty audience and EVERY child in that audience
// is a member of G. Anything else is hidden when a tab is filtered to G. Nothing here derives a domain
// rule — marking, due dates and lesson windows are the server's; this only sorts existing rows by group.

export const membersOf = (g: HubGroup): Set<string> => new Set(groupMemberIds(g));

export function relevantTo(g: HubGroup, members: Set<string>, groupIds: string[] | undefined, audience: string[] | undefined): boolean {
  if (groupIds?.includes(g.id)) return true;
  return !!audience && audience.length > 0 && audience.every((id) => members.has(id));
}

/** A homework doc is a "quiz" when it carries an assessment (contract §7: "set a quiz" = homework with assessmentId). */
export const isQuizHw = (h: { assessmentId: string | null }) => !!h.assessmentId;

const ms = (iso: string | null | undefined) => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isNaN(t) ? 0 : t; };

export interface GroupStatus {
  /** null = the data isn't available (endpoint failed) → the tile renders without a status. */
  homework: { set: number; open: number | null; toMark: number; overdue: number; marked: number } | null;
  quiz: { set: number; avg: number | null; results: number; toMark: number } | null;
  lesson: { kind: "live" | "next" | "past" | "none"; at: number; title: string } | null;
}

export function groupStatus(g: HubGroup, raw: RawRows, now: number): GroupStatus {
  const members = membersOf(g);
  const out: GroupStatus = { homework: null, quiz: null, lesson: null };

  if (raw.homework) {
    const rel = raw.homework.filter((h) => relevantTo(g, members, h.groupIds, h.assignedChildIds));
    const hw = rel.filter((h) => !isQuizHw(h));
    const quizzes = rel.filter(isQuizHw);
    const hwIds = new Set(hw.map((h) => h.id));
    const quizHw = new Set(quizzes.map((h) => h.id));
    const quizAssess = new Set(quizzes.map((h) => h.assessmentId as string));

    // Homework: the members' hand-ins (a homework can also be set for other students — those aren't this group's).
    let open: number | null = null, toMark = 0, overdue = 0, marked = 0;
    if (raw.inbox) {
      const openHw = new Set<string>(), overdueHw = new Set<string>();
      for (const r of raw.inbox) {
        if (!hwIds.has(r.homeworkId) || !members.has(r.childId)) continue;
        if (r.status === "marked") { marked++; continue; }
        openHw.add(r.homeworkId);
        if (r.status === "submitted") toMark++;
        else if (r.status === "assigned" && ms(r.dueAt) && ms(r.dueAt) < now) overdueHw.add(r.homeworkId);
      }
      open = openHw.size; overdue = overdueHw.size;
    }
    out.homework = { set: hw.length, open, toMark, overdue, marked };

    // Quiz: distinct quizzes set for the group, and how the MEMBERS did on those.
    let sum = 0, results = 0, qToMark = 0;
    for (const a of raw.attempts ?? []) {
      if (!members.has(a.childId) || !(quizAssess.has(a.assessmentId) || (a.homeworkId && quizHw.has(a.homeworkId)))) continue;
      if (a.status === "pending_marking") qToMark++;
      else if (a.status === "marked" && typeof a.pct === "number") { sum += a.pct; results++; }
    }
    out.quiz = { set: quizAssess.size, avg: results ? Math.round(sum / results) : null, results, toMark: qToMark };
  }

  if (raw.lessons) {
    let live: { at: number; title: string } | null = null, next: { at: number; title: string } | null = null, past = 0;
    for (const l of raw.lessons) {
      if (l.status === "cancelled" || !relevantTo(g, members, l.groupIds, l.childIds)) continue;
      const start = ms(l.startsAt), end = start + l.durationMins * 60_000;
      if (!start) continue;
      if (l.status === "ended" || now > end + 30 * 60_000) { past++; continue; }
      if (now >= start && now <= end) { if (!live || start < live.at) live = { at: start, title: l.title }; }
      else if (!next || start < next.at) next = { at: start, title: l.title };
    }
    out.lesson = live ? { kind: "live", ...live } : next ? { kind: "next", ...next } : past ? { kind: "past", at: 0, title: "" } : { kind: "none", at: 0, title: "" };
  }
  return out;
}

/** "Today 14:00", "Tomorrow 09:30", "Sat 14:00", or "12 Oct 14:00" when it's more than a week away. */
export function shortWhen(at: number, now: number): string {
  const d = new Date(at), n = new Date(now);
  const day0 = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(n)) / 86_400_000);
  const clock = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (diff === 0) return `Today ${clock}`;
  if (diff === 1) return `Tomorrow ${clock}`;
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${clock}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${clock}`;
}
