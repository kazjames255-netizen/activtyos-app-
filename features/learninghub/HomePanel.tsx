"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { HomeStyles, HomeSkeleton } from "./home/homeKit";
import { useH } from "./home/homeI18n";
import { useFamily } from "./family/FamilyContext";
// (useH stays imported for DayLoading below)
import { FamilyOverview } from "./home/FamilyOverview";

function DayLoading() { const { t } = useH(); return <HomeSkeleton label={t("hubshell.hm_loadingDay")} />; }

// Home — the hub's first impression. A tutor gets "Today" (next lesson, what
// needs marking, class snapshot, recent activity, weekly rhythm); a family with
// ONE child gets a warm daily view for them (next lesson, what's due, latest
// results, mastery, one next step) straight away. A family with MORE THAN ONE
// child instead lands on FamilyOverview — one line per child, nothing else
// (Kaz: "a nice summary of progress for each kid and that is it") — and picking
// a child opens their full StudentHome, with a link back to the overview. This
// choice is per-visit (local state, not persisted): coming back to Home always
// starts at the overview again, same as walking back out to the front desk.
// Everything is composed from existing endpoints — see features/learninghub/home/*.
// Cards jump to other tabs via `goTo`.
//
// This is the hub's DEFAULT tab (every visit loads it), and a tutor account never
// needs StudentHome nor a family account TutorHome — load whichever this account
// needs when the panel mounts, same as Quizzes/Homework/Diagnostic/Flashcards do.
const TutorHome = dynamic(() => import("./home/TutorHome").then((m) => m.TutorHome), { loading: () => <DayLoading /> });
const StudentHome = dynamic(() => import("./home/StudentHome").then((m) => m.StudentHome), { loading: () => <DayLoading /> });

export const meta: PanelMeta = { key: "home", label: "Home", icon: "🏠", status: "live", blurb: "Your day at a glance: what's next, what needs you, and how everyone is doing." };

export function Panel(props: PanelProps) {
  const tutor = props.mode ? props.mode === "tutor" : props.canEdit;
  const family = useFamily();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const portal = pathname.split("/")[1] || "custdash";
  // Kid mode is always scoped to one fixed child by the shell — never show the multi-child overview there.
  // A single child never reaches this branch either: LearningHubApp sends the URL itself to /[portal]/learninghub/[childId]
  // the moment it knows there's only one (see the Level 1 → Level 2 redirect there). Nor does a Level 2/3 route
  // (family.routed): the URL already named a child — Home is always THEIR Today there, never the family overview.
  const showOverview = !tutor && !family.kid && family.multi && !family.routed;
  return (
    <>
      <HomeStyles />
      {tutor ? <TutorHome {...props} />
        : showOverview ? <FamilyOverview kids={family.kids} qs={props.qs} providerName={props.providerName}
            yearOf={(id) => props.students.find((s) => s.childId === id)?.yearGroup}
            onOpen={(id) => router.push(`/${portal}/learninghub/${encodeURIComponent(id)}`)} />
        : <StudentHome {...props} />}
    </>
  );
}
