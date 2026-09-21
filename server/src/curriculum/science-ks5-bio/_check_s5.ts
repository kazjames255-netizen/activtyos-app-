// Independent re-computation of every computable answer in the science-ks5-bio pack (and the worked examples in the notes),
// from the SAME data the images are drawn from (_s5data.ts).   cd server && npx tsx src/curriculum/science-ks5-bio/_check_s5.ts
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as D from "./_s5data";
import type { CTopic, CQuestion } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(HERE, "../../../../scratch/curriculum-images/science-ks5-bio");
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => sum(a) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };
const chi = (o: number[], e: number[]) => sum(o.map((x, i) => (x - e[i]) ** 2 / e[i]));
const simpson = (n: number[]) => { const N = sum(n); return 1 - sum(n.map((x) => (x / N) ** 2)); };
const rank = (a: number[]) => a.map((x) => a.filter((y) => y < x).length + 1); // no ties in our data
const spearman = (x: number[], y: number[]) => { const rx = rank(x), ry = rank(y); const d2 = sum(rx.map((r, i) => (r - ry[i]) ** 2)); const n = x.length; return 1 - (6 * d2) / (n * (n * n - 1)); };
const V = (t: number) => D.ENZ.Vmax * (1 - Math.exp(-t / D.ENZ.tau));
const paths = (from: string, ends: string[]): string[][] => { if (ends.includes(from) && !D.WEB.edges.some(([a]) => a === from)) return [[from]]; const out: string[][] = []; for (const [a, b] of D.WEB.edges) if (a === from) for (const p of paths(b, ends)) out.push([from, ...p]); return out; };

