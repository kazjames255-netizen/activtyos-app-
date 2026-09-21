import { TOPIC } from "./p5therm";
import { PT } from "./_data";
import { R, kB } from "./_const";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5therm-y13-${String(n).padStart(2, "0")}`;
  opt(T, k(1), "−273 °C");
  sfx(T, k(2), 37 + 273, 3, ["37 °C"]);
  sfx(T, k(3), (0.5 * 385 * 80) / 1e3, 3, ["0.50 kg", "385", "20 °C", "100 °C"]);
  sfx(T, k(4), (0.15 * 3.34e5) / 1e3, 3, ["0.15 kg", "3.34 × 10⁵"]);
  sfx(T, k(5), (2.4 * 0.3) / 0.1, 2, ["2.4 × 10⁵", "0.30 m³", "0.10 m³"]);
  sfx(T, k(6), (1.5 * 353) / 288, 3, ["1.5 × 10⁵", "288 K", "353 K"]);
  sfx(T, k(7), (3.0e5 * 0.04) / (R * 300), 3, ["0.040 m³", "3.0 × 10⁵", "300 K"]);
  sfx(T, k(8), (1.5 * kB * 300) / 1e-21, 3, ["300 K"]);
  sfx(T, k(9), Math.sqrt((3 * kB * 300) / 4.65e-26), 3, ["4.65 × 10⁻²⁶", "300 K"]);
  sfx(T, k(10), ((1 / 3) * 4.0e22 * 6.6e-27 * 1.9e6) / 2.0e-3 / 1e3, 3, ["2.0 × 10⁻³", "4.0 × 10²²", "6.6 × 10⁻²⁷", "1.9 × 10⁶"]);
  // graph: least-squares line through the plotted points, extrapolated to p = 0 (absolute zero)
  const x = PT.theta, y = PT.theta.map(PT.p), n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  const m = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0) / x.reduce((a, xi) => a + (xi - mx) ** 2, 0), x0 = mx - my / m;
  same("extrapolated absolute zero", x0, -273.15, 0.001); sfx(T, k(11), x0, 3);
  ok(Math.abs(x0 - -273) < 1, "Q11 −273 within tolerance");
  opt(T, k(13), "It doubles"); same("KE ratio 600/300", 600 / 300, 2);
  same("note Q", 2.0 * 4200 * 30 / 1e3, 252); same("note p", (0.020 * R * 300) / 1.0e-3, 4.99e4, 0.002);
}
