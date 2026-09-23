// Seeded question generators for the geometry board (plan M-G01 measure/draw an angle · M-G02 constructions · M-G03 plot points · M-G09 bearings).
// A generator is a pure function of its seed: same seed → same question, so a homework question can be regenerated ("try again with new numbers")
// and re-marked later. Every problem carries its MODEL ANSWER, which is how the selftest proves each question is solvable.
import { add, dist, fromBearing, mid, polar, round, scale, type Pt } from "../../engine/geometry";
import { circleCircle, dirOf } from "../../engine/geometry";
import { makeRng, type Rng } from "../../engine/rng";
import { runChecker, type Answer, type CheckerId } from "./checkers";
import { PAPER_H, PAPER_W, type Mark, type PaperKind, type Tol } from "./model";
import { perpBisector } from "../../engine/geometry";

export interface Problem {
  generatorId: string;
  seed: number;
  prompt: string;
  paper: PaperKind;
  /** Marks already on the paper (locked). */
  given: Mark[];
  /** How the student answers: type a number, draw marks, or plot points on a grid. */
  expects: "number" | "marks" | "points";
  unit?: string;
  checkerId: CheckerId;
  checkerParams: Record<string, unknown>;
  maxScore: number;
  /** A correct answer — used by tests, and for a tutor's "show me how". Never sent to a student in assess mode. */
  model: Answer;
}
export type Generator = (seed: number) => Problem;

const MARGIN = 14;
const fits = (p: Pt) => p[0] >= MARGIN && p[0] <= PAPER_W - MARGIN && p[1] >= MARGIN && p[1] <= PAPER_H - MARGIN;
const gid = (i: number) => `g${i}`;
const pt = (i: number, p: Pt, label: string): Mark => ({ id: gid(i), k: "pt", p, label, given: true });
const sg = (i: number, a: Pt, b: Pt): Mark => ({ id: gid(i), k: "seg", a, b, ruled: true, given: true });
const own = (id: string, m: Record<string, unknown>): Mark => ({ id, ...m }) as Mark;
const cm = (mm: number) => `${round(mm / 10, 1)} cm`;
const r1 = (p: Pt): Pt => [round(p[0], 1), round(p[1], 1)];

/** A point where a ray fan of `reach` mm in every direction stays on the paper. */
function centre(rng: Rng, reach: number): Pt {
  const xs = [reach + MARGIN, PAPER_W - reach - MARGIN], ys = [reach + MARGIN, PAPER_H - reach - MARGIN];
  return [round(rng.float(xs[0]!, xs[1]!), 1), round(rng.float(ys[0]!, Math.max(ys[0]!, ys[1]!)), 1)];
}

// ── M-G01 · measure / draw an angle ─────────────────────────────────────────────────────────────
export const measureAngle: Generator = (seed) => {
  const rng = makeRng(seed), O = centre(rng, 52), theta = rng.int(0, 359), ang = rng.int(20, 160), reflex = rng.next() < 0.2;
  const A = r1(polar(O, 50, theta)), B = r1(polar(O, 50, theta + ang));
  const expected = reflex ? 360 - ang : ang;
  return {
    generatorId: "M-G01.measure", seed, paper: "plain", expects: "number", unit: "°", checkerId: "numeric", maxScore: 1,
    prompt: reflex ? "Measure the reflex angle AOB. Use a 360° protractor." : "Measure the angle AOB.",
    given: [sg(0, O, A), sg(1, O, B), pt(2, A, "A"), pt(3, O, "O"), pt(4, B, "B")],
    checkerParams: { expected, unit: "°" }, model: { number: expected },
  };
};
export const drawAngle: Generator = (seed) => {
  const rng = makeRng(seed), O = centre(rng, 60), theta = rng.int(0, 359), target = rng.int(25, 155);
  const A = r1(polar(O, 60, theta));
  const end = r1(polar(O, 55, theta + target));
  return {
    generatorId: "M-G01.draw", seed, paper: "plain", expects: "marks", unit: "°", checkerId: "angleConstruct", maxScore: 2,
    prompt: `Draw an angle of ${target}° at O, starting from the line OA.`,
    given: [sg(0, O, A), pt(1, O, "O"), pt(2, A, "A")],
    checkerParams: { O, baseDir: dirOf(O, A), target, side: "any", requireArcs: false },
    model: { marks: [own("m1", { k: "seg", a: O, b: end, ruled: true })] },
  };
};

