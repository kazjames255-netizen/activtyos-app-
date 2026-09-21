// X3 Science extension, biology part 3: cells, genetics, classification, ecology, and body processes.
import type { Pic } from "./types";
import { mk, thick, box, plate, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, range, cycle, put } from "./ext-science-kit";

const R = "l f4", B = "l f1", G = "l f2", Y = "l f3", V = "l f5", N = "l f0", GR = "l f6";
const wave = (x0: number, x1: number, y: number, amp: number, len: number, ph = 0) => { let w = ""; for (let x = x0; x <= x1; x += 3) w += `${x},${(y + amp * Math.sin((x - x0) / len + ph)).toFixed(1)} `; return w.trim(); };

// ── bacterial cell ──────────────────────────────────────────────────────────
const bacterium = (() => {
  let s = "";
  s += rect(30, 46, 150, 70, "l f0", 34) + rect(35, 51, 140, 60, "th f1", 29);
  s += path("M70 76 C60 62 84 60 90 72 C100 84 116 62 124 74 C132 88 108 96 96 92 C82 100 72 92 70 76 Z", "l").replace('class="l"', 'class="l" stroke-width="1.8" style="fill:none"');
  s += circ(140, 84, 6, "l f5") + circ(150, 96, 5, "l f5");
  s += `<polyline points="${wave(180, 226, 82, 6, 4)}" class="l"/>`;
  return s + tag("cell wall", 20, 20, 44, 52, "l") + tag("cell membrane", 78, 20, 100, 51, "l") + tag("cytoplasm", 20, 148, 60, 104, "l") + tag("DNA loop", 96, 132, 96, 96, "l") + txt(96, 144, "(no nucleus)", "tx tl tm") + tag("plasmid", 150, 132, 148, 100, "l") + tag("flagellum", 186, 40, 206, 80, "l");
})();

// ── yeast cell ──────────────────────────────────────────────────────────────
const yeast = (() => {
  let s = "";
  s += ell(96, 92, 50, 42, "l f3") + ell(96, 92, 46, 38, "th f3") + ell(156, 56, 22, 18, "l f3");
  s += circ(84, 88, 13, "l f5") + circ(112, 108, 9, "l f0");
  return s + tag("cell wall", 196, 100, 145, 100) + tag("nucleus", 20, 30, 78, 82, "l") + tag("vacuole", 196, 128, 118, 112) + tag("cytoplasm", 20, 150, 66, 112, "l") + tag("bud (a new cell)", 150, 18, 160, 42, "l");
})();

// ── specialised cells ───────────────────────────────────────────────────────
const specialised = (() => {
  let s = "";
  const cell = (cx: number, cy: number, icon: string, name: string, job: string) => icon + txt(cx, cy + 30, name, "tx") + txt(cx, cy + 41, job, "tx tm");
  const rbc = circ(0, 0, 13, "l f4") + ell(0, 0, 5.5, 4, "th f0");
  const sperm = ell(-16, 0, 8, 5, "l f1") + `<polyline points="${wave(-8, 22, 0, 3, 4)}" class="l"/>`;
  const nerve = ell(-14, 0, 6, 5, "l f2") + ln(-8, 0, 22, 0, "l") + ln(-20, -3, -26, -9, "th2") + ln(-20, 3, -26, 9, "th2") + ln(22, 0, 28, -6, "th2") + ln(22, 0, 28, 6, "th2");
  const root = rect(-14, -14, 28, 18, "l f2", 2) + path("M-3 4 L0 22 L3 4 Z", "l f2");
  const pal = rect(-9, -16, 18, 32, "l f2", 2) + [[-3, -8], [3, -1], [-3, 6], [3, 12]].map((p) => circ(p[0], p[1], 2, "th2 fg")).join("");
  const musc = rect(-26, -8, 52, 16, "l f4", 7) + range(6).map((i) => ln(-18 + i * 7, -8, -18 + i * 7, 8, "th")).join("");
  const at = (icon: string, x: number, y: number) => `<g transform="translate(${x} ${y})">${icon}</g>`;
  s += at(rbc, 40, 30) + at(sperm, 120, 30) + at(nerve, 200, 30) + at(root, 40, 104) + at(pal, 120, 104) + at(musc, 200, 104);
  return s + cell(40, 30, "", "red blood cell", "carries oxygen") + cell(120, 30, "", "sperm cell", "fertilises egg") + cell(200, 30, "", "nerve cell", "sends impulses") + cell(40, 104, "", "root hair cell", "takes in water") + cell(120, 104, "", "palisade cell", "photosynthesis") + cell(200, 104, "", "muscle cell", "contracts");
})();

// ── mitosis ─────────────────────────────────────────────────────────────────
const mitosis = (() => {
  let s = "";
  const X = (x: number, y: number, c: string) => ln(x - 3.5, y - 5, x + 3.5, y + 5, c) + ln(x + 3.5, y - 5, x - 3.5, y + 5, c);
  const V = (x: number, y: number, c: string, h = 5) => ln(x, y - h, x, y + h, c);
  const cell = (cx: number, cy = 66, rx = 18, ry = 18) => ell(cx, cy, rx, ry, "l f0");
  const cx = [24, 70, 116, 162];
  s += cell(cx[0]) + V(cx[0] - 6, 60, "a") + V(cx[0] + 6, 60, "a") + V(cx[0] - 6, 74, "ar", 3.5) + V(cx[0] + 6, 74, "ar", 3.5);
  s += cell(cx[1]) + X(cx[1] - 6, 60, "a") + X(cx[1] + 6, 60, "a") + X(cx[1] - 6, 74, "ar") + X(cx[1] + 6, 74, "ar");
  s += cell(cx[2]) + X(cx[2] - 12, 66, "a") + X(cx[2] - 4, 66, "a") + X(cx[2] + 4, 66, "ar") + X(cx[2] + 12, 66, "ar") + ln(cx[2], 44, cx[2], 88, "h");
  s += cell(cx[3], 66, 18, 22) + [-12, -4, 4, 12].map((d, i) => V(cx[3] + d, 52, i < 2 ? "a" : "ar", 4)).join("") + [-12, -4, 4, 12].map((d, i) => V(cx[3] + d, 80, i < 2 ? "a" : "ar", 4)).join("");
  s += cell(208, 48, 15, 15) + cell(208, 88, 15, 15) + [-6, 6].map((d) => V(208 + d, 44, "a", 4) + V(208 + d, 53, "ar", 3)).join("") + [-6, 6].map((d) => V(208 + d, 84, "a", 4) + V(208 + d, 93, "ar", 3)).join("");
  [0, 1, 2].forEach((i) => { s += arrow(cx[i] + 20, 66, cx[i + 1] - 20, 66, "l", 5); });
  s += arrow(cx[3] + 20, 66, 190, 66, "l", 5);
  const lab = (x: number, a: string, b: string) => txt(x, 112, a, "tt") + txt(x, 121, b, "tt");
  return s + lab(24, "parent", "cell") + lab(70, "copy", "themselves") + lab(116, "line up in", "the middle") + lab(162, "pulled", "apart") + lab(208, "two identical", "cells")
    + txt(120, 146, "the two new cells are identical to the parent", "tx tm");
})();

