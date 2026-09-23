import { get, post, put } from "@/lib/api";
import { hubPath, type KindRule, type TakeQuestion } from "../shared-assess/api";

// In-person lessons — the tutor's calls (server/src/routes/hub/inPersonApi.ts, docs/learning-hub.md → "In-person lessons").
// A session is a hubLessons row with mode "in_person"; results are ordinary hubAttempts (mode "in_person"), so a parent sees them
// in their child's Latest results, mastery and homework exactly like a paper the child sat themselves.

export interface IpStudent { childId: string; childName: string; present: boolean }
export interface IpWarm { childId: string; correct: number; total: number }
export interface IpSession {
  id: string; title: string; status: "live" | "ended" | "cancelled"; startsAt: string; endedAt: string | null; tutorName: string;
  noteId: string | null; assessmentId: string | null; groupIds: string[]; childIds: string[];
  attendance: Record<string, string>; students: IpStudent[]; warmup: IpWarm[];
}

export interface IpAnswerRow { questionId: string; correct: boolean | null; marksAwarded: number; marksMax: number; pending: boolean }
/** One child's outcome of a hand-in. `skipped` rows carry the gate `code` (retake_blocked, diagnostic_required, …) and the reason. */
export interface IpResult {
  childId: string; childName: string; status: "recorded" | "duplicate" | "skipped"; attemptId?: string; code?: string; message?: string;
  attemptStatus?: string; scoreMarks?: number; maxMarks?: number; pct?: number | null; passed?: boolean | null; homeworkId?: string | null; answers?: IpAnswerRow[];
}
/** A stored result (GET /in-person/sessions/:id → results). */
export interface IpStored {
  attemptId: string; childId: string; childName: string; assessmentId: string; assessmentTitle: string; status: string;
  scoreMarks: number; maxMarks: number; pct: number | null; passMarkPct: number; passed: boolean | null; homeworkId: string | null; answers: IpAnswerRow[];
}
export interface IpKey { correctAnswer?: unknown; acceptedAnswers?: string[]; explanation?: string }
export type IpQuestion = TakeQuestion & { rule: KindRule; key: IpKey };
export interface IpPaper { assessment: { id: string; title: string; type: "quiz" | "diagnostic"; subject: string; passMarkPct: number }; questions: IpQuestion[] }

/** What the tutor captured for one child on one question: an option/typed response and/or their own right/wrong call. */
export interface Cell { response?: string | string[]; verdict?: "right" | "wrong" }

const base = "/in-person/sessions";
export const listLiveSessions = (qs: string) => get<IpSession[]>(hubPath(qs, base, { status: "live" }));
export const createSession = (qs: string, body: { childIds: string[]; groupIds?: string[]; noteId?: string | null; assessmentId?: string | null; title?: string; key: string }) =>
  post<IpSession>(hubPath(qs, base), body);
export const getSession = (qs: string, id: string) => get<IpSession & { results: IpStored[] }>(hubPath(qs, `${base}/${id}`));
export const setAttendance = (qs: string, id: string, present: Record<string, boolean>, add?: string[]) =>
  put<IpSession>(hubPath(qs, `${base}/${id}/attendance`), { present, ...(add?.length ? { add } : {}) });
export const getPaper = (qs: string, id: string, assessmentId: string) => get<IpPaper>(hubPath(qs, `${base}/${id}/questions`, { assessmentId }));
export const submitClass = (qs: string, id: string, body: { assessmentId: string; children: { childId: string; answers: { questionId: string; response?: unknown; verdict?: "right" | "wrong" }[] }[]; override?: boolean; linkHomework?: boolean }) =>
  post<{ sessionId: string; assessmentId: string; results: IpResult[] }>(hubPath(qs, `${base}/${id}/submit`), body);
export const endSession = (qs: string, id: string, warmup: IpWarm[]) => post<IpSession & { results: IpStored[] }>(hubPath(qs, `${base}/${id}/end`), warmup.length ? { warmup } : {});

