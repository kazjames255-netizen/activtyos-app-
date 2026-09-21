import type { Peer } from "./sync";
import { B, place, type Level, type ToolItem, type Vals } from "./toolkit/kit";
import type { WbMessage } from "./callObject";
import {
  DEFAULT_PALETTE, ERASER_SIZES, MAX_TEXT_CHARS, mayWrite, HL_SIZES, PEN_SIZES, PT, STICKY_COLOURS, TEXT_SIZES, bindTarget, boundsOf, canHoldText, fromSaved, isConnector, routeConnectors, hitTest, insideShape, isClosedShape, isLineShape, isPolyShape, type PenStyle, inRect, isStudentKey, movePatch, newId, newState, nextV, reserveV, pageOf, rotCentre, round1, scalePatch, shapeTextArea, sorted,
  stampDef, textBox, toSaved, topZ, type BgKind, type BoardState, type El, type Op, type Rect, type SavedPage, type Sender, type ShapeKind, type StampKind,
} from "./model";
import { History, SLICE_PTS, actionOps, applyAll, elementOps, nullify, type Action } from "./reducer";
import { periodicHit, spinnerItems, timerRunning, widgetAnimating } from "./render-stamps";
import { DEFAULT_PAPER, ImageCache, LASER_MS, contentBounds, drawCursors, drawElement, drawPage, drawSelection, drawTag, groupBox, groupHandles, handlesOf, installMeasurer, layoutLabel, visibleWorld, type Corner, type Cursor, type HandleKind, type Paper, type View } from "./render";

// The whiteboard's brain: owns the board state, the view, the tool settings and
// the pointer gestures, turns them into ops, applies them locally through the
// permission-checking reducer and sends them over the call. The React layer only
// renders its snapshot (subscribe/version) and forwards raw pointer events.

export type Tool = "select" | "pen" | "highlighter" | "eraser" | "text" | "sticky" | "laser" | "pan" | ShapeKind;
export interface UiState {
  tool: Tool; colour: string; penSize: number; hlSize: number; eraserSize: number; textSize: number; bold: boolean; fill: boolean; stickyColour: string; penStyle: PenStyle; dashed: boolean;
  /** Eraser: rub out only drawings (default) or absolutely everything (pictures, aids, templates too). */
  eraserAll: boolean;
  /** Fill colour for new shapes (null = same as the line). */
  fillColour: string | null;
  /** Solid fill (true) or the light wash (false). */
  fillSolid: boolean;
  /** New shapes have no outline. */
  noLine: boolean;
  /** Sides for the regular polygon tool. */
  sides: number;
  /** Snap drawing / moving / resizing to the page's grid. */
  snap: boolean;
}
/** What the typing box is editing. A "shape" draft carries the label area and alignment (the text sits inside a shape / cell). */
export interface EditDraft {
  id: string | null; kind: "text" | "sticky" | "shape"; x: number; y: number; w: number; h: number; text: string; size: number; bold: boolean; c: string;
  /** shape labels: the size cap (undefined = auto-fit), alignment and the placeholder. */
  auto?: boolean; al?: "l" | "c" | "r"; va?: "t" | "m" | "b"; ph?: string;
}
export interface Ptr { id: number; type: string; x: number; y: number; pressure: number; shift: boolean; button: number; buttons: number; t: number; alt?: boolean }

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const K_MIN = 0.15, K_MAX = 6;
/** Is this tool one of the shape tools (line, arrow, rectangle, star…)? */
export const isShapeTool = (t: Tool): t is ShapeKind => t === "line" || t === "arrow" || t === "darrow" || t === "rect" || t === "ellipse" || t === "triangle" || isPolyShape(t as ShapeKind);
/** Stamps the tutor operates with a click (fraction bar, periodic table, and the classroom widgets). */
const CLICKABLE_STAMPS = ["fractions", "periodic", "dice", "spinner", "tally"];

/** A steady per-name colour for a student (so everyone is recognisable). */
export function personColour(name: string): string {
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = DEFAULT_PALETTE.slice(2); // not ink, not the tutor's marking red
  return pool[h % pool.length]!;
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "stroke"; id: string; page: string; sent: number; last: { x: number; y: number }; timer: ReturnType<typeof setTimeout> | null; straight: boolean; first: { x: number; y: number; p: number }; snap: boolean }
  | { kind: "shape"; id: string; page: string; shape: ShapeKind; x: number; y: number }
  | { kind: "erase"; page: string; removed: El[] }
  | { kind: "move"; page: string; sx: number; sy: number; orig: Map<string, El>; moved: boolean; clickedFrac: { id: string; x: number; y: number } | null; narrow: string | null; pending: Map<string, Op>; sentAt: number }
  | { kind: "handle"; page: string; id: string; handle: HandleKind; orig: El }
  | { kind: "gscale"; page: string; corner: Corner; box: Rect; orig: Map<string, El>; pending: Map<string, Op>; sentAt: number }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; add: boolean }
  | { kind: "laser" };

/** Where a controller's local ops are sent. */
export interface Outbox {
  queue(...ops: Op[]): void;
  setPtr(p: NonNullable<WbMessage["ptr"]>): void;
  go(page: string): void;
  present(on: boolean): void;
}
export interface ControllerOpts {
  self: Sender & { name: string }; isTutor: boolean; readOnlyBoard: boolean;
  /** Work on a state that lives elsewhere (a student's private pad). */
  state?: BoardState;
  /** A private scratch pad: one page, always writable by its owner and the tutor. */
  padMode?: boolean;
}

export class BoardController {
  state: BoardState = newState();
  page = "p1";
  view: View = { x: 0, y: 0, k: 1 };
  size = { w: 900, h: 600, dpr: 1 };
  ui: UiState = { tool: "pen", colour: DEFAULT_PALETTE[0]!, penSize: PEN_SIZES[1]!, hlSize: HL_SIZES[1]!, eraserSize: ERASER_SIZES[1]!, textSize: TEXT_SIZES[1]!, bold: false, fill: false, stickyColour: STICKY_COLOURS[0]!, penStyle: "solid", dashed: false, eraserAll: false, fillColour: null, fillSolid: false, noLine: false, sides: 5, snap: false };
  selection = new Set<string>();
  /** Key-stage style: Early (KS1–2) · Standard (KS3) · Advanced (KS4–5) — presets, not a different app. */
  level: Level = "standard";
  /** The shape tool used last (the rail's shapes button shows it). */
  lastShape: ShapeKind = "rect";
  editing: EditDraft | null = null;
  history = new History();
  cursors = new Map<string, Cursor>();
  me: Cursor = { x: 0, y: 0, name: "", colour: DEFAULT_PALETTE[1]!, laser: false, at: 0, trail: [] };
  hover: { x: number; y: number } | null = null;
  marquee: Rect | null = null;
  paper: Paper = DEFAULT_PAPER;
  palette: string[] = DEFAULT_PALETTE;
  images: ImageCache;
  /** Where local ops go (the call, or a private channel to the tutor / a student). */
  out: Outbox | null = null;
  /** Bumps on every UI-visible change (React re-renders on it). */
  version = 0;
  /** Bumps on every persistent board change (the autosave watches it). */
  saveVersion = 0;
  /** Set once the saved copy has been loaded (autosave must never overwrite a board it hasn't read). */
  loaded = false;
  toast: string | null = null;
  peerCount = 0;
  private listeners = new Set<() => void>();
  private g: Gesture | null = null;
  private dirty = true;
  private raf = 0;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { d0: number; k0: number; wx: number; wy: number } | null = null;
  private lastPenAt = -1e9;
  private spaceDown = false;
  private lastClick = { t: 0, x: 0, y: 0 };
  private touched = new Map<string, number>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private vwFit = false;
  private ptrSentAt = 0;

  constructor(public opts: ControllerOpts) {
    this.images = new ImageCache(() => this.invalidate());
    this.me.name = opts.self.name;
    if (opts.state) { this.state = opts.state; this.page = opts.state.pages[0]!.id; }
    if (opts.padMode) this.loaded = true;
    if (!opts.isTutor) { this.ui.colour = personColour(opts.self.name); this.ui.tool = opts.padMode ? "pen" : "pan"; }
    this.me.colour = opts.isTutor ? DEFAULT_PAPER.danger : personColour(opts.self.name);
  }

