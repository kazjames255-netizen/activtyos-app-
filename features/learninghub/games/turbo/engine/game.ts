// The game controller: owns the fixed-tick loop (60 Hz accumulator), the deterministic Sim, the input log that goes
// to the server, the visual state and the effects. React only sees small callbacks; nothing here touches React state
// per frame. Adapted from ../../penguin/engine/game.ts (same core, same event stream) - only the renderer/theme
// differ, and Turbo Slide never requests the journey-only features (bosses, biomes, cosmetics, ring gates), so those
// branches are simply dead code here rather than removed, to keep this file a close, low-risk mirror of the proven original.
import { HOVER_D, laneOf, packInput, replay, step, newSim, TICK_HZ, type Cfg, type Gate, type InputLog, type Plan, type Result, type Sim, type SimEvent } from "../core";
import { JUICE } from "../../penguin/config";
import { lookOf } from "../../penguin/theme";
import type { GameAudio } from "./audio";
import { Input } from "./input";
import { newVis, Renderer, type Frame, type RenderOpts, type Vis } from "./render";
import { clamp, lerp } from "./fx";

export interface Hud {
  phase: Sim["phase"] | "idle"; resolved: number; total: number; streak: number; mult: number; fish: number; bestStreak: number;
  hint: boolean; shield: boolean; star: boolean; gate: Gate | null; locked: boolean; ghost: number; tutorial: boolean; guessed: boolean;
  pending: number;
}
export interface GameEvents {
  hud(h: Hud): void;
  gate(g: Gate, index: number, total: number): void;
  result(r: Result, streak: number, mult: number): void;
  event(e: SimEvent): void;
  done(p: { log: InputLog; endTick: number; sim: Sim; early: boolean }): void;
}

