"use client";

import { useMemo, useState } from "react";
import { makeRng, type Rng } from "../../engine/rng";
import { checkText } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { TextAnswer, type Lang } from "../AccentBar";
import { DE_ADJECTIVES, DE_ADJ_ENDINGS, DE_CASES, DE_DEFINITE, DE_GENDERS, DE_PREPOSITIONS, ES_ADJECTIVES, FR_ADJECTIVES, caseAfter, deAdjEnding, dePhrase, declensionAfter, esAdjective, frAdjective, prepositionPhrase, type DeCase, type DeG, type DetKind, type Declension } from "./agreement";
import { NOUNS, article, plural, type Noun } from "./nouns";
import { useT } from "@/lib/i18n/provider";
import { caseName, caseLc, deGender, genderWord, iso, noteText, noteOf, rich, caseShort, lk } from "../langText";
import { AccentPick, ASSESS_SAVED, Card, Seg, Shell, Tally, Verdict, actionCls, pillCls, policyFor, useSeed, type AccentSetting } from "./shared";

// Agreement trainer. Section "agree" (plan L-12): Spanish/French adjective agreement + German adjective endings. Section "cases" (plan L-11): German prepositions → case, and the article table.
// Assess mode: no reveal, no forms row, no endings/article tables, no per-question feedback.

type Section = "agree" | "cases";
type Topic = "es" | "fr" | "de";
const TOPICS: Topic[] = ["es", "fr", "de"];

// ───────── question makers ─────────
interface AdjQ { lang: "es" | "fr"; adj: string; en: string; noun: Noun; num: "sg" | "pl"; before: boolean; kind: "definite" | "indefinite"; answer: string; forms: string[] }
function makeAdjQ(lang: "es" | "fr", rng: Rng): AdjQ {
  const adj = rng.pick(lang === "es" ? ES_ADJECTIVES : FR_ADJECTIVES);
  const noun = rng.pick(NOUNS[lang].filter((n) => n.theme !== "family" || true));
  const num = rng.next() < 0.5 ? "sg" : "pl", before = adj.pos === "before", kind = rng.next() < 0.5 ? "definite" : "indefinite";
  const g = noun.gender === "f" ? "f" : "m";
  const vowel = /^[aeiouyhàâæéèêëîïôœùûü]/i.test(noun.word);
  const answer = lang === "es" ? esAdjective(adj.m, g, num, before) : frAdjective(adj.m, g, num, before && vowel);
  const forms = lang === "es" ? [esAdjective(adj.m, "m", "sg"), esAdjective(adj.m, "f", "sg"), esAdjective(adj.m, "m", "pl"), esAdjective(adj.m, "f", "pl")] : [frAdjective(adj.m, "m", "sg"), frAdjective(adj.m, "f", "sg"), frAdjective(adj.m, "m", "pl"), frAdjective(adj.m, "f", "pl")];
  return { lang, adj: adj.m, en: adj.en, noun, num, before, kind, answer, forms };
}
const nounText = (q: AdjQ) => (q.num === "pl" ? plural(q.lang, q.noun) : q.noun.word);
function AdjSentence({ q }: { q: AdjQ }) {
  const art = article(q.lang, q.noun, q.kind, q.num), sp = art.endsWith("'") ? "" : " ";
  const blank = <span className="mx-1 inline-block min-w-[64px] border-b-2 border-[var(--ink)] text-center align-baseline text-[var(--ink-3)]">?</span>;
  return <p className="m-0 text-[22px] font-extrabold" lang={q.lang}>{art}{sp}{q.before && <>{blank}{" "}</>}{nounText(q)}{!q.before && <>{" "}{blank}</>}</p>;
}
interface EndQ { adj: string; kind: DetKind; c: DeCase; g: DeG; noun: Noun; answerEnding: string; answerWord: string; det: string; shownNoun: string }
const DE_KINDS: DetKind[] = ["definite", "indefinite", "none"];
function makeEndQ(rng: Rng): EndQ {
  const adj = rng.pick(DE_ADJECTIVES), kind = rng.pick(DE_KINDS), c = rng.pick(DE_CASES), g = rng.pick(DE_GENDERS.filter((x) => !(kind === "indefinite" && x === "pl")));
  const pool = NOUNS.de.filter((n) => (g === "pl" ? true : n.gender === g));
  const noun = rng.pick(pool);
  const declension: Declension = declensionAfter(kind);
  const phrase = dePhrase({ kind, adj, noun: noun.word, plural: noun.plural, case: c, gender: g });
  const words = phrase.split(" "), shownNoun = words[words.length - 1]!;
  return { adj, kind, c, g, noun, answerEnding: deAdjEnding(declension, c, g), answerWord: words[words.length - 2]!, det: words.length === 3 ? words[0]! : "", shownNoun };
}
const ENDINGS = ["e", "en", "er", "es", "em"];
const IRREGULAR = new Set(["hoch", "teuer", "dunkel"]);

