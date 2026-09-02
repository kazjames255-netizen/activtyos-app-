"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, needsNappies, type ChildQuestion } from "@/lib/settings";
import { Button } from "@/components/ui";
import { SettingsLink } from "@/components/OperatorPage";
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
// Selected/unselected styling for the filter + toggle chips. Module-level so the
// dialogs can use it too, not just the main component.
const sel = (o: boolean) => ({ borderColor: o ? BLUE : "var(--line)", background: o ? "#eef4fd" : "var(--surface)", color: o ? BLUE : "var(--ink-2)" });
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)";
// ── Aurora header ───────────────────────────────────────────────────────────
// Soft light on deep navy instead of a hard gradient, with the day's headline
// figure set large and everything else quiet around it.
//
// The pills carry a faint fill rather than being fully transparent: a pure
// ghost button looked best in the mock but is the lowest-contrast control on
// the page, and this gets read on a tablet in a sunlit sports hall.
// Matches the sidebar exactly — same gradient token, same 18px dot grid — so
// the header and the nav read as one surface rather than two blues that nearly
// agree. Defined once here and applied as a background, so no overflow-hidden
// is needed on the card (which is what clipped the listing dropdown before).
const SIDE_SURFACE = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), var(--side-bg)",
  backgroundSize: "18px 18px, cover, cover, cover, cover",
  backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
} as const;
const AURORA_BG = "#23479f"; // mid-stop of --side-bg, for the on-white pill text
const GHOST = "inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-[12.5px] font-bold text-white/95 transition hover:bg-white/20";
const GHOST_ON = "inline-flex items-center gap-1.5 rounded-lg border border-white/70 bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#0f2452] transition";

interface Attendance { status?: "in" | "absent"; inAt?: string | null; collectedAt?: string | null; collectedBy?: string | null }
interface SGRec { photo?: string; dob?: string; school?: string; allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string; collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean; likes?: string; dislikes?: string; swimming?: string; sex?: string; suncreamConsent?: boolean; firstAidConsent?: boolean; walkHomeConsent?: boolean; answers?: Record<string, string> }
interface Attendee { ref: string; booker: string; email: string; phone?: string; note?: string; addons?: string[]; bookingStatus: string; seats: number; children: { name: string; age?: number }[]; child: SGRec | null; attendance: Attendance | null }
interface Head { n: number; by: string; at: string }
interface Session { blockId: string; date: string; start: string; end: string; blockName: string; listingId: string; listingName: string; attendees: Attendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number }; heads: Head[]; takenBy: { name: string; at: string } | null }
type Action = "in" | "absent" | "collect" | "reset";
type FlagKind = "" | "allergy" | "medical" | "send" | "dietary" | "nappy";
// One definition for the flags, so the filter menu and the row chips can't
// drift apart on wording or colour.
const FLAGS = [
  { k: "allergy", label: "Allergy", fg: "#c02636" },
  { k: "medical", label: "Medical", fg: "#1d3a8f" },
  { k: "dietary", label: "Dietary", fg: "#15803d" },
  { k: "send", label: "SEND / needs", fg: "#6d28d9" },
  { k: "nappy", label: "🚼 Not toilet trained", fg: "#6d28d9" },
] as const;

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const shiftDay = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rel = (iso: string) => (iso === todayIso() ? "Today" : iso === shiftDay(todayIso(), 1) ? "Tomorrow" : dow(iso));
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const timeOf = (ts?: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
// Date AND time, for note stamps — "20 Aug 2026 · 13:03".
const stamp = (ts?: string | null) => (ts ? `${new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${timeOf(ts)}` : "");
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

// ── Nudge bell ──────────────────────────────────────────────────────────────
// A child is "late" two ways: not dropped off once the session has been running
// LATE_DROPOFF_MINS, or signed in but still not collected past the end time.
// Only ever for TODAY — yesterday's uncollected rows are a data artefact, not
// someone standing at the door, and nudging over them would be alarming.
// The session-group filter. A value is "in|08:30" (drop-off) or "out|12:30"
// (collection). The KIND is part of it because the nudge bell is scoped to the
// selected group: an 8:30 drop-off bell is noise while you're working the
// 12:30 collection, and meaningless with no group selected at all.
const passKind = (p: string) => (p ? (p.split("|")[0] as "in" | "out") : "");
const passTime = (p: string) => p.split("|")[1] ?? "";
const matchPass = (p: string, s: { start: string; end: string }) => !p || (passKind(p) === "in" ? s.start === passTime(p) : s.end === passTime(p));
const LATE_DROPOFF_MINS = 10;
type Late = { kind: "dropoff" | "collect"; mins: number; at: string };
function lateness(a: Attendee, date: string, start: string, end: string, now: number): Late | null {
  if (date !== todayIso()) return null;
  const ms = (hhmm: string) => new Date(`${date}T${hhmm}:00`).getTime();
  const state = st(a);
  if (state === "absent") return null;
  if (state === "notArrived") {
    const mins = Math.floor((now - ms(start)) / 60000);
    return mins >= LATE_DROPOFF_MINS ? { kind: "dropoff", mins, at: start } : null;
  }
  if (state === "present" && !a.attendance?.collectedAt) {
    const mins = Math.floor((now - ms(end)) / 60000);
    return mins > 0 ? { kind: "collect", mins, at: end } : null;
  }
  return null;
}
const lateFor = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`);
// The nudge wording. Warm and apologetic by default — a late parent is usually
// stuck in traffic, not neglectful, and the register is a bad place to nag from.
// Takes ALL of one parent's late children so a family with two on the register
// gets one message, not one per child — matching "a parent is messaged once"
// elsewhere on this page.
function nudgeCopy(items: { kid: string; late: Late }[], from?: string) {
  const signoff = `\n\nThanks so much,${from ? `\n${from}` : ""}`;
  const names = items.map((i) => i.kid);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  if (items.length === 1) {
    const { kid, late } = items[0];
    return late.kind === "collect"
      ? { subject: `Collection reminder — ${kid}`, body: `Hi,\n\nHope you're well. Just a gentle reminder that ${kid} is still here with us — collection was due at ${late.at}, about ${lateFor(late.mins)} ago.\n\nNo problem at all if you've been held up. Could you let us know roughly when you'll be with us, so we can make sure someone's on hand to meet you?${signoff}` }
      : { subject: `Just checking in — ${kid}`, body: `Hi,\n\nHope you're well. Just checking in — ${kid} isn't with us yet, and today's session started at ${late.at}, about ${lateFor(late.mins)} ago.\n\nNothing to worry about, we only wanted to make sure everything's OK. If they're still on their way there's no rush at all — and if plans have changed, just reply and we'll mark them absent.${signoff}` };
  }
  const lines = items.map((i) => i.late.kind === "collect"
    ? `• ${i.kid} — collection was due at ${i.late.at}, about ${lateFor(i.late.mins)} ago`
    : `• ${i.kid} — today's session started at ${i.late.at}, about ${lateFor(i.late.mins)} ago and they're not with us yet`).join("\n");
  const allCollect = items.every((i) => i.late.kind === "collect");
  const ask = allCollect
    ? `No problem at all if you've been held up. Could you let us know roughly when you'll be with us, so we can make sure someone's on hand to meet you?`
    : `Nothing to worry about — we only wanted to check everything's OK. Just reply and let us know, and we'll sort things this end.`;
  return { subject: `${allCollect ? "Collection reminder" : "Just checking in"} — ${list}`, body: `Hi,\n\nHope you're well. Just a quick note about today:\n\n${lines}\n\n${ask}${signoff}` };
}
const AV = ["#fde2e4", "#e2f0d9", "#e0e7ff", "#fff3d6", "#e5f6f8", "#f3e8ff", "#ffe9d6", "#dce7ff"];
const avBg = (n: string) => AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];


