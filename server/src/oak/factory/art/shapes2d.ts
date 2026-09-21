// 2D shapes, circle parts and angles (Maths). Equal-length sides carry the same number of tick marks; parallel sides carry arrow marks;
// right angles carry a square marker. Regular polygons are computed from their circumradius, so the geometry is exact.
import type { Pic } from "./types";
import { cap, svg, poly, path, ln, circ, txt, pt, arc, sector, rightAngle, arrow, dot, rect, pline } from "./helpers";

const W = 240, H = 170;
const M: Pic["subjects"] = ["Maths"];

/** k short tick marks across the middle of segment p->q */
function ticks(p: [number, number], q: [number, number], k: number): string {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, a = Math.atan2(q[1] - p[1], q[0] - p[0]), nx = -Math.sin(a), ny = Math.cos(a), ux = Math.cos(a), uy = Math.sin(a);
  let s = ""; for (let i = 0; i < k; i++) { const off = (i - (k - 1) / 2) * 5; s += ln(mx + ux * off - nx * 5, my + uy * off - ny * 5, mx + ux * off + nx * 5, my + uy * off + ny * 5, "th2"); }
  return s;
}
/** a small ">" arrow mark on segment p->q (parallel sides), `k` of them */
function para(p: [number, number], q: [number, number], k = 1): string {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, a = Math.atan2(q[1] - p[1], q[0] - p[0]); let s = "";
  for (let i = 0; i < k; i++) { const o = (i - (k - 1) / 2) * 7, cx = mx + Math.cos(a) * o, cy = my + Math.sin(a) * o; const b = (d: number): [number, number] => [cx - 5 * Math.cos(a) + d * 5 * Math.sin(a), cy - 5 * Math.sin(a) - d * 5 * Math.cos(a)]; s += pline([b(-1), [cx + 2 * Math.cos(a), cy + 2 * Math.sin(a)], b(1)], "th2"); }
  return s;
}
const regular = (n: number, cx: number, cy: number, R: number, start = 90): [number, number][] => Array.from({ length: n }, (_, i) => pt(cx, cy, R, start + (360 / n) * i));
const mk = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, extra: Partial<Pic>, evidence: string, doesNotShow = "any other 2D shape; no measurements"): Pic =>
  ({ id, title, alt, caption, subjects: M, concepts, family: "2d", doesNotShow, evidence, svg: svg(W, H, body), ...extra });

const eq: [number, number][] = [[50, 138], [190, 138], [120, 17]];
const iso: [number, number][] = [[70, 138], [170, 138], [120, 30]];
const sca: [number, number][] = [[45, 138], [185, 138], [100, 32]];
const rt: [number, number][] = [[60, 138], [190, 138], [60, 40]];
const par: [number, number][] = [[50, 132], [160, 132], [200, 52], [90, 52]];
const rho: [number, number][] = [[120, 22], [190, 82], [120, 142], [50, 82]];
const trap: [number, number][] = [[40, 132], [200, 132], [160, 52], [80, 52]];
const kite: [number, number][] = [[120, 18], [180, 78], [120, 146], [60, 78]];
const rectP: [number, number][] = [[45, 122], [195, 122], [195, 42], [45, 42]];
const sqP: [number, number][] = [[70, 140], [170, 140], [170, 40], [70, 40]];

// small versions used in the overview pictures
const sm = (pts: [number, number][], sx: number, sy: number, k: number): [number, number][] => pts.map((p) => [sx + p[0] * k, sy + p[1] * k]);

