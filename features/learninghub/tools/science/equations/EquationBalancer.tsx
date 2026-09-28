"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../../../kit";
import { useBareTool } from "../../bareContext";
import type { ToolProps } from "../../types";
import { BANK, EQ_TYPES, type BankEquation, type EqLevel, type EqType } from "./bank";
import { atomTotals, equationChecker, formatFormula, parseEquation, solveBalance } from "./chem";

// Equation balancer (plan S-05): change the big numbers in front of each substance until every atom matches.

const LEVELS: { v: EqLevel; key: string }[] = [{ v: 1, key: "sc_eq_l1" }, { v: 2, key: "sc_eq_l2" }, { v: 3, key: "sc_eq_l3" }];
// equation type value (kept English for the bank) -> translation key
const TYPE_KEY: Record<EqType, string> = { combustion: "sc_eqt_combustion", neutralisation: "sc_eqt_neutralisation", "metal + acid": "sc_eqt_metalAcid", "metal + oxygen": "sc_eqt_metalOxygen", displacement: "sc_eqt_displacement", "thermal decomposition": "sc_eqt_thermal", precipitation: "sc_eqt_precipitation", extraction: "sc_eqt_extraction", "respiration / photosynthesis": "sc_eqt_respiration", other: "sc_eqt_other" };
const btn = `min-h-[44px] min-w-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] font-extrabold text-[var(--ink)] ${FOCUS}`;
const btnPrimary = `min-h-[44px] rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-4 text-[14px] font-extrabold text-white ${FOCUS}`;

function pick(level: EqLevel, type: EqType | "all", not?: string): BankEquation {
  const pool = BANK.filter((b) => b.level === level && (type === "all" || b.type === type));
  const from = (pool.length ? pool : BANK.filter((b) => b.level === level)).filter((b) => b.id !== not);
  const list = from.length ? from : BANK;
  return list[Math.floor(Math.random() * list.length)]!;
}

