// Picture storage for imported slide decks (Oak's real decks → editable canvas slides, see deckConvert.ts / docs/oak-import.md).
//
//   putSlideImage(tenantId, buffer, mime) → { sid }
//
// is the ONLY thing the importer knows about where slide pictures live. The default store is Firebase Storage
// (lib/slideStorage.ts: `hubSlides/<tenantId>/<sha256>.webp`, content-addressed, server-only bucket rules); a canvas element keeps
// just the `sid` and every API response adds a short-lived signed URL (withSlideUrls). Swapping the backing store (another bucket,
// S3, a fake in tests) = implement `SlideImageStore` and call `useSlideImageStore(...)` — slides keep the same `sid`s.
//
// A tutor's OWN pictures (Change picture → Replace / Add) do not come through here: they use the existing private hub upload
// (POST /api/uploads {kind:"hub"} → an `images` Firestore doc, element `imageId`, 750KB cap). Both kinds coexist in one canvas.
import sharp from "sharp";
import { hasSlideObject, putSlideObject } from "../lib/slideStorage";

export type SlideImageMime = "image/png" | "image/jpeg" | "image/webp";

export interface SlideImageStore {
  /** Store the bytes for this tenant (idempotent for identical bytes) and return the key to keep on the slide element. */
  put(tenantId: string, bytes: Buffer, mime: SlideImageMime): Promise<{ sid: string }>;
  /** Is this key already stored for this tenant? (lets an importer skip work it did in an earlier run) */
  has(tenantId: string, sid: string): Promise<boolean>;
}

/** Ceiling for one stored picture. Not a Firestore limit any more (Storage has none) — it just keeps a lesson light to load. */
export const MAX_SLIDE_IMAGE_BYTES = 750_000;

const storageStore: SlideImageStore = {
  async put(tenantId, bytes, mime) {
    if (bytes.length > MAX_SLIDE_IMAGE_BYTES) throw new Error(`Slide picture too large (${Math.round(bytes.length / 1024)}KB, max ${Math.round(MAX_SLIDE_IMAGE_BYTES / 1000)}KB)`);
    return putSlideObject(tenantId, bytes, mime);
  },
  has: hasSlideObject,
};

let store: SlideImageStore = storageStore;
/** Swap the backing store (tests, another bucket). */
export function useSlideImageStore(s: SlideImageStore): void { store = s; }
export const putSlideImage = (tenantId: string, bytes: Buffer, mime: SlideImageMime) => store.put(tenantId, bytes, mime);
export const hasSlideImage = (tenantId: string, sid: string) => store.has(tenantId, sid);

// ── Resize / re-encode ────────────────────────────────────────────────────

export interface PreparedImage { bytes: Buffer; mime: SlideImageMime; width: number; height: number; srcBytes: number }

/** Longest side of a stored slide picture. A slide is ~1000px wide on a big screen and pictures fill a fraction of it. */
export const MAX_SLIDE_IMAGE_SIDE = 1280;

/** Shrink to ≤1280px on the longest side and re-encode (WebP, keeping transparency; whichever of lossless / lossy is smaller for line art).
 *  Never alters the picture's content: no crop, no recolour, no metadata games — a pure size reduction. Throws on an unreadable image. */
export async function prepareSlideImage(src: Buffer): Promise<PreparedImage> {
  const meta = await sharp(src, { animated: false, limitInputPixels: 80_000_000 }).metadata();
  if (!meta.width || !meta.height) throw new Error("unreadable image");
  // An animated GIF (Oak's science decks have a few) stays animated: an animated WebP, every frame kept, ≤ 640px, when that fits the cap.
  if (meta.format === "gif") {
    try {
      const am = await sharp(src, { animated: true, limitInputPixels: 80_000_000 }).metadata();
      if ((am.pages ?? 1) > 1) {
        for (const [side, q] of [[640, 72], [480, 60], [360, 50]] as const) {
          const anim = await sharp(src, { animated: true, limitInputPixels: 80_000_000 }).resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).webp({ quality: q, effort: 3 }).toBuffer();
          if (anim.length <= MAX_SLIDE_IMAGE_BYTES_SOFT) { const o = await sharp(anim, { animated: true }).metadata(); return { bytes: anim, mime: "image/webp", width: o.width ?? 0, height: o.pageHeight ?? o.height ?? 0, srcBytes: src.length }; }
        }
      }
    } catch { /* fall through to the still frame */ }
  }
  const base = () => sharp(src, { animated: false, limitInputPixels: 80_000_000 }).rotate().resize({ width: MAX_SLIDE_IMAGE_SIDE, height: MAX_SLIDE_IMAGE_SIDE, fit: "inside", withoutEnlargement: true });
  const candidates: Buffer[] = [await base().webp({ quality: 84, alphaQuality: 92, effort: 5 }).toBuffer()];
  // Flat line-art (Oak's cartoons) is often far smaller lossless; photos are not, so only try it when the lossy one is not already tiny.
  if (candidates[0]!.length > 25_000) candidates.push(await base().webp({ lossless: true, effort: 4 }).toBuffer());
  let best = candidates.reduce((a, b) => (b.length < a.length ? b : a));
  // Rare: still over the cap → step the quality / size down until it fits.
  for (let side = MAX_SLIDE_IMAGE_SIDE, q = 70; best.length > MAX_SLIDE_IMAGE_BYTES_SOFT && side > 400; side = Math.round(side * 0.8), q = Math.max(45, q - 8)) {
    best = await sharp(src, { animated: false }).rotate().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer();
  }
  const out = await sharp(best).metadata();
  return { bytes: best, mime: "image/webp", width: out.width ?? 0, height: out.height ?? 0, srcBytes: src.length };
}
const MAX_SLIDE_IMAGE_BYTES_SOFT = 650_000;
