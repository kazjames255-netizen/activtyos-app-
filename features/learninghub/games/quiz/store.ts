"use client";
// Backend for the three quiz-quest games - same server contract shape as every other game (server/src/lib/
// hubQuizGames.ts): POST /games/sessions issues the seed-picked plan, POST /games/sessions/:id/finish takes only
// the picked option ids (never a score) and the server re-marks against its own copy of the item bank.
import { get, post } from "@/lib/api";
import type { PlanItem } from "./core";

export type QuizGameId = "compass-quest" | "museum-vault" | "colour-lab" | "debate-keep" | "story-detective" | "word-vault" | "word-pop";

export interface QuizStarted { sessionId: string; gameId: QuizGameId; plan: PlanItem[]; itemsTotal: number; itemsSeen: number; secure: number; points: number; bestScore: number; weekDays: number; weekGoal: number; /** Word Pop only: the per-item answer window in ms - its own arcade mechanic, never on the other, untimed quiz games. */ answerMs?: number }
export interface QuizRow { key: string; correct: boolean; correctId: string; chosenId: string | null; explanation: string }
export interface QuizFinished { score: number; total: number; points: number; rows: QuizRow[]; pointsTotal: number; bestScore: number; weekDays: number; weekGoal: number; repeat?: boolean; /** Word Pop only */ bestCombo?: number }
export interface QuizProgress { gameId: QuizGameId; totals: { facts: number; fluent: number; itemsTotal: number }; points: number; bestScore: number; weekDays: number; weekGoal: number; runs: { at: string; score: number; total: number }[]; weakTopics: { topic: string; attempts: number; accuracy: number | null }[] }
export interface QuizAnswerOut { key: string; chosenId: string | null; ms: number }

export interface QuizBackend {
  demo: boolean;
  start(): Promise<QuizStarted>;
  finish(sessionId: string, answers: QuizAnswerOut[]): Promise<QuizFinished>;
  progress(): Promise<QuizProgress>;
}

export function liveQuizBackend(gameId: QuizGameId, tenantId: string, childId: string): QuizBackend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = "/api/learning-hub/games";
  return {
    demo: false,
    start: () => post<QuizStarted>(`${H}/sessions${q}`, { childId, gameId }),
    finish: (sessionId, answers) => post<QuizFinished>(`${H}/sessions/${sessionId}/finish${q}`, { childId, answers }),
    progress: () => get<QuizProgress>(`${H}/${gameId}/progress${q}`),
  };
}
