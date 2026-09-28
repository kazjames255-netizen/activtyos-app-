// Canvas2D renderer for Penguin Slide: a pseudo-3D ice run (perspective road, parallax ridges or a cave ceiling, slow aurora, weather, roadside props), answer blocks / ramps /
// crystals as physical objects on gates, the boss chaser, the host character, particles. It only READS the deterministic Sim (interpolated by the caller) and the visual state
// `Vis`; it never changes the game. Every biome is data (theme.ts LOOKS): a new world skin is a new BiomeLook, not new code.
// Reduced motion / Calm: no shake, no parallax drift, ~80% fewer particles, no speed lines, muted palette (docs A rules 18-20). No full-screen flashes anywhere (WCAG 2.3.1).

import type { Gate, Obj, Sim } from "../core";
import { CHASE_START, HOVER_D, bossNeed, laneCenter } from "../core";
import { drawBoss } from "./bosses";
import { friendOf } from "../config";
import { drawFriend } from "../characters/friends";
import { drawObj, drawShadow, drawSign, drawSpan } from "./objects";
import { JUICE, THEME, SKIN_LOOK, lookOf, type BiomeLook, type Theme } from "../theme";
import type { Skin } from "../config";
import { clamp, easeOut, Particles } from "./fx";

export interface PassedGate { gate: Gate; dist0: number; lane: number; kind: "correct" | "wrong" | "miss"; t0: number }
export interface Vis {
  t: number; cam: number; hop: number; bonk: number; spin: number; spinKind: 0 | 1 | 2; stretchT: number; squashT: number; dir: number; windup: number;
  passed: PassedGate | null; flash: number; wind: number; rush: number; lockGlow: number; goldPulse: number; mult: number; guide: boolean; finish: number; blink: number;
  /** moving gates: the blocks slide from `prev` lane order to the gate's current one over `t` 0..1 */
  shift: { serial: number; prev: number[]; t: number } | null;
  /** boss chaser: 0 = far away, 1 = on your heels (a smooth visual of the sim's meter) */
  danger: number; hopScale: number;
  /** slide-game visuals: seconds since the last leg started (drives set-piece animation), boss fill / defeat 0..1, trick flip 0..1, landing squash, hit blink, streak aura, ledge skid */
  legT: number; bossFill: number; defeat: number; flip: number; land: number; aura: number; skid: number; bossRoar: number; friendX: number; /** counter-throw (Yeti division-aim): 0..1 flight, and the lane x it was aimed from */ throwT: number; throwX: number;
  /** 0..1: the child has picked a lane but not locked it: a gold dashed ring with a tick around the penguin says "tap me / press Space to lock in" */ pend: number;
}
export const newVis = (): Vis => ({ t: 0, cam: 0, hop: 1, bonk: 1, spin: 1, spinKind: 0, stretchT: 9, squashT: 9, dir: 0, windup: 0, passed: null, flash: 0, wind: 0, rush: 0, lockGlow: 0, goldPulse: 0, mult: 1, guide: false, finish: 0, blink: 0, shift: null, danger: 0, hopScale: 1, legT: 9, bossFill: 0, defeat: 0, flip: 1, land: 1, aura: 0, skid: 1, bossRoar: 1, pend: 0, friendX: 0, throwT: 1, throwX: 0 });
export interface Frame { sim: Sim | null; lanes: 3 | 4; x: number; vx: number; dist: number; gd: number; speed: number; tick: number; vis: Vis; hovering: boolean }
export interface RenderOpts { calm: boolean; reduced: boolean; font: string; cosmetics: string[]; theme?: Theme; biome: number; skin: Skin; radar: boolean }

