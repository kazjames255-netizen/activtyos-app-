"use client";

import dynamic from "next/dynamic";
import { SkeletonRows } from "./kit";
import type { PanelMeta, PanelProps } from "./panelTypes";

// The tutor workspace (builder, bank, marking, results) and the family runner are big and only one of them is ever used:
// load whichever this account needs when the tab opens, not with the hub shell.
const TutorAssess = dynamic(() => import("./quiz/TutorAssess").then((m) => m.TutorAssess), { loading: () => <SkeletonRows rows={3} label="Loading" /> });
const StudentAssess = dynamic(() => import("./shared-assess/StudentAssess").then((m) => m.StudentAssess), { loading: () => <SkeletonRows rows={3} label="Loading" /> });

// Quizzes — tutors build them from a question bank, mark written answers and
// review results; families take them and see an instant scored review. All
// marking is server-side (docs/learning-hub.md); this renders and collects.
export const meta: PanelMeta = { key: "quizzes", label: "Quizzes", icon: "✍️", status: "live", blurb: "Topic quizzes with instant scores and an explanation for every answer." };

export function Panel(p: PanelProps) {
  return p.canEdit ? <TutorAssess p={p} type="quiz" /> : <StudentAssess p={p} type="quiz" />;
}
