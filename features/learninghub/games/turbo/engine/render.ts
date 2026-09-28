// Canvas2D renderer for Turbo Slide: a neon dusk highway (skyline, moon, roadside lamps), oncoming "answer cars" one
// per lane carrying the gate's options, Pip riding a rocket sled. It only READS the deterministic Sim (already
// interpolated by the caller, see ../../penguin/engine/game.ts) and the visual state `Vis` - it never changes the
// game, and it never reveals the correct lane before a gate resolves. Reduced motion / Calm: no shake, no parallax
// drift, fewer particles, no speed lines (docs A rules 18-20; WCAG 2.3.1 - no full-screen flashes anywhere).
import type { Sim } from "../core";
import { laneCenter } from "../core";
import { JUICE } from "../../penguin/config";
import { clamp, easeOut, lerp, Particles } from "./fx";

export interface PassedGate { gate: unknown; dist0: number; lane: number; kind: "correct" | "wrong" | "miss"; t0: number }
export interface Vis {
  t: number; cam: number; hop: number; bonk: number; spin: number; spinKind: 0 | 1 | 2; stretchT: number; squashT: number; dir: number; windup: number;
  passed: PassedGate | null; flash: number; wind: number; rush: number; lockGlow: number; goldPulse: number; mult: number; guide: boolean; finish: number; blink: number;
  shift: { serial: number; prev: number[]; t: number } | null;
  danger: number; hopScale: number;
  legT: number; bossFill: number; defeat: number; flip: number; land: number; aura: number; skid: number; bossRoar: number; friendX: number; throwT: number; throwX: number;
  pend: number;
}
export const newVis = (): Vis => ({
  t: 0, cam: 0, hop: 1, bonk: 1, spin: 1, spinKind: 0, stretchT: 9, squashT: 9, dir: 0, windup: 0, passed: null, flash: 0, wind: 0, rush: 0, lockGlow: 0, goldPulse: 0, mult: 1,
  guide: false, finish: 0, blink: 0, shift: null, danger: 0, hopScale: 1, legT: 9, bossFill: 0, defeat: 0, flip: 1, land: 1, aura: 0, skid: 1, bossRoar: 1, pend: 0, friendX: 0, throwT: 1, throwX: 0,
});
export interface Frame { sim: Sim | null; lanes: 3 | 4; x: number; vx: number; dist: number; gd: number; speed: number; tick: number; vis: Vis; hovering: boolean }
export interface RenderOpts { calm: boolean; reduced: boolean; font: string; biome: number; radar: boolean }