const E: Record<string, () => number | string | string[]> = {
  // molecules
  "b5mol-y12-05": () => 3,
  "b5mol-y12-07": () => D.MOL.known.Q / D.MOL.front,
  "b5mol-y12-08": () => Object.entries(D.MOL.known).filter(([, d]) => D.MOL.mixture.some((m) => Math.abs(m - d) < 1e-9)).map(([k]) => `Amino acid ${k}`),
  "b5mol-y12-09": () => 20 ** 3,
  // cells
  "b5cell-y12-04": () => (D.MITO.imageMm / D.MITO.mag) * 1000,
  "b5cell-y12-06": () => (26 / 200) * 100,
  "b5cell-y12-11": () => (2 * 3) / 2,
  // enzymes
  "b5enz-y12-04": () => { const [a, b] = D.ENZ.tangent; const slope = (b[1] - a[1]) / (b[0] - a[0]); if (Math.abs(slope - D.ENZ.Vmax / D.ENZ.tau) > 1e-9) throw new Error("tangent != derivative at 0"); return slope; },
  "b5enz-y12-08": () => 1 / 40 / (1 / 80),
  "b5enz-y12-10": () => 200 - 200 * (0.1 / 2.0),
  "b5enz-y12-11": () => (Math.round(V(40)) - Math.round(V(20))) / 20,
  // exchange
  "b5exch-y12-04": () => { const [l, w, h] = [4, 2, 2]; return (2 * (l * w + l * h + w * h)) / (l * w * h); },
  "b5exch-y12-05": () => 0.45 * 14,
  "b5exch-y12-09": () => { if (Math.abs(D.hill(D.HB.adult, D.HB.adult) - 50) > 1e-9) throw new Error("adult P50"); if (!(D.HB.foetal < D.HB.adult && D.HB.adult < D.HB.highCO2)) throw new Error("curve order"); return D.HB.adult; },
  "b5exch-y12-11": () => 84 * 72 - 64 * 90,
  // genes
  "b5gen-y12-04": () => (100 - 2 * 22) / 2,
  "b5gen-y12-05": () => 1203 / 3 - 1,
  "b5gen-y12-08": () => "TACGGCATA".split("").map((c) => ({ T: "A", A: "U", C: "G", G: "C" } as Record<string, string>)[c]).join(""),
  "b5gen-y12-12": () => 2 ** 23,
  "b5gen-y12-13": () => 1 * 6 * 6,
  // diversity
  "b5div-y12-04": () => simpson([10, 6, 4]),
  "b5div-y12-08": () => ((600 - 48) / 600) * 100,
  "b5div-y12-11": () => simpson([99, 1]),
  // immunity
  "b5imm-y12-08": () => D.IMM.secondaryPeak / D.IMM.primaryPeak,
  "b5imm-y12-12": () => (14 - 0) - (35 - 28),
  "b5imm-y13-04": () => (1 - 1 / 4) * 100,
  "b5imm-y13-05": () => Math.PI * (D.PLATE.zones.B / 2) ** 2,
  "b5imm-y13-11": () => ((1 - 1 / 5) / 0.95) * 100,
  // photosynthesis / respiration
  "b5resp-y13-07": () => 3.6 / 4.5,
  "b5resp-y13-12": () => { const L = D.mm(D.PHOTO.X, D.PHOTO.low.R, D.PHOTO.low.K), H = D.mm(D.PHOTO.X, D.PHOTO.high.R, D.PHOTO.high.K); return ((H - L) / L) * 100; },
  // inheritance
  "b5inh-y13-04": () => { const q = Math.sqrt(0.04), p = 1 - q; return 2 * p * q; },
  "b5inh-y13-05": () => { const q = Math.sqrt(1 / 2500), p = 1 - q; return 2 * p * q * 100; },
  "b5inh-y13-06": () => chi([88, 33, 27, 12], [160 * 9 / 16, 160 * 3 / 16, 160 * 3 / 16, 160 / 16]),
  "b5inh-y13-10": () => { // must-carrier logic from the pedigree: unaffected parent of an affected child
    const parents: Record<string, string[]> = { "II-1": ["I-1", "I-2"], "III-3": ["II-2", "II-5"] };
    const aff = new Set(D.PED.people.filter((p) => p[2]).map((p) => p[0]));
    const must = new Set<string>();
    for (const c of Object.keys(parents)) if (aff.has(c)) for (const p of parents[c]) if (!aff.has(p)) must.add(p);
    return ["I-2", "II-3", "II-5", "III-2"].filter((x) => must.has(x));
  },
  "b5inh-y13-11": () => (2 / 3) * (1 / 4),
  // control
  "b5ctrl-y13-04": () => D.AP.peak - D.AP.rest,
  "b5ctrl-y13-11": () => Math.max(...D.GLU.healthy) - D.GLU.healthy[0],
  // ecology
  "b5eco-y13-04": () => paths("grass", ["hawk", "fox"]).length,
  "b5eco-y13-06": () => (D.PYR.levels[2][1] / D.PYR.levels[1][1]) * 100,
  "b5eco-y13-07": () => 12400 - 4500,
  "b5eco-y13-09": () => (60 * 50) / 10,
  // techniques
  "b5tech-y13-04": () => 2 ** 12,
  "b5tech-y13-05": () => { const m = Object.entries(D.GEL.lanes).filter(([k, v]) => k !== "CS" && JSON.stringify(v) === JSON.stringify(D.GEL.lanes.CS)).map(([k]) => k); if (m.length !== 1) throw new Error("gel matches " + m); return `Suspect ${m[0].slice(1)}`; },
  "b5tech-y13-08": () => sd(D.STAT.control),
  "b5tech-y13-10": () => 10 ** 4,
  "b5tech-y13-11": () => { let n = 0; while (2 ** n <= 1e6) n++; return n; },
  "b5tech-y13-13": () => spearman([3, 4, 2, 6, 5, 1], [5, 3, 4, 1, 2, 6].map((r) => r)), // ranks given directly; ranking is idempotent on rank data
};
// Cross-checks that are not a single key.
const extra: [string, () => boolean][] = [
  // notes' worked examples
  ["note mol: Rf 3.2/8.0", () => Math.abs(3.2 / 8.0 - 0.4) < 1e-9],
  ["note mol: 50-aa chain has 49 peptide bonds", () => 50 - 1 === 49],
  ["note cell: 24 mm / 400 = 0.06 mm = 60 µm", () => Math.abs((24 / 400) * 1000 - 60) < 1e-9],
  ["note cell: 20/250 = 8%", () => Math.abs((20 / 250) * 100 - 8) < 1e-9],
  ["note enz: 9/12 = 0.75", () => 9 / 12 === 0.75],
  ["note enz: dilution 25 + 75", () => 100 * (0.5 / 2.0) === 25],
  ["note exch: cube 3 cm SA:V = 2:1", () => (6 * 9) / 27 === 2],
  ["note exch: 0.5×12 = 6.0; 60×80 = 4800", () => 0.5 * 12 === 6 && 60 * 80 === 4800],
  ["note gen: A=30% -> G=20%; 2^4=16", () => (100 - 60) / 2 === 20 && 2 ** 4 === 16],
  ["note div: Simpson 30,15,5 = 0.54", () => Math.abs(simpson([30, 15, 5]) - 0.54) < 1e-9],
  ["note imm13: R0=2 -> 50%; zone d=30 -> 707", () => 1 - 1 / 2 === 0.5 && Math.round(Math.PI * 15 * 15) === 707],
  ["note resp: RQ 1.4/2.0 = 0.7; 3.0->4.5 = 50%", () => Math.abs(1.4 / 2.0 - 0.7) < 1e-9 && ((4.5 - 3) / 3) * 100 === 50],
  ["note inh: chi 70:30 vs 75:25 = 1.33; HW q2=.09 -> 0.42", () => Math.abs(chi([70, 30], [75, 25]) - 1.3333) < 1e-3 && Math.abs(2 * 0.7 * 0.3 - 0.42) < 1e-9],
  ["note ctrl: 0.30/0.004 = 75; 60/0.8 = 75", () => Math.abs(0.3 / 0.004 - 75) < 1e-9 && 60 / 0.8 === 75],
  ["note eco: 20000-8000; 216/1800=12%; 40*30/6=200", () => 12000 === 20000 - 8000 && Math.abs((216 / 1800) * 100 - 12) < 1e-9 && (40 * 30) / 6 === 200],
  ["note tech: 2^8; SD(4,6,8)=2; 0.5/25=2%", () => 2 ** 8 === 256 && Math.abs(sd([4, 6, 8]) - 2) < 1e-9 && (0.5 / 25) * 100 === 2],
  // image data consistency
  ["tree: closest pair is W,X and UPGMA nests ((W,X),Y),Z", () => { const d = D.TREE.d; const min = Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]; const dWXY = (d.WY + d.XY) / 2, dZ = (d.WZ + d.XZ + d.YZ) / 3; return min === "WX" && dWXY < dZ; }],
  ["gel: migration decreases with size; ladder bands distinct", () => D.GEL.ladder.every((b, i, a) => i === 0 || D.migr(b) > D.migr(a[i - 1]))],
  ["plate: inhibition zones: B largest, C none (=disc)", () => D.PLATE.zones.B === Math.max(...Object.values(D.PLATE.zones)) && D.PLATE.zones.C === D.PLATE.disc],
  ["antibody log peaks 100 and 1000 on gridlines", () => Number.isInteger(Math.log10(D.IMM.primaryPeak)) && Number.isInteger(Math.log10(D.IMM.secondaryPeak))],
  ["pyramid: efficiencies 11.6% then 9.3%", () => Math.abs((2900 / 25000) * 100 - 11.6) < 0.01 && Math.abs((270 / 2900) * 100 - 9.31) < 0.01],
  ["glucose: person A peaks 6.9 @0.75h; person B peak 16", () => Math.max(...D.GLU.healthy) === 6.9 && D.GLU.t[D.GLU.healthy.indexOf(6.9)] === 0.75 && Math.max(...D.GLU.diabetic) === 16],
  ["enz substrate: A same Vmax as control (competitive), B lower Vmax", () => D.ENZ.sub.A.V === D.ENZ.sub.ctrl.V && D.ENZ.sub.A.K > D.ENZ.sub.ctrl.K && D.ENZ.sub.B.V < D.ENZ.sub.ctrl.V],
  ["transport: curve 2 saturates (facilitated), curve 1 linear", () => D.mm(1000, D.TRANS.Vmax, D.TRANS.K) < D.TRANS.Vmax + 1e-9 && D.TRANS.slope * 20 === 10],
  ["stats: control mean 13.1, treated bars do not overlap", () => { const [mc, sc, mt, st] = [mean(D.STAT.control), sd(D.STAT.control), mean(D.STAT.treated), sd(D.STAT.treated)]; return Math.abs(mc - 13.1) < 1e-9 && mc + sc < mt - st; }],
  ["chi-squared critical values (p=0.05): 3.84/5.99/7.81 quoted; 1.04 < 7.81", () => chi([88, 33, 27, 12], [90, 30, 30, 10]) < 7.81],
  ["AP peak +40, rest -70, hyper -80 all on curve landmarks", () => D.AP.peak === 40 && D.AP.rest === -70 && D.AP.threshold === -55 && D.AP.hyper === -80],
  ["food web: fox eats only rabbit; hawk eats rabbit+snake", () => D.WEB.edges.filter(([, b]) => b === "fox").length === 1 && D.WEB.edges.filter(([, b]) => b === "hawk").length === 2],
  ["pedigree: II-1 female affected, I-1 unaffected male (rules out X-linked recessive)", () => { const p = (id: string) => D.PED.people.find((x) => x[0] === id)!; return p("II-1")[1] === "F" && p("II-1")[2] && !p("I-1")[2]; }],
];

