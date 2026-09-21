import { drawExtraStamp } from "./render-stamps";
import { LINE_H, PT, boundsOf, canHoldText, isLineShape, isPolyShape, measureText, polyPoints, rad, rotCentre, setTextMeasurer, shapeTextArea, sorted, stampDef, type BgKind, type El, type Page, type Rect } from "./model";

// Canvas rendering for the whiteboard: backgrounds, every element kind, the
// teaching stamps, and the overlays (selection, laser, cursors). Everything is
// drawn in BOARD coordinates under one view transform, so it is crisp at any
// zoom and on high-DPI screens. Also used off-screen to export a page as a PNG.

export interface View { x: number; y: number; k: number }
export interface Paper { paper: string; grid: string; gridStrong: string; axis: string; ink: string; label: string; brand: string; brandSoft: string; danger: string; font: string }
export const DEFAULT_PAPER: Paper = { paper: "#ffffff", grid: "#dde4f0", gridStrong: "#c3cde2", axis: "#5b6b8c", ink: "#1b1f2a", label: "#4a5677", brand: "#2f6bd8", brandSoft: "#eaf0fc", danger: "#e21d27", font: "system-ui, sans-serif" };

/** Loads and caches the board's pictures (CORS-clean so an export can read them). */
export class ImageCache {
  private m = new Map<string, { img: HTMLImageElement; state: "loading" | "ok" | "bad"; src: string }>();
  constructor(private onChange: () => void) {}
  get(id: string, url: string | undefined) {
    const cur = this.m.get(id);
    if (cur && cur.src === url) return cur;
    if (!url) return { img: null, state: "loading" as const };
    const img = new Image();
    img.crossOrigin = "anonymous";
    const rec = { img, state: "loading" as "loading" | "ok" | "bad", src: url };
    img.onload = () => { rec.state = "ok"; this.onChange(); };
    img.onerror = () => { rec.state = "bad"; this.onChange(); };
    img.src = url + (url.includes("?") ? "&" : "?") + "cors=1";
    this.m.set(id, rec);
    return rec;
  }
  /** Resolve once everything currently requested has settled (for an export). */
  async settled(ms = 6000) {
    const t0 = Date.now();
    while ([...this.m.values()].some((r) => r.state === "loading") && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 60));
  }
}

export interface Env { k: number; paper: Paper; images: ImageCache; /** Names of student authors to tag, id → show */ tags?: Set<string>; forExport?: boolean; /** The element whose text is being typed into right now (its own text is not drawn under the editor). */ editing?: string }

let mctx: CanvasRenderingContext2D | null = null;
/** Make text bounds use real font metrics. */
export function installMeasurer(font: string) {
  if (typeof document === "undefined") return;
  mctx ??= document.createElement("canvas").getContext("2d");
  if (!mctx) return;
  setTextMeasurer((t, size, bold) => { mctx!.font = `${bold ? 700 : 500} ${size}px ${font}`; return mctx!.measureText(t).width; });
}

// ── backgrounds ─────────────────────────────────────────────────────────────
export const GRID = 40;
export function visibleWorld(view: View, w: number, h: number): Rect {
  return { x: -view.x / view.k, y: -view.y / view.k, w: w / view.k, h: h / view.k };
}

