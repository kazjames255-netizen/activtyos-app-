import type { HowBand, HowRole, HowScript, Scene } from "../types";
import { scriptFor, topicsFor } from "./index";

// "Show me" clips and the first-visit tour are NOT new videos: each is a handful of scenes of the existing films, in the order
// listed, played by the same player (same captions, narration, cues and translations). A clip is a couple of scenes (~15 seconds of
// narration); the tour is one scene per key area (~1-2 minutes). Scene ids are those of the role's library (scripts/*.ts).
export interface ClipDef { role: HowRole; scenes: string[] }

export const CLIPS: Record<string, ClipDef> = {
  // Tutor: one per Hub area, matching the "Watch:" link at the top of that tab (TabHowTo.tsx).
  "t-home": { role: "tutor", scenes: ["home-attention", "home-help"] },
  "t-students": { role: "tutor", scenes: ["std-cards", "std-groups"] },
  "t-lessons": { role: "tutor", scenes: ["les-find", "les-preview"] },
  "t-live": { role: "tutor", scenes: ["live-join", "live-share"] },
  "t-tools": { role: "tutor", scenes: ["tools-try", "tools-give"] },
  "t-quizzes": { role: "tutor", scenes: ["quiz-make", "quiz-marked"] },
  "t-starting": { role: "tutor", scenes: ["quiz-starting"] },
  "t-homework": { role: "tutor", scenes: ["hw-set", "hw-add-details"] },
  "t-marking": { role: "tutor", scenes: ["hw-handin", "hw-mark"] },
  "t-progress": { role: "tutor", scenes: ["prog-class", "prog-child"] },
  "t-messages": { role: "tutor", scenes: ["msg-reply", "msg-auto"] },
  // Parent
  "p-homework": { role: "parent", scenes: ["hw-open"] },
  "p-marks": { role: "parent", scenes: ["hw-marks"] },
  "p-report": { role: "parent", scenes: ["report"] },
  "p-ask": { role: "parent", scenes: ["ask"] },
  // Child
  "k-homework": { role: "kid", scenes: ["hw-do"] },
};

/** The first-visit tour per role: one scene per key area, in the order a person meets them. A child's tour is their own (short) film. */
export const TOURS: Record<HowRole, string[] | null> = {
  tutor: ["home-tour", "home-attention", "fam-ways", "std-cards", "les-library", "live-modes", "tools-try", "quiz-make", "hw-set", "prog-class"],
  parent: ["home", "lessons", "hw-open", "progress", "report", "ask"],
  kid: null,
};

/** Which tab's "Show me" clip a Hub tab gets (tutor tab ids are TabHowTo's; parents only get one on Homework). */
export const TAB_CLIP: Record<"tutor" | "parent", Record<string, string>> = {
  tutor: { home: "t-home", students: "t-students", notes: "t-lessons", live: "t-live", tools: "t-tools", flashcards: "t-quizzes", quizzes: "t-quizzes", diagnostic: "t-starting", homework: "t-homework", dashboard: "t-progress", questions: "t-messages" },
  parent: { homework: "p-homework" },
};

const WPS = 2.4; // narrated words per second (the same estimate the chooser uses)
/** About how long a set of scenes takes to narrate, in seconds. */
export const seconds = (scenes: Scene[]): number => Math.max(1, Math.round(scenes.reduce((a, x) => a + x.say.split(/\s+/).filter(Boolean).length, 0) / WPS));

/** Every library script of a role (the places a scene id can live). */
const sources = (role: HowRole, band?: HowBand): HowScript[] => [...topicsFor(role), scriptFor(role, band)];

/** The library topic that holds `sceneId` (its slug), for "watch the full video". */
export const topicHolding = (role: HowRole, sceneId: string): string | undefined => topicsFor(role).find((s) => s.scenes.some((x) => x.id === sceneId))?.topic;

/** Pick `ids` (in order) out of the role's scripts, each taken from `localize(script)` so translated scenes come through. Missing ids are skipped. */
export function collectScenes(role: HowRole, ids: string[], localize: (s: HowScript) => HowScript, band?: HowBand): Scene[] {
  const out: Scene[] = [];
  const cache = new Map<HowScript, HowScript>();
  const loc = (s: HowScript) => { let v = cache.get(s); if (!v) cache.set(s, (v = localize(s))); return v; };
  for (const id of ids) {
    const src = sources(role, band).find((s) => s.scenes.some((x) => x.id === id));
    const sc = src && loc(src).scenes.find((x) => x.id === id);
    if (sc) out.push(sc);
  }
  return out;
}

/** A single playable script made of those scenes, carrying the first source's role / band / tryIt (so "Try it now" still lands). */
export function composeScript(role: HowRole, ids: string[], localize: (s: HowScript) => HowScript, o: { key: string; title: string; tagline: string; band?: HowBand; emoji?: string }): HowScript | null {
  const scenes = collectScenes(role, ids, localize, o.band);
  if (!scenes.length) return null;
  const first = sources(role, o.band).find((s) => s.scenes.some((x) => x.id === ids[0]));
  const base = first ?? scriptFor(role, o.band);
  return { ...base, topic: o.key, title: o.title, tagline: o.tagline, blurb: undefined, emoji: o.emoji ?? base.emoji, tryIt: base.tryIt, scenes };
}
