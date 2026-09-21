import type { Request } from "express";
import { db } from "../firebase";
import { okId } from "./hubCore";
import { signImageUrl } from "./signing";

// Learning Hub — pictures on questions and answer options. The files are ordinary
// private hub uploads (POST /api/uploads {purpose:"private", kind:"hub"}); a
// question only ever stores the id, and every student-facing payload turns it
// into a SHORT-LIVED signed link (lib/signing.ts) — never a bare id.
//
// Files a question uses are tagged `hubUse:"question"` on their `images` doc so
// nothing else can claim them (a note's attachment clean-up never deletes one,
// and a question can't borrow a note's file or a family's homework upload), and
// `inAttempt:true` once an attempt snapshot points at them (a child's past result
// must keep its pictures even after the tutor edits or deletes the question).

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const imagesCol = db.collection("images");

export const imageBase = (req: Request) => `${req.protocol}://${req.get("host")}/api/images`;
export const signedImage = (base: string, id: string): string => signImageUrl(`${base}/${id}`) as string;

/** Oak's own question pictures are hosted by Oak (the importer stores {url, alt}, no upload id). Only that host is ever passed through,
 *  and only from a stored question — a tutor can't set a url through the question API (it takes upload ids only). */
const EXTERNAL_PIC = /^https:\/\/oaknationalacademy-res\.cloudinary\.com\//;
export type StoredPic = { id?: string; url?: string; alt?: string } | null | undefined;
/** A stored picture (upload id or Oak url) → what a student's browser gets: a short-lived signed link, or Oak's own https link. */
export function pictureOf(base: string, p: StoredPic): { url: string; alt: string } | null {
  if (p?.id) return { url: signedImage(base, p.id), alt: p.alt ?? "" };
  if (p?.url && EXTERNAL_PIC.test(p.url)) return { url: p.url, alt: p.alt ?? "" };
  return null;
}

/** Every image id a stored question uses (its own picture + option pictures). */
export function questionImageIds(q: { image?: { id: string } | null; options?: { image?: { id: string } | null }[] }): string[] {
  const ids = new Set<string>();
  if (q.image?.id) ids.add(q.image.id);
  for (const o of q.options ?? []) if (o.image?.id) ids.add(o.image.id);
  return [...ids];
}

/** Are these ids THIS tenant's private hub images (PNG/JPEG/WebP/GIF, not a homework hand-in,
 *  not a note's file)? Returns a message for a 400, or null when fine — and claims them for questions. */
export async function claimQuestionImages(tenantId: string, ids: string[]): Promise<string | null> {
  const list = [...new Set(ids)];
  if (!list.length) return null;
  if (list.some((id) => !okId(id))) return "That picture isn't valid";
  const snaps = await db.getAll(...list.map((id) => imagesCol.doc(id)), { fieldMask: ["tenantId", "contentType", "private", "kind", "submissionId", "hubUse"] });
  for (const s of snaps) {
    if (!s.exists || s.get("tenantId") !== tenantId || s.get("private") !== true || s.get("kind") !== "hub" || s.get("submissionId")) return "A picture wasn't uploaded for the Teaching Hub";
    if (!IMAGE_TYPES.has(String(s.get("contentType")))) return "Pictures must be PNG, JPEG, WebP or GIF";
    if (s.get("hubUse") && s.get("hubUse") !== "question") return "That file is already used elsewhere — upload the picture again";
  }
  // A note's attachment is that note's to manage: refuse to reuse it as a question picture.
  const notes = await db.collection("hubNotes").where("tenantId", "==", tenantId).select("attachments").get();
  const noteFiles = new Set(notes.docs.flatMap((d) => ((d.get("attachments") as { id?: string }[] | undefined) ?? []).map((a) => a.id)));
  if (list.some((id) => noteFiles.has(id))) return "That file is already attached to a lesson — upload the picture again";
  const fresh = snaps.filter((s) => s.get("hubUse") !== "question");
  if (fresh.length) {
    const b = db.batch();
    for (const s of fresh) b.update(s.ref, { hubUse: "question" });
    await b.commit();
  }
  return null;
}

/** An attempt snapshot now points at these pictures: keep them for as long as the result exists. */
export async function pinAttemptImages(tenantId: string, ids: string[]): Promise<void> {
  const list = [...new Set(ids)].filter(okId);
  if (!list.length) return;
  try {
    const b = db.batch();
    for (const id of list) b.set(imagesCol.doc(id), { inAttempt: true }, { merge: true });
    await b.commit();
  } catch (e) { console.error("[hub] pinning question images failed:", (e as Error).message); }
}

/** Best-effort: delete pictures no question uses any more (and no attempt snapshot pins). */
export async function dropQuestionImages(tenantId: string, candidateIds: string[]): Promise<void> {
  const cands = [...new Set(candidateIds)].filter(okId);
  if (!cands.length) return;
  try {
    const qs = await db.collection("hubQuestions").where("tenantId", "==", tenantId).select("image", "options").get();
    const used = new Set(qs.docs.flatMap((d) => questionImageIds(d.data() as Parameters<typeof questionImageIds>[0])));
    await Promise.all(cands.filter((id) => !used.has(id)).map(async (id) => {
      const s = await imagesCol.doc(id).get();
      if (s.exists && s.get("tenantId") === tenantId && s.get("kind") === "hub" && s.get("hubUse") === "question" && !s.get("inAttempt") && !s.get("submissionId")) await s.ref.delete();
    }));
  } catch { /* best-effort */ }
}
