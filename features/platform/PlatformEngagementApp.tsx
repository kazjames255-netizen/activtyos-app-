"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";

interface Row { view: string; avgSeconds: number; views: number; totalSeconds: number; avgPrevSeconds: number; viewsPrev: number; deltaPct: number | null }
interface Payload { rows: Row[]; totalViews: number }

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const BLUE = "#1d3a8f";
const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const PRETTY: Record<string, string> = { moneyin: "Money in", moneyout: "Money out", dash: "Dashboard", home: "Home" };
const pretty = (v: string) => PRETTY[v] ?? v.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase());

const FILTERS: [string, string][] = [["all", "All"], ["freelancer", "Freelancer"], ["company", "Company"]];

export function PlatformEngagementApp() {
  const [d, setD] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("all");

  const load = useCallback(() => {
    apiGet<Payload>(`/api/platform/page-engagement?type=${type}`).then((p) => { setD(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [type]);
  useEffect(load, [load]);

  const maxAvg = d ? Math.max(1, ...d.rows.map((r) => r.avgSeconds)) : 1;

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ background: HERO }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Platform · Head office</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>🔥 Page engagement</h2>
            <p className="mt-1 max-w-[640px] text-[12.5px] leading-snug text-white/85">
              Average time providers spend on each page — so you can see <b className="text-white">how popular each tab is</b> and where they focus. Last 3 months, compared to the previous 3.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/12 p-1 text-[12px] font-bold">
            {FILTERS.map(([v, label]) => (
              <button key={v} type="button" onClick={() => setType(v)} className="rounded-full px-3 py-1 transition-colors" style={type === v ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.8)" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="mt-3 text-[12.5px] text-[var(--red)]">{error}</div>}
      {!d ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading engagement…</div>
      ) : d.rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-12 text-center text-[13px] text-[var(--ink-3)]">
          No page activity yet for this filter.<br /><span className="text-[11.5px]">It fills in as providers use the app — every page visit is timed and rolls up here.</span>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between text-[12px]">
            <span className="font-bold text-[var(--ink-2)]">Most popular pages{type !== "all" ? ` · ${pretty(type)}` : ""}</span>
            <span className="text-[var(--ink-3)]">{d.totalViews.toLocaleString("en-GB")} visits · avg time on page · vs prev 3 mo</span>
          </div>
          <div className="flex flex-col divide-y divide-[var(--line)]">
            {d.rows.map((r, i) => {
              const up = r.deltaPct != null && r.deltaPct > 0.02;
              const down = r.deltaPct != null && r.deltaPct < -0.02;
              return (
                <div key={r.view} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                  <span className="w-5 text-center text-[11px] font-bold text-[var(--ink-3)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-extrabold">{pretty(r.view)}</span>
                      <span className="shrink-0 tabular-nums"><b>{dur(r.avgSeconds)}</b> <span className="text-[11px] font-normal text-[var(--ink-3)]">avg</span></span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(r.avgSeconds / maxAvg) * 100}%`, background: `linear-gradient(90deg,${BLUE},#3f78d8)` }} /></div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--ink-3)]">
                      <span>{r.views.toLocaleString("en-GB")} visits</span>
                      {r.deltaPct != null && (
                        <span className="font-bold" style={{ color: up ? "#0f7a43" : down ? "#c02636" : "var(--ink-3)" }}>
                          {up ? "▲" : down ? "▼" : "•"} {Math.abs(Math.round(r.deltaPct * 100))}% vs prev 3 mo
                        </span>
                      )}
                      {r.deltaPct == null && r.avgSeconds > 0 && <span className="text-[#1d3a8f]">new this period</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
