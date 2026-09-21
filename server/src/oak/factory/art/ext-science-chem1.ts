// X3 Science extension, chemistry part 1: laboratory apparatus, separating mixtures, atoms, elements and bonding.
import type { Pic } from "./types";
import { mk, thick, box, plate, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, range, put } from "./ext-science-kit";

const R = "l f4", B = "l f1", G = "l f2", Y = "l f3", V = "l f5", N = "l f0", GR = "l f6";

// ── laboratory glassware ────────────────────────────────────────────────────
const glassware = (() => {
  let s = "";
  s += path("M14 40 V108 Q14 116 22 116 H44 Q52 116 52 108 V40", "l f0") + path("M15 74 H51 V108 Q51 115 44 115 H22 Q15 115 15 108 Z", "th f1") + ln(14, 40, 10, 38, "l") + range(3).map((i) => ln(14, 56 + i * 16, 22, 56 + i * 16, "th")).join("");
  s += path("M74 40 H86 V66 L102 116 H58 L74 66 Z", "l f0") + path("M68 86 H92 L100 114 H60 Z", "th f1");
  s += rect(108, 30, 22, 86, "l f0", 2) + rect(109, 76, 20, 39, "th f1") + rect(104, 116, 30, 5, "l f6", 2) + range(6).map((i) => ln(108, 40 + i * 12, i % 2 ? 116 : 122, 40 + i * 12, "th")).join("");
  s += path("M150 44 V104 Q158 122 166 104 V44", "l f0") + path("M151 78 V104 Q158 118 165 104 V78 Z", "th f1") + ln(147, 44, 169, 44, "l");
  s += path("M184 40 H230 L214 82 V112 H200 V82 Z", "l f0") + path("M190 44 L207 80 L224 44", "th");
  const nm = (x: number, a: string, b = "") => txt(x, 140, a, "tx") + (b ? txt(x, 151, b, "tx") : "");
  return s + nm(33, "beaker") + nm(72, "conical", "flask") + nm(124, "measuring", "cylinder") + nm(168, "test", "tube") + nm(208, "filter", "funnel");
})();

// ── heating apparatus ───────────────────────────────────────────────────────
const heating = (() => {
  let s = rect(30, 148, 160, 6, "l f6", 1);
  s += ln(72, 62, 52, 148, "l") + ln(148, 62, 168, 148, "l") + rect(68, 58, 84, 5, "l f6", 1) + rect(76, 52, 68, 6, "l f6", 1) + range(7).map((i) => ln(80 + i * 9, 52, 80 + i * 9, 58, "th")).join("");
  s += path("M92 18 V52 H128 V18", "l f0") + path("M93 32 H127 V51 H93 Z", "th f1");
  s += path("M110 98 Q98 80 110 62 Q122 80 110 98 Z", "l f1").replace('class="l f1"', 'class="l f1" opacity=".85"');
  s += rect(105, 98, 10, 38, "l f6", 2) + rect(100, 114, 20, 8, "l f6", 2) + ell(110, 118, 3, 2, "l f0") + rect(94, 136, 32, 12, "l f6", 3);
  return s + tag("beaker", 178, 26, 128, 32) + tag("gauze", 178, 52, 144, 55) + tag("tripod", 178, 82, 156, 90) + tag("chimney", 178, 104, 116, 106) + tag("air hole", 178, 122, 121, 118) + tag("flame", 66, 82, 100, 82, "r") + tag("heatproof mat", 6, 166, 44, 151, "l") + tag("Bunsen burner", 236, 166, 126, 144, "r");
})();

// ── meniscus ────────────────────────────────────────────────────────────────
const meniscus = (() => {
  let s = rect(90, 14, 40, 126, "l f0", 3) + path("M91 58 Q110 76 129 58 V138 H91 Z", "th f1") + path("M91 58 Q110 76 129 58", "l") + range(6).map((i) => ln(90, 30 + i * 18, 100, 30 + i * 18, "th")).join("");
  s += ln(58, 67, 124, 67, "h") + ell(40, 67, 12, 7, "l f0") + circ(42, 67, 3, "l f5") + arrow(150, 100, 118, 68, "ar", 6);
  return s + txt(30, 88, "eye level", "tx") + txt(150, 112, "meniscus", "ts tl") + txt(148, 124, "read the bottom", "tx tl") + txt(148, 135, "of the curve", "tx tl") + txt(100, 158, "measuring cylinder", "tx tm").replace('x="100"', 'x="110"');
})();

// ── titration ───────────────────────────────────────────────────────────────
const titration = (() => {
  let s = ln(40, 150, 40, 8, "l").replace('class="l"', 'class="l" stroke-width="4"') + rect(20, 150, 150, 6, "l f6", 2) + ln(40, 22, 100, 22, "l").replace('class="l"', 'class="l" stroke-width="3"');
  s += rect(100, 10, 14, 64, "l f0", 2) + rect(101, 26, 12, 47, "th f1") + rect(96, 74, 22, 6, "l f3", 2) + ln(107, 80, 107, 90, "l") + circ(107, 96, 2.4, "th2 f1");
  s += rect(72, 144, 70, 6, "l f0", 1) + rect(101, 100, 12, 12, "l f0", 1) + path("M101 112 L82 144 H132 L113 112 Z", "l f0") + path("M90 130 H124 L132 144 H82 Z", "th f4");
  return s + tag("burette", 166, 26, 114, 34) + tag("tap", 166, 52, 118, 77) + tag("conical flask", 156, 112, 122, 126) + tag("white tile", 166, 138, 142, 147) + txt(120, 165, "solution is added a drop at a time", "tt tm") + txt(120, 174, "until the indicator changes colour", "tt tm");
})();

