"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, groupForAge, type RatioGroup } from "@/lib/settings";
import { Button } from "@/components/ui";

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
interface SGRec { photo?: string; dob?: string; school?: string; allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string; collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean }
interface Attendee { ref: string; booker: string; email: string; bookingStatus: string; seats: number; children: { name: string; age?: number }[]; child: SGRec | null; attendance: Attendance | null }
interface Head { n: number; by: string; at: string }
interface Session { blockId: string; date: string; start: string; end: string; blockName: string; listingId: string; listingName: string; attendees: Attendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number }; heads: Head[]; takenBy: { name: string; at: string } | null }
type Action = "in" | "absent" | "collect" | "reset";

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const shiftDay = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rel = (iso: string) => (iso === todayIso() ? "Today" : iso === shiftDay(todayIso(), 1) ? "Tomorrow" : dow(iso));
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const timeOf = (ts?: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
const st = (a: Attendee): "present" | "absent" | "notArrived" => (a.attendance?.status === "in" ? "present" : a.attendance?.status === "absent" ? "absent" : "notArrived");
const AV = ["#fde2e4", "#e2f0d9", "#e0e7ff", "#fff3d6", "#e5f6f8", "#f3e8ff", "#ffe9d6", "#dce7ff"];
const avBg = (n: string) => AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

function staffNeeded(children: { age?: number }[], groups: RatioGroup[]): number {
  const total = children.length; if (!total) return 0; if (!groups.length) return Math.ceil(total / 8);
  const per = new Map<string, number>(); let un = 0;
  for (const c of children) { const g = c.age != null ? groupForAge(groups, c.age) : null; if (g) per.set(g.id, (per.get(g.id) ?? 0) + 1); else un++; }
  let need = 0; for (const [id, n] of per) { const g = groups.find((x) => x.id === id); need += Math.ceil(n / (g?.targetRatio || 8)); }
  return Math.max(need + (un ? Math.ceil(un / 8) : 0), 1);
}

function AlertSq({ kind, text }: { kind: "allergy" | "medical" | "send"; text: string }) {
  const m = kind === "allergy" ? { bg: "#fde2e4", fg: "#c02636", label: "Allergy" } : kind === "medical" ? { bg: "#e0e9ff", fg: BLUE, label: "Medical" } : { bg: "#f3e8ff", fg: "#6d28d9", label: "SEND" };
  return <span title={text} className="rounded-md px-1.5 py-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.03em]" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

// ── Child detail card ──────────────────────────────────────────────────────
function ChildModal({ a, showTimes, fields, onClose }: { a: Attendee; showTimes: boolean; fields: { contact?: boolean; emergency?: boolean; password?: boolean; school?: boolean }; onClose: () => void }) {
  const c = a.child; const kid = a.children[0];
  const row = (label: string, v?: ReactNode) => (v ? <div className="flex gap-2 py-1 text-[12.5px]"><span className="w-[130px] flex-none text-[var(--ink-3)]">{label}</span><span className="min-w-0 flex-1 font-semibold text-[var(--ink)]">{v}</span></div> : null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {c?.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
            : <span className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(kid?.name ?? "?") }}>{(kid?.name ?? "?").slice(0, 1)}</span>}
          <div className="min-w-0"><div className="truncate text-[16px] font-extrabold">{kid?.name}</div><div className="text-[12px] text-[var(--ink-3)]">{kid?.age != null ? `Age ${kid.age}` : ""}{c?.dob ? ` · ${c.dob}` : ""}{showTimes && a.attendance?.inAt ? ` · in ${timeOf(a.attendance.inAt)}` : ""}</div></div>
        </div>
        <div className="mt-3 border-t border-[var(--line)] pt-2">
          {row("Allergies", c?.allergies && <span className="text-[#e11d48]">⚠ {c.allergies}</span>)}
          {row("Medical", c?.medical)}{row("Dietary", c?.dietary)}
          {row("SEND / needs", (c?.send || c?.sendPlanName) && `${c?.send ?? ""}${c?.sendPlanName ? " · plan on file" : ""}`)}
          {row("Care & personality", c?.careNotes)}
          {row("Photo consent", c?.photoConsent === false ? <span className="text-[#6d28d9]">No — do not photograph</span> : c?.photoConsent ? "Yes" : undefined)}
          {fields.school && row("School", c?.school)}
          {fields.password && row("Collection password", c?.collectionPassword && <span className="text-[#9a5a00]">🔑 {c.collectionPassword}</span>)}
          {fields.emergency && row("Emergency contact", (c?.emergencyName || c?.emergencyPhone) && `${c?.emergencyName ?? ""}${c?.emergencyPhone ? ` · ${c.emergencyPhone}` : ""}`)}
          {fields.contact && row("Booker", `${a.booker} · #${a.ref}`)}
          {a.attendance?.collectedAt && row("Collected", `${showTimes ? timeOf(a.attendance.collectedAt) : "yes"}${a.attendance.collectedBy ? ` · by ${a.attendance.collectedBy}` : ""}`)}
        </div>
        <div className="mt-3 flex justify-end border-t border-[var(--line)] pt-3"><Button sm onClick={onClose}>Close</Button></div>
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
  const { settings } = useSettings();
  const router = useRouter();
  const portal = (usePathname()?.split("/")[1]) || "freelancer";
  const incidentHref = `/${portal}/${portal === "staff" ? "incident" : "incidents"}`;
  const groups = settings.ratioGroups ?? [];
  const showTimes = settings.registers?.timestamps ?? true;
  const fields = settings.registers?.fields ?? { contact: true, emergency: true, password: true, school: true };
  const pinRequired = !!settings.registers?.requireCollectionPin;

  const anchor = todayIso();
  const WINDOW = useMemo(() => Array.from({ length: 10 }, (_, i) => shiftDay(anchor, i)), [anchor]);
  const [days, setDays] = useState<Record<string, Session[]>>({});
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(anchor);
  const [activeListing, setActiveListing] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"age" | "start" | "name">("age");
  const [pass, setPass] = useState("");
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
    router.push(`/${portal}/messages?compose=1&emails=${encodeURIComponent(a.email)}`);
  }

  // Listings that run somewhere in the window; pick the active one.
  const listingsAll = useMemo(() => {
    const m = new Map<string, string>(); for (const d of WINDOW) for (const s of days[d] ?? []) m.set(s.listingId, s.listingName); return [...m.entries()];
  }, [days, WINDOW]);
  const active = activeListing || listingsAll[0]?.[0] || "";
  const activeName = listingsAll.find(([id]) => id === active)?.[1] ?? "";
  // Dates in the window that this listing runs — the accordion rows.
  const listingDates = WINDOW.filter((d) => (days[d] ?? []).some((s) => s.listingId === active));
  const sessionsOn = (d: string) => (days[d] ?? []).filter((s) => s.listingId === active);
  const daySessions = sessionsOn(date);

  // One flat list of children for the listing on the day, each tagged with its
  // block (pass) so it can be marked, then filtered by pass and searched.
  type FlatRow = { a: Attendee; blockId: string; start: string; end: string };
  const flat: FlatRow[] = daySessions.flatMap((s) => s.attendees.map((a) => ({ a, blockId: s.blockId, start: s.start, end: s.end })));
  const passes = [...new Set(daySessions.map((s) => `${s.start}–${s.end}`))];
  const inPass = (r: FlatRow) => !pass || `${r.start}–${r.end}` === pass;
  const flatShown = flat
    .filter(inPass)
    .filter(({ a }) => !q.trim() || a.children.some((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())) || a.booker.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) => sort === "name" ? (x.a.children[0]?.name ?? "").localeCompare(y.a.children[0]?.name ?? "") : sort === "start" ? (x.start.localeCompare(y.start) || (x.a.children[0]?.age ?? 0) - (y.a.children[0]?.age ?? 0)) : (x.a.children[0]?.age ?? 999) - (y.a.children[0]?.age ?? 999));

  // Everyone currently shown (respects the pass filter + search) → the audience
  // for "Message all attending", de-duplicated by email.
  const attendingEmails = [...new Set(flatShown.map(({ a }) => a.email).filter(Boolean))];
  const dayCounts = (d: string) => { const ss = sessionsOn(d); return { booked: ss.reduce((n, s) => n + s.counts.expected, 0), present: ss.reduce((n, s) => n + s.counts.present, 0) }; };
  // Head count / stats aggregate the day (respecting the pass filter).
  const passBlocks = daySessions.filter((s) => !pass || `${s.start}–${s.end}` === pass);
  const agg = passBlocks.reduce((o, s) => ({ expected: o.expected + s.counts.expected, present: o.present + s.counts.present, notArrived: o.notArrived + s.counts.notArrived, absent: o.absent + s.counts.absent }), { expected: 0, present: 0, notArrived: 0, absent: 0 });
  const pct = agg.expected ? Math.round((agg.present / agg.expected) * 100) : 0;
  const presentAll = passBlocks.flatMap((s) => s.attendees.filter((a) => st(a) === "present"));
  const need = staffNeeded(presentAll.flatMap((a) => a.children), groups);
  const headTiles = { count: passBlocks.reduce((n, s) => n + s.heads.length, 0), last: passBlocks.flatMap((s) => s.heads).slice().sort((a, b) => a.at.localeCompare(b.at)).at(-1), takenBy: passBlocks.map((s) => s.takenBy).filter(Boolean).sort((a, b) => a!.at.localeCompare(b!.at)).at(-1)?.name };
  const notInRefs = flat.filter(inPass).filter((r) => st(r.a) === "notArrived");
  const sel = (o: boolean) => ({ borderColor: o ? BLUE : "var(--line)", background: o ? "#eef4fd" : "var(--surface)", color: o ? BLUE : "var(--ink-2)" });

  const tiles: [string, string, number, string][] = [
    ["EXPECTED", "booked today", agg.expected, BLUE], ["PRESENT", agg.expected ? `${pct}% signed in` : "—", agg.present, GREEN],
    ["NOT ARRIVED", "awaiting", agg.notArrived, AMBER], ["ABSENT / ILL", agg.absent ? "reported" : "—", agg.absent, RED],
  ];

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
                  {listingsAll.length > 1
                    ? <select value={active} onChange={(e) => setActiveListing(e.target.value)} className="rounded-lg border-0 bg-white/90 px-2.5 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f] outline-none">{listingsAll.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
                    : <span className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">{activeName}</span>}
                  <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border-0 bg-white/90 px-2.5 py-1.5 text-[12.5px] font-bold text-[#1d3a8f] outline-none">
                    {(listingDates.length ? listingDates : [date]).map((d) => { const c = dayCounts(d); return <option key={d} value={d}>{rel(d)} · {dow(d)}{c.booked ? ` — ${c.booked} booked` : ""}</option>; })}
                  </select>
                  <span className="text-[12px] text-white/85">📍 {daySessions[0]?.blockName ?? "—"}</span>
                </div>
              </div>
              <button type="button" onClick={() => router.push(incidentHref)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md">⚑ Log incident</button>
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
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">Nothing runs for {activeName} on {dayLabel(date)}.</div>
          ) : (
            <>
              {/* Pass (timing) filter */}
              {passes.length > 1 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Pass</span>
                  <button type="button" onClick={() => setPass("")} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(!pass)}>All</button>
                  {passes.map((p) => <button key={p} type="button" onClick={() => setPass(p)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(pass === p)}>{p}</button>)}
                </div>
              )}

              {/* Sort + toolbar */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Sort</span>
                {([["age", "Age"], ["start", "Earliest start"], ["name", "Name"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setSort(id)} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={sel(sort === id)}>{l}</button>)}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-40 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] outline-none focus:border-[#1d3a8f]" />
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setRollCall((v) => !v)} className="rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold" style={sel(rollCall)}>🚨 Roll call</button>
                  <button type="button" onClick={() => messageAttending()} disabled={attendingEmails.length === 0} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40">Message all attending{attendingEmails.length ? ` (${attendingEmails.length})` : ""}</button>
                  <button type="button" onClick={() => setDlOpen(true)} className="rounded-full border border-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬇ Download</button>
                </div>
              </div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Key</span>
                <span className="rounded-md px-1.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.03em]" style={{ background: "#fde2e4", color: "#c02636" }}>Allergy</span>
                <span className="rounded-md px-1.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.03em]" style={{ background: "#e0e9ff", color: BLUE }}>Medical</span>
                <span className="rounded-md px-1.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.03em]" style={{ background: "#f3e8ff", color: "#6d28d9" }}>SEND</span>
              </div>

              {rollCall && (
                <div className="mb-3 overflow-hidden rounded-2xl border border-[#f6c9cc]">
                  <div className="flex items-center justify-between gap-2 bg-[#fdebec] px-4 py-2.5"><span className="text-[13px] font-extrabold text-[#c02636]">🚨 Roll call — {presentAll.length} on site now</span><span className="text-[11.5px] font-semibold text-[#c02636]">Count heads against this list.</span></div>
                  <div className="bg-[var(--surface)] p-4">{presentAll.length === 0 ? <div className="text-center text-[12.5px] text-[var(--ink-3)]">Nobody is signed in right now.</div> : <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">{presentAll.map((a) => <div key={a.ref} className="flex items-center gap-2 text-[12.5px]"><span className="font-bold">{a.children.map((c) => c.name).join(", ")}</span>{a.child?.allergies && <span className="text-[10.5px] font-bold text-[#c02636]">⚠</span>}</div>)}</div>}</div>
                </div>
              )}

              {/* ONE flat table for the day */}
              <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
                {passBlocks[0] && (
                  <div className="border-b border-[var(--line)] bg-[var(--panel)]/40 px-4 py-3">
                    <HeadBand count={headTiles.count} expected={agg.present} present={agg.present} last={headTiles.last} takenBy={headTiles.takenBy} readOnly={readOnly} onLog={(n) => logHead(passBlocks[0], n)} />
                    {need > 0 && <div className="mt-2 text-[11.5px] font-semibold text-[var(--ink-3)]">Ratio guide · {presentAll.length} on site now needs ≥ {need} staff.</div>}
                  </div>
                )}
                {!readOnly && notInRefs.length > 0 && <div className="border-b border-[var(--line)] px-4 py-2"><Button sm disabled={bulkBusy === "all"} onClick={() => signAllIn(notInRefs)}>{bulkBusy === "all" ? "Working…" : `✓ Sign all in (${notInRefs.length})`}</Button></div>}
                <div className="hidden grid-cols-[minmax(200px,1.6fr)_90px_120px_100px_150px_110px] gap-2 border-b border-[var(--line)] px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)] md:grid">
                  <span>Child</span><span>Alerts</span><span>Signed in</span><span>Collected</span><span>Status</span><span>Parent</span>
                </div>
                {flatShown.length === 0 ? <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No children match.</div> : flatShown.map(({ a, blockId, start, end }) => (
                  <Row key={`${blockId}-${a.ref}`} a={a} start={start} end={end} showTimes={showTimes} multiPass={passes.length > 1 && !pass} busy={busyRef === a.ref || readOnly} onOpen={() => setOpenKid(a)} onMark={(action) => mark(blockId, a.ref, action)} onMsg={() => messageOne(a)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {openKid && <ChildModal a={openKid} showTimes={showTimes} fields={fields} onClose={() => setOpenKid(null)} />}
      {dlOpen && <DownloadDialog sessions={passBlocks} date={date} onClose={() => setDlOpen(false)} />}
    </div>
  );
}

function HeadBand({ count, expected, present, last, takenBy, readOnly, onLog }: { count: number; expected: number; present: number; last?: Head; takenBy?: string; readOnly: boolean; onLog: (n: number) => Promise<void> }) {
  const [n, setN] = useState(String(present));
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <div className="flex w-[110px] flex-none flex-col items-center justify-center rounded-xl bg-[var(--panel)] py-3 text-center">
        <div className="text-[34px] font-extrabold leading-none">{count}</div>
        <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Head counts today</div>
      </div>
      <div className="min-w-[240px] flex-1">
        <div className="text-[14px] font-extrabold">Quick head count</div>
        <p className="text-[12px] text-[var(--ink-3)]">Count the children in front of you and log it — the tally goes up each time.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-[var(--ink-3)]">Heads counted</span>
          <input type="number" value={n} onChange={(e) => setN(e.target.value)} className="w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[13px]" />
          {!readOnly && <Button sm variant="solid" disabled={busy} onClick={async () => { setBusy(true); await onLog(Math.max(0, parseInt(n || "0", 10))); setBusy(false); }}>{busy ? "…" : "Log head count"}</Button>}
          <span className="text-[11.5px] text-[var(--ink-3)]">expected {expected}</span>
        </div>
        {last && <div className="mt-1.5 text-[12px] font-semibold" style={{ color: last.n >= expected ? GREEN : RED }}>Last: {last.n}/{expected} {last.n >= expected ? "✓ all present" : `⚠ ${expected - last.n} short`} <span className="font-normal text-[var(--ink-3)]">· by {last.by} at {timeOf(last.at)}</span></div>}
      </div>
      <div className="flex flex-none items-center border-l border-[var(--line)] pl-4">
        <div><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Register taken by</div><div className="mt-0.5 text-[15px] font-extrabold">{takenBy ?? "— not yet"}</div></div>
      </div>
    </div>
  );
}

function Row({ a, start, end, showTimes, multiPass, busy, onOpen, onMark, onMsg }: { a: Attendee; start: string; end: string; showTimes: boolean; multiPass: boolean; busy: boolean; onOpen: () => void; onMark: (action: Action) => void; onMsg: () => void }) {
  const state = st(a); const c = a.child; const collected = !!a.attendance?.collectedAt; const kid = a.children[0];
  return (
    <div className="grid grid-cols-1 items-center gap-2 border-b border-[var(--line)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(200px,1.6fr)_90px_120px_100px_150px_110px]">
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        {c?.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.photo} alt="" className="h-10 w-10 flex-none rounded-full object-cover" />
          : <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(kid?.name ?? "?") }}>{(kid?.name ?? "?").slice(0, 1)}</span>}
        <div className="min-w-0"><div className="truncate text-[13.5px] font-extrabold">{a.children.map((k) => k.name).join(", ")} <span className="text-[11.5px] font-bold text-[#be1259]">view ›</span></div><div className="truncate text-[11.5px] text-[var(--ink-3)]">{kid?.age != null ? `Age ${kid.age}` : ""}{multiPass ? ` · ${start}–${end}` : ""}{c?.collectionPassword ? ` · 🔑 ${c.collectionPassword}` : ""}</div></div>
      </button>
      <div className="flex flex-wrap gap-1.5 md:justify-start">
        {c?.allergies && <AlertSq kind="allergy" text={`Allergy: ${c.allergies}`} />}
        {c?.medical && <AlertSq kind="medical" text={`Medical: ${c.medical}`} />}
        {(c?.send || c?.sendPlanName) && <AlertSq kind="send" text="SEND / needs" />}
        {!c?.allergies && !c?.medical && !c?.send && !c?.sendPlanName && <span className="text-[12px] text-[var(--ink-3)]">—</span>}
      </div>
      <div>
        {state === "present"
          ? <button type="button" disabled={busy} onClick={() => onMark("in")} className="rounded-lg border-2 px-3 py-1.5 text-[12px] font-extrabold" style={{ borderColor: "#bfead0", background: "#e7f6ee", color: GREEN }}>✓ In{showTimes && a.attendance?.inAt ? ` · ${timeOf(a.attendance.inAt)}` : ""}</button>
          : <Button sm disabled={busy} onClick={() => onMark("in")}>Sign in</Button>}
      </div>
      <div>
        {collected ? <button type="button" disabled={busy} onClick={() => onMark("collect")} className="rounded-lg border-2 px-3 py-1.5 text-[12px] font-extrabold" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>✓ Collected{showTimes && a.attendance?.collectedAt ? ` · ${timeOf(a.attendance.collectedAt)}` : ""}</button>
          : <Button sm disabled={busy || state !== "present"} onClick={() => onMark("collect")}>Collect</Button>}
      </div>
      <div className="flex items-center gap-1.5">
        {state === "present" && <span className="rounded-lg px-2.5 py-1 text-[12px] font-extrabold" style={{ background: "#e7f6ee", color: GREEN }}>Present</span>}
        {state === "absent" && <><span className="rounded-lg px-2.5 py-1 text-[12px] font-extrabold" style={{ background: "#fde2e4", color: RED }}>Absent / ill</span><button type="button" disabled={busy} onClick={() => onMark("reset")} className="text-[12px] font-bold text-[var(--ink-3)] underline">Undo</button></>}
        {state === "notArrived" && <><span className="rounded-lg px-2.5 py-1 text-[12px] font-bold" style={{ background: "var(--panel)", color: "var(--ink-3)" }}>Not arrived</span><button type="button" disabled={busy} onClick={() => onMark("absent")} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]">Absent / ill</button></>}
      </div>
      <div><button type="button" onClick={onMsg} className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">✉ Message</button></div>
    </div>
  );
}
