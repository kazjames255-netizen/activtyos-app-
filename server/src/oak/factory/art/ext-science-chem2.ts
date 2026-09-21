// X3 Science extension, chemistry part 2 and Earth/space: reactions, energy, atmosphere, rocks, and the Sun-Earth-Moon system.
import type { Pic } from "./types";
import { mk, thick, box, plate, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, range, pt, arc, sector } from "./ext-science-kit";

const wave = (x0: number, x1: number, f: (x: number) => number) => { let w = ""; for (let x = x0; x <= x1; x += 3) w += `${x},${f(x).toFixed(1)} `; return w.trim(); };

// ── reactivity series ───────────────────────────────────────────────────────
const reactivity = (() => {
  const rows: [string, string, boolean][] = [["potassium", "K", false], ["sodium", "Na", false], ["lithium", "Li", false], ["calcium", "Ca", false], ["magnesium", "Mg", false], ["aluminium", "Al", false], ["carbon", "C", true], ["zinc", "Zn", false], ["iron", "Fe", false], ["hydrogen", "H", true], ["copper", "Cu", false], ["silver", "Ag", false], ["gold", "Au", false]];
  let s = arrow(24, 168, 24, 10, "ar", 7) + txt(24, 180, "", "tx");
  rows.forEach(([n, sy, nm], i) => { const y = 8 + i * 13; s += rect(44, y, 120, 12, nm ? "th2 f0" : "th2 f1", 3) + txt(50, y + 9.5, n, "tx tl") + txt(158, y + 9.5, sy, "tx te"); });
  return s + txt(178, 24, "most", "tx tl tr") + txt(178, 35, "reactive", "tx tl tr") + txt(178, 156, "least", "tx tl ta") + txt(178, 167, "reactive", "tx tl ta") + txt(178, 84, "carbon and", "tt tl tm") + txt(178, 93, "hydrogen are", "tt tl tm") + txt(178, 102, "non-metals", "tt tl tm");
})();

// ── metals and non-metals ───────────────────────────────────────────────────
const metals = (() => {
  const cell = 10, x0 = 30, y0 = 8;
  const metalloid = new Set(["2-13", "3-14", "4-14", "4-15", "5-15", "5-16", "6-16", "6-17"]);
  const nonmetal = new Set(["1-1", "1-18", "2-14", "2-15", "2-16", "2-17", "2-18", "3-15", "3-16", "3-17", "3-18", "4-16", "4-17", "4-18", "5-17", "5-18", "6-18"]);
  let s = "";
  for (let r = 1; r <= 7; r++) for (let g = 1; g <= 18; g++) {
    const has = r === 1 ? g === 1 || g === 18 : r <= 3 ? g <= 2 || g >= 13 : true;
    if (!has) continue;
    const k = `${r}-${g}`; let cls = "f1";
    if (nonmetal.has(k)) cls = "f3"; else if (metalloid.has(k) || (r === 7 && g >= 13)) cls = "f6";
    s += rect(x0 + (g - 1) * cell, y0 + (r - 1) * cell, cell, cell, `th2 ${cls}`);
  }
  s += rect(30, 92, 9, 9, "th2 f1") + txt(43, 100, "metals", "tx tl") + rect(84, 92, 9, 9, "th2 f3") + txt(97, 100, "non-metals", "tx tl") + rect(158, 92, 9, 9, "th2 f6") + txt(171, 100, "in between", "tx tl");
  return s + txt(30, 120, "metals: shiny, good conductors,", "tx tl") + txt(30, 131, "can be bent and hammered into shape", "tx tl") + txt(30, 146, "non-metals: dull, poor conductors,", "tx tl") + txt(30, 157, "brittle when solid (generally)", "tx tl");
})();

// ── conservation of mass ────────────────────────────────────────────────────
const atomH = (x: number, y: number) => circ(x, y, 4.4, "th2 f0");
const atomO = (x: number, y: number) => circ(x, y, 6.6, "th2 f4");
const conservation = (() => {
  let s = "";
  const h2 = (x: number, y: number) => atomH(x - 5, y) + atomH(x + 5, y) + ln(x - 5, y, x + 5, y, "th");
  const o2 = (x: number, y: number) => atomO(x - 7, y) + atomO(x + 7, y);
  const h2o = (x: number, y: number) => ln(x, y, x - 9, y + 9, "th") + ln(x, y, x + 9, y + 9, "th") + atomO(x, y) + atomH(x - 9, y + 9) + atomH(x + 9, y + 9);
  s += h2(30, 44) + h2(30, 84) + o2(84, 64) + txt(54, 68, "+", "tb") + txt(70, 46, "", "tx");
  s += arrow(106, 64, 138, 64, "l", 7);
  s += h2o(174, 56) + h2o(214, 56);
  return s + txt(54, 116, "hydrogen and oxygen", "tx") + txt(194, 116, "water", "tx") + txt(120, 138, "four H atoms and two O atoms on each side", "tx") + txt(120, 150, "no atoms are lost, so the mass stays the same", "tx tm");
})();