const KZ = 0.045;
const TAU = Math.PI * 2;
const hash = (n: number) => { let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class Renderer {
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; cx = 0; yh = 0; yP = 0; rh0 = 0; laneW = 0; penW = 90;
  fx = new Particles(360);
  opts: RenderOpts;
  private th: Theme; private look: BiomeLook;
  private sky: HTMLCanvasElement | null = null;
  private ridge: HTMLCanvasElement[] = [];
  private flakes: { x: number; y: number; v: number; s: number; l: number }[] = [];
  private shakeAmp = 0; private shakeT = 0;
  constructor(public canvas: HTMLCanvasElement, opts: RenderOpts) {
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("no 2d context");
    this.opts = { ...opts, biome: opts.biome ?? 1, skin: opts.skin ?? "junior", radar: opts.radar ?? false }; this.ctx = c; this.th = opts.theme ?? THEME; this.look = lookOf(this.opts.biome);
    for (let i = 0; i < 130; i++) this.flakes.push({ x: Math.random(), y: Math.random(), v: 0.4 + Math.random() * 0.9, s: 0.6 + Math.random() * 1.6, l: (i % 3) as number });
  }
  setOpts(o: Partial<RenderOpts>) { const b = this.opts.biome; this.opts = { ...this.opts, ...o }; if (o.biome !== undefined && o.biome !== b) { this.look = lookOf(o.biome); this.sky = null; } }

  resize(w: number, h: number, dpr: number) {
    this.W = Math.max(200, Math.floor(w)); this.H = Math.max(240, Math.floor(h)); this.dpr = dpr;
    this.canvas.width = Math.floor(this.W * dpr); this.canvas.height = Math.floor(this.H * dpr);
    this.cx = this.W / 2; this.yh = this.H * 0.27;
    this.yP = Math.min(this.H * 0.8, this.H - 150);
    this.rh0 = Math.min(this.W * 0.47, (this.yP - this.yh) * 0.86, 520);
    this.sky = null; this.ridge = [];
  }
  private s(z: number) { return 1 / (1 + z * KZ); }
  private y(z: number) { return this.yh + (this.yP - this.yh) * this.s(z); }
  private px(x: number, s: number, cam: number) { return this.cx + x * this.rh0 * s - cam * s; }

  // ── static layers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  private buildStatic() {
    const { W, yh } = this; const L = this.look;
    const sky = document.createElement("canvas"); sky.width = Math.ceil(W * this.dpr); sky.height = Math.ceil((yh + 4) * this.dpr);
    const g = sky.getContext("2d")!; g.scale(this.dpr, this.dpr);
    const gr = g.createLinearGradient(0, 0, 0, yh);
    gr.addColorStop(0, L.sky[0]); gr.addColorStop(0.55, L.sky[1]); gr.addColorStop(1, L.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, yh + 4);
    const glow = g.createRadialGradient(W / 2, yh, 4, W / 2, yh, W * (L.sun ? 0.75 : 0.55));
    glow.addColorStop(0, L.sun ? "rgba(255,240,184,.85)" : "rgba(201,184,255,.55)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, yh + 4);
    if (L.cave) { // a cave ceiling: dark rock with stalactites and a few glowing crystals
      g.fillStyle = "#050d24"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, yh * 0.45);
      let x = W; let i = 0; while (x > -40) { const w = 40 + hash(i++) * 70, h = 18 + hash(i++) * yh * 0.55; g.lineTo(x - w / 2, yh * 0.45 + h); g.lineTo(x - w, yh * 0.45 + hash(i++) * 14); x -= w; }
      g.lineTo(0, 0); g.closePath(); g.fill();
      for (let k = 0; k < 40; k++) { const cxk = hash(k * 5) * W, cyk = hash(k * 5 + 1) * yh * 0.55 + 6; g.fillStyle = k % 3 ? "rgba(127,227,255,.75)" : "rgba(155,123,255,.8)"; g.beginPath(); g.moveTo(cxk, cyk - 5); g.lineTo(cxk + 3, cyk); g.lineTo(cxk, cyk + 6); g.lineTo(cxk - 3, cyk); g.closePath(); g.fill(); }
    }
    this.sky = sky;
    if (!L.ridge) { this.ridge = []; return; }
    const cols = L.ridge;
    this.ridge = [0, 1].map((layer) => {
      const c = document.createElement("canvas"); const w = Math.ceil(W * 1.4), h = Math.ceil(yh * 0.72);
      c.width = Math.ceil(w * this.dpr); c.height = Math.ceil(h * this.dpr);
      const r = c.getContext("2d")!; r.scale(this.dpr, this.dpr);
      const peaks: [number, number][] = []; let x = -20; let i = layer * 100;
      while (x < w + 40) { peaks.push([x, h - (0.28 + hash(i++) * (layer ? 0.5 : 0.62)) * h]); x += (layer ? 60 : 90) + hash(i++) * 90; }
      r.beginPath(); r.moveTo(-20, h + 2); for (const [px, py] of peaks) r.lineTo(px, py); r.lineTo(w + 40, h + 2); r.closePath();
      const rg = r.createLinearGradient(0, 0, 0, h); rg.addColorStop(0, layer ? cols[1] : cols[0]); rg.addColorStop(1, layer ? "#141d52" : "#1d2a6e");
      r.fillStyle = rg; r.fill();
      r.fillStyle = cols[2]; r.globalAlpha = layer ? 0.55 : 0.4;
      for (const [px, py] of peaks) { const sz = (layer ? 10 : 16) + hash(px + layer) * 10; r.beginPath(); r.moveTo(px, py); r.lineTo(px - sz, py + sz * 1.1); r.lineTo(px - sz * 0.3, py + sz * 0.8); r.lineTo(px + sz * 0.1, py + sz * 1.25); r.lineTo(px + sz * 0.6, py + sz * 0.75); r.lineTo(px + sz, py + sz * 1.1); r.closePath(); r.fill(); }
      r.globalAlpha = 1;
      return c;
    });
  }

  // ── frame ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  private zoomOut = 0; private bossAim = 0; private bossAtk = 0; private bossPt = { x: 0, y: 0 };
  draw(f: Frame, dtIn: number) {
    const ctx = this.ctx; const { W, H } = this; const dt = Math.min(0.05, dtIn); const L = this.look;
    if (!this.sky) this.buildStatic();
    const calm = this.opts.calm, reduced = this.opts.reduced || calm;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.direction = "ltr"; // maths notation and lane order never mirror (RTL pages included)
    let sx = 0, sy = 0;
    if (this.shakeT > 0 && !reduced) { this.shakeT -= dt; const k = Math.max(0, this.shakeT / (JUICE.shakeMs / 1000)); sx = (Math.random() - 0.5) * 2 * this.shakeAmp * k; sy = (Math.random() - 0.5) * 2 * this.shakeAmp * k * 0.6; }
    ctx.save(); ctx.translate(sx, sy);
    // camera pull-back on a jump: ease out ~6-9% while Percy is airborne so a big launch never leaves the frame (no zoom in, none at all in reduced motion / calm)
    const zt = !reduced && f.sim && f.sim.air > 0 ? (f.sim.airMax > 60 ? 0.09 : 0.05) : 0; this.zoomOut += (zt - this.zoomOut) * (1 - Math.exp(-dt * 7));
    if (this.zoomOut > 0.002) { const z = 1 - this.zoomOut; ctx.translate(W / 2, this.yP); ctx.scale(z, z); ctx.translate(-W / 2, -this.yP); }
    const cam = reduced ? 0 : f.vis.cam;
    ctx.fillStyle = L.sky[0]; ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
    ctx.drawImage(this.sky!, -W * 0.1, -H * 0.1, W * 1.2, this.yh + 4 + H * 0.1);
    if (L.stars) this.stars(f.vis.t, reduced);
    if (L.aurora) this.aurora(f.vis.t, calm, reduced);
    if (L.sun) this.sunRays(f.vis.t, reduced);
    const off = reduced ? 0 : -cam * 0.06;
    if (this.ridge.length) {
      ctx.drawImage(this.ridge[0]!, -W * 0.2 + off * 0.6, this.yh - this.ridge[0]!.height / this.dpr + 6, this.ridge[0]!.width / this.dpr, this.ridge[0]!.height / this.dpr);
      ctx.drawImage(this.ridge[1]!, -W * 0.2 + off, this.yh - this.ridge[1]!.height / this.dpr + 14, this.ridge[1]!.width / this.dpr, this.ridge[1]!.height / this.dpr);
    }
    const gg = ctx.createLinearGradient(0, this.yh, 0, H); gg.addColorStop(0, L.ground[0]); gg.addColorStop(0.35, L.ground[1]); gg.addColorStop(1, L.ground[2]);
    ctx.fillStyle = gg; ctx.fillRect(-W * 0.2, this.yh - 1, W * 1.4, H - this.yh + 12);
    const hz = ctx.createLinearGradient(0, this.yh - 30, 0, this.yh + 70); hz.addColorStop(0, "rgba(201,184,255,0)"); hz.addColorStop(0.35, L.sun ? "rgba(255,236,190,.6)" : L.cave ? "rgba(82,200,255,.28)" : "rgba(214,200,255,.55)"); hz.addColorStop(1, "rgba(214,232,255,0)");
    ctx.fillStyle = hz; ctx.fillRect(-W * 0.2, this.yh - 30, W * 1.4, 100);
    if (L.weather === "clouds") this.cloudSea(f, cam, reduced);
    this.road(f, cam);
    this.props(f, cam);
    if (f.sim?.cfg.chaser) this.boss(f, cam, reduced);
    this.world(f, cam, reduced);
    if (f.sim && f.sim.phase === "finish") this.finishLine(f, cam);
    this.penguin(f, cam, dt);
    this.fx.update(dt); this.fx.draw(ctx);
    if (!reduced && f.vis.rush > 0.05) this.speedLines(f);
    ctx.restore();
    this.weather(f, dt, calm);
    if (L.cave && f.sim && !calm) this.lantern(f, cam);
    else if (L.dim > 0) { ctx.fillStyle = `rgba(4,10,34,${L.dim * (calm ? 0.6 : 1)})`; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createLinearGradient(0, H - 170, 0, H); vg.addColorStop(0, "rgba(232,242,255,0)"); vg.addColorStop(1, L.cave ? "rgba(20,60,120,.5)" : L.dim > 0.1 ? "rgba(110,130,180,.45)" : "rgba(223,236,255,.55)");
    ctx.fillStyle = vg; ctx.fillRect(0, H - 170, W, 170);
    const sk = SKIN_LOOK[this.opts.skin];
    if (calm) { ctx.fillStyle = "rgba(200,208,230,.10)"; ctx.fillRect(0, 0, W, H); }
    else if (sk.sat < 1) { // Explorer: drain the colour (a duller, cooler, more serious world) and lay a steel-blue wash over it
      ctx.save(); ctx.globalCompositeOperation = "saturation"; ctx.globalAlpha = 1 - sk.sat; ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = sk.washAlpha; ctx.fillStyle = sk.wash; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  nudge(amp: number) { if (this.opts.reduced || this.opts.calm) return; this.shakeAmp = amp * Math.max(0.6, this.W / 1440 * 1.2); this.shakeT = JUICE.shakeMs / 1000; }

  private stars(t: number, reduced: boolean) {
    const ctx = this.ctx;
    for (let i = 0; i < 55; i++) {
      const x = hash(i * 3) * this.W, y = hash(i * 3 + 1) * this.yh * 0.62, tw = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * (0.6 + hash(i) * 0.9) + i);
      ctx.globalAlpha = tw * 0.85; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  private aurora(t: number, calm: boolean, reduced: boolean) {
    const ctx = this.ctx; const bands = this.look.aurora!; ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const b of bands) {
      const n = 26; const base = this.yh * (0.12 + b.y * 2.2); const amp = this.H * b.amp;
      const gr = ctx.createLinearGradient(0, base - amp * 2, 0, base + this.yh * 0.5);
      const al = (calm ? this.th.calm.auroraAlpha : b.alpha);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.25, hexA(b.a, al)); gr.addColorStop(0.6, hexA(b.b, al * 0.6)); gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr; ctx.beginPath();
      const ph = reduced ? 0 : t * b.speed * 6;
      for (let i = 0; i <= n; i++) { const x = (i / n) * this.W; const y = base + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.014 - ph * 1.7) * amp * 0.45; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      for (let i = n; i >= 0; i--) { const x = (i / n) * this.W; const y = base + this.yh * 0.5 + Math.sin(x * 0.005 - ph * 0.8) * amp * 0.6; ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  private sunRays(t: number, reduced: boolean) {
    const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.19 + (reduced ? 0 : Math.sin(t * 0.05 + i) * 0.012); const g = ctx.createLinearGradient(this.cx, this.yh, this.cx + Math.cos(a) * this.H, this.yh + Math.sin(a) * this.H); g.addColorStop(0, "rgba(255,240,190,.22)"); g.addColorStop(1, "rgba(255,240,190,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(this.cx, this.yh); ctx.lineTo(this.cx + Math.cos(a - 0.05) * this.H, this.yh + Math.sin(a - 0.05) * this.H); ctx.lineTo(this.cx + Math.cos(a + 0.05) * this.H, this.yh + Math.sin(a + 0.05) * this.H); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  /** Summit: a sea of clouds either side of the ridge line. */
  private cloudSea(f: Frame, cam: number, reduced: boolean) {
    const ctx = this.ctx;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1; const z = ((i * 11 - f.dist * 0.4) % 176 + 176) % 176 - 6; const s = this.s(z); if (s > 1.6) continue;
      const x = this.px(side * (1.9 + hash(i) * 1.2), s, cam), yy = this.y(z) - this.rh0 * s * 0.05; const u = this.rh0 * s * (0.5 + hash(i + 9) * 0.5);
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(x, yy, u * 0.9, u * 0.28, 0, 0, TAU); ctx.ellipse(x - u * 0.5, yy + u * 0.05, u * 0.55, u * 0.22, 0, 0, TAU); ctx.ellipse(x + u * 0.55, yy + u * 0.06, u * 0.6, u * 0.2, 0, 0, TAU); ctx.fill();
    }
    void reduced;
  }

  private road(f: Frame, cam: number) {
    const ctx = this.ctx; const L = this.look; const lanes = f.lanes;
    const zFar = 900, zNear = -9;
    const edge = 1.09;
    const q = (x: number, z: number) => [this.px(x, this.s(z), cam), this.y(z)] as const;
    const [fl, fy] = q(-edge, zFar), [fr] = q(edge, zFar), [nl, ny] = q(-edge, zNear), [nr] = q(edge, zNear);
    const gr = ctx.createLinearGradient(0, this.yh, 0, this.H); gr.addColorStop(0, L.road[0]); gr.addColorStop(0.18, L.road[1]); gr.addColorStop(0.6, L.road[2]); gr.addColorStop(1, L.road[3]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(fl, fy); ctx.lineTo(fr, fy); ctx.lineTo(nr, ny); ctx.lineTo(nl, ny); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = L.edge; ctx.globalAlpha = 0.9; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fl, fy); ctx.lineTo(nl, ny); ctx.moveTo(fr, fy); ctx.lineTo(nr, ny); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(99,140,220,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fl + 3, fy); ctx.lineTo(nl + 8, ny); ctx.moveTo(fr - 3, fy); ctx.lineTo(nr - 8, ny); ctx.stroke();
    const scroll = f.dist * 0.5;
    ctx.fillStyle = L.cave ? "rgba(140,220,255,.14)" : "rgba(255,255,255,.16)";
    for (let i = 0; i < 16; i++) {
      const z = ((i * 6.5 - scroll) % (16 * 6.5) + 16 * 6.5) % (16 * 6.5) - 4; const s = this.s(z); if (s > 1.6) continue;
      const yy = this.y(z), hh = Math.max(1, 7 * s * 0.7); const l = this.px(-edge, s, cam), r = this.px(edge, s, cam);
      ctx.fillRect(l, yy - hh / 2, r - l, hh);
    }
    ctx.strokeStyle = L.cave ? "rgba(160,230,255,.6)" : "rgba(255,255,255,.75)";
    for (let j = 1; j < lanes; j++) {
      const xw = -1 + (2 * j) / lanes;
      for (let i = 0; i < 26; i++) {
        const z0 = ((i * 3.4 - f.dist) % (26 * 3.4) + 26 * 3.4) % (26 * 3.4) - 5, z1 = z0 + 1.7;
        const s0 = this.s(z0), s1 = this.s(z1); if (s0 > 1.7) continue;
        ctx.lineWidth = Math.max(1, 5 * s0); ctx.beginPath(); ctx.moveTo(this.px(xw, s0, cam), this.y(z0)); ctx.lineTo(this.px(xw, s1, cam), this.y(z1)); ctx.stroke();
      }
    }
    if (f.hovering && !this.opts.calm) { ctx.fillStyle = "rgba(255,206,74,.10)"; const l = this.px(-edge, this.s(11), cam), r = this.px(edge, this.s(11), cam); ctx.fillRect(l, this.y(11) - 3, r - l, 6); }
  }

  private props(f: Frame, cam: number) {
    const ctx = this.ctx; const L = this.look; const N = L.props.length; const period = 9;
    const items: { z: number; side: number; k: number }[] = [];
    for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 14; i++) {
      const z = ((i * period - f.dist * 1) % (14 * period) + 14 * period) % (14 * period) - 6;
      items.push({ z, side, k: i * 2 + (side > 0 ? 1 : 0) });
    }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      const s = this.s(it.z); if (s > 1.9 || s < 0.05) continue;
      const kind = L.props[it.k % N]!; const jitter = hash(it.k * 7) * 0.55;
      const x = it.side * (1.42 + jitter); const xx = this.px(x, s, cam), yy = this.y(it.z);
      ctx.save(); ctx.translate(xx, yy); const u = this.rh0 * s * 0.42 * (0.85 + hash(it.k * 11) * 0.45);
      ctx.globalAlpha = clamp((s - 0.05) * 9, 0, 1);
      ctx.fillStyle = "rgba(60,90,170,.18)"; ctx.beginPath(); ctx.ellipse(u * 0.15, 0, u * 0.5, u * 0.12, 0, 0, TAU); ctx.fill();
      this.prop(ctx, kind, u, it.k, L, f.vis.t);
      ctx.restore();
    }
  }
  private prop(ctx: CanvasRenderingContext2D, kind: BiomeLook["props"][number], u: number, k: number, L: BiomeLook, t: number) {
    if (kind === "pine") {
      for (let i = 0; i < 3; i++) {
        const w = u * (0.62 - i * 0.14), y0 = -u * (0.28 + i * 0.34), h = u * 0.5;
        ctx.fillStyle = i % 2 ? L.propTint[1] : L.propTint[0]; ctx.beginPath(); ctx.moveTo(0, y0 - h); ctx.lineTo(w, y0); ctx.lineTo(-w, y0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#f4f9ff"; ctx.beginPath(); ctx.moveTo(0, y0 - h); ctx.lineTo(w * 0.55, y0 - h * 0.42); ctx.lineTo(w * 0.2, y0 - h * 0.6); ctx.lineTo(-w * 0.2, y0 - h * 0.45); ctx.lineTo(-w * 0.55, y0 - h * 0.42); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#3a2f6b"; ctx.fillRect(-u * 0.06, -u * 0.28, u * 0.12, u * 0.28);
    } else if (kind === "igloo") {
      const g = ctx.createLinearGradient(0, -u * 0.8, 0, 0); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#cfe4ff");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 0.7, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(110,150,225,.55)"; ctx.lineWidth = Math.max(1, u * 0.02); for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.arc(0, 0, u * 0.7 * (r / 4 + 0.1), Math.PI, 0); ctx.stroke(); }
      ctx.fillStyle = "#3b4a92"; ctx.beginPath(); ctx.arc(0, 0, u * 0.2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "rgba(255,206,74,.9)"; ctx.beginPath(); ctx.arc(0, -u * 0.02, u * 0.11, Math.PI, 0); ctx.fill();
    } else if (kind === "crystal") {
      const glow = 0.55 + 0.25 * Math.sin(t * 1.6 + k); const c0 = L.propTint[k % 2]!;
      const g = ctx.createRadialGradient(0, -u * 0.5, u * 0.05, 0, -u * 0.5, u * 0.9); g.addColorStop(0, hexA(c0, 0.35 * glow)); g.addColorStop(1, hexA(c0, 0)); ctx.fillStyle = g; ctx.fillRect(-u, -u * 1.5, u * 2, u * 1.6);
      for (let i = 0; i < 4; i++) { const w = u * (0.14 + hash(k + i) * 0.1), h = u * (0.5 + hash(k * 3 + i) * 0.7), x = (i - 1.5) * u * 0.2; ctx.fillStyle = i % 2 ? c0 : "#dff6ff"; ctx.beginPath(); ctx.moveTo(x - w, 0); ctx.lineTo(x - w * 0.4, -h * 0.85); ctx.lineTo(x, -h); ctx.lineTo(x + w * 0.6, -h * 0.8); ctx.lineTo(x + w, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(x - w * 0.4, -h * 0.85); ctx.lineTo(x, -h); ctx.lineTo(x + w * 0.05, -h * 0.3); ctx.closePath(); ctx.fill(); }
    } else if (kind === "stalag") {
      ctx.fillStyle = "#1a3a6e"; ctx.beginPath(); ctx.moveTo(-u * 0.32, 0); ctx.lineTo(-u * 0.05, -u * 1.2); ctx.lineTo(u * 0.05, -u * 1.25); ctx.lineTo(u * 0.34, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(127,227,255,.35)"; ctx.beginPath(); ctx.moveTo(-u * 0.05, -u * 1.2); ctx.lineTo(u * 0.05, -u * 1.25); ctx.lineTo(u * 0.06, -u * 0.3); ctx.closePath(); ctx.fill();
    } else if (kind === "flag") {
      ctx.fillStyle = "#e8e0d0"; ctx.fillRect(-u * 0.03, -u * 1.15, u * 0.06, u * 1.15);
      ctx.fillStyle = k % 2 ? "#ffce4a" : "#3b57d6"; ctx.beginPath(); ctx.moveTo(u * 0.03, -u * 1.12); ctx.lineTo(u * 0.62 + Math.sin(t * 3 + k) * u * 0.05, -u * 0.95); ctx.lineTo(u * 0.03, -u * 0.72); ctx.closePath(); ctx.fill();
    } else if (kind === "cairn") {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? "#dfe8ff" : "#c9d8f5"; ctx.beginPath(); ctx.ellipse(0, -u * (0.1 + i * 0.16), u * (0.36 - i * 0.07), u * 0.1, 0, 0, TAU); ctx.fill(); }
    } else if (kind === "arch") {
      ctx.strokeStyle = L.propTint[1]; ctx.lineWidth = u * 0.16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-u * 0.5, 0); ctx.quadraticCurveTo(-u * 0.5, -u * 1.15, 0, -u * 1.15); ctx.quadraticCurveTo(u * 0.5, -u * 1.15, u * 0.5, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = u * 0.05; ctx.stroke();
    } else { // berg
      const g = ctx.createLinearGradient(0, -u * 1.0, 0, 0); g.addColorStop(0, "#f2fbff"); g.addColorStop(1, "#8ecff2");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-u * 0.6, 0); ctx.lineTo(-u * 0.35, -u * 0.55); ctx.lineTo(-u * 0.1, -u * 0.4); ctx.lineTo(u * 0.12, -u * 0.95); ctx.lineTo(u * 0.4, -u * 0.5); ctx.lineTo(u * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.moveTo(u * 0.12, -u * 0.95); ctx.lineTo(u * 0.4, -u * 0.5); ctx.lineTo(u * 0.1, -u * 0.5); ctx.closePath(); ctx.fill();
    }
  }

  // ── answer objects and gates: physical things in the world ──────────────────────────────────────────────────────────────────────────
  private gate(g: Gate, z: number, f: Frame, cam: number, pass: PassedGate | null) {
    const ctx = this.ctx; const P = this.th.palette; const L = g.opts.length; const look = this.look; const style = f.sim?.cfg.style ?? "blocks";
    const s = this.s(z); if (s > 2.4 || s < 0.05) return;
    const yy = this.y(z); const laneW = (2 * this.rh0) / L * s; const bw = laneW * 0.8, bh = bw * 0.56;
    const t = pass ? f.vis.t - pass.t0 : 0;
    const boss = g.boss;
    const fade = pass ? clamp(1 - (z < 0 ? -z / 6.5 : 0), 0, 1) : 1; if (fade <= 0.01) return;
    ctx.save(); ctx.globalAlpha = fade;
    const pillarH = bh * 3.0, pw = Math.max(4, bw * 0.16);
    const lx = this.px(-1.1, s, cam), rx = this.px(1.1, s, cam);
    const pg = ctx.createLinearGradient(0, yy - pillarH, 0, yy); pg.addColorStop(0, look.frame[0]); pg.addColorStop(1, look.frame[1]);
    ctx.fillStyle = "rgba(60,90,170,.2)"; ctx.beginPath(); ctx.ellipse((lx + rx) / 2, yy + 2 * s, (rx - lx) / 2 + pw, 5 * s + 1, 0, 0, TAU); ctx.fill();
    for (const px of [lx, rx]) { ctx.fillStyle = pg; rr(ctx, px - pw / 2, yy - pillarH, pw, pillarH, pw * 0.3); ctx.fill(); ctx.strokeStyle = "rgba(90,140,220,.6)"; ctx.lineWidth = Math.max(1, s * 2); ctx.stroke(); }
    ctx.fillStyle = boss || style === "summit" ? P.gold : look.frame[2]; rr(ctx, lx - pw * 0.7, yy - pillarH - bh * 0.32, rx - lx + pw * 1.4, bh * 0.36, bh * 0.14); ctx.fill();
    ctx.strokeStyle = boss ? "#c8901a" : "rgba(90,140,220,.7)"; ctx.lineWidth = Math.max(1, s * 2); ctx.stroke();
    const bx = (lx + rx) / 2, by = yy - pillarH + bh * 0.05, bhei = bh * 0.85;
    if (boss) { ctx.fillStyle = P.gold; this.star(ctx, bx, by + bhei * 0.2, bhei * 0.36, 5); }
    if (g.combo) { ctx.fillStyle = P.violet; ctx.font = `800 ${Math.max(10, bhei * 0.5)}px ${this.opts.font}`; ctx.textAlign = "center"; ctx.fillText("✦ 2", bx, by + bhei * 0.75); }
    // options, in lanes (moving gates: interpolated between the previous and current order)
    const sh = f.vis.shift && f.vis.shift.serial === g.serial ? f.vis.shift : null;
    for (let opt = 0; opt < L; opt++) {
      const cur = g.perm.indexOf(opt); let lanePos = cur; let alpha = 1;
      if (sh) { const prev = sh.prev.indexOf(opt); const k = easeOut(clamp(sh.t, 0, 1)); if (Math.abs(cur - prev) > 1) { lanePos = cur; alpha = Math.abs(1 - 2 * k); } else lanePos = prev + (cur - prev) * k; }
      const lc = -1 + (2 * lanePos + 1) / L; const bx0 = this.px(lc, s, cam);
      const dead = g.opts[opt] === null;
      const isCorrect = opt === g.correctLane; const chosen = pass ? pass.lane === cur : false;
      let a = alpha, wob = 0, lift = 0, glow = 0, crack = 0, hide = false;
      if (pass) {
        if (chosen && pass.kind === "correct") hide = t > 0.06;
        else if (chosen && pass.kind === "wrong") { crack = 1; wob = Math.sin(t * 34) * 0.09 * Math.exp(-t * 3.2); a *= 0.85; }
        else if (isCorrect && pass.kind !== "correct") { glow = 0.6 + 0.4 * Math.sin(t * 6); lift = Math.abs(Math.sin(t * 7)) * bh * 0.18 * Math.exp(-t * 1.6); }
        else a *= 0.5;
      } else if (f.vis.guide && isCorrect && !dead) glow = 0.45 + 0.4 * Math.sin(f.vis.t * 4);
      if (dead) { ctx.fillStyle = "rgba(120,170,230,.35)"; ctx.beginPath(); ctx.ellipse(bx0, yy - bh * 0.05, bw * 0.42, bh * 0.16, 0, 0, TAU); ctx.fill(); continue; }
      if (hide) continue;
      ctx.save(); ctx.globalAlpha = a * fade; ctx.translate(bx0, yy - lift); ctx.rotate(wob);
      if (glow) { const gg = ctx.createRadialGradient(0, -bh * 0.5, bh * 0.2, 0, -bh * 0.5, bw * 0.85); gg.addColorStop(0, `rgba(255,206,74,${0.5 * glow})`); gg.addColorStop(1, "rgba(255,206,74,0)"); ctx.fillStyle = gg; ctx.fillRect(-bw, -bh * 2, bw * 2, bh * 3); }
      const label = String(g.opts[opt]);
      if (style === "ramps") this.ramp(ctx, bw, bh, label, crack > 0, glow > 0);
      else if (style === "hazards") this.crystalBlock(ctx, bw, bh, label, crack > 0, glow > 0, t);
      else if (style === "shoals") this.floe(ctx, bw, bh, label, crack > 0, glow > 0, t);
      else this.block(ctx, bw, bh, label, crack > 0, glow > 0, boss || style === "summit");
      if (this.opts.radar && !pass) this.radarChip(ctx, bw, bh, g, g.opts[opt]!);
      ctx.restore();
    }
    ctx.restore();
  }
  /** Fact radar: a small chip on each block naming the table(s) its number belongs to (a scaffold: it costs the third star). */
  private radarChip(ctx: CanvasRenderingContext2D, bw: number, bh: number, g: Gate, n: number) {
    const tabs = [g.a, g.b].filter((t) => n % t === 0); if (!tabs.length) return;
    const P = this.th.palette; ctx.fillStyle = P.violet; rr(ctx, -bw * 0.32, -bh * 1.3, bw * 0.64, bh * 0.26, bh * 0.1); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.max(8, bh * 0.2)}px ${this.opts.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tabs.map((t) => `×${t}`).join(" "), 0, -bh * 1.17);
  }
  private block(ctx: CanvasRenderingContext2D, bw: number, bh: number, label: string, cracked: boolean, glow: boolean, boss: boolean) {
    const P = this.th.palette; const d = bw * 0.13; const r = Math.max(3, bh * 0.16 * SKIN_LOOK[this.opts.skin].blockRadius);
    ctx.fillStyle = "rgba(60,90,170,.22)"; ctx.beginPath(); ctx.ellipse(0, 1, bw * 0.55, bh * 0.15, 0, 0, TAU); ctx.fill();
    const front = ctx.createLinearGradient(0, -bh, 0, 0); front.addColorStop(0, cracked ? "#c9d6ea" : P.blockFront0); front.addColorStop(1, cracked ? P.deadBlock : P.blockFront1);
    ctx.fillStyle = front; rr(ctx, -bw / 2, -bh, bw, bh, r); ctx.fill();
    ctx.fillStyle = cracked ? "#dfe8f6" : P.blockTop; ctx.beginPath(); ctx.moveTo(-bw / 2 + r, -bh); ctx.lineTo(bw / 2 - r, -bh); ctx.lineTo(bw / 2 - r - d * 0.6, -bh - d); ctx.lineTo(-bw / 2 + r + d * 0.6, -bh - d); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = glow ? P.gold : boss ? "#e3b13a" : "rgba(88,140,222,.85)"; ctx.lineWidth = Math.max(1.5, bw * 0.03); rr(ctx, -bw / 2, -bh, bw, bh, r); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.55)"; rr(ctx, -bw / 2 + bw * 0.07, -bh + bh * 0.09, bw * 0.34, bh * 0.1, bh * 0.05); ctx.fill();
    this.plate(ctx, bw, bh, label, -bh * 0.5);
    if (cracked) this.cracks(ctx, bw, bh);
  }
  private plate(ctx: CanvasRenderingContext2D, bw: number, bh: number, label: string, cy: number) {
    const P = this.th.palette; const pw = bw * 0.72, ph = bh * 0.56;
    ctx.fillStyle = P.plate; rr(ctx, -pw / 2, cy - ph / 2, pw, ph, ph * 0.3); ctx.fill();
    ctx.strokeStyle = "rgba(60,90,170,.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = P.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const fs = Math.min(ph * 0.82, (pw * 0.9) / Math.max(1.6, label.length * 0.62)); ctx.font = `${SKIN_LOOK[this.opts.skin].font ? 700 : 800} ${Math.max(9, fs * SKIN_LOOK[this.opts.skin].blockFont)}px ${SKIN_LOOK[this.opts.skin].font || this.opts.font}`;
    ctx.fillText(label, 0, cy + ph * 0.04);
  }
  private cracks(ctx: CanvasRenderingContext2D, bw: number, bh: number) {
    ctx.strokeStyle = "rgba(60,80,130,.75)"; ctx.lineWidth = Math.max(1.5, bw * 0.02); ctx.beginPath(); ctx.moveTo(-bw * 0.05, -bh); ctx.lineTo(bw * 0.02, -bh * 0.66); ctx.lineTo(-bw * 0.06, -bh * 0.42); ctx.lineTo(bw * 0.05, -bh * 0.1); ctx.moveTo(bw * 0.02, -bh * 0.66); ctx.lineTo(bw * 0.2, -bh * 0.55); ctx.stroke();
  }
  /** Aurora Ridge: every answer is a jump ramp. The right one holds and launches the penguin; a wrong one crumbles. */
  private ramp(ctx: CanvasRenderingContext2D, bw: number, bh: number, label: string, cracked: boolean, glow: boolean) {
    const P = this.th.palette; const h = bh * 1.15;
    ctx.fillStyle = "rgba(60,40,150,.32)"; ctx.beginPath(); ctx.ellipse(0, 1, bw * 0.6, bh * 0.17, 0, 0, TAU); ctx.fill();
    // the slope face
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, cracked ? "#cfd2ec" : "#b7a6ff"); g.addColorStop(1, cracked ? "#8f95bf" : "#5b3fc4");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0); ctx.lineTo(bw * 0.4, -h); ctx.lineTo(-bw * 0.4, -h); ctx.closePath(); ctx.fill();
    // a bright lip at the top edge and side walls: reads as a ramp, not a block
    ctx.fillStyle = cracked ? "#dfe2f5" : "#f4eeff"; ctx.beginPath(); ctx.moveTo(-bw * 0.4, -h); ctx.lineTo(bw * 0.4, -h); ctx.lineTo(bw * 0.36, -h - bh * 0.16); ctx.lineTo(-bw * 0.36, -h - bh * 0.16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cracked ? "#a4a9cf" : "#3d2a9a"; ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(-bw * 0.4, -h); ctx.lineTo(-bw * 0.4 - bw * 0.06, -h + bh * 0.05); ctx.lineTo(-bw / 2 - bw * 0.06, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = glow ? P.gold : "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(2, bw * 0.03); ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(-bw * 0.4, -h); ctx.lineTo(bw * 0.4, -h); ctx.lineTo(bw / 2, 0); ctx.stroke();
    // chevrons pointing up the slope
    ctx.strokeStyle = "rgba(255,206,74,.95)"; ctx.lineWidth = Math.max(2, bw * 0.035); ctx.lineJoin = "round";
    for (let i = 0; i < 2; i++) { const y0 = -h * (0.16 + i * 0.22); ctx.beginPath(); ctx.moveTo(-bw * 0.16, y0); ctx.lineTo(0, y0 - bh * 0.16); ctx.lineTo(bw * 0.16, y0); ctx.stroke(); }
    this.plate(ctx, bw * 0.9, bh, label, -h * 0.58);
    if (cracked) this.cracks(ctx, bw, h);
  }
  /** Crystal Caves: answers are crystal clusters; a wrong one is a real hazard (shards). They all look alike until you hit one. */
  private crystalBlock(ctx: CanvasRenderingContext2D, bw: number, bh: number, label: string, cracked: boolean, glow: boolean, t: number) {
    const P = this.th.palette; const h = bh * 1.25;
    ctx.fillStyle = "rgba(20,40,110,.35)"; ctx.beginPath(); ctx.ellipse(0, 1, bw * 0.55, bh * 0.16, 0, 0, TAU); ctx.fill();
    const spikes: [number, number, number][] = [[-0.36, 0.72, 0.13], [-0.18, 1.0, 0.16], [0.02, 1.16, 0.18], [0.22, 0.95, 0.15], [0.38, 0.66, 0.12]];
    spikes.forEach(([x, hh, w], i) => {
      const g = ctx.createLinearGradient(0, -h * hh, 0, 0); g.addColorStop(0, cracked ? "#c9d0e6" : i % 2 ? "#bfeaff" : "#d7c9ff"); g.addColorStop(1, cracked ? "#8a93b8" : i % 2 ? "#3f86d0" : "#6a4fd6");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo((x - w) * bw, 0); ctx.lineTo((x - w * 0.3) * bw, -h * hh * 0.8); ctx.lineTo(x * bw, -h * hh); ctx.lineTo((x + w * 0.7) * bw, -h * hh * 0.75); ctx.lineTo((x + w) * bw, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.moveTo((x - w * 0.3) * bw, -h * hh * 0.8); ctx.lineTo(x * bw, -h * hh); ctx.lineTo((x + w * 0.05) * bw, -h * 0.25); ctx.closePath(); ctx.fill();
    });
    if (glow) { ctx.strokeStyle = P.gold; ctx.lineWidth = Math.max(2, bw * 0.03); ctx.beginPath(); ctx.moveTo(-bw * 0.5, 0); ctx.lineTo(bw * 0.5, 0); ctx.stroke(); }
    this.plate(ctx, bw * 0.9, bh * 0.9, label, -bh * 0.22);
    void t;
  }
  private star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number) {
    ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n; const rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill();
  }
  /** Everything ahead of Percy, far to near: the boss's throws, the objects on the ice, the set piece, the signpost and the gate. */
  private world(f: Frame, cam: number, reduced: boolean) {
    const ctx = this.ctx; const sim = f.sim; if (!sim) return; const vis = f.vis; const L = this.look;
    type It = { z: number; draw: () => void };
    const items: It[] = [];
    const lookO = { biome: sim.cfg.biome, t: vis.t, dark: L.cave && sim.light < 0.3, reduced, font: this.opts.font };
    const rad = 16 + sim.light * 46; // the lantern's reach (caves): hazards beyond it are dim shapes
    for (const o of sim.objs) {
      const z = o.d - f.dist; if (z < -9 || z > 78) continue;
      const s = this.s(z); if (s > 2.2 || s < 0.05) continue;
      items.push({ z, draw: () => this.oneObj(o, z, s, cam, f, lookO, rad, reduced) });
    }
    const sg = sim.sign; if (sg) { const z = sg.d - f.dist; if (z > -6 && z < 60) items.push({ z, draw: () => { const s = this.s(z); const sx = this.px((sim.leg % 2 ? 0.72 : -0.72), s, cam); const txt = sg.op === "x" ? `${sg.shownA} \u00d7 ${sg.shownB} = ${sg.answer}` : sg.op === "d" ? `${sg.shownA} \u00f7 ${sg.shownB} = ${sg.answer}` : `${sg.answer} \u00d7 ${sg.shownA} = ${sg.shownB}`; drawSign(ctx, sx, this.y(z), this.rh0 * s, txt, this.opts.font); } }); }
    const vp = vis.passed; const nearZ = vp ? -(f.dist - vp.dist0) : 9e9;
    if (sim.gate && sim.phase === "approach") items.push({ z: f.gd, draw: () => this.gate(sim.gate!, f.gd, f, cam, null) });
    if (vp) items.push({ z: nearZ, draw: () => this.gate(vp.gate, nearZ, f, cam, vp) });
    items.sort((p, q) => q.z - p.z);
    for (const it of items) it.draw();
    // the ledge: a soft gold band where Percy waits (nothing here is on a clock)
    if (f.hovering && !this.opts.calm) { ctx.fillStyle = "rgba(255,206,74,.10)"; const l = this.px(-1.09, this.s(HOVER_D), cam), r = this.px(1.09, this.s(HOVER_D), cam); ctx.fillRect(l, this.y(HOVER_D) - 3, r - l, 6); }
  }
  private oneObj(o: Obj, z: number, s: number, cam: number, f: Frame, look: { biome: number; t: number; dark: boolean; reduced: boolean; font: string }, rad: number, reduced: boolean) {
    const ctx = this.ctx; const u = this.rh0 * s; const y = this.y(z); const sim = f.sim!;
    const hazard = o.kind === "rock" || o.kind === "ball" || o.kind === "drift";
    let a = clamp((78 - z) / 16, 0, 1) * (z < 0 ? clamp(1 + z / 9, 0, 1) : 1);
    if (this.look.cave && (o.kind === "rock" || o.kind === "ball")) a *= clamp((rad - z) / 12, 0.14, 1);
    if (o.got && o.kind !== "span") return;
    if (o.kind === "span") { ctx.globalAlpha = a; drawSpan(ctx, sim.cfg.biome, !!o.open, this.px(0, s, cam), y, u, u * 1.09, f.vis.legT, reduced); ctx.globalAlpha = 1; return; }
    const x = this.px(o.x, s, cam);
    ctx.globalAlpha = a;
    if (hazard) drawShadow(ctx, x, y, u, o.w, o.kind !== "drift");
    if (o.kind === "star" || o.kind === "hint" || o.kind === "shield") { const uu = u * 0.08; ctx.save(); ctx.translate(x, y - uu * 1.1 + Math.sin(f.vis.t * 4 + o.d) * uu * 0.15); this.power(ctx, { kind: o.kind }, uu, f.vis.t, this.th.palette); ctx.restore(); }
    else drawObj(ctx, o.kind, x, y, u, o.w, Math.floor(o.d * 7 + o.x * 100), look, sim.air > 0);
    ctx.globalAlpha = 1;
  }
  /** The bosses stand at the far end of the ice and come closer as wrong answers let them advance; their weak spot (a gem) fills with gold as answers land. */
  private boss(f: Frame, cam: number, reduced: boolean) {
    const sim = f.sim!; const d = clamp(f.vis.danger, 0, 1); const kind = sim.cfg.chaser!; const need = bossNeed(sim.plan.items.length);
    const fill = clamp(f.vis.bossFill, 0, 1); void need;
    const roar = f.vis.bossRoar < 1 && !reduced ? Math.sin(f.vis.bossRoar * 20) * (1 - f.vis.bossRoar) : 0;
    const hf = kind === "avalanche" ? 2.0 : kind === "serpent" ? 2.3 : kind === "cavein" ? 2.1 : kind === "blizzard" ? 2.5 : 2.0; // body height in radii
    let by = this.yh + (this.yP - this.yh) * (0.05 + 0.5 * d * d) + roar * 4;
    if (kind === "serpent") by = this.yh * 0.98 + (this.yP - this.yh) * 0.25 * d + roar * 4;
    const rWant = this.rh0 * (0.2 + d * 0.6); const rFit = ((by - this.H * 0.045) / hf) * (1 + d * 0.7); // he fits under the HUD while far, and looms over it as he closes in
    const r = Math.min(rWant, rFit);
    const cx = this.cx - cam * 0.08 + roar * 6;
    // the boss ATTACKS what the sim has queued ahead: the Yeti winds up and lobs toward the next snowball's side, the Serpent slides her head over the next aurora ring
    let aimT = 0, atkT = 0;
    if (!reduced && !f.vis.defeat) { for (const o of sim.objs) { const dd = o.d - sim.dist; if (o.got || (o.kind !== "ball" && o.kind !== "ring") || dd < 14 || dd > 34) continue; aimT = o.x; atkT = 1; break; } }
    this.bossAtk += (atkT - this.bossAtk) * (1 - Math.exp(-0.06 * 60 * 0.016 * 4)); this.bossAim += (aimT - this.bossAim) * (1 - Math.exp(-0.06 * 60 * 0.016 * 3));
    this.bossPt = { x: cx, y: by - r * hf * 0.55 };
    drawBoss(this.ctx, kind, cx, by, r * (1 + Math.max(0, roar) * 0.05), { t: f.vis.t, phase: sim.bossPhase, fill, danger: d, defeat: f.vis.defeat, W: this.W, reduced, aim: this.bossAim, atk: this.bossAtk });
  }
  /** Caves: darkness with a lantern. The light around Percy shrinks as the lantern dims and a crystal or an opened door lights it again. */
  private lantern(f: Frame, cam: number) {
    const ctx = this.ctx; const light = f.sim!.light; const p = this.penguinPos({ x: f.x, cam }); const R = this.H * (0.2 + 0.62 * light);
    const g = ctx.createRadialGradient(p.x, p.y, R * 0.25, p.x, p.y, R * 1.35); const dk = 0.3 + (1 - light) * 0.42;
    g.addColorStop(0, "rgba(4,10,34,0)"); g.addColorStop(0.55, `rgba(4,10,34,${dk * 0.55})`); g.addColorStop(1, `rgba(4,10,34,${dk})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
  }
  /** Storm Pass: answers are ice floes. */
  private floe(ctx: CanvasRenderingContext2D, bw: number, bh: number, label: string, cracked: boolean, glow: boolean, t: number) {
    const P = this.th.palette; const sw = Math.sin(t * 2 + bw) * bh * 0.03;
    ctx.fillStyle = "rgba(20,40,120,.3)"; ctx.beginPath(); ctx.ellipse(0, 2, bw * 0.6, bh * 0.2, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, -bh, 0, 0); g.addColorStop(0, cracked ? "#dfe8f6" : "#ffffff"); g.addColorStop(1, cracked ? P.deadBlock : "#a9cdf5");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-bw * 0.52, -bh * 0.1 + sw); ctx.lineTo(-bw * 0.4, -bh * 0.78); ctx.lineTo(-bw * 0.05, -bh * 0.95); ctx.lineTo(bw * 0.38, -bh * 0.82); ctx.lineTo(bw * 0.55, -bh * 0.15 - sw); ctx.quadraticCurveTo(0, bh * 0.08, -bw * 0.52, -bh * 0.1 + sw); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = glow ? P.gold : "rgba(110,160,235,.9)"; ctx.lineWidth = Math.max(2, bw * 0.03); ctx.stroke();
    this.plate(ctx, bw, bh, label, -bh * 0.5); if (cracked) this.cracks(ctx, bw, bh);
  }
  private fish(ctx: CanvasRenderingContext2D, u: number, P: Theme["palette"]) {
    const g = ctx.createLinearGradient(-u, 0, u, 0); g.addColorStop(0, "#ffe58a"); g.addColorStop(1, P.gold);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.9, u * 0.48, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(u * 0.75, 0); ctx.lineTo(u * 1.35, -u * 0.5); ctx.lineTo(u * 1.35, u * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(-u * 0.45, -u * 0.08, u * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(200,140,20,.6)"; ctx.lineWidth = Math.max(1, u * 0.06); ctx.beginPath(); ctx.ellipse(0, 0, u * 0.9, u * 0.48, 0, 0, TAU); ctx.stroke();
  }
  private power(ctx: CanvasRenderingContext2D, p: { kind: string }, u: number, t: number, P: Theme["palette"]) {
    const R = u * 1.6; const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.2); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(127,227,255,.0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = P.royal; ctx.lineWidth = Math.max(1.5, u * 0.12); ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.royal; ctx.strokeStyle = P.royal;
    if (p.kind === "star") { ctx.fillStyle = P.gold; this.star(ctx, 0, 0, R * 0.55, 5); }
    else if (p.kind === "hint") { ctx.lineWidth = Math.max(1.5, u * 0.14); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(-R * 0.08, -R * 0.08, R * 0.32, 0, TAU); ctx.moveTo(R * 0.16, R * 0.16); ctx.lineTo(R * 0.5, R * 0.5); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.lineTo(R * 0.46, -R * 0.3); ctx.lineTo(R * 0.4, R * 0.15); ctx.quadraticCurveTo(0, R * 0.6, 0, R * 0.6); ctx.quadraticCurveTo(0, R * 0.6, -R * 0.4, R * 0.15); ctx.lineTo(-R * 0.46, -R * 0.3); ctx.closePath(); ctx.fill(); }
    void t;
  }
  private finishLine(f: Frame, cam: number) {
    const ctx = this.ctx; const P = this.th.palette; const p = clamp(1 - (f.sim!.phaseLeft / 150), 0, 1);
    const z = 14 - p * 26; const s = this.s(z); if (s > 2.4) return; const yy = this.y(z);
    const l = this.px(-1.1, s, cam), r = this.px(1.1, s, cam); const h = this.rh0 * s * 0.7;
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillRect(l, yy - 3 * s, r - l, 6 * s);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? P.navy : "#fff"; ctx.fillRect(l + ((r - l) / 14) * i, yy - 3 * s, (r - l) / 14, 3 * s); }
    ctx.fillStyle = P.gold; rr(ctx, l - 6 * s, yy - h, 12 * s, h, 4 * s); ctx.fill(); rr(ctx, r - 6 * s, yy - h, 12 * s, h, 4 * s); ctx.fill();
    ctx.fillStyle = P.royal; ctx.beginPath(); ctx.moveTo(l, yy - h); ctx.lineTo(r, yy - h); ctx.lineTo(r - 10 * s, yy - h * 0.82); ctx.lineTo((l + r) / 2, yy - h * 0.86); ctx.lineTo(l + 10 * s, yy - h * 0.82); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? P.gold : "#fff"; this.star(ctx, l + ((r - l) / 8) * i, yy - h * 0.88, 7 * s, 5); }
  }
  // ── the penguin ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  private penguin(f: Frame, cam: number, dt: number) {
    const ctx = this.ctx; const v = f.vis; const reduced = this.opts.reduced || this.opts.calm; const sk = SKIN_LOOK[this.opts.skin];
    const laneW = (2 * this.rh0) / f.lanes; this.laneW = laneW;
    const size = clamp(laneW * 0.62, 78, 190) * sk.penguin; this.penW = size;
    const x = this.px(f.x, 1, cam); let y = this.yP; const sim = f.sim;
    let sx = 1, sy = 1;
    // the slide game: airborne (a ramp launched Percy), belly-flopping, blinking after a bump, glowing on a streak
    let lift = 0; if (sim && sim.air > 0) { const pp = 1 - sim.air / Math.max(1, sim.airMax); lift = Math.sin(pp * Math.PI) * size * (sim.airMax > 60 ? 1.7 : 1.05) * (reduced ? 0.5 : 1); }
    const flopping = !!sim && sim.flop > 0 && !reduced;
    if (lift > 0) { ctx.fillStyle = "rgba(30,40,110,.28)"; ctx.beginPath(); ctx.ellipse(x, this.yP + size * 0.02, size * 0.5 * (1 - Math.min(0.5, lift / (size * 3))), size * 0.09, 0, 0, TAU); ctx.fill(); }
    if (v.aura > 0.02 && !reduced) { const gy = this.yP - size * 0.45 - lift; const ag = ctx.createRadialGradient(x, gy, size * 0.15, x, gy, size * (0.75 + v.aura * 0.55)); ag.addColorStop(0, `rgba(255,214,96,${0.16 + v.aura * 0.26})`); ag.addColorStop(1, "rgba(255,214,96,0)"); ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x, gy, size * (0.75 + v.aura * 0.55), 0, TAU); ctx.fill(); }
    if (!reduced) {
      if (v.stretchT < JUICE.stretchMs / 1000) { const k = v.stretchT / (JUICE.stretchMs / 1000); sx = 1 + (JUICE.stretch - 1) * (1 - k); sy = 1 - (JUICE.stretch - 1) * 0.6 * (1 - k); }
      else if (v.squashT < JUICE.squashMs / 1000) { const k = v.squashT / (JUICE.squashMs / 1000); sx = 1 - (1 - JUICE.squash) * (1 - k) * 0.6; sy = 1 + (1 - JUICE.squash) * (1 - k); }
    }
    if (v.hop < 1) { const k = v.hop; y -= Math.sin(k * Math.PI) * size * (reduced ? 0.06 : 0.5 * v.hopScale); if (!reduced) { const pp = k < 0.3 ? easeOut(k / 0.3) : 1; sx *= 1 + (JUICE.correctPulse - 1) * Math.sin(Math.min(1, k * 3) * Math.PI) * pp; sy *= 1 + (JUICE.correctPulse - 1) * Math.sin(Math.min(1, k * 3) * Math.PI) * pp; } }
    else if (reduced && v.hop < 1) { const c = 1 + (JUICE.reducedPulse - 1) * Math.sin(v.hop * Math.PI); sx *= c; sy *= c; }
    y -= lift;
    if (flopping) { sx *= 1.22; sy *= 0.6; y += size * 0.1; }
    if (v.land < 1 && !reduced) { const k = 1 - v.land; sx *= 1 + 0.28 * k; sy *= 1 - 0.26 * k; }
    let tilt = clamp(f.vx * 6, -0.28, 0.28) - v.windup * JUICE.windupLean * (reduced ? 0 : 1) + (v.flip < 1 && !reduced ? v.flip * TAU : 0) + (flopping ? 0.18 : 0);
    if (v.bonk < 1) { const k = v.bonk; tilt += Math.sin(k * 26) * 0.14 * (1 - k); y += Math.sin(k * Math.PI) * -size * 0.04; sy *= 1 - 0.1 * Math.sin(k * Math.PI); }
    let face = true; let scaleX = 1;
    if (v.spin < 1 && !reduced) { const c = Math.cos(v.spin * TAU); scaleX = Math.max(0.08, Math.abs(c)); face = c > 0; }
    const eyes: "open" | "happy" | "oops" = v.bonk < 1 ? "oops" : (v.hop < 1 || v.spinKind === 1) && v.spin < 1 ? "happy" : "open";
    const cs = this.opts.cosmetics; const has = (id: string) => cs.includes(id);
    const rainbow = has("rainbow");
    // trail cosmetics: snow puffs (default), gold sparks, little stars, a rainbow, bubbles, snowflakes, embers, hearts
    const tk: { k: 0 | 1 | 3 | 5 | 6 | 7; col: (n: number) => number; size: number; vy: number } = has("hearts") ? { k: 5, col: () => 6, size: 5, vy: 70 } : has("flakes") ? { k: 6, col: () => 2, size: 5, vy: 60 } : has("bubbles") ? { k: 7, col: () => 3, size: 6, vy: -20 } : has("embers") ? { k: 0, col: (n) => 7 + (n % 2), size: 3.4, vy: 40 } : has("stars") ? { k: 3, col: () => 0, size: 5, vy: 90 } : rainbow ? { k: 0, col: (n) => [0, 6, 5, 3, 4][n % 5]!, size: 4, vy: 90 } : has("sparkle") ? { k: 0, col: () => 1, size: 2.6, vy: 90 } : { k: 1, col: () => 2, size: size * 0.03, vy: 90 };
    if (!reduced && f.speed > 0.05 && Math.random() < Math.min(0.7, f.speed * 2.4) * 0.5) this.fx.emit(tk.k, x + (Math.random() - 0.5) * size * 0.5, this.yP + size * 0.02, (Math.random() - 0.5) * 30, tk.vy + f.speed * 240 * (tk.vy < 0 ? -0.2 : 1), tk.k === 7 ? -30 : 20, 0.45 + (tk.k === 7 ? 0.35 : 0), tk.k === 1 ? tk.size + Math.random() * 3 : tk.size, tk.col(Math.floor(f.tick / 3)), tk.k === 5 || tk.k === 6 ? (Math.random() - 0.5) * 4 : 0);
    if (v.lockGlow > 0.02) { ctx.fillStyle = `rgba(255,206,74,${0.35 * v.lockGlow})`; ctx.beginPath(); ctx.ellipse(x, this.yP + size * 0.02, size * 0.7 * (0.9 + v.lockGlow * 0.2), size * 0.14, 0, 0, TAU); ctx.fill(); }
    if (v.pend > 0.02) { // the confirm ring: the answer is only locked when the child says so
      const cy = this.yP - size * 0.46 - lift, rr = size * 0.66 * (1 + (reduced ? 0 : 0.05 * Math.sin(v.t * 5))); ctx.save();
      ctx.lineWidth = Math.max(3, size * 0.05); ctx.strokeStyle = `rgba(255,206,74,${0.35 + 0.65 * v.pend})`; ctx.setLineDash([size * 0.16, size * 0.1]); ctx.lineDashOffset = reduced ? 0 : -v.t * size * 0.3;
      ctx.beginPath(); ctx.arc(x, cy, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const bx = x + rr * 0.72, by = cy - rr * 0.72, br = size * 0.15; ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#1b2350"; ctx.lineWidth = Math.max(2.5, br * 0.32); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(bx - br * 0.5, by + br * 0.02); ctx.lineTo(bx - br * 0.12, by + br * 0.4); ctx.lineTo(bx + br * 0.52, by - br * 0.36); ctx.stroke(); ctx.restore();
    }
    if (sim && sim.inv > 0 && !reduced && Math.floor(f.tick / 4) % 2) ctx.globalAlpha = 0.45;
    this.th.character.draw(ctx, this.th.palette, x, y, size, { tilt, sx: sx * scaleX, sy, face, eyes, blink: v.blink, t: v.t, cosmetics: this.opts.cosmetics, wing: clamp(f.speed * 1.6 + Math.abs(f.vx) * 8, 0, 1), still: reduced, skin: this.opts.skin });
    ctx.globalAlpha = 1;
    // a friend freed this run slides along beside Percy and reaches for fish
    if (sim?.friend) {
      const sp = friendOf(sim.cfg.biome); const want = x + (f.x > 0.1 ? -1 : 1) * size * 0.82; if (v.friendX === 0) v.friendX = want; v.friendX += (want - v.friendX) * (1 - Math.exp(-dt * 6));
      ctx.save(); ctx.translate(v.friendX, this.yP + size * 0.02 - lift * 0.5); drawFriend(ctx, sp, size * 0.56, { t: v.t, still: reduced, hop: v.hop < 1 ? Math.sin(v.hop * Math.PI) : 0 }); ctx.restore();
    } else v.friendX = 0;
    // Yeti division-aim: the counter-throw flies from Percy toward the Yeti (the sim already decided where the next wave's gap opens: where he stood)
    if (v.throwT < 1) {
      v.throwT = Math.min(1, v.throwT + dt / 0.7); const k = v.throwT, bx = this.bossPt.x, by = this.bossPt.y; const px = x + (bx - x) * k, py = (this.yP - size * 0.7) + (by - (this.yP - size * 0.7)) * k - Math.sin(k * Math.PI) * size * 0.9;
      const rr = size * 0.16 * (1 - k * 0.5); ctx.fillStyle = "#fff"; ctx.strokeStyle = "#8ec4f2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); ctx.stroke();
    }
    void dt;
  }
  private speedLines(f: Frame) {
    const ctx = this.ctx; const a = clamp(f.vis.rush, 0, 1) * 0.32; const cx = this.cx - f.vis.cam * 0.2, cy = this.yh;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const ang = (hash(i) - 0.5) * 2.6 + Math.PI / 2; const p = ((f.vis.t * 1.7 + hash(i + 40)) % 1); const r0 = p * p * this.H * 1.05, r1 = r0 + this.H * 0.14 * p;
      ctx.lineWidth = 1 + p * 2.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); ctx.stroke();
    }
  }
  private weather(f: Frame, dt: number, calm: boolean) {
    const ctx = this.ctx; const L = this.look; const reduced = this.opts.reduced || calm;
    if (f.sim && Math.abs(f.sim.wind) > 0.0002 && !reduced) this.windStreaks(f);
    const wind = f.vis.wind * (L.weather === "blizzard" ? 3.2 : 1); const n = reduced ? 46 : this.flakes.length;
    if (L.weather === "clouds") return;
    if (L.weather === "blizzard") {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineCap = "round";
      for (let i = 0; i < (reduced ? 30 : 100); i++) {
        const fl = this.flakes[i % this.flakes.length]!; const lay = 1 + fl.l * 0.7;
        fl.y += (fl.v * 0.5 + 0.2) * lay * dt; fl.x += (0.28 + wind * 0.06) * lay * dt; if (fl.y > 1.05) { fl.y = -0.05; fl.x = Math.random() - 0.2; } if (fl.x > 1.05) fl.x = -0.05;
        const px = fl.x * this.W, py = fl.y * this.H; ctx.lineWidth = 0.8 + fl.l * 0.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 14 * lay, py - 20 * lay); ctx.stroke();
      }
      return;
    }
    if (L.weather === "motes") {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < (reduced ? 18 : 42); i++) { const fl = this.flakes[i]!; fl.y -= fl.v * 0.02 * dt * (reduced ? 0.4 : 1); fl.x += Math.sin(f.vis.t * 0.5 + i) * 0.004 * dt; if (fl.y < -0.03) { fl.y = 1.03; fl.x = Math.random(); } const R = 2 + fl.s * 2.2; const gx = fl.x * this.W, gy = fl.y * this.H; const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 3); g.addColorStop(0, i % 2 ? "rgba(127,227,255,.55)" : "rgba(180,150,255,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, R * 3, 0, TAU); ctx.fill(); }
      ctx.restore(); return;
    }
    ctx.fillStyle = "#fff";
    for (let i = 0; i < n; i++) {
      const fl = this.flakes[i]!; const lay = 1 + fl.l * 0.7;
      fl.y += (fl.v * 0.05 + f.speed * 0.02) * lay * dt * (reduced ? 0.5 : 1); fl.x += (wind * 0.02 + Math.sin(f.vis.t * 0.7 + i) * 0.004) * lay * dt * (this.opts.reduced ? 0.3 : 1);
      if (fl.y > 1.02) { fl.y = -0.02; fl.x = Math.random(); } if (fl.x > 1.02) fl.x = -0.02; if (fl.x < -0.02) fl.x = 1.02;
      ctx.globalAlpha = 0.35 + fl.l * 0.2; ctx.beginPath(); ctx.arc(fl.x * this.W, fl.y * this.H, fl.s * (0.7 + fl.l * 0.45), 0, TAU); ctx.fill();
      if (L.weather === "sparkle" && !reduced && i % 9 === 0) { const tw = 0.5 + 0.5 * Math.sin(f.vis.t * 1.7 + i); ctx.globalAlpha = tw * 0.7; ctx.fillStyle = i % 2 ? "#ffd86a" : "#ffb4e6"; this.star(ctx, fl.x * this.W, fl.y * this.H, 4 + fl.s * 2, 4); ctx.fillStyle = "#fff"; }
    }
    ctx.globalAlpha = 1;
  }

  /** Gusts you can SEE: long streaks in the direction the wind is pushing Percy (the sim's real wind, not decoration). */
  private windStreaks(f: Frame) {
    const ctx = this.ctx; const w = f.sim!.wind; const dir = Math.sign(w); const k = clamp(Math.abs(w) / 0.0012, 0, 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + k * 0.3})`; ctx.lineCap = "round"; ctx.lineWidth = 1.5 + k;
    for (let i = 0; i < 6 + Math.round(k * 16); i++) {
      const sp = 0.35 + hash(i + 40) * 0.5; const x = (((hash(i) + dir * f.vis.t * sp) % 1) + 1) % 1 * this.W; const y = this.H * (0.12 + hash(i + 9) * 0.7); const len = this.W * (0.04 + k * 0.09) * (0.5 + hash(i + 3));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir * len, y + len * 0.05); ctx.stroke();
    }
  }
  // ── effect helpers the game calls ────────────────────────────────────────────────────────────────────────────────────────────────────
  penguinPos(f: { x: number; cam: number }) { return { x: this.px(f.x, 1, f.cam), y: this.yP - this.penW * 0.5 }; }
  blockPos(lane: number, lanes: number, cam: number) { return { x: this.px(laneCenter(lane, lanes), 1, cam), y: this.yP - this.laneW * 0.25 }; }
  screenToWorldX(clientX: number, cam: number) { const r = this.canvas.getBoundingClientRect(); return ((clientX - r.left - this.cx + cam) / this.rh0); }
  pf() { return this.opts.reduced || this.opts.calm ? JUICE.reducedParticleFactor : 1; }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
export { CHASE_START };
