"use client";

// Staff-facing clock in/out. Big clock button, breaks, a live running total, and
// a mini "who's in now". Optional location capture on clock-in. Demo "me" =
// Marcus Bell (matches the other staff self-service areas).
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type ClockRecord, loadClock, slug, clockIn, clockOut, startBreak, endBreak,
  workedMs, fmtDur, hhmm, sinceLabel, shiftToday,
} from "./data";

const ME = "Marcus Bell";
const ME_ID = slug(ME);

export function TimeClockApp() {
  const [all, setAll] = useState<Record<string, ClockRecord>>({});
  const [tick, setTick] = useState(0);
  const [loc, setLoc] = useState<string | undefined>();
  useEffect(() => { setAll(loadClock()); }, []);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  void tick;

  const me = all[ME_ID] || { id: ME_ID, name: ME, status: "out" as const, breakMs: 0, events: [], day: "" };
  const status = me.status;
  const worked = workedMs(me);
  const sh = shiftToday(ME);

  const captureLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc(`📍 ${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`),
      () => setLoc(undefined), { timeout: 4000 }
    );
  };
  const doIn = () => { captureLocation(); setAll(clockIn(all, ME_ID, ME, loc)); };
  const doOut = () => setAll(clockOut(all, ME_ID, ME));
  const doBreakStart = () => setAll(startBreak(all, ME_ID));
  const doBreakEnd = () => setAll(endBreak(all, ME_ID));

  const others = useMemo(() => Object.values(all).filter((r) => r.id !== ME_ID), [all]);
  const inNow = others.filter((r) => r.status === "in").length;
  const onBreak = others.filter((r) => r.status === "break").length;

  const statusMeta = status === "in" ? { label: "Clocked in", tone: "#0f7a43", bg: "#e6f4ea", dot: "#12b76a" }
    : status === "break" ? { label: "On break", tone: "#8a5a09", bg: "#fdf3e0", dot: "#f59e0b" }
    : { label: "Clocked out", tone: "#64748b", bg: "#eef1f6", dot: "#94a3b8" };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Clock in / out" icon="⏱" lede="Clock in when you start, take breaks, and clock out when you finish. Your hours feed your timesheet and pay." />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* clock card */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef4fd] text-[16px] font-extrabold text-[#1d3a8f]">{ME.split(" ").map((w) => w[0]).join("")}</span>
            <div>
              <div className="text-[15px] font-extrabold text-[var(--ink)]">{ME}</div>
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: statusMeta.bg, color: statusMeta.tone }}><span className="h-2 w-2 rounded-full" style={{ background: statusMeta.dot }} />{statusMeta.label}{status !== "out" && me.clockInAt ? ` · since ${hhmm(me.clockInAt)}` : ""}</span>
            </div>
          </div>

          {/* running total */}
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[var(--panel)] p-4">
            <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Worked today</div><div className="text-[26px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{fmtDur(worked)}</div></div>
            {me.breakMs > 0 && <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Break</div><div className="text-[15px] font-extrabold tabular-nums text-[#8a5a09]">{fmtDur(me.breakMs)}</div></div>}
            {sh && <div className="ml-auto text-right"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Scheduled</div><div className="text-[13px] font-bold text-[var(--ink-2)]">{sh.start}–{sh.end}</div></div>}
          </div>
          {me.lateMin ? <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-1.5 text-[11.5px] font-semibold text-[#8a5a09]">Clocked in {me.lateMin} min after your {sh?.start} start.</div> : null}

          {/* actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {status === "out" && <button type="button" onClick={doIn} className="flex-1 rounded-full bg-[#e6007e] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(230,0,126,.7)] hover:brightness-105">⏱ Clock in</button>}
            {status === "in" && <>
              <button type="button" onClick={doOut} className="flex-1 rounded-full bg-[#1d3a8f] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-110">Clock out</button>
              <Button onClick={doBreakStart}>Start break</Button>
            </>}
            {status === "break" && <>
              <button type="button" onClick={doBreakEnd} className="flex-1 rounded-full bg-[#f59e0b] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-105">End break</button>
              <Button onClick={doOut}>Clock out</Button>
            </>}
          </div>
          {loc && status !== "out" && <div className="mt-2 text-[11px] text-[var(--ink-3)]">{loc}</div>}
        </Card>

        {/* today's log + who's in */}
        <div className="grid gap-4">
          <Card className="p-4">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Today</div>
            {me.events.length === 0 ? <div className="py-3 text-[12.5px] text-[var(--ink-3)]">No clock activity yet — hit <b>Clock in</b> to start.</div> : (
              <div className="divide-y divide-[var(--line)]">{me.events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                  <span>{e.kind === "in" ? "🟢" : e.kind === "out" ? "🔴" : e.kind === "break-start" ? "⏸" : "▶️"}</span>
                  <span className="font-semibold text-[var(--ink)]">{e.kind === "in" ? "Clocked in" : e.kind === "out" ? "Clocked out" : e.kind === "break-start" ? "Break started" : "Break ended"}</span>
                  <span className="ml-auto tabular-nums text-[var(--ink-3)]">{hhmm(e.t)}</span>
                </div>
              ))}</div>
            )}
          </Card>
          <Card className="p-4">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Who&rsquo;s in now</div>
            <div className="flex gap-4 text-[12.5px]"><span className="font-bold text-[#0f7a43]">🟢 {inNow} in</span><span className="font-bold text-[#8a5a09]">⏸ {onBreak} on break</span></div>
            <div className="mt-2 space-y-1">{others.filter((r) => r.status !== "out").slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: r.status === "break" ? "#f59e0b" : "#12b76a" }} /><span className="font-semibold text-[var(--ink)]">{r.name}</span>{r.op && <span className="text-[var(--ink-3)]">· {r.op}</span>}<span className="ml-auto text-[var(--ink-3)]">{r.status === "break" ? "on break" : sinceLabel(r.clockInAt)}</span></div>
            ))}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TimeClockApp;
