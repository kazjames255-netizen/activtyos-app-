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
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { type ClockRecord, loadClock, slug, clockIn, clockOut, startBreak, endBreak, workedMs, fmtDur, hhmm } from "@/features/timeclock/data";

const ME = "Marcus Bell";
const ME_ROLE = "Lead Coach"; // demo role (per-user identity is Amir's)
const ME_ID = slug(ME);
const ROTA_KEY = "aos.rota.v5";
interface Shift { id: string; staffId: string | null; site: string; role: string; listing?: string; date: string; start: string; end: string; in?: string; out?: string; note?: string }
interface Staff { id: string; name: string }
const ROLE_COL: Record<string, string> = { "Lead Coach": "#2f6bd8", Lifeguard: "#0f857b", Coach: "#6366f1", "Activity Assistant": "#8b5cf6", "Activity Instructor": "#b45309", "First Aider": "#c06a10" };
const roleCol = (r: string) => ROLE_COL[r] ?? "#64748b";

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
  }, []);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const today = todayISO();
  const upcoming = useMemo(() => shifts.filter((s) => s.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [shifts, today]);
  const past = useMemo(() => shifts.filter((s) => s.date < today).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)), [shifts, today]);

  // group upcoming by week (Mon-start)
  const weeks = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of upcoming) { const k = mondayISO(dt(s.date)); (m.get(k) || m.set(k, []).get(k)!).push(s); }
    return [...m.entries()];
  }, [upcoming]);
  const thisWeekHrs = useMemo(() => { const wk = mondayISO(new Date()); return upcoming.filter((s) => mondayISO(dt(s.date)) === wk).reduce((a, s) => a + hrsOf(s.start, s.end), 0); }, [upcoming]);
  const nextShift = upcoming[0];
  const pastTotal = past.reduce((a, s) => a + (s.in && s.out ? hrsOf(s.in, s.out) : hrsOf(s.start, s.end)), 0);

  // ── Who's on: gating + scope ──────────────────────────────────────────────
  const vis = settings.scheduling?.coworkerVisibility ?? "all";
  const iAmLead = /lead|manager|owner/i.test(ME_ROLE) || shifts.some((s) => /lead|manager|owner/i.test(s.role || ""));
  const teamVisible = vis !== "none" && (vis !== "leads" || iAmLead);
  const myListings = useMemo(() => new Set(shifts.map((s) => s.listing || s.site).filter(Boolean)), [shifts]);
  const inScope = (s: Shift) => vis === "team" ? myListings.has(s.listing || s.site) : true; // all/leads → everyone
  useEffect(() => { if (tab === "team" && !teamVisible) setTab("upcoming"); }, [tab, teamVisible]);

  const weekStart = addDaysISO(mondayISO(new Date()), weekOff * 7);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const teamByDay = useMemo(() => weekDays.map((d) => ({
    date: d,
    rows: allShifts.filter((s) => s.date === d && inScope(s)).sort((a, b) => a.start.localeCompare(b.start)),
  })), [weekDays, allShifts, vis, myListings]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekLabel = `${dt(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${dt(addDaysISO(weekStart, 6)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const teamCount = teamByDay.reduce((a, d) => a + d.rows.length, 0);

  // ── Clock in/out ──────────────────────────────────────────────────────────
  const rec = clock?.[ME_ID];
  const status = rec?.status ?? "out";
  const worked = rec ? workedMs(rec) : 0;
  const doIn = () => setClock((c) => clockIn(c || {}, ME_ID, ME, nextShift?.site));
  const doOut = () => setClock((c) => clockOut(c || {}, ME_ID, ME));
  const doBreak = () => setClock((c) => (status === "break" ? endBreak(c || {}, ME_ID) : startBreak(c || {}, ME_ID)));
  const todayShift = shifts.find((s) => s.date === today);

  const TABS: [Tab, string][] = [
    ["upcoming", "Upcoming"],
    ["clock", "Clock in/out"],
    ...(teamVisible ? ([["team", "Who’s on"]] as [Tab, string][]) : []),
    ["timesheet", "Timesheet"],
  ];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My schedule" icon="🗓" lede="Your rostered shifts and clock in/out, all in one place. Check your times, then clock in when you arrive." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Next shift", nextShift ? dayLabel(nextShift.date) : "—", nextShift ? `${to12(nextShift.start)}–${to12(nextShift.end)} · ${nextShift.role}` : "nothing booked"],
          ["This week", hLabel(thisWeekHrs), "rostered hours"],
          ["Upcoming shifts", String(upcoming.length), "on your rota"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
            <div className="mt-1 text-[19px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
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
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">No shifts on your rota yet. Your manager will publish them here — you&rsquo;ll see your times and can clock in on the day.</Card>
        ) : weeks.map(([wk, ss]) => (
          <div key={wk} className="mb-4">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Week of {dt(wk).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {hLabel(ss.reduce((a, s) => a + hrsOf(s.start, s.end), 0))}</div>
            <Card className="p-0"><ul className="divide-y divide-[var(--line)]">
              {ss.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3.5">
                  <div className="w-1.5 self-stretch rounded-full" style={{ background: roleCol(s.role) }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-[var(--ink)]">{dayLabel(s.date)}</div>
                    <div className="text-[12.5px] text-[var(--ink-2)]">{to12(s.start)}–{to12(s.end)} · <span style={{ color: roleCol(s.role) }} className="font-bold">{s.role}</span>{s.site ? ` · ${s.site}` : ""}{s.listing ? ` · ${s.listing}` : ""}</div>
                    {s.note && <div className="text-[11.5px] text-[var(--ink-3)]">{s.note}</div>}
                  </div>
                  <div className="text-right text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{hLabel(hrsOf(s.start, s.end))}</div>
                </li>
              ))}
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
                <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={status === "in" ? { background: "#e6f4ea", color: "#0f7a43" } : status === "break" ? { background: "#fdf3e0", color: "#8a5a09" } : { background: "#eef1f6", color: "#64748b" }}><span className="h-2 w-2 rounded-full" style={{ background: status === "in" ? "#12b76a" : status === "break" ? "#f59e0b" : "#94a3b8" }} />{status === "in" ? "Clocked in" : status === "break" ? "On break" : "Clocked out"}{status !== "out" && rec?.clockInAt ? ` · since ${hhmm(rec.clockInAt)}` : ""}</span>
              </div>
            </div>

            {status === "out" && !rec?.clockOutAt ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--panel)] p-4 text-[13px] text-[var(--ink-2)]">
                <span className="text-[18px]">👋</span>
                <span>You&rsquo;re not clocked in yet.{todayShift ? <> You&rsquo;re scheduled <b className="text-[var(--ink)]">{todayShift.start}–{todayShift.end}</b> today.</> : " Tap below when your shift starts."}</span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[var(--panel)] p-4">
                <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Worked today</div><div className="text-[26px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{fmtDur(worked)}</div></div>
                {rec && rec.breakMs > 0 && <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Break</div><div className="text-[15px] font-extrabold tabular-nums text-[#8a5a09]">{fmtDur(rec.breakMs)}</div></div>}
                {todayShift && <div className="ml-auto text-right"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Scheduled</div><div className="text-[13px] font-bold text-[var(--ink-2)]">{todayShift.start}–{todayShift.end}</div></div>}
              </div>
            )}
            {rec?.lateMin ? <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-1.5 text-[11.5px] font-semibold text-[#8a5a09]">Clocked in {rec.lateMin} min after your {todayShift?.start} start.</div> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {status === "out" && <button type="button" onClick={doIn} className="flex-1 rounded-full bg-[#0f9d58] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(15,157,88,.6)] hover:brightness-105">⏱ {rec?.clockOutAt ? "Clock back in" : "Clock in"}</button>}
              {status === "in" && <>
                <button type="button" onClick={doOut} className="flex-1 rounded-full bg-[#1d3a8f] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-110">Clock out</button>
                <Button onClick={doBreak}>Start break</Button>
              </>}
              {status === "break" && <>
                <button type="button" onClick={doBreak} className="flex-1 rounded-full bg-[#f59e0b] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-105">End break</button>
                <Button onClick={doOut}>Clock out</Button>
              </>}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Today</div>
            {!rec || rec.events.length === 0 ? <div className="py-3 text-[12.5px] text-[var(--ink-3)]">No clock activity yet — hit <b>Clock in</b> to start.</div> : (
              <div className="divide-y divide-[var(--line)]">{rec.events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                  <span>{e.kind === "in" ? "🟢" : e.kind === "out" ? "🔴" : e.kind === "break-start" ? "⏸" : "▶️"}</span>
                  <span className="font-semibold text-[var(--ink)]">{e.kind === "in" ? "Clocked in" : e.kind === "out" ? "Clocked out" : e.kind === "break-start" ? "Break started" : "Break ended"}</span>
                  <span className="ml-auto tabular-nums text-[var(--ink-3)]">{hhmm(e.t)}</span>
                </div>
              ))}</div>
            )}
          </Card>
        </div>
      )}

      {/* ── Who's on this week ── */}
      {tab === "team" && teamVisible && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setWeekOff((w) => w - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white text-[14px] text-[var(--ink-2)] hover:bg-[var(--panel)]" aria-label="Previous week">‹</button>
              <span className="px-1 text-[12.5px] font-extrabold text-[var(--ink)]">{weekOff === 0 ? "This week" : weekLabel}</span>
              <button type="button" onClick={() => setWeekOff((w) => w + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white text-[14px] text-[var(--ink-2)] hover:bg-[var(--panel)]" aria-label="Next week">›</button>
              {weekOff !== 0 && <button type="button" onClick={() => setWeekOff(0)} className="ml-1 text-[11.5px] font-bold text-[#1d3a8f]">Today</button>}
            </div>
            <span className="text-[11.5px] text-[var(--ink-3)]">{vis === "team" ? "Your listings" : "Whole team"} · {teamCount} shift{teamCount === 1 ? "" : "s"}</span>
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-[var(--line)]">
              {teamByDay.map(({ date, rows }) => (
                <li key={date} className="grid grid-cols-[92px_1fr] gap-2 p-3.5">
                  <div className={"text-[12px] font-extrabold " + (date === today ? "text-[#1d3a8f]" : "text-[var(--ink-2)]")}>{dt(date).toLocaleDateString("en-GB", { weekday: "short" })}<div className="text-[11px] font-semibold text-[var(--ink-3)]">{dt(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>{date === today && <div className="mt-0.5 inline-block rounded-full bg-[#eef4fd] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#1d3a8f]">Today</div>}</div>
                  {rows.length === 0 ? <div className="self-center text-[12px] text-[var(--ink-3)]">—</div> : (
                    <div className="flex flex-col gap-1.5">
                      {rows.map((s) => { const mine = s.staffId === myId; return (
                        <div key={s.id} className={"flex items-center gap-2 rounded-lg px-2.5 py-1.5 " + (mine ? "bg-[#eef4fd]" : "bg-[var(--panel)]")}>
                          <span className="h-2 w-2 flex-none rounded-full" style={{ background: roleCol(s.role) }} />
                          <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{mine ? "You" : (staffById[s.staffId!] ?? "Staff")}</span>
                          <span className="text-[12px] tabular-nums text-[var(--ink-2)]">{to12(s.start)}–{to12(s.end)}</span>
                          <span className="truncate text-[11.5px] text-[var(--ink-3)]">· {s.role}{s.listing ? ` · ${s.listing}` : s.site ? ` · ${s.site}` : ""}</span>
                        </div>
                      ); })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">{vis === "team" ? "You can see everyone rostered on the listings you work on." : vis === "leads" ? "As a lead you can see the whole team's rota." : "Your provider shows the whole team's rota."} Times are the published rota.</p>
        </div>
      )}

      {/* ── Timesheet ── */}
      {tab === "timesheet" && (
        past.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">No past shifts yet. Once you&rsquo;ve worked, your hours appear here — scheduled vs actually clocked.</Card>
        ) : (
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-3.5"><span className="text-[12px] font-bold uppercase text-[var(--ink-3)]">Recent shifts</span><span className="text-[13px] font-extrabold text-[var(--ink)]">Total {hLabel(pastTotal)}</span></div>
            <ul className="divide-y divide-[var(--line)]">
              {past.map((s) => { const sched = hrsOf(s.start, s.end); const clockH = s.in && s.out ? hrsOf(s.in, s.out) : null; return (
                <li key={s.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-[var(--ink)]">{dayLabel(s.date)}</div><div className="text-[12px] text-[var(--ink-3)]">{to12(s.start)}–{to12(s.end)} · {s.role}</div></div>
                  <div className="text-right text-[12px]">
                    <div className="text-[var(--ink-3)]">Scheduled <b className="text-[var(--ink)]">{hLabel(sched)}</b></div>
                    <div className={clockH == null ? "text-[var(--ink-3)]" : "text-[#0f7a43]"}>{clockH == null ? "Not clocked" : <>Clocked <b>{hLabel(clockH)}</b></>}</div>
                  </div>
                </li>
              ); })}
            </ul>
          </Card>
        )
      )}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Times are your employer&rsquo;s published rota. If something looks wrong, message your manager.</p>
    </div>
  );
}
