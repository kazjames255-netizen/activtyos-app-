"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FOCUS } from "../../../kit";
import { newSeed, makeRng } from "../../engine/rng";
import { fullMarks } from "../../engine/marking";
import { applyShortcut, checkText, type AccentMode } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { AccentBar, LANG_LABEL, TextAnswer, type Lang } from "../AccentBar";
import { PERSONS, TENSES, THEMES, VERBS, answerVariants, conjugate, supports, verbInfo } from "./conjugate";

// Verb conjugation trainer (plan L-03): fill a whole table, or answer one form at a time. Cheat sheet, accent policy and a timer are all choices the
// pupil makes; assess mode removes the cheat sheet, the "Show me" button and every hint.

type SetKind = "all" | "regular" | "irregular" | "theme";
type Mode = "table" | "single";
type Cell = { attempted: boolean; ok: boolean; note?: string };
const LANGS: Lang[] = ["fr", "es", "de"];
const SETS: { id: SetKind; label: string }[] = [{ id: "all", label: "All verbs" }, { id: "regular", label: "Regular" }, { id: "irregular", label: "Irregular" }, { id: "theme", label: "By theme" }];
const POLICIES: { id: AccentMode; label: string; hint: string }[] = [
  { id: "strict", label: "Strict", hint: "A wrong or missing accent is wrong." },
  { id: "warn", label: "Warn", hint: "Accepted, but flagged — no mark lost." },
  { id: "lenient", label: "Lenient", hint: "Accepted quietly, unless the accent changes the word." },
];
const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
const btn = `min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`;
const btnPrimary = `min-h-[44px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-5 text-[14px] font-extrabold text-white disabled:opacity-40 ${FOCUS}`;

/** Marks one typed form against every accepted alternative (with or without the pronoun). */
function markForm(lang: Lang, person: number, answer: string, forms: string[], accents: AccentMode): Cell {
  if (!answer.trim()) return { attempted: false, ok: false };
  const r = checkText(answer, answerVariants(lang, person, forms), { accents, lang, ignorePunctuation: true });
  const note = (r.log as { parts?: { note?: string }[] }).parts?.[0]?.note;
  return { attempted: true, ok: fullMarks(r), note };
}

