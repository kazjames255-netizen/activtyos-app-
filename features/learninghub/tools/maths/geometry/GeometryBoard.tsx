"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { FOCUS, Icon } from "../../../kit";
import { angDiff, closestOnSeg, dirOf, dist, norm360, projectOnLine, rotateAbout, round, type Pt } from "../../engine/geometry";
import { canRedo, canUndo, commit, newHistory, redo, replacePresent, undo, unwrap, wrap, type History } from "../../engine/state";
import { newSeed } from "../../engine/rng";
import type { CheckResult } from "../../engine/marking";
import { loadToolState, saveToolState } from "../../api";
import type { ToolMode } from "../../types";
import { GENERATORS, markProblem, type Problem } from "./generators";
import { Paper, PaperDefs } from "./papers";
import { CompassArt, InstrumentArt } from "./InstrumentArt";
import { arcFromSweep, barLen, bodyOf, compassPen, drawAlongEdge, edgesOf, isProtractor, makeInstrument, nearestEdge, nearestPoint, protractorReading, snapCompass, snapEdgeToPoints, snapPoints, snapProtractor, snapSetSquare, SIZE, withRadius } from "./instruments";
import { DEFAULT_TOL, GEO_SCHEMA_VERSION, GEO_TOOL_ID, INSTR_LABEL, PAPERS, PAPER_H, PAPER_W, initialGeoState, uid, type GeoState, type InstrKind, type Instrument, type Mark, type PaperKind, type Tol } from "./model";

// The geometry board: a real-millimetre sheet of paper with instruments that behave like the real thing (plan M-01…M-07, M-20).
//  · Ruler / straight edge / set squares slide, turn and snap; a line drawn along an edge is truly straight.
//  · Protractors snap their centre onto a point and their baseline onto a line, and read both scales.
//  · Compasses hold a radius and draw arcs.
//  · Everything can be done WITHOUT a mouse: arrow keys move, Shift+←/→ turn, +/− change the compass radius, Delete removes — and the
//    "Precise controls" panel takes typed numbers (position, angle, radius, line from/to along an edge).
//  · Two-finger drag on touch moves AND turns an instrument.
// Practise mode can serve a generated question and check it; assess mode hides every readout so an instrument can't just tell the answer.

const AB = [MARGIN_X(), MARGIN_Y()] as const;
function MARGIN_X() { return 20; }
function MARGIN_Y() { return 20; }
const VIEW_W = PAPER_W + 2 * AB[0], VIEW_H = PAPER_H + 2 * AB[1];
const TOOLS = [["move", "Move"], ["line", "Line"], ["point", "Point"], ["pen", "Pencil"], ["erase", "Rub out"]] as const;
type Tool = (typeof TOOLS)[number][0];
const ALL_INSTR: InstrKind[] = ["ruler15", "ruler30", "straightedge", "protractor180", "protractor360", "compass", "setsquare45", "setsquare3060"];

type Drag =
  | { k: "move"; id: string; start: Pt; orig: Instrument }
  | { k: "rotate"; id: string; orig: Instrument }
  | { k: "sweep"; id: string; orig: Instrument; last: number; total: number }
  | { k: "radius"; id: string; orig: Instrument }
  | { k: "pan"; start: Pt; view: { x: number; y: number } }
  | { k: "edge"; edge: { a: Pt; b: Pt }; from: Pt; to: Pt }
  | { k: "free"; from: Pt; to: Pt }
  | { k: "pencil"; pts: Pt[] }
  | { k: "two"; id: string; orig: Instrument; a0: number; c0: Pt; ids: [number, number] };

export interface GeometryBoardProps {
  mode?: ToolMode;
  qs?: string;
  /** Instruments on the desk at the start (ignored once a saved state loads). */
  preset?: InstrKind[];
  paper?: PaperKind;
  /** A question to work on (assess/practise). */
  problem?: Problem | null;
  /** Generators offered under "New question" (practise mode). */
  generatorIds?: string[];
  tol?: Tol;
  /** Smaller layout for the Tools drawer's floating window. */
  compact?: boolean;
  /** Tool id used to autosave (omit = no autosave). */
  saveAs?: string;
  onSubmit?: (a: { number?: number | null; marks: Mark[] }, r: CheckResult) => void;
}

const newInstr = (k: InstrKind, at: Pt): Instrument => makeInstrument(k, uid("i"), at);
const inPoly = (poly: readonly Pt[], p: Pt) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const stateFrom = (paper: PaperKind, preset: InstrKind[], given: Mark[] = []): GeoState => ({ paper, instruments: preset.map((k, i) => newInstr(k, [24 + i * 8, 100 - i * 6])), marks: given });

