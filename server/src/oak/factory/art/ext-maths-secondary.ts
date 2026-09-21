// EXTENSION (agent X2): verified teaching diagrams for MATHS KS3-KS4 (Y7-Y11, incl. GCSE higher/foundation).
// Every picture is GENERIC-CORRECT: it uses neutral letters (a, b, k, x, θ ...) so it cannot contradict any slide on that concept; the few that
// print specific numbers are flagged `numeric` (refused on slides whose text has digits). Geometry is computed (never eyeballed): polygon and
// circle coordinates come from exact trigonometry, angle marks from the real edge directions. Drawn in the shared PIC_CSS theme.
import type { Pic } from "./types";
import { svg, poly, ln, txt, dot, arrow, cap, tag, rightAngle, pt, arc, rect, pline, circ, path, sector, ell, esc, n } from "./helpers";

const W = 240, H = 170;
const M: Pic["subjects"] = ["Maths"];
/** every picture in this file is for Maths KS3-KS4 only (a KS1-2 diagram of the same word is a different picture) */
const KS34 = ["ks3", "ks4"];
type P = [number, number];
const DNS = "specific values or worked answers";
const mk = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, extra: Partial<Pic> = {}): Pic =>
  ({ id, title, alt, caption, subjects: M, keyStages: KS34, concepts, doesNotShow: DNS, evidence, svg: svg(W, H, body), ...extra });

/** math text: `^{..}` superscript, `_{..}` subscript */
function fm(s: string, k = 1): string {
  let out = "", shift = 0; const re = /([\^_])\{([^}]*)\}|([^\^_]+)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const sup = m[1] === "^", sub = m[1] === "_", target = sup ? -4 * k : sub ? 3 * k : 0, text = m[1] ? m[2] : m[3], d = target - shift; shift = target;
    out += `<tspan${d ? ` dy="${d}"` : ""}${m[1] ? ' font-size="72%"' : ""}>${esc(text)}</tspan>`;
  }
  return out;
}
const mt = (x: number, y: number, s: string, c = "") => `<text x="${n(x)}" y="${n(y)}" class="t ${c}">${fm(s)}</text>`;
const rot = (x: number, y: number, deg: number, s: string, c = "") => `<text x="${n(x)}" y="${n(y)}" class="t ${c}" transform="rotate(${deg} ${n(x)} ${n(y)})">${fm(s)}</text>`;
const D2R = Math.PI / 180;
/** maths-convention direction (degrees, anticlockwise from east) of the screen vector p -> q */
const dir = (p: P, q: P) => (Math.atan2(-(q[1] - p[1]), q[0] - p[0]) / D2R + 360) % 360;
/** the (smaller) angle at vertex v between v->a and v->b: arc(s) of radii r, r+3 ... and the mid-direction label point */
function angMark(v: P, a: P, b: P, r: number, k = 1, c = "a", lab = "", lc = "ts"): string {
  const a1 = dir(v, a), a2 = dir(v, b); let d = (((a2 - a1) % 360) + 360) % 360, start = a1;
  if (d > 180) { start = a2; d = 360 - d; }
  let s = ""; for (let i = 0; i < k; i++) s += arc(v[0], v[1], r + 3.2 * i, start, start + d, c);
  if (lab) { const [lx, ly] = pt(v[0], v[1], r + 3.2 * (k - 1) + 10, start + d / 2); s += txt(lx, ly + 4, lab, lc); }
  return s;
}
/** k short tick marks across the middle of segment p-q (equal-length marks) */
const tick = (p: P, q: P, k: number) => { const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, a = Math.atan2(q[1] - p[1], q[0] - p[0]), nx = -Math.sin(a), ny = Math.cos(a), ux = Math.cos(a), uy = Math.sin(a); let s = ""; for (let i = 0; i < k; i++) { const o = (i - (k - 1) / 2) * 5; s += ln(mx + ux * o - nx * 5, my + uy * o - ny * 5, mx + ux * o + nx * 5, my + uy * o + ny * 5, "th2"); } return s; };
const mid = (p: P, q: P): P => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
/** axes: x-axis at y=oy from xl to xr, y-axis at x=ox from yb (bottom) to yt (top) */
const ax = (ox: number, oy: number, xl: number, xr: number, yb: number, yt: number) => arrow(xl, oy, xr, oy, "l", 7) + arrow(ox, yb, ox, yt, "l", 7);
const poly2 = (pts: P[], c = "a") => `<polyline points="${pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" ")}" class="${c}"/>`;
const curve = (f: (x: number) => number, x0: number, x1: number, step: number, tr: (x: number, y: number) => P, c = "a") => { const pts: P[] = []; for (let x = x0; x <= x1 + 1e-9; x += step) pts.push(tr(x, f(x))); return poly2(pts, c); };
const box = (x: number, y: number, w: number, h: number, label: string, c = "l f1", tc = "") => rect(x, y, w, h, c, 4) + mt(x + w / 2, y + h / 2 + 4.5, label, tc);
const bracketH = (x1: number, x2: number, y: number, up: boolean) => `<path d="M${n(x1)} ${n(y)} v${up ? -4 : 4} H${n(x2)} v${up ? 4 : -4}" class="th2"/>`;
const rad = D2R;

/** caption lines (math text allowed); the LAST line sits at y */
const capm = (lines: string[], y = 164) => lines.map((l, i) => mt(120, y - (lines.length - 1 - i) * 12, l, "ts tm")).join("");

// ── graphs ──────────────────────────────────────────────────────────────────
const cubicG = (() => {
  const O: P = [120, 82], tr = (x: number, y: number): P => [O[0] + x * 42, O[1] - y * 17]; const r3 = Math.sqrt(3);
  let s = ax(120, 82, 16, 226, 136, 10) + curve((x) => x ** 3 - 3 * x, -2.05, 2.05, 0.05, tr, "a");
  for (const x of [-r3, 0, r3]) s += dot(...tr(x, 0), 3.8, "fg");
  s += dot(...tr(-1, 2), 3.8, "fr") + dot(...tr(1, -2), 3.8, "fr");
  return s + cap("a cubic graph: green dots are roots, red dots are turning points", 164);
})();
const recipG = (() => {
  const O: P = [120, 82], u = 22, tr = (x: number, y: number): P => [O[0] + x * u, O[1] - y * u];
  return ax(120, 82, 16, 226, 146, 10) + curve((x) => 1 / x, 0.42, 4.6, 0.04, tr) + curve((x) => 1 / x, -4.6, -0.42, 0.04, tr) + cap("y = 1/x never touches the axes", 164);
})();
const expG = (() => {
  const O: P = [120, 116], tr = (x: number, y: number): P => [O[0] + x * 24, O[1] - y * 14];
  return ax(120, 116, 16, 226, 134, 8) + curve((x) => 1.7 ** x, -3.6, 3.6, 0.1, tr, "a") + curve((x) => 1.7 ** -x, -3.6, 3.6, 0.1, tr, "ar")
    + txt(206, 20, "growth", "ts ta te") + txt(34, 20, "decay", "ts tr tl") + dot(...tr(0, 1), 3.6, "fo") + capm(["y = ab^{x}: growth when b > 1,", "decay when 0 < b < 1"]);
})();
const ymxc = (() => {
  const f = (x: number) => 100 - 0.46667 * (x - 50);
  return ax(50, 130, 30, 226, 148, 12) + ln(50, f(50), 204, f(204), "a") + dot(50, f(50), 4, "fr") + txt(58, 112, "c", "tb tr tl")
    + ln(100, f(100), 170, f(100), "ag") + ln(170, f(100), 170, f(170), "ao") + txt(135, f(100) + 13, "run", "ts tg") + txt(178, (f(100) + f(170)) / 2 + 4, "rise", "ts tl")
    + mt(112, 22, "y = mx + c", "tb")
    + capm(["m = gradient (rise ÷ run), c = y-intercept"], 164);
})();
const hvG = (() => {
  return ax(120, 100, 16, 226, 148, 10) + ln(20, 52, 224, 52, "a") + ln(172, 14, 172, 146, "ar") + mt(30, 44, "y = b", "ta tl") + mt(178, 24, "x = a", "tr tl")
    + txt(166, 113, "a", "ts te") + txt(113, 56, "b", "ts te") + cap("y = b is horizontal; x = a is vertical", 164);
})();
const directG = (() => {
  return ax(36, 138, 30, 222, 146, 10) + ln(36, 138, 198, 42, "a") + dot(36, 138, 4, "fr") + mt(104, 46, "y = kx", "tb ta") + cap("direct proportion: through the origin", 164);
})();
const inverseG = (() => {
  const tr = (x: number, y: number): P => [36 + x * 40, 138 - y * 32];
  return ax(36, 138, 30, 222, 146, 10) + curve((x) => 1.6 / x, 0.46, 4.6, 0.04, tr) + mt(128, 40, "y = k ÷ x", "tb ta") + cap("inverse proportion: y falls as x rises", 164);
})();
const speedTime = (() => {
  const pts: P[] = [[40, 138], [96, 70], [156, 70], [204, 138]];
  return poly(pts, "f1") + ax(40, 138, 30, 224, 146, 10) + ln(40, 138, 96, 70, "ag") + ln(96, 70, 156, 70, "a") + ln(156, 70, 204, 138, "ar")
    + txt(48, 50, "speeding up", "ts tg tl") + txt(126, 62, "steady", "ts ta") + txt(224, 106, "slowing", "ts tr te") + rot(26, 62, -90, "speed", "ts tm") + txt(224, 152, "time", "ts tm te")
    + cap("gradient = acceleration; area = distance", 166);
})();
const unitCircle = (() => {
  const C: P = [104, 84], r = 58, th = 40, P1 = pt(C[0], C[1], r, th);
  return circ(C[0], C[1], r, "l f0") + ax(C[0], C[1], 34, 176, 148, 12) + ln(C[0], C[1], P1[0], P1[1], "ar") + ln(P1[0], P1[1], P1[0], C[1], "h") + dot(P1[0], P1[1], 4, "fr")
    + arc(C[0], C[1], 16, 0, th, "th2") + txt(C[0] + 25, C[1] - 4, "θ", "ta") + txt(C[0] + 14, C[1] - 32, "1", "ts tr")
    + mt(P1[0] + 8, P1[1] - 6, "(cos θ, sin θ)", "ts tl") + txt((C[0] + P1[0]) / 2, C[1] + 13, "cos θ", "tx ta") + txt(168, (P1[1] + C[1]) / 2 + 4, "sin θ", "tx tg tl") + ln(P1[0] + 1, (P1[1] + C[1]) / 2, 166, (P1[1] + C[1]) / 2, "th") + cap("unit circle: radius 1, centre the origin", 164);
})();
const circleEq = (() => {
  const C: P = [110, 84], r = 56, P1 = pt(C[0], C[1], r, 36);
  return circ(C[0], C[1], r, "l f0") + ax(C[0], C[1], 40, 186, 144, 12) + ln(C[0], C[1], P1[0], P1[1], "ar") + ln(P1[0], P1[1], P1[0], C[1], "ag") + ln(C[0], C[1], P1[0], C[1], "a") + dot(P1[0], P1[1], 4, "fr")
    + txt(P1[0] + 6, P1[1] - 6, "(x, y)", "ts tl") + txt((C[0] + P1[0]) / 2 - 6, (C[1] + P1[1]) / 2 - 4, "r", "ts tr te") + txt((C[0] + P1[0]) / 2, C[1] + 13, "x", "ts ta") + txt(P1[0] + 8, (P1[1] + C[1]) / 2 + 4, "y", "ts tg tl")
    + mt(8, 22, "x² + y² = r²", "tb tl") + cap("a circle, centre the origin, radius r", 164);
})();
const gradCurve = (() => {
  const v = (x: number) => 90 * ((x - 30) / 170) ** 2, tr = (x: number): P => [x, 132 - v(x)]; const x0 = 112, s = 2 * 90 * ((x0 - 30) / 170) / 170;
  const T = (x: number): P => [x, 132 - (v(x0) + s * (x - x0))]; const Q: P = tr(170);
  return ax(30, 132, 22, 226, 138, 10) + curve((x) => v(x), 30, 205, 3, (x, y) => [x, 132 - y]) + ln(...T(66), ...T(164), "ar") + ln(...tr(x0), ...Q, "h") + dot(...tr(x0), 4, "fr") + dot(...Q, 3.4)
    + txt(122, 126, "tangent at P", "ts tr tl") + txt(tr(x0)[0] - 8, tr(x0)[1] - 8, "P", "ts te") + txt(Q[0] + 6, Q[1] - 4, "Q", "ts tl") + cap("the gradient of a curve at P is the gradient of the tangent at P", 164);
})();
// graph transformations of y = f(x): base curve = a skewed bump (so a reflection in the y-axis and a shift really differ)
const bump = (x: number) => Math.exp(-1.6 * (x - 0.6) ** 2);
const panelG = (ox: number, oy: number, f: (x: number) => number, label: string, base = true) => {
  const cx = ox + 56, cy = oy + 40, tr = (x: number, y: number): P => [cx + x * 20, cy - y * 22];
  return arrow(ox + 4, cy, ox + 110, cy, "l", 5) + arrow(cx, oy + 62, cx, oy + 1, "l", 5) + (base ? curve(bump, -2.5, 2.5, 0.1, tr, "th") : "") + curve(f, -2.5, 2.5, 0.1, tr, "a") + mt(cx, oy + 76, label, "ts");
};
const graphTf = panelG(2, 0, (x) => bump(x) + 0.6, "y = f(x) + a") + panelG(122, 0, (x) => bump(x + 1.1), "y = f(x + a)") + panelG(2, 80, (x) => -bump(x), "y = −f(x)") + panelG(122, 80, (x) => bump(-x), "y = f(−x)") + txt(120, 168, "grey: y = f(x);  blue: the transformed graph (a > 0)", "tt tm");
const graphStretch = (() => {
  const one = (ox: number, f: (x: number) => number, l1: string, l2: string) => { const cx = ox + 58, cy = 104, tr = (x: number, y: number): P => [cx + x * 22, cy - y * 22]; return arrow(ox + 4, cy, ox + 112, cy, "l", 5) + arrow(cx, cy + 22, cx, 14, "l", 5) + curve(bump, -2.5, 2.5, 0.05, tr, "th") + curve(f, -2.5, 2.5, 0.05, tr, "a") + mt(cx, 138, l1, "ts") + txt(cx, 151, l2, "tx tm"); };
  return one(2, (x) => 1.6 * bump(x), "y = af(x)", "stretch in y, factor a") + one(122, (x) => bump(2 * x), "y = f(ax)", "stretch in x, factor 1/a") + txt(120, 165, "(dotted curve: y = f(x); here a > 1)", "tt tm");
})();
const ineqLines = (() => {
  const rows: [string, boolean, boolean][] = [["x > a", false, true], ["x ≥ a", true, true], ["x < a", false, false], ["x ≤ a", true, false]]; let s = "";
  rows.forEach(([lab, closed, right], i) => { const y = 24 + i * 32; s += mt(14, y + 4, lab, "tl") + ln(80, y, 224, y, "l") + (right ? arrow(196, y, 226, y, "l", 8) : arrow(108, y, 78, y, "l", 8)) + circ(152, y, 5.2, closed ? "l fs" : "l f0") + txt(152, y + 17, "a", "tx tm"); });
  return s + cap("open circle: a is not included; closed circle: a is included", 164);
})();
const ineqRegion = (() => {
  const one = (ox: number, dashed: boolean, above: boolean, lab: string) => {
    const f = (x: number) => 76 - 0.45 * (x - ox - 8) + 0; const x0 = ox + 8, x1 = ox + 108; const A: P = [x0, f(x0)], B: P = [x1, f(x1)];
    const region: P[] = above ? [A, B, [x1, 14], [x0, 14]] : [A, B, [x1, 118], [x0, 118]];
    return poly(region, "f1") + arrow(ox + 4, 118, ox + 112, 118, "l", 5) + arrow(ox + 4, 118, ox + 4, 10, "l", 5) + ln(A[0], A[1], B[0], B[1], dashed ? "h" : "l") + mt(ox + 58, 132, lab, "ts");
  };
  return one(4, true, true, "y > mx + c") + one(124, false, false, "y ≤ mx + c") + cap("dashed line: < or > (not included); solid line: ≤ or ≥ (included)", 164);
})();
const simulG = (() => {
  const f1 = (x: number) => 118 - 0.62 * (x - 30), f2 = (x: number) => 40 + 0.5 * (x - 30); const xi = 30 + (118 - 40) / (0.62 + 0.5), yi = f1(xi);
  return ax(30, 136, 24, 224, 140, 10) + ln(30, f1(30), 210, f1(210), "a") + ln(30, f2(30), 210, f2(210), "ag") + dot(xi, yi, 4.4, "fr") + txt(xi + 34, yi + 4, "solution", "ts tr tl")
    + txt(186, 14, "line 1", "tx ta te") + txt(214, f2(214) + 16, "line 2", "tx tg te") + cap("the solution is where the lines cross", 164);
})();
const funcMachine = (() => {
  return arrow(10, 78, 62, 78, "l", 8) + box(64, 44, 112, 68, "", "l f3") + txt(120, 74, "function", "tb") + txt(120, 92, "(a rule)", "ts tm") + arrow(178, 78, 230, 78, "l", 8) + txt(36, 68, "input", "ts") + txt(204, 68, "output", "ts") + cap("a function machine: an input goes in, the rule is applied, an output comes out", 164);
})();
const inverseF = (() => {
  return txt(16, 40, "x", "tb") + arrow(28, 36, 74, 36, "l", 7) + box(76, 16, 88, 40, "f", "l f3", "tb") + arrow(166, 36, 214, 36, "l", 7) + txt(226, 40, "y", "tb")
    + txt(16, 114, "x", "tb") + arrow(214, 110, 168, 110, "ar", 7) + box(76, 90, 88, 40, "f^{−1}", "l f4", "tb") + arrow(74, 110, 28, 110, "ar", 7) + txt(226, 114, "y", "tb")
    + capm(["the inverse function f^{−1} undoes f:", "it maps y back to x"], 164);
})();
const compositeF = (() => {
  return txt(10, 74, "x", "tb") + arrow(20, 70, 40, 70, "l", 6) + box(42, 50, 36, 40, "g", "l f3", "tb") + arrow(80, 70, 96, 70, "l", 6) + txt(113, 74, "g(x)", "ts") + arrow(130, 70, 148, 70, "l", 6) + box(150, 50, 36, 40, "f", "l f2", "tb") + arrow(188, 70, 204, 70, "l", 6) + mt(206, 74, "fg(x)", "ts tl")
    + `<path d="M22 108 H224" class="th"/>` + mt(120, 128, "fg(x) = f(g(x))", "tb") + cap("do g first, then f", 164);
})();

