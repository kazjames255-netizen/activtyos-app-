import { get, patch, post } from "@/lib/api";
import { hubPath, type Option, type Pic, type Result, type StartedAttempt, type TakeQuestion } from "../shared-assess/api";

// The lesson player's calls. The exit quiz uses the REAL attempt endpoints (start → submit), so its result, mastery and retake
// rules are the server's; only the warm-up has its own two (server/src/routes/hub/lessonApi.ts). No answer key ever arrives
// before a pupil commits an answer.

/** A warm-up question as a pupil gets it: a normal take-question plus an optional hint. */
export type WarmupQuestion = TakeQuestion & { hint?: string };
export interface LessonQuestions { warmup: WarmupQuestion[]; quiz: { id: string; title: string; questionCount: number } | null }

/** The verdict on one warm-up answer. `correctAnswer` / `explanation` only when the tenant's reveal policy allows. */
export interface WarmupCheck {
  questionId: string; correct: boolean | null; pending: boolean; marksAwarded: number; marksMax: number;
  correctAnswer?: unknown; acceptedAnswers?: string[]; explanation?: string;
}

const noteUrl = (id: string, tail: string, childQs: string) => `/api/learning-hub/notes/${id}/${tail}${childQs}`;

/** `quizSet`: a tutor preview asks for the exit quiz's questions (practice only — the server refuses this for families). */
const withSet = (qs: string, quizSet?: boolean) => (quizSet ? `${qs}${qs.includes("?") ? "&" : "?"}set=quiz` : qs);
export const fetchLessonQuestions = (noteId: string, childQs: string, quizSet?: boolean) => get<LessonQuestions>(noteUrl(noteId, "lesson-questions", withSet(childQs, quizSet)));
export const checkWarmup = (noteId: string, childQs: string, questionId: string, response: unknown, quizSet?: boolean) =>
  post<WarmupCheck>(noteUrl(noteId, "warmup-check", withSet(childQs, quizSet)), { questionId, response });

export const startQuizAttempt = (qs: string, quizId: string, childId: string, homeworkId?: string | null) =>
  post<StartedAttempt>(hubPath(qs, `/assessments/${quizId}/attempts`, { childId }), { childId, ...(homeworkId ? { homeworkId } : {}) });
export const submitQuizAttempt = (qs: string, attemptId: string, childId: string, answers: { questionId: string; response: unknown }[]) =>
  post<Result>(hubPath(qs, `/attempts/${attemptId}/submit`, { childId }), { answers });

/** Attach (id) or detach (null) the lesson's Explore widget — PATCH /notes/:id {lesson:{widget}}. */
export const setLessonWidget = (noteId: string, qs: string, widget: string | null) =>
  patch(`/api/learning-hub/notes/${noteId}${qs}`, { lesson: { widget } });

/** Replace the lesson's slide deck (a tutor editing slides in the preview). `field` = which deck: our summary slides, or Oak's real deck (`deckSlides`). */
export const saveLessonSlides = (noteId: string, qs: string, slides: unknown[], field: "slides" | "deckSlides" = "slides") =>
  patch(`/api/learning-hub/notes/${noteId}${qs}`, { lesson: { [field]: slides } });

export type { Option, Pic, Result, StartedAttempt, TakeQuestion };
