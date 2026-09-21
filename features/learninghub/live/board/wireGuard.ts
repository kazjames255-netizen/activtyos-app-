import { BG_KINDS, MAX_PAGES, MAX_PTS, PT, type BgKind, type BoardState, type El, type Op } from "./model";

// Everything that arrives over the call is UNTRUSTED: any participant can send any
// JSON. This module is the gate between the wire and the reducer / the pad layer:
//   • sanitizeOps / sanitizeNeed / sanitizePtr — drop or clip malformed input, using the SAME limits as the
//     server's board schema (server/src/routes/hub/boardsApi.ts), so a peer can never put an element on
//     the tutor's board that makes the autosave fail, and can never crash / hang a receiver.
//   • packBytes — group ops into messages by UTF-8 BYTES (Daily's limit is bytes; CJK text is 3 bytes/char).
//   • boardDigest — a tiny order-independent fingerprint of a board, so a peer can notice it has drifted.
// Pure TypeScript (no React / DOM) so it is self-tested with `npx tsx`.

/** The limits — keep in step with `element` in boardsApi.ts. */
export const LIM = { id: 60, page: 40, own: 120, by: 40, cid: 100, colour: 40, text: 2000, grp: 40, imageId: 100, coord: 1e6, url: 1600, optStr: 4000, optKey: 20, optKeys: 24 } as const;
export const MAX_OPS_PER_MESSAGE = 400;
const MAX_IDS_PER_DEL = 400;
const MAX_PTS_PER_OP = 600; // points in ONE pts op (a normal slice is 110)

const BG: BgKind[] = BG_KINDS;
const KINDS = ["stroke", "shape", "text", "sticky", "image", "stamp"];
const SHAPES = ["line", "arrow", "darrow", "rect", "ellipse", "triangle", "diamond", "rtriangle", "pentagon", "hexagon", "star", "heart", "bubble", "ngon", "parallelogram", "trapezium", "kite"];
const STY = ["dash", "neon", "rainbow"];

const NULLABLE = ["c", "w", "h", "hl", "sty", "x", "y", "x1", "y1", "x2", "y2", "text", "size", "bold", "imageId", "stamp", "grp", "rot", "dash", "opts", "tc", "al", "va", "ph", "cell", "fa", "ns", "n", "ap", "lock", "ah", "fr", "to", "shape"];
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown, max: number, min = 0): string | null => (typeof x === "string" && x.length >= min ? x.slice(0, max) : null);
/** A string that must fit as-is (an id): too long → null (clipping would change its identity). */
const exact = (x: unknown, max: number): string | null => (typeof x === "string" && x.length >= 1 && x.length <= max ? x : null);
const coord = (x: unknown): number | null => (fin(x) ? Math.max(-LIM.coord, Math.min(LIM.coord, x)) : null);
const bgOf = (x: unknown): BgKind | null => (typeof x === "string" && (BG as string[]).includes(x) ? (x as BgKind) : null);

function cleanPts(x: unknown, maxPts: number): number[] | null {
  if (!Array.isArray(x)) return null;
  const n = Math.min(x.length - (x.length % PT), maxPts * PT);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) { const c = coord(x[i]); if (c === null) return null; out[i] = c; }
  return out;
}

