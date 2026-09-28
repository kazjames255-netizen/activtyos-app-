"use client";

import { useMemo, useState } from "react";
import { FOCUS } from "../../../kit";
import { useBareTool } from "../../bareContext";
import { newSeed } from "../../engine/rng";
import { fullMarks } from "../../engine/marking";
import type { AccentMode } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { TextAnswer, type Lang } from "../AccentBar";
import { useT } from "@/lib/i18n/provider";
import { columnLabel, iso, langName, noteOf, noteText, rich, tableTitle, type T, lk } from "../langText";
import { buildFromPicks, checkSentence, diagnoseOrderMsgs, generateSentences, jumble, tableById, tablesFor, type SentenceItem, type SentenceTable } from "./sentences";

// Sentence builder (plan L-04): tap chunks from a substitution table, put a jumbled sentence in order (tap or drag), or translate from English.

type Mode = "build" | "jumble" | "translate";
const LANGS: Lang[] = ["fr", "es", "de"];
const MODES: { id: Mode; key: string }[] = [{ id: "build", key: "lang_modeBuild" }, { id: "jumble", key: "lang_modeJumble" }, { id: "translate", key: "lang_modeTranslate" }];
const POLICIES: AccentMode[] = ["strict", "warn", "lenient"];
const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
const btn = `min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`;
const btnPrimary = `min-h-[44px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-5 text-[14px] font-extrabold text-white disabled:opacity-40 ${FOCUS}`;

interface Verdict { ok: boolean; note?: string; order: { k: string; v: Record<string, string> }[] }
function mark(item: SentenceItem, answer: string, accents: AccentMode, lang: Lang): Verdict {
  const r = checkSentence(answer, item.accepted, { accents, lang });
  const note = noteOf(r);
  const ok = fullMarks(r);
  return { ok, note, order: !ok && item.order ? diagnoseOrderMsgs(answer, item.order) : [] };
}
const answerList = (t: T, item: SentenceItem) => item.accepted.map(iso).join(`  ${t("hubtoolsb.lang_or")}  `);
const hintText = (t: T, item: SentenceItem) => (item.hk ? t(lk(`hint_${item.hk.k}`), item.hk.v) : item.hint);
function Feedback({ v, item, reveal }: { v: Verdict; item: SentenceItem; reveal: boolean }) {
  const t = useT();
  const note = noteText(t, v.note);
  return (
    <div role="status" className="grid gap-1 text-[14px] font-bold text-[var(--ink)]">
      <span>{v.ok ? t("hubtoolsb.lang_correct") : t("hubtoolsb.lang_notQuite")}{note ? ` — ${note}` : ""}</span>
      {v.order.map((m, i) => <span key={i} className="text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.lang_wordOrder", { x: t(lk(`ord_${m.k}`), Object.fromEntries(Object.entries(m.v).map(([k, x]) => [k, iso(x)]))) })}</span>)}
      {!v.ok && reveal && <span className="text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.lang_answerPlain", { x: answerList(t, item) })}</span>}
    </div>
  );
}

