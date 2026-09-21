import { MAX_ELS_PER_PAGE, MAX_PAGES, MAX_PTS, PT, isStudentKey, mayWrite, newState, nextV, reserveV, pageOf, sorted, type BgKind, type BoardState, type El, type ElKind, type Op, type Sender } from "./model";

// The whiteboard's state machine: apply an operation, with the permission rules
// enforced HERE (the receiving side), so a locked board ignores student ops and
// a student can never touch someone else's work no matter what a client sends.
// Also: per-user undo/redo (as inverse actions), and chunking a whole board into
// small messages for late joiners. Pure — no React, no DOM.

export interface ApplyResult {
  /** The op changed the state. */
  changed: boolean;
  /** Refused for permission reasons. */
  denied?: boolean;
  /** A `pts` op arrived ahead of the points we have: ask the owner to resend from `have`. */
  gap?: { id: string; have: number };
}
const NO: ApplyResult = { changed: false };
const DENIED: ApplyResult = { changed: false, denied: true };

const STUDENT_KINDS: ElKind[] = ["stroke", "shape", "text", "sticky"];
const IMMUTABLE: (keyof El)[] = ["id", "k", "own", "by", "cid"];

/** What `patch` may change: never identity or ownership. */
function cleanPatch(patch: Partial<El>): Partial<El> {
  const out: Partial<El> = { ...patch };
  for (const k of IMMUTABLE) delete out[k];
  delete out.url;
  return out;
}

const mayEdit = (s: BoardState, who: Sender, e: El) => who.tutor || (mayWrite(s.perm, who) && e.own === who.own && isStudentKey(who.own));

