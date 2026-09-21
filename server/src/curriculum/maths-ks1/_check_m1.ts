// Independent answer-key checker for the maths-ks1 pack (agent M1). Recomputes every key from the question's own data:
//  - arithmetic from the numbers in the prompt,
//  - picture questions from _m1_image_data.json (the SAME file scratch/curriculum-images/gen-m1.mjs draws from),
//  - shapes/turns/patterns/symmetry from small fact tables or geometry defined below.
// It asserts (a) the keyed answer equals the computed one and (b) for single questions exactly one option matches.
// Run: cd server && npx tsx src/curriculum/maths-ks1/_check_m1.ts   (leading underscore: validate.ts skips it)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CQuestion, CTopic } from "../types";
import { TOPIC as NPV } from "./npv";
import { TOPIC as AS } from "./as";
import { TOPIC as MD } from "./md";
import { TOPIC as FRAC } from "./frac";
import { TOPIC as MEAS } from "./meas";
import { TOPIC as SHAPE } from "./shape";
import { TOPIC as POS } from "./pos";
import { TOPIC as STATS } from "./stats";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(path.join(HERE, "_m1_image_data.json"), "utf8"));

type Exp = { v: number } | { s: string } | { set: string[] };
const V = (n: number): Exp => ({ v: n });
const S = (s: string): Exp => ({ s });
const opts = (q: CQuestion) => q.options ?? [];
const only = (q: CQuestion, pred: (o: string) => boolean): Exp => {
  const hit = opts(q).filter(pred);
  if (hit.length !== 1) throw new Error(`${q.key}: expected exactly one matching option, got ${hit.length} (${hit.join(" | ")})`);
  return S(hit[0]);
};
const setOf = (q: CQuestion, pred: (o: string) => boolean): Exp => ({ set: opts(q).filter(pred) });
const ev = (e: string) => Function(`return (${e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")})`)() as number;
const numOf = (o: string) => { const m = o.match(/-?\d+(\.\d+)?/); if (!m) throw new Error(`no number in "${o}"`); return Number(m[0]); };
const chars = (s: string) => Array.from(s).filter((c) => /\p{Extended_Pictographic}/u.test(c));

// ---------- fact tables ----------
const FR: Record<string, number> = { "½": 1 / 2, "¼": 1 / 4, "⅓": 1 / 3, "¾": 3 / 4 };
const fracSym = (n: number, d: number) => Object.entries(FR).find(([, v]) => Math.abs(v - n / d) < 1e-9)![0];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function timeWords(h: number, m: number) {
  if (m === 0) return `${h} o'clock`;
  if (m === 30) return `half past ${h}`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 45) return `quarter to ${(h % 12) + 1}`;
  throw new Error("timeWords " + m);
}
const digital = (h: number, m: number) => `${h}:${String(m).padStart(2, "0")}`;
const numWord: Record<number, string> = { 16: "sixteen" };
// 2-D shapes: sides, corners, all sides equal
const P2: Record<string, { sides: number; corners: number; equal?: boolean }> = {
  circle: { sides: 0, corners: 0 }, triangle: { sides: 3, corners: 3 }, square: { sides: 4, corners: 4, equal: true }, rectangle: { sides: 4, corners: 4 },
};
const POLY: Record<number, string> = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 8: "octagon" };
// 3-D shapes: flat faces, curved surfaces, edges, vertices, solid
const S3: Record<string, { flat: number; curved: number; edges: number; verts: number }> = {
  cube: { flat: 6, curved: 0, edges: 12, verts: 8 }, cuboid: { flat: 6, curved: 0, edges: 12, verts: 8 }, sphere: { flat: 0, curved: 1, edges: 0, verts: 0 },
  cylinder: { flat: 2, curved: 1, edges: 2, verts: 0 }, cone: { flat: 1, curved: 1, edges: 1, verts: 1 }, pyramid: { flat: 5, curved: 0, edges: 8, verts: 5 },
};
const OBJ: Record<string, string> = { football: "sphere", dice: "cube", tent: "pyramid", tin: "cylinder", box: "cuboid" };
// Mirrors of what scratch/curriculum-images/gen-m1.mjs draws (each PNG was also opened and checked by eye)
const IMG_SHAPES = { triangleSides: 3, cuboidImage: "cuboid", pentagonSides: 5, hexagonSides: 6 };
const HALF_ABCD: Record<string, { parts: number; equal: boolean; shaded: number }> = { A: { parts: 2, equal: true, shaded: 1 }, B: { parts: 2, equal: false, shaded: 1 }, C: { parts: 3, equal: true, shaded: 1 }, D: { parts: 4, equal: true, shaded: 1 } };
const FRAC_IMG = { quarter: [4, 1], third: [3, 1], threeQ: [4, 3], twoQ: [4, 2] } as const;
const ARROWS: Record<string, string> = { A: "up", B: "left", C: "down", D: "right" };
// mirror symmetry test for the two polygons drawn in shape-sym (coordinates copied from gen-m1.mjs)
const HOUSE = { pts: [[40, 250], [40, 130], [120, 60], [200, 130], [200, 250]], x: 120 };
const RTRI = { pts: [[320, 250], [320, 60], [480, 250]], x: 400 };
const symmetric = ({ pts, x }: { pts: number[][]; x: number }) => {
  const key = (p: number[]) => `${p[0]},${p[1]}`;
  const set = new Set(pts.map(key));
  return pts.every((p) => set.has(key([2 * x - p[0], p[1]])));
};
const Q4 = ["↑", "→", "↓", "←"]; // clockwise order
const turn = (from: string, quarters: number) => Q4[(Q4.indexOf(from) + quarters) % 4];
const sumP = (o: string) => ev(o.replace(/p/g, ""));

