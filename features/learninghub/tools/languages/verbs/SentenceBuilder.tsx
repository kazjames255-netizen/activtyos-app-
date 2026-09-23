"use client";

import { useMemo, useState } from "react";
import { FOCUS } from "../../../kit";
import { newSeed } from "../../engine/rng";
import { fullMarks } from "../../engine/marking";
import type { AccentMode } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { LANG_LABEL, TextAnswer, type Lang } from "../AccentBar";
import { buildFromPicks, checkSentence, diagnoseOrder, generateSentences, jumble, tableById, tablesFor, type SentenceItem, type SentenceTable } from "./sentences";

// Sentence builder (plan L-04): tap chunks from a substitution table, put a jumbled sentence in order (tap or drag), or translate from English.

type Mode = "build" | "jumble" | "translate";
const LANGS: Lang[] = ["fr", "es", "de"];
const MODES: { id: Mode; label: string }[] = [{ id: "build", label: "Build" }, { id: "jumble", label: "Word order puzzle" }, { id: "translate", label: "Translate" }];
const POLICIES: AccentMode[] = ["strict", "warn", "lenient"];
const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
const btn = `min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`;
const btnPrimary = `min-h-[44px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-5 text-[14px] font-extrabold text-white disabled:opacity-40 ${FOCUS}`;

interface Verdict { ok: boolean; note?: string; order: string[] }
function mark(item: SentenceItem, answer: string, accents: AccentMode, lang: Lang): Verdict {
  const r = checkSentence(answer, item.accepted, { accents, lang });
  const note = (r.log as { parts?: { note?: string }[] }).parts?.[0]?.note;
  const ok = fullMarks(r);
  return { ok, note, order: !ok && item.order ? diagnoseOrder(answer, item.order) : [] };
}
const Feedback = ({ v, item, reveal }: { v: Verdict; item: SentenceItem; reveal: boolean }) => (
  <div role="status" className="grid gap-1 text-[14px] font-bold text-[var(--ink)]">
    <span>{v.ok ? "✓ Correct" : "✗ Not quite"}{v.note ? ` — ${v.note}` : ""}</span>
    {v.order.map((m, i) => <span key={i} className="text-[13px] font-semibold text-[var(--ink-2)]">Word order: {m}</span>)}
    {!v.ok && reveal && <span className="text-[13px] font-semibold text-[var(--ink-2)]">Answer: {item.accepted.join("  or  ")}</span>}
  </div>
);

