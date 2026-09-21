"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { TrendPoint } from "../shared-assess/api";
import { fmtDate, fmtDateShort, toneAt } from "../shared-assess/format";
import { useWidth } from "../shared-assess/hooks";
import { useGrow, useReducedMotion } from "../shared-assess/motion";
import { display, FOCUS } from "../shared-assess/ui";
import { subjectColor, subjectInk, tint } from "../kit";
import { subjectSwatch } from "../subjectColour";
import { bandRanges, type Band } from "./levels";

// "Most recent progress": one smooth line of the last ≤20 marked quiz scores (oldest →
// newest), drawn on background zones that ARE the tenant's levels (labelled, so colour is
// never the only cue), with the pass mark as a dashed reference line, a callout for the
// latest score, a snapping crosshair + tooltip, per-point keyboard focus (arrow keys),
// a subject filter, and a table view. Crisp at any width (drawn at real pixel size).

type Pt = TrendPoint & { i: number };

/** Monotone cubic (Fritsch–Carlson): smooth, and never overshoots 0 or 100 between points. */
export function monotonePath(xy: [number, number][]): string {
  const n = xy.length;
  if (n === 0) return "";
  if (n === 1) return `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xy[i + 1][0] - xy[i][0]; m[i] = (xy[i + 1][1] - xy[i][1]) / (dx[i] || 1); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(xy[i][0] + h).toFixed(1)},${(xy[i][1] + t[i] * h).toFixed(1)} ${(xy[i + 1][0] - h).toFixed(1)},${(xy[i + 1][1] - t[i + 1] * h).toFixed(1)} ${xy[i + 1][0].toFixed(1)},${xy[i + 1][1].toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ points, bands, passMark }: { points: TrendPoint[]; bands: Band[]; passMark?: number | null }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const [subj, setSubj] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  const all = useMemo(() => [...points].sort((a, b) => a.at.localeCompare(b.at)).slice(-20), [points]);
  const subjects = useMemo(() => [...new Set(all.map((p) => p.subject))].sort((a, b) => a.localeCompare(b)), [all]);
  const pts: Pt[] = useMemo(() => all.filter((p) => !subj || p.subject === subj).map((p, i) => ({ ...p, i })), [all, subj]);
  const draw = useGrow(1, 120);

  const ranges = useMemo(() => bandRanges(bands), [bands]);
  const wide = w >= 540;
  const H = w < 460 ? 224 : 264;
  const pad = { l: 34, r: wide ? 84 : 14, t: 30, b: 32 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (pts.length <= 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (Math.min(100, Math.max(0, v)) / 100) * ih;
  const xy = pts.map((p) => [x(p.i), y(p.pct)] as [number, number]);
  const line = monotonePath(xy);
  const area = pts.length > 1 ? `${line} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const ticks = [...new Set([0, ...ranges.map((r) => r.from), 100])].sort((a, b) => a - b);

  const active = hover ?? focus;
  const ap = active != null ? pts[active] : null;
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  const delta = last && prev ? Math.round(last.pct) - Math.round(prev.pct) : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pts.length) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0, bd = Infinity;
    pts.forEach((p) => { const d = Math.abs(x(p.i) - px); if (d < bd) { bd = d; best = p.i; } });
    setHover(best);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const cur = focus ?? pts.length - 1;
    const to = e.key === "ArrowRight" ? Math.min(pts.length - 1, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur - 1) : e.key === "Home" ? 0 : e.key === "End" ? pts.length - 1 : null;
    if (to == null) return;
    e.preventDefault();
    setFocus(to);
    dots.current[to]?.focus();
  };

  // Tooltip position: above the point, kept inside the plot.
  const tipW = 190;
  // Beside the point (never on top of it): to its left in the right half of the plot, else to its right.
  const tipLeft = ap ? Math.min(Math.max(x(ap.i) > w / 2 ? x(ap.i) - tipW - 14 : x(ap.i) + 14, 4), Math.max(4, w - tipW - 4)) : 0;
  const tipTop = ap ? Math.min(Math.max(y(ap.pct) - 34, 2), Math.max(2, H - 92)) : 0;

  const callout = last ? { cx: Math.min(Math.max(x(last.i), pad.l + 24), pad.l + iw - 22), below: y(last.pct) < pad.t + 6 } : null;
  const trans = reduced ? "none" : undefined;

  return (
    <div data-testid="hub-trend">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {last && (
          <div className="min-w-0 flex-1" aria-live="polite">
            <span className="text-[24px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display} data-testid="hub-trend-latest">{Math.round(last.pct)}%</span>
            <span className="ml-2 text-[12px] font-semibold text-[var(--ink-3)]">latest{delta != null && delta !== 0 ? <> · <b className="tabular-nums" style={{ color: delta > 0 ? "color-mix(in srgb, var(--green) 55%, var(--ink))" : "color-mix(in srgb, var(--red) 65%, var(--ink))" }}>{delta > 0 ? "▲ +" : "▼ −"}{Math.abs(delta)} pts</b> on the quiz before</> : null}</span>
          </div>
        )}
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className={`min-h-[44px] rounded-lg px-2 text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{table ? "Show chart" : "Show as table"}</button>
      </div>

      {subjects.length > 1 && (
        <div role="group" aria-label="Filter by subject" className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" data-testid="hub-trend-subjects">
          {[null, ...subjects].map((s) => {
            const on = subj === s;
            return <button key={s ?? "all"} type="button" aria-pressed={on} onClick={() => { setSubj(s); setHover(null); setFocus(null); }} className={`min-h-[44px] flex-none rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${s ? (on ? "font-extrabold" : "bg-[var(--surface)]") : on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}
              style={s ? (on ? { background: tint(subjectColor(s), 16), borderColor: subjectColor(s), color: subjectInk(s) } : { borderColor: subjectSwatch(s).ring, color: subjectInk(s) }) : undefined}>{s ?? "All subjects"}</button>;
          })}
        </div>
      )}

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <caption className="sr-only">Quiz scores, newest first</caption>
            <thead><tr className="text-[11px] uppercase tracking-[0.06em] text-[var(--ink-3)]"><th scope="col" className="py-1.5 pr-3 font-extrabold">Date</th><th scope="col" className="py-1.5 pr-3 font-extrabold">Quiz</th><th scope="col" className="py-1.5 pr-3 font-extrabold">Subject</th><th scope="col" className="py-1.5 text-right font-extrabold">Score</th></tr></thead>
            <tbody>{[...pts].reverse().map((p) => (
              <tr key={p.i} className="border-t border-[var(--line)]"><td className="whitespace-nowrap py-1.5 pr-3 text-[var(--ink-2)]">{fmtDate(p.at)}</td><td className="py-1.5 pr-3 font-semibold text-[var(--ink)]">{p.title}</td><td className="py-1.5 pr-3 text-[var(--ink-2)]">{p.subject}</td><td className="py-1.5 text-right font-extrabold tabular-nums text-[var(--ink)]">{Math.round(p.pct)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative w-full" style={{ height: H }}>
          {w > 0 && (
            <svg width={w} height={H} role="group" aria-label={`Line chart of your last ${pts.length} quiz ${pts.length === 1 ? "score" : "scores"}, oldest to newest. Latest ${Math.round(last?.pct ?? 0)} percent. Use the arrow keys to move between scores.`}
              onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} className="block touch-pan-y select-none">
              <defs>
                <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
                <clipPath id={`${uid}-clip`}><rect x={pad.l} y={pad.t - 1} width={iw} height={ih + 2} rx="10" /></clipPath>
              </defs>

              {/* level zones: the tenant's own bands, tinted and named */}
              <g clipPath={`url(#${uid}-clip)`}>
                {ranges.map((r) => {
                  const top = Math.min(100, r.to + 1), y1 = y(top), y2 = y(r.from);
                  return <rect key={`${r.label}-${r.from}`} x={pad.l} y={y1} width={iw} height={Math.max(0, y2 - y1)} fill={toneAt(r.i, ranges.length).fill} opacity="0.09" />;
                })}
              </g>
              {ticks.map((g) => (
                <g key={g}>
                  <line x1={pad.l} x2={pad.l + iw} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g === 0 || g === 100 ? undefined : "2 4"} />
                  <text x={pad.l - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--ink-3)">{g}</text>
                </g>
              ))}
              {ranges.map((r) => {
                const top = Math.min(100, r.to + 1), mid = (y(top) + y(r.from)) / 2, h = y(r.from) - y(top);
                if (wide) return <text key={`${r.label}-l`} x={pad.l + iw + 10} y={mid + 3.5} fontSize="10.5" fontWeight="800" fill="var(--ink-3)" letterSpacing="0.04em">{r.label.toUpperCase().slice(0, 12)}</text>;
                return h >= 20 ? <text key={`${r.label}-l`} x={pad.l + 7} y={y(top) + 13} fontSize="9.5" fontWeight="800" fill="var(--ink-3)" opacity="0.85" letterSpacing="0.04em">{r.label.toUpperCase().slice(0, 12)}</text> : null;
              })}

              {/* pass mark reference */}
              {passMark != null && passMark > 0 && passMark < 100 && (
                <g data-testid="hub-trend-pass">
                  <line x1={pad.l} x2={pad.l + iw} y1={y(passMark)} y2={y(passMark)} stroke="var(--ink-2)" strokeWidth="1.25" strokeDasharray="5 4" opacity="0.75" />
                  {wide
                    ? <text x={pad.l + iw + 10} y={y(passMark) - 5} fontSize="10" fontWeight="800" fill="var(--ink-2)">Pass {Math.round(passMark)}%</text>
                    : <text x={pad.l + iw - 4} y={y(passMark) - 4} textAnchor="end" fontSize="9.5" fontWeight="800" fill="var(--ink-2)">Pass {Math.round(passMark)}%</text>}
                </g>
              )}

              {area && <path d={area} fill={`url(#${uid}-fill)`} opacity={draw} style={{ transition: trans ?? "opacity 700ms ease 250ms" }} />}
              {pts.length > 1 && <path d={line} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ transition: trans ?? "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }} />}

              {ap && <line x1={x(ap.i)} x2={x(ap.i)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" />}

              {pts.map((p) => {
                const isLast = p.i === pts.length - 1, on = active === p.i;
                const label = `${p.title}, ${p.subject}, ${fmtDate(p.at)}: ${Math.round(p.pct)} percent`;
                return (
                  <g key={p.i}>
                    {isLast && <circle cx={x(p.i)} cy={y(p.pct)} r="11" fill="var(--brand)" opacity="0.16" />}
                    <circle cx={x(p.i)} cy={y(p.pct)} r={on ? 6.5 : isLast ? 6 : 4.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth="2.5" opacity={draw} style={{ transition: trans ?? `opacity 400ms ease ${300 + p.i * 30}ms, r 120ms ease` }} />
                    {/* 28px hit area, one tab stop (roving) */}
                    <circle ref={(el) => { dots.current[p.i] = el; }} cx={x(p.i)} cy={y(p.pct)} r="14" fill="transparent" tabIndex={focus === p.i || (focus == null && isLast) ? 0 : -1} role="img" aria-label={label}
                      onFocus={() => setFocus(p.i)} onBlur={() => setFocus((f) => (f === p.i ? null : f))} data-testid="hub-trend-point"
                      style={{ outline: "none" }} />
                    {focus === p.i && <circle cx={x(p.i)} cy={y(p.pct)} r="11" fill="none" stroke="var(--brand)" strokeWidth="2" strokeDasharray="0" />}
                  </g>
                );
              })}

              {callout && last && (
                <g pointerEvents="none" aria-hidden opacity={draw} style={{ transition: trans ?? "opacity 500ms ease 700ms" }}>
                  <rect x={callout.cx - 21} y={callout.below ? y(last.pct) + 14 : y(last.pct) - 36} width="42" height="22" rx="11" fill="var(--brand)" />
                  <text x={callout.cx} y={(callout.below ? y(last.pct) + 14 : y(last.pct) - 36) + 15} textAnchor="middle" fontSize="12" fontWeight="800" fill="white">{Math.round(last.pct)}%</text>
                </g>
              )}
              <text x={pad.l} y={H - 9} fontSize="10.5" fontWeight="600" fill="var(--ink-3)">{fmtDateShort(pts[0]?.at)}</text>
              {pts.length > 1 && <text x={pad.l + iw} y={H - 9} textAnchor="end" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">{fmtDateShort(last?.at)}</text>}
              {pts.length > 4 && wide && [Math.round((pts.length - 1) / 2)].map((i) => <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--ink-3)">{fmtDateShort(pts[i].at)}</text>)}
            </svg>
          )}
          {ap && (
            <div aria-hidden className="pointer-events-none absolute z-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px] shadow-[var(--shadow)]" style={{ left: tipLeft, top: tipTop, width: tipW }}>
              <div className="text-[18px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{Math.round(ap.pct)}%</div>
              <div className="mt-1 truncate font-bold text-[var(--ink)]">{ap.title}</div>
              <div className="truncate text-[var(--ink-3)]">{ap.subject} · {fmtDate(ap.at)}</div>
            </div>
          )}
        </div>
      )}
      <p className="m-0 mt-1 text-[11px] text-[var(--ink-3)]">Shaded bands are your levels{passMark != null ? "; the dashed line is the pass mark" : ""}. Tap or hover a dot for the quiz.</p>
    </div>
  );
}
