"use client";

import HowItWorksButton from "./HowItWorksButton";
import { TAB_CLIP } from "./scripts/clips";
import { useT } from "@/lib/i18n/provider";

// A quiet "watch how this works" link at the top of a Hub area, and next to it a "Show me" clip: a ~15 second slice of that same video
// (scripts/clips.ts) for someone who only wants the one thing. Opens (and autoplays) the video for that area — tutors get their own
// topic video, one per tab (Home, Families is reached from the Enrol dialog rather than a tab, Students, Lessons, Live lessons, Tools,
// Quizzes, Homework, Progress, Messages); parents get the homework one.
const TUTOR_TOPIC: Record<string, { topic: string; label: string }> = {
  home: { topic: "home", label: "w_home" },
  students: { topic: "students", label: "w_students" },
  notes: { topic: "lessons", label: "w_notes" },
  live: { topic: "live", label: "w_live" },
  tools: { topic: "tools", label: "w_tools" },
  flashcards: { topic: "quizzes", label: "w_flashcards" },
  homework: { topic: "homework", label: "w_homework" },
  quizzes: { topic: "quizzes", label: "w_quizzes" },
  diagnostic: { topic: "quizzes", label: "w_diagnostic" },
  dashboard: { topic: "progress", label: "w_dashboard" },
  questions: { topic: "messages", label: "w_messages" },
};
export default function TabHowTo({ tutor, tab }: { tutor: boolean; tab: string }) {
  const tr = useT();
  const t = tutor ? TUTOR_TOPIC[tab] : tab === "homework" ? { topic: "homework", label: "w_hwParent" } : undefined;
  if (!t) return null;
  const role = tutor ? "tutor" : "parent";
  const clip = TAB_CLIP[role][tab];
  // ONE entry per area: "Show me" (a ~15 second clip). The full video and the tour are offered inside its window. An area with no clip keeps the plain link.
  return (
    <div className="mb-2 flex justify-end" data-testid="hiw-tab-link">
      {clip
        ? <HowItWorksButton role={role} variant="showme" clip={clip} autoplay />
        : <HowItWorksButton role={role} variant="link" topic={t.topic} autoplay label={tr(`hubhow.${t.label}`)} />}
    </div>
  );
}
