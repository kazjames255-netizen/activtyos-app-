"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// WORD VAULT — vocabulary building: meanings, synonyms/antonyms, and words-in-context, drawn from a real,
// curriculum-appropriate word list. Reuses the shared QuizRunner shell.
const THEME: QuizTheme = { title: "Word Vault", tagline: "Unlock the vault: meanings, synonyms, opposites and words in context.", emoji: "🔐", accent: "#2b8fc9", accentSoft: "color-mix(in srgb, #2b8fc9 16%, var(--surface))", ink: "#1c6796", frameNoun: "vault" };

export default function WordVault({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
