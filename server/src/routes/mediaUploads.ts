import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";

// Image + VIDEO uploads to Cloud/Firebase Storage (docs/amir-backend-outstanding.md #2).
// OFF BY DEFAULT: every route answers 503 {code:"media_storage_disabled"} until BOTH are set on the API host:
//   MEDIA_STORAGE_ENABLED=true   and   FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app (or .appspot.com)
// …and Storage has been enabled in the Firebase console (Blaze plan) with the API's service account allowed to
// write the bucket (Storage Object Admin) and sign URLs (Service Account Token Creator). Nothing here is called
// unless the flag is on; the existing /api/images (Firestore-doc store, ≤750KB, image/PDF) is untouched.
//
// Flow (bytes go browser → bucket, never through Express, so big videos don't hit the API's body limit):
//   1. POST /api/media/upload-url {contentType, bytes, name?} → {id, uploadUrl, headers}  (validated; signed PUT, 15 min)
//   2. client PUTs the file to uploadUrl with the returned headers
//   3. POST /api/media/:id/complete → server re-checks size + magic bytes on the stored object; only then status "ready"
//   4. GET  /api/media/:id → 302 to a short-lived signed read URL (same-tenant accounts only)
// Objects live under media/{tenantId}/… ; the doc in `mediaUploads` is the source of truth for ownership.

export const media = Router();
const enabled = () => process.env.MEDIA_STORAGE_ENABLED === "true" && !!process.env.FIREBASE_STORAGE_BUCKET;
media.use((_req, res, next) => {
  if (!enabled()) { res.status(503).json({ error: "Media storage is not enabled on this server yet.", code: "media_storage_disabled" }); return; }
  next();
});

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * MB;
export const maxVideoBytes = () => Math.max(1, Number(process.env.MEDIA_MAX_VIDEO_MB) || 200) * MB;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Magic-byte check on the first bytes of the stored object (the declared type alone is never trusted). */
export function magicOk(contentType: string, b: Buffer): boolean {
  const a = (from: number, to: number) => b.subarray(from, to).toString("ascii");
  switch (contentType) {
    case "image/png": return b.length >= 8 && b[0] === 0x89 && a(1, 4) === "PNG";
    case "image/jpeg": return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/gif": return a(0, 6) === "GIF87a" || a(0, 6) === "GIF89a";
    case "image/webp": return a(0, 4) === "RIFF" && a(8, 12) === "WEBP";
    case "video/mp4": case "video/quicktime": return b.length >= 12 && a(4, 8) === "ftyp";
    case "video/webm": return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    default: return false;
  }
}
/** Pure size/type validation, exported for tests. */
export function validateRequest(contentType: string, bytes: number): { ok: true } | { ok: false; status: number; error: string } {
  if (!EXT[contentType]) return { ok: false, status: 400, error: "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, WebM or MOV." };
  const isVideo = contentType.startsWith("video/");
  const max = isVideo ? maxVideoBytes() : MAX_IMAGE_BYTES;
  if (bytes <= 0) return { ok: false, status: 400, error: "Empty file" };
  if (bytes > max) return { ok: false, status: 413, error: `${isVideo ? "Video" : "Image"} too large (${Math.round(bytes / MB)}MB — max ${Math.round(max / MB)}MB)` };
  return { ok: true };
}

const col = db.collection("mediaUploads");
const bucket = () => getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

media.post("/upload-url", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account with a tenant" }); return; }
  const parsed = z.object({ contentType: z.string().max(60), bytes: z.number().int().positive(), name: z.string().max(200).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { contentType, bytes } = parsed.data;
  const v = validateRequest(contentType, bytes);
  if (!v.ok) { res.status(v.status).json({ error: v.error }); return; }
  const id = randomBytes(16).toString("hex");
  const objectPath = `media/${auth.tenantId}/${id}.${EXT[contentType]}`;
  const [uploadUrl] = await bucket().file(objectPath).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 15 * 60_000, contentType });
  await col.doc(id).set({ tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, objectPath, contentType, declaredBytes: bytes, name: parsed.data.name ?? null, status: "pending", createdAt: new Date().toISOString(), createdBy: req.user?.email ?? null });
  res.status(201).json({ id, uploadUrl, headers: { "Content-Type": contentType }, expiresInSec: 900 });
});

media.post("/:id/complete", async (req, res) => {
  const auth = req.auth!;
  const ref = col.doc(String(req.params.id));
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== auth.tenantId || !canWrite(auth.role)) { res.status(404).json({ error: "Not found" }); return; }
  if (snap.get("status") === "ready") { res.json({ id: ref.id, status: "ready", url: `/api/media/${ref.id}` }); return; }
  const file = bucket().file(snap.get("objectPath") as string);
  const [exists] = await file.exists();
  if (!exists) { res.status(409).json({ error: "The file hasn't been uploaded yet." }); return; }
  const [meta] = await file.getMetadata();
  const size = Number(meta.size), ct = String(snap.get("contentType"));
  const bad = async (error: string) => { await file.delete().catch(() => {}); await ref.set({ status: "rejected", rejectedAt: new Date().toISOString() }, { merge: true }); res.status(422).json({ error }); };
  const v = validateRequest(ct, size);
  if (!v.ok) { await bad(v.error); return; }
  const [head] = await file.download({ start: 0, end: 31 });
  if (!magicOk(ct, head)) { await bad("That file's contents don't match its declared type."); return; }
  await ref.set({ status: "ready", bytes: size, readyAt: new Date().toISOString() }, { merge: true });
  res.json({ id: ref.id, status: "ready", url: `/api/media/${ref.id}` });
});

// Same-tenant accounts only (staff/parents of that provider included); a short-lived signed link, never a public bucket.
media.get("/:id", async (req, res) => {
  const auth = req.auth!;
  const snap = await col.doc(String(req.params.id)).get();
  if (!snap.exists || snap.get("status") !== "ready" || snap.get("tenantId") !== auth.tenantId) { res.status(404).json({ error: "Not found" }); return; }
  const [url] = await bucket().file(snap.get("objectPath") as string).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60_000 });
  res.setHeader("Cache-Control", "private, no-store");
  res.redirect(302, url);
});
