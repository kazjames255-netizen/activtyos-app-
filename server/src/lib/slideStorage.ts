// Firebase Storage for the pictures of an imported real slide deck (oak/deckConvert.ts → canvas slides).
//
//   object path:   hubSlides/<tenantId>/<sha256>.webp        (content-addressed: an identical picture is stored once per tenant)
//   canvas element: { k:"img", sid:"<sha256>.webp", … }      (only the key is stored on the lesson — NEVER a url or a tenant path)
//   read time:      slidesOut adds a short-lived V4 signed URL (`url`) — see withSlideUrls below
//
// TENANT ISOLATION: the tenant part of the path is never taken from a client. The lesson's OWN tenantId (the note the caller is
// already allowed to read) is prefixed when signing, so a forged `sid` can only ever point inside the caller's own folder. The
// bucket has server-only rules (no client SDK access), so the signed URL is the only way a browser reaches an object.
//
// The tutor's own "Change picture" uploads still use the Firestore `images` path (POST /api/uploads {kind:"hub"} → element
// `imageId`); both kinds live side by side in the same canvas and are signed by the same pass.
import crypto from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "../firebase"; // initialises the default Admin app
import type { Bucket } from "@google-cloud/storage";

const DEFAULT_BUCKET = "activityos-bef89.firebasestorage.app";
export const SID = /^[a-f0-9]{64}\.(webp|png|jpg)$/;
const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };
const TTL_MS = 60 * 60 * 1000;

let bucketMemo: Bucket | null = null;
export function slideBucket(): Bucket {
  return (bucketMemo ??= getStorage().bucket(process.env.STORAGE_BUCKET?.trim() || DEFAULT_BUCKET) as unknown as Bucket);
}
const objectPath = (tenantId: string, sid: string) => `hubSlides/${tenantId}/${sid}`;

/** Store one picture (idempotent — same bytes, same object). Returns the `sid` to keep on the element. */
export async function putSlideObject(tenantId: string, bytes: Buffer, mime: string): Promise<{ sid: string }> {
  const ext = EXT[mime];
  if (!ext) throw new Error(`unsupported slide picture type ${mime}`);
  const sid = `${crypto.createHash("sha256").update(bytes).digest("hex")}.${ext}`;
  const file = slideBucket().file(objectPath(tenantId, sid));
  const [exists] = await file.exists();
  if (!exists) await file.save(bytes, { contentType: mime, resumable: false, metadata: { cacheControl: "private, max-age=31536000, immutable" } });
  return { sid };
}
export async function hasSlideObject(tenantId: string, sid: string): Promise<boolean> {
  if (!SID.test(sid)) return false;
  const [e] = await slideBucket().file(objectPath(tenantId, sid)).exists();
  return e;
}

// A signed URL is reused for ~30 minutes so the browser keeps its cached copy while a lesson is open (a new URL per request would
// re-download every picture on every refresh); it is valid for 60.
const urlCache = new Map<string, { url: string; exp: number }>();
export async function signSlideObject(tenantId: string, sid: string): Promise<string | null> {
  if (!SID.test(sid)) return null;
  const key = objectPath(tenantId, sid);
  const hit = urlCache.get(key);
  const now = Date.now();
  if (hit && hit.exp - now > TTL_MS / 2) return hit.url;
  const exp = now + TTL_MS;
  const [url] = await slideBucket().file(key).getSignedUrl({ version: "v4", action: "read", expires: exp });
  if (urlCache.size > 5000) urlCache.clear();
  urlCache.set(key, { url, exp });
  return url;
}

type Slides = Record<string, unknown>[];
/** Add `url` to every storage-backed picture (`sid`) of every canvas block in these slides, in place of a copy. Unknown / malformed sids get no url. */
export async function withSlideUrls(tenantId: string, slides: unknown): Promise<unknown> {
  if (!Array.isArray(slides)) return slides;
  const sids = new Set<string>();
  const each = (fn: (e: Record<string, unknown>) => void) => {
    for (const s of slides as Slides) for (const b of Array.isArray(s?.blocks) ? (s.blocks as unknown[]) : []) {
      const o = b as { t?: unknown; els?: unknown };
      if (o?.t === "canvas" && Array.isArray(o.els)) for (const e of o.els) if (e && typeof e === "object") fn(e as Record<string, unknown>);
    }
  };
  each((e) => { if (e.k === "img" && typeof e.sid === "string") sids.add(e.sid); });
  if (!sids.size) return slides;
  const urls = new Map<string, string>();
  await Promise.all([...sids].map(async (sid) => { const u = await signSlideObject(tenantId, sid).catch(() => null); if (u) urls.set(sid, u); }));
  return (slides as Slides).map((s) => {
    if (!Array.isArray(s?.blocks)) return s;
    return { ...s, blocks: (s.blocks as unknown[]).map((b) => {
      const o = b as { t?: unknown; els?: unknown };
      if (o?.t !== "canvas" || !Array.isArray(o.els)) return b;
      return { ...o, els: o.els.map((e) => { const x = e as { k?: unknown; sid?: unknown }; return x?.k === "img" && typeof x.sid === "string" && urls.has(x.sid) ? { ...x, url: urls.get(x.sid) } : e; }) };
    }) };
  });
}
