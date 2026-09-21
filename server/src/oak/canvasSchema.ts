// Validation of a "canvas" slide block (an imported / edited real slide deck; see oak/deckConvert.ts for the shape and
// features/learninghub/lesson/slides/types.ts for the client's mirror). Used by routes/learningHub.ts (cleanSlideArt).
//
// Strict on everything that can hurt: sizes are capped, colours are hex only, an image element may only reference a hub image id
// (checked to be THIS tenant's by claimSlideImages), a storage `sid` (the tenant folder is added server-side, never sent) or a
// verified library picture id, and a client-sent `url` is dropped (zod strips unknown keys) — the API re-signs on the way out
// (signCanvasSlides for `imageId`, lib/slideStorage.ts withSlideUrls for `sid`).
import { z } from "zod";
import { PIC_BY_ID } from "./factory/art/library";
import { signImageUrl } from "../lib/signing";
import { SID } from "../lib/slideStorage";

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const IMAGE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const coord = z.number().min(-2).max(3);
const size = z.number().min(0).max(3);
const box = { x: coord, y: coord, w: size, h: size, rot: z.number().min(-360).max(360).optional(), step: z.number().int().min(1).max(40).optional(), until: z.number().int().min(1).max(40).optional(), delay: z.number().min(0).max(10).optional() };
const flip = z.literal(true).optional();

const run = z.object({
  t: z.string().max(3000), size: z.number().min(1).max(400), bold: z.literal(true).optional(), italic: z.literal(true).optional(), underline: z.literal(true).optional(),
  color: z.string().regex(HEX).optional(), f: z.enum(["lexend", "abeezee", "kalam"]).optional(), link: z.string().regex(/^https:\/\//).max(400).optional(),
});
const para = z.object({
  runs: z.array(run).max(80), algn: z.enum(["c", "r", "j"]).optional(), lh: z.number().min(0.5).max(3).optional(),
  before: z.number().min(0).max(300).optional(), after: z.number().min(0).max(300).optional(), bu: z.string().max(8).optional(),
  ind: z.tuple([z.number().min(-400).max(600), z.number().min(-400).max(600)]).optional(),
  step: z.number().int().min(1).max(40).optional(), until: z.number().int().min(1).max(40).optional(),
});
const el = z.discriminatedUnion("k", [
  z.object({
    k: z.literal("img"), ...box, alt: z.string().max(300).default(""),
    /** an imported deck picture in Firebase Storage (lib/slideStorage.ts): `<sha256>.webp`, the tenant folder is added server-side */
    sid: z.string().regex(SID).optional(),
    /** a tutor's own upload (private hub image, checked to be this tenant's by claimSlideImages) */
    imageId: z.string().regex(IMAGE_ID).optional(),
    /** a verified library picture (server/src/oak/factory/art/library.ts), drawn inline */
    picId: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
    crop: z.tuple([z.number().min(0).max(0.95), z.number().min(0).max(0.95), z.number().min(0).max(0.95), z.number().min(0).max(0.95)]).optional(),
    flipH: flip, flipV: flip,
  }),
  z.object({
    k: z.literal("text"), ...box, paras: z.array(para).max(80), anchor: z.enum(["m", "b"]).optional(),
    pad: z.tuple([z.number().min(0).max(200), z.number().min(0).max(200), z.number().min(0).max(200), z.number().min(0).max(200)]).optional(),
  }),
  z.object({
    k: z.literal("shape"), ...box, geom: z.enum(["rect", "round", "ellipse", "line"]), fill: z.string().regex(HEX).optional(),
    line: z.object({ c: z.string().regex(HEX), w: z.number().min(0).max(60) }).optional(), r: z.number().min(0).max(0.5).optional(),
    arrow: z.enum(["start", "end", "both"]).optional(), flipH: flip, flipV: flip,
  }),
]);
const canvas = z.object({
  t: z.literal("canvas"), w: z.number().min(100).max(4000), h: z.number().min(100).max(4000), bg: z.string().regex(HEX).optional(), theme: z.literal("original").optional(),
  els: z.array(el).max(2000),
});

export const MAX_CANVAS_TEXT = 30_000;

/** Validate one canvas block. Returns the cleaned block + the hub image ids it uses, or a message for a 400. */
export function cleanCanvasBlock(raw: unknown): { block: Record<string, unknown>; imageIds: string[] } | string {
  const p = canvas.safeParse(raw);
  if (!p.success) { const i = p.error.issues[0]; return `Slide picture layout: ${i?.path.join(".") ?? ""} ${i?.message ?? "is invalid"}`; }
  const imageIds = new Set<string>();
  let chars = 0;
  for (const e of p.data.els) {
    // Placement clamp (a tutor drags / resizes pictures and text boxes): every picture keeps a real size and at least 5% of every element stays on the slide.
    if (e.k === "img" || e.k === "text") {
      const r4 = (v: number) => Math.round(v * 10000) / 10000;
      if (e.k === "img") { e.w = Math.max(0.01, e.w); e.h = Math.max(0.01, e.h); }
      e.x = r4(Math.min(1 - e.w * 0.05, Math.max(-e.w * 0.95, e.x)));
      e.y = r4(Math.min(1 - e.h * 0.05, Math.max(-e.h * 0.95, e.y)));
      e.w = r4(e.w); e.h = r4(e.h);
    }
    if (e.k === "img") {
      if ([e.sid, e.imageId, e.picId].filter(Boolean).length !== 1) return "A slide picture needs exactly one source (deck picture, your own picture, or a library picture)";
      if (e.imageId) imageIds.add(e.imageId);
      if (e.picId && !PIC_BY_ID[e.picId]) return "That library picture doesn't exist";
    } else if (e.k === "text") chars += e.paras.reduce((n, q) => n + q.runs.reduce((m, r) => m + r.t.length, 0), 0);
  }
  if (chars > MAX_CANVAS_TEXT) return "That slide has too much text";
  return { block: p.data as unknown as Record<string, unknown>, imageIds: [...imageIds] };
}

/** Add a short-lived signed `url` to every own-picture element of every canvas block (one signature per distinct id). */
export function signCanvasSlides(base: string, slides: Record<string, unknown>[]): Record<string, unknown>[] {
  const memo = new Map<string, string>();
  const sign = (id: string) => { let u = memo.get(id); if (!u) { u = signImageUrl(`${base}/${id}`) as string; memo.set(id, u); } return u; };
  return slides.map((s) => {
    const blocks = s.blocks;
    if (!Array.isArray(blocks) || !blocks.some((b) => b && (b as { t?: unknown }).t === "canvas")) return s;
    return {
      ...s,
      blocks: blocks.map((b) => {
        const o = b as { t?: unknown; els?: unknown };
        if (o?.t !== "canvas" || !Array.isArray(o.els)) return b;
        return { ...o, els: o.els.map((e) => { const x = e as { k?: unknown; imageId?: unknown }; return x?.k === "img" && typeof x.imageId === "string" ? { ...x, url: sign(x.imageId) } : e; }) };
      }),
    };
  });
}
