// The whiteboard's data model — plain TypeScript with NO React and NO DOM, so the
// reducer (reducer.ts) can be self-tested with `npx tsx`. Every drawing is a
// vector ELEMENT with a unique id and an owner; the board is a set of pages of
// elements. Conflict-free by construction: ids never collide (random), edits are
// last-writer-wins on `v`, deletes leave a tombstone.

// Page backgrounds: infinite papers (lined, squared, dots…) and SUBJECT FRAMES — a fixed frame drawn around the origin
// that the tutor writes over (Maths: graph axes / number line; English: story map; Science: diagram frame; Languages: vocabulary grid).
export type BgKind = "blank" | "lined" | "squared" | "graph" | "numberline" | "isometric" | "handwriting" | "dotgrid" | "tianzige" | "twocol" | "storymap" | "diagram" | "vocab";
export const BACKGROUNDS: { kind: BgKind; label: string }[] = [
  { kind: "blank", label: "Blank" },
  { kind: "lined", label: "Lined" },
  { kind: "squared", label: "Squared" },
  { kind: "graph", label: "Graph axes" },
  { kind: "numberline", label: "Number line" },
  { kind: "isometric", label: "Isometric dots" },
  { kind: "handwriting", label: "Handwriting lines" },
  { kind: "dotgrid", label: "Dot grid" },
  { kind: "tianzige", label: "Character grid" },
  { kind: "twocol", label: "Two columns" },
  { kind: "storymap", label: "Story map" },
  { kind: "diagram", label: "Diagram frame" },
  { kind: "vocab", label: "Vocabulary grid" },
];
export const BG_KINDS: BgKind[] = BACKGROUNDS.map((b) => b.kind);
export type ShapeKind = "line" | "arrow" | "darrow" | "rect" | "ellipse" | "triangle"
  | "diamond" | "rtriangle" | "pentagon" | "hexagon" | "star" | "heart" | "bubble"
  | "ngon" | "parallelogram" | "trapezium" | "kite";
/** Two-point shapes drawn from p1 to p2 (the rest are drawn inside the box p1–p2). */
export const isLineShape = (s?: ShapeKind) => s === "line" || s === "arrow" || s === "darrow";
/** Closed shapes drawn as a polygon inside their box (see `polyPoints`). */
export const POLY_SHAPES: ShapeKind[] = ["triangle", "diamond", "rtriangle", "pentagon", "hexagon", "star", "heart", "bubble", "ngon", "parallelogram", "trapezium", "kite"];
export const isPolyShape = (s?: ShapeKind) => !!s && POLY_SHAPES.includes(s);
/** Shapes that can be filled. */
export const isClosedShape = (s?: ShapeKind) => s === "rect" || s === "ellipse" || s === "triangle" || isPolyShape(s);
/** Pen looks: solid (default, `sty` unset), dashed, neon glow, rainbow. */
export type PenStyle = "solid" | "dash" | "neon" | "rainbow";
export const PEN_STYLES: PenStyle[] = ["solid", "dash", "neon", "rainbow"];
export type StampKind = "numberline" | "fractions" | "coordgrid" | "timestable" | "clock" | "ruler" | "protractor"
  | "periodic" | "plot" | "bohr" | "symbol" | "apparatus" | "lens" | "timeline" | "textblock" | "timer" | "map"
  | "dice" | "spinner" | "tally";
export type ElKind = "stroke" | "shape" | "text" | "sticky" | "image" | "stamp";
export type OptVal = number | string | boolean;

