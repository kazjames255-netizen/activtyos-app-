"use client";

// Staff-facing "My schedule" — one page for everything shift-related:
//  • Upcoming — the shifts YOU are rostered on (week-grouped)
//  • Clock in/out — start/break/finish for today (same store as the old page)
//  • Who's on — the team's rota this week, gated by a company setting
//    (settings.scheduling.coworkerVisibility: all / same-listing / leads / off)
//  • Timesheet — past shifts, scheduled vs clocked
// Reads the same demo rota the manager builds (aos.rota.v5), filtered to the
// logged-in person. Demo "me" = Marcus Bell; in production this is scoped
// server-side (per-user identity + deployment = Amir).
import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { type ClockRecord, loadClock, slug, clockIn, clockOut, startBreak, endBreak, workedMs, fmtDur, fmtDurSec, hhmm } from "@/features/timeclock/data";

const ME = "Marcus Bell";
const ME_ROLE = "Lead Coach"; // demo role (per-user identity is Amir's)
const ME_ID = slug(ME);
const AVAIL_ID = "me-avail"; // staffId for my real assigned camp days
const ROTA_KEY = "aos.rota.v5";
interface Shift { id: string; staffId: string | null; site: string; role: string; listing?: string; date: string; start: string; end: string; in?: string; out?: string; note?: string; rate?: number; address?: string }
const money = (n: number) => `£${n.toFixed(2)}`;
interface Staff { id: string; name: string }
const ROLE_COL: Record<string, string> = { "Lead Coach": "#2f6bd8", Lifeguard: "#0f857b", Coach: "#6366f1", "Activity Assistant": "#8b5cf6", "Activity Instructor": "#b45309", "First Aider": "#c06a10" };
const roleCol = (r: string) => ROLE_COL[r] ?? "#64748b";
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
// day timeline window for the little shift bars (07:00 → 19:00)
const DAY_A = 7 * 60, DAY_B = 19 * 60;
const barPos = (start: string, end: string) => {
  const a = Math.max(DAY_A, mins(start)), b = Math.min(DAY_B, Math.max(mins(end), mins(start) + 15));
  const span = DAY_B - DAY_A;
  return { left: `${((a - DAY_A) / span) * 100}%`, width: `${(Math.max(b - a, 8) / span) * 100}%` };
};