const quadOverview = (() => {
  const cells: { n: string; pts: [number, number][] }[] = [
    { n: "square", pts: [[0, 0], [46, 0], [46, 46], [0, 46]] }, { n: "rectangle", pts: [[0, 8], [62, 8], [62, 46], [0, 46]] }, { n: "parallelogram", pts: [[0, 46], [46, 46], [64, 8], [18, 8]] },
    { n: "rhombus", pts: [[28, 0], [56, 26], [28, 52], [0, 26]] }, { n: "trapezium", pts: [[0, 46], [64, 46], [50, 8], [14, 8]] }, { n: "kite", pts: [[28, 0], [52, 22], [28, 56], [4, 22]] },
  ];
  let s = "";
  cells.forEach((c, i) => { const col = i % 3, row = Math.floor(i / 3), x = 14 + col * 76, y = 14 + row * 80; s += poly(sm(c.pts, x, y, 1), "l f1") + txt(x + 32, y + 68, c.n, "ts"); });
  return s;
})();
const polyOverview = (() => {
  const items: { n: string; pts: [number, number][]; l: string }[] = [
    { n: "triangle", pts: regular(3, 0, 0, 30, 90), l: "3 sides" }, { n: "quadrilateral", pts: [[-26, 22], [28, 22], [34, -22], [-20, -28]], l: "4 sides" },
    { n: "pentagon", pts: regular(5, 0, 0, 30, 90), l: "5 sides" }, { n: "hexagon", pts: regular(6, 0, 0, 30, 90), l: "6 sides" },
  ];
  let s = ""; items.forEach((it, i) => { const cx = 62 + (i % 2) * 116, cy = 44 + Math.floor(i / 2) * 78; s += poly(it.pts.map((p) => [p[0] + cx, p[1] + cy]), "l f1") + txt(cx, cy + 46, `${it.n} (${it.l})`, "ts"); });
  return s;
})();