// ── combustion ──────────────────────────────────────────────────────────────
const combustion = (() => {
  let s = box(4, 8, 48, 26, "fuel", "l f3") + txt(60, 26, "+", "tb") + box(70, 8, 56, 26, "oxygen", "l f1") + arrow(130, 21, 148, 21, "l", 6) + box(152, 8, 84, 26, ["carbon dioxide", "+ water"], "l f2");
  s += txt(120, 50, "energy is released as heat and light", "tx tr");
  const T: [number, number] = [120, 70], L: [number, number] = [80, 132], Rr: [number, number] = [160, 132];
  s += poly([T, L, Rr], "l f4") + txt(120, 116, "", "tx");
  return s + txt(120, 96, "heat", "tx").replace('y="96"', 'y="100"') + txt(74, 138, "fuel", "tx te") + txt(166, 138, "oxygen", "tx tl") + txt(120, 152, "fire triangle: fire needs all three", "tx tm") + txt(120, 164, "remove one and the fire goes out", "tx tm");
})();

// ── neutralisation ──────────────────────────────────────────────────────────
const neutralisation = (() => {
  let s = box(4, 20, 48, 30, "acid", "l f4") + txt(60, 40, "+", "tb") + box(70, 20, 52, 30, "alkali", "l f1") + arrow(126, 35, 144, 35, "l", 6) + box(146, 20, 40, 30, "salt", "l f3") + txt(193, 40, "+", "tb") + box(200, 20, 38, 30, "water", "l f1");
  const cols = ["#d7191c", "#ef5a2a", "#f7b52c", "#b5d334", "#3fb56b", "#2b86c5", "#4b48b8"];
  cols.forEach((c, i) => { s += `<rect x="${30 + i * 26}" y="86" width="26" height="18" fill="${c}" stroke="#0004" stroke-width=".5"/>`; });
  return s + txt(30, 82, "acid", "tx tl tr") + txt(212, 82, "alkali", "tx te ta") + txt(121, 118, "neutral", "tx") + arrow(58, 128, 100, 128, "l", 6) + arrow(184, 128, 142, 128, "l", 6) + txt(120, 148, "the pH moves towards neutral", "tx") + txt(120, 162, "acid + alkali → salt + water", "tx tm");
})();

// ── reactions of acids ──────────────────────────────────────────────────────
const acids = (() => {
  const eq = (y: number, a: string, b: string) => rect(6, y, 228, 30, "l f4", 6).replace("f4", "f1") + txt(120, y + 13, a, "tx") + txt(120, y + 25, b, "tx tm");
  return eq(6, "acid + metal", "→ salt + hydrogen") + eq(42, "acid + metal oxide", "→ salt + water") + eq(78, "acid + alkali (metal hydroxide)", "→ salt + water") + eq(114, "acid + metal carbonate", "→ salt + water + carbon dioxide");
})();

// ── electrolysis ────────────────────────────────────────────────────────────
const electrolysis = (() => {
  let s = ln(112, 16, 112, 28, "l").replace('class="l"', 'class="l" stroke-width="4"') + ln(122, 10, 122, 34, "l") + txt(102, 25, "−", "tx") + txt(133, 25, "+", "tx") + txt(120, 9, "power supply", "tx");
  s += ln(112, 22, 60, 22, "l") + ln(60, 22, 60, 84, "l") + ln(122, 22, 180, 22, "l") + ln(180, 22, 180, 84, "l");
  s += path("M36 74 V148 Q36 156 44 156 H196 Q204 156 204 148 V74", "l f0") + path("M37 94 H203 V148 Q203 155 196 155 H44 Q37 155 37 148 Z", "th f1");
  s += rect(56, 80, 8, 60, "l f6", 1) + rect(176, 80, 8, 60, "l f6", 1);
  [[86, 112], [96, 132], [110, 104], [82, 130], [100, 118]].forEach((p) => { s += circ(p[0], p[1], 5, "th2 fs") + txt(p[0], p[1] + 3, "+", "tt"); });
  [[130, 116], [146, 130], [158, 106], [140, 102], [124, 134]].forEach((p) => { s += circ(p[0], p[1], 6, "th2 fg") + txt(p[0], p[1] + 3, "−", "tt"); });
  s += arrow(100, 100, 72, 100, "a", 6) + arrow(140, 92, 168, 92, "ag", 6);
  return s + plate(60, 58, "cathode (−)", "tx") + plate(180, 58, "anode (+)", "tx") + txt(120, 76, "electrolyte", "tx tm") + txt(120, 168, "positive ions go to the cathode, negative to the anode", "tt tm");
})();

