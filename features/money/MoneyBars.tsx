"use client";

// Month-by-month money bars used on Money in (and Expenses): a real £ axis with gridlines, value labels, an optional
// "Booked" ghost bar beside the solid "Collected" one (so the gap, money still to come, is visible), thinned month labels
// that never collide (the year appears on January and on the first column), a tooltip on hover / focus / tap, and a clear
// "so far" mark on the current month. Presentation only: it draws whatever totals it is given.
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { money } from "@/features/bookings/helpers";
import { axisLabel, barPx, maxLabelsFor, monthAxisLabel, niceTicks, thinLabels } from "./chartAxis";

export interface MoneyBarPoint {
  key: string;
  /** 0-11 */
  month: number;
  year: number;
  monthShort: string;
  monthLong: string;
  total: number;
  /** Booked value for the month (the ghost bar). Omit for a single-series chart (Expenses). */
  booked?: number;
  /** Entries (income lines / expenses) behind `total`. */
  count: number;
  /** Bookings made in the month, when `booked` is shown. */
  bookedCount?: number;
  current: boolean;
}

/** Label above a bar: whole pounds from £10, pence below, k from a thousand. */
const valueLabel = (v: number) => (v >= 1000 ? `£${Math.round((v / 1000) * 10) / 10}k` : v >= 10 ? `£${Math.round(v)}` : `£${v.toFixed(2)}`);

/** Tooltip x (px): beside the hovered column, never on top of its bar, flipping to its other side near the edge. */
const tipLeft = (cx: number, colW: number, plotW: number) => { const right = cx + colW / 2 + 6; return right + 190 <= plotW ? right : Math.max(0, cx - colW / 2 - 6 - 190); };

const PLOT = 150; // px height of the plotting area
const AXIS_W = 46; // px for the £ labels

