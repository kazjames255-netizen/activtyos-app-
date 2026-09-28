// Turns keys / pointer / lane taps into the core's quantised input (steer -3..3, act 0/1) once per tick. All of it lives on the CLIENT: what the server
// re-simulates is only the logged (steer, act) stream, so however clever this autopilot is, the result is still computed by the server.
// Ice controls: hold left/right = thrust; let go and the penguin drifts to the nearest lane centre ("magnetic lanes"). MOVING NEVER ANSWERS (core v3): a lane is locked only by a deliberate act:
//   - tapping / clicking an answer pad (the round buttons under the ice),
//   - tapping the lane Percy is already resting in (his answer block, or the gold "lock in" ring around him),
//   - pressing Space or Enter (once; a held key does nothing) after the ledge has been reached for 0.3 s.
// Releasing an arrow key, lifting a finger after a drag, or simply stopping to read only positions the penguin. There are no number-key shortcuts.
import { ACC, DRAG, HOVER_D, laneCenter, laneOf, steerToward, type Sim } from "../core";
import { JUICE } from "../theme";

const LEDGE_GRACE = 18;
export class Input {
  private held = 0;                  // -1 left, +1 right (keyboard)
  private keys = new Set<string>();
  private targetLane: number | null = null;
  private dragX: number | null = null;
  private dragging = false;
  private actNext = false;
  private pulseGap = 0;
  private buffered: { lane: number; at: number } | null = null;
  private downX = 0; private downAt = 0; private moved = false; private tapPx = 0;
  /** the lane the penguin is in right now (set every tick, so a tap can tell 'the lane I am resting in' from 'another lane') */
  private curLane = 0; private ledgeTick = -1; private seenGate = -1;
  /** Set for one tick when the child starts a move from standing (the renderer uses it for the ~70 ms wind-up lean). */
  started = 0;
  /** Latest steer just sent (for audio). */
  lastSteer = 0;
  touched = false;
  constructor(private worldX: (clientX: number) => number, private lanes: () => number, private calm: () => boolean) {}

  // ── events (wired by the component) ─────────────────────────────────────────────────────────────────────────────────────────────────
  keyDown(e: KeyboardEvent): boolean {
    const k = e.key; const L = this.lanes();
    if (e.repeat && (k === "ArrowLeft" || k === "ArrowRight" || k === "a" || k === "d" || k === "A" || k === "D")) return true;
    if (k === "ArrowLeft" || k === "a" || k === "A") { this.keys.add("L"); this.held = -1; this.targetLane = null; this.dragX = null; this.started = -1; return true; }
    if (k === "ArrowRight" || k === "d" || k === "D") { this.keys.add("R"); this.held = 1; this.targetLane = null; this.dragX = null; this.started = 1; return true; }
    if (k === " " || k === "Enter") { if (!e.repeat) this.actNext = true; return true; } // one press = one act: a held or mashed key never commits by repeat
    void L;
    return false;
  }
  keyUp(e: KeyboardEvent): boolean {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.delete("L"); else if (k === "ArrowRight" || k === "d" || k === "D") this.keys.delete("R"); else return false;
    this.held = this.keys.has("R") ? 1 : this.keys.has("L") ? -1 : 0;
    if (this.held === 0) this.release = true;   // only positions the penguin (glides to the nearest lane); it does NOT answer
    return true;
  }
  private release = false;
  /** A one-tick tap: belly-flop / trick while travelling, lock in on the ledge (the on-screen button and Space both come here). */
  tapAct() { this.actNext = true; }
  /** A tap on an answer pad: glide to that lane and lock it in on arrival (a deliberate press on the chosen answer). */
  chooseLane(i: number) { this.targetLane = Math.max(0, Math.min(this.lanes() - 1, i)); this.dragX = null; this.dragging = false; this.started = 1; this.touched = true; this.pendingSettleAct = true; }
  private pendingSettleAct = false;
  pointerDown(clientX: number, now = performance.now()) { this.dragging = true; this.dragX = clamp(this.worldX(clientX), -1, 1); this.targetLane = null; this.touched = true; this.pendingSettleAct = false; this.started = 0; this.downX = clientX; this.downAt = now; this.moved = false; this.tapPx = clientX; }
  pointerMove(clientX: number) { if (!this.dragging) return; this.dragX = clamp(this.worldX(clientX), -1, 1); if (Math.abs(clientX - this.downX) > 12) this.moved = true; }
  /** Lifting a finger after a DRAG only lets the penguin glide to the nearest lane. A short TAP on the lane he already rests in confirms it; a tap on another lane just moves him there (tap it again to confirm). */
  pointerUp(now = performance.now()) {
    if (!this.dragging) return;
    this.dragging = false;
    const tap = !this.moved && now - this.downAt < 450;
    const lane = laneOf(clamp(this.worldX(this.tapPx), -1, 1), this.lanes());
    this.targetLane = tap ? lane : this.dragX !== null ? laneOf(this.dragX, this.lanes()) : lane;
    if (tap && lane === this.curLane) this.pendingSettleAct = true;
    this.dragX = null;
  }
  reset() { this.held = 0; this.keys.clear(); this.targetLane = null; this.dragX = null; this.dragging = false; this.actNext = false; this.release = false; this.pendingSettleAct = false; this.buffered = null; this.started = 0; this.ledgeTick = -1; this.seenGate = -1; this.moved = false; }
  /** A gate has just been resolved: a request made during hit-recovery is buffered (JUICE.inputBufferMs), an old one is dropped. */
  clearForNewGate() { this.pendingSettleAct = false; if (this.targetLane !== null && !this.calm()) { /* keep steering to it: the lane is still where the child wanted to be */ } }

