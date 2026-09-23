// Label the diagram (S-01) — pure logic: label bank, level filtering, marking, hints. No React, no randomness except the seed you pass in.
import { combine, type CheckResult } from "../../engine/marking";
import { checkText } from "../../engine/textmark";
import { makeRng } from "../../engine/rng";
import { DIAGRAM_DATA, type DiagramDef, type Difficulty, type LabelPart, type Pt } from "./diagramData";

export { DIAGRAM_DATA };
export type { DiagramDef, Difficulty, LabelPart, Pt };

export const getDiagram = (id: string | undefined): DiagramDef | undefined => DIAGRAM_DATA.find((d) => d.id === id);

/** Parts shown at a level: 1 = the easiest few, 2 = adds the medium ones, 3 = every part. Original order kept (it fixes the marker numbers). */
export function partsAtLevel(d: DiagramDef, level: Difficulty): LabelPart[] {
  return d.parts.filter((p) => p.difficulty <= level);
}

/** Where the numbered marker is drawn: the leader end if the part has one, else the hotspot itself. */
export const markerPos = (p: LabelPart): Pt => p.leader ?? p.hotspot;

/** 1-based marker number of a part within the active list (0 if absent). */
export const numberOf = (parts: LabelPart[], id: string) => parts.findIndex((p) => p.id === id) + 1;
export const partName = (n: number, total: number) => `Part ${n} of ${total}`;

export interface BankItem { id: string; label: string }
/** The chips to drag/tap, in a seeded order. Never returns them in marker order (unless there is only one). */
export function shuffleBank(parts: LabelPart[], seed: number): BankItem[] {
  const items = parts.map((p) => ({ id: p.id, label: p.label }));
  if (items.length < 2) return items;
  const out = makeRng(seed).shuffle(items);
  if (out.every((it, i) => it.id === items[i]!.id)) [out[0], out[1]] = [out[1]!, out[0]!];
  return out;
}

export type PartStatus = "correct" | "wrong" | "empty";
const whyNot = (s: PartStatus) => (s === "empty" ? "nothing there yet" : "not quite, look at its position and function again");

/** Placement mode. `placements` maps a marker's part id → the id of the label chip put on it. 1 mark per correct marker. */
export function scoreLabels(placements: Record<string, string | undefined>, d: DiagramDef, level: Difficulty = 3): CheckResult {
  const parts = partsAtLevel(d, level);
  const perPart: Record<string, PartStatus> = {};
  const rows = parts.map((p, i) => {
    const put = placements[p.id];
    const st: PartStatus = !put ? "empty" : put === p.id ? "correct" : "wrong";
    perPart[p.id] = st;
    return { label: partName(i + 1, parts.length), ok: st === "correct", marks: 1, note: st === "correct" ? undefined : whyNot(st) };
  });
  const r = combine(rows);
  return { ...r, log: { ...r.log, perPart } };
}

/** The strings a typed answer may match: the label first, then alternatives. */
export const acceptedFor = (p: LabelPart) => [p.label, ...p.accepts];

/** Typed mode (accepts alternatives; case, spacing, punctuation and accents are forgiven). */
export function scoreTyped(answers: Record<string, string | undefined>, d: DiagramDef, level: Difficulty = 3): CheckResult {
  const parts = partsAtLevel(d, level);
  const perPart: Record<string, PartStatus> = {};
  const rows = parts.map((p, i) => {
    const typed = (answers[p.id] ?? "").trim();
    const ok = typed !== "" && checkText(typed, acceptedFor(p), { accents: "lenient", lang: "en" }).score >= 1;
    const st: PartStatus = ok ? "correct" : typed === "" ? "empty" : "wrong";
    perPart[p.id] = st;
    return { label: partName(i + 1, parts.length), ok, marks: 1, note: ok ? undefined : st === "empty" ? "no answer yet" : "not quite, use the hint" };
  });
  const r = combine(rows);
  return { ...r, log: { ...r.log, perPart } };
}

/** Hint ladder: step 0 = the function clue; step 1+ adds the first letter and the length (never the whole word). */
export function hintFor(p: LabelPart, step = 0): string {
  if (step <= 0) return p.hint;
  const words = p.label.split(/\s+/).length;
  const letters = p.label.replace(/[^a-z]/gi, "").length;
  return `${p.hint} It starts with “${p.label.charAt(0)}” (${words === 1 ? "one word" : `${words} words`}, ${letters} letters).`;
}