export const SHAPES2D: Pic[] = [
  mk("circle", "Circle", ["circle"], circ(120, 78, 62, "l f1") + dot(120, 78, 3) + cap("a round shape: every point is the same distance from the centre"),
    "A circle with its centre marked.", "Circle", { avoid: ["unit circle", "circular geoboard", "turn", "clock", "quarter turn", "circle theorem", "venn", "circle graph", "pie", "circle diagram", "circle the", "circle a", "circle your", "circle each", "circle all",
    // the graph / equation of a circle (KS4 coordinate geometry) has its own picture (circle-equation); the plain circle has no axes, origin or equation
    "graph of a circle", "graph of the circle", "graphs of circles", "graph", "equation", "origin", "coordinate", "coordinates", "x²", "y²", "x axis", "y axis"] }, "Circle = set of points at a fixed distance from the centre. Drawn: circle outline + centre point."),
  mk("semicircle", "Semicircle", ["semicircle", "semi-circle"], path("M50 110 A70 70 0 0 1 190 110 Z", "l f1") + cap("half of a circle"),
    "A semicircle: half a circle cut along its diameter.", "Semicircle", { family: "circle" }, "Semicircle = half a circle bounded by a diameter and an arc."),
  mk("equilateral-triangle", "Equilateral triangle", ["equilateral triangle", "equilateral"], poly(eq, "l f1") + ticks(eq[0], eq[1], 1) + ticks(eq[1], eq[2], 1) + ticks(eq[2], eq[0], 1) + cap("3 equal sides, 3 equal angles"),
    "An equilateral triangle: three sides of equal length shown by matching tick marks.", "Equilateral triangle", {}, "Equilateral = all 3 sides equal (so all angles 60 degrees). Side length 140 with height 121 = 140 x sin 60 degrees (exact)."),
  mk("isosceles-triangle", "Isosceles triangle", ["isosceles triangle", "isosceles"], poly(iso, "l f1") + ticks(iso[0], iso[2], 1) + ticks(iso[1], iso[2], 1) + cap("2 equal sides, 2 equal base angles"),
    "An isosceles triangle: two sides of equal length shown by matching tick marks.", "Isosceles triangle", {}, "Isosceles = exactly two equal sides. Apex on the perpendicular bisector of the base (x=120), so the two sloping sides are equal."),
  mk("scalene-triangle", "Scalene triangle", ["scalene triangle", "scalene"], poly(sca, "l f1") + ticks(sca[0], sca[1], 1) + ticks(sca[1], sca[2], 2) + ticks(sca[2], sca[0], 3) + cap("3 different sides, 3 different angles"),
    "A scalene triangle: all three sides different lengths, shown by different tick marks.", "Scalene triangle", {}, "Scalene = no equal sides. Sides 140, 133, 123 (all different)."),
  mk("right-angled-triangle", "Right-angled triangle", ["right-angled triangle", "right angled triangle", "right-angle triangle", "right triangle"], poly(rt, "l f1") + rightAngle(60, 138, 0, 90, 12) + cap("one angle is a right angle (90°)"),
    "A right-angled triangle with the right angle marked by a small square.", "Right-angled triangle", { avoid: ["hypotenuse", "opposite", "adjacent", "pythagoras", "=sin", "=cos", "=tan", "trigonometr", "non right", "not right", "non-right", "isosceles right"] }, "Right-angled triangle = one angle of 90 degrees. Vertical and horizontal legs meet at (60,138). Not used when the slide is about hypotenuse/trigonometry (that has its own labelled picture)."),
  mk("square", "Square", ["square"], poly(sqP, "l f1") + ticks(sqP[0], sqP[1], 1) + ticks(sqP[1], sqP[2], 1) + ticks(sqP[2], sqP[3], 1) + ticks(sqP[3], sqP[0], 1) + rightAngle(70, 140, 0, 90) + rightAngle(170, 140, 180, 90) + rightAngle(170, 40, 180, 270) + rightAngle(70, 40, 0, 270) + cap("4 equal sides, 4 right angles"),
    "A square: four equal sides and four right angles.", "Square", { avoid: ["square corner", "square number", "square root", "squared", "squaring", "square unit", "square centimetre", "square metre", "square metres", "square kilometre", "square millimetre", "square brackets", "square the", "perfect square", "completing the square", "square miles", "difference of two squares", "difference of squares", "sum of squares", "square sequence", "square-based", "square based", "=cm2", "=m2", "root", "cubes", "counting", "count squares", "number of squares", "with squares", "unit square", "grid", "factor", "multiple", "prime", "sequence", "difference", "expression", "algebra", "expand", "completing"] }, "Square = 4 equal sides + 4 right angles. Exact 100x100. Never used for 'square number / square root / squared / square units' (a different meaning of the word)."),
  mk("rectangle", "Rectangle", ["rectangle"], poly(rectP, "l f1") + ticks(rectP[0], rectP[1], 1) + ticks(rectP[2], rectP[3], 1) + ticks(rectP[1], rectP[2], 2) + ticks(rectP[3], rectP[0], 2) + rightAngle(45, 122, 0, 90) + rightAngle(195, 122, 180, 90) + rightAngle(195, 42, 180, 270) + rightAngle(45, 42, 0, 270) + cap("opposite sides equal, 4 right angles"),
    "A rectangle: opposite sides equal (matching ticks) and four right angles.", "Rectangle", { avoid: ["rectangular prism", "rectangular based", "area of a rectangle", "composite rectangle", "compound rectangle"] }, "Rectangle = 4 right angles, opposite sides equal. 150 by 80 (not a square)."),
  mk("parallelogram", "Parallelogram", ["parallelogram"], poly(par, "l f1") + para(par[0], par[1], 1) + para(par[3], par[2], 1) + para(par[1], par[2], 2) + para(par[0], par[3], 2) + cap("opposite sides parallel and equal"),
    "A parallelogram: two pairs of parallel sides, marked with arrows.", "Parallelogram", {}, "Parallelogram = 2 pairs of parallel sides, opposite sides equal. Vertices (50,132),(160,132),(200,52),(90,52): both pairs of opposite sides are translations of each other."),
  mk("rhombus", "Rhombus", ["rhombus"], poly(rho, "l f1") + rho.map((p, i) => ticks(p, rho[(i + 1) % 4], 1)).join("") + cap("4 equal sides, opposite sides parallel"),
    "A rhombus: four equal sides (matching ticks), drawn as a tilted diamond.", "Rhombus", {}, "Rhombus = 4 equal sides. Vertices (120,22),(190,82),(120,142),(50,82): all sides 92.2 (exact equal)."),
  mk("trapezium", "Trapezium", ["trapezium", "trapezoid"], poly(trap, "l f1") + para(trap[0], trap[1], 1) + para(trap[3], trap[2], 1) + cap("one pair of parallel sides"),
    "A trapezium: one pair of parallel sides (top and bottom), marked with arrows.", "Trapezium", {}, "Trapezium (UK) = exactly one pair of parallel sides. Top and bottom horizontal and unequal; sloping sides not parallel."),
  mk("kite", "Kite", ["kite"], poly(kite, "l f1") + ticks(kite[0], kite[1], 1) + ticks(kite[3], kite[0], 1) + ticks(kite[1], kite[2], 2) + ticks(kite[2], kite[3], 2) + cap("2 pairs of equal sides next to each other"),
    "A kite: two pairs of equal adjacent sides, shown with one and two ticks.", "Kite", { avoid: ["kite flying", "fly a kite"] }, "Kite = two pairs of adjacent equal sides. Upper sides 84.9 each, lower sides 92.2 each (pairs differ), symmetric about x=120."),
  mk("pentagon", "Regular pentagon", ["pentagon"], poly(regular(5, 120, 88, 68), "l f1") + cap("5 sides, 5 vertices"), "A regular pentagon: five equal sides.", "Pentagon", { avoid: ["irregular pentagon"] }, "Pentagon = 5 sides. Computed on a circumcircle at 72 degree steps (exact regular)."),
  mk("hexagon", "Regular hexagon", ["hexagon"], poly(regular(6, 120, 86, 68, 0), "l f1") + cap("6 sides, 6 vertices"), "A regular hexagon: six equal sides.", "Hexagon", { avoid: ["hexagonal"] }, "Hexagon = 6 sides. Computed on a circumcircle at 60 degree steps (exact regular)."),
  mk("octagon", "Regular octagon", ["octagon"], poly(regular(8, 120, 86, 68, 22.5), "l f1") + cap("8 sides, 8 vertices"), "A regular octagon: eight equal sides.", "Octagon", { avoid: ["octagonal"] }, "Octagon = 8 sides. Computed on a circumcircle at 45 degree steps (exact regular)."),
  mk("quadrilaterals", "Quadrilaterals", ["quadrilateral"], quadOverview, "Six quadrilaterals: square, rectangle, parallelogram, rhombus, trapezium and kite.", "Quadrilaterals (4 sides)",
    { covers: ["square", "rectangle", "parallelogram", "rhombus", "trapezium", "trapezoid", "kite"], avoid: ["irregular quadrilateral", "cyclic quadrilateral", "diagonal"] }, "Quadrilateral = 4-sided polygon. The 6 special quadrilaterals drawn with their standard shapes and labelled by name.", "irregular quadrilaterals; side lengths or angles"),
  mk("polygons", "Polygons", ["polygon"], polyOverview, "Four polygons: a triangle, a quadrilateral, a pentagon and a hexagon, each labelled with its number of sides.", "Polygons (straight sides)",
    { covers: ["quadrilateral", "pentagon", "hexagon"], avoid: ["regular polygon", "irregular polygon", "interior angle", "exterior angle", "frequency polygon", "polygon of forces"] }, "Polygon = closed 2D shape made of straight sides. Triangle (3), quadrilateral (4), pentagon (5), hexagon (6). Regular pentagon/hexagon computed exactly.", "shapes with curves; the words regular/irregular"),
];

