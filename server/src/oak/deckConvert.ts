// Oak's real slide decks → OUR editable "canvas" slides (owner decision 2026-09-21; see docs/oak-import.md "Real slide decks").
//
// Every Oak lesson has a public Google Slides deck (`presentationUrl`). Google exports any deck as a .pptx at
//   https://docs.google.com/presentation/d/<id>/export/pptx
// which is plain OOXML: slides are LAYOUTS — positioned text boxes + separate pictures (+ a few boxes / lines / tables), sitting on
// a layout and master that carry the coloured band, the lesson-cycle icon and the page background. This file turns one deck into
//
//   Slide { kind:"explain", title, blocks:[ { t:"canvas", w:720, h:405, bg?, els:[…] } ] }   (features/learninghub/lesson/slides/types.ts)
//
// one canvas block per slide, `els` in z-order (first = furthest back), every geometry a FRACTION of the slide (0..1) so the player
// scales it to any width, every font size in points on a 720pt-wide slide (the player turns them into `cqw`). Element kinds:
//   img   {x,y,w,h, sid (Storage key) | imageId (tutor upload) | picId (library), alt, crop?, rot?, flipH?, flipV?, step?}     one picture = one element = one hub image
//   text  {x,y,w,h, paras:[{runs:[{t,size,bold?,italic?,color?,f?}], algn?, lh?, before?, after?, bu?, ind?}], anchor?, pad?, rot?, step?}
//   shape {x,y,w,h, geom:"rect"|"round"|"ellipse"|"line", fill?, line?:{c,w}, r?, arrow?, rot?, flipH?, flipV?, step?}
// `step` = the click on which a PowerPoint "appear" animation reveals the element (1-based, absent = always there), `until` = the click
// on which an exit animation hides it again; the player's Next button reveals the next click before moving on, a tutor editing sees the
// final state (every click done). Tables are flattened into cell shapes + text; group transforms (incl. rotation)
// are baked into the children.
//
// Pure functions + one pluggable `putImage` (slideImages.ts putSlideImage); nothing here touches the network or Firestore.
import zlib from "node:zlib";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// ── Output types ─────────────────────────────────────────────────────────
export interface CRun { t: string; size: number; bold?: true; italic?: true; underline?: true; color?: string; f?: string; /** hyperlink (https only) */ link?: string }
/** `step` / `until`: a paragraph build ("by paragraph" animation) — this paragraph appears on that click / goes on that click. */
export interface CPara { runs: CRun[]; algn?: "c" | "r" | "j"; lh?: number; before?: number; after?: number; bu?: string; ind?: [number, number]; step?: number; until?: number }
interface CBase { x: number; y: number; w: number; h: number; rot?: number; step?: number; /** hidden again from this click on (an exit animation) */ until?: number;
  /** seconds after the click (or after the slide opens, with no `step`) that an "after previous" / auto-start animation begins */ delay?: number }
export interface CImg extends CBase { k: "img"; /** storage key (lib/slideStorage.ts) */ sid?: string; /** a tutor-uploaded hub image */ imageId?: string; alt: string; crop?: [number, number, number, number]; flipH?: true; flipV?: true }
export interface CText extends CBase { k: "text"; paras: CPara[]; anchor?: "m" | "b"; pad?: [number, number, number, number] }
export interface CShape extends CBase { k: "shape"; geom: "rect" | "round" | "ellipse" | "line"; fill?: string; line?: { c: string; w: number }; r?: number; arrow?: "start" | "end" | "both"; flipH?: true; flipV?: true }
export type CEl = CImg | CText | CShape;
export interface CanvasBlock { t: "canvas"; w: number; h: number; bg?: string; theme?: "original"; els: CEl[] }
export interface DeckSlide { kind: "explain"; title: string; blocks: [CanvasBlock] }

export interface ConvertStats { logosDropped: number; oakTextDropped: number; slidesTotal: number; slidesKept: number; dropped: { n: number; why: string }[]; images: { name: string; srcBytes: number; outBytes: number; width: number; height: number }[]; warnings: string[]; els: number }
export interface ConvertOpts {
  /** Store one already-shrunk picture; return its id. (slideImages.ts putSlideImage bound to a tenant, or a fake.) */
  putImage: (src: Buffer, sha1: string) => Promise<{ id: string; bytes: number; width: number; height: number; mime: string } | null>;
}

// ── Zip (read-only, central directory) ───────────────────────────────────
function openZip(buf: Buffer): (name: string) => Buffer | null {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip file");
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const ent = new Map<string, { method: number; start: number; csize: number }>();
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(lho + 26), lxl = buf.readUInt16LE(lho + 28);
    ent.set(name, { method, start: lho + 30 + lnl + lxl, csize });
    p += 46 + nl + xl + cl;
  }
  return (name) => {
    const z = ent.get(name);
    if (!z) return null;
    const raw = buf.subarray(z.start, z.start + z.csize);
    return z.method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
  };
}

// ── XML → small tree ─────────────────────────────────────────────────────
interface N { tag: string; a: Record<string, string>; c: N[]; text: string }
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true });
function build(arr: unknown[]): N[] {
  const out: N[] = [];
  for (const it of arr as Record<string, unknown>[]) {
    const tag = Object.keys(it).find((k) => k !== ":@");
    if (!tag || tag.startsWith("?")) continue;
    if (tag === "#text") { out.push({ tag, a: {}, c: [], text: String(it["#text"] ?? "") }); continue; }
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries((it[":@"] as Record<string, string>) ?? {})) attrs[k.replace(/^@_/, "")] = String(v);
    out.push({ tag, a: attrs, c: build((it[tag] as unknown[]) ?? []), text: "" });
  }
  return out;
}
const parseXml = (b: Buffer): N => build(parser.parse(b.toString("utf8")) as unknown[])[0]!;
const ch = (n: N | undefined, tag: string): N | undefined => n?.c.find((k) => k.tag === tag);
const chs = (n: N | undefined, tag: string): N[] => n?.c.filter((k) => k.tag === tag) ?? [];
const at = (n: N | undefined, ...tags: string[]): N | undefined => { let cur = n; for (const t of tags) cur = ch(cur, t); return cur; };
const textOf = (n: N): string => (n.tag === "#text" ? n.text : n.c.map(textOf).join(""));
const num = (v: string | undefined, d = 0): number => { const x = Number(v); return v !== undefined && v !== "" && Number.isFinite(x) ? x : d; };

