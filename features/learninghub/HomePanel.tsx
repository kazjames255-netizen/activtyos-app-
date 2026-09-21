"use client";

import type { PanelMeta, PanelProps } from "./panelTypes";
import { HomeStyles } from "./home/homeKit";
import { StudentHome } from "./home/StudentHome";
import { TutorHome } from "./home/TutorHome";

// Home — the hub's first impression. A tutor gets "Today" (next lesson, what
// needs marking, class snapshot, recent activity, weekly rhythm); a family gets a
// warm daily view for the chosen child (next lesson, what's due, latest results,
// mastery, one next step). Everything is composed from existing endpoints —
// see features/learninghub/home/*. Cards jump to other tabs via `goTo`.

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
