// Independent re-computation of EVERY answer key in rp, alg, meas and shape (K3).
// Run: cd server && npx tsx src/curriculum/ks2maths/_check_k3.ts
// Numbers/geometry are recomputed from first principles; picture-based answers are recomputed from the
// SVG source of the picture itself (scratch/curriculum-images/svg-k3/*.svg), so image and key must agree.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOPIC as rp } from "./rp";
import { TOPIC as alg } from "./alg";
import { TOPIC as meas } from "./meas";
import { TOPIC as shape } from "./shape";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SV = path.resolve(HERE, "../../../../scratch/curriculum-images/svg-k3");
const PNG = path.resolve(HERE, "../../../../scratch/curriculum-images/ks2maths");
let bad = 0, checked = 0;
const fail = (m: string) => { bad++; console.error("✗ " + m); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;
const svgOf = (n: string) => readFileSync(path.join(SV, n + ".svg"), "utf8");
type Pt = [number, number];
const num = (s: string) => Number(s);
const polys = (s: string) => [...s.matchAll(/<polygon points="([^"]+)" fill="([^"]+)" stroke="([^"]+)" stroke-width="([\d.]+)"/g)].map((m) => ({ pts: m[1].split(" ").map((p) => p.split(",").map(num) as Pt), fill: m[2], stroke: m[3], w: num(m[4]) }));
const lines = (s: string) => [...s.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="([^"]+)" stroke-width="([\d.]+)"( stroke-dasharray="[^"]+")?/g)].map((m) => ({ a: [num(m[1]), num(m[2])] as Pt, b: [num(m[3]), num(m[4])] as Pt, stroke: m[5], w: num(m[6]), dash: !!m[7] }));
const rects = (s: string) => [...s.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"(?: rx="[\d.]+")? fill="([^"]+)"/g)].map((m) => ({ x: num(m[1]), y: num(m[2]), w: num(m[3]), h: num(m[4]), fill: m[5] }));
const circles = (s: string) => [...s.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)" fill="([^"]+)"/g)].map((m) => ({ cx: num(m[1]), cy: num(m[2]), r: num(m[3]), fill: m[4] }));
const area = (p: Pt[]) => Math.abs(p.reduce((s, q, i) => s + (q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1]), 0)) / 2;
const perim = (p: Pt[]) => p.reduce((s, q, i) => s + Math.hypot(q[0] - p[(i + 1) % p.length][0], q[1] - p[(i + 1) % p.length][1]), 0);
const signed = (p: Pt[]) => p.reduce((s, q, i) => s + (q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1]), 0);
/** interior angle (degrees) at each vertex, handling reflex corners */
function interior(p: Pt[]): number[] {
  const orient = Math.sign(signed(p));
  return p.map((q, i) => {
    const a = p[(i + p.length - 1) % p.length], b = p[(i + 1) % p.length];
    const v1: Pt = [a[0] - q[0], a[1] - q[1]], v2: Pt = [b[0] - q[0], b[1] - q[1]];
    let ang = (Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180) / Math.PI;
    const e1: Pt = [q[0] - a[0], q[1] - a[1]], e2: Pt = [b[0] - q[0], b[1] - q[1]];
    const cross = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.sign(cross) !== orient && Math.abs(cross) > 1e-6) ang = 360 - ang;
    return ang;
  });
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const fmt12 = (mins: number) => { const h24 = Math.floor(mins / 60) % 24, m = mins % 60; return `${h24 % 12 || 12}:${String(m).padStart(2, "0")} ${h24 >= 12 ? "pm" : "am"}`; };
/** hands of a clock picture -> [hour(1-12), minute], and checks the hour hand agrees with the minute hand */
function readClock(name: string): [number, number] {
  const ls = lines(svgOf(name)).filter((l) => l.a[0] === 260 && l.a[1] === 260);
  const hh = ls.find((l) => l.w === 12)!, mh = ls.find((l) => l.w === 7)!;
  const ang = (l: { b: Pt }) => ((Math.atan2(l.b[0] - 260, -(l.b[1] - 260)) * 180) / Math.PI + 360) % 360;
  const minutes = Math.round(ang(mh) / 6) % 60, hourDeg = ang(hh);
  const hour = Math.floor((hourDeg - minutes * 0.5 + 1e-6) / 30 + 0.5) % 12 || 12;
  if (!near(hourDeg, ((hour % 12) * 30 + minutes * 0.5) % 360, 0.6)) fail(`${name}: hour hand (${hourDeg.toFixed(1)}°) inconsistent with minute hand`);
  return [hour, minutes];
}
/** cube-net check: roll a die across the net; valid iff six different faces get touched */
function isCubeNet(cells: Pt[]): boolean {
  const key = (c: number, r: number) => `${c},${r}`;
  const set = new Set(cells.map(([c, r]) => key(c, r)));
  type D = { top: string; bottom: string; n: string; s: string; e: string; w: string };
  const start: D = { top: "T", bottom: "B", n: "N", s: "S", e: "E", w: "W" };
  const roll = (d: D, dir: "e" | "w" | "n" | "s"): D => {
    if (dir === "e") return { top: d.w, bottom: d.e, e: d.top, w: d.bottom, n: d.n, s: d.s };
    if (dir === "w") return { top: d.e, bottom: d.w, w: d.top, e: d.bottom, n: d.n, s: d.s };
    if (dir === "n") return { top: d.s, bottom: d.n, n: d.top, s: d.bottom, e: d.e, w: d.w };
    return { top: d.n, bottom: d.s, s: d.top, n: d.bottom, e: d.e, w: d.w };
  };
  const seen = new Map<string, D>([[key(...cells[0]), start]]);
  const q: Pt[] = [cells[0]];
  while (q.length) {
    const [c, r] = q.shift()!, d = seen.get(key(c, r))!;
    for (const [dc, dr, dir] of [[1, 0, "e"], [-1, 0, "w"], [0, -1, "n"], [0, 1, "s"]] as [number, number, "e" | "w" | "n" | "s"][]) {
      const k = key(c + dc, r + dr);
      if (set.has(k) && !seen.has(k)) { seen.set(k, roll(d, dir)); q.push([c + dc, r + dr]); }
    }
  }
  return seen.size === 6 && new Set([...seen.values()].map((d) => d.bottom)).size === 6;
}
const NETS: Record<string, Pt[]> = {
  A: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]],
  B: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
  C: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [2, 0]],
  D: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
};
const classifyAngle = (d: number) => (d < 90 ? "Acute" : d === 90 ? "Right" : d < 180 ? "Obtuse" : d === 180 ? "Straight" : "Reflex");
const BITS: Record<string, string[]> = {
  F: ["#####", "#....", "####.", "#....", "#....", "#....", "#...."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
};
const hasSymmetry = (rows: string[]) => rows.every((r) => r === [...r].reverse().join("")) || rows.join("|") === [...rows].reverse().join("|");
const regularPts = (n: number): Pt[] => Array.from({ length: n }, (_, i) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)] as Pt);
const hasParallel = (p: Pt[]) => {
  const dirs = p.map((q, i) => { const b = p[(i + 1) % p.length]; return [b[0] - q[0], b[1] - q[1]]; });
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) if (Math.abs(dirs[i][0] * dirs[j][1] - dirs[i][1] * dirs[j][0]) < 1e-9) return true;
  return false;
};
/** count lines of symmetry of a point set by reflecting in lines through the centroid every 0.5° */
function symLines(p: Pt[]): number {
  const cx = p.reduce((s, q) => s + q[0], 0) / p.length, cy = p.reduce((s, q) => s + q[1], 0) / p.length;
  let count = 0;
  for (let t = 0; t < 180; t += 0.5) {
    const a = (t * Math.PI) / 180, ok = p.every((q) => {
      const x = q[0] - cx, y = q[1] - cy, rx = x * Math.cos(2 * a) + y * Math.sin(2 * a), ry = x * Math.sin(2 * a) - y * Math.cos(2 * a);
      return p.some((o) => near(o[0] - cx, rx, 1e-6) && near(o[1] - cy, ry, 1e-6));
    });
    if (ok) count++;
  }
  return count;
}