export interface El {
  id: string;
  k: ElKind;
  /** Owner: "T" (the tutor) or "c:<childId>" (a student). Students may only touch their own. */
  own: string;
  /** First name shown on a student's work. */
  by?: string;
  /** The student's child id (for privacy erase); only set on student elements. */
  cid?: string;
  /** Stacking order (higher = in front). */
  z: number;
  /** Version: last-writer-wins on edits. */
  v: number;
  /** Colour (hex). */
  c?: string;
  /** stroke/shape: line width · text: unused · sticky/image/stamp: width. */
  w?: number;
  /** sticky/image/stamp: height. */
  h?: number;
  hl?: boolean;
  /** stroke: look of the line — dashed, neon glow or rainbow (unset = solid). */
  sty?: Exclude<PenStyle, "solid">;
  /** stroke: flat [x, y, pressure(0–100), …]. */
  pts?: number[];
  shape?: ShapeKind;
  x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number;
  fill?: string | null;
  text?: string;
  size?: number;
  bold?: boolean;
  imageId?: string;
  /** Signed link (client-only, refreshed from the server; never stored). */
  url?: string;
  stamp?: StampKind;
  rot?: number;
  opts?: Record<string, OptVal>;
  /** Group id: elements of one template move together. */
  grp?: string;
  /** shapes: dashed outline. */
  dash?: boolean;
  // ── text inside shapes / typeable cells ── (`text`, `size`, `bold`, `c` are reused for the label)
  /** shape label: text colour (unset = the board's ink). */
  tc?: string;
  /** shape label: horizontal alignment (default centred). */
  al?: "l" | "c" | "r";
  /** shape label: vertical alignment (default middle). */
  va?: "t" | "m" | "b";
  /** placeholder hint shown (on screen only, never exported) while a cell is empty. */
  ph?: string;
  /** A typeable cell: its whole inside is clickable and it shows `ph` while empty. */
  cell?: boolean;
  /** Fill opacity 0–1 (unset = the light 22% wash older boards use). */
  fa?: number;
  /** Shape without an outline. */
  ns?: boolean;
  /** Regular polygon: number of sides (3–12) for shape "ngon". */
  n?: number;
  /** Triangle: where the apex sits along the base (0 = left end, 0.5 = middle, 1 = right end; outside 0–1 = obtuse). */
  ap?: number;
  /** Locked: can't be moved, resized or rubbed out until unlocked. */
  lock?: boolean;
  /** Arrow head: none / open (default) / filled / dot. */
  ah?: "none" | "open" | "filled" | "dot";
  /** Connector: the ids of the shapes an arrow/line is attached to (it follows them). */
  fr?: string;
  to?: string;
}

export interface Perm { all: boolean; ids: string[] }
export interface Page { id: string; bg: BgKind; els: Map<string, El> }
export interface BoardState {
  pages: Page[];
  /** Who besides the tutor may write: everyone (`all`), or just these children (`ids`). */
  perm: Perm;
  /** page id → v of its last "clear": adds older than that are late arrivals and ignored. */
  cleared: Record<string, number>;
  /** element id → v it was deleted at (tombstones). */
  dead: Record<string, number>;
}

export const PT = 3; // numbers per stroke point
export const MAX_PAGES = 30;
export const MAX_ELS_PER_PAGE = 4000;
export const MAX_PTS = 20_000;
/** The most characters one text / sticky / cell label can hold (the server clips at the same figure). */
export const MAX_TEXT_CHARS = 2000;

export type Op =
  | { op: "add"; page: string; el: El }
  | { op: "pts"; page: string; id: string; from: number; pts: number[] }
  | { op: "upd"; page: string; id: string; patch: Partial<El>; v: number }
  | { op: "del"; page: string; ids: string[]; v: number }
  | { op: "clear"; page: string; v: number }
  | { op: "bg"; page: string; bg: BgKind; v: number }
  | { op: "padd"; id: string; bg: BgKind }
  | { op: "pdel"; id: string }
  | { op: "pages"; pages: { id: string; bg: BgKind }[] }
  | { op: "perm"; all: boolean; ids: string[] }
  | { op: "reset" };

export interface Sender { tutor: boolean; own: string; by?: string; cid?: string }
export const TUTOR: Sender = { tutor: true, own: "T" };
/** May this sender write to a board with this permission? (The tutor always may; a student when allowed — by name or as part of "everyone".) */
export const mayWrite = (perm: Perm, who: Sender) => who.tutor || perm.all || (!!who.cid && perm.ids.includes(who.cid));
export const nobody = (): Perm => ({ all: false, ids: [] });

