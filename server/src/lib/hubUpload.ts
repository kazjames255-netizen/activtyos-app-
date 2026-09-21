// Learning Hub — validation for a file a PARENT uploads (a photo/PDF of a
// child's homework). Parents can't call POST /api/uploads (operators only), so
// homework has its own path (routes/hub/homeworkApi.ts) — with the SAME rules
// as routes/uploads.ts: image mimes are magic-byte sniffed, a PDF must really
// start "%PDF-", and the size caps are the same (both sit under Firestore's
// 1MiB document limit, because the bytes are stored in an `images` doc).
// If uploads.ts's rules change, change them here too.

const MAX_BYTES = 750_000; // see routes/uploads.ts — 900KB of base64 overflows a 1MiB doc
const MAX_PDF_B64 = 1_000_000;

const IMAGE_MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.length >= 6 && (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a"),
  "image/webp": (b) => b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

const DATA_URL = /^data:(image\/(jpeg|png|webp|gif)|application\/pdf);base64,/;

export type UploadCheck = { ok: true; contentType: string; b64: string; bytes: number } | { ok: false; status: number; error: string };

export function checkDataUrl(dataUrl: unknown): UploadCheck {
  if (typeof dataUrl !== "string" || !DATA_URL.test(dataUrl)) return { ok: false, status: 400, error: "Must be a base64 image (or PDF) data URL" };
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const contentType = head.slice("data:".length, head.indexOf(";"));
  const bytes = Math.floor((b64.length * 3) / 4);
  if (contentType === "application/pdf") {
    if (!b64.startsWith("JVBERi0")) return { ok: false, status: 400, error: "That file isn't a valid PDF" };
    if (b64.length > MAX_PDF_B64) return { ok: false, status: 413, error: `PDF too large (${Math.ceil(bytes / 1000)}KB — max ${Math.floor((MAX_PDF_B64 * 3) / 4 / 1000)}KB). Save a smaller PDF or upload a photo instead.` };
  } else {
    if (bytes > MAX_BYTES) return { ok: false, status: 413, error: `Image too large (${Math.round(bytes / 1024)}KB — max ${MAX_BYTES / 1000}KB)` };
    const magic = IMAGE_MAGIC[contentType];
    if (!magic || !magic(Buffer.from(b64.slice(0, 32), "base64"))) return { ok: false, status: 400, error: "That file's contents don't match its declared image type" };
  }
  return { ok: true, contentType, b64, bytes };
}
