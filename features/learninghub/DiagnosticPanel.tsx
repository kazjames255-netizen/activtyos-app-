"use client";

import dynamic from "next/dynamic";
import { SkeletonRows } from "./kit";
import type { PanelMeta, PanelProps } from "./panelTypes";

const TutorAssess = dynamic(() => import("./quiz/TutorAssess").then((m) => m.TutorAssess), { loading: () => <SkeletonRows rows={3} label="Loading" /> });
const StudentAssess = dynamic(() => import("./shared-assess/StudentAssess").then((m) => m.StudentAssess), { loading: () => <SkeletonRows rows={3} label="Loading" /> });

// Starting quiz — the same machinery as quizzes with type "diagnostic": one per
// subject, sat once, and the server records each topic's baseline from it.
export const meta: PanelMeta = { key: "diagnostic", label: "Starting quizzes", icon: "🧭", status: "live", blurb: "A one-off test per subject that sets your starting level before quizzes count towards progress." };

export function Panel(p: PanelProps) {
  return p.canEdit ? <TutorAssess p={p} type="diagnostic" /> : <StudentAssess p={p} type="diagnostic" />;
}
