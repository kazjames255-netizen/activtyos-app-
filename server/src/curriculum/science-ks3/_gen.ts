// Draws every science-ks3 diagram FROM _data.ts (SVG -> PNG via Playwright chromium + sharp palette quantise).
//   cd server && npx tsx src/curriculum/science-ks3/_gen.ts [file-substring ...]
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as D from "./_data";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../scratch/curriculum-images/science-ks3");
mkdirSync(OUT, { recursive: true });
const C = { bg: "#fbfaf6", ink: "#1f2a44", soft: "#5b6785", grid: "#dfe5ef", blue: "#3b82c4", blueL: "#d6e8f8", orange: "#f08a24", orangeL: "#fde3c4", green: "#3f9d6b", greenL: "#d9f0e2", red: "#d64545", yellow: "#f4c542", purple: "#8a5cc0", purpleL: "#e3d4f5" };
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f = (n: number) => Math.round(n * 100) / 100;
const T = (x: number, y: number, s: string | number, o: { size?: number; weight?: number; fill?: string; anchor?: string; rot?: number } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${o.size ?? 20}" font-weight="${o.weight ?? 500}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "middle"}" dominant-baseline="central"${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(y)})"` : ""}>${esc(s)}</text>`;
const L = (x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string; dash?: string; cap?: string } = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${o.c ?? C.ink}" stroke-width="${o.w ?? 3}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} stroke-linecap="${o.cap ?? "round"}"/>`;
const svg = (w: number, h: number, body: string, bg = C.bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
const rad = (d: number) => (d * Math.PI) / 180;
const head = (x: number, y: number, ang: number, size = 16, fill = C.ink) => { // arrowhead at tip (x,y) pointing in screen direction ang (deg, 0 = right, 90 = down)
  const a = [x - size * Math.cos(rad(ang - 25)), y - size * Math.sin(rad(ang - 25))], b = [x - size * Math.cos(rad(ang + 25)), y - size * Math.sin(rad(ang + 25))];
  return `<polygon points="${f(x)},${f(y)} ${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])}" fill="${fill}"/>`;
};
const arrow = (x1: number, y1: number, x2: number, y2: number, o: { w?: number; c?: string; size?: number } = {}) => {
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, s = o.size ?? 16;
  return L(x1, y1, x2 - s * 0.8 * Math.cos(rad(ang)), y2 - s * 0.8 * Math.sin(rad(ang)), { w: o.w ?? 4, c: o.c }) + head(x2, y2, ang, s, o.c ?? C.ink);
};
const lab = (letter: string, tx: number, ty: number, px: number, py: number) => // lettered label with leader line to a target point
  `${L(tx, ty, px, py, { w: 2.5 })}<circle cx="${px}" cy="${py}" r="4.5" fill="${C.ink}"/><circle cx="${tx}" cy="${ty}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>${T(tx, ty + 1, letter, { size: 20, weight: 700 })}`;

// generic line/scatter chart frame
function chart(o: { w: number; h: number; box: [number, number, number, number]; x: [number, number, number]; y: [number, number, number]; xl: string; yl: string; gridX?: boolean; ynum?: (v: number) => string; yo?: number }) {
  const [bx0, by0, bx1, by1] = o.box; // pixel box: left, top, right, bottom
  const sx = (v: number) => bx0 + ((v - o.x[0]) / (o.x[1] - o.x[0])) * (bx1 - bx0);
  const sy = (v: number) => by1 - ((v - o.y[0]) / (o.y[1] - o.y[0])) * (by1 - by0);
  let s = "";
  for (let v = o.y[0]; v <= o.y[1] + 1e-9; v += o.y[2]) s += L(bx0, sy(v), bx1, sy(v), { w: 1.3, c: C.grid }) + T(bx0 - 12, sy(v), o.ynum ? o.ynum(v) : f(v), { size: 16, anchor: "end", fill: C.soft });
  for (let v = o.x[0]; v <= o.x[1] + 1e-9; v += o.x[2]) s += (o.gridX === false ? "" : L(sx(v), by0, sx(v), by1, { w: 1.3, c: C.grid })) + T(sx(v), by1 + 20, f(v), { size: 16, fill: C.soft });
  s += L(bx0, by0, bx0, by1, { w: 3 }) + L(bx0, by1, bx1, by1, { w: 3 });
  s += T((bx0 + bx1) / 2, by1 + 52, o.xl, { size: 19 }) + T(bx0 - (o.yo ?? 62), (by0 + by1) / 2, o.yl, { size: 19, rot: -90 });
  return { sx, sy, base: s };
}

const images: Record<string, string> = {};

