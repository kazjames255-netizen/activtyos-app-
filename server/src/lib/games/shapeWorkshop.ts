import type { Rng } from "../../../../features/learninghub/tools/engine/rng";
import type { QuizGameSpec, QuizItem } from "../quizArcade";

// Shape Workshop — geometry (KS2-KS3: 2D/3D shape properties, angles, symmetry, area/perimeter). A workshop/
// building frame: each correct answer adds a piece to a structure (client-side only; the geometry here is real).
export const SHAPE_WORKSHOP_TOPICS = ["shapes2d", "shapes3d", "angles", "symmetry", "areaPerimeter"] as const;
export type ShapeWorkshopTopic = (typeof SHAPE_WORKSHOP_TOPICS)[number];

interface Shape2D { name: string; sides: number; vertices: number; anglesSum: number; linesOfSymmetry: number }
const SHAPES_2D: Shape2D[] = [
  { name: "Triangle", sides: 3, vertices: 3, anglesSum: 180, linesOfSymmetry: 0 }, // generic; equilateral handled separately
  { name: "Square", sides: 4, vertices: 4, anglesSum: 360, linesOfSymmetry: 4 },
  { name: "Rectangle", sides: 4, vertices: 4, anglesSum: 360, linesOfSymmetry: 2 },
  { name: "Pentagon", sides: 5, vertices: 5, anglesSum: 540, linesOfSymmetry: 5 },
  { name: "Hexagon", sides: 6, vertices: 6, anglesSum: 720, linesOfSymmetry: 6 },
  { name: "Octagon", sides: 8, vertices: 8, anglesSum: 1080, linesOfSymmetry: 8 },
  { name: "Parallelogram", sides: 4, vertices: 4, anglesSum: 360, linesOfSymmetry: 0 },
  { name: "Rhombus", sides: 4, vertices: 4, anglesSum: 360, linesOfSymmetry: 2 },
  { name: "Trapezium", sides: 4, vertices: 4, anglesSum: 360, linesOfSymmetry: 0 },
];
interface Shape3D { name: string; faces: number; edges: number; vertices: number }
const SHAPES_3D: Shape3D[] = [
  { name: "Cube", faces: 6, edges: 12, vertices: 8 }, { name: "Cuboid", faces: 6, edges: 12, vertices: 8 },
  { name: "Triangular prism", faces: 5, edges: 9, vertices: 6 }, { name: "Square-based pyramid", faces: 5, edges: 8, vertices: 5 },
  { name: "Cylinder", faces: 3, edges: 2, vertices: 0 }, { name: "Cone", faces: 2, edges: 1, vertices: 1 }, { name: "Sphere", faces: 1, edges: 0, vertices: 0 },
];
function shuffledChoices(rng: Rng, correct: string, distractors: string[]): { choices: string[]; correctIndex: number } {
  const pool = [...new Set(distractors)].filter((d) => d !== correct).slice(0, 3);
  const choices = rng.shuffle([correct, ...pool]);
  return { choices, correctIndex: choices.indexOf(correct) };
}
// Guaranteed to terminate even when `correct` is very small (0 or 1 - e.g. a sphere's 0 edges, a cone's 1 vertex),
// where there aren't `count` distinct positive integers within the first `spread` either side of it: widens the
// search window every 40 misses, then falls back to a plain sequential fill so this can never spin forever.
function distinctInts(rng: Rng, correct: number, count: number, spread: number): number[] {
  const out = new Set<number>();
  let s = Math.max(1, spread), guard = 0;
  while (out.size < count && guard++ < 400) { const x = correct + rng.int(-s, s); if (x !== correct && x > 0) out.add(x); if (guard % 40 === 0) s++; }
  for (let filler = 1; out.size < count; filler++) if (filler !== correct) out.add(filler);
  return [...out].slice(0, count);
}

