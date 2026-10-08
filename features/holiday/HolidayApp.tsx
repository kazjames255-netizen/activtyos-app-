"use client";

// Holiday & absence planner — operator/manager side. Approve or decline time-off
// requests (with allowance-impact + clash detection), see who's off and who
// needs covering, manage each person's entitlement, and set the leave-year
// policy. Statutory entitlement is computed to UK law (see lib/holiday.ts).
// Demo store; backend + real notifications are Amir's (docs/holiday-planner-handoff.md).
import { dateLocale as dl, uiDate } from "@/lib/i18n/format";
import { isRTL } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/components/i18n/Rich";
import { KIND_KEY, STATUS_KEY } from "./kindKeys";
import { payLabel, payNote, familyNote, sickPayNote, sickRuleText } from "./leaveText";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";
import {
  type Absence, type AbsenceKind, type LeaveProfile, type HolidayPolicy,
  KIND_META, summarise, conflicts, annualAllowance, statutoryDays, leaveYear,
  workingDays, isoDate, round1, isBankHoliday, sspWeekly, SSP_WEEKLY,
  type PayTreatment, defaultPayTreatment,
} from "@/lib/holiday";
import { loadPolicy, savePolicy, loadProfiles, saveProfiles, loadAbsences, saveAbsences, syncLeave, pendingLocalAbsences, importLocalAbsences, discardLocalAbsences, LEAVE_EVENT, LEAVE_ERROR_EVENT } from "./data";

const KINDS = Object.keys(KIND_META) as AbsenceKind[];
const mondayOf = (d: Date) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
// Same as lib/holiday's fmtRange, but in the reader's language.
const fmtRange = (start: string, end: string) => {
  const f = (iso: string) => uiDate(new Date(`${iso}T00:00:00`), { weekday: "short", day: "numeric", month: "short" });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
};
const dayLabel = (iso: string) => uiDate(new Date(`${iso}T00:00:00`), { weekday: "short", day: "numeric" });