  // ── plumbing ───────────────────────────────────────────────────────────────
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  notify() { this.version++; this.listeners.forEach((f) => f()); this.invalidate(); }
  invalidate() { this.dirty = true; }
  get self(): Sender { return this.opts.self; }
  get isTutor() { return this.opts.isTutor; }
  /** May this person draw / edit right now? */
  get canDraw() { return this.opts.padMode ? true : !this.opts.readOnlyBoard && mayWrite(this.state.perm, this.self); }
  get curPage() { return pageOf(this.state, this.page) ?? this.state.pages[0]!; }
  say(msg: string) { this.toast = msg; this.notify(); if (this.toastTimer) clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { this.toast = null; this.notify(); }, 2600); }

  setPaper(p: Paper, palette?: string[]) {
    this.paper = p; installMeasurer(p.font);
    if (palette) { this.palette = palette; if (this.isTutor) this.ui = { ...this.ui, colour: palette[0]! }; }
    this.invalidate();
  }
  setSize(w: number, h: number, dpr: number) {
    const first = !this.vwFit;
    const old = this.size;
    this.size = { w, h, dpr };
    if (first) { this.resetView(); this.vwFit = true; }
    else { this.view = { ...this.view, x: this.view.x + (w - old.w) / 2, y: this.view.y + (h - old.h) / 2 }; }
    this.invalidate();
  }

  // ── view ──────────────────────────────────────────────────────────────────
  toWorld(sx: number, sy: number) { return { x: (sx - this.view.x) / this.view.k, y: (sy - this.view.y) / this.view.k }; }
  /** The part of the surface not covered by the floating tool rail / top bar / options bar. */
  private free() {
    const { w, h } = this.size, wide = w >= 620;
    const l = wide ? (h >= 560 ? 76 : 116) : 8, t = 68, r = 8, b = wide ? 64 : 8;
    return { x: l, y: t, w: Math.max(200, w - l - r), h: Math.max(160, h - t - b) };
  }
  resetView() {
    const f = this.free();
    const k = clamp(Math.min(f.w / 1240, f.h / 800), 0.3, 1.3);
    this.view = { k, x: f.x + f.w / 2, y: f.y + f.h / 2 };
    this.notify();
  }
  fitContent() {
    const b = contentBounds(this.curPage), f = this.free();
    const k = clamp(Math.min(f.w / b.w, f.h / b.h), K_MIN, 1.6);
    this.view = { k, x: f.x + f.w / 2 - (b.x + b.w / 2) * k, y: f.y + f.h / 2 - (b.y + b.h / 2) * k };
    this.notify();
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const k = clamp(this.view.k * factor, K_MIN, K_MAX);
    const wx = (sx - this.view.x) / this.view.k, wy = (sy - this.view.y) / this.view.k;
    this.view = { k, x: sx - wx * k, y: sy - wy * k };
    this.notify();
  }
  zoomBy(f: number) { this.zoomAt(this.size.w / 2, this.size.h / 2, f); }
  panBy(dx: number, dy: number) { this.view = { ...this.view, x: this.view.x + dx, y: this.view.y + dy }; this.invalidate(); }
  wheel(sx: number, sy: number, dx: number, dy: number, deltaMode: number, ctrl: boolean) {
    const mouseWheel = deltaMode === 1 || (dx === 0 && Math.abs(dy) >= 100 && Number.isInteger(dy));
    if (ctrl || mouseWheel) this.zoomAt(sx, sy, Math.exp(-(deltaMode === 1 ? dy * 30 : dy) * (ctrl ? 0.01 : 0.0015)));
    else { this.panBy(-dx, -dy); this.notify(); }
  }

  // ── committing ops ─────────────────────────────────────────────────────────
  /**
   * Send ops to peers. Two wire fixes live here: a patch that CLEARS a field travels as `null` (JSON drops `undefined`, so an undo would
   * otherwise leave the field set on everyone else's board), and a rewrite of `pts` too long for one message (moving a long stroke) goes as
   * delete + re-add in slices instead of one oversized `upd` the call channel would silently drop.
   */
  private emit(...ops: Op[]) {
    if (!this.out) return;
    const out: Op[] = [];
    for (const op of ops) {
      if (op.op !== "upd") { out.push(op); continue; }
      const patch = nullify(op.patch);
      if (patch.pts && patch.pts.length / PT > SLICE_PTS) {
        const el = pageOf(this.state, op.page)?.els.get(op.id);
        if (el) {
          const v1 = nextV(), v2 = nextV(); el.v = v2;
          out.push({ op: "del", page: op.page, ids: [op.id], v: v1 }, ...elementOps(op.page, { ...el, pts: el.pts?.slice(), v: v2 }));
          continue;
        }
      }
      out.push({ ...op, patch });
    }
    this.out.queue(...out);
  }
  /** Apply ops as ME (permission-checked like anyone else's) and send them. Returns whether anything changed. */
  commit(ops: Op[], action?: Action): boolean {
    if (!this.canDraw) return false;
    const r = applyAll(this.state, ops, this.self);
    if (r.denied && !r.changed) return false;
    for (const op of ops) if (op.op === "add" || op.op === "upd") this.touched.set(op.op === "add" ? op.el.id : op.id, Date.now());
    this.emit(...ops);
    if (action) this.history.push(action);
    this.saveVersion++;
    this.notify();
    return true;
  }
  /** Tutor-only board ops that aren't drawing (pages, background, permission). */
  private tutorOp(ops: Op[], action?: Action) {
    if (!this.isTutor) return false;
    applyAll(this.state, ops, this.self);
    this.out?.queue(...ops);
    if (action) this.history.push(action);
    this.saveVersion++;
    this.notify();
    return true;
  }

  private mkEl(partial: Partial<El> & Pick<El, "k">): El {
    return { id: newId(), own: this.self.own, by: this.self.tutor ? undefined : this.self.by, cid: this.self.tutor ? undefined : this.self.cid, z: topZ(this.curPage), v: nextV(), ...partial } as El;
  }

  // ── pages / background / permission ────────────────────────────────────────
  setPage(id: string, broadcast = true) {
    if (!pageOf(this.state, id)) return;
    if (this.page !== id) { this.page = id; this.selection.clear(); this.cancelEdit(); this.cursors.clear(); }
    if (broadcast && this.isTutor) this.out?.go(id);
    this.notify();
  }
  addPage() {
    if (!this.isTutor) return;
    const id = "p" + newId().slice(0, 5);
    this.tutorOp([{ op: "padd", id, bg: this.curPage.bg }]);
    this.setPage(id);
  }
  deletePage(id = this.page) {
    if (!this.isTutor || this.state.pages.length <= 1) return;
    const i = this.state.pages.findIndex((p) => p.id === id);
    this.tutorOp([{ op: "pdel", id }]);
    const next = this.state.pages[Math.min(i, this.state.pages.length - 1)]!;
    this.setPage(next.id);
  }
  setBackground(bg: BgKind) {
    if (!this.isTutor) return;
    const before = this.curPage.bg;
    if (before === bg) return;
    this.tutorOp([{ op: "bg", page: this.page, bg, v: nextV() }], { t: "bg", page: this.page, before, after: bg });
    if (bg === "graph" || bg === "numberline") this.resetView();
  }
  clearPage() {
    if (!this.isTutor) return;
    const els = sorted(this.curPage).map((e) => ({ ...e }));
    if (!els.length) return;
    this.selection.clear();
    this.tutorOp([{ op: "clear", page: this.page, v: nextV() }], { t: "clear", page: this.page, els });
  }
  /** Who may write: everyone, or just these children (an empty list = the tutor only). */
  setPermission(all: boolean, ids: string[], note?: string) {
    if (!this.isTutor) return;
    this.tutorOp([{ op: "perm", all, ids }]);
    this.say(note ?? (all ? "Everyone can write now" : ids.length ? "Only the students you picked can write" : "You have the board to yourself again"));
  }

  // ── remote ────────────────────────────────────────────────────────────────
  onRemoteOps(ops: Op[], who: Sender): { gaps: { id: string; have: number }[] } {
    const couldDraw = this.canDraw;
    if (who.tutor && ops.some((o) => o.op === "reset")) this.loaded = true;
    const r = applyAll(this.state, ops, who);
    const now = Date.now();
    for (const op of ops) if ((op.op === "add" && who.tutor === false) || op.op === "pts" || op.op === "upd") this.touched.set(op.op === "add" ? op.el.id : op.id, now);
    if (r.changed) {
      if (this.isTutor) this.saveVersion++;
      if (!pageOf(this.state, this.page)) this.page = this.state.pages[0]!.id;
      this.selection.forEach((id) => { if (!this.curPage.els.has(id)) this.selection.delete(id); });
      if (this.editing?.id && !this.curPage.els.has(this.editing.id)) this.editing = null;
      if (!this.isTutor && !this.opts.padMode && couldDraw !== this.canDraw) {
        if (this.canDraw) { this.ui.tool = "pen"; this.say("You can write on the board now — go for it!"); }
        else { this.ui.tool = "pan"; this.cancelEdit(); this.say("Your tutor is drawing now"); }
      }
      this.notify();
    }
    return { gaps: r.gaps };
  }
  onRemotePtr(peer: Peer, p: NonNullable<WbMessage["ptr"]>) {
    if (p.page !== this.page) return;
    if (p.laser && !peer.tutor && !mayWrite(this.state.perm, { tutor: false, own: "", cid: peer.cid })) return;
    const now = Date.now();
    let c = this.cursors.get(peer.id);
    if (!c) { c = { x: p.x, y: p.y, name: peer.name, colour: p.col, laser: p.laser, at: now, trail: [] }; this.cursors.set(peer.id, c); }
    c.x = p.x; c.y = p.y; c.laser = p.laser; c.colour = p.col; c.at = now; c.name = peer.name;
    if (p.laser) { c.trail.push({ x: p.x, y: p.y, at: now }); if (c.trail.length > 60) c.trail.shift(); }
    this.invalidate();
  }
  onRemoteGo(page: string) { if (!this.isTutor) this.setPage(page, false); }

  /** Replace the whole board (the tutor's saved copy loaded from the server). */
  loadSaved(pages: SavedPage[] | undefined): number {
    const s = fromSaved(pages);
    // Anything drawn while the saved copy was still on its way must survive the load (and be saved with it).
    let kept = 0;
    if (!this.loaded) {
      for (const pg of this.state.pages) {
        const into = s.pages.find((x) => x.id === pg.id) ?? s.pages[0]!;
        for (const [id, e] of pg.els) if (!into.els.has(id)) { into.els.set(id, e); kept++; }
      }
      for (const [id, v] of Object.entries(this.state.dead)) if (!(id in s.dead)) s.dead[id] = v;
      s.perm = this.state.perm.all || this.state.perm.ids.length ? this.state.perm : s.perm;
    }
    if (kept) this.saveVersion++;
    this.state = s;
    this.page = s.pages[0]!.id;
    this.selection.clear();
    this.history.clear();
    this.loaded = true;
    this.notify();
    return kept;
  }
  /** Fresh signed links for images (a re-fetch of the saved board). */
  refreshUrls(pages: SavedPage[]) {
    for (const sp of pages) { const p = pageOf(this.state, sp.id); if (!p) continue; for (const e of sp.elements) if (e.k === "image" && e.url) { const cur = p.els.get(e.id); if (cur) cur.url = e.url; } }
    this.invalidate();
  }
  getSaved(): SavedPage[] { return toSaved(this.state); }

  // ── ephemeral pointer (laser / cursor) ─────────────────────────────────────
  private sendPtr(x: number, y: number, laser: boolean) {
    const now = Date.now();
    if (now - this.ptrSentAt < 45) return;
    this.ptrSentAt = now;
    this.out?.setPtr({ page: this.page, x: round1(x), y: round1(y), laser, col: this.me.colour });
  }

  // ── pointer gestures ───────────────────────────────────────────────────────
  private hitAt(x: number, y: number, tol: number): El | null {
    const els = sorted(this.curPage);
    for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i]!, x, y, tol)) return els[i]!;
    return null;
  }
  private mayEditEl(e: El) { return this.canDraw && (this.isTutor || e.own === this.self.own); }
  /** May this person move / resize / rub out / delete it? (Not while it is locked.) */
  private mayMove(e: El) { return this.mayEditEl(e) && !e.lock; }
  get selectedEls(): El[] { return [...this.selection].map((id) => this.curPage.els.get(id)).filter((e): e is El => !!e); }

  pointerDown(p: Ptr) {
    if (p.type === "touch" && p.t - this.lastPenAt < 700) return; // palm rejection while a pen is in use
    if (p.type === "pen") this.lastPenAt = p.t;
    if (p.type === "touch") {
      this.touches.set(p.id, { x: p.x, y: p.y });
      if (this.touches.size === 2) { this.abortGesture(); this.startPinch(); return; }
      if (this.touches.size > 2) return;
    }
    if (this.pinch) return;
    const w = this.toWorld(p.x, p.y);
    const tol = 6 / this.view.k;
    const panning = this.spaceDown || p.button === 1 || this.ui.tool === "pan" || (!this.canDraw && this.ui.tool !== "laser");
    if (panning) { this.g = { kind: "pan", sx: p.x, sy: p.y, vx: this.view.x, vy: this.view.y }; return; }
    const tool = this.ui.tool;

    if (this.editing) this.commitEdit();

    if (tool === "laser") { this.g = { kind: "laser" }; this.laserMove(w.x, w.y); return; }
    if (!this.canDraw) return;

    if (tool === "pen" || tool === "highlighter") {
      const hl = tool === "highlighter";
      const pr = p.type === "pen" ? clamp(Math.round(p.pressure * 100), 8, 100) : 50;
      const el = this.mkEl({ k: "stroke", c: this.ui.colour, w: hl ? this.ui.hlSize : this.ui.penSize, hl: hl || undefined, sty: !hl && this.ui.penStyle !== "solid" ? this.ui.penStyle : undefined, pts: [round1(w.x), round1(w.y), pr] });
      applyAll(this.state, [{ op: "add", page: this.page, el }], this.self);
      this.emit({ op: "add", page: this.page, el: { ...el, pts: [...el.pts!] } });
      this.g = { kind: "stroke", id: el.id, page: this.page, sent: 1, last: { x: w.x, y: w.y }, timer: null, straight: false, first: { x: w.x, y: w.y, p: pr }, snap: p.shift };
      this.armHold();
      this.saveVersion++; this.notify();
      return;
    }
    if (tool === "eraser") { this.g = { kind: "erase", page: this.page, removed: [] }; this.eraseAt(w.x, w.y); return; }
    if (isShapeTool(tool)) {
      const closed = isClosedShape(tool), filled = this.ui.fill && closed;
      const sp = this.snapPt(w.x, w.y);
      const el = this.mkEl({
        k: "shape", shape: tool, c: this.ui.colour, w: this.ui.penSize, dash: this.ui.dashed || undefined, fill: filled ? (this.ui.fillColour ?? this.ui.colour) : null,
        fa: filled && this.ui.fillSolid ? 1 : undefined, ns: closed && this.ui.noLine ? true : undefined, n: tool === "ngon" ? this.ui.sides : undefined,
        x1: round1(sp.x), y1: round1(sp.y), x2: round1(sp.x), y2: round1(sp.y),
      });
      applyAll(this.state, [{ op: "add", page: this.page, el }], this.self);
      this.emit({ op: "add", page: this.page, el });
      this.g = { kind: "shape", id: el.id, page: this.page, shape: tool, x: sp.x, y: sp.y };
      this.saveVersion++; this.notify();
      return;
    }
    if (tool === "text" || tool === "sticky") {
      const hit = this.hitAt(w.x, w.y, tol);
      if (hit && (hit.k === "text" || hit.k === "sticky") && this.mayEditEl(hit)) { this.beginEdit(hit); return; }
      if (tool === "text" && hit && canHoldText(hit) && this.mayEditEl(hit)) { this.beginEdit(hit); return; } // type INTO a shape / cell
      if (tool === "text") this.editing = { id: null, kind: "text", x: w.x, y: w.y, w: 0, h: 0, text: "", size: this.ui.textSize, bold: this.ui.bold, c: this.ui.colour };
      else this.editing = { id: null, kind: "sticky", x: w.x - 100, y: w.y - 80, w: 200, h: 160, text: "", size: 22, bold: true, c: this.ui.stickyColour };
      this.notify();
      return;
    }
    if (tool === "select") this.selectDown(p, w, tol);
  }

  /** The topmost closed shape whose INSIDE holds the point (even when it is unfilled) — double-click it to type in it. */
  private shapeAt(x: number, y: number): El | null {
    const els = sorted(this.curPage);
    for (let i = els.length - 1; i >= 0; i--) { const e = els[i]!; if (canHoldText(e) && insideShape(e, x, y)) return e; }
    return null;
  }

  private selectDown(p: Ptr, w: { x: number; y: number }, tol: number) {
    // a handle of the selection? (one element: its own handles · several / a template: scale handles at the corners)
    const sel = this.selectedEls;
    const r12 = 12 / this.view.k;
    if (sel.length === 1 && this.mayMove(sel[0]!)) {
      for (const hd of handlesOf(sel[0]!)) if (Math.hypot(hd.x - w.x, hd.y - w.y) <= r12) { this.g = { kind: "handle", page: this.page, id: sel[0]!.id, handle: hd.kind, orig: { ...sel[0]!, pts: sel[0]!.pts?.slice(), opts: sel[0]!.opts ? { ...sel[0]!.opts } : undefined } }; return; }
    } else if (sel.length > 1 && sel.every((e) => this.mayMove(e))) {
      for (const hd of groupHandles(sel)) if (Math.hypot(hd.x - w.x, hd.y - w.y) <= r12) {
        const orig = new Map<string, El>();
        for (const e of sel) orig.set(e.id, { ...e, pts: e.pts?.slice() });
        this.g = { kind: "gscale", page: this.page, corner: hd.kind, box: groupBox(sel, 0), orig, pending: new Map(), sentAt: 0 };
        return;
      }
    }
    const hit = this.hitAt(w.x, w.y, tol);
    const dbl = p.t - this.lastClick.t < 400 && Math.hypot(p.x - this.lastClick.x, p.y - this.lastClick.y) < 8;
    this.lastClick = { t: p.t, x: p.x, y: p.y };
    const editable = (e: El) => (e.k === "text" || e.k === "sticky" || canHoldText(e)) && this.mayEditEl(e);
    if (dbl) {
      // double-click types: text, a sticky, or INTO a shape / template cell (also when clicking inside an unfilled one)
      const target = hit && editable(hit) ? hit : (!hit || canHoldText(hit) ? this.shapeAt(w.x, w.y) : null);
      if (target && editable(target)) { this.selection = new Set([target.id]); this.beginEdit(target); this.notify(); return; }
    }
    if (hit) {
      const family = hit.grp ? [...this.curPage.els.values()].filter((e) => e.grp === hit.grp).map((e) => e.id) : [hit.id];
      let narrow: string | null = null;
      if (p.alt) { // Alt-click reaches ONE member of a template
        if (p.shift) { if (this.selection.has(hit.id)) this.selection.delete(hit.id); else this.selection.add(hit.id); }
        else if (!this.selection.has(hit.id) || this.selection.size > 1) { this.selection.clear(); this.selection.add(hit.id); }
      } else if (p.shift) { if (this.selection.has(hit.id)) family.forEach((i) => this.selection.delete(i)); else family.forEach((i) => this.selection.add(i)); }
      else if (!this.selection.has(hit.id)) {
        // already working INSIDE this template (some of its parts selected)? then pick just this part; otherwise the whole template
        const inside = hit.grp && this.selection.size > 0 && this.selection.size < family.length && this.selectedEls.every((e) => e.grp === hit.grp);
        this.selection.clear(); (inside ? [hit.id] : family).forEach((i) => this.selection.add(i));
      }
      else if (hit.grp && this.selection.size > 1) narrow = hit.id; // a second click on a member of the selected template: on release, pick just that member
      const orig = new Map<string, El>();
      for (const e of this.selectedEls) if (this.mayMove(e)) orig.set(e.id, { ...e, pts: e.pts?.slice() });
      const frac = hit.k === "stamp" && CLICKABLE_STAMPS.includes(hit.stamp ?? "") && this.mayEditEl(hit) ? { id: hit.id, x: w.x, y: w.y } : null;
      this.g = { kind: "move", page: this.page, sx: w.x, sy: w.y, orig, moved: false, clickedFrac: frac, narrow, pending: new Map(), sentAt: 0 };
      this.notify();
    } else {
      if (!p.shift) this.selection.clear();
      this.g = { kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y, add: p.shift };
      this.notify();
    }
  }

  pointerMove(list: Ptr[]) {
    const last = list[list.length - 1];
    if (!last) return;
    if (last.type === "touch" && this.touches.has(last.id)) {
      this.touches.set(last.id, { x: last.x, y: last.y });
      if (this.pinch) { this.updatePinch(); return; }
    }
    if (last.type === "touch" && last.t - this.lastPenAt < 700 && !this.g) return;
    const w = this.toWorld(last.x, last.y);
    this.hover = { x: w.x, y: w.y };
    const g = this.g;
    if (!g) {
      if (this.ui.tool === "laser" && last.type !== "touch") this.laserMove(w.x, w.y);
      else if (this.canDraw && !this.isTutor && last.type !== "touch") this.sendPtr(w.x, w.y, false);
      this.invalidate();
      return;
    }
    switch (g.kind) {
      case "pan": this.view = { ...this.view, x: g.vx + (last.x - g.sx), y: g.vy + (last.y - g.sy) }; this.invalidate(); break;
      case "laser": this.laserMove(w.x, w.y); break;
      case "stroke": this.strokeMove(g, list); break;
      case "shape": this.shapeMove(g, w, last.shift); break;
      case "erase": this.eraseAt(w.x, w.y); break;
      case "move": this.moveSel(g, w); break;
      case "handle": this.handleMove(g, w, last.shift); break;
      case "gscale": this.gscaleMove(g, w); break;
      case "marquee": g.x1 = w.x; g.y1 = w.y; this.marquee = { x: Math.min(g.x0, g.x1), y: Math.min(g.y0, g.y1), w: Math.abs(g.x1 - g.x0), h: Math.abs(g.y1 - g.y0) }; this.invalidate(); break;
    }
  }

  pointerUp(p: Ptr) {
    if (p.type === "touch") {
      this.touches.delete(p.id);
      if (this.pinch) { if (this.touches.size < 2) this.pinch = null; this.notify(); return; }
    }
    const g = this.g; this.g = null;
    if (!g) return;
    this.finishGesture(g, p.shift, false);
  }
  /** End a gesture — normally on pointer up, or (`abort`) because a second finger landed / the pointer was cancelled. Both leave a finished, undoable result. */
  private finishGesture(g: Gesture, shift: boolean, abort: boolean) {
    switch (g.kind) {
      case "stroke": this.finishStroke(g, shift, abort); break;
      case "shape": {
        const el = this.curPage.els.get(g.id);
        if (el) {
          const tiny = Math.hypot((el.x2 ?? 0) - (el.x1 ?? 0), (el.y2 ?? 0) - (el.y1 ?? 0)) < 4 / this.view.k;
          if (tiny) { const dv = nextV(); applyAll(this.state, [{ op: "del", page: g.page, ids: [g.id], v: dv }], this.self); this.emit({ op: "del", page: g.page, ids: [g.id], v: dv }); }
          else { this.history.push({ t: "add", page: g.page, els: [{ ...el }] }); this.selection.clear(); this.selection.add(el.id); this.ui.tool = "select"; if (isLineShape(el.shape)) this.bindConnector(el.id); }
        }
        this.saveVersion++; this.notify(); break;
      }
      case "erase": if (g.removed.length) this.history.push({ t: "del", page: g.page, els: g.removed }); this.notify(); break;
      case "move": if (abort) { g.clickedFrac = null; g.narrow = null; } this.finishMove(g); break;
      case "handle": this.finishHandle(g); break;
      case "gscale": this.finishGscale(g); break;
      case "marquee": {
        const r = this.marquee; this.marquee = null;
        if (r && (r.w > 3 || r.h > 3) && !abort) for (const e of this.curPage.els.values()) { const b = boundsOf(e); if (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h) this.selection.add(e.id); }
        this.invalidate(); this.notify(); break;
      }
      case "laser": break;
      case "pan": this.notify(); break;
    }
  }
  pointerCancel(p: Ptr) { this.touches.delete(p.id); if (this.pinch && this.touches.size < 2) this.pinch = null; this.abortGesture(); }
  pointerLeave() { this.hover = null; this.invalidate(); }

  private abortGesture() {
    const g = this.g; this.g = null;
    if (g) this.finishGesture(g, false, true);
  }
  private startPinch() {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const wpt = this.toWorld(cx, cy);
    this.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), k0: this.view.k, wx: wpt.x, wy: wpt.y };
  }
  private updatePinch() {
    const [a, b] = [...this.touches.values()], pn = this.pinch;
    if (!a || !b || !pn) return;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const k = clamp((pn.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / pn.d0, K_MIN, K_MAX);
    this.view = { k, x: cx - pn.wx * k, y: cy - pn.wy * k };
    this.invalidate();
  }

  // stroke
  private armHold() {
    const g = this.g;
    if (!g || g.kind !== "stroke") return;
    if (g.timer) clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      const cur = this.g;
      if (!cur || cur.kind !== "stroke" || cur.id !== g.id) return;
      const el = this.curPage.els.get(g.id);
      if (!el?.pts || el.pts.length < PT * 6) return;
      cur.straight = true; this.setStraight(cur, cur.last.x, cur.last.y);
    }, 650);
  }
  private setStraight(g: Extract<Gesture, { kind: "stroke" }>, x: number, y: number) {
    const el = this.curPage.els.get(g.id);
    if (!el) return;
    const f = g.first;
    // shift also snaps the angle to 15° steps
    let ex = x, ey = y;
    if (g.snap) { const a = Math.atan2(y - f.y, x - f.x), d = Math.hypot(x - f.x, y - f.y), s = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); ex = f.x + Math.cos(s) * d; ey = f.y + Math.sin(s) * d; }
    el.pts = [round1(f.x), round1(f.y), f.p, round1(ex), round1(ey), f.p];
    el.v = nextV();
    g.sent = 2;
    this.emit({ op: "upd", page: g.page, id: g.id, patch: { pts: el.pts.slice() }, v: el.v });
    this.invalidate();
  }
  private strokeMove(g: Extract<Gesture, { kind: "stroke" }>, list: Ptr[]) {
    const el = this.curPage.els.get(g.id);
    if (!el?.pts) return;
    for (const p of list) {
      const w = this.toWorld(p.x, p.y);
      if (g.straight || g.snap) { g.last = { x: w.x, y: w.y }; if (g.snap && !g.straight && Math.hypot(w.x - g.first.x, w.y - g.first.y) > 6 / this.view.k) g.straight = true; if (g.straight) { this.setStraight(g, w.x, w.y); continue; } }
      const min = 1.4 / this.view.k;
      if (Math.hypot(w.x - g.last.x, w.y - g.last.y) < min) continue;
      const pr = p.type === "pen" ? clamp(Math.round(p.pressure * 100), 8, 100) : 50;
      el.pts.push(round1(w.x), round1(w.y), pr);
      g.last = { x: w.x, y: w.y };
    }
    const n = el.pts.length / PT;
    if (n > g.sent) {
      this.emit({ op: "pts", page: g.page, id: g.id, from: g.sent, pts: el.pts.slice(g.sent * PT) });
      g.sent = n;
      this.armHold();
    }
    this.saveVersion++;
    this.invalidate();
  }
  private finishStroke(g: Extract<Gesture, { kind: "stroke" }>, shift: boolean, abort = false) {
    if (g.timer) clearTimeout(g.timer);
    const el = this.curPage.els.get(g.id);
    if (el && abort && (el.pts?.length ?? 0) <= PT) { // a pinch's first finger left a lone dot: take it back
      const dv = nextV(); applyAll(this.state, [{ op: "del", page: g.page, ids: [g.id], v: dv }], this.self); this.emit({ op: "del", page: g.page, ids: [g.id], v: dv });
    } else if (el) {
      if (shift && !g.straight && (el.pts?.length ?? 0) >= PT * 2) { g.snap = true; this.setStraight(g, g.last.x, g.last.y); }
      this.history.push({ t: "add", page: g.page, els: [{ ...el, pts: el.pts?.slice() }] });
    }
    this.saveVersion++; this.notify();
  }

  // shapes
  private shapeMove(g: Extract<Gesture, { kind: "shape" }>, w: { x: number; y: number }, shift: boolean) {
    const el = this.curPage.els.get(g.id);
    if (!el) return;
    let x2 = w.x, y2 = w.y;
    if (shift) {
      if (isLineShape(g.shape)) { const a = Math.atan2(y2 - g.y, x2 - g.x), d = Math.hypot(x2 - g.x, y2 - g.y), s = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); x2 = g.x + Math.cos(s) * d; y2 = g.y + Math.sin(s) * d; }
      else if (g.shape === "triangle") { const m = Math.abs(x2 - g.x); x2 = g.x + Math.sign(x2 - g.x || 1) * m; y2 = g.y + Math.sign(y2 - g.y || 1) * m * 0.866; } // equilateral
      else { const m = Math.max(Math.abs(x2 - g.x), Math.abs(y2 - g.y)); x2 = g.x + Math.sign(x2 - g.x || 1) * m; y2 = g.y + Math.sign(y2 - g.y || 1) * m; }
    } else { const sp = this.snapPt(x2, y2); x2 = sp.x; y2 = sp.y; }
    el.x2 = round1(x2); el.y2 = round1(y2); el.v = nextV();
    this.emit({ op: "upd", page: g.page, id: g.id, patch: { x2: el.x2, y2: el.y2 }, v: el.v });
    this.saveVersion++;
    this.invalidate();
  }

  // eraser
  private eraseAt(x: number, y: number) {
    const g = this.g;
    if (!g || g.kind !== "erase") return;
    const r = this.ui.eraserSize / 2;
    const hits: El[] = [];
    // by default the eraser rubs out DRAWINGS only (pen, shapes, typed text, notes you made) — never a picture, a teaching aid or a template's parts
    const ink = !this.ui.eraserAll;
    for (const e of this.curPage.els.values()) {
      if (!this.mayMove(e)) continue;
      if (ink && (e.k === "image" || e.k === "stamp" || e.grp)) continue;
      if (hitTest(e, x, y, r)) hits.push(e);
    }
    if (!hits.length) return;
    const ids = hits.map((e) => e.id);
    g.removed.push(...hits.map((e) => ({ ...e, pts: e.pts?.slice() })));
    const v = nextV();
    applyAll(this.state, [{ op: "del", page: g.page, ids, v }], this.self);
    this.emit({ op: "del", page: g.page, ids, v });
    ids.forEach((i) => this.selection.delete(i));
    this.saveVersion++; this.notify();
  }

  // select: move / handles
  private moveSel(g: Extract<Gesture, { kind: "move" }>, w: { x: number; y: number }) {
    let dx = w.x - g.sx, dy = w.y - g.sy;
    if (!g.moved && Math.hypot(dx, dy) * this.view.k < 3) return;
    g.moved = true;
    const sn = this.snapMoveDelta(g.orig, dx, dy); dx = sn.dx; dy = sn.dy;
    for (const [id, o] of g.orig) {
      const cur = this.curPage.els.get(id);
      if (!cur) continue;
      const patch = movePatch(o, dx, dy);
      Object.assign(cur, patch);
      cur.v = nextV();
      g.pending.set(id, { op: "upd", page: g.page, id, patch, v: cur.v });
    }
    this.flushPending(g, false);
    this.saveVersion++;
    this.invalidate();
  }
  /** Send a drag's latest positions — at most every ~90 ms (a template is hundreds of elements), long strokes only when the drag ends. */
  private flushPending(g: { pending: Map<string, Op>; sentAt: number }, force: boolean) {
    const now = Date.now();
    if (!force && now - g.sentAt < 90) return;
    g.sentAt = now;
    const send: Op[] = [];
    for (const [id, op] of g.pending) {
      if (!force && op.op === "upd" && op.patch.pts && op.patch.pts.length / PT > SLICE_PTS) continue;
      send.push(op); g.pending.delete(id);
    }
    if (send.length) this.emit(...send);
  }
  private finishMove(g: Extract<Gesture, { kind: "move" }>) {
    this.flushPending(g, true);
    if (!g.moved && g.narrow) { this.selection = new Set([g.narrow]); this.invalidate(); }
    if (g.moved) {
      // an arrow dragged away on its own lets go of the shapes it was attached to
      for (const [id, o] of g.orig) if (isConnector(o) && ((o.fr && !g.orig.has(o.fr)) || (o.to && !g.orig.has(o.to)))) {
        const cur = this.curPage.els.get(id);
        if (cur) { const patch: Partial<El> = { fr: g.orig.has(o.fr ?? "") ? o.fr : undefined, to: g.orig.has(o.to ?? "") ? o.to : undefined }; Object.assign(cur, patch); cur.v = nextV(); this.emit({ op: "upd", page: g.page, id, patch, v: cur.v }); }
      }
      const acts: Action[] = [];
      for (const [id, o] of g.orig) {
        const cur = this.curPage.els.get(id);
        if (!cur) continue;
        const keys = Object.keys(movePatch(o, 0, 0)) as (keyof El)[];
        const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        for (const k of keys) { before[k] = o[k]; after[k] = cur[k]; }
        acts.push({ t: "upd", page: g.page, id, before: before as Partial<El>, after: after as Partial<El> });
      }
      if (acts.length) this.history.push(acts.length === 1 ? acts[0]! : { t: "group", a: acts });
    } else if (g.clickedFrac) {
      const el = this.curPage.els.get(g.clickedFrac.id);
      if (el && el.stamp === "periodic") {
        const z = periodicHit(el, g.clickedFrac.x, g.clickedFrac.y);
        if (z) { const cur = new Set(String(el.opts?.sel ?? "").split(",").filter(Boolean).map(Number)); if (cur.has(z)) cur.delete(z); else cur.add(z); this.patchEl(el.id, { opts: { ...el.opts, sel: [...cur].join(",") } }); }
      } else if (el && el.stamp === "dice") {
        const two = Number(el.opts?.n ?? 1) >= 2, d6 = () => 1 + Math.floor(Math.random() * 6);
        this.patchEl(el.id, { opts: { ...el.opts, a: d6(), b: two ? d6() : Number(el.opts?.b ?? 2), rolls: Number(el.opts?.rolls ?? 0) + 1 } });
      } else if (el && el.stamp === "spinner") {
        const k = spinnerItems(el).length, seg = 360 / k, pick = Math.floor(Math.random() * k);
        const want = ((-(pick + 0.5 + (Math.random() - 0.5) * 0.7) * seg) % 360 + 360) % 360, cur = Number(el.opts?.spin ?? 0);
        const next = cur + 360 * (4 + Math.floor(Math.random() * 2)) + ((((want - cur) % 360) + 360) % 360);
        this.patchEl(el.id, { opts: { ...el.opts, spin: Math.round(next * 10) / 10, pick } });
      } else if (el && el.stamp === "tally") {
        this.patchEl(el.id, { opts: { ...el.opts, n: Number(el.opts?.n ?? 0) + 1 } });
      } else if (el) {
        const parts = Math.max(1, Math.min(12, Number(el.opts?.parts ?? 4))), i = clamp(Math.floor(((g.clickedFrac.x - (el.x ?? 0)) / (el.w ?? 1)) * parts), 0, parts - 1);
        const mask = Number(el.opts?.mask ?? 0) ^ (1 << i);
        this.patchEl(el.id, { opts: { ...el.opts, mask } });
      }
    }
    this.notify();
  }
  private handleMove(g: Extract<Gesture, { kind: "handle" }>, w: { x: number; y: number }, shift: boolean) {
    const cur = this.curPage.els.get(g.id);
    if (!cur) return;
    const o = g.orig;
    let patch: Partial<El> = {};
    const hk = g.handle;
    if (hk === "p1" || hk === "p2") {
      let x = w.x, y = w.y;
      if (shift && isLineShape(o.shape)) { const ax = (hk === "p1" ? o.x2 : o.x1) ?? 0, ay = (hk === "p1" ? o.y2 : o.y1) ?? 0, a = Math.atan2(y - ay, x - ax), d = Math.hypot(x - ax, y - ay), s = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); x = ax + Math.cos(s) * d; y = ay + Math.sin(s) * d; }
      else { const sp = this.snapPt(x, y); x = sp.x; y = sp.y; }
      patch = hk === "p1" ? { x1: round1(x), y1: round1(y) } : { x2: round1(x), y2: round1(y) };
    } else if (hk === "rotate") {
      const rc = rotCentre(o);
      let deg = (Math.atan2(w.y - rc.y, w.x - rc.x) * 180) / Math.PI + 90;
      if (shift) deg = Math.round(deg / 15) * 15;
      patch = { rot: Math.round(deg * 10) / 10 };
    } else if (hk === "resize") {
      // resize from the bottom-right corner, in the element's own (unrotated) frame
      const cx = (o.x ?? 0) + (o.w ?? 0) / 2, cy = (o.y ?? 0) + (o.h ?? 0) / 2, a = -((o.rot ?? 0) * Math.PI) / 180;
      const lx = cx + (w.x - cx) * Math.cos(a) - (w.y - cy) * Math.sin(a), ly = cy + (w.x - cx) * Math.sin(a) + (w.y - cy) * Math.cos(a);
      let nw = Math.max(40, lx - (o.x ?? 0)), nh = Math.max(30, ly - (o.y ?? 0));
      if (o.k === "image" || o.k === "stamp") { const ratio = (o.w ?? 1) / (o.h ?? 1); if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; }
      patch = { w: round1(nw), h: round1(nh) };
    } else {
      // a closed shape: drag a corner or an edge middle (Shift on a corner keeps its proportions)
      let l = Math.min(o.x1 ?? 0, o.x2 ?? 0), r = Math.max(o.x1 ?? 0, o.x2 ?? 0), t = Math.min(o.y1 ?? 0, o.y2 ?? 0), b = Math.max(o.y1 ?? 0, o.y2 ?? 0);
      const w0 = r - l, h0 = b - t, sp = shift ? w : this.snapPt(w.x, w.y);
      if (hk.includes("w")) l = sp.x; if (hk.includes("e")) r = sp.x; if (hk.includes("n")) t = sp.y; if (hk.includes("s")) b = sp.y;
      if (shift && hk.length === 2 && w0 > 0 && h0 > 0) { // keep the proportions: the bigger pull wins
        const k = Math.max(Math.abs(r - l) / w0, Math.abs(b - t) / h0);
        if (hk.includes("w")) l = r - w0 * k; else r = l + w0 * k;
        if (hk.includes("n")) t = b - h0 * k; else b = t + h0 * k;
      }
      const nl = Math.min(l, r), nr = Math.max(l, r), nt = Math.min(t, b), nb = Math.max(t, b);
      patch = { x1: round1(nl), y1: round1(nt), x2: round1(Math.max(nr, nl + 6)), y2: round1(Math.max(nb, nt + 6)) };
    }
    Object.assign(cur, patch); cur.v = nextV();
    this.emit({ op: "upd", page: g.page, id: g.id, patch, v: cur.v });
    this.saveVersion++; this.invalidate();
  }
  private finishHandle(g: Extract<Gesture, { kind: "handle" }>) {
    const cur = this.curPage.els.get(g.id);
    if (cur && (g.handle === "p1" || g.handle === "p2")) this.bindConnector(g.id);
    if (cur) {
      const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
      for (const k of ["x1", "y1", "x2", "y2", "w", "h", "rot"] as (keyof El)[]) if (cur[k] !== g.orig[k]) { before[k] = g.orig[k]; after[k] = cur[k]; }
      if (Object.keys(after).length) this.history.push({ t: "upd", page: g.page, id: g.id, before: before as Partial<El>, after: after as Partial<El> });
    }
    this.notify();
  }

  /** Attach the ends of a line / arrow to the shapes they touch (so it follows them), or detach an end that sits on nothing. */
  bindConnector(id: string, tol = 10) {
    const e = this.curPage.els.get(id);
    if (!e || e.k !== "shape" || !isLineShape(e.shape) || !this.mayEditEl(e)) return;
    const els = [...this.curPage.els.values()];
    const a = bindTarget(els, e.x1 ?? 0, e.y1 ?? 0, tol, e.id), b = bindTarget(els, e.x2 ?? 0, e.y2 ?? 0, tol, e.id);
    const fr = a?.id, to = b && b.id !== a?.id ? b.id : undefined;
    if (fr === e.fr && to === e.to) return;
    const patch: Partial<El> = { fr, to };
    Object.assign(e, patch); e.v = nextV();
    this.emit({ op: "upd", page: this.page, id, patch, v: e.v });
    routeConnectors(this.curPage.els);
    this.saveVersion++; this.invalidate();
  }

  /** Scale a whole template / selection by dragging one of its corner handles (everything scales together, about the opposite corner). */
  private gscaleMove(g: Extract<Gesture, { kind: "gscale" }>, w: { x: number; y: number }) {
    const b = g.box;
    const corner = { x: g.corner.includes("w") ? b.x : b.x + b.w, y: g.corner.includes("n") ? b.y : b.y + b.h };
    const anchor = { x: g.corner.includes("w") ? b.x + b.w : b.x, y: g.corner.includes("n") ? b.y + b.h : b.y };
    const vx = corner.x - anchor.x, vy = corner.y - anchor.y, len2 = vx * vx + vy * vy || 1;
    const sc = clamp(((w.x - anchor.x) * vx + (w.y - anchor.y) * vy) / len2, 0.1, 12);
    for (const [id, o] of g.orig) {
      const cur = this.curPage.els.get(id);
      if (!cur) continue;
      const patch = scalePatch(o, sc, anchor.x, anchor.y);
      Object.assign(cur, patch); cur.v = nextV();
      g.pending.set(id, { op: "upd", page: g.page, id, patch, v: cur.v });
    }
    this.flushPending(g, false);
    this.saveVersion++; this.invalidate();
  }
  private finishGscale(g: Extract<Gesture, { kind: "gscale" }>) {
    this.flushPending(g, true);
    const acts: Action[] = [];
    for (const [id, o] of g.orig) {
      const cur = this.curPage.els.get(id);
      if (!cur) continue;
      const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
      for (const k of ["pts", "x", "y", "x1", "y1", "x2", "y2", "w", "h", "size"] as (keyof El)[]) if (JSON.stringify(cur[k]) !== JSON.stringify(o[k])) { before[k] = o[k]; after[k] = cur[k]; }
      if (Object.keys(after).length) acts.push({ t: "upd", page: g.page, id, before: before as Partial<El>, after: after as Partial<El> });
    }
    if (acts.length) this.history.push(acts.length === 1 ? acts[0]! : { t: "group", a: acts });
    this.notify();
  }

  // laser
  private laserMove(x: number, y: number) {
    const now = Date.now();
    this.me.x = x; this.me.y = y; this.me.laser = true; this.me.at = now;
    this.me.trail.push({ x, y, at: now }); if (this.me.trail.length > 60) this.me.trail.shift();
    this.sendPtr(x, y, true);
    this.invalidate();
  }

  // ── editing text / sticky / a shape's label ────────────────────────────────
  beginEdit(e: El) {
    if (e.k === "text") this.editing = { id: e.id, kind: "text", x: e.x ?? 0, y: e.y ?? 0, w: 0, h: 0, text: e.text ?? "", size: e.size ?? 28, bold: !!e.bold, c: e.c ?? this.ui.colour };
    else if (e.k === "sticky") this.editing = { id: e.id, kind: "sticky", x: e.x ?? 0, y: e.y ?? 0, w: e.w ?? 200, h: e.h ?? 160, text: e.text ?? "", size: e.size ?? 22, bold: true, c: e.c ?? this.ui.stickyColour };
    else if (canHoldText(e)) {
      const a = shapeTextArea(e);
      this.editing = { id: e.id, kind: "shape", x: a.x, y: a.y, w: a.w, h: a.h, text: e.text ?? "", size: e.size ?? 24, auto: e.size === undefined, bold: !!e.bold, c: e.tc ?? this.paper.ink, al: e.al ?? "c", va: e.va ?? "m", ph: e.ph };
    } else return;
    this.notify();
  }
  /** Tab / Shift+Tab in a template cell: save it and open the next cell of the same template (reading order). */
  tabEdit(dir: 1 | -1) {
    const id = this.editing?.id;
    const cur = id ? this.curPage.els.get(id) : undefined;
    this.commitEdit();
    if (!cur || !cur.grp) return;
    const cells = [...this.curPage.els.values()].filter((e) => e.grp === cur.grp && canHoldText(e) && (e.cell || e.id === cur.id) && this.mayEditEl(e))
      .sort((a, b) => Math.round(Math.min(a.y1 ?? 0, a.y2 ?? 0) / 8) - Math.round(Math.min(b.y1 ?? 0, b.y2 ?? 0) / 8) || Math.min(a.x1 ?? 0, a.x2 ?? 0) - Math.min(b.x1 ?? 0, b.x2 ?? 0));
    const i = cells.findIndex((e) => e.id === cur.id);
    const next = cells[i + dir];
    if (next) { this.selection = new Set([next.id]); this.beginEdit(next); }
  }
  /** Typing in the box: React must re-render (the box is a controlled textarea), so this notifies. */
  setEditText(t: string) { if (this.editing) { this.editing = { ...this.editing, text: t.slice(0, MAX_TEXT_CHARS) }; this.notify(); } }
  cancelEdit() { if (this.editing) { this.editing = null; this.notify(); } }
  commitEdit() {
    const d = this.editing; this.editing = null;
    if (!d) return;
    const text = d.text.replace(/\s+$/g, "");
    if (d.id) {
      const cur = this.curPage.els.get(d.id);
      if (!cur) { this.notify(); return; }
      const patch: Partial<El> = {};
      if (d.kind === "shape") {
        // a cell keeps existing when it is emptied — only its words go
        if (text !== (cur.text ?? "")) patch.text = text || undefined;
        if (!!cur.bold !== d.bold) patch.bold = d.bold || undefined;
        if (d.c !== (cur.tc ?? this.paper.ink)) patch.tc = d.c;
        if (!d.auto && d.size !== cur.size) patch.size = d.size;
      } else {
        if (!text) { this.deleteEls([cur]); return; }
        if (text !== cur.text) patch.text = text;
        if (d.kind === "text") { // size / bold / colour changed WHILE editing must stick too
          if (d.size !== (cur.size ?? 28)) patch.size = d.size;
          if (!!d.bold !== !!cur.bold) patch.bold = d.bold;
          if (d.c !== (cur.c ?? this.ui.colour)) patch.c = d.c;
        }
      }
      if (Object.keys(patch).length) this.patchEl(d.id, patch, true);
    } else if (text) {
      const el = d.kind === "text"
        ? this.mkEl({ k: "text", x: round1(d.x), y: round1(d.y), text, size: d.size, bold: d.bold, c: d.c })
        : this.mkEl({ k: "sticky", x: round1(d.x), y: round1(d.y), w: d.w, h: d.h, text, size: d.size, c: d.c });
      this.commit([{ op: "add", page: this.page, el }], { t: "add", page: this.page, els: [el] });
    }
    this.notify();
  }

  // ── element edits ──────────────────────────────────────────────────────────
  patchEl(id: string, patch: Partial<El>, remember = true) {
    const cur = this.curPage.els.get(id);
    if (!cur || !this.mayEditEl(cur)) return;
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(patch) as (keyof El)[]) before[k] = cur[k];
    this.commit([{ op: "upd", page: this.page, id, patch, v: nextV() }], remember ? { t: "upd", page: this.page, id, before: before as Partial<El>, after: patch } : undefined);
  }
  /** Apply a patch to every selected element (colour, size, etc.). */
  patchSelection(patch: (e: El) => Partial<El>) {
    const acts: Action[] = [];
    const ops: Op[] = [];
    for (const e of this.selectedEls) {
      if (!this.mayEditEl(e)) continue;
      const p = patch(e);
      if (!Object.keys(p).length) continue;
      const before: Record<string, unknown> = {};
      for (const k of Object.keys(p) as (keyof El)[]) before[k] = e[k];
      const v = nextV();
      ops.push({ op: "upd", page: this.page, id: e.id, patch: p, v });
      acts.push({ t: "upd", page: this.page, id: e.id, before: before as Partial<El>, after: p });
    }
    if (ops.length) this.commit(ops, acts.length === 1 ? acts[0] : { t: "group", a: acts });
  }
  deleteEls(els: El[]) {
    const mine = els.filter((e) => this.mayMove(e));
    if (!mine.length) return;
    mine.forEach((e) => this.selection.delete(e.id));
    this.commit([{ op: "del", page: this.page, ids: mine.map((e) => e.id), v: nextV() }], { t: "del", page: this.page, els: mine.map((e) => ({ ...e, pts: e.pts?.slice() })) });
  }
  deleteSelection() { this.deleteEls(this.selectedEls); }
  duplicateSelection() {
    const els = this.selectedEls.filter((e) => this.mayEditEl(e)).sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
    if (!els.length) return;
    // a copy of a template is a NEW template: fresh group ids (else the copy stays glued to the original), and the stacking order carries over
    const grps = new Map<string, string>(), z0 = topZ(this.curPage);
    const copies = els.map((e, i) => {
      const mv = movePatch(e, 24, 24);
      return { ...e, ...mv, id: newId(), z: z0 + i, v: nextV(), grp: e.grp ? (grps.get(e.grp) ?? (grps.set(e.grp, newId("g")), grps.get(e.grp)!)) : undefined } as El;
    });
    // a copied arrow is attached to the COPIES of its shapes (or to nothing) — never to the originals
    const idMap = new Map(els.map((e, i) => [e.id, copies[i]!.id]));
    for (const cp of copies) { if (cp.fr) cp.fr = idMap.get(cp.fr); if (cp.to) cp.to = idMap.get(cp.to); }
    this.commit(copies.map((el) => ({ op: "add" as const, page: this.page, el })), { t: "add", page: this.page, els: copies });
    this.selection = new Set(copies.map((c) => c.id));
    this.notify();
  }
  /** Stack order: the selection keeps its own relative order (it used to be flattened to one level). */
  private reorder(toFront: boolean) {
    const els = this.selectedEls.filter((e) => this.mayEditEl(e)).sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
    if (!els.length) return;
    let lo = Infinity, hi = -Infinity;
    for (const e of this.curPage.els.values()) { lo = Math.min(lo, e.z); hi = Math.max(hi, e.z); }
    const base = toFront ? hi + 1 : lo - els.length, zs = new Map(els.map((e, i) => [e.id, base + i]));
    this.patchSelection((e) => (zs.has(e.id) ? { z: zs.get(e.id)! } : {}));
  }
  bringToFront() { this.reorder(true); }
  sendToBack() { this.reorder(false); }
  /** Join the selection into one template (moves together) / split a template into its separate parts. */
  groupSelection() {
    const g = newId("g");
    if (this.selectedEls.filter((e) => this.mayEditEl(e)).length < 2) return;
    this.patchSelection(() => ({ grp: g }));
    this.say("Grouped — they move together now");
  }
  ungroupSelection() {
    if (!this.selectedEls.some((e) => e.grp && this.mayEditEl(e))) return;
    this.patchSelection((e) => (e.grp ? { grp: undefined } : {}));
    this.say("Ungrouped — click any part to move, resize or type in it on its own");
  }
  toggleLock() {
    const els = this.selectedEls.filter((e) => this.mayEditEl(e));
    if (!els.length) return;
    const lock = !els.every((e) => e.lock);
    this.patchSelection((e) => ({ lock: lock || undefined }));
    this.say(lock ? "Locked — it can't be moved or rubbed out by accident" : "Unlocked");
  }
  /**
   * The selected TABLE, if the selection is exactly one grouped grid of rectangular cells (a Table / T-chart / KWL… from the toolkit):
   * its cells arranged by row (top → bottom) and column (left → right). Null when the selection is anything else.
   */
  get selectedTable(): { cells: El[][]; grp: string } | null {
    const sel = this.selectedEls;
    if (sel.length < 2 || !sel.every((e) => e.k === "shape" && e.shape === "rect" && e.cell && e.grp && e.grp === sel[0]!.grp)) return null;
    const family = [...this.curPage.els.values()].filter((e) => e.grp === sel[0]!.grp);
    if (family.length !== sel.length) return null;
    // cells on one row share a top edge (within a couple of units after a resize's rounding): cluster the edges
    const top = (e: El) => Math.min(e.y1 ?? 0, e.y2 ?? 0), left = (e: El) => Math.min(e.x1 ?? 0, e.x2 ?? 0);
    const cluster = (vals: number[]) => { const out: number[] = []; for (const v of [...vals].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1]! > 2) out.push(v); return out; };
    const ys = cluster(sel.map(top)), xs = cluster(sel.map(left));
    if (ys.length * xs.length !== sel.length) return null;
    const rows = ys.map((y) => sel.filter((e) => Math.abs(top(e) - y) <= 2).sort((a, b) => left(a) - left(b)));
    if (rows.some((r) => r.length !== xs.length)) return null;
    return { cells: rows, grp: sel[0]!.grp! };
  }
  /** Add a row under the last one / a column after the last one of the selected table (copies of the edge cells, emptied). */
  tableAdd(what: "row" | "col") {
    const t = this.selectedTable;
    if (!t || !this.mayEditEl(t.cells[0]![0]!)) return;
    const src = what === "row" ? t.cells[t.cells.length - 1]! : t.cells.map((r) => r[r.length - 1]!);
    if (what === "row" ? t.cells.length >= 30 : t.cells[0]!.length >= 12) { this.say(`A table holds up to ${what === "row" ? 30 : 12} ${what === "row" ? "rows" : "columns"}`); return; }
    const z0 = topZ(this.curPage), v = reserveV(src.length);
    const added = src.map((e, i) => {
      const w = Math.abs((e.x2 ?? 0) - (e.x1 ?? 0)), h = Math.abs((e.y2 ?? 0) - (e.y1 ?? 0));
      const mv = what === "row" ? movePatch(e, 0, h) : movePatch(e, w, 0);
      // a new column copies the row's LOOK (a heading stays a heading); a new row is a plain body row
      const plain = what === "row" ? { fill: null, fa: undefined, bold: undefined } : {};
      return { ...e, ...mv, ...plain, text: undefined, id: newId(), z: z0 + i, v: v + i } as El;
    });
    this.commit(added.map((el) => ({ op: "add" as const, page: this.page, el })), { t: "add", page: this.page, els: added });
    for (const e of added) this.selection.add(e.id);
    this.notify();
  }
  /** Remove the last row / column of the selected table (a table keeps at least one of each). */
  tableRemove(what: "row" | "col") {
    const t = this.selectedTable;
    if (!t || !this.mayEditEl(t.cells[0]![0]!)) return;
    if (what === "row" ? t.cells.length <= 1 : t.cells[0]!.length <= 1) return;
    const gone = what === "row" ? t.cells[t.cells.length - 1]! : t.cells.map((r) => r[r.length - 1]!);
    this.deleteEls(gone);
    this.notify();
  }
  /** Turn the selected triangle into a kind of triangle. */
  setTriangleType(kind: "equilateral" | "isosceles" | "right" | "scalene" | "obtuse") {
    const e = this.selectedEls.length === 1 ? this.selectedEls[0]! : null;
    if (!e || e.k !== "shape" || e.shape !== "triangle" || !this.mayEditEl(e)) return;
    const l = Math.min(e.x1 ?? 0, e.x2 ?? 0), r = Math.max(e.x1 ?? 0, e.x2 ?? 0), t = Math.min(e.y1 ?? 0, e.y2 ?? 0), b = Math.max(e.y1 ?? 0, e.y2 ?? 0);
    const ap = { equilateral: 0.5, isosceles: 0.5, right: 0, scalene: 0.3, obtuse: -0.4 }[kind];
    const patch: Partial<El> = { x1: l, x2: r, y1: t, y2: kind === "equilateral" ? round1(t + (r - l) * 0.866) : b, ap: ap === 0.5 ? undefined : ap };
    this.patchEl(e.id, patch, true);
  }

  // ── inserts ────────────────────────────────────────────────────────────────
  private centre() { return this.toWorld(this.size.w / 2, this.size.h / 2); }
  insertStamp(kind: StampKind) {
    if (!this.isTutor) return;
    const d = stampDef(kind), c = this.centre();
    const el = this.mkEl({ k: "stamp", stamp: kind, x: round1(c.x - d.w / 2), y: round1(c.y - d.h / 2), w: d.w, h: d.h, opts: { ...d.opts }, c: this.paper.ink, rot: d.rotates ? 0 : undefined });
    this.commit([{ op: "add", page: this.page, el }], { t: "add", page: this.page, els: [el] });
    this.selection = new Set([el.id]); this.ui.tool = "select"; this.notify();
  }
  /** Place a toolkit template (or switch a background) at the middle of the view. */
  placeTemplate(item: ToolItem, vals: Vals) {
    if (!this.isTutor) return;
    if (item.bg) { this.setBackground(item.bg); return; }
    if (!item.make) return;
    const b = new B({ ink: this.paper.ink, brand: this.paper.brand, danger: this.paper.danger, soft: this.paper.brandSoft });
    item.make(b, b.c, vals);
    const c = this.centre();
    const els = place(b, c.x, c.y, this.self.own, topZ(this.curPage));
    if (!els.length) return;
    // arrows that touch a box are attached to it (flowcharts, food chains, cause chains: moving a box takes its arrows along)
    for (const a of els) if (a.k === "shape" && (a.shape === "arrow" || a.shape === "darrow")) {
      const fr = bindTarget(els, a.x1 ?? 0, a.y1 ?? 0, 8, a.id), to = bindTarget(els, a.x2 ?? 0, a.y2 ?? 0, 8, a.id);
      if (fr && to && fr.id !== to.id) { a.fr = fr.id; a.to = to.id; }
    }
    routeConnectors(new Map(els.map((e) => [e.id, e])));
    this.commit(els.flatMap((el) => [{ op: "add" as const, page: this.page, el }]), { t: "add", page: this.page, els });
    this.selection = new Set(els.map((e) => e.id)); this.ui.tool = "select"; this.notify();
  }
  /** Import worksheet / past-paper pictures, one new page each (the picture fills the page, ready to annotate). */
  importPages(pics: { id: string; url: string; w: number; h: number }[]) {
    if (!this.isTutor || !pics.length) return;
    const ops: Op[] = [];
    let first = "";
    const room = Math.max(0, 30 - this.state.pages.length);
    pics.slice(0, room).forEach((p, i) => {
      const pid = "im" + newId().slice(0, 6); if (!i) first = pid;
      const s = Math.min(1200 / p.w, 800 / p.h, 2), w = Math.round(p.w * s), h = Math.round(p.h * s);
      ops.push({ op: "padd", id: pid, bg: "blank" }, { op: "add", page: pid, el: { id: newId(), k: "image", own: this.self.own, z: 1, v: nextV(), imageId: p.id, url: p.url, x: -Math.round(w / 2), y: -Math.round(h / 2), w, h } });
    });
    if (!ops.length) { this.say("A board holds up to 30 pages"); return; }
    this.commit(ops);
    if (first) this.setPage(first);
    this.say(`Added ${ops.length / 2} ${ops.length / 2 === 1 ? "page" : "pages"} — draw and write right on them`);
  }
  /** Place saved elements (a "My templates" page) as fresh copies at the middle of the view. */
  placeCopies(src: El[]) {
    if (!this.isTutor || !src.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of src) { const r = boundsOf(e); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    const c = this.centre(), dx = c.x - (x0 + x1) / 2, dy = c.y - (y0 + y1) / 2, grp = newId("g"), v = reserveV(src.length), z0 = topZ(this.curPage);
    const els = src.map((e, i) => ({ ...e, ...movePatch(e, dx, dy), id: newId(), own: this.self.own, z: z0 + i, v: v + i, grp: e.grp ? grp : undefined, pts: e.pts ? movePatch(e, dx, dy).pts : undefined }) as El);
    const idMap = new Map(src.map((e, i) => [e.id, els[i]!.id]));
    for (const cp of els) { if (cp.fr) cp.fr = idMap.get(cp.fr); if (cp.to) cp.to = idMap.get(cp.to); }
    this.commit(els.map((el) => ({ op: "add" as const, page: this.page, el })), { t: "add", page: this.page, els });
    this.selection = new Set(els.map((e) => e.id)); this.ui.tool = "select"; this.notify();
  }
  /** Insert typed text (an accent, a symbol) into the text being edited, or as a new text block. */
  insertChars(chars: string) {
    if (this.editing) { this.editing.text = (this.editing.text + chars).slice(0, MAX_TEXT_CHARS); this.notify(); return; }
    if (!this.canDraw) return;
    const c = this.centre();
    const el = this.mkEl({ k: "text", x: round1(c.x - 20), y: round1(c.y - 20), text: chars, size: this.ui.textSize, bold: this.ui.bold, c: this.ui.colour });
    this.commit([{ op: "add", page: this.page, el }], { t: "add", page: this.page, els: [el] });
    this.selection = new Set([el.id]); this.ui.tool = "select"; this.notify();
  }
  insertImage(imageId: string, url: string, naturalW: number, naturalH: number) {
    if (!this.isTutor) return;
    const c = this.centre();
    const s = Math.min(1, 520 / Math.max(naturalW, naturalH, 1));
    const w = Math.max(60, Math.round(naturalW * s)), h = Math.max(60, Math.round(naturalH * s));
    const el = this.mkEl({ k: "image", imageId, url, x: round1(c.x - w / 2), y: round1(c.y - h / 2), w, h });
    this.commit([{ op: "add", page: this.page, el }], { t: "add", page: this.page, els: [el] });
    this.selection = new Set([el.id]); this.ui.tool = "select"; this.notify();
  }

  // ── history ────────────────────────────────────────────────────────────────
  undo() { if (!this.canDraw) return; const a = this.history.undo(); if (a) { this.selection.clear(); this.commit(actionOps(a)); } }
  redo() { if (!this.canDraw) return; const a = this.history.redo(); if (a) { this.selection.clear(); this.commit(actionOps(a)); } }

  // ── tool / ui ──────────────────────────────────────────────────────────────
  setLevel(l: Level) {
    this.level = l;
    // presets: Early = big chunky pen and big type · Standard = the middle sizes · Advanced = fine pen, compact type
    this.ui = { ...this.ui, penSize: l === "early" ? PEN_SIZES[2]! : l === "advanced" ? PEN_SIZES[0]! : PEN_SIZES[1]!, textSize: l === "early" ? TEXT_SIZES[2]! : l === "advanced" ? TEXT_SIZES[0]! : TEXT_SIZES[1]! };
    try { localStorage.setItem("hub-board-level", l); } catch { /* fine */ }
    this.notify();
  }
  setTool(t: Tool) {
    if (!this.canDraw && t !== "laser" && t !== "pan") { this.say(this.isTutor ? "" : "Only your tutor can draw right now"); return; }
    if (this.editing) this.commitEdit();
    this.ui = { ...this.ui, tool: t };
    if (isShapeTool(t)) this.lastShape = t;
    if (t !== "select") this.selection.clear();
    this.notify();
  }
  setUi(p: Partial<UiState>) {
    this.ui = { ...this.ui, ...p };
    // changing colour / size while something is selected restyles it
    if (this.selection.size && this.ui.tool === "select") {
      const sel = this.selectedEls, wholeTemplate = sel.length > 1 && sel.every((e) => e.grp && e.grp === sel[0]!.grp);
      // a template's colour coding is deliberate: recolouring is for a single part or a selection of your own drawings
      if (p.colour && !wholeTemplate) this.patchSelection((e) => (e.k === "stroke" || e.k === "shape" || e.k === "text" || e.k === "stamp" ? { c: p.colour, ...(e.k === "shape" && e.fill && e.fill === e.c ? { fill: p.colour } : {}) } : {}));
      if (p.penSize) this.patchSelection((e) => (e.k === "stroke" || e.k === "shape" ? { w: p.penSize } : {}));
      if (p.textSize) this.patchSelection((e) => (e.k === "text" || (e.k === "shape" && canHoldText(e) && !wholeTemplate) ? { size: p.textSize } : {}));
      if (p.bold !== undefined) this.patchSelection((e) => (e.k === "text" || (e.k === "shape" && canHoldText(e) && !wholeTemplate) ? { bold: p.bold || undefined } : {}));
      if (p.stickyColour) this.patchSelection((e) => (e.k === "sticky" ? { c: p.stickyColour } : {}));
      // shapes: fill / fill colour / solid / dashed / no outline / sides
      if (p.fill !== undefined) this.patchSelection((e) => (e.k === "shape" && isClosedShape(e.shape) ? (p.fill ? { fill: this.ui.fillColour ?? e.fill ?? e.c ?? this.ui.colour } : { fill: null }) : {}));
      if (p.fillColour !== undefined) this.patchSelection((e) => (e.k === "shape" && isClosedShape(e.shape) ? { fill: p.fillColour ?? e.c ?? this.ui.colour } : {}));
      if (p.fillSolid !== undefined) this.patchSelection((e) => (e.k === "shape" && e.fill ? { fa: p.fillSolid ? 1 : undefined } : {}));
      if (p.dashed !== undefined) this.patchSelection((e) => (e.k === "shape" ? { dash: p.dashed || undefined } : {}));
      if (p.noLine !== undefined) this.patchSelection((e) => (e.k === "shape" && isClosedShape(e.shape) ? { ns: p.noLine || undefined } : {}));
      if (p.sides !== undefined) this.patchSelection((e) => (e.k === "shape" && e.shape === "ngon" ? { n: p.sides } : {}));
    }
    const d = this.editing;
    if (d && d.kind !== "sticky") {
      if (p.colour) d.c = p.colour;
      if (p.textSize) { d.size = p.textSize; d.auto = false; }
      if (p.bold !== undefined) d.bold = p.bold;
    }
    this.notify();
  }
  /** The label alignment of the selected shapes / cells. */
  setLabelAlign(al?: "l" | "c" | "r", va?: "t" | "m" | "b") {
    this.patchSelection((e) => (e.k === "shape" && canHoldText(e) ? { ...(al ? { al: al === "c" ? undefined : al } : {}), ...(va ? { va: va === "m" ? undefined : va } : {}) } : {}));
    if (this.editing && this.editing.kind === "shape") this.editing = { ...this.editing, ...(al ? { al } : {}), ...(va ? { va } : {}) };
    this.notify();
  }

  // ── snapping ───────────────────────────────────────────────────────────────
  /** The grid step of this page's background (what "snap" sticks to). */
  snapStep(): number {
    switch (this.curPage.bg) { case "squared": case "graph": return 40; case "dotgrid": return 32; case "isometric": return 36; case "lined": return 44; case "numberline": return 60; case "handwriting": case "tianzige": return 50; default: return 20; }
  }
  snapPt(x: number, y: number) {
    if (!this.ui.snap) return { x, y };
    const s = this.snapStep();
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
  }
  /** A drag's offset, nudged so the first thing being moved lands on the grid. */
  private snapMoveDelta(orig: Map<string, El>, dx: number, dy: number) {
    if (!this.ui.snap) return { dx, dy };
    const first = orig.values().next().value as El | undefined;
    if (!first) return { dx, dy };
    const anchor = first.k === "shape" ? { x: Math.min(first.x1 ?? 0, first.x2 ?? 0), y: Math.min(first.y1 ?? 0, first.y2 ?? 0) } : first.k === "stroke" ? { x: boundsOf(first).x, y: boundsOf(first).y } : { x: first.x ?? 0, y: first.y ?? 0 };
    const t = this.snapPt(anchor.x + dx, anchor.y + dy);
    return { dx: t.x - anchor.x, dy: t.y - anchor.y };
  }

  // ── keyboard ───────────────────────────────────────────────────────────────
  /** Returns true when the key was ours (so the caller stops it reaching the call room's shortcuts). */
  key(e: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, down: boolean): boolean {
    if (e.key === " ") { this.spaceDown = down; if (down) this.invalidate(); return true; }
    if (!down) return false;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "z") { if (e.shiftKey) this.redo(); else this.undo(); return true; }
    if (mod && k === "y") { this.redo(); return true; }
    if (mod && k === "d") { this.duplicateSelection(); return true; }
    if (mod && k === "g") { if (e.shiftKey) this.ungroupSelection(); else this.groupSelection(); return true; }
    if (mod && k === "a") { if (!this.canDraw) return false; this.setTool("select"); this.selection = new Set([...this.curPage.els.values()].filter((el) => this.mayEditEl(el)).map((el) => el.id)); this.notify(); return true; }
    if (mod || e.altKey) return false;
    if (k === "escape") { if (this.editing) this.cancelEdit(); else { this.selection.clear(); this.setTool(this.canDraw ? "select" : "pan"); } return true; }
    if (k === "delete" || k === "backspace") { this.deleteSelection(); return true; }
    if ((k === "enter" || k === "f2") && this.selection.size === 1) { const el = this.selectedEls[0]!; if ((el.k === "text" || el.k === "sticky" || canHoldText(el)) && this.mayEditEl(el)) { this.beginEdit(el); return true; } }
    if (k === "]") { this.bringToFront(); return true; }
    if (k === "[") { this.sendToBack(); return true; }
    if (k === "+" || k === "=") { this.zoomBy(1.25); return true; }
    if (k === "-" || k === "_") { this.zoomBy(0.8); return true; }
    if (k === "0") { this.resetView(); return true; }
    const map: Record<string, Tool> = { v: "select", p: "pen", h: "highlighter", e: "eraser", t: "text", s: "sticky", l: "line", a: "arrow", d: "darrow", r: "rect", o: "ellipse", g: "triangle", w: "diamond", i: "star", q: "laser", m: "pan" };
    const t = map[k];
    if (t) { this.setTool(t); return true; }
    if (k.startsWith("arrow") && this.selection.size) {
      const step = e.shiftKey ? 20 : 4, dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0, dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
      this.patchSelection((el) => (el.lock ? {} : movePatch(el, dx, dy)));
      return true;
    }
    return false;
  }
  get panning() { return this.spaceDown; }
  /** Focus left the board: a held Space must not leave it stuck in pan mode. */
  releaseKeys() { if (this.spaceDown) { this.spaceDown = false; this.invalidate(); this.notify(); } }

  // ── drawing ────────────────────────────────────────────────────────────────
  private tagColour(e: El) { return personColour(e.by ?? e.id); }
  /** Render the current page into `ctx` (called from the canvas's rAF loop when something changed). */
  draw(ctx: CanvasRenderingContext2D, now = Date.now()) {
    if (!this.dirty && !this.animating(now)) return false;
    this.dirty = false;
    const { w, h, dpr } = this.size;
    const env = { k: this.view.k, paper: this.paper, images: this.images, editing: this.editing?.id ?? undefined };
    const page = this.curPage;
    // connectors follow their shapes (derived, not sent: every board computes the same ends from the same shapes)
    routeConnectors(page.els, this.g?.kind === "handle" ? new Set([this.g.id]) : this.g?.kind === "move" && this.g.moved ? new Set(this.g.orig.keys()) : undefined);
    drawPage(ctx, page, this.view, w, h, dpr, env);
    ctx.setTransform(dpr * this.view.k, 0, 0, dpr * this.view.k, dpr * this.view.x, dpr * this.view.y);
    // name tags on fresh student work
    for (const [id, t] of this.touched) {
      if (now - t > 5000) { this.touched.delete(id); continue; }
      const e = page.els.get(id);
      if (e && isStudentKey(e.own)) drawTag(ctx, e, this.tagColour(e), env);
    }
    const sel = this.selectedEls;
    if (sel.length && !this.g?.kind.startsWith("laser")) drawSelection(ctx, sel, env, { single: sel.length === 1 && this.canDraw, multiHandles: sel.length > 1 && this.canDraw && sel.every((e) => this.mayMove(e)) });
    if (this.marquee) {
      ctx.save(); ctx.setLineDash([5 / this.view.k, 4 / this.view.k]); ctx.lineWidth = 1.4 / this.view.k; ctx.strokeStyle = this.paper.brand; ctx.fillStyle = this.paper.brandSoft; ctx.globalAlpha = 0.5;
      ctx.fillRect(this.marquee.x, this.marquee.y, this.marquee.w, this.marquee.h); ctx.globalAlpha = 1; ctx.strokeRect(this.marquee.x, this.marquee.y, this.marquee.w, this.marquee.h); ctx.restore();
    }
    // eraser ring
    if (this.ui.tool === "eraser" && this.hover && this.canDraw) {
      ctx.save(); ctx.lineWidth = 1.6 / this.view.k; ctx.strokeStyle = this.paper.axis; ctx.beginPath(); ctx.arc(this.hover.x, this.hover.y, this.ui.eraserSize / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    this.me.trail = this.me.trail.filter((t) => now - t.at < LASER_MS);
    const cs = [...this.cursors.values()].filter((c) => now - c.at < 4200 || c.trail.some((t) => now - t.at < LASER_MS));
    for (const c of this.cursors.values()) c.trail = c.trail.filter((t) => now - t.at < LASER_MS);
    if (this.me.trail.length || now - this.me.at < 2000) cs.push({ ...this.me, name: "" });
    drawCursors(ctx, cs, env, now);
    return true;
  }
  private animating(now: number) {
    if (this.me.trail.length) return true;
    for (const c of this.cursors.values()) if (c.trail.length || now - c.at < 4200) return true;
    for (const e of this.curPage.els.values()) if ((e.stamp === "timer" && timerRunning(e, now)) || widgetAnimating(e, now)) return true;
    return this.touched.size > 0;
  }
  requestFrame(fn: () => void) { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; fn(); }); }
  drawRect(): Rect { return visibleWorld(this.view, this.size.w, this.size.h); }
  textBoxOf(e: El) { return textBox(e); }
  inEl(e: El, x: number, y: number) { return inRect(boundsOf(e), x, y); }
  drawOne(ctx: CanvasRenderingContext2D, e: El) { drawElement(ctx, e, { k: this.view.k, paper: this.paper, images: this.images }); }
  /** Where a shape/cell label is laid out right now (the typing box uses the same maths as the painter). */
  labelLayout(d: EditDraft) { return layoutLabel(d.text || " ", d.w, d.h, d.auto ? undefined : d.size, d.bold); }
}