// ── sequences ───────────────────────────────────────────────────────────────
const HEADC: Record<string, string> = { l: "hd", a: "hda", ar: "hdr", ag: "hdg", ao: "hdo" };
/** a curved arrow from (x1,y1) to (x2,y2) bulging by `bulge` (positive = up) */
const curved = (x1: number, y1: number, x2: number, y2: number, bulge: number, c = "l") => {
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - bulge, a = Math.atan2(y2 - cy, x2 - cx), s = 7;
  const p1: P = [x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)], p2: P = [x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)];
  return path(`M${n(x1)} ${n(y1)} Q${n(cx)} ${n(cy)} ${n(x2 - 3 * Math.cos(a))} ${n(y2 - 3 * Math.sin(a))}`, c) + poly([[x2, y2], p1, p2], HEADC[c] ?? "hd");
};
const seqRow = (op: string, c: string, tc: string, foot: string, sub: string, cp: string) => {
  let s = ""; const xs = [12, 72, 132, 192];
  xs.forEach((x, i) => { s += box(x, 56, 38, 30, `t${i + 1}`, "l f1", "ts"); if (i < 3) s += curved(x + 19, 54, x + 79, 54, 28, c) + txt(x + 49, 32, op, `ts ${tc}`); });
  return s + mt(120, 116, foot, "tb") + txt(120, 132, sub, "ts tm") + cap(cp, 164);
};
const arithSeq = seqRow("+ d", "ag", "tg", "d = the common difference", "(the same amount is added each time)", "an arithmetic sequence: add the same amount each time");
const geoSeq = seqRow("× r", "ar", "tr", "r = the common ratio", "(multiplied by the same amount each time)", "a geometric sequence: multiply by the same amount each time");
const quadSeq = (() => {
  const terms = [2, 5, 10, 17], d1 = [3, 5, 7], d2 = [2, 2]; let s = txt(8, 50, "terms", "ts tm tl") + txt(8, 88, "1st differences", "ts tm tl") + txt(8, 126, "2nd differences", "ts tm tl");
  terms.forEach((t, i) => { s += box(112 + i * 32, 36, 28, 20, String(t), "l f1", "ts"); }); d1.forEach((t, i) => { s += box(128 + i * 32, 74, 28, 20, String(t), "l f3", "ts"); }); d2.forEach((t, i) => { s += box(144 + i * 32, 112, 28, 20, String(t), "l f2", "ts"); });
  return s.replace('x="8" y="88"', 'x="8" y="90"') + cap("a quadratic sequence has a constant second difference", 164);
})();
const nthTerm = (() => {
  let s = txt(10, 34, "position n", "ts tm tl") + txt(10, 78, "term", "ts tm tl");
  [1, 2, 3, 4].forEach((v, i) => { const x = 88 + i * 38; s += box(x, 20, 32, 22, String(v), "l f1", "ts") + box(x, 64, 32, 22, String(3 * v + 1), "l f3", "ts") + arrow(x + 16, 44, x + 16, 62, "l", 5); });
  return s + mt(120, 116, "nth term = 3n + 1", "tb") + cap("each term is found from its position n", 164);
})();
const factorTree = (() => {
  const nd = (x: number, y: number, t: string, prime: boolean) => circ(x, y, 12, prime ? "l f2" : "l f0") + txt(x, y + 4, t, "ts");
  const e = (x1: number, y1: number, x2: number, y2: number) => ln(x1, y1 + 11, x2, y2 - 11, "th2");
  return e(120, 20, 76, 62) + e(120, 20, 164, 62) + e(76, 62, 48, 104) + e(76, 62, 104, 104) + e(164, 62, 136, 104) + e(164, 62, 192, 104)
    + nd(120, 20, "60", false) + nd(76, 62, "6", false) + nd(164, 62, "10", false) + nd(48, 104, "2", true) + nd(104, 104, "3", true) + nd(136, 104, "2", true) + nd(192, 104, "5", true)
    + capm(["a factor tree: the prime factors (green) are", "at the ends of the branches"], 164);
})();
const setNotation = (() => {
  const panel = (ox: number, oy: number, mode: "and" | "or" | "notA" | "neither", label: string, idc: string) => {
    const w = 108, h = 56, A: P = [ox + 40, oy + 28], B: P = [ox + 68, oy + 28], r = 19; let s = rect(ox, oy, w, h, mode === "notA" || mode === "neither" ? "l f1" : "l f0", 3);
    if (mode === "and") s += circ(A[0], A[1], r, "l f0") + circ(B[0], B[1], r, "l f0") + `<clipPath id="${idc}"><circle cx="${n(A[0])}" cy="${n(A[1])}" r="${r}"/></clipPath><circle cx="${n(B[0])}" cy="${n(B[1])}" r="${r}" class="f1" clip-path="url(#${idc})"/>` + circ(A[0], A[1], r, "l") + circ(B[0], B[1], r, "l");
    else if (mode === "or") s += circ(A[0], A[1], r, "l f1") + circ(B[0], B[1], r, "l f1");
    else if (mode === "notA") s += circ(B[0], B[1], r, "l f1") + circ(A[0], A[1], r, "l f0");
    else s += circ(A[0], A[1], r, "l f0") + circ(B[0], B[1], r, "l f0");
    return s + txt(A[0] - 8, A[1] + 4, "A", "ts") + txt(B[0] + 8, B[1] + 4, "B", "ts") + txt(ox + 9, oy + 13, "ξ", "ts tm") + mt(ox + w / 2, oy + h + 14, label, "ts");
  };
  return panel(4, 4, "and", "A ∩ B  (both)", "x2sn1") + panel(128, 4, "or", "A ∪ B  (either)", "x2sn2") + panel(4, 84, "notA", "A′  (not A)", "x2sn3") + panel(128, 84, "neither", "(A ∪ B)′  (neither)", "x2sn4") + txt(120, 166, "shaded = the set named; ξ = every item", "tt tm");
})();
const histogramG = (() => {
  const bars: [number, number, number][] = [[44, 22, 44], [66, 44, 84], [110, 22, 60], [132, 66, 30]]; let s = "";
  bars.forEach(([x, w, h], i) => { s += rect(x, 122 - h, w, h, i % 2 ? "l f3" : "l f1"); });
  return s + ax(40, 122, 30, 214, 128, 10) + rot(26, 70, -90, "frequency density", "ts tm") + txt(128, 136, "class (bars touch)", "ts tm") + capm(["a histogram: the area of each bar", "shows its frequency"], 164);
})();
const boxPlot = (() => {
  const xs = { mn: 26, lq: 78, md: 112, uq: 168, mx: 214 }, y = 60, h = 32, my = y + h / 2;
  let s = ln(xs.mn, my, xs.lq, my, "l") + ln(xs.uq, my, xs.mx, my, "l") + ln(xs.mn, y + 6, xs.mn, y + h - 6, "l") + ln(xs.mx, y + 6, xs.mx, y + h - 6, "l") + rect(xs.lq, y, xs.uq - xs.lq, h, "l f1") + ln(xs.md, y, xs.md, y + h, "ar");
  s += txt(xs.mn, 52, "min", "ts") + txt(xs.lq, 34, "LQ", "ts") + ln(xs.lq, 38, xs.lq, y, "th") + txt(xs.md, 18, "median", "ts") + ln(xs.md, 22, xs.md, y, "th") + txt(xs.uq, 34, "UQ", "ts") + ln(xs.uq, 38, xs.uq, y, "th") + txt(xs.mx, 52, "max", "ts");
  s += bracketH(xs.lq, xs.uq, y + h + 8, false) + txt((xs.lq + xs.uq) / 2, y + h + 26, "IQR", "ts ta") + bracketH(xs.mn, xs.mx, y + h + 32, false) + txt((xs.mn + xs.mx) / 2, y + h + 50, "range", "ts tg");
  return s + cap("IQR = UQ − LQ;  range = max − min", 166);
})();
const cumFreq = (() => {
  const S = (t: number) => t * t * (3 - 2 * t), inv = (v: number) => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (S(m) < v) lo = m; else hi = m; } return (lo + hi) / 2; };
  const X0 = 44, X1 = 208, Y0 = 128, Y1 = 24, tr = (t: number): P => [X0 + (X1 - X0) * t, Y0 - (Y0 - Y1) * S(t)]; const pts: P[] = []; for (let t = 0; t <= 1.0001; t += 0.02) pts.push(tr(t));
  let s = ax(X0, Y0, 34, 222, 136, 10) + poly2(pts, "a");
  for (const [v, name] of [[0.25, "LQ"], [0.5, "median"], [0.75, "UQ"]] as [number, string][]) { const t = inv(v), p = tr(t), yy = Y0 - (Y0 - Y1) * v; s += ln(X0, yy, p[0], yy, "h") + ln(p[0], yy, p[0], Y0, "h") + dot(p[0], Y0, 3, "fr") + txt(p[0], Y0 + 11, name, "tx tr"); }
  for (const [v, name] of [[0.25, "¼n"], [0.5, "½n"], [0.75, "¾n"], [1, "n"]] as [number, string][]) s += txt(X0 - 5, Y0 - (Y0 - Y1) * v + 3, name, "tx te");
  return s + rot(16, 76, -90, "cumulative frequency", "tx tm") + txt(218, Y0 + 11, "value", "tx tm te") + cap("read the median at ½n and the quartiles at ¼n and ¾n", 165);
})();
const stemLeaf = (() => {
  const rows: [string, string][] = [["1", "2 5 8"], ["2", "0 3 3 7"], ["3", "1 4"]]; let s = txt(80, 26, "stem", "ts tm te") + txt(98, 26, "leaf", "ts tm tl") + ln(89, 30, 89, 100, "l") + ln(56, 32, 190, 32, "th");
  rows.forEach(([a, b], i) => { s += txt(80, 54 + i * 22, a, "tb te") + txt(98, 54 + i * 22, b, "tb tl"); });
  return s + txt(120, 124, "key: 2 | 3 means 23", "ts ta") + cap("a stem and leaf diagram keeps every value in order", 164);
})();
const freqPoly = (() => {
  const hs = [20, 44, 66, 40, 16]; let s = ""; hs.forEach((h, i) => { s += rect(34 + i * 34, 130 - h, 34, h, "l f6"); });
  const pts: P[] = hs.map((h, i) => [34 + i * 34 + 17, 130 - h]); return s + ax(30, 130, 24, 214, 138, 10) + poly2(pts, "a") + pts.map((p) => dot(p[0], p[1], 3.2, "fr")).join("") + capm(["a frequency polygon: join the midpoints", "of the tops of the bars"], 164);
})();
const twoWay = (() => {
  const x0 = 34, y0 = 14, cw = 52, rh = 30; let s = "";
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const head = (r === 0 || c === 0) && !(r === 0 && c === 0), tot = (r === 3 || c === 3) && !head; s += rect(x0 + c * cw, y0 + r * rh, cw, rh, head ? "l f1" : tot ? "l f3" : "l f0"); }
  s += txt(x0 + cw * 1.5, y0 + 19, "A", "ts") + txt(x0 + cw * 2.5, y0 + 19, "B", "ts") + txt(x0 + cw * 3.5, y0 + 19, "total", "ts") + txt(x0 + cw * 0.5, y0 + rh + 19, "X", "ts") + txt(x0 + cw * 0.5, y0 + rh * 2 + 19, "Y", "ts") + txt(x0 + cw * 0.5, y0 + rh * 3 + 19, "total", "ts");
  return s + cap("a two-way table: each row and column adds to its total", 164);
})();
const freqTree = (() => {
  const b = (cx: number, cy: number, t: string, c: string) => rect(cx - 30, cy - 10, 60, 20, c, 3) + txt(cx, cy + 3.5, t, "tx");
  const link = (x1: number, y1: number, x2: number, y2: number) => ln(x1, y1, x2, y2, "th2");
  const mids: P[] = [[110, 36], [110, 104]], leaves: P[] = [[194, 16], [194, 54], [194, 86], [194, 124]];
  return link(64, 70, 80, 36) + link(64, 70, 80, 104) + link(140, 36, 162, 16) + link(140, 36, 162, 54) + link(140, 104, 162, 86) + link(140, 104, 162, 124)
    + b(34, 70, "total", "l f3") + mids.map((p) => b(p[0], p[1], "frequency", "l f1")).join("") + leaves.map((p) => b(p[0], p[1], "frequency", "l f2")).join("") + capm(["a frequency tree: each split adds up", "to the frequency before it"], 164);
})();

// ── number and algebra ──────────────────────────────────────────────────────
const bt = (x: number, y: number, s: string, size: number, c = "") => `<text x="${n(x)}" y="${n(y)}" class="t ${c}" style="font-size:${size}px">${fm(s, size / 12.5)}</text>`;
const standardForm = (() => {
  return bt(120, 58, "a × 10^{n}", 34) + txt(120, 84, "1 ≤ a < 10", "tb ta") + txt(120, 102, "n is a whole number (an integer)", "ts tm")
    + txt(120, 128, "numbers 10 or more: n is positive", "ts tg") + txt(120, 144, "numbers less than 1: n is negative", "ts tr") + cap("standard form", 164);
})();
const indexLaws = (() => {
  const rows: [string, string][] = [["multiply", "a^{m} × a^{n} = a^{m+n}"], ["divide", "a^{m} ÷ a^{n} = a^{m−n}"], ["power of a power", "(a^{m})^{n} = a^{mn}"], ["power zero", "a^{0} = 1"], ["negative power", "a^{−n} = 1 ÷ a^{n}"]]; let s = "";
  rows.forEach(([nm, f], i) => { const y = 26 + i * 26; s += txt(8, y, nm, "ts tm tl") + mt(112, y, f, "tl"); });
  return s + cap("the laws of indices (a is not zero)", 164);
})();
const powerNote = (() => {
  return `<text x="112" y="76" class="t te" style="font-size:48px">a</text><text x="116" y="48" class="t tl" style="font-size:28px">n</text>` + txt(46, 64, "base", "ts te") + ln(50, 61, 84, 61, "th") + txt(150, 26, "exponent", "ts tl") + txt(150, 39, "(power, index)", "tx tm tl") + ln(148, 26, 134, 34, "th")
    + mt(120, 112, "a^{n} = a × a × … × a", "tb") + txt(120, 130, "(n lots of a multiplied together)", "ts tm") + cap("power (index) notation", 164);
})();
const surdRules = (() => {
  const rows = ["√a × √b = √(ab)", "√a ÷ √b = √(a ÷ b)", "(√a)^{2} = a", "√(a^{2}b) = a√b", "√a + √b ≠ √(a + b)"]; let s = "";
  rows.forEach((r, i) => { s += mt(120, 28 + i * 26, r, "tb"); });
  return s + cap("surd rules (a and b are positive)", 164);
})();
const simpleCompound = (() => {
  const panel = (ox: number, title: string, amounts: number[]) => { let s = txt(ox + 54, 14, title, "ts"), x = ox + 8; const base = 40, y0 = 112;
    amounts.forEach((a, i) => { s += rect(x + i * 26, y0 - base, 20, base, "l f1") + (a > base ? rect(x + i * 26, y0 - a, 20, a - base, "l f3") : ""); });
    return s + arrow(ox + 4, y0, ox + 108, y0, "l", 5) + txt(ox + 54, y0 + 12, "time", "tx tm"); };
  return panel(4, "simple", [40, 54, 68, 82]) + panel(126, "compound", [40, 54, 72.9, 98.4]) + txt(120, 136, "blue = original amount, gold = interest added", "tx tm") + capm(["simple: interest only on the original", "compound: interest on interest too"], 164);
})();
const percentMult = (() => {
  return box(8, 12, 62, 40, "original", "l f1", "ts") + box(170, 12, 62, 40, "new", "l f3", "ts") + arrow(72, 24, 168, 24, "ag", 7) + txt(120, 18, "× multiplier", "ts tg") + arrow(168, 42, 72, 42, "ar", 7) + txt(120, 56, "÷ multiplier", "ts tr")
    + mt(120, 84, "increase by p%: multiplier = 1 + p/100", "ts") + mt(120, 102, "decrease by p%: multiplier = 1 − p/100", "ts") + capm(["reverse percentages: divide the new amount", "by the multiplier to get the original"], 164);
})();
const ratioShare = (() => {
  let s = ""; const x0 = 20, w = 40, y = 52;
  for (let i = 0; i < 5; i++) s += rect(x0 + i * w, y, w, 32, i < 2 ? "l f1" : "l f3");
  s += bracketH(x0, x0 + 5 * w, y - 6, true) + txt(120, y - 14, "total = 5 parts", "ts") + bracketH(x0, x0 + 2 * w, y + 40, false) + txt(x0 + w, y + 58, "A: 2 parts", "ts ta") + bracketH(x0 + 2 * w, x0 + 5 * w, y + 40, false) + txt(x0 + 3.5 * w, y + 58, "B: 3 parts", "ts")
  ;return s + txt(120, 136, "A : B = 2 : 3;  1 part = total ÷ 5", "ts") + cap("sharing in a ratio: find the value of one part", 164);
})();
const doubleLine = (() => {
  const xs = [24, 68, 112, 156, 200]; let s = arrow(14, 42, 226, 42, "l", 7) + arrow(14, 108, 226, 108, "l", 7);
  xs.forEach((x, i) => { s += ln(x, 36, x, 48, "l") + ln(x, 102, x, 114, "l") + ln(x, 48, x, 102, "th") + txt(x, 30, String(i), "ts") + txt(x, 128, i === 0 ? "0" : i === 1 ? "k" : `${i}k`, "ts tr"); });
  return s + rect(96, 68, 48, 20, "l f3", 4) + txt(120, 82, "× k", "ts") + capm(["a double number line: both lines", "scale by the same multiplier"], 164);
})();
const hcfLcm = (() => {
  return circ(92, 62, 44, "l f1") + circ(148, 62, 44, "l f3") + txt(76, 66, "A only", "ts") + txt(120, 66, "both", "ts") + txt(164, 66, "B only", "ts") + txt(120, 12, "prime factors of two numbers", "ts tm")
    + capm(["HCF: multiply the prime factors in both", "LCM: multiply all the prime factors shown"], 164);
})();
const arithLaws = (() => {
  return txt(120, 20, "commutative (the order does not matter)", "ts tm") + mt(120, 40, "a + b = b + a    a × b = b × a", "tb") + txt(120, 66, "associative (the grouping does not matter)", "ts tm") + mt(120, 86, "(a + b) + c = a + (b + c)", "tb")
    + txt(120, 112, "distributive (multiplying a sum)", "ts tm") + mt(120, 132, "a(b + c) = ab + ac", "tb") + cap("laws for addition and multiplication", 164);
})();
const orderOps = (() => {
  const rows = ["Brackets", "Indices (powers, roots)", "Division and multiplication", "Addition and subtraction"]; let s = "";
  rows.forEach((r, i) => { const y = 26 + i * 30; s += circ(26, y, 11, "l f1") + txt(26, y + 4, String(i + 1), "ts") + txt(46, y + 4, r, "tb tl"); });
  return s + txt(120, 146, "same level: work from left to right", "ts tm") + cap("the order of operations (BIDMAS)", 164);
})();
const binomGrid = (() => {
  const x0 = 84, y0 = 26, wa = 60, wb = 40, ha = 60, hb = 40;
  return rect(x0, y0, wa, ha, "l f1") + rect(x0 + wa, y0, wb, ha, "l f3") + rect(x0, y0 + ha, wa, hb, "l f3") + rect(x0 + wa, y0 + ha, wb, hb, "l f4")
    + mt(x0 + wa / 2, y0 + ha / 2 + 5, "x²", "tb") + mt(x0 + wa + wb / 2, y0 + ha / 2 + 5, "ax", "ts") + mt(x0 + wa / 2, y0 + ha + hb / 2 + 4, "bx", "ts") + mt(x0 + wa + wb / 2, y0 + ha + hb / 2 + 4, "ab", "ts")
    + txt(x0 + wa / 2, y0 - 8, "x", "ts") + txt(x0 + wa + wb / 2, y0 - 8, "+ a", "ts") + txt(x0 - 8, y0 + ha / 2 + 4, "x", "ts te") + txt(x0 - 8, y0 + ha + hb / 2 + 4, "+ b", "ts te")
    + mt(120, 140, "(x + a)(x + b) = x² + (a + b)x + ab", "ts") + cap("the areas of the four parts add up", 164);
})();
const diffSquares = (() => {
  const L: P[] = [[14, 34], [50, 34], [50, 58], [74, 58], [74, 94], [14, 94]]; const R = rect(112, 58, 84, 36, "l f3");
  return poly(L, "l f1") + `<rect x="50" y="34" width="24" height="24" class="h" fill="none"/>` + mt(38, 82, "a² − b²", "ts") + txt(44, 108, "a", "ts") + txt(62, 28, "b", "ts tm") + txt(94, 82, "=", "tb")
    + R + txt(154, 52, "a + b", "ts") + txt(204, 80, "a − b", "ts tl") + mt(120, 132, "a² − b² = (a + b)(a − b)", "tb") + cap("the two shapes have the same area", 164);
})();
const quadFormula = (() => {
  return txt(120, 24, "for  ax² + bx + c = 0  (a ≠ 0)", "ts tm") + mt(28, 82, "x =", "tb") + mt(132, 66, "−b ± √(b² − 4ac)", "tb") + ln(56, 76, 214, 76, "l") + mt(132, 100, "2a", "tb") + cap("the quadratic formula", 164);
})();
const balanceEq = (() => {
  const by = 60; return ln(30, by, 210, by, "l") + poly([[120, by], [102, 118], [138, 118]], "l f6") + ln(84, 118, 156, 118, "l") + dot(120, by, 4)
    + ln(52, by, 26, 84, "th") + ln(52, by, 78, 84, "th") + rect(22, 84, 60, 8, "l f1", 2) + ln(188, by, 162, 84, "th") + ln(188, by, 214, 84, "th") + rect(158, 84, 60, 8, "l f3", 2)
    + txt(52, 106, "left side", "tx") + txt(188, 106, "right side", "tx") + txt(120, 40, "=", "tb") + capm(["an equation is a balance:", "do the same to both sides"], 164);
})();
const ineqSymbols = (() => {
  const rows: [string, string][] = [["<", "less than"], [">", "greater than"], ["≤", "less than or equal to"], ["≥", "greater than or equal to"]]; let s = "";
  rows.forEach(([sy, w], i) => { const y = 24 + i * 30; s += rect(14, y - 13, 30, 26, "l f1", 4) + txt(29, y + 5, sy, "tb") + txt(56, y + 4, w, "tb tl"); });
  return s + cap("a < b means a is less than b", 164);
})();
const errInterval = (() => {
  return ln(24, 96, 216, 96, "l") + ln(70, 96, 170, 96, "a") + circ(70, 96, 5, "l fs") + circ(170, 96, 5, "l f0") + ln(120, 90, 120, 102, "th2") + txt(120, 84, "rounded value", "ts")
    + txt(70, 118, "lower bound", "ts tr") + txt(170, 118, "upper bound", "ts") + mt(120, 44, "lower bound ≤ x < upper bound", "") + capm(["the error interval: every value in it", "rounds to the same value"], 164);
})();
const likeTerms = (() => {
  const tile = (x: number, y: number, l: string, c: string) => rect(x, y, 26, 22, c, 3) + txt(x + 13, y + 15, l, "ts");
  let s = ""; for (let i = 0; i < 3; i++) s += tile(8 + i * 30, 22, "x", "l f1"); s += txt(102, 38, "+", "tb"); for (let i = 0; i < 2; i++) s += tile(114 + i * 30, 22, "x", "l f1"); s += txt(178, 38, "=", "tb");
  s += mt(120, 66, "3x + 2x = 5x  (like terms: add)", "ts tg");
  s += tile(8, 86, "x", "l f1") + tile(38, 86, "x", "l f1") + tile(68, 86, "x", "l f1") + txt(102, 102, "+", "tb") + tile(114, 86, "y", "l f3") + tile(144, 86, "y", "l f3");
  return s + mt(120, 130, "3x + 2y  (unlike terms: cannot combine)", "ts tr") + capm(["like terms have the same letters", "with the same powers"], 164);
})();
const metricPrefix = (() => {
  const rows: [string, string][] = [["kilo-", "1000 times the unit"], ["centi-", "one hundredth of the unit"], ["milli-", "one thousandth of the unit"]].map(([a, b]) => [a, b.replace(" of the unit", "").replace(" the unit", "")]) as [string, string][]; let s = "";
  rows.forEach(([p, m], i) => { const y = 30 + i * 36; s += rect(12, y - 15, 64, 28, "l f1", 6) + txt(44, y + 4, p, "tb") + arrow(80, y - 1, 100, y - 1, "l", 6) + txt(106, y + 3, m, "ts tl"); });
  return s + cap("a prefix multiplies or divides the unit", 164);
})();
const mutExcl = (() => {
  return rect(4, 12, 108, 60, "l f0", 3) + circ(28, 42, 20, "l f1") + circ(84, 42, 20, "l f3") + txt(28, 46, "A", "ts") + txt(84, 46, "B", "ts") + txt(58, 92, "no overlap", "ts tg")
    + rect(128, 12, 108, 60, "l f0", 3) + circ(160, 42, 20, "l f1") + circ(188, 42, 20, "l f3") + `<clipPath id="x2me"><circle cx="160" cy="42" r="20"/></clipPath><circle cx="188" cy="42" r="20" class="f2" clip-path="url(#x2me)"/>` + circ(160, 42, 20, "l") + circ(188, 42, 20, "l") + txt(150, 46, "A", "ts") + txt(198, 46, "B", "ts") + txt(182, 92, "overlap", "ts tr")
    + txt(58, 110, "mutually exclusive", "ts") + txt(182, 110, "not mutually exclusive", "tx") + capm(["mutually exclusive events cannot", "both happen at the same time"], 164);
})();
const probTree = (() => {
  const R: P = [8, 72], a: P = [66, 36], na: P = [66, 108]; const leaves: P[] = [[130, 16], [130, 54], [130, 90], [130, 128]];
  let s = ln(R[0], R[1], a[0], a[1], "th2") + ln(R[0], R[1], na[0], na[1], "th2");
  leaves.forEach((l, i) => { const from = i < 2 ? a : na; s += ln(from[0], from[1], l[0], l[1], "th2") + dot(l[0], l[1], 2.6); });
  s += dot(R[0], R[1], 3) + dot(a[0], a[1], 3) + dot(na[0], na[1], 3);
  s += txt(a[0] - 6, a[1] - 6, "A", "ts te") + txt(na[0] - 6, na[1] + 14, "not A", "ts te") + txt(30, 46, "p", "ts te") + txt(34, 106, "1 − p", "ts te");
  s += txt(98, 19, "q", "ts") + txt(98, 60, "1 − q", "ts") + txt(98, 91, "r", "ts") + txt(98, 130, "1 − r", "ts");
  const outs = ["A and B", "A, not B", "not A, B", "not A, not B"]; leaves.forEach((l, i) => { s += txt(l[0] + 8, l[1] + 4, outs[i], "tx tl"); });
  return s + txt(120, 148, "p = P(A), q = P(B given A), r = P(B given not A)", "tx tm") + cap("multiply along branches, add outcomes", 166);
})();