// ── DNA ─────────────────────────────────────────────────────────────────────
const dna = (() => {
  let s = "", a = "", b = "";
  const X1 = (y: number) => 96 + 24 * Math.sin(((y - 10) / 70) * Math.PI * 2), X2 = (y: number) => 96 - 24 * Math.sin(((y - 10) / 70) * Math.PI * 2);
  for (let y = 12; y <= 148; y += 2) { a += `${X1(y).toFixed(1)},${y} `; b += `${X2(y).toFixed(1)},${y} `; }
  const pairs = ["A", "C", "T", "G", "C", "A", "G", "T"], col: Record<string, string> = { A: "a", T: "ao", C: "ar", G: "ag" }, mate: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
  [22, 34, 46, 58, 70, 82, 94, 106, 118, 130, 142].forEach((y, i) => { const k = pairs[i % pairs.length], x1 = X1(y), x2 = X2(y), mid = (x1 + x2) / 2; s += ln(x1, y, mid, y, col[k]) + ln(mid, y, x2, y, col[mate[k]]); });
  s += `<polyline points="${a.trim()}" class="l"/><polyline points="${b.trim()}" class="l"/>`;
  const key = (y: number, l: string, c: string, n: string) => rect(160, y - 8, 10, 10, `th2 ${c}`) + txt(175, y, `${l} = ${n}`, "tx tl");
  return s + key(28, "A", "fs", "adenine") + key(42, "T", "fo", "thymine") + key(56, "C", "fr", "cytosine") + key(70, "G", "fg", "guanine")
    + txt(160, 92, "A always pairs", "tx tl") + txt(160, 103, "with T;", "tx tl") + txt(160, 114, "C always pairs", "tx tl") + txt(160, 125, "with G", "tx tl") + txt(96, 164, "the double helix", "tx tm").replace('x="96"', 'x="96"');
})();

// ── DNA, genes and chromosomes ──────────────────────────────────────────────
const genome = (() => {
  let s = circ(34, 66, 28, "l f0") + circ(34, 66, 14, "l f5") + ln(28, 60, 40, 72, "th2") + ln(40, 60, 28, 72, "th2");
  s += arrow(66, 66, 84, 66, "l", 6) + ln(112, 30, 140, 104, "l").replace('class="l"', 'class="l" stroke-width="7"') + ln(140, 30, 112, 104, "l").replace('class="l"', 'class="l" stroke-width="7"') + circ(126, 67, 5, "l f3");
  s += arrow(150, 66, 168, 66, "l", 6);
  let a = "", b = ""; for (let y = 22; y <= 112; y += 2) { a += `${(200 + 12 * Math.sin(y / 9)).toFixed(1)},${y} `; b += `${(200 - 12 * Math.sin(y / 9)).toFixed(1)},${y} `; }
  s += `<polyline points="${a.trim()}" class="l"/><polyline points="${b.trim()}" class="l"/>` + rect(184, 50, 32, 32, "th f3").replace("th f3", "th2 f3").replace('class="th2 f3"', 'class="th2 f3" opacity=".55"');
  return s + txt(34, 108, "nucleus in", "tx") + txt(34, 119, "a cell", "tx") + txt(126, 120, "chromosome", "tx") + txt(200, 128, "DNA", "tx") + txt(200, 139, "a gene is a short", "tx tm").replace('y="139"', 'y="141"').replace('x="200"', 'x="192"') + txt(192, 152, "section of DNA", "tx tm");
})();

// ── Punnett square ──────────────────────────────────────────────────────────
const punnett = (() => {
  let s = "";
  const cw = 44, x0 = 100, y0 = 44;
  ([["BB", 0, 0], ["Bb", 1, 0], ["Bb", 0, 1], ["bb", 1, 1]] as [string, number, number][]).forEach(([g, i, j]) => { s += rect(x0 + i * cw, y0 + j * cw, cw, cw, "l f1") + txt(x0 + i * cw + cw / 2, y0 + j * cw + 27, g, "tb"); });
  s += txt(x0 + 22, y0 - 6, "B", "tb") + txt(x0 + 66, y0 - 6, "b", "tb") + txt(x0 - 12, y0 + 27, "B", "tb") + txt(x0 - 12, y0 + 71, "b", "tb");
  return s + txt(x0 + cw, 14, "gametes from one parent", "tx") + txt(4, y0 + 20, "gametes from", "tx tl") + txt(4, y0 + 31, "the other", "tx tl") + txt(4, y0 + 42, "parent", "tx tl") + txt(120, 152, "B = dominant allele, b = recessive allele", "tx") + txt(120, 165, "an example: both parents are Bb", "tx tm");
})();

// ── alleles, genotype, phenotype ────────────────────────────────────────────
const alleles = (() => {
  let s = "";
  // (image QA: the allele letters sit ABOVE their chromosomes (baseline 36, chromosomes from y = 40), not across the rounded tops)
  const pair = (cx: number, l1: string, l2: string) => rect(cx - 15, 40, 10, 50, "l f0", 5) + rect(cx + 5, 40, 10, 50, "l f0", 5) + rect(cx - 15, 58, 10, 8, "th2 f3") + rect(cx + 5, 58, 10, 8, "th2 f3") + txt(cx - 10, 36, l1, "tb") + txt(cx + 10, 36, l2, "tb");
  s += pair(40, "B", "B") + pair(120, "B", "b") + pair(200, "b", "b");
  const tri = (cx: number, a: string[], b: string[]) => a.map((t, i) => txt(cx, 104 + i * 11, t, "tx")).join("") + b.map((t, i) => txt(cx, 132 + i * 11, t, "tx tm")).join("");
  s += tri(40, ["homozygous", "dominant"], ["shows the", "dominant", "feature"]) + tri(120, ["heterozygous"], ["shows the", "dominant", "feature"]) + tri(200, ["homozygous", "recessive"], ["shows the", "recessive", "feature"]);
  return s + txt(120, 11, "B = dominant allele, b = recessive allele", "tx") + txt(120, 21, "each pair = the two copies of one gene", "tt tm");
})();

// ── natural selection ───────────────────────────────────────────────────────
const selection = (() => {
  const rows = ["There is variation in a population", "Individuals compete: some do not survive", "The best adapted survive and reproduce", "They pass on the alleles for helpful features", "Over time the population changes"];
  return rows.map((t, i) => box(8, 6 + i * 32, 224, 24, t, "l f2".replace("f2", ["f1", "f4", "f3", "f5", "f2"][i])) + (i < 4 ? arrow(120, 30 + i * 32, 120, 38 + i * 32, "l", 5) : "")).join("");
})();

// ── vertebrate groups ───────────────────────────────────────────────────────
const vertebrates = (() => {
  const rows: [string, string, string, string][] = [["🐟", "fish", "scales, gills, fins", "eggs in water"], ["🐸", "amphibians", "moist skin", "eggs in water"], ["🦎", "reptiles", "dry scaly skin", "eggs on land"], ["🐦", "birds", "feathers, wings, beak", "lay eggs"], ["🐕", "mammals", "hair or fur", "young feed on milk"]];
  return rows.map(([e, n, a, b], i) => rect(6, 6 + i * 32, 228, 28, "l f1", 6) + `<text x="24" y="${28 + i * 32}" class="t tb">${e}</text>` + txt(42, 18 + i * 32, n, "ts tl") + txt(42, 29 + i * 32, `${a}; ${b}`, "tx tl tm")).join("");
})();

