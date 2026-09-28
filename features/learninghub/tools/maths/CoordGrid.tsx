"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { feedbackText, promptText } from "../toolText";
import { FOCUS } from "../../kit";
import { useBareTool } from "../bareContext";
import type { Pt } from "../engine/geometry";
import { canRedo, canUndo, commit, newHistory, redo, undo, type History } from "../engine/state";
import { newSeed } from "../engine/rng";
import type { CheckResult } from "../engine/marking";
import type { ToolProps } from "../types";
import { GENERATORS, markProblem, type Problem } from "./geometry/generators";
import type { PublicProblem } from "../problems";
import { DEFAULT_TOL } from "./geometry/model";
import { DEFAULT_AXES, extendLine, suggestGridAxes, zoomGrid, type GridAxes } from "./gridRange";

// Coordinate grid (plan M-21): four quadrants, click to plot (snaps to the grid step; half-steps optional), drag to move, join the points, draw straight lines
// (optionally extended to the edges), a typed-number way to add points, and SETTABLE AXES (min / max / step) that open fitted to a question's own coordinates
// (`prompt`) with zoom in / out. It never plots, joins or transforms anything for the child. Practise mode serves "plot these points" questions (M-G03);
// `help` (the lesson side-tool) hides that practice panel so only the working grid shows.

interface GridState { pts: Pt[]; join: boolean; lines: [Pt, Pt][] }
const clean = (n: number) => Number(n.toFixed(6));