function AlertSq({ kind, text }: { kind: "allergy" | "medical" | "send"; text: string }) {
  const m = kind === "allergy" ? { bg: "#fde2e4", fg: "#c02636", label: "Allergy" } : kind === "medical" ? { bg: "#e0e9ff", fg: BLUE, label: "Medical" } : { bg: "#f3e8ff", fg: "#6d28d9", label: "SEND" };
  return <span title={text} className="rounded-md px-1.5 py-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.03em]" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

// Searchable listing picker for the hero — a button + type-to-filter popover.
function ListingPicker({ listings, venues, active, activeName, onPick }: { listings: [string, string][]; venues: Record<string, string>; active: string; activeName: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Match on the venue too — "Loughton" should find the camp held there.
  const needle = q.trim().toLowerCase();
  const shown = listings.filter(([id, n]) => `${n} ${venues[id] ?? ""}`.toLowerCase().includes(needle));
  return (
    <div className="relative">
      <button type="button" aria-label="Choose listing" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">{activeName || "Choose listing"} <span className="text-[9px]">▾</span></button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 z-20 mt-1 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-xl">
          <div className="px-1.5 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">Choose listing</div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings or venues…" className="mb-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
          <div className="max-h-[280px] overflow-y-auto">
            {shown.length === 0 ? <div className="px-2 py-2 text-[12px] text-[var(--ink-3)]">No listing matches.</div> : shown.map(([id, n]) => (
              <button key={id} type="button" onClick={() => { onPick(id); setOpen(false); setQ(""); }} className="block w-full rounded-lg px-2.5 py-1.5 text-left" style={id === active ? { background: "#eef4fd" } : undefined}>
                <span className="block truncate text-[12.5px] font-semibold" style={{ color: id === active ? "#1d3a8f" : "var(--ink-2)" }}>{n}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-3)]">📍 {venues[id] || "No venue set"}</span>
              </button>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}

// ── Child detail card — shared layout lives in ./ChildCard ──────────────────
function ChildModal({ a, showTimes, fields, card, questions, ctx, edit, canEdit, onSaveEdit, onOpenFamilies, onClose }: { a: Attendee; showTimes: boolean; fields: { contact?: boolean; emergency?: boolean; password?: boolean; school?: boolean }; card: Record<string, boolean | undefined>; questions: ChildQuestion[]; ctx: { attend: { date: string; start: string; end: string; listing: string }[]; siblings: string[] }; edit?: ChildEdit; canEdit: boolean; onSaveEdit: (patch: ChildEdit) => void; onOpenFamilies: () => void; onClose: () => void }) {
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
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[860px] flex-col gap-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <SafeguardingEditor child={a.child} edit={edit} canEdit={canEdit} onSave={onSaveEdit} onOpenFamilies={onOpenFamilies} />
        <ChildCard info={info} card={card} questions={questions} fields={fields} canSeeSafeguarding={canEdit} onClose={onClose} />
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
function DownloadDialog({ sessions, date, allDates, listingName, sessionsForDates, onClose }: { sessions: Session[]; date: string; allDates: string[]; listingName: string; sessionsForDates: (dates: string[]) => Promise<{ date: string; sessions: Session[] }[]>; onClose: () => void }) {
  const [on, setOn] = useState<Set<string>>(new Set(DL_COLS.filter((c) => c.on).map((c) => c.key)));
  const cols = DL_COLS.filter((c) => on.has(c.key));
  const total = sessions.reduce((n, s) => n + s.attendees.length, 0);
  // Which dates to export. "pick" starts on the day you opened the dialog from.
  const [scope, setScope] = useState<"one" | "all" | "pick">("one");
  const [picked, setPicked] = useState<Set<string>>(new Set([date]));
  const [busy, setBusy] = useState("");
  const dates = scope === "one" ? [date] : scope === "all" ? allDates : [...picked].sort();
  const multi = dates.length > 1;
  const togglePick = (d: string) => setPicked((p) => { const n = new Set(p); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const setAll = (keys: string[], val: boolean) => setOn((x) => { const n = new Set(x); for (const k of keys) { if (val) n.add(k); else n.delete(k); } return n; });
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
  // Both exports resolve the chosen dates first; a Date column/heading only
  // appears when more than one day is in play, so single-day output is unchanged.
  const fileStem = multi ? `register-${dates[0]}_to_${dates[dates.length - 1]}` : `register-${date}`;
  const csv = async () => {
    setBusy("csv");
    const bundle = await sessionsForDates(dates);
    const rows = [[...(multi ? ["Date"] : []), "Listing", "Session", "Child", ...cols.map((c) => c.label)]];
    for (const { date: d, sessions: ss } of bundle) for (const s of ss) for (const a of s.attendees) rows.push([...(multi ? [d] : []), s.listingName, s.blockName, a.children.map((k) => k.name).join(" / "), ...cols.map((c) => cell(c.key, s, a))]);
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }));
    const l = document.createElement("a"); l.href = url; l.download = `${fileStem}.csv`; l.click(); URL.revokeObjectURL(url);
    setBusy(""); onClose();
  };
  const pdf = async () => {
    setBusy("pdf");
    const bundle = await sessionsForDates(dates);
    const body = bundle.map(({ date: d, sessions: ss }) => (multi ? `<h1 class="day">${esc(dayLabel(d))}</h1>` : "") + ss.map((s) => `<h2>${esc(s.listingName)} — ${esc(s.blockName)} · ${s.start}–${s.end}</h2><table><tr><th>Child</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>${s.attendees.map((a) => `<tr><td>${esc(a.children.map((k) => k.name).join(", "))}</td>${cols.map((c) => `<td>${esc(cell(c.key, s, a))}</td>`).join("")}</tr>`).join("")}</table>`).join("")).join("");
    const w = window.open("", "_blank", "width=900,height=1000");
    setBusy("");
    if (!w) return;
    const title = multi ? `${esc(listingName)} — ${dates.length} days` : `Register — ${dayLabel(date)}`;
    w.document.write(`<!doctype html><title>${esc(fileStem)}</title><style>body{font:12px/1.4 system-ui,sans-serif;color:#171534;padding:16px}h1.day{font-size:15px;margin:22px 0 2px;page-break-before:always}h1.day:first-of-type{page-break-before:auto}h2{font-size:13px;margin:16px 0 4px;border-top:1px solid #ddd;padding-top:8px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border:1px solid #e5e5e5;padding:4px 6px;font-size:11px}th{background:#f5f5f5}</style><h1>${title}</h1>${body}`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300); onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold">Download register — {multi ? `${dates.length} dates` : dayLabel(date)}</div>
        <p className="mb-2 text-[12px] text-[var(--ink-3)]">{multi ? <>Exporting {dates.length} dates from {listingName}. Each day is a separate section.</> : <>{total} {total === 1 ? "child" : "children"} across {sessions.length} {sessions.length === 1 ? "session" : "sessions"}.</>} The child&rsquo;s name is always included — tick any extra columns to include.</p>
        <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel)]/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Dates</span>
            {([["one", dayLabel(date)], ["all", `All dates (${allDates.length})`], ["pick", "Pick dates…"]] as const).map(([k, label]) => (
              <button key={k} type="button" disabled={k !== "one" && allDates.length === 0} onClick={() => setScope(k)} className="rounded-lg border px-2.5 py-1 text-[11.5px] font-bold disabled:opacity-40" style={sel(scope === k)}>{label}</button>
            ))}
          </div>
          {scope === "pick" && (
            <div className="mt-2 max-h-[132px] overflow-y-auto border-t border-[var(--line)] pt-2">
              <div className="flex flex-wrap gap-1">
                {allDates.map((d) => (
                  <button key={d} type="button" onClick={() => togglePick(d)} className="rounded-lg border px-2 py-1 text-[11px] font-bold" style={sel(picked.has(d))}>{dayLabel(d)}</button>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <button type="button" onClick={() => setPicked(new Set(allDates))} className="font-bold text-[#1d3a8f] underline">select all</button>
                <button type="button" onClick={() => setPicked(new Set())} className="font-bold text-[var(--ink-3)] underline">clear</button>
                <span className="text-[var(--ink-3)]">{picked.size} selected</span>
              </div>
            </div>
          )}
          {allDates.length === 0 && <div className="mt-1 text-[11px] text-[var(--ink-3)]">Only this date is available — this listing&rsquo;s other dates haven&rsquo;t loaded.</div>}
        </div>
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
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3"><Button sm onClick={onClose}>Cancel</Button><div className="flex gap-2"><Button sm disabled={!!busy || !dates.length} onClick={pdf}>{busy === "pdf" ? "Preparing…" : "🖨 PDF (printable)"}</Button><Button sm variant="solid" disabled={!!busy || !dates.length} onClick={csv}>{busy === "csv" ? "Preparing…" : "⭳ CSV"}</Button></div></div>
      </div>
    </div>
  );
}

/** register view — freelancer, company, franchise and staff portals. */
// Photo-gallery tile — an at-a-glance card for the "Photos" register view.
// Grey + desaturated when the child isn't on site (not signed in); a status
// pill (In / Out / Due / Absent), the sign-in / collected times, the expected
// window, and allergy / medical / dietary / SEND flags under the name.
// Tap the PHOTO to sign in / out; tap the NAME for the full child card.
function GalTile({ a, start, end, showTimes, busy, showConsent, onMark, onOpen }: { a: Attendee; start: string; end: string; showTimes: boolean; busy: boolean; showConsent: boolean; onMark?: (action: Action) => void; onOpen: () => void }) {
  const state = st(a);
  const collected = !!a.attendance?.collectedAt;
  const dim = state !== "present"; // grey unless they're actually on site
  const kid = a.children[0];
  const initials = (kid?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const badge = collected ? { t: "Out", bg: "#e0e9ff", fg: BLUE }
    : state === "present" ? { t: "In", bg: "#e7f6ee", fg: GREEN }
    : state === "absent" ? { t: "Absent", bg: "#fde2e4", fg: RED }
    : { t: "Due", bg: "#fef3d8", fg: AMBER };
  // tap cycles: due/absent → in, in → collect (out), collected → reset (back to due)
  const nextAction: Action = collected ? "reset" : state === "present" ? "collect" : "in";
  const tapHint = busy ? "…" : collected ? "Tap to reset" : state === "present" ? "Tap to sign out" : "Tap to sign in";
  const flags: { t: string; bg: string; fg: string }[] = [];
  if (a.child?.allergies) flags.push({ t: "Allergy", bg: "#fde2e4", fg: "#c02636" });
  if (a.child?.medical) flags.push({ t: "Medical", bg: "#e0e9ff", fg: BLUE });
  if (a.child?.dietary) flags.push({ t: "Dietary", bg: "#dcfce7", fg: "#15803d" });
  if (a.child?.send || a.child?.sendPlanName) flags.push({ t: "SEND", bg: "#f3e8ff", fg: "#6d28d9" });
  return (
    <div className="flex flex-col items-center rounded-xl p-2 text-center">
      <button type="button" disabled={!onMark || busy} onClick={() => onMark?.(nextAction)} title={onMark ? tapHint : undefined} className="relative disabled:cursor-default">
        <div className={"grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#eef1f6] text-[15px] font-extrabold text-[#94a3b8] ring-1 ring-[var(--line)] transition " + (dim ? "opacity-40 grayscale" : "") + (onMark ? " hover:ring-2 hover:ring-[#1d3a8f]" : "")}>
          {a.child?.photo ? <img src={a.child.photo} alt="" className="h-full w-full object-cover" /> : initials}
        </div>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-extrabold shadow-sm" style={{ background: badge.bg, color: badge.fg }}>{busy ? "…" : badge.t}</span>
      </button>
      <button type="button" onClick={onOpen} className="mt-2.5 text-[12.5px] font-extrabold leading-tight text-[var(--ink)] hover:underline">{kid?.name ?? "—"}</button>
      {flags.length > 0 && <div className="mt-1 flex flex-wrap justify-center gap-1">{flags.map((f) => <span key={f.t} className="rounded px-1 py-[1px] text-[8.5px] font-extrabold uppercase" style={{ background: f.bg, color: f.fg }}>{f.t}</span>)}</div>}
      {showConsent && a.child?.photoConsent != null && <div className="mt-1 flex justify-center"><PhotoConsentChip ok={!!a.child.photoConsent} /></div>}
      <div className="mt-1 text-[10px] leading-[1.35] text-[var(--ink-3)]">
        {showTimes && a.attendance?.inAt && <div>In {timeOf(a.attendance.inAt)}</div>}
        {collected && <div>Out {timeOf(a.attendance?.collectedAt)}{a.attendance?.collectedBy ? ` · ${a.attendance.collectedBy}` : ""}</div>}
        {(start || end) && <div className="opacity-80">Exp {start}–{end}</div>}
      </div>
      {onMark && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1d3a8f]/70">{tapHint}</div>}
    </div>
  );
}

// ── Register notes (staff jottings per child per day) ────────────────────────
// Demo store; real per-tenant notes are Amir's. Keyed `${date}|${ref}`.
// When each family was last nudged, keyed `${date}|${ref}` — same demo-store
// shape as the notes below. Local on purpose: it's a "have I already chased
// them" marker for whoever holds the register, not tenant state.
const NUDGES_KEY = "aos.register.nudges.v1";
const loadNudges = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(NUDGES_KEY) || "{}") || {}; } catch { return {}; } };
// Nappy changes, keyed `${date}|${ref}` → the day's log. Demo store like the
// notes below; the permanent per-child record is Amir's.
const NAPPY_KEY = "aos.register.nappies.v1";
interface NappyChange { at: string; by: string }
const loadNappies = (): Record<string, NappyChange[]> => { try { return JSON.parse(localStorage.getItem(NAPPY_KEY) || "{}") || {}; } catch { return {}; } };
const NOTES_KEY = "aos.register.notes.v1";
interface RegNote { text: string; at: string; by: string; archived?: boolean; shareParent?: boolean }
const loadNotes = (): Record<string, RegNote> => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") || {}; } catch { return {}; } };
const NOTE_SVG = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h9l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M14 4v5h5M8 13h7M8 16.5h5" /></svg>;

// A small note icon on the row — amber with a red dot when an active note
// exists; clicking opens the note popup.
function NoteChip({ note, onClick }: { note?: RegNote; onClick: () => void }) {
  const active = !!note?.text?.trim() && !note?.archived;
  return (
    <button type="button" onClick={onClick} title={active ? "Important note — click to view" : "Add an important note"} aria-label="Important note"
      className={"relative grid h-7 w-7 place-items-center rounded-lg border transition " + (active ? "border-[#f3d9a7] bg-[#fff7e6] text-[#b45309]" : "border-[var(--line)] bg-white text-[var(--ink-3)] hover:border-[#c9dcfa] hover:text-[#1d3a8f]")}>
      {NOTE_SVG}
      {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#e11d48] ring-2 ring-white" />}
    </button>
  );
}

// Fancy click-popup for an Important note — edit, delete (→ archive), and (admins
// only) restore / delete forever.
function NotePopup({ name, note, canDeleteForever, onSave, onArchive, onRestore, onDeleteForever, onClose }: { name: string; note?: RegNote; canDeleteForever: boolean; onSave: (text: string, shareParent: boolean) => void; onArchive: () => void; onRestore: () => void; onDeleteForever: () => void; onClose: () => void }) {
  const archived = !!note?.text && !!note?.archived;
  // When the existing note is archived the editor starts BLANK — you're writing
  // a fresh note, not editing the filed-away one. The old note stays reachable
  // in the collapsed archive folder below.
  const [text, setText] = useState(archived ? "" : note?.text ?? "");
  const [share, setShare] = useState(archived ? false : !!note?.shareParent);
  const [confirmDel, setConfirmDel] = useState(false);
  const [openArchive, setOpenArchive] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,.5)]" style={LIGHT_PALETTE} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#fff7e6] to-[#fdeede] px-4 py-3 text-[#b45309]">
          {NOTE_SVG}<span className="text-[14px] font-extrabold">Important note</span>{name && <span className="text-[12px] font-semibold text-[#b45309]/70">· {name}</span>}
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-7 w-7 place-items-center rounded-full text-[#b45309] hover:bg-white/60">✕</button>
        </div>
        <div className="p-4">
          {/* The archive is a closed folder — click to look inside. It never
              blocks writing: the notepad below stays available either way. */}
          {archived && (
            <div className="mb-3 overflow-hidden rounded-lg border border-[var(--line)]">
              <button type="button" onClick={() => setOpenArchive((v) => !v)} aria-expanded={openArchive} className="flex w-full items-center gap-2 bg-[#eef1f6] px-3 py-2 text-left text-[12px] font-bold text-[var(--ink-2)]">
                <span>{openArchive ? "📂" : "🗄️"}</span>
                <span>Archived note — not shown on the register</span>
                <span className="ml-auto text-[10px] text-[var(--ink-3)]">{openArchive ? "hide" : "view"} ▾</span>
              </button>
              {openArchive && (
                <div className="border-t border-[var(--line)] p-3">
                  <p className="whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-[13px] leading-snug text-[var(--ink-2)]">{note!.text}</p>
                  {note!.at && <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Archived {stamp(note!.at)}{note!.by ? ` · by ${note!.by}` : ""}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { onRestore(); onClose(); }} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white hover:brightness-110">↩ Restore</button>
                    {canDeleteForever ? (confirmDel
                      ? <span className="flex items-center gap-2 text-[12px]"><b className="text-[#c02636]">Delete permanently?</b><button type="button" onClick={() => { onDeleteForever(); onClose(); }} className="rounded-full bg-[#c02636] px-3 py-1 text-[11.5px] font-extrabold text-white">Yes, forever</button><button type="button" onClick={() => setConfirmDel(false)} className="text-[11.5px] font-bold text-[var(--ink-3)]">cancel</button></span>
                      : <button type="button" onClick={() => setConfirmDel(true)} className="rounded-full border border-[#f3c6c1] bg-white px-4 py-1.5 text-[12px] font-extrabold text-[#c02636] hover:bg-[#fdecec]">🗑 Delete forever</button>)
                      : <span className="text-[11px] text-[var(--ink-3)]">Only an admin can delete forever.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
          {archived && <div className="mb-2 text-[11.5px] font-bold text-[var(--ink-3)]">✍️ Write a new note</div>}
          <>
              {/* Legal-pad look: ruled lines + a red margin painted as the
                  textarea's own background, so they scroll with the text
                  (background-attachment: local) and stay aligned when it grows.
                  Line height must match the rule spacing or text drifts off. */}
              <div className="overflow-hidden rounded-xl border border-[#e8d5ae] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(180,83,9,.12)]">
                <div className="flex items-center gap-1.5 border-b border-dashed border-[#e8d5ae] bg-[#fdf2d9] px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#d9c092] shadow-[inset_0_1px_1px_rgba(0,0,0,.18)]" />
                  <span className="h-2 w-2 rounded-full bg-[#d9c092] shadow-[inset_0_1px_1px_rgba(0,0,0,.18)]" />
                  <span className="h-2 w-2 rounded-full bg-[#d9c092] shadow-[inset_0_1px_1px_rgba(0,0,0,.18)]" />
                  <span className="ml-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[#b45309]/60">Notepad</span>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus placeholder="Note for the team — e.g. leaving early with grandma, didn’t eat much lunch…"
                  className="block w-full resize-y border-0 bg-transparent py-0 pl-11 pr-3 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[#bda981]"
                  style={{
                    lineHeight: "28px",
                    backgroundColor: "#fffdf4",
                    backgroundImage: "repeating-linear-gradient(to bottom,transparent 0,transparent 27px,#ecdcbb 27px,#ecdcbb 28px),linear-gradient(to right,transparent 0,transparent 31px,#f0aca2 31px,#f0aca2 32px,transparent 32px)",
                    backgroundAttachment: "local",
                  }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                <div><div className="text-[12.5px] font-bold text-[var(--ink)]">👪 Let the parent see this note</div><div className="text-[11px] text-[var(--ink-3)]">{share ? "The family will see it in their app." : "Staff-only — hidden from the parent."}</div></div>
                <button type="button" role="switch" aria-checked={share} onClick={() => setShare((s) => !s)} className={"relative h-6 w-11 flex-none rounded-full transition-colors " + (share ? "bg-[#0f9d58]" : "bg-[#cbd5e1]")}><span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " + (share ? "left-[22px]" : "left-0.5")} /></button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" disabled={!text.trim()} onClick={() => { onSave(text.trim(), share); onClose(); }} className="rounded-full bg-[#b45309] px-5 py-2 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40">Save note</button>
                {!archived && note?.text && <button type="button" onClick={() => { onArchive(); onClose(); }} className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">🗑 Delete</button>}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">{!archived && note?.at ? `Updated ${stamp(note.at)}${note.by ? ` by ${note.by}` : ""}. ` : ""}{archived ? "Saving replaces the archived note on the register." : <>Deleting <b>archives</b> it — an admin can then remove it for good.</>}</p>
            </>
        </div>
      </div>
    </div>
  );
}

// ── Safeguarding quick-edit (SEND / allergies / medical) ─────────────────────
// Managers/leads can amend a child's needs from the register. Saves to a local
// overlay (shows on the register instantly); the permanent per-child record +
// multi-device sync are Amir's (needs childId in the /api/registers projection
// + a lead-gated PUT /api/children/:id). Keyed by booking ref.
const CHILD_EDITS_KEY = "aos.register.childedits.v1";
type ChildEdit = Partial<{ allergies: string; medical: string; dietary: string; send: string; careNotes: string }>;
const loadChildEdits = (): Record<string, ChildEdit> => { try { return JSON.parse(localStorage.getItem(CHILD_EDITS_KEY) || "{}") || {}; } catch { return {}; } };

function SafeguardingEditor({ child, edit, canEdit, onSave, onOpenFamilies }: { child: { allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string } | null; edit?: ChildEdit; canEdit: boolean; onSave: (patch: ChildEdit) => void; onOpenFamilies: () => void }) {
  const cur = { ...(child ?? {}), ...(edit ?? {}) };
  const [f, setF] = useState({ allergies: cur.allergies ?? "", medical: cur.medical ?? "", send: cur.send ?? cur.sendPlanName ?? "", dietary: cur.dietary ?? "", careNotes: cur.careNotes ?? "" });
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };
  const save = () => { onSave({ allergies: f.allergies.trim(), medical: f.medical.trim(), send: f.send.trim(), dietary: f.dietary.trim(), careNotes: f.careNotes.trim() }); setSaved(true); };
  const Field = (label: string, key: keyof typeof f, tint: string, ph: string) => (
    <label className="block"><span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: tint }}>{label}</span>
      <textarea value={f[key]} onChange={(e) => set(key, e.target.value)} rows={2} placeholder={ph} className="mt-1 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#6d28d9]" /></label>
  );
  return (
    <div className="rounded-2xl border border-[#e0d3f5] bg-[#faf7ff] p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[15px]">🛟</span>
        <span className="text-[13px] font-extrabold text-[#6d28d9]">SEND, allergies &amp; medical — add / amend</span>
        <span className="ml-auto text-[12px] text-[var(--ink-3)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (<>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Field("Allergies", "allergies", "#c02636", "e.g. Peanuts — EpiPen in bag")}
          {Field("Medical", "medical", "#1d3a8f", "e.g. Asthma — blue inhaler with staff")}
          {Field("SEND / additional needs", "send", "#6d28d9", "e.g. ASD — needs a quiet space")}
          {Field("Dietary", "dietary", "#15803d", "e.g. Halal · vegetarian")}
          <div className="sm:col-span-2">{Field("Care notes", "careNotes", "#b45309", "Anything the team should know today")}</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} className="rounded-full bg-[#6d28d9] px-4 py-1.5 text-[12px] font-extrabold text-white hover:brightness-110">{saved ? "Saved to register ✓" : "Save to register"}</button>
          <button type="button" onClick={onOpenFamilies} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Also update the family record →</button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">Shows on today’s register straight away. The permanent per-child record + other devices sync once your provider’s staff-edit update is live.</p>
      </>)}
    </div>
  );
}

// Photo-permission indicator — a clean camera chip: green tick = photos allowed,
// red crossed camera = not allowed.
// Likes / dislikes at a glance. A real tooltip rather than `title=`: the native
// one waits about a second, vanishes on the slightest move, and never appears
// on touch or keyboard at all. This opens the instant the pointer lands, stays
// while you read it, and also opens on focus/tap — so it works on the tablet
// the register is actually held on.
function LikesChip({ likes, dislikes }: { likes?: string; dislikes?: string }) {
  // Hover and "pinned" are separate on purpose. Sharing one boolean means a tap
  // latches it open and a later hover can't close it, which is what made this
  // feel unreliable. Hover shows it always; click/focus pins it for touch and
  // keyboard. The panel is INSIDE the hover target, so moving the pointer onto
  // the text doesn't dismiss it mid-read.
  const [pinned, setPinned] = useState(false);
  if (!likes && !dislikes) return null;
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label="Likes and dislikes" aria-expanded={pinned}
        onClick={() => setPinned((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-lg border border-[#cbead8] bg-[#eafaf1] text-[13px] leading-none transition hover:brightness-95">😊</button>
      {/* Hover is pure CSS — the browser's own hit-testing, so it can't miss an
          event the way a JS mouseenter can. `pinned` (a tap) and focus-within
          (keyboard) add the paths CSS hover can't cover on touch. */}
      <span role="tooltip"
        className={"absolute left-1/2 top-full z-30 mt-1.5 w-[248px] -translate-x-1/2 rounded-xl border border-[var(--line)] bg-white p-2.5 text-left shadow-xl "
          + (pinned ? "block" : "hidden group-hover:block group-focus-within:block")}>
          {likes && <span className="block"><b className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#15803d]">Likes</b><span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-[var(--ink)]">{likes}</span></span>}
          {dislikes && <span className={"block " + (likes ? "mt-2" : "")}><b className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#b45309]">Dislikes / avoid</b><span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-[var(--ink)]">{dislikes}</span></span>}
      </span>
    </span>
  );
}
// A toolbar dropdown. The register had grown to fourteen controls across three
// rows — every filter, sort and display toggle sitting at the same visual
// weight, so nothing read as more important than anything else. Grouping the
// quiet ones behind menus leaves the two things you actually press mid-session
// (Roll call, Message all attending) standing on their own.
function Menu({ label, on, badge, width = 250, dark, children }: { label: ReactNode; on?: boolean; badge?: number; width?: number; dark?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={dark
          ? (on ? GHOST_ON : GHOST)
          : "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[12px] font-bold"}
        style={dark ? undefined : sel(!!on)}>
        {label}
        {badge ? <span className={"rounded-full px-1.5 text-[10px] font-extrabold " + (dark && !on ? "bg-white text-[#0f2452]" : "bg-[#1d3a8f] text-white")}>{badge}</span> : null}
        <span className="text-[9px] opacity-70">▾</span>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 z-20 mt-1 rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-xl" style={{ width }}>{children(() => setOpen(false))}</div>
      </>)}
    </div>
  );
}
// One row inside a Menu — radio (pick one) or checkbox (toggle) styling.
function MenuItem({ on, onClick, dot, children, hint }: { on: boolean; onClick: () => void; dot?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--panel)]">
      <span className="grid h-4 w-4 flex-none place-items-center rounded border text-[10px] font-extrabold"
        style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)" }}>{on ? "✓" : ""}</span>
      {dot && <span className="h-2 w-2 flex-none rounded-full" style={{ background: dot }} />}
      <span className="flex-1 text-[12.5px] font-semibold text-[var(--ink)]">{children}</span>
      {hint != null && <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{hint}</span>}
    </button>
  );
}
function PhotoConsentChip({ ok }: { ok: boolean }) {
  return (
    <span title={ok ? "Photo permission: yes" : "Photo permission: no — do not photograph"} aria-label={ok ? "Photos allowed" : "No photos"}
      className={"grid h-7 w-7 place-items-center rounded-lg border " + (ok ? "border-[#bfe6cf] bg-[#eafaf1] text-[#0f7a43]" : "border-[#f3c6c1] bg-[#fdecec] text-[#c02636]")}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h3l1.4-2h7.2L18 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.2" />
        {!ok && <path d="M4 4l16 16" />}
      </svg>
    </span>
  );
}

// Collection password — hidden by default; tap the key to reveal (auto-hides).
function CollectPin({ pw }: { pw: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 4000); return () => clearTimeout(t); }, [show]);
  return (
    <button type="button" onClick={() => setShow((s) => !s)} title="Collection password — tap to reveal"
      className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold transition-all " + (show ? "border-[#f3d9a7] bg-[#fff7e6] text-[#b45309] shadow-sm" : "border-[var(--line)] bg-white text-[var(--ink-3)] hover:border-[#c9dcfa] hover:text-[#1d3a8f]")}>
      🔑 <span className={"tabular-nums " + (show ? "tracking-normal" : "tracking-[0.15em]")}>{show ? pw : "••••"}</span>
    </button>
  );
}

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
  // Ticks so the nudge bell appears on its own as a child tips over the line —
  // nobody should have to reload the register to find out someone is late.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const [activeListing, setActiveListing] = useState<string>("");
  const seasons = settings.seasons ?? [];
  const [regSeason, setRegSeason] = useState("");
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  // Listing → venue name, for the picker's second line. ?mine=1 returns the raw
  // listing (venueId only, unlike the public feed which resolves `location`),
  // so the names have to come from the library and be joined here.
  const [listingVenue, setListingVenue] = useState<Record<string, string>>({});
  // Every date a listing actually runs, from its blocks' sessions — the Download
  // dialog offers these as "all dates" / "pick dates". Comes free with the call
  // below (?mine=1 embeds blocks), so no extra round-trip to discover them.
  const [listingDates, setListingDates] = useState<Record<string, string[]>>({});
  useEffect(() => {
    Promise.all([
      apiGet<{ id: string; seasonId?: string | null; venueId?: string | null; blocks?: { sessions?: { date: string }[] }[] }[]>("/api/listings?mine=1"),
      apiGet<{ venues?: { id: string; name: string }[] } | null>("/api/library").catch(() => null),
    ]).then(([ls, lib]) => {
      const rows = ls ?? [];
      setListingSeason(Object.fromEntries(rows.filter((l) => l.seasonId).map((l) => [l.id, l.seasonId as string])));
      const venueName = new Map((lib?.venues ?? []).map((v) => [v.id, v.name]));
      setListingVenue(Object.fromEntries(rows.flatMap((l) => {
        const name = l.venueId ? venueName.get(l.venueId) : undefined;
        return name ? [[l.id, name] as [string, string]] : [];
      })));
      setListingDates(Object.fromEntries(rows.map((l) => [
        l.id,
        [...new Set((l.blocks ?? []).flatMap((b) => (b.sessions ?? []).map((s) => s.date)).filter(Boolean))].sort(),
      ])));
    }).catch(() => {});
  }, []);
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
  const [nudgeFor, setNudgeFor] = useState<{ a: Attendee; late: Late } | null>(null);
  const [openKid, setOpenKid] = useState<Attendee | null>(null);
  const [heroOpen, setHeroOpen] = useState(true); // collapse the headline + toolbar to give the list room
  const [view, setView] = useState<"list" | "gallery">("list"); // List table vs Photos overview
  const [galFilter, setGalFilter] = useState<"all" | "present" | "notArrived" | "absent" | "collected">("all");
  const [showConsent, setShowConsent] = useState(false); // reveal photo-permission chips
  const [showLikes, setShowLikes] = useState(false); // reveal the likes/dislikes chip per child
  const [notes, setNotes] = useState<Record<string, RegNote>>({});
  useEffect(() => { setNotes(loadNotes()); }, []);
  const [nudges, setNudges] = useState<Record<string, string>>({});
  useEffect(() => { setNudges(loadNudges()); }, []);
  const [nappies, setNappies] = useState<Record<string, NappyChange[]>>({});
  useEffect(() => { setNappies(loadNappies()); }, []);
  const logNappy = useCallback((ref: string, d: string, by: string) => setNappies((prev) => {
    const k = `${d}|${ref}`;
    const next = { ...prev, [k]: [...(prev[k] ?? []), { at: new Date().toISOString(), by }] };
    try { localStorage.setItem(NAPPY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  }), []);
  const markNudged = useCallback((refs: string[], d: string) => setNudges((prev) => {
    const at = new Date().toISOString();
    const next = { ...prev };
    for (const r of refs) next[`${d}|${r}`] = at;
    try { localStorage.setItem(NUDGES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  }), []);
  const [role, setRole] = useState("");
  const canEditChild = ["company", "franchise", "freelancer", "owner", "manager"].includes(role); // managers; staff-lead editing pending the lead flag (Amir)
  const [edits, setEdits] = useState<Record<string, ChildEdit>>({});
  useEffect(() => { setEdits(loadChildEdits()); }, []);
  const applyEdit = (a: Attendee): Attendee => { const e = edits[a.ref]; return e && a.child ? { ...a, child: { ...a.child, ...e } } : a; };
  const saveEdit = (ref: string, patch: ChildEdit) => setEdits((prev) => { const next = { ...prev, [ref]: { ...prev[ref], ...patch } }; try { localStorage.setItem(CHILD_EDITS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const noteKey = (ref: string) => `${date}|${ref}`;
  const [noteFor, setNoteFor] = useState<{ ref: string; name: string } | null>(null);
  const canDeleteForever = canEditChild; // admins/managers only — staff can archive but not delete forever
  const mutateNote = (ref: string, fn: (n: RegNote | undefined) => RegNote | null) => setNotes((prev) => {
    const k = noteKey(ref); const res = fn(prev[k]); const next = { ...prev };
    if (res) next[k] = res; else delete next[k];
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const saveNote = (ref: string, text: string, shareParent = false) => mutateNote(ref, () => (text.trim() ? { text: text.trim(), at: new Date().toISOString(), by: "You", archived: false, shareParent } : null));
  const archiveNote = (ref: string) => mutateNote(ref, (n) => (n ? { ...n, archived: true } : null));
  const restoreNote = (ref: string) => mutateNote(ref, (n) => (n ? { ...n, archived: false, at: new Date().toISOString() } : null));
  const deleteNoteForever = (ref: string) => mutateNote(ref, () => null);

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
  const [meName, setMeName] = useState("You");
  useEffect(() => { apiGet<{ role: string; name?: string }>("/api/me").then((me) => { setReadOnly(me.role === "platform"); setRole(me.role); if (me.name?.trim()) setMeName(me.name.trim()); }).catch(() => {}); }, []);
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
  // Nudge a late parent — opens a composer OVER the register rather than
  // navigating away, so nobody loses their place mid-register.
  function nudge(a: Attendee, late: Late) {
    if (!a.email) { setError(`No contact email on file for ${a.booker}.`); return; }
    setNudgeFor({ a, late });
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
  // Sessions for an arbitrary set of dates, for a multi-date download. Uses the
  // day cache where it can and fetches the rest in parallel WITHOUT writing them
  // into `days` — a whole-listing export shouldn't bloat the register's state.
  // Declared after `active`/`pass` so the dep array doesn't read them in TDZ.
  // Capped at 6 in flight: a term-long listing can carry 200+ dates and firing
  // that many requests at once would hammer the API for one download.
  const sessionsForDates = useCallback(async (dates: string[]) => {
    const out: { date: string; sessions: Session[] }[] = [];
    const queue = [...dates];
    const worker = async () => {
      for (let d = queue.shift(); d !== undefined; d = queue.shift()) {
        const cached = days[d];
        const list = cached !== undefined ? cached : await apiGet<Session[]>(`/api/registers?date=${d}`).catch(() => [] as Session[]);
        const ss = (list ?? []).filter((s) => s.listingId === active && matchPass(pass, s));
        if (ss.length) out.push({ date: d, sessions: ss });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, dates.length) }, worker));
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [days, active, pass]);

  // One flat list of children for the listing on the day, each tagged with its
  // block (pass) so it can be marked, then filtered by pass and searched.
  type FlatRow = { a: Attendee; blockId: string; start: string; end: string };
  const flat: FlatRow[] = daySessions.flatMap((s) => s.attendees.map((a) => ({ a: applyEdit(a), blockId: s.blockId, start: s.start, end: s.end })));
  // Lateness is only surfaced INSIDE a selected group: an arrival bell belongs
  // to that drop-off's filter, a collection bell to that collection's. With
  // "All sessions" there is no group, so no bells — a mixed list of "8:30 late"
  // and "4pm late" is noise you can't act on as one job.
  const visibleLate = (a: Attendee, start: string, end: string): Late | null => {
    if (!pass) return null;
    const l = lateness(a, date, start, end, now);
    if (!l) return null;
    const want = passKind(pass) === "in" ? "dropoff" : "collect";
    return l.kind === want ? l : null;
  };
  // Every late family in the CURRENT group, each carrying its own lateness so a
  // bulk nudge quotes the right time per child. No email = can't nudge.
  const lateAll = flat
    .map((r) => ({ a: r.a, late: visibleLate(r.a, r.start, r.end) }))
    .filter((x): x is { a: Attendee; late: Late } => !!x.late && !!x.a.email);
  // One entry per drop-off AND per collection across the day's sessions, in
  // clock order, so you can work "12:30pm collection" as its own group.
  const passOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of daySessions) {
      m.set(`in|${s.start}`, `${fmt12(s.start)} drop-off`);
      m.set(`out|${s.end}`, `${fmt12(s.end)} collection`);
    }
    return [...m.entries()].map(([v, label]) => ({ v, label })).sort((a, b) => passTime(a.v).localeCompare(passTime(b.v)) || a.v.localeCompare(b.v));
  }, [daySessions]);
  const inPass = (r: FlatRow) => matchPass(pass, r);
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
  const hasFlag = (a: Attendee, k: FlagKind) => k === "allergy" ? !!a.child?.allergies : k === "medical" ? !!a.child?.medical : k === "dietary" ? !!a.child?.dietary : k === "send" ? !!(a.child?.send || a.child?.sendPlanName) : k === "nappy" ? needsNappies(questions, a.child?.answers) : true;
  const flatShown = flat
    .filter((r) => matchPass(pass, r))
    .filter(({ a }) => !flag || hasFlag(a, flag))
    .filter(({ a }) => !addonsOnly || (a.addons?.length ?? 0) > 0)
    .filter(({ a }) => !term || a.children.some((c) => c.name.toLowerCase().includes(term)) || a.booker.toLowerCase().includes(term))
    .slice()
    .sort(cmp);
  // Photos view — same filtered set, sub-filtered by attendance state (a
  // collected child is "Out", otherwise present / not-arrived / absent).
  const galStat = (a: Attendee): "present" | "absent" | "notArrived" | "collected" => (a.attendance?.collectedAt ? "collected" : st(a));
  const galRows = view === "gallery" ? flatShown.filter(({ a }) => galFilter === "all" || galStat(a) === galFilter) : flatShown;
  const galCounts = {
    all: flatShown.length,
    present: flatShown.filter(({ a }) => galStat(a) === "present").length,
    notArrived: flatShown.filter(({ a }) => galStat(a) === "notArrived").length,
    absent: flatShown.filter(({ a }) => galStat(a) === "absent").length,
    collected: flatShown.filter(({ a }) => galStat(a) === "collected").length,
  };
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
  const inPassRows = flat.filter((r) => matchPass(pass, r));
  // Offered only when Setup has the fields on and someone has an answer —
  // a toggle that reveals nothing is just a puzzle.
  const likesOn = (card.likes !== false || card.dislikes !== false)
    && inPassRows.some((r) => (card.likes !== false && r.a.child?.likes) || (card.dislikes !== false && r.a.child?.dislikes));
  const flagCounts = { allergy: inPassRows.filter((r) => hasFlag(r.a, "allergy")).length, medical: inPassRows.filter((r) => hasFlag(r.a, "medical")).length, dietary: inPassRows.filter((r) => hasFlag(r.a, "dietary")).length, send: inPassRows.filter((r) => hasFlag(r.a, "send")).length, nappy: inPassRows.filter((r) => hasFlag(r.a, "nappy")).length };

  // Everyone currently shown (respects the pass filter + search) → the audience
  // for "Message all attending", de-duplicated by email.
  // Recipients de-duplicate by email (normalised) — two children in one family
  // share a parent, so that parent is messaged ONCE. The button, though, counts
  // attending children, which is what "all attending" means to the eye.
  const attendingEmails = [...new Set(flatShown.map(({ a }) => a.email.trim().toLowerCase()).filter(Boolean))];
  const attendingKids = flatShown.reduce((n, { a }) => n + a.children.length, 0);
  const dayCounts = (d: string) => { const ss = sessionsOn(d); return { booked: ss.reduce((n, s) => n + s.counts.expected, 0), present: ss.reduce((n, s) => n + s.counts.present, 0) }; };
  // Head count / stats aggregate the day (respecting the pass filter).
  const passBlocks = daySessions.filter((s) => matchPass(pass, s));
  const agg = passBlocks.reduce((o, s) => ({ expected: o.expected + s.counts.expected, present: o.present + s.counts.present, notArrived: o.notArrived + s.counts.notArrived, absent: o.absent + s.counts.absent, collectedCount: o.collectedCount + s.counts.collected }), { expected: 0, present: 0, notArrived: 0, absent: 0, collectedCount: 0 });
  const pct = agg.expected ? Math.round((agg.present / agg.expected) * 100) : 0;
  const presentAll = passBlocks.flatMap((s) => s.attendees.filter((a) => st(a) === "present"));
  const allHeads = passBlocks.flatMap((s) => s.heads).slice().sort((a, b) => a.at.localeCompare(b.at));
  const lastHead = allHeads.at(-1);
  const notInRefs = flat.filter(inPass).filter((r) => st(r.a) === "notArrived");

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
          {/* Aurora header — one card holding the day, its headline figure and
              every control. Blobs live in their own clipped layer so the card
              itself keeps no overflow-hidden (that clipped the listing
              dropdown), and the pills sit above them. */}
          <div className="relative mb-3.5 rounded-2xl p-5 text-white shadow-[0_18px_44px_-20px_rgba(9,22,56,.75)]" style={SIDE_SURFACE}>
            <div className="relative">
              {/* Context row — which season, listing and day you're looking at. */}
              <div className="flex flex-wrap items-center gap-2">
                {seasons.length > 0 && (
                  <span className="relative inline-flex items-center">
                    <select value={regSeason} onChange={(e) => { setRegSeason(e.target.value); setActiveListing(""); }} title="Filter listings by season" className="appearance-none rounded-lg border border-white/30 bg-white/10 py-1.5 pl-3 pr-7 text-[12.5px] font-bold text-white outline-none [&>option]:text-[var(--ink)]">
                      <option value="">📅 All seasons</option>
                      {seasons.map((s) => <option key={s.id} value={s.id}>📅 {s.name}</option>)}
                    </select>
                    <span aria-hidden className="pointer-events-none absolute right-2.5 text-[9px] text-white/70">▾</span>
                  </span>
                )}
                {listingsAll.length > 1
                  ? <ListingPicker listings={listingsAll} venues={listingVenue} active={active} activeName={activeName} onPick={setActiveListing} />
                  : <span className={GHOST}>🎟 {activeName || "—"}</span>}
                {activeSeason && <span className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[12px] font-bold text-white/90">📅 {activeSeason}</span>}
                <div className="flex items-center gap-0.5 rounded-lg border border-white/30 bg-white/10 px-1 py-0.5">
                  <button type="button" onClick={() => goDay(-1)} aria-label="Previous day" className="flex h-7 w-7 items-center justify-center rounded-md text-[17px] font-extrabold leading-none text-white hover:bg-white/20">‹</button>
                  <span className="min-w-[168px] px-1 text-center text-[12.5px] font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{rel(date)} · {dow(date)}{dayCounts(date).booked ? ` — ${dayCounts(date).booked} booked` : ""}</span>
                  <button type="button" onClick={() => goDay(1)} aria-label="Next day" className="flex h-7 w-7 items-center justify-center rounded-md text-[17px] font-extrabold leading-none text-white hover:bg-white/20">›</button>
                  <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[13px] hover:bg-white/20" title="Pick any date">📅
                    <input type="date" value={date} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <SettingsLink />
                  <button type="button" onClick={() => setDlOpen(true)} className={GHOST}>⬇ Download</button>
                  <button type="button" onClick={() => setHeroOpen((v) => !v)} aria-expanded={heroOpen} title={heroOpen ? "Collapse header" : "Expand header"} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:text-white" style={{ background: "rgba(12,26,68,.42)" }}><span className="text-[10px] leading-none">{heroOpen ? "▾" : "▸"}</span>{heroOpen ? "Hide" : "Show"}</button>
                </div>
              </div>

              {/* Collapsed: a slim one-line summary so the numbers stay visible. */}
              {!heroOpen && (
                <button type="button" onClick={() => setHeroOpen(true)} className="mt-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-left hover:bg-white/10">
                  <span className="text-[15px] font-extrabold tracking-[-0.02em]" style={{ fontVariantNumeric: "tabular-nums" }}>{agg.present} of {agg.expected} <span className="font-semibold text-white/55">signed in</span></span>
                  <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: "#ffb020" }} />{agg.notArrived} not arrived</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: "#ff6b81" }} />{agg.absent} absent</span>
                  {agg.collectedCount > 0 && <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: "#3ddc84" }} />{agg.collectedCount} collected</span>}
                  <span className="ml-auto text-[11.5px] font-bold text-white/60">▾ Expand</span>
                </button>
              )}

              {heroOpen && (<>
              {/* The headline figure — the one number you read from across a hall. */}
              <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">
                    {dayLabel(date)} · {daySessions[0]?.blockName ?? "No session"}
                  </div>
                  <div className="mt-1.5 text-[34px] font-extrabold leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--ff-display)", fontVariantNumeric: "tabular-nums" }}>
                    {agg.present} of {agg.expected} <span className="font-semibold text-white/55">signed in</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ffb020" }} />{agg.notArrived} not arrived</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff6b81" }} />{agg.absent} absent</span>
                  {agg.collectedCount > 0 && <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3ddc84" }} />{agg.collectedCount} collected</span>}
                </div>
              </div>

              {/* Controls, below a hairline — same set as before, restyled to sit
                  on the aurora rather than on the page beneath it. */}
              {daySessions.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
                  {passOpts.length > 1 && (
                    <span className="relative inline-flex items-center">
                      <select value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Filter by drop-off or collection" className="appearance-none rounded-lg border border-white/30 bg-white/10 py-1.5 pl-3 pr-7 text-[12.5px] font-bold text-white outline-none [&>option]:text-[var(--ink)]">
                        <option value="">🕒 All sessions</option>
                        {passOpts.map((o) => <option key={o.v} value={o.v}>🕒 {o.label}</option>)}
                      </select>
                      <span aria-hidden className="pointer-events-none absolute right-2.5 text-[9px] text-white/70">▾</span>
                    </span>
                  )}
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Search this register…" className="w-[210px] rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-[12.5px] text-white outline-none placeholder:text-white/55 focus:border-white/70" />

                  <Menu label="⚗ Filter" on={!!flag || addonsOnly} badge={(flag ? 1 : 0) + (addonsOnly ? 1 : 0)} width={264} dark>
                    {(close) => (<>
                      <div className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Show only children with…</div>
                      {FLAGS.filter((f) => f.k !== "nappy" || flagCounts.nappy).map((f) => (
                        <MenuItem key={f.k} on={flag === f.k} dot={f.fg} hint={flagCounts[f.k as keyof typeof flagCounts] || 0}
                          onClick={() => { setFlag(flag === f.k ? "" : (f.k as FlagKind)); close(); }}>{f.label}</MenuItem>
                      ))}
                      {flat.some((r) => (r.a.addons?.length ?? 0) > 0) && (<>
                        <div className="my-1 h-px bg-[var(--line)]" />
                        <MenuItem on={addonsOnly} hint={flat.filter((r) => (r.a.addons?.length ?? 0) > 0).length}
                          onClick={() => setAddonsOnly((v) => !v)}>🧩 Add-ons only</MenuItem>
                      </>)}
                      {(flag || addonsOnly) && (<>
                        <div className="my-1 h-px bg-[var(--line)]" />
                        <button type="button" onClick={() => { setFlag(""); setAddonsOnly(false); close(); }} className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-bold text-[#c02636] hover:bg-[var(--panel)]">Clear filters</button>
                      </>)}
                      <p className="px-2.5 pb-1 pt-1.5 text-[11px] leading-snug text-[var(--ink-3)]">Picking one shows those children with the note typed out.</p>
                    </>)}
                  </Menu>

                  <Menu label={`↕ ${sort === "start" ? "Earliest start" : sort === "old" ? "Age · oldest" : "Age · youngest"}`} width={220} dark>
                    {(close) => (<>
                      {([["young", "Age · youngest first"], ["old", "Age · oldest first"], ["start", "Earliest start"]] as const).map(([k, label]) => (
                        <MenuItem key={k} on={sort === k} onClick={() => { setSort(k); close(); }}>{label}</MenuItem>
                      ))}
                    </>)}
                  </Menu>

                  <Menu label="👁 Show" on={showConsent || showLikes} badge={(showConsent ? 1 : 0) + (showLikes ? 1 : 0)} width={240} dark>
                    {() => (<>
                      <MenuItem on={showConsent} onClick={() => setShowConsent((v) => !v)}>📷 Photo consent</MenuItem>
                      {likesOn && <MenuItem on={showLikes} onClick={() => setShowLikes((v) => !v)}>😊 Likes &amp; dislikes</MenuItem>}
                    </>)}
                  </Menu>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="inline-flex overflow-hidden rounded-lg border border-white/30">
                      {([["list", "☰ List"], ["gallery", "▦ Photos"]] as const).map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setView(k)} className="px-3 py-1.5 text-[12.5px] font-bold" style={view === k ? { background: "#fff", color: AURORA_BG } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.9)" }}>{label}</button>
                      ))}
                    </span>
                    <button type="button" onClick={() => setRollCall((v) => !v)} className={rollCall ? GHOST_ON : GHOST}>🚨 Roll call</button>
                    <button type="button" onClick={() => messageAttending()} disabled={attendingEmails.length === 0} title={attendingEmails.length ? `${attendingEmails.length} famil${attendingEmails.length === 1 ? "y" : "ies"} — a parent is messaged once` : ""} className="rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#0f2452] transition hover:bg-white/90 disabled:opacity-40">Message all attending{attendingKids ? ` (${attendingKids})` : ""}</button>
                  </div>
                </div>
              )}
              </>)}
            </div>
          </div>

          {pinRequired && <div className="mb-3 rounded-2xl border border-[#cfe0f7] bg-[#f5f9ff] px-4 py-3 text-[12.5px] text-[var(--ink-2)]"><span className="mr-1">🔒</span><b>Collection PIN required.</b> Ask whoever collects for the family&rsquo;s 4-digit PIN and check it matches before releasing a child.</div>}

          {daySessions.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">{days[date] === undefined ? `Loading ${dayLabel(date)}…` : `Nothing runs for ${activeName} on ${dayLabel(date)}.`}</div>
          ) : (
            <>
              {rollCall && <RollCallDialog expected={agg.expected} present={agg.present} presentAll={presentAll} heads={allHeads} readOnly={readOnly} onLog={(n) => logHead(passBlocks[0], n)} onClose={() => setRollCall(false)} />}

              {/* ONE flat table for the day — blue/white card */}
              <div className="mb-3 overflow-hidden rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] shadow-[0_10px_30px_-18px_rgba(29,58,143,.45)]">
                {/* Slim strip: the last head count as a shortcut back into the
                    roll-call card. Absent entirely until something is logged. */}
                {passBlocks[0] && lastHead && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--line)] bg-[var(--panel)]/40 px-4 py-2 text-[12px]">
                    <button type="button" onClick={() => setRollCall(true)} className="font-semibold underline" style={{ color: lastHead.n >= agg.present ? GREEN : AMBER }}>Head count — last {lastHead.n}/{agg.expected} · {timeOf(lastHead.at)}</button>
                  </div>
                )}
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
                {view === "gallery" ? (
                  <div className="p-4">
                    <div className="mb-3.5 flex flex-wrap gap-1.5">
                      {([["all", "All", galCounts.all], ["present", "Checked in", galCounts.present], ["notArrived", "Not in yet", galCounts.notArrived], ["absent", "Absent", galCounts.absent], ["collected", "Collected", galCounts.collected]] as const).map(([k, label, n]) => (
                        <button key={k} type="button" onClick={() => setGalFilter(k)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(galFilter === k)}>{label} · {n}</button>
                      ))}
                    </div>
                    {galRows.length === 0 ? <div className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-3)]">No children match.</div> : (
                      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                        {galRows.map(({ a, blockId, start, end }) => <GalTile key={`${blockId}-${a.ref}`} a={a} start={start} end={end} showTimes={showTimes} busy={busyRef === a.ref} showConsent={showConsent} onMark={readOnly ? undefined : (action) => mark(blockId, a.ref, action)} onOpen={() => setOpenKid(a)} />)}
                      </div>
                    )}
                  </div>
                ) : (<>
                <div className="hidden grid-cols-[minmax(190px,1.3fr)_84px_minmax(200px,210px)_minmax(230px,1fr)] gap-3 border-b-2 border-[#dbe6fb] bg-[#eef4fd] px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#1d3a8f] md:grid">
                  <span>Child</span><span>Alerts</span><span>Attendance</span><span className="md:text-right">Quick actions</span>
                </div>
                {flatShown.length === 0 ? <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No children match.</div> : flatShown.map(({ a, blockId, start, end }) => (
                  <Row key={`${blockId}-${a.ref}`} a={a} start={start} end={end} showTimes={showTimes} busy={busyRef === a.ref || readOnly} age={ageOf(a)} flag={flag} acts={acts} note={notes[noteKey(a.ref)]} showConsent={showConsent} selected={selected.has(a.ref)} showLikes={showLikes} late={visibleLate(a, start, end)} nudgedAt={nudges[`${date}|${a.ref}`]} nappy={needsNappies(questions, a.child?.answers)} nappyLog={nappies[`${date}|${a.ref}`] ?? []} readOnlyRow={readOnly} onLogNappy={() => logNappy(a.ref, date, meName)} onNudge={() => { const l = visibleLate(a, start, end); if (l) nudge(a, l); }} onSelect={() => toggleSel(a.ref)} onOpen={() => setOpenKid(a)} onOpenNote={() => setNoteFor({ ref: a.ref, name: a.children[0]?.name ?? "" })} onMark={(action) => mark(blockId, a.ref, action)} onMsg={() => messageOne(a)} onMed={() => medFor(a)} onAccident={() => accidentFor(a)} onIncident={() => incidentFor(a)} onMoments={() => momentsFor(a)} onEmail={() => emailFor(a)} onWhatsapp={() => whatsappFor(a)} />
                ))}
                </>)}
              </div>
            </>
          )}
        </>
      )}

      {openKid && <ChildModal a={applyEdit(openKid)} showTimes={showTimes} fields={fields} card={card} questions={questions} ctx={kidContext(openKid)} edit={edits[openKid.ref]} canEdit={canEditChild} onSaveEdit={(p) => saveEdit(openKid.ref, p)} onOpenFamilies={() => router.push(`/${portal}/customers`)} onClose={() => setOpenKid(null)} />}
      {noteFor && <NotePopup name={noteFor.name} note={notes[noteKey(noteFor.ref)]} canDeleteForever={canDeleteForever} onSave={(t, s) => saveNote(noteFor.ref, t, s)} onArchive={() => archiveNote(noteFor.ref)} onRestore={() => restoreNote(noteFor.ref)} onDeleteForever={() => deleteNoteForever(noteFor.ref)} onClose={() => setNoteFor(null)} />}
      {nudgeFor && (() => {
        const kid = nudgeFor.a.children[0]?.name ?? "your child";
        const copy = nudgeCopy([{ kid, late: nudgeFor.late }], settings.providerName?.trim());
        return <NudgeDialog kid={kid} late={nudgeFor.late} email={nudgeFor.a.email!.trim().toLowerCase()} parentName={nudgeFor.a.booker ?? ""} refId={nudgeFor.a.ref} subject={copy.subject} body={copy.body} others={lateAll} from={settings.providerName?.trim()} onSent={(refs) => markNudged(refs, date)} onClose={() => setNudgeFor(null)} />;
      })()}
      {dlOpen && <DownloadDialog sessions={passBlocks} date={date} allDates={listingDates[active] ?? []} listingName={activeName} sessionsForDates={sessionsForDates} onClose={() => setDlOpen(false)} />}
    </div>
  );
}

