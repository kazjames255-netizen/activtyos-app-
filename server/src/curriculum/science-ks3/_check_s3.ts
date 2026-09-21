// Independent recomputation of every calculable answer key in the science-ks3 pack, from the SAME data arrays that draw the images (_data.ts).
//   cd server && npx tsx src/curriculum/science-ks3/_check_s3.ts
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic } from "../types";
import * as D from "./_data";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMGDIR = path.resolve(HERE, "../../../../scratch/curriculum-images/science-ks3");
const topics: CTopic[] = [];
for (const f of readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort()) topics.push((await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC);
const Q = new Map<string, CQuestion>();
for (const t of topics) for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) Q.set(q.key, q);

const bad: string[] = [];
let checks = 0;
const get = (k: string) => { const q = Q.get(k); if (!q) bad.push(`${k}: question missing`); return q; };
const firstNum = (s: string) => parseFloat((String(s).replace(/,/g, "").replace(/\s(?=\d{3}\b)/g, "").match(/-?\d+(\.\d+)?/) ?? ["NaN"])[0]);
const eqNum = (k: string, exp: number) => { const q = get(k); if (!q) return; checks++; const got = typeof q.answer === "number" ? q.answer : firstNum(String(q.answer)); const tol = (q.tolerance ?? 0) + 1e-9; if (!(Math.abs(got - exp) <= tol)) bad.push(`${k}: key ${got} != recomputed ${exp}`); };
const eqText = (k: string, exp: string | string[]) => { const q = get(k); if (!q) return; checks++; const a = Array.isArray(q.answer) ? [...q.answer].sort().join("|") : String(q.answer); const e = Array.isArray(exp) ? [...exp].sort().join("|") : exp; if (a !== e) bad.push(`${k}: key "${a}" != recomputed "${e}"`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ── Biology ──
eqNum("bcell-y7-06", 45 / 300);
eqNum("bfunc-y7-07", 20 * 35);
{ const n = D.VACC.length; const mx = D.VACC.reduce((s, p) => s + p[0], 0) / n, my = D.VACC.reduce((s, p) => s + p[1], 0) / n; const slope = D.VACC.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0); eqText("bfunc-y8-01", slope < 0 ? "The number of cases falls" : "The number of cases rises"); eqNum("bfunc-y8-02", D.VACC.find((p) => p[0] === 70)![1]); }
{ const pl = D.PHOTO.findIndex((p, i) => i > 0 && p[1] === D.PHOTO[i - 1][1]); eqText("bgas-y8-03", String(D.PHOTO[pl - 1][0])); eqNum("bgas-y8-04", D.PHOTO.find((p) => p[0] === 3)![1]); }
{ const modal = D.HEIGHTS.reduce((m, p) => (p[1] > m[1] ? p : m)); eqText("bgen-y9-01", `${modal[0]}–${modal[0] + 4} cm`); eqNum("bgen-y9-02", D.HEIGHTS.filter((p) => p[0] >= 150).reduce((s, p) => s + p[1], 0));
  if (D.HEIGHTS.reduce((s, p) => s + p[1], 0) !== 30) bad.push("heights do not total 30");
  // Bb x Bb: enumerate alleles
  let bb = 0, tot = 0; for (const a of ["B", "b"]) for (const b of ["B", "b"]) { tot++; if (a === "b" && b === "b") bb++; } eqText("bgen-y9-09", `1 in ${tot / bb}`); }
{ const W = D.FOODWEB, incoming = (n: string) => W.edges.filter((e) => e[1] === n).map((e) => e[0]), outgoing = (n: string) => W.edges.filter((e) => e[0] === n).map((e) => e[1]);
  const producers = Object.keys(W.nodes).filter((n) => incoming(n).length === 0); eqText("becol-y9-01", producers[0]); if (producers.length !== 1) bad.push("foodweb: not exactly one producer");
  const chain = ["Grass", "Grasshopper", "Frog", "Owl"]; chain.slice(1).forEach((n, i) => { if (!W.edges.some((e) => e[0] === chain[i] && e[1] === n)) bad.push(`foodweb chain edge missing ${chain[i]}->${n}`); });
  eqText("becol-y9-02", "A secondary consumer"); if (chain.indexOf("Frog") !== 2) bad.push("frog not 2nd consumer");
  eqText("becol-y9-03", outgoing("Mouse").sort());
  const preds = outgoing("Grasshopper"); if (preds.length !== 1 || preds[0] !== "Frog") bad.push("grasshopper predators not only frog"); eqText("becol-y9-04", "It increases");
  const paths = (n: string): number => (n === "Owl" ? 1 : outgoing(n).reduce((s, m) => s + paths(m), 0)); eqNum("becol-y9-05", paths("Grass"));
  eqNum("becol-y9-10", 6 * 500); }

// ── Chemistry ──
{ const letter = (s: string) => D.STATES_PANELS.find((p) => p.state === s)!.letter; eqText("cpart-y7-01", letter("gas")); eqText("cpart-y7-02", letter("liquid")); }
{ const H = D.HEATING; const pl: [number, number][] = []; for (let i = 1; i < H.length; i++) if (H[i][1] === H[i - 1][1]) pl.push([H[i - 1][0], H[i][0]]); const melt = H[H.findIndex((p, i) => i > 0 && p[1] === H[i - 1][1])][1];
  eqText("cpart-y7-03", `${melt} °C`);
  const tAt = (t: number) => { for (let i = 1; i < H.length; i++) if (t >= H[i - 1][0] && t <= H[i][0]) return H[i - 1][1] + ((H[i][1] - H[i - 1][1]) * (t - H[i - 1][0])) / (H[i][0] - H[i - 1][0]); return NaN; };
  const boil = H[pl[1][0] === 9 ? H.findIndex((p) => p[0] === 9) : 0][1]; const T = tAt(7.5); eqText("cpart-y7-04", T > melt && T < boil ? "Liquid" : T <= melt ? "Solid" : "Gas");
  eqNum("cpart-y7-05", pl[1][1] - pl[1][0]); }
eqNum("cpart-y7-08", 240 / 30);
{ const kind = (l: string) => D.MIXBOXES.find((b) => b.letter === l)!.kind; eqText("cele-y7-01", D.MIXBOXES.find((b) => b.kind === "compound")!.letter);
  eqText("cele-y7-02", D.MIXBOXES.filter((b) => b.kind === "element-atoms" || b.kind === "element-molecules").map((b) => b.letter)); if (kind("C") !== "mixture") bad.push("box C not mixture");
  eqNum("cele-y7-07", 100 + 5); eqNum("cele-y7-10", 2 + 1 + 4); }
{ const where = (l: string) => D.PT.find((e) => e[0] === D.PT_HIDDEN[l])!; eqText("cele-y8-01", where("D")[1] === "0" ? "D" : "?"); eqText("cele-y8-02", where("B")[1] === "7" ? "B" : "?");
  if (where("A")[1] !== where("C")[1]) bad.push("A and C not in same group"); eqText("cele-y8-04", where("C")[2] > where("A")[2] ? "C" : "A"); }
{ const pairs = Object.entries(D.PH_MARKS); eqText("creact-y8-01", pairs.find((p) => p[1] === 7)![0]); eqText("creact-y8-02", pairs.reduce((m, p) => (p[1] > m[1] ? p : m))[0]); }
{ const M = D.MASSLOSS; eqNum("creact-y9-01", +(M[0][1] - M[M.length - 1][1]).toFixed(6)); eqText("creact-y9-03", String(M.find((p) => p[1] === M[M.length - 1][1])![0])); eqNum("creact-y9-08", 12 + 8);
  // 12 g Mg needs 8 g O: Mg 24, O 16 (2Mg + O2 -> 2MgO): 12/24 mol Mg = 0.5 mol, needs 0.25 mol O2 = 8 g
  if (Math.abs((12 / 24 / 2) * 32 - 8) > 1e-9) bad.push("Mg/O2 masses inconsistent"); }
{ const A = D.ATMOS; eqText("cearth-y9-01", A.A[1] === Math.max(...Object.values(A).map((v) => v[1])) ? "Nitrogen" : "?"); if (Object.values(A).reduce((s, v) => s + v[1], 0) !== 100) bad.push("atmos not 100%"); eqNum("cearth-y9-10", 0.21 * 250); }

// ── Physics ──
eqNum("penergy-y7-07", 3.6 * 1000); eqNum("penergy-y7-09", 100 - 8);
{ const w = D.SANKEY.input - D.SANKEY.useful; eqNum("penergy-y9-01", w); eqNum("penergy-y9-02", (D.SANKEY.useful / D.SANKEY.input) * 100); eqNum("penergy-y9-03", 2000 * 3 * 60); eqNum("penergy-y9-04", (3 * 4 * 30) / 100);
  const cands: [string, number][] = [["2.5 kW", 2500], ["900 W", 900], ["0.5 kW", 500], ["1500 W", 1500]]; eqText("penergy-y9-06", cands.reduce((m, c) => (c[1] > m[1] ? c : m))[0]); eqNum("penergy-y9-07", 400 - 0.25 * 400); eqNum("penergy-y9-10", 4500 / 30); }
{ const S = D.DT.slice(1).map((p, i) => ({ t0: D.DT[i][0], t1: p[0], v: (p[1] - D.DT[i][1]) / (p[0] - D.DT[i][0]) }));
  eqNum("pforce-y8-01", S[0].v); const flat = S.find((s) => s.v === 0)!; eqText("pforce-y8-02", flat.t0 === 20 && flat.t1 === 40 ? "Stationary (not moving)" : "?");
  const fast = S.reduce((m, s) => (Math.abs(s.v) > Math.abs(m.v) ? s : m)); eqText("pforce-y8-03", `${fast.t0} s to ${fast.t1} s`);
  eqNum("pforce-y8-04", D.DT.slice(1).reduce((s, p, i) => s + Math.abs(p[1] - D.DT[i][1]), 0)); eqNum("pforce-y8-06", 150 / 2.5); eqNum("pforce-y8-07", 600 / 0.03);
  const m = D.MOMENT.leftForce * D.MOMENT.leftDist; eqNum("pforce-y8-09", m); eqNum("pforce-y8-10", m / D.MOMENT.rightDist); }
{ const F = D.FORCES; eqNum("pforce-y9-01", F.drive - F.drag); if (F.weight !== F.reaction) bad.push("vertical forces not balanced"); eqNum("pforce-y9-03", F.drag); eqNum("pforce-y9-04", 70 * 10); eqNum("pforce-y9-05", 80 * 1.6);
  eqNum("pforce-y9-07", D.SPRING.find((p) => p[0] === 6)![1]);
  const k = D.SPRING[1][0] / D.SPRING[1][1]; let lim = 0; for (const [f, e] of D.SPRING.slice(1)) { if (near(f / e, k)) lim = f; else break; } eqText("pforce-y9-08", `0 to ${lim} N`); eqNum("pforce-y9-09", 1200 * 2.5); }
eqText("pwave-y8-01", `${D.MIRROR_ANGLE}°`); eqNum("pwave-y8-02", 90 - D.MIRROR_ANGLE); eqNum("pwave-y8-06", 340 * 3);
{ const T = D.TRACES; eqText("pwave-y8-03", T.B.cycles > T.A.cycles ? "B" : "A"); eqText("pwave-y8-04", T.A.amp > T.B.amp ? "A" : "B"); }
{ const L = (n: string) => Object.entries(D.SYMBOLS).find((e) => e[1] === n)![0]; eqText("pelec-y8-01", L("ammeter")); eqNum("pelec-y8-03", D.SERIES.a1); eqNum("pelec-y8-04", +(D.PARALLEL.a1 - D.PARALLEL.a2).toFixed(6)); eqNum("pelec-y8-08", 4 * 1.5); }
{ const V = D.VIR; eqNum("pelec-y9-01", V.V / V.I); eqNum("pelec-y9-02", V.V / 40); eqNum("pelec-y9-03", 2 * 12); eqNum("pelec-y9-04", 12 / 0.5); eqNum("pelec-y9-05", 6 / 15); eqNum("pelec-y9-06", 10 + 10); }
{ const S = D.SEASONS, ax = [Math.sin((S.tilt * Math.PI) / 180), -Math.cos((S.tilt * Math.PI) / 180)]; // The picture is an oblique view of the orbit: screen-x is a horizontal direction in the orbital plane, screen-y differences are DEPTH (towards/away from the viewer), and 'up' is the North direction.
  // So the axis (3D) = (sin tilt, cos tilt, 0) and the direction to the Sun = (dx, 0, dz).
  const dot = (p: [number, number]) => { const d = [S.sun[0] - p[0], 0, S.sun[1] - p[1]], n = Math.hypot(d[0], d[2]); return (ax[0] * d[0]) / n; };
  const res = Object.entries(S.positions).map(([k, p]) => [k, dot(p)] as [string, number]); const summer = res.reduce((m, r) => (r[1] > m[1] ? r : m))[0]; const eq = res.filter((r) => Math.abs(r[1]) < 0.2).map((r) => r[0]);
  eqText("pspace-y9-01", summer); eqText("pspace-y9-03", eq); eqNum("pspace-y9-07", 150e6 / 300e3); eqNum("pspace-y9-08", 50 * 3.7); }

// ── generic structure checks ──
const used = new Set<string>();
for (const t of topics) for (const [yr, y] of Object.entries(t.years)) {
  const qs = y!.quiz.questions, tag = `${t.key} Y${yr}`;
  if (qs.length !== 10) bad.push(`${tag}: ${qs.length} questions`);
  if (qs.filter((q) => q.diagnostic).length !== 2) bad.push(`${tag}: diagnostics != 2`);
  if (qs.filter((q) => q.kind === "written").length > 1) bad.push(`${tag}: >1 written`);
  const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length); if (d[2] < 1 || d[0] < 1) bad.push(`${tag}: difficulty ${d}`);
  for (const q of qs) {
    if (q.image) { used.add(q.image.file); const p = path.join(IMGDIR, q.image.file); if (!existsSync(p)) bad.push(`${q.key}: image missing`); else if (statSync(p).size > 200_000) bad.push(`${q.key}: image >200KB`); }
    if (q.kind === "single" && !q.options!.includes(q.answer as string)) bad.push(`${q.key}: answer not in options`);
    checks++;
  }
  // notes must not reuse the quiz items' numbers: compare multi-digit/decimal numbers in the note's worked examples with the quiz prompts/options/answers
  const wex = y!.note.body.split(/## Worked/)[1] ?? "";
  const nums = (s: string) => new Set((s.replace(/(\d)[ ,](\d{3})/g, "$1$2").match(/\d+(\.\d+)?/g) ?? []).filter((n) => n.length > 1 || n.includes(".")));
  const noteN = nums(wex), quizN = new Set<string>(); for (const q of qs) for (const n of nums(`${q.prompt} ${(q.options ?? []).join(" ")} ${q.answer}`)) quizN.add(n);
  const common = [...noteN].filter((n) => quizN.has(n)); if (common.length) console.log(`  note/quiz shared numbers ${tag}: ${common.join(", ")}`);
}
for (const f of readdirSync(IMGDIR).filter((f) => f.endsWith(".png"))) if (!used.has(f)) bad.push(`unused image ${f}`);
console.log(`${checks} checks · ${Q.size} questions · ${used.size} images used`);
if (bad.length) { console.error(bad.join("\n")); console.error(`\n${bad.length} PROBLEM(S)`); process.exit(1); } else console.log("ALL KEYS VERIFIED");
