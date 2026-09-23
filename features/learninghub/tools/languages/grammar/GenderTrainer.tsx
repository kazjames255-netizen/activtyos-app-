"use client";

import { useMemo, useState } from "react";
import { makeRng } from "../../engine/rng";
import { checkText } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { TextAnswer, type Lang } from "../AccentBar";
import { ARTICLE_CHOICES, THEMES, THEME_LABEL, article, genderColour, genderCue, nounsFor, withArticle, plural, type ArticleKind, type Noun, type Theme } from "./nouns";
import { AccentPick, ASSESS_SAVED, Card, LangTabs, Seg, Shell, Tally, Verdict, actionCls, isLang, pillCls, policyFor, useSeed, type AccentSetting } from "./shared";

// Gender & article trainer (plan L-10): choose the article, or type article + noun. Colour is only ever a helper — every gender also has a symbol, a letter and a word.
// No timers and no streaks. In assess mode the cue, the answer and any feedback are hidden.

type Mode = "choose" | "type" | "study";

/** ♂ M masculine — colour PLUS symbol, letter and word. */
export function GenderBadge({ noun }: { noun: Noun }) {
  const c = genderCue(noun.gender);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 bg-[var(--surface)] px-2.5 py-0.5 text-[13px] font-extrabold" style={{ borderColor: genderColour(noun.gender), color: "var(--ink)" }}>
      <span aria-hidden>{c.symbol}</span><span aria-hidden>{c.letter}</span><span>{c.label}</span>
    </span>
  );
}
const note = (lang: Lang, n: Noun): string | null => {
  if (lang === "es" && n.elAgua) return "Feminine, but it takes el in the singular because it starts with a stressed a (el agua, las aguas).";
  if (lang === "fr" && article("fr", n, "definite") === "l'") return "l' hides the gender — check un / une to see it.";
  if (lang === "de" && n.gender === "n" && /chen$|lein$/.test(n.word)) return "Words ending -chen / -lein are always neuter.";
  return null;
};