export function applyOp(s: BoardState, op: Op, who: Sender): ApplyResult {
  switch (op.op) {
    case "reset": {
      if (!who.tutor) return DENIED;
      const fresh = newState();
      s.pages = fresh.pages; s.cleared = {}; s.dead = {};
      return { changed: true };
    }
    case "pages": {
      if (!who.tutor) return DENIED;
      const keep = new Map(s.pages.map((p) => [p.id, p]));
      const list = op.pages.slice(0, MAX_PAGES);
      if (!list.length) return NO;
      s.pages = list.map((p) => { const cur = keep.get(p.id); return cur ? (cur.bg = p.bg, cur) : { id: p.id, bg: p.bg, els: new Map() }; });
      return { changed: true };
    }
    case "padd": {
      if (!who.tutor) return DENIED;
      if (pageOf(s, op.id) || s.pages.length >= MAX_PAGES) return NO;
      s.pages.push({ id: op.id, bg: op.bg, els: new Map() });
      return { changed: true };
    }
    case "pdel": {
      if (!who.tutor) return DENIED;
      if (s.pages.length <= 1) return NO;
      const i = s.pages.findIndex((p) => p.id === op.id);
      if (i < 0) return NO;
      s.pages.splice(i, 1);
      return { changed: true };
    }
    case "perm": {
      if (!who.tutor) return DENIED;
      const ids = [...new Set(op.ids)].slice(0, 60);
      if (s.perm.all === op.all && s.perm.ids.length === ids.length && s.perm.ids.every((i) => ids.includes(i))) return NO;
      s.perm = { all: op.all, ids };
      return { changed: true };
    }
    case "bg": {
      if (!who.tutor) return DENIED;
      const p = pageOf(s, op.page);
      if (!p || p.bg === op.bg) return NO;
      p.bg = op.bg;
      return { changed: true };
    }
    case "clear": {
      if (!who.tutor) return DENIED;
      const p = pageOf(s, op.page);
      if (!p) return NO;
      s.cleared[p.id] = Math.max(s.cleared[p.id] ?? 0, op.v);
      const had = p.els.size;
      for (const id of p.els.keys()) s.dead[id] = Math.max(s.dead[id] ?? 0, op.v);
      p.els.clear();
      return { changed: had > 0 };
    }
    case "add": {
      const p = pageOf(s, op.page);
      if (!p) return NO;
      let el = op.el;
      if (!who.tutor) {
        if (!mayWrite(s.perm, who) || !isStudentKey(who.own) || !STUDENT_KINDS.includes(el.k)) return DENIED;
        // A student's element is always stamped as THEIRS, whatever the message claims.
        el = { ...el, own: who.own, by: who.by, cid: who.cid };
      }
      if (p.els.has(el.id)) return NO; // duplicate delivery
      if ((s.dead[el.id] ?? 0) >= el.v) return NO; // deleted (or cleared) after this was made
      if (el.v < (s.cleared[p.id] ?? 0)) return NO; // made before a clear that has already happened
      if (p.els.size >= MAX_ELS_PER_PAGE) return NO;
      if (el.pts && el.pts.length > MAX_PTS * PT) el = { ...el, pts: el.pts.slice(0, MAX_PTS * PT) };
      p.els.set(el.id, { ...el });
      return { changed: true };
    }
    case "pts": {
      const p = pageOf(s, op.page);
      const e = p?.els.get(op.id);
      if (!p || !e || e.k !== "stroke") return NO;
      if (!mayEdit(s, who, e) && !(who.tutor)) return DENIED;
      const cur = (e.pts ??= []);
      const have = cur.length / PT;
      if (op.from > have) return { changed: false, gap: { id: op.id, have } };
      const skip = (have - op.from) * PT;
      if (skip >= op.pts.length) return NO;
      const add = op.pts.slice(skip);
      if (cur.length + add.length > MAX_PTS * PT) return NO;
      for (const n of add) cur.push(n);
      return { changed: true };
    }
    case "upd": {
      const p = pageOf(s, op.page);
      const e = p?.els.get(op.id);
      if (!p || !e) return NO;
      if (!mayEdit(s, who, e)) return DENIED;
      if (op.v < e.v) return NO; // an older write loses
      // A `null` (or undefined) value CLEARS the field — that is how an undo restores "this was never set" across the wire (JSON drops undefined).
      // `fill` is the one field where null is a real value ("no fill").
      const clean = cleanPatch(op.patch) as Record<string, unknown>, tgt = e as unknown as Record<string, unknown>;
      for (const k of Object.keys(clean)) { const val = clean[k]; if ((val === null && k !== "fill") || val === undefined) delete tgt[k]; else tgt[k] = val; }
      e.v = op.v;
      return { changed: true };
    }
    case "del": {
      const p = pageOf(s, op.page);
      if (!p) return NO;
      let changed = false, denied = false;
      for (const id of op.ids) {
        const e = p.els.get(id);
        if (!e) { s.dead[id] = Math.max(s.dead[id] ?? 0, op.v); continue; }
        if (!mayEdit(s, who, e)) { denied = true; continue; }
        p.els.delete(id);
        s.dead[id] = Math.max(s.dead[id] ?? 0, op.v);
        changed = true;
      }
      return { changed, denied: denied && !changed };
    }
  }
}

/** Apply a list of ops; returns the gaps seen (each id once). */
export function applyAll(s: BoardState, ops: Op[], who: Sender): { changed: boolean; gaps: { id: string; have: number }[]; denied: number } {
  let changed = false, denied = 0;
  const gaps = new Map<string, { id: string; have: number }>();
  for (const op of ops) {
    const r = applyOp(s, op, who);
    if (r.changed) changed = true;
    if (r.denied) denied++;
    if (r.gap) gaps.set(r.gap.id, r.gap);
  }
  return { changed, gaps: [...gaps.values()], denied };
}

// ── whole board → messages (late joiners) ──
/** Points per message slice while syncing. */
export const SLICE_PTS = 110;

/** One element as ops: `add` with the first slice of points, then `pts` for the rest. */
export function elementOps(page: string, el: El, slice = SLICE_PTS): Op[] {
  if (el.k !== "stroke" || !el.pts || el.pts.length / PT <= slice) return [{ op: "add", page, el }];
  const first = el.pts.slice(0, slice * PT);
  const out: Op[] = [{ op: "add", page, el: { ...el, pts: first } }];
  for (let i = slice; i * PT < el.pts.length; i += slice) out.push({ op: "pts", page, id: el.id, from: i, pts: el.pts.slice(i * PT, (i + slice) * PT) });
  return out;
}

