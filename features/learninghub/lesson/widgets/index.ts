import { createElement, type ComponentType } from "react";
import { FractionBar } from "./FractionBar";
import { LegacyWidget } from "./LegacyWidget";
import { legacyDefs } from "./legacyRuntime";
import { Neurone } from "./Neurone";
import type { WidgetDef, WidgetProps } from "./types";
import RULES from "./legacy/rules.gen.json";

export type { WidgetDef, WidgetProps } from "./types";

// The registry of interactive "Explore" widgets: widget id → React component. A lesson picks one with `lesson.widget`.
//   • native widgets (React) are listed here;
//   • every plain-JS widget in scratch/prototype/widgets/*.js is pulled in by `npm run hub:widgets` (which generates
//     ./legacy/*.gen.ts) and mounted through <LegacyWidget> — no per-widget porting.
// A native widget wins over a legacy one with the same id.

const NATIVE: WidgetDef[] = [
  { id: "fractionBar", title: "Simplify a fraction", intro: "Change the fraction, then group the parts into equal chunks. Which groupings work?", Component: FractionBar },
  { id: "neurone", title: "Send a nerve impulse", intro: "Switch the myelin sheath on and off, then send an impulse down the axon. What changes?", Component: Neurone },
];

function build(): Record<string, WidgetDef> {
  const out: Record<string, WidgetDef> = {};
  for (const [id, def] of Object.entries(legacyDefs())) {
    if (!def || typeof def.html !== "function" || typeof def.init !== "function") continue;
    const Component: ComponentType<WidgetProps> = function Legacy(props: WidgetProps) { return createElement(LegacyWidget, { def, onXP: props.onXP }); };
    out[id] = { id, title: String(def.title || id), intro: String(def.intro || ""), Component, legacy: true };
  }
  for (const w of NATIVE) out[w.id] = w;
  return out;
}

/** id → widget. */
export const WIDGETS: Record<string, WidgetDef> = build();

export const getWidget = (id: string | null | undefined): WidgetDef | null => (id ? WIDGETS[id] ?? null : null);
/** For pickers: every widget, A–Z by title. */
export const listWidgets = (): WidgetDef[] => Object.values(WIDGETS).sort((a, b) => a.title.localeCompare(b.title));

interface Rule { id: string; subject?: string; match: string }
/** The widget the prototype's rules.json would pick for this lesson (subject + a regex over "<unit> | <lesson>"), or null. */
export function suggestWidget(subject: string, unit: string, title: string): string | null {
  for (const r of RULES as Rule[]) {
    if (!WIDGETS[r.id]) continue;
    if (r.subject && subject && r.subject.toLowerCase() !== subject.toLowerCase() && !subject.toLowerCase().includes(r.subject.toLowerCase())) continue;
    try { if (new RegExp(r.match, "i").test(`${unit} | ${title}`)) return r.id; } catch { /* a bad rule never breaks the picker */ }
  }
  return null;
}