// rostered staff names per date, read from the schedule (aos.rota.v5)
function rosteredByDate(dates: string[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {}; dates.forEach((d) => (out[d] = new Set()));
  try {
    const s = JSON.parse(localStorage.getItem("aos.rota.v5") || "null");
    if (s && Array.isArray(s.staff) && Array.isArray(s.shifts)) {
      const nameById: Record<string, string> = {}; s.staff.forEach((st: { id: string; name: string }) => (nameById[st.id] = st.name));
      for (const sh of s.shifts) { if (sh.staffId && out[sh.date]) { const nm = nameById[sh.staffId]; if (nm) out[sh.date].add(nm.trim().toLowerCase()); } }
    }
  } catch { /* ignore */ }
  return out;
}

type Tab = "requests" | "off" | "allowances" | "settings";

export function HolidayApp() {
  const { t, locale } = useI18n();
  const rtl = isRTL(locale);
  const [tab, setTab] = useState<Tab>("requests");
  const [profiles, setProfiles] = useState<LeaveProfile[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [policy, setPolicy] = useState<HolidayPolicy>(loadPolicy);
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Absence | null>(null);
  const [profEdit, setProfEdit] = useState<LeaveProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Absences only this browser had before leave moved to the server — the
  // manager chooses to import them into THIS account (or not).
  const [localOnly, setLocalOnly] = useState(0);
  useEffect(() => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); }, []);
  // Server-backed: fetch, re-read when it lands, surface a refused change.
  useEffect(() => {
    const reload = () => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); };
    const onErr = (e: Event) => { setToast((e as CustomEvent<string>).detail); setTimeout(() => setToast(null), 4000); };
    window.addEventListener(LEAVE_EVENT, reload); window.addEventListener(LEAVE_ERROR_EVENT, onErr);
    void syncLeave().then(() => setLocalOnly(pendingLocalAbsences().length)).catch(() => {});
    return () => { window.removeEventListener(LEAVE_EVENT, reload); window.removeEventListener(LEAVE_ERROR_EVENT, onErr); };
  }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const persistAbs = (a: Absence[]) => { setAbsences(a); saveAbsences(a); };
  const persistProfiles = (p: LeaveProfile[]) => { setProfiles(p); saveProfiles(p); };
  const persistPolicy = (p: HolidayPolicy) => { setPolicy(p); savePolicy(p); };

  const profileOf = (id: string) => profiles.find((p) => p.id === id) || { id, name: id } as LeaveProfile;
  const summaryOf = (id: string) => summarise(profileOf(id), policy, absences);
  const decide = (id: string, status: Absence["status"], note?: string) => { persistAbs(absences.map((x) => (x.id === id ? { ...x, status, decidedBy: "You", decidedAt: new Date().toISOString(), note } : x))); };
  const bulkMethod = (m: "accrued" | "rolled-up") => { persistProfiles(profiles.map((p) => ({ ...p, holidayPay: m }))); flash(t(m === "rolled-up" ? "p8wf.hlBulkRolled" : "p8wf.hlBulkBooked")); };
  const blankAbsence = (): Absence => ({ id: "", staffId: "", name: "", kind: "annual", start: isoDate(new Date()), end: isoDate(new Date()), half: null, days: 0, status: "approved", requestedAt: new Date().toISOString(), decidedBy: "You" });
  const addLeave = (x: Absence) => { persistAbs([{ ...x, id: crypto.randomUUID() }, ...absences]); setAdding(false); flash(t("p8wf.hlLeaveAdded", { name: (x.name || "").split(" ")[0] })); };

  const pending = absences.filter((a) => a.status === "pending").sort((a, b) => (a.start < b.start ? -1 : 1));
  const ly = leaveYear(policy);
  const offToday = useMemo(() => { const td = isoDate(new Date()); return absences.filter((a) => a.status === "approved" && a.start <= td && a.end >= td); }, [absences]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("p7nav.leave_absence")} icon="🏖" lede={t("p8wf.hlLede")} />
      {localOnly > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#f0d9a8] bg-[#fdf6e6] px-4 py-3 text-[12.5px] text-[#7a5b06]">
          <span className="min-w-0 flex-1"><Rich text={pickPlural(t, locale, "p8wf.hlLocalOnly", localOnly)} /></span>
          <Button variant="primary" onClick={() => { void importLocalAbsences().then((r) => { setLocalOnly(pendingLocalAbsences().length); flash(r.failed ? t("p8wf.hlImportedFailed", { ok: r.ok, failed: r.failed }) : t("p8wf.hlImported", { ok: r.ok })); }); }}>{t("p8wf.hlImport")}</Button>
          <Button onClick={() => { if (window.confirm(t("p8wf.hlConfirmDiscard"))) { discardLocalAbsences(); setLocalOnly(0); } }}>{t("p8wf.hlDiscard")}</Button>
        </div>
      )}

      {/* Overview — same BrightHR-style visuals as the staff "My time off" page:
          a week strip of who's off, plus colourful counter cards that jump to
          the relevant tab. Keeps all the info, just reads at a glance. */}
      {(() => {
        const wkNow = new Date(); const dow = (wkNow.getDay() + 6) % 7;
        const mon = new Date(wkNow.getFullYear(), wkNow.getMonth(), wkNow.getDate() - dow);
        const week = Array.from({ length: 7 }, (_, i) => isoDate(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
        const today = isoDate(new Date());
        const teamOff = (iso: string) => absences.filter((a) => a.status === "approved" && a.start <= iso && a.end >= iso).length;
        const offThisWeek = new Set(absences.filter((a) => a.status === "approved" && a.start <= week[6] && a.end >= week[0]).map((a) => a.staffId)).size;
        const cards: { icon: string; value: number; label: string; sub: string; grad: string; tab: Tab }[] = [
          { icon: "📋", value: pending.length, label: t("p8wf.hlCardPending"), sub: pending.length ? t("p8wf.hlSubAwaiting") : t("p8wf.hlSubDecided"), grad: pending.length ? GRAD.pink : GRAD.green, tab: "requests" },
          { icon: "🌴", value: offToday.length, label: t("p8wf.hlCardOffToday"), sub: offToday.length ? offToday.map((a) => a.name.split(" ")[0]).join(", ") : t("p8wf.hlSubEveryoneIn"), grad: GRAD.teal, tab: "off" },
          { icon: "🗓️", value: offThisWeek, label: t("p8wf.hlCardOffWeek"), sub: t("p8wf.hlSubBooked"), grad: GRAD.violet, tab: "off" },
          { icon: "👥", value: profiles.length, label: t("p8wf.hlCardTeam"), sub: t("p8wf.hlSubTracked"), grad: GRAD.blue, tab: "allowances" },
        ];
        return (
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline gap-2 px-4 py-3" style={{ background: "linear-gradient(120deg,#16306e,#274ba3)" }}>
              <div className="text-[15px] font-extrabold text-white">{t("p8wf.hlThisWeek")}</div>
              <span className="text-[11.5px] font-semibold text-white/70">{t("p8wf.hlLeaveYear", { label: ly.label })}</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((iso) => { const n = teamOff(iso); const isToday = iso === today; const d = new Date(`${iso}T00:00:00`); return (
                  <div key={iso} className="text-center">
                    <div className={`text-[10.5px] font-bold ${isToday ? "text-[#1d3a8f]" : "text-[var(--ink-3)]"}`}>{uiDate(d, { weekday: "short" })} {d.getDate()}</div>
                    <div className="mx-auto mt-1 grid h-11 w-11 place-items-center rounded-full text-[15px] font-extrabold tabular-nums text-white"
                      style={isToday ? { background: "linear-gradient(135deg,#16306e,#3f78d8)", boxShadow: "0 6px 14px -6px rgba(29,58,143,.6)" }
                        : n > 0 ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 6px 14px -8px rgba(124,58,237,.6)" }
                        : { background: "var(--panel)", color: "var(--ink-3)" }}>
                      <span style={n > 0 || isToday ? undefined : { color: "var(--ink-3)" }}>{n}</span>
                    </div>
                  </div>
                ); })}
              </div>
              <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">{t("p8wf.hlTeamOffEachDay")}</div>
              <CollapsibleStats id="holiday-overview">
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {cards.map((c) => (
                  <button key={c.label} type="button" onClick={() => setTab(c.tab)} title={t("p8wf.hlGoTo", { label: c.label })} className="text-start transition-transform hover:-translate-y-0.5">
                    <Tile label={c.label} icon={c.icon} grad={c.grad} value={String(c.value)} sub={c.sub} />
                  </button>
                ))}
              </div>
              </CollapsibleStats>
            </div>
          </Card>
        );
      })()}

      {/* tabs + add leave */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {([["requests", `${t("p8wf.hlTabRequests")}${pending.length ? ` (${pending.length})` : ""}`], ["off", t("p8wf.hlTabOff")], ["allowances", t("p8wf.hlTabAllow")], ["settings", t("p8wf.tsTabSettings")]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${tab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
          ))}
        </div>
        <Button variant="primary" className="ms-auto" onClick={() => setAdding(true)}>{t("p8wf.hlAddLeave")}</Button>
      </div>

      {/* ── REQUESTS ─────────────────────────────────────────────────────── */}
      {tab === "requests" && (
        <Card className="mt-4 p-0">
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8wf.hlPendingHdr", { n: pending.length })}</div>
          {pending.length === 0 ? <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">{t("p8wf.hlAllCaughtUp")}</div> : (
            <div className="divide-y divide-[var(--line)]">
              {pending.map((a) => {
                const km = KIND_META[a.kind]; const s = summaryOf(a.staffId); const cf = conflicts(a, absences);
                const after = round1(s.remaining - (a.kind === "annual" ? a.days : 0));
                const open = expanded.has(a.id);
                return (
                  <div key={a.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[16px]" style={{ background: km.tone + "1a" }}>{km.icon}</span>
                      <div className="min-w-[160px]">
                        <div className="text-[13.5px] font-extrabold text-[#1d3a8f]">{a.name}</div>
                        <div className="text-[12px] text-[var(--ink-2)]">{t(KIND_KEY[a.kind])}</div>
                        <div className="text-[12.5px] font-semibold text-[var(--ink)]">{fmtRange(a.start, a.end)}{a.half ? ` · ${t(a.half === "am" ? "p8wf.hlHalfAm" : "p8wf.hlHalfPm")}` : ""} <span className="font-normal text-[var(--ink-3)]">({pickPlural(t, locale, "p8wf.prDays", a.days)})</span>{a.paid === false && <span className="ms-1.5 rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9.5px] font-bold text-[#64748b] align-middle">{t("p8wf.hlUnpaidTag")}</span>}{a.kind === "sickness" && <span className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold align-middle ${a.ssp === "withheld" ? "bg-[#fdecec] text-[#c0392b]" : "bg-[#e6f4ea] text-[#0f7a43]"}`}>{t(a.ssp === "withheld" ? "p8wf.hlSspWithheld" : "p8wf.hlSspEligible")}</span>}</div>
                        {a.reason && <div className="mt-0.5 text-[11.5px] italic text-[var(--ink-3)]">“{a.reason}”</div>}
                      </div>
                      <div className="min-w-[190px] flex-1 rounded-xl bg-[#f2f7ff] p-2.5 text-[12px] text-[var(--ink-2)]">
                        {a.paid === false ? <Rich text={t("p8wf.hlUnpaidRolled")} /> : a.kind === "annual" ? <Rich text={t("p8wf.hlWillHave", { name: a.name.split(" ")[0], after, total: s.total })} /> : <Rich text={t("p8wf.hlNoAllowUse", { kind: t(KIND_KEY[a.kind]) })} />}
                        <div className="mt-1">{cf.length === 0 ? <span className="font-semibold text-[#0f7a43]">{t("p8wf.hlNoConflicts")}</span> : <button type="button" onClick={() => setExpanded((p) => { const n = new Set(p); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="font-bold text-[#b45309] hover:underline">{t(open ? "p8wf.hlHideConflicts" : "p8wf.hlShowConflicts", { n: cf.length })}</button>}</div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {cf.length > 0 ? <Button variant="primary" onClick={() => setExpanded((p) => new Set(p).add(a.id))}>{t("p8wf.hlReview")}</Button> : <Button variant="primary" onClick={() => { decide(a.id, "approved"); flash(t("p8wf.hlApprovedMsg", { name: a.name.split(" ")[0], kind: t(KIND_KEY[a.kind]).toLocaleLowerCase(dl()) })); }}>{t("p8wf.tsApproveBtn")}</Button>}
                        <Button onClick={() => setEdit(a)}>{t("p8wf.prEdit")}</Button>
                        <Button variant="danger" onClick={() => { const r = window.prompt(t("p8wf.hlDeclinePrompt", { name: a.name }), ""); if (r !== null) { decide(a.id, "declined", r || undefined); flash(t("p8wf.hlDeclinedMsg", { name: a.name.split(" ")[0] })); } }}>{t("p8wf.hlDecline")}</Button>
                      </div>
                    </div>
                    {open && cf.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[#f0d9b5] bg-[#fffaf0] p-3">
                        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#8a5a09]">{pickPlural(t, locale, "p8wf.hlConflictHdr", cf.length, { range: fmtRange(a.start, a.end) })}</div>
                        {cf.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 py-1 text-[12px]">
                            <span>{KIND_META[c.kind].icon}</span><span className="font-bold text-[var(--ink)]">{c.name}</span>
                            <span className="text-[var(--ink-3)]">{fmtRange(c.start, c.end)}</span>
                            <span className={`ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : "bg-[#fdf3e0] text-[#8a5a09]"}`}>{t(KIND_KEY[c.kind])} · {t(STATUS_KEY[c.status])}</span>
                          </div>
                        ))}
                        <div className="mt-2 flex gap-1.5"><Button variant="primary" onClick={() => { decide(a.id, "approved"); flash(t("p8wf.hlApprovedDespite", { n: cf.length })); }}>{t("p8wf.hlApproveAnyway")}</Button><Button variant="danger" onClick={() => { const r = window.prompt(t("p8wf.hlDeclineReasonPrompt"), t("p8wf.hlDefaultDeclineReason")); if (r !== null) decide(a.id, "declined", r || undefined); }}>{t("p8wf.hlDecline")}</Button></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── WHO'S OFF ────────────────────────────────────────────────────── */}
      {tab === "off" && (() => {
        const ws = mondayOf(anchor); const dates = Array.from({ length: 7 }, (_, i) => isoDate(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i)));
        const rostered = rosteredByDate(dates);
        const inWeek = absences.filter((a) => a.status === "approved" && a.start <= dates[6] && a.end >= dates[0]).sort((a, b) => (a.start < b.start ? -1 : 1));
        let coverCount = 0;
        return (
          <Card className="mt-4 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8wf.hlWhosOff")}</div>
              <div className="ms-auto flex items-center gap-1.5">
                <button type="button" onClick={() => setAnchor(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">{rtl ? "›" : "‹"}</button>
                <span className="min-w-[150px] text-center text-[12.5px] font-bold text-[var(--ink)]">{uiDate(new Date(`${dates[0]}T00:00:00`), { day: "numeric", month: "short" })} – {uiDate(new Date(`${dates[6]}T00:00:00`), { day: "numeric", month: "short" })}</span>
                <button type="button" onClick={() => setAnchor(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">{rtl ? "‹" : "›"}</button>
                <button type="button" onClick={() => setAnchor(new Date())} className="ms-1 text-[11px] font-bold text-[#1d3a8f] hover:underline">{t("p8wf.hlThisWeekBtn")}</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-1">
                  <div />
                  {dates.map((d) => { const bh = isBankHoliday(d, policy.region); return <div key={d} className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-bold ${bh ? "bg-[#eef4fd] text-[#1d3a8f]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{dayLabel(d)}{bh && <div className="text-[9px] font-semibold">{t("p8wf.hlBankHol")}</div>}</div>; })}
                </div>
                {inWeek.length === 0 ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8wf.hlNobodyOffWeek")}</div> : inWeek.map((a) => {
                  const km = KIND_META[a.kind];
                  return (
                    <div key={a.id} className="mt-1 grid grid-cols-[160px_repeat(7,1fr)] items-center gap-1">
                      <div className="truncate text-[12px] font-bold text-[var(--ink)]">{a.name} <span className="font-normal text-[var(--ink-3)]">{km.icon}</span></div>
                      {dates.map((d) => {
                        const on = a.start <= d && a.end >= d;
                        const needsCover = on && rostered[d]?.has(a.name.trim().toLowerCase());
                        if (needsCover) coverCount += 1;
                        return <div key={d} className="h-8 rounded-md" style={{ background: on ? km.tone + (needsCover ? "" : "33") : "transparent", outline: needsCover ? "2px solid #e21d27" : "none" }} title={needsCover ? t("p8wf.hlNeedsCoverTip", { name: a.name, day: d }) : on ? t("p8wf.hlOffTip", { name: a.name }) : ""}>{needsCover && <span className="grid h-full place-items-center text-[10px] font-black text-white">{t("p8wf.hlCover")}</span>}</div>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
              <span className="font-bold text-[var(--ink)]">{t("p8wf.hlOffThisWeekN", { n: inWeek.length })}</span>
              <span className={`font-bold ${coverCount ? "text-[#e21d27]" : "text-[#0f7a43]"}`}>{coverCount ? pickPlural(t, locale, "p8wf.hlCoverNeed", coverCount) : t("p8wf.hlNoClash")}</span>
              <span className="text-[var(--ink-3)]">{t("p8wf.hlRedNote")}</span>
            </div>
          </Card>
        );
      })()}

      {/* ── ALLOWANCES ───────────────────────────────────────────────────── */}
      {tab === "allowances" && (
        <Card className="mt-4 p-4">
          <div className="mb-3 text-[12px] text-[var(--ink-3)]"><Rich text={t("p8wf.hlStatIntro", { label: ly.label, max: policy.carryOverMax })} /></div>
          {/* bulk: set everyone's holiday-pay method at once */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8wf.hlSetEveryone")}</span>
            <button type="button" onClick={() => bulkMethod("accrued")} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">{t("p8wf.hlBooksPaid")}</button>
            <button type="button" onClick={() => bulkMethod("rolled-up")} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#8a5a09]">{t("p8wf.hlIncludedInPay")}</button>
            <span className="text-[11px] text-[var(--ink-3)]">{t("p8wf.hlIncludedHint")}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-start text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">{t("p8wf.prThEmployee")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.hlThDaysWk")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.prThBasis")}</th><th className="px-3 py-2.5 text-center font-extrabold">{t("p8wf.hlThHolPay")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.hlThAllowance")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.hlThCarried")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.hlThTaken")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.hlThBooked")}</th><th className="px-3 py-2.5 text-end font-extrabold">{t("p8wf.hlThRemaining")}</th><th className="px-3 py-2.5"></th></tr></thead>
            <tbody>{profiles.map((p) => { const s = summaryOf(p.id); const dpw = p.daysPerWeek ?? policy.daysPerWeek; const custom = p.allowanceDays != null || policy.allowanceBasis === "custom"; const pct = s.total > 0 ? Math.round(((s.takenAnnual + s.bookedAnnual) / s.total) * 100) : 0; const rolled = p.holidayPay === "rolled-up"; return (
              <tr key={p.id} className="border-t border-[var(--line-2,#eef2f8)]">
                <td className="px-3 py-2.5 font-bold text-[var(--ink)]">{p.name}<span className="ms-1 text-[10.5px] font-normal text-[var(--ink-3)]">{p.role}{p.op ? ` · ${p.op}` : ""}</span></td>
                <td className="px-3 py-2.5 text-center tabular-nums text-[var(--ink-2)]">{dpw}</td>
                <td className="px-3 py-2.5 text-center">{rolled ? <span className="text-[var(--ink-3)]">—</span> : custom ? <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">{t("p8wf.hlContractual")}</span> : <span className="rounded-full bg-[#eef7ee] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">{t("p8wf.hlStatutory")}</span>}</td>
                <td className="px-3 py-2.5 text-center"><button type="button" onClick={() => persistProfiles(profiles.map((x) => (x.id === p.id ? { ...x, holidayPay: rolled ? "accrued" : "rolled-up" } : x)))} title={t("p8wf.hlSwitchMethodTip")} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rolled ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"}`}>{rolled ? t("p8wf.hlInPayToggle") : t("p8wf.hlBooksToggle")}</button></td>
                {rolled ? <td colSpan={4} className="px-3 py-2.5 text-center text-[11.5px] font-semibold text-[#8a5a09]">{t("p8wf.hlPaidAsEarned")}</td> : <>
                  <td className="px-3 py-2.5 text-end font-bold tabular-nums text-[var(--ink)]">{s.allowance}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-[var(--ink-2)]">{s.carriedOver || "—"}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-[var(--ink-2)]">{s.takenAnnual}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-[var(--ink-2)]">{s.bookedAnnual}</td>
                </>}
                {rolled ? <td className="px-3 py-2.5 text-end text-[var(--ink-3)]">—</td> : <td className="px-3 py-2.5 text-end"><div className="font-extrabold tabular-nums text-[#0f7a43]">{s.remaining}</div><div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-[#e6ebf3]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${Math.min(100, pct)}%` }} /></div></td>}
                <td className="px-3 py-2.5 text-end"><button type="button" onClick={() => setProfEdit(p)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{t("p8wf.prEdit")}</button></td>
              </tr>
            ); })}</tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">{t("p8wf.hlPolicyTitle")}</div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlYearStarts")}</span>
                  <div className="flex gap-1.5"><Select value={policy.leaveYearStartMonth} onChange={(e) => persistPolicy({ ...policy, leaveYearStartMonth: Number(e.target.value) })} className="w-full">{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{uiDate(new Date(2000, m - 1, 1), { month: "long" })}</option>)}</Select>
                  <Input inputMode="numeric" value={String(policy.leaveYearStartDay)} onChange={(e) => persistPolicy({ ...policy, leaveYearStartDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })} className="w-16" /></div></label>
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlDefaultDays")}</span><Input inputMode="decimal" value={String(policy.daysPerWeek)} onChange={(e) => persistPolicy({ ...policy, daysPerWeek: Math.min(7, Math.max(1, parseFloat(e.target.value) || 5)) })} className="w-full" /></label>
              </div>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlStdAllowance")}</span>
                <Select value={policy.allowanceBasis} onChange={(e) => persistPolicy({ ...policy, allowanceBasis: e.target.value as HolidayPolicy["allowanceBasis"] })} className="w-full"><option value="statutory">{t("p8wf.hlOptStatutoryMin")}</option><option value="custom">{t("p8wf.hlOptCustomDays")}</option></Select></label>
              {policy.allowanceBasis === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlCustomAllow")}</span><Input inputMode="decimal" value={String(policy.customDays)} onChange={(e) => persistPolicy({ ...policy, customDays: parseFloat(e.target.value) || 28 })} className="w-full" /></label>}
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlCarryMax")}</span><Input inputMode="decimal" value={String(policy.carryOverMax)} onChange={(e) => persistPolicy({ ...policy, carryOverMax: parseFloat(e.target.value) || 0 })} className="w-full" /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlRegion")}</span><Select value={policy.region} onChange={(e) => persistPolicy({ ...policy, region: e.target.value as HolidayPolicy["region"] })} className="w-full"><option value="eng-wal">{t("p8wf.hlEngWales")}</option><option value="scotland">{t("p8wf.hlScotland")}</option><option value="ni">{t("p8wf.hlNIreland")}</option></Select></label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={policy.bankHolidaysExtra} onChange={(e) => persistPolicy({ ...policy, bankHolidaysExtra: e.target.checked })} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-semibold text-[var(--ink)]"><Rich text={t("p8wf.hlBankExtra")} /></span></label>

              {/* Sick pay */}
              <div className="border-t border-[var(--line)] pt-3">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.prSickPayLbl")}</span>
                  <Select value={policy.sickPay} onChange={(e) => persistPolicy({ ...policy, sickPay: e.target.value as HolidayPolicy["sickPay"] })} className="w-full"><option value="ssp">{t("p8wf.hlOptSspOnly")}</option><option value="enhanced">{t("p8wf.hlOptEnhanced")}</option></Select></label>
                {policy.sickPay === "enhanced" && <label className="mt-2 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlDaysFullPay")}</span><Input inputMode="numeric" value={String(policy.enhancedDays)} onChange={(e) => persistPolicy({ ...policy, enhancedDays: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full" /></label>}
                <div className="mt-2 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">{sickPayNote(t, locale, policy)}</div>
                {/* how much notice triggers SSP for a missed shift */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlSickReporting")}</span><Select value={policy.sickNotifyMode} onChange={(e) => persistPolicy({ ...policy, sickNotifyMode: e.target.value as HolidayPolicy["sickNotifyMode"] })} className="w-full"><option value="hours">{t("p8wf.hlOptHoursBefore")}</option><option value="time">{t("p8wf.hlOptByTime")}</option></Select></label>
                  {policy.sickNotifyMode === "hours"
                    ? <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlOptHoursBefore")}</span><Input inputMode="decimal" value={String(policy.sickNotifyHours)} onChange={(e) => persistPolicy({ ...policy, sickNotifyHours: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full" /></label>
                    : <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlNotifyBy")}</span><Input type="time" value={policy.sickNotifyTime} onChange={(e) => persistPolicy({ ...policy, sickNotifyTime: e.target.value || "09:00" })} className="w-full" /></label>}
                </div>
                <div className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-2)]"><Rich text={t("p8wf.hlSickRuleNote", { rule: sickRuleText(t, locale, policy) })} /></div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">{t("p8wf.hlLawTitle")}</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <li><Rich text={t("p8wf.hlLaw1")} /></li>
              <li><Rich text={t("p8wf.hlLaw2")} /></li>
              <li><Rich text={t("p8wf.hlLaw3", { list: [3, 4, 5].map((n) => `${n}d→${statutoryDays(n)}`).join(" · ") })} /></li>
              <li><Rich text={t("p8wf.hlLaw4", { ssp: SSP_WEEKLY.toFixed(2) })} /></li>
              <li><Rich text={t("p8wf.hlLaw5", { amt: sspWeekly(50).toFixed(2) })} /></li>
              <li className="text-[var(--ink-3)]">{t("p8wf.hlLaw6")}</li>
            </ul>
          </Card>
        </div>
      )}

      {edit && <AbsenceEditor abs={edit} region={policy.region} sickRule={sickRuleText(t, locale, policy)} profiles={profiles} policy={policy} absences={absences} onSave={(a) => { persistAbs(absences.map((x) => (x.id === a.id ? a : x))); setEdit(null); flash(t("p8wf.hlReqUpdated")); }} onClose={() => setEdit(null)} />}
      {adding && <AbsenceEditor abs={blankAbsence()} isNew region={policy.region} sickRule={sickRuleText(t, locale, policy)} profiles={profiles} policy={policy} absences={absences} onSave={addLeave} onClose={() => setAdding(false)} />}
      {profEdit && <ProfileEditor prof={profEdit} policy={policy} onSave={(p) => { persistProfiles(profiles.map((x) => (x.id === p.id ? p : x))); setProfEdit(null); flash(t("p8wf.hlEntSaved", { name: p.name.split(" ")[0] })); }} onClose={() => setProfEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function AbsenceEditor({ abs, region, sickRule, isNew, profiles, policy, absences, onSave, onClose }: { abs: Absence; region: HolidayPolicy["region"]; sickRule: string; isNew?: boolean; profiles?: LeaveProfile[]; policy?: HolidayPolicy; absences?: Absence[]; onSave: (a: Absence) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [a, setA] = useState<Absence>(abs);
  const single = a.start === a.end;
  const days = workingDays(a.start, a.end, { half: single ? a.half : null, region });
  const set = (patch: Partial<Absence>) => setA((x) => ({ ...x, ...patch }));
  const prof = (profiles || []).find((p) => p.id === a.staffId);
  const rolled = prof?.holidayPay === "rolled-up";
  const summary = policy && absences && prof && !rolled ? summarise(prof, policy, absences) : null;
  const first = (a.name || "They").split(" ")[0];
  // effective pay treatment: a manual override wins, else the default for the type
  const pay: PayTreatment = a.pay ?? defaultPayTreatment(a.kind, { rolled });
  const effAwe = a.awe != null ? a.awe : prof?.awe; // fall back to the profile's known AWE
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{isNew ? t("p8wf.hlAddLeave").replace(/^\+\s*/, "") : a.name}</h3><button type="button" onClick={onClose} className="ms-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          {isNew && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.prThEmployee")}</span><Select value={a.staffId} onChange={(e) => { const p = (profiles || []).find((x) => x.id === e.target.value); set({ staffId: e.target.value, name: p?.name || "" }); }} className="w-full"><option value="">{t("p8wf.hlChoosePerson")}</option>{(profiles || []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ""}</option>)}</Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlType")}</span><Select value={a.kind} onChange={(e) => set({ kind: e.target.value as AbsenceKind, pay: undefined })} className="w-full">{KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {t(KIND_KEY[k])}</option>)}</Select></label>
          {/* entitlement — so the manager sees what they've got before booking annual leave */}
          {a.staffId && (rolled
            ? <div className="rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]"><Rich text={t("p8wf.hlRolledBox", { first })} /></div>
            : summary && <div className="rounded-lg bg-[#eef7ee] px-3 py-2 text-[#0f7a43]">
                <div className="text-[11.5px] font-bold"><Rich text={`${t("p8wf.hlDaysLeft", { first, rem: summary.remaining, total: summary.total })}${a.kind === "annual" ? `${t("p8wf.hlAfterThis", { n: round1(summary.remaining - days) })}${summary.remaining - days < 0 ? t("p8wf.hlOverAllow") : ""}` : ""}`} /></div>
                <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] font-semibold text-[var(--ink-2)]"><span><Rich text={t("p8wf.hlChipTaken", { n: summary.takenAnnual })} /></span><span><Rich text={t("p8wf.hlChipBooked", { n: summary.bookedAnnual })} /></span><span><Rich text={t("p8wf.hlChipPending", { n: summary.pendingAnnual })} /></span>{summary.carriedOver > 0 && <span>{t("p8wf.hlChipCarried", { n: summary.carriedOver })}</span>}</div>
              </div>)}
          {/* pay treatment — how this type is paid, defaulted per type, overridable */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlPayForLeave")}</span><Select value={pay} onChange={(e) => set({ pay: e.target.value as PayTreatment })} className="w-full">{(["normal", "ssp", "statutory", "toil", "unpaid"] as PayTreatment[]).map((p) => <option key={p} value={p}>{payLabel(t, p)}</option>)}</Select></label>
            <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">{payNote(t, pay)}{a.pay == null ? t("p8wf.hlDefaultForType") : ""}</div>
          </div>
          {familyNote(t, a.kind) && <div className="rounded-lg bg-[#fdf1f7] px-3 py-2 text-[11px] leading-relaxed font-medium text-[#9d174d]">🍼 {familyNote(t, a.kind)}</div>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlFrom")}</span><Input type="date" value={a.start} onChange={(e) => set({ start: e.target.value, end: e.target.value > a.end ? e.target.value : a.end })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlTo")}</span><Input type="date" value={a.end} min={a.start} onChange={(e) => set({ end: e.target.value })} className="w-full" /></label>
          </div>
          {single && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlHalfDay")}</span><Select value={a.half || ""} onChange={(e) => set({ half: (e.target.value || null) as Absence["half"] })} className="w-full"><option value="">{t("p8wf.hlFullDay")}</option><option value="am">{t("p8wf.hlMorning")}</option><option value="pm">{t("p8wf.hlAfternoon")}</option></Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlReasonNote")}</span><Input value={a.reason || ""} onChange={(e) => set({ reason: e.target.value })} className="w-full" /></label>
          {a.kind === "sickness" && <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlSspLabel")}</span><Select value={a.ssp || "eligible"} onChange={(e) => set({ ssp: e.target.value as Absence["ssp"] })} className="w-full"><option value="eligible">{t("p8wf.hlSspEligibleOpt")}</option><option value="withheld">{t("p8wf.hlSspWithheldOpt")}</option></Select></label>
            <label className="mt-2 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlAwe")} <span className="normal-case text-[var(--ink-3)]">{t("p8wf.hlAweHint")}</span></span><Input inputMode="decimal" value={a.awe != null ? String(a.awe) : ""} placeholder={prof?.awe != null ? t("p8wf.hlAwePhFile", { awe: prof.awe }) : t("p8wf.hlAwePhWeek")} onChange={(e) => set({ awe: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
            {effAwe != null && effAwe >= 0 && <div className="mt-1.5 rounded-lg bg-[#eef4fd] px-2.5 py-1.5 text-[11px] font-semibold text-[#1d3a8f]"><Rich text={t("p8wf.hlSspWeekly", { ssp: sspWeekly(effAwe).toFixed(2), cap: SSP_WEEKLY.toFixed(2), awe: effAwe.toFixed(2), src: a.awe == null && prof?.awe != null ? t("p8wf.hlFromProfile") : "" })} /></div>}
            {prof?.sspUsedWeeks != null && prof.sspUsedWeeks > 0 && <div className="mt-1.5 rounded-lg bg-[#fdf3e0] px-2.5 py-1.5 text-[11px] font-semibold text-[#8a5a09]">{t("p8wf.hlSspWeeksUsed", { used: prof.sspUsedWeeks, left: Math.max(0, 28 - prof.sspUsedWeeks) })}</div>}
            <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]"><Rich text={t("p8wf.hlSspNote", { cap: SSP_WEEKLY.toFixed(2), rule: sickRule })} /></div>
          </div>}
          {isNew && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlStatus")}</span><Select value={a.status} onChange={(e) => set({ status: e.target.value as Absence["status"] })} className="w-full"><option value="approved">{t("p8wf.hlOptApprovedDirect")}</option><option value="pending">{t("p8wf.hlOptPendingApproval")}</option></Select></label>}
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">{pickPlural(t, locale, "p8wf.hlWorkingDays", days)}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" disabled={isNew && !a.staffId} onClick={() => onSave({ ...a, days, pay, paid: pay !== "unpaid", ...(a.kind === "sickness" && !a.ssp ? { ssp: "eligible" as const } : {}), ...(a.kind === "sickness" && a.awe == null && prof?.awe != null ? { awe: prof.awe } : {}) })}>{t("common.save")}</Button></div>
      </div>
    </div>
  );
}

function ProfileEditor({ prof, policy, onSave, onClose }: { prof: LeaveProfile; policy: HolidayPolicy; onSave: (p: LeaveProfile) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [p, setP] = useState<LeaveProfile>(prof);
  const stat = statutoryDays(p.daysPerWeek ?? policy.daysPerWeek);
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{p.name}</h3><span className="text-[12px] text-[var(--ink-3)]">{t("p8wf.hlEntitlementSuffix")}</span><button type="button" onClick={onClose} className="ms-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="mt-3 grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlHolPayMethod")}</span><Select value={p.holidayPay || "accrued"} onChange={(e) => setP({ ...p, holidayPay: e.target.value as LeaveProfile["holidayPay"] })} className="w-full"><option value="accrued">{t("p8wf.hlOptAccrued")}</option><option value="rolled-up">{t("p8wf.hlOptRolledUp")}</option></Select><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]"><Rich text={t("p8wf.hlRolledHelp")} /></span></label>
          {p.holidayPay === "rolled-up" ? <div className="rounded-lg bg-[#fdf3e0] px-3 py-2 text-[12px] font-semibold text-[#8a5a09]">{t("p8wf.hlRolledBoxProfile")}</div> : <>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlDaysWorkedWeek")}</span><Input inputMode="decimal" value={String(p.daysPerWeek ?? policy.daysPerWeek)} onChange={(e) => setP({ ...p, daysPerWeek: parseFloat(e.target.value) || undefined })} className="w-full" /><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]"><Rich text={t("p8wf.hlStatAtPattern", { n: stat })} /></span></label>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlAllowOverride")} <span className="normal-case text-[var(--ink-3)]">{t("p8wf.hlBlankStat", { n: stat })}</span></span><Input inputMode="decimal" value={p.allowanceDays != null ? String(p.allowanceDays) : ""} placeholder={String(stat)} onChange={(e) => setP({ ...p, allowanceDays: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8wf.hlCarriedOverDays")}</span><Input inputMode="decimal" value={String(p.carriedOver || 0)} onChange={(e) => setP({ ...p, carriedOver: parseFloat(e.target.value) || 0 })} className="w-full" /></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">{t("p8wf.hlFullAllow", { n: annualAllowance(p, policy), carried: p.carriedOver ? t("p8wf.hlPlusCarried", { n: p.carriedOver }) : "" })}</div>
          </>}
          {/* prior service / opening balances — for staff who already worked for you before being added here */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8wf.hlPriorSvc")}</div>
            <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">{t("p8wf.hlContService")} <span className="normal-case text-[var(--ink-3)]">{t("p8wf.hlContServiceHint")}</span></span><Input type="date" value={p.startDate || ""} onChange={(e) => setP({ ...p, startDate: e.target.value || undefined })} className="w-full" /></label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">{t("p8wf.hlAvgWeekly")}</span><Input inputMode="decimal" value={p.awe != null ? String(p.awe) : ""} placeholder={t("p8wf.hlForSsp")} onChange={(e) => setP({ ...p, awe: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
              <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">{t("p8wf.hlSspUsedWeeks")} <span className="normal-case text-[var(--ink-3)]">{t("p8wf.hlOf28")}</span></span><Input inputMode="decimal" value={p.sspUsedWeeks != null ? String(p.sspUsedWeeks) : ""} placeholder="0" onChange={(e) => setP({ ...p, sspUsedWeeks: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-[var(--ink-3)]"><Rich text={t("p8wf.hlPriorNote")} /></div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => onSave(p)}>{t("common.save")}</Button></div>
      </div>
    </div>
  );
}