export function drawBackground(ctx: CanvasRenderingContext2D, bg: BgKind, vw: Rect, env: Env) {
  const { paper: P, k } = env;
  const hair = 1 / k;
  ctx.save();
  ctx.lineWidth = hair;
  const x0 = vw.x, y0 = vw.y, x1 = vw.x + vw.w, y1 = vw.y + vw.h;
  if (bg === "lined") {
    ctx.strokeStyle = P.grid; ctx.beginPath();
    const s = 44;
    for (let y = Math.floor(y0 / s) * s; y <= y1; y += s) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = P.danger; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(-560, y0); ctx.lineTo(-560, y1); ctx.stroke();
  } else if (bg === "squared") {
    for (const strong of [false, true]) {
      ctx.strokeStyle = strong ? P.gridStrong : P.grid; ctx.beginPath();
      const s = GRID;
      for (let x = Math.floor(x0 / s) * s; x <= x1; x += s) if ((Math.round(x / s) % 5 === 0) === strong) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = Math.floor(y0 / s) * s; y <= y1; y += s) if ((Math.round(y / s) % 5 === 0) === strong) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
  } else if (bg === "graph") {
    const n = 10, s = GRID, R = n * s;
    ctx.strokeStyle = P.grid; ctx.beginPath();
    for (let i = -n; i <= n; i++) { ctx.moveTo(i * s, -R); ctx.lineTo(i * s, R); ctx.moveTo(-R, i * s); ctx.lineTo(R, i * s); }
    ctx.stroke();
    ctx.strokeStyle = P.axis; ctx.lineWidth = 2 / k; ctx.beginPath();
    ctx.moveTo(-R - 26, 0); ctx.lineTo(R + 26, 0); ctx.moveTo(0, -R - 26); ctx.lineTo(0, R + 26);
    // arrow heads
    ctx.moveTo(R + 26, 0); ctx.lineTo(R + 12, -6); ctx.moveTo(R + 26, 0); ctx.lineTo(R + 12, 6);
    ctx.moveTo(0, -R - 26); ctx.lineTo(-6, -R - 12); ctx.moveTo(0, -R - 26); ctx.lineTo(6, -R - 12);
    for (let i = -n; i <= n; i++) if (i) { ctx.moveTo(i * s, -5); ctx.lineTo(i * s, 5); ctx.moveTo(-5, i * s); ctx.lineTo(5, i * s); }
    ctx.stroke();
    ctx.fillStyle = P.label; ctx.font = `600 13px ${P.font}`; ctx.textBaseline = "top"; ctx.textAlign = "center";
    for (let i = -n; i <= n; i++) if (i && i % (k < 0.5 ? 2 : 1) === 0) ctx.fillText(String(i), i * s, 8);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = -n; i <= n; i++) if (i && i % (k < 0.5 ? 2 : 1) === 0) ctx.fillText(String(-i), -9, i * s);
    ctx.fillText("0", -9, 11);
    ctx.font = `italic 700 17px ${P.font}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("x", R + 32, 0); ctx.textAlign = "center"; ctx.fillText("y", 0, -R - 38);
  } else if (bg === "numberline") {
    const n = 10, s = 60, R = n * s;
    ctx.strokeStyle = P.axis; ctx.lineWidth = 2.5 / k; ctx.beginPath();
    ctx.moveTo(-R - 34, 0); ctx.lineTo(R + 34, 0);
    ctx.moveTo(R + 34, 0); ctx.lineTo(R + 18, -8); ctx.moveTo(R + 34, 0); ctx.lineTo(R + 18, 8);
    ctx.moveTo(-R - 34, 0); ctx.lineTo(-R - 18, -8); ctx.moveTo(-R - 34, 0); ctx.lineTo(-R - 18, 8);
    for (let i = -n; i <= n; i++) { const h = i % 5 === 0 ? 14 : 9; ctx.moveTo(i * s, -h); ctx.lineTo(i * s, h); }
    ctx.stroke();
    ctx.fillStyle = P.ink; ctx.font = `700 20px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = -n; i <= n; i++) ctx.fillText(String(i), i * s, 22);
  } else if (bg === "handwriting") {
    // primary handwriting lines: solid baseline, dashed midline, faint top line (band height 88)
    const s = 100;
    for (let y = Math.floor(y0 / s) * s; y <= y1 + s; y += s) {
      ctx.strokeStyle = P.grid; ctx.beginPath(); ctx.moveTo(x0, y - 44); ctx.lineTo(x1, y - 44); ctx.stroke();
      ctx.strokeStyle = P.gridStrong; ctx.setLineDash([7 / k, 7 / k]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = P.axis; ctx.lineWidth = 1.8 / k; ctx.beginPath(); ctx.moveTo(x0, y + 44); ctx.lineTo(x1, y + 44); ctx.stroke(); ctx.lineWidth = hair;
    }
  } else if (bg === "dotgrid") {
    const s = 32, skip = Math.max(1, Math.ceil(0.9 / (k * s / 32)));
    ctx.fillStyle = P.gridStrong; ctx.beginPath(); const r = 1.7 / Math.max(k, 0.4);
    for (let x = Math.floor(x0 / s / skip) * s * skip; x <= x1; x += s * skip) for (let y = Math.floor(y0 / s / skip) * s * skip; y <= y1; y += s * skip) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fill();
  } else if (bg === "tianzige") {
    // Chinese character practice: 100-unit squares with dashed cross and diagonals
    const s = 100;
    ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 1.6 / k; ctx.beginPath();
    for (let x = Math.floor(x0 / s) * s; x <= x1; x += s) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.floor(y0 / s) * s; y <= y1; y += s) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = P.grid; ctx.lineWidth = hair; ctx.setLineDash([5 / k, 5 / k]); ctx.beginPath();
    for (let x = Math.floor(x0 / s) * s; x <= x1; x += s) for (let y = Math.floor(y0 / s) * s; y <= y1; y += s) {
      ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s); ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y); ctx.lineTo(x, y + s);
    }
    ctx.stroke(); ctx.setLineDash([]);
  } else if (bg === "twocol") {
    ctx.strokeStyle = P.axis; ctx.lineWidth = 2.5 / k; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.stroke();
    ctx.strokeStyle = P.grid; ctx.lineWidth = hair; ctx.beginPath();
    for (let y = Math.floor(y0 / 56) * 56; y <= y1; y += 56) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  } else if (bg === "storymap" || bg === "diagram" || bg === "vocab") {
    drawFrame(ctx, bg, env);
  } else if (bg === "isometric") {
    const s = 36, dy = s * Math.sqrt(3) / 2;
    const cols = (x1 - x0) / s, rows = (y1 - y0) / dy;
    const skip = Math.max(1, Math.ceil(Math.sqrt((cols * rows) / 9000)));
    ctx.fillStyle = P.gridStrong; ctx.beginPath();
    const r = 1.9 / Math.max(k, 0.35);
    for (let j = Math.floor(y0 / dy / skip) * skip; j * dy <= y1; j += skip) {
      const off = (((j % 2) + 2) % 2) * (s / 2);
      for (let x = Math.floor((x0 - off) / s / skip) * s * skip + off; x <= x1; x += s * skip) { ctx.moveTo(x + r, j * dy); ctx.arc(x, j * dy, r, 0, Math.PI * 2); }
    }
    ctx.fill();
  }
  ctx.restore();
}

/** The world box each subject frame is drawn in (centred on the origin), so "fit the view" includes it. */
export const FRAME_BOX: Partial<Record<BgKind, Rect>> = {
  storymap: { x: -600, y: -400, w: 1200, h: 800 },
  diagram: { x: -640, y: -400, w: 1280, h: 800 },
  vocab: { x: -600, y: -400, w: 1200, h: 800 },
};
/** Section labels of the story map, top to bottom. */
export const STORY_MAP_ROWS = ["Opening", "Build-up", "Problem", "Resolution", "Ending"];
/** Column headings of the vocabulary grid. */
export const VOCAB_COLS = ["Word", "Meaning", "Example sentence"];

