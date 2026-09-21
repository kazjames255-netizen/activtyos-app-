"use client";

import dynamic from "next/dynamic";
import { SkeletonRows } from "./kit";
import type { PanelMeta, PanelProps } from "./panelTypes";

const StudentHomework = dynamic(() => import("./homework/StudentHomework").then((m) => m.StudentHomework), { loading: () => <SkeletonRows rows={3} label="Loading" /> });
const TutorHomework = dynamic(() => import("./homework/TutorHomework").then((m) => m.TutorHomework), { loading: () => <SkeletonRows rows={3} label="Loading" /> });

// Homework — tutors set it, mark it; students see what's due, hand it in and read
// the feedback. All marking is the tutor's; the server stores what's sent.
// Contract: docs/learning-hub.md → Homework.

export const meta: PanelMeta = { key: "homework", label: "Homework", icon: "📝", status: "live", blurb: "Practice sets from your tutor — hand them in and see when they're marked." };

export function Panel(props: PanelProps) {
  return props.canEdit ? <TutorHomework {...props} /> : <StudentHomework {...props} />;
}