// ── ids / clocks ──
const ALPHA = "abcdefghijklmnopqrstuvwxyz0123456789";
export function newId(prefix = ""): string {
  let s = "";
  const g = typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (g?.getRandomValues) { const a = new Uint8Array(9); g.getRandomValues(a); for (const b of a) s += ALPHA[b % ALPHA.length]; }
  else for (let i = 0; i < 9; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return prefix + s;
}
let lastV = 0;
/** A strictly increasing version (wall-clock ms, bumped on ties). */
export function nextV(): number { lastV = Math.max(Date.now(), lastV + 1); return lastV; }
/** Reserve `n` consecutive versions and return the first (so `v + i` for i < n can never be overtaken by a later edit's nextV()). */
export function reserveV(n: number): number { const v = nextV(); lastV = v + Math.max(0, n - 1); return v; }

export const isStudentKey = (own: string) => own.startsWith("c:");

export function newState(): BoardState {
  return { pages: [{ id: "p1", bg: "blank", els: new Map() }], perm: nobody(), cleared: {}, dead: {} };
}
export const pageOf = (s: BoardState, id: string) => s.pages.find((p) => p.id === id);
export const sorted = (p: Page): El[] => [...p.els.values()].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
export const topZ = (p: Page) => { let m = 0; for (const e of p.els.values()) if (e.z > m) m = e.z; return m + 1; };

// ── geometry ──
export interface Rect { x: number; y: number; w: number; h: number }
type Measurer = (text: string, size: number, bold: boolean) => number;
let measurer: Measurer = (t, size, bold) => t.length * size * (bold ? 0.6 : 0.54);
export function setTextMeasurer(m: Measurer) { measurer = m; }
export const measureText = (t: string, size: number, bold: boolean) => measurer(t, size, bold);
export const LINE_H = 1.32;
export function textBox(e: El): Rect {
  const lines = (e.text ?? "").split("\n");
  const size = e.size ?? 28;
  let w = 8;
  for (const l of lines) w = Math.max(w, measurer(l || " ", size, !!e.bold));
  return { x: e.x ?? 0, y: e.y ?? 0, w: w + 6, h: lines.length * size * LINE_H + 4 };
}

export const rad = (deg: number) => (deg * Math.PI) / 180;
function rotPoint(px: number, py: number, cx: number, cy: number, a: number) {
  const s = Math.sin(a), c = Math.cos(a), dx = px - cx, dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

/** Axis-aligned bounds of an element in board coordinates. */
export function boundsOf(e: El): Rect {
  switch (e.k) {
    case "stroke": {
      const p = e.pts ?? [];
      if (!p.length) return { x: 0, y: 0, w: 0, h: 0 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < p.length; i += PT) { x0 = Math.min(x0, p[i]!); y0 = Math.min(y0, p[i + 1]!); x1 = Math.max(x1, p[i]!); y1 = Math.max(y1, p[i + 1]!); }
      const r = (e.w ?? 4) / 2 + 2;
      return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r };
    }
    case "shape": {
      let x0 = Math.min(e.x1 ?? 0, e.x2 ?? 0), y0 = Math.min(e.y1 ?? 0, e.y2 ?? 0), ww = Math.abs((e.x2 ?? 0) - (e.x1 ?? 0)), hh = Math.abs((e.y2 ?? 0) - (e.y1 ?? 0));
      if (e.shape === "triangle" && e.ap !== undefined && (e.ap < 0 || e.ap > 1)) { // an obtuse apex hangs outside the base's box
        const ax = x0 + clampAp(e.ap) * ww, nx0 = Math.min(x0, ax), nx1 = Math.max(x0 + ww, ax);
        x0 = nx0; ww = nx1 - nx0;
      }
      const r = (e.w ?? 4) / 2 + (e.shape === "arrow" || e.shape === "darrow" ? 10 : 2);
      return { x: x0 - r, y: y0 - r, w: ww + 2 * r, h: hh + 2 * r };
    }
    case "text": return textBox(e);
    default: {
      const r = { x: e.x ?? 0, y: e.y ?? 0, w: e.w ?? 100, h: e.h ?? 100 };
      if (!e.rot) return r;
      const rc = rotCentre(e), cx = rc.x, cy = rc.y, a = rad(e.rot);
      const cs = [rotPoint(r.x, r.y, cx, cy, a), rotPoint(r.x + r.w, r.y, cx, cy, a), rotPoint(r.x + r.w, r.y + r.h, cx, cy, a), rotPoint(r.x, r.y + r.h, cx, cy, a)];
      const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export const inRect = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/** Triangle apex position, kept within a sane obtuse range. */
const clampAp = (ap?: number) => Math.max(-0.75, Math.min(1.75, ap ?? 0.5));

/** A closed shape's outline (clockwise, first point not repeated) inside the box l,t → r,b. Curves are sampled into short segments. */
export function polyPoints(kind: ShapeKind, l: number, t: number, r: number, b: number, o: { n?: number; ap?: number } = {}): [number, number][] {
  const W = r - l, H = b - t;
  const at = (u: number, v: number): [number, number] => [l + u * W, t + v * H];
  /** Points given in any units, scaled so their bounding box fills the unit square. */
  const fit = (raw: [number, number][]): [number, number][] => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of raw) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const sw = x1 - x0 || 1, sh = y1 - y0 || 1;
    return raw.map(([x, y]) => at((x - x0) / sw, (y - y0) / sh));
  };
  switch (kind) {
    case "triangle": return [at(clampAp(o.ap), 0), at(1, 1), at(0, 1)];
    case "parallelogram": return [at(0.22, 0), at(1, 0), at(0.78, 1), at(0, 1)];
    case "trapezium": return [at(0.22, 0), at(0.78, 0), at(1, 1), at(0, 1)];
    case "kite": return [at(0.5, 0), at(1, 0.38), at(0.5, 1), at(0, 0.38)];
    case "ngon": {
      // a REGULAR polygon, as large as fits the box (so it stays regular however the box is dragged), point up
      const n = Math.max(3, Math.min(12, Math.round(o.n ?? 5)));
      const raw = Array.from({ length: n }, (_, i): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [Math.cos(a), Math.sin(a)]; });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of raw) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const sc = Math.min(W / (x1 - x0), H / (y1 - y0)), cx = l + W / 2, cy = t + H / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      return raw.map(([x, y]): [number, number] => [cx + (x - mx) * sc, cy + (y - my) * sc]);
    }
    case "diamond": return [at(0.5, 0), at(1, 0.5), at(0.5, 1), at(0, 0.5)];
    case "rtriangle": return [at(0, 0), at(1, 1), at(0, 1)];
    case "hexagon": return [at(0.25, 0), at(0.75, 0), at(1, 0.5), at(0.75, 1), at(0.25, 1), at(0, 0.5)];
    case "pentagon": return fit(Array.from({ length: 5 }, (_, i): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [Math.cos(a), Math.sin(a)]; }));
    case "star": return fit(Array.from({ length: 10 }, (_, i): [number, number] => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.42 : 1; return [rr * Math.cos(a), rr * Math.sin(a)]; }));
    case "heart": return fit(Array.from({ length: 48 }, (_, i): [number, number] => {
      const a = (i / 48) * 2 * Math.PI, s = Math.sin(a);
      return [16 * s * s * s, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))];
    }));
    case "bubble": {
      // a rounded box (top 78%) with a tail at the bottom-left
      const out: [number, number][] = [];
      const ru = 0.14, rv = 0.11, bot = 0.78;
      const arc = (cu: number, cv: number, a0: number) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); out.push(at(cu + ru * Math.cos(a), cv + rv * Math.sin(a))); } };
      arc(ru, rv, Math.PI); arc(1 - ru, rv, -Math.PI / 2); arc(1 - ru, bot - rv, 0);
      out.push(at(0.42, bot), at(0.14, 1), at(0.22, bot));
      arc(ru, bot - rv, Math.PI / 2);
      return out;
    }
    default: return [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
  }
}
export function pointInPolygon(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the point (x, y) on / inside this element, within `tol` board units? */
export function hitTest(e: El, x: number, y: number, tol: number): boolean {
  switch (e.k) {
    case "stroke": {
      const p = e.pts ?? [], r = (e.w ?? 4) / 2 + tol;
      if (!inRect(boundsOf(e), x, y, tol)) return false;
      if (p.length === PT) return Math.hypot(x - p[0]!, y - p[1]!) <= r;
      for (let i = 0; i + PT < p.length; i += PT) if (segDist(x, y, p[i]!, p[i + 1]!, p[i + PT]!, p[i + PT + 1]!) <= r) return true;
      return false;
    }
    case "shape": {
      const x1 = e.x1 ?? 0, y1 = e.y1 ?? 0, x2 = e.x2 ?? 0, y2 = e.y2 ?? 0, r = (e.w ?? 4) / 2 + tol;
      if (isLineShape(e.shape)) return segDist(x, y, x1, y1, x2, y2) <= r;
      const solid = !!e.fill || !!e.cell;
      if (e.shape === "rect") {
        const l = Math.min(x1, x2), t = Math.min(y1, y2), rr = Math.max(x1, x2), b = Math.max(y1, y2);
        if (solid) return inRect({ x: l, y: t, w: rr - l, h: b - t }, x, y, r);
        return segDist(x, y, l, t, rr, t) <= r || segDist(x, y, rr, t, rr, b) <= r || segDist(x, y, rr, b, l, b) <= r || segDist(x, y, l, b, l, t) <= r;
      }
      if (e.shape === "ellipse") {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.max(1, Math.abs(x2 - x1) / 2), ry = Math.max(1, Math.abs(y2 - y1) / 2);
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (solid) return d <= 1 + r / Math.min(rx, ry);
        return Math.abs(d - 1) <= r / Math.min(rx, ry) + 0.02;
      }
      const pts = polyPoints(isPolyShape(e.shape) ? e.shape! : "triangle", Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), { n: e.n, ap: e.ap });
      if (solid && pointInPolygon(pts, x, y)) return true;
      for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; if (segDist(x, y, a[0], a[1], b[0], b[1]) <= r) return true; }
      return false;
    }
    case "text": return inRect(textBox(e), x, y, tol);
    default: {
      const r = { x: e.x ?? 0, y: e.y ?? 0, w: e.w ?? 100, h: e.h ?? 100 };
      if (!e.rot) return inRect(r, x, y, tol);
      const rc = rotCentre(e), back = rotPoint(x, y, rc.x, rc.y, -rad(e.rot));
      return inRect(r, back.x, back.y, tol);
    }
  }
}

