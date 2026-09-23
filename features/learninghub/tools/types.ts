import type { ComponentType } from "react";
import type { HelpToolId } from "../remotesync/HelpTools";

export type ToolSubject = "maths" | "english" | "science" | "languages" | "humanities" | "cross";
export const SUBJECT_LABEL: Record<ToolSubject, string> = { maths: "Maths", english: "English", science: "Science", languages: "Languages", humanities: "Humanities", cross: "Every subject" };
export const SUBJECT_ORDER: ToolSubject[] = ["maths", "english", "science", "languages", "humanities", "cross"];
export type KeyStage = 1 | 2 | 3 | 4 | 5;
/** canvas = drawing surface (instruments, diagrams) · form = typed / choose answers · text = annotates or writes on text. */
export type Surface = "canvas" | "form" | "text";
export type ToolMode = "teach" | "practise" | "assess";
/** live = usable now · building = planned for the next phases (shown as "In build") · soon = later (greyed "Coming soon"). */
export type ToolStatus = "live" | "building" | "soon";

/** How a tool is actually run. */
export type ToolImpl =
  | { kind: "drawer"; id: HelpToolId }                  // an existing Tools-drawer tool (remotesync/HelpTools.tsx), hosted unchanged
  | { kind: "widget"; id: string }                      // an existing lesson "Explore" widget (lesson/widgets)
  | { kind: "native"; load: () => Promise<{ default: ComponentType<ToolProps> }>; /** Settings for this particular tool (which instruments, which paper, which question types). */ params?: Record<string, unknown> }; // a tool built on the engine

export interface ToolProps { mode: ToolMode; qs: string; onClose?: () => void; /** From the registry entry's `params`. */ params?: Record<string, unknown>; /** Autosave key (the tool id). */ toolId?: string }

export interface ToolMeta {
  id: string;                 // plan id ("M-01") or "w.<widget>" / "L.<drawer>" for existing tools
  title: string;
  subject: ToolSubject;
  tier: "P1" | "P2";
  keyStages: KeyStage[];
  surface: Surface;
  /** Words the automatic tool-suggestion rules attach to (see tools/selection). */
  tags: string[];
  status: ToolStatus;
  impl: ToolImpl | null;
  /** true = an old tool that still works but is due to be rebuilt on the engine. */
  legacy: boolean;
}
