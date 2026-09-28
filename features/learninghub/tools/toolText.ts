// Shared translation helpers for the Tools area (namespace `hubtoolsa.`). Anything that shows a TOOL'S NAME — the Tools page, the
// Add-tool picker, "Open <tool>" buttons — calls `toolTitle(t, id, fallbackEnglishTitle)`; everything falls back to the English text
// when a key is missing (e.g. the ~50 lesson widgets that have no catalogue row), so it is always safe to call.
// Server-generated English (question prompts, marking feedback) is translated here by pattern-matching the known templates, so
// the server contract and stored attempts stay unchanged.
import type { ToolSubject } from "./types";

export type TFn = (key: string, vars?: Record<string, string | number>) => string;
const NS = "hubtoolsa.";
const tr = (t: TFn, key: string, fb: string, vars?: Record<string, string | number>) => { const r = t(NS + key, vars); return r === NS + key ? fb : r; };

/** "M-01" → "title_M_01"; "D.tally" → "title_D_tally". */
export const toolTitleKey = (id: string) => `title_${id.replace(/[^A-Za-z0-9]/g, "_")}`;
/** The translated name of a catalogue tool (falls back to `fallback`, usually `meta.title`). */
export const toolTitle = (t: TFn, id: string, fallback = id) => tr(t, toolTitleKey(id), fallback);
export const subjectLabel = (t: TFn, s: ToolSubject | string, fallback = String(s)) => tr(t, `subj_${s}`, fallback);
export const instrLabel = (t: TFn, kind: string, fallback = kind) => tr(t, `i_${kind}`, fallback);
export const paperLabel = (t: TFn, id: string, fallback = id) => tr(t, `p_${id}`, fallback);
export const genLabel = (t: TFn, id: string, fallback = id) => tr(t, `gl_${id.replace(/[^A-Za-z0-9]/g, "_")}`, fallback);

type Rule = [RegExp, string] | [RegExp, string, (m: RegExpMatchArray) => Record<string, string>];
const apply = (t: TFn, rules: Rule[], s: string): string | null => {
  for (const [re, key, vars] of rules as [RegExp, string, ((m: RegExpMatchArray) => Record<string, string>)?][]) { const m = s.match(re); if (m) return tr(t, key, s, vars ? vars(m) : undefined); }
  return null;
};

const PROMPTS: Rule[] = [
  [/^Measure the reflex angle AOB\. Use a 360° protractor\.$/, "pr_measureReflex"],
  [/^Measure the angle AOB\.$/, "pr_measure"],
  [/^Draw an angle of (.+)° at O, starting from the line OA\.$/, "pr_drawAngle", (m) => ({ n: m[1]! })],
  [/^Construct the perpendicular bisector of the line AB \((.+) long\)\. Leave your construction arcs showing\.$/, "pr_perp", (m) => ({ len: m[1]! })],
  [/^Construct the bisector of angle AOB\. Leave your construction arcs showing\.$/, "pr_angBis"],
  [/^Construct a triangle with sides of ([^,]+), ([^,]+) and (.+?)\. Use compasses and leave your construction arcs showing\.$/, "pr_tri", (m) => ({ a: m[1]!, b: m[2]!, c: m[3]! })],
  [/^Construct an equilateral triangle with sides of (.+?)\. Use compasses and leave your construction arcs showing\.$/, "pr_equi", (m) => ({ s: m[1]! })],
  [/^Draw the locus of all the points that are (.+) from the point P\.$/, "pr_locus", (m) => ({ r: m[1]! })],
  [/^Plot the points (.+)\.$/, "pr_plot", (m) => ({ pts: m[1]! })],
  [/^Measure the bearing of B from A\. Give it as a three-figure bearing\.$/, "pr_bearMeasure"],
  [/^Draw a line from A on a bearing of (.+)°, (.+) long\.$/, "pr_bearDraw", (m) => ({ b: m[1]!, len: m[2]! })],
];
/** Translate a generated tool-question prompt (unknown prompts, e.g. tutor-authored ones, come back unchanged). */
export const promptText = (t: TFn, prompt: string): string => apply(t, PROMPTS, prompt) ?? prompt;

