"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// Compass Quest - geography/map-skills quest. An amber/terracotta explorer palette (never green as chrome - the
// content rule applies to every game, not only Colour Lab, but there's nothing geographic that needs green anyway).
const THEME: QuizTheme = {
  title: "Compass Quest", tagline: "Chart a course through compass directions, map reading and world geography.",
  emoji: "🧭", // compass emoji
  accent: "#b5651d", accentSoft: "color-mix(in srgb, #b5651d 14%, var(--surface))", ink: "#8a4d16", frameNoun: "expedition",
};

export default function CompassQuest({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
