"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, type ChildQuestion } from "@/lib/settings";
import { Button } from "@/components/ui";
import { ChildCard, type ChildInfo } from "./ChildCard";

// ─────────────────────────────────────────────────────────────────────────
// Register — rebuilt to the prototype's daily-register look: a white
// "Daily register" hero, quick head-count band, collection-PIN banner, a date
// accordion, four stat tiles, the KEY legend and a proper CHILD · ALERTS ·
// SIGNED IN · COLLECTED · STATUS · PARENT table. Sign in / Collect are
// independent one-tap toggles; Absent-ill with Undo.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const BLUE = "#1d3a8f", GREEN = "#0f9d58", RED = "#e11d48", AMBER = "#d97706";
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";

interface Attendance { status?: "in" | "absent"; inAt?: string | null; collectedAt?: string | null; collectedBy?: string | null }
interface SGRec { photo?: string; dob?: string; school?: string; allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string; collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean; likes?: string; dislikes?: string; swimming?: string; sex?: string; suncreamConsent?: boolean; firstAidConsent?: boolean; walkHomeConsent?: boolean; answers?: Record<string, string> }
interface Attendee { ref: string; booker: string; email: string; phone?: string; note?: string; addons?: string[]; bookingStatus: string; seats: number; children: { name: string; age?: number }[]; child: SGRec | null; attendance: Attendance | null }
interface Head { n: number; by: string; at: string }
interface Session { blockId: string; date: string; start: string; end: string; blockName: string; listingId: string; listingName: string; attendees: Attendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number }; heads: Head[]; takenBy: { name: string; at: string } | null }
type Action = "in" | "absent" | "collect" | "reset";
type FlagKind = "" | "allergy" | "medical" | "send" | "dietary";

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const shiftDay = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rel = (iso: string) => (iso === todayIso() ? "Today" : iso === shiftDay(todayIso(), 1) ? "Tomorrow" : dow(iso));
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const timeOf = (ts?: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
// "08:30" → "8:30am" for the start-time filter chips.
const fmt12 = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); if (Number.isNaN(h)) return hhmm; const ap = h >= 12 ? "pm" : "am"; return `${h % 12 || 12}:${String(m ?? 0).padStart(2, "0")}${ap}`; };
// UK-first number for wa.me (0… → 44…, strip non-digits).
const waNumber = (phone?: string) => { let n = (phone || "").replace(/\D/g, ""); if (n.startsWith("00")) n = n.slice(2); else if (n.startsWith("0")) n = "44" + n.slice(1); return n; };
// Age from a date of birth vs a "today" string (yyyy-mm-dd) — pure, no Date.now
// in render. Handles ISO (2016-12-12) and UK (12/12/2016) dob strings.
const ageFrom = (dob?: string, today?: string): number | undefined => {
  if (!dob || !today) return undefined;
  const iso = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const uk = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let y: number, m: number, d: number;
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (uk) { d = +uk[1]; m = +uk[2]; y = +uk[3]; }
  else return undefined;
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - y; if (tm < m || (tm === m && td < d)) age--;
  return age >= 0 && age < 120 ? age : undefined;
};
const st = (a: Attendee): "present" | "absent" | "notArrived" => (a.attendance?.status === "in" ? "present" : a.attendance?.status === "absent" ? "absent" : "notArrived");
const AV = ["#fde2e4", "#e2f0d9", "#e0e7ff", "#fff3d6", "#e5f6f8", "#f3e8ff", "#ffe9d6", "#dce7ff"];
const avBg = (n: string) => AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];