// ── cells ────────────────────────────────────────────────────────────────────
{
  let s = `<ellipse cx="400" cy="250" rx="250" ry="180" fill="#f7e2d2" stroke="#b5654a" stroke-width="7"/>`;
  s += `<circle cx="390" cy="235" r="62" fill="#c9b4e8" stroke="#6b4aa0" stroke-width="4"/><circle cx="378" cy="228" r="16" fill="#8a6bc0"/>`;
  const mito = (x: number, y: number, r: number) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="44" ry="23" fill="#f6a3a3" stroke="#b03a3a" stroke-width="3.5"/><path d="M${x - 30},${y} q8,-14 15,0 t15,0 t15,0 t15,0" fill="none" stroke="#b03a3a" stroke-width="3"/></g>`;
  s += mito(250, 305, -20) + mito(525, 325, 15) + mito(520, 165, 35);
  for (const [x, y] of [[300, 180], [470, 260], [330, 350], [440, 385], [300, 250]]) s += `<circle cx="${x}" cy="${y}" r="4" fill="#8a6b5a"/>`;
  const p = (a: number) => [400 + 250 * Math.cos(rad(a)), 250 - 180 * Math.sin(rad(a))];
  const m = p(150);
  s += lab("A", 90, 90, m[0], m[1]) + lab("B", 470, 45, 405, 190) + lab("C", 705, 405, 545, 335) + lab("D", 400, 468, 385, 372);
  images["bcell-animal"] = svg(800, 500, s);
}
{
  let s = `<rect x="150" y="70" width="500" height="360" rx="26" fill="#e8f3d8" stroke="#a08a52" stroke-width="16"/><rect x="158" y="78" width="484" height="344" rx="20" fill="none" stroke="#c98a6a" stroke-width="3"/>`;
  s += `<ellipse cx="400" cy="255" rx="128" ry="98" fill="#cfe6f5" stroke="#6ba3cc" stroke-width="4"/>`;
  s += `<circle cx="588" cy="255" r="34" fill="#c9b4e8" stroke="#6b4aa0" stroke-width="4"/><circle cx="582" cy="250" r="10" fill="#8a6bc0"/>`;
  const chl = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="34" ry="19" fill="#4fae5a" stroke="#2c7a3a" stroke-width="3"/><path d="M${x - 20},${y - 5}h40M${x - 20},${y + 5}h40" stroke="#2c7a3a" stroke-width="2.5"/>`;
  s += chl(210, 140) + chl(210, 370) + chl(400, 112) + chl(440, 405);
  s += lab("P", 70, 250, 150, 250) + lab("Q", 90, 60, 205, 138) + lab("R", 330, 38, 330, 215) + lab("S", 735, 255, 600, 255);
  images["bcell-plant"] = svg(800, 500, s);
}
{
  let s = "";
  s += `<path d="M300,60 L300,235" stroke="#e59a9a" stroke-width="26" stroke-linecap="round" fill="none"/>`;
  s += `<path d="M300,235 C240,225 205,300 245,342 C285,382 355,372 365,322 C375,275 345,245 315,240 Z" fill="#f0a9a9" stroke="#b5655a" stroke-width="4"/>`;
  s += `<path d="M110,210 C120,150 210,150 270,180 C300,200 300,250 260,255 C200,262 140,280 110,250 Z" fill="#a4573a" stroke="#6b3620" stroke-width="4"/>`;
  s += `<path d="M195,595 L195,395 L400,395 L400,595" fill="none" stroke="#c98b6b" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="M310,375 L310,405 L240,425 L360,445 L240,465 L360,485 L240,505 L360,525 L240,545 L262,575 L195,595" fill="none" stroke="#f1a98f" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += lab("A", 430, 120, 306, 120) + lab("B", 470, 300, 350, 310) + lab("E", 60, 110, 130, 195) + lab("D", 500, 470, 405, 470) + lab("C", 300, 665, 300, 520);
  s += T(280, 690, "Simplified diagram (not to scale)", { size: 15, fill: C.soft });
  images["bfunc7-digestive"] = svg(560, 710, s);
}
{
  const st = "#2c7a3a";
  let s = `<path d="M350,560 L350,400" stroke="#4fae5a" stroke-width="14" stroke-linecap="round"/>`;
  s += `<path d="M330,410 C200,380 150,240 210,110 C260,200 300,320 345,385 Z" fill="#f4b6d0" stroke="#c0568a" stroke-width="3.5"/><path d="M370,410 C500,380 550,240 490,110 C440,200 400,320 355,385 Z" fill="#f4b6d0" stroke="#c0568a" stroke-width="3.5"/>`;
  s += `<path d="M330,405 C290,400 250,430 230,455 C280,455 320,440 340,420 Z" fill="#6cc27a" stroke="${st}" stroke-width="3.5"/><path d="M370,405 C410,400 450,430 470,455 C420,455 380,440 360,420 Z" fill="#6cc27a" stroke="${st}" stroke-width="3.5"/>`;
  s += `<path d="M330,375 C300,340 280,300 272,262" fill="none" stroke="#7aa35a" stroke-width="5"/><path d="M370,375 C400,340 420,300 428,262" fill="none" stroke="#7aa35a" stroke-width="5"/>`;
  s += `<ellipse cx="270" cy="240" rx="15" ry="26" fill="#f2b23a" stroke="#b07a10" stroke-width="3"/><ellipse cx="430" cy="240" rx="15" ry="26" fill="#f2b23a" stroke="#b07a10" stroke-width="3"/>`;
  s += `<ellipse cx="350" cy="370" rx="42" ry="52" fill="#b8e0a0" stroke="${st}" stroke-width="4"/>`;
  for (const [x, y] of [[338, 355], [362, 355], [350, 385]]) s += `<ellipse cx="${x}" cy="${y}" rx="8" ry="11" fill="#7ab55a" stroke="${st}" stroke-width="2"/>`;
  s += `<path d="M350,320 L350,205" stroke="#7aa35a" stroke-width="8" stroke-linecap="round"/><ellipse cx="350" cy="190" rx="24" ry="15" fill="#c8e05a" stroke="#6b8a1a" stroke-width="3.5"/>`;
  s += lab("A", 540, 100, 368, 186) + lab("B", 620, 240, 445, 242) + lab("C", 80, 200, 195, 222) + lab("D", 610, 385, 385, 375) + lab("E", 90, 500, 275, 440);
  s += T(350, 610, "A flower cut in half from top to bottom", { size: 16, fill: C.soft });
  images["brep-flower"] = svg(700, 640, s);
}

// ── data graphs (biology) ────────────────────────────────────────────────────
{
  const c = chart({ w: 800, h: 520, box: [110, 40, 740, 400], x: [40, 100, 10], y: [0, 100, 10], xl: "Children vaccinated (%)", yl: "Cases per 100 000 people" });
  let s = c.base;
  for (const [x, y] of D.VACC) s += `<circle cx="${c.sx(x)}" cy="${c.sy(y)}" r="8" fill="${C.blue}" stroke="#fff" stroke-width="2"/>`;
  images["bfunc8-vaccination"] = svg(800, 490, s);
}
{
  const c = chart({ w: 800, h: 500, box: [110, 40, 740, 380], x: [0, 10, 1], y: [0, 10, 1], xl: "Light intensity (arbitrary units)", yl: "Rate of photosynthesis (arbitrary units)" });
  let s = c.base + `<polyline points="${D.PHOTO.map(([x, y]) => `${c.sx(x)},${c.sy(y)}`).join(" ")}" fill="none" stroke="${C.green}" stroke-width="5" stroke-linejoin="round"/>`;
  for (const [x, y] of D.PHOTO) s += `<circle cx="${c.sx(x)}" cy="${c.sy(y)}" r="6" fill="${C.green}" stroke="#fff" stroke-width="2"/>`;
  images["bgas-photosynthesis"] = svg(800, 470, s);
}
{
  const c = chart({ w: 800, h: 500, box: [110, 40, 740, 380], x: [0, 1, 1], y: [0, 10, 2], xl: "Height (cm)", yl: "Number of students", gridX: false });
  let s = c.base.replace(/<text[^>]*>(0|1)<\/text>/g, (m) => (m.includes('dominant') && /y="4[0-9][0-9]/.test(m) ? "" : m)); // drop the placeholder x ticks
  const n = D.HEIGHTS.length, bw = (740 - 110) / n;
  D.HEIGHTS.forEach(([lo, cnt], i) => {
    const x = 110 + i * bw;
    s += `<rect x="${x}" y="${c.sy(cnt)}" width="${bw}" height="${380 - c.sy(cnt)}" fill="${C.blue}" stroke="#fff" stroke-width="3"/>` + T(x + bw / 2, 380 + 20, `${lo}–${lo + 4}`, { size: 16, fill: C.soft });
  });
  images["bgen-heights"] = svg(800, 470, s);
}
{
  const nodeW = (n: string) => 40 + n.length * 12;
  let s = "";
  const edge = (a: [number, number], b: [number, number], wa: number, wb: number) => { // arrow between rounded boxes, clipped to box borders
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const clip = (w: number, h: number) => Math.min(Math.abs(dx) < 1e-6 ? 1e9 : w / 2 / Math.abs(dx), Math.abs(dy) < 1e-6 ? 1e9 : h / 2 / Math.abs(dy));
    const t1 = clip(wa, 44) + 0.02, t2 = 1 - clip(wb, 44) - 0.03;
    return arrow(a[0] + dx * t1, a[1] + dy * t1, a[0] + dx * t2, a[1] + dy * t2, { w: 3.5, c: C.soft, size: 15 });
  };
  for (const [a, b] of D.FOODWEB.edges) s += edge(D.FOODWEB.nodes[a], D.FOODWEB.nodes[b], nodeW(a), nodeW(b));
  for (const [n, [x, y]] of Object.entries(D.FOODWEB.nodes)) s += `<rect x="${x - nodeW(n) / 2}" y="${y - 22}" width="${nodeW(n)}" height="44" rx="12" fill="${n === "Grass" ? C.greenL : C.blueL}" stroke="${C.ink}" stroke-width="3"/>` + T(x, y + 1, n, { size: 21, weight: 600 });
  s += T(400, 535, "Arrows point from the organism that is eaten to the organism that eats it", { size: 16, fill: C.soft });
  images["becol-foodweb"] = svg(800, 560, s);
}

// ── chemistry ────────────────────────────────────────────────────────────────
function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
{
  let s = "";
  const r = 13;
  D.STATES_PANELS.forEach((p, i) => {
    const ox = 30 + i * 255, oy = 70, w = 225, h = 230;
    s += `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${C.ink}" stroke-width="3"/>` + T(ox + 24, oy - 28, p.letter, { size: 30, weight: 700, anchor: "middle" });
    const rand = rng(7 + i * 13);
    if (p.state === "solid") for (let a = 0; a < 6; a++) for (let b = 0; b < 7; b++) s += `<circle cx="${ox + 22 + b * 30}" cy="${oy + 24 + a * 30}" r="${r}" fill="${C.blue}" stroke="#1d4f80" stroke-width="2"/>`;
    if (p.state === "liquid") for (let a = 0; a < 6; a++) for (let b = 0; b < 7; b++) { if ((a * 7 + b) % 9 === 4 && a > 1) continue; s += `<circle cx="${f(ox + 22 + b * 30 + (a % 2) * 5 + (rand() - 0.5) * 8)}" cy="${f(oy + 24 + a * 30 + (rand() - 0.5) * 8 + (a > 3 ? 2 : 0))}" r="${r}" fill="${C.blue}" stroke="#1d4f80" stroke-width="2"/>`; }
    if (p.state === "gas") { const pts: [number, number][] = []; while (pts.length < 7) { const q: [number, number] = [ox + 20 + rand() * (w - 40), oy + 20 + rand() * (h - 40)]; if (pts.every((z) => Math.hypot(z[0] - q[0], z[1] - q[1]) > 62)) pts.push(q); } for (const [x, y] of pts) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${C.blue}" stroke="#1d4f80" stroke-width="2"/>`; }
  });
  images["cpart-states"] = svg(780, 330, s);
}
{
  const c = chart({ w: 800, h: 500, box: [110, 40, 740, 380], x: [0, 16, 2], y: [0, 200, 20], xl: "Time (minutes)", yl: "Temperature (°C)" });
  let s = c.base + `<polyline points="${D.HEATING.map(([x, y]) => `${c.sx(x)},${c.sy(y)}`).join(" ")}" fill="none" stroke="${C.red}" stroke-width="5" stroke-linejoin="round"/>`;
  images["cpart-heating"] = svg(800, 470, s);
}
{
  let s = "";
  const rand = rng(21);
  D.MIXBOXES.forEach((b, i) => {
    const ox = 30 + (i % 2) * 380, oy = 30 + Math.floor(i / 2) * 250, w = 340, h = 210;
    s += `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${C.ink}" stroke-width="3"/><circle cx="${ox + 24}" cy="${oy + 24}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>` + T(ox + 24, oy + 25, b.letter, { size: 20, weight: 700 });
    const atom = (x: number, y: number, col: string, dark: string) => `<circle cx="${f(x)}" cy="${f(y)}" r="15" fill="${col}" stroke="${dark}" stroke-width="2.5"/>`;
    const X = (x: number, y: number) => atom(x, y, C.blue, "#1d4f80"), Y = (x: number, y: number) => atom(x, y, C.orange, "#a55510");
    const slots: [number, number][] = []; // fixed jittered grid of centres inside the box
    for (let a = 0; a < 3; a++) for (let q = 0; q < 4; q++) slots.push([ox + 55 + q * 80 + (rand() - 0.5) * 16, oy + 65 + a * 62 + (rand() - 0.5) * 12]);
    const pair = (x: number, y: number, k: 0 | 1) => (k ? X(x - 15, y) + X(x + 15, y) : X(x - 15, y) + Y(x + 15, y));
    if (b.kind === "element-atoms") for (const [x, y] of slots.slice(0, 11)) s += X(x, y);
    if (b.kind === "compound") for (const [x, y] of slots.filter((_, k) => k % 2 === 0).slice(0, 6)) s += pair(x + 10, y, 0);
    if (b.kind === "mixture") slots.slice(0, 11).forEach(([x, y], k) => (s += k % 2 ? Y(x, y) : X(x, y)));
    if (b.kind === "element-molecules") for (const [x, y] of slots.filter((_, k) => k % 2 === 0).slice(0, 6)) s += pair(x + 10, y, 1);
  });
  s += `<circle cx="60" cy="522" r="9" fill="${C.blue}"/>` + T(80, 522, "= atom of element X", { size: 16, anchor: "start" }) + `<circle cx="300" cy="522" r="9" fill="${C.orange}"/>` + T(320, 522, "= atom of element Y", { size: 16, anchor: "start" });
  images["cele7-boxes"] = svg(780, 550, s);
}
{
  const cw = 78, ch = 62, x0 = 80, y0 = 90;
  const gcol: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "0": 7 };
  let s = "";
  ["1", "2", "3", "4", "5", "6", "7", "0"].forEach((g, i) => (s += T(x0 + i * cw + cw / 2, 60, g, { size: 20, weight: 700 })));
  s += T(x0 + 4 * cw, 24, "Group", { size: 18, fill: C.soft });
  for (let p = 1; p <= 4; p++) s += T(48, y0 + (p - 1) * ch + ch / 2, p, { size: 20, weight: 700 });
  s += T(20, y0 + 2 * ch, "Period", { size: 18, fill: C.soft, rot: -90 });
  const hidden = Object.fromEntries(Object.entries(D.PT_HIDDEN).map(([k, v]) => [v, k]));
  for (const [sym, g, p] of D.PT) {
    const x = x0 + gcol[g] * cw, y = y0 + (p - 1) * ch, letter = hidden[sym];
    s += `<rect x="${x + 2}" y="${y + 2}" width="${cw - 4}" height="${ch - 4}" rx="6" fill="${letter ? C.yellow : "#fff"}" stroke="${C.ink}" stroke-width="2.5"/>` + T(x + cw / 2, y + ch / 2, letter ?? sym, { size: letter ? 30 : 24, weight: letter ? 800 : 600 });
  }
  s += T(400, y0 + 4 * ch + 26, "Groups 1, 2, 3, 4, 5, 6, 7 and 0. The transition metals (between Groups 2 and 3) are not shown.", { size: 14, fill: C.soft });
  images["cele8-periodic"] = svg(760, 430, s);
}
{
  const cols = ["#e1231f", "#e8402a", "#ee5f24", "#f2822a", "#f6a92c", "#f5d030", "#b9d63a", "#4fb85a", "#2fa89a", "#2f87c8", "#3a5cc0", "#5a4bb5", "#7a3fa8", "#8f3a9a", "#9b3585"];
  let s = "";
  cols.forEach((c, i) => (s += `<rect x="${40 + i * 48}" y="130" width="48" height="70" fill="${c}"/>` + T(64 + i * 48, 222, i, { size: 20, fill: C.soft })));
  s += `<rect x="40" y="130" width="720" height="70" fill="none" stroke="${C.ink}" stroke-width="3"/>`;
  for (const [k, ph] of Object.entries(D.PH_MARKS)) s += lab(k, 64 + ph * 48, 55, 64 + ph * 48, 128);
  s += T(60, 278, "← more acidic", { size: 18, anchor: "start", fill: C.soft }) + T(740, 278, "more alkaline →", { size: 18, anchor: "end", fill: C.soft });
  s += T(400, 258, "pH", { size: 20, weight: 700 });
  images["creact8-ph"] = svg(800, 310, s);
}
{
  const c = chart({ w: 800, h: 500, box: [140, 40, 740, 380], x: [0, 6, 1], y: [147, 151, 0.5], xl: "Time (minutes)", yl: "Mass of flask and contents (g)", ynum: (v) => v.toFixed(1), yo: 96 });
  let s = c.base + `<polyline points="${D.MASSLOSS.map(([x, y]) => `${c.sx(x)},${c.sy(y)}`).join(" ")}" fill="none" stroke="${C.purple}" stroke-width="5" stroke-linejoin="round"/>`;
  for (const [x, y] of D.MASSLOSS) s += `<circle cx="${c.sx(x)}" cy="${c.sy(y)}" r="6" fill="${C.purple}" stroke="#fff" stroke-width="2"/>`;
  images["creact9-massloss"] = svg(800, 470, s);
}
{
  let s = "", a0 = -90;
  const cols = [C.blue, C.orange, C.green];
  Object.entries(D.ATMOS).forEach(([k, [, pc]], i) => {
    const a1 = a0 + (pc / 100) * 360, cx = 230, cy = 210, r = 160;
    const p = (a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
    const [x0, y0] = p(a0), [x1, y1] = p(a1), big = a1 - a0 > 180 ? 1 : 0;
    s += `<path d="M${cx},${cy} L${f(x0)},${f(y0)} A${r},${r} 0 ${big} 1 ${f(x1)},${f(y1)} Z" fill="${cols[i]}" stroke="#fff" stroke-width="4"/>`;
    const mid = (a0 + a1) / 2, [lx, ly] = [cx + (r * 0.6) * Math.cos(rad(mid)), cy + r * 0.6 * Math.sin(rad(mid))];
    if (pc > 5) s += T(lx, ly, k, { size: 34, weight: 800, fill: "#fff" }); else s += lab(k, cx + 235, cy - 150, cx + r * Math.cos(rad(mid)), cy + r * Math.sin(rad(mid)));
    a0 = a1;
  });
  Object.entries(D.ATMOS).forEach(([k, [, pc]], i) => (s += `<rect x="470" y="${150 + i * 56}" width="26" height="26" rx="4" fill="${cols[i]}"/>` + T(512, 163 + i * 56, `${k}:  ${pc} %`, { size: 24, anchor: "start", weight: 600 })));
  s += T(230, 400, "Gases in dry air (by volume)", { size: 16, fill: C.soft });
  images["cearth-atmosphere"] = svg(720, 420, s);
}

// ── physics ──────────────────────────────────────────────────────────────────
{
  const box = (x: number, y: number, w: number, h: number, txt: string[], fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${C.ink}" stroke-width="3"/>` + txt.map((l, i) => T(x + w / 2, y + h / 2 + (i - (txt.length - 1) / 2) * 24, l, { size: 19, weight: i ? 500 : 700 })).join("");
  let s = box(30, 140, 200, 90, ["Battery", "chemical store"], C.orangeL) + box(340, 140, 130, 90, ["Lamp"], C.blueL) + box(560, 40, 210, 80, ["Surroundings", "lit up"], "#fff6c8") + box(560, 250, 210, 80, ["Surroundings", "warmer"], C.purpleL);
  s += arrow(232, 185, 338, 185, { w: 6 }) + arrow(472, 165, 558, 90, { w: 6 }) + arrow(472, 205, 558, 280, { w: 6 });
  for (const [k, x, y] of [["P", 285, 150], ["Q", 500, 100], ["R", 500, 268]] as [string, number, number][]) s += `<circle cx="${x}" cy="${y}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>` + T(x, y + 1, k, { size: 20, weight: 700 });
  images["penergy7-torch"] = svg(800, 370, s);
}
{
  const S = 0.4, inn = D.SANKEY.input, use = D.SANKEY.useful, waste = inn - use;
  const top = 90, hi = inn * S, hu = use * S, hw = waste * S;
  let s = `<rect x="40" y="${top}" width="200" height="${hi}" fill="${C.orangeL}" stroke="${C.orange}" stroke-width="3"/>`;
  s += `<path d="M240,${top} L660,${top} L660,${top + hu} L240,${top + hu} Z" fill="${C.greenL}" stroke="${C.green}" stroke-width="3"/><polygon points="660,${top - 12} 720,${top + hu / 2} 660,${top + hu + 12}" fill="${C.green}"/>`;
  const yw = 290;
  s += `<path d="M240,${top + hu} C330,${top + hu} 340,${yw} 430,${yw} L610,${yw} L610,${yw + hw} L430,${yw + hw} C340,${yw + hw} 330,${top + hi} 240,${top + hi} Z" fill="#f1d9d9" stroke="${C.red}" stroke-width="3"/><polygon points="610,${yw - 12} 670,${yw + hw / 2} 610,${yw + hw + 12}" fill="${C.red}"/>`;
  s += T(140, top + hi / 2, `Energy in ${inn} J`, { size: 22, weight: 700 }) + T(450, top + hu / 2, `Useful energy out ${use} J`, { size: 22, weight: 700 }) + T(520, yw + hw + 34, "Wasted energy (heating the surroundings)", { size: 19, fill: C.soft });
  s += T(400, 395, "Widths of the bands are drawn to the same scale", { size: 15, fill: C.soft });
  images["penergy9-sankey"] = svg(800, 420, s);
}
{
  const c = chart({ w: 800, h: 520, box: [110, 40, 740, 400], x: [0, 100, 10], y: [0, 300, 50], xl: "Time (s)", yl: "Distance from start (m)" });
  let s = c.base + `<polyline points="${D.DT.map(([x, y]) => `${c.sx(x)},${c.sy(y)}`).join(" ")}" fill="none" stroke="${C.blue}" stroke-width="5" stroke-linejoin="round"/>`;
  for (const [x, y] of D.DT) s += `<circle cx="${c.sx(x)}" cy="${c.sy(y)}" r="6" fill="${C.blue}" stroke="#fff" stroke-width="2"/>`;
  images["pforce8-distance-time"] = svg(800, 490, s);
}
{
  const S = 400, px = 400, m = D.MOMENT, lx = px - m.leftDist * S, rx = px + m.rightDist * S, by = 210;
  let s = `<rect x="150" y="${by - 9}" width="600" height="18" rx="4" fill="#c9a46a" stroke="#7a5a2a" stroke-width="3"/><polygon points="${px},${by + 9} ${px - 34},${by + 70} ${px + 34},${by + 70}" fill="${C.soft}" stroke="${C.ink}" stroke-width="3"/>`;
  s += L(120, by + 70, 780, by + 70, { w: 4 });
  s += arrow(lx, 80, lx, by - 11, { w: 6, c: C.red }) + arrow(rx, 80, rx, by - 11, { w: 6, c: C.red });
  s += T(lx, 55, `${m.leftForce} N`, { size: 26, weight: 700 }) + T(rx, 55, "? N", { size: 26, weight: 700 });
  const dim = (x1: number, x2: number, txt: string) => L(x1, by + 110, x2, by + 110, { w: 2.5 }) + L(x1, by + 98, x1, by + 122, { w: 2.5 }) + L(x2, by + 98, x2, by + 122, { w: 2.5 }) + T((x1 + x2) / 2, by + 138, txt, { size: 22 });
  s += dim(lx, px, `${m.leftDist.toFixed(2)} m`) + dim(px, rx, `${m.rightDist.toFixed(2)} m`);
  s += T(px, by + 88, "pivot", { size: 16, fill: C.soft }) + T(400, 385, "The beam is balanced (level). Ignore the weight of the beam.", { size: 16, fill: C.soft });
  images["pforce8-moments"] = svg(800, 410, s);
}
{
  const F = D.FORCES, S = 0.2, cx = 400, cy = 235;
  let s = L(60, cy + 40, 740, cy + 40, { w: 4, c: C.soft }) + `<rect x="${cx - 75}" y="${cy - 35}" width="150" height="75" rx="8" fill="${C.blueL}" stroke="${C.ink}" stroke-width="4"/>`;
  s += arrow(cx + 75, cy, cx + 75 + F.drive * S, cy, { w: 8, c: C.green }) + arrow(cx - 75, cy, cx - 75 - F.drag * S, cy, { w: 8, c: C.red });
  s += arrow(cx, cy, cx, cy + F.weight * S, { w: 8, c: C.purple }) + arrow(cx, cy, cx, cy - F.reaction * S, { w: 8, c: C.orange });
  s += T(cx + 90, cy - 52, `Driving force ${F.drive} N`, { size: 20, anchor: "start", weight: 600 });
  s += T(cx - 90, cy - 52, `Drag ${F.drag} N`, { size: 20, weight: 600, anchor: "end" }) + T(cx + 14, cy + F.weight * S + 4, `Weight ${F.weight} N`, { size: 20, anchor: "start", weight: 600 }) + T(cx + 14, cy - F.reaction * S + 4, `Reaction force ${F.reaction} N`, { size: 20, anchor: "start", weight: 600 });
  s += T(400, 470, "A box being pushed along a horizontal surface. Arrow lengths are drawn to the same scale.", { size: 15, fill: C.soft });
  images["pforce9-forces"] = svg(800, 490, s);
}
{
  const c = chart({ w: 800, h: 520, box: [110, 40, 720, 400], x: [0, 8, 1], y: [0, 14, 2], xl: "Extension of the spring (cm)", yl: "Force (N)" });
  let s = c.base;
  for (const [fN, ext] of D.SPRING) { const a = c.sx(ext), b = c.sy(fN); s += `${L(a - 8, b - 8, a + 8, b + 8, { w: 3.5, c: C.red })}${L(a - 8, b + 8, a + 8, b - 8, { w: 3.5, c: C.red })}`; }
  images["pforce9-spring"] = svg(800, 490, s);
}
{
  const ang = D.MIRROR_ANGLE, nx = 300, my = 330, len = 250;
  const sx = nx - len * Math.sin(rad(ang)), sy = my - len * Math.cos(rad(ang));
  let s = L(60, my, 540, my, { w: 6 });
  for (let x = 60; x < 540; x += 22) s += L(x, my, x - 14, my + 18, { w: 2.5, c: C.soft });
  s += L(nx, my, nx, 40, { w: 2.5, c: C.soft, dash: "10 8" }) + T(nx + 8, 30, "normal", { size: 17, anchor: "start", fill: C.soft });
  s += arrow(sx, sy, nx, my, { w: 5, c: C.orange });
  const ar = 90, a0 = [nx - ar * Math.sin(rad(ang)), my - ar * Math.cos(rad(ang))];
  s += `<path d="M${nx},${my - ar} A${ar},${ar} 0 0 0 ${f(a0[0])},${f(a0[1])}" fill="none" stroke="${C.ink}" stroke-width="3"/>` + T(nx - 55, my - 122, `${ang}°`, { size: 24, weight: 700 });
  s += T(sx - 10, sy - 6, "light ray", { size: 18, anchor: "end" }) + T(510, my + 44, "plane mirror", { size: 18, fill: C.soft });
  images["pwave8-mirror"] = svg(600, 400, s);
}
{
  let s = "";
  (["A", "B"] as const).forEach((k, i) => {
    const oy = 110 + i * 210, sc = 70, w = 620, x0 = 110, tr = D.TRACES[k];
    s += `<rect x="${x0}" y="${oy - 90}" width="${w}" height="180" fill="#fff" stroke="${C.ink}" stroke-width="3"/>` + L(x0, oy, x0 + w, oy, { w: 1.5, c: C.grid });
    for (let g = 1; g < 5; g++) s += L(x0 + (g * w) / 5, oy - 90, x0 + (g * w) / 5, oy + 90, { w: 1, c: C.grid });
    for (let g = -1; g <= 1; g += 1) s += L(x0, oy + g * 45, x0 + w, oy + g * 45, { w: 1, c: C.grid });
    const pts: string[] = [];
    for (let px = 0; px <= w; px += 3) pts.push(`${x0 + px},${f(oy - tr.amp * sc * Math.sin((2 * Math.PI * tr.cycles * px) / w))}`);
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${i ? C.orange : C.blue}" stroke-width="4.5"/>` + `<circle cx="60" cy="${oy}" r="22" fill="#fff" stroke="${C.ink}" stroke-width="3"/>` + T(60, oy + 1, k, { size: 26, weight: 700 });
  });
  s += T(420, 470, "Both traces use the same scale and the same time window (time runs left to right)", { size: 15, fill: C.soft });
  images["pwave8-traces"] = svg(800, 495, s);
}

// ── circuits ─────────────────────────────────────────────────────────────────
type Sym = "cell" | "battery" | "lamp" | "switch-open" | "switch-closed" | "ammeter" | "voltmeter" | "resistor";
function sym(t: Sym, x: number, y: number, vertical = false, bg = C.bg) {
  let s = `<rect x="${x - 34}" y="${y - 26}" width="68" height="52" fill="${bg}"/>`;
  const W = 3.5;
  if (t === "cell") s += L(x - 32, y, x - 5, y, { w: W }) + L(x + 5, y, x + 32, y, { w: W }) + L(x - 5, y - 20, x - 5, y + 20, { w: W }) + L(x + 5, y - 11, x + 5, y + 11, { w: 8, cap: "butt" });
  if (t === "battery") s += L(x - 32, y, x - 18, y, { w: W }) + L(x + 18, y, x + 32, y, { w: W }) + L(x - 18, y - 20, x - 18, y + 20, { w: W }) + L(x - 8, y - 11, x - 8, y + 11, { w: 8, cap: "butt" }) + L(x + 6, y - 20, x + 6, y + 20, { w: W }) + L(x + 16, y - 11, x + 16, y + 11, { w: 8, cap: "butt" }) + L(x - 8, y, x + 6, y, { w: W });
  if (t === "lamp") s += L(x - 32, y, x - 20, y, { w: W }) + L(x + 20, y, x + 32, y, { w: W }) + `<circle cx="${x}" cy="${y}" r="20" fill="#fff" stroke="${C.ink}" stroke-width="${W}"/>` + L(x - 14, y - 14, x + 14, y + 14, { w: 3 }) + L(x - 14, y + 14, x + 14, y - 14, { w: 3 });
  if (t === "ammeter" || t === "voltmeter") s += L(x - 32, y, x - 20, y, { w: W }) + L(x + 20, y, x + 32, y, { w: W }) + `<circle cx="${x}" cy="${y}" r="20" fill="#fff" stroke="${C.ink}" stroke-width="${W}"/>` + (vertical ? "" : T(x, y + 1, t === "ammeter" ? "A" : "V", { size: 24, weight: 700 }));
  if (t === "resistor") s += L(x - 32, y, x - 22, y, { w: W }) + L(x + 22, y, x + 32, y, { w: W }) + `<rect x="${x - 22}" y="${y - 10}" width="44" height="20" fill="#fff" stroke="${C.ink}" stroke-width="${W}"/>`;
  if (t === "switch-open" || t === "switch-closed") s += L(x - 32, y, x - 16, y, { w: W }) + L(x + 16, y, x + 32, y, { w: W }) + `<circle cx="${x - 16}" cy="${y}" r="4.5" fill="${C.ink}"/><circle cx="${x + 16}" cy="${y}" r="4.5" fill="${C.ink}"/>` + (t === "switch-open" ? L(x - 16, y, x + 12, y - 24, { w: W }) : L(x - 16, y, x + 16, y, { w: W }));
  if (!vertical) return s;
  // vertical: rotate, then draw the meter letter upright
  let g = `<g transform="rotate(90 ${x} ${y})">${s}</g>`;
  if (t === "ammeter" || t === "voltmeter") g += T(x, y + 1, t === "ammeter" ? "A" : "V", { size: 24, weight: 700 });
  return g;
}
const wire = (pts: [number, number][]) => `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="6" fill="${C.ink}"/>`;
{
  const a1 = D.SERIES.a1;
  let s = wire([[80, 60], [520, 60], [520, 250], [80, 250], [80, 60]]);
  s += sym("switch-closed", 190, 60) + sym("lamp", 340, 60) + sym("ammeter", 520, 155, true) + sym("lamp", 320, 250) + sym("ammeter", 170, 250) + sym("cell", 80, 155, true);
  s += T(190, 26, "switch", { size: 16, fill: C.soft }) + T(340, 26, "lamp 1", { size: 16, fill: C.soft }) + T(320, 292, "lamp 2", { size: 16, fill: C.soft });
  s += T(556, 155, `A1 reads ${a1.toFixed(2)} A`, { size: 20, anchor: "start", weight: 700 }) + T(170, 292, "A2 reads ?", { size: 20, weight: 700 });
  images["pelec8-series"] = svg(800, 320, s);
}
{
  const p = D.PARALLEL;
  let s = wire([[80, 60], [470, 60]]) + wire([[80, 260], [470, 260]]) + wire([[80, 60], [80, 260]]) + wire([[310, 60], [310, 260]]) + wire([[470, 60], [470, 260]]);
  s += sym("cell", 80, 160, true) + sym("ammeter", 190, 60) + sym("lamp", 310, 115, true) + sym("ammeter", 310, 210, true) + sym("lamp", 470, 115, true) + sym("ammeter", 470, 210, true);
  s += dot(310, 60) + dot(310, 260);
  s += T(190, 26, `A1 reads ${p.a1.toFixed(2)} A`, { size: 19, weight: 700 }) + T(268, 210, `A2 reads ${p.a2.toFixed(2)} A`, { size: 19, anchor: "end", weight: 700 }) + T(512, 210, "A3 reads ?", { size: 19, anchor: "start", weight: 700 });
  s += T(360, 115, "lamp 1", { size: 16, anchor: "start", fill: C.soft }) + T(520, 115, "lamp 2", { size: 16, anchor: "start", fill: C.soft });
  images["pelec8-parallel"] = svg(800, 300, s);
}
{
  let s = `<rect x="0" y="0" width="1" height="1" fill="none"/>`;
  Object.entries(D.SYMBOLS).forEach(([k, name], i) => {
    const ox = 20 + (i % 3) * 235, oy = 20 + Math.floor(i / 3) * 150;
    s += `<rect x="${ox}" y="${oy}" width="215" height="130" rx="10" fill="#fff" stroke="${C.ink}" stroke-width="3"/><circle cx="${ox + 28}" cy="${oy + 28}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>` + T(ox + 28, oy + 29, k, { size: 20, weight: 700 });
    const t: Sym = name === "cell" ? "cell" : name === "lamp" ? "lamp" : name === "switch" ? "switch-open" : name === "ammeter" ? "ammeter" : name === "voltmeter" ? "voltmeter" : "resistor";
    s += sym(t, ox + 107, oy + 82, false, "#fff");
  });
  images["pelec8-symbols"] = svg(720, 320, s);
}
{
  const v = D.VIR;
  let s = wire([[100, 60], [500, 60], [500, 260], [100, 260], [100, 60]]) + wire([[500, 100], [620, 100], [620, 220], [500, 220]]);
  s += sym("battery", 100, 160, true) + sym("ammeter", 300, 60) + sym("resistor", 500, 160, true) + sym("voltmeter", 620, 160, true) + dot(500, 100) + dot(500, 220);
  s += T(300, 26, `${v.I.toFixed(2)} A`, { size: 22, weight: 700 }) + T(660, 160, `${v.V.toFixed(1)} V`, { size: 22, weight: 700, anchor: "start" }) + T(548, 160, "R", { size: 24, weight: 700 }) + T(300, 292, "The reading on the voltmeter is the potential difference across R", { size: 15, fill: C.soft });
  images["pelec9-vir"] = svg(800, 320, s);
}
{
  const se = D.SEASONS, tilt = se.tilt;
  let s = `<ellipse cx="${se.sun[0]}" cy="${se.sun[1]}" rx="270" ry="170" fill="none" stroke="${C.soft}" stroke-width="2.5" stroke-dasharray="8 8"/>`;
  s += `<circle cx="${se.sun[0]}" cy="${se.sun[1]}" r="46" fill="#ffd54a" stroke="#e0a010" stroke-width="4"/>` + T(se.sun[0], se.sun[1], "Sun", { size: 20, weight: 700 });
  for (const [k, [x, y]] of Object.entries(se.positions)) {
    const ax = Math.sin(rad(tilt)), ay = -Math.cos(rad(tilt)); // axis direction (towards the North Pole), up-and-lean-right
    s += L(x - ax * 62, y - ay * 62, x + ax * 62, y + ay * 62, { w: 3, c: C.soft, dash: "6 5" });
    s += `<circle cx="${x}" cy="${y}" r="30" fill="${C.blueL}" stroke="${C.blue}" stroke-width="4"/>` + `<ellipse cx="${x}" cy="${y}" rx="30" ry="8" fill="none" stroke="${C.blue}" stroke-width="2" transform="rotate(${tilt} ${x} ${y})" opacity=".6"/>` + T(x + ax * 74, y + ay * 74, "N", { size: 18, weight: 700, fill: C.red });
    const lx = x + (x < se.sun[0] ? -58 : x > se.sun[0] ? 58 : -62), ly = y;
    s += `<circle cx="${lx}" cy="${ly + (x === se.sun[0] ? 0 : 0)}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>` + T(lx, ly + 1, k, { size: 20, weight: 700 });
  }
  s += T(400, 522, "Earth's axis always points the same way in space. N = North Pole. Not to scale.", { size: 16, fill: C.soft });
  images["pspace9-seasons"] = svg(800, 540, s);
}

// ── render ───────────────────────────────────────────────────────────────────
const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 1.5 })).newPage();
for (const [key, markup] of Object.entries(images)) {
  if (only.length && !only.some((o) => key.includes(o))) continue;
  const [w, h] = markup.match(/width="(\d+)" height="(\d+)"/)!.slice(1).map(Number);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#fff">${markup}</body></html>`);
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
  let png = await sharp(shot).png({ palette: true, colours: 96, quality: 95, effort: 10, dither: 0.5 }).toBuffer();
  if (png.length > 190_000) png = await sharp(shot).png({ palette: true, colours: 48, effort: 10 }).toBuffer();
  writeFileSync(path.join(OUT, `${key}.png`), png);
  console.log(key.padEnd(24), `${w}x${h}`, `${(png.length / 1024).toFixed(1)} KB`);
}
await browser.close();
