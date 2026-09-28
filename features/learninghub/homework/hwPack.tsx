"use client";

import { get } from "@/lib/api";
import { withQs } from "../teachKit";

// READY-MADE homework for a lesson. The server builds the suggestion from the lesson's own data
// (server/src/lib/hubHomeworkPack.ts, GET /notes/:id/homework-pack) — nothing is stored, and nothing is computed
// here. The homework form is prefilled from it (all editable) and this picker lets a tutor base a homework on any lesson.

export interface HomeworkPack {
  noteId: string; title: string; instructions: string; dueInDays: number; dueAt: string; noteIds: string[];
  assessmentId: string | null; quiz: { id: string; title: string; questionCount: number; published: boolean } | null;
  flashcardTopicId: string | null; flashcardCount: number; year: string | null; interactive: boolean; worksheetAssessmentId: string | null;
  basis: { keyIdeas: number; keywords: number; quiz: boolean; flashcards: number };
}

export const fetchHomeworkPack = (qs: string, noteId: string) => get<HomeworkPack>(`/api/learning-hub/notes/${encodeURIComponent(noteId)}/homework-pack${withQs(qs, {})}`);
