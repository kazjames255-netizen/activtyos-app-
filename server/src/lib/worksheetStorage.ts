// Firebase Storage for a lesson's Oak WORKSHEET PDF (oak/worksheetBulk.ts writes, GET /notes/:id/worksheet reads).
//   object path: tenants/<tenantId>/oak-worksheets/<noteId>.pdf   (private bucket; the only way a browser reaches it is a short-lived V4 signed URL)
//   note field:  worksheetFile: { name, size, pages?, source, fetchedAt }   (a POINTER only — the path is derived from the note's OWN tenantId + id, never stored or taken from a client)
import { slideBucket } from "./slideStorage";

export interface WorksheetFile { name: string; size: number; pages?: number; source?: string; fetchedAt?: string }
const ID = /^[A-Za-z0-9_-]{1,100}$/;
export const worksheetPath = (tenantId: string, noteId: string) => `tenants/${tenantId}/oak-worksheets/${noteId}.pdf`;

export async function hasWorksheetObject(tenantId: string, noteId: string): Promise<boolean> {
  if (!ID.test(noteId) || !ID.test(tenantId)) return false;
  return (await slideBucket().file(worksheetPath(tenantId, noteId)).exists())[0];
}
export async function putWorksheetObject(tenantId: string, noteId: string, bytes: Buffer): Promise<void> {
  if (!ID.test(noteId) || !ID.test(tenantId)) throw new Error("bad id");
  await slideBucket().file(worksheetPath(tenantId, noteId)).save(bytes, { contentType: "application/pdf", resumable: false, metadata: { cacheControl: "private, max-age=3600" } });
}
/** Copy a note's worksheet PDF to another note/tenant (fork-on-edit of a shared-library lesson). False = nothing copied. */
export async function copyWorksheetObject(fromTenant: string, fromNote: string, toTenant: string, toNote: string): Promise<boolean> {
  if (![fromTenant, fromNote, toTenant, toNote].every((x) => ID.test(x))) return false;
  try {
    const src = slideBucket().file(worksheetPath(fromTenant, fromNote));
    if (!(await src.exists())[0]) return false;
    await src.copy(slideBucket().file(worksheetPath(toTenant, toNote)));
    return true;
  } catch { return false; }
}
/** Short-lived (15 min) signed URL, served inline so it can be embedded in an <iframe>/<object>. */
export async function signWorksheet(tenantId: string, noteId: string, name: string): Promise<string | null> {
  if (!ID.test(noteId) || !ID.test(tenantId)) return null;
  const safe = name.replace(/[^\w .()-]/g, "_").slice(0, 120) || "worksheet";
  const [url] = await slideBucket().file(worksheetPath(tenantId, noteId)).getSignedUrl({
    version: "v4", action: "read", expires: Date.now() + 15 * 60_000,
    responseType: "application/pdf", responseDisposition: `inline; filename="${safe}.pdf"`,
  });
  return url;
}
