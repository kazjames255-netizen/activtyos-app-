"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, groupForAge, type RatioGroup } from "@/lib/settings";
import { Badge, Button, Card } from "@/components/ui";
import { HowItWorks } from "@/components/HowItWorks";

// ─────────────────────────────────────────────────────────────────────────
// Register — run the day on the ground. One card per session on the chosen
// date; each expected child gets Sign in (Present) / Collect / Absent-ill.
// Live safeguarding flags, a quick head-count tally + "taken by", a live
// staffing check, roll-call, a tap-to-open child card, sort, and a
// print / CSV / PDF export with a column picker. Staff's one write.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f", GREEN = "#0f7a43", RED = "#c02636", AMBER = "#9a5a00";

interface Attendance { status?: "in" | "absent"; inAt?: string | null; collectedAt?: string | null; collectedBy?: string | null; reason?: string | null }
interface SGRec { photo?: string; dob?: string; school?: string; allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string; collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean }
interface Attendee { ref: string; booker: string; bookingStatus: string; seats: number; children: { name: string; age?: number }[]; child: SGRec | null; attendance: Attendance | null }
interface Head { n: number; by: string; at: string }
interface Session { blockId: string; date: string; start: string; end: string; blockName: string; listingId: string; listingName: string; attendees: Attendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number }; heads: Head[]; takenBy: { name: string; at: string } | null }
type Action = "in" | "absent" | "collect" | "reset";

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const shiftDay = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const timeOf = (ts?: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
const state = (a: Attendee): "present" | "absent" | "notArrived" => (a.attendance?.status === "in" ? "present" : a.attendance?.status === "absent" ? "absent" : "notArrived");
const firstAge = (a: Attendee) => a.children[0]?.age ?? 999;

function staffNeeded(children: { age?: number }[], groups: RatioGroup[]): number {
  const total = children.length;
  if (!total) return 0;
  if (!groups.length) return Math.ceil(total / 8);
  const per = new Map<string, number>(); let ungrouped = 0;
  for (const c of children) { const g = c.age != null ? groupForAge(groups, c.age) : null; if (g) per.set(g.id, (per.get(g.id) ?? 0) + 1); else ungrouped++; }
  let need = 0;
  for (const [id, n] of per) { const g = groups.find((x) => x.id === id); need += Math.ceil(n / (g?.targetRatio || 8)); }
  return Math.max(need + (ungrouped ? Math.ceil(ungrouped / 8) : 0), 1);
}

function Chip({ bg, fg, title, children }: { bg: string; fg: string; title?: string; children: ReactNode }) {
  return <span className="rounded px-1.5 py-[1px] text-[10.5px] font-bold" style={{ background: bg, color: fg }} title={title}>{children}</span>;
}

// ── Child detail card (tap a row) ──────────────────────────────────────────
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
            : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel)] text-[16px] font-extrabold text-[var(--ink-3)]">{(kid?.name ?? "?").slice(0, 1)}</span>}
          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold">{kid?.name}</div>
            <div className="text-[12px] text-[var(--ink-3)]">{kid?.age != null ? `Age ${kid.age}` : ""}{c?.dob ? ` · ${c.dob}` : ""}{showTimes && a.attendance?.inAt ? ` · in ${timeOf(a.attendance.inAt)}` : ""}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-[var(--line)] pt-2">
          {row("Allergies", c?.allergies && <span className="text-[#c02636]">⚠ {c.allergies}</span>)}
          {row("Medical", c?.medical)}
          {row("Dietary", c?.dietary)}
          {row("SEND / needs", (c?.send || c?.sendPlanName) && `${c?.send ?? ""}${c?.sendPlanName ? ` · plan on file` : ""}`)}
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

