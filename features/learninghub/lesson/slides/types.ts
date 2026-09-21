// Slide-deck lessons — the optional `slides` array inside a hubNotes doc's structured `lesson` field.
// A slide is a title band plus a stack of BLOCKS (text, word chips, tap-to-reveal, sort, match, spell-it…).
// The content is plain data (server/src/oak/slides/*.ts); everything the viewer renders goes through
// normalizeSlides first so a malformed block is dropped instead of crashing the lesson.
//
// Inline markup inside any text: **bold** and {accent} (the suffix/prefix being taught, drawn in the accent colour).

export type SlideKind = "intro" | "explain" | "practice" | "check" | "summary";
export type Chip = string | { text: string; emoji?: string };

export type Block =
  | { t: "text"; text: string }
  | { t: "lead"; text: string }
  | { t: "callout"; text: string }
  | { t: "list"; items: string[] }
  | { t: "chips"; items: Chip[] }
  /** Picture cards: a title, an optional line and (only when it is a verified literal depiction of the title) an emoji. */
  | { t: "cards"; items: { emoji?: string; title: string; sub?: string }[] }
  /** Tap a term to flip it to its meaning. */
  | { t: "define"; items: { term: string; def: string }[] }
  /** root + add → result: tap to build the word. `note` explains what happened to the root. */
  | { t: "formula"; rows: { root: string; add: string; result: string; note?: string }[] }
  /** A button that reveals a line of text. */
  | { t: "reveal"; label?: string; text: string }
  /** Tap a word to see the root word inside it. */
  | { t: "roots"; items: { word: string; root: string }[] }
  | { t: "choice"; q: string; options: string[]; answer: number; why?: string }
  /** Several mini multiple-choice questions on one slide. */
  | { t: "choices"; q?: string; items: { q?: string; options: string[]; answer: number }[] }
  /** Tap a word, then tap the column it belongs in. */
  | { t: "sort"; q: string; columns: string[]; items: { text: string; col: number }[] }
  | { t: "match"; q: string; pairs: { a: string; b: string }[] }
  /** Hear the word (browser speech), type it, check it. */
  | { t: "spell"; q?: string; words: string[]; tips?: string[] }
  /** Look, cover, write, check. */
  | { t: "lcwc"; q: string; words: string[] }
  /** Tap play and the chunks light up in rhythm. */
  | { t: "clap"; items: { word: string; chunks: string[] }[] }
  /** A whole slide laid out on a canvas (an imported real slide deck): positioned pictures, text, boxes. See CanvasSlide.tsx. */
  | CanvasBlock;

// ── Canvas slides (Oak's real slide decks, imported as editable slides — server/src/oak/deckConvert.ts, canvasSchema.ts) ──────────────
// Geometry is a FRACTION of the slide (0..1); font sizes are points on a `w`-pt-wide slide (rendered as container-relative units, so the
// whole slide scales with its width). `els` are in z-order (first = at the back). `step` = shown from that click on (1-based), `until` = hidden again from that click on.
export interface CanvasRun { t: string; size: number; bold?: true; italic?: true; underline?: true; color?: string; f?: "lexend" | "abeezee" | "kalam"; /** hyperlink (https only) */ link?: string }
/** `step` / `until` = a paragraph build: this paragraph appears on that click / goes on that click. */
export interface CanvasPara { runs: CanvasRun[]; algn?: "c" | "r" | "j"; lh?: number; before?: number; after?: number; bu?: string; ind?: [number, number]; step?: number; until?: number }
interface CanvasBase { x: number; y: number; w: number; h: number; rot?: number; step?: number; /** hidden again from this click on (an exit animation) */ until?: number;
  /** seconds after the click (or after the slide opens, with no `step`) an "after previous" / auto-start animation begins */ delay?: number }
export interface CanvasImg extends CanvasBase {
  k: "img"; alt: string;
  /** imported deck picture in Firebase Storage (the API adds a short-lived signed `url`) */
  sid?: string;
  /** a tutor's own upload (private hub image; the API adds a signed `url`) */
  imageId?: string;
  /** a verified library picture (drawn inline) */
  picId?: string;
  url?: string;
  crop?: [number, number, number, number]; flipH?: true; flipV?: true;
}
export interface CanvasText extends CanvasBase { k: "text"; paras: CanvasPara[]; anchor?: "m" | "b"; pad?: [number, number, number, number] }
export interface CanvasShape extends CanvasBase {
  k: "shape"; geom: "rect" | "round" | "ellipse" | "line"; fill?: string; line?: { c: string; w: number }; r?: number; arrow?: "start" | "end" | "both"; flipH?: true; flipV?: true;
}
export type CanvasEl = CanvasImg | CanvasText | CanvasShape;
/** `theme: "original"` = draw the slide in its own colours (no branded recolour; see slideTheme.ts) */
export interface CanvasBlock { t: "canvas"; w: number; h: number; bg?: string; theme?: "original"; els: CanvasEl[] }

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const SID = /^[a-f0-9]{64}\.(webp|png|jpg)$/;
const fin = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : undefined);