/** Is (x, y) strictly INSIDE a closed shape (whether or not it is filled)? Used to type into a shape by double-clicking it. */
export function insideShape(e: El, x: number, y: number): boolean {
  if (e.k !== "shape" || !isClosedShape(e.shape)) return false;
  const x1 = e.x1 ?? 0, y1 = e.y1 ?? 0, x2 = e.x2 ?? 0, y2 = e.y2 ?? 0;
  const l = Math.min(x1, x2), t = Math.min(y1, y2), rr = Math.max(x1, x2), b = Math.max(y1, y2);
  if (e.shape === "rect") return inRect({ x: l, y: t, w: rr - l, h: b - t }, x, y);
  if (e.shape === "ellipse") return Math.hypot((x - (l + rr) / 2) / Math.max(1, (rr - l) / 2), (y - (t + b) / 2) / Math.max(1, (b - t) / 2)) <= 1;
  return pointInPolygon(polyPoints(e.shape!, l, t, rr, b, { n: e.n, ap: e.ap }), x, y);
}

/** Does this element carry a typed label (a shape / cell)? Text and stickies have their own text; lines and strokes never do. */
export const canHoldText = (e: El) => e.k === "shape" && isClosedShape(e.shape);

/** Where a shape's label goes: [u0, v0, u1, v1] as fractions of its box (what fits comfortably INSIDE the outline). */
const TEXT_FRAC: Partial<Record<ShapeKind, [number, number, number, number]>> = {
  ellipse: [0.15, 0.15, 0.85, 0.85], triangle: [0.26, 0.42, 0.74, 0.96], rtriangle: [0.04, 0.42, 0.5, 0.96], diamond: [0.25, 0.25, 0.75, 0.75],
  hexagon: [0.18, 0.06, 0.82, 0.94], pentagon: [0.16, 0.3, 0.84, 0.92], star: [0.3, 0.38, 0.7, 0.78], heart: [0.2, 0.15, 0.8, 0.65],
  bubble: [0.05, 0.06, 0.95, 0.72], ngon: [0.18, 0.18, 0.82, 0.82], parallelogram: [0.2, 0.06, 0.8, 0.94], trapezium: [0.18, 0.06, 0.82, 0.94], kite: [0.28, 0.22, 0.72, 0.8],
};
export function shapeTextArea(e: El): Rect {
  const x1 = e.x1 ?? 0, y1 = e.y1 ?? 0, x2 = e.x2 ?? 0, y2 = e.y2 ?? 0;
  const l = Math.min(x1, x2), t = Math.min(y1, y2), W = Math.abs(x2 - x1), H = Math.abs(y2 - y1);
  const f = TEXT_FRAC[e.shape!];
  if (f) return { x: l + W * f[0], y: t + H * f[1], w: W * (f[2] - f[0]), h: H * (f[3] - f[1]) };
  const pad = Math.min(8, W / 8, H / 6); // a rectangle / cell
  return { x: l + pad, y: t + pad * 0.6, w: Math.max(4, W - pad * 2), h: Math.max(4, H - pad * 1.2) };
}

