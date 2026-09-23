"use client";

import { PAPER_H, PAPER_W, type PaperKind } from "./model";

// Paper backgrounds (plan M-20), drawn in real millimetres so a printed page is print-accurate. Colours are the tenant's theme tokens only.
const LINE = "color-mix(in srgb, var(--brand-2) 34%, transparent)";
const LINE_MINOR = "color-mix(in srgb, var(--brand-2) 18%, transparent)";
const DOT = "color-mix(in srgb, var(--ink-2) 70%, transparent)";

export function PaperDefs({ id }: { id: string }) {
  const isoH = 5 * Math.sqrt(3);
  return (
    <defs>
      <pattern id={`${id}-sq`} width={5} height={5} patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke={LINE_MINOR} strokeWidth={0.18} /></pattern>
      <pattern id={`${id}-sq10`} width={10} height={10} patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke={LINE} strokeWidth={0.3} /></pattern>
      <pattern id={`${id}-dot`} width={5} height={5} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={0.3} fill={DOT} /><circle cx={5} cy={0} r={0.3} fill={DOT} /><circle cx={0} cy={5} r={0.3} fill={DOT} /><circle cx={5} cy={5} r={0.3} fill={DOT} /></pattern>
      <pattern id={`${id}-iso`} width={10} height={isoH * 2} patternUnits="userSpaceOnUse">
        <path d={`M0 0L10 ${isoH * 2}M10 0L0 ${isoH * 2}M0 ${isoH}H10`} fill="none" stroke={LINE_MINOR} strokeWidth={0.2} />
        <path d={`M0 ${isoH}L5 0L10 ${isoH}L5 ${isoH * 2}Z`} fill="none" stroke={LINE_MINOR} strokeWidth={0.2} />
      </pattern>
      <pattern id={`${id}-mm`} width={1} height={1} patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke={LINE_MINOR} strokeWidth={0.08} /></pattern>
      <pattern id={`${id}-mm5`} width={5} height={5} patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke={LINE} strokeWidth={0.15} /></pattern>
      <pattern id={`${id}-mm10`} width={10} height={10} patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke={LINE} strokeWidth={0.32} /></pattern>
    </defs>
  );
}

export function Paper({ id, kind }: { id: string; kind: PaperKind }) {
  const fill = (p: string) => <rect x={0} y={0} width={PAPER_W} height={PAPER_H} fill={`url(#${id}-${p})`} />;
  const cx = PAPER_W / 2, cy = PAPER_H / 2;
  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={PAPER_W} height={PAPER_H} fill="var(--surface)" />
      {kind === "squared" && <>{fill("sq")}{fill("sq10")}</>}
      {kind === "dotted" && fill("dot")}
      {kind === "isometric" && fill("iso")}
      {kind === "graph" && <>{fill("mm")}{fill("mm5")}{fill("mm10")}</>}
      {kind === "polar" && (
        <g fill="none" stroke={LINE} strokeWidth={0.25}>
          {Array.from({ length: 7 }, (_, i) => <circle key={i} cx={cx} cy={cy} r={(i + 1) * 10} />)}
          {Array.from({ length: 24 }, (_, i) => { const a = (i * 15 * Math.PI) / 180; return <line key={i} x1={cx} y1={cy} x2={cx + 70 * Math.cos(a)} y2={cy - 70 * Math.sin(a)} />; })}
        </g>
      )}
      <rect x={0} y={0} width={PAPER_W} height={PAPER_H} fill="none" stroke="var(--ink-3)" strokeWidth={0.4} />
    </g>
  );
}
