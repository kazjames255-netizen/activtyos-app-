import type { IcoName } from "../../teachIcons";

export type WsTabKey = "students" | "notes" | "progress" | "homework" | "quiz" | "cards" | "board";
const ALL: { key: WsTabKey; label: string; icon: IcoName }[] = [
  { key: "students", label: "Students", icon: "users" },
  { key: "notes", label: "Lessons", icon: "notes" },
  { key: "progress", label: "Progress", icon: "chart" },
  { key: "homework", label: "Homework", icon: "homework" },
  { key: "quiz", label: "Quiz", icon: "quiz" },
  { key: "cards", label: "Cards", icon: "cards" },
  { key: "board", label: "Board", icon: "edit" }, // the live whiteboard (live/board/*) — last, so tabs 1–6 keep their numbers
];
/** The workspace's tabs: tutors get all six, a family the lighter three (their own child only). */
export const WS_TABS = (isTutor: boolean) => (isTutor ? ALL : ALL.filter((t) => t.key === "notes" || t.key === "homework" || t.key === "cards" || t.key === "board"));
