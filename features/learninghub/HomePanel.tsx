"use client";

import dynamic from "next/dynamic";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { HomeStyles, HomeSkeleton } from "./home/homeKit";

// Home — the hub's first impression. A tutor gets "Today" (next lesson, what
// needs marking, class snapshot, recent activity, weekly rhythm); a family gets a
// warm daily view for the chosen child (next lesson, what's due, latest results,
// mastery, one next step). Everything is composed from existing endpoints —
// see features/learninghub/home/*. Cards jump to other tabs via `goTo`.
//
// This is the hub's DEFAULT tab (every visit loads it), and a tutor account never
// needs StudentHome nor a family account TutorHome — load whichever this account
// needs when the panel mounts, same as Quizzes/Homework/Diagnostic/Flashcards do.
const TutorHome = dynamic(() => import("./home/TutorHome").then((m) => m.TutorHome), { loading: () => <HomeSkeleton label="Loading your day" /> });
const StudentHome = dynamic(() => import("./home/StudentHome").then((m) => m.StudentHome), { loading: () => <HomeSkeleton label="Loading your day" /> });

export const meta: PanelMeta = { key: "home", label: "Home", icon: "🏠", status: "live", blurb: "Your day at a glance: what's next, what needs you, and how everyone is doing." };

export function Panel(props: PanelProps) {
  const tutor = props.mode ? props.mode === "tutor" : props.canEdit;
  return (
    <>
      <HomeStyles />
      {tutor ? <TutorHome {...props} /> : <StudentHome {...props} />}
    </>
  );
}
