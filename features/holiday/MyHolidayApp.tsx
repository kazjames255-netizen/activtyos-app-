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

const ME = "Marcus Bell";
const ME_ID = slug(ME);
const KINDS: AbsenceKind[] = ["annual", "sickness", "toil", "unpaid", "other"];

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
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setProfiles(loadProfiles()); setAbsences(loadAbsences()); setPolicy(loadPolicy()); }, []);
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
    const abs: Absence = { id: crypto.randomUUID(), staffId: ME_ID, name: ME, status: "pending", requestedAt: new Date().toISOString(), ...a, paid: rolled ? false : true };
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
      <PageHero title="My holiday" icon="🏖" lede="Your holiday pay is included in your wages — you can still book time off, it's just unpaid on the day." actions={<Button variant="primary" onClick={() => setReqOpen(true)}>+ Book time off</Button>} />
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
      {reqOpen && <RequestModal region={policy.region} remaining={s.remaining} unpaid onSubmit={submit} onClose={() => setReqOpen(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );

  const counter = (kind: AbsenceKind, value: number) => { const km = KIND_META[kind]; return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: km.tone + "1a" }}>{km.icon}</span><div><div className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{value}</div><div className="text-[10.5px] font-semibold text-[var(--ink-3)]">{km.label}</div></div></div>
  ); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My holiday" icon="🏖" lede="Request time off, track what's left, and see your absence history. Approvals go to your manager." actions={<Button variant="primary" onClick={() => setReqOpen(true)}>+ Request time off</Button>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* summary */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">My summary</div><span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)]">Leave year {ly.label}</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counter("annual", s.takenAnnual + s.bookedAnnual)}
            {counter("sickness", s.byKind.sickness)}
            {counter("toil", s.byKind.toil)}
            {counter("other", otherDays)}
          </div>
          {s.pendingAnnual > 0 && <div className="mt-3 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[12px] font-semibold text-[#8a5a09]">⏳ {s.pendingAnnual} day{s.pendingAnnual === 1 ? "" : "s"} of annual leave awaiting approval.</div>}
        </Card>

        {/* allowance */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring value={s.remaining} total={s.total} label="left" />
            <div>
              <div className="text-[13px] text-[var(--ink-2)]"><b className="text-[15px] text-[var(--ink)]">{s.remaining} day{s.remaining === 1 ? "" : "s"}</b> remaining</div>
              <div className="text-[12.5px] text-[var(--ink-3)]"><b className="text-[var(--ink-2)]">{s.total} days</b> allowance</div>
              {s.carriedOver > 0 && <div className="text-[11.5px] text-[var(--ink-3)]">including {s.carriedOver} carried over</div>}
            </div>
          </div>
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Next up — public holiday</div>
            <div className="text-[13px] font-extrabold text-[#1d3a8f]">{nph ? `${nph.name} · ${new Date(`${nph.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}` : "—"}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">🤒 {s.byKind.sickness} sick day{s.byKind.sickness === 1 ? "" : "s"}</span>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">📜 Absence history</button>
          </div>
        </Card>
      </div>

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

function RequestModal({ region, remaining, unpaid, onSubmit, onClose }: { region: HolidayPolicy["region"]; remaining: number; unpaid?: boolean; onSubmit: (a: { kind: AbsenceKind; start: string; end: string; half: "am" | "pm" | null; reason?: string; days: number }) => void; onClose: () => void }) {
  const today = isoDate(new Date());
  const [kind, setKind] = useState<AbsenceKind>("annual");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [half, setHalf] = useState<"am" | "pm" | "">("");
  const [reason, setReason] = useState("");
  const single = start === end;
  const days = workingDays(start, end, { half: single ? (half || null) : null, region });
  const overBudget = !unpaid && kind === "annual" && days > remaining;
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{unpaid ? "Book time off" : "Request time off"}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        {unpaid && <div className="mb-3 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">💷 Your holiday pay is included in your wages (12.07% rolled-up), so these days are <b>unpaid</b> — you&rsquo;ve already been paid for them.</div>}
        <div className="grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Type</span><Select value={kind} onChange={(e) => setKind(e.target.value as AbsenceKind)} className="w-full">{KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">From</span><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">To</span><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="w-full" /></label>
          </div>
          {single && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Half day</span><Select value={half} onChange={(e) => setHalf(e.target.value as "am" | "pm" | "")} className="w-full"><option value="">Full day</option><option value="am">Morning (AM)</option><option value="pm">Afternoon (PM)</option></Select></label>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Reason (optional)</span><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family trip" className="w-full" /></label>
          <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold ${overBudget ? "bg-[#fdecec] text-[#c0392b]" : "bg-[#eef4fd] text-[#1d3a8f]"}`}>{days} working day{days === 1 ? "" : "s"}{unpaid ? " · unpaid (already in your pay)" : kind === "annual" ? ` · ${remaining} left before this` : ""}{overBudget ? " — more than your remaining allowance" : ""}</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={days <= 0} onClick={() => onSubmit({ kind, start, end, half: single ? (half || null) : null, reason: reason || undefined, days })}>Send request</Button></div>
      </div>
    </div>
  );
}