export default function GenderTrainer(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const start: Lang = isLang(props.params?.lang) ? (props.params!.lang as Lang) : "fr";
  const [lang, setLang] = useState<Lang>(start);
  const [theme, setTheme] = useState<Theme | "all">("all");
  const [mode, setMode] = useState<Mode>("choose");
  const [kind, setKind] = useState<ArticleKind>(start === "fr" ? "indefinite" : "definite");
  const [accents, setAccents] = useState<AccentSetting>("warn");
  const [seed, reseed] = useSeed();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [res, setRes] = useState<{ ok: boolean; note?: string } | null>(null);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const pool = useMemo(() => makeRng(seed).shuffle(nounsFor(lang, theme)), [lang, theme, seed]);
  const noun = pool[i % Math.max(1, pool.length)];

  const clear = () => { setI(0); setTyped(""); setPicked(null); setRes(null); setTally({ right: 0, total: 0 }); };
  const next = () => { setTyped(""); setPicked(null); setRes(null); if (i + 1 >= pool.length) { reseed(); setI(0); } else setI(i + 1); };
  const record = (ok: boolean, n?: string) => { setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 })); if (assess) next(); else setRes({ ok, note: n }); };

  const choose = (a: string) => { if (!noun || res) return; setPicked(a); record(a === article(lang, noun, kind), undefined); };
  const submitTyped = () => {
    if (!noun || res) return;
    const want = withArticle(lang, noun, kind);
    const r = checkText(typed, [want], policyFor(lang, accents, assess));
    const ok = r.score === r.max;
    const capsNote = ok && lang === "de" && !/[A-ZÄÖÜ]/.test(typed.trim().split(" ").pop()?.[0] ?? "") ? "German nouns start with a capital letter." : undefined;
    record(ok, capsNote ?? (ok ? r.feedback[0]?.split("— ")[1] : undefined));
  };

  return (
    <Shell testId="gender-trainer">
      <LangTabs lang={lang} onChange={(l) => { setLang(l); setKind(l === "fr" ? "indefinite" : "definite"); clear(); }} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="grid gap-1 text-[12.5px] font-extrabold text-[var(--ink-2)]">Theme
          <select value={theme} onChange={(e) => { setTheme(e.target.value as Theme | "all"); clear(); }} style={{ minHeight: 44 }} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-bold text-[var(--ink)]">
            <option value="all">All themes</option>
            {THEMES.map((t) => <option key={t} value={t}>{THEME_LABEL[t]}</option>)}
          </select>
        </label>
      </div>
      <Seg label="Mode" value={mode} onChange={(m) => { setMode(m); clear(); }} options={[{ id: "choose", label: "Choose the article" }, { id: "type", label: "Type it" }, ...(assess ? [] : [{ id: "study" as Mode, label: "Study cards" }])]} />
      {mode !== "study" && <Seg label="Article kind" value={kind} onChange={(k) => { setKind(k); clear(); }} options={[{ id: "definite", label: lang === "es" ? "el / la" : lang === "fr" ? "le / la / l'" : "der / die / das" }, { id: "indefinite", label: lang === "es" ? "un / una" : lang === "fr" ? "un / une" : "ein / eine" }]} />}
      {mode === "type" && <AccentPick value={accents} onChange={setAccents} />}

      {mode === "study" && !assess && (
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Study cards">
          {nounsFor(lang, theme).slice(0, 24).map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
              <div className="grid"><b className="text-[16px]">{withArticle(lang, n, "definite")}</b><span className="text-[12.5px] font-semibold text-[var(--ink-3)]">{n.en}{lang === "de" ? ` · pl. ${plural("de", n)}` : ""}</span></div>
              <GenderBadge noun={n} />
            </div>
          ))}
        </div>
      )}

      {mode !== "study" && noun && (
        <Card label="Question">
          {mode === "choose" ? (
            <>
              <p className="m-0 text-[13px] font-bold text-[var(--ink-3)]">Which article goes with…</p>
              <p className="m-0 text-[24px] font-extrabold" lang={lang}>{noun.word}</p>
              <p className="m-0 text-[13.5px] font-semibold text-[var(--ink-2)]">meaning: {noun.en}</p>
              <div role="group" aria-label="Articles" className="flex flex-wrap gap-2">
                {ARTICLE_CHOICES[lang][kind].map((a) => <button key={a} type="button" disabled={!!res} onClick={() => choose(a)} aria-pressed={picked === a} className={pillCls(picked === a)} lang={lang} style={{ minWidth: 64 }}>{a}</button>)}
              </div>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }} className="grid gap-2">
              <p className="m-0 text-[13px] font-bold text-[var(--ink-3)]">Type the {kind === "definite" ? "definite" : "indefinite"} article and the {LANGNAME[lang]} word for…</p>
              <p className="m-0 text-[22px] font-extrabold">{noun.en}</p>
              <TextAnswer lang={lang} value={typed} onChange={setTyped} ariaLabel="Article and noun" placeholder={lang === "fr" ? "le / la / l' + mot" : lang === "es" ? "el / la + palabra" : "der / die / das + Wort"} />
              <div><button type="submit" disabled={!!res || !typed.trim()} className={actionCls(true)}>Check</button></div>
            </form>
          )}
          {assess && total(tally) > 0 && ASSESS_SAVED}
          {res && !assess && (
            <Verdict ok={res.ok}>
              <span lang={lang}><b>{withArticle(lang, noun, kind)}</b> — {noun.en}{lang === "de" ? ` (pl. die ${plural("de", noun)})` : ""}</span>
              <span className="flex items-center gap-2">Gender: <GenderBadge noun={noun} /></span>
              {note(lang, noun) && <span>{note(lang, noun)}</span>}
              {res.note && <span>{res.note}</span>}
            </Verdict>
          )}
          {res && !assess && <div><button type="button" onClick={next} className={actionCls(true)}>Next word</button></div>}
        </Card>
      )}
      {mode !== "study" && <Tally right={tally.right} total={tally.total} />}
    </Shell>
  );
}
const LANGNAME: Record<Lang, string> = { es: "Spanish", fr: "French", de: "German" };
const total = (t: { total: number }) => t.total;
