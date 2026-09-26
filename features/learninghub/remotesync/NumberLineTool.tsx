// NumberLineTool.tsx
// Self-contained, working number line tool. No external dependencies beyond React.
// Features: start/end/step, auto-thinned labels (never cut off), tap to place markers,
// drag to move, tap a marker to remove, jump mode (+n arcs), undo, clear, responsive width.
// Provided as a finished component and dropped in as-is — the only changes from the original
// are the import path and swapping literal hex colours for this app's own design tokens.

import { useEffect, useMemo, useRef, useState } from "react";
import { parseStep, suggestRange, tickLabel, zoomRange } from "../tools/numberline/range";

type Jump = { from: number; to: number };
type Props = { initial?: { start?: number; end?: number; step?: number }; /** The question on screen: the line opens framed to ITS numbers (never marking or solving anything). */ prompt?: string };
const PRESETS: { id: string; label: string; start: number; end: number; step: number }[] = [
  { id: "0-10", label: "0 to 10", start: 0, end: 10, step: 1 }, { id: "0-20", label: "0 to 20", start: 0, end: 20, step: 2 }, { id: "0-100", label: "0 to 100", start: 0, end: 100, step: 10 },
  { id: "-10-10", label: "−10 to 10", start: -10, end: 10, step: 1 }, { id: "-20-20", label: "−20 to 20", start: -20, end: 20, step: 2 }, { id: "0-1", label: "0 to 1", start: 0, end: 1, step: 0.1 },
];

const PAD = 32;
const H = 210;
const LINE_Y = 150;
const BLUE = "var(--brand)";
const INK = "var(--ink)";
const MUTED = "var(--ink-3)";
const BORDER = "var(--line)";
const AMBER = "var(--gold)";
const AMBER_INK = "color-mix(in srgb, var(--gold) 60%, black)";

const decimals = (n: number) => {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
};
const fmt = (n: number, d: number) => Number(n.toFixed(d)).toString();