// ── invertebrates ───────────────────────────────────────────────────────────
const invertebrates = (() => {
  let s = "";
  s += put(30, 48, ell(0, -10, 5, 5, "l f6") + ell(0, 1, 6, 8, "l f6") + ell(0, 16, 6, 10, "l f6") + [-1, 1].map((m) => ln(m * 5, -2, m * 16, -10, "th2") + ln(m * 6, 3, m * 18, 6, "th2") + ln(m * 6, 8, m * 16, 22, "th2") + ln(m * 2, -14, m * 8, -22, "th2")).join(""));
  s += put(90, 48, ell(0, -4, 6, 7, "l f6") + ell(0, 13, 8, 10, "l f6") + [-1, 1].map((m) => [-8, -3, 2, 7].map((y) => ln(m * 5, y, m * 20, y + (y > 0 ? 12 : -4), "th2")).join("")).join(""));
  s += put(150, 48, circ(0, -2, 13, "l f3") + circ(0, -2, 6, "th2 f3") + path("M-20 22 Q0 26 20 22 Q22 12 12 12 L-14 12 Q-22 14 -20 22 Z", "l f4") + ln(14, 12, 22, 0, "th2") + ln(18, 14, 27, 6, "th2"));
  s += `<polyline points="${wave(178, 232, 44, 6, 4)}" class="l" stroke-width="7" style="opacity:.55"/><polyline points="${wave(178, 232, 44, 6, 4)}" class="l"/>`;
  const t = (x: number, a: string, b: string, c: string, d = "") => txt(x, 96, a, "ts") + txt(x, 108, b, "tx tm") + txt(x, 119, c, "tx tm") + (d ? txt(x, 130, d, "tx tm") : "");
  return s + t(30, "insects", "6 legs", "3 body", "parts") + t(90, "spiders", "8 legs", "2 body", "parts") + t(150, "snails", "soft body", "and shell") + t(206, "worms", "long, soft", "no legs") + txt(120, 146, "animals without a backbone", "tx");
})();

// ── classification key ──────────────────────────────────────────────────────
const key = box(60, 8, 120, 26, ["a question about", "a feature"], "l f1") + box(6, 66, 76, 24, "organism A", "l f2") + box(120, 58, 114, 26, ["another question", "about a feature"], "l f1") + box(58, 116, 76, 24, "organism B", "l f2") + box(150, 116, 76, 24, "organism C", "l f2")
  + ln(90, 34, 44, 66, "l") + ln(150, 34, 176, 58, "l") + ln(150, 84, 96, 116, "l") + ln(190, 84, 188, 116, "l") + plate(58, 52, "yes", "tx tg") + plate(174, 46, "no", "tx tr") + plate(112, 100, "yes", "tx tg") + plate(196, 102, "no", "tx tr") + txt(120, 160, "each question has two answers", "tx tm");

// ── five kingdoms ───────────────────────────────────────────────────────────
const kingdoms = (() => {
  const rows: [string, string, string, string][] = [["animals", "e.g. a dog", "f4", "🐕"], ["plants", "e.g. a tree", "f2", "🌳"], ["fungi", "e.g. a mushroom", "f3", "🍄"], ["protists", "e.g. an amoeba", "f5", ""], ["prokaryotes", "e.g. bacteria", "f1", ""]];
  return rows.map(([n, e, c, em], i) => rect(6, 6 + i * 32, 228, 28, `l ${c}`, 6) + (em ? `<text x="24" y="${28 + i * 32}" class="t tb">${em}</text>` : "") + txt(42, 25 + i * 32, n, "ts tl") + txt(232, 25 + i * 32, e, "tx te tm")).join("");
})();

// ── taxonomy ────────────────────────────────────────────────────────────────
const taxonomy = (() => {
  const names = ["kingdom", "phylum", "class", "order", "family", "genus", "species"];
  return names.map((n, i) => { const w = 220 - i * 26; return rect(120 - w / 2, 6 + i * 20, w, 18, `l ${["f4", "f3", "f2", "f1", "f5", "f4", "f3"][i]}`, 4) + txt(120, 19 + i * 20, n, "tx"); }).join("") + txt(120, 160, "fewer organisms, more alike, as you go down", "tx tm");
})();

// ── pyramid of biomass ──────────────────────────────────────────────────────
const pyramid = (() => {
  const t: string[][] = [["tertiary", "consumers"], ["secondary", "consumers"], ["primary", "consumers"], ["producers"]], w = [76, 110, 144, 178];
  return t.map((n, i) => box(120 - w[i] / 2, 6 + i * 34, w[i], 32, n, `l ${["f4", "f3", "f1", "f2"][i]}`)).join("") + txt(120, 156, "biomass gets smaller at each trophic level", "tx tm");
})();

// ── carbon cycle ────────────────────────────────────────────────────────────
const carbonCycle = (() => {
  let s = box(4, 6, 232, 24, "carbon dioxide in the air", "l f0") + box(14, 80, 70, 26, "plants", "l f2") + box(150, 80, 66, 26, "animals", "l f4") + box(4, 150, 150, 26, "dead matter (decomposers)", "l f6") + box(164, 150, 72, 26, "fossil fuels", "l f3");
  s += arrow(30, 32, 30, 78, "ag", 6) + arrow(54, 78, 54, 32, "ar", 6) + txt(62, 48, "photosynthesis", "tx tl tg") + txt(62, 64, "respiration", "tx tl tr");
  s += arrow(196, 78, 196, 32, "ar", 6) + txt(190, 60, "respiration", "tx te tr");
  s += arrow(86, 93, 148, 93, "ao", 6) + plate(117, 87, "feeding", "tx");
  s += arrow(60, 108, 60, 148, "l", 6) + txt(66, 132, "death", "tx tl") + arrow(185, 108, 130, 148, "l", 6) + plate(176, 128, "death and waste", "tx");
  s += arrow(8, 148, 8, 32, "ar", 6) + txt(14, 122, "decay", "tx tl tr");
  s += arrow(228, 148, 228, 32, "ar", 6) + txt(222, 140, "burning", "tx te tr");
  return s;
})();

// ── predator and prey ───────────────────────────────────────────────────────
const predator = (() => {
  let a = "", b = "";
  for (let x = 30; x <= 220; x += 3) { a += `${x},${(74 - 34 * Math.sin(((x - 30) / 100) * Math.PI * 2)).toFixed(1)} `; b += `${x},${(84 - 22 * Math.sin(((x - 55) / 100) * Math.PI * 2)).toFixed(1)} `; }
  return arrow(24, 130, 232, 130, "l", 6) + arrow(24, 130, 24, 12, "l", 6) + `<polyline points="${a.trim()}" class="a"/><polyline points="${b.trim()}" class="ar"/>`
    + txt(126, 146, "time", "tx tm") + `<text x="12" y="70" class="t tx tm" transform="rotate(-90 12 70)">number of animals</text>` + txt(56, 24, "prey", "ts ta") + txt(180, 24, "predators", "ts tr") + txt(120, 162, "predator numbers follow prey numbers", "tx tm");
})();

// ── quadrat ─────────────────────────────────────────────────────────────────
const quadrat = (() => {
  let s = rect(8, 8, 224, 130, "l f2", 6);
  const pts: [number, number][] = [[24, 30], [50, 100], [78, 40], [96, 116], [120, 60], [144, 96], [168, 34], [200, 110], [214, 60], [40, 70], [180, 80], [66, 126], [110, 26], [150, 124], [130, 76]];
  s += pts.map((p) => circ(p[0], p[1], 3.4, "th2 f3")).join("");
  s += rect(88, 44, 60, 60, "l", 0).replace('class="l"', 'class="a" style="fill:none"') + range(2).map((i) => ln(108 + i * 20, 44, 108 + i * 20, 104, "th") + ln(88, 64 + i * 20, 148, 64 + i * 20, "th")).join("");
  return s + tag("quadrat", 200, 30, 148, 50, "r") + txt(20, 156, "a square frame used to count", "tx tl") + txt(20, 167, "the organisms in a small area", "tx tl");
})();

