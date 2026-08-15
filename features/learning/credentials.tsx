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
export const DEMO_STAFF: { name: string; role: string; op: string; dbs: string; pfa: string }[] = [
  { name: "Marcus Bell", role: "Lead", op: "Company-owned", dbs: "Valid", pfa: "Expiring" },
  { name: "Jess Patel", role: "Coach", op: "Company-owned", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", role: "Lead", op: "Milton Keynes", dbs: "Valid", pfa: "Expired" },
  { name: "Tom Lewis", role: "Coach", op: "Milton Keynes", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", role: "Coach", op: "Northampton", dbs: "Pending", pfa: "Valid" },
  { name: "Dan Reed", role: "Lead", op: "Bedford", dbs: "Valid", pfa: "Valid" },
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
export interface CredFile { name: string; data: string; at: string }
export interface CredRecord {
  id: string; staff: string; typeId: string;
  issue?: string; expiry?: string; issuer?: string; number?: string;
  fileData?: string; fileName?: string; // the CURRENT (latest) document — mirrors files[last]
  files?: CredFile[]; // full upload history, oldest → newest
  verified: "pending" | "verified" | "rejected"; note?: string;
  dbsLevel?: string; dbsUpdate?: boolean; dbsUpdateNo?: string; // DBS extras
  updatedAt?: string;
}

// Full document history for a record — seeds a single entry from the legacy
// fileData if the record predates versioning. Newest last.
export const credFiles = (r?: CredRecord): CredFile[] => {
  if (!r) return [];
  if (r.files && r.files.length) return r.files;
  if (r.fileData) return [{ name: r.fileName || "certificate", data: r.fileData, at: r.updatedAt || r.issue || "" }];
  return [];
};

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
  if (withDocs) staff.forEach((s) => types.forEach((t) => { const r = getRec(s.name, t.id); if (r?.fileData) { const img = r.fileData.startsWith("data:image"); docs += `<div class="doc"><div class="dh">${e(s.name)} — ${e(t.name)}${r.number ? " · " + e(r.number) : ""}${r.fileName ? ` · ${e(r.fileName)}` : ""}</div>${img ? `<img src="${r.fileData}"/>` : `<object data="${r.fileData}" type="application/pdf" class="pdfdoc"><iframe src="${r.fileData}" class="pdfdoc"></iframe></object>`}</div>`; } }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Credential register — ${e(provider)}</title><style>
    body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b;padding:26px}
    h1{font-size:20px;margin:0 0 2px}.sub{color:#6b7086;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}th{background:#f1f4fb;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7086;border-bottom:1px solid #e5e7f0}td{padding:7px 8px;border-top:1px solid #eef1f7;vertical-align:top}
    .st{font-weight:700}.st .d{display:block;font-weight:400;font-size:10px;color:#8b93ad}.Valid{color:#0f7a43}.Expiring{color:#b45309}.Expired{color:#c0392b}.Rejected{color:#c0392b}.Pending{color:#1d54c4}.Missing{color:#94a3b8}
    .doc{page-break-before:always;padding-top:16px}.dh{font-weight:700;font-size:14px;margin-bottom:8px;border-bottom:1px solid #e5e7f0;padding-bottom:6px}.doc img{max-width:100%;max-height:880px;border:1px solid #e5e7f0;border-radius:6px}.pdfdoc{display:block;width:100%;height:960px;border:1px solid #e5e7f0;border-radius:6px}
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
export function CredEditor({ rec, types, lockStaff, staffList, onSave, onClose }: { rec: CredRecord; types: CredType[]; lockStaff?: boolean; staffList?: { name: string }[]; onSave: (r: CredRecord) => void; onClose: () => void }) {
  const [r, setR] = useState<CredRecord>(rec);
  const [staffQ, setStaffQ] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const type = types.find((t) => t.id === r.typeId) ?? types[0];
  const files = credFiles(r);
  const autoExpiry = () => { if (r.issue && type?.renewMonths) setR({ ...r, expiry: iso(addMonths(new Date(r.issue + "T00:00:00"), type.renewMonths)) }); };
  const addFile = (f: File) => { const rd = new FileReader(); rd.onload = () => { const nf: CredFile = { name: f.name, data: String(rd.result), at: iso(new Date()) }; setR((p) => ({ ...p, files: [...credFiles(p), nf], fileData: nf.data, fileName: nf.name })); }; rd.readAsDataURL(f); };
  const removeFile = (idx: number) => setR((p) => { const list = credFiles(p).filter((_, i) => i !== idx); const last = list[list.length - 1]; return { ...p, files: list, fileData: last?.data, fileName: last?.name }; });
  const opts = (staffList ?? []).filter((s) => s.name.toLowerCase().includes(staffQ.toLowerCase()));
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{rec.issue || files.length ? "Edit certificate" : "Add certificate"}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          {!lockStaff && (staffList && staffList.length ? (
            <div className="relative"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff member</span>
              <button type="button" onClick={() => { setStaffOpen((v) => !v); setStaffQ(""); }} className="flex w-full items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--ink)] hover:border-[#1d3a8f]">{r.staff || <span className="text-[var(--ink-3)]">Choose staff…</span>}<span className="text-[var(--ink-3)]">▾</span></button>
              {staffOpen && (
                <div className="absolute z-10 mt-1 max-h-[260px] w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                  <input autoFocus value={staffQ} onChange={(e) => setStaffQ(e.target.value)} placeholder="Search name…" className="mb-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#1d3a8f]" />
                  {opts.map((s) => <button key={s.name} type="button" onClick={() => { setR({ ...r, staff: s.name }); setStaffOpen(false); }} className={"block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold hover:bg-[var(--panel)] " + (s.name === r.staff ? "text-[#1d3a8f]" : "text-[var(--ink-2)]")}>{s.name === r.staff ? "✓ " : ""}{s.name}</button>)}
                  {!opts.length && <div className="px-2.5 py-2 text-[12px] text-[var(--ink-3)]">No match.</div>}
                </div>
              )}
            </div>
          ) : <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff member</span><Input value={r.staff} onChange={(e) => setR({ ...r, staff: e.target.value })} className="w-full" /></label>)}
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
          <div><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Certificate file{files.length > 1 ? ` · ${files.length} versions` : ""}</span>
            {files.length > 0 && (
              <div className="mb-2 space-y-1">
                {files.map((f, i) => { const latest = i === files.length - 1; return (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                    <span className="truncate text-[12px] font-semibold text-[var(--ink-2)]">📎 {f.name}</span>
                    {latest ? <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#0f7a43]">Current</span> : <span className="rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#64748b]">Older</span>}
                    {f.at && <span className="text-[10px] text-[var(--ink-3)]">{fmtDate(f.at.slice(0, 10))}</span>}
                    <button type="button" onClick={() => openCredFile(f.data)} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">View</button>
                    <button type="button" title="Remove this version" onClick={() => removeFile(i)} className="text-[12px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                  </div>
                ); })}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ {files.length ? "Upload new version" : "Upload"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f); e.target.value = ""; }} /></label>
            {files.length > 1 && <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">A new upload is kept as a new version — older ones stay viewable here. The newest is used everywhere else.</p>}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!r.staff.trim() || !r.typeId} onClick={() => onSave({ ...r, updatedAt: iso(new Date()) })}>Save</Button></div>
      </div>
    </div>, document.body);
}