const TAU = Math.PI * 2;
const hash = (n: number) => { let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const INK = "#0c1450";

export class Renderer {
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; cx = 0; yh = 0; yCar = 0; roadHalfNear = 0; roadHalfFar = 0;
  fx = new Particles(320);
  opts: RenderOpts;
  private shakeAmp = 0; private shakeT = 0;
  private buildings: { w: number; h: number; lit: number[] }[] = [];

  constructor(public canvas: HTMLCanvasElement, opts: RenderOpts) {
    this.opts = opts;
    this.ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 24; i++) this.buildings.push({ w: 26 + hash(i * 7) * 34, h: 40 + hash(i * 13 + 3) * 140, lit: Array.from({ length: 5 }, (_, k) => hash(i * 31 + k)) });
  }
  resize(w: number, h: number, dpr: number) {
    this.W = Math.max(200, Math.floor(w)); this.H = Math.max(240, Math.floor(h)); this.dpr = dpr;
    this.canvas.width = Math.floor(this.W * dpr); this.canvas.height = Math.floor(this.H * dpr);
    this.cx = this.W / 2; this.yh = this.H * 0.36; this.yCar = this.H * 0.86;
    this.roadHalfNear = this.W * 0.46; this.roadHalfFar = this.W * 0.045;
  }
  setOpts(o: Partial<RenderOpts>) { this.opts = { ...this.opts, ...o }; }
  nudge(amp: number) { if (this.opts.reduced || this.opts.calm) return; this.shakeAmp = amp * Math.max(0.6, (this.W / 1440) * 1.2); this.shakeT = JUICE.shakeMs / 1000; }
  pf() { return this.opts.reduced || this.opts.calm ? (JUICE.reducedParticleFactor ?? 0.35) : 1; }
  /** depth 0 = at the car (bottom), 1 = the horizon. */
  private roadHalfAt(depth: number) { return lerp(this.roadHalfNear, this.roadHalfFar, depth); }
  private yAt(depth: number) { return lerp(this.yCar, this.yh, depth); }
  private scaleAt(depth: number) { return lerp(1, 0.16, depth); }
  private px(worldX: number, depth: number, cam: number) { return this.cx + cam * (1 - depth) * 0.5 + worldX * this.roadHalfAt(depth); }
  screenToWorldX(clientX: number, cam: number) { const r = this.canvas.getBoundingClientRect(); return (clientX - r.left - this.cx - cam * 0.5) / this.roadHalfNear; }
  penguinPos(f: { x: number; cam: number }) { return { x: this.px(f.x, 0.02, f.cam), y: this.yCar - 8 }; }
  blockPos(lane: number, lanes: number, cam: number) { const depth = 0.14; return { x: this.px(laneCenter(lane, lanes), depth, cam), y: this.yAt(depth) }; }

  draw(f: Frame, dt: number) {
    const ctx = this.ctx;
    if (this.shakeT > 0) { this.shakeT = Math.max(0, this.shakeT - dt); this.shakeAmp *= 0.86; } else this.shakeAmp = 0;
    const sx = this.shakeT > 0 ? (Math.random() - 0.5) * 2 * this.shakeAmp : 0, sy = this.shakeT > 0 ? (Math.random() - 0.5) * 2 * this.shakeAmp : 0;
    this.fx.update(dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save(); ctx.translate(sx, sy);
    const reduced = this.opts.reduced || this.opts.calm;
    const cam = f.vis.cam;

    this.drawSky(ctx, f, reduced);
    this.drawSkyline(ctx, f);
    this.drawRoad(ctx, f, cam);
    this.drawProps(ctx, f, cam);
    if (f.sim?.gate) this.drawGate(ctx, f, f.sim.gate as { opts: (number | null)[]; perm: number[]; boss: boolean }, cam);
    this.drawResolveFlash(ctx, f, cam);
    this.drawSled(ctx, f, cam, reduced);
    this.fx.draw(ctx);
    ctx.restore();
  }

  private drawSky(ctx: CanvasRenderingContext2D, f: Frame, reduced: boolean) {
    const W = this.W, H = this.H;
    const g = ctx.createLinearGradient(0, 0, 0, this.yh + 10);
    g.addColorStop(0, "#0b1440"); g.addColorStop(0.55, "#2a1f6b"); g.addColorStop(1, "#8a4a5a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.yh + 10);
    // moon
    const mx = W * 0.78, my = this.yh * 0.32, mr = Math.min(W, H) * 0.075;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.4);
    mg.addColorStop(0, "rgba(255,230,180,.55)"); mg.addColorStop(1, "rgba(255,230,180,0)");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff0c8"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    if (!reduced) {
      for (let i = 0; i < 26; i++) {
        const t = (hash(i) + f.vis.t * 0.01) % 1, x = (hash(i * 3 + 1) * W), y = hash(i * 5 + 2) * this.yh * 0.7;
        const tw = 0.5 + 0.5 * Math.sin(f.vis.t * 2 + i * 3);
        ctx.globalAlpha = 0.4 + tw * 0.5; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 1.6, 1.6); void t;
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawSkyline(ctx: CanvasRenderingContext2D, f: Frame) {
    const W = this.W, base = this.yh + 6, scroll = (f.dist * 6) % (W * 1.4);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, base + 2); ctx.clip();
    let x = -scroll;
    let i = 0;
    while (x < W + 60) {
      const b = this.buildings[i % this.buildings.length]!;
      ctx.fillStyle = "#141a52"; ctx.fillRect(x, base - b.h, b.w, b.h);
      ctx.fillStyle = "rgba(255,201,51,.55)";
      for (let k = 0; k < b.lit.length; k++) if (b.lit[k]! > 0.55) ctx.fillRect(x + 4 + (k % 3) * (b.w / 3.4), base - b.h + 8 + Math.floor(k / 3) * 14, 4, 5);
      x += b.w + 6; i++;
    }
    ctx.restore();
  }

  private drawRoad(ctx: CanvasRenderingContext2D, f: Frame, cam: number) {
    const { cx, yh, yCar } = this;
    ctx.beginPath();
    ctx.moveTo(cx - this.roadHalfNear + cam * 0.5, yCar); ctx.lineTo(cx + this.roadHalfNear + cam * 0.5, yCar);
    ctx.lineTo(cx + this.roadHalfFar + cam * 0.25, yh); ctx.lineTo(cx - this.roadHalfFar + cam * 0.25, yh);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, yh, 0, yCar); g.addColorStop(0, "#232a6a"); g.addColorStop(1, "#161c46");
    ctx.fillStyle = g; ctx.fill();
    // lane dividers (scrolling)
    const lanes = f.lanes; const dashPhase = (f.dist * 4) % 40;
    ctx.strokeStyle = "rgba(220,236,255,.55)"; ctx.lineWidth = 2;
    for (let l = 1; l < lanes; l++) {
      const wx = -1 + (2 * l) / lanes;
      ctx.beginPath();
      for (let s = -dashPhase; s < 44; s += 20) {
        const d0 = clamp(s / 44, 0, 1), d1 = clamp((s + 10) / 44, 0, 1);
        ctx.moveTo(this.px(wx, d0, cam), this.yAt(d0)); ctx.lineTo(this.px(wx, d1, cam), this.yAt(d1));
      }
      ctx.stroke();
    }
    // road edges (glow strip)
    ctx.strokeStyle = "rgba(255,201,51,.5)"; ctx.lineWidth = 3;
    for (const wx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(this.px(wx, 0, cam), this.yCar); ctx.lineTo(this.px(wx, 1, cam), this.yh); ctx.stroke(); }
  }

  private drawProps(ctx: CanvasRenderingContext2D, f: Frame, cam: number) {
    const spacing = 18, phase = (f.dist * 1.6) % spacing;
    for (let i = -1; i < 6; i++) {
      const d = clamp(1 - (i * spacing + phase) / (spacing * 6), 0, 1);
      if (d <= 0.02) continue;
      for (const side of [-1, 1] as const) {
        const wx = side * 1.14; const x = this.px(wx, d, cam), y = this.yAt(d), s = this.scaleAt(d);
        ctx.fillStyle = "#0e1442"; ctx.fillRect(x - 2 * s, y - 30 * s, 3 * s, 30 * s);
        ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(x, y - 31 * s, 4.5 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,216,74,.25)"; ctx.beginPath(); ctx.arc(x, y - 31 * s, 11 * s, 0, TAU); ctx.fill();
      }
    }
  }

  private drawGate(ctx: CanvasRenderingContext2D, f: Frame, g: { opts: (number | null)[]; perm: number[]; boss: boolean }, cam: number) {
    const depth = clamp(f.gd / 40, 0.05, 0.98);
    const y = this.yAt(depth), scale = this.scaleAt(depth) * 1.3;
    for (let lane = 0; lane < f.lanes; lane++) {
      const val = g.opts[g.perm[lane]!]; if (val === null || val === undefined) continue;
      const x = this.px(laneCenter(lane, f.lanes), depth, cam);
      const w = 58 * scale, h = 40 * scale;
      const near = depth < 0.22 && f.hovering && lane === Math.round(((f.x + 1) / 2) * (f.lanes - 1));
      ctx.save();
      ctx.translate(x, y);
      // car body (a plate carrying the number)
      ctx.fillStyle = g.boss ? "#ff5a6a" : "#2f45d8"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, 3 * scale);
      roundRect(ctx, -w / 2, -h / 2, w, h, 9 * scale); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(180,205,255,.85)"; roundRect(ctx, -w / 2 + 4 * scale, -h / 2 + 4 * scale, w - 8 * scale, h * 0.42, 5 * scale); ctx.fill();
      if (near && f.vis.pend > 0.01) { ctx.strokeStyle = `rgba(255,201,51,${0.5 + 0.4 * Math.sin(f.vis.t * 8)})`; ctx.lineWidth = 3 * scale; roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12 * scale); ctx.stroke(); }
      ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 4.5 * scale); ctx.lineJoin = "round";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${Math.round(22 * scale)}px "Lilita One", "Fredoka", sans-serif`;
      ctx.strokeText(String(val), 0, 1); ctx.fillText(String(val), 0, 1);
      ctx.restore();
    }
  }

  private drawResolveFlash(ctx: CanvasRenderingContext2D, f: Frame, cam: number) {
    const p = f.vis.passed; if (!p) return;
    const age = f.vis.t - p.t0; if (age > 0.5 || age < 0) return;
    const a = 1 - age / 0.5;
    const pos = this.blockPos(p.lane, f.lanes, cam);
    ctx.save(); ctx.globalAlpha = a * 0.5;
    // No green anywhere in the games (standing content rule): this flash used to be #3ddc84 (a green), swapped for a
    // sky blue that reads just as clearly as "correct" against the wrong/miss reds and golds.
    ctx.fillStyle = p.kind === "correct" ? "#4ac8ff" : p.kind === "wrong" ? "#ff4a63" : "#ffc933";
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 44 * (1 + (1 - a) * 0.6), 0, TAU); ctx.fill();
    ctx.restore();
  }

  private drawSled(ctx: CanvasRenderingContext2D, f: Frame, cam: number, reduced: boolean) {
    const pos = this.penguinPos({ x: f.x, cam });
    const lean = clamp(f.vx * 26, -0.5, 0.5);
    const hopK = easeOut(clamp(f.vis.hop, 0, 1)); const bonkK = 1 - easeOut(clamp(f.vis.bonk, 0, 1));
    const bob = Math.sin(f.vis.t * 8) * 2 * (reduced ? 0.3 : 1) - hopK * 14;
    const sx = 1 + bonkK * 0.12, sy = 1 - bonkK * 0.12;
    ctx.save(); ctx.translate(pos.x, pos.y + bob); ctx.rotate(lean * 0.35); ctx.scale(sx, sy);
    // flame exhaust
    if (!reduced) {
      const flen = 22 + Math.min(1, f.speed * 40) * 26;
      const fg = ctx.createLinearGradient(0, 22, 0, 22 + flen);
      fg.addColorStop(0, "rgba(255,201,51,.9)"); fg.addColorStop(0.5, "rgba(255,120,60,.6)"); fg.addColorStop(1, "rgba(255,90,60,0)");
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(9, 22); ctx.lineTo(0, 22 + flen); ctx.closePath(); ctx.fill();
    }
    // sled runner
    ctx.fillStyle = "#ffc933"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    roundRect(ctx, -30, 14, 60, 12, 6); ctx.fill(); ctx.stroke();
    // body (Pip)
    ctx.fillStyle = "#1a2470"; ctx.beginPath(); ctx.ellipse(0, -6, 20, 24, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, 2, 12, 15, 0, 0, TAU); ctx.fill();
    // cap
    ctx.fillStyle = "#10154f"; ctx.beginPath(); ctx.moveTo(-15, -26); ctx.lineTo(15, -26); ctx.lineTo(0, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffc933"; ctx.beginPath(); ctx.arc(0, -40, 3, 0, TAU); ctx.fill();
    // eyes
    const blink = f.vis.blink > 0.6 ? 0.15 : 1;
    ctx.fillStyle = INK;
    for (const ex of [-6, 6]) { ctx.beginPath(); ctx.ellipse(ex, -12, 3, 4 * blink, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
