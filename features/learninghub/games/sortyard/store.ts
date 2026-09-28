"use client";
// Sort Yard's backend: liveBackend hits the real API. See docs/games-prototypes/BACKEND-PATTERN.md — the browser
// sends only its submitted classification / typed value / ordering per round; the server re-grades from the plan.
import { get, post } from "@/lib/api";
import type { Concept } from "./core";

export type PlanRound =
  | { kind: "sort"; id: string; title: string; concept: Concept; categories: string[]; items: string[] }
  | { kind: "chart"; id: string; title: string; concept: Concept; chartTitle: string; bars: { label: string; value: number }[]; question: string }
  | { kind: "order"; id: string; title: string; concept: Concept; values: number[]; direction: "ascending" | "descending" };
export type Submission =
  | { kind: "sort"; roundId: string; assignments: Record<string, string> }
  | { kind: "chart"; roundId: string; value: number }
  | { kind: "order"; roundId: string; order: number[] };

export interface Started { sessionId: string; seed: number; plan: PlanRound[]; limits: { n: number }; points: number; streakDays: number }
export interface ResultRow { roundId: string; title: string; concept: Concept; correct: boolean; detail: string }
export interface Finished { done: true; correct: number; total: number; points: number; streakDays: number; rows: ResultRow[]; repeat?: boolean }
export interface Progress { points: number; streakDays: number; roundsSolved: number; runs: { at: string; correct: number; total: number }[]; weekDays: number; weekGoal: number }

export interface Backend {
  start(): Promise<Started>;
  finish(sessionId: string, submissions: Submission[]): Promise<Finished>;
  progress(): Promise<Progress>;
}

export function liveBackend(tenantId: string, childId: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = "/api/learning-hub/games";
  return {
    start: () => post<Started>(`${H}/sessions${q}`, { childId, gameId: "sort-yard" }),
    finish: (sessionId, submissions) => post<Finished>(`${H}/sessions/${sessionId}/finish${q}`, { childId, submissions }),
    progress: () => get<Progress>(`${H}/sort-yard/progress${q}`),
  };
}