/** Clean the fields of an element (or of an `upd` patch: `partial`). Unknown keys are dropped. Returns null when unusable. */
export function cleanEl(raw: unknown, o: { partial?: boolean; allowUrl?: boolean } = {}): El | Partial<El> | null {
  if (!isObj(raw)) return null;
  const e: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== null && v !== undefined) e[k] = v; };
  if (!o.partial) {
    const id = exact(raw.id, LIM.id), own = exact(raw.own, LIM.own);
    if (!id || !own || typeof raw.k !== "string" || !KINDS.includes(raw.k) || !fin(raw.z) || !fin(raw.v)) return null;
    e.id = id; e.own = own; e.k = raw.k; e.z = raw.z; e.v = raw.v;
    const by = str(raw.by, LIM.by); if (by) e.by = by;
    const cid = exact(raw.cid, LIM.cid); if (cid) e.cid = cid; // an over-long cid is dropped, the element survives
  }
  if (fin(raw.z) && o.partial) e.z = raw.z;
  set("c", str(raw.c, LIM.colour, 1));
  for (const k of ["w", "h", "size", "rot"]) if (fin(raw[k])) e[k] = raw[k];
  for (const k of ["x", "y", "x1", "y1", "x2", "y2"]) set(k, coord(raw[k]));
  for (const k of ["hl", "bold", "dash"]) if (typeof raw[k] === "boolean") e[k] = raw[k];
  if (typeof raw.sty === "string" && STY.includes(raw.sty)) e.sty = raw.sty;
  if (typeof raw.shape === "string" && SHAPES.includes(raw.shape)) e.shape = raw.shape;
  if (raw.fill === null) e.fill = null; else set("fill", str(raw.fill, LIM.colour));
  set("text", str(raw.text, LIM.text));
  set("imageId", exact(raw.imageId, LIM.imageId));
  if (typeof raw.stamp === "string" && /^[a-z]{2,20}$/.test(raw.stamp)) e.stamp = raw.stamp;
  set("grp", str(raw.grp, LIM.grp, 1));
  // typeable cells / shape labels / looks (board editing core — keep in step with `element` in boardsApi.ts and El in model.ts)
  set("tc", str(raw.tc, LIM.colour, 1)); set("ph", str(raw.ph, 120)); set("fr", str(raw.fr, LIM.id, 1)); set("to", str(raw.to, LIM.id, 1));
  if (typeof raw.al === "string" && ["l", "c", "r"].includes(raw.al)) e.al = raw.al;
  if (typeof raw.va === "string" && ["t", "m", "b"].includes(raw.va)) e.va = raw.va;
  if (typeof raw.ah === "string" && ["none", "open", "filled", "dot"].includes(raw.ah)) e.ah = raw.ah;
  for (const k of ["cell", "ns", "lock"]) if (typeof raw[k] === "boolean") e[k] = raw[k];
  if (fin(raw.fa)) e.fa = Math.max(0, Math.min(1, raw.fa));
  if (fin(raw.n)) e.n = Math.max(3, Math.min(12, raw.n));
  if (fin(raw.ap)) e.ap = Math.max(-2, Math.min(3, raw.ap));
  // In an `upd` patch, null CLEARS a field (that is how an undo restores "never set" on every peer; `fill` keeps null as its real "no fill").
  if (o.partial) for (const k of NULLABLE) if (raw[k] === null) e[k] = null;
  if (raw.pts !== undefined) {
    const p = cleanPts(raw.pts, MAX_PTS);
    if (!p) { if (!o.partial) return null; } else e.pts = p;
  }
  if (o.allowUrl && typeof raw.url === "string" && /^https?:\/\//.test(raw.url) && raw.url.length <= LIM.url) e.url = raw.url;
  if (isObj(raw.opts)) {
    const opts: Record<string, number | string | boolean> = {};
    let n = 0;
    for (const [k, v] of Object.entries(raw.opts)) {
      if (n >= LIM.optKeys || k.length > LIM.optKey) continue;
      if (fin(v) || typeof v === "boolean") opts[k] = v; else if (typeof v === "string" && v.length <= LIM.optStr) opts[k] = v; else continue;
      n++;
    }
    e.opts = opts;
  }
  return e as unknown as El;
}

/** Everything one message may carry. `who.tutor`: a tutor's picture links (signed urls) are kept; a student's are dropped. */
export function sanitizeOps(raw: unknown, who: { tutor: boolean }): Op[] {
  if (!Array.isArray(raw)) return [];
  const out: Op[] = [];
  for (const r of raw.slice(0, MAX_OPS_PER_MESSAGE)) {
    const op = sanitizeOp(r, who);
    if (op) out.push(op);
  }
  return out;
}

function sanitizeOp(r: unknown, who: { tutor: boolean }): Op | null {
  if (!isObj(r) || typeof r.op !== "string") return null;
  switch (r.op) {
    case "add": {
      const page = exact(r.page, LIM.page), el = cleanEl(r.el, { allowUrl: who.tutor });
      return page && el ? { op: "add", page, el: el as El } : null;
    }
    case "pts": {
      const page = exact(r.page, LIM.page), id = exact(r.id, LIM.id), pts = cleanPts(r.pts, MAX_PTS_PER_OP);
      if (!page || !id || !pts || !pts.length || !fin(r.from) || r.from < 0 || r.from > MAX_PTS || !Number.isInteger(r.from)) return null;
      return { op: "pts", page, id, from: r.from, pts };
    }
    case "upd": {
      const page = exact(r.page, LIM.page), id = exact(r.id, LIM.id), patch = cleanEl(r.patch, { partial: true, allowUrl: who.tutor });
      return page && id && patch && fin(r.v) ? { op: "upd", page, id, patch, v: r.v } : null;
    }
    case "del": {
      const page = exact(r.page, LIM.page);
      if (!page || !Array.isArray(r.ids) || !fin(r.v)) return null;
      const ids = r.ids.slice(0, MAX_IDS_PER_DEL).filter((i): i is string => typeof i === "string" && i.length >= 1 && i.length <= LIM.id);
      return ids.length ? { op: "del", page, ids, v: r.v } : null;
    }
    case "clear": { const page = exact(r.page, LIM.page); return page && fin(r.v) ? { op: "clear", page, v: r.v } : null; }
    case "bg": { const page = exact(r.page, LIM.page), bg = bgOf(r.bg); return page && bg && fin(r.v) ? { op: "bg", page, bg, v: r.v } : null; }
    case "padd": { const id = exact(r.id, LIM.page), bg = bgOf(r.bg); return id && bg ? { op: "padd", id, bg } : null; }
    case "pdel": { const id = exact(r.id, LIM.page); return id ? { op: "pdel", id } : null; }
    case "pages": {
      if (!Array.isArray(r.pages)) return null;
      const pages: { id: string; bg: BgKind }[] = [];
      for (const p of r.pages.slice(0, MAX_PAGES)) { if (!isObj(p)) continue; const id = exact(p.id, LIM.page), bg = bgOf(p.bg); if (id && bg && !pages.some((x) => x.id === id)) pages.push({ id, bg }); }
      return pages.length ? { op: "pages", pages } : null;
    }
    case "perm": {
      if (typeof r.all !== "boolean" || !Array.isArray(r.ids)) return null;
      return { op: "perm", all: r.all, ids: r.ids.slice(0, 60).filter((i): i is string => typeof i === "string" && i.length >= 1 && i.length <= LIM.cid) };
    }
    case "reset": return { op: "reset" };
    default: return null;
  }
}