export class Game {
  renderer: Renderer;
  input: Input;
  sim: Sim | null = null;
  vis: Vis = newVis();
  private log: InputLog = []; private lastPacked = -1;
  private raf = 0; private last = 0; private acc = 0; private freeze = 0; private paused = false; private running = false; private early = false;
  private prev = { x: 0, dist: 0, gd: 0 };
  private curGate: Gate | null = null; private lastLane = 1;
  private best: number[] = []; private guessed = false;
  private onKeyDown = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("[data-nokeys]")) return; if (e.key === "Escape" || e.key === "p" || e.key === "P") { if (this.running) { e.preventDefault(); this.setPaused(!this.paused); this.ev.event({ t: "breath" }); } return; } if (this.paused) return; if (this.input.keyDown(e)) e.preventDefault(); };
  private onKeyUp = (e: KeyboardEvent) => { if (this.input.keyUp(e)) e.preventDefault(); };
  private onVis = () => { if (document.hidden && this.running) this.setPaused(true); };

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, opts: RenderOpts, private audio: GameAudio, private ev: GameEvents) {
    this.renderer = new Renderer(canvas, opts);
    this.input = new Input((cx) => this.renderer.screenToWorldX(cx, this.vis.cam), () => this.sim?.cfg.lanes ?? 3, () => !!this.sim?.cfg.calm);
    this.resize();
    window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp); document.addEventListener("visibilitychange", this.onVis);
    host.style.touchAction = "none";
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp); document.removeEventListener("visibilitychange", this.onVis); this.audio.music(false); }
  resize() { const r = this.host.getBoundingClientRect(); this.renderer.resize(r.width, r.height, Math.min(2, window.devicePixelRatio || 1)); }
  setOpts(o: Partial<RenderOpts>) { this.renderer.setOpts(o); }
  isRunning() { return this.running; }
  isPaused() { return this.paused; }
  setPaused(p: boolean) { if (!this.running && !p) { this.paused = false; return; } this.paused = p; this.audio.music(!p && !this.sim?.cfg.calm ? true : false, 0); this.last = performance.now(); this.emitHud(); }

  pointerDown(x: number) { if (this.paused || !this.running) return; this.input.pointerDown(x); }
  pointerMove(x: number) { this.input.pointerMove(x); }
  pointerUp() { this.input.pointerUp(); }
  confirm() { if (this.paused || !this.running) return; this.input.tapAct(); }
  chooseLane(i: number) { if (this.paused || !this.running || this.sim?.phase !== "approach") return; this.input.chooseLane(i); }
  tap() { if (this.paused || !this.running) return; this.input.tapAct(); }

  /** Start a run. The first gate is on screen on the very next frame. */
  start(seed: number, cfg: Cfg, plan: Plan, bestPace: number[] = []) {
    this.sim = newSim(seed, cfg, plan, true); this.log = []; this.lastPacked = -1; this.acc = 0; this.freeze = 0; this.paused = false; this.running = true; this.early = false;
    this.best = bestPace; this.guessed = false;
    this.vis = { ...newVis(), t: this.vis.t }; this.input.reset(); this.lastLane = laneOf(this.sim.x, cfg.lanes);
    this.prev = { x: this.sim.x, dist: this.sim.dist, gd: this.sim.gate?.gd ?? 0 };
    this.renderer.setOpts({ calm: cfg.calm, biome: cfg.biome, radar: false });
    this.audio.setStreak(0, false); this.audio.setMood(lookOf(cfg.biome).music); this.processEvents(); this.last = performance.now(); this.audio.music(!cfg.calm, 0); this.emitHud();
  }
  /** "Finish now": ends the run and hands the partial log over. Progress is always kept. */
  finishNow() { if (!this.sim || !this.running) return; this.early = true; this.running = false; this.audio.music(false); this.ev.done({ log: this.log, endTick: this.sim.tick, sim: this.sim, early: true }); }
  stop() { this.running = false; this.sim = null; this.audio.music(false); this.emitHud(); }
  /** A snapshot to checkpoint (the input log so far + the tick it's at), for "Back to Games" mid-run. */
  snapshot(): { log: InputLog; endTick: number } | null { return this.sim && this.running ? { log: this.log, endTick: this.sim.tick } : null; }
  /** Resume a run the server has a checkpoint for: rebuild the Sim by REPLAYING the stored log to its tick, then
   *  carry on live from exactly that state. See ../../penguin/engine/game.ts's `resume` for the full comment. */
  resume(seed: number, cfg: Cfg, plan: Plan, log: InputLog, endTick: number, bestPace: number[] = []) {
    const sim = replay(seed, cfg, plan, log, endTick);
    sim.emit = true; sim.ev = [];
    this.sim = sim; this.log = [...log]; this.lastPacked = log.length ? log[log.length - 1]![1] : -1;
    this.acc = 0; this.freeze = 0; this.paused = false; this.running = sim.phase !== "done"; this.early = false;
    this.best = bestPace; this.guessed = false;
    this.vis = { ...newVis(), t: this.vis.t }; this.input.reset(); this.lastLane = laneOf(sim.x, cfg.lanes); this.curGate = sim.gate;
    this.prev = { x: sim.x, dist: sim.dist, gd: sim.gate?.gd ?? 0 };
    this.renderer.setOpts({ calm: cfg.calm, biome: cfg.biome, radar: false });
    this.audio.setStreak(sim.streak, false); this.audio.setMood(lookOf(cfg.biome).music); this.last = performance.now();
    this.audio.music(!cfg.calm && this.running, 0); this.emitHud();
    if (!this.running) this.ev.done({ log: this.log, endTick: sim.tick, sim, early: false });
  }

  private emitHud() {
    const s = this.sim;
    const ghost = s && this.best.length ? this.best.filter((t) => t <= s.tick).length / Math.max(1, s.cfg.n) : 0;
    this.ev.hud({
      phase: s ? s.phase : "idle", resolved: s?.results.filter((r) => !r.miss).length ?? 0, total: s?.cfg.n ?? 0, streak: s?.streak ?? 0, mult: s?.mult ?? 1, fish: s?.fish ?? 0, bestStreak: s?.bestStreak ?? 0,
      hint: !!s?.hintNext, shield: !!s?.shield, star: !!s?.starNext, gate: s?.gate ?? this.curGate, locked: !!s?.gate?.locked, ghost, tutorial: false, guessed: this.guessed, pending: this.pendingLane(),
    });
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - (this.last || now)) / 1000; this.last = now; dt = Math.min(0.1, Math.max(0, dt));
    const s = this.sim; const v = this.vis; const calm = !!s?.cfg.calm; const reduced = this.renderer.opts.reduced || calm;
    v.t += dt;
    if (s && this.running && !this.paused) {
      if (this.freeze > 0) this.freeze -= dt;
      else {
        this.acc += dt; let n = 0;
        while (this.acc >= 1 / TICK_HZ && n < 6 && s.phase !== "done") {
          this.acc -= 1 / TICK_HZ; n++;
          this.prev = { x: s.x, dist: s.dist, gd: s.gate?.gd ?? 0 };
          const { steer, act } = this.input.next(s);
          const p = packInput(steer, act, 0);
          if (p !== this.lastPacked) { this.log.push([s.tick, p]); this.lastPacked = p; }
          this.input.consumeStart();
          step(s, steer, act, 0);
          this.processEvents();
          if (this.freeze > 0) break;
        }
        if (n === 6) this.acc = 0;
        { const sig = `${s.phase}|${this.pendingLane()}`; if (sig !== this.sig) { this.sig = sig; this.emitHud(); } }
        if (s.phase === "done" && this.running) { this.running = false; this.audio.music(false); this.ev.done({ log: this.log, endTick: s.tick, sim: s, early: false }); }
      }
    }
    this.updateVis(dt, s, reduced);
    const alpha = clamp(this.acc * TICK_HZ, 0, 1);
    let f: Frame;
    if (s) {
      const gd = s.gate ? lerp(this.prev.gd, s.gate.gd, alpha) : 0;
      f = { sim: s, lanes: s.cfg.lanes, x: lerp(this.prev.x, s.x, alpha), vx: s.vx, dist: lerp(this.prev.dist, s.dist, alpha), gd, speed: s.speed, tick: s.tick + alpha, vis: v, hovering: !!s.gate && s.cfg.approachSec === 0 && !s.gate.locked && s.gate.gd <= 11.5 };
    } else {
      f = { sim: null, lanes: 3, x: Math.sin(v.t * 0.7) * 0.28 * (reduced ? 0.2 : 1), vx: 0, dist: v.t * 3, gd: 0, speed: 0.06, tick: 0, vis: v, hovering: false };
    }
    this.renderer.draw(f, dt);
  };

  private sig = "";
  /** picked but not locked: the child has moved / tapped on this gate, is standing still on the ledge, and has not confirmed */
  private pendingLane(): number { const s = this.sim; const g = s?.gate; if (!s || !g || s.phase !== "approach" || g.locked || !g.touched || g.gd > HOVER_D + 0.5 || (!s.cfg.calm && Math.abs(s.vx) > 0.012)) return -1; if (g.opts[g.perm[g.lane]!] === null) return -1; return g.lane; }
  private updateVis(dt: number, s: Sim | null, reduced: boolean) {
    const v = this.vis;
    v.legT += dt; v.flip = Math.min(1, v.flip + dt / 0.5); v.land = Math.min(1, v.land + dt / 0.28); v.skid = Math.min(1, v.skid + dt / 0.5); v.bossRoar = Math.min(1, v.bossRoar + dt / 0.9);
    v.hop = Math.min(1, v.hop + dt / 0.55); v.bonk = Math.min(1, v.bonk + dt / 0.7); v.spin = Math.min(1, v.spin + dt / 0.6);
    v.blink = Math.max(0, v.blink - dt * 9);
    v.pend = lerp(v.pend, this.pendingLane() >= 0 ? 1 : 0, 1 - Math.exp(-dt * 10));
    const tgt = reduced ? 0 : clamp((s ? s.vx : 0) / 0.05, -1, 1) * JUICE.cameraLookahead * this.renderer.W;
    v.cam = lerp(v.cam, tgt, 1 - Math.exp(-dt / JUICE.cameraSmoothS));
    if (s) {
      const l = laneOf(s.x, s.cfg.lanes);
      if (l !== this.lastLane) {
        this.lastLane = l;
        const pf = this.renderer.pf(); const pos = this.renderer.penguinPos({ x: s.x, cam: v.cam });
        for (let i = 0; i < Math.round(JUICE.snowPuff.n * pf); i++) this.renderer.fx.emit(1, pos.x + (Math.random() - 0.5) * 40, this.renderer.yCar - 8, (Math.random() - 0.5) * 120 - Math.sign(s.vx) * 60, -30 - Math.random() * 40, 50, JUICE.snowPuff.ms / 1000, 6 + Math.random() * 5, 2);
        this.audio.steer(s.vx * 40);
      }
    }
  }

  private processEvents() {
    const s = this.sim; if (!s) return; const v = this.vis; const R = this.renderer; const pf = R.pf(); const A = this.audio;
    const evs = s.ev.splice(0, s.ev.length);
    let hud = false; const calm = s.cfg.calm; const at = () => R.penguinPos({ x: s.x, cam: v.cam });
    const shake = (px: number) => { if (!calm) R.nudge(px); };
    const stop = (ms: number) => { if (!calm && !this.renderer.opts.reduced) this.freeze = Math.max(this.freeze, ms / 1000); };
    for (const e of evs) {
      this.ev.event(e);
      switch (e.t) {
        case "gate": this.curGate = e.g; this.input.clearForNewGate(); this.ev.gate(e.g, s.resolved, s.cfg.n); hud = true; break;
        case "lock": A.lock(); A.whoosh(); hud = true; break;
        case "unlock": hud = true; break;
        case "correct": {
          v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "correct", t0: v.t };
          v.hop = 0; v.spin = 0; v.spinKind = 1; A.correct(e.streak, false); A.setStreak(e.streak, false);
          const p = R.blockPos(e.r.lane, s.cfg.lanes, v.cam);
          R.fx.burst(2, p.x, p.y, Math.round(JUICE.chips * pf), 260, 0.7, 7, [2, 3, 4], 700);
          R.fx.burst(3, p.x, p.y - 10, Math.round((e.streak % 3 === 0 ? JUICE.starPop : 3) * pf), 220, 0.8, 8, [0, 1, 6], 300);
          shake(e.streak % 3 === 0 ? 6 : 4); stop(e.streak % 3 === 0 ? 100 : 70);
          this.ev.result(e.r, e.streak, e.mult); hud = true; break;
        }
        case "wrong": {
          v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "wrong", t0: v.t };
          v.bonk = 0; v.spinKind = 2; A.wrong(); A.setStreak(s.streak, false);
          const p = R.blockPos(e.r.lane, s.cfg.lanes, v.cam);
          R.fx.burst(2, p.x, p.y, Math.round(8 * pf), 170, 0.6, 6, [3, 4], 600);
          shake(4);
          this.ev.result(e.r, s.streak, s.mult); hud = true; break;
        }
        case "miss": v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "miss", t0: v.t }; this.ev.result(e.r, s.streak, s.mult); hud = true; break;
        case "fish": { const p = at(); R.fx.burst(0, p.x, p.y - 10, Math.round(6 * pf), 200, 0.5, 3, [0, 1], 400); A.fish(0); hud = true; break; }
        case "breath": this.guessed = true; A.breath(); hud = true; break;
        case "finish": { v.hop = 0; v.spin = 0; v.spinKind = 1; const pos = R.penguinPos({ x: s.x, cam: v.cam }); R.fx.burst(3, pos.x, pos.y - 60, Math.round(16 * pf), 280, 1.2, 8, [0, 5, 6, 4], 240); hud = true; break; }
        default: break;
      }
    }
    if (hud) this.emitHud();
  }
}
