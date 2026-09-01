"use client";

// Staff attendance board — a per-site timeline of who's on shift, with sign-in /
// leaving times, hours worked, and an attendance % per site + overall. Filters by
// site/listing and date. Reads the live staff clock store (the Clock in/out data).
// Demo/localStorage-backed and today-only; historical days + real per-listing
// grouping are Amir's (the timesheet backend).
import { useEffect, useMemo, useState } from "react";
import { loadClock, workedMs, fmtDur, hhmm, type ClockRecord } from "@/features/timeclock/data";

const GREEN = "#0f9d58", BLUE = "#1d3a8f", AMBER = "#b45309";
const todayISO = () => new Date().toISOString().slice(0, 10);
const toMin = (iso?: string) => { if (!iso) return null; const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const hourLabel = (m: number) => { const h = Math.floor(m / 60), mm = m % 60; const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`; };
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const checkedIn = (r: ClockRecord) => !!r.clockInAt;

export function StaffAttendanceBoard() {
  const [all, setAll] = useState<Record<string, ClockRecord> | null>(null);
  const [site, setSite] = useState("all");
  const [date, setDate] = useState(todayISO());
  const [, tick] = useState(0);
  useEffect(() => { setAll(loadClock()); }, []);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const recs = useMemo(() => Object.values(all ?? {}), [all]);
  const sites = useMemo(() => [...new Set(recs.map((r) => r.op || "Unassigned"))].sort(), [recs]);
  if (!all) return null;

  const isToday = date === todayISO();
  const shown = isToday ? recs.filter((r) => site === "all" || (r.op || "Unassigned") === site) : [];
  const groups = (() => { const m = new Map<string, ClockRecord[]>(); for (const r of shown) { const k = r.op || "Unassigned"; (m.get(k) || m.set(k, []).get(k)!).push(r); } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); })();

  const rawNow = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const inRecs = shown.filter(checkedIn);
  const stamps = inRecs.flatMap((r) => [toMin(r.clockInAt)!, r.clockOutAt ? toMin(r.clockOutAt)! : rawNow]);
  let ws = stamps.length ? Math.floor((Math.min(...stamps) - 30) / 60) * 60 : 8 * 60;
  let we = stamps.length ? Math.ceil((Math.max(...stamps) + 30) / 60) * 60 : 18 * 60;
  ws = Math.max(0, ws); we = Math.min(24 * 60, we); if (we - ws < 240) we = Math.min(24 * 60, ws + 240);
  const span = we - ws;
  const pctOf = (m: number) => Math.max(0, Math.min(100, ((m - ws) / span) * 100));
  const nowMin = Math.max(ws, Math.min(we, rawNow));
  const pctIn = (rs: ClockRecord[]) => (rs.length ? Math.round((rs.filter(checkedIn).length / rs.length) * 100) : 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <span className="text-[15px]">🗓️</span>
        <span className="text-[14px] font-extrabold text-[var(--ink)]">Staff attendance</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[#1d3a8f]">{inRecs.length} of {shown.length} on site · {pctIn(shown)}%</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={site} onChange={(e) => setSite(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink)]">
            <option value="all">All sites / listings</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink)]" />
        </div>
      </div>

      {!isToday ? (
        <div className="px-4 py-10 text-center text-[12.5px] text-[var(--ink-3)]">Live attendance is today only. Past-day history comes from the timesheet backend (Amir&rsquo;s).</div>
      ) : groups.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12.5px] text-[var(--ink-3)]">No staff clocked in{site === "all" ? "" : ` at ${site}`} yet today.</div>
      ) : (
        <div className="p-4">
          <div className="relative mb-2 hidden h-4 text-[10.5px] font-semibold text-[var(--ink-3)] sm:block" style={{ marginLeft: 176, marginRight: 128 }}>
            <span className="absolute left-0">{hourLabel(ws)}</span>
            <span className="absolute left-1/2 -translate-x-1/2">{hourLabel(Math.round((ws + we) / 2))}</span>
            <span className="absolute right-0">{hourLabel(we)}</span>
          </div>
          <div className="flex flex-col gap-4">
            {groups.map(([room, rs]) => (
              <div key={room}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{room}</span>
                  <span className="text-[11px] text-[var(--ink-3)]">{rs.filter(checkedIn).length} of {rs.length} in · {pctIn(rs)}%</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {rs.slice().sort((a, b) => Number(checkedIn(b)) - Number(checkedIn(a)) || a.name.localeCompare(b.name)).map((r) => {
                    const isIn = checkedIn(r);
                    const inM = isIn ? toMin(r.clockInAt)! : 0;
                    const outM = r.clockOutAt ? toMin(r.clockOutAt)! : nowMin;
                    const live = isIn && !r.clockOutAt && r.status !== "out";
                    const left = pctOf(inM); const width = Math.max(1.5, pctOf(Math.max(inM, outM)) - left);
                    return (
                      <div key={r.id} className="grid grid-cols-[176px_1fr] items-center gap-2 sm:grid-cols-[176px_1fr_120px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={"grid h-5 w-5 flex-none place-items-center rounded-full text-[8.5px] font-extrabold " + (isIn ? "bg-[#eef4fd] text-[#1d3a8f]" : "bg-[#eef1f6] text-[#94a3b8]")}>{initials(r.name)}</span>
                          <span className={"truncate text-[12px] font-bold " + (isIn ? "text-[var(--ink)]" : "text-[var(--ink-3)]")}>{r.name}</span>
                          {r.role && <span className="hidden truncate text-[10.5px] text-[var(--ink-3)] md:inline">· {r.role}</span>}
                        </div>
                        <div className="relative h-2.5 rounded-full bg-[#eef1f6]">
                          {isIn && <div className="absolute top-0 h-2.5 rounded-full" style={{ left: left + "%", width: width + "%", background: r.status === "break" ? AMBER : live ? `linear-gradient(90deg,${GREEN},#5ad19a)` : GREEN }} />}
                        </div>
                        <div className="text-right text-[10.5px] leading-tight">
                          {isIn ? (
                            <>
                              <div className="font-extrabold tabular-nums text-[var(--ink-2)]">{hhmm(r.clockInAt)}–{r.clockOutAt ? hhmm(r.clockOutAt) : "now"}</div>
                              <div className="text-[var(--ink-3)]">{fmtDur(workedMs(r))}{r.status === "break" ? " · on break" : r.lateMin ? " · late" : ""}</div>
                            </>
                          ) : <div className="font-bold text-[var(--ink-3)]">Off / not in</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">Green = time on site, amber = a break. The % is how many rostered staff are checked in. Live from staff clock-ins.</p>
        </div>
      )}
    </div>
  );
}
