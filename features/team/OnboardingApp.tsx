"use client";

// Staff onboarding — the UK new-starter / safer-recruitment record for a
// children's-activity provider. A configurable checklist of fields grouped into
// sections (personal, right-to-work, DBS, references, payroll…). Which fields are
// REQUIRED and WHO they apply to is fully editable (⚙ Requirements): e.g. an
// office admin can be exempted from DBS so it doesn't show for them — but any
// item can still be added to an individual. Front-end demo store; the real
// sensitive-data storage + retention is Amir's (see handoff). Reuses the same
// staff roster as the Staff-certificates area.
import { useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { DEMO_STAFF } from "@/features/learning/credentials";

// ——— model ———
type FieldType = "text" | "tel" | "email" | "date" | "textarea" | "select" | "file" | "checkbox" | "check";
export interface OnboardField {
  id: string; section: string; label: string; type: FieldType; required: boolean;
  applyKind: "all" | "roles" | "staff"; applyRoles?: string[]; applyStaff?: string[];
  options?: string[]; hint?: string; gate?: boolean; sensitive?: boolean; custom?: boolean;
}
export interface OnboardValue { v?: string; fileData?: string; fileName?: string; status?: "todo" | "requested" | "received" | "verified" }
export interface OnboardRecord { staff: string; values: Record<string, OnboardValue>; extra: string[] }

export const SECTIONS: [string, string, string][] = [
  ["personal", "Personal & contact", "👤"],
  ["rtw", "Right to work", "🛂"],
  ["dbs", "Identity & DBS", "🪪"],
  ["refs", "References & history", "📋"],
  ["quals", "Qualifications & training", "🎓"],
  ["payroll", "Payroll & HMRC", "💷"],
  ["emergency", "Emergency & health", "🚑"],
  ["agreements", "Agreements & policies", "✍️"],
];

const F = (id: string, section: string, label: string, type: FieldType, required = false, x: Partial<OnboardField> = {}): OnboardField => ({ id, section, label, type, required, applyKind: "all", ...x });

export const DEFAULT_FIELDS: OnboardField[] = [
  F("fullName", "personal", "Full legal name", "text", true),
  F("prevNames", "personal", "Previous / known-as names", "text"),
  F("dob", "personal", "Date of birth", "date", true),
  F("ni", "personal", "National Insurance number", "text", true),
  F("address", "personal", "Home address", "textarea", true),
  F("addrHistory", "personal", "Address history (last 5 years)", "textarea", false, { hint: "Needed for DBS" }),
  F("phone", "personal", "Mobile number", "tel", true),
  F("email", "personal", "Personal email", "email", true),
  F("photo", "personal", "Photo (ID badge)", "file"),

  F("nationality", "rtw", "Nationality", "text", true),
  F("rtwMethod", "rtw", "Right-to-work method", "select", true, { options: ["Share code (eVisa)", "Passport (British/Irish)", "Birth certificate + NI", "Other"] }),
  F("shareCode", "rtw", "Share code (9-char)", "text", false, { hint: "From gov.uk — valid 90 days" }),
  F("rtwEvidence", "rtw", "Right-to-work evidence", "file"),
  F("rtwCheck", "rtw", "Right to work verified", "check", true, { gate: true }),

  F("idDocs", "dbs", "ID documents seen", "text", true, { hint: "e.g. passport + proof of address" }),
  F("idCheck", "dbs", "Identity verified", "check", true),
  F("dbsCert", "dbs", "Enhanced DBS certificate no.", "text"),
  F("dbsIssue", "dbs", "DBS issue date", "date"),
  F("dbsUpdate", "dbs", "On DBS Update Service", "checkbox"),
  F("dbsUpdateNo", "dbs", "Update Service number", "text"),
  F("overseas", "dbs", "Overseas check (if 3+ months abroad)", "select", false, { options: ["Not needed", "Requested", "Received"] }),
  F("disqual", "dbs", "Disqualification self-declaration signed", "checkbox"),
  F("dbsCheck", "dbs", "DBS cleared (barred-list checked)", "check", true, { gate: true }),

  F("ref1", "refs", "Reference 1 — name, org, contact", "textarea", true),
  F("ref2", "refs", "Reference 2 — name, org, contact", "textarea", true),
  F("employHistory", "refs", "Employment history + gaps explained", "textarea"),
  F("refsCheck", "refs", "References received & satisfactory", "check", true, { gate: true }),

  F("qualifications", "quals", "Qualifications held", "textarea"),
  F("qualDocs", "quals", "Certificate uploads", "file"),
  F("interviewNotes", "quals", "Safer-recruitment interview notes", "textarea"),

  F("p45", "payroll", "P45 / Starter checklist", "select", true, { options: ["P45 provided", "Starter checklist", "N/A"] }),
  F("taxStatement", "payroll", "Starter statement (A/B/C)", "select", false, { options: ["A — first job", "B — other job/pension", "C — has another job"] }),
  F("studentLoan", "payroll", "Student / postgraduate loan", "checkbox"),
  F("bank", "payroll", "Bank sort code / account", "text", false, { sensitive: true, hint: "Staff enter this themselves" }),
  F("pension", "payroll", "Pension auto-enrolment", "checkbox"),
  F("jobTitle", "payroll", "Job title", "text"),
  F("startDate", "payroll", "Start date", "date", true),
  F("hours", "payroll", "Contracted hours", "text"),
  F("payRate", "payroll", "Pay rate", "text", false, { sensitive: true }),

  F("emergName", "emergency", "Emergency contact name", "text", true),
  F("emergPhone", "emergency", "Emergency contact phone", "tel", true),
  F("emergRel", "emergency", "Relationship", "text"),
  F("medical", "emergency", "Medical / allergies / adjustments", "textarea", false, { sensitive: true }),

  F("contract", "agreements", "Employment contract signed", "checkbox", true),
  F("handbook", "agreements", "Staff handbook acknowledged", "checkbox"),
  F("safeguardingPolicy", "agreements", "Safeguarding policy read", "checkbox", true),
  F("codeOfConduct", "agreements", "Code of conduct signed", "checkbox"),
  F("dataPrivacy", "agreements", "Privacy notice acknowledged", "checkbox"),
  F("kcsie", "agreements", "KCSIE Part 1 read", "checkbox"),
];

const FKEY = "aos.team.onboardfields.v1";
const RKEY = "aos.team.onboardrecords.v1";

export function fieldApplies(f: OnboardField, name: string, role?: string, extra: string[] = []): boolean {
  if (extra.includes(f.id)) return true;
  const k = f.applyKind ?? "all";
  if (k === "all") return true;
  if (k === "staff") return (f.applyStaff ?? []).includes(name);
  return (f.applyRoles ?? []).some((r) => { const rl = r.toLowerCase(), sr = (role ?? "").toLowerCase(); return !!sr && (rl.includes(sr) || sr.includes(rl.split(/[ /]/)[0])); });
}
export function satisfied(f: OnboardField, val?: OnboardValue): boolean {
  if (!val) return false;
  if (f.type === "checkbox") return val.v === "yes";
  if (f.type === "check") return val.status === "verified";
  if (f.type === "file") return !!val.fileData;
  return !!(val.v && val.v.trim());
}

function useOnboarding() {
  const [fields, setFields] = useState<OnboardField[]>(DEFAULT_FIELDS);
  const [records, setRecords] = useState<OnboardRecord[]>([]);
  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem(FKEY) || "null"); if (Array.isArray(f) && f.length) setFields(f); } catch { /* ignore */ }
    try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (Array.isArray(r)) setRecords(r); } catch { /* ignore */ }
  }, []);
  const saveFields = (f: OnboardField[]) => { setFields(f); try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch { /* ignore */ } };
  const saveRecords = (r: OnboardRecord[]) => { setRecords(r); try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch { /* ignore */ } };
  const recordFor = (name: string): OnboardRecord => records.find((r) => r.staff === name) ?? { staff: name, values: {}, extra: [] };
  const upsertRecord = (rec: OnboardRecord) => saveRecords(records.some((r) => r.staff === rec.staff) ? records.map((r) => (r.staff === rec.staff ? rec : r)) : [...records, rec]);
  return { fields, saveFields, records, recordFor, upsertRecord };
}

