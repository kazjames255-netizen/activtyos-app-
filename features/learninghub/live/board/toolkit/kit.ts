import { boundsOf, measureText, LINE_H, newId, reserveV, type BgKind, type El, type ShapeKind } from "../model";

// The toolkit's building blocks. A template is a function that draws with the
// SAME vector primitives the board already has (shapes, text, stickies, strokes,
// the odd special stamp) into a builder; `place()` then centres the result at the
// middle of the view and gives every element an id, an owner and one shared
// group id (so it moves as one — and can be ungrouped to edit a single cell).
// Nothing here draws to a canvas, and nothing is copyrighted: it is all lines,
// boxes and words.

export type Level = "early" | "standard" | "advanced";
export const LEVELS: Level[] = ["early", "standard", "advanced"];
export const LEVEL_LABEL: Record<Level, string> = { early: "Early (KS1–2)", standard: "Standard (KS3)", advanced: "Advanced (KS4–5)" };
export type PackId = "general" | "maths" | "english" | "languages" | "geography" | "history" | "science" | "mine";

export interface Ctx { ink: string; brand: string; danger: string; soft: string }
export interface Param { k: string; label: string; type: "text" | "number" | "list" | "select"; def: string | number; options?: string[]; help?: string }
export type Vals = Record<string, string | number>;
export type Part = Partial<El> & Pick<El, "k">;

export interface ToolItem {
  id: string;
  pack: PackId;
  label: string;
  sub?: string;
  /** Which key-stage styles list it by default (all when omitted). */
  levels?: Level[];
  params?: Param[];
  /** Draw the template (relative coordinates; placed at the view centre). */
  make?: (b: B, c: Ctx, v: Vals) => void;
  /** …or switch the page background. */
  bg?: BgKind;
  /** Free-text search terms. */
  tags?: string;
  /** A sub-section inside a pack (Science: Biology / Chemistry / Physics). */
  group?: string;
  /** Not a template: open a picker (a picture, or an image/PDF import). */
  action?: "picture" | "import";
}

