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
import { useRouter, usePathname } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { DEMO_STAFF, useCredentials, credStatus, CredBadge, appliesTo as credAppliesTo, openCredFile } from "@/features/learning/credentials";
import { Tile, GRAD } from "@/features/money/finance-kit";
import { useT } from "@/lib/i18n/provider";

// ——— model ———
type FieldType = "text" | "tel" | "email" | "date" | "textarea" | "select" | "file" | "checkbox" | "check" | "addresses" | "certs" | "jobtitle" | "pay" | "readdoc" | "availability";
export interface OnboardField {
  id: string; section: string; label: string; type: FieldType; required: boolean;
  applyKind: "all" | "roles" | "staff"; applyRoles?: string[]; applyStaff?: string[];
  options?: string[]; hint?: string; gate?: boolean; sensitive?: boolean; custom?: boolean;
  other?: boolean;       // select allows a free-text "Other"
  fromInvite?: boolean;  // pre-filled when the sign-up link was sent; staff can't edit, the company can
  declaration?: boolean; // a document the person signs — offers a "see example" the company can view/print
}

const NATIONALITIES = ["British", "Irish", "Polish", "Romanian", "Indian", "Pakistani", "Bangladeshi", "Nigerian", "Ghanaian", "Kenyan", "South African", "Portuguese", "Spanish", "Italian", "French", "German", "Lithuanian", "Latvian", "Bulgarian", "Filipino", "American", "Canadian", "Australian", "Other"];

// Standard childcare disqualification self-declaration wording (authored for
// ActivityOS; aligns with the Childcare (Disqualification) Regulations / EYFS).
export const DISQUAL_DECLARATION = `DISQUALIFICATION SELF-DECLARATION

I confirm that, to the best of my knowledge, I am not disqualified from working with children under the Childcare (Disqualification) and Childcare (Early Years Provision Free of Charge) (Extended Entitlement) Regulations 2018 or any related legislation.

I declare that:
1. I have not been cautioned for, or convicted of, any offence against a child, or any violent or sexual offence against an adult.
2. I am not, and have never been, included on the DBS children's barred list.
3. I have not had an order or determination made against me that would disqualify me (including having care of a child removed, or an Ofsted registration cancelled/refused).
4. I am not subject to any prohibition, direction, sanction or restriction that prevents me from working with children.
5. I understand my duty to inform my employer immediately if any of the above changes at any time during my employment.

I understand that providing false information may lead to withdrawal of any offer of employment or to dismissal, and may be a criminal offence.

Signed: ______________________________   Print name: ______________________________   Date: ____________`;
export interface OnboardValue { v?: string; fileData?: string; fileName?: string; status?: "todo" | "requested" | "received" | "verified"; at?: string }
const nowIso = () => { try { return new Date().toISOString(); } catch { return ""; } };
const fmtStamp = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
// DBS certs don't legally "expire", but employers re-check on their own cycle
// (commonly ~3 years). Show how old a certificate is from its issue date.
const monthsSince = (iso?: string) => { if (!iso) return null; const d = new Date(iso + "T00:00:00"); if (isNaN(+d)) return null; const n = new Date(); return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()) - (n.getDate() < d.getDate() ? 1 : 0); };
const dbsAgeLabel = (iso?: string) => { const m = monthsSince(iso); if (m == null || m < 0) return ""; const y = Math.floor(m / 12), mo = m % 12; const age = y ? `${y} year${y > 1 ? "s" : ""}${mo ? ` ${mo} month${mo > 1 ? "s" : ""}` : ""}` : `${mo} month${mo !== 1 ? "s" : ""}`; return `Issued ${age} ago${m >= 36 ? " — over 3 years old, consider re-checking" : ""}`; };
const dbsAgeColor = (iso?: string) => { const m = monthsSince(iso); return m != null && m >= 36 ? "#b45309" : "#0f7a43"; };
// pay value = { basis, amount, hpw, auto }
interface PayVal { basis: "hour" | "day" | "year"; amount: string; hpw: string; auto: boolean }
const parsePay = (v?: string): PayVal => { try { const p = JSON.parse(v || "{}"); return { basis: p.basis || "hour", amount: p.amount || "", hpw: p.hpw || "", auto: p.auto !== false }; } catch { return { basis: "hour", amount: "", hpw: "", auto: true }; } };
const payDerived = (p: PayVal) => { const a = parseFloat(p.amount) || 0; const h = parseFloat(p.hpw) || 0; const annual = p.basis === "year" ? a : p.basis === "hour" ? a * h * 52 : a * 260 /* ~working days/yr */; const hourly = p.basis === "hour" ? a : h ? annual / (h * 52) : 0; return { hourly, annual, monthly: annual / 12 }; };
const gbp = (n: number) => n ? "£" + n.toLocaleString("en-GB", { maximumFractionDigits: n < 100 ? 2 : 0 }) : "£0";
export interface OnboardRecord { staff: string; values: Record<string, OnboardValue>; extra: string[]; submittedAt?: string; outstanding?: string[]; lastEditedAt?: string }

export const SECTIONS: [string, string, string][] = [
  ["personal", "Personal & contact", "👤"],
  ["rtw", "Right to work", "🛂"],
  ["dbs", "Identity", "🪪"],
  ["dbscheck", "DBS check", "🔎"],
  ["refs", "References & history", "📋"],
  ["quals", "Qualifications & training", "🎓"],
  ["payroll", "Payroll & HMRC", "💷"],
  ["emergency", "Emergency & health", "🚑"],
  ["availability", "Availability", "📅"],
  ["agreements", "Agreements & policies", "✍️"],
];
// rich per-section colour for the slideshow header
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

const F = (id: string, section: string, label: string, type: FieldType, required = false, x: Partial<OnboardField> = {}): OnboardField => ({ id, section, label, type, required, applyKind: "all", ...x });

