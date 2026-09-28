"use client";

import { useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { rich } from "../../toolTextB";
import { FOCUS } from "../../../kit";
import { useBareTool } from "../../bareContext";
import { canRedo, canUndo, commit, newHistory, redo, undo, type History } from "../../engine/state";
import type { CheckResult } from "../../engine/marking";
import type { ToolProps } from "../../types";
import { EXPERIMENTS, experimentById, type Experiment } from "./experiments";
import { barGeometry, checkAxes, checkBestFit, checkPlotted, chartScales, clean, fromPixel, groupedMeans, lineThrough, linePath, mean, niceScale, regression, repeatAnomalies, snapTo, toPixel, type ChartType, type Pt, type Scale } from "./graph";

// Results table & graph (plan S-02; also serves maths chart building M-60 / M-61).
// Tab 1: type results, see the mean and suspected anomalies, draw a graph and a line of best fit.
// Tab 2: "Plot it yourself" - choose the scale, click to plot each mean, then check.

const W = 520, H = 360, ML = 60, MR = 14, MT = 14, MB = 50;
const PX0 = ML, PX1 = W - MR, PY0 = H - MB, PY1 = MT;
const INPUT = `min-h-[40px] w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`;
const CHIP = (on: boolean) => `min-h-[40px] rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
const BTN = `min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`;
const PRIMARY = `min-h-[40px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-4 text-[13px] font-extrabold text-white ${FOCUS}`;
const num = (s: string) => { const t = s.trim(); if (t === "") return NaN; const v = Number(t); return Number.isFinite(v) ? v : NaN; };
const fmt = (v: number) => (Number.isFinite(v) ? String(clean(Number(v.toPrecision(4)))) : "");
const lab = (name: string, unit: string) => (name && unit ? `${name} (${unit})` : name || unit);

// ---------- SVG chart ----------
interface ChartProps {
  pts: Pt[]; type: ChartType; xs: Scale; ys: Scale; xLabel: string; yLabel: string; catLabels?: string[];
  minor?: { x: number; y: number }; svgRef: React.RefObject<SVGSVGElement | null>; label: string;
  onDown?: (e: React.PointerEvent) => void; onMove?: (e: React.PointerEvent) => void; onUp?: (e: React.PointerEvent) => void; children?: React.ReactNode;
}
function Chart({ pts, type, xs, ys, xLabel, yLabel, catLabels, minor, svgRef, label, onDown, onMove, onUp, children }: ChartProps) {
  const bare = useBareTool();
  const px = (v: number) => toPixel(v, xs, PX0, PX1), py = (v: number) => toPixel(v, ys, PY0, PY1);
  const bar = type === "bar", geo = barGeometry(pts.length, PX1 - PX0);
  const minorLines = (s: Scale, m: number | undefined, isX: boolean) => {
    if (!m || m <= 0) return [];
    const total = (s.max - s.min) / m; if (total > 200 || (isX ? PX1 - PX0 : PY0 - PY1) / total < 5) return [];
    return Array.from({ length: Math.round(total) + 1 }, (_, i) => clean(s.min + i * m));
  };
  const cx = (i: number, p: Pt) => (bar ? PX0 + geo.centres[i]! : px(p[0])), cy = (p: Pt) => py(p[1]);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className={`block h-auto w-full touch-none select-none ${bare ? "" : "rounded-xl border border-[var(--line)] bg-[var(--surface)]"}`}>
      {minorLines(ys, minor?.y, false).map((v) => <line key={`my${v}`} x1={PX0} x2={PX1} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth={0.4} />)}
      {!bar && minorLines(xs, minor?.x, true).map((v) => <line key={`mx${v}`} y1={PY0} y2={PY1} x1={px(v)} x2={px(v)} stroke="var(--line)" strokeWidth={0.4} />)}
      {ys.ticks.map((v) => <g key={`y${v}`}><line x1={PX0} x2={PX1} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth={1} /><text x={PX0 - 6} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{fmt(v)}</text></g>)}
      {!bar && xs.ticks.map((v) => <g key={`x${v}`}><line y1={PY0} y2={PY1} x1={px(v)} x2={px(v)} stroke="var(--line)" strokeWidth={1} /><text x={px(v)} y={PY0 + 16} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{fmt(v)}</text></g>)}
      {bar && pts.map((p, i) => <text key={`c${i}`} x={PX0 + geo.centres[i]!} y={PY0 + 16} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{catLabels?.[i] ?? fmt(p[0])}</text>)}
      <line x1={PX0} x2={PX0} y1={PY0} y2={PY1} stroke="var(--ink)" strokeWidth={1.6} /><line x1={PX0} x2={PX1} y1={PY0} y2={PY0} stroke="var(--ink)" strokeWidth={1.6} />
      <text x={(PX0 + PX1) / 2} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)">{xLabel}</text>
      <text transform={`translate(13 ${(PY0 + PY1) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)">{yLabel}</text>
      {bar && pts.map((p, i) => <rect key={`b${i}`} x={PX0 + geo.centres[i]! - geo.width / 2} width={geo.width} y={Math.min(py(p[1]), py(0))} height={Math.abs(py(0) - py(p[1]))} fill="var(--brand)" opacity={0.75} />)}
      {type === "line" && pts.length > 1 && <path d={linePath(pts.map((p, i) => [cx(i, p), cy(p)] as Pt))} fill="none" stroke="var(--brand)" strokeWidth={2} />}
      {!bar && pts.map((p, i) => <g key={`p${i}`} stroke="var(--brand)" strokeWidth={2}><line x1={cx(i, p) - 5} x2={cx(i, p) + 5} y1={cy(p) - 5} y2={cy(p) + 5} /><line x1={cx(i, p) - 5} x2={cx(i, p) + 5} y1={cy(p) + 5} y2={cy(p) - 5} /></g>)}
      {children}
    </svg>
  );
}
function useToData(svgRef: React.RefObject<SVGSVGElement | null>, xs: Scale, ys: Scale) {
  return (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current, m = svg?.getScreenCTM(); if (!svg || !m) return [0, 0];
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const w = p.matrixTransform(m.inverse());
    return [fromPixel(w.x, xs, PX0, PX1), fromPixel(w.y, ys, PY0, PY1)];
  };
}

// ---------- read-only or editable results table ----------
interface TRow { x: string; reps: string[] }
interface Analysed { rows: { x: number; reps: number[]; idx: number[]; orig: number }[]; flagged: Set<string>; means: (number | null)[]; pts: Pt[] }
function analyse(rows: TRow[], dropAnoms: boolean): Analysed {
  const valid = rows.map((r, orig) => { const reps: number[] = [], idx: number[] = []; r.reps.forEach((s, j) => { const v = num(s); if (!Number.isNaN(v)) { reps.push(v); idx.push(j); } }); return { x: num(r.x), reps, idx, orig }; }).filter((r) => !Number.isNaN(r.x) && r.reps.length);
  const flagged = new Set(repeatAnomalies(valid).map(([i, j]) => `${valid[i]!.orig}:${valid[i]!.idx[j]}`));
  const means: (number | null)[] = rows.map(() => null); const pts: Pt[] = [];
  valid.forEach((r) => { const keep = r.reps.filter((_, j) => !(dropAnoms && flagged.has(`${r.orig}:${r.idx[j]}`))); if (keep.length) { means[r.orig] = mean(keep); pts.push([r.x, means[r.orig]!]); } });
  return { rows: valid, flagged, means, pts };
}
function ResultsTable({ rows, xHead, yHead, reps, flagged, means, onCell, readOnly }: { rows: TRow[]; xHead: string; yHead: string; reps: number; flagged: Set<string>; means: (number | null)[]; onCell?: (r: number, c: number, v: string) => void; readOnly?: boolean; }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
      <table className="w-full border-collapse text-[13px] text-[var(--ink)]">
        <caption className="sr-only">{t("hubtoolsb.sc_dt_caption")}</caption>
        <thead><tr className="bg-[var(--panel)] text-start text-[12px] font-extrabold">
          <th scope="col" className="min-w-[88px] p-2 text-start">{xHead || t("hubtoolsb.sc_dt_varChange")}</th>
          {Array.from({ length: reps }, (_, j) => <th scope="col" key={j} className="min-w-[72px] p-2 text-start">{t("hubtoolsb.sc_dt_reading", { n: j + 1 })}</th>)}
          <th scope="col" className="min-w-[80px] p-2 text-start">{t("hubtoolsb.sc_dt_mean")} {yHead ? `(${yHead})` : ""}</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--line)]">
            <td className="p-1">{readOnly ? <span className="px-1 font-bold">{r.x}</span> : <input aria-label={t("hubtoolsb.sc_dt_rowX", { i: i + 1, name: xHead || t("hubtoolsb.sc_dt_xValue") })} inputMode="decimal" className={INPUT} value={r.x} onChange={(e) => onCell?.(i, -1, e.target.value)} />}</td>
            {Array.from({ length: reps }, (_, j) => { const bad = flagged.has(`${i}:${j}`); return (
              <td key={j} className="p-1">{readOnly ? <span className="px-1">{r.reps[j]}{bad && <span title={t("hubtoolsb.sc_dt_anom")}> ⚠</span>}</span> : (
                <div className="flex items-center gap-1"><input aria-label={t(bad ? "hubtoolsb.sc_dt_rowReadBad" : "hubtoolsb.sc_dt_rowRead", { i: i + 1, j: j + 1 })} inputMode="decimal" className={`${INPUT} ${bad ? "border-dashed border-[var(--ink)]" : ""}`} value={r.reps[j] ?? ""} onChange={(e) => onCell?.(i, j, e.target.value)} />
                  {bad && <span role="img" aria-label={t("hubtoolsb.sc_dt_anomLc")} title={t("hubtoolsb.sc_dt_anomLong")} className="text-[16px] font-black">⚠</span>}</div>)}</td>); })}
            <td className="p-2 font-extrabold">{means[i] === null || means[i] === undefined ? "" : fmt(means[i]!)}</td>
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}
function AxisInputs({ xl, xu, yl, yu, set }: { xl: string; xu: string; yl: string; yu: string; set: (k: "xl" | "xu" | "yl" | "yu", v: string) => void }) {
  const t = useT();
  const f = (t: string, k: "xl" | "xu" | "yl" | "yu", v: string) => <label className="grid gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{t}<input className={INPUT} value={v} onChange={(e) => set(k, e.target.value)} /></label>;
  return <div className="grid grid-cols-2 gap-2">{f(t("hubtoolsb.sc_dt_xLabel"), "xl", xl)}{f(t("hubtoolsb.sc_dt_xUnit"), "xu", xu)}{f(t("hubtoolsb.sc_dt_yLabel"), "yl", yl)}{f(t("hubtoolsb.sc_dt_yUnit"), "yu", yu)}</div>;
}
const Feedback = ({ r }: { r: CheckResult }) => <div role="status" className="grid gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[13px] font-semibold text-[var(--ink)]"><b>{r.score} / {r.max}</b>{r.feedback.map((f, i) => <span key={i}>{f}</span>)}</div>;

