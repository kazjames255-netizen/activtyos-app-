"use client";

import { useState } from "react";

// ── Sales CRM (front-end only for now) ──────────────────────────────────────
// Runs on a localStorage demo store so it fully works and demos; the data model
// below maps 1:1 to the backend Amir will build (see docs/sales-crm-handoff.md).
// No rep logins yet — one HQ view.

type Stage = "new" | "contacted" | "demo" | "trial" | "won" | "lost";
type Source = "cold_call" | "email" | "social" | "referral" | "event" | "inbound";
interface Activity { id: string; type: "call" | "email" | "social" | "demo" | "note"; note: string; outcome?: string; at: string; by: string }
interface Lead {
  id: string; business: string; contactName: string; email: string; phone: string; location: string;
  source: Source; owner: string; plan: "freelancer" | "company" | "franchise"; estMrr: number;
  stage: Stage; lostReason?: string; notes: string; activities: Activity[]; createdAt: string; updatedAt: string;
}

// 5 clear steps left→right (a fresh Lead → a New customer who's signed up), plus
// Lost held separately at the end. When a signup matches a lead's email/phone/
// business, the backend auto-moves it to "New customer" (see sales-crm-handoff).
const STAGES: { id: Stage; label: string; color: string; prob: number }[] = [
  { id: "new", label: "1 · Lead", color: "#6b6880", prob: 0.1 },
  { id: "contacted", label: "2 · Contacted", color: "#3f78d8", prob: 0.25 },
  { id: "demo", label: "3 · Demo", color: "#7c3aed", prob: 0.5 },
  { id: "trial", label: "4 · Trial", color: "#a5670a", prob: 0.8 },
  { id: "won", label: "5 · New customer 🎉", color: "#0f7a43", prob: 1 },
  { id: "lost", label: "Lost", color: "#c02636", prob: 0 },
];
const stageOf = (id: Stage) => STAGES.find((s) => s.id === id) ?? STAGES[0];
const VALID_STAGES = new Set(STAGES.map((s) => s.id));
const SOURCES: { id: Source; label: string }[] = [
  { id: "cold_call", label: "📞 Cold call" }, { id: "email", label: "✉️ Email" }, { id: "social", label: "📱 Social" },
  { id: "referral", label: "🤝 Referral" }, { id: "event", label: "🎟️ Event" }, { id: "inbound", label: "🌐 Inbound" },
];
const srcLabel = (s: Source) => SOURCES.find((x) => x.id === s)?.label ?? s;
const ACT: { id: Activity["type"]; label: string }[] = [
  { id: "call", label: "📞 Call" }, { id: "email", label: "✉️ Email" }, { id: "social", label: "📱 Social" }, { id: "demo", label: "🎥 Demo" }, { id: "note", label: "📝 Note" },
];
const PLAN_MRR: Record<Lead["plan"], number> = { freelancer: 29, company: 69, franchise: 86 };
const OUTCOMES = ["Interested", "Booked a demo", "Sent info / pricing", "Call back later", "No answer", "Left voicemail", "Wants to think", "Not interested", "Wrong contact", "Signed up 🎉"];
const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const money = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const uid = () => { try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.round(Math.random() * 1e6)}`; } };
const nowIso = () => new Date().toISOString();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const KEY = "aos.sales.leads.v2";
const loadLeads = (): Lead[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const saveLeads = (l: Lead[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ } };

const SEED: Lead[] = [
  seed("Riverdale Rugby Camps", "Tom Hale", "tom@riverdale.example", "07700 900111", "Leeds", "cold_call", "Priya", "company", "contacted", "Keen, wants multi-venue.", [["call", "Intro call — interested", "Booking demo"], ["email", "Sent pricing", ""]]),
  seed("Little Kickers North", "Sara Reyes", "sara@lkn.example", "0161 555 0199", "Manchester", "referral", "Priya", "franchise", "demo", "Franchise of 4 sites.", [["demo", "Demo booked Fri", ""]]),
  seed("Bounce Gymnastics", "Dan Cole", "dan@bounce.example", "07700 900222", "Bristol", "social", "Jamie", "freelancer", "contacted", "DM'd on Insta.", [["social", "Replied on Instagram", "Sent link"]]),
  seed("Spark Drama School", "Mia Fox", "mia@spark.example", "0113 400 7788", "Leeds", "email", "Jamie", "company", "new", "", []),
  seed("Aqua Tots Swim", "Owen Pratt", "owen@aquatots.example", "0151 700 4455", "Liverpool", "cold_call", "Priya", "company", "trial", "On free trial, likes it.", [["call", "Onboarding help", "Happy"]]),
  seed("Summit Climbing Kids", "Ella Bond", "ella@summit.example", "07700 900333", "Sheffield", "event", "Jamie", "freelancer", "won", "Signed up!", [["demo", "Demo went great", "Won"]]),
  seed("Melody Music Minis", "Raj Shah", "raj@melody.example", "0121 500 6677", "Birmingham", "inbound", "Priya", "freelancer", "lost", "Went with a competitor.", [["email", "Followed up twice", "No response"]]),
  seed("Champions Football", "Kate Lynn", "kate@champions.example", "07700 900444", "Newcastle", "cold_call", "Jamie", "company", "new", "", []),
];
function seed(business: string, contactName: string, email: string, phone: string, location: string, source: Source, owner: string, plan: Lead["plan"], stage: Stage, notes: string, acts: [Activity["type"], string, string][]): Lead {
  const createdAt = new Date(Date.now() - Math.round(Math.random() * 40) * 86400000).toISOString();
  return { id: uid(), business, contactName, email, phone, location, source, owner, plan, estMrr: PLAN_MRR[plan], stage, notes, createdAt, updatedAt: createdAt, activities: acts.map(([type, note, outcome]) => ({ id: uid(), type, note, outcome, at: createdAt, by: owner })) };
}

export function SalesApp() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = loadLeads();
    if (!raw.length) { saveLeads(SEED); return SEED; }
    // Migrate any leads saved with a stage that no longer exists (e.g. old
    // "interested") so nothing crashes on stageOf().
    const fixed = raw.map((l) => (VALID_STAGES.has(l.stage) ? l : { ...l, stage: "new" as Stage }));
    if (fixed.some((l, i) => l !== raw[i])) saveLeads(fixed);
    return fixed;
  });
  const [tab, setTab] = useState<"pipeline" | "dashboard">("pipeline");
  const [detail, setDetail] = useState<Lead | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState<string | null>(null);

  const persist = (next: Lead[]) => { setLeads(next); saveLeads(next); };
  const upsert = (lead: Lead) => persist(leads.some((x) => x.id === lead.id) ? leads.map((x) => (x.id === lead.id ? lead : x)) : [{ ...lead }, ...leads]);
  const remove = (id: string) => { persist(leads.filter((x) => x.id !== id)); setDetail(null); };
  const move = (id: string, stage: Stage) => persist(leads.map((x) => (x.id === id ? { ...x, stage, updatedAt: nowIso() } : x)));

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ background: HERO }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Platform · Head office</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>💼 Sales pipeline</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-snug text-white/85">Track every prospect from first touch to paying provider — outreach, demos, and who&rsquo;s converting.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/12 p-1 text-[12px] font-bold">
              {([["pipeline", "Pipeline"], ["dashboard", "Dashboard"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTab(v)} className="rounded-full px-3 py-1 transition-colors" style={tab === v ? { background: "#fff", color: "#1d3a8f" } : { color: "rgba(255,255,255,.8)" }}>{l}</button>
              ))}
            </div>
            <button type="button" onClick={() => setImporting(true)} className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-white/20">⬆ Import CSV</button>
            <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#ffd23f] px-4 py-2 text-[12.5px] font-extrabold text-[#3a2a00] hover:brightness-105">+ Add lead</button>
          </div>
        </div>
      </div>

      {tab === "pipeline" ? (() => {
        const q = query.trim().toLowerCase();
        const qDigits = q.replace(/\D/g, "");
        const filtered = !q ? leads : leads.filter((l) => {
          const hay = `${l.business} ${l.contactName} ${l.email} ${l.location} ${l.owner}`.toLowerCase();
          const phoneMatch = qDigits.length >= 3 && l.phone.replace(/\D/g, "").includes(qDigits);
          return hay.includes(q) || phoneMatch;
        });
        return (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Find a lead — name, email or phone (e.g. an inbound caller)" className="w-full max-w-[440px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
              {q && <span className="text-[12px] text-[var(--ink-3)]">{filtered.length} match{filtered.length === 1 ? "" : "es"} · <button type="button" onClick={() => setQuery("")} className="font-bold text-[#1d3a8f]">clear</button></span>}
              {q && filtered.length === 0 && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#0f7a43] px-3 py-1.5 text-[12px] font-bold text-white">+ New lead (not found)</button>}
            </div>
            <Pipeline leads={filtered} onOpen={setDetail} onMove={move} drag={drag} setDrag={setDrag} />
          </>
        );
      })() : <Dashboard leads={leads} />}

      {(detail || adding) && (
        <LeadModal
          lead={detail}
          onClose={() => { setDetail(null); setAdding(false); }}
          onSave={(l) => { upsert(l); setDetail(null); setAdding(false); }}
          onDelete={detail ? () => remove(detail.id) : undefined}
        />
      )}
      {importing && <ImportModal existing={leads} onClose={() => setImporting(false)} onImport={(next) => { persist([...next, ...leads]); setImporting(false); }} />}
    </div>
  );
}

// ── Pipeline (kanban) ───────────────────────────────────────────────────────
function Pipeline({ leads, onOpen, onMove, drag, setDrag }: { leads: Lead[]; onOpen: (l: Lead) => void; onMove: (id: string, s: Stage) => void; drag: string | null; setDrag: (id: string | null) => void }) {
  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((st) => {
        const items = leads.filter((l) => l.stage === st.id);
        const sum = items.reduce((a, b) => a + b.estMrr, 0);
        return (
          <div key={st.id} className="flex w-[230px] shrink-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, st.id); setDrag(null); }}>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{st.label}</span>
              <span className="text-[10.5px] font-bold text-[var(--ink-3)]">{items.length} · {money(sum)}</span>
            </div>
            <div className="flex min-h-[80px] flex-col gap-2 p-2">
              {items.map((l) => (
                <div key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(l)}
                  className="cursor-pointer rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[0_1px_2px_rgba(16,24,40,.05)] hover:border-[var(--ink-3)]">
                  <div className="truncate text-[12.5px] font-extrabold">{l.business}</div>
                  <div className="truncate text-[11px] text-[var(--ink-3)]">{l.contactName} · {l.location}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                    <span className="text-[var(--ink-3)]">{srcLabel(l.source).split(" ")[0]}{l.owner ? ` · ${l.owner}` : ""}</span>
                    <span className="rounded-full bg-[#eaf0fc] px-1.5 py-0.5 font-bold capitalize text-[#1d3a8f]">{l.plan}</span>
                  </div>
                  {l.activities[0] && <div className="mt-1 truncate text-[10px] text-[var(--ink-3)]">{fmtDay(l.activities[0].at)}: {l.activities[0].note}</div>}
                </div>
              ))}
              {items.length === 0 && <div className="py-3 text-center text-[10.5px] text-[var(--ink-3)]">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
const PERIODS: [string, string][] = [["today", "Today"], ["5d", "5 days"], ["week", "Last week"], ["month", "Last month"], ["3m", "3 months"], ["6m", "6 months"], ["9m", "9 months"]];
const PERIOD_DAYS: Record<string, number> = { "5d": 5, week: 7, month: 30, "3m": 90, "6m": 180, "9m": 270 };

function Dashboard({ leads }: { leads: Lead[] }) {
  const [now] = useState(() => Date.now()); // captured once — pure during render
  const [period, setPeriod] = useState("month");
  const DAY = 86_400_000;
  const midnight = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const cutoff = period === "today" ? midnight : now - (PERIOD_DAYS[period] ?? 30) * DAY;
  const within = (iso: string) => new Date(iso).getTime() >= cutoff;
  const pLabel = (PERIODS.find((p) => p[0] === period)?.[1] ?? "").toLowerCase();

  // Now-snapshots (live pipeline — not time-bound).
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const pipeline = open.reduce((a, b) => a + b.estMrr, 0);
  const forecast = open.reduce((a, b) => a + b.estMrr * stageOf(b.stage).prob, 0);
  const funnelMax = Math.max(1, ...STAGES.filter((s) => s.id !== "lost").map((s) => leads.filter((l) => l.stage === s.id).length));

  // Period-filtered figures.
  const newLeads = leads.filter((l) => within(l.createdAt));
  const wonP = leads.filter((l) => l.stage === "won" && within(l.updatedAt));
  const lostP = leads.filter((l) => l.stage === "lost" && within(l.updatedAt));
  const wonMrr = wonP.reduce((a, b) => a + b.estMrr, 0);
  const winRate = wonP.length + lostP.length ? wonP.length / (wonP.length + lostP.length) : 0;
  const activities = leads.flatMap((l) => l.activities.map((a) => ({ ...a, business: l.business }))).filter((a) => within(a.at)).sort((a, b) => (a.at < b.at ? 1 : -1));
  const byType: Record<string, number> = {}; for (const a of activities) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const byRep: Record<string, number> = {}; for (const a of activities) byRep[a.by] = (byRep[a.by] ?? 0) + 1;
  const bySource = (() => { const m: Record<string, number> = {}; for (const l of newLeads) m[l.source] = (m[l.source] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); })();
  const bySourceMax = Math.max(1, ...bySource.map((s) => s[1]));

  // This window vs the equal window before it.
  const len = now - cutoff;
  const winMetrics = (from: number, to: number) => {
    const inW = (iso: string) => { const t = new Date(iso).getTime(); return t >= from && t < to; };
    const a = leads.flatMap((l) => l.activities).filter((x) => inW(x.at));
    return {
      newLeads: leads.filter((l) => inW(l.createdAt)).length,
      contacted: a.filter((x) => x.type === "call" || x.type === "email" || x.type === "social").length,
      demos: a.filter((x) => x.type === "demo").length,
      trials: leads.filter((l) => l.stage === "trial" && inW(l.updatedAt)).length,
      won: leads.filter((l) => l.stage === "won" && inW(l.updatedAt)).length,
    };
  };
  const cur = winMetrics(cutoff, now);
  const prev = winMetrics(cutoff - len, cutoff);
  const COMPARE: [string, keyof typeof cur][] = [["New leads", "newLeads"], ["Contacted", "contacted"], ["Demos", "demos"], ["Trials", "trials"], ["New customers", "won"]];

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-[var(--ink-3)]">Show:</span>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
          {PERIODS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPeriod(id)} className="rounded-full px-3 py-1 transition-colors" style={period === id ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Open pipeline · now" value={money(pipeline)} sub={`${open.length} live leads`} accent="#1d3a8f" />
        <Tile label="Weighted forecast · now" value={money(forecast)} sub="pipeline × stage odds" accent="#7c3aed" />
        <Tile label={`New customers · ${pLabel}`} value={String(wonP.length)} sub={`${money(wonMrr)}/mo won · ${Math.round(winRate * 100)}% win`} accent="#0f7a43" />
        <Tile label={`Activity · ${pLabel}`} value={String(activities.length)} sub={`${byType.call ?? 0} calls · ${byType.email ?? 0} emails · ${byType.demo ?? 0} demos`} accent="#f0b100" />
      </div>

      <div className="mt-4">
        <Card title={`This ${pLabel} vs the previous ${pLabel}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]"><th className="pb-2">Metric</th><th className="pb-2 text-right">Previous</th><th className="pb-2 text-right">This {pLabel}</th><th className="pb-2 text-right">Change</th></tr></thead>
              <tbody>
                {COMPARE.map(([label, key]) => {
                  const c = cur[key], p = prev[key], delta = c - p;
                  const col = delta > 0 ? "#0f7a43" : delta < 0 ? "#c02636" : "var(--ink-3)";
                  return (
                    <tr key={key} className="border-t border-[var(--line)]">
                      <td className="py-2 font-semibold">{label}</td>
                      <td className="py-2 text-right tabular-nums text-[var(--ink-3)]">{p}</td>
                      <td className="py-2 text-right text-[15px] font-extrabold tabular-nums">{c}</td>
                      <td className="py-2 text-right font-bold tabular-nums" style={{ color: col }}>{delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : "• "}{delta === 0 ? "0" : Math.abs(delta)}{p > 0 ? ` (${delta >= 0 ? "+" : "−"}${Math.round((Math.abs(delta) / p) * 100)}%)` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Pipeline funnel">
          <div className="flex flex-col gap-2">
            {STAGES.filter((s) => s.id !== "lost").map((st) => {
              const items = leads.filter((l) => l.stage === st.id);
              const sum = items.reduce((a, b) => a + b.estMrr, 0);
              return (
                <div key={st.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px]"><span className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{st.label}</span><span className="text-[var(--ink-3)]">{items.length} · {money(sum)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(items.length / funnelMax) * 100}%`, background: st.color }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={`New leads by source · ${pLabel}`}>
          {bySource.length ? (
            <div className="flex flex-col gap-2.5">
              {bySource.map(([src, n]) => (
                <div key={src}>
                  <div className="mb-1 flex items-center justify-between text-[12px]"><span className="font-semibold">{srcLabel(src as Source)}</span><span className="text-[var(--ink-3)]">{n} lead{n === 1 ? "" : "s"}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(n / bySourceMax) * 100}%`, background: "#3f78d8" }} /></div>
                </div>
              ))}
            </div>
          ) : <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">No new leads in this period.</div>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Rep activity · ${pLabel}`}>
          {Object.keys(byRep).length ? (
            <div className="flex flex-col divide-y divide-[var(--line)]">
              {Object.entries(byRep).sort((a, b) => b[1] - a[1]).map(([rep, n]) => (
                <div key={rep} className="flex items-center justify-between py-2 text-[12.5px]"><span className="font-semibold">{rep}</span><span className="font-extrabold tabular-nums">{n} touches</span></div>
              ))}
            </div>
          ) : <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">No activity in this period.</div>}
        </Card>
        <Card title={`Recent activity · ${pLabel}`}>
          <div className="flex flex-col divide-y divide-[var(--line)]">
            {activities.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 py-2 text-[12px]">
                <span>{ACT.find((x) => x.id === a.type)?.label.split(" ")[0]}</span>
                <div className="min-w-0 flex-1"><span className="font-semibold">{a.business}</span> <span className="text-[var(--ink-3)]">— {a.note}{a.outcome ? ` (${a.outcome})` : ""}</span></div>
                <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]">{fmtDay(a.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Lead modal (add / edit / activity) ──────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete }: { lead: Lead | null; onClose: () => void; onSave: (l: Lead) => void; onDelete?: () => void }) {
  const [f, setF] = useState<Lead>(() => lead ?? {
    id: uid(), business: "", contactName: "", email: "", phone: "", location: "", source: "cold_call", owner: "", plan: "company", estMrr: PLAN_MRR.company, stage: "new", notes: "", activities: [], createdAt: nowIso(), updatedAt: nowIso(),
  });
  const [act, setAct] = useState<{ type: Activity["type"]; note: string; outcome: string }>({ type: "call", note: "", outcome: "" });
  const set = (patch: Partial<Lead>) => setF((x) => ({ ...x, ...patch }));
  const fld = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
  const lbl = "text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]";
  const logActivity = () => { if (!act.note.trim()) return; set({ activities: [{ id: uid(), type: act.type, note: act.note.trim(), outcome: act.outcome.trim() || undefined, at: nowIso(), by: f.owner || "—" }, ...f.activities], updatedAt: nowIso() }); setAct({ type: "call", note: "", outcome: "" }); };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-[min(640px,96vw)] rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 rounded-t-2xl px-5 py-3.5 text-white" style={{ background: HERO }}>
          <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{lead ? f.business || "Lead" : "New lead"}</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">✕ Close</button>
        </div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className={lbl}>Business</span><input className={fld} value={f.business} onChange={(e) => set({ business: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Contact name</span><input className={fld} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Location</span><input className={fld} value={f.location} onChange={(e) => set({ location: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Email</span><input className={fld} value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Phone</span><input className={fld} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Source</span><select className={fld} value={f.source} onChange={(e) => set({ source: e.target.value as Source })}>{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="block"><span className={lbl}>Owner (rep)</span><input className={fld} value={f.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="e.g. Priya" /></label>
            <label className="block"><span className={lbl}>Likely plan</span><select className={fld} value={f.plan} onChange={(e) => set({ plan: e.target.value as Lead["plan"], estMrr: PLAN_MRR[e.target.value as Lead["plan"]] })}>{(["freelancer", "company", "franchise"] as const).map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</select></label>
            <label className="block"><span className={lbl}>Stage</span><select className={fld} value={f.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="block sm:col-span-2"><span className={lbl}>Notes</span><textarea rows={2} className={`${fld} resize-y`} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          </div>

          {/* Activity log */}
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#1d3a8f]">Activity — log a touch</div>
            <div className="flex flex-wrap gap-2">
              <select className={`${fld} w-auto`} value={act.type} onChange={(e) => setAct({ ...act, type: e.target.value as Activity["type"] })}>{ACT.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              <input className={`${fld} min-w-[120px] flex-1`} placeholder="What happened" value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} />
              <input className={`${fld} w-[170px]`} list="sales-outcomes" placeholder="Outcome — pick or type" value={act.outcome} onChange={(e) => setAct({ ...act, outcome: e.target.value })} />
              <datalist id="sales-outcomes">{OUTCOMES.map((o) => <option key={o} value={o} />)}</datalist>
              <button type="button" onClick={logActivity} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-bold text-white">Log</button>
            </div>
            {f.activities.length > 0 && (
              <div className="mt-2.5 flex flex-col divide-y divide-[var(--line)]">
                {f.activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 py-1.5 text-[12px]"><span>{ACT.find((x) => x.id === a.type)?.label.split(" ")[0]}</span><div className="min-w-0 flex-1"><span className="font-semibold">{a.note}</span>{a.outcome ? <span className="text-[var(--ink-3)]"> — {a.outcome}</span> : null}<span className="text-[10.5px] text-[var(--ink-3)]"> · {a.by} · {fmtDay(a.at)}</span></div></div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            {onDelete ? <button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--red)] hover:underline">Delete lead</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-3)]">Cancel</button>
              <button type="button" onClick={() => onSave({ ...f, business: f.business.trim() || "Untitled", updatedAt: nowIso() })} className="rounded-full bg-[#1d3a8f] px-5 py-2 text-[12.5px] font-extrabold text-white">{lead ? "Save" : "Add lead"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: accent }} />
      <div className="pl-1.5"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)" }}>{value}</div><div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div></div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="mb-3 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{title}</div>{children}</div>;
}

// ── CSV import ──────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
type Field = "business" | "contactName" | "email" | "phone" | "location" | "source" | "owner" | "plan" | "estMrr" | "stage" | "notes";
const ALIASES: Record<Field, string[]> = {
  contactName: ["contact", "contact name", "contact_name", "person", "full name", "first name", "lead name"],
  business: ["business", "company", "business name", "organisation", "organization", "provider", "name", "club", "camp"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "tel", "telephone", "mobile", "number", "phone number", "contact number"],
  location: ["location", "city", "town", "area", "region", "county"],
  source: ["source", "channel", "lead source"],
  owner: ["owner", "rep", "assigned", "assigned to", "sales rep", "salesperson"],
  plan: ["plan", "tier", "package"],
  estMrr: ["est mrr", "estmrr", "value", "mrr", "monthly", "price", "£/mo", "est £"],
  stage: ["stage", "status", "pipeline"],
  notes: ["notes", "note", "comment", "comments"],
};
const fieldForHeader = (h: string): Field | null => { const k = h.trim().toLowerCase(); for (const f of Object.keys(ALIASES) as Field[]) if (ALIASES[f].includes(k)) return f; return null; };
const normSource = (v: string): Source => { const k = v.toLowerCase(); if (k.includes("cold") || k.includes("call")) return "cold_call"; if (k.includes("email") || k.includes("mail")) return "email"; if (k.includes("social") || k.includes("insta") || k.includes("face") || k.includes("linked") || k.includes("dm")) return "social"; if (k.includes("refer")) return "referral"; if (k.includes("event") || k.includes("confer") || k.includes("expo")) return "event"; if (k.includes("inbound") || k.includes("web") || k.includes("form")) return "inbound"; return "cold_call"; };
const normPlan = (v: string): Lead["plan"] => { const k = v.toLowerCase(); if (k.includes("free") || k.includes("solo")) return "freelancer"; if (k.includes("franch")) return "franchise"; return "company"; };
const normStage = (v: string): Stage => { const k = v.toLowerCase(); if (k.includes("won") || k.includes("customer") || k.includes("signed")) return "won"; if (k.includes("lost") || k.includes("dead")) return "lost"; if (k.includes("trial")) return "trial"; if (k.includes("demo")) return "demo"; if (k.includes("contact")) return "contacted"; return "new"; };

function ImportModal({ existing, onClose, onImport }: { existing: Lead[]; onClose: () => void; onImport: (l: Lead[]) => void }) {
  const [parsed, setParsed] = useState<{ leads: Lead[]; skipped: number; fileName: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setErr(null); setParsed(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) { setErr("That file has no data rows."); return; }
      const headers = rows[0];
      const col: Partial<Record<Field, number>> = {};
      headers.forEach((h, i) => { const f = fieldForHeader(h); if (f && col[f] == null) col[f] = i; });
      if (col.business == null && col.contactName == null && col.email == null) { setErr("Couldn't find a Business, Name or Email column."); return; }
      const seen = new Set(existing.map((l) => l.email.trim().toLowerCase()).filter(Boolean));
      const leads: Lead[] = []; let skipped = 0;
      for (const r of rows.slice(1)) {
        const g = (f: Field) => (col[f] != null ? (r[col[f]!] ?? "").trim() : "");
        const email = g("email");
        if (email && seen.has(email.toLowerCase())) { skipped++; continue; }
        if (email) seen.add(email.toLowerCase());
        const plan = col.plan != null ? normPlan(g("plan")) : "company";
        const est = Number(g("estMrr").replace(/[^0-9.]/g, ""));
        const now = nowIso();
        leads.push({ id: uid(), business: g("business") || g("contactName") || email || "Untitled", contactName: g("contactName"), email, phone: g("phone"), location: g("location"), source: col.source != null ? normSource(g("source")) : "cold_call", owner: g("owner"), plan, estMrr: est > 0 ? est : PLAN_MRR[plan], stage: col.stage != null ? normStage(g("stage")) : "new", notes: g("notes"), activities: [], createdAt: now, updatedAt: now });
      }
      if (!leads.length) { setErr(skipped ? `All ${skipped} rows are already in your pipeline (matched by email).` : "No valid rows found."); return; }
      setParsed({ leads, skipped, fileName: file.name });
    } catch { setErr("Couldn't read that file — is it a .csv?"); }
  };

  const template = "data:text/csv;charset=utf-8," + encodeURIComponent("Business,Contact name,Email,Phone,Location,Source,Owner,Plan,Est MRR,Stage,Notes\nSunrise Camps,Jo Bloggs,jo@sunrise.example,07700 900000,Leeds,Cold call,Priya,Company,69,New,Met at expo\n");

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-[min(600px,96vw)] rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 rounded-t-2xl px-5 py-3.5 text-white" style={{ background: HERO }}>
          <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Import leads from CSV</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">✕ Close</button>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] text-[var(--ink-3)]">Upload your spreadsheet (CSV) — we read the columns automatically (Business, Contact name, Email, Phone, Location, Source, Owner, Plan, Est MRR, Stage, Notes). Rows already in your pipeline (same email) are skipped.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white hover:brightness-110">Choose CSV file<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} /></label>
            <a href={template} download="activityos-leads-template.csv" className="text-[12px] font-bold text-[#1d3a8f] hover:underline">⬇ Download template</a>
          </div>
          {err && <div className="mt-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-bold text-[var(--red)]">{err}</div>}
          {parsed && (
            <div className="mt-4">
              <div className="rounded-lg bg-[#eaf0fc] px-3 py-2 text-[12.5px] font-bold text-[#1d3a8f]">✓ {parsed.fileName}: {parsed.leads.length} lead{parsed.leads.length === 1 ? "" : "s"} ready{parsed.skipped ? ` · ${parsed.skipped} skipped` : ""}</div>
              <div className="mt-2 overflow-hidden rounded-xl border border-[var(--line)]">
                <div className="max-h-[220px] overflow-y-auto">
                  {parsed.leads.slice(0, 25).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-1.5 text-[12px] last:border-0">
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.business}</span>
                      <span className="truncate text-[11px] text-[var(--ink-3)]">{l.email || l.phone || "—"}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: stageOf(l.stage).color }}>{stageOf(l.stage).label}</span>
                    </div>
                  ))}
                </div>
                {parsed.leads.length > 25 && <div className="px-3 py-1.5 text-[10.5px] text-[var(--ink-3)]">+ {parsed.leads.length - 25} more…</div>}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-3)]">Cancel</button>
                <button type="button" onClick={() => onImport(parsed.leads)} className="rounded-full bg-[#0f7a43] px-5 py-2 text-[12.5px] font-extrabold text-white">Import {parsed.leads.length}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
