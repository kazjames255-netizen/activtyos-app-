"use client";

// Staff-facing "My holiday" — request time off, watch your allowance, and see
// your absence history. Mirrors the manager planner's data (same demo store);
// in production this is scoped to the logged-in person server-side. Demo "me" =
// Marcus Bell, matching the other staff self-service areas.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type Absence, type AbsenceKind, type LeaveProfile, type HolidayPolicy,
  KIND_META, summarise, workingDays, fmtRange, isoDate, nextPublicHoliday, leaveYear,
} from "@/lib/holiday";
import { loadPolicy, loadProfiles, loadAbsences, saveAbsences, slug } from "./data";
import { loadClock, type ClockRecord, hhmm as clockHhmm, sinceLabel } from "@/features/timeclock/data";
import { useTenantSettings } from "@/lib/settings";

const ME = "Marcus Bell";
const ME_ROLE = "Camp Lead"; // demo role (per-user identity is Amir's)
const ME_ID = slug(ME);
const KINDS: AbsenceKind[] = ["annual", "sickness", "toil", "unpaid", "maternity", "adoption", "parental", "bereavement", "other"];

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
  const [profiles, setProfiles] = useState<LeaveProfile[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [policy, setPolicy] = useState<HolidayPolicy>(loadPolicy);
  const [reqOpen, setReqOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ovTab, setOvTab] = useState<"summary" | "status" | "clocked">("summary");
  const [clock, setClock] = useState<Record<string, ClockRecord>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { settings: tenantSettings } = useTenantSettings();
  useEffect(() => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); setClock(loadClock()); }, []);
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

  const submit = (a: Omit<Absence, "id" | "staffId" | "name" | "status" | "requestedAt" | "days"> & { days: number }) => {
    // only ANNUAL leave is unpaid-because-rolled-up; sickness is SSP-paid, etc.
    const paid = a.kind === "unpaid" ? false : rolled && a.kind === "annual" ? false : true;
    const abs: Absence = { id: crypto.randomUUID(), staffId: ME_ID, name: ME, status: "pending", requestedAt: new Date().toISOString(), ...a, paid, ...(a.kind === "sickness" ? { ssp: "eligible" as const } : {}) };
    persistAbs([abs, ...absences]); setReqOpen(false); flash("✅ Request sent to your manager.");
  };
  const cancel = (id: string) => { if (window.confirm("Cancel this request?")) persistAbs(absences.map((x) => (x.id === id ? { ...x, status: "cancelled" as const } : x))); };

  const historyRows = (
    <Card className="mt-4 p-0">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">My time off</div>
      {mine.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">No time off booked yet.</div> : (
        <div className="divide-y divide-[var(--line)]">{mine.map((a) => { const km = KIND_META[a.kind]; const tone = a.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : a.status === "pending" ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"; return (
          <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span>
            <div className="min-w-[150px]"><div className="text-[12.5px] font-bold text-[var(--ink)]">{km.label}{a.paid === false && <span className="ml-1.5 rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9.5px] font-bold text-[#64748b]">unpaid</span>}</div><div className="text-[11.5px] text-[var(--ink-3)]">{fmtRange(a.start, a.end)}{a.half ? ` · ${a.half}` : ""} · {a.days}d</div></div>
            {a.note && <div className="text-[11.5px] italic text-[var(--ink-3)]">“{a.note}”</div>}
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${tone}`}>{a.status}</span>
            {a.status === "pending" && <button type="button" onClick={() => cancel(a.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Cancel</button>}
          </div>
        ); })}</div>
      )}
    </Card>
  );

  if (rolled) return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My time off" icon="🏖" lede="Your holiday pay is included in your wages — you can still book time off, it's just unpaid on the day." actions={<Button variant="primary" onClick={() => setReqOpen(true)}>+ Book time off</Button>} />
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef4fd] text-[20px]">💷</div>
          <div>
            <div className="text-[14px] font-extrabold text-[var(--ink)]">Holiday pay is included in your wages</div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[var(--ink-2)]">You&rsquo;re paid your holiday as you earn it — an extra <b>12.07%</b> is added to every payslip as a separate <b>Holiday pay</b> line (see <b>My payslips</b>). You can still <b>book time off</b> whenever you need it — because it&rsquo;s already been paid, those days are <b>unpaid</b> at the time you take them.</p>
            {nph && <div className="mt-2 inline-block rounded-lg bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[#1d3a8f]">Next public holiday · {nph.name} · {new Date(`${nph.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}</div>}
          </div>
        </div>
      </Card>
      {historyRows}
      {reqOpen && <RequestModal region={policy.region} remaining={s.remaining} rolled onSubmit={submit} onClose={() => setReqOpen(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );

  const counter = (kind: AbsenceKind, value: number) => { const km = KIND_META[kind]; return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span><div><div className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{value}</div><div className="text-[10.5px] font-semibold text-[var(--ink-3)]">{km.label}</div></div></div>
  ); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My time off" icon="🏖" lede="Request time off, track what's left, and see your absence history. Approvals go to your manager." actions={<Button variant="primary" onClick={() => setReqOpen(true)}>+ Request time off</Button>} />

      {(() => {
        // BrightHR-style overview: a week strip (team absences per day) + tabs.
        const wk = new Date(); const dow = (wk.getDay() + 6) % 7; const mon = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() - dow);
        const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); return isoDate(d); });
        const today = isoDate(new Date());
        const teamOff = (iso: string) => absences.filter((a) => a.status === "approved" && a.start <= iso && a.end >= iso).length;
        const pendingCount = mine.filter((a) => a.status === "pending").length;
        const myClock = clock[ME_ID];
        const myStatus = myClock?.status === "in" ? "Clocked in" : myClock?.status === "break" ? "On break" : "Clocked out";
        // Who's-clocked-in visibility follows the provider's co-worker setting
        // (same as the schedule "Who's on" tab): all / same-listing / leads / off.
        const seeTeamAbsence = tenantSettings.scheduling?.staffSeeTeamAbsence ?? true;
        const vis = tenantSettings.scheduling?.coworkerVisibility ?? "all";
        const iAmLead = /lead|manager|owner/i.test(ME_ROLE);
        const teamVisible = vis !== "none" && (vis !== "leads" || iAmLead);
        const clockedAll = Object.values(clock).filter((r) => r.status === "in" || r.status === "break");
        const clockedIn = vis === "team" ? clockedAll.filter((r) => r.op && r.op === myClock?.op) : clockedAll;
        return (
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* ── Overview (left) ── */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">Overview</div>
            {pendingCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#f3c0bb] px-2.5 py-1 text-[11.5px] font-bold text-[#c0392b]">⚠ {pendingCount} pending {pendingCount === 1 ? "absence" : "absences"}</span>}
            <button type="button" onClick={() => setReqOpen(true)} className="ml-auto rounded-lg bg-[#e6007e] px-3 py-1.5 text-[12px] font-extrabold text-white hover:brightness-105">+ Add time off</button>
          </div>
          {/* week strip — team time-off, only if the provider lets staff see it */}
          {seeTeamAbsence && (<>
          <div className="grid grid-cols-7 gap-1.5">{week.map((iso) => { const n = teamOff(iso); const isToday = iso === today; const d = new Date(`${iso}T00:00:00`); return (
            <div key={iso} className="text-center">
              <div className={`text-[10.5px] font-bold ${isToday ? "text-[#1d3a8f]" : "text-[var(--ink-3)]"}`}>{d.toLocaleDateString("en-GB", { weekday: "short" })} {d.getDate()}</div>
              <div className={`mx-auto mt-1 grid h-11 w-11 place-items-center rounded-full text-[15px] font-extrabold tabular-nums ${isToday ? "bg-[#1d3a8f] text-white" : n > 0 ? "bg-[#eef4fd] text-[#1d3a8f] ring-1 ring-[#cfe0fb]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{n}</div>
            </div>
          ); })}</div>
          <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">Colleagues off each day this week</div>
          </>)}

          {/* tabs */}
          <div className="mt-3 flex gap-4 border-b border-[var(--line)] text-[12.5px] font-bold">
            {([["summary", "My summary"], ["status", "Working status"], ...(teamVisible ? [["clocked", `Who's clocked in? ${clockedIn.length}`] as [typeof ovTab, string]] : [])] as [typeof ovTab, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setOvTab(k)} className={`-mb-px border-b-2 pb-2 ${ovTab === k ? "border-[#1d3a8f] text-[#1d3a8f]" : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]"}`}>{l}</button>
            ))}
          </div>

          {ovTab === "summary" && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Ring value={s.takenAnnual + s.bookedAnnual + s.byKind.sickness + s.byKind.toil + otherDays} total={Math.max(1, s.total)} label="days off" />
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">{counter("annual", s.takenAnnual + s.bookedAnnual)}{counter("other", otherDays)}{counter("sickness", s.byKind.sickness)}{counter("toil", s.byKind.toil)}</div>
            </div>
          )}
          {ovTab === "status" && (
            <div className="mt-4"><div className="flex items-center gap-2 rounded-xl bg-[var(--panel)] p-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: myClock?.status === "in" ? "#12b76a" : myClock?.status === "break" ? "#f59e0b" : "#94a3b8" }} /><span className="text-[13px] font-bold text-[var(--ink)]">You&rsquo;re {myStatus}</span>{myClock?.clockInAt && myClock.status !== "out" && <span className="text-[12px] text-[var(--ink-3)]">since {clockHhmm(myClock.clockInAt)}</span>}<a href="schedule?tab=clock" className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clock in/out →</a></div></div>
          )}
          {ovTab === "clocked" && teamVisible && (
            <div className="mt-3 divide-y divide-[var(--line)]">{clockedIn.length === 0 ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nobody clocked in{vis === "team" ? " on your listings" : ""} right now.</div> : clockedIn.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 text-[12.5px]"><span className="h-2 w-2 rounded-full" style={{ background: r.status === "break" ? "#f59e0b" : "#12b76a" }} /><span className="font-bold text-[var(--ink)]">{r.name}</span>{r.op && <span className="text-[var(--ink-3)]">· {r.op}</span>}<span className="ml-auto text-[var(--ink-3)]">{r.status === "break" ? "on break" : sinceLabel(r.clockInAt)}</span></div>
            ))}</div>
          )}
        </Card>

        {/* ── My summary (right) ── */}
        <Card className="p-4">
          <div className="mb-3 text-[14px] font-extrabold text-[var(--ink)]">My summary</div>
          <button type="button" onClick={() => setReqOpen(true)} className="w-full rounded-lg bg-[#e6007e] px-4 py-2.5 text-[13.5px] font-extrabold text-white hover:brightness-105">Request time off</button>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="mt-2 w-full rounded-lg border border-[#e6007e] px-4 py-2.5 text-[13.5px] font-extrabold text-[#e6007e] hover:bg-[#fdeef6]">Absence history</button>
          <div className="mt-4 flex items-center gap-4 border-t border-[var(--line)] pt-4">
            <Ring value={s.remaining} total={s.total} label="left" />
            <div>
              <div className="text-[14px] font-extrabold text-[var(--ink)]">{s.remaining} day{s.remaining === 1 ? "" : "s"} <span className="font-semibold text-[var(--ink-3)]">remaining</span></div>
              <div className="text-[12.5px] font-bold text-[var(--ink-2)]">{s.total} days allowance</div>
              {s.carriedOver > 0 && <div className="text-[11.5px] text-[var(--ink-3)]">including {s.carriedOver} days carried over</div>}
            </div>
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="text-[11px] font-bold text-[var(--ink-3)]">Next up — public holiday</div>
            <div className="text-[13px] font-extrabold text-[#1d3a8f]">{nph ? `${nph.name} · ${new Date(`${nph.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}` : "—"}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-lg border border-[#f3c0bb] px-2.5 py-2 text-center text-[11.5px] font-bold text-[#c0392b]">🕒 {myClock?.lateMin ? 1 : 0} Lateness</span>
            <span className="flex-1 rounded-lg border border-[#f0d9b5] px-2.5 py-2 text-center text-[11.5px] font-bold text-[#8a5a09]">🤒 {s.byKind.sickness} Sickness</span>
          </div>
        </Card>
      </div>
        );
      })()}

      {/* history */}
      {showHistory && (
        <Card className="mt-4 p-0">
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Absence history</div>
          {mine.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">No absences yet.</div> : (
            <div className="divide-y divide-[var(--line)]">{mine.map((a) => { const km = KIND_META[a.kind]; const tone = a.status === "approved" ? "bg-[#e6f4ea] text-[#0f7a43]" : a.status === "pending" ? "bg-[#fdf3e0] text-[#8a5a09]" : "bg-[#eef1f6] text-[#64748b]"; return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span>
                <div className="min-w-[150px]"><div className="text-[12.5px] font-bold text-[var(--ink)]">{km.label}</div><div className="text-[11.5px] text-[var(--ink-3)]">{fmtRange(a.start, a.end)}{a.half ? ` · ${a.half}` : ""} · {a.days}d</div></div>
                {a.note && <div className="text-[11.5px] italic text-[var(--ink-3)]">“{a.note}”</div>}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${tone}`}>{a.status}</span>
                {a.status === "pending" && <button type="button" onClick={() => cancel(a.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Cancel</button>}
              </div>
            ); })}</div>
          )}
        </Card>
      )}

      {reqOpen && <RequestModal region={policy.region} remaining={s.remaining} onSubmit={submit} onClose={() => setReqOpen(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function RequestModal({ region, remaining, rolled, onSubmit, onClose }: { region: HolidayPolicy["region"]; remaining: number; rolled?: boolean; onSubmit: (a: { kind: AbsenceKind; start: string; end: string; half: "am" | "pm" | null; reason?: string; days: number }) => void; onClose: () => void }) {
  const today = isoDate(new Date());
  const [kind, setKind] = useState<AbsenceKind>("annual");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [half, setHalf] = useState<"am" | "pm" | "">("");
  const [reason, setReason] = useState("");
  const single = start === end;
  const days = workingDays(start, end, { half: single ? (half || null) : null, region });
  const rolledUnpaid = rolled && kind === "annual"; // holiday already paid via rolled-up
  const overBudget = !rolledUnpaid && kind === "annual" && days > remaining;
  // context note that depends on the type chosen
  // NB: we deliberately show NO sick-pay / SSP messaging to staff — sick pay only
  // ever surfaces on the payslip, so booking sickness never advertises an amount.
  const context = rolledUnpaid ? { tone: "bg-[#fdf3e0] text-[#8a5a09]", text: "💷 Your holiday pay is included in your wages (12.07% rolled-up), so these days are unpaid — you've already been paid for them." }
    : kind === "unpaid" ? { tone: "bg-[#eef1f6] text-[#64748b]", text: "◻️ Unpaid leave — no pay for these days." }
    : null;
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{rolled ? "Book time off" : "Request time off"}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Type</span><Select value={kind} onChange={(e) => setKind(e.target.value as AbsenceKind)} className="w-full">{KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">From</span><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">To</span><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="w-full" /></label>
          </div>
          {single && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Half day</span><Select value={half} onChange={(e) => setHalf(e.target.value as "am" | "pm" | "")} className="w-full"><option value="">Full day</option><option value="am">Morning (AM)</option><option value="pm">Afternoon (PM)</option></Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Reason (optional)</span><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family trip" className="w-full" /></label>
          {context && <div className={`rounded-lg px-3 py-2 text-[11.5px] font-semibold ${context.tone}`}>{context.text}</div>}
          <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold ${overBudget ? "bg-[#fdecec] text-[#c0392b]" : "bg-[#eef4fd] text-[#1d3a8f]"}`}>{days} working day{days === 1 ? "" : "s"}{rolledUnpaid ? " · unpaid (already in your pay)" : kind === "annual" ? ` · ${remaining} left before this` : ""}{overBudget ? " — more than your remaining allowance" : ""}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={days <= 0} onClick={() => onSubmit({ kind, start, end, half: single ? (half || null) : null, reason: reason || undefined, days })}>Send request</Button></div>
      </div>
    </div>
  );
}
