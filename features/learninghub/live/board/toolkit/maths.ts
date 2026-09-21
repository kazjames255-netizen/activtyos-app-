import { PASTEL, list, num, type ToolItem } from "./kit";

/** The dimensions of each net: every joined edge has the same length on both faces it joins (checked in toolkit.selftest.ts). */
export const NET = { u: 90, cuboid: { L: 126, D: 72, H: 90 }, prism: { s: 108, len: 144 }, pyramid: { s: 126, h: 117 } } as const;

/** Faces of a net as polygons (each a list of corner points) — the shape the selftest checks for foldability. */
export function netFaces(kind: string): [number, number][][] {
  const { u } = NET;
  const R = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (kind === "Cube" || kind === "Cuboid") {
    // a cross: four faces down the middle (top lid · front · bottom · back) and the two ends either side of the FRONT face
    const { L, D, H } = kind === "Cube" ? { L: u, D: u, H: u } : NET.cuboid;
    return [R(0, 0, L, D), R(0, D, L, H), R(0, D + H, L, D), R(0, 2 * D + H, L, H), R(-D, D, D, H), R(L, D, D, H)];
  }
  if (kind === "Triangular prism") {
    // three rectangles side by side (each side × length) with an equilateral triangle on the top of the first and under the last
    const { s, len } = NET.prism, ht = s * 0.8660254;
    return [R(0, 0, s, len), R(s, 0, s, len), R(2 * s, 0, s, len), [[0, 0], [s, 0], [s / 2, -ht]], [[2 * s, len], [3 * s, len], [2.5 * s, len + ht]]];
  }
  // square-based pyramid: the square, and an isosceles triangle on each side pointing away
  const { s, h } = NET.pyramid;
  return [R(0, 0, s, s), [[0, 0], [s, 0], [s / 2, -h]], [[0, s], [s, s], [s / 2, s + h]], [[0, 0], [0, s], [-h, s / 2]], [[s, 0], [s, s], [s + h, s / 2]]];
}
function netOf(b: import("./kit").B, ink: string, kind: string) {
  for (const f of netFaces(kind)) b.outline(f, { c: ink, w: 3.5 });
}

