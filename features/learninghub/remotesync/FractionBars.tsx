"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../kit";
import { useBareTool } from "../tools/bareContext";
import { MAX_DEN, MAX_WHOLES, label, newBar, reslice, setDen, setWholes, toggle, type Bar } from "../tools/fractions/bars";

// Fraction bars for the "use a bar model" questions: 1–4 wholes, up to 24 parts per whole, tap parts to shade them, name the whole and label parts yourself,
// re-slice a bar into finer parts (3/4 → 6/8), and add a second bar to line two fractions up. It never adds, compares, finds a common denominator or divides
// for the child — it only shows what THEY shade and write.

const BAR_H = [30, 44, 60];

interface Named { bar: Bar; whole: string; names: Record<number, string> }
const blank = (den = 4): Named => ({ bar: newBar(den), whole: "", names: {} });

export default function FractionBars() {
  const t = useT();
  const [bars, setBars] = useState<Named[]>([blank()]);
  const bare = useBareTool();
  const [size, setSize] = useState(1);
  const [mode, setMode] = useState<"shade" | "label">("shade");
  const [editing, setEditing] = useState<{ b: number; i: number } | null>(null);
  const put = (k: number, f: (n: Named) => Named) => setBars((bs) => bs.map((x, j) => (j === k ? f(x) : x)));
  const btn = `min-h-[44px] rounded-full border px-3 text-[13px] font-extrabold ${FOCUS}`;
  const line = "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]";
  const on = "border-[var(--brand)] bg-[var(--brand)] text-white";

  return (
    <div data-testid="fraction-bars" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hublive.dFractionBars")} data-tool-strip>
        <button type="button" aria-pressed={mode === "shade"} onClick={() => { setMode("shade"); setEditing(null); }} className={`${btn} ${mode === "shade" ? on : line}`}>{t("hublive.dShade")}</button>
        <button type="button" aria-pressed={mode === "label"} onClick={() => setMode("label")} className={`${btn} ${mode === "label" ? on : line}`} data-testid="frac-label-mode">{t("hublive.dLabelParts")}</button>
        <button type="button" data-tool-chrome onClick={() => setSize((s) => Math.max(0, s - 1))} className={`${btn} ${line}`} aria-label={t("hublive.dSmallerBars")} data-testid="frac-smaller">{t("hublive.dSmaller")}</button>
        <button type="button" data-tool-chrome onClick={() => setSize((s) => Math.min(BAR_H.length - 1, s + 1))} className={`${btn} ${line}`} aria-label={t("hublive.dBiggerBars")} data-testid="frac-bigger">{t("hublive.dBigger")}</button>
        {bars.length < 2
          ? <button type="button" onClick={() => setBars((bs) => [...bs, blank(bs[0]?.bar.den ?? 4)])} className={`${btn} ${line}`} data-testid="frac-second">{t("hublive.dSecondBar")}</button>
          : <button type="button" onClick={() => setBars((bs) => bs.slice(0, 1))} className={`${btn} ${line}`}>{t("hublive.dRemoveSecondBar")}</button>}
      </div>

      {bars.map((n, k) => (
        <section key={k} className={`grid gap-1.5 ${bare ? "" : "rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5"}`} aria-label={t("hublive.dBarN", { n: k + 1 })}>
          <div data-tool-strip className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-[var(--ink)]">
            <label data-tool-chrome className="inline-flex items-center gap-1.5">{t("hublive.dWholeEq")}
              <input value={n.whole} onChange={(e) => put(k, (x) => ({ ...x, whole: e.target.value.slice(0, 14) }))} placeholder={t("hublive.dWholePh")} aria-label={t("hublive.dNameWhole")} data-testid={`frac-whole-${k}`}
                className={`min-h-[44px] w-24 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold ${FOCUS}`} /></label>
            <span className="inline-flex items-center gap-1">{t("hublive.dPartsEach")}
              <button type="button" className={`${btn} ${line} min-w-[44px]`} aria-label={t("hublive.dFewerParts")} onClick={() => put(k, (x) => ({ ...x, bar: setDen(x.bar, x.bar.den - 1), names: {} }))}>−</button>
              <input type="number" min={1} max={MAX_DEN} value={n.bar.den} aria-label={t("hublive.dPartsEach")} data-testid="frac-den" onChange={(e) => { const v = Number(e.target.value); if (v >= 1) put(k, (x) => ({ ...x, bar: setDen(x.bar, v), names: {} })); }}
                className={`min-h-[44px] w-16 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-center text-[14px] font-extrabold ${FOCUS}`} />
              <button type="button" className={`${btn} ${line} min-w-[44px]`} aria-label={t("hublive.dMoreParts")} onClick={() => put(k, (x) => ({ ...x, bar: setDen(x.bar, x.bar.den + 1), names: {} }))}>＋</button>
            </span>
            <span className="inline-flex items-center gap-1">{t("hublive.dWholes")}
              <button type="button" className={`${btn} ${line} min-w-[44px]`} aria-label={t("hublive.dFewerWholes")} onClick={() => put(k, (x) => ({ ...x, bar: setWholes(x.bar, x.bar.wholes - 1) }))}>−</button>
              <b data-testid="frac-wholes">{n.bar.wholes}</b>
              <button type="button" className={`${btn} ${line} min-w-[44px]`} aria-label={t("hublive.dMoreWholes")} disabled={n.bar.wholes >= MAX_WHOLES} onClick={() => put(k, (x) => ({ ...x, bar: setWholes(x.bar, x.bar.wholes + 1) }))}>＋</button>
            </span>
          </div>
          {Array.from({ length: n.bar.wholes }, (_, w) => (
            <div key={w} className="flex overflow-hidden rounded-lg border-2 border-[var(--ink-2)]" style={{ height: BAR_H[size] }}>
              {Array.from({ length: n.bar.den }, (_, p) => {
                const i = w * n.bar.den + p, sh = n.bar.shaded.includes(i), nm = n.names[i];
                return (
                  <button key={i} type="button" data-testid={`frac-part-${k}-${i}`} aria-pressed={sh} aria-label={t("hublive.dPartOf", { p: p + 1, d: n.bar.den }) + (sh ? t("hublive.dShadedSfx") : "") + (nm ? t("hublive.dLabelledSfx", { name: nm }) : "")}
                    onClick={() => (mode === "label" ? setEditing({ b: k, i }) : put(k, (x) => ({ ...x, bar: toggle(x.bar, i) })))}
                    className={`min-w-0 flex-1 border-r border-[var(--ink-2)] text-[12px] font-extrabold last:border-r-0 ${FOCUS} ${sh ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--ink)] hover:brightness-95"}`}>{nm ?? ""}</button>
                );
              })}
            </div>
          ))}
          {editing && editing.b === k && (
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--ink)]">{t("hublive.dLabelForPart")}
              <input autoFocus maxLength={10} data-testid="frac-part-label" value={n.names[editing.i] ?? ""} onChange={(e) => put(k, (x) => ({ ...x, names: { ...x.names, [editing.i]: e.target.value } }))} onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(null); }}
                className={`min-h-[44px] w-28 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold ${FOCUS}`} /></label>
          )}
          <div data-tool-strip className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]">
            <span data-tool-chrome aria-live="polite" data-testid={`frac-readout-${k}`}>{t("hublive.dShadedLbl")} <b>{label(n.bar)}</b></span>
            <span className="ms-auto inline-flex items-center gap-1">{t("hublive.dSplitEvery")}
              {[2, 3].map((f) => <button key={f} type="button" disabled={n.bar.den * f > MAX_DEN} className={`${btn} ${line} disabled:opacity-40`} data-testid={`frac-split-${f}`} onClick={() => put(k, (x) => { const r = reslice(x.bar, f); return r ? { ...x, bar: r, names: {} } : x; })}>{f}</button>)}
              <button type="button" className={`${btn} ${line}`} onClick={() => put(k, (x) => ({ ...x, bar: { ...x.bar, shaded: [] }, names: {} }))}>{t("hublive.dClear")}</button>
            </span>
          </div>
        </section>
      ))}
    </div>
  );
}
