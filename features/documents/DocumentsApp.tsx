"use client";

// Documents — the provider's central library of policies, risk assessments,
// handbooks, insurance etc. Each document has a live file, a version history
// (upload a new one → the old becomes a past version), a review/expiry date with
// an in-date / expiring / expired status, and an assignment: All staff, specific
// permission roles, specific job titles, and/or specific LISTINGS (so a risk
// assessment can be scoped to one activity). Front-end demo store; real file
// storage + the /api/documents wiring is Amir's (handoff). Feeds the onboarding
// read-and-confirm docs.
import { useEffect, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { DEMO_STAFF } from "@/features/learning/credentials";

// who's deployed to which listing (demo — real deployment lives in Team →
// Deployment after activation). Used to decide who a listing-scoped doc reaches.
const DEMO_DEPLOY: Record<string, string[]> = { "Marcus Bell": ["After-School Football Club"], "Jess Patel": ["After-School Football Club", "Gymnastics Saturday Club"], "Aisha Rahman": ["Summer Holiday Club — Milton Keynes"] };
const roleMatch = (list: string[], me?: string) => !!me && list.some((r) => { const rl = r.toLowerCase(), m = me.toLowerCase(); return rl.includes(m) || m.includes(rl.split(/[ /]/)[0]); });
const docAppliesToStaff = (d: DocItem, staff: { name: string; role: string }) => d.all || roleMatch(d.roles, staff.role) || roleMatch(d.titles, staff.role) || d.listings.some((l) => (DEMO_DEPLOY[staff.name] ?? []).includes(l));
const READ_KEY = "aos.docs.read.v1";

type DocCat = "Policy" | "Risk assessment" | "Handbook" | "Procedure" | "Insurance" | "Form" | "Certificate" | "Other";
const CATS: DocCat[] = ["Policy", "Risk assessment", "Handbook", "Procedure", "Insurance", "Form", "Certificate", "Other"];
const CAT_ICON: Record<DocCat, string> = { Policy: "📘", "Risk assessment": "⚠️", Handbook: "📗", Procedure: "🧭", Insurance: "🛡️", Form: "🗒️", Certificate: "🎖️", Other: "📄" };

export interface DocVersion { version: number; fileName?: string; fileData?: string; at: string }
export interface DocItem {
  id: string; title: string; category: DocCat;
  fileName?: string; fileData?: string; version: number; uploadedAt: string; expiry?: string;
  all: boolean; roles: string[]; titles: string[]; listings: string[];
  history: DocVersion[]; seededBody?: string;
}

// demo listings for the listing-scoped assignment (real listings come from the
// backend library — see handoff)
const DEMO_LISTINGS = ["Easter Multi-Sports Camp", "After-School Football Club", "Summer Holiday Club — Milton Keynes", "Gymnastics Saturday Club", "Swim Squad"];

export const DOCS_KEY = "aos.docs.library.v2";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusMonths = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return iso(d); };
export const docDaysUntil = (d?: string) => { if (!d) return null; const t = new Date(d + "T00:00:00").getTime(); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((t - now.getTime()) / 86400000); };
const daysUntil = docDaysUntil;
export const docFmt = (d?: string) => { if (!d) return "—"; const x = new Date(d + "T00:00:00"); return isNaN(+x) ? d : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const fmt = docFmt;
const esc = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

const POLICY_BODY = (title: string) => `This document sets out ${title.toLowerCase()} for our setting. It applies to all staff, volunteers, students and contractors and should be read in full during induction.\n\n1. Purpose & scope — why this document exists and who it covers.\n2. Roles & responsibilities — who is accountable and what everyone must do.\n3. Procedures — the step-by-step actions to follow, including in an emergency.\n4. Recording & reporting — what must be written down and who to tell.\n5. Review — this document is reviewed at least annually or after any incident.\n\nBy confirming you have read this document you agree to follow it at all times.`;

export function seedDocs(): DocItem[] { return seed(); }
function seed(): DocItem[] {
  const now = iso(new Date());
  const mk = (title: string, category: DocCat, months: number, all: boolean, extra: Partial<DocItem> = {}): DocItem => ({ id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30), title, category, version: 1, uploadedAt: now, expiry: months ? plusMonths(months) : undefined, all, roles: [], titles: [], listings: [], history: [], seededBody: POLICY_BODY(title), ...extra });
  return [
    mk("Safeguarding & Child Protection Policy", "Policy", 12, true),
    mk("Health & Safety Policy", "Policy", 12, true),
    mk("Staff Handbook", "Handbook", 24, true),
    mk("General Risk Assessment", "Risk assessment", 12, true),
    mk("Fire Evacuation Procedure", "Procedure", 12, true),
    mk("Code of Conduct", "Policy", 24, true),
    mk("Privacy Notice (GDPR)", "Policy", 24, true),
    mk("Public Liability Insurance", "Insurance", 6, true),
    mk("Accident / Incident Report Form", "Form", 0, true),
    mk("Behaviour Management Policy", "Policy", 12, true),
  ];
}