export const MATHS: ToolItem[] = [
  // Frames (page backgrounds)
  { id: "m-bg-squared", pack: "maths", label: "Squared page", sub: "1 cm squares, as the page background", tags: "frame grid", bg: "squared" },
  { id: "m-bg-numberline", pack: "maths", label: "Number line page", sub: "−10 to 10, as the page background", tags: "frame", bg: "numberline" },
  { id: "m-bg-graph", pack: "maths", label: "Graph axes page", sub: "x and y axes −10 to 10, as the page background", tags: "frame axes coordinates", bg: "graph" },
  { id: "m-numberline", pack: "maths", label: "Number line", sub: "any range, any step", make: (b) => { b.stamp("numberline", -380, -48, 760, 96, { min: 0, max: 10, step: 1 }); } },
  { id: "m-fractions", pack: "maths", label: "Fraction bar", sub: "tap parts to shade", make: (b) => { b.stamp("fractions", -320, -35, 640, 70, { parts: 4, mask: 0 }); } },
  { id: "m-fracwall", pack: "maths", label: "Fraction wall", levels: ["early", "standard"], make: (b, c) => { [1, 2, 3, 4, 5, 6, 8, 10, 12].forEach((p, i) => b.stamp("fractions", -320, i * 62, 640, 54, { parts: p, mask: 0 })); void c; } },
  { id: "m-coord", pack: "maths", label: "Coordinate grid", make: (b) => { b.stamp("coordgrid", -220, -220, 440, 440, { n: 10 }); } },
  { id: "m-times", pack: "maths", label: "Times-table grid", make: (b) => { b.stamp("timestable", -220, -220, 440, 440, { n: 10 }); } },
  { id: "m-clock", pack: "maths", label: "Clock face", levels: ["early", "standard"], make: (b) => { b.stamp("clock", -120, -120, 240, 240, { hh: 3, mm: 0 }); } },
  { id: "m-ruler", pack: "maths", label: "Ruler", make: (b) => { b.stamp("ruler", -320, -32, 640, 64, {}, { rot: 0 }); } },
  { id: "m-protractor", pack: "maths", label: "Protractor", make: (b) => { b.stamp("protractor", -190, -100, 380, 200, { pv: 1 }, { rot: 0 }); } },
  { id: "m-plot", pack: "maths", label: "Graph plotter", sub: "type y = mx + c, x², sin(x)…", levels: ["standard", "advanced"], make: (b) => { b.stamp("plot", -230, -230, 460, 460, { expr: "x^2 - 2", expr2: "", range: 10 }); } },
  { id: "m-hundred", pack: "maths", label: "100 square", levels: ["early", "standard"], make: (b, c) => { for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) b.cell(q * 54, r * 54, 54, 54, { w: 2, c: "#7d8aa3", text: String(r * 10 + q + 1), size: 20, tc: c.ink }); } },
  { id: "m-tenframe", pack: "maths", label: "Ten frame", levels: ["early"], make: (b, c) => { for (let q = 0; q < 5; q++) for (let r = 0; r < 2; r++) b.cell(q * 90, r * 90, 90, 90, { w: 3.5, c: c.ink, size: 40 }); } },
  { id: "m-placevalue", pack: "maths", label: "Place-value chart", levels: ["early", "standard"], params: [{ k: "cols", label: "Up to", type: "select", def: "Thousands", options: ["Hundreds", "Thousands", "Millions"] }], make: (b, c, v) => { const heads = { Hundreds: ["H", "T", "U"], Thousands: ["Th", "H", "T", "U"], Millions: ["M", "HTh", "TTh", "Th", "H", "T", "U"] }[String(v.cols) as "Hundreds"] ?? ["Th", "H", "T", "U"]; b.table(0, 0, heads.map(() => 130), [60, 130], { head: heads, headFill: "#eaf0fc", size: 28 }); } },
  { id: "m-bar", pack: "maths", label: "Bar model", levels: ["early", "standard"], params: [{ k: "parts", label: "Parts", type: "number", def: 3 }], make: (b, c, v) => { const n = Math.max(1, Math.min(10, num(v.parts, 3))); for (let i = 0; i < n; i++) b.cell((640 * i) / n, 0, 640 / n, 70, { c: c.brand, w: 3.5, fill: "#eaf0fc", size: 26 }); b.line(0, -18, 640, -18, { c: c.ink, w: 3 }); b.line(0, -28, 0, -8, { c: c.ink, w: 3 }); b.line(640, -28, 640, -8, { c: c.ink, w: 3 }); b.cell(220, -74, 200, 40, { text: "total", size: 22, bold: true, ns: true, w: 0.01 }); } },
  { id: "m-arrays", pack: "maths", label: "Array (dots)", levels: ["early"], params: [{ k: "r", label: "Rows", type: "number", def: 3 }, { k: "c", label: "Columns", type: "number", def: 4 }], make: (b, c, v) => { for (let r = 0; r < Math.min(10, num(v.r, 3)); r++) for (let q = 0; q < Math.min(12, num(v.c, 4)); q++) b.ellipse(q * 64, r * 64, 22, 22, { c: c.brand, w: 3, fill: c.brand }); } },
  { id: "m-trig", pack: "maths", label: "Right-angled triangle (SOH CAH TOA)", levels: ["standard", "advanced"], make: (b, c) => { b.polygon([[-200, 130], [200, 130], [200, -130]], { c: c.ink, w: 4 }); b.rect(170, 100, 30, 30, { w: 3 }); b.tc(0, 165, "adjacent", { size: 22, bold: true, c: c.brand }); b.tc(250, 0, "opposite", { size: 22, bold: true, c: c.danger }); b.tc(-40, -30, "hypotenuse", { size: 22, bold: true, c: "#15b364" }); b.tc(-150, 112, "θ", { size: 30, bold: true }); b.tc(0, 235, "sin θ = O/H   cos θ = A/H   tan θ = O/A", { size: 22, bold: true }); } },
  { id: "m-circle", pack: "maths", label: "Circle parts", levels: ["standard", "advanced"], make: (b, c) => { b.ellipse(0, 0, 160, 160, { c: c.ink, w: 4 }); b.line(-160, 0, 160, 0, { c: c.brand, w: 3 }); b.line(0, 0, 113, -113, { c: c.danger, w: 3 }); b.tc(0, 20, "diameter", { size: 20, c: c.brand, bold: true }); b.tc(74, -46, "radius", { size: 20, c: c.danger, bold: true }); b.tc(0, 195, "circumference = the distance round", { size: 20 }); b.tc(-190, -150, "chord ↗", { size: 18 }); } },
  { id: "m-nets", pack: "maths", label: "3-D nets", levels: ["early", "standard", "advanced"], params: [{ k: "shape", label: "Shape", type: "select", def: "Cube", options: ["Cube", "Cuboid", "Triangular prism", "Square-based pyramid"] }],
    make: (b, c, v) => { const s = String(v.shape); netOf(b, c.ink, s); } },
  { id: "m-stats-bar", pack: "maths", label: "Bar chart frame", levels: ["early", "standard", "advanced"], params: [{ k: "cats", label: "Categories", type: "list", def: "A, B, C, D, E" }], make: (b, c, v) => { const cats = list(v.cats, ["A"]).slice(0, 10), w = 70; b.arrow(0, 330, 0, -20, { w: 3.5 }); b.arrow(0, 330, cats.length * w + 40, 330, { w: 3.5 }); for (let i = 0; i <= 10; i++) { b.line(-6, 330 - i * 31, 6, 330 - i * 31, { w: 2 }); b.text(-40, 320 - i * 31, String(i * 2), { size: 15 }); } cats.forEach((t, i) => b.tc(20 + i * w + w / 2, 352, t, { size: 18, bold: true })); b.tc(-60, -40, "Frequency", { size: 18, bold: true }); } },
  { id: "m-scatter", pack: "maths", label: "Scatter graph axes", levels: ["standard", "advanced"], make: (b) => { b.arrow(0, 360, 0, -20, { w: 3.5 }); b.arrow(0, 360, 460, 360, { w: 3.5 }); for (let i = 1; i <= 10; i++) { b.line(i * 42, 354, i * 42, 366, { w: 2 }); b.line(-6, 360 - i * 34, 6, 360 - i * 34, { w: 2 }); } b.tc(230, 400, "x", { size: 22, bold: true }); b.tc(-30, -20, "y", { size: 22, bold: true }); } },
  { id: "m-boxplot", pack: "maths", label: "Box-plot number line", levels: ["advanced"], make: (b, c) => { b.stamp("numberline", 0, 0, 760, 96, { min: 0, max: 50, step: 5 }); b.rect(200, -70, 260, 50, { c: c.brand, w: 3.5 }); b.line(330, -70, 330, -20, { c: c.brand, w: 3.5 }); b.line(100, -45, 200, -45, { w: 3.5 }); b.line(460, -45, 600, -45, { w: 3.5 }); b.line(100, -60, 100, -30, { w: 3.5 }); b.line(600, -60, 600, -30, { w: 3.5 }); } },
  { id: "m-matrix", pack: "maths", label: "Matrix / table frame", levels: ["advanced"], params: [{ k: "r", label: "Rows", type: "number", def: 2 }, { k: "c", label: "Columns", type: "number", def: 2 }], make: (b, c, v) => { const r = Math.min(5, num(v.r, 2)), q = Math.min(5, num(v.c, 2)), w = 90, h = 70; b.path([[-14, 0], [-30, 0], [-30, r * h], [-14, r * h]], { w: 4 }); b.path([[q * w + 14, 0], [q * w + 30, 0], [q * w + 30, r * h], [q * w + 14, r * h]], { w: 4 }); void c; } },
  { id: "m-bg-squared", pack: "maths", label: "Squared paper", bg: "squared" },
  { id: "m-bg-graph", pack: "maths", label: "Graph axes (−10…10)", bg: "graph" },
  { id: "m-bg-numline", pack: "maths", label: "Number line page", bg: "numberline" },
  { id: "m-bg-iso", pack: "maths", label: "Isometric dots", bg: "isometric" },
];
