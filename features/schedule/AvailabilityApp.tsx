"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, get as apiGet } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Button, Card, Input } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// ── My availability (staff) ────────────────────────────────────────────────
// Two shapes, driven by what the manager asked for (real store: /api/availability):
//  • a standing weekly pattern (no request, or an "ongoing" request), or
//  • a dated camp grid — when assigned to a listing for N weeks, the staff fills
//    a week-by-week grid bounded by the camp's opening hours, with quick helpers
//    (repeat a weekday across all weeks, duplicate a whole week) + undo.

interface Camp { listingName: string; location?: string; open: string; close: string; weeks: number; startDate: string; assignedDates?: string[] }
interface ReqWindow { kind: "week" | "range" | "ongoing" | "camp"; label: string; from?: string; to?: string }
interface AvailRequest { id: string; window: ReqWindow; camp?: Camp | null; note?: string; status: "pending" | "submitted"; createdAt: string; createdBy?: string | null; createdByName?: string | null; submittedAt?: string }
interface DayAvail { on: boolean; from: string; to: string }
interface Pattern { days?: Record<string, DayAvail>; grid?: Record<string, DayAvail>; note?: string; submittedAt?: string }

const fmtDay = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "");
// Full date + time for "submitted / last edited" stamps.
const fmtStamp = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const requesterOf = (r: { createdByName?: string | null; createdBy?: string | null }) => r.createdByName || r.createdBy || "your manager";
const dNum = (iso: string) => new Date(`${iso}T00:00:00`).getDate();
const dMon = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { month: "short" });
const wdOf = (iso: string) => new Date(`${iso}T00:00:00`).getDay(); // 0 Sun … 6 Sat
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const addDaysISO = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const mins = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const hoursOf = (from: string, to: string) => Math.max(0, (mins(to) - mins(from)) / 60);
const clampT = (v: string, lo: string, hi: string) => (mins(v) < mins(lo) ? lo : mins(v) > mins(hi) ? hi : v);
const hLabel = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

// ── Standing weekly pattern (default / ongoing) ─────────────────────────────
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: [DayKey, string][] = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
interface Weekly { days: Record<DayKey, DayAvail>; note: string; submittedAt: string | null }
const KEY = "aos.myavailability.v1";
const FIELD_STYLE = { backgroundColor: "#f5f3fb", boxShadow: "inset 0 0 0 1.5px #c5bfd6" } as const;
const blankDay = (): DayAvail => ({ on: false, from: "09:00", to: "17:00" });
const blankWeekly = (): Weekly => ({ days: Object.fromEntries(DAYS.map(([k]) => [k, blankDay()])) as Record<DayKey, DayAvail>, note: "", submittedAt: null });
const loadWeekly = (): Weekly => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.days ? v : blankWeekly(); } catch { return blankWeekly(); } };

export function AvailabilityApp() {
  const { settings } = useSettings();
  const lockHours = settings.scheduling?.availabilityLockHours ?? 24;
  const [requests, setRequests] = useState<AvailRequest[]>([]);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const refresh = () => apiGet<{ requests: AvailRequest[]; pattern: Pattern | null }>("/api/availability/mine")
    .then((r) => { setRequests(r.requests || []); setPattern(r.pattern ?? null); })
    .catch(() => {});
  useEffect(() => { void refresh(); }, []);

  const pendingReq = requests.find((r) => r.status === "pending") ?? null;
  const lastReq = requests[0] ?? null;
  // Show the camp grid for any camp request — pending OR already submitted — so a
  // staffer can always see (and edit) what they sent, not fall back to the
  // generic weekly view.
  const campReq = requests.find((r) => r.camp && r.status === "pending") ?? requests.find((r) => r.camp) ?? null;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My availability" icon="⏱" lede={campReq ? "Tell your manager which days and hours you can work across this camp — they build the rota around it." : "Set your usual working week — the days and hours you can normally work. It's the starting point your manager uses when building the rota."} />

      {campReq ? (
        <CampAvailability req={campReq} initialGrid={pattern?.grid ?? {}} lockHours={lockHours} onSubmitted={refresh} />
      ) : (
        <StandingWeekly requests={requests} pendingReq={pendingReq} lastReq={lastReq} pattern={pattern} onSubmitted={refresh} />
      )}

      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">
        Your manager sees your submission against the rota. Change it any time before shifts are published — they&rsquo;ll always see the latest.
      </p>
    </div>
  );
}