/** The point an element turns about: the middle of its box — except a protractor made with a pivot mark, which turns about its baseline centre (where you measure from). */
export function rotCentre(e: El): { x: number; y: number } {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 0, h = e.h ?? 0;
  if (e.stamp === "protractor" && e.opts?.pv) return { x: x + w / 2, y: y + h - 8 };
  return { x: x + w / 2, y: y + h / 2 };
}

/** Scale an element by `s` about (ox, oy): positions, sizes and line widths (used to resize a whole template at once). */
export function scalePatch(e: El, s: number, ox: number, oy: number): Partial<El> {
  const sc = (v: number, o: number) => round1(o + (v - o) * s);
  if (e.k === "stroke") {
    const p = (e.pts ?? []).slice();
    for (let i = 0; i < p.length; i += PT) { p[i] = sc(p[i]!, ox); p[i + 1] = sc(p[i + 1]!, oy); }
    return { pts: p, w: Math.max(1, round1((e.w ?? 4) * s)) };
  }
  if (e.k === "shape") return { x1: sc(e.x1 ?? 0, ox), y1: sc(e.y1 ?? 0, oy), x2: sc(e.x2 ?? 0, ox), y2: sc(e.y2 ?? 0, oy), w: Math.max(1, round1((e.w ?? 4) * s)), ...(e.size ? { size: Math.max(6, round1(e.size * s)) } : {}) };
  if (e.k === "text") return { x: sc(e.x ?? 0, ox), y: sc(e.y ?? 0, oy), size: Math.max(6, round1((e.size ?? 28) * s)) };
  return { x: sc(e.x ?? 0, ox), y: sc(e.y ?? 0, oy), w: round1((e.w ?? 100) * s), h: round1((e.h ?? 100) * s), ...(e.k === "sticky" ? { size: Math.max(6, round1((e.size ?? 22) * s)) } : {}) };
}