/** A subject frame: a fixed page-sized frame around the origin that is written over (it is background, so it never moves or rubs out). */
function drawFrame(ctx: CanvasRenderingContext2D, bg: "storymap" | "diagram" | "vocab", env: Env) {
  const { paper: P, k } = env, F = FRAME_BOX[bg]!, hair = 1 / k;
  const L = F.x, T = F.y, R = F.x + F.w, B = F.y + F.h;
  ctx.save();
  ctx.lineWidth = 2 / k; ctx.strokeStyle = P.axis; ctx.fillStyle = P.label; ctx.font = `700 20px ${P.font}`;
  if (bg === "storymap") {
    // five stacked sections, each with a heading strip and faint writing lines
    const n = STORY_MAP_ROWS.length, rh = F.h / n, head = 40;
    ctx.strokeRect(L, T, F.w, F.h);
    for (let i = 0; i < n; i++) {
      const y = T + i * rh;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.moveTo(L, y + head); ctx.lineTo(L + 190, y + head); ctx.moveTo(L + 190, y); ctx.lineTo(L + 190, y + head); ctx.stroke();
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(STORY_MAP_ROWS[i]!, L + 14, y + head / 2);
      ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = hair; ctx.beginPath();
      for (let ly = y + head + 44; ly < y + rh - 8; ly += 44) { ctx.moveTo(L + 10, ly); ctx.lineTo(R - 10, ly); }
      ctx.stroke(); ctx.restore();
    }
  } else if (bg === "diagram") {
    // a title line, a big drawing area and four dashed label boxes each side with leader lines pointing at it
    ctx.beginPath(); ctx.moveTo(L + 200, T + 40); ctx.lineTo(R - 200, T + 40); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("Title:", L + 200, T + 34);
    const dx = L + 340, dy = T + 90, dw = F.w - 680, dh = F.h - 130;
    ctx.save(); ctx.setLineDash([10 / k, 8 / k]); ctx.strokeStyle = P.gridStrong; ctx.strokeRect(dx, dy, dw, dh); ctx.restore();
    ctx.font = `600 15px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = P.axis; ctx.fillText("Draw your diagram here", dx + dw / 2, dy + 10);
    ctx.font = `700 18px ${P.font}`; ctx.fillStyle = P.label;
    for (let i = 0; i < 4; i++) {
      const y = dy + 40 + i * ((dh - 80) / 3), bw = 250, bh = 56;
      for (const side of [-1, 1]) {
        const bx = side < 0 ? L + 20 : R - 20 - bw;
        ctx.save(); ctx.setLineDash([7 / k, 6 / k]); ctx.strokeStyle = P.axis; ctx.strokeRect(bx, y - bh / 2, bw, bh); ctx.restore();
        ctx.beginPath(); ctx.moveTo(side < 0 ? bx + bw : bx, y); ctx.lineTo(side < 0 ? dx : dx + dw, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(side < 0 ? dx : dx + dw, y, 4 / Math.max(k, 0.5), 0, Math.PI * 2); ctx.fillStyle = P.axis; ctx.fill(); ctx.fillStyle = P.label;
        ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1 + (side > 0 ? 4 : 0)), bx + 10, y);
      }
    }
  } else {
    // vocabulary grid: a bold heading row then lined rows (word · meaning · example)
    const cols = [0.24, 0.36, 0.4], rows = 10, hh = 52, rh = (F.h - hh) / rows;
    ctx.save(); ctx.fillStyle = P.brandSoft; ctx.fillRect(L, T, F.w, hh); ctx.restore();
    ctx.strokeRect(L, T, F.w, F.h);
    ctx.beginPath(); ctx.moveTo(L, T + hh); ctx.lineTo(R, T + hh); ctx.stroke();
    let x = L;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    cols.forEach((f, i) => { ctx.fillText(VOCAB_COLS[i]!, x + 14, T + hh / 2); if (i) { ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, B); ctx.stroke(); } x += f * F.w; });
    ctx.strokeStyle = P.grid; ctx.lineWidth = hair; ctx.beginPath();
    for (let i = 1; i < rows; i++) { const y = T + hh + i * rh; ctx.moveTo(L, y); ctx.lineTo(R, y); }
    ctx.stroke();
  }
  ctx.restore();
}

// ── strokes ─────────────────────────────────────────────────────────────────
const pathCache = new Map<string, { n: number; w: number; path: Path2D; uniform: boolean }>();
function isUniform(p: number[]) { const f = p[2]!; for (let i = 2; i < p.length; i += PT) if (Math.abs(p[i]! - f) > 6) return false; return true; }

/** A quadratic-smoothed path through the points (each point is the control, midpoints are the anchors). */
function smoothPath(p: number[]): Path2D {
  const path = new Path2D();
  const n = p.length / PT;
  path.moveTo(p[0]!, p[1]!);
  if (n === 2) { path.lineTo(p[PT]!, p[PT + 1]!); return path; }
  for (let i = 1; i < n - 1; i++) {
    const cx = p[i * PT]!, cy = p[i * PT + 1]!, nx = p[(i + 1) * PT]!, ny = p[(i + 1) * PT + 1]!;
    path.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }
  path.lineTo(p[(n - 1) * PT]!, p[(n - 1) * PT + 1]!);
  return path;
}
const pressureW = (base: number, p: number) => base * (0.35 + 1.3 * (p / 100));

/** "#rrggbb" mixed `t` of the way towards white (falls back to the input for anything else). */
export function lighten(hex: string, t: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16), ch = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Dashed / neon / rainbow pens: constant width (pressure is ignored so the look stays clean). */
function drawStyledStroke(ctx: CanvasRenderingContext2D, e: El, p: number[], n: number, w: number, path: Path2D) {
  const c = e.c ?? "#000";
  if (e.sty === "dash") {
    ctx.lineWidth = w; ctx.setLineDash([w * 0.05, w * 2.4]); // round caps turn zero-length dashes into dots
    ctx.stroke(path);
  } else if (e.sty === "neon") {
    ctx.save();
    ctx.shadowColor = c; ctx.shadowBlur = w * 3 + 6; ctx.globalAlpha = 0.55; ctx.lineWidth = w * 1.9; ctx.stroke(path);
    ctx.restore();
    ctx.lineWidth = w; ctx.stroke(path);
    ctx.strokeStyle = lighten(c, 0.6); ctx.lineWidth = Math.max(1, w * 0.34); ctx.stroke(path);
  } else {
    // rainbow: the hue walks round the colour wheel along the length of the line
    ctx.lineWidth = w;
    let px = p[0]!, py = p[1]!, dist = 0;
    for (let i = 1; i < n; i++) {
      const cx = p[i * PT]!, cy = p[i * PT + 1]!;
      const ex = i === n - 1 ? cx : (cx + p[(i + 1) * PT]!) / 2, ey = i === n - 1 ? cy : (cy + p[(i + 1) * PT + 1]!) / 2;
      dist += Math.hypot(ex - px, ey - py);
      ctx.strokeStyle = `hsl(${Math.round(dist * 0.55) % 360} 88% 52%)`;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
      px = ex; py = ey;
    }
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, e: El) {
  const p = e.pts ?? [];
  const n = p.length / PT;
  if (!n) return;
  const w = e.w ?? 4;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = e.c ?? "#000"; ctx.fillStyle = e.c ?? "#000";
  if (e.hl) { ctx.globalAlpha = 0.4; ctx.globalCompositeOperation = "multiply"; ctx.lineCap = "butt"; }
  if (n === 1) { ctx.beginPath(); ctx.arc(p[0]!, p[1]!, e.hl ? w / 2 : Math.max(w / 2, 1), 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
  let rec = pathCache.get(e.id);
  if (!rec || rec.n !== n) {
    rec = { n, w, path: smoothPath(p), uniform: isUniform(p) };
    if (pathCache.size > 3000) pathCache.clear();
    pathCache.set(e.id, rec);
  }
  if (e.sty && !e.hl) { drawStyledStroke(ctx, e, p, n, w, rec.path); ctx.restore(); return; }
  if (rec.uniform || e.hl) {
    ctx.lineWidth = e.hl ? w : pressureW(w, p[2]!);
    ctx.stroke(rec.path);
  } else {
    // pressure varies: stroke short quadratic pieces, each at its own width
    let px = p[0]!, py = p[1]!;
    for (let i = 1; i < n; i++) {
      const cx = p[i * PT]!, cy = p[i * PT + 1]!;
      const ex = i === n - 1 ? cx : (cx + p[(i + 1) * PT]!) / 2, ey = i === n - 1 ? cy : (cy + p[(i + 1) * PT + 1]!) / 2;
      ctx.lineWidth = pressureW(w, (p[i * PT + 2]! + p[(i - 1) * PT + 2]!) / 2);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
      px = ex; py = ey;
    }
  }
  ctx.restore();
}

// ── shapes ──────────────────────────────────────────────────────────────────
function drawShape(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x1 = e.x1 ?? 0, y1 = e.y1 ?? 0, x2 = e.x2 ?? 0, y2 = e.y2 ?? 0, w = e.w ?? 4;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = w; ctx.strokeStyle = e.c ?? "#000";
  if (e.dash) ctx.setLineDash([w * 2.6, w * 2]);
  ctx.beginPath();
  let head: { a: number; hl: number; both: boolean } | null = null;
  if (isLineShape(e.shape)) {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    if ((e.shape === "arrow" || e.shape === "darrow") && (x1 !== x2 || y1 !== y2) && e.ah !== "none") head = { a: Math.atan2(y2 - y1, x2 - x1), hl: Math.max(14, w * 4), both: e.shape === "darrow" };
  } else if (isPolyShape(e.shape)) {
    const pts = polyPoints(e.shape!, Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), { n: e.n, ap: e.ap });
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  } else if (e.shape === "rect") {
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (e.shape === "ellipse") {
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(0.5, Math.abs(x2 - x1) / 2), Math.max(0.5, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2);
  } else {
    const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
    ctx.moveTo((l + r) / 2, t); ctx.lineTo(r, b); ctx.lineTo(l, b); ctx.closePath();
  }
  if (e.fill) { ctx.globalAlpha = e.fa ?? 0.22; ctx.fillStyle = e.fill; ctx.fill(); ctx.globalAlpha = 1; }
  if (!e.ns) ctx.stroke();
  if (head) {
    ctx.setLineDash([]);
    const ends: [number, number, number][] = [[x2, y2, head.a + Math.PI]]; // [tip x, tip y, direction pointing back along the line]
    if (head.both) ends.push([x1, y1, head.a]);
    ctx.fillStyle = e.c ?? "#000";
    for (const [tx, ty, back] of ends) {
      const p1x = tx + head.hl * Math.cos(back - 0.45), p1y = ty + head.hl * Math.sin(back - 0.45), p2x = tx + head.hl * Math.cos(back + 0.45), p2y = ty + head.hl * Math.sin(back + 0.45);
      ctx.beginPath();
      if (e.ah === "filled") { ctx.moveTo(tx, ty); ctx.lineTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (e.ah === "dot") { ctx.arc(tx, ty, Math.max(4, w * 1.6), 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(tx, ty); ctx.lineTo(p1x, p1y); ctx.moveTo(tx, ty); ctx.lineTo(p2x, p2y); ctx.stroke(); }
    }
  }
  ctx.restore();
  if (canHoldText(e) && env.editing !== e.id) drawShapeLabel(ctx, e, env);
}

const fitCache = new Map<string, { size: number; lines: string[] }>();
/** A shape's label, wrapped to `area` at the biggest size (≤ `max`, default 36) that fits. */
export function layoutLabel(text: string, aw: number, ah: number, max: number | undefined, bold: boolean): { size: number; lines: string[] } {
  const key = `${text}|${Math.round(aw)}|${Math.round(ah)}|${max ?? ""}|${bold ? 1 : 0}`;
  const hit = fitCache.get(key);
  if (hit) return hit;
  const top = Math.max(9, Math.min(max ?? 36, Math.floor(ah / LINE_H)));
  let out = { size: 9, lines: wrapLines(text, aw, 9, bold) };
  for (let sz = top; sz >= 9; sz -= sz > 24 ? 2 : 1) {
    const lines = wrapLines(text, aw, sz, bold);
    if (lines.length * sz * LINE_H <= ah + 1 && lines.every((l) => measureText(l, sz, bold) <= aw + 1)) { out = { size: sz, lines }; break; }
  }
  if (fitCache.size > 600) fitCache.clear();
  fitCache.set(key, out);
  return out;
}
export const labelInk = (e: El, P: Paper) => e.tc ?? P.ink;

function drawShapeLabel(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const P = env.paper, area = shapeTextArea(e), text = e.text ?? "";
  const bold = !!e.bold;
  const empty = !text.trim();
  if (empty && (!e.ph || env.forExport || !e.cell)) return;
  const { size, lines } = layoutLabel(empty ? e.ph! : text, area.w, area.h, empty ? Math.min(e.size ?? 18, 18) : e.size, bold);
  const total = lines.length * size * LINE_H, va = e.va ?? "m", al = e.al ?? "c";
  const top = va === "t" ? area.y : va === "b" ? area.y + area.h - total : area.y + (area.h - total) / 2;
  ctx.save();
  ctx.font = `${empty ? "italic 500" : bold ? 700 : 500} ${size}px ${P.font}`;
  ctx.fillStyle = empty ? P.label : labelInk(e, P); if (empty) ctx.globalAlpha = 0.6;
  ctx.textBaseline = "top"; ctx.textAlign = al === "l" ? "left" : al === "r" ? "right" : "center";
  const px = al === "l" ? area.x : al === "r" ? area.x + area.w : area.x + area.w / 2;
  lines.forEach((l, i) => ctx.fillText(l, px, top + 1 + i * size * LINE_H));
  ctx.restore();
}

// ── text / sticky ───────────────────────────────────────────────────────────
function drawText(ctx: CanvasRenderingContext2D, e: El, P: Paper) {
  const size = e.size ?? 28;
  ctx.save();
  ctx.font = `${e.bold ? 700 : 500} ${size}px ${P.font}`; ctx.fillStyle = e.c ?? P.ink; ctx.textBaseline = "top"; ctx.textAlign = "left";
  (e.text ?? "").split("\n").forEach((l, i) => ctx.fillText(l, e.x ?? 0, (e.y ?? 0) + 2 + i * size * LINE_H));
  ctx.restore();
}
export function wrapLines(text: string, maxW: number, size: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (line && measureText(test.trimEnd(), size, bold) > maxW) { out.push(line.trimEnd()); line = word.trimStart(); } else line = test;
    }
    out.push(line.trimEnd());
  }
  return out;
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawSticky(ctx: CanvasRenderingContext2D, e: El, P: Paper, hideText = false) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 200, h = e.h ?? 160, size = e.size ?? 22;
  ctx.save();
  ctx.shadowColor = "rgba(20,30,60,.22)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = e.c ?? "#fff3b0"; rrect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#1b1f2a"; ctx.textBaseline = "top";
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (!hideText) {
    // the words shrink until they fit the note (a long word no longer runs off it, and the note is never silently cut)
    const lay = layoutLabel(e.text ?? "", w - 22, h - 16, size, true);
    ctx.font = `600 ${lay.size}px ${P.font}`;
    lay.lines.forEach((l, i) => ctx.fillText(l, x + 11, y + 10 + i * lay.size * LINE_H));
  }
  ctx.restore();
}

// ── images ──────────────────────────────────────────────────────────────────
function drawImage(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 200, h = e.h ?? 150;
  const rec = env.images.get(e.id, e.url);
  if (rec.state === "ok" && rec.img) { ctx.drawImage(rec.img, x, y, w, h); return; }
  ctx.save();
  ctx.fillStyle = env.paper.brandSoft; ctx.strokeStyle = env.paper.grid; ctx.lineWidth = 1.5 / env.k;
  rrect(ctx, x, y, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = env.paper.label; ctx.font = `600 14px ${env.paper.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(rec.state === "bad" ? "Picture unavailable" : "Loading picture…", x + w / 2, y + h / 2);
  ctx.restore();
}

// ── teaching stamps ─────────────────────────────────────────────────────────
const num = (e: El, k: string, d: number) => { const v = e.opts?.[k]; return typeof v === "number" ? v : d; };

function stampCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, env: Env) {
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = env.paper.gridStrong; ctx.lineWidth = 1.4 / env.k;
  rrect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
}

function drawStamp(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const P = env.paper;
  const def = e.stamp ? stampDef(e.stamp) : null;
  if (!def) return;
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? def.w, h = e.h ?? def.h;
  ctx.save();
  if (e.rot) { const rc = rotCentre({ ...e, x, y, w, h }); ctx.translate(rc.x, rc.y); ctx.rotate(rad(e.rot)); ctx.translate(-rc.x, -rc.y); }
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const c = e.c ?? P.ink;
  switch (e.stamp) {
    case "numberline": {
      let min = num(e, "min", 0), max = num(e, "max", 10);
      if (max < min) [min, max] = [max, min];
      if (max === min) max = min + 1;
      const step = Math.max((max - min) / 400, num(e, "step", 1), 1e-6); // never more than ~400 ticks
      // ticks sit at min, min+step, … and the line ENDS at max even when max is not a whole number of steps from min (0 to 10 by 4: 0, 4, 8 … 10)
      const count = Math.floor((max - min) / step + 1e-9);
      const pad = 26, cy = y + h * 0.4, span = w - pad * 2, at = (v: number) => x + pad + (span * (v - min)) / (max - min);
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy);
      ctx.moveTo(x + w, cy); ctx.lineTo(x + w - 12, cy - 7); ctx.moveTo(x + w, cy); ctx.lineTo(x + w - 12, cy + 7);
      ctx.moveTo(x, cy); ctx.lineTo(x + 12, cy - 7); ctx.moveTo(x, cy); ctx.lineTo(x + 12, cy + 7);
      for (let i = 0; i <= count; i++) { const tx = at(min + i * step); ctx.moveTo(tx, cy - 11); ctx.lineTo(tx, cy + 11); }
      const rem = max - (min + count * step), showMax = rem > step * 0.2;
      if (showMax) { ctx.moveTo(at(max), cy - 11); ctx.lineTo(at(max), cy + 11); }
      ctx.stroke();
      ctx.fillStyle = c; ctx.font = `700 ${count > 24 ? 12 : 20}px ${P.font}`;
      const every = count > 40 ? 5 : count > 24 ? 2 : 1, fmtN = (v: number) => String(Math.round(v * 1000) / 1000);
      for (let i = 0; i <= count; i += every) ctx.fillText(fmtN(min + i * step), at(min + i * step), cy + 30);
      const lastLabelled = min + Math.floor(count / every) * every * step;
      if (showMax && at(max) - at(lastLabelled) > 46) ctx.fillText(fmtN(max), at(max), cy + 30);
      break;
    }
    case "fractions": {
      const parts = Math.max(1, Math.min(12, Math.round(num(e, "parts", 4)))), mask = num(e, "mask", 0);
      const bh = h - 22, cw = w / parts;
      let shaded = 0;
      for (let i = 0; i < parts; i++) {
        const on = (mask >> i) & 1; if (on) shaded++;
        ctx.fillStyle = on ? P.brand : "#ffffff"; ctx.globalAlpha = on ? 0.55 : 0.92; ctx.fillRect(x + i * cw, y, cw, bh); ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = P.axis; ctx.lineWidth = 2.2; ctx.strokeRect(x, y, w, bh);
      ctx.beginPath(); for (let i = 1; i < parts; i++) { ctx.moveTo(x + i * cw, y); ctx.lineTo(x + i * cw, y + bh); } ctx.stroke();
      ctx.fillStyle = P.ink; ctx.font = `800 ${parts > 8 ? 13 : 16}px ${P.font}`;
      ctx.fillText(shaded ? `${shaded}/${parts}` : `1/${parts} each`, x + w / 2, y + bh + 12);
      break;
    }
    case "coordgrid": {
      const n = Math.max(2, Math.min(20, Math.round(num(e, "n", 10)))), s = w / (2 * n), cx = x + w / 2, cy = y + h / 2;
      stampCard(ctx, x - 22, y - 22, w + 44, h + 44, env);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = -n; i <= n; i++) { ctx.moveTo(cx + i * s, y); ctx.lineTo(cx + i * s, y + h); ctx.moveTo(x, cy + i * s); ctx.lineTo(x + w, cy + i * s); }
      ctx.stroke();
      ctx.strokeStyle = P.axis; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();
      // arrow heads, the letters x and y, the origin 0, and labels on whole multiples (so 0-centred ranges like ±15 still label 5, 10, 15)
      ctx.strokeStyle = P.axis; ctx.lineWidth = 2.2; ctx.beginPath();
      ctx.moveTo(x + w, cy); ctx.lineTo(x + w - 10, cy - 5); ctx.moveTo(x + w, cy); ctx.lineTo(x + w - 10, cy + 5); ctx.moveTo(cx, y); ctx.lineTo(cx - 5, y + 10); ctx.moveTo(cx, y); ctx.lineTo(cx + 5, y + 10);
      ctx.stroke();
      ctx.fillStyle = P.label; ctx.font = `600 ${n > 10 ? 9 : 11}px ${P.font}`;
      const every = n > 10 ? (n > 15 ? 5 : 2) : 1;
      for (let i = -n; i <= n; i++) if (i && i % every === 0) { ctx.fillText(String(i), cx + i * s, cy + 11); ctx.fillText(String(-i), cx - 11, cy + i * s); }
      ctx.fillText("0", cx - 9, cy + 11);
      ctx.font = `italic 700 14px ${P.font}`; ctx.fillStyle = P.axis; ctx.fillText("x", x + w - 4, cy - 12); ctx.fillText("y", cx + 12, y + 6);
      break;
    }
    case "timestable": {
      const n = Math.max(2, Math.min(12, Math.round(num(e, "n", 10)))), cell = w / (n + 1);
      stampCard(ctx, x - 8, y - 8, w + 16, h + 16, env);
      for (let r = 0; r <= n; r++) for (let q = 0; q <= n; q++) {
        const px = x + q * cell, py = y + r * cell;
        if (r === 0 || q === 0) { ctx.fillStyle = P.brand; ctx.globalAlpha = r === 0 && q === 0 ? 0.9 : 0.16; ctx.fillRect(px, py, cell, cell); ctx.globalAlpha = 1; }
        ctx.fillStyle = r === 0 && q === 0 ? "#fff" : P.ink; ctx.font = `${r === 0 || q === 0 ? 800 : 500} ${Math.max(9, cell * 0.42)}px ${P.font}`;
        const label = r === 0 && q === 0 ? "×" : r === 0 ? String(q) : q === 0 ? String(r) : String(r * q);
        ctx.fillText(label, px + cell / 2, py + cell / 2);
      }
      ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= n + 1; i++) { ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + h); ctx.moveTo(x, y + i * cell); ctx.lineTo(x + w, y + i * cell); }
      ctx.stroke();
      break;
    }
    case "clock": {
      const r = Math.min(w, h) / 2 - 4, cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = P.axis; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, l = i % 5 ? 5 : 11; ctx.moveTo(cx + Math.sin(a) * (r - 6), cy - Math.cos(a) * (r - 6)); ctx.lineTo(cx + Math.sin(a) * (r - 6 - l), cy - Math.cos(a) * (r - 6 - l)); }
      ctx.stroke();
      ctx.fillStyle = P.ink; ctx.font = `800 ${r * 0.17}px ${P.font}`;
      for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillText(String(i), cx + Math.sin(a) * r * 0.74, cy - Math.cos(a) * r * 0.74); }
      const hh = num(e, "hh", 3) % 12, mm = num(e, "mm", 0) % 60;
      const hand = (ang: number, len: number, wd: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke(); };
      hand(((hh + mm / 60) / 12) * Math.PI * 2, r * 0.5, 6, P.ink);
      hand((mm / 60) * Math.PI * 2, r * 0.75, 4, P.brand);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "ruler": {
      ctx.fillStyle = "rgba(252,236,170,.88)"; ctx.strokeStyle = "#c9a93a"; ctx.lineWidth = 1.4; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.stroke();
      const cm = 40, cmN = Math.floor((w - 16) / cm);
      ctx.strokeStyle = "#5a4a12"; ctx.fillStyle = "#5a4a12"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let mmI = 0; mmI <= cmN * 10; mmI++) { const tx = x + 8 + mmI * (cm / 10), l = mmI % 10 === 0 ? 22 : mmI % 5 === 0 ? 15 : 9; ctx.moveTo(tx, y); ctx.lineTo(tx, y + l); }
      ctx.stroke();
      ctx.font = `700 13px ${P.font}`; ctx.textBaseline = "alphabetic";
      for (let i = 0; i <= cmN; i++) ctx.fillText(String(i), x + 8 + i * cm, y + 40);
      ctx.textAlign = "right"; ctx.fillText("cm", x + w - 8, y + h - 9);
      break;
    }
    case "protractor": {
      const r = w / 2 - 6, cx = x + w / 2, cy = y + h - 8;
      ctx.fillStyle = "rgba(200,225,250,.55)"; ctx.strokeStyle = "#3f78b8"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "#1f4f88"; ctx.lineWidth = 1; ctx.beginPath();
      for (let d = 0; d <= 180; d++) {
        const a = Math.PI - (d * Math.PI) / 180, l = d % 10 === 0 ? 17 : d % 5 === 0 ? 12 : 7;
        ctx.moveTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r - l), cy - Math.sin(a) * (r - l));
      }
      ctx.moveTo(x + 4, cy); ctx.lineTo(x + w - 4, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      ctx.fillStyle = "#1f4f88"; ctx.font = `700 11px ${P.font}`;
      for (let d = 10; d <= 170; d += 10) { const a = Math.PI - (d * Math.PI) / 180; ctx.fillText(String(d), cx + Math.cos(a) * (r - 29), cy - Math.sin(a) * (r - 29)); }
      break;
    }
  }
  ctx.restore();
}