// ── soluble and insoluble ───────────────────────────────────────────────────
const dissolving = (() => {
  let s = "";
  const beaker = (x: number) => path(`M${x} 30 V108 Q${x} 116 ${x + 8} 116 H${x + 78} Q${x + 86} 116 ${x + 86} 108 V30`, "l f0") + path(`M${x + 1} 52 H${x + 85} V108 Q${x + 85} 115 ${x + 78} 115 H${x + 8} Q${x + 1} 115 ${x + 1} 108 Z`, "th f1");
  s += beaker(12) + beaker(140);
  [[30, 66], [50, 74], [70, 64], [86, 84], [40, 94], [62, 100], [24, 84], [78, 104], [56, 82], [34, 106]].forEach((p) => { s += circ(p[0], p[1], 2.8, "th2 f5"); });
  [[156, 106], [166, 108], [178, 106], [190, 108], [200, 106], [172, 100], [186, 102], [206, 100], [160, 100]].forEach((p) => { s += circ(p[0], p[1], 3, "th2 f3"); });
  return s + txt(55, 22, "soluble", "ts") + txt(183, 22, "insoluble", "ts") + txt(55, 132, "dissolves: a clear", "tx") + txt(55, 143, "solution forms", "tx") + txt(183, 132, "does not dissolve:", "tx") + txt(183, 143, "settles at the bottom", "tx") + txt(120, 163, "a solute dissolves in a solvent", "tx tm");
})();

// ── filtration ──────────────────────────────────────────────────────────────
const filtration = (() => {
  let s = path("M76 30 H144 L122 80 V96 H98 V80 Z", "l f0") + path("M84 32 L110 78 L136 32", "l").replace('class="l"', 'class="l" stroke-width="1.6"');
  s += [[102, 70], [108, 72], [114, 70], [106, 66], [112, 66], [110, 62]].map((p) => circ(p[0], p[1], 2.4, "th2 f3")).join("");
  s += path("M88 132 H132 L146 156 H74 Z", "l f0") + path("M84 140 H136 L146 156 H74 Z", "th f1") + rect(104, 96, 12, 34, "th f0").replace("th f0", "th f0");
  s += [0, 1, 2].map((i) => circ(110, 104 + i * 9, 1.8, "th2 f1")).join("");
  s += arrow(182, 20, 130, 26, "a", 6);
  return s + tag("filter paper", 20, 36, 90, 46, "l") + tag("residue", 20, 84, 104, 68, "l") + tag("filtrate", 158, 132, 128, 146) + txt(236, 12, "mixture poured in", "tx te") + txt(20, 60, "(stays behind)", "tx tl tm") + txt(158, 143, "(passes through)", "tx tl tm") + txt(20, 166, "funnel", "tx tl tm").replace("funnel", "");
})();

// ── distillation ────────────────────────────────────────────────────────────
const distillation = (() => {
  let s = "";
  const a = 25.2, x0 = 84, y0 = 64, L = 113;
  s += circ(44, 104, 24, "l f0") + path("M21 104 A24 24 0 0 0 67 104 Z", "th f1") + rect(38, 56, 12, 26, "l f0", 1) + rect(35, 52, 18, 5, "l f6", 1) + rect(43, 28, 3, 52, "l f6", 1) + circ(44.5, 66, 2.6, "th2 fr");
  s += ln(50, 64, x0, y0, "l");
  s += `<g transform="translate(${x0} ${y0}) rotate(${a})">` + rect(0, -8, L, 16, "l f1", 2) + ln(-2, 0, L + 4, 0, "l") + `</g>`;
  s += arrow(176, 134, 176, 120, "a", 5) + arrow(95, 56, 95, 42, "a", 5);
  s += circ(190, 122, 1.8, "th2 f1") + path("M176 128 V158 H232 V128", "l f0") + path("M177 146 H231 V158 H177 Z", "th f1"); // (image QA: beaker bottom at 158 so the "distillate" label below it is clear)
  s += path("M44 126 Q36 138 44 148 Q52 138 44 126 Z", "l f3").replace('class="l f3"', 'class="l f3" opacity=".9"');
  return s + tag("thermometer", 60, 14, 45, 30, "l") + tag("water out", 104, 44, 96, 44, "l") + tag("condenser", 160, 76, 150, 92, "l") + tag("cold water in", 160, 142, 176, 134, "r") + txt(204, 167, "distillate", "tx") + tag("flask", 4, 148, 22, 114, "l") + txt(60, 152, "heat", "tx tl");
})();

