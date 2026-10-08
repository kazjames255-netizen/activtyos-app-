"use client";

// Operator "Clock in/out & timesheets": a live Who's-in board (in / on break /
// out / off), today's timesheet (actual clocked hours vs scheduled, lateness,
// optional auto-deduction), and settings. Actual hours feed the pay run. Demo
// store; real payroll posting + kiosk/geofence are Amir's (docs/timeclock-handoff.md).
import { dateLocale as dl, uiDateTime } from "@/lib/i18n/format";
import { useI18n, useT, useWord } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/components/i18n/Rich";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useTenantSettings } from "@/lib/settings";
import {
  type ClockRecord, type ClockSettings, loadReviewQueue, markReviewed, loadClock, loadClockSettings, saveClockSettings, syncClockSettings, useClockSettingsRefresh,
  offToday, workedMs, paidMs, roundHours, fmtDur, hhmm, sinceLabel, scheduledHoursToday, shiftToday, lateMinutesToday, rateFor, setApproved, editRecord, payHours, clockOut, useClockRefresh
} from "./data";

const gbp = (n: number) => "£" + (n || 0).toLocaleString(dl(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = (n: string) => n.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
type Tab = "in" | "sheets" | "settings";

export function TimesheetsApp() {
  const { t, locale } = useI18n();
  const w = useWord();
  // e.g. 12 → "12 min", 230 → "3h 50m" (late time shown before the "late" label)
  const fmtLate = (m: number) => (m >= 60 ? t("p8wf.durHm", { h: Math.floor(m / 60), m: m % 60 }) : t("p8wf.tsNMin", { n: m }));
  const hrs = (n: number) => t("p8wf.hrsUnit", { n: n.toFixed(2) });
  const [tab, setTab] = useState<Tab>("in");
  const [all, setAll] = useState<Record<string, ClockRecord>>({});
  useClockRefresh(setAll);
  const [settings, setSettings] = useState<ClockSettings>(loadClockSettings);
  useClockSettingsRefresh(setSettings);
  const { settings: tenantSettings } = useTenantSettings();
  const breakPaid = tenantSettings.scheduling?.breakPaid === "paid";
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("all");
  const [edit, setEdit] = useState<ClockRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "in" | "break" | "needs" | "out">("all");
  const [nudges, setNudges] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setAll(loadClock()); setSettings(loadClockSettings()); void syncClockSettings(); }, []);
  const [review, setReview] = useState<ClockRecord[]>([]);
  const refreshReview = () => { loadReviewQueue().then(setReview).catch(() => setReview([])); };
  useEffect(() => { refreshReview(); }, []);
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
    const workedH = roundHours(paidMs(r, breakPaid) / 3600000, settings.rounding);
    const schedH = scheduledHoursToday(r.name);
    const late = r.lateMin || 0;
    const lateOver = Math.max(0, late - settings.graceMin);
    const rate = rateFor(r.name);
    const overtime = schedH ? Math.max(0, Math.round((workedH - schedH) * 100) / 100) : 0;
    const override = !!r.payBasis;
    let payH: number;
    if (override) payH = payHours(r, settings.rounding, lateOver / 60, breakPaid);
    else if (settings.payPolicy === "scheduled") payH = schedH || workedH;
    else if (settings.payPolicy === "scheduled-less-late") payH = Math.max(0, (schedH || workedH) - lateOver / 60);
    else payH = settings.autoPayOvertime ? workedH : (schedH ? Math.min(workedH, schedH) : workedH); // "actual"
    const otPaid = !override && settings.payPolicy === "actual" && settings.autoPayOvertime && overtime > 0;
    const otUnpaid = !override && overtime > 0 && !otPaid;
    return { workedH, schedH, late, lateOver, rate, overtime, otPaid, otUnpaid, payH, override };
  };
  const tsPeople = people.filter((r) => r.clockInAt); // anyone who clocked in today

  const clockOutPerson = (r: ClockRecord) => { setAll(clockOut(all, r.id, r.name)); flash(t("p8wf.tsFlashOut", { name: r.name.split(" ")[0] })); };
  // A reminder ping (same idea as Reconciliation's 🔔 nudge). Demo: flashes + counts.
  // Relevant to their state: clock IN if they haven't, clock OUT if they're on
  // the clock. (Mirrors the Schedule's "Remind to check in".)
  const nudge = (r: ClockRecord) => {
    const outKey = r.status === "in" || r.status === "break";
    setNudges((n) => ({ ...n, [r.id]: (n[r.id] || 0) + 1 }));
    flash(t(outKey ? "p8wf.tsNudgeOut" : "p8wf.tsNudgeIn", { name: r.name.split(" ")[0] }));
  };
  // BrightHR-style person card
  const personCard = (r: ClockRecord) => {
    // Status colour, not action colour: clocked in = green, on break = amber,
    // out = grey. (Pink used to read as "clocked in", which is the clock-IN
    // colour on the staff page — the opposite of what it meant here.)
    const sh = shiftToday(r.name);        // their rostered shift today (start/end)
    const late = lateMinutesToday(r);     // late vs shift start, recomputed live
    const footTone = r.status === "in" ? { bg: "#e6f4ea", fg: "#0f7a43" } : r.status === "break" ? { bg: "#fdf3e0", fg: "#8a5a09" } : { bg: "var(--panel)", fg: "var(--ink-3)" };
    const foot = r.status === "in" ? `${sh ? `${t("p8wf.tsFootShift", { start: sh.start, end: sh.end })} · ` : ""}${t("p8wf.tsFootIn", { time: hhmm(r.clockInAt), dur: fmtDur(workedMs(r)) })}${late ? ` · ${t("p8wf.tsLateTxt", { late: fmtLate(late) })}` : sh ? ` · ${t("p8wf.tsOnTime")}` : ""}${r.loc ? ` · ${r.loc.startsWith("📍") ? t("p8wf.tsLocation") : r.loc}` : ""}`
      : r.status === "break" ? `${t("p8wf.tsFootBreak", { time: hhmm(r.breakStart) })}${sh ? ` · ${t("p8wf.tsShiftLc", { start: sh.start, end: sh.end })}` : ""}`
      : r.clockInAt ? `${t("p8wf.tsFootWorked", { dur: fmtDur(workedMs(r)) })}${sh ? ` · ${t("p8wf.tsShiftLc", { start: sh.start, end: sh.end })}` : ""}` : `${t("p8wf.tsFootNotIn")}${sh ? ` · ${t("p8wf.tsShiftFrom", { start: sh.start })}` : ""}`;
    return (
      <div key={r.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-start gap-2.5 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef4fd] text-[12px] font-extrabold text-[#1d3a8f]">{initials(r.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-extrabold text-[#1d3a8f]">{r.name}</div>
            <div className="truncate text-[11.5px] text-[var(--ink-3)]">{r.role}{r.op ? ` · ${r.op}` : ""}</div>
            {/* Lateness front-and-centre: how late + when their shift was due to start. */}
            {late > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fdecec] px-2 py-0.5 text-[10.5px] font-extrabold text-[#c0392b]">⏰ {t("p8wf.tsLateTxt", { late: fmtLate(late) })}{sh ? ` · ${t("p8wf.tsShiftStart", { start: sh.start })}` : ""}</div>
            )}
            {(() => {
              const onClock = r.status === "in" || r.status === "break";
              const notIn = r.status === "out" && !r.clockInAt; // scheduled but never clocked in
              // Someone who clocked in AND out already is done — no reminder to send.
              if (!onClock && !notIn) return null;
              const nudgeLabel = onClock ? t("p8wf.tsRemindOut") : t("p8wf.tsRemindIn");
              return (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {onClock && <button type="button" onClick={() => clockOutPerson(r)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f] hover:bg-[#eef4ff]">{t("p7tc.clockOutBtn")}</button>}
                  <button type="button" onClick={() => nudge(r)} title={onClock ? t("p8wf.tsRemindTipOut") : t("p8wf.tsRemindTipIn")} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] transition-colors hover:border-[#f0b100] hover:bg-[#fdf6e3]">🔔 {nudges[r.id] ? t("p8wf.tsRemindAgain") : nudgeLabel}{nudges[r.id] ? <span className="ms-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#e88f1f] px-1 text-[9px] font-extrabold text-white">{nudges[r.id]}</span> : null}</button>
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
      <PageHero title={t("p8wf.tsTitle")} icon="⏱" lede={t("p8wf.tsLede")} />

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
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("p8wf.tsOnSiteLive")}</span>
                  </div>
                  <div className="text-[40px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{onSite}<span className="ms-1 text-[16px] font-bold text-[var(--ink-3)]">{t("p8wf.tsOnShift")}</span></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11.5px] font-bold text-[#0f7a43]">{t("p8wf.tsNClockedIn", { n: inNow.length })}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[11.5px] font-bold text-[#8a5a09]">{t("p7tc.nOnBreak", { n: onBreak.length })}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f6] px-2.5 py-1 text-[11.5px] font-bold text-[#64748b]">{t("p8wf.tsNClockedOut", { n: out.length })}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f3ecfb] px-2.5 py-1 text-[11.5px] font-bold text-[#6d28d9]">🏖 {t("p8wf.lccNOff", { n: off.length })}</span>
                  </div>
                </div>
              </div>
              {/* running-total panel — mirrors the staff clock card */}
              <div className="ms-auto flex items-center gap-5 rounded-2xl bg-[var(--panel)] px-5 py-4">
                <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8wf.tsHoursToday")}</div><div className="text-[26px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{fmtDur(totalMs)}</div></div>
                {tsPeople.length > 0 && <div className="hidden sm:block"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8wf.tsPeople")}</div><div className="text-[15px] font-extrabold text-[var(--ink-2)]">{t("p8wf.tsNToday", { n: tsPeople.length })}</div></div>}
              </div>
              {/* avatar cluster of who's on site */}
              {onSite > 0 && (
                <div className="flex items-center ps-2">
                  {[...inNow, ...onBreak].slice(0, 6).map((r) => (
                    <span key={r.id} className="-ms-2 grid h-9 w-9 flex-none place-items-center rounded-full text-[11px] font-extrabold text-[#1d3a8f] ring-2 ring-white" style={{ background: r.status === "break" ? "#fdf3e0" : "#eef4fd" }} title={t(r.status === "break" ? "p8wf.tsAvBreak" : "p8wf.tsAvIn", { name: r.name })}>{initials(r.name)}</span>
                  ))}
                  {onSite > 6 && <span className="-ms-2 grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold text-[var(--ink-3)] ring-2 ring-white">+{onSite - 6}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {([["in", t("p8wf.tsTabIn")], ["sheets", t("p8wf.tsTabSheets")], ["settings", t("p8wf.tsTabSettings")]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${tab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
        ))}
      </div>

      {tab === "in" && (() => {
        const outVisible = out.filter((r) => !offNames.has(r.name.trim().toLowerCase()));
        // "Needs attention" = anyone to chase: scheduled but not clocked in (needs
        // to clock IN), or clocked in late. They're the ones a nudge is for.
        const needsIn = outVisible.filter((r) => !r.clockInAt);
        const lateIn = [...inNow, ...onBreak].filter((r) => lateMinutesToday(r) > 0);
        const needsAction = [...needsIn, ...lateIn];
        const F = statusFilter;
        const pills: [typeof statusFilter, string, number, string][] = [
          ["all", t("p8wf.tsPillAll"), inNow.length + onBreak.length + outVisible.length, "#1d3a8f"],
          ["in", t("p8wf.tsPillIn"), inNow.length, "#0f7a43"],
          ["break", t("p8wf.tsPillBreak"), onBreak.length, "#f59e0b"],
          ["needs", t("p8wf.tsPillNeeds"), needsAction.length, "#c0392b"],
          ["out", t("p8wf.tsPillOut"), outVisible.length, "#64748b"],
        ];
        const section = (label: string, color: string, list: ClockRecord[], empty: string) => (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2"><span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color }}>{label}</span><span className="grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10.5px] font-extrabold text-white" style={{ background: color }}>{list.length}</span></div>
            {list.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">{empty}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((r) => personCard(r))}</div>}
          </div>
        );
        return (
          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2"><div className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8wf.tsWhoLive")}</div><Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="ms-auto"><option value="all">{t("p8wf.tsAllListings")}</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8wf.tsFilterPh")} className="w-52 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12px] outline-none focus:border-[#1d3a8f]" /></div>
            {/* status filter pills */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pills.map(([k, l, n, c]) => { const on = F === k; return (
                <button key={k} type="button" onClick={() => setStatusFilter(k)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors" style={on ? { borderColor: c, background: c + "14", color: c } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                  {l}<span className="grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-extrabold text-white" style={{ background: on ? c : "#cbd5e1" }}>{n}</span>
                </button>
              ); })}
            </div>
            {(F === "all" || F === "in") && section(t("p8wf.tsSecIn"), "#0f7a43", inNow, t("p8wf.tsSecInEmpty"))}
            {(F === "all" || F === "break") && section(t("p8wf.tsSecBreak"), "#f59e0b", onBreak, t("p8wf.tsSecBreakEmpty"))}
            {F === "needs" && section(t("p8wf.tsSecNeeds"), "#c0392b", needsAction, t("p8wf.tsSecNeedsEmpty"))}
            {F === "all" && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2"><span className="text-[12px] font-extrabold uppercase tracking-wide text-[#8b5cf6]">{t("p8wf.tsOffToday")}</span><span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#8b5cf6] px-1.5 text-[10.5px] font-extrabold text-white">{off.length}</span></div>
                {off.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">{t("p8wf.tsNobodyOff")}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{off.map((o) => (
                  <div key={o.name} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-white p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f3ecfb] text-[16px]">🏖</span><div className="min-w-0"><div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{o.name}</div><div className="text-[11.5px] text-[#8b5cf6]">{t("p8wf.tsOnLeave", { kind: w(o.kind) })}</div></div></div>
                ))}</div>}
              </div>
            )}
            {(F === "all" || F === "out") && section(t("p8wf.tsSecOut"), "#94a3b8", outVisible, t("p8wf.tsSecOutEmpty"))}
          </Card>
        );
      })()}

      {tab === "sheets" && review.length > 0 && (
        <Card className="mt-4 border-[#f59e0b] p-4">
          <div className="mb-1 text-[13px] font-extrabold text-[#8a5a09]">{t("p8wf.tsNeedsReview", { n: review.length })}</div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">{t("p8wf.tsReviewLede")}</p>
          <div className="divide-y divide-[var(--line)]">{review.map((r) => (
            <div key={r.id + r.day} className="flex flex-wrap items-center gap-2 py-1.5 text-[12.5px]">
              <span className="font-bold text-[var(--ink)]">{r.name}</span><span className="text-[var(--ink-3)]">{r.day}</span>
              <span className="tabular-nums text-[var(--ink-2)]">{r.clockInAt ? hhmm(r.clockInAt) : "—"} → {r.clockOutAt ? hhmm(r.clockOutAt) : "—"}</span>
              <span className="text-[11px] text-[var(--ink-3)]">{r.staffEditedBy ? t("p8wf.tsEnteredBy", { when: r.staffEditedAt ? uiDateTime(new Date(r.staffEditedAt)) : "", who: r.staffEditedBy }) : t("p8wf.tsEntered", { when: r.staffEditedAt ? uiDateTime(new Date(r.staffEditedAt)) : "" })}</span>
              <button type="button" onClick={() => { markReviewed(r.id, r.day).then(refreshReview).catch((e: unknown) => flash(e instanceof Error ? e.message : t("p8wf.tsCouldntSave"))); }} className="ms-auto rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">{t("p8wf.tsMarkReviewed")}</button>
            </div>
          ))}</div>
        </Card>
      )}

      {tab === "sheets" && (
        <Card className="mt-4 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8wf.tsSheetsToday")}</span><Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="ms-auto"><option value="all">{t("p8wf.tsAllListings")}</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div className="mb-2 text-[12px] text-[var(--ink-3)]"><Rich text={t("p8wf.tsSheetInfo", { policy: settings.payPolicy === "scheduled" ? t("p8wf.tsPolSched") : settings.payPolicy === "scheduled-less-late" ? t("p8wf.tsPolSchedLate") : settings.autoPayOvertime ? t("p8wf.tsPolActualOt") : t("p8wf.tsPolActualCap"), grace: settings.graceMin, round: settings.rounding ? t("p8wf.tsRoundedTo", { n: settings.rounding }) : "" })} /></div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-start text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">{t("p8wf.tsThEmployee")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.tsThIn")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.tsThOut")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.tsThBreak")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.tsThWorked")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.tsThSched")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.tsThLate")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.tsThOvertime")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.tsThPayHrs")}</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{tsPeople.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("p8wf.tsNoClockIns")}</td></tr> : tsPeople.map((r) => { const s = sheet(r); return (
                <tr key={r.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2 font-bold text-[var(--ink)]">{r.name}{r.approved && <span className="ms-1.5 rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#0f7a43]">{t("p8wf.tsApprovedBadge")}</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{hhmm(r.clockInAt)}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-2)]">{r.clockOutAt ? hhmm(r.clockOutAt) : r.status === "out" ? "—" : <span className="text-[#0f7a43]">{t("p8wf.tsInDots")}</span>}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--ink-3)]">{r.breakMs ? fmtDur(r.breakMs) : "—"}</td>
                  <td className="px-3 py-2 text-end font-bold tabular-nums text-[var(--ink)]">{hrs(s.workedH)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-[var(--ink-3)]">{s.schedH ? hrs(s.schedH) : "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{s.late ? <span className={s.lateOver > 0 ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}>{t("p8wf.tsNMin", { n: s.late })}</span> : "—"}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{s.overtime > 0 ? <span className={s.otPaid ? "font-bold text-[#0f7a43]" : "font-bold text-[#8a5a09]"}>+{hrs(s.overtime)}{s.otUnpaid ? " *" : ""}</span> : "—"}</td>
                  <td className="px-3 py-2 text-end font-extrabold tabular-nums text-[#0f7a43]">{hrs(s.payH)}{s.override && <span className="ms-1 rounded bg-[#eef4fd] px-1 py-0.5 text-[9px] font-bold text-[#1d3a8f] align-middle">{r.payBasis === "scheduled" ? t("p8wf.tsBasisSched") : r.payBasis === "custom" ? t("p8wf.tsBasisSet") : t("p8wf.tsBasisEdit")}</span>}</td>
                  <td className="px-3 py-2 text-end"><div className="inline-flex gap-1.5"><button type="button" onClick={() => setEdit(r)} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">✏️</button><button type="button" onClick={() => { setAll(setApproved(all, r.id, !r.approved)); flash(r.approved ? t("p8wf.tsApprovalRemoved") : t("p8wf.tsHoursApproved", { name: r.name.split(" ")[0] })); }} className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${r.approved ? "border-[#0f7a43] text-[#0f7a43]" : "border-[var(--line)] text-[#1d3a8f] hover:border-[#1d3a8f]"}`}>{r.approved ? t("p8wf.tsApprovedBtn") : t("p8wf.tsApproveBtn")}</button></div></td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]"><Rich text={t("p8wf.tsSheetNote")} /></p>
        </Card>
      )}

      {tab === "settings" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">{t("p8wf.tsRulesTitle")}</div>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsPolLabel")}</span>
              <Select value={settings.payPolicy} onChange={(e) => saveSettings({ ...settings, payPolicy: e.target.value as ClockSettings["payPolicy"] })} className="w-full">
                <option value="actual">{t("p8wf.tsOptActual")}</option>
                <option value="scheduled">{t("p8wf.tsOptSched")}</option>
                <option value="scheduled-less-late">{t("p8wf.tsOptSchedLate")}</option>
              </Select>
              <span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">{settings.payPolicy === "actual" ? t("p8wf.tsHelpActual") : settings.payPolicy === "scheduled" ? t("p8wf.tsHelpSched") : t("p8wf.tsHelpLate")}</span>
            </label>
            {settings.payPolicy === "actual" && <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--panel)] px-3 py-2.5"><input type="checkbox" checked={settings.autoPayOvertime} onChange={(e) => saveSettings({ ...settings, autoPayOvertime: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] text-[var(--ink)]"><b>{t("p8wf.tsAutoOtTitle")}</b><br /><span className="text-[11.5px] text-[var(--ink-3)]">{t("p8wf.tsAutoOtBody")}</span></span></label>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsGraceLbl")}</span><Select value={String(settings.graceMin)} onChange={(e) => saveSettings({ ...settings, graceMin: Number(e.target.value) })} className="w-full">{[0, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{t("p8wf.tsNMin", { n })}</option>)}</Select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsRoundLbl")}</span><Select value={String(settings.rounding)} onChange={(e) => saveSettings({ ...settings, rounding: Number(e.target.value) as ClockSettings["rounding"] })} className="w-full"><option value="0">{t("p8wf.tsRoundExact")}</option><option value="5">{t("p8wf.tsRound5")}</option><option value="15">{t("p8wf.tsRound15")}</option></Select></label>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-[var(--panel)] px-3 py-2.5"><input type="checkbox" checked={settings.staffBackfillDays > 0} onChange={(e) => saveSettings({ ...settings, staffBackfillDays: e.target.checked ? 7 : 0 })} className="mt-0.5 h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] text-[var(--ink)]"><b>{t("p8wf.tsBackfillTitle")}</b><br /><span className="text-[11.5px] text-[var(--ink-3)]">{t("p8wf.tsBackfillBody")}</span>{settings.staffBackfillDays > 0 && <span className="mt-1.5 flex items-center gap-2 text-[11.5px] font-bold text-[var(--ink-3)]">{t("p8wf.tsLookBack")} <Select value={String(settings.staffBackfillDays)} onChange={(e) => saveSettings({ ...settings, staffBackfillDays: Number(e.target.value) })} className="w-24">{Array.from({ length: 14 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pickPlural(t, locale, "p8wf.tsNDays", n)}</option>)}</Select></span>}</span></label>
            <label className="mt-3 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsLeadLbl")}</span><Input value={settings.leadLabel} onChange={(e) => saveSettings({ ...settings, leadLabel: e.target.value || "Lead" })} className="w-full" /><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">{t("p8wf.tsLeadHelp")}</span></label>
            <div className="mt-3 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">{t("p8wf.tsApprovedFeed")}</div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">{t("p8wf.tsHowTitle")}</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <li><Rich text={t("p8wf.tsHow1")} /></li>
              <li><Rich text={t("p8wf.tsHow2")} /></li>
              <li><Rich text={t("p8wf.tsHow3")} /></li>
              <li><Rich text={t("p8wf.tsHow4")} /></li>
              <li className="text-[var(--ink-3)]"><Rich text={t("p8wf.tsHow5")} /></li>
            </ul>
          </Card>
        </div>
      )}

      {edit && <TimesheetEditor rec={edit} onSave={(patch) => { setAll(editRecord(all, edit.id, patch)); setEdit(null); flash(t("p8wf.tsUpdated")); }} onClose={() => setEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// yyyy-mm-dd for building ISO from a HH:MM time input on the record's day
const nextDay = (day: string) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + 1); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const toISO = (day: string, hm: string) => (hm ? new Date(`${day}T${hm}:00`).toISOString() : undefined);
function TimesheetEditor({ rec, onSave, onClose }: { rec: ClockRecord; onSave: (patch: Partial<ClockRecord>) => void; onClose: () => void }) {
  const t = useT();
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
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{rec.name}</h3><span className="text-[12px] text-[var(--ink-3)]">{t("p8wf.tsEditSuffix")}</span><button type="button" onClick={onClose} className="ms-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFClockIn")}</span><Input type="time" value={inHm} onChange={(e) => setInHm(e.target.value)} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFClockOut")}</span><Input type="time" value={outHm} onChange={(e) => setOutHm(e.target.value)} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFBreak")}</span><Input inputMode="numeric" value={String(breakMin)} onChange={(e) => setBreakMin(parseInt(e.target.value) || 0)} className="w-full" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFPayAs")}</span><Select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className="w-full"><option value="actual">{t("p8wf.tsBActual")}</option><option value="scheduled">{t("p8wf.tsBSched")}</option><option value="scheduled-less-late">{t("p8wf.tsOptSchedLate")}</option><option value="custom">{t("p8wf.tsBCustom")}</option></Select></label>
          {basis === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFHours")}</span><Input inputMode="decimal" value={custom} placeholder={t("p8wf.tsHoursPh")} onChange={(e) => setCustom(e.target.value)} className="w-full" /></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.tsFNote")}</span><Input value={note} placeholder={t("p8wf.tsNotePh")} onChange={(e) => setNote(e.target.value)} className="w-full" /></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">{basis === "actual" ? t("p8wf.tsEActual") : basis === "scheduled" ? t("p8wf.tsESched") : basis === "scheduled-less-late" ? t("p8wf.tsELate") : t("p8wf.tsECustom", { n: custom || "—" })}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => onSave({ clockInAt: toISO(day, inHm), clockOutAt: inHm && outHm && outHm < inHm ? toISO(nextDay(day), outHm) : toISO(day, outHm), /* an overnight shift (22:00 → 02:00) ends the next morning */ breakMs: Math.max(0, breakMin) * 60000, payBasis: basis, payHoursOverride: basis === "custom" ? (parseFloat(custom) || 0) : undefined, editNote: note || undefined })}>{t("common.save")}</Button></div>
      </div>
    </div>
  );
}

export default TimesheetsApp;