// ── connectors: arrows / lines attached to shapes (they follow when a shape moves) ──
/** The box a connector can attach to: a closed shape, a note, a picture or an aid. */
function bindBox(e: El): Rect | null {
  if (e.k === "shape" && isClosedShape(e.shape)) { const l = Math.min(e.x1 ?? 0, e.x2 ?? 0), t = Math.min(e.y1 ?? 0, e.y2 ?? 0); return { x: l, y: t, w: Math.abs((e.x2 ?? 0) - (e.x1 ?? 0)), h: Math.abs((e.y2 ?? 0) - (e.y1 ?? 0)) }; }
  if (e.k === "sticky" || e.k === "image" || e.k === "stamp") return { x: e.x ?? 0, y: e.y ?? 0, w: e.w ?? 100, h: e.h ?? 100 };
  return null;
}
export const canBind = (e: El) => bindBox(e) !== null;
export const isConnector = (e: El) => e.k === "shape" && isLineShape(e.shape) && !!(e.fr || e.to);
/** Where a line from the middle of `e` towards (tx, ty) leaves its outline. */
export function anchorToward(e: El, tx: number, ty: number): { x: number; y: number } | null {
  const b = bindBox(e);
  if (!b) return null;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: b.y + b.h };
  if (e.k === "shape" && e.shape === "ellipse") { const k = 1 / Math.hypot(dx / Math.max(1, b.w / 2), dy / Math.max(1, b.h / 2)); return { x: cx + dx * k, y: cy + dy * k }; }
  const k = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * k, y: cy + dy * k };
}
/** Re-aim every attached connector at the shapes it is bound to. Returns the ids that changed. Pure: peers derive the same result from the same shapes. */
export function routeConnectors(els: Map<string, El>, skip?: Set<string>): string[] {
  const changed: string[] = [];
  for (const e of els.values()) {
    if (!isConnector(e) || skip?.has(e.id)) continue;
    const A = e.fr ? els.get(e.fr) : undefined, B = e.to ? els.get(e.to) : undefined;
    if (!A && !B) continue;
    const ca = A && bindBox(A), cb = B && bindBox(B);
    const pa = { x: e.x1 ?? 0, y: e.y1 ?? 0 }, pb = { x: e.x2 ?? 0, y: e.y2 ?? 0 };
    const na = A && ca ? anchorToward(A, cb ? cb.x + cb.w / 2 : pb.x, cb ? cb.y + cb.h / 2 : pb.y) : null;
    const nb = B && cb ? anchorToward(B, ca ? ca.x + ca.w / 2 : pa.x, ca ? ca.y + ca.h / 2 : pa.y) : null;
    const x1 = na ? round1(na.x) : pa.x, y1 = na ? round1(na.y) : pa.y, x2 = nb ? round1(nb.x) : pb.x, y2 = nb ? round1(nb.y) : pb.y;
    if (x1 !== e.x1 || y1 !== e.y1 || x2 !== e.x2 || y2 !== e.y2) { e.x1 = x1; e.y1 = y1; e.x2 = x2; e.y2 = y2; changed.push(e.id); }
  }
  return changed;
}
/** The connectable element under (x, y) (within `tol`), topmost first, other than `self`. */
export function bindTarget(els: Iterable<El>, x: number, y: number, tol: number, self: string): El | null {
  let best: El | null = null;
  for (const e of els) {
    if (e.id === self || !canBind(e)) continue;
    const b = bindBox(e)!;
    if (x < b.x - tol || x > b.x + b.w + tol || y < b.y - tol || y > b.y + b.h + tol) continue;
    if (!best || e.z >= best.z) best = e;
  }
  return best;
}

