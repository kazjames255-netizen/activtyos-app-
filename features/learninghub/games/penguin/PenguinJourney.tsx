"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_TITLE, JUICE, lookOf } from "./theme";
import { COSMETICS, STAGES, POLICY, biomeOf, isDeviceCos, stageById, type StageDef } from "./config";
import { journeyView } from "./journey";
import { replay, type Gate, type Result, type SimEvent } from "./core";
import { applyArcade, newArcade, tally, type ArcadeState } from "./arcade";
import { loadHighScores, saveHighScore, type HighScore } from "./arcadeLocal";
import { createAudio, type GameAudio } from "./engine/audio";
import { Game, type Hud } from "./engine/game";
import { HOST_NAME, HostAvatar, HostSkin } from "./characters/host";
import type { Backend, Finished, JourneyOverview, LightFact, Started, StartOpts } from "./store";
import { CSS } from "./ui/styles";
import { IconFish, IconGear, IconHint, IconPause, IconPlay, IconShield, IconSound, IconSpeak, IconStar } from "./ui/icons";
import { usePrefs, useReducedMotion, type Prefs } from "./ui/prefs";
import { useGameT, type TT } from "./ui/tt";
import { speak } from "./ui/speak";
import { IceMap } from "./ui/IceMap";
import { JourneyMap } from "./ui/JourneyMap";
import { StageCard } from "./ui/StageCard";
import { Chapter } from "./ui/Chapter";
import { StageSummary } from "./ui/StageSummary";
import { ArcadeHud, ArcadeSummary } from "./ui/ArcadeUI";
import { Wardrobe, equippedIds } from "./ui/Wardrobe";
import { Village } from "./ui/Village";
import { FINALE, PROLOGUE, StoryScene, type Panel } from "./ui/StoryScene";
import { MtcPractice } from "./MtcPractice";

// PENGUIN SLIDE - THE JOURNEY. Five biomes of four stages: a map, a new world (sky, ground, weather, music, gates) and a new mechanic in each, a boss at the end of every biome.
// Stages open by MASTERY (2 stars = >= 80% right first time), never by time; stars are for accuracy and playing without helpers, never speed. The deterministic core (core.ts) is
// shared with the server, which re-simulates every finished run from its seed + the input log and awards the stars itself.
export interface PenguinSlideProps {
  backend: Backend;
  /** The child's support profile (features/learninghub/support.ts): calm / noTimer force the Calm variant; readAloudDefault offers reading. */
  support?: { calm?: boolean; noTimer?: boolean; readAloudDefault?: boolean; textSize?: string };
  onExit?: () => void;
  mtc?: boolean;
  /** Demo / dev: open every stage from the start (a tutor can do the same for a real child). */
  unlockAll?: boolean;
  /** A level chosen upstream (e.g. GamesPanel.tsx's level picker, defaulted from the child's year group): which
   *  times-tables Free play / Quick play / Daily ask from, same `tables` field the server already accepts on
   *  POST /games/sessions (server/src/lib/hubGames.ts). Journey/stage mode is unaffected — a stage's own tables
   *  (config.ts STAGES) always win; this only fills in when a run doesn't name a stage. Undefined = Pip's own
   *  weakest-first pick (unchanged default). */
  startTables?: number[];
  /** Set (and changed to a new value) when the shell wants this run left mid-way saved and the panel torn down -
   *  see GamesPanel.tsx's GameRunner. Ignored while nothing is playing. */
  exitToken?: number;
  /** True when the shell already knows (GamesPanel.tsx's own resumable check) this child has a run to pick back up
   *  in THIS game: skip the map and go straight into resuming it, rather than a fresh `start()`. */
  resume?: boolean;
}
type Screen = "map" | "story" | "village" | "chapter" | "stage" | "starting" | "playing" | "finishing" | "summary" | "wardrobe" | "icemap" | "mtc" | "settings";
const DEBUG = process.env.NODE_ENV !== "production" && typeof location !== "undefined" && new URLSearchParams(location.search).has("debugAnswers");