// ── balanced diet ───────────────────────────────────────────────────────────
const diet = (() => {
  const rows: [string, string, string][] = [["carbohydrates", "energy", "bread, pasta, rice"], ["proteins", "growth and repair", "meat, fish, beans"], ["fats", "energy store", "oils, butter"], ["vitamins, minerals", "keep you healthy", "fruit, vegetables"], ["fibre", "helps food move along", "wholegrain, vegetables"], ["water", "needed in every cell", ""]];
  return rows.map(([a, b, c], i) => rect(6, 4 + i * 27, 228, 25, `l ${["f3", "f4", "f3", "f2", "f2", "f1"][i]}`, 6) + txt(12, 21 + i * 27, a, "tx tl") + txt(112, 15 + i * 27, b, "tx tl") + (c ? txt(112, 26 + i * 27, c, "tx tl tm") : "")).join("");
})();

// ── antagonistic muscles ────────────────────────────────────────────────────
const muscles = (() => {
  let s = "";
  // bent arm (left): upper arm horizontal, forearm up
  s += rect(12, 84, 62, 8, "l f0", 3) + rect(68, 30, 8, 60, "l f0", 3) + ell(42, 76, 22, 10, "l f4").replace('rx="22" ry="10"', 'rx="17" ry="12"') + ell(42, 100, 28, 5, "l f1");
  // straight arm (right)
  s += rect(132, 84, 62, 8, "l f0", 3) + rect(188, 84, 44, 8, "l f0", 3) + ell(163, 78, 30, 5, "l f4") + ell(163, 100, 22, 10, "l f1").replace('rx="22" ry="10"', 'rx="18" ry="11"');
  return s + txt(42, 62, "biceps", "tx tr") + txt(42, 122, "triceps", "tx ta") + txt(163, 66, "biceps", "tx tr") + txt(163, 122, "triceps", "tx ta") + txt(60, 142, "biceps contracts,", "tx") + txt(60, 153, "triceps relaxes", "tx") + txt(180, 142, "triceps contracts,", "tx") + txt(180, 153, "biceps relaxes", "tx") + txt(120, 14, "a pair of antagonistic muscles", "tx tm");
})();

// ── enzyme ──────────────────────────────────────────────────────────────────
const enzymeShape = (x: number, y: number, notch = true) => `<g transform="translate(${x} ${y})">` + (notch ? path("M0 10 L14 0 L18 12 L28 12 L32 0 L46 10 L46 36 L0 36 Z", "l f5") : path("M0 10 L14 0 L20 4 L26 4 L32 0 L46 10 L46 36 L0 36 Z", "l f5")) + `</g>`;
const enzyme = (() => {
  const sub1 = (x: number, y: number) => poly([[x, y], [x + 18, y], [x + 14, y + 12], [x + 4, y + 12]], "l f3");
  let s = txt(33, 14, "substrate", "tx") + sub1(24, 20) + enzymeShape(10, 50) + txt(33, 104, "enzyme with", "tx") + txt(33, 115, "active site", "tx");
  s += arrow(60, 68, 76, 68, "l", 5);
  s += txt(120, 14, "enzyme-substrate", "tx") + txt(120, 25, "complex", "tx") + enzymeShape(97, 50) + sub1(111, 62) + txt(120, 104, "substrate fits", "tx") + txt(120, 115, "the active site", "tx");
  s += arrow(150, 68, 166, 68, "l", 5);
  s += txt(200, 14, "products", "tx") + enzymeShape(170, 50) + sub1(196, 26).replace("196", "196") + poly([[224, 62], [238, 62], [236, 74], [226, 74]], "l f3").replace("224,62 238,62 236,74 226,74", "220,56 234,56 232,68 222,68") + txt(200, 104, "enzyme is not", "tx") + txt(200, 115, "used up", "tx");
  s += ln(8, 124, 232, 124, "th") + enzymeShape(10, 130, false) + poly([[62, 138], [80, 138], [76, 150], [66, 150]], "l f3") + txt(92, 140, "denatured: the active site", "tx tl") + txt(92, 151, "has changed shape, so the", "tx tl") + txt(92, 162, "substrate no longer fits", "tx tl");
  return s;
})();

// ── diffusion ───────────────────────────────────────────────────────────────
const diffusion = (() => {
  let s = rect(8, 24, 100, 90, "l f0") + rect(132, 24, 100, 90, "l f0");
  const left: [number, number][] = [[20, 36], [32, 52], [24, 72], [40, 40], [44, 64], [28, 96], [50, 84], [58, 50], [46, 104], [64, 74], [20, 60], [58, 100]];
  const spread: [number, number][] = [[146, 38], [172, 44], [206, 36], [222, 58], [160, 62], [190, 70], [216, 88], [150, 92], [176, 100], [200, 104], [140, 76], [226, 108]];
  s += left.map((p) => circ(p[0], p[1], 4, "th2 f1")).join("") + spread.map((p) => circ(p[0], p[1], 4, "th2 f1")).join("") + arrow(112, 70, 128, 70, "l", 6);
  return s + txt(58, 18, "start", "ts") + txt(182, 18, "later", "ts") + txt(58, 130, "lots of particles", "tx") + txt(58, 141, "in one place", "tx") + txt(182, 130, "particles spread out", "tx") + txt(182, 141, "evenly", "tx") + txt(120, 160, "net movement: from high to low concentration", "tx tm");
})();

// ── osmosis ─────────────────────────────────────────────────────────────────
const osmosis = (() => {
  let s = rect(8, 24, 224, 84, "l f0") + ln(120, 24, 120, 108, "h");
  const w = (x: number, y: number) => circ(x, y, 2.6, "th2 fs");
  const sol = (x: number, y: number) => circ(x, y, 5, "th2 f5");
  [[20, 34], [34, 48], [22, 62], [46, 38], [58, 56], [30, 84], [64, 96], [20, 100], [50, 76], [84, 44], [96, 70], [82, 94], [104, 40], [108, 88], [72, 32]].forEach((p) => { s += w(p[0], p[1]); });
  [[40, 60], [80, 78]].forEach((p) => { s += sol(p[0], p[1]); });
  [[132, 34], [166, 50], [200, 40], [220, 64], [150, 84], [184, 96], [214, 100], [140, 58], [176, 72], [130, 100], [200, 80]].forEach((p) => { s += w(p[0], p[1]); });
  [[146, 46], [190, 56], [210, 90], [160, 66], [136, 84], [174, 90], [196, 34], [224, 46], [150, 100]].forEach((p) => { s += sol(p[0], p[1]); });
  s += arrow(100, 66, 140, 66, "a", 6);
  return s + txt(64, 18, "dilute solution", "tx") + txt(176, 18, "concentrated solution", "tx") + txt(120, 122, "partially permeable membrane (dashed)", "tx tm") + txt(120, 136, "water molecules (small blue) pass through;", "tx tm") + txt(120, 147, "solute molecules (big purple) are too big", "tx tm") + txt(120, 162, "water moves from dilute to concentrated", "tx");
})();