function BuildPane({ table, seed, onRandom }: { table: SentenceTable; seed: number; onRandom: () => void }) {
  const t = useT();
  const bare = useBareTool();
  const [picks, setPicks] = useState<number[]>(() => table.columns.map(() => 0));
  const built = buildFromPicks(table, picks);
  const random = () => { const it = generateSentences(table, seed, 1)[0]; if (it) setPicks(it.picks); onRandom(); };
  return (
    <section aria-label={t("hubtoolsb.lang_buildAria")} className="grid gap-3">
      <div className="grid gap-2">
        {table.columns.map((col, ci) => (
          <div key={ci} role="group" aria-label={columnLabel(t, col.label)} className="grid gap-1">
            <span data-tool-chrome className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{columnLabel(t, col.label)}</span>
            <div className="flex flex-wrap gap-1.5">
              {col.options.map((o, oi) => { const on = picks[ci] === oi; return <button key={oi} type="button" aria-pressed={on} onClick={() => setPicks((p) => p.map((x, i) => (i === ci ? oi : x)))} className={`min-h-[44px] rounded-xl border px-3 text-start text-[15px] font-bold ${FOCUS} ${on ? "border-2 border-[var(--brand)] bg-[var(--panel)] text-[var(--ink)] underline decoration-2 underline-offset-4" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{on ? "● " : ""}{o.t}</button>; })}
            </div>
          </div>
        ))}
      </div>
      <div className={bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"} aria-live="polite">
        <p className="m-0 text-[19px] font-extrabold text-[var(--ink)]">{built.target}</p>
        <p className="m-0 mt-1 text-[13.5px] font-semibold text-[var(--ink-2)]">{built.en}</p>
      </div>
      <div><button type="button" onClick={random} className={btn}>{t("hubtoolsb.lang_surprise")}</button></div>
    </section>
  );
}

function JumblePane({ item, seed, lang, accents, assess, onDone }: { item: SentenceItem; seed: number; lang: Lang; accents: AccentMode; assess: boolean; onDone: (ok: boolean) => void }) {
  const t = useT();
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
    <section aria-label={t("hubtoolsb.lang_modeJumble")} className="grid gap-3">
      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{item.en}</p>
      {item.hint && !assess && <p data-tool-chrome className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.lang_hintLbl", { x: hintText(t, item) ?? "" })}</p>}
      <div aria-label={t("hubtoolsb.lang_yourSentenceAria")} className="flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--panel)] p-2">
        {placed.length === 0 && <span data-tool-chrome className="p-2 text-[13px] font-semibold text-[var(--ink-3)]">{t("hubtoolsb.lang_tapWords")}</span>}
        {placed.map((id, i) => (
          <button key={id} type="button" draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} onClick={() => take(id)} aria-label={t("hubtoolsb.lang_wordAria", { w: words[id]!.w, n: i + 1 })} className={tile}>{words[id]!.w}</button>
        ))}
      </div>
      <div role="group" aria-label={t("hubtoolsb.lang_wordBank")} className="flex flex-wrap gap-1.5" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) take(placed[drag]!); setDrag(null); }}>
        {bank.map((x) => <button key={x.id} type="button" onClick={() => put(x.id)} className={tile}>{x.w}</button>)}
        {bank.length === 0 && <span className="text-[13px] font-semibold text-[var(--ink-3)]">{t("hubtoolsb.lang_allUsed")}</span>}
      </div>
      <div data-tool-strip className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={placed.length === 0 || handed} className={btnPrimary}>{assess ? t("hubtoolsb.lang_handIn") : t("hubtoolsb.lang_check")}</button>
        <button type="button" onClick={() => { setPlaced([]); setV(null); }} disabled={handed} className={btn}>{t("hubtoolsb.lang_clear")}</button>
      </div>
      {v && !assess && <Feedback v={v} item={item} reveal />}
      {handed && <p data-tool-chrome role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">{t("hubtoolsb.lang_handedOne")}</p>}
    </section>
  );
}

function TranslatePane({ item, lang, accents, assess, onDone }: { item: SentenceItem; lang: Lang; accents: AccentMode; assess: boolean; onDone: (ok: boolean) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [v, setV] = useState<Verdict | null>(null);
  const [shown, setShown] = useState(false);
  const [handed, setHanded] = useState(false);
  const check = () => { const r = mark(item, text, accents, lang); if (assess) { setHanded(true); onDone(r.ok); return; } setV(r); onDone(r.ok); };
  return (
    <section aria-label={t("hubtoolsb.lang_modeTranslate")} className="grid gap-3">
      <p className="m-0 text-[17px] font-extrabold text-[var(--ink)]">{item.en}</p>
      {item.hint && !assess && <p data-tool-chrome className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.lang_hintLbl", { x: hintText(t, item) ?? "" })}</p>}
      <TextAnswer lang={lang} value={text} onChange={(x) => { if (!handed) { setText(x); setV(null); } }} multiline ariaLabel={t("hubtoolsb.lang_yourSentence", { lang: langName(t, lang) })} placeholder={t("hubtoolsb.lang_typeSentence")} />
      <div data-tool-strip className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={!text.trim() || handed} className={btnPrimary}>{assess ? t("hubtoolsb.lang_handIn") : t("hubtoolsb.lang_check")}</button>
        {!assess && <button data-tool-chrome type="button" onClick={() => setShown(true)} className={btn}>{t("hubtoolsb.lang_showMe")}</button>}
      </div>
      {v && !assess && <Feedback v={v} item={item} reveal />}
      {shown && !assess && !v && <p data-tool-chrome role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.lang_answerPlain", { x: answerList(t, item) })}</p>}
      {handed && <p data-tool-chrome role="status" className="m-0 text-[14px] font-extrabold text-[var(--ink)]">{t("hubtoolsb.lang_handedOne")}</p>}
    </section>
  );
}

export default function SentenceBuilder({ mode = "practise", params }: Partial<ToolProps>) {
  const t = useT();
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
      <div data-tool-chrome role="group" aria-label={t("hubtoolsb.lang_language")} className="flex flex-wrap gap-1.5">{LANGS.map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)} className={chip(lang === l)}>{langName(t, l)}</button>)}</div>
      <label data-tool-chrome className="grid gap-1 text-[13px] font-extrabold text-[var(--ink-2)]">{t("hubtoolsb.lang_topic")}
        <select value={table.id} onChange={(e) => { setTableId(e.target.value); setSeed(newSeed()); }} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[15px] font-semibold text-[var(--ink)] ${FOCUS}`}>{tables.map((x) => <option key={x.id} value={x.id}>{tableTitle(t, x.title)}</option>)}</select></label>
      <div data-tool-chrome role="group" aria-label={t("hubtoolsb.lang_activity")} className="flex flex-wrap gap-1.5">{MODES.map((m) => <button key={m.id} type="button" disabled={isOrder && m.id === "build"} aria-pressed={effMode === m.id} onClick={() => setQmode(m.id)} className={`${chip(effMode === m.id)} disabled:opacity-40`}>{t(`hubtoolsb.${m.key}`)}</button>)}</div>
      {effMode !== "build" && (
        <div data-tool-chrome role="group" aria-label={t("hubtoolsb.lang_accentMarking")} className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-extrabold text-[var(--ink-2)]">{t("hubtoolsb.lang_accentsColon")}</span>{POLICIES.map((p) => <button key={p} type="button" aria-pressed={accents === p} onClick={() => setAccents(p)} className={chip(accents === p)}>{t(lk(`pol_${p}`))}</button>)}</div>
      )}
      {isOrder && <p data-tool-chrome className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12.5px] font-semibold text-[var(--ink-2)]">{rich(t("hubtoolsb.lang_deRules"))}</p>}
      {effMode === "build" ? <BuildPane key={table.id} table={table} seed={seed} onRandom={() => setSeed(newSeed())} />
        : effMode === "jumble" ? <JumblePane key={`${table.id}-${seed}-j`} item={item} seed={seed} lang={lang} accents={accents} assess={assess} onDone={done} />
        : <TranslatePane key={`${table.id}-${seed}-t`} item={item} lang={lang} accents={accents} assess={assess} onDone={done} />}
      {effMode !== "build" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSeed(newSeed())} className={btn}>{t("hubtoolsb.lang_nextSentence")}</button>
          {!assess && score.total > 0 && <span data-tool-chrome className="text-[13px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.lang_score", { right: score.right, total: score.total })}</span>}
        </div>
      )}
    </div>
  );
}
