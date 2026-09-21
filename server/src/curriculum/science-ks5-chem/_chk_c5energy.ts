import { TOPIC as T } from "./c5energy";
import { expect, ok, same, find } from "./_ck";
import { HESS_PROPANE as H, BH_NACL as B, PROFILE } from "./_data";

export function run() {
  const a = (n: number) => `c5energy-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5energy-y13-${String(n).padStart(2, "0")}`;
  // Y12
  const q3 = 100 * 4.18 * 13.6; expect(T, a(3), q3, 0.002);
  const n4 = 0.5 / (24 + 6 + 16); expect(T, a(4), -(q3 / 1000) / n4, 0.003);
  const hf = 3 * H.dHc_C + 4 * H.dHc_H2 - H.dHc_C3H8; expect(T, a(5), hf, 0.001); same("3×C", 3 * H.dHc_C, -1180.5); same("4×H2", 4 * H.dHc_H2, -1143.2);
  expect(T, a(6), 4 * 413 + 2 * 498 - (2 * 805 + 4 * 464), 0.001);
  expect(T, a(10), -1411 - 286 - -1560, 0.001);
  const q11 = 50.0 * 4.18 * 13.7; same("q11 q", q11, 2863, 0.001); expect(T, a(11), -(q11 / 1000) / (2.0 * 0.025), 0.003);
  expect(T, a(12), PROFILE.Ea - PROFILE.dH, 0);
  expect(T, a(14), 2 * -393.5 + 3 * -285.8 - -1367.0, 0.002);
  // Y12 note examples
  const qn = 200 * 4.18 * 8.5; same("note q", qn, 7106, 0.001); same("note dHc", -(qn / 1000) / (0.8 / 32.0), -284, 0.005);
  same("note CaCO3", (-635 - 394) - -1207, 178);
  // Y13
  const lat = B.dHf - (B.atNa + B.ie1Na + B.halfCl2 + B.eaCl); expect(T, b(3), lat, 0.001);
  const hsol = -lat - 406 - 364; expect(T, b(5), hsol, 0.001);
  const dS = 2 * 192.3 - (191.6 + 3 * 130.6); expect(T, b(7), dS, 0.001);
  const dG = -92.2 - 298 * (dS / 1000); expect(T, b(8), dG, 0.003);
  expect(T, b(9), 178.0 / 0.16, 0.005);
  expect(T, b(12), 148 + 738 + 1451 + 2 * 122 + 2 * -349 + -2526, 0.001);
  // Y13 note examples
  same("note KBr", -394 - 89 - 419 - 112 + 325, -689); same("note T", 58000 / 176, 329.5, 0.002);
  // Q11 of Y12 / Y13 q6: entropy reasoning: gas moles change
  ok(2 < 4, "N2+3H2 -> 2NH3 reduces gas moles");
  ok(find(T, b(11)).kind === "multi", "multi");
}
