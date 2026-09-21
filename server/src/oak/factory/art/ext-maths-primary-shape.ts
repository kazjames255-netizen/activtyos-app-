// Maths KS1-KS2 extension pictures, part 3: shape, position/turns, fractions, data and equations (agent X1).
import type { Pic } from "./types";
import { SHAPES3D } from "./shapes3d";
import { mk, ln, rect, txt, circ, dot, poly, path, cap, pt, arrow, n, line, head, counters } from "./ext-maths-primary-kit";
import { tag, sector, arc } from "./helpers";

const regular = (k: number, cx: number, cy: number, R: number, start = 90): [number, number][] => Array.from({ length: k }, (_, i) => pt(cx, cy, R, start + (360 / k) * i));

// ── shapes ─────────────────────────────────────────────────────────────────────────
const triangle = (() => {
  const V: [number, number][] = [[56, 128], [186, 136], [104, 30]];
  let s = poly(V, "l f1");
  V.forEach(([x, y]) => (s += dot(x, y, 3.6, "fr")));
  s += tag("side", 34, 66, 80, 79, "r") + tag("vertex (corner)", 130, 30, 108, 32, "l");
  return s + cap("a triangle has 3 straight sides and 3 vertices", 162, 44);
})();
const shapes2d = (() => {
  const P = (x: number, y: number) => ({ x, y });
  const cells = [P(40, 32), P(120, 32), P(200, 32), P(40, 108), P(120, 108), P(200, 108)];
  const names = ["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"];
  let s = circ(cells[0].x, cells[0].y, 26, "l f1");
  s += poly([[cells[1].x - 30, cells[1].y + 24], [cells[1].x + 30, cells[1].y + 24], [cells[1].x, cells[1].y - 26]], "l f3");
  s += rect(cells[2].x - 24, cells[2].y - 24, 48, 48, "l f2");
  s += rect(cells[3].x - 32, cells[3].y - 19, 64, 38, "l f4");
  s += poly(regular(5, cells[4].x, cells[4].y, 28), "l f5");
  s += poly(regular(6, cells[5].x, cells[5].y, 28, 0), "l f1");
  cells.forEach((c, i) => (s += txt(c.x, c.y + (i < 3 ? 46 : 46), names[i], "tx")));
  return s;
})();
const strip = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<text[^>]*>.*?<\/text>/g, "").replace(/class="(l|h)( [^"]*)?"/g, (m) => `${m} style="stroke-width:3.4"`);
const shapes3d = (() => {
  // 4 + 3 grid: the seven solids Oak KS1-KS2 names (the prism and the pyramid included, so a "prisms and pyramids" slide sees both)
  const ids = ["cube", "cuboid", "cylinder", "sphere", "cone", "square-based-pyramid", "triangular-prism"], names = ["cube", "cuboid", "cylinder", "sphere", "cone", "pyramid", "prism"];
  let s = "";
  ids.forEach((id, i) => {
    const p = SHAPES3D.find((x) => x.id === id);
    if (!p) throw new Error(`missing 3D picture ${id}`);
    const r = i < 4 ? 0 : 1, c = i < 4 ? i : i - 4, cols = r ? 3 : 4, cw = 58, x = 120 - (cols * cw) / 2 + c * cw + 1, y = 8 + r * 72;
    s += `<svg x="${x}" y="${y}" width="56" height="35" viewBox="0 0 240 150">${strip(p.svg)}</svg>` + txt(x + 28, y + 48, names[i], "tx");
  });
  return s + txt(120, 160, "solid shapes: 3D shapes", "tx tm");
})();
const sidesVertices = (() => {
  const V: [number, number][] = [[50, 116], [66, 50], [126, 26], [190, 66], [174, 122]];
  let s = poly(V, "l f1") + ln(...V[0], ...V[1], "a");
  V.forEach(([x, y]) => (s += dot(x, y, 4, "fr")));
  s += tag("side", 22, 40, 58, 83, "r") + tag("vertex (corner)", 156, 24, 128, 28, "l");
  return s + txt(120, 146, "sides are straight lines;", "tx tm") + txt(120, 158, "vertices are where two sides meet", "tx tm");
})();
const turns = (() => {
  const cxs = [34, 94, 154, 212], degs = [90, 180, 270, 350], l1 = ["quarter", "half", "three-quarter", "whole"];
  const one = (cx: number, cy: number, deg: number, cw: boolean) => {
    const r = 15, ra = 19;
    let s = circ(cx, cy, r, "l f0") + ln(cx, cy, cx, cy - r, "th2");
    const endA = cw ? 90 - deg : 90 + deg, e = pt(cx, cy, r, endA);
    s += ln(cx, cy, e[0], e[1], deg === 350 ? "th2" : "ar");
    s += cw ? arc(cx, cy, ra, 90 - deg, 90, "a") : arc(cx, cy, ra, 90, 90 + deg, "a");
    const tip = pt(cx, cy, ra, endA), a = (endA * Math.PI) / 180;
    const dir: [number, number] = cw ? [Math.sin(a), Math.cos(a)] : [-Math.sin(a), -Math.cos(a)];
    s += head(tip, [tip[0] - dir[0] * 10, tip[1] - dir[1] * 10], "hda", 6.5);
    return s + dot(cx, cy, 2);
  };
  let s = txt(120, 9, "clockwise", "ts ta") + txt(120, 92, "anticlockwise", "ts tr");
  cxs.forEach((cx, i) => {
    s += one(cx, 36, degs[i], true) + one(cx, 122, degs[i], false);
    [68, 156].forEach((y) => (s += txt(cx, y, l1[i], "tx") + txt(cx, y + 10, "turn", "tx")));
  });
  return s;
})();