// ── circle parts ────────────────────────────────────────────────────────────
const cp = (() => {
  const cx = 120, cy = 74, R = 54; const r30 = pt(cx, cy, R, 30), c1 = pt(cx, cy, R, 150), c2 = pt(cx, cy, R, 330);
  const chA = pt(cx, cy, R, 235), chB = pt(cx, cy, R, 305);
  return circ(cx, cy, R, "l f1") + ln(cx - R, cy, cx + R, cy, "a") + ln(cx, cy, r30[0], r30[1], "ar") + dot(cx, cy, 3)
    + ln(chA[0], chA[1], chB[0], chB[1], "ag") + arc(cx, cy, R, 95, 150, "ao")
    + txt(cx - 34, cy + 14, "diameter", "ts ta") + txt(r30[0] + 4, cy - 26, "radius", "ts tr tl") + txt(cx, cy + R + 16, "chord", "ts tg")
    + txt(cx - R + 2, cy - 46, "arc", "ts te")
    + txt(cx, 164, "circumference: the distance all the way round", "ts tm");
})();
const cs = (() => {
  const cx = 110, cy = 70, R = 50; const a = pt(cx, cy, R, 20), b = pt(cx, cy, R, 80), c = pt(cx, cy, R, 205), d = pt(cx, cy, R, 255); const tp = pt(cx, cy, R, 315);
  const tx = Math.cos((315 - 90) * Math.PI / 180), ty = -Math.sin((315 - 90) * Math.PI / 180);
  return circ(cx, cy, R, "l f0") + sector(cx, cy, R, 20, 80, "l f3") + path(`M${c[0]} ${c[1]} A${R} ${R} 0 0 0 ${d[0]} ${d[1]} Z`, "l f4")
    + ln(tp[0] - tx * 40, tp[1] - ty * 40, tp[0] + tx * 40, tp[1] + ty * 40, "a") + dot(tp[0], tp[1], 3)
    + txt(a[0] + 10, b[1] - 8, "sector", "ts tl") + txt(cx - 30, cy + R + 14, "segment", "ts") + txt(tp[0] + 30, tp[1] + 22, "tangent", "ts ta")
    + cap("sector: slice with two radii; segment: cut off by a chord", 168);
})();
export const CIRCLE_PARTS: Pic[] = [
  { id: "circle-parts", title: "Parts of a circle", alt: "A circle with its diameter, a radius, the circumference (the whole edge), a chord and an arc labelled.", caption: "Parts of a circle", subjects: M, family: "circle",
    concepts: ["radius", "diameter", "circumference", "chord", "arc"], requires: ["circle", "circular"], avoid: ["sphere", "cylinder", "cone", "sector", "segment", "tangent", "radius of a sphere", "semicircle", "hemisphere", "circle theorem", "circle theorems", "surface area", "volume"],
    doesNotShow: "sector, segment, tangent, angles; no measurements", evidence: "Radius = centre to edge (red), diameter = edge to edge through the centre (blue, horizontal through centre), circumference = the boundary, chord = line joining two points on the circle not through the centre (green), arc = part of the circumference (gold). Endpoints computed on the circle exactly.",
    svg: svg(W, H, cp) },
  { id: "circle-sector-segment", title: "Sector, segment and tangent", alt: "A circle with a shaded sector (a slice between two radii), a shaded segment (cut off by a chord) and a tangent line touching the circle at one point.", caption: "Sector, segment and tangent", subjects: M, family: "circle",
    concepts: ["sector", "segment", "tangent"], requires: ["circle", "circular"], avoid: ["line segment", "tangent function", "tangent graph", "trigonometr", "sine", "cosine", "gradient", "radius", "diameter", "circumference", "chord", "arc", "sphere", "cone", "cylinder", "tan "],
    doesNotShow: "radius, diameter, circumference, chord and arc labels; measurements", evidence: "Sector = region between two radii and an arc (gold). Segment = region between a chord and its arc (red). Tangent = straight line touching the circle at exactly one point (blue; drawn perpendicular to the radius, endpoints computed).", svg: svg(W, H, cs) },
];