export const DEFAULT_FIELDS: OnboardField[] = [
  F("photo", "personal", "Profile photo", "file", true, { hint: "A clear, professional head-and-shoulders photo — parents will see this, so keep it smart (no casual or joke pictures)." }),
  F("fullName", "personal", "Full legal name", "text", true, { fromInvite: true }),
  F("prevNames", "personal", "Previous / known-as names", "text"),
  F("dob", "personal", "Date of birth", "date", true),
  F("ni", "personal", "National Insurance number", "text", true),
  F("address1", "personal", "Address line 1", "text", true),
  F("address2", "personal", "Address line 2", "text"),
  F("town", "personal", "Town / city", "text", true),
  F("postcode", "personal", "Postcode", "text", true),
  F("movedIn", "personal", "I moved into this address on", "date", true, { hint: "If that's less than 5 years ago, add your previous addresses below." }),
  F("addrHistory", "personal", "Previous addresses (to cover 5 years)", "addresses", false, { hint: "Add each previous address with the date you moved in, until your history goes back 5 years." }),
  F("phone", "personal", "Mobile number", "tel", true),
  F("email", "personal", "Personal email", "email", true, { fromInvite: true }),

  F("nationality", "rtw", "Nationality", "select", true, { options: NATIONALITIES, other: true }),
  F("rtwMethod", "rtw", "Right-to-work method", "select", true, { options: ["Share code (eVisa)", "Passport (British/Irish)", "Birth certificate + NI", "Other"] }),
  F("shareCode", "rtw", "Share code (9-char)", "text", false, { hint: "From gov.uk — valid 90 days" }),
  F("rtwEvidence", "rtw", "Right-to-work evidence (upload)", "file", false, { hint: "Upload your document — or enter your share code on the left. One is required." }),
  F("rtwCheck", "rtw", "Right to work verified", "check", true, { gate: true }),

  F("idMethod", "dbs", "ID method", "select", true, { options: ["Passport", "Driving licence (photocard)", "Birth certificate + proof of address", "BRP / eVisa", "National ID card"], other: true }),
  F("idFile", "dbs", "ID document (upload)", "file", true),
  F("addrProofType", "dbs", "Proof of current address — document type", "select", false, { options: ["Utility bill (last 3 months)", "Bank or building society statement (last 3 months)", "Council tax bill (current year)", "Driving licence (if not used as ID above)", "Tenancy agreement (current)", "Mortgage statement (last 12 months)", "HMRC / DWP / benefits letter (last 3 months)", "Other"], hint: "Must show your name + current address. A passport can't be used here — it doesn't show your address." }),
  F("addrProof", "dbs", "Proof of address (upload)", "file", false, { hint: "A different document to your photo ID, dated within the last 3 months where relevant." }),
  F("idCheck", "dbs", "Identity verified", "check", true),
  // ── DBS check — its own section. This just records an EXISTING certificate;
  // applying for a NEW DBS is done through the umbrella-body / DBS system, not here.
  F("hasDbs", "dbscheck", "Do you have an enhanced DBS certificate?", "select", true, { options: ["Yes — I have one", "No — the company will arrange it"] }),
  F("dbsCert", "dbscheck", "DBS certificate number", "text"),
  F("dbsIssue", "dbscheck", "DBS issue date", "date", false, { hint: "The company sets how long a certificate stays valid, counted from this date." }),
  F("dbsFile", "dbscheck", "DBS certificate (upload)", "file", false, { hint: "Upload a photo or scan of your certificate." }),
  F("dbsUpdate", "dbscheck", "Registered with the DBS Update Service", "checkbox"),
  F("dbsUpdateNo", "dbscheck", "Update Service number", "text"),
  F("dbsCheck", "dbscheck", "DBS seen & cleared", "check", true, { gate: true }),
  // operator-only compliance items (hidden from the staff form)
  F("overseas", "dbscheck", "Overseas check (if 3+ months abroad)", "select", false, { options: ["Not needed", "Requested", "Received"] }),
  F("disqual", "dbscheck", "Disqualification self-declaration signed", "checkbox", false, { declaration: true, hint: "See the example to print & have them sign" }),
  F("disqualFile", "dbscheck", "Signed declaration (upload)", "file"),

  F("ref1Name", "refs", "Reference 1 — name", "text", true),
  F("ref1Org", "refs", "Reference 1 — organisation", "text"),
  F("ref1Rel", "refs", "Reference 1 — relationship", "text"),
  F("ref1Phone", "refs", "Reference 1 — phone", "tel"),
  F("ref1Email", "refs", "Reference 1 — email", "email"),
  F("ref2Name", "refs", "Reference 2 — name", "text", true),
  F("ref2Org", "refs", "Reference 2 — organisation", "text"),
  F("ref2Rel", "refs", "Reference 2 — relationship", "text"),
  F("ref2Phone", "refs", "Reference 2 — phone", "tel"),
  F("ref2Email", "refs", "Reference 2 — email", "email"),
  F("employHistory", "refs", "Employment history + gaps explained", "textarea"),
  F("refsCheck", "refs", "References received & satisfactory", "check", true, { gate: true }),

  F("roleCerts", "quals", "Certificates required for this role", "certs", false),
  F("qualifications", "quals", "Other qualifications held", "textarea"),
  F("qualDocs", "quals", "Certificate uploads", "file"),
  F("interviewNotes", "quals", "Safer-recruitment interview notes", "textarea"),

  F("p45", "payroll", "Do you have a P45 from a job this tax year?", "select", true, { options: ["Yes — I have a P45", "No — I'll complete the starter checklist below"] }),
  F("p45File", "payroll", "P45 (upload)", "file", false, { hint: "Upload the P45 from your previous employer — parts 2 and 3." }),
  // HMRC starter checklist — asked as the actual questions and answered here,
  // rather than uploaded as a separate form. Sets the tax code until HMRC updates it.
  F("taxStatement", "payroll", "Employee statement — which one applies to you?", "select", false, { options: [
    "A — This is my first job since 6 April and I've not been getting taxable Jobseeker's Allowance, Employment & Support Allowance, taxable Incapacity Benefit, or a State / Occupational Pension",
    "B — This is now my only job, but since 6 April I've had another job or received taxable benefits (JSA / ESA / Incapacity Benefit). I don't get a State / Occupational Pension",
    "C — I have another job or receive a State or Occupational Pension",
  ], hint: "Pick the statement that's true for you — it sets your tax code for now." }),
  F("studentLoan", "payroll", "I'm repaying a student loan", "checkbox"),
  F("studentLoanPlan", "payroll", "Student loan plan type", "select", false, { options: ["Plan 1", "Plan 2", "Plan 4 (Scotland)", "Not sure"], hint: "It's on your loan statements, or check gov.uk if you're unsure." }),
  F("postgradLoan", "payroll", "I'm also repaying a postgraduate loan", "checkbox"),
  F("bankName", "payroll", "Name of bank / building society", "text", false, { sensitive: true, hint: "So we can pay your wages." }),
  F("bankHolder", "payroll", "Name on the account", "text", false, { sensitive: true, hint: "Exactly as it appears on your card / statement." }),
  F("bankSort", "payroll", "Sort code", "text", false, { sensitive: true, hint: "6 digits, e.g. 12-34-56." }),
  F("bankAccount", "payroll", "Account number", "text", false, { sensitive: true, hint: "8 digits." }),
  F("pension", "payroll", "Workplace pension", "select", true, { options: ["Stay in — auto-enrol me (recommended)", "Opt out of the pension"], hint: "By law you're automatically enrolled. To formally opt out you normally do so through the pension provider within the opt-out window — this records your wish and the required acknowledgements." }),
  // shown only if they choose to opt out — the mandatory auto-enrolment opt-out statements
  F("pensionOptOut1", "payroll", "I wish to opt out of the pension scheme.", "checkbox", false, { declaration: true }),
  F("pensionOptOut2", "payroll", "I understand that if I opt out I will lose the right to pension contributions from my employer.", "checkbox", false, { declaration: true }),
  F("pensionOptOut3", "payroll", "I understand that if I opt out I may have a lower income when I retire.", "checkbox", false, { declaration: true }),
  F("pensionSign", "payroll", "Signature (type your full name)", "text", false, { hint: "Typing your name here counts as your electronic signature." }),
  F("pensionSignDate", "payroll", "Date signed", "date"),
  F("jobTitle", "payroll", "Job title", "jobtitle", false, { fromInvite: true }),
  F("startDate", "payroll", "Start date", "date", true),
  F("hours", "payroll", "Contracted hours", "text"),
  F("payRate", "payroll", "Pay rate", "pay", false, { sensitive: true }),

  F("availability", "availability", "Weekly availability", "availability", false, { hint: "The days & times you can work — this feeds the Schedule / rota." }),

  F("emergName", "emergency", "Emergency contact name", "text", true),
  F("emergPhone", "emergency", "Emergency contact phone", "tel", true),
  F("emergRel", "emergency", "Relationship", "text"),
  F("medical", "emergency", "I confirm I've told my employer about any medical conditions, allergies or reasonable adjustments they should be aware of — including anything relevant in an emergency.", "checkbox", true, { declaration: true }),

  F("contract", "agreements", "Employment contract", "readdoc", true),
  F("handbook", "agreements", "Staff handbook", "readdoc"),
  F("safeguardingPolicy", "agreements", "Safeguarding & Child Protection policy", "readdoc", true),
  F("codeOfConduct", "agreements", "Code of conduct", "readdoc"),
  F("dataPrivacy", "agreements", "Privacy notice", "readdoc"),
  F("kcsie", "agreements", "KCSIE Part 1", "readdoc"),
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
  if (f.type === "certs") return true; // informational — pulled from the certificates area
  if (!val) return false;
  if (f.type === "checkbox" || f.type === "readdoc") return val.v === "yes";
  if (f.type === "check") return val.status === "verified";
  if (f.type === "file") return !!val.fileData;
  if (f.type === "pay") return !!parsePay(val.v).amount;
  if (f.type === "availability") return Object.values(parseAvail(val.v)).some((a) => a.length > 0);
  if (f.type === "addresses") { try { return (JSON.parse(val.v || "[]") as unknown[]).length > 0; } catch { return false; } }
  return !!(val.v && val.v.trim());
}
// parsed address-history entries
interface AddrEntry { line1: string; line2: string; town: string; postcode: string; from: string; to: string }
const parseAddrs = (v?: string): AddrEntry[] => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
// weekly availability { Mon: ["AM","PM"], … } — feeds the Schedule / rota
const AVAIL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AVAIL_SLOTS = ["AM", "PM", "Eve"];
const AVAIL_KEY = "aos.staff.availability.v1";
const parseAvail = (v?: string): Record<string, string[]> => { try { const a = JSON.parse(v || "{}"); return a && typeof a === "object" ? a : {}; } catch { return {}; } };

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
const CHECK_LABEL: Record<string, string> = { todo: "To do", requested: "Requested", received: "Received", verified: "Verified" };