export default function EquationBalancer(props: Partial<ToolProps>) {
  const bare = useBareTool();
  const t = useT();
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
  const check = () => { const r = equationChecker(eq, coeffs, t); setFb({ ok: r.ok, text: r.message }); };
  const hint = () => {
    const i = coeffs.findIndex((c, k) => c !== answer[k]);
    if (i >= 0) { setCoeffs((c) => c.map((x, k) => (k === i ? answer[k]! : x))); setFb({ ok: false, text: t("hubtoolsb.sc_eq_hintDone", { f: formatFormula([...eq.left, ...eq.right][i]!) }) }); }
  };
  const show = () => { setCoeffs(answer); setFb({ ok: true, text: t("hubtoolsb.sc_eq_shown") }); };

  const sub = (f: string, i: number) => (
    <div className={`flex flex-col items-center gap-1 ${bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2"}`}>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} aria-label={t("hubtoolsb.sc_eq_dec", { f: formatFormula(f) })} onClick={() => setC(i, coeffs[i]! - 1)}>−</button>
        <input inputMode="numeric" aria-label={t("hubtoolsb.sc_eq_numIn", { f: formatFormula(f) })} value={coeffs[i]} onChange={(e) => setC(i, Number(e.target.value.replace(/\D/g, "")))} className={`min-h-[44px] w-14 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-center text-[24px] font-extrabold text-[var(--ink)] ${FOCUS}`} />
        <button type="button" className={btn} aria-label={t("hubtoolsb.sc_eq_inc", { f: formatFormula(f) })} onClick={() => setC(i, coeffs[i]! + 1)}>+</button>
      </div>
      <span className="text-[24px] font-extrabold text-[var(--ink)]">{formatFormula(f)}</span>
    </div>
  );

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <div data-tool-chrome className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label={t("hubtoolsb.sc_eq_level")} className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => <button key={l.v} type="button" aria-pressed={level === l.v} className={`${btn} text-[13px] ${level === l.v ? "!border-[var(--brand)] !bg-[var(--brand)] !text-white" : ""}`} onClick={() => { setLevel(l.v); next(l.v, type); }}>{t(`hubtoolsb.${l.key}`)}</button>)}
        </div>
        <label className="grid gap-1 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_eq_type")}
          <select value={type} onChange={(e) => { const ty = e.target.value as EqType | "all"; setType(ty); next(level, ty); }} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            <option value="all">{t("hubtoolsb.sc_eq_allTypes")}</option>{EQ_TYPES.map((ty) => <option key={ty} value={ty}>{t(`hubtoolsb.${TYPE_KEY[ty]}`)}</option>)}
          </select>
        </label>
        <button type="button" className={btnPrimary} onClick={() => next()}>{t("hubtoolsb.sc_eq_new")}</button>
      </div>

      <p data-tool-chrome className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{t(`hubtoolsb.${TYPE_KEY[item.type]}`)} · {item.name}</p>
      <p data-tool-chrome className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_eq_instr")}</p>

      <div role="group" aria-label={t("hubtoolsb.sc_eq_equation")} className="flex flex-wrap items-center gap-2">
        {eq.left.map((f, i) => <span key={`l${i}`} className="flex items-center gap-2">{i > 0 && <b className="text-[24px]">+</b>}{sub(f, i)}</span>)}
        <b className="text-[28px]" aria-label={t("hubtoolsb.sc_eq_reacts")}>→</b>
        {eq.right.map((f, i) => <span key={`r${i}`} className="flex items-center gap-2">{i > 0 && <b className="text-[24px]">+</b>}{sub(f, eq.left.length + i)}</span>)}
      </div>

      {showTable && (
        <table className="w-full max-w-[420px] border-collapse text-[15px]" aria-label={t("hubtoolsb.sc_eq_atomCount")}>
          <thead><tr className="text-start text-[12px] text-[var(--ink-2)]"><th className="p-1 text-start">{t("hubtoolsb.sc_eq_element")}</th><th className="p-1 text-start">{t("hubtoolsb.sc_eq_left")}</th><th className="p-1 text-start">{t("hubtoolsb.sc_eq_right")}</th><th className="p-1 text-start">{t("hubtoolsb.sc_eq_match")}</th></tr></thead>
          <tbody>{elements.map((el) => { const l = totals.left[el] ?? 0, r = totals.right[el] ?? 0, ok = l === r; return (
            <tr key={el} className="border-t border-[var(--line)] font-bold"><td className="p-1">{el}</td><td className="p-1">{l}</td><td className="p-1">{r}</td><td className="p-1" aria-label={ok ? t("hubtoolsb.sc_eq_balanced") : t("hubtoolsb.sc_eq_notBalanced")}>{ok ? "✓" : "✗"}</td></tr>); })}</tbody>
        </table>
      )}

      {bare && <div data-tool-strip><button type="button" className={btn} onClick={() => { setCoeffs(Array(n).fill(1)); setFb(null); }}>{t("hubtoolsb.sc_eq_reset")}</button></div>}
      <div data-tool-chrome className="flex flex-wrap gap-2">
        {mode === "practise" && <button type="button" className={btnPrimary} onClick={check}>{t("hubtoolsb.sc_eq_check")}</button>}
        {assess && <button type="button" className={btnPrimary} onClick={() => setDone(true)}>{t("hubtoolsb.sc_eq_lock")}</button>}
        {!assess && <button type="button" className={btn} onClick={hint}>{t("hubtoolsb.sc_eq_hintBtn")}</button>}
        {!assess && <button type="button" className={btn} onClick={show}>{t("hubtoolsb.sc_eq_showAns")}</button>}
      </div>
      {fb && !assess && <p data-tool-chrome role="status" className={`m-0 rounded-xl border p-2 text-[14px] font-bold ${fb.ok ? "border-[var(--brand)]" : "border-[var(--line)]"} bg-[var(--panel)]`}>{fb.ok ? "✓" : "✗"} {fb.text}</p>}
      {assess && done && <p data-tool-chrome role="status" className="m-0 text-[14px] font-bold">{t("hubtoolsb.sc_eq_recorded")}</p>}
    </div>
  );
}
