"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";
import { ChildPicker, type ChildOption } from "@/components/pickers/ChildPicker";
import { NotesThread } from "./NotesThread";
import { BodyMap, type BodyMark } from "./BodyMap";
import { groupByChild } from "./IncidentsApp";
import { SG_CATEGORIES, riskFor, protocolFor, DSL_DECISIONS, KCSIE_URL, type Risk } from "./safeguarding";

interface SgLog {
  id: string; kind: "safeguarding"; date: string; time?: string; childName: string; childId?: string;
  location?: string; description: string; actionTaken?: string; concernCategory?: string;
  reportedTo?: string; witnesses?: string; severity: Risk; confidential?: boolean; subject?: "child" | "staff";
  bodyMap?: BodyMark[]; attachments?: string[]; recordedByName?: string; createdAt?: string; updatedAt?: string;
  dslActions?: string[]; dslOutcome?: string; dslActionedAt?: string; shareWithReporter?: boolean;
  dslLog?: DslEntry[]; localAuthority?: string;
  notes?: { by: string; role: string; text: string; at: string }[];
}
const RISK = { minor: { label: "Low", bg: "#eaf0fc", fg: "#1d3a8f" }, moderate: { label: "Medium", bg: "#fdf3d8", fg: "#9a5a00" }, serious: { label: "High", bg: "#fdebec", fg: "#c02636" } } as const;
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const nowTime = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${p(t.getHours())}:${p(t.getMinutes())}`; };
const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("read")); r.readAsDataURL(f); });

interface DslEntry { id: string; key: string; label: string; note?: string; reviewDate?: string; at: string; by?: string; done?: boolean; doneAt?: string }
interface SgAuthority { id: string; name: string; ladoName?: string; ladoPhone?: string; socialCarePhone?: string; outOfHoursPhone?: string }
interface SgContacts { nspccPhone?: string; policePhone?: string; authorities?: SgAuthority[]; extra?: { label: string; phone: string }[]; ladoName?: string; ladoPhone?: string; socialCarePhone?: string; outOfHoursPhone?: string; localAuthority?: string }
type Line = { label: string; phone: string };

// Resolve which authority's contacts apply — the one picked on the concern, else
// the only one on file, else the legacy single fields.
function resolveAuthority(c?: SgContacts, name?: string): SgAuthority | undefined {
  const list = c?.authorities ?? [];
  if (name) { const hit = list.find((a) => a.name === name); if (hit) return hit; }
  if (list.length === 1) return list[0];
  if (!name && (c?.ladoPhone || c?.socialCarePhone)) return { id: "legacy", name: c?.localAuthority ?? "your local authority", ladoName: c?.ladoName, ladoPhone: c?.ladoPhone, socialCarePhone: c?.socialCarePhone, outOfHoursPhone: c?.outOfHoursPhone };
  return list.find((a) => a.name === name);
}
const emergencyLines = (c?: SgContacts): Line[] => ([c?.policePhone && { label: "Police", phone: c.policePhone }, c?.nspccPhone && { label: "NSPCC helpline", phone: c.nspccPhone }].filter(Boolean) as Line[]);
const referralLines = (a?: SgAuthority): Line[] => (!a ? [] : [a.ladoPhone && { label: `LADO${a.ladoName ? ` — ${a.ladoName}` : ""} · about an adult`, phone: a.ladoPhone }, a.socialCarePhone && { label: "Children's social care (MASH)", phone: a.socialCarePhone }, a.outOfHoursPhone && { label: "Out-of-hours / EDT", phone: a.outOfHoursPhone }].filter(Boolean) as Line[]);
const extraLines = (c?: SgContacts): Line[] => (c?.extra ?? []).filter((e) => e.label?.trim() && e.phone?.trim());
const allContactLines = (c?: SgContacts, authorityName?: string): Line[] => [...emergencyLines(c), ...referralLines(resolveAuthority(c, authorityName)), ...extraLines(c)];

function LineRow({ it }: { it: Line }) {
  return <div className="flex items-center justify-between gap-2 text-[11.5px]"><span className="text-[var(--ink-2)]">{it.label}</span><a href={`tel:${it.phone.replace(/[^0-9+]/g, "")}`} className="flex-none font-bold text-[#1d3a8f]">{it.phone}</a></div>;
}

// The contacts panel — emergency numbers, then the chosen authority's referral
// numbers (LADO / MASH), then any extras.
function ContactsBlock({ c, authorityName }: { c?: SgContacts; authorityName?: string }) {
  const em = emergencyLines(c), auth = resolveAuthority(c, authorityName), ref = referralLines(auth), ex = extraLines(c);
  if (!em.length && !ref.length && !ex.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {em.length > 0 && <div className="rounded-lg border border-[#f6c9cc] bg-[#fdebec] p-2"><div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[#c02636]">🚨 If a child is in immediate danger</div><div className="flex flex-col gap-0.5">{em.map((it, i) => <LineRow key={i} it={it} />)}</div></div>}
      {ref.length > 0 && <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2"><div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">🏛️ Refer to — {auth?.name}</div><div className="flex flex-col gap-0.5">{ref.map((it, i) => <LineRow key={i} it={it} />)}</div></div>}
      {ex.length > 0 && <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2"><div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">📞 Also</div><div className="flex flex-col gap-0.5">{ex.map((it, i) => <LineRow key={i} it={it} />)}</div></div>}
    </div>
  );
}

type Draft = Partial<SgLog> & { date: string; time?: string; childName: string; description: string; severity: Risk };
const emptyDraft = (reportedTo: string): Draft => ({ date: todayIso(), time: nowTime(), childName: "", description: "", severity: "moderate", concernCategory: "", reportedTo, subject: "child", bodyMap: [], attachments: [] });

function SgForm({ existing, onSaved, onCancel }: { existing?: SgLog; onSaved: () => void; onCancel: () => void }) {
  const { settings } = useSettings();
  const sg = settings.safeguarding ?? {};
  const dslTitle = sg.dslTitle || "Designated Safeguarding Lead (DSL)";
  const dslName = sg.dslName || "";
  const dslLabel = [dslTitle, dslName].filter(Boolean).join(" · ");
  const categories = sg.categories?.length ? sg.categories : [...SG_CATEGORIES];
  const isEdit = !!existing;
  const [d, setD] = useState<Draft>(existing ? { ...existing } : emptyDraft(dslLabel));
  const [bkgs, setBkgs] = useState<{ child?: string; childId?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  useEffect(() => { apiGet<{ child?: string; childId?: string }[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  const childOptions: ChildOption[] = [
    ...new Map(bkgs.filter((b) => b.child).map((b) => [b.child!.trim().toLowerCase(), { name: b.child!, childId: b.childId }])).values(),
    { name: "Other / staff member" },
  ];
  const proto = protocolFor(d.concernCategory ?? "", sg.protocol, { title: dslTitle, name: dslName }, d.subject);

  function pickCategory(cat: string) { set({ concernCategory: cat, severity: cat ? riskFor(cat) : d.severity }); }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 10)) {
        const dataUrl = await readAsDataUrl(f);
        const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl });
        urls.push(url);
      }
      set({ attachments: [...(d.attachments ?? []), ...urls] });
    } catch { setError("Couldn’t upload a file — try a smaller image."); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!d.childName.trim() || !d.description.trim()) { setError("Add who is involved and what happened."); return; }
    if (!d.concernCategory) { setError("Choose a concern category."); return; }
    setBusy(true); setError(null);
    const payload = { ...d, kind: "safeguarding" as const, confidential: true };
    try {
      if (isEdit) await apiPut(`/api/incidents/${encodeURIComponent(existing!.id)}`, { ...payload, notifyParentOfEdit: false });
      else await apiPost("/api/incidents", payload);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  const tone = proto.tone === "red" ? { bg: "#fdebec", fg: "#c02636", line: "#f6c9cc" } : proto.tone === "amber" ? { bg: "#fdf3d8", fg: "#9a5a00", line: "#f6e2a8" } : { bg: "#eef1f6", fg: "#4a4763", line: "var(--line)" };

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-1 text-[14px] font-extrabold">{isEdit ? "Edit safeguarding concern" : "Log a safeguarding concern"}</div>
      <p className="mb-3 text-[11.5px] text-[var(--ink-3)]">Record facts only — what you saw or heard, in the child&rsquo;s own words where possible. No opinions. This is confidential and routed to your {dslLabel}.</p>

      <FieldLabel>This concern is about…</FieldLabel>
      <div className="mb-2.5 mt-1 grid gap-1.5 sm:grid-cols-2">
        {([["child", "🧒 A child", "A child on camp"], ["staff", "🧑‍🏫 A member of staff", "An allegation about staff / a volunteer"]] as [("child" | "staff"), string, string][]).map(([v, t, sub]) => (
          <button key={v} type="button" onClick={() => set({ subject: v, ...(v === "staff" && !d.concernCategory ? { concernCategory: "Allegation against a member of staff / volunteer", severity: riskFor("allegation") } : {}) })} className="rounded-xl border-2 px-3 py-2 text-left transition-colors" style={(d.subject ?? "child") === v ? { borderColor: "#1d3a8f", background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="text-[12.5px] font-extrabold" style={{ color: (d.subject ?? "child") === v ? "#1d3a8f" : "var(--ink-2)" }}>{t}</div>
            <div className="text-[11px] text-[var(--ink-3)]">{sub}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <FieldLabel>Category</FieldLabel>
          <select value={d.concernCategory ?? ""} onChange={(e) => pickCategory(e.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none focus:border-[#1d3a8f]">
            <option value="">— select —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Risk level</FieldLabel>
          <div className="flex gap-1.5">{(["minor", "moderate", "serious"] as const).map((s) => (
            <button key={s} type="button" onClick={() => set({ severity: s })} className="flex-1 rounded-lg border-2 px-2 py-2 text-[12.5px] font-extrabold transition-colors" style={d.severity === s ? { borderColor: RISK[s].fg, background: RISK[s].fg, color: "#fff" } : { borderColor: RISK[s].bg, background: RISK[s].bg, color: RISK[s].fg }}>{RISK[s].label}</button>
          ))}</div>
        </div>
        {(sg.contacts?.authorities?.length ?? 0) > 0 && (
          <div className="sm:col-span-2">
            <FieldLabel>Local authority</FieldLabel>
            <select value={d.localAuthority ?? ""} onChange={(e) => set({ localAuthority: e.target.value })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] outline-none focus:border-[#1d3a8f]">
              <option value="">— which council&rsquo;s area? —</option>
              {(sg.contacts?.authorities ?? []).map((a) => <option key={a.id} value={a.name}>{a.name || "(unnamed)"}</option>)}
            </select>
          </div>
        )}
      </div>

      {d.concernCategory && (
        <div className="mt-2.5 rounded-xl border p-3" style={{ background: tone.bg, borderColor: tone.line }}>
          <div className="text-[12px] font-extrabold" style={{ color: tone.fg }}>What to do now</div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: tone.fg }}><b>{proto.due}</b> · {proto.who} · <span className="opacity-80">{proto.ref}</span></div>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[11.5px] text-[var(--ink-2)]">{proto.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <ContactsBlock c={sg.contacts} authorityName={d.localAuthority} />
        </div>
      )}

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>{d.subject === "staff" ? "Member of staff involved" : "Child / person involved"}</FieldLabel>
          {d.subject === "staff"
            ? <Input value={d.childName} onChange={(e) => set({ childName: e.target.value, childId: undefined })} placeholder="Name of the staff member / volunteer" className="w-full" />
            : <ChildPicker value={d.childName} options={childOptions} onPick={(name, childId) => set({ childName: name, childId })} placeholder="Search a booked child, or ‘Other / staff member’…" />}
        </div>
        <div className="sm:col-span-2"><FieldLabel>Location</FieldLabel><Input value={d.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Loughton Manor — Hall" className="w-full" /></div>
        <div><FieldLabel>Date</FieldLabel><Input type="date" max={todayIso()} value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
        <div><FieldLabel>Time</FieldLabel><Input type="time" value={d.time ?? ""} onChange={(e) => set({ time: e.target.value })} className="w-full" /></div>
      </div>

      <div className="mt-2.5"><FieldLabel>What happened (facts only)</FieldLabel><textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder="What you saw or heard, in the child’s own words where possible. No opinions." className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[#1d3a8f]" /></div>
      <div className="mt-2.5"><FieldLabel>Immediate action taken</FieldLabel><textarea value={d.actionTaken ?? ""} onChange={(e) => set({ actionTaken: e.target.value })} rows={2} placeholder="First aid given, child reassured, area made safe, etc." className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[#1d3a8f]" /></div>

      <div className="mt-2.5"><FieldLabel>Witnesses (optional)</FieldLabel><Input value={d.witnesses ?? ""} onChange={(e) => set({ witnesses: e.target.value })} className="w-full" /></div>

      <div className="mt-2.5">
        <FieldLabel>Attach a file (optional)</FieldLabel>
        <input type="file" accept="image/*" multiple onChange={(e) => attach(e.target.files)} className="block w-full text-[12px] text-[var(--ink-2)] file:mr-2 file:rounded-md file:border-0 file:bg-[#eef4fd] file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-[#1d3a8f]" />
        {uploading && <div className="mt-1 text-[11px] text-[var(--ink-3)]">Uploading…</div>}
        {(d.attachments?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {d.attachments!.map((u, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">📎 file {i + 1}<button type="button" onClick={() => set({ attachments: d.attachments!.filter((_, j) => j !== i) })} className="text-[var(--ink-3)]">✕</button></span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3"><BodyMap value={d.bodyMap ?? []} onChange={(bodyMap) => set({ bodyMap })} /></div>

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="solid" disabled={busy} onClick={save}>{busy ? "Saving…" : isEdit ? "Save concern" : "Log & notify company"}</Button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-3)]">A copy stays with you; your company sees it immediately. Timestamped and attributed to you automatically.</p>
    </Card>
  );
}

const DTONE: Record<string, { c: string; bg: string }> = { red: { c: "#c02636", bg: "#fdebec" }, amber: { c: "#9a5a00", bg: "#fdf3d8" }, grey: { c: "#1d3a8f", bg: "#eef4fd" } };
const stampTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// Build a print-friendly window of the whole concern + DSL decision → "Save as PDF".
interface Dossier {
  child?: { dob?: string; age?: number; school?: string; allergies?: string; medical?: string; send?: string; dietary?: string; swimming?: string; careNotes?: string; collectionPassword?: string; emergencyName?: string; emergencyPhone?: string } | null;
  parent?: { name?: string; email?: string; phone?: string; address?: string; postcode?: string } | null;
  siblings?: { name?: string; dob?: string; age?: number }[];
  bookings?: { listing?: string; dates?: string; status?: string; createdAt?: string }[];
  history?: { kind?: string; date?: string; category?: string; severity?: string; description?: string }[];
}
const ageOf = (dob?: string) => { if (!dob) return undefined; const d = new Date(dob); if (isNaN(d.getTime())) return undefined; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a >= 0 && a < 30 ? a : undefined; };

function downloadConcernPdf(rec: SgLog, contacts?: SgContacts, opts?: { extraHtml?: string; logoUrl?: string }) {
  const esc = (s?: string) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const labels = new Map(DSL_DECISIONS.map((o) => [o.key, o.label]));
  const row = (k: string, v?: string) => (v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : "");
  const marks = (rec.bodyMap ?? []).map((m) => `#${m.n} (${m.view})${m.note ? ` — ${esc(m.note)}` : ""}`).join("<br>");
  const dlog = rec.dslLog?.length ? rec.dslLog : (rec.dslActions ?? []).map((k, i) => ({ id: `m${i}`, key: k, label: labels.get(k) ?? k, note: i === 0 ? rec.dslOutcome : undefined, at: rec.dslActionedAt } as DslEntry));
  const actionsHtml = dlog.map((e, i) => `<tr><th>${i + 1}. ${esc(e.label)}${e.done ? " ✓" : ""}</th><td>${e.at ? `<span style="color:#8a86a3">${esc(stampTime(e.at))}</span><br>` : ""}${e.note ? `${esc(e.note)}<br>` : ""}${e.reviewDate ? `<b>Review by ${esc(e.reviewDate)}${e.done ? " — completed" : ""}</b>` : ""}</td></tr>`).join("");
  const contactsHtml = allContactLines(contacts, rec.localAuthority).map((it) => `${esc(it.label)}: <b>${esc(it.phone)}</b>`).join("<br>");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Safeguarding concern — ${esc(rec.childName)}</title>
    <style>body{font:13px/1.5 system-ui,sans-serif;color:#171534;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:19px;margin:0 0 2px}.tag{display:inline-block;background:#fdebec;color:#c02636;font-weight:800;font-size:11px;padding:2px 8px;border-radius:20px}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#8a86a3;margin:18px 0 6px;border-top:1px solid #ece6f1;padding-top:10px}
    table{border-collapse:collapse;width:100%}th{text-align:left;color:#8a86a3;font-weight:600;width:170px;vertical-align:top;padding:3px 8px 3px 0}td{padding:3px 0}
    .box{white-space:pre-wrap;background:#fbf8fc;border:1px solid #ece6f1;border-radius:8px;padding:8px 10px;margin-top:4px}</style></head>
    <body>
    ${opts?.logoUrl ? `<img src="${opts.logoUrl}" alt="" style="max-height:52px;max-width:220px;display:block;margin-bottom:10px" />` : ""}
    <span class="tag">CONFIDENTIAL — SAFEGUARDING</span>
    <h1>Safeguarding concern${rec.subject === "staff" ? " — about a member of staff" : ""}</h1>
    <h2>The concern</h2><table>
      ${row("Subject", rec.subject === "staff" ? "A member of staff / volunteer" : "A child")}
      ${row(rec.subject === "staff" ? "Person involved" : "Child", rec.childName)}
      ${row("Category", rec.concernCategory)}${row("Risk level", rec.severity === "minor" ? "Low" : rec.severity === "moderate" ? "Medium" : "High")}
      ${row("Local authority", rec.localAuthority)}
      ${row("Date / time", `${rec.date}${rec.time ? ` at ${rec.time}` : ""}`)}${row("Location", rec.location)}
      ${row("Witnesses", rec.witnesses)}${row("Recorded by", rec.recordedByName)}
    </table>
    <h2>What happened</h2><div class="box">${esc(rec.description)}</div>
    ${rec.actionTaken ? `<h2>Immediate action taken</h2><div class="box">${esc(rec.actionTaken)}</div>` : ""}
    ${marks ? `<h2>Body map</h2><div>${marks}</div>` : ""}
    <h2>DSL action log</h2><table>${actionsHtml || "<tr><th>Actions</th><td>— none recorded —</td></tr>"}</table>
    ${opts?.extraHtml ?? ""}
    ${contactsHtml ? `<h2>Who to call</h2><div>${contactsHtml}</div>` : ""}
    <p style="margin-top:24px;color:#8a86a3;font-size:11px">Generated from ActivityOS. KCSIE 2026.</p>
    </body></html>`;
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}

interface PdfProvider { name?: string; email?: string; phone?: string; address?: string; logoUrl?: string }
interface EditField { section: string; key: string; label: string }

// Pull the child's full dossier and show it as an EDITABLE preview: tick to
// include, edit any value in place, remove what you don't want. Also offers the
// provider's logo + contact details. "Show all, then edit/remove."
function ConcernPdfDialog({ rec, contacts, provider, onClose }: { rec: SgLog; contacts?: SgContacts; provider: PdfProvider; onClose: () => void }) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [omit, setOmit] = useState<Set<string>>(new Set());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [showLogo, setShowLogo] = useState(true);
  const inited = useRef(false);
  const esc = (s?: string) => (s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));

  useEffect(() => {
    let alive = true;
    apiGet<Dossier>(`/api/incidents/${encodeURIComponent(rec.id)}/dossier`).then((d) => { if (alive) { setDossier(d); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rec.id]);

  // Assemble the editable single-value fields once the dossier lands.
  const singles: EditField[] = [];
  const initVals: Record<string, string> = {};
  const add = (section: string, key: string, label: string, value?: string | number | null) => { if (value != null && String(value).trim()) { singles.push({ section, key, label }); initVals[key] = String(value); } };
  const c = dossier?.child;
  if (c) {
    add("Child on file", "dob", "Date of birth / age", c.dob ? `${c.dob}${(ageOf(c.dob) ?? c.age) != null ? ` · age ${ageOf(c.dob) ?? c.age}` : ""}` : (c.age != null ? `age ${c.age}` : ""));
    add("Child on file", "school", "School", c.school); add("Child on file", "allergies", "Allergies", c.allergies);
    add("Child on file", "medical", "Medical", c.medical); add("Child on file", "send", "SEND", c.send);
    add("Child on file", "dietary", "Dietary", c.dietary); add("Child on file", "swimming", "Swimming", c.swimming);
    add("Child on file", "careNotes", "Care & behaviour notes", c.careNotes); add("Child on file", "collectionPassword", "Collection password", c.collectionPassword);
    add("Child on file", "emergency", "Emergency contact", [c.emergencyName, c.emergencyPhone].filter(Boolean).join(" · "));
  }
  const pa = dossier?.parent;
  if (pa) { add("Parent / carer", "p.name", "Name", pa.name); add("Parent / carer", "p.email", "Email", pa.email); add("Parent / carer", "p.phone", "Phone", pa.phone); add("Parent / carer", "p.address", "Address", pa.address); add("Parent / carer", "p.postcode", "Postcode", pa.postcode); }
  add("Provider", "prov.name", "Provider", provider.name); add("Provider", "prov.email", "Email", provider.email); add("Provider", "prov.phone", "Phone", provider.phone); add("Provider", "prov.address", "Address", provider.address);
  // list-type sections (toggle only)
  const lists: { key: string; label: string }[] = [];
  if (dossier?.siblings?.length) lists.push({ key: "siblings", label: `Siblings (${dossier.siblings.length})` });
  if (dossier?.bookings?.length) lists.push({ key: "bookings", label: `Recent bookings (${dossier.bookings.length})` });
  if (dossier?.history?.length) lists.push({ key: "history", label: `Incident & behaviour history (${dossier.history.length})` });

  useEffect(() => { if (dossier && !inited.current) { inited.current = true; setVals(initVals); } }, [dossier]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = (k: string) => !omit.has(k);
  const toggle = (k: string) => setOmit((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const sections = [...new Set(singles.map((f) => f.section))];

  function build() {
    let extra = "";
    for (const sec of sections) {
      const rows = singles.filter((f) => f.section === sec && on(f.key)).map((f) => `<tr><th>${esc(f.label)}</th><td>${esc(vals[f.key] ?? "")}</td></tr>`).join("");
      if (rows) extra += `<h2>${esc(sec === "Provider" ? "Provider" : sec)}</h2><table>${rows}</table>`;
    }
    if (on("siblings") && dossier?.siblings?.length) extra += `<h2>Siblings</h2><div>${dossier.siblings.map((s) => `${esc(s.name)}${(ageOf(s.dob) ?? s.age) != null ? ` (age ${ageOf(s.dob) ?? s.age})` : ""}`).join("<br>")}</div>`;
    if (on("bookings") && dossier?.bookings?.length) extra += `<h2>Recent bookings</h2><table>${dossier.bookings.map((b) => `<tr><th>${esc(b.listing)}</th><td>${esc(b.dates)}${b.status ? ` · ${esc(b.status)}` : ""}</td></tr>`).join("")}</table>`;
    if (on("history") && dossier?.history?.length) extra += `<h2>Incident &amp; behaviour history</h2><table>${dossier.history.map((h) => `<tr><th>${esc(h.date)} · ${esc(h.kind)}</th><td>${esc(h.category)}${h.severity ? ` · ${esc(h.severity)}` : ""}${h.description ? `<br><span style="color:#8a86a3">${esc(h.description)}</span>` : ""}</td></tr>`).join("")}</table>`;
    downloadConcernPdf(rec, contacts, { extraHtml: extra, logoUrl: showLogo && provider.logoUrl ? provider.logoUrl : undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">Download safeguarding PDF</div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">Everything on file about {rec.childName} is included — untick to remove, or edit any value here before you export.</p>
        {loading ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">Gathering the child&rsquo;s information…</div> : (
          <>
            {provider.logoUrl && (
              <label className="mb-2.5 flex cursor-pointer items-center gap-2 rounded-md bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)]">
                <input type="checkbox" checked={showLogo} onChange={() => setShowLogo((v) => !v)} />Show your logo at the top
              </label>
            )}
            {sections.map((sec) => (
              <div key={sec} className="mb-2.5">
                <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{sec}</div>
                <div className="flex flex-col gap-1">
                  {singles.filter((f) => f.section === sec).map((f) => (
                    <div key={f.key} className="flex items-center gap-2 rounded-md px-1 py-0.5" style={on(f.key) ? {} : { opacity: 0.45 }}>
                      <input type="checkbox" checked={on(f.key)} onChange={() => toggle(f.key)} className="shrink-0" />
                      <span className="w-[130px] shrink-0 text-[11.5px] font-bold text-[var(--ink)]">{f.label}</span>
                      <input value={vals[f.key] ?? ""} disabled={!on(f.key)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className="min-w-0 flex-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[12px] disabled:bg-[var(--panel)]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {lists.length > 0 && (
              <div className="mb-2.5">
                <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">More on file</div>
                <div className="flex flex-col gap-1">
                  {lists.map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-[var(--ink-2)]" style={on(f.key) ? { background: "#eef4fd" } : {}}>
                      <input type="checkbox" checked={on(f.key)} onChange={() => toggle(f.key)} /><b className="text-[var(--ink)]">{f.label}</b>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <Button sm onClick={onClose}>Cancel</Button>
          <Button sm variant="solid" disabled={loading} onClick={build}>⬇ Download PDF</Button>
        </div>
      </div>
    </div>
  );
}

// Build the initial action log — the stored chronology, or migrate a legacy flat
// list of actions into one.
function initialLog(rec: SgLog): DslEntry[] {
  if (rec.dslLog?.length) return rec.dslLog;
  return (rec.dslActions ?? []).map((k, i) => ({ id: `m${i}`, key: k, label: DSL_DECISIONS.find((o) => o.key === k)?.label ?? k, note: i === 0 ? rec.dslOutcome : undefined, at: rec.dslActionedAt ?? "" }));
}

// The DSL action area — a running CHRONOLOGY. Each action you take is logged with
// a timestamp; you add what was said / your actions and a review date per action.
// Auto-saves. You are the DSL.
function DslActions({ rec, contacts, provider, onSaved }: { rec: SgLog; contacts?: SgContacts; provider: PdfProvider; onSaved: () => void }) {
  const [log, setLog] = useState<DslEntry[]>(() => initialLog(rec));
  const [status, setStatus] = useState<"idle" | "editing" | "saved" | "error">("idle");
  const [pdfOpen, setPdfOpen] = useState(false);
  const dirty = useRef(false);
  const mut = (next: DslEntry[]) => { dirty.current = true; setStatus("editing"); setLog(next); };
  const add = (o: (typeof DSL_DECISIONS)[number]) => mut([...log, { id: `a_${new Date().toISOString()}_${log.length}`, key: o.key, label: o.label, at: new Date().toISOString() }]);
  const patch = (id: string, p: Partial<DslEntry>) => mut(log.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const remove = (id: string) => mut(log.filter((e) => e.id !== id));

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      try { await apiPut(`/api/incidents/${encodeURIComponent(rec.id)}`, { dslLog: log, dslActionedAt: new Date().toISOString(), notifyParentOfEdit: false }); setStatus("saved"); onSaved(); }
      catch { setStatus("error"); }
    }, 700);
    return () => clearTimeout(t);
  }, [log]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-2.5 rounded-xl border-2 border-[#1d3a8f] bg-[#f5f9ff] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold text-[#1d3a8f]">🛡️ What you did about it</div>
        <a href={KCSIE_URL} target="_blank" rel="noreferrer" className="flex-none text-[11px] font-bold text-[#1d3a8f] underline">KCSIE 2026 ↗</a>
      </div>
      <p className="mb-2 mt-0.5 text-[11px] text-[var(--ink-3)]">As the safeguarding lead, tap each action you take — it&rsquo;s logged with the time. Add what was said, your actions and a review date under each. Saves as you go.</p>
      <ContactsBlock c={contacts} authorityName={rec.localAuthority} />

      <div className="mt-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Add an action</div>
      <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
        {DSL_DECISIONS.map((o) => { const tc = DTONE[o.tone] ?? DTONE.grey; return (
          <button key={o.key} type="button" onClick={() => add(o)} className="rounded-lg border-2 border-[var(--line)] bg-white p-2 text-left transition-colors hover:border-[#1d3a8f]">
            <div className="text-[12px] font-extrabold" style={{ color: tc.c }}>＋ {o.label}</div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-[var(--ink-3)]">{o.when}</div>
          </button>
        ); })}
      </div>

      {log.length > 0 && (
        <>
          <div className="mt-3 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Action log</div>
          <div className="mt-1 flex flex-col gap-1.5">
            {log.map((e, i) => (
              <div key={e.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-extrabold text-[var(--ink)]">{i + 1}. {e.label}{e.done ? " ✓" : ""}</span>
                  <span className="flex items-center gap-2 text-[10.5px] text-[var(--ink-3)]">{stampTime(e.at)}<button type="button" onClick={() => remove(e.id)} className="font-bold text-[var(--ink-3)] hover:text-[#c02636]">✕</button></span>
                </div>
                <textarea value={e.note ?? ""} onChange={(ev) => patch(e.id, { note: ev.target.value })} rows={2} placeholder="What was said / what you did…" className="mt-1 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-none focus:border-[#1d3a8f]" />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1 text-[var(--ink-3)]">Review by <input type="date" value={e.reviewDate ?? ""} onChange={(ev) => patch(e.id, { reviewDate: ev.target.value || undefined })} className="rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px]" /></label>
                  <button type="button" onClick={() => patch(e.id, { done: !e.done, doneAt: !e.done ? new Date().toISOString() : undefined })} className="rounded-full border px-2.5 py-0.5 font-bold" style={e.done ? { borderColor: "#0f7a43", background: "#e7f6ee", color: "#0f7a43" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{e.done ? "✓ Completed" : "Mark completed"}</button>
                  {e.reviewDate && !e.done && <span className="font-semibold text-[#9a5a00]">🗓 due {e.reviewDate}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPdfOpen(true)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">⬇ Download PDF…</button>
        {pdfOpen && <ConcernPdfDialog rec={rec} contacts={contacts} provider={provider} onClose={() => setPdfOpen(false)} />}
        <span className="text-[11px] font-semibold" style={{ color: status === "error" ? "#c02636" : status === "saved" ? "#0f7a43" : "var(--ink-3)" }}>
          {status === "editing" ? "Saving…" : status === "saved" ? "✓ Saved" : status === "error" ? "Couldn’t save — try again" : "Saves automatically"}
        </span>
      </div>
    </div>
  );
}

export function SafeguardingApp() {
  const { settings } = useSettings();
  const sg = settings.safeguarding ?? {};
  const b = settings.billing ?? {};
  const provider: PdfProvider = { name: settings.providerName || b.businessName, email: b.email, phone: b.phone, address: b.address, logoUrl: b.logoUrl };
  const [logs, setLogs] = useState<SgLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SgLog | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const refresh = useCallback(() => {
    apiGet<SgLog[]>("/api/incidents?kind=safeguarding").then((l) => { setLogs(l); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["incidents"], refresh);

  async function remove(l: SgLog) {
    if (!confirm(`Delete this safeguarding record for ${l.childName}? Safeguarding records are usually kept.`)) return;
    try { await api(`/api/incidents/${encodeURIComponent(l.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  const all = logs ?? [];
  const ql = q.trim().toLowerCase();
  const shown = all.filter((l) => (!ql || l.childName.toLowerCase().includes(ql) || l.description.toLowerCase().includes(ql) || (l.concernCategory ?? "").toLowerCase().includes(ql)) && (!riskFilter || l.severity === riskFilter));
  const thisMonth = all.filter((l) => (l.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const high = all.filter((l) => l.severity === "serious").length;
  const tiles: [string, number][] = [["This month", thisMonth], ["High risk", high], ["Total", all.length]];

  return (
    <div>
      {/* You are the DSL — concerns come straight here */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#cfe0f7] bg-[#f5f9ff] px-3.5 py-2.5">
        <span className="text-[16px] leading-none">🛡️</span>
        <div className="text-[12px] leading-snug text-[var(--ink-2)]"><b className="text-[#1d3a8f]">You are the safeguarding lead{sg.dslName ? ` (${sg.dslName})` : ""}.</b> Record a concern, then record what you did about it — including which agency you called. <span className="font-semibold text-[var(--ink-2)]">Set your local contacts (LADO, children&rsquo;s social care), categories and protocol in Setup → Safeguarding.</span></div>
      </div>

      {/* compact header — the page title bar is provided by Log concern */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap gap-2.5">
          {logs && tiles.map(([label, v]) => (
            <div key={label} className="rounded-xl bg-[var(--panel)] px-3.5 py-1.5">
              <div className="text-[18px] font-extrabold leading-none text-[var(--ink)]">{v}</div>
              <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
            </div>
          ))}
        </div>
        {!adding && !editing && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px">＋ Log a safeguarding concern</button>}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}
      {adding && <SgForm onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}
      {editing && <SgForm key={editing.id} existing={editing} onSaved={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}

      {all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", "All"], ["minor", "Low"], ["moderate", "Medium"], ["serious", "High"]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setRiskFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors" style={riskFilter === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search child, category or details…" className="ml-auto w-60 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!logs ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No safeguarding records — hopefully it stays that way." : "No records match."}</Card>
        : (
          <div className="flex flex-col gap-4">
            {groupByChild(shown).map((g) => (
              <div key={g.key}>
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  <span className="text-[13.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>👤 {g.name}</span>
                  <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-3)]">{g.items.length} record{g.items.length === 1 ? "" : "s"}</span>
                </div>
                <div className="flex flex-col gap-2.5">
            {g.items.map((l) => {
              const risk = RISK[l.severity] ?? RISK.moderate;
              return (
                <Card key={l.id} className="overflow-hidden p-0">
                  <div className="h-1 w-full" style={{ background: risk.fg }} />
                  <div className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[15px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{l.childName}</span>
                          {l.concernCategory && <span className="text-[12px] text-[var(--ink-2)]">{l.concernCategory}</span>}
                          <span className="text-[11px] text-[var(--ink-3)]">{fmtDate(l.date)}{l.time ? ` · ${l.time}` : ""}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 max-w-[640px] text-[12.5px] leading-snug text-[var(--ink-2)]">{l.description}</p>
                        {(() => { const pend = (l.dslLog ?? []).filter((e) => e.reviewDate && !e.done); if (!pend.length) return null; const next = pend.map((e) => e.reviewDate!).sort()[0]; return <p className="mt-1 text-[11.5px] font-bold text-[#9a5a00]">🗓 {pend.length} action{pend.length === 1 ? "" : "s"} to complete by {next}</p>; })()}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 sm:max-w-[46%] sm:justify-end">
                        <Badge tone={{ bg: risk.bg, fg: risk.fg }}>{risk.label} risk</Badge>
                        {l.subject === "staff" && <Badge tone={{ bg: "#f3e8ff", fg: "#6d28d9" }}>🧑‍🏫 Staff</Badge>}
                        {(l.dslLog?.length ?? 0) > 0 || (l.dslActions?.length ?? 0) > 0 ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ DSL actioned</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>⏳ Awaiting DSL</Badge>}
                        {(l.bodyMap?.length ?? 0) > 0 && <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>⛑️ {l.bodyMap!.length}</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--line)] pt-2">
                      <Button sm variant={openId !== l.id && (l.dslLog?.length ?? 0) === 0 ? "solid" : undefined} onClick={() => setOpenId(openId === l.id ? null : l.id)}>{openId === l.id ? "Hide" : (l.dslLog?.length ?? 0) > 0 ? "🛡️ Review & action" : "🛡️ Review & action (DSL)"}</Button>
                      <Button sm variant="solid" onClick={() => { setEditing(l); setAdding(false); setOpenId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit/Update</Button>
                      {canManage && <Button sm variant="danger" onClick={() => remove(l)}>Delete</Button>}
                    </div>
                    {openId === l.id && (
                      <>
                        {/* Your action area — record what you did about it */}
                        <DslActions rec={l} contacts={sg.contacts} provider={provider} onSaved={refresh} />
                        <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">The concern</div>
                        <div className="mt-1 grid gap-x-6 gap-y-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12px] sm:grid-cols-2">
                          {l.location && <div><span className="text-[var(--ink-3)]">Where: </span><b>{l.location}</b></div>}
                          {l.actionTaken && <div><span className="text-[var(--ink-3)]">Immediate action: </span><b>{l.actionTaken}</b></div>}
                          {l.reportedTo && <div><span className="text-[var(--ink-3)]">Told: </span><b>{l.reportedTo}</b></div>}
                          {l.witnesses && <div><span className="text-[var(--ink-3)]">Witnesses: </span><b>{l.witnesses}</b></div>}
                          {l.recordedByName && <div><span className="text-[var(--ink-3)]">Recorded by: </span><b>{l.recordedByName}</b></div>}
                          {(l.attachments?.length ?? 0) > 0 && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Attachments: </span>{l.attachments!.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="mr-2 font-bold text-[#1d3a8f] underline">📎 file {i + 1}</a>)}</div>}
                        </div>
                        {(l.bodyMap?.length ?? 0) > 0 && <div className="mt-2.5"><BodyMap value={l.bodyMap ?? []} readOnly startOpen /></div>}
                        <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Action log &amp; notes</div>
                        <NotesThread id={l.id} notes={l.notes} side="staff" onAdded={refresh} />
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
