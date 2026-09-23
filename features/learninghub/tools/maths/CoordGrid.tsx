"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { FOCUS } from "../../kit";
import { round, type Pt } from "../engine/geometry";
import { canRedo, canUndo, commit, newHistory, redo, undo, type History } from "../engine/state";
import { newSeed } from "../engine/rng";
import type { CheckResult } from "../engine/marking";
import type { ToolProps } from "../types";
import { GENERATORS, markProblem, type Problem } from "./geometry/generators";
import { DEFAULT_TOL } from "./geometry/model";

// Coordinate grid (plan M-21): four quadrants, click to plot (snaps to whole numbers; half-steps optional), drag to move, join the points,
// and a typed-number way to add points for anyone who can't aim precisely. Practise mode serves "plot these points" questions (M-G03).

interface GridState { pts: Pt[]; join: boolean }
const R = 10;
const clampR = (n: number) => Math.max(-R, Math.min(R, n));

export default function CoordGrid({ mode = "practise", compact = false }: Partial<ToolProps> & { compact?: boolean }) {
  const assess = mode === "assess";
  const [h, setH] = useState<History<GridState>>(() => newHistory({ pts: [], join: false }));
  const [half, setHalf] = useState(false);
  const [erase, setErase] = useState(false);
  const [readout, setReadout] = useState(!assess);
  const [hover, setHover] = useState<Pt | null>(null);
  const [dragI, setDragI] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [tx, setTx] = useState(""), [ty, setTy] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState<Pt[] | null>(null);
  const state = h.present, pts = live ?? state.pts;
  const step = half ? 0.5 : 1;

  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!, m = svg.getScreenCTM(); if (!m) return [0, 0];
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const w = p.matrixTransform(m.inverse()); return [w.x, -w.y]; // y up
  };
  const snap = (p: Pt): Pt => [clampR(round(p[0] / step, 0) * step), clampR(round(p[1] / step, 0) * step)];
  const setPts = (next: Pt[]) => setH((x) => commit(x, { ...x.present, pts: next }));

  const down = (e: React.PointerEvent) => {
    const p = toWorld(e); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setResult(null);
    const near = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= 0.7);
    if (erase) { if (near >= 0) setPts(pts.filter((_, i) => i !== near)); return; }
    if (near >= 0) { setDragI(near); return; }
    setPts([...pts, snap(p)]);
  };
  const move = (e: React.PointerEvent) => { const p = toWorld(e); setHover(p); if (dragI !== null) setLive(pts.map((q, i) => (i === dragI ? snap(p) : q))); };
  const up = (e: React.PointerEvent) => { if (dragI !== null) { const p = snap(toWorld(e)); setLive(null); setPts(state.pts.map((q, i) => (i === dragI ? p : q))); setDragI(null); } };

  const addTyped = () => { const x = Number(tx), y = Number(ty); if (tx.trim() === "" || ty.trim() === "" || Number.isNaN(x) || Number.isNaN(y)) return; setPts([...pts, [clampR(x), clampR(y)]]); setTx(""); setTy(""); setResult(null); };
  const newQ = () => { const p = GENERATORS["M-G03.plot"]!(newSeed()); setProblem(p); setH(newHistory({ pts: [], join: false })); setResult(null); };
  const check = () => { if (problem) setResult(markProblem(problem, { points: pts }, DEFAULT_TOL)); };

  const ticks = useMemo(() => Array.from({ length: 2 * R + 1 }, (_, i) => i - R), []);
  const V = R + 1.8;
  return (
    <div className="grid gap-3" data-testid="coord-grid">
      {problem ? (
        <div role="region" aria-label="Question" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{problem.prompt}</p>
          <div className="mt-2 flex flex-wrap gap-2"><Button variant="primary" onClick={check}>{assess ? "Hand in" : "Check"}</Button>{!assess && <Button onClick={newQ}>Try another</Button>}</div>
          {result && !assess && <div role="status" className="mt-2 grid gap-1 text-[13px] font-semibold text-[var(--ink)]"><b>{result.score} / {result.max}</b>{result.feedback.map((f, i) => <span key={i}>{f}</span>)}</div>}
        </div>
      ) : !assess && <div><Button variant="primary" onClick={newQ}>Practise: plot the points</Button></div>}

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Grid tools">
        {[["Plot", !erase, () => setErase(false)], ["Rub out", erase, () => setErase(true)]].map(([t, on, f]) => <button key={String(t)} type="button" aria-pressed={on as boolean} onClick={f as () => void} className={`min-h-[40px] rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{t as string}</button>)}
        <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="accent-[var(--brand)]" />Half steps</label>
        <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={state.join} onChange={(e) => setH((x) => commit(x, { ...x.present, join: e.target.checked }))} className="accent-[var(--brand)]" />Join the points</label>
        <button type="button" disabled={!canUndo(h)} onClick={() => setH(undo)} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`} aria-label="Undo">↶</button>
        <button type="button" disabled={!canRedo(h)} onClick={() => setH(redo)} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`} aria-label="Redo">↷</button>
        <button type="button" onClick={() => setPts([])} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Clear</button>
        {!assess && <label className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={readout} onChange={(e) => setReadout(e.target.checked)} className="accent-[var(--brand)]" />Show coordinates</label>}
      </div>

      <div className="mx-auto w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]" style={{ maxWidth: compact ? 420 : 560 }}>
        <svg ref={svgRef} viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} role="application" aria-label="Coordinate grid from minus 10 to 10 on both axes. Use the boxes below to add points by typing." style={{ width: "100%", touchAction: "none", cursor: erase ? "not-allowed" : "crosshair", display: "block" }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)}>
          <g stroke="color-mix(in srgb, var(--brand-2) 22%, transparent)" strokeWidth={0.05}>{ticks.map((t) => <g key={t}><line x1={t} y1={-R} x2={t} y2={R} /><line x1={-R} y1={-t} x2={R} y2={-t} /></g>)}</g>
          <g stroke="var(--ink)" strokeWidth={0.13}><line x1={-R - 0.6} y1={0} x2={R + 0.6} y2={0} /><line x1={0} y1={-R - 0.6} x2={0} y2={R + 0.6} /></g>
          <path d={`M${R + 0.6} 0l-.5 -.3v.6zM0 ${-R - 0.6}l-.3 .5h.6z`} fill="var(--ink)" />
          <g fontSize={0.62} fill="var(--ink-2)" textAnchor="middle" style={{ userSelect: "none" }}>
            {ticks.filter((t) => t !== 0 && t % 2 === 0).map((t) => <g key={t}><text x={t} y={0.95}>{t}</text><text x={-0.5} y={-t + 0.22} textAnchor="end">{t}</text></g>)}
            <text x={-0.45} y={0.9} textAnchor="end">0</text><text x={R + 1.1} y={0.9} fontWeight={700}>x</text><text x={0.6} y={-R - 0.9} fontWeight={700}>y</text>
          </g>
          {state.join && pts.length > 1 && <polyline points={pts.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth={0.12} />}
          {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={-p[1]} r={0.3} fill="var(--brand)" stroke="var(--surface)" strokeWidth={0.06} />{readout && <text x={p[0] + 0.45} y={-p[1] - 0.4} fontSize={0.62} fontWeight={700} fill="var(--ink)" style={{ userSelect: "none" }}>({p[0]}, {p[1]})</text>}</g>)}
          {readout && hover && Math.abs(hover[0]) <= R + 0.5 && Math.abs(hover[1]) <= R + 0.5 && <text x={-V + 0.4} y={-V + 1.1} fontSize={0.7} fontWeight={800} fill="var(--brand)" style={{ userSelect: "none" }}>({snap(hover)[0]}, {snap(hover)[1]})</text>}
        </svg>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <b className="text-[12.5px] text-[var(--ink)]">Add a point by typing</b>
        {[["x", tx, setTx], ["y", ty, setTy]].map(([l, v, f]) => <label key={String(l)} className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{l as string}<input type="number" step="0.5" value={v as string} onChange={(e) => (f as (s: string) => void)(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped(); }} className={`min-h-[40px] w-20 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`} /></label>)}
        <Button variant="primary" onClick={addTyped}>Add point</Button>
        {pts.length > 0 && <ul className="m-0 flex w-full list-none flex-wrap gap-1.5 p-0" aria-label="Plotted points">{pts.map((p, i) => <li key={i}><button type="button" onClick={() => setPts(pts.filter((_, j) => j !== i))} className={`min-h-[32px] rounded-full border border-[var(--line)] px-2.5 text-[12px] font-bold text-[var(--ink)] ${FOCUS}`} aria-label={`Remove point ${p[0]}, ${p[1]}`}>({p[0]}, {p[1]}) ✕</button></li>)}</ul>}
      </div>
    </div>
  );
}
