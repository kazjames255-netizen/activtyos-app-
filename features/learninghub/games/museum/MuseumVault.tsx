"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// Museum Vault - history/chronology/cause-and-effect, framed as unlocking exhibits. A deep plum/gold museum palette.
const THEME: QuizTheme = {
  title: "Museum Vault", tagline: "Unlock exhibits by getting timelines, historical figures and cause-and-effect right.",
  emoji: "🏛️", // classical building emoji
  accent: "#6b3fa0", accentSoft: "color-mix(in srgb, #6b3fa0 14%, var(--surface))", ink: "#5a3486", frameNoun: "vault",
};

export default function MuseumVault({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