// ---------- tab 1: table + graph ----------
function TableGraph({ assess }: { assess: boolean }) {
  const t = useT();
  const [heads, setHeads] = useState({ xn: "", xu: "", yn: "", yu: "" });
  const [reps, setReps] = useState(3);
  const [rows, setRows] = useState<TRow[]>(() => Array.from({ length: 5 }, () => ({ x: "", reps: ["", "", ""] })));
  const [dropAnoms, setDropAnoms] = useState(true);
  const [type, setType] = useState<ChartType>("scatter");
  const [zero, setZero] = useState(true);
  const [axes, setAxes] = useState({ xl: "", xu: "", yl: "", yu: "" });
  const [fit, setFit] = useState<[Pt, Pt] | null>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const [origin, setOrigin] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [res, setRes] = useState<CheckResult | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const an = useMemo(() => analyse(rows, dropAnoms), [rows, dropAnoms]);
  const { x: xs, y: ys } = useMemo(() => chartScales(an.pts, type, zero), [an.pts, type, zero]);
  const toData = useToData(svgRef, xs, ys);
  const reg = useMemo(() => regression(an.pts, origin), [an.pts, origin]);
  const mine = fit ? lineThrough(fit[0], fit[1]) : null;

  const load = (id: string) => {
    if (!id) { setHeads({ xn: "", xu: "", yn: "", yu: "" }); setReps(3); setRows(Array.from({ length: 5 }, () => ({ x: "", reps: ["", "", ""] }))); setAxes({ xl: "", xu: "", yl: "", yu: "" }); }
    else { const e = experimentById(id) as Experiment; setHeads({ xn: e.independent.name, xu: e.independent.unit, yn: e.dependent.name, yu: e.dependent.unit }); setReps(e.repeats); setRows(e.rows.map((r) => ({ x: String(r.x), reps: r.reps.map(String) }))); setAxes({ xl: e.independent.name, xu: e.independent.unit, yl: e.dependent.name, yu: e.dependent.unit }); }
    setFit(null); setReveal(false); setRes(null);
  };
  const cell = (r: number, c: number, v: string) => setRows((rs) => rs.map((row, i) => (i !== r ? row : c < 0 ? { ...row, x: v } : { ...row, reps: row.reps.map((s, j) => (j === c ? v : s)) })));
  const addRep = () => { if (reps >= 6) return; setReps(reps + 1); setRows((rs) => rs.map((r) => ({ ...r, reps: [...r.reps, ""] }))); };
  const dropRep = () => { if (reps <= 1) return; setReps(reps - 1); setRows((rs) => rs.map((r) => ({ ...r, reps: r.reps.slice(0, -1) }))); };
  const startFit = () => { const yr = ys.max - ys.min; setFit([[xs.min, ys.min + 0.3 * yr], [xs.max, ys.min + 0.7 * yr]]); setRes(null); };
  const clampPt = (p: Pt): Pt => [Math.max(xs.min, Math.min(xs.max, p[0])), Math.max(ys.min, Math.min(ys.max, p[1]))];
  const move = (e: React.PointerEvent) => { if (drag === null || !fit) return; const p = clampPt(toData(e)); setFit(drag === 0 ? [p, fit[1]] : [fit[0], p]); };
  const ARROWS: Record<string, Pt> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const key = (i: 0 | 1) => (e: React.KeyboardEvent) => {
    const v = ARROWS[e.key]; if (!fit || !v) return; e.preventDefault();
    const p = clampPt([fit[i][0] + v[0] * (xs.max - xs.min) / 50, fit[i][1] + v[1] * (ys.max - ys.min) / 50]); setFit(i === 0 ? [p, fit[1]] : [fit[0], p]);
  };
  const seg: [Pt, Pt] | null = reveal && reg ? [[xs.min, reg.gradient * xs.min + reg.intercept], [xs.max, reg.gradient * xs.max + reg.intercept]] : null;
  const clipY = (p: Pt) => Math.max(PY1, Math.min(PY0, toPixel(p[1], ys, PY0, PY1)));
  const gUnit = axes.yu && axes.xu ? ` ${axes.yu}/${axes.xu}` : "";
  const catLabels = rows.filter((_, i) => an.means[i] !== null).map((r) => r.x);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_start")}
          <select className={INPUT} defaultValue="" onChange={(e) => load(e.target.value)}><option value="">{t("hubtoolsb.sc_dt_blankTable")}</option>{EXPERIMENTS.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          {([["xn", t("hubtoolsb.sc_dt_varChange")], ["xu", t("hubtoolsb.sc_dt_itsUnit")], ["yn", t("hubtoolsb.sc_dt_varMeasure")], ["yu", t("hubtoolsb.sc_dt_itsUnit")]] as const).map(([k, tl]) => <label key={k} className="grid gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{tl}<input className={INPUT} value={heads[k]} onChange={(e) => setHeads({ ...heads, [k]: e.target.value })} /></label>)}
        </div>
      </div>
      <ResultsTable rows={rows} xHead={lab(heads.xn, heads.xu)} yHead={heads.yu} reps={reps} flagged={an.flagged} means={an.means} onCell={cell} />
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hubtoolsb.sc_dt_tableTools")}>
        <button type="button" className={BTN} onClick={() => setRows([...rows, { x: "", reps: Array(reps).fill("") }])}>{t("hubtoolsb.sc_dt_addRow")}</button>
        <button type="button" className={BTN} disabled={rows.length <= 2} onClick={() => setRows(rows.slice(0, -1))}>{t("hubtoolsb.sc_dt_delRow")}</button>
        <button type="button" className={BTN} disabled={reps >= 6} onClick={addRep}>{t("hubtoolsb.sc_dt_addRep")}</button>
        <button type="button" className={BTN} disabled={reps <= 1} onClick={dropRep}>{t("hubtoolsb.sc_dt_delRep")}</button>
        <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={dropAnoms} onChange={(e) => setDropAnoms(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsb.sc_dt_leaveOut")}</label>
      </div>
      {an.flagged.size > 0 && <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_anomNote")}</p>}

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hubtoolsb.sc_dt_chartType")}>
        {(["scatter", "line", "bar"] as const).map((ct) => <button key={ct} type="button" aria-pressed={type === ct} className={CHIP(type === ct)} onClick={() => setType(ct)}>{t(`hubtoolsb.sc_dt_${ct}`)}</button>)}
        <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={zero} disabled={type === "bar"} onChange={(e) => setZero(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsb.sc_dt_zero")}</label>
      </div>
      <AxisInputs {...axes} set={(k, v) => setAxes({ ...axes, [k]: v })} />
      {an.pts.length === 0 ? <p className="m-0 rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_empty")}</p> : (
        <Chart pts={an.pts} type={type} xs={xs} ys={ys} xLabel={lab(axes.xl, axes.xu)} yLabel={lab(axes.yl, axes.yu)} catLabels={catLabels} svgRef={svgRef} label={t("hubtoolsb.sc_dt_graphAria", { type: t(`hubtoolsb.sc_dt_${type}`), n: an.pts.length })} onMove={move} onUp={() => setDrag(null)}>
          {seg && <line x1={toPixel(seg[0][0], xs, PX0, PX1)} x2={toPixel(seg[1][0], xs, PX0, PX1)} y1={clipY(seg[0])} y2={clipY(seg[1])} stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 4" />}
          {fit && type !== "bar" && (<>
            <line x1={toPixel(fit[0][0], xs, PX0, PX1)} y1={toPixel(fit[0][1], ys, PY0, PY1)} x2={toPixel(fit[1][0], xs, PX0, PX1)} y2={toPixel(fit[1][1], ys, PY0, PY1)} stroke="var(--brand-2)" strokeWidth={2.4} />
            {([0, 1] as const).map((i) => <circle key={i} tabIndex={0} role="button" aria-label={t("hubtoolsb.sc_dt_handle", { n: i + 1 })} onKeyDown={key(i)} onPointerDown={(e) => { svgRef.current?.setPointerCapture(e.pointerId); setDrag(i); e.stopPropagation(); }}
              cx={toPixel(fit[i][0], xs, PX0, PX1)} cy={toPixel(fit[i][1], ys, PY0, PY1)} r={9} fill="var(--surface)" stroke="var(--brand-2)" strokeWidth={3} className="cursor-grab outline-none focus-visible:stroke-[var(--ink)]" />)}
          </>)}
        </Chart>)}
      {type !== "bar" && an.pts.length >= 2 && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={PRIMARY} onClick={startFit}>{fit ? t("hubtoolsb.sc_dt_resetLine") : t("hubtoolsb.sc_dt_drawLine")}</button>
            <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={origin} onChange={(e) => { setOrigin(e.target.checked); setReveal(false); }} className="accent-[var(--brand)]" />{t("hubtoolsb.sc_dt_origin")}</label>
            {!assess && <button type="button" className={BTN} disabled={!reg} onClick={() => setReveal(!reveal)}>{reveal ? t("hubtoolsb.sc_dt_hideLine") : t("hubtoolsb.sc_dt_revealLine")}</button>}
            {!assess && fit && <button type="button" className={BTN} onClick={() => setRes(checkBestFit(mine, an.pts, 15, origin, t))}>{t("hubtoolsb.sc_dt_checkLine")}</button>}
          </div>
          {fit && <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_dragInfo")}{mine && <> {t("hubtoolsb.sc_dt_yourLine", { g: fmt(mine.gradient), u: gUnit, c: fmt(mine.intercept) })}</>}</p>}
          {!assess && reveal && reg && <p role="status" className="m-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[13px] font-bold text-[var(--ink)]">{t(origin ? "hubtoolsb.sc_dt_computedOrigin" : "hubtoolsb.sc_dt_computed", { g: fmt(reg.gradient), u: gUnit, c: fmt(reg.intercept), r: fmt(reg.r2) })}</p>}
          {!assess && res && <Feedback r={res} />}
        </div>)}
    </div>
  );
}

// ---------- tab 2: plot it yourself ----------
interface PlotState { pts: Pt[] }
function PlotYourself({ assess }: { assess: boolean }) {
  const t = useT();
  const [id, setId] = useState(EXPERIMENTS[0]!.id);
  const exp = experimentById(id) as Experiment;
  const rows: TRow[] = exp.rows.map((r) => ({ x: String(r.x), reps: r.reps.map(String) }));
  const an = useMemo(() => analyse(rows, true), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const expected = useMemo(() => groupedMeans(exp.rows, true), [exp]);
  const [h, setH] = useState<History<PlotState>>(() => newHistory({ pts: [] }));
  const [axes, setAxes] = useState({ xl: "", xu: "", yl: "", yu: "" });
  const [sc, setSc] = useState({ xmax: "10", xstep: "1", ymax: "10", ystep: "1" });
  const [erase, setErase] = useState(false);
  const [tx, setTx] = useState(""), [ty, setTy] = useState("");
  const [res, setRes] = useState<CheckResult | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pts = h.present.pts;

  const mk = (max: string, step: string): Scale => {
    const m = num(max), s = num(step);
    if (!(m > 0) || !(s > 0) || m / s > 50) return { min: 0, max: 10, step: 1, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    const n = Math.floor(m / s + 1e-9); return { min: 0, max: clean(n * s), step: s, ticks: Array.from({ length: n + 1 }, (_, i) => clean(i * s)) };
  };
  const xs = mk(sc.xmax, sc.xstep), ys = mk(sc.ymax, sc.ystep);
  const minor = { x: xs.step / 5, y: ys.step / 5 };
  const toData = useToData(svgRef, xs, ys);
  const setPts = (p: Pt[]) => { setH((x) => commit(x, { pts: p })); setRes(null); };
  const inside = (p: Pt) => p[0] >= xs.min - 1e-9 && p[0] <= xs.max + 1e-9 && p[1] >= ys.min - 1e-9 && p[1] <= ys.max + 1e-9;
  const click = (e: React.PointerEvent) => {
    const d = toData(e);
    if (erase) { let bi = -1, bd = Infinity; pts.forEach((p, i) => { const dd = Math.hypot(toPixel(p[0], xs, PX0, PX1) - toPixel(d[0], xs, PX0, PX1), toPixel(p[1], ys, PY0, PY1) - toPixel(d[1], ys, PY0, PY1)); if (dd < bd) { bd = dd; bi = i; } }); if (bi >= 0 && bd < 40) setPts(pts.filter((_, i) => i !== bi)); return; }
    const p: Pt = [snapTo(d[0], minor.x), snapTo(d[1], minor.y)];
    if (inside(p) && !pts.some((q) => q[0] === p[0] && q[1] === p[1])) setPts([...pts, p]);
  };
  const addTyped = () => { const x = num(tx), y = num(ty); if (Number.isNaN(x) || Number.isNaN(y) || !inside([x, y])) return; setPts([...pts, [x, y]]); setTx(""); setTy(""); };
  const suggest = () => { const a = niceScale(0, Math.max(...expected.map((p) => p[0])), 6), b = niceScale(0, Math.max(...expected.map((p) => p[1])), 6); setSc({ xmax: String(a.max), xstep: String(a.step), ymax: String(b.max), ystep: String(b.step) }); setRes(null); };
  const check = () => {
    const a = checkPlotted(pts, expected, { x: minor.x * 0.75, y: minor.y * 0.75 }, t);
    const xv = expected.map((p) => p[0]), yv = expected.map((p) => p[1]);
    const b = checkAxes({ xLabel: axes.xl, xUnit: axes.xu, yLabel: axes.yl, yUnit: axes.yu, xTicks: xs.ticks, yTicks: ys.ticks, xData: [Math.min(...xv), Math.max(...xv)], yData: [Math.min(...yv), Math.max(...yv)], needUnits: !!(exp.independent.unit && exp.dependent.unit) }, t);
    setRes({ score: a.score + b.score, max: a.max + b.max, feedback: [...a.feedback, ...b.feedback], log: { plot: a.log, axes: b.log } });
  };
  const pick = (v: string) => { setId(v); setH(newHistory({ pts: [] })); setRes(null); setAxes({ xl: "", xu: "", yl: "", yu: "" }); };

  return (
    <div className="grid gap-3">
      <label data-tool-chrome className="grid gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_practical")}
        <select className={INPUT} value={id} onChange={(e) => pick(e.target.value)}>{EXPERIMENTS.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <p data-tool-chrome className="m-0 text-[13px] font-semibold text-[var(--ink)]">{rich(t("hubtoolsb.sc_dt_plotInfo", { x: lab(exp.independent.name, exp.independent.unit), y: lab(exp.dependent.name, exp.dependent.unit) }))}</p>
      <div data-tool-chrome><ResultsTable rows={rows} xHead={lab(exp.independent.name, exp.independent.unit)} yHead={exp.dependent.unit} reps={exp.repeats} flagged={an.flagged} means={rows.map(() => null)} readOnly /></div>
      <p data-tool-chrome className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_workMean")}</p>
      <div data-tool-chrome><AxisInputs {...axes} set={(k, v) => { setAxes({ ...axes, [k]: v }); setRes(null); }} /></div>
      <div data-tool-chrome data-tool-strip className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["xmax", t("hubtoolsb.sc_dt_xTop")], ["xstep", t("hubtoolsb.sc_dt_xStep")], ["ymax", t("hubtoolsb.sc_dt_yTop")], ["ystep", t("hubtoolsb.sc_dt_yStep")]] as const).map(([k, tl]) => <label key={k} className="grid gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{tl}<input inputMode="decimal" className={INPUT} value={sc[k]} onChange={(e) => { setSc({ ...sc, [k]: e.target.value }); setH(newHistory({ pts: [] })); setRes(null); }} /></label>)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hubtoolsb.sc_dt_plotTools")} data-tool-strip>
        <button type="button" aria-pressed={!erase} className={CHIP(!erase)} onClick={() => setErase(false)}>{t("hubtoolsb.sc_dt_plot")}</button>
        <button type="button" aria-pressed={erase} className={CHIP(erase)} onClick={() => setErase(true)}>{t("hubtoolsb.sc_dt_rubOut")}</button>
        <button type="button" className={BTN} aria-label={t("hubtoolsb.sc_dt_undo")} disabled={!canUndo(h)} onClick={() => { setH(undo); setRes(null); }}>↶</button>
        <button type="button" className={BTN} aria-label={t("hubtoolsb.sc_dt_redo")} disabled={!canRedo(h)} onClick={() => { setH(redo); setRes(null); }}>↷</button>
        <button type="button" className={BTN} disabled={!pts.length} onClick={() => setPts([])}>{t("hubtoolsb.sc_dt_clear")}</button>
        {!assess && <button data-tool-chrome type="button" className={BTN} onClick={suggest}>{t("hubtoolsb.sc_dt_suggest")}</button>}
      </div>
      <Chart pts={pts} type="scatter" xs={xs} ys={ys} xLabel={lab(axes.xl, axes.xu)} yLabel={lab(axes.yl, axes.yu)} minor={minor} svgRef={svgRef} label={t("hubtoolsb.sc_dt_paperAria")} onDown={click} />
      <div data-tool-chrome className="flex flex-wrap items-end gap-2">
        <label className="grid w-24 gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_xValue")}<input inputMode="decimal" className={INPUT} value={tx} onChange={(e) => setTx(e.target.value)} /></label>
        <label className="grid w-24 gap-0.5 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_dt_yValue")}<input inputMode="decimal" className={INPUT} value={ty} onChange={(e) => setTy(e.target.value)} /></label>
        <button type="button" className={BTN} onClick={addTyped}>{t("hubtoolsb.sc_dt_addPoint")}</button>
        <span className="min-h-[40px] content-center text-[12.5px] font-bold text-[var(--ink-2)]" aria-live="polite">{t("hubtoolsb.sc_dt_plotted", { n: pts.length, m: expected.length })}</span>
      </div>
      {!assess && <div data-tool-chrome><button type="button" className={PRIMARY} onClick={check}>{t("hubtoolsb.sc_dt_check")}</button></div>}
      {!assess && res && <div data-tool-chrome><Feedback r={res} /></div>}
    </div>
  );
}

export default function DataGraph(props: Partial<ToolProps>) {
  const bare = useBareTool();
  const t = useT();
  const assess = props.mode === "assess";
  const [tabSel, setTab] = useState<"table" | "plot">("table");
  const tab = bare ? "plot" : tabSel; // "Just the tool": the graph paper you plot on
  return (
    <div className="grid gap-3" data-testid="data-graph">
      <div data-tool-chrome className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("hubtoolsb.sc_dt_tabs")}>
        <button role="tab" type="button" aria-selected={tab === "table"} className={CHIP(tab === "table")} onClick={() => setTab("table")}>{t("hubtoolsb.sc_dt_tabTable")}</button>
        <button role="tab" type="button" aria-selected={tab === "plot"} className={CHIP(tab === "plot")} onClick={() => setTab("plot")}>{t("hubtoolsb.sc_dt_tabPlot")}</button>
      </div>
      <div role="tabpanel">{tab === "table" ? <TableGraph assess={assess} /> : <PlotYourself assess={assess} />}</div>
    </div>
  );
}