function itemShapeSides(rng: Rng, _d: 1 | 2 | 3, idx: number): QuizItem {
  const s = rng.pick(SHAPES_2D);
  const { choices, correctIndex } = shuffledChoices(rng, String(s.sides), distinctInts(rng, s.sides, 3, 2).map(String));
  return { id: `q${idx}`, topic: "shapes2d", prompt: `How many sides does a ${s.name.toLowerCase()} have?`, choices, correctIndex, explain: `A ${s.name.toLowerCase()} has ${s.sides} sides and ${s.vertices} vertices.` };
}
function itemShapeName(rng: Rng, _d: 1 | 2 | 3, idx: number): QuizItem {
  const s = rng.pick(SHAPES_2D);
  const others = SHAPES_2D.filter((x) => x.sides !== s.sides || x.name !== s.name).map((x) => x.name);
  const { choices, correctIndex } = shuffledChoices(rng, s.name, rng.shuffle(others));
  return { id: `q${idx}`, topic: "shapes2d", prompt: `Which shape has ${s.sides} sides and ${s.vertices} vertices${s.sides === 4 ? " (and this one has 4 equal sides and 4 right angles)" : ""}?`, choices, correctIndex, explain: `That description matches a ${s.name.toLowerCase()}.` };
}
function itemAnglesSum(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const s = difficulty === 1 ? rng.pick(SHAPES_2D.filter((x) => x.sides <= 4)) : rng.pick(SHAPES_2D);
  const { choices, correctIndex } = shuffledChoices(rng, String(s.anglesSum), [s.anglesSum - 180, s.anglesSum + 180, s.anglesSum - 90, s.anglesSum + 90, s.anglesSum * 2].filter((x) => x > 0).map(String));
  return { id: `q${idx}`, topic: "angles", prompt: `What do the interior angles of a ${s.name.toLowerCase()} add up to?`, choices, correctIndex, explain: `A polygon's angles sum to (sides − 2) × 180°: (${s.sides} − 2) × 180 = ${s.anglesSum}°.` };
}
function itemAngleType(rng: Rng, _d: 1 | 2 | 3, idx: number): QuizItem {
  const deg = rng.int(1, 359);
  const type = deg === 90 ? "Right angle" : deg < 90 ? "Acute" : deg < 180 ? "Obtuse" : deg === 180 ? "Straight line" : "Reflex";
  const options = ["Acute", "Right angle", "Obtuse", "Reflex"];
  const { choices, correctIndex } = shuffledChoices(rng, type, options.filter((o) => o !== type));
  return { id: `q${idx}`, topic: "angles", prompt: `An angle of ${deg}° — is it acute, a right angle, obtuse, or reflex?`, choices, correctIndex, explain: `${deg}° is ${type === "Right angle" ? "exactly 90°" : type === "Acute" ? "less than 90°" : type === "Obtuse" ? "between 90° and 180°" : type === "Straight line" ? "exactly 180°" : "more than 180°"}, so it's ${type.toLowerCase()}.` };
}
function itemMissingAngle(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  // Angles on a straight line (180°) or around a point (360°), or in a triangle (180°) — one missing.
  const kind = difficulty === 1 ? "line" : rng.pick(["line", "triangle", "point"] as const);
  const total = kind === "point" ? 360 : 180;
  const n = kind === "triangle" ? 3 : rng.int(2, 3);
  const knownCount = n - 1;
  const known: number[] = [];
  let remaining = total;
  for (let i = 0; i < knownCount; i++) { const v = rng.int(20, Math.max(21, remaining - 20 * (knownCount - i))); known.push(v); remaining -= v; }
  const correct = remaining;
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distinctInts(rng, correct, 3, 15).map(String));
  const where = kind === "point" ? "around a point" : kind === "triangle" ? "in a triangle" : "on a straight line";
  return { id: `q${idx}`, topic: "angles", prompt: `Angles ${where} add up to ${total}°. If the known angles are ${known.join("° and ")}°, what is the missing angle?`, choices, correctIndex, explain: `${total} − (${known.join(" + ")}) = ${correct}°.` };
}
function itemSymmetry(rng: Rng, _d: 1 | 2 | 3, idx: number): QuizItem {
  const s = rng.pick(SHAPES_2D);
  const { choices, correctIndex } = shuffledChoices(rng, String(s.linesOfSymmetry), distinctInts(rng, s.linesOfSymmetry, 3, 2).map(String));
  return { id: `q${idx}`, topic: "symmetry", prompt: `How many lines of symmetry does a regular ${s.name.toLowerCase()} have?`, choices, correctIndex, explain: `A regular ${s.name.toLowerCase()} has ${s.linesOfSymmetry} line${s.linesOfSymmetry === 1 ? "" : "s"} of symmetry.` };
}
function itemShape3d(rng: Rng, kind: "faces" | "edges" | "vertices", idx: number): QuizItem {
  const s = rng.pick(SHAPES_3D);
  const correct = s[kind];
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distinctInts(rng, correct, 3, 2).map(String));
  return { id: `q${idx}`, topic: "shapes3d", prompt: `How many ${kind} does a ${s.name.toLowerCase()} have?`, choices, correctIndex, explain: `A ${s.name.toLowerCase()} has ${s.faces} faces, ${s.edges} edges and ${s.vertices} vertices.` };
}
function itemAreaRect(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 25;
  const w = rng.int(2, hi), h = rng.int(2, hi);
  const correct = w * h;
  const { choices, correctIndex } = shuffledChoices(rng, `${correct} cm²`, [2 * (w + h), correct + w, Math.abs(correct - h) || correct + h, correct + h, w + h].map((x) => `${x} cm²`));
  return { id: `q${idx}`, topic: "areaPerimeter", prompt: `A rectangle is ${w} cm by ${h} cm. What is its area?`, choices, correctIndex, explain: `Area = length × width = ${w} × ${h} = ${correct} cm².` };
}
function itemPerimeterRect(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 25;
  const w = rng.int(2, hi), h = rng.int(2, hi);
  const correct = 2 * (w + h);
  const { choices, correctIndex } = shuffledChoices(rng, `${correct} cm`, [w * h, correct + 2, Math.abs(correct - 4) || correct + 4, correct + w, correct - 2 || correct + 6].map((x) => `${x} cm`));
  return { id: `q${idx}`, topic: "areaPerimeter", prompt: `A rectangle is ${w} cm by ${h} cm. What is its perimeter?`, choices, correctIndex, explain: `Perimeter = 2 × (length + width) = 2 × (${w} + ${h}) = ${correct} cm.` };
}
function itemAreaTriangle(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 8 : difficulty === 2 ? 12 : 20;
  const base = rng.int(2, hi) * 2, height = rng.int(2, hi); // even base keeps the area a whole number
  const correct = (base * height) / 2;
  const { choices, correctIndex } = shuffledChoices(rng, `${correct} cm²`, [base * height, correct + height, correct + base, Math.max(1, correct - base), Math.max(1, correct - height)].map((x) => `${x} cm²`));
  return { id: `q${idx}`, topic: "areaPerimeter", prompt: `A triangle has a base of ${base} cm and a height of ${height} cm. What is its area?`, choices, correctIndex, explain: `Area of a triangle = ½ × base × height = ½ × ${base} × ${height} = ${correct} cm².` };
}