type Want = number | string | string[];
const E: Record<string, () => Want> = {};

// ─────────────────────────── RATIO & PROPORTION (Y6) ───────────────────────────
E["rp-y6-01"] = () => { const c = circles(svgOf("rp-counters")); const r = c.filter((x) => x.fill === "#d64545").length, b = c.filter((x) => x.fill === "#3b82c4").length; const g = gcd(r, b); return `${r / g} : ${b / g}`; };
E["rp-y6-02"] = () => 350 / 10;
E["rp-y6-03"] = () => 0.15 * 360;
E["rp-y6-04"] = () => `£${(40 / (3 + 5)) * 5}`;
E["rp-y6-05"] = () => (300 / 4) * 10;
E["rp-y6-06"] = () => { const [a, b] = [3, 9]; const sf = b / a; if (!near(5 * sf, 15)) fail("rp-y6-06 hypotenuse not scaled consistently"); return `${4 * sf} cm`; };
E["rp-y6-07"] = () => String(Math.ceil(150 / 48));
E["rp-y6-08"] = () => (60 / (1 + 2 + 3)) * 3;
E["rp-y6-09"] = () => Math.round(80 * (1 - 0.15) * 100) / 100;
E["rp-y6-10"] = () => ["4 : 6", "6 : 9", "3 : 2", "20 : 30", "5 : 6"].filter((o) => { const [a, b] = o.split(" : ").map(Number); return a * 3 === b * 2; });