/** Sanitise a canvas block from the API: bad elements are dropped, numbers are clamped, nothing can crash the renderer. Null = nothing to draw. */
export function normalizeCanvas(raw: unknown): CanvasBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.els)) return null;
  const els: CanvasEl[] = [];
  for (const e of o.els.slice(0, 300)) {
    if (!e || typeof e !== "object") continue;
    const x = e as Record<string, unknown>;
    const base: CanvasBase = { x: fin(x.x, -2, 3, 0), y: fin(x.y, -2, 3, 0), w: fin(x.w, 0, 3, 0), h: fin(x.h, 0, 3, 0), ...(x.rot ? { rot: fin(x.rot, -360, 360, 0) } : {}), ...(x.step ? { step: Math.round(fin(x.step, 1, 40, 1)) } : {}), ...(x.until ? { until: Math.round(fin(x.until, 1, 40, 1)) } : {}), ...(x.delay ? { delay: fin(x.delay, 0, 10, 0) } : {}) };
    if (x.k === "img") {
      const sid = typeof x.sid === "string" && SID.test(x.sid) ? x.sid : undefined;
      const imageId = typeof x.imageId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(x.imageId) ? x.imageId : undefined;
      const picId = typeof x.picId === "string" && /^[a-z0-9-]{1,60}$/.test(x.picId) ? x.picId : undefined;
      if (!sid && !imageId && !picId) continue;
      const c = Array.isArray(x.crop) && x.crop.length === 4 ? (x.crop as unknown[]).map((v) => fin(v, 0, 0.95, 0)) as [number, number, number, number] : undefined;
      els.push({ k: "img", ...base, alt: typeof x.alt === "string" ? x.alt.slice(0, 300) : "", ...(sid ? { sid } : {}), ...(imageId ? { imageId } : {}), ...(picId ? { picId } : {}),
        ...(typeof x.url === "string" && /^https:\/\//.test(x.url) ? { url: x.url } : {}), ...(c && c.some(Boolean) ? { crop: c } : {}), ...(x.flipH === true ? { flipH: true as const } : {}), ...(x.flipV === true ? { flipV: true as const } : {}) });
    } else if (x.k === "text") {
      if (!Array.isArray(x.paras)) continue;
      const paras: CanvasPara[] = [];
      for (const p of x.paras.slice(0, 80)) {
        if (!p || typeof p !== "object" || !Array.isArray((p as { runs?: unknown }).runs)) continue;
        const q = p as Record<string, unknown>;
        const runs: CanvasRun[] = [];
        for (const r of (q.runs as unknown[]).slice(0, 80)) {
          if (!r || typeof r !== "object" || typeof (r as { t?: unknown }).t !== "string") continue;
          const y = r as Record<string, unknown>;
          runs.push({ t: (y.t as string).slice(0, 3000), size: fin(y.size, 1, 400, 18), ...(y.bold === true ? { bold: true as const } : {}), ...(y.italic === true ? { italic: true as const } : {}), ...(y.underline === true ? { underline: true as const } : {}),
            ...(hex(y.color) ? { color: hex(y.color) } : {}), ...(y.f === "lexend" || y.f === "abeezee" || y.f === "kalam" ? { f: y.f } : {}), ...(typeof y.link === "string" && /^https:\/\//.test(y.link) ? { link: y.link.slice(0, 400) } : {}) });
        }
        paras.push({ runs, ...(q.algn === "c" || q.algn === "r" || q.algn === "j" ? { algn: q.algn } : {}), ...(q.lh ? { lh: fin(q.lh, 0.5, 3, 1) } : {}), ...(q.before ? { before: fin(q.before, 0, 300, 0) } : {}), ...(q.after ? { after: fin(q.after, 0, 300, 0) } : {}),
          ...(typeof q.bu === "string" ? { bu: q.bu.slice(0, 8) } : {}), ...(q.step ? { step: Math.round(fin(q.step, 1, 40, 1)) } : {}), ...(q.until ? { until: Math.round(fin(q.until, 1, 40, 1)) } : {}), ...(Array.isArray(q.ind) && q.ind.length === 2 ? { ind: [fin(q.ind[0], -400, 600, 0), fin(q.ind[1], -400, 600, 0)] as [number, number] } : {}) });
      }
      const pad = Array.isArray(x.pad) && x.pad.length === 4 ? (x.pad as unknown[]).map((v) => fin(v, 0, 200, 0)) as [number, number, number, number] : undefined;
      els.push({ k: "text", ...base, paras, ...(x.anchor === "m" || x.anchor === "b" ? { anchor: x.anchor } : {}), ...(pad ? { pad } : {}) });
    } else if (x.k === "shape") {
      const geom = x.geom === "round" || x.geom === "ellipse" || x.geom === "line" ? x.geom : "rect";
      const ln = x.line && typeof x.line === "object" ? (x.line as { c?: unknown; w?: unknown }) : null;
      els.push({ k: "shape", ...base, geom, ...(hex(x.fill) ? { fill: hex(x.fill) } : {}), ...(ln && hex(ln.c) ? { line: { c: hex(ln.c)!, w: fin(ln.w, 0, 60, 1) } } : {}), ...(x.r ? { r: fin(x.r, 0, 0.5, 0) } : {}),
        ...(x.arrow === "start" || x.arrow === "end" || x.arrow === "both" ? { arrow: x.arrow } : {}), ...(x.flipH === true ? { flipH: true as const } : {}), ...(x.flipV === true ? { flipV: true as const } : {}) });
    }
  }
  return { t: "canvas", w: fin(o.w, 100, 4000, 720), h: fin(o.h, 100, 4000, 405), ...(hex(o.bg) ? { bg: hex(o.bg) } : {}), ...(o.theme === "original" ? { theme: "original" as const } : {}), els };
}
/** The canvas of a slide that is one (a real-deck slide): `blocks` is exactly [canvas]. */
export const canvasOf = (s: Pick<Slide, "blocks">): CanvasBlock | null => (s.blocks.length === 1 && s.blocks[0]!.t === "canvas" ? (s.blocks[0] as CanvasBlock) : null);

/** A verified picture from the picture library (server/src/oak/factory/art/library.ts), referenced by id. Unknown ids are ignored by the player. */
export interface SlidePic { id: string }
/** A tutor's own picture: a private hub upload (POST /api/uploads {purpose:"private", kind:"hub"}) referenced by id, with REQUIRED alt text.
 *  `url` is the short-lived signed link the server adds on output (never stored). */
export interface SlideImage { id: string; alt: string; url?: string }
export interface Slide { kind: SlideKind; title: string; blocks: Block[];
  /** Verified literal emoji (allow-listed concrete nouns only) drawn beside the slide. Never decorative: see server/src/oak/factory/art/allowlist.ts. */
  art?: string[];
  /** Verified library pictures (SVG diagrams) drawn beside the slide, with alt text and a caption from the library. */
  pics?: SlidePic[];
  /** The tutor's uploaded picture (replaces library pictures / emoji when set). */
  image?: SlideImage;
  /** The tutor removed, replaced or added this slide's picture in the preview: the factory / importer must keep the slide's art exactly as it is. */
  artLock?: true }

const IMAGE_ID = /^[A-Za-z0-9_-]{1,100}$/;
export function normalizeSlideImage(raw: unknown): SlideImage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { id?: unknown; alt?: unknown; url?: unknown };
  if (typeof o.id !== "string" || !IMAGE_ID.test(o.id)) return undefined;
  return { id: o.id, alt: typeof o.alt === "string" ? o.alt : "", ...(typeof o.url === "string" && /^https?:\/\//.test(o.url) ? { url: o.url } : {}) };
}

const KINDS: SlideKind[] = ["intro", "explain", "practice", "check", "summary"];
const BLOCKS = new Set(["canvas", "text", "lead", "callout", "list", "chips", "cards", "define", "formula", "reveal", "roots", "choice", "choices", "sort", "match", "spell", "lcwc", "clap"]);

export function normalizeSlides(raw: unknown): Slide[] {
  if (!Array.isArray(raw)) return [];
  const out: Slide[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const blocks = Array.isArray(o.blocks) ? (o.blocks as unknown[]).map((b) => (b && typeof b === "object" && (b as { t?: unknown }).t === "canvas" ? normalizeCanvas(b) : b)).filter((b): b is Block => !!b && typeof b === "object" && BLOCKS.has(String((b as { t?: unknown }).t))) : [];
    if (!blocks.length) continue;
    const kind = KINDS.includes(o.kind as SlideKind) ? (o.kind as SlideKind) : "explain";
    const art = Array.isArray(o.art) ? (o.art as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 4) : undefined;
    const pics = Array.isArray(o.pics) ? (o.pics as unknown[]).map((x) => (x && typeof x === "object" ? (x as { id?: unknown }).id : undefined)).filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,60}$/.test(x)).slice(0, 3).map((id) => ({ id })) : undefined;
    const image = normalizeSlideImage(o.image);
    out.push({ kind, title: typeof o.title === "string" ? o.title : "", blocks, ...(art?.length ? { art } : {}), ...(pics?.length ? { pics } : {}), ...(image ? { image } : {}), ...(o.artLock === true ? { artLock: true as const } : {}) });
  }
  return out;
}

export const KIND_LABEL: Record<SlideKind, string> = { intro: "Let’s begin", explain: "Explanation", practice: "Practice", check: "Check", summary: "Summary" };