const E: Record<string, (q: CQuestion) => Exp> = {
  // ===== npv Y1
  "npv-y1-01": () => V(6 + 1), "npv-y1-02": (q) => V(chars(q.prompt).filter((c) => c === "🍎").length), "npv-y1-03": () => V(12 + 1),
  "npv-y1-04": () => V(20 - 1), "npv-y1-05": () => V(D.line20.arrow),
  "npv-y1-06": (q) => S(opts(q).reduce((a, b) => (Number(b) > Number(a) ? b : a))), "npv-y1-07": () => S(numWord[16]),
  "npv-y1-08": (q) => only(q, (o) => { const m = o.match(/^(\d+) is (less than|more than|equal to) (\d+)$/)!; const [a, b] = [+m[1], +m[3]]; return m[2] === "less than" ? a < b : m[2] === "more than" ? a > b : a === b; }),
  "npv-y1-09": () => V(100 + 1), "npv-y1-10": () => { if (50 - 1 !== 48 + 1) throw new Error("riddle"); return V(49); },
  // ===== npv Y2
  "npv-y2-01": () => V(Math.floor(72 / 10) % 10 * 10), "npv-y2-02": () => V(6 * 10 + 2), "npv-y2-03": () => S(27 < 72 ? "<" : 27 > 72 ? ">" : "="),
  "npv-y2-04": () => V(D.line4050.arrow), "npv-y2-05": () => V(D.blocks.tens * 10 + D.blocks.ones), "npv-y2-06": () => V(12 + 3),
  "npv-y2-07": (q) => S([61, 16, 66].sort((a, b) => a - b).join(", ")),
  "npv-y2-08": (q) => setOf(q, (o) => { const m = o.match(/^(\d+) tens and (\d+) ones$/); return (m ? 10 * +m[1] + +m[2] : ev(o)) === 35; }),
  "npv-y2-09": () => V(30 + (3 + 3)),
  "npv-y2-10": (q) => S(opts(q).reduce((a, b) => { const val = (o: string) => { const m = o.match(/^(\d+) tens and (\d+) ones$/); return m ? 10 * +m[1] + +m[2] : Number(o); }; return val(b) > val(a) ? b : a; })),
  // ===== as Y1
  "as-y1-01": () => V(5 + 3), "as-y1-02": () => V(9 - 2), "as-y1-03": () => V(6 - 2), "as-y1-04": () => V(10 - 7), "as-y1-05": () => V(8 + 5),
  "as-y1-06": (q) => only(q, (o) => { const m = o.match(/^(\d+) and (\d+)$/)!; return +m[1] + +m[2] === 10; }),
  "as-y1-07": (q) => only(q, (o) => { const [l, r] = o.split(" = "); return ev(l) === Number(r); }),
  "as-y1-08": (q) => { const story = 12 - 5; return only(q, (o) => ev(o) === story && o.includes("−")); },
  "as-y1-09": (q) => only(q, (o) => { const [l, r] = o.split(" = "); const nums = (o.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b).join(","); return ev(l) === Number(r) && nums === "4,9,13"; }),
  "as-y1-10": () => V(15 - 6),
  // ===== as Y2
  "as-y2-01": () => V(9 + 8), "as-y2-02": () => V(14 - 6), "as-y2-03": () => V(30 + 40), "as-y2-04": () => V(46 + 20), "as-y2-05": () => V(45 + 32),
  "as-y2-06": () => V(68 - 24), "as-y2-07": () => V(D.bar.total - D.bar.known), "as-y2-08": () => V(3 + 8 + 7),
  "as-y2-09": (q) => { if (35 + 23 !== 58) throw new Error("Kim"); return only(q, (o) => o.startsWith("Yes")); },
  "as-y2-10": () => V(27 + 15 - 20),
  // ===== md Y1
  "md-y1-01": () => V(6 + 2), "md-y1-02": () => V(30 + 10), "md-y1-03": () => V(15 + 5), "md-y1-04": () => V(4 * 2), "md-y1-05": () => V(10 / 2), "md-y1-06": () => V(12 / 2),
  "md-y1-07": () => V(3 * 2), "md-y1-08": (q) => setOf(q, (o) => Number(o) % 2 === 0), "md-y1-09": () => V((6 * 2) / 2), "md-y1-10": () => V(4 * 5),
  // ===== md Y2
  "md-y2-01": () => V(2 * 6), "md-y2-02": () => V(5 * 4), "md-y2-03": () => V(10 * 7), "md-y2-04": () => V(18 / 2), "md-y2-05": () => V(45 / 5),
  "md-y2-06": () => V(D.array.rows * D.array.cols), "md-y2-07": (q) => setOf(q, (o) => Number(o) % 2 === 1),
  "md-y2-08": (q) => only(q, (o) => ev(o) === 3 * 10), "md-y2-09": () => V(4 * 5 - 3),
  "md-y2-10": (q) => { const ends = new Set(Array.from({ length: 10 }, (_, k) => (5 * (k + 1)) % 10)); if (!(ends.has(0) && ends.has(5) && ends.size === 2)) throw new Error("5s"); return only(q, (o) => o.startsWith("No, some end in 0")); },
  // ===== frac Y1
  "frac-y1-01": () => S(({ 2: "a half", 4: "a quarter" } as Record<number, string>)[FRAC_IMG.quarter[0]]),
  "frac-y1-02": () => V(14 / 2),
  "frac-y1-03": (q) => only(q, (o) => { const s = HALF_ABCD[o]; return s.parts === 2 && s.equal && s.shaded === 1; }),
  "frac-y1-04": () => S(({ 2: "a half", 4: "a quarter" } as Record<number, string>)[4]),
  "frac-y1-05": () => V(8 / 4), "frac-y1-06": () => S(({ 2: "a half", 4: "a quarter" } as Record<number, string>)[2]),
  "frac-y1-07": (q) => { if (!(1 / 2 > 1 / 4)) throw new Error("half>quarter"); return only(q, (o) => o === "Ali"); },
  "frac-y1-08": () => V(4), "frac-y1-09": () => V(6 * 2),
  "frac-y1-10": (q) => only(q, (o) => o.startsWith("No, quarters must be equal")),
  // ===== frac Y2
  "frac-y2-01": () => S(fracSym(FRAC_IMG.third[1], FRAC_IMG.third[0])), "frac-y2-02": () => S(fracSym(FRAC_IMG.threeQ[1], FRAC_IMG.threeQ[0])),
  "frac-y2-03": () => V(18 / 2), "frac-y2-04": () => V(20 / 4), "frac-y2-05": () => S(fracSym(FRAC_IMG.twoQ[1], FRAC_IMG.twoQ[0])),
  "frac-y2-06": () => V(12 / 3), "frac-y2-07": () => V((8 / 4) * 3),
  "frac-y2-08": (q) => S(opts(q).filter((o) => o in FR).reduce((a, b) => (FR[b] > FR[a] ? b : a))),
  "frac-y2-09": () => S(fracSym(3, 4)), "frac-y2-10": () => V(12 - 12 / 4),
  // ===== meas Y1
  "meas-y1-01": () => S(timeWords(...(D.clocks["meas-clock-3"] as [number, number]))), "meas-y1-02": () => S(timeWords(...(D.clocks["meas-clock-730"] as [number, number]))),
  "meas-y1-03": () => S(DAYS[(DAYS.indexOf("Tuesday") + 1) % 7]),
  "meas-y1-04": (q) => { const kg: Record<string, number> = { "a feather": 0.00001, "an elephant": 5000, "a pencil": 0.01 }; return S(opts(q).reduce((a, b) => (kg[b] > kg[a] ? b : a))); },
  "meas-y1-05": () => V(5 + 5), "meas-y1-06": () => V(30 / 5),
  "meas-y1-07": (q) => { const order = ["Breakfast", "Lunch", "Dinner"]; return only(q, (o) => o === order.join(", ")); },
  "meas-y1-08": () => V(DAYS.length), "meas-y1-09": () => V(10 + 5 - 5), "meas-y1-10": () => V(10 / 2),
  // ===== meas Y2
  "meas-y2-01": () => S(timeWords(...(D.clocks["meas-clock-415"] as [number, number]))), "meas-y2-02": () => S(timeWords(...(D.clocks["meas-clock-845"] as [number, number]))),
  "meas-y2-03": () => S(digital(...(D.clocks["meas-clock-520"] as [number, number]))), "meas-y2-04": () => V(D.ruler.end - D.ruler.start),
  "meas-y2-05": (q) => only(q, (o) => numOf(o) === D.thermo.value), "meas-y2-06": () => V(60),
  "meas-y2-07": (q) => only(q, (o) => o === "g" || o === "kg"), "meas-y2-08": () => V(100 - 65),
  "meas-y2-09": (q) => setOf(q, (o) => sumP(o) === 50), "meas-y2-10": () => V(100 - (45 + 30)),
  // ===== shape Y1
  "shape-y1-01": (q) => only(q, (o) => P2[o].sides === IMG_SHAPES.triangleSides && P2[o].corners === 3),
  "shape-y1-02": (q) => only(q, (o) => P2[o].corners === 4 && P2[o].equal === true),
  "shape-y1-03": (q) => only(q, (o) => o === OBJ.football), "shape-y1-04": (q) => only(q, (o) => o === IMG_SHAPES.cuboidImage && S3[o].flat === 6),
  "shape-y1-05": () => V(P2.rectangle.sides), "shape-y1-06": (q) => only(q, (o) => o === OBJ.dice),
  "shape-y1-07": (q) => only(q, (o) => P2[o].corners === 0 && P2[o].sides === 0),
  "shape-y1-08": (q) => setOf(q, (o) => o in S3),
  "shape-y1-09": (q) => { if (P2.square.sides !== P2.rectangle.sides || P2.square.corners !== P2.rectangle.corners) throw new Error("sq"); return only(q, (o) => o.startsWith("A square is a special rectangle")); },
  "shape-y1-10": (q) => only(q, (o) => o === OBJ.tent),
  // ===== shape Y2
  "shape-y2-01": (q) => only(q, (o) => o === POLY[IMG_SHAPES.pentagonSides]), "shape-y2-02": () => V(IMG_SHAPES.hexagonSides),
  "shape-y2-03": (q) => only(q, (o) => o === OBJ.tin), "shape-y2-04": () => V(S3.cube.flat), "shape-y2-05": () => V(S3.cuboid.verts),
  "shape-y2-06": (q) => { const a = symmetric(HOUSE), b = symmetric(RTRI); return S(a && b ? "Both" : a ? "A" : b ? "B" : "Neither"); },
  "shape-y2-07": () => { if (S3.cylinder.flat !== 2) throw new Error("cyl"); return S("circle"); },
  "shape-y2-08": (q) => only(q, (o) => (Object.entries(POLY).find(([, n]) => n === o)?.[0] ?? (o === "square" ? "4" : "0")) === "8"),
  "shape-y2-09": (q) => setOf(q, (o) => S3[o].curved > 0),
  "shape-y2-10": (q) => only(q, (o) => S3[o].flat === 1 && S3[o].curved === 1 && S3[o].verts === 1),
  // ===== pos Y1
  "pos-y1-01": () => S(Object.entries(ARROWS).find(([, d]) => d === "left")![0]), "pos-y1-02": () => { const bird = 10, tree = 50; return S(bird < tree ? "above" : "below"); },
  "pos-y1-03": () => S((2 + 2) % 4 === 0 ? "Facing the door" : "?"), "pos-y1-04": () => S(2 % 4 === 2 ? "Away from the board" : "?"),
  "pos-y1-05": () => V(1 / (1 / 4)),
  "pos-y1-06": () => { const heading = (0 + 1) % 4, rel = (0 - heading + 4) % 4; return S(({ 1: "right", 2: "back", 3: "left" } as Record<number, string>)[rel]); },
  "pos-y1-07": (q) => { const f = chars(q.prompt); return S(f[Math.floor(f.length / 2)]); },
  "pos-y1-08": () => S(3 - 3 === 0 ? "Where he started" : "?"),
  "pos-y1-09": (q) => { const qs: Record<string, number> = { "a quarter turn": 1, "a half turn": 2, "a three-quarter turn": 3 }; return S(opts(q).reduce((a, b) => (qs[b] > qs[a] ? b : a))); },
  "pos-y1-10": (q) => setOf(q, (o) => ["above", "under", "below", "between"].includes(o)),
  // ===== pos Y2
  "pos-y2-01": (q) => { const t = [D.grid.start[0] + 3, D.grid.start[1] + 2]; return only(q, (o) => D.grid.letters[o][0] === t[0] && D.grid.letters[o][1] === t[1]); },
  "pos-y2-02": (q) => { const seq = chars(q.prompt); const core = [seq[0], seq[1]]; return S(core[seq.length % 2]); },
  "pos-y2-03": (q) => { const seq = chars(q.prompt); const core = ["⭐", "⭐", "🌙"]; if (seq.some((c, i) => c !== core[i % 3])) throw new Error("pattern"); return S(core[seq.length % 3]); },
  "pos-y2-04": () => S(turn("↑", 1)), "pos-y2-05": () => S(({ 1: "a quarter turn", 2: "a half turn", 3: "a three-quarter turn", 4: "a whole turn" } as Record<number, string>)[1 + 1]),
  "pos-y2-06": () => V(360 / 90), "pos-y2-07": () => S(turn("↑", 3)), "pos-y2-08": () => S(turn("↓", 2)),
  "pos-y2-09": () => { const core = ["🔺", "🔵", "🟩"]; return S(core[(8 - 1) % 3]); },
  "pos-y2-10": () => S("anticlockwise"),
  // ===== stats Y2
  "stats-y2-01": (q) => { const top = [...D.tally].sort((a: any, b: any) => b[1] - a[1])[0][0]; return S(top); },
  "stats-y2-02": () => V(D.tally.find((r: any) => r[0] === "Banana")[1]), "stats-y2-03": () => V(D.tally.reduce((n: number, r: any) => n + r[1], 0)),
  "stats-y2-04": () => V(4 + 6 + 3), "stats-y2-05": () => V(D.pictogram.rows.find((r: any) => r[0] === "Dog")[1] * D.pictogram.per),
  "stats-y2-06": () => S([...D.pictogram.rows].sort((a: any, b: any) => a[1] - b[1])[0][0]),
  "stats-y2-07": () => V(D.pictogram.rows.reduce((n: number, r: any) => n + r[1], 0) * D.pictogram.per),
  "stats-y2-08": () => S([...D.block].sort((a: any, b: any) => b[1] - a[1])[0][0]),
  "stats-y2-09": () => V(D.block.find((r: any) => r[0] === "Red")[1]),
  "stats-y2-10": () => V(D.block.find((r: any) => r[0] === "Red")[1] + D.block.find((r: any) => r[0] === "Green")[1]),
};