/** Everything a new participant needs, as ops (starting with a reset). */
export function snapshotOps(s: BoardState): Op[] {
  const ops: Op[] = [{ op: "reset" }, { op: "pages", pages: s.pages.map((p) => ({ id: p.id, bg: p.bg })) }, { op: "perm", all: s.perm.all, ids: s.perm.ids }];
  for (const p of s.pages) for (const el of sorted(p)) ops.push(...elementOps(p.id, { ...el, url: el.url }));
  return ops;
}

export const MSG_BYTES = 3200; // Daily allows ~4 KB per app message: stay well under
/** Group ops into messages that each serialise under `max` bytes. */
export function packOps(ops: Op[], max = MSG_BYTES): Op[][] {
  const out: Op[][] = [];
  let cur: Op[] = [], size = 20;
  for (const op of ops) {
    const n = JSON.stringify(op).length + 1;
    if (cur.length && size + n > max) { out.push(cur); cur = []; size = 20; }
    cur.push(op); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

// ── undo / redo (per user, local) ──
export type Action =
  | { t: "add"; page: string; els: El[] }
  | { t: "del"; page: string; els: El[] }
  | { t: "upd"; page: string; id: string; before: Partial<El>; after: Partial<El> }
  | { t: "clear"; page: string; els: El[] }
  | { t: "bg"; page: string; before: BgKind; after: BgKind }
  | { t: "group"; a: Action[] };

const invert = (a: Action): Action => {
  switch (a.t) {
    case "add": return { t: "del", page: a.page, els: a.els };
    case "del": return { t: "add", page: a.page, els: a.els };
    case "clear": return { t: "add", page: a.page, els: a.els };
    case "upd": return { ...a, before: a.after, after: a.before };
    case "bg": return { ...a, before: a.after, after: a.before };
    case "group": return { t: "group", a: [...a.a].reverse().map(invert) };
  }
};
/** Fields the patch sets to `undefined` become `null` so they survive JSON and clear the field on every peer. */
export const nullify = (p: Partial<El>): Partial<El> => { const o: Record<string, unknown> = { ...p }; for (const k of Object.keys(o)) if (o[k] === undefined) o[k] = null; return o as Partial<El>; };
/** The ops that carry out an action — re-added elements get a fresh version so they beat their tombstone. */
export function actionOps(a: Action, v = reserveV(a.t === "add" ? a.els.length : a.t === "group" ? a.a.length * 100 : 1)): Op[] {
  switch (a.t) {
    case "add": return a.els.flatMap((e, i) => elementOps(a.page, { ...e, v: v + i }));
    case "del": return [{ op: "del", page: a.page, ids: a.els.map((e) => e.id), v }];
    case "clear": return [{ op: "clear", page: a.page, v }];
    case "upd": return [{ op: "upd", page: a.page, id: a.id, patch: nullify(a.after), v }];
    case "bg": return [{ op: "bg", page: a.page, bg: a.after, v }];
    case "group": return a.a.flatMap((x, i) => actionOps(x, v + i * 100));
  }
}

export class History {
  private undoS: Action[] = [];
  private redoS: Action[] = [];
  constructor(private cap = 200) {}
  push(a: Action) { this.undoS.push(a); if (this.undoS.length > this.cap) this.undoS.shift(); this.redoS = []; }
  get canUndo() { return this.undoS.length > 0; }
  get canRedo() { return this.redoS.length > 0; }
  /** The action to APPLY to undo the last one (and remember it for redo). */
  undo(): Action | null { const a = this.undoS.pop(); if (!a) return null; this.redoS.push(a); return invert(a); }
  redo(): Action | null { const a = this.redoS.pop(); if (!a) return null; this.undoS.push(a); return a; }
  clear() { this.undoS = []; this.redoS = []; }
}