export function GeometryBoard({ mode = "practise", qs = "", preset = ["ruler15", "protractor180", "compass"], paper = "plain", problem: problemProp = null, generatorIds = [], tol = DEFAULT_TOL, compact = false, saveAs, onSubmit }: GeometryBoardProps) {
  const assess = mode === "assess";
  const [problem, setProblem] = useState<Problem | null>(problemProp);
  const [hist, setHist] = useState<History<GeoState>>(() => newHistory(stateFrom(problemProp?.paper ?? paper, preset, problemProp?.given ?? [])));
  const [live, setLive] = useState<GeoState | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [sel, setSel] = useState<string | null>(null);
  const [penDown, setPenDown] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [view, setView] = useState({ x: -AB[0], y: -AB[1], w: VIEW_W });
  const [readouts, setReadouts] = useState(!assess);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [say, setSay] = useState("");
  const [genId, setGenId] = useState(generatorIds[0] ?? "");
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const state = live ?? hist.present;
  const sELECTED = state.instruments.find((i) => i.id === sel) ?? null;
  const cid = useMemo(() => `geo${Math.random().toString(36).slice(2, 8)}`, []);
  const viewH = (view.w * VIEW_H) / VIEW_W;
  const showRead = readouts && !assess;

  // ── saving: load once, then autosave (debounced, skipped when nothing changed) ──
  const loaded = useRef(false), lastSaved = useRef("");
  useEffect(() => {
    if (!saveAs || problemProp) { loaded.current = true; return; }
    let live = true;
    loadToolState(qs, saveAs).then((r) => {
      if (!live) return;
      const s = unwrap<GeoState>(r.state, GEO_TOOL_ID, GEO_SCHEMA_VERSION, (o) => o as GeoState, () => hist.present);
      if (s !== hist.present) setHist(newHistory(s));
      lastSaved.current = JSON.stringify(s);
    }).catch(() => { /* a save that can't load just starts fresh */ }).finally(() => { loaded.current = true; });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveAs, qs]);
  useEffect(() => {
    if (!saveAs || !loaded.current || problem) return;
    const j = JSON.stringify(hist.present);
    if (j === lastSaved.current) return;
    const t = setTimeout(() => { lastSaved.current = j; saveToolState(qs, saveAs, wrap(GEO_TOOL_ID, GEO_SCHEMA_VERSION, hist.present), GEO_SCHEMA_VERSION).catch(() => { lastSaved.current = ""; }); }, 1500);
    return () => clearTimeout(t);
  }, [hist.present, saveAs, qs, problem]);

  const apply = useCallback((next: GeoState) => setHist((h) => commit(h, next)), []);
  const patchInstr = (id: string, f: (i: Instrument) => Instrument, s: GeoState = state): GeoState => ({ ...s, instruments: s.instruments.map((i) => (i.id === id ? f(i) : i)) });
  const toWorld = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!, m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const w = p.matrixTransform(m.inverse());
    return [w.x, w.y];
  };

  /** After a drop: snap like the real thing would seat itself. */
  const settle = (ins: Instrument, s: GeoState): Instrument => {
    const marks = s.marks;
    if (isProtractor(ins.kind)) return snapProtractor(ins, marks, tol);
    if (ins.kind === "compass") return snapCompass(ins, marks, 3);
    let out = snapEdgeToPoints(ins, marks, 3);
    if (ins.kind === "setsquare45" || ins.kind === "setsquare3060") out = snapSetSquare(out, s.instruments, 3);
    return out;
  };

  // ── pointer handling ──
  const hitInstrument = (p: Pt): { ins: Instrument; part: "body" | "rot" | "pen" | "pivot" } | null => {
    for (const ins of [...state.instruments].reverse()) {
      if (ins.kind === "compass") {
        const pen = compassPen(ins);
        if (dist(pen, p) <= 6) return { ins, part: "pen" };
        if (dist([ins.x, ins.y], p) <= 6) return { ins, part: "pivot" };
        continue;
      }
      if (sel === ins.id) { const h = rotHandle(ins); if (dist(h, p) <= 5) return { ins, part: "rot" }; }
      if (inPoly(bodyOf(ins), p)) return { ins, part: "body" };
    }
    return null;
  };
  const rotHandle = (ins: Instrument): Pt => { const ext = isProtractor(ins.kind) ? SIZE.protractor.r : ins.kind.startsWith("setsquare") ? (ins.kind === "setsquare45" ? SIZE.setsquare45.a : SIZE.setsquare3060.a) : barLen(ins.kind); const d = ins.rot; return [ins.x + (ext + 8) * Math.cos((d * Math.PI) / 180), ins.y - (ext + 8) * Math.sin((d * Math.PI) / 180)]; };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toWorld(e);
    pointers.current.set(e.pointerId, p);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    // second finger on the instrument being dragged → move AND turn
    const d = dragRef.current;
    if (pointers.current.size === 2 && d && (d.k === "move" || d.k === "rotate" || d.k === "two")) {
      const ids = [...pointers.current.keys()] as [number, number], [a, b] = ids.map((i) => pointers.current.get(i)!) as [Pt, Pt];
      const id = d.k === "two" ? d.id : d.id, orig = (live ?? hist.present).instruments.find((i) => i.id === id);
      if (orig) { setDrag({ k: "two", id, orig, a0: dirOf(a, b), c0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ids }); return; }
    }
    setResult(null);
    if (tool === "move") {
      const hit = hitInstrument(p);
      if (hit) {
        setSel(hit.ins.id);
        if (hit.part === "rot") setDrag({ k: "rotate", id: hit.ins.id, orig: hit.ins });
        else if (hit.part === "pen") setDrag(penDown ? { k: "sweep", id: hit.ins.id, orig: hit.ins, last: hit.ins.pen ?? 0, total: 0 } : { k: "radius", id: hit.ins.id, orig: hit.ins });
        else setDrag({ k: "move", id: hit.ins.id, start: p, orig: hit.ins });
      } else { setSel(null); setDrag({ k: "pan", start: [e.clientX, e.clientY], view: { x: view.x, y: view.y } }); }
    } else if (tool === "line") {
      const near = nearestEdge(state.instruments, p, 9);
      if (near) { const s = drawAlongEdge(near.edge, p, p); setDrag({ k: "edge", edge: near.edge, from: s.a, to: s.b }); }
      else if (!assess || !problem) setDrag({ k: "free", from: nearestPoint(snapPoints(state.marks), p, 3) ?? p, to: p });
    } else if (tool === "point") {
      const q = nearestPoint(snapPoints(state.marks), p, 3) ?? p;
      apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "pt", p: [round(q[0], 1), round(q[1], 1)] }] });
    } else if (tool === "pen") setDrag({ k: "pencil", pts: [p] });
    else if (tool === "erase") {
      const hit = [...state.marks].reverse().find((m) => !("given" in m && m.given) && markDist(m, p) <= 3);
      if (hit) apply({ ...state, marks: state.marks.filter((m) => m.id !== hit.id) });
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toWorld(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    setHover(p);
    const d = dragRef.current;
    if (!d) return;
    const base = hist.present;
    if (d.k === "move") setLive(patchInstr(d.id, (i) => (i.kind === "compass" ? { ...i, x: d.orig.x + p[0] - d.start[0], y: d.orig.y + p[1] - d.start[1] } : { ...i, x: d.orig.x + p[0] - d.start[0], y: d.orig.y + p[1] - d.start[1] }), base));
    else if (d.k === "rotate") setLive(patchInstr(d.id, (i) => ({ ...i, rot: round(dirOf([i.x, i.y], p), 1) }), base));
    else if (d.k === "radius") setLive(patchInstr(d.id, (i) => withRadius({ ...i, pen: round(dirOf([i.x, i.y], p), 1) }, dist([i.x, i.y], p)), base));
    else if (d.k === "sweep") {
      const c: Pt = [d.orig.x, d.orig.y], ang = dirOf(c, p);
      let step = ang - d.last; if (step > 180) step -= 360; if (step < -180) step += 360;
      const total = Math.max(-360, Math.min(360, d.total + step));
      setDrag({ ...d, last: ang, total });
      setLive(patchInstr(d.id, (i) => ({ ...i, pen: ang }), base));
    } else if (d.k === "pan") {
      const svg = svgRef.current!, k = view.w / svg.getBoundingClientRect().width;
      setView((v) => ({ ...v, x: d.view.x - (e.clientX - d.start[0]) * k, y: d.view.y - (e.clientY - d.start[1]) * k }));
    } else if (d.k === "edge") { const s = drawAlongEdge(d.edge, d.from, p); setDrag({ ...d, from: d.from, to: s.b }); }
    else if (d.k === "free") setDrag({ ...d, to: p });
    else if (d.k === "pencil") setDrag({ ...d, pts: [...d.pts, p] });
    else if (d.k === "two") {
      const [a, b] = d.ids.map((i) => pointers.current.get(i)) as [Pt | undefined, Pt | undefined];
      if (!a || !b) return;
      const delta = dirOf(a, b) - d.a0, c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = rotateAbout([d.orig.x, d.orig.y], d.c0, delta);
      setLive(patchInstr(d.id, (i) => ({ ...i, x: o[0] + c[0] - d.c0[0], y: o[1] + c[1] - d.c0[1], rot: norm360(d.orig.rot + delta) }), base));
    }
  };

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const d = dragRef.current;
    if (!d) return;
    if (d.k === "two" && pointers.current.size > 0) return; // still one finger down — wait for it to lift
    setDrag(null);
    const base = live ?? hist.present;
    if (d.k === "move" || d.k === "rotate" || d.k === "radius" || d.k === "two") {
      const id = d.k === "two" || d.k === "move" || d.k === "rotate" || d.k === "radius" ? d.id : "";
      const next = patchInstr(id, (i) => settle(i, base), base); setLive(null); setHist((h) => commit(replacePresent(h, hist.present), next)); say_(`${label(base, id)} placed`);
    } else if (d.k === "sweep") {
      const ins = base.instruments.find((i) => i.id === d.id);
      setLive(null);
      if (ins && Math.abs(d.total) > 2) {
        const a = arcFromSweep([ins.x, ins.y], ins.r ?? 60, d.orig.pen ?? 0, d.total);
        apply({ ...hist.present, instruments: hist.present.instruments.map((i) => (i.id === d.id ? { ...i, pen: ins.pen } : i)), marks: [...hist.present.marks, { id: uid("m"), k: "arc", ...a }] });
      } else apply({ ...hist.present, instruments: hist.present.instruments.map((i) => (i.id === d.id ? { ...i, pen: ins?.pen ?? i.pen } : i)) });
    } else if (d.k === "edge") {
      if (dist(d.from, d.to) >= 1) apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "seg", a: [round(d.from[0], 2), round(d.from[1], 2)], b: [round(d.to[0], 2), round(d.to[1], 2)], ruled: true }] });
    } else if (d.k === "free") {
      const to = nearestPoint(snapPoints(state.marks), d.to, 3) ?? d.to;
      if (dist(d.from, to) >= 2) apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "seg", a: d.from, b: to, ruled: false }] });
    } else if (d.k === "pencil") {
      if (d.pts.length > 2) apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "free", pts: d.pts.filter((_, i) => i % 2 === 0 || i === d.pts.length - 1).map((q) => [round(q[0], 1), round(q[1], 1)] as Pt) }] });
    }
  };

  const say_ = (t: string) => setSay(t);
  const label = (s: GeoState, id: string) => { const i = s.instruments.find((x) => x.id === id); return i ? INSTR_LABEL[i.kind] : "Instrument"; };

  // ── keyboard: works on the focused instrument ──
  const onKeyInstr = (e: React.KeyboardEvent, ins: Instrument) => {
    const step = e.altKey ? 0.2 : 1;
    let next: Instrument | null = null;
    if (e.key.startsWith("Arrow") && e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) next = { ...ins, rot: norm360(ins.rot + (e.key === "ArrowLeft" ? 1 : -1) * (e.altKey ? 0.2 : 1)) };
    else if (e.key === "ArrowLeft") next = { ...ins, x: ins.x - step };
    else if (e.key === "ArrowRight") next = { ...ins, x: ins.x + step };
    else if (e.key === "ArrowUp") next = { ...ins, y: ins.y - step };
    else if (e.key === "ArrowDown") next = { ...ins, y: ins.y + step };
    else if ((e.key === "+" || e.key === "=") && ins.kind === "compass") next = withRadius(ins, (ins.r ?? 60) + 1);
    else if ((e.key === "-" || e.key === "_") && ins.kind === "compass") next = withRadius(ins, (ins.r ?? 60) - 1);
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); apply({ ...state, instruments: state.instruments.filter((i) => i.id !== ins.id) }); setSel(null); return; }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(ins.id); return; }
    if (next) { e.preventDefault(); const n2 = settle(next, state); apply(patchInstr(ins.id, () => n2)); setSel(ins.id); say_(`${INSTR_LABEL[ins.kind]} at ${round(n2.x, 1)}, ${round(n2.y, 1)}, turned ${round(n2.rot, 1)} degrees`); }
  };
  const onKeyBoard = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); setHist((h) => (e.shiftKey ? redo(h) : undo(h))); }
  };

  // ── toolbar actions ──
  const addInstr = (k: InstrKind) => { if (state.instruments.some((i) => i.kind === k) && k !== "straightedge") { setSel(state.instruments.find((i) => i.kind === k)!.id); return; } const i = newInstr(k, [26 + state.instruments.length * 8, 96 - state.instruments.length * 6]); apply({ ...state, instruments: [...state.instruments, i] }); setSel(i.id); say_(`${INSTR_LABEL[k]} added`); };
  const zoom = (f: number) => setView((v) => { const w = Math.max(60, Math.min(VIEW_W * 2, v.w * f)), k = w / v.w; return { x: v.x + (v.w - w) / 2, y: v.y + ((v.w - w) / 2) * (VIEW_H / VIEW_W), w: w === v.w * k ? w : w }; });
  const fit = () => setView({ x: -AB[0], y: -AB[1], w: VIEW_W });
  const clearMarks = () => { apply({ ...state, marks: state.marks.filter((m) => "given" in m && m.given) }); setResult(null); };

  // ── questions ──
  const newQuestion = () => {
    const gen = GENERATORS[genId]; if (!gen) return;
    const p = gen(newSeed());
    setProblem(p); setResult(null); setAnswer("");
    setHist(newHistory({ paper: p.paper, instruments: state.instruments.length ? state.instruments : stateFrom(p.paper, preset).instruments, marks: p.given }));
    fit();
  };
  const studentMarks = state.marks.filter((m) => !("given" in m && m.given));
  const check = () => {
    if (!problem) return;
    const num = answer.trim() === "" ? null : Number(answer);
    const r = markProblem(problem, { number: num, marks: studentMarks }, tol);
    setResult(r); onSubmit?.({ number: num, marks: studentMarks }, r);
  };

  // ── rendering helpers ──
  const arcPath = (m: Extract<Mark, { k: "arc" }>) => { const s = polarPt(m.c, m.r, m.a0), e2 = polarPt(m.c, m.r, m.a1), large = m.a1 - m.a0 > 180 ? 1 : 0; return `M${s[0]} ${s[1]}A${m.r} ${m.r} 0 ${large} 0 ${e2[0]} ${e2[1]}`; };
  const strokeFor = (m: Mark) => ("given" in m && m.given ? "var(--ink-3)" : "var(--ink)");
  const compass = state.instruments.find((i) => i.kind === "compass");
  const prot = sELECTED && isProtractor(sELECTED.kind) ? sELECTED : null;
  const reading = prot && hover && showRead ? protractorReading(prot, dirOf([prot.x, prot.y], hover)) : null;

  const btn = `min-h-[40px] rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS}`;
  const on = (b: boolean) => (b ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]");

  return (
    <div className="grid gap-3" onKeyDown={onKeyBoard} data-testid="geometry-board">
      {problem && (
        <div role="region" aria-label="Question" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{problem.prompt}</p>
          {problem.expects === "number" && (
            <label className="mt-2 flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">Your answer
              <input inputMode="decimal" value={answer} onChange={(e) => setAnswer(e.target.value)} className={`min-h-[44px] w-28 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] font-bold ${FOCUS}`} /> {problem.unit}
            </label>
          )}
          <div className="mt-2 flex flex-wrap gap-2"><Button variant="primary" onClick={check}>{assess ? "Hand in" : "Check"}</Button>{!assess && generatorIds.length > 0 && <Button onClick={newQuestion}>Try another</Button>}</div>
          {result && !assess && (
            <div role="status" className="mt-2 grid gap-1 text-[13px] font-semibold text-[var(--ink)]"><b className="text-[14px]">{result.score} / {result.max}</b>{result.feedback.map((f, i) => <span key={i}>{f}</span>)}</div>
          )}
          {result && assess && <p role="status" className="m-0 mt-2 text-[13px] font-bold text-[var(--ink)]">Handed in.</p>}
        </div>
      )}
      {!problem && !assess && generatorIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12.5px] font-bold text-[var(--ink-2)]">Practise a question
            <select value={genId} onChange={(e) => setGenId(e.target.value)} className={`ml-2 min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`}>{generatorIds.map((g) => <option key={g} value={g}>{GEN_LABEL[g] ?? g}</option>)}</select>
          </label>
          <Button variant="primary" onClick={newQuestion}>New question</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map(([id, t]) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)} className={`${btn} ${on(tool === id)}`}>{t}</button>)}
        {compass && <button type="button" aria-pressed={penDown} onClick={() => setPenDown(!penDown)} className={`${btn} ${on(penDown)}`} title="When on, dragging the compass pencil draws an arc; when off, it changes the radius.">Draw arc {penDown ? "on" : "off"}</button>}
        <span className="mx-1 h-6 w-px bg-[var(--line)]" aria-hidden />
        <button type="button" onClick={() => setHist((h) => undo(h))} disabled={!canUndo(hist)} className={`${btn} ${on(false)} disabled:opacity-40`} aria-label="Undo">↶</button>
        <button type="button" onClick={() => setHist((h) => redo(h))} disabled={!canRedo(hist)} className={`${btn} ${on(false)} disabled:opacity-40`} aria-label="Redo">↷</button>
        <button type="button" onClick={clearMarks} className={`${btn} ${on(false)}`}>Clear drawing</button>
        <span className="mx-1 h-6 w-px bg-[var(--line)]" aria-hidden />
        <button type="button" onClick={() => zoom(0.8)} className={`${btn} ${on(false)}`} aria-label="Zoom in">＋</button>
        <button type="button" onClick={() => zoom(1.25)} className={`${btn} ${on(false)}`} aria-label="Zoom out">−</button>
        <button type="button" onClick={fit} className={`${btn} ${on(false)}`}>Fit</button>
        {!assess && <label className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={readouts} onChange={(e) => setReadouts(e.target.checked)} className="accent-[var(--brand)]" />Show readings</label>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Instruments">
        {ALL_INSTR.filter((k) => !compact || preset.includes(k) || state.instruments.some((i) => i.kind === k)).map((k) => <button key={k} type="button" onClick={() => addInstr(k)} className={`${btn} ${on(state.instruments.some((i) => i.kind === k) && sel === state.instruments.find((i) => i.kind === k)?.id)}`}>{INSTR_LABEL[k]}</button>)}
        {!problem && <select value={state.paper} onChange={(e) => apply({ ...state, paper: e.target.value as PaperKind })} aria-label="Paper" className={`ml-auto min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[12.5px] font-semibold text-[var(--ink)] ${FOCUS}`}>{PAPERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`} role="application" aria-label="Geometry paper. Use the Tab key to reach an instrument, then arrow keys to move it and Shift with left or right to turn it."
          style={{ width: "100%", maxHeight: compact ? "52vh" : "68vh", touchAction: "none", cursor: tool === "move" ? "default" : "crosshair", display: "block" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)}>
          <PaperDefs id={cid} />
          <Paper id={cid} kind={state.paper} />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {state.marks.map((m) => m.k === "seg" ? <line key={m.id} x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={strokeFor(m)} strokeWidth={0.5} strokeDasharray={m.dashed ? "2 1.6" : undefined} />
              : m.k === "arc" ? (m.a1 - m.a0 >= 359.9 ? <circle key={m.id} cx={m.c[0]} cy={m.c[1]} r={m.r} stroke={strokeFor(m)} strokeWidth={0.4} /> : <path key={m.id} d={arcPath(m)} stroke={strokeFor(m)} strokeWidth={0.4} />)
              : m.k === "free" ? <polyline key={m.id} points={m.pts.map((q) => q.join(",")).join(" ")} stroke="var(--ink)" strokeWidth={0.5} />
              : <g key={m.id}><circle cx={m.p[0]} cy={m.p[1]} r={0.9} fill={strokeFor(m)} stroke="none" />{m.label && <text x={m.p[0] + 2} y={m.p[1] - 2} fontSize={4} fontWeight={700} fill="var(--ink)" stroke="none" style={{ userSelect: "none" }}>{m.label}</text>}</g>)}
            {drag?.k === "edge" && <line x1={drag.from[0]} y1={drag.from[1]} x2={drag.to[0]} y2={drag.to[1]} stroke="var(--brand)" strokeWidth={0.6} />}
            {drag?.k === "free" && <line x1={drag.from[0]} y1={drag.from[1]} x2={drag.to[0]} y2={drag.to[1]} stroke="var(--brand)" strokeWidth={0.6} strokeDasharray="2 1.5" />}
            {drag?.k === "pencil" && <polyline points={drag.pts.map((q) => q.join(",")).join(" ")} stroke="var(--brand)" strokeWidth={0.6} />}
            {drag?.k === "sweep" && Math.abs(drag.total) > 1 && <path d={arcPath({ id: "p", k: "arc", ...arcFromSweep([drag.orig.x, drag.orig.y], drag.orig.r ?? 60, drag.orig.pen ?? 0, drag.total) })} stroke="var(--brand)" strokeWidth={0.6} />}
          </g>
          {state.instruments.filter((i) => i.kind !== "compass").map((i) => (
            <g key={i.id} transform={`translate(${i.x} ${i.y}) rotate(${-i.rot})`} tabIndex={0} role="button" aria-label={`${INSTR_LABEL[i.kind]}. Arrow keys move, Shift and left or right arrow turns, Delete removes.`}
              aria-pressed={sel === i.id} onKeyDown={(e) => onKeyInstr(e, i)} onFocus={() => setSel(i.id)} style={{ outline: "none", cursor: tool === "move" ? "grab" : "crosshair" }}>
              <InstrumentArt i={i} />
              {sel === i.id && <SelectRing i={i} />}
            </g>
          ))}
          {state.instruments.filter((i) => i.kind === "compass").map((i) => (
            <g key={i.id} tabIndex={0} role="button" aria-label="Compasses. Arrow keys move, plus and minus change the radius, Delete removes." onKeyDown={(e) => onKeyInstr(e, i)} onFocus={() => setSel(i.id)} style={{ outline: "none" }}>
              <CompassArt i={i} showRadius={showRead} />
              {sel === i.id && <><circle cx={i.x} cy={i.y} r={6} fill="none" stroke="var(--brand)" strokeWidth={0.5} strokeDasharray="1.5 1.2" /><circle cx={compassPen(i)[0]} cy={compassPen(i)[1]} r={6} fill="none" stroke="var(--brand)" strokeWidth={0.5} strokeDasharray="1.5 1.2" /></>}
            </g>
          ))}
          {sELECTED && !isCompass(sELECTED) && tool === "move" && (() => { const h = rotHandle(sELECTED); return <g><line x1={sELECTED.x} y1={sELECTED.y} x2={h[0]} y2={h[1]} stroke="var(--brand)" strokeWidth={0.3} strokeDasharray="1.2 1.2" /><circle cx={h[0]} cy={h[1]} r={3.4} fill="var(--surface)" stroke="var(--brand)" strokeWidth={0.7} /><path d={`M${h[0] - 1.4} ${h[1]}a1.4 1.4 0 1 1 1.4 1.4`} fill="none" stroke="var(--brand)" strokeWidth={0.5} /></g>; })()}
          {reading && hover && <text x={hover[0] + 4} y={hover[1] - 4} fontSize={4} fontWeight={800} fill="var(--brand)" style={{ userSelect: "none" }}>{round(reading.outer, 0)}° | {round(reading.inner, 0)}°</text>}
        </svg>
      </div>

      {sELECTED && (
        <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3" open={!compact}>
          <summary className={`cursor-pointer text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Precise controls — {INSTR_LABEL[sELECTED.kind]}</summary>
          <Precise ins={sELECTED} assess={assess} onChange={(n2) => apply(patchInstr(sELECTED.id, () => settle(n2, state)))}
            onArc={(a0, a1) => { const c: Pt = [sELECTED.x, sELECTED.y]; apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "arc", c, r: sELECTED.r ?? 60, a0: norm360(a0), a1: norm360(a0) + (((a1 - a0) % 360) + 360) % 360 || norm360(a0) + 360 }] }); }}
            onLine={(from, to) => { const e = edgesOf(sELECTED)[0]; if (!e) return; const len = dist(e.a, e.b), t0 = Math.max(0, Math.min(len, from)) / len, t1 = Math.max(0, Math.min(len, to)) / len; const a: Pt = [e.a[0] + (e.b[0] - e.a[0]) * t0, e.a[1] + (e.b[1] - e.a[1]) * t0], b: Pt = [e.a[0] + (e.b[0] - e.a[0]) * t1, e.a[1] + (e.b[1] - e.a[1]) * t1]; if (dist(a, b) >= 1) apply({ ...state, marks: [...state.marks, { id: uid("m"), k: "seg", a, b, ruled: true }] }); }}
            onRemove={() => { apply({ ...state, instruments: state.instruments.filter((i) => i.id !== sELECTED.id) }); setSel(null); }} />
        </details>
      )}
      <p className="sr-only" role="status" aria-live="polite">{say}</p>
      <p className="m-0 text-[11.5px] font-semibold text-[var(--ink-3)]">Drag an instrument to move it · drag the round handle to turn it · with two fingers you can move and turn together · Draw ▸ Line along a ruler edge for a straight line.</p>
    </div>
  );
}

