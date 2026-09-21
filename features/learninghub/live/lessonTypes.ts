// Live lessons — shapes mirror docs/learning-hub.md (`hubLessons` + the lessons
// endpoints). The server owns every rule (join window, room privacy); the
// helpers here only MIRROR the window so the UI can enable/disable the Join
// button — the API is still the enforcer.

import type { HubVideo } from "../types";

export type LessonStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface Lesson {
  id: string;
  title: string;
  topicId: string | null;
  startsAt: string;
  durationMins: number;
  childIds: string[];
  /** Names for childIds (a family only ever gets its own children). */
  students?: { childId: string; childName: string }[];
  status: LessonStatus;
  tutorUid?: string;
  tutorName?: string;
  /** Free text the tutor leaves for the students. */
  notes?: string;
  /** YouTube videos (≤6) and the groups it was scheduled for (display only). */
  videos?: HubVideo[];
  groupIds?: string[];
  /** Existing hub notes the tutor attached to this lesson (≤12). */
  noteIds?: string[];
  /** Server-computed join window (ISO) — `closesAt` already includes any "Stay on the call" extension. */
  opensAt?: string;
  closesAt?: string;
  /** True for any non-cancelled lesson inside the window, including status "ended" (people can re-enter). */
  joinable?: boolean;
  /** Tutor rows: childId → ISO of the first time that child's family joined. */
  attendance?: Record<string, string>;
  /** Family rows: has one of my children joined? */
  attended?: boolean;
  /** Tutor rows: a weekly repeat shares `seriesId`; `held` = logged after it happened (no room). */
  seriesId?: string | null;
  seriesIndex?: number | null;
  seriesCount?: number | null;
  held?: boolean;
  /** Family rows: the tutor ended (or reopened) the lesson and hasn't come back in — families can't (re)join until they do. */
  waitingForTutor?: boolean;
}

export interface JoinInfo {
  url: string; token: string; roomName: string; userName: string; isOwner: boolean;
  /** ISO — when the room disconnects everyone (the scheduled end + 2 min, later if anyone pressed Stay). */
  roomExpiresAt?: string;
  /** Show the "stay on the call?" prompt this many seconds before roomExpiresAt. */
  promptSeconds?: number;
  /** ISO — the scheduled end. */
  endsAt?: string;
}

export const JOIN_BEFORE_MS = 10 * 60_000;
export const JOIN_AFTER_MS = 30 * 60_000;

/** upcoming: before the window · open: joinable (pre-start, live, grace after, or ENDED-but-rejoinable) · ended/cancelled: done. */
export type Phase = "upcoming" | "open" | "ended" | "cancelled";

export interface LessonTiming {
  phase: Phase;
  startMs: number;
  endMs: number;
  opensMs: number;
  closesMs: number;
  /** In the join window but the scheduled start hasn't come yet. */
  early: boolean;
  /** Between the scheduled start and end. */
  inProgress: boolean;
  /** The lesson was ended (or everyone left) but the join window is still open — anyone can step back in. */
  rejoin: boolean;
}

export function lessonTiming(l: Pick<Lesson, "startsAt" | "durationMins" | "status"> & { closesAt?: string }, now: number): LessonTiming {
  const startMs = new Date(l.startsAt).getTime();
  const endMs = startMs + l.durationMins * 60_000;
  const opensMs = startMs - JOIN_BEFORE_MS;
  // The server's closesAt already carries any "Stay" extension; fall back to the default window.
  const serverClose = l.closesAt ? new Date(l.closesAt).getTime() : NaN;
  const closesMs = Number.isFinite(serverClose) ? Math.max(serverClose, endMs + JOIN_AFTER_MS) : endMs + JOIN_AFTER_MS;
  let phase: Phase;
  if (l.status === "cancelled") phase = "cancelled";
  else if (now > closesMs) phase = "ended";
  else if (now >= opensMs) phase = "open";
  else phase = "upcoming";
  // "Ended" is no longer terminal: inside the window (and past the start) it's just a rejoinable state.
  const rejoin = l.status === "ended" && phase === "open" && now >= startMs;
  return { phase, startMs, endMs, opensMs, closesMs, early: now < startMs, inProgress: now >= startMs && now <= endMs, rejoin };
}

export type JoinFailure = "not_open" | "ended" | "unavailable" | "forbidden" | "waiting" | "child" | "other";

/** Map a failed POST /join to a friendly state. The API's `code` is authoritative; status + message are only the fallback for
 *  an older server or a proxy error that carries no code. */
export function classifyJoinError(status: number | undefined, message: string, code?: string): JoinFailure {
  switch (code) {
    case "waiting_for_tutor": return "waiting";
    case "child_required": return "child";
    case "not_your_lesson": return "forbidden";
    case "outside_join_window": return "not_open";
    case "lesson_closed": return "ended";
    case "video_unavailable": return "unavailable";
  }
  if (status === 503 || /video_unavailable|unavailable/i.test(message)) return "unavailable";
  if (status === 410 || /\bended\b|cancel|has closed/i.test(message)) return "ended";
  if (status === 404) return "forbidden"; // a lesson that isn't yours (a second guardian) — retrying can never work
  if (status === 403 || status === 409 || status === 425 || /window|not open|too early|opens/i.test(message)) return /not.*enrol|forbidden/i.test(message) ? "forbidden" : "not_open";
  return "other";
}

/** One clear state for the hero / rows / lobby (derived from the join window):
 *  upcoming (window not open) → soon (open, before the start) → live (in the
 *  scheduled slot) → grace (past the scheduled end but still joinable) → rejoin (status
 *  "ended" but the window is still open) → ended (window closed). */
export type Stage = "upcoming" | "soon" | "live" | "grace" | "rejoin" | "ended" | "cancelled";

export function lessonStage(l: Pick<Lesson, "startsAt" | "durationMins" | "status"> & { closesAt?: string }, now: number): Stage {
  const t = lessonTiming(l, now);
  if (t.phase === "cancelled") return "cancelled";
  if (t.phase === "ended") return "ended";
  if (t.phase === "upcoming") return "upcoming";
  if (t.rejoin) return "rejoin";
  return t.early ? "soon" : t.inProgress ? "live" : "grace";
}
