"use client";
// Training Ground's backend: liveBackend hits the real API (POST /api/learning-hub/games/sessions with
// gameId:"training-ground"). See docs/games-prototypes/BACKEND-PATTERN.md — the browser never sends a score, only
// the typed answers + response times; the server re-marks from the plan it issued.
import { get, post } from "@/lib/api";
import { PACKS, type DrillPack } from "./core";

export interface DrillPlanItem { id: string; prompt: string }
export interface Started { sessionId: string; seed: number; packId: string; packTitle: string; plan: DrillPlanItem[]; limits: { n: number; answerMs: number }; points: number; streakDays: number }
export interface Finished { done: true; score: number; total: number; streak: number; packId: string; points: number; streakDays: number; best: { score: number; total: number; at: string } | null; wrong: { prompt: string; answer: string; entered: string }[]; repeat?: boolean }
export interface Progress { points: number; streakDays: number; bests: Record<string, { score: number; total: number; at: string }>; runs: { at: string; packId: string; score: number; total: number }[]; weekDays: number; weekGoal: number }

export interface Backend {
  packs: DrillPack[];
  start(packId: string): Promise<Started>;
  finish(sessionId: string, answers: { v: string; ms: number }[]): Promise<Finished>;
  progress(): Promise<Progress>;
}

export function liveBackend(tenantId: string, childId: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = "/api/learning-hub/games";
  return {
    packs: PACKS,
    start: (packId) => post<Started>(`${H}/sessions${q}`, { childId, gameId: "training-ground", packId }),
    finish: (sessionId, answers) => post<Finished>(`${H}/sessions/${sessionId}/finish${q}`, { childId, answers }),
    progress: () => get<Progress>(`${H}/training-ground/progress${q}`),
  };
}
