"use client";

import { useMemo, useState } from "react";
import { FOCUS } from "../../../kit";
import type { ToolProps } from "../../types";
import { BANK, EQ_TYPES, type BankEquation, type EqLevel, type EqType } from "./bank";
import { atomTotals, equationChecker, formatFormula, parseEquation, solveBalance } from "./chem";

// Equation balancer (plan S-05): change the big numbers in front of each substance until every atom matches.

const LEVELS: { v: EqLevel; label: string }[] = [{ v: 1, label: "1 · KS3" }, { v: 2, label: "2 · KS4 core" }, { v: 3, label: "3 · KS4 stretch" }];
const btn = `min-h-[44px] min-w-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] font-extrabold text-[var(--ink)] ${FOCUS}`;
const btnPrimary = `min-h-[44px] rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-4 text-[14px] font-extrabold text-white ${FOCUS}`;

function pick(level: EqLevel, type: EqType | "all", not?: string): BankEquation {
  const pool = BANK.filter((b) => b.level === level && (type === "all" || b.type === type));
  const from = (pool.length ? pool : BANK.filter((b) => b.level === level)).filter((b) => b.id !== not);
  const list = from.length ? from : BANK;
  return list[Math.floor(Math.random() * list.length)]!;
}

export default function EquationBalancer(props: Partial<ToolProps>) {
  const mode = props.mode ?? "practise";
  const assess = mode === "assess", showTable = !assess;
  const [level, setLevel] = useState<EqLevel>(1);
  const [type, setType] = useState<EqType | "all">("all");
  const [item, setItem] = useState<BankEquation>(() => BANK[0]!);
  const eq = useMemo(() => parseEquation(item.eq), [item]);
  const answer = useMemo(() => solveBalance(item.eq) ?? [], [item]);
  const n = eq.left.length + eq.right.length;
  const [coeffs, setCoeffs] = useState<number[]>(() => Array(n).fill(1));
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const load = (b: BankEquation) => {
    setItem(b); setCoeffs(Array(parseEquation(b.eq).left.length + parseEquation(b.eq).right.length).fill(1)); setFb(null); setDone(false);
  };
  const next = (lv = level, ty = type) => load(pick(lv, ty, item.id));
  const setC = (i: number, v: number) => { setCoeffs((c) => c.map((x, k) => (k === i ? Math.min(99, Math.max(1, Math.round(v) || 1)) : x))); setFb(null); setDone(false); };

  const totals = useMemo(() => atomTotals(eq, coeffs), [eq, coeffs]);
  const elements = useMemo(() => [...new Set([...Object.keys(totals.left), ...Object.keys(totals.right)])], [totals]);
  const check = () => { const r = equationChecker(eq, coeffs); setFb({ ok: r.ok, text: r.message }); };
  const hint = () => {
    const i = coeffs.findIndex((c, k) => c !== answer[k]);
    if (i >= 0) { setCoeffs((c) => c.map((x, k) => (k === i ? answer[k]! : x))); setFb({ ok: false, text: `Hint: I've set the number for ${formatFormula([...eq.left, ...eq.right][i]!)}.` }); }
  };
  const show = () => { setCoeffs(answer); setFb({ ok: true, text: "Here is the balanced equation." }); };

  const sub = (f: string, i: number) => (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2">
      <div className="flex items-center gap-1">
        <button type="button" className={btn} aria-label={`Decrease number in front of ${formatFormula(f)}`} onClick={() => setC(i, coeffs[i]! - 1)}>−</button>
        <input inputMode="numeric" aria-label={`Number in front of ${formatFormula(f)}`} value={coeffs[i]} onChange={(e) => setC(i, Number(e.target.value.replace(/\D/g, "")))} className={`min-h-[44px] w-14 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-center text-[24px] font-extrabold text-[var(--ink)] ${FOCUS}`} />
        <button type="button" className={btn} aria-label={`Increase number in front of ${formatFormula(f)}`} onClick={() => setC(i, coeffs[i]! + 1)}>+</button>
      </div>
      <span className="text-[24px] font-extrabold text-[var(--ink)]">{formatFormula(f)}</span>
    </div>
  );

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <div className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Level" className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => <button key={l.v} type="button" aria-pressed={level === l.v} className={`${btn} text-[13px] ${level === l.v ? "!border-[var(--brand)] !bg-[var(--brand)] !text-white" : ""}`} onClick={() => { setLevel(l.v); next(l.v, type); }}>{l.label}</button>)}
        </div>
        <label className="grid gap-1 text-[12px] font-bold text-[var(--ink-2)]">Type
          <select value={type} onChange={(e) => { const t = e.target.value as EqType | "all"; setType(t); next(level, t); }} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            <option value="all">All types</option>{EQ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="button" className={btnPrimary} onClick={() => next()}>New equation</button>
      </div>

      <p className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{item.type} · {item.name}</p>
      <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Change the big numbers so each element has the same number of atoms on both sides.</p>

      <div role="group" aria-label="Equation" className="flex flex-wrap items-center gap-2">
        {eq.left.map((f, i) => <span key={`l${i}`} className="flex items-center gap-2">{i > 0 && <b className="text-[24px]">+</b>}{sub(f, i)}</span>)}
        <b className="text-[28px]" aria-label="reacts to make">→</b>
        {eq.right.map((f, i) => <span key={`r${i}`} className="flex items-center gap-2">{i > 0 && <b className="text-[24px]">+</b>}{sub(f, eq.left.length + i)}</span>)}
      </div>

      {showTable && (
        <table className="w-full max-w-[420px] border-collapse text-[15px]" aria-label="Atom count">
          <thead><tr className="text-left text-[12px] text-[var(--ink-2)]"><th className="p-1">Element</th><th className="p-1">Left</th><th className="p-1">Right</th><th className="p-1">Match</th></tr></thead>
          <tbody>{elements.map((el) => { const l = totals.left[el] ?? 0, r = totals.right[el] ?? 0, ok = l === r; return (
            <tr key={el} className="border-t border-[var(--line)] font-bold"><td className="p-1">{el}</td><td className="p-1">{l}</td><td className="p-1">{r}</td><td className="p-1" aria-label={ok ? "balanced" : "not balanced"}>{ok ? "✓" : "✗"}</td></tr>); })}</tbody>
        </table>
      )}

      <div className="flex flex-wrap gap-2">
        {mode === "practise" && <button type="button" className={btnPrimary} onClick={check}>Check</button>}
        {assess && <button type="button" className={btnPrimary} onClick={() => setDone(true)}>Lock in answer</button>}
        {!assess && <button type="button" className={btn} onClick={hint}>Show me a hint</button>}
        {!assess && <button type="button" className={btn} onClick={show}>Show answer</button>}
      </div>
      {fb && !assess && <p role="status" className={`m-0 rounded-xl border p-2 text-[14px] font-bold ${fb.ok ? "border-[var(--brand)]" : "border-[var(--line)]"} bg-[var(--panel)]`}>{fb.ok ? "✓" : "✗"} {fb.text}</p>}
      {assess && done && <p role="status" className="m-0 text-[14px] font-bold">Answer recorded. Try another equation when you are ready.</p>}
    </div>
  );
}