const LABELS: Rule[] = [
  [/^Give an answer$/, "f_giveAnswer"], [/^Give a number$/, "f_giveNumber"], [/^Correct value$/, "f_correctValue"], [/^In the right order$/, "f_rightOrder"],
  [/^Correct$/, "f_correct"], [/^Not quite$/, "f_notQuite"],
  [/^Answer within ±(.+)$/, "f_within", (m) => ({ tol: m[1]! })],
  [/^A straight line at right angles to AB through its midpoint$/, "f_perpLine"],
  [/^Construction arcs from A and B with the same radius \(more than half of AB\)$/, "f_arcsAB"],
  [/^A line from the corner that splits the angle in half$/, "f_bisLine"],
  [/^Construction arc\(s\) centred on the corner$/, "f_arcCorner"],
  [/^A line through the point at right angles to the given line$/, "f_perpPoint"],
  [/^Construction arcs shown$/, "f_arcsShown"],
  [/^A closed triangle with sides (.+)$/, "f_triSides", (m) => ({ sides: m[1]! })],
  [/^A line from the point making (.+)° with the base line$/, "f_lineAngle", (m) => ({ deg: m[1]! })],
  [/^A circle centred on the point with radius (.+)$/, "f_circle", (m) => ({ r: m[1]! })],
  [/^Drawn all the way round$/, "f_allRound"],
  [/^A line (.+) from the given line on one side$/, "f_parallel1", (m) => ({ d: m[1]! })],
  [/^…and another on the other side$/, "f_parallel2"],
  [/^Point \((.+)\) plotted$/, "f_pointPlotted", (m) => ({ p: m[1]! })],
  [/^A line from A on a bearing of (.+)$/, "f_bearing", (m) => ({ b: m[1]! })],
  [/^Length (.+)$/, "f_length", (m) => ({ l: m[1]! })],
  [/^Unit (.+)$/, "f_unit", (m) => ({ u: m[1]! })],
  [/^(\d+) significant figures$/, "f_sf", (m) => ({ n: m[1]! })],
];
const NOTES: Rule[] = [
  [/^no line drawn$/, "n_noLine"], [/^the two radii differ$/, "n_radiiDiffer"], [/^arcs missing$/, "n_arcsMissing"],
  [/^no line starts at the corner$/, "n_noLineCorner"], [/^no closed triangle found$/, "n_noTriangle"], [/^no arc centred on the point$/, "n_noArc"],
  [/^the arc stops short of a full circle$/, "n_short"], [/^no line starts at the point$/, "n_noLinePoint"], [/^no line starts at A$/, "n_noLineA"],
  [/^no unit$/, "n_noUnit"], [/^not placed$/, "n_notPlaced"],
  [/^written without umlauts — fine on a keyboard, but learn the ä\/ö\/ü\/ß spelling$/, "n_umlaut"],
  [/^check your accents$/, "n_checkAccents"], [/^the accent changes the word here — check it$/, "n_accentChanges"],
  [/^accent missing or wrong — the meaning is right, but check it$/, "n_accentWrong"],
  [/^(.+) off square, (.+) from the midpoint$/, "n_offSquare", (m) => ({ a: m[1]!, b: m[2]! })],
  [/^(.+) off square, (.+) from the point$/, "n_offSquareP", (m) => ({ a: m[1]!, b: m[2]! })],
  [/^your sides: (.+)$/, "n_yourSides", (m) => ({ sides: m[1]! })],
  [/^your radius is (.+) vs (.+)$/, "n_radius", (m) => ({ a: m[1]!, b: m[2]! })],
  [/^you gave (.+)$/, "n_gave", (m) => ({ v: m[1]! })],
  [/^you put “(.+)”$/, "n_youPut", (m) => ({ v: m[1]! })],
  [/^you wrote “(.+)”$/, "n_youWrote", (m) => ({ v: m[1]! })],
  [/^(.+) out$/, "n_out", (m) => ({ a: m[1]! })],
];
/** Translate one marking feedback line ("✓ Label — note") produced by the checkers. Unknown lines (e.g. custom labels) stay as they are. */
export function feedbackText(t: TFn, line: string): string {
  const m = line.match(/^([✓✗]) ([\s\S]*)$/);
  if (!m) return line;
  const rest = m[2]!, i = rest.indexOf(" — ");
  const label = i < 0 ? rest : rest.slice(0, i), note = i < 0 ? "" : rest.slice(i + 3);
  const l = apply(t, LABELS, label) ?? label, n = note ? apply(t, NOTES, note) ?? note : "";
  return `${m[1]} ${l}${n ? ` — ${n}` : ""}`;
}

const HINTS: Rule[] = [
  [/^Look at “(.+)”\. Does it describe only one thing, or both\? Which features does it share\?$/, "s_hintCard1", (m) => ({ card: m[1]! })],
  [/^Look at “(.+)”\. What is it, and which group's rule does it meet\? Check it against the heading of each group\.$/, "s_hintCard2", (m) => ({ card: m[1]! })],
  [/^Look at “(.+)”\. What has to happen just before it, and what comes straight after\?$/, "s_hintSeq", (m) => ({ step: m[1]! })],
  [/^Position (.+) is empty\. What must happen there\?$/, "s_hintEmpty", (m) => ({ n: m[1]! })],
];
/** Translate a hint from common/sorting.ts (nextHint / nextSequenceHint). */
export const hintText = (t: TFn, hint: string): string => apply(t, HINTS, hint) ?? hint;