// ── crystallisation ─────────────────────────────────────────────────────────
const crystallisation = (() => {
  let s = "";
  const basin = (x: number, fill: string) => path(`M${x} 70 Q${x + 40} 122 ${x + 80} 70 Z`, `l ${fill}`);
  s += basin(14, "f1") + basin(148, "f0");
  s += [[178, 100], [186, 96], [194, 100], [204, 94], [168, 92], [212, 88]].map((p) => rect(p[0] - 3, p[1] - 3, 6, 6, "th2 f0")).join("");
  s += path("M54 140 Q44 126 54 112 Q64 126 54 140 Z", "l f3");
  s += [0, 1, 2].map((i) => path(`M${30 + i * 20} 62 q6 -8 0 -16 q-6 -8 0 -16`, "th")).join("");
  s += arrow(108, 90, 140, 90, "l", 6);
  return s + txt(54, 16, "heat gently", "tx") + txt(188, 16, "leave to cool", "tx") + txt(54, 156, "water evaporates", "tx") + txt(188, 156, "crystals form", "tx") + txt(120, 168, "evaporating basin", "tx tm");
})();

// ── paper chromatography ────────────────────────────────────────────────────
const chromatography = (() => {
  let s = rect(90, 20, 90, 116, "l f0", 1) + rect(60, 92, 150, 50, "l f0", 4) + rect(61, 118, 148, 23, "th f1");
  s += ln(90, 112, 180, 112, "th2").replace("th2", "h") + ln(90, 32, 180, 32, "h");
  const sp = (x: number, ys: number[], c: string[]) => ys.map((y, i) => circ(x, y, 3.6, `th2 ${c[i]}`)).join("");
  s += sp(108, [104], ["f4"]) + sp(135, [80, 62], ["f5", "f3"]) + sp(162, [88, 70, 46], ["f1", "f4", "f2"]);
  s += [108, 135, 162].map((x) => circ(x, 110, 2, "th2 f6")).join("");
  // (image QA: "pencil baseline" on two lines left of the beaker wall at x = 60, leader from the text to the baseline)
  return s + tag("solvent front", 84, 32, 90, 32, "r") + txt(56, 106, "pencil", "tx te") + txt(56, 117, "baseline", "tx te") + ln(57, 110, 90, 112, "th") + dot(90, 112, 1.8, "dot") + tag("solvent", 54, 150, 100, 132, "r") + tag("spots", 190, 62, 166, 62) + txt(120, 12, "spots separate as the solvent soaks up", "tx tm") + txt(190, 158, "Rf = distance moved by spot", "tt tm te").replace('x="190"', 'x="236"') + txt(236, 167, "÷ distance moved by solvent", "tt tm te");
})();

// ── protons, neutrons and electrons ─────────────────────────────────────────
const nucleusDots = (cx: number, cy: number, p: number, n: number, r = 4.8) => {
  let s = "";
  const pos: [number, number][] = [[0, 0]];
  for (let ring = 1; pos.length < p + n; ring++) { const k = ring * 6; for (let i = 0; i < k && pos.length < p + n; i++) { const a = (i / k) * Math.PI * 2 + ring * 0.4; pos.push([Math.cos(a) * ring * r * 1.9, Math.sin(a) * ring * r * 1.9]); } }
  pos.forEach((q, i) => { const isP = i % 2 === 0 ? i / 2 < p : (i - 1) / 2 + Math.ceil(p / 2 + 0) < p + n && false; void isP; });
  const order = pos.map((q, i) => ({ q, i })).sort((a, b) => Math.hypot(a.q[0], a.q[1]) - Math.hypot(b.q[0], b.q[1]));
  let pc = 0, nc = 0;
  order.forEach(({ q }, k) => { const wantP = pc < p && (nc >= n || k % 2 === 0); if (wantP) { pc++; s += circ(cx + q[0], cy + q[1], r, "th2 f4"); } else { nc++; s += circ(cx + q[0], cy + q[1], r, "th2 f6"); } });
  return s;
};
const subatomic = (() => {
  let s = circ(60, 84, 44, "th f0") + nucleusDots(60, 84, 2, 2, 5.2) + circ(104, 84, 4, "th2 fs"); // 2 protons + 2 electrons: a neutral atom (helium)
  s += circ(22, 84, 4, "th2 fs");
  const row = (y: number, cls: string, sym: string, a: string, b: string) => circ(146, y, 7, `th2 ${cls}`) + txt(146, y + 3.5, sym, "tx") + txt(160, y - 2, a, "ts tl") + txt(160, y + 10, b, "tx tl tm");
  return s + row(34, "f4", "+", "proton", "positive charge") + row(70, "f6", "n", "neutron", "no charge") + row(106, "fs", "−", "electron", "negative charge")
    + txt(120, 146, "protons and neutrons are in the nucleus;", "tx") + txt(120, 158, "electrons are in shells around it", "tx") + txt(60, 20, "atom", "ts");
})();