/** A peer's "resend me this stroke from point N". `have` is clamped to what the stroke really has. */
export function sanitizeNeed(raw: unknown): { page: string; id: string; have: number } | null {
  if (!isObj(raw)) return null;
  const page = exact(raw.page, LIM.page), id = exact(raw.id, LIM.id);
  if (!page || !id || !fin(raw.have)) return null;
  return { page, id, have: Math.max(0, Math.min(MAX_PTS, Math.floor(raw.have))) };
}

export interface Ptr { page: string; x: number; y: number; laser: boolean; col: string }
export function sanitizePtr(raw: unknown): Ptr | null {
  if (!isObj(raw)) return null;
  const page = exact(raw.page, LIM.page), x = coord(raw.x), y = coord(raw.y);
  if (!page || x === null || y === null) return null;
  const col = typeof raw.col === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.col) ? raw.col : "#2f6bd8";
  return { page, x, y, laser: raw.laser === true, col };
}

export function sanitizeHello(raw: unknown): { name: string } | null {
  if (!isObj(raw)) return null;
  return { name: (typeof raw.name === "string" ? raw.name : "").trim().slice(0, LIM.by) };
}

export function sanitizePage(raw: unknown): string | null { return exact(raw, LIM.page); }

// ── sizes ──
const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
/** UTF-8 byte length of a string. */
export function byteLen(s: string): number {
  if (enc) return enc.encode(s).length;
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c < 0xdc00 ? (i++, 4) : 3; }
  return n;
}
export const opBytes = (op: Op) => byteLen(JSON.stringify(op)) + 1;

/** Shrink an op's text until it fits `max` bytes (returns null when it can't be made to fit). */
function fitOp(op: Op, max: number): Op | null {
  if (opBytes(op) <= max) return op;
  const shrink = <T extends { text?: string }>(o: T, build: (text: string) => Op): Op | null => {
    let t = o.text ?? "";
    while (t.length > 1) { t = t.slice(0, Math.max(1, Math.floor(t.length * 0.85))); const c = build(t); if (opBytes(c) <= max) return c; }
    return null;
  };
  if (op.op === "add" && typeof op.el.text === "string") return shrink(op.el, (text) => ({ ...op, el: { ...op.el, text } }));
  if (op.op === "upd" && typeof op.patch.text === "string") return shrink(op.patch, (text) => ({ ...op, patch: { ...op.patch, text } }));
  return null;
}

/** Group ops into messages that each serialise under `max` UTF-8 bytes. An op that cannot fit alone is clipped (text) or dropped, and counted. */
export function packBytes(ops: Op[], max: number): { packs: Op[][]; clipped: number; dropped: number } {
  const packs: Op[][] = [];
  let cur: Op[] = [], size = 20, clipped = 0, dropped = 0;
  for (const raw of ops) {
    const op = fitOp(raw, max - 20);
    if (!op) { dropped++; continue; }
    if (op !== raw) clipped++;
    const n = opBytes(op);
    if (cur.length && size + n > max) { packs.push(cur); cur = []; size = 20; }
    cur.push(op); size += n;
  }
  if (cur.length) packs.push(cur);
  return { packs, clipped, dropped };
}

// ── digest ──
function h32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** An order-independent fingerprint of the board: pages (id + background), permission, and every element's id / version / point count. */
export function boardDigest(s: BoardState): { n: number; h: number } {
  let n = 0, h = 0;
  for (const p of s.pages) {
    h = (h + h32(`P${p.id}:${p.bg}`)) >>> 0;
    for (const e of p.els.values()) { n++; h = (h + h32(`${p.id}/${e.id}:${e.v}:${e.pts ? e.pts.length : 0}`)) >>> 0; }
  }
  h = (h + h32(`perm:${s.perm.all ? 1 : 0}:${[...s.perm.ids].sort().join(",")}`)) >>> 0;
  return { n, h };
}
