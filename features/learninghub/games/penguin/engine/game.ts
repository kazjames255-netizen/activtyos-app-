// The game controller: owns the fixed-tick loop (60 Hz accumulator), the deterministic Sim, the input log that goes to the server, the visual state and the
// effects. React only sees small callbacks; nothing here touches React state per frame.
import { CHASE_START, HOVER_D, bossNeed, laneOf, packInput, replay, step, newSim, TICK_HZ, type Cfg, type Gate, type InputLog, type Plan, type Result, type Sim, type SimEvent } from "../core";
import { COSMETICS, JUICE, lookOf } from "../theme";
import type { GameAudio } from "./audio";
import { Input } from "./input";
import { newVis, Renderer, type Frame, type RenderOpts, type Vis } from "./render";
import { clamp, lerp } from "./fx";

export interface Hud {
  phase: Sim["phase"] | "idle"; resolved: number; total: number; streak: number; mult: number; fish: number; bestStreak: number;
  hint: boolean; shield: boolean; star: boolean; gate: Gate | null; locked: boolean; ghost: number; tutorial: boolean; guessed: boolean;
  /** journey helpers: charges left, times used, boss chaser meter (0 = far .. 1 = on your heels) */
  hintLeft: number; freezeLeft: number; danger: number; chase: boolean; helpUsed: number;
  /** the slide game: boss weak-spot fill 0..1 + phase, airborne / can flop, what is coming up on the ice (for the in-world coach), strong wind, lantern 0..1 (caves), the leg's route */
  bossFill: number; bossPhase: 1 | 2 | 3; bossDown: boolean; air: boolean; flopReady: boolean; ahead: string | null; windy: boolean; light: number; biome: number; hits: number;
  /** the lane the child has picked but not locked yet (-1 = none): drives the gold confirm ring and the highlighted pad */ pending: number;
  /** Serpent ring gate: rings slid through / rings in this stretch (null when there is none) and whether her shield was open at the last answer */ rings: { got: number; of: number } | null; ringOpen: boolean | null; friend: boolean;
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
  private nextBlink = 2; private idleX = 0; private idleDist = 0; private windT = 0;
  private best: number[] = []; private guessed = false; private pendingPower: 0 | 1 | 2 = 0;
  private tutorialLeft = 0;
  private onKeyDown = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("[data-nokeys]")) return; if (e.key === "Escape" || e.key === "p" || e.key === "P") { if (this.running) { e.preventDefault(); this.setPaused(!this.paused); this.ev.event({ t: "breath" }); } return; } if (this.paused) return; if ((e.key === "h" || e.key === "H") && !e.repeat) { this.usePower(1); e.preventDefault(); return; } if ((e.key === "f" || e.key === "F") && !e.repeat) { this.usePower(2); e.preventDefault(); return; } if (this.input.keyDown(e)) e.preventDefault(); };
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

  // pointer plumbing (the component forwards the events)
  pointerDown(x: number) { if (this.paused || !this.running) return; this.input.pointerDown(x); }
  pointerMove(x: number) { this.input.pointerMove(x); }
  pointerUp() { this.input.pointerUp(); }
  /** The gold lock-in ring / pad / Space: answer with the lane the penguin is resting in. */
  confirm() { if (this.paused || !this.running) return; this.input.tapAct(); }
  /** Use a helper the child took along: 1 = hint fish, 2 = slow-time crystal. It is a one-tick tap in the input log, so the server replays it too. */
  usePower(p: 1 | 2) { if (this.paused || !this.running) return; this.pendingPower = p; }
  chooseLane(i: number) { if (this.paused || !this.running || this.sim?.phase !== "approach") return; this.input.chooseLane(i); }
  /** The on-screen belly-flop / trick button (Space does the same). */
  tap() { if (this.paused || !this.running) return; this.input.tapAct(); }

  /** Start a run. The first gate is on screen on the very next frame: nothing between the tap and the first slide. */
  start(seed: number, cfg: Cfg, plan: Plan, bestPace: number[] = []) {
    this.sim = newSim(seed, cfg, plan, true); this.log = []; this.lastPacked = -1; this.acc = 0; this.freeze = 0; this.paused = false; this.running = true; this.early = false;
    this.best = bestPace; this.guessed = false; this.ringOpen = null; this.tutorialLeft = cfg.tutorial ? 3 : 0;
    this.vis = { ...newVis(), t: this.vis.t }; this.input.reset(); this.lastLane = laneOf(this.sim.x, cfg.lanes);
    this.prev = { x: this.sim.x, dist: this.sim.dist, gd: this.sim.gate?.gd ?? 0 };
    this.renderer.setOpts({ calm: cfg.calm, biome: cfg.biome, radar: cfg.loadout.includes("radar") });
    this.vis.hopScale = cfg.style === "ramps" ? 1.9 : 1; this.vis.danger = 0;
    this.audio.setStreak(0, !!cfg.chaser); this.audio.setMood(lookOf(cfg.biome).music); this.processEvents(); this.last = performance.now(); this.audio.music(!cfg.calm, 0); this.emitHud();
  }
  /** "Finish now": ends the run and hands the partial log over. Progress is always kept. */
  finishNow() { if (!this.sim || !this.running) return; this.early = true; this.running = false; this.audio.music(false); this.ev.done({ log: this.log, endTick: this.sim.tick, sim: this.sim, early: true }); }
  stop() { this.running = false; this.sim = null; this.audio.music(false); this.emitHud(); }
  /** A snapshot to checkpoint (the input log so far + the tick it's at), for "Back to Games" mid-run. Non-destructive:
   *  the run keeps playing until the caller actually tears it down. */
  snapshot(): { log: InputLog; endTick: number } | null { return this.sim && this.running ? { log: this.log, endTick: this.sim.tick } : null; }
  /** Resume a run the server has a checkpoint for: rebuild the Sim by REPLAYING the stored log to its tick (the
   *  same pure `replay()` the server re-verifies with), then carry on live from exactly that state - same queue,
   *  score, position, everything. New ticks append to the same log finish() will eventually send in full. */
  resume(seed: number, cfg: Cfg, plan: Plan, log: InputLog, endTick: number, bestPace: number[] = []) {
    const sim = replay(seed, cfg, plan, log, endTick);
    sim.emit = true; sim.ev = [];
    this.sim = sim; this.log = [...log]; this.lastPacked = log.length ? log[log.length - 1]![1] : -1;
    this.acc = 0; this.freeze = 0; this.paused = false; this.running = sim.phase !== "done"; this.early = false;
    this.best = bestPace; this.guessed = false; this.ringOpen = null; this.tutorialLeft = 0;
    this.vis = { ...newVis(), t: this.vis.t }; this.input.reset(); this.lastLane = laneOf(sim.x, cfg.lanes); this.curGate = sim.gate;
    this.prev = { x: sim.x, dist: sim.dist, gd: sim.gate?.gd ?? 0 };
    this.renderer.setOpts({ calm: cfg.calm, biome: cfg.biome, radar: cfg.loadout.includes("radar") });
    this.vis.hopScale = cfg.style === "ramps" ? 1.9 : 1; this.vis.danger = 0;
    this.audio.setStreak(sim.streak, !!cfg.chaser); this.audio.setMood(lookOf(cfg.biome).music); this.last = performance.now();
    this.audio.music(!cfg.calm && this.running, 0); this.emitHud();
    if (!this.running) this.ev.done({ log: this.log, endTick: sim.tick, sim, early: false }); // the checkpoint happened to land right on the finish line
  }

  private emitHud() {
    const s = this.sim;
    const ghost = s && this.best.length ? this.best.filter((t) => t <= s.tick).length / Math.max(1, s.cfg.n) : 0;
    this.ev.hud({
      phase: s ? s.phase : "idle", resolved: s?.results.filter((r) => !r.miss).length ?? 0, total: s?.cfg.n ?? 0, streak: s?.streak ?? 0, mult: s?.mult ?? 1, fish: s?.fish ?? 0, bestStreak: s?.bestStreak ?? 0,
      hint: !!s?.hintNext, shield: !!s?.shield, star: !!s?.starNext, gate: s?.gate ?? this.curGate, locked: !!s?.gate?.locked, ghost, tutorial: this.tutorialLeft > 0, guessed: this.guessed,
      bossFill: s && s.cfg.chaser ? Math.min(1, s.bossFill / bossNeed(s.plan.items.length)) : 0, bossPhase: s?.bossPhase ?? 1, bossDown: !!s?.bossDown, air: !!s && s.air > 0, flopReady: !!s && s.flopCd === 0 && s.air === 0 && !s.cfg.calm, ahead: this.ahead(), windy: !!s && Math.abs(s.wind) > 0.0007, light: s?.light ?? 1, biome: s?.cfg.biome ?? 1, hits: s?.hits ?? 0, pending: this.pendingLane(), rings: s && s.cfg.chaser === "serpent" && s.legRings > 0 ? { got: s.legRingsGot, of: s.legRings } : null, ringOpen: this.ringOpen, friend: !!s?.friend,
      hintLeft: s?.charges.hint ?? 0, freezeLeft: s?.charges.freeze ?? 0, danger: s && s.cfg.chaser ? 1 - s.chase / CHASE_START : 0, chase: !!s?.cfg.chaser, helpUsed: s?.helpUsed ?? 0,
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
          const pw = this.pendingPower; this.pendingPower = 0;
          const p = packInput(steer, act, pw);
          if (p !== this.lastPacked) { this.log.push([s.tick, p]); this.lastPacked = p; }
          const started = this.input.consumeStart(); if (started && !reduced) v.windup = started;
          step(s, steer, act, pw);
          this.processEvents();
          if (this.freeze > 0) break;
        }
        if (n === 6) this.acc = 0;
        { const sig = `${this.ahead()}|${Math.abs(s.wind) > 0.0007}|${s.air > 0}|${s.flopCd === 0}|${s.phase}|${Math.round(s.light * 10)}|${this.pendingLane()}|${s.legRingsGot}|${s.friend}`; if (sig !== this.sig) { this.sig = sig; this.emitHud(); } }
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
      this.idleDist += (calm ? 1.2 : 3.2) * dt; this.idleX = Math.sin(v.t * 0.7) * 0.28 * (reduced ? 0.2 : 1);
      f = { sim: null, lanes: 3, x: this.idleX, vx: Math.cos(v.t * 0.7) * 0.012, dist: this.idleDist, gd: 0, speed: 0.06, tick: 0, vis: v, hovering: false };
    }
    this.renderer.draw(f, dt);
  };

  /** The nearest thing coming up on the ice that a new player might not understand yet (drives the one-line coach, never a pop-up). */
  private ahead(): string | null {
    const s = this.sim; if (!s || s.phase !== "travel" && s.phase !== "feedback") return null;
    let best: string | null = null, bz = 46;
    for (const o of s.objs) { const z = o.d - s.dist; if (o.got || z < 4 || z > bz) continue; if (o.kind === "fish" && s.fish > 2) continue; best = o.kind; bz = z; }
    return best;
  }
  private ringOpen: boolean | null = null;
  /** picked but not locked: the child has moved / tapped on this gate, is standing still on the ledge, and has not confirmed */
  private pendingLane(): number { const s = this.sim; const g = s?.gate; if (!s || !g || s.phase !== "approach" || g.locked || !g.touched || g.gd > HOVER_D + 0.5 || (!s.cfg.calm && Math.abs(s.vx) > 0.012)) return -1; if (g.opts[g.perm[g.lane]!] === null) return -1; return g.lane; }
  private sig = ""; private fishChain = 0; private fishAt = 0;
  private updateVis(dt: number, s: Sim | null, reduced: boolean) {
    const v = this.vis;
    this.audio.wind(s && !s.cfg.calm ? Math.abs(s.wind) / 0.0012 : 0);
    v.legT += dt; v.flip = Math.min(1, v.flip + dt / 0.5); v.land = Math.min(1, v.land + dt / 0.28); v.skid = Math.min(1, v.skid + dt / 0.5); v.bossRoar = Math.min(1, v.bossRoar + dt / 0.9);
    if (s) {
      const tf = s.cfg.chaser ? Math.min(1, s.bossFill / bossNeed(s.plan.items.length)) : 0; v.bossFill = lerp(v.bossFill, tf, 1 - Math.exp(-dt * 4));
      if (s.bossDown) v.defeat = Math.min(1, v.defeat + dt / 2.6); else v.defeat = 0;
      v.aura = lerp(v.aura, s.streak >= 3 && !s.cfg.calm ? Math.min(1, (s.streak - 2) / 6) : 0, 1 - Math.exp(-dt * 3));
    }
    v.hop = Math.min(1, v.hop + dt / 0.55); v.bonk = Math.min(1, v.bonk + dt / 0.7); v.spin = Math.min(1, v.spin + dt / 0.6);
    v.stretchT += dt; if (v.stretchT >= JUICE.stretchMs / 1000 && v.stretchT - dt < JUICE.stretchMs / 1000) v.squashT = 0; v.squashT += dt;
    v.windup = Math.abs(v.windup) > 0 ? Math.max(0, Math.abs(v.windup) - dt / (JUICE.windupMs / 1000)) * Math.sign(v.windup) : 0;
    v.blink = Math.max(0, v.blink - dt * 9); this.nextBlink -= dt; if (this.nextBlink <= 0) { v.blink = 1; this.nextBlink = 2.5 + Math.random() * 3; }
    // weather: a gentle wind with an occasional gust (slow; nothing flashes)
    this.windT += dt; const gust = Math.max(0, Math.sin(this.windT * 0.11 + 1.3)) ** 6;
    v.wind = (Math.sin(this.windT * 0.23) * 0.5 + gust * 2.2) * (reduced ? 0.3 : 1);
    v.danger = lerp(v.danger, s && s.cfg.chaser ? clamp(1 - s.chase / CHASE_START, 0, 1) : 0, 1 - Math.exp(-dt * 3));
    if (v.shift) { v.shift.t += dt / 0.45; if (v.shift.t >= 1) v.shift = null; }
    const sp = s ? s.speed : 0.05;
    v.rush = lerp(v.rush, clamp((sp - 0.2) / 0.55, 0, 1), 1 - Math.exp(-dt * 5));
    v.lockGlow = lerp(v.lockGlow, s?.gate?.locked ? 1 : 0, 1 - Math.exp(-dt * 8));
    v.pend = lerp(v.pend, this.pendingLane() >= 0 ? 1 : 0, 1 - Math.exp(-dt * 10));
    // camera lookahead: 5-8% of the viewport toward where we are going, smoothed ~0.15 s (no zoom pulses, no roll)
    const tgt = reduced ? 0 : clamp((s ? s.vx : 0) / 0.05, -1, 1) * JUICE.cameraLookahead * this.renderer.W;
    v.cam = lerp(v.cam, tgt, 1 - Math.exp(-dt / JUICE.cameraSmoothS));
    if (s) {
      const l = laneOf(s.x, s.cfg.lanes);
      if (l !== this.lastLane) {
        this.lastLane = l; v.stretchT = 0; v.squashT = 9;
        const pf = this.renderer.pf(); const pos = this.renderer.penguinPos({ x: s.x, cam: v.cam });
        for (let i = 0; i < Math.round(JUICE.snowPuff.n * pf); i++) this.renderer.fx.emit(1, pos.x + (Math.random() - 0.5) * 40, this.renderer.yP, (Math.random() - 0.5) * 120 - Math.sign(s.vx) * 60, -30 - Math.random() * 40, 50, JUICE.snowPuff.ms / 1000, 6 + Math.random() * 5, 2);
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
        case "gate": this.curGate = e.g; this.input.clearForNewGate(); v.guide = this.tutorialLeft > 0; this.ev.gate(e.g, s.resolved, s.cfg.n); hud = true; break;
        case "leg": v.legT = 0; hud = true; break;
        case "ledge": { v.skid = 0; const p = at(); R.fx.burst(1, p.x, p.y + 40, Math.round(12 * pf), 160, 0.5, 8, [2, 3], 30); A.ledge(); hud = true; break; }
        case "lock": A.lock(); A.whoosh(); hud = true; break;
        case "unlock": hud = true; break;
        case "shift": { const gg = s.gate; if (gg) { const prev = gg.perm.map((_, l) => gg.perm[(l + 1) % gg.perm.length]!); v.shift = { serial: gg.serial, prev, t: 0 }; } A.steer(0.5); break; }
        case "chase": hud = true; break;
        case "caught": { hud = true; A.wrong(); v.bossRoar = 0; shake(6); break; }
        case "phase": { v.bossRoar = 0; shake(7); stop(110); A.phase(e.n); hud = true; break; }
        case "defeat": {
          hud = true; A.defeat(); shake(8); const w = R.W, h = R.H;
          for (let k = 0; k < 6; k++) R.fx.burst(3, w * (0.2 + 0.12 * k), h * 0.34, Math.round(10 * pf), 320, 1.4, 9, [0, 1, 5, 6], 260);
          R.fx.burst(2, w / 2, h * 0.36, Math.round(30 * pf), 420, 1.1, 9, [2, 3, 4], 500);
          break;
        }
        case "correct": {
          v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "correct", t0: v.t };
          v.hop = 0; v.spin = 0; v.spinKind = 1; A.correct(e.streak, e.r.boss); A.setStreak(e.streak, !!s.cfg.chaser);
          const p = R.blockPos(e.r.lane, s.cfg.lanes, v.cam);
          R.fx.burst(2, p.x, p.y, Math.round(JUICE.chips * pf), 260, 0.7, 7, [2, 3, 4], 700);
          R.fx.burst(0, p.x, p.y, Math.round(10 * pf), 300, 0.6, 3.4, [0, 1], 500);
          R.fx.burst(3, p.x, p.y - 10, Math.round((e.streak % 3 === 0 ? JUICE.starPop : 3) * pf), 220, 0.8, 8, [0, 1, 6], 300);
          shake(e.streak % 3 === 0 ? 6 : 4); stop(e.streak % 3 === 0 ? 100 : 70);
          if (this.tutorialLeft > 0) this.tutorialLeft--;
          this.ev.result(e.r, e.streak, e.mult); hud = true; break;
        }
        case "wrong": {
          v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "wrong", t0: v.t };
          v.bonk = 0; v.spinKind = 2; A.wrong(); A.setStreak(s.streak, !!s.cfg.chaser);
          const p = R.blockPos(e.r.lane, s.cfg.lanes, v.cam);
          R.fx.burst(2, p.x, p.y, Math.round(8 * pf), 170, 0.6, 6, [3, 4], 600); R.fx.burst(1, p.x, p.y, Math.round(6 * pf), 90, 0.5, 8, [2], 20);
          shake(4);
          this.ev.result(e.r, s.streak, s.mult); hud = true; break;
        }
        case "miss": v.passed = { gate: this.curGate!, dist0: s.dist, lane: e.r.lane, kind: "miss", t0: v.t }; this.ev.result(e.r, s.streak, s.mult); hud = true; break;
        case "fish": {
          const p = at(); R.fx.burst(0, p.x, p.y - 10, Math.round(6 * pf), 200, 0.5, 3, [0, 1], 400);
          const now = v.t; this.fishChain = now - this.fishAt < 0.7 ? Math.min(12, this.fishChain + 1) : 0; this.fishAt = now; A.fish(this.fishChain); hud = true; break;
        }
        case "bag": { const p = at(); R.fx.burst(3, p.x, p.y - 20, Math.round(16 * pf), 320, 1, 9, [0, 1, 6], 300); shake(4); A.bag(); hud = true; break; }
        case "ring": { const p = at(); R.fx.emit(4, p.x, p.y - 30, 0, 0, 0, 0.6, 30, 5); R.fx.burst(3, p.x, p.y - 30, Math.round(6 * pf), 220, 0.7, 7, [5, 6, 3], 200); A.ring(); hud = true; break; }
        case "crystal": { const p = at(); R.fx.burst(0, p.x, p.y - 20, Math.round(10 * pf), 240, 0.8, 4, [3, 5], 100); A.crystal(); hud = true; break; }
        case "power": { const p = at(); R.fx.burst(3, p.x, p.y, Math.round(9 * pf), 240, 0.8, 8, [0, 3, 5], 260); R.fx.emit(4, p.x, p.y, 0, 0, 0, 0.6, 26, 5); A.power(); hud = true; break; }
        case "powerUse": hud = true; break;
        case "bump": A.bump(); { const p = at(); R.fx.burst(1, p.x + e.x * 40, p.y + 30, Math.round(6 * pf), 80, 0.4, 7, [2], 30); } break;
        case "hit": {
          v.bonk = 0; const p = at(); R.fx.burst(2, p.x, p.y, Math.round(12 * pf), 260, 0.6, 7, [2, 3, 4], 700);
          if (e.lost > 0) R.fx.burst(0, p.x, p.y - 20, Math.round(e.lost * 4 * pf), 220, 0.9, 5, [0, 1], 500);
          shake(e.kind === "drift" ? 3 : 7); stop(e.kind === "drift" ? 40 : 100); A.hit(e.kind !== "drift"); hud = true; break;
        }
        case "smash": { const p = at(); R.fx.burst(1, p.x, p.y - 30, Math.round(12 * pf), 240, 0.6, 9, [2, 3], 200); R.fx.burst(3, p.x, p.y - 30, Math.round(4 * pf), 200, 0.6, 7, [0, 1], 200); shake(3); A.smash(); hud = true; break; }
        case "rescue": { const p = at(); R.fx.burst(3, p.x, p.y - 20, Math.round(18 * pf), 320, 1.1, 9, [0, 1, 5, 6], 300); R.fx.burst(2, p.x, p.y, Math.round(14 * pf), 260, 0.8, 8, [2, 3, 4], 300); shake(4); A.bag(); hud = true; break; }
        case "friendSave": { const p = at(); R.fx.burst(3, p.x, p.y, Math.round(8 * pf), 200, 0.6, 7, [0, 1, 3], 200); A.power(); hud = true; break; }
        case "ringGate": this.ringOpen = e.open; hud = true; break;
        case "throw": v.throwT = 0; v.throwX = e.x; A.whoosh(); break;
        case "boost": { const p = at(); R.fx.burst(0, p.x, p.y + 20, Math.round(12 * pf), 260, 0.5, 3.4, [0, 1], 0); A.boost(); break; }
        case "flop": { const p = at(); R.fx.burst(1, p.x, p.y + 44, Math.round(9 * pf), 180, 0.5, 8, [2, 3], 20); A.flop(); hud = true; break; }
        case "launch": { v.hop = 1; const p = at(); R.fx.burst(1, p.x, p.y + 40, Math.round(14 * pf), 240, 0.6, 9, [2, 3], 40); shake(e.big ? 7 : 4); stop(e.big ? 90 : 50); A.launch(e.big); hud = true; break; }
        case "trick": { v.flip = 0; const p = at(); R.fx.burst(3, p.x, p.y - 30, Math.round((5 + e.n * 3) * pf), 260, 0.8, 8, [0, 1, 5, 6], 160); A.trick(e.n); hud = true; break; }
        case "land": { v.land = 0; const p = at(); R.fx.burst(1, p.x, p.y + 44, Math.round((8 + e.tricks * 5) * pf), 230 + e.tricks * 40, 0.6, 9, [2, 3], 60); if (e.tricks > 0) R.fx.emit(4, p.x, p.y + 44, 0, 0, 0, 0.5, 26, 5); shake(2 + e.tricks * 2); A.land(e.tricks); hud = true; break; }
        case "span": {
          const p = at(); const w = R.W;
          if (e.open) {
            const col = e.biome === 3 ? [0, 3, 5] : e.biome === 4 ? [2, 3, 4] : [0, 1, 3, 5];
            R.fx.burst(3, w / 2, p.y - 120, Math.round(22 * pf), 340, 1, 9, col, 300); R.fx.burst(2, w / 2, p.y - 100, Math.round(16 * pf), 300, 0.8, 7, [2, 3, 4], 500);
            shake(8); stop(120);
          } else { R.fx.burst(1, w / 2, p.y - 80, Math.round(10 * pf), 120, 0.7, 10, [2], 30); shake(2); }
          A.span(e.open, e.biome); hud = true; break;
        }
        case "breath": this.guessed = true; A.breath(); hud = true; break;
        case "finish": {
          v.hop = 0; v.spin = 0; v.spinKind = 1;
          const pos = R.penguinPos({ x: s.x, cam: v.cam }); // sparse celebration (WCAG 2.3.1: no full-screen flashes; small, slow confetti)
          R.fx.burst(3, pos.x, pos.y - 60, Math.round(16 * pf), 280, 1.2, 8, [0, 5, 6, 4], 240);
          hud = true; break;
        }
        default: break;
      }
    }
    if (hud) this.emitHud();
  }
}
export { COSMETICS };
