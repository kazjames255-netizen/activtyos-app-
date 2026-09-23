"use client";

import type { ReactNode } from "react";
import { barLen, barWidth, hasScale, SIZE, compassPen } from "./instruments";
import type { Instrument } from "./model";

// How each instrument LOOKS. Drawn in the instrument's own frame (origin = its origin, +x along its baseline, body extends toward −y = "up"),
// then placed with translate/rotate by the board. Millimetres throughout. Instruments are see-through so the paper shows underneath.

const BODY = "color-mix(in srgb, var(--brand-2) 9%, transparent)";
const INK = "var(--ink-2)";
const Txt = ({ x, y, children, size = 2.7, anchor = "middle", fill = INK, bold = false }: { x: number; y: number; children: ReactNode; size?: number; anchor?: "start" | "middle" | "end"; fill?: string; bold?: boolean }) =>
  <text x={x} y={y} fontSize={size} textAnchor={anchor} fill={fill} fontWeight={bold ? 700 : 500} style={{ userSelect: "none" }}>{children}</text>;
const P = (r: number, a: number): [number, number] => [r * Math.cos((a * Math.PI) / 180), -r * Math.sin((a * Math.PI) / 180)];

function Ruler({ i }: { i: Instrument }) {
  const L = barLen(i.kind), W = barWidth(i.kind), scaled = hasScale(i.kind);
  const ticks: ReactNode[] = [];
  if (scaled) for (let mm = 0; mm <= L; mm++) {
    const len = mm % 10 === 0 ? 7 : mm % 5 === 0 ? 5 : 3;
    ticks.push(<line key={mm} x1={mm} y1={0} x2={mm} y2={-len} stroke={INK} strokeWidth={mm % 10 === 0 ? 0.3 : 0.18} />);
    if (mm % 10 === 0 && mm > 0 && mm < L) ticks.push(<Txt key={`t${mm}`} x={mm} y={-9.2} size={3}>{mm / 10}</Txt>);
  }
  return <g><rect x={0} y={-W} width={L} height={W} rx={0.8} fill={BODY} stroke={INK} strokeWidth={0.35} />{ticks}{scaled && <Txt x={L - 5} y={-W + 5} size={2.6} anchor="end">cm</Txt>}</g>;
}

function SetSquare({ i }: { i: Instrument }) {
  const { a, b } = i.kind === "setsquare45" ? SIZE.setsquare45 : SIZE.setsquare3060;
  const k = 0.32; // hole
  return (
    <g>
      <path d={`M0 0L${a} 0L0 ${-b}Z`} fill={BODY} stroke={INK} strokeWidth={0.35} />
      <path d={`M${a * 0.16} ${-b * 0.16}L${a * (0.16 + k * 0.6)} ${-b * 0.16}L${a * 0.16} ${-b * (0.16 + k * 0.6)}Z`} fill="var(--surface)" fillOpacity={0.6} stroke={INK} strokeWidth={0.2} />
      <path d="M0 0H5V-5H0" fill="none" stroke={INK} strokeWidth={0.3} />
      <Txt x={a * 0.55} y={-2.2} size={2.6}>{i.kind === "setsquare45" ? "45°" : "30° / 60°"}</Txt>
    </g>
  );
}

function Protractor({ i }: { i: Instrument }) {
  const r = SIZE.protractor.r, full = i.kind === "protractor360", ticks: ReactNode[] = [], labels: ReactNode[] = [];
  const top = full ? 360 : 180;
  for (let a = 0; a <= top; a++) {
    if (full && a === 360) break;
    const long = a % 10 === 0, mid = a % 5 === 0, len = long ? 5 : mid ? 3.6 : 2.2, [x1, y1] = P(r, a), [x2, y2] = P(r - len, a);
    ticks.push(<line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={long ? 0.28 : 0.16} />);
    if (long) {
      const [ox, oy] = P(r - 8.6, a), [ix, iy] = P(r - 15, a);
      labels.push(<Txt key={`o${a}`} x={ox} y={oy + 1} size={2.6}>{a}</Txt>);
      if (a > 0 || !full) labels.push(<Txt key={`i${a}`} x={ix} y={iy + 0.9} size={2.2} fill="color-mix(in srgb, var(--ink-2) 65%, transparent)">{full ? (360 - a) % 360 : 180 - a}</Txt>);
    }
  }
  return (
    <g>
      {full ? <circle cx={0} cy={0} r={r} fill={BODY} stroke={INK} strokeWidth={0.35} /> : <path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`} fill={BODY} stroke={INK} strokeWidth={0.35} />}
      {ticks}{labels}
      <line x1={-r} y1={0} x2={r} y2={0} stroke={INK} strokeWidth={0.3} />
      <line x1={0} y1={0} x2={0} y2={-6} stroke={INK} strokeWidth={0.25} /><circle cx={0} cy={0} r={1.1} fill="none" stroke="var(--brand)" strokeWidth={0.35} /><line x1={-3} y1={0} x2={3} y2={0} stroke="var(--brand)" strokeWidth={0.3} />
    </g>
  );
}

/** The compass is drawn in WORLD space (the needle stays put while the pencil sweeps) — see `CompassArt`. */
export function CompassArt({ i, showRadius }: { i: Instrument; showRadius: boolean }) {
  const c: [number, number] = [i.x, i.y], pen = compassPen(i), r = i.r ?? 60;
  const mx = (c[0] + pen[0]) / 2, my = (c[1] + pen[1]) / 2, dx = pen[0] - c[0], dy = pen[1] - c[1], len = Math.hypot(dx, dy) || 1;
  const h = Math.sqrt(Math.max(400, 130 * 130 - (r / 2) ** 2)), nx = dy / len, ny = -dx / len;
  const hinge: [number, number] = [mx + (nx > 0 || (nx === 0 && ny < 0) ? nx : -nx) * h * 0.55, my + (nx > 0 || (nx === 0 && ny < 0) ? ny : -ny) * h * 0.55];
  return (
    <g fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${c[0]} ${c[1]}L${hinge[0]} ${hinge[1]}L${pen[0]} ${pen[1]}`} />
      <circle cx={hinge[0]} cy={hinge[1]} r={2.2} fill="var(--surface)" />
      <circle cx={c[0]} cy={c[1]} r={1.2} fill="var(--brand)" stroke="none" />
      <circle cx={pen[0]} cy={pen[1]} r={1.5} fill="var(--ink)" stroke="none" />
      {showRadius && <text x={mx} y={my + 4} fontSize={3.2} textAnchor="middle" fill={INK} stroke="none" fontWeight={700} style={{ userSelect: "none" }}>{Math.round(r * 10) / 10} mm</text>}
    </g>
  );
}

export function InstrumentArt({ i }: { i: Instrument }) {
  switch (i.kind) {
    case "ruler15": case "ruler30": case "straightedge": return <Ruler i={i} />;
    case "setsquare45": case "setsquare3060": return <SetSquare i={i} />;
    case "protractor180": case "protractor360": return <Protractor i={i} />;
    default: return null;
  }
}
