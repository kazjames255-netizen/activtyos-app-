"use client";

// Head-office "all franchises" dashboard — the FRANCHISOR'S COMMAND CENTRE, not
// the operational per-site view. Network KPIs + a revenue trend, a needs-action
// list, an onboarding pipeline, a network compliance strip and a franchise
// league table with a drill-in to each. Black-themed via --hero-grad (HO flag).

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { useT, tNow } from "@/lib/i18n/provider";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { setHoScopeId } from "@/components/franchise/HoScope";

interface FrRow {
  franchiseId: string; name: string; area: string | null;
  revenue: number; bookings: number; collected: number; outstanding: number; royalty: number;
  families: number; children: number; trendPct: number; rev30: number;
  lastBookingAt: string | null; openIncidents: number; territory: string; live: boolean;
}
interface Overview {
  settings: { basis: string; rate?: number; perBookingFee?: number };
  network: {
    revenue: number; collected: number; outstanding: number; bookings: number; royalty: number;
    families: number; children: number; franchises: number; liveFranchises: number; pendingInvites: number;
    avgPerFranchise: number; revenueTrendPct: number; rev30: number; openIncidents: number; incidentsByKind: Record<string, number>;
  };
  series: { month: string; revenue: number; bookings: number; byFranchise: Record<string, { bookings: number; revenue: number }> }[];
  seriesLegend: { franchiseId: string; name: string }[];
  franchises: FrRow[];
  direct: { revenue: number; bookings: number; collected: number; families: number; children: number; live: boolean };
  onboarding: { pendingInvites: { name: string; area: string | null; createdAt: string | null }[]; notLive: { franchiseId: string; name: string; area: string | null }[] };
  attention: { severity: "high" | "med" | "low"; kind: string; message: string; franchiseId?: string; href?: string }[];
}

const PALETTE = ["#2f6bd8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b", "#6d4c41", "#0097a7"];
const GOLD = "#f5b81f";
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(dl(), { month: "short" });

// Trend chip — green up / red down, semantic (not the data accent).
function Trend({ pct, className = "" }: { pct: number; className?: string }) {
  if (!pct) return <span className={`text-[11px] font-bold text-[var(--ink-3)] ${className}`}>—</span>;
  const up = pct > 0;
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${up ? "text-[#0f7a43]" : "text-[#c0392b]"} ${className}`}>{up ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

// A compact revenue area chart (6 months). One measure, one axis; the last point
// is emphasised and labelled. Hover shows each month's figure.
function RevenueChart({ series }: { series: { month: string; revenue: number }[] }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 150, padX = 8, padTop = 16, padBot = 26;
  const max = Math.max(1, ...series.map((s) => s.revenue));
  const n = series.length;
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBot);
  const pts = series.map((s, i) => [x(i), y(s.revenue)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - padBot).toFixed(1)} L${padX},${(H - padBot).toFixed(1)} Z`;
  const active = hover ?? n - 1;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="none" role="img" aria-label={`${t("franchise.networkRevenue")}, ${t("franchise.last6Months")}`}>
        <defs>
          <linearGradient id="hoRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity="0.35" /><stop offset="100%" stopColor={GOLD} stopOpacity="0.02" /></linearGradient>
        </defs>
        <line x1={padX} y1={H - padBot} x2={W - padX} y2={H - padBot} stroke="#e6e9f0" strokeWidth={1} />
        <path d={area} fill="url(#hoRev)" />
        <path d={line} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={i === active ? 5 : 3} fill={i === active ? "#171534" : GOLD} stroke="#fff" strokeWidth={1.5} />
            <rect x={x(i) - (W - padX * 2) / (2 * n)} y={0} width={(W - padX * 2) / n} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            <text x={px} y={H - 8} textAnchor="middle" className="fill-[#8a86a3]" style={{ fontSize: 10, fontWeight: 700 }}>{monthLabel(series[i].month)}</text>
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute end-2 top-0 rounded-lg bg-[#171534] px-2.5 py-1 text-end text-white">
        <div className="text-[9px] font-bold uppercase tracking-wide text-white/60">{monthLabel(series[active].month)}</div>
        <div className="text-[13px] font-extrabold tabular-nums">{money(series[active].revenue)}</div>
      </div>
    </div>
  );
}

