"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { SEED_LIBRARY, blankCourse, activeQuizVersion, quizVersions, QUIZ_VERSION_LABELS, type CourseDoc } from "./courseContent";
import { CoursePlayer } from "./CoursePlayer";
import { openCertificate, makeRef } from "./certificates";
import { useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, targetLabel as credTargetLabel, exportCredsPdf, fmtDate as fmtCredDate, daysUntil, type CredRecord, type CredStatus } from "./credentials";
import { useRouter } from "next/navigation";
import { CourseEditor } from "./CourseEditor";

// Company / Franchise Learning Centre — the training management side (the manual's
// LCM view, compliance merged in). Four tabs: Catalogue (courses + quizzes, create
// & assign), Assignments (by location + audience + due + required), Completion
// (KPIs + staff × training table), Certificates (DBS / First-Aid RAG). Front-end
// with a localStorage demo store; the real records/roll-up are Amir's backend.

type Tone = "green" | "amber" | "red" | "blue" | "grey";
const TONES: Record<Tone, string> = {
  green: "bg-[#e2f4ea] text-[#0f7a43]",
  amber: "bg-[#fcefd2] text-[#b45309]",
  red: "bg-[#fdecec] text-[#c0392b]",
  blue: "bg-[#eaf1ff] text-[#1d54c4]",
  grey: "bg-[#eef1f6] text-[#64748b]",
};
const STATUS_TONE: Record<string, Tone> = {
  Complete: "green", Valid: "green", Passed: "green",
  "In progress": "amber", Expiring: "amber", "Quiz pending": "amber",
  "Not started": "grey", Pending: "grey", Optional: "grey", Quiz: "grey",
  Overdue: "red", Expired: "red", Due: "red", Required: "red",
  Mandatory: "red", Recommended: "blue", Course: "blue",
};
const Badge = ({ text, tone }: { text: string; tone?: Tone }) => (
  <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + TONES[tone ?? STATUS_TONE[text] ?? "grey"]}>{text}</span>
);

