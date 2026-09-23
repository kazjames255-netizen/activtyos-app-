// Run: server/node_modules/.bin/tsx features/learninghub/tools/maths/geometry/geometry.selftest.ts
// Proves (1) the instruments behave like real ones and (2) every generator makes SOLVABLE questions: for 1,000 seeds each, the model
// answer earns full marks, an empty / wrong answer does not, the same seed gives the same question, and everything sits on the paper.
import { angDiff, dirOf, dist, distToLine, polar, rotateAbout, type Pt } from "../../engine/geometry";
import { fullMarks } from "../../engine/marking";
import { GENERATORS, markProblem } from "./generators";
import { arcFromSweep, bodyOf, compassPen, drawAlongEdge, edgesOf, makeInstrument, nearestEdge, protractorReading, snapCompass, snapEdgeToPoints, snapProtractor, snapSetSquare, withRadius } from "./instruments";
import { DEFAULT_TOL, PAPER_H, PAPER_W, type Instrument, type Mark } from "./model";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const near = (a: number, b: number, t = 1e-6) => Math.abs(a - b) <= t;

// ── instruments ──
const ruler = makeInstrument("ruler15", "r", [10, 100]);
const re = edgesOf(ruler)[0]!;
ok(near(dist(re.a, re.b), 150) && near(re.a[0], 10) && near(re.b[0], 160), "ruler 15 cm edge = 150 mm");
const r30 = edgesOf({ ...ruler, kind: "ruler30" })[0]!; ok(near(dist(r30.a, r30.b), 300), "ruler 30 cm edge = 300 mm");
const rot = edgesOf({ ...ruler, rot: 90 })[0]!;
ok(near(rot.b[0], 10) && near(rot.b[1], -50), "rotating 90° points the ruler UP the screen");
ok(bodyOf(ruler).length === 4, "ruler body is a rectangle");
ok(edgesOf(makeInstrument("straightedge", "s")).length === 2, "straight edge has two drawable edges");
const sq = makeInstrument("setsquare45", "q", [0, 0]);
const se = edgesOf(sq); ok(se.length === 3 && near(dist(se[2]!.a, se[2]!.b), 100 * Math.SQRT2, 1e-6), "45° set square: 100 mm legs, hypotenuse 141 mm");
ok(near(angDiff(dirOf(se[0]!.a, se[0]!.b), dirOf(se[1]!.a, se[1]!.b)), 90), "set square corner is a right angle");
const sq2 = edgesOf(makeInstrument("setsquare3060", "q2", [0, 0]));
ok(near(dist(sq2[0]!.a, sq2[0]!.b), 104) && near(dist(sq2[1]!.a, sq2[1]!.b), 60), "30/60 set square legs");

// protractor readings: 0 on the baseline direction, both scales
const pr = makeInstrument("protractor180", "p", [50, 50]);
ok(near(protractorReading(pr, 0)!.outer, 0) && near(protractorReading(pr, 0)!.inner, 180), "protractor: baseline = 0 outer / 180 inner");
ok(near(protractorReading(pr, 65)!.outer, 65) && near(protractorReading(pr, 65)!.inner, 115), "protractor reads a 65° ray on both scales");
ok(protractorReading(pr, 250) === null, "a ray below a 180° protractor's baseline is off the scale");
ok(near(protractorReading({ ...pr, rot: 40 }, 100)!.outer, 60), "a rotated protractor reads relative to its own baseline");
const p360 = makeInstrument("protractor360", "p3", [0, 0]);
ok(near(protractorReading(p360, 250)!.outer, 250) && near(protractorReading(p360, 250)!.inner, 110), "360° protractor reads reflex angles");