type Series = { month: string; revenue: number; bookings: number; byFranchise: Record<string, { bookings: number; revenue: number }> }[];
type Legend = { franchiseId: string; name: string }[];

// Bookings (or revenue) over time, STACKED by franchise, with a period toggle
// (this month / 3m / 6m / 12m). Each column is a month; each coloured segment a
// franchise. Hover a month for the full split.
function BookingsByFranchise({ series, legend }: { series: Series; legend: Legend }) {
  const t = useT();
  const [months, setMonths] = useState(6);
  const [metric, setMetric] = useState<"bookings" | "revenue">("bookings");
  const [hover, setHover] = useState<number | null>(null);
  const colorOf = (fid: string) => (fid === "__ho__" ? "#64748b" : PALETTE[Math.max(0, legend.findIndex((l) => l.franchiseId === fid)) % PALETTE.length]);
  const nameOf = (fid: string) => legend.find((l) => l.franchiseId === fid)?.name ?? t("franchise.franchiseFallback");
  const val = (bf?: { bookings: number; revenue: number }) => (bf ? (metric === "bookings" ? bf.bookings : bf.revenue) : 0);
  const shown = series.slice(-months);
  const totalOf = (m: Series[number]) => legend.reduce((s, l) => s + val(m.byFranchise[l.franchiseId]), 0);
  const maxTotal = Math.max(1, ...shown.map(totalOf));
  const MAXPX = 156;
  // Only franchises that actually have data in the window get a legend chip.
  const active = legend.filter((l) => shown.some((m) => val(m.byFranchise[l.franchiseId]) > 0));
  const fmtVal = (n: number) => (metric === "bookings" ? String(n) : money(n));
  const PERIODS: [number, string][] = [[1, t("franchise.thisMonth")], [3, t("franchise.threeMonths")], [6, t("franchise.sixMonths")], [12, t("franchise.twelveMonths")]];

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold">{metric === "bookings" ? t("franchise.bookings") : t("franchise.revenue")} {t("franchise.byFranchise2")} <span className="font-bold text-[var(--ink-3)]">· {t("franchise.overTime")}</span></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border border-[var(--line)] bg-white p-0.5 text-[11px] font-bold">
            {(["bookings", "revenue"] as const).map((k) => <button key={k} type="button" onClick={() => setMetric(k)} className={"rounded-md px-2.5 py-1 " + (metric === k ? "bg-[#171534] text-white" : "text-[var(--ink-2)]")}>{k === "bookings" ? t("franchise.bookings") : t("franchise.revenue")}</button>)}
          </div>
          <div className="flex rounded-lg border border-[var(--line)] bg-white p-0.5 text-[11px] font-bold">
            {PERIODS.map(([n, l]) => <button key={n} type="button" onClick={() => setMonths(n)} className={"rounded-md px-2.5 py-1 " + (months === n ? "bg-[#2f6bd8] text-white" : "text-[var(--ink-2)]")}>{l}</button>)}
          </div>
        </div>
      </div>
      <div className="relative">
        <div className="flex items-end gap-2 border-b border-[var(--line)] pb-0" style={{ height: MAXPX + 18 }}>
          {shown.map((m, i) => {
            const tot = totalOf(m);
            return (
              <div key={m.month} className="group flex min-w-0 flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <div className="mb-1 text-[10px] font-bold tabular-nums text-[var(--ink-2)]" style={{ opacity: tot ? 1 : 0 }}>{tot ? fmtVal(tot) : "·"}</div>
                {tot > 0 ? (
                  <div className="flex w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t-md transition-opacity group-hover:opacity-90">
                    {active.map((l) => {
                      const v = val(m.byFranchise[l.franchiseId]);
                      if (!v) return null;
                      return <div key={l.franchiseId} className="transition-[height] duration-300" style={{ height: `${Math.max(2, (v / maxTotal) * MAXPX)}px`, background: colorOf(l.franchiseId) }} title={`${nameOf(l.franchiseId)}: ${fmtVal(v)}`} />;
                    })}
                  </div>
                ) : <div className="h-[3px] w-full max-w-[40px] rounded-full bg-[var(--line)]" />}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          {shown.map((m) => <div key={m.month} className="flex-1 text-center text-[9.5px] font-bold text-[var(--ink-3)]">{monthLabel(m.month)}</div>)}
        </div>
        {hover != null && shown[hover] && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl bg-[#171534] px-3 py-2 text-white shadow-lg">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/60">{new Date(`${shown[hover].month}-01T00:00:00Z`).toLocaleDateString(dl(), { month: "long", year: "numeric" })}</div>
            {active.map((l) => { const v = val(shown[hover].byFranchise[l.franchiseId]); if (!v) return null; return <div key={l.franchiseId} className="flex items-center gap-1.5 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(l.franchiseId) }} /><span className="flex-1">{nameOf(l.franchiseId)}</span><b className="tabular-nums">{fmtVal(v)}</b></div>; })}
            <div className="mt-1 border-t border-white/15 pt-1 text-[11px] font-extrabold">{t("franchise.total")} <span className="float-end tabular-nums">{fmtVal(totalOf(shown[hover]))}</span></div>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {active.map((l) => <span key={l.franchiseId} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-2)]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(l.franchiseId) }} />{l.name}</span>)}
        {active.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">{t("franchise.noBookingsWindow")}</span>}
      </div>
    </div>
  );
}

const SEV = {
  high: { dot: "#c0392b", bg: "#fdecec", tag: "Action" },
  med: { dot: "#b45309", bg: "#fdf4e7", tag: "Review" },
  low: { dot: "#6b7280", bg: "#f1f3f7", tag: "Note" },
} as const;

export function HoDashboardApp() {
  const t = useT();
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiGet<Overview>("/api/ho/overview").then(setD).catch((e) => setError(e instanceof Error ? e.message : tNow("franchise.couldntLoadNetwork"))); }, []);

  const rows = useMemo(() => (d?.franchises ?? []).map((f, i) => ({ ...f, color: PALETTE[i % PALETTE.length] })), [d]);
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue), d?.direct.revenue ?? 0);
  const best = rows.find((r) => r.live) ?? null;
  const needsSupport = [...rows].filter((r) => r.live).sort((a, b) => a.trendPct - b.trendPct)[0] ?? null;

  const terrBadge = (s: string) =>
    s === "agreed" ? <span className="rounded-full bg-[#e2f4ea] px-2 py-0.5 text-[10px] font-extrabold text-[#0f7a43]">{t("franchise.territoryAgreed")}</span>
      : s === "proposed" ? <span className="rounded-full bg-[#fdf0e3] px-2 py-0.5 text-[10px] font-extrabold text-[#b45309]">{t("franchise.territoryPending")}</span>
        : <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-3)]">{t("franchise.noTerritory")}</span>;

  const Bar = ({ v, color }: { v: number; color: string }) => (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eef2f8]"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / maxRev) * 100)}%`, background: color }} /></div>
  );

  // The API sends English sentences; rebuild the known ones from the row data so they follow the language picker.
  const attMsg = (a: Overview["attention"][number]) => {
    const f = a.franchiseId ? d?.franchises.find((x) => x.franchiseId === a.franchiseId) : undefined;
    if (f) {
      if (a.kind === "safeguarding") return t(f.openIncidents === 1 ? "p8fr.attIncOne" : "p8fr.attIncOther", { name: f.name, count: f.openIncidents });
      if (a.kind === "territory-approve") return t("p8fr.attTerrApprove", { name: f.name });
      if (a.kind === "territory") return t("p8fr.attNoTerr", { name: f.name });
      if (a.kind === "decline") return t("p8fr.attDecline", { name: f.name, pct: Math.abs(f.trendPct) });
      if (a.kind === "outstanding") return t("p8fr.attOutstanding", { name: f.name, amount: "£" + Math.round(f.outstanding).toLocaleString(dl()) });
    }
    const m = a.kind === "invite" ? /^(.*) — invite sent, awaiting sign-up$/.exec(a.message) : null;
    return m ? t("p8fr.attInvite", { name: m[1] }) : a.message;
  };
  const kindLabel = (k: string) => (k === "accident" ? t("franchise.tagAccident") : k === "safeguarding" ? t("franchise.tagSafeguarding") : k === "incident" ? t("franchise.tagIncident") : k);
  const royaltyBasis = d ? (d.settings.basis === "perBooking" ? t("franchise.perBookingShort", { amount: money(d.settings.perBookingFee ?? 0) }) : t("franchise.pctOfRevenue", { rate: d.settings.rate ?? 0 })) : "…";

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f6f6f8] p-5 text-[#171534]">
      <div className="mx-auto max-w-[1180px]">
        {/* Hero */}
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">🏢</span>
                {t("franchise.headOffice")}
              </div>
              <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/80">{t("franchise.headOfficeLede")}</p>
            </div>
            <div className="flex gap-2 text-[11.5px] font-bold">
              <Link href="/company/territories" className="rounded-full bg-white/15 px-3 py-1.5 text-white no-underline backdrop-blur-sm hover:bg-white/25">{t("franchise.territoriesBtn")}</Link>
              <Link href="/company/splitfees" className="rounded-full bg-[color:var(--side-ct-bg,#f5b81f)] px-3 py-1.5 text-[#3a2a00] no-underline hover:brightness-105">{t("franchise.royaltiesBtn")}</Link>
            </div>
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
        {!d ? (
          <div className="py-16 text-center text-[13px] text-[var(--ink-3)]">{t("franchise.loadingNetwork")}</div>
        ) : (
          <>
            {/* Network KPI row */}
            <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {([
                { k: t("franchise.networkRevenue"), v: money(d.network.revenue), extra: <Trend pct={d.network.revenueTrendPct} />, sub: t("franchise.last30VsPrior") },
                { k: t("franchise.royaltiesDueHo"), v: money(d.network.royalty), sub: royaltyBasis, gold: true },
                { k: t("franchise.bookings"), v: String(d.network.bookings), sub: t("franchise.familiesChildrenSub", { families: d.network.families, children: d.network.children }) },
                { k: t("franchise.activeFranchises"), v: `${d.network.liveFranchises}/${d.network.franchises}`, sub: d.network.pendingInvites ? t("franchise.invitedCount", { count: d.network.pendingInvites }) : t("franchise.trading") },
                { k: t("franchise.avgPerFranchise"), v: money(d.network.avgPerFranchise), sub: t("franchise.revenueLower") },
                { k: t("franchise.uncollected"), v: money(d.network.outstanding), sub: t("franchise.acrossNetwork"), warn: d.network.outstanding > 0 },
              ]).map((t) => (
                <Card key={t.k} className="p-3.5">
                  <div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t.k}</div>{t.extra}</div>
                  <div className={"mt-1 text-[20px] font-extrabold tabular-nums " + (t.gold ? "text-[#171534]" : t.warn ? "text-[#c0392b]" : "")} style={{ fontFamily: "var(--ff-display)" }}>{t.v}</div>
                  <div className="text-[10.5px] text-[var(--ink-3)]">{t.sub}</div>
                </Card>
              ))}
            </div>

            {/* Bookings/revenue over time, split by franchise (period toggle). */}
            <Card className="mb-3 p-4"><BookingsByFranchise series={d.series} legend={d.seriesLegend} /></Card>

            <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
              {/* Revenue trend */}
              <Card className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[13px] font-extrabold">{t("franchise.networkRevenue")} <span className="font-bold text-[var(--ink-3)]">· {t("franchise.last6Months")}</span></div>
                  <Trend pct={d.network.revenueTrendPct} />
                </div>
                <RevenueChart series={d.series.slice(-6)} />
              </Card>

              {/* Needs attention */}
              <Card className="flex flex-col p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold">{t("franchise.needsAttention")} {d.attention.length > 0 && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[11px] font-extrabold text-[#c0392b]">{d.attention.length}</span>}</div>
                {d.attention.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("franchise.allClearNetwork")}</div>
                ) : (
                  <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto pe-1">
                    {d.attention.slice(0, 12).map((a, i) => {
                      const s = SEV[a.severity];
                      const inner = (
                        <div className="flex items-start gap-2 rounded-lg px-2.5 py-1.5" style={{ background: s.bg }}>
                          <span className="mt-1 h-2 w-2 flex-none rounded-full" style={{ background: s.dot }} />
                          <div className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--ink-2)]">{attMsg(a)}</div>
                          {a.franchiseId && <button type="button" onClick={() => setHoScopeId(a.franchiseId!)} className="flex-none text-[11px] font-extrabold text-[#2f6bd8] hover:underline">{t("franchise.view")}</button>}
                        </div>
                      );
                      return a.href ? <Link key={i} href={a.href} className="no-underline">{inner}</Link> : <div key={i}>{inner}</div>;
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Top performer + needs support + compliance */}
            <div className="my-3 grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.topPerformer")}</div>
                {best ? <><div className="mt-1 text-[15px] font-extrabold">{best.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{money(best.revenue)} · {best.bookings} {t("franchise.bookingsWord")}</div><div className="mt-1"><Trend pct={best.trendPct} /></div></> : <div className="mt-1 text-[12px] text-[var(--ink-3)]">{t("franchise.noTradingData")}</div>}
              </Card>
              <Card className="p-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.needsSupportCard")}</div>
                {needsSupport ? <><div className="mt-1 text-[15px] font-extrabold">{needsSupport.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{money(needsSupport.revenue)} · {needsSupport.bookings} {t("franchise.bookingsWord")}</div><div className="mt-1"><Trend pct={needsSupport.trendPct} /></div></> : <div className="mt-1 text-[12px] text-[var(--ink-3)]">—</div>}
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.safeguardingNetwork")}</div><Link href="/company/incidents" className="text-[11px] font-bold text-[#2f6bd8] hover:underline">{t("franchise.view")}</Link></div>
                <div className="mt-1 text-[20px] font-extrabold tabular-nums">{d.network.openIncidents}<span className="ms-1 text-[12px] font-bold text-[var(--ink-3)]">{t("franchise.openLower")}</span></div>
                <div className="text-[10.5px] text-[var(--ink-3)]">{Object.entries(d.network.incidentsByKind).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${kindLabel(k)}`).join(" · ") || t("franchise.noOpenIncidents")}</div>
              </Card>
            </div>

            {/* Franchise league table */}
            <Card className="mb-3 p-0">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                <div className="text-[13.5px] font-extrabold">{t("franchise.franchiseLeague")} <span className="font-bold text-[var(--ink-3)]">{t("franchise.byRevenue")}</span></div>
                <div className="text-[11px] text-[var(--ink-3)]">{t("franchise.trendPerFranchise")}</div>
              </div>
              {rows.length === 0 ? (
                <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("franchise.noFranchisesYetInvite")} <Link href="/company/franchise-invites" className="font-bold text-[#2f6bd8] underline">{t("franchise.inviteFranchises")}</Link>.</div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
                  {rows.map((r, i) => (
                    <div key={r.franchiseId} className="grid grid-cols-[auto_1.5fr_1.6fr_repeat(3,0.8fr)_auto] items-center gap-3 px-4 py-2.5 text-[12.5px]">
                      <div className="w-4 text-center text-[12px] font-black text-[var(--ink-3)]">{i + 1}</div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 flex-none rounded-full" style={{ background: r.color }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5"><span className="truncate font-extrabold">{r.name}</span>{r.openIncidents > 0 && <span className="flex-none rounded-full bg-[#fdecec] px-1.5 text-[9.5px] font-black text-[#c0392b]">🛡{r.openIncidents}</span>}</div>
                          <div className="text-[10.5px] text-[var(--ink-3)]">{r.area || "—"} · {r.families} {t("franchise.familiesWord")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2"><Bar v={r.revenue} color={r.color} /></div>
                      <div className="text-end font-extrabold tabular-nums">{money(r.revenue)}<div className="text-[10px] font-semibold text-[var(--ink-3)]">{t("franchise.bkgCount", { count: r.bookings })} · <Trend pct={r.trendPct} /></div></div>
                      <div className="text-end tabular-nums text-[var(--ink-2)]">{money(r.collected)}<div className="text-[10px] text-[var(--ink-3)]">{t("franchise.collectedLower")}</div></div>
                      <div className="text-end font-bold tabular-nums text-[#171534]">{money(r.royalty)}<div className="text-[10px] font-normal text-[var(--ink-3)]">{t("franchise.royaltyLower")}</div></div>
                      <div className="flex items-center gap-2 justify-self-end">{terrBadge(r.territory)}<button type="button" onClick={() => setHoScopeId(r.franchiseId)} className="rounded-full bg-[#171534] px-3 py-1 text-[11px] font-extrabold text-white hover:brightness-125">{t("franchise.viewArrow")}</button></div>
                    </div>
                  ))}
                  {/* Head office direct */}
                  {d.direct.live && (
                    <div className="grid grid-cols-[auto_1.5fr_1.6fr_repeat(3,0.8fr)_auto] items-center gap-3 bg-[var(--panel)] px-4 py-2.5 text-[12.5px]">
                      <div className="w-4 text-center text-[13px]">🏢</div>
                      <div className="flex items-center gap-2"><span className="h-3 w-3 flex-none rounded-full bg-[#64748b]" /><div><div className="font-extrabold">{t("franchise.headOffice")} <span className="font-normal text-[var(--ink-3)]">· {t("franchise.direct")}</span></div><div className="text-[10.5px] text-[var(--ink-3)]">{d.direct.families} {t("franchise.familiesWord")}</div></div></div>
                      <div><Bar v={d.direct.revenue} color="#64748b" /></div>
                      <div className="text-end font-extrabold tabular-nums">{money(d.direct.revenue)}<div className="text-[10px] font-semibold text-[var(--ink-3)]">{t("franchise.bkgCount", { count: d.direct.bookings })}</div></div>
                      <div className="text-end tabular-nums text-[var(--ink-2)]">{money(d.direct.collected)}<div className="text-[10px] text-[var(--ink-3)]">{t("franchise.collectedLower")}</div></div>
                      <div className="text-end text-[var(--ink-3)]">—<div className="text-[10px]">{t("franchise.noRoyalty")}</div></div>
                      <div className="justify-self-end"><button type="button" onClick={() => setHoScopeId("__ho__")} className="rounded-full bg-[#171534] px-3 py-1 text-[11px] font-extrabold text-white hover:brightness-125">{t("franchise.viewArrow")}</button></div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Onboarding pipeline */}
            {(d.onboarding.pendingInvites.length > 0 || d.onboarding.notLive.length > 0) && (
              <Card className="mb-3 p-4">
                <div className="mb-2 flex items-center justify-between"><div className="text-[13px] font-extrabold">{t("franchise.onboardingPipeline")}</div><Link href="/company/franchise-invites" className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">{t("franchise.inviteAFranchise")}</Link></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.awaitingSignUp")} · {d.onboarding.pendingInvites.length}</div>
                    {d.onboarding.pendingInvites.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">{t("franchise.nonePending")}</div> :
                      <div className="flex flex-col gap-1">{d.onboarding.pendingInvites.map((p, i) => <div key={i} className="flex items-center gap-2 text-[12px]"><span className="h-1.5 w-1.5 rounded-full bg-[#b45309]" /><b>{p.name}</b>{p.area && <span className="text-[var(--ink-3)]">· {p.area}</span>}</div>)}</div>}
                  </div>
                  <div>
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("franchise.signedUpNotTrading")} · {d.onboarding.notLive.length}</div>
                    {d.onboarding.notLive.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">{t("franchise.allFranchisesTrading")}</div> :
                      <div className="flex flex-col gap-1">{d.onboarding.notLive.map((p) => <div key={p.franchiseId} className="flex items-center gap-2 text-[12px]"><span className="h-1.5 w-1.5 rounded-full bg-[#6b7280]" /><b>{p.name}</b>{p.area && <span className="text-[var(--ink-3)]">· {p.area}</span>}<button type="button" onClick={() => setHoScopeId(p.franchiseId)} className="ms-auto text-[11px] font-bold text-[#2f6bd8] hover:underline">{t("franchise.helpSetUp")}</button></div>)}</div>}
                  </div>
                </div>
              </Card>
            )}

            <p className="text-[11.5px] text-[var(--ink-3)]">{t("franchise.royaltyBasisPrefix")} {royaltyBasis} {t("franchise.changeItIn")} <Link href="/company/splitfees" className="font-bold text-[#171534] underline">{t("franchise.splitFees")}</Link>. {t("franchise.figuresNetworkWide")}</p>
          </>
        )}
      </div>
    </div>
  );
}