// ── Relationships / paths ────────────────────────────────────────────────
function relsOf(zip: (n: string) => Buffer | null, part: string): Map<string, { type: string; target: string }> {
  const dir = part.slice(0, part.lastIndexOf("/") + 1), file = part.slice(part.lastIndexOf("/") + 1);
  const raw = zip(`${dir}_rels/${file}.rels`);
  const m = new Map<string, { type: string; target: string }>();
  if (!raw) return m;
  for (const r of parseXml(raw).c) {
    if (r.tag !== "Relationship") continue;
    let t = r.a.Target ?? "";
    if (r.a.TargetMode !== "External") {
      const parts = (t.startsWith("/") ? t.slice(1) : dir + t).split("/"), st: string[] = [];
      for (const s of parts) { if (s === "..") st.pop(); else if (s !== ".") st.push(s); }
      t = st.join("/");
    }
    m.set(r.a.Id ?? "", { type: (r.a.Type ?? "").split("/").pop() ?? "", target: t });
  }
  return m;
}

// ── Colours ──────────────────────────────────────────────────────────────
interface Theme { colors: Record<string, string> }
function readTheme(zip: (n: string) => Buffer | null, part: string): Theme {
  const raw = zip(part);
  const colors: Record<string, string> = {};
  if (raw) {
    const cs = at(parseXml(raw), "a:themeElements", "a:clrScheme");
    for (const c of cs?.c ?? []) {
      const v = c.c[0];
      const val = v?.tag === "a:sysClr" ? v.a.lastClr : v?.a.val;
      if (val && /^[0-9A-Fa-f]{6}$/.test(val)) colors[c.tag.replace("a:", "")] = `#${val.toLowerCase()}`;
    }
  }
  return { colors };
}
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const PRESET: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00", gray: "#808080", grey: "#808080" };
interface ClrCtx { th: Theme; map: Record<string, string> }
/** A `<a:solidFill>`-like node (or a bare colour element) → "#rrggbb" / "#rrggbbaa". */
function colorOf(fill: N | undefined, cx: ClrCtx): string | undefined {
  const el = fill && /Clr$/.test(fill.tag) ? fill : fill?.c.find((k) => /Clr$/.test(k.tag));
  if (!el) return undefined;
  let rgb: [number, number, number] | undefined;
  const v = el.a.val ?? "";
  if (el.tag === "a:srgbClr" && /^[0-9A-Fa-f]{6}$/.test(v)) rgb = [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  else {
    let h: string | undefined;
    if (el.tag === "a:sysClr") h = el.a.lastClr ? `#${el.a.lastClr}` : v === "window" ? "#ffffff" : "#000000";
    else if (el.tag === "a:prstClr") h = PRESET[v];
    else if (el.tag === "a:schemeClr") h = cx.th.colors[cx.map[v] ?? v] ?? cx.th.colors[v];
    if (!h || !/^#[0-9A-Fa-f]{6}$/.test(h)) return undefined;
    rgb = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  let alpha = 1;
  let [hh, ss, ll] = toHsl(...rgb);
  for (const m of el.c) {
    const p = num(m.a.val, 100000) / 100000;
    if (m.tag === "a:lumMod") ll *= p;
    else if (m.tag === "a:lumOff") ll += p;
    else if (m.tag === "a:satMod") ss *= p;
    else if (m.tag === "a:alpha") alpha = p;
    else if (m.tag === "a:tint") ll = ll + (1 - ll) * (1 - p);
    else if (m.tag === "a:shade") ll *= p;
  }
  rgb = fromHsl(hh, Math.max(0, Math.min(1, ss)), Math.max(0, Math.min(1, ll)));
  return `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}${alpha < 0.995 ? hex2(alpha * 255) : ""}`;
}

// ── Text properties (inheritance chain) ──────────────────────────────────
interface Props {
  algn?: string; marL?: number; indent?: number; lnPct?: number; lnPts?: number; bef?: number; befPct?: number; aft?: number; aftPct?: number;
  bu?: { kind: "none" } | { kind: "char"; ch: string } | { kind: "num"; type: string; start: number };
  sz?: number; b?: boolean; i?: boolean; u?: boolean; color?: string; font?: string;
}
const FONTS: [RegExp, string][] = [[/lexend/i, "lexend"], [/abeezee/i, "abeezee"], [/kalam/i, "kalam"]];
const fontKey = (face: string | undefined): string | undefined => (face ? FONTS.find(([re]) => re.test(face))?.[1] : undefined);

function readRPr(n: N | undefined, cx: ClrCtx): Props {
  const p: Props = {};
  if (!n) return p;
  if (n.a.sz) p.sz = num(n.a.sz) / 100;
  if (n.a.b !== undefined) p.b = n.a.b === "1" || n.a.b === "true";
  if (n.a.i !== undefined) p.i = n.a.i === "1" || n.a.i === "true";
  if (n.a.u !== undefined) p.u = n.a.u !== "none";
  const c = colorOf(ch(n, "a:solidFill"), cx);
  if (c) p.color = c;
  const lat = ch(n, "a:latin")?.a.typeface;
  if (lat) p.font = lat;
  return p;
}
function readPPr(n: N | undefined, cx: ClrCtx): Props {
  const p: Props = {};
  if (!n) return p;
  if (n.a.algn) p.algn = n.a.algn;
  if (n.a.marL !== undefined) p.marL = num(n.a.marL) / 12700;
  if (n.a.indent !== undefined) p.indent = num(n.a.indent) / 12700;
  const ln = ch(n, "a:lnSpc");
  if (ln) { const pc = ch(ln, "a:spcPct"), pt = ch(ln, "a:spcPts"); if (pc) p.lnPct = num(pc.a.val) / 100000; else if (pt) p.lnPts = num(pt.a.val) / 100; }
  const bef = ch(n, "a:spcBef"), aft = ch(n, "a:spcAft");
  if (bef) { const pt = ch(bef, "a:spcPts"), pc = ch(bef, "a:spcPct"); if (pt) p.bef = num(pt.a.val) / 100; else if (pc) p.befPct = num(pc.a.val) / 100000; }
  if (aft) { const pt = ch(aft, "a:spcPts"), pc = ch(aft, "a:spcPct"); if (pt) p.aft = num(pt.a.val) / 100; else if (pc) p.aftPct = num(pc.a.val) / 100000; }
  if (ch(n, "a:buNone")) p.bu = { kind: "none" };
  const bc = ch(n, "a:buChar");
  if (bc) p.bu = { kind: "char", ch: (bc.a.char ?? "•").slice(0, 2) };
  const ba = ch(n, "a:buAutoNum");
  if (ba) p.bu = { kind: "num", type: ba.a.type ?? "arabicPeriod", start: num(ba.a.startAt, 1) };
  Object.assign(p, readRPr(ch(n, "a:defRPr"), cx));
  return p;
}
const merge = (...ps: (Props | undefined)[]): Props => Object.assign({}, ...ps.filter(Boolean).map((p) => Object.fromEntries(Object.entries(p!).filter(([, v]) => v !== undefined))));
const lvlOf = (lst: N | undefined, lvl: number, cx: ClrCtx): Props => readPPr(ch(lst, `a:lvl${lvl + 1}pPr`), cx);

// ── Shapes: placeholders + inheritance ───────────────────────────────────
interface Part { tree: N; th: Theme; map: Record<string, string>; ph: N[]; master?: Part; layout?: Part; rels: Map<string, { type: string; target: string }>; path: string }
const phOf = (sp: N): { type: string; idx?: string } | null => { const p = at(sp, "p:nvSpPr", "p:nvPr", "p:ph"); return p ? { type: p.a.type ?? "obj", idx: p.a.idx } : null; };
const family = (t: string) => (t === "ctrTitle" || t === "title" ? "title" : t === "subTitle" || t === "body" || t === "obj" ? "body" : t);
function findPh(list: N[], ph: { type: string; idx?: string }): N | undefined {
  if (ph.idx !== undefined) { const byIdx = list.find((s) => phOf(s)?.idx === ph.idx && family(phOf(s)!.type) === family(ph.type)) ?? list.find((s) => phOf(s)?.idx === ph.idx); if (byIdx) return byIdx; }
  return list.find((s) => family(phOf(s)!.type) === family(ph.type));
}
const spTreeOf = (root: N) => at(root, "p:cSld", "p:spTree");
function collectPh(tree: N): N[] {
  const out: N[] = [];
  const walk = (n: N) => { for (const c of n.c) { if (c.tag === "p:sp" && phOf(c)) out.push(c); else if (c.tag === "p:grpSp") walk(c); } };
  const t = spTreeOf(tree);
  if (t) walk(t);
  return out;
}

interface Xfrm { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean }
function readXfrm(n: N | undefined): Xfrm | null {
  const off = ch(n, "a:off"), ext = ch(n, "a:ext");
  if (!n || !off || !ext) return null;
  return { x: num(off.a.x), y: num(off.a.y), w: num(ext.a.cx), h: num(ext.a.cy), rot: num(n.a.rot) / 60000, flipH: n.a.flipH === "1", flipV: n.a.flipV === "1" };
}
interface Frame { off: [number, number]; ext: [number, number]; chOff: [number, number]; chExt: [number, number]; rot: number }
interface Placed { x: number; y: number; w: number; h: number; rot: number; fs: number }
function place(xf: Xfrm, frames: Frame[]): Placed {
  let cx = xf.x + xf.w / 2, cy = xf.y + xf.h / 2, w = xf.w, h = xf.h, rot = xf.rot, fs = 1;
  for (const f of frames) {
    const sx = f.chExt[0] ? f.ext[0] / f.chExt[0] : 1, sy = f.chExt[1] ? f.ext[1] / f.chExt[1] : 1;
    let px = f.off[0] + (cx - f.chOff[0]) * sx, py = f.off[1] + (cy - f.chOff[1]) * sy;
    if (f.rot) {
      const gx = f.off[0] + f.ext[0] / 2, gy = f.off[1] + f.ext[1] / 2, a = (f.rot * Math.PI) / 180, dx = px - gx, dy = py - gy;
      px = gx + dx * Math.cos(a) - dy * Math.sin(a); py = gy + dx * Math.sin(a) + dy * Math.cos(a);
      rot += f.rot;
    }
    cx = px; cy = py; w *= sx; h *= sy; // (font sizes and line widths are NOT scaled by a group, as in PowerPoint / Slides)
  }
  rot = ((rot % 360) + 540) % 360 - 180;
  return { x: cx - w / 2, y: cy - h / 2, w, h, rot, fs };
}

// ── The converter ────────────────────────────────────────────────────────
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r1 = (v: number) => Math.round(v * 10) / 10;

interface Anim { step?: number; until?: number; delay?: number }
/** What a slide's animations say about one shape (spid). `paras`: paragraph builds (paragraph index → its click / exit click). */
interface ShapeAnim { step?: number; until?: number; delay?: number; paras?: Map<number, { step?: number; until?: number; delay?: number }> }
interface SlideCtx {
  W: number; H: number; cx: ClrCtx; part: Part; zip: (n: string) => Buffer | null; steps: Map<string, ShapeAnim>; opts: ConvertOpts; attribution: boolean; stats: ConvertStats; defaultText: N | undefined; masterStyles: N | undefined;
  imageCache: Map<string, { id: string } | null>;
}

async function pictureEl(pic: N, pl: Placed, part: Part, st: Anim, sc: SlideCtx): Promise<CImg | null> {
  const blip = at(pic, "p:blipFill", "a:blip");
  const rid = blip?.a["r:embed"];
  const target = rid ? part.rels.get(rid)?.target : undefined;
  if (!target) return null;
  const bytes = sc.zip(target);
  if (!bytes) { sc.stats.warnings.push(`missing media ${target}`); return null; }
  const sha = crypto.createHash("sha1").update(bytes).digest("hex");
  if (await isOakLogo(bytes, sha, pl.w, pl.h, sc.W)) { sc.stats.logosDropped++; return null; }
  let stored = sc.imageCache.get(sha);
  if (stored === undefined) {
    try {
      const r = await sc.opts.putImage(bytes, sha);
      stored = r ? { id: r.id } : null;
      if (r) sc.stats.images.push({ name: target.split("/").pop() ?? target, srcBytes: bytes.length, outBytes: r.bytes, width: r.width, height: r.height });
    } catch (e) { sc.stats.warnings.push(`image ${target}: ${e instanceof Error ? e.message : e}`); stored = null; }
    sc.imageCache.set(sha, stored);
  }
  if (!stored) return null;
  const src = at(pic, "p:blipFill", "a:srcRect");
  const cl = num(src?.a.l) / 100000, ct = num(src?.a.t) / 100000, cr = num(src?.a.r) / 100000, cb = num(src?.a.b) / 100000;
  const descr = (at(pic, "p:nvPicPr", "p:cNvPr")?.a.descr ?? "").trim().slice(0, 300);
  const el: CImg = { k: "img", x: r4(pl.x / sc.W), y: r4(pl.y / sc.H), w: r4(pl.w / sc.W), h: r4(pl.h / sc.H), sid: stored.id, alt: descr };
  const cp = (v: number) => Math.min(0.95, Math.max(0, v)); // PowerPoint uses NEGATIVE srcRect for padding; the canvas schema only takes 0..0.95
  if (cp(cl) || cp(ct) || cp(cr) || cp(cb)) el.crop = [r4(cp(cl)), r4(cp(ct)), r4(cp(cr)), r4(cp(cb))];
  if (pl.rot) el.rot = r1(pl.rot);
  const xf = ch(at(pic, "p:spPr"), "a:xfrm");
  if (xf?.a.flipH === "1") el.flipH = true;
  if (xf?.a.flipV === "1") el.flipV = true;
  if (st.step) el.step = st.step;
  if (st.until) el.until = st.until;
  if (st.delay) el.delay = st.delay;
  return el;
}

function fillOf(spPr: N | undefined, cx: ClrCtx): string | null | undefined {
  if (!spPr) return undefined;
  if (ch(spPr, "a:noFill")) return null;
  const s = ch(spPr, "a:solidFill");
  if (s) return colorOf(s, cx) ?? null;
  const g = ch(spPr, "a:gradFill");
  if (g) return colorOf(at(g, "a:gsLst")?.c[0], cx) ?? null;
  return undefined;
}
function lineOf(ln: N | undefined, cx: ClrCtx): { c: string; w: number } | null | undefined {
  if (!ln) return undefined;
  if (ch(ln, "a:noFill")) return null;
  const s = ch(ln, "a:solidFill");
  if (!s) return undefined;
  const c = colorOf(s, cx);
  return c ? { c, w: r1(Math.max(0.25, num(ln.a.w, 9525) / 12700)) } : null;
}

/** The paragraphs of a text body, with the full style inheritance applied. Returns [] when there is no visible text. */
function paragraphs(body: N, chain: (N | undefined)[], baseProps: Props, fontScale: number, gs: number, sc: SlideCtx, rels?: Map<string, { type: string; target: string }>): CPara[] {
  const out: CPara[] = [];
  let numCount = 0, numType = "";
  for (const p of chs(body, "a:p")) {
    const pPr = ch(p, "a:pPr");
    const lvl = Math.max(0, Math.min(8, num(pPr?.a.lvl, 0)));
    const pp = merge(baseProps, ...chain.map((l) => lvlOf(l, lvl, sc.cx)), readPPr(pPr, sc.cx));
    const size0 = pp.sz ?? 18;
    const runs: CRun[] = [];
    const push = (t: string, rPr: N | undefined) => {
      if (t === "") return;
      const rp = merge(pp, readRPr(rPr, sc.cx));
      const run: CRun = { t, size: r1((rp.sz ?? size0) * fontScale * gs) };
      const hl = rels ? rels.get(ch(rPr, "a:hlinkClick")?.a["r:id"] ?? "") : undefined;
      if (hl && /^https:\/\//i.test(hl.target) && hl.target.length <= 400) run.link = hl.target;
      if (rp.b) run.bold = true;
      if (rp.i) run.italic = true;
      if (rp.u) run.underline = true;
      if (rp.color && rp.color !== "#000000") run.color = rp.color;
      const f = fontKey(rp.font); if (f) run.f = f;
      const last = runs[runs.length - 1];
      if (last && last.size === run.size && !last.bold === !run.bold && !last.italic === !run.italic && !last.underline === !run.underline && last.color === run.color && last.f === run.f && last.link === run.link) last.t += t;
      else runs.push(run);
    };
    for (const r of p.c) {
      if (r.tag === "a:r" || r.tag === "a:fld") push(textOf(ch(r, "a:t") ?? { tag: "x", a: {}, c: [], text: "" }), ch(r, "a:rPr"));
      else if (r.tag === "a:br") push("\n", ch(r, "a:rPr"));
    }
    const para: CPara = { runs };
    if (!runs.length) {
      const e = merge(pp, readRPr(ch(p, "a:endParaRPr"), sc.cx));
      para.runs = [{ t: "", size: r1((e.sz ?? size0) * fontScale * gs) }];
    }
    if (pp.algn === "ctr") para.algn = "c"; else if (pp.algn === "r") para.algn = "r"; else if (pp.algn === "just") para.algn = "j";
    const lh = pp.lnPts !== undefined ? pp.lnPts / (size0 * 1.2) : pp.lnPct;
    if (lh && Math.abs(lh - 1) > 0.02) para.lh = r4(lh);
    const bef = pp.bef ?? (pp.befPct ? pp.befPct * size0 : 0), aft = pp.aft ?? (pp.aftPct ? pp.aftPct * size0 : 0);
    if (bef) para.before = r1(bef * gs);
    if (aft) para.after = r1(aft * gs);
    const bu = pp.bu;
    if (bu?.kind === "char") para.bu = bu.ch;
    else if (bu?.kind === "num") {
      if (numType !== bu.type) { numType = bu.type; numCount = 0; }
      numCount++;
      const n = bu.start + numCount - 1;
      para.bu = bu.type.startsWith("alpha") ? `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}${bu.type.endsWith("ParenR") ? ")" : "."}` : `${n}${bu.type.endsWith("ParenR") ? ")" : "."}`;
    }
    if (bu?.kind !== "num") { numType = ""; numCount = 0; }
    if ((para.bu || (pp.marL ?? 0) || (pp.indent ?? 0))) { const ml = r1((pp.marL ?? 0) * gs), id = r1((pp.indent ?? 0) * gs); if (ml || id) para.ind = [ml, id]; }
    out.push(para);
  }
  while (out.length && out[out.length - 1]!.runs.every((r) => r.t.trim() === "")) out.pop();
  return out.some((p) => p.runs.some((r) => r.t.trim() !== "")) ? out : [];
}

function textEl(paras: CPara[], pl: Placed, bodyPr: Props2, st: Anim, sc: SlideCtx): CText {
  const el: CText = { k: "text", x: r4(pl.x / sc.W), y: r4(pl.y / sc.H), w: r4(pl.w / sc.W), h: r4(pl.h / sc.H), paras };
  if (bodyPr.anchor === "ctr") el.anchor = "m"; else if (bodyPr.anchor === "b") el.anchor = "b";
  const pad: [number, number, number, number] = [r1(bodyPr.l * pl.fs), r1(bodyPr.t * pl.fs), r1(bodyPr.r * pl.fs), r1(bodyPr.b * pl.fs)];
  if (pad.some((v) => v)) el.pad = pad;
  if (pl.rot) el.rot = r1(pl.rot);
  if (st.step) el.step = st.step;
  if (st.until) el.until = st.until;
  if (st.delay) el.delay = st.delay;
  return el;
}
interface Props2 { anchor: string; l: number; t: number; r: number; b: number; fontScale: number }
function bodyProps(chainBodies: (N | undefined)[]): Props2 {
  const m: Record<string, string> = {};
  let fontScale = 1;
  for (const b of chainBodies) {
    if (!b) continue;
    Object.assign(m, b.a);
    const na = ch(b, "a:normAutofit");
    if (na?.a.fontScale) fontScale = num(na.a.fontScale) / 100000;
  }
  return { anchor: m.anchor ?? "t", l: num(m.lIns, 91440) / 12700, t: num(m.tIns, 45720) / 12700, r: num(m.rIns, 91440) / 12700, b: num(m.bIns, 45720) / 12700, fontScale };
}

function shapeEl(geom: CShape["geom"], pl: Placed, o: { fill?: string; line?: { c: string; w: number }; r?: number; arrow?: CShape["arrow"]; flipH?: boolean; flipV?: boolean }, st: Anim, sc: SlideCtx): CShape {
  const el: CShape = { k: "shape", x: r4(pl.x / sc.W), y: r4(pl.y / sc.H), w: r4(pl.w / sc.W), h: r4(pl.h / sc.H), geom };
  if (o.fill) el.fill = o.fill;
  if (o.line) el.line = { c: o.line.c, w: r1(o.line.w * pl.fs) };
  if (o.r) el.r = r4(o.r);
  if (o.arrow) el.arrow = o.arrow;
  if (o.flipH) el.flipH = true;
  if (o.flipV) el.flipV = true;
  if (pl.rot) el.rot = r1(pl.rot);
  if (st.step) el.step = st.step;
  if (st.until) el.until = st.until;
  if (st.delay) el.delay = st.delay;
  return el;
}

/** Walk a shape tree (spTree or grpSp) appending elements in z-order. `deco` = layout/master content (no placeholders drawn). */
async function walk(nodes: N[], frames: Frame[], inheritStep: Anim | undefined, deco: boolean, sc: SlideCtx, part: Part, out: CEl[]): Promise<void> {
  for (const n of nodes) {
    const cNv = at(n, "p:nvSpPr", "p:cNvPr") ?? at(n, "p:nvPicPr", "p:cNvPr") ?? at(n, "p:nvCxnSpPr", "p:cNvPr") ?? at(n, "p:nvGraphicFramePr", "p:cNvPr") ?? at(n, "p:nvGrpSpPr", "p:cNvPr");
    if (cNv?.a.hidden === "1") continue;
    const anim = cNv?.a.id ? sc.steps.get(cNv.a.id) : undefined;
    const step = anim?.step ?? inheritStep?.step;
    const until = anim?.until ?? inheritStep?.until;
    const delay = anim?.delay ?? inheritStep?.delay;
    const st: Anim = { step, until, delay };
    if (n.tag === "p:grpSp") {
      const gx = ch(at(n, "p:grpSpPr"), "a:xfrm");
      const off = ch(gx, "a:off"), ext = ch(gx, "a:ext"), co = ch(gx, "a:chOff"), ce = ch(gx, "a:chExt");
      const fr: Frame = { off: [num(off?.a.x), num(off?.a.y)], ext: [num(ext?.a.cx), num(ext?.a.cy)], chOff: [num(co?.a.x), num(co?.a.y)], chExt: [num(ce?.a.cx), num(ce?.a.cy)], rot: num(gx?.a.rot) / 60000 };
      await walk(n.c, [fr, ...frames], st, deco, sc, part, out);
      continue;
    }
    if (n.tag === "p:pic") {
      const xf = readXfrm(at(n, "p:spPr", "a:xfrm"));
      if (!xf) continue;
      const el = await pictureEl(n, place(xf, frames), part, st, sc);
      if (el) out.push(el);
      continue;
    }
    if (n.tag === "p:cxnSp") {
      const spPr = at(n, "p:spPr");
      const xf = readXfrm(ch(spPr, "a:xfrm"));
      if (!xf) continue;
      const ln = lineOf(ch(spPr, "a:ln"), sc.cx);
      if (!ln) continue;
      const lnN = ch(spPr, "a:ln");
      const head = ch(lnN, "a:headEnd")?.a.type ?? "none", tail = ch(lnN, "a:tailEnd")?.a.type ?? "none";
      const arrow = head !== "none" && tail !== "none" ? "both" : tail !== "none" ? "end" : head !== "none" ? "start" : undefined;
      const pl = place(xf, frames);
      out.push(shapeEl("line", pl, { line: ln, arrow, flipH: xf.flipH, flipV: xf.flipV }, st, sc));
      continue;
    }
    if (n.tag === "p:graphicFrame") { await tableEls(n, frames, st, sc, out); continue; }
    if (n.tag !== "p:sp") continue;

    // ── an autoshape / text box / placeholder ──
    const ph = phOf(n);
    if (deco && ph) continue; // layout & master placeholders are prompts, never drawn
    if (ph && (ph.type === "sldNum" || ph.type === "dt" || ph.type === "ftr" || ph.type === "sldImg")) continue;
    const lph = ph && part.layout ? findPh(part.layout.ph, ph) : undefined;
    const mph = ph ? findPh((part.layout?.master ?? part.master)?.ph ?? [], ph) : undefined;
    const spPr = at(n, "p:spPr");
    const xf = readXfrm(ch(spPr, "a:xfrm")) ?? readXfrm(at(lph, "p:spPr", "a:xfrm")) ?? readXfrm(at(mph, "p:spPr", "a:xfrm"));
    if (!xf) continue;
    const pl = place(xf, frames);
    const fill = fillOf(spPr, sc.cx) ?? (ph ? fillOf(at(lph, "p:spPr"), sc.cx) ?? fillOf(at(mph, "p:spPr"), sc.cx) : undefined);
    const line = lineOf(ch(spPr, "a:ln"), sc.cx) ?? (ph ? lineOf(ch(at(lph, "p:spPr"), "a:ln"), sc.cx) : undefined);
    const prst = at(spPr, "a:prstGeom")?.a.prst ?? "rect";
    if (ch(spPr, "a:custGeom")) sc.stats.warnings.push("custom geometry drawn as a rectangle");
    const geom: CShape["geom"] = prst === "ellipse" ? "ellipse" : prst === "roundRect" ? "round" : "rect";
    if (prst === "line" || prst === "straightConnector1") { if (line) out.push(shapeEl("line", pl, { line, flipH: xf.flipH, flipV: xf.flipV }, st, sc)); continue; }
    if (fill || line) {
      const adj = at(spPr, "a:prstGeom", "a:avLst")?.c.find((g) => g.a.name === "adj")?.a.fmla;
      const r = geom === "round" ? Math.min(0.5, (adj ? num(adj.replace("val ", ""), 16667) : 16667) / 100000) : undefined;
      out.push(shapeEl(geom, pl, { fill: fill ?? undefined, line: line ?? undefined, r }, st, sc));
    }
    const body = ch(n, "p:txBody");
    if (!body) continue;
    const chainBodies = ph ? [at(mph, "p:txBody", "a:bodyPr"), at(lph, "p:txBody", "a:bodyPr"), ch(body, "a:bodyPr")] : [ch(body, "a:bodyPr")];
    const bp = bodyProps(chainBodies);
    const styleRoot = ph ? (family(ph.type) === "title" ? ch(sc.masterStyles, "p:titleStyle") : ch(sc.masterStyles, "p:bodyStyle")) : ch(sc.masterStyles, "p:otherStyle");
    const chain = [sc.defaultText, styleRoot, ph ? at(mph, "p:txBody", "a:lstStyle") : undefined, ph ? at(lph, "p:txBody", "a:lstStyle") : undefined, at(n, "p:txBody", "a:lstStyle")];
    const paras = paragraphs(body, chain, {}, bp.fontScale, pl.fs, sc, part.rels);
    if (paras.length && sc.attribution === false && isOakWordmarkText(paras)) { sc.stats.oakTextDropped++; continue; }
    if (paras.length) {
      // "By paragraph" builds: each paragraph gets its own click (the box itself is there from the start)
      const pa = anim?.paras;
      if (pa) paras.forEach((p, i) => { const a = pa.get(i); if (a?.step) p.step = a.step; if (a?.until) p.until = a.until; });
      out.push(textEl(paras, pl, bp, pa ? { ...st, step: undefined } : st, sc));
    }
  }
}

/** Rough height (pt) a text needs in a box `availW` pt wide — enough to know a table row will grow (PowerPoint / Slides grow a row to fit its text). */
function contentHeight(paras: CPara[], availW: number): number {
  let h = 0;
  for (const p of paras) {
    const size = Math.max(...p.runs.map((r) => r.size), 1);
    let lines = 0;
    const text = p.runs.map((r) => r.t).join("");
    for (const seg of text.split("\n")) {
      const w = p.runs.length ? seg.length * size * (p.runs[0]!.f === "lexend" ? 0.6 : p.runs[0]!.f === "kalam" ? 0.5 : 0.52) : 0;
      lines += Math.max(1, Math.ceil(w / Math.max(10, availW - (p.ind?.[0] ?? 0))));
    }
    h += lines * size * 1.2 * (p.lh ?? 1) + (p.before ?? 0) + (p.after ?? 0);
  }
  return h;
}

async function tableEls(frame: N, frames: Frame[], st: Anim, sc: SlideCtx, out: CEl[]): Promise<void> {
  const tbl = at(frame, "a:graphic", "a:graphicData", "a:tbl");
  const xf = readXfrm(ch(frame, "p:xfrm"));
  if (!tbl || !xf) return;
  const cols = chs(at(tbl, "a:tblGrid"), "a:gridCol").map((g) => num(g.a.w));
  const xs = [xf.x]; for (const w of cols) xs.push(xs[xs.length - 1]! + w);
  const rows = chs(tbl, "a:tr");
  // Pass 1: every cell's paragraphs, and how tall each row has to be.
  interface Cell { r: number; c: number; rs: number; cs: number; tc: N; tcPr: N | undefined; paras: CPara[]; pad: [number, number, number, number] }
  const cells: Cell[] = [];
  const rowH = rows.map((tr) => num(tr.a.h));
  rows.forEach((tr, ri) => chs(tr, "a:tc").forEach((tc, ci) => {
    if (tc.a.hMerge === "1" || tc.a.vMerge === "1") return;
    const tcPr = ch(tc, "a:tcPr");
    const body = ch(tc, "a:txBody");
    const paras = body ? paragraphs(body, [sc.defaultText, ch(sc.masterStyles, "p:otherStyle")], {}, 1, 1, sc, sc.part.rels) : [];
    const pad: [number, number, number, number] = [num(tcPr?.a.marL, 91440) / 12700, num(tcPr?.a.marT, 45720) / 12700, num(tcPr?.a.marR, 91440) / 12700, num(tcPr?.a.marB, 45720) / 12700];
    const cell: Cell = { r: ri, c: ci, rs: num(tc.a.rowSpan, 1), cs: num(tc.a.gridSpan, 1), tc, tcPr, paras, pad };
    cells.push(cell);
    if (cell.rs === 1 && paras.length) {
      const wPt = (xs[Math.min(cols.length, ci + cell.cs)]! - xs[ci]!) / 12700 - pad[0] - pad[2];
      rowH[ri] = Math.max(rowH[ri]!, (contentHeight(paras, wPt) + pad[1] + pad[3]) * 12700);
    }
  }));
  const ys = [xf.y]; for (const h of rowH) ys.push(ys[ys.length - 1]! + h);
  const fillEls: CEl[] = [], lineEls: CEl[] = [], textEls: CEl[] = [];
  for (const cell of cells) {
    const { tcPr } = cell;
    const x0 = xs[cell.c]!, x1 = xs[Math.min(cols.length, cell.c + cell.cs)]!, y0 = ys[cell.r]!, y1 = ys[Math.min(rows.length, cell.r + cell.rs)]!;
    const cellXf: Xfrm = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: 0, flipH: false, flipV: false };
    const pl = place(cellXf, frames);
    const fill = fillOf(tcPr, sc.cx);
    if (fill) fillEls.push(shapeEl("rect", pl, { fill }, st, sc));
    for (const side of ["L", "R", "T", "B"] as const) {
      const ln = lineOf(ch(tcPr, `a:ln${side}`), sc.cx);
      if (!ln) continue;
      const seg: Xfrm = side === "L" ? { ...cellXf, w: 0 } : side === "R" ? { ...cellXf, x: x1, w: 0 } : side === "T" ? { ...cellXf, h: 0 } : { ...cellXf, y: y1, h: 0 };
      lineEls.push(shapeEl("line", place(seg, frames), { line: ln }, st, sc));
    }
    if (!cell.paras.length) continue;
    const bp: Props2 = { anchor: tcPr?.a.anchor ?? "t", l: cell.pad[0], t: cell.pad[1], r: cell.pad[2], b: cell.pad[3], fontScale: 1 };
    textEls.push(textEl(cell.paras, pl, bp, st, sc));
  }
  out.push(...fillEls, ...lineEls, ...textEls);
}

/** Animations → per shape (spid): the click an ENTRANCE effect appears on (`step`), the click an EXIT effect hides it on (`until`), the delay of
 *  an "after previous" effect, and — for "by paragraph" builds — the same per paragraph. A click = one child of the main sequence; effects
 *  that start "with" / "after" the click's first one share its click (an after-effect keeps its delay). A sequence that starts by itself
 *  (auto-start, no click) has `step` undefined but a `delay`, so the shape is drawn from the start and eases in after that delay.
 *  Emphasis / motion-path effects are ignored (a 24-deck survey found none: docs/oak-import.md "Interaction survey"). */
function readSteps(slide: N): Map<string, ShapeAnim> {
  const m = new Map<string, ShapeAnim>();
  const seq = (function find(n: N): N | undefined { if (n.tag === "p:cTn" && n.a.nodeType === "mainSeq") return n; for (const c of n.c) { const f = find(c); if (f) return f; } })(ch(slide, "p:timing") ?? slide);
  const clicks = chs(ch(seq, "p:childTnLst"), "p:par");
  const delayOf = (n: N | undefined): number => { const c = ch(ch(n, "p:stCondLst"), "p:cond"); return !c || c.a.delay === "indefinite" ? 0 : num(c.a.delay, 0); };
  let click = 0;
  for (const par of clicks) {
    const outer = ch(par, "p:cTn");
    const conds = chs(ch(outer, "p:stCondLst"), "p:cond");
    const auto = conds.some((c) => c.a.evt === "onBegin") && !conds.some((c) => c.a.delay === "indefinite" && !c.a.evt);
    if (!auto) click++;
    const stepNo = auto ? undefined : click;
    // groups: children of the click's own childTnLst; every group starts `delay` ms after the click
    for (const grp of chs(ch(outer, "p:childTnLst"), "p:par")) {
      const gd = delayOf(ch(grp, "p:cTn"));
      (function scan(n: N) {
        if (n.tag === "p:cTn" && (n.a.presetClass === "entr" || n.a.presetClass === "exit")) {
          const kind = n.a.presetClass === "entr" ? "step" : "until";
          const d = Math.min(10, Math.round(((gd + delayOf(n)) / 1000) * 10) / 10);
          const tgt = (k: N) => {
            if (k.tag === "p:spTgt" && k.a.spid) {
              const cur = m.get(k.a.spid) ?? {};
              const rg = at(k, "p:txEl", "p:pRg");
              if (rg) {
                const paras = cur.paras ?? new Map<number, { step?: number; until?: number; delay?: number }>();
                for (let i = num(rg.a.st); i <= Math.min(num(rg.a.end), num(rg.a.st) + 60); i++) {
                  const pc = paras.get(i) ?? {};
                  if (kind === "step" && stepNo !== undefined && pc.step === undefined) paras.set(i, { ...pc, step: stepNo, ...(d ? { delay: d } : {}) });
                  else if (kind === "until" && stepNo !== undefined && pc.until === undefined) paras.set(i, { ...pc, until: stepNo });
                }
                m.set(k.a.spid, { ...cur, paras });
              } else if (kind === "step") {
                if (cur.step === undefined && cur.delay === undefined) m.set(k.a.spid, { ...cur, ...(stepNo !== undefined ? { step: stepNo } : {}), ...(d || auto ? { delay: d || 0.1 } : {}) });
              } else if (stepNo !== undefined && cur.until === undefined) m.set(k.a.spid, { ...cur, until: stepNo });
              return;
            }
            k.c.forEach(tgt);
          };
          tgt(n);
        } else n.c.forEach(scan);
      })(grp);
    }
  }
  return m;
}

/** Keep every value inside what canvasSchema.ts accepts (Oak decks contain off-slide shapes, 60-click builds…): clamp, never drop. */
function clampToSchema(els: CEl[]): void {
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const st = (v: number | undefined) => (v === undefined ? undefined : cl(Math.round(v), 1, 40));
  for (const e of els) {
    e.x = cl(e.x, -2, 3); e.y = cl(e.y, -2, 3); e.w = cl(e.w, 0, 3); e.h = cl(e.h, 0, 3);
    if (e.step !== undefined) e.step = st(e.step);
    if (e.until !== undefined) e.until = st(e.until);
    if (e.k === "text") for (const p of e.paras) {
      if (p.step !== undefined) p.step = st(p.step); if (p.until !== undefined) p.until = st(p.until);
      if (p.lh !== undefined) p.lh = cl(p.lh, 0.5, 3); if (p.before !== undefined) p.before = cl(p.before, 0, 300); if (p.after !== undefined) p.after = cl(p.after, 0, 300);
      if (p.ind) p.ind = [cl(p.ind[0], -400, 600), cl(p.ind[1], -400, 600)];
    }
  }
}

// ── Oak's own branding (dropped at conversion; the final "© Oak National Academy" attribution slide's WORDS stay) ──────────────────────
// The acorn mark (bottom-right of nearly every slide, a layout / master picture) and the "Oak National Academy" wordmark (title slide)
// are recognised by what they LOOK like — a 64-bit difference hash of the picture with a small tolerance, plus a size / shape cap — so it
// survives Google re-encoding the media and works in every subject's deck. A picture is never altered: it is kept exactly or left out.
const OAK_LOGO_DHASH: { name: string; hash: string; maxW: number; aspect: [number, number] }[] = [
  { name: "acorn", hash: "5af0961b2f92ce68", maxW: 0.14, aspect: [0.4, 1.1] },
  { name: "wordmark", hash: "809198595a54549d", maxW: 0.35, aspect: [1.1, 3.4] },
];
const logoMemo = new Map<string, string | null>();
/** 64-bit difference hash as 16 hex digits (compare with `hamming`). */
async function dhash(buf: Buffer): Promise<string | null> {
  try {
    const { default: sharp } = await import("sharp");
    const px = await sharp(buf, { limitInputPixels: 80_000_000 }).flatten({ background: "#ffffff" }).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    let hex = "";
    for (let y = 0; y < 8; y++) { let nib = 0; for (let x = 0; x < 8; x++) { nib = (nib << 1) | (px[y * 9 + x]! > px[y * 9 + x + 1]! ? 1 : 0); if (x % 4 === 3) { hex += nib.toString(16); nib = 0; } } }
    return hex;
  } catch { return null; }
}
const hamming = (a: string, b: string) => { let n = 0; for (let i = 0; i < a.length; i++) { let v = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16); while (v) { n += v & 1; v >>= 1; } } return n; };
/** Is this picture Oak's acorn mark or wordmark? (`w`,`h` = its drawn size and `slideW` the slide's width, same unit — a sanity check.) */
async function isOakLogo(bytes: Buffer, sha1: string, w: number, h: number, slideW: number): Promise<boolean> {
  let name = logoMemo.get(sha1);
  if (name === undefined) {
    name = null;
    if (bytes.length < 200_000) {
      const d = await dhash(bytes);
      if (d !== null) for (const l of OAK_LOGO_DHASH) if (hamming(d, l.hash) <= 7) { name = l.name; break; }
    }
    logoMemo.set(sha1, name);
  }
  if (!name) return false;
  const l = OAK_LOGO_DHASH.find((x) => x.name === name)!;
  const ratio = h > 0 ? w / h : 1;
  return ratio >= l.aspect[0] && ratio <= l.aspect[1] && w <= l.maxW * slideW;
}
const isOakWordmarkText = (paras: CPara[]) => /^\s*(oak national academy|oak)\s*$/i.test(paras.map((p) => p.runs.map((r) => r.t).join("")).join(" "));

export async function convertPptx(buf: Buffer, opts: ConvertOpts): Promise<{ slides: DeckSlide[]; stats: ConvertStats }> {
  const zip = openZip(buf);
  const stats: ConvertStats = { logosDropped: 0, oakTextDropped: 0, slidesTotal: 0, slidesKept: 0, dropped: [], images: [], warnings: [], els: 0 };
  const pres = parseXml(zip("ppt/presentation.xml") ?? (() => { throw new Error("no presentation.xml"); })());
  const sz = at(pres, "p:sldSz");
  const W = num(sz?.a.cx, 9144000), H = num(sz?.a.cy, 5143500);
  const presRels = relsOf(zip, "ppt/presentation.xml");
  const order = chs(at(pres, "p:sldIdLst"), "p:sldId").map((s) => presRels.get(s.a["r:id"] ?? "")?.target).filter((t): t is string => !!t);
  const defaultText = ch(pres, "p:defaultTextStyle");

  const parts = new Map<string, Part>();
  const load = (path: string, kind: "layout" | "master"): Part => {
    const hit = parts.get(path);
    if (hit) return hit;
    const tree = parseXml(zip(path) ?? (() => { throw new Error(`missing ${path}`); })());
    const rels = relsOf(zip, path);
    const part: Part = { tree, rels, path, th: { colors: {} }, map: {}, ph: collectPh(tree) };
    if (kind === "layout") {
      const mp = [...rels.values()].find((r) => r.type === "slideMaster")?.target;
      part.master = mp ? load(mp, "master") : undefined;
      part.th = part.master?.th ?? part.th; part.map = part.master?.map ?? {};
    } else {
      const tp = [...rels.values()].find((r) => r.type === "theme")?.target;
      part.th = tp ? readTheme(zip, tp) : part.th;
      const cm = ch(tree, "p:clrMap");
      part.map = { ...(cm?.a ?? {}) };
    }
    parts.set(path, part);
    return part;
  };

  const imageCache = new Map<string, { id: string } | null>();
  const slides: DeckSlide[] = [];
  stats.slidesTotal = order.length;
  for (const [si, spath] of order.entries()) {
    const tree = parseXml(zip(spath)!);
    const rels = relsOf(zip, spath);
    const layoutPath = [...rels.values()].find((r) => r.type === "slideLayout")?.target;
    const layout = layoutPath ? load(layoutPath, "layout") : undefined;
    const master = layout?.master;
    const part: Part = { tree, rels, path: spath, th: master?.th ?? { colors: {} }, map: master?.map ?? {}, ph: [], layout, master };
    const cx: ClrCtx = { th: part.th, map: part.map };
    const sc: SlideCtx = { W, H, cx, part, zip, steps: readSteps(tree), opts, stats, attribution: false, defaultText, masterStyles: ch(master?.tree, "p:txStyles"), imageCache };

    // Teacher-only chatter: Oak's "how to use Oak lessons" slide (and anything else that is not for the pupil).
    const allText = textOf(tree).replace(/\s+/g, " ").trim();
    sc.attribution = /oak national academy/i.test(allText) && /©|open government licen[cs]e|licensed under/i.test(allText);
    // Owner decision (2026-09-21): the closing "© Oak National Academy / Open Government Licence" slide is not shown to pupils.
    const why = /how to use oak lessons/i.test(allText) ? "how-to-use-oak-lessons" : sc.attribution ? "attribution" : !allText && !chs(spTreeOf(tree), "p:pic").length ? "empty" : "";
    if (why) { stats.dropped.push({ n: si + 1, why }); continue; }

    // Background: slide → layout → master.
    const bgOf = (t: N | undefined): string | undefined => {
      const bg = at(t, "p:cSld", "p:bg");
      if (!bg) return undefined;
      return colorOf(at(bg, "p:bgPr", "a:solidFill"), cx) ?? colorOf(ch(bg, "p:bgRef"), cx);
    };
    const bg = bgOf(tree) ?? bgOf(layout?.tree) ?? bgOf(master?.tree);

    const els: CEl[] = [];
    const showMaster = tree.a.showMasterSp !== "0";
    const layoutHidesMaster = layout?.tree.a.showMasterSp === "0";
    const own: CEl[] = [];
    if (showMaster && !layoutHidesMaster && master) await walk(spTreeOf(master.tree)?.c ?? [], [], undefined, true, sc, { ...master, layout: undefined, master: undefined }, els);
    if (showMaster && layout) await walk(spTreeOf(layout.tree)?.c ?? [], [], undefined, true, sc, { ...layout, master }, els);
    await walk(spTreeOf(tree)?.c ?? [], [], undefined, false, sc, part, own);
    els.push(...own);

    let title = "";
    for (const sp of spTreeOf(tree)?.c ?? []) { const ph = sp.tag === "p:sp" ? phOf(sp) : null; if (ph && family(ph.type) === "title") { title = textOf(sp).replace(/\s+/g, " ").trim(); if (title) break; } }
    if (!title) title = (own.find((e): e is CText => e.k === "text")?.paras[0]?.runs.map((r) => r.t).join("") ?? "").replace(/\s+/g, " ").trim();
    clampToSchema(els);
    stats.els += els.length;
    slides.push({ kind: "explain", title: title.slice(0, 120), blocks: [{ t: "canvas", w: 720, h: r1((720 * H) / W), ...(bg ? { bg } : {}), els }] });
    stats.slidesKept++;
  }
  return { slides, stats };
}
