import { TOPIC } from "./p5mech";
import { VT, INCL } from "./_data";
import { g } from "./_const";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5mech-y12-${String(n).padStart(2, "0")}`;
  opt(T, k(1), "velocity");
  sfx(T, k(2), 1200 * 2.5, 4, ["1200", "2.5"]);
  sfx(T, k(3), 12 * 8 + 0.5 * 1.5 * 64, 3, ["12 m s⁻¹", "1.5", "8.0"]);
  sfx(T, k(4), Math.sqrt(2 * 3.2 * 45), 3, ["3.2", "45"]);
  const tf = Math.sqrt((2 * 20) / g); sfx(T, k(5), 12 * tf, 3, ["12 m s⁻¹", "20 m"]);
  let area = 0; for (let i = 1; i < VT.length; i++) area += ((VT[i][1] + VT[i - 1][1]) / 2) * (VT[i][0] - VT[i - 1][0]);
  sfx(T, k(6), area, 3); same("v–t area 117", area, 117);
  sfx(T, k(7), (2 * 6) / (2 + 4), 2, ["2.0 kg", "6.0", "4.0 kg"]);
  sfx(T, k(8), (240 * g * 15) / 20, 3, ["240", "15 m", "20 s"]);
  const stress = 60 / 6.0e-7, strain = 1.5e-3 / 1.8; sfx(T, k(9), stress / strain / 1e11, 2, ["1.8 m", "6.0 × 10⁻⁷", "60 N", "1.5 mm"]);
  sfx(T, k(10), INCL.m * g * Math.sin((INCL.theta * Math.PI) / 180) - INCL.fr, 3, ["6.0 kg", "25°", "10 N"]);
  const v = (1.5 * 8) / 4, ke0 = 0.5 * 1.5 * 64, ke1 = 0.5 * 4 * v * v; sfx(T, k(11), ke0 - ke1, 2, ["1.5 kg", "8.0", "2.5 kg"]);
  sfx(T, k(12), (0.45 * (4 + 6)) / 0.03, 3, ["0.45", "6.0", "4.0", "0.030"]);
  sfx(T, k(13), 50 + (0.2 * 40) / 0.5, 2, ["0.20 N", "10 cm", "0.50 N"]);
  // note
  same("note brake a", -(25 ** 2) / (2 * 50), -6.25); same("note momentum", (2 * 3) / 3, 2); same("note E", (100 / 1e-6) / (1e-3 / 2), 2e11);
  ok(Math.abs((2 * 6) / 6 - 2) < 1e-9, "Q7 v = 2.0");
}
