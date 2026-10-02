// Uploading a SEND/EHCP plan.
//
// There's no storage bucket on this project yet, and a Firestore document caps
// at 1MB, so a multi-page scan can't go up in one piece. It's split here into
// base64 chunks, each sent on its own request, and the server reassembles it.
// See server/src/routes/childFiles.ts for the other half.

import { api } from "@/lib/api";

/** Raw bytes per chunk. Base64 inflates by a third, which keeps each request
 *  body — and each Firestore document — comfortably clear of its limit. */
const CHUNK_BYTES = 480_000;

/** What one plan may weigh. Generous enough for a scanned EHCP; the server
 *  enforces the same ceiling, so this is a courtesy, not the control. */
export const PLAN_MAX_BYTES = 15_000_000;

/** Base64 for a slice, without the `data:…;base64,` preamble a FileReader adds. */
async function sliceToB64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

export type PlanRef = { id: string; name: string; bytes: number };

/** iPhones hand over HEIC photos (and some browsers PDFs) with no MIME type —
 *  the server only accepts known types, so read it off the extension. */
export const BY_EXT: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" };
export const typeOf = (file: Blob & { name?: string }) => file.type || BY_EXT[((file.name ?? "").split(".").pop() ?? "").toLowerCase()] || "application/octet-stream";

/** Phone photos are 3-8MB of pixels nobody needs to read a plan: shrink them (longest side 2200px, JPEG ~0.82) before upload. PDFs, GIFs and anything
 *  the browser can't decode (e.g. HEIC outside Safari) go up untouched; if shrinking doesn't make it smaller, the original is used. */
async function shrinkImage(file: File): Promise<File> {
  const type = typeOf(file);
  if (!/^image\/(jpeg|png|webp)$/.test(type) || file.size < 600_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // a transparent PNG becomes white, not black, as a JPEG
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** How many chunks are in flight at once. Sending them one after another made a 10MB scan a dozen round trips in a row. */
const PARALLEL = 4;

/**
 * Uploads a file and returns the reference to store on the child. `onProgress`
 * gets 0–1 as chunks land, because a 12MB scan on a phone is not instant and
 * a frozen button reads as a broken one.
 */
export async function uploadPlan(original: File, onProgress?: (frac: number) => void): Promise<PlanRef> {
  if (original.size > PLAN_MAX_BYTES) {
    throw new Error(`${original.name} is ${Math.round(original.size / 1024 / 1024)}MB — the limit is ${PLAN_MAX_BYTES / 1_000_000}MB.`);
  }
  const file = await shrinkImage(original);
  const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  const { id } = await api<{ id: string }>("/api/my/files", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      contentType: typeOf(file),
      bytes: file.size,
      total,
    }),
  });
  // chunks are addressed by index, so they can land in any order; a small pool keeps the connection busy without flooding the server
  let next = 0, done = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const b64 = await sliceToB64(file.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
      await api(`/api/my/files/${id}/chunks/${i}`, { method: "PUT", body: JSON.stringify({ b64 }) });
      done += 1;
      onProgress?.(done / total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, () => worker()));
  // The server counts the parts itself before it will serve the file, so a
  // dropped chunk surfaces here rather than as an unopenable plan later.
  await api(`/api/my/files/${id}/done`, { method: "POST" });
  return { id, name: file.name, bytes: file.size };
}
