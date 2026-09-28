"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { FOCUS } from "../../kit";
import type { ToolProps } from "../types";
import { analyse, wordCount } from "./textstats";
import { readingText, tipText } from "./engText";
import { ReadingControls, textStyle, useReadingOpts } from "./readingOptions";

// Timed writing pad (exam conditions). Timer is OPT-IN and off by default for KS1-2. No streaks, scores or rewards.
// Autosave: sessionStorage on this device only.

type Props = Partial<ToolProps> & { onChange?: (text: string) => void };
const PRESETS = [10, 20, 30, 45];
const btn = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-bold text-[var(--ink)] ${FOCUS}`;
const btnOn = `min-h-[44px] rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-3 text-[13px] font-bold text-white ${FOCUS}`;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function TimedWriting(props: Props) {
  const { t: tr, locale } = useI18n();
  const T = (k: string, v?: Record<string, string | number>) => tr(`hubtoolsb.eng_${k}`, v);
  const nfmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const nf = (n: number) => nfmt.format(n);
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
    try { sessionStorage.setItem(key, v); } catch { setNote(T("autosaveNA")); }
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
      <label data-tool-chrome data-tool-strip className="flex min-h-[44px] items-center gap-2 text-[13.5px] font-semibold">
        <input type="checkbox" className={`h-5 w-5 ${FOCUS}`} checked={timerOn} onChange={(e) => { setTimerOn(e.target.checked); if (!e.target.checked) { setEndAt(null); setTimeUp(false); } }} />
        {T("useTimer")}
      </label>
      {timerOn && (
        <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div role="group" aria-label={T("timeAllowed")} className="flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => <button key={m} type="button" disabled={running} aria-pressed={!custom && mins === m} className={!custom && mins === m ? btnOn : btn} onClick={() => { setMins(m); setCustom(""); }}>{T("min", { m: nf(m) })}</button>)}
            <label className="flex items-center gap-1 text-[12.5px] font-bold text-[var(--ink-2)]">{T("customMin")}
              <input inputMode="numeric" disabled={running} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`min-h-[44px] w-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-bold text-[var(--ink)] ${FOCUS}`} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="timer" aria-live="off" aria-label={T("timeLeft")} className="text-[44px] font-extrabold tabular-nums leading-none">{running || timeUp ? fmt(left) : fmt(Math.round((custom ? Number(custom) || 0 : mins) * 60))}</div>
            {!running ? <button type="button" className={btnOn} onClick={start}>{T("startTimer")}</button> : <button type="button" className={btn} onClick={() => setEndAt(null)}>{T("stopTimer")}</button>}
          </div>
          <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{timeUp ? T("timeUp") : ""}</p>
        </div>
      )}
      <label htmlFor="tw-pad" className="sr-only">{T("yourWriting")}</label>
      <textarea id="tw-pad" value={text} onChange={(e) => save(e.target.value)} rows={14} spellCheck={spell} autoCorrect={spell ? "on" : "off"} autoCapitalize="sentences" style={textStyle(opts)} placeholder={T("startWriting")}
        className={`w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[var(--ink)] ${FOCUS}`} />
      <div data-tool-strip className="flex flex-wrap items-center gap-2">
        <span role="status" className="text-[15px] font-extrabold">{T("words", { n: nf(wordCount(text)) })}</span>
        <label data-tool-chrome className="ms-auto flex min-h-[44px] items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className={`h-5 w-5 ${FOCUS}`} checked={!spell} onChange={(e) => setSpell(!e.target.checked)} />{T("spellOff")}</label>
        <button data-tool-chrome type="button" className={btnOn} onClick={() => { setEndAt(null); setDone(true); }}>{T("finish")}</button>
        <button type="button" className={btn} onClick={clear}>{T("clear")}</button>
      </div>
      <p data-tool-chrome className="m-0 text-[12px] text-[var(--ink-3)]">{T("autosaved")}{note ? ` ${note}` : ""}</p>
      {done && (
        <section data-tool-chrome aria-label={T("yourStats")} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <h3 className="m-0 text-[15px] font-extrabold">{T("finished")}</h3>
          {assess || !rep ? <p className="m-0 text-[13.5px]">{T("words", { n: nf(wordCount(text)) })}</p> : (
            <ul className="m-0 grid gap-1 ps-5 text-[13.5px]">
              <li>{T("summary", { words: nf(rep.words), sentences: nf(rep.sentences), paragraphs: nf(rep.paragraphs), avg: nf(rep.avgSentenceLength) })}</li>
              {rep.variety.tips.map((tip) => <li key={tip}>{tipText(tr, tip, nf)}</li>)}
              {rep.openers.tip && <li>{tipText(tr, rep.openers.tip, nf)}</li>}
              {rep.repeated.length > 0 && <li>{T("repeatedShort", { list: rep.repeated.slice(0, 5).map((r) => `${r.word} (${nf(r.count)})`).join(", ") })}</li>}
              <li>{T("readingTime", { label: readingText(tr, rep.reading, nf) })}</li>
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
