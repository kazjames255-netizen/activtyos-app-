"use client";

import type { ComponentType } from "react";
import type { PanelMeta, PanelProps } from "./panelTypes";
import * as Home from "./HomePanel";
import * as Live from "./LiveLessonsPanel";
import * as Progress from "./ProgressPanel";
import * as Diagnostic from "./DiagnosticPanel";
import * as Quizzes from "./QuizzesPanel";
import * as Homework from "./HomeworkPanel";
import * as Flashcards from "./FlashcardsPanel";
import * as Students from "./StudentsPanel";
import * as Questions from "./QuestionsPanel";

// The hub's panel registry, in tab order. Each panel module exports `meta` and
// `Panel`; the shell renders `Panel` when meta.status is "live" and a greyed
// "Coming soon" otherwise. Lessons (notes & resources) is rendered by the shell itself.
// To add or finish a panel: edit ITS OWN module only — this file just lists them.
export const PANEL_MODULES: { meta: PanelMeta; Panel: ComponentType<PanelProps> }[] = [
  Home, Live, Progress, Diagnostic, Quizzes, Homework, Flashcards, Questions,
];

/** Tutor-only roster panel (lives beside the six above; the shell places it 2nd). */
export const STUDENTS_MODULE: { meta: PanelMeta; Panel: ComponentType<PanelProps> } = Students;

/** Lessons (hubNotes: interactive lessons + plain notes & resources) is built into the shell (it owns the editor state). */
export const NOTES_META: PanelMeta = { key: "notes", label: "Lessons", icon: "📚", status: "live", blurb: "" };

/** Tab order. Live lessons is the main function, so it's first. */
export const TAB_ORDER: PanelMeta["key"][] = ["home", "live", "students", "dashboard", "diagnostic", "quizzes", "homework", "notes", "flashcards", "questions"];
