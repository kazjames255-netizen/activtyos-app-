// Run: server/node_modules/.bin/tsx features/learninghub/tools/science/data/graph.selftest.ts   (exit 1 on failure)
import { barGeometry, checkAxes, checkBestFit, checkPlotted, chartScales, fitSegment, fromPixel, groupedMeans, lineThrough, linePath, lineY, mean, median, mode, niceScale, range, regression, repeatAnomalies, snapTo, toPixel, trendAnomalies, type Pt } from "./graph";
import { EXPERIMENTS, experimentById } from "./experiments";

let n = 0, bad = 0;
const ok = (name: string, cond: boolean, detail = "") => { n++; if (!cond) { bad++; console.error(`FAIL ${name} ${detail}`); } };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const eq = (name: string, a: unknown, b: unknown) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// niceScale
eq("nice 0.03-0.47", niceScale(0.03, 0.47, 6).ticks, [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
eq("nice 12-97", niceScale(12, 97, 6).ticks, [0, 20, 40, 60, 80, 100]);
eq("nice negative", niceScale(-7.3, -1.2, 5).ticks, [-8, -6, -4, -2, 0]);
eq("nice straddling zero", niceScale(-3, 8, 5).ticks, [-5, 0, 5, 10]);
eq("nice 50-90 no zero", niceScale(50, 90, 5).ticks, [50, 60, 70, 80, 90]);
eq("nice 50-90 with zero", niceScale(50, 90, 5, true).min, 0);
eq("nice identical values", niceScale(5, 5, 5).ticks.includes(5), true);
ok("nice step is 1/2/5", [1, 2, 5].includes(niceScale(0, 37, 6).step / 10 ** Math.floor(Math.log10(niceScale(0, 37, 6).step))));
ok("nice covers range", (() => { const s = niceScale(3.3, 71.9, 7); return s.min <= 3.3 && s.max >= 71.9; })());
eq("nice no float dust", niceScale(0, 0.9, 9).ticks, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
eq("nice large", niceScale(0, 4300, 5).ticks, [0, 1000, 2000, 3000, 4000, 5000]);
// mapping
const sc = niceScale(0, 10, 5);
ok("toPixel bottom", near(toPixel(0, sc, 300, 20), 300));
ok("toPixel top", near(toPixel(10, sc, 300, 20), 20));
ok("toPixel mid", near(toPixel(5, sc, 300, 20), 160));
ok("fromPixel round trip", near(fromPixel(toPixel(7.3, sc, 300, 20), sc, 300, 20), 7.3));
eq("snapTo 0.1", snapTo(0.34, 0.1), 0.3);
eq("snapTo 5", snapTo(37, 5), 35);
// stats
eq("mean", mean([2, 4, 9]), 5);
eq("median odd", median([9, 1, 5]), 5);
eq("median even", median([1, 2, 3, 10]), 2.5);
eq("mode", mode([1, 2, 2, 3, 3, 4]), [2, 3]);
eq("no mode", mode([1, 2, 3]), []);
eq("range", range([4.5, 1.5, 3]), 3);
// regression
const P: Pt[] = [[1, 2], [2, 4], [3, 5], [4, 4], [5, 5]];
const f = regression(P)!;
ok("hand gradient 0.6", near(f.gradient, 0.6)); ok("hand intercept 2.2", near(f.intercept, 2.2)); ok("hand r2 0.6", near(f.r2, 0.6));
const ex = regression([0, 1, 2, 3, 4, 5].map((x) => [x, 3 * x - 2] as Pt))!;
ok("exact line m", near(ex.gradient, 3)); ok("exact line c", near(ex.intercept, -2)); ok("exact line r2=1", near(ex.r2, 1));
const o = regression(P, true)!;
ok("origin gradient 66/55", near(o.gradient, 1.2)); ok("origin intercept 0", o.intercept === 0);
ok("origin exact proportional", near(regression([[1, 2.5], [2, 5], [4, 10]], true)!.gradient, 2.5));
ok("r2 in [0,1]", f.r2 >= 0 && f.r2 <= 1);
ok("r2 poor for noise", regression([[1, 5], [2, 1], [3, 6], [4, 0], [5, 4]])!.r2 < 0.1);
ok("regression needs 2 points", regression([[1, 1]]) === null);
ok("regression rejects same x", regression([[2, 1], [2, 5]]) === null);
ok("lineY", near(lineY(f, 10), 8.2));
eq("fitSegment", fitSegment(ex, 0, 2), [[0, -2], [2, 4]]);
ok("lineThrough", (() => { const l = lineThrough([0, 1], [2, 5])!; return near(l.gradient, 2) && near(l.intercept, 1); })());
ok("lineThrough vertical null", lineThrough([1, 0], [1, 5]) === null);
// anomalies
const rows = [{ x: 1, reps: [10.1, 10.0, 9.9] }, { x: 2, reps: [20.2, 19.8, 20.0] }, { x: 3, reps: [30.1, 41.0, 29.9] }, { x: 4, reps: [40, 40.4, 39.7] }];
eq("repeat anomaly found", repeatAnomalies(rows), [[2, 1]]);
eq("repeat clean data no flags", repeatAnomalies(rows.filter((_, i) => i !== 2)), []);
ok("two readings not judged", repeatAnomalies([{ x: 1, reps: [1, 9] }]).length === 0);
ok("grouped means exclude anomaly", near(groupedMeans(rows)[2]![1], 30));
ok("grouped means include anomaly", near(groupedMeans(rows, false)[2]![1], (30.1 + 41 + 29.9) / 3));
const line: Pt[] = Array.from({ length: 8 }, (_, i) => [i, 2 * i + 1 + (i % 2 ? 0.1 : -0.1)]);
eq("trend clean no false positives", trendAnomalies(line), []);
eq("trend planted anomaly", trendAnomalies(line.map((p, i) => (i === 5 ? [p[0], p[1] + 6] as Pt : p))), [5]);
// chart helpers
ok("bar scale starts at zero", chartScales([[1, 50], [2, 60]], "bar").y.min === 0);
ok("scatter scale can skip zero", chartScales([[10, 50], [20, 60]], "scatter", false).x.min === 10);
ok("bar geometry centres", (() => { const g = barGeometry(4, 400); return near(g.centres[0]!, 50) && near(g.centres[3]!, 350) && near(g.width, 70); })());
eq("linePath sorted", linePath([[10, 5], [2, 3]]), "M2.0,3.0 L10.0,5.0");
// checkPlotted
const E: Pt[] = [[1, 10], [2, 20], [3, 30], [4, 40]], tol = { x: 0.2, y: 2 };
const full = checkPlotted([[1, 10.5], [2, 19], [3, 30], [4, 41]], E, tol);
ok("plotted perfect", full.score === 4 && full.max === 4);
const part = checkPlotted([[1, 10], [2, 26], [3, 30]], E, tol);
ok("plotted partly", part.score === 2 && part.max === 4);
ok("plotted misplaced vs missing wording", part.feedback.some((s) => s.includes("Point 2") && s.includes("not on the right square")) && part.feedback.some((s) => s.includes("Point 4") && s.includes("not plotted yet")));
ok("plotted feedback hides coordinates", !part.feedback.join(" ").match(/\b(20|40|26)\b/));
const none = checkPlotted([], E, tol);
ok("plotted empty scores 0", none.score === 0 && none.max === 4);
ok("plotted extra flagged", checkPlotted([...E, [9, 9]], E, tol).feedback.some((s) => s.includes("1 point that does not match")));
ok("plotted one point cannot serve two readings", checkPlotted([[1, 10]], [[1, 10], [1.1, 10.5]], tol).score === 1);
// checkBestFit
const D: Pt[] = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1]];
const rf = regression(D)!;
ok("bestfit perfect", checkBestFit({ gradient: rf.gradient, intercept: rf.intercept }, D, 10).score === 2);
const steep = checkBestFit({ gradient: rf.gradient * 1.5, intercept: rf.intercept }, D, 10);
ok("bestfit steep loses gradient mark", steep.score === 1 && steep.feedback[0]!.includes("too steep"));
ok("bestfit wrong direction", checkBestFit({ gradient: -1, intercept: 0 }, D, 10).feedback[0]!.includes("wrong way"));
ok("bestfit no line", checkBestFit(null, D, 10).score === 0);
ok("bestfit through origin", checkBestFit({ gradient: 2, intercept: 0 }, [[1, 2], [2, 4.1], [3, 5.9]], 5, true).score === 2);
// checkAxes
const good = { xLabel: "Mass", xUnit: "g", yLabel: "Extension", yUnit: "mm", xTicks: [0, 100, 200, 300], yTicks: [0, 20, 40, 60, 80], xData: [50, 300] as [number, number], yData: [13, 78] as [number, number] };
ok("axes perfect", checkAxes(good).score === 4);
ok("axes no labels", checkAxes({ ...good, xLabel: "", yLabel: " " }).score === 3);
ok("axes no units", checkAxes({ ...good, yUnit: "" }).feedback[1]!.startsWith("✗"));
ok("axes unitless allowed", checkAxes({ ...good, xUnit: "", yUnit: "", needUnits: false }).score === 4);
ok("axes squashed scale", checkAxes({ ...good, yTicks: [0, 100, 200, 300, 400] }).feedback[2]!.startsWith("✗"));
ok("axes data off the grid", checkAxes({ ...good, xTicks: [0, 100, 200] }).feedback[2]!.startsWith("✗"));
ok("axes uneven steps", checkAxes({ ...good, yTicks: [0, 10, 20, 50, 80] }).feedback[3]!.startsWith("✗"));
// bank
ok("bank has >= 14 datasets", EXPERIMENTS.length >= 14, String(EXPERIMENTS.length));
ok("bank ids unique", new Set(EXPERIMENTS.map((e) => e.id)).size === EXPERIMENTS.length);
ok("bank lookup", experimentById("spring-mass")?.title.length! > 0 && experimentById("nope") === undefined);
ok("bank has every relationship", (["linear", "proportional", "inverse", "curve"] as const).every((r) => EXPERIMENTS.some((e) => e.relationship === r)));
for (const e of EXPERIMENTS) {
  ok(`${e.id}: names and units`, !!e.independent.name && !!e.independent.unit && !!e.dependent.name && (!!e.dependent.unit || /bubbles/i.test(e.dependent.name)));
  ok(`${e.id}: controls given`, e.controls.length >= 2 && e.question.length > 20);
  ok(`${e.id}: repeats count`, e.repeats >= 3 && e.rows.length >= 5 && e.rows.every((r) => r.reps.length === e.repeats && r.reps.every(Number.isFinite)));
  ok(`${e.id}: x increasing`, e.rows.every((r, i) => i === 0 || r.x > e.rows[i - 1]!.x));
  eq(`${e.id}: exactly the planted anomalies flagged`, repeatAnomalies(e.rows), e.anomalies);
  const m = groupedMeans(e.rows), r = regression(m);
  ok(`${e.id}: trend in the means`, !!r && m.length >= 5 && (e.relationship === "curve" || e.relationship === "inverse" || r.r2 > 0.98), `r2=${r?.r2}`);
  if (e.relationship === "proportional") ok(`${e.id}: proportional intercept near 0`, Math.abs(r!.intercept) < 0.06 * Math.max(...m.map((p) => p[1])));
  if (e.relationship === "inverse") ok(`${e.id}: inverse falls`, r!.gradient < 0 && r!.r2 < 0.98);
}
console.log(`${n - bad}/${n} checks passed`);
process.exit(bad ? 1 : 0);