// ── active transport ────────────────────────────────────────────────────────
const active = (() => {
  let s = rect(8, 8, 224, 46, "l f0") + rect(8, 54, 224, 12, "l f6") + rect(8, 66, 224, 62, "l f3");
  s += rect(104, 54, 22, 12, "l f5", 3) + txt(134, 63, "carrier protein", "tx tl") + [[30, 40], [86, 42], [170, 30], [208, 44]].map((p) => circ(p[0], p[1], 4, "th2 fr")).join("") + [[24, 84], [50, 100], [70, 80], [40, 116], [150, 114], [176, 120], [214, 120], [86, 112], [132, 116], [168, 102]].map((p) => circ(p[0], p[1], 4, "th2 fr")).join("");
  s += arrow(115, 34, 115, 96, "ar", 7) + circ(115, 36, 4, "th2 fr");
  return s + txt(20, 24, "outside: few particles", "tx tl") + txt(186, 82, "inside the cell:", "tx") + txt(186, 93, "many particles", "tx") + txt(120, 144, "particles move from low to high concentration", "tx").replace("particles move from low to high concentration", "from low to high concentration") + txt(120, 156, "using energy from respiration", "tx tm");
})();

// ── light microscope ────────────────────────────────────────────────────────
const microscope = (() => {
  let s = rect(56, 146, 110, 12, "l f6", 3) + thick("M150 146 C176 116 176 62 138 36", "ink", 10, 0.2) + path("M150 146 C176 116 176 62 138 36", "th");
  s += rect(106, 10, 22, 10, "l f3", 2) + rect(110, 20, 14, 40, "l f6", 2) + rect(102, 60, 32, 8, "l f6", 2) + rect(106, 68, 8, 16, "l f6", 1) + rect(122, 68, 8, 12, "l f6", 1);
  s += rect(84, 104, 66, 6, "l f0", 1) + rect(104, 98, 24, 6, "th2 f1") + circ(116, 134, 8, "l f3") + ln(116, 118, 116, 110, "th2");
  s += circ(166, 92, 6, "l f0") + circ(166, 112, 3.5, "l f0");
  return s + tag("eyepiece lens", 100, 16, 106, 15, "r") + tag("objective lenses", 100, 78, 105, 76, "r") + tag("stage", 78, 108, 90, 106, "r") + tag("light source", 100, 140, 108, 136, "r") + tag("coarse focus", 170, 82, 168, 90) + tag("fine focus", 178, 120, 168, 112) + tag("arm", 190, 50, 168, 60) + tag("base", 190, 154, 160, 152);
})();

// ── levels of organisation ──────────────────────────────────────────────────
const levels = (() => {
  let s = "";
  const cx = [24, 70, 116, 162, 208];
  s += circ(cx[0], 50, 13, "l f4") + circ(cx[0] - 2, 48, 4, "th2 f5");
  s += [[-9, -8], [0, -8], [9, -8], [-9, 1], [0, 1], [9, 1], [-9, 10], [0, 10], [9, 10]].map((p) => circ(cx[1] + p[0], 50 + p[1], 4.4, "th2 f4")).join("");
  s += path(`M${cx[2] - 12} 42 C${cx[2] - 14} 26 ${cx[2] + 10} 32 ${cx[2] + 14} 48 C${cx[2] + 16} 66 ${cx[2] - 6} 72 ${cx[2] - 12} 60 Z`, "l f4");
  s += rect(cx[3] - 3, 30, 6, 16, "l f4", 3) + path(`M${cx[3] - 12} 46 C${cx[3] - 16} 34 ${cx[3] + 12} 34 ${cx[3] + 14} 50 C${cx[3] + 14} 64 ${cx[3] - 6} 66 ${cx[3] - 12} 56 Z`, "l f4") + path(`M${cx[3] - 10} 62 H${cx[3] + 12} V68 H${cx[3] - 10} V74 H${cx[3] + 12}`, "l");
  s += circ(cx[4], 30, 8, "l f6") + rect(cx[4] - 10, 40, 20, 26, "l f6", 8) + ln(cx[4] - 6, 68, cx[4] - 6, 82, "l") + ln(cx[4] + 6, 68, cx[4] + 6, 82, "l");
  [0, 1, 2, 3].forEach((i) => { s += arrow(cx[i] + 15, 52, cx[i + 1] - 15, 52, "l", 5); });
  const lab = (x: number, a: string, b = "") => txt(x, 104, a, "tx") + (b ? txt(x, 115, b, "tx") : "");
  return s + lab(24, "cell") + lab(70, "tissue") + lab(116, "organ") + lab(162, "organ", "system") + lab(208, "organism") + txt(120, 146, "each level is made of the one before", "tx tm");
})();

// ── endocrine system ────────────────────────────────────────────────────────
const endocrine = (() => {
  let s = circ(120, 22, 14, GR) + rect(106, 38, 28, 62, "l f6", 12) + thick("M104 46 L90 92", "ink", 8, 0.15) + thick("M136 46 L150 92", "ink", 8, 0.15) + thick("M113 96 L110 148", "ink", 9, 0.15) + thick("M127 96 L130 148", "ink", 9, 0.15);
  s += circ(120, 20, 4, "l f5") + ell(120, 39, 8, 3.5, "l f3") + ell(111, 66, 5, 3.5, "l f4") + ell(129, 66, 5, 3.5, "l f4") + ell(122, 76, 9, 3.5, "l f2");
  return s + tag("pituitary gland", 156, 16, 124, 20) + tag("thyroid gland", 156, 40, 128, 39) + tag("adrenal glands", 156, 62, 133, 66) + tag("pancreas", 156, 84, 130, 77) + txt(120, 160, "ovaries (women) and testes (men) also release hormones", "tt tm");
})();

// ── homeostasis feedback loop ───────────────────────────────────────────────
const homeostasis = cycle([["receptor", "detects a change"], ["coordination", "centre"], ["effector", "(muscle or gland)"], ["response:", "back to normal"]], 120, 84, 73, 50, 92, 32, 90, "l f1") /* (image QA: rx 73 keeps the side boxes inside the 240 frame) */ + txt(120, 80, "negative", "tx tm") + txt(120, 91, "feedback", "tx tm");

// ── phototropism ────────────────────────────────────────────────────────────
const photo = (() => {
  let s = ln(6, 136, 234, 136, "th") + rect(6, 136, 228, 24, "l f6", 0);
  s += [0, 1, 2].map((i) => arrow(10, 30 + i * 18, 34, 36 + i * 18, "ao", 7)).join("") + circ(14, 14, 8, "l f3");
  s += thick("M64 136 V80", "green", 6, 0.8) + path("M64 84 C54 76 50 70 50 64 C60 66 64 74 64 82 Z", "l f2");
  s += thick("M124 136 C124 100 122 80 110 62", "green", 6, 0.8) + path("M112 64 C102 60 98 54 98 48 C108 48 114 56 112 64 Z", "l f2");
  s += [[130, 92], [131, 108], [130, 122]].map((p) => dot(p[0], p[1], 2.4)).join("");
  return s + txt(120, 152, "light from one side", "tx") + txt(158, 80, "auxin builds", "tx tl") + txt(158, 91, "up on the", "tx tl") + txt(158, 102, "shaded side;", "tx tl") + txt(158, 113, "cells there", "tx tl") + txt(158, 124, "grow longer", "tx tl") + txt(44, 14, "the shoot bends towards the light", "tx tl");
})();

