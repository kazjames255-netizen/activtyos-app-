"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type RefObject } from "react";
import { FOCUS } from "../kit";
import { InstrumentArt } from "../tools/maths/geometry/InstrumentArt";
import { SIZE, barLen, flipInstrument, isProtractor } from "../tools/maths/geometry/instruments";
import type { InstrKind, Instrument } from "../tools/maths/geometry/model";

// A single measuring instrument laid DIRECTLY over the lesson page — no window, no paper, no other tools. The protractor (or ruler) appears on
// top of the question, the child drags it onto the diagram, turns it with the round handle, flips it, resizes it and reads the scale on the real picture.
//
// Design rules (from the geometry audit):
//  · Only the instrument's OUTLINE, its baseline and its centre cross catch the pointer — the see-through inside is click-through, so it never
//    blocks the answer buttons underneath it.
//  · It is anchored to the question's PICTURE (the largest image / diagram in the lesson card) and follows it when the page scrolls, so it stays on the diagram.
//  · Full keyboard control, 44px+ buttons and a big turn handle for touch.
// It is a full-viewport, click-through SVG; the instrument is drawn by the geometry board's own InstrumentArt (millimetres, baseline along +x, body toward −y).

const BASE_K = 3.4; // px per mm at zoom 1 (a 180° protractor is ~420px across)
const norm360 = (a: number) => ((a % 360) + 360) % 360;
type Kind = Extract<InstrKind, "protractor180" | "protractor360" | "ruler15" | "ruler30">;

/** The picture the child works on: the largest visible image / diagram inside the lesson card (else the card itself). */
export function findQuestionPicture(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  let best: HTMLElement | null = null, area = 0;
  root.querySelectorAll<HTMLElement>("img, svg").forEach((el) => {
    if (el.closest("button, [data-instrument-overlay]")) return;
    const r = el.getBoundingClientRect();
    if (r.width >= 100 && r.height >= 60 && r.width * r.height > area) { area = r.width * r.height; best = el; }
  });
  return best ?? root;
}

