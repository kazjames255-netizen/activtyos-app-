"use client";
import { QuizRunner, type QuizTheme } from "../quiz/QuizRunner";
import type { QuizBackend } from "../quiz/store";
import type { SupportProfile } from "../../support";

// Colour Lab - light/colour science, framed as a lab experiment. An indigo/blue palette for the game's OWN chrome -
// green must never be the brand colour here (it's fine as CONTENT: several questions ask about green as a colour
// being mixed, e.g. "blue + yellow paint = green", but that's data inside an option's text, never this theme).
const THEME: QuizTheme = {
  title: "Colour Lab", tagline: "Run experiments with light, colour mixing and how we see colour.",
  emoji: "🧪", // test tube emoji
  accent: "#3b5bdb", accentSoft: "color-mix(in srgb, #3b5bdb 14%, var(--surface))", ink: "#33459e", frameNoun: "experiment",
};

export default function ColourLab({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  return <QuizRunner theme={THEME} backend={backend} support={support} onExit={onExit} />;
}