export default function CoordGrid({ mode = "practise", compact = false, help = false, prompt, problem: problemProp = null, initialPoints, onAnswer }: Partial<ToolProps> & { compact?: boolean; help?: boolean; prompt?: string; problem?: Problem | PublicProblem | null; initialPoints?: Pt[]; onAnswer?: (a: { points: Pt[] }) => void }) {
  const t = useT();
  const bareTool = useBareTool();
  const assess = mode === "assess";
  const [h, setH] = useState<History<GridState>>(() => newHistory({ pts: initialPoints ?? [], join: false, lines: [] }));
  const [axes, setAxes] = useState<GridAxes>(() => (prompt ? suggestGridAxes(prompt) : null) ?? DEFAULT_AXES);
  const [half, setHalf] = useState(false);
  const [tool, setTool] = useState<"plot" | "line" | "erase">("plot");
  const [extend, setExtend] = useState(true);
  const [pending, setPending] = useState<Pt | null>(null);
  const [readout, setReadout] = useState(!assess && !bareTool);
  useEffect(() => { setReadout(!assess && !bareTool); }, [bareTool, assess]); // "Just the tool" starts with the read-outs off; the strip keeps the switch
  const [hover, setHover] = useState<Pt | null>(null);
  const [dragI, setDragI] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | PublicProblem | null>(problemProp);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [tx, setTx] = useState(""), [ty, setTy] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState<Pt[] | null>(null);
  const state = h.present, pts = live ?? state.pts;
  const erase = tool === "erase";
  const { min, max } = axes;
  const span = max - min, k = span / 20; // sizes were drawn for a 20-unit grid; scale them to the axes shown
  const snapStep = half ? axes.step / 2 : axes.step;

  const clampV = (n: number) => Math.max(min, Math.min(max, n));
  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!, m = svg.getScreenCTM(); if (!m) return [0, 0];
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const w = p.matrixTransform(m.inverse()); return [w.x, -w.y]; // y up
  };
  const snap = (p: Pt): Pt => [clean(clampV(Math.round(p[0] / snapStep) * snapStep)), clean(clampV(Math.round(p[1] / snapStep) * snapStep))];
  const put = (next: Partial<GridState>) => setH((x) => commit(x, { ...x.present, pts: pts, ...next }));
  const setPts = (next: Pt[]) => put({ pts: next });

  const down = (e: React.PointerEvent) => {
    const p = toWorld(e); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setResult(null);
    const near = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= 0.7 * k);
    if (tool === "erase") { if (near >= 0) setPts(pts.filter((_, i) => i !== near)); return; }
    if (tool === "line") {
      const q = near >= 0 ? pts[near]! : snap(p);
      if (!pending) { setPending(q); return; }
      if (pending[0] !== q[0] || pending[1] !== q[1]) put({ lines: [...state.lines, [pending, q]] });
      setPending(null); return;
    }
    if (near >= 0) { setDragI(near); return; }
    setPts([...pts, snap(p)]);
  };
  const move = (e: React.PointerEvent) => { const p = toWorld(e); setHover(p); if (dragI !== null) setLive(pts.map((q, i) => (i === dragI ? snap(p) : q))); };
  const up = (e: React.PointerEvent) => { if (dragI !== null) { const p = snap(toWorld(e)); setLive(null); setPts(state.pts.map((q, i) => (i === dragI ? p : q))); setDragI(null); } };

  const addTyped = () => { const x = Number(tx), y = Number(ty); if (tx.trim() === "" || ty.trim() === "" || Number.isNaN(x) || Number.isNaN(y)) return; setPts([...pts, [clean(clampV(x)), clean(clampV(y))]]); setTx(""); setTy(""); setResult(null); };
  const newQ = () => { const p = GENERATORS["M-G03.plot"]!(newSeed()); setProblem(p); setH(newHistory({ pts: [], join: false, lines: [] })); setResult(null); };
  const check = () => { if (problem && "checkerId" in problem) setResult(markProblem(problem, { points: pts }, DEFAULT_TOL)); };
  const lastEmit = useRef("");
  useEffect(() => { if (!onAnswer) return; const j = JSON.stringify(state.pts); if (j === lastEmit.current) return; lastEmit.current = j; onAnswer({ points: state.pts }); }, [state.pts, onAnswer]);

  const setAxis = (patch: Partial<GridAxes>) => setAxes((a) => { const n = { ...a, ...patch }; return n.max > n.min && n.step > 0 && (n.max - n.min) / n.step <= 60 ? n : a; });
  const zoom = (f: number) => { setAxes((a) => zoomGrid(a, f)); setPending(null); };

  const ticks = useMemo(() => { const n = Math.min(60, Math.round(span / axes.step)); return Array.from({ length: n + 1 }, (_, i) => clean(min + i * axes.step)); }, [min, span, axes.step]);
  const labelEvery = Math.max(1, Math.ceil(ticks.length / 11));
  const pad = 1.8 * k, arrow = 0.6 * k;
  const ox = min <= 0 && max >= 0 ? 0 : min, oy = min <= 0 && max >= 0 ? 0 : min; // axes cross at 0 when it is on the grid, else at the edge
  const btn = `min-h-[44px] rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS}`;
  const on = (b: boolean) => (b ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]");
  const num = `min-h-[40px] w-20 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`;
  const ends = (l: [Pt, Pt]) => (extend ? extendLine(l[0], l[1], axes) ?? l : l);
  return (
    <div className="grid gap-3" data-testid="coord-grid">
      <div data-tool-chrome className="contents">{!help && (problem ? (
        <div role="region" aria-label={t("hubtoolsa.c_question")} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{promptText(t, problem.prompt)}</p>
          <div className="mt-2 flex flex-wrap gap-2">{!onAnswer && <Button variant="primary" onClick={check}>{assess ? t("hubtoolsa.c_handIn") : t("hubtoolsa.c_check")}</Button>}{!assess && <Button onClick={newQ}>{t("hubtoolsa.c_tryAnother")}</Button>}</div>
          {result && !assess && <div role="status" className="mt-2 grid gap-1 text-[13px] font-semibold text-[var(--ink)]"><b>{result.score} / {result.max}</b>{result.feedback.map((f, i) => <span key={i}>{feedbackText(t, f)}</span>)}</div>}
        </div>
      ) : !assess && <div><Button variant="primary" onClick={newQ}>{t("hubtoolsa.g_practisePlot")}</Button></div>)}</div>

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hubtoolsa.g_tools")} data-tool-strip>
        {([[t("hubtoolsa.g_plot"), "plot"], [t("hubtoolsa.b_line"), "line"], [t("hubtoolsa.b_rubout"), "erase"]] as const).map(([label, id]) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => { setTool(id); setPending(null); }} data-testid={`grid-tool-${id}`} className={`${btn} ${on(tool === id)}`}>{label}</button>)}
        {tool === "line" && <label className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={extend} onChange={(e) => setExtend(e.target.checked)} className="accent-[var(--brand)]" data-testid="grid-extend" />{t("hubtoolsa.g_extend")}</label>}
        <label data-tool-chrome className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsa.g_half")}</label>
        <label className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={state.join} onChange={(e) => put({ join: e.target.checked })} className="accent-[var(--brand)]" />{t("hubtoolsa.g_join")}</label>
        <button type="button" disabled={!canUndo(h)} onClick={() => setH(undo)} className={`${btn} ${on(false)} disabled:opacity-40`} aria-label={t("hubtoolsa.c_undo")} data-testid="grid-undo">↶</button>
        <button type="button" disabled={!canRedo(h)} onClick={() => setH(redo)} className={`${btn} ${on(false)} disabled:opacity-40`} aria-label={t("hubtoolsa.c_redo")}>↷</button>
        <button type="button" onClick={() => { put({ pts: [], lines: [] }); setPending(null); }} className={`${btn} ${on(false)}`} data-testid="grid-clear">{t("hubtoolsa.c_clear")}</button>
        {!assess && <label className="ms-auto inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={readout} onChange={(e) => setReadout(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsa.g_showCoords")}</label>}
      </div>

      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("hubtoolsa.g_axes")} data-tool-strip>
        <b data-tool-chrome className="text-[12.5px] text-[var(--ink)]">{t("hubtoolsa.g_axes")}</b>
        <label data-tool-chrome className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.g_from")}<input type="number" value={axes.min} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAxis({ min: v }); }} className={num} data-testid="grid-axis-min" aria-label={t("hubtoolsa.g_axesFrom")} /></label>
        <label data-tool-chrome className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.g_to")}<input type="number" value={axes.max} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAxis({ max: v }); }} className={num} data-testid="grid-axis-max" aria-label={t("hubtoolsa.g_axesTo")} /></label>
        <label data-tool-chrome className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.g_step")}<input type="number" step="any" value={axes.step} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAxis({ step: v }); }} className={num} data-testid="grid-axis-step" aria-label={t("hubtoolsa.g_gridStep")} /></label>
        <button type="button" onClick={() => zoom(0.5)} className={`${btn} ${on(false)}`} data-testid="grid-zoom-in" aria-label={t("hubtoolsa.g_zoomIn")}>{t("hubtoolsa.g_zoomIn")}</button>
        <button type="button" onClick={() => zoom(2)} className={`${btn} ${on(false)}`} data-testid="grid-zoom-out" aria-label={t("hubtoolsa.g_zoomOut")}>{t("hubtoolsa.g_zoomOut")}</button>
      </div>

      <div className={`mx-auto w-full overflow-hidden ${bareTool ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)]"}`} style={{ maxWidth: compact ? 420 : 560 }}>
        <svg ref={svgRef} viewBox={`${min - pad} ${-(max + pad)} ${span + 2 * pad} ${span + 2 * pad}`} role="application" aria-label={t("hubtoolsa.g_svgAria", { min, max })} style={{ width: "100%", touchAction: "none", cursor: erase ? "not-allowed" : "crosshair", display: "block" }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)}>
          <g stroke="color-mix(in srgb, var(--brand-2) 22%, transparent)" strokeWidth={0.05 * k}>{ticks.map((t) => <g key={t}><line x1={t} y1={-max} x2={t} y2={-min} /><line x1={min} y1={-t} x2={max} y2={-t} /></g>)}</g>
          <g stroke="var(--ink)" strokeWidth={0.13 * k}><line x1={min - arrow} y1={-oy} x2={max + arrow} y2={-oy} /><line x1={ox} y1={-(min - arrow)} x2={ox} y2={-(max + arrow)} /></g>
          <path d={`M${max + arrow} ${-oy}l${-0.5 * k} ${-0.3 * k}v${0.6 * k}zM${ox} ${-(max + arrow)}l${-0.3 * k} ${0.5 * k}h${0.6 * k}z`} fill="var(--ink)" />
          <g fontSize={0.62 * k} fill="var(--ink-2)" textAnchor="middle" style={{ userSelect: "none" }}>
            {ticks.filter((t, i) => t !== 0 && i % labelEvery === 0).map((t) => <g key={t}><text x={t} y={-oy + 0.95 * k}>{t}</text><text x={ox - 0.5 * k} y={-t + 0.22 * k} textAnchor="end">{t}</text></g>)}
            {min <= 0 && max >= 0 && <text x={-0.45 * k} y={0.9 * k} textAnchor="end">0</text>}<text x={max + 1.1 * k} y={-oy + 0.9 * k} fontWeight={700}>x</text><text x={ox + 0.6 * k} y={-(max + 0.9 * k)} fontWeight={700}>y</text>
          </g>
          {state.lines.map((l, i) => { const e = ends(l); return <line key={`l${i}`} x1={e[0][0]} y1={-e[0][1]} x2={e[1][0]} y2={-e[1][1]} stroke="var(--brand-strong, var(--brand))" strokeWidth={0.12 * k} strokeLinecap="round" />; })}
          {state.join && pts.length > 1 && <polyline points={pts.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth={0.12 * k} />}
          {pending && <circle cx={pending[0]} cy={-pending[1]} r={0.5 * k} fill="none" stroke="var(--gold, #f5b81f)" strokeWidth={0.12 * k} strokeDasharray={`${0.2 * k} ${0.2 * k}`} />}
          {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={-p[1]} r={0.3 * k} fill="var(--brand)" stroke="var(--surface)" strokeWidth={0.06 * k} />{readout && <text x={p[0] + 0.45 * k} y={-p[1] - 0.4 * k} fontSize={0.62 * k} fontWeight={700} fill="var(--ink)" style={{ userSelect: "none" }}>({p[0]}, {p[1]})</text>}</g>)}
          {readout && hover && hover[0] >= min - 0.5 * k && hover[0] <= max + 0.5 * k && hover[1] >= min - 0.5 * k && hover[1] <= max + 0.5 * k && <text x={min - pad + 0.4 * k} y={-(max + pad) + 1.1 * k} fontSize={0.7 * k} fontWeight={800} fill="var(--brand)" style={{ userSelect: "none" }}>({snap(hover)[0]}, {snap(hover)[1]})</text>}
        </svg>
      </div>
      {tool === "line" && <p data-tool-chrome className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]" role="status">{pending ? t("hubtoolsa.g_pending", { x: pending[0], y: pending[1] }) : t("hubtoolsa.g_lineHelp")}</p>}

      <div data-tool-chrome className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <b className="text-[12.5px] text-[var(--ink)]">{t("hubtoolsa.g_addTyped")}</b>
        {[["x", tx, setTx], ["y", ty, setTy]].map(([l, v, f]) => <label key={String(l)} className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{l as string}<input type="number" step="any" value={v as string} onChange={(e) => (f as (s: string) => void)(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }} className={num} /></label>)}
        <Button variant="primary" onClick={addTyped}>{t("hubtoolsa.g_addPoint")}</Button>
        {pts.length > 0 && <ul className="m-0 flex w-full list-none flex-wrap gap-1.5 p-0" aria-label={t("hubtoolsa.g_plotted")}>{pts.map((p, i) => <li key={i}><button type="button" onClick={() => setPts(pts.filter((_, j) => j !== i))} className={`min-h-[36px] rounded-full border border-[var(--line)] px-2.5 text-[12px] font-bold text-[var(--ink)] ${FOCUS}`} aria-label={t("hubtoolsa.g_removePoint", { x: p[0], y: p[1] })}>({p[0]}, {p[1]}) ✕</button></li>)}</ul>}
      </div>
    </div>
  );
}