// ── rate of reaction graph ──────────────────────────────────────────────────
const rate = (() => {
  const f = (k: number) => (x: number) => 130 - 90 * (1 - Math.exp(-(x - 30) / k));
  return arrow(30, 130, 226, 130, "l", 6) + arrow(30, 130, 30, 12, "l", 6) + `<polyline points="${wave(30, 220, f(24))}" class="ar"/><polyline points="${wave(30, 220, f(70))}" class="a"/>`
    + txt(126, 146, "time", "tx tm") + `<text x="14" y="76" class="t tx tm" transform="rotate(-90 14 76)">amount of product</text>` + txt(60, 22, "faster reaction: steeper line", "tx tl tr") + txt(120, 96, "slower reaction", "tx ta") + txt(120, 164, "the line flattens when the reaction ends", "tx tm");
})();

// ── catalyst ────────────────────────────────────────────────────────────────
const catalyst = (() => {
  const pk = (h: number, c: string) => path(`M34 90 H70 C90 90 92 ${h} 118 ${h} C144 ${h} 146 122 166 122 H200`, c);
  return arrow(30, 146, 224, 146, "l", 7) + arrow(30, 146, 30, 12, "l", 7) + pk(30, "ar") + pk(56, "ag") + txt(126, 160, "progress of the reaction", "tx tm") + `<text x="18" y="80" class="t tx tm" transform="rotate(-90 18 80)">energy</text>`
    + txt(152, 26, "without a catalyst", "tx tl tr") + txt(152, 48, "with a catalyst", "tx tl tg") + txt(56, 84, "reactants", "tx") + txt(190, 116, "products", "tx") + txt(38, 122, "a catalyst lowers", "tt tl tm") + txt(38, 131, "the activation energy", "tt tl tm");
})();

// ── atmosphere ──────────────────────────────────────────────────────────────
const atmosphere = (() => {
  const cx = 62, cy = 84, r = 52;
  let s = sector(cx, cy, r, 90, 90 + 0.78 * 360, "l f1") + sector(cx, cy, r, 90 + 0.78 * 360, 90 + 0.99 * 360, "l f4") + sector(cx, cy, r, 90 + 0.99 * 360, 90 + 360, "l f3");
  return s + txt(126, 36, "nitrogen", "ts tl") + txt(126, 48, "just under", "tx tl tm") + txt(126, 59, "four-fifths", "tx tl tm") + txt(126, 84, "oxygen", "ts tl") + txt(126, 96, "about", "tx tl tm") + txt(126, 107, "one-fifth", "tx tl tm") + txt(126, 128, "argon, carbon", "tx tl") + txt(126, 139, "dioxide, water", "tx tl") + txt(126, 150, "vapour: tiny amounts", "tx tl") + txt(62, 152, "the air today", "tx tm");
})();

// ── greenhouse effect ───────────────────────────────────────────────────────
const greenhouse = (() => {
  let s = circ(22, 20, 14, "l f3") + rect(0, 66, 240, 32, "th f1").replace('class="th f1"', 'class="th f1" opacity=".55"') + path("M0 150 Q120 126 240 150 V170 H0 Z", "l f2");
  s += arrow(34, 32, 66, 138, "ao", 7) + txt(54, 44, "sunlight", "tx tl") + txt(54, 55, "passes", "tx tl") + txt(54, 66, "through", "tx tl");
  s += arrow(112, 134, 112, 22, "ar", 7) + txt(118, 14, "some infrared escapes", "tt tl") + txt(118, 24, "to space", "tt tl");
  s += arrow(150, 134, 150, 100, "ar", 7) + arrow(186, 100, 186, 134, "ar", 7);
  return s + txt(124, 80, "greenhouse gases", "tx tl") + txt(124, 91, "absorb infrared", "tx tl") + txt(192, 116, "sent back", "tt tl") + txt(192, 125, "to Earth", "tt tl") + txt(70, 164, "Earth's surface", "tx"); // (image QA: label ends at x = 231, inside the 240 frame)
})();

// ── rock cycle ──────────────────────────────────────────────────────────────
const rocks = (() => {
  // (image QA: magma box ends at y = 168 inside the 170 frame; "cooling" sits LEFT of its arrow so it cannot run into the sediments box; "weathering" is above its arrow)
  let s = box(76, 4, 88, 24, "igneous rock", "l f4") + box(156, 50, 80, 22, "sediments", "l f6") + box(148, 100, 90, 24, "sedimentary rock", "l f3") + box(2, 74, 92, 24, "metamorphic rock", "l f5") + box(76, 144, 88, 24, "magma", "l f4");
  s += arrow(150, 28, 190, 48, "l", 6) + txt(184, 34, "weathering", "tt tl");
  s += arrow(196, 74, 196, 98, "l", 6) + txt(190, 82, "compaction and", "tt te") + txt(190, 91, "cementation", "tt te");
  s += arrow(156, 112, 94, 92, "l", 6) + txt(114, 111, "heat and pressure", "tt te");
  s += arrow(96, 28, 58, 72, "l", 6) + txt(10, 44, "heat and", "tt tl") + txt(10, 53, "pressure", "tt tl");
  s += arrow(50, 100, 86, 142, "l", 6) + txt(6, 130, "melting", "tt tl");
  s += arrow(196, 126, 162, 146, "l", 6) + txt(200, 146, "melting", "tt tl");
  s += arrow(120, 142, 120, 30, "l", 6) + txt(114, 62, "cooling", "tt te");
  return s;
})();

