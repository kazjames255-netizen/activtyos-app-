"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { Answer, ItemOut } from "./core";
import type { Backend, Finished, Started } from "./store";

// Shared play surface for the applied-maths cluster (Market Day, Bake Off Blitz, Rhythm Reef). Untimed per-question
// (content rule: no time pressure on the THINKING part of a question) — a game's own theme supplies only a cosmetic
// scene, never a countdown that forces a miss. The server issues the form and marks it; this component only ever
// shows the server's own result, never a locally-computed score.
export interface Theme {
  title: string;
  frameEmoji: string;
  accent: string; // a CSS color, never green (content rule: no green as a persistent brand colour)
  introBody: string;
  scene: (phase: "intro" | "playing" | "done", index: number, total: number) => React.ReactNode;
  prompt: (item: ItemOut) => { headline: React.ReactNode; detail?: React.ReactNode };
  unitLabel?: (item: ItemOut) => string | null;
  /** Convert the raw text box value into the answer space the item's `answer` key lives in (e.g. pounds typed -> pence stored). Default: parse as a plain number. */
  parseValue?: (item: ItemOut, raw: string) => number | string | null;
}

export function AppliedGameUI({ backend, theme, onExit, resume, exitToken }: { backend: Backend; theme: Theme; onExit: () => void; resume?: boolean; exitToken?: number }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">(resume ? "saving" : "intro");
  const [info, setInfo] = useState<Started | null>(null);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Finished | null>(null);
  const [err, setErr] = useState("");
  const answers = useRef<Answer[]>([]);
  const t0 = useRef(0);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headRef.current?.focus(); }, [phase]);

  const item = info?.items[idx];
  const isChoice = !!item?.choices?.length;

  const begin = async () => {
    try {
      const s = await backend.start();
      setInfo(s); answers.current = []; setIdx(0); setValue(""); setErr("");
      setPhase("playing"); t0.current = performance.now();
    } catch (e) { setErr((e as Error).message); }
  };

  // Resume: the shell (GamesPanel.tsx) already knows there's a run to pick back up in this game (a real "Continue",
  // not a guess) - fetch the server-held checkpoint fresh (never trusted from before) and jump straight past intro
  // to the first unanswered item.
  const resumedOnce = useRef(false);
  useEffect(() => {
    if (!resume || resumedOnce.current) return;
    resumedOnce.current = true;
    void (async () => {
      try {
        const r = await backend.resumable();
        if (!r) { setPhase("intro"); return; }
        const s = await backend.resume(r.sessionId);
        setInfo(s); answers.current = [...s.checkpoint.answers]; setIdx(s.checkpoint.answers.length); setValue("");
        setPhase(s.checkpoint.answers.length >= s.items.length ? "intro" : "playing"); t0.current = performance.now();
      } catch { setPhase("intro"); } // couldn't resume (expired / already finished) - a fresh Play is always safe
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  // A run in progress gets one last chance to save a checkpoint before "Back to Games" exits it. Fire-and-forget by
  // design: a failed save just means "Play" instead of "Continue" next time, never a scoring risk, and exiting
  // itself is never blocked on it. Nothing NEW is trusted on resume: it is exactly this answers-so-far array,
  // re-validated server-side against the items the server itself issued at start.
  const infoRef = useRef(info); infoRef.current = info;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const saveCheckpoint = () => {
    const s = infoRef.current;
    if (s && phaseRef.current === "playing" && answers.current.length > 0 && answers.current.length < s.items.length) {
      void backend.checkpoint(s.sessionId, answers.current).catch(() => { /* best effort */ });
    }
  };
  // Path 1: the shell (GamesPanel.tsx) bumps `exitToken` instead of tearing this panel down itself - same mechanism
  // as features/learninghub/games/penguin/PenguinJourney.tsx, so the shared "Back to Games" header button behaves
  // identically for every game that uses it.
  const lastExit = useRef(0);
  useEffect(() => {
    if (exitToken === undefined || exitToken === lastExit.current) return;
    lastExit.current = exitToken;
    saveCheckpoint();
    onExit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitToken]);
  // Path 2: a plain unmount (no exitToken plumbed in, e.g. a future embed, or navigating off the whole hub page)
  // still gets the same one last save, belt-and-braces.
  useEffect(() => () => saveCheckpoint(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backend]);

  const submitValue = (raw: string | number) => {
    if (!item || !info) return;
    const ms = Math.round(performance.now() - t0.current);
    let v: string | number | null;
    if (typeof raw === "number") v = raw;
    else if (theme.parseValue) v = theme.parseValue(item, raw);
    else {
      const trimmed = raw.trim();
      if (trimmed === "") v = null;
      else {
        const n = Number(trimmed);
        v = Number.isFinite(n) ? n : trimmed;
      }
    }
    answers.current.push({ id: item.id, value: v, ms });
    const last = idx + 1 >= info.items.length;
    if (last) {
      setPhase("saving");
      void backend.finish(info, answers.current)
        .then((r) => { setResult(r); setPhase("done"); })
        .catch((e: Error) => { setErr(e.message); setPhase("playing"); });
      return;
    }
    setIdx((i) => i + 1); setValue(""); t0.current = performance.now();
  };

  const total = info?.items.length ?? 0;
  const unit = item && theme.unitLabel ? theme.unitLabel(item) : null;
  const p = item ? theme.prompt(item) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${theme.accent} 14%, var(--surface)), var(--surface))` }} data-testid={`applied-${theme.title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-extrabold text-[var(--ink)]"><span aria-hidden="true">{theme.frameEmoji}</span>{theme.title}</span>
        {phase === "playing" && <span className="text-[12px] font-bold text-[var(--ink-3)]" data-testid="applied-progress">{idx + 1} / {total}</span>}
      </div>

      <div className="mb-4 flex h-24 items-center justify-center rounded-2xl text-[34px]" aria-hidden="true" style={{ background: `color-mix(in srgb, ${theme.accent} 16%, var(--panel))` }}>
        {theme.scene(phase === "saving" ? "playing" : phase, idx, total)}
      </div>

      {err && <p role="alert" className="mb-3 text-[13px] font-bold" style={{ color: "#b23a3a" }}>{err}</p>}

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h2 ref={headRef} tabIndex={-1} className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={{ outline: "none" }}>{theme.title}</h2>
          <p className="m-0 max-w-sm text-[13px] font-semibold text-[var(--ink-2)]">{theme.introBody}</p>
          {info?.best && <p className="m-0 text-[12px] font-bold text-[var(--ink-3)]">Best so far: {info.best.score}/{info.best.total}</p>}
          <Button variant="solid" className="!min-h-[48px] !px-6" onClick={() => void begin()} data-testid="applied-start">Play</Button>
          <button type="button" onClick={onExit} className="text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)]">Back to Games</button>
        </div>
      )}

      {phase === "playing" && item && p && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-testid="applied-question">
          <p className="m-0 text-[16px] font-extrabold text-[var(--ink)]" data-testid="applied-headline">{p.headline}</p>
          {p.detail && <div className="text-[13px] font-semibold text-[var(--ink-2)]" data-testid="applied-detail">{p.detail}</div>}
          {isChoice ? (
            <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Choices">
              {item.choices!.map((c) => (
                <button key={c.id} type="button" onClick={() => submitValue(c.id)} data-testid={`applied-choice-${c.id}`}
                  className="min-h-[52px] min-w-[52px] rounded-2xl border-2 px-4 text-[20px] font-extrabold"
                  style={{ borderColor: theme.accent, background: "var(--surface)", color: "var(--ink)" }}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submitValue(value); }}>
              <input
                type="text" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
                data-testid="applied-input" aria-label="Your answer"
                className="w-32 rounded-xl border-2 px-3 py-2 text-center text-[22px] font-extrabold text-[var(--ink)]"
                style={{ borderColor: theme.accent, background: "var(--surface)" }}
              />
              {unit && <span className="text-[15px] font-bold text-[var(--ink-2)]">{unit}</span>}
              <Button type="submit" variant="solid" className="!min-h-[48px]" data-testid="applied-submit">Enter</Button>
            </form>
          )}
        </div>
      )}

      {phase === "saving" && <div className="flex flex-1 items-center justify-center text-[14px] font-bold text-[var(--ink-2)]">{info ? "Marking…" : "Loading…"}</div>}

      {phase === "done" && result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center" data-testid="applied-result">
          <h2 ref={headRef} tabIndex={-1} className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={{ outline: "none" }}>Done!</h2>
          <p className="m-0 text-[30px] font-extrabold text-[var(--ink)]" data-testid="applied-score">{result.score} / {result.total}</p>
          {result.newBest && <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide" style={{ color: theme.accent }}>New personal best!</p>}
          {result.xpGained > 0 && <p className="m-0 text-[12px] font-bold text-[var(--ink-3)]">+{result.xpGained} XP today</p>}
          <ResultBreakdown rows={result.rows} unitLabel={theme.unitLabel} />
          <div className="flex gap-2">
            <Button variant="solid" className="!min-h-[48px]" onClick={() => void begin()} data-testid="applied-again">Play again</Button>
            <Button variant="ghost" className="!min-h-[48px]" onClick={onExit} data-testid="applied-exit">Back to Games</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBreakdown({ rows }: { rows: Finished["rows"]; unitLabel?: (item: ItemOut) => string | null }) {
  const wrong = rows.filter((r) => !r.correct);
  if (!wrong.length) return <p className="m-0 text-[12px] font-bold text-[var(--ink-3)]">Every answer correct.</p>;
  return (
    <ul className="m-0 list-none p-0 text-start text-[12px] font-semibold text-[var(--ink-2)]">
      {wrong.slice(0, 6).map((r) => (
        <li key={r.id}>Q: answer was <bdi dir="ltr">{String(r.answer)}</bdi>{r.given !== null ? <> (you said <bdi dir="ltr">{String(r.given)}</bdi>)</> : " (no answer)"}</li>
      ))}
    </ul>
  );
}