// ── fractions ───────────────────────────────────────────────────────────────────────
const equalUnequal = (() => {
  let s = txt(60, 14, "equal parts", "ts ta") + txt(180, 14, "unequal parts", "ts tr") + ln(120, 20, 120, 132, "th");
  s += rect(10, 26, 100, 34, "l f1") + [35, 60, 85].map((x) => ln(x, 26, x, 60, "l")).join("");
  s += circ(60, 100, 28, "l f2") + ln(60, 72, 60, 128, "l");
  s += rect(130, 26, 100, 34, "l f1") + [145, 195, 205].map((x) => ln(x, 26, x, 60, "l")).join("");
  const dy = Math.sqrt(28 * 28 - 15 * 15);
  s += circ(180, 100, 28, "l f4") + ln(165, 100 - dy, 165, 100 + dy, "l");
  return s + txt(60, 144, "all the same size", "tx tm") + txt(180, 144, "different sizes", "tx tm");
})();
const unitFrac = (k: number, name: string) => {
  const x0 = 20, w = 200, r = 32, cx = 120, cy = 108;
  let s = "";
  for (let i = 0; i < k; i++) s += rect(x0 + (w / k) * i, 22, w / k, 34, i === 0 ? "l f3" : "l f0");
  s += sector(cx, cy, r, 90 - 360 / k, 90, "l f3");
  s += circ(cx, cy, r, "l");
  for (let i = 0; i < k; i++) { const p = pt(cx, cy, r, 90 - (360 / k) * i); s += ln(cx, cy, p[0], p[1], "l"); }
  return s + txt(120, 16, `one ${name}`, "ts") + txt(120, 152, `a whole cut into ${k} equal parts:`, "tx tm") + txt(120, 164, `each part is one ${name}`, "tx tm");
};
const fractionOfAmount = (() => {
  const x0 = 30, w = 45;
  let s = rect(x0, 30, w * 4, 22, "l f1") + path(`M${x0} 24 v-6 H${x0 + 4 * w} v6`, "th2") + txt(120, 12, "the whole amount", "ts");
  for (let i = 0; i < 4; i++) s += rect(x0 + i * w, 64, w, 26, i < 3 ? "l f3" : "l f0");
  return s + txt(120, 110, "denominator: the equal parts", "tx tm") + txt(120, 122, "the amount is divided into", "tx tm") + txt(120, 138, "numerator: how many of those parts we take", "tx tm") + txt(120, 156, "divide by the denominator, then multiply", "tx") + txt(120, 167, "by the numerator", "tx");
})();
const fractionLine = (() => {
  const x0 = 30, x1 = 210;
  let s = line(x0, x1, 84, 4, (i) => ["0", "1/4", "1/2", "3/4", "1"][i], 8);
  s += ln(x0, 84, x1, 84, "ao");
  return s + txt(120, 40, "fractions sit between whole numbers", "ts") + cap("a fraction number line from 0 to 1 in quarters", 150);
})();
const fractionDecimal = (() => {
  const rows: [string, string, number][] = [["1/2", "0.5", 50], ["1/4", "0.25", 25], ["3/4", "0.75", 75], ["1/5", "0.2", 20], ["1/10", "0.1", 10], ["1/100", "0.01", 1]];
  let s = "";
  rows.forEach(([f, d, p], i) => { const y = 6 + i * 24; s += txt(50, y + 15, f, "ts te") + txt(62, y + 15, "=", "ts") + txt(72, y + 15, d, "ts tl") + rect(128, y + 2, 100, 16, "l f0", 3) + rect(128, y + 2, p, 16, "l f3", 3); });
  return s + txt(120, 166, "a fraction and its decimal are the same amount", "tx tm");
})();
const percent = (() => {
  let s = "";
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) s += rect(14 + c * 8, 14 + r * 8, 8, 8, `th ${r < 5 && c < 5 ? "f3" : "f0"}`);
  s += rect(14, 14, 80, 80, "l") + txt(54, 110, "25 out of 100", "tx") + txt(54, 122, "= 25%", "tx");
  [["50%", "1/2"], ["25%", "1/4"], ["75%", "3/4"], ["10%", "1/10"], ["1%", "1/100"], ["100%", "1 whole"]].forEach(([a, b], i) => (s += txt(108, 26 + i * 20, `${a} = ${b}`, "ts tl")));
  return s + txt(120, 156, "per cent means out of 100", "tx tm");
})();
const mean = (() => {
  const b = 9, bh = 8, tw = 14, gap = 6;
  const tower = (x: number, k: number, cls = "l f1") => Array.from({ length: k }, (_, i) => rect(x, 106 - (i + 1) * bh, tw, bh, cls)).join("");
  let s = "";
  [2, 5, 3, 6].forEach((k, i) => (s += tower(14 + i * (tw + gap), k)));
  [4, 4, 4, 4].forEach((k, i) => (s += tower(140 + i * (tw + gap), k, "l f3")));
  s += arrow(104, 80, 130, 80, "a", 7);
  void b;
  return s + txt(54, 124, "different amounts", "tx tm") + txt(178, 124, "shared out equally", "tx tm") + txt(120, 146, "the mean is the amount each would have", "tx") + txt(120, 158, "if the total were shared out equally", "tx");
})();
const equation = (() => {
  let s = rect(76, 30, 50, 22, "l f1") + rect(126, 30, 74, 22, "l f3") + rect(76, 78, 124, 22, "l f2");
  s += txt(138, 70, "=", "tb") + txt(68, 45, "left side", "ts te") + txt(68, 93, "right side", "ts te");
  return s + txt(120, 16, "an equation: both sides have the same value", "ts") + txt(120, 124, "the equals sign (=) means", "tx tm") + txt(120, 136, "“is the same as”", "tx tm") + txt(120, 156, "both sides balance", "tx tm");
})();
const zero = (() => {
  let s = `<circle cx="70" cy="70" r="36" class="h"/>` + `<text x="170" y="86" class="t tb" style="font-size:52px">0</text>`;
  return s + txt(70, 122, "nothing there", "ts") + txt(170, 122, "zero", "ts") + txt(120, 152, "zero means none: there are no objects to count", "tx tm");
})();
const ordinal = (() => {
  const w = ["first", "second", "third", "fourth", "fifth"], short = ["1st", "2nd", "3rd", "4th", "5th"];
  let s = arrow(14, 96, 226, 96, "th", 6);
  short.forEach((a, i) => { const x = 30 + i * 45; s += circ(x, 60, 17, `l ${["f3", "f1", "f1", "f1", "f1"][i]}`) + txt(x, 65, a, "ts") + txt(x, 116, w[i], "tx"); });
  return s + txt(120, 140, "ordinal numbers tell us the position", "tx tm") + txt(120, 154, "in a line or an order", "tx tm");
})();

