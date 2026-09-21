import { TOPIC } from "./p5astro";
import { HR } from "./_data";
import { c, sigma, wien } from "./_const";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5astro-y13-${String(n).padStart(2, "0")}`;
  // H–R: W must be hot (left of the Sun's 5800 K) and far less luminous than the main-sequence at its temperature
  const W = HR.stars.find((s) => s.n === "W")!, ms = (Tm: number) => { const p = HR.mainSeq; for (let i = 1; i < p.length; i++) if (Tm <= p[i - 1][0] && Tm >= p[i][0]) { const f = (Math.log(p[i - 1][0]) - Math.log(Tm)) / (Math.log(p[i - 1][0]) - Math.log(p[i][0])); return Math.exp(Math.log(p[i - 1][1]) + f * (Math.log(p[i][1]) - Math.log(p[i - 1][1]))); } return NaN; };
  ok(W.T > 5800 && W.L < ms(W.T) / 100, `W is white-dwarf-like: L=${W.L} vs main sequence ${ms(W.T).toFixed(1)}`);
  const X = HR.stars.find((s) => s.n === "X")!; ok(X.T < 5800 && X.L > ms(X.T) * 100, "X is giant-like (cool, very luminous)");
  opt(T, k(1), "a white dwarf");
  sfx(T, k(2), 1 / 0.25, 2, ["0.25"]);
  sfx(T, k(3), wien / 830e-9, 3, ["830 nm"]);
  sfx(T, k(4), (4 * Math.PI * 1.4e9 ** 2 * sigma * 5000 ** 4) / 1e26, 3, ["1.4 × 10⁹", "5000 K"]);
  sfx(T, k(5), ((c * (660.0 - 656.3)) / 656.3) / 1e3, 3, ["656.3", "660.0"]);
  sfx(T, k(6), 2800 / 70, 2, ["2800", "70"]);
  const H0 = 70 / 3.09e19, ageY = 1 / H0 / 3.16e7 / 1e9; sfx(T, k(7), ageY, 3, ["70 km", "3.09 × 10¹⁹", "3.16 × 10⁷"]);
  const r = Math.sqrt(1e5 / (3500 / 5800) ** 4); sfx(T, k(8), r, 3, ["3500 K", "1.0 × 10⁵", "5800 K"]);
  sfx(T, k(9), (4.0e27 / (4 * Math.PI * (2.0e17) ** 2)) / 1e-9, 3, ["4.0 × 10²⁷", "2.0 × 10¹⁷"]);
  sfx(T, k(13), 2 ** 2 * 1.6 ** 4, 3, ["1.6 times", "twice the radius"]);
  // note
  same("note Wien", wien / 5800, 500e-9, 0.002); same("note z", 3.0e6 / c, 0.010); same("note Δλ", 500 * 0.010, 5.0); same("note L ratio", 2 ** 2, 4);
  same("Q12 vs equal-temperature check", 2 ** 2 * 1.6 ** 4, 26.2144);
}