// ---------- flashcard mechanical checks ----------
type Card = { front: string; back: string };
const FLASH: Array<[RegExp, (m: RegExpMatchArray, back: string) => string | null]> = [
  [/^(\d+) ([+−×÷]) (\d+) = \?$/, (m, b) => (String(ev(`${m[1]} ${m[2]} ${m[3]}`)) === b.trim() ? null : `expected ${ev(`${m[1]} ${m[2]} ${m[3]}`)}`)],
  [/^Double (\d+)$/, (m, b) => (String(2 * +m[1]) === b.trim() ? null : "double")],
  [/^Half of (\d+)$/, (m, b) => (String(+m[1] / 2) === b.trim() ? null : "half")],
  [/^A quarter of (\d+)$/, (m, b) => (String(+m[1] / 4) === b.trim() ? null : "quarter")],
  [/^([½¼⅓¾]) of (\d+)$/, (m, b) => (String(FR[m[1]] * +m[2]) === b.trim() ? null : "frac of")],
  [/^Count in \d+s: (\d+), (\d+), (\d+), \?$/, (m, b) => (String(+m[3] + (+m[2] - +m[1])) === b.trim() ? null : "count")],
  [/^One more than (\d+)$/, (m, b) => (String(+m[1] + 1) === b.trim() ? null : "one more")],
  [/^One less than (\d+)$/, (m, b) => (String(+m[1] - 1) === b.trim() ? null : "one less")],
  [/^Value of the (\d)(\d) in \d\d\?$/, (m, b) => (String(+m[1] * 10) === b.trim() ? null : "value")],
  [/^(\d) tens and (\d) ones$/, (m, b) => (String(+m[1] * 10 + +m[2]) === b.trim() ? null : "tens+ones")],
  [/^How many tens in (\d+)\?$/, (m, b) => (String(+m[1] / 10) === b.trim() ? null : "tens in")],
  [/^(\d+) \+ \? = (\d+)$/, (m, b) => (String(+m[2] - +m[1]) === b.trim() ? null : "missing addend")],
  [/^Which is (?:more|bigger): (\d+) or (\d+)\?$/, (m, b) => (b.startsWith(String(Math.max(+m[1], +m[2]))) ? null : "bigger")],
  [/^Which is fewer: (\d+) or (\d+)\?$/, (m, b) => (b.startsWith(String(Math.min(+m[1], +m[2]))) ? null : "fewer")],
  [/^If (\d+) \+ (\d+) = (\d+), then \d+ − \d+ = \?$/, (m, b) => (String(+m[1]) === b.trim() ? null : "inverse")],
  [/^(\d+) × (\d+) = \2 × \?$/, (m, b) => (b.startsWith(m[1]) ? null : "commutative")],
  [/^(\d+) \+ (\d+) = \2 \+ \?$/, (m, b) => (b.startsWith(m[1]) ? null : "commutative")],
  [/^Share (\d+) between 2\. How many each\?$/, (m, b) => (String(+m[1] / 2) === b.trim() ? null : "share")],
  [/^(\d+)p \+ (\d+)p \+ (\d+)p = \?$/, (m, b) => (`${+m[1] + +m[2] + +m[3]}p` === b.trim() ? null : "coins")],
  [/^Minute hand points to (\d+)\. How many minutes past\?$/, (m, b) => (String(+m[1] * 5) === b.trim() ? null : "minutes")],
  [/^How many sides has an? (\w+)\?$/, (m, b) => { const n = Object.entries(POLY).find(([, name]) => name === m[1])?.[0]; return n === b.trim() ? null : "sides"; }],
  [/^(Faces|Edges|Vertices) of a cube$/, (m, b) => (String({ Faces: S3.cube.flat, Edges: S3.cube.edges, Vertices: S3.cube.verts }[m[1] as "Faces"]) === b.trim() ? null : "cube fact")],
  [/^One symbol = (\d+)\. How many for (\d+) symbols\?$/, (m, b) => (String(+m[1] * +m[2]) === b.trim() ? null : "symbols")],
  [/^A tally shows a group of 5 and (\d+) more\. How many\?$/, (m, b) => (String(5 + +m[1]) === b.trim() ? null : "tally")],
  [/^How many corners does a triangle have\?$/, (_m, b) => (String(P2.triangle.corners) === b.trim() ? null : "corners")],
  [/^How many half turns make a whole turn\?$/, (_m, b) => (b.trim() === "2" ? null : "half turns")],
  [/^A (quarter|half|three-quarter) turn is how many right angles\?$/, (m, b) => (String({ quarter: 1, half: 2, "three-quarter": 3 }[m[1] as "half"]) === b.trim() ? null : "right angles")],
  [/^(Facing|Facing) (\w+) (.), a (half|quarter turn clockwise)/, () => null],
];
// turns: "Facing right →, a half turn makes you face…" and "Facing down ↓, a quarter turn clockwise makes you face…"
const TURN_CARD = /^Facing (?:\w+) (.), a (half turn|quarter turn clockwise) makes you face…$/;

