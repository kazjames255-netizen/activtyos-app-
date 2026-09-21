import { TOPIC as T } from "./c5org2";
import { Mr } from "./_atoms";
import { expect, same, ok } from "./_ck";

export function run() {
  const k = (n: number) => `c5org2-y13-${String(n).padStart(2, "0")}`;
  expect(T, k(6), 3 * 120 - 208, 0);
  const th = (2.0 / Mr("C7H6O3")) * Mr("C9H8O4"); same("Mr salicylic", Mr("C7H6O3"), 138.0); same("Mr aspirin", Mr("C9H8O4"), 180.0); same("theoretical aspirin", th, 2.609, 0.002); expect(T, k(12), (1.85 / th) * 100, 0.004);
  // aspirin = salicylic + C2H2O (ethanoic anhydride reacts, ethanoic acid lost): 138.0 + 42.0 = 180.0
  same("aspirin = SA + C2H2O", Mr("C7H6O3") + Mr("C2H2O"), Mr("C9H8O4"));
  // note: ester yield
  same("Mr ethanoic acid", Mr("CH3COOH"), 60.0); same("Mr ethyl ethanoate", Mr("CH3COOC2H5"), 88.0); same("note yield", (5.28 / ((6.0 / 60.0) * 88.0)) * 100, 60.0, 0.002);
  // chirality: butan-2-ol C2 groups H, OH, CH3, C2H5 all different
  const groups = ["H", "OH", "CH3", "C2H5"]; ok(new Set(groups).size === 4, "butan-2-ol chiral C");
  // chain length: 1-bromopropane C3 + CN -> butanenitrile C4 -> butanoic acid C4
  ok(3 + 1 === 4, "one carbon added");
}