const esc = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const printWindow = (html: string) => { if (typeof window === "undefined") return; const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } };
const displayVal = (f: OnboardField, val?: OnboardValue): string => {
  if (f.type === "certs") return ""; // shown in its own area, not the pack table
  if (!val) return "";
  if (f.type === "check") return CHECK_LABEL[val.status ?? "todo"] + (val.at ? " · " + fmtStamp(val.at) : "");
  if (f.type === "checkbox") return val.v === "yes" ? "Yes" : "";
  if (f.type === "readdoc") return (val.v === "yes" ? "Read & confirmed" : "Not read yet") + (val.fileName ? " · 📎 " + val.fileName : "");
  if (f.type === "pay") { const p = parsePay(val.v); if (!p.amount) return ""; const d = payDerived(p); return `${gbp(parseFloat(p.amount))} ${p.basis === "year" ? "/year" : p.basis === "day" ? "/day" : "/hour"}${p.auto ? ` (≈ ${gbp(d.hourly)}/hr · ${gbp(d.annual)}/yr)` : ""}`; }
  if (f.type === "availability") { const av = parseAvail(val.v); const on = AVAIL_DAYS.filter((d) => av[d]?.length); return on.length ? on.map((d) => `${d} ${av[d].join("/")}`).join(", ") : ""; }
  if (f.type === "file") return val.fileName ? "📎 " + val.fileName : val.fileData ? "uploaded" : "";
  if (f.type === "addresses") { const a = parseAddrs(val.v); return a.length ? a.map((x) => `${x.line1}, ${x.town} ${x.postcode} (${x.from}–${x.to})`).join("; ") : ""; }
  return val.v ?? "";
};
const PRINT_CSS = `body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b;padding:26px}h1{font-size:20px;margin:0 0 2px}.sub{color:#6b7086;font-size:12px;margin-bottom:14px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#3557b7;border-bottom:1px solid #e5e7f0;padding-bottom:4px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:5px 8px;border-top:1px solid #eef1f7;vertical-align:top}td.k{color:#6b7086;width:44%}td.v{font-weight:600}.miss{color:#c0392b;font-weight:600}.ok{color:#0f7a43}.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:700}.verified{background:#e6f4ea;color:#0f7a43}.na{color:#94a3b8}.doc{page-break-before:always;padding-top:14px}.doc img{max-width:100%;max-height:880px;border:1px solid #e5e7f0;border-radius:6px}.doc object,.doc iframe{width:100%;height:940px;border:1px solid #e5e7f0;border-radius:6px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:800}.cleared{background:#e6f4ea;color:#0f7a43}.hold{background:#fdf3e0;color:#8a5a09}@media print{body{padding:0 6mm}}`;

// Address-history repeater — "Add previous address" with the same address fields
// + a from/to range. Optional (only if the current address doesn't cover 5 years).
function AddressList({ value, onChange }: { value?: string; onChange: (json: string) => void }) {
  const t = useT();
  const list = parseAddrs(value);
  const write = (l: AddrEntry[]) => onChange(JSON.stringify(l));
  const set = (i: number, k: keyof AddrEntry, v: string) => write(list.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const add = () => write([...list, { line1: "", line2: "", town: "", postcode: "", from: "", to: "" }]);
  return (
    <div className="space-y-2">
      {list.map((a, i) => (
        <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <div className="mb-1 flex items-center"><span className="text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("team.previousAddressN", { n: i + 1 })}</span><button type="button" onClick={() => write(list.filter((_, j) => j !== i))} className="ml-auto text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("team.remove")}</button></div>
          <div className="grid grid-cols-2 gap-1.5">
            <Input value={a.line1} onChange={(e) => set(i, "line1", e.target.value)} placeholder={t("team.addressLine1")} className="col-span-2" />
            <Input value={a.line2} onChange={(e) => set(i, "line2", e.target.value)} placeholder={t("team.addressLine2")} className="col-span-2" />
            <Input value={a.town} onChange={(e) => set(i, "town", e.target.value)} placeholder={t("team.townCity")} />
            <Input value={a.postcode} onChange={(e) => set(i, "postcode", e.target.value)} placeholder={t("team.postcode")} />
            <label className="text-[10px] font-bold text-[var(--ink-3)]">{t("team.fromWord")}<Input type="month" value={a.from} onChange={(e) => set(i, "from", e.target.value)} className="w-full" /></label>
            <label className="text-[10px] font-bold text-[var(--ink-3)]">{t("team.toWord")}<Input type="month" value={a.to} onChange={(e) => set(i, "to", e.target.value)} className="w-full" /></label>
          </div>
        </div>
      ))}
      <Button onClick={add}>{list.length ? t("team.addAnotherAddress") : t("team.addPreviousAddress")}</Button>
    </div>
  );
}