export function InstrumentOverlay({ kind: kind0, label, lessonCardRef, questionKey, onClose, onBoard }: {
  kind: Extract<InstrKind, "protractor180" | "ruler15">;
  label: string;
  /** The lesson card: the instrument is anchored to the picture inside it. */
  lessonCardRef: RefObject<HTMLDivElement | null>;
  /** Changes when the question changes: the instrument re-anchors to the new question's picture. */
  questionKey?: string | null;
  onClose: () => void;
  /** Optional: switch to the full drawing board (a window with paper). */
  onBoard?: () => void;
}) {
  const [kind, setKind] = useState<Kind>(kind0);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const k = BASE_K * zoom;
  const isProt = isProtractor(kind);
  const len = isProt ? SIZE.protractor.r : barLen(kind);

  // Anchored position: `rel` is the instrument origin relative to the picture's top-left; `tick` re-reads the picture's rect on scroll / resize.
  const anchor = useRef<HTMLElement | null>(null);
  const [rel, setRel] = useState<{ x: number; y: number }>({ x: 200, y: 200 });
  const [, setTick] = useState(0);
  const place = useCallback(() => {
    const el = findQuestionPicture(lessonCardRef.current);
    anchor.current = el;
    const r = el?.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!r) { setRel({ x: vw / 2, y: vh * 0.4 }); return; }
    // A protractor starts low-centre on the picture (its arc rises over it); a ruler starts across the lower third.
    setRel(isProt ? { x: r.width / 2, y: Math.min(r.height * 0.72, r.height - 12) } : { x: Math.max(12, (r.width - len * BASE_K) / 2), y: r.height * 0.78 });
    setRot(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonCardRef]);
  useLayoutEffect(() => { place(); }, [questionKey, place]);
  useEffect(() => {
    let raf = 0;
    const bump = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (anchor.current && !anchor.current.isConnected) place(); setTick((t) => t + 1); }); };
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => { window.removeEventListener("scroll", bump, true); window.removeEventListener("resize", bump); if (raf) cancelAnimationFrame(raf); };
  }, [place]);
  const ar = anchor.current?.isConnected ? anchor.current.getBoundingClientRect() : null;
  const pos = { x: (ar ? ar.left : 0) + rel.x, y: (ar ? ar.top : 0) + rel.y };

  const inst: Instrument = useMemo(() => ({ id: "ov", kind, x: 0, y: 0, rot: 0 }), [kind]);
  const drag = useRef<{ k: "move" | "turn"; id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const down = (which: "move" | "turn") => (e: RPointerEvent<SVGElement>) => {
    e.stopPropagation(); e.preventDefault();
    drag.current = { k: which, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: rel.x, oy: rel.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<SVGElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    if (d.k === "move") setRel({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
    else setRot(norm360((Math.atan2(-(e.clientY - pos.y), e.clientX - pos.x) * 180) / Math.PI));
  };
  const up = () => { drag.current = null; };

  // Turn over 180°: a protractor about its centre cross, a ruler about the middle of its body (the same maths as the board).
  const flip = () => {
    const f = flipInstrument({ ...inst, rot });
    setRel((p) => ({ x: p.x + f.x * k, y: p.y + f.y * k }));
    setRot(f.rot);
  };
  const bigger = () => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)));
  const smaller = () => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)));
  const other = () => setKind((c) => (c === "protractor180" ? "protractor360" : c === "protractor360" ? "protractor180" : c === "ruler15" ? "ruler30" : "ruler15"));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  // Keyboard on the instrument itself (Tab to it): arrows move (Alt = fine), [ ] turn (Shift = fine), F flips, + / − resize.
  const onKey = (e: RKeyboardEvent) => {
    const s = e.altKey ? 1 : 8, a = e.shiftKey ? 1 : 5;
    if (e.key === "ArrowLeft") setRel((p) => ({ ...p, x: p.x - s }));
    else if (e.key === "ArrowRight") setRel((p) => ({ ...p, x: p.x + s }));
    else if (e.key === "ArrowUp") setRel((p) => ({ ...p, y: p.y - s }));
    else if (e.key === "ArrowDown") setRel((p) => ({ ...p, y: p.y + s }));
    else if (e.key === "[") setRot((r) => norm360(r + a));
    else if (e.key === "]") setRot((r) => norm360(r - a));
    else if (e.key === "f" || e.key === "F") flip();
    else if (e.key === "+" || e.key === "=") bigger();
    else if (e.key === "-" || e.key === "_") smaller();
    else return;
    e.preventDefault();
  };

  const barW = 460;
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth, vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const barLeft = Math.max(8, Math.min(vw - barW - 8, pos.x - (isProt ? barW / 2 : 0)));
  const barTop = Math.max(8, Math.min(vh - 60, pos.y + 16));
  const hx = len + 11, pill = "pointer-events-auto min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-extrabold text-[var(--ink)] shadow-sm";
  const grab = { pointerEvents: "stroke" as const, cursor: "grab", touchAction: "none" as const };
  const R = SIZE.protractor.r;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1100]" data-testid={`instrument-overlay-${kind}`} data-instrument-overlay="">
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g transform={`translate(${pos.x} ${pos.y}) rotate(${-rot}) scale(${k})`}>
          {/* The see-through instrument itself never catches clicks. */}
          <g style={{ pointerEvents: "none" }}><InstrumentArt i={inst} /></g>
          {/* Grab zones: the outline + baseline (stroke only) and the centre cross — everything else is click-through. */}
          <g onPointerDown={down("move")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} tabIndex={0} role="application" onKeyDown={onKey} className="outline-none"
            aria-label={`${label}. Drag to move, arrow keys move, square brackets turn, F flips, plus and minus resize.`} data-testid="instrument-body">
            {isProt ? (
              <>
                {kind === "protractor360"
                  ? <circle cx={0} cy={0} r={R} fill="none" stroke="transparent" strokeWidth={9} style={grab} />
                  : <path d={`M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke="transparent" strokeWidth={9} style={grab} />}
                <line x1={-R} y1={0} x2={R} y2={0} stroke="transparent" strokeWidth={9} style={grab} />
                <circle cx={0} cy={0} r={7} fill="transparent" style={{ pointerEvents: "all", cursor: "grab", touchAction: "none" }} />
              </>
            ) : (
              <rect x={0} y={-30} width={len} height={30} fill="none" stroke="transparent" strokeWidth={9} style={grab} />
            )}
          </g>
          <line x1={len} y1={0} x2={hx - 6} y2={0} stroke="var(--brand)" strokeWidth={0.5} pointerEvents="none" />
          <circle cx={hx} cy={0} r={6.5} fill="var(--surface)" stroke="var(--brand)" strokeWidth={1} onPointerDown={down("turn")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ pointerEvents: "all", cursor: "grab", touchAction: "none" }} data-testid="instrument-turn-handle"><title>Drag to turn</title></circle>
          <path d={`M ${hx - 3} 1.2 A 3.4 3.4 0 1 1 ${hx + 2.6} -2`} fill="none" stroke="var(--brand)" strokeWidth={0.9} strokeLinecap="round" pointerEvents="none" />
        </g>
      </svg>
      <div className="pointer-events-none fixed flex flex-wrap items-center gap-1.5 rounded-3xl bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-1.5 shadow-md backdrop-blur" style={{ left: barLeft, top: barTop, maxWidth: barW }} role="toolbar" aria-label={`${label} controls`}>
        <button type="button" onClick={flip} data-testid="instrument-flip" className={`${pill} ${FOCUS}`}>⇅ Flip</button>
        <button type="button" onClick={() => setRot((r) => norm360(r + 90))} aria-label="Turn a quarter" className={`${pill} ${FOCUS}`}>↻ 90°</button>
        <button type="button" onClick={smaller} aria-label="Smaller" data-testid="instrument-smaller" className={`${pill} ${FOCUS}`}>Smaller</button>
        <button type="button" onClick={bigger} aria-label="Bigger" data-testid="instrument-bigger" className={`${pill} ${FOCUS}`}>Bigger</button>
        <button type="button" onClick={other} data-testid="instrument-kind" className={`${pill} ${FOCUS}`}>{kind === "protractor180" ? "360° protractor" : kind === "protractor360" ? "180° protractor" : kind === "ruler15" ? "30 cm ruler" : "15 cm ruler"}</button>
        {onBoard && <button type="button" onClick={onBoard} className={`${pill} ${FOCUS}`}>Drawing board</button>}
        <button type="button" onClick={onClose} aria-label={`Close ${label}`} data-testid="instrument-close" className={`${pill} ${FOCUS}`}>✕</button>
      </div>
    </div>
  );
}
