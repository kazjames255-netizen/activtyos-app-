import { get, post, put } from "@/lib/api";
import { withQs } from "../../teachKit";
import { fmtKb, MAX_IMAGE_BYTES } from "../../shared-assess/imageUtil";
import { drawPage, contentBounds, ImageCache, type Env, type Paper } from "./render";
import type { Page } from "./model";

// Export: render a page to a PNG (small enough for the hub's 750 KB upload limit),
// download it, or save it into the lesson's notes so students can revisit the board.

const TARGET = 700_000;

const noImages = { get: () => ({ img: null, state: "bad" as const }), settled: async () => undefined } as unknown as ImageCache;

export interface ExportSource { paper: Paper; images: ImageCache }

function renderPage(src: ExportSource, page: Page, scale: number, images: ImageCache, label?: string): HTMLCanvasElement {
  const b = contentBounds(page, 36);
  const head = label ? 46 : 0;
  const w = Math.max(320, Math.round(b.w * scale)), h = Math.max(200, Math.round(b.h * scale)) + head;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const env: Env = { k: scale, paper: src.paper, images, forExport: true };
  drawPage(ctx, page, { k: scale, x: -b.x * scale, y: -b.y * scale + head }, w, h, 1, env);
  if (label) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = src.paper.paper; ctx.fillRect(0, 0, w, head);
    ctx.fillStyle = src.paper.brand; ctx.font = `800 22px ${src.paper.font}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(label, 16, head / 2);
    ctx.strokeStyle = src.paper.gridStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, head - 0.5); ctx.lineTo(w, head - 0.5); ctx.stroke();
  }
  return canvas;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((res) => { try { c.toBlob((b) => res(b), type, q); } catch { res(null); } });

/** A page as an image blob ≤ 700 KB: PNG first, shrinking, then JPEG. */
export async function pageToBlob(src: ExportSource, page: Page, label?: string): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
  await src.images.settled();
  const b = contentBounds(page, 36);
  let scale = Math.min(2, 1800 / Math.max(b.w, b.h));
  let images: ImageCache = src.images;
  for (let round = 0; round < 7; round++) {
    let canvas = renderPage(src, page, scale, images, label);
    let blob = await toBlob(canvas, "image/png");
    if (!blob && images !== noImages) { images = noImages; canvas = renderPage(src, page, scale, images, label); blob = await toBlob(canvas, "image/png"); } // a picture tainted the canvas
    if (blob && blob.size <= TARGET) return { blob, ext: "png" };
    if (round >= 2) {
      for (const q of [0.9, 0.78, 0.66, 0.5]) {
        const j = await toBlob(canvas, "image/jpeg", q);
        if (j && j.size <= TARGET) return { blob: j, ext: "jpg" };
      }
    }
    scale *= 0.78;
  }
  throw new Error(`This page is too detailed to save as a picture (limit ${fmtKb(MAX_IMAGE_BYTES)}). Try zooming out or clearing some of it.`);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const readAsDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error("Couldn't read the picture."));
  r.readAsDataURL(b);
});

const dayLabel = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "board";

export interface SaveOpts {
  src: ExportSource; lessonId: string; qs: string; lessonTitle: string;
  /** What to save: each page (with an optional caption such as a student's name). */
  pages: { page: Page; label?: string }[];
  /** "Board" or "Student work" — the start of the note's title. */
  kind?: string;
  /** Notes already attached to the lesson. */
  noteIds: string[]; topicId: string | null | undefined; fallbackTopicId: string | null;
}
export interface SaveResult { noteId: string; title: string; pages: number }

/** Board → private hub image(s) → a note titled "Board — <lesson> · <date>" → attached to the lesson. */
export async function saveToLessonNotes(o: SaveOpts): Promise<SaveResult> {
  const topicId = o.topicId || o.fallbackTopicId;
  if (!topicId) throw new Error("Add a topic in the Lessons tab first — every lesson is filed under one.");
  if (!o.pages.length) throw new Error("There is nothing on the board to save yet.");
  if (o.pages.length > 10) throw new Error("A lesson holds up to 10 pictures — save fewer pages at a time.");
  const atts: { id: string; name: string }[] = [];
  for (let i = 0; i < o.pages.length; i++) {
    const { blob, ext } = await pageToBlob(o.src, o.pages[i]!.page, o.pages[i]!.label);
    const up = await post<{ id: string; url: string }>("/api/uploads", { dataUrl: await readAsDataUrl(blob), purpose: "private", kind: "hub" });
    atts.push({ id: up.id, name: `${slug(o.pages[i]!.label ?? o.lessonTitle)}${o.pages.length > 1 ? `-${i + 1}` : ""}.${ext}` });
  }
  const title = `${o.kind ?? "Board"} — ${o.lessonTitle} · ${dayLabel()}`.slice(0, 200);
  const note = await post<{ id: string }>(`/api/learning-hub/notes${withQs(o.qs, {})}`, { topicId, title, body: o.kind === "Student work" ? "Saved from the lesson's student workings." : "Saved from the live lesson whiteboard.", published: o.kind !== "Student work", kind: "board" as const, attachments: atts }); // students' private workings are never published to other families
  await put(`/api/learning-hub/lessons/${o.lessonId}${withQs(o.qs, {})}`, { noteIds: [...new Set([...o.noteIds, note.id])].slice(0, 12) });
  return { noteId: note.id, title, pages: o.pages.length };
}

/** Hub pictures a tutor can put on the board: the image attachments of their notes. */
export interface HubPic { id: string; url: string; name: string; from: string }
export async function loadHubPictures(qs: string): Promise<HubPic[]> {
  const notes = await get<{ id: string; title: string; attachments?: { id: string; name: string; contentType: string; url: string }[] }[]>(`/api/learning-hub/notes${withQs(qs, {})}`);
  const out: HubPic[] = [];
  for (const n of Array.isArray(notes) ? notes : []) for (const a of n.attachments ?? []) if (a.contentType?.startsWith("image/")) out.push({ id: a.id, url: a.url, name: a.name, from: n.title });
  return out;
}