export default function PenguinJourney({ backend, support, onExit, mtc = true, unlockAll = false, startTables, exitToken, resume }: PenguinSlideProps) {
  const [prefs, setPrefs] = usePrefs();
  const { T, TP, locale } = useGameT(prefs.skin);
  const reducedPref = useReducedMotion(prefs.motion);
  const forcedCalm = !!(support?.calm || support?.noTimer);

  const rootRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null); const audioRef = useRef<GameAudio | null>(null);
  const [screen, setScreen] = useState<Screen>(resume ? "starting" : "map");
  const [hud, setHud] = useState<Hud | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [info, setInfo] = useState<JourneyOverview | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [fb, setFb] = useState<{ kind: "ok" | "wrong" | "miss"; r: Result; streak: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState(""); const [error, setError] = useState("");
  // one short world message at a time (the Serpent's shield, the Yeti's aimed throw, a friend's save): shown ~2.6 s under the question and announced
  const [toast, setToast] = useState(""); const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((m: string) => { setToast(m); setLive(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2600); }, []);
  const [soundOn, setSoundOn] = useState(true);
  const [facts, setFacts] = useState<LightFact[]>([]);
  const [runs, setRuns] = useState(0);
  const [stage, setStage] = useState<StageDef | null>(null);
  const [chapterFor, setChapterFor] = useState<StageDef | null>(null);
  const [story, setStory] = useState<{ panels: Panel[]; then: () => void } | null>(null);
  const sessionStart = useRef(0); const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOpts = useRef<StartOpts>({ mode: "solo" });
  // ARCADE (arcade.ts): the live tally the HUD draws and that ends the run at Game Over. The server folds the same rules over its own re-simulation - this is display + the stop.
  const [arc, setArc] = useState<ArcadeState | null>(null); const arcRef = useRef<ArcadeState | null>(null); const overTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [high, setHigh] = useState<HighScore[]>([]);
  useEffect(() => { setHigh(loadHighScores()); }, []);
  const startedRef = useRef<Started | null>(null); startedRef.current = started;

  const calmRun = !!started?.cfg.calm;
  const reduced = reducedPref || calmRun || forcedCalm;
  const view = useMemo(() => journeyView(info?.journey.stars ?? {}, info?.journey.unlockAll ?? false), [info]);
  // earned by mastery (the server lists these) + bought with fish + earned on this device (friends freed, buildings built)
  const unlocked = useMemo(() => [...(info?.unlocks.cosmetics ?? ["cap", "snow", "nosled", "noback"]), ...prefs.bought, ...COSMETICS.filter((c) => isDeviceCos(c) && c.unlock.fish === undefined && (c.unlock.friends === undefined || prefs.friends.length >= c.unlock.friends) && (c.unlock.built === undefined || prefs.village.length >= c.unlock.built)).map((c) => c.id)], [info, prefs.bought, prefs.friends.length, prefs.village.length]);
  const fishBal = Math.max(0, (info?.fishTotal ?? 0) - prefs.spent);
  const curBiome = started && screen !== "map" ? started.cfg.biome : (view.stages.find((s) => s.status === "open")?.def.biome ?? 1);
  const worn = useMemo(() => [...equippedIds(prefs.equip, unlocked), `outfit_${biomeOf(curBiome).id}`, ...(started?.cfg.mod === "sparkle" ? ["sparkle"] : [])], [prefs.equip, unlocked.join(","), curBiome, started?.cfg.mod]); // eslint-disable-line react-hooks/exhaustive-deps

  const H = useRef({ hud: (h: Hud) => {}, gate: (g: Gate, i: number, n: number) => {}, result: (r: Result, s: number) => {}, event: (e: SimEvent) => {}, done: (p: { log: [number, number][]; endTick: number }) => {} });
  const refresh = useCallback(async () => { try { const j = await backend.journey(); setInfo(j); setFacts(j.facts); } catch { /* offline: keep what we have */ } }, [backend]);
  useEffect(() => { void refresh(); }, [refresh]);

  // ── boot the canvas game once ─────────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current, root = rootRef.current; if (!canvas || !root) return;
    const audio = createAudio({ muted: false, volume: 0.6 }); audioRef.current = audio;
    const font = getComputedStyle(root).getPropertyValue("--ff-display").trim() || "system-ui, sans-serif";
    const g = new Game(canvas, root, { calm: false, reduced: false, font, cosmetics: [], biome: 1, skin: "junior", radar: false }, audio, {
      hud: (h) => H.current.hud(h), gate: (a, b, c) => H.current.gate(a, b, c), result: (a, b) => H.current.result(a, b), event: (e) => H.current.event(e), done: (p) => H.current.done(p),
    });
    gameRef.current = g; if (DEBUG) (window as unknown as { __psGame?: unknown }).__psGame = g;
    const ro = new ResizeObserver(() => g.resize()); ro.observe(root);
    return () => { ro.disconnect(); g.destroy(); audio.dispose(); gameRef.current = null; audioRef.current = null; try { speechSynthesis?.cancel(); } catch { /* none */ } };
  }, []);
  useEffect(() => { gameRef.current?.setOpts({ reduced, cosmetics: worn, skin: prefs.skin, biome: curBiome }); }, [reduced, worn, prefs.skin, curBiome]);
  useEffect(() => { const a = audioRef.current; if (!a) return; a.setMuted(!soundOn || prefs.muted); a.setVolume(prefs.volume); }, [soundOn, prefs.muted, prefs.volume]);

  // ── run flow ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const beginRun = useCallback((s: Started, o: StartOpts) => {
    lastOpts.current = o; setStarted(s); setResult(null); setFb(null); setGate(null); setPaused(false); setError("");
    if (overTimer.current) clearTimeout(overTimer.current);
    arcRef.current = s.cfg.arcade ? newArcade(s.cfg.arcade) : null; setArc(arcRef.current);
    if (!sessionStart.current) sessionStart.current = Date.now();
    const calm = s.cfg.calm;
    setSoundOn(!calm && !prefs.muted);
    audioRef.current?.setMood(lookOf(s.cfg.biome).music);
    gameRef.current?.setOpts({ calm, reduced: reducedPref || calm, biome: s.cfg.biome, radar: s.cfg.loadout.includes("radar"), cosmetics: worn, skin: prefs.skin });
    gameRef.current?.start(s.seed, s.cfg, s.plan, s.best?.pace ?? []);
    setScreen("playing"); rootRef.current?.focus();
  }, [prefs.muted, prefs.skin, reducedPref, worn]);

  const play = useCallback(async (o: StartOpts) => {
    audioRef.current?.resume(); // inside the tap: iOS only unlocks audio from a user gesture
    setScreen("starting"); setError("");
    // A stage names its own tables server-side (config.ts STAGES); only a stage-less run (Free play / Quick /
    // Daily / Pit) takes the level chosen upstream.
    const req: StartOpts = o.stageId || o.tables ? o : { ...o, tables: startTables };
    try { beginRun(await backend.start(req), req); } catch (e) { setError((e as Error).message || T("err_start")); setScreen("map"); }
  }, [backend, beginRun, T, startTables]);

  // ── resume: the shell (GamesPanel.tsx) already knows there's a run to pick back up in this game - skip the map
  // and go straight to it, server-authoritative (the checkpoint is fetched fresh, never trusted from before). ────
  const resumedOnce = useRef(false);
  useEffect(() => {
    if (!resume || resumedOnce.current) return;
    resumedOnce.current = true;
    (async () => {
      audioRef.current?.resume();
      try {
        const r = await backend.resumable();
        if (!r) { setScreen("map"); return; } // stale by the time we got here (finished / expired elsewhere) - fall back honestly
        const s = await backend.resume(r.sessionId);
        lastOpts.current = { mode: s.cfg.arcade ? (s.cfg.arcade.kind === "daily" ? "arcade-daily" : s.cfg.arcade.kind === "endless" ? "arcade-endless" : "arcade") : "solo" };
        setStarted(s); setResult(null); setFb(null); setGate(null); setPaused(false); setError("");
        arcRef.current = s.cfg.arcade ? tally(s.cfg.arcade, replay(s.seed, s.cfg, s.plan, s.checkpoint.log, s.checkpoint.endTick).results) : null; setArc(arcRef.current);
        if (!sessionStart.current) sessionStart.current = Date.now();
        const calm = s.cfg.calm;
        setSoundOn(!calm && !prefs.muted);
        audioRef.current?.setMood(lookOf(s.cfg.biome).music);
        gameRef.current?.setOpts({ calm, reduced: reducedPref || calm, biome: s.cfg.biome, radar: s.cfg.loadout.includes("radar"), cosmetics: worn, skin: prefs.skin });
        gameRef.current?.resume(s.seed, s.cfg, s.plan, s.checkpoint.log, s.checkpoint.endTick, s.best?.pace ?? []);
        setScreen("playing"); rootRef.current?.focus();
      } catch (e) { setError((e as Error).message || T("err_start")); setScreen("map"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  // ── "Back to Games" mid-run: the shell bumps `exitToken` (GamesPanel.tsx) instead of tearing this panel down
  // itself, so a run in progress gets one last chance to save a checkpoint before it unmounts. Fire-and-forget by
  // design (a failed save just means "Play" instead of "Continue" next time, never a scoring risk); exit itself is
  // never blocked on it. ──────────────────────────────────────────────────────────────────────────────────────────
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
    H.current.gate = (g, i, n) => {
      setGate(g); setFb(null); if (fbTimer.current) clearTimeout(fbTimer.current);
      const say = g.op === "x" ? T("say_x", { a: g.shownA, b: g.shownB }) : g.op === "d" ? T("say_d", { a: g.shownA, b: g.shownB }) : T("say_m", { a: g.shownA, b: g.shownB });
      setLive(T("sr_question", { n: i + 1, total: n, say, options: g.opts.filter((o) => o !== null).join(", ") }));
      if (prefs.readEvery) speak(say, locale);
    };
    H.current.result = (r, streak) => {
      const kind = r.miss ? "miss" : r.correct ? "ok" : "wrong";
      // the world reacts (a bridge freezes, a sign appears); the only text is the fact after a slip, kept up for ~2.5 s
      setFb(kind === "wrong" ? { kind, r, streak } : null);
      setLive(kind === "ok" ? T("sr_correct", { answer: r.answer }) : kind === "wrong" ? T("sr_detour", { fact: `${r.shown} = ${r.answer}` }) : T("fb_miss"));
      if (fbTimer.current) clearTimeout(fbTimer.current);
      if (kind === "wrong") fbTimer.current = setTimeout(() => setFb(null), 2600);
      const A = startedRef.current?.cfg.arcade;
      if (A && arcRef.current && !arcRef.current.over) {
        const next = applyArcade(arcRef.current, r, A); arcRef.current = next; setArc(next);
        if (next.over) { setLive(T("arc_over_live", { n: next.score })); overTimer.current = setTimeout(() => gameRef.current?.finishNow(), 1300); } // a beat to see the answer, then the run ends
      }
    };
    H.current.event = (e) => {
      if (e.t === "breath") { gameRef.current?.setPaused(true); setPaused(true); setLive(T("breath_title")); }
      else if (e.t === "span" && e.open) setLive(T(["", "sr_bridge", "sr_ramp", "sr_door", "sr_whale", "sr_aurora"][e.biome] ?? "sr_bridge"));
      else if (e.t === "hit" && e.lost > 0) setLive(T("sr_hit"));
      else if (e.t === "ringGate") say(e.open ? T("ring_open") : T("ring_shut"));
      else if (e.t === "throw") say(T("throw_aim"));
      else if (e.t === "friendSave") say(T("friend_saved"));
      else if (e.t === "rescue" && startedRef.current?.cfg.stage && !startedRef.current.cfg.chaser) say(T("sr_rescue"));
      else if (e.t === "phase") setLive(T("sr_boss_phase", { boss: T(`boss_${biomeOf(startedRef.current?.cfg.biome ?? 1).chaser}`) }));
    };
    H.current.done = async ({ log, endTick }) => {
      const s = startedRef.current; if (!s) return;
      setScreen("finishing"); setFb(null); setRuns((n) => n + 1);
      try {
        const r = await backend.finish(s, log, endTick);
        if (r.friend && s.cfg.stage && !(prefs.friends ?? []).includes(s.cfg.stage)) setPrefs({ friends: [...(prefs.friends ?? []), s.cfg.stage] }); // the freed friend moves into the Igloo Village
        if (r.arcade && r.arcade.score > 0) setHigh(saveHighScore({ score: r.arcade.score, kind: r.arcade.kind, at: new Date().toISOString() }));
        setResult(r); setScreen("summary");
        audioRef.current?.finish(r.newBest || (r.stage?.stars ?? 0) >= 2);
        setLive(T("sr_done", { correct: r.firstTryCorrect, answered: r.firstTry }));
        void refresh();
      } catch (e) { setError((e as Error).message || T("err_finish")); setScreen("map"); }
    };
  });

  const openStage = (d: StageDef, storyDone = false) => {
    setStage(d);
    if (!storyDone && !prefs.story.includes("prologue")) { setPrefs({ story: [...prefs.story, "prologue"] }); setStory({ panels: PROLOGUE, then: () => openStage(d, true) }); setScreen("story"); return; }
    const seen = prefs.chapters ?? []; const first = d.idx === 1 && !(info?.journey.stars && Object.keys(info.journey.stars).some((k) => stageById(k)?.biome === d.biome));
    if (first && !seen.includes(d.biome)) { setChapterFor(d); setScreen("chapter"); } else setScreen("stage");
  };
  const startStage = () => { if (stage) void play({ mode: "solo", stageId: stage.id, loadout: prefs.loadout.filter((p) => info?.unlocks.powers.includes(p as never)) }); };
  const finaleDue = !!result?.stage?.cleared && result.stage.id === "b5s4" && !!result.bossDown && !prefs.story.includes("finale");
  // the ending plays once, the first time the last boss is beaten, whichever button leaves the summary (Next, Map or Rest); it is marked seen when it ENDS, and can be watched again from the map
  const runFinale = (after?: () => void) => { setResult(null); setStory({ panels: FINALE, then: () => { if (!prefs.story.includes("finale")) setPrefs({ story: [...prefs.story, "finale"] }); (after ?? (() => setScreen("map")))(); } }); setScreen("story"); };
  const leave = (go: () => void) => (finaleDue ? runFinale(go) : go());
  const nextStageDef = (): StageDef | null => { const i = STAGES.findIndex((s) => s.id === stage?.id); const n = STAGES[i + 1]; return n && info && journeyView({ ...info.journey.stars, ...(result?.stage ? { [result.stage.id]: Math.max(result.stage.best, info.journey.stars[result.stage.id] ?? 0) } : {}) }, info.journey.unlockAll).stages[i + 1]?.status !== "locked" ? n : null; };

  const pauseNow = (p: boolean) => { gameRef.current?.setPaused(p); setPaused(p); if (!p) rootRef.current?.focus(); };
  const speakGate = () => { if (gate) speak(gate.op === "x" ? T("say_x", { a: gate.shownA, b: gate.shownB }) : gate.op === "d" ? T("say_d", { a: gate.shownA, b: gate.shownB }) : T("say_m", { a: gate.shownA, b: gate.shownB }), locale); };
  const onPointerDown = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest("button,[data-nokeys],input,a")) return; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); gameRef.current?.pointerDown(e.clientX); };
  const onPointerMove = (e: React.PointerEvent) => gameRef.current?.pointerMove(e.clientX);
  const onPointerUp = () => gameRef.current?.pointerUp();

  // a lane is picked but not locked: say so (screen readers), and say how to lock it
  const pendingLane = hud?.pending ?? -1;
  useEffect(() => { if (pendingLane >= 0 && gate) { const v = gate.opts[gate.perm[pendingLane]!]; if (v !== null && v !== undefined) setLive(T("sr_selected", { n: v, lane: pendingLane + 1 })); } }, [pendingLane]); // eslint-disable-line react-hooks/exhaustive-deps
  const playing = screen === "playing";
  // the in-world coach: one short line the first time each kind of thing comes up, then never again (a 10-second tutorial by playing, not by reading)
  const coachKind = hud?.windy ? "wind" : hud?.ahead ?? null;
  const coachRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = coachRef.current; const cur = playing && coachKind && !prefs.coached.includes(coachKind) ? coachKind : null;
    if (prev && prev !== cur && !prefs.coached.includes(prev)) setPrefs({ coached: [...prefs.coached, prev] });
    coachRef.current = cur;
  }, [coachKind, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const coachLine = playing && hud && hud.phase !== "approach" && coachKind && !prefs.coached.includes(coachKind) && !hud.tutorial ? T(`coach_${coachKind}`) : "";
  const L = gate?.opts.length ?? started?.cfg.lanes ?? 3;
  const restDue = !!result && (result.softCap || runs >= POLICY.restAfterRuns || Date.now() - sessionStart.current >= JUICE.restAfterMs);
  const sd = started?.cfg.stage ? stageById(started.cfg.stage) : null;
  const q = (g: Gate) => (g.op === "x" ? `${g.shownA} × ${g.shownB} = ?` : g.op === "d" ? `${g.shownA} ÷ ${g.shownB} = ?` : `? × ${g.shownA} = ${g.shownB}`);

  return (
    <div ref={rootRef} className={`ps-root${calmRun ? " ps-calm" : ""}${reduced ? " ps-still" : ""}${prefs.skin === "explorer" ? " ps-x" : ""}`} data-skin={prefs.skin} tabIndex={-1} data-testid="penguin-slide" data-screen={screen} data-biome={curBiome} {...(DEBUG ? { "data-debug-correct": gate ? gate.perm.indexOf(gate.correctLane) : "" } : {})} style={{ fontSize: support?.textSize === "large" ? 18 : undefined }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <HostSkin.Provider value={prefs.skin}>
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="ps-canvas" aria-hidden="true" data-testid="ps-canvas" />
      <div className="ps-sr" role="status" aria-live="polite" data-testid="ps-live">{live}</div>

      {playing && hud && (
        <>
          <div className="ps-top">
            <div>
              <div className="ps-dots" role="img" aria-label={T("progress", { n: Math.min(hud.total, hud.resolved + 1), total: hud.total })} data-testid="ps-progress">
                {Array.from({ length: hud.total }, (_, i) => <span key={i} className={`ps-dot${i < hud.resolved ? " on" : i === hud.resolved ? " cur" : ""}`} />)}
              </div>
              {sd && <div style={{ fontWeight: 800, fontSize: 13, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>{T(`biome_${biomeOf(sd.biome).id}`)} · {sd.boss ? T(`boss_${biomeOf(sd.biome).chaser}`) : T("stage_n", { n: sd.idx })}</div>}
              {started?.best && !calmRun && <div className="ps-rail" aria-hidden="true"><i className="me" style={{ insetInlineStart: `${Math.min(100, (hud.resolved / Math.max(1, hud.total)) * 100)}%` }} /><i className="ghost" style={{ insetInlineStart: `${Math.min(100, hud.ghost * 100)}%` }} title={T("ghost")} /></div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ps-btn" type="button" aria-label={soundOn ? T("sound_off") : T("sound_on")} aria-pressed={!soundOn} onClick={() => { audioRef.current?.resume(); setSoundOn((s) => !s); }}><IconSound off={!soundOn || prefs.muted} /></button>
              <button className="ps-btn" type="button" aria-label={T("pause")} data-testid="ps-pause" onClick={() => pauseNow(true)}><IconPause /></button>
            </div>
          </div>
          {gate && hud.phase === "approach" && (
            <div className="ps-pill" data-testid="ps-question">
              <div className={`ps-q${gate.boss ? " boss" : ""}`}>
                <bdi dir="ltr" data-testid="ps-q-text">{q(gate)}</bdi>
                <button className="ps-speak" type="button" aria-label={T("read_question")} onClick={speakGate}><IconSpeak /></button>
              </div>
              {gate.combo && <div style={{ marginTop: 6, fontWeight: 800, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>{T("combo_note")}</div>}
            </div>
          )}
          <div className="ps-stats">
            {arc && <ArcadeHud T={T} arc={arc} />}
            {!calmRun && !arc && <span className="ps-chip2" data-testid="ps-fish"><IconFish /> <b>{hud.fish}</b>{hud.mult > 1 && <span aria-label={T("boost", { n: hud.mult })}>x{hud.mult}</span>}</span>}
            {hud.rings && (hud.phase === "travel" || hud.phase === "feedback") && <span className="ps-chip2 ps-ringchip" data-testid="ps-rings" role="img" aria-label={T("rings_label", { n: hud.rings.got, of: hud.rings.of })}>{T("rings_chip", { n: hud.rings.got, of: hud.rings.of })}</span>}
            {hud.friend && !calmRun && <span className="ps-chip2" data-testid="ps-friend" role="img" aria-label={T("friend_helping")}>{T("friend_chip")}</span>}
            {!calmRun && !arc && hud.streak >= 3 && <span className="ps-chip2" data-testid="ps-streak">{T("streak", { n: hud.streak })}</span>}
            {hud.chase && <span className="ps-chip2" data-testid="ps-chase" role="img" aria-label={T("chase_label", { boss: T(`boss_${biomeOf(started!.cfg.biome).chaser}`) })} style={{ flexDirection: "column", alignItems: "stretch", minWidth: 150 }}><span style={{ fontSize: 12 }}>{T(`boss_${biomeOf(started!.cfg.biome).chaser}`)} · {T("boss_hp")}</span><span style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,.25)", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${Math.round(hud.bossFill * 100)}%`, background: "var(--ps-gold)", transition: "width .3s" }} /></span></span>}
            {(hud.hint || hud.shield || hud.star) && <span className="ps-power" aria-label={T("powerups")}>
              {hud.hint && <span><IconHint s={16} /> {T("pw_hint")}</span>}{hud.shield && <span><IconShield s={16} /> {T("pw_shield")}</span>}{hud.star && <span><IconStar s={16} /> {T("pw_star")}</span>}
            </span>}
          </div>
          <div style={{ position: "absolute", insetInlineEnd: 12, top: 76, display: "flex", flexDirection: "column", gap: 8 }}>
            {started && started.cfg.loadout.includes("hint") && <button className="ps-btn" type="button" disabled={hud.hintLeft <= 0 || hud.phase !== "approach"} onClick={() => gameRef.current?.usePower(1)} data-testid="ps-use-hint" aria-label={T("use_hint", { n: hud.hintLeft })}><IconHint /> <kbd style={{ opacity: 0.8 }}>H</kbd> {hud.hintLeft}</button>}
            {started && started.cfg.loadout.includes("freeze") && started.cfg.shoals && <button className="ps-btn" type="button" disabled={hud.freezeLeft <= 0 || hud.phase !== "approach"} onClick={() => gameRef.current?.usePower(2)} data-testid="ps-use-freeze" aria-label={T("use_freeze", { n: hud.freezeLeft })}>{T("pw_freeze")} <kbd style={{ opacity: 0.8 }}>F</kbd> {hud.freezeLeft}</button>}
          </div>
          {fb && fb.kind === "wrong" && (
            <div className="ps-fact" data-testid="ps-feedback" data-kind="wrong"><bdi dir="ltr">{fb.r.shown.replace(/ x /g, " × ").replace(/ \/ /g, " ÷ ")} = {fb.r.answer}</bdi></div>
          )}
          {hud.tutorial && hud.resolved === 0 && gate && hud.phase === "approach" && <div className="ps-coach" aria-hidden="true"><div className="bubble"><HostAvatar pose={hud.resolved === 0 ? "point" : "cheer"} size={60} still={reduced} /><span>{T("coach_1")}</span></div></div>}
          {coachLine && <div className="ps-coach" aria-hidden="true" data-testid="ps-coach"><div className="bubble"><HostAvatar pose="point" size={44} still={reduced} /><span>{coachLine}</span></div></div>}
          {!calmRun && (hud.phase === "travel" || hud.phase === "feedback") && (
            <button className={`ps-flop${hud.air ? " air" : ""}${!hud.air && !hud.flopReady ? " cool" : ""}`} type="button" data-testid="ps-flop" aria-label={hud.air ? T("btn_trick_aria") : T("btn_flop_aria")}
              onPointerDown={(e) => { e.stopPropagation(); gameRef.current?.tap(); }} onClick={(e) => { if (e.detail === 0) gameRef.current?.tap(); }}>{hud.air ? T("btn_trick") : T("btn_flop")}</button>
          )}
          {toast && <div className="ps-toast" data-testid="ps-toast" aria-hidden="true">{toast}</div>}
          {hud.pending >= 0 && hud.phase === "approach" && <div className="ps-lockhint" aria-hidden="true" data-testid="ps-lockhint">{T("lock_hint")}</div>}
          {gate && hud.phase === "approach" && (
            <div className="ps-pads" style={{ gridTemplateColumns: `repeat(${L}, 1fr)` }} role="group" aria-label={T("lanes")}>
              {Array.from({ length: L }, (_, lane) => {
                const opt = gate.perm[lane]!; const v = gate.opts[opt] ?? null; const sel = hud.pending === lane && v !== null;
                return (
                  <button key={lane} type="button" className={`ps-pad${sel ? " sel" : ""}`} disabled={v === null} data-testid={`ps-pad-${lane}`} data-selected={sel ? 1 : 0} aria-label={v === null ? T("lane_melted", { lane: lane + 1 }) : sel ? T("lock_in_label", { n: v, lane: lane + 1 }) : T("lane_label", { n: v, lane: lane + 1 })}
                    onClick={() => gameRef.current?.chooseLane(lane)}>
                    {sel && <span className="ps-lockin" aria-hidden="true" data-testid="ps-lockin"><i>{"\u2713"}</i>{T("lock_in")}</span>}{v === null ? "" : v}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {paused && playing && (
        <div className="ps-over" data-nokeys role="dialog" aria-modal="true" aria-label={T("breath_title")} data-testid="ps-pause-overlay">
          <div className="ps-card ps-fadein" style={{ textAlign: "center" }}>
            <h2>{T("breath_title")}</h2><div className="ps-breath" aria-hidden="true" /><p>{T("breath_body")}</p>
            <div className="ps-row"><button className="ps-btn ps-big" style={{ minHeight: 64, fontSize: 22 }} autoFocus type="button" onClick={() => pauseNow(false)} data-testid="ps-resume"><IconPlay /> {T("resume")}</button></div>
            <div className="ps-row"><button className="ps-chip" type="button" onClick={() => { setPaused(false); gameRef.current?.finishNow(); }} data-testid="ps-finish-now">{T("finish_now")}</button></div>
          </div>
        </div>
      )}

      {screen === "map" && (
        <>
          <JourneyMap T={T} TP={TP} info={info} demo={backend.demo} onStage={openStage} onDaily={() => void play({ mode: "daily" })} onPit={() => void play({ mode: "pit" })} onFree={() => void play({ mode: forcedCalm ? "calm" : prefs.mode })} onArcade={(m) => void play({ mode: m })} high={high} calm={forcedCalm}
            onWardrobe={() => setScreen("wardrobe")} onVillage={() => setScreen("village")} fish={fishBal} onIceMap={() => setScreen("icemap")} onMtc={mtc ? () => setScreen("mtc") : null} onSettings={() => setScreen("settings")} onFinale={(info?.journey.stars["b5s4"] ?? 0) > 0 ? () => runFinale() : null}
            onUnlockAll={backend.demo ? () => { void (backend as Backend & { unlockAll?: () => Promise<void> }).unlockAll?.().then(refresh); } : null} onExit={onExit} />
          {error && <p role="alert" style={{ position: "absolute", insetInline: 0, bottom: 8, textAlign: "center", color: "#ffb4b4", fontWeight: 700, zIndex: 6 }}>{error}</p>}
        </>
      )}
      {screen === "chapter" && chapterFor && <Chapter T={T} biome={chapterFor.biome} onGo={() => { setPrefs({ chapters: [...(prefs.chapters ?? []), chapterFor.biome] }); setScreen("stage"); }} />}
      {screen === "stage" && stage && info && (
        <StageCard T={T} stage={stage} best={info.journey.stars[stage.id] ?? 0} unlocks={info.unlocks} loadout={prefs.loadout} setLoadout={(l) => setPrefs({ loadout: l })} firstOfBiome={stage.idx === 1} busy={false} onStart={startStage} onClose={() => setScreen("map")} />
      )}
      {(screen === "starting" || screen === "finishing") && <div className="ps-over" style={{ background: "transparent", pointerEvents: "none" }} aria-hidden="true">{screen === "finishing" && <HostAvatar pose="cheer" size={130} still={reduced} />}</div>}
      {screen === "summary" && result && started && result.arcade && (
        <ArcadeSummary T={T} result={result} high={high} calm={calmRun} demo={backend.demo} onAgain={() => void play(lastOpts.current)} onMenu={() => { setResult(null); setScreen("map"); }} />
      )}
      {screen === "summary" && result && started && !result.arcade && (
        <StageSummary T={T} TP={TP} result={result} started={started} calm={calmRun} demo={backend.demo} restDue={restDue}
          nextLabel={finaleDue ? T("finale_btn") : T("next_stage")} onNext={finaleDue ? () => runFinale() : result.stage?.cleared && nextStageDef() ? () => { const n = nextStageDef()!; setResult(null); openStage(n); } : null}
          onAgain={() => void play(lastOpts.current)} onMap={() => leave(() => { setResult(null); setScreen("map"); })} onRest={() => leave(() => { setResult(null); setScreen("map"); })} />
      )}
      {screen === "village" && <Village T={T} fish={fishBal} built={prefs.village} plots={prefs.plots ?? []} friends={prefs.friends ?? []} reduced={reduced} bought={prefs.bought} onBuild={(id, cost, _plot, nextPlots) => { if (fishBal >= cost && !prefs.village.includes(id)) setPrefs({ village: [...prefs.village, id], plots: nextPlots, spent: prefs.spent + cost }); }} onBuy={(id, cost) => { if (fishBal >= cost && !prefs.bought.includes(id)) setPrefs({ bought: [...prefs.bought, id], spent: prefs.spent + cost }); }} onClose={() => setScreen("map")} />}
      {screen === "story" && story && <StoryScene T={T} panels={story.panels} still={reduced} onDone={() => { const t = story.then; setStory(null); t(); }} />}
      {screen === "wardrobe" && <Wardrobe T={T} unlocked={unlocked} equip={prefs.equip} setEquip={(e) => setPrefs({ equip: e })} onClose={() => setScreen("map")} skin={prefs.skin} />}
      {screen === "icemap" && <IceMap T={T} facts={facts} onClose={() => setScreen("map")} />}
      {screen === "mtc" && <MtcPractice backend={backend} T={T} TP={TP} calm={forcedCalm} onClose={() => setScreen("map")} locale={locale} audio={audioRef.current} />}
      {screen === "settings" && <SettingsScreen T={T} prefs={prefs} setPrefs={setPrefs} forcedCalm={forcedCalm} onClose={() => setScreen("map")} />}
      {(screen === "map") && unlockAll && null}
      <span hidden>{GAME_TITLE}{HOST_NAME}</span>
      </HostSkin.Provider>
    </div>
  );
}

function SettingsScreen({ T, prefs, setPrefs, forcedCalm, onClose }: { T: TT; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; forcedCalm: boolean; onClose: () => void }) {
  return (
    <div className="ps-over" data-nokeys data-testid="ps-settings-screen">
      <div className="ps-card ps-fadein">
        <h2><IconGear s={22} /> {T("settings")}</h2>
        <div className="ps-row" style={{ justifyContent: "flex-start" }} role="group" aria-label={T("skin")}><b>{T("skin")}</b>{(["junior", "explorer"] as const).map((s) => <button key={s} className="ps-chip" type="button" aria-pressed={prefs.skin === s} onClick={() => setPrefs({ skin: s })} data-testid={`ps-skin-${s}`}>{T(`skin_${s}`)}</button>)}</div>
        <div className="ps-row" style={{ justifyContent: "flex-start" }}>
          <button className="ps-chip" type="button" aria-pressed={prefs.muted} onClick={() => setPrefs({ muted: !prefs.muted })}>{prefs.muted ? T("muted") : T("sound")}</button>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 700 }}>{T("volume")}<input className="ps-range" type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setPrefs({ volume: +e.target.value })} aria-label={T("volume")} /></label>
        </div>
        <div className="ps-row" style={{ justifyContent: "flex-start" }} role="group" aria-label={T("motion")}><b>{T("motion")}</b>{(["auto", "full", "gentle"] as const).map((m) => <button key={m} type="button" className="ps-chip" aria-pressed={prefs.motion === m} onClick={() => setPrefs({ motion: m })}>{T(`motion_${m}`)}</button>)}</div>
        <div className="ps-row" style={{ justifyContent: "flex-start" }}>
          <button className="ps-chip" type="button" aria-pressed={prefs.readEvery} onClick={() => setPrefs({ readEvery: !prefs.readEvery })}>{T("read_every")}</button>
          <button className="ps-chip" type="button" aria-pressed={prefs.timer && !forcedCalm} disabled={forcedCalm} onClick={() => setPrefs({ timer: !prefs.timer })}>{T("timer_sprint")}</button>
        </div>
        <p className="ps-help">{forcedCalm ? T("calm_hint") : T("timer_hint")}</p>
        <div className="ps-row"><button className="ps-btn ps-big" type="button" style={{ minHeight: 60, fontSize: 22 }} onClick={onClose} data-testid="ps-settings-close">{T("back")}</button></div>
      </div>
    </div>
  );
}