function useDocs() {
  const [docs, setDocs] = useState<DocItem[]>(seed);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(DOCS_KEY) || "null"); if (Array.isArray(s) && s.length) setDocs(s); } catch { /* ignore */ } }, []);
  const save = (d: DocItem[]) => { setDocs(d); try { localStorage.setItem(DOCS_KEY, JSON.stringify(d)); } catch { /* ignore */ } };
  const upsert = (d: DocItem) => save(docs.some((x) => x.id === d.id) ? docs.map((x) => (x.id === d.id ? d : x)) : [...docs, d]);
  const remove = (id: string) => save(docs.filter((x) => x.id !== id));
  return { docs, upsert, remove };
}

export const openDoc = (d: DocItem) => {
  if (typeof window === "undefined") return;
  if (d.fileData) { const w = window.open(); if (w) w.document.write(`<iframe src="${d.fileData}" style="border:0;width:100vw;height:100vh"></iframe>`); return; }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>body{font-family:'Times New Roman',Georgia,serif;color:#1a1c2b;max-width:720px;margin:0 auto;padding:54px 40px;line-height:1.6}.ey{font-family:-apple-system,Arial;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#3f7ae0;font-weight:800}h1{font-size:26px;margin:.1em 0 .1em}.meta{font-family:-apple-system,Arial;color:#6b7086;font-size:12px;border-bottom:1px solid #e5e7f0;padding-bottom:12px;margin-bottom:18px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}.wm{position:fixed;top:44%;left:0;right:0;text-align:center;font-family:-apple-system,Arial;font-size:60px;color:#eef1f6;font-weight:800;transform:rotate(-18deg);z-index:-1}</style></head><body><div class="wm">SAMPLE</div><div class="ey">${esc(d.category)}</div><h1>${esc(d.title)}</h1><div class="meta">Version ${d.version} · Uploaded ${fmt(d.uploadedAt)}${d.expiry ? " · Review by " + fmt(d.expiry) : ""}</div><pre>${esc(d.seededBody || "")}</pre><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  const w = window.open(); if (w) { w.document.write(html); w.document.close(); }
};

export function statusOf(d: DocItem): { label: string; tone: string } {
  const dl = daysUntil(d.expiry);
  if (dl == null) return { label: "No review date", tone: "bg-[#eef1f6] text-[#64748b]" };
  if (dl < 0) return { label: "Expired", tone: "bg-[#fdecec] text-[#c0392b]" };
  if (dl <= 60) return { label: `Review in ${dl}d`, tone: "bg-[#fdf3e0] text-[#8a5a09]" };
  return { label: "In date", tone: "bg-[#e6f4ea] text-[#0f7a43]" };
}

export function DocumentsApp() {
  const { settings } = useSettings();
  const { docs, upsert, remove } = useDocs();
  const roles = (settings.roles ?? []).map((r) => r.name).filter(Boolean);
  const titles = (settings.staffRoles ?? []).filter(Boolean);
  const [cat, setCat] = useState<DocCat | "all">("all");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "expiring" | "expired">("all");
  const [edit, setEdit] = useState<DocItem | null>(null);
  const [mode, setMode] = useState<"library" | "receipts">("library");
  const [reads, setReads] = useState<Record<string, Record<string, string>>>({});
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(READ_KEY) || "null"); if (r && typeof r === "object") setReads(r); } catch { /* ignore */ } }, [mode]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const expiring = docs.filter((d) => { const dl = daysUntil(d.expiry); return dl != null && dl >= 0 && dl <= 60; }).length;
  const expired = docs.filter((d) => { const dl = daysUntil(d.expiry); return dl != null && dl < 0; }).length;
  const rows = docs.filter((d) => (cat === "all" || d.category === cat) && (!q || d.title.toLowerCase().includes(q.toLowerCase())) && (statusFilter === "all" || (statusFilter === "expiring" && (() => { const dl = daysUntil(d.expiry); return dl != null && dl >= 0 && dl <= 60; })()) || (statusFilter === "expired" && (() => { const dl = daysUntil(d.expiry); return dl != null && dl < 0; })())));
  const blank = (): DocItem => ({ id: "doc_" + Math.abs([...`${docs.length}${q}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36), title: "", category: "Policy", version: 1, uploadedAt: iso(new Date()), all: true, roles: [], titles: [], listings: [], history: [] });
  const assignSummary = (d: DocItem) => d.all ? ["All staff"] : [...d.roles.map((r) => "🔑 " + r), ...d.titles.map((t) => "🧑‍🏫 " + t), ...d.listings.map((l) => "📋 " + l)];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Documents" icon="📁" lede="Your policies, risk assessments, handbooks and insurance — versioned, with review dates, assigned to roles, job titles or specific listings." />

      <div className="mb-3 inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {([["library", "📁 Library"], ["receipts", "✅ Read receipts"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (mode === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {mode === "receipts" ? (
        <Card className="p-4">
          {(() => {
            const cells = DEMO_STAFF.flatMap((s) => docs.filter((d) => docAppliesToStaff(d, s)).map((d) => ({ read: !!reads[s.name]?.[d.id] })));
            const unread = cells.filter((c) => !c.read).length;
            return (<>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div><div className="text-[14px] font-extrabold text-[var(--ink)]">Who has read what</div><div className="text-[12px] text-[var(--ink-3)]">{cells.length - unread} of {cells.length} confirmations across the team · <b className="text-[#c0392b]">{unread}</b> outstanding</div></div>
                <Button variant="primary" className="ml-auto" disabled={!unread} onClick={() => flash(`🔔 Reminder sent to staff with unread documents`)}>Chase unread</Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th>{docs.map((d) => <th key={d.id} title={d.title} className="px-2 py-2.5 font-extrabold"><div className="w-[64px] truncate">{d.title}</div></th>)}</tr></thead>
                  <tbody>{DEMO_STAFF.map((s) => (
                    <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]">
                      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[var(--ink)]">{s.name}<span className="ml-1 text-[10.5px] font-normal text-[var(--ink-3)]">{s.role}</span></td>
                      {docs.map((d) => { const applies = docAppliesToStaff(d, s); const at = reads[s.name]?.[d.id]; if (!applies) return <td key={d.id} className="px-2 py-2 text-center text-[var(--ink-3)]" title="Not assigned to this person">—</td>; return <td key={d.id} className="px-2 py-2 text-center">{at ? <span title={`Confirmed ${docFmt(at.slice(0, 10))}`} className="inline-block rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-bold text-[#0f7a43]">✓ {docFmt(at.slice(0, 10)).replace(/ \d{4}$/, "")}</span> : <span className="inline-block rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[10px] font-bold text-[#c0392b]">Unread</span>}</td>; })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-3)]"><b>—</b> = not assigned to that person (by role, job title or listing). Staff confirm reading in their own <b>Documents</b> area.</p>
            </>);
          })()}
        </Card>
      ) : (<>
      <div className="mb-3 grid grid-cols-3 gap-2.5">
        {([["all", "documents", "#1d54c4", "#eaf1ff", "📁", docs.length], ["expiring", "review soon", "#b45309", "#fdf3e0", "⏳", expiring], ["expired", "out of date", "#c0392b", "#fdeceb", "⛔", expired]] as const).map(([k, lbl, col, bg, icon, n]) => { const on = statusFilter === k; return (
          <button key={k} type="button" onClick={() => setStatusFilter(k === "all" ? "all" : on ? "all" : k)} className={"flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all " + (on ? "ring-2 ring-offset-1" : "hover:-translate-y-0.5 hover:shadow-md")} style={{ background: bg, ...(on ? ({ "--tw-ring-color": col } as React.CSSProperties) : {}) }}><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/70 text-[17px]">{icon}</span><div><div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: col }}>{n}</div><div className="mt-0.5 text-[11px] font-semibold" style={{ color: col }}>{lbl}</div></div></button>
        ); })}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setEdit(blank())}>+ Add document</Button>
          <Select value={cat} onChange={(e) => setCat(e.target.value as DocCat | "all")} className="max-w-[190px]"><option value="all">All categories</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-[200px]" />
        </div>

        <div className="space-y-2">
          {rows.map((d) => { const st = statusOf(d); return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] p-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--panel)] text-[19px]">{CAT_ICON[d.category]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{d.title}</span><span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#5b6577]">{d.category}</span><span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + st.tone}>{st.label}</span></div>
                <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">v{d.version} · updated {fmt(d.uploadedAt)}{d.expiry ? ` · review by ${fmt(d.expiry)}` : ""}{d.history.length ? ` · ${d.history.length} past version${d.history.length === 1 ? "" : "s"}` : ""}</div>
                <div className="mt-1 flex flex-wrap gap-1">{assignSummary(d).map((a, i) => <span key={i} className="rounded-full bg-[#eaf1ff] px-1.5 py-0.5 text-[10px] font-bold text-[#1d54c4]">{a}</span>)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button onClick={() => openDoc(d)}>📄 View</Button>
                <Button onClick={() => setEdit(d)}>Edit</Button>
                <button type="button" title="Delete" onClick={() => { if (window.confirm(`Delete “${d.title}”?`)) remove(d.id); }} className="rounded-full border border-[var(--line)] px-2.5 py-1.5 text-[13px] text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]">🗑</button>
              </div>
            </div>
          ); })}
          {rows.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-[13px] text-[var(--ink-3)]">No documents match.</div>}
        </div>
        <p className="mt-3 text-[11px] text-[var(--ink-3)]">Sample documents shown are placeholders — upload your own to replace them. A risk assessment specific to one activity? Assign it to that <b>listing</b> when adding it.</p>
      </Card>
      </>)}

      {edit && <DocEditor doc={edit} roles={roles} titles={titles} onSave={(d) => { upsert(d); setEdit(null); }} onClose={() => setEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] -translate-x-1/2 rounded-full bg-[#111634] px-4 py-2 text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function DocEditor({ doc, roles, titles, onSave, onClose }: { doc: DocItem; roles: string[]; titles: string[]; onSave: (d: DocItem) => void; onClose: () => void }) {
  const [d, setD] = useState<DocItem>(doc);
  const toggle = (key: "roles" | "titles" | "listings", v: string) => setD((p) => ({ ...p, [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }));
  const uploadNew = (file: File) => { const r = new FileReader(); r.onload = () => setD((p) => ({ ...p, history: p.fileData || p.version > 1 ? [...p.history, { version: p.version, fileName: p.fileName, fileData: p.fileData, at: p.uploadedAt }] : p.history, version: p.fileData ? p.version + 1 : p.version, fileData: String(r.result), fileName: file.name, uploadedAt: iso(new Date()) })); r.readAsDataURL(file); };
  const chip = (on: boolean, onClick: () => void, label: string) => <button type="button" onClick={onClick} className={"rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors " + (on ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{label}</button>;

  return (
    <div className="fixed inset-0 z-[140] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5"><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{doc.title ? "Edit document" : "Add document"}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Title</span><Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Safeguarding Policy" className="w-full" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Category</span><Select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as DocCat })} className="w-full">{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Review / expiry date</span><Input type="date" value={d.expiry ?? ""} onChange={(e) => setD({ ...d, expiry: e.target.value })} className="w-full" /></label>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Document file</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ {d.fileData ? "Upload new version" : "Upload PDF"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadNew(f); e.target.value = ""; }} /></label>
              {d.fileName ? <span className="text-[12px] font-semibold text-[var(--ink-2)]">📎 {d.fileName} (v{d.version})</span> : <span className="text-[12px] text-[var(--ink-3)]">Sample placeholder in use</span>}
            </div>
            {d.history.length > 0 && <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">Past versions: {d.history.map((h) => `v${h.version}`).join(", ")} (kept)</div>}
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={d.all} onChange={(e) => setD({ ...d, all: e.target.checked })} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-bold text-[var(--ink)]">Applies to all staff</span></label>
            {!d.all && (
              <div className="mt-2 space-y-2">
                <div><div className="mb-1 text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">🔑 Permission roles</div><div className="flex flex-wrap gap-1.5">{roles.length ? roles.map((r) => chip(d.roles.includes(r), () => toggle("roles", r), r)) : <span className="text-[11px] text-[var(--ink-3)]">Add roles in Setup → Roles &amp; permissions.</span>}</div></div>
                <div><div className="mb-1 text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">🧑‍🏫 Job titles</div><div className="flex flex-wrap gap-1.5">{titles.length ? titles.map((t) => chip(d.titles.includes(t), () => toggle("titles", t), t)) : <span className="text-[11px] text-[var(--ink-3)]">Add job titles in Setup → Staff roles.</span>}</div></div>
                <div><div className="mb-1 text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">📋 Specific listings</div><div className="flex flex-wrap gap-1.5">{DEMO_LISTINGS.map((l) => chip(d.listings.includes(l), () => toggle("listings", l), l))}</div><div className="mt-1 text-[10px] text-[var(--ink-3)]">Use this for a risk assessment that applies to one activity only.</div></div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3"><Button className="ml-auto" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!d.title.trim()} onClick={() => onSave(d)}>Save document</Button></div>
      </div>
    </div>
  );
}
