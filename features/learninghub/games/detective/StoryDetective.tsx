"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// STORY DETECTIVE — reading comprehension as a mystery-solving frame: each clue is really a comprehension question
// (inference, vocabulary-in-context, sequencing) on a real short passage. Reuses the shared QuizRunner shell, which
// also renders `item.passage` above the prompt (quiz/QuizRunner.tsx) - built for this game, usable by any other.
const THEME: QuizTheme = { title: "Story Detective", tagline: "Read the case file, then answer the clue - inference, tricky words in context, and what happened when.", emoji: "🔎", accent: "#c9822b", accentSoft: "color-mix(in srgb, #c9822b 16%, var(--surface))", ink: "#8a5a17", frameNoun: "case" };

export default function StoryDetective({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
