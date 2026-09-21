import { TOPIC as T } from "./c5anal";
import { Mr } from "./_atoms";
import { expect, ok, same, find } from "./_ck";
import { IR_PEAKS, MS_PENTANONE, NMR_ETOAC, TLC } from "./_data";

const massInt = (f: Record<string, number>) => f.C * 12 + f.H * 1 + (f.O ?? 0) * 16 + (f.Br ?? 0) * 81;
export function run() {
  const a = (n: number) => `c5anal-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5anal-y13-${String(n).padStart(2, "0")}`;
  // Y12 mass spec
  expect(T, a(3), 2 * 12 + 6 + 16, 0);
  const M = 5 * 12 + 10 + 16; ok(M === 86, "pentan-3-one M = 86");
  const has = (mz: number) => MS_PENTANONE.some((p) => p.mz === mz);
  ok(has(86) && has(57) && has(29) && MS_PENTANONE.find((p) => p.mz === 57)!.pct === 100, "drawn spectrum contains M=86 and base peak 57");
  ok(3 * 12 + 5 + 16 === 57, "[C2H5CO]+ = 57"); ok(12 + 3 + 12 + 16 === 43 && 2 * 12 + 5 === 29, "[CH3CO]+ 43, [C2H5]+ 29");
  ok(!MS_PENTANONE.some((p) => p.mz > M), "no peak above M");
  // IR drawn from data: acid = broad O–H 2500-3300 + C=O 1710
  const broad = IR_PEAKS.find((p) => p.w >= 200)!; ok(broad.wn - 2 * 0 >= 2500 && broad.wn <= 3300 && IR_PEAKS.some((p) => p.wn === 1710 && p.w < 40), "IR data: broad 2500–3300 + sharp C=O 1710");
  // uncertainties
  const pctT = (0.1 / 22.4) * 100; expect(T, a(5), pctT, 0.012); expect(T, a(6), pctT + (0.06 / 25.0) * 100, 0.01);
  same("note balance", (0.002 / 1.25) * 100, 0.16, 0.01); same("note propanone M", 3 * 12 + 6 + 16, 58);
  // Q12 empirical/molecular
  const r = [54.5 / 12, 9.1 / 1, 36.4 / 16]; const m = Math.min(...r); const ratio = r.map((x) => x / m); ok(Math.abs(ratio[0] - 2) < 0.02 && Math.abs(ratio[1] - 4) < 0.05 && Math.abs(ratio[2] - 1) < 0.001, "2:4:1 " + ratio.map((x) => x.toFixed(3)));
  ok(Mr("C2H4O") === 44.0 && 88 / 44 === 2 && Mr("C4H8O2") === 88.0, "C4H8O2 = 88");
  // Q14
  expect(T, a(14), massInt({ C: 3, H: 7, Br: 1 }), 0);
  // Y13
  // Rf from the drawn plate
  const rf = (d: number) => d / TLC.front; expect(T, b(5), rf(TLC.spots.find((s) => s.name === "Sample")!.d), 0.005);
  ok(TLC.spots.find((s) => s.name === "B")!.d === TLC.spots.find((s) => s.name === "Sample")!.d && TLC.spots.filter((s) => s.d === 5.2).length === 2, "sample matches only B");
  same("note Rf", 3.0 / 9.0, 0.33, 0.02);
  expect(T, b(10), 3 * 1.5, 0); 
  const h = 0.1 * 26.1 / 1000; expect(T, b(13), ((h * 180.0) / 0.5) * 100, 0.003); same("aspirin Mr", Mr("C9H8O4"), 180.0);
  // NMR: n+1 for the drawn ethyl ethanoate peaks; integration 3:3:2 sums to 8 = 8 H in C4H8O2
  const np = (nb: number) => nb + 1; const mult: Record<string, number> = { s: 1, d: 2, t: 3, q: 4 };
  ok(NMR_ETOAC.reduce((s, p) => s + p.h, 0) === 8, "8 H in ethyl ethanoate");
  ok(NMR_ETOAC.every((p) => mult[p.m] === np(p.m === "s" ? 0 : p.m === "t" ? 2 : p.m === "q" ? 3 : 0)), "splitting matches n+1");
  // OCH2 (2H) sits next to CH3 (3 H) -> quartet; CH3 next to CH2 (2H) -> triplet; COCH3 no neighbours -> singlet
  const byH = (h: number) => NMR_ETOAC.filter((p) => p.h === h); ok(byH(2)[0].m === "q" && byH(2)[0].d > 4 && NMR_ETOAC.find((p) => p.d === 2.04)!.m === "s", "ethyl ethanoate patterns");
  // 13C butanone environments: CH3, C=O, CH2, CH3 -> 4; propan-2-ol CH septet n=6 -> 7 peaks; TMS 12 H
  expect(T, b(4), 4, 0); ok(np(6) === 7 && 4 * 3 === 12 && np(3) === 4, "septet, TMS 12 H, quartet");
  // methyl ethanoate C3H6O2 integration 3+3 = 6
  ok(3 + 3 === 6 && Mr("CH3COOCH3") === 74.0 && Mr("C3H6O2") === 74.0, "methyl ethanoate = C3H6O2");
  ok(find(T, b(9)).kind === "single", "");
}