/** Split a form of a MODEL verb into stem + ending so the ending can be shown in bold + underline (a shape cue, not only a colour). */
function splitEnding(form: string, inf: string): [string, string] {
  if (form.includes(" ")) { const i = form.indexOf(" "); return [form.slice(0, i), form.slice(i)]; }
  const stem = form.startsWith(inf) ? inf : inf.slice(0, -2);
  return form.startsWith(stem) ? [stem, form.slice(stem.length)] : ["", form];
}
const MODELS: Record<Lang, Record<string, string>> = { fr: { er: "parler", ir: "finir", re: "vendre" }, es: { ar: "hablar", er: "comer", ir: "vivir" }, de: { en: "spielen" } };
function modelFor(lang: Lang, verb: string): string {
  const inf = verb.replace(/^(se |s')/, "").replace(/(ar|er|ir|ír)se$/, "$1");
  const t = lang === "de" ? "en" : inf.slice(-2).replace("ír", "ir");
  return MODELS[lang][t] ?? Object.values(MODELS[lang])[0]!;
}

function useElapsed(on: boolean, resetKey: unknown) {
  const [s, setS] = useState(0);
  useEffect(() => { setS(0); if (!on) return; const t = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(t); }, [on, resetKey]);
  return s;
}

export default function VerbTrainer({ mode = "practise", params }: Partial<ToolProps>) {
  const assess = mode === "assess";
  const p0 = params?.lang, v0 = typeof params?.verb === "string" ? params.verb : "";
  const [lang, setLang] = useState<Lang>(p0 === "es" || p0 === "de" || p0 === "fr" ? p0 : "fr");
  const [tenses, setTenses] = useState<string[]>(["present"]);
  const [setKind, setSetKind] = useState<SetKind>("all");
  const [theme, setTheme] = useState<string>("");
  const [pinned, setPinned] = useState<string>(v0);
  const [qmode, setQmode] = useState<Mode>("table");
  const [accents, setAccents] = useState<AccentMode>("warn");
  const [cheat, setCheat] = useState(false);
  const [timer, setTimer] = useState(false);
  const [seed, setSeed] = useState(1);

  const pool = useMemo(() => {
    const t = theme || THEMES[lang][0]!;
    return VERBS[lang].filter((v) => (setKind === "regular" ? v.kind === "regular" : setKind === "irregular" ? v.kind !== "regular" : setKind === "theme" ? v.theme === t : true) && tenses.some((x) => supports(lang, v.inf, x)));
  }, [lang, setKind, theme, tenses]);
  const pinnedOk = pinned && verbInfo(lang, pinned) && tenses.some((x) => supports(lang, pinned, x));
  const q = useMemo(() => {
    const rng = makeRng(seed * 7919 + 13);
    const verb = pinnedOk ? pinned : pool.length ? rng.pick(pool).inf : "";
    const ok = tenses.filter((x) => verb && supports(lang, verb, x));
    return { verb, tense: ok.length ? rng.pick(ok) : tenses[0]!, person: rng.int(0, 5) };
  }, [seed, pool, pinned, pinnedOk, tenses, lang]);

  const [answers, setAnswers] = useState<string[]>(["", "", "", "", "", ""]);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [shown, setShown] = useState(false);
  const [handed, setHanded] = useState(false);
  const [one, setOne] = useState("");
  const [oneRes, setOneRes] = useState<Cell | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const elapsed = useElapsed(timer, `${seed}|${qmode}`);
  useEffect(() => { setAnswers(["", "", "", "", "", ""]); setCells(null); setShown(false); setHanded(false); setOne(""); setOneRes(null); }, [seed, lang, tenses, setKind, theme, pinned]);

  const forms = (p: number) => conjugate(lang, q.verb, q.tense, p);
  const info = verbInfo(lang, q.verb);
  const tenseLabel = TENSES[lang].find((t) => t.id === q.tense)?.label ?? q.tense;
  const next = () => setSeed(newSeed());
  const toggleTense = (id: string) => setTenses((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]));
  const switchLang = (l: Lang) => { setLang(l); setTenses(["present"]); setTheme(""); setPinned(""); setSeed(newSeed()); };

  const checkTable = () => {
    if (assess) { setHanded(true); return; }
    setCells(answers.map((a, p) => markForm(lang, p, a, forms(p), accents)));
  };
  const checkOne = () => {
    const c = markForm(lang, q.person, one, forms(q.person), accents);
    setOneRes(c);
    if (c.attempted) setScore((s) => ({ right: s.right + (c.ok ? 1 : 0), total: s.total + 1 }));
  };
  const insertAt = (ch: string) => {
    const el = refs.current[active], cur = answers[active] ?? "";
    const a = el?.selectionStart ?? cur.length, b = el?.selectionEnd ?? cur.length;
    setAnswers((xs) => xs.map((x, i) => (i === active ? cur.slice(0, a) + ch + cur.slice(b) : x)));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + ch.length, a + ch.length); });
  };
  const typed = (i: number, v: string) => setAnswers((xs) => xs.map((x, k) => (k === i ? (v.length > x.length ? applyShortcut(v) ?? v : v) : x)));

  const model = modelFor(lang, q.verb);
  const cheatTense = supports(lang, model, q.tense) ? q.tense : "present";
  const Cheat = () => (
    <div role="region" aria-label="Cheat sheet" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <p className="m-0 mb-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cheat sheet — pattern of <b>{model}</b> ({TENSES[lang].find((t) => t.id === cheatTense)?.label}). Endings are <b className="underline decoration-2 underline-offset-2">bold + underlined</b>.{info && info.kind !== "regular" ? " This verb is not regular — its forms differ from the pattern, so learn them." : ""}</p>
      <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-0.5 text-[15px] font-semibold text-[var(--ink)]">
        {[0, 1, 2, 3, 4, 5].map((p) => { const f = conjugate(lang, model, cheatTense, p)[0] ?? "", [st, en] = splitEnding(f, model); return (
          <div key={p} className="contents"><span className="text-[var(--ink-3)]">{PERSONS[lang][p]}</span><span>{st}<b className="text-[var(--brand)] underline decoration-2 underline-offset-2">{en}</b></span></div>
        ); })}
      </div>
    </div>
  );
  const ChipRow = ({ children, label }: { children: React.ReactNode; label: string }) => <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">{children}</div>;
  const themeVal = theme || THEMES[lang][0]!;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const noVerb = !q.verb;

  return (
    <div className="grid gap-3" data-testid="verb-trainer">
      <ChipRow label="Language">{LANGS.map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)} className={chip(lang === l)}>{LANG_LABEL[l]}</button>)}</ChipRow>
      <ChipRow label="Tenses">{TENSES[lang].map((t) => <button key={t.id} type="button" aria-pressed={tenses.includes(t.id)} onClick={() => toggleTense(t.id)} className={chip(tenses.includes(t.id))}>{tenses.includes(t.id) ? "✓ " : ""}{t.label}</button>)}</ChipRow>
      <ChipRow label="Verb set">{SETS.map((s) => <button key={s.id} type="button" aria-pressed={setKind === s.id} onClick={() => { setSetKind(s.id); setPinned(""); }} className={chip(setKind === s.id)}>{s.label}</button>)}</ChipRow>
      <div className="flex flex-wrap items-center gap-2">
        {setKind === "theme" && <label className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]">Theme
          <select value={themeVal} onChange={(e) => { setTheme(e.target.value); setPinned(""); }} className={`min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>{THEMES[lang].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
        <label className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]">Verb
          <select value={pinnedOk ? pinned : ""} onChange={(e) => setPinned(e.target.value)} className={`min-h-[40px] max-w-[170px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            <option value="">Any in the set</option>{pool.map((v) => <option key={v.inf} value={v.inf}>{v.inf}</option>)}</select></label>
      </div>
      <ChipRow label="Mode">
        <button type="button" aria-pressed={qmode === "table"} onClick={() => setQmode("table")} className={chip(qmode === "table")}>Fill the table</button>
        <button type="button" aria-pressed={qmode === "single"} onClick={() => setQmode("single")} className={chip(qmode === "single")}>One form</button>
      </ChipRow>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {!assess && <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]"><input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />Cheat sheet</label>}
        <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]"><input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />Timer (optional)</label>
        {timer && <span role="timer" aria-label="Time on this question" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[13px] font-extrabold tabular-nums text-[var(--ink)]">⏱ {mm}</span>}
      </div>
      <div role="group" aria-label="Accent marking" className="grid gap-1">
        <div className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-extrabold text-[var(--ink-2)]">Accents:</span>{POLICIES.map((p) => <button key={p.id} type="button" aria-pressed={accents === p.id} onClick={() => setAccents(p.id)} className={chip(accents === p.id)}>{p.label}</button>)}</div>
        <p className="m-0 text-[12px] font-semibold text-[var(--ink-3)]">{POLICIES.find((p) => p.id === accents)!.hint} Accents that change the meaning are never let through.</p>
      </div>

      {noVerb ? <p role="status" className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[14px] font-semibold text-[var(--ink-2)]">No verbs match those choices — try another tense or verb set.</p> : (
        <>
          {cheat && !assess && <Cheat />}
          {qmode === "table" ? (
            <section aria-label="Conjugation table" className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <h3 className="m-0 text-[16px] font-extrabold text-[var(--ink)]">{q.verb} <span className="font-semibold text-[var(--ink-2)]">— {tenseLabel}</span>{info && <span className="ml-1 text-[12.5px] font-semibold text-[var(--ink-3)]">({info.en})</span>}</h3>
              <div className="grid grid-cols-[84px_1fr] items-start gap-x-2 gap-y-2">
                {[0, 1, 2, 3, 4, 5].map((p) => { const c = cells?.[p]; return (
                  <div key={p} className="contents">
                    <label htmlFor={`vt-${p}`} className="pt-3 text-[15px] font-bold text-[var(--ink-2)]">{PERSONS[lang][p]}</label>
                    <div className="grid gap-0.5">
                      <input id={`vt-${p}`} ref={(el) => { refs.current[p] = el; }} value={answers[p]} lang={lang} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" disabled={handed}
                        onFocus={() => setActive(p)} onChange={(e) => { setCells(null); typed(p, e.target.value); }} aria-invalid={c?.attempted && !c.ok ? true : undefined}
                        className={`w-full rounded-xl border bg-[var(--surface)] px-3 text-[16px] font-semibold text-[var(--ink)] ${FOCUS} ${c?.attempted ? (c.ok ? "border-2 border-[var(--ink)]" : "border-2 border-dashed border-[var(--ink)]") : "border-[var(--line)]"}`} style={{ minHeight: 44 }} />
                      {c?.attempted && <span role="status" className="text-[12.5px] font-bold text-[var(--ink)]">{c.ok ? "✓ Correct" : `✗ Not quite — answer: ${forms(p).join(" / ")}`}{c.note ? ` (${c.note})` : ""}</span>}
                      {cells && !c?.attempted && !shown && <span className="text-[12.5px] font-semibold text-[var(--ink-3)]">— not answered</span>}
                      {shown && !c?.attempted && <span className="text-[12.5px] font-bold text-[var(--ink-2)]">Answer: {forms(p).join(" / ")}</span>}
                    </div>
                  </div>
                ); })}
              </div>
              <AccentBar lang={lang} onInsert={insertAt} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={checkTable} disabled={handed || answers.every((a) => !a.trim())} className={btnPrimary}>{assess ? "Hand in" : "Check"}</button>
                {!assess && <button type="button" onClick={() => setShown(true)} className={btn}>Show me</button>}
                <button type="button" onClick={next} className={btn}>{assess ? "Next table" : "New table"}</button>
              </div>
              {cells && !assess && <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">{cells.filter((c) => c.ok).length} / {cells.filter((c) => c.attempted).length || 0} correct{cells.some((c) => !c.attempted) ? " (blank boxes are not counted)" : ""}</p>}
              {handed && <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">Handed in — your answers are saved.</p>}
            </section>
          ) : (
            <section aria-label="One form" className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="m-0 text-[20px] font-extrabold text-[var(--ink)]">{PERSONS[lang][q.person]} <span className="text-[var(--ink-3)]">/</span> {q.verb} <span className="text-[var(--ink-3)]">/</span> {tenseLabel} <span className="text-[var(--brand)]">→ ?</span></p>
              {info && <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-3)]">{info.en} · {info.kind === "regular" ? "regular" : info.kind === "stem" ? "stem-changing" : "irregular"} · {info.tier}</p>}
              <TextAnswer lang={lang} value={one} onChange={(v) => { setOne(v); setOneRes(null); }} ariaLabel={`${PERSONS[lang][q.person]} form of ${q.verb}`} placeholder="Type the form" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={checkOne} disabled={!one.trim() || (assess && oneRes !== null)} className={btnPrimary}>{assess ? "Submit" : "Check"}</button>
                {!assess && <button type="button" onClick={() => setShown(true)} className={btn}>Show me</button>}
                <button type="button" onClick={next} className={btn}>Next</button>
              </div>
              {oneRes && (assess ? <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">Saved. Press Next.</p> : <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">{oneRes.ok ? "✓ Correct" : `✗ Not quite — answer: ${forms(q.person).join(" / ")}`}{oneRes.note ? ` (${oneRes.note})` : ""}</p>)}
              {shown && !assess && <p role="status" className="m-0 text-[14px] font-bold text-[var(--ink-2)]">Answer: {forms(q.person).join(" / ")}</p>}
              {!assess && score.total > 0 && <p className="m-0 text-[13px] font-bold text-[var(--ink-2)]">Score: {score.right} / {score.total}</p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