// ── Camp grid ───────────────────────────────────────────────────────────────
function CampAvailability({ req, initialGrid, lockHours, onSubmitted }: { req: AvailRequest; initialGrid: Record<string, DayAvail>; lockHours: number; onSubmitted: () => void }) {
  const camp = req.camp!;
  const cell0 = (): DayAvail => ({ on: false, from: camp.open, to: camp.close });
  const [grid, setGrid] = useState<Record<string, DayAvail>>(() => ({ ...initialGrid }));
  const [history, setHistory] = useState<Record<string, DayAvail>[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  useEffect(() => { setGrid((g) => (Object.keys(g).length ? g : { ...initialGrid })); }, [initialGrid]);

  const weeks = useMemo(() => Array.from({ length: camp.weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysISO(camp.startDate, w * 7 + d))), [camp.weeks, camp.startDate]);
  const allDates = useMemo(() => weeks.flat(), [weeks]);
  const assigned = useMemo(() => new Set(camp.assignedDates ?? []), [camp.assignedDates]);
  // A day locks `lockHours` before its opening time (and once it's started/passed).
  const lockCutoffMs = Math.max(0, lockHours) * 3600_000;
  const dayStartMs = (iso: string) => new Date(`${iso}T${camp.open}:00`).getTime();
  const nowMs = Date.now();
  const status = (iso: string): "assigned" | "locked" | "open" =>
    assigned.has(iso) ? "assigned" : nowMs >= dayStartMs(iso) - lockCutoffMs ? "locked" : "open";
  const editable = (iso: string) => status(iso) === "open";
  const cell = (iso: string) => grid[iso] ?? cell0();
  const snapshot = () => setHistory((h) => [...h.slice(-19), grid]);
  const undo = () => setHistory((h) => { if (!h.length) return h; setGrid(h[h.length - 1]); return h.slice(0, -1); });
  const setCell = (iso: string, patch: Partial<DayAvail>) => { if (!editable(iso)) return; setGrid((g) => ({ ...g, [iso]: { ...(g[iso] ?? cell0()), ...patch } })); };
  const toggle = (iso: string) => setCell(iso, { on: !cell(iso).on });
  const setFrom = (iso: string, v: string) => { const c = cell(iso); setCell(iso, { from: clampT(v, camp.open, camp.close), to: mins(v) >= mins(c.to) ? camp.close : c.to }); };
  const setTo = (iso: string, v: string) => setCell(iso, { to: clampT(v, camp.open, camp.close) });

  // Bulk helpers only touch editable days — locked/assigned days are left alone.
  const repeatWeekday = (iso: string) => { snapshot(); const c = { ...cell(iso) }; const wd = wdOf(iso); setGrid((g) => { const n = { ...g }; allDates.forEach((dt) => { if (wdOf(dt) === wd && editable(dt)) n[dt] = { ...c }; }); return n; }); };
  const copyWeekToAll = (wi: number) => { snapshot(); setGrid((g) => { const n = { ...g }; const src = weeks[wi].map((dt) => g[dt] ?? cell0()); weeks.forEach((wk) => wk.forEach((dt, di) => { if (editable(dt)) n[dt] = { ...src[di] }; })); return n; }); };
  const weekdaysAllWeeks = () => { snapshot(); setGrid((g) => { const n = { ...g }; allDates.forEach((dt) => { if (!editable(dt)) return; const wd = wdOf(dt); n[dt] = { on: wd >= 1 && wd <= 5, from: camp.open, to: camp.close }; }); return n; }); };
  const clearAll = () => { snapshot(); setGrid((g) => { const n = { ...g }; allDates.forEach((dt) => { if (editable(dt)) delete n[dt]; }); return n; }); };

  const selected = allDates.filter((dt) => cell(dt).on);
  const totalH = selected.reduce((n, dt) => n + hoursOf(cell(dt).from, cell(dt).to), 0);
  // "Applied?" checks so the quick-fill buttons show when a rule is in force.
  const cellEq = (x: DayAvail, y: DayAvail) => x.on === y.on && x.from === y.from && x.to === y.to;
  const weekdaySynced = (wd: number) => { const cs = allDates.filter((dt) => wdOf(dt) === wd).map(cell); return cs.length > 1 && cs.every((c) => cellEq(c, cs[0])); };
  const weeksAllEqual = weeks.length > 1 && weeks.every((wk) => wk.every((dt, di) => cellEq(cell(dt), cell(weeks[0][di]))));

  const submit = () => {
    if (!selected.length || busy) return;
    setBusy(true);
    const clean: Record<string, DayAvail> = {};
    allDates.forEach((dt) => { const c = cell(dt); if (c.on) clean[dt] = c; });
    api("/api/availability/mine", { method: "PUT", body: JSON.stringify({ grid: clean, note: `Camp: ${camp.listingName}` }) })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 3000); onSubmitted(); })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Assignment + hours */}
      <div className="overflow-hidden rounded-2xl border border-[#e3ebff] bg-gradient-to-br from-[#f4f8ff] to-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#e3ebff] px-4 py-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#1d3a8f] text-[16px] text-white">📍</span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">You&rsquo;ve been assigned to</div>
            <div className="text-[15px] font-black tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{camp.listingName}{camp.location ? <span className="text-[var(--ink-3)]"> · {camp.location}</span> : null}</div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            {req.status === "submitted"
              ? <span className="rounded-full bg-[#e7f5ec] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0f7a43]" title={req.submittedAt ? `Last edited ${fmtStamp(req.submittedAt)}` : undefined}>✓ Submitted{req.submittedAt ? ` · ${fmtStamp(req.submittedAt)}` : ""}</span>
              : <span className="rounded-full bg-[#fdf6e3] px-2.5 py-0.5 text-[11px] font-extrabold text-[#8a5a09]">Awaiting your reply</span>}
            <span className="text-[11px] text-[var(--ink-3)]">Requested by {requesterOf(req)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
          {([
            { ic: "🗓", big: `${camp.weeks} weeks`, small: `${fmtDay(req.window.from)} – ${fmtDay(req.window.to)}`, col: "#1d3a8f", bg: "#eef4fd", expand: true },
            { ic: "🕘", big: `${camp.open}–${camp.close}`, small: "camp opening hours", col: "#0f857b", bg: "#e6f6f3" },
            { ic: "✅", big: `${selected.length}`, small: `day${selected.length === 1 ? "" : "s"} you've chosen`, col: "#0f7a43", bg: "#e7f5ec" },
            { ic: "⏱", big: hLabel(totalH), small: "hours you've chosen", col: "#7c3aed", bg: "#f1ecfe" },
          ] as { ic: string; big: string; small: string; col: string; bg: string; expand?: boolean }[]).map((c) => {
            const inner = (
              <div className="relative h-full overflow-hidden rounded-2xl border p-3 shadow-sm" style={{ borderColor: c.bg, background: `linear-gradient(135deg, ${c.bg} 0%, #ffffff 68%)` }}>
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[16px] text-white shadow-sm" style={{ background: c.col }}>{c.ic}</span>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[19px] font-black tracking-tight tabular-nums" style={{ fontFamily: "var(--ff-display)", color: c.col }}>{c.big}</div>
                    <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{c.small}</div>
                  </div>
                  {c.expand && <span className="ml-auto flex-none text-[11px] font-black" style={{ color: c.col }}>{datesOpen ? "▾" : "▸"}</span>}
                </div>
                {c.expand && <div className="mt-1.5 text-[10.5px] font-extrabold" style={{ color: c.col }}>{datesOpen ? "Hide dates" : "View all dates ›"}</div>}
                <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: c.col }} />
              </div>
            );
            return c.expand
              ? <button key={c.small} type="button" onClick={() => setDatesOpen((o) => !o)} aria-expanded={datesOpen} className="text-left transition hover:-translate-y-px">{inner}</button>
              : <div key={c.small}>{inner}</div>;
          })}
        </div>

        {datesOpen && (
          <div className="border-t border-[#e3ebff] bg-white/70 px-4 py-3">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Every date this camp runs · {allDates.length} days over {camp.weeks} weeks</div>
            <div className="flex flex-col gap-1.5">
              {weeks.map((wk, wi) => (
                <div key={wi} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-[112px] flex-none text-[11.5px] font-extrabold text-[#1d3a8f]">Week {wi + 1} <span className="font-semibold text-[var(--ink-3)]">· {dNum(wk[0])} {dMon(wk[0])}</span></span>
                  {wk.map((dt) => { const as = assigned.has(dt); const on = cell(dt).on; return (
                    <span key={dt} className={"rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums " + (as ? "bg-[#1d3a8f] text-white ring-2 ring-[#f5c542]" : on ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")} title={as ? "Rostered — request time off to change" : on ? `Available ${cell(dt).from}–${cell(dt).to}` : "Not chosen"}>{as ? "📌 " : ""}{WD_SHORT[wdOf(dt)]} {dNum(dt)}</span>
                  ); })}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">Navy = chosen · <span className="text-[#b8860b]">gold ring 📌</span> = rostered (request time off to change).</div>
          </div>
        )}
        {req.note && <div className="border-t border-[#e3ebff] px-4 py-2.5 text-[12px] italic text-[#7a5a12]">“{req.note}”</div>}
      </div>

      {/* Quick-fill toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] px-3 py-2.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Quick fill</span>
        <button type="button" onClick={weekdaysAllWeeks} className="rounded-full bg-[#1d3a8f] px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-110">Weekdays {camp.open}–{camp.close}, every week</button>
        <button type="button" onClick={clearAll} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] transition hover:bg-white/70">Clear all</button>
        <button type="button" onClick={undo} disabled={!history.length} className="ml-auto rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] transition enabled:hover:bg-white/70 disabled:opacity-40">↩ Undo</button>
      </div>

      {/* The rules — assigned days & the edit cutoff */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#e3ebff] bg-[#eef5ff] px-3.5 py-3 text-[12px] leading-relaxed text-[#1d3a8f]">
        <span className="mt-px flex-none text-[15px] leading-none">🔒</span>
        <div>
          <b>Two things are locked:</b>
          <div className="mt-1 text-[var(--ink-2)]">• <b className="text-[#1d3a8f]">Days you&rsquo;ve been rostered</b> (📌) can&rsquo;t be switched off here — you&rsquo;re expected to work them. To change one, <b>request time off</b> and your manager will review it.</div>
          <div className="mt-0.5 text-[var(--ink-2)]">• A day locks <b className="text-[#1d3a8f]">{lockHours > 0 ? `${lockHours}h before it starts` : "once it starts"}</b>, so availability can&rsquo;t change at the last minute. Everything further out stays fully editable. <span className="text-[var(--ink-3)]">(Set by your provider.)</span></div>
        </div>
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-2.5">
        {weeks.map((wk, wi) => {
          const onCount = wk.filter((dt) => cell(dt).on).length;
          return (
            <Card key={wi} className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-black text-[var(--ink)]">Week {wi + 1}</span>
                  <span className="text-[11.5px] font-semibold text-[var(--ink-3)]">{dNum(wk[0])} {dMon(wk[0])} – {dNum(wk[6])} {dMon(wk[6])}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--ink-3)]">{onCount}/7</span>
                  <button type="button" onClick={() => copyWeekToAll(wi)} className={"rounded-full px-2.5 py-1 text-[11px] font-bold transition " + (weeksAllEqual ? "bg-[#1d3a8f] text-white" : "border border-[var(--line)] bg-white text-[#1d3a8f] hover:bg-[#eef4fd]")} title="Copy this week's pattern to every week">{weeksAllEqual ? "✓ All weeks match" : "⧉ Copy to all weeks"}</button>
                </div>
              </div>
              <ul className="divide-y divide-[var(--line-2,#eef2f8)]">
                {wk.map((dt) => {
                  const c = cell(dt);
                  const wd = wdOf(dt);
                  const st = status(dt);
                  // Assigned/rostered — locked; can only request time off.
                  if (st === "assigned") {
                    return (
                      <li key={dt} className="flex flex-wrap items-center gap-3 bg-[#f3f6ff] px-4 py-2.5">
                        <span className="grid h-[22px] w-[40px] flex-none place-items-center rounded-full bg-[#1d3a8f] text-[11px] text-white">📌</span>
                        <div className="w-[104px] flex-none">
                          <div className="text-[13px] font-extrabold text-[var(--ink)]">{WD_LONG[wd]}</div>
                          <div className="text-[11px] font-semibold text-[var(--ink-3)]">{dNum(dt)} {dMon(dt)}</div>
                        </div>
                        <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[11px] font-extrabold text-[#1d3a8f]">Rostered · {camp.open}–{camp.close}</span>
                        <Link href="/staff/holiday" className="ml-auto flex-none rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-bold text-[#1d3a8f] transition hover:bg-[#eef4fd]">Request time off →</Link>
                      </li>
                    );
                  }
                  // Locked by the cutoff (started / within the lock window).
                  if (st === "locked") {
                    return (
                      <li key={dt} className="flex flex-wrap items-center gap-3 px-4 py-2.5 opacity-70">
                        <span className="grid h-[22px] w-[40px] flex-none place-items-center rounded-full bg-[var(--line)] text-[11px] text-[var(--ink-3)]">🔒</span>
                        <div className="w-[104px] flex-none">
                          <div className="text-[13px] font-extrabold text-[var(--ink)]">{WD_LONG[wd]}</div>
                          <div className="text-[11px] font-semibold text-[var(--ink-3)]">{dNum(dt)} {dMon(dt)}</div>
                        </div>
                        <span className="text-[12px] font-semibold text-[var(--ink-3)]">{c.on ? `Locked · was ${c.from}–${c.to}` : "Locked — too close to the day to change"}</span>
                      </li>
                    );
                  }
                  // Editable.
                  return (
                    <li key={dt} className={"flex flex-wrap items-center gap-3 px-4 py-2.5 " + (c.on ? "bg-[#f5f8ff]" : "")}>
                      <button type="button" onClick={() => toggle(dt)} role="switch" aria-checked={c.on} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: c.on ? "#2f6bd8" : "var(--line)" }}>
                        <span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: c.on ? "21px" : "3px" }} />
                      </button>
                      <div className="w-[104px] flex-none">
                        <div className="text-[13px] font-extrabold text-[var(--ink)]">{WD_LONG[wd]}</div>
                        <div className="text-[11px] font-semibold text-[var(--ink-3)]">{dNum(dt)} {dMon(dt)}</div>
                      </div>
                      {c.on ? (
                        <>
                          <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
                            <Input type="time" min={camp.open} max={camp.close} value={c.from} onChange={(e) => setFrom(dt, e.target.value)} className="w-[104px]" style={FIELD_STYLE} />
                            <span className="text-[var(--ink-3)]">to</span>
                            <Input type="time" min={camp.open} max={camp.close} value={c.to} onChange={(e) => setTo(dt, e.target.value)} className="w-[104px]" style={FIELD_STYLE} />
                          </div>
                          {(() => { const synced = weekdaySynced(wd); return (
                            <button type="button" onClick={() => repeatWeekday(dt)} className={"ml-auto flex-none rounded-full px-2.5 py-1 text-[11px] font-bold transition " + (synced ? "bg-[#1d3a8f] text-white" : "bg-[#eef4fd] text-[#1d3a8f] hover:brightness-95")} title={synced ? `Every ${WD_LONG[wd]} matches this` : `Apply these hours to every ${WD_LONG[wd]}`}>{synced ? `✓ Every ${WD_SHORT[wd]}` : `↻ Every ${WD_SHORT[wd]}`}</button>
                          ); })()}
                        </>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-[var(--ink-3)]">Not available</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Submit */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/95 p-3.5 shadow-[0_10px_30px_-16px_rgba(20,30,60,.5)] backdrop-blur">
        <Button variant="primary" disabled={!selected.length || busy} onClick={submit} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">{busy ? "Sending…" : req.status === "submitted" ? "Update & resend" : "Submit to manager"}</Button>
        {saved ? <span className="text-[12.5px] font-bold text-[#0f7a43]">✓ Sent — your manager can see it now</span>
          : <span className="text-[12.5px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{selected.length}</b> day{selected.length === 1 ? "" : "s"} · <b className="text-[var(--ink)]">{hLabel(totalH)}</b> across the camp</span>}
        {!selected.length && <span className="text-[12px] text-[var(--ink-3)]">Choose at least one day — try a quick-fill above.</span>}
        {req.status === "submitted" && req.submittedAt && <span className="ml-auto text-[11.5px] font-semibold text-[#0f7a43]">Last submitted {fmtStamp(req.submittedAt)} — edit &amp; resend any time.</span>}
      </div>
    </div>
  );
}

// ── Standing weekly pattern ─────────────────────────────────────────────────
function StandingWeekly({ pendingReq, lastReq, pattern, onSubmitted }: { requests: AvailRequest[]; pendingReq: AvailRequest | null; lastReq: AvailRequest | null; pattern: Pattern | null; onSubmitted: () => void }) {
  const [a, setA] = useState<Weekly>(blankWeekly);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setA(loadWeekly()); }, []);
  useEffect(() => { if (pattern?.days) setA((prev) => ({ ...prev, days: { ...prev.days, ...(pattern.days as Record<DayKey, DayAvail>) }, note: pattern.note ?? prev.note, submittedAt: pattern.submittedAt ?? prev.submittedAt })); }, [pattern]);
  const persist = (next: Weekly) => { setA(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const setDay = (k: DayKey, patch: Partial<DayAvail>) => persist({ ...a, days: { ...a.days, [k]: { ...a.days[k], ...patch } }, submittedAt: null });
  const setNote = (note: string) => persist({ ...a, note, submittedAt: null });
  const anyOn = DAYS.some(([k]) => a.days[k].on);
  const submit = () => {
    persist({ ...a, submittedAt: new Date().toISOString() }); setSaved(true); setTimeout(() => setSaved(false), 2500);
    void api("/api/availability/mine", { method: "PUT", body: JSON.stringify({ days: a.days, note: a.note }) }).then(() => onSubmitted()).catch(() => {});
  };
  const submittedLabel = a.submittedAt ? `Submitted ${fmtStamp(a.submittedAt)}` : "Not submitted yet";

  return (
    <>
      {pendingReq ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#f3d98a] bg-[#fdf6e3] p-3.5 text-[12.5px] leading-relaxed text-[#7a5a12]">
          <span className="mt-px flex-none text-[16px] leading-none">📩</span>
          <div><b>Your manager has asked for your availability</b> for <b>{pendingReq.window.label}</b>. Set the days &amp; times you can work below, then <b>Submit to manager</b>. Requested by {requesterOf(pendingReq)}.</div>
        </div>
      ) : lastReq && lastReq.status === "submitted" ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#bfe6cf] bg-[#f2fbf5] p-3.5 text-[12.5px] leading-relaxed text-[#0f7a43]">
          <span className="mt-px flex-none text-[16px] leading-none">✅</span>
          <div><b>Availability submitted</b> for {lastReq.window.label}{lastReq.submittedAt ? ` · ${fmtStamp(lastReq.submittedAt)}` : ""}. You can update it any time — your manager will see the latest.</div>
        </div>
      ) : (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#cde0f7] bg-[#eef5ff] p-3.5 text-[12.5px] leading-relaxed text-[#1d3a8f]">
          <span className="mt-px flex-none text-[16px] leading-none">🔁</span>
          <div><b>This is your standard weekly availability</b> — a repeating pattern, not a specific week. When your manager needs it for a specific camp or week, <b>a request will appear here</b> and you can submit for those dates.</div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
          {DAYS.map(([k, label]) => {
            const day = a.days[k];
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 py-2.5">
                <button type="button" onClick={() => setDay(k, { on: !day.on })} role="switch" aria-checked={day.on} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: day.on ? "#2f6bd8" : "var(--line)" }}>
                  <span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: day.on ? "21px" : "3px" }} />
                </button>
                <span className="w-[92px] flex-none text-[13.5px] font-extrabold text-[var(--ink)]">{label}</span>
                {day.on ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
                    <Input type="time" value={day.from} onChange={(e) => setDay(k, { from: e.target.value })} className="w-[112px]" style={FIELD_STYLE} />
                    <span className="text-[var(--ink-3)]">to</span>
                    <Input type="time" value={day.to} onChange={(e) => setDay(k, { to: e.target.value })} className="w-[112px]" style={FIELD_STYLE} />
                  </div>
                ) : (
                  <span className="text-[12.5px] font-semibold text-[var(--ink-3)]">Not available</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Anything your manager should know <span className="font-normal normal-case">— optional</span></label>
          <textarea value={a.note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. can do extra Saturdays in August, prefer mornings…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3.5">
          <Button variant="primary" disabled={!anyOn} onClick={submit} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">Submit to manager</Button>
          {saved ? <span className="text-[12.5px] font-bold text-[#0f7a43]">✓ Sent to your manager</span> : <span className="text-[12.5px] text-[var(--ink-3)]">{submittedLabel}</span>}
          {!anyOn && <span className="text-[12px] text-[var(--ink-3)]">Turn on at least one day first.</span>}
        </div>
      </Card>
    </>
  );
}