// ——— topical categories, difficulty & cover art (catalogue theming) ———
type CatKey = "saf" | "inclusion" | "send" | "medical" | "health" | "digital" | "together";
const CATEGORIES: { key: CatKey; label: string; icon: string; ink: string; soft: string; grad: string }[] = [
  { key: "saf", label: "Safeguarding & child protection", icon: "🛡️", ink: "#1d3a8f", soft: "#eef4fd", grad: "linear-gradient(135deg,#1d3a8f,#3f7ae0)" },
  { key: "inclusion", label: "Inclusion & culture", icon: "🌍", ink: "#c2410c", soft: "#faece7", grad: "linear-gradient(135deg,#c2410c,#f59e0b)" },
  { key: "send", label: "SEND & wellbeing", icon: "🧠", ink: "#6d28d9", soft: "#f3effe", grad: "linear-gradient(135deg,#6d28d9,#a855f7)" },
  { key: "medical", label: "Medical awareness", icon: "💊", ink: "#b91c1c", soft: "#fdecec", grad: "linear-gradient(135deg,#b91c1c,#ef4444)" },
  { key: "health", label: "Health & safety", icon: "⛑️", ink: "#0f7a43", soft: "#eaf8f0", grad: "linear-gradient(135deg,#0f7a43,#37b26a)" },
  { key: "digital", label: "Digital & data", icon: "🌐", ink: "#0f766e", soft: "#e1f5ee", grad: "linear-gradient(135deg,#0f766e,#22b4a6)" },
  { key: "together", label: "Working together", icon: "🤝", ink: "#475569", soft: "#eef1f6", grad: "linear-gradient(135deg,#475569,#94a3b8)" },
];
const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<CatKey, (typeof CATEGORIES)[number]>;
const LABEL_TO_KEY: Record<string, CatKey> = Object.fromEntries(CATEGORIES.map((c) => [c.label.toLowerCase(), c.key]));
// tolerate a stored key OR a free-text category label (for company-created custom categories)
const catKeyOf = (v?: string): CatKey => { if (!v) return "together"; if (CAT_BY_KEY[v as CatKey]) return v as CatKey; return LABEL_TO_KEY[v.toLowerCase()] ?? "together"; };
type Level = "Intro" | "Core" | "Advanced";
const COURSE_META: Record<string, { cat: CatKey; level: Level; tags: string[] }> = {
  c11: { cat: "saf", level: "Intro", tags: ["Awareness", "KCSIE 2025"] },
  c1: { cat: "saf", level: "Core", tags: ["KCSIE 2025", "Core"] },
  c12: { cat: "saf", level: "Advanced", tags: ["DSL", "Statutory"] },
  c4: { cat: "saf", level: "Core", tags: ["Exploitation", "County lines"] },
  c16: { cat: "saf", level: "Core", tags: ["Exploitation"] },
  c17: { cat: "saf", level: "Core", tags: ["Mandatory reporting"] },
  c6: { cat: "saf", level: "Core", tags: ["Prevent", "Channel"] },
  c18: { cat: "saf", level: "Core", tags: ["Domestic abuse"] },
  c5: { cat: "saf", level: "Core", tags: ["Safe staffing", "DBS"] },
  c13: { cat: "send", level: "Core", tags: ["Autism", "SEND"] },
  c14: { cat: "send", level: "Core", tags: ["ADHD", "SEND"] },
  c15: { cat: "send", level: "Core", tags: ["Wellbeing"] },
  c3: { cat: "send", level: "Core", tags: ["Behaviour", "Trauma-informed"] },
  c8: { cat: "digital", level: "Core", tags: ["Online safety", "4 Cs"] },
  c9: { cat: "digital", level: "Core", tags: ["GDPR", "ICO"] },
  c7: { cat: "health", level: "Core", tags: ["Anaphylaxis", "AAI"] },
  c2: { cat: "health", level: "Core", tags: ["First aid", "CPR"] },
  c19: { cat: "health", level: "Core", tags: ["Food safety", "Allergens"] },
  c10: { cat: "health", level: "Core", tags: ["Fire safety"] },
  // ——— new library (c20–c39) ———
  c20: { cat: "medical", level: "Core", tags: ["Medication", "MAR sheets"] },
  c21: { cat: "medical", level: "Core", tags: ["Epilepsy", "Seizures"] },
  c22: { cat: "medical", level: "Core", tags: ["Diabetes", "Type 1"] },
  c23: { cat: "medical", level: "Core", tags: ["Asthma", "Inhalers"] },
  c24: { cat: "health", level: "Core", tags: ["Risk assessment", "RIDDOR"] },
  c25: { cat: "health", level: "Core", tags: ["Trips", "EVOLVE"] },
  c26: { cat: "health", level: "Core", tags: ["Water safety"] },
  c27: { cat: "health", level: "Core", tags: ["Sun & heat"] },
  c28: { cat: "health", level: "Core", tags: ["Manual handling"] },
  c29: { cat: "health", level: "Core", tags: ["Lone working"] },
  c30: { cat: "health", level: "Core", tags: ["Infection control"] },
  c31: { cat: "inclusion", level: "Core", tags: ["Equality Act 2010", "EDI"] },
  c32: { cat: "inclusion", level: "Core", tags: ["Anti-bullying"] },
  c33: { cat: "inclusion", level: "Core", tags: ["SEND Code", "Inclusion"] },
  c34: { cat: "send", level: "Core", tags: ["ACEs", "Trauma-informed"] },
  c35: { cat: "send", level: "Core", tags: ["Development", "Attachment"] },
  c36: { cat: "send", level: "Core", tags: ["Bereavement"] },
  c37: { cat: "send", level: "Core", tags: ["Staff wellbeing"] },
  c38: { cat: "saf", level: "Core", tags: ["Modern slavery", "NRM"] },
  c39: { cat: "together", level: "Core", tags: ["Parents", "Complaints"] },
};
const metaOf = (id: string): { cat: CatKey; level: Level; tags: string[] } => COURSE_META[id] ?? { cat: "saf", level: "Core", tags: [] };
const COVER_EMOJI: Record<string, string> = { shield: "🛡️", listen: "🧑‍🤝‍🧒", county: "📱", recruit: "🔎", prevent: "🧭", epipen: "💉", online: "🌐", behaviour: "🫧", data: "🔒", firstaid: "⛑️", fire: "🔥", autism: "🧩", adhd: "⚡", mind: "🧠", cse: "🚸", fgm: "🎗️", domestic: "🏠", food: "🍽️", med: "💊", epilepsy: "🧠", diabetes: "🩸", asthma: "🫁", risk: "⚠️", trips: "🚌", water: "🌊", sun: "☀️", lifting: "📦", lone: "🚶", hygiene: "🧼", edi: "🌍", antibully: "🙅", send: "♿", aces: "💔", develop: "🌱", grief: "🕊️", wellbeing: "🌿", slavery: "⛓️", parents: "🤝" };
const LEVEL_TONE: Record<Level, Tone> = { Intro: "grey", Core: "blue", Advanced: "amber" };
function CourseCover({ cover, catKey, size = 60 }: { cover: string; catKey: CatKey; size?: number }) {
  const c = CAT_BY_KEY[catKey] ?? CATEGORIES[0];
  return (
    <div className="relative grid flex-none place-items-center overflow-hidden rounded-2xl text-white shadow-[0_10px_24px_-14px_rgba(16,32,90,.7)]" style={{ background: c.grad, width: size, height: size, fontSize: size * 0.46 }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 80 80" preserveAspectRatio="none" aria-hidden><circle cx="66" cy="12" r="22" fill="#fff" opacity=".18" /><circle cx="70" cy="64" r="14" fill="#fff" opacity=".12" /><path d="M0 62 Q20 48 40 58 T80 54 V80 H0 Z" fill="#fff" opacity=".08" /></svg>
      <span className="relative leading-none">{COVER_EMOJI[cover] ?? "🎓"}</span>
    </div>
  );
}

interface Staff { name: string; role: string; op: string; sg: string; sgq: number | null; fa: string; dbs: string; pfa: string }
// An assignment targets everyone, one or more job roles, or one or more named staff.
interface Assignment { course: string; title: string; kind: "all" | "roles" | "staff"; roles: string[]; staff: string[]; locs: string[]; due: string; required: boolean; version: number; renewMonths?: number }

const FALLBACK_ROLES = ["Lifeguard", "Coach / instructor", "Lead / manager", "Playworker", "First-aider", "Volunteer", "Administrator"];
const OPS: [string, string][] = [["all", "All locations"], ["Company-owned", "Company-owned (Head Office)"], ["Milton Keynes", "Milton Keynes"], ["Northampton", "Northampton"], ["Bedford", "Bedford"]];
const SEED_STAFF: Staff[] = [
  { name: "Marcus Bell", role: "Lead", op: "Company-owned", sg: "Complete", sgq: 92, fa: "In progress", dbs: "Valid", pfa: "Expiring" },
  { name: "Jess Patel", role: "Coach", op: "Company-owned", sg: "Complete", sgq: 84, fa: "Overdue", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", role: "Lead", op: "Milton Keynes", sg: "In progress", sgq: null, fa: "Not started", dbs: "Valid", pfa: "Expired" },
  { name: "Tom Lewis", role: "Coach", op: "Milton Keynes", sg: "Complete", sgq: 88, fa: "Complete", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", role: "Coach", op: "Northampton", sg: "Overdue", sgq: null, fa: "Not started", dbs: "Pending", pfa: "Valid" },
  { name: "Dan Reed", role: "Lead", op: "Bedford", sg: "Complete", sgq: 76, fa: "In progress", dbs: "Valid", pfa: "Valid" },
];
const SEED_ASSIGNMENTS: Assignment[] = [
  { course: "c1", title: "Safeguarding Children (Level 2)", kind: "all", roles: [], staff: [], locs: [], due: "30 Jun", required: true, version: 0, renewMonths: 12 },
  { course: "c2", title: "Paediatric First Aid Refresher", kind: "roles", roles: ["First-aider", "Lead / manager"], staff: [], locs: [], due: "15 Jul", required: true, version: 0, renewMonths: 36 },
  { course: "c26", title: "Water Safety & Supervision", kind: "roles", roles: ["Lifeguard"], staff: [], locs: [], due: "15 Jul", required: true, version: 0, renewMonths: 12 },
];
const targetLabel = (a: Assignment) => a.kind === "all" ? "All staff" : a.kind === "roles" ? (a.roles.join(", ") || "no roles") : (a.staff.join(", ") || "no staff");

// ——— Documents & Policies (read-and-confirm) ———
// Share a policy; each person reads it and ticks "I have read and understood",
// producing a dated record for inspections. Front-end demo store; the doc store +
// read-receipts are Amir's backend (see handoff).
interface PolicyDoc { id: string; title: string; category?: string; required: boolean; added: string; body: string; fileData?: string; fileName?: string }
interface PolicyAck { docId: string; staff: string; date: string }
const PKEY = "aos.learn.policies.v1";
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso: string) => { const d = new Date(iso + "T00:00:00"); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const blankPolicy = (): PolicyDoc => ({ id: "pol" + Date.now().toString(36), title: "", category: "", required: true, added: todayISO(), body: "" });
const SEED_POLICIES: PolicyDoc[] = [
  { id: "pol1", title: "Safeguarding & Child Protection Policy", category: "Safeguarding", required: true, added: "2026-06-01", body: "Every member of staff and volunteer is responsible for keeping children safe.\n\n1. If a child discloses something that worries you, listen calmly, reassure them, and record the facts in their own words. Do not promise secrecy.\n2. Report any concern to the Designated Safeguarding Lead the same day.\n3. Never investigate a concern yourself.\n4. Follow safer-working practice at all times: stay visible, avoid being alone with a child where possible, and use appropriate language.\n\nBy confirming below you agree that you have read, understood and will follow this policy." },
  { id: "pol2", title: "Staff Code of Conduct", category: "Working together", required: true, added: "2026-06-01", body: "This code sets out the standards of behaviour expected of everyone working with us.\n\n- Treat every child, parent and colleague with respect and fairness.\n- Arrive prepared and on time, and follow the ratios and registers for your sessions.\n- Keep personal and professional boundaries clear — no personal contact with children or families outside work, including social media.\n- Report accidents, incidents and near-misses promptly.\n- Represent the organisation positively in the community.\n\nConfirm below to acknowledge you will uphold this code." },
  { id: "pol3", title: "Health & Safety Policy", category: "Health & safety", required: true, added: "2026-07-10", body: "We are committed to providing a safe environment for children, staff and visitors.\n\n- Complete a risk assessment before every activity and check the space is safe.\n- Know where the first-aid kit, fire exits and assembly point are.\n- Report hazards immediately and do not use faulty equipment.\n- Follow manual-handling guidance and keep walkways clear.\n\nConfirm you have read and understood these responsibilities." },
  { id: "pol4", title: "Photography & Social Media Policy", category: "Digital & data", required: false, added: "2026-07-20", body: "Photographs and video can only be taken and shared with the right consent.\n\n- Only use organisation devices, never personal phones, to photograph children.\n- Check each child's photo-consent status before sharing any image.\n- Never post a child's full name alongside their photo.\n- Store and delete images in line with our data-retention rules.\n\nThis policy is recommended reading for all staff." },
];
const SEED_POLICY_ACKS: PolicyAck[] = [
  { docId: "pol1", staff: "Marcus Bell", date: "2026-06-03" }, { docId: "pol1", staff: "Jess Patel", date: "2026-06-05" }, { docId: "pol1", staff: "Tom Lewis", date: "2026-06-04" },
  { docId: "pol2", staff: "Marcus Bell", date: "2026-06-03" }, { docId: "pol3", staff: "Dan Reed", date: "2026-07-12" },
];

// ——— CSV export (evidence pack for inspections) ———
function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  if (typeof document === "undefined") return;
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ——— Automated reminders (front-end prefs; sending is the platform's job) ———
interface ReminderPrefs { courseDue: boolean; overdueChase: boolean; renewalDue: boolean; unreadPolicy: boolean; weeklyDigest: boolean; digestDay: string }
const RKEY = "aos.learn.reminders.v1";
const DEFAULT_REMINDERS: ReminderPrefs = { courseDue: true, overdueChase: true, renewalDue: true, unreadPolicy: true, weeklyDigest: true, digestDay: "Monday" };
// days until a due date (only for ISO yyyy-mm-dd due dates from the date picker; seed strings return null)
function daysLeft(due: string): number | null { if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null; const d = new Date(due + "T00:00:00"); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((d.getTime() - now.getTime()) / 86400000); }
const KEY = "aos.learn.lcm.v2";

export function LearningCentreApp({ scope = "company" }: { scope?: "company" | "franchise" }) {
  const isCo = scope === "company";
  const { settings } = useSettings();
  const [tab, setTab] = useState<"cat" | "assign" | "comp" | "cert" | "docs">("cat");
  const [help, setHelp] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>(SEED_ASSIGNMENTS);
  const [courses, setCourses] = useState<CourseDoc[]>(SEED_LIBRARY);
  const [player, setPlayer] = useState<CourseDoc | null>(null);
  const [editing, setEditing] = useState<CourseDoc | null>(null);
  const [insight, setInsight] = useState<CourseDoc | null>(null);
  const [op, setOp] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const CKEY = "aos.learn.courses.v10";
  const companyName = settings.providerName || settings.billing?.businessName || "Your company";
  const isPlatform = (id: string) => id in COURSE_META;
  const catOf = (c: CourseDoc): CatKey => COURSE_META[c.id]?.cat ?? catKeyOf(c.category);
  // roles/job-titles come from Setup (permission roles + job titles) — only the ones added there show
  const roleOptions = useMemo(() => { const rs = [...(settings.roles ?? []).map((r) => r.name), ...(settings.staffRoles ?? [])].filter(Boolean); return rs.length ? Array.from(new Set(rs)) : FALLBACK_ROLES; }, [settings]);

  // Catalogue browse controls
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<CatKey | "all">("all");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [subTab, setSubTab] = useState<"platform" | "company">("platform");
  const [companyCatFilter, setCompanyCatFilter] = useState<string>("all");
  const [progress, setProgress] = useState<Record<string, { pct: number; passed: boolean }>>({});
  const [certName, setCertName] = useState("");
  // Documents & Policies
  const ME = "You";
  const [policies, setPolicies] = useState<PolicyDoc[]>(SEED_POLICIES);
  const [acks, setAcks] = useState<PolicyAck[]>(SEED_POLICY_ACKS);
  const [readingDoc, setReadingDoc] = useState<PolicyDoc | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyDoc | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [readConfirm, setReadConfirm] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => { setReadConfirm(false); setReachedEnd(false); setSpeaking(false); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, [readingDoc]);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  // render an attached PDF via a Blob URL (data: URLs are unreliable in <iframe> PDF viewers)
  useEffect(() => {
    if (!readingDoc?.fileData) { setPdfUrl(null); return; }
    try {
      const [meta, b64] = readingDoc.fileData.split(",");
      const mime = /:(.*?);/.exec(meta)?.[1] || "application/pdf";
      const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      setPdfUrl(url); return () => URL.revokeObjectURL(url);
    } catch { setPdfUrl(null); }
  }, [readingDoc]);
  const speakPolicy = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || !readingDoc) return;
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(readingDoc.body || readingDoc.title); u.lang = "en-GB"; u.rate = 1;
    u.onend = () => { setSpeaking(false); setReachedEnd(true); }; u.onerror = () => setSpeaking(false);
    synth.cancel(); synth.speak(u); setSpeaking(true);
  };
  useEffect(() => { try { setProgress(JSON.parse(localStorage.getItem("aos.learn.progress.v1") || "{}")); } catch { /* ignore */ } }, [player]);
  useEffect(() => { try { setCertName(localStorage.getItem("aos.learn.name") || ""); } catch { /* ignore */ } }, []);

  // Assign modal
  const [aOpen, setAOpen] = useState(false);
  const [aCourse, setACourse] = useState(""); const [aKind, setAKind] = useState<"all" | "roles" | "staff">("all");
  const [aRoles, setARoles] = useState<string[]>([]); const [aStaff, setAStaff] = useState<string[]>([]);
  const [aLocs, setALocs] = useState<string[]>([]); const [aStaffQ, setAStaffQ] = useState(""); const [aDue, setADue] = useState(""); const [aReq, setAReq] = useState(true); const [aVer, setAVer] = useState(0); const [aRenew, setARenew] = useState(0);
  // #3 per-staff record drawer · #5 reminder prefs
  const [recordStaff, setRecordStaff] = useState<Staff | null>(null);
  const [reminders, setReminders] = useState<ReminderPrefs>(DEFAULT_REMINDERS);
  const [remOpen, setRemOpen] = useState(false);
  const setRem = (patch: Partial<ReminderPrefs>) => setReminders((r) => { const n = { ...r, ...patch }; try { localStorage.setItem(RKEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  // Certificates / credentials oversight
  const cred = useCredentials(SEED_STAFF);
  const [certEdit, setCertEdit] = useState<CredRecord | null>(null);
  const [certCell, setCertCell] = useState<{ staff: string; typeId: string } | null>(null);
  const [credTypeFilter, setCredTypeFilter] = useState<string>("all");
  const [credStatusFilter, setCredStatusFilter] = useState<CredStatus | "all">("all");
  const [certExportOpen, setCertExportOpen] = useState(false);
  const router = useRouter();

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s?.assignments) setAssignments(s.assignments); } catch { /* ignore */ } try { const c = JSON.parse(localStorage.getItem(CKEY) || "null"); if (Array.isArray(c) && c.length) setCourses(c); } catch { /* ignore */ } try { const p = JSON.parse(localStorage.getItem(PKEY) || "null"); if (p?.policies) setPolicies(p.policies); if (p?.acks) setAcks(p.acks); } catch { /* ignore */ } try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (r) setReminders({ ...DEFAULT_REMINDERS, ...r }); } catch { /* ignore */ } }, []);
  const persistA = (a: Assignment[]) => { setAssignments(a); try { localStorage.setItem(KEY, JSON.stringify({ assignments: a })); } catch { /* ignore */ } };
  const persistP = (pol: PolicyDoc[], ak: PolicyAck[]) => { setPolicies(pol); setAcks(ak); try { localStorage.setItem(PKEY, JSON.stringify({ policies: pol, acks: ak })); } catch { /* ignore */ } };
  const savePolicy = (p: PolicyDoc) => { persistP(policies.some((x) => x.id === p.id) ? policies.map((x) => (x.id === p.id ? p : x)) : [...policies, p], acks); setPolicyForm(null); flash("✅ Policy saved"); };
  const deletePolicy = (id: string) => { if (typeof window !== "undefined" && !window.confirm("Delete this policy? This can't be undone.")) return; persistP(policies.filter((x) => x.id !== id), acks.filter((a) => a.docId !== id)); flash("Policy deleted"); };
  const confirmRead = (doc: PolicyDoc) => { if (!acks.some((a) => a.docId === doc.id && a.staff === ME)) persistP(policies, [...acks, { docId: doc.id, staff: ME, date: todayISO() }]); setReadingDoc(null); flash("✅ Confirmed — thank you"); };
  const myPending = policies.filter((p) => !acks.some((a) => a.docId === p.id && a.staff === ME));
  const persistCourses = (list: CourseDoc[]) => { setCourses(list); try { localStorage.setItem(CKEY, JSON.stringify(list)); } catch { /* ignore */ } };
  const saveCourse = (c: CourseDoc) => { persistCourses(courses.some((x) => x.id === c.id) ? courses.map((x) => (x.id === c.id ? c : x)) : [...courses, c]); setEditing(null); flash("✅ Course saved"); };
  const newCourse = () => setEditing({ ...blankCourse("c" + Date.now().toString(36)), pass: settings.learning?.passMark ?? 80, renewMonths: settings.learning?.renewMonths ?? 0 });
  const requireConfirm = settings.learning?.requirePolicyConfirm ?? true;
  const deleteCourse = (id: string) => { if (typeof window !== "undefined" && !window.confirm("Delete this course? This can't be undone.")) return; persistCourses(courses.filter((x) => x.id !== id)); flash("Course deleted"); };
  const courseMins = (c: CourseDoc) => c.lessons.reduce((n, l) => n + l.mins, 0);
  const setQuizVersion = (id: string, v: number) => { persistCourses(courses.map((c) => (c.id === id ? { ...c, activeQuiz: v } : c))); flash(`✅ Quiz set to ${QUIZ_VERSION_LABELS[v]}`); };
  const titleOf = (id: string) => courses.find((c) => c.id === id)?.title ?? id;
  const assignmentsFor = (id: string) => assignments.filter((a) => a.course === id);
  const removeAssignment = (idx: number) => persistA(assignments.filter((_, i) => i !== idx));

  const shownCourses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (levelFilter !== "all" && metaOf(c.id).level !== levelFilter) return false;
      if (needle && !(`${c.title} ${c.blurb} ${metaOf(c.id).tags.join(" ")}`.toLowerCase().includes(needle))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, q, levelFilter]);
  const platformByCat = useMemo(() => {
    const map = new Map<CatKey, CourseDoc[]>();
    CATEGORIES.forEach((c) => map.set(c.key, []));
    shownCourses.filter((c) => isPlatform(c.id) && (catFilter === "all" || catOf(c) === catFilter)).forEach((c) => map.get(catOf(c))!.push(c));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownCourses, catFilter]);
  const companyAll = useMemo(() => shownCourses.filter((c) => !isPlatform(c.id)), [shownCourses]);
  const companyCats = useMemo(() => Array.from(new Set(companyAll.map((c) => (c.category || "Uncategorised")))), [companyAll]);
  const companyCourses = useMemo(() => companyCatFilter === "all" ? companyAll : companyAll.filter((c) => (c.category || "Uncategorised") === companyCatFilter), [companyAll, companyCatFilter]);
  const assignedStaffN = useMemo(() => { const s = new Set<string>(); if (assignments.some((a) => a.kind === "all")) SEED_STAFF.forEach((x) => s.add(x.name)); assignments.forEach((a) => a.kind === "staff" && a.staff.forEach((n) => s.add(n))); return s.size; }, [assignments]);
  const overdueN = SEED_STAFF.filter((x) => x.sg === "Overdue" || x.fa === "Overdue").length;
  const overduePct = SEED_STAFF.length ? Math.round((overdueN / SEED_STAFF.length) * 100) : 0;
  const avgScore = useMemo(() => { const v = SEED_STAFF.map((x) => x.sgq).filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; }, []);
  // per-course average score (illustrative until Amir's backend supplies real quiz scores)
  const courseScore = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff; return 62 + (h % 38); };
  const ranked = useMemo(() => courses.map((c) => ({ c, s: courseScore(c.id) })).sort((a, b) => b.s - a.s), [courses]);
  // "Assigned to me" = courses assigned to everyone (the current admin is also a staff member)
  const myCourses = useMemo(() => courses.filter((c) => assignments.some((a) => a.course === c.id && a.kind === "all")), [courses, assignments]);

  const staff = useMemo(() => isCo ? (op === "all" ? SEED_STAFF : SEED_STAFF.filter((s) => s.op === op)) : SEED_STAFF.filter((s) => s.op === "Milton Keynes"), [isCo, op]);
  const compN = staff.filter((s) => s.sg === "Complete").length;
  const overN = staff.filter((s) => s.sg === "Overdue" || s.fa === "Overdue").length;
  const certAttN = staff.filter((s) => s.pfa === "Expiring" || s.pfa === "Expired" || s.dbs === "Pending").length;
  // ——— Activity feed: a narrative of learning activity, derived live from the data ———
  const feed = useMemo(() => {
    const ev: { icon: string; tone: string; head: string; meta: string }[] = [];
    if (overdueN > 0) ev.push({ icon: "⏰", tone: "#c0392b", head: `${overdueN} training overdue`, meta: `${overduePct}% of assigned staff have missed a deadline` });
    assignments.slice(-3).reverse().forEach((a) => ev.push({ icon: "📌", tone: "#1d3a8f", head: `${titleOf(a.course)} assigned to ${targetLabel(a)}`, meta: a.due && a.due !== "—" ? `Due ${a.due} · ${a.required ? "Required" : "Optional"}` : a.required ? "Required" : "Optional" }));
    Object.entries(progress).filter(([, p]) => p.passed).slice(0, 3).forEach(([id]) => ev.push({ icon: "✅", tone: "#0f7a43", head: `${titleOf(id)} completed`, meta: "Passed the end-of-course quiz" }));
    assignments.forEach((a) => { const dl = daysLeft(a.due); if (dl == null) return; if (dl < 0) ev.push({ icon: "⏰", tone: "#c0392b", head: `${titleOf(a.course)} has expired`, meta: `Renew for ${targetLabel(a)}` }); else if (dl <= 30) ev.push({ icon: "🔄", tone: "#b45309", head: `${titleOf(a.course)} due in ${dl} day${dl === 1 ? "" : "s"}`, meta: `${targetLabel(a)} — ${a.renewMonths ? "renewal" : "deadline"} approaching` }); });
    if (requireConfirm) policies.forEach((p) => { if (!p.required) return; const left = SEED_STAFF.length - SEED_STAFF.filter((s) => acks.some((a) => a.docId === p.id && a.staff === s.name)).length; if (left > 0) ev.push({ icon: "📄", tone: "#1d3a8f", head: `${p.title} — ${left} still to confirm`, meta: "Required policy" }); });
    if (certAttN > 0) ev.push({ icon: "🎖", tone: "#b7791f", head: `${certAttN} certificate${certAttN === 1 ? "" : "s"} need attention`, meta: "DBS or Paediatric First Aid due — see Certificates" });
    return ev.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, progress, overdueN, overduePct, certAttN, policies, acks, requireConfirm]);

  const openAssign = (courseId: string) => { const cid = courseId || courses[0]?.id || ""; setACourse(cid); setAKind("all"); setARoles([]); setAStaff([]); setALocs([]); setAStaffQ(""); setADue(""); setAReq(true); setARenew(courses.find((c) => c.id === cid)?.renewMonths ?? settings.learning?.renewMonths ?? 0); setAVer(courses.find((c) => c.id === cid)?.activeQuiz ?? 0); setAOpen(true); };
  // courses a given staff member is on (all-staff assignments, their job-role, or named)
  const coursesForStaff = (s: Staff) => assignments.filter((a) => a.kind === "all" || (a.kind === "roles" && a.roles.some((r) => r.toLowerCase().includes(s.role.toLowerCase()) || s.role.toLowerCase().includes(r.split(" ")[0].toLowerCase()))) || (a.kind === "staff" && a.staff.includes(s.name)));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const saveAssign = () => {
    if (!aCourse) return;
    const a: Assignment = { course: aCourse, title: titleOf(aCourse), kind: aKind, roles: aRoles, staff: aStaff, locs: aLocs, due: aDue || "—", required: aReq, version: aVer, renewMonths: aRenew || undefined };
    persistA([...assignments, a]);
    if (aVer !== (courses.find((c) => c.id === aCourse)?.activeQuiz ?? 0)) setQuizVersion(aCourse, aVer);
    setAOpen(false);
    flash(`✅ Assigned to ${targetLabel(a)} — they'll be notified`);
  };
  const remind = (a: Assignment) => flash(`🔔 Reminder sent to ${targetLabel(a)} and to admin`);
  // Quick-assign every course in a set to all staff as OPTIONAL; courses already set Required stay compulsory (not overridden).
  const quickAssignAll = (which: "platform" | "company" | "both") => {
    const set = courses.filter((c) => which === "both" ? true : which === "platform" ? isPlatform(c.id) : !isPlatform(c.id));
    let added = 0, keptReq = 0, already = 0;
    const next = [...assignments];
    set.forEach((c) => {
      const has = assignments.filter((a) => a.course === c.id);
      if (has.some((a) => a.required)) { keptReq++; return; }
      if (has.some((a) => a.kind === "all" && !a.required)) { already++; return; }
      next.push({ course: c.id, title: c.title, kind: "all", roles: [], staff: [], locs: [], due: "—", required: false, version: c.activeQuiz ?? 0 });
      added++;
    });
    persistA(next);
    flash(`✅ ${added} set optional for all staff · ${keptReq} kept compulsory (not overridden) · ${already} already optional`);
  };

  const courseCard = (c: CourseDoc) => {
    const m = metaOf(c.id);
    const aq = activeQuizVersion(c);
    const asn = assignmentsFor(c.id);
    const pr = progress[c.id];
    const mine = myCourses.some((x) => x.id === c.id);
    const cat = CAT_BY_KEY[catOf(c)] ?? CATEGORIES[0];
    const catLabel = !isPlatform(c.id) && c.category ? c.category : cat.label;
    return (
      <div key={c.id} className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(16,32,90,.5)]">
        <div className="h-1.5 w-full" style={{ background: cat.grad }} />
        <div className="flex gap-3 p-3.5">
          <button type="button" onClick={() => setPlayer(c)} title="Preview course" className="flex-none self-start transition-transform group-hover:scale-[1.03]"><CourseCover cover={c.cover} catKey={catOf(c)} size={64} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => setPlayer(c)} className="min-w-0 flex-1 text-left"><div className="text-[14.5px] font-extrabold leading-tight text-[var(--ink)]">{c.title}</div></button>
              <Badge text={m.level} tone={LEVEL_TONE[m.level]} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: cat.soft, color: cat.ink }}>{cat.icon} {catLabel}</span>
              <span className="text-[11px] text-[var(--ink-3)]">{c.lessons.length} lessons · ~{courseMins(c)} min{aq.qs.length > 0 ? ` · ${aq.qs.length}-Q quiz` : ""} · 🔊</span>
            </div>
            {c.blurb && <div className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-[var(--ink-2)]">{c.blurb}</div>}
            {asn.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {asn.map((a) => <span key={assignments.indexOf(a)} className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold " + (a.required ? "bg-[#fdecec] text-[#c0392b]" : "bg-[#eef1f6] text-[#5f6076]")}>{a.required ? "Required" : "Optional"}: {targetLabel(a)}{a.due !== "—" ? ` · by ${a.due}` : ""}<button type="button" title="Remove assignment" onClick={() => removeAssignment(assignments.indexOf(a))} className="hover:text-[#c0392b]">×</button></span>)}
              </div>
            ) : <div className="mt-1.5 text-[10.5px] font-semibold text-[var(--ink-3)]">Optional — not assigned to anyone yet</div>}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Button variant="primary" onClick={() => setPlayer(c)}>{mine ? (pr?.passed ? "✓ Review" : pr?.pct ? "▶ Continue" : "▶ Start") : "Preview"}</Button>
              <Button onClick={() => setEditing(c)}>Edit</Button>
              <button type="button" onClick={() => deleteCourse(c.id)} title="Delete course" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]">🗑</button>
              <Button onClick={() => openAssign(c.id)}>Assign</Button>
              <button type="button" onClick={() => setInsight(c)} title="Insights — scores, best-answered & topics to revisit" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-3)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]">📊</button>
              {(isPlatform(c.id) || (c.quizzes?.length ?? 0) > 1) && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--panel)] p-0.5" title="Live end-of-course quiz version — Assign lets you set a version per group">
                  {Array.from({ length: quizVersions(c).length }).map((_, v) => (
                    <button key={v} type="button" onClick={() => setQuizVersion(c.id, v)} className={"rounded-full px-2 py-0.5 text-[10.5px] font-extrabold transition-colors " + (aq.idx === v ? "bg-[#6d28d9] text-white" : "text-[var(--ink-3)] hover:text-[#6d28d9]")}>V{v + 1}</button>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OpSelect = isCo ? (
    <div className="mb-3 text-[12.5px] font-semibold text-[var(--ink-2)]">Location <Select value={op} onChange={(e) => setOp(e.target.value)} className="ml-1 max-w-[260px] align-middle">{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
  ) : <div className="mb-3 text-[12.5px] text-[var(--ink-3)]">Scope: <b className="text-[var(--ink-2)]">Milton Keynes</b> (your franchise)</div>;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Learning Centre" icon="🎓" lede={`Courses, quizzes, assignments, completion & certificates — ${isCo ? "your company" : "your franchise"}`} />

      <Card className="mb-3 overflow-hidden">
        <button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">ⓘ</span><span className="text-[14px] font-extrabold text-[var(--ink)]">How it works</span><span className="ml-auto text-[12px] text-[var(--ink-3)]">{help ? "▲" : "▼"}</span></button>
        {help && <ul className="ml-9 list-disc space-y-1 px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]"><li><b>Catalogue</b> — two folders: <b>Platform courses</b> (ready-made, in category sub-folders) and <b>{companyName} courses</b> (build your own). Preview, edit, set the live end-of-course quiz version (V1/V2/V3), and <b>Assign</b>.</li><li><b>Assign</b> — to <b>all staff</b>, to <b>job roles</b> (e.g. Lifeguard) or to <b>named staff</b> (tick several), with a Complete-by date, Required or Optional, and which quiz version that group gets. Staff and admins are notified until it's complete. Assigned courses show a <b>Start / Continue</b> button to the staff they're set for.</li><li><b>Completion</b> — a live picture of who's done their training, with quiz scores.</li><li><b>Certificates</b> — the DBS / First-Aid record. Staff upload theirs in their own Learning Centre; this is the single record.</li>{isCo && <li>The <b>Location</b> dropdown scopes Completion &amp; Certificates across all your sites and franchises.</li>}</ul>}
      </Card>

      <Card className="p-0">
        <div className="flex gap-1 border-b border-[var(--line)] px-3 pt-2">
          {([["cat", "Catalogue"], ["assign", "Assignments"], ["comp", "Completion"], ["docs", "Policies"], ["cert", "Certificates"]] as const).map(([t, l]) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={"relative px-3.5 py-2.5 text-[13.5px] font-bold transition-colors " + (tab === t ? "text-[#1d3a8f]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}{tab === t && <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-[#1d3a8f]" />}</button>
          ))}
        </div>
        <div className="p-4">
          {/* Catalogue */}
          {tab === "cat" && (<>
            {/* Activity feed — the narrative lead */}
            {feed.length > 0 && (
              <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <div className="mb-2.5 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">📣</span><span className="text-[13px] font-extrabold text-[var(--ink)]">Recent activity</span></div>
                <div className="flex flex-col gap-2.5">
                  {feed.map((e, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-[14px]" style={{ background: e.tone + "1a", color: e.tone }}>{e.icon}</span>
                      <div className="min-w-0"><div className="text-[13px] font-semibold leading-snug text-[var(--ink)]">{e.head}</div><div className="text-[11.5px] text-[var(--ink-3)]">{e.meta}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* At-a-glance stats */}
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[[String(courses.length), "total courses", "#1d3a8f"], [String(assignedStaffN), "staff assigned to a course", "#0f7a43"], [`${overdueN} · ${overduePct}%`, "not met deadline", "#c0392b"], [`${avgScore}%`, "avg quiz score", "#6d28d9"]].map(([n, l, col], i) => (
                <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5"><div className="text-[20px] font-extrabold tabular-nums" style={{ color: col }}>{n}</div><div className="text-[11px] text-[var(--ink-3)]">{l}</div></div>
              ))}
            </div>

            {/* Assigned to you — personal learning only appears for courses assigned to you */}
            {myCourses.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#bcd0f5] bg-[#eef4fd] p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-none"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">🎯 Your training — {myCourses.length} course{myCourses.length === 1 ? "" : "s"} assigned to you</div><div className="text-[12px] text-[var(--ink-3)]">{myCourses.filter((c) => progress[c.id]?.passed).length}/{myCourses.length} complete</div></div>
                  <div className="min-w-[120px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#0f9d58] transition-all" style={{ width: `${Math.round((myCourses.filter((c) => progress[c.id]?.passed).length / myCourses.length) * 100)}%` }} /></div></div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {myCourses.map((c) => { const pr = progress[c.id]; const st = pr?.passed ? "Complete" : pr && pr.pct > 0 ? "In progress" : "Not started"; const a = assignments.find((x) => x.course === c.id && x.kind === "all"); const dl = a ? daysLeft(a.due) : null; return (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-[var(--ink)]">{c.title}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">⏱ ~{courseMins(c)} min{a && a.due !== "—" ? ` · deadline ${a.due}` : ""}{dl != null ? (dl < 0 ? ` · ${-dl} day${dl === -1 ? "" : "s"} overdue` : ` · ${dl} day${dl === 1 ? "" : "s"} to complete`) : ""}</div>
                      </div>
                      <Badge text={st} />
                      <button type="button" onClick={() => setPlayer(c)} className="flex-none rounded-full bg-[#1d3a8f] px-3.5 py-1 text-[12px] font-extrabold text-white hover:brightness-110">{pr?.passed ? "Review" : pr && pr.pct > 0 ? "▶ Continue" : "▶ Start"}</button>
                    </div>
                  ); })}
                </div>
              </div>
            )}

            {/* Your certificates */}
            {courses.some((c) => progress[c.id]?.passed) && (
              <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f7a43]">🎓 Your certificates</span>
                  <input value={certName} onChange={(e) => { setCertName(e.target.value); try { localStorage.setItem("aos.learn.name", e.target.value); } catch { /* ignore */ } }} placeholder="Name on certificate" className="ml-auto w-[200px] rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {courses.filter((c) => progress[c.id]?.passed).map((c) => (
                    <button key={c.id} type="button" onClick={() => { const now = new Date(); const rm = c.renewMonths ?? settings.learning?.renewMonths ?? 0; const exp = rm ? new Date(now.getFullYear(), now.getMonth() + rm, now.getDate()) : null; const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); openCertificate({ name: certName || "Team member", course: c.title, pct: progress[c.id]?.pct ?? 100, date: fmt(now), expiry: exp ? fmt(exp) : undefined, provider: companyName, logo: settings.learning?.certLogo === false ? undefined : c.logo, ref: makeRef(c.title + certName + fmt(now)), signImg: settings.learning?.certSignature, signName: settings.learning?.certSignatory, signRole: settings.learning?.certSignatoryRole, accent: settings.learning?.certColor, title: settings.learning?.certTitle || undefined, showScore: settings.learning?.certShowScore, showQr: settings.learning?.certShowQr }, settings.learning?.certTemplate); }} title="Download certificate (PDF)" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#0f7a43] hover:text-[#0f7a43]">🖨️ {c.title}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Create + search */}
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={newCourse}>+ New {companyName} course</Button>
              <div className="ml-auto flex items-center gap-1.5">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search courses…" className="w-[210px]" />
                <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as Level | "all")} className="max-w-[130px]"><option value="all">All levels</option><option value="Intro">Intro</option><option value="Core">Core</option><option value="Advanced">Advanced</option></Select>
              </div>
            </div>


            {/* Folder tabs: Platform ↔ Company (flick between) */}
            <div className="mb-3 inline-flex flex-wrap gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
              {([["platform", "📚 Platform courses", shownCourses.filter((c) => isPlatform(c.id)).length], ["company", `🏢 ${companyName} courses`, companyCourses.length]] as const).map(([k, l, n]) => (
                <button key={k} type="button" onClick={() => setSubTab(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (subTab === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l} ({n})</button>
              ))}
            </div>

            {subTab === "platform" && (<>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setCatFilter("all")} className={"rounded-full border px-3 py-1 text-[12px] font-bold transition-colors " + (catFilter === "all" ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>All ({courses.filter((c) => isPlatform(c.id)).length})</button>
                {CATEGORIES.map((cat) => {
                  const n = courses.filter((c) => isPlatform(c.id) && catOf(c) === cat.key).length;
                  if (n === 0) return null;
                  const on = catFilter === cat.key;
                  return <button key={cat.key} type="button" onClick={() => setCatFilter(on ? "all" : cat.key)} className={"rounded-full border px-3 py-1 text-[12px] font-bold transition-colors " + (on ? "border-transparent text-white" : "border-[var(--line)] hover:border-current")} style={on ? { background: cat.ink } : { color: cat.ink }}>{cat.icon} {cat.label.split(" & ")[0]} ({n})</button>;
                })}
              </div>
              {shownCourses.filter((c) => isPlatform(c.id) && (catFilter === "all" || catOf(c) === catFilter)).length === 0 && <p className="mb-4 rounded-xl bg-[var(--panel)] px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">No platform courses match. <button type="button" onClick={() => { setQ(""); setCatFilter("all"); setLevelFilter("all"); }} className="font-bold text-[#1d3a8f] underline">Clear filters</button></p>}
              {CATEGORIES.map((cat) => {
                const list = platformByCat.get(cat.key) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={cat.key} className="mb-4 ml-1 border-l-2 pl-3" style={{ borderColor: cat.soft }}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="grid h-6 w-6 flex-none place-items-center rounded-lg text-[13px]" style={{ background: cat.soft }}>{cat.icon}</span>
                      <h3 className="text-[12.5px] font-extrabold" style={{ color: cat.ink }}>{cat.label}</h3>
                      <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)]">{list.length}</span>
                      <span className="ml-1 h-px flex-1 bg-[var(--line)]" />
                    </div>
                    <div className="grid gap-2.5 lg:grid-cols-2">{list.map((c) => courseCard(c))}</div>
                  </div>
                );
              })}
            </>)}

            {subTab === "company" && (<>
              <p className="mb-3 rounded-xl bg-[#f3effe] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#5b21b6]">Build your own bespoke courses — add lessons with <b>videos</b>, <b>images</b> and your <b>logo</b>, plus a <b>final quiz</b>. Kept separate from the platform library, with your own categories.</p>
              {companyCats.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setCompanyCatFilter("all")} className={"rounded-full border px-3 py-1 text-[12px] font-bold transition-colors " + (companyCatFilter === "all" ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>All ({companyAll.length})</button>
                  {companyCats.map((cc) => { const n = companyAll.filter((c) => (c.category || "Uncategorised") === cc).length; const on = companyCatFilter === cc; return <button key={cc} type="button" onClick={() => setCompanyCatFilter(on ? "all" : cc)} className={"rounded-full border px-3 py-1 text-[12px] font-bold transition-colors " + (on ? "border-transparent bg-[#c2410c] text-white" : "border-[var(--line)] text-[#c2410c] hover:border-current")}>{cc} ({n})</button>; })}
                </div>
              )}
              {companyCourses.length === 0 ? (
                <div className="mb-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center">
                  <div className="text-[13px] font-semibold text-[var(--ink-2)]">No {companyName} courses yet</div>
                  <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">Create one and add videos, images, your logo and a final quiz.</div>
                  <div className="mt-3"><Button variant="primary" onClick={newCourse}>+ Create a course</Button></div>
                </div>
              ) : (
                <div className="mb-4 grid gap-2.5 lg:grid-cols-2">{companyCourses.map((c) => courseCard(c))}</div>
              )}
            </>)}
          </>)}

          {/* Assignments */}
          {tab === "assign" && (<>
            <div className="mb-3 flex flex-wrap items-center gap-2"><Button variant="primary" onClick={() => openAssign("")}>+ New assignment</Button><span className="text-[11.5px] text-[var(--ink-3)]">Assign to all staff, to roles/job titles (e.g. Lifeguard) or to named staff. Staff — and admins — get notified until it's complete.</span></div>
            {/* Quick-assign whole sets */}
            <div className="mb-3 rounded-xl border border-[#bcd0f5] bg-[#eef4fd] p-3.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">⚡ Quick assign to all staff (optional)</div>
              <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">Make a whole set available to everyone as optional. Any course already set <b>compulsory</b> is kept as-is and not overridden.</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button onClick={() => quickAssignAll("platform")}>Platform courses</Button>
                <Button onClick={() => quickAssignAll("company")}>{companyName} courses</Button>
                <Button variant="primary" onClick={() => quickAssignAll("both")}>All courses</Button>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {assignments.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-[var(--ink)]">{a.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--ink-3)]"><Badge text={a.required ? "Required" : "Optional"} /><span>{targetLabel(a)}</span><span>·</span><span>due {a.due}</span><span>·</span><span>Quiz {QUIZ_VERSION_LABELS[a.version] ?? "Version 1"}</span>{a.renewMonths ? <><span>·</span><span className="font-semibold text-[#6d28d9]">🔄 Renews {a.renewMonths === 12 ? "yearly" : a.renewMonths === 24 ? "every 2 yrs" : a.renewMonths === 36 ? "every 3 yrs" : `every ${a.renewMonths}mo`}</span></> : null}{(() => { const dl = daysLeft(a.due); if (dl == null) return null; if (dl < 0) return <><span>·</span><span className="font-bold text-[#c0392b]">Expired</span></>; if (dl <= 30) return <><span>·</span><span className="font-bold text-[#b45309]">Due in {dl}d</span></>; return null; })()}{a.locs.length > 0 && <><span>·</span><span>{a.locs.map((v) => OPS.find((o) => o[0] === v)?.[1]).join(", ")}</span></>}</div>
                  </div>
                  <Button onClick={() => remind(a)}>🔔 Remind</Button>
                  <button type="button" title="Remove assignment" onClick={() => removeAssignment(i)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]">🗑</button>
                </div>
              ))}
              {assignments.length === 0 && <p className="rounded-xl bg-[var(--panel)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No assignments yet — create one above.</p>}
            </div>
          </>)}

          {/* Completion */}
          {tab === "comp" && (<>
            {OpSelect}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => downloadCSV(`training-report-${todayISO()}.csv`, ["Staff", "Location", "Role", "Safeguarding", "S/G quiz %", "First aid", "DBS", "Paediatric First Aid"], staff.map((s) => [s.name, s.op, s.role, s.sg, s.sgq ?? "", s.fa, s.dbs, s.pfa]))}>⬇ Export CSV</Button>
              <Button onClick={() => setRemOpen((v) => !v)}>🔔 Reminders</Button>
              <span className="text-[11.5px] text-[var(--ink-3)]">Tip: click a staff name below for their full record.</span>
            </div>
            {remOpen && (
              <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <div className="mb-1 text-[12px] font-extrabold text-[var(--ink)]">🔔 Automated reminders</div>
                <p className="mb-2.5 text-[11px] text-[var(--ink-3)]">Choose when staff and admins are chased. Emails and in-app alerts are sent by your platform.</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {([["courseDue", "Course due soon — remind the learner"], ["overdueChase", "Overdue — chase the learner + admin"], ["renewalDue", "Renewal due — annual refresher reminder"], ["unreadPolicy", "Unread policy — remind until confirmed"], ["weeklyDigest", "Weekly summary to the manager"]] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={reminders[k]} onChange={(e) => setRem({ [k]: e.target.checked } as Partial<ReminderPrefs>)} /> {l}</label>
                  ))}
                  <label className="flex items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] font-semibold text-[var(--ink-2)]">Digest day<Select value={reminders.digestDay} onChange={(e) => setRem({ digestDay: e.target.value })} className="ml-auto max-w-[130px]">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => <option key={d} value={d}>{d}</option>)}</Select></label>
                </div>
              </div>
            )}
            <div className="mb-3 flex flex-wrap gap-2.5">
              {[[String(staff.length), "staff in scope", "var(--ink)"], [String(compN), "safeguarding complete", "#0f7a43"], [String(overN), "overdue", "#c0392b"]].map(([n, l, c], i) => (
                <div key={i} className="min-w-[130px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5"><div className="text-[22px] font-extrabold tabular-nums" style={{ color: c }}>{n}</div><div className="text-[11px] text-[var(--ink-3)]">{l}</div></div>
              ))}
            </div>
            {/* Top & bottom courses by average score */}
            <div className="mb-3 grid gap-2.5 md:grid-cols-2">
              {([["🏆 Top 5 courses — highest average score", ranked.slice(0, 5), "#0f7a43"], ["⚠ Bottom 5 — need revisiting & retraining", ranked.slice(-5).reverse(), "#c0392b"]] as const).map(([title, list, col], i) => (
                <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                  <div className="mb-2 text-[12px] font-extrabold" style={{ color: col }}>{title}</div>
                  <div className="flex flex-col gap-1.5">
                    {list.map(({ c, s }) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]">{c.title}</span>
                        <div className="h-1.5 w-16 flex-none overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${s}%`, background: col }} /></div>
                        <span className="w-9 flex-none text-right text-[12px] font-extrabold tabular-nums" style={{ color: col }}>{s}%</span>
                        <button type="button" onClick={() => setInsight(c)} title="View course insights" className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#1d3a8f]">📊</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Individual focus areas */}
            <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="text-[12px] font-extrabold text-[#1d3a8f]">🎯 Individual focus — strengths &amp; areas to practise</div>
              <div className="mb-2 text-[11px] text-[var(--ink-3)]">Illustrative from quiz scores — the full per-question breakdown per person appears once answers are recorded (backend).</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {staff.map((s) => (
                  <div key={s.name} className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px]"><b className="text-[var(--ink)]">{s.name}</b> <span className="text-[var(--ink-3)]">— strong at <span className="font-semibold text-[#0f7a43]">{ranked[0]?.c.title}</span>; practise <span className="font-semibold text-[#c0392b]">{ranked[ranked.length - 1]?.c.title}</span></span></div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th><th className="px-3 py-2.5 font-extrabold">Role</th><th className="px-3 py-2.5 font-extrabold">Safeguarding</th><th className="px-3 py-2.5 font-extrabold">S/G quiz</th><th className="px-3 py-2.5 font-extrabold">First aid</th></tr></thead>
                <tbody>{staff.map((s) => (
                  <tr key={s.name} onClick={() => setRecordStaff(s)} className="cursor-pointer border-t border-[var(--line-2,#eef2f8)] hover:bg-[var(--panel)]"><td className="px-3 py-2.5 font-bold text-[#1d3a8f]">{s.name}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.role}</td><td className="px-3 py-2.5"><Badge text={s.sg} /></td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{s.sgq != null ? `${s.sgq}%` : "—"}</td><td className="px-3 py-2.5"><Badge text={s.fa} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          </>)}

          {/* Certificates — credential oversight */}
          {tab === "cert" && (<>
            {OpSelect}
            {(() => {
              const visTypes = credTypeFilter === "all" ? cred.types : cred.types.filter((t) => t.id === credTypeFilter);
              const cells = staff.flatMap((s) => cred.types.map((t) => ({ req: t.required, applies: appliesTo(t, s.name, s.role), st: credStatus(cred.recordFor(s.name, t.id)) })));
              const cnt = (st: CredStatus) => st === "Missing" ? cells.filter((c) => c.st === "Missing" && c.req && c.applies).length : cells.filter((c) => c.st === st).length;
              const rows = staff.filter((s) => credStatusFilter === "all" || visTypes.some((t) => { const st = credStatus(cred.recordFor(s.name, t.id)); if (st !== credStatusFilter) return false; return credStatusFilter === "Missing" ? t.required && appliesTo(t, s.name, s.role) : true; }));
              const csv = () => downloadCSV(`credentials-${todayISO()}.csv`, ["Staff", "Location", ...cred.types.map((t) => t.name)], staff.map((s) => [s.name, s.op, ...cred.types.map((t) => credStatus(cred.recordFor(s.name, t.id)))]));
              return (<>
                <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">Staff upload &amp; renew certificates in <b className="text-[var(--ink-2)]">their own area</b>; this is the single verified record. Click a cell to view, verify or add on their behalf.</p>
                <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {([["Expiring", "expiring soon", "#b45309", "#fdf3e0", "⏳"], ["Expired", "expired", "#c0392b", "#fdeceb", "⛔"], ["Pending", "to verify", "#1d54c4", "#eaf1ff", "🔎"], ["Missing", "required missing", "#5b6577", "#eef1f6", "➖"]] as const).map(([st, lbl, col, bg, icon]) => { const on = credStatusFilter === st; return (
                    <button key={st} type="button" onClick={() => setCredStatusFilter(on ? "all" : st)} className={"flex items-center gap-3 rounded-2xl border border-transparent px-3.5 py-3 text-left transition-all " + (on ? "ring-2 ring-offset-1" : "hover:-translate-y-0.5 hover:shadow-md")} style={{ background: bg, ...(on ? ({ "--tw-ring-color": col } as React.CSSProperties) : {}) }}><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/70 text-[17px]">{icon}</span><div><div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: col }}>{cnt(st)}</div><div className="mt-0.5 text-[11px] font-semibold" style={{ color: col }}>{lbl}</div></div></button>
                  ); })}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Button onClick={() => setCertExportOpen((v) => !v)}>⬇ Export ▾</Button>
                    {certExportOpen && (
                      <div className="absolute z-20 mt-1 w-[240px] rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                        {([["CSV (spreadsheet)", () => csv()], ["PDF — register only", () => exportCredsPdf(staff, cred.types, cred.recordFor, companyName, false)], ["PDF — with certificate docs", () => exportCredsPdf(staff, cred.types, cred.recordFor, companyName, true)]] as const).map(([lbl, fn]) => (
                          <button key={lbl} type="button" onClick={() => { fn(); setCertExportOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{lbl}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="primary" onClick={() => setCertEdit(blankRecord(staff[0]?.name ?? "", cred.types[0]?.id ?? ""))}>+ Add certificate</Button>
                  <Select value={credTypeFilter} onChange={(e) => setCredTypeFilter(e.target.value)} className="max-w-[200px]"><option value="all">All credentials</option>{cred.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                  {credStatusFilter !== "all" && <button type="button" onClick={() => setCredStatusFilter("all")} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Clear ✕</button>}
                </div>
                <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th>{visTypes.map((t) => <th key={t.id} title={t.required ? "Required for: " + credTargetLabel(t) : "Optional"} className="px-3 py-2.5 font-extrabold whitespace-nowrap">{t.name}{t.required && <span className="ml-0.5 text-[#c0392b]">*</span>}</th>)}</tr></thead>
                    <tbody>{rows.map((s) => (
                      <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{s.name}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td>{visTypes.map((t) => { const r = cred.recordFor(s.name, t.id); if (!appliesTo(t, s.name, s.role) && !r) return <td key={t.id} className="px-3 py-2 text-[var(--ink-3)]" title="Not required for this staff member">—</td>; return <td key={t.id} className="px-3 py-2"><button type="button" onClick={() => setCertCell({ staff: s.name, typeId: t.id })} className="transition-opacity hover:opacity-70"><CredBadge s={credStatus(r)} /></button></td>; })}</tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={visTypes.length + 2} className="px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No staff match this filter.</td></tr>}</tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--ink-3)]"><span className="text-[#c0392b]">*</span> required. Manage credential types &amp; who they apply to in <button type="button" onClick={() => router.push(`/${scope}/setup?tab=learning#credtypes`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">Setup → Learning</button>.</p>
              </>);
            })()}
          </>)}

          {/* Documents & Policies — read-and-confirm */}
          {tab === "docs" && (<>
            <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">Share policies your team must read. Each person ticks <b>“I have read and understood”</b> and you get a dated record — ideal for Ofsted and inspections.</p>

            {requireConfirm && myPending.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#bcd0f5] bg-[#eef4fd] p-3.5">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">📋 To confirm — {myPending.length} {myPending.length === 1 ? "policy" : "policies"} awaiting you</div>
                <div className="flex flex-col gap-1.5">
                  {myPending.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                      <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{p.title}</div><div className="text-[11px] text-[var(--ink-3)]">{p.required ? "Required" : "Recommended"} · added {fmtDate(p.added)}</div></div>
                      <Button variant="primary" onClick={() => setReadingDoc(p)}>Read &amp; confirm</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2.5 flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">All policies &amp; documents</span><Button variant="primary" className="ml-auto" onClick={() => setPolicyForm(blankPolicy())}>+ Add policy</Button></div>
            <div className="flex flex-col gap-2">
              {policies.map((p) => {
                const done = SEED_STAFF.filter((s) => acks.some((a) => a.docId === p.id && a.staff === s.name));
                const pct = SEED_STAFF.length ? Math.round((done.length / SEED_STAFF.length) * 100) : 0;
                const open = expandedPolicy === p.id;
                return (
                  <div key={p.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{p.title || "Untitled policy"}</span><Badge text={p.required ? "Required" : "Recommended"} /></div>
                        <div className="text-[11px] text-[var(--ink-3)]">{p.category ? p.category + " · " : ""}added {fmtDate(p.added)}</div>
                      </div>
                      <div className="text-right"><div className="text-[14px] font-extrabold tabular-nums text-[var(--ink)]">{done.length}/{SEED_STAFF.length}</div><div className="text-[10.5px] text-[var(--ink-3)]">confirmed</div></div>
                      <div className="flex gap-0.5">
                        <button type="button" title="Read" onClick={() => setReadingDoc(p)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#1d3a8f]">👁</button>
                        <button type="button" title="Edit" onClick={() => setPolicyForm(p)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#1d3a8f]">✏️</button>
                        <button type="button" title="Delete" onClick={() => deletePolicy(p.id)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#0f9d58] transition-all" style={{ width: `${pct}%` }} /></div>
                    <button type="button" onClick={() => setExpandedPolicy(open ? null : p.id)} className="mt-2 text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{open ? "Hide who's confirmed" : "Who's confirmed?"}</button>
                    {open && (
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {SEED_STAFF.map((s) => { const a = acks.find((x) => x.docId === p.id && x.staff === s.name); return (
                          <div key={s.name} className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[12px]"><span className={a ? "text-[#0f7a43]" : "text-[var(--ink-3)]"}>{a ? "✓" : "○"}</span><span className="flex-1 truncate font-semibold text-[var(--ink)]">{s.name}</span><span className="text-[11px] text-[var(--ink-3)]">{a ? fmtDate(a.date) : "Not yet"}</span></div>
                        ); })}
                      </div>
                    )}
                  </div>
                );
              })}
              {policies.length === 0 && <p className="rounded-xl bg-[var(--panel)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No policies yet — add your first with “+ Add policy”.</p>}
            </div>
          </>)}
        </div>
      </Card>

      {/* Assign modal */}
      {aOpen && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setAOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-3 flex items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">Assign course</div><button type="button" onClick={() => setAOpen(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <div className="flex flex-col gap-3">
              <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Course</label><Select value={aCourse} onChange={(e) => { setACourse(e.target.value); setAVer(courses.find((c) => c.id === e.target.value)?.activeQuiz ?? 0); }} className="w-full">{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></div>
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Assign to</label>
                <div className="flex gap-1.5">
                  {([["all", "All staff"], ["roles", "Job roles"], ["staff", "Specific staff"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setAKind(k)} className={"flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-bold transition-colors " + (aKind === k ? "border-[#1d3a8f] bg-[#eef4fd] text-[#1d3a8f]" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{l}</button>
                  ))}
                </div>
              </div>
              {aKind === "roles" && (
                <div className="rounded-xl border border-[var(--line)] p-2.5">
                  <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Tick one or more roles / job titles</div>
                  {roleOptions.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">No roles added yet — add them in Setup → Staff roles &amp; permissions.</div> : (
                    <div className="flex flex-wrap gap-1.5">
                      {roleOptions.map((r) => { const on = aRoles.includes(r); return <button key={r} type="button" onClick={() => setARoles(toggle(aRoles, r))} className={"rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors " + (on ? "border-transparent bg-[#1d3a8f] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[#1d3a8f]")}>{on ? "✓ " : ""}{r}</button>; })}
                    </div>
                  )}
                </div>
              )}
              {aKind === "staff" && (
                <div className="rounded-xl border border-[var(--line)] p-2.5">
                  <div className="mb-1.5 flex items-center gap-2"><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Tick one or more staff</span><Input value={aStaffQ} onChange={(e) => setAStaffQ(e.target.value)} placeholder="🔍 Search names…" className="ml-auto w-[150px]" /></div>
                  <div className="max-h-[180px] overflow-y-auto">
                    {SEED_STAFF.filter((s) => s.name.toLowerCase().includes(aStaffQ.trim().toLowerCase())).map((s) => { const on = aStaff.includes(s.name); return <label key={s.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--panel)]"><input type="checkbox" checked={on} onChange={() => setAStaff(toggle(aStaff, s.name))} /> <b className="font-semibold text-[var(--ink)]">{s.name}</b> <span className="text-[11px] text-[var(--ink-3)]">· {s.role} · {s.op}</span></label>; })}
                    {SEED_STAFF.filter((s) => s.name.toLowerCase().includes(aStaffQ.trim().toLowerCase())).length === 0 && <div className="px-2 py-2 text-[12px] text-[var(--ink-3)]">No staff match “{aStaffQ}”.</div>}
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Locations — tick any (leave blank for all)</label>
                <div className="flex flex-wrap gap-1.5">
                  {OPS.filter(([v]) => v !== "all").map(([v, l]) => { const on = aLocs.includes(v); return <button key={v} type="button" onClick={() => setALocs(toggle(aLocs, v))} className={"rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors " + (on ? "border-transparent bg-[#0f7a43] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[#0f7a43]")}>{on ? "✓ " : ""}{l}</button>; })}
                </div>
              </div>
              {(isPlatform(aCourse) || ((courses.find((c) => c.id === aCourse)?.quizzes?.length ?? 0) > 1)) && (
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Quiz version for this group</label><Select value={aVer} onChange={(e) => setAVer(Number(e.target.value))} className="w-full">{QUIZ_VERSION_LABELS.map((l, v) => <option key={v} value={v}>{l}</option>)}</Select></div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Complete by</label><Input type="date" value={aDue} onChange={(e) => setADue(e.target.value)} className="w-full" /></div>
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Renews every</label><Select value={aRenew} onChange={(e) => setARenew(Number(e.target.value))} className="w-full"><option value={0}>Never</option><option value={6}>6 months</option><option value={12}>12 months (annual)</option><option value={24}>2 years</option><option value={36}>3 years</option></Select></div>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={aReq} onChange={(e) => setAReq(e.target.checked)} /> Required — untick to assign as optional</label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setAOpen(false)}>Cancel</Button><Button variant="primary" onClick={saveAssign} disabled={!aCourse || (aKind === "roles" && aRoles.length === 0) || (aKind === "staff" && aStaff.length === 0)}>Assign &amp; notify</Button></div>
          </div>
        </div>
      )}

      {/* Per-staff learning record */}
      {recordStaff && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[136] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={() => setRecordStaff(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#eef4fd] text-[14px] font-extrabold text-[#1d3a8f]">{recordStaff.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
              <div className="min-w-0 flex-1"><div className="text-[15px] font-extrabold text-[var(--ink)]">{recordStaff.name}</div><div className="text-[12px] text-[var(--ink-3)]">{recordStaff.role} · {recordStaff.op}</div></div>
              <button type="button" title="Export this record" onClick={() => { const s = recordStaff; downloadCSV(`${s.name.replace(/\s+/g, "-")}-record.csv`, ["Field", "Value"], [["Safeguarding", s.sg], ["S/G quiz", s.sgq != null ? `${s.sgq}%` : "—"], ["First aid", s.fa], ["DBS", s.dbs], ["Paediatric First Aid", s.pfa]]); }} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬇</button>
              <button type="button" onClick={() => setRecordStaff(null)} className="text-[18px] leading-none text-[var(--ink-3)]">×</button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {([["Safeguarding", recordStaff.sg, true], ["First aid", recordStaff.fa, true], ["S/G quiz", recordStaff.sgq != null ? `${recordStaff.sgq}%` : "—", false], ["DBS", recordStaff.dbs, true], ["Paediatric First Aid", recordStaff.pfa, true]] as const).map(([l, v, isBadge]) => (
                <div key={l} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{l}</div><div className="mt-1">{isBadge ? <Badge text={v} /> : <span className="text-[13px] font-bold text-[var(--ink)]">{v}</span>}</div></div>
              ))}
            </div>
            <div className="mb-3"><div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Assigned courses</div>
              {coursesForStaff(recordStaff).length ? <div className="flex flex-col gap-1.5">{coursesForStaff(recordStaff).map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]">{titleOf(a.course)}</span><Badge text={a.required ? "Required" : "Optional"} />{a.due !== "—" && <span className="text-[11px] text-[var(--ink-3)]">due {a.due}</span>}{a.renewMonths ? <span title="Renews" className="text-[11px] font-semibold text-[#6d28d9]">🔄</span> : null}</div>
              ))}</div> : <div className="text-[12px] text-[var(--ink-3)]">No courses assigned yet.</div>}
            </div>
            <div className="mb-3"><div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Policies</div>
              <div className="flex flex-col gap-1.5">{policies.map((p) => { const a = acks.find((x) => x.docId === p.id && x.staff === recordStaff.name); return (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px]"><span className={a ? "text-[#0f7a43]" : "text-[var(--ink-3)]"}>{a ? "✓" : "○"}</span><span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]">{p.title}</span><span className="text-[11px] text-[var(--ink-3)]">{a ? `Confirmed ${fmtDate(a.date)}` : "Not yet"}</span></div>
              ); })}</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">📝 Notes &amp; full attempt history appear here once the backend records per-question results.</div>
          </div>
        </div>, document.body)}

      {/* Read-and-confirm modal */}
      {readingDoc && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[136] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setReadingDoc(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-1 flex items-start gap-2"><span className="text-[16px]">📄</span><h3 className="flex-1 text-[15px] font-extrabold leading-tight text-[var(--ink)]">{readingDoc.title}</h3><button type="button" onClick={() => setReadingDoc(null)} className="text-[18px] leading-none text-[var(--ink-3)]">×</button></div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[var(--ink-3)]">{readingDoc.category ? readingDoc.category + " · " : ""}{readingDoc.required ? "Required" : "Recommended"} · added {fmtDate(readingDoc.added)}</span>
              {readingDoc.body && <button type="button" onClick={speakPolicy} className={"ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold transition-colors " + (speaking ? "bg-[#1d3a8f] text-white" : "border border-[#bcd0f5] bg-[#eef4fd] text-[#1d3a8f]")}>{speaking ? "⏹ Stop" : "🔊 Read aloud"}</button>}
            </div>
            <div onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 28) setReachedEnd(true); }} className="max-h-[54vh] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              {readingDoc.fileData && <iframe src={pdfUrl ?? undefined} title={readingDoc.title} className="mb-3 h-[440px] w-full rounded-lg border border-[var(--line)] bg-white" />}
              {readingDoc.body && <div className="whitespace-pre-wrap px-0.5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{readingDoc.body}</div>}
              {!readingDoc.body && !readingDoc.fileData && <div className="p-4 text-[13px] text-[var(--ink-3)]">No content yet.</div>}
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-[#0f7a43]">— end of document —</div>
            </div>
            {acks.some((a) => a.docId === readingDoc.id && a.staff === ME) ? (
              <div className="mt-3 rounded-lg bg-[#e2f4ea] px-3 py-2 text-[12.5px] font-bold text-[#0f7a43]">✓ You confirmed this on {fmtDate(acks.find((a) => a.docId === readingDoc.id && a.staff === ME)!.date)}</div>
            ) : (<>
              {!reachedEnd && <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">👆 Scroll to the end{readingDoc.body ? " (or press Read aloud)" : ""} to enable confirmation.</p>}
              <label className={"mt-2 flex items-start gap-2 rounded-lg py-1 text-[12.5px] font-semibold " + (reachedEnd ? "text-[var(--ink-2)]" : "cursor-not-allowed text-[var(--ink-3)] opacity-60")}><input type="checkbox" disabled={!reachedEnd} checked={readConfirm} onChange={(e) => setReadConfirm(e.target.checked)} className="mt-0.5" /> <span>I confirm I have read and understood <b className="font-bold text-[var(--ink)]">{readingDoc.title}</b>.</span></label>
              <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setReadingDoc(null)}>Close</Button><Button variant="primary" disabled={!readConfirm} onClick={() => confirmRead(readingDoc)}>Confirm</Button></div>
            </>)}
          </div>
        </div>, document.body)}

      {/* Add / edit policy modal */}
      {policyForm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[137] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setPolicyForm(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{policies.some((x) => x.id === policyForm.id) ? "Edit policy" : "Add policy"}</h3><button type="button" onClick={() => setPolicyForm(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <div className="grid gap-2.5">
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Title</span><Input value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} placeholder="e.g. Safeguarding Policy" className="w-full" /></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Category (optional)</span><Input value={policyForm.category ?? ""} onChange={(e) => setPolicyForm({ ...policyForm, category: e.target.value })} placeholder="e.g. Safeguarding" className="w-full" /></label>
                <label className="flex items-end gap-2 pb-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={policyForm.required} onChange={(e) => setPolicyForm({ ...policyForm, required: e.target.checked })} /> Required reading</label>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">PDF document (optional)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ Upload PDF<input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setPolicyForm({ ...policyForm, fileData: String(r.result), fileName: f.name }); r.readAsDataURL(f); }} /></label>
                  {policyForm.fileName && <span className="max-w-[220px] truncate text-[12px] font-semibold text-[var(--ink-2)]">📄 {policyForm.fileName}</span>}
                  {policyForm.fileData && <button type="button" onClick={() => setPolicyForm({ ...policyForm, fileData: undefined, fileName: undefined })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
                </div>
              </div>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Policy text {policyForm.fileData ? "(read aloud + audio)" : ""}</span><textarea rows={policyForm.fileData ? 4 : 9} value={policyForm.body} onChange={(e) => setPolicyForm({ ...policyForm, body: e.target.value })} placeholder={policyForm.fileData ? "Optional — add text so the policy can be read aloud (audio)…" : "Paste or write the policy staff must read and confirm…"} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[#1d3a8f]" /></label>
            </div>
            <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setPolicyForm(null)}>Cancel</Button><Button variant="primary" disabled={!policyForm.title.trim()} onClick={() => savePolicy(policyForm)}>Save policy</Button></div>
          </div>
        </div>, document.body)}

      {/* Certificate record editor */}
      {certEdit && <CredEditor rec={certEdit} types={cred.types} onSave={(r) => { cred.upsertRecord(r); setCertEdit(null); flash("✅ Certificate saved"); }} onClose={() => setCertEdit(null)} />}

      {/* Certificate detail / verify drawer */}
      {certCell && typeof document !== "undefined" && createPortal((() => {
        const t = cred.types.find((x) => x.id === certCell.typeId); const r = cred.recordFor(certCell.staff, certCell.typeId); const st = credStatus(r); const dl = daysUntil(r?.expiry);
        return (
          <div className="fixed inset-0 z-[138] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setCertCell(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t?.name ?? "Credential"}</h3><CredBadge s={st} /><button type="button" onClick={() => setCertCell(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
              <div className="mb-3 text-[12px] text-[var(--ink-3)]">{certCell.staff}</div>
              {r ? (<>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Issued</div><div className="font-bold text-[var(--ink)]">{fmtCredDate(r.issue)}</div></div>
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Expires</div><div className="font-bold text-[var(--ink)]">{fmtCredDate(r.expiry)}{dl != null && dl >= 0 && dl <= 60 ? <span className="text-[#b45309]"> · {dl}d</span> : null}{dl != null && dl < 0 ? <span className="text-[#c0392b]"> · expired</span> : null}</div></div>
                  {r.issuer && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Issuer</div><div className="font-bold text-[var(--ink)]">{r.issuer}</div></div>}
                  {r.number && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Number</div><div className="font-bold text-[var(--ink)]">{r.number}</div></div>}
                  {t?.dbs && r.dbsLevel && <div className="col-span-2 rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">DBS</div><div className="font-bold text-[var(--ink)]">{r.dbsLevel}{r.dbsUpdate ? " · on Update Service" : ""}{r.dbsUpdateNo ? " · " + r.dbsUpdateNo : ""}</div></div>}
                </div>
                {r.fileData && <button type="button" onClick={() => openCredFile(r.fileData)} className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[12.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">📎 View {r.fileName || "certificate"}</button>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.verified !== "verified" && <Button variant="primary" onClick={() => { cred.upsertRecord({ ...r, verified: "verified" }); flash("✅ Verified"); }}>✓ Verify</Button>}
                  {r.verified !== "rejected" && <Button onClick={() => { cred.upsertRecord({ ...r, verified: "rejected" }); flash("Marked rejected"); }}>Reject</Button>}
                  <Button onClick={() => { setCertEdit(r); setCertCell(null); }}>Edit</Button>
                  <button type="button" title="Delete" onClick={() => { if (typeof window !== "undefined" && window.confirm("Delete this certificate record?")) { cred.deleteRecord(r.id); setCertCell(null); flash("Deleted"); } }} className="ml-auto text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
              </>) : (<>
                <p className="rounded-lg bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold text-[#c0392b]">No {t?.name} on file for {certCell.staff}.</p>
                <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setCertCell(null)}>Close</Button><Button variant="primary" onClick={() => { setCertEdit(blankRecord(certCell.staff, certCell.typeId)); setCertCell(null); }}>+ Add on their behalf</Button></div>
              </>)}
            </div>
          </div>);
      })(), document.body)}

      {toast && <div className="fixed bottom-5 left-1/2 z-[150] -translate-x-1/2 rounded-full bg-[#111634] px-4 py-2 text-[13px] font-bold text-white shadow-lg">{toast}</div>}

      {player && typeof document !== "undefined" && createPortal(<CoursePlayer course={player} onClose={() => setPlayer(null)} />, document.body)}
      {editing && typeof document !== "undefined" && createPortal(<CourseEditor course={editing} onSave={saveCourse} onCancel={() => setEditing(null)} />, document.body)}
      {insight && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[135] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={() => setInsight(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-2 flex items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">📊 {insight.title}</div><button type="button" onClick={() => setInsight(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <div className="mb-3 flex gap-2">
              {[[`${courseScore(insight.id)}%`, "team avg score"], [`${SEED_STAFF.length}`, "assigned"], [`${Math.round(SEED_STAFF.length * 0.7)}`, "completed"]].map(([n, l], i) => (
                <div key={i} className="flex-1 rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[18px] font-extrabold text-[#1d3a8f]">{n}</div><div className="text-[10.5px] text-[var(--ink-3)]">{l}</div></div>
              ))}
            </div>
            <div className="mb-2 rounded-lg bg-[#eaf8f0] p-2.5"><div className="text-[11px] font-extrabold text-[#0f7a43]">✅ Best-answered question</div><div className="text-[12px] text-[var(--ink-2)]">{insight.quiz?.[0]?.q ?? "—"}</div></div>
            <div className="rounded-lg bg-[#fdecec] p-2.5"><div className="text-[11px] font-extrabold text-[#c0392b]">⚠ Topic to revisit / retrain</div><div className="text-[12px] text-[var(--ink-2)]">{insight.quiz?.[insight.quiz.length - 1]?.q ?? "—"}</div></div>
            <p className="mt-2.5 text-[11px] text-[var(--ink-3)]">Once every assigned staff member has completed, the completion date and the full per-question, per-person breakdown appear here (recorded by the backend).</p>
          </div>
        </div>, document.body)}
    </div>
  );
}