// ── angles ──────────────────────────────────────────────────────────────────
const wedge = (cx: number, cy: number, a1: number, a2: number, R: number, fill = "f1") => sector(cx, cy, R, a1, a2, `th ${fill}`);
const types = (() => {
  const items = [
    { a: 45, n: "acute", s: "less than 90°", cx: 16, cy: 62, L: 62, lx: 16, ly: 84 }, { a: 90, n: "right angle", s: "exactly 90°", cx: 136, cy: 62, L: 54, lx: 136, ly: 84 }, { a: 135, n: "obtuse", s: "between 90° and 180°", cx: 60, cy: 148, L: 46, lx: 116, ly: 138 },
  ];
  let out = "";
  for (const it of items) {
    const e1 = pt(it.cx, it.cy, it.L, 0), e2 = pt(it.cx, it.cy, it.L, it.a);
    out += wedge(it.cx, it.cy, 0, it.a, 30) + ln(it.cx, it.cy, e1[0], e1[1]) + ln(it.cx, it.cy, e2[0], e2[1]) + (it.a === 90 ? rightAngle(it.cx, it.cy, 0, 90, 12) : arc(it.cx, it.cy, 22, 0, it.a, "th2"))
      + txt(it.lx, it.ly, it.n, "ts tl") + txt(it.lx, it.ly + 12, it.s, "ts tm tl");
  }
  return out;
})();
export const ANGLES: Pic[] = [
  { id: "angle-types", title: "Types of angle", alt: "Three angles: an acute angle (less than 90 degrees), a right angle (exactly 90 degrees, marked with a small square) and an obtuse angle (between 90 and 180 degrees).", caption: "Types of angle", subjects: M, family: "angle-types",
    concepts: ["acute angle", "obtuse angle", "right angle", "acute", "obtuse", "types of angle"], avoid: ["reflex", "right-angled", "right angled", "acute triangle", "obtuse triangle", "acute-angled", "obtuse-angled", "acute angled", "obtuse angled", "pythagoras", "hypotenuse"],
    doesNotShow: "straight angles (180 degrees), reflex angles (more than 180 degrees), angle facts or measurements beyond the labels",
    evidence: "Acute 45 degrees (<90), right 90 (square marker), obtuse 135 (90-180). Angles drawn with the exact arm directions using a maths-convention (anticlockwise) arm angle.",
    svg: svg(W, H, types) },
];