// ── types of rock ───────────────────────────────────────────────────────────
const rockTypes = (() => {
  let s = "";
  const col = (x: number, title: string, c: string, lines: string[], ex: string[], icon: string) => rect(x, 6, 76, 156, "l " + c, 8) + txt(x + 38, 22, title, "tx") + icon + lines.map((l, i) => txt(x + 38, 84 + i * 11, l, "tx")).join("") + ex.map((l, i) => txt(x + 38, 134 + i * 11, l, "tx tm")).join("");
  const crystals = [[0, 0], [14, 4], [-14, 6], [6, 14], [-8, 16]].map((p, i) => poly([[p[0], p[1] - 8], [p[0] + 7, p[1] + 3], [p[0] - 7, p[1] + 3]], "th2 f0").replace("<polygon", `<polygon transform="translate(${37 + 6 * (i % 2)} 44)"`)).join("");
  const layers = range(4).map((i) => rect(-24, 30 + i * 8, 48, 7, "th2 " + ["f0", "f3", "f0", "f3"][i])).join("");
  const fold = path("M-24 36 Q-12 24 0 36 T24 36 M-24 46 Q-12 34 0 46 T24 46 M-24 56 Q-12 44 0 56 T24 56", "l");
  s += col(2, "igneous", "f4", ["formed when", "molten rock", "cools and", "hardens"], ["granite", "basalt"], crystals);
  s += col(82, "sedimentary", "f3", ["layers of", "sediment", "pressed and", "cemented"], ["sandstone", "limestone"], `<g transform="translate(120 8)">${layers}</g>`);
  s += col(162, "metamorphic", "f5", ["rock changed", "by heat and", "pressure", "(not melted)"], ["marble", "slate"], `<g transform="translate(200 8)">${fold}</g>`);
  return s;
})();

// ── seasons ─────────────────────────────────────────────────────────────────
const seasons = (() => {
  let s = circ(120, 70, 18, "l f3");
  const earth = (cx: number, lit: "l" | "r") => {
    const t = (23.5 * Math.PI) / 180, dx = 30 * Math.sin(t), dy = 30 * Math.cos(t);
    return circ(cx, 70, 18, "l f6") + `<path d="M${cx} 52 A18 18 0 0 ${lit === "r" ? 1 : 0} ${cx} 88 Z" class="th f3" opacity=".8"/>` + ln(cx - dx, 70 + dy, cx + dx, 70 - dy, "l") + txt(cx + dx + 6, 70 - dy + 6, "N", "ts");
  };
  s += earth(36, "r") + earth(204, "l");
  return s + txt(40, 108, "north tilted", "tx") + txt(40, 119, "towards Sun:", "tx") + txt(40, 130, "summer in", "tx") + txt(40, 141, "the north", "tx") + txt(200, 108, "north tilted", "tx") + txt(200, 119, "away from Sun:", "tx") + txt(200, 130, "winter in", "tx") + txt(200, 141, "the north", "tx") + txt(120, 40, "Sun", "tx") + txt(120, 156, "the tilt of the Earth's axis", "tx tm") + txt(120, 167, "causes the seasons (not to scale)", "tx tm");
})();

// ── day and night ───────────────────────────────────────────────────────────
const dayNight = (() => {
  let s = circ(20, 84, 14, "l f3");
  s += [0, 1, 2, 3, 4].map((i) => arrow(40, 40 + i * 22, 84, 40 + i * 22, "ao", 6)).join("");
  s += circ(140, 84, 44, "l f6") + `<path d="M140 40 A44 44 0 0 0 140 128 Z" class="th f3" opacity=".7"/>`;
  s += path("M186 60 A50 50 0 0 1 186 108", "l").replace('class="l"', 'class="l" opacity="0"');
  s += arc(140, 84, 54, -50, 50, "ar").replace("ar", "ar") + `<polygon points="${pt(140, 84, 54, 50).map((v) => v.toFixed(1)).join(",")} ${pt(140, 84, 54, 50)[0] + 6},${pt(140, 84, 54, 50)[1] + 8} ${pt(140, 84, 54, 50)[0] - 8},${pt(140, 84, 54, 50)[1] + 4}" class="hdr"/>`;
  return s + txt(122, 88, "day", "ts") + txt(160, 88, "night", "ts") + txt(20, 112, "Sun", "tx") + txt(196, 60, "Earth", "tx tl") + txt(196, 71, "spins", "tx tl") + txt(120, 150, "the side facing the Sun has day,", "tx") + txt(120, 162, "the side facing away has night", "tx");
})();

