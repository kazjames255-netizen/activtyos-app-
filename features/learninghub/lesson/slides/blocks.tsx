"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FOCUS } from "../../kit";
import { Btn } from "../lessonUi";
import type { Block, Chip } from "./types";

// The interactive building blocks of a slide. Every block keeps its own small state; the deck remounts them per slide.
// `xp(n)` awards experience points for a first-try success (the lesson player owns the total).

type Xp = (n: number) => void;
export const plain = (s: string) => s.replace(/[{}]|\*\*/g, "");
const norm = (s: string) => plain(s).trim().toLowerCase().replace(/\s+/g, " ");

/** **bold** and {accent} inside a string. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\}|\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith("{") ? <span key={i} className="font-extrabold" style={{ color: "var(--violet)" }}>{p.slice(1, -1)}</span> : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}

const pill = `inline-flex min-h-[44px] lg:min-h-[38px] items-center gap-2 rounded-xl border-2 px-4 text-[14px] font-bold ${FOCUS}`;
const idle = "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand-2)]";
const good = "border-[var(--green)] bg-[var(--green-soft)] text-[var(--ink)]";
const bad = "border-[var(--red)] bg-[var(--red-soft)] text-[var(--ink)] ls-shake";
const label = "m-0 mb-2 text-[14px] font-extrabold leading-snug text-[var(--ink)]";
const wrap = "mt-4";

function speak(word: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-GB"; u.rate = 0.8;
    synth.speak(u);
    return true;
  } catch { return false; }
}
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
const Tick = () => <span aria-hidden="true" className="font-black text-[var(--hub-green-ink)]">✓</span>;

function ChipRow({ items }: { items: Chip[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
      {items.map((c, i) => {
        const o = typeof c === "string" ? { text: c } : c;
        return (
          <li key={i} className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border-2 border-[var(--line)] bg-[var(--panel)] px-4 text-[15px] font-bold text-[var(--ink)]">
            {o.emoji && <span aria-hidden="true" className="text-[19px] leading-none">{o.emoji}</span>}<span><Inline text={o.text} /></span>
          </li>
        );
      })}
    </ul>
  );
}

function Define({ items }: { items: { term: string; def: string }[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((it, i) => {
        const on = open.has(i);
        return (
          <button key={i} type="button" aria-pressed={on} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
            className={`min-h-[55px] rounded-2xl border-2 p-3.5 text-left transition ${FOCUS} ${on ? "border-[var(--brand-2)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--violet)" }}>{it.term}</span>
            <span className="mt-1 block text-[12px] leading-snug text-[var(--ink-2)]">{on ? it.def : "Tap to see what it means"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Formula({ rows }: { rows: { root: string; add: string; result: string; note?: string }[] }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  return (
    <div className="grid gap-2.5">
      {rows.map((r, i) => {
        const on = shown.has(i);
        return (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border-2 border-[var(--line)] bg-[var(--panel)] p-2.5">
            <span className="rounded-xl px-3 py-1 text-[19px] font-extrabold text-white" style={{ background: "var(--brand)" }}>{r.root}</span>
            <span aria-hidden="true" className="text-[16px] font-black text-[var(--ink-3)]">+</span>
            <span className="rounded-xl px-3 py-1 text-[19px] font-extrabold text-white" style={{ background: "var(--violet)" }}>{r.add}</span>
            <span aria-hidden="true" className="text-[16px] font-black text-[var(--ink-3)]">=</span>
            {on
              ? <span className="ls-enter rounded-xl border-2 border-[var(--green)] bg-[var(--green-soft)] px-3 py-1 text-[19px] font-extrabold text-[var(--ink)]"><Inline text={r.result} /></span>
              : <button type="button" onClick={() => setShown((s) => new Set(s).add(i))} className={`${pill} ${idle} !min-h-[34px] !py-0 text-[13px]`}>Make the word ✨</button>}
            {on && r.note && <span className="basis-full text-[13px] text-[var(--ink-2)]">{r.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Cards({ items }: { items: { emoji?: string; title: string; sub?: string }[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((c, i) => (
        <li key={i} className="flex flex-col items-center rounded-2xl border-2 border-[var(--line)] bg-[var(--panel)] px-2 py-2.5 text-center">
          {c.emoji && <span aria-hidden="true" className="text-[34px] leading-none">{c.emoji}</span>}
          <span className={`${c.emoji ? "mt-1 " : ""}text-[14px] font-extrabold leading-tight text-[var(--ink)]`}><Inline text={c.title} /></span>
          {c.sub && <span className="mt-0.5 text-[12px] leading-tight text-[var(--ink-2)]"><Inline text={c.sub} /></span>}
        </li>
      ))}
    </ul>
  );
}

function Reveal({ label: lab, text }: { label?: string; text: string }) {
  const [on, setOn] = useState(false);
  return on
    ? <p className="ls-enter m-0 rounded-2xl border-2 border-[var(--green)] bg-[var(--green-soft)] p-3.5 text-[14px] font-semibold leading-snug text-[var(--ink)]"><Inline text={text} /></p>
    : <button type="button" onClick={() => setOn(true)} className={`${pill} ${idle}`}>{lab ?? "Show the answer"}</button>;
}

function Roots({ items }: { items: { word: string; root: string }[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((it, i) => {
        const on = open.has(i);
        return (
          <button key={i} type="button" aria-pressed={on} onClick={() => setOpen((s) => new Set(s).add(i))}
            className={`flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2.5 text-left transition ${FOCUS} ${on ? "border-[var(--brand-2)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
            <span className="text-[17px] font-extrabold text-[var(--ink)]"><Inline text={it.word} /></span>
            <span className={`text-[13px] font-bold ${on ? "ls-enter text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{on ? `root: ${it.root}` : "Tap for the root word"}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One multiple-choice question: a wrong pick shakes and can be retried; the first-try win is worth XP. */
