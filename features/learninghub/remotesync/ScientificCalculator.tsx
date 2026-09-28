"use client";

import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n/provider";
import { CalcError, evaluate, formatResult, toFraction } from "../tools/calc/evaluate";

// The child's scientific calculator: brackets, powers, roots, π, trigonometry (degrees or radians), %, standard form (×10ˣ), ANS, and an S⇔D
// key (decimal ↔ fraction). Built for the questions the judging pass gave a calculator to (Year 7-13: sector areas, trig lengths and angles,
// compound interest, standard form, "to 2 d.p." work). It never rounds for the child and never gives an answer the child did not key in.
// Keyboard: click the calculator, then type digits and + − * / ^ ( ) . % · Enter or = evaluates · Backspace deletes · Escape clears.

export interface CalcState {
  expr: string;
  /** The last result (feeds the ANS key), null before the first "=". */
  ans: number | null;
  /** Degrees (default) or radians. */
  deg: boolean;
  /** The shown result of the last "=" — when set, the next digit starts fresh and the next operator continues from ANS. */
  shown: string | null;
  /** S⇔D toggle: show the last result as a fraction. */
  asFraction: boolean;
}
export const CALC_DEFAULT: CalcState = { expr: "", ans: null, deg: true, shown: null, asFraction: false };

const MAX = 120;
const OPS = new Set(["+", "−", "×", "÷", "^", "²", "³", "%"]);

export function ScientificCalculator({ value, onChange }: { value: CalcState; onChange: (v: CalcState) => void }) {
  const t = useT();
  const v = { ...CALC_DEFAULT, ...value };
  const box = useRef<HTMLDivElement>(null);
  const set = (p: Partial<CalcState>) => onChange({ ...v, ...p });

  // Typing after "=": an operator carries on from ANS; anything else starts a new calculation.
  const press = (k: string) => {
    let base = v.expr;
    if (v.shown !== null) base = OPS.has(k) && v.ans !== null ? "ANS" : "";
    set({ expr: (base + k).slice(0, MAX), shown: null, asFraction: false });
  };
  const back = () => set({ expr: v.shown !== null ? "" : v.expr.replace(/(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|√\(|ANS|.)$/, ""), shown: null, asFraction: false });
  const clear = () => set({ expr: "", shown: null, asFraction: false });
  const equals = () => {
    if (!v.expr.trim()) return;
    try {
      const r = evaluate(v.expr, { ans: v.ans ?? 0, deg: v.deg });
      set({ ans: r, shown: formatResult(r), asFraction: false });
    } catch (e) {
      set({ shown: e instanceof CalcError ? e.message : "Error", asFraction: false });
    }
  };
  const negate = () => {
    if (v.shown !== null && v.ans !== null) set({ expr: `−${formatResult(v.ans)}`, shown: null });
    else set({ expr: v.expr.startsWith("−") ? v.expr.slice(1) : `−${v.expr}` });
  };
  const toggleFraction = () => { if (v.ans !== null && v.shown !== null && v.shown !== "Error") set({ asFraction: !v.asFraction }); };

  const frac = v.asFraction && v.ans !== null ? toFraction(v.ans) : null;
  const result = v.shown === null ? "" : frac ? `${frac.n}${frac.d !== 1 ? `/${frac.d}` : ""}` : v.asFraction ? t("hublive.dNoSimpleFrac", { v: v.shown === "Error" ? t("hublive.dError") : v.shown }) : v.shown === "Error" ? t("hublive.dError") : v.shown;

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[0-9.]$/.test(k)) press(k);
    else if (k === "+") press("+");
    else if (k === "-") press("−");
    else if (k === "*" || k === "x" || k === "X") press("×");
    else if (k === "/") press("÷");
    else if (k === "^") press("^");
    else if (k === "(" || k === ")") press(k);
    else if (k === "%") press("%");
    else if (k === "p" || k === "P") press("π");
    else if (k === "Enter" || k === "=") equals();
    else if (k === "Backspace") back();
    else if (k === "Escape") clear();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const btn = "min-h-[44px] rounded-lg text-[14px] font-extrabold hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]";
  const num = `${btn} bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]`, fn = `${btn} bg-[var(--panel)] text-[var(--ink-2)] text-[13px]`, op = `${btn} bg-[var(--brand-soft)] text-[var(--brand-strong)]`;
  const K = (label: string, insert: string, cls = fn, title?: string) => (
    <button key={label} type="button" onClick={() => press(insert)} className={cls} title={title} aria-label={title ?? label} data-testid={`calc-key-${insert}`}>{label}</button>
  );

  return (
    <div ref={box} tabIndex={0} onKeyDown={onKey} aria-label={t("hublive.dCalcAria")} data-testid="calculator" className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-lg">
      <div className="mb-2 rounded-lg bg-[var(--panel)] px-2.5 py-2 text-end" aria-live="polite">
        <div className="min-h-[22px] break-all text-[15px] font-bold text-[var(--ink-2)]" data-testid="calc-display">{v.expr || "0"}</div>
        <div className="min-h-[28px] break-all text-[22px] font-extrabold text-[var(--ink)]" data-testid="calc-result">{result || " "}</div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {K("sin", "sin(")}{K("cos", "cos(")}{K("tan", "tan(")}{K("(", "(", op)}{K(")", ")", op)}
        {K("sin⁻¹", "sin⁻¹(", fn, t("hublive.dInvSine"))}{K("cos⁻¹", "cos⁻¹(", fn, t("hublive.dInvCos"))}{K("tan⁻¹", "tan⁻¹(", fn, t("hublive.dInvTan"))}{K("π", "π")}
        <button type="button" onClick={() => set({ deg: !v.deg })} aria-pressed={v.deg} className={`${btn} ${v.deg ? "bg-[var(--brand)] text-white" : "bg-[var(--gold-soft,#fff4d6)] text-[var(--ink)]"} text-[12.5px]`} data-testid="calc-angle">{v.deg ? "DEG" : "RAD"}</button>
        {K("x²", "²")}{K("x³", "³")}{K("xʸ", "^", fn, t("hublive.dToPower"))}{K("√", "√(", fn, t("hublive.dSqrt"))}
        <button type="button" onClick={back} className={fn} aria-label={t("hublive.dDelete")} data-testid="calc-back">⌫</button>
        {K("7", "7", num)}{K("8", "8", num)}{K("9", "9", num)}{K("÷", "÷", op)}
        <button type="button" onClick={clear} className={`${btn} bg-[var(--red-soft,#fde3e3)] text-[var(--red,#b3261e)]`} data-testid="calc-clear">AC</button>
        {K("4", "4", num)}{K("5", "5", num)}{K("6", "6", num)}{K("×", "×", op)}{K("%", "%", op, t("hublive.dPercent"))}
        {K("1", "1", num)}{K("2", "2", num)}{K("3", "3", num)}{K("−", "−", op)}{K("ANS", "ANS", fn, t("hublive.dPrevAns"))}
        {K("0", "0", num)}{K(".", ".", num)}{K("×10ˣ", "×10^", fn, t("hublive.dTimesTenPower"))}{K("+", "+", op)}
        <button type="button" onClick={equals} className={`${btn} bg-[var(--brand)] text-white`} data-testid="calc-equals">=</button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={negate} className={fn} data-testid="calc-negate" aria-label={t("hublive.dChangeSign")}>{t("hublive.dChangeSignBtn")}</button>
        <button type="button" onClick={toggleFraction} className={fn} data-testid="calc-fraction" aria-label={t("hublive.dSwitchDecFrac")}>{t("hublive.dFracDecBtn")}</button>
      </div>
    </div>
  );
}
