import { TOPIC } from "./p5wave";
import { DS, STAND } from "./_data";
import { c } from "./_const";
import { ok, sfx, same } from "./_ck";

const deg = (r: number) => (r * 180) / Math.PI, rad = (d: number) => (d * Math.PI) / 180;
export function run() {
  const T = TOPIC, k = (n: number) => `p5wave-y12-${String(n).padStart(2, "0")}`, k13 = (n: number) => `p5wave-y13-${String(n).padStart(2, "0")}`;
  sfx(T, k(2), 2.5 * 0.36, 2, ["2.5", "0.36"]);
  sfx(T, k(3), ((2.1e-3 * 0.4e-3) / 1.5) / 1e-9, 2, ["0.40", "1.5", "2.1"]);
  sfx(T, k(4), deg(Math.asin((2 * 450e-9) / (1 / 600e3))), 3, ["600", "450"]);
  sfx(T, k(6), deg(Math.asin(Math.sin(rad(55)) / 1.62)), 3, ["1.62", "55"]);
  sfx(T, k(7), deg(Math.asin(1 / 1.52)), 3, ["1.52"]);
  // double-slit graph: locate the local maxima of the plotted intensity and measure their spacing
  const ys: number[] = [], N = 4000;
  for (let i = 0; i <= N; i++) ys.push(DS.y0 + ((DS.y1 - DS.y0) * i) / N);
  const I = ys.map(DS.I), peaks: number[] = [];
  for (let i = 1; i < N; i++) if (I[i] > I[i - 1] && I[i] >= I[i + 1] && I[i] > 0.05) peaks.push(ys[i]);
  ok(peaks.length === 7, `7 peaks expected, found ${peaks.length}`);
  const spacing = (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1);
  same("fringe spacing from plotted array", spacing, DS.w, 0.01);
  const lam = ((spacing * 1e-3 * 0.3e-3) / 1.2) / 1e-9; same("Q8 λ from measured spacing", lam, 600, 0.02);
  sfx(T, k(8), 600, 2, ["1.20", "0.30"]);
  ok(Math.abs(3.0 * 4 - 12) < 1e-9, "Q10 intensity ×4"); sfx(T, k(10), 3.0 * 2 ** 2, 2, ["3.0"]);
  sfx(T, k(12), (0.1 / 0.48) * 360, 2, ["0.10", "0.48"]);
  // note
  same("note 340/440", 340 / 440, 0.77, 0.005); same("note fringe", ((650e-9 * 2.0) / 0.5e-3) * 1e3, 2.6, 0.005);
  same("note refraction", deg(Math.asin(Math.sin(rad(40)) / 1.5)), 25.4, 0.005); same("note critical", deg(Math.asin(1 / 1.33)), 48.8, 0.005);
  // Y13
  sfx(T, k13(3), 130 / (2 * 0.65), 3, ["0.65", "130"]);
  sfx(T, k13(4), 3 * 145, 3, ["145"]);
  sfx(T, k13(5), (1 / (2 * 0.6)) * Math.sqrt(64 / 1.0e-3), 3, ["64", "0.60"]);
  sfx(T, k13(6), 340 / (4 * 0.3), 3, ["0.30", "340"]);
  const lamS = (2 * STAND.L) / STAND.n; same("string wavelength", lamS, 1.2); sfx(T, k13(8), 75 * lamS, 2, ["1.80", "75"]);
  sfx(T, k13(10), c / (2 * 0.016) / 1e9, 2, ["1.6 cm"]);
  sfx(T, k13(12), 180 * Math.sqrt(4), 3, ["180"]);
  same("closed vs open fundamental ratio", (340 / (4 * 0.9)) / (340 / (2 * 0.9)), 0.5);
  same("note string", 240 / (2 * 0.5), 240); same("note open", 340 / (2 * 0.85), 200); same("note closed", 340 / (4 * 0.85), 100);
}