const dt = (d: string) => new Date(d + "T00:00:00");
const mins = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const to12 = (t: string) => { const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`; };
const hrsOf = (a: string, b: string) => Math.max(0, (mins(b) - mins(a)) / 60);
const hLabel = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
// format a Date as local yyyy-mm-dd (NOT toISOString, which shifts to UTC and can
// roll the date back a day under BST/positive offsets — breaking week grouping)
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayISO = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return localISO(x); };
const todayISO = () => localISO(new Date());
const dayLabel = (d: string) => dt(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const addDaysISO = (iso: string, n: number) => { const d = dt(iso); d.setDate(d.getDate() + n); return localISO(d); };

type Tab = "upcoming" | "clock" | "team" | "timesheet";

export function MyScheduleApp() {
  const t = useT();
  const { settings } = useSettings();
  const [shifts, setShifts] = useState<Shift[]>([]);      // mine
  const [allShifts, setAllShifts] = useState<Shift[]>([]); // whole team (assigned)
  const [staffById, setStaffById] = useState<Record<string, string>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "upcoming";
    const q = new URLSearchParams(window.location.search).get("tab");
    return (["upcoming", "clock", "team", "timesheet"] as const).includes(q as Tab) ? (q as Tab) : "upcoming";
  });
  const [clock, setClock] = useState<Record<string, ClockRecord> | null>(null);
  const [, tick] = useState(0);
  const [weekOff, setWeekOff] = useState(0); // Who's-on week stepper
  // Real shifts assigned to ME from the availability store (backend), turned into
  // schedule entries so they show alongside the demo rota.
  const [assignedShifts, setAssignedShifts] = useState<Shift[]>([]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(ROTA_KEY) || "null") as { staff?: Staff[]; shifts?: Shift[] } | null;
      const staff = s?.staff || [];
      const id = staff.find((x) => x.name === ME)?.id ?? null;
      const all = s?.shifts || [];
      setMyId(id);
      setStaffById(Object.fromEntries(staff.map((x) => [x.id, x.name])));
      setShifts(all.filter((sh) => sh.staffId && sh.staffId === id));
      setAllShifts(all.filter((sh) => !!sh.staffId));
    } catch { /* ignore */ }
    setClock(loadClock());
    // My assigned camp days → shifts (times from my submitted grid, else camp hours).
    apiGet<{ requests: { camp?: { listingName: string; location?: string; address?: string; payRate?: number; open: string; close: string; assignedDates?: string[] } | null }[]; pattern: { grid?: Record<string, { from: string; to: string }> } | null }>("/api/availability/mine")
      .then((r) => {
        const grid = r.pattern?.grid ?? {};
        const out: Shift[] = [];
        for (const req of r.requests || []) {
          const camp = req.camp; if (!camp?.assignedDates?.length) continue;
          for (const date of camp.assignedDates) {
            const g = grid[date];
            out.push({ id: `avail-${date}`, staffId: AVAIL_ID, site: camp.location ?? "", role: "", listing: camp.listingName, date, start: g?.from ?? camp.open, end: g?.to ?? camp.close, rate: camp.payRate, address: camp.address });
          }
        }
        setAssignedShifts(out);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const today = todayISO();
  // Everything that is "mine" — the demo rota plus my real assigned camp days.
  const mine = useMemo(() => [...shifts, ...assignedShifts], [shifts, assignedShifts]);
  const upcoming = useMemo(() => mine.filter((s) => s.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [mine, today]);
  const past = useMemo(() => mine.filter((s) => s.date < today).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)), [mine, today]);

  // group upcoming by week (Mon-start)
  const weeks = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of upcoming) { const k = mondayISO(dt(s.date)); (m.get(k) || m.set(k, []).get(k)!).push(s); }
    return [...m.entries()];
  }, [upcoming]);
  const thisWeekHrs = useMemo(() => { const wk = mondayISO(new Date()); return upcoming.filter((s) => mondayISO(dt(s.date)) === wk).reduce((a, s) => a + hrsOf(s.start, s.end), 0); }, [upcoming]);
  const nextShift = upcoming[0];

  // ── Who's on: gating + scope ──────────────────────────────────────────────
  const vis = settings.scheduling?.coworkerVisibility ?? "all";
  const iAmLead = /lead|manager|owner/i.test(ME_ROLE) || mine.some((s) => /lead|manager|owner/i.test(s.role || ""));
  const teamVisible = vis !== "none" && (vis !== "leads" || iAmLead);
  const myListings = useMemo(() => new Set(mine.map((s) => s.listing || s.site).filter(Boolean)), [mine]);
  const inScope = (s: Shift) => vis === "team" ? myListings.has(s.listing || s.site) : true; // all/leads → everyone
  useEffect(() => { if (tab === "team" && !teamVisible) setTab("upcoming"); }, [tab, teamVisible]);

  const weekStart = addDaysISO(mondayISO(new Date()), weekOff * 7);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const teamAll = useMemo(() => [...allShifts, ...assignedShifts], [allShifts, assignedShifts]);
  const teamByDay = useMemo(() => weekDays.map((d) => ({
    date: d,
    rows: teamAll.filter((s) => s.date === d && inScope(s)).sort((a, b) => a.start.localeCompare(b.start)),
  })), [weekDays, teamAll, vis, myListings]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekLabel = `${dt(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${dt(addDaysISO(weekStart, 6)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const teamCount = teamByDay.reduce((a, d) => a + d.rows.length, 0);
  const weekStats = useMemo(() => {
    const rows = teamByDay.flatMap((d) => d.rows);
    return {
      people: new Set(rows.map((r) => r.staffId)).size,
      hours: rows.reduce((a, s) => a + hrsOf(s.start, s.end), 0),
      roles: [...new Set(rows.map((r) => r.role).filter(Boolean))],
      busiest: teamByDay.reduce((best, d) => (d.rows.length > best.n ? { date: d.date, n: d.rows.length } : best), { date: "", n: 0 }),
    };
  }, [teamByDay]);

  // ── Clock in/out ──────────────────────────────────────────────────────────
  const rec = clock?.[ME_ID];
  const status = rec?.status ?? "out";
  const worked = rec ? workedMs(rec) : 0;
  const doIn = () => setClock((c) => clockIn(c || {}, ME_ID, ME, nextShift?.site));
  const doOut = () => setClock((c) => clockOut(c || {}, ME_ID, ME));
  const doBreak = () => setClock((c) => (status === "break" ? endBreak(c || {}, ME_ID) : startBreak(c || {}, ME_ID)));
  const todayShift = shifts.find((s) => s.date === today);

  const TABS: [Tab, string][] = [
    ["upcoming", t("schedule.tabUpcoming")],
    ["clock", t("schedule.tabClock")],
    ...(teamVisible ? ([["team", t("schedule.tabWhosOn")]] as [Tab, string][]) : []),
    ["timesheet", t("schedule.tabTimesheet")],
  ];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("schedule.myScheduleTitle")} icon="🗓" lede={t("schedule.myScheduleLede")} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([
          ["📅", t("schedule.nextShift"), nextShift ? dayLabel(nextShift.date) : "—", nextShift ? `${to12(nextShift.start)}–${to12(nextShift.end)} · ${nextShift.role}` : t("schedule.nothingBooked"), "#1d3a8f", "#eef4fd"],
          ["⏱", t("schedule.thisWeek"), hLabel(thisWeekHrs), t("schedule.rotaHours"), "#0f857b", "#e6f6f3"],
          ["🗓", t("schedule.upcomingShifts"), String(upcoming.length), t("schedule.onYourRota"), "#7c3aed", "#f1ecfe"],
        ] as [string, string, string, string, string, string][]).map(([ic, label, value, sub, col, bg]) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[19px]" style={{ background: bg }}>{ic}</span>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
              <div className="truncate text-[19px] font-black leading-tight tracking-tight" style={{ fontFamily: "var(--ff-display)", color: col }}>{value}</div>
              <div className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 mb-2 inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
        {TABS.map(([t, label]) => {
          const active = tab === t;
          const clock = t === "clock";
          return (
            <button key={t} type="button" onClick={() => setTab(t)} style={active ? { background: clock ? "#0f9d58" : "#1d3a8f" } : undefined} className={
              (clock ? "rounded-xl px-5 py-2.5 text-[15px] " : "rounded-lg px-3.5 py-1.5 text-[12.5px] ") +
              "font-extrabold " +
              (active ? "text-white" : clock ? "bg-[#e7f7ee] text-[#0f7a43]" : "text-[var(--ink-2)]")
            }>{clock ? "⏱ " : ""}{label}</button>
          );
        })}
      </div>

      {/* ── Upcoming ── */}
      {tab === "upcoming" && (
        weeks.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">{t("schedule.noShiftsYet")}</Card>
        ) : weeks.map(([wk, ss], wi) => (
          <div key={wk} className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-[var(--ink-2)]">{wi === 0 ? t("schedule.thisWeek") : t("schedule.weekOf", { date: dt(wk).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) })}</span>
              <span className="h-px flex-1 bg-[var(--line)]" />
              <span className="rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)]">{ss.length} {ss.length === 1 ? t("schedule.shift") : t("schedule.shifts")} · {hLabel(ss.reduce((a, s) => a + hrsOf(s.start, s.end), 0))}</span>
            </div>
            <Card className="p-0"><ul className="divide-y divide-[var(--line)]">
              {ss.map((s) => {
                const col = roleCol(s.role);
                const isToday = s.date === today;
                const pos = barPos(s.start, s.end);
                return (
                  <li key={s.id} className={"flex items-center gap-3 p-3.5 " + (isToday ? "bg-[#f5f8ff]" : "")}>
                    <div className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl text-center leading-none" style={{ background: col + "16", color: col }}>
                      <span className="text-[9.5px] font-black uppercase tracking-wide">{dt(s.date).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                      <span className="mt-0.5 text-[17px] font-black">{dt(s.date).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{dt(s.date).toLocaleDateString("en-GB", { weekday: "long" })}</span>
                        {isToday && <span className="rounded-full bg-[#1d3a8f] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{t("schedule.today")}</span>}
                        <span className="ml-auto tabular-nums text-[12.5px] font-bold text-[var(--ink)]">{to12(s.start)}–{to12(s.end)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {s.role && <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: col + "1a", color: col }}>{s.role}</span>}
                        {s.listing && <span className="truncate text-[11.5px] font-bold text-[var(--ink-2)]">{s.listing}</span>}
                        <span className="ml-auto flex-none rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[var(--ink-2)]">{hLabel(hrsOf(s.start, s.end))}</span>
                      </div>
                      {(s.site || s.address) && <div className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]"><span className="flex-none">📍</span><span className="truncate">{[s.site, s.address].filter(Boolean).join(" · ")}</span></div>}
                      {s.rate != null && s.rate > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                          <span className="rounded-md bg-[#e7f5ec] px-1.5 py-0.5 font-extrabold tabular-nums text-[#0f7a43]">{money(s.rate)}/hr</span>
                          <span className="text-[var(--ink-3)]">est. <b className="tabular-nums text-[var(--ink)]">{money(s.rate * hrsOf(s.start, s.end))}</b> this shift</span>
                        </div>
                      )}
                      {s.note && <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">📝 {s.note}</div>}
                      <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel)]">
                        <span className="absolute inset-y-0 rounded-full" style={{ left: pos.left, width: pos.width, background: col }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul></Card>
          </div>
        ))
      )}

      {/* ── Clock in/out ── */}
      {tab === "clock" && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef4fd] text-[16px] font-extrabold text-[#1d3a8f]">{ME.split(" ").map((w) => w[0]).join("")}</span>
              <div>
                <div className="text-[15px] font-extrabold text-[var(--ink)]">{ME}</div>
                <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={status === "in" ? { background: "#e6f4ea", color: "#0f7a43" } : status === "break" ? { background: "#fdf3e0", color: "#8a5a09" } : { background: "#eef1f6", color: "#64748b" }}><span className="h-2 w-2 rounded-full" style={{ background: status === "in" ? "#12b76a" : status === "break" ? "#f59e0b" : "#94a3b8" }} />{status === "in" ? t("schedule.clockedIn") : status === "break" ? t("schedule.onBreak") : t("schedule.clockedOut")}{status !== "out" && rec?.clockInAt ? ` · ${t("schedule.sinceTime", { time: hhmm(rec.clockInAt) })}` : ""}</span>
              </div>
            </div>

            {status === "out" && !rec?.clockOutAt ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--panel)] p-4 text-[13px] text-[var(--ink-2)]">
                <span className="text-[18px]">👋</span>
                <span>{t("schedule.notClockedInYet")}{todayShift ? <> {t("schedule.youreScheduled")} <b className="text-[var(--ink)]">{todayShift.start}–{todayShift.end}</b> {t("schedule.todayLower")}</> : ` ${t("schedule.tapBelowWhenStarts")}`}</span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[var(--panel)] p-4">
                <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.workedToday")}</div><div className="text-[26px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{status === "in" ? fmtDurSec(worked) : fmtDur(worked)}</div></div>
                {rec && rec.breakMs > 0 && <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.breakLabel")}</div><div className="text-[15px] font-extrabold tabular-nums text-[#8a5a09]">{fmtDur(rec.breakMs)}</div></div>}
                {todayShift && <div className="ml-auto text-right"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.scheduled")}</div><div className="text-[13px] font-bold text-[var(--ink-2)]">{todayShift.start}–{todayShift.end}</div></div>}
              </div>
            )}
            {rec?.lateMin ? <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-1.5 text-[11.5px] font-semibold text-[#8a5a09]">{t("schedule.clockedInLate", { min: rec.lateMin, start: todayShift?.start ?? "" })}</div> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {status === "out" && <button type="button" onClick={doIn} className="flex-1 rounded-full bg-[#0f9d58] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(15,157,88,.6)] hover:brightness-105">⏱ {rec?.clockOutAt ? t("schedule.clockBackIn") : t("schedule.clockIn")}</button>}
              {status === "in" && <>
                <button type="button" onClick={doOut} className="flex-1 rounded-full bg-[#1d3a8f] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-110">{t("schedule.clockOut")}</button>
                <Button onClick={doBreak}>{t("schedule.startBreak")}</Button>
              </>}
              {status === "break" && <>
                <button type="button" onClick={doBreak} className="flex-1 rounded-full bg-[#f59e0b] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-105">{t("schedule.endBreak")}</button>
                <Button onClick={doOut}>{t("schedule.clockOut")}</Button>
              </>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.todayLabel")}</div>
            {!rec || rec.events.length === 0 ? <div className="py-3 text-[12.5px] text-[var(--ink-3)]">{t("schedule.noClockActivity")}</div> : (
              <div className="divide-y divide-[var(--line)]">{rec.events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                  <span>{e.kind === "in" ? "🟢" : e.kind === "out" ? "🔴" : e.kind === "break-start" ? "⏸" : "▶️"}</span>
                  <span className="font-semibold text-[var(--ink)]">{e.kind === "in" ? t("schedule.clockedIn") : e.kind === "out" ? t("schedule.clockedOut") : e.kind === "break-start" ? t("schedule.breakStarted") : t("schedule.breakEnded")}</span>
                  <span className="ml-auto tabular-nums text-[var(--ink-3)]">{hhmm(e.t)}</span>
                </div>
              ))}</div>
            )}
          </Card>
        </div>
      )}

      {/* ── Who's on this week ── */}
      {tab === "team" && teamVisible && (
        <div className="flex flex-col gap-3">
          {/* header: week stepper + scope */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setWeekOff((w) => w - 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-[15px] text-[var(--ink-2)] shadow-sm transition hover:bg-[var(--panel)] hover:text-[var(--ink)]" aria-label={t("schedule.previousWeek")}>‹</button>
              <span className="min-w-[112px] px-2 text-center text-[13px] font-extrabold text-[var(--ink)]">{weekOff === 0 ? t("schedule.thisWeek") : weekLabel}</span>
              <button type="button" onClick={() => setWeekOff((w) => w + 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-[15px] text-[var(--ink-2)] shadow-sm transition hover:bg-[var(--panel)] hover:text-[var(--ink)]" aria-label={t("schedule.nextWeek")}>›</button>
              {weekOff !== 0 && <button type="button" onClick={() => setWeekOff(0)} className="ml-1 rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-extrabold text-[#1d3a8f] hover:brightness-95">{t("schedule.jumpToToday")}</button>}
            </div>
            <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-bold text-[var(--ink-3)]">{vis === "team" ? t("schedule.yourListings") : t("schedule.wholeTeam")}</span>
          </div>

          {/* summary strip */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
            {([
              ["👥", String(weekStats.people), weekStats.people === 1 ? t("schedule.personOn") : t("schedule.peopleOn"), "#1d3a8f", "#eef4fd"],
              ["🗓", String(teamCount), teamCount === 1 ? t("schedule.shift") : t("schedule.shifts"), "#0f857b", "#e6f6f3"],
              ["⏱", hLabel(weekStats.hours), t("schedule.teamHours"), "#7c3aed", "#f1ecfe"],
            ] as [string, string, string, string, string][]).map(([ic, big, small, col, bg]) => (
              <div key={small} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[16px]" style={{ background: bg }}>{ic}</span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[17px] font-black tracking-tight tabular-nums" style={{ color: col }}>{big}</div>
                  <div className="truncate text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{small}</div>
                </div>
              </div>
            ))}
          </div>

          {/* role legend */}
          {weekStats.roles.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-[var(--panel)] px-3 py-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.roles")}</span>
              {weekStats.roles.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleCol(r) }} />{r}
                </span>
              ))}
            </div>
          )}

          {/* days */}
          <div className="flex flex-col gap-2.5">
            {teamByDay.map(({ date, rows }) => {
              const isToday = date === today;
              return (
                <Card key={date} className={"overflow-hidden p-0 " + (isToday ? "ring-2 ring-[#1d3a8f]/25" : "")}>
                  <div className={"flex items-center justify-between px-4 py-2.5 " + (isToday ? "bg-gradient-to-r from-[#1d3a8f] to-[#3b63c9] text-white" : "border-b border-[var(--line)] bg-[var(--panel)]")}>
                    <div className="flex items-baseline gap-2">
                      <span className={"text-[13px] font-black " + (isToday ? "text-white" : "text-[var(--ink)]")}>{dt(date).toLocaleDateString("en-GB", { weekday: "long" })}</span>
                      <span className={"text-[11.5px] font-semibold " + (isToday ? "text-white/80" : "text-[var(--ink-3)]")}>{dt(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      {isToday && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">{t("schedule.today")}</span>}
                    </div>
                    <span className={"text-[11px] font-bold " + (isToday ? "text-white/90" : "text-[var(--ink-3)]")}>{rows.length === 0 ? t("schedule.noOneOn") : t("schedule.nOn", { n: rows.length })}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-4 py-4 text-center text-[12px] text-[var(--ink-3)]">{t("schedule.nobodyOnRota")}</div>
                  ) : (
                    <ul className="divide-y divide-[var(--line)]">
                      {rows.map((s) => {
                        const isMe = s.staffId === myId || s.staffId === AVAIL_ID;
                        const name = isMe ? t("schedule.you") : (staffById[s.staffId!] ?? t("schedule.staff"));
                        const col = roleCol(s.role);
                        const pos = barPos(s.start, s.end);
                        return (
                          <li key={s.id} className={"flex items-center gap-3 px-3.5 py-2.5 " + (isMe ? "bg-[#f5f8ff]" : "")}>
                            <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-black" style={{ background: col + "1f", color: col }}>{isMe ? initials(ME) : initials(staffById[s.staffId!] ?? "St")}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-extrabold text-[var(--ink)]">{name}</span>
                                {isMe && <span className="rounded-full bg-[#1d3a8f] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{t("schedule.you")}</span>}
                                <span className="ml-auto tabular-nums text-[12px] font-bold text-[var(--ink-2)]">{to12(s.start)}–{to12(s.end)}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: col + "1a", color: col }}>{s.role}</span>
                                {(s.listing || s.site) && <span className="truncate text-[11px] font-medium text-[var(--ink-3)]">{s.listing || s.site}</span>}
                              </div>
                              {/* mini timeline bar */}
                              <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel)]">
                                <span className="absolute inset-y-0 rounded-full" style={{ left: pos.left, width: pos.width, background: col }} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
          <p className="text-[11.5px] text-[var(--ink-3)]">{vis === "team" ? t("schedule.visTeam") : vis === "leads" ? t("schedule.visLeads") : t("schedule.visAll")} {t("schedule.barExplainer")}</p>
        </div>
      )}

      {/* ── Timesheet ── */}
      {tab === "timesheet" && (
        past.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">{t("schedule.noPastShifts")}</Card>
        ) : (() => {
          const schedTotal = past.reduce((a, s) => a + hrsOf(s.start, s.end), 0);
          const clockedTotal = past.reduce((a, s) => a + (s.in && s.out ? hrsOf(s.in, s.out) : 0), 0);
          const clockedCount = past.filter((s) => s.in && s.out).length;
          return (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2.5">
                {([
                  ["🗓", String(past.length), past.length === 1 ? t("schedule.shiftWorked") : t("schedule.shiftsWorked"), "#1d3a8f", "#eef4fd"],
                  ["📋", hLabel(schedTotal), t("schedule.scheduledLower"), "#0f857b", "#e6f6f3"],
                  ["✅", hLabel(clockedTotal), t("schedule.clockedCount", { done: clockedCount, total: past.length }), "#0f7a43", "#e7f5ec"],
                ] as [string, string, string, string, string][]).map(([ic, big, small, col, bg]) => (
                  <div key={small} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[16px]" style={{ background: bg }}>{ic}</span>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-[16px] font-black tracking-tight tabular-nums" style={{ color: col }}>{big}</div>
                      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{small}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5"><span className="text-[11px] font-black uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.recentShifts")}</span><span className="text-[12px] font-bold text-[var(--ink-3)]">{t("schedule.scheduledVsClocked")}</span></div>
                <ul className="divide-y divide-[var(--line)]">
                  {past.map((s) => {
                    const sched = hrsOf(s.start, s.end);
                    const clockH = s.in && s.out ? hrsOf(s.in, s.out) : null;
                    const col = roleCol(s.role);
                    const diff = clockH == null ? null : clockH - sched;
                    return (
                      <li key={s.id} className="flex items-center gap-3 p-3.5">
                        <div className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-xl text-center leading-none" style={{ background: col + "16", color: col }}>
                          <span className="text-[9px] font-black uppercase tracking-wide">{dt(s.date).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                          <span className="mt-0.5 text-[16px] font-black">{dt(s.date).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-extrabold text-[var(--ink)]">{dt(s.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: col + "1a", color: col }}>{s.role}</span>
                            <span className="text-[11.5px] tabular-nums text-[var(--ink-3)]">{to12(s.start)}–{to12(s.end)}</span>
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.sched")} <b className="text-[var(--ink-2)]">{hLabel(sched)}</b></div>
                          {clockH == null ? (
                            <span className="mt-1 inline-block rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)]">{t("schedule.notClocked")}</span>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={Math.abs(diff!) < 0.08 ? { background: "#e7f5ec", color: "#0f7a43" } : diff! < 0 ? { background: "#fdf3e0", color: "#8a5a09" } : { background: "#eef4fd", color: "#1d3a8f" }}>
                              {hLabel(clockH)}{Math.abs(diff!) >= 0.08 && <span className="tabular-nums">({diff! > 0 ? "+" : "−"}{hLabel(Math.abs(diff!))})</span>}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          );
        })()
      )}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("schedule.timesFooter")}</p>
    </div>
  );
}
