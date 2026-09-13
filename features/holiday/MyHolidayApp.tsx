"use client";

// Staff-facing "My holiday" — request time off, watch your allowance, and see
// your absence history. Mirrors the manager planner's data (same demo store);
// in production this is scoped to the logged-in person server-side. Demo "me" =
// Marcus Bell, matching the other staff self-service areas.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type Absence, type AbsenceKind, type AbsenceStatus, type LeaveProfile, type HolidayPolicy,
  KIND_META, summarise, workingDays, isoDate, nextPublicHoliday, leaveYear,
} from "@/lib/holiday";
import { loadPolicy, loadProfiles, loadAbsences, saveAbsences, slug, syncLeave, LEAVE_EVENT, LEAVE_ERROR_EVENT } from "./data";
import { isDemoMode } from "@/lib/api";
import { getMe, peekMe } from "@/components/auth/PortalGuard";
import { loadClock, type ClockRecord, hhmm as clockHhmm } from "@/features/timeclock/data";
import { useTenantSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n/provider";

type Tr = (key: string, vars?: Record<string, string | number>) => string;
// Display labels for the stored leave kinds / statuses (the stored values stay English).
const KIND_KEY: Record<AbsenceKind, string> = {
  annual: "staffp.holKindAnnual", sickness: "staffp.holKindSickness", toil: "staffp.holKindToil", unpaid: "staffp.holKindUnpaid",
  maternity: "staffp.holKindMaternity", adoption: "staffp.holKindAdoption", parental: "staffp.holKindParental",
  bereavement: "staffp.holKindBereavement", other: "staffp.holKindOther",
};
const STATUS_KEY: Record<AbsenceStatus, string> = { pending: "staffp.holStPending", approved: "staffp.holStApproved", declined: "staffp.holStDeclined", cancelled: "staffp.holStCancelled" };
// Same as lib/holiday's fmtRange, but in the reader's language.
const fmtRange = (start: string, end: string, locale = "en-GB") => {
  const opt: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  const f = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opt);
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
};
// Same as the time clock's sinceLabel, translated.
const sinceLabel = (tr: Tr, iso?: string): string => {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return tr("staffp.holJustNow");
  if (min < 60) return tr("staffp.holMinAgo", { m: min });
  return tr("staffp.holHrMinAgo", { h: Math.floor(min / 60), m: min % 60 });
};
const rich = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));

// Only for the guided-tour demo. A real session uses the account's own name
// (the server files a request under it) — it used to be "Marcus Bell" for all.
const DEMO_ME = "Marcus Bell";
const KINDS: AbsenceKind[] = ["annual", "sickness", "toil", "unpaid", "maternity", "adoption", "parental", "bereavement", "other"];
// The "Other" summary card groups everything that isn't annual / sickness / TOIL.
const OTHER_KINDS: AbsenceKind[] = ["other", "unpaid", "maternity", "adoption", "parental", "bereavement"];

function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0; const R = 34, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 84 84" className="h-24 w-24">
      <circle cx="42" cy="42" r={R} fill="none" stroke="#e6ebf3" strokeWidth="8" />
      <circle cx="42" cy="42" r={R} fill="none" stroke="#1d3a8f" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 42 42)" />
      <text x="42" y="40" textAnchor="middle" className="fill-[#1a1c2b] text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{value}</text>
      <text x="42" y="54" textAnchor="middle" className="fill-[#6b7086] text-[8px] font-bold uppercase">{label}</text>
    </svg>
  );
}