function twoLines(): { base: string; i1: [number, number]; i2: [number, number] } {
  const y1 = 52, y2 = 116, i2: [number, number] = [98, y2]; const t = (y2 - y1) / Math.sin(Math.PI / 3); const i1: [number, number] = [i2[0] + t * Math.cos(Math.PI / 3), y1];
  const e1: [number, number] = [i2[0] - 22 * Math.cos(Math.PI / 3), y2 + 22 * Math.sin(Math.PI / 3)], e2: [number, number] = [i1[0] + 22 * Math.cos(Math.PI / 3), y1 - 22 * Math.sin(Math.PI / 3)];
  const base = ln(24, y1, 216, y1) + ln(24, y2, 216, y2) + para([24, y1], [216, y1], 1) + para([24, y2], [216, y2], 1) + ln(e1[0], e1[1], e2[0], e2[1]);
  return { base, i1, i2 };
}
function parallelPic(id: string, title: string, concepts: string[], hi: { at: 1 | 2; a1: number; a2: number; c: string }[], caption: string, rule: string, alt: string, evidence: string): Pic {
  const { base, i1, i2 } = twoLines();
  const wedges = hi.map((h) => sector(...((h.at === 1 ? i1 : i2) as [number, number]), 28, h.a1, h.a2, `th ${h.c}`)).join("");
  return { id, title, alt, caption, subjects: M, family: "angles-parallel", concepts, requires: ["parallel", "transversal"], doesNotShow: "the other angle pairs; numerical angle sizes", evidence, svg: svg(W, H, wedges + base + txt(120, 148, rule, "ts tm") + cap("(parallel lines: same arrow marks)", 165)) };
}
export const PARALLEL: Pic[] = [
  parallelPic("alternate-angles", "Alternate angles", ["alternate angle", "alternate interior angle", "z angle"], [{ at: 1, a1: 180, a2: 240, c: "f3" }, { at: 2, a1: 0, a2: 60, c: "f3" }], "Alternate angles", "alternate angles are equal (Z shape)",
    "Two parallel lines cut by a transversal. The two alternate angles, one below the top line on the left of the transversal and one above the bottom line on the right, are shaded and equal.",
    "Alternate (interior) angles lie between the parallel lines on opposite sides of the transversal and are equal. Transversal at 60 degrees: the shaded angles are the 60-degree angles at SW of the top intersection and NE of the bottom intersection."),
  parallelPic("corresponding-angles", "Corresponding angles", ["corresponding angle", "f angle"], [{ at: 1, a1: 0, a2: 60, c: "f1" }, { at: 2, a1: 0, a2: 60, c: "f1" }], "Corresponding angles", "corresponding angles are equal (F shape)",
    "Two parallel lines cut by a transversal. Two corresponding angles, in the same position at each crossing (above the line, right of the transversal), are shaded and equal.",
    "Corresponding angles are in matching positions at the two intersections and are equal. Both 0-60 degree wedges (NE) at each intersection are shaded."),
  parallelPic("co-interior-angles", "Co-interior angles", ["co-interior angle", "co interior angle", "allied angle", "c angle"], [{ at: 1, a1: 240, a2: 360, c: "f4" }, { at: 2, a1: 0, a2: 60, c: "f4" }], "Co-interior angles", "co-interior angles add up to 180° (C shape)",
    "Two parallel lines cut by a transversal. Two co-interior angles, between the lines on the same side of the transversal, are shaded; together they make 180 degrees.",
    "Co-interior (allied) angles lie between the parallel lines on the same side of the transversal and add to 180 degrees. Drawn: 120-degree angle (SE of the top crossing) and 60-degree angle (NE of the bottom crossing)."),
];