// ── eclipses ────────────────────────────────────────────────────────────────
const eclipses = (() => {
  let s = circ(20, 40, 14, "l f3") + poly([[134, 35], [134, 45], [188, 40.6], [188, 39.4]], "th f6") + circ(134, 40, 5, "l f6") + circ(200, 40, 12, "l f1");
  s += circ(20, 116, 14, "l f3") + poly([[128, 106], [128, 126], [222, 118], [222, 114]], "th f6") + circ(120, 116, 12, "l f1") + circ(200, 116, 5, "l f6");
  return s + txt(120, 14, "solar eclipse: the Moon is between", "tx") + txt(120, 62, "the Sun and the Earth", "tx") + txt(120, 90, "lunar eclipse: the Earth is between", "tx") + txt(120, 140, "the Sun and the Moon", "tx") + txt(120, 165, "not to scale", "tt tm");
})();

// ── orbits ──────────────────────────────────────────────────────────────────
const orbits = (() => {
  let s = circ(120, 84, 62, "h").replace('class="h"', 'class="h" fill="none"') + circ(120, 84, 14, "l f3") + circ(178, 84, 8, "l f1") + circ(178, 84, 17, "h").replace('class="h"', 'class="h" fill="none"') + circ(195, 84, 3.4, "l f6");
  s += arrow(120, 22, 100, 24, "l", 6);
  return s + txt(120, 88, "Sun", "tx") + plate(178, 108, "Earth", "tx") + txt(208, 76, "Moon", "tx tl") + txt(120, 14, "Earth orbits the Sun (once a year)", "tx tm") + txt(120, 160, "the Moon orbits the Earth about monthly", "tx tm");
})();

// ── life cycle of a star ────────────────────────────────────────────────────
const stars = (() => {
  let s = box(2, 6, 70, 26, "nebula", "l f5") + box(84, 6, 70, 26, "protostar", "l f3") + box(160, 6, 78, 26, ["main sequence", "star"], "l f3"); // (image QA: 78 wide so "main sequence" fits inside)
  s += arrow(74, 19, 82, 19, "l", 5) + arrow(156, 19, 158, 19, "l", 5);
  s += box(166, 62, 66, 26, "red giant", "l f4") + box(84, 62, 70, 26, "white dwarf", "l f0") + arrow(164, 75, 156, 75, "l", 5) + arrow(199, 34, 199, 60, "l", 5);
  s += box(166, 112, 66, 30, ["red", "supergiant"], "l f4") + box(84, 112, 70, 30, "supernova", "l f3") + box(2, 112, 80, 30, ["neutron star", "or black hole"], "l f0") + arrow(164, 127, 156, 127, "l", 5) + arrow(82, 127, 82, 127, "l", 1) + arrow(84, 127, 82, 127, "l", 3);
  s += ln(236, 20, 240, 20, "l").replace('class="l"', 'class="l" opacity="0"') + path("M236 22 H240 V127 H234", "l") + arrow(236, 127, 233, 127, "l", 4);
  return s + txt(42, 72, "a star like", "tx") + txt(42, 83, "our Sun", "tx") + txt(120, 156, "a much bigger star", "tx tm").replace('x="120"', 'x="150"').replace("tx tm", "tx tm");
})();

// ── gravity ─────────────────────────────────────────────────────────────────
const gravity = (() => {
  let s = circ(120, 66, 26, "l f1") + txt(120, 70, "Earth", "tx");
  const ball = (a: number) => { const p = pt(120, 66, 52, a), q = pt(120, 66, 34, a); return circ(p[0], p[1], 7, "l f3") + arrow(p[0] + (q[0] - p[0]) * 0.25, p[1] + (q[1] - p[1]) * 0.25, q[0], q[1], "ar", 6); };
  s += ball(90) + ball(0) + ball(270) + ball(180);
  return s + txt(120, 140, "gravity pulls objects towards", "tx tm") + txt(120, 151, "the centre of the Earth;", "tx tm") + txt(120, 163, "the pull on an object is its weight", "tx tm");
})();