// ── pathogens ───────────────────────────────────────────────────────────────
const pathogens = (() => {
  let s = "";
  s += rect(14, 18, 44, 22, "l f1", 11) + `<polyline points="${wave(58, 74, 29, 3, 3)}" class="l"/>`;
  s += circ(150, 30, 10, "l f4") + range(10).map((i) => { const a = (i / 10) * Math.PI * 2; return ln(150 + 10 * Math.cos(a), 30 + 10 * Math.sin(a), 150 + 16 * Math.cos(a), 30 + 16 * Math.sin(a), "l") + circ(150 + 17.5 * Math.cos(a), 30 + 17.5 * Math.sin(a), 1.8, "th2 f4"); }).join("");
  s += path("M20 100 C40 88 50 112 70 100 C90 88 96 110 76 120", "l").replace('class="l"', 'class="l" stroke-width="2"') + path("M50 106 C60 116 56 130 66 132", "l").replace('class="l"', 'class="l" stroke-width="2"') + circ(80, 120, 5, "l f3");
  s += path("M140 92 C160 84 176 96 172 112 C168 126 148 132 138 122 C130 112 128 98 140 92 Z", "l f5") + circ(154, 108, 6, "th2 f0");
  const t = (x: number, y: number, a: string, b: string) => txt(x, y, a, "ts") + txt(x, y + 11, b, "tx tm");
  return s + t(46, 62, "bacteria", "e.g. salmonella") + t(150, 62, "viruses", "e.g. measles") + t(56, 152, "fungi", "e.g. athlete's foot") + t(154, 152, "protists", "e.g. malaria") + txt(120, 12, "", "tx");
})();

