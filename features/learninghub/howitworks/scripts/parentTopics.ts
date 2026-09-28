import type { HowScript, Scene } from "../types";
import { PARENT } from "./parent";

// The parent explainer is a short library too: getting started, your child's week, and homework (its own file).
const pick = (ids: string[]): Scene[] => ids.map((id) => PARENT.scenes.find((s) => s.id === id) ?? (() => { throw new Error(`parent scene ${id} missing`); })());
const base = { role: "parent" as const, slug: "parents" as const, audience: "Learning Hub for parents" };
export const PARENT_TOPICS_A: HowScript[] = [
  { ...base, topic: "start", emoji: "👨‍👩‍👧", title: "Getting started", blurb: "How your child gets in, joining from your tutor's link, and the one-line verdict on Home.", tagline: "Get set up and know where to look.", scenes: pick(["getting-in", "invite", "home"]) },
];
export const PARENT_TOPICS_B: HowScript[] = [
  { ...base, topic: "week", emoji: "📈", title: "Your child's week", blurb: "Lessons, live lessons, progress, the printable report, and asking your tutor.", tagline: "Follow along, and ask when you need to.", scenes: pick(["lessons", "live", "progress", "report", "ask"]) },
  { ...base, topic: "handover", emoji: "🧑", title: "Hand over to your child", blurb: "Give your child their own simple space, and how to come back.", tagline: "Let your child learn on their own.", scenes: pick(["hand-over"]) },
];