// ── angles, polygons, bearings ─────────────────────────────────────────────
const headAt = (x: number, y: number, a: number, c = "l") => { const s = 7; return poly([[x, y], [x - s * Math.cos(a - 0.45), y - s * Math.sin(a - 0.45)], [x - s * Math.cos(a + 0.45), y - s * Math.sin(a + 0.45)]], HEADC[c] ?? "hd"); };
/** arc from maths-angle a1 to a2 (degrees) about (cx,cy) with an arrow head at a2; cw = clockwise on screen (a decreasing) */
const arcArrow = (cx: number, cy: number, r: number, a1: number, a2: number, cw: boolean, c = "a") => {
  const [x1, y1] = pt(cx, cy, r, a1), [x2, y2] = pt(cx, cy, r, a2), span = Math.abs(a2 - a1), large = span > 180 ? 1 : 0;
  const t = a2 * D2R, head = cw ? Math.atan2(Math.cos(t), Math.sin(t)) : Math.atan2(-Math.cos(t), -Math.sin(t));
  return path(`M${n(x1)} ${n(y1)} A${n(r)} ${n(r)} 0 ${large} ${cw ? 1 : 0} ${n(x2)} ${n(y2)}`, c) + headAt(x2, y2, head, c);
};
const bearingG = (() => {
  const A: P = [96, 112], B: P = [168.7, 70];
  return ln(A[0], A[1], A[0], 26, "l") + txt(96, 18, "N", "tb") + ln(A[0], A[1], B[0], B[1], "ar") + dot(A[0], A[1], 3.6) + dot(B[0], B[1], 3.6, "fr") + arcArrow(A[0], A[1], 30, 90, 30, true, "a")
    + txt(102, 66, "bearing", "ts ta tl") + txt(88, 126, "A", "ts te") + txt(176, 66, "B", "ts tl") + capm(["a bearing is measured clockwise from", "north and written with three figures"], 164);
})();
const reverseBearing = (() => {
  const A: P = [66, 124], B: P = [168, 60], th = Math.atan2(B[0] - A[0], A[1] - B[1]) / D2R; // bearing of B from A (degrees clockwise from north)
  return ln(A[0], A[1], A[0], 70, "l") + txt(66, 62, "N", "ts") + ln(B[0], B[1], B[0], 18, "l") + txt(168, 12, "N", "ts") + ln(B[0], B[1], B[0], 124, "h") + ln(A[0], A[1], B[0], B[1], "ar")
    + dot(A[0], A[1], 3.4) + dot(B[0], B[1], 3.4) + arcArrow(A[0], A[1], 24, 90, 90 - th, true, "a") + arcArrow(B[0], B[1], 24, 90, 90 - (th + 180), true, "ag")
    + txt(80, 100, "x", "ts ta") + txt(216, 96, "x + 180°", "ts tg te") + txt(58, 134, "A", "ts te") + txt(176, 56, "B", "ts tl") + capm(["reverse bearing: add 180° (or subtract", "180° if the bearing is 180° or more)"], 164);
})();
const angleNotation = (() => {
  const B: P = [70, 108], A: P = [190, 108], C = pt(B[0], B[1], 84, 60);
  return ln(B[0], B[1], A[0], A[1], "l") + ln(B[0], B[1], C[0], C[1], "l") + arc(B[0], B[1], 30, 0, 60, "ar") + dot(B[0], B[1], 4, "fr") + txt(196, 112, "A", "tb tl") + txt(C[0] + 2, C[1] - 6, "C", "tb tl") + txt(62, 124, "B", "tb te")
    + mt(120, 146, "∠ABC = the angle at B", "tb") + cap("the middle letter is the vertex", 164);
})();
const regPoly = (k: number, cx: number, cy: number, r: number, start: number): P[] => Array.from({ length: k }, (_, i) => pt(cx, cy, r, start + (360 / k) * i));
const intExt = (() => {
  const V = regPoly(5, 96, 74, 52, 90); // 90, 162, 234, 306, 18 degrees: the bottom edge (V2-V3) is horizontal
  const v = V[3], ext: P = [v[0] + 50, v[1]];
  return poly(V, "l f1") + ln(v[0], v[1], ext[0], ext[1], "l") + angMark(v, ext, V[4], 24, 1, "ar") + angMark(v, V[4], V[2], 14, 1, "ag") + txt(v[0] + 32, v[1] - 20, "exterior", "ts tr tl") + txt(v[0] - 10, v[1] - 28, "interior", "ts tg te")
    + capm(["interior angle + exterior angle = 180°", "(they lie on a straight line)"], 164);
})();
const polyAngleSum = (() => {
  const H = regPoly(6, 120, 70, 54, 90); let s = poly(H, "l f1");
  for (const k of [2, 3, 4]) s += ln(H[0][0], H[0][1], H[k][0], H[k][1], "h");
  return s + txt(120, 146, "a hexagon (n = 6) splits into 4 triangles", "tx tm") + mt(120, 160, "sum of interior angles = (n − 2) × 180°", "ts");
})();
const quadAngleSum = (() => {
  const Q: P[] = [[40, 118], [178, 118], [208, 48], [78, 26]]; let s = poly(Q, "l f1") + ln(Q[0][0], Q[0][1], Q[2][0], Q[2][1], "h");
  Q.forEach((p, i) => { s += angMark(p, Q[(i + 3) % 4], Q[(i + 1) % 4], 16, 1, "a", "abcd"[i]); });
  return s + txt(120, 140, "a + b + c + d = 360°", "ts") + cap("2 triangles in a quadrilateral: 2 × 180°", 164);
})();
const extTriangle = (() => {
  const A: P = [24, 116], B: P = [132, 116], C: P = [88, 42], D: P = [206, 116];
  return poly([A, B, C], "l f1") + ln(B[0], B[1], D[0], D[1], "l") + angMark(A, B, C, 20, 1, "a", "a") + angMark(C, A, B, 16, 1, "ag", "b") + angMark(B, C, D, 22, 1, "ar", "a + b") + capm(["an exterior angle of a triangle equals", "the sum of the two opposite interior angles"], 164);
})();

// ── circle theorems (one circle, centre O, radius 52; every mark is placed from the true geometry) ──
const O: P = [120, 78], RC = 52; const cp = (a: number): P => pt(O[0], O[1], RC, a);
const nm = (s: string, p: P, ang: number, d = 11, c = "ts") => { const [x, y] = pt(p[0], p[1], d, ang); return txt(x, y + 4, s, c); };
const ctBase = () => circ(O[0], O[1], RC, "l f0");
const ctCentre = (() => {
  const A = cp(210), B = cp(330), C = cp(90);
  return ctBase() + ln(O[0], O[1], A[0], A[1], "l") + ln(O[0], O[1], B[0], B[1], "l") + ln(C[0], C[1], A[0], A[1], "l") + ln(C[0], C[1], B[0], B[1], "l") + dot(O[0], O[1], 3)
    + angMark(O, A, B, 16, 1, "ar", "2x") + angMark(C, A, B, 14, 1, "a", "x") + nm("A", A, 210) + nm("B", B, 330) + nm("C", C, 90) + txt(O[0] + 6, O[1] - 4, "O", "tx tm tl") + capm(["the angle at the centre is twice the", "angle at the circumference"], 164);
})();
const ctSemi = (() => {
  const A = cp(180), B = cp(0), C = cp(68);
  return ctBase() + ln(A[0], A[1], B[0], B[1], "l") + ln(A[0], A[1], C[0], C[1], "l") + ln(B[0], B[1], C[0], C[1], "l") + dot(O[0], O[1], 3) + rightAngle(C[0], C[1], dir(C, A), dir(C, B), 10) + nm("A", A, 180) + nm("B", B, 0) + nm("C", C, 68) + txt(O[0], O[1] + 14, "O", "tx tm")
    + capm(["the angle in a semicircle is a", "right angle (AB is a diameter)"], 164);
})();
const ctSegment = (() => {
  const A = cp(215), B = cp(325), C = cp(58), D = cp(118);
  return ctBase() + ln(A[0], A[1], B[0], B[1], "h") + ln(A[0], A[1], C[0], C[1], "l") + ln(B[0], B[1], C[0], C[1], "l") + ln(A[0], A[1], D[0], D[1], "l") + ln(B[0], B[1], D[0], D[1], "l")
    + angMark(C, A, B, 18, 1, "a", "x") + angMark(D, A, B, 18, 1, "a", "x") + nm("A", A, 215) + nm("B", B, 325) + nm("C", C, 58) + nm("D", D, 118) + capm(["angles in the same segment", "(on the same chord AB) are equal"], 164);
})();
const ctCyclic = (() => {
  const A = cp(95), B = cp(205), C = cp(300), D = cp(15);
  return ctBase() + pline([A, B, C, D, A], "l") + angMark(A, D, B, 14, 1, "a", "a") + angMark(C, B, D, 14, 1, "a", "180°−a", "tx") + angMark(B, A, C, 14, 1, "ar", "b") + angMark(D, C, A, 14, 1, "ar", "180°−b", "tx")
    + nm("A", A, 95) + nm("B", B, 205) + nm("C", C, 300) + nm("D", D, 15) + capm(["a cyclic quadrilateral: opposite", "angles add up to 180°"], 164);
})();
const ctTangent = (() => {
  const T = cp(30), a: P = [T[0] - 23, T[1] - 40], b: P = [T[0] + 23, T[1] + 40], m = mid(O, T);
  return ctBase() + ln(a[0], a[1], b[0], b[1], "ar") + ln(O[0], O[1], T[0], T[1], "l") + dot(O[0], O[1], 3) + dot(T[0], T[1], 3.6, "fr") + rightAngle(T[0], T[1], dir(T, O), dir(T, a), 9)
    + txt(O[0] - 6, O[1] + 16, "O", "tx tm") + txt(m[0] - 4, m[1] + 14, "r", "ts tm te") + txt(T[0] + 24, T[1] - 34, "tangent", "ts tr tl") + capm(["a tangent to a circle is at right angles", "to the radius at the point of contact"], 164);
})();
const ctTwoTangents = (() => {
  const C0: P = [80, 78], r = 40, P0: P = [206, 78], phi = Math.acos(r / (P0[0] - C0[0])) / D2R;
  const T1 = pt(C0[0], C0[1], r, phi), T2 = pt(C0[0], C0[1], r, -phi);
  return circ(C0[0], C0[1], r, "l f0") + ln(P0[0], P0[1], T1[0], T1[1], "ar") + ln(P0[0], P0[1], T2[0], T2[1], "ar") + ln(C0[0], C0[1], T1[0], T1[1], "l") + ln(C0[0], C0[1], T2[0], T2[1], "l") + ln(C0[0], C0[1], P0[0], P0[1], "h")
    + dot(C0[0], C0[1], 3) + tick(P0, T1, 1) + tick(P0, T2, 1) + rightAngle(T1[0], T1[1], dir(T1, C0), dir(T1, P0), 8) + rightAngle(T2[0], T2[1], dir(T2, C0), dir(T2, P0), 8)
    + nm("A", T1, 100, 10) + nm("B", T2, -100, 10) + txt(P0[0] + 8, P0[1] + 4, "P", "ts tl") + txt(C0[0] - 4, C0[1] + 15, "O", "tx tm") + capm(["two tangents from a point P to a circle", "are equal in length: PA = PB"], 164);
})();
const ctAlternate = (() => {
  const A = pt(O[0], O[1], RC, 270), B = pt(O[0], O[1], RC, 30), Cc = pt(O[0], O[1], RC, 150);
  return ctBase() + ln(A[0] - 62, A[1], A[0] + 78, A[1], "ar") + ln(A[0], A[1], B[0], B[1], "l") + ln(A[0], A[1], Cc[0], Cc[1], "l") + ln(B[0], B[1], Cc[0], Cc[1], "l") + dot(A[0], A[1], 3.6, "fr")
    + angMark(A, [A[0] + 40, A[1]], B, 24, 1, "a", "x") + angMark(Cc, A, B, 18, 1, "a", "x") + nm("A", A, 225, 9) + nm("B", B, 30) + nm("C", Cc, 150) + txt(A[0] + 84, A[1] - 6, "tangent", "ts tr te")
    + capm(["the angle between a tangent and a chord", "equals the angle in the alternate segment"], 164);
})();
const ctChord = (() => {
  const yc = O[1] + 28, hx = Math.sqrt(RC * RC - 28 * 28), A: P = [O[0] - hx, yc], B: P = [O[0] + hx, yc], M: P = [O[0], yc];
  return ctBase() + ln(A[0], A[1], B[0], B[1], "l") + ln(O[0], O[1], M[0], M[1], "ar") + dot(O[0], O[1], 3) + dot(M[0], M[1], 3, "fr") + rightAngle(M[0], M[1], 90, 0, 9) + tick(A, M, 1) + tick(M, B, 1)
    + nm("A", A, 200) + nm("B", B, -20) + txt(M[0] + 8, M[1] + 14, "M", "ts tl") + txt(O[0] - 6, O[1] - 6, "O", "tx tm te") + capm(["the perpendicular from the centre to a", "chord bisects the chord (AM = MB)"], 164);
})();