  // ── one tick ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  next(sim: Sim): { steer: number; act: 0 | 1 } {
    const r = this.nextRaw(sim);
    // a melted lane (a hint fish took its block away) is not an answer: never lock it in, and the pending pad / ring never points at it
    const g = sim.gate; if (r.act && sim.phase === "approach" && g && g.opts[g.perm[this.curLane]!] === null) { this.pendingSettleAct = false; return { steer: r.steer, act: 0 }; }
    return r;
  }
  private nextRaw(sim: Sim): { steer: number; act: 0 | 1 } {
    const L = sim.cfg.lanes;
    let steer = 0; let act: 0 | 1 = 0;
    const g = sim.gate; const onLedge = sim.phase === "approach" && !!g && g.gd <= HOVER_D + 0.5;
    this.curLane = sim.cfg.calm ? sim.target : laneOf(sim.x, L);
    if (g && g.serial !== this.seenGate) { this.seenGate = g.serial; this.ledgeTick = -1; }
    if (onLedge && this.ledgeTick < 0) this.ledgeTick = sim.tick;
    if (this.actNext) {
      this.actNext = false;
      // while travelling the act is the belly-flop / trick. On the ledge it is "lock in": ignored for 0.3 s after arriving, so mashing Space to flop can never answer by accident.
      if (sim.phase !== "approach") act = 1; else if (onLedge && this.ledgeTick >= 0 && sim.tick - this.ledgeTick >= LEDGE_GRACE) act = 1;
    }
    if (this.calm()) {
      // snap physics: one rising edge = one lane step; target lane walks there one pulse at a time
      if (this.pulseGap > 0) { this.pulseGap--; }
      else if (this.held !== 0) { if (sim.lastSteer === 0) { steer = this.held; this.pulseGap = 3; this.held = 0; this.keys.clear(); } }
      else {
        const tl = this.targetLane ?? (this.dragging && this.dragX !== null ? laneOf(this.dragX, L) : null);
        if (tl !== null && tl !== sim.target && sim.lastSteer === 0) { steer = tl > sim.target ? 1 : -1; this.pulseGap = 3; }
        else if (tl !== null && tl === sim.target && this.pendingSettleAct && Math.abs(sim.x - laneCenter(tl, L)) < 0.05 && !this.dragging) { if (onLedge) { act = 1; this.pendingSettleAct = false; this.targetLane = null; } }
      }
      this.lastSteer = steer; this.started = 0;
      return { steer, act };
    }
    if (this.held !== 0) { steer = this.held * 3; this.release = false; }
    else {
      if (this.release) { // key let go: glide to the nearest lane centre from where the ice would carry us
        const rest = sim.x + sim.vx * (1 / (1 - DRAG)) * 0.55;
        this.targetLane = laneOf(Math.max(-1, Math.min(1, rest)), L); this.release = false; this.pendingSettleAct = false;
      }
      let tx: number | null = null;
      if (this.dragging && this.dragX !== null) tx = this.dragX;
      else if (this.targetLane !== null) tx = laneCenter(this.targetLane, L);
      if (tx !== null) {
        steer = steerToward(sim, tx);
        const arrived = Math.abs(sim.x - tx) < (this.dragging ? 0.03 : 0.05) && Math.abs(sim.vx) < 0.006;
        if (arrived && !this.dragging) { if (this.pendingSettleAct) { if (onLedge) { act = 1; this.pendingSettleAct = false; } else if (sim.phase !== "approach") this.pendingSettleAct = false; } if (!this.pendingSettleAct) this.targetLane = null; steer = 0; }
      }
    }
    void ACC; void JUICE;
    this.lastSteer = steer;
    return { steer, act };
  }
  /** Direction the child just began moving (consumed once). */
  consumeStart(): number { const s = this.started; this.started = 0; return s; }
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
