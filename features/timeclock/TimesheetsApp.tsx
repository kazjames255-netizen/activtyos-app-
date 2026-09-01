"use client";

// Operator "Clock in/out & timesheets": a live Who's-in board (in / on break /
// out / off), today's timesheet (actual clocked hours vs scheduled, lateness,
// optional auto-deduction), and settings. Actual hours feed the pay run. Demo
// store; real payroll posting + kiosk/geofence are Amir's (docs/timeclock-handoff.md).
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type ClockRecord, type ClockSettings, loadClock, loadClockSettings, saveClockSettings,
  offToday, workedMs, roundHours, fmtDur, hhmm, sinceLabel, scheduledHoursToday, rateFor, setApproved, editRecord, payHours, clockOut,
} from "./data";

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
type Tab = "in" | "sheets" | "settings";

export function TimesheetsApp() {
  const [tab, setTab] = useState<Tab>("in");
  const [all, setAll] = useState<Record<string, ClockRecord>>({});
  const [settings, setSettings] = useState<ClockSettings>(loadClockSettings);
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("all");
  const [edit, setEdit] = useState<ClockRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "in" | "break" | "needs" | "out">("all");
  const [nudges, setNudges] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setAll(loadClock()); setSettings(loadClockSettings()); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const saveSettings = (s: ClockSettings) => { setSettings(s); saveClockSettings(s); };

  const locations = useMemo(() => [...new Set(Object.values(all).map((r) => r.op).filter(Boolean) as string[])].sort(), [all]);
  const people = useMemo(() => Object.values(all).filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (locFilter === "all" || r.op === locFilter)), [all, q, locFilter]);
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
    const overtime = schedH ? Math.max(0, Math.round((workedH - schedH) * 100) / 100) : 0;
    const override = !!r.payBasis;
    let payH: number;
    if (override) payH = payHours(r, settings.rounding, lateOver / 60);
    else if (settings.payPolicy === "scheduled") payH = schedH || workedH;
    else if (settings.payPolicy === "scheduled-less-late") payH = Math.max(0, (schedH || workedH) - lateOver / 60);
    else payH = settings.autoPayOvertime ? workedH : (schedH ? Math.min(workedH, schedH) : workedH); // "actual"
    const otPaid = !override && settings.payPolicy === "actual" && settings.autoPayOvertime && overtime > 0;
    const otUnpaid = !override && overtime > 0 && !otPaid;
    return { workedH, schedH, late, lateOver, rate, overtime, otPaid, otUnpaid, payH, override };
  };
  const tsPeople = people.filter((r) => r.clockInAt); // anyone who clocked in today

  const clockOutPerson = (r: ClockRecord) => { setAll(clockOut(all, r.id, r.name)); flash(`${r.name.split(" ")[0]} clocked out.`); };
  // A reminder ping (same idea as Reconciliation's 🔔 nudge). Demo: flashes + counts.
  // Relevant to their state: clock IN if they haven't, clock OUT if they're on
  // the clock. (Mirrors the Schedule's "Remind to check in".)
  const nudge = (r: ClockRecord) => {
    const what = r.status === "in" || r.status === "break" ? "clock out when they finish" : "clock in";
    setNudges((n) => ({ ...n, [r.id]: (n[r.id] || 0) + 1 }));
    flash(`🔔 Reminder sent to ${r.name.split(" ")[0]} — a nudge to ${what}.`);
  };
  // BrightHR-style person card
  const personCard = (r: ClockRecord) => {
    // Status colour, not action colour: clocked in = green, on break = amber,
    // out = grey. (Pink used to read as "clocked in", which is the clock-IN
    // colour on the staff page — the opposite of what it meant here.)
    const footTone = r.status === "in" ? { bg: "#e6f4ea", fg: "#0f7a43" } : r.status === "break" ? { bg: "#fdf3e0", fg: "#8a5a09" } : { bg: "var(--panel)", fg: "var(--ink-3)" };
    const foot = r.status === "in" ? `${hhmm(r.clockInAt)} — Clocked in${r.lateMin ? ` · ${r.lateMin}m late` : ""}${r.loc ? ` · ${r.loc.startsWith("📍") ? "Location" : r.loc}` : ""}`
      : r.status === "break" ? `On break since ${hhmm(r.breakStart)}`
      : r.clockInAt ? `Worked ${fmtDur(workedMs(r))} today` : "Not clocked in today";
    return (
      <div key={r.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-start gap-2.5 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef4fd] text-[12px] font-extrabold text-[#1d3a8f]">{initials(r.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-extrabold text-[#1d3a8f]">{r.name}</div>
            <div className="truncate text-[11.5px] text-[var(--ink-3)]">{r.role}{r.op ? ` · ${r.op}` : ""}</div>
            {(() => {
              const onClock = r.status === "in" || r.status === "break";
              const notIn = r.status === "out" && !r.clockInAt; // scheduled but never clocked in
              // Someone who clocked in AND out already is done — no reminder to send.
              if (!onClock && !notIn) return null;
              const nudgeLabel = onClock ? "Remind to clock out" : "Remind to clock in";
              return (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {onClock && <button type="button" onClick={() => clockOutPerson(r)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f] hover:bg-[#eef4ff]">Clock out</button>}
                  <button type="button" onClick={() => nudge(r)} title={onClock ? "Remind them to clock out when they finish" : "Remind them to clock in"} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] transition-colors hover:border-[#f0b100] hover:bg-[#fdf6e3]">🔔 {nudges[r.id] ? `Remind again` : nudgeLabel}{nudges[r.id] ? <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#e88f1f] px-1 text-[9px] font-extrabold text-white">{nudges[r.id]}</span> : null}</button>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold" style={{ background: footTone.bg, color: footTone.fg }}><span>⏱</span>{foot}</div>
      </div>
    );
  };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Clock in/out & timesheets" icon="⏱" lede="See who's in, on a break, or off right now, review today's clocked hours against the rota, and send approved hours to payroll." />

      {/* Status hero — the staff Clock in/out page's signature: a big live figure,
          status pills, a rounded running-total panel and an avatar cluster. */}
      {(() => {
        const onSite = inNow.length + onBreak.length;
        const totalMs = tsPeople.reduce((s, r) => s + workedMs(r), 0);
        return (
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_2px_12px_-8px_rgba(29,58,143,.35)]">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              {/* big live figure */}
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[#e6f4ea] text-[24px]">🟢</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#12b76a] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#12b76a]" /></span>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">On site now · live</span>
                  </div>
                  <div className="text-[40px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{onSite}<span className="ml-1 text-[16px] font-bold text-[var(--ink-3)]">on shift</span></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11.5px] font-bold text-[#0f7a43]">🟢 {inNow.length} clocked in</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[11.5px] font-bold text-[#8a5a09]">⏸ {onBreak.length} on break</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f6] px-2.5 py-1 text-[11.5px] font-bold text-[#64748b]">{out.length} clocked out</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f3ecfb] px-2.5 py-1 text-[11.5px] font-bold text-[#6d28d9]">🏖 {off.length} off</span>
                  </div>
                </div>
              </div>
              {/* running-total panel — mirrors the staff clock card */}
              <div className="ml-auto flex items-center gap-5 rounded-2xl bg-[var(--panel)] px-5 py-4">
                <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Hours clocked today</div><div className="text-[26px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{fmtDur(totalMs)}</div></div>
                {tsPeople.length > 0 && <div className="hidden sm:block"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">People</div><div className="text-[15px] font-extrabold text-[var(--ink-2)]">{tsPeople.length} today</div></div>}
              </div>
              {/* avatar cluster of who's on site */}
              {onSite > 0 && (
                <div className="flex items-center pl-2">
                  {[...inNow, ...onBreak].slice(0, 6).map((r) => (
                    <span key={r.id} className="-ml-2 grid h-9 w-9 flex-none place-items-center rounded-full text-[11px] font-extrabold text-[#1d3a8f] ring-2 ring-white" style={{ background: r.status === "break" ? "#fdf3e0" : "#eef4fd" }} title={`${r.name} · ${r.status === "break" ? "on break" : "clocked in"}`}>{initials(r.name)}</span>
                  ))}
                  {onSite > 6 && <span className="-ml-2 grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold text-[var(--ink-3)] ring-2 ring-white">+{onSite - 6}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {([["in", "🟢 Who's in"], ["sheets", "🧾 Timesheets"], ["settings", "⚙️ Settings"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${tab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
        ))}
      </div>

      {tab === "in" && (() => {
        const outVisible = out.filter((r) => !offNames.has(r.name.trim().toLowerCase()));
        // "Needs attention" = anyone to chase: scheduled but not clocked in (needs
        // to clock IN), or clocked in late. They're the ones a nudge is for.
        const needsIn = outVisible.filter((r) => !r.clockInAt);
        const lateIn = [...inNow, ...onBreak].filter((r) => (r.lateMin || 0) > 0);
        const needsAction = [...needsIn, ...lateIn];
        const F = statusFilter;
        const pills: [typeof statusFilter, string, number, string][] = [
          ["all", "All", inNow.length + onBreak.length + outVisible.length, "#1d3a8f"],
          ["in", "🟢 Clocked in", inNow.length, "#0f7a43"],
          ["break", "⏸ On break", onBreak.length, "#f59e0b"],
          ["needs", "⚠ Needs attention", needsAction.length, "#c0392b"],
          ["out", "⚪ Clocked out", outVisible.length, "#64748b"],
        ];
        const section = (label: string, color: string, list: ClockRecord[], empty: string) => (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2"><span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color }}>{label}</span><span className="grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10.5px] font-extrabold text-white" style={{ background: color }}>{list.length}</span></div>
            {list.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">{empty}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((r) => personCard(r))}</div>}
          </div>
        );
        return (
          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2"><div className="text-[13px] font-extrabold text-[var(--ink)]">Who&rsquo;s in — live</div><Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="ml-auto"><option value="all">All listings</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by employee…" className="w-52 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12px] outline-none focus:border-[#1d3a8f]" /></div>
            {/* status filter pills */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pills.map(([k, l, n, c]) => { const on = F === k; return (
                <button key={k} type="button" onClick={() => setStatusFilter(k)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors" style={on ? { borderColor: c, background: c + "14", color: c } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                  {l}<span className="grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-extrabold text-white" style={{ background: on ? c : "#cbd5e1" }}>{n}</span>
                </button>
              ); })}
            </div>
            {(F === "all" || F === "in") && section("🟢 Clocked in", "#0f7a43", inNow, "No one clocked in.")}
            {(F === "all" || F === "break") && section("⏸ On break", "#f59e0b", onBreak, "Nobody on a break.")}
            {F === "needs" && section("⚠ Needs to clock in or out", "#c0392b", needsAction, "Everyone's where they should be — nothing to chase. 👍")}
            {F === "all" && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2"><span className="text-[12px] font-extrabold uppercase tracking-wide text-[#8b5cf6]">🏖 Off today</span><span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#8b5cf6] px-1.5 text-[10.5px] font-extrabold text-white">{off.length}</span></div>
                {off.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">Nobody booked off.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{off.map((o) => (
                  <div key={o.name} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-white p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f3ecfb] text-[16px]">🏖</span><div className="min-w-0"><div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{o.name}</div><div className="text-[11.5px] text-[#8b5cf6]">On leave · {o.kind}</div></div></div>
                ))}</div>}
              </div>
            )}
            {(F === "all" || F === "out") && section("Clocked out", "#94a3b8", outVisible, "Everyone's clocked out or off.")}
          </Card>
        );
      })()}

      {tab === "sheets" && (
        <Card className="mt-4 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">Timesheets · today</span><Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="ml-auto"><option value="all">All listings</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div className="mb-2 text-[12px] text-[var(--ink-3)]">Today&rsquo;s clocked hours. Pay policy: <b>{settings.payPolicy === "scheduled" ? "scheduled hours" : settings.payPolicy === "scheduled-less-late" ? "scheduled, less lateness" : settings.autoPayOvertime ? "actual worked (overtime paid)" : "actual, capped at scheduled"}</b> · grace {settings.graceMin} min{settings.rounding ? ` · rounded to ${settings.rounding} min` : ""}. Overtime marked <b>*</b> is above scheduled and unpaid until approved. Approved hours flow to the pay run.</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-center font-extrabold">In</th><th className="px-3 py-2.5 text-center font-extrabold">Out</th><th className="px-3 py-2.5 text-center font-extrabold">Break</th><th className="px-3 py-2.5 text-right font-extrabold">Worked</th><th className="px-3 py-2.5 text-right font-extrabold">Sched.</th><th className="px-3 py-2.5 text-center font-extrabold">Late</th><th className="px-3 py-2.5 text-right font-extrabold">Overtime</th><th className="px-3 py-2.5 text-right font-extrabold">Pay hrs</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{tsPeople.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-[13px] text-[var(--ink-3)]">No clock-ins today yet.</td></tr> : tsPeople.map((r) => { const s = sheet(r); return (
                <tr key={r.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2 font-bold text-[var(--ink)]">{r.name}{r.approved && <span className="ml-1.5 rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#0f7a43]">approved</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{hhmm(r.clockInAt)}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-2)]">{r.clockOutAt ? hhmm(r.clockOutAt) : r.status === "out" ? "—" : <span className="text-[#0f7a43]">in…</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-3)]">{r.breakMs ? fmtDur(r.breakMs) : "—"}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[var(--ink)]">{s.workedH.toFixed(2)}h</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-3)]">{s.schedH ? s.schedH.toFixed(2) + "h" : "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{s.late ? <span className={s.lateOver > 0 ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}>{s.late}m</span> : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.overtime > 0 ? <span className={s.otPaid ? "font-bold text-[#0f7a43]" : "font-bold text-[#8a5a09]"}>+{s.overtime.toFixed(2)}h{s.otUnpaid ? " *" : ""}</span> : "—"}</td>
                  <td className="px-3 py-2 text-right font-extrabold tabular-nums text-[#0f7a43]">{s.payH.toFixed(2)}h{s.override && <span className="ml-1 rounded bg-[#eef4fd] px-1 py-0.5 text-[9px] font-bold text-[#1d3a8f] align-middle">{r.payBasis === "scheduled" ? "sched" : r.payBasis === "custom" ? "set" : "edit"}</span>}</td>
                  <td className="px-3 py-2 text-right"><div className="inline-flex gap-1.5"><button type="button" onClick={() => setEdit(r)} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">✏️</button><button type="button" onClick={() => { setAll(setApproved(all, r.id, !r.approved)); flash(r.approved ? "Approval removed." : `${r.name.split(" ")[0]}'s hours approved.`); }} className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${r.approved ? "border-[#0f7a43] text-[#0f7a43]" : "border-[var(--line)] text-[#1d3a8f] hover:border-[#1d3a8f]"}`}>{r.approved ? "✓ Approved" : "Approve"}</button></div></td>
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
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Default pay policy (everyone)</span>
              <Select value={settings.payPolicy} onChange={(e) => saveSettings({ ...settings, payPolicy: e.target.value as ClockSettings["payPolicy"] })} className="w-full">
                <option value="actual">Actual worked hours (from the clock)</option>
                <option value="scheduled">Scheduled (normal) hours — ignore the clock</option>
                <option value="scheduled-less-late">Scheduled hours, less any lateness</option>
              </Select>
              <span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">{settings.payPolicy === "actual" ? "Pay exactly what they clocked. Overtime (over scheduled) is only auto-paid if the toggle below is on — otherwise it's flagged for approval." : settings.payPolicy === "scheduled" ? "Pay their scheduled hours flat — clock times don't change pay (they're just a record + who's-in board)." : "Pay scheduled hours minus late minutes. Arriving early adds nothing; leaving early / arriving late docks pay."}</span>
            </label>
            {settings.payPolicy === "actual" && <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--panel)] px-3 py-2.5"><input type="checkbox" checked={settings.autoPayOvertime} onChange={(e) => saveSettings({ ...settings, autoPayOvertime: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] text-[var(--ink)]"><b>Auto-pay overtime</b><br /><span className="text-[11.5px] text-[var(--ink-3)]">On: hours worked beyond the scheduled shift are paid automatically. Off: pay is capped at scheduled and the extra shows as overtime to approve per person.</span></span></label>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Grace period (min)</span><Select value={String(settings.graceMin)} onChange={(e) => saveSettings({ ...settings, graceMin: Number(e.target.value) })} className="w-full">{[0, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} min</option>)}</Select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Round hours to</span><Select value={String(settings.rounding)} onChange={(e) => saveSettings({ ...settings, rounding: Number(e.target.value) as ClockSettings["rounding"] })} className="w-full"><option value="0">Exact</option><option value="5">Nearest 5 min</option><option value="15">Nearest 15 min</option></Select></label>
            </div>
            <label className="mt-3 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">&ldquo;Lead&rdquo; role name</span><Input value={settings.leadLabel} onChange={(e) => saveSettings({ ...settings, leadLabel: e.target.value || "Lead" })} className="w-full" /><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Staff with this role see everyone working at their own listing (in their Clock in/out screen). Rename it to whatever you call your site leads (e.g. &ldquo;Site manager&rdquo;).</span></label>
            <div className="mt-3 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">Approved hours feed the Payroll pay run automatically (Rostered-hours mode reads the clocked in/out).</div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">How it works</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <li>• Staff <b>clock in/out</b> and take breaks from their app; you see it live under <b>Who&rsquo;s in</b> and on the <b>Dashboard</b>.</li>
              <li>• Each clock stamps that person&rsquo;s <b>rota shift</b>, so the Schedule&rsquo;s check-in state and Payroll&rsquo;s actual hours update automatically.</li>
              <li>• <b>Pay policy</b> sets how the clock affects pay for everyone — pay actual hours, pay scheduled flat, or pay scheduled less lateness. <b>Overtime</b> (over scheduled) is shown and only auto-paid if you turn it on.</li>
              <li>• Override any one person on their timesheet row (✏️) — actual / scheduled / a set number of hours.</li>
              <li className="text-[var(--ink-3)]">Demo matches people by name. A shared-device <b>kiosk</b> (PIN) and <b>geofence</b> verification are the backend build.</li>
            </ul>
          </Card>
        </div>
      )}

      {edit && <TimesheetEditor rec={edit} onSave={(patch) => { setAll(editRecord(all, edit.id, patch)); setEdit(null); flash("Timesheet updated."); }} onClose={() => setEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// yyyy-mm-dd for building ISO from a HH:MM time input on the record's day
const toISO = (day: string, hm: string) => (hm ? new Date(`${day}T${hm}:00`).toISOString() : undefined);
function TimesheetEditor({ rec, onSave, onClose }: { rec: ClockRecord; onSave: (patch: Partial<ClockRecord>) => void; onClose: () => void }) {
  const day = rec.day;
  const [inHm, setInHm] = useState(rec.clockInAt ? hhmm(rec.clockInAt) : "");
  const [outHm, setOutHm] = useState(rec.clockOutAt ? hhmm(rec.clockOutAt) : "");
  const [breakMin, setBreakMin] = useState(Math.round((rec.breakMs || 0) / 60000));
  const [basis, setBasis] = useState<"actual" | "scheduled" | "scheduled-less-late" | "custom">(rec.payBasis || "actual");
  const [custom, setCustom] = useState(rec.payHoursOverride != null ? String(rec.payHoursOverride) : "");
  const [note, setNote] = useState(rec.editNote || "");
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{rec.name}</h3><span className="text-[12px] text-[var(--ink-3)]">· edit timesheet</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Clock in</span><Input type="time" value={inHm} onChange={(e) => setInHm(e.target.value)} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Clock out</span><Input type="time" value={outHm} onChange={(e) => setOutHm(e.target.value)} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Break (min)</span><Input inputMode="numeric" value={String(breakMin)} onChange={(e) => setBreakMin(parseInt(e.target.value) || 0)} className="w-full" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Pay this shift as</span><Select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className="w-full"><option value="actual">Actual worked hours</option><option value="scheduled">Scheduled (normal) hours</option><option value="scheduled-less-late">Scheduled hours, less any lateness</option><option value="custom">A set number of hours</option></Select></label>
          {basis === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Hours to pay</span><Input inputMode="decimal" value={custom} placeholder="e.g. 7.5" onChange={(e) => setCustom(e.target.value)} className="w-full" /></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Reason / note</span><Input value={note} placeholder="why the times/pay were changed" onChange={(e) => setNote(e.target.value)} className="w-full" /></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">{basis === "actual" ? "Paid on the clocked in/out (minus break)." : basis === "scheduled" ? "Paid their scheduled hours regardless of when they clocked in." : basis === "scheduled-less-late" ? "Paid scheduled hours minus any lateness (early arrival adds nothing)." : `Paid ${custom || "—"} hours flat.`}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave({ clockInAt: toISO(day, inHm), clockOutAt: toISO(day, outHm), breakMs: Math.max(0, breakMin) * 60000, payBasis: basis, payHoursOverride: basis === "custom" ? (parseFloat(custom) || 0) : undefined, editNote: note || undefined })}>Save</Button></div>
      </div>
    </div>
  );
}

export default TimesheetsApp;