// ── atomic number and mass number ───────────────────────────────────────────
const nuclide = (() => {
  return txt(84, 72, "A", "tb").replace("tb", "tb") + txt(84, 108, "Z", "tb") + txt(112, 92, "X", "tb").replace("tb", "tb") + ln(70, 120, 130, 120, "l").replace('class="l"', 'class="l" opacity="0"')
    + ln(96, 56, 96, 116, "th") + tag("mass number (A)", 148, 40, 90, 66) + tag("atomic number (Z)", 148, 130, 90, 104) + tag("element symbol (X)", 140, 86, 118, 88)
    + txt(30, 152, "mass number = protons + neutrons", "tx tl") + txt(30, 164, "atomic number = number of protons", "tx tl");
})();

// ── isotopes ────────────────────────────────────────────────────────────────
const isotopes = (() => {
  return nucleusDots(60, 62, 6, 6, 5) + nucleusDots(180, 62, 6, 8, 5) + txt(60, 110, "carbon-12", "ts") + txt(180, 110, "carbon-14", "ts") + txt(60, 124, "6 protons, 6 neutrons", "tx") + txt(180, 124, "6 protons, 8 neutrons", "tx")
    + txt(120, 150, "same protons, different neutrons", "tx tm") + circ(20, 158, 4, "th2 f4") + txt(28, 161, "proton", "tx tl") + circ(70, 158, 4, "th2 f6") + txt(78, 161, "neutron", "tx tl");
})();

// ── electronic structures of the first 20 elements ──────────────────────────
type El = [string, string, number[], string];
const ELEMENTS: El[] = [["hydrogen", "H", [1], "1"], ["helium", "He", [2], "2"], ["lithium", "Li", [2, 1], "3"], ["beryllium", "Be", [2, 2], "4"], ["boron", "B", [2, 3], "5"], ["carbon", "C", [2, 4], "6"], ["nitrogen", "N", [2, 5], "7"], ["oxygen", "O", [2, 6], "8"], ["fluorine", "F", [2, 7], "9"], ["neon", "Ne", [2, 8], "10"],
  ["sodium", "Na", [2, 8, 1], "11"], ["magnesium", "Mg", [2, 8, 2], "12"], ["aluminium", "Al", [2, 8, 3], "13"], ["silicon", "Si", [2, 8, 4], "14"], ["phosphorus", "P", [2, 8, 5], "15"], ["sulfur", "S", [2, 8, 6], "16"], ["chlorine", "Cl", [2, 8, 7], "17"], ["argon", "Ar", [2, 8, 8], "18"], ["potassium", "K", [2, 8, 8, 1], "19"], ["calcium", "Ca", [2, 8, 8, 2], "20"]];
export const ELEMENT_NAMES = ELEMENTS.map((e) => e[0]);
/** shells of an atom: one circle per shell, electrons spread evenly, nucleus labelled with the symbol */
export const shellAtom = (cx: number, cy: number, cfg: number[], sym: string, r0 = 12, dr = 15, er = 2.8, extra: Record<string, string> = {}) => {
  let s = "";
  for (let i = cfg.length - 1; i >= 0; i--) s += circ(cx, cy, r0 + dr * (i + 1), "th f0"); // outermost first: a filled outer ring drawn last would hide every inner shell
  s += circ(cx, cy, r0, "l f4") + txt(cx, cy + 3.5, sym, "tx");
  cfg.forEach((n, i) => { const r = r0 + dr * (i + 1); for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 - Math.PI / 2 + (i % 2) * 0.3; s += circ(cx + r * Math.cos(a), cy + r * Math.sin(a), er, `th2 ${extra[`${i}-${k}`] ?? "fs"}`); } });
  return s;
};
const elementPic = (name: string, sym: string, cfg: number[], z: string): Pic => {
  const body = shellAtom(120, 82, cfg, sym, 12, cfg.length > 3 ? 12 : 15) /* 4 shells: tighter rings so the outer electrons stay clear of the name */ + txt(120, 158, `${name} atom`, "ts") + txt(120, 14, "", "tx");
  const shells = cfg.length === 1 ? "one shell" : `${cfg.length} shells`;
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return mk(`x3-atom-${name}`, `${cap} atom`, [`${name} atom`, `${name} atoms`, `electronic structure of ${name}`, `electronic configuration of ${name}`, `electron configuration of ${name}`, `${name} electronic structure`, `${name} electron configuration`],
    body, `A ${name} atom drawn with its nucleus in the middle (labelled ${sym}) and its electrons on ${shells}: the electron arrangement is ${cfg.join(",")}.`, `${cap} atom`,
    `${cap} has atomic number ${z}, so ${z} electrons, arranged ${cfg.join(",")} (first shell holds up to 2, then 8, then 8; Oak KS4 'electronic structure'). Drawn as shells with the electrons spread evenly; the nucleus is labelled with the symbol, not to scale.`,
    { requires: ["atom", "atoms", "electron", "electrons", "electronic", "shell", "shells", "structure"], avoid: [`${name} ion`, `${name} ions`, `${name} chloride`, `${name} oxide`, `${name} hydroxide`, `${name} sulfate`, `${name} carbonate`, `${name} nitrate`, "isotope", "isotopes", "ionic", "ionic bond"], doesNotShow: "protons and neutrons in the nucleus; ions; bonding; the real size of the atom" });
};

