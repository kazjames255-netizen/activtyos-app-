"use client";
import { useEffect, useRef } from "react";
import type { LightFact } from "../store";

type TT = (k: string, v?: Record<string, string | number>) => string;
const GLYPH = ["·", "~", "◐", "●", "★"]; // shape as well as colour: colour-blind safe

/** The times-table "ice map": every fact from 2x2 to 12x12, ice -> gold as it is learned. Shapes carry the state too. */
export function IceMap({ T, facts, onClose }: { T: TT; facts: LightFact[]; onClose: () => void }) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  const by = new Map(facts.map((f) => [f.key, f] as const));
  const nums = Array.from({ length: 11 }, (_, i) => i + 2);
  const state = (a: number, b: number) => by.get(`x_${Math.min(a, b)}x${Math.max(a, b)}`)?.thaw ?? 0;
  return (
    <div className="ps-over" data-nokeys data-testid="ps-icemap">
      <div className="ps-card ps-fadein">
        <h2 ref={head} tabIndex={-1} style={{ outline: "none" }}>{T("map_title")}</h2>
        <p>{T("map_hint")}</p>
        <div className="ps-map" style={{ gridTemplateColumns: "repeat(12, 1fr)" }} role="table" aria-label={T("map_title")}>
          <div className="ps-hdr" role="presentation" />
          {nums.map((n) => <div key={`c${n}`} className="ps-hdr" role="columnheader">{n}</div>)}
          {nums.map((a) => (
            <div key={`r${a}`} style={{ display: "contents" }} role="row">
              <div className="ps-hdr" role="rowheader">{a}</div>
              {nums.map((b) => { const s = state(a, b); return <div key={b} role="cell" className={`ps-cell ps-t${s}`} aria-label={T("map_cell", { a, b, state: T(`state_${s}`) })} title={T("map_cell", { a, b, state: T(`state_${s}`) })}>{GLYPH[s]}</div>; })}
            </div>
          ))}
        </div>
        <div className="ps-row" aria-hidden="true">{[0, 1, 2, 3, 4].map((s) => <span key={s} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700 }}><span className={`ps-cell ps-t${s}`} style={{ width: 22 }}>{GLYPH[s]}</span>{T(`state_${s}`)}</span>)}</div>
        <div className="ps-row"><button className="ps-btn ps-big" type="button" style={{ minHeight: 60, fontSize: 22 }} onClick={onClose} data-testid="ps-map-close">{T("back")}</button></div>
      </div>
    </div>
  );
}