export function OnboardingPanel() {
  const { settings } = useSettings();
  const t = useT();
  const ob = useOnboarding();
  const [sel, setSel] = useState<string>(DEMO_STAFF[0]?.name ?? "");
  const [cfg, setCfg] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<"records" | "scr">("records");
  const [showDecl, setShowDecl] = useState(false);
  const [scrDetail, setScrDetail] = useState(false);
  const [step, setStep] = useState(0);
  const cred = useCredentials(DEMO_STAFF);
  const router = useRouter();
  const portal = (usePathname() || "/company").split("/")[1] || "company";
  const jobTitles = settings.staffRoles ?? [];
  const provider = settings.providerName || settings.billing?.businessName || "Your company";

  const staffOf = (name: string) => DEMO_STAFF.find((s) => s.name === name);
  // Job title / name / email are captured when the sign-up link is sent — pre-fill
  // them here (staff can't edit; the company can). Seed the record once if empty.
  useEffect(() => {
    const s = DEMO_STAFF.find((x) => x.name === sel); if (!s) return;
    const r = ob.recordFor(sel); const seed: Record<string, OnboardValue> = {};
    if (r.values.fullName?.v == null) seed.fullName = { v: s.name };
    if (r.values.jobTitle?.v == null) seed.jobTitle = { v: s.role };
    if (Object.keys(seed).length) ob.upsertRecord({ ...r, values: { ...r.values, ...seed } });
    setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
  const applicable = (name: string, role?: string, extra: string[] = []) => ob.fields.filter((f) => fieldApplies(f, name, role, extra));
  const progressOf = (name: string) => { const s = staffOf(name); const rec = ob.recordFor(name); const fs = applicable(name, s?.role, rec.extra); const done = fs.filter((f) => satisfied(f, rec.values[f.id])).length; return { done, total: fs.length, pct: fs.length ? Math.round((done / fs.length) * 100) : 0 }; };
  const clearedOf = (name: string) => { const s = staffOf(name); const rec = ob.recordFor(name); return applicable(name, s?.role, rec.extra).filter((f) => f.gate).every((f) => satisfied(f, rec.values[f.id])); };

  const staff = staffOf(sel); const rec = ob.recordFor(sel); const appl = applicable(sel, staff?.role, rec.extra);
  const cleared = appl.filter((f) => f.gate).every((f) => satisfied(f, rec.values[f.id]));
  const setVal = (fieldId: string, patch: Partial<OnboardValue>) => ob.upsertRecord({ ...rec, values: { ...rec.values, [fieldId]: { ...rec.values[fieldId], ...patch } } });
  const hiddenFields = ob.fields.filter((f) => !fieldApplies(f, sel, staff?.role, rec.extra));

  // ——— export one staff member's full onboarding pack ———
  const exportPack = () => {
    const clr = cleared;
    const secs = SECTIONS.map(([sid, slabel]) => { const fs = appl.filter((f) => f.section === sid); if (!fs.length) return ""; const rows = fs.map((f) => { const v = rec.values[f.id]; const d = displayVal(f, v); const ok = satisfied(f, v); return `<tr><td class="k">${esc(f.label)}${f.required ? " *" : ""}</td><td class="v ${d ? (ok ? "ok" : "") : "miss"}">${d ? esc(d) : "—"}</td></tr>`; }).join(""); return `<h2>${esc(slabel)}</h2><table>${rows}</table>`; }).join("");
    const docs = appl.map((f) => { const v = rec.values[f.id]; if (!v?.fileData) return ""; const img = v.fileData.startsWith("data:image"); return `<div class="doc"><h2>${esc(f.label)} — ${esc(v.fileName || "file")}</h2>${img ? `<img src="${v.fileData}"/>` : `<object data="${v.fileData}" type="application/pdf"><iframe src="${v.fileData}"></iframe></object>`}</div>`; }).join("");
    printWindow(`<!doctype html><html><head><meta charset="utf-8"><title>Onboarding — ${esc(sel)}</title><style>${PRINT_CSS}</style></head><body><h1>${esc(provider)} — Onboarding record</h1><div class="sub">${esc(sel)} · ${esc(staff?.role ?? "")} · ${esc(staff?.op ?? "")} · <span class="badge ${clr ? "cleared" : "hold"}">${clr ? "Cleared to start" : "Start on hold"}</span> · Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>${secs}${docs}<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`);
  };

  // ——— Single Central Record: one row per staff, the Ofsted checks ———
  const SCR_COLS: [string, string][] = [["idCheck", t("team.scrIdentity")], ["rtwCheck", t("team.scrRightToWork")], ["dbsCheck", t("team.scrDbsCleared")], ["overseas", t("team.scrOverseas")], ["refsCheck", t("team.scrReferences")], ["disqual", t("team.scrDisqualDecl")]];
  const scrCell = (name: string, role: string | undefined, extra: string[], id: string, detail = false) => {
    const f = ob.fields.find((x) => x.id === id); if (!f) return { txt: "—", cls: "na" };
    if (!fieldApplies(f, name, role, extra)) return { txt: "N/A", cls: "na" };
    const v = ob.recordFor(name).values[id];
    if (f.type === "check") return v?.status === "verified" ? { txt: "Verified" + (detail && v.at ? " · " + fmtStamp(v.at) : ""), cls: "verified" } : { txt: CHECK_LABEL[v?.status ?? "todo"], cls: "miss" };
    if (f.type === "checkbox" || f.type === "readdoc") return v?.v === "yes" ? { txt: "Yes", cls: "ok" } : { txt: "No", cls: "miss" };
    return v?.v ? { txt: v.v, cls: "ok" } : { txt: "—", cls: "miss" };
  };
  const METHOD_COLS: [string, string][] = [["idMethod", t("team.scrIdMethod")], ["rtwMethod", t("team.scrRtwMethod")]];
  const exportSCR = () => {
    const cols = scrDetail ? [...SCR_COLS, ...METHOD_COLS] : SCR_COLS;
    const head = `<tr><td class="k">Staff</td><td class="k">Role</td><td class="k">Location</td>${cols.map(([, l]) => `<td class="k">${esc(l)}</td>`).join("")}<td class="k">DBS no.</td><td class="k">Cleared</td></tr>`;
    const body = DEMO_STAFF.map((s) => { const r = ob.recordFor(s.name); const cells = SCR_COLS.map(([id]) => { const c = scrCell(s.name, s.role, r.extra, id, scrDetail); return `<td class="v"><span class="${c.cls}">${esc(c.txt)}</span></td>`; }).join(""); const methods = scrDetail ? METHOD_COLS.map(([id]) => `<td>${esc(r.values[id]?.v || "—")}</td>`).join("") : ""; const dbsNo = r.values.dbsCert?.v || "—"; const clr = clearedOf(s.name); return `<tr><td class="v">${esc(s.name)}</td><td>${esc(s.role)}</td><td>${esc(s.op)}</td>${cells}${methods}<td>${esc(dbsNo)}</td><td><span class="badge ${clr ? "cleared" : "hold"}">${clr ? "Yes" : "On hold"}</span></td></tr>`; }).join("");
    printWindow(`<!doctype html><html><head><meta charset="utf-8"><title>Single Central Record — ${esc(provider)}</title><style>${PRINT_CSS} td{font-size:11px} .k{color:#6b7086;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em}</style></head><body><h1>${esc(provider)} — Single Central Record</h1><div class="sub">Safer-recruitment checks${scrDetail ? " · with verified dates & methods" : ""} · Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div><table>${head}${body}</table><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`);
  };

  // ——— slideshow (one section per step) ———
  const gateOutstanding = appl.filter((f) => f.gate && !satisfied(f, rec.values[f.id]));
  const activeSections = SECTIONS.filter(([sid]) => appl.some((f) => f.section === sid));
  const curStep = Math.min(step, Math.max(0, activeSections.length - 1));
  const [curSid, curLabel, curIcon] = activeSections[curStep] ?? ["personal", "Personal", "👤"];
  const stepFields = appl.filter((f) => f.section === curSid);
  const style = SECTION_STYLE[curSid] ?? SECTION_STYLE.personal;
  const sectionDone = (sid: string) => { const fs = appl.filter((f) => f.section === sid); return { d: fs.filter((f) => satisfied(f, rec.values[f.id])).length, t: fs.length }; };

  const fieldCard = (f: OnboardField) => { const val = rec.values[f.id]; const ok = satisfied(f, val); const longSelect = f.type === "select" && (f.options ?? []).some((o) => o.length > 60); return (
    <div key={f.id} className={"rounded-xl border p-3 " + (f.type === "textarea" || f.type === "addresses" || f.type === "certs" || f.type === "availability" || longSelect ? "sm:col-span-2 " : "") + (ok ? "border-[#cfe8d7] bg-[#f4fbf6]" : "border-[var(--line)] bg-[var(--surface)]")}>
      <label className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">{ok && <span className="text-[#0f7a43]">✓</span>}{f.label}{f.required && <span className="text-[#c0392b]">*</span>}{f.sensitive && <span title={t("team.sensitiveTitle")} className="text-[10px]">🔒</span>}{f.fromInvite && <span title={t("team.fromInviteTitle")} className="rounded bg-[#eaf1ff] px-1 text-[8.5px] font-bold uppercase text-[#1d54c4]">{t("team.fromInviteBadge")}</span>}{rec.extra.includes(f.id) && <span className="rounded bg-[#eef1f6] px-1 text-[8.5px] font-bold uppercase text-[#64748b]">{t("team.addedBadge")}</span>}</label>
      {f.type === "check" ? (
        <div><div className="flex flex-wrap gap-1">{STATUS_SEQ.map((st) => <button key={st} type="button" onClick={() => setVal(f.id, { status: st, at: st === "verified" ? nowIso() : val?.at })} className={"rounded-full px-2.5 py-1 text-[11px] font-bold capitalize " + ((val?.status ?? "todo") === st ? STATUS_TONE[st] : "bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{st}</button>)}</div>{val?.status === "verified" && val?.at && <div className="mt-1 text-[10px] text-[var(--ink-3)]">Verified {fmtStamp(val.at)}</div>}</div>
      ) : f.type === "jobtitle" ? (() => {
        const v = val?.v ?? ""; const inList = jobTitles.includes(v); const selectVal = inList ? v : (v ? "Other" : "");
        return (<div className="space-y-1.5">{jobTitles.length ? <Select value={selectVal} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full"><option value="">{t("team.chooseJobTitle")}</option>{jobTitles.map((o) => <option key={o} value={o}>{o}</option>)}<option value="Other">{t("team.otherEllipsis")}</option></Select> : <Input value={v} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full" />}{selectVal === "Other" && <Input value={inList ? "" : v} onChange={(e) => setVal(f.id, { v: e.target.value })} placeholder={t("team.typeJobTitle")} className="w-full" />}<div className="text-[10px] text-[var(--ink-3)]">{t("team.manageJobTitles")}</div></div>);
      })() : f.type === "pay" ? (() => {
        const p = parsePay(val?.v); const d = payDerived(p); const write = (patch: Partial<PayVal>) => setVal(f.id, { v: JSON.stringify({ ...p, ...patch }) });
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={p.basis} onChange={(e) => write({ basis: e.target.value as PayVal["basis"] })} className="max-w-[130px]"><option value="hour">{t("team.perHour")}</option><option value="day">{t("team.perDay")}</option><option value="year">{t("team.annualSalary")}</option></Select>
              <div className="flex items-center gap-1"><span className="text-[13px] font-bold text-[var(--ink-3)]">£</span><Input inputMode="decimal" value={p.amount} onChange={(e) => write({ amount: e.target.value })} placeholder="0.00" className="w-[110px]" /></div>
              <div className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]"><Input inputMode="decimal" value={p.hpw} onChange={(e) => write({ hpw: e.target.value })} placeholder={t("team.hrsPlaceholder")} className="w-[64px]" />{t("team.hrsPerWeek")}</div>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]"><span onClick={() => write({ auto: !p.auto })} className={"grid h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (p.auto ? "bg-[#1d3a8f]" : "bg-[var(--line)]")}><span className={"h-3 w-3 rounded-full bg-white transition-transform " + (p.auto ? "translate-x-3" : "")} /></span>{t("team.autoCalc")}</label>
            </div>
            {p.auto && p.amount && <div className="rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">≈ {gbp(d.hourly)}/hour · {gbp(d.annual)}/year · {gbp(d.monthly)}/month</div>}
          </div>
        );
      })() : f.type === "readdoc" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {val?.fileData ? <button type="button" onClick={() => openFile(val.fileData)} className="rounded-lg border border-[#1d3a8f] bg-[#eef4ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">{t("team.viewDocument")}</button> : <span className="text-[11.5px] text-[var(--ink-3)]">{t("team.noDocumentYet")}</span>}
            <label className="cursor-pointer rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">{val?.fileData ? t("team.replaceWord") : t("team.attachWord")}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => setVal(f.id, { fileData: String(r.result), fileName: file.name }); r.readAsDataURL(file); }} /></label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[var(--ink)]"><input type="checkbox" checked={val?.v === "yes"} onChange={(e) => setVal(f.id, { v: e.target.checked ? "yes" : "", at: e.target.checked ? nowIso() : undefined })} className="h-4 w-4 accent-[#0f7a43]" /> {t("team.readAndUnderstood")}</label>
          {val?.v === "yes" && val?.at && <div className="text-[10px] text-[var(--ink-3)]">Confirmed {fmtStamp(val.at)}</div>}
        </div>
      ) : f.type === "file" ? (
        <div className="flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">{t("team.uploadBtn")}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => setVal(f.id, { fileData: String(r.result), fileName: file.name }); r.readAsDataURL(file); }} /></label>{val?.fileName && <button type="button" onClick={() => openFile(val.fileData)} className="max-w-[170px] truncate text-[12px] font-bold text-[#1d3a8f] hover:underline">📎 {val.fileName}</button>}</div>
      ) : f.type === "select" ? (() => {
        const opts = f.options ?? []; const v = val?.v ?? ""; const inList = opts.includes(v);
        const selectVal = inList ? v : (v && f.other ? "Other" : ""); const showOther = !!f.other && selectVal === "Other";
        // Long options (e.g. the HMRC employee statement) truncate when the native
        // select is collapsed — show the full chosen text wrapped underneath, with
        // any leading "A — " / "Plan 1 — " marker emphasised so it reads at a glance.
        const readback = inList && v.length > 48 ? (() => { const m = v.match(/^(\S+)\s+—\s+([\s\S]+)/); return <div className="rounded-lg bg-[var(--panel)] px-2.5 py-2 text-[11.5px] leading-snug text-[var(--ink-2)]">{m ? <><span className="mr-1 inline-block rounded bg-[#1d3a8f] px-1.5 py-0.5 text-[10px] font-extrabold text-white">{m[1]}</span>{m[2]}</> : v}</div>; })() : null;
        return (<div className="space-y-1.5"><Select value={selectVal} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full"><option value="">{t("team.chooseEllipsis")}</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</Select>{readback}{showOther && <Input value={v === "Other" ? "" : v} onChange={(e) => setVal(f.id, { v: e.target.value })} placeholder={t("team.typeItHere")} className="w-full" />}</div>);
      })() : f.type === "availability" ? (() => {
        const av = parseAvail(val?.v);
        const write = (next: Record<string, string[]>) => { setVal(f.id, { v: JSON.stringify(next) }); try { const all = JSON.parse(localStorage.getItem(AVAIL_KEY) || "{}"); all[sel] = next; localStorage.setItem(AVAIL_KEY, JSON.stringify(all)); } catch { /* ignore */ } };
        const toggle = (day: string, slot: string) => { const cur = av[day] || []; write({ ...av, [day]: cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot] }); };
        return (
          <div className="space-y-1">
            {AVAIL_DAYS.map((day) => (
              <div key={day} className="flex items-center gap-1.5">
                <span className="w-9 text-[11.5px] font-bold text-[var(--ink-2)]">{day}</span>
                {AVAIL_SLOTS.map((slot) => { const on = (av[day] || []).includes(slot); return <button key={slot} type="button" onClick={() => toggle(day, slot)} className={"rounded-lg px-3 py-1 text-[11px] font-bold transition-colors " + (on ? "bg-[#0369a1] text-white" : "bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{slot}</button>; })}
              </div>
            ))}
            <div className="pt-0.5 text-[10px] text-[var(--ink-3)]">{t("team.tapTimesPre")}<b>{t("team.scheduleWord")}</b>.</div>
          </div>
        );
      })() : f.type === "addresses" ? (
        <AddressList value={val?.v} onChange={(json) => setVal(f.id, { v: json })} />
      ) : f.type === "certs" ? (() => {
        const roleReq = cred.types.filter((t) => credAppliesTo(t, sel, staff?.role));
        let alsoIds: string[] = []; try { alsoIds = JSON.parse(val?.v || "[]"); } catch { alsoIds = []; }
        const also = cred.types.filter((t) => alsoIds.includes(t.id) && !roleReq.some((r) => r.id === t.id));
        const remaining = cred.types.filter((t) => !roleReq.some((r) => r.id === t.id) && !alsoIds.includes(t.id));
        const setAlso = (ids: string[]) => setVal(f.id, { v: JSON.stringify(ids) });
        const chip = (t: { id: string; name: string }, removable: boolean) => { const rr = cred.recordFor(sel, t.id); return (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5">
            <button type="button" onClick={() => rr?.fileData && openCredFile(rr.fileData)} title={rr?.fileData ? "View uploaded certificate" : ""} className="text-[11.5px] font-bold text-[var(--ink)]">{t.name}</button>
            <CredBadge s={credStatus(rr)} />
            {removable && <button type="button" onClick={() => setAlso(alsoIds.filter((x) => x !== t.id))} className="text-[var(--ink-3)] hover:text-[#c0392b]">×</button>}
          </span>); };
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">{roleReq.length ? roleReq.map((ct) => chip(ct, false)) : <span className="text-[12px] text-[var(--ink-3)]">{t("team.noCertsForRole", { role: staff?.role || t("team.thisRole") })}</span>}{also.map((ct) => chip(ct, true))}</div>
            {remaining.length > 0 && <Select value="" onChange={(e) => { if (e.target.value) setAlso([...alsoIds, e.target.value]); }} className="max-w-[300px]"><option value="">{t("team.addCertFromArea")}</option>{remaining.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}</Select>}
            <div className="text-[10.5px] text-[var(--ink-3)]">{t("team.setCertRolePre")}<button type="button" onClick={() => router.push(`/${portal}/setup?tab=learning#credtypes`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">{t("team.setupLearning")}</button>{t("team.setCertRoleMid")}<b>{t("team.teamStaffCerts")}</b>.</div>
          </div>
        );
      })() : f.type === "textarea" ? (
        <textarea value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#1d3a8f]" />
      ) : f.id === "dbsIssue" ? (
        <div className="space-y-1">
          <Input type="date" value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full" />
          {val?.v && <div className="text-[11px] font-bold" style={{ color: dbsAgeColor(val.v) }}>🔎 {dbsAgeLabel(val.v)}</div>}
        </div>
      ) : (
        <Input type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"} value={val?.v ?? ""} onChange={(e) => setVal(f.id, { v: e.target.value })} className="w-full" />
      )}
      {f.hint && <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">{f.hint}</div>}
    </div>
  ); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
          {([["records", t("team.onboardingRecordsTab")], ["scr", t("team.scrTab")]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (mode === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => setCfg(true)}>{t("team.requirements")}</Button>
      </div>

      {mode === "scr" ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div><div className="text-[14px] font-extrabold text-[var(--ink)]">{t("team.singleCentralRecord")}</div><div className="text-[12px] text-[var(--ink-3)]">{t("team.scrSubtitle")}</div></div>
            <button type="button" onClick={() => setScrDetail((v) => !v)} className={"ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors " + (scrDetail ? "border-[#1d3a8f] bg-[#eaf1ff] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[#1d3a8f]")}><span className={"grid h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (scrDetail ? "bg-[#1d3a8f]" : "bg-[var(--line)]")}><span className={"h-3 w-3 rounded-full bg-white transition-transform " + (scrDetail ? "translate-x-3" : "")} /></span>{t("team.datesAndMethods")}</button>
            <Button variant="primary" onClick={exportSCR}>{t("team.printExport")}</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]">
              <thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">{t("team.staffCol")}</th><th className="px-3 py-2.5 font-extrabold">{t("team.roleCol")}</th><th className="px-3 py-2.5 font-extrabold">{t("team.locationCol")}</th>{SCR_COLS.map(([, l]) => <th key={l} className="whitespace-nowrap px-3 py-2.5 font-extrabold">{l}</th>)}{scrDetail && METHOD_COLS.map(([, l]) => <th key={l} className="whitespace-nowrap px-3 py-2.5 font-extrabold">{l}</th>)}<th className="px-3 py-2.5 font-extrabold">{t("team.dbsNo")}</th><th className="px-3 py-2.5 font-extrabold">{t("team.clearedCol")}</th></tr></thead>
              <tbody>{DEMO_STAFF.map((s) => { const r = ob.recordFor(s.name); const cl = clearedOf(s.name); return (
                <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2.5"><button type="button" onClick={() => { setSel(s.name); setMode("records"); }} className="font-bold text-[#1d3a8f] hover:underline">{s.name}</button></td>
                  <td className="px-3 py-2.5 text-[var(--ink-2)]">{s.role}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td>
                  {SCR_COLS.map(([id]) => { const c = scrCell(s.name, s.role, r.extra, id, scrDetail); const tone = c.cls === "verified" || c.cls === "ok" ? "bg-[#e6f4ea] text-[#0f7a43]" : c.cls === "na" ? "bg-[#eef1f6] text-[#94a3b8]" : "bg-[#fdecec] text-[#c0392b]"; return <td key={id} className="px-3 py-2"><span className={"inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold " + tone}>{c.txt}</span></td>; })}
                  {scrDetail && METHOD_COLS.map(([id]) => <td key={id} className="whitespace-nowrap px-3 py-2.5 text-[var(--ink-2)]">{r.values[id]?.v || "—"}</td>)}
                  <td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{r.values.dbsCert?.v || "—"}</td>
                  <td className="px-3 py-2"><span className={"inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold " + (cl ? "bg-[#e6f4ea] text-[#0f7a43]" : "bg-[#fdf3e0] text-[#8a5a09]")}>{cl ? t("team.yes") : t("team.onHold")}</span></td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink-3)]"><b>{t("team.naAbbr")}</b>{t("team.naExplain")}</p>
        </div>
      ) : (
      <>
      {/* Team-wide onboarding progress — a top-line before drilling into one person. */}
      {(() => {
        const cleared = DEMO_STAFF.filter((s) => clearedOf(s.name)).length;
        const started = DEMO_STAFF.filter((s) => { const p = progressOf(s.name); return p.pct > 0 && p.pct < 100; }).length;
        return (
          <div className="mb-3 grid grid-cols-3 gap-2.5">
            <Tile label={t("team.clearedToStart")} icon="✅" grad={GRAD.green} value={String(cleared)} sub={t("team.ofNStaff", { n: DEMO_STAFF.length })} />
            <Tile label={t("team.startOnHold")} icon="⛔" grad={cleared < DEMO_STAFF.length ? GRAD.pink : GRAD.green} value={String(DEMO_STAFF.length - cleared)} sub={t("team.checksOutstanding")} />
            <Tile label={t("team.inProgress")} icon="⏳" grad={GRAD.amber} value={String(started)} sub={t("team.partWayThrough")} />
          </div>
        );
      })()}
      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        {/* roster */}
        <div className="space-y-2">
          {DEMO_STAFF.map((s) => { const p = progressOf(s.name); const cl = clearedOf(s.name); const on = s.name === sel; return (
            <button key={s.name} type="button" onClick={() => setSel(s.name)} className={"block w-full rounded-xl border p-3 text-left transition-colors " + (on ? "border-[#1d3a8f] bg-[#eef4ff]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[#1d3a8f]")}>
              <div className="flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{s.name}</span>{cl ? <span className="ml-auto rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#0f7a43]">{t("team.clearedShort")}</span> : <span className="ml-auto rounded-full bg-[#fdf3e0] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8a5a09]">{t("team.onHold")}</span>}</div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{s.role} · {s.op}</div>
              <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full " + (p.pct === 100 ? "bg-[#0f9d58]" : "bg-[#3f7ae0]")} style={{ width: `${p.pct}%` }} /></div><span className="text-[10.5px] font-bold tabular-nums text-[var(--ink-3)]">{p.pct}%</span></div>
            </button>
          ); })}
        </div>

        {/* form — colourful slideshow, one section per step */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
            <div><div className="text-[16px] font-extrabold text-[var(--ink)]">{sel}</div><div className="text-[12px] text-[var(--ink-3)]">{staff?.role} · {staff?.op}</div></div>
            <div className="ml-auto flex items-center gap-2">
              {cleared ? <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0f7a43]">{t("team.clearedToStartCheck")}</span> : <span className="rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[11.5px] font-extrabold text-[#8a5a09]">{t("team.startOnHoldWait")}</span>}
              <Button onClick={exportPack}>{t("team.exportPack")}</Button>
            </div>
          </div>

          {/* staff submitted the form — flag what they left outstanding (compulsory but not provided) */}
          {rec.submittedAt && (() => { const editedAfter = !!rec.lastEditedAt && rec.lastEditedAt > rec.submittedAt!; const attention = (rec.outstanding?.length ?? 0) > 0 || editedAfter; return (
            <div className={"mx-4 mt-3 rounded-xl border px-3.5 py-2.5 text-[12px] " + (attention ? "border-[#f3cfa6] bg-[#fdf3e0] text-[#8a4b09]" : "border-[#cfe8d7] bg-[#f4fbf6] text-[#0f7a43]")}>
              <span className="font-extrabold">{t("team.submittedOnboardingPre", { name: sel.split(" ")[0] })}{rec.submittedAt ? t("team.onDateSuffix", { date: fmtStamp(rec.submittedAt) }) : ""}.</span>
              {(rec.outstanding?.length ?? 0) > 0
                ? <> {t("team.flaggedPre")}<b>{rec.outstanding!.length}</b>{t("team.compulsoryOutstandingMid")}<b>{rec.outstanding!.join(", ")}</b>{t("team.chaseThese")}</>
                : !editedAfter && <> {t("team.allCompulsoryProvided")}</>}
              {editedAfter && <div className="mt-1 font-extrabold">{t("team.updatedAfterSubmit", { name: sel.split(" ")[0], date: fmtStamp(rec.lastEditedAt) })}</div>}
            </div>
          ); })()}

          {/* step rail */}
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
            {activeSections.map(([sid, slabel, sicon], i) => { const sd = sectionDone(sid); const done = sd.t > 0 && sd.d === sd.t; const on = i === curStep; const st = SECTION_STYLE[sid] ?? SECTION_STYLE.personal; return (
              <button key={sid} type="button" onClick={() => setStep(i)} className={"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all " + (on ? "text-white shadow-md" : done ? "bg-[#e6f4ea] text-[#0f7a43]" : "bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink-2)]")} style={on ? { background: st.grad } : undefined}><span>{done && !on ? "✓" : sicon}</span><span className="hidden md:inline">{slabel}</span></button>
            ); })}
          </div>

          {/* big gradient step header */}
          <div className="relative m-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_18px_40px_-24px_rgba(16,32,90,.6)]" style={{ background: style.grad }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" aria-hidden><circle cx="372" cy="16" r="60" fill="#fff" opacity="0.09" /><circle cx="330" cy="120" r="40" fill="#fff" opacity="0.07" /></svg>
            <div className="relative flex items-center gap-3">
              <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-white/20 text-[28px] leading-none backdrop-blur">{curIcon}</div>
              <div className="min-w-0"><div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/80">Step {curStep + 1} of {activeSections.length}</div><div className="text-[20px] font-extrabold leading-tight" style={{ textWrap: "balance" } as React.CSSProperties}>{curLabel}</div></div>
              <div className="ml-auto flex-none text-right"><div className="text-[24px] font-extrabold leading-none tabular-nums">{sectionDone(curSid).d}/{sectionDone(curSid).t}</div><div className="mt-0.5 text-[10px] text-white/80">completed</div></div>
            </div>
          </div>

          {/* specific cleared / on-hold banner */}
          {cleared ? <div className="mx-4 mb-3 rounded-xl border border-[#cfe8d7] bg-[#f4fbf6] px-3.5 py-2 text-[12px] font-semibold text-[#0f7a43]">{t("team.allChecksVerified")}</div>
            : gateOutstanding.length > 0 && <div className="mx-4 mb-3 rounded-xl border border-[#f3cfa6] bg-[#fdf3e0] px-3.5 py-2 text-[12px] font-semibold text-[#8a4b09]">{t("team.notClearedYet", { labels: gateOutstanding.map((f) => f.label).join(" · ") })}</div>}

          {/* this step's fields */}
          <div className="grid gap-2.5 px-4 sm:grid-cols-2">{stepFields.map(fieldCard)}</div>

          {/* nav */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
            <Button disabled={curStep === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>{t("team.backArrow")}</Button>
            <div className="relative">
              <Button onClick={() => setAddOpen((v) => !v)}>{t("team.addItem")}</Button>
              {addOpen && (
                <div className="absolute bottom-full z-20 mb-1 max-h-[260px] w-[280px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                  {hiddenFields.length ? hiddenFields.map((f) => <button key={f.id} type="button" onClick={() => { ob.upsertRecord({ ...rec, extra: [...rec.extra, f.id] }); setAddOpen(false); }} className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.label} <span className="text-[10px] text-[var(--ink-3)]">· {SECTIONS.find((s) => s[0] === f.section)?.[1]}</span></button>) : <div className="px-3 py-2 text-[12px] text-[var(--ink-3)]">{t("team.everyItemApplies", { name: sel.split(" ")[0] })}</div>}
                </div>
              )}
            </div>
            {curStep < activeSections.length - 1
              ? <Button variant="primary" className="ml-auto" onClick={() => setStep((s) => Math.min(activeSections.length - 1, s + 1))}>{t("team.nextColon")} {activeSections[curStep + 1][1]} →</Button>
              : <span className="ml-auto text-[12px] font-bold text-[var(--ink-3)]">{t("team.finalStep")}</span>}
          </div>
          <p className="px-4 pb-4 text-[11px] text-[var(--ink-3)]">{t("team.certsTrackedPre")}<b>{t("team.teamStaffCerts")}</b>{t("team.certsTrackedPost")}</p>
        </div>
      </div>
      </>
      )}

      {showDecl && (
        <div className="fixed inset-0 z-[142] flex items-center justify-center bg-black/45 p-4" onClick={() => setShowDecl(false)}>
          <div className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none border-b border-[var(--line)] px-5 py-3.5"><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t("team.disqualExampleTitle")}</h3><button type="button" onClick={() => setShowDecl(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div><p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{t("team.disqualPrintNote")}</p></div>
            <div className="flex-1 overflow-y-auto px-5 py-4"><pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-[var(--ink)]">{DISQUAL_DECLARATION}</pre></div>
            <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3"><span className="text-[11px] text-[var(--ink-3)]">{provider}</span><Button className="ml-auto" onClick={() => setShowDecl(false)}>{t("team.close")}</Button><Button variant="primary" onClick={() => printWindow(`<!doctype html><html><head><meta charset="utf-8"><title>Disqualification declaration</title><style>body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b;padding:34px;max-width:720px;margin:0 auto}h1{font-size:16px}pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7}</style></head><body><h1>${esc(provider)}</h1><pre>${esc(DISQUAL_DECLARATION)}</pre><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`)}>{t("team.print")}</Button></div>
          </div>
        </div>
      )}

      {cfg && <RequirementsModal fields={ob.fields} onSave={ob.saveFields} onClose={() => setCfg(false)} accessRoles={(settings.roles ?? []).map((r) => r.name).filter(Boolean)} jobTitles={(settings.staffRoles ?? []).filter(Boolean)} />}
    </div>
  );
}

// ——— requirements config ———
function RequirementsModal({ fields, onSave, onClose, accessRoles, jobTitles }: { fields: OnboardField[]; onSave: (f: OnboardField[]) => void; onClose: () => void; accessRoles: string[]; jobTitles: string[] }) {
  const t = useT();
  const [list, setList] = useState<OnboardField[]>(fields);
  const [newLabel, setNewLabel] = useState(""); const [newSection, setNewSection] = useState(SECTIONS[0][0]); const [newType, setNewType] = useState<FieldType>("text");
  const patch = (id: string, p: Partial<OnboardField>) => setList((l) => l.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const toggleRole = (id: string, r: string) => setList((l) => l.map((f) => { if (f.id !== id) return f; const a = f.applyRoles ?? []; return { ...f, applyRoles: a.includes(r) ? a.filter((x) => x !== r) : [...a, r] }; }));
  const addField = () => { if (!newLabel.trim()) return; const id = "cf_" + newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) + "_" + list.length; setList((l) => [...l, { id, section: newSection, label: newLabel.trim(), type: newType, required: false, applyKind: "all", custom: true }]); setNewLabel(""); };
  const del = (id: string) => setList((l) => l.filter((f) => f.id !== id));

  return (
    <div className="fixed inset-0 z-[141] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl select-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5"><div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t("team.onboardingRequirements")}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div><p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{t("team.requirementsHelpPre")}<b>{t("team.appliesToBold")}</b>{t("team.requirementsHelpPost")}</p></div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {SECTIONS.map(([sid, slabel, sicon]) => { const fs = list.filter((f) => f.section === sid); if (!fs.length) return null; return (
            <div key={sid} className="mb-4">
              <h4 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{sicon} {slabel}</h4>
              <div className="space-y-1.5">
                {fs.map((f) => (
                  <div key={f.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-[var(--ink)]">{f.label}{f.gate && <span title={t("team.gatesClearedTitle")} className="ml-1 text-[10px]">🚦</span>}</span>
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={f.required} onChange={(e) => patch(f.id, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[#1d3a8f]" />{t("team.required")}</label>
                      <Select value={f.applyKind} onChange={(e) => patch(f.id, { applyKind: e.target.value as OnboardField["applyKind"] })} className="max-w-[130px]"><option value="all">{t("team.allStaff")}</option><option value="roles">{t("team.certainRoles")}</option><option value="staff">{t("team.namedPeople")}</option></Select>
                      {f.custom && <button type="button" onClick={() => del(f.id)} title={t("team.deleteWord")} className="text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>}
                    </div>
                    {f.applyKind === "roles" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {accessRoles.length > 0 && <span className="mr-0.5 rounded bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#5b6577]">{t("team.accessBadge")}</span>}
                        {accessRoles.map((r) => <button key={r} type="button" onClick={() => toggleRole(f.id, r)} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyRoles ?? []).includes(r) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{r}</button>)}
                        {jobTitles.length > 0 && <span className="ml-1 mr-0.5 rounded bg-[#eaf1ff] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#1d54c4]">{t("team.jobBadge")}</span>}
                        {jobTitles.map((r) => <button key={r} type="button" onClick={() => toggleRole(f.id, r)} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyRoles ?? []).includes(r) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{r}</button>)}
                        {!accessRoles.length && !jobTitles.length && <span className="text-[11px] text-[var(--ink-3)]">{t("team.addRolesFirst")}</span>}
                      </div>
                    )}
                    {f.applyKind === "staff" && <div className="mt-1.5 flex flex-wrap gap-1">{DEMO_STAFF.map((s) => <button key={s.name} type="button" onClick={() => setList((l) => l.map((x) => { if (x.id !== f.id) return x; const a = x.applyStaff ?? []; return { ...x, applyStaff: a.includes(s.name) ? a.filter((y) => y !== s.name) : [...a, s.name] }; }))} className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold " + ((f.applyStaff ?? []).includes(s.name) ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)]")}>{s.name}</button>)}</div>}
                  </div>
                ))}
              </div>
            </div>
          ); })}
          <div className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("team.addCustomItem")}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("team.itemLabel")} className="min-w-[160px] flex-1" />
              <Select value={newSection} onChange={(e) => setNewSection(e.target.value)} className="max-w-[170px]">{SECTIONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select>
              <Select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className="max-w-[130px]"><option value="text">{t("team.ftText")}</option><option value="date">{t("team.ftDate")}</option><option value="textarea">{t("team.ftLongText")}</option><option value="file">{t("team.ftFileUpload")}</option><option value="checkbox">{t("team.ftTickBox")}</option><option value="check">{t("team.ftStatusCheck")}</option></Select>
              <Button variant="primary" onClick={addField}>{t("team.add")}</Button>
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3"><span className="text-[11.5px] text-[var(--ink-3)]">{t("team.requiredItemsCount", { required: list.filter((f) => f.required).length, total: list.length })}</span><Button className="ml-auto" onClick={onClose}>{t("team.cancel")}</Button><Button variant="primary" onClick={() => { onSave(list); onClose(); }}>{t("team.saveRequirements")}</Button></div>
      </div>
    </div>
  );
}