// ── M-G02 · constructions ───────────────────────────────────────────────────────────────────────
export const constructPerpBisector: Generator = (seed) => {
  const rng = makeRng(seed), d = rng.int(60, 110);
  let A: Pt = [50, 74], B: Pt = [50 + d, 74];
  for (let i = 0; i < 60; i++) {
    const M = centre(rng, 46), phi = rng.int(0, 359), a = polar(M, d / 2, phi), b = polar(M, d / 2, phi + 180);
    if (fits(a) && fits(b)) { A = r1(a); B = r1(b); break; }
  }
  const r = round(dist(A, B) * 0.62, 1), bis = perpBisector(A, B, 44);
  return {
    generatorId: "M-G02.perpBisector", seed, paper: "plain", expects: "marks", checkerId: "perpBisector", maxScore: 3,
    prompt: `Construct the perpendicular bisector of the line AB (${cm(dist(A, B))} long). Leave your construction arcs showing.`,
    given: [sg(0, A, B), pt(1, A, "A"), pt(2, B, "B")],
    checkerParams: { A, B, requireArcs: true },
    model: { marks: [own("m1", { k: "arc", c: A, r, a0: 0, a1: 360 }), own("m2", { k: "arc", c: B, r, a0: 0, a1: 360 }), own("m3", { k: "seg", a: bis.a, b: bis.b, ruled: true })] },
  };
};
export const constructAngleBisector: Generator = (seed) => {
  const rng = makeRng(seed), O = centre(rng, 60), theta = rng.int(0, 359), ang = rng.int(40, 140);
  const A = r1(polar(O, 58, theta)), B = r1(polar(O, 58, theta + ang)), mdir = theta + ang / 2;
  return {
    generatorId: "M-G02.angleBisector", seed, paper: "plain", expects: "marks", checkerId: "angleBisector", maxScore: 3,
    prompt: "Construct the bisector of angle AOB. Leave your construction arcs showing.",
    given: [sg(0, O, A), sg(1, O, B), pt(2, A, "A"), pt(3, O, "O"), pt(4, B, "B")],
    checkerParams: { O, A, B, requireArcs: true },
    model: { marks: [own("m1", { k: "arc", c: O, r: 30, a0: theta, a1: theta + ang }), own("m2", { k: "seg", a: O, b: r1(polar(O, 55, mdir)), ruled: true })] },
  };
};
/** Sides in whole centimetres (as a pupil would be given), each pair summing to more than the third by ≥ 1 cm so the triangle is clearly buildable. */
function sides(rng: Rng): [number, number, number] {
  for (let i = 0; i < 200; i++) {
    const s = [rng.int(4, 9), rng.int(4, 9), rng.int(4, 9)].sort((x, y) => x - y) as [number, number, number];
    if (s[0]! + s[1]! >= s[2]! + 2 && new Set(s).size >= 2) return s.map((v) => v * 10) as [number, number, number];
  }
  return [50, 60, 70];
}
function triangleModel(a: number, b: number, c: number): Mark[] {
  // base c along the bottom of the paper; apex from two arcs.
  const P: Pt = [30, 118], Q: Pt = [30 + c, 118], top = circleCircle(P, b, Q, a).sort((x, y) => x[1] - y[1])[0]!;
  return [
    own("m1", { k: "seg", a: P, b: Q, ruled: true }), own("m2", { k: "seg", a: P, b: top, ruled: true }), own("m3", { k: "seg", a: Q, b: top, ruled: true }),
    own("m4", { k: "arc", c: P, r: b, a0: 0, a1: 360 }), own("m5", { k: "arc", c: Q, r: a, a0: 0, a1: 360 }),
  ];
}
export const constructTriangle: Generator = (seed) => {
  const rng = makeRng(seed), [a, b, c] = sides(rng);
  return {
    generatorId: "M-G02.triangle", seed, paper: "plain", expects: "marks", checkerId: "triangle", maxScore: 4,
    prompt: `Construct a triangle with sides of ${cm(a)}, ${cm(b)} and ${cm(c)}. Use compasses and leave your construction arcs showing.`,
    given: [], checkerParams: { spec: { kind: "sss", sides: [a, b, c] }, requireArcs: true }, model: { marks: triangleModel(a, b, c) },
  };
};
export const constructEquilateral: Generator = (seed) => {
  const rng = makeRng(seed), s = rng.int(5, 8) * 10;
  return {
    generatorId: "M-G02.equilateral", seed, paper: "plain", expects: "marks", checkerId: "triangle", maxScore: 4,
    prompt: `Construct an equilateral triangle with sides of ${cm(s)}. Use compasses and leave your construction arcs showing.`,
    given: [], checkerParams: { spec: { kind: "sss", sides: [s, s, s] }, requireArcs: true }, model: { marks: triangleModel(s, s, s) },
  };
};
export const locusCircle: Generator = (seed) => {
  const rng = makeRng(seed), r = rng.int(2, 6) * 10, P = centre(rng, r);
  return {
    generatorId: "M-G02.locus", seed, paper: "plain", expects: "marks", checkerId: "locusCircle", maxScore: 2,
    prompt: `Draw the locus of all the points that are ${cm(r)} from the point P.`,
    given: [pt(0, P, "P")], checkerParams: { P, r, minSweep: 300 }, model: { marks: [own("m1", { k: "arc", c: P, r, a0: 0, a1: 360 })] },
  };
};

