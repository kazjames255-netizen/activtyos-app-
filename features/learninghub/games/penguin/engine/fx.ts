// Particles (pooled, no allocation while playing) and small helpers for the renderer. Visual only: the deterministic core never reads any of this.

export type PKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 spark, 1 snow puff, 2 ice shard, 3 star, 4 ring, 5 heart, 6 snowflake, 7 bubble
export interface P { on: boolean; k: PKind; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; rot: number; vr: number; col: number }
export const COLS = ["#ffce4a", "#fff3c2", "#ffffff", "#bfe6ff", "#8fc8ff", "#c9b8ff", "#ff9ec7", "#ff8a3c", "#ffb35c"] as const;

export class Particles {
  pool: P[];
  private i = 0;
  constructor(n = 360) { this.pool = Array.from({ length: n }, () => ({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 1, rot: 0, vr: 0, col: 0 })); }
  emit(k: PKind, x: number, y: number, vx: number, vy: number, g: number, life: number, size: number, col: number, vr = 0) {
    for (let n = 0; n < this.pool.length; n++) {
      const p = this.pool[(this.i + n) % this.pool.length]!;
      if (p.on) continue;
      this.i = (this.i + n + 1) % this.pool.length;
      p.on = true; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g; p.life = life; p.max = life; p.size = size; p.rot = 0; p.vr = vr; p.col = col;
      return;
    }
  }
  burst(k: PKind, x: number, y: number, n: number, speed: number, life: number, size: number, cols: number[], g = 600, rnd: () => number = Math.random) {
    for (let j = 0; j < n; j++) {
      const a = rnd() * Math.PI * 2, s = speed * (0.35 + rnd() * 0.65);
      this.emit(k, x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.25, g, life * (0.6 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), cols[j % cols.length]!, (rnd() - 0.5) * 12);
    }
  }
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.k === 1) { p.vx *= 0.98; }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.pool) {
      if (!p.on) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = p.k === 4 ? a * 0.8 : Math.min(1, a * 1.6);
      ctx.fillStyle = COLS[p.col]!; ctx.strokeStyle = COLS[p.col]!;
      if (p.k === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, 6.283); ctx.fill(); }
      else if (p.k === 1) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.7), 0, 6.283); ctx.fill(); }
      else if (p.k === 2) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(0, -p.size * 0.6); ctx.lineTo(p.size, p.size * 0.2); ctx.closePath(); ctx.fill(); ctx.restore(); }
      else if (p.k === 3) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a1 = (i * 4 * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a1) * p.size, Math.sin(a1) * p.size); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      else if (p.k === 5) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.15); const r = p.size; ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.7, -r * 1.3, 0, -r * 0.4); ctx.bezierCurveTo(r * 0.7, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9); ctx.fill(); ctx.restore(); }
      else if (p.k === 6) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.lineWidth = Math.max(1.2, p.size * 0.28); ctx.lineCap = "round"; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a1 = (i * Math.PI) / 3; ctx.moveTo(Math.cos(a1) * p.size, Math.sin(a1) * p.size); ctx.lineTo(-Math.cos(a1) * p.size, -Math.sin(a1) * p.size); } ctx.stroke(); ctx.restore(); }
      else if (p.k === 7) { ctx.lineWidth = Math.max(1.2, p.size * 0.25); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.7 + (1 - a) * 0.5), 0, 6.283); ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.16, 0, 6.283); ctx.fill(); }
      else { ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2.2 - a * 1.9), 0, 6.283); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
}
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