// ── ionic bonding (sodium chloride) ─────────────────────────────────────────
const ionic = (() => {
  let s = shellAtom(52, 40, [2, 8, 1], "Na", 6, 7.5, 1.8, { "2-0": "fr" }) + shellAtom(188, 40, [2, 8, 7], "Cl", 6, 7.5, 1.8);
  s += arrow(88, 44, 154, 44, "ar", 6) + txt(120, 34, "electron moves", "tx tr");
  s += shellAtom(52, 122, [2, 8], "Na", 6, 7.5, 1.8) + shellAtom(188, 122, [2, 8, 8], "Cl", 6, 7.5, 1.8, { "2-7": "fr" });
  s += `<path d="M28 98 h-5 v48 h5" class="th2"/><path d="M76 98 h5 v48 h-5" class="th2"/><path d="M158 92 h-5 v60 h5" class="th2"/><path d="M218 92 h5 v60 h-5" class="th2"/>`;
  return s + txt(52, 80, "sodium atom", "tx") + txt(188, 80, "chlorine atom", "tx") + txt(92, 100, "+", "tb") + txt(226, 98, "−", "tb") + txt(52, 165, "sodium ion", "tx") + txt(188, 165, "chloride ion", "tx") + txt(120, 116, "opposite", "tt tm") + txt(120, 125, "charges", "tt tm") + txt(120, 134, "attract", "tt tm");
})();

// ── ionic lattice ───────────────────────────────────────────────────────────
const lattice = (() => {
  let s = "";
  const n = 4, sp = 32, x0 = 32, y0 = 20; // (image QA: bottom row at y = 116 + 11 = 127, clear of the caption lines at 150 / 162)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i < n - 1) s += ln(x0 + i * sp, y0 + j * sp, x0 + (i + 1) * sp, y0 + j * sp, "th"); if (j < n - 1) s += ln(x0 + i * sp, y0 + j * sp, x0 + i * sp, y0 + (j + 1) * sp, "th"); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const pos = (i + j) % 2 === 0; s += circ(x0 + i * sp, y0 + j * sp, pos ? 8 : 11, `l ${pos ? "f1" : "f2"}`) + txt(x0 + i * sp, y0 + j * sp + 4, pos ? "+" : "−", "tx"); }
  return s + txt(176, 40, "+ positive", "tx tl") + txt(176, 52, "ion", "tx tl") + txt(176, 84, "− negative", "tx tl") + txt(176, 96, "ion", "tx tl") + txt(120, 150, "each ion is held by strong attractions", "tx") + txt(120, 162, "to the oppositely charged ions around it", "tx");
})();

// ── covalent bonds ──────────────────────────────────────────────────────────
const covalent = (() => {
  let s = "";
  const dc = (x: number, y: number, k: number) => (k ? circ(x, y, 2.4, "th2 fs") : circ(x, y, 2.4, "th2 fr"));
  s += circ(38, 50, 22, "th f0") + circ(66, 50, 22, "th f0") + dc(52, 44, 1) + dc(52, 56, 0) + txt(52, 20, "H", "tx").replace("H", "H     H").replace('x="52"', 'x="52"') + txt(52, 90, "hydrogen molecule", "tx");
  s += circ(170, 54, 22, "th f0") + circ(150, 92, 16, "th f0").replace("150", "142") + circ(198, 92, 16, "th f0").replace("198", "198");
  s += txt(170, 58, "O", "tx") + txt(142, 96, "H", "tx") + txt(198, 96, "H", "tx");
  s += dc(154, 72, 1) + dc(150, 78, 0) + dc(186, 72, 1) + dc(190, 78, 0) + dc(160, 34, 1).replace('fs', 'fs') + dc(166, 30, 1) + dc(180, 30, 1) + dc(186, 34, 1);
  return s + txt(170, 128, "water molecule", "tx") + txt(120, 148, "a covalent bond is a shared", "tx") + txt(120, 159, "pair of electrons", "tx") + txt(120, 167, "(dots and crosses; outer shells only)", "tt tm");
})();

