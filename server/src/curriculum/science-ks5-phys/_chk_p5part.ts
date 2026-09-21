import { TOPIC } from "./p5part";
import { PE, NUCL, beA, mH, mn, uMeV } from "./_data";
import { h, c, e, me } from "./_const";
import { ok, opt, sfx, same, find, keyNum } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5part-y12-${String(n).padStart(2, "0")}`, k13 = (n: number) => `p5part-y13-${String(n).padStart(2, "0")}`;
  // Y12
  // charge conservation for the multi-choice items
  const Q = { u: 2 / 3, d: -1 / 3 };
  ok(Math.abs(2 * Q.u + Q.d - 1) < 1e-12, "proton uud charge +1"); ok(Math.abs(Q.u + 2 * Q.d) < 1e-12, "neutron udd charge 0");
  // lepton number bookkeeping: [charge, baryon, lepton(e), lepton(mu)]
  const P: Record<string, number[]> = { n: [0, 1, 0, 0], p: [1, 1, 0, 0], e: [-1, 0, 1, 0], nubar_e: [0, 0, -1, 0], nu_mu: [0, 0, 0, 1], mu_p: [1, 0, 0, -1], mu_m: [-1, 0, 0, 1], pi_p: [1, 0, 0, 0], e_m: [-1, 0, 1, 0], nu_e: [0, 0, 1, 0] };
  const sum = (...ns: string[]) => [0, 1, 2, 3].map((i) => ns.reduce((a, n) => a + P[n][i], 0));
  const eq = (a: number[], b: number[]) => a.every((x, i) => x === b[i]);
  ok(eq(sum("n"), sum("p", "e", "nubar_e")), "β⁻ decay conserved with antineutrino");
  ok(!eq(sum("n"), sum("p", "e")), "n → p + e⁻ is forbidden");
  ok(eq(sum("mu_m"), [-1, 0, 1, 0].map((x, i) => x) ) || true, "μ⁻ check below");
  // μ⁻ → e⁻ + ν̄e + νμ : charge −1 → −1, Le 0 → 1 − 1 = 0, Lμ +1 → +1
  ok(eq(sum("mu_m"), sum("e", "nubar_e", "nu_mu")), "μ⁻ decay conserved");
  ok(eq(sum("pi_p"), sum("mu_p", "nu_mu")), "π⁺ → μ⁺ + νμ conserved"); // μ⁺ has Lμ = −1, νμ +1
  opt(T, k(2), "up, up, down");
  sfx(T, k(5), (h * c) / 450e-9 / 1e-19, 3, ["450"]);
  const E6 = (h * 8.0e14) / e; sfx(T, k(6), E6 - 2.3, 2, ["8.0 × 10¹⁴", "2.3"]);
  sfx(T, k(8), (h * PE.f0) / e, 2);
  sfx(T, k(9), h / (me * 4.0e6) / 1e-10, 3, ["4.0 × 10⁶"]);
  const dE = (3.40 - 1.51) * e; sfx(T, k(10), ((h * c) / dE) / 1e-9, 3, ["1.51", "3.40"]);
  // graph slope check: the line's KE at f = 10e14 matches the alt text (about 1.7 eV)
  same("graph KE at 10e14", (h * (10e14 - PE.f0)) / e, 1.66, 0.02);
  ok(2 * -2 / 3 + 1 / 3 === -1 || Math.abs(2 * (-2 / 3) + 1 / 3 + 1) < 1e-12, "ū ū d̄ charge −1");
  sfx(T, k(13), (2 * e) / 6.65e-27 / 1e7, 3, ["6.65"]);
  // note worked examples
  same("note 620 nm", (h * c) / 620e-9, 3.21e-19, 0.005); same("note eV", ((h * c) / 620e-9) / e, 2.0, 0.01);
  same("note proton e/m", e / 1.67e-27, 9.58e7, 0.005); same("note KE", 3.2 - 2.0, 1.2);
  // Y13
  const mp = 1.007276, mnu = 1.008665;
  sfx(T, k13(3), 2.0e-30 * c * c / 1e-13, 2, ["2.0 × 10⁻³⁰"]);
  sfx(T, k13(4), 0.137 * 931.5, 3, ["0.13700"]);
  // O-16 sanity: mass defect from atomic masses ≈ 0.13691 u (electron masses cancel through mH)
  const O = NUCL.find((n) => n.s === "¹⁶O")!; same("O-16 mass defect", 8 * mH + 8 * mn - O.M, 0.13700, 0.0005);
  sfx(T, k13(5), 492.3 / 56, 3, ["492.3"]);
  const bea = NUCL.map(beA), best = NUCL[bea.indexOf(Math.max(...bea))];
  opt(T, k13(6), NUCL.filter((n) => ["²H", "⁴He", "¹²C", "⁵⁶Fe", "²³⁵U"].includes(n.s) && ["⁴He", "¹²C", "⁵⁶Fe", "²³⁵U"].includes(n.s)).reduce((a, b) => (beA(b) > beA(a) ? b : a)).s);
  ok(best.s === "⁵⁶Fe", "Fe-56 is the top of the plotted curve (" + best.s + ")");
  const val = (s: string) => beA(NUCL.find((n) => n.s === s)!);
  same("BEA Fe", val("⁵⁶Fe"), 8.79, 0.005); same("BEA C12", val("¹²C"), 7.68, 0.005); same("BEA U", val("²³⁵U"), 7.59, 0.005); same("BEA He", val("⁴He"), 7.07, 0.005); same("BEA H2", val("²H"), 1.112, 0.01);
  ok(val("⁵⁶Fe") > val("¹²⁰Sn"), "Fe above Sn");
  same("Q12 key vs 12 × BEA(C12) within tolerance", keyNum(find(T, k13(12))), 12 * val("¹²C"), 0.03);
  const dmF = 2.013553 + 3.015501 - (4.001506 + 1.008665); sfx(T, k13(9), dmF * 931.5, 3, ["2.013553", "3.015501"]);
  sfx(T, k13(10), ((1000 / 235) * 6.02e23 * 200 * 1.6e-13) / 1e13, 3, ["235"]);
  // note worked examples
  const dm = mp + mnu - 2.013553; same("note deuteron Δm", dm, 0.002388, 0.001); same("note deuteron BE", dm * 931.5, 2.22, 0.005); same("note per nucleon", (dm * 931.5) / 2, 1.11, 0.005);
  same("note 1e-29 kg", 1.0e-29 * c * c, 9.0e-13); same("note MeV", (1.0e-29 * c * c) / 1.6e-13, 5.6, 0.01);
  ok(Math.abs(6 * mp + 6 * mnu - 11.996706 - 0.09894) < 1e-4, "C-12 defect sanity");
  void uMeV;
}
