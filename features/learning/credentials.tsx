"use client";

// Staff credentials / certificates — the shared model + store + editor used by
// both the staff "My Certificates" self-service area and the manager oversight
// grid. Credential TYPES are fully user-managed (add your own, delete defaults);
// each staff member holds RECORDS against a type (file, dates, number, verify
// state). Front-end demo store; real file storage + verification persistence are
// Amir's (see handoff).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";

export interface CredType {
  id: string; name: string; required: boolean; renewMonths: number; needsFile: boolean; dbs?: boolean;
  applyKind?: "all" | "roles" | "staff"; applyRoles?: string[]; applyStaff?: string[]; // who this credential is required for
}
export const DEMO_STAFF: { name: string; role: string }[] = [
  { name: "Marcus Bell", role: "Lead" }, { name: "Jess Patel", role: "Coach" }, { name: "Aisha Rahman", role: "Lead" },
  { name: "Tom Lewis", role: "Coach" }, { name: "Priya Khan", role: "Coach" }, { name: "Dan Reed", role: "Lead" },
];
// does a credential apply to (is it required of) this staff member?
export function appliesTo(t: CredType, staffName: string, staffRole?: string): boolean {
  const k = t.applyKind ?? "all";
  if (k === "all") return true;
  if (k === "staff") return (t.applyStaff ?? []).includes(staffName);
  if (k === "roles") return (t.applyRoles ?? []).some((r) => { const rl = r.toLowerCase(), sr = (staffRole ?? "").toLowerCase(); return !!sr && (rl.includes(sr) || sr.includes(rl.split(/[ /]/)[0])); });
  return true;
}
export const targetLabel = (t: CredType): string => { const k = t.applyKind ?? "all"; if (k === "all") return "All staff"; if (k === "roles") return (t.applyRoles ?? []).join(", ") || "no roles"; return (t.applyStaff ?? []).join(", ") || "no staff"; };
export interface CredRecord {
  id: string; staff: string; typeId: string;
  issue?: string; expiry?: string; issuer?: string; number?: string;
  fileData?: string; fileName?: string;
  verified: "pending" | "verified" | "rejected"; note?: string;
  dbsLevel?: string; dbsUpdate?: boolean; dbsUpdateNo?: string; // DBS extras
  updatedAt?: string;
}

export const CRED_TKEY = "aos.learn.credtypes.v1";
export const CRED_RKEY = "aos.learn.credrecords.v1";

