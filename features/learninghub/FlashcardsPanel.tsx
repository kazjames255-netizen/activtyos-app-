"use client";

import dynamic from "next/dynamic";
import { SkeletonRows } from "./kit";
import type { PanelMeta, PanelProps } from "./panelTypes";

const StudentFlashcards = dynamic(() => import("./flashcards/StudentFlashcards").then((m) => m.StudentFlashcards), { loading: () => <SkeletonRows rows={3} label="Loading" /> });
const TutorFlashcards = dynamic(() => import("./flashcards/TutorFlashcards").then((m) => m.TutorFlashcards), { loading: () => <SkeletonRows rows={3} label="Loading" /> });

// Flashcards — tutors keep a card bank per topic; students review what's due
// (spaced repetition, scheduled by the server). Contract: docs/learning-hub.md.

export const meta: PanelMeta = { key: "flashcards", label: "Flashcards", icon: "🃏", status: "live", blurb: "Spaced-repetition review — the cards that are due today come first." };

export function Panel(props: PanelProps) {
  return props.canEdit ? <TutorFlashcards {...props} /> : <StudentFlashcards {...props} />;
}