// ── congruence, similarity, transformations, vectors ────────────────────────
const T1: P[] = [[22, 122], [98, 122], [50, 48]];               // scalene triangle
const mirror = (p: P): P => [240 - p[0], p[1]];                  // its reflection in the vertical line x = 120
const two = (T: P[], marks: (t: P[]) => string, cp2: string[]) => poly(T, "l f1") + poly(T.map(mirror), "l f3") + marks(T) + marks(T.map(mirror)) + capm(cp2, 164);
const congSSS = two(T1, (t) => tick(t[0], t[1], 1) + tick(t[1], t[2], 2) + tick(t[2], t[0], 3), ["SSS: three pairs of equal sides", "means the triangles are congruent"]);
const congSAS = two(T1, (t) => tick(t[0], t[1], 1) + tick(t[2], t[0], 2) + angMark(t[0], t[1], t[2], 16, 1, "ar"), ["SAS: two equal sides and the angle", "between them: the triangles are congruent"]);
const congASA = two(T1, (t) => angMark(t[0], t[1], t[2], 16, 1, "ar") + angMark(t[1], t[0], t[2], 16, 2, "ag") + tick(t[0], t[1], 1), ["ASA: two equal angles and the side", "between them: the triangles are congruent"]);
const congAAS = two(T1, (t) => angMark(t[0], t[1], t[2], 16, 1, "ar") + angMark(t[1], t[0], t[2], 16, 2, "ag") + tick(t[1], t[2], 1), ["AAS: two equal angles and a side not", "between them: the triangles are congruent"]);
const congRHS = (() => {
  const R1: P[] = [[22, 122], [98, 122], [98, 50]];
  return two(R1, (t) => rightAngle(t[1][0], t[1][1], dir(t[1], t[0]), dir(t[1], t[2]), 9) + tick(t[0], t[2], 2) + tick(t[1], t[2], 1), ["RHS: a right angle, the hypotenuse and one", "other side: the triangles are congruent"]);
})();
const scaleFactor = (() => {
  const a = 44, b = 28, k = 2;
  return rect(20, 124 - b, a, b, "l f1") + rect(96, 124 - k * b, k * a, k * b, "l f3") + txt(20 + a / 2, 138, "a", "ts") + txt(14, 124 - b / 2 + 4, "b", "ts te") + txt(96 + k * a / 2, 138, "ka", "ts") + txt(90, 124 - k * b / 2 + 4, "kb", "ts te")
    + txt(42, 88, "original", "ts tm") + txt(140, 60, "enlargement", "ts tm") + capm(["scale factor k = new length ÷ original length", "(each length is multiplied by k)"], 164);
})();
const turnDir = (() => {
  const dial = (cx: number, cy: number, cw: boolean, name: string) => circ(cx, cy, 40, "l f0") + txt(cx, cy - 26, "12", "tx tm") + txt(cx + 27, cy + 4, "3", "tx tm") + txt(cx, cy + 34, "6", "tx tm") + txt(cx - 27, cy + 4, "9", "tx tm") + (cw ? arcArrow(cx, cy, 24, 110, 10, true, "ag") : arcArrow(cx, cy, 24, 70, 170, false, "ar")) + txt(cx, cy + 62, name, "ts " + (cw ? "tg" : "tr"));
  return dial(62, 66, true, "clockwise") + dial(178, 66, false, "anticlockwise") + capm(["clockwise: the way clock hands turn;", "anticlockwise: the opposite way"], 164);
})();
const colVec = (() => {
  const A: P = [26, 118], B: P = [122, 50];
  return ln(A[0], A[1], B[0], A[1], "h") + ln(B[0], A[1], B[0], B[1], "h") + arrow(A[0], A[1], B[0], B[1], "a", 9) + dot(A[0], A[1], 3.6) + txt(74, 132, "a across", "ts") + txt(B[0] + 6, 88, "b up", "ts tl")
    + path("M186 34 Q176 66 186 98", "th2") + path("M226 34 Q236 66 226 98", "th2") + txt(206, 58, "a", "tb") + txt(206, 88, "b", "tb") + capm(["a column vector: a across, then b up", "(negative: left, down)"], 164);
})();
const vecAddSub = (() => {
  const a: P = [50, -40], b: P = [42, 20];
  const O1: P = [14, 112], P1: P = [O1[0] + a[0], O1[1] + a[1]], Q1: P = [P1[0] + b[0], P1[1] + b[1]];
  const O2: P = [138, 100], Pa: P = [O2[0] + a[0], O2[1] + a[1]], Pb: P = [O2[0] + b[0], O2[1] + b[1]];
  return arrow(O1[0], O1[1], P1[0], P1[1], "a", 8) + arrow(P1[0], P1[1], Q1[0], Q1[1], "ao", 8) + arrow(O1[0], O1[1], Q1[0], Q1[1], "ag", 8) + txt(28, 82, "a", "tb ta") + txt(96, 78, "b", "tb") + txt(70, 120, "a + b", "ts tg")
    + arrow(O2[0], O2[1], Pa[0], Pa[1], "a", 8) + arrow(O2[0], O2[1], Pb[0], Pb[1], "ao", 8) + arrow(Pb[0], Pb[1], Pa[0], Pa[1], "ar", 8) + txt(156, 70, "a", "tb ta") + txt(158, 126, "b", "tb") + txt(198, 92, "a − b", "ts tr tl")
    + capm(["a + b: place the arrows head to tail; a − b:", "join the head of b to the head of a"], 164);
})();
const vecMult = (() => {
  return arrow(30, 34, 80, 34, "a", 8) + txt(96, 38, "a", "tb tl") + arrow(30, 74, 130, 74, "a", 8) + txt(146, 78, "2a", "tb tl") + arrow(130, 114, 80, 114, "ar", 8) + txt(64, 118, "−a", "tb te")
    + capm(["2a: twice as long, same direction", "−a: same length, opposite direction"], 164);
})();

// ── area, circle and solid formulas ─────────────────────────────────────────
const compoundShape = (() => {
  const L: P[] = [[30, 24], [130, 24], [130, 66], [190, 66], [190, 122], [30, 122]];
  return rect(30, 24, 100, 42, "f1") + rect(30, 66, 160, 56, "f3") + poly(L, "l") + ln(30, 66, 130, 66, "h") + txt(80, 50, "A", "tb") + txt(110, 98, "B", "tb") + mt(120, 144, "area = area of A + area of B", "ts") + cap("split it into simpler shapes", 164);
})();
const triArea = (() => {
  const A: P = [22, 118], B: P = [150, 118], C: P = [92, 42], F: P = [92, 118];
  return poly([A, B, C], "l f1") + ln(C[0], C[1], F[0], F[1], "ar") + rightAngle(F[0], F[1], 180, 90, 9) + txt(86, 134, "base b", "ts") + txt(98, 84, "h", "tb tr tl") + mt(196, 62, "area =", "ts") + mt(196, 80, "½ × b × h", "tb") + cap("h is at right angles to the base", 164);
})();
const paraArea = (() => {
  const A: P = [30, 112], B: P = [140, 112], C: P = [194, 40], D: P = [84, 40], F: P = [84, 112];
  return poly([A, B, C, D], "l f1") + ln(D[0], D[1], F[0], F[1], "ar") + rightAngle(F[0], F[1], 0, 90, 9) + txt(110, 128, "base b", "ts") + txt(90, 80, "h", "tb tr tl") + mt(120, 146, "area = b × h", "tb") + cap("h is at right angles to the base", 164);
})();
const trapArea = (() => {
  const A: P = [26, 108], B: P = [196, 108], C: P = [152, 44], D: P = [70, 44], F: P = [70, 108];
  return poly([A, B, C, D], "l f1") + ln(D[0], D[1], F[0], F[1], "ar") + rightAngle(F[0], F[1], 0, 90, 9) + txt(111, 36, "a", "ts") + txt(111, 124, "b", "ts") + txt(76, 82, "h", "tb tr tl") + mt(120, 146, "area = ½ (a + b) × h", "tb") + cap("a and b are the parallel sides", 164);
})();
const circleFormulas = (() => {
  const C: P = [64, 76], r = 46, E = pt(C[0], C[1], r, 30);
  return circ(C[0], C[1], r, "l f1") + ln(C[0] - r, C[1], C[0] + r, C[1], "a") + ln(C[0], C[1], E[0], E[1], "ar") + dot(C[0], C[1], 3) + txt(C[0], C[1] + 14, "d", "ts ta") + txt(C[0] + 22, C[1] - 20, "r", "ts tr")
    + txt(126, 40, "circumference", "ts tm tl") + mt(126, 58, "C = πd = 2πr", "tb tl") + txt(126, 96, "area", "ts tm tl") + mt(126, 114, "A = πr²", "tb tl") + cap("d = 2r; π is about 3.14", 164);
})();
const sectorFormulas = (() => {
  const C: P = [50, 112], r = 62, a = pt(C[0], C[1], r, 8), b = pt(C[0], C[1], r, 78);
  return sector(C[0], C[1], r, 8, 78, "l f3") + arc(C[0], C[1], r, 8, 78, "ar") + angMark(C, a, b, 18, 1, "a", "θ") + txt(C[0] + 34, C[1] - 12, "r", "ts tm")
    + txt(128, 40, "arc length", "ts tm tl") + mt(128, 58, "θ ÷ 360 × 2πr", "ts tl") + txt(128, 92, "sector area", "ts tm tl") + mt(128, 110, "θ ÷ 360 × πr²", "ts tl") + cap("θ is the angle at the centre, in degrees", 164);
})();

// solids with formulas (cabinet-oblique / ellipse conventions of shapes3d.ts)
const cylForm = (() => {
  return `<path d="M26 40 V108 A34 10 0 0 0 94 108 V40 Z" class="l f1"/><path d="M26 108 A34 10 0 0 1 94 108" class="h"/>` + ell(60, 40, 34, 10, "l f3") + ln(60, 40, 94, 40, "ar") + dot(60, 40, 2.6) + txt(78, 36, "r", "ts tr") + ln(104, 40, 104, 108, "th2") + txt(110, 78, "h", "tb tl")
    + mt(122, 44, "V = πr²h", "tb tl") + txt(122, 68, "curved area", "ts tm tl") + mt(122, 82, "= 2πrh", "ts tl") + txt(122, 106, "top + bottom", "ts tm tl") + mt(122, 120, "= 2πr²", "ts tl") + cap("a cylinder: radius r, height h", 156);
})();
const coneForm = (() => {
  return `<path d="M60 20 L24 110 A36 10 0 0 0 96 110 Z" class="l f1"/><path d="M24 110 A36 10 0 0 1 96 110" class="h"/>` + ln(60, 20, 60, 110, "h") + ln(60, 110, 96, 110, "ar") + dot(60, 110, 2.6) + dot(60, 20, 3) + txt(99, 106, "r", "ts tr tl") + txt(64, 70, "h", "tb tl") + txt(86, 58, "l", "tb tl")
    + mt(122, 40, "V = ⅓πr²h", "tb tl") + txt(122, 62, "curved area", "ts tm tl") + mt(122, 75, "= πrl", "ts tl") + txt(122, 92, "base area", "ts tm tl") + mt(122, 105, "= πr²", "ts tl") + txt(122, 122, "l = slant height", "ts tm tl") + cap("cone: radius r, height h, slant height l", 156);
})();
const sphereForm = (() => {
  return circ(60, 76, 44, "l f1") + `<path d="M16 76 A44 12 0 0 0 104 76" class="th"/><path d="M16 76 A44 12 0 0 1 104 76" class="h"/>` + ln(60, 76, 91, 45, "ar") + dot(60, 76, 2.8) + txt(80, 56, "r", "ts tr")
    + mt(122, 56, "V = (4/3)πr³", "tb tl") + txt(122, 84, "surface area", "ts tm tl") + mt(122, 102, "= 4πr²", "tb tl") + cap("a sphere: radius r", 156);
})();
const pyrForm = (() => {
  const FL: P = [24, 116], FR: P = [88, 116], BR: P = [118, 96], BL: P = [54, 96], AP: P = [70, 22], BC: P = [(24 + 88 + 118 + 54) / 4, (116 + 116 + 96 + 96) / 4];
  return poly([FL, FR, BR, BL], "f3") + poly([FL, FR, AP], "l f1") + poly([FR, BR, AP], "l f4") + ln(BL[0], BL[1], FL[0], FL[1], "h") + ln(BL[0], BL[1], BR[0], BR[1], "h") + ln(BL[0], BL[1], AP[0], AP[1], "h") + ln(AP[0], AP[1], BC[0], BC[1], "ar") + dot(BC[0], BC[1], 2.6) + dot(AP[0], AP[1], 3)
    + txt(44, 58, "h", "tb te") + ln(48, 54, 69, 54, "th") + mt(128, 48, "V = ⅓ ×", "tb tl") + mt(128, 68, "base area × h", "ts tl") + cap("a pyramid: h is the perpendicular height", 156);
})();
const prismForm = (() => {
  const F: P[] = [[24, 116], [104, 116], [64, 60]], e: P = [40, -26];
  const Bk = F.map((p): P => [p[0] + e[0], p[1] + e[1]]);
  return poly(F, "l f3") + poly([F[1], F[2], Bk[2], Bk[1]], "l f4") + ln(F[2][0], F[2][1], Bk[2][0], Bk[2][1], "l") + ln(F[0][0], F[0][1], Bk[0][0], Bk[0][1], "h") + ln(Bk[0][0], Bk[0][1], Bk[1][0], Bk[1][1], "h") + ln(Bk[0][0], Bk[0][1], Bk[2][0], Bk[2][1], "h")
    + txt(52, 138, "cross-section", "ts") + ln(56, 128, 62, 106, "th") + txt(124, 48, "length l", "ts tl") + mt(120, 16, "V = area of cross-section × l", "ts") + cap("same cross-section all along the prism", 164);
})();

const frustumG = (() => {
  return `<path d="M22 112 L48 56 L92 56 L118 112 A48 12 0 0 1 22 112 Z" class="l f1"/><path d="M22 112 A48 12 0 0 1 118 112" class="h"/>` + ln(48, 56, 70, 12, "h") + ln(92, 56, 70, 12, "h") + ell(70, 56, 22, 6, "l f3") + ln(70, 56, 70, 112, "h")
    + ln(70, 112, 118, 112, "ar") + ln(70, 56, 92, 56, "ar") + txt(122, 116, "R", "ts tr tl") + txt(96, 60, "r", "ts tr tl") + txt(62, 88, "h", "tb te")
    + txt(136, 30, "frustum:", "ts tm tl") + txt(136, 44, "a cone with the", "ts tm tl") + txt(136, 58, "top cut off", "ts tm tl") + txt(136, 84, "volume or curved", "ts tl") + txt(136, 97, "surface area =", "ts tl") + txt(136, 112, "big cone", "ts tl") + txt(136, 125, "− small cone", "ts tl")
    + cap("dashed: the small cone that was removed", 156);
})();
const netCylinder = (() => {
  const r = 20.37, w = 128, x0 = 56, y0 = 48, h = 50;
  return rect(x0, y0, w, h, "l f1") + circ(x0 + 34, y0 - r, r, "l f3") + circ(x0 + w - 34, y0 + h + r, r, "l f3") + txt(x0 + w / 2, y0 + h / 2 + 4, "curved surface", "ts") + txt(x0 + 34, y0 - r + 4, "circle", "tx") + txt(x0 + w - 34, y0 + h + r + 4, "circle", "tx")
    + cap("net of a cylinder: a rectangle and two circles", 164);
})();
const netCuboid = (() => {
  const c = (x: number, y: number, w: number, h: number, k: string) => rect(x, y - 8, w, h, k);
  return c(95, 50, 50, 32, "l f1") + c(95, 24, 50, 26, "l f3") + c(95, 82, 50, 26, "l f3") + c(69, 50, 26, 32, "l f4") + c(145, 50, 26, 32, "l f4") + c(95, 108, 50, 32, "l f1") + cap("a net of a cuboid: 6 rectangles (opposite pairs match)", 164);
})();
const netTriPrism = (() => {
  const x0 = 70, y0 = 44, L = 60, wb = 44, ws = 34, hgt = Math.sqrt(ws * ws - (wb / 2) ** 2);
  return rect(x0, y0, wb, L, "l f1") + rect(x0 + wb, y0, ws, L, "l f3") + rect(x0 + wb + ws, y0, ws, L, "l f3") + poly([[x0, y0], [x0 + wb, y0], [x0 + wb / 2, y0 - hgt]], "l f4") + poly([[x0, y0 + L], [x0 + wb, y0 + L], [x0 + wb / 2, y0 + L + hgt]], "l f4")
    + cap("net of a triangular prism: 3 rectangles and 2 triangles", 164);
})();
const netPyramid = (() => {
  const s = 44, cx = 120, cy = 78, h = 40; const x0 = cx - s / 2, y0 = cy - s / 2;
  return rect(x0, y0, s, s, "l f1") + poly([[x0, y0], [x0 + s, y0], [cx, y0 - h]], "l f3") + poly([[x0, y0 + s], [x0 + s, y0 + s], [cx, y0 + s + h]], "l f3") + poly([[x0, y0], [x0, y0 + s], [x0 - h, cy]], "l f3") + poly([[x0 + s, y0], [x0 + s, y0 + s], [x0 + s + h, cy]], "l f3")
    + cap("net of a square-based pyramid: 1 square, 4 triangles", 164);
})();

// ── trigonometry ────────────────────────────────────────────────────────────
const trigRatios = (() => {
  const A: P = [8, 122], B: P = [100, 122], C: P = [100, 52];
  return poly([A, B, C], "l f1") + rightAngle(B[0], B[1], 180, 90, 10) + angMark(A, B, C, 26, 1, "ar", "θ") + txt(54, 138, "adjacent", "ts") + `<text x="110" y="90" class="t ts" transform="rotate(-90 110 90)">opposite</text>` + `<text x="42" y="80" class="t ts" transform="rotate(-37.1 42 80)">hypotenuse</text>`
    + mt(126, 44, "sin θ = opp ÷ hyp", "ts tl") + mt(126, 72, "cos θ = adj ÷ hyp", "ts tl") + mt(126, 100, "tan θ = opp ÷ adj", "ts tl") + txt(126, 128, "SOH  CAH  TOA", "ts tm tl") + cap("right-angled triangle: θ is acute", 164);
})();
const triLabels = (() => {
  const A: P = [28, 116], B: P = [196, 116], C: P = [130, 30]; return { A, B, C };
})();
const sineRule = (() => {
  const { A, B, C } = triLabels;
  return poly([A, B, C], "l f1") + txt(A[0] - 6, A[1] + 4, "A", "tb te") + txt(B[0] + 6, B[1] + 4, "B", "tb tl") + txt(C[0], C[1] - 8, "C", "tb") + txt(176, 70, "a", "tb ta tl") + txt(70, 70, "b", "tb ta te") + txt(112, 132, "c", "tb ta")
    + mt(120, 156, "a ÷ sin A = b ÷ sin B = c ÷ sin C", "ts");
})();
const cosineRule = (() => {
  const { A, B, C } = triLabels;
  return poly([A, B, C], "l f1") + angMark(A, B, C, 20, 1, "ar") + txt(A[0] - 6, A[1] + 4, "A", "tb te") + txt(B[0] + 6, B[1] + 4, "B", "tb tl") + txt(C[0], C[1] - 8, "C", "tb") + txt(176, 70, "a", "tb ta tl") + txt(70, 70, "b", "tb ta te") + txt(112, 132, "c", "tb ta")
    + mt(120, 156, "a² = b² + c² − 2bc cos A", "ts");
})();
const areaSine = (() => {
  const { A, B, C } = triLabels;
  return poly([A, B, C], "l f1") + angMark(C, A, B, 20, 1, "ar") + txt(A[0] - 6, A[1] + 4, "A", "tb te") + txt(B[0] + 6, B[1] + 4, "B", "tb tl") + txt(C[0], C[1] - 8, "C", "tb") + txt(176, 70, "a", "tb ta tl") + txt(70, 70, "b", "tb ta te") + txt(112, 132, "c", "tb ta")
    + mt(120, 156, "area = ½ ab sin C", "ts");
})();
// formula triangles
const fTriangle = (top: string, bl: string, br: string, lines: string[]) => {
  const T: P = [120, 20], L: P = [64, 116], R: P = [176, 116];
  return poly([T, L, R], "l f1") + ln(92, 68, 148, 68, "l") + ln(120, 68, 120, 116, "l") + txt(120, 54, top, "tb") + txt(92, 100, bl, "tb") + txt(148, 100, br, "tb") + capm(lines, 164);
};
const sdtTri = fTriangle("D", "S", "T", ["cover the one you want to find:", "D = S × T,  S = D ÷ T,  T = D ÷ S"]);
const denTri = fTriangle("M", "D", "V", ["cover the one you want to find:", "M = D × V,  D = M ÷ V,  V = M ÷ D"]);
const presTri = fTriangle("F", "P", "A", ["cover the one you want to find:", "F = P × A,  P = F ÷ A,  A = F ÷ P"]);
const compoundMeas = (() => {
  const rows: [string, string][] = [["speed", "distance ÷ time"], ["density", "mass ÷ volume"], ["pressure", "force ÷ area"]]; let s = "";
  rows.forEach(([a, b], i) => { const y = 34 + i * 40; s += rect(10, y - 16, 74, 28, "l f1", 6) + txt(47, y + 3, a, "ts") + txt(92, y + 4, "=", "tb") + rect(106, y - 16, 124, 28, "l f3", 6) + txt(168, y + 3, b, "ts"); });
  return s + cap("a compound measure is one quantity divided by another", 164);
})();
const propFormulas = (() => {
  const panel = (ox: number, direct: boolean) => { const tr = (x: number, y: number): P => [ox + 10 + x * 24, 108 - y * 24]; let s = ax(ox + 10, 108, ox + 4, ox + 108, 114, 14);
    s += direct ? ln(ox + 10, 108, ox + 100, 42, "a") : curve((x) => 1.4 / x, 0.4, 3.6, 0.05, tr);
    return s + mt(ox + 60, 132, direct ? "y = kx" : "y = k ÷ x", "tb") + txt(ox + 60, 146, direct ? "directly proportional" : "inversely proportional", "tx tm"); };
  return panel(4, true) + panel(126, false) + cap("k is the constant of proportionality", 164);
})();

