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

/**
 * Uploads a file and returns the reference to store on the child. `onProgress`
 * gets 0–1 as chunks land, because a 12MB scan on a phone is not instant and
 * a frozen button reads as a broken one.
 */
export async function uploadPlan(file: File, onProgress?: (frac: number) => void): Promise<PlanRef> {
  if (file.size > PLAN_MAX_BYTES) {
    throw new Error(`${file.name} is ${Math.round(file.size / 1024 / 1024)}MB — the limit is ${PLAN_MAX_BYTES / 1_000_000}MB.`);
  }
  const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  const { id } = await api<{ id: string }>("/api/my/files", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      contentType: file.type || "application/octet-stream",
      bytes: file.size,
      total,
    }),
  });
  for (let i = 0; i < total; i += 1) {
    const b64 = await sliceToB64(file.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
    await api(`/api/my/files/${id}/chunks/${i}`, { method: "PUT", body: JSON.stringify({ b64 }) });
    onProgress?.((i + 1) / total);
  }
  // The server counts the parts itself before it will serve the file, so a
  // dropped chunk surfaces here rather than as an unopenable plan later.
  await api(`/api/my/files/${id}/done`, { method: "POST" });
  return { id, name: file.name, bytes: file.size };
}
