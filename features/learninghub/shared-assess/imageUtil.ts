import { post } from "@/lib/api";

// Client-side helpers for question pictures. The server accepts PNG / JPEG / WebP /
// GIF up to 750 KB, so a phone photo (often 3–6 MB) is scaled down on a canvas
// first — aspect kept, WebP/JPEG quality stepped — so photos just work. Nothing
// here decides what a picture MEANS; it only gets bytes small enough to upload.

/** The API's ceiling (bytes, decoded). We aim a little under it. */
export const MAX_IMAGE_BYTES = 750_000;
const TARGET = 700_000;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = ACCEPT.join(",");

export interface Prepared { dataUrl: string; bytes: number; width: number; height: number; resized: boolean; type: string }

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That doesn't look like a picture we can open."));
    img.src = src;
  });
}

let webpOk: boolean | null = null;
function canWebp(): boolean {
  if (webpOk == null) {
    try { webpOk = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp"); } catch { webpOk = false; }
  }
  return webpOk;
}

/** Validate and (if needed) shrink an image file so it fits the upload limit. Throws a friendly Error. */
export async function prepareImage(file: Blob): Promise<Prepared> {
  if (!ACCEPT.includes(file.type)) throw new Error("Please choose a PNG, JPEG, WebP or GIF picture.");
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error("That picture looks empty.");
  // Small enough and a sensible size already: send it untouched (keeps GIFs animated, PNGs crisp).
  if (bytesOf(original) <= TARGET && Math.max(w0, h0) <= 2400) {
    return { dataUrl: original, bytes: bytesOf(original), width: w0, height: h0, resized: false, type: file.type };
  }

  const useWebp = canWebp();
  const type = useWebp ? "image/webp" : "image/jpeg";
  let maxDim = Math.min(1600, Math.max(w0, h0));
  for (let round = 0; round < 6; round++) {
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't shrink that picture. Try a smaller one.");
    if (!useWebp) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }   // JPEG has no alpha: flatten onto white
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.88, 0.8, 0.72, 0.64, 0.56, 0.48]) {
      const out = canvas.toDataURL(type, q);
      if (bytesOf(out) <= TARGET) return { dataUrl: out, bytes: bytesOf(out), width: w, height: h, resized: true, type };
    }
    maxDim = Math.round(maxDim * 0.78);
  }
  throw new Error("That picture is too detailed to shrink enough. Try a smaller one or crop it first.");
}

export const fmtKb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Upload as a private hub file; returns the file id + a signed URL for showing it straight away. */
export async function uploadHubImage(dataUrl: string): Promise<{ id: string; url: string }> {
  return post<{ id: string; url: string }>("/api/uploads", { dataUrl, purpose: "private", kind: "hub" });
}

/** First image file on a clipboard / drop payload. */
export function imageFrom(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files ?? [])) if (f.type.startsWith("image/")) return f;
  for (const it of Array.from(dt.items ?? [])) if (it.kind === "file" && it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) return f; }
  return null;
}