// ─────────────────────────── ALGEBRA (Y6) ───────────────────────────
E["alg-y6-01"] = () => { const s = [5, 9, 13, 17]; const d = s[1] - s[0]; if (!s.every((v, i) => i === 0 || v - s[i - 1] === d)) fail("alg-y6-01 not linear"); return s[s.length - 1] + d; };
E["alg-y6-02"] = () => {
  const target = (n: number) => 4 * n + 3;
  const ok = ["4n + 3", "n + 12", "4 + 3n", "n + 4 + 3"].filter((e) => { const f = new Function("n", "return " + e.replace(/(\d)n/g, "$1*n")) as (n: number) => number; return [1, 2, 3, 7].every((n) => f(n) === target(n)); });
  return ok.length === 1 ? ok[0] : `NOT UNIQUE ${ok}`;
};
E["alg-y6-03"] = () => `£${5 * 4 + 3}`;
E["alg-y6-04"] = () => { const r: number[] = []; for (let n = 0; n <= 200; n++) if (3 * n + 5 === 26) r.push(n); return r.length === 1 ? r[0] : -1; };
E["alg-y6-05"] = () => 3 * 10 - 1;
E["alg-y6-06"] = () => { const inSeq = (x: number) => { for (let v = 4; v <= x; v += 6) if (v === x) return true; return false; }; const r = ["62", "66", "68", "64"].filter((o) => inSeq(Number(o))); return r.length === 1 ? r[0] : `NOT UNIQUE ${r}`; };
E["alg-y6-07"] = () => ["a = 1, b = 5", "a = 4, b = 3", "a = 5, b = 3", "a = 2, b = 5"].filter((o) => { const [a, b] = [...o.matchAll(/\d+/g)].map((m) => Number(m[0])); return a + 2 * b === 11; });
E["alg-y6-08"] = () => { let n = 0; for (let c = 1; c < 20; c++) for (let d = 1; d < 20; d++) if (2 * c + 3 * d === 24) n++; return n; };
E["alg-y6-09"] = () => {
  const s = svgOf("alg-function-machine"); if (!s.includes("× 4") || !s.includes("− 3") || !s.includes(">33<")) fail("alg-y6-09 picture does not show ×4, −3, 33");
  const r: number[] = []; for (let x = 0; x <= 500; x += 0.25) if (x * 4 - 3 === 33) r.push(x); return r.length === 1 ? r[0] : -1;
};
E["alg-y6-10"] = () => 3 * 5 + 2;