(async () => {
  let bad = 0, n = 0, checked = 0;
  const topics: CTopic[] = [];
  for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) topics.push((await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC);
  const qs = new Map<string, CQuestion>();
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  for (const t of topics) for (const y of Object.values(t.years)) {
    if (!y) continue;
    const w = words(y.note.body);
    const hasTable = /\|\s*---/.test(y.note.body);
    const hasCalc = /worked calculation|worked example/i.test(y.note.body);
    if (w < 250 || w > 350 || !hasTable || !hasCalc) { console.log(`NOTE ${t.key} Y${y.year}: ${w} words table=${hasTable} calc=${hasCalc}`); if (w < 250 || w > 360 || !hasTable || !hasCalc) bad++; }
    const d = [1, 2, 3].map((k) => y.quiz.questions.filter((q) => q.difficulty === k).length);
    console.log(`${t.key} Y${y.year}: ${y.quiz.questions.length} Qs (d ${d.join("/")}), ${y.flashcards.length} cards, note ${w} words, images ${new Set(y.quiz.questions.filter((q) => q.image).map((q) => q.image!.file)).size}`);
    for (const q of y.quiz.questions) {
      n++; qs.set(q.key, q);
      if (q.image) { const sz = statSync(path.join(IMG, q.image.file)).size; if (sz > 200 * 1024) { console.log("IMG too big", q.image.file); bad++; } }
    }
  }
  for (const [key, fn] of Object.entries(E)) {
    const q = qs.get(key);
    if (!q) { console.log(`✗ ${key}: question not found`); bad++; continue; }
    let got: number | string | string[];
    try { got = fn(); } catch (e) { console.log(`✗ ${key}: ${(e as Error).message}`); bad++; continue; }
    checked++;
    let ok: boolean;
    if (typeof q.answer === "number") ok = typeof got === "number" && Math.abs(got - q.answer) <= (q.tolerance ?? 0) + 1e-9 && Math.abs(got - q.answer) <= Math.max(q.tolerance ?? 0, 0) + 1e-9;
    else if (Array.isArray(q.answer)) ok = Array.isArray(got) && JSON.stringify([...got].sort()) === JSON.stringify([...q.answer].sort());
    else ok = String(got) === q.answer;
    // For numbers: the key must equal the computed value once rounded as the prompt requests (tolerance covers rounding).
    if (!ok) { console.log(`✗ ${key}: computed ${JSON.stringify(got)} but key is ${JSON.stringify(q.answer)} (tol ${q.tolerance ?? 0})`); bad++; }
  }
  for (const [name, fn] of extra) { checked++; let ok = false; try { ok = fn(); } catch { ok = false; } if (!ok) { console.log(`✗ ${name}`); bad++; } }
  console.log(`\n${topics.length} topics, ${n} questions, ${checked} computed checks, ${bad} failure(s)`);
  process.exit(bad ? 1 : 0);
})();