/** Move an element by (dx, dy). Returns the patch that does it. */
export function movePatch(e: El, dx: number, dy: number): Partial<El> {
  if (e.k === "stroke") {
    const p = (e.pts ?? []).slice();
    for (let i = 0; i < p.length; i += PT) { p[i] = round1(p[i]! + dx); p[i + 1] = round1(p[i + 1]! + dy); }
    return { pts: p };
  }
  if (e.k === "shape") return { x1: round1((e.x1 ?? 0) + dx), y1: round1((e.y1 ?? 0) + dy), x2: round1((e.x2 ?? 0) + dx), y2: round1((e.y2 ?? 0) + dy) };
  return { x: round1((e.x ?? 0) + dx), y: round1((e.y ?? 0) + dy) };
}
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Drop points that add nothing (Ramer–Douglas–Peucker on x/y; pressure follows its point). */
export function simplifyPts(pts: number[], tol: number): number[] {
  const n = pts.length / PT;
  if (n <= 2 || tol <= 0) return pts;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i * PT]!, pts[i * PT + 1]!, pts[a * PT]!, pts[a * PT + 1]!, pts[b * PT]!, pts[b * PT + 1]!);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx >= 0 && maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * PT]!, pts[i * PT + 1]!, pts[i * PT + 2]!);
  return out;
}

