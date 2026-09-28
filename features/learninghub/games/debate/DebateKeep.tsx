"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// DEBATE KEEP — spot the persuasive technique, judge which claim is stronger, and place a sentence correctly in a
// PEEL paragraph or essay shape. Reuses the shared QuizRunner shell (see quiz/QuizRunner.tsx) - a card list, one
// question at a time, the server's own re-marked result at the end. No countdown on thinking: the "Keep" framing
// (defending an argument tower) is in the theme text only, never a timer.
const THEME: QuizTheme = { title: "Debate Keep", tagline: "Defend the Keep: spot the strongest argument, name the technique, and build a case that holds up.", emoji: "🏰", accent: "#7c5cff", accentSoft: "color-mix(in srgb, #7c5cff 16%, var(--surface))", ink: "#5b3fd6", frameNoun: "debate" };

export default function DebateKeep({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
