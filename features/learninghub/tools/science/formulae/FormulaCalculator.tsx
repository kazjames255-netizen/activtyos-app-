"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";
import { FOCUS } from "../../../kit";
import { useBareTool } from "../../bareContext";
import { checkQuantity } from "../../engine/quantity";
import { newSeed } from "../../engine/rng";
import type { ToolProps } from "../../types";
import { FORMULAE, GROUP_ORDER, formulaById, formulaeByGroup, varOf, type Values } from "./formulae";
import { convertUnit, formatNum, formatSF, readValue, unitOptions } from "./units";
import { generateQuestion, workedForQuestion, workedSolution, type Worked } from "./worked";
import { translateQuantityFeedback } from "./quantityText";

// Formula & units calculator (plan S-03): pick a formula, choose what to find, see the rearrangement and a worked solution; or practise.

type Scaffold = "full" | "prompts" | "blank";
const SCAFFOLDS: { id: Scaffold; key: string }[] = [{ id: "full", key: "sc_fc_full" }, { id: "prompts", key: "sc_fc_prompts" }, { id: "blank", key: "sc_fc_blank" }];
const INPUT = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-bold text-[var(--ink)] ${FOCUS}`;
const LABEL = "grid gap-1 text-[12px] font-bold text-[var(--ink-2)]";
const CARD_CLS = "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3";

function Steps({ worked, scaffold, oneAtATime }: { worked: Worked; scaffold: Scaffold; oneAtATime: boolean }) {
  const t = useT();
  const [shown, setShown] = useState(1);
  if (scaffold === "blank") return <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_fc_blankNote")}</p>;
  const label = (s: Worked["steps"][number]) => t(`hubtoolsb.sc_ws_${s.k}`);
  const prompt = (s: Worked["steps"][number]) => t(`hubtoolsb.sc_wp_${s.k}`, { sym: worked.sym, n: worked.sigFigs });
  const text = (s: Worked["steps"][number]) => (s.extra ? `${s.body}${s.extra.k === "cover" ? "\n" : "  "}${t(s.extra.k === "cover" ? "hubtoolsb.sc_wx_cover" : "hubtoolsb.sc_wx_sf", { sym: String(s.extra.v), n: String(s.extra.v) })}` : s.body);
  const list = oneAtATime ? worked.steps.slice(0, shown) : worked.steps;
  return (
    <div className="grid gap-2">
      <ol className="m-0 grid list-none gap-1.5 p-0" aria-label={t("hubtoolsb.sc_fc_workedAria")}>
        {list.map((s) => (
          <li key={s.n} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
            <b className="text-[12.5px] text-[var(--ink)]">{t("hubtoolsb.sc_fc_step", { n: s.n, label: label(s) })}</b>
            <p className="m-0 mt-0.5 whitespace-pre-line text-[13.5px] font-semibold text-[var(--ink)]">{scaffold === "full" ? text(s) : prompt(s)}</p>
          </li>
        ))}
      </ol>
      {oneAtATime && shown < worked.steps.length && <div><Button onClick={() => setShown((x) => x + 1)}>{t("hubtoolsb.sc_fc_showNext", { a: shown, b: worked.steps.length })}</Button></div>}
    </div>
  );
}

function TriangleBox({ f, unknown }: { f: NonNullable<ReturnType<typeof formulaById>>; unknown: string }) {
  const tt = useT();
  const t = f.triangle;
  if (!t) return null;
  const cell = (s: string) => <span className={`grid min-h-[40px] min-w-[40px] place-items-center rounded-lg border px-2 text-[15px] font-extrabold ${s === unknown ? "border-dashed border-[var(--brand)] text-[var(--brand)]" : "border-[var(--line)] text-[var(--ink)]"}`}>{s === unknown ? `(${s})` : s}</span>;
  return (
    <figure className="m-0 grid justify-items-center gap-1" aria-label={tt("hubtoolsb.sc_fc_triAria", { top: t.top, a: t.bottom[0], b: t.bottom[1] })}>
      <div className="grid justify-items-center gap-1">{cell(t.top)}<div className="flex items-center gap-1">{cell(t.bottom[0])}<span aria-hidden className="text-[var(--ink-2)]">×</span>{cell(t.bottom[1])}</div></div>
      <figcaption className="text-[11.5px] font-semibold text-[var(--ink-2)]">{tt("hubtoolsb.sc_fc_cover", { unknown })}</figcaption>
    </figure>
  );
}

export default function FormulaCalculator(props: Partial<ToolProps>) {
  const bare = useBareTool();
  const t = useT();
  const assess = props.mode === "assess";
  const [tabSel, setTab] = useState<"calc" | "practise">(assess || props.mode === "practise" ? "practise" : "calc");
  const tab = bare && !assess ? "calc" : tabSel; // "Just the tool": the formula calculator itself, never the practice questions
  const CARD = bare ? "" : CARD_CLS;
  const [fid, setFid] = useState("speed");
  const f = formulaById(fid)!;
  const [unknown, setUnknown] = useState(f.subject);
  const [sf, setSf] = useState(3);
  const [scaffold, setScaffold] = useState<Scaffold>("full");
  const [oneAtATime, setOneAtATime] = useState(false);
  const [entries, setEntries] = useState<Record<string, { text: string; unit: string }>>({});
  const [outUnit, setOutUnit] = useState<string | null>(null);

  const pick = (id: string) => { const nf = formulaById(id)!; setFid(id); setUnknown(nf.subject); setEntries({}); setOutUnit(null); };
  const setUnknownVar = (s: string) => { setUnknown(s); setOutUnit(null); };
  const entryOf = (sym: string) => entries[sym] ?? { text: sym === "g" ? "9.8" : "", unit: varOf(f, sym).unit };
  const setEntry = (sym: string, patch: Partial<{ text: string; unit: string }>) => setEntries((e) => ({ ...e, [sym]: { ...entryOf(sym), ...patch } }));

  const calc = useMemo(() => {
    const values: Values = {}, errors: Record<string, string> = {}, notes: string[] = [];
    for (const x of f.vars) {
      if (x.sym === unknown) continue;
      const e = entries[x.sym] ?? { text: x.sym === "g" ? "9.8" : "", unit: x.unit };
      if (!e.text.trim()) { errors[x.sym] = t("hubtoolsb.sc_fc_typeValue"); continue; }
      const r = readValue(e.text, e.unit, x.unit, t);
      if ("error" in r) { errors[x.sym] = r.error; continue; }
      values[x.sym] = r.value;
      if (r.unit !== x.unit) notes.push(`${x.sym}: ${formatNum(Number(e.text.match(/-?\d*\.?\d+/)?.[0] ?? NaN))} ${r.unit} = ${formatNum(r.value)} ${x.unit}`);
    }
    if (Object.keys(errors).length) return { errors, notes, worked: null as Worked | null, problem: null as string | null };
    const w = workedSolution(f, unknown, values, sf);
    return { errors, notes, worked: Number.isFinite(w.raw) ? w : null, problem: Number.isFinite(w.raw) ? null : t("hubtoolsb.sc_fc_impossible") };
  }, [f, unknown, entries, sf, t]);

  // practise
  const [pf, setPf] = useState<string>("any");
  const [q, setQ] = useState<ReturnType<typeof generateQuestion> | null>(null);
  const [ans, setAns] = useState(""), [fb, setFb] = useState<string[] | null>(null), [saved, setSaved] = useState(false), [reveal, setReveal] = useState(false);
  const next = () => {
    const seed = newSeed(), ids = FORMULAE.map((x) => x.id);
    const id = pf === "any" ? ids[seed % ids.length]! : pf;
    setQ(generateQuestion(id, seed, { sigFigs: Math.min(4, Math.max(2, sf)) })); setAns(""); setFb(null); setSaved(false); setReveal(false);
  };
  const check = () => {
    if (!q) return;
    if (assess) { setSaved(true); return; }
    const r = checkQuantity(ans, q.expected, { sigFigs: q.sigFigs, marks: { value: 1, unit: q.expected.unit ? 1 : 0, sf: 1 } });
    setFb([...translateQuantityFeedback(r, t), t("hubtoolsb.sc_fc_score", { s: r.score, m: r.max })]); setReveal(true);
  };
  const qWorked = q && reveal ? workedForQuestion(q) : null;

  const answerIn = outUnit ?? varOf(f, unknown).unit;
  const uv = varOf(f, unknown);
  const shownAnswer = calc.worked ? (() => { const c = convertUnit(calc.worked.raw, uv.unit, answerIn); return c === null ? calc.worked.answer.text : `${formatSF(c, sf)}${answerIn ? " " + answerIn : ""}`; })() : "";

  return (
    <div className="grid gap-3">
      {!assess && <div data-tool-chrome role="tablist" aria-label={t("hubtoolsb.sc_fc_mode")} className="flex flex-wrap gap-2">
        {([["calc", t("hubtoolsb.sc_fc_calc")], ["practise", t("hubtoolsb.sc_fc_practise")]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-[44px] rounded-xl border px-4 text-[13.5px] font-extrabold ${FOCUS} ${tab === id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{label}</button>
        ))}
      </div>}

      {tab === "calc" && !assess && (
        <div className="grid gap-3">
          <div data-tool-strip className="flex flex-wrap items-end gap-2">
            <label className={LABEL}>{t("hubtoolsb.sc_fc_formula")}
              <select value={fid} onChange={(e) => pick(e.target.value)} className={`${INPUT} max-w-full`}>
                {GROUP_ORDER.map((g) => <optgroup key={g} label={t(`hubtoolsb.sc_fg_${g.toLowerCase()}`)}>{formulaeByGroup(g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
              </select>
            </label>
            <label className={LABEL}>{t("hubtoolsb.sc_fc_find")}
              <select value={unknown} onChange={(e) => setUnknownVar(e.target.value)} className={INPUT}>
                {f.vars.map((x) => <option key={x.sym} value={x.sym}>{x.name} ({x.sym})</option>)}
              </select>
            </label>
            <label data-tool-chrome className={LABEL}>{t("hubtoolsb.sc_fc_sig")}
              <select value={sf} onChange={(e) => setSf(Number(e.target.value))} className={INPUT}>{[2, 3, 4].map((n) => <option key={n} value={n}>{t("hubtoolsb.sc_fc_sfN", { n })}</option>)}</select>
            </label>
          </div>

          {bare && <div data-tool-strip><button type="button" className={`${INPUT} px-3`} onClick={() => setEntries({})}>{t("hubtoolsb.sc_fc_clear")}</button></div>}
          <div className={CARD}>
            <p className="m-0 text-[14px] font-extrabold text-[var(--ink)]">{f.words}</p>
            <p className="m-0 mt-1 text-[13.5px] font-semibold text-[var(--ink)]">{f.symbol}{unknown !== f.subject && <> &nbsp;→&nbsp; <b>{f.rearranged[unknown]}</b></>}</p>
            <div className="mt-2"><TriangleBox f={f} unknown={unknown} /></div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {f.vars.filter((x) => x.sym !== unknown).map((x) => {
              const e = entryOf(x.sym), err = entries[x.sym] ? calc.errors[x.sym] : undefined, opts = unitOptions(x.unit);
              return (
                <div key={x.sym} className={LABEL}>
                  <label htmlFor={`fc-${x.sym}`}>{x.name} ({x.sym})</label>
                  <div className="flex gap-1.5">
                    <input id={`fc-${x.sym}`} inputMode="decimal" value={e.text} onChange={(ev) => setEntry(x.sym, { text: ev.target.value })} placeholder={t("hubtoolsb.sc_fc_eg", { v: formatNum(x.lo) })} aria-invalid={!!err} className={`${INPUT} w-full min-w-0`} />
                    {opts.length > 1 ? <select aria-label={t("hubtoolsb.sc_fc_unitFor", { name: x.name })} value={e.unit} onChange={(ev) => setEntry(x.sym, { unit: ev.target.value })} className={INPUT}>{opts.map((u) => <option key={u}>{u}</option>)}</select> : <span className="grid min-h-[44px] place-items-center px-1 text-[13px] font-bold text-[var(--ink)]">{x.unit || t("hubtoolsb.sc_fc_noUnit")}</span>}
                  </div>
                  {err && <span role="alert" className="text-[12px] font-bold text-[var(--ink)]">✗ {err}</span>}
                </div>
              );
            })}
          </div>
          <p data-tool-chrome className="m-0 text-[11.5px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_fc_tip")}</p>

          <div className={CARD} aria-live="polite">
            {calc.worked ? <>
              <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">✓ {uv.name} ({unknown}) = {shownAnswer}</p>
              {calc.notes.length > 0 && <p className="m-0 mt-1 text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_fc_converted", { list: calc.notes.join("; ") })}</p>}
              {unitOptions(uv.unit).length > 1 && <label className={`${LABEL} mt-2 max-w-[200px]`}>{t("hubtoolsb.sc_fc_showIn")}<select value={answerIn} onChange={(e) => setOutUnit(e.target.value)} className={INPUT}>{unitOptions(uv.unit).map((u) => <option key={u}>{u}</option>)}</select></label>}
            </> : <p className="m-0 text-[13.5px] font-semibold text-[var(--ink-2)]">{calc.problem ?? t("hubtoolsb.sc_fc_fill")}</p>}
          </div>

          {calc.worked && <div data-tool-chrome className="grid gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label={t("hubtoolsb.sc_fc_scaffold")} className="flex flex-wrap gap-1.5">
                {SCAFFOLDS.map((s) => <button key={s.id} aria-pressed={scaffold === s.id} onClick={() => setScaffold(s.id)} className={`min-h-[40px] rounded-xl border px-3 text-[12.5px] font-bold ${FOCUS} ${scaffold === s.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{scaffold === s.id ? "✓ " : ""}{t(`hubtoolsb.${s.key}`)}</button>)}
              </div>
              <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={oneAtATime} onChange={(e) => setOneAtATime(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsb.sc_fc_oneAtATime")}</label>
            </div>
            <Steps key={`${fid}-${unknown}-${oneAtATime}-${scaffold}-${sf}-${calc.worked.answer.text}`} worked={calc.worked} scaffold={scaffold} oneAtATime={oneAtATime} />
          </div>}
        </div>
      )}

      {(tab === "practise" || assess) && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            {!assess && <label className={LABEL}>{t("hubtoolsb.sc_fc_topic")}
              <select value={pf} onChange={(e) => setPf(e.target.value)} className={INPUT}><option value="any">{t("hubtoolsb.sc_fc_anyFormula")}</option>{GROUP_ORDER.map((g) => <optgroup key={g} label={t(`hubtoolsb.sc_fg_${g.toLowerCase()}`)}>{formulaeByGroup(g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select>
            </label>}
            <Button variant="primary" onClick={next}>{q ? t("hubtoolsb.sc_fc_newQ") : t("hubtoolsb.sc_fc_getQ")}</Button>
          </div>
          {q && <div role="region" aria-label={t("hubtoolsb.sc_fc_question")} className={CARD}>
            <p className="m-0 text-[14.5px] font-extrabold text-[var(--ink)]">{q.prompt}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className={LABEL}>{t("hubtoolsb.sc_fc_yourAns")}<input value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") check(); }} inputMode="text" placeholder={q.expected.unit ? t("hubtoolsb.sc_fc_eg", { v: `12.5 ${q.expected.unit}` }) : t("hubtoolsb.sc_fc_eg", { v: "12.5" })} className={`${INPUT} w-56 max-w-full`} /></label>
              <Button variant="primary" onClick={check} disabled={!ans.trim()}>{assess ? t("hubtoolsb.sc_fc_saveAns") : t("hubtoolsb.sc_fc_check")}</Button>
            </div>
            {saved && <p role="status" className="m-0 mt-2 text-[13px] font-bold text-[var(--ink)]">{t("hubtoolsb.sc_fc_saved")}</p>}
            {fb && <ul role="status" className="m-0 mt-2 grid list-none gap-0.5 p-0 text-[13.5px] font-bold text-[var(--ink)]">{fb.map((l, i) => <li key={i}>{l}</li>)}</ul>}
          </div>}
          {!assess && q && qWorked && <div className={CARD}>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <div role="group" aria-label={t("hubtoolsb.sc_fc_scaffold")} className="flex flex-wrap gap-1.5">{SCAFFOLDS.map((s) => <button key={s.id} aria-pressed={scaffold === s.id} onClick={() => setScaffold(s.id)} className={`min-h-[40px] rounded-xl border px-3 text-[12.5px] font-bold ${FOCUS} ${scaffold === s.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{scaffold === s.id ? "✓ " : ""}{t(`hubtoolsb.${s.key}`)}</button>)}</div>
              <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={oneAtATime} onChange={(e) => setOneAtATime(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsb.sc_fc_oneAtATime")}</label>
            </div>
            <Steps key={`${q.seed}-${scaffold}-${oneAtATime}`} worked={qWorked} scaffold={scaffold} oneAtATime={oneAtATime} />
          </div>}
        </div>
      )}
    </div>
  );
}
