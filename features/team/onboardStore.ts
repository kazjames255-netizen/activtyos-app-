"use client";

// Staff onboarding / Single Central Record — the server store (routes/
// onboarding.ts). The screens used to keep the whole record, ID scans and all,
// in this browser's localStorage. That key ("aos.team.onboardrecords.v1") is
// now only a cache of what the server holds, so the screens that read it
// synchronously (payroll, staff tasks) keep working.
//
// Files: a value holding a fresh upload carries `fileData` (a data URL) until
// it's saved; saving uploads it (chunked) and keeps only its `fileId`.
// Opening a record fetches its files back (hydrateFiles), so print packs and
// previews work as they did.

import { api, fetchBlob, get as apiGet, isDemoMode, post as apiPost, put as apiPut } from "@/lib/api";
import { typeOf } from "@/features/listings/planUpload";
import { DEMO_STAFF } from "@/features/learning/credentials";

const DEMO_NAMES = new Set(DEMO_STAFF.map((s) => s.name));

export const ONBOARD_FKEY = "aos.team.onboardfields.v1";
export const ONBOARD_RKEY = "aos.team.onboardrecords.v1";
/** Where this browser's pre-server records are kept until someone imports them. */
export const ONBOARD_LOCAL_BACKUP = "aos.team.onboardrecords.local-backup.v1";

type Value = { v?: string; fileData?: string; fileId?: string; fileName?: string; status?: string; at?: string };
export type StoredRecord = { staff: string; values: Record<string, Value>; extra: string[]; submittedAt?: string; outstanding?: string[]; lastEditedAt?: string };

const read = <T,>(k: string, fb: T): T => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return (v ?? fb) as T; } catch { return fb; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore — a scan can exceed the quota; the server has it */ } };
/** The cache, without file bodies (a few scans would blow the 5MB quota). */
const slim = (recs: StoredRecord[]) => recs.map((r) => ({ ...r, values: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v.fileId ? { ...v, fileData: undefined } : v])) }));

export async function fetchOnboarding<F>(): Promise<{ fields: F[] | null; records: StoredRecord[] }> {
  if (isDemoMode()) return { fields: read<F[] | null>(ONBOARD_FKEY, null), records: read<StoredRecord[]>(ONBOARD_RKEY, []) };
  const r = await apiGet<{ fields: F[] | null; records: StoredRecord[] }>("/api/onboarding");
  if (r.fields) write(ONBOARD_FKEY, r.fields);
  write(ONBOARD_RKEY, slim(r.records));
  return r;
}

export async function saveOnboardFields<F>(fields: F[]): Promise<void> {
  write(ONBOARD_FKEY, fields);
  if (!isDemoMode()) await apiPut("/api/onboarding/fields", { fields });
}

const CHUNK = 480_000;
const b64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => { const u = String(r.result); res(u.slice(u.indexOf(",") + 1)); }; r.onerror = () => rej(r.error ?? new Error("read failed")); r.readAsDataURL(blob); });

async function uploadDataUrl(staff: string, dataUrl: string, name: string): Promise<string> {
  const blob = Object.assign(await (await fetch(dataUrl)).blob(), { name });
  if (blob.size > 15_000_000) throw new Error(`${name} is ${Math.round(blob.size / 1024 / 1024)}MB — the limit is 15MB.`);
  const total = Math.max(1, Math.ceil(blob.size / CHUNK));
  const { id } = await apiPost<{ id: string }>("/api/onboarding/files", { staff, name: name || "document", contentType: typeOf(blob), bytes: blob.size, total });
  for (let i = 0; i < total; i += 1) await api(`/api/onboarding/files/${id}/chunks/${i}`, { method: "PUT", body: JSON.stringify({ b64: await b64(blob.slice(i * CHUNK, (i + 1) * CHUNK)) }) });
  await apiPost(`/api/onboarding/files/${id}/done`, {});
  return id;
}

/** Save one person's record: new uploads go up first, then the record (with
 *  file ids, not file bodies). Returns the record as saved, bodies kept. */