export const BIO3: Pic[] = [
  mk("x3-bacterial-cell", "Bacterial cell", ["bacterial cell", "bacterial cells", "bacterium", "bacteria", "prokaryotic cell", "prokaryotic cells", "prokaryote", "prokaryotes", "prokaryotic", "plasmid", "plasmids"], bacterium, "A bacterial cell: a rod-shaped cell with a cell wall, a cell membrane and cytoplasm; a loop of DNA and small plasmids float free in the cytoplasm because there is no nucleus; a tail-like flagellum sticks out.", "A bacterial cell", "Bacterial (prokaryotic) cell: cell wall, cell membrane, cytoplasm, circular DNA loop not in a nucleus, plasmids, sometimes a flagellum (Oak KS3/KS4 'bacteria', 'prokaryotic').", { avoid: ["bacteriophage", "virus"], doesNotShow: "a nucleus (bacteria have none); bacterial shapes other than a rod; how bacteria cause disease" }),
  mk("x3-yeast-cell", "Yeast cell", ["yeast", "yeast cell", "yeast cells"], yeast, "A yeast cell: a single oval cell with a cell wall, a nucleus, a vacuole and cytoplasm, and a small bud growing on the side that will become a new cell.", "A yeast cell", "Yeast is a single-celled fungus: cell wall, nucleus, vacuole, cytoplasm; it reproduces by budding (Oak KS3/KS4 'yeast').", { doesNotShow: "fermentation; other fungi such as mushrooms" }),
  mk("x3-specialised-cells", "Specialised cells", ["specialised cell", "specialised cells", "cell specialisation", "differentiation", "specialisation"], specialised, "Six specialised cells each with its job: red blood cell carries oxygen, sperm cell swims to the egg, nerve cell carries impulses, root hair cell takes in water, palisade cell does photosynthesis, muscle cell contracts.", "Specialised cells and their jobs", "Specialised cells are adapted to their function: red blood cell (oxygen), sperm (fertilisation), nerve cell (impulses), root hair cell (water uptake), palisade cell (photosynthesis), muscle cell (contraction) (Oak KS3/KS4 'specialised cells').", { doesNotShow: "the structural adaptations of each cell in detail; stem cells" }),
  mk("x3-mitosis", "Mitosis", ["mitosis", "mitotic", "cell division"], mitosis, "Mitosis in five steps: a parent cell, the chromosomes copy themselves, they line up in the middle, they are pulled apart to opposite ends, and two identical cells form.", "Mitosis", "Mitosis: chromosomes are copied, line up, the copies are pulled apart and the cell divides into two genetically identical cells (Oak KS3/KS4 'mitosis'). Four chromosomes are drawn only as an example.", { avoid: ["meiosis", "binary fission", "gamete", "gametes", "sex cell", "cell cycle", "cancer", "tumour"], doesNotShow: "the stages by name (prophase, metaphase...); interphase; meiosis or cancer" }),
  mk("x3-dna", "DNA double helix", ["dna", "double helix", "dna structure", "structure of dna", "base pair", "base pairs", "complementary base pairing", "nucleotide", "nucleotides"], dna, "A DNA double helix: two twisted strands joined by pairs of bases; a key shows A is adenine, T is thymine, C is cytosine and G is guanine, and that A always pairs with T and C always pairs with G.", "The DNA double helix", "DNA: two strands twisted into a double helix, joined by base pairs; A pairs with T and C pairs with G (Oak KS3/KS4 'DNA', 'double helix').", { avoid: ["rna", "mrna", "trna", "dna profiling", "dna sequencing", "genetic engineering", "gel electrophoresis"], doesNotShow: "the sugar and phosphate parts; how DNA is copied; RNA" }),
  mk("x3-genome", "Cell, chromosome, gene and DNA", ["chromosome", "chromosomes", "gene", "genes", "genome", "genomes"], genome, "A cell with a nucleus, then a chromosome, then a piece of DNA in which one short section is highlighted as a gene.", "Chromosomes, genes and DNA", "Genetic material is stored in chromosomes in the nucleus; a chromosome is a long coiled molecule of DNA; a gene is a short section of DNA that codes for a protein; the genome is all the genetic material (Oak KS3/KS4 'gene', 'chromosome', 'genome').", { avoid: ["genetic engineering", "gene therapy", "gene pool", "sex chromosome", "x chromosome", "y chromosome"], doesNotShow: "numbers of chromosomes; the sex chromosomes; how genes are read" }),
  mk("x3-punnett-square", "Punnett square", ["punnett square", "punnett squares", "genetic cross", "genetic diagram", "genetic diagrams", "genetic crosses"], punnett, "A Punnett square for two parents who are both Bb: the possible gametes of each parent along the top and side, and the four possible offspring BB, Bb, Bb and bb inside the grid.", "A Punnett square", "Punnett square: gametes of each parent along the sides, offspring genotypes in the boxes; B = dominant allele, b = recessive allele. Drawn only as an example cross (Bb x Bb).", { numeric: true, doesNotShow: "the ratios or probabilities; crosses of other genotypes" }),
  mk("x3-alleles", "Alleles, genotype and phenotype", ["allele", "alleles", "homozygous", "heterozygous", "genotype", "genotypes", "phenotype", "phenotypes", "dominant allele", "recessive allele"], alleles, "Three pairs of chromosomes carrying two copies of one gene: BB is homozygous dominant, Bb is heterozygous, bb is homozygous recessive. BB and Bb show the dominant feature; bb shows the recessive feature.", "Alleles, genotype and phenotype", "Alleles are versions of a gene; genotype = the alleles present (BB, Bb, bb); phenotype = the feature shown; a dominant allele is shown if present, a recessive one only when two copies are present (Oak KS4 'alleles').", { requires: ["gene", "genes", "allele", "alleles", "genotype", "phenotype", "inherit", "inherited", "inheritance", "genetic"], doesNotShow: "codominance or sex-linked genes; the actual feature; probabilities" }),
  mk("x3-natural-selection", "Natural selection", ["natural selection", "survival of the fittest", "theory of evolution", "evolution by natural selection", "evolution"], selection, "Natural selection as five steps: there is variation in a population; individuals compete and some do not survive; the best adapted survive and reproduce; they pass on the alleles for helpful features; over many generations the population changes.", "Natural selection", "Natural selection (Darwin): variation, competition, survival and reproduction of the best adapted, inheritance of helpful alleles, gradual change of the population (Oak KS3/KS4 'natural selection').", { avoid: ["artificial selection", "selective breeding", "human evolution", "evolution of the eye"], doesNotShow: "a particular species or example; mutations; extinction" }),
  mk("x3-vertebrates", "Vertebrate groups", ["vertebrate", "vertebrates", "vertebrate groups", "groups of vertebrates", "mammal", "mammals", "amphibian", "amphibians", "reptile", "reptiles"], vertebrates, "The five groups of vertebrates: fish (scales, gills and fins, eggs laid in water), amphibians (moist skin, eggs in water), reptiles (dry scaly skin, eggs on land), birds (feathers, wings and a beak, hard-shelled eggs) and mammals (hair or fur, young feed on milk).", "The five groups of vertebrates", "Vertebrates (animals with a backbone): fish, amphibians, reptiles, birds, mammals, with their standard features (Oak KS1/KS2 'animal groups'). Most mammals give birth to live young; a few lay eggs, so the picture only says the young feed on milk.", { avoid: ["invertebrate", "invertebrates"], doesNotShow: "the exceptions (e.g. egg-laying mammals, live-bearing reptiles); how the groups are related" }),
  mk("x3-invertebrates", "Invertebrates", ["invertebrate", "invertebrates", "minibeast", "minibeasts", "insect", "insects", "arachnid", "arachnids"], invertebrates, "Four kinds of invertebrate (animals without a backbone): an insect with six legs and three body parts, a spider with eight legs and two body parts, a snail with a soft body and a shell, and a worm with a long soft body and no legs.", "Invertebrates", "Invertebrates have no backbone. Insects: 6 legs, 3 body parts; spiders (arachnids): 8 legs, 2 body parts; snails: soft body and shell; worms: long soft body, no legs (Oak KS1/KS2 'minibeasts').", { avoid: ["vertebrate", "vertebrates", "fish", "bird", "mammal", "life cycle"], doesNotShow: "crustaceans, centipedes or other groups" }),
  mk("x3-classification-key", "Classification key", ["classification key", "classification keys", "dichotomous key", "dichotomous keys", "branching key", "identification key"], key, "A branching classification key: a question about a feature splits into yes and no; a yes leads to organism A and a no leads to another question, whose yes leads to organism B and no to organism C.", "A classification key", "A classification (dichotomous) key uses a series of questions with two answers (yes/no) to identify an organism; each answer leads to another question or to the identification (Oak KS2/KS3 'classification key').", { doesNotShow: "any real organisms or questions" }),
  mk("x3-five-kingdoms", "Five kingdoms", ["five kingdoms", "kingdoms", "kingdom"], kingdoms, "The five kingdoms of living things: animals (for example a dog), plants (a tree), fungi (a mushroom), protists (an amoeba) and prokaryotes (bacteria).", "The five kingdoms", "Five-kingdom classification: animals, plants, fungi, protists, prokaryotes (Oak KS3/KS4 'kingdom').", { requires: ["classification", "classify", "organism", "organisms", "species", "living things", "animals", "plants", "fungi"], avoid: ["domain", "archaea", "three domain", "united kingdom", "animal kingdom", "plant kingdom", "kingdom animalia", "kingdom plantae", "phylum", "taxonomic"], doesNotShow: "viruses; other classification systems such as the three domains" }),
  mk("x3-taxonomy", "Taxonomic hierarchy", ["taxonomy", "taxonomic", "taxonomic hierarchy", "classification hierarchy", "binomial system", "binomial", "binomial name"], taxonomy, "The levels of classification from largest group to smallest: kingdom, phylum, class, order, family, genus and species.", "The levels of classification", "Linnaean hierarchy: kingdom, phylum, class, order, family, genus, species; each level has fewer organisms that are more alike (Oak KS4 'taxonomy').", { doesNotShow: "any example organism; binomial names" }),
  mk("x3-biomass-pyramid", "Pyramid of biomass", ["pyramid of biomass", "biomass pyramid", "trophic level", "trophic levels"], pyramid, "A pyramid of biomass: producers at the wide bottom, then primary consumers, secondary consumers and tertiary consumers at the narrow top; the biomass gets smaller at each trophic level.", "A pyramid of biomass", "Trophic levels: producers, primary, secondary, tertiary consumers; the biomass (and the energy) available decreases at each level up the food chain, so a pyramid of biomass narrows upwards (Oak KS4 'trophic level').", { avoid: ["pyramid of numbers", "inverted"], doesNotShow: "numbers, energy amounts or percentages; pyramids of numbers (which can be inverted)" }),
  mk("x3-carbon-cycle", "The carbon cycle", ["carbon cycle"], carbonCycle, "The carbon cycle: plants take carbon dioxide from the air by photosynthesis; plants, animals and decomposers return it by respiration and decay; animals get carbon by feeding on plants; burning fossil fuels also releases carbon dioxide.", "The carbon cycle", "Carbon cycle: photosynthesis removes CO2 from the air; respiration by plants, animals and decomposers, decay, and burning (combustion) of fossil fuels return it; carbon passes to animals by feeding (Oak KS3/KS4 'carbon cycle').", { h: 182, doesNotShow: "the oceans or fossil fuel formation; amounts of carbon" }),
  mk("x3-predator-prey", "Predator and prey cycles", ["predator prey", "predator-prey", "predator prey cycle", "predator and prey", "predators and prey"], predator, "A graph of predator and prey numbers over time: both go up and down in cycles, and the predator numbers rise a little after the prey numbers and fall after them.", "Predator and prey numbers", "Predator-prey cycles: prey numbers rise, predators then increase (more food), prey fall, predators then fall; the predator peak lags behind the prey peak (Oak KS3/KS4 'predator', 'prey').", { doesNotShow: "real data; the numbers on either axis; other factors such as disease" }),
  mk("x3-quadrat", "Quadrat sampling", ["quadrat", "quadrats"], quadrat, "A field with plants scattered over it and a square frame called a quadrat laid on the ground, used to count the organisms in a small area.", "A quadrat", "A quadrat is a square frame placed on the ground to count the organisms in a small sample area (Oak KS3/KS4 'quadrat').", { avoid: ["transect"], doesNotShow: "random placing or the calculation of population size" }),
  mk("x3-balanced-diet", "Nutrients in a balanced diet", ["balanced diet", "nutrient", "nutrients", "food groups", "food group"], diet, "The nutrients in a balanced diet: carbohydrates for energy (bread, pasta, rice), proteins for growth and repair (meat, fish, beans), fats as an energy store (oils, butter), vitamins and minerals to keep you healthy (fruit, vegetables), fibre to help food move along and water needed in every cell.", "The nutrients we need", "Nutrients: carbohydrates (energy), proteins (growth and repair), fats (energy store), vitamins and minerals (health), fibre (digestion), water (Oak KS1-KS3 'balanced diet', 'nutrients').", { requires: ["diet", "healthy", "meal", "meals", "food group", "food groups", "vitamin", "vitamins", "carbohydrates", "protein", "proteins", "fibre", "balanced"], avoid: ["phloem", "translocation", "transport", "transported", "plant", "plants", "cell", "cells", "cytoplasm", "egg cell", "root", "roots", "soil", "fertiliser", "mineral ions", "photosynthesis", "plant nutrients", "mineral nutrients", "nitrate", "fertiliser", "photosynthesis", "soil"], doesNotShow: "portion sizes; the Eatwell guide; energy values" }),
  mk("x3-antagonistic-muscles", "Antagonistic muscles", ["antagonistic muscles", "antagonistic pair", "antagonistic", "biceps", "triceps"], muscles, "Two arms: on the left the arm is bent with the biceps contracted and the triceps relaxed; on the right the arm is straight with the triceps contracted and the biceps relaxed.", "Antagonistic muscles", "Muscles work in antagonistic pairs: biceps contracts and triceps relaxes to bend the arm; triceps contracts and biceps relaxes to straighten it (Oak KS3 'antagonistic muscles').", { doesNotShow: "the bones' names, tendons or joints" }),
  mk("x3-enzyme", "Enzymes: lock and key", ["enzyme", "enzymes", "active site", "lock and key", "lock and key model", "substrate", "denature", "denatured"], enzyme, "An enzyme's active site fitting a substrate, forming an enzyme-substrate complex, then releasing products with the enzyme unchanged; below, a denatured enzyme whose active site has changed shape so the substrate no longer fits.", "How an enzyme works", "Lock and key: the substrate fits the enzyme's active site, the reaction happens and products are released; the enzyme is not used up; if the enzyme is denatured (e.g. by high temperature or extreme pH) the active site changes shape and the substrate no longer fits (Oak KS4 'enzymes').", { requires: ["enzyme", "enzymes", "active site", "catalyst"], avoid: ["enzyme concentration", "optimum temperature", "rate of reaction"], doesNotShow: "specific enzymes; the effect of temperature or pH as a graph" }),
  mk("x3-diffusion", "Diffusion", ["diffusion", "diffuse", "diffuses", "diffusing", "concentration gradient"], diffusion, "Diffusion: at the start there are lots of particles in one place; later the particles have spread out evenly. The net movement is from a high to a low concentration.", "Diffusion", "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration, until they are evenly spread (Oak KS3/KS4 'diffusion').", { avoid: ["active transport", "osmosis", "facilitated"], doesNotShow: "what the particles are; the speed of diffusion; diffusion across membranes" }),
  mk("x3-osmosis", "Osmosis", ["osmosis"], osmosis, "Osmosis: a partially permeable membrane separates a dilute solution on the left from a concentrated solution on the right. Small water molecules pass through the membrane from the dilute to the concentrated side; the big solute molecules cannot.", "Osmosis", "Osmosis: net movement of water across a partially permeable membrane from a dilute solution (high water concentration) to a more concentrated solution (Oak KS3/KS4 'osmosis').", { avoid: ["reverse osmosis"], doesNotShow: "turgor or plasmolysis; potato experiments; water potential" }),
  mk("x3-active-transport", "Active transport", ["active transport"], active, "Active transport: a carrier protein in the cell membrane moves particles from outside, where there are few, into the cell, where there are many, using energy from respiration.", "Active transport", "Active transport moves substances against a concentration gradient (from low to high concentration) using energy from respiration and carrier proteins (Oak KS4 'active transport').", { doesNotShow: "the shape change of the carrier; specific substances or cells" }),
  mk("x3-microscope", "Light microscope", ["light microscope", "light microscopes", "microscope", "microscopes", "parts of a microscope", "eyepiece lens", "objective lens", "objective lenses"], microscope, "A light microscope with its parts labelled: eyepiece lens at the top, objective lenses, the stage where the slide goes, a light source underneath, the coarse and fine focus wheels, the arm and the base.", "A light microscope", "Light microscope: eyepiece lens, objective lenses, stage, light source, coarse and fine focus, arm, base (Oak KS3/KS4 'light microscope').", { avoid: ["electron microscope", "electron microscopy", "electron microscopes", "=tem", "=sem", "scanning", "resolution of an electron"], doesNotShow: "magnification numbers; how to focus; electron microscopes" }),
  mk("x3-levels-organisation", "Levels of organisation", ["levels of organisation", "organ system", "organ systems"], levels, "The levels of organisation in living things from smallest to largest: cell, tissue, organ, organ system and organism, with arrows between them.", "Levels of organisation", "Cells -> tissues -> organs -> organ systems -> organism (Oak KS3/KS4 'tissue', 'organ system').", { requires: ["cell", "cells", "organism", "organisms", "tissue", "tissues", "organ", "organs", "organ system", "levels of organisation"], avoid: ["organ donor", "organ transplant", "sponge"], doesNotShow: "any particular tissue or organ" }),
  mk("x3-endocrine", "Endocrine system", ["endocrine system", "endocrine gland", "endocrine glands", "pituitary gland", "thyroid", "adrenal gland", "adrenal glands", "hormone", "hormones"], endocrine, "The outline of a person showing where four hormone-making glands are: the pituitary gland in the head, the thyroid gland in the neck, the two adrenal glands above the kidneys and the pancreas in the abdomen.", "The endocrine system", "Endocrine glands release hormones into the blood: pituitary (head), thyroid (neck), adrenals (above the kidneys), pancreas, and the ovaries or testes (Oak KS4 'endocrine system').", { avoid: ["plant hormone", "plant hormones", "auxin", "auxins", "phototropism", "gravitropism", "growth hormone in plants"], doesNotShow: "which hormone each gland makes; the ovaries and testes (mentioned in the text only)" }),
  mk("x3-homeostasis", "Negative feedback", ["homeostasis", "negative feedback"], homeostasis, "A negative feedback loop: a receptor detects a change, the coordination centre processes it, an effector (muscle or gland) produces a response, and the level returns to normal.", "Homeostasis: negative feedback", "Homeostasis keeps internal conditions steady using receptors, a coordination centre and effectors in a negative feedback loop (Oak KS4 'homeostasis').", { doesNotShow: "any particular variable (temperature, glucose, water); hormones or nerves" }),
  mk("x3-phototropism", "Phototropism", ["phototropism", "phototropic"], photo, "Phototropism: a shoot with light coming from one side bends towards the light, because the plant hormone auxin builds up on the shaded side and the cells there grow longer.", "Phototropism", "Shoots bend towards light (positive phototropism): auxin accumulates on the shaded side, making those cells elongate more (Oak KS4 'phototropism', 'auxins').", { avoid: ["gravitropism", "geotropism", "negative phototropism", "root"], doesNotShow: "roots (which grow away from light); other tropisms" }),
  mk("x3-pathogens", "Pathogens", ["pathogen", "pathogens", "communicable disease", "communicable diseases", "infectious disease", "infectious diseases"], pathogens, "Four kinds of pathogen (microorganisms that cause disease): bacteria such as salmonella, viruses such as measles, fungi such as athlete's foot and protists such as malaria.", "The four types of pathogen", "Pathogens: bacteria (e.g. salmonella), viruses (e.g. measles), fungi (e.g. athlete's foot), protists (e.g. malaria) (Oak KS4 'pathogen', 'communicable disease').", { avoid: ["non communicable", "non-communicable", "noncommunicable", "cancer", "heart disease", "diabetes"], doesNotShow: "how the diseases spread; the size of each pathogen; the immune response" }),
];
void [R, B, G, Y, V, N, GR, dot, poly];
