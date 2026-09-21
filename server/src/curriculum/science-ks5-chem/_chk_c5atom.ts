import { TOPIC as T } from "./c5atom";
import { expect, ok, same } from "./_ck";
import { MS_MG, IE_X } from "./_data";

export function run() {
  const k = (n: number) => `c5atom-y12-${String(n).padStart(2, "0")}`;
  // Q1: 27Al3+: p=13, n=27-13, e=13-3
  ok(27 - 13 === 14 && 13 - 3 === 10, "q1 counts");
  // Q3: Ar Mg from the drawn data
  const sumPct = MS_MG.reduce((s, p) => s + p.pct, 0); ok(Math.abs(sumPct - 100) < 1e-9, "Mg abundances sum to 100");
  expect(T, k(3), MS_MG.reduce((s, p) => s + p.mz * p.pct, 0) / sumPct, 0.003);
  // Q9: boron
  expect(T, k(9), (10 * 19.9 + 11 * 80.1) / 100, 0.003); same("note boron 1080.1", 10 * 19.9 + 11 * 80.1, 1080.1);
  // Q10: chlorine 37Cl%: 37x + 35(1-x) = 35.5
  expect(T, k(10), ((35.5 - 35) / 2) * 100, 0.001);
  same("note Li", (6 * 7.5 + 7 * 92.5) / 100, 6.925, 0.0001); ok(Math.abs(6 * 7.5 + 7 * 92.5 - 692.5) < 1e-9, "note Li 692.5");
  // Q6: the big jump is between IE3 and IE4 (ratio of successive IEs)
  const ratios = IE_X.slice(1).map((v, i) => v / IE_X[i]); const jump = ratios.indexOf(Math.max(...ratios)) + 1; // jump after ionisation #jump
  ok(jump === 3, "IE jump after 3rd electron -> group 3(13)");
  ok(Math.max(...ratios) > 3.5 && ratios.filter((r) => r < 3.5).length === 4, "only one big jump");
  // Q13: Cl2 isotopologues 9:6:1
  const p = 0.75, r = 0.25; ok(Math.abs(p * p * 16 - 9) < 1e-9 && Math.abs(2 * p * r * 16 - 6) < 1e-9 && Math.abs(r * r * 16 - 1) < 1e-9, "Cl2 9:6:1");
  ok(35 + 35 === 70 && 35 + 37 === 72 && 37 + 37 === 74, "Cl2 m/z");
  // Cr electron count
  const cr = 2 + 2 + 6 + 2 + 6 + 5 + 1; ok(cr === 24, "Cr config sums to 24"); ok(2 + 2 + 6 + 2 + 6 === 18 && 18 + 2 === 20, "Ca2+ config 18 e; Ca = 20");
}