// ─────────────────────────── MEASUREMENT ───────────────────────────
E["meas-y3-01"] = () => { const [h, m] = readClock("meas-clock-roman"); return `${h}:${String(m).padStart(2, "0")}`; };
E["meas-y3-02"] = () => ["mm", "cm", "kg", "m", "ml"].filter((u) => ["mm", "cm", "m", "km"].includes(u));
E["meas-y3-03"] = () => { const g = lines(svgOf("meas-ruler-pencil")).filter((l) => l.dash).map((l) => (l.a[0] - 60) / 60).sort((a, b) => a - b); return g[1] - g[0]; };
E["meas-y3-04"] = () => { const m = svgOf("meas-jug-ml").match(/M170,([\d.]+) L350,\1"/); const y = num(m![1]); return Math.round(((410 - y) / (410 - 120)) * 500); };
E["meas-y3-05"] = () => 1000 - 350;
E["meas-y3-06"] = () => Math.round((5 - 3.4) * 100) / 100;
E["meas-y3-07"] = () => {
  const s = svgOf("meas-rectangle-8x5"); const r = rects(s).find((x) => x.fill === "#d6e8f8")!;
  if (!near(r.w / r.h, 8 / 5, 0.01) || !s.includes(">8 cm<") || !s.includes(">5 cm<")) fail("meas-y3-07 picture mismatch");
  return 2 * (8 + 5);
};
E["meas-y3-08"] = () => fmt12(10 * 60 + 45 + 60 + 35);
E["meas-y3-09"] = () => 200 - 3 * 45;
E["meas-y3-10"] = () => `${6 + 12}:30`;
E["meas-y4-01"] = () => 3 * 1000;
E["meas-y4-02"] = () => 4 * 60;
E["meas-y4-03"] = () => rects(svgOf("meas-grid-area")).filter((r) => r.fill === "#d6e8f8" && r.w === 60).length;
E["meas-y4-04"] = () => {
  const cells = rects(svgOf("meas-grid-perimeter")).filter((r) => r.fill === "#d9f0e2" && r.w === 64).map((r) => `${Math.round((r.x - 50) / 64)},${Math.round((r.y - 40) / 64)}`);
  const set = new Set(cells); let p = 0;
  for (const k of cells) { const [c, r] = k.split(",").map(Number); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${c + dc},${r + dr}`)) p++; }
  return p;
};
E["meas-y4-05"] = () => { const [h, m] = readClock("meas-clock-evening"); return `${h + 12}:${String(m).padStart(2, "0")}`; };
E["meas-y4-06"] = () => (3 * 45 + 28) / 100;
E["meas-y4-07"] = () => { const m = 21 * 60 + 40; return fmt12(m); };
E["meas-y4-08"] = () => 2 * 100 + 35;
E["meas-y4-09"] = () => { const d = 15 * 60 + 20 - (8 * 60 + 50); return `${Math.floor(d / 60)} hours ${d % 60} minutes`; };
E["meas-y4-10"] = () => 5 * 2 * (1000 + 250);
E["meas-y5-01"] = () => 2.5 * 1000;
E["meas-y5-02"] = () => 10 * 2.5;
E["meas-y5-03"] = () => { const p = polys(svgOf("meas-composite-perimeter"))[0]; const s = svgOf("meas-composite-perimeter"); for (const t of [">4 cm<", ">8 cm<", ">10 cm<", ">3 cm<"]) if (!s.includes(t)) fail("meas-y5-03 label missing " + t); return Math.round(perim(p.pts) / 32); };
E["meas-y5-04"] = () => 8 * 6.5;
E["meas-y5-05"] = () => { const m = svgOf("meas-jug-litres").match(/M170,([\d.]+) L350,\1"/); const y = num(m![1]); return Math.round(((410 - y) / (410 - 120)) * 2 * 1000); };
E["meas-y5-06"] = () => 3 * 60 + 60 / 4;
E["meas-y5-07"] = () => Math.round((2 - 0.75) * 1000);
E["meas-y5-08"] = () => (3 * 1.5 * 1000) / 250;
E["meas-y5-09"] = () => { const p = polys(svgOf("meas-composite-area"))[0]; return Math.round(area(p.pts) / 26 / 26); };
E["meas-y5-10"] = () => { const r = ["150 ml", "1,500 litres", "15 litres", "150 litres"].filter((o) => { const v = Number(o.replace(/[^\d.]/g, "")); const litres = o.endsWith(" ml") ? v / 1000 : v; return litres >= 100 && litres <= 250; }); return r.length === 1 ? r[0] : `NOT UNIQUE ${r}`; };
E["meas-y6-01"] = () => 3.5 * 1000;
E["meas-y6-02"] = () => 2345 / 1000;
E["meas-y6-03"] = () => (35 / 5) * 8;
E["meas-y6-04"] = () => { const p = polys(svgOf("meas-parallelogram"))[0]; return Math.round(area(p.pts) / 40 / 40); };
E["meas-y6-05"] = () => {
  const p = polys(svgOf("meas-triangle"))[0].pts; const sides = p.map((q, i) => Math.round(Math.hypot(q[0] - p[(i + 1) % 3][0], q[1] - p[(i + 1) % 3][1]) / 26)).sort((a, b) => a - b);
  if (sides.join() !== "13,14,15") fail("meas-y6-05 triangle sides " + sides);
  return Math.round(area(p) / 26 / 26);
};
E["meas-y6-06"] = () => 8 * 5 * 3;
E["meas-y6-07"] = () => { const areas = new Set<number>(); for (let l = 1; l < 12; l++) for (let w = 1; w < 12; w++) if (2 * (l + w) === 24) areas.add(l * w); const r = ["40 cm²", "24 cm²", "37 cm²", "36 cm²"].filter((o) => areas.has(Number(o.replace(/[^\d]/g, "")))); return r.length === 1 ? r[0] : `NOT UNIQUE ${r}`; };
E["meas-y6-08"] = () => 4 ** 3;
E["meas-y6-09"] = () => (50 * 40 * 30) / 1000;
E["meas-y6-10"] = () => Math.round((2.4 - 1.35) * 1000);

// ─────────────────────────── GEOMETRY — PROPERTIES OF SHAPES ───────────────────────────
E["shape-y3-01"] = () => String(regularPts(6).length);
E["shape-y3-02"] = () => { const ps = polys(svgOf("shape-right-angle-shapes")); const cnt = ps.map((p) => interior(p.pts).filter((a) => near(a, 90, 0.5)).length); if (cnt.join() !== "0,0,1,4") fail("shape-y3-02 right-angle counts " + cnt); return `Shape ${"ABCD"[cnt.indexOf(1)]}`; };
E["shape-y3-03"] = () => "6";
E["shape-y3-04"] = () => {
  const ls = lines(svgOf("shape-parallel-lines")); const col: Record<string, string> = { "#3b82c4": "A", "#3f9d6b": "B", "#f08a24": "C", "#8a5cc0": "D" };
  const dir = (l: { a: Pt; b: Pt }) => [l.b[0] - l.a[0], l.b[1] - l.a[1]];
  const A = ls.find((l) => col[l.stroke] === "A")!;
  const hits = ls.filter((l) => col[l.stroke] !== "A" && Math.abs(dir(A)[0] * dir(l)[1] - dir(A)[1] * dir(l)[0]) < 1e-6).map((l) => col[l.stroke]);
  return hits.length === 1 ? `Line ${hits[0]}` : `NOT UNIQUE ${hits}`;
};
E["shape-y3-05"] = () => { const perpendicular = (d: number) => d === 90; return perpendicular(90) ? "Perpendicular" : "?"; };
E["shape-y3-06"] = () => { const dirs = ["North", "East", "South", "West"]; return dirs[(0 + 90 / 90) % 4]; };
E["shape-y3-07"] = () => ["Square", "Rectangle", "Equilateral triangle", "Regular pentagon"].filter((o) => { const p = o === "Square" ? [[0, 0], [1, 0], [1, 1], [0, 1]] as Pt[] : o === "Rectangle" ? [[0, 0], [3, 0], [3, 1], [0, 1]] as Pt[] : regularPts(o === "Equilateral triangle" ? 3 : 5); return hasParallel(p); });
E["shape-y3-08"] = () => { let e = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const x = i ^ j; if (x === 1 || x === 2 || x === 4) e++; } return e; };
E["shape-y3-09"] = () => interior(polys(svgOf("shape-l-shape"))[0].pts).filter((a) => near(a, 90, 0.5)).length;
E["shape-y3-10"] = () => 6 + 5 - 2; // Euler: V − E + F = 2 with V = 6, F = 5
E["shape-y4-01"] = () => classifyAngle(45);
E["shape-y4-02"] = () => symLines([[0, 0], [1, 0], [1, 1], [0, 1]]);
E["shape-y4-03"] = () => { const [a, b, c] = [5, 5, 3]; const eq = (a === b ? 1 : 0) + (b === c ? 1 : 0) + (a === c ? 1 : 0); return eq === 1 ? "Isosceles" : eq === 3 ? "Equilateral" : "Scalene"; };
E["shape-y4-04"] = () => {
  const ls = lines(svgOf("shape-angle-types")).filter((l) => l.w === 6); const res: string[] = [];
  for (let i = 0; i < 3; i++) { const a = ls[2 * i], b = ls[2 * i + 1]; const ang = (l: typeof a) => (Math.atan2(-(l.b[1] - l.a[1]), l.b[0] - l.a[0]) * 180) / Math.PI; res.push(classifyAngle(Math.round(Math.abs(ang(a) - ang(b))))); }
  if (res.join() !== "Acute,Obtuse,Right") fail("shape-y4-04 angle classes " + res);
  return "ABC"[res.indexOf("Obtuse")];
};
E["shape-y4-05"] = () => {
  const p = polys(svgOf("shape-rhombus"))[0].pts; const sides = p.map((q, i) => Math.hypot(q[0] - p[(i + 1) % 4][0], q[1] - p[(i + 1) % 4][1])); const ang = interior(p);
  const equal = sides.every((s) => near(s, sides[0], 0.01)), right = ang.every((a) => near(a, 90, 0.5));
  return equal && !right ? "Rhombus" : equal ? "Square" : "?";
};
E["shape-y4-06"] = () => {
  const inst: Record<string, Pt[]> = { Square: [[0, 0], [1, 0], [1, 1], [0, 1]], Rectangle: [[0, 0], [3, 0], [3, 1], [0, 1]], Rhombus: [[0, 0], [2, 0], [3, 1.5], [1, 1.5]], Parallelogram: [[0, 0], [3, 0], [4, 1], [1, 1]] };
  const right = (k: string) => interior(inst[k]).every((a) => near(a, 90, 1e-6));
  // square and rectangle are defined by four right angles; a slanted rhombus / parallelogram is a counter-example
  if (right("Rhombus") || right("Parallelogram")) fail("shape-y4-06 counter-example is accidentally rectangular");
  return ["Square", "Rectangle"].filter(right);
};
E["shape-y4-07"] = () => rects(svgOf("shape-symmetry-complete")).filter((r) => r.fill === "#f08a24" && r.w === 50).length * 2;
E["shape-y4-08"] = () => { const r = Object.keys(BITS).filter((k) => hasSymmetry(BITS[k])); return r.length === 1 ? r[0] : `NOT UNIQUE ${r}`; };
E["shape-y4-09"] = () => {
  const square: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]], rect: Pt[] = [[0, 0], [3, 0], [3, 1], [0, 1]];
  const isRect = (p: Pt[]) => interior(p).every((a) => near(a, 90, 1e-6)); const isSquare = (p: Pt[]) => isRect(p) && near(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]));
  const maya = isRect(square), ravi = isSquare(rect); return maya && !ravi ? "Only Maya" : maya && ravi ? "Both of them" : !maya && ravi ? "Only Ravi" : "Neither of them";
};
E["shape-y4-10"] = () => { const a: Record<string, number> = { P: 90, Q: 45, R: 135 }; return Object.keys(a).sort((x, y) => a[x] - a[y]).join(", "); };
E["shape-y5-01"] = () => `${360 / 4}°`;
E["shape-y5-02"] = () => {
  const s = svgOf("shape-angles-line"); const ray = lines(s).find((l) => l.a[0] === 300 && l.a[1] === 230 && l.b[1] < 230)!; const deg = Math.round((Math.atan2(-(ray.b[1] - 230), ray.b[0] - 300) * 180) / Math.PI);
  if (!s.includes(`>${180 - deg}°<`)) fail(`shape-y5-02 picture label mismatch (ray at ${deg}°)`);
  return `${deg}°`;
};
E["shape-y5-03"] = () => `${360}°`;
E["shape-y5-04"] = () => {
  const ls = lines(svgOf("shape-angles-point")).filter((l) => l.w === 5 && l.a[0] === 260 && l.a[1] === 220);
  const ds = ls.map((l) => Math.round(((Math.atan2(-(l.b[1] - 220), l.b[0] - 260) * 180) / Math.PI + 360) % 360)).sort((a, b) => a - b);
  const gaps = ds.map((d, i) => (i === ds.length - 1 ? 360 - d + ds[0] : ds[i + 1] - d)).sort((a, b) => a - b);
  if (gaps.join() !== "65,80,95,120") fail("shape-y5-04 picture gaps " + gaps);
  return 360 - (120 + 95 + 80);
};
E["shape-y5-05"] = () => {
  const s = svgOf("shape-rectangle-diagonal"); const r = rects(s).find((x) => x.fill === "#d6e8f8")!; const a = Math.round((Math.atan2(r.h, r.w) * 180) / Math.PI);
  if (a !== 32 || !s.includes(">32°<")) fail("shape-y5-05 picture angle " + a); return `${90 - a}°`;
};
E["shape-y5-06"] = () => `${40 / 2 - 12} cm`;
E["shape-y5-07"] = () => {
  const s = svgOf("shape-net-prism"); const rs = rects(s).filter((r) => r.fill === "#d6e8f8"), ts = polys(s);
  const tri = ts.filter((t) => t.pts.length === 3);
  const sideOk = tri.every((t) => near(perim(t.pts) / 3, rs[0].w, 0.01));
  return rs.length === 3 && tri.length === 2 && sideOk ? "Triangular prism" : `? rects=${rs.length} tris=${tri.length}`;
};
E["shape-y5-08"] = () => {
  const ps = polys(svgOf("shape-regular-polygons")); const reg = ps.map((p) => { const sides = p.pts.map((q, i) => Math.hypot(q[0] - p.pts[(i + 1) % p.pts.length][0], q[1] - p.pts[(i + 1) % p.pts.length][1])); const ang = interior(p.pts); return sides.every((x) => near(x, sides[0], 0.6)) && ang.every((a) => near(a, ang[0], 0.6)); });
  return reg.filter(Boolean).length === 1 ? `Shape ${"ABCD"[reg.indexOf(true)]}` : `NOT UNIQUE ${reg}`;
};
E["shape-y5-09"] = () => (46 / 2 - 14) * 14;
E["shape-y5-10"] = () => 360 / 5;
E["shape-y5-11"] = () => "80°"; // a little less than 90°: 80° is the only option between 45° and 90° (QA re-check)
E["shape-y5-12"] = () => "Reflex"; // 250° is between 180° and 360°
E["shape-y6-01"] = () => `${180}°`;
E["shape-y6-02"] = () => { const a = interior(polys(svgOf("shape-triangle-angles"))[0].pts).map((x) => Math.round(x)).sort((p, q) => p - q); if (a.join() !== "48,65,67") fail("shape-y6-02 picture angles " + a); return `${180 - 48 - 67}°`; };
E["shape-y6-03"] = () => {
  const ls = lines(svgOf("shape-circle-parts")).filter((l) => l.w === 5); const O: Pt = [300, 200], r = 160; const name: Record<string, string> = { "#d64545": "P", "#3f9d6b": "Q", "#8a5cc0": "R" };
  const dist = (l: { a: Pt; b: Pt }) => Math.abs((l.b[0] - l.a[0]) * (l.a[1] - O[1]) - (l.a[0] - O[0]) * (l.b[1] - l.a[1])) / Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
  const onCircle = (q: Pt) => near(Math.hypot(q[0] - O[0], q[1] - O[1]), r, 0.5);
  const dia = ls.filter((l) => l.stroke in name && onCircle(l.a) && onCircle(l.b) && dist(l) < 0.5).map((l) => name[l.stroke]);
  return dia.length === 1 ? `Line ${dia[0]}` : `NOT UNIQUE ${dia}`;
};
E["shape-y6-04"] = () => { const a = interior(polys(svgOf("shape-quadrilateral-angles"))[0].pts).map((x) => Math.round(x)).sort((p, q) => p - q); if (a.join() !== "80,83,92,105") fail("shape-y6-04 picture angles " + a); return 360 - (105 + 80 + 92); };
E["shape-y6-05"] = () => {
  const ls = lines(svgOf("shape-vertical-opposite")).filter((l) => l.w === 5); const d = (l: { a: Pt; b: Pt }) => ((Math.atan2(-(l.b[1] - l.a[1]), l.b[0] - l.a[0]) * 180) / Math.PI + 360) % 180;
  const diff = Math.abs(d(ls[0]) - d(ls[1])); const obtuse = Math.round(Math.max(diff, 180 - diff)); if (obtuse !== 112) fail("shape-y6-05 picture obtuse " + obtuse);
  return `${obtuse}°`; // vertically opposite angles are equal
};
E["shape-y6-06"] = () => (5 - 2) * 180 - (100 + 110 + 120 + 90);
E["shape-y6-07"] = () => { const bad = Object.keys(NETS).filter((k) => !isCubeNet(NETS[k])); const n = rects(svgOf("shape-cube-nets")).filter((r) => r.fill === "#d6e8f8").length; if (n !== 24) fail("shape-y6-07 picture has " + n + " net squares"); return bad.length === 1 ? bad[0] : `NOT UNIQUE ${bad}`; };
E["shape-y6-08"] = () => `${((6 - 2) * 180) / 6}°`;
E["shape-y6-09"] = () => { const x = 180 / (1 + 2 + 3); return 3 * x; };
E["shape-y6-10"] = () => {
  const r = 5, d = 2 * r, off = 3, offChord = 2 * Math.sqrt(r * r - off * off);
  const truth: Record<string, boolean> = {
    "The diameter is twice as long as the radius": d === 2 * r,
    "A chord that passes through the centre is a diameter": 2 * Math.sqrt(r * r - 0) === d,
    "Every chord is as long as the diameter": near(offChord, d),
    "The circumference is the distance across the circle through the centre": near(2 * Math.PI * r, d),
  };
  return Object.keys(truth).filter((k) => truth[k]);
};

// ─────────────────────────── run ───────────────────────────
const numOf = (s: string) => { const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const seen = new Set<string>();
for (const T of [rp, alg, meas, shape]) {
  for (const y of Object.values(T.years)) {
    for (const q of y!.quiz.questions) {
      seen.add(q.key); checked++;
      const ex = E[q.key]; if (!ex) { fail(`${q.key}: no expectation written`); continue; }
      const want = ex();
      if (q.kind === "number") { if (typeof q.answer !== "number" || !near(q.answer, want as number, 1e-9)) fail(`${q.key}: key ${q.answer} but recomputed ${want}`); }
      else if (q.kind === "single") {
        const o = q.options!;
        const hits = typeof want === "number" ? o.filter((x) => near(numOf(x), want, 1e-9)) : o.filter((x) => x === want);
        if (hits.length !== 1) fail(`${q.key}: recomputed "${want}" matches ${hits.length} options`);
        else if (q.answer !== hits[0]) fail(`${q.key}: key "${q.answer}" but recomputed "${want}" (option "${hits[0]}")`);
      } else if (q.kind === "multi") {
        const w = (want as string[]).slice().sort(), a = (q.answer as string[]).slice().sort();
        if (JSON.stringify(w) !== JSON.stringify(a)) fail(`${q.key}: key ${JSON.stringify(a)} but recomputed ${JSON.stringify(w)}`);
      }
      if (q.image) { try { const b = statSync(path.join(PNG, q.image.file)).size; if (b > 200_000) fail(`${q.key}: image ${b} bytes > 200KB`); } catch { fail(`${q.key}: image missing ${q.image.file}`); } }
    }
  }
}
for (const k of Object.keys(E)) if (!seen.has(k)) fail(`expectation for unknown key ${k}`);
console.log(`${checked} questions re-computed, ${bad} mismatch(es)`);
process.exit(bad ? 1 : 0);