export function MyHolidayApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const [ME, setME] = useState<string>(() => (isDemoMode() ? DEMO_ME : ((peekMe() as { name?: string; email?: string } | null)?.name?.trim() || (peekMe() as { email?: string } | null)?.email || "")));
  const ME_ID = slug(ME || "me");
  const [profiles, setProfiles] = useState<LeaveProfile[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [policy, setPolicy] = useState<HolidayPolicy>(loadPolicy);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqKind, setReqKind] = useState<AbsenceKind>("annual");
  const openReq = (k: AbsenceKind = "annual") => { setReqKind(k); setReqOpen(true); };
  const [showHistory, setShowHistory] = useState(false);
  const [histKind, setHistKind] = useState<AbsenceKind | "all">("all");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");
  const [histQ, setHistQ] = useState("");
  const [ovTab, setOvTab] = useState<"summary" | "status" | "clocked">("summary");
  const [clock, setClock] = useState<Record<string, ClockRecord>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { settings: tenantSettings } = useTenantSettings();
  useEffect(() => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); setClock(loadClock()); }, []);
  // The planner is on the server: fetch it, re-read when it lands, and say so
  // when a request is refused.
  useEffect(() => {
    const reload = () => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); };
    const onErr = (e: Event) => { setToast((e as CustomEvent<string>).detail); setTimeout(() => setToast(null), 4000); };
    window.addEventListener(LEAVE_EVENT, reload); window.addEventListener(LEAVE_ERROR_EVENT, onErr);
    if (!isDemoMode()) getMe().then((m) => { const n = (m as { name?: string; email?: string }).name?.trim() || (m as { email?: string }).email; if (n) setME(n); }).catch(() => {});
    void syncLeave().catch(() => {});
    return () => { window.removeEventListener(LEAVE_EVENT, reload); window.removeEventListener(LEAVE_ERROR_EVENT, onErr); };
  }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const persistAbs = (a: Absence[]) => { setAbsences(a); saveAbsences(a); };

  const me = profiles.find((p) => p.id === ME_ID) || { id: ME_ID, name: ME } as LeaveProfile;
  // rolled-up = holiday INCLUDED IN PAY. They can still take time off (a legal
  // right), but it's UNPAID at the point of taking (already paid via 12.07%).
  const rolled = me.holidayPay === "rolled-up";
  const s = useMemo(() => summarise(me, policy, absences), [me, policy, absences]);
  const mine = absences.filter((a) => a.staffId === ME_ID).sort((a, b) => (a.start < b.start ? 1 : -1));
  const ly = leaveYear(policy);
  const nph = nextPublicHoliday(isoDate(new Date()), policy.region);
  const otherDays = s.byKind.other + s.byKind.unpaid + s.byKind.maternity + s.byKind.parental;

  // Absence-history filtering: by kind (driven by the summary cards), date range and free text.
  const histFiltered = mine.filter((a) => {
    if (histKind === "other" ? !OTHER_KINDS.includes(a.kind) : histKind !== "all" && a.kind !== histKind) return false;
    if (histFrom && a.end < histFrom) return false;
    if (histTo && a.start > histTo) return false;
    const q = histQ.trim().toLowerCase();
    if (q && !`${KIND_META[a.kind].label} ${t(KIND_KEY[a.kind])} ${t(STATUS_KEY[a.status])} ${a.reason ?? ""} ${a.note ?? ""} ${a.status} ${a.start} ${a.end}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const histActive = histKind !== "all" || !!histFrom || !!histTo || !!histQ.trim();
  const clearHist = () => { setHistKind("all"); setHistFrom(""); setHistTo(""); setHistQ(""); };
  const pickCard = (kind: AbsenceKind) => { setHistKind((k) => (k === kind ? "all" : kind)); setShowHistory(true); };

  const submit = (a: Omit<Absence, "id" | "staffId" | "name" | "status" | "requestedAt" | "days"> & { days: number }) => {
    // only ANNUAL leave is unpaid-because-rolled-up; sickness is SSP-paid, etc.
    const paid = a.kind === "unpaid" ? false : rolled && a.kind === "annual" ? false : true;
    const abs: Absence = { id: crypto.randomUUID(), staffId: ME_ID, name: ME, status: "pending", requestedAt: new Date().toISOString(), ...a, paid, ...(a.kind === "sickness" ? { ssp: "eligible" as const } : {}) };
    persistAbs([abs, ...absences]); setReqOpen(false); flash(t("staffp.holRequestSent"));
  };
  const cancel = (id: string) => { if (window.confirm(t("staffp.holCancelConfirm"))) persistAbs(absences.map((x) => (x.id === id ? { ...x, status: "cancelled" as const } : x))); };

  const historyRows = (
    <Card className="mt-4 p-0">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("staffp.holMyTimeOff")}</div>
      {mine.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">{t("staffp.holNoTimeOff")}</div> : (
        <div className="divide-y divide-[var(--line)]">{mine.map((a) => { const km = KIND_META[a.kind]; const tone = a.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : a.status === "pending" ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"; return (
          <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span>
            <div className="min-w-[150px]"><div className="text-[12.5px] font-bold text-[var(--ink)]">{t(KIND_KEY[a.kind])}{a.paid === false && <span className="ml-1.5 rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9.5px] font-bold text-[#64748b]">{t("staffp.holUnpaidTag")}</span>}</div><div className="text-[11.5px] text-[var(--ink-3)]">{fmtRange(a.start, a.end, locale)}{a.fromTime ? ` · ${a.fromTime}–${a.toTime}` : a.half ? ` · ${t(a.half === "am" ? "staffp.holHalfAm" : "staffp.holHalfPm")}` : ""} · {t("staffp.holDaysAbbr", { n: a.days })}</div></div>
            {a.note && <div className="text-[11.5px] italic text-[var(--ink-3)]">“{a.note}”</div>}
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${tone}`}>{t(STATUS_KEY[a.status])}</span>
            {a.status === "pending" && <button type="button" onClick={() => cancel(a.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("staffp.holCancel")}</button>}
          </div>
        ); })}</div>
      )}
    </Card>
  );

  if (rolled) return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.holMyTimeOff")} icon="🏖" lede={t("staffp.holRolledLede")} actions={<Button variant="primary" onClick={() => setReqOpen(true)}>{t("staffp.holBookBtn")}</Button>} />
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef4fd] text-[20px]">💷</div>
          <div>
            <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("staffp.holRolledTitle")}</div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[var(--ink-2)]">{rich(t("staffp.holRolledBody"))}</p>
            {nph && <div className="mt-2 inline-block rounded-lg bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[#1d3a8f]">{t("staffp.holNextPh", { name: nph.name, date: new Date(`${nph.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" }) })}</div>}
          </div>
        </div>
      </Card>
      {historyRows}
      {reqOpen && <RequestModal region={policy.region} remaining={s.remaining} rolled initialKind={reqKind} sickOnly={reqKind === "sickness"} onSubmit={submit} onClose={() => setReqOpen(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );

  const counter = (kind: AbsenceKind, value: number) => { const km = KIND_META[kind]; const active = showHistory && histKind === kind; return (
    <button type="button" onClick={() => pickCard(kind)} title={t("staffp.holFilterBy", { kind: t(KIND_KEY[kind]) })} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-[#1d3a8f] bg-[#f4f8ff] ring-2 ring-[#1d3a8f]/25" : "border-[var(--line)] hover:border-[var(--ink-3)] hover:bg-[var(--panel)]"}`}><span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span><div><div className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{value}</div><div className="text-[10.5px] font-semibold text-[var(--ink-3)]">{t(KIND_KEY[kind])}</div></div>{active && <span className="ml-auto text-[13px] font-black text-[#1d3a8f]">✓</span>}</button>
  ); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.holMyTimeOff")} icon="🏖" lede={t("staffp.holLede")} />

      {(() => {
        // BrightHR-style overview: a week strip (team absences per day) + tabs.
        const wk = new Date(); const dow = (wk.getDay() + 6) % 7; const mon = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() - dow);
        const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); return isoDate(d); });
        const today = isoDate(new Date());
        const teamOff = (iso: string) => absences.filter((a) => a.status === "approved" && a.start <= iso && a.end >= iso).length;
        const pendingCount = mine.filter((a) => a.status === "pending").length;
        const myClock = clock[ME_ID];
        const myStatus = myClock?.status === "in" ? t("staffp.holStatusIn") : myClock?.status === "break" ? t("staffp.holStatusBreak") : t("staffp.holStatusOut");
        // Who's-clocked-in visibility follows the provider's co-worker setting
        // (same as the schedule "Who's on" tab): all / same-listing / leads / off.
        const seeTeamAbsence = tenantSettings.scheduling?.staffSeeTeamAbsence ?? true;
        const vis = tenantSettings.scheduling?.coworkerVisibility ?? "all";
        const iAmLead = /lead|manager|owner/i.test(me.role ?? "");
        const teamVisible = vis !== "none" && (vis !== "leads" || iAmLead);
        const clockedAll = Object.values(clock).filter((r) => r.status === "in" || r.status === "break");
        const clockedIn = vis === "team" ? clockedAll.filter((r) => r.op && r.op === myClock?.op) : clockedAll;
        return (
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* ── Overview (left) ── */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">{t("staffp.holOverview")}</div>
            {pendingCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#f3c0bb] px-2.5 py-1 text-[11.5px] font-bold text-[#c0392b]">⚠ {t(pendingCount === 1 ? "staffp.holPendingOne" : "staffp.holPendingMany", { n: pendingCount })}</span>}
          </div>
          {/* week strip — team time-off, only if the provider lets staff see it */}
          {seeTeamAbsence && (<>
          <div className="grid grid-cols-7 gap-1.5">{week.map((iso) => { const n = teamOff(iso); const isToday = iso === today; const d = new Date(`${iso}T00:00:00`); return (
            <div key={iso} className="text-center">
              <div className={`text-[10.5px] font-bold ${isToday ? "text-[#1d3a8f]" : "text-[var(--ink-3)]"}`}>{d.toLocaleDateString(locale, { weekday: "short" })} {d.getDate()}</div>
              <div className={`mx-auto mt-1 grid h-11 w-11 place-items-center rounded-full text-[15px] font-extrabold tabular-nums ${isToday ? "bg-[#1d3a8f] text-white" : n > 0 ? "bg-[#eef4fd] text-[#1d3a8f] ring-1 ring-[#cfe0fb]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{n}</div>
            </div>
          ); })}</div>
          <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">{t("staffp.holWeekCaption")}</div>
          </>)}

          {/* tabs */}
          <div className="mt-3 flex gap-4 border-b border-[var(--line)] text-[12.5px] font-bold">
            {([["summary", t("staffp.holTabSummary")], ["status", t("staffp.holTabStatus")], ...(teamVisible ? [["clocked", t("staffp.holTabClocked", { n: clockedIn.length })] as [typeof ovTab, string]] : [])] as [typeof ovTab, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setOvTab(k)} className={`-mb-px border-b-2 pb-2 ${ovTab === k ? "border-[#1d3a8f] text-[#1d3a8f]" : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]"}`}>{l}</button>
            ))}
          </div>

          {ovTab === "summary" && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Ring value={s.takenAnnual + s.bookedAnnual + s.byKind.sickness + s.byKind.toil + otherDays} total={Math.max(1, s.total)} label={t("staffp.holRingDaysOff")} />
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">{counter("annual", s.takenAnnual + s.bookedAnnual)}{counter("other", otherDays)}{counter("sickness", s.byKind.sickness)}{counter("toil", s.byKind.toil)}</div>
            </div>
          )}
          {ovTab === "status" && (
            <div className="mt-4"><div className="flex items-center gap-2 rounded-xl bg-[var(--panel)] p-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: myClock?.status === "in" ? "#12b76a" : myClock?.status === "break" ? "#f59e0b" : "#94a3b8" }} /><span className="text-[13px] font-bold text-[var(--ink)]">{t("staffp.holYoureStatus", { status: myStatus })}</span>{myClock?.clockInAt && myClock.status !== "out" && <span className="text-[12px] text-[var(--ink-3)]">{t("staffp.holSince", { time: clockHhmm(myClock.clockInAt) })}</span>}<a href="schedule?tab=clock" className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{t("staffp.holClockLink")}</a></div></div>
          )}
          {ovTab === "clocked" && teamVisible && (
            <div className="mt-3 divide-y divide-[var(--line)]">{clockedIn.length === 0 ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">{t(vis === "team" ? "staffp.holNobodyInListings" : "staffp.holNobodyIn")}</div> : clockedIn.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 text-[12.5px]"><span className="h-2 w-2 rounded-full" style={{ background: r.status === "break" ? "#f59e0b" : "#12b76a" }} /><span className="font-bold text-[var(--ink)]">{r.name}</span>{r.op && <span className="text-[var(--ink-3)]">· {r.op}</span>}<span className="ml-auto text-[var(--ink-3)]">{r.status === "break" ? t("staffp.holOnBreak") : sinceLabel(t, r.clockInAt)}</span></div>
            ))}</div>
          )}
        </Card>

        {/* ── My summary (right) ── */}
        <Card className="p-4">
          <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">{t("staffp.holTabSummary")}</div>
          <button type="button" onClick={() => openReq("annual")} className="w-full rounded-lg bg-[#e6007e] px-4 py-2.5 text-[13.5px] font-extrabold text-white hover:brightness-105">{t("staffp.holRequestBtn")}</button>
          <button type="button" onClick={() => openReq("sickness")} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-2.5 text-[13.5px] font-extrabold text-white hover:brightness-105">{t("staffp.holOffSickBtn")}</button>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="mt-2 w-full rounded-lg border border-[#e6007e] px-4 py-2.5 text-[13.5px] font-extrabold text-[#e6007e] hover:bg-[#fdeef6]">{t("staffp.holHistory")}</button>
          <div className="mt-4 flex items-center gap-4 border-t border-[var(--line)] pt-4">
            <Ring value={s.remaining} total={s.total} label={t("staffp.holRingLeft")} />
            <div>
              <div className="text-[14px] font-extrabold text-[var(--ink)]">{t(s.remaining === 1 ? "staffp.holDayOne" : "staffp.holDayMany", { n: s.remaining })} <span className="font-semibold text-[var(--ink-3)]">{t("staffp.holRemaining")}</span></div>
              <div className="text-[12.5px] font-bold text-[var(--ink-2)]">{t("staffp.holAllowance", { n: s.total })}</div>
              {s.carriedOver > 0 && <div className="text-[11.5px] text-[var(--ink-3)]">{t("staffp.holCarried", { n: s.carriedOver })}</div>}
            </div>
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="text-[11px] font-bold text-[var(--ink-3)]">{t("staffp.holNextUp")}</div>
            <div className="text-[13px] font-extrabold text-[#1d3a8f]">{nph ? `${nph.name} · ${new Date(`${nph.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" })}` : "—"}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-lg border border-[#f3c0bb] px-2.5 py-2 text-center text-[11.5px] font-bold text-[#c0392b]">🕒 {myClock?.lateMin ? 1 : 0} {t("staffp.holLateness")}</span>
            <span className="flex-1 rounded-lg border border-[#f0d9b5] px-2.5 py-2 text-center text-[11.5px] font-bold text-[#8a5a09]">🤒 {s.byKind.sickness} {t("staffp.holSickness")}</span>
          </div>
        </Card>
      </div>
        );
      })()}

      {/* history */}
      {showHistory && (
        <Card className="mt-4 p-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("staffp.holHistory")}</div>
            <span className="text-[11px] font-semibold text-[var(--ink-3)]">{histFiltered.length !== mine.length ? t("staffp.holOfN", { a: histFiltered.length, b: mine.length }) : histFiltered.length}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {histKind !== "all" && <button type="button" onClick={() => setHistKind("all")} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">{`${KIND_META[histKind].icon} ${t(KIND_KEY[histKind])}`} <span className="text-[12px]">×</span></button>}
              <label className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--ink-3)]">{t("staffp.holFrom")} <Input type="date" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} className="h-8 w-[140px] text-[12px]" /></label>
              <label className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--ink-3)]">{t("staffp.holTo")} <Input type="date" value={histTo} min={histFrom || undefined} onChange={(e) => setHistTo(e.target.value)} className="h-8 w-[140px] text-[12px]" /></label>
              <Input value={histQ} onChange={(e) => setHistQ(e.target.value)} placeholder={t("staffp.holSearchPh")} className="h-8 w-[150px] text-[12px]" />
              {histActive && <button type="button" onClick={clearHist} className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("staffp.holClear")}</button>}
            </div>
          </div>
          {mine.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">{t("staffp.holNoAbsences")}</div>
          : histFiltered.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">{t("staffp.holNoMatch")} <button type="button" onClick={clearHist} className="font-bold text-[#1d3a8f] hover:underline">{t("staffp.holClearFilters")}</button></div> : (
            <div className="divide-y divide-[var(--line)]">{histFiltered.map((a) => { const km = KIND_META[a.kind]; const tone = a.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : a.status === "pending" ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"; return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span>
                <div className="min-w-[150px]"><div className="text-[12.5px] font-bold text-[var(--ink)]">{t(KIND_KEY[a.kind])}</div><div className="text-[11.5px] text-[var(--ink-3)]">{fmtRange(a.start, a.end, locale)}{a.fromTime ? ` · ${a.fromTime}–${a.toTime}` : a.half ? ` · ${t(a.half === "am" ? "staffp.holHalfAm" : "staffp.holHalfPm")}` : ""} · {t("staffp.holDaysAbbr", { n: a.days })}</div></div>
                {(a.reason || a.note) && <div className="text-[11.5px] italic text-[var(--ink-3)]">“{a.reason || a.note}”</div>}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${tone}`}>{t(STATUS_KEY[a.status])}</span>
                {a.status === "pending" && <button type="button" onClick={() => cancel(a.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("staffp.holCancel")}</button>}
              </div>
            ); })}</div>
          )}
        </Card>
      )}

      {reqOpen && <RequestModal region={policy.region} remaining={s.remaining} initialKind={reqKind} sickOnly={reqKind === "sickness"} onSubmit={submit} onClose={() => setReqOpen(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function RequestModal({ region, remaining, rolled, initialKind, sickOnly, onSubmit, onClose }: { region: HolidayPolicy["region"]; remaining: number; rolled?: boolean; initialKind?: AbsenceKind; sickOnly?: boolean; onSubmit: (a: { kind: AbsenceKind; start: string; end: string; half: "am" | "pm" | null; fromTime?: string; toTime?: string; reason?: string; days: number }) => void; onClose: () => void }) {
  const { t } = useI18n();
  const today = isoDate(new Date());
  // Off-sick flow is sickness-only; the general request flow excludes sickness (that has its own "I'm off sick" button).
  const kindOptions = sickOnly ? (["sickness"] as AbsenceKind[]) : KINDS.filter((k) => k !== "sickness");
  const [kind, setKind] = useState<AbsenceKind>(sickOnly ? "sickness" : initialKind && initialKind !== "sickness" ? initialKind : "annual");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [dur, setDur] = useState<"all" | "times">("all");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const single = start === end;
  const timed = single && dur === "times";
  const mins = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
  const timedHours = timed ? (mins(toTime) - mins(fromTime)) / 60 : 0;
  // A part-day booking consumes a fraction of the day's allowance (rounded to the
  // nearest half, capped at a full day) — a standard working day is taken as 7.5h.
  const days = timed ? Math.min(1, Math.max(0.5, Math.round((timedHours / 7.5) * 2) / 2)) : workingDays(start, end, { region });
  const rolledUnpaid = rolled && kind === "annual"; // holiday already paid via rolled-up
  const overBudget = !rolledUnpaid && kind === "annual" && days > remaining;
  // context note that depends on the type chosen
  // NB: we deliberately show NO sick-pay / SSP messaging to staff — sick pay only
  // ever surfaces on the payslip, so booking sickness never advertises an amount.
  const context = rolledUnpaid ? { tone: "bg-[#fdf3e0] text-[#8a5a09]", text: t("staffp.holRolledNote") }
    : kind === "unpaid" ? { tone: "bg-[#eef1f6] text-[#64748b]", text: t("staffp.holUnpaidNote") }
    : null;
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className={`w-full max-w-md overflow-hidden rounded-2xl p-5 shadow-2xl ${sickOnly ? "bg-[#fffaf3] ring-2 ring-[#f59e0b]/45" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>
        <div className={`-mx-5 -mt-5 mb-4 h-1.5 ${sickOnly ? "bg-[#f59e0b]" : "bg-[#e6007e]"}`} />
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{sickOnly ? t("staffp.holReportSick") : rolled ? t("staffp.holBookTitle") : t("staffp.holRequestBtn")}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        {sickOnly && <p className="-mt-1.5 mb-3 text-[11.5px] leading-relaxed text-[#8a5a09]">{t("staffp.holSickIntro")}</p>}
        <div className="grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holType")}</span><Select value={kind} onChange={(e) => setKind(e.target.value as AbsenceKind)} disabled={sickOnly} className="w-full disabled:opacity-70">{kindOptions.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {t(KIND_KEY[k])}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holFrom")}</span><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holTo")}</span><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="w-full" /></label>
          </div>
          {single && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holDuration")}</span><Select value={dur} onChange={(e) => setDur(e.target.value as "all" | "times")} className="w-full"><option value="all">{t("staffp.holAllDay")}</option><option value="times">{t("staffp.holSpecificTimes")}</option></Select></label>}
          {timed && <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holFromTime")}</span><Input type="time" value={fromTime} onChange={(e) => { setFromTime(e.target.value); if (e.target.value >= toTime) setToTime(e.target.value); }} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.holUntil")}</span><Input type="time" value={toTime} min={fromTime} onChange={(e) => setToTime(e.target.value)} className="w-full" /></label>
          </div>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{sickOnly ? t("staffp.holWhatsWrong") : t("staffp.holReasonOpt")}</span><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={sickOnly ? t("staffp.holSickPh") : t("staffp.holReasonPh")} className="w-full" /></label>
          {context && <div className={`rounded-lg px-3 py-2 text-[11.5px] font-semibold ${context.tone}`}>{context.text}</div>}
          <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold ${overBudget ? "bg-[#fdecec] text-[#c0392b]" : sickOnly ? "bg-[#fff4e0] text-[#8a5a09]" : "bg-[#eef4fd] text-[#1d3a8f]"}`}>{timed ? `${fromTime}–${toTime} · ` : ""}{t(days === 1 ? "staffp.holWorkingDayOne" : "staffp.holWorkingDayMany", { n: days })}{sickOnly ? ` ${t("staffp.holOffSick")}` : rolledUnpaid ? ` · ${t("staffp.holUnpaidInPay")}` : kind === "annual" ? ` · ${t("staffp.holLeftBefore", { n: remaining })}` : ""}{overBudget ? ` — ${t("staffp.holOverBudget")}` : ""}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>{t("staffp.holCancel")}</Button><Button variant="primary" disabled={days <= 0 || (timed && timedHours <= 0)} onClick={() => onSubmit({ kind, start, end, half: null, fromTime: timed ? fromTime : undefined, toTime: timed ? toTime : undefined, reason: reason || undefined, days })}>{t("staffp.holSend")}</Button></div>
      </div>
    </div>
  );
}
