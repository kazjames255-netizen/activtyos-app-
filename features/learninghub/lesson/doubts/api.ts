import { get, post } from "@/lib/api";

// "Ask my teacher" — a real two-way thread a family raises from wherever they are in a lesson (a slide, a
// warm-up/quiz question), tied to the exact spot it was asked from. The tutor answers (and either side can keep
// replying) from the hub's own "Questions" tab; the family sees replies pop up inside the lesson as they arrive.
// Server: server/src/routes/hub/doubtsApi.ts.

export interface DoubtMsg { from: "child" | "tutor"; text: string; byName: string; at: string }
export interface Doubt {
  id: string;
  /** Null = a general message, not tied to any particular lesson. */
  noteId: string | null; lessonTitle: string | null;
  childId: string; childName: string;
  /** Where in the lesson this was raised — a lesson step id ("slides" | "warm" | "quiz" | …) and, for a slide, its index. */
  step: string; slide: number;
  /** The exact warm-up/quiz question this was about, when it was asked from one. */
  questionId: string | null;
  /** The real text a tutor sees this was about: a question's prompt, or a slide's title. */
  questionPrompt: string | null;
  messages: DoubtMsg[]; lastAt: string;
  unreadByTutor: boolean; unreadByFamily: boolean;
  createdAt: string;
  /** Tutor inbox rows only. */
  franchiseId?: string | null;
}

export const askDoubt = (qs: string, body: { noteId?: string; lessonTitle?: string; step?: string; slide?: number; questionId?: string | null; questionPrompt?: string | null; text: string; childId?: string }) =>
  post<Doubt>(`/api/learning-hub/doubts${qs}`, body);

export const listDoubts = (qs: string, params: { noteId?: string } = {}) => {
  const p = new URLSearchParams();
  if (params.noteId) p.set("noteId", params.noteId);
  const extra = p.toString();
  return get<Doubt[]>(`/api/learning-hub/doubts${qs}${extra ? `${qs.includes("?") ? "&" : "?"}${extra}` : ""}`);
};

/** Tutor posts to a thread. */
export const replyDoubt = (qs: string, id: string, text: string) => post<Doubt>(`/api/learning-hub/doubts/${id}/reply${qs}`, { text });
/** Family posts to a thread (a follow-up, or continuing an old one). */
export const sendDoubtMessage = (qs: string, id: string, text: string) => post<Doubt>(`/api/learning-hub/doubts/${id}/message${qs}`, { text });
/** Clears the caller's own side's unread flag without posting. */
export const seenDoubt = (qs: string, id: string) => post<{ ok: true }>(`/api/learning-hub/doubts/${id}/seen${qs}`, {});