// straight line / point / vertically opposite / triangle
const straight = (() => { const cx = 120, cy = 110; const e = pt(cx, cy, 78, 55); return ln(30, cy, 210, cy) + ln(cx, cy, e[0], e[1]) + sector(cx, cy, 30, 0, 55, "th f1") + sector(cx, cy, 30, 55, 180, "th f3") + txt(cx + 42, cy - 12, "a", "tb ta") + txt(cx - 26, cy - 32, "b", "tb") + txt(120, 150, "a + b = 180°", "tb") + cap("angles on a straight line add up to 180°", 166); })();
const around = (() => { const cx = 120, cy = 76; const dirs = [20, 130, 250]; const e = dirs.map((d) => pt(cx, cy, 64, d)); return e.map((p) => ln(cx, cy, p[0], p[1])).join("") + sector(cx, cy, 26, 20, 130, "th f1") + sector(cx, cy, 26, 130, 250, "th f3") + sector(cx, cy, 26, 250, 380, "th f4") + txt(cx + 26, cy - 22, "a", "tb") + txt(cx - 38, cy + 4, "b", "tb") + txt(cx + 16, cy + 42, "c", "tb") + txt(120, 152, "a + b + c = 360°", "tb") + cap("angles around a point add up to 360°", 167); })();
const vertOpp = (() => { const cx = 120, cy = 76; const a = 35; const p = [pt(cx, cy, 70, a), pt(cx, cy, 70, a + 180), pt(cx, cy, 70, 180 - a), pt(cx, cy, 70, 360 - a)]; return ln(p[0][0], p[0][1], p[1][0], p[1][1]) + ln(p[2][0], p[2][1], p[3][0], p[3][1]) + sector(cx, cy, 24, 180 - a, 180 + a, "th f1") + sector(cx, cy, 24, -a, a, "th f1") + sector(cx, cy, 24, a, 180 - a, "th f3") + sector(cx, cy, 24, 180 + a, 360 - a, "th f3") + txt(120, 150, "vertically opposite angles are equal", "ts") + cap("(same colour = equal)", 165); })();
const triSum = (() => {
  const A: [number, number] = [40, 130], B: [number, number] = [200, 130], C: [number, number] = [110, 34];
  const dg = (r: number) => (r * 180) / Math.PI, aA = dg(Math.atan2(96, 70)), aB = dg(Math.atan2(96, 90));
  return poly([A, B, C], "l f0") + sector(A[0], A[1], 26, 0, aA, "th f1") + sector(B[0], B[1], 26, 180 - aB, 180, "th f3") + sector(C[0], C[1], 22, 180 + aA, 360 - aB, "th f4")
    + txt(72, 122, "a", "tb") + txt(170, 122, "b", "tb") + txt(110, 62, "c", "tb") + txt(120, 156, "a + b + c = 180°", "tb") + cap("angles in a triangle add up to 180°", 168);
})();
export const ANGLE_FACTS: Pic[] = [
  { id: "angles-straight-line", title: "Angles on a straight line", alt: "A straight line with one line rising from it, making two angles a and b that together make 180 degrees.", caption: "Angles on a straight line", subjects: M, concepts: ["angles on a straight line", "angles on a line", "angle on a straight line"], family: "angle-facts", doesNotShow: "angles around a point, numerical values", evidence: "Angles on a straight line sum to 180 degrees (Oak KS3 angle facts). a = 55 degrees and b = 125 drawn to scale; the label states only the rule.", svg: svg(W, H, straight) },
  { id: "angles-around-point", title: "Angles around a point", alt: "Three lines meeting at a point forming angles a, b and c that fill a full turn of 360 degrees.", caption: "Angles around a point", subjects: M, concepts: ["angles around a point", "angles at a point", "angle around a point"], family: "angle-facts", doesNotShow: "angles on a line, numerical values", evidence: "Angles around a point sum to 360 degrees. Wedges 110+120+130 = 360 drawn to scale.", svg: svg(W, H, around) },
  { id: "vertically-opposite", title: "Vertically opposite angles", alt: "Two straight lines crossing. The angles opposite each other are the same colour because they are equal.", caption: "Vertically opposite angles", subjects: M, concepts: ["vertically opposite angle", "vertically opposite"], family: "angle-facts", doesNotShow: "numerical values", evidence: "Vertically opposite angles are equal. Two crossing lines at 35 degrees; opposite wedges (70 and 110 degrees) share a colour.", svg: svg(W, H, vertOpp) },
  { id: "triangle-angle-sum", title: "Angles in a triangle", alt: "A triangle with its three angles labelled a, b and c and the rule that they add up to 180 degrees.", caption: "Angles in a triangle", subjects: M, concepts: ["angles in a triangle", "angle sum of a triangle", "interior angles of a triangle"], family: "angle-facts", doesNotShow: "the type of triangle; numerical values", evidence: "The interior angles of any triangle add up to 180 degrees.", svg: svg(W, H, triSum) },
];
export const ALL_2D: Pic[] = [...SHAPES2D, ...CIRCLE_PARTS, ...ANGLES, ...PARALLEL, ...ANGLE_FACTS];
void rect; void arrow;
