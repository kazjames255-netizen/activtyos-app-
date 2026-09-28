"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudio, type GameAudio } from "./engine/audio";
import { Game, type Hud } from "./engine/game";
import type { Gate, Result, SimEvent } from "./core";
import type { Backend, Finished, StartOpts, Started } from "./store";

// TURBO SLIDE - a highway reskin of the exact same server-authoritative fact-fluency engine as Penguin Slide (see
// ../penguin/PenguinJourney.tsx and docs/games-prototypes/BACKEND-PATTERN.md). No map / bosses / cosmetics economy
// yet (scoped down from the original graphics prototype, docs/games-prototypes/GRAPHICS-SCENES.md) - just real,
// server-scored practice: pick a run, steer or tap into the correct lane, get a real result back.
export interface TurboSlideProps {
  backend: Backend;
  support?: { calm?: boolean; noTimer?: boolean };
  onExit?: () => void;
  /** A level chosen upstream (GamesPanel.tsx's level picker, defaulted from the child's year group): which
   *  times-tables this run asks from — same `tables` field the server already accepts on POST /games/sessions.
   *  Undefined = Pip's own weakest-first pick (unchanged default). */
  startTables?: number[];
  /** Set (and changed to a new value) when the shell wants a mid-run left saved and this panel torn down - see
   *  GamesPanel.tsx's GameRunner. Ignored while nothing is playing. */
  exitToken?: number;
  /** True when the shell already knows this child has a run to pick back up in Turbo Slide: skip the title and go
   *  straight into resuming it. */
  resume?: boolean;
}
type Screen = "title" | "starting" | "playing" | "finishing" | "summary";
const MODES: { id: StartOpts["mode"]; label: string; blurb: string }[] = [
  { id: "solo", label: "Endless Run", blurb: "12 questions, Pip's picks (weakest facts first)" },
  { id: "quick", label: "Quick Blitz", blurb: "A short 6-question sprint" },
  { id: "daily", label: "Daily Run", blurb: "One shared run for today" },
  { id: "calm", label: "Calm Cruise", blurb: "No pressure, no wrong-answer effects" },
];