export async function saveOnboardRecord(rec: StoredRecord): Promise<StoredRecord> {
  const out: StoredRecord = { ...rec, values: { ...rec.values } };
  if (!isDemoMode()) {
    for (const [k, v] of Object.entries(out.values)) {
      if (v?.fileData && !v.fileId) out.values[k] = { ...v, fileId: await uploadDataUrl(rec.staff, v.fileData, v.fileName || k) };
    }
    const body = { values: Object.fromEntries(Object.entries(out.values).map(([k, v]) => [k, { ...v, fileData: undefined }])), extra: out.extra ?? [], submittedAt: out.submittedAt, outstanding: out.outstanding, lastEditedAt: out.lastEditedAt };
    await apiPut(`/api/onboarding/records/${encodeURIComponent(rec.staff)}`, body);
  }
  const all = read<StoredRecord[]>(ONBOARD_RKEY, []);
  write(ONBOARD_RKEY, slim(all.some((r) => r.staff === rec.staff) ? all.map((r) => (r.staff === rec.staff ? out : r)) : [...all, out]));
  return out;
}

const dataUrlCache = new Map<string, string>();
/** Fetch a stored file back as a data URL (cached for the page's life). */
export async function fileDataUrl(fileId: string): Promise<string> {
  const hit = dataUrlCache.get(fileId);
  if (hit) return hit;
  const blob = await fetchBlob(`/api/onboarding/files/${encodeURIComponent(fileId)}`);
  const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  dataUrlCache.set(fileId, url);
  return url;
}

/** The record with every stored file's body filled back in (for previews,
 *  the photo, and the printable pack). */
export async function hydrateFiles<R extends StoredRecord>(rec: R): Promise<R> {
  const values = { ...rec.values };
  await Promise.all(Object.entries(values).map(async ([k, v]) => {
    if (v?.fileId && !v.fileData) { try { values[k] = { ...v, fileData: await fileDataUrl(v.fileId) }; } catch { /* leave it as a link */ } }
  }));
  return { ...rec, values };
}

/** Pre-server records still in this browser, not yet imported. They're kept
 *  aside rather than uploaded automatically: a browser isn't tied to one
 *  account, and a safer-recruitment record must not land in the wrong
 *  provider's tenant. The screen offers Import / Discard. */
export function localBackup(): StoredRecord[] {
  // Filtered at read time too, not just in stashLocalOnce — a browser that stashed before this
  // filter existed still has the demo cast sitting in ONBOARD_LOCAL_BACKUP.
  return typeof window === "undefined" ? [] : read<StoredRecord[]>(ONBOARD_LOCAL_BACKUP, []).filter((r) => !DEMO_NAMES.has(r.staff));
}
export function stashLocalOnce(): void {
  if (typeof window === "undefined" || isDemoMode()) return;
  if (localStorage.getItem("aos.team.onboard.stashed.v1")) return;
  // Filter out the guided-tour demo cast (e.g. "Marcus Bell") — this key can hold demo-mode
  // seed data from before the server migration, and offering to "import" it into a real
  // account's onboarding records would contaminate a genuine tenant with fixture data.
  const cur = read<StoredRecord[]>(ONBOARD_RKEY, []).filter((r) => !DEMO_NAMES.has(r.staff));
  if (cur.length) write(ONBOARD_LOCAL_BACKUP, cur);
  localStorage.setItem("aos.team.onboard.stashed.v1", "1");
}
export async function importLocalBackup(): Promise<number> {
  const list = localBackup();
  for (const r of list) await saveOnboardRecord({ ...r, values: r.values ?? {}, extra: r.extra ?? [] });
  try { localStorage.removeItem(ONBOARD_LOCAL_BACKUP); } catch { /* ignore */ }
  return list.length;
}
export function discardLocalBackup(): void { try { localStorage.removeItem(ONBOARD_LOCAL_BACKUP); } catch { /* ignore */ } }