export const PASTEL = ["#dbeafe", "#dcfce7", "#fef9c3", "#fee2e2", "#ede9fe", "#ffedd5", "#cffafe", "#fce7f3"];
export const list = (s: string | number | undefined, fallback: string[] = []) => { const a = String(s ?? "").split(/[,\n;]/).map((x) => x.trim()).filter(Boolean); return a.length ? a : fallback; };
export const num = (v: string | number | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export class B {
  els: Part[] = [];
  constructor(public c: Ctx) {}
  private add(p: Part) { this.els.push(p); return p; }
  text(x: number, y: number, text: string, o: { size?: number; bold?: boolean; c?: string } = {}) { return this.add({ k: "text", x, y, text, size: o.size ?? 22, bold: o.bold, c: o.c ?? this.c.ink }); }
  /** Text centred on (cx, cy). */
  tc(cx: number, cy: number, text: string, o: { size?: number; bold?: boolean; c?: string } = {}) {
    const size = o.size ?? 22, lines = text.split("\n");
    const w = Math.max(...lines.map((l) => measureText(l || " ", size, !!o.bold))) + 6, h = lines.length * size * LINE_H + 4;
    return this.text(cx - w / 2, cy - h / 2, text, o);
  }
  line(x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string; arrow?: boolean } = {}) { return this.add({ k: "shape", shape: o.arrow ? "arrow" : "line", x1, y1, x2, y2, w: o.w ?? 3, c: o.c ?? this.c.ink }); }
  arrow(x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string } = {}) { return this.line(x1, y1, x2, y2, { ...o, arrow: true }); }
  // Filled shapes are SOLID (fa: 1) — the board's default 22% wash made pastel template fills nearly invisible.
  rect(x: number, y: number, w: number, h: number, o: { w?: number; c?: string; fill?: string | null; dash?: boolean } = {}) { return this.add({ k: "shape", shape: "rect", x1: x, y1: y, x2: x + w, y2: y + h, w: o.w ?? 3, c: o.c ?? this.c.ink, fill: o.fill ?? null, fa: o.fill ? 1 : undefined, dash: o.dash || undefined }); }
  ellipse(cx: number, cy: number, rx: number, ry: number, o: { w?: number; c?: string; fill?: string | null; dash?: boolean } = {}) { return this.add({ k: "shape", shape: "ellipse", x1: cx - rx, y1: cy - ry, x2: cx + rx, y2: cy + ry, w: o.w ?? 3, c: o.c ?? this.c.ink, fill: o.fill ?? null, fa: o.fill ? 1 : undefined, dash: o.dash || undefined }); }
  tri(x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string; fill?: string | null; ap?: number } = {}) { return this.add({ k: "shape", shape: "triangle" as ShapeKind, x1, y1, x2, y2, w: o.w ?? 3, c: o.c ?? this.c.ink, fill: o.fill ?? null, fa: o.fill ? 1 : undefined, ap: o.ap }); }
  /** Any closed shape (star, hexagon, heart, speech bubble…) inside the box x1,y1 → x2,y2. */
  shape(kind: ShapeKind, x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string; fill?: string | null; dash?: boolean } = {}) { return this.add({ k: "shape", shape: kind, x1, y1, x2, y2, w: o.w ?? 3, c: o.c ?? this.c.ink, fill: o.fill ?? null, fa: o.fill ? 1 : undefined, dash: o.dash || undefined }); }
  /**
   * A TYPEABLE CELL / labelled box: double-click it (or Tab from the cell before) and type. `text` pre-fills it, `ph` is the grey hint shown
   * while it is empty. It is an ordinary rectangle, so it resizes, recolours and moves like one; its words follow it and shrink to fit.
   */
  cell(x: number, y: number, w: number, h: number, o: { text?: string; ph?: string; size?: number; bold?: boolean; c?: string; w?: number; fill?: string | null; tc?: string; al?: "l" | "c" | "r"; va?: "t" | "m" | "b"; dash?: boolean; ns?: boolean; shape?: ShapeKind } = {}) {
    return this.add({ k: "shape", shape: o.shape ?? "rect", x1: x, y1: y, x2: x + w, y2: y + h, w: o.w ?? 2.5, c: o.c ?? this.c.ink, fill: o.fill ?? null, fa: o.fill ? 1 : undefined, dash: o.dash || undefined, ns: o.ns || undefined,
      cell: true, text: o.text || undefined, ph: o.ph, size: o.size, bold: o.bold || undefined, tc: o.tc ?? this.c.ink, al: o.al && o.al !== "c" ? o.al : undefined, va: o.va && o.va !== "m" ? o.va : undefined });
  }
  sticky(x: number, y: number, w: number, h: number, text: string, colour = "#fff3b0", size = 22) { return this.add({ k: "sticky", x, y, w, h, text, c: colour, size }); }
  /** A freehand path (a curve / polygon / wave) as one stroke. */
  path(points: [number, number][], o: { w?: number; c?: string } = {}) { return this.add({ k: "stroke", w: o.w ?? 4, c: o.c ?? this.c.ink, pts: points.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, 50]) }); }
  polygon(points: [number, number][], o: { w?: number; c?: string } = {}) { return this.path([...points, points[0]!], o); }
  /** A closed outline with SHARP corners (the smooth path used by `polygon` rounds off a triangle's points): every edge is sampled every few units. */
  outline(points: [number, number][], o: { w?: number; c?: string } = {}) {
    const out: [number, number][] = [];
    points.forEach((p, i) => { const q = points[(i + 1) % points.length]!, n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 6)); for (let k = 0; k < n; k++) out.push([p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]); });
    out.push(points[0]!);
    return this.path(out, o);
  }
  stamp(stamp: string, x: number, y: number, w: number, h: number, opts: Record<string, string | number | boolean> = {}, extra: Partial<El> = {}) { return this.add({ k: "stamp", stamp: stamp as El["stamp"], x, y, w, h, opts, c: this.c.ink, ...extra }); }

  /**
   * A table of typeable cells (one per cell — double-click to type, Tab to move on, resize or recolour any of them). Optional header row /
   * label column / pre-filled `cells` (indexed by table row, then column). Returns the cell centres.
   */
  table(x: number, y: number, colW: number[], rowH: number[], o: { head?: string[]; labels?: string[]; cells?: string[][]; headFill?: string; size?: number; ph?: string } = {}) {
    const W = colW.reduce((a, b) => a + b, 0), H = rowH.reduce((a, b) => a + b, 0), size = o.size ?? 22;
    const x0 = (c: number) => x + colW.slice(0, c).reduce((a, b) => a + b, 0), y0 = (r: number) => y + rowH.slice(0, r).reduce((a, b) => a + b, 0);
    const hs = o.head ? 1 : 0;
    for (let r = 0; r < rowH.length; r++) for (let c = 0; c < colW.length; c++) {
      const isHead = !!o.head && r === 0, isLabel = !!o.labels && c === 0 && r >= hs;
      const text = isHead ? o.head![c] : isLabel ? o.labels![r - hs] : o.cells?.[r]?.[c];
      this.cell(x0(c), y0(r), colW[c]!, rowH[r]!, { text, size, bold: isHead || isLabel, fill: isHead ? o.headFill : undefined, w: 2.5, ph: !isHead && !isLabel ? o.ph : undefined });
    }
    const cx = (c: number) => x + colW.slice(0, c).reduce((a, b) => a + b, 0) + colW[c]! / 2;
    const cy = (r: number) => y + rowH.slice(0, r).reduce((a, b) => a + b, 0) + rowH[r]! / 2;
    return { W, H, cx, cy };
  }
}

/** Centre the builder's elements on (cx, cy), stamp ids / owner / z / version, and share a group id. */
export function place(b: B, cx: number, cy: number, own: string, zBase: number, o: { group?: boolean } = {}): El[] {
  const rough = b.els.map((p) => ({ id: "t", own, z: 0, v: 0, ...p }) as El);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of rough) { const r = boundsOf(e); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
  if (!Number.isFinite(x0)) return [];
  const dx = Math.round(cx - (x0 + x1) / 2), dy = Math.round(cy - (y0 + y1) / 2);
  const grp = o.group === false ? undefined : newId("g");
  const v = reserveV(b.els.length);
  return b.els.map((p, i) => {
    const e: El = { id: newId(), own, z: zBase + i, v: v + i, ...p } as El;
    if (e.k === "stroke" && e.pts) e.pts = e.pts.map((n, j) => (j % 3 === 0 ? Math.round((n + dx) * 10) / 10 : j % 3 === 1 ? Math.round((n + dy) * 10) / 10 : n));
    else if (e.k === "shape") { e.x1! += dx; e.x2! += dx; e.y1! += dy; e.y2! += dy; }
    else { e.x = (e.x ?? 0) + dx; e.y = (e.y ?? 0) + dy; }
    if (grp) e.grp = grp;
    return e;
  });
}
