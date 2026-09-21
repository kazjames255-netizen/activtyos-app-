// 3D shapes (Maths). Drawn in cabinet-oblique style: the receding axis goes up and to the right, so the visible faces are the front, the
// top and the RIGHT face. Edges that belong only to hidden faces are dashed (rule: an edge is hidden when every face it borders is hidden).
import type { Pic } from "./types";
import { cap, svg, poly, path, ln, ell, circ, txt, rect, dot } from "./helpers";

const W = 240, H = 170;
const M: Pic["subjects"] = ["Maths"];
const NOT3D = "any other 3D shape; no measurements or numbers";

const cube = svg(W, H,
  poly([[34, 150], [114, 150], [114, 70], [34, 70]], "l f1") + poly([[34, 70], [114, 70], [150, 38], [70, 38]], "l f3") + poly([[114, 150], [114, 70], [150, 38], [150, 118]], "l f4")
  + ln(70, 118, 34, 150, "h") + ln(70, 118, 150, 118, "h") + ln(70, 118, 70, 38, "h") + cap("6 square faces, 12 edges, 8 vertices", 165));
const cuboid = svg(W, H,
  poly([[30, 140], [130, 140], [130, 84], [30, 84]], "l f1") + poly([[30, 84], [130, 84], [170, 50], [70, 50]], "l f3") + poly([[130, 140], [130, 84], [170, 50], [170, 106]], "l f4")
  + ln(70, 106, 30, 140, "h") + ln(70, 106, 170, 106, "h") + ln(70, 106, 70, 50, "h") + cap("6 rectangular faces (opposite faces match)", 163));
const cylinder = svg(W, H,
  path("M70 45 V128 A50 14 0 0 0 170 128 V45 Z", "l f1") + path("M70 128 A50 14 0 0 1 170 128", "h") + ell(120, 45, 50, 14, "l f3") + cap("2 flat circular faces + 1 curved surface", 162));
const cone = svg(W, H,
  path("M120 18 L62 122 A58 15 0 0 0 178 122 Z", "l f1") + path("M62 122 A58 15 0 0 1 178 122", "h") + dot(120, 18, 2.8) + cap("1 flat circular face + 1 curved surface + apex", 160));
const sphere = svg(W, H,
  circ(120, 82, 66, "l f1") + path("M54 82 A66 17 0 0 0 186 82", "th") + path("M54 82 A66 17 0 0 1 186 82", "h") + path("M84 46 A50 50 0 0 1 112 30", "th2") + cap("all points on the surface are the same distance from the centre", 166));
const hemisphere = svg(W, H,
  path("M50 108 A70 70 0 0 1 190 108 A70 18 0 0 1 50 108 Z", "l f1") + path("M50 108 A70 18 0 0 1 190 108", "h") + path("M86 62 A50 50 0 0 1 118 44", "th2") + cap("half a sphere: 1 curved surface + 1 flat circular face", 152));
const prism = svg(W, H,
  poly([[34, 138], [124, 138], [79, 78]], "l f1") + poly([[124, 138], [79, 78], [125, 46], [170, 106]], "l f4") + ln(79, 78, 125, 46, "l")
  + ln(34, 138, 80, 106, "h") + ln(80, 106, 170, 106, "h") + ln(80, 106, 125, 46, "h") + cap("2 triangular ends joined by 3 rectangular faces", 160));
const pyramid = svg(W, H,
  poly([[50, 138], [140, 138], [120, 28]], "l f1") + poly([[140, 138], [190, 110], [120, 28]], "l f4") + ln(120, 28, 100, 110, "h") + ln(50, 138, 100, 110, "h") + ln(100, 110, 190, 110, "h") + cap("a square base + 4 triangular faces meeting at the apex", 160));
const tetra = svg(W, H,
  poly([[40, 132], [130, 142], [110, 28]], "l f1") + poly([[130, 142], [182, 104], [110, 28]], "l f4") + ln(40, 132, 182, 104, "h") + cap("4 triangular faces, 6 edges, 4 vertices", 162));
const netCube = (() => {
  const s = 34, x0 = 84, y0 = 12; const sq = (c: number, r: number, k = "l f1") => rect(x0 + c * s, y0 + r * s, s, s, k);
  return svg(W, H, sq(0, 0) + sq(0, 1, "l f3") + sq(0, 2) + sq(0, 3, "l f3") + sq(-1, 1, "l f4") + sq(1, 1, "l f4") + txt(196, 96, "6 squares", "ts tm")); // centred at x=196 (≈170-222): left-anchored at 200 it ran past the 240 viewBox
})();
const parts = svg(W, H,
  poly([[34, 150], [114, 150], [114, 70], [34, 70]], "l f1") + poly([[34, 70], [114, 70], [150, 38], [70, 38]], "l f3") + poly([[114, 150], [114, 70], [150, 38], [150, 118]], "l f4 ")
  + ln(70, 118, 34, 150, "h") + ln(70, 118, 150, 118, "h") + ln(70, 118, 70, 38, "h")
  + ln(150, 38, 150, 118, "a") + dot(150, 118, 4.5, "fr") + dot(114, 150, 4.5, "fr")
  + txt(196, 78, "edge", "ta tl") + ln(154, 78, 190, 78, "th") + txt(196, 128, "vertex", "tr tl") + ln(118, 148, 150, 128, "th") + ln(155, 118, 190, 126, "th")
  + txt(70, 112, "face", "tm"));