const openFile = (dataUrl?: string) => { if (!dataUrl || typeof window === "undefined") return; const w = window.open(); if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100vw;height:100vh"></iframe>`); };
const STATUS_TONE: Record<string, string> = { todo: "bg-[#eef1f6] text-[#64748b]", requested: "bg-[#fef3d6] text-[#8a5a09]", received: "bg-[#e6efff] text-[#1d54c4]", verified: "bg-[#e6f4ea] text-[#0f7a43]" };
const STATUS_SEQ = ["todo", "requested", "received", "verified"] as const;

export function OnboardingPanel() {
  const { settings } = useSettings();
  const ob = useOnboarding();
  const [sel, setSel] = useState<string>(DEMO_STAFF[0]?.name ?? "");
  const [cfg, setCfg] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const staffOf = (name: string) => DEMO_STAFF.find((s) => s.name === name);
  const applicable = (name: string, role?: string, extra: string[] = []) => ob.fields.filter((f) => fieldApplies(f, name, role, extra));
  const progressOf = (name: string) => { const s = staffOf(name); const rec = ob.recordFor(name); const fs = applicable(name, s?.role, rec.extra); const done = fs.filter((f) => satisfied(f, rec.values[f.id])).length; return { done, total: fs.length, pct: fs.length ? Math.round((done / fs.length) * 100) : 0 }; };
  const clearedOf = (name: string) => { const s = staffOf(name); const rec = ob.recordFor(name); return applicable(name, s?.role, rec.extra).filter((f) => f.gate).every((f) => satisfied(f, rec.values[f.id])); };

  const staff = staffOf(sel); const rec = ob.recordFor(sel); const appl = applicable(sel, staff?.role, rec.extra);
  const cleared = appl.filter((f) => f.gate).every((f) => satisfied(f, rec.values[f.id]));
  const outstanding = appl.filter((f) => f.required && !satisfied(f, rec.values[f.id]));
  const setVal = (fieldId: string, patch: Partial<OnboardValue>) => ob.upsertRecord({ ...rec, values: { ...rec.values, [fieldId]: { ...rec.values[fieldId], ...patch } } });
  const hiddenFields = ob.fields.filter((f) => !fieldApplies(f, sel, staff?.role, rec.extra));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[13px] text-[var(--ink-3)]">New-starter & safer-recruitment record. Which items are required, and who they apply to, is set in <b>Requirements</b>.</div>
        <Button className="ml-auto" onClick={() => setCfg(true)}>⚙ Requirements</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        {/* roster */}
        <div className="space-y-2">
          {DEMO_STAFF.map((s) => { const p = progressOf(s.name); const cl = clearedOf(s.name); const on = s.name === sel; return (
            <button key={s.name} type="button" onClick={() => setSel(s.name)} className={"block w-full rounded-xl border p-3 text-left transition-colors " + (on ? "border-[#1d3a8f] bg-[#eef4ff]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[#1d3a8f]")}>
              <div className="flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{s.name}</span>{cl ? <span className="ml-auto rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#0f7a43]">Cleared</span> : <span className="ml-auto rounded-full bg-[#fdf3e0] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8a5a09]">On hold</span>}</div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{s.role} · {s.op}</div>
              <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full " + (p.pct === 100 ? "bg-[#0f9d58]" : "bg-[#3f7ae0]")} style={{ width: `${p.pct}%` }} /></div><span className="text-[10.5px] font-bold tabular-nums text-[var(--ink-3)]">{p.pct}%</span></div>
            </button>
          ); })}
        </div>

        {/* form */}
        <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div><div className="text-[16px] font-extrabold text-[var(--ink)]">{sel}</div><div className="text-[12px] text-[var(--ink-3)]">{staff?.role} · {staff?.op}</div></div>
            <div className="ml-auto flex items-center gap-2">
              {cleared ? <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0f7a43]">✓ Cleared to start</span> : <span className="rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[11.5px] font-extrabold text-[#8a5a09]">⏳ Start on hold</span>}
            </div>
          </div>
          {!cleared && <div className="mb-3 rounded-xl border border-[#f3cfa6] bg-[#fdf3e0] px-3.5 py-2 text-[12px] font-semibold text-[#8a4b09]">Cannot start in regulated activity until Right to work, DBS and References are verified.</div>}
          {outstanding.length > 0 && <div className="mb-3 text-[12px] text-[var(--ink-3)]"><b className="text-[#c0392b]">{outstanding.length}</b> required item{outstanding.length === 1 ? "" : "s"} still outstanding.</div>}

          {SECTIONS.map(([sid, slabel, sicon]) => { const fs = appl.filter((f) => f.section === sid); if (!fs.length) return null; return (
            <div key={sid} className="mb-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{sicon} {slabel}</h4>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {fs.map((f) => { const val = rec.values[f.id]; const ok = satisfied(f, val); return (
                  <div key={f.id} className={"rounded-lg border p-2.5 " + (f.type === "textarea" ? "sm:col-span-2 " : "") + (ok ? "border-[#cfe8d7] bg-[#f4fbf6]" : "border-[var(--line)]")}>
                    <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-2)]">{ok && <span className="text-[#0f7a43]">✓</span>}{f.label}{f.required && <span className="text-[#c0392b]">*</span>}{f.sensitive && <span title="Sensitive — stored securely" className="text-[10px]">🔒</span>}{rec.extra.includes(f.id) && <span className="rounded bg-[#eef1f6] px-1 text-[8.5px] font-bold uppercase text-[#64748b]">added</span>}</label>
                    {f.type === "check" ? (
                      <div className="flex flex-wrap gap-1">{STATUS_SEQ.map((st) => <button key={st} type="button" onClick={() => setVal(f.id, { status: st })} className={"rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize " + ((val?.status ?? "todo") === st ? STATUS_TONE[st] : "bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{st}</button>)}</div>
                    ) : f.type === "checkbox" ? (
                      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[var(--ink)]"><input type="checkbox" checked={val?.v === "yes"} onChange={(e) => setVal(f.id, { v: e.target.checked ? "yes" : "" })} className="h-4 w-4 accent-[#1d3a8f]" /> Yes</label>
                    ) : f.type === "file" ? (
                      <div className="flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ Upload<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => setVal(f.id, { fileData: String(r.result), fileName: file.name }); r.readAsDataURL(file); }} /></label>{val?.fileName && <button type="button" onClick={() => openFile(val.fileData)} className="max-w-[150px] truncate text-[11.5px] font-bold text-[#1d3a8f] hover:underline">📎 {val.fileName}</button>}</div>
                    ) : f.type === "select" ? (
                      <Select value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full"><option value="">Choose…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</Select>
                    ) : f.type === "textarea" ? (
                      <textarea value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
                    ) : (
                      <Input type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"} value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full" />
                    )}
                    {f.hint && <div className="mt-1 text-[10px] text-[var(--ink-3)]">{f.hint}</div>}
                  </div>
                ); })}
              </div>
            </div>
          ); })}

          {/* add a normally-hidden item to this person */}
          <div className="relative mt-1">
            <Button onClick={() => setAddOpen((v) => !v)}>+ Add an item for {sel.split(" ")[0]}</Button>
            {addOpen && (
              <div className="absolute z-20 mt-1 max-h-[260px] w-[280px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                {hiddenFields.length ? hiddenFields.map((f) => <button key={f.id} type="button" onClick={() => { ob.upsertRecord({ ...rec, extra: [...rec.extra, f.id] }); setAddOpen(false); }} className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.label} <span className="text-[10px] text-[var(--ink-3)]">· {SECTIONS.find((s) => s[0] === f.section)?.[1]}</span></button>) : <div className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Every item already applies to {sel.split(" ")[0]}.</div>}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">Certificates (DBS, First Aid) are also tracked in <b>Team → Staff certificates</b>. Sensitive fields (🔒) need secure storage &amp; retention — on the backend list.</p>
        </div>
      </div>

      {cfg && <RequirementsModal fields={ob.fields} onSave={ob.saveFields} onClose={() => setCfg(false)} accessRoles={(settings.roles ?? []).map((r) => r.name).filter(Boolean)} jobTitles={(settings.staffRoles ?? []).filter(Boolean)} />}
    </div>
  );
}

// ——— requirements config ———
function RequirementsModal({ fields, onSave, onClose, accessRoles, jobTitles }: { fields: OnboardField[]; onSave: (f: OnboardField[]) => void; onClose: () => void; accessRoles: string[]; jobTitles: string[] }) {
  const [list, setList] = useState<OnboardField[]>(fields);
  const [newLabel, setNewLabel] = useState(""); const [newSection, setNewSection] = useState(SECTIONS[0][0]); const [newType, setNewType] = useState<FieldType>("text");
  const patch = (id: string, p: Partial<OnboardField>) => setList((l) => l.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const toggleRole = (id: string, r: string) => setList((l) => l.map((f) => { if (f.id !== id) return f; const a = f.applyRoles ?? []; return { ...f, applyRoles: a.includes(r) ? a.filter((x) => x !== r) : [...a, r] }; }));
  const addField = () => { if (!newLabel.trim()) return; const id = "cf_" + newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) + "_" + list.length; setList((l) => [...l, { id, section: newSection, label: newLabel.trim(), type: newType, required: false, applyKind: "all", custom: true }]); setNewLabel(""); };
  const del = (id: string) => setList((l) => l.filter((f) => f.id !== id));

  return (
    <div className="fixed inset-0 z-[141] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl select-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5"><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Onboarding requirements</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div><p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">Toggle what&rsquo;s required and who it applies to. Turn <b>Applies to</b> to Roles to exempt a role (e.g. remove DBS from office admin) — it then hides for them, but can still be added to an individual.</p></div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {SECTIONS.map(([sid, slabel, sicon]) => { const fs = list.filter((f) => f.section === sid); if (!fs.length) return null; return (
            <div key={sid} className="mb-4">
              <h4 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{sicon} {slabel}</h4>
              <div className="space-y-1.5">
                {fs.map((f) => (
                  <div key={f.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-[var(--ink)]">{f.label}{f.gate && <span title="Gates 'cleared to start'" className="ml-1 text-[10px]">🚦</span>}</span>
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={f.required} onChange={(e) => patch(f.id, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[#1d3a8f]" />Required</label>
                      <Select value={f.applyKind} onChange={(e) => patch(f.id, { applyKind: e.target.value as OnboardField["applyKind"] })} className="max-w-[130px]"><option value="all">All staff</option><option value="roles">Certain roles</option><option value="staff">Named people</option></Select>
                      {f.custom && <button type="button" onClick={() => del(f.id)} title="Delete" className="text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>}
                    </div>
                    {f.applyKind === "roles" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {accessRoles.length > 0 && <span className="mr-0.5 rounded bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#5b6577]">🔑 Access</span>}
                        {accessRoles.map((r) => <button key={r} type="button" onClick={() => toggleRole(f.id, r)} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyRoles ?? []).includes(r) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{r}</button>)}
                        {jobTitles.length > 0 && <span className="ml-1 mr-0.5 rounded bg-[#eaf1ff] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#1d54c4]">🧑‍🏫 Job</span>}
                        {jobTitles.map((r) => <button key={r} type="button" onClick={() => toggleRole(f.id, r)} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyRoles ?? []).includes(r) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{r}</button>)}
                        {!accessRoles.length && !jobTitles.length && <span className="text-[11px] text-[var(--ink-3)]">Add roles in Setup first.</span>}
                      </div>
                    )}
                    {f.applyKind === "staff" && <div className="mt-1.5 flex flex-wrap gap-1">{DEMO_STAFF.map((s) => <button key={s.name} type="button" onClick={() => setList((l) => l.map((x) => { if (x.id !== f.id) return x; const a = x.applyStaff ?? []; return { ...x, applyStaff: a.includes(s.name) ? a.filter((y) => y !== s.name) : [...a, s.name] }; }))} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyStaff ?? []).includes(s.name) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{s.name}</button>)}</div>}
                  </div>
                ))}
              </div>
            </div>
          ); })}
          <div className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Add a custom item</div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Item label" className="min-w-[160px] flex-1" />
              <Select value={newSection} onChange={(e) => setNewSection(e.target.value)} className="max-w-[170px]">{SECTIONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select>
              <Select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className="max-w-[130px]"><option value="text">Text</option><option value="date">Date</option><option value="textarea">Long text</option><option value="file">File upload</option><option value="checkbox">Tick box</option><option value="check">Status check</option></Select>
              <Button variant="primary" onClick={addField}>Add</Button>
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3"><span className="text-[11.5px] text-[var(--ink-3)]">{list.filter((f) => f.required).length} required · {list.length} items</span><Button className="ml-auto" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { onSave(list); onClose(); }}>Save requirements</Button></div>
      </div>
    </div>
  );
}
