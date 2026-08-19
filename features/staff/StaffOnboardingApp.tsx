"use client";

// Staff-facing onboarding submission — the other half of the operator's Onboarding
// tab (features/team/OnboardingApp). Reads the SAME field model + record store so
// what a staffer fills in here appears against them on the employer's checklist.
// Staff complete the details that are theirs to give (personal, right-to-work refs,
// emergency contacts, read-and-agree policies, uploads); employer-verified gates
// (DBS cleared, references satisfactory) stay read-only here. Sensitive items are
// stored locally in this demo; in production they go to secure storage (Amir).
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { DEFAULT_FIELDS, SECTIONS, fieldApplies, satisfied, type OnboardField, type OnboardValue, type OnboardRecord } from "@/features/team/OnboardingApp";
import { useCredentials, credStatus, CredBadge, appliesTo, seedRecords, blankRecord, openCredFile, DEFAULT_CRED_TYPES, CRED_TKEY, CRED_RKEY, fmtDate, type CredType, type CredRecord } from "@/features/learning/credentials";

const ME = "Marcus Bell";
const FKEY = "aos.team.onboardfields.v1";
const RKEY = "aos.team.onboardrecords.v1";
// The details the provider entered when they sent the invite. These pre-fill the
// matching fields and stay EDITABLE, so the new starter confirms or corrects them
// rather than typing from scratch. In production these come from the real invite
// record (backend); demo values here. Keyed to the fields flagged `fromInvite`.
const INVITE: Record<string, string> = { fullName: "Marcus Bell", email: "marcus.bell@gmail.com", jobTitle: "Lead Coach" };
// staff role used to resolve which qualifications the provider requires (demo)
const ME_ROLE = "Lead";
const CRED_SEED = [{ name: ME, dbs: "Valid", pfa: "Expiring" }];
// Are the qualifications the provider made compulsory FOR THIS ROLE all provided?
// Reads the same credential store as Setup (provider) + My certificates (staff).
function roleQualsCovered(): boolean {
  if (typeof window === "undefined") return true;
  let types: CredType[] = DEFAULT_CRED_TYPES;
  try { const t = JSON.parse(localStorage.getItem(CRED_TKEY) || "null"); if (Array.isArray(t)) types = t; } catch { /* ignore */ }
  // mirror useCredentials: fall back to the in-memory demo seed when nothing's saved
  let records: CredRecord[] = seedRecords(CRED_SEED);
  try { const r = JSON.parse(localStorage.getItem(CRED_RKEY) || "null"); if (Array.isArray(r)) records = r; } catch { /* ignore */ }
  const required = types.filter((t) => !t.dbs && t.required && appliesTo(t, ME, ME_ROLE)); // DBS handled in its own section
  if (!required.length) return true;
  const recFor = (id: string) => records.find((r) => r.staff === ME && r.typeId === id);
  return required.every((t) => ["Valid", "Expiring", "Pending"].includes(credStatus(recFor(t.id)))); // uploaded (verification is the manager's job)
}
// Types the staffer fills in themselves. Everything else (check/gate, pay, certs,
// jobtitle, availability, addresses) is shown read-only with a short note.
const STAFF_EDITABLE = new Set(["text", "tel", "email", "date", "textarea", "select", "checkbox", "readdoc", "file", "addresses", "certs"]);
// Fields the EMPLOYER sets — staff see them read-only even though the type is editable
const STAFF_READONLY = new Set(["hours"]);
const nowIso = () => { try { return new Date().toISOString(); } catch { return ""; } };

// Per-section identity — a vivid gradient + ink + soft tint each, so the form
// reads as a colourful, guided journey rather than a wall of grey boxes.
const SECTION_STYLE: Record<string, { grad: string; ink: string; soft: string }> = {
  personal: { grad: "linear-gradient(135deg,#1d3a8f,#3f7ae0)", ink: "#1d3a8f", soft: "#eef4fd" },
  rtw: { grad: "linear-gradient(135deg,#0e7d74,#22b4a6)", ink: "#0f766e", soft: "#e1f5ee" },
  dbs: { grad: "linear-gradient(135deg,#5b21b6,#a855f7)", ink: "#6d28d9", soft: "#f3effe" },
  dbscheck: { grad: "linear-gradient(135deg,#4338ca,#6366f1)", ink: "#4338ca", soft: "#eef0fe" },
  refs: { grad: "linear-gradient(135deg,#b45309,#f59e0b)", ink: "#b45309", soft: "#fdf3e0" },
  quals: { grad: "linear-gradient(135deg,#166534,#37b26a)", ink: "#0f7a43", soft: "#eaf8f0" },
  payroll: { grad: "linear-gradient(135deg,#9d174d,#f43f5e)", ink: "#be123c", soft: "#fdecec" },
  availability: { grad: "linear-gradient(135deg,#0369a1,#22d3ee)", ink: "#0369a1", soft: "#e0f5fb" },
  emergency: { grad: "linear-gradient(135deg,#b91c1c,#ef4444)", ink: "#c0392b", soft: "#fdeceb" },
  agreements: { grad: "linear-gradient(135deg,#334155,#64748b)", ink: "#475569", soft: "#eef1f6" },
};
const secStyle = (k: string) => SECTION_STYLE[k] ?? SECTION_STYLE.personal;
// Inputs sit on white section bodies, so give every box a light fill + crisp
// inset outline that clearly reads as "type here" (the default --line border is
// nearly invisible on white). Inline so it can't be lost to class-order issues;
// focus still paints the brand border on top.
const FIELD_STYLE = { backgroundColor: "#f5f3fb", boxShadow: "inset 0 0 0 1.5px #c5bfd6" } as const;