// ── diamond and graphite ────────────────────────────────────────────────────
const carbonForms = (() => {
  let s = "";
  s += [[-22, -22], [22, -22], [-22, 22], [22, 22]].map((d) => ln(60, 60, 60 + d[0], 60 + d[1], "l") + circ(60 + d[0], 60 + d[1], 5, "l f6") + [[-10, -6], [8, -10], [10, 10]].map((e) => ln(60 + d[0], 60 + d[1], 60 + d[0] + (d[0] < 0 ? -1 : 1) * Math.abs(e[0]) * 1.3, 60 + d[1] + (d[1] < 0 ? -1 : 1) * Math.abs(e[1]) * 1.3, "th")).join("")).join("") + circ(60, 60, 6, "l f6");
  const hex = (cx: number, cy: number) => { let p = ""; for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * Math.PI / 180; p += `${(cx + 14 * Math.cos(a)).toFixed(1)},${(cy + 8 * Math.sin(a)).toFixed(1)} `; } return `<polygon points="${p.trim()}" class="l f0" stroke-width="1.6"/>`; };
  // (image QA: the two layers are 34 apart so the "weak forces" label (on surface-coloured plates) sits between them without touching a hexagon)
  [[170, 28], [198, 28], [184, 44], [156, 44], [212, 44]].forEach((h) => { s += hex(h[0], h[1]); });
  [[170, 94], [198, 94], [184, 110], [156, 110], [212, 110]].forEach((h) => { s += hex(h[0], h[1]); });
  s += [0, 1, 2].map((i) => ln(170 + i * 14, 52, 170 + i * 14, 86, "h")).join("");
  return s + txt(60, 108, "diamond", "ts") + txt(60, 122, "each carbon atom is bonded", "tt") + txt(60, 132, "to four others", "tt") + txt(184, 132, "graphite", "ts") + txt(176, 144, "layers of hexagons; each atom", "tt") + txt(176, 154, "is bonded to three others", "tt") + plate(184, 67, "weak forces", "tt tm") + plate(184, 77, "between layers", "tt tm");
})();

// ── metallic bonding ────────────────────────────────────────────────────────
const metallic = (() => {
  let s = "";
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) s += circ(40 + i * 40, 30 + j * 30, 10, "l f1") + txt(40 + i * 40, 34 + j * 30, "+", "tx");
  [[60, 46], [100, 44], [140, 48], [180, 46], [80, 76], [120, 78], [160, 74], [200, 76], [60, 106], [100, 104], [140, 108], [180, 106], [80, 136], [120, 138], [160, 134], [40, 76], [200, 46], [60, 136]].forEach((p) => { s += circ(p[0], p[1], 2.4, "th2 fr"); });
  return s + txt(120, 160, "positive metal ions in a regular pattern, surrounded by", "tt tm") + txt(120, 168, "delocalised electrons (red dots) that are free to move", "tt tm");
})();

