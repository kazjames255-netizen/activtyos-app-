"use client";
import { useCallback, useEffect, useState } from "react";

// Per-device preferences (never personal data): sound, motion, reading aloud. Stored in localStorage, always inside try/catch.
export interface Prefs { muted: boolean; volume: number; music: boolean; motion: "auto" | "full" | "gentle"; readEvery: boolean; tutorialDone: boolean; equipped: string; equip: Partial<Record<"hat" | "scarf" | "trail" | "sled" | "back", string>>; skin: "junior" | "explorer"; loadout: string[]; chapters: number[]; timer: boolean; mode: "solo" | "quick" | "calm"; tables: string;
  /** the village: fish spent, buildings built, cosmetics bought; the in-world tips already seen; the story scenes already watched */
  spent: number; village: string[]; bought: string[]; coached: string[]; story: string[];
  /** where each village building stands (12 plots, null = empty; the child chooses), and the stage ids whose friend was freed (they live in the village and count toward some outfits) */
  plots: (string | null)[]; friends: string[] }
const KEY = "aos.games.penguin.prefs.v1";
export const DEFAULT_PREFS: Prefs = { muted: false, volume: 0.6, music: true, motion: "auto", readEvery: false, tutorialDone: false, equipped: "auto", equip: {}, skin: "junior", loadout: [], chapters: [], timer: false, mode: "solo", tables: "picks", spent: 0, village: [], bought: [], coached: [], story: [], plots: Array.from({ length: 12 }, () => null), friends: [] };
const read = (): Prefs => { try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; } };

export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [prefs, setP] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => { setP(read()); }, []);
  const set = useCallback((p: Partial<Prefs>) => { setP((cur) => { const n = { ...cur, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* blocked */ } return n; }); }, []);
  return [prefs, set];
}
/** OS "reduce motion" (docs A rule 18) - overridden in both directions by the in-game Motion setting. */
export function useReducedMotion(motion: Prefs["motion"]): boolean {
  const [os, setOs] = useState(false);
  useEffect(() => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setOs(m.matches); const f = () => setOs(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return motion === "gentle" || (motion === "auto" && os);
}