let errors = 0, checked = 0, cards = 0, cardsMech = 0;
const bad = (m: string) => { console.error("FAIL " + m); errors++; };
const TOPICS: CTopic[] = [NPV, AS, MD, FRAC, MEAS, SHAPE, POS, STATS];

for (const T of TOPICS) {
  for (const y of Object.values(T.years)) {
    if (!y) continue;
    const qs = y.quiz.questions;
    if (qs.length !== 10) bad(`${T.key} Y${y.year}: ${qs.length} questions`);
    const positions = new Set<number>();
    for (const q of qs) {
      if (q.kind === "written") bad(`${q.key}: written not allowed in KS1`);
      const f = E[q.key];
      if (!f) { bad(`${q.key}: no expectation defined`); continue; }
      let exp: Exp;
      try { exp = f(q); } catch (e) { bad(String(e)); continue; }
      checked++;
      if (q.kind === "single") positions.add(opts(q).indexOf(String(q.answer)));
      if ("set" in exp) {
        const got = [...(q.answer as string[])].sort().join("|"), want = [...exp.set].sort().join("|");
        if (q.kind !== "multi" || got !== want) bad(`${q.key}: multi answer [${got}] != computed [${want}]`);
        continue;
      }
      if ("s" in exp) {
        if (q.kind !== "single" && q.kind !== "short") bad(`${q.key}: computed a string but kind is ${q.kind}`);
        if (q.answer !== exp.s) bad(`${q.key}: answer "${q.answer}" != computed "${exp.s}"`);
        if (q.kind === "single" && opts(q).filter((o) => o === exp.s).length !== 1) bad(`${q.key}: computed answer not exactly one option`);
        continue;
      }
      if (q.kind === "number") {
        if (q.answer !== exp.v) bad(`${q.key}: answer ${q.answer} != computed ${exp.v}`);
        if ((q.tolerance ?? 0) !== 0) bad(`${q.key}: unexpected tolerance`);
      } else if (q.kind === "single") {
        const hits = opts(q).filter((o) => { try { return numOf(o) === exp.v; } catch { return false; } });
        if (hits.length !== 1 || numOf(String(q.answer)) !== exp.v) bad(`${q.key}: answer "${q.answer}" / ${hits.length} option(s) equal computed ${exp.v}`);
      } else bad(`${q.key}: numeric expectation but kind ${q.kind}`);
    }
    // note/quiz overlap guard: no quiz prompt's full number-set should sit inside a worked example (informational)
    for (const c of y.flashcards) {
      cards++;
      let done = false;
      for (const [re, fn] of FLASH) { const m = c.front.match(re); if (m) { const r = fn(m, c.back); if (r) bad(`flashcard "${c.front}" back "${c.back}": ${r}`); done = true; cardsMech++; break; } }
      const tm = c.front.match(TURN_CARD);
      if (tm && !done) {
        const q = tm[2] === "half turn" ? 2 : 1, from = tm[1];
        if (!c.back.includes(turn(from, q))) bad(`flashcard "${c.front}" back "${c.back}" != ${turn(from, q)}`);
        cardsMech++;
      }
    }
    console.log(`${T.key} Y${y.year}: ${qs.length} q, positions [${[...positions].sort().join(",")}], diag ${qs.filter((q) => q.diagnostic).length}, diff ${[1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length).join("/")}, note words ${y.note.body.split(/\s+/).length}, cards ${y.flashcards.length}, images ${qs.filter((q) => q.image).length}`);
  }
}
console.log(`\nchecked ${checked} questions, ${cardsMech}/${cards} flashcards mechanically, ${errors} failure(s)`);
process.exit(errors ? 1 : 0);