function Mcq({ q, options, answer, why, xp }: { q?: string; options: string[]; answer: number; why?: string; xp: Xp }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const done = picked === answer;
  return (
    <div>
      {q && <p className={label}><Inline text={q} /></p>}
      <div className="flex flex-wrap gap-2.5" role="group" aria-label={q ? plain(q) : "Choose one"}>
        {options.map((o, i) => (
          <button key={i} type="button" disabled={done} aria-pressed={picked === i}
            onClick={() => { setPicked(i); if (i === answer) { if (!wrong.length) xp(5); } else setWrong((w) => (w.includes(i) ? w : [...w, i])); }}
            className={`${pill} ${done && i === answer ? good : wrong.includes(i) ? bad : idle}`}>
            {done && i === answer && <Tick />}<span><Inline text={o} /></span>
          </button>
        ))}
      </div>
      {done && <p className="ls-enter m-0 mt-2.5 text-[12px] font-bold text-[var(--hub-green-ink)]" role="status">{wrong.length ? "Got it!" : "Correct!"}{why ? <span className="font-semibold text-[var(--ink-2)]"> {why}</span> : null}</p>}
      {!done && wrong.length > 0 && <p className="m-0 mt-2.5 text-[12px] font-bold text-[var(--red)]" role="status">Not quite. Have another go.</p>}
    </div>
  );
}

