"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { MoneyMovesNote } from "@/features/franchise/FranchiseRoyaltiesApp";
import { useT } from "@/lib/i18n/provider";

interface Settings { basis: "revenue" | "perBooking"; rate?: number; perBookingFee?: number }
interface Row { franchiseId: string; name: string; count: number; revenue: number; collected: number; fee: number }
interface SeriesPt { month: string; revenue: number; fee: number; byFranchise: Record<string, { revenue: number; fee: number }> }
interface Payload {
  settings: Settings; franchises: Row[]; direct: { count: number; revenue: number; collected: number }; totals: { franchises: number; revenue: number; fee: number };
  range: { period: string; from: string | null; to: string | null }; series: SeriesPt[]; seriesLegend: { franchiseId: string; name: string }[];
}

const PALETTE = ["#2f6bd8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b", "#6d4c41", "#0097a7"];
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short" });
const monthLong = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

// Funky stacked royalty (or revenue) chart, split by franchise. Gradient fills,
// rounded tops, hover for the split. Purely presentational.
function RoyaltyChart({ series, legend }: { series: SeriesPt[]; legend: { franchiseId: string; name: string }[] }) {
  const t = useT();
  const [metric, setMetric] = useState<"fee" | "revenue">("fee");
  const [hover, setHover] = useState<number | null>(null);
  const colorOf = (fid: string) => (fid === "__ho__" ? "#64748b" : PALETTE[Math.max(0, legend.findIndex((l) => l.franchiseId === fid)) % PALETTE.length]);
  const nameOf = (fid: string) => legend.find((l) => l.franchiseId === fid)?.name ?? t("money.splitFranchise");
  const val = (pt: SeriesPt, fid: string) => (pt.byFranchise[fid]?.[metric] ?? 0);
  const totalOf = (pt: SeriesPt) => (metric === "fee" ? pt.fee : pt.revenue);
  const maxTotal = Math.max(1, ...series.map(totalOf));
  const active = legend.filter((l) => series.some((pt) => val(pt, l.franchiseId) > 0));
  const MAXPX = 172;
  const fmt = (n: number) => money(n);

  return (
    <Card className="mb-3 overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13.5px] font-extrabold">{metric === "fee" ? t("money.splitRoyalties") : t("money.splitRevenue")} {t("money.splitOverTime")} <span className="font-bold text-[var(--ink-3)]">· {t("money.splitByFranchise")}</span></div>
        <div className="flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5 text-[11px] font-bold">
          {(["fee", "revenue"] as const).map((k) => <button key={k} type="button" onClick={() => setMetric(k)} className={"rounded-md px-2.5 py-1 " + (metric === k ? "bg-[#2f6bd8] text-white" : "text-[var(--ink-2)]")}>{k === "fee" ? t("money.splitRoyalty") : t("money.splitRevenue")}</button>)}
        </div>
      </div>
      {series.length === 0 || active.length === 0 ? (
        <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">{metric === "fee" ? t("money.splitNoRoyalties") : t("money.splitNoRevenue")}</div>
      ) : (
        <div className="relative">
          <svg width="0" height="0"><defs>
            {active.map((l) => { const c = colorOf(l.franchiseId); return <linearGradient key={l.franchiseId} id={`sf-${l.franchiseId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} /><stop offset="100%" stopColor={c} stopOpacity="0.72" /></linearGradient>; })}
          </defs></svg>
          <div className="flex items-end gap-2 border-b border-[var(--line)]" style={{ height: MAXPX + 20 }}>
            {series.map((pt, i) => {
              const tot = totalOf(pt);
              return (
                <div key={pt.month} className="group flex min-w-0 flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className="mb-1 text-[10px] font-extrabold tabular-nums text-[var(--ink-2)]" style={{ opacity: tot ? 1 : 0 }}>{tot ? fmt(tot) : "·"}</div>
                  {tot > 0 ? (
                    <div className="flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-t-[7px] shadow-[0_5px_12px_-5px_rgba(20,32,66,.42)] transition-opacity group-hover:opacity-90">
                      {active.map((l) => {
                        const v = val(pt, l.franchiseId);
                        if (!v) return null;
                        return <div key={l.franchiseId} className="transition-[height] duration-300" style={{ height: `${Math.max(2, (v / maxTotal) * MAXPX)}px`, background: `linear-gradient(180deg, ${colorOf(l.franchiseId)}, ${colorOf(l.franchiseId)}b8)` }} title={`${nameOf(l.franchiseId)}: ${fmt(v)}`} />;
                      })}
                    </div>
                  ) : <div className="h-[3px] w-full max-w-[46px] rounded-full bg-[var(--line)]" />}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            {series.map((pt) => <div key={pt.month} className="flex-1 text-center text-[9.5px] font-bold text-[var(--ink-3)]">{monthLabel(pt.month)}</div>)}
          </div>
          {hover != null && series[hover] && totalOf(series[hover]) > 0 && (
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl bg-[#171534] px-3 py-2 text-white shadow-xl">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/60">{monthLong(series[hover].month)}</div>
              {active.map((l) => { const v = val(series[hover], l.franchiseId); if (!v) return null; return <div key={l.franchiseId} className="flex items-center gap-1.5 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(l.franchiseId) }} /><span className="flex-1 pr-3">{nameOf(l.franchiseId)}</span><b className="tabular-nums">{fmt(v)}</b></div>; })}
              <div className="mt-1 border-t border-white/15 pt-1 text-[11px] font-extrabold">{t("money.total")} <span className="float-right tabular-nums">{fmt(totalOf(series[hover]))}</span></div>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {active.map((l) => <span key={l.franchiseId} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-2)]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(l.franchiseId) }} />{l.name}</span>)}
      </div>
    </Card>
  );
}

// Second entry is an i18n key (under the `money.` namespace) resolved at render.
const PRESETS: [string, string][] = [["1m", "split1m"], ["3m", "split3m"], ["6m", "split6m"], ["12m", "split12m"], ["all", "splitAllTime"]];

export function SplitFeesApp() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [basis, setBasis] = useState<Settings["basis"]>("revenue");
  const [rate, setRate] = useState("10");
  const [perBookingFee, setPerBookingFee] = useState("0");
  // Date window: a preset, or a custom from/to (which overrides the preset).
  const [period, setPeriod] = useState("6m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const custom = !!(from && to);

  const query = useMemo(() => (custom ? `?from=${from}&to=${to}` : `?period=${period}`), [custom, from, to, period]);
  const refresh = useCallback(() => {
    apiGet<Payload>(`/api/splitfees${query}`).then((p) => {
      setData(p); setError(null);
      setBasis(p.settings.basis); setRate(String(p.settings.rate ?? 10)); setPerBookingFee(String(p.settings.perBookingFee ?? 0));
    }).catch((e) => setError(e instanceof Error ? e.message : t("money.splitFailedLoad")));
  }, [query]);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["bookings"], refresh);

  async function saveSettings() {
    try {
      await api("/api/splitfees/settings", { method: "PUT", body: JSON.stringify({ basis, rate: Number(rate) || 0, perBookingFee: Number(perBookingFee) || 0 }) });
      setEdit(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("money.splitCouldntSave")); }
  }

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("money.splitLoading")}</div>;

  const basisLabel = data.settings.basis === "perBooking" ? t("money.splitPerBooking", { amount: money(data.settings.perBookingFee ?? 0) }) : t("money.splitPctOfRevenue", { rate: data.settings.rate ?? 0 });
  const windowKey = PRESETS.find(([k]) => k === period)?.[1];
  const windowLabel = custom ? `${from} → ${to}` : (windowKey ? t(`money.${windowKey}`) : "");

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("money.splitTitle")}</h2>
        {!edit && <Button onClick={() => setEdit(true)}>{t("money.splitRoyaltySettings")}</Button>}
      </div>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">{t("money.splitOwesLead")} <span className="font-bold text-[var(--ink)]">{basisLabel}</span>. {t("money.splitShowing")} <span className="font-bold text-[var(--ink)]">{windowLabel}</span>.</p>

      {/* Date window controls: presets + a custom range. */}
      <Card className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("money.splitPeriod")}</span>
          {PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => { setPeriod(k); setFrom(""); setTo(""); }} className={"rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors " + (!custom && period === k ? "bg-[#2f6bd8] text-white" : "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--panel)]")}>{t(`money.${l}`)}</button>)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("money.splitCustom")}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-none focus:border-[#2f6bd8]" />
          <span className="text-[var(--ink-3)]">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-none focus:border-[#2f6bd8]" />
          {custom && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">{t("money.splitClear")}</button>}
        </div>
      </Card>

      {edit && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>{t("money.splitBasis")}</FieldLabel><Select value={basis} onChange={(e) => setBasis(e.target.value as Settings["basis"])} className="w-full"><option value="revenue">{t("money.splitPctRevenueOpt")}</option><option value="perBooking">{t("money.splitFeePerBookingOpt")}</option></Select></div>
            {basis === "revenue"
              ? <div><FieldLabel>{t("money.splitRatePct")}</FieldLabel><Input type="number" min="0" max="100" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full" /></div>
              : <div><FieldLabel>{t("money.splitFeePerBookingGbp")}</FieldLabel><Input type="number" min="0" step="0.01" value={perBookingFee} onChange={(e) => setPerBookingFee(e.target.value)} className="w-full" /></div>}
          </div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={saveSettings}>{t("money.save")}</Button><Button onClick={() => setEdit(false)}>{t("money.cancel")}</Button></div>
        </Card>
      )}

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("money.splitFranchiseRevenue")}</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{money(data.totals.revenue)}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("money.splitRoyaltiesOwed")}</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#2f6bd8" }}>{money(data.totals.fee)}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("money.splitFranchises")}</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{data.totals.franchises}</div></Card>
      </div>

      {/* The funky chart */}
      <RoyaltyChart series={data.series} legend={data.seriesLegend} />

      <div className="mb-3"><MoneyMovesNote audience="ho" /></div>

      {data.franchises.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("money.splitNoFranchises")}</Card> : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[11px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
                  <th className="px-3.5 py-2">{t("money.splitFranchise")}</th>
                  <th className="px-3.5 py-2 text-right">{t("money.splitBookings")}</th>
                  <th className="px-3.5 py-2 text-right">{t("money.splitRevenue")}</th>
                  <th className="px-3.5 py-2 text-right">{t("money.splitCollected")}</th>
                  <th className="px-3.5 py-2 text-right">{t("money.splitRoyaltyOwed")}</th>
                </tr>
              </thead>
              <tbody>
                {data.franchises.map((r) => (
                  <tr key={r.franchiseId} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3.5 py-2 font-bold">{r.name}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-[var(--ink-3)]">{money(r.collected)}</td>
                    <td className="px-3.5 py-2 text-right font-extrabold tabular-nums text-[#2f6bd8]">{money(r.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.direct.count > 0 && (
        <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{t("money.splitDirectNote", { amount: money(data.direct.revenue), count: data.direct.count })}</div>
      )}
    </div>
  );
}
