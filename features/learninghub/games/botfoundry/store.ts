"use client";
// Bot Foundry's backend: liveBackend hits the real API. The client builds and RUNS programs locally with the same
// pure `runProgram` the server uses (so the bot's animation matches exactly), but only sends the built programs —
// never a "solved" flag. See docs/games-prototypes/BACKEND-PATTERN.md.
import { get, post } from "@/lib/api";
import type { Concept, Program } from "./core";

export interface PlanPuzzle { id: string; title: string; concept: Concept; grid: string[]; parMoves: number; starterBug: Program | null }
export interface Started { sessionId: string; seed: number; plan: PlanPuzzle[]; limits: { n: number }; points: number; streakDays: number }
export interface ResultRow { puzzleId: string; title: string; concept: Concept; reached: boolean; crashed: boolean; steps: number; parMoves: number; stars: 0 | 1 | 2 | 3 }
export interface Finished { done: true; solved: number; total: number; stars: number; maxStars: number; points: number; streakDays: number; rows: ResultRow[]; repeat?: boolean }
export interface Progress { points: number; streakDays: number; puzzlesSolved: number; runs: { at: string; solved: number; total: number; stars: number }[]; weekDays: number; weekGoal: number }

export interface Backend {
  start(): Promise<Started>;
  finish(sessionId: string, submissions: { puzzleId: string; program: Program }[]): Promise<Finished>;
  progress(): Promise<Progress>;
}

export function liveBackend(tenantId: string, childId: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = "/api/learning-hub/games";
  return {
    start: () => post<Started>(`${H}/sessions${q}`, { childId, gameId: "bot-foundry" }),
    finish: (sessionId, submissions) => post<Finished>(`${H}/sessions/${sessionId}/finish${q}`, { childId, submissions }),
    progress: () => get<Progress>(`${H}/bot-foundry/progress${q}`),
  };
}