export function MoneyBars({ points, series, color, colorDark, showBooked = false, emptyText }: {
  points: MoneyBarPoint[];
  /** Name of the solid series: "Collected" / "Spent". */
  series: string;
  color: string;
  colorDark: string;
  showBooked?: boolean;
  emptyText: string;
}) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => setW(el.getBoundingClientRect().width);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const plotW = Math.max(120, w - AXIS_W);
  const colW = plotW / Math.max(1, n);
  const maxVal = Math.max(0, ...points.map((p) => p.total), ...(showBooked ? points.map((p) => p.booked ?? 0) : []));
  const { ticks, top, step } = useMemo(() => niceTicks(maxVal, 4), [maxVal]);
  const keep = useMemo(() => {
    const s = thinLabels(n, maxLabelsFor(plotW));
    if (n > 0) s.add(n - 1); // the current month is always named
    return s;
  }, [n, plotW]);
  const showValues = colW >= (showBooked ? 44 : 30);
  const allZero = points.every((p) => !(p.total > 0));
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const centreFrac = (i: number) => ((rtl ? n - 1 - i : i) + 0.5) / Math.max(1, n);
  const barW = Math.max(5, Math.min(showBooked ? 22 : 34, (colW - 8) / (showBooked ? 2 : 1) - 2));
  const act = active != null ? points[active] : null;

  return (
    <div ref={wrap} className="relative" data-testid="money-bars">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-3 text-[11px] font-bold text-[var(--ink-3)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />{series}</span>
        {showBooked && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed border-[var(--ink-3)]" />{t("p8fin.mbBooked")}</span>}
      </div>
      <div className="flex" style={{ height: PLOT + 6 }}>
        {/* the £ axis */}
        <div className="relative flex-none" style={{ width: AXIS_W }} aria-hidden="true">
          {ticks.map((v) => (
            <span key={v} className="absolute end-1.5 translate-y-1/2 text-[10px] font-semibold tabular-nums text-[var(--ink-3)]" style={{ bottom: (v / top) * PLOT }}>{axisLabel(v, step)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: PLOT }}>
          {ticks.map((v) => (
            <div key={v} className="pointer-events-none absolute inset-x-0" style={{ bottom: (v / top) * PLOT, borderTop: v === 0 ? "1px solid var(--line)" : "1px dashed var(--line)" }} />
          ))}
          {allZero && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 z-[1] text-center text-[12.5px] font-bold text-[var(--ink-3)]">{emptyText}</div>
          )}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => {
              const hc = barPx(p.total, top, PLOT);
              const hb = showBooked ? barPx(p.booked ?? 0, top, PLOT) : 0;
              const on = active === i;
              return (
                <div
                  key={p.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.monthLong} ${p.year}: ${series} ${money(p.total)}${showBooked ? `, ${t("p8fin.mbBooked")} ${money(p.booked ?? 0)}` : ""}${p.current ? `, ${t("p8fin.mbSoFar")}` : ""}`}
                  className="relative flex min-w-0 flex-1 cursor-default items-end justify-center gap-[2px] outline-none"
                  style={{ background: on ? "color-mix(in srgb, var(--brand-soft, #eaf0fc) 70%, transparent)" : undefined, borderRadius: 6 }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                  onKeyDown={(e) => { if (e.key === "Escape") setActive(null); }}
                >
                  {p.total > 0 ? (
                    <div className="relative" style={{ width: barW, height: hc, background: p.current ? `linear-gradient(180deg,${color},${colorDark})` : color, borderRadius: "4px 4px 0 0", opacity: p.current ? 1 : 0.88 }}>
                      {showValues && <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-extrabold tabular-nums text-[var(--ink-2)]" style={{ bottom: hc + 2 }}>{valueLabel(p.total)}</span>}
                    </div>
                  ) : (
                    !showBooked && <div className="mb-0 w-[60%] self-end" style={{ borderTop: "2px dotted var(--line)" }} />
                  )}
                  {showBooked && (
                    (p.booked ?? 0) > 0
                      ? <div style={{ width: barW, height: hb, border: "1.5px dashed var(--ink-3)", borderBottom: "none", borderRadius: "4px 4px 0 0", background: "transparent" }} />
                      : p.total > 0 ? null : <div className="w-[60%] self-end" style={{ borderTop: "2px dotted var(--line)" }} />
                  )}
                </div>
              );
            })}
          </div>
          {act && (
            <div
              className="pointer-events-none absolute z-20 w-[190px] rounded-xl border border-[var(--line)] bg-[var(--raised,var(--surface))] px-3 py-2 text-[11.5px] shadow-lg"
              style={{ top: 4, left: tipLeft(centreFrac(active!) * plotW, colW, plotW) }}
              data-testid="money-bars-tip"
            >
              <div className="mb-1 text-[12px] font-extrabold text-[var(--ink)]">{act.monthLong} {act.year}{act.current ? ` · ${t("p8fin.mbSoFar")}` : ""}</div>
              <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-[var(--ink-2)]"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />{series}</span><b className="tabular-nums text-[var(--ink)]">{money(act.total)}</b></div>
              {showBooked && <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-[var(--ink-2)]"><i className="inline-block h-2 w-2 rounded-sm border border-dashed border-[var(--ink-3)]" />{t("p8fin.mbBooked")}</span><b className="tabular-nums text-[var(--ink)]">{money(act.booked ?? 0)}</b></div>}
              <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">{showBooked ? t("p8fin.mbBookingsN", { n: act.bookedCount ?? 0 }) : t("p8fin.mbEntriesN", { n: act.count })}</div>
            </div>
          )}
        </div>
      </div>
      {/* month labels, thinned so they never overlap */}
      <div className="flex" style={{ paddingInlineStart: AXIS_W }}>
        {points.map((p, i) => {
          const lab = monthAxisLabel(p.monthShort, p.month, p.year, i === 0);
          return (
            <div key={p.key} className="min-w-0 flex-1 text-center leading-tight">
              {keep.has(i) && (
                <>
                  <div className="whitespace-nowrap text-[11px] font-bold" style={{ color: p.current ? "var(--ink)" : "var(--ink-3)" }}>{lab.main}</div>
                  <div className="h-[11px] whitespace-nowrap text-[9.5px] font-semibold text-[var(--ink-3)]">{p.current ? t("p8fin.mbSoFar") : lab.year ?? ""}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