// snapping: a protractor dropped near a line's end snaps its centre and turns its baseline onto the line
const line: Mark = { id: "l", k: "seg", a: [80, 80], b: [140, 50], ruled: true };
const sn = snapProtractor({ ...pr, x: 82, y: 81, rot: 25 }, [line], DEFAULT_TOL);
ok(near(sn.x, 80) && near(sn.y, 80), "protractor centre snaps to the line's end");
ok(near(angDiff(sn.rot, dirOf(line.a, line.b)), 0, 1e-6), "protractor baseline snaps onto the line (25° → 26.6°)");
const far = snapProtractor({ ...pr, x: 120, y: 120 }, [line], DEFAULT_TOL);
ok(far.x === 120 && far.y === 120, "no snap when nothing is near");
// ruler slides so its edge passes exactly through a nearby point
const dot: Mark = { id: "d", k: "pt", p: [60, 97] };
const rs = snapEdgeToPoints({ ...ruler, x: 10, y: 100 }, [dot], 4);
ok(near(edgesOf(rs)[0]!.a[1], 97) && near(distToLine(edgesOf(rs)[0]!, [60, 97]), 0), "ruler edge snaps through a nearby point");
ok(snapEdgeToPoints(ruler, [{ id: "f", k: "pt", p: [60, 60] }], 4) === ruler, "…but not to a far one");
// set square turns parallel to a ruler it rests on
const ss = snapSetSquare({ ...sq, rot: 2 }, [ruler], 4);
ok(near(ss.rot, 0), "set square snaps square to the ruler edge");
ok(snapSetSquare({ ...sq, rot: 20 }, [ruler], 4).rot === 20, "…only within tolerance");
// drawing along an edge is straight and clamped to the edge
const d = drawAlongEdge(re, [30, 70], [500, 60]);
ok(near(d.a[1], 100) && near(d.b[1], 100) && near(d.b[0], 160) && near(d.a[0], 30), "line drawn along the ruler stays on the edge and stops at its end");
ok(nearestEdge([ruler], [70, 103], 5)?.instrumentId === "r" && nearestEdge([ruler], [70, 60], 5) === null, "nearest edge within reach");
// compass holds its radius and draws arcs
let comp = makeInstrument("compass", "c", [100, 70]);
comp = withRadius({ ...comp, pen: 30 }, 45);
ok(near(dist([comp.x, comp.y], compassPen(comp)), 45) && near(dirOf([comp.x, comp.y], compassPen(comp)), 30), "compass pencil is exactly r from the needle");
ok(withRadius(comp, 9999).r === 160 && withRadius(comp, -3).r === 2, "compass radius clamped to what the legs can span");
const arc = arcFromSweep([100, 70], 45, 30, 120);
ok(near(arc.a0, 30) && near(arc.a1, 150), "anticlockwise sweep records a0→a1");
const arc2 = arcFromSweep([100, 70], 45, 30, -100);
ok(near(arc2.a0, 290) && near(arc2.a1 - arc2.a0, 100), "a clockwise sweep of 100° from 30° is stored as the anticlockwise arc 290° → 30°");
ok(near(arcFromSweep([0, 0], 10, 0, 720).a1 - arcFromSweep([0, 0], 10, 0, 720).a0, 360), "sweep capped at one full circle");
const snapC = snapCompass({ ...comp, r: 45, pen: 30 }, [{ id: "t", k: "pt", p: polar([100, 70], 46.5, 32) }], 3);
ok(near(snapC.r!, 46.5, 1e-6) && near(snapC.pen!, 32, 1e-6), "compass pencil snaps onto a nearby point (radius follows)");

// ── generators: 1,000 seeds each ──
const wrongFor = (id: string, seed: number, p: ReturnType<(typeof GENERATORS)[string]>) => {
  if (p.expects === "number") return { number: (p.model.number ?? 0) + DEFAULT_TOL.deg + 4 };
  if (p.expects === "points") return { points: (p.model.points ?? []).map((q) => [q[0] + 2, q[1]] as Pt) };
  // a plausible wrong construction: every line turned 8° about its start (well outside ±2°), every arc's centre 9 mm out
  return { marks: (p.model.marks ?? []).map((m): Mark => m.k === "seg" ? { ...m, b: rotateAbout(m.b, m.a, 8) } : m.k === "arc" ? { ...m, c: [m.c[0] + 9, m.c[1]] } : m) };
};
for (const [id, gen] of Object.entries(GENERATORS)) {
  let full = 0, allFit = 0, wrongScoresLower = 0, empty = 0, fixed = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const p = gen(seed);
    if (JSON.stringify(gen(seed)) !== JSON.stringify(p)) fixed++;
    if (fullMarks(markProblem(p, p.model, DEFAULT_TOL))) full++;
    else if (full + 1 < seed - 5 && bad < 5) console.error(`  ${id} seed ${seed}: model not full`, JSON.stringify(markProblem(p, p.model, DEFAULT_TOL).feedback));
    const pts: Pt[] = [...p.given, ...(p.model.marks ?? [])].flatMap((m) => m.k === "pt" ? [m.p] : m.k === "seg" ? [m.a, m.b] : m.k === "arc" ? [] : []);
    if (p.paper === "graph" || pts.every((q) => q[0] >= 0 && q[0] <= PAPER_W && q[1] >= 0 && q[1] <= PAPER_H)) allFit++;
    if (!fullMarks(markProblem(p, wrongFor(id, seed, p), DEFAULT_TOL))) wrongScoresLower++;
    if (!fullMarks(markProblem(p, p.expects === "number" ? { number: null } : p.expects === "points" ? { points: [] } : { marks: [] }, DEFAULT_TOL))) empty++;
    ok(p.prompt.length > 10 && p.maxScore > 0 && p.seed === seed && p.generatorId === id, `${id} seed ${seed}: well-formed`);
  }
  ok(full === 1000, `${id}: model answer earns full marks for all 1,000 seeds (got ${full})`);
  ok(allFit === 1000, `${id}: everything sits on the paper (${allFit}/1000)`);
  ok(wrongScoresLower === 1000, `${id}: a wrong answer never earns full marks (${wrongScoresLower}/1000)`);
  ok(empty === 1000, `${id}: an empty answer never earns full marks`);
  ok(fixed === 0, `${id}: same seed → same question`);
  console.log(`  ${id}: ok`);
}
// different seeds give different questions
const distinct = new Set(Array.from({ length: 50 }, (_, i) => GENERATORS["M-G01.measure"]!(i + 1).checkerParams.expected as number));
ok(distinct.size > 15, "measure-angle questions vary across seeds");
// tolerance really matters
const p0 = GENERATORS["M-G01.measure"]!(5);
ok(fullMarks(markProblem(p0, { number: (p0.model.number as number) + 1.9 }, DEFAULT_TOL)) && !fullMarks(markProblem(p0, { number: (p0.model.number as number) + 2.5 }, DEFAULT_TOL)), "±2° tolerance edge");
ok(fullMarks(markProblem(p0, { number: (p0.model.number as number) + 4 }, { mm: 2, deg: 5 })), "a tutor's looser tolerance is honoured");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
