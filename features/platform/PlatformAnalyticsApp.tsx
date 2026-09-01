"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

interface Analytics {
  summary: { mrr: number; arr: number; mrrPaying: number; mrrTrial: number; arrPaying: number; totalProviders: number; active: number; trialing: number; canceling: number; canceled: number; avgTenureDays: number; churnRate: number; trialConversion: number; newThisMonth: number; gmvBooked: number; gmvPaid: number };
  byPlan: Record<string, { count: number; mrr: number }>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  attribution: Record<string, number>;
  signupsByMonth: { month: string; count: number; cumulative: number }[];
  mrrByMonth: { month: string; mrr: number }[];
  mrrPayingByMonth: { month: string; mrr: number }[];
  activeByMonth: { month: string; count: number }[];
  gmvByMonth: { month: string; booked: number; paid: number }[];
  projection: { month: string; mrr: number }[];
  topProviders: { id: string; name: string; plan: string; band: string | null; fee: number; tenureDays: number }[];
}

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const BLUE = "#1d3a8f", LIGHTB = "#3f78d8", GOLD = "#f0b100", PINK = "#EE1F63";
const money = (n: number) => (Math.abs(n) >= 1000 ? `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `£${Math.round(n).toLocaleString("en-GB")}`);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const tenure = (d: number) => (d >= 365 ? `${(d / 365).toFixed(1)} yrs` : d >= 30 ? `${Math.round(d / 30)} mo` : `${d} days`);
const PLAN_C: Record<string, string> = { freelancer: "#3f78d8", company: "#1d3a8f", franchise: "#7c3aed" };
const STATUS_C: Record<string, string> = { active: "#0f7a43", trialing: "#1d3a8f", canceling: "#a5670a", canceled: "#c02636", none: "#8a86a3" };
const GRADS = ["linear-gradient(135deg,#1d3a8f,#3f78d8)", "linear-gradient(135deg,#3f78d8,#5aa0f0)", "linear-gradient(135deg,#274ba3,#4f8bf5)", "linear-gradient(135deg,#6d28d9,#a855f7)", "linear-gradient(135deg,#0f7a43,#34c17b)"];
const initials = (s: string) => (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
const grad = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];

interface RecentProv { id: string; name: string; type: string; createdAt: string | null; subscription: Record<string, unknown> | null }
const kindOf = (p: RecentProv) => ((p.subscription?.plan as string) === "franchise" ? "franchise" : p.type === "company" ? "company" : "freelancer");
function sinceLabel(iso: string | null, nowMs: number) {
  if (!iso) return "just joined";
  const days = Math.floor((nowMs - Date.parse(iso)) / 86400000);
  if (days <= 0) return "joined today";
  if (days === 1) return "joined yesterday";
  if (days < 30) return `joined ${days} days ago`;
  return "since " + new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PlatformAnalyticsApp() {
  const [d, setD] = useState<Analytics | null>(null);
  const [recent, setRecent] = useState<RecentProv[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(12);
  const [mode, setMode] = useState<"incl" | "paying">("incl");
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(() => {
    Promise.all([
      apiGet<Analytics>("/api/platform/analytics"),
      apiGet<{ providers: RecentProv[] }>("/api/platform/providers"),
    ]).then(([a, p]) => {
      setD(a); setError(null);
      setRecent([...p.providers].sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? "")).slice(0, 6));
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);
  useRealtime(["tenants", "bookings"], load);

  const view = useMemo(() => {
    if (!d) return null;
    const slice = <T,>(arr: T[]) => arr.slice(-months);
    const mrrSeries = mode === "paying" ? d.mrrPayingByMonth : d.mrrByMonth;
    // Project the SAME number of months forward as the selected window, from the
    // recent average monthly change of the chosen (incl/paying) series.
    const recent = mrrSeries.slice(-6).map((x) => x.mrr);
    const deltas = recent.slice(1).map((v, i) => v - recent[i]);
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const last = mrrSeries[mrrSeries.length - 1];
    const lastMrr = last?.mrr ?? (mode === "paying" ? d.summary.mrrPaying : d.summary.mrr);
    const start = last ? new Date(`${last.month}-01T00:00:00Z`) : new Date();
    const projection = Array.from({ length: months }, (_, i) => {
      const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1));
      return { month: mKey(dt), mrr: Math.max(0, Math.round(lastMrr + avgDelta * (i + 1))) };
    });
    // Drop leading all-zero months so sparse data starts where activity begins
    // (keep at least the last 2 points so a chart is never a single dot).
    const trim = <T,>(arr: T[], zero: (x: T) => boolean) => { let i = 0; while (i < arr.length - 2 && zero(arr[i])) i++; return arr.slice(i); };
    return {
      mrr: trim(slice(mrrSeries), (x) => x.mrr === 0),
      signups: trim(slice(d.signupsByMonth), (x) => x.cumulative === 0),
      gmv: trim(slice(d.gmvByMonth), (x) => x.booked === 0 && x.paid === 0),
      projection, avgDelta, lastMrr,
    };
  }, [d, months, mode]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!d || !view) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading analytics…</div>;
  const s = d.summary;

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Platform · Head office</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>📈 Provider analytics</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-snug text-white/85">Recurring revenue, growth, churn and where it&rsquo;s heading — plus the money flowing through your providers.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/12 p-1 text-[12px] font-bold" title="Applies to the money figures — includes or excludes providers still on their free trial">
            {([["incl", "Incl. trials"], ["paying", "Paying only"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)} className="rounded-full px-3 py-1 transition-colors" style={mode === m ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.8)" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Monthly recurring" icon="💷" grad={GRAD.blue}
          value={money(mode === "paying" ? s.mrrPaying : s.mrr)}
          sub={`${money(mode === "paying" ? s.arrPaying : s.arr)}/yr · ${mode === "paying" ? "paying only" : "incl. trials"}`}>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]">
            <span className="font-bold text-white">{money(s.mrrPaying)}<span className="font-normal text-white/70"> paying</span></span>
            <span className="font-bold text-white">{money(s.mrrTrial)}<span className="font-normal text-white/70"> on trial</span></span>
          </div>
        </Tile>
        <ActiveTile value={s.active + s.canceling} sub={`${s.trialing} on trial · ${s.totalProviders} total`} series={d.activeByMonth.slice(-6)} />
        <Tile label="Avg. time with us" icon="⏳" grad={GRAD.green} value={tenure(s.avgTenureDays)} sub={`${s.newThisMonth} joined this month`} />
        <Tile label="Trial → paid" icon="🎯" grad={GRAD.amber} value={pct(s.trialConversion)} sub={`Churn ${pct(s.churnRate)}`} aside={<Ring pct={s.trialConversion * 100} label={pct(s.trialConversion)} />} />
      </div>

      {/* Trend period — controls the charts below, not the KPI cards above. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Trends over time</div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
          {[3, 6, 12].map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: BLUE, color: "#fff" } : { color: "var(--ink-3)" }}>{m}m</button>
          ))}
        </div>
      </div>

      {/* MRR trend (2/3) + long-range projections (1/3) */}
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Recurring revenue" right={<Legend items={[[mode === "paying" ? "Paying MRR" : "MRR incl. trials", BLUE], ["Projected", PINK]]} />} className="h-full">
            <TrendChart series={view.mrr.map((x) => ({ label: x.month, value: x.mrr }))} projection={view.projection.map((x) => ({ label: x.month, value: x.mrr }))} fmt={money} color={BLUE} />
          </Card>
        </div>
        <Projections lastMrr={view.lastMrr} avgDelta={view.avgDelta} mode={mode} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="New signups" right={<span className="text-[11.5px] text-[var(--ink-3)]">bars = joined · line = total</span>}>
          <SignupBars data={view.signups} />
        </Card>
        <Card title="Booking value through providers" right={<Legend items={[["Booked", LIGHTB], ["Paid", "#0f7a43"]]} />}>
          <TrendChart series={view.gmv.map((x) => ({ label: x.month, value: x.booked }))} series2={view.gmv.map((x) => ({ label: x.month, value: x.paid }))} fmt={money} color={LIGHTB} color2="#0f7a43" />
          <div className="mt-2 flex gap-4 text-[12px] text-[var(--ink-3)]"><span>All-time booked <b className="text-[var(--ink)]">{money(s.gmvBooked)}</b></span><span>Paid <b className="text-[var(--ink)]">{money(s.gmvPaid)}</b></span></div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Revenue by plan">
          <Breakdown entries={Object.entries(d.byPlan).map(([k, v]) => ({ label: k, value: v.mrr, sub: `${v.count} · ${money(v.mrr)}/mo`, color: PLAN_C[k] ?? BLUE }))} />
        </Card>
        <Card title="Providers by status">
          {Object.values(d.byStatus).some((v) => v > 0)
            ? <Donut
                segments={Object.entries(d.byStatus).map(([k, v]) => ({ label: k, value: v, color: STATUS_C[k] ?? "#8a86a3" }))}
                center={String(Object.values(d.byStatus).reduce((s2, v) => s2 + v, 0))}
                sub="providers"
              />
            : <Empty>No providers yet.</Empty>}
        </Card>
        <Card title="How they heard about us">
          {Object.keys(d.attribution).length
            ? <Breakdown entries={Object.entries(d.attribution).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, sub: String(v), color: LIGHTB }))} />
            : <Empty>No attribution yet — new signups record this.</Empty>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <NewestProviders items={recent} nowMs={nowMs} />
        <Card title="Top providers by fee">
          {d.topProviders.length ? (
            <div className="flex flex-col divide-y divide-[var(--line)]">
              {d.topProviders.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="rounded-full bg-[#eaf0fc] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#1d3a8f]">{p.plan}{p.band ? ` · ${p.band}` : ""}</span>
                  <span className="text-[11px] text-[var(--ink-3)]">{tenure(p.tenureDays)}</span>
                  <span className="w-16 text-right font-extrabold tabular-nums">{money(p.fee)}/mo</span>
                </div>
              ))}
            </div>
          ) : <Empty>No paying providers yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}

// The newest signups, colour-keyed by tier with a gradient avatar and a gold
// NEW flash for anyone who joined in the last fortnight. (Moved here from the
// retired Overview page.)
function NewestProviders({ items, nowMs }: { items: RecentProv[]; nowMs: number }) {
  return (
    <Card title="🆕 Newest providers">
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((p) => {
            const kind = kindOf(p);
            const c = PLAN_C[kind] ?? BLUE;
            const days = p.createdAt ? Math.floor((nowMs - Date.parse(p.createdAt)) / 86400000) : 999;
            return (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-2.5 py-2" style={{ background: `linear-gradient(90deg, ${c}14, transparent 62%)` }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold text-white shadow-sm" style={{ background: grad(p.name) }}>{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{p.name}</div>
                  <div className="text-[11px] text-[var(--ink-3)]">{sinceLabel(p.createdAt, nowMs)}</div>
                </div>
                {days <= 14 && <span className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold tracking-wide text-[#3a2a00]" style={{ background: GOLD }}>NEW</span>}
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize" style={{ background: `${c}1f`, color: c }}>{kind}</span>
              </div>
            );
          })}
        </div>
      ) : <Empty>No providers yet.</Empty>}
    </Card>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────
// Rich, colourful KPI tile — a dark gradient with white figures (shared look with the freelancer Dashboard).
const GRAD = {
  blue: "linear-gradient(135deg,#16306e 0%,#3f78d8 100%)",
  teal: "linear-gradient(135deg,#0e6f8a 0%,#14b8a6 100%)",
  green: "linear-gradient(135deg,#0b6b3a 0%,#2fb56f 100%)",
  pink: "linear-gradient(135deg,#9c1458 0%,#ee1f63 100%)",
  amber: "linear-gradient(135deg,#9a5a12 0%,#f5b81f 100%)",
  violet: "linear-gradient(135deg,#5b21b6 0%,#8b5cf6 100%)",
} as const;
function Tile({ label, value, sub, grad, icon, aside, children }: { label: string; value: string; sub?: React.ReactNode; grad: string; icon?: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_28px_-16px_rgba(20,30,80,.5)]" style={{ background: grad }}>
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/70">
            {icon && <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-white/15 text-[11px]">{icon}</span>}
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{value}</div>
          {sub && <div className="mt-1 text-[11px] font-semibold text-white/80">{sub}</div>}
        </div>
        {aside && <div className="flex-none">{aside}</div>}
      </div>
      {children}
    </div>
  );
}
// A single-percentage ring gauge — white on a coloured KPI tile.
function Ring({ pct: p, size = 60, label }: { pct: number; size?: number; label: string }) {
  const sw = 7, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, p / 100));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[12.5px] font-extrabold tabular-nums">{label}</div>
    </div>
  );
}
// A multi-segment doughnut with a centre figure + side legend, on a light card.
function Donut({ segments, center, sub, valueFmt = (n) => String(n), size = 116 }: { segments: { label: string; value: number; color: string }[]; center: string; sub?: string; valueFmt?: (n: number) => string; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const sw = 15, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.value > 0);
  const lens = shown.map((s) => c * (s.value / total));
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((sum, l) => sum + l, 0));
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel)" strokeWidth={sw} />
          {shown.map((s, i) => (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${lens[i].toFixed(1)} ${(c - lens[i]).toFixed(1)}`} strokeDashoffset={(-offsets[i]).toFixed(1)} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[19px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)" }}>{center}</div>
          {sub && <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">{sub}</div>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 font-semibold capitalize leading-tight">{s.label}</span>
            <span className="flex-none tabular-nums font-bold text-[var(--ink-3)]">{valueFmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// Active-providers KPI with a 6-month monthly mini bar chart of live providers.
function ActiveTile({ value, sub, series }: { value: number; sub: string; series: { month: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((x) => x.count));
  return (
    <Tile label="Active providers" icon="👥" grad={GRAD.teal} value={String(value)} sub={sub}>
      <div className="mt-2.5 flex items-end gap-1" style={{ height: 30 }}>
        {series.map((x, i) => (
          <div key={x.month} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`${monthLabel(x.month)}: ${x.count} live`}>
            <span className="mb-0.5 text-[8.5px] font-extrabold tabular-nums" style={{ opacity: i === series.length - 1 ? 1 : 0.75 }}>{x.count}</span>
            <div className="w-full rounded-t-[3px] bg-white" style={{ height: `${Math.max(8, (x.count / max) * 100)}%`, opacity: i === series.length - 1 ? 1 : 0.5 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[9px] font-semibold text-white/70">{series.map((x) => <span key={x.month} className="flex-1 text-center">{monthLabel(x.month)}</span>)}</div>
    </Tile>
  );
}
function Card({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
// Long-range MRR/ARR projection at 1/2/3/5 years from recent monthly growth.
function Projections({ lastMrr, avgDelta, mode }: { lastMrr: number; avgDelta: number; mode: "incl" | "paying" }) {
  const horizons: [number, string][] = [[12, "1 year"], [24, "2 years"], [36, "3 years"], [60, "5 years"]];
  const rows = horizons.map(([h, label]) => { const mrr = Math.max(0, Math.round(lastMrr + avgDelta * h)); return { label, mrr, arr: mrr * 12 }; });
  const max = Math.max(1, ...rows.map((r) => r.mrr));
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>🚀 Where it could go</div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: `linear-gradient(90deg,${PINK},#ff6aa0)` }}>Projection</span>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-[var(--ink-3)]">If recent growth holds ({mode === "paying" ? "paying" : "incl. trials"}), projected recurring revenue:</p>
      <div className="flex flex-1 flex-col justify-between gap-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-bold text-[var(--ink-2)]">{r.label}</span>
              <span className="text-[17px] font-extrabold tabular-nums" style={{ fontFamily: "var(--ff-display)", color: PINK }}>{money(r.mrr)}<span className="text-[11px] font-normal text-[var(--ink-3)]">/mo</span></span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(r.mrr / max) * 100}%`, background: `linear-gradient(90deg,${PINK},#ff8ab6)`, boxShadow: "0 1px 6px rgba(238,31,99,.35)" }} /></div>
            <div className="mt-0.5 text-right text-[10.5px] text-[var(--ink-3)]">{money(r.arr)}/yr</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-snug text-[var(--ink-3)]">Straight-line from recent average monthly growth — a guide, not a guarantee.</p>
    </div>
  );
}
function Legend({ items }: { items: [string, string][] }) {
  return <div className="flex gap-3 text-[11px] font-bold text-[var(--ink-3)]">{items.map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{children}</div>;
}

// Area/line trend with optional 2nd series and a dashed projection tail; hover shows values.
function TrendChart({ series, series2, projection, fmt, color, color2 }: { series: { label: string; value: number }[]; series2?: { label: string; value: number }[]; projection?: { label: string; value: number }[]; fmt: (n: number) => string; color: string; color2?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 168, PAD = 10;
  const all = [...series, ...(projection ?? [])];
  const pts = [...series.map((p) => p.value), ...(series2?.map((p) => p.value) ?? []), ...(projection?.map((p) => p.value) ?? [])];
  const max = Math.max(1, ...pts);
  const n = all.length;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const line = (arr: { value: number }[], off = 0) => arr.map((p, i) => `${i === 0 ? "M" : "L"}${x(i + off).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const areaP = `${line(series)} L${x(series.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;
  const areaP2 = series2 && series2.length ? `${line(series2)} L${x(series2.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z` : "";
  const projLine = projection ? `M${x(series.length - 1)},${y(series[series.length - 1]?.value ?? 0)} ` + projection.map((p, i) => `L${x(series.length + i)},${y(p.value)}`).join(" ") : "";
  const hi = hover;

  const lastVal = series[series.length - 1]?.value ?? 0;
  const projEnd = projection && projection.length ? projection[projection.length - 1] : null;
  const s2End = series2 && series2.length ? series2[series2.length - 1] : null;
  // A subtle value label in SVG coords — coloured text with a white halo, placed
  // below the point when it's near the top so it never collides with the legend.
  const valLabel = (cx: number, cy: number, text: string, fill: string, anchor: "middle" | "end") => {
    const ly = cy < 26 ? cy + 15 : cy - 9;
    const xc = anchor === "end" ? Math.min(cx, W - 2) : Math.max(text.length * 3.4, Math.min(W - text.length * 3.4, cx));
    return <text x={xc} y={ly} fontSize="11" fontWeight="800" fill={fill} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor={anchor}>{text}</text>;
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 6}`} className="w-full" style={{ overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round((rel - PAD) / ((W - 2 * PAD) / Math.max(1, n - 1)))))); }}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
          {color2 && <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color2} stopOpacity="0.16" /><stop offset="1" stopColor={color2} stopOpacity="0" /></linearGradient>}
        </defs>
        {[1, 0.66, 0.33].map((g) => { const yy = y(max * g); return <g key={g}><line x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" /><text x={PAD} y={yy - 3} fontSize="9" fill="var(--ink-3)">{fmt(max * g)}</text></g>; })}
        <path d={areaP} fill="url(#tg)" />
        {areaP2 && <path d={areaP2} fill="url(#tg2)" />}
        <path d={line(series)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {series2 && <path d={line(series2)} fill="none" stroke={color2} strokeWidth="2.5" strokeLinejoin="round" />}
        {projection && <path d={projLine} fill="none" stroke={PINK} strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 5px rgba(238,31,99,.35))" }} />}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={PAD} y2={H - PAD} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        {/* permanent value labels */}
        <circle cx={x(series.length - 1)} cy={y(lastVal)} r="3.5" fill={color} />
        {valLabel(x(series.length - 1), y(lastVal), fmt(lastVal), color, projEnd ? "end" : "middle")}
        {projEnd && <><circle cx={x(n - 1)} cy={y(projEnd.value)} r="4" fill={PINK} />{valLabel(x(n - 1), y(projEnd.value), fmt(projEnd.value), PINK, "end")}</>}
        {s2End && <><circle cx={x(series2!.length - 1)} cy={y(s2End.value)} r="3.5" fill={color2} />{valLabel(x(series2!.length - 1), y(s2End.value), fmt(s2End.value), color2!, "end")}</>}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-3)]">{all.filter((_, i) => i % Math.ceil(n / 6) === 0 || i === n - 1).map((p, i) => <span key={i}>{monthLabel(p.label)}</span>)}</div>
      {hi != null && (
        <div className="pointer-events-none absolute -top-1 rounded-lg bg-[var(--ink)] px-2 py-1 text-[11px] font-bold text-white shadow" style={{ left: `${(x(hi) / W) * 100}%`, transform: "translateX(-50%)" }}>
          {monthLabel(all[hi].label)} · {fmt(all[hi].value)}{series2 && series2[hi] ? ` / ${fmt(series2[hi].value)}` : ""}
        </div>
      )}
    </div>
  );
}

function SignupBars({ data }: { data: { month: string; count: number; cumulative: number }[] }) {
  const maxC = Math.max(1, ...data.map((x) => x.count));
  const maxCum = Math.max(1, ...data.map((x) => x.cumulative));
  const W = 640, H = 170, TOP = 24, BOT = 14;
  const plot = H - TOP - BOT;
  const bw = (W - 16) / data.length;
  const barW = Math.min(bw * 0.6, 46); // cap so 1–2 months don't become giant slabs
  const by = (v: number) => H - BOT - (v / maxC) * plot;
  const cy = (v: number) => H - BOT - (v / maxCum) * plot;
  const cx = (i: number) => 8 + i * bw + bw / 2;
  const total = data[data.length - 1]?.cumulative ?? 0;
  const cumPath = data.map((x, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(x.cumulative)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="sgbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5aa0f0" /><stop offset="1" stopColor={LIGHTB} /></linearGradient>
          <linearGradient id="sgarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={BLUE} stopOpacity="0.12" /><stop offset="1" stopColor={BLUE} stopOpacity="0" /></linearGradient>
        </defs>
        {[0.5, 1].map((g) => { const yy = by(maxC * g); return <line key={g} x1={8} x2={W - 8} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" />; })}
        {/* monthly join bars — width-capped, count inside when tall enough */}
        {data.map((x, i) => {
          if (x.count === 0) return <rect key={i} x={cx(i) - 10} y={H - BOT - 3} width={20} height={3} rx={1.5} fill="var(--line)" />;
          const h = (x.count / maxC) * plot; const top = H - BOT - h;
          return <g key={i}>
            <rect x={cx(i) - barW / 2} y={top} width={barW} height={h} rx={6} fill="url(#sgbar)"><title>{`${monthLabel(x.month)}: ${x.count} joined`}</title></rect>
            {h > 22
              ? <text x={cx(i)} y={top + 15} fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle">{x.count}</text>
              : <text x={cx(i)} y={top - 5} fontSize="10" fontWeight="800" fill={LIGHTB} textAnchor="middle">{x.count}</text>}
          </g>;
        })}
        {/* cumulative total line */}
        <path d={`${cumPath} L${cx(data.length - 1)},${H - BOT} L${cx(0)},${H - BOT} Z`} fill="url(#sgarea)" />
        <path d={cumPath} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={cx(data.length - 1)} cy={cy(total)} r="3.5" fill={BLUE} />
        <text x={Math.min(W - 2, cx(data.length - 1))} y={cy(total) - 9} fontSize="11" fontWeight="800" fill={BLUE} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor="end">{total} total</text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-3)]">{data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((x, i) => <span key={i}>{monthLabel(x.month)}</span>)}</div>
    </div>
  );
}


function Breakdown({ entries }: { entries: { label: string; value: number; sub: string; color: string }[] }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  if (!entries.length) return <Empty>Nothing yet.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e, i) => (
        <div key={e.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-5 w-5 flex-none place-items-center rounded-md text-[10px] font-extrabold text-white" style={{ background: e.color }}>{i + 1}</span>
              <span className="truncate font-semibold capitalize">{e.label}</span>
            </span>
            <span className="whitespace-nowrap font-extrabold tabular-nums text-[var(--ink-2)]">{e.sub}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
            <div className="h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, background: `linear-gradient(90deg,${e.color},${e.color}aa)`, boxShadow: `0 4px 12px -6px ${e.color}` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