const mk = (id: string, title: string, concepts: string[], svgStr: string, alt: string, caption: string, extra: Partial<Pic>, evidence: string): Pic =>
  ({ id, title, alt, caption, subjects: M, concepts, family: "3d", doesNotShow: NOT3D, evidence, svg: svgStr, ...extra });

export const SHAPES3D: Pic[] = [
  mk("sphere", "Sphere", ["sphere"], sphere, "A sphere: a round ball shape drawn with a dashed equator, captioned: all points on the surface are the same distance from the centre.", "Sphere",
    { avoid: ["hemisphere", "spherical cap"] }, "Oak keyword 'sphere' = 3D shape where every point on its surface is equidistant from the centre. Drawn: circle outline + equator ellipse (front half solid, back half dashed)."),
  mk("hemisphere", "Hemisphere", ["hemisphere"], hemisphere, "A hemisphere: half a sphere, a dome with a flat circular face underneath.", "Hemisphere", { covers: ["sphere"], avoid: ["sphere and hemisphere"] }, "A hemisphere is half a sphere (curved surface + one flat circular face). Drawn: dome (semicircle) sitting on its base ellipse, hidden back edge of the base dashed."),
  mk("cylinder", "Cylinder", ["cylinder"], cylinder, "A cylinder: two flat circular faces joined by a curved surface.", "Cylinder", {}, "Cylinder = two parallel congruent circular faces joined by a curved surface. Drawn: two ellipses + two vertical sides, hidden bottom back edge dashed."),
  mk("cone", "Cone", ["cone"], cone, "A cone: a flat circular base and a curved surface rising to a point (the apex).", "Cone", { avoid: ["frustum", "ice cream", "traffic cone", "cone cell", "cone cells", "cones and rods"] }, "Cone = one flat circular face, curved surface, one apex. Drawn: apex, two slant edges, base ellipse (back half dashed). Never drawn with a second circular face."),
  mk("cube", "Cube", ["cube"], cube, "A cube: six equal square faces, twelve edges and eight vertices; hidden edges dashed.", "Cube", { avoid: ["cube number", "cube root", "cubed", "cubic", "cubing", "sugar cube", "ice cube", "cube the", "to the power of 3", "cube function", "cube sequence", "number", "factor", "multiple", "power", "root", "index", "indices", "sequence", "expression", "algebra", "expand", "cubes and squares", "squares and cubes"] }, "Cube = 6 congruent square faces, 12 edges, 8 vertices. Drawn: front square, oblique back square of equal size; 3 hidden edges from the back-bottom-left vertex dashed."),
  mk("cuboid", "Cuboid", ["cuboid", "rectangular prism"], cuboid, "A cuboid: six rectangular faces, opposite faces equal; hidden edges dashed.", "Cuboid", {}, "Cuboid = 6 rectangular faces, 12 edges, 8 vertices. Drawn: front rectangle 100x56, oblique back rectangle of equal size; 3 hidden edges dashed."),
  mk("triangular-prism", "Triangular prism", ["triangular prism"], prism, "A triangular prism: two triangular ends joined by three rectangular faces.", "Triangular prism", {}, "Triangular prism = 2 parallel congruent triangular faces + 3 rectangular faces. Hidden edges (only bordering hidden faces) dashed."),
  mk("square-based-pyramid", "Square-based pyramid", ["square-based pyramid", "square based pyramid", "pyramid"], pyramid, "A square-based pyramid: a square base and four triangular faces that meet at a point (the apex).", "Square-based pyramid", { avoid: ["triangular-based pyramid", "triangular based pyramid", "tetrahedron", "hexagonal", "pentagonal", "egypt", "egyptian", "pyramid chart", "population pyramid", "pyramid of numbers", "pyramid of biomass", "energy pyramid", "trophic", "oblique", "frustum", "not necessarily"] }, "Square-based pyramid = 1 square face + 4 triangular faces meeting at the apex (5 faces, 8 edges, 5 vertices). Only shown for the plain word 'pyramid' when no other base is named."),
  mk("tetrahedron", "Tetrahedron (triangular-based pyramid)", ["tetrahedron", "triangular-based pyramid", "triangular based pyramid"], tetra, "A tetrahedron (a triangular-based pyramid): four triangular faces, six edges, four vertices.", "Tetrahedron", {}, "Tetrahedron = 4 triangular faces, 6 edges, 4 vertices. Convex quadrilateral outline, the diagonal through the far vertex dashed."),
  mk("cube-net", "Net of a cube", ["net of a cube", "cube net"], netCube, "A net of a cube: six squares joined in a cross shape that fold up to make a cube.", "One net of a cube", { avoid: ["net of a cuboid", "net of a prism", "net of a pyramid", "nets of prisms"] }, "A cube has 11 different nets; this cross (1-4-1) is one of them. Six congruent squares."),
  mk("faces-edges-vertices", "Face, edge, vertex on a cube", ["face", "edge", "vertex", "vertice"], parts, "A cube with one edge labelled, one vertex labelled and a face labelled.", "Face, edge and vertex", { family: "3d-parts", requires: ["3d", "3-d", "solid", "cube", "cuboid", "prism", "pyramid", "polyhedron", "polyhedra"], avoid: ["polygon", "2d", "graph theory", "network", "circle", "triangle", "quadrilateral", "square", "rectangle", "sphere", "cylinder", "cone"] }, "Face = a flat surface, edge = where two faces meet, vertex = where edges meet (corner). Cube drawn with one of each highlighted. Only used when the slide is about 3D solids with flat faces (no sphere/cone/cylinder, which have curved surfaces)."),
];
