import { get, post, patch } from "@/lib/api";
import { hubPath } from "../shared-assess/api";

// "Start lesson now (remote)" — server/src/routes/hub/remoteSyncApi.ts. A session is a hubLessons row with
// mode "remote_sync", so it rides the same realtime channel as everything else in hubLessons
// (useRealtime(["hubLessons"], …)). Sibling of features/learninghub/inperson/api.ts.

/** How the class moves through the lesson — chosen once, when the tutor starts the session. See remoteSyncApi.ts's file
 *  header for what each does; "own_pace" is the default (closest to how this worked before pacing existed). */
export type RsPace = "driven" | "lockstep" | "own_pace";

export interface RsStudent { childId: string; childName: string; connected: boolean; lastSeenAt: string | null }
/** "own_pace" only: one connected child's in-progress warm-up/quiz answer, for the tutor's live mini-screens. */
export interface RsLiveAnswer { childId: string; childName: string; questionId: string; response: unknown; updatedAt: string }
export interface RsSession {
  id: string; title: string; status: "live" | "ended" | "cancelled"; startsAt: string; endedAt: string | null;
  tutorName: string; noteId: string; groupIds: string[]; childIds: string[]; step: string; slide: number; pace: RsPace;
  students: RsStudent[]; connectedCount: number; totalCount: number; liveAnswers: RsLiveAnswer[];
}
/** What a family's device gets — no roster, just where to follow (and the pace, so it knows whether to follow at all). */
export interface RsActive { id: string; title: string; status: "live" | "ended" | "cancelled"; tutorName: string; noteId: string; step: string; slide: number; pace: RsPace }

const base = "/remote-sync/sessions";

export const startRemoteSync = (qs: string, body: { noteId: string; childIds: string[]; groupIds?: string[]; title?: string; key: string; pace: RsPace }) =>
  post<RsSession>(hubPath(qs, base), body);
export const getRemoteSync = (qs: string, id: string) => get<RsSession>(hubPath(qs, `${base}/${id}`));
export const patchProgress = (qs: string, id: string, step: string, slide: number) => patch<{ ok: true }>(hubPath(qs, `${base}/${id}/progress`), { step, slide });
export const endRemoteSync = (qs: string, id: string) => post<RsSession>(hubPath(qs, `${base}/${id}/end`), {});

/** Family side: the live session (if any) covering one of this parent's enrolled children — poll + realtime refetch. */
export const activeRemoteSync = (qs: string) => get<RsActive | null>(hubPath(qs, "/remote-sync/active"));
export const heartbeat = (qs: string, id: string, childId: string) => post<RsActive>(hubPath(qs, `${base}/${id}/heartbeat`), { childId });
/** "own_pace": tell the tutor's mini-screen what this child currently has selected/typed. Debounced by the caller — this
 *  is meant to be cheap and chatty, not exact. */
export const patchLiveAnswer = (qs: string, id: string, childId: string, questionId: string, response: unknown) =>
  patch<{ ok: true }>(hubPath(qs, `${base}/${id}/live-answer`), { childId, questionId, response });
