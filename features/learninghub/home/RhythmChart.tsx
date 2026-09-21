"use client";

import { useId, useState } from "react";
import { startOfDay } from "./homeLib";
import { Card, FOCUS } from "./homeKit";

// Weekly rhythm — quizzes and tests handed in per day, last 14 days. One series,
// one hue, thin rounded bars on a quiet grid; the peak is labelled directly.
// The chart is an <svg role="img"> with a spoken summary, and "Show as table"
// swaps in the same numbers as a real table (keyboard + screen-reader friendly).

const W = 340, H = 150, PL = 26, PR = 4, PT = 16, PB = 22;
const TOPS = [4, 6, 10, 20, 30, 40, 60, 100, 200, 300, 400, 600, 1000, 2000, 5000];
const fmtLong = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const wk = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short" });

export function RhythmChart({ days, now, title = "Weekly rhythm", unit = "quizzes handed in", emptyText, className = "", delay = 0 }: {
  days: { day: number; count: number }[]; now: number; title?: string; unit?: string; emptyText: string; className?: string; delay?: number;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const total = days.reduce((s, d) => s + d.count, 0);
  const max = Math.max(0, ...days.map((d) => d.count));
  const top = TOPS.find((t) => t >= max) ?? Math.ceil(max / 100) * 100;
  const peak = max > 0 ? days.reduce((b, d) => (d.count > b.count ? d : b), days[0]) : null;
  const activeCount = days.filter((d) => d.count > 0).length;
  const iw = W - PL - PR, ih = H - PT - PB;
  const slot = iw / days.length, bw = Math.min(14, slot * 0.62);
  const y = (v: number) => PT + ih - (v / top) * ih;
  const today = startOfDay(now);
  const summary = total === 0
    ? `${title}: no ${unit} in the last ${days.length} days.`
    : `${title}: ${total} ${unit} over the last ${days.length} days, on ${activeCount} of them. Busiest was ${fmtLong(peak!.day)} with ${peak!.count}.`;
  const hp = hover != null ? days[hover] : null;

  return (
    <Card title={title} icon="chart" tone="violet" className={className} style={{ ["--d" as string]: `${delay}ms` }}
      aside={total > 0 ? <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className={`min-h-[44px] rounded-full px-3 text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{table ? "Show chart" : "Show as table"}</button> : undefined}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[30px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{total}</span>
        <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">{unit} · last {days.length} days</span>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 py-6 text-center text-[13px] leading-relaxed text-[var(--ink-2)]">{emptyText}</p>
      ) : table ? (
        <div className="mt-3 max-h-[220px] overflow-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full text-left text-[12.5px]">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-[var(--panel)] text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><tr><th scope="col" className="px-3 py-2 font-extrabold">Day</th><th scope="col" className="px-3 py-2 text-right font-extrabold">Count</th></tr></thead>
            <tbody>{[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-[var(--line)]"><th scope="row" className="px-3 py-1.5 font-semibold text-[var(--ink)]">{wk(d.day)} {fmtShort(d.day)}</th><td className="px-3 py-1.5 text-right font-bold tabular-nums text-[var(--ink)]">{d.count}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} className="block h-auto w-full overflow-visible">
            <title id={`${uid}-t`}>{title}</title>
            <desc id={`${uid}-d`}>{summary}</desc>
            {[0, top / 2, top].map((v) => (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : "2 4"} />
                <text x={PL - 6} y={y(v) + 3.5} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--ink-3)">{v}</text>
              </g>
            ))}
            {days.map((d, i) => {
              const cx = PL + slot * i + slot / 2;
              const isToday = d.day === today;
              const h = Math.max(0, (d.count / top) * ih);
              const r = Math.min(4, h / 2);
              return (
                <g key={d.day}>
                  {d.count > 0 ? (
                    <path className="home-grow" style={{ ["--d" as string]: `${i * 35}ms` }}
                      d={`M${cx - bw / 2},${PT + ih} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`}
                      fill="var(--brand)" opacity={hover == null || hover === i ? 1 : 0.45} />
                  ) : (
                    <rect x={cx - bw / 2} y={PT + ih - 2} width={bw} height={2} rx={1} fill="var(--line)" />
                  )}
                  {isToday && <rect x={cx - 6} y={H - 2} width={12} height={2} rx={1} fill="var(--brand)" />}
                  {peak && d === peak && d.count > 0 && <text x={cx} y={y(d.count) - 5} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">{d.count}</text>}
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={isToday ? 800 : 600} fill={isToday ? "var(--ink)" : "var(--ink-3)"}>{wk(d.day).slice(0, 1)}</text>
                  <rect x={PL + slot * i} y={PT} width={slot} height={ih + PB - 6} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
                </g>
              );
            })}
          </svg>
          {hp && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow)]"
              style={{ left: `${((PL + slot * hover! + slot / 2) / W) * 100}%`, top: -6 }}>
              <div className="font-extrabold text-[var(--ink)]">{hp.count} {hp.count === 1 ? "hand-in" : "hand-ins"}</div>
              <div className="text-[var(--ink-3)]">{wk(hp.day)} {fmtShort(hp.day)}</div>
            </div>
          )}
          <p className="sr-only">{summary}</p>
        </div>
      )}
      {total > 0 && !table && <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--ink-3)]"><span>{fmtShort(days[0].day)}</span><span>{fmtShort(days[days.length - 1].day)}</span></div>}
    </Card>
  );
}