// ── stamps ──
export interface StampDef { kind: StampKind; label: string; w: number; h: number; opts: Record<string, OptVal>; rotates?: boolean }
export const STAMPS: StampDef[] = [
  { kind: "numberline", label: "Number line", w: 760, h: 96, opts: { min: 0, max: 10, step: 1 } },
  { kind: "fractions", label: "Fraction bar", w: 640, h: 70, opts: { parts: 4, mask: 0 } },
  { kind: "coordgrid", label: "Coordinate grid", w: 440, h: 440, opts: { n: 10 } },
  { kind: "timestable", label: "Times-table grid", w: 440, h: 440, opts: { n: 10 } },
  { kind: "clock", label: "Clock face", w: 240, h: 240, opts: { hh: 3, mm: 0 } },
  { kind: "ruler", label: "Ruler", w: 640, h: 64, opts: {}, rotates: true },
  { kind: "protractor", label: "Protractor", w: 380, h: 200, opts: { pv: 1 }, rotates: true },
];
/** Extra (toolkit) stamps: compact, data-driven (`opts`), drawn by render-stamps.ts. */
export const EXTRA_STAMPS: StampDef[] = [
  { kind: "periodic", label: "Periodic table", w: 1120, h: 640, opts: { sel: "", colour: 1 } },
  { kind: "plot", label: "Function plotter", w: 460, h: 460, opts: { expr: "x^2", expr2: "", range: 10 } },
  { kind: "bohr", label: "Atom (Bohr model)", w: 300, h: 300, opts: { shells: "2,8,1", symbol: "Na" } },
  { kind: "symbol", label: "Circuit symbol", w: 150, h: 90, opts: { kind: "cell" } },
  { kind: "apparatus", label: "Apparatus", w: 130, h: 170, opts: { kind: "beaker" } },
  { kind: "lens", label: "Ray diagram", w: 760, h: 380, opts: { type: "convex", f: 140, obj: 260 } },
  { kind: "timeline", label: "Timeline", w: 900, h: 260, opts: { start: 1000, end: 2000, events: "1066|Battle of Hastings;1215|Magna Carta;1485|Battle of Bosworth" } },
  { kind: "textblock", label: "Text to annotate", w: 720, h: 400, opts: { text: "Paste or type a text here. Then highlight, underline and circle words with the pen tools, and add margin notes with sticky notes.", size: 24 } },
  { kind: "timer", label: "Countdown timer", w: 260, h: 130, opts: { secs: 300, endsAt: 0, left: 300 } },
  { kind: "dice", label: "Dice", w: 250, h: 130, opts: { n: 1, a: 4, b: 2, rolls: 0 } },
  { kind: "spinner", label: "Spinner wheel", w: 340, h: 340, opts: { items: "Alex,Sam,Jo,Priya,Kai,Mia", spin: 0, pick: -1 } },
  { kind: "tally", label: "Score counter", w: 200, h: 150, opts: { n: 0, label: "Score" } },
  { kind: "map", label: "Outline map", w: 900, h: 480, opts: { region: "world", grid: false, labels: true } },
];
export const stampDef = (k: StampKind) => [...STAMPS, ...EXTRA_STAMPS].find((s) => s.kind === k)!;

// ── the tutor's saved copy: state ⇄ JSON ──
export interface SavedPage { id: string; background: BgKind; elements: El[] }
export function toSaved(s: BoardState): SavedPage[] {
  return s.pages.map((p) => ({ id: p.id, background: p.bg, elements: sorted(p).map(stripClient) }));
}
export function stripClient(e: El): El { const { url: _u, ...rest } = e; return rest; }
export function fromSaved(pages: SavedPage[] | undefined): BoardState {
  const s = newState();
  if (!pages?.length) return s;
  s.pages = pages.slice(0, MAX_PAGES).map((p) => ({ id: p.id, bg: p.background, els: new Map(p.elements.map((e) => [e.id, { ...e }])) }));
  return s;
}
export const saveSize = (pages: SavedPage[]) => JSON.stringify({ pages }).length;

/** Shrink strokes until the saved board fits `limit` bytes (progressively coarser). Returns null if it can't. */
export function fitToLimit(pages: SavedPage[], limit: number): SavedPage[] | null {
  if (saveSize(pages) <= limit) return pages;
  for (const tol of [0.6, 1.2, 2.4, 4, 7]) {
    const next = pages.map((p) => ({ ...p, elements: p.elements.map((e) => (e.k === "stroke" && e.pts ? { ...e, pts: simplifyPts(e.pts, tol) } : e)) }));
    if (saveSize(next) <= limit) return next;
  }
  return null;
}

/** Board palette defaults (hex) — overridden at runtime from the portal's colour tokens. */
export const DEFAULT_PALETTE = ["#1b1f2a", "#e21d27", "#f97316", "#f5b81f", "#15b364", "#0ea5e9", "#2f6bd8", "#6a4fd0", "#e22295"];
export const PEN_SIZES = [3, 6, 10, 16];
export const HL_SIZES = [16, 24, 34, 46];
export const ERASER_SIZES = [14, 26, 44, 70];
export const TEXT_SIZES = [20, 28, 40, 60];
export const STICKY_COLOURS = ["#fff3b0", "#ffd6e0", "#c9f0d6", "#cfe4ff", "#e6dcff"];