// ───────── shared bits ─────────
function EndingsTable({ d, highlight }: { d: Declension; highlight?: { c: DeCase; g: DeG } }) {
  const t = useT();
  const dl = t(lk(`decl_${d}`));
  return (
    <div className="overflow-x-auto"><table className="w-full border-collapse text-center text-[13.5px] font-bold" aria-label={t("hubtoolsb.lang_endTableAria", { d: dl })}>
      <thead><tr><th className="p-1.5 text-start" scope="col">{dl}</th>{DE_GENDERS.map((g) => <th key={g} scope="col" className="p-1.5">{deGender(t, g)}</th>)}</tr></thead>
      <tbody>{DE_CASES.map((c) => <tr key={c} className="border-t border-[var(--line)]"><th scope="row" className="p-1.5 text-start">{caseShort(t, c)}</th>{DE_GENDERS.map((g) => <td key={g} className={`p-1.5 ${highlight && highlight.c === c && highlight.g === g ? "rounded-md border-2 border-[var(--brand)] bg-[var(--brand-soft)]" : ""}`}>-{DE_ADJ_ENDINGS[d][c][g]}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
function ArticleTable() {
  const t = useT();
  return (
    <div className="overflow-x-auto"><table className="w-full border-collapse text-center text-[13.5px] font-bold" aria-label={t("hubtoolsb.lang_articleTableAria")}>
      <thead><tr><th className="p-1.5 text-start" scope="col">{t("hubtoolsb.lang_caseHdr")}</th>{DE_GENDERS.map((g) => <th key={g} scope="col" className="p-1.5">{deGender(t, g)}</th>)}</tr></thead>
      <tbody>{DE_CASES.map((c) => <tr key={c} className="border-t border-[var(--line)]"><th scope="row" className="p-1.5 text-start">{caseName(t, c)}</th>{DE_GENDERS.map((g) => <td key={g} className="p-1.5" lang="de">{DE_DEFINITE[c][g]}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

// ───────── adjective agreement (es / fr) ─────────
function AdjectivePanel({ lang, assess }: { lang: "es" | "fr"; assess: boolean }) {
  const t = useT();
  const [seed, reseed] = useSeed();
  const [n, setN] = useState(0);
  const [ans, setAns] = useState("");
  const [accents, setAccents] = useState<AccentSetting>("warn");
  const [res, setRes] = useState<{ ok: boolean; note?: string } | null>(null);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const q = useMemo(() => makeAdjQ(lang, makeRng(seed * 31 + n * 977 + 5)), [lang, seed, n]);
  const next = () => { setAns(""); setRes(null); setN(n + 1); };
  const submit = () => {
    if (res || !ans.trim()) return;
    const r = checkText(ans, [q.answer], policyFor(lang, accents, assess)), ok = r.score === r.max;
    setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 }));
    if (assess) next(); else setRes({ ok, note: noteText(t, noteOf(r)) });
  };
  const gtxt = genderWord(t, q.noun.gender === "f" ? "f" : "m");
  return (
    <>
      <AccentPick value={accents} onChange={setAccents} />
      <Card label={t("hubtoolsb.lang_question")}>
        <p data-tool-chrome className="m-0 text-[13px] font-bold text-[var(--ink-3)]">{rich(t(q.before ? "hubtoolsb.lang_adjPromptBefore" : "hubtoolsb.lang_adjPrompt", { adj: iso(q.adj), en: q.en }))}</p>
        <AdjSentence q={q} />
        <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{q.noun.en} · {gtxt} · {q.num === "sg" ? t("hubtoolsb.lang_singular") : t("hubtoolsb.lang_plural")}</p>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-2">
          <TextAnswer lang={lang} value={ans} onChange={setAns} ariaLabel={t("hubtoolsb.lang_ariaAdjEnding")} />
          <div data-tool-strip className="flex flex-wrap gap-2">
            <button type="submit" disabled={!!res || !ans.trim()} className={actionCls(true)}>{t("hubtoolsb.lang_check")}</button>
            {!assess && res && <button type="button" onClick={() => { next(); }} className={actionCls()}>{t("hubtoolsb.lang_next")}</button>}
            {assess && <button data-tool-chrome type="button" onClick={next} className={actionCls()}>{t("hubtoolsb.lang_skip")}</button>}
            {!assess && !res && <button data-tool-chrome type="button" onClick={() => { reseed(); next(); }} className={actionCls()}>{t("hubtoolsb.lang_newQuestion")}</button>}
          </div>
        </form>
        {assess && tally.total > 0 && ASSESS_SAVED}
        {!assess && res && <Verdict ok={res.ok}><span>{rich(t("hubtoolsb.lang_answerB", { x: iso(q.answer) }))}</span><span>{t("hubtoolsb.lang_allForms", { forms: iso(q.forms.join(" · ")) })}</span>{res.note && <span>{res.note}</span>}</Verdict>}
      </Card>
      <Tally right={tally.right} total={tally.total} />
    </>
  );
}

// ───────── German endings ─────────
function EndingsPanel({ assess }: { assess: boolean }) {
  const t = useT();
  const [seed, reseed] = useSeed();
  const [n, setN] = useState(0);
  const [how, setHow] = useState<"ending" | "word">("ending");
  const [ans, setAns] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [res, setRes] = useState<{ ok: boolean } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const q = useMemo(() => { let k = 0, out = makeEndQ(makeRng(seed * 17 + n * 613 + 3)); while (how === "ending" && IRREGULAR.has(out.adj) && k < 30) out = makeEndQ(makeRng(seed * 17 + n * 613 + 3 + ++k * 101)); return out; }, [seed, n, how]);
  const next = () => { setAns(""); setPicked(null); setRes(null); setN(n + 1); };
  const record = (ok: boolean) => { setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 })); if (assess) next(); else setRes({ ok }); };
  const chooseEnding = (e: string) => { if (res) return; setPicked(e); record(e === q.answerEnding); };
  const submitWord = () => { if (res || !ans.trim()) return; record(checkText(ans, [q.answerWord], policyFor("de", "strict", true)).score === 1); };
  const decl = declensionAfter(q.kind);
  const detLabel = t(q.kind === "definite" ? "hubtoolsb.lang_det_definite" : q.kind === "indefinite" ? "hubtoolsb.lang_det_indefinite" : "hubtoolsb.lang_det_none");
  return (
    <>
      <Seg label={t("hubtoolsb.lang_answerBy")} value={how} onChange={(h) => { setHow(h); reseed(); setN(0); setAns(""); setPicked(null); setRes(null); }} options={[{ id: "ending", label: t("hubtoolsb.lang_chooseEnding") }, { id: "word", label: t("hubtoolsb.lang_typeWhole") }]} />
      <Card label={t("hubtoolsb.lang_question")}>
        <p data-tool-chrome className="m-0 text-[13px] font-bold text-[var(--ink-3)]">{rich(t("hubtoolsb.lang_endPrompt", { adj: iso(q.adj), case: caseName(t, q.c), gender: deGender(t, q.g), det: detLabel }))}</p>
        <p className="m-0 text-[22px] font-extrabold" lang="de">{q.det} <span className="mx-1 inline-block min-w-[64px] border-b-2 border-[var(--ink)] text-center text-[var(--ink-3)]">{q.adj}…</span> {q.shownNoun}</p>
        {how === "ending" ? (
          <div role="group" aria-label={t("hubtoolsb.lang_endingsAria")} className="flex flex-wrap gap-2">{ENDINGS.map((e) => <button key={e} type="button" disabled={!!res} onClick={() => chooseEnding(e)} aria-pressed={picked === e} className={pillCls(picked === e)} style={{ minWidth: 56 }}>-{e}</button>)}</div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submitWord(); }} className="grid gap-2">
            <TextAnswer lang="de" value={ans} onChange={setAns} ariaLabel={t("hubtoolsb.lang_ariaAdjWithEnding")} />
            <div><button type="submit" disabled={!!res || !ans.trim()} className={actionCls(true)}>{t("hubtoolsb.lang_check")}</button></div>
          </form>
        )}
        {assess && tally.total > 0 && ASSESS_SAVED}
        {!assess && res && <Verdict ok={res.ok}><span>{rich(t("hubtoolsb.lang_answerB", { x: iso(`${q.det} ${q.answerWord} ${q.shownNoun}`) }))}</span><span>{t("hubtoolsb.lang_endExpl", { case: caseName(t, q.c), gender: deGender(t, q.g), decl: t(lk(`decl_${decl}`)), ending: q.answerEnding })}</span></Verdict>}
        {!assess && res && <div><button type="button" onClick={next} className={actionCls(true)}>{t("hubtoolsb.lang_next")}</button></div>}
        {assess && how === "word" && <div data-tool-chrome><button type="button" onClick={next} className={actionCls()}>{t("hubtoolsb.lang_skip")}</button></div>}
      </Card>
      {!assess && (
        <div data-tool-chrome className="grid gap-2">
          <button type="button" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)} className={actionCls()}>{showTable ? t("hubtoolsb.lang_hideEndTable") : t("hubtoolsb.lang_showEndTable")}</button>
          {showTable && <Card label={t("hubtoolsb.lang_endTableCard")}><EndingsTable d={decl} highlight={{ c: q.c, g: q.g }} /></Card>}
        </div>
      )}
      <Tally right={tally.right} total={tally.total} />
    </>
  );
}

// ───────── German cases (L-11) ─────────
function CasesPanel({ assess }: { assess: boolean }) {
  const t = useT();
  const [seed, reseed] = useSeed();
  const [n, setN] = useState(0);
  const [step, setStep] = useState<"case" | "phrase">("case");
  const [picked, setPicked] = useState<DeCase | null>(null);
  const [ans, setAns] = useState("");
  const [res, setRes] = useState<{ ok: boolean } | null>(null);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const [table, setTable] = useState(false);
  const q = useMemo(() => {
    const rng = makeRng(seed * 13 + n * 733 + 9), prep = rng.pick(DE_PREPOSITIONS), noun = rng.pick(NOUNS.de.filter((x) => x.theme !== "family" || x.gender !== "n" || true)), movement = rng.next() < 0.5;
    const pl = rng.next() < 0.2;
    const phrase = prepositionPhrase(prep, movement, { word: noun.word, gender: noun.gender as "m" | "f" | "n", plural: noun.plural }, pl ? "pl" : "sg", noun.gender !== "f" && !pl ? genitiveForms(noun)[0] : undefined);
    const c = caseAfter(prep, movement), extra = c === "gen" && !pl && noun.gender !== "f" ? genitiveForms(noun).slice(1).map((f) => phrase.text.slice(0, phrase.text.lastIndexOf(" ") + 1) + f) : [];
    return { prep, noun, movement, pl, phrase: { ...phrase, alternatives: [...phrase.alternatives, ...extra] }, c };
  }, [seed, n]);
  const next = () => { setAns(""); setPicked(null); setRes(null); setN(n + 1); };
  const record = (ok: boolean) => { setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 })); if (assess) next(); else setRes({ ok }); };
  const chooseCase = (c: DeCase) => { if (res) return; setPicked(c); record(c === q.c); };
  const submitPhrase = () => { if (res || !ans.trim()) return; record(checkText(ans, [q.phrase.text, ...q.phrase.alternatives], { lang: "de", accents: "strict", matchCase: false, ignorePunctuation: true }).score === 1); };
  const gTxt = q.pl ? t("hubtoolsb.lang_plural") : genderWord(t, q.noun.gender as "m" | "f" | "n");
  return (
    <>
      <Seg label={t("hubtoolsb.lang_task")} value={step} onChange={(s) => { setStep(s); reseed(); setN(0); setPicked(null); setAns(""); setRes(null); }} options={[{ id: "case", label: t("hubtoolsb.lang_whichCase") }, { id: "phrase", label: t("hubtoolsb.lang_writePhrase") }]} />
      <Card label={t("hubtoolsb.lang_question")}>
        <p data-tool-chrome className="m-0 text-[13px] font-bold text-[var(--ink-3)]">{step === "case" ? t("hubtoolsb.lang_askCase") : t("hubtoolsb.lang_askPhrase")}</p>
        <p className="m-0 text-[22px] font-extrabold" lang="de">{q.prep.word} + {q.pl ? plural("de", q.noun) : q.noun.word}</p>
        <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{q.prep.en} · {q.noun.en} ({gTxt}){q.prep.case === "two" ? ` · ${q.movement ? t("hubtoolsb.lang_movTowards") : t("hubtoolsb.lang_movPosition")}` : ""}</p>
        {step === "case" ? (
          <div role="group" aria-label={t("hubtoolsb.lang_casesAria")} className="flex flex-wrap gap-2">{(["acc", "dat", "gen"] as DeCase[]).map((c) => <button key={c} type="button" disabled={!!res} aria-pressed={picked === c} onClick={() => chooseCase(c)} className={pillCls(picked === c)}>{caseName(t, c)}</button>)}</div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submitPhrase(); }} className="grid gap-2">
            <TextAnswer lang="de" value={ans} onChange={setAns} ariaLabel={t("hubtoolsb.lang_ariaPrepPhrase")} placeholder="in der Stadt" />
            <div><button type="submit" disabled={!!res || !ans.trim()} className={actionCls(true)}>{t("hubtoolsb.lang_check")}</button></div>
          </form>
        )}
        {assess && tally.total > 0 && ASSESS_SAVED}
        {!assess && res && <Verdict ok={res.ok}><span lang="de"><b>{q.phrase.text}</b>{q.phrase.alternatives.length ? ` ${t("hubtoolsb.lang_also", { x: q.phrase.alternatives.join(", ") })}` : ""}</span><span>{q.prep.case === "two" ? t(q.movement ? "hubtoolsb.lang_takesMov" : "hubtoolsb.lang_takesPos", { prep: iso(q.prep.word), case: caseLc(t, q.c) }) : t("hubtoolsb.lang_takes", { prep: iso(q.prep.word), case: caseLc(t, q.c) })}</span></Verdict>}
        {!assess && res && <div><button type="button" onClick={next} className={actionCls(true)}>{t("hubtoolsb.lang_next")}</button></div>}
        {assess && step === "phrase" && <div data-tool-chrome><button type="button" onClick={next} className={actionCls()}>{t("hubtoolsb.lang_skip")}</button></div>}
      </Card>
      {!assess && (
        <div data-tool-chrome className="grid gap-2">
          <button type="button" aria-expanded={table} onClick={() => setTable((s) => !s)} className={actionCls()}>{table ? t("hubtoolsb.lang_hideCaseTable") : t("hubtoolsb.lang_showCaseTable")}</button>
          {table && (
            <Card label={t("hubtoolsb.lang_articleTableCard")}><ArticleTable />
              <ul className="m-0 grid list-none gap-1 p-0 text-[13.5px] font-semibold" lang="de">
                <li><b>{t("hubtoolsb.lang_lstAcc")}</b> {DE_PREPOSITIONS.filter((p) => p.case === "acc").map((p) => p.word).join(", ")}</li>
                <li><b>{t("hubtoolsb.lang_lstDat")}</b> {DE_PREPOSITIONS.filter((p) => p.case === "dat").map((p) => p.word).join(", ")}</li>
                <li><b>{t("hubtoolsb.lang_lstGen")}</b> {DE_PREPOSITIONS.filter((p) => p.case === "gen").map((p) => p.word).join(", ")}</li>
                <li><b>{t("hubtoolsb.lang_lstTwo")}</b> {DE_PREPOSITIONS.filter((p) => p.case === "two").map((p) => p.word).join(", ")}</li>
              </ul>
            </Card>
          )}
        </div>
      )}
      <Tally right={tally.right} total={tally.total} />
    </>
  );
}
const GEN_IRREGULAR: Record<string, string> = { Polizist: "Polizisten", Bauer: "Bauern", Elefant: "Elefanten", Bär: "Bären", Herz: "Herzens", Junge: "Jungen", Löwe: "Löwen", Affe: "Affen", Hase: "Hasen", Cousin: "Cousins" };
/** Genitive forms of a masculine/neuter noun, primary first: weak nouns -n/-en, sibilants -es, else -s (short words also -es). */
function genitiveForms(n: Noun): string[] {
  const w = n.word;
  if (GEN_IRREGULAR[w]) return [GEN_IRREGULAR[w]!];
  if (/(s|ß|sch|tz|x|z)$/.test(w)) return [w + "es"];
  const short = /^[^aeiouäöüy]*[aeiouäöüy]+[^aeiouäöüy]*$/i.test(w);
  return short ? [w + "s", w + "es"] : [w + "s"];
}

export default function AgreementTrainer(props: Partial<ToolProps>) {
  const t = useT();
  const assess = props.mode === "assess";
  const section: Section = props.params?.view === "cases" ? "cases" : "agree";
  const [topic, setTopic] = useState<Topic>(props.params?.lang === "es" || props.params?.lang === "de" ? (props.params.lang as Topic) : "fr");
  return (
    <Shell testId={section === "cases" ? "case-trainer" : "agreement-trainer"}>
      {section === "agree" ? (
        <>
          <Seg label={t("hubtoolsb.lang_topic")} value={topic} onChange={setTopic} options={TOPICS.map((id) => ({ id, label: t(lk(`topic_${id}`)) }))} />
          {topic === "de" ? <EndingsPanel key="de" assess={assess} /> : <AdjectivePanel key={topic} lang={topic} assess={assess} />}
        </>
      ) : <CasesPanel assess={assess} />}
    </Shell>
  );
}
export type { Lang };