function BuildPane({ table, seed, onRandom }: { table: SentenceTable; seed: number; onRandom: () => void }) {
  const [picks, setPicks] = useState<number[]>(() => table.columns.map(() => 0));
  const built = buildFromPicks(table, picks);
  const random = () => { const it = generateSentences(table, seed, 1)[0]; if (it) setPicks(it.picks); onRandom(); };
  return (
    <section aria-label="Build a sentence" className="grid gap-3">
      <div className="grid gap-2">
        {table.columns.map((col, ci) => (
          <div key={ci} role="group" aria-label={col.label} className="grid gap-1">
            <span className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{col.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {col.options.map((o, oi) => { const on = picks[ci] === oi; return <button key={oi} type="button" aria-pressed={on} onClick={() => setPicks((p) => p.map((x, i) => (i === ci ? oi : x)))} className={`min-h-[44px] rounded-xl border px-3 text-left text-[15px] font-bold ${FOCUS} ${on ? "border-2 border-[var(--brand)] bg-[var(--panel)] text-[var(--ink)] underline decoration-2 underline-offset-4" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{on ? "● " : ""}{o.t}</button>; })}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3" aria-live="polite">
        <p className="m-0 text-[19px] font-extrabold text-[var(--ink)]">{built.target}</p>
        <p className="m-0 mt-1 text-[13.5px] font-semibold text-[var(--ink-2)]">{built.en}</p>
      </div>
      <div><button type="button" onClick={random} className={btn}>Surprise me</button></div>
    </section>
  );
}

function JumblePane({ item, seed, lang, accents, assess, onDone }: { item: SentenceItem; seed: number; lang: Lang; accents: AccentMode; assess: boolean; onDone: (ok: boolean) => void }) {
  const words = useMemo(() => jumble(item.target, seed).map((w, id) => ({ id, w })), [item, seed]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [v, setV] = useState<Verdict | null>(null);
  const [handed, setHanded] = useState(false);
  const bank = words.filter((x) => !placed.includes(x.id));
  const sentence = placed.map((id) => words[id]!.w).join(" ");
  const put = (id: number) => { if (handed) return; setV(null); setPlaced((p) => [...p, id]); };
  const take = (id: number) => { if (handed) return; setV(null); setPlaced((p) => p.filter((x) => x !== id)); };
  const move = (from: number, to: number) => setPlaced((p) => { const a = [...p], [x] = a.splice(from, 1); a.splice(to, 0, x!); return a; });
  const check = () => { if (assess) { setHanded(true); onDone(mark(item, sentence, accents, lang).ok); return; } const r = mark(item, sentence, accents, lang); setV(r); onDone(r.ok); };
  const tile = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px] font-bold text-[var(--ink)] shadow-[var(--shadow-sm)] ${FOCUS}`;
  return (
    <section aria-label="Word order puzzle" className="grid gap-3">
      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{item.en}</p>
      {item.hint && !assess && <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Hint: {item.hint}</p>}
      <div aria-label="Your sentence" className="flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--panel)] p-2">
        {placed.length === 0 && <span className="p-2 text-[13px] font-semibold text-[var(--ink-3)]">Tap the words below in order (or drag them here).</span>}
        {placed.map((id, i) => (
          <button key={id} type="button" draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} onClick={() => take(id)} aria-label={`${words[id]!.w}, word ${i + 1}. Tap to put back`} className={tile}>{words[id]!.w}</button>
        ))}
      </div>
      <div role="group" aria-label="Word bank" className="flex flex-wrap gap-1.5" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) take(placed[drag]!); setDrag(null); }}>
        {bank.map((x) => <button key={x.id} type="button" onClick={() => put(x.id)} className={tile}>{x.w}</button>)}
        {bank.length === 0 && <span className="text-[13px] font-semibold text-[var(--ink-3)]">All words used.</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={placed.length === 0 || handed} className={btnPrimary}>{assess ? "Hand in" : "Check"}</button>
        <button type="button" onClick={() => { setPlaced([]); setV(null); }} disabled={handed} className={btn}>Clear</button>
      </div>
      {v && !assess && <Feedback v={v} item={item} reveal />}
      {handed && <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">Handed in — your answer is saved.</p>}
    </section>
  );
}

function TranslatePane({ item, lang, accents, assess, onDone }: { item: SentenceItem; lang: Lang; accents: AccentMode; assess: boolean; onDone: (ok: boolean) => void }) {
  const [text, setText] = useState("");
  const [v, setV] = useState<Verdict | null>(null);
  const [shown, setShown] = useState(false);
  const [handed, setHanded] = useState(false);
  const check = () => { const r = mark(item, text, accents, lang); if (assess) { setHanded(true); onDone(r.ok); return; } setV(r); onDone(r.ok); };
  return (
    <section aria-label="Translate" className="grid gap-3">
      <p className="m-0 text-[17px] font-extrabold text-[var(--ink)]">{item.en}</p>
      {item.hint && !assess && <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Hint: {item.hint}</p>}
      <TextAnswer lang={lang} value={text} onChange={(t) => { if (!handed) { setText(t); setV(null); } }} multiline ariaLabel={`Your ${LANG_LABEL[lang]} sentence`} placeholder="Type the sentence" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={!text.trim() || handed} className={btnPrimary}>{assess ? "Hand in" : "Check"}</button>
        {!assess && <button type="button" onClick={() => setShown(true)} className={btn}>Show me</button>}
      </div>
      {v && !assess && <Feedback v={v} item={item} reveal />}
      {shown && !assess && !v && <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">Answer: {item.accepted.join("  or  ")}</p>}
      {handed && <p role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">Handed in — your answer is saved.</p>}
    </section>
  );
}

export default function SentenceBuilder({ mode = "practise", params }: Partial<ToolProps>) {
  const assess = mode === "assess";
  const p0 = params?.lang;
  const [lang, setLang] = useState<Lang>(p0 === "es" || p0 === "de" || p0 === "fr" ? p0 : "fr");
  const [tableId, setTableId] = useState<string>(() => tablesFor(p0 === "es" || p0 === "de" ? p0 : "fr")[0]!.id);
  const [qmode, setQmode] = useState<Mode>("build");
  const [accents, setAccents] = useState<AccentMode>("warn");
  const [seed, setSeed] = useState(1);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const tables = tablesFor(lang);
  const table = tableById(tableId) && tableById(tableId)!.lang === lang ? tableById(tableId)! : tables[0]!;
  const isOrder = table.mode === "order";
  const effMode: Mode = isOrder && qmode === "build" ? "jumble" : qmode;
  const item = useMemo(() => generateSentences(table, seed * 104729 + 7, 1)[0]!, [table, seed]);
  const switchLang = (l: Lang) => { setLang(l); setTableId(tablesFor(l)[0]!.id); setSeed(newSeed()); };
  const done = (ok: boolean) => setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));

  return (
    <div className="grid gap-3" data-testid="sentence-builder">
      <div role="group" aria-label="Language" className="flex flex-wrap gap-1.5">{LANGS.map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)} className={chip(lang === l)}>{LANG_LABEL[l]}</button>)}</div>
      <label className="grid gap-1 text-[13px] font-extrabold text-[var(--ink-2)]">Topic
        <select value={table.id} onChange={(e) => { setTableId(e.target.value); setSeed(newSeed()); }} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[15px] font-semibold text-[var(--ink)] ${FOCUS}`}>{tables.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <div role="group" aria-label="Activity" className="flex flex-wrap gap-1.5">{MODES.map((m) => <button key={m.id} type="button" disabled={isOrder && m.id === "build"} aria-pressed={effMode === m.id} onClick={() => setQmode(m.id)} className={`${chip(effMode === m.id)} disabled:opacity-40`}>{m.label}</button>)}</div>
      {effMode !== "build" && (
        <div role="group" aria-label="Accent marking" className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-extrabold text-[var(--ink-2)]">Accents:</span>{POLICIES.map((p) => <button key={p} type="button" aria-pressed={accents === p} onClick={() => setAccents(p)} className={chip(accents === p)}>{p[0]!.toUpperCase() + p.slice(1)}</button>)}</div>
      )}
      {isOrder && <p className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12.5px] font-semibold text-[var(--ink-2)]">German rules: the verb is the <b>2nd idea</b> in a main clause · after a time phrase the subject moves behind the verb · after <b>weil / dass / wenn / obwohl</b> the verb goes to the <b>end</b>.</p>}
      {effMode === "build" ? <BuildPane key={table.id} table={table} seed={seed} onRandom={() => setSeed(newSeed())} />
        : effMode === "jumble" ? <JumblePane key={`${table.id}-${seed}-j`} item={item} seed={seed} lang={lang} accents={accents} assess={assess} onDone={done} />
        : <TranslatePane key={`${table.id}-${seed}-t`} item={item} lang={lang} accents={accents} assess={assess} onDone={done} />}
      {effMode !== "build" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSeed(newSeed())} className={btn}>Next sentence</button>
          {!assess && score.total > 0 && <span className="text-[13px] font-bold text-[var(--ink-2)]">Score: {score.right} / {score.total}</span>}
        </div>
      )}
    </div>
  );
}
