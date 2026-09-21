"use client";

import { useState } from "react";
import { FOCUS } from "../../kit";
import type { WidgetProps } from "./types";

// Explore widget "fractionBar" — change a fraction, then group the parts into equal chunks to see how it simplifies.
// Pure teaching illustration: nothing here is scored or stored.

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const TRY: [number, number][] = [[6, 8], [12, 18], [8, 12], [5, 9], [15, 20]];

function Frac({ n, d }: { n: number; d: number }) {
  return (
    <span className="inline-flex flex-col items-center align-middle font-black leading-[1.1] text-[var(--brand)]" role="math" aria-label={`${n} over ${d}`}>
      <b className="border-b-[3px] border-[var(--brand)] px-2 pb-0.5">{n}</b><u className="pt-0.5 no-underline">{d}</u>
    </span>
  );
}

const step = `inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] text-[18px] font-extrabold text-[var(--brand)] hover:border-[var(--brand-2)] disabled:opacity-40 ${FOCUS}`;
const chip = (on: boolean) => `min-h-[44px] rounded-xl border-2 px-3.5 text-[13px] font-extrabold ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--brand)] hover:border-[var(--brand-2)]"} ${FOCUS}`;

export function FractionBar({ onXP }: WidgetProps) {
  const [n0, setN] = useState(6);
  const [d, setD] = useState(8);
  const [f, setF] = useState(1);
  const n = Math.max(1, Math.min(n0, d));
  const g = gcd(n, d);
  const common = Array.from({ length: d }, (_, i) => i + 1).filter((k) => k > 1 && n % k === 0 && d % k === 0);
  const say = f === 1
    ? `Highest common factor of ${n} and ${d}: ${g}${g === 1 ? " — nothing to divide by, so it is already simplest." : " — dividing by it gives the simplest form."}`
    : f === g ? "The top and bottom now share no factor other than 1." : `You can go further: ${n / f} and ${d / f} still share a factor.`;

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-line)] p-4" style={{ background: "linear-gradient(180deg, var(--brand-soft), var(--surface))" }} data-widget="fractionBar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[var(--ink-2)]">Shaded</span>
          <button type="button" className={step} aria-label="Shade one fewer part" disabled={n <= 1} onClick={() => { setF(1); setN(n - 1); }}>−</button>
          <span className="min-w-[2ch] text-center text-[18px] font-black tabular-nums text-[var(--brand)]" aria-live="polite">{n}</span>
          <button type="button" className={step} aria-label="Shade one more part" disabled={n >= d} onClick={() => { setF(1); setN(n + 1); }}>+</button></div>
        <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[var(--ink-2)]">Equal parts</span>
          <button type="button" className={step} aria-label="One fewer equal part" disabled={d <= 2} onClick={() => { setF(1); const nd = Math.max(2, d - 1); setD(nd); setN(Math.min(n, nd)); }}>−</button>
          <span className="min-w-[2ch] text-center text-[18px] font-black tabular-nums text-[var(--brand)]" aria-live="polite">{d}</span>
          <button type="button" className={step} aria-label="One more equal part" disabled={d >= 24} onClick={() => { setF(1); setD(d + 1); }}>+</button></div>
      </div>
      <div className="flex h-[66px] overflow-hidden rounded-xl bg-[var(--surface)]" role="img" aria-label={`A bar cut into ${d} equal parts with ${n} shaded`}>
        {Array.from({ length: d }, (_, i) => {
          const cut = f > 1 && (i + 1) % f === 0 && i < d - 1;
          return <i key={i} className="flex-1 border-r-2 border-[var(--surface)] transition-[margin,background-color] duration-300 last:border-r-0 motion-reduce:transition-none" style={{ background: i < n ? "var(--brand-2)" : "var(--brand-line)", marginRight: cut ? 12 : 0, borderRightColor: cut ? "transparent" : undefined }} />;
        })}
      </div>
      <div className="my-3.5 text-center text-[26px]" aria-live="polite">
        {f === 1 ? <Frac n={n} d={d} /> : <><Frac n={n} d={d} /> = <Frac n={n / f} d={d / f} />{f === g && <span className="ml-2 rounded-full bg-[var(--green-soft)] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[var(--hub-green-ink)]">simplest form ✓</span>}</>}
      </div>
      <p className="m-0 mb-2 text-center text-[13px] text-[var(--ink-3)]">Group the parts — divide top and bottom by the same number:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {common.length ? <>
          {common.map((k) => <button key={k} type="button" className={chip(k === f)} aria-pressed={k === f} onClick={() => { setF(k); if (k > 1) onXP(2); }}>÷ {k}</button>)}
          {f > 1 && <button type="button" className={chip(false)} onClick={() => setF(1)}>Reset</button>}
        </> : <span className="rounded-full bg-[var(--green-soft)] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[var(--hub-green-ink)]">Already in its simplest form</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><span className="text-[13px] text-[var(--ink-3)]">Try:</span>
        {TRY.map(([a, b]) => <button key={`${a}/${b}`} type="button" className={chip(false)} onClick={() => { setN(a); setD(b); setF(1); }}>{a}/{b}</button>)}
      </div>
      <p className="m-0 mt-2.5 text-center text-[13px] text-[var(--ink-3)]" role="status">{say}</p>
    </div>
  );
}
