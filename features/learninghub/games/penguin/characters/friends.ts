// The friends Percy rescues (one species per world). Pure canvas drawing, no game state: used for the ice block on the ice, the little helper who slides beside Percy,
// and (rendered once to an image) the villagers in the Igloo Village. Palette is icy navy / royal / violet / gold / rose: no green anywhere.
import type { FriendSpecies } from "../config";

const TAU = Math.PI * 2;
export interface FriendPose { t: number; still: boolean; /** 0 = standing, 1 = happy hop */ hop?: number; face?: boolean }
const eye = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, still: boolean, t: number) => {
  const bl = !still && Math.sin(t * 1.7 + x) > 0.985 ? 0.15 : 1;
  ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.ellipse(x, y, r, r * bl, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.3, r * 0.34, 0, TAU); ctx.fill();
};
/** Draw a friend standing with its feet at (0,0), about `s` px tall. */
export function drawFriend(ctx: CanvasRenderingContext2D, sp: FriendSpecies, s: number, o: FriendPose) {
  const k = s / 100; const bob = o.still ? 0 : Math.sin(o.t * 5) * 1.6 - (o.hop ?? 0) * 12;
  ctx.save(); ctx.scale(k, k); ctx.translate(0, bob);
  ctx.fillStyle = "rgba(30,40,110,.22)"; ctx.beginPath(); ctx.ellipse(0, 1 - bob, 30, 5, 0, 0, TAU); ctx.fill();
  const still = o.still, t = o.t;
  if (sp === "seal") { // a dappled blue-grey seal pup
    ctx.fillStyle = "#8fa6d6"; ctx.beginPath(); ctx.ellipse(0, -30, 34, 30, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#e9efff"; ctx.beginPath(); ctx.ellipse(0, -22, 22, 21, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#8fa6d6"; ctx.beginPath(); ctx.ellipse(-34, -12, 15, 7, -0.5, 0, TAU); ctx.ellipse(34, -12, 15, 7, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7c93c8"; for (const [dx, dy] of [[-16, -46], [10, -52], [22, -38]] as const) { ctx.beginPath(); ctx.arc(dx, dy, 3.4, 0, TAU); ctx.fill(); }
    eye(ctx, -11, -36, 4.6, still, t); eye(ctx, 11, -36, 4.6, still, t); ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.ellipse(0, -28, 5, 3.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#dfe7ff"; ctx.lineWidth = 1.6; ctx.lineCap = "round"; for (const sd of [-1, 1]) for (const dy of [-1, 3]) { ctx.beginPath(); ctx.moveTo(sd * 8, -25 + dy); ctx.lineTo(sd * 24, -27 + dy * 2); ctx.stroke(); }
  } else if (sp === "fox") { // a rose-and-cream aurora fox with a big brush tail
    ctx.fillStyle = "#f2a15a"; ctx.beginPath(); ctx.moveTo(24, -14); ctx.quadraticCurveTo(62, -30 + (still ? 0 : Math.sin(t * 4) * 5), 56, -66); ctx.quadraticCurveTo(38, -46, 22, -30); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(56, -64, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = "#f2a15a"; ctx.beginPath(); ctx.ellipse(0, -26, 26, 24, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff6e8"; ctx.beginPath(); ctx.ellipse(0, -20, 15, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#f2a15a"; ctx.beginPath(); ctx.arc(0, -56, 21, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-19, -66); ctx.lineTo(-14, -90); ctx.lineTo(-3, -72); ctx.closePath(); ctx.moveTo(19, -66); ctx.lineTo(14, -90); ctx.lineTo(3, -72); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.moveTo(-14, -72); ctx.lineTo(-13, -84); ctx.lineTo(-7, -73); ctx.closePath(); ctx.moveTo(14, -72); ctx.lineTo(13, -84); ctx.lineTo(7, -73); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff6e8"; ctx.beginPath(); ctx.moveTo(-19, -54); ctx.quadraticCurveTo(0, -36, 19, -54); ctx.quadraticCurveTo(0, -48, -19, -54); ctx.fill(); eye(ctx, -8, -58, 3.8, still, t); eye(ctx, 8, -58, 3.8, still, t); ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(0, -50, 3, 0, TAU); ctx.fill();
  } else if (sp === "mole") { // a plum-coloured cave mole with a pink nose and a tiny lantern
    ctx.fillStyle = "#6e5fa8"; ctx.beginPath(); ctx.ellipse(0, -28, 30, 28, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#8a7cc4"; ctx.beginPath(); ctx.ellipse(0, -22, 19, 19, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3a2f6e"; ctx.beginPath(); ctx.ellipse(-30, -14, 10, 6, 0.4, 0, TAU); ctx.ellipse(30, -14, 10, 6, -0.4, 0, TAU); ctx.fill(); ctx.fillStyle = "#ffe3a8"; for (const sd of [-1, 1]) for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(sd * 30 + dx * 0.7, -9, 1.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.ellipse(0, -36, 8, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#1b2350"; ctx.beginPath(); ctx.arc(-14, -46, 3, 0, TAU); ctx.arc(14, -46, 3, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-13, -47, 1, 0, TAU); ctx.arc(15, -47, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.roundRect(-9, -68, 18, 11, 4); ctx.fill(); ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(0, -62, 4, 0, TAU); ctx.fill();
  } else if (sp === "puffin") { // a navy puffin with a striped orange beak
    ctx.fillStyle = "#26357f"; ctx.beginPath(); ctx.ellipse(0, -34, 26, 34, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#fbfbff"; ctx.beginPath(); ctx.ellipse(0, -28, 17, 25, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#26357f"; ctx.beginPath(); ctx.ellipse(-26, -30, 8, 22, 0.2, 0, TAU); ctx.ellipse(26, -30, 8, 22, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fbfbff"; ctx.beginPath(); ctx.ellipse(0, -56, 17, 14, 0, 0, TAU); ctx.fill(); eye(ctx, -7, -58, 3.4, still, t); eye(ctx, 7, -58, 3.4, still, t);
    ctx.fillStyle = "#ff8a3c"; ctx.beginPath(); ctx.moveTo(-11, -50); ctx.quadraticCurveTo(0, -38, 11, -50); ctx.quadraticCurveTo(0, -60, -11, -50); ctx.fill(); ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.moveTo(-3, -53); ctx.quadraticCurveTo(0, -44, 3, -53); ctx.quadraticCurveTo(0, -57, -3, -53); ctx.fill();
    ctx.fillStyle = "#ff8a3c"; ctx.beginPath(); ctx.ellipse(-10, 0, 9, 4, 0, 0, TAU); ctx.ellipse(10, 0, 9, 4, 0, 0, TAU); ctx.fill();
  } else { // hare: a lilac-white snow hare with tall ears
    ctx.fillStyle = "#e7e2ff"; ctx.beginPath(); ctx.ellipse(0, -26, 26, 24, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -56, 20, 0, TAU); ctx.fill();
    const wig = still ? 0 : Math.sin(t * 3) * 0.08;
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 9, -70); ctx.rotate(sd * (0.16 + wig)); ctx.fillStyle = "#e7e2ff"; ctx.beginPath(); ctx.ellipse(0, -18, 7, 22, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#ffb4d8"; ctx.beginPath(); ctx.ellipse(0, -18, 3.6, 16, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = "#c9c0ff"; ctx.beginPath(); ctx.ellipse(-10, -2, 10, 5, 0, 0, TAU); ctx.ellipse(10, -2, 10, 5, 0, 0, TAU); ctx.fill(); eye(ctx, -8, -58, 3.8, still, t); eye(ctx, 8, -58, 3.8, still, t);
    ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.ellipse(0, -50, 3.6, 2.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,150,180,.5)"; ctx.beginPath(); ctx.arc(-15, -50, 4.5, 0, TAU); ctx.arc(15, -50, 4.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
/** A friend frozen in a block of ice (what is on the ice until a belly-flop cracks it). */
export function drawIceFriend(ctx: CanvasRenderingContext2D, sp: FriendSpecies, s: number, t: number, still: boolean) {
  const w = s * 0.62, h = s * 0.95;
  ctx.save(); ctx.globalAlpha *= 0.94; drawFriend(ctx, sp, s * 0.72, { t, still: true }); ctx.restore();
  const g = ctx.createLinearGradient(-w, -h, w, 0); g.addColorStop(0, "rgba(233,246,255,.78)"); g.addColorStop(1, "rgba(127,190,245,.62)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w, -h, w * 2, h, s * 0.1); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(2, s * 0.03); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = Math.max(1.5, s * 0.025); ctx.beginPath(); ctx.moveTo(-w * 0.6, -h * 0.9); ctx.lineTo(-w * 0.35, -h * 0.45); ctx.moveTo(w * 0.55, -h * 0.85); ctx.lineTo(w * 0.3, -h * 0.5); ctx.stroke();
  const tw = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 3); ctx.fillStyle = `rgba(255,206,74,${0.5 + 0.4 * tw})`; ctx.beginPath(); ctx.arc(w * 0.62, -h * 0.9, s * 0.05, 0, TAU); ctx.fill();
}
const cache = new Map<string, string>();
/** A friend as a small PNG data URL (cached), for the SVG village. Browser only. */
export function friendImage(sp: FriendSpecies, px = 128): string {
  const key = `${sp}${px}`; const hit = cache.get(key); if (hit) return hit;
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas"); c.width = px; c.height = px; const ctx = c.getContext("2d"); if (!ctx) return "";
  ctx.translate(px * 0.5, px * 0.94); drawFriend(ctx, sp, px * 0.86, { t: 0, still: true }); const url = c.toDataURL("image/png"); cache.set(key, url); return url;
}
