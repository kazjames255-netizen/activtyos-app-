"use client";

import { useId, useState } from "react";
import { startOfDay } from "./homeLib";
import { Card, FOCUS } from "./homeKit";
import { useH } from "./homeI18n";
import { uiDate } from "@/lib/i18n/format";

// Weekly rhythm — quizzes and tests handed in per day, last 14 days, drawn as frosted-glass
// capsules over a soft pastel wash (the "Glass capsules" design). Each capsule fills from the
// bottom (height = count), lifts and glows on hover or keyboard focus, and carries a floating
// tooltip ("Tue 15 Sep · 2 hand-ins"). Colours come from the hub tokens only (color-mix), so the
// dark theme follows. A spoken summary stays available, and "Show as table" swaps in the same
// numbers as a real table (keyboard + screen-reader friendly).

const TOPS = [4, 6, 10, 20, 30, 40, 60, 100, 200, 300, 400, 600, 1000, 2000, 5000];

// Pastel wash behind the capsules: pink, violet and peach blobs mixed from tokens.
const WASH = [
  "radial-gradient(90px 90px at 12% 22%, color-mix(in srgb, var(--red) 24%, transparent), transparent)",
  "radial-gradient(120px 120px at 68% 8%, color-mix(in srgb, var(--violet) 26%, transparent), transparent)",
  "radial-gradient(130px 130px at 96% 82%, color-mix(in srgb, var(--amber) 30%, transparent), transparent)",
  "radial-gradient(130px 130px at 34% 100%, color-mix(in srgb, color-mix(in srgb, var(--red) 50%, var(--violet)) 22%, transparent), transparent)",
].join(",");
const GLASS_BG = "linear-gradient(160deg, color-mix(in srgb, var(--surface) 72%, transparent), color-mix(in srgb, var(--surface) 14%, transparent))";
const FILL = "linear-gradient(180deg, color-mix(in srgb, var(--violet) 58%, var(--surface)), color-mix(in srgb, var(--red) 52%, var(--surface)))";
const FILL_TODAY = "linear-gradient(180deg, color-mix(in srgb, var(--amber) 62%, var(--surface)), color-mix(in srgb, var(--red) 55%, var(--surface)))";
const FILL_ZERO = "color-mix(in srgb, var(--surface) 65%, transparent)";

