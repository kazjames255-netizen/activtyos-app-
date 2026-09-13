"use client";

// Documents library + read receipts + files, on the server (routes/documents.ts
// /library, /files). The screens used to keep all three in localStorage — the
// record of who had read which policy existed on one laptop only.

import { typeOf } from "@/features/listings/planUpload";
import { api, get as apiGet, openFile, post as apiPost, put as apiPut } from "@/lib/api";

export interface DocRead { docId: string; version: number; staffEmail: string; staffName: string; at: string }
export interface TeamMember { name: string; email: string; role: string; listings: string[] }
export interface LibraryResp<D> { docs: D[] | null; reads: DocRead[]; team?: TeamMember[]; me?: TeamMember }

export const fetchLibrary = <D,>() => apiGet<LibraryResp<D>>("/api/documents/library");
export const saveLibrary = <D,>(docs: D[]) => apiPut<{ ok: true }>("/api/documents/library", { docs });
export const confirmRead = (docId: string, version: number, on: boolean) =>
  apiPost<{ ok: true; version?: number; at?: string }>(`/api/documents/library/${encodeURIComponent(docId)}/read`, { version, on });
export const chaseUnread = () => apiPost<{ ok: true; people: number }>("/api/documents/library/chase", {});

const CHUNK = 480_000;
export const DOC_FILE_MAX = 15_000_000;
const toB64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => { const u = String(r.result); res(u.slice(u.indexOf(",") + 1)); };
  r.onerror = () => rej(r.error ?? new Error("read failed"));
  r.readAsDataURL(blob);
});

/** Upload a PDF/photo in chunks; returns its id. */
export async function uploadDocFile(file: Blob & { name?: string }): Promise<string> {
  if (file.size > DOC_FILE_MAX) throw new Error(`That file is ${Math.round(file.size / 1024 / 1024)}MB — the limit is 15MB.`);
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  const { id } = await apiPost<{ id: string }>("/api/documents/files", { name: file.name || "document", contentType: typeOf(file), bytes: file.size, total });
  for (let i = 0; i < total; i += 1) {
    await api(`/api/documents/files/${id}/chunks/${i}`, { method: "PUT", body: JSON.stringify({ b64: await toB64(file.slice(i * CHUNK, (i + 1) * CHUNK)) }) });
  }
  await apiPost(`/api/documents/files/${id}/done`, {});
  return id;
}

/** A data URL (a document saved before files moved server-side) → a file id. */
export async function uploadDataUrl(dataUrl: string, name: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return uploadDocFile(Object.assign(blob, { name }));
}

/** Open a stored file in a new tab (the server only serves PDFs/photos inline). */
export const openDocFile = (fileId: string) =>
  openFile(`/api/documents/files/${encodeURIComponent(fileId)}`).catch((e) => alert(e instanceof Error ? e.message : "Couldn't open that document."));