export const CHEM1: Pic[] = [
  mk("x3-glassware", "Laboratory glassware", ["apparatus", "laboratory apparatus", "lab equipment", "laboratory equipment", "beaker", "beakers", "conical flask", "conical flasks", "measuring cylinder", "measuring cylinders", "test tube", "test tubes", "filter funnel", "laboratory glassware", "glassware"], glassware, "Five pieces of laboratory glassware, each named: a beaker, a conical flask, a measuring cylinder, a test tube and a filter funnel.", "Laboratory glassware", "Standard glassware: beaker (straight sides, spout), conical flask (narrow neck), measuring cylinder (tall, graduated), test tube, filter funnel (Oak KS2/KS3 'apparatus').", { doesNotShow: "heating equipment, balances or thermometers; sizes or volumes" }),
  mk("x3-heating-apparatus", "Heating apparatus", ["bunsen burner", "bunsen burners", "bunsen", "tripod", "gauze", "heatproof mat"], heating, "A Bunsen burner on a heatproof mat with a tripod above it, a gauze on the tripod and a beaker on the gauze; the flame heats the beaker. The chimney and air hole of the burner are labelled.", "Heating a beaker with a Bunsen burner", "Bunsen burner: chimney, air hole, base on a heatproof mat; tripod and gauze hold the beaker over the flame (Oak KS3/KS4 'Bunsen burner').", { avoid: ["safety flame", "yellow flame", "blue flame", "roaring flame"], doesNotShow: "which flame colour is which; the gas tap and tube; safety rules" }),
  mk("x3-meniscus", "Reading a meniscus", ["meniscus"], meniscus, "A measuring cylinder with a curved liquid surface called the meniscus; an eye at the same level looks at the bottom of the curve to read the volume.", "Reading a meniscus", "Meniscus: the curved surface of a liquid in a narrow tube; read the volume at the bottom of the curve with your eye level with it (Oak KS4 'meniscus').", { doesNotShow: "any volume reading; mercury (which curves the other way)" }),
  mk("x3-titration", "Titration apparatus", ["titration", "titrations", "burette", "burettes", "titre"], titration, "Titration apparatus: a burette held on a stand above a conical flask on a white tile; solution is added a drop at a time from the burette until the indicator in the flask changes colour.", "Titration apparatus", "Titration: burette with a tap above a conical flask on a white tile; solution is added a drop at a time to the flask until the indicator changes colour at the end point (Oak KS4 'titration').", { h: 178, doesNotShow: "which solution is in the burette; volumes; the calculation" }),
  mk("x3-dissolving", "Soluble and insoluble", ["soluble", "insoluble", "dissolve", "dissolves", "dissolving", "dissolved", "solute", "solutes", "solvent", "solvents"], dissolving, "Two beakers of water: in the left one a soluble substance has dissolved to make a clear solution with its particles spread through the water; in the right one an insoluble substance has not dissolved and has settled at the bottom.", "Soluble and insoluble substances", "A solute that is soluble dissolves in a solvent to make a solution; an insoluble substance does not dissolve and stays as solid (Oak KS2/KS3 'dissolving').", { requires: ["dissolve", "dissolves", "dissolving", "dissolved", "soluble", "insoluble", "solute", "solvent"], avoid: ["solution to", "the solution of", "=solve", "problem", "equation", "solar", "saturated", "solubility curve", "solubility", "concentration", "=mole", "=moles", "titration", "indicator", "osmosis", "exchange surface", "crystallis", "acid", "alkali", "electrolysis", "aqueous", "precipitate", "ionic"], doesNotShow: "saturated solutions, how much dissolves or temperature effects; solvents other than water" }),
  mk("x3-filtration", "Filtration", ["filtration", "filtrate", "filter paper", "residue"], filtration, "Filtration: a mixture is poured into a funnel lined with filter paper; the solid residue stays behind in the paper and the liquid filtrate passes through into the flask below.", "Filtration", "Filtration separates an insoluble solid from a liquid: the solid (residue) stays in the filter paper; the liquid (filtrate) passes through (Oak KS2-KS4 'filtration').", { requires: ["filter", "filtration", "filtrate", "filter paper", "funnel", "mixture"], avoid: ["water filter", "air filter", "oil filter", "colour filter", "light filter", "sunglasses", "kidney"], doesNotShow: "the stand or the beaker; the dissolved substances (which pass through)" }),
  mk("x3-distillation", "Simple distillation", ["simple distillation", "distillation", "distilled", "distillate", "condenser", "condensers", "condensing tube"], distillation, "Simple distillation: a flask of solution is heated with a thermometer in its neck; the vapour goes into a sloping condenser cooled by water entering at the bottom and leaving at the top, and the pure liquid distillate drips into a beaker.", "Simple distillation", "Simple distillation: heat the solution, the liquid with the lower boiling point evaporates, condenses in the water-cooled condenser (cold water in at the bottom, out at the top) and is collected as distillate (Oak KS3/KS4 'distillation').", { avoid: ["fractional distillation", "fractional", "fractionating", "fractions", "crude oil", "petroleum", "hydrocarbon"], doesNotShow: "the thermometer reading; fractional distillation; the stand and clamps" }),
  mk("x3-crystallisation", "Crystallisation", ["crystallisation", "crystallization", "crystallise", "crystals", "evaporating basin", "evaporating dish"], crystallisation, "Crystallisation in two steps: a solution is heated gently in an evaporating basin so the water evaporates; then the concentrated solution is left to cool and crystals form.", "Crystallisation", "Crystallisation: heat a solution gently so some water evaporates, then leave it to cool and crystals form (Oak KS3/KS4 'crystallisation').", { avoid: ["crystal structure", "quartz", "igneous", "magma", "liquid crystal", "ice crystals"], doesNotShow: "the solid being filtered off; the type of crystal; exact heating times" }),
  mk("x3-chromatography", "Paper chromatography", ["chromatography", "paper chromatography", "chromatogram", "solvent front", "rf value", "rf values"], chromatography, "Paper chromatography: a strip of paper with a pencil baseline and spots of samples stands in a shallow solvent; the solvent soaks up the paper and the spots separate at different heights; the solvent front marks how far it travelled. Rf is the distance moved by the spot divided by the distance moved by the solvent.", "Paper chromatography", "Chromatography: samples spotted on a pencil baseline, solvent below the line; substances separate as the solvent soaks up; Rf = distance moved by the substance / distance moved by the solvent (Oak KS3/KS4 'chromatography').", { avoid: ["gas chromatography", "column chromatography", "mass spectrometry", "gc-ms"], doesNotShow: "the identity of the spots; a numerical Rf value; other types of chromatography" }),
  mk("x3-subatomic", "Protons, neutrons and electrons", ["subatomic particle", "subatomic particles", "proton", "protons", "neutron", "neutrons"], subatomic, "An atom with a tiny nucleus of protons and neutrons in the centre and electrons around it, with a key: proton has a positive charge, neutron has no charge, electron has a negative charge.", "Protons, neutrons and electrons", "Proton: positive charge, in the nucleus; neutron: no charge, in the nucleus; electron: negative charge, in shells around the nucleus (Oak KS3/KS4 'subatomic particles').", { requires: ["atom", "atoms", "atomic", "nucleus", "electron", "electrons", "subatomic", "charge"], avoid: ["proton pump", "proton number", "neutron star", "neutron star", "isotope", "isotopes", "nuclear", "fission", "fusion", "alpha", "beta"], doesNotShow: "relative masses as numbers; quarks; the number of each particle in a real atom" }),
  mk("x3-atomic-number", "Atomic number and mass number", ["atomic number", "atomic numbers", "mass number", "mass numbers", "proton number", "nucleon number"], nuclide, "A nuclide symbol: the element symbol X with the mass number A written above and to the left and the atomic number Z below it. The mass number is the number of protons plus neutrons; the atomic number is the number of protons.", "Atomic number and mass number", "In nuclide notation the top number is the mass number (protons + neutrons) and the bottom number is the atomic number (protons) (Oak KS3/KS4 'atomic number', 'mass number').", { avoid: ["relative atomic mass", "relative formula mass", "isotope", "isotopes", "atomic number of", "electron shell"], doesNotShow: "a real element or real numbers; isotopes" }),
  mk("x3-isotopes", "Isotopes", ["isotope", "isotopes"], isotopes, "Two isotopes of carbon: carbon-12 with 6 protons and 6 neutrons and carbon-14 with 6 protons and 8 neutrons; isotopes have the same number of protons but different numbers of neutrons.", "Isotopes of carbon", "Isotopes are atoms of the same element (same number of protons) with different numbers of neutrons: carbon-12 has 6 protons and 6 neutrons, carbon-14 has 6 protons and 8 neutrons (Oak KS4 'isotopes').", { numeric: true, avoid: ["radioactive", "half life", "half-life", "decay", "relative atomic mass"], doesNotShow: "other elements; the relative abundance of isotopes; radioactive decay" }),
  mk("x3-ionic-bonding", "Ionic bonding in sodium chloride", ["ionic bonding", "ionic bond", "ionic bonds", "ionic compound", "ionic compounds", "sodium chloride", "ion formation"], ionic, "Ionic bonding in sodium chloride: a sodium atom gives one electron to a chlorine atom; the sodium becomes a positive ion and the chlorine becomes a negative chloride ion, and the oppositely charged ions attract each other.", "Ionic bonding: sodium chloride", "Na (2,8,1) loses one electron to become Na+ (2,8); Cl (2,8,7) gains one to become Cl- (2,8,8); the electrostatic attraction between the ions is the ionic bond (Oak KS4 'ionic bonding').", { requires: ["ionic", "ion", "ions", "bond", "bonding", "electron", "electrons", "cation", "anion"], avoid: ["covalent", "metallic", "lattice"], doesNotShow: "the lattice; other ionic compounds; the charge of other ions" }),
  mk("x3-ionic-lattice", "Giant ionic lattice", ["ionic lattice", "giant ionic lattice", "giant ionic structure", "giant ionic", "ionic lattices"], lattice, "A giant ionic lattice: a regular grid of positive and negative ions alternating, each ion joined by strong attractions to the oppositely charged ions around it.", "A giant ionic lattice", "Giant ionic lattice: regular, repeating arrangement of alternating positive and negative ions held by strong electrostatic forces in all directions (Oak KS4 'giant ionic lattice').", { doesNotShow: "the real 3D structure or ion sizes for a particular compound; melting points" }),
  mk("x3-covalent-bond", "Covalent bonds", ["covalent bond", "covalent bonds", "covalent bonding", "covalently bonded", "shared pair", "shared pair of electrons", "dot and cross diagram", "dot-and-cross diagram", "dot and cross diagrams"], covalent, "Dot-and-cross diagrams of two simple molecules: a hydrogen molecule where two hydrogen atoms share one pair of electrons, and a water molecule where an oxygen atom shares a pair with each of two hydrogen atoms; only outer shells are drawn.", "Covalent bonds", "Covalent bond = a shared pair of electrons between non-metal atoms: H2 has one shared pair; H2O has two shared pairs (O has 6 outer electrons: two shared and two lone pairs) (Oak KS4 'covalent bond').", { avoid: ["ionic", "metallic", "giant covalent", "double bond", "carbon dioxide", "methane", "ammonia", "chlorine"], doesNotShow: "double bonds, lone pairs on oxygen; other molecules; giant covalent structures" }),
  mk("x3-carbon-forms", "Diamond and graphite", ["diamond", "graphite", "allotrope", "allotropes", "giant covalent", "giant covalent structure"], carbonForms, "Two forms of carbon: in diamond each carbon atom is bonded to four others in a rigid network; in graphite the atoms form layers of hexagons, each atom bonded to three others, with weak forces between the layers.", "Diamond and graphite", "Diamond: each C bonded to 4 others (tetrahedral); graphite: layers of hexagonal rings, each C bonded to 3 others, weak forces between layers, delocalised electrons (Oak KS4 'diamond', 'graphite', 'allotrope').", { requires: ["carbon", "allotrope", "allotropes", "covalent", "atoms", "structure"], avoid: ["baseball", "diamond shape", "rhombus", "kite", "graphene", "fullerene", "nanotube", "pencil lead"], doesNotShow: "graphene, fullerenes or nanotubes; properties; the real 3D lattice geometry" }),
  mk("x3-metallic-bonding", "Metallic bonding", ["metallic bonding", "metallic bond", "metallic bonds", "delocalised electrons", "delocalised electron", "sea of electrons"], metallic, "Metallic bonding: positive metal ions arranged in a regular pattern surrounded by delocalised electrons that are free to move.", "Metallic bonding", "Metallic bonding: a regular lattice of positive metal ions surrounded by a sea of delocalised electrons; the electrostatic attraction between them is the bond (Oak KS4 'metallic bonding').", { avoid: ["ionic bond", "covalent bond", "graphite", "graphene"], doesNotShow: "alloys; the number of electrons per atom; which metal" }),
  ...ELEMENTS.map(([n, sy, cfg, z]) => elementPic(n, sy, cfg, z)),
];
void [thick, box, plate, poly, put, dot, ell, B, G, Y, V, N, GR, R];
