"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../kit";
import { norm, snap45, turn } from "../tools/compass/turn";

// A compass rose the child turns to work out a direction: N/E/S/W and the in-between points are fixed on the rose; the arrow starts pointing North and is
// turned with the buttons (90° / 45°, clockwise or anticlockwise) or dragged. It draws the arrow only — it never writes the direction's name, so the child
// still reads the answer off the rose.

export default function CompassTool() {
  const t = useT();
  const cpName: Record<string, string> = { N: t("hublive.dCpN"), NE: t("hublive.dCpNE"), E: t("hublive.dCpE"), SE: t("hublive.dCpSE"), S: t("hublive.dCpS"), SW: t("hublive.dCpSW"), W: t("hublive.dCpW"), NW: t("hublive.dCpNW") };
  const [heading, setHeading] = useState(0); // degrees clockwise from North
  const [log, setLog] = useState<number[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const apply = (d: number) => { setHeading((h) => turn(h, d)); setLog((l) => [...l.slice(-7), d]); };
  const fromEvent = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    return norm((Math.atan2(x, -y) * 180) / Math.PI);
  };
  const btn = `min-h-[44px] min-w-[64px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`;
  const pts = [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SW", 225], ["W", 270], ["NW", 315]] as const;
  return (
    <div data-testid="compass">
      <svg ref={svg} viewBox="-110 -110 220 220" role="img" aria-label={t("hublive.dCompassAria")} style={{ width: "100%", maxWidth: 300, display: "block", margin: "0 auto", touchAction: "none", cursor: "grab" }}
        onPointerDown={(e) => { drag.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); setHeading(snap45(fromEvent(e))); }}
        onPointerMove={(e) => { if (drag.current) setHeading(snap45(fromEvent(e))); }} onPointerUp={() => { drag.current = false; }}>
        <circle r={100} fill="var(--panel)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <circle r={78} fill="none" stroke="var(--line)" strokeWidth={1} />
        {pts.map(([n, a]) => {
          const rad = (a * Math.PI) / 180, card = n.length === 1, r0 = card ? 78 : 86, r1 = 100;
          return (
            <g key={n}>
              <line x1={r0 * Math.sin(rad)} y1={-r0 * Math.cos(rad)} x2={r1 * Math.sin(rad)} y2={-r1 * Math.cos(rad)} stroke="var(--ink-2)" strokeWidth={card ? 2 : 1} />
              <text x={(card ? 64 : 66) * Math.sin(rad)} y={-(card ? 64 : 66) * Math.cos(rad) + 4} textAnchor="middle" fontSize={card ? 15 : 10} fontWeight={card ? 800 : 600} fill="var(--ink)">{cpName[n]}</text>
            </g>
          );
        })}
        <g data-testid="compass-heading" data-heading={heading} style={{ transform: `rotate(${heading}deg)`, transition: "transform .35s ease" }}>
          <path d="M0 -50 L9 0 L-9 0 Z" fill="var(--red, #e21d27)" /><path d="M0 50 L9 0 L-9 0 Z" fill="var(--ink-3)" /><circle r={4} fill="var(--ink)" />
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={t("hublive.dTurnArrow")} data-tool-strip>
        <button type="button" className={btn} onClick={() => apply(-90)} data-testid="compass-turn-left" aria-label={t("hublive.dTurn90ccw")}>↺ 90°</button>
        <button type="button" className={btn} onClick={() => apply(-45)} aria-label={t("hublive.dTurn45ccw")}>↺ 45°</button>
        <button type="button" className={btn} onClick={() => apply(45)} aria-label={t("hublive.dTurn45cw")}>↻ 45°</button>
        <button type="button" className={btn} onClick={() => apply(90)} data-testid="compass-turn-right" aria-label={t("hublive.dTurn90cw")}>↻ 90°</button>
        <button type="button" className={btn} onClick={() => { setHeading(0); setLog([]); }} data-testid="compass-reset">{t("hublive.dPointNorth")}</button>
      </div>
      <p data-tool-chrome className="m-0 mt-2 text-center text-[12px] font-semibold text-[var(--ink-3)]" aria-live="polite">{log.length ? t("hublive.dTurnsLog", { list: log.map((d) => `${d > 0 ? "↻" : "↺"}${Math.abs(d)}°`).join("  ") }) : t("hublive.dCompassHint")}</p>
    </div>
  );
}