function AlertSq({ kind, text }: { kind: "allergy" | "medical" | "send"; text: string }) {
  const m = kind === "allergy" ? { bg: "#fde2e4", fg: "#c02636", label: "Allergy" } : kind === "medical" ? { bg: "#e0e9ff", fg: BLUE, label: "Medical" } : { bg: "#f3e8ff", fg: "#6d28d9", label: "SEND" };
  return <span title={text} className="rounded-md px-1.5 py-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.03em]" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

// Searchable listing picker for the hero — a button + type-to-filter popover.
function ListingPicker({ listings, active, activeName, onPick }: { listings: [string, string][]; active: string; activeName: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = listings.filter(([, n]) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="relative">
      <button type="button" aria-label="Choose listing" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">{activeName || "Choose listing"} <span className="text-[9px]">▾</span></button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 z-20 mt-1 w-[260px] rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-xl">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" className="mb-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
          <div className="max-h-[240px] overflow-y-auto">
            {shown.length === 0 ? <div className="px-2 py-2 text-[12px] text-[var(--ink-3)]">No listing matches.</div> : shown.map(([id, n]) => (
              <button key={id} type="button" onClick={() => { onPick(id); setOpen(false); setQ(""); }} className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-semibold" style={id === active ? { background: "#eef4fd", color: "#1d3a8f" } : { color: "var(--ink-2)" }}>{n}</button>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}

// ── Child detail card — shared layout lives in ./ChildCard ──────────────────
function ChildModal({ a, showTimes, fields, card, questions, ctx, onClose }: { a: Attendee; showTimes: boolean; fields: { contact?: boolean; emergency?: boolean; password?: boolean; school?: boolean }; card: Record<string, boolean | undefined>; questions: ChildQuestion[]; ctx: { attend: { date: string; start: string; end: string; listing: string }[]; siblings: string[] }; onClose: () => void }) {
  const c = a.child; const kid = a.children[0]; const state = st(a);
  const statusChip = state === "present"
    ? { text: showTimes && a.attendance?.inAt ? `Signed in \u00b7 ${timeOf(a.attendance.inAt)}` : "Signed in" }
    : state === "absent" ? { text: "Absent / ill" } : { text: "Not arrived", bg: "rgba(255,255,255,.16)" };
  const info: ChildInfo = {
    name: kid?.name ?? "", age: kid?.age, dob: c?.dob, sex: c?.sex, photo: c?.photo,
    allergies: c?.allergies, medical: c?.medical, dietary: c?.dietary, send: c?.send, sendPlanName: c?.sendPlanName, swimming: c?.swimming,
    careNotes: c?.careNotes, likes: c?.likes, dislikes: c?.dislikes, answers: c?.answers,
    photoConsent: c?.photoConsent, suncreamConsent: c?.suncreamConsent, firstAidConsent: c?.firstAidConsent, walkHomeConsent: c?.walkHomeConsent,
    collectionPassword: c?.collectionPassword, emergencyName: c?.emergencyName, emergencyPhone: c?.emergencyPhone, school: c?.school,
    contactName: a.booker, contactPhone: a.phone, contactEmail: a.email,
    bookingRef: a.ref, bookingNotes: a.note,
    collected: a.attendance?.collectedAt ? `${showTimes ? timeOf(a.attendance.collectedAt) : "yes"}${a.attendance.collectedBy ? ` \u00b7 by ${a.attendance.collectedBy}` : ""}` : undefined,
    siblings: ctx.siblings,
    statusChip,
    attending: ctx.attend.map((s) => ({ label: dow(s.date), start: s.start, end: s.end, listing: s.listing })),
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-[860px]" onClick={(e) => e.stopPropagation()}>
        <ChildCard info={info} card={card} questions={questions} fields={fields} onClose={onClose} />
      </div>
    </div>
  );
}

// ── Download picker ─────────────────────────────────────────────────────────
type DlCol = { key: string; label: string; on: boolean; group: string };
const DL_COLS: DlCol[] = [
  { key: "age", label: "Age", on: true, group: "Attendance" }, { key: "time", label: "Timing", on: true, group: "Attendance" },
  { key: "status", label: "Status", on: true, group: "Attendance" }, { key: "arrived", label: "Arrived", on: true, group: "Attendance" },
  { key: "collected", label: "Collected", on: true, group: "Attendance" }, { key: "collectedby", label: "Collected by", on: false, group: "Attendance" },
  { key: "seats", label: "Seats", on: false, group: "Attendance" },
  { key: "allergies", label: "Allergies", on: true, group: "Safeguarding" }, { key: "medical", label: "Medical", on: true, group: "Safeguarding" },
  { key: "needs", label: "SEND / needs", on: true, group: "Safeguarding" }, { key: "dietary", label: "Dietary", on: false, group: "Safeguarding" },
  { key: "carenotes", label: "Care notes", on: false, group: "Safeguarding" }, { key: "photo", label: "Photo consent", on: false, group: "Safeguarding" },
  { key: "emergency", label: "Emergency contact", on: true, group: "Contact" }, { key: "emphone", label: "Em. phone", on: true, group: "Contact" },
  { key: "booker", label: "Parent / booker", on: false, group: "Contact" }, { key: "email", label: "Contact email", on: false, group: "Contact" },
  { key: "password", label: "Collection password", on: false, group: "Sensitive" }, { key: "dob", label: "Date of birth", on: false, group: "Sensitive" },
  { key: "school", label: "School", on: false, group: "Sensitive" },
];
const DL_GROUPS = ["Attendance", "Safeguarding", "Contact", "Sensitive"];
function cell(key: string, s: Session, a: Attendee): string {
  const c = a.child, k = a.children[0];
  switch (key) {
    case "age": return k?.age != null ? String(k.age) : ""; case "time": return `${s.start}-${s.end}`;
    case "status": return st(a) === "present" ? "Present" : st(a) === "absent" ? "Absent" : "Not arrived";
    case "arrived": return timeOf(a.attendance?.inAt); case "collected": return a.attendance?.collectedAt ? timeOf(a.attendance.collectedAt) : "";
    case "collectedby": return a.attendance?.collectedBy ?? ""; case "seats": return String(a.seats ?? 1);
    case "allergies": return c?.allergies ?? ""; case "medical": return c?.medical ?? ""; case "needs": return c?.send || c?.sendPlanName ? "SEND" : "";
    case "dietary": return c?.dietary ?? ""; case "carenotes": return c?.careNotes ?? ""; case "photo": return c?.photoConsent == null ? "" : c.photoConsent ? "Yes" : "No";
    case "emergency": return c?.emergencyName ?? ""; case "emphone": return c?.emergencyPhone ?? ""; case "booker": return a.booker ?? ""; case "email": return a.email ?? "";
    case "password": return c?.collectionPassword ?? "";
    case "dob": return c?.dob ?? ""; case "school": return c?.school ?? ""; default: return "";
  }
}
function DownloadDialog({ sessions, date, onClose }: { sessions: Session[]; date: string; onClose: () => void }) {
  const [on, setOn] = useState<Set<string>>(new Set(DL_COLS.filter((c) => c.on).map((c) => c.key)));
  const cols = DL_COLS.filter((c) => on.has(c.key));
  const total = sessions.reduce((n, s) => n + s.attendees.length, 0);
  const setAll = (keys: string[], val: boolean) => setOn((x) => { const n = new Set(x); for (const k of keys) { if (val) n.add(k); else n.delete(k); } return n; });
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
  const csv = () => { const rows = [["Listing", "Session", "Child", ...cols.map((c) => c.label)]]; for (const s of sessions) for (const a of s.attendees) rows.push([s.listingName, s.blockName, a.children.map((k) => k.name).join(" / "), ...cols.map((c) => cell(c.key, s, a))]); const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" })); const l = document.createElement("a"); l.href = url; l.download = `register-${date}.csv`; l.click(); URL.revokeObjectURL(url); onClose(); };
  const pdf = () => { const body = sessions.map((s) => `<h2>${esc(s.listingName)} — ${esc(s.blockName)} · ${s.start}–${s.end}</h2><table><tr><th>Child</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>${s.attendees.map((a) => `<tr><td>${esc(a.children.map((k) => k.name).join(", "))}</td>${cols.map((c) => `<td>${esc(cell(c.key, s, a))}</td>`).join("")}</tr>`).join("")}</table>`).join(""); const w = window.open("", "_blank", "width=900,height=1000"); if (!w) return; w.document.write(`<!doctype html><title>Register ${date}</title><style>body{font:12px/1.4 system-ui,sans-serif;color:#171534;padding:16px}h2{font-size:13px;margin:16px 0 4px;border-top:1px solid #ddd;padding-top:8px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border:1px solid #e5e5e5;padding:4px 6px;font-size:11px}th{background:#f5f5f5}</style><h1>Register — ${dayLabel(date)}</h1>${body}`); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold">Download register — {dayLabel(date)}</div>
        <p className="mb-2 text-[12px] text-[var(--ink-3)]">{total} {total === 1 ? "child" : "children"} across {sessions.length} {sessions.length === 1 ? "session" : "sessions"}. The child&rsquo;s name is always included — tick any extra columns to include.</p>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Columns · {cols.length}</span>
          <button type="button" onClick={() => setAll(DL_COLS.map((c) => c.key), true)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]">Select all</button>
          <button type="button" onClick={() => setAll(DL_COLS.map((c) => c.key), false)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]">Clear</button>
          <button type="button" onClick={() => setOn(new Set(DL_COLS.filter((c) => c.on).map((c) => c.key)))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]">Reset</button>
        </div>
        <div className="space-y-2.5">
          {DL_GROUPS.map((g) => { const gc = DL_COLS.filter((c) => c.group === g); const allOn = gc.every((c) => on.has(c.key)); return (
            <div key={g}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{g}</span>
                {g === "Sensitive" && <span className="rounded px-1.5 py-[1px] text-[9px] font-bold uppercase text-[#c02636]" style={{ background: "#fde2e4" }}>handle with care</span>}
                <button type="button" onClick={() => setAll(gc.map((c) => c.key), !allOn)} className="text-[10.5px] font-bold text-[#1d3a8f]">{allOn ? "clear" : "all"}</button>
              </div>
              <div className="flex flex-wrap gap-1.5">{gc.map((c) => { const s = on.has(c.key); return <button key={c.key} type="button" onClick={() => setOn((x) => { const n = new Set(x); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={s ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{s ? "✓ " : ""}{c.label}</button>; })}</div>
            </div>
          ); })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3"><Button sm onClick={onClose}>Cancel</Button><div className="flex gap-2"><Button sm onClick={pdf}>🖨 PDF (printable)</Button><Button sm variant="solid" onClick={csv}>⭳ CSV</Button></div></div>
      </div>
    </div>
  );
}

/** register view — freelancer, company, franchise and staff portals. */
export function RegistersApp() {
  const { settings, questions } = useSettings();
  const router = useRouter();
  const portal = (usePathname()?.split("/")[1]) || "freelancer";
  const incidentHref = `/${portal}/${portal === "staff" ? "incident" : "incidents"}`;
  const showTimes = settings.registers?.timestamps ?? true;
  const fields = settings.registers?.fields ?? { contact: true, emergency: true, password: true, school: true };
  const card = settings.registers?.card ?? {};
  const acts = settings.registers?.actions ?? {};
  const pinRequired = !!settings.registers?.requireCollectionPin;

  const anchor = todayIso();
  const WINDOW = useMemo(() => Array.from({ length: 10 }, (_, i) => shiftDay(anchor, i)), [anchor]);
  const [days, setDays] = useState<Record<string, Session[]>>({});
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(anchor);
  const [activeListing, setActiveListing] = useState<string>("");
  const seasons = settings.seasons ?? [];
  const [regSeason, setRegSeason] = useState("");
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  useEffect(() => { apiGet<{ id: string; seasonId?: string | null }[]>("/api/listings?mine=1").then((ls) => setListingSeason(Object.fromEntries((ls ?? []).filter((l) => l.seasonId).map((l) => [l.id, l.seasonId as string])))).catch(() => {}); }, []);
  const [error, setError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"young" | "old" | "start">("young");
  const [pass, setPass] = useState("");
  const [flag, setFlag] = useState<FlagKind>("");
  const [addonsOnly, setAddonsOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rollCall, setRollCall] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [openKid, setOpenKid] = useState<Attendee | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const refresh = useCallback(() => {
    // Per-day fetch, tolerant of a single day failing — but track whether EVERY
    // day errored, so a dead API (e.g. Firestore quota) shows a "couldn't load"
    // state instead of masquerading as an empty "nothing runs" schedule.
    Promise.all(WINDOW.map((d) => apiGet<Session[]>(`/api/registers?date=${d}`).then((l) => [d, l] as const).catch(() => [d, null] as const)))
      .then((pairs) => {
        const ok = pairs.filter((p) => p[1] !== null) as (readonly [string, Session[]])[];
        setLoadFailed(ok.length === 0);
        setDays(Object.fromEntries(ok));
        setReady(true); setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load the register"));
  }, [WINDOW]);
  useEffect(() => { refresh(); }, [refresh]);
  // Fetch a single day the initial 10-day window didn't cover (calendar jumps /
  // arrowing past the window). Cached once loaded, so it only fetches once.
  const ensureDay = useCallback(async (d: string) => {
    if (days[d] !== undefined) return;
    try { const l = await apiGet<Session[]>(`/api/registers?date=${d}`); setDays((prev) => ({ ...prev, [d]: l })); }
    catch { setDays((prev) => ({ ...prev, [d]: [] })); }
  }, [days]);
  const goDay = (delta: number) => { const d = shiftDay(date, delta); setDate(d); ensureDay(d); };
  const pickDate = (d: string) => { if (!d) return; setDate(d); ensureDay(d); };
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setReadOnly(me.role === "platform")).catch(() => {}); }, []);
  useRealtime(["registers", "bookings", "blocks"], refresh);

  async function mark(blockId: string, ref: string, action: Action) {
    setBusyRef(ref); setError(null);
    try { await apiPost(`/api/registers/${encodeURIComponent(blockId)}/${date}/mark`, { ref, action }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the register"); }
    setBusyRef(null);
  }
  async function signAllIn(items: { blockId: string; a: Attendee }[]) {
    setBulkBusy("all"); setError(null);
    try { for (const it of items) await apiPost(`/api/registers/${encodeURIComponent(it.blockId)}/${date}/mark`, { ref: it.a.ref, action: "in" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the register"); }
    setBulkBusy(null);
  }
  async function logHead(s: Session, n: number) {
    try { await apiPost(`/api/registers/${encodeURIComponent(s.blockId)}/${date}/headcount`, { n }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t log the head count"); }
  }
  // Messaging deep-links into the Messages composer, pre-addressed. "All
  // attending" pushes every shown family's email; a single row pushes just that
  // parent — the composer opens ready to write, recipients already filled in.
  function messageAttending() {
    if (attendingEmails.length === 0) return;
    router.push(`/${portal}/messages?compose=1&emails=${encodeURIComponent(attendingEmails.join(","))}`);
  }
  function messageOne(a: Attendee) {
    if (!a.email) { setError(`No contact email on file for ${a.booker}.`); return; }
    router.push(`/${portal}/messages?compose=1&emails=${encodeURIComponent(a.email.trim().toLowerCase())}`);
  }
  // Quick-log med / first-aid / incident straight from the register, child pre-filled.
  const medFor = (a: Attendee) => router.push(`/${portal}/medication?child=${encodeURIComponent(a.children[0]?.name ?? "")}`);
  const accidentFor = (a: Attendee) => router.push(`/${portal}/accidents?child=${encodeURIComponent(a.children[0]?.name ?? "")}`);
  const incidentFor = (a: Attendee) => router.push(`${incidentHref}?child=${encodeURIComponent(a.children[0]?.name ?? "")}`);
  const momentsFor = (a: Attendee) => router.push(`/${portal}/moments?child=${encodeURIComponent(a.children[0]?.name ?? "")}`);
  const emailFor = (a: Attendee) => { if (!a.email) { setError(`No contact email on file for ${a.booker}.`); return; } router.push(`/${portal}/email?to=${encodeURIComponent(a.email.trim().toLowerCase())}`); };
  const whatsappFor = (a: Attendee) => { const n = waNumber(a.phone); if (!n) { setError(`No phone on file for ${a.booker}.`); return; } const el = document.createElement("a"); el.href = `https://wa.me/${n}`; el.target = "_blank"; el.rel = "noopener noreferrer"; document.body.appendChild(el); el.click(); el.remove(); };

  // Listings that run somewhere in the window; pick the active one.
  const listingsEvery = useMemo(() => {
    const m = new Map<string, string>(); for (const d of Object.keys(days)) for (const s of days[d] ?? []) m.set(s.listingId, s.listingName); return [...m.entries()];
  }, [days]);
  // Narrow the listing picker to the chosen season (a listing's seasonId).
  const seasonObj = seasons.find((s) => s.id === regSeason);
  const listingsAll = seasonObj ? listingsEvery.filter(([id]) => listingSeason[id] === seasonObj.id) : listingsEvery;
  const active = (listingsAll.some(([id]) => id === activeListing) ? activeListing : "") || listingsAll[0]?.[0] || "";
  const activeName = listingsAll.find(([id]) => id === active)?.[1] ?? "";
  const activeSeason = seasons.find((s) => s.id === listingSeason[active])?.name;
  const sessionsOn = (d: string) => (days[d] ?? []).filter((s) => s.listingId === active);
  const daySessions = sessionsOn(date);

  // One flat list of children for the listing on the day, each tagged with its
  // block (pass) so it can be marked, then filtered by pass and searched.
  type FlatRow = { a: Attendee; blockId: string; start: string; end: string };
  const flat: FlatRow[] = daySessions.flatMap((s) => s.attendees.map((a) => ({ a, blockId: s.blockId, start: s.start, end: s.end })));
  const passes = [...new Set(daySessions.map((s) => s.start))].sort();
  const inPass = (r: FlatRow) => !pass || r.start === pass;
  const term = q.trim().toLowerCase();
  // Pick the comparator from `sort` HERE in the render body (not buried inside a
  // .sort() callback) so the React Compiler tracks `sort` as a dependency and the
  // list re-orders the moment the chip changes. Name breaks every tie.
  // Age falls back to the child record's DOB when the booking has no age — else
  // every child reads as "unknown" and the Age sort can't order anything.
  const ageOf = (a: Attendee) => a.children[0]?.age ?? ageFrom(a.child?.dob, anchor);
  const byName = (x: FlatRow, y: FlatRow) => (x.a.children[0]?.name ?? "").localeCompare(y.a.children[0]?.name ?? "");
  const cmp: (x: FlatRow, y: FlatRow) => number =
    sort === "start" ? (x, y) => x.start.localeCompare(y.start) || byName(x, y)
    : sort === "old" ? (x, y) => ((ageOf(y.a) ?? -1) - (ageOf(x.a) ?? -1)) || byName(x, y)
    : (x, y) => ((ageOf(x.a) ?? 999) - (ageOf(y.a) ?? 999)) || byName(x, y);
  const hasFlag = (a: Attendee, k: FlagKind) => k === "allergy" ? !!a.child?.allergies : k === "medical" ? !!a.child?.medical : k === "dietary" ? !!a.child?.dietary : k === "send" ? !!(a.child?.send || a.child?.sendPlanName) : true;
  const flatShown = flat
    .filter((r) => !pass || r.start === pass)
    .filter(({ a }) => !flag || hasFlag(a, flag))
    .filter(({ a }) => !addonsOnly || (a.addons?.length ?? 0) > 0)
    .filter(({ a }) => !term || a.children.some((c) => c.name.toLowerCase().includes(term)) || a.booker.toLowerCase().includes(term))
    .slice()
    .sort(cmp);
  // Row selection → bulk In / Out / Absent.
  const shownRefs = flatShown.map(({ a }) => a.ref);
  const allSelected = shownRefs.length > 0 && shownRefs.every((r) => selected.has(r));
  const toggleSel = (ref: string) => setSelected((s) => { const n = new Set(s); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shownRefs));
  async function bulkMark(action: Action) {
    const items = flatShown.filter(({ a }) => selected.has(a.ref));
    if (!items.length) return;
    setBulkBusy(action); setError(null);
    try { for (const it of items) await apiPost(`/api/registers/${encodeURIComponent(it.blockId)}/${date}/mark`, { ref: it.a.ref, action }); refresh(); setSelected(new Set()); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the register"); }
    setBulkBusy(null);
  }
  // Counts for the filter tags (over the whole day / current pass, pre-search).
  const inPassRows = flat.filter((r) => !pass || r.start === pass);
  const flagCounts = { allergy: inPassRows.filter((r) => hasFlag(r.a, "allergy")).length, medical: inPassRows.filter((r) => hasFlag(r.a, "medical")).length, dietary: inPassRows.filter((r) => hasFlag(r.a, "dietary")).length, send: inPassRows.filter((r) => hasFlag(r.a, "send")).length };

  // Everyone currently shown (respects the pass filter + search) → the audience
  // for "Message all attending", de-duplicated by email.
  // Recipients de-duplicate by email (normalised) — two children in one family
  // share a parent, so that parent is messaged ONCE. The button, though, counts
  // attending children, which is what "all attending" means to the eye.
  const attendingEmails = [...new Set(flatShown.map(({ a }) => a.email.trim().toLowerCase()).filter(Boolean))];
  const attendingKids = flatShown.reduce((n, { a }) => n + a.children.length, 0);
  const dayCounts = (d: string) => { const ss = sessionsOn(d); return { booked: ss.reduce((n, s) => n + s.counts.expected, 0), present: ss.reduce((n, s) => n + s.counts.present, 0) }; };
  // Head count / stats aggregate the day (respecting the pass filter).
  const passBlocks = daySessions.filter((s) => !pass || s.start === pass);
  const agg = passBlocks.reduce((o, s) => ({ expected: o.expected + s.counts.expected, present: o.present + s.counts.present, notArrived: o.notArrived + s.counts.notArrived, absent: o.absent + s.counts.absent }), { expected: 0, present: 0, notArrived: 0, absent: 0 });
  const pct = agg.expected ? Math.round((agg.present / agg.expected) * 100) : 0;
  const presentAll = passBlocks.flatMap((s) => s.attendees.filter((a) => st(a) === "present"));
  const allHeads = passBlocks.flatMap((s) => s.heads).slice().sort((a, b) => a.at.localeCompare(b.at));
  const headTiles = { count: allHeads.length, last: allHeads.at(-1), takenBy: passBlocks.map((s) => s.takenBy).filter(Boolean).sort((a, b) => a!.at.localeCompare(b!.at)).at(-1)?.name };
  const notInRefs = flat.filter(inPass).filter((r) => st(r.a) === "notArrived");
  const sel = (o: boolean) => ({ borderColor: o ? BLUE : "var(--line)", background: o ? "#eef4fd" : "var(--surface)", color: o ? BLUE : "var(--ink-2)" });

  const tiles: [string, string, number, string][] = [
    ["EXPECTED", "booked today", agg.expected, BLUE], ["PRESENT", agg.expected ? `${pct}% signed in` : "—", agg.present, GREEN],
    ["NOT ARRIVED", "awaiting", agg.notArrived, AMBER], ["ABSENT / ILL", agg.absent ? "reported" : "—", agg.absent, RED],
  ];

  // For the open child card: every day/time this family is booked across the
  // loaded window, plus siblings (other children under the same booker email).
  const kidContext = (a: Attendee) => {
    const email = a.email.trim().toLowerCase(); const name = a.children[0]?.name;
    const attend: { date: string; start: string; end: string; listing: string }[] = [];
    const sibs = new Set<string>();
    for (const d of Object.keys(days)) for (const s of days[d] ?? []) for (const at of s.attendees) {
      if (!email || at.email.trim().toLowerCase() !== email) continue;
      for (const k of at.children) if (k.name && k.name !== name) sibs.add(k.name);
      if (at.children.some((k) => k.name === name)) attend.push({ date: d, start: s.start, end: s.end, listing: s.listingName });
    }
    attend.sort((x, y) => x.date.localeCompare(y.date) || x.start.localeCompare(y.start));
    return { attend, siblings: [...sibs] };
  };

  if (!ready) return <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5" style={LIGHT_PALETTE}><div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">Loading the register…</div></div>;

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}
      {listingsAll.length === 0 ? (
        loadFailed ? (
          <div className="rounded-2xl border border-[#f6c9cc] bg-[#fdebec] px-4 py-12 text-center">
            <div className="text-[14px] font-extrabold text-[#c02636]">Couldn&rsquo;t load the register</div>
            <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-[#c02636]/85">The service didn&rsquo;t respond — this is usually temporary. Your bookings are safe; nothing has been lost.</p>
            <button type="button" onClick={refresh} className="mt-3 rounded-full bg-[#c02636] px-4 py-1.5 text-[12px] font-extrabold text-white">Try again</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">Nothing runs in the next few days — nothing to register.</div>
        )
      ) : (
        <>
          {/* Hero — blue/white gradient tile with controls + stat tiles */}
          <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📋</span>Register</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {seasons.length > 0 && (
                    <span className="relative inline-flex items-center">
                      <select value={regSeason} onChange={(e) => { setRegSeason(e.target.value); setActiveListing(""); }} title="Filter listings by season" className="appearance-none rounded-lg bg-white/90 py-1.5 pl-2.5 pr-7 text-[12.5px] font-extrabold text-[#1d3a8f] outline-none">
                        <option value="">📅 All seasons</option>
                        {seasons.map((s) => <option key={s.id} value={s.id}>📅 {s.name}</option>)}
                      </select>
                      <span aria-hidden className="pointer-events-none absolute right-2.5 text-[9px] text-[#1d3a8f]">▾</span>
                    </span>
                  )}
                  {listingsAll.length > 1
                    ? <ListingPicker listings={listingsAll} active={active} activeName={activeName} onPick={setActiveListing} />
                    : <span className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">🎟 {activeName || "—"}</span>}
                  {activeSeason && <span className="rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#2f9fb8,#12586e)" }}>📅 {activeSeason}</span>}
                  <div className="flex items-center gap-0.5 rounded-lg bg-white/90 px-1 py-0.5 text-[#1d3a8f]">
                    <button type="button" onClick={() => goDay(-1)} aria-label="Previous day" className="flex h-7 w-7 items-center justify-center rounded-md text-[17px] font-extrabold leading-none hover:bg-[#eaf1fb]">‹</button>
                    <span className="min-w-[168px] px-1 text-center text-[12.5px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{rel(date)} · {dow(date)}{dayCounts(date).booked ? ` — ${dayCounts(date).booked} booked` : ""}</span>
                    <button type="button" onClick={() => goDay(1)} aria-label="Next day" className="flex h-7 w-7 items-center justify-center rounded-md text-[17px] font-extrabold leading-none hover:bg-[#eaf1fb]">›</button>
                    <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[13px] hover:bg-[#eaf1fb]" title="Pick any date">📅
                      <input type="date" value={date} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  </div>
                  <span className="text-[12px] text-white/85">📍 {daySessions[0]?.blockName ?? "—"}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {tiles.map(([label, sub, v]) => (
                <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                  <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div>
                  <div className="text-[9.5px] text-white/60">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {pinRequired && <div className="mb-3 rounded-2xl border border-[#cfe0f7] bg-[#f5f9ff] px-4 py-3 text-[12.5px] text-[var(--ink-2)]"><span className="mr-1">🔒</span><b>Collection PIN required.</b> Ask whoever collects for the family&rsquo;s 4-digit PIN and check it matches before releasing a child.</div>}

          {daySessions.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">{days[date] === undefined ? `Loading ${dayLabel(date)}…` : `Nothing runs for ${activeName} on ${dayLabel(date)}.`}</div>
          ) : (
            <>
              {/* Start-time + add-ons filters */}
              {(passes.length > 1 || flat.some((r) => (r.a.addons?.length ?? 0) > 0)) && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {passes.length > 1 && <>
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Start time</span>
                    <button type="button" onClick={() => setPass("")} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(!pass)}>All</button>
                    {passes.map((p) => <button key={p} type="button" onClick={() => setPass(p)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(pass === p)}>{fmt12(p)} start</button>)}
                  </>}
                  {flat.some((r) => (r.a.addons?.length ?? 0) > 0) && (
                    <button type="button" onClick={() => setAddonsOnly((v) => !v)} className="rounded-full border px-3 py-1.5 text-[12px] font-extrabold" style={sel(addonsOnly)}>🧩 Add-ons only ({flat.filter((r) => (r.a.addons?.length ?? 0) > 0).length})</button>
                  )}
                </div>
              )}

              {/* Sort + toolbar */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Sort</span>
                <button type="button" onClick={() => setSort(sort === "young" ? "old" : "young")} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={sel(sort === "young" || sort === "old")}>Age · {sort === "old" ? "oldest" : "youngest"} first</button>
                <button type="button" onClick={() => setSort("start")} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={sel(sort === "start")}>Earliest start</button>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-40 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] outline-none focus:border-[#1d3a8f]" />
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setRollCall((v) => !v)} className="rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold" style={sel(rollCall)}>🚨 Roll call</button>
                  <button type="button" onClick={() => messageAttending()} disabled={attendingEmails.length === 0} title={attendingEmails.length ? `${attendingEmails.length} famil${attendingEmails.length === 1 ? "y" : "ies"} — a parent is messaged once` : ""} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40">Message all attending{attendingKids ? ` (${attendingKids})` : ""}</button>
                  <button type="button" onClick={() => setDlOpen(true)} className="rounded-full border border-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬇ Download</button>
                </div>
              </div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Filter</span>
                {([["allergy", "Allergy", "#fde2e4", "#c02636", flagCounts.allergy], ["medical", "Medical", "#e0e9ff", BLUE, flagCounts.medical], ["dietary", "Dietary", "#dcfce7", "#15803d", flagCounts.dietary], ["send", "SEND", "#f3e8ff", "#6d28d9", flagCounts.send]] as const).map(([k, label, bg, fg, n]) => {
                  const on = flag === k;
                  return <button key={k} type="button" onClick={() => setFlag(on ? "" : k)} className="rounded-md px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.03em] transition" style={on ? { background: fg, color: "#fff", boxShadow: `0 0 0 2px ${bg}` } : { background: bg, color: fg }}>{label}{n ? ` · ${n}` : ""}</button>;
                })}
                {flag && <button type="button" onClick={() => setFlag("")} className="text-[11px] font-bold text-[var(--ink-3)] underline">clear</button>}
                <span className="text-[11px] text-[var(--ink-3)]">tap a tag to show only those children — with the note typed</span>
              </div>

              {rollCall && (
                <div className="mb-3 overflow-hidden rounded-2xl border border-[#f6c9cc]">
                  <div className="flex items-center justify-between gap-2 bg-[#fdebec] px-4 py-2.5"><span className="text-[13px] font-extrabold text-[#c02636]">🚨 Roll call — {presentAll.length} on site now</span><span className="text-[11.5px] font-semibold text-[#c02636]">Count heads against this list.</span></div>
                  <div className="bg-[var(--surface)] p-4">{presentAll.length === 0 ? <div className="text-center text-[12.5px] text-[var(--ink-3)]">Nobody is signed in right now.</div> : <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">{presentAll.map((a) => <div key={a.ref} className="flex items-center gap-2 text-[12.5px]"><span className="font-bold">{a.children.map((c) => c.name).join(", ")}</span>{a.child?.allergies && <span className="text-[10.5px] font-bold text-[#c02636]">⚠</span>}</div>)}</div>}</div>
                </div>
              )}

              {/* ONE flat table for the day — blue/white card */}
              <div className="mb-3 overflow-hidden rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] shadow-[0_10px_30px_-18px_rgba(29,58,143,.45)]">
                {passBlocks[0] && <HeadBand expected={agg.expected} present={agg.present} heads={allHeads} takenBy={headTiles.takenBy} readOnly={readOnly} onLog={(n) => logHead(passBlocks[0], n)} />}
                {/* Selection / bulk-action bar */}
                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe6fb] bg-[#f2f7ff] px-4 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-[var(--ink-2)]">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#1d3a8f]" />
                      {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                    </label>
                    {selected.size > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Mark</span>
                        <button type="button" disabled={!!bulkBusy} onClick={() => bulkMark("in")} className="rounded-lg border px-2.5 py-1 text-[12px] font-extrabold disabled:opacity-40" style={{ borderColor: GREEN, background: "#e7f6ee", color: GREEN }}>{bulkBusy === "in" ? "…" : "In"}</button>
                        <button type="button" disabled={!!bulkBusy} onClick={() => bulkMark("collect")} className="rounded-lg border px-2.5 py-1 text-[12px] font-extrabold disabled:opacity-40" style={{ borderColor: BLUE, background: "#eef4fd", color: BLUE }}>{bulkBusy === "collect" ? "…" : "Collect"}</button>
                        <button type="button" disabled={!!bulkBusy} onClick={() => bulkMark("absent")} className="rounded-lg border px-2.5 py-1 text-[12px] font-extrabold disabled:opacity-40" style={{ borderColor: RED, background: "#fde2e4", color: RED }}>{bulkBusy === "absent" ? "…" : "Absent"}</button>
                        <button type="button" onClick={() => setSelected(new Set())} className="text-[11.5px] font-bold text-[var(--ink-3)] underline">clear</button>
                      </div>
                    ) : notInRefs.length > 0 && <button type="button" disabled={!!bulkBusy} onClick={() => signAllIn(notInRefs)} className="rounded-lg border border-[#bfead0] bg-[#e7f6ee] px-2.5 py-1 text-[12px] font-extrabold text-[#0f9d58] disabled:opacity-40">{bulkBusy === "all" ? "Working…" : `✓ Sign all in (${notInRefs.length})`}</button>}
                  </div>
                )}
                <div className="hidden grid-cols-[minmax(190px,1.3fr)_84px_minmax(200px,210px)_minmax(230px,1fr)] gap-3 border-b-2 border-[#dbe6fb] bg-[#eef4fd] px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#1d3a8f] md:grid">
                  <span>Child</span><span>Alerts</span><span>Attendance</span><span className="md:text-right">Quick actions</span>
                </div>
                {flatShown.length === 0 ? <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No children match.</div> : flatShown.map(({ a, blockId, start, end }) => (
                  <Row key={`${blockId}-${a.ref}`} a={a} start={start} end={end} showTimes={showTimes} busy={busyRef === a.ref || readOnly} age={ageOf(a)} flag={flag} acts={acts} selected={selected.has(a.ref)} onSelect={() => toggleSel(a.ref)} onOpen={() => setOpenKid(a)} onMark={(action) => mark(blockId, a.ref, action)} onMsg={() => messageOne(a)} onMed={() => medFor(a)} onAccident={() => accidentFor(a)} onIncident={() => incidentFor(a)} onMoments={() => momentsFor(a)} onEmail={() => emailFor(a)} onWhatsapp={() => whatsappFor(a)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {openKid && <ChildModal a={openKid} showTimes={showTimes} fields={fields} card={card} questions={questions} ctx={kidContext(openKid)} onClose={() => setOpenKid(null)} />}
      {dlOpen && <DownloadDialog sessions={passBlocks} date={date} onClose={() => setDlOpen(false)} />}
    </div>
  );
}

// Slim head-count strip next to "Register taken by". Expands to the full log of
// every count with its timestamp. You can never log more heads than the number
// of children in the register for the day (`expected`) — a miscount safeguard.
function HeadBand({ expected, present, heads, takenBy, readOnly, onLog }: { expected: number; present: number; heads: Head[]; takenBy?: string; readOnly: boolean; onLog: (n: number) => Promise<void> }) {
  const [n, setN] = useState(String(present));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const last = heads.at(-1);
  const val = parseInt(n || "", 10);
  const over = Number.isFinite(val) && val > expected;
  const canLog = Number.isFinite(val) && val >= 0 && val <= expected;
  return (
    <div className="border-b border-[var(--line)] bg-[var(--panel)]/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-[12px]">
        <span className="font-extrabold">Head count</span>
        {!readOnly && (
          <span className="flex items-center gap-1.5">
            <input type="number" min={0} max={expected} value={n} onChange={(e) => setN(e.target.value)} className="w-14 rounded-md border bg-[var(--surface)] px-2 py-1 text-[12px]" style={{ borderColor: over ? RED : "var(--line)" }} />
            <Button sm variant="solid" disabled={busy || !canLog} onClick={async () => { setBusy(true); await onLog(val); setBusy(false); }}>{busy ? "…" : "Log"}</Button>
          </span>
        )}
        {over ? <span className="font-semibold text-[#c02636]">Only {expected} on the register — can&rsquo;t log more</span>
          : <span className="text-[11px] text-[var(--ink-3)]">{heads.length} logged · max {expected}</span>}
        {last && <span className="font-semibold" style={{ color: last.n >= present ? GREEN : AMBER }}>Last {last.n}/{expected} · {timeOf(last.at)}</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-bold text-[#1d3a8f] underline">{open ? "hide log" : `records (${heads.length})`}</button>
        <span className="ml-auto text-[11px]"><span className="font-bold uppercase tracking-wide text-[var(--ink-3)]">Register taken by</span> <b className="text-[12.5px]">{takenBy ?? "— not yet"}</b></span>
      </div>
      {open && (
        <div className="border-t border-[var(--line)] px-4 py-2">
          {heads.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">No head counts logged yet today.</div>
            : <ol className="space-y-1">{heads.slice().reverse().map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex items-center gap-2 text-[11.5px]">
                  <span className="inline-flex h-5 min-w-[38px] items-center justify-center rounded-md px-1.5 font-extrabold" style={{ background: h.n >= present ? "#e7f6ee" : "#fff4e5", color: h.n >= present ? GREEN : AMBER }}>{h.n}/{expected}</span>
                  <span className="font-semibold">{timeOf(h.at)}</span>
                  <span className="text-[var(--ink-3)]">· by {h.by}</span>
                  {h.n < present && <span className="text-[#c02636]">· {present - h.n} short of {present} in</span>}
                </li>
              ))}</ol>}
        </div>
      )}
    </div>
  );
}

// A compact attendance button (In / Out / Absent) — soft tinted when active, so
// it reads clearly without shouting.
function StBtn({ label, active, tint, soft, disabled, onClick }: { label: string; active: boolean; tint: string; soft: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="h-7 flex-1 rounded-lg border text-[11.5px] font-bold transition disabled:opacity-40"
      style={active ? { borderColor: tint, background: soft, color: tint } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-3)" }}>
      {active ? "✓ " : ""}{label}
    </button>
  );
}
// A text quick-link (no emoji) — jumps straight to the right page, prefilled.
function QuickLink({ label, tint, onClick }: { label: string; tint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition hover:-translate-y-px" style={{ borderColor: "var(--line)", color: tint, background: "var(--surface)" }}>{label}</button>
  );
}
function Row({ a, start, end, showTimes, busy, age, flag, acts, selected, onSelect, onOpen, onMark, onMsg, onMed, onAccident, onIncident, onMoments, onEmail, onWhatsapp }: { a: Attendee; start: string; end: string; showTimes: boolean; busy: boolean; age?: number; flag: FlagKind; acts: { firstAid?: boolean; incident?: boolean; medication?: boolean; message?: boolean; moments?: boolean; email?: boolean; whatsapp?: boolean }; selected: boolean; onSelect: () => void; onOpen: () => void; onMark: (action: Action) => void; onMsg: () => void; onMed: () => void; onAccident: () => void; onIncident: () => void; onMoments: () => void; onEmail: () => void; onWhatsapp: () => void }) {
  const state = st(a); const c = a.child; const collected = !!a.attendance?.collectedAt; const kid = a.children[0];
  const flagText = flag === "allergy" ? c?.allergies : flag === "medical" ? c?.medical : flag === "dietary" ? c?.dietary : flag === "send" ? (c?.send || (c?.sendPlanName ? "SEND plan on file" : "")) : "";
  const fs = flag === "allergy" ? { bg: "#fde2e4", fg: "#c02636" } : flag === "medical" ? { bg: "#e0e9ff", fg: BLUE } : flag === "dietary" ? { bg: "#dcfce7", fg: "#15803d" } : { bg: "#f3e8ff", fg: "#6d28d9" };
  const inAt = showTimes && a.attendance?.inAt ? timeOf(a.attendance.inAt) : "";
  const outAt = showTimes && a.attendance?.collectedAt ? timeOf(a.attendance.collectedAt) : "";
  return (
    <div data-ui="card" className="grid grid-cols-1 items-center gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors last:border-b-0 md:grid-cols-[minmax(190px,1.3fr)_84px_minmax(200px,210px)_minmax(230px,1fr)]" style={selected ? { background: "#eef4fd" } : undefined}>
      <div className="flex min-w-0 items-center gap-2.5">
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${kid?.name}`} className="h-4 w-4 flex-none accent-[#1d3a8f]" />
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
          {c?.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.photo} alt="" className="h-11 w-11 flex-none rounded-2xl object-cover ring-2 ring-white shadow-sm" />
            : <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-[14px] font-extrabold text-[#1d3a8f] ring-2 ring-white shadow-sm" style={{ background: avBg(kid?.name ?? "?") }}>{(kid?.name ?? "?").slice(0, 1)}</span>}
          <div className="min-w-0"><div className="truncate text-[13.5px] font-extrabold">{a.children.map((k) => k.name).join(", ")} <span className="text-[11px] font-bold text-[#1d3a8f]">view ›</span></div><div className="truncate text-[11.5px] text-[var(--ink-3)]">{age != null ? `Age ${age} · ` : ""}<span className="font-bold text-[var(--ink-2)]">🕒 {start}–{end}</span>{c?.collectionPassword ? ` · 🔑 ${c.collectionPassword}` : ""}</div></div>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 md:justify-start">
        {flag
          ? (flagText ? <span className="rounded-md px-2 py-1 text-[11px] font-bold leading-tight" style={{ background: fs.bg, color: fs.fg }}>{flagText}</span> : <span className="text-[12px] text-[var(--ink-3)]">—</span>)
          : <>
              {c?.allergies && <AlertSq kind="allergy" text={`Allergy: ${c.allergies}`} />}
              {c?.medical && <AlertSq kind="medical" text={`Medical: ${c.medical}`} />}
              {(c?.send || c?.sendPlanName) && <AlertSq kind="send" text="SEND / needs" />}
              {!c?.allergies && !c?.medical && !c?.send && !c?.sendPlanName && <span className="text-[12px] text-[var(--ink-3)]">—</span>}
            </>}
      </div>
      {/* Attendance — three compact buttons */}
      <div>
        <div className="flex gap-1">
          <StBtn label="In" active={state === "present" || collected} tint={GREEN} soft="#e7f6ee" disabled={busy} onClick={() => onMark("in")} />
          <StBtn label="Collect" active={collected} tint={BLUE} soft="#eef4fd" disabled={busy || (state !== "present" && !collected)} onClick={() => onMark("collect")} />
          <StBtn label="Absent" active={state === "absent"} tint={RED} soft="#fde2e4" disabled={busy} onClick={() => onMark(state === "absent" ? "reset" : "absent")} />
        </div>
        {(inAt || outAt) && <div className="mt-1 text-center text-[10.5px] font-semibold text-[var(--ink-3)]">{inAt && `In ${inAt}`}{inAt && outAt ? " · " : ""}{outAt && `Out ${outAt}`}</div>}
      </div>
      {/* Quick actions — text links straight to the prefilled page */}
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        {acts.firstAid !== false && <QuickLink label="First aid" tint="#be123c" onClick={onAccident} />}
        {acts.incident !== false && <QuickLink label="Incident" tint="#b45309" onClick={onIncident} />}
        {acts.medication !== false && <QuickLink label="Medication" tint="#15803d" onClick={onMed} />}
        {acts.moments !== false && <QuickLink label="Add moment" tint="#7c3aed" onClick={onMoments} />}
        {acts.email !== false && <QuickLink label="Email parent" tint="#0e7490" onClick={onEmail} />}
        {acts.message !== false && <QuickLink label="Message parent" tint="#1d3a8f" onClick={onMsg} />}
        {acts.whatsapp !== false && <QuickLink label="WhatsApp" tint="#128c7e" onClick={onWhatsapp} />}
      </div>
    </div>
  );
}
