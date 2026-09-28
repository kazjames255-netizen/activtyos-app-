import type { IcoName } from "../../teachIcons";
import { tr } from "../tr";

export type WsTabKey = "students" | "notes" | "progress" | "homework" | "quiz" | "cards" | "board";
const ALL: { key: WsTabKey; label: string; icon: IcoName }[] = [
  { key: "students", label: "aTab_students", icon: "users" },
  { key: "notes", label: "aTab_lessons", icon: "notes" },
  { key: "progress", label: "aTab_progress", icon: "chart" },
  { key: "homework", label: "aTab_homework", icon: "homework" },
  { key: "quiz", label: "aTab_quiz", icon: "quiz" },
  { key: "cards", label: "aTab_cards", icon: "cards" },
  { key: "board", label: "aTab_board", icon: "edit" }, // the live whiteboard (live/board/*) — last, so tabs 1–6 keep their numbers
];
/** The workspace's tabs: tutors get all six, a family the lighter three (their own child only). */
/** `label` on ALL holds a hublive key; it is resolved to the current language on each call. */
export const WS_TABS = (isTutor: boolean) => (isTutor ? ALL : ALL.filter((t) => t.key === "notes" || t.key === "homework" || t.key === "cards" || t.key === "board")).map((t) => ({ ...t, label: tr(t.label) }));