// ── one element ─────────────────────────────────────────────────────────────
export function drawElement(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  switch (e.k) {
    case "stroke": drawStroke(ctx, e); break;
    case "shape": drawShape(ctx, e, env); break;
    case "text": if (env.editing !== e.id) drawText(ctx, e, env.paper); break;
    case "sticky": drawSticky(ctx, e, env.paper, env.editing === e.id); break;
    case "image": drawImage(ctx, e, env); break;
    case "stamp": if (!drawExtraStamp(ctx, e, env)) drawStamp(ctx, e, env); break;
  }
}

export function drawPage(ctx: CanvasRenderingContext2D, page: Page, view: View, w: number, h: number, dpr: number, env: Env) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = env.paper.paper; ctx.fillRect(0, 0, w * dpr, h * dpr);
  ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
  const vw = visibleWorld(view, w, h);
  drawBackground(ctx, page.bg, vw, env);
  const pad = 40;
  for (const e of sorted(page)) {
    const b = boundsOf(e);
    if (b.x > vw.x + vw.w + pad || b.y > vw.y + vw.h + pad || b.x + b.w < vw.x - pad || b.y + b.h < vw.y - pad) continue;
    drawElement(ctx, e, env);
  }
}

// ── overlays ────────────────────────────────────────────────────────────────
/** The box round a set of elements (the padded dashed rectangle shown for a template / multi-selection). */
export function groupBox(els: El[], pad = 6): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) { const b = boundsOf(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}
export type Corner = "nw" | "ne" | "se" | "sw";
/** Scale handles at the four corners of a whole selection (a template, or several things). */
export function groupHandles(els: El[]): { kind: Corner; x: number; y: number }[] {
  const b = groupBox(els);
  return [{ kind: "nw", x: b.x, y: b.y }, { kind: "ne", x: b.x + b.w, y: b.y }, { kind: "se", x: b.x + b.w, y: b.y + b.h }, { kind: "sw", x: b.x, y: b.y + b.h }];
}

export function drawSelection(ctx: CanvasRenderingContext2D, els: El[], env: Env, opts: { single: boolean; multiHandles?: boolean }) {
  const { k, paper: P } = env;
  ctx.save();
  ctx.lineWidth = 1.6 / k; ctx.strokeStyle = P.brand; ctx.setLineDash([6 / k, 4 / k]);
  // a template (a group) is selected as ONE box, not a dashed box around every line and word
  const grp = els.length > 1 && els.every((e) => e.grp && e.grp === els[0]!.grp);
  if (grp || (els.length > 1 && opts.multiHandles)) {
    const gb = groupBox(els);
    ctx.strokeRect(gb.x, gb.y, gb.w, gb.h);
  }
  for (const e of grp ? [] : els) {
    const b = boundsOf(e);
    if (e.k === "stamp" && e.rot) {
      const rc = rotCentre(e);
      ctx.save(); ctx.translate(rc.x, rc.y); ctx.rotate(rad(e.rot)); ctx.strokeRect((e.x ?? 0) - rc.x - 4, (e.y ?? 0) - rc.y - 4, (e.w ?? 0) + 8, (e.h ?? 0) + 8); ctx.restore();
    } else if (e.lock) { ctx.setLineDash([2 / k, 3 / k]); ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.setLineDash([6 / k, 4 / k]); }
    else ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  }
  ctx.setLineDash([]);
  const dot = (x: number, y: number, rotate = false) => {
    ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.strokeStyle = P.brand; ctx.lineWidth = 2 / k;
    ctx.arc(x, y, 7 / k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (rotate) { ctx.beginPath(); ctx.arc(x, y, 2.5 / k, 0, Math.PI * 2); ctx.fillStyle = P.brand; ctx.fill(); }
  };
  if (opts.single && els[0] && !els[0].lock) for (const hd of handlesOf(els[0])) dot(hd.x, hd.y, hd.kind === "rotate");
  else if (opts.multiHandles && els.length > 1) for (const hd of groupHandles(els)) dot(hd.x, hd.y);
  ctx.restore();
}

export type HandleKind = "p1" | "p2" | "resize" | "rotate" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export interface Handle { kind: HandleKind; x: number; y: number }
export function handlesOf(e: El): Handle[] {
  if (e.k === "shape") {
    if (isLineShape(e.shape)) return [{ kind: "p1", x: e.x1 ?? 0, y: e.y1 ?? 0 }, { kind: "p2", x: e.x2 ?? 0, y: e.y2 ?? 0 }];
    const l = Math.min(e.x1 ?? 0, e.x2 ?? 0), r = Math.max(e.x1 ?? 0, e.x2 ?? 0), t = Math.min(e.y1 ?? 0, e.y2 ?? 0), b = Math.max(e.y1 ?? 0, e.y2 ?? 0), mx = (l + r) / 2, my = (t + b) / 2;
    // corners first (they win when a small shape's handles overlap), then the edge middles
    return [{ kind: "se", x: r, y: b }, { kind: "nw", x: l, y: t }, { kind: "ne", x: r, y: t }, { kind: "sw", x: l, y: b }, { kind: "e", x: r, y: my }, { kind: "s", x: mx, y: b }, { kind: "w", x: l, y: my }, { kind: "n", x: mx, y: t }];
  }
  if (e.k === "image" || e.k === "sticky" || e.k === "stamp") {
    const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 0, h = e.h ?? 0, rc = rotCentre(e), cx = rc.x, cy = rc.y, a = rad(e.rot ?? 0);
    const rp = (px: number, py: number) => ({ x: cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), y: cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a) });
    const out: Handle[] = [{ kind: "resize", ...rp(x + w + 4, y + h + 4) }];
    if (e.k === "stamp" && e.stamp && stampDef(e.stamp).rotates) out.push({ kind: "rotate", ...rp(x + w / 2, y - 26) });
    return out;
  }
  return [];
}