// Roll call and head count are one job: count the children in front of you
// against the list of who is signed in, then log the number you got. They used
// to be a toolbar panel plus a separate strip on the table — merged into this
// one card so the register area stays quiet until you need it. You can never
// log more heads than the number of children in the register for the day
// (`expected`) — a miscount safeguard.
function RollCallDialog({ expected, present, presentAll, heads, readOnly, onLog, onClose }: { expected: number; present: number; presentAll: Attendee[]; heads: Head[]; readOnly: boolean; onLog: (n: number) => Promise<void>; onClose: () => void }) {
  const [n, setN] = useState(String(present));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const last = heads.at(-1);
  const val = parseInt(n || "", 10);
  const over = Number.isFinite(val) && val > expected;
  const canLog = Number.isFinite(val) && val >= 0 && val <= expected;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 bg-[#fdebec] px-4 py-2.5">
          <span className="text-[13px] font-extrabold text-[#c02636]">🚨 Roll call — {present} on site now</span>
          <button type="button" onClick={onClose} aria-label="Close roll call" className="text-[18px] font-extrabold leading-none text-[#c02636]">×</button>
        </div>
        <div className="p-4">
          <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
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
            </div>
            {open && (
              <div className="mt-2 border-t border-[var(--line)] pt-2">
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
          <div className="mb-2 text-[11.5px] font-semibold text-[#c02636]">Count heads against this list.</div>
          {presentAll.length === 0 ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nobody is signed in right now.</div> : <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{presentAll.map((a) => <div key={a.ref} className="flex items-center gap-2 text-[12.5px]"><span className="font-bold">{a.children.map((c) => c.name).join(", ")}</span>{a.child?.allergies && <span className="text-[10.5px] font-bold text-[#c02636]">⚠</span>}</div>)}</div>}
        </div>
      </div>
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
// Nudge composer — opens OVER the register so whoever is taking it never loses
// their place. Sends straight to the parent's thread; the text stays editable
// because the right wording depends on the family.
function NudgeDialog({ kid, late, email, parentName, refId, subject: subject0, body: body0, others, from, onSent, onClose }: { kid: string; late: Late; email: string; parentName: string; refId: string; subject: string; body: string; others: { a: Attendee; late: Late }[]; from?: string; onSent: (refs: string[]) => void; onClose: () => void }) {
  const [subject, setSubject] = useState(subject0);
  const [body, setBody] = useState(body0);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  // Tick/untick per child; everyone starts selected.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(others.map((o) => o.a.ref)));
  const toggle = (ref: string) => setPicked((p) => { const n = new Set(p); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  const toggleFamily = (refs: string[]) => setPicked((p) => {
    const n = new Set(p); const allOn = refs.every((r) => n.has(r));
    for (const r of refs) { if (allOn) n.delete(r); else n.add(r); }
    return n;
  });
  // One entry per PARENT — siblings on the same register collapse into a single
  // message rather than two.
  const allGroups = useMemo(() => {
    const m = new Map<string, { email: string; parentName: string; items: { a: Attendee; late: Late }[] }>();
    for (const o of others) {
      const key = o.a.email!.trim().toLowerCase();
      const g = m.get(key) ?? { email: key, parentName: o.a.booker ?? "", items: [] };
      g.items.push(o);
      m.set(key, g);
    }
    return [...m.values()];
  }, [others]);
  // Only what's still ticked actually gets sent — and a family whose children
  // are all unticked drops out entirely rather than sending an empty message.
  const groups = useMemo(() => allGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => picked.has(i.a.ref)) }))
    .filter((g) => g.items.length > 0), [allGroups, picked]);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      if (!all) {
        await apiPost("/api/messages", { parentEmail: email, parentName, subject: subject.trim() || undefined, body: body.trim() });
        onSent([refId]); setSent(1);
      } else {
        // Copy is rebuilt per family from THEIR own children's lateness — a bulk
        // nudge must never quote one child's overdue time at another's parent.
        const done: string[] = [];
        for (const g of groups) {
          const c = nudgeCopy(g.items.map((i) => ({ kid: i.a.children[0]?.name ?? "your child", late: i.late })), from);
          await apiPost("/api/messages", { parentEmail: g.email, parentName: g.parentName, subject: c.subject, body: c.body });
          done.push(...g.items.map((i) => i.a.ref));
        }
        onSent(done); setSent(groups.length);
      }
      setTimeout(onClose, 1100);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't send — try again."); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,.5)]" style={LIGHT_PALETTE} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-[#fdecec] px-4 py-3 text-[#c02636]">
          <span className="text-[14px] font-extrabold">🔔 Nudge {parentName || "parent"}</span>
          <span className="text-[11.5px] font-semibold text-[#c02636]/75">· {kid} · {late.kind === "collect" ? "collection" : "arrival"} {lateFor(late.mins)} late</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-7 w-7 place-items-center rounded-full text-[#c02636] hover:bg-white/60">✕</button>
        </div>
        <div className="p-4">
          {others.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setAll(false)} className="rounded-lg border px-2.5 py-1 text-[11.5px] font-bold" style={sel(!all)}>Just this family</button>
              <button type="button" onClick={() => setAll(true)} className="rounded-lg border px-2.5 py-1 text-[11.5px] font-bold" style={sel(all)}>All late families ({allGroups.length})</button>
            </div>
          )}
          {all ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
                <span>One message per family, timed to <b className="text-[var(--ink-2)]">their</b> child:</span>
                <span className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setPicked(new Set(others.map((o) => o.a.ref)))} className="font-bold text-[#1d3a8f] underline">all</button>
                  <button type="button" onClick={() => setPicked(new Set())} className="font-bold text-[var(--ink-3)] underline">none</button>
                </span>
              </div>
              <div className="max-h-[220px] overflow-y-auto rounded-lg border border-[var(--line)]">
                {allGroups.map((g) => {
                  const refs = g.items.map((i) => i.a.ref);
                  const on = refs.filter((r) => picked.has(r)).length;
                  return (
                    <div key={g.email} className={"border-b border-[var(--line)] px-3 py-2 text-[12px] last:border-b-0 " + (on ? "" : "opacity-45")}>
                      <label className="flex cursor-pointer items-center gap-2 font-bold text-[var(--ink-2)]">
                        <input type="checkbox" checked={on > 0} ref={(el) => { if (el) el.indeterminate = on > 0 && on < refs.length; }} onChange={() => toggleFamily(refs)} className="h-3.5 w-3.5 accent-[#c02636]" />
                        {g.parentName || g.email}
                        {g.items.length > 1 && <span className="text-[10.5px] font-extrabold text-[#1d3a8f]">· {on === refs.length ? `${refs.length} children, one message` : `${on}/${refs.length} selected`}</span>}
                      </label>
                      {g.items.map((i) => (
                        <label key={i.a.ref} className="flex cursor-pointer items-center gap-2 pl-5">
                          <input type="checkbox" checked={picked.has(i.a.ref)} onChange={() => toggle(i.a.ref)} className="h-3.5 w-3.5 accent-[#c02636]" />
                          <span className="text-[var(--ink-3)]">{i.a.children[0]?.name ?? "—"}</span>
                          <span className="ml-auto font-extrabold text-[#c02636]">{i.late.kind === "collect" ? "collection" : "arrival"} {lateFor(i.late.mins)} late</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-3)]">Wording is the standard reminder above, with each child&rsquo;s own name and time filled in.</p>
            </>
          ) : (
            <>
              <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">To <b className="text-[var(--ink-2)]">{email}</b></div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[12.5px] font-bold outline-none focus:border-[#c02636]" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full resize-y rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[#c02636]" />
            </>
          )}
          {err && <div className="mt-2 rounded-lg bg-[#fde2e4] px-3 py-2 text-[12px] font-semibold text-[#c02636]">{err}</div>}
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={busy || !!sent || (all ? groups.length === 0 : !body.trim())} onClick={send} className="rounded-full bg-[#c02636] px-5 py-2 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40">{sent ? `Sent ✓ ${sent > 1 ? `(${sent})` : ""}` : busy ? "Sending…" : all ? `Send ${groups.length} ${groups.length === 1 ? "nudge" : "nudges"}` : "Send nudge"}</button>
            <button type="button" onClick={onClose} className="text-[12px] font-bold text-[var(--ink-3)]">Cancel</button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink-3)]">Goes to your existing message thread with {all ? "each family" : "this family"} — they&rsquo;ll see it in their app.</p>
        </div>
      </div>
    </div>
  );
}
// Collapses the row's quick actions behind one funky pill — tap to reveal.
function QuickActionsMenu({ acts, onMsg, onMed, onAccident, onIncident, onMoments, onEmail, onWhatsapp }: { acts: { firstAid?: boolean; incident?: boolean; medication?: boolean; message?: boolean; moments?: boolean; email?: boolean; whatsapp?: boolean }; onMsg: () => void; onMed: () => void; onAccident: () => void; onIncident: () => void; onMoments: () => void; onEmail: () => void; onWhatsapp: () => void }) {
  const [open, setOpen] = useState(false);
  const links = [
    acts.firstAid !== false && <QuickLink key="fa" label="First aid" tint="#be123c" onClick={onAccident} />,
    acts.incident !== false && <QuickLink key="in" label="Incident" tint="#b45309" onClick={onIncident} />,
    acts.medication !== false && <QuickLink key="md" label="Medication" tint="#15803d" onClick={onMed} />,
    acts.moments !== false && <QuickLink key="mo" label="Add moment" tint="#7c3aed" onClick={onMoments} />,
    acts.email !== false && <QuickLink key="em" label="Email parent" tint="#0e7490" onClick={onEmail} />,
    acts.message !== false && <QuickLink key="ms" label="Message parent" tint="#1d3a8f" onClick={onMsg} />,
    acts.whatsapp !== false && <QuickLink key="wa" label="WhatsApp" tint="#128c7e" onClick={onWhatsapp} />,
  ].filter(Boolean);
  if (!links.length) return null;
  return (
    <div className="md:text-right">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-[#c9dcfa] bg-gradient-to-r from-[#eef4ff] to-[#f6ecff] px-3.5 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] shadow-sm transition hover:brightness-[0.98]">⚡ Quick actions <span className="text-[9px]">{open ? "▲" : "▼"}</span></button>
      {open && <div className="mt-1.5 flex flex-wrap gap-1.5 md:justify-end">{links}</div>}
    </div>
  );
}

function Row({ a, start, end, showTimes, busy, age, flag, acts, note, showConsent, selected, showLikes, late, nudgedAt, nappy, nappyLog, readOnlyRow, onLogNappy, onNudge, onSelect, onOpen, onOpenNote, onMark, onMsg, onMed, onAccident, onIncident, onMoments, onEmail, onWhatsapp }: { a: Attendee; start: string; end: string; showTimes: boolean; busy: boolean; age?: number; flag: FlagKind; acts: { firstAid?: boolean; incident?: boolean; medication?: boolean; message?: boolean; moments?: boolean; email?: boolean; whatsapp?: boolean }; note?: RegNote; showConsent: boolean; selected: boolean; showLikes: boolean; late: Late | null; nudgedAt?: string; nappy: boolean; nappyLog: NappyChange[]; readOnlyRow: boolean; onLogNappy: () => void; onNudge: () => void; onSelect: () => void; onOpen: () => void; onOpenNote: () => void; onMark: (action: Action) => void; onMsg: () => void; onMed: () => void; onAccident: () => void; onIncident: () => void; onMoments: () => void; onEmail: () => void; onWhatsapp: () => void }) {
  const state = st(a); const c = a.child; const collected = !!a.attendance?.collectedAt; const kid = a.children[0];
  const lastNappy = nappyLog.at(-1); const nappyCount = nappyLog.length;
  const flagText = flag === "allergy" ? c?.allergies : flag === "medical" ? c?.medical : flag === "dietary" ? c?.dietary : flag === "send" ? (c?.send || (c?.sendPlanName ? "SEND plan on file" : "")) : flag === "nappy" ? (lastNappy ? `Last change ${timeOf(lastNappy.at)} by ${lastNappy.by}` : "No change logged yet") : "";
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
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-extrabold">
              {a.children.map((k) => k.name).join(", ")}
              {nappy && <span className="ml-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold align-middle" style={{ background: "#f3e8ff", color: "#6d28d9" }} title="Not toilet trained — nappy changes needed">🚼 Nappies</span>}
              {" "}<span className="text-[11px] font-bold text-[#1d3a8f]">view ›</span>
            </div>
            <div className="truncate text-[11.5px] text-[var(--ink-3)]">{age != null ? `Age ${age} · ` : ""}<span className="font-bold text-[var(--ink-2)]">🕒 {start}–{end}</span></div>
            {nappy && (
              <div className="truncate text-[11px]" style={{ color: "#6d28d9" }}>
                {lastNappy ? <>Changed {timeOf(lastNappy.at)} by {lastNappy.by}{nappyCount > 1 ? ` · ${nappyCount} today` : ""}</> : <span className="text-[var(--ink-3)]">No change logged yet today</span>}
              </div>
            )}
          </div>
        </button>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          {nappy && !readOnlyRow && (
            <button type="button" onClick={onLogNappy} title="Log a nappy change — stamps the time and your name"
              className="grid h-7 w-7 place-items-center rounded-lg border text-[13px]" style={{ borderColor: "#e2d3f7", background: "#faf5ff", color: "#6d28d9" }} aria-label="Log a nappy change">🚼</button>
          )}
          {showLikes && <LikesChip likes={c?.likes} dislikes={c?.dislikes} />}
          {showConsent && c?.photoConsent != null && <PhotoConsentChip ok={!!c.photoConsent} />}
          {c?.collectionPassword && <CollectPin pw={c.collectionPassword} />}
          <NoteChip note={note} onClick={onOpenNote} />
        </span>
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
      {/* Quick actions — collapsed behind a funky pill; tap to reveal.
          The nudge bell sits outside the menu on purpose: it's an alert, and
          burying it behind a tap would defeat the point. */}
      <div className="flex flex-wrap items-start gap-1.5 md:justify-end">
        {late && (
          <button type="button" onClick={onNudge}
            title={nudgedAt ? `Nudged at ${timeOf(nudgedAt)} — click to nudge again` : late.kind === "collect" ? `Collection was due at ${late.at} — nudge the parent` : `Session started at ${late.at} — nudge the parent`}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-extrabold"
            style={nudgedAt ? { borderColor: "#b7e2c8", background: "#e7f6ee", color: GREEN } : { borderColor: "#f3c6c1", background: "#fdecec", color: "#c02636" }}>
            {nudgedAt
              ? <>✓ Nudged {timeOf(nudgedAt)}</>
              : <>🔔 {late.kind === "collect" ? "Collection" : "Arrival"} {lateFor(late.mins)} late</>}
          </button>
        )}
        <QuickActionsMenu acts={acts} onMsg={onMsg} onMed={onMed} onAccident={onAccident} onIncident={onIncident} onMoments={onMoments} onEmail={onEmail} onWhatsapp={onWhatsapp} />
      </div>
    </div>
  );
}
