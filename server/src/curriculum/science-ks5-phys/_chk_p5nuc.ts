import { TOPIC } from "./p5nuc";
import { DEC, decRate } from "./_data";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5nuc-y13-${String(n).padStart(2, "0")}`, LN2 = Math.LN2;
  // decay bookkeeping: β⁻ raises Z by 1
  ok(90 + 1 === 91, "daughter Z = 91");
  sfx(T, k(4), 1200 * 0.5 ** (12 / 3.0), 2, ["1200 Bq", "3.0 days", "12 days"]);
  sfx(T, k(5), (LN2 / (8.0 * 86400)) / 1e-6, 3, ["8.0 days"]);
  sfx(T, k(6), (2.5e-9 * 3.0e15) / 1e6, 2, ["3.0 × 10¹⁵", "2.5 × 10⁻⁹"]);
  sfx(T, k(7), (5.0e10 * Math.exp(-0.045 * 30)) / 1e10, 3, ["5.0 × 10¹⁰", "0.045", "30 h"]);
  // decay graph: corrected rate halves at t = 8.0; naive (raw) halving of 200 → 100 occurs later
  const corr = (t: number) => decRate(t) - DEC.bg;
  same("corrected rate at 8.0 min is half", corr(8.0), DEC.r0 / 2); sfx(T, k(8), DEC.hl, 2);
  let tn = 0; while (decRate(tn) > (DEC.bg + DEC.r0) / 2) tn += 0.001; ok(Math.abs(tn - 9.36) < 0.05, `naive half-life ${tn.toFixed(2)} ≈ 9.4 (explanation)`);
  ok(decRate(0) === 200 && Math.abs(decRate(8) - 110) < 1e-9, "measured 200 → 110 at 8.0 min");
  sfx(T, k(9), (Math.log(15.3 / 3.8) / LN2) * 5730, 3, ["15.3", "3.8", "5730"]);
  sfx(T, k(10), 1.2 * 238 ** (1 / 3), 3, ["238", "1.2 fm"]);
  sfx(T, k(11), 240 / 9, 3, ["240", "0.50 m", "1.5 m"]);
  sfx(T, k(12), (4.0e6 * (2.0 * 3600)) / LN2 / 1e10, 3, ["2.0 hours", "4.0 × 10⁶"]);
  // note
  same("note 3 half-lives", 8.0e6 / 8, 1.0e6); same("note λ", LN2 / 21600, 3.2e-5, 0.01); same("note A", 2.0e-5 * 5.0e9, 1.0e5);
  opt(T, k(2), "2 protons and 2 neutrons");
}
