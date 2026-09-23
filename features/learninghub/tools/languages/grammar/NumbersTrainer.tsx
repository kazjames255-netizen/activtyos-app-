"use client";

import { useMemo, useState } from "react";
import { makeRng, type Rng } from "../../engine/rng";
import { checkText } from "../../engine/textmark";
import type { ToolProps } from "../../types";
import { TextAnswer, type Lang } from "../AccentBar";
import { DAYS_IN_MONTH, ageWords, clockAngles, dateForms, formatDigits, numberWords, parseDayMonth, parseDigits, parsePrice, parseTime, priceWords, timeDigits, timeWords, type TimeStyle } from "./numbers";
import { AccentPick, ASSESS_SAVED, Card, LangTabs, Seg, Shell, Tally, Verdict, actionCls, isLang, policyFor, useSeed, type AccentSetting } from "./shared";

// Numbers trainer (plan L-16): numbers, dates, times (with an analogue clock), prices, ages. See digits → type words, or see words → type digits.
// Text only — audio is not available. Typed words are marked with the accent policy; digits are parsed, so 1,000 / 1 000 / 1000 all count.

type Kind = "numbers" | "dates" | "times" | "prices" | "ages";
type Dir = "toWords" | "toDigits";
type Range = "r20" | "r100" | "r1000" | "r1m";
const RANGES: Record<Range, [number, number]> = { r20: [0, 20], r100: [0, 100], r1000: [0, 1000], r1m: [1000, 1000000] };

interface Q { prompt: string; sub?: string; clock?: { h: number; m: number }; accepted: string[]; shown: string; judgeDigits?: (a: string) => boolean }

function makeQ(lang: Lang, kind: Kind, dir: Dir, range: Range, style: TimeStyle, rng: Rng): Q {
  if (kind === "numbers") {
    const [lo, hi] = RANGES[range], v = rng.int(lo, hi), w = numberWords(lang, v);
    return dir === "toWords" ? { prompt: formatDigits(v), accepted: w.all, shown: w.text } : { prompt: w.text, accepted: [String(v)], shown: formatDigits(v), judgeDigits: (a) => parseDigits(a) === v };
  }
  if (kind === "dates") {
    const mo = rng.int(1, 12), d = rng.int(1, mo === 2 ? 28 : DAYS_IN_MONTH[mo - 1]!), f = dateForms(lang, d, mo);
    const acc = lang === "de" ? [...f.accepted, ...dateForms(lang, d, mo, { dative: true }).accepted] : f.accepted;
    return dir === "toWords" ? { prompt: `${d}/${mo}`, sub: "day / month", accepted: acc, shown: f.words } : { prompt: f.words, sub: "type day/month, e.g. 14/7", accepted: [`${d}/${mo}`], shown: `${d}/${mo}`, judgeDigits: (a) => { const p = parseDayMonth(a); return !!p && p[0] === d && p[1] === mo; } };
  }
  if (kind === "times") {
    const h = rng.int(0, 23), m = rng.next() < 0.8 ? rng.int(0, 11) * 5 : rng.int(0, 59), w = timeWords(lang, h, m, style);
    return dir === "toWords"
      ? { prompt: timeDigits(h, m), sub: style === "official" ? "24-hour (official)" : "everyday speech", clock: { h, m }, accepted: w.all, shown: w.text }
      : { prompt: w.text, sub: style === "official" ? "type the 24-hour time, e.g. 15:15" : "type the time, e.g. 3:15", accepted: [timeDigits(h, m)], shown: timeDigits(h, m), judgeDigits: (a) => { const p = parseTime(a); return !!p && p[1] === m && (style === "official" ? p[0] === h : p[0] % 12 === h % 12); } };
  }
  if (kind === "prices") {
    let e = rng.int(0, 60); const c = rng.pick([0, 50, 20, 99, 5, 75, 10, 25]);
    if (e === 0 && c === 0) e = 1;
    const w = priceWords(lang, e, c), digits = `${e},${String(c).padStart(2, "0")} €`;
    return dir === "toWords" ? { prompt: digits, accepted: w.all, shown: w.text } : { prompt: w.text, sub: "type the price, e.g. 5,50", accepted: [digits], shown: digits, judgeDigits: (a) => { const p = parsePrice(a); return !!p && p[0] === e && p[1] === c; } };
  }
  const age = rng.int(1, 100), w = ageWords(lang, age);
  return dir === "toWords" ? { prompt: `${age} years old`, sub: "say how old you are", accepted: w.all, shown: w.text } : { prompt: w.text, sub: "type the age as a number", accepted: [String(age)], shown: String(age), judgeDigits: (a) => parseDigits(a) === age };
}