const angleBasic = (() => {
  const O: [number, number] = [56, 122], a = pt(O[0], O[1], 150, 0), b = pt(O[0], O[1], 120, 50);
  let s = ln(O[0], O[1], a[0], a[1], "l") + ln(O[0], O[1], b[0], b[1], "l") + arc(O[0], O[1], 34, 0, 50, "a") + dot(O[0], O[1], 3.6, "fr");
  s += txt(170, 118, "arm", "ts tl") + txt(150, 60, "arm", "ts tl") + txt(O[0] + 44, O[1] - 8, "angle", "ts ta tl") + tag("vertex", 36, 148, O[0], O[1] + 2, "l");
  return s + txt(120, 20, "an angle is the amount of turn between two lines", "tx") + txt(120, 34, "that meet at a point", "tx");
})();

const S = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, extra: Partial<Pic> = {}) => mk({ id, title, concepts, body, alt, caption, evidence, extra });
export const EXT_SHAPE: Pic[] = [
  S("triangle", "Triangle", ["triangle"], triangle, "A triangle with three straight sides and three vertices (corners) marked and labelled.", "Triangle",
    "Triangle = a polygon with 3 straight sides and 3 vertices (Oak KS1 'triangle'). Scalene example so it does not suggest special sides or angles; the specific triangles (equilateral, isosceles, scalene, right-angled) have their own pictures.", { family: "2d", avoid: ["hypotenuse", "pythagoras", "trigonometry", "triangular", "triangle number", "congruent", "similar", "triangle inequality"], doesNotShow: "equal sides or equal angles; any special triangle; measurements" }),
  S("shapes-2d", "2D shapes", ["2d shape", "2d shapes", "2 d shape", "2 d shapes", "two dimensional shape", "two dimensional shapes"], shapes2d, "Six flat shapes named underneath: circle, triangle, square, rectangle, pentagon and hexagon.", "2D shapes",
    "2D (flat) shapes named in Oak KS1: circle, triangle, square, rectangle, pentagon, hexagon. Regular pentagon/hexagon computed on a circumcircle; square 48 x 48, rectangle 64 x 38.", { family: "2d", covers: ["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"], doesNotShow: "3D shapes; any other 2D shape; measurements" }),
  S("shapes-3d", "3D shapes", ["3d shape", "3d shapes", "3 d shape", "3 d shapes", "solid shape", "solid shapes", "three dimensional shape", "three dimensional shapes"], shapes3d, "Seven solid shapes named underneath: cube, cuboid, cylinder, sphere, cone, pyramid and prism.", "3D shapes",
    "3D (solid) shapes named in Oak KS1-KS2: cube, cuboid, cylinder, sphere, cone, (square-based) pyramid, (triangular) prism. Each is the verified single-shape drawing reduced in size.", { family: "3d", covers: ["cube", "cuboid", "cylinder", "cone", "sphere", "pyramid", "triangular prism"], avoid: ["hemisphere", "tetrahedron", "triangular based pyramid", "triangular-based pyramid"], doesNotShow: "2D shapes; hemispheres, tetrahedra and other solids; faces, edges and vertices" }),
  S("sides-and-vertices", "Sides and vertices of a 2D shape", ["sides and vertices", "sides and corners", "vertices", "vertex vertices", "corners", "corner"], sidesVertices, "A five-sided shape with one side drawn in blue and labelled side, and its corners marked with red dots, one labelled vertex (corner).", "Sides and vertices",
    "Oak KS1 2D shapes: a side is a straight line of the shape, a vertex (plural vertices) is a corner where two sides meet. Irregular pentagon so it does not suggest equal sides.", { requires: ["shape", "shapes", "polygon", "triangle", "square", "rectangle", "pentagon", "hexagon", "quadrilateral", "2d"], avoid: ["3d", "3 d", "solid", "cube", "cuboid", "pyramid", "prism", "cone", "cylinder", "sphere", "face", "edge", "parabola", "graph", "axis", "coordinate"], doesNotShow: "3D shapes, faces or edges; angles" }),
  S("turns", "Quarter, half, three-quarter and whole turns", ["quarter turn", "half turn", "three quarter turn", "whole turn", "full turn"], turns, "Two rows of circles: clockwise turns and anticlockwise turns of a quarter, a half, three-quarters and a whole turn, each shown by a red pointer that has turned from the vertical start and an arrow.", "Turns",
    "A quarter turn = 90 degrees, half = 180, three-quarter = 270, whole = 360 (Oak KS1-KS2 turns); clockwise = the way the hands of a clock move. Pointer end angles and arc lengths computed (whole turn drawn as 350 degrees so the arrow head is visible).", { avoid: ["degrees", "angle of", "rotation of", "bearing"], doesNotShow: "the number of degrees; reflex angles" }),
  S("equal-and-unequal-parts", "Equal and unequal parts", ["equal parts", "unequal parts", "equal and unequal parts", "equal part", "unequal part", "equal shares"], equalUnequal, "Left: a rectangle cut into four equal strips and a circle cut into two equal halves, labelled equal parts. Right: a rectangle cut into four strips of different widths and a circle cut off-centre, labelled unequal parts.", "Equal and unequal parts",
    "Equal parts are exactly the same size, unequal parts are not (Oak KS1 fractions). Left rectangle cut at 25/50/75%, right at 15/65/75% of the width; left circle cut through the centre, right circle by a chord 15 units from it (exact).", { doesNotShow: "which fraction each part is" }),
  S("fifths", "Fifths", ["fifth", "fifths"], unitFrac(5, "fifth"), "A bar and a circle each cut into five equal parts with one part shaded: one fifth.", "Fifths",
    "A fifth is one of five equal parts of a whole (Oak KS1-KS2 fractions). Bar cut into 5 strips of 40 units, circle into five 72-degree sectors (computed).", { requires: ["fraction", "fractions", "equal part", "equal parts", "whole", "wholes"], avoid: ["fifth in", "fifth of the", "the fifth"] , doesNotShow: "any other unit fraction" }),
  S("sixths", "Sixths", ["sixth", "sixths"], unitFrac(6, "sixth"), "A bar and a circle each cut into six equal parts with one part shaded: one sixth.", "Sixths",
    "A sixth is one of six equal parts of a whole. Bar cut into six strips, circle into six 60-degree sectors (computed).", { requires: ["fraction", "fractions", "equal part", "equal parts", "whole", "wholes"], avoid: ["sixth form", "the sixth"], doesNotShow: "any other unit fraction" }),
  S("eighths", "Eighths", ["eighth", "eighths"], unitFrac(8, "eighth"), "A bar and a circle each cut into eight equal parts with one part shaded: one eighth.", "Eighths",
    "An eighth is one of eight equal parts of a whole. Bar cut into eight strips of 25 units, circle into eight 45-degree sectors (computed).", { requires: ["fraction", "fractions", "equal part", "equal parts", "whole", "wholes"], avoid: ["the eighth"], doesNotShow: "any other unit fraction" }),
  S("fraction-of-an-amount", "Fraction of an amount", ["fraction of an amount", "fractions of amounts", "fraction of a quantity", "fractions of a set", "fraction of a set", "fraction of a number"], fractionOfAmount, "A bar for the whole amount cut into four equal parts with three shaded, and the rule: divide by the denominator, multiply by the numerator.", "Fraction of an amount",
    "To find a fraction of an amount, divide by the denominator to find one part, then multiply by the numerator (Oak KS2 'fraction of an amount'). Shows 3 of 4 equal parts, so refused on slides with digits.", { numeric: true, avoid: ["percentage of", "decimal of"] }),
  S("fractions-on-a-number-line", "Fractions on a number line", ["fractions on a number line", "fraction on a number line", "fraction number line", "number line for fractions"], fractionLine, "A number line from 0 to 1 with ticks and labels at 0, 1/4, 1/2, 3/4 and 1.", "Fractions on a number line",
    "Fractions are numbers between 0 and 1 (Oak KS1-KS2 fractions on a number line). Quarters at exactly 45-unit spacing: 0, 1/4, 1/2, 3/4, 1.", { avoid: ["third", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "twelfth", "hundredth", "improper", "mixed number", "greater than 1", "greater than one", "beyond 1", "beyond one"], doesNotShow: "other denominators; fractions greater than 1" }),
  S("fraction-decimal-equivalents", "Fraction and decimal equivalents", ["decimal equivalents", "decimal equivalent", "fraction and decimal", "fractions and decimals", "decimal fractions", "decimal fraction"], fractionDecimal, "Six fractions with their decimal equivalents and matching bars: 1/2 is 0.5, 1/4 is 0.25, 3/4 is 0.75, 1/5 is 0.2, 1/10 is 0.1 and 1/100 is 0.01.", "Fractions and decimals",
    "Standard equivalents: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, 1/5 = 0.2, 1/10 = 0.1, 1/100 = 0.01 (Oak KS2 'decimal equivalents'). Bar fill lengths 50, 25, 75, 20, 10, 1 of 100 (exact).", { avoid: ["negative", "positive", "position", "number line"], doesNotShow: "other fractions or recurring decimals" }),
  S("percentages", "Percentages", ["percentage", "percent", "per cent", "percentages"], percent, "A 10 by 10 grid with a quarter (25 of 100 squares) shaded, and common percentages with their fractions: 50% is 1/2, 25% is 1/4, 75% is 3/4, 10% is 1/10, 1% is 1/100 and 100% is 1 whole.", "Percentages",
    "Per cent means out of 100 (Oak KS2 'percentage'). Grid of 100 squares with a 5 x 5 corner = 25 squares = 25%; 50% = 1/2, 25% = 1/4, 75% = 3/4, 10% = 1/10, 1% = 1/100, 100% = 1 whole (fixed facts).", { avoid: ["percentage change", "percentage increase", "percentage decrease", "reverse percentage", "percentage error"], doesNotShow: "how to calculate a percentage of an amount" }),
  S("mean-average", "The mean", ["mean average", "arithmetic mean", "the mean"], mean, "Four towers of different heights on the left, and the same total of blocks shared out into four towers of equal height on the right: the mean is the height of each equal tower.", "The mean",
    "The mean = the total shared out equally between the values (Oak KS2 'mean average'). Towers of 2, 5, 3, 6 blocks (16) become four towers of 4: refused on slides with digits.", { numeric: true, requires: ["average", "data", "set", "values", "total", "shared", "equal"], avoid: ["median", "mode", "range", "mean that", "does not mean"] }),
  S("equation", "Equation", ["equation", "equations", "equals sign", "equal sign", "number sentence", "number sentences"], equation, "A bar for the left side made of two parts and a single bar for the right side of the same length, joined by an equals sign: both sides have the same value.", "An equation",
    "An equation says two things are equal: the two sides have the same value, joined by = (Oak KS1-KS2 'equation', 'equal sign'). Two bars of identical length 140.", { avoid: ["quadratic", "simultaneous", "linear", "inequality", "chemical"], doesNotShow: "any values or how to solve" }),
  S("zero", "Zero", ["zero"], zero, "An empty dashed circle labelled nothing there beside the numeral 0 labelled zero: zero means none.", "Zero",
    "Zero means none / nothing (Oak KS1 'zero'). Empty ring beside the numeral 0.", { avoid: ["zero point", "zero pair", "placeholder", "zero property", "zero remainder", "place value", "digit", "ones", "tens", "multipl", "divid", "divis", "factor", "product", "quotient", "=mean", "mean average", "less than zero", "greater than zero", "negative", "below zero", "temperature", "times"], doesNotShow: "zero as a placeholder in a number; negative numbers" }),
  S("ordinal-numbers", "Ordinal numbers", ["ordinal number", "ordinal numbers", "ordinal"], ordinal, "A row of five circles labelled 1st, 2nd, 3rd, 4th and 5th with the words first, second, third, fourth and fifth underneath.", "Ordinal numbers",
    "Ordinal numbers give position: 1st first, 2nd second, 3rd third, 4th fourth, 5th fifth (Oak KS1 'ordinal numbers'). Fixed facts.", { doesNotShow: "ordinals beyond fifth" }),
  S("angle", "Angle", ["angle", "angles"], angleBasic, "Two lines, the arms, meeting at a point, the vertex, with a curved arrow between them marking the angle.", "An angle",
    "Oak KS1-KS2 'angle': the amount of turn between two lines that meet at a point (the vertex). Generic angle with no size given (the specific types have their own pictures).", { avoid: ["acute", "obtuse", "reflex", "right angle", "right-angle", "triangle", "quadrilateral", "straight line", "number line", "parallel", "protractor", "straight", "full turn", "around a point", "vertically opposite", "alternate", "corresponding", "bearing", "degree"], doesNotShow: "any size of angle, angle facts or angle types" }),
];
void counters;
