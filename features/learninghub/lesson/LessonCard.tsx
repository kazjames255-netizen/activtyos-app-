"use client";

import { LessonPlayer, type LessonPlayerProps } from "./LessonPlayer";

// The ONE lesson card used on both the teacher's live-lesson page and the student's — banner (teacher preview
// only), header and question content as flush sections of a single bordered, rounded card, instead of three
// separately-floating boxes with their own widths/shadows. LessonPlayer does the actual rendering (every step
// type, warm-up/quiz logic, etc. — nothing is reimplemented here); this only supplies the shared outer shell via
// its `flatShell` prop, so nothing about scoring, content or copy changes, only the chrome around it.
export function LessonCard(props: LessonPlayerProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white" style={{ border: "1px solid #E4E4EE" }}>
      <LessonPlayer {...props} flatShell />
    </div>
  );
}
