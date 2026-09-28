"use client";
// Client-only persistence for Arcade (arcade.ts stays pure so the server can import it): this device's top scores. Never shared, never ranked against anyone.
import type { ArcadeKind } from "./arcade";

/** Brief: "no public ranking" - a local table only. Best-effort: storage may be blocked (private mode), in which case the game just runs without it. */
export const HIGH_KEY = "aos.games.penguin.arcade.high.v1";
export interface HighScore { score: number; kind: ArcadeKind; at: string }
export function loadHighScores(): HighScore[] {
  try { const v = JSON.parse(localStorage.getItem(HIGH_KEY) ?? "[]") as HighScore[]; return Array.isArray(v) ? v.filter((x) => x && typeof x.score === "number").slice(0, 5) : []; } catch { return []; }
}
export function saveHighScore(h: HighScore): HighScore[] {
  const all = [...loadHighScores(), h].sort((a, b) => b.score - a.score).slice(0, 5);
  try { localStorage.setItem(HIGH_KEY, JSON.stringify(all)); } catch { /* blocked or full */ }
  return all;
}
