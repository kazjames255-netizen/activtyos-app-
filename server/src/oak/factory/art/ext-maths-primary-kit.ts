// Shared kit for the Maths KS1-KS2 extension pictures (agent X1). Pure TypeScript, no I/O.
// Every picture here is scoped to key stages 1 and 2 (`keyStages`) so a primary diagram never appears on a KS3/KS4 slide that happens to use the same word.
import type { Pic } from "./types";
import { svg, ln, poly, circ, rect, txt, dot, pt, path, cap, n, arrow, arc, sector, tag } from "./helpers";

export const W = 240, H = 170;
export const KS: string[] = ["ks1", "ks2"];
export const M: Pic["subjects"] = ["Maths"];

export interface Spec { id: string; title: string; concepts: string[]; body: string; alt: string; caption: string; evidence: string; extra?: Partial<Pic> }
/** Build a picture: subjects Maths, key stages 1-2, generic-correct (no specific answers). */
export function mk(s: Spec): Pic {
  return { id: s.id, title: s.title, alt: s.alt, caption: s.caption, subjects: M, keyStages: KS, concepts: s.concepts, doesNotShow: "specific values or worked answers", evidence: s.evidence, svg: svg(W, H, s.body), ...s.extra };
}

/** a text box: rounded rect with centred text */
export function box(x: number, y: number, w: number, h: number, label: string, fill = "f1", tc = "ts"): string {
  return rect(x, y, w, h, `l ${fill}`, 5) + txt(x + w / 2, y + h / 2 + 3.5, label, tc);
}
/** arrow head polygon at `tip` pointing away from `from` */
export function head(tip: [number, number], from: [number, number], c = "hda", s = 7): string {
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const p1: [number, number] = [tip[0] - s * Math.cos(a - 0.45), tip[1] - s * Math.sin(a - 0.45)], p2: [number, number] = [tip[0] - s * Math.cos(a + 0.45), tip[1] - s * Math.sin(a + 0.45)];
  return poly([tip, p1, p2], c);
}
/** curved hop between two x positions on a horizontal line at y; up = above the line. Arrow head at the far end (x2). */
export function hop(x1: number, x2: number, y: number, up: boolean, c = "a", hc = "hda", lift = 0): string {
  const h = lift || Math.min(30, Math.abs(x2 - x1) * 0.42), sgn = up ? -1 : 1;
  const cy = y + sgn * 2 * h; // control point (quadratic apex is half of it)
  const mx = (x1 + x2) / 2;
  return path(`M${n(x1)} ${n(y + sgn * 3)} Q${n(mx)} ${n(cy)} ${n(x2)} ${n(y + sgn * 3)}`, c) + head([x2, y + sgn * 3], [mx, cy], hc, 6);
}
/** a horizontal number line with `k+1` unlabelled ticks between x0 and x1 (ticks spaced evenly) */
export function line(x0: number, x1: number, y: number, k: number, labels?: (i: number) => string, tickH = 6, lc = "ts"): string {
  let s = ln(x0 - 12, y, x1 + 12, y, "l");
  const st = (x1 - x0) / k;
  for (let i = 0; i <= k; i++) { const x = x0 + i * st; s += ln(x, y - tickH, x, y + tickH, "l"); const t = labels?.(i); if (t) s += txt(x, y + tickH + 13, t, lc); }
  return s;
}
/** rows of counters: r rows x c columns starting at (x,y) with pitch p */
export function counters(x: number, y: number, r: number, c: number, p = 14, rad = 5.4, cls = "l f1"): string {
  let s = "";
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) s += circ(x + j * p, y + i * p, rad, cls);
  return s;
}
/** empty digit boxes for column methods */
export function digitBox(x: number, y: number, w = 24, h = 20, cls = "l f0", t = ""): string { return rect(x, y, w, h, cls, 3) + (t ? txt(x + w / 2, y + h / 2 + 4.5, t, "tb") : ""); }
export function clockFace(cx: number, cy: number, r: number, hh: number, mm: number, opt: { nums?: "quad" | "all" | "none"; hands?: boolean } = {}): string {
  const nums = opt.nums ?? "quad";
  let s = circ(cx, cy, r, "l f0");
  for (let i = 0; i < 12; i++) { const a = 90 - i * 30, p = pt(cx, cy, r, a), q = pt(cx, cy, r - (i % 3 === 0 ? 5 : 3), a); s += ln(p[0], p[1], q[0], q[1], "th2"); }
  if (nums !== "none") for (let h = 1; h <= 12; h++) { if (nums === "quad" && h % 3) continue; const p = pt(cx, cy, r - 12, 90 - h * 30); s += txt(p[0], p[1] + 3.5, String(h), nums === "quad" ? "tx" : "ts"); }
  if (opt.hands === false) return s + dot(cx, cy, 2.6);
  const ha = 90 - ((hh % 12) * 30 + mm * 0.5), ma = 90 - mm * 6;
  const hp = pt(cx, cy, r * 0.5, ha), mp = pt(cx, cy, r * 0.78, ma);
  return s + ln(cx, cy, hp[0], hp[1], "ar") + ln(cx, cy, mp[0], mp[1], "a") + dot(cx, cy, 2.6);
}
export { svg, ln, poly, circ, rect, txt, dot, pt, path, cap, n, arrow, arc, sector, tag };