const isCompass = (i: Instrument) => i.kind === "compass";
const polarPt = (c: Pt, r: number, a: number): Pt => [c[0] + r * Math.cos((a * Math.PI) / 180), c[1] - r * Math.sin((a * Math.PI) / 180)];
function markDist(m: Mark, p: Pt): number {
  if (m.k === "seg") return dist(closestOnSeg({ a: m.a, b: m.b }, p), p);
  if (m.k === "pt") return dist(m.p, p);
  if (m.k === "arc") return Math.abs(dist(m.c, p) - m.r);
  return Math.min(...m.pts.map((q) => dist(q, p)));
}
const GEN_LABEL: Record<string, string> = {
  "M-G01.measure": "Measure an angle", "M-G01.draw": "Draw an angle", "M-G02.perpBisector": "Perpendicular bisector", "M-G02.angleBisector": "Angle bisector", "M-G02.triangle": "Triangle from three sides",
  "M-G02.equilateral": "Equilateral triangle", "M-G02.locus": "Locus of a point", "M-G09.measure": "Measure a bearing", "M-G09.draw": "Draw a bearing",
};
export const GEOMETRY_GENERATORS = Object.keys(GEN_LABEL);

function SelectRing({ i }: { i: Instrument }) {
  const b = bodyOf({ ...i, x: 0, y: 0, rot: 0 });
  return <polygon points={b.map((q) => q.join(",")).join(" ")} fill="none" stroke="var(--brand)" strokeWidth={0.6} strokeDasharray="2 1.4" pointerEvents="none" />;
}

