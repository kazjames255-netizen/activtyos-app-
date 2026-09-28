// The five bosses, drawn as CHARACTERS with a face: they stand at the far end of the run and come closer as wrong answers let them advance. Each has a weak spot
// (a gem) that fills with gold as correct answers land, three phases (gruffer each time) and a defeat moment. Visual only: the sim owns fill / phase / defeat.
import type { ChaserKind } from "../config";

export interface BossPose { t: number; phase: 1 | 2 | 3; fill: number; danger: number; defeat: number; W: number; reduced: boolean; /** where the next projectile is (-1..1) and how busy the boss is attacking (0..1) */ aim?: number; atk?: number }
const TAU = Math.PI * 2;

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, er: number, o: BossPose, look = 0) {
  const angry = o.phase === 1 ? 0.25 : o.phase === 2 ? 0.65 : 1;
  for (const sd of [-1, 1]) {
    const ex = x + sd * gap;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, y, er, er * 1.15, 0, 0, TAU); ctx.fill();
    if (o.defeat > 0.2) { ctx.strokeStyle = "#1b2350"; ctx.lineWidth = er * 0.28; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ex - er * 0.5, y - er * 0.5); ctx.lineTo(ex + er * 0.5, y + er * 0.5); ctx.moveTo(ex + er * 0.5, y - er * 0.5); ctx.lineTo(ex - er * 0.5, y + er * 0.5); ctx.stroke(); continue; }
    ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(ex + look * er * 0.3, y + er * 0.12, er * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + look * er * 0.3 + er * 0.16, y - er * 0.05, er * 0.16, 0, TAU); ctx.fill();
    // brows: flat when calm, slanted down toward the nose when cross
    ctx.strokeStyle = "#1b2350"; ctx.lineWidth = er * 0.38; ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(ex - sd * er * 1.15, y - er * (1.5 + 0.9 * angry)); ctx.lineTo(ex + sd * er * 1.1, y - er * (1.5 - 0.15 - 0.55 * angry)); ctx.stroke();
  }
}
function mouth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, o: BossPose) {
  ctx.strokeStyle = "#1b2350"; ctx.fillStyle = "#3a1240"; ctx.lineWidth = w * 0.09; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (o.defeat > 0.2) { ctx.beginPath(); ctx.arc(x, y + w * 0.1, w * 0.18, 0, TAU); ctx.stroke(); return; }
  if (o.phase === 1) { ctx.beginPath(); ctx.moveTo(x - w * 0.4, y + w * 0.08); ctx.quadraticCurveTo(x, y - w * 0.12, x + w * 0.4, y + w * 0.08); ctx.stroke(); }
  else {
    const open = o.phase === 3 ? 0.42 + Math.sin(o.t * 9) * (o.reduced ? 0 : 0.05) : 0.28;
    ctx.beginPath(); ctx.moveTo(x - w * 0.42, y); ctx.quadraticCurveTo(x, y + w * open * 1.6, x + w * 0.42, y); ctx.quadraticCurveTo(x, y - w * 0.12, x - w * 0.42, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * w * 0.16, y - w * 0.02); ctx.lineTo(x + sd * w * 0.26, y - w * 0.02); ctx.lineTo(x + sd * w * 0.21, y + w * 0.1); ctx.closePath(); ctx.fill(); }
  }
}
/** The weak spot: an outlined gem that fills from the bottom with gold as correct answers land, and cracks. */
function gem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: BossPose) {
  const pul = o.reduced ? 0 : 0.5 + 0.5 * Math.sin(o.t * 4);
  const g = ctx.createRadialGradient(x, y, s * 0.2, x, y, s * (1.9 + pul * 0.5)); g.addColorStop(0, `rgba(255,206,74,${0.35 + o.fill * 0.4})`); g.addColorStop(1, "rgba(255,206,74,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 2.4, 0, TAU); ctx.fill();
  const path = () => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y - s * 0.25); ctx.lineTo(x + s * 0.5, y + s * 0.9); ctx.lineTo(x - s * 0.5, y + s * 0.9); ctx.lineTo(x - s * 0.8, y - s * 0.25); ctx.closePath(); };
  path(); ctx.fillStyle = "rgba(20,30,100,.85)"; ctx.fill();
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = "#ffce4a"; const top = y + s * 0.9 - o.fill * s * 1.9; ctx.fillRect(x - s, top, s * 2, y + s * 2 - top); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(x - s * 0.35, y - s * 0.7, s * 0.2, s * 1.2); ctx.restore();
  path(); ctx.strokeStyle = "#fff3c2"; ctx.lineWidth = Math.max(2, s * 0.14); ctx.stroke();
  if (o.fill > 0.4) { ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 0.9); ctx.lineTo(x + s * 0.12, y - s * 0.3); ctx.lineTo(x - s * 0.1, y + s * 0.1); ctx.stroke(); }
  if (o.fill > 0.75) { ctx.beginPath(); ctx.moveTo(x + s * 0.12, y - s * 0.3); ctx.lineTo(x + s * 0.55, y - s * 0.05); ctx.moveTo(x - s * 0.1, y + s * 0.1); ctx.lineTo(x - s * 0.45, y + s * 0.5); ctx.stroke(); }
}