export default function NumberLineTool({ initial, prompt }: Props) {
  const fit = useMemo(() => (prompt ? suggestRange(prompt) : null), [prompt]);
  const [start, setStart] = useState(initial?.start ?? fit?.start ?? 0);
  const [end, setEnd] = useState(initial?.end ?? fit?.end ?? 100);
  const [step, setStep] = useState(initial?.step ?? fit?.step ?? 10);
  const [stepText, setStepText] = useState(String(initial?.step ?? fit?.step ?? 10));
  const [asFraction, setAsFraction] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [markers, setMarkers] = useState<number[]>([]);
  const [jumps, setJumps] = useState<Jump[]>([]);
  const [history, setHistory] = useState<{ markers: number[]; jumps: Jump[] }[]>([]);
  const [mode, setMode] = useState<"mark" | "jump" | "label">("mark");
  const [pending, setPending] = useState<number | null>(null);
  const [width, setWidth] = useState(520);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ index: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(280, entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valid = end > start && step > 0 && (end - start) / step <= 500;
  const d = Math.max(decimals(step), decimals(start), decimals(end));
  const span = end - start;
  const usable = width - 2 * PAD;
  const toX = (v: number) => PAD + ((v - start) / span) * usable;

  // Drop markers/jumps that fall outside a new range
  useEffect(() => {
    if (!valid) return;
    setMarkers((m) => m.filter((v) => v >= start && v <= end));
    setJumps((j) => j.filter((x) => x.from >= start && x.from <= end && x.to >= start && x.to <= end));
    setPending(null);
  }, [start, end, step, valid]);

  const ticks = useMemo(() => {
    if (!valid) return [] as number[];
    const n = Math.round(span / step);
    return Array.from({ length: n + 1 }, (_, i) => Number((start + i * step).toFixed(d)));
  }, [start, step, span, d, valid]);

  // Label thinning so labels never overlap or get cut off
  const tickPx = usable / Math.max(1, ticks.length - 1);
  const lbl = (v: number) => tickLabel(v, d, asFraction);
  const longest = ticks.reduce((m, t) => Math.max(m, lbl(t).length), 1);
  const minLabelPx = longest * 8 + 12;
  const labelEvery = Math.max(1, Math.ceil(minLabelPx / tickPx));

  const snapFromClientX = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const raw = start + ((x - PAD) / usable) * span;
    const snapped = start + Math.round((raw - start) / step) * step;
    return Number(Math.min(end, Math.max(start, snapped)).toFixed(d));
  };

  const saveHistory = () => setHistory((h) => [...h.slice(-30), { markers, jumps }]);

  const placeAt = (v: number) => {
    if (mode === "mark") {
      if (markers.includes(v)) return;
      saveHistory();
      setMarkers((m) => [...m, v].sort((a, b) => a - b));
    } else {
      if (pending === null) {
        setPending(v);
      } else if (v !== pending) {
        saveHistory();
        setJumps((j) => [...j, { from: pending, to: v }]);
        setPending(null);
      }
    }
  };

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!valid || mode === "label") return; // in Label mode only a marker is tappable
    placeAt(snapFromClientX(e.clientX));
  };

  const onMarkerPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    if (mode === "jump") {
      placeAt(markers[index]);
      return;
    }
    if (mode === "label") { setEditing(markers[index]!); return; }
    dragRef.current = { index, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const v = snapFromClientX(e.clientX);
    if (v === markers[drag.index]) return;
    if (!drag.moved) saveHistory();
    drag.moved = true;
    setMarkers((m) => {
      const next = [...m];
      next[drag.index] = v;
      return next;
    });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (!drag.moved) {
      saveHistory();
      setMarkers((m) => m.filter((_, i) => i !== drag.index));
    } else {
      setMarkers((m) => Array.from(new Set(m)).sort((a, b) => a - b));
    }
    dragRef.current = null;
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setMarkers(last.markers);
    setJumps(last.jumps);
    setHistory((h) => h.slice(0, -1));
    setPending(null);
  };

  const clearAll = () => {
    if (!markers.length && !jumps.length) return;
    saveHistory();
    setMarkers([]);
    setJumps([]);
    setPending(null);
  };

  const numInput = (label: string, value: number, set: (n: number) => void) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: MUTED }}>
      {label}
      <input
        type="number"
        value={value}
        step="any"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) set(n);
        }}
        style={{ width: 76, height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 15, color: INK }}
      />
    </label>
  );

  const btn = (active = false): React.CSSProperties => ({
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 8,
    border: `1.5px solid ${active ? BLUE : BORDER}`,
    background: active ? BLUE : "#fff",
    color: active ? "#fff" : INK,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, boxSizing: "border-box", height: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
        {numInput("Start", start, setStart)}
        {numInput("End", end, setEnd)}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: MUTED }}>
          Step
          <input type="text" inputMode="decimal" value={stepText} data-testid="nl-step" aria-label="Step (a number, decimal or fraction like 1/4)"
            onChange={(e) => { setStepText(e.target.value); const n = parseStep(e.target.value); if (n !== null && n > 0) setStep(n); }}
            style={{ width: 76, height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 15, color: INK }} />
        </label>
        <div style={{ flexGrow: 1 }} />
        <div role="group" aria-label="Mode" style={{ display: "flex", gap: 6 }}>
          <button type="button" style={btn(mode === "mark")} aria-pressed={mode === "mark"} onClick={() => { setMode("mark"); setPending(null); }}>Mark</button>
          <button type="button" style={btn(mode === "jump")} aria-pressed={mode === "jump"} onClick={() => setMode("jump")}>Jump</button>
          <button type="button" style={btn(mode === "label")} aria-pressed={mode === "label"} onClick={() => { setMode("label"); setPending(null); }} data-testid="nl-label">Label</button>
        </div>
        <button type="button" style={btn()} onClick={undo} disabled={!history.length} data-testid="nl-undo">Undo</button>
        <button type="button" style={btn()} onClick={clearAll} data-testid="nl-clear">Clear</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }} role="group" aria-label="Line size">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" style={{ ...btn(start === p.start && end === p.end && step === p.step), minHeight: 44, padding: "0 12px" }} data-testid={`nl-preset-${p.id}`}
            onClick={() => { setStart(p.start); setEnd(p.end); setStep(p.step); setStepText(String(p.step)); }}>{p.label}</button>
        ))}
        <span style={{ width: 8 }} aria-hidden />
        <button type="button" style={{ ...btn(), minHeight: 44 }} data-testid="nl-zoom-in" aria-label="Zoom in" onClick={() => { const r = zoomRange({ start, end, step }, 0.5); setStart(r.start); setEnd(r.end); setStep(r.step); setStepText(String(r.step)); }}>Zoom in</button>
        <button type="button" style={{ ...btn(), minHeight: 44 }} data-testid="nl-zoom-out" aria-label="Zoom out" onClick={() => { const r = zoomRange({ start, end, step }, 2); setStart(r.start); setEnd(r.end); setStep(r.step); setStepText(String(r.step)); }}>Zoom out</button>
        <button type="button" style={{ ...btn(asFraction), minHeight: 44 }} aria-pressed={asFraction} data-testid="nl-fractions" onClick={() => setAsFraction((f) => !f)}>Fractions</button>
      </div>
      {editing !== null && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: INK }}>
          Label for {lbl(editing)}:
          <input autoFocus data-testid="nl-label-input" value={labels[String(editing)] ?? ""} maxLength={14} placeholder={lbl(editing)}
            onChange={(e) => setLabels((l) => ({ ...l, [String(editing)]: e.target.value }))} onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(null); }}
            style={{ width: 130, height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 15, color: INK }} />
        </label>
      )}

      <div style={{ fontSize: 13, color: MUTED, minHeight: 18 }}>
        {!valid
          ? "End must be bigger than Start, and Step must be above 0."
          : mode === "mark"
          ? "Tap the line to add a marker. Drag a marker to move it, tap it to remove it."
          : mode === "label"
          ? "Label mode: tap a marker to give it a name."
          : pending === null
          ? "Jump mode: tap where the jump starts."
          : `Jump from ${fmt(pending, d)}: now tap where it lands.`}
      </div>

      <div ref={wrapRef} style={{ width: "100%", flexGrow: 1, minHeight: H }}>
        {valid && (
          <svg
            ref={svgRef}
            width={width}
            height={H}
            role="img"
            aria-label={`Number line from ${fmt(start, d)} to ${fmt(end, d)} in steps of ${fmt(step, d)}`}
            style={{ display: "block", touchAction: "none", cursor: "crosshair", userSelect: "none" }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Main line with arrowheads */}
            <line x1={PAD - 16} y1={LINE_Y} x2={width - PAD + 16} y2={LINE_Y} stroke={INK} strokeWidth={2.5} />
            <path d={`M ${PAD - 22} ${LINE_Y} l 10 -6 v 12 z`} fill={INK} />
            <path d={`M ${width - PAD + 22} ${LINE_Y} l -10 -6 v 12 z`} fill={INK} />

            {/* Ticks + labels */}
            {ticks.map((t, i) => {
              const x = toX(t);
              const labelled = i % labelEvery === 0 || i === ticks.length - 1;
              return (
                <g key={t}>
                  <line x1={x} y1={LINE_Y - (labelled ? 10 : 6)} x2={x} y2={LINE_Y + (labelled ? 10 : 6)} stroke={INK} strokeWidth={labelled ? 2 : 1.25} />
                  {labelled && (
                    <text x={x} y={LINE_Y + 30} textAnchor="middle" fontSize={14} fontWeight={600} fill={INK}>
                      {lbl(t)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Jump arcs */}
            {jumps.map((j, i) => {
              const x1 = toX(j.from);
              const x2 = toX(j.to);
              const h = Math.min(100, 24 + Math.abs(x2 - x1) * 0.35);
              const mid = (x1 + x2) / 2;
              const diff = Number((j.to - j.from).toFixed(d));
              return (
                <g key={`j${i}`} pointerEvents="none">
                  <path d={`M ${x1} ${LINE_Y - 4} Q ${mid} ${LINE_Y - h} ${x2} ${LINE_Y - 4}`} fill="none" stroke={AMBER} strokeWidth={2.5} />
                  <path d={`M ${x2} ${LINE_Y - 4} l ${x2 > x1 ? -9 : 9} -5 l 1 9 z`} fill={AMBER} />
                  <text x={mid} y={LINE_Y - h / 2 - 8} textAnchor="middle" fontSize={14} fontWeight={800} fill={AMBER_INK}>
                    {diff > 0 ? `+${fmt(diff, d)}` : `−${fmt(Math.abs(diff), d)}`}
                  </text>
                </g>
              );
            })}

            {/* Pending jump start */}
            {pending !== null && <circle cx={toX(pending)} cy={LINE_Y} r={8} fill="none" stroke={AMBER} strokeWidth={2.5} strokeDasharray="3 3" />}

            {/* Markers */}
            {markers.map((m, i) => (
              <g key={`m${m}`} onPointerDown={(e) => onMarkerPointerDown(e, i)} style={{ cursor: mode === "mark" ? "grab" : "pointer" }}>
                <circle cx={toX(m)} cy={LINE_Y} r={16} fill="transparent" />
                <circle cx={toX(m)} cy={LINE_Y} r={9} fill={BLUE} stroke="#fff" strokeWidth={2} />
                <text x={toX(m)} y={LINE_Y + 52} textAnchor="middle" fontSize={13} fontWeight={800} fill={BLUE}>
                  {labels[String(m)] ?? lbl(m)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div aria-live="polite" style={{ fontSize: 13, color: MUTED }}>
        {markers.length ? `Markers: ${markers.map((m) => fmt(m, d)).join(", ")}` : "No markers yet"}
        {jumps.length ? ` · Jumps: ${jumps.map((j) => `${fmt(j.from, d)}→${fmt(j.to, d)}`).join(", ")}` : ""}
      </div>
    </div>
  );
}