function Precise({ ins, assess, onChange, onArc, onLine, onRemove }: { ins: Instrument; assess: boolean; onChange: (i: Instrument) => void; onArc: (a0: number, a1: number) => void; onLine: (from: number, to: number) => void; onRemove: () => void }) {
  const [a0, setA0] = useState("0"), [a1, setA1] = useState("90"), [f, setF] = useState("0"), [t, setT] = useState("50");
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? 0 : Number(v));
  const fld = "min-h-[40px] w-20 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 text-[13px] font-semibold text-[var(--ink)] " + FOCUS;
  const Field = ({ label, value, on }: { label: string; value: number; on: (n: number) => void }) => (
    <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{label}<input type="number" step="0.5" value={round(value, 1)} onChange={(e) => on(num(e.target.value))} className={fld} /></label>);
  const edge = edgesOf(ins)[0];
  return (
    <div className="mt-3 grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Across (mm)" value={ins.x} on={(n) => onChange({ ...ins, x: n })} />
        <Field label="Down (mm)" value={ins.y} on={(n) => onChange({ ...ins, y: n })} />
        {ins.kind !== "compass" && <Field label="Turn (°)" value={ins.rot} on={(n) => onChange({ ...ins, rot: norm360(n) })} />}
        {ins.kind === "compass" && <><Field label="Radius (mm)" value={ins.r ?? 60} on={(n) => onChange(withRadius(ins, n))} /><Field label="Pencil direction (°)" value={ins.pen ?? 0} on={(n) => onChange({ ...ins, pen: norm360(n) })} /></>}
        <Button onClick={onRemove}>Remove</Button>
      </div>
      {ins.kind === "compass" && (
        <div className="flex flex-wrap items-end gap-2"><b className="text-[12.5px] text-[var(--ink)]">Draw an arc</b>
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">from (°)<input value={a0} onChange={(e) => setA0(e.target.value)} className={fld} /></label>
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">to (°)<input value={a1} onChange={(e) => setA1(e.target.value)} className={fld} /></label>
          <Button variant="primary" onClick={() => onArc(num(a0), num(a1))}>Draw arc</Button><Button onClick={() => onArc(0, 360)}>Full circle</Button></div>)}
      {edge && (ins.kind.startsWith("ruler") || ins.kind === "straightedge" || ins.kind.startsWith("setsquare")) && (
        <div className="flex flex-wrap items-end gap-2"><b className="text-[12.5px] text-[var(--ink)]">Draw a line along the {ins.kind.startsWith("setsquare") ? "longest-drawn" : "top"} edge</b>
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">from (mm)<input value={f} onChange={(e) => setF(e.target.value)} className={fld} /></label>
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">to (mm)<input value={t} onChange={(e) => setT(e.target.value)} className={fld} /></label>
          <Button variant="primary" onClick={() => onLine(num(f), num(t))}>Draw line</Button></div>)}
      {isProtractor(ins.kind) && !assess && <p className="m-0 text-[12px] font-semibold text-[var(--ink-2)]">Put the centre cross on the corner and the baseline along one line, then read the other line on the scale that starts at 0.</p>}
      <p className="m-0 text-[11.5px] font-semibold text-[var(--ink-3)]">Keys: arrows move · Shift+←/→ turn · +/− radius (compass) · Delete removes.</p>
    </div>
  );
}
