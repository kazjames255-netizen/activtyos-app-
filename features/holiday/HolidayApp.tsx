"use client";

// Holiday & absence planner — operator/manager side. Approve or decline time-off
// requests (with allowance-impact + clash detection), see who's off and who
// needs covering, manage each person's entitlement, and set the leave-year
// policy. Statutory entitlement is computed to UK law (see lib/holiday.ts).
// Demo store; backend + real notifications are Amir's (docs/holiday-planner-handoff.md).
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";
import {
  type Absence, type AbsenceKind, type LeaveProfile, type HolidayPolicy,
  KIND_META, summarise, conflicts, annualAllowance, statutoryDays, leaveYear,
  workingDays, fmtRange, isoDate, round1, isBankHoliday, sickPayNote, sickNotifyRuleText, sspWeekly, SSP_WEEKLY,
  type PayTreatment, defaultPayTreatment, PAY_TREATMENT, familyLeaveNote,
} from "@/lib/holiday";
import { loadPolicy, savePolicy, loadProfiles, saveProfiles, loadAbsences, saveAbsences } from "./data";

const KINDS = Object.keys(KIND_META) as AbsenceKind[];
const mondayOf = (d: Date) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

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
  useEffect(() => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const persistAbs = (a: Absence[]) => { setAbsences(a); saveAbsences(a); };
  const persistProfiles = (p: LeaveProfile[]) => { setProfiles(p); saveProfiles(p); };
  const persistPolicy = (p: HolidayPolicy) => { setPolicy(p); savePolicy(p); };

  const profileOf = (id: string) => profiles.find((p) => p.id === id) || { id, name: id } as LeaveProfile;
  const summaryOf = (id: string) => summarise(profileOf(id), policy, absences);
  const decide = (id: string, status: Absence["status"], note?: string) => { persistAbs(absences.map((x) => (x.id === id ? { ...x, status, decidedBy: "You", decidedAt: new Date().toISOString(), note } : x))); };
  const bulkMethod = (m: "accrued" | "rolled-up") => { persistProfiles(profiles.map((p) => ({ ...p, holidayPay: m }))); flash(m === "rolled-up" ? "Everyone set to holiday included in pay (12.07%)." : "Everyone set to booking paid leave."); };
  const blankAbsence = (): Absence => ({ id: "", staffId: "", name: "", kind: "annual", start: isoDate(new Date()), end: isoDate(new Date()), half: null, days: 0, status: "approved", requestedAt: new Date().toISOString(), decidedBy: "You" });
  const addLeave = (x: Absence) => { persistAbs([{ ...x, id: crypto.randomUUID() }, ...absences]); setAdding(false); flash(`Leave added for ${(x.name || "").split(" ")[0]}.`); };

  const pending = absences.filter((a) => a.status === "pending").sort((a, b) => (a.start < b.start ? -1 : 1));
  const ly = leaveYear(policy);
  const offToday = useMemo(() => { const t = isoDate(new Date()); return absences.filter((a) => a.status === "approved" && a.start <= t && a.end >= t); }, [absences]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Leave & absence" icon="🏖" lede="Approve time off, manage sickness & SSP, see who's off and who needs covering, track everyone's entitlement, and keep the rota in step. Follows UK law (5.6 weeks holiday capped at 28 days; SSP from day 1)." />

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
          { icon: "📋", value: pending.length, label: "Pending requests", sub: pending.length ? "awaiting you" : "all decided", grad: pending.length ? GRAD.pink : GRAD.green, tab: "requests" },
          { icon: "🌴", value: offToday.length, label: "Off today", sub: offToday.length ? offToday.map((a) => a.name.split(" ")[0]).join(", ") : "everyone in", grad: GRAD.teal, tab: "off" },
          { icon: "🗓️", value: offThisWeek, label: "Off this week", sub: "booked leave", grad: GRAD.violet, tab: "off" },
          { icon: "👥", value: profiles.length, label: "Team", sub: "people tracked", grad: GRAD.blue, tab: "allowances" },
        ];
        return (
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline gap-2 px-4 py-3" style={{ background: "linear-gradient(120deg,#16306e,#274ba3)" }}>
              <div className="text-[15px] font-extrabold text-white">☀️ This week</div>
              <span className="text-[11.5px] font-semibold text-white/70">{ly.label} leave year</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((iso) => { const n = teamOff(iso); const isToday = iso === today; const d = new Date(`${iso}T00:00:00`); return (
                  <div key={iso} className="text-center">
                    <div className={`text-[10.5px] font-bold ${isToday ? "text-[#1d3a8f]" : "text-[var(--ink-3)]"}`}>{d.toLocaleDateString("en-GB", { weekday: "short" })} {d.getDate()}</div>
                    <div className="mx-auto mt-1 grid h-11 w-11 place-items-center rounded-full text-[15px] font-extrabold tabular-nums text-white"
                      style={isToday ? { background: "linear-gradient(135deg,#16306e,#3f78d8)", boxShadow: "0 6px 14px -6px rgba(29,58,143,.6)" }
                        : n > 0 ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 6px 14px -8px rgba(124,58,237,.6)" }
                        : { background: "var(--panel)", color: "var(--ink-3)" }}>
                      <span style={n > 0 || isToday ? undefined : { color: "var(--ink-3)" }}>{n}</span>
                    </div>
                  </div>
                ); })}
              </div>
              <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">Team members off each day this week</div>
              <CollapsibleStats id="holiday-overview">
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {cards.map((c) => (
                  <button key={c.label} type="button" onClick={() => setTab(c.tab)} title={`Go to ${c.label}`} className="text-left transition-transform hover:-translate-y-0.5">
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
          {([["requests", `📋 Requests${pending.length ? ` (${pending.length})` : ""}`], ["off", "🗓 Who's off"], ["allowances", "📊 Allowances"], ["settings", "⚙️ Settings"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${tab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
          ))}
        </div>
        <Button variant="primary" className="ml-auto" onClick={() => setAdding(true)}>+ Add leave</Button>
      </div>

      {/* ── REQUESTS ─────────────────────────────────────────────────────── */}
      {tab === "requests" && (
        <Card className="mt-4 p-0">
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Pending requests ({pending.length})</div>
          {pending.length === 0 ? <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">🎉 No requests waiting — you're all caught up.</div> : (
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
                        <div className="text-[12px] text-[var(--ink-2)]">{km.label}</div>
                        <div className="text-[12.5px] font-semibold text-[var(--ink)]">{fmtRange(a.start, a.end)}{a.half ? ` · ${a.half} half-day` : ""} <span className="font-normal text-[var(--ink-3)]">({a.days} day{a.days === 1 ? "" : "s"})</span>{a.paid === false && <span className="ml-1.5 rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9.5px] font-bold text-[#64748b] align-middle">unpaid</span>}{a.kind === "sickness" && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold align-middle ${a.ssp === "withheld" ? "bg-[#fdecec] text-[#c0392b]" : "bg-[#e6f4ea] text-[#0f7a43]"}`}>SSP {a.ssp === "withheld" ? "withheld" : "eligible"}</span>}</div>
                        {a.reason && <div className="mt-0.5 text-[11.5px] italic text-[var(--ink-3)]">“{a.reason}”</div>}
                      </div>
                      <div className="min-w-[190px] flex-1 rounded-xl bg-[#f2f7ff] p-2.5 text-[12px] text-[var(--ink-2)]">
                        {a.paid === false ? <><b>Unpaid</b> — holiday is included in their pay (12.07% rolled-up), so no allowance is used</> : a.kind === "annual" ? <><b>{a.name.split(" ")[0]}</b> will have <b>{after} / {s.total} days</b> left once approved</> : <><b>{km.label}</b> — doesn&rsquo;t use annual-leave allowance</>}
                        <div className="mt-1">{cf.length === 0 ? <span className="font-semibold text-[#0f7a43]">✓ No conflicts</span> : <button type="button" onClick={() => setExpanded((p) => { const n = new Set(p); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="font-bold text-[#b45309] hover:underline">🚩 {open ? "Hide" : "Show"} conflicts ({cf.length})</button>}</div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {cf.length > 0 ? <Button variant="primary" onClick={() => setExpanded((p) => new Set(p).add(a.id))}>Review</Button> : <Button variant="primary" onClick={() => { decide(a.id, "approved"); flash(`✅ Approved ${a.name.split(" ")[0]}'s ${km.label.toLowerCase()}.`); }}>Approve</Button>}
                        <Button onClick={() => setEdit(a)}>Edit</Button>
                        <Button variant="danger" onClick={() => { const r = window.prompt(`Decline ${a.name}'s request — reason (optional):`, ""); if (r !== null) { decide(a.id, "declined", r || undefined); flash(`Declined ${a.name.split(" ")[0]}'s request.`); } }}>Decline</Button>
                      </div>
                    </div>
                    {open && cf.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[#f0d9b5] bg-[#fffaf0] p-3">
                        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#8a5a09]">{cf.length} conflicting absence{cf.length === 1 ? "" : "s"} · {fmtRange(a.start, a.end)}</div>
                        {cf.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 py-1 text-[12px]">
                            <span>{KIND_META[c.kind].icon}</span><span className="font-bold text-[var(--ink)]">{c.name}</span>
                            <span className="text-[var(--ink-3)]">{fmtRange(c.start, c.end)}</span>
                            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : "bg-[#fdf3e0] text-[#8a5a09]"}`}>{KIND_META[c.kind].label} · {c.status}</span>
                          </div>
                        ))}
                        <div className="mt-2 flex gap-1.5"><Button variant="primary" onClick={() => { decide(a.id, "approved"); flash(`Approved despite ${cf.length} clash.`); }}>Approve anyway</Button><Button variant="danger" onClick={() => { const r = window.prompt("Decline — reason:", "Team already short-staffed"); if (r !== null) decide(a.id, "declined", r || undefined); }}>Decline</Button></div>
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
              <div className="text-[14px] font-extrabold text-[var(--ink)]">Who&rsquo;s off</div>
              <div className="ml-auto flex items-center gap-1.5">
                <button type="button" onClick={() => setAnchor(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">‹</button>
                <span className="min-w-[150px] text-center text-[12.5px] font-bold text-[var(--ink)]">{new Date(`${dates[0]}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(`${dates[6]}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <button type="button" onClick={() => setAnchor(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">›</button>
                <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 text-[11px] font-bold text-[#1d3a8f] hover:underline">This week</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-1">
                  <div />
                  {dates.map((d) => { const bh = isBankHoliday(d, policy.region); return <div key={d} className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-bold ${bh ? "bg-[#eef4fd] text-[#1d3a8f]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{dayLabel(d)}{bh && <div className="text-[9px] font-semibold">bank hol</div>}</div>; })}
                </div>
                {inWeek.length === 0 ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">Nobody booked off this week.</div> : inWeek.map((a) => {
                  const km = KIND_META[a.kind];
                  return (
                    <div key={a.id} className="mt-1 grid grid-cols-[160px_repeat(7,1fr)] items-center gap-1">
                      <div className="truncate text-[12px] font-bold text-[var(--ink)]">{a.name} <span className="font-normal text-[var(--ink-3)]">{km.icon}</span></div>
                      {dates.map((d) => {
                        const on = a.start <= d && a.end >= d;
                        const needsCover = on && rostered[d]?.has(a.name.trim().toLowerCase());
                        if (needsCover) coverCount += 1;
                        return <div key={d} className="h-8 rounded-md" style={{ background: on ? km.tone + (needsCover ? "" : "33") : "transparent", outline: needsCover ? "2px solid #e21d27" : "none" }} title={needsCover ? `${a.name} is rostered on ${d} — needs covering` : on ? `${a.name} off` : ""}>{needsCover && <span className="grid h-full place-items-center text-[10px] font-black text-white">COVER</span>}</div>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
              <span className="font-bold text-[var(--ink)]">{inWeek.length} off this week</span>
              <span className={`font-bold ${coverCount ? "text-[#e21d27]" : "text-[#0f7a43]"}`}>{coverCount ? `⚠ ${coverCount} rostered shift${coverCount === 1 ? "" : "s"} need covering` : "✓ No clashes with the rota"}</span>
              <span className="text-[var(--ink-3)]">Red = the person is both off and on the rota that day (open the Schedule to reassign).</span>
            </div>
          </Card>
        );
      })()}

      {/* ── ALLOWANCES ───────────────────────────────────────────────────── */}
      {tab === "allowances" && (
        <Card className="mt-4 p-4">
          <div className="mb-3 text-[12px] text-[var(--ink-3)]">Statutory entitlement is <b>5.6 weeks × days worked/week, capped at 28 days</b> ({ly.label}). Set a higher contractual allowance or a part-time pattern per person; carry-over is capped at {policy.carryOverMax} days.</div>
          {/* bulk: set everyone's holiday-pay method at once */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Set everyone&rsquo;s holiday pay</span>
            <button type="button" onClick={() => bulkMethod("accrued")} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">📅 Books paid leave</button>
            <button type="button" onClick={() => bulkMethod("rolled-up")} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#8a5a09]">💷 Included in pay (12.07%)</button>
            <span className="text-[11px] text-[var(--ink-3)]">Included-in-pay suits casual / seasonal hourly staff. You can still override any one person on their row.</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-center font-extrabold">Days/wk</th><th className="px-3 py-2.5 text-center font-extrabold">Basis</th><th className="px-3 py-2.5 text-center font-extrabold">Holiday pay</th><th className="px-3 py-2.5 text-right font-extrabold">Allowance</th><th className="px-3 py-2.5 text-right font-extrabold">Carried</th><th className="px-3 py-2.5 text-right font-extrabold">Taken</th><th className="px-3 py-2.5 text-right font-extrabold">Booked</th><th className="px-3 py-2.5 text-right font-extrabold">Remaining</th><th className="px-3 py-2.5"></th></tr></thead>
            <tbody>{profiles.map((p) => { const s = summaryOf(p.id); const dpw = p.daysPerWeek ?? policy.daysPerWeek; const custom = p.allowanceDays != null || policy.allowanceBasis === "custom"; const pct = s.total > 0 ? Math.round(((s.takenAnnual + s.bookedAnnual) / s.total) * 100) : 0; const rolled = p.holidayPay === "rolled-up"; return (
              <tr key={p.id} className="border-t border-[var(--line-2,#eef2f8)]">
                <td className="px-3 py-2.5 font-bold text-[var(--ink)]">{p.name}<span className="ml-1 text-[10.5px] font-normal text-[var(--ink-3)]">{p.role}{p.op ? ` · ${p.op}` : ""}</span></td>
                <td className="px-3 py-2.5 text-center tabular-nums text-[var(--ink-2)]">{dpw}</td>
                <td className="px-3 py-2.5 text-center">{rolled ? <span className="text-[var(--ink-3)]">—</span> : custom ? <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">Contractual</span> : <span className="rounded-full bg-[#eef7ee] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">Statutory</span>}</td>
                <td className="px-3 py-2.5 text-center"><button type="button" onClick={() => persistProfiles(profiles.map((x) => (x.id === p.id ? { ...x, holidayPay: rolled ? "accrued" : "rolled-up" } : x)))} title="Switch between booking paid leave and holiday included in pay (rolled-up 12.07%)" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rolled ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"}`}>{rolled ? "In pay 12.07% ⇄" : "Books leave ⇄"}</button></td>
                {rolled ? <td colSpan={4} className="px-3 py-2.5 text-center text-[11.5px] font-semibold text-[#8a5a09]">Holiday paid as earned — 12.07% added to each payslip</td> : <>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[var(--ink)]">{s.allowance}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink-2)]">{s.carriedOver || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink-2)]">{s.takenAnnual}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink-2)]">{s.bookedAnnual}</td>
                </>}
                {rolled ? <td className="px-3 py-2.5 text-right text-[var(--ink-3)]">—</td> : <td className="px-3 py-2.5 text-right"><div className="font-extrabold tabular-nums text-[#0f7a43]">{s.remaining}</div><div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-[#e6ebf3]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${Math.min(100, pct)}%` }} /></div></td>}
                <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setProfEdit(p)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Edit</button></td>
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
            <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">Leave policy</div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Leave year starts</span>
                  <div className="flex gap-1.5"><Select value={policy.leaveYearStartMonth} onChange={(e) => persistPolicy({ ...policy, leaveYearStartMonth: Number(e.target.value) })} className="w-full">{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString("en-GB", { month: "long" })}</option>)}</Select>
                  <Input inputMode="numeric" value={String(policy.leaveYearStartDay)} onChange={(e) => persistPolicy({ ...policy, leaveYearStartDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })} className="w-16" /></div></label>
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Default days / week</span><Input inputMode="decimal" value={String(policy.daysPerWeek)} onChange={(e) => persistPolicy({ ...policy, daysPerWeek: Math.min(7, Math.max(1, parseFloat(e.target.value) || 5)) })} className="w-full" /></label>
              </div>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Standard allowance</span>
                <Select value={policy.allowanceBasis} onChange={(e) => persistPolicy({ ...policy, allowanceBasis: e.target.value as HolidayPolicy["allowanceBasis"] })} className="w-full"><option value="statutory">Statutory minimum (5.6 weeks, capped 28)</option><option value="custom">Custom — set days below</option></Select></label>
              {policy.allowanceBasis === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Custom allowance (days/year)</span><Input inputMode="decimal" value={String(policy.customDays)} onChange={(e) => persistPolicy({ ...policy, customDays: parseFloat(e.target.value) || 28 })} className="w-full" /></label>}
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Carry-over max (days)</span><Input inputMode="decimal" value={String(policy.carryOverMax)} onChange={(e) => persistPolicy({ ...policy, carryOverMax: parseFloat(e.target.value) || 0 })} className="w-full" /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Bank-holiday region</span><Select value={policy.region} onChange={(e) => persistPolicy({ ...policy, region: e.target.value as HolidayPolicy["region"] })} className="w-full"><option value="eng-wal">England &amp; Wales</option><option value="scotland">Scotland</option><option value="ni">Northern Ireland</option></Select></label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={policy.bankHolidaysExtra} onChange={(e) => persistPolicy({ ...policy, bankHolidaysExtra: e.target.checked })} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-semibold text-[var(--ink)]">Bank holidays are given <b>on top</b> of the allowance</span></label>

              {/* Sick pay */}
              <div className="border-t border-[var(--line)] pt-3">
                <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Sick pay</span>
                  <Select value={policy.sickPay} onChange={(e) => persistPolicy({ ...policy, sickPay: e.target.value as HolidayPolicy["sickPay"] })} className="w-full"><option value="ssp">Statutory Sick Pay only (the legal minimum)</option><option value="enhanced">Company sick pay — full pay first, then SSP</option></Select></label>
                {policy.sickPay === "enhanced" && <label className="mt-2 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Days on full pay before SSP</span><Input inputMode="numeric" value={String(policy.enhancedDays)} onChange={(e) => persistPolicy({ ...policy, enhancedDays: Math.max(0, parseInt(e.target.value) || 0) })} className="w-full" /></label>}
                <div className="mt-2 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">{sickPayNote(policy)}</div>
                {/* how much notice triggers SSP for a missed shift */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Sickness reporting</span><Select value={policy.sickNotifyMode} onChange={(e) => persistPolicy({ ...policy, sickNotifyMode: e.target.value as HolidayPolicy["sickNotifyMode"] })} className="w-full"><option value="hours">Hours before shift</option><option value="time">By a time on the day</option></Select></label>
                  {policy.sickNotifyMode === "hours"
                    ? <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Hours before shift</span><Input inputMode="decimal" value={String(policy.sickNotifyHours)} onChange={(e) => persistPolicy({ ...policy, sickNotifyHours: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full" /></label>
                    : <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Notify by (time)</span><Input type="time" value={policy.sickNotifyTime} onChange={(e) => persistPolicy({ ...policy, sickNotifyTime: e.target.value || "09:00" })} className="w-full" /></label>}
                </div>
                <div className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-2)]">Staff must report sickness <b>{sickNotifyRuleText(policy)}</b>. Reported in time → SSP applies. Reported late → you can withhold SSP for those days (override on each sickness record). SSP is only owed for <b>shifts they were rota&rsquo;d to work</b>.</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">📖 The law, in short</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <li>• <b>Hourly &amp; casual staff still get holiday</b> — being paid by the hour does <b>not</b> remove it. You can&rsquo;t switch it off; you can only pay it as rolled-up 12.07% (still paid) or as booked days.</li>
              <li>• Almost all workers get <b>5.6 weeks&rsquo; paid holiday a year</b> — a 5-day week = <b>28 days</b>, capped at 28.</li>
              <li>• <b>Part-time</b> is pro-rata (days/week × 5.6): {[3, 4, 5].map((n) => `${n}d→${statutoryDays(n)}`).join(" · ")}. <b>Irregular / part-year</b> staff accrue <b>12.07%</b> of hours worked.</li>
              <li>• <b>Sick pay:</b> since <b>April 2026</b> Statutory Sick Pay is payable from <b>day 1</b> to <b>all employees</b> (earnings threshold &amp; 3 waiting days abolished) — the <b>lower of £{SSP_WEEKLY.toFixed(2)}/week or 80% of average weekly earnings over the last 8 weeks</b>.</li>
              <li>• That 8-week average is your protection with casuals: a coach who did <b>one £400 week</b> then 7 empty weeks has an AWE of ~£50, so SSP ≈ <b>£{sspWeekly(50).toFixed(2)}/week</b> — not £400. SSP is owed only for <b>rota&rsquo;d</b> shifts, never future ones.</li>
              <li className="text-[var(--ink-3)]">Bank-holiday dates are England &amp; Wales; Scotland/NI differ. Estimate for planning, not legal advice.</li>
            </ul>
          </Card>
        </div>
      )}

      {edit && <AbsenceEditor abs={edit} region={policy.region} sickRule={sickNotifyRuleText(policy)} profiles={profiles} policy={policy} absences={absences} onSave={(a) => { persistAbs(absences.map((x) => (x.id === a.id ? a : x))); setEdit(null); flash("Request updated."); }} onClose={() => setEdit(null)} />}
      {adding && <AbsenceEditor abs={blankAbsence()} isNew region={policy.region} sickRule={sickNotifyRuleText(policy)} profiles={profiles} policy={policy} absences={absences} onSave={addLeave} onClose={() => setAdding(false)} />}
      {profEdit && <ProfileEditor prof={profEdit} policy={policy} onSave={(p) => { persistProfiles(profiles.map((x) => (x.id === p.id ? p : x))); setProfEdit(null); flash(`${p.name.split(" ")[0]}'s entitlement saved.`); }} onClose={() => setProfEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function AbsenceEditor({ abs, region, sickRule, isNew, profiles, policy, absences, onSave, onClose }: { abs: Absence; region: HolidayPolicy["region"]; sickRule: string; isNew?: boolean; profiles?: LeaveProfile[]; policy?: HolidayPolicy; absences?: Absence[]; onSave: (a: Absence) => void; onClose: () => void }) {
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
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{isNew ? "Add leave" : a.name}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          {isNew && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Employee</span><Select value={a.staffId} onChange={(e) => { const p = (profiles || []).find((x) => x.id === e.target.value); set({ staffId: e.target.value, name: p?.name || "" }); }} className="w-full"><option value="">Choose a person…</option>{(profiles || []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ""}</option>)}</Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Type</span><Select value={a.kind} onChange={(e) => set({ kind: e.target.value as AbsenceKind, pay: undefined })} className="w-full">{KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>)}</Select></label>
          {/* entitlement — so the manager sees what they've got before booking annual leave */}
          {a.staffId && (rolled
            ? <div className="rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">💷 {first}&rsquo;s holiday is <b>included in their pay</b> (12.07% rolled-up) — no bookable allowance.</div>
            : summary && <div className="rounded-lg bg-[#eef7ee] px-3 py-2 text-[#0f7a43]">
                <div className="text-[11.5px] font-bold">{first} · <b>{summary.remaining} of {summary.total}</b> holiday days left{a.kind === "annual" ? <> → <b>{round1(summary.remaining - days)}</b> after this{summary.remaining - days < 0 ? " ⚠ over allowance" : ""}</> : ""}</div>
                <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] font-semibold text-[var(--ink-2)]"><span>Taken <b>{summary.takenAnnual}</b></span><span>Booked <b>{summary.bookedAnnual}</b></span><span>Pending <b>{summary.pendingAnnual}</b></span>{summary.carriedOver > 0 && <span>incl. {summary.carriedOver} carried</span>}</div>
              </div>)}
          {/* pay treatment — how this type is paid, defaulted per type, overridable */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Pay for this leave</span><Select value={pay} onChange={(e) => set({ pay: e.target.value as PayTreatment })} className="w-full">{(["normal", "ssp", "statutory", "toil", "unpaid"] as PayTreatment[]).map((t) => <option key={t} value={t}>{PAY_TREATMENT[t].label}</option>)}</Select></label>
            <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">{PAY_TREATMENT[pay].note}{a.pay == null ? " (default for this type — change if needed)" : ""}</div>
          </div>
          {familyLeaveNote(a.kind) && <div className="rounded-lg bg-[#fdf1f7] px-3 py-2 text-[11px] leading-relaxed font-medium text-[#9d174d]">🍼 {familyLeaveNote(a.kind)}</div>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">From</span><Input type="date" value={a.start} onChange={(e) => set({ start: e.target.value, end: e.target.value > a.end ? e.target.value : a.end })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">To</span><Input type="date" value={a.end} min={a.start} onChange={(e) => set({ end: e.target.value })} className="w-full" /></label>
          </div>
          {single && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Half day</span><Select value={a.half || ""} onChange={(e) => set({ half: (e.target.value || null) as Absence["half"] })} className="w-full"><option value="">Full day</option><option value="am">Morning (AM)</option><option value="pm">Afternoon (PM)</option></Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Reason / note</span><Input value={a.reason || ""} onChange={(e) => set({ reason: e.target.value })} className="w-full" /></label>
          {a.kind === "sickness" && <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Statutory Sick Pay</span><Select value={a.ssp || "eligible"} onChange={(e) => set({ ssp: e.target.value as Absence["ssp"] })} className="w-full"><option value="eligible">Eligible — reported in time</option><option value="withheld">Withheld — reported late</option></Select></label>
            <label className="mt-2 block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Average weekly earnings <span className="normal-case text-[var(--ink-3)]">(their last 8 weeks ÷ 8)</span></span><Input inputMode="decimal" value={a.awe != null ? String(a.awe) : ""} placeholder={prof?.awe != null ? `£${prof.awe} on file` : "£ per week"} onChange={(e) => set({ awe: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
            {effAwe != null && effAwe >= 0 && <div className="mt-1.5 rounded-lg bg-[#eef4fd] px-2.5 py-1.5 text-[11px] font-semibold text-[#1d3a8f]">Weekly SSP ≈ <b>£{sspWeekly(effAwe).toFixed(2)}</b> — the lower of £{SSP_WEEKLY.toFixed(2)} and 80% of £{effAwe.toFixed(2)}. Split across the shifts they were due that week.{a.awe == null && prof?.awe != null ? " (from their profile)" : ""}</div>}
            {prof?.sspUsedWeeks != null && prof.sspUsedWeeks > 0 && <div className="mt-1.5 rounded-lg bg-[#fdf3e0] px-2.5 py-1.5 text-[11px] font-semibold text-[#8a5a09]">⏳ {prof.sspUsedWeeks} of 28 SSP weeks already used — {Math.max(0, 28 - prof.sspUsedWeeks)} left before SSP stops (issue SSP1).</div>}
            <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">SSP is <b>not</b> based on the shift they missed — it&rsquo;s 80% of their <b>8-week average</b> (weeks they earned £0 dilute it), capped at £{SSP_WEEKLY.toFixed(2)}. Only owed for <b>rota&rsquo;d</b> shifts; report rule: <b>{sickRule}</b>.</div>
          </div>}
          {isNew && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Status</span><Select value={a.status} onChange={(e) => set({ status: e.target.value as Absence["status"] })} className="w-full"><option value="approved">Approved (add directly)</option><option value="pending">Pending (needs approval)</option></Select></label>}
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">{days} working day{days === 1 ? "" : "s"} (weekends &amp; bank holidays excluded)</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={isNew && !a.staffId} onClick={() => onSave({ ...a, days, pay, paid: pay !== "unpaid", ...(a.kind === "sickness" && !a.ssp ? { ssp: "eligible" as const } : {}), ...(a.kind === "sickness" && a.awe == null && prof?.awe != null ? { awe: prof.awe } : {}) })}>Save</Button></div>
      </div>
    </div>
  );
}

function ProfileEditor({ prof, policy, onSave, onClose }: { prof: LeaveProfile; policy: HolidayPolicy; onSave: (p: LeaveProfile) => void; onClose: () => void }) {
  const [p, setP] = useState<LeaveProfile>(prof);
  const stat = statutoryDays(p.daysPerWeek ?? policy.daysPerWeek);
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{p.name}</h3><span className="text-[12px] text-[var(--ink-3)]">· entitlement</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="mt-3 grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Holiday pay method</span><Select value={p.holidayPay || "accrued"} onChange={(e) => setP({ ...p, holidayPay: e.target.value as LeaveProfile["holidayPay"] })} className="w-full"><option value="accrued">Accrued — books paid time off</option><option value="rolled-up">Included in pay — rolled-up 12.07%</option></Select><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Use <b>Included in pay</b> for irregular / part-year (seasonal) staff: they won&rsquo;t see the request-holiday flow, and payroll adds a separate 12.07% Holiday pay line to every payslip.</span></label>
          {p.holidayPay === "rolled-up" ? <div className="rounded-lg bg-[#fdf3e0] px-3 py-2 text-[12px] font-semibold text-[#8a5a09]">Holiday is paid as they earn it — no bookable allowance to set.</div> : <>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Days worked / week</span><Input inputMode="decimal" value={String(p.daysPerWeek ?? policy.daysPerWeek)} onChange={(e) => setP({ ...p, daysPerWeek: parseFloat(e.target.value) || undefined })} className="w-full" /><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Statutory at this pattern: <b>{stat} days</b></span></label>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Allowance override (days/year) <span className="normal-case text-[var(--ink-3)]">— blank = statutory {stat}</span></span><Input inputMode="decimal" value={p.allowanceDays != null ? String(p.allowanceDays) : ""} placeholder={String(stat)} onChange={(e) => setP({ ...p, allowanceDays: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Carried over (days)</span><Input inputMode="decimal" value={String(p.carriedOver || 0)} onChange={(e) => setP({ ...p, carriedOver: parseFloat(e.target.value) || 0 })} className="w-full" /></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">Full allowance: {annualAllowance(p, policy)} days{p.carriedOver ? ` + ${p.carriedOver} carried` : ""}</div>
          </>}
          {/* prior service / opening balances — for staff who already worked for you before being added here */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Prior service &amp; opening balances</div>
            <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Continuous service start <span className="normal-case text-[var(--ink-3)]">(first day they ever worked for you)</span></span><Input type="date" value={p.startDate || ""} onChange={(e) => setP({ ...p, startDate: e.target.value || undefined })} className="w-full" /></label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Avg weekly earnings £</span><Input inputMode="decimal" value={p.awe != null ? String(p.awe) : ""} placeholder="for SSP" onChange={(e) => setP({ ...p, awe: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
              <label className="block"><span className="mb-1 block text-[10.5px] font-bold uppercase text-[var(--ink-3)]">SSP weeks used <span className="normal-case text-[var(--ink-3)]">(of 28)</span></span><Input inputMode="decimal" value={p.sspUsedWeeks != null ? String(p.sspUsedWeeks) : ""} placeholder="0" onChange={(e) => setP({ ...p, sspUsedWeeks: e.target.value.trim() === "" ? undefined : parseFloat(e.target.value) })} className="w-full" /></label>
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-[var(--ink-3)]">Added someone who already worked for you? Set their <b>real start date</b> (drives accrual + maternity eligibility), <b>average weekly earnings</b> (so sick pay isn&rsquo;t worked out from £0 of in-system history), and any <b>SSP weeks already used</b> of the 28-week max — otherwise the system treats them as a brand-new hire.</div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(p)}>Save</Button></div>
      </div>
    </div>
  );
}