export interface Cursor { x: number; y: number; name: string; colour: string; laser: boolean; at: number; trail: { x: number; y: number; at: number }[] }
export const LASER_MS = 1300;
export function drawCursors(ctx: CanvasRenderingContext2D, cursors: Cursor[], env: Env, now: number) {
  const { k, paper: P } = env;
  ctx.save();
  for (const c of cursors) {
    // laser trail: fades over LASER_MS
    if (c.trail.length) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 1; i < c.trail.length; i++) {
        const a = c.trail[i - 1]!, b = c.trail[i]!;
        const age = (now - b.at) / LASER_MS; if (age >= 1) continue;
        if (b.at - a.at > 220) continue;
        ctx.globalAlpha = Math.max(0, 0.9 * (1 - age)); ctx.strokeStyle = c.colour; ctx.lineWidth = (10 * (1 - age * 0.6)) / k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    const idle = now - c.at;
    if (idle > 4000) continue;
    ctx.globalAlpha = idle > 3000 ? 1 - (idle - 3000) / 1000 : 1;
    if (c.laser) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 16 / k);
      g.addColorStop(0, c.colour); g.addColorStop(0.35, c.colour); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 16 / k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(c.x, c.y, 3 / k, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = c.colour; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6 / k;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + 4 / k, c.y + 17 / k); ctx.lineTo(c.x + 9 / k, c.y + 12 / k); ctx.lineTo(c.x + 16 / k, c.y + 12 / k); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (c.name) {
      ctx.font = `700 ${12 / k}px ${P.font}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      const tw = ctx.measureText(c.name).width, px = 6 / k, ph = 20 / k, tx = c.x + 14 / k, ty = c.y + 22 / k;
      ctx.fillStyle = c.colour; rrect(ctx, tx, ty, tw + px * 2, ph, ph / 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(c.name, tx + px, ty + ph / 2 + 0.5 / k);
    }
  }
  ctx.restore();
}

/** A little name tag on a student's element (shown while it is fresh). */
export function drawTag(ctx: CanvasRenderingContext2D, e: El, colour: string, env: Env) {
  const b = boundsOf(e), k = env.k;
  const name = e.by ?? ""; if (!name) return;
  ctx.save();
  ctx.font = `700 ${12 / k}px ${env.paper.font}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const tw = ctx.measureText(name).width, px = 6 / k, ph = 19 / k, tx = b.x, ty = b.y - ph - 3 / k;
  ctx.fillStyle = colour; rrect(ctx, tx, ty, tw + px * 2, ph, ph / 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(name, tx + px, ty + ph / 2 + 0.5 / k);
  ctx.restore();
}

/** The world rectangle that holds everything on a page (with margin), or a default. */
export function contentBounds(page: Page, margin = 40): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of page.els.values()) { const b = boundsOf(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const bgBox: Partial<Record<BgKind, Rect>> = { graph: { x: -470, y: -470, w: 940, h: 940 }, numberline: { x: -640, y: -60, w: 1280, h: 130 }, ...FRAME_BOX };
  const bb = bgBox[page.bg];
  if (bb) { x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y); x1 = Math.max(x1, bb.x + bb.w); y1 = Math.max(y1, bb.y + bb.h); }
  if (!Number.isFinite(x0)) return { x: -600, y: -380, w: 1200, h: 760 };
  return { x: x0 - margin, y: y0 - margin, w: Math.max(200, x1 - x0 + margin * 2), h: Math.max(140, y1 - y0 + margin * 2) };
}
