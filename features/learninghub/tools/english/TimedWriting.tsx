"use client";

import { useEffect, useMemo, useState } from "react";
import { FOCUS } from "../../kit";
import type { ToolProps } from "../types";
import { analyse, wordCount } from "./textstats";
import { ReadingControls, textStyle, useReadingOpts } from "./readingOptions";

// Timed writing pad (exam conditions). Timer is OPT-IN and off by default for KS1-2. No streaks, scores or rewards.
// Autosave: sessionStorage on this device only.

type Props = Partial<ToolProps> & { onChange?: (text: string) => void };
const PRESETS = [10, 20, 30, 45];
const btn = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-bold text-[var(--ink)] ${FOCUS}`;
const btnOn = `min-h-[44px] rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-3 text-[13px] font-bold text-white ${FOCUS}`;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function TimedWriting(props: Props) {
  const assess = props.mode === "assess";
  const ks = typeof props.params?.keyStage === "number" ? props.params.keyStage : 0;
  const key = `aos.timedwriting.${props.toolId ?? "english"}`;
  const [text, setText] = useState("");
  const [timerOn, setTimerOn] = useState(ks >= 3);
  const [mins, setMins] = useState(20);
  const [custom, setCustom] = useState("");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [spell, setSpell] = useState(true);
  const [note, setNote] = useState("");
  const [opts, setOpts] = useReadingOpts();

  useEffect(() => { try { const v = sessionStorage.getItem(key); if (v) setText(v); } catch { /* storage unavailable: fine */ } }, [key]);
  const save = (v: string) => {
    setText(v); props.onChange?.(v);
    try { sessionStorage.setItem(key, v); } catch { setNote("Autosave is not available in this browser."); }
  };
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => { const r = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); setLeft(r); if (r === 0) { setEndAt(null); setTimeUp(true); } };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [endAt]);

  const start = () => { const m = custom ? Number(custom) : mins; if (!(m > 0)) return; setTimeUp(false); setDone(false); setLeft(Math.round(m * 60)); setEndAt(Date.now() + m * 60000); };
  const clear = () => { setText(""); setDone(false); setTimeUp(false); setEndAt(null); try { sessionStorage.removeItem(key); } catch { /* ignore */ } props.onChange?.(""); };
  const running = endAt !== null;
  const rep = useMemo(() => (done && !assess ? analyse(text) : null), [done, assess, text]);

  return (
    <div className="grid gap-3 text-[var(--ink)]" style={{ maxWidth: 760 }}>
      <ReadingControls opts={opts} onChange={setOpts} />
      <label className="flex min-h-[44px] items-center gap-2 text-[13.5px] font-semibold">
        <input type="checkbox" className={`h-5 w-5 ${FOCUS}`} checked={timerOn} onChange={(e) => { setTimerOn(e.target.checked); if (!e.target.checked) { setEndAt(null); setTimeUp(false); } }} />
        Use a timer (optional)
      </label>
      {timerOn && (
        <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div role="group" aria-label="Time allowed" className="flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => <button key={m} type="button" disabled={running} aria-pressed={!custom && mins === m} className={!custom && mins === m ? btnOn : btn} onClick={() => { setMins(m); setCustom(""); }}>{m} min</button>)}
            <label className="flex items-center gap-1 text-[12.5px] font-bold text-[var(--ink-2)]">Custom (min)
              <input inputMode="numeric" disabled={running} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`min-h-[44px] w-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-bold text-[var(--ink)] ${FOCUS}`} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="timer" aria-live="off" aria-label="Time left" className="text-[44px] font-extrabold tabular-nums leading-none">{running || timeUp ? fmt(left) : fmt(Math.round((custom ? Number(custom) || 0 : mins) * 60))}</div>
            {!running ? <button type="button" className={btnOn} onClick={start}>Start timer</button> : <button type="button" className={btn} onClick={() => setEndAt(null)}>Stop timer</button>}
          </div>
          <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{timeUp ? "Time is up. Finish your sentence, then press Finish." : ""}</p>
        </div>
      )}
      <label htmlFor="tw-pad" className="sr-only">Your writing</label>
      <textarea id="tw-pad" value={text} onChange={(e) => save(e.target.value)} rows={14} spellCheck={spell} autoCorrect={spell ? "on" : "off"} autoCapitalize="sentences" style={textStyle(opts)} placeholder="Start writing here…"
        className={`w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[var(--ink)] ${FOCUS}`} />
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="text-[15px] font-extrabold">{wordCount(text)} words</span>
        <label className="ml-auto flex min-h-[44px] items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className={`h-5 w-5 ${FOCUS}`} checked={!spell} onChange={(e) => setSpell(!e.target.checked)} />Spellcheck off</label>
        <button type="button" className={btnOn} onClick={() => { setEndAt(null); setDone(true); }}>Finish</button>
        <button type="button" className={btn} onClick={clear}>Clear</button>
      </div>
      <p className="m-0 text-[12px] text-[var(--ink-3)]">Autosaved on this device for this browser session only. Nothing is sent anywhere.{note ? ` ${note}` : ""}</p>
      {done && (
        <section aria-label="Your stats" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <h3 className="m-0 text-[15px] font-extrabold">Finished</h3>
          {assess || !rep ? <p className="m-0 text-[13.5px]">{wordCount(text)} words.</p> : (
            <ul className="m-0 grid gap-1 pl-5 text-[13.5px]">
              <li>{rep.words} words, {rep.sentences} sentences, {rep.paragraphs} paragraph{rep.paragraphs === 1 ? "" : "s"}; average {rep.avgSentenceLength} words a sentence.</li>
              {rep.variety.tips.map((t) => <li key={t}>{t}</li>)}
              {rep.openers.tip && <li>{rep.openers.tip}</li>}
              {rep.repeated.length > 0 && <li>Words used a lot: {rep.repeated.slice(0, 5).map((r) => `${r.word} (${r.count})`).join(", ")}.</li>}
              <li>Reading time: {rep.reading}.</li>
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