// ── statistics: scatter, sampling ───────────────────────────────────────────
const SCX = [50, 64, 80, 95, 108, 122, 136, 150, 165, 180, 192], SCN = [-8, 5, -4, 9, -7, 4, -9, 6, -3, 7, -5];
const trend = (x: number) => 118 - 0.55 * (x - 40);
const scatterOutlier = (() => {
  let s = ax(36, 130, 30, 224, 136, 12) + ln(44, trend(44), 204, trend(204), "th2");
  SCX.forEach((x, i) => { if (i !== 7) s += dot(x, trend(x) + SCN[i], 3.2, "fs"); });
  const o: P = [150, 108];
  return s + dot(o[0], o[1], 3.4, "fr") + `<circle cx="150" cy="108" r="9" class="h" fill="none"/>` + txt(172, 112, "outlier", "ts tr tl") + cap("an outlier does not fit the pattern of the other points", 164);
})();
const scatterInterp = (() => {
  const xs = [74, 88, 102, 116, 130, 144, 158], ns = [-6, 5, -4, 7, -7, 4, -3];
  let s = rect(70, 14, 92, 118, "f6") + ax(36, 130, 30, 224, 136, 12) + ln(44, trend(44), 214, trend(214), "th2");
  xs.forEach((x, i) => { s += dot(x, trend(x) + ns[i], 3.2, "fs"); });
  return s + txt(116, 26, "interpolation", "ts") + txt(226, 112, "extrapolation", "ts tr te") + capm(["interpolation: inside the range of the data;", "extrapolation: outside it (less reliable)"], 164);
})();
const popSample = (() => {
  const C: P = [120, 70]; let s = circ(C[0], C[1], 52, "l f0"); const pick = new Set([3, 8, 11, 17, 22, 26, 29]);
  for (let i = 1; i <= 30; i++) { const rr = 45 * Math.sqrt(i / 30), th = i * 137.508; const p = pt(C[0], C[1], rr, th); s += pick.has(i) ? dot(p[0], p[1], 4.4, "fr") : dot(p[0], p[1], 3, "fs"); }
  return s + txt(120, 12, "population", "ts tm") + txt(120, 134, "red dots: the sample", "tx tr") + capm(["a sample is a smaller group chosen", "from the whole population"], 164);
})();
const strataG = (() => {
  const g: [number, number, string, string][] = [[20, 60, "l f1", "A"], [80, 40, "l f3", "B"], [120, 100, "l f2", "C"]]; let s = "";
  g.forEach(([x, w, c, l]) => { s += rect(x, 30, w, 66, c) + txt(x + w / 2, 24, l, "ts"); });
  const dots: P[] = [[34, 50], [50, 76], [66, 58], [92, 48], [108, 78], [134, 44], [152, 78], [170, 52], [188, 80], [206, 50]];
  return s + dots.map((p) => dot(p[0], p[1], 4.2, "fr")).join("") + txt(120, 118, "red dots: the sample", "tx tr") + capm(["stratified sample: each group is sampled", "in proportion to its size in the population"], 164);
})();

