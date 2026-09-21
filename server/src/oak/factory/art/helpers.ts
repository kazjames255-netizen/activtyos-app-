// Tiny SVG string builders shared by every picture. Colours are CSS classes (see PIC_CSS) so pictures follow the light/dark theme.
export const n = (v: number) => String(Math.round(v * 100) / 100);
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const svg = (w: number, h: number, body: string) => `<svg class="pic" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${body}</svg>`;
export const ln = (x1: number, y1: number, x2: number, y2: number, c = "l") => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${c}"/>`;
export const poly = (pts: [number, number][], c = "l f1") => `<polygon points="${pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" ")}" class="${c}"/>`;
export const pline = (pts: [number, number][], c = "l") => `<polyline points="${pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" ")}" class="${c}"/>`;
export const path = (d: string, c = "l") => `<path d="${d}" class="${c}"/>`;
export const rect = (x: number, y: number, w: number, h: number, c = "l f1", r = 0) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${r}"` : ""} class="${c}"/>`;
export const circ = (cx: number, cy: number, r: number, c = "l f1") => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" class="${c}"/>`;
export const ell = (cx: number, cy: number, rx: number, ry: number, c = "l f1") => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" class="${c}"/>`;
export const dot = (x: number, y: number, r = 2.6, c = "dot") => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" class="${c}"/>`;
/** text; `c` = extra classes: tl (left) te (right) tm (muted) ts (small) tb (big) */
export const txt = (x: number, y: number, s: string, c = "") => `<text x="${n(x)}" y="${n(y)}" class="t ${c}">${esc(s)}</text>`;
const rad = (d: number) => (d * Math.PI) / 180;
/** point at angle `a` degrees (maths convention: anticlockwise from east, y up) on a circle */
export const pt = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
/** arc from angle a1 to a2 (anticlockwise, degrees, a2 > a1) */
export function arc(cx: number, cy: number, r: number, a1: number, a2: number, c = "l"): string {
  const [x1, y1] = pt(cx, cy, r, a1), [x2, y2] = pt(cx, cy, r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return path(`M${n(x1)} ${n(y1)} A${n(r)} ${n(r)} 0 ${large} 0 ${n(x2)} ${n(y2)}`, c);
}
/** filled sector (pie slice) from a1 to a2 anticlockwise */
export function sector(cx: number, cy: number, r: number, a1: number, a2: number, c = "l f1"): string {
  const [x1, y1] = pt(cx, cy, r, a1), [x2, y2] = pt(cx, cy, r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return path(`M${n(cx)} ${n(cy)} L${n(x1)} ${n(y1)} A${n(r)} ${n(r)} 0 ${large} 0 ${n(x2)} ${n(y2)} Z`, c);
}
const HEAD: Record<string, string> = { l: "hd", a: "hda", ar: "hdr", ag: "hdg", ao: "hdo" };
/** line with an arrow head at (x2,y2) */
export function arrow(x1: number, y1: number, x2: number, y2: number, c = "l", size = 8): string {
  const a = Math.atan2(y2 - y1, x2 - x1), s = size;
  const p1: [number, number] = [x2 - s * Math.cos(a - 0.42), y2 - s * Math.sin(a - 0.42)], p2: [number, number] = [x2 - s * Math.cos(a + 0.42), y2 - s * Math.sin(a + 0.42)];
  const bx = x2 - s * 0.55 * Math.cos(a), by = y2 - s * 0.55 * Math.sin(a);
  return `${ln(x1, y1, bx, by, c)}${poly([[x2, y2], p1, p2], HEAD[c] ?? "hd")}`;
}
/** small right-angle marker at vertex (x,y) between directions d1 and d2 (degrees, maths convention) */
export function rightAngle(x: number, y: number, d1: number, d2: number, s = 9): string {
  const a: [number, number] = [x + s * Math.cos(rad(d1)), y - s * Math.sin(rad(d1))], b: [number, number] = [x + s * Math.cos(rad(d2)), y - s * Math.sin(rad(d2))];
  const c: [number, number] = [a[0] + b[0] - x, a[1] + b[1] - y];
  return pline([a, c, b], "th2");
}
export const range = (k: number) => Array.from({ length: k }, (_, i) => i);

/** caption under a picture: word-wrapped at ~40 characters, the LAST line sits on baseline y */
export function cap(text: string, y = 164, max = 40): string {
  const words = text.split(" "), lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines.map((l, i) => txt(120, y - (lines.length - 1 - i) * 12, l, "ts tm")).join("");
}

/** a label with a leader line to a point: text at (tx,ty) (anchor "l" = text starts at tx, "r" = ends at tx), line to (px,py) */
export function tag(text: string, tx: number, ty: number, px: number, py: number, anchor: "l" | "r" = "l", c = "tx"): string {
  const lx = anchor === "l" ? tx - 2 : tx + 2;
  return txt(tx, ty, text, `${c} ${anchor === "l" ? "tl" : "te"}`) + ln(lx, ty - 3, px, py, "th") + dot(px, py, 1.8, "dot");
}
