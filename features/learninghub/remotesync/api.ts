import { get, post, patch } from "@/lib/api";
import { hubPath } from "../shared-assess/api";
import type { HelpToolId } from "./HelpTools";

// "Start lesson now (remote)" — server/src/routes/hub/remoteSyncApi.ts. A session is a hubLessons row with
// mode "remote_sync", so it rides the same realtime channel as everything else in hubLessons
// (useRealtime(["hubLessons"], …)). Sibling of features/learninghub/inperson/api.ts.

/** How the class moves through the lesson — chosen once, when the tutor starts the session. See remoteSyncApi.ts's file
 *  header for what each does; "own_pace" is the default (closest to how this worked before pacing existed). */
export type RsPace = "driven" | "lockstep" | "own_pace";

export interface RsStudent { childId: string; childName: string; connected: boolean; lastSeenAt: string | null }
/** "own_pace" only: one connected child's REAL current position, for the tutor's live mini-screens — reported
 *  continuously (every step/slide change), not just during warm-up/quiz. `questionId`/`questionPrompt`/`response`
 *  (and, warm-up only, `verdict`) are only present while that child is actually on warm-up/quiz. */
export interface RsLiveAnswer {
  childId: string; childName: string; step: string; slide: number;
  questionId?: string; questionPrompt?: string; response?: unknown;
  /** Warm-up only: the Check verdict for their current answer, once known. Always null for the real quiz — its
   *  correctness isn't known until submission, so this never fakes a per-question result there. */
  verdict: boolean | null;
  updatedAt: string;
}
export interface RsSession {
  id: string; title: string; status: "live" | "ended" | "cancelled"; startsAt: string; endedAt: string | null;
  tutorName: string; noteId: string; groupIds: string[]; childIds: string[]; step: string; slide: number; pace: RsPace;
  students: RsStudent[]; connectedCount: number; totalCount: number; liveAnswers: RsLiveAnswer[];
  /** The small, fixed "help board" the tutor opted this class into (calculator, number line…) — see HelpTools.tsx. */
  tools: HelpToolId[];
}
/** What a family's device gets — no roster, just where to follow (and the pace, so it knows whether to follow at all). */
export interface RsActive { id: string; title: string; status: "live" | "ended" | "cancelled"; tutorName: string; noteId: string; step: string; slide: number; pace: RsPace; tools: HelpToolId[] }

const base = "/remote-sync/sessions";

/** Sessions this tutor left broadcasting (e.g. a refreshed/closed tab never called End) — RemoteSyncApp checks this on
 *  mount, scoped to the lesson being opened, so a tutor can resume into TutorRunner instead of losing the class.
 *  `noteId` omitted = every live session in the tutor's scope (TutorLiveBanner's "you're broadcasting — rejoin"). */
export const listLiveRemoteSync = (qs: string, noteId?: string) => get<RsSession[]>(hubPath(qs, base, { status: "live", ...(noteId ? { noteId } : {}) }));
export const startRemoteSync = (qs: string, body: { noteId: string; childIds: string[]; groupIds?: string[]; title?: string; key: string; pace: RsPace; tools?: HelpToolId[] }) =>
  post<RsSession>(hubPath(qs, base), body);
export const getRemoteSync = (qs: string, id: string) => get<RsSession>(hubPath(qs, `${base}/${id}`));
/** Returning to an already-live session (TutorLiveBanner's Rejoin, or reopening "Share with children" on this
 *  lesson): add students to the class already running, and/or change which help tools it has, rather than it
 *  looking like starting a second one. `childIds` is unioned server-side with whoever's already in — safe to pass
 *  the whole current picker selection. `tools` REPLACES the set (omit to leave it as it is). */
export const updateRemoteSyncSession = (qs: string, id: string, body: { childIds?: string[]; tools?: HelpToolId[] }) =>
  patch<RsSession>(hubPath(qs, `${base}/${id}/students`), body);
export const patchProgress = (qs: string, id: string, step: string, slide: number) => patch<{ ok: true }>(hubPath(qs, `${base}/${id}/progress`), { step, slide });
export const endRemoteSync = (qs: string, id: string) => post<RsSession>(hubPath(qs, `${base}/${id}/end`), {});

/** Family side: the live session (if any) covering one of this parent's enrolled children — poll + realtime refetch. */
export const activeRemoteSync = (qs: string) => get<RsActive | null>(hubPath(qs, "/remote-sync/active"));
export const heartbeat = (qs: string, id: string, childId: string) => post<RsActive>(hubPath(qs, `${base}/${id}/heartbeat`), { childId });
/** What JoinRemoteSyncBanner reports for the current pupil, on every step/slide change AND (debounced, more often)
 *  every warm-up/quiz answer change — the shape LessonPlayer's `onLiveAnswer` prop hands back. */
export interface LiveAnswerReport { step: string; slide: number; questionId?: string; questionPrompt?: string; response?: unknown; verdict?: boolean | null }

/** "own_pace": tell the tutor's mini-screen this child's REAL current position — cheap and chatty, debounced by the
 *  caller. Each call replaces the child's whole live-answer entry server-side, so moving off warm/quiz correctly
 *  drops the stale question/response/verdict rather than leaving a stale one on screen. */
export const patchLiveAnswer = (qs: string, id: string, childId: string, p: LiveAnswerReport) =>
  patch<{ ok: true }>(hubPath(qs, `${base}/${id}/live-answer`), { childId, ...p });