export const CHEM2: Pic[] = [
  mk("x3-reactivity-series", "Reactivity series", ["reactivity series", "series of reactivity", "order of reactivity"], reactivity, "The reactivity series as a list from most reactive at the top to least reactive at the bottom: potassium, sodium, lithium, calcium, magnesium, aluminium, carbon, zinc, iron, hydrogen, copper, silver, gold; carbon and hydrogen are shown as non-metals for comparison.", "The reactivity series", "Reactivity series: K, Na, Li, Ca, Mg, Al, (C), Zn, Fe, (H), Cu, Ag, Au from most to least reactive; carbon and hydrogen are non-metals included for comparison (Oak KS3/KS4 'reactivity series').", { h: 186, avoid: ["platinum", "rubidium", "caesium", "tin", "lead"], doesNotShow: "reactions or observations; metals not listed (e.g. tin, lead, platinum)" }),
  mk("x3-metals-nonmetals", "Metals and non-metals", ["metals and non-metals", "metal and non-metal", "non-metal", "non-metals", "nonmetal", "nonmetals", "properties of metals", "properties of non-metals"], metals, "A periodic table drawn as blocks with the metals in blue on the left and middle, the non-metals in yellow at the top right and the in-between elements in grey along the step line; below it the general properties: metals are shiny, good conductors, and can be bent and hammered; non-metals are dull, poor conductors and brittle when solid.", "Metals and non-metals", "Metals occupy the left and centre of the periodic table, non-metals the top right, with a stepped dividing line; metals are shiny conductors that can be bent and hammered; non-metals are generally dull, poor conductors and brittle when solid (Oak KS3/KS4 'metals and non-metals').", { avoid: ["metal ion", "metal ions", "metal oxide", "metal oxides", "metal hydroxide", "metal carbonate", "metal salt", "non-metal oxide"], doesNotShow: "individual elements or their symbols; exceptions such as graphite or mercury" }),
  mk("x3-conservation-of-mass", "Conservation of mass", ["conservation of mass", "law of conservation of mass", "balanced equation", "balanced equations", "balancing equations", "balanced symbol equation"], conservation, "Hydrogen and oxygen reacting to make water: two hydrogen molecules and one oxygen molecule on the left, two water molecules on the right; there are four hydrogen atoms and two oxygen atoms on each side, so no atoms are lost and the mass stays the same.", "Conservation of mass", "Atoms are not created or destroyed in a chemical reaction: 2H2 + O2 -> 2H2O has 4 H and 2 O atoms on each side, so the total mass is unchanged (Oak KS3/KS4 'conservation of mass').", { numeric: true, requires: ["mass", "atoms", "equation", "equations", "reaction", "reactions"], doesNotShow: "other reactions; the symbol equation; open systems where gases escape" }),
  mk("x3-combustion", "Combustion and the fire triangle", ["combustion", "burning", "fire triangle", "complete combustion"], combustion, "Combustion: a fuel burns in oxygen to make carbon dioxide and water and releases energy as heat and light; below, the fire triangle shows fire needs heat, fuel and oxygen and goes out if one is removed.", "Combustion and the fire triangle", "Complete combustion of a fuel (e.g. a hydrocarbon) in plenty of oxygen: fuel + oxygen -> carbon dioxide + water, energy released; a fire needs heat, fuel and oxygen (Oak KS3/KS4 'combustion').", { requires: ["fuel", "fuels", "oxygen", "fire", "flame", "reaction"], avoid: ["incomplete", "carbon monoxide", "soot", "spontaneous", "metals", "magnesium"], doesNotShow: "incomplete combustion; combustion of metals; the energy amounts" }),
  mk("x3-neutralisation", "Neutralisation", ["neutralisation", "neutralization", "neutralise", "neutralises", "neutralising"], neutralisation, "Neutralisation: an acid and an alkali react to make a salt and water; a strip of colours runs from acid on the left to alkali on the right with neutral in the middle, and arrows show the pH moving towards neutral.", "Neutralisation", "Neutralisation: acid + alkali -> salt + water; the pH moves towards neutral (Oak KS3/KS4 'neutralisation').", { avoid: ["carbonate", "carbonates", "metal oxide", "indigestion", "titration"], doesNotShow: "which acid or alkali; the pH numbers; other acid reactions" }),
  mk("x3-acid-reactions", "Reactions of acids", ["reactions of acids", "acid reactions", "acids and metals", "acids and bases", "acids and alkalis", "acid and alkali", "acid and metal"], acids, "Four general word equations for acids: acid plus metal makes a salt and hydrogen; acid plus metal oxide makes a salt and water; acid plus alkali (metal hydroxide) makes a salt and water; acid plus metal carbonate makes a salt, water and carbon dioxide.", "Reactions of acids", "General acid reactions: acid + metal -> salt + hydrogen; acid + metal oxide -> salt + water; acid + alkali/metal hydroxide -> salt + water; acid + metal carbonate -> salt + water + carbon dioxide (Oak KS3/KS4 'reactions of acids').", { avoid: ["ph scale", "indicator", "litmus", "ammonia", "organic", "carboxylic", "titration"], doesNotShow: "the name of the salt formed; specific acids; observations" }),
  mk("x3-electrolysis", "Electrolysis", ["electrolysis", "electrolyte", "electrolytes", "anode", "anodes", "cathode", "cathodes", "electrolytic"], electrolysis, "An electrolysis cell: a power supply connected to two electrodes in an electrolyte. The electrode joined to the negative terminal is the cathode and positive ions move to it; the electrode joined to the positive terminal is the anode and negative ions move to it.", "Electrolysis", "Electrolysis: an electric current passes through an ionic compound that is molten or dissolved (the electrolyte); positive ions move to the negative electrode (cathode), negative ions to the positive electrode (anode) (Oak KS4 'electrolysis').", { avoid: ["electric cell", "electrical cell", "electrochemical cell", "battery", "batteries", "hydrogen fuel cell", "fuel cell", "electroplating", "voltaic"], doesNotShow: "the products at each electrode; half equations; the number of ions" }),
  mk("x3-rate-graph", "Rate of reaction graph", ["rate of reaction", "reaction rate", "rates of reaction", "rate of a reaction", "collision theory"], rate, "A graph of the amount of product against time with two curves: a faster reaction has a steeper line at the start and a slower reaction has a shallower line; both level off when the reaction has finished.", "Rate of reaction: amount of product against time", "The steeper the line on a graph of product against time, the faster the reaction; the line levels off when a reactant is used up and the reaction is finished (Oak KS4 'rate of reaction').", { avoid: ["equilibrium", "reversible", "rate of photosynthesis", "rate of respiration", "enzyme", "heart rate", "rate of transpiration", "rate of change of velocity"], doesNotShow: "the units or numbers on the axes; the cause of the different rates" }),
  mk("x3-catalyst", "Catalysts and activation energy", ["catalyst", "catalysts", "catalysis", "catalytic"], catalyst, "An energy profile with two curves for the same reaction: without a catalyst the activation energy is high; with a catalyst the peak is lower, so the activation energy is lower; the reactants and products stay at the same energy levels.", "How a catalyst works", "A catalyst provides an alternative pathway with a lower activation energy; the energy of reactants and products is unchanged; the catalyst is not used up (Oak KS4 'catalyst').", { avoid: ["enzyme", "enzymes", "catalytic converter", "catalytic converters"], doesNotShow: "whether the reaction is exothermic or endothermic (an exothermic profile is drawn as an example); how the catalyst works on the particles" }),
  mk("x3-atmosphere", "Gases in the air", ["composition of the atmosphere", "composition of air", "composition of the air", "gases in the air", "gases in air", "gases in the atmosphere", "air is a mixture"], atmosphere, "A pie chart of the gases in today's air: nitrogen is just under four-fifths, oxygen is about one-fifth, and argon, carbon dioxide and water vapour make up tiny amounts.", "The gases in the air today", "Air today is about 78% nitrogen and 21% oxygen with about 1% argon, carbon dioxide, water vapour and others (Oak KS3/KS4 'composition of the atmosphere'). Drawn with exact sector angles; fractions are given in words.", { avoid: ["early atmosphere", "primordial", "billion", "volcanic", "volcanoes", "evolution of the atmosphere", "changed over time", "original atmosphere", "other planets", "mars", "venus"], doesNotShow: "the percentages as numbers; the atmosphere's layers; how the atmosphere changed over time" }),
  mk("x3-greenhouse", "The greenhouse effect", ["greenhouse effect", "greenhouse gas", "greenhouse gases", "global warming", "enhanced greenhouse effect"], greenhouse, "The greenhouse effect: sunlight passes through the atmosphere and warms the Earth's surface; the surface gives out infrared; some infrared escapes to space but greenhouse gases in the atmosphere absorb some and send it back towards the Earth, keeping it warm.", "The greenhouse effect", "Greenhouse effect: short-wave radiation from the Sun passes through the atmosphere, is absorbed by the surface and re-emitted as infrared; greenhouse gases absorb some of it and re-radiate it in all directions including back to Earth (Oak KS3/KS4 'greenhouse effect').", { avoid: ["greenhouse plants", "polytunnel", "glasshouse", "growing plants", "ozone"], doesNotShow: "which gases are greenhouse gases; the sources of the gases; the size of the effect" }),
  mk("x3-rock-cycle", "The rock cycle", ["rock cycle"], rocks, "The rock cycle: igneous rock is weathered and eroded into sediments that are pressed into sedimentary rock; sedimentary and igneous rock can be changed into metamorphic rock by heat and pressure; rocks melt to make magma; and magma cools and crystallises to make igneous rock.", "The rock cycle", "Rock cycle: magma cools and crystallises -> igneous rock; weathering, erosion and transport -> sediments; compaction and cementation -> sedimentary rock; heat and pressure -> metamorphic rock; melting -> magma (Oak KS3 'the rock cycle').", { h: 170, doesNotShow: "the time each stage takes; uplift; every possible pathway" }),
  mk("x3-rock-types", "Types of rock", ["types of rock", "igneous", "igneous rock", "igneous rocks", "sedimentary", "sedimentary rock", "sedimentary rocks", "metamorphic", "metamorphic rock", "metamorphic rocks"], rockTypes, "Three types of rock: igneous rock forms when molten rock cools and hardens (for example granite and basalt); sedimentary rock forms from layers of sediment pressed and cemented together (sandstone, limestone); metamorphic rock is rock changed by heat and pressure without melting (marble, slate).", "The three types of rock", "Igneous: from cooled magma/lava (granite, basalt); sedimentary: from compacted, cemented sediment (sandstone, limestone); metamorphic: changed by heat and pressure (marble, slate) (Oak KS3 'rock types').", { avoid: ["extrusive", "intrusive", "clastic", "chemical sediment"], doesNotShow: "how igneous rocks differ by cooling rate; fossils; the rock cycle" }),
  mk("x3-seasons", "Earth's tilt and the seasons", ["seasons", "tilt of the earth", "earths tilt", "earth tilt", "axis tilt", "tilted axis", "earths axis"], seasons, "The Earth at two places in its orbit with its axis tilted the same way: when the north is tilted towards the Sun it is summer in the north; when the north is tilted away from the Sun it is winter in the north. Not to scale.", "The tilt of the Earth causes the seasons", "Seasons are caused by the tilt of the Earth's axis (about 23.5 degrees), which stays pointing the same way as the Earth orbits the Sun; the hemisphere tilted towards the Sun has summer (Oak KS3 'seasons'). Not caused by distance from the Sun.", { requires: ["earth", "earths", "tilt", "tilted", "axis", "orbit", "sun"], avoid: ["spring", "autumn", "weather", "plants", "trees", "animals", "clothes", "temperature changes at"], doesNotShow: "spring and autumn; the southern hemisphere; the angle in degrees" }),
  mk("x3-day-night", "Day and night", ["day and night", "rotation of the earth", "earths rotation", "earth rotates", "earth spins"], dayNight, "Day and night: the Earth spins on its axis; the side facing the Sun has day and the side facing away has night. Sunlight arrives from the left and an arrow shows the Earth's spin.", "Day and night", "The Earth rotates once a day on its axis (anticlockwise seen from above the north pole); the half facing the Sun has day, the other half has night (Oak KS2/KS3 'day and night').", { avoid: ["day length", "seasons", "shadow", "shadows", "orbit"], doesNotShow: "the tilt of the axis; time zones; the Moon" }),
  mk("x3-eclipses", "Solar and lunar eclipses", ["solar eclipse", "solar eclipses", "lunar eclipse", "lunar eclipses", "eclipse", "eclipses"], eclipses, "Two eclipses: in a solar eclipse the Moon is between the Sun and the Earth and its shadow falls on part of the Earth; in a lunar eclipse the Earth is between the Sun and the Moon and the Moon is in the Earth's shadow. Not to scale.", "Solar and lunar eclipses", "Solar eclipse: Moon between Sun and Earth. Lunar eclipse: Earth between Sun and Moon (Oak KS3 'eclipses'). Not to scale.", { doesNotShow: "the umbra and penumbra; how often eclipses happen; true distances and sizes" }),
  mk("x3-orbits", "Orbits of the Earth and Moon", ["orbit", "orbits", "orbiting", "orbital", "orbit of the earth", "orbit of the moon"], orbits, "The Earth orbits the Sun once a year and the Moon orbits the Earth about once a month. Not to scale.", "The Earth orbits the Sun; the Moon orbits the Earth", "Earth orbits the Sun in about a year (nearly circular path); the Moon orbits the Earth in about a month (Oak KS3 'orbit'). Not to scale.", { avoid: ["geostationary", "polar orbit", "satellite", "satellites", "electron orbit", "elliptical", "comet", "orbital path"], doesNotShow: "other planets; satellites; elliptical shapes; true distances or sizes" }),
  mk("x3-star-life-cycle", "Life cycle of a star", ["life cycle of a star", "life cycle of stars", "star life cycle", "stellar life cycle", "life cycle of a massive star", "main sequence star", "red giant", "white dwarf", "supernova", "protostar", "black hole", "neutron star", "nebula"], stars, "The life cycle of a star: a nebula becomes a protostar and then a main sequence star; a star like our Sun becomes a red giant and then a white dwarf; a much bigger star becomes a red supergiant, then a supernova, then a neutron star or a black hole.", "The life cycle of a star", "Stars form from a nebula (protostar -> main sequence). A star like the Sun swells to a red giant then shrinks to a white dwarf; a much more massive star becomes a red supergiant, explodes as a supernova and leaves a neutron star or black hole (Oak KS4 'life cycle of a star').", { doesNotShow: "the time each stage takes; masses; how elements are made" }),
  mk("x3-gravity", "Gravity and weight", ["gravity", "gravitational force", "force of gravity", "gravitational forces", "weight"], gravity, "The Earth with four objects around it and an arrow on each pointing towards the centre of the Earth: gravity pulls objects towards the centre of the Earth and the pull on an object is its weight.", "Gravity pulls towards the centre of the Earth", "Gravity is a non-contact attraction between masses; on Earth it pulls every object towards the centre of the Earth, and the weight of an object is the gravitational force acting on it (Oak KS2/KS3 'gravity', 'weight').", { requires: ["earth", "gravity", "gravitational", "mass", "newton", "newtons", "force", "forces", "falls", "fall"], avoid: ["seedling", "seedlings", "growth", "plant", "plants", "root", "roots", "gravitropism", "periodic table", "atom", "atomic", "gravitational potential", "gravitational field strength", "gravitational store", "gravitational potential energy", "weight loss", "healthy weight", "body weight", "moon", "planet", "other planets", "black hole", "orbit"], doesNotShow: "gravity on other planets or the Moon; the value of g; weight versus mass calculations" }),
];
void [thick, dot, poly, ell, box];
