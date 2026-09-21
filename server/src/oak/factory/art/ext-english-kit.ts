// X4 English pictures — drawing kit shared by ext-english-*.ts (teaching DIAGRAMS of a concept: generic, neutral examples, never a specific text).
// Everything is a pure string builder on top of helpers.ts; text width is ESTIMATED and any label that would leave the 240-wide canvas is recorded in
// EXT_ENGLISH_WARN (checked by art/cli.ts) so a picture can never ship with clipped words.
import type { Pic } from "./types";
import { svg, rect, txt, ln, cap, n } from "./helpers";

export const W = 240, H = 170;
export const EXT_ENGLISH_WARN: string[] = [];
let cur = "";
const FS: Record<string, number> = { tt: 7.5, tx: 9.5, ts: 10.5, tb: 15 };
export const fsOf = (c: string) => { const p = c.split(" "); for (const k of ["tt", "tx", "ts", "tb"]) if (p.includes(k)) return FS[k]; return 12.5; };
/** estimated rendered width (px) of a string in text class `c` */
export const est = (s: string, c = "ts") => s.length * fsOf(c) * 0.57;

/** text with a bounds check (anchor: default middle, "tl" start, "te" end) */
export function T(x: number, y: number, s: string, c = ""): string {
  const w = est(s, c), cl = c.split(" ");
  const a = cl.includes("tl") ? x : cl.includes("te") ? x - w : x - w / 2, b = a + w;
  if (a < 2 || b > 238) EXT_ENGLISH_WARN.push(`${cur}: text "${s}" spans ${Math.round(a)}-${Math.round(b)}`);
  return txt(x, y, s, c);
}
/** multi-line wrapped text; lines are `lh` apart, first baseline at y */
export function wrap(s: string, x: number, y: number, maxChars: number, c = "ts tm", lh = 12): string {
  maxChars = Math.min(maxChars, Math.floor(224 / (fsOf(c) * 0.57)));
  const words = s.split(" "), lines: string[] = []; let line = "";
  for (const w of words) { if ((line + " " + w).trim().length > maxChars && line) { lines.push(line); line = w; } else line = (line + " " + w).trim(); }
  if (line) lines.push(line);
  return lines.map((l, i) => T(x, y + i * lh, l, c)).join("");
}
/** rounded box */
export const box = (x: number, y: number, w: number, h: number, fill = "f0", r = 6) => rect(x, y, w, h, `l ${fill}`, r);
/** a chip (rounded box + centred text), left edge x, top y */
export function chip(x: number, y: number, s: string, fill = "f0", c = "ts", h = 16, pad = 6): { svg: string; w: number } {
  const w = Math.round(est(s, c) + pad * 2);
  return { svg: box(x, y, w, h, fill, 4) + T(x + w / 2, y + h / 2 + fsOf(c) * 0.34, s, c), w };
}
/** chips in a centred row (cx), gap between; returns svg + left x of each chip */
export function row(cx: number, y: number, items: { s: string; f?: string }[], gap = 5, c = "ts", h = 16): { svg: string; xs: number[]; ws: number[] } {
  const ws = items.map((i) => Math.round(est(i.s, c) + 12));
  const tot = ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = cx - tot / 2; const xs: number[] = []; let out = "";
  if (x < 2 || x + tot > 238) EXT_ENGLISH_WARN.push(`${cur}: row of ${items.map((i) => i.s).join(" ")} spans ${Math.round(x)}-${Math.round(x + tot)}`);
  items.forEach((it, i) => { xs.push(x); out += box(x, y, ws[i], h, it.f ?? "f0", 4) + T(x + ws[i] / 2, y + h / 2 + fsOf(c) * 0.34, it.s, c); x += ws[i] + gap; });
  return { svg: out, xs, ws };
}
/** a sentence drawn as word chips; words with a fill are highlighted; returns positions so callers can add labels/arrows */
export function sentence(cx: number, y: number, words: { s: string; f?: string; lab?: string }[], c = "ts", h = 16, gap = 3): { svg: string; mids: number[]; xs: number[]; ws: number[] } {
  const ws = words.map((w) => Math.round(est(w.s, c) + 8));
  const tot = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let x = cx - tot / 2; const xs: number[] = [], mids: number[] = []; let out = "";
  if (x < 2 || x + tot > 238) EXT_ENGLISH_WARN.push(`${cur}: sentence "${words.map((w) => w.s).join(" ")}" spans ${Math.round(x)}-${Math.round(x + tot)}`);
  words.forEach((w, i) => {
    xs.push(x); mids.push(x + ws[i] / 2);
    out += w.f ? box(x, y, ws[i], h, w.f, 4) : "";
    out += T(x + ws[i] / 2, y + h / 2 + fsOf(c) * 0.34, w.s, c);
    x += ws[i] + gap;
  });
  return { svg: out, mids, xs, ws };
}
/** labels under chips of a sentence (only the words that carry a lab) */
export function labels(y: number, s: { mids: number[]; ws: number[] }, labs: (string | undefined)[], c = "tx tm"): string {
  let out = "", lastEnd = -1;
  labs.forEach((l, i) => {
    if (!l) return;
    const w = est(l, c);
    if (s.mids[i] - w / 2 < lastEnd + 2) EXT_ENGLISH_WARN.push(`${cur}: label "${l}" overlaps the previous label`);
    lastEnd = s.mids[i] + w / 2;
    out += T(s.mids[i], y, l, c);
  });
  return out;
}
/** curved arrow from (x1,y1) up/down to (x2,y2) with an arrow head, bulging by `bend` (negative = up) */
export function curve(x1: number, y1: number, x2: number, y2: number, bend: number, c = "l"): string {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bend;
  const a = Math.atan2(y2 - my, x2 - mx), s = 6;
  const p1 = `${n(x2 - s * Math.cos(a - 0.45))},${n(y2 - s * Math.sin(a - 0.45))}`, p2 = `${n(x2 - s * Math.cos(a + 0.45))},${n(y2 - s * Math.sin(a + 0.45))}`;
  return `<path d="M${n(x1)} ${n(y1)} Q${n(mx)} ${n(my)} ${n(x2 - 1.5 * Math.cos(a))} ${n(y2 - 1.5 * Math.sin(a))}" class="${c}" style="stroke-width:1.5"/><polygon points="${n(x2)},${n(y2)} ${p1} ${p2}" class="hd"/>`;
}
export { ln };

export interface Def {
  id: string; title: string; alt: string; caption: string; concepts: string[];
  requires?: string[]; avoid?: string[]; numeric?: boolean; doesNotShow: string; evidence: string;
  /** content between y=24 and y=146 (a 1-line caption sits at y=164, two lines from y=152) */
  build: () => string; capMax?: number;
}
const E: Pic["subjects"] = ["English"];
export function mk(d: Def): Pic {
  cur = d.id;
  const body = d.build();
  const p: Pic = { id: d.id, title: d.title, alt: d.alt, caption: d.caption, subjects: E, concepts: d.concepts, doesNotShow: d.doesNotShow, evidence: d.evidence, svg: svg(W, H, body + cap(d.caption, 164, d.capMax ?? 40)) };
  if (d.requires) p.requires = d.requires;
  if (d.avoid) p.avoid = d.avoid;
  if (d.numeric) p.numeric = true;
  return p;
}

// colour key used for word classes everywhere (fill classes from style.ts)
export const WC = { noun: "f1", verb: "f4", adj: "f2", adv: "f3", pro: "f5", other: "f6" } as const;