// ── M-G03 · plot points on a coordinate grid ────────────────────────────────────────────────────
export const plotPoints: Generator = (seed) => {
  const rng = makeRng(seed), pts: Pt[] = [];
  while (pts.length < 3) { const p: Pt = [rng.int(-6, 6), rng.int(-6, 6)]; if (!pts.some((q) => q[0] === p[0] && q[1] === p[1])) pts.push(p); }
  return {
    generatorId: "M-G03.plot", seed, paper: "graph", expects: "points", checkerId: "points", maxScore: 3,
    prompt: `Plot the points ${pts.map((p) => `(${p[0]}, ${p[1]})`).join(", ")}.`,
    given: [], checkerParams: { expected: pts, tolerance: 0.3 }, model: { points: pts },
  };
};

// ── M-G09 · bearings ────────────────────────────────────────────────────────────────────────────
export const measureBearing: Generator = (seed) => {
  const rng = makeRng(seed);
  for (let i = 0; i < 80; i++) {
    const A = centre(rng, 30), b = rng.int(5, 355), d = rng.int(40, 85), B = fromBearing(A, b, d); // reach 30: room for the 30 mm north line
    if (!fits(B)) continue;
    return {
      generatorId: "M-G09.measure", seed, paper: "plain", expects: "number", unit: "°", checkerId: "numeric", maxScore: 1,
      prompt: "Measure the bearing of B from A. Give it as a three-figure bearing.",
      given: [sg(0, A, r1(B)), pt(1, A, "A"), pt(2, r1(B), "B"), { id: gid(3), k: "seg", a: A, b: [A[0], A[1] - 30], given: true, dashed: true }],
      checkerParams: { expected: b, unit: "°" }, model: { number: b },
    };
  }
  throw new Error("no layout found");
};
export const drawBearing: Generator = (seed) => {
  const rng = makeRng(seed);
  for (let i = 0; i < 80; i++) {
    const A = centre(rng, 30), b = rng.int(5, 355), L = rng.int(4, 8) * 10, B = fromBearing(A, b, L);
    if (!fits(B)) continue;
    return {
      generatorId: "M-G09.draw", seed, paper: "plain", expects: "marks", checkerId: "bearingLine", maxScore: 3,
      prompt: `Draw a line from A on a bearing of ${String(b).padStart(3, "0")}°, ${cm(L)} long.`,
      given: [pt(0, A, "A"), { id: gid(1), k: "seg", a: A, b: [A[0], A[1] - 30], given: true, dashed: true }],
      checkerParams: { A, bearing: b, length: L }, model: { marks: [own("m1", { k: "seg", a: A, b: r1(B), ruled: true })] },
    };
  }
  throw new Error("no layout found");
};

export const GENERATORS: Record<string, Generator> = {
  "M-G01.measure": measureAngle, "M-G01.draw": drawAngle,
  "M-G02.perpBisector": constructPerpBisector, "M-G02.angleBisector": constructAngleBisector, "M-G02.triangle": constructTriangle, "M-G02.equilateral": constructEquilateral, "M-G02.locus": locusCircle,
  "M-G03.plot": plotPoints, "M-G09.measure": measureBearing, "M-G09.draw": drawBearing,
};

/** Mark a stored answer against a problem (server-side re-marking uses exactly this). */
export const markProblem = (p: Pick<Problem, "checkerId" | "checkerParams">, a: Answer, tol: Tol) => runChecker(p.checkerId, p.checkerParams, a, tol);
export { add, mid, scale };