export const DEFAULT_CRED_TYPES: CredType[] = [
  { id: "dbs", name: "DBS Check", required: true, renewMonths: 36, needsFile: true, dbs: true },
  { id: "pfa", name: "Paediatric First Aid", required: true, renewMonths: 36, needsFile: true },
  { id: "safeguarding", name: "Safeguarding Training", required: true, renewMonths: 24, needsFile: true },
  { id: "faw", name: "First Aid at Work", required: false, renewMonths: 36, needsFile: true },
  { id: "food", name: "Food Hygiene (Level 2)", required: false, renewMonths: 36, needsFile: true },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (base: Date, m: number) => new Date(base.getFullYear(), base.getMonth() + m, base.getDate());
export const fmtDate = (s?: string) => { if (!s) return "—"; const d = new Date(s + "T00:00:00"); return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
export const daysUntil = (s?: string): number | null => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; return Math.round((new Date(s + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000); };

export type CredStatus = "Valid" | "Expiring" | "Expired" | "Pending" | "Rejected" | "Missing";
export function credStatus(r?: CredRecord): CredStatus {
  if (!r) return "Missing";
  if (r.verified === "rejected") return "Rejected";
  if (r.verified === "pending") return "Pending";
  const d = daysUntil(r.expiry);
  if (d == null) return "Valid";
  if (d < 0) return "Expired";
  if (d <= 60) return "Expiring";
  return "Valid";
}
export const CRED_TONE: Record<CredStatus, string> = {
  Valid: "bg-[#e2f4ea] text-[#0f7a43]", Expiring: "bg-[#fcefd2] text-[#b45309]", Expired: "bg-[#fdecec] text-[#c0392b]",
  Pending: "bg-[#eaf1ff] text-[#1d54c4]", Rejected: "bg-[#fdecec] text-[#c0392b]", Missing: "bg-[#eef1f6] text-[#64748b]",
};
export const CredBadge = ({ s }: { s: CredStatus }) => <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + CRED_TONE[s]}>{s}</span>;

// seed a demo record set from the staff RAG statuses (relative to today so the
// Valid/Expiring/Expired demo stays correct whatever the clock says)
export function seedRecords(staff: { name: string; dbs: string; pfa: string }[]): CredRecord[] {
  const now = new Date();
  const out: CredRecord[] = [];
  const push = (name: string, typeId: string, kind: string, issuer: string) => {
    if (kind === "Missing") return;
    let expiry: string | undefined; let verified: CredRecord["verified"] = "verified";
    if (kind === "Expiring") expiry = iso(addMonths(now, 1));
    else if (kind === "Expired") expiry = iso(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
    else if (kind === "Pending") verified = "pending";
    else expiry = iso(addMonths(now, 30)); // Valid
    out.push({ id: typeId + "-" + name.replace(/\s+/g, ""), staff: name, typeId, issue: iso(addMonths(now, -6)), expiry, issuer, number: typeId === "dbs" ? "0012" + Math.abs([...name].reduce((h, c) => h * 7 + c.charCodeAt(0), 3)).toString().slice(0, 8) : undefined, verified, dbsLevel: typeId === "dbs" ? "Enhanced" : undefined, dbsUpdate: typeId === "dbs" ? true : undefined });
  };
  staff.forEach((s) => { push(s.name, "dbs", s.dbs === "Pending" ? "Pending" : "Valid", "Disclosure & Barring Service"); push(s.name, "pfa", s.pfa, "St John Ambulance"); if (s.name === "Marcus Bell" || s.name === "Tom Lewis") push(s.name, "safeguarding", "Valid", "Local Safeguarding Partnership"); });
  return out;
}

// print a credential register to PDF — optionally with the uploaded certificate
// documents appended (images embed inline; PDF uploads are listed to attach).
export function exportCredsPdf(staff: { name: string; op: string }[], types: CredType[], getRec: (name: string, typeId: string) => CredRecord | undefined, provider: string, withDocs: boolean) {
  if (typeof window === "undefined") return;
  const e = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
  const head = `<tr><th>Staff</th><th>Location</th>${types.map((t) => `<th>${e(t.name)}</th>`).join("")}</tr>`;
  const body = staff.map((s) => `<tr><td><b>${e(s.name)}</b></td><td>${e(s.op)}</td>${types.map((t) => { const r = getRec(s.name, t.id); const st = credStatus(r); return `<td class="st ${st}">${st}${r?.expiry ? `<span class="d">exp ${e(fmtDate(r.expiry))}</span>` : ""}</td>`; }).join("")}</tr>`).join("");
  let docs = "";
  if (withDocs) staff.forEach((s) => types.forEach((t) => { const r = getRec(s.name, t.id); if (r?.fileData) { const img = r.fileData.startsWith("data:image"); docs += `<div class="doc"><div class="dh">${e(s.name)} — ${e(t.name)}${r.number ? " · " + e(r.number) : ""}</div>${img ? `<img src="${r.fileData}"/>` : `<div class="pdf">📎 PDF certificate on file: <b>${e(r.fileName || "certificate.pdf")}</b> — attach the original file to this pack.</div>`}</div>`; } }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Credential register — ${e(provider)}</title><style>
    body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b;padding:26px}
    h1{font-size:20px;margin:0 0 2px}.sub{color:#6b7086;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}th{background:#f1f4fb;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7086;border-bottom:1px solid #e5e7f0}td{padding:7px 8px;border-top:1px solid #eef1f7;vertical-align:top}
    .st{font-weight:700}.st .d{display:block;font-weight:400;font-size:10px;color:#8b93ad}.Valid{color:#0f7a43}.Expiring{color:#b45309}.Expired{color:#c0392b}.Rejected{color:#c0392b}.Pending{color:#1d54c4}.Missing{color:#94a3b8}
    .doc{page-break-before:always;padding-top:16px}.dh{font-weight:700;font-size:14px;margin-bottom:8px;border-bottom:1px solid #e5e7f0;padding-bottom:6px}.doc img{max-width:100%;max-height:880px;border:1px solid #e5e7f0;border-radius:6px}.pdf{color:#4a5068;font-size:13px}
    @media print{body{padding:0 6mm}}
  </style></head><body><h1>${e(provider)} — Credential register</h1><div class="sub">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${withDocs ? " · with certificate documents" : ""}</div><table><thead>${head}</thead><tbody>${body}</tbody></table>${docs}<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
}

// ——— shared store hook ———
export function useCredentials(seedStaff: { name: string; dbs: string; pfa: string }[]) {
  const [types, setTypes] = useState<CredType[]>(DEFAULT_CRED_TYPES);
  const [records, setRecords] = useState<CredRecord[]>(() => seedRecords(seedStaff));
  useEffect(() => {
    try { const t = JSON.parse(localStorage.getItem(CRED_TKEY) || "null"); if (Array.isArray(t)) setTypes(t); } catch { /* ignore */ }
    try { const r = JSON.parse(localStorage.getItem(CRED_RKEY) || "null"); if (Array.isArray(r)) setRecords(r); } catch { /* ignore */ }
  }, []);
  const saveTypes = (t: CredType[]) => { setTypes(t); try { localStorage.setItem(CRED_TKEY, JSON.stringify(t)); } catch { /* ignore */ } };
  const saveRecords = (r: CredRecord[]) => { setRecords(r); try { localStorage.setItem(CRED_RKEY, JSON.stringify(r)); } catch { /* ignore */ } };
  const upsertRecord = (r: CredRecord) => saveRecords(records.some((x) => x.id === r.id) ? records.map((x) => (x.id === r.id ? r : x)) : [...records, r]);
  const deleteRecord = (id: string) => saveRecords(records.filter((x) => x.id !== id));
  const upsertType = (t: CredType) => saveTypes(types.some((x) => x.id === t.id) ? types.map((x) => (x.id === t.id ? t : x)) : [...types, t]);
  const deleteType = (id: string) => saveTypes(types.filter((x) => x.id !== id));
  const recordFor = (staff: string, typeId: string) => records.find((r) => r.staff === staff && r.typeId === typeId);
  return { types, records, saveTypes, saveRecords, upsertRecord, deleteRecord, upsertType, deleteType, recordFor };
}

export const blankRecord = (staff: string, typeId: string): CredRecord => ({ id: "cr" + Date.now().toString(36), staff, typeId, verified: "pending" });

// open an uploaded certificate (data URL) in a new tab via a Blob URL
export function openCredFile(dataUrl?: string) {
  if (!dataUrl || typeof window === "undefined") return;
  try {
    const [meta, b64] = dataUrl.split(","); const m = /:(.*?);/.exec(meta)?.[1] || "application/octet-stream";
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: m })); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { /* ignore */ }
}

// ——— add / edit a record (used by staff + manager) ———
export function CredEditor({ rec, types, lockStaff, onSave, onClose }: { rec: CredRecord; types: CredType[]; lockStaff?: boolean; onSave: (r: CredRecord) => void; onClose: () => void }) {
  const [r, setR] = useState<CredRecord>(rec);
  const type = types.find((t) => t.id === r.typeId) ?? types[0];
  const autoExpiry = () => { if (r.issue && type?.renewMonths) setR({ ...r, expiry: iso(addMonths(new Date(r.issue + "T00:00:00"), type.renewMonths)) }); };
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{rec.issue || rec.fileData ? "Edit certificate" : "Add certificate"}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          {!lockStaff && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff member</span><Input value={r.staff} onChange={(e) => setR({ ...r, staff: e.target.value })} className="w-full" /></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Credential</span><Select value={r.typeId} onChange={(e) => setR({ ...r, typeId: e.target.value })} className="w-full">{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Issued</span><Input type="date" value={r.issue ?? ""} onChange={(e) => setR({ ...r, issue: e.target.value })} onBlur={autoExpiry} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Expires</span><Input type="date" value={r.expiry ?? ""} onChange={(e) => setR({ ...r, expiry: e.target.value })} className="w-full" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Issuing body</span><Input value={r.issuer ?? ""} onChange={(e) => setR({ ...r, issuer: e.target.value })} placeholder="e.g. St John Ambulance" className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Certificate no.</span><Input value={r.number ?? ""} onChange={(e) => setR({ ...r, number: e.target.value })} className="w-full" /></label>
          </div>
          {type?.dbs && (
            <div className="rounded-lg bg-[var(--panel)] p-2.5">
              <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">DBS details</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-[var(--ink-3)]">Level</span><Select value={r.dbsLevel ?? "Enhanced"} onChange={(e) => setR({ ...r, dbsLevel: e.target.value })} className="w-full"><option>Basic</option><option>Standard</option><option>Enhanced</option><option>Enhanced + Barred</option></Select></label>
                <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-[var(--ink-3)]">Update Service no. (optional)</span><Input value={r.dbsUpdateNo ?? ""} onChange={(e) => setR({ ...r, dbsUpdateNo: e.target.value })} placeholder="e.g. 0123456789" className="w-full" /></label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={!!r.dbsUpdate} onChange={(e) => setR({ ...r, dbsUpdate: e.target.checked })} /> Registered with the DBS Update Service</label>
            </div>
          )}
          <div><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Certificate file</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ Upload<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setR({ ...r, fileData: String(rd.result), fileName: f.name }); rd.readAsDataURL(f); }} /></label>
              {r.fileName && <span className="max-w-[180px] truncate text-[12px] text-[var(--ink-2)]">📎 {r.fileName}</span>}
              {r.fileData && <button type="button" onClick={() => setR({ ...r, fileData: undefined, fileName: undefined })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!r.staff.trim() || !r.typeId} onClick={() => onSave({ ...r, updatedAt: iso(new Date()) })}>Save</Button></div>
      </div>
    </div>, document.body);
}
