"use client";

// Operator "Clock in/out & timesheets": a live Who's-in board (in / on break /
// out / off), today's timesheet (actual clocked hours vs scheduled, lateness,
// optional auto-deduction), and settings. Actual hours feed the pay run. Demo
// store; real payroll posting + kiosk/geofence are Amir's (docs/timeclock-handoff.md).
import { useEffect, useMemo, useState } from "react";
import { Card, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type ClockRecord, type ClockSettings, loadClock, loadClockSettings, saveClockSettings,
  offToday, workedMs, roundHours, fmtDur, hhmm, sinceLabel, scheduledHoursToday, rateFor, setApproved,
} from "./data";

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
type Tab = "in" | "sheets" | "settings";

export function TimesheetsApp() {
  const [tab, setTab] = useState<Tab>("in");
  const [all, setAll] = useState<Record<string, ClockRecord>>({});
  const [settings, setSettings] = useState<ClockSettings>(loadClockSettings);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setAll(loadClock()); setSettings(loadClockSettings()); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const saveSettings = (s: ClockSettings) => { setSettings(s); saveClockSettings(s); };

  const people = useMemo(() => Object.values(all).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())), [all, q]);
  const inNow = people.filter((r) => r.status === "in");
  const onBreak = people.filter((r) => r.status === "break");
  const out = people.filter((r) => r.status === "out");
  const off = useMemo(() => offToday(), [tab]);
  const offNames = new Set(off.map((o) => o.name.trim().toLowerCase()));

  // one person's timesheet numbers for today
  const sheet = (r: ClockRecord) => {
    const workedH = roundHours(workedMs(r) / 3600000, settings.rounding);
    const schedH = scheduledHoursToday(r.name);
    const late = r.lateMin || 0;
    const lateOver = Math.max(0, late - settings.graceMin);
    const rate = rateFor(r.name);
    const deduction = settings.autoDeductLate && lateOver > 0 ? (lateOver / 60) * rate : 0;
    const payH = settings.autoDeductLate ? workedH : (schedH || workedH);
    return { workedH, schedH, late, lateOver, rate, deduction, payH };
  };
  const tsPeople = people.filter((r) => r.clockInAt); // anyone who clocked in today

  const groupRow = (r: ClockRecord, tone: string) => (
    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold text-[var(--ink-2)]">{initials(r.name)}</span>
      <div className="min-w-0"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{r.name}</div><div className="text-[11px] text-[var(--ink-3)]">{r.role}{r.op ? ` · ${r.op}` : ""}</div></div>
      <span className="ml-auto text-right text-[11.5px]" style={{ color: tone }}>
        {r.status === "in" && <>in · {sinceLabel(r.clockInAt)}{r.lateMin ? <span className="ml-1 text-[#c0392b]">(late {r.lateMin}m)</span> : ""}</>}
        {r.status === "break" && <>on break · {sinceLabel(r.breakStart)}</>}
        {r.status === "out" && (r.clockInAt ? <span className="text-[var(--ink-3)]">worked {fmtDur(workedMs(r))}</span> : <span className="text-[var(--ink-3)]">not in today</span>)}
      </span>
    </div>
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Clock in/out & timesheets" icon="⏱" lede="See who's in, on a break, or off right now, review today's clocked hours against the rota, and send approved hours to payroll." />

      {/* live tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Clocked in", inNow.length, "#12b76a"], ["On break", onBreak.length, "#f59e0b"], ["Clocked out", out.length, "#94a3b8"], ["Off today", off.length, "#8b5cf6"]].map(([label, n, c]) => (
          <div key={label as string} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c as string }} /><span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</span></div>
            <div className="mt-1 text-[24px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{n as number}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {([["in", "🟢 Who's in"], ["sheets", "🧾 Timesheets"], ["settings", "⚙️ Settings"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${tab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
        ))}
      </div>

      {tab === "in" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-0"><div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f7a43]">🟢 Clocked in ({inNow.length})</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="ml-auto w-32 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" /></div>{inNow.length === 0 ? <div className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No one clocked in.</div> : <div className="divide-y divide-[var(--line)]">{inNow.map((r) => groupRow(r, "#0f7a43"))}</div>}</Card>
          <div className="grid gap-4">
            <Card className="p-0"><div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#8a5a09]">⏸ On break ({onBreak.length})</div>{onBreak.length === 0 ? <div className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">Nobody on a break.</div> : <div className="divide-y divide-[var(--line)]">{onBreak.map((r) => groupRow(r, "#8a5a09"))}</div>}</Card>
            <Card className="p-0"><div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#8b5cf6]">🏖 Off today ({off.length})</div>{off.length === 0 ? <div className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">Nobody booked off.</div> : <div className="divide-y divide-[var(--line)]">{off.map((o) => <div key={o.name} className="flex items-center gap-2 px-4 py-2.5 text-[12.5px]"><span>🏖</span><span className="font-bold text-[var(--ink)]">{o.name}</span><span className="ml-auto text-[var(--ink-3)]">{o.kind}</span></div>)}</div>}</Card>
            <Card className="p-0"><div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Clocked out ({out.filter((r) => !offNames.has(r.name.trim().toLowerCase())).length})</div><div className="divide-y divide-[var(--line)]">{out.filter((r) => !offNames.has(r.name.trim().toLowerCase())).map((r) => groupRow(r, "#94a3b8"))}</div></Card>
          </div>
        </div>
      )}

      {tab === "sheets" && (
        <Card className="mt-4 p-4">
          <div className="mb-2 text-[12px] text-[var(--ink-3)]">Today&rsquo;s clocked hours. {settings.autoDeductLate ? <b>Late auto-deduct is ON</b> : "Late auto-deduct is off"} · grace {settings.graceMin} min{settings.rounding ? ` · rounded to ${settings.rounding} min` : ""}. Approved hours flow to the pay run.</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-center font-extrabold">In</th><th className="px-3 py-2.5 text-center font-extrabold">Out</th><th className="px-3 py-2.5 text-center font-extrabold">Break</th><th className="px-3 py-2.5 text-right font-extrabold">Worked</th><th className="px-3 py-2.5 text-right font-extrabold">Sched.</th><th className="px-3 py-2.5 text-center font-extrabold">Late</th><th className="px-3 py-2.5 text-right font-extrabold">Deduct</th><th className="px-3 py-2.5 text-right font-extrabold">Pay hrs</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{tsPeople.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-[13px] text-[var(--ink-3)]">No clock-ins today yet.</td></tr> : tsPeople.map((r) => { const s = sheet(r); return (
                <tr key={r.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2 font-bold text-[var(--ink)]">{r.name}{r.approved && <span className="ml-1.5 rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#0f7a43]">approved</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{hhmm(r.clockInAt)}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-2)]">{r.clockOutAt ? hhmm(r.clockOutAt) : r.status === "out" ? "—" : <span className="text-[#0f7a43]">in…</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-3)]">{r.breakMs ? fmtDur(r.breakMs) : "—"}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[var(--ink)]">{s.workedH.toFixed(2)}h</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-3)]">{s.schedH ? s.schedH.toFixed(2) + "h" : "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{s.late ? <span className={s.lateOver > 0 ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}>{s.late}m</span> : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{s.deduction > 0 ? "−" + gbp(s.deduction) : "—"}</td>
                  <td className="px-3 py-2 text-right font-extrabold tabular-nums text-[#0f7a43]">{s.payH.toFixed(2)}h</td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => { setAll(setApproved(all, r.id, !r.approved)); flash(r.approved ? "Approval removed." : `${r.name.split(" ")[0]}'s hours approved.`); }} className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${r.approved ? "border-[#0f7a43] text-[#0f7a43]" : "border-[var(--line)] text-[#1d3a8f] hover:border-[#1d3a8f]"}`}>{r.approved ? "✓ Approved" : "Approve"}</button></td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">Clocking writes each person&rsquo;s actual in/out onto their rota shift, so the <b>Payroll</b> pay run (Rostered-hours mode) already reads these hours. Real SSP-style calc + payroll posting are the backend piece.</p>
        </Card>
      )}

      {tab === "settings" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">Clock &amp; timesheet rules</div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--panel)] px-3 py-2.5"><input type="checkbox" checked={settings.autoDeductLate} onChange={(e) => saveSettings({ ...settings, autoDeductLate: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] text-[var(--ink)]"><b>Auto-deduct wages for late clock-in</b><br /><span className="text-[11.5px] text-[var(--ink-3)]">When on, a late arrival (beyond the grace period) reduces paid hours by the lateness. When off, they&rsquo;re paid their scheduled hours regardless.</span></span></label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Grace period (min)</span><Select value={String(settings.graceMin)} onChange={(e) => saveSettings({ ...settings, graceMin: Number(e.target.value) })} className="w-full">{[0, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} min</option>)}</Select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Round hours to</span><Select value={String(settings.rounding)} onChange={(e) => saveSettings({ ...settings, rounding: Number(e.target.value) as ClockSettings["rounding"] })} className="w-full"><option value="0">Exact</option><option value="5">Nearest 5 min</option><option value="15">Nearest 15 min</option></Select></label>
            </div>
            <div className="mt-3 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">Approved hours feed the Payroll pay run automatically (Rostered-hours mode reads the clocked in/out).</div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">How it works</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <li>• Staff <b>clock in/out</b> and take breaks from their app; you see it live under <b>Who&rsquo;s in</b> and on the <b>Dashboard</b>.</li>
              <li>• Each clock stamps that person&rsquo;s <b>rota shift</b>, so the Schedule&rsquo;s check-in state and Payroll&rsquo;s actual hours update automatically.</li>
              <li>• <b>Late auto-deduct</b> is optional — some teams dock late minutes, others don&rsquo;t. Toggle it above.</li>
              <li className="text-[var(--ink-3)]">Demo matches people by name. A shared-device <b>kiosk</b> (PIN) and <b>geofence</b> verification are the backend build.</li>
            </ul>
          </Card>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

export default TimesheetsApp;