// ── loci and constructions ──────────────────────────────────────────────────
const locusTypes = (() => {
  const p = (ox: number, oy: number, body: (cx: number, cy: number) => string, l1: string, l2: string) => rect(ox, oy, 112, 46, "l f0", 4) + body(ox + 56, oy + 23) + txt(ox + 56, oy + 60, l1, "tx") + txt(ox + 56, oy + 71, l2, "tx");
  const ang = (cx: number, cy: number, a: number, r: number) => { const q = pt(cx, cy, r, a), q2 = pt(cx, cy, r, a + 180); return ln(q[0], q[1], q2[0], q2[1], "l"); };
  const bis = (cx: number, cy: number, a: number, r: number) => { const q = pt(cx, cy, r, a), q2 = pt(cx, cy, r, a + 180); return ln(q[0], q[1], q2[0], q2[1], "a"); };
  return p(4, 4, (cx, cy) => circ(cx, cy, 17, "a") + dot(cx, cy, 3, "fr") + txt(cx + 5, cy - 4, "P", "tx tl"), "a fixed distance", "from a point")
    + p(124, 4, (cx, cy) => ln(cx, cy - 22, cx, cy + 22, "a") + dot(cx - 36, cy, 3, "fr") + dot(cx + 36, cy, 3, "fr") + txt(cx - 36, cy - 6, "A", "tx") + txt(cx + 36, cy - 6, "B", "tx"), "equidistant from", "two points A and B")
    + p(4, 82, (cx, cy) => ln(cx - 48, cy, cx + 48, cy, "l") + ln(cx - 48, cy - 14, cx + 48, cy - 14, "a") + ln(cx - 48, cy + 14, cx + 48, cy + 14, "a"), "a fixed distance", "from a line")
    + p(124, 82, (cx, cy) => ang(cx, cy, 20, 26) + ang(cx, cy, 70, 26) + bis(cx, cy, 45, 24) + bis(cx, cy, 135, 24), "equidistant from", "two lines");
})();
const perpBisector = (() => {
  const A: P = [60, 74], B: P = [180, 74], r = 78, ph = Math.atan2(Math.sqrt(r * r - 60 * 60), 60) / D2R;
  return ln(A[0], A[1], B[0], B[1], "l") + arc(A[0], A[1], r, ph - 13, ph + 13, "th2") + arc(A[0], A[1], r, -ph - 13, -ph + 13, "th2") + arc(B[0], B[1], r, 180 - ph - 13, 180 - ph + 13, "th2") + arc(B[0], B[1], r, 180 + ph - 13, 180 + ph + 13, "th2")
    + ln(120, 14, 120, 134, "ar") + dot(A[0], A[1], 3.4) + dot(B[0], B[1], 3.4) + dot(120, 74, 3, "fr") + rightAngle(120, 74, 0, 90, 9) + tick(A, [120, 74], 1) + tick([120, 74], B, 1)
    + txt(A[0] - 6, A[1] + 15, "A", "ts te") + txt(B[0] + 6, B[1] + 15, "B", "ts tl") + txt(126, 90, "M", "ts tl") + capm(["the perpendicular bisector of AB cuts", "it in half at right angles"], 164);
})();
const angleBisector = (() => {
  const Ov: P = [36, 124], P1 = pt(Ov[0], Ov[1], 46, 0), Q1 = pt(Ov[0], Ov[1], 46, 70), t = 67.75, Rr = pt(Ov[0], Ov[1], t, 35), e = pt(Ov[0], Ov[1], 130, 35), a1 = pt(Ov[0], Ov[1], 140, 70);
  const dp = dir(P1, Rr), dq = dir(Q1, Rr);
  return ln(Ov[0], Ov[1], 214, Ov[1], "l") + ln(Ov[0], Ov[1], a1[0], a1[1], "l") + arc(Ov[0], Ov[1], 46, 0, 70, "th2") + arc(P1[0], P1[1], 40, dp - 12, dp + 12, "th2") + arc(Q1[0], Q1[1], 40, dq - 12, dq + 12, "th2")
    + ln(Ov[0], Ov[1], e[0], e[1], "ar") + dot(Ov[0], Ov[1], 3.4) + angMark(Ov, P1, Rr, 28, 1, "a", "x") + angMark(Ov, Rr, Q1, 28, 1, "a", "x") + capm(["an angle bisector cuts an angle into", "two equal parts (x and x)"], 164);
})();
const E1: Pic[] = [
  mk("cubic-graph", "Cubic graph", ["cubic graph", "cubic function", "cubic curve"], cubicG, "A cubic graph: an S-shaped curve crossing the x-axis three times (green dots are the roots) with two turning points (red dots), one a local maximum and one a local minimum.", "A cubic graph",
    "Oak (KS4) keyword 'cubic': an equation, graph or sequence whose highest exponent is 3. Drawn: y = x³ − 3x; roots at 0 and ±√3 (exact), turning points at (−1, 2) and (1, −2) from the derivative 3x² − 3 = 0.", { avoid: ["cubic centimetre", "cubic metre", "cubic unit", "cube root", "cube number"], doesNotShow: "a negative x³ term (mirror image); a cubic with fewer than 3 roots; the equation" }),
  mk("reciprocal-graph", "Reciprocal graph", ["reciprocal graph", "reciprocal function", "reciprocal curve"], recipG, "A reciprocal graph: two smooth curves, one in the top-right and one in the bottom-left, that get closer and closer to the axes but never touch them.", "A reciprocal graph",
    "Oak KS4 lessons 'Drawing reciprocal graphs' / 'Key features of a reciprocal graph'; Oak keyword 'asymptote': a line a curve approaches but never touches. Drawn: y = 1/x for |x| from 0.42 to 4.6; the axes are the asymptotes.", { avoid: ["reciprocal of a number", "multiplicative inverse"], doesNotShow: "y = k/x with negative k; the equation; translations of the graph" }),
  mk("exponential-graph", "Exponential graph", ["exponential graph", "exponential function", "exponential curve", "exponential growth", "exponential decay"], expG, "Two exponential curves that both pass through the same point on the y-axis: a growth curve rising ever more steeply on the right, and a decay curve falling towards the x-axis on the right; neither touches the x-axis.", "An exponential graph",
    "Oak KS4 keyword 'exponential': general form y = ab^x (a the coefficient, b the base). Drawn: a = 1, y = 1.7^x (growth, b > 1) and y = 1.7^(−x) (decay, 0 < b < 1); both pass through (0, 1) (gold dot) and approach y = 0.", { avoid: ["exponential form"], doesNotShow: "values on the axes; a ≠ 1; negative b" }),
  mk("y-mx-c", "y = mx + c", ["y = mx + c", "equation of a line", "equation of a straight line", "equation of the line", "straight line equation"], ymxc, "A straight-line graph labelled y = mx + c: the gradient m is rise over run (a small triangle) and c is where the line crosses the y-axis (red dot).", "y = mx + c",
    "Oak KS3 Y8 lesson 'Finding the equation of the line y = mx + c'. m = change in y ÷ change in x (rise ÷ run); c = y-intercept (Oak keyword 'intercept': where a line meets an axis). The rise/run triangle lies exactly on the drawn line.", { avoid: ["ay bx c", "curve", "quadratic", "perpendicular", "negative gradient", "vertical line"], doesNotShow: "negative gradients; other forms of the equation of a line; numbers" }),
  mk("horizontal-vertical-lines", "Horizontal and vertical lines", ["vertical and horizontal graphs", "horizontal and vertical graphs", "vertical and horizontal lines", "horizontal and vertical lines", "vertical graph", "horizontal graph"], hvG, "Coordinate axes with a horizontal line labelled y = b and a vertical line labelled x = a.", "Horizontal and vertical lines",
    "Oak KS4 lesson 'Drawing vertical and horizontal graphs'. Every point on a horizontal line has the same y-value (y = b); every point on a vertical line has the same x-value (x = a). Drawn: exactly horizontal and exactly vertical lines.", { doesNotShow: "the values of a and b; diagonal lines" }),
  mk("direct-proportion-graph", "Direct proportion graph", ["direct proportion graph", "graph of direct proportion", "graphing direct proportion", "graphs showing direct proportion", "graph showing direct proportion"], directG, "A straight-line graph that starts at the origin and rises, labelled y = kx: direct proportion.", "Direct proportion graph",
    "Oak keyword 'direct proportion': two variables with a constant multiplicative relationship, so y = kx. The graph is a straight line through the origin (0 gives 0), gradient k. Drawn: line from the origin.", { doesNotShow: "the value of k; inverse proportion" }),
  mk("inverse-proportion-graph", "Inverse proportion graph", ["inverse proportion graph", "graph of inverse proportion", "graphs showing inverse proportion", "graph showing inverse proportion"], inverseG, "A curve in the first quadrant that falls from the top-left towards the x-axis and never touches either axis, labelled y = k ÷ x: inverse proportion.", "Inverse proportion graph",
    "Oak keyword 'inverse proportion': a constant multiplicative relationship between one variable and the reciprocal of the other, so y = k/x. For positive x and k the graph is a decreasing curve approaching, but never touching, the axes. Drawn: y = 1.6/x.", { doesNotShow: "negative x-values (the other branch); the value of k; direct proportion" }),
  mk("speed-time-graph", "Speed-time graph", ["speed-time graph", "speed time graph", "velocity-time graph", "velocity time graph"], speedTime, "A speed-time graph: a rising line for speeding up, a flat line for steady speed and a falling line for slowing down, with the area under the graph shaded.", "Speed-time graph",
    "Oak KS4 lesson 'Speed-time graphs': the gradient of a speed-time graph is the acceleration (Oak: acceleration is the rate of change of speed) and the area under it is the distance travelled. Drawn: straight-line segments up, flat and down.", { avoid: ["non-linear", "nonlinear", "curve", "curved", "distance-time", "distance time"], doesNotShow: "curved (non-uniform acceleration) graphs; values on the axes" }),
  mk("unit-circle", "Unit circle", ["unit circle", "sine function", "cosine function"], unitCircle, "The unit circle: a circle of radius 1 centred on the origin; the point P at angle theta on the circle has coordinates (cos theta, sin theta).", "The unit circle",
    "Oak KS3/KS4 lessons 'The unit circle' and 'Scaling the right-angled triangle from the unit circle'. On the unit circle, the radius to P makes angle θ with the x-axis and P = (cos θ, sin θ). Drawn: P at 40 degrees, exact coordinates from the circle.", { avoid: ["tangent function", "graph", "without a unit circle", "not the unit circle", "without the unit circle"], doesNotShow: "angles beyond 90 degrees; the tangent line; specific values" }),
  mk("circle-equation", "Equation of a circle", ["equation of a circle", "equation of the circle", "circle equation"], circleEq, "A circle centred on the origin with radius r; a point (x, y) on the circle forms a right-angled triangle with sides x, y and hypotenuse r, giving x squared plus y squared equals r squared.", "Circle, centre the origin",
    "Pythagoras' theorem on the right-angled triangle formed by the radius, x and y gives x² + y² = r² for a circle centred on the origin (standard GCSE result). Drawn: the point at 36 degrees exactly on the circle.", { avoid: ["translated"], doesNotShow: "circles not centred on the origin; numbers" }),
  mk("gradient-of-curve", "Gradient of a curve", ["gradient of a curve", "gradient of the curve", "tangent to a curve", "tangent to the curve"], gradCurve, "A curve with a straight tangent line touching it at a point P and a dashed chord from P to a second point Q on the curve.", "Gradient of a curve",
    "Oak KS4 lessons 'Estimating the gradient of a curve' / 'Improving the estimate of the gradient of a curve': the gradient at a point is the gradient of the tangent there; a chord to a nearby point gives an estimate. Drawn: y = 90((x−30)/170)² with its tangent at x = 112 (slope computed exactly).", { doesNotShow: "numerical gradients; calculus notation" }),
  mk("graph-transformations", "Transforming graphs", ["transforming graphs", "graph transformation", "transformations of graphs", "transformation of graphs"], graphTf, "Four small graphs of y = f(x) (dotted) and its transformation (blue): y = f(x) + a moves it up, y = f(x + a) moves it left, y = minus f(x) flips it over the x-axis and y = f(minus x) flips it over the y-axis.", "Transforming graphs (a > 0)",
    "Standard GCSE results for a > 0: f(x) + a translates up by a; f(x + a) translates left by a; −f(x) reflects in the x-axis; f(−x) reflects in the y-axis (Oak KS4 unit 'Transformations of graphs'). Drawn with the asymmetric curve exp(−1.6(x − 0.6)²) so each change is unambiguous.", { avoid: ["y af x", "y f ax", "stretch"], doesNotShow: "stretches; combined transformations; numerical values of a" }),
  mk("graph-stretches", "Stretching graphs", ["y = af(x)", "y = f(ax)", "stretching graphs", "graph stretch"], graphStretch, "Two graphs of y = f(x) (dotted) and its stretch (blue): y = a f(x) makes it taller (a vertical stretch by factor a) and y = f(ax) makes it narrower (a horizontal stretch by factor 1 over a); both drawn for a greater than 1.", "Stretching graphs",
    "Standard GCSE results: y = af(x) is a stretch parallel to the y-axis, scale factor a; y = f(ax) is a stretch parallel to the x-axis, scale factor 1/a (Oak KS4 'Transforming graphs: y = af(x)', 'y = f(ax)'). Drawn for a = 1.6 and a = 2 on the same base curve.", { doesNotShow: "translations and reflections; 0 < a < 1" }),
  mk("inequality-number-line", "Inequalities on number lines", ["inequalities on number lines", "inequalities on a number line", "inequality on a number line", "inequality on number lines"], ineqLines, "Four number lines showing x greater than a, x greater than or equal to a, x less than a and x less than or equal to a: an open circle when a is not included and a closed circle when it is, with an arrow in the direction of the solutions.", "Inequalities on number lines",
    "Oak KS4 lesson 'Inequalities on number lines'. Convention: open circle = end point not included (< or >), closed circle = included (≤ or ≥); arrow towards the values satisfying the inequality. Drawn: the four cases about the same point a.", { avoid: ["error interval", "double number line"], doesNotShow: "numerical values; two-sided inequalities" }),
  mk("inequality-region", "Regions on a graph", ["inequalities graphically", "graphical inequalities", "inequalities on a graph", "linear inequalities graphically", "inequality graphically"], ineqRegion, "Two graphs: on the left a dashed line with the region above it shaded (y greater than mx + c); on the right a solid line with the region below it shaded (y less than or equal to mx + c).", "Regions on a graph",
    "Standard GCSE convention: dashed boundary for < or > (points on the line not included), solid boundary for ≤ or ≥ (included); the shaded side satisfies the inequality. Drawn: the same line y = mx + c with each side shaded once. Only used where the slide is about shaded regions.", { requires: ["region", "shade", "shaded", "shading", "boundary"], avoid: ["quadratic", "curve", "circle"], doesNotShow: "which side is required for a given question; numerical lines; quadratic regions" }),
  mk("simultaneous-graph", "Simultaneous equations graphically", ["simultaneous linear equations graphically", "simultaneous equations graphically", "solving simultaneous equations graphically"], simulG, "Two straight lines drawn on axes, crossing at one marked point: the coordinates of that point are the solution of the simultaneous equations.", "Solving graphically",
    "Oak KS4 lesson 'Solving simultaneous linear equations graphically': the solution is the point where the graphs of the two equations cross. Drawn: two lines with different gradients meeting at one point (exact intersection computed).", { avoid: ["quadratic", "circle", "curve", "elimination", "substitution"], doesNotShow: "the coordinates; parallel (no solution) or identical lines" }),
  mk("function-machine", "Function machine", ["function machine"], funcMachine, "A function machine: an arrow labelled input goes into a box labelled function (a rule) and an arrow labelled output comes out.", "A function machine",
    "Oak keyword 'function': a relationship that uniquely maps each input value to an output value. A function machine shows one input, one rule, one output. Drawn: input arrow, rule box, output arrow (no rule shown).", { avoid: ["inverse", "composite"], doesNotShow: "any particular rule; several steps" }),
  mk("inverse-function", "Inverse function", ["inverse function", "finding the inverse of a function", "inverse of a function"], inverseF, "Two function machines: f takes x to y, and the inverse function f minus 1 takes y back to x, with the arrows running the opposite way.", "The inverse function",
    "Oak keyword 'inverse function': reverses the mapping of the original function, so f⁻¹(f(x)) = x. Drawn: f from x to y (top), f⁻¹ from y back to x (bottom, arrows reversed).", { doesNotShow: "how to find f⁻¹; graphs of inverse functions" }),
  mk("composite-function", "Composite function", ["composite function"], compositeF, "Two function machines joined: x goes into g, the output g of x goes into f, giving fg of x equals f of g of x.", "A composite function",
    "Standard notation: fg(x) = f(g(x)), the function g is applied first, then f (Oak KS4 lesson 'Writing composite functions'). Drawn: x → g → g(x) → f.", { avoid: ["composite shape", "composite rectilinear", "composite number", "gf"], doesNotShow: "any particular functions; gf(x)" }),
  mk("arithmetic-sequence", "Arithmetic sequence", ["arithmetic sequence", "linear sequence", "common difference", "arithmetic linear sequence", "arithmetic progression"], arithSeq, "Four boxes t1 to t4 with curved arrows labelled plus d between each pair: an arithmetic sequence adds the same amount, the common difference, each time.", "An arithmetic sequence",
    "Oak keyword 'arithmetic sequence': the difference between successive terms is a constant (also called a linear sequence). Drawn: t1 to t4 with + d on every step.", { doesNotShow: "any particular numbers; the nth term formula" }),
  mk("geometric-sequence", "Geometric sequence", ["geometric sequence", "common ratio", "geometric progression"], geoSeq, "Four boxes t1 to t4 with curved arrows labelled times r between each pair: a geometric sequence multiplies by the same amount, the common ratio, each time.", "A geometric sequence",
    "Oak keywords 'geometric sequence' (constant multiplicative relationship between successive terms) and 'common ratio' (the constant multiplier). Drawn: t1 to t4 with × r on every step.", { avoid: ["common ratio of a", "ratio and proportion"], doesNotShow: "any particular numbers; the nth term formula" }),
  mk("quadratic-sequence", "Quadratic sequence", ["quadratic sequence", "second difference"], quadSeq, "The sequence 2, 5, 10, 17 with its first differences 3, 5, 7 and its second differences 2, 2 which are constant.", "A quadratic sequence",
    "A quadratic sequence has a constant second difference (Oak KS4 lesson 'Quadratic sequences'). Drawn as an example: 2, 5, 10, 17 (n² + 1); first differences 3, 5, 7; second differences 2, 2 (checked).", { numeric: true, doesNotShow: "the nth term of the sequence" }),
  mk("nth-term", "nth term", ["nth term", "n th term"], nthTerm, "A table: the positions 1, 2, 3, 4 with the terms 4, 7, 10, 13 beneath and the rule nth term equals 3n plus 1.", "The nth term",
    "Oak keyword 'nth term': the position of a term in a sequence, n standing for the term number. Example drawn: nth term = 3n + 1 gives 4, 7, 10, 13 (checked).", { numeric: true, doesNotShow: "how to find the rule" }),
  mk("factor-tree", "Factor tree", ["factor tree", "prime factor tree", "prime factorisation", "prime factorization", "product of prime factors", "product of its prime factors", "product of primes", "prime factor"], factorTree, "A factor tree for 60: 60 splits into 6 and 10, 6 into 2 and 3, 10 into 2 and 5; the prime factors 2, 3, 2 and 5 at the ends are shaded green.", "A factor tree",
    "Oak keyword 'prime factorisation'/'product of primes': write a number as a product of prime numbers. Example checked: 60 = 6 × 10 = (2 × 3) × (2 × 5) = 2 × 2 × 3 × 5.", { numeric: true, doesNotShow: "any other number; index notation" }),
  mk("set-notation", "Set notation", ["set notation", "union of two sets", "intersection of two sets", "complement of a set", "universal set"], setNotation, "Four Venn diagrams inside a rectangle for the universal set: the overlap of A and B shaded (A intersection B), both circles shaded (A union B), everything outside A shaded (A complement) and everything outside both shaded (the complement of A union B).", "Set notation on Venn diagrams",
    "Standard set notation (Oak KS4 lesson 'Set notation'): ∩ = in both sets, ∪ = in either set, ′ = not in the set, ξ = the universal set. Regions shaded exactly: clipPath for the overlap, painted-over circles for the complements.", { doesNotShow: "numbers of elements; probabilities; three sets" }),
  mk("histogram", "Histogram", ["histogram", "frequency density"], histogramG, "A histogram with four touching bars of different widths: the vertical axis is frequency density and the area of each bar shows its frequency.", "A histogram",
    "Oak KS4 keyword 'histogram': rectangles whose area is proportional to the frequency in each class; 'frequency density' is proportional to the frequency per unit of the data (frequency ÷ class width). Drawn: bars of unequal width, touching.", { avoid: ["equal bar width", "equal width", "equal class width", "equal bin", "equal bins", "equal interval", "equal sized", "equal size", "same width", "same size bar", "bars of equal", "bins of equal", "classes of equal", "width is the same", "widths are the same", "widths are equal", "width of each bar is equal"], doesNotShow: "values or scales on the axes; histograms with equal class widths (the bars are deliberately unequal)" }),
  mk("box-plot", "Box plot", ["box plot", "box and whisker", "box and whisker plot", "box and whisker diagram", "boxplot", "interquartile range"], boxPlot, "A box plot on a horizontal scale: whiskers to the minimum and maximum, a box from the lower quartile (LQ) to the upper quartile (UQ) with the median marked inside; brackets show the interquartile range (UQ minus LQ) and the range (max minus min).", "A box plot",
    "Oak KS4 keyword 'box plot': shows the minimum and maximum of a data set along with the three quartiles. Interquartile range = UQ − LQ; range = max − min (standard definitions). The median is drawn inside the box, whiskers end at min and max.", { doesNotShow: "values on the scale; outliers; comparing two box plots" }),
  mk("cumulative-frequency-graph", "Cumulative frequency graph", ["cumulative frequency graph", "cumulative frequency curve", "cumulative frequency diagram", "cumulative frequency"], cumFreq, "A cumulative frequency graph: a smooth S-shaped curve rising to the total n; dashed lines from a quarter, a half and three quarters of n across to the curve and down to the axis mark the lower quartile, median and upper quartile.", "A cumulative frequency graph",
    "Standard GCSE method (Oak KS4 lessons 'Constructing/Interpreting a cumulative frequency graph'): median at ½n, lower quartile at ¼n, upper quartile at ¾n of the total n. Drawn: a smoothstep S-curve; the read-off positions are computed on the curve.", { avoid: ["table"], doesNotShow: "values on the axes; frequency tables" }),
  mk("stem-and-leaf", "Stem and leaf diagram", ["stem and leaf diagram", "stem and leaf"], stemLeaf, "A stem and leaf diagram with stems 1, 2 and 3 and ordered leaves, and the key: 2 | 3 means 23.", "A stem and leaf diagram",
    "Oak keyword 'stem and leaf diagram': splits each value into a stem and a leaf. Example drawn: 12, 15, 18, 20, 23, 23, 27, 31, 34 in order with key 2 | 3 = 23 (checked).", { numeric: true, avoid: ["back to back", "back-to-back"], doesNotShow: "any real data set of the lesson; back-to-back diagrams" }),
  mk("frequency-polygon", "Frequency polygon", ["frequency polygon"], freqPoly, "Five touching grey bars with a blue frequency polygon: red dots at the midpoint of the top of each bar joined by straight lines.", "A frequency polygon",
    "Standard definition: a frequency polygon joins the midpoints of the tops of the bars of a frequency diagram with straight lines. Drawn: dots at exact bar midpoints.", { doesNotShow: "values on the axes; unequal class widths" }),
  mk("two-way-table", "Two-way table", ["two-way table", "two way table"], twoWay, "An empty two-way table with categories A and B across the top, X and Y down the side and a total row and total column.", "A two-way table",
    "Standard definition: a two-way table classifies data by two categories; each row and column adds to its total (Oak KS3/KS4 probability lessons using two-way tables). Drawn: no values.", { doesNotShow: "any values or categories" }),
  mk("frequency-tree", "Frequency tree", ["frequency tree"], freqTree, "A frequency tree: a total box splits into two boxes, each of which splits into two more boxes, every box holding a frequency.", "A frequency tree",
    "Oak KS4 lesson 'Frequency trees': branches show how the total splits into groups, with a frequency in each box; the frequencies at each split add up to the frequency before it. Drawn: two-stage tree, no values.", { doesNotShow: "any values or group names" }),
];
const E3: Pic[] = [
  mk("standard-form", "Standard form", ["standard form"], standardForm, "Standard form written as a times 10 to the power n, with the rules that a is at least 1 and less than 10 and n is a whole number; n is positive for numbers of 10 or more and negative for numbers less than 1.", "Standard form",
    "Oak KS3/KS4 keyword 'standard form': a number written in the form A × 10^n, where 1 ≤ A < 10 and n is an integer. Positive n for numbers ≥ 10, negative n for numbers between 0 and 1 (standard). Drawn: the general form, no example number.", { avoid: ["standard form of a", "standard form of the equation", "exponential form"], doesNotShow: "any example number; how to convert or calculate" }),
  mk("index-laws", "Laws of indices", ["laws of indices", "law of indices", "index laws", "index law"], indexLaws, "The five laws of indices: a to the m times a to the n equals a to the m plus n; dividing subtracts the powers; a power of a power multiplies them; a to the power zero is 1; a to a negative power is 1 divided by a to the positive power.", "The laws of indices",
    "Standard GCSE index laws (Oak KS4 unit 'Arithmetic procedures: index laws', lessons on multiplication, division, negative and zero exponents, power of a power): a^m × a^n = a^(m+n); a^m ÷ a^n = a^(m−n); (a^m)^n = a^(mn); a^0 = 1; a^(−n) = 1/a^n (a ≠ 0).", { doesNotShow: "fractional indices; examples with numbers" }),
  mk("power-notation", "Power notation", ["exponential form", "power notation", "index notation", "base and exponent"], powerNote, "The expression a to the power n with the base a and the exponent (power or index) n labelled, and the meaning a to the n equals a times a times and so on, n lots of a multiplied together.", "Power (index) notation",
    "Oak keyword 'exponential form' (KS3 Y9): when a number is multiplied by itself several times it can be written more simply in exponential form (e.g. a × a × a = a³). a^n = n copies of a multiplied together; a = base, n = exponent/power/index.", { avoid: ["standard form", "laws of indices", "index laws"], doesNotShow: "negative, zero or fractional powers; any example number" }),
  mk("surd-rules", "Surd rules", ["surd", "simplifying surds"], surdRules, "Five statements about surds: root a times root b equals root of ab; root a divided by root b equals root of a over b; the square of root a is a; root of a squared b equals a root b; and root a plus root b is not equal to root of a plus b.", "Rules for surds",
    "Oak KS4 keyword 'surd': an irrational number expressed as the root of a rational number. Rules for a, b > 0 (standard): √a × √b = √(ab); √a ÷ √b = √(a/b); (√a)² = a; √(a²b) = a√b; and √a + √b ≠ √(a + b).", { avoid: ["cube root", "cubic"], doesNotShow: "rationalising the denominator; worked examples" }),
  mk("simple-vs-compound-interest", "Simple and compound interest", ["simple interest", "compound interest"], simpleCompound, "Two sets of bars over time: with simple interest the gold interest part grows by the same amount each time; with compound interest it grows faster because interest is earned on the interest as well.", "Simple and compound interest",
    "Oak keywords: 'simple interest' is always calculated on the original amount; 'compound interest' is calculated on the original amount and the interest accumulated over the previous period. Drawn: simple adds equal steps (14 per period); compound multiplies by 1.35 each period (interest 14, 32.9, 58.4).", { doesNotShow: "the formulas; any real rate; calculations" }),
  mk("percentage-multiplier", "Percentage multipliers", ["percentage multiplier", "percentage increase", "percentage decrease", "percentage change", "reverse percentage", "finding the original amount"], percentMult, "An original box with an arrow times multiplier to a new box, and an arrow divide by multiplier back again; the multiplier is 1 plus p over 100 for an increase of p percent and 1 minus p over 100 for a decrease.", "Percentage multipliers",
    "Oak KS3 Y8 lessons 'Increase by a percentage', 'Decrease by a percentage', 'Finding the original amount after an increase/decrease'. Standard: new = original × (1 ± p/100); original = new ÷ multiplier.", { avoid: ["compound", "simple interest", "profit and loss"], doesNotShow: "calculations with numbers; compound change" }),
  mk("ratio-sharing-bar", "Sharing in a ratio", ["sharing in a ratio", "share in a ratio", "dividing a quantity into a given ratio", "divide in a ratio", "sharing in ratio"], ratioShare, "A bar split into 5 equal parts, 2 shaded blue for A and 3 gold for B, with the note A : B = 2 : 3 and 1 part = total divided by 5.", "Sharing in the ratio 2 : 3",
    "Oak KS3/KS4 lessons 'Dividing a quantity into a given ratio' / 'Checking and securing understanding of sharing in a ratio': add the parts, divide the total by the number of parts to find one part. Example drawn: 2 : 3 (5 parts) - refused when the slide has numbers.", { numeric: true, doesNotShow: "any other ratio; the amounts" }),
  mk("double-number-line", "Double number line", ["double number line"], doubleLine, "A double number line: two parallel number lines with matching ticks; the top line counts 0, 1, 2, 3, 4 and the bottom line 0, k, 2k, 3k, 4k, each value multiplied by the same number k.", "A double number line",
    "Oak KS3 keyword 'double number line' (proportional reasoning): two number lines whose matching values are related by the same multiplier. Drawn: 0-4 above 0, k, 2k, 3k, 4k.", { doesNotShow: "the value of k; percentages" }),
  mk("hcf-lcm-venn", "HCF and LCM with a Venn diagram", ["highest common factor", "lowest common multiple", "hcf", "lcm"], hcfLcm, "Two overlapping circles for the prime factors of two numbers: those only in the first number, those in both, and those only in the second; the HCF multiplies the ones in both and the LCM multiplies all of them.", "HCF and LCM",
    "Standard method: with the prime factors of two numbers in a Venn diagram, HCF = product of the factors in the overlap, LCM = product of all factors in the diagram (overlap counted once). Oak KS3 lessons 'Highest common factor', 'Lowest common multiple', 'HCF or LCM'.", { doesNotShow: "any particular numbers; listing multiples or factors", avoid: ["algebraic", "expression"] }),
  mk("arithmetic-laws", "Commutative, associative and distributive laws", ["commutative law", "associative law", "distributive law", "commutative", "associative", "distributive"], arithLaws, "Three laws of arithmetic: commutative (a plus b equals b plus a, and a times b equals b times a), associative ((a plus b) plus c equals a plus (b plus c)) and distributive (a times (b plus c) equals ab plus ac).", "Laws of arithmetic",
    "Oak keywords 'commutative' (an operation whose values can be written in either order), 'associative law' (grouping does not change the result) and 'distributive law' (multiplying a sum = multiplying each addend and summing). Drawn for addition and multiplication only.", { avoid: ["subtraction is not", "division is not"], doesNotShow: "subtraction and division (which are not commutative or associative)" }),
  mk("order-of-operations-ks3", "Order of operations (KS3-4)", ["order of operations", "priority of operations", "bidmas", "bodmas"], orderOps, "The order of operations: 1 brackets, 2 indices (powers and roots), 3 division and multiplication, 4 addition and subtraction; operations at the same level are done from left to right.", "The order of operations",
    "Oak KS3 Y7 lessons 'Priority of operations with positive and negative integers ...'. Standard BIDMAS: Brackets, Indices, Division and Multiplication, Addition and Subtraction, left to right within a level.", { doesNotShow: "worked examples" }),
  mk("binomial-grid", "Multiplying two brackets", ["product of two binomials", "binomial", "double brackets", "expanding two brackets", "expand double brackets"], binomGrid, "An area grid for (x + a)(x + b): a large x squared square, two rectangles ax and bx and a small rectangle ab; together they give x squared plus (a plus b) x plus ab.", "Expanding double brackets",
    "Oak KS3/KS4 lessons 'The product of two binomials' / 'More complex binomial products'. Area model: (x + a)(x + b) = x² + ax + bx + ab = x² + (a + b)x + ab (checked by expansion).", { avoid: ["difference of two squares"], doesNotShow: "coefficients other than 1; worked examples" }),
  mk("difference-of-two-squares", "Difference of two squares", ["difference of two squares", "difference of squares"], diffSquares, "A square of side a with a small square of side b cut from one corner, which has the same area as a rectangle of length a plus b and width a minus b; so a squared minus b squared equals (a plus b)(a minus b).", "Difference of two squares",
    "Oak KS3/KS4 lessons 'Difference of two squares' / 'Factorising using the difference of two squares': a² − b² = (a + b)(a − b). Drawn with a = 60, b = 24: L-shape 3600 − 576 = 3024 = 84 × 36 (checked).", { doesNotShow: "the algebraic proof; worked examples" }),
  mk("quadratic-formula", "The quadratic formula", ["quadratic formula"], quadFormula, "The quadratic formula: for ax squared plus bx plus c equals 0, x equals minus b plus or minus the square root of b squared minus 4ac, all over 2a.", "The quadratic formula",
    "Oak keyword 'quadratic formula': a formula for finding the solutions to any quadratic equation of the form ax² + bx + c = 0. x = (−b ± √(b² − 4ac)) / 2a (standard).", { doesNotShow: "the discriminant's meaning; worked examples" }),
  mk("balance-equation", "Equation as a balance", ["solving linear equations", "solve linear equations", "linear equation", "balance method"], balanceEq, "A balance scale with the left side and the right side level with an equals sign above: an equation stays true if you do the same thing to both sides.", "An equation is a balance",
    "Standard teaching model for Oak KS3 Y8 unit 'Solving linear equations': both sides of an equation are equal, so any operation must be applied to both sides. Drawn: a level beam with two pans, no values.", { avoid: ["graph", "simultaneous", "quadratic", "inequalit", "plot", "straight line", "y mx c", "gradient"], doesNotShow: "any particular equation; the steps of a solution" }),
  mk("inequality-symbols", "Inequality symbols", ["inequality symbol", "inequality notation", "linear inequality", "solving inequalities", "inequality"], ineqSymbols, "The four inequality symbols with their meanings: less than, greater than, less than or equal to, greater than or equal to; a < b means a is less than b.", "Inequality symbols",
    "Oak keyword 'inequality': used to show that one expression may not be equal to another. Symbols < (less than), > (greater than), ≤ (less than or equal to), ≥ (greater than or equal to) (standard).", { avoid: ["error interval", "income", "wealth", "gender", "social"], doesNotShow: "solving inequalities; number lines" }),
  mk("error-interval", "Error interval and bounds", ["error interval", "upper bound", "lower bound", "upper and lower bounds", "bounds"], errInterval, "A number line with a rounded value in the middle, a closed circle at the lower bound and an open circle at the upper bound joined by a thick line: lower bound less than or equal to x, and x less than upper bound.", "Error interval",
    "Oak keywords: 'error interval': the range of possible values of x written as a ≤ x < b; 'lower bound': the smallest value the number could have taken before rounding; 'upper bound': the smallest value that would round up to the next value. The rounded value is the midpoint.", { doesNotShow: "any values; bounds in calculations" }),
  mk("like-terms", "Like terms", ["like terms", "collecting like terms"], likeTerms, "Tiles: three x tiles plus two x tiles make 5x, so like terms can be added; three x tiles and two y tiles cannot be combined because they are unlike terms.", "Like terms",
    "Standard: like terms have the same variable part and can be collected (3x + 2x = 5x); unlike terms (3x + 2y) cannot. Oak KS3 Y7 lesson 'Like terms'. Numeric example, refused when the slide has numbers.", { numeric: true, doesNotShow: "any other terms; expressions with several variables" }),
  mk("metric-prefixes", "Metric prefixes", ["metric prefix", "metric prefixes", "metric unit", "metric units", "kilo", "centi", "milli"], metricPrefix, "The metric prefixes: kilo means 1000 times the unit, centi means one hundredth of the unit, milli means one thousandth of the unit.", "Metric prefixes",
    "Oak keywords: 'kilo' placed before a unit means 1000 times; 'centi' means (1/100); 'milli' means (1/1000). Drawn: the three prefixes and their meanings.", { numeric: true, doesNotShow: "conversions between units; imperial units" }),
  mk("mutually-exclusive", "Mutually exclusive events", ["mutually exclusive", "mutually exclusive events"], mutExcl, "Two Venn diagrams: on the left two separate circles A and B with no overlap (mutually exclusive); on the right two overlapping circles (not mutually exclusive).", "Mutually exclusive events",
    "Oak keyword 'mutually exclusive': two events are mutually exclusive if they share no common outcome, so their circles do not overlap; overlapping circles share outcomes.", { doesNotShow: "probabilities; the addition rule" }),
  mk("probability-tree", "Probability tree", ["probability tree", "tree diagram", "probability tree diagram"], probTree, "A two-stage probability tree: the first branches A and not A, then B and not B from each, giving four outcomes: A and B, A and not B, not A and B, not A and not B; each branch carries a probability p, q, r or one minus those.", "A probability tree",
    "Oak keyword 'probability tree': each branch shows a possible outcome of an event or stage along with its probability. Multiply along the branches for 'and'; add the outcomes wanted. Branch labels p, q, r are generic (q = r when the events are independent), so the tree is correct for independent and conditional events.", { avoid: ["outcome tree", "frequency tree", "factor tree", "decision tree"], doesNotShow: "values; three-stage trees" }),
];
const CT_FAM = "circle-theorems";
const E4: Pic[] = [
  mk("bearing", "Bearings", ["bearing", "three-figure bearing", "three figure bearing"], bearingG, "A bearing: a north line up from point A, a line from A to point B, and a clockwise arc with an arrow from the north line to the line AB marking the bearing of B from A.", "A bearing",
    "Oak keyword 'bearing': an angle measured in degrees from North in the clockwise direction and written with three figures. Drawn: north line, line AB at 60 degrees clockwise from north, arc with arrow head running clockwise.", { avoid: ["reverse bearing", "back bearing", "ball bearing"], doesNotShow: "the size of the bearing; distances; a bearing of B from A when the angle is over 180" }),
  mk("reverse-bearing", "Reverse bearings", ["reverse bearing", "back bearing"], reverseBearing, "Two points A and B each with a north line: the bearing of B from A is the clockwise angle x at A; the bearing of A from B is the clockwise angle x plus 180 degrees at B, shown with a dashed south line.", "Reverse bearings",
    "Oak KS4 lesson 'Reverse bearings': the two north lines are parallel, so the bearing of A from B differs from the bearing of B from A by 180 degrees (alternate angles: add 180 when the first bearing is under 180, subtract 180 otherwise). Drawn with exact clockwise arcs (x and x + 180).", { doesNotShow: "bearings of 180 or more (the subtract case); values" }),
  mk("angle-notation", "Angle notation", ["angle notation", "formal angle notation"], angleNotation, "An angle drawn between the lines BA and BC with the vertex B marked in red and labelled: angle ABC is the angle at B, the middle letter.", "Angle notation",
    "Oak KS3 Y8 lesson 'Formal angle notation': the angle ∠ABC is the angle at vertex B between the lines BA and BC (the middle letter names the vertex). Drawn: B at the vertex, arc between BA and BC.", { doesNotShow: "the size of the angle; other notations" }),
  mk("interior-exterior-angle", "Interior and exterior angles", ["exterior angle", "interior angle"], intExt, "A regular pentagon with one side extended: at one vertex the interior angle (green arc inside) and the exterior angle (red arc outside) together make a straight line.", "Interior and exterior angles",
    "Oak keywords: 'interior angle': formed inside a polygon by two of its edges; 'exterior angle': on the outside of a polygon between an extension of an edge and its adjacent edge. They lie on a straight line so add to 180 degrees. Drawn: regular pentagon with the bottom edge extended (exterior 72, interior 108 exact).", { avoid: ["interior angles of a triangle", "angles in a triangle", "interior angle of a triangle", "of any triangle", "exterior angle of a triangle", "cyclic", "polygon has 360"], doesNotShow: "the sum of the exterior angles (360); the sum of the interior angles" }),
  mk("polygon-angle-sum", "Angle sum of a polygon", ["sum of interior angles", "sum of the interior angles", "angle sum of a polygon", "interior angles of a polygon", "angles in a polygon"], polyAngleSum, "A hexagon split into four triangles by three dashed lines from one corner: the sum of the interior angles is (n minus 2) times 180 degrees.", "Angle sum of a polygon",
    "Oak KS3 Y8 lessons 'The sum of the interior angles of any triangle', 'Deriving the sum of the interior angles in multiple ways', 'Interior angles of a polygon'. An n-sided polygon splits into (n − 2) triangles from one vertex, so the sum is (n − 2) × 180°. Example: hexagon (exact regular hexagon, 3 diagonals from one vertex).", { avoid: ["of a triangle", "any triangle", "quadrilateral", "regular polygon"], doesNotShow: "individual angle sizes; exterior angles" }),
  mk("quadrilateral-angle-sum", "Angles in a quadrilateral", ["angles in a quadrilateral", "angle sum of a quadrilateral", "interior angles of a quadrilateral", "angles of a quadrilateral"], quadAngleSum, "A quadrilateral with a dashed diagonal splitting it into two triangles and its four angles a, b, c and d marked: they add up to 360 degrees, two lots of 180.", "Angles in a quadrilateral",
    "Standard result: a diagonal splits a quadrilateral into two triangles, each with angle sum 180°, so the four interior angles add up to 360°. Angle arcs drawn from the real vertex directions.", { avoid: ["cyclic"], doesNotShow: "any angle sizes; special quadrilaterals" }),
  mk("exterior-angle-triangle", "Exterior angle of a triangle", ["exterior angle of a triangle", "exterior angles of a triangle"], extTriangle, "A triangle with one side extended: the exterior angle at B, marked a plus b, equals the sum of the two opposite interior angles a and b.", "Exterior angle of a triangle",
    "Standard result: the exterior angle of a triangle equals the sum of the two opposite interior angles (the interior angle at B is 180° − a − b, and 180° − (180° − a − b) = a + b). Arcs drawn from the real edge directions.", { doesNotShow: "angle sizes" }),
  mk("ct-centre", "Circle theorem: angle at the centre", ["angle at the centre", "angle at the circumference", "angles at the centre and circumference"], ctCentre, "A circle with centre O and chord AB: the angle AOB at the centre, marked 2x, is twice the angle ACB at the circumference, marked x.", "Angle at the centre",
    "Oak KS4 lesson 'The angle at the centre of the circle is twice the angle at any point on the circumference'. Drawn exactly: A at 210°, B at 330°, C at 90° on the circle, centre O (AOB = 120°, ACB = 60°); the arcs are drawn from the real directions.", { family: CT_FAM, avoid: ["sector", "arc length", "semicircle", "area of a"], doesNotShow: "the reflex-angle case; sizes of the angles" }),
  mk("ct-semicircle", "Circle theorem: angle in a semicircle", ["angle in a semicircle", "angles in a semicircle"], ctSemi, "A circle with a diameter AB and a point C on the circle: the angle ACB is a right angle, marked with a small square.", "Angle in a semicircle",
    "Standard circle theorem (Oak KS4 circle theorems unit): the angle in a semicircle is 90°. Drawn: AB a diameter (A at 180°, B at 0°), C on the circle at 68°; the right-angle marker uses the real directions CA and CB.", { family: CT_FAM, doesNotShow: "the proof; the size of other angles" }),
  mk("ct-same-segment", "Circle theorem: angles in the same segment", ["angles in the same segment", "angle in the same segment"], ctSegment, "A circle with a chord AB and two points C and D on the same side of it: the angles ACB and ADB are both marked x because angles in the same segment are equal.", "Angles in the same segment",
    "Standard circle theorem: angles subtended by the same chord (arc) at points on the same side of it are equal. Drawn: A at 215°, B at 325°, C at 58°, D at 118°.", { family: CT_FAM, doesNotShow: "angle sizes; points on opposite sides of the chord" }),
  mk("ct-cyclic-quadrilateral", "Circle theorem: cyclic quadrilateral", ["cyclic quadrilateral"], ctCyclic, "A quadrilateral ABCD with all four corners on a circle: the opposite angles a and 180 minus a, and b and 180 minus b, add up to 180 degrees.", "A cyclic quadrilateral",
    "Oak KS4 lesson 'The opposite angles of a cyclic quadrilateral sum to 180°'. Drawn: A at 95°, B at 205°, C at 300°, D at 15° on the circle; angle arcs drawn from the real vertex directions; labels a, 180° − a, b, 180° − b.", { family: CT_FAM, doesNotShow: "angle sizes; the exterior-angle version" }),
  mk("ct-tangent-radius", "Circle theorem: tangent and radius", ["tangent to a circle", "tangent and radius", "radius and tangent", "tangent and a radius"], ctTangent, "A circle with a tangent line touching it at one point and the radius to that point of contact, meeting the tangent at a right angle (small square).", "Tangent and radius",
    "Standard circle theorem (Oak KS4 unit; keyword 'tangent'): a tangent to a circle is perpendicular to the radius at the point of contact. Drawn: tangent at 30° constructed exactly perpendicular to OT.", { family: CT_FAM, avoid: ["tangent graph", "tangent function", "tangent ratio", "=tan"], doesNotShow: "the proof; other tangent properties" }),
  mk("ct-two-tangents", "Circle theorem: two tangents", ["two tangents", "tangents from a point", "tangents from an external point", "tangents from the same point"], ctTwoTangents, "A circle with two tangents drawn from an outside point P touching at A and B, equal in length (matching tick marks) with right angles between each radius and tangent.", "Tangents from a point",
    "Standard circle theorem: tangents from an external point are equal in length. Drawn: P at distance 126 from O, r = 40, tangent points at ±acos(r/OP) so the tangents are exact; equal ticks on PA and PB; right-angle markers at A and B.", { family: CT_FAM, doesNotShow: "the proof; lengths" }),
  mk("ct-alternate-segment", "Circle theorem: alternate segment", ["alternate segment theorem", "alternate segment"], ctAlternate, "A circle with a tangent at A and a chord AB: the angle between the tangent and the chord is marked x and equals the angle x at C in the alternate segment.", "The alternate segment theorem",
    "Standard circle theorem: the angle between a tangent and a chord equals the angle in the alternate segment. Drawn exactly: A at 270° (tangent horizontal), B at 30°, C at 150°; both marked angles are 60°.", { family: CT_FAM, doesNotShow: "the proof; angle sizes" }),
  mk("ct-chord-bisector", "Circle theorem: chord bisector", ["chord bisector", "perpendicular bisector of a chord", "perpendicular from the centre to a chord", "bisects a chord", "bisects the chord"], ctChord, "A circle with a chord AB and a line from the centre O meeting the chord at its midpoint M at a right angle; the two halves AM and MB carry equal tick marks.", "The perpendicular from the centre bisects a chord",
    "Standard circle theorem: a line from the centre perpendicular to a chord bisects the chord (and conversely). Drawn: chord 28 below the centre, half-length √(52² − 28²) exact, right-angle marker and equal ticks at M.", { family: CT_FAM, doesNotShow: "the proof; lengths" }),
  mk("congruent-sss", "Congruent triangles: SSS", ["sss", "side side side"], congSSS, "Two triangles that are mirror images with all three pairs of sides marked equal by tick marks: SSS.", "SSS congruence",
    "Oak KS3 Y9 lesson 'Congruent triangles (SSS)': triangles with three pairs of equal sides are congruent. Drawn: a scalene triangle and its exact reflection with ticks 1, 2, 3 on matching sides.", { family: "congruence-criteria", requires: ["congruent", "congruence", "triangle"], avoid: ["lhs", "left hand side", "equation", "=similar", "similar triangle"], doesNotShow: "the other conditions" }),
  mk("congruent-sas", "Congruent triangles: SAS", ["sas", "side angle side"], congSAS, "Two triangles that are mirror images with two pairs of equal sides marked by ticks and the angle between them marked with an arc: SAS.", "SAS congruence",
    "Oak KS3 Y9 lesson 'Congruent triangles (SAS)': two pairs of equal sides and the included angle. Drawn: the two marked sides meet at the marked angle; exact reflection of a scalene triangle.", { family: "congruence-criteria", requires: ["congruent", "congruence", "triangle"], avoid: ["lhs", "left hand side", "equation", "=similar", "similar triangle"], doesNotShow: "the other conditions" }),
  mk("congruent-asa", "Congruent triangles: ASA", ["asa", "angle side angle"], congASA, "Two triangles that are mirror images with two pairs of equal angles marked with arcs and the side between them marked with a tick: ASA.", "ASA congruence",
    "Oak KS3 Y9 lesson 'Congruent triangles (ASA and AAS)': two angles and the side between them. Drawn: the marked side is the common side of the two marked angles.", { family: "congruence-criteria", requires: ["congruent", "congruence", "triangle"], avoid: ["lhs", "left hand side", "equation", "=similar", "similar triangle"], doesNotShow: "the other conditions" }),
  mk("congruent-aas", "Congruent triangles: AAS", ["aas", "angle angle side"], congAAS, "Two triangles that are mirror images with two pairs of equal angles marked with arcs and a side that is not between them marked with a tick: AAS.", "AAS congruence",
    "Oak KS3 Y9 lesson 'Congruent triangles (ASA and AAS)': two angles and a side that is not between them. Drawn: the marked side is not the side joining the two marked angles.", { family: "congruence-criteria", requires: ["congruent", "congruence", "triangle"], avoid: ["lhs", "left hand side", "equation", "=similar", "similar triangle"], doesNotShow: "the other conditions" }),
  mk("congruent-rhs", "Congruent triangles: RHS", ["rhs", "right angle hypotenuse side"], congRHS, "Two right-angled triangles that are mirror images with the right angle marked, the hypotenuse marked with two ticks and one other side with one tick: RHS.", "RHS congruence",
    "Oak KS3 Y9 lesson 'Congruent triangles (RHS)': a right angle, the hypotenuse and one other side. Drawn: right-angled triangle and its exact reflection.", { family: "congruence-criteria", requires: ["congruent", "congruence", "triangle"], avoid: ["lhs", "left hand side", "left-hand side", "equation", "=similar", "similar triangle"], doesNotShow: "the other conditions" }),
];
const E5: Pic[] = [
  mk("scale-factor", "Scale factor", ["scale factor"], scaleFactor, "A small rectangle with sides a and b beside a larger similar rectangle with sides ka and kb: the scale factor k is the new length divided by the original length.", "Scale factor",
    "Oak keyword 'scale factor': the multiplier between similar shapes that describes how large one shape is compared to the other. Drawn: rectangles 44 × 28 and 88 × 56, so every length is multiplied by k (k = 2 drawn).", { avoid: ["area scale factor", "volume scale factor", "negative scale factor", "fractional scale factor", "negative enlargement", "fractional enlargement", "positive fractional", "negative", "area and volume", "scale factors of area"], doesNotShow: "the value of k; area and volume scale factors" }),
  mk("clockwise-anticlockwise", "Clockwise and anticlockwise", ["clockwise", "anticlockwise", "anti-clockwise", "counterclockwise", "counter-clockwise"], turnDir, "Two clock faces with an arrow: the green arrow turns the way clock hands move (clockwise), the red arrow turns the opposite way (anticlockwise).", "Clockwise and anticlockwise",
    "Standard: clockwise = the direction in which the hands of a clock turn; anticlockwise = the opposite. Drawn: arrows on a 12-3-6-9 dial, the clockwise arrow running from near 12 towards 3.", { avoid: ["bearing", "north"], doesNotShow: "angles of turn; centres of rotation" }),
  mk("column-vector", "Column vector", ["column vector"], colVec, "A vector drawn as an arrow with a dashed path of a across and b up, and the column vector with a on top of b written beside it.", "A column vector",
    "Standard definition (Oak KS3/KS4 translations): a column vector (a over b) means a units across then b units up (negative = left / down). Drawn: right and up components of the arrow, exact right angle.", { requires: ["vector"], doesNotShow: "actual values; the magnitude of the vector" }),
  mk("vector-add-subtract", "Adding and subtracting vectors", ["resultant vector", "vector addition", "vector subtraction", "adding vectors", "subtracting vectors", "sum and difference of vectors", "algebraic vector notation", "vectors in algebraic notation", "triangle law"], vecAddSub, "Two diagrams with vectors a and b: on the left a followed by b gives the resultant a plus b; on the right a and b from the same point, and a minus b joins the head of b to the head of a.", "Adding and subtracting vectors",
    "Oak keyword 'resultant vector': the single vector with the same effect as a combination of vectors. Adding: place head to tail, a + b is the third side. Subtracting: a − b = a + (−b) runs from the head of b to the head of a (checked with a = (50, −40), b = (42, 20): a − b = (8, −60)).", { requires: ["vector"], doesNotShow: "components; multiples of vectors" }),
  mk("vector-multiples", "Multiples of a vector", ["scalar multiple", "parallel vectors", "multiples of a vector"], vecMult, "Three arrows: a, then 2a twice as long in the same direction, then minus a the same length in the opposite direction.", "Multiples of a vector",
    "Standard: 2a has twice the magnitude and the same direction as a; −a has the same magnitude and the opposite direction; parallel vectors are scalar multiples of each other. Drawn: lengths 50, 100, 50; −a drawn leftwards.", { requires: ["vector"], doesNotShow: "components; the geometric proofs" }),
  mk("compound-shape", "Compound shape", ["compound shape", "composite shape", "composite rectilinear shape"], compoundShape, "An L-shaped compound shape split by a dashed line into two rectangles A and B: its area is the area of A plus the area of B.", "A compound shape",
    "Oak keyword 'compound shape': a shape created using two or more basic shapes ('composite shape' is an alternative term). Area = sum of the areas of the parts (or a big rectangle minus a piece). Drawn: L-shape from rectangles 100 × 42 and 160 × 56.", { avoid: ["volume", "surface area", "solid", "3d"], doesNotShow: "the subtraction method; measurements" }),
  mk("triangle-area", "Area of a triangle", ["area of a triangle", "area of triangles"], triArea, "A triangle with its base b and a dashed perpendicular height h marked with a right-angle square, and the formula area equals a half times b times h.", "Area of a triangle",
    "Oak KS3 Y7 lesson 'Using the formula for the area of a triangle': area = ½ × base × perpendicular height. The height (red) meets the base at a right angle (marker drawn).", { avoid: ["height is not known", "sine", "sin c", "trigonometr", "any triangle"], doesNotShow: "the derivation; the sine formula" }),
  mk("parallelogram-area", "Area of a parallelogram", ["area of a parallelogram", "area of parallelograms"], paraArea, "A parallelogram with base b and a dashed perpendicular height h marked with a right-angle square, and the formula area equals b times h.", "Area of a parallelogram",
    "Oak keyword 'parallelogram': a quadrilateral with two pairs of parallel and equal sides; area = base × perpendicular height (Oak KS3 'Explain how to calculate the area of a parallelogram'). Height drawn perpendicular to the base.", { doesNotShow: "the slant side as the height; measurements" }),
  mk("trapezium-area", "Area of a trapezium", ["area of a trapezium", "area of trapezia", "area of a trapezoid"], trapArea, "A trapezium with parallel sides a (top) and b (bottom), a dashed perpendicular height h and the formula area equals a half times (a plus b) times h.", "Area of a trapezium",
    "Oak keyword 'trapezium': a quadrilateral with a pair of parallel opposite sides ('Area of a trapezium' lesson); area = ½(a + b)h with h the perpendicular distance between them. Drawn: parallel horizontal sides, perpendicular height with right-angle marker.", { doesNotShow: "the derivation; measurements" }),
  mk("circle-formulas", "Circumference and area of a circle", ["area of a circle", "circumference of a circle", "circle formulas", "area and circumference"], circleFormulas, "A circle with its diameter d and radius r marked and the formulas circumference C equals pi d equals 2 pi r and area A equals pi r squared.", "Circumference and area of a circle",
    "Oak KS3/KS4 keywords 'diameter', 'radius', 'circumference' and lesson 'Area of a circle': C = πd = 2πr, A = πr², d = 2r (standard). Drawn: diameter (blue) and radius (red) exact.", { avoid: ["sector", "arc length", "segment"], doesNotShow: "sectors and arcs; worked examples" }),
  mk("sector-formulas", "Arc length and sector area", ["arc length", "length of an arc", "area of a sector", "sector area"], sectorFormulas, "A shaded sector of a circle with radius r, angle theta at the centre and the arc in red, with the formulas arc length equals theta over 360 times 2 pi r and sector area equals theta over 360 times pi r squared.", "Arc length and sector area",
    "Standard GCSE formulas (Oak KS4): arc length = θ/360 × 2πr and sector area = θ/360 × πr², θ in degrees. Drawn: sector from 8° to 78° (θ = 70°, angle arc from the real directions).", { avoid: ["pie chart"], doesNotShow: "radians; segments; worked examples" }),
  mk("cylinder-formulas", "Cylinder: volume and surface area", ["volume of a cylinder", "volume of cylinders", "surface area of a cylinder", "surface area of cylinders", "curved surface area of a cylinder"], cylForm, "A cylinder with radius r and height h marked and the formulas volume V equals pi r squared h, curved surface area 2 pi r h and top plus bottom 2 pi r squared.", "Cylinder formulas",
    "Standard formulas (Oak KS4 unit 'surface area and volume'): V = πr²h; curved surface area = 2πrh; two circular ends = 2πr². Drawn with the ellipse cylinder of the shape library (radius line on the top face, height dimension line).", { family: "3d", covers: ["cylinder"], avoid: ["hollow", "prism"], doesNotShow: "the total surface area sum; worked examples" }),
  mk("cone-formulas", "Cone: volume and surface area", ["volume of a cone", "volume of cones", "surface area of a cone", "surface area of cones", "curved surface area of a cone"], coneForm, "A cone with radius r, perpendicular height h and slant height l marked and the formulas volume V equals a third pi r squared h and curved surface area pi r l.", "Cone formulas",
    "Standard formulas (Oak KS4 lessons on cones): V = ⅓πr²h; curved surface area = πrl with l the slant height (l² = r² + h²). Drawn: apex above the centre of the base, h dashed, r on the base, l along the slant edge.", { family: "3d", covers: ["cone"], avoid: ["frustum"], doesNotShow: "the total surface area; worked examples" }),
  mk("sphere-formulas", "Sphere: volume and surface area", ["volume of a sphere", "volume of spheres", "surface area of a sphere", "surface area of spheres", "volume and surface area of a sphere"], sphereForm, "A sphere with its radius r marked and the formulas volume V equals four thirds pi r cubed and surface area equals 4 pi r squared.", "Sphere formulas",
    "Standard formulas (Oak KS4 lessons on spheres): V = (4/3)πr³; surface area = 4πr². Drawn: sphere with dashed back half of the equator and a radius.", { family: "3d", covers: ["sphere"], avoid: ["hemisphere"], doesNotShow: "hemispheres; worked examples" }),
  mk("pyramid-formula", "Pyramid: volume", ["volume of a pyramid", "volume of pyramids", "surface area of a pyramid", "surface area of pyramids"], pyrForm, "A pyramid with its perpendicular height h dashed from the apex to the middle of the base and the formula volume equals a third times the base area times h.", "Volume of a pyramid",
    "Standard formula (Oak KS4 unit 'pyramids, spheres and cones'): V = ⅓ × base area × perpendicular height. Drawn: apex directly above the centre of the base, height dashed; hidden edges dashed.", { family: "3d", covers: ["pyramid"], avoid: ["tetrahedron", "cone"], doesNotShow: "surface area; worked examples" }),
  mk("prism", "Prism and cross-section", ["prism", "cross section", "volume of a prism", "volume of prisms", "surface area of a prism", "surface area of prisms"], prismForm, "A triangular prism with its triangular cross-section shaded on the front, the length l marked and the rule volume equals the area of the cross-section times l.", "A prism",
    "Oak keywords 'prism' (a polyhedron with two identical parallel faces joined by parallelograms) and 'cross section'; V = area of cross-section × length (Oak KS3 Y8 'Volume of prisms'). Drawn: triangular prism with hidden edges dashed.", { family: "3d", covers: ["triangular prism"], avoid: ["rectangular prism", "hexagonal prism", "light", "spectrum", "refract", "cylinder"], doesNotShow: "prisms with other cross-sections; surface area; worked examples" }),
  mk("frustum", "Frustum of a cone", ["frustum", "frustum of a cone"], frustumG, "A frustum, a cone with the top cut off parallel to the base, with the removed small cone drawn dashed above, radii R and r and height h marked; its volume is the big cone minus the small cone.", "A frustum",
    "Oak keyword 'frustum': the 3D shape made from a cone by making a cut parallel to its circular base and removing the resultant smaller cone. Volume = big cone − small cone. Drawn: R = 48, r = 22, dashed edges meet at the apex (checked similar triangles).", { family: "3d", covers: ["cone"], doesNotShow: "the formulas for surface area; worked examples" }),
  mk("net-cylinder", "Net of a cylinder", ["net of a cylinder"], netCylinder, "The net of a cylinder: a rectangle for the curved surface and two circles, one touching the top edge and one the bottom edge.", "Net of a cylinder",
    "Oak keyword 'net': a 2D representation of the surfaces of a 3D object that folds up into it. A cylinder's net is a rectangle (width = circumference) plus two circles. Drawn exactly: r = 20.37, rectangle width 128 = 2πr.", { family: "3d", covers: ["cylinder"], doesNotShow: "measurements; other nets" }),
  mk("net-cuboid", "Net of a cuboid", ["net of a cuboid"], netCuboid, "The net of a cuboid: six rectangles in a cross shape, opposite faces the same size.", "Net of a cuboid",
    "Oak keyword 'net'. A cuboid has 6 rectangular faces in 3 equal pairs; this cross net (1-4-1) folds up: 50×32 base and top, 50×26 front and back, 26×32 left and right (dimensions consistent).", { family: "3d", covers: ["cuboid"], doesNotShow: "other nets; measurements" }),
  mk("net-triangular-prism", "Net of a triangular prism", ["net of a triangular prism"], netTriPrism, "The net of a triangular prism: three rectangles in a row with a triangle above and a triangle below the first rectangle.", "Net of a triangular prism",
    "Oak keyword 'net'. Two triangular ends + three rectangles whose widths are the triangle's sides (44, 34, 34 for an isosceles triangle with base 44 and sloping sides 34; triangle height √(34² − 22²) computed).", { family: "3d", covers: ["triangular prism"], doesNotShow: "other nets; measurements" }),
  mk("net-pyramid", "Net of a square-based pyramid", ["net of a square-based pyramid", "net of a pyramid"], netPyramid, "The net of a square-based pyramid: a square with an isosceles triangle attached to each of its four sides.", "Net of a square-based pyramid",
    "Oak keyword 'net'. A square-based pyramid has 1 square face and 4 congruent triangular faces (the triangles share the base edge lengths of the square). Drawn: square 44 with four isosceles triangles of slant height 40.", { family: "3d", covers: ["pyramid"], doesNotShow: "other nets; measurements" }),
];
const E6: Pic[] = [
  mk("trig-ratios", "Trigonometric ratios (SOH CAH TOA)", ["trigonometric ratio", "sine ratio", "cosine ratio", "tangent ratio", "trigonometric function", "right-angled trigonometry", "right angled trigonometry"], trigRatios, "A right-angled triangle with the angle theta marked and the hypotenuse, opposite and adjacent sides labelled, with sin theta equals opposite over hypotenuse, cos theta equals adjacent over hypotenuse, tan theta equals opposite over adjacent.", "Sine, cosine and tangent",
    "Oak keywords: 'trigonometric ratios': ratios between each pair of lengths in a right-angled triangle; 'trigonometric functions': commonly defined as ratios of two sides of a right-angled triangle for a given angle. sin = opp/hyp, cos = adj/hyp, tan = opp/adj (SOH CAH TOA).", { avoid: ["unit circle", "sine rule", "cosine rule", "non right", "non-right", "graph", "inverse", "bearing"], doesNotShow: "angles beyond 90 degrees; inverse ratios; exact values" }),
  mk("sine-rule", "The sine rule", ["sine rule"], sineRule, "A triangle with corners A, B, C and the sides opposite them labelled a, b and c, with the sine rule: a over sin A equals b over sin B equals c over sin C.", "The sine rule",
    "Oak KS4 lesson 'The sine rule': the sides of a triangle are proportional to the sines of their opposite angles, a/sin A = b/sin B = c/sin C. Drawn: acute scalene triangle with side a opposite A, b opposite B, c opposite C (checked).", { avoid: ["cosine rule", "area of"], doesNotShow: "the ambiguous case; the cosine rule" }),
  mk("cosine-rule", "The cosine rule", ["cosine rule"], cosineRule, "A triangle with corners A, B, C and the sides opposite them labelled a, b and c, angle A marked, with the cosine rule a squared equals b squared plus c squared minus 2bc cos A.", "The cosine rule",
    "Oak KS4 lesson 'The cosine rule': a² = b² + c² − 2bc cos A for a triangle with sides a, b, c opposite the angles A, B, C. Angle A is marked between the sides b and c.", { avoid: ["sine rule", "area of"], doesNotShow: "rearranged forms; the sine rule" }),
  mk("area-of-any-triangle", "Area of any triangle using sine", ["area of any triangle", "area of a triangle using sine", "area of a triangle using trigonometry"], areaSine, "A triangle with corners A, B, C, sides a and b either side of angle C marked, and the formula area equals a half a b sin C.", "Area of any triangle",
    "Oak KS4 lessons 'The area of any triangle' / 'Calculating the area of any triangle when the height is not known': area = ½ab sin C, with C the angle between sides a and b. Angle C is marked between a and b.", { avoid: ["cosine rule", "sine rule"], doesNotShow: "the derivation; the half base times height formula" }),
  mk("speed-distance-time", "Speed, distance and time triangle", ["speed distance time", "distance speed time", "speed distance and time", "distance speed and time", "distance time and speed", "speed"], sdtTri, "A formula triangle with D at the top and S and T below: cover the one you want; D equals S times T, S equals D divided by T, T equals D divided by S.", "Speed, distance and time",
    "Oak KS4 unit 'Compound measures' (speed = distance ÷ time). Formula triangle: D = S × T, S = D ÷ T, T = D ÷ S (checked). Drawn: D on top, S and T beneath.", { requires: ["distance", "time"], avoid: ["acceleration", "graph", "velocity", "wave", "sound", "light", "rate of"], doesNotShow: "units; worked examples" }),
  mk("density-mass-volume", "Density, mass and volume triangle", ["density mass volume", "mass density volume", "density mass and volume", "density triangle", "density"], denTri, "A formula triangle with M at the top and D and V below: M equals D times V, D equals M divided by V, V equals M divided by D.", "Density, mass and volume",
    "Oak keyword 'density': the substance's mass per unit of volume, so D = M ÷ V, M = D × V, V = M ÷ D. Drawn as a formula triangle.", { requires: ["mass", "volume"], avoid: ["frequency density", "population density"], doesNotShow: "units; worked examples" }),
  mk("pressure-force-area", "Pressure, force and area triangle", ["pressure force area", "force pressure area", "pressure force and area", "pressure triangle", "pressure"], presTri, "A formula triangle with F at the top and P and A below: F equals P times A, P equals F divided by A, A equals F divided by P.", "Pressure, force and area",
    "Standard: pressure = force ÷ area (Oak KS4 'Compound measures for pressure'), so F = P × A and A = F ÷ P. Drawn as a formula triangle.", { requires: ["force", "area"], avoid: ["blood", "air pressure", "atmospheric", "tyre"], doesNotShow: "units; worked examples" }),
  mk("compound-measures", "Compound measures", ["compound measures", "compound measure"], compoundMeas, "Three formulas: speed equals distance divided by time, density equals mass divided by volume, pressure equals force divided by area.", "Compound measures",
    "Oak KS4 unit 'Compound measures' (speed, density, pressure): each compound measure is one quantity divided by another (speed = distance ÷ time; density = mass ÷ volume; pressure = force ÷ area).", { doesNotShow: "units; conversions; worked examples" }),
  mk("proportion-formulas", "Direct and inverse proportion", ["constant of proportionality", "directly proportional", "inversely proportional"], propFormulas, "Two small graphs: a straight line through the origin for y equals k x (directly proportional) and a falling curve for y equals k divided by x (inversely proportional), with k the constant of proportionality.", "Direct and inverse proportion",
    "Oak keywords 'direct proportion' (constant multiplicative relationship, y = kx) and 'inverse proportion' (y = k/x); k is the constant of proportionality. Both graphs drawn for positive x.", { doesNotShow: "negative values; the value of k" }),
  mk("scatter-outlier", "Outlier on a scatter graph", ["outlier", "outliers"], scatterOutlier, "A scatter graph with a line of best fit and points close to it, and one point far from the line circled with a dashed ring and labelled outlier.", "An outlier",
    "Oak lesson 'Outliers in scatter graphs' (KS4 Y10) and keyword 'outlier': a point that does not fit the pattern of the others. Drawn: 10 points within 9 units of the trend line, one 49 units off, circled.", { requires: ["scatter", "graph", "line of best fit", "correlation"], avoid: ["box plot", "quartile"], doesNotShow: "what to do with an outlier" }),
  mk("interpolation-extrapolation", "Interpolation and extrapolation", ["interpolation", "extrapolation"], scatterInterp, "A scatter graph with a line of best fit; the region containing the data is shaded and labelled interpolation, and the region beyond the data on the right is labelled extrapolation.", "Interpolation and extrapolation",
    "Oak keywords 'interpolation' (estimating unknown values inside the range of existing data) and 'extrapolation' (estimating values outside the range). Drawn: 7 points between x = 74 and 158, line extended to 214.", { avoid: ["sequence", "extrapolating a sequence"], doesNotShow: "the reliability rules beyond the caption; values" }),
  mk("population-sample", "Population and sample", ["random sample", "sampling", "sample"], popSample, "A large circle of blue dots labelled population with seven of the dots coloured red: the red dots are the sample, a smaller group chosen from the whole population.", "A sample from a population",
    "Standard statistics definitions (Oak KS4 unit 'Sampling'): a sample is a smaller group chosen from the whole population. Drawn: 30 population dots (golden-angle spiral), 7 chosen ones in red.", { avoid: ["sample space", "sample size", "stratified", "capture", "recapture", "bias", "stem and leaf"], doesNotShow: "how the sample is chosen (random, stratified); bias" }),
  mk("stratified-sample", "Stratified sample", ["stratified sample", "stratified sampling"], strataG, "A population split into three groups A, B and C of different sizes with red dots showing the sample: 3, 2 and 5 dots, in proportion to the sizes of the groups.", "Stratified sampling",
    "Oak KS4 lesson 'Stratified sampling': the sample takes each group in proportion to its size in the population. Drawn: groups of width 60, 40, 100 (3 : 2 : 5) with 3, 2 and 5 sampled dots.", { doesNotShow: "the population size; the sampling fraction" }),
  mk("locus-types", "Loci", ["locus", "loci"], locusTypes, "Four loci: a circle is the locus of points a fixed distance from a point; a line is the locus of points equidistant from two points (the perpendicular bisector); two parallel lines are the locus at a fixed distance from a line; two crossing lines bisecting the angles are the locus equidistant from two lines.", "Loci",
    "Oak keyword 'locus': a set of points that satisfy a given set of conditions ('loci' = several); Standard loci drawn exactly: circle, perpendicular bisector, parallel lines, angle bisectors (at 45 and 135 degrees for lines at 20 and 70 degrees).", { avoid: ["sphere"], doesNotShow: "constructions; loci with two conditions" }),
  mk("perpendicular-bisector", "Perpendicular bisector construction", ["perpendicular bisector", "perpendicular bisectors"], perpBisector, "A line AB with arcs of equal radius drawn from A and from B crossing above and below it; the line through the crossing points is the perpendicular bisector, meeting AB at its midpoint M at a right angle.", "Constructing a perpendicular bisector",
    "Standard construction (Oak KS4 'Loci and construction'): equal arcs from A and B meet at two points; the line through them bisects AB at 90°. Drawn exactly: AB = 120, arc radius 84, crossings at ±58.8 from AB, M the midpoint.", { avoid: ["chord"], doesNotShow: "compass or ruler images; measurements" }),
  mk("angle-bisector", "Angle bisector construction", ["angle bisector", "bisecting an angle", "bisect an angle", "bisector of an angle"], angleBisector, "Two lines meeting at a point O with an arc crossing both, two further equal arcs crossing at a point R, and the line OR splitting the angle into two equal angles x and x.", "Constructing an angle bisector",
    "Oak lesson 'Bisecting an angle' (KS4 Y11): arc across the two arms, then equal arcs from the two crossing points meet at a point on the bisector. Drawn exactly: angle 70°, first arc radius 46, second arcs radius 40 (meeting at distance 67.75 on the 35° line).", { avoid: ["perpendicular bisector", "rhomb"], doesNotShow: "compass or ruler images; measurements" }),
];

export const EXT_MATHS_SECONDARY: Pic[] = [...E1,...E3,...E4,...E5,...E6];