function AttendeeRow({ a, onMark, onOpen, busy, showTimes }: { a: Attendee; onMark: (ref: string, action: Action) => void; onOpen: () => void; busy: boolean; showTimes: boolean }) {
  const s = state(a); const c = a.child; const collected = !!a.attendance?.collectedAt;
  const badge = s === "present" ? { bg: "#e7f6ee", fg: GREEN, t: "Present" } : s === "absent" ? { bg: "#fdebec", fg: RED, t: "Absent / ill" } : { bg: "var(--panel)", fg: "var(--ink-3)", t: "Not arrived" };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] py-2 first:border-t-0">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {c?.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.photo} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
          : <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-3)]">{(a.children[0]?.name ?? "?").slice(0, 1)}</span>}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold">{a.children.map((k) => `${k.name}${k.age !== undefined ? ` (${k.age})` : ""}`).join(", ")} <span className="text-[11px] font-normal text-[#be1259]">view ›</span></div>
          <div className="truncate text-[11.5px] text-[var(--ink-3)]">{a.booker} · #{a.ref}{a.bookingStatus !== "Confirmed" ? ` · ${a.bookingStatus}` : ""}</div>
          {c && (c.allergies || c.medical || c.dietary || c.send || c.sendPlanName || c.collectionPassword || c.photoConsent === false) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {c.allergies && <Chip bg="#fdebec" fg={RED} title="Allergy">⚠ {c.allergies}</Chip>}
              {c.medical && <Chip bg="#fff1e6" fg="#b45309" title="Medical">✚ {c.medical}</Chip>}
              {c.dietary && <Chip bg="#fff8e6" fg={AMBER} title="Dietary">🍽 {c.dietary}</Chip>}
              {(c.send || c.sendPlanName) && <Chip bg="#eef4fd" fg={BLUE} title="SEND / needs">◆ SEND</Chip>}
              {c.photoConsent === false && <Chip bg="#f3e8ff" fg="#6d28d9" title="No photo consent">📷 no photos</Chip>}
              {c.collectionPassword && <Chip bg="#fdf3d8" fg={AMBER} title="Collection password">🔑 {c.collectionPassword}</Chip>}
            </div>
          )}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1">
        <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: badge.bg, color: badge.fg }}>{badge.t}{s === "present" && showTimes && a.attendance?.inAt ? ` · ${timeOf(a.attendance.inAt)}` : ""}</span>
        {collected && <span className="text-[10.5px] font-bold text-[var(--ink-3)]">✓ Collected{showTimes && a.attendance?.collectedAt ? ` · ${timeOf(a.attendance.collectedAt)}` : ""}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button sm disabled={busy} onClick={() => onMark(a.ref, "in")}>{s === "present" ? "↺ Undo in" : "Sign in"}</Button>
        {s === "present" && <Button sm disabled={busy} onClick={() => onMark(a.ref, "collect")}>{collected ? "↺ Uncollect" : "Collect"}</Button>}
        {s !== "present" && <Button sm disabled={busy} onClick={() => onMark(a.ref, s === "absent" ? "reset" : "absent")}>{s === "absent" ? "↺ Undo" : "Absent / ill"}</Button>}
      </div>
    </div>
  );
}

// ── Quick head-count tally (per session) ───────────────────────────────────
function HeadCount({ s, expected, onLog }: { s: Session; expected: number; onLog: (n: number) => Promise<void> }) {
  const last = s.heads[s.heads.length - 1];
  const [n, setN] = useState<string>(String(s.counts.present));
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] px-3 py-2 text-[12px]">
      <span className="font-extrabold text-[var(--ink-2)]">🔢 Quick head count</span>
      <input type="number" value={n} onChange={(e) => setN(e.target.value)} className="w-16 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
      <span className="text-[var(--ink-3)]">of {expected} expected</span>
      <Button sm disabled={busy} onClick={async () => { setBusy(true); await onLog(Math.max(0, parseInt(n || "0", 10))); setBusy(false); }}>{busy ? "…" : "Log count"}</Button>
      {last && <span className="font-semibold" style={{ color: last.n >= expected ? GREEN : AMBER }}>Last: {last.n}/{expected} {last.n >= expected ? "✓ all present" : `⚠ ${expected - last.n} short`} · by {last.by} at {timeOf(last.at)}</span>}
      <span className="ml-auto text-[11px] text-[var(--ink-3)]">Register taken by: <b className="text-[var(--ink-2)]">{s.takenBy?.name ?? "— not yet"}</b></span>
    </div>
  );
}

