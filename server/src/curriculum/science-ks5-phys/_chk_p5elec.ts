import { TOPIC } from "./p5elec";
import { CIRC, IV, CELL, RC, DIS } from "./_data";
import { e } from "./_const";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5elec-y12-${String(n).padStart(2, "0")}`, k13 = (n: number) => `p5elec-y13-${String(n).padStart(2, "0")}`;
  // Y12
  opt(T, k(1), "1 s");
  sfx(T, k(2), 8.0 * 230, 3, ["8.0 A", "230"]);
  sfx(T, k(3), 0.75 * 2.0 * 60, 2, ["0.75", "2.0 minutes"]);
  const A = Math.PI * (0.2e-3) ** 2; sfx(T, k(4), (4.9e-7 * 2.5) / A, 3, ["4.9 × 10⁻⁷", "2.5 m", "0.40 mm"]);
  const par = 1 / (1 / CIRC.ra + 1 / CIRC.rb); sfx(T, k(5), CIRC.V / (CIRC.r1 + par), 2);
  sfx(T, k(6), 12.0 - 15 * 0.4, 2, ["12.0 V", "0.40", "15 A"]);
  // I–V shapes: lamp (B) has R = V/I rising, thermistor (D) falling, diode (C) zero below 0.6 V, resistor (A) constant
  const vs = [0.5, 1, 1.5, 2, 3, 4];
  const R = (f: (v: number) => number) => vs.map((v) => v / f(v));
  const inc = (a: number[]) => a.every((x, i) => i === 0 || x > a[i - 1]), dec = (a: number[]) => a.every((x, i) => i === 0 || x < a[i - 1]);
  ok(inc(R(IV.B)), "lamp R increases with V"); ok(dec(R(IV.D)), "thermistor R decreases with V"); ok(R(IV.A).every((r) => Math.abs(r - R(IV.A)[0]) < 1e-9), "resistor R constant");
  ok(IV.C(0.5) === 0 && IV.C(-2) === 0 && IV.C(1.5) > 0.5, "diode shape");
  ok(IV.B(-2) === -IV.B(2) && IV.D(-2) === -IV.D(2), "B and D symmetric");
  opt(T, k(7), "B");
  sfx(T, k(8), 12 * 1.8 / (2.7 + 1.8), 2, ["2.7", "1.8", "12 V"]);
  // internal resistance from the plotted points (least-squares gradient)
  const Iv = CELL.I, Vv = CELL.I.map((i, n) => CELL.emf - CELL.r * i + CELL.noise[n]);
  const mI = Iv.reduce((a, b) => a + b) / Iv.length, mV = Vv.reduce((a, b) => a + b) / Iv.length;
  const grad = Iv.reduce((a, x, i) => a + (x - mI) * (Vv[i] - mV), 0) / Iv.reduce((a, x) => a + (x - mI) ** 2, 0);
  same("LS gradient equals −r", -grad, 1.5, 0.03); sfx(T, k(9), CELL.r, 2);
  const n = 8.5e28, Ar = Math.PI * (0.6e-3) ** 2; sfx(T, k(10), (3.5 / (n * Ar * e)) * 1e3, 3, ["1.2 mm", "3.5 A", "8.5 × 10²⁸"]);
  sfx(T, k(11), 81 / 8 + 81 / 12, 3, ["8.0 Ω", "12 Ω", "9.0 V"]);
  // resistance changes: double length ×2, half diameter ×4
  ok(2 > 1 && 4 > 1, "Q12 doubling L and halving d both raise R");
  same("note parallel", 1 / (1 / 30 + 1 / 20), 12); same("note internal r", 1.5 - (1.5 / 5.0) * 0.5, 1.35); same("note lamp", 60 / 230, 0.26, 0.01);
  // Y13
  sfx(T, k13(2), (2.4e-3 / 6.0) / 1e-6, 3, ["2.4 mC", "6.0 V"]);
  sfx(T, k13(3), 0.5 * 470e-6 * 81 * 1e3, 3, ["470", "9.0"]);
  sfx(T, k13(4), 47e3 * 220e-6, 3, ["47 kΩ", "220 μF"]);
  sfx(T, k13(5), RC.V0 * Math.exp(-30 / (RC.R * RC.C)), 3, ["12 V", "30 s"]);
  sfx(T, k13(6), 4.7e3 * 1.0e-3 * Math.log(4), 3, ["1.0 mF", "4.7 kΩ", "25%"]);
  const ser = 1 / (1 / 4 + 1 / 12); sfx(T, k13(7), 6 + ser, 2, ["6.0 μF", "4.0 μF", "12 μF"]);
  // discharge graph: 1/e point at t = τ, R = τ/C
  same("graph V(τ) = V0/e", DIS.V0 * Math.exp(-DIS.tau / DIS.tau), DIS.V0 / Math.E); sfx(T, k13(8), (DIS.tau / 470e-6) / 1e3, 2, ["470"]);
  sfx(T, k13(10), (0.5 * 120e-6 * 300 ** 2) / 1.0e-3, 2, ["120 μF", "300 V", "1.0 ms"]);
  const RCt = 2.0 / Math.log(6.0 / 2.2); sfx(T, k13(12), RCt / 100e-6 / 1e3, 3, ["100 μF", "2.2 V", "2.0 s"]);
  opt(T, k13(9), "−1 ÷ RC"); opt(T, k13(13), "It doubles");
  same("note E", 0.5 * 100e-6 * 25, 1.25e-3); same("note decay", 10 * Math.exp(-2), 1.35, 0.005); same("note τ", 2.0e3 * 500e-6, 1.0);
  same("half-life factor", Math.log(2), 0.69, 0.01);
}
