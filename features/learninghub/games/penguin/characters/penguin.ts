// The HOST CHARACTER as drawn in the game world. The platform mascot will become a cast (penguin, fox, otter, hedgehog, red panda, bunny, bear cub,
// elephant, cloud): the game never hard-codes the penguin. A character is anything that can draw itself on the ice given a pose; a theme names its host.
import type { Theme } from "../theme";

const TAU = Math.PI * 2;
export interface CharacterPose { tilt: number; sx: number; sy: number; face: boolean; eyes: "open" | "happy" | "oops"; blink: number; t: number; cosmetics: string[]; wing: number; still: boolean; /** Junior is round and bright; Explorer is a leaner, more serious expedition penguin (no blush, steady eyes, hood + goggles + pack) */ skin?: "junior" | "explorer" }
export interface CharacterDef {
  id: string;
  /** Draw the character standing with its feet at (cx, footY), `size` px tall (about). */
  draw(ctx: CanvasRenderingContext2D, P: Theme["palette"], cx: number, footY: number, size: number, pose: CharacterPose): void;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}

/** The penguin: the same shapes as the Mascot SVG (navy body, white belly, pink cheeks, gold-tassel mortar board), drawn in canvas so it can lean, squash and spin. */
export const penguinCharacter: CharacterDef = {
  id: "penguin",
  draw(ctx, P, cx, footY, size, p) {
    const k = size / 200;
    ctx.save(); ctx.translate(cx, footY); ctx.rotate(p.tilt); ctx.scale(k * p.sx, k * p.sy); ctx.translate(-100, -200);
    ctx.fillStyle = "rgba(30,40,110,.25)"; ctx.beginPath(); ctx.ellipse(100, 198, 60, 10, 0, 0, TAU); ctx.fill();
    if (p.cosmetics.includes("sled")) { // a little wooden sled under the feet
      ctx.fillStyle = "#8a5a2b"; ctx.beginPath(); ctx.roundRect(46, 186, 108, 12, 6); ctx.fill(); ctx.strokeStyle = "#c9a26a"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(40, 202); ctx.quadraticCurveTo(38, 194, 52, 194); ctx.moveTo(160, 202); ctx.quadraticCurveTo(162, 194, 148, 194); ctx.moveTo(44, 202); ctx.lineTo(156, 202); ctx.stroke();
    }
    if (p.cosmetics.includes("rocket")) { // a little rocket board with a flame
      ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.roundRect(40, 184, 120, 14, 7); ctx.fill(); ctx.fillStyle = "#3b57d6"; ctx.beginPath(); ctx.moveTo(150, 184); ctx.lineTo(176, 191); ctx.lineTo(150, 198); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.moveTo(42, 186); ctx.lineTo(10 - (p.still ? 0 : Math.sin(p.t * 40) * 6), 191); ctx.lineTo(42, 196); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff3c2"; ctx.beginPath(); ctx.moveTo(42, 189); ctx.lineTo(24, 191); ctx.lineTo(42, 194); ctx.closePath(); ctx.fill();
    }
    if (p.cosmetics.includes("cape")) { // a flowing rose cape behind the body
      ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.moveTo(60, 100); ctx.quadraticCurveTo(20 - (p.still ? 0 : Math.sin(p.t * 9) * 5), 150, 34, 196); ctx.lineTo(166, 196); ctx.quadraticCurveTo(180 + (p.still ? 0 : Math.sin(p.t * 9) * 5), 150, 140, 100); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.moveTo(70, 110); ctx.quadraticCurveTo(50, 150, 56, 190); ctx.lineTo(74, 190); ctx.quadraticCurveTo(70, 150, 84, 112); ctx.closePath(); ctx.fill();
    }
    const has0 = (id: string) => p.cosmetics.includes(id); const X = p.skin === "explorer"; const sw = p.still ? 0 : Math.sin(p.t * 5);
    if (has0("wings")) { // big feathered wings, white with violet tips (behind the body)
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(100 + sd * 44, 110); ctx.rotate(sd * (0.25 + sw * 0.05)); const g2 = ctx.createLinearGradient(0, -40, sd * 80, 20); g2.addColorStop(0, "#ffffff"); g2.addColorStop(1, "#c9b8ff"); ctx.fillStyle = g2; ctx.strokeStyle = "#9b7bff"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 60, -70, sd * 96, -46); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(sd * (92 - i * 22), -26 + i * 18, sd * (76 - i * 22), -10 + i * 20); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    if (has0("jetpack")) { for (const sd of [-1, 1]) { ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.roundRect(sd < 0 ? 30 : 142, 92, 28, 70, 12); ctx.fill(); ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.fillRect(sd < 0 ? 34 : 146, 112, 20, 8); ctx.fillStyle = "#ff8a3c"; ctx.beginPath(); const fx = sd < 0 ? 44 : 156; ctx.moveTo(fx - 9, 162); ctx.lineTo(fx, 186 + (p.still ? 0 : Math.sin(p.t * 30 + sd) * 6)); ctx.lineTo(fx + 9, 162); ctx.closePath(); ctx.fill(); } }
    if (has0("backpack") || (X && !has0("jetpack") && !has0("wings") && !has0("balloon") && !has0("kite"))) { ctx.fillStyle = X ? "#c47a2c" : "#3b57d6"; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(124, 90, 46, 74, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = X ? "#8a5a2b" : "#ffce4a"; ctx.beginPath(); ctx.roundRect(134, 128, 28, 22, 6); ctx.fill(); if (X) { ctx.fillStyle = "#ffe3a8"; ctx.beginPath(); ctx.roundRect(128, 82, 38, 14, 6); ctx.fill(); ctx.stroke(); } }
    if (has0("balloon")) { const bx = 170 + sw * 4; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(146, 112); ctx.quadraticCurveTo(160, 60, bx, 30); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.ellipse(bx, 12, 21, 26, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = "#c8901a"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(bx - 8, 2, 4.5, 9, -0.4, 0, TAU); ctx.fill(); ctx.fillStyle = "#c8901a"; ctx.beginPath(); ctx.moveTo(bx - 4, 38); ctx.lineTo(bx + 4, 38); ctx.lineTo(bx, 32); ctx.closePath(); ctx.fill(); }
    if (has0("kite")) { const kx = 20 - sw * 3; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, 112); ctx.quadraticCurveTo(30, 80, kx + 6, 46); ctx.stroke(); ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.moveTo(kx, 6); ctx.lineTo(kx + 24, 30); ctx.lineTo(kx, 60); ctx.lineTo(kx - 24, 30); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(kx, 6); ctx.lineTo(kx, 60); ctx.moveTo(kx - 24, 30); ctx.lineTo(kx + 24, 30); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.moveTo(kx, 30); ctx.lineTo(kx + 24, 30); ctx.lineTo(kx, 6); ctx.closePath(); ctx.fill(); }
    if (has0("toboggan")) { ctx.fillStyle = "#c9a26a"; ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, 200); ctx.lineTo(168, 200); ctx.quadraticCurveTo(190, 200, 188, 176); ctx.quadraticCurveTo(186, 190, 168, 190); ctx.lineTo(24, 190); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#3b57d6"; ctx.fillRect(50, 192, 100, 5); }
    if (has0("skis")) { for (const [x0, x1] of [[32, 96], [104, 168]] as const) { ctx.fillStyle = "#ff9ec7"; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, 198); ctx.lineTo(x1 - 6, 198); ctx.quadraticCurveTo(x1 + 8, 198, x1 + 10, 190); ctx.lineTo(x1 - 4, 194); ctx.lineTo(x0, 194); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
    if (has0("snowboard")) { ctx.fillStyle = "#ffce4a"; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(26, 188, 148, 12, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#3b57d6"; ctx.fillRect(40, 192, 120, 4); }
    const beak = ctx.createLinearGradient(0, 100, 0, 124); beak.addColorStop(0, P.beak0); beak.addColorStop(1, P.beak1);
    ctx.fillStyle = beak; ctx.beginPath(); ctx.ellipse(76, 192, 18, 8, -0.15, 0, TAU); ctx.ellipse(124, 192, 18, 8, 0.15, 0, TAU); ctx.fill();
    // wings
    const flap = p.still ? 0 : Math.sin(p.t * 14) * 0.08 * p.wing;
    const body = ctx.createLinearGradient(0, 60, 0, 190); body.addColorStop(0, P.penguinRim); body.addColorStop(0.3, P.penguin); body.addColorStop(1, "#141a44");
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(100 + sd * 52, 120); ctx.rotate(sd * (0.35 + p.wing * 0.25 + flap)); ctx.fillStyle = body; ctx.strokeStyle = P.penguinRim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sd * 6, 30, 13, 38, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = body; ctx.strokeStyle = P.penguinRim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(100, 122, 58, 74, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (p.face) {
      const bl = ctx.createLinearGradient(0, 100, 0, 190); bl.addColorStop(0, "#ffffff"); bl.addColorStop(1, "#dfe7ff");
      ctx.fillStyle = bl; ctx.beginPath(); ctx.ellipse(100, 142, 38, 52, 0, 0, TAU); ctx.fill();
      if (!X) { ctx.fillStyle = "rgba(255,150,180,.55)"; ctx.beginPath(); ctx.arc(70, 112, 9.5, 0, TAU); ctx.arc(130, 112, 9.5, 0, TAU); ctx.fill(); } // Explorer: no blush
      // eyes
      for (const ex of [80, 120]) {
        if (p.eyes === "happy") { ctx.strokeStyle = "#1d1630"; ctx.lineWidth = 4.2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ex - 8, 100); ctx.quadraticCurveTo(ex, X ? 94 : 87, ex + 8, 100); ctx.stroke(); }
        else if (p.eyes === "oops") { ctx.strokeStyle = "#1d1630"; ctx.lineWidth = 3.8; ctx.lineCap = "round"; ctx.beginPath(); const s = ex < 100 ? 1 : -1; ctx.moveTo(ex - 7 * s, 92); ctx.lineTo(ex + 6 * s, 98); ctx.lineTo(ex - 7 * s, 104); ctx.stroke(); }
        else { const bl2 = (1 - p.blink * 0.92) * (X ? 0.68 : 1); ctx.fillStyle = "#1d1630"; ctx.beginPath(); ctx.ellipse(ex, X ? 99 : 98, X ? 7.4 : 9, (X ? 7.4 : 9) * bl2, 0, 0, TAU); ctx.fill(); if (X) { ctx.strokeStyle = "#1d1630"; ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ex - 9 * (ex < 100 ? 1 : -1), 88 + (ex < 100 ? 0 : 0)); ctx.lineTo(ex + 8 * (ex < 100 ? 1 : -1), 91); ctx.stroke(); } if (bl2 > 0.4) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + 3.4, 94.5, 3.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(ex - 3, 101.6, 1.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } }
      }
      ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(90, 107); ctx.quadraticCurveTo(100, 104, 110, 107); ctx.quadraticCurveTo(108, 116, 100, 123); ctx.quadraticCurveTo(92, 116, 90, 107); ctx.fill();
      if (p.eyes === "happy" && !X) { ctx.fillStyle = "#c2452e"; ctx.beginPath(); ctx.moveTo(94, 116); ctx.quadraticCurveTo(100, 126, 106, 116); ctx.quadraticCurveTo(105, 124, 100, 126); ctx.quadraticCurveTo(95, 124, 94, 116); ctx.fill(); }
      if (p.cosmetics.includes("tube")) { ctx.strokeStyle = "#7fe3ff"; ctx.lineWidth = 15; ctx.beginPath(); ctx.ellipse(100, 186, 62, 15, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(100, 182, 62, 13, 0, Math.PI, TAU); ctx.stroke(); }
      if (p.cosmetics.includes("stripe")) { ctx.fillStyle = P.violet; ctx.beginPath(); ctx.moveTo(56, 128); ctx.quadraticCurveTo(100, 150, 144, 128); ctx.lineTo(144, 142); ctx.quadraticCurveTo(100, 166, 56, 142); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(66 + i * 16, 133 + Math.abs(i - 2) * 0.5); ctx.lineTo(74 + i * 16, 138); ctx.lineTo(70 + i * 16, 148); ctx.lineTo(62 + i * 16, 143); ctx.closePath(); ctx.fill(); } ctx.fillStyle = P.violet; rr(ctx, 124, 138, 16, 34, 6); ctx.fill(); ctx.fillStyle = P.gold; ctx.fillRect(124, 158, 16, 5); }
      else if (p.cosmetics.includes("scarf")) { ctx.fillStyle = P.royal; ctx.beginPath(); ctx.moveTo(56, 128); ctx.quadraticCurveTo(100, 150, 144, 128); ctx.lineTo(144, 142); ctx.quadraticCurveTo(100, 166, 56, 142); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.moveTo(56, 134); ctx.quadraticCurveTo(100, 156, 144, 134); ctx.lineTo(144, 138); ctx.quadraticCurveTo(100, 160, 56, 138); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.royal; rr(ctx, 124, 138, 16, 34, 6); ctx.fill(); }
      if (has0("bowtie")) { ctx.fillStyle = "#ff9ec7"; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(100, 138); ctx.lineTo(74, 124); ctx.lineTo(74, 152); ctx.closePath(); ctx.moveTo(100, 138); ctx.lineTo(126, 124); ctx.lineTo(126, 152); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.arc(100, 138, 7, 0, TAU); ctx.fill(); ctx.stroke(); }
      if (has0("bell")) { ctx.strokeStyle = P.royal; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(60, 126); ctx.quadraticCurveTo(100, 154, 140, 126); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.strokeStyle = "#c8901a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(90, 148); ctx.quadraticCurveTo(90, 136, 100, 136); ctx.quadraticCurveTo(110, 136, 110, 148); ctx.lineTo(114, 154); ctx.lineTo(86, 154); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#c8901a"; ctx.beginPath(); ctx.arc(100, 157, 3.5, 0, TAU); ctx.fill(); }
      if (has0("pearls")) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#c9b8ff"; ctx.lineWidth = 1.6; for (let i = 0; i < 9; i++) { const a = i / 8; const px = 62 + a * 76, py = 128 + Math.sin(a * Math.PI) * 22; ctx.beginPath(); ctx.arc(px, py, 5.4, 0, TAU); ctx.fill(); ctx.stroke(); } }
      if (p.cosmetics.includes("medal")) { ctx.fillStyle = P.royal; ctx.beginPath(); ctx.moveTo(92, 150); ctx.lineTo(100, 168); ctx.lineTo(108, 150); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(100, 174, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = "#c8901a"; ctx.lineWidth = 2; ctx.stroke(); }
    } else {
      ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.beginPath(); ctx.ellipse(84, 110, 12, 40, 0, 0, TAU); ctx.fill();
    }
    // story outfits: the penguin dresses for each biome (automatic, part of the journey; the earned wardrobe goes on top of this)
    const has = (id: string) => p.cosmetics.includes(id);
    if (has("outfit_caves")) { // miner's helmet with a lamp
      ctx.fillStyle = "#ffce4a"; ctx.beginPath(); ctx.moveTo(60, 82); ctx.quadraticCurveTo(62, 40, 100, 38); ctx.quadraticCurveTo(138, 40, 140, 82); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#c8901a"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#c8901a"; ctx.fillRect(56, 78, 88, 8); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(100, 56, 10, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,246,190,.4)"; ctx.beginPath(); ctx.moveTo(100, 56); ctx.lineTo(70, 6); ctx.lineTo(130, 6); ctx.closePath(); ctx.fill();
    }
    if (has("outfit_storm")) { // woolly hat + goggles
      ctx.fillStyle = "#56658f"; ctx.beginPath(); ctx.moveTo(60, 84); ctx.quadraticCurveTo(62, 40, 100, 38); ctx.quadraticCurveTo(138, 40, 140, 84); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#dbe5f6"; rr(ctx, 56, 76, 88, 14, 7); ctx.fill();
      ctx.fillStyle = "rgba(127,227,255,.75)"; ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 4; for (const gx of [80, 120]) { ctx.beginPath(); ctx.arc(gx, 94, 13, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(93, 94); ctx.lineTo(107, 94); ctx.stroke();
    }
    if (has("outfit_aurora")) { ctx.fillStyle = "rgba(179,157,255,.9)"; ctx.beginPath(); ctx.moveTo(52, 126); ctx.quadraticCurveTo(100, 156, 148, 126); ctx.lineTo(148, 140); ctx.quadraticCurveTo(100, 170, 52, 140); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.gold; for (const [sx, sy] of [[70, 140], [100, 150], [130, 140]] as const) { ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, TAU); ctx.fill(); } }
    if (has("outfit_summit")) { ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.moveTo(52, 128); ctx.quadraticCurveTo(100, 154, 148, 128); ctx.lineTo(148, 142); ctx.quadraticCurveTo(100, 168, 52, 142); ctx.closePath(); ctx.fill(); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.moveTo(132, 60); ctx.lineTo(132, 34); ctx.lineTo(154, 42); ctx.lineTo(132, 50); ctx.closePath(); ctx.fill(); ctx.fillRect(130, 34, 3, 28); }
    const outfitHat = has("outfit_caves") || has("outfit_storm");
    if (outfitHat) { /* the biome hat above */ } else if (p.cosmetics.includes("crown")) { // a small gold crown instead of the mortar board
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.moveTo(64, 78); ctx.lineTo(64, 52); ctx.lineTo(82, 66); ctx.lineTo(100, 44); ctx.lineTo(118, 66); ctx.lineTo(136, 52); ctx.lineTo(136, 78); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#c8901a"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = P.royal; ctx.beginPath(); ctx.arc(100, 68, 5, 0, TAU); ctx.fill(); ctx.fillStyle = P.rose; ctx.beginPath(); ctx.arc(80, 72, 3.5, 0, TAU); ctx.arc(120, 72, 3.5, 0, TAU); ctx.fill();
    } else if (has("earmuffs")) { // band over the head, fluffy rose muffs
      ctx.strokeStyle = P.navy; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(100, 96, 46, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      for (const mx of [54, 146]) { ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.arc(mx, 100, 16, 0, TAU); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]); }
    } else if (has("wizard")) { // tall violet wizard hat with gold stars
      ctx.fillStyle = "#6f4fd4"; ctx.beginPath(); ctx.moveTo(56, 84); ctx.quadraticCurveTo(84, 60, 92, 6); ctx.quadraticCurveTo(106, -6, 116, 10); ctx.quadraticCurveTo(112, 50, 144, 84); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#3b2a98"; ctx.beginPath(); ctx.ellipse(100, 84, 54, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffce4a"; for (const [sx, sy, sr] of [[98, 44, 6], [86, 66, 4], [112, 62, 4]] as const) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a1 = -Math.PI / 2 + (i * Math.PI) / 5; const r1 = i % 2 ? sr * 0.45 : sr; ctx.lineTo(sx + Math.cos(a1) * r1, sy + Math.sin(a1) * r1); } ctx.closePath(); ctx.fill(); }
    } else if (has("viking")) { // a grey helmet with two white horns
      ctx.fillStyle = "#f4f0e6"; ctx.strokeStyle = "#bdb6a4"; ctx.lineWidth = 2.5; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + sd * 44, 76); ctx.quadraticCurveTo(100 + sd * 72, 74, 100 + sd * 64, 34); ctx.quadraticCurveTo(100 + sd * 56, 62, 100 + sd * 38, 66); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "#9aa6c4"; ctx.strokeStyle = "#5670c0"; ctx.beginPath(); ctx.moveTo(58, 86); ctx.quadraticCurveTo(58, 40, 100, 38); ctx.quadraticCurveTo(142, 40, 142, 86); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.fillRect(56, 76, 88, 9); ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(82, 56, 8, 14, -0.5, 0, TAU); ctx.fill();
    } else if (has("chef")) { // a tall white chef's hat
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#c9d6ff"; ctx.lineWidth = 2.5; for (const [cx2, cy2, r2] of [[78, 44, 20], [122, 44, 20], [100, 30, 24]] as const) { ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.roundRect(66, 46, 68, 38, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#c9d6ff"; ctx.fillRect(66, 74, 68, 6);
    } else if (has("pirate")) { // a navy tricorn with a gold star
      ctx.fillStyle = "#26357f"; ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(38, 74); ctx.quadraticCurveTo(100, 84, 162, 74); ctx.quadraticCurveTo(140, 36, 100, 30); ctx.quadraticCurveTo(60, 36, 38, 74); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ffce4a"; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a1 = -Math.PI / 2 + (i * Math.PI) / 5; const r1 = i % 2 ? 5 : 11; ctx.lineTo(100 + Math.cos(a1) * r1, 56 + Math.sin(a1) * r1); } ctx.closePath(); ctx.fill();
    } else if (has("spacehelmet")) { // a glass bubble with a gold rim and a little antenna
      ctx.fillStyle = "rgba(191,230,255,.22)"; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(100, 96, 58, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(100, 96, 60, Math.PI * 0.32, Math.PI * 0.68); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(100, 96, 46, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke(); ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(140, 50); ctx.lineTo(150, 30); ctx.stroke(); ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.arc(150, 28, 5, 0, TAU); ctx.fill();
    } else if (has("antlers")) { // little tan antlers on a wooly band
      ctx.strokeStyle = "#a9794a"; ctx.lineWidth = 6; ctx.lineCap = "round"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + sd * 22, 62); ctx.quadraticCurveTo(100 + sd * 34, 40, 100 + sd * 30, 14); ctx.moveTo(100 + sd * 31, 40); ctx.lineTo(100 + sd * 48, 30); ctx.moveTo(100 + sd * 27, 26); ctx.lineTo(100 + sd * 40, 12); ctx.stroke(); }
      ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.roundRect(66, 66, 68, 14, 7); ctx.fill(); ctx.fillStyle = "#fff"; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(76 + i * 10.5, 73, 2.6, 0, TAU); ctx.fill(); }
    } else if (has("tophat")) { // a violet top hat with a gold band
      ctx.fillStyle = "#26357f"; ctx.beginPath(); ctx.ellipse(100, 78, 52, 11, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.roundRect(72, 14, 56, 64, 6); ctx.fill(); ctx.fillStyle = "#ffce4a"; ctx.fillRect(72, 58, 56, 9); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(78, 20, 8, 34);
    } else if (p.cosmetics.includes("goggles")) { // a flyer's leather cap with goggles pushed up
      ctx.fillStyle = "#8a5a2b"; ctx.beginPath(); ctx.moveTo(58, 88); ctx.quadraticCurveTo(58, 42, 100, 40); ctx.quadraticCurveTo(142, 42, 142, 88); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#6a4020"; ctx.fillRect(56, 80, 88, 9);
      ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = 5; for (const gx of [82, 118]) { ctx.fillStyle = "rgba(127,227,255,.85)"; ctx.beginPath(); ctx.arc(gx, 66, 13, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(95, 66); ctx.lineTo(105, 66); ctx.stroke();
    } else if (p.cosmetics.includes("beanie")) { // a woolly beanie with a pom-pom
      ctx.fillStyle = P.royal; ctx.beginPath(); ctx.moveTo(60, 84); ctx.quadraticCurveTo(62, 40, 100, 38); ctx.quadraticCurveTo(138, 40, 140, 84); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; rr(ctx, 56, 76, 88, 16, 8); ctx.fill(); ctx.strokeStyle = "rgba(59,87,214,.5)"; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(62 + i * 11, 78); ctx.lineTo(62 + i * 11, 90); ctx.stroke(); }
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(100, 34, 10, 0, TAU); ctx.fill();
    } else if (X) { // Explorer: a fur-trimmed expedition hood with the goggles pushed up (instead of the graduation cap)
      const hg = ctx.createLinearGradient(0, 30, 0, 96); hg.addColorStop(0, "#4a5a8e"); hg.addColorStop(1, "#2a3560"); ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(48, 104); ctx.quadraticCurveTo(44, 36, 100, 30); ctx.quadraticCurveTo(156, 36, 152, 104); ctx.quadraticCurveTo(126, 80, 100, 80); ctx.quadraticCurveTo(74, 80, 48, 104); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4efe6"; for (let i = 0; i <= 12; i++) { const a1 = Math.PI * (1.04 + (i / 12) * 0.92); ctx.beginPath(); ctx.arc(100 + Math.cos(a1) * 50, 96 + Math.sin(a1) * 44, 7.5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = "#1b2350"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(56, 66); ctx.quadraticCurveTo(100, 54, 144, 66); ctx.stroke(); for (const gx of [80, 120]) { ctx.fillStyle = "rgba(255,190,80,.85)"; ctx.strokeStyle = "#ffce4a"; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(gx, 62, 12, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(gx - 4, 58, 3, 0, TAU); ctx.fill(); }
    } else {
      // graduation cap (the mascot's mortar board + gold tassel)
      ctx.fillStyle = "#2a3470"; ctx.beginPath(); ctx.moveTo(76, 74); ctx.lineTo(76, 87); ctx.quadraticCurveTo(100, 101, 124, 87); ctx.lineTo(124, 74); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#151b40"; ctx.beginPath(); ctx.moveTo(50, 64); ctx.lineTo(100, 42); ctx.lineTo(150, 64); ctx.lineTo(100, 86); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.moveTo(50, 64); ctx.lineTo(100, 42); ctx.lineTo(100, 52); ctx.lineTo(66, 66); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.gold; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(148, 64); ctx.lineTo(148 + (p.face ? 0 : 0), 88); ctx.stroke();
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(148, 92, 5.2, 0, TAU); ctx.fill(); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(145, 96); ctx.lineTo(143, 104); ctx.moveTo(148, 97); ctx.lineTo(148, 106); ctx.moveTo(151, 96); ctx.lineTo(153, 104); ctx.stroke();
    }
    ctx.restore();
  }
};