export default function TurboSlide({ backend, support, onExit, startTables, exitToken, resume }: TurboSlideProps) {
  const forcedCalm = !!(support?.calm || support?.noTimer);
  const rootRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null); const audioRef = useRef<GameAudio | null>(null);
  const [screen, setScreen] = useState<Screen>(resume ? "starting" : "title");
  const [hud, setHud] = useState<Hud | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [wrongFact, setWrongFact] = useState<string | null>(null);
  const [error, setError] = useState("");
  const startedRef = useRef<Started | null>(null);
  useEffect(() => { startedRef.current = started; }, [started]);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const H = useRef({ hud: (_h: Hud) => {}, gate: (_g: Gate, _i: number, _n: number) => {}, result: (_r: Result, _s: number) => {}, event: (_e: SimEvent) => {}, done: (_p: { log: [number, number][]; endTick: number }) => {} });

  useEffect(() => {
    const canvas = canvasRef.current, root = rootRef.current; if (!canvas || !root) return;
    const audio = createAudio({ muted: false, volume: 0.6 }); audioRef.current = audio;
    const g = new Game(canvas, root, { calm: false, reduced: false, font: "system-ui, sans-serif", biome: 1, radar: false }, audio, {
      hud: (h) => H.current.hud(h), gate: (a, b, c) => H.current.gate(a, b, c), result: (a, b) => H.current.result(a, b), event: (e) => H.current.event(e), done: (p) => H.current.done(p),
    });
    gameRef.current = g;
    const ro = new ResizeObserver(() => g.resize()); ro.observe(root);
    return () => { ro.disconnect(); g.destroy(); audio.dispose(); gameRef.current = null; audioRef.current = null; };
  }, []);

  const play = useCallback(async (mode: StartOpts["mode"]) => {
    audioRef.current?.resume();
    setScreen("starting"); setError("");
    try {
      const s = await backend.start({ mode: forcedCalm ? "calm" : mode, tables: startTables });
      setStarted(s); setResult(null); setGate(null); setWrongFact(null); setError("");
      gameRef.current?.setOpts({ calm: s.cfg.calm, reduced: s.cfg.calm, biome: 1 });
      gameRef.current?.start(s.seed, s.cfg, s.plan, s.best?.pace ?? []);
      setScreen("playing"); rootRef.current?.focus();
    } catch (e) { setError((e as Error).message || "Could not start - try again"); setScreen("title"); }
  }, [backend, forcedCalm, startTables]);

  // ── resume: the shell (GamesPanel.tsx) already knows there's a run to pick back up - skip the title and go
  // straight to it, server-authoritative (the checkpoint is fetched fresh, never trusted from before). ──────────
  const resumedOnce = useRef(false);
  useEffect(() => {
    if (!resume || resumedOnce.current) return;
    resumedOnce.current = true;
    (async () => {
      audioRef.current?.resume();
      try {
        const r = await backend.resumable();
        if (!r) { setScreen("title"); return; }
        const s = await backend.resume(r.sessionId);
        setStarted(s); setResult(null); setGate(null); setWrongFact(null); setError("");
        gameRef.current?.setOpts({ calm: s.cfg.calm, reduced: s.cfg.calm, biome: 1 });
        gameRef.current?.resume(s.seed, s.cfg, s.plan, s.checkpoint.log, s.checkpoint.endTick, s.best?.pace ?? []);
        setScreen("playing"); rootRef.current?.focus();
      } catch (e) { setError((e as Error).message || "Could not resume - try again"); setScreen("title"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  // ── "Back to Games" mid-run: the shell bumps `exitToken` instead of tearing this panel down itself, so a run in
  // progress gets one last chance to save a checkpoint first. Fire-and-forget; exit is never blocked on it. ──────
  const lastExit = useRef(0);
  useEffect(() => {
    if (exitToken === undefined || exitToken === lastExit.current) return;
    lastExit.current = exitToken;
    const s = startedRef.current;
    if (s && screen === "playing") {
      const snap = gameRef.current?.snapshot();
      if (snap && snap.log.length) void backend.checkpoint(s.sessionId, snap.log, snap.endTick).catch(() => { /* best effort */ });
    }
    onExit?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitToken]);

  useEffect(() => {
    H.current.hud = setHud;
    H.current.gate = (g) => { setGate(g); setWrongFact(null); if (wrongTimer.current) clearTimeout(wrongTimer.current); };
    H.current.result = (r) => {
      if (!r.correct && !r.miss) { setWrongFact(`${r.shown} = ${r.answer}`); if (wrongTimer.current) clearTimeout(wrongTimer.current); wrongTimer.current = setTimeout(() => setWrongFact(null), 2400); }
    };
    H.current.event = () => {};
    H.current.done = async ({ log, endTick }) => {
      const s = startedRef.current; if (!s) return;
      setScreen("finishing"); setGate(null);
      try {
        const r = await backend.finish(s, log, endTick);
        setResult(r); setScreen("summary");
        audioRef.current?.finish(!!r.newBest);
      } catch (e) { setError((e as Error).message || "Could not save this run - try again"); setScreen("title"); }
    };
  });

  const onPointerDown = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest("button")) return; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); gameRef.current?.pointerDown(e.clientX); };
  const onPointerMove = (e: React.PointerEvent) => gameRef.current?.pointerMove(e.clientX);
  const onPointerUp = () => gameRef.current?.pointerUp();
  const question = useMemo(() => gate ? (gate.op === "x" ? `${gate.shownA} × ${gate.shownB}` : gate.op === "d" ? `${gate.shownA} ÷ ${gate.shownB}` : `? × ${gate.shownA} = ${gate.shownB}`) : "", [gate]);
  const lanes = gate?.opts.length ?? started?.cfg.lanes ?? 3;

  return (
    <div ref={rootRef} className="turbo-root" tabIndex={-1} data-testid="turbo-slide" data-screen={screen}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="turbo-canvas" aria-hidden="true" data-testid="turbo-canvas" />

      {screen === "title" && (
        <div className="turbo-panel" data-testid="turbo-title">
          <h1 className="turbo-h1">Turbo Slide</h1>
          <p className="turbo-tag">Steer into the right answer - the same times-tables practice as Penguin Slide, on the highway.</p>
          {error && <p className="turbo-err" role="alert">{error}</p>}
          <div className="turbo-modes">
            {MODES.map((m) => (
              <button key={m.id} type="button" className="turbo-btn" data-testid={`turbo-mode-${m.id}`} onClick={() => void play(m.id)}>
                <b>{m.label}</b><small>{m.blurb}</small>
              </button>
            ))}
          </div>
          {onExit && <button type="button" className="turbo-link" onClick={onExit}>Done</button>}
        </div>
      )}

      {screen === "starting" && <div className="turbo-panel" data-testid="turbo-starting"><p>Starting...</p></div>}

      {(screen === "playing" || screen === "finishing") && (
        <div className="turbo-hud" aria-live="off">
          <div className="turbo-top">
            <span className="turbo-score" data-testid="turbo-score">{hud?.fish ?? 0}</span>
            <span className="turbo-streak">{hud && hud.streak > 1 ? `x${hud.mult} streak ${hud.streak}` : ""}</span>
            <button type="button" className="turbo-icon" aria-label="Finish now" onClick={() => gameRef.current?.finishNow()} data-testid="turbo-finish-now">✕</button>
          </div>
          {gate && (
            <div className="turbo-q" data-testid="turbo-question">
              <div className="turbo-qtext">{question} = ?</div>
              <div className="turbo-lanes">
                {Array.from({ length: lanes }, (_, lane) => {
                  const v = gate.opts[gate.perm[lane]!];
                  return (
                    <button key={lane} type="button" disabled={v === null} className="turbo-lane" data-testid={`turbo-lane-${lane}`}
                      onClick={() => gameRef.current?.chooseLane(lane)}>{v === null ? "" : v}</button>
                  );
                })}
              </div>
            </div>
          )}
          {wrongFact && <div className="turbo-fact" role="status">{wrongFact}</div>}
        </div>
      )}

      {screen === "summary" && result && (
        <div className="turbo-panel" data-testid="turbo-summary">
          <h2 className="turbo-h2">{summaryStars(result) >= 2 ? "Great run!" : "Run complete"}</h2>
          <div className="turbo-stars" aria-hidden>{"★★★".slice(0, summaryStars(result))}{"☆☆☆".slice(0, 3 - summaryStars(result))}</div>
          <div className="turbo-bigscore" data-testid="turbo-result-score">{result.fish}</div>
          <p className="turbo-info">{result.firstTryCorrect} / {result.firstTry} correct on the first try{result.newBest ? " - new best!" : ""}</p>
          <div className="turbo-modes">
            <button type="button" className="turbo-btn turbo-btn-gold" data-testid="turbo-play-again" onClick={() => void play(started?.cfg.mode ?? "solo")}><b>Play again</b></button>
            {onExit && <button type="button" className="turbo-btn" data-testid="turbo-done" onClick={onExit}><b>Done</b></button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Free-play modes have no journey `stage`, so RunResult carries no `stars` field - approximate one from accuracy
 *  for the summary screen only (the server's own scoring - fish/correct/firstTry - is what actually gets recorded). */
function summaryStars(r: Finished): 0 | 1 | 2 | 3 { if (!r.answered) return 0; const acc = r.correct / r.answered; return acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1; }

const CSS = `
.turbo-root{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden;background:#0b1440;color:#f4f8ff;font-family:system-ui,sans-serif;touch-action:none;user-select:none}
.turbo-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.turbo-panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:linear-gradient(rgba(6,10,40,.55),rgba(6,10,40,.75))}
.turbo-h1{font-size:clamp(34px,9vw,56px);margin:0;font-weight:900;letter-spacing:.01em}
.turbo-h2{font-size:28px;margin:0;font-weight:900}
.turbo-tag{max-width:38ch;opacity:.85;margin:0 0 6px}
.turbo-err{color:#ff8a97;font-weight:700}
.turbo-modes{display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:10px;width:100%;max-width:420px}
.turbo-btn{border:0;border-radius:16px;background:linear-gradient(#6f8dff,#2a4bd7 70%);color:#fff;padding:12px 10px;font-size:15px;min-height:64px;cursor:pointer;box-shadow:0 5px 0 #12206b;display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center}
.turbo-btn small{font-size:11px;opacity:.85;font-weight:600}
.turbo-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #12206b}
.turbo-btn-gold{background:linear-gradient(#fff0a0,#ffc933 65%);color:#2a1a00;box-shadow:0 5px 0 #a3720a}
.turbo-link{background:none;border:0;color:#fff;opacity:.8;text-decoration:underline;font-weight:700;cursor:pointer;min-height:40px}
.turbo-hud{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;padding:12px 14px 0}
.turbo-top{display:flex;align-items:center;gap:10px}
.turbo-score{font-size:28px;font-weight:900;font-variant-numeric:tabular-nums}
.turbo-streak{font-size:13px;font-weight:800;color:#ffc933;flex:1}
.turbo-icon{pointer-events:auto;border:0;background:rgba(12,20,80,.5);color:#fff;border-radius:10px;width:36px;height:36px;font-size:16px;cursor:pointer}
.turbo-q{margin:10px auto 0;max-width:520px;text-align:center;background:linear-gradient(#1b2a86ee,#111b60ee);border:3px solid #14163a;border-radius:18px;padding:10px 14px}
.turbo-qtext{font-size:30px;font-weight:900}
.turbo-lanes{display:flex;gap:8px;justify-content:center;margin-top:8px}
.turbo-lane{pointer-events:auto;flex:1;max-width:110px;min-height:52px;border-radius:12px;border:0;background:#2f45d8;color:#fff;font-size:20px;font-weight:900;cursor:pointer}
.turbo-lane:disabled{visibility:hidden}
.turbo-fact{position:absolute;left:0;right:0;top:58%;margin:0 auto;text-align:center;font-size:16px;font-weight:800;background:#ff5a6acc;border-radius:12px;padding:4px 12px;width:fit-content}
.turbo-stars{font-size:34px;color:#ffc933}
.turbo-bigscore{font-size:56px;font-weight:900;color:#ffc933}
.turbo-info{opacity:.9}
`;
