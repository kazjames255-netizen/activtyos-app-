import { TOPIC } from "./p5field";
import { FLUX } from "./_data";
import { G, eps0, e, me, mp } from "./_const";
import { ok, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5field-y13-${String(n).padStart(2, "0")}`;
  const ME = 5.97e24, RE = 6.37e6;
  sfx(T, k(2), 0.25 * 3.0 * 0.4, 2, ["0.40 m", "3.0 A", "0.25 T"]);
  sfx(T, k(3), (G * 6.42e23) / 3.39e6 ** 2, 3, ["6.42 × 10²³", "3.39 × 10⁶"]);
  const r4 = 4.22e7, v4 = Math.sqrt((G * ME) / r4); sfx(T, k(4), ((2 * Math.PI * r4) / v4) / 3600, 3, ["4.22 × 10⁷"]);
  same("Q4 explanation speed", v4, 3070, 0.005);
  sfx(T, k(5), ((3.0e-9 * 5.0e-9) / (4 * Math.PI * eps0 * 0.04 ** 2)) / 1e-6, 3, ["3.0 nC", "5.0 nC", "4.0 cm"]);
  sfx(T, k(6), ((e * (400 / 0.02)) / me) / 1e15, 3, ["2.0 cm", "400 V"]);
  sfx(T, k(7), (mp * 2.0e6) / (0.1 * e), 3, ["2.0 × 10⁶", "0.10 T"]);
  sfx(T, k(8), (200 * 4.0e-3) / 0.02, 2, ["200 turns", "4.0 mWb", "0.020 s"]);
  const dF = FLUX[3][1] - FLUX[2][1], dT = FLUX[3][0] - FLUX[2][0]; sfx(T, k(9), Math.abs(dF / dT), 2);
  ok(Math.abs((FLUX[1][1] - FLUX[0][1]) / (FLUX[1][0] - FLUX[0][0]) - 3) < 1e-9, "rising section 3.0 V (differs from the asked section)");
  sfx(T, k(10), Math.sqrt((2 * G * ME) / RE) / 1e3, 3, ["5.97 × 10²⁴", "6.37 × 10⁶"]);
  sfx(T, k(12), (12 * 4.0) / 230, 3, ["230 V", "4.0 A", "12 V"]);
  // note
  same("note g", (G * ME) / RE ** 2, 9.81, 0.002); same("note F wire", 0.4 * 5 * 0.1, 0.2); same("note emf", (100 * 2e-3) / 0.5, 0.4);
}
