"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MtcAnswer, MtcItem } from "./mtc";
import type { Backend, MtcFinished, MtcStarted } from "./store";
import { speak } from "./ui/speak";
import type { GameAudio } from "./engine/audio";

type TT = (k: string, v?: Record<string, string | number>) => string;
type TP = (base: string, n: number, v?: Record<string, string | number>) => string;

/** "MTC practice": mimics the official Year 4 Multiplication Tables Check (25 questions, 6 s each, ~3 s pause, 3 practice first, typed answers). It is PRACTICE:
 *  no pass mark, never called a test result or a diagnosis, kept out of the fun run, and gently limited to about once a week. No extra answer time inside it
 *  (as the real check), but a child can hide the countdown, use audio, and there is no penalty for timing out beyond the missed mark. */
export function MtcPractice({ backend, T, TP, calm, onClose, locale, audio }: { backend: Backend; T: TT; TP: TP; calm: boolean; onClose: () => void; locale: string; audio: GameAudio | null }) {
  const [phase, setPhase] = useState<"intro" | "practice" | "run" | "pause" | "done" | "saving">("intro");
  const [info, setInfo] = useState<MtcStarted | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [msLeft, setMsLeft] = useState(6000);
  const [hide, setHide] = useState(calm);
  const [result, setResult] = useState<MtcFinished | null>(null);
  const [err, setErr] = useState("");
  const answers = useRef<MtcAnswer[]>([]);
  const t0 = useRef(0);
  const typedRef = useRef(""); typedRef.current = typed;
  const items: MtcItem[] = phase === "practice" ? info?.practice ?? [] : info?.form ?? [];
  const cur = items[idx];
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, [phase]);

  const begin = async (practice: boolean) => {
    audio?.resume();
    try { const s = info ?? (await backend.startMtc()); setInfo(s); answers.current = []; setIdx(0); setTyped(""); setPhase(practice ? "practice" : "run"); } catch (e) { setErr((e as Error).message); }
  };
  const next = useCallback((entered: MtcAnswer | null) => {
    const practice = phase === "practice";
    if (entered && !practice) answers.current.push(entered);
    const last = idx + 1 >= items.length;
    if (last) {
      if (practice) { setPhase("intro"); setIdx(0); return; }
      setPhase("saving");
      void backend.finishMtc(info!, answers.current).then((r) => { setResult(r); setPhase("done"); }).catch((e: Error) => { setErr(e.message); setPhase("intro"); });
      return;
    }
    setPhase("pause");
    setTimeout(() => { setIdx((i) => i + 1); setTyped(""); setPhase(practice ? "practice" : "run"); }, info?.limits.pauseMs ?? 3000);
  }, [phase, idx, items.length, backend, info]);

  // the 6-second clock starts when the question appears
  useEffect(() => {
    if (!(phase === "run" || phase === "practice") || !cur) return;
    t0.current = performance.now(); setMsLeft(info?.limits.answerMs ?? 6000);
    if (!calm) speakSoft();
    const id = setInterval(() => {
      const left = (info?.limits.answerMs ?? 6000) - (performance.now() - t0.current);
      if (left <= 0) { clearInterval(id); const v = typedRef.current === "" ? null : Number(typedRef.current); next({ v, ms: info?.limits.answerMs ?? 6000 }); } else setMsLeft(left);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, cur]);
  function speakSoft() { /* audio question is opt-in via the speaker button */ }

  const submit = useCallback(() => {
    if (!(phase === "run" || phase === "practice")) return;
    const v = typedRef.current === "" ? null : Number(typedRef.current);
    next({ v, ms: Math.round(performance.now() - t0.current) });
  }, [phase, next]);
  const press = useCallback((d: string) => { if (phase !== "run" && phase !== "practice") return; setTyped((s) => (s.length >= 3 ? s : s + d)); }, [phase]);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (phase !== "run" && phase !== "practice") return;
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); } else if (e.key === "Backspace") { setTyped((s) => s.slice(0, -1)); e.preventDefault(); } else if (e.key === "Enter") { submit(); e.preventDefault(); }
    };
    window.addEventListener("keydown", kd); return () => window.removeEventListener("keydown", kd);
  }, [phase, press, submit]);

  const q = cur ? `${cur.a} × ${cur.b}` : "";
  const pct = Math.max(0, Math.min(1, msLeft / (info?.limits.answerMs ?? 6000)));
  const playing = phase === "run" || phase === "practice";
  return (
    <div className="ps-over" data-nokeys data-testid="ps-mtc" style={{ background: "linear-gradient(180deg,#0e1650,#26357f)" }}>
      <div className="ps-card ps-fadein" style={{ textAlign: "center" }}>
        {phase === "intro" && (
          <>
            <h2 ref={head} tabIndex={-1} style={{ outline: "none" }}>{T("mtc_title")}</h2>
            <p>{T("mtc_sub")}</p>
            <p className="ps-help">{T("mtc_no_pass")}</p>
            {(info?.mtcThisWeek ?? 0) > 0 && <p className="ps-help" data-testid="ps-mtc-weekly">{T("mtc_weekly")}</p>}
            {err && <p role="alert" style={{ color: "#b23a3a", fontWeight: 700 }}>{err}</p>}
            <div className="ps-row"><button className="ps-chip" type="button" onClick={() => void begin(true)} data-testid="ps-mtc-try">{T("mtc_try")}</button><button className="ps-btn ps-big" style={{ minHeight: 64, fontSize: 22 }} type="button" onClick={() => void begin(false)} data-testid="ps-mtc-start">{T("mtc_start")}</button></div>
            <div className="ps-row"><button className="ps-chip" type="button" aria-pressed={hide} onClick={() => setHide((h) => !h)}>{T("mtc_hide_timer")}</button><button className="ps-link" type="button" onClick={onClose}>{T("back")}</button></div>
          </>
        )}
        {playing && cur && (
          <>
            <p className="ps-help" style={{ margin: 0 }}>{phase === "practice" ? T("mtc_try_label", { n: idx + 1, total: 3 }) : T("mtc_q", { n: idx + 1, total: info?.limits.n ?? 25 })}</p>
            {!hide && <div aria-hidden="true" style={{ height: 8, borderRadius: 6, background: "#dbe6fb", margin: "8px 0", overflow: "hidden" }}><div style={{ width: `${pct * 100}%`, height: "100%", background: "linear-gradient(90deg,#3b57d6,#9b7bff)", transition: "width .1s linear" }} /></div>}
            <div className="ps-big-num" style={{ fontSize: "clamp(44px,9vw,84px)", color: "#1b2350" }} data-testid="ps-mtc-q" role="status" aria-live="polite"><bdi dir="ltr">{q} = </bdi><bdi dir="ltr" data-testid="ps-mtc-typed">{typed || "?"}</bdi></div>
            <button className="ps-chip" type="button" onClick={() => speak(T("say_x", { a: cur.a, b: cur.b }), locale)} aria-label={T("read_question")}>{T("read_question")}</button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(64px, 84px))", gap: 8, justifyContent: "center", marginTop: 12 }} role="group" aria-label={T("numpad")}>
              {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((d) => <button key={d} className="ps-pad" style={{ minHeight: 64 }} type="button" onClick={() => press(d)}>{d}</button>)}
              <button className="ps-pad" style={{ minHeight: 64, fontSize: 20 }} type="button" onClick={() => setTyped((s) => s.slice(0, -1))} aria-label={T("delete")}>&#9003;</button>
              <button className="ps-pad" style={{ minHeight: 64 }} type="button" onClick={() => press("0")}>0</button>
              <button className="ps-pad" style={{ minHeight: 64, fontSize: 20, background: "linear-gradient(180deg,#ffe58a,#ffce4a)" }} type="button" onClick={submit} data-testid="ps-mtc-enter">{T("enter")}</button>
            </div>
          </>
        )}
        {phase === "pause" && <div style={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true"><div className="ps-breath" /></div>}
        {phase === "saving" && <p>&hellip;</p>}
        {phase === "done" && result && (
          <div data-testid="ps-mtc-result">
            <h2 ref={head} tabIndex={-1} style={{ outline: "none" }}>{T("mtc_done_title")}</h2>
            <p className="ps-big-num" data-testid="ps-mtc-score">{T("mtc_score", { score: result.score, total: result.total })}</p>
            <p className="ps-help">{T("mtc_note")}</p>
            {result.missed.length > 0 && <ul className="ps-list" style={{ textAlign: "start" }}>{result.missed.slice(0, 8).map((m, i) => <li key={i}><bdi dir="ltr">{m.a} &times; {m.b} = {m.a * m.b}</bdi> &middot; {m.kind === "timeout" ? T("mtc_timedout") : T("mtc_wrong", { n: m.entered ?? 0 })}</li>)}</ul>}
            <div className="ps-row"><button className="ps-btn ps-big" style={{ minHeight: 60, fontSize: 22 }} type="button" onClick={onClose}>{T("back")}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
