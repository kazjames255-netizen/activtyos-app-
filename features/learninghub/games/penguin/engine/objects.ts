// The things ON the ice: hazards, pads, ramps, crystals, rings, the secret stash, the wrong-answer signpost, and the SET PIECES a gate's answer decides (bridge / launch
// ramp / crystal door / whale / aurora bridge). All pure canvas drawing at a given screen position and pixel unit `u` (one world unit at that depth). No game state here.
import type { ObjKind } from "../core";
import { friendOf } from "../config";
import { drawIceFriend } from "../characters/friends";

const TAU = Math.PI * 2;
const ease = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
const hash = (n: number) => { let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n = 5) => { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n; const rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); };

export interface ObjLook { biome: number; t: number; dark: boolean; reduced: boolean; font: string }

/** A hazard's warning shadow is drawn first (a soft rose-tinted patch on the ice), so a fair child can always read what is coming. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, w: number, hard: boolean) {
  ctx.fillStyle = hard ? "rgba(255,120,170,.22)" : "rgba(60,90,170,.2)"; ctx.beginPath(); ctx.ellipse(x, y, u * (w + 0.1), u * 0.06, 0, 0, TAU); ctx.fill();
}

export function drawObj(ctx: CanvasRenderingContext2D, kind: ObjKind, x: number, y: number, u: number, w: number, seed: number, L: ObjLook, air = false) {
  ctx.save(); ctx.translate(x, y);
  switch (kind) {
    case "fish": case "sky": fish(ctx, u * 0.06, kind === "sky", L.t, seed, air); break;
    case "bag": bag(ctx, u * 0.2, L.t); break;
    case "friend": drawIceFriend(ctx, friendOf(L.biome), u * 0.46, L.t, L.reduced); break;
    case "drift": drift(ctx, u * w, seed); break;
    case "rock": if (L.biome === 3) stalactite(ctx, u * w, L.dark); else boulder(ctx, u * w, seed); break;
    case "ball": ball(ctx, u * w, L.t, seed); break;
    case "pad": pad(ctx, u * w, L.t); break;
    case "ramp": miniRamp(ctx, u * w); break;
    case "crystal": crystal(ctx, u * 0.2, L.t, seed); break;
    case "ring": ring(ctx, u * w, L.t, seed); break;
    default: break;
  }
  ctx.restore();
}

function fish(ctx: CanvasRenderingContext2D, u: number, sky: boolean, t: number, seed: number, air: boolean) {
  const bob = Math.sin(t * 4 + seed) * u * 0.18; ctx.translate(0, -u * (sky ? 4.2 : 1.1) + bob);
  ctx.globalAlpha = sky && !air ? 0.5 : 1;
  if (sky) { const g = ctx.createRadialGradient(0, 0, u * 0.3, 0, 0, u * 2.4); g.addColorStop(0, "rgba(255,240,180,.6)"); g.addColorStop(1, "rgba(255,240,180,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 2.4, 0, TAU); ctx.fill(); }
  const g = ctx.createLinearGradient(-u, 0, u, 0); g.addColorStop(0, "#ffe58a"); g.addColorStop(1, "#ffce4a");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.9, u * 0.48, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u * 0.75, 0); ctx.lineTo(u * 1.35, -u * 0.5); ctx.lineTo(u * 1.35, u * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(-u * 0.45, -u * 0.08, u * 0.09, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(200,140,20,.6)"; ctx.lineWidth = Math.max(1, u * 0.06); ctx.beginPath(); ctx.ellipse(0, 0, u * 0.9, u * 0.48, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
function bag(ctx: CanvasRenderingContext2D, u: number, t: number) {
  const bob = Math.sin(t * 3) * u * 0.08; ctx.translate(0, -u * 1.3 + bob);
  const g = ctx.createRadialGradient(0, 0, u * 0.2, 0, 0, u * 2.2); g.addColorStop(0, "rgba(255,230,140,.7)"); g.addColorStop(1, "rgba(255,230,140,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ff9ec7"; rr(ctx, -u * 0.8, -u * 0.6, u * 1.6, u * 1.3, u * 0.28); ctx.fill(); ctx.fillStyle = "#ffce4a"; ctx.fillRect(-u * 0.12, -u * 0.6, u * 0.24, u * 1.3);
  ctx.beginPath(); ctx.ellipse(-u * 0.32, -u * 0.72, u * 0.3, u * 0.2, -0.5, 0, TAU); ctx.ellipse(u * 0.32, -u * 0.72, u * 0.3, u * 0.2, 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; star(ctx, 0, u * 0.1, u * 0.28, 5);
}
function drift(ctx: CanvasRenderingContext2D, w: number, seed: number) {
  const g = ctx.createLinearGradient(0, -w * 0.7, 0, 0); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c9dcff");
  ctx.fillStyle = "rgba(60,90,170,.2)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.05, w * 0.22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * 0.9, -w * 0.75, -w * 0.3, -w * 0.72); ctx.quadraticCurveTo(w * 0.1, -w * 0.95, w * 0.5, -w * 0.62); ctx.quadraticCurveTo(w * 0.95, -w * 0.5, w, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(110,150,225,.55)"; ctx.lineWidth = Math.max(1, w * 0.04); ctx.beginPath(); ctx.moveTo(-w * 0.4, -w * 0.35); ctx.quadraticCurveTo(0, -w * 0.5 - hash(seed) * w * 0.1, w * 0.45, -w * 0.3); ctx.stroke();
}
function boulder(ctx: CanvasRenderingContext2D, w: number, seed: number) {
  ctx.fillStyle = "rgba(20,30,90,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.0, w * 0.2, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -w * 1.5, 0, 0); g.addColorStop(0, "#9db3e6"); g.addColorStop(1, "#4d63a8");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * 0.95, 0); ctx.lineTo(-w * 0.8, -w * 0.9); ctx.lineTo(-w * 0.2, -w * 1.4); ctx.lineTo(w * 0.55, -w * 1.15); ctx.lineTo(w * 0.95, -w * 0.4); ctx.lineTo(w * 0.85, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.moveTo(-w * 0.2, -w * 1.4); ctx.lineTo(w * 0.55, -w * 1.15); ctx.lineTo(w * 0.05, -w * 0.9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(30,45,120,.6)"; ctx.lineWidth = Math.max(1, w * 0.05); ctx.beginPath(); ctx.moveTo(-w * 0.1, -w * 1.0); ctx.lineTo(w * 0.05, -w * 0.5); ctx.lineTo(-w * 0.15, -w * 0.15); ctx.stroke(); void seed;
}
function stalactite(ctx: CanvasRenderingContext2D, w: number, dark: boolean) {
  ctx.fillStyle = "rgba(255,120,170,.25)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.9, w * 0.18, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -w * 2.2, 0, 0); g.addColorStop(0, dark ? "#3c4c86" : "#7b90cf"); g.addColorStop(1, "#1a2760");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * 0.75, 0); ctx.lineTo(-w * 0.28, -w * 2.0); ctx.lineTo(0, -w * 2.4); ctx.lineTo(w * 0.32, -w * 1.9); ctx.lineTo(w * 0.8, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(127,227,255,.4)"; ctx.beginPath(); ctx.moveTo(0, -w * 2.4); ctx.lineTo(w * 0.32, -w * 1.9); ctx.lineTo(w * 0.1, -w * 0.4); ctx.closePath(); ctx.fill();
}
function ball(ctx: CanvasRenderingContext2D, w: number, t: number, seed: number) {
  ctx.fillStyle = "rgba(20,30,90,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.95, w * 0.2, 0, 0, TAU); ctx.fill();
  ctx.translate(0, -w * 0.95); ctx.rotate(t * 3 + seed);
  const g = ctx.createRadialGradient(-w * 0.3, -w * 0.3, w * 0.1, 0, 0, w * 1.05); g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#d8e6ff"); g.addColorStop(1, "#8aa4e6");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 0.95, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(90,120,200,.55)"; ctx.lineWidth = Math.max(1, w * 0.07); ctx.beginPath(); ctx.arc(0, 0, w * 0.55, 0.3, 2.6); ctx.stroke();
}
function pad(ctx: CanvasRenderingContext2D, w: number, t: number) {
  const g = ctx.createRadialGradient(0, -w * 0.05, w * 0.1, 0, 0, w * 1.3); g.addColorStop(0, "rgba(255,206,74,.55)"); g.addColorStop(1, "rgba(255,206,74,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.5, w * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3b57d6"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.95, w * 0.26, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = Math.max(2, w * 0.1); ctx.lineJoin = "round"; const o = (t * 2) % 1;
  for (let i = 0; i < 3; i++) { const yy = -w * 0.06 - ((i + o) % 3) * w * 0.05; ctx.globalAlpha = 1 - i * 0.28; ctx.beginPath(); ctx.moveTo(-w * 0.4, yy + w * 0.08); ctx.lineTo(0, yy - w * 0.08); ctx.lineTo(w * 0.4, yy + w * 0.08); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function miniRamp(ctx: CanvasRenderingContext2D, w: number) {
  const h = w * 1.05; ctx.fillStyle = "rgba(60,40,150,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.05, w * 0.2, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, "#f0e9ff"); g.addColorStop(1, "#7b62e0"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.lineTo(w * 0.82, -h); ctx.lineTo(-w * 0.82, -h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = Math.max(2, w * 0.09); ctx.lineJoin = "round"; for (let i = 0; i < 2; i++) { const yy = -h * (0.22 + i * 0.3); ctx.beginPath(); ctx.moveTo(-w * 0.3, yy); ctx.lineTo(0, yy - w * 0.26); ctx.lineTo(w * 0.3, yy); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.82, -h); ctx.lineTo(w * 0.82, -h); ctx.lineTo(w, 0); ctx.stroke();
}
function crystal(ctx: CanvasRenderingContext2D, u: number, t: number, seed: number) {
  const pul = 0.6 + 0.4 * Math.sin(t * 3 + seed); const g = ctx.createRadialGradient(0, -u * 2, u * 0.2, 0, -u * 2, u * 4); g.addColorStop(0, `rgba(127,227,255,${0.5 * pul})`); g.addColorStop(1, "rgba(127,227,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -u * 2, u * 4, 0, TAU); ctx.fill();
  for (const [x, h, c] of [[-0.6, 1.6, "#9b7bff"], [0, 2.6, "#7fe3ff"], [0.6, 1.9, "#bfeaff"]] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo((x - 0.4) * u, 0); ctx.lineTo((x - 0.25) * u, -h * u * 0.8); ctx.lineTo(x * u, -h * u); ctx.lineTo((x + 0.3) * u, -h * u * 0.75); ctx.lineTo((x + 0.4) * u, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.moveTo((x - 0.25) * u, -h * u * 0.8); ctx.lineTo(x * u, -h * u); ctx.lineTo((x + 0.05) * u, -h * u * 0.2); ctx.closePath(); ctx.fill(); }
}
function ring(ctx: CanvasRenderingContext2D, w: number, t: number, seed: number) {
  ctx.translate(0, -w * 1.1); const pul = 0.75 + 0.25 * Math.sin(t * 4 + seed);
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = i === 0 ? "#7fe3ff" : i === 1 ? "#9b7bff" : "#ff9ec7"; ctx.globalAlpha = 0.85 * pul; ctx.lineWidth = Math.max(2, w * (0.16 - i * 0.04)); ctx.beginPath(); ctx.ellipse(0, 0, w * (0.95 - i * 0.1), w * (1.1 - i * 0.12), 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

/** The wrong-answer signpost: the world tells you the fact (the sim decided WHERE; the words are the same fact the child just missed). */
export function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, text: string, font: string) {
  const h = u * 0.62, w = u * 0.7;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(20,30,90,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.7, u * 0.06, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#7a5230"; ctx.fillRect(-u * 0.05, -h, u * 0.1, h);
  const g = ctx.createLinearGradient(0, -h * 1.55, 0, -h * 0.85); g.addColorStop(0, "#e9c28a"); g.addColorStop(1, "#c9975a");
  ctx.fillStyle = g; rr(ctx, -w * 0.62, -h * 1.5, w * 1.24, h * 0.62, u * 0.08); ctx.fill(); ctx.strokeStyle = "#7a5230"; ctx.lineWidth = Math.max(2, u * 0.035); ctx.stroke();
  ctx.fillStyle = "#3a2410"; ctx.font = `800 ${Math.max(9, h * 0.34)}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 0, -h * 1.19);
  ctx.restore();
}

// ─── set pieces ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** `w` = half the road width in px, `u` = px per world unit, `t` = seconds since this set piece appeared (drives the "freezing" / "opening" animation). */
export function drawSpan(ctx: CanvasRenderingContext2D, biome: number, open: boolean, x: number, y: number, u: number, w: number, t: number, reduced: boolean) {
  ctx.save(); ctx.translate(x, y);
  const k = reduced ? 1 : ease(t / 0.55);
  if (biome === 1) bridge(ctx, open, u, w, k, t);
  else if (biome === 2) launch(ctx, open, u, w, k);
  else if (biome === 3) door(ctx, open, u, w, k);
  else if (biome === 4) whale(ctx, open, u, w, k, t);
  else auroraBridge(ctx, open, u, w, k, t);
  ctx.restore();
}
function crack(ctx: CanvasRenderingContext2D, w: number, hh: number) {
  ctx.fillStyle = "#0a1038"; ctx.beginPath(); ctx.moveTo(-w, 0);
  for (let i = 0; i <= 14; i++) ctx.lineTo(-w + (2 * w * i) / 14, -hh * (0.15 + 0.2 * hash(i * 3)));
  for (let i = 14; i >= 0; i--) ctx.lineTo(-w + (2 * w * i) / 14, hh * (0.75 + 0.25 * hash(i * 5 + 1)));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(90,130,220,.4)"; ctx.fillRect(-w, hh * 0.5, 2 * w, hh * 0.18);
}
function bridge(ctx: CanvasRenderingContext2D, open: boolean, u: number, w: number, k: number, t: number) {
  const hh = u * 0.3; crack(ctx, w, hh);
  if (open) { // the ice bridge freezes across, left to right, then sparkles
    const bw = 2 * w * k; const g = ctx.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#a7d3fb");
    ctx.fillStyle = g; rr(ctx, -w, -hh * 0.55, bw, hh * 1.5, hh * 0.25); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = Math.max(2, u * 0.03); ctx.stroke();
    ctx.strokeStyle = "rgba(120,170,235,.6)"; ctx.lineWidth = Math.max(1, u * 0.015); for (let i = 1; i < 8; i++) { const px = -w + (2 * w * i) / 8; if (px > -w + bw) break; ctx.beginPath(); ctx.moveTo(px, -hh * 0.5); ctx.lineTo(px + u * 0.03, hh * 0.9); ctx.stroke(); }
    ctx.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { const sx = -w + bw * hash(i + 4); star(ctx, sx, -hh * 0.5 - hash(i) * hh * 0.7 * (0.5 + 0.5 * Math.sin(t * 6 + i)), u * 0.05, 4); }
  } else { // no bridge: a lumpy snow path down and across (slower, scenic)
    ctx.fillStyle = "#f4f9ff"; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-w * 0.9 + (1.8 * w * i) / 8, hh * 0.35 + Math.sin(i * 1.7) * hh * 0.15, u * 0.17, hh * 0.42, 0, 0, TAU); ctx.fill(); }
  }
}
function launch(ctx: CanvasRenderingContext2D, open: boolean, u: number, w: number, k: number) {
  const bw = w * 0.85; const h = u * (open ? 0.85 : 0.5) * k;
  ctx.fillStyle = "rgba(60,40,150,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, bw * 1.1, u * 0.12, 0, 0, TAU); ctx.fill();
  if (open) {
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, "#f7f1ff"); g.addColorStop(1, "#6a4fd6"); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-bw, 0); ctx.lineTo(bw, 0); ctx.lineTo(bw * 0.8, -h); ctx.lineTo(-bw * 0.8, -h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = Math.max(3, u * 0.05); ctx.lineJoin = "round"; for (let i = 0; i < 3; i++) { const yy = -h * (0.18 + i * 0.27); ctx.beginPath(); ctx.moveTo(-bw * 0.35, yy); ctx.lineTo(0, yy - u * 0.16); ctx.lineTo(bw * 0.35, yy); ctx.stroke(); }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, u * 0.03); ctx.beginPath(); ctx.moveTo(-bw, 0); ctx.lineTo(-bw * 0.8, -h); ctx.lineTo(bw * 0.8, -h); ctx.lineTo(bw, 0); ctx.stroke();
  } else { // the ramp crumbles into chunks
    for (let i = 0; i < 7; i++) { const px = -bw + (2 * bw * i) / 6, hh = u * (0.12 + 0.2 * hash(i + 2)); ctx.fillStyle = i % 2 ? "#b7a6ff" : "#8f7ee8"; ctx.beginPath(); ctx.moveTo(px - u * 0.13, 0); ctx.lineTo(px - u * 0.06, -hh); ctx.lineTo(px + u * 0.1, -hh * 0.7); ctx.lineTo(px + u * 0.14, 0); ctx.closePath(); ctx.fill(); }
  }
}
function door(ctx: CanvasRenderingContext2D, open: boolean, u: number, w: number, k: number) {
  const h = u * 1.25, dw = w * 0.86;
  ctx.fillStyle = "rgba(10,20,70,.4)"; ctx.beginPath(); ctx.ellipse(0, 0, dw * 1.1, u * 0.1, 0, 0, TAU); ctx.fill();
  const inner = ctx.createLinearGradient(0, -h, 0, 0); inner.addColorStop(0, "#7fe3ff"); inner.addColorStop(1, "#9b7bff");
  ctx.fillStyle = open ? inner : "#0d1a4a"; rr(ctx, -dw, -h, dw * 2, h, u * 0.1); ctx.fill();
  const slide = open ? dw * 0.92 * k : 0; const half = (o: number) => { ctx.fillStyle = "#2f4696"; ctx.fillRect(o < 0 ? -dw - slide : slide, -h, dw, h); ctx.strokeStyle = "#7fa3f0"; ctx.lineWidth = Math.max(2, u * 0.03); ctx.strokeRect(o < 0 ? -dw - slide : slide, -h, dw, h); };
  half(-1); half(1);
  ctx.fillStyle = open ? "#ffce4a" : "#7fe3ff"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * (open ? dw + slide * 0 : 0) - u * 0.08, -h * 0.5); ctx.lineTo(sd * (open ? dw : 0), -h * 0.5 - u * 0.2); ctx.lineTo(sd * (open ? dw : 0) + u * 0.08, -h * 0.5); ctx.lineTo(sd * (open ? dw : 0), -h * 0.5 + u * 0.2); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = "#dfe9ff"; ctx.lineWidth = Math.max(3, u * 0.05); rr(ctx, -dw - u * 0.03, -h - u * 0.03, dw * 2 + u * 0.06, h + u * 0.03, u * 0.1); ctx.stroke();
}
function whale(ctx: CanvasRenderingContext2D, open: boolean, u: number, w: number, k: number, t: number) {
  if (!open) { // open water with a bobbing floe: the slow way round
    ctx.fillStyle = "#132a80"; ctx.fillRect(-w, -u * 0.14, 2 * w, u * 0.38); ctx.fillStyle = "rgba(127,227,255,.4)"; for (let i = 0; i < 6; i++) ctx.fillRect(-w + (2 * w * i) / 6 + Math.sin(t * 2 + i) * u * 0.05, u * (0.02 + 0.06 * (i % 2)), u * 0.28, u * 0.025);
    ctx.fillStyle = "#e9f3ff"; ctx.beginPath(); ctx.ellipse(Math.sin(t) * u * 0.1, u * 0.05, u * 0.45, u * 0.1, 0, 0, TAU); ctx.fill(); return;
  }
  const h = u * 0.75 * k; const bw = w * 1.05;
  ctx.fillStyle = "#132a80"; ctx.fillRect(-w, -u * 0.05, 2 * w, u * 0.25);
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, "#5d86e6"); g.addColorStop(1, "#1e3aa0"); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-bw, u * 0.05); ctx.quadraticCurveTo(-bw * 0.5, -h * 1.5, 0, -h * 1.1); ctx.quadraticCurveTo(bw * 0.6, -h * 1.4, bw, u * 0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e9f3ff"; ctx.beginPath(); ctx.moveTo(-bw * 0.85, u * 0.05); ctx.quadraticCurveTo(-bw * 0.4, -h * 0.5, 0, -h * 0.45); ctx.quadraticCurveTo(bw * 0.5, -h * 0.5, bw * 0.85, u * 0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(-bw * 0.55, -h * 0.72, u * 0.06, 0, TAU); ctx.fill(); ctx.strokeStyle = "#1b2350"; ctx.lineWidth = Math.max(2, u * 0.03); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(-bw * 0.5, -h * 0.62, u * 0.18, 0.2, 1.3); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = Math.max(2, u * 0.04); for (let i = 0; i < 4; i++) { const a = -1.2 + i * 0.8; const sp = ((t * 1.6 + i * 0.25) % 1); ctx.beginPath(); ctx.moveTo(bw * 0.15, -h * 1.05); ctx.quadraticCurveTo(bw * 0.15 + Math.cos(a) * u * 0.3 * sp, -h * 1.05 - u * (0.5 + sp * 0.5), bw * 0.15 + Math.cos(a) * u * 0.6 * sp, -h * 1.05 - u * 0.2 * (1 - sp)); ctx.stroke(); }
}
function auroraBridge(ctx: CanvasRenderingContext2D, open: boolean, u: number, w: number, k: number, t: number) {
  const hh = u * 0.3; crack(ctx, w, hh);
  if (!open) return;
  const cols = ["#7fe3ff", "#9b7bff", "#ff9ec7", "#ffce4a"];
  for (let i = 0; i < 4; i++) { ctx.strokeStyle = cols[i]!; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(3, u * 0.07); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-w, hh * (0.6 - i * 0.28)); ctx.quadraticCurveTo(0, -hh * (1.9 + i * 0.2) * k + Math.sin(t * 3 + i) * u * 0.02, -w + 2 * w * k, hh * (0.6 - i * 0.28)); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
