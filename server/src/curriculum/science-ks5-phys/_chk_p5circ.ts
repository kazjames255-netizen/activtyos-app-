import { TOPIC } from "./p5circ";
import { SHM } from "./_data";
import { g } from "./_const";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5circ-y13-${String(n).padStart(2, "0")}`;
  opt(T, k(1), "B"); // acceleration is towards the centre: the diagram places B towards the centre
  sfx(T, k(2), ((45 / 60) * 2 * Math.PI), 3, ["45 revolutions"]);
  sfx(T, k(3), (1200 * 15 ** 2) / 40, 4, ["1200 kg", "40 m", "15 m s⁻¹"]);
  sfx(T, k(4), ((2 * Math.PI * 7.0e6) / 5900) / 1e3, 3, ["7.0 × 10⁶", "5900"]);
  sfx(T, k(5), 2 * Math.PI * Math.sqrt(0.25 / 40), 3, ["0.25 kg", "40 N m⁻¹"]);
  sfx(T, k(6), 2 * Math.PI * Math.sqrt(1.5 / g), 3, ["1.50 m"]);
  const w = (2 * Math.PI) / SHM.T; sfx(T, k(7), w * (SHM.A / 100), 3);
  sfx(T, k(8), 5.0 * Math.sqrt(0.08 ** 2 - 0.05 ** 2), 3, ["0.080", "5.0", "0.050"]);
  const w9 = 2 * Math.PI * 2.5; sfx(T, k(9), 0.3 * w9 ** 2 * 0.04, 3, ["0.30 kg", "0.040 m", "2.5 Hz"]);
  sfx(T, k(11), 0.5 * 0.5 * 36 * (0.1 ** 2 - 0.06 ** 2), 3, ["0.50 kg", "0.10 m", "6.0 rad", "0.060"]);
  // energy consistency: KE + PE = total at x = 0.060
  const E = 0.5 * 0.5 * 36 * 0.1 ** 2, PE = 0.5 * 0.5 * 36 * 0.06 ** 2; same("KE + PE = E", 0.0576 + PE, E);
  // note
  same("note F", 0.5 * 9 / 1.2, 3.75); same("note T", 2 * Math.PI * Math.sqrt(0.4 / 25), 0.79, 0.01); same("note f", 1 / (2 * Math.PI * Math.sqrt(0.4 / 25)), 1.3, 0.04); same("note ω", (2 * Math.PI) / 0.5, 12.6, 0.005);
  // graph starts at maximum displacement: x(0) = A
  ok(Math.abs(SHM.A * Math.cos(0) - SHM.A) < 1e-12, "x(0) = A");
}
