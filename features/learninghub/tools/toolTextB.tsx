import { Fragment, type ReactNode } from "react";
import type { ToolSubject } from "./types";
import { toolTitle } from "./toolText";

/** "**bold** text" -> React nodes (odd segments bold). Lets one whole-sentence translation carry inline emphasis. */
export function rich(s: string): ReactNode {
  return s.split("**").map((part, i) => (i % 2 ? <b key={i} className="font-extrabold">{part}</b> : <Fragment key={i}>{part}</Fragment>));
}

/** Translated subject name ("Maths", "Science"…). */
export const subjectLabel = (t: (k: string) => string, s: ToolSubject): string => t(`hubtoolsb.subj_${s}`);

/** Translated tool name (hubtoolsa's toolTitle; falls back to the English title, e.g. for lesson widgets without a catalogue row). */
export const toolName = (t: (k: string) => string, tool: { id: string; title: string }): string => toolTitle(t as never, tool.id, tool.title);