function Sort({ q, columns, items, xp }: { q: string; columns: string[]; items: { text: string; col: number }[]; xp: Xp }) {
  const [placed, setPlaced] = useState<Record<number, boolean>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const misses = useRef(0);
  const left = items.map((it, i) => ({ it, i })).filter((x) => !placed[x.i]);
  const put = (col: number) => {
    if (sel == null) return;
    if (items[sel]!.col === col) { setPlaced((p) => ({ ...p, [sel]: true })); setSel(null); if (left.length === 1 && !misses.current) xp(8); }
    else { misses.current += 1; setShake(col); setTimeout(() => setShake(null), 450); }
  };
  return (
    <div>
      <p className={label}><Inline text={q} /></p>
      <div className="mb-3 flex min-h-[45px] flex-wrap gap-2.5" aria-label="Words to sort">
        {left.map(({ it, i }) => <button key={i} type="button" aria-pressed={sel === i} onClick={() => setSel(i)} className={`${pill} ${sel === i ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : idle}`}>{it.text}</button>)}
        {!left.length && <p className="ls-enter m-0 self-center text-[13px] font-extrabold text-[var(--hub-green-ink)]" role="status">All sorted!</p>}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {columns.map((c, ci) => (
          <button key={ci} type="button" onClick={() => put(ci)} disabled={sel == null}
            className={`min-h-[103px] rounded-2xl border-2 border-dashed p-3 text-left transition ${FOCUS} ${shake === ci ? "border-[var(--red)] ls-shake" : sel != null ? "border-[var(--brand-2)] bg-[var(--brand-soft)]" : "border-[var(--line)]"}`}>
            <span className="block text-[13px] font-extrabold leading-snug text-[var(--ink-2)]">{c}</span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {items.map((it, i) => (placed[i] && it.col === ci ? <span key={i} className="ls-enter rounded-lg border-2 border-[var(--green)] bg-[var(--green-soft)] px-2.5 py-1 text-[13px] font-bold text-[var(--ink)]">{it.text}</span> : null))}
            </span>
          </button>
        ))}
      </div>
      {sel != null && <p className="m-0 mt-2 text-[13px] font-semibold text-[var(--ink-2)]">Now tap the column for “{items[sel]!.text}”.</p>}
    </div>
  );
}