/** Draw a boss standing at (cx, baseY) with body scale r (px). */
export function drawBoss(ctx: CanvasRenderingContext2D, kind: ChaserKind, cx: number, baseY: number, r: number, o: BossPose) {
  const k = o.defeat;
  ctx.save();
  // defeat: he shakes, then sags and fades (never a flash)
  const shake = k > 0 && k < 0.5 && !o.reduced ? Math.sin(o.t * 60) * r * 0.03 : 0;
  ctx.translate(cx + shake, baseY - (k > 0.5 ? (k - 0.5) * r * 0.5 : 0));
  ctx.globalAlpha = k > 0.5 ? Math.max(0, 1 - (k - 0.5) * 2) : 1;
  if (k > 0) ctx.scale(1 + k * 0.1, 1 - Math.max(0, k - 0.4) * 0.5);
  const bob = o.reduced ? 0 : Math.sin(o.t * 2.2) * r * 0.02;
  ctx.translate(0, bob);
  if (kind === "avalanche") grumble(ctx, r, o); else if (kind === "serpent") serpent(ctx, r, o); else if (kind === "cavein") king(ctx, r, o); else if (kind === "blizzard") yeti(ctx, r, o); else whiteout(ctx, r, o);
  ctx.restore();
}

function grumble(ctx: CanvasRenderingContext2D, r: number, o: BossPose) {
  ctx.save(); ctx.translate(0, -r * 0.95); ctx.rotate(o.reduced ? 0 : Math.sin(o.t * 1.6) * 0.04);
  ctx.fillStyle = "rgba(30,40,110,.3)"; ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.16, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, "#ffffff"); g.addColorStop(0.65, "#d8e6ff"); g.addColorStop(1, "#8aa4e6");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = "#b8c9f0"; for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, r * 0.13, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#7c8fb8"; for (const [x, y, s] of [[-0.55, 0.2, 0.09], [0.6, -0.1, 0.07], [0.35, 0.62, 0.08]] as const) { ctx.beginPath(); ctx.arc(x * r, y * r, s * r, 0, TAU); ctx.fill(); }
  for (const sd of [-1, 1]) { ctx.fillStyle = "#e6efff"; ctx.beginPath(); ctx.ellipse(sd * r * 1.0, r * 0.18, r * 0.2, r * 0.32, sd * 0.5, 0, TAU); ctx.fill(); }
  eyes(ctx, 0, -r * 0.22, r * 0.3, r * 0.17, o, Math.sin(o.t) * 0.6); mouth(ctx, 0, r * 0.12, r * 0.55, o);
  gem(ctx, 0, r * 0.58, r * 0.16, o);
  ctx.restore();
}
function serpent(ctx: CanvasRenderingContext2D, r: number, o: BossPose) {
  const W = o.W; const t = o.reduced ? 0 : o.t;
  // the body: a ribbon of aurora sweeping across the sky
  for (let pass = 0; pass < 2; pass++) {
    const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0); g.addColorStop(0, "#7fe3ff"); g.addColorStop(0.5, "#9b7bff"); g.addColorStop(1, "#ff9ec7");
    ctx.strokeStyle = pass ? "rgba(255,255,255,.35)" : g; ctx.lineWidth = r * (pass ? 0.08 : 0.34); ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const x = -W * 0.6 + (W * 1.2 * i) / 40; const y = -r * (1.05 + 0.25 * Math.sin((x / W) * 7 + t * 1.4)) - (pass ? r * 0.07 : 0); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const hx = (o.aim ?? 0) * (o.atk ?? 0) * W * 0.16; ctx.save(); ctx.translate(hx, -r * (1.2 + 0.25 * Math.sin((hx / W) * 7 + t * 1.4)));
  const hg = ctx.createRadialGradient(0, -r * 0.1, r * 0.1, 0, 0, r * 0.75); hg.addColorStop(0, "#d9cdff"); hg.addColorStop(1, "#6a4fd6");
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ff9ec7"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * r * 0.45, -r * 0.25); ctx.lineTo(sd * r * 0.95, -r * 0.6); ctx.lineTo(sd * r * 0.62, -r * 0.05); ctx.closePath(); ctx.fill(); }
  eyes(ctx, 0, -r * 0.05, r * 0.24, r * 0.13, o, Math.sin(t) * 0.5); mouth(ctx, 0, r * 0.2, r * 0.44, o);
  gem(ctx, 0, -r * 0.4, r * 0.13, o);
  ctx.restore();
}
function king(ctx: CanvasRenderingContext2D, r: number, o: BossPose) {
  ctx.save(); ctx.translate(0, -r * 0.05);
  ctx.fillStyle = "rgba(20,30,90,.35)"; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.15, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r * 1.7, 0, 0); g.addColorStop(0, "#5a6fb0"); g.addColorStop(1, "#26356f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * 0.95, 0); ctx.lineTo(-r * 0.62, -r * 1.2); ctx.lineTo(-r * 0.3, -r * 1.42); ctx.lineTo(r * 0.3, -r * 1.42); ctx.lineTo(r * 0.62, -r * 1.2); ctx.lineTo(r * 0.95, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(160,190,255,.35)"; ctx.lineWidth = r * 0.03; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.28, -r * 1.4); ctx.lineTo(i * r * 0.36, 0); ctx.stroke(); }
  for (const sd of [-1, 1]) { ctx.fillStyle = "#3a4d92"; ctx.beginPath(); ctx.arc(sd * r * 1.0, -r * 0.42, r * 0.24, 0, TAU); ctx.fill(); }
  // the crown: five gems; each shatters as the weak spot fills
  const n = 5; const broken = Math.floor(o.fill * (n + 0.999));
  for (let i = 0; i < n; i++) {
    const x = (i - 2) * r * 0.27; const y = -r * 1.42; const gone = i < broken;
    ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.moveTo(x - r * 0.1, y); ctx.lineTo(x, y - r * (i === 2 ? 0.36 : 0.26)); ctx.lineTo(x + r * 0.1, y); ctx.closePath(); ctx.fill();
    if (!gone) { ctx.fillStyle = i % 2 ? "#7fe3ff" : "#ff9ec7"; ctx.beginPath(); ctx.moveTo(x, y - r * (i === 2 ? 0.5 : 0.4)); ctx.lineTo(x + r * 0.09, y - r * (i === 2 ? 0.36 : 0.27)); ctx.lineTo(x, y - r * (i === 2 ? 0.24 : 0.16)); ctx.lineTo(x - r * 0.09, y - r * (i === 2 ? 0.36 : 0.27)); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = "rgba(255,255,255,.7)"; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(x + (j - 1) * r * 0.07, y - r * (0.2 + j * 0.05), r * 0.025, 0, TAU); ctx.fill(); } }
  }
  eyes(ctx, 0, -r * 0.95, r * 0.26, r * 0.15, o, Math.sin(o.t * 0.8) * 0.5); mouth(ctx, 0, -r * 0.62, r * 0.55, o);
  ctx.restore();
}
function yeti(ctx: CanvasRenderingContext2D, r: number, o: BossPose) {
  ctx.save(); ctx.translate(0, -r * 0.05);
  ctx.fillStyle = "rgba(30,40,110,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.15, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r * 1.7, 0, 0); g.addColorStop(0, "#f2f6ff"); g.addColorStop(1, "#aebff0");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.78, r * 0.68, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-r * 0.78, -r * 0.62); for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.86 : 0.74), -r * 0.62 + Math.sin(a) * r * (i % 2 ? 0.8 : 0.68)); } ctx.closePath(); ctx.fill();
  const atk = o.atk ?? 0; const arm = o.reduced ? 0 : Math.sin(o.t * 3) * 0.12 + atk * Math.sin(o.t * 7) * 0.55; ctx.translate(atk * (o.aim ?? 0) * r * 0.12, 0);
  for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * r * 0.72, -r * 0.85); ctx.rotate(sd * (0.7 + (sd > 0 ? arm : 0)) + (sd > 0 ? -atk * 0.5 : 0)); ctx.fillStyle = "#dbe6ff"; ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.2, r * 0.42, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r * 1.05, -r * 1.5, r * 0.22, 0, TAU); ctx.fill(); ctx.strokeStyle = "#aebff0"; ctx.lineWidth = r * 0.03; ctx.stroke();
  ctx.fillStyle = "#e6eeff"; ctx.beginPath(); ctx.arc(0, -r * 1.22, r * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#8fb0f0"; ctx.beginPath(); ctx.ellipse(0, -r * 1.16, r * 0.38, r * 0.34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#c9d8ff"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * r * 0.32, -r * 1.6); ctx.lineTo(sd * r * 0.5, -r * 1.95); ctx.lineTo(sd * r * 0.5, -r * 1.55); ctx.closePath(); ctx.fill(); }
  eyes(ctx, 0, -r * 1.25, r * 0.19, r * 0.1, o, Math.sin(o.t) * 0.5); mouth(ctx, 0, -r * 1.0, r * 0.36, o);
  gem(ctx, 0, -r * 0.5, r * 0.15, o);
  ctx.restore();
}
function whiteout(ctx: CanvasRenderingContext2D, r: number, o: BossPose) {
  const t = o.reduced ? 0 : o.t; ctx.save(); ctx.translate(0, -r * 0.95);
  for (let i = 0; i < 11; i++) {
    const a = i * 0.57 + t * 0.3; const rr = r * (0.36 + 0.14 * ((i * 7) % 5) / 4); const x = Math.cos(a) * r * 0.72, y = Math.sin(a) * r * 0.62;
    const g = ctx.createRadialGradient(x, y - rr * 0.3, rr * 0.1, x, y, rr); g.addColorStop(0, "#ffffff"); g.addColorStop(1, i % 2 ? "#b6c6ee" : "#d8e2fb");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = "rgba(140,160,215,.6)"; ctx.lineWidth = r * 0.05; ctx.lineCap = "round"; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let j = 0; j <= 16; j++) { const a = t * 0.8 + i * 2.1 + j * 0.25; const rr = r * (0.9 + j * 0.03); const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.75; if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); }
  const fg = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.62); fg.addColorStop(0, "#ffffff"); fg.addColorStop(1, "#c4d2f6"); ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.52, 0, 0, TAU); ctx.fill();
  eyes(ctx, 0, -r * 0.12, r * 0.24, r * 0.14, o, Math.sin(t) * 0.6); mouth(ctx, 0, r * 0.2, r * 0.5, o);
  gem(ctx, 0, -r * 0.42, r * 0.12, o);
  ctx.restore();
}
