"use client";
// Client-side backend for the "quiz arcade" trio (Prime Reef, Data Carnival, Shape Workshop) — the same server
// contract as every other Learning Hub game (docs/games-prototypes/BACKEND-PATTERN.md): POST /sessions issues a
// plan with correct answers stripped out, POST /sessions/:id/finish sends back only which choice was picked (never
// a score), and the server re-marks against the plan it kept for itself (server/src/lib/quizArcade.ts).
import { get, post } from "@/lib/api";

export type QuizGameId = "prime-reef" | "data-carnival" | "shape-workshop";
export interface PublicItem { id: string; topic: string; prompt: string; choices: string[] }
export interface StartResult { sessionId: string; seed: number; items: PublicItem[]; runLength: number; best: { score: number; streak: number } | null; coins: number; topics: readonly string[] }
export interface ResultRow { id: string; topic: string; prompt: string; ok: boolean; chosen: string | null; correct: string; explain: string }
export interface QuizResult { score: number; total: number; accuracy: number; streak: number; bestStreak: number; coins: number; newBest: boolean; rows: ResultRow[]; repeat?: boolean }
export interface AnswerOut { id: string; chosen: number | null; ms: number }
export interface MasteryTopic { topic: string; attempts: number; correct: number; streakBest: number; level: 0 | 1 | 2 | 3 | 4; lastSeen: string | null; recentWrong: { prompt: string; chosen: string; correct: string }[] }
export interface FactsResult { gameId: QuizGameId; topics: MasteryTopic[]; runs: number; bestScore: number; bestStreak: number; coins: number; days: string[]; totalCorrect: number; totalAnswered: number; lastPlayedAt: string | null; weekDays: number; weekGoal: number }

export interface Backend {
  start(): Promise<StartResult>;
  finish(sessionId: string, answers: AnswerOut[]): Promise<QuizResult>;
  facts(): Promise<FactsResult>;
}

export function liveBackend(gameId: QuizGameId, tenantId: string, childId: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = `/api/learning-hub/games/quiz/${gameId}`;
  return {
    start: () => post<StartResult>(`${H}/sessions${q}`, { childId }),
    finish: (sessionId, answers) => post<QuizResult>(`${H}/sessions/${sessionId}/finish${q}`, { childId, answers }),
    facts: () => get<FactsResult>(`${H}/facts${q}`),
  };
}