// ── Download picker (columns → CSV / PDF) ──────────────────────────────────
const DL_COLS: { key: string; label: string; on: boolean }[] = [
  { key: "age", label: "Age", on: true }, { key: "time", label: "Timing", on: true }, { key: "status", label: "Status", on: true },
  { key: "arrived", label: "Arrived", on: true }, { key: "collected", label: "Collected", on: true }, { key: "allergies", label: "Allergies", on: true },
  { key: "medical", label: "Medical", on: true }, { key: "needs", label: "SEND / needs", on: true }, { key: "emergency", label: "Emergency contact", on: true },
  { key: "emphone", label: "Em. phone", on: true }, { key: "password", label: "Collection password", on: false }, { key: "dob", label: "DOB", on: false }, { key: "school", label: "School", on: false },
];
function cellFor(key: string, s: Session, a: Attendee): string {
  const c = a.child; const k = a.children[0];
  switch (key) {
    case "age": return k?.age != null ? String(k.age) : "";
    case "time": return `${s.start}-${s.end}`;
    case "status": return state(a) === "present" ? "Present" : state(a) === "absent" ? "Absent" : "Not arrived";
    case "arrived": return timeOf(a.attendance?.inAt);
    case "collected": return a.attendance?.collectedAt ? timeOf(a.attendance.collectedAt) : "";
    case "allergies": return c?.allergies ?? "";
    case "medical": return c?.medical ?? "";
    case "needs": return c?.send || c?.sendPlanName ? "SEND" : "";
    case "emergency": return c?.emergencyName ?? "";
    case "emphone": return c?.emergencyPhone ?? "";
    case "password": return c?.collectionPassword ?? "";
    case "dob": return c?.dob ?? "";
    case "school": return c?.school ?? "";
    default: return "";
  }
}
function DownloadDialog({ sessions, date, onClose }: { sessions: Session[]; date: string; onClose: () => void }) {
  const [on, setOn] = useState<Set<string>>(new Set(DL_COLS.filter((c) => c.on).map((c) => c.key)));
  const cols = DL_COLS.filter((c) => on.has(c.key));
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
  function csv() {
    const rows = [["Listing", "Session", "Child", ...cols.map((c) => c.label)]];
    for (const s of sessions) for (const a of s.attendees) rows.push([s.listingName, s.blockName, a.children.map((k) => k.name).join(" / "), ...cols.map((c) => cellFor(c.key, s, a))]);
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = `register-${date}.csv`; link.click(); URL.revokeObjectURL(url); onClose();
  }
  function pdf() {
    const body = sessions.map((s) => `<h2>${esc(s.listingName)} — ${esc(s.blockName)} · ${s.start}–${s.end}</h2><table><tr><th>Child</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>${s.attendees.map((a) => `<tr><td>${esc(a.children.map((k) => k.name).join(", "))}</td>${cols.map((c) => `<td>${esc(cellFor(c.key, s, a))}</td>`).join("")}</tr>`).join("")}</table>`).join("");
    const w = window.open("", "_blank", "width=900,height=1000"); if (!w) return;
    w.document.write(`<!doctype html><title>Register ${date}</title><style>body{font:12px/1.4 system-ui,sans-serif;color:#171534;padding:16px}h1{font-size:18px}h2{font-size:13px;margin:16px 0 4px;border-top:1px solid #ddd;padding-top:8px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border:1px solid #e5e5e5;padding:4px 6px;font-size:11px}th{background:#f5f5f5}</style><h1>Register — ${dayLabel(date)}</h1>${body || "<p>Nothing runs today.</p>"}`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300); onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold">Download register — {dayLabel(date)}</div>
        <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">The child&rsquo;s name is always included. Tick the columns you want.</p>
        <div className="flex flex-wrap gap-1.5">
          {DL_COLS.map((c) => { const sel = on.has(c.key); return (
            <button key={c.key} type="button" onClick={() => setOn((s) => { const n = new Set(s); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={sel ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{sel ? "✓ " : ""}{c.label}</button>
          ); })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <Button sm onClick={onClose}>Cancel</Button>
          <div className="flex gap-2"><Button sm onClick={pdf}>🖨 PDF (printable)</Button><Button sm variant="solid" onClick={csv}>⭳ CSV</Button></div>
        </div>
      </div>
    </div>
  );
}

/** register view — freelancer, company, franchise and staff portals. */
export function RegistersApp() {
  const { settings } = useSettings();
  const groups = settings.ratioGroups ?? [];
  const showTimes = settings.registers?.timestamps ?? true;
  const fields = settings.registers?.fields ?? { contact: true, emergency: true, password: true, school: true };
  const [date, setDate] = useState(todayIso);
  const [loaded, setLoaded] = useState<{ date: string; list: Session[] } | null>(null);
  const sessions = loaded && loaded.date === date ? loaded.list : null;
  const [error, setError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "present" | "absent" | "notArrived">("");
  const [sort, setSort] = useState<"age" | "name">("age");
  const [listingFilter, setListingFilter] = useState("");
  const [rollCall, setRollCall] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [openKid, setOpenKid] = useState<Attendee | null>(null);

  const refresh = useCallback(() => {
    apiGet<Session[]>(`/api/registers?date=${date}`).then((list) => { setLoaded({ date, list }); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load the register"));
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setReadOnly(me.role === "platform")).catch(() => {}); }, []);
  useRealtime(["registers", "bookings", "blocks"], refresh);

  async function mark(blockId: string, ref: string, action: Action) {
    setBusyRef(ref); setError(null);
    try { await apiPost(`/api/registers/${encodeURIComponent(blockId)}/${date}/mark`, { ref, action }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the register"); }
    setBusyRef(null);
  }
  async function markAllIn(s: Session) {
    setBulkBusy(s.blockId); setError(null);
    const refs = s.attendees.filter((a) => state(a) === "notArrived").map((a) => a.ref);
    try { for (const ref of refs) await apiPost(`/api/registers/${encodeURIComponent(s.blockId)}/${date}/mark`, { ref, action: "in" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update the register"); }
    setBulkBusy(null);
  }
  async function logHead(s: Session, n: number) {
    try { await apiPost(`/api/registers/${encodeURIComponent(s.blockId)}/${date}/headcount`, { n }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t log the head count"); }
  }

  const listings = useMemo(() => [...new Map((sessions ?? []).map((s) => [s.listingId, s.listingName])).entries()], [sessions]);
  const shownSessions = (sessions ?? []).filter((s) => !listingFilter || s.listingId === listingFilter);
  const rows = (s: Session) => s.attendees
    .filter((a) => !q.trim() || a.children.some((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())) || a.booker.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((a) => !statusFilter || state(a) === statusFilter)
    .slice().sort((x, y) => (sort === "age" ? firstAge(x) - firstAge(y) : (x.children[0]?.name ?? "").localeCompare(y.children[0]?.name ?? "")));

  const all = (sessions ?? []).flatMap((s) => s.attendees);
  const present = all.filter((a) => state(a) === "present");
  const tiles: [string, number, string][] = [
    ["Expected", all.length, "var(--ink)"], ["Present", present.length, GREEN],
    ["Not arrived", all.filter((a) => state(a) === "notArrived").length, AMBER], ["Absent / ill", all.filter((a) => state(a) === "absent").length, RED],
  ];
  const sel = (o: boolean, c = BLUE) => ({ borderColor: o ? c : "var(--line)", background: o ? "#eef4fd" : "var(--surface)", color: o ? c : "var(--ink-2)" });

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📋</span>Register</div>
            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{dayLabel(date)} — sign children in as they arrive, collect them at pick-up. Allergies, medical needs and the collection password show at a glance.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day" className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-bold">←</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border-0 bg-white/90 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1d3a8f]" />
            <button type="button" onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day" className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-bold">→</button>
            {date !== todayIso() && <button type="button" onClick={() => setDate(todayIso())} className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">Today</button>}
          </div>
        </div>
        {sessions && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {tiles.map(([label, v]) => (
              <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <HowItWorks video="Taking the register: signing children in, collecting them at pick-up, reading the safeguarding flags, running a quick head count and a roll call." minutes="2 min">
        <p><b>Each session running today gets its own register.</b> Tap <b>Sign in</b> as a child arrives and <b>Collect</b> when they&rsquo;re picked up (independent — a collected child still counts present for the day). <b>Absent / ill</b> marks a no-show, with Undo. Every mark is stamped with your name and time and syncs to every device.</p>
        <p>The chips are your safeguarding at-a-glance — <b>⚠ allergies</b>, <b>✚ medical</b>, <b>◆ SEND</b>, <b>📷 no-photo</b> and the <b>🔑 collection password</b> to check before you hand a child over. Tap any child for their full card. Log a <b>🔢 quick head count</b> to confirm heads match, hit <b>🚨 Roll call</b> for an evacuation list, and <b>Download</b> a printable/CSV copy.</p>
      </HowItWorks>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      {sessions && sessions.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a child or booker…" className="w-52 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Sort</span>
            {([["age", "Age"], ["name", "Name"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setSort(id)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(sort === id)}>{l}</button>)}
            <span className="mx-0.5 text-[var(--ink-3)]">·</span>
            {([["", "All"], ["notArrived", "Not arrived"], ["present", "Present"], ["absent", "Absent"]] as const).map(([id, l]) => <button key={l} type="button" onClick={() => setStatusFilter(id)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={sel(statusFilter === id)}>{l}</button>)}
            <div className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => setRollCall((v) => !v)} className="rounded-full border px-3 py-1.5 text-[12px] font-extrabold" style={sel(rollCall, RED)}>🚨 Roll call</button>
              <button type="button" onClick={() => setDlOpen(true)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">⬇ Download</button>
            </div>
          </div>
          {listings.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Listing</span>
              <button type="button" onClick={() => setListingFilter("")} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={sel(!listingFilter)}>All</button>
              {listings.map(([id, name]) => <button key={id} type="button" onClick={() => setListingFilter(id)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={sel(listingFilter === id)}>{name}</button>)}
            </div>
          )}
        </div>
      )}

      {rollCall && sessions && (
        <Card className="mb-3.5 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 bg-[#fdebec] px-4 py-2.5">
            <span className="text-[13px] font-extrabold text-[#c02636]">🚨 Roll call — {present.length} on site now</span>
            <span className="text-[11.5px] font-semibold text-[#c02636]">Count heads against this list.</span>
          </div>
          <div className="p-4">
            {present.length === 0 ? <div className="text-center text-[12.5px] text-[var(--ink-3)]">Nobody is signed in right now.</div> : (
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {shownSessions.flatMap((s) => s.attendees.filter((a) => state(a) === "present").map((a) => (
                  <div key={`${s.blockId}-${a.ref}`} className="flex items-center gap-2 text-[12.5px]"><span className="font-bold">{a.children.map((c) => c.name).join(", ")}</span>{a.child?.allergies && <span className="text-[10.5px] font-bold text-[#c02636]">⚠</span>}<span className="ml-auto text-[10.5px] text-[var(--ink-3)]">{s.listingName}</span></div>
                )))}
              </div>
            )}
          </div>
        </Card>
      )}

      {!sessions ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading the register…</div>
        : sessions.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing runs on {dayLabel(date)} — pick another day.</Card>
        : (
          <div className="flex flex-col gap-3.5">
            {shownSessions.map((s) => {
              const need = staffNeeded(s.attendees.filter((a) => state(a) === "present").flatMap((a) => a.children), groups);
              const list = rows(s);
              return (
                <Card key={s.blockId} className="overflow-hidden p-0">
                  <div className="h-1 w-full" style={{ background: BLUE }} />
                  <div className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <div className="text-[15px] font-extrabold uppercase" style={{ fontFamily: "var(--ff-display)" }}>{s.listingName}</div>
                        <div className="text-[12px] text-[var(--ink-3)]">📍 {s.blockName} · {s.start} – {s.end}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span className="text-[var(--ink-2)]">{s.counts.expected} expected</span>
                        <span style={{ color: GREEN }}>{s.counts.present} present</span>
                        {s.counts.notArrived > 0 && <span style={{ color: AMBER }}>{s.counts.notArrived} not in</span>}
                        {s.counts.absent > 0 && <span style={{ color: RED }}>{s.counts.absent} absent</span>}
                        {s.counts.present > 0 && <Badge tone={{ bg: "#eef4fd", fg: BLUE }}>🧑‍🏫 need ≥{need} staff</Badge>}
                      </div>
                    </div>
                    {!readOnly && s.attendees.length > 0 && <div className="mt-2"><Button sm disabled={bulkBusy === s.blockId || s.counts.notArrived === 0} onClick={() => markAllIn(s)}>{bulkBusy === s.blockId ? "Working…" : `✓ Sign all in${s.counts.notArrived ? ` (${s.counts.notArrived})` : ""}`}</Button></div>}
                    {!readOnly && <HeadCount s={s} expected={s.counts.expected} onLog={(n) => logHead(s, n)} />}
                    <div className="mt-2.5">
                      {s.attendees.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No bookings hold a place on this session yet.</div>
                        : list.length === 0 ? <div className="py-3 text-center text-[12px] text-[var(--ink-3)]">No children match the filter.</div>
                        : list.map((a) => <AttendeeRow key={a.ref} a={a} busy={busyRef === a.ref || readOnly} showTimes={showTimes} onOpen={() => setOpenKid(a)} onMark={(ref, action) => mark(s.blockId, ref, action)} />)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      {openKid && <ChildModal a={openKid} showTimes={showTimes} fields={fields} onClose={() => setOpenKid(null)} />}
      {dlOpen && sessions && <DownloadDialog sessions={shownSessions} date={date} onClose={() => setDlOpen(false)} />}
    </div>
  );
}