// ── 5-year address history ─────────────────────────────────────────────────
// UK safer-recruitment needs a continuous address history covering 5 years.
// Ask the current move-in date (the `movedIn` field); if it's under 5 years ago,
// force the staffer to add previous addresses (each with its own move-in date)
// until the chain reaches back 5 years.
interface Addr { line1: string; line2: string; town: string; postcode: string; from: string; to: string }
const parseAddr = (v?: string): Addr[] => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const blankAddr = (): Addr => ({ line1: "", line2: "", town: "", postcode: "", from: "", to: "" });
const isoYearsAgo = (n: number) => { const d = new Date(); return `${d.getFullYear() - n}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const validAddr = (a: Addr) => !!(a.line1 && a.town && a.postcode && a.from);
const historyCovered = (currentMovedIn?: string, entries: Addr[] = []) => {
  if (!currentMovedIn) return false;
  const cut = isoYearsAgo(5);
  if (currentMovedIn <= cut) return true; // current address alone covers 5 years
  const froms = entries.filter(validAddr).map((a) => a.from).sort();
  return froms.length > 0 && froms[0] <= cut;
};
const prettyDate = (iso: string) => { try { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch { return iso; } };

function AddressHistory({ value, onChange, currentMovedIn }: { value?: string; onChange: (json: string) => void; currentMovedIn?: string }) {
  const stored = parseAddr(value);
  const cut = isoYearsAgo(5);
  const needPrev = !!currentMovedIn && currentMovedIn > cut;
  const covered = historyCovered(currentMovedIn, stored);
  const list = needPrev && !covered && stored.length === 0 ? [blankAddr()] : stored; // always show a block to fill
  const write = (l: Addr[]) => onChange(JSON.stringify(l));
  const setField = (i: number, k: keyof Addr, val: string) => write(list.map((a, j) => (j === i ? { ...a, [k]: val } : a)));
  const add = () => write([...list, blankAddr()]);
  const remove = (i: number) => write(list.filter((_, j) => j !== i));

  if (!currentMovedIn) return <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-[12px] text-[var(--ink-3)]">Enter the date you moved into your current address (above) first.</div>;
  if (!needPrev) return <div className="flex items-center gap-2 rounded-xl border border-[#cfe8d7] bg-[#f4fbf6] p-3 text-[12.5px] font-semibold text-[#0f7a43]"><span>✓</span> Your current address covers the last 5 years — no previous address needed.</div>;

  return (
    <div className="space-y-2.5">
      <div className={"flex items-start gap-2 rounded-xl p-3 text-[12px] font-semibold " + (covered ? "bg-[#f4fbf6] text-[#0f7a43]" : "bg-[#fff4e5] text-[#9a3d00]")}>
        <span className="text-[14px]">{covered ? "✓" : "📍"}</span>
        <span>{covered ? "5-year address history complete." : <>Your history must reach back to <b>{prettyDate(cut)}</b>. Add each previous address, with the date you moved in, until it's covered.</>}</span>
      </div>
      {list.map((a, i) => (
        <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-3">
          <div className="mb-1.5 flex items-center"><span className="text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">Previous address {i + 1}</span><button type="button" onClick={() => remove(i)} className="ml-auto text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button></div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={a.line1} onChange={(e) => setField(i, "line1", e.target.value)} placeholder="Address line 1" className="col-span-2" style={FIELD_STYLE} />
            <Input value={a.line2} onChange={(e) => setField(i, "line2", e.target.value)} placeholder="Address line 2 (optional)" className="col-span-2" style={FIELD_STYLE} />
            <Input value={a.town} onChange={(e) => setField(i, "town", e.target.value)} placeholder="Town / city" style={FIELD_STYLE} />
            <Input value={a.postcode} onChange={(e) => setField(i, "postcode", e.target.value)} placeholder="Postcode" style={FIELD_STYLE} />
            <label className="col-span-2 block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">I moved into this address on</span><Input type="date" value={a.from} max={currentMovedIn} onChange={(e) => setField(i, "from", e.target.value)} className="w-full" style={FIELD_STYLE} /></label>
          </div>
        </div>
      ))}
      {covered
        ? <button type="button" onClick={add} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">+ Add another (optional)</button>
        : <button type="button" onClick={add} className="w-full rounded-xl border border-dashed border-[#1d3a8f] bg-[#f6f9ff] py-2 text-[12.5px] font-extrabold text-[#1d3a8f]">+ Add {list.length ? "an earlier" : "your previous"} address</button>}
    </div>
  );
}
// add N months to a yyyy-mm-dd, returning yyyy-mm-dd (for cert expiry from issue date)
const addMonthsIso = (iso: string, months: number): string | undefined => { const d = new Date(iso + "T00:00:00"); if (isNaN(+d)) return undefined; d.setMonth(d.getMonth() + months); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Qualifications required for the staffer's role — the provider sets which
// credential types are compulsory (Setup → Learning), assigned per role; this
// reads the SAME store as My certificates, so uploads sync across both.
function RoleQualifications({ onUploaded }: { onUploaded: () => void }) {
  const cred = useCredentials(CRED_SEED);
  const recFor = (id: string) => cred.recordFor(ME, id);
  const [added, setAdded] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  // DBS is captured in its own "DBS check" section — exclude it here to avoid duplication
  const required = cred.types.filter((t) => !t.dbs && t.required && appliesTo(t, ME, ME_ROLE));
  const reqIds = new Set(required.map((t) => t.id));
  // anything the person holds or has just added (incl. certs compulsory for OTHER roles)
  const optionalTypes = cred.types.filter((t) => !t.dbs && !reqIds.has(t.id) && (recFor(t.id) || added.includes(t.id)));
  const addable = cred.types.filter((t) => !t.dbs && !reqIds.has(t.id) && !recFor(t.id) && !added.includes(t.id));
  const validReq = required.filter((t) => ["Valid", "Pending", "Expiring"].includes(credStatus(recFor(t.id)))).length;
  const addOther = () => { const name = otherName.trim(); if (!name) return; const id = "ct" + name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) + optionalTypes.length; cred.upsertType({ id, name, required: false, renewMonths: 0, needsFile: true }); setAdded((a) => [...a, id]); setOtherName(""); setShowOther(false); onUploaded(); };

  const upload = (typeId: string, file: File) => {
    const r = new FileReader();
    r.onload = () => { const ex = recFor(typeId); cred.upsertRecord({ ...(ex ?? blankRecord(ME, typeId)), fileData: String(r.result), fileName: file.name, verified: "pending" }); onUploaded(); };
    r.readAsDataURL(file);
  };
  const setIssue = (typeId: string, date: string) => {
    const ex = recFor(typeId); const rm = cred.types.find((x) => x.id === typeId)?.renewMonths;
    const expiry = date && rm ? addMonthsIso(date, rm) : undefined;
    cred.upsertRecord({ ...(ex ?? blankRecord(ME, typeId)), issue: date || undefined, expiry });
    onUploaded();
  };
  const clear = (typeId: string) => { const ex = recFor(typeId); if (ex) cred.deleteRecord(ex.id); onUploaded(); };

  const row = (t: CredType, req: boolean) => {
    const r = recFor(t.id); const s = credStatus(r); const has = !!r?.fileData;
    return (
      <div key={t.id} className="rounded-xl border border-[var(--line)] bg-white p-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[13px] font-bold text-[var(--ink)]">{t.name}
            <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase" style={req ? { background: "#fdecec", color: "#c0392b" } : { background: "#eef1f6", color: "#64748b" }}>{req ? "Required" : "Optional"}</span>
          </span>
          <CredBadge s={s} />
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Issue date</span>
            <input type="date" value={r?.issue ?? ""} max={isoYearsAgo(0)} onChange={(e) => setIssue(t.id, e.target.value)} style={FIELD_STYLE} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
          </label>
          {r?.expiry && <span className="pb-1 text-[10.5px] font-semibold text-[var(--ink-3)]">Expires {fmtDate(r.expiry)}</span>}
          <div className="ml-auto flex items-center gap-2 pb-0.5">
            {has ? (<>
              <button type="button" onClick={() => openCredFile(r!.fileData)} className="max-w-[160px] truncate rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">📎 {r!.fileName || "View"}</button>
              <label className="cursor-pointer text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">Replace<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t.id, f); }} /></label>
              <button type="button" onClick={() => clear(t.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>
            </>) : (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#1d3a8f] bg-[#f6f9ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">📷 Upload my {t.name}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t.id, f); }} /></label>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {required.length === 0
        ? <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-[12px] text-[var(--ink-3)]">Your provider hasn't set any compulsory qualifications for your role.</div>
        : (<>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Required for your role — {validReq}/{required.length} in place</div>
            {required.map((t) => row(t, true))}
          </>)}
      {optionalTypes.length > 0 && (<>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Other qualifications you hold</div>
        {optionalTypes.map((t) => row(t, false))}
      </>)}
      <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Hold another qualification?</div>
        <Select value="" onChange={(e) => { const v = e.target.value; if (!v) return; if (v === "__other") setShowOther(true); else setAdded((a) => [...a, v]); }} className="w-full max-w-[320px]" style={FIELD_STYLE}>
          <option value="">Add a qualification…</option>
          {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="__other">Other (type the name)…</option>
        </Select>
        {showOther && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Qualification name" className="max-w-[240px]" style={FIELD_STYLE} />
            <Button variant="primary" onClick={addOther}>Add</Button>
            <button type="button" onClick={() => { setShowOther(false); setOtherName(""); }} className="text-[11.5px] font-bold text-[var(--ink-3)]">Cancel</button>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-[var(--ink-3)]">Choose from your provider's list — including qualifications required for other roles — or add your own. You'll be asked for the issue date and to upload it.</p>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-[#eef4ff] p-3 text-[12px] text-[#1d3a8f]">
        <span className="text-[14px]">ℹ️</span>
        <span>Don't have one of these yet, or can't get to it right now? No problem — just <b>move on and submit</b>. Your provider will see what's missing and get in touch to sort it out.</span>
      </div>
    </div>
  );
}
// operator-only DBS-application items — never shown on the staff form
const HIDE_FROM_STAFF = new Set(["overseas", "disqual", "disqualFile", "qualDocs", "interviewNotes"]); // replaced by the inline per-cert uploads / operator-only
// Sections not done in onboarding: availability is set AFTER the provider places them
// (they'll be emailed to complete it); policies are read in the Documents area.
const HIDE_SECTIONS = new Set(["availability", "agreements"]);
// DBS certificate detail fields — only shown/required when they say they HAVE one
const DBS_CERT_FIELDS = new Set(["dbsCert", "dbsIssue", "dbsFile", "dbsUpdate", "dbsUpdateNo"]);
const hasDbsYes = (values: Record<string, OnboardValue>) => (values.hasDbs?.v || "").startsWith("Yes");
// Every reference detail is compulsory.
const REF_REQUIRED = new Set(["ref1Name", "ref1Org", "ref1Rel", "ref1Phone", "ref1Email", "ref2Name", "ref2Org", "ref2Rel", "ref2Phone", "ref2Email"]);
// Fields the staff view forces beyond the shared model's `required` flag.
const staffRequired = (f: OnboardField, values: Record<string, OnboardValue>) => {
  if (f.required) return true;
  if (f.id === "addrHistory" || f.id === "rtwEvidence" || f.id === "addrProof" || f.id === "roleCerts") return true;
  if (["bankName", "bankHolder", "bankSort", "bankAccount"].includes(f.id)) return true; // needed to actually pay them
  if (REF_REQUIRED.has(f.id)) return true;
  if (hasDbsYes(values) && (f.id === "dbsCert" || f.id === "dbsIssue" || f.id === "dbsFile")) return true;
  const p45 = values.p45?.v || "";
  if (f.id === "p45File" && p45.startsWith("Yes")) return true;      // have a P45 → must upload it
  if (f.id === "taxStatement" && p45.startsWith("No")) return true;  // no P45 → must give employee statement
  // opting out of the pension → all three legal statements + signature + date are mandatory
  if (["pensionOptOut1", "pensionOptOut2", "pensionOptOut3", "pensionSign", "pensionSignDate"].includes(f.id) && (values.pension?.v || "").startsWith("Opt out")) return true;
  return false;
};
const staffSat = (f: OnboardField, values: Record<string, OnboardValue>) => {
  if (f.id === "addrHistory") return historyCovered(values.movedIn?.v, parseAddr(values.addrHistory?.v));
  if (f.id === "rtwEvidence") return !!(values.shareCode?.v && values.shareCode.v.trim()) || !!values.rtwEvidence?.fileData;
  if (f.id === "addrProof") return !!values.addrProof?.fileData; // DBS needs a separate proof of CURRENT ADDRESS
  if (f.id === "roleCerts") return roleQualsCovered(); // the provider's role-required qualifications
  return satisfied(f, values[f.id]);
};

export function StaffOnboardingApp() {
  const router = useRouter();
  const portal = (usePathname() || "/staff").split("/")[1] || "staff";
  const [fields, setFields] = useState<OnboardField[]>(DEFAULT_FIELDS);
  const [rec, setRec] = useState<OnboardRecord>({ staff: ME, values: {}, extra: [] });
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState<{ at: string; outstanding: string[] } | null>(null);
  const [, forceCred] = useState(0); // re-render after an inline cert upload so progress refreshes
  const [slide, setSlide] = useState(0); // onboarding runs as big one-section-per-slide steps

  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem(FKEY) || "null"); if (Array.isArray(f) && f.length) setFields(f); } catch { /* ignore */ }
    try {
      const all = JSON.parse(localStorage.getItem(RKEY) || "[]") as OnboardRecord[];
      const mine = Array.isArray(all) ? all.find((r) => r.staff === ME) : null;
      const values: Record<string, OnboardValue> = { ...(mine?.values || {}) };
      // pre-fill the invite/provider-entered details (editable) if not already set
      for (const [id, v] of Object.entries(INVITE)) if (values[id]?.v == null) values[id] = { v };
      // preserve submission state so returning staff see their filled-in, submitted form
      setRec({ staff: ME, values, extra: mine?.extra || [], submittedAt: mine?.submittedAt, outstanding: mine?.outstanding, lastEditedAt: mine?.lastEditedAt });
      setSaved(true);
    } catch { /* ignore */ }
  }, []);

  const set = (id: string, patch: Partial<OnboardValue>) => { setSaved(false); setSubmitted(null); setRec((r) => ({ ...r, values: { ...r.values, [id]: { ...r.values[id], ...patch, at: nowIso() } } })); };
  const writeRecord = (r: OnboardRecord) => {
    try {
      const all = JSON.parse(localStorage.getItem(RKEY) || "[]") as OnboardRecord[];
      const list = Array.isArray(all) ? all.filter((x) => x.staff !== ME) : [];
      list.push(r); localStorage.setItem(RKEY, JSON.stringify(list));
    } catch { /* ignore */ }
  };
  const persist = () => {
    // saving a change AFTER submission flags the provider that the record was updated
    const next = rec.submittedAt ? { ...rec, lastEditedAt: nowIso() } : rec;
    if (rec.submittedAt) setRec(next);
    writeRecord(next); setSaved(true);
  };

  const dbsYes = hasDbsYes(rec.values);
  // HMRC new-starter: P45 → upload it; no P45 → complete the starter checklist (employee statement + loans)
  const p45v = rec.values.p45?.v || "";
  const hasP45 = p45v.startsWith("Yes");
  const noP45 = p45v.startsWith("No");
  const slChecked = rec.values.studentLoan?.v === "yes";
  const pensionOptOut = (rec.values.pension?.v || "").startsWith("Opt out");
  const PENSION_OPTOUT_FIELDS = ["pensionOptOut1", "pensionOptOut2", "pensionOptOut3", "pensionSign", "pensionSignDate"];
  const myFields = useMemo(() => fields
    .filter((f) => fieldApplies(f, ME, undefined, rec.extra))
    .filter((f) => !HIDE_SECTIONS.has(f.section))                     // availability + policies are post-onboarding
    .filter((f) => !HIDE_FROM_STAFF.has(f.id))                        // operator-only compliance items
    .filter((f) => !(DBS_CERT_FIELDS.has(f.id) && !dbsYes))          // DBS cert detail only when they have one
    .filter((f) => !(f.id === "p45File" && !hasP45))                 // P45 upload only if they have a P45
    .filter((f) => !(["taxStatement", "studentLoan", "studentLoanPlan", "postgradLoan"].includes(f.id) && !noP45)) // starter checklist only if NO P45
    .filter((f) => !(f.id === "studentLoanPlan" && !slChecked))      // loan plan only once they say they have a loan
    .filter((f) => !(PENSION_OPTOUT_FIELDS.includes(f.id) && !pensionOptOut)), // opt-out statements only if opting out
    [fields, rec.extra, dbsYes, hasP45, noP45, slChecked, pensionOptOut]);
  const bySection = (s: string) => myFields.filter((f) => f.section === s);
  // progress = required, staff-editable fields the person has completed
  const mineToDo = myFields.filter((f) => staffRequired(f, rec.values) && STAFF_EDITABLE.has(f.type));
  const doneCount = mineToDo.filter((f) => staffSat(f, rec.values)).length;
  const pct = mineToDo.length ? Math.round((doneCount / mineToDo.length) * 100) : 100;
  // compulsory items still outstanding — the staffer can submit anyway; these get flagged to the employer
  const niceLabel = (f: OnboardField) => f.id === "roleCerts" ? "Required qualifications for your role" : f.id === "addrHistory" ? "5-year address history" : f.id === "rtwEvidence" ? "Right-to-work evidence" : f.id === "addrProof" ? "Proof of current address" : f.id === "photo" ? "Profile photo" : f.label;
  const outstandingFields = mineToDo.filter((f) => !staffSat(f, rec.values));
  const outstanding = outstandingFields.map(niceLabel);                     // everything not done (for the employer flag)
  const blocking = outstandingFields.filter((f) => f.id !== "roleCerts");   // must be done to submit — certificates may follow later
  const canSubmit = blocking.length === 0;
  const submit = () => {
    if (!canSubmit) return;
    const next: OnboardRecord = { ...rec, submittedAt: nowIso(), outstanding };
    setRec(next); writeRecord(next); setSaved(true); setSubmitted({ at: next.submittedAt!, outstanding });
    try { window.scrollTo({ top: document.body.scrollHeight }); } catch { /* ignore */ }
  };

  const onFile = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = () => set(id, { fileData: String(r.result), fileName: file.name }); r.readAsDataURL(file);
  };

  // ── Slide wizard: one section per big slide, then a final review/submit step ──
  const visSections = useMemo(() => SECTIONS.filter(([key]) => myFields.some((f) => f.section === key)), [myFields]);
  const stepCount = visSections.length; // section slides; the submit step is index === stepCount
  const step = Math.min(slide, stepCount);
  const secStatus = (key: string) => {
    const fs = bySection(key);
    const req = fs.filter((f) => staffRequired(f, rec.values) && STAFF_EDITABLE.has(f.type));
    const ok = req.filter((f) => staffSat(f, rec.values)).length;
    return { fs, reqN: req.length, ok, complete: req.length > 0 && ok === req.length };
  };
  const goto = (n: number) => { setSlide(Math.max(0, Math.min(stepCount, n))); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } };

  // one field's control — extracted so grouped layouts (e.g. references) can reuse it
  const renderField = (f: OnboardField, labelText?: string) => {
    const v = rec.values[f.id]; const editable = STAFF_EDITABLE.has(f.type) && !STAFF_READONLY.has(f.id);
    const done = satisfied(f, v); const lbl = labelText ?? f.label;
    const labelEl = <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--ink-2)]">{lbl}{staffRequired(f, rec.values) && <span className="text-[14px] font-black leading-none text-[#e11d48]">*</span>}{f.sensitive && <span className="rounded bg-[var(--panel)] px-1 py-0.5 text-[9px] font-bold normal-case text-[var(--ink-3)]">🔒 private</span>}{f.fromInvite && <span className="rounded bg-[#eaf1ff] px-1 py-0.5 text-[9px] font-bold normal-case text-[#1d54c4]">from invite</span>}</span>;
    const wide = f.type === "textarea" || f.type === "readdoc" || f.type === "addresses" || f.type === "availability" || f.type === "certs" || (f.type === "select" && (f.options ?? []).some((o) => o.length > 60));
    return (
      <div key={f.id} className={wide ? "sm:col-span-2" : ""}>
        {f.type === "certs" ? (
          <div>{labelEl}<RoleQualifications onUploaded={() => { setSubmitted(null); forceCred((n) => n + 1); }} /></div>
        ) : f.type === "addresses" ? (
          <div>{labelEl}<AddressHistory value={v?.v} onChange={(json) => set(f.id, { v: json })} currentMovedIn={rec.values.movedIn?.v} /></div>
        ) : f.type === "readdoc" ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none" checked={v?.v === "yes"} onChange={(e) => set(f.id, { v: e.target.checked ? "yes" : "" })} />
            <span className="text-[12.5px] text-[var(--ink-2)]">I confirm I have read and understood the <b>{f.label}</b>.</span>
          </label>
        ) : f.type === "checkbox" ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white p-3">
            <input type="checkbox" className="h-4 w-4 flex-none" checked={v?.v === "yes"} onChange={(e) => set(f.id, { v: e.target.checked ? "yes" : "" })} />
            <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">{lbl}</span>
          </label>
        ) : f.type === "file" ? (
          <div>{labelEl}
            {f.id === "photo" && v?.fileData ? (
              <div className="flex items-center gap-3">
                <img src={v.fileData} alt="Profile" className="h-16 w-16 flex-none rounded-full border border-[var(--line)] object-cover" />
                <label className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">Change photo<input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(f.id, e)} /></label>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-center text-[12px] font-bold text-[#1d3a8f]">
                {v?.fileName ? `📎 ${v.fileName}` : (f.id === "photo" ? "📷 Upload a professional photo" : "📷 Upload")}<input type="file" accept={f.id === "photo" ? "image/*" : "image/*,application/pdf"} className="hidden" onChange={(e) => onFile(f.id, e)} />
              </label>
            )}
          </div>
        ) : f.type === "select" ? (
          <div>{labelEl}<Select value={v?.v ?? ""} onChange={(e) => set(f.id, { v: e.target.value })} className="w-full" style={FIELD_STYLE}><option value="">— choose —</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}{f.other && <option value={v?.v && !(f.options ?? []).includes(v.v) ? v.v : "Other"}>Other…</option>}</Select>
            {v?.v && (f.options ?? []).includes(v.v) && v.v.length > 48 && (() => { const m = v.v.match(/^(\S+)\s+—\s+([\s\S]+)/); return <div className="mt-1.5 rounded-lg bg-[var(--panel)] px-2.5 py-2 text-[11.5px] leading-snug text-[var(--ink-2)]">{m ? <><span className="mr-1 inline-block rounded bg-[#1d3a8f] px-1.5 py-0.5 text-[10px] font-extrabold text-white">{m[1]}</span>{m[2]}</> : v.v}</div>; })()}
          </div>
        ) : f.type === "textarea" ? (
          <div>{labelEl}<textarea value={v?.v ?? ""} onChange={(e) => set(f.id, { v: e.target.value })} rows={3} style={FIELD_STYLE} className="w-full rounded-xl border border-[var(--line)] p-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" /></div>
        ) : editable ? (
          <div>{labelEl}<Input type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} value={v?.v ?? ""} onChange={(e) => set(f.id, { v: e.target.value })} className="w-full" style={FIELD_STYLE} placeholder={f.hint} /></div>
        ) : (
          <div>{labelEl}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12px]">
              {(f.type === "jobtitle" || STAFF_READONLY.has(f.id)) && v?.v ? (
                <><span className="inline-block h-2 w-2 flex-none rounded-full bg-[#0f7a43]" /><span className="font-bold text-[var(--ink)]">{v.v}</span><span className="text-[var(--ink-3)]">· set by your employer</span></>
              ) : (
                <><span className={"inline-block h-2 w-2 flex-none rounded-full " + (done ? "bg-[#0f7a43]" : "bg-[#cbd5e1]")} /><span className="text-[var(--ink-3)]">{done ? "Completed by your employer" : "Your employer will complete this"}</span></>
              )}
            </div></div>
        )}
        {f.hint && editable && <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">{f.hint}</p>}
      </div>
    );
  };
  // references grouped into two clear cards (Ref 1 / Ref 2) with short labels
  const REF_GROUPS: [string, string[]][] = [["Reference 1", ["ref1Name", "ref1Org", "ref1Rel", "ref1Phone", "ref1Email"]], ["Reference 2", ["ref2Name", "ref2Org", "ref2Rel", "ref2Phone", "ref2Email"]]];
  const refIds = new Set(REF_GROUPS.flatMap(([, ids]) => ids));
  const shortLabel = (l: string) => { const s = l.replace(/^Reference \d+\s*—\s*/i, ""); return /^name$/i.test(s) ? "Referee (name)" : s; };
  const renderRefs = (fs: OnboardField[], st: { ink: string }) => {
    const rest = fs.filter((f) => !refIds.has(f.id));
    return (
      <div className="space-y-3 p-4">
        {REF_GROUPS.map(([title, ids]) => {
          const gfields = ids.map((id) => fs.find((f) => f.id === id)).filter(Boolean) as OnboardField[];
          if (!gfields.length) return null;
          return (
            <div key={title} className="rounded-xl border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold" style={{ color: st.ink }}><span>👤</span>{title}</div>
              <div className="grid gap-3 sm:grid-cols-2">{gfields.map((f) => renderField(f, shortLabel(f.label)))}</div>
            </div>
          );
        })}
        {rest.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{rest.map((f) => renderField(f))}</div>}
      </div>
    );
  };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My onboarding" icon="🪪" lede="Complete your joining details so we can get you cleared to start. Save as you go — you don't have to do it all at once." actions={<Button variant="primary" onClick={persist}>{saved ? "Saved ✓" : "Save"}</Button>} />

      {INVITE.jobTitle && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] shadow-sm">
          <span className="text-[14px]">🎽</span>You're joining as <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-extrabold text-[#1d3a8f]">{INVITE.jobTitle}</span><span className="font-semibold text-[var(--ink-3)]">— the qualifications below are set for this role</span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
        <div className="relative grid h-16 w-16 flex-none place-items-center rounded-full" style={{ background: `conic-gradient(#1d3a8f ${pct * 3.6}deg, #e8eefb 0)` }}>
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white text-[15px] font-extrabold text-[#1d3a8f] tabular-nums">{pct}%</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-extrabold text-[var(--ink)]">{pct === 100 ? "All done — nice one! 🎉" : `You're ${pct}% of the way there 🎯`}</div>
          <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{doneCount} of {mineToDo.length} of your details done — ID, DBS &amp; references are checked by your employer.</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1f6]"><div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: "linear-gradient(90deg,#1d3a8f,#3f7ae0)" }} /></div>
        </div>
      </div>

      {/* Stepper — wraps so every step is visible, no horizontal scroll */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {visSections.map(([key, label], i) => {
          const s = secStatus(key); const active = i === step; const stl = secStyle(key);
          return (
            <button key={key} type="button" onClick={() => goto(i)} style={active ? { background: stl.grad } : undefined} className={"flex flex-none items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[11.5px] font-extrabold transition-colors " + (active ? "text-white shadow-sm" : "border border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--panel)]")}>
              <span className={"grid h-5 w-5 flex-none place-items-center rounded-full text-[10.5px] tabular-nums " + (active ? "bg-white/25 text-white" : s.complete ? "bg-[#0f7a43] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>{s.complete ? "✓" : i + 1}</span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => goto(stepCount)} className={"flex flex-none items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[11.5px] font-extrabold " + (step === stepCount ? "bg-[#0f7a43] text-white shadow-sm" : "border border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--panel)]")}>
          <span className={"grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] " + (step === stepCount ? "bg-white/25 text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>✓</span><span className="whitespace-nowrap">Review &amp; submit</span>
        </button>
      </div>

      {step < stepCount && (() => {
        const [key, label, icon] = visSections[step];
        const fs = bySection(key); const st = secStyle(key); const { reqN, ok, complete } = secStatus(key);
        const last = step === stepCount - 1;
        return (
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
            <div className="flex items-center gap-3.5 border-b border-[var(--line)] px-5 py-4" style={{ background: st.soft }}>
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl text-[22px] shadow-sm" style={{ background: st.grad }}>{icon}</span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: st.ink, opacity: 0.7 }}>Step {step + 1} of {stepCount}</div>
                <div className="text-[18px] font-extrabold leading-tight" style={{ color: st.ink }}>{label}</div>
              </div>
              {reqN > 0 && <span className="ml-auto flex-none rounded-full px-2.5 py-1 text-[10.5px] font-extrabold" style={complete ? { background: "#0f7a43", color: "#fff" } : { background: "#fff", color: st.ink, boxShadow: "inset 0 0 0 1px " + st.ink + "33" }}>{complete ? "✓ Complete" : `${ok}/${reqN} done`}</span>}
            </div>
            {key === "refs"
              ? renderRefs(fs, st)
              : <div className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2">{fs.map((f) => renderField(f))}</div>}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
              <button type="button" onClick={() => goto(step - 1)} disabled={step === 0} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-40">‹ Back</button>
              <button type="button" onClick={persist} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{saved ? "Saved ✓" : "Save progress"}</button>
              <button type="button" onClick={() => goto(step + 1)} className="rounded-full bg-[#1d3a8f] px-5 py-2 text-[13px] font-extrabold text-white hover:brightness-110">{last ? "Review & submit ›" : "Next ›"}</button>
            </div>
          </div>
        );
      })()}

      {step === stepCount && (<>{submitted ? (
        <div className="space-y-3 rounded-2xl border border-[#cfe8d7] bg-[#f4fbf6] p-4">
          <div className="text-[15px] font-extrabold text-[#0f7a43]">✓ Submitted to your employer</div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="text-[13px] font-extrabold text-[var(--ink)]">📄 Now: read your documents</div>
            <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">There are policies and documents you need to read and confirm — please do these now.</p>
            <button type="button" onClick={() => router.push(`/${portal}/documents`)} className="mt-2 rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-extrabold text-white hover:brightness-110">Go to my documents →</button>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">
            <b>📅 Availability</b> — once we've placed you into a setting, you'll get an <b>email</b> asking you to set your weekly availability. Keep an eye on your inbox and complete it soon in the <b>My availability</b> section.
          </div>
          {submitted.outstanding.length > 0 && (
            <div className="rounded-xl bg-[#fff4e5] p-3 text-[12px] text-[#9a3d00]">Still outstanding: <b>{submitted.outstanding.join(", ")}</b>. Your provider can see these and will be in touch — you can add them any time.</div>
          )}
          <button type="button" onClick={() => setSubmitted(null)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Keep editing</button>
        </div>
      ) : rec.submittedAt ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <div className="text-[14px] font-extrabold text-[#0f7a43]">✓ Submitted {new Date(rec.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{rec.lastEditedAt ? ` · last updated ${new Date(rec.lastEditedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</div>
          <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">You can change your details any time. When you save a change, your employer is notified so they can review it.</p>
          {!saved && <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#fff4e5] p-3 text-[12px] text-[#9a3d00]"><span>✏️</span><span>You've changed your details — <b>Save</b> to send the update to your employer.</span></div>}
          <div className="mt-3 flex justify-end"><Button variant="primary" onClick={persist}>{saved ? "Saved &amp; notified ✓" : "Save changes"}</Button></div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">Ready to submit?</div>
          {canSubmit ? (
            <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">Everything compulsory is done{outstanding.length ? " — your certificates can follow later" : ""}. Submit to send it to your employer.</p>
          ) : (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#fdecec] p-3 text-[12px] text-[#a12b2b]">
              <span className="text-[14px]">⛔</span>
              <span>Please complete these compulsory items before you can submit: <b>{blocking.map(niceLabel).join(", ")}</b>.</span>
            </div>
          )}
          {canSubmit && outstanding.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#fff4e5] p-3 text-[12px] text-[#9a3d00]"><span>ℹ️</span><span>Your certificates aren't all uploaded — that's fine, you can submit now and add them later; your provider will chase them.</span></div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={persist}>{saved ? "Saved ✓" : "Save progress"}</Button>
            <Button variant="primary" onClick={submit} disabled={!canSubmit}>Submit to employer</Button>
          </div>
        </div>
      )}
      <div className="mt-3"><button type="button" onClick={() => goto(stepCount - 1)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">‹ Back to your details</button></div>
      </>)}
    </div>
  );
}