/** Analogue clock face (SVG). */
export function AnalogueClock({ h, m, size = 160 }: { h: number; m: number; size?: number }) {
  const a = clockAngles(h, m), pt = (deg: number, r: number) => [100 + r * Math.sin((deg * Math.PI) / 180), 100 - r * Math.cos((deg * Math.PI) / 180)] as const;
  const [hx, hy] = pt(a.hour, 50), [mx, my] = pt(a.minute, 76);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Analogue clock showing ${timeDigits(h % 12 === 0 ? 12 : h % 12, m)}`}>
      <circle cx="100" cy="100" r="94" fill="var(--surface)" stroke="var(--ink)" strokeWidth="4" />
      {Array.from({ length: 60 }, (_, k) => { const big = k % 5 === 0, [x1, y1] = pt(k * 6, big ? 80 : 86), [x2, y2] = pt(k * 6, 90); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={big ? 3 : 1} />; })}
      {Array.from({ length: 12 }, (_, k) => { const [x, y] = pt((k + 1) * 30, 68); return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight="800" fill="var(--ink)">{k + 1}</text>; })}
      <line x1="100" y1="100" x2={hx} y2={hy} stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" />
      <line x1="100" y1="100" x2={mx} y2={my} stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="100" r="5" fill="var(--ink)" />
    </svg>
  );
}

export default function NumbersTrainer(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const [lang, setLang] = useState<Lang>(isLang(props.params?.lang) ? (props.params!.lang as Lang) : "fr");
  const [kind, setKind] = useState<Kind>("numbers");
  const [dir, setDir] = useState<Dir>("toWords");
  const [range, setRange] = useState<Range>("r100");
  const [style, setStyle] = useState<TimeStyle>("colloquial");
  const [accents, setAccents] = useState<AccentSetting>("warn");
  const [seed, reseed] = useSeed();
  const [n, setN] = useState(0);
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState<{ ok: boolean; note?: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const q = useMemo(() => makeQ(lang, kind, dir, range, style, makeRng(seed * 7919 + n * 104729 + 1)), [lang, kind, dir, range, style, seed, n]);

  const clear = () => { setAnswer(""); setRes(null); setRevealed(false); setTally({ right: 0, total: 0 }); reseed(); setN(0); };
  const next = () => { setAnswer(""); setRes(null); setRevealed(false); setN(n + 1); };
  const submit = () => {
    if (res || !answer.trim()) return;
    let ok: boolean, note: string | undefined;
    if (q.judgeDigits) ok = q.judgeDigits(answer);
    else { const r = checkText(answer, q.accepted, policyFor(lang, accents, assess)); ok = r.score === r.max; note = r.feedback[0]?.split("— ")[1]; }
    setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 }));
    if (assess) next(); else setRes({ ok, note });
  };
  const typingWords = !q.judgeDigits;

  return (
    <Shell testId="numbers-trainer">
      <LangTabs lang={lang} onChange={(l) => { setLang(l); clear(); }} />
      <Seg label="What to practise" value={kind} onChange={(k) => { setKind(k); clear(); }} options={[{ id: "numbers", label: "Numbers" }, { id: "dates", label: "Dates" }, { id: "times", label: "Times" }, { id: "prices", label: "Prices" }, { id: "ages", label: "Ages" }]} />
      <Seg label="Direction" value={dir} onChange={(d) => { setDir(d); clear(); }} options={[{ id: "toWords", label: "Digits → words" }, { id: "toDigits", label: "Words → digits" }]} />
      {kind === "numbers" && <Seg label="Range" value={range} onChange={(r) => { setRange(r); clear(); }} options={[{ id: "r20", label: "0–20" }, { id: "r100", label: "0–100" }, { id: "r1000", label: "0–1000" }, { id: "r1m", label: "1000–1,000,000" }]} />}
      {kind === "times" && <Seg label="Time style" value={style} onChange={(s) => { setStyle(s); clear(); }} options={[{ id: "colloquial", label: "Everyday (12-hour)" }, { id: "official", label: "Official (24-hour)" }]} />}
      {typingWords && <AccentPick value={accents} onChange={setAccents} />}

      <Card label="Question">
        <p className="m-0 text-[12.5px] font-bold text-[var(--ink-3)]">{dir === "toWords" ? "Write this in words" : "Write this with digits"} · text only, no audio</p>
        {q.clock && dir === "toWords" && <div className="grid place-items-center"><AnalogueClock h={q.clock.h} m={q.clock.m} /></div>}
        <p className="m-0 text-[26px] font-extrabold" lang={dir === "toDigits" ? lang : undefined}>{q.prompt}</p>
        {q.sub && <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{q.sub}</p>}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-2">
          {typingWords
            ? <TextAnswer lang={lang} value={answer} onChange={setAnswer} ariaLabel="Your answer in words" />
            : <input value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer in digits" inputMode={kind === "dates" || kind === "times" ? "text" : "decimal"} autoComplete="off" spellCheck={false} style={{ minHeight: 48 }} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[17px] font-semibold text-[var(--ink)]" />}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!!res || !answer.trim()} className={actionCls(true)}>Check</button>
            {!assess && !res && <button type="button" onClick={() => setRevealed(true)} className={actionCls()}>Show answer</button>}
            {!assess && (res || revealed) && <button type="button" onClick={next} className={actionCls()}>Next</button>}
            {assess && <button type="button" onClick={next} className={actionCls()}>Skip</button>}
          </div>
        </form>
        {assess && tally.total > 0 && ASSESS_SAVED}
        {!assess && res && (
          <Verdict ok={res.ok}>
            <span lang={lang}>Model answer: <b>{q.shown}</b></span>
            {q.accepted.length > 1 && q.accepted.slice(1, 4).length > 0 && typingWords && <span className="text-[13px]" lang={lang}>Also accepted: {q.accepted.slice(1, 4).join(" · ")}</span>}
            {res.note && <span>{res.note}</span>}
          </Verdict>
        )}
        {!assess && !res && revealed && <p className="m-0 rounded-xl bg-[var(--panel)] p-2.5 text-[14px] font-bold" lang={lang}>Answer: {q.shown}</p>}
      </Card>
      <Tally right={tally.right} total={tally.total} />
    </Shell>
  );
}
