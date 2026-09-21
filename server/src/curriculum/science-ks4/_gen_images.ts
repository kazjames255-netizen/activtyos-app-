// science-ks4 diagrams: every picture is DRAWN FROM the data in _imgdata.ts (the same data _check_s4.ts uses to re-compute keys).
//   cd server && npx tsx src/curriculum/science-ks4/_gen_images.ts [substring-filter]
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as D from "./_imgdata";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../../scratch/curriculum-images/science-ks4");
mkdirSync(OUT, { recursive: true });

const C = { ink: "#1f2a44", soft: "#5b6785", grid: "#dfe5ef", gridD: "#c3cddf", blue: "#2f78c4", blueL: "#cfe3f7", orange: "#e8801a", orangeL: "#fde0bd", green: "#2f9a62", greenL: "#d3eddc", red: "#cf3d3d", purple: "#7c4fb8", yellow: "#f2c230", teal: "#1f9aa8", grey: "#eef1f6" };
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const f = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
interface TO { size?: number; weight?: number; fill?: string; anchor?: string; rot?: number; halo?: boolean }
const t = (x: number, y: number, s: string | number, o: TO = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${o.size ?? 18}" font-weight="${o.weight ?? 500}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "middle"}" dominant-baseline="central"${o.halo ? ` stroke="#fff" stroke-width="4" paint-order="stroke"` : ""}${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(y)})"` : ""}>${esc(s)}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = C.ink, w = 3, extra = "") => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`;
const rect = (x: number, y: number, w: number, h: number, fill = "none", stroke = C.ink, sw = 3, rx = 0) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle = (x: number, y: number, r: number, fill = "none", stroke = C.ink, sw = 3) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const poly = (pts: [number, number][], stroke = C.blue, w = 4, fill = "none") => `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const smooth = (pts: [number, number][], stroke = C.blue, w = 4) => {
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const arrow = (x1: number, y1: number, x2: number, y2: number, col = C.ink, w = 3, head = 12) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = (d: number) => [x2 - head * Math.cos(a - d), y2 - head * Math.sin(a - d)];
  const [ax, ay] = hx(0.45), [bx, by] = hx(-0.45);
  return line(x1, y1, x2 - (head * 0.6) * Math.cos(a), y2 - (head * 0.6) * Math.sin(a), col, w) + `<polygon points="${f(x2)},${f(y2)} ${f(ax)},${f(ay)} ${f(bx)},${f(by)}" fill="${col}"/>`;
};
const num = (n: number) => (n < 0 ? "−" : "") + Math.abs(Math.round(n * 1000) / 1000);

// ── generic line-graph frame ────────────────────────────────────────────────
interface G { w: number; h: number; x0: number; x1: number; y0: number; y1: number; xs: number; ys: number; xl: string; yl: string; ml?: number; mt?: number; mr?: number; mb?: number; ysMinor?: number; xsMinor?: number; ylabEvery?: number; xlabEvery?: number }
function frame(g: G) {
  const ml = g.ml ?? 80, mt = g.mt ?? 30, mr = g.mr ?? 30, mb = g.mb ?? 70;
  const X = (x: number) => ml + ((x - g.x0) / (g.x1 - g.x0)) * (g.w - ml - mr);
  const Y = (y: number) => g.h - mb - ((y - g.y0) / (g.y1 - g.y0)) * (g.h - mt - mb);
  let s = "";
  const ym = g.ysMinor ?? g.ys, xm = g.xsMinor ?? g.xs;
  for (let v = g.y0; v <= g.y1 + 1e-9; v += ym) s += line(ml, Y(v), g.w - mr, Y(v), Math.abs(v % g.ys) < 1e-9 ? C.gridD : C.grid, Math.abs(v % g.ys) < 1e-9 ? 1.6 : 1);
  for (let v = g.x0; v <= g.x1 + 1e-9; v += xm) s += line(X(v), Y(g.y0), X(v), Y(g.y1), Math.abs((v - g.x0) % g.xs) < 1e-9 ? C.gridD : C.grid, Math.abs((v - g.x0) % g.xs) < 1e-9 ? 1.6 : 1);
  s += line(ml, Y(g.y0), g.w - mr, Y(g.y0), C.ink, 3) + line(ml, Y(g.y0), ml, Y(g.y1), C.ink, 3);
  if (g.y0 < 0 && g.y1 > 0) s += line(ml, Y(0), g.w - mr, Y(0), C.ink, 3);
  for (let v = g.y0, i = 0; v <= g.y1 + 1e-9; v += g.ys, i++) if (i % (g.ylabEvery ?? 1) === 0) s += t(ml - 12, Y(v), num(v), { size: 16, anchor: "end", fill: C.soft });
  for (let v = g.x0, i = 0; v <= g.x1 + 1e-9; v += g.xs, i++) if (i % (g.xlabEvery ?? 1) === 0) s += t(X(v), g.h - mb + 22, num(v), { size: 16, fill: C.soft });
  s += t((ml + g.w - mr) / 2, g.h - 18, g.xl, { size: 18, weight: 600 });
  s += t(20, (mt + g.h - mb) / 2, g.yl, { size: 18, weight: 600, rot: -90 });
  return { X, Y, s };
}
const dot = (x: number, y: number, col: string, r = 5.5) => circle(x, y, r, col, "#fff", 2);

const images: Record<string, string> = {};

// 1 ── osmosis
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 1.0, y0: -20, y1: 20, xs: 0.2, ys: 10, ysMinor: 5, xl: "Sucrose concentration (mol/dm³)", yl: "Change in mass (%)", mb: 75 });
  const pts = D.OSMOSIS.conc.map((c, i) => [g.X(c), g.Y(D.OSMOSIS.pct[i])] as [number, number]);
  images["b4cell-osmosis"] = svg(760, 470, g.s + poly(pts, C.blue, 4) + pts.map((p) => dot(p[0], p[1], C.blue)).join(""));
}
// 2 ── enzyme rate vs temperature
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 70, y0: 0, y1: 20, xs: 10, ys: 5, ysMinor: 1, xsMinor: 5, xl: "Temperature (°C)", yl: "Rate (mg starch broken down per min)", mb: 75 });
  const pts = D.ENZYME.temp.map((x, i) => [g.X(x), g.Y(D.ENZYME.rate[i])] as [number, number]);
  images["b4org-enzyme"] = svg(760, 470, g.s + smooth(pts, C.orange, 4) + pts.map((p) => dot(p[0], p[1], C.orange)).join(""));
}
// 3 ── agar plate
{
  const S = 8; // px per mm
  let s = circle(330, 270, 250, "#f7efd8", C.ink, 5) + circle(330, 270, 236, "#faf3e0", "#d9c9a0", 2);
  const discs: [string, number, number, number][] = [["A", 200, 200, D.ZONES.A], ["B", 470, 200, D.ZONES.B], ["C", 330, 390, D.ZONES.C]];
  // lawn of bacteria = mottled cream; clear zone = the agar colour showing through
  s += `<circle cx="330" cy="270" r="230" fill="#e2c98a" opacity="0.6"/>`;
  for (const [, x, y, d] of discs) if (d) s += circle(x, y, (d / 2) * S, "#faf3e0", "#b39b5c", 2);
  for (const [n, x, y, d] of discs) {
    s += circle(x, y, 3 * S, "#ffffff", C.ink, 3) + t(x, y, n, { size: 22, weight: 700 });
    if (d) { s += line(x - (d / 2) * S, y + (d / 2) * S + 22, x + (d / 2) * S, y + (d / 2) * S + 22, C.red, 3) + t(x, y + (d / 2) * S + 44, `${d} mm`, { size: 20, weight: 700, fill: C.red, halo: true }); }
    else s += t(x, y + 3 * S + 24, "no clear zone", { size: 18, fill: C.soft, halo: true });
  }
  images["b4inf-zones"] = svg(660, 545, s + t(330, 528, "Agar plate seen from above (lawn of bacteria)", { size: 16, fill: C.soft }));
}
// 4 ── photosynthesis
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 6, y0: 0, y1: 25, xs: 1, ys: 5, ysMinor: 1, xl: "Light intensity (arbitrary units)", yl: "Rate (bubbles per minute)", mb: 75 });
  const pts = D.PHOTO.light.map((x, i) => [g.X(x), g.Y(D.PHOTO.rate[i])] as [number, number]);
  images["b4bio-photosynthesis"] = svg(760, 470, g.s + poly(pts, C.green, 4) + pts.map((p) => dot(p[0], p[1], C.green)).join(""));
}
// 5 ── blood glucose
{
  const g = frame({ w: 900, h: 480, x0: 0, x1: 180, y0: 0, y1: 20, xs: 30, ys: 5, ysMinor: 1, xl: "Time after eating (minutes)", yl: "Blood glucose (mmol/dm³)", mb: 75, mr: 160 });
  const P = (arr: number[]) => D.GLUC.time.map((x, i) => [g.X(x), g.Y(arr[i])] as [number, number]);
  const a = P(D.GLUC.A), b = P(D.GLUC.B);
  const legend = line(750, 160, 790, 160, C.blue, 5) + t(800, 160, "Person A", { size: 18, anchor: "start" }) + line(750, 200, 790, 200, C.orange, 5) + t(800, 200, "Person B", { size: 18, anchor: "start" });
  images["b4home-glucose"] = svg(900, 480, g.s + poly(a, C.blue, 4) + poly(b, C.orange, 4) + a.map((p) => dot(p[0], p[1], C.blue)).join("") + b.map((p) => dot(p[0], p[1], C.orange)).join("") + legend + t(g.X(0) + 4, g.Y(0) - 14, "meal at 0", { size: 15, fill: C.soft, anchor: "start" }));
}
// 6 ── Punnett square (gametes only)
{
  const cs = 130, x0 = 230, y0 = 130;
  let s = t(320, 40, "Parents: Cc × Cc", { size: 24, weight: 700 }) + t(x0 + cs, 78, "Gametes from parent 1", { size: 16, fill: C.soft });
  [D.PUNNETT.p1, D.PUNNETT.p2].forEach((_, i) => { void i; });
  D.PUNNETT.p1.forEach((g, i) => (s += t(x0 + cs * i + cs / 2, y0 - 22, g, { size: 34, weight: 700, fill: C.blue })));
  D.PUNNETT.p2.forEach((g, j) => (s += t(x0 - 30, y0 + cs * j + cs / 2, g, { size: 34, weight: 700, fill: C.orange })));
  s += t(70, y0 + cs, "Gametes from", { size: 15, fill: C.soft }) + t(70, y0 + cs + 20, "parent 2", { size: 15, fill: C.soft });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s += rect(x0 + cs * i, y0 + cs * j, cs, cs, "#fbfcfe", C.ink, 3) + t(x0 + cs * i + cs / 2, y0 + cs * j + cs / 2, "?", { size: 40, fill: C.gridD, weight: 700 });
  images["b4inh-punnett"] = svg(640, 440, s);
}
// 7 ── pedigree
{
  const X = (x: number) => 90 + x * 170, Yg = (g: number) => 80 + (g - 1) * 170, sz = 34;
  const by = Object.fromEntries(D.PEDIGREE.map((p) => [p.id, p]));
  let s = "";
  const [p1, p2] = [by["I-1"], by["I-2"]];
  s += line(X(p1.x) + sz, Yg(1), X(p2.x) - sz, Yg(1), C.ink, 3);
  const mid = (X(p1.x) + X(p2.x)) / 2, sibY = Yg(2) - 85;
  s += line(mid, Yg(1), mid, sibY, C.ink, 3);
  const kids = D.PEDIGREE.filter((p) => p.gen === 2);
  s += line(X(kids[0].x), sibY, X(kids[kids.length - 1].x), sibY, C.ink, 3);
  for (const k of kids) s += line(X(k.x), sibY, X(k.x), Yg(2) - sz, C.ink, 3);
  for (const p of D.PEDIGREE) {
    const fill = p.aff ? C.ink : "#fff", cx = X(p.x), cy = Yg(p.gen);
    s += p.sex === "M" ? rect(cx - sz, cy - sz, sz * 2, sz * 2, fill, C.ink, 3.5) : circle(cx, cy, sz, fill, C.ink, 3.5);
    s += t(cx, cy + sz + 22, p.id, { size: 16, fill: C.soft });
  }
  s += t(45, Yg(1), "I", { size: 24, weight: 700 }) + t(45, Yg(2), "II", { size: 24, weight: 700 });
  s += rect(590, 30, 26, 26, "#fff") + t(626, 43, "unaffected male", { size: 15, anchor: "start" }) + rect(590, 66, 26, 26, C.ink) + t(626, 79, "affected male", { size: 15, anchor: "start" });
  s += circle(603, 118, 13, "#fff") + t(626, 118, "unaffected female", { size: 15, anchor: "start" }) + circle(603, 154, 13, C.ink) + t(626, 154, "affected female", { size: 15, anchor: "start" });
  images["b4inh-pedigree"] = svg(790, 360, s);
}
// 8 ── food web
{
  const pos: Record<string, [number, number, string]> = { Grass: [400, 440, C.greenL], Rabbit: [130, 310, C.orangeL], Mouse: [400, 310, C.orangeL], Grasshopper: [680, 310, C.orangeL], Fox: [170, 175, C.blueL], Frog: [660, 175, C.blueL], Owl: [410, 55, "#e3d6f4"] };
  const rx = 78, ry = 27;
  let s = "";
  const edge = (a: string, b: string) => {
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const bd = (x: number, y: number, k: number) => { const r = 1 / Math.sqrt((Math.cos(ang) / rx) ** 2 + (Math.sin(ang) / ry) ** 2); return [x + k * (r + 4) * Math.cos(ang), y + k * (r + 4) * Math.sin(ang)]; };
    const [sx, sy] = bd(x1, y1, 1), [ex, ey] = bd(x2, y2, -1);
    return arrow(sx, sy, ex, ey, C.soft, 3.2, 14);
  };
  for (const [a, b] of D.WEB) s += edge(a, b);
  for (const [n, [x, y, fl]] of Object.entries(pos)) s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fl}" stroke="${C.ink}" stroke-width="3"/>` + t(x, y, n, { size: 21, weight: 700 });
  images["b4eco-foodweb"] = svg(800, 490, s + t(400, 478, "Arrows point from the food to the animal that eats it", { size: 16, fill: C.soft }));
}
// 9 ── electron shells
{
  const cx = 320, cy = 300, radii = [70, 125, 180];
  let s = "";
  radii.forEach((r) => (s += circle(cx, cy, r, "none", C.gridD, 3)));
  s += circle(cx, cy, 34, C.orangeL, C.orange, 4) + t(cx, cy - 8, "17", { size: 20, weight: 700 }) + t(cx, cy + 12, "protons", { size: 13, fill: C.soft });
  D.SHELLS.shells.forEach((n, k) => { for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n + k * 0.5 - Math.PI / 2; s += circle(cx + radii[k] * Math.cos(a), cy + radii[k] * Math.sin(a), 9, C.blue, "#fff", 2.5); } });
  images["c4atom-shells"] = svg(640, 600, s + t(320, 30, "An atom of an unknown element", { size: 20, weight: 700 }));
}
// 10 ── alloy vs pure metal
{
  const panel = (ox: number, big: [number, number][], title: string) => {
    let s = rect(ox, 60, 350, 300, "#fbfcfe", C.gridD, 2) + t(ox + 175, 30, title, { size: 22, weight: 700 });
    for (let r = 0; r < D.ALLOY.rows - 1; r++) for (let c = 0; c < D.ALLOY.cols; c++) {
      const isBig = big.some(([br, bc]) => br === r && bc === c);
      const cx = ox + 38 + c * 52 + (r % 2 ? 26 : 0), cy = 110 + r * 90 + (isBig ? 0 : 0);
      s += circle(cx, cy, isBig ? 30 : 22, isBig ? C.orange : C.blue, "#fff", 2.5);
    }
    return s;
  };
  images["c4bond-alloy"] = svg(760, 400, panel(10, [], "Structure 1") + panel(390, [[0, 2], [1, 3], [2, 1], [1, 1]], "Structure 2"));
}
// 11 ── titration apparatus
{
  let s = "";
  // burette
  s += rect(150, 40, 34, 250, "#f4f8fd", C.ink, 3) + line(150, 290, 150, 310) + line(184, 290, 184, 310);
  for (let i = 0; i < 10; i++) s += line(150, 70 + i * 22, 168 - (i % 2 ? 6 : 0), 70 + i * 22, C.soft, 2);
  s += rect(140, 305, 54, 14, C.grey, C.ink, 3, 4) + line(167, 319, 167, 350, C.ink, 4);
  s += rect(126, 130, 22, 8, C.soft, C.soft, 1) + line(60, 134, 126, 134, C.soft, 6) + rect(50, 40, 12, 380, C.grey, C.soft, 2);
  // flask
  s += `<path d="M135,380 L135,420 L60,510 Q52,525 68,525 L262,525 Q278,525 270,510 L195,420 L195,380 Z" fill="#fbfcfe" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
  s += `<path d="M98,478 L232,478 L262,516 Q266,522 258,522 L72,522 Q64,522 68,516 Z" fill="#f8d2e0" opacity=".9"/>`;
  s += rect(30, 527, 270, 22, C.grey, C.ink, 3, 4);
  // pipette
  s += rect(430, 40, 16, 300, "#f4f8fd", C.ink, 3) + `<ellipse cx="438" cy="255" rx="30" ry="60" fill="#f4f8fd" stroke="${C.ink}" stroke-width="3.5"/>` + line(438, 315, 438, 395, C.ink, 4) + line(420, 150, 456, 150, C.soft, 3) + line(420, 40, 456, 40, C.ink, 5);
  const badge = (x: number, y: number, L: string) => circle(x, y, 20, "#fff", C.blue, 3.5) + t(x, y, L, { size: 22, weight: 700, fill: C.blue });
  s += line(206, 190, 300, 190, C.blue, 2.5) + badge(325, 190, "A") + line(268, 470, 330, 470, C.blue, 2.5) + badge(355, 470, "B") + line(470, 255, 530, 255, C.blue, 2.5) + badge(555, 255, "C") + line(250, 538, 330, 538, C.blue, 2.5) + badge(355, 538, "D");
  images["c4quant-titration"] = svg(620, 580, s);
}
// 12 ── reaction profile
{
  const Y = (v: number) => 470 - v * 0.62, x0 = 100;
  let s = "";
  for (let v = 0; v <= 700; v += 100) s += line(x0, Y(v), 700, Y(v), C.grid, 1.2) + t(x0 - 12, Y(v), v, { size: 16, anchor: "end", fill: C.soft });
  s += line(x0, Y(0), 700, Y(0), C.ink, 3) + line(x0, Y(0), x0, Y(700) - 10, C.ink, 3);
  s += t(20, 250, "Energy (kJ/mol)", { size: 18, weight: 600, rot: -90 }) + t(400, 520, "Progress of reaction", { size: 18, weight: 600 });
  const R = D.PROFILE;
  s += `<path d="M${x0 + 10},${Y(R.reactants)} L250,${Y(R.reactants)} C320,${Y(R.reactants)} 350,${Y(R.peak)} 410,${Y(R.peak)} C470,${Y(R.peak)} 500,${Y(R.products)} 570,${Y(R.products)} L680,${Y(R.products)}" fill="none" stroke="${C.blue}" stroke-width="5" stroke-linecap="round"/>`;
  s += t(170, Y(R.reactants) - 20, "Reactants", { size: 20, weight: 700 }) + t(625, Y(R.products) + 24, "Products", { size: 20, weight: 700 });
  s += line(x0, Y(R.reactants), 250, Y(R.reactants), C.soft, 1.6, `stroke-dasharray="6 6"`) + line(x0, Y(R.products), 570, Y(R.products), C.soft, 1.6, `stroke-dasharray="6 6"`) + line(x0, Y(R.peak), 410, Y(R.peak), C.soft, 1.6, `stroke-dasharray="6 6"`);
  images["c4chem-profile"] = svg(740, 545, s);
}
// 13 ── electrolysis
{
  let s = "";
  s += `<path d="M190,240 L190,330 Q190,395 255,395 L465,395 Q530,395 530,330 L530,240 Z" fill="#fff4dc" stroke="${C.ink}" stroke-width="4"/>`;
  s += rect(270, 110, 24, 240, C.grey, C.ink, 3.5) + rect(430, 110, 24, 240, C.grey, C.ink, 3.5);
  s += t(360, 300, "molten lead", { size: 17, fill: C.soft }) + t(360, 322, "bromide", { size: 17, fill: C.soft });
  // battery: long thin line = positive
  s += line(340, 40, 340, 80, C.ink, 4) + line(378, 28, 378, 92, C.ink, 2.5);
  s += line(340, 60, 282, 60) + line(282, 60, 282, 110) + line(378, 60, 442, 60) + line(442, 60, 442, 110);
  s += t(322, 42, "−", { size: 28, weight: 700, fill: C.red }) + t(398, 42, "+", { size: 28, weight: 700, fill: C.blue });
  s += t(360, 150, "power supply", { size: 15, fill: C.soft });
  s += line(255, 190, 270, 190, C.blue, 2.5) + circle(232, 190, 22, "#fff", C.blue, 3.5) + t(232, 190, "X", { size: 24, weight: 700, fill: C.blue }) + line(454, 190, 470, 190, C.blue, 2.5) + circle(494, 190, 22, "#fff", C.blue, 3.5) + t(494, 190, "Y", { size: 24, weight: 700, fill: C.blue });
  images["c4chem-electrolysis"] = svg(720, 420, s);
}
// 14 ── rate graph
{
  const g = frame({ w: 920, h: 480, x0: 0, x1: 120, y0: 0, y1: 70, xs: 20, ys: 10, ysMinor: 5, xl: "Time (s)", yl: "Volume of hydrogen (cm³)", mb: 75, mr: 190 });
  const P = (arr: number[]) => D.RATE.t.map((x, i) => [g.X(x), g.Y(arr[i])] as [number, number]);
  const a = P(D.RATE.v1), b = P(D.RATE.v2);
  const legend = line(740, 150, 780, 150, C.blue, 5) + t(790, 150, "Experiment 1", { size: 18, anchor: "start" }) + line(740, 195, 780, 195, C.orange, 5) + t(790, 195, "Experiment 2", { size: 18, anchor: "start" });
  images["c4rate-graph"] = svg(920, 480, g.s + smooth(a, C.blue, 4) + smooth(b, C.orange, 4) + a.map((p) => dot(p[0], p[1], C.blue)).join("") + b.map((p) => dot(p[0], p[1], C.orange)).join("") + legend);
}
// 15 ── fractionating column
{
  let s = rect(290, 30, 150, 400, "#f4f8fd", C.ink, 4, 8);
  const heights = [80, 160, 240, 320, 395];
  for (let i = 0; i < 4; i++) s += line(290, 120 + i * 80, 440, 120 + i * 80, C.soft, 2.5, `stroke-dasharray="10 6"`);
  ["A", "B", "C", "D", "E"].forEach((L, i) => {
    const y = heights[i];
    s += line(440, y, 560, y, C.ink, 4) + circle(590, y, 20, "#fff", C.blue, 3.5) + t(590, y, L, { size: 22, weight: 700, fill: C.blue });
  });
  s += rect(60, 340, 130, 100, C.orangeL, C.orange, 3.5, 8) + t(125, 380, "Furnace", { size: 18, weight: 700 }) + t(125, 404, "heated crude", { size: 14, fill: C.soft }) + t(125, 421, "oil vapour", { size: 14, fill: C.soft });
  s += arrow(190, 385, 288, 385, C.orange, 5, 16);
  images["c4org-column"] = svg(660, 470, s);
}
// 16 ── chromatogram
{
  const Y = (cm: number) => 480 - cm * 40;
  let s = rect(160, 50, 350, 450, "#fffdf6", C.ink, 3);
  for (let cm = 0; cm <= 10; cm++) s += line(126, Y(cm), 146, Y(cm), C.ink, 3) + t(108, Y(cm), cm, { size: 16, anchor: "end", fill: C.soft });
  s += line(146, Y(0), 146, Y(10), C.ink, 3) + t(70, 265, "Distance from baseline (cm)", { size: 15, weight: 600, rot: -90, fill: C.soft });
  s += line(160, Y(0), 510, Y(0), C.soft, 2, `stroke-dasharray="8 6"`) + t(335, Y(0) - 14, "baseline (pencil line)", { size: 13, fill: C.soft });
  s += line(160, Y(D.CHROM.front), 510, Y(D.CHROM.front), C.red, 2.5, `stroke-dasharray="8 6"`) + t(335, Y(D.CHROM.front) - 14, "solvent front", { size: 14, fill: C.red });
  const cols: [string, number][] = [["A", 215], ["B", 290], ["C", 365], ["S", 450]];
  cols.forEach(([L, x]) => (s += t(x, Y(0) + 42, L, { size: 22, weight: 700 })));
  s += t(450, Y(0) + 68, "(sample)", { size: 13, fill: C.soft });
  for (const [L, x] of cols) {
    const ds = L === "S" ? D.CHROM.sample : [D.CHROM.spots[L]];
    for (const d of ds) s += `<ellipse cx="${x}" cy="${Y(d)}" rx="15" ry="11" fill="#7a6a58" opacity=".85"/>`;
    s += `<ellipse cx="${x}" cy="${Y(0) + 0}" rx="0" ry="0"/>`;
  }
  images["c4anal-chromatogram"] = svg(560, 580, s);
}
// 17 ── CO2 graph
{
  const g = frame({ w: 760, h: 470, x0: 1950, x1: 2030, y0: 280, y1: 440, xs: 20, ys: 20, ysMinor: 10, xsMinor: 10, xl: "Year", yl: "CO₂ concentration (ppm, approximate)", mb: 75, ml: 90 });
  const pts = D.CO2.year.map((x, i) => [g.X(x), g.Y(D.CO2.ppm[i])] as [number, number]);
  images["c4atmo-co2"] = svg(760, 470, g.s + poly(pts, C.red, 4) + pts.map((p) => dot(p[0], p[1], C.red, 6.5)).join("") + pts.map((p, i) => t(p[0], p[1] - 22, D.CO2.ppm[i], { size: 16, weight: 700, fill: C.red })).join(""));
}
// 18 ── Sankey
{
  const k = 0.6, I = D.SANKEY.input * k, Th = D.SANKEY.thermal * k, So = D.SANKEY.sound * k, U = I - Th - So;
  const top = 150;
  const band = (y0a: number, y0b: number, y1a: number, y1b: number, fill: string) => `<path d="M230,${y0a} C420,${y0a} 430,${y1a} 610,${y1a} L610,${y1b} C430,${y1b} 420,${y0b} 230,${y0b} Z" fill="${fill}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>`;
  let s = "";
  s = rect(40, top, 190, I, C.blueL, C.ink, 2) + band(top, top + So, 62, 62 + So, C.yellow) + band(top + So, top + So + U, top + So - 4, top + So - 4 + U, C.greenL) + band(top + So + U, top + I, top + I + 55, top + I + 55 + Th, C.orangeL);
  s += t(135, top + I / 2 - 8, "Input", { size: 20, weight: 700 }) + t(135, top + I / 2 + 16, `${D.SANKEY.input} J`, { size: 22, weight: 700 });
  s += t(620, 62 + So / 2, `Sound ${D.SANKEY.sound} J`, { size: 18, anchor: "start" });
  s += t(620, top + So - 4 + U / 2 - 10, "Useful kinetic", { size: 18, anchor: "start" }) + t(620, top + So - 4 + U / 2 + 12, "energy = ?", { size: 18, anchor: "start", weight: 700 });
  s += t(620, top + I + 55 + Th / 2, `Heat ${D.SANKEY.thermal} J`, { size: 18, anchor: "start" });
  images["p4energy-sankey"] = svg(790, 440, s + t(395, 28, "Energy transfers in a motor (band width shows the amount of energy)", { size: 17, fill: C.soft }));
}
// 19/20 ── circuits
const cell = (x: number, y: number, label: string) => line(x - 22, y - 10, x + 22, y - 10, C.ink, 4) + line(x - 11, y + 10, x + 11, y + 10, C.ink, 7) + t(x + 54, y, label, { size: 20, weight: 700, anchor: "start" });
const resistorH = (x: number, y: number, label: string) => rect(x - 42, y - 18, 84, 36, "#fff", C.ink, 3.5) + t(x, y - 36, label, { size: 19, weight: 700 });
const resistorV = (x: number, y: number, label: string, side = 1) => rect(x - 18, y - 42, 36, 84, "#fff", C.ink, 3.5) + t(x + side * 62, y, label, { size: 19, weight: 700, anchor: side > 0 ? "start" : "end" });
const meter = (x: number, y: number, L: string) => circle(x, y, 24, "#fff", C.ink, 3.5) + t(x, y, L, { size: 24, weight: 700 });
{
  const s0 = D.CIRC_SERIES;
  let s = "";
  s += line(110, 330, 110, 236) + line(110, 204, 110, 100) + line(110, 100, 215, 100) + line(239, 100, 360, 100) + line(360, 100, 520, 100) + line(520, 100, 560, 100) + line(560, 100, 560, 158) + line(560, 242, 560, 330) + line(560, 330, 110, 330);
  s += cell(110, 220, `${s0.V} V`) + meter(227, 100, "A") + resistorH(440, 100, `R₁ = ${s0.R1} Ω`) + resistorV(560, 200, `R₂ = ${s0.R2} Ω`, -1);
  s += line(560, 130, 640, 130) + line(640, 130, 640, 176) + line(640, 224, 640, 270) + line(640, 270, 560, 270) + meter(640, 200, "V");
  images["p4elec-series"] = svg(800, 400, s);
}
{
  const s0 = D.CIRC_PARALLEL;
  let s = "";
  s += line(110, 330, 110, 236) + line(110, 204, 110, 100) + line(110, 100, 640, 100) + line(640, 100, 640, 330) + line(640, 330, 110, 330);
  s += line(330, 100, 330, 178) + line(330, 262, 330, 330) + line(490, 100, 490, 178) + line(490, 262, 490, 330);
  s += cell(110, 220, `${s0.V} V`) + resistorV(330, 220, `${s0.R1} Ω`, 1) + resistorV(490, 220, `${s0.R2} Ω`, 1);
  images["p4elec-parallel"] = svg(740, 400, s);
}
// 21 ── I–V
{
  const g = frame({ w: 760, h: 480, x0: 0, x1: 6, y0: 0, y1: 0.8, xs: 1, ys: 0.2, ysMinor: 0.1, xl: "Potential difference (V)", yl: "Current (A)", mb: 75, ml: 90 });
  const A = D.IV.V.map((v, i) => [g.X(v), g.Y(D.IV.resistor[i])] as [number, number]);
  const B = D.IV.V.map((v, i) => [g.X(v), g.Y(D.IV.lamp[i])] as [number, number]);
  images["p4elec-iv"] = svg(760, 480, g.s + poly([A[0], A[6]], C.blue, 4) + smooth(B, C.orange, 4) + t(A[6][0] - 20, A[6][1] + 24, "A", { size: 26, weight: 700, fill: C.blue }) + t(B[6][0] - 12, B[6][1] - 24, "B", { size: 26, weight: 700, fill: C.orange }));
}
// 22 ── heating curve
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 30, y0: 0, y1: 200, xs: 5, ys: 20, ysMinor: 10, xsMinor: 1, xlabEvery: 1, ylabEvery: 1, xl: "Time (minutes)", yl: "Temperature (°C)", mb: 75, ml: 90 });
  const pts = D.HEAT.pts.map((p) => [g.X(p[0]), g.Y(p[1])] as [number, number]);
  images["p4part-heating"] = svg(760, 470, g.s + poly(pts, C.red, 4.5) + pts.map((p) => dot(p[0], p[1], C.red)).join(""));
}
// 23 ── decay curve
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 24, y0: 0, y1: 800, xs: 6, ys: 100, ysMinor: 50, xsMinor: 3, ylabEvery: 2, xl: "Time (hours)", yl: "Activity (counts per minute)", mb: 75, ml: 90 });
  const pts: [number, number][] = []; for (let x = 0; x <= 24; x += 0.5) pts.push([g.X(x), g.Y(D.DECAY.N0 * 0.5 ** (x / D.DECAY.half))]);
  images["p4atom-decay"] = svg(760, 470, g.s + poly(pts, C.purple, 4.5));
}
// 24 ── v–t
{
  const g = frame({ w: 760, h: 470, x0: 0, x1: 40, y0: 0, y1: 24, xs: 5, ys: 4, ysMinor: 2, xsMinor: 1, xl: "Time (s)", yl: "Velocity (m/s)", mb: 75 });
  const pts = D.VT.pts.map((p) => [g.X(p[0]), g.Y(p[1])] as [number, number]);
  images["p4force-vt"] = svg(760, 470, g.s + poly(pts, C.blue, 4.5) + pts.map((p) => dot(p[0], p[1], C.blue)).join(""));
}
// 25 ── wave
{
  const g = frame({ w: 800, h: 440, x0: 0, x1: 20, y0: -4, y1: 4, xs: 2, ys: 1, xsMinor: 1, xl: "Distance (cm)", yl: "Displacement (cm)", mb: 75 });
  const pts: [number, number][] = []; for (let x = 0; x <= D.WAVE.len + 1e-9; x += 0.2) pts.push([g.X(x), g.Y(D.WAVE.amp * Math.sin((2 * Math.PI * x) / D.WAVE.lambda))]);
  images["p4wave-wave"] = svg(800, 440, g.s + poly(pts, C.teal, 4.5));
}
// 26 ── transformer
{
  const T = D.TRANSFORMER;
  let s = rect(240, 80, 300, 250, "#dfe5ef", C.ink, 3) + rect(300, 140, 180, 130, "#fff", C.ink, 3);
  const coil = (cx: number, n: number, y0: number, y1: number) => { let c = ""; for (let i = 0; i < n; i++) { const y = y0 + (i * (y1 - y0)) / (n - 1); c += `<ellipse cx="${cx}" cy="${y}" rx="58" ry="8" fill="none" stroke="${C.orange}" stroke-width="4"/>`; } return c; };
  s += coil(270, 9, 92, 318) + coil(510, 4, 150, 260);
  s += line(212, 92, 130, 92, C.ink, 3) + line(212, 318, 130, 318, C.ink, 3) + line(130, 92, 130, 130) + line(130, 280, 130, 318) + circle(130, 205, 26, "#fff", C.ink, 3) + t(130, 205, "~", { size: 34, weight: 700 });
  s += t(130, 340, `${T.Vp} V a.c. input`, { size: 17 });
  s += line(568, 160, 660, 160, C.ink, 3) + line(568, 250, 660, 250, C.ink, 3) + line(660, 160, 660, 182) + line(660, 228, 660, 250) + meter(660, 205, "V") + t(660, 290, "Output PD = ?", { size: 18, weight: 700 });
  s += t(270, 50, `Primary coil: ${T.Np} turns`, { size: 19, weight: 700 }) + t(510, 50, `Secondary coil: ${T.Ns} turns`, { size: 19, weight: 700 }) + t(390, 372, "Iron core", { size: 17, fill: C.soft });
  images["p4mag-transformer"] = svg(780, 400, s);
}

// ── render ────────────────────────────────────────────────────────────────
const only = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
for (const [key, markup] of Object.entries(images)) {
  if (only && !key.includes(only)) continue;
  writeFileSync(path.join(OUT, `${key}.svg`), markup);
  const [w, h] = markup.match(/width="(\d+)" height="(\d+)"/)!.slice(1).map(Number);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#fff">${markup}</body></html>`);
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
  let png = await sharp(shot).png({ palette: true, colours: 96, quality: 95, effort: 10, dither: 0.6 }).toBuffer();
  if (png.length > 190_000) png = await sharp(shot).resize(Math.round(w * 1.1)).png({ palette: true, colours: 64, effort: 10 }).toBuffer();
  writeFileSync(path.join(OUT, `${key}.png`), png);
  console.log(key.padEnd(24), `${w}x${h}`, `${(statSync(path.join(OUT, `${key}.png`)).size / 1024).toFixed(1)} KB`);
}
await browser.close();
