// Shared drawing kit for the X3 science extension pictures (ext-science-*.ts). Pure TypeScript, no node imports (the browser loads the library).
import type { Pic } from "./types";
import { svg, ln, rect, txt, poly, arrow } from "./helpers";
export * from "./helpers";

export const W = 240, H = 170;
export const S: Pic["subjects"] = ["Science"];
export type P = [number, number];
/** build a Science picture (viewBox 240 x h) */
export const mk = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, extra: Partial<Pic> & { h?: number } = {}): Pic => {
  const { h, ...rest } = extra;
  return { id, title, alt, caption, subjects: S, concepts, doesNotShow: "anything not labelled", evidence, svg: svg(W, h ?? H, body), ...rest };
};
/** thick soft "tube" stroke (vessels, wires, pipes): colour is a theme variable name (ink, red, brand-2, green, gold, violet) */
export const thick = (d: string, colour = "red", w = 9, op = 0.4) => `<path d="${d}" style="fill:none;stroke:var(--${colour});stroke-width:${w};stroke-linecap:round;stroke-linejoin:round;opacity:${op}"/>`;
/** wrap in a translate/rotate/scale group */
export const put = (x: number, y: number, body: string, rot = 0, sc = 1) => `<g transform="translate(${x} ${y})${rot ? ` rotate(${rot})` : ""}${sc !== 1 ? ` scale(${sc})` : ""}">${body}</g>`;
/** rounded box with 1-3 centred text lines */
export function box(x: number, y: number, w: number, h: number, lines: string | string[], cls = "l f1", tc = "tx"): string {
  const ls = Array.isArray(lines) ? lines : [lines];
  const lh = 11, y0 = y + h / 2 - ((ls.length - 1) * lh) / 2 + 3.3;
  return rect(x, y, w, h, cls, 6) + ls.map((l, i) => txt(x + w / 2, y0 + i * lh, l, tc)).join("");
}
/** text with a surface-coloured plate behind it (label that sits on a line) */
export function plate(x: number, y: number, s: string, c = "tx", anchor: "m" | "l" | "r" = "m"): string {
  const w = s.length * 4.9 + 6, x0 = anchor === "m" ? x - w / 2 : anchor === "l" ? x - 3 : x - w + 3;
  return `<rect x="${x0.toFixed(1)}" y="${(y - 9).toFixed(1)}" width="${w.toFixed(1)}" height="12" rx="3" class="f0" stroke="none"/>` + txt(x, y, s, `${c} ${anchor === "l" ? "tl" : anchor === "r" ? "te" : ""}`);
}
/** point where the ray from the centre of a w x h box in direction (dx,dy) leaves the box */
export function edge(cx: number, cy: number, w: number, h: number, dx: number, dy: number, pad = 2): P {
  const s = Math.min(dx === 0 ? Infinity : w / 2 / Math.abs(dx), dy === 0 ? Infinity : h / 2 / Math.abs(dy)), L = Math.hypot(dx, dy);
  return [cx + dx * s + (dx / L) * pad, cy + dy * s + (dy / L) * pad];
}
/** boxes around an ellipse joined by arrows in order (a cycle); returns the svg */
export function cycle(labels: string[][], cx: number, cy: number, rx: number, ry: number, w: number, h: number, start = 90, cls = "l f1", ac = "l", bw = w): string {
  const n = labels.length, pts: P[] = labels.map((_, i) => { const a = ((start - (360 / n) * i) * Math.PI) / 180; return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)]; });
  let s = "";
  pts.forEach((p, i) => { const q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1]; const a = edge(p[0], p[1], w, h, dx, dy, 1), b = edge(q[0], q[1], w, h, -dx, -dy, 3); s += arrow(a[0], a[1], b[0], b[1], ac, 6); });
  pts.forEach((p, i) => { s += box(p[0] - bw / 2, p[1] - h / 2, bw, h, labels[i], Array.isArray(cls) ? cls[i] : cls); });
  return s;
}
/** filled arrow head only */
export const head = (x: number, y: number, ang: number, size = 6, c = "hd") => {
  const p1: P = [x - size * Math.cos(ang - 0.42), y - size * Math.sin(ang - 0.42)], p2: P = [x - size * Math.cos(ang + 0.42), y - size * Math.sin(ang + 0.42)];
  return poly([[x, y], p1, p2], c);
};
/** a small formula triangle: top / bottom-left x bottom-right (e.g. distance / speed x time) */
export function triangle(top: string, bl: string, br: string, cx = 120, cy = 84, k = 1): string {
  const w = 64 * k, h = 56 * k, T: P = [cx, cy - h / 2], L: P = [cx - w / 2, cy + h / 2], R: P = [cx + w / 2, cy + h / 2];
  return poly([T, L, R], "l f1") + ln(cx - w / 2 + 8 * k, cy + 2 * k, cx + w / 2 - 8 * k, cy + 2 * k, "th2") + ln(cx, cy + 2 * k, cx, cy + h / 2, "th2")
    + txt(cx, cy - 8 * k, top, "tb") + txt(cx - w / 4, cy + h / 2 - 8 * k, bl, "tb") + txt(cx + w / 4, cy + h / 2 - 8 * k, br, "tb");
}
