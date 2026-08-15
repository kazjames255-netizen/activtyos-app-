"use client";

// Applications / recruitment — before onboarding. Build one or more editable
// application forms, send them to candidates, receive their applications, then
// Reject (with a reason) or Accept. On accept you can send the onboarding link
// we already have — and anything the applicant already gave that also lives in
// onboarding (references, address, etc.) auto-carries over so they never repeat
// it. Front-end demo stores; real submissions + email are Amir's.
import { useEffect, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { DEFAULT_FIELDS } from "./OnboardingApp";

type AField = { id: string; label: string; type: "text" | "textarea" | "email" | "tel" | "date" | "select" | "file" | "locations"; required: boolean; options?: string[]; mapsTo?: string };
// the provider's sites — applicants pick one or more they can work at (demo; real
// locations come from the backend). Deployment to specific listings happens later.
const APP_LOCATIONS = ["Milton Keynes", "Northampton", "Bedford", "Company-owned (Head Office)"];
interface AppForm { id: string; name: string; fields: AField[]; summary?: string; payKind?: string; payAmount?: string; logo?: string; accent?: string }
const escH = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const PAY_KINDS = ["Not stated", "Per hour", "Per day", "Annual salary", "Range"];
const payLabel = (f: AppForm) => f.payKind && f.payKind !== "Not stated" && f.payAmount ? `${f.payAmount}${f.payKind === "Per hour" ? "/hour" : f.payKind === "Per day" ? "/day" : f.payKind === "Annual salary" ? "/year" : ""}` : "";

// Nice-looking applicant preview — opens the form branded as a candidate sees it.
function previewForm(form: AppForm, provider: string) {
  if (typeof window === "undefined") return;
  const accent = form.accent || "#1d3a8f";
  const pay = payLabel(form);
  const field = (fl: AField) => {
    const req = fl.required ? '<span class="rq">*</span>' : "";
    let ctrl = "";
    if (fl.type === "textarea") ctrl = '<textarea class="in" rows="3" placeholder="Your answer…"></textarea>';
    else if (fl.type === "select") ctrl = `<select class="in"><option value="">Choose…</option>${(fl.options ?? []).map((o) => `<option>${escH(o)}</option>`).join("")}</select>`;
    else if (fl.type === "file") ctrl = '<div class="file"><span class="fbtn">⬆ Upload</span> or drag a file here</div>';
    else if (fl.type === "locations") ctrl = `<div class="locs">${APP_LOCATIONS.map((l) => `<label class="lc"><input type="checkbox"> ${escH(l)}</label>`).join("")}</div>`;
    else ctrl = `<input class="in" type="${fl.type === "date" ? "date" : fl.type === "tel" ? "tel" : fl.type === "email" ? "email" : "text"}" placeholder="${fl.type === "email" ? "you@email.com" : fl.type === "tel" ? "07…" : ""}">`;
    return `<div class="fld"><label class="lb">${escH(fl.label)}${req}</label>${ctrl}</div>`;
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(form.name)} — Apply</title><style>
    :root{--a:${accent}}*{box-sizing:border-box}body{margin:0;background:#eef2f9;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b}
    .wrap{max-width:680px;margin:0 auto;padding:30px 16px 60px}
    .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px -40px rgba(16,32,90,.5)}
    .hero{background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--a) 55%,#ffffff));color:#fff;padding:26px 28px}
    .logo{height:46px;background:#fff;border-radius:9px;padding:5px;display:block;margin-bottom:12px}
    .prov{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.92}
    h1{font-size:24px;margin:.2em 0 .1em}
    .pay{display:inline-block;background:rgba(255,255,255,.22);border-radius:99px;padding:4px 12px;font-size:12.5px;font-weight:800;margin-top:6px}
    .sum{font-size:13.5px;line-height:1.55;opacity:.95;margin-top:8px}
    form{padding:22px 28px}
    .fld{margin-bottom:16px}.lb{display:block;font-size:12.5px;font-weight:800;color:#3a4a68;margin-bottom:6px}.rq{color:#c0392b;margin-left:3px}
    .in{width:100%;border:1px solid #d9e0ee;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;background:#fff}.in:focus{outline:none;border-color:var(--a)}textarea.in{resize:vertical}
    .file{border:1.5px dashed #cdd6e8;border-radius:10px;padding:12px;font-size:12.5px;color:#8a92a8}.fbtn{color:var(--a);font-weight:800}
    .locs{display:flex;flex-wrap:wrap;gap:8px}.lc{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;background:#f4f6fb;border:1px solid #e6ebf5;border-radius:10px;padding:7px 11px}
    .submit{width:100%;background:var(--a);color:#fff;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:800;cursor:pointer;margin-top:6px}
    .foot{text-align:center;font-size:11px;color:#8a92a8;margin-top:14px}
    .badge{position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111634;color:#fff;font-size:11.5px;font-weight:800;padding:6px 14px;border-radius:99px;opacity:.92;z-index:9}
  </style></head><body><div class="badge">👁 Applicant preview — what candidates see</div><div class="wrap"><div class="card">
    <div class="hero">${form.logo ? `<img class="logo" src="${form.logo}"/>` : ""}<div class="prov">${escH(provider)}</div><h1>${escH(form.name)}</h1>${pay ? `<span class="pay">💷 ${escH(pay)}</span>` : ""}${form.summary ? `<div class="sum">${escH(form.summary)}</div>` : ""}</div>
    <form onsubmit="return false">${form.fields.map(field).join("")}<button class="submit" type="button">Submit application</button><div class="foot">Powered by ActivityOS</div></form>
  </div></div></body></html>`;
  const w = window.open(); if (w) { w.document.write(html); w.document.close(); }
}
interface Application { id: string; formId: string; name: string; email: string; answers: Record<string, string>; files?: Record<string, { name: string; data: string }>; locations?: string[]; submittedAt: string; status: "new" | "accepted" | "rejected"; rejectReason?: string; onboardingSent?: boolean }
const openFile = (dataUrl?: string) => { if (!dataUrl || typeof window === "undefined") return; const w = window.open(); if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100vw;height:100vh"></iframe>`); };
const SAMPLE_PDF = "data:text/html,<body style='font-family:Georgia;padding:60px;max-width:640px;margin:auto'><h2>Sample uploaded document</h2><p>This is a placeholder for the document the applicant attached. Real uploads are stored and viewed here once the backend is wired.</p></body>";

const FORMS_KEY = "aos.team.appforms.v1";
const APPS_KEY = "aos.team.applications.v1";
const ONBOARD_RECORDS_KEY = "aos.team.onboardrecords.v1";

const F = (id: string, label: string, type: AField["type"], required = false, mapsTo?: string, options?: string[]): AField => ({ id, label, type, required, mapsTo, options });

// The master template — a comprehensive UK children's-activity application form.
// Fully editable; fields with mapsTo pre-fill onboarding on accept.
function defaultForm(): AppForm {
  return {
    id: "standard", name: "Standard application", accent: "#1d3a8f",
    summary: "Thanks for your interest in joining our team! Please complete this application in full — it should take about 10 minutes. Fields marked * are required.",
    payKind: "Not stated",
    fields: [
      // — about you —
      F("fullName", "Full name", "text", true, "fullName"),
      F("prevNames", "Previous / known-as names", "text", false, "prevNames"),
      F("dob", "Date of birth", "date", false, "dob"),
      F("email", "Email", "email", true, "email"),
      F("phone", "Mobile number", "tel", true, "phone"),
      F("address1", "Address line 1", "text", false, "address1"),
      F("town", "Town / city", "text", false, "town"),
      F("postcode", "Postcode", "text", false, "postcode"),
      F("nationality", "Nationality", "text", false, "nationality"),
      // — the role —
      F("position", "Position applied for", "text", false, "jobTitle"),
      F("locations", "Location(s) you can work at", "locations", true),
      F("hours", "Hours / days you're looking for", "text", false, "hours"),
      F("startDate", "Earliest start date", "date", false, "startDate"),
      F("why", "Why do you want this role?", "textarea", false),
      // — experience & qualifications —
      F("experience", "Relevant experience", "textarea", false),
      F("qualifications", "Qualifications & training", "textarea", false, "qualifications"),
      F("qualDocs", "Qualification certificates (upload)", "file", false, "qualDocs"),
      // — right to work —
      F("rtw", "Do you have the right to work in the UK?", "select", true, undefined, ["Yes", "Not yet / need sponsorship"]),
      F("shareCode", "Right-to-work share code (if applicable)", "text", false, "shareCode"),
      F("rtwEvidence", "Right-to-work document (upload)", "file", false, "rtwEvidence"),
      F("idFile", "Photo ID (upload)", "file", false, "idFile"),
      // — safeguarding self-declaration —
      F("disqualQ", "Are you disqualified from working with children? (Childcare Disqualification Regs)", "select", true, undefined, ["No", "Yes"]),
      F("convictions", "Do you have any unspent convictions or cautions? (this post is exempt from the Rehabilitation of Offenders Act)", "select", true, undefined, ["No", "Yes — will disclose"]),
      F("dbsHeld", "Do you hold a current enhanced DBS?", "select", false, undefined, ["No", "Yes", "Yes — on the Update Service"]),
      F("dbsFile", "DBS certificate, if held (upload)", "file", false, "dbsFile"),
      // — references —
      F("ref1Name", "Reference 1 — name", "text", true, "ref1Name"),
      F("ref1Org", "Reference 1 — organisation", "text", false, "ref1Org"),
      F("ref1Email", "Reference 1 — email", "email", false, "ref1Email"),
      F("ref1Phone", "Reference 1 — phone", "tel", false, "ref1Phone"),
      F("ref2Name", "Reference 2 — name", "text", true, "ref2Name"),
      F("ref2Org", "Reference 2 — organisation", "text", false, "ref2Org"),
      F("ref2Email", "Reference 2 — email", "email", false, "ref2Email"),
      F("employHistory", "Employment history & any gaps", "textarea", false, "employHistory"),
      // — emergency & extras —
      F("emergName", "Emergency contact — name", "text", false, "emergName"),
      F("emergPhone", "Emergency contact — phone", "tel", false, "emergPhone"),
      F("heardVia", "How did you hear about this role?", "text", false),
      F("cv", "Upload your CV (optional)", "file", false),
    ],
  };
}

function seedApps(): Application[] {
  const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  return [
    { id: "a1", formId: "standard", name: "Chloe Adams", email: "chloe.adams@example.com", submittedAt: day(2), status: "new", answers: { fullName: "Chloe Adams", email: "chloe.adams@example.com", phone: "07700 900321", address1: "14 Elm Road", town: "Milton Keynes", postcode: "MK9 2AA", nationality: "British", position: "Coach", experience: "3 years coaching multi-sports holiday camps.", qualifications: "Level 2 Multi-Skills, Paediatric First Aid", ref1Name: "Sam Okafor", ref1Email: "sam.o@oldclub.example", ref1Phone: "07700 900654", ref2Name: "Dana Patel", ref2Email: "dana.p@school.example", rtw: "Yes", why: "I love helping kids build confidence through sport." }, files: { idFile: { name: "chloe-passport.pdf", data: SAMPLE_PDF }, dbsFile: { name: "chloe-dbs.pdf", data: SAMPLE_PDF }, qualDocs: { name: "chloe-certificates.pdf", data: SAMPLE_PDF } }, locations: ["Milton Keynes"] },
    { id: "a2", formId: "standard", name: "Ben Carter", email: "ben.carter@example.com", submittedAt: day(1), status: "new", answers: { fullName: "Ben Carter", email: "ben.carter@example.com", phone: "07700 900112", address1: "9 Oak Avenue", town: "Northampton", postcode: "NN1 3BB", nationality: "British", position: "Activity Instructor", experience: "Lifeguard + swim teaching, 2 years.", qualifications: "NPLQ, Swim Teacher L2", ref1Name: "Priya Shah", ref1Email: "priya@pool.example", rtw: "Yes", why: "Keen to move into a year-round role." }, files: { idFile: { name: "ben-driving-licence.jpg", data: SAMPLE_PDF }, rtwEvidence: { name: "ben-share-code.pdf", data: SAMPLE_PDF } }, locations: ["Northampton", "Bedford"] },
    { id: "a3", formId: "standard", name: "Amir Hussain", email: "amir.h@example.com", submittedAt: day(5), status: "rejected", rejectReason: "No relevant experience / no DBS on file.", answers: { fullName: "Amir Hussain", email: "amir.h@example.com", phone: "07700 900999", position: "Coach", experience: "Retail background.", rtw: "Yes" } },
  ];
}

const fmtDate = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const STATUS_TONE: Record<string, string> = { new: "bg-[#e6efff] text-[#1d54c4]", accepted: "bg-[#e6f4ea] text-[#0f7a43]", rejected: "bg-[#fdecec] text-[#c0392b]" };

// carry an accepted application's answers into the applicant's onboarding record
function carryOver(app: Application, form: AppForm) {
  try {
    const list: { staff: string; values: Record<string, { v?: string; fileData?: string; fileName?: string }>; extra: string[] }[] = JSON.parse(localStorage.getItem(ONBOARD_RECORDS_KEY) || "[]");
    const idx = list.findIndex((r) => r.staff === app.name);
    const rec = idx >= 0 ? list[idx] : { staff: app.name, values: {}, extra: [] };
    for (const f of form.fields) {
      if (!f.mapsTo) continue;
      const file = app.files?.[f.id];
      if (file) rec.values[f.mapsTo] = { fileData: file.data, fileName: file.name };
      else if (app.answers[f.id]) rec.values[f.mapsTo] = { v: app.answers[f.id] };
    }
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    localStorage.setItem(ONBOARD_RECORDS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function ApplicationsPanel() {
  const { settings } = useSettings();
  const provider = settings.providerName || settings.billing?.businessName || "Your company";
  const [tab, setTab] = useState<"received" | "forms">("received");
  const [forms, setForms] = useState<AppForm[]>([defaultForm()]);
  const [apps, setApps] = useState<Application[]>(seedApps);
  const [sel, setSel] = useState<string | null>(null);
  const [applView, setApplView] = useState<"cards" | "table">("cards");
  const [locFilter, setLocFilter] = useState("all");
  const [rowOpen, setRowOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [editForm, setEditForm] = useState<AppForm | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem(FORMS_KEY) || "null"); if (Array.isArray(f) && f.length) setForms(f); } catch { /* ignore */ }
    try { const a = JSON.parse(localStorage.getItem(APPS_KEY) || "null"); if (Array.isArray(a)) setApps(a); } catch { /* ignore */ }
  }, []);
  const saveForms = (f: AppForm[]) => { setForms(f); try { localStorage.setItem(FORMS_KEY, JSON.stringify(f)); } catch { /* ignore */ } };
  const saveApps = (a: Application[]) => { setApps(a); try { localStorage.setItem(APPS_KEY, JSON.stringify(a)); } catch { /* ignore */ } };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  const app = apps.find((a) => a.id === sel) || null;
  const formOf = (id: string) => forms.find((f) => f.id === id) || forms[0];
  const setStatus = (id: string, patch: Partial<Application>) => saveApps(apps.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const accept = (a: Application) => { setStatus(a.id, { status: "accepted", rejectReason: undefined }); };
  const reject = (a: Application) => { setStatus(a.id, { status: "rejected", rejectReason: reason.trim() || "Not suitable at this time." }); setReason(""); };
  const sendOnboarding = (a: Application) => { const f = formOf(a.formId); carryOver({ ...a, status: "accepted" }, f); setStatus(a.id, { status: "accepted", onboardingSent: true }); flash(`📨 Onboarding link sent to ${a.name}. Their references, address & details from the application will pre-fill — they won't be asked again.`); };
  const newCount = apps.filter((a) => a.status === "new").length;
  const filtered = locFilter === "all" ? apps : apps.filter((a) => (a.locations ?? []).includes(locFilter));

  // full application detail — used by the cards pane and the table drawer
  const detailBody = (app: Application) => { const f = formOf(app.formId); return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div><div className="text-[16px] font-extrabold text-[var(--ink)]">{app.name}</div><div className="text-[12px] text-[var(--ink-3)]">{app.email} · applied {fmtDate(app.submittedAt)}</div></div>
        <span className={"ml-auto rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase " + STATUS_TONE[app.status]}>{app.status}</span>
      </div>
      {(app.locations?.length ?? 0) > 0 && <div className="mb-3 flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">📍 Locations</span>{app.locations!.map((l) => <span key={l} className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[11px] font-bold text-[#1d54c4]">{l}</span>)}</div>}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {f.fields.map((fl) => { const v = app.answers[fl.id]; const file = app.files?.[fl.id]; if (!v && !file) return null; return (
          <div key={fl.id} className={"rounded-lg bg-[var(--panel)] px-3 py-2 " + (fl.type === "textarea" ? "sm:col-span-2" : "")}>
            <div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{fl.label}{fl.mapsTo && <span title="Carries into onboarding" className="ml-1 text-[#0f7a43]">↳</span>}</div>
            {file ? <button type="button" onClick={() => openFile(file.data)} className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">📎 {file.name} · View</button> : <div className="text-[12.5px] font-semibold text-[var(--ink)]">{v}</div>}
          </div>
        ); })}
      </div>
      <div className="mb-3 rounded-xl border border-[#cfe8d7] bg-[#f4fbf6] px-3.5 py-2 text-[11.5px] leading-relaxed text-[#0f7a43]">↳ Fields marked with an arrow are also part of onboarding — when you accept &amp; send the onboarding link, they <b>carry over automatically</b> so {app.name.split(" ")[0]} won&rsquo;t be asked again.</div>
      {app.status === "rejected" && app.rejectReason && <div className="mb-3 rounded-xl bg-[#fdecec] px-3.5 py-2 text-[12px] font-semibold text-[#c0392b]">Rejected: {app.rejectReason}</div>}
      {app.status === "accepted" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0f7a43]">✓ Accepted</span>
          <Button variant="primary" onClick={() => sendOnboarding(app)}>{app.onboardingSent ? "Resend onboarding link" : "📨 Send onboarding link"}</Button>
          <button type="button" onClick={() => setStatus(app.id, { status: "new", onboardingSent: false })} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:underline">Undo</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Button variant="primary" onClick={() => accept(app)}>✓ Accept</Button><span className="text-[11.5px] text-[var(--ink-3)]">then send the onboarding link</span></div>
          <div className="rounded-xl border border-[var(--line)] p-2.5">
            <div className="mb-1 text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">Reject with a reason</div>
            <div className="flex flex-wrap items-center gap-2"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept on file)…" className="min-w-[200px] flex-1" /><Button onClick={() => reject(app)}>Reject</Button></div>
          </div>
        </div>
      )}
    </>
  ); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
          {([["received", `📥 Applications${newCount ? ` (${newCount} new)` : ""}`], ["forms", "📝 Application forms"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (tab === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
          ))}
        </div>
        <Button variant="primary" className="ml-auto" onClick={() => setSendOpen(true)}>📨 Send application</Button>
      </div>

      {tab === "received" ? (<>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-bold text-[var(--ink-3)]">📍 Location</label>
          <Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="max-w-[240px]"><option value="all">All locations</option>{APP_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}</Select>
          <span className="text-[11.5px] text-[var(--ink-3)]">{filtered.length} application{filtered.length === 1 ? "" : "s"}</span>
          <div className="ml-auto inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
            {([["cards", "🗂 Cards"], ["table", "▤ Table"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setApplView(k)} className={"rounded-full px-3 py-1 text-[12px] font-bold transition-colors " + (applView === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
            ))}
          </div>
        </div>

        {applView === "table" ? (
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-[var(--line)] bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Status</th><th className="px-3 py-2.5 font-extrabold">Submitted</th><th className="px-3 py-2.5 font-extrabold">Name</th><th className="px-3 py-2.5 font-extrabold">Position</th><th className="px-3 py-2.5 font-extrabold">Location(s)</th><th className="px-3 py-2.5 font-extrabold">Docs</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{filtered.map((a) => (
                <tr key={a.id} className="cursor-pointer border-t border-[var(--line-2,#eef2f8)] hover:bg-[var(--panel)]" onClick={() => setRowOpen(a.id)}>
                  <td className="px-3 py-2.5"><span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase " + STATUS_TONE[a.status]}>● {a.status}{a.onboardingSent ? " · sent" : ""}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--ink-2)] tabular-nums">{fmtDate(a.submittedAt)}</td>
                  <td className="px-3 py-2.5 font-bold text-[var(--ink)]">{a.name}</td>
                  <td className="px-3 py-2.5 text-[var(--ink-2)]">{a.answers.position || "—"}</td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{(a.locations ?? []).map((l) => <span key={l} className="rounded-full bg-[#eaf1ff] px-1.5 py-0.5 text-[10px] font-bold text-[#1d54c4]">{l}</span>)}{!(a.locations ?? []).length && <span className="text-[var(--ink-3)]">—</span>}</div></td>
                  <td className="px-3 py-2.5 text-[var(--ink-3)]">{Object.keys(a.files ?? {}).length ? `📎 ${Object.keys(a.files ?? {}).length}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right"><span className="text-[12px] font-bold text-[#1d3a8f]">Open →</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-[var(--ink-3)]">No applications match.</td></tr>}</tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[280px_1fr]">
            <div className="space-y-2">
              {filtered.map((a) => (
                <button key={a.id} type="button" onClick={() => setSel(a.id)} className={"block w-full rounded-xl border p-3 text-left transition-colors " + (sel === a.id ? "border-[#1d3a8f] bg-[#eef4ff]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[#1d3a8f]")}>
                  <div className="flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{a.name}</span><span className={"ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase " + STATUS_TONE[a.status]}>{a.status}{a.onboardingSent ? " · sent" : ""}</span></div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{a.answers.position || "—"} · applied {fmtDate(a.submittedAt)}{(a.locations?.length ?? 0) ? ` · 📍 ${a.locations!.join(", ")}` : ""}</div>
                </button>
              ))}
              {filtered.length === 0 && <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">No applications match.</Card>}
            </div>
            <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              {!app ? <div className="grid h-full min-h-[200px] place-items-center text-[13px] text-[var(--ink-3)]">Select an application to review.</div> : detailBody(app)}
            </div>
          </div>
        )}

        {rowOpen && (() => { const a = apps.find((x) => x.id === rowOpen); if (!a) return null; return (
          <div className="fixed inset-0 z-[141] flex justify-end bg-black/45" onClick={() => setRowOpen(null)}>
            <div className="h-full w-full max-w-lg overflow-y-auto bg-[var(--surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-2 flex justify-end"><button type="button" onClick={() => setRowOpen(null)} className="text-[20px] text-[var(--ink-3)] hover:text-[var(--ink)]">×</button></div>
              {detailBody(a)}
            </div>
          </div>);
        })()}
      </>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Button variant="primary" onClick={() => setEditForm({ id: "form_" + Date.now().toString(36), name: "New application form", fields: [] })}>+ New application form</Button><span className="text-[11.5px] text-[var(--ink-3)]">Build one or more editable forms to send to candidates.</span></div>
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--panel)] text-[18px]">📝</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{form.name}</span>{payLabel(form) && <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">💷 {payLabel(form)}</span>}</div><div className="text-[11.5px] text-[var(--ink-3)]">{form.fields.length} fields · {form.fields.filter((x) => x.mapsTo).length} carry into onboarding{form.summary ? " · has job summary" : ""}</div></div>
              <Button onClick={() => previewForm(form, provider)}>👁 Preview</Button>
              <Button onClick={() => setSendOpen(true)}>Send</Button>
              <Button onClick={() => setEditForm(form)}>Edit</Button>
              <Button onClick={() => { const clone: AppForm = { id: "form_" + Date.now().toString(36), name: form.name + " (copy)", fields: form.fields.map((x) => ({ ...x })) }; saveForms([...forms, clone]); setEditForm(clone); }}>Duplicate</Button>
              {forms.length > 1 && <button type="button" title="Delete" onClick={() => { if (window.confirm(`Delete “${form.name}”?`)) saveForms(forms.filter((x) => x.id !== form.id)); }} className="rounded-full border border-[var(--line)] px-2.5 py-1.5 text-[13px] text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]">🗑</button>}
            </Card>
          ))}
        </div>
      )}

      {sendOpen && <SendModal forms={forms} onSent={flash} onClose={() => setSendOpen(false)} />}
      {editForm && <FormEditor form={editForm} jobTitles={settings.staffRoles ?? []} provider={provider} onSave={(fm) => { saveForms(forms.some((x) => x.id === fm.id) ? forms.map((x) => (x.id === fm.id ? fm : x)) : [...forms, fm]); setEditForm(null); }} onClose={() => setEditForm(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// Send an application form: share a public link, or email a specific candidate.
function SendModal({ forms, onSent, onClose }: { forms: AppForm[]; onSent: (m: string) => void; onClose: () => void }) {
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/apply/${formId}`;
  const copy = () => { try { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const emailIt = () => { if (!email.trim()) return; onClose(); onSent(`📨 Application invite sent to ${name.trim() || email.trim()} — when they apply it lands in Applications.`); };
  return (
    <div className="fixed inset-0 z-[141] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Send an application</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">Candidates fill it in and their application lands in <b>Applications</b> for you to review.</p>

        <label className="mb-2 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Which form to send</span><Select value={formId} onChange={(e) => setFormId(e.target.value)} className="w-full">{forms.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.fields.length} fields</option>)}</Select></label>
        {(() => { const sf = forms.find((x) => x.id === formId); if (!sf || (!sf.summary && !payLabel(sf))) return null; return (
          <div className="mb-3 rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Candidates will see</div>{sf.summary && <div className="text-[12px] text-[var(--ink-2)]">{sf.summary}</div>}{payLabel(sf) && <div className="mt-0.5 text-[12px] font-bold text-[#0f7a43]">💷 {payLabel(sf)}</div>}</div>
        ); })()}

        <div className="mb-3 rounded-xl border border-[var(--line)] p-3">
          <div className="mb-1 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">🔗 Share a link</div>
          <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">Post it on a job board, your website or socials — anyone with the link can apply.</div>
          <div className="flex items-center gap-2"><Input value={link} readOnly className="flex-1 text-[12px]" onFocus={(e) => e.currentTarget.select()} /><Button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</Button></div>
        </div>

        <div className="rounded-xl border border-[var(--line)] p-3">
          <div className="mb-1 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">✉️ Or email a candidate</div>
          <div className="grid gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" className="w-full" />
            <div className="flex items-center gap-2"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="flex-1" /><Button variant="primary" disabled={!email.trim()} onClick={emailIt}>Send</Button></div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[var(--ink-3)]">Demo: the link + email send are wired to the backend (Amir). The <b>/apply</b> page candidates fill in is the backend piece.</p>
      </div>
    </div>
  );
}

const ONBOARD_TARGETS: [string, string][] = DEFAULT_FIELDS.filter((f) => ["text", "tel", "email", "date", "textarea", "select", "jobtitle", "file"].includes(f.type)).map((f) => [f.id, f.label]);

function FormEditor({ form, jobTitles, provider, onSave, onClose }: { form: AppForm; jobTitles: string[]; provider: string; onSave: (f: AppForm) => void; onClose: () => void }) {
  const [f, setF] = useState<AppForm>(form);
  const [nl, setNl] = useState("");
  const patch = (id: string, p: Partial<AField>) => setF((x) => ({ ...x, fields: x.fields.map((fl) => (fl.id === id ? { ...fl, ...p } : fl)) }));
  const add = () => { if (!nl.trim()) return; setF((x) => ({ ...x, fields: [...x.fields, { id: "f_" + nl.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 16) + "_" + x.fields.length, label: nl.trim(), type: "text", required: false }] })); setNl(""); };
  return (
    <div className="fixed inset-0 z-[141] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5"><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Edit application form</h3><Button className="ml-auto" onClick={() => previewForm(f, provider)}>👁 Preview</Button><button type="button" onClick={onClose} className="text-[18px] text-[var(--ink-3)]">×</button></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Form name</span><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full" /></label>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Branding</div>
            {f.logo ? <img src={f.logo} alt="logo" className="h-9 rounded bg-white p-0.5" /> : <span className="text-[11.5px] text-[var(--ink-3)]">No logo</span>}
            <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ {f.logo ? "Replace logo" : "Upload logo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => setF({ ...f, logo: String(r.result) }); r.readAsDataURL(file); }} /></label>
            {f.logo && <button type="button" onClick={() => setF({ ...f, logo: undefined })} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-3)]">Colour<input type="color" value={f.accent ?? "#1d3a8f"} onChange={(e) => setF({ ...f, accent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5" /></label>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Job summary &amp; pay (optional)</div>
            <textarea value={f.summary ?? ""} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={2} placeholder="Short description of the role — shown to candidates on the application." className="mb-2 w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-3)]">PAY<Select value={f.payKind ?? "Not stated"} onChange={(e) => setF({ ...f, payKind: e.target.value })} className="max-w-[150px]">{PAY_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select></label>
              {f.payKind && f.payKind !== "Not stated" && <div className="flex items-center gap-1"><span className="text-[13px] font-bold text-[var(--ink-3)]">£</span><Input value={(f.payAmount ?? "").replace(/^£/, "")} onChange={(e) => setF({ ...f, payAmount: e.target.value ? "£" + e.target.value.replace(/^£/, "") : "" })} placeholder={f.payKind === "Annual salary" ? "24,000" : f.payKind === "Range" ? "12–14/hour" : "12.50"} className="w-[130px]" /></div>}
            </div>
          </div>
          <div className="space-y-1.5">
            {f.fields.map((fl) => (
              <div key={fl.id} className="rounded-lg border border-[var(--line)] p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input value={fl.label} onChange={(e) => patch(fl.id, { label: e.target.value })} className="min-w-[150px] flex-1" />
                  <Select value={fl.type} onChange={(e) => patch(fl.id, { type: e.target.value as AField["type"] })} className="max-w-[130px]"><option value="text">Text</option><option value="textarea">Long text</option><option value="email">Email</option><option value="tel">Phone</option><option value="date">Date</option><option value="select">Dropdown</option><option value="file">File upload</option><option value="locations">Location multi-select</option></Select>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={fl.required} onChange={(e) => patch(fl.id, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[#1d3a8f]" />Req</label>
                  <button type="button" onClick={() => setF((x) => ({ ...x, fields: x.fields.filter((y) => y.id !== fl.id) }))} className="text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
                <div className="mt-1.5 flex items-center gap-2"><span className="text-[10.5px] font-bold text-[var(--ink-3)]">↳ Carries into onboarding field:</span><Select value={fl.mapsTo ?? ""} onChange={(e) => patch(fl.id, { mapsTo: e.target.value || undefined })} className="max-w-[240px]"><option value="">— none —</option>{ONBOARD_TARGETS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select></div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--line)] p-3"><Input value={nl} onChange={(e) => setNl(e.target.value)} placeholder="New field label" className="min-w-[180px] flex-1" /><Button variant="primary" onClick={add}>Add field</Button></div>
          <p className="text-[11px] text-[var(--ink-3)]">Fields with a <b>↳ carries into onboarding</b> mapping (references, address, availability…) pre-fill the onboarding record when you accept the applicant — job titles come from Setup → Staff roles ({jobTitles.length}).</p>
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3"><Button className="ml-auto" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>Save form</Button></div>
      </div>
    </div>
  );
}