export function RhythmChart({ days, now, title: titleIn, unit: unitIn, emptyText, className = "", delay = 0 }: {
  days: { day: number; count: number }[]; now: number; title?: string; unit?: string; emptyText: string; className?: string; delay?: number;
}) {
  const { t, locale, pl } = useH();
  const title = titleIn ?? t("hubshell.hm_weeklyRhythm");
  const unit = unitIn ?? t("hubshell.hm_unitQuizzes");
  const fmtLong = (ms: number) => uiDate(new Date(ms), { weekday: "long", day: "numeric", month: "long" }, locale);
  const fmtShort = (ms: number) => uiDate(new Date(ms), { day: "numeric", month: "short" }, locale);
  const wk = (ms: number) => uiDate(new Date(ms), { weekday: "short" }, locale);
  const wkNarrow = (ms: number) => uiDate(new Date(ms), { weekday: "narrow" }, locale);
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const total = days.reduce((s, d) => s + d.count, 0);
  const max = Math.max(0, ...days.map((d) => d.count));
  const top = TOPS.find((n) => n >= max) ?? Math.ceil(max / 100) * 100;
  const peak = max > 0 ? days.reduce((b, d) => (d.count > b.count ? d : b), days[0]) : null;
  const activeCount = days.filter((d) => d.count > 0).length;
  const today = startOfDay(now);
  const summary = total === 0
    ? t("hubshell.hm_rhythmNone", { title, unit, days: days.length })
    : t("hubshell.hm_rhythmSummary", { title, total, unit, days: days.length, active: activeCount, day: fmtLong(peak!.day), peak: peak!.count });
  const label = (d: { day: number; count: number }) => `${wk(d.day)} ${fmtShort(d.day)} · ${pl("hm_handIns", d.count)}`;
  const n = days.length || 1;
  const hp = hover != null ? days[hover] : null;

  return (
    <Card title={title} icon="chart" tone="violet" className={className} style={{ ["--d" as string]: `${delay}ms` }}
      aside={total > 0 ? <button type="button" data-testid="hub-home-rhythm-toggle" onClick={() => setTable((v) => !v)} aria-pressed={table} className={`min-h-[44px] rounded-full px-3 text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{table ? t("hubshell.hm_showChart") : t("hubshell.hm_showTable")}</button> : undefined}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[40px] font-extrabold leading-none tabular-nums text-[var(--brand-strong)]" style={{ fontFamily: "var(--ff-display)" }}>{total}</span>
        <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubshell.hm_unitLastDays", { unit, days: days.length })}</span>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 py-6 text-center text-[13px] leading-relaxed text-[var(--ink-2)]">{emptyText}</p>
      ) : table ? (
        <div className="mt-3 max-h-[220px] overflow-auto rounded-2xl border border-[var(--line)]" data-testid="hub-home-rhythm-table">
          <table className="w-full text-start text-[12.5px]">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-[var(--panel)] text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><tr><th scope="col" className="px-3 py-2 font-extrabold">{t("hubshell.hm_colDay")}</th><th scope="col" className="px-3 py-2 text-end font-extrabold">{t("hubshell.hm_colCount")}</th></tr></thead>
            <tbody>{[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-[var(--line)]"><th scope="row" className="px-3 py-1.5 font-semibold text-[var(--ink)]">{wk(d.day)} {fmtShort(d.day)}</th><td className="px-3 py-1.5 text-end font-bold tabular-nums text-[var(--ink)]">{d.count}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3" data-testid="hub-home-rhythm">
          <style>{`
            .rc-cap { transition: transform .18s ease, box-shadow .18s ease; }
            .rc-cap:hover, .rc-cap:focus-visible { transform: translateY(-8px); box-shadow: 0 14px 22px -10px color-mix(in srgb, var(--violet) 55%, transparent), 0 0 16px color-mix(in srgb, var(--red) 30%, transparent), inset 0 0 8px color-mix(in srgb, var(--surface) 55%, transparent); }
            @media (prefers-reduced-motion: reduce) { .rc-cap { transition: none; } .rc-cap:hover, .rc-cap:focus-visible { transform: none; } }
          `}</style>
          <div role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="relative overflow-visible rounded-[22px] px-2.5 pb-2 pt-9" style={{ background: `${WASH}, var(--panel)` }}>
            <span id={`${uid}-t`} className="sr-only">{title}</span>
            <p id={`${uid}-d`} className="sr-only">{summary}</p>
            <div className="grid items-end gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {days.map((d, i) => {
                const isToday = d.day === today;
                const pct = d.count > 0 ? Math.max(14, Math.round((d.count / top) * 100)) : 6;
                const showCount = d.count > 0 && (hover === i || (hover == null && peak != null && d === peak));
                return (
                  <div key={d.day} className="relative h-[150px] sm:h-[170px]">
                    <div tabIndex={0} role="img" aria-label={label(d)} data-testid="hub-home-rhythm-capsule" data-count={d.count}
                      onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))} onFocus={() => setHover(i)} onBlur={() => setHover((h) => (h === i ? null : h))}
                      className={`rc-cap relative h-full overflow-hidden rounded-full outline-none ${FOCUS}`}
                      style={{ background: GLASS_BG, border: "1px solid color-mix(in srgb, var(--surface) 80%, transparent)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: "0 10px 18px -10px color-mix(in srgb, var(--ink) 40%, transparent), inset 0 0 8px color-mix(in srgb, var(--surface) 50%, transparent)" }}>
                      <i className="home-grow absolute inset-x-0 bottom-0 block rounded-full" style={{ ["--d" as string]: `${i * 45}ms`, height: `${pct}%`, background: d.count === 0 ? FILL_ZERO : isToday ? FILL_TODAY : FILL, boxShadow: d.count > 0 ? "inset 0 6px 8px color-mix(in srgb, var(--surface) 45%, transparent)" : undefined }} />
                    </div>
                    {showCount && <span aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[13px] font-extrabold tabular-nums text-[var(--ink)]" style={{ bottom: `calc(${pct}% + 8px)` }}>{d.count}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 grid gap-1 text-center sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
              {days.map((d) => {
                const isToday = d.day === today;
                return (
                  <span key={d.day} className="flex flex-col items-center text-[11px] leading-none" style={{ fontWeight: isToday ? 800 : 700, color: isToday ? "var(--ink)" : "var(--ink-2)" }}>
                    {wkNarrow(d.day)}
                    <span className="mt-1 block h-[3px] w-4 rounded-full" style={{ background: isToday ? "var(--gold)" : "transparent" }} />
                  </span>
                );
              })}
            </div>
            {hp && (
              <div role="tooltip" data-testid="hub-home-rhythm-tip" className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[var(--ink)] shadow-[var(--shadow)]"
                style={{ left: `clamp(56px, ${(((hover ?? 0) + 0.5) / n) * 100}%, calc(100% - 56px))`, top: 2 }}>
                {label(hp)}
              </div>
            )}
          </div>
        </div>
      )}
      {total > 0 && !table && <div className="mt-2 flex justify-between text-[11px] font-semibold text-[var(--ink-3)]"><span>{fmtShort(days[0].day)}</span><span>{fmtShort(days[days.length - 1].day)}</span></div>}
    </Card>
  );
}