const GENERATORS: ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[] = [
  itemShapeSides, itemShapeName, itemAnglesSum, itemAngleType, itemMissingAngle, itemSymmetry,
  (r, _d, i) => itemShape3d(r, "faces", i), (r, _d, i) => itemShape3d(r, "edges", i), (r, _d, i) => itemShape3d(r, "vertices", i),
  itemAreaRect, itemPerimeterRect, itemAreaTriangle,
];
const BY_TOPIC: Record<ShapeWorkshopTopic, ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[]> = {
  shapes2d: [itemShapeSides, itemShapeName], shapes3d: [(r, _d, i) => itemShape3d(r, "faces", i), (r, _d, i) => itemShape3d(r, "edges", i), (r, _d, i) => itemShape3d(r, "vertices", i)],
  angles: [itemAnglesSum, itemAngleType, itemMissingAngle], symmetry: [itemSymmetry], areaPerimeter: [itemAreaRect, itemPerimeterRect, itemAreaTriangle],
};

export const shapeWorkshopSpec: QuizGameSpec = {
  gameId: "shape-workshop", topics: SHAPE_WORKSHOP_TOPICS, runLength: 8,
  buildPlan(rng, { difficulty, weakTopics }) {
    const items: QuizItem[] = [];
    const weak = weakTopics.filter((t): t is ShapeWorkshopTopic => (SHAPE_WORKSHOP_TOPICS as readonly string[]).includes(t));
    for (let i = 0; i < 8; i++) {
      const useWeak = weak.length && i < 5 && rng.next() < 0.6;
      const pool = useWeak ? BY_TOPIC[rng.pick(weak)]! : GENERATORS;
      let item = rng.pick(pool)(rng, difficulty, i);
      let guard = 0;
      while (items.some((x) => x.prompt === item.prompt) && guard++ < 5) item = rng.pick(GENERATORS)(rng, difficulty, i);
      items.push(item);
    }
    return items;
  },
};