function Match({ q, pairs, xp }: { q: string; pairs: { a: string; b: string }[]; xp: Xp }) {
  const rights = useMemo(() => pairs.map((p, i) => ({ text: p.b, i })).reverse(), [pairs]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const misses = useRef(0);
  const tapRight = (i: number) => {
    if (sel == null) return;
    if (sel === i) { setDone((d) => new Set(d).add(i)); setSel(null); if (done.size + 1 === pairs.length && !misses.current) xp(8); }
    else { misses.current += 1; setShake(i); setTimeout(() => setShake(null), 450); }
  };
  return (
    <div>
      <p className={label}><Inline text={q} /></p>
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        <div className="grid content-start gap-2.5">
          {pairs.map((p, i) => <button key={i} type="button" disabled={done.has(i)} aria-pressed={sel === i} onClick={() => setSel(i)} className={`${pill} justify-center ${done.has(i) ? good : sel === i ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : idle}`}>{done.has(i) && <Tick />}<span><Inline text={p.a} /></span></button>)}
        </div>
        <div className="grid content-start gap-2.5">
          {rights.map((r) => <button key={r.i} type="button" disabled={done.has(r.i)} onClick={() => tapRight(r.i)} className={`${pill} justify-center text-center !text-[13px] ${done.has(r.i) ? good : shake === r.i ? bad : idle}`}>{done.has(r.i) && <Tick />}<span><Inline text={r.text} /></span></button>)}
        </div>
      </div>
      <p className="m-0 mt-2 text-[13px] font-semibold text-[var(--ink-2)]" role="status">{done.size === pairs.length ? "All matched!" : "Tap one on the left, then its match on the right."}</p>
    </div>
  );
}

function SpellWord({ word, n, xp }: { word: string; n: number; xp: Xp }) {
  const [v, setV] = useState("");
  const [st, setSt] = useState<"idle" | "ok" | "bad">("idle");
  const tries = useRef(0);
  const speech = useMemo(canSpeak, []);
  const [hint, setHint] = useState(false);
  const check = () => {
    if (!v.trim()) return;
    tries.current += 1;
    if (norm(v) === norm(word)) { setSt("ok"); if (tries.current === 1) xp(5); } else setSt("bad");
  };
  return (
    <li className="rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="w-6 text-[14px] font-extrabold text-[var(--ink-3)]">{n})</span>
        <button type="button" onClick={() => { if (!speak(word)) setHint(true); }} aria-label={`Hear word ${n}`} className={`${pill} ${idle} !px-3`}><span aria-hidden="true">🔊</span> Hear it</button>
        <input value={v} onChange={(e) => { setV(e.target.value); if (st === "bad") setSt("idle"); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") check(); }} disabled={st === "ok"}
          aria-label={`Type word ${n}`} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Type the word"
          className={`min-h-[38px] min-w-[140px] flex-1 rounded-xl border-2 px-3 text-[15px] font-bold text-[var(--ink)] outline-none ${st === "ok" ? "border-[var(--green)] bg-[var(--green-soft)]" : st === "bad" ? "border-[var(--red)] ls-shake" : "border-[var(--line)] bg-[var(--panel)] focus:border-[var(--brand-2)]"}`} />
        <Btn tone="ghost" onClick={check} disabled={st === "ok" || !v.trim()} className="!min-h-[33px] !px-4">Check</Btn>
        {st === "ok" && <Tick />}
      </div>
      {(!speech || hint) && <button type="button" onClick={() => setHint(true)} className="mt-2 text-[12px] font-bold text-[var(--brand)] underline">{hint ? `The word is “${word}”.` : "Can’t hear it? Show the word"}</button>}
      {st === "bad" && <p className="m-0 mt-2 text-[13px] font-bold text-[var(--red)]" role="status">Not quite. Sound it out, think of the root word, then try again.</p>}
      {st === "ok" && <p className="ls-enter m-0 mt-2 text-[12px] font-bold text-[var(--hub-green-ink)]" role="status">Correct: {word}</p>}
    </li>
  );
}
function Spell({ q, words, tips, xp }: { q?: string; words: string[]; tips?: string[]; xp: Xp }) {
  return (
    <div>
      {q && <p className={label}><Inline text={q} /></p>}
      <p className="m-0 mb-2.5 text-[14.5px] text-[var(--ink-2)]">Tap 🔊 to hear each word, then type it.</p>
      <ol className="m-0 grid list-none gap-2.5 p-0">{words.map((w, i) => <SpellWord key={w + i} word={w} n={i + 1} xp={xp} />)}</ol>
      {tips && tips.length > 0 && (
        <div className="mt-3 rounded-2xl bg-[var(--panel)] p-3.5">
          <p className="m-0 mb-1 text-[13px] font-extrabold text-[var(--ink)]">Remember to</p>
          <ul className="m-0 list-disc pl-5 text-[12px] text-[var(--ink-2)]">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function LcwcWord({ word, xp }: { word: string; xp: Xp }) {
  const [phase, setPhase] = useState<"look" | "write" | "ok" | "bad">("look");
  const [v, setV] = useState("");
  return (
    <li className="rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-3.5">
      {phase === "look" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[22px] font-extrabold tracking-wide text-[var(--ink)]">{word}</span>
          <span className="text-[13px] text-[var(--ink-2)]">1. Look. Say it. Notice the tricky parts.</span>
          <Btn onClick={() => setPhase("write")} className="!min-h-[33px]">Cover it</Btn>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <span aria-hidden="true" className="grid h-9 min-w-[140px] place-items-center rounded-xl bg-[var(--line)] px-3 text-[13px] font-bold text-[var(--ink-3)]">covered</span>
          <input value={v} onChange={(e) => { setV(e.target.value); if (phase === "bad") setPhase("write"); }} disabled={phase === "ok"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && v.trim()) { const ok = norm(v) === norm(word); setPhase(ok ? "ok" : "bad"); if (ok) xp(5); } }}
            aria-label={`Write the word (covered)`} placeholder="Write it from memory"
            className={`min-h-[38px] min-w-[150px] flex-1 rounded-xl border-2 px-3 text-[15px] font-bold text-[var(--ink)] outline-none ${phase === "ok" ? "border-[var(--green)] bg-[var(--green-soft)]" : phase === "bad" ? "border-[var(--red)]" : "border-[var(--line)] bg-[var(--panel)] focus:border-[var(--brand-2)]"}`} />
          <Btn tone="ghost" disabled={phase === "ok" || !v.trim()} onClick={() => { const ok = norm(v) === norm(word); setPhase(ok ? "ok" : "bad"); if (ok) xp(5); }} className="!min-h-[33px] !px-4">Check</Btn>
          {phase === "bad" && <span className="basis-full text-[12px] font-bold text-[var(--red)]" role="status">Not quite. The word is <b>{word}</b>. <button type="button" className="underline" onClick={() => { setV(""); setPhase("look"); }}>Look again</button></span>}
          {phase === "ok" && <span className="ls-enter basis-full text-[12px] font-bold text-[var(--hub-green-ink)]" role="status">✓ You spelt it correctly: {word}</span>}
        </div>
      )}
    </li>
  );
}
function Lcwc({ q, words, xp }: { q: string; words: string[]; xp: Xp }) {
  return (
    <div>
      <p className={label}><Inline text={q} /></p>
      <ul className="m-0 grid list-none gap-2.5 p-0">{words.map((w) => <LcwcWord key={w} word={w} xp={xp} />)}</ul>
    </div>
  );
}

function ClapWord({ word, chunks }: { word: string; chunks: string[] }) {
  const [at, setAt] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const play = () => {
    if (timer.current) clearInterval(timer.current);
    let i = 0; setAt(0);
    timer.current = setInterval(() => { i += 1; if (i >= chunks.length) { if (timer.current) clearInterval(timer.current); setTimeout(() => setAt(-1), 500); } else setAt(i); }, 600);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[var(--line)] bg-[var(--panel)] p-3.5">
      <button type="button" onClick={play} aria-label={`Clap ${word}`} className={`${pill} ${idle}`}><span aria-hidden="true">👏</span> Clap it</button>
      <span className="text-[13px] font-bold text-[var(--ink-2)]">{word} =</span>
      <span className="flex flex-wrap gap-1.5" aria-label={chunks.join(" ")}>
        {chunks.map((c, i) => <span key={i} className={`rounded-lg px-3 py-1.5 text-[17px] font-extrabold transition ${at === i ? "scale-110 bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--ink)]"}`}>{c}</span>)}
      </span>
    </div>
  );
}

const box = (children: ReactNode, k: number) => <div key={k} className={wrap}>{children}</div>;

export function BlockView({ b, k, xp }: { b: Block; k: number; xp: Xp }) {
  switch (b.t) {
    case "text": return <p key={k} className="m-0 mt-3 text-[15px] leading-[1.5] text-[var(--ink)] first:mt-0"><Inline text={b.text} /></p>;
    case "lead": return <p key={k} className="m-0 mt-3 text-[20px] font-extrabold leading-[1.3] text-[var(--ink)] first:mt-0 sm:text-[23px]"><Inline text={b.text} /></p>;
    case "callout": return <p key={k} className="m-0 mt-4 rounded-2xl border-l-[6px] border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-[15px] font-bold leading-snug text-[var(--ink)]"><Inline text={b.text} /></p>;
    case "list": return <ul key={k} className="m-0 mt-3 grid list-none gap-2 p-0">{b.items.map((t) => <li key={t} className="flex items-start gap-2.5 text-[15px] leading-snug text-[var(--ink)]"><span aria-hidden="true" className="mt-[9px] h-2.5 w-2.5 flex-none rounded-full bg-[var(--brand-2)]" /><span><Inline text={t} /></span></li>)}</ul>;
    case "chips": return box(<ChipRow items={b.items} />, k);
    case "cards": return box(<Cards items={b.items} />, k);
    case "define": return box(<Define items={b.items} />, k);
    case "formula": return box(<Formula rows={b.rows} />, k);
    case "reveal": return box(<Reveal label={b.label} text={b.text} />, k);
    case "roots": return box(<Roots items={b.items} />, k);
    case "choice": return box(<Mcq q={b.q} options={b.options} answer={b.answer} why={b.why} xp={xp} />, k);
    case "choices": return box(<div className="grid gap-5">{b.q && <p className={label}><Inline text={b.q} /></p>}{b.items.map((it, i) => <Mcq key={i} q={it.q} options={it.options} answer={it.answer} xp={xp} />)}</div>, k);
    case "sort": return box(<Sort q={b.q} columns={b.columns} items={b.items} xp={xp} />, k);
    case "match": return box(<Match q={b.q} pairs={b.pairs} xp={xp} />, k);
    case "spell": return box(<Spell q={b.q} words={b.words} tips={b.tips} xp={xp} />, k);
    case "lcwc": return box(<Lcwc q={b.q} words={b.words} xp={xp} />, k);
    case "clap": return box(<div className="grid gap-2.5">{b.items.map((it) => <ClapWord key={it.word} word={it.word} chunks={it.chunks} />)}</div>, k);
    default: return null;
  }
}
