// X3 Science extension, physics: formula triangles, electricity, magnetism, energy, forces, light, sound, waves, radioactivity and the atom.
import type { Pic } from "./types";
import { mk, thick, box, plate, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, range, put } from "./ext-science-kit";

const wave = (x0: number, x1: number, f: (x: number) => number, step = 2) => { let w = ""; for (let x = x0; x <= x1; x += step) w += `${x},${f(x).toFixed(1)} `; return w.trim(); };
const pl = (pts: string, c = "l") => `<polyline points="${pts}" class="${c}"/>`;

// ── formula triangles ───────────────────────────────────────────────────────
const tri = (top: string, bl: string, br: string, lines: string[]) => {
  // (image QA: base 128 wide so "distance" / "pressure" fit inside their cells without crossing the sloping sides)
  const cx = 120, T: [number, number] = [cx, 8], L: [number, number] = [cx - 64, 88], Rr: [number, number] = [cx + 64, 88];
  return poly([T, L, Rr], "l f1") + ln(cx - 48, 56, cx + 48, 56, "th2") + ln(cx, 56, cx, 88, "th2") + txt(cx, 46, top, "tx") + txt(cx - 30, 78, bl, "tx") + txt(cx + 30, 78, br, "tx")
    + lines.map((l, i) => txt(120, 110 + i * 14, l, i === 0 ? "tx" : "tx tm")).join("");
};
const speedTri = tri("distance", "speed", "time", ["speed = distance ÷ time", "distance = speed × time", "time = distance ÷ speed"]);
const densityTri = tri("mass", "density", "volume", ["density = mass ÷ volume", "mass = density × volume", "volume = mass ÷ density"]);
const pressureTri = tri("force", "pressure", "area", ["pressure = force ÷ area", "force = pressure × area", "area = force ÷ pressure"]);
const accelTri = tri("Δv", "a", "t", ["a = Δv ÷ t", "Δv = change in velocity", "a = acceleration, t = time taken"]);
const waveTri = tri("v", "f", "λ", ["v = f × λ", "v = wave speed, f = frequency,", "λ = wavelength"]);
const ohmTri = tri("V", "I", "R", ["V = I × R", "V = potential difference, I = current,", "R = resistance"]);

// ── measuring current and potential difference ──────────────────────────────
const measuring = (() => {
  let s = path("M40 60 H200 V128 H40 Z", "l");
  const gapR = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="f0" stroke="none"/>`;
  s += gapR(100, 52, 40, 16) + circ(120, 60, 11, "l f0") + ln(112, 52, 128, 68, "th2") + ln(112, 68, 128, 52, "th2");
  s += gapR(100, 120, 40, 16) + circ(120, 128, 11, "l f0") + txt(120, 132, "A", "ts");
  s += gapR(32, 82, 16, 20) + ln(32, 88, 48, 88, "l") + ln(37, 96, 43, 96, "l").replace('class="l"', 'class="l" stroke-width="4"');
  s += path("M100 60 V26 H109", "l") + circ(120, 26, 11, "l f0") + txt(120, 30, "V", "ts") + path("M131 26 H140 V60", "l") + dot(100, 60, 2.6) + dot(140, 60, 2.6);
  return s + txt(120, 96, "", "tx") + txt(206, 132, "ammeter", "tx tl").replace('x="206"', 'x="146"').replace('y="132"', 'y="148"').replace("tl", "tl") + txt(8, 30, "voltmeter", "tx tl").replace('x="8"', 'x="146"').replace('y="30"', 'y="26"') + txt(24, 92, "cell", "tx te").replace('x="24"', 'x="26"') + txt(120, 164, "ammeter in series measures the current;", "tx tm") + txt(120, 175, "voltmeter across a component measures p.d.", "tx tm");
})();

// ── current-potential difference graphs ─────────────────────────────────────
const ivGraphs = (() => {
  let s = "";
  const panel = (cx: number, name: string, curve: string) => arrow(cx - 34, 70, cx + 34, 70, "l", 5) + arrow(cx, 104, cx, 20, "l", 5) + curve + txt(cx, 122, name, "tx") + txt(cx + 36, 66, "V", "tt tl").replace('x="' + (cx + 36) + '"', 'x="' + (cx + 34) + '"') + txt(cx + 6, 22, "I", "tt tl");
  const res = pl(`${40 - 32},${70 + 26} ${40 + 32},${70 - 26}`, "a").replace(/40/g, "40");
  s += panel(42, "resistor", pl("10,96 74,44", "a")) + panel(120, "filament lamp", pl(wave(94, 146, (x) => 70 - 30 * Math.tanh((x - 120) / 10), 2), "a")) + panel(198, "diode", pl(`${164},70 ${196},70 ${208},50 ${214},20`, "a"));
  void res;
  return s + txt(120, 146, "resistor: straight line through the origin", "tt") + txt(120, 156, "lamp: the line bends (resistance rises as it heats)", "tt") + txt(120, 166, "diode: current flows in one direction only", "tt");
})();

// ── electromagnet ───────────────────────────────────────────────────────────
const electromagnet = (() => {
  let s = rect(80, 56, 90, 22, "l f6", 2);
  s += range(9).map((i) => ln(84 + i * 9, 50, 92 + i * 9, 84, "l")).join("");
  s += path("M84 84 V124 H112", "l") + path("M132 124 H164 V50 L160 50", "l") + ln(112, 116, 112, 132, "l") + ln(120, 120, 120, 128, "l").replace('class="l"', 'class="l" stroke-width="4"') + ln(112, 124, 120, 124, "l").replace('class="l"', 'class="l" opacity="0"') + ln(120, 124, 132, 124, "l");
  s += [[100, 92], [116, 96], [140, 94]].map((p) => `<g transform="translate(${p[0]} ${p[1]})">${path("M0 0 v8 q0 4 3 4 t3 -4 v-6", "th2")}</g>`).join("");
  return s + tag("iron core", 190, 28, 150, 58) + tag("coil of wire", 176, 44, 128, 52) + tag("cell", 190, 136, 122, 126) + txt(120, 152, "stronger with more turns or a bigger current", "tx tm") + txt(120, 164, "(paper clips are attracted while the current flows)", "tt tm");
})();

// ── magnetic field of a bar magnet ──────────────────────────────────────────
const field = (() => {
  let s = "";
  const arc = (sc: number, sign: number) => {
    const P0: [number, number] = [150, 85 + sign * 4], P1: [number, number] = [150 + 46 + sc * 0.5, 85 + sign * (4 + sc * 1.6)], P2: [number, number] = [90 - 46 - sc * 0.5, 85 + sign * (4 + sc * 1.6)], P3: [number, number] = [90, 85 + sign * 4];
    const B = (t: number) => [0, 1].map((k) => (1 - t) ** 3 * P0[k] + 3 * (1 - t) ** 2 * t * P1[k] + 3 * (1 - t) * t * t * P2[k] + t ** 3 * P3[k]) as [number, number];
    const D = (t: number) => [0, 1].map((k) => 3 * (1 - t) ** 2 * (P1[k] - P0[k]) + 6 * (1 - t) * t * (P2[k] - P1[k]) + 3 * t * t * (P3[k] - P2[k]));
    const m = B(0.5), d = D(0.5), a = Math.atan2(d[1], d[0]);
    return path(`M${P0[0]} ${P0[1]} C${P1[0].toFixed(1)} ${P1[1].toFixed(1)} ${P2[0].toFixed(1)} ${P2[1].toFixed(1)} ${P3[0]} ${P3[1]}`, "th2") + `<polygon points="${m[0] + 6 * Math.cos(a)},${m[1] + 6 * Math.sin(a)} ${m[0] - 3 * Math.cos(a) + 4 * Math.sin(a)},${m[1] - 3 * Math.sin(a) - 4 * Math.cos(a)} ${m[0] - 3 * Math.cos(a) - 4 * Math.sin(a)},${m[1] - 3 * Math.sin(a) + 4 * Math.cos(a)}" class="hd"/>`;
  };
  [10, 26, 42].forEach((sc) => { s += arc(sc, -1) + arc(sc, 1); });
  s += rect(90, 74, 30, 22, "l f1") + rect(120, 74, 30, 22, "l f4") + txt(105, 89, "S", "ts") + txt(135, 89, "N", "ts");
  return s + txt(120, 150, "field lines run from north pole to south pole;", "tx") + txt(120, 162, "closest together = strongest field", "tx tm");
})();

// ── electrostatics ──────────────────────────────────────────────────────────
const statics = (() => {
  const ch = (x: number, y: number, sg: string) => circ(x, y, 11, sg === "+" ? "l f4" : "l f1") + txt(x, y + 4.5, sg, "tb");
  return ch(60, 30, "+") + ch(96, 30, "+") + arrow(50, 30, 30, 30, "ar", 6) + arrow(106, 30, 126, 30, "ar", 6) + txt(180, 34, "repel", "ts")
    + ch(60, 76, "−") + ch(96, 76, "−") + arrow(50, 76, 30, 76, "ar", 6) + arrow(106, 76, 126, 76, "ar", 6) + txt(180, 80, "repel", "ts")
    + ch(60, 122, "+") + ch(96, 122, "−") + arrow(20, 122, 46, 122, "ag", 6) + arrow(136, 122, 110, 122, "ag", 6) + txt(180, 126, "attract", "ts")
    + txt(120, 156, "like charges repel, opposite charges attract", "tx tm");
})();

// ── energy stores ───────────────────────────────────────────────────────────
const stores = (() => {
  const names: string[][] = [["thermal"], ["kinetic"], ["gravitational", "potential"], ["elastic", "potential"], ["chemical"], ["nuclear"], ["magnetic"], ["electrostatic"]];
  let s = "";
  names.forEach((n, i) => { const c = i % 2, r = Math.floor(i / 2); s += box(6 + c * 118, 4 + r * 30, 110, 26, n, `l ${["f4", "f3", "f1", "f2"][r]}`); });
  return s + txt(120, 136, "energy is transferred between stores by:", "tx") + txt(120, 148, "forces, electric current, heating,", "tx tm") + txt(120, 159, "and waves (such as light and sound)", "tx tm");
})();

// ── Sankey diagram ──────────────────────────────────────────────────────────
const sankey = (() => {
  let s = rect(10, 50, 60, 44, "l f3") + rect(70, 50, 150, 14, "l f2") + poly([[70, 64], [110, 64], [150, 110], [150, 138], [110, 94], [70, 94]], "l f4");
  s += arrow(200, 57, 232, 57, "ag", 6).replace("200", "218");
  return s + txt(40, 40, "energy input", "tx") + txt(150, 44, "useful energy output", "tx") + txt(40, 108, "total in", "tx tm").replace("total in", "") + txt(166, 128, "wasted energy", "tx tl") + txt(120, 156, "the widths show the amounts of energy:", "tx tm") + txt(120, 167, "total input = useful output + wasted energy", "tx tm");
})();

// ── energy resources ────────────────────────────────────────────────────────
const resources = (() => {
  const col = (x: number, title: string, c: string, items: string[]) => rect(x, 6, 112, 132, `l ${c}`, 8) + txt(x + 56, 24, title, "ts") + items.map((t, i) => txt(x + 56, 44 + i * 15, t, "tx")).join("");
  return col(6, "non-renewable", "f4", ["coal", "oil", "natural gas", "nuclear fuel"]) + col(122, "renewable", "f2", ["wind", "solar", "hydroelectric", "tides and waves", "geothermal", "biomass"]) + txt(120, 152, "non-renewable resources will run out;", "tx tm") + txt(120, 163, "renewable resources are replaced naturally", "tx tm");
})();

// ── heat transfer ───────────────────────────────────────────────────────────
const heat = (() => {
  const flame = (x: number, y: number) => path(`M${x} ${y} Q${x - 6} ${y - 8} ${x} ${y - 16} Q${x + 6} ${y - 8} ${x} ${y} Z`, "l f3");
  let s = "";
  s += rect(14, 30, 56, 14, "l f6", 3) + [[22, 37], [34, 37], [46, 37], [58, 37]].map((p) => circ(p[0], p[1], 3, "th2 f4")).join("") + flame(8, 44) + arrow(20, 58, 64, 58, "ar", 5);
  s += rect(90, 26, 60, 60, "l f0", 4) + path("M91 42 H149 V82 Q149 85 146 85 H94 Q91 85 91 82 Z", "th f1") + arrow(120, 78, 120, 48, "ar", 6) + arrow(102, 50, 102, 78, "a", 6) + arrow(138, 50, 138, 78, "a", 6) + flame(120, 104);
  s += rect(172, 34, 18, 40, "l f4", 3) + [0, 1, 2].map((i) => pl(wave(196, 232, (x) => 54 + 5 * Math.sin((x - 196) / 4 + i) + (i - 1) * 12, 3), "ar")).join("");
  const t = (x: number, a: string, b: string, c: string) => txt(x, 122, a, "ts") + txt(x, 134, b, "tx tm") + txt(x, 145, c, "tx tm");
  return s + t(41, "conduction", "particles", "vibrate") + t(120, "convection", "warm fluid", "rises") + t(201, "radiation", "infrared", "waves") + txt(120, 165, "three ways thermal energy is transferred", "tx");
})();

// ── moments ─────────────────────────────────────────────────────────────────
const moments = (() => {
  let s = ln(20, 84, 220, 84, "l").replace('class="l"', 'class="l" stroke-width="5"') + poly([[120, 88], [108, 116], [132, 116]], "l f6");
  s += arrow(60, 40, 60, 80, "ar", 7) + arrow(190, 40, 190, 80, "ar", 7);
  s += ln(60, 100, 120, 100, "th2") + ln(120, 100, 190, 100, "th2") + arrow(90, 100, 62, 100, "l", 4).replace("90", "90") + arrow(90, 100, 118, 100, "l", 4) + arrow(155, 100, 122, 100, "l", 4) + arrow(155, 100, 188, 100, "l", 4);
  return s + txt(60, 30, "force", "tx tr") + txt(190, 30, "force", "tx tr") + txt(90, 112, "distance", "tt") + txt(155, 112, "distance", "tt") + txt(120, 132, "pivot", "tx") + txt(120, 148, "moment = force × distance from the pivot", "tx") + txt(120, 160, "balanced: clockwise moment", "tx tm") + txt(120, 171, "= anticlockwise moment", "tx tm");
})();

// ── Hooke's law ─────────────────────────────────────────────────────────────
const hooke = (() => {
  const pts = wave(30, 100, (x) => 130 - (x - 30) * 1.0, 5);
  const curve = "M100 60 C116 46 130 42 150 38 C170 34 190 32 214 30";
  return arrow(30, 130, 226, 130, "l", 6) + arrow(30, 130, 30, 12, "l", 6) + pl(pts, "a") + path(curve.replace("M100 60", "M100 60"), "a") + circ(100, 60, 3, "th2 fr").replace("th2 fr", "th2 fr")
    + txt(126, 146, "extension", "tx tm") + `<text x="14" y="76" class="t tx tm" transform="rotate(-90 14 76)">force</text>` + txt(108, 76, "limit of proportionality", "tx tl").replace('x="108"', 'x="106"').replace('y="76"', 'y="82"') + txt(110, 110, "straight line:", "tx tl") + txt(110, 121, "force ∝ extension", "tx tl") + txt(120, 164, "the spring returns to its shape below the limit", "tx tm");
})();

// ── friction and resistance ─────────────────────────────────────────────────
const friction = (() => {
  let s = "";
  const mv = (cx: number, y: number) => arrow(cx - 20, y, cx + 22, y, "ag", 6);
  s += rect(10, 46, 50, 30, "l f3", 3) + ln(6, 76, 78, 76, "l") + range(9).map((i) => ln(6 + i * 9, 76, 2 + i * 9, 84, "th")).join("") + arrow(36, 32, 74, 32, "ag", 6) + arrow(46, 62, 14, 62, "ar", 6).replace("46", "56");
  s += put(120, 60, path("M-26 12 V-4 Q-24 -12 -14 -12 H10 Q22 -12 26 0 L30 12 Z", "l f1") + circ(-14, 14, 6, "l f6") + circ(16, 14, 6, "l f6")) + arrow(104, 34, 138, 34, "ag", 6) + arrow(154, 60, 140, 60, "ar", 6);
  s += path("M182 74 H232 L226 60 H190 Z", "l f4") + ln(200, 60, 200, 40, "l") + poly([[200, 40], [220, 60], [200, 60]], "l f0") + arrow(190, 30, 232, 30, "ag", 6) + arrow(196, 68, 180, 68, "ar", 6);
  s += `<path d="M6 96 H234" class="th"/>`;
  return s + txt(36, 100, "friction", "tx") + txt(116, 100, "air", "tx") + txt(116, 111, "resistance", "tx") + txt(206, 100, "water", "tx") + txt(206, 111, "resistance", "tx") + txt(120, 128, "these forces act against the motion", "tx") + txt(120, 140, "and slow moving objects down", "tx") + txt(120, 154, "green arrow: direction of motion", "tt tg") + txt(120, 164, "red arrow: the resisting force", "tt tr");
})();

// ── generic forces ──────────────────────────────────────────────────────────
const forces = (() => {
  let s = rect(96, 22, 48, 30, "l f1", 4) + arrow(20, 37, 92, 37, "ar", 8) + rect(96, 82, 48, 30, "l f1", 4) + arrow(92, 97, 20, 97, "a", 8);
  return s + txt(56, 28, "push", "ts") + txt(56, 88, "pull", "ts") + txt(190, 42, "the box is pushed", "tx") + txt(190, 102, "the box is pulled", "tx") + txt(120, 132, "a force is a push or a pull, in newtons (N)", "tx") + txt(120, 145, "the arrow shows the direction of the force;", "tx tm") + txt(120, 156, "a longer arrow means a bigger force", "tx tm");
})();

// ── contact and non-contact forces ──────────────────────────────────────────
const contact = (() => {
  let s = rect(6, 6, 112, 128, "l f3", 8) + rect(122, 6, 112, 128, "l f1", 8);
  s += rect(44, 100, 26, 20, "l f0", 2) + arrow(14, 110, 42, 110, "ar", 6);
  s += rect(140, 96, 30, 14, "l f4", 2) + txt(148, 107, "N", "tt") + rect(170, 96, 16, 14, "l f1", 2) + txt(178, 107, "S", "tt") + arrow(220, 103, 190, 103, "ag", 5);
  return s + txt(62, 22, "contact forces", "ts") + txt(62, 40, "friction", "tx") + txt(62, 51, "air resistance", "tx") + txt(62, 62, "tension", "tx") + txt(62, 84, "objects touch", "tx tm") + txt(178, 22, "non-contact", "ts") + txt(178, 33, "forces", "ts") + txt(178, 50, "gravity", "tx") + txt(178, 61, "magnetic force", "tx") + txt(178, 72, "electrostatic", "tx") + txt(178, 83, "force", "tx") + txt(178, 126, "objects apart", "tx tm")
    + txt(120, 148, "contact: the objects are touching", "tx tm") + txt(120, 160, "non-contact: they act across a gap", "tx tm");
})();

// ── terminal velocity ───────────────────────────────────────────────────────
const terminal = (() => {
  let s = "";
  const stage = (cx: number, up: number, cap: string, cap2: string) => circ(cx, 68, 10, "l f3") + arrow(cx, 78, cx, 78 + 36, "ar", 6) + (up ? arrow(cx, 58, cx, 58 - up, "a", 6) : "") + txt(cx, 132, cap, "tx") + txt(cx, 143, cap2, "tx tm");
  s += stage(40, 6, "just starts", "to fall") + stage(120, 22, "speeding up,", "air resistance grows") + stage(200, 36, "terminal", "velocity");
  return s + txt(120, 14, "red: weight, blue: air resistance", "tx tm") + txt(120, 160, "at terminal velocity the forces are balanced,", "tx tm") + txt(120, 171, "so the speed stays constant", "tx tm");
})();

// ── stopping distance ───────────────────────────────────────────────────────
const stopping = (() => {
  let s = rect(10, 36, 36, 16, "l f1", 4) + circ(20, 54, 5, "l f6") + circ(38, 54, 5, "l f6");
  s += rect(56, 70, 80, 16, "l f3") + rect(136, 70, 96, 16, "l f4");
  s += path("M56 100 V106 H232 V100", "l") + txt(144, 118, "stopping distance", "ts") + txt(96, 64, "thinking distance", "tx") + txt(184, 64, "braking distance", "tx");
  return s + txt(56, 138, "driver sees", "tt") + txt(56, 147, "a hazard", "tt") + txt(136, 138, "brakes are", "tt") + txt(136, 147, "applied", "tt") + txt(232, 138, "car", "tt te") + txt(232, 147, "stops", "tt te") + ln(56, 86, 56, 130, "h") + ln(136, 86, 136, 130, "h") + ln(232, 86, 232, 130, "h") + txt(120, 165, "stopping distance = thinking distance + braking distance", "tt tm");
})();

// ── work done ───────────────────────────────────────────────────────────────
const work = (() => {
  return rect(70, 54, 50, 34, "l f1", 3) + ln(20, 88, 226, 88, "l") + arrow(20, 71, 66, 71, "ar", 8).replace("20", "20") + arrow(70, 108, 200, 108, "ag", 7) + ln(70, 92, 70, 112, "h") + ln(200, 92, 200, 112, "h") + txt(40, 62, "force", "tx tr") + txt(135, 124, "distance moved in the", "tx tg") + txt(135, 135, "direction of the force", "tx tg") + txt(120, 152, "work done = force × distance moved", "tx") + txt(120, 164, "energy transferred = work done", "tx tm");
})();

// ── how we see light ────────────────────────────────────────────────────────
const seeing = (() => {
  let s = rect(8, 22, 22, 14, "l f3", 2) + poly([[30, 22], [44, 14], [44, 44], [30, 36]], "l f3");
  s += arrow(46, 32, 106, 84, "ao", 7) + arrow(112, 96, 200, 96, "ao", 7).replace("112", "112") + circ(112, 92, 12, "l f4");
  s += arrow(124, 90, 196, 60, "ao", 7).replace("196", "196");
  s += ell(212, 56, 14, 10, "l f0") + circ(212, 56, 4, "l f5");
  return s + txt(30, 56, "light source", "tx") + txt(112, 116, "object", "tx") + txt(212, 82, "eye", "tx") + txt(120, 138, "light travels in straight lines from a source;", "tx") + txt(120, 150, "we see an object when light from it", "tx tm") + txt(120, 161, "enters the eye", "tx tm");
})();

// ── shadows ─────────────────────────────────────────────────────────────────
const shadow = (() => {
  let s = poly([[104, 60], [200, 32], [200, 138], [104, 110]], "th f6") + ln(20, 85, 104, 60, "ao") + ln(104, 60, 200, 32, "ao") + ln(20, 85, 104, 110, "ao") + ln(104, 110, 200, 138, "ao");
  s += circ(20, 85, 8, "l f3") + rect(100, 60, 8, 50, "l f4", 1) + ln(200, 20, 200, 150, "l").replace('class="l"', 'class="l" stroke-width="3"') + ln(200, 32, 200, 138, "ag").replace('class="ag"', 'class="l" stroke-width="5"');
  return s + txt(20, 108, "light", "tx") + txt(20, 119, "source", "tx") + txt(88, 140, "opaque object", "tx") /* (image QA: below the lower ray, not across it) */ + txt(196, 82, "shadow", "tx te").replace('x="196"', 'x="192"') + txt(120, 157, "light travels in straight lines, so the object", "tx tm") + txt(120, 168, "blocks it and makes a shadow", "tx tm");
})();

// ── transparent, translucent, opaque ────────────────────────────────────────
const materials = (() => {
  let s = "";
  const panel = (cx: number, kind: number) => {
    let p = rect(cx - 6, 30, 12, 60, "l " + (kind === 0 ? "f0" : kind === 1 ? "f6" : "f4"), 1);
    for (let i = 0; i < 4; i++) { const y = 40 + i * 14; p += arrow(cx - 30, y, cx - 8, y, "ao", 5); if (kind === 0) p += arrow(cx + 8, y, cx + 30, y, "ao", 5); if (kind === 1) p += arrow(cx + 8, y, cx + 26, y + (i - 1.5) * 5, "ao", 5).replace('class="ao"', 'class="ao" opacity=".5"'); }
    return p;
  };
  s += panel(40, 0) + panel(120, 1) + panel(200, 2);
  const t = (x: number, a: string, ...b: string[]) => txt(x, 108, a, "ts") + b.map((l, i) => txt(x, 120 + i * 11, l, "tx tm")).join("");
  return s + t(40, "transparent", "light passes", "through") + t(120, "translucent", "some light", "passes,", "scattered") + t(200, "opaque", "no light", "passes through");
})();

// ── prism ───────────────────────────────────────────────────────────────────
const prism = (() => {
  const cols = ["#e21d27", "#f58d2b", "#f4dc2f", "#3fb56b", "#2b86c5", "#4b48b8", "#7a1f88"];
  let s = poly([[120, 24], [78, 120], [162, 120]], "l f0") + ln(8, 84, 102, 84, "l").replace('class="l"', 'class="l" stroke-width="3"') + ln(102, 84, 136, 92, "th2");
  cols.forEach((c, i) => { s += `<line x1="136" y1="92" x2="228" y2="${100 + i * 8}" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`; });
  return s + txt(40, 76, "white light", "tx") + txt(120, 76, "prism", "tx") + txt(200, 96, "red", "tt te").replace('x="200"', 'x="232"').replace('y="96"', 'y="94"') + txt(232, 162, "violet", "tt te") + txt(120, 150, "the colours of the spectrum:", "tx tm").replace('x="120"', 'x="90"') + txt(90, 161, "red bends least, violet most", "tx tm");
})();

// ── lenses ──────────────────────────────────────────────────────────────────
const lenses = (() => {
  let s = "";
  s += path("M60 30 Q76 70 60 110 Q44 70 60 30 Z", "l f1") + path("M180 30 Q170 70 180 110 Q200 70 180 30", "l f1").replace("Q170 70 180 110 Q200 70 180 30", "Q186 70 180 110 M180 30 Q174 70 180 110").replace("l f1", "l f1");
  s += [46, 70, 94].map((y) => arrow(10, y, 60, y, "ao", 5) + ln(60, y, 108, 70, "ao")).join("") + dot(108, 70, 2.6);
  s += [46, 70, 94].map((y) => ln(150, y, 180, y, "ao")).join("") + ln(180, 46, 214, 34, "ao") + ln(180, 94, 214, 106, "ao") + ln(180, 70, 214, 70, "ao").replace('class="ao"', 'class="ao"') + ln(180, 46, 156, 70, "h") + ln(180, 94, 156, 70, "h") + dot(156, 70, 2.6);
  s += ln(10, 70, 110, 70, "th") + ln(150, 70, 230, 70, "th");
  return s + txt(60, 24, "convex lens", "tx") + txt(180, 24, "concave lens", "tx") + txt(108, 86, "F", "tx") + txt(156, 86, "F", "tx") + txt(64, 122, "rays meet at the", "tx") + txt(64, 133, "principal focus", "tx") + txt(176, 122, "rays spread out", "tx") + txt(176, 133, "from the focus", "tx") + txt(120, 156, "focal length: lens to principal focus", "tx tm");
})();

// ── sound travelling ────────────────────────────────────────────────────────
const soundTravel = (() => {
  let s = rect(10, 40, 8, 60, "l f4", 2) + path("M22 50 q6 20 0 40", "th") + path("M28 44 q8 26 0 52", "th");
  const xs = [50, 58, 66, 92, 100, 108, 134, 142, 150, 176, 184, 192];
  xs.forEach((x, i) => { [0, 1, 2, 3, 4].forEach((r) => { s += circ(x + (r % 2) * 2, 44 + r * 12, 2, "th2 fs"); }); void i; });
  s += ell(220, 70, 10, 16, "l f0") + arrow(30, 132, 206, 132, "ag", 7);
  return s + txt(14, 112, "vibrating", "tx tl") + txt(14, 123, "object", "tx tl") + txt(120, 22, "air particles vibrate, passing", "tx tm") + txt(120, 32, "the vibration on", "tx tm") + txt(220, 100, "ear", "tx") + txt(120, 148, "sound needs particles to travel through:", "tx") + txt(120, 160, "it cannot travel through a vacuum", "tx tm") + txt(110, 112, "", "tx");
})();

// ── pitch and loudness ──────────────────────────────────────────────────────
const pitch = (() => {
  const w = (x0: number, y: number, amp: number, len: number) => pl(wave(x0, x0 + 100, (x) => y + amp * Math.sin((x - x0) / len), 2), "a");
  return w(10, 34, 8, 8) + w(126, 34, 20, 8) + w(10, 104, 16, 20) + w(126, 104, 16, 7)
    + txt(60, 62, "quiet:", "tx") + txt(60, 73, "small amplitude", "tx tm") + txt(176, 62, "loud:", "tx") + txt(176, 73, "large amplitude", "tx tm") + txt(60, 134, "low pitch:", "tx") + txt(60, 145, "low frequency", "tx tm") + txt(176, 134, "high pitch:", "tx") + txt(176, 145, "high frequency", "tx tm") + txt(120, 165, "louder = bigger amplitude", "tt tm") + txt(120, 174, "higher pitch = higher frequency", "tt tm");
})();

// ── frequency and period ────────────────────────────────────────────────────
const freq = (() => {
  return ln(20, 80, 228, 80, "th") + arrow(20, 130, 20, 20, "l", 5).replace("20", "20") + pl(wave(20, 216, (x) => 80 - 34 * Math.sin(((x - 20) / 98) * Math.PI * 2), 2), "a")
    + arrow(20, 130, 226, 130, "l", 5) + ln(20, 46, 20, 120, "th").replace("th", "th") + arrow(66, 30, 20 + 98 + 0, 30, "ag", 5).replace("66", "20") + arrow(118, 30, 20, 30, "ag", 5)
    + txt(69, 24, "one period T", "tx tg") + txt(122, 146, "time", "tx tm") + txt(120, 160, "frequency = waves per second, in hertz (Hz)", "tx") + `<text x="8" y="60" class="t tx tm" transform="rotate(-90 8 60)">displacement</text>`;
})();

// ── alpha, beta, gamma ──────────────────────────────────────────────────────
const radiation = (() => {
  let s = circ(16, 84, 9, "l f3") + txt(22, 106, "source", "tx");
  s += rect(88, 22, 4, 128, "l f0", 1) + rect(130, 22, 8, 128, "l f6", 1) + rect(174, 22, 24, 128, "l f4", 1);
  s += arrow(30, 44, 84, 44, "ar", 6) + arrow(30, 88, 126, 88, "ao", 6) + arrow(30, 132, 190, 132, "ag", 6);
  return s + txt(48, 36, "alpha", "tx tr") + txt(52, 80, "beta", "tx") + txt(56, 124, "gamma", "tx tg") + txt(90, 14, "paper", "tx") + txt(134, 14, "aluminium", "tx") + txt(186, 14, "thick lead", "tx") + txt(120, 160, "alpha stopped by paper, beta by aluminium,", "tx tm") + txt(120, 171, "gamma reduced by thick lead", "tx tm");
})();

// ── half-life ───────────────────────────────────────────────────────────────
const halflife = (() => {
  const y = (t: number) => 130 - 100 * Math.pow(0.5, t / 50);
  let s = arrow(30, 130, 226, 130, "l", 6) + arrow(30, 130, 30, 12, "l", 6) + pl(wave(30, 210, (x) => y(x - 30), 3), "a");
  [50, 100, 150].forEach((t) => { s += ln(30 + t, 130, 30 + t, y(t), "h") + ln(30, y(t), 30 + t, y(t), "h") + circ(30 + t, y(t), 3, "th2 fr"); });
  return s + txt(34, 26, "start", "tx tl") + txt(84, y(50) - 6, "half", "tx tl") + txt(134, y(100) - 6, "a quarter", "tx tl") + txt(184, y(150) - 6, "an eighth", "tx tl") + txt(80, 141, "one", "tt") + txt(80, 150, "half-life", "tt") + txt(130, 141, "two", "tt") + txt(130, 150, "half-lives", "tt") + txt(180, 141, "three", "tt") + txt(180, 150, "half-lives", "tt") + txt(120, 166, "the activity halves every half-life", "tx tm");
})();

// ── fission ─────────────────────────────────────────────────────────────────
const fission = (() => {
  let s = circ(10, 40, 3.5, "th2 f6") + arrow(16, 40, 44, 40, "l", 5) + circ(64, 40, 18, "l f4") + arrow(84, 40, 100, 40, "l", 5);
  s += circ(118, 26, 11, "l f4") + circ(118, 56, 11, "l f4") + circ(146, 20, 3.5, "th2 f6") + circ(148, 62, 3.5, "th2 f6") + circ(150, 41, 3.5, "th2 f6");
  s += arrow(156, 20, 176, 14, "l", 5) + arrow(158, 41, 178, 41, "l", 5) + arrow(158, 62, 178, 70, "l", 5) + circ(196, 14, 12, "l f4") + circ(196, 41, 12, "l f4") + circ(196, 72, 12, "l f4");
  return s + txt(36, 66, "neutron hits a", "tx") + txt(36, 77, "large nucleus", "tx") + txt(130, 92, "it splits into two smaller nuclei,", "tx") + txt(130, 103, "releasing energy and more neutrons", "tx") + txt(130, 122, "the extra neutrons can split more nuclei:", "tx tm") + txt(130, 133, "a chain reaction", "tx tm") + circ(20, 152, 3.5, "th2 f6") + txt(28, 155, "= neutron", "tx tl");
})();

// ── fusion ──────────────────────────────────────────────────────────────────
const fusion = (() => {
  return circ(28, 50, 12, "l f4") + txt(28, 54, "H", "tx") + circ(28, 100, 12, "l f4") + txt(28, 104, "H", "tx") + arrow(46, 56, 80, 72, "l", 6) + arrow(46, 96, 80, 80, "l", 6) + circ(112, 76, 18, "l f3") + txt(112, 80, "He", "tx") + arrow(136, 76, 160, 76, "l", 6) + circ(176, 60, 4, "th2 f6") + txt(190, 63, "neutron", "tx tl") + circ(176, 96, 5, "th2 fo") + txt(190, 99, "energy", "tx tl")
    + txt(120, 124, "two small nuclei join to make", "tx") + txt(120, 135, "a larger nucleus, releasing energy;", "tx") + txt(120, 146, "it happens in the core of stars", "tx tm") + txt(120, 157, "at very high temperature and pressure", "tx tm");
})();

// ── models of the atom ──────────────────────────────────────────────────────
const atomModels = (() => {
  let s = circ(40, 60, 30, "l f4");
  [[30, 50], [50, 46], [38, 72], [52, 68], [26, 66], [44, 58]].forEach((p) => { s += circ(p[0], p[1], 3, "th2 fs"); });
  s += circ(120, 60, 3, "l fr") + circ(120, 60, 30, "th f0").replace("th f0", "h").replace('class="h"', 'class="h" fill="none"') + circ(150, 60, 3, "th2 fs") + circ(96, 44, 3, "th2 fs") + circ(112, 88, 3, "th2 fs");
  s += circ(200, 60, 5, "l fr") + circ(200, 60, 16, "th f0").replace("th f0", "h").replace('class="h"', 'class="h" fill="none"') + circ(200, 60, 30, "h").replace('class="h"', 'class="h" fill="none"') + circ(216, 60, 3, "th2 fs") + circ(200, 30, 3, "th2 fs") + circ(184, 76, 3, "th2 fs") + circ(176, 60, 3, "th2 fs");
  return s + txt(40, 108, "plum pudding", "ts") + txt(40, 120, "ball of positive", "tx tm") + txt(40, 131, "charge with", "tx tm") + txt(40, 142, "electrons in it", "tx tm") + txt(120, 108, "nuclear model", "ts") + txt(120, 120, "tiny positive", "tx tm") + txt(120, 131, "nucleus, mostly", "tx tm") + txt(120, 142, "empty space", "tx tm") + txt(200, 108, "shell model", "ts") + txt(200, 120, "electrons in", "tx tm") + txt(200, 131, "energy levels", "tx tm") + txt(200, 142, "(shells)", "tx tm") + txt(120, 165, "each model replaced the one before it", "tx");
})();

// ── national grid ───────────────────────────────────────────────────────────
const grid = (() => {
  let s = box(2, 18, 50, 30, ["power", "station"], "l f4", "tx") + box(62, 18, 54, 30, ["step-up", "transformer"], "l f3", "tt") + box(122, 18, 54, 30, ["step-down", "transformer"], "l f3", "tt") + box(184, 18, 54, 30, ["homes and", "factories"], "l f2", "tt");
  s += arrow(52, 33, 60, 33, "l", 5) + arrow(116, 33, 120, 33, "l", 4) + arrow(176, 33, 182, 33, "l", 4);
  s += path("M120 56 H230", "l").replace("M120 56 H230", "M78 60 H160") + txt(120, 76, "high-voltage cables (the transmission lines)", "tx");
  return s + txt(120, 100, "high voltage means a low current", "tx") + txt(120, 112, "so less energy is wasted as heat", "tx") + txt(120, 134, "transformers change the voltage", "tx tm") + txt(120, 145, "(they only work with alternating current)", "tt tm");
})();

// ── a.c. and d.c. ───────────────────────────────────────────────────────────
const acdc = (() => {
  return arrow(20, 80, 226, 80, "l", 5) + arrow(20, 130, 20, 12, "l", 5) + ln(20, 46, 116, 46, "a") + pl(wave(124, 226, (x) => 80 - 30 * Math.sin(((x - 124) / 50) * Math.PI), 2), "ar") + ln(120, 20, 120, 130, "h")
    + txt(68, 30, "direct current", "tx") + txt(174, 30, "alternating current", "tx") + txt(68, 112, "flows one way only", "tx tm") + txt(174, 124, "changes direction", "tx tm") + txt(174, 135, "again and again", "tx tm") + txt(236, 96, "time", "tt te") + txt(120, 156, "graphs of potential difference", "tx tm") + txt(120, 167, "against time", "tx tm");
})();

// ── mains wires ─────────────────────────────────────────────────────────────
const mains = (() => {
  let s = "";
  const wire = (x: number, fill: string, stripe: boolean) => rect(x, 22, 30, 56, "l f0", 4) + `<rect x="${x + 4}" y="26" width="22" height="48" rx="3" fill="${fill}" stroke="none"/>` + (stripe ? [0, 1, 2, 3].map((i) => `<rect x="${x + 4}" y="${26 + i * 12}" width="22" height="6" fill="#f4dc2f"/>`).join("") : "");
  s += wire(30, "#8b5a2b", false) + wire(105, "#2b86c5", false) + wire(180, "#3fb56b", true);
  const t = (x: number, a: string, b: string, c: string) => txt(x, 94, a, "ts") + txt(x, 106, b, "tx tm") + txt(x, 117, c, "tx tm");
  return s + t(45, "live (brown)", "carries the", "current to it") + t(120, "neutral (blue)", "completes the", "circuit") + t(195, "earth", "(green/yellow)", "safety wire") + txt(120, 140, "a fuse in the live wire melts if the current is too big", "tt") + txt(120, 152, "the earth wire stops the case becoming live", "tt tm");
})();

// ── electrical conductors and insulators ────────────────────────────────────
const conductors = (() => {
  let s = rect(6, 6, 112, 128, "l f2", 8) + rect(122, 6, 112, 128, "l f4", 8);
  s += circ(62, 30, 10, "l f3") + ln(56, 24, 68, 36, "th2") + ln(56, 36, 68, 24, "th2") + circ(178, 30, 10, "l f0") + ln(172, 24, 184, 36, "th2") + ln(172, 36, 184, 24, "th2");
  s += range(6).map((i) => ln(62 + Math.cos((i / 6) * 6.28) * 14, 30 + Math.sin((i / 6) * 6.28) * 14, 62 + Math.cos((i / 6) * 6.28) * 19, 30 + Math.sin((i / 6) * 6.28) * 19, "ao")).join("");
  return s + txt(62, 62, "conductors", "ts") + txt(62, 76, "let electricity", "tx") + txt(62, 87, "pass through", "tx") + txt(62, 103, "metals such as", "tx tm") + txt(62, 114, "copper and iron", "tx tm") + txt(178, 62, "insulators", "ts") + txt(178, 76, "do not let", "tx") + txt(178, 87, "electricity through", "tx") + txt(178, 103, "plastic, rubber,", "tx tm") + txt(178, 114, "glass and wood", "tx tm") + txt(120, 152, "the lamp lights (left) or stays off (right)", "tx tm");
})();

export const PHYS: Pic[] = [
  mk("x3-speed-triangle", "Speed, distance and time", ["average speed", "speed equation", "speed formula", "calculating speed", "speed calculation", "speed calculations"], speedTri, "A formula triangle with distance at the top and speed and time at the bottom, with the three forms of the equation: speed equals distance divided by time, distance equals speed times time, time equals distance divided by speed.", "Speed, distance and time", "speed = distance / time (Oak KS2/KS3/KS4 'speed'); the triangle gives the three rearrangements.", { requires: ["distance", "time"], avoid: ["orbital", "satellite", "parachute", "wave speed", "speed of light", "speed of sound", "speed of reaction", "instantaneous", "terminal", "velocity", "acceleration", "rate of reaction", "speed time graph", "speed-time graph", "wave", "waves"], doesNotShow: "units; instantaneous speed; velocity" }),
  mk("x3-density-triangle", "Density, mass and volume", ["density", "densities", "calculating density", "density equation", "density formula"], densityTri, "A formula triangle with mass at the top and density and volume at the bottom, with the three forms of the equation: density equals mass divided by volume, mass equals density times volume, volume equals mass divided by density.", "Density, mass and volume", "density = mass / volume (Oak KS3/KS4 'density'); the triangle gives the three rearrangements.", { requires: ["mass", "volume"], avoid: ["population density", "energy density", "optical density", "charge density", "current density", "density of the atmosphere", "probability density", "frequency density", "particle model"], doesNotShow: "units; floating and sinking; the particle explanation" }),
  mk("x3-pressure-triangle", "Pressure, force and area", ["pressure", "pressures", "pressure equation", "calculating pressure", "pressure formula"], pressureTri, "A formula triangle with force at the top and pressure and area at the bottom, with the three forms of the equation: pressure equals force divided by area, force equals pressure times area, area equals force divided by pressure.", "Pressure, force and area", "pressure = force / area (Oak KS3/KS4 'pressure').", { requires: ["force", "area", "surface area"], avoid: ["blood pressure", "atmospheric pressure", "air pressure", "gas pressure", "gas pressures", "liquid pressure", "fluid pressure", "pressure in liquids", "pressure in gases", "water pressure", "pressure cooker", "rock", "rocks", "magma", "metamorphic", "depth", "volume", "temperature", "tyre", "balloon", "weather", "heat and pressure", "high pressure", "low pressure"], doesNotShow: "units; pressure in fluids; atmospheric pressure" }),
  mk("x3-acceleration-triangle", "Acceleration", ["acceleration", "accelerations", "accelerate", "accelerates", "accelerating", "change in velocity", "acceleration equation", "calculating acceleration"], accelTri, "A formula triangle with delta v (the change in velocity) at the top and acceleration a and time t at the bottom, giving a equals delta v divided by t.", "Acceleration", "acceleration = change in velocity / time taken (Oak KS3/KS4 'acceleration').", { requires: ["velocity", "speed", "time", "change"], avoid: ["newtons second law", "newton second law", "resultant force", "mass", "free fall", "gravity", "gravitational", "acceleration due to", "uniform acceleration", "suvat", "equations of motion", "graph", "graphs", "gradient", "terminal", "force", "forces"], doesNotShow: "units; deceleration; acceleration from a graph" }),
  mk("x3-wave-equation", "The wave equation", ["wave equation", "wave speed", "wave speed equation", "wave speeds"], waveTri, "A formula triangle with wave speed v at the top and frequency f and wavelength lambda at the bottom, giving v equals f times lambda.", "The wave equation", "wave speed = frequency x wavelength (v = f lambda) (Oak KS3/KS4 'wave equation').", { requires: ["frequency", "wavelength", "wave", "waves"], avoid: ["speed of light", "speed of sound"], doesNotShow: "units; values; the speed of light or sound" }),
  mk("x3-ohms-law", "Potential difference, current and resistance", ["ohms law", "ohm's law", "resistance", "resistor", "resistors", "electrical resistance"], ohmTri, "A formula triangle with V (potential difference) at the top and I (current) and R (resistance) at the bottom, giving V equals I times R.", "V = I × R", "V = I R: potential difference (volts) = current (amps) x resistance (ohms) (Oak KS3/KS4 'resistance', 'Ohm's law').", { requires: ["current", "circuit", "circuits", "potential difference", "voltage", "volt", "volts", "resistor", "resistors", "ohm", "ohms", "electrical"], avoid: ["air resistance", "water resistance", "resistance training", "drug resistance", "antibiotic", "antibiotics", "resistant", "wind resistance", "bacterial resistance", "resistance to", "insulin resistance"], doesNotShow: "units on the axes; how resistance changes; the I-V graphs; series and parallel circuits" }),
  mk("x3-measuring-electricity", "Ammeter and voltmeter", ["ammeter", "ammeters", "voltmeter", "voltmeters", "potential difference", "voltage", "measuring current", "electric current", "current"], measuring, "A circuit with a cell, a lamp and an ammeter in one loop, so the ammeter is in series with the lamp, and a voltmeter connected across the lamp on its own branch.", "Measuring current and potential difference", "An ammeter is connected in series to measure the current through a component; a voltmeter is connected in parallel (across the component) to measure the potential difference (Oak KS3/KS4 'ammeter', 'voltmeter').", { h: 180, requires: ["circuit", "circuits", "ammeter", "voltmeter", "ampere", "amp", "amps", "charge", "potential difference", "electrons", "cell", "battery", "volt", "volts", "component", "lamp", "resistance", "electrical"], avoid: ["electric shock", "high voltage", "insulators", "insulator", "danger", "dangerous", "current affairs", "ocean current", "water current", "air current", "convection current", "convection currents", "eddy", "alternating", "direct current", "induced", "generator", "transformer", "national grid", "mains", "electromagnet", "magnetic field", "series circuit", "parallel circuit", "electrolysis"], doesNotShow: "the direction of the current; values on the meters; the cell's polarity" }),
  mk("x3-iv-graphs", "Current-potential difference graphs", ["iv graph", "iv graphs", "iv characteristic", "iv characteristics", "current-voltage graph", "current voltage graph", "current potential difference graph", "ohmic conductor", "filament lamp", "diode"], ivGraphs, "Three current against potential difference graphs: a resistor gives a straight line through the origin, a filament lamp gives a line that bends over because its resistance rises as it heats, and a diode lets current flow in one direction only.", "I-V graphs", "I-V characteristics: resistor at constant temperature = straight line through the origin; filament lamp = curve, resistance increases with temperature; diode = current flows in one direction only (Oak KS4 'filament lamp', 'diode').", { requires: ["current", "potential difference", "voltage", "resistance", "circuit"], doesNotShow: "the axes' values; the thermistor and LDR; the diode's threshold voltage" }),
  mk("x3-electromagnet", "Electromagnet", ["electromagnet", "electromagnets", "solenoid", "solenoids"], electromagnet, "An electromagnet: an iron core with a coil of wire wrapped round it and joined to a cell; when the current flows the core becomes a magnet and attracts paper clips. It is stronger with more turns or a bigger current.", "An electromagnet", "Electromagnet: a coil of wire (solenoid) round an iron core; current makes it magnetic; strength increases with more turns of wire or a larger current (Oak KS3/KS4 'electromagnet').", { avoid: ["motor", "electric motor", "generator", "loudspeaker", "relay", "magnetic field lines"], doesNotShow: "the magnetic field lines; uses such as cranes or bells; the polarity of the poles" }),
  mk("x3-magnetic-field", "Magnetic field of a bar magnet", ["magnetic field", "magnetic fields", "magnetic field lines", "field lines", "magnetic field line"], field, "The magnetic field of a bar magnet drawn as field lines that leave the north pole, loop round and enter the south pole, with arrows showing that direction; the lines are closest together near the poles where the field is strongest.", "The magnetic field of a bar magnet", "Field lines of a bar magnet run from the north pole to the south pole outside the magnet; the closer together the lines, the stronger the field (Oak KS3/KS4 'magnetic field').", { requires: ["magnet", "magnets", "magnetic", "pole", "poles", "compass"], avoid: ["earths magnetic field", "earths", "electromagnet", "solenoid", "wire", "electric field", "current-carrying", "motor effect", "planet"], doesNotShow: "the field of an electromagnet or the Earth; field strength values" }),
  mk("x3-electrostatics", "Electric charges", ["static electricity", "electrostatic", "electrostatic force", "electrostatic forces", "like charges", "opposite charges", "unlike charges", "electric charge", "electric charges", "positive charge", "negative charge", "positively charged", "negatively charged"], statics, "Electric charges: two positive charges repel each other, two negative charges repel each other, and a positive and a negative charge attract each other, shown with arrows.", "Like charges repel, opposite charges attract", "Like charges repel, opposite (unlike) charges attract (Oak KS3/KS4 'electrostatic force').", { avoid: ["current", "circuit", "ion", "ions", "ionic", "nucleus", "proton", "electron shell"], doesNotShow: "how objects become charged; electric fields; the size of the force" }),
  mk("x3-energy-stores", "Energy stores and transfers", ["energy store", "energy stores", "energy transfer", "energy transfers", "energy pathway", "energy pathways", "energy stores and transfers"], stores, "The eight energy stores: thermal, kinetic, gravitational potential, elastic potential, chemical, nuclear, magnetic and electrostatic, with the ways energy is transferred between them: by forces, by electric current, by heating and by waves such as light and sound.", "Energy stores and transfers", "Energy stores: thermal, kinetic, gravitational potential, elastic potential, chemical, nuclear, magnetic, electrostatic; energy is transferred by forces (mechanically), electric current (electrically), heating and waves (radiation) (Oak KS3/KS4 'energy stores').", { avoid: ["electromagnetic", "ionising", "ionisation", "wave", "waves", "trophic", "food chain", "food web", "producers", "consumers", "photosynthesis", "respiration", "ecosystem", "energy transfer diagram", "sankey"], doesNotShow: "which store a given object has; conservation of energy; efficiency" }),
  mk("x3-sankey", "Sankey diagram", ["sankey diagram", "sankey diagrams", "wasted energy", "energy wasted", "useful energy", "useful energy output", "dissipate", "dissipated", "dissipation", "conservation of energy", "energy efficiency", "efficiency"], sankey, "A Sankey diagram: a wide arrow of input energy splits into a narrower arrow of useful energy output and a bent-away arrow of wasted energy; the widths show the amounts, so the total input equals the useful output plus the wasted energy.", "A Sankey diagram", "Sankey diagram: arrow width shows the amount of energy; the input arrow splits into useful output and wasted energy; energy is conserved so input = useful output + wasted (Oak KS3/KS4 'conservation of energy', 'efficiency', 'dissipate').", { requires: ["energy", "useful", "wasted", "efficiency", "efficient", "input", "output"], avoid: ["equilibrium", "reaction", "reactions", "yield", "atom economy", "reactant", "reactants", "cost", "safety", "chemical", "pressure", "trophic", "food chain", "producers", "consumers", "photosynthesis", "respiration", "ecosystem", "biomass", "efficiency of a reaction", "atom economy", "yield"], doesNotShow: "actual energy values or a specific device; the calculation of efficiency" }),
  mk("x3-energy-resources", "Renewable and non-renewable energy resources", ["energy resource", "energy resources", "renewable", "non-renewable", "nonrenewable", "renewable energy", "non renewable energy", "renewable energy resources", "fossil fuel", "fossil fuels"], resources, "Energy resources in two groups: non-renewable (coal, oil, natural gas, nuclear fuel) which will run out, and renewable (wind, solar, hydroelectric, tides and waves, geothermal, biomass) which are replaced naturally.", "Renewable and non-renewable energy resources", "Non-renewable: coal, oil, natural gas (fossil fuels) and nuclear fuel; renewable: wind, solar, hydroelectric, tides, waves, geothermal, biomass (Oak KS3/KS4 'renewable', 'fossil fuel').", { requires: ["energy", "electricity", "power", "fuel", "fuels", "generate", "generating"], avoid: ["fuel cell", "fuel cells", "national grid", "hydrogen", "wood", "paper", "timber", "water resource", "materials", "raw materials", "crude oil", "hydrocarbon", "cracking", "plastic", "polymer", "fractional distillation"], doesNotShow: "how each resource generates electricity; advantages and disadvantages; percentages" }),
  mk("x3-heat-transfer", "Conduction, convection and radiation", ["conduction", "convection", "convection current", "convection currents", "thermal radiation", "infrared radiation", "heat transfer", "thermal conduction", "thermal energy transfer", "thermal energy transfers"], heat, "Three ways thermal energy is transferred: conduction, where vibrating particles pass energy along a solid; convection, where warm fluid rises and cool fluid sinks; and radiation, where infrared waves carry energy without needing particles.", "Conduction, convection and radiation", "Conduction: particles vibrate and pass energy on (solids); convection: warmer, less dense fluid rises and cooler fluid sinks; thermal radiation: infrared waves, no medium needed (Oak KS3/KS4 'thermal conduction', 'convection', 'infrared radiation').", { requires: ["heat", "thermal", "hot", "cold", "temperature", "energy", "particles", "warm"], avoid: ["electrical conduction", "electrical conductor", "conduction of electricity", "conductor of electricity", "electric current", "electrical", "nerve", "mantle", "tectonic", "magma", "insulators", "nuclear radiation", "alpha", "beta", "gamma", "radioactive", "ionising"], doesNotShow: "insulators, U-values or rates of transfer; the mantle" }),
  mk("x3-moments", "Moments and levers", ["moment", "moments", "principle of moments", "turning effect", "lever", "levers", "pivot", "pivots"], moments, "A balanced beam on a pivot with a downward force on each side at a distance from the pivot; a moment is a force times its distance from the pivot, and the beam balances when the clockwise and anticlockwise moments are equal.", "Moments and levers", "Moment = force x perpendicular distance from the pivot; a balanced object has equal clockwise and anticlockwise moments (Oak KS3/KS4 'moments', 'lever', 'pivot').", { h: 178, requires: ["force", "forces", "pivot", "turning", "lever", "levers", "distance", "balance", "balanced"], avoid: ["momentum", "moment of inertia", "in a moment", "moment in time", "magnetic moment", "dipole"], doesNotShow: "values or units; gears; the direction of each moment beyond the labels" }),
  mk("x3-hookes-law", "Hooke's law", ["hookes law", "hooke's law", "spring constant", "limit of proportionality", "force extension graph", "force-extension graph", "force extension"], hooke, "A graph of force against extension for a spring: a straight line through the origin up to the limit of proportionality, where force is proportional to extension, then a curve that bends over.", "Hooke's law", "Hooke's law: extension is directly proportional to force up to the limit of proportionality; beyond it the line curves (Oak KS4 'Hooke's law', 'spring constant').", { requires: ["spring", "springs", "extension", "force", "elastic", "stretch", "stretching"], avoid: ["elastic store", "elastic potential", "energy of a spring", "energy of springs", "elastic energy"], doesNotShow: "values on the axes; the spring constant's calculation; elastic potential energy" }),
  mk("x3-friction-resistance", "Friction and resistance forces", ["friction", "frictional force", "frictional forces", "air resistance", "water resistance", "drag", "drag force", "drag forces"], friction, "Three moving objects each with an arrow for the direction of motion and a red arrow pointing the opposite way: friction on a sliding block, air resistance on a car and water resistance on a boat; these forces act against the motion and slow moving objects down.", "Friction, air resistance and water resistance", "Friction, air resistance (drag) and water resistance act in the direction opposite to the motion and slow moving objects (Oak KS2/KS3 'friction', 'air resistance', 'water resistance').", { requires: ["force", "forces", "motion", "moving", "move", "slow", "slows", "resist", "surface", "speed"], avoid: ["electrical resistance", "resistance training", "drug resistance", "antibiotic", "static friction", "lubricant", "lubricate", "terminal velocity", "parachute", "friction in a", "electrostatic", "rubbing to charge"], doesNotShow: "the size of each force; lubricants; terminal velocity; forces on stationary objects" }),
  mk("x3-forces-arrows", "Forces as pushes and pulls", ["force arrow", "force arrows", "push and pull", "pushes and pulls"], forces, "A box with a long arrow pushing it from the left and an arrow pulling it from the right, labelled push and pull; a force is a push or a pull, measured in newtons, and the arrow shows its direction and, by its length, its size.", "Forces are pushes and pulls", "A force is a push or a pull, measured in newtons (N); force arrows show direction and size (Oak KS2/KS3 'force').", { avoid: ["resultant", "balanced", "unbalanced", "friction", "gravity", "gravitational", "weight", "magnetic", "electric", "electrostatic", "upthrust", "air resistance", "drag", "tension", "lift", "thrust", "moment", "moments", "pivot", "pressure", "energy", "work done", "spring", "hookes", "contact", "non-contact", "newtons second", "newtons third", "newton's second", "newton's third", "terminal", "acceleration", "forces on", "force of attraction", "forces of attraction", "intermolecular", "particles", "mass", "reaction force", "normal", "field", "buoyancy", "extension", "stopping"], doesNotShow: "any specific force; balanced or unbalanced forces; force pairs" }),
  mk("x3-contact-forces", "Contact and non-contact forces", ["contact force", "contact forces", "non-contact force", "non-contact forces", "noncontact force", "noncontact forces"], contact, "Contact forces such as friction, air resistance and tension need the objects to touch; non-contact forces such as gravity, magnetic force and electrostatic force act across a gap.", "Contact and non-contact forces", "Contact forces (friction, air resistance, tension) act when objects touch; non-contact forces (gravity, magnetic, electrostatic) act at a distance (Oak KS3/KS4 'contact force', 'non-contact force').", { doesNotShow: "every example of each; the size of the forces; force pairs" }),
  mk("x3-terminal-velocity", "Terminal velocity", ["terminal velocity"], terminal, "A falling object at three moments: it has just started to fall and only a small air resistance arrow points up against its weight; it is speeding up as air resistance grows; at terminal velocity the two arrows are equal so the forces are balanced and the speed is constant.", "Terminal velocity", "A falling object accelerates until air resistance equals its weight; the resultant force is then zero and it falls at constant terminal velocity (Oak KS4 'terminal velocity').", { h: 176, requires: ["falling", "fall", "falls", "air resistance", "weight", "drag", "parachute", "parachutist", "skydiver"], doesNotShow: "the velocity-time graph; the value of terminal velocity; opening a parachute" }),
  mk("x3-stopping-distance", "Stopping distance", ["stopping distance", "stopping distances", "thinking distance", "thinking distances", "braking distance", "braking distances"], stopping, "A car followed by a bar in two parts: the thinking distance while the driver reacts and the braking distance after the brakes are applied; together they make the stopping distance.", "Stopping distance", "Stopping distance = thinking distance (driver's reaction) + braking distance (after brakes applied) (Oak KS4 'stopping distance').", { h: 174, doesNotShow: "the factors that change the distances; values or the relative sizes of the parts" }),
  mk("x3-work-done", "Work done", ["work done", "doing work"], work, "A box being pushed along a surface by a force arrow, with a distance arrow beneath it: work done equals the force times the distance moved in the direction of the force, and it is the energy transferred.", "Work done", "Work done = force x distance moved in the direction of the force; it equals the energy transferred (Oak KS4 'work done').", { requires: ["force", "forces", "energy", "distance", "joule", "joules"], avoid: ["work done against friction", "friction", "power", "gravitational potential energy", "elastic", "spring", "heating", "thermal"], doesNotShow: "the angle of the force; values or units; work done against friction as heating" }),
  mk("x3-seeing-light", "How we see", ["light source", "light sources", "how we see", "light ray", "light rays", "ray of light", "rays of light", "light travels in straight lines", "luminous", "non-luminous"], seeing, "A torch shining a ray of light onto an object and a second ray from the object into an eye; light travels in straight lines from a source, and we see an object when light from it enters the eye.", "How we see things", "Light travels in straight lines from a light source; we see an object when light from it (reflected or given out) enters the eye (Oak KS1-KS3 'light source').", { avoid: ["intensity", "inverse square", "waves", "lens", "lenses", "refract", "refraction", "refracted", "convex", "concave", "prism", "mirror", "mirrors", "reflect", "reflection", "reflected", "pinhole", "periscope", "camera", "eye defect", "shadow", "shadows", "diffraction", "plane mirror", "moon"], doesNotShow: "reflection at a mirror; how the eye focuses light; the direction of the rays leaving the object in all directions" }),
  mk("x3-shadow", "Shadows", ["shadow", "shadows"], shadow, "A point light source on the left, an opaque object in the middle and a screen on the right; straight rays skim the top and bottom of the object and the space between them behind the object is a shadow on the screen.", "How a shadow forms", "Light travels in straight lines and cannot pass through an opaque object, so a shadow forms behind it (Oak KS1-KS3 'shadow').", { requires: ["light", "opaque", "ray", "rays", "source", "block", "blocks", "blocked"], avoid: ["multiple shadow", "more than one light source", "two light sources", "solar eclipse", "lunar eclipse", "eclipse", "sundial", "moon", "puppet"], doesNotShow: "the size of the shadow as the object moves; partial shadows (penumbra); shadows of transparent objects" }),
  mk("x3-materials-light", "Transparent, translucent and opaque", ["transparent", "translucent", "opaque"], materials, "Three materials with rays of light coming from the left: a transparent material lets all the light pass straight through; a translucent one lets some light through, scattered; an opaque one lets no light through.", "Transparent, translucent and opaque materials", "Transparent: light passes straight through; translucent: some light passes but is scattered; opaque: no light passes (Oak KS1-KS3 'transparent', 'translucent', 'opaque').", { requires: ["light", "material", "materials", "see", "shadow", "shadows"], doesNotShow: "reflection or absorption; any particular material; refraction" }),
  mk("x3-prism", "Dispersion of white light", ["dispersion", "prism", "prisms", "white light", "visible spectrum", "spectrum of light", "colours of the spectrum", "rainbow"], prism, "A ray of white light entering a glass prism and coming out spread into a band of colours: red at the top, then orange, yellow, green, blue, indigo and violet at the bottom; red bends least and violet bends most.", "White light splitting into colours", "Dispersion: a prism refracts each colour by a different amount, spreading white light into the visible spectrum; red is refracted least and violet most (Oak KS3/KS4 'dispersion', 'white light').", { requires: ["light", "colour", "colours", "spectrum", "rainbow", "ray", "rays", "glass"], avoid: ["triangular prism", "hexagonal prism", "rectangular prism", "pentagonal prism", "volume", "net", "nets", "electromagnetic spectrum", "mass spectrum", "spectrometer", "emission spectrum", "absorption spectrum", "flame test"], doesNotShow: "the angles; how a rainbow forms in water drops; total internal reflection" }),
  mk("x3-lenses", "Convex and concave lenses", ["convex lens", "convex lenses", "concave lens", "concave lenses", "converging lens", "diverging lens", "principal focus", "focal length", "focal lengths"], lenses, "A convex lens bringing parallel rays of light together at its principal focus F, and a concave lens spreading parallel rays out so that they seem to come from its focus; the focal length is the distance from the lens to the principal focus.", "Convex and concave lenses", "A convex (converging) lens brings parallel rays to the principal focus; a concave (diverging) lens spreads them out as if from a virtual principal focus; focal length = distance from lens to principal focus (Oak KS4 'lens', 'principal focus', 'focal length').", { requires: ["lens", "lenses", "ray", "rays", "light", "focus"], avoid: ["camera", "microscope", "eye", "telescope", "spectacles", "glasses", "magnifying", "image", "virtual image", "real image"], doesNotShow: "images formed by lenses; ray diagrams with objects; the eye or a camera" }),
  mk("x3-sound-travel", "Sound travelling", ["sound wave", "sound waves", "sound source", "sound sources", "sound travels", "sound vibrations"], soundTravel, "A vibrating object on the left making the air particles next to it vibrate; the vibration is passed from particle to particle through the air to an ear on the right. Sound needs particles to travel through and cannot travel through a vacuum.", "How sound travels", "Sound is made by vibrations; the vibrations pass through a medium (solid, liquid or gas) from particle to particle; sound cannot travel through a vacuum (Oak KS1-KS4 'sound', 'vibration').", { avoid: ["electronic", "signal", "particles vibrate more", "pitch", "loudness", "loud", "quiet", "echo", "echoes", "ultrasound", "infrasound", "decibel", "decibels", "oscilloscope", "speed of sound", "hearing", "ear", "ears", "eardrum", "longitudinal", "transverse", "amplitude", "frequency", "wavelength", "sound level", "sounds like", "sound judgement", "sound reasoning", "sound conclusion", "sound investigation", "sound method"], doesNotShow: "the speed of sound; pitch or loudness; how the ear works; longitudinal waves as compressions and rarefactions" }),
  mk("x3-pitch-loudness", "Pitch and loudness", ["pitch", "loudness", "volume of a sound", "amplitude and pitch", "frequency and pitch"], pitch, "Four sound waves: a small-amplitude wave for a quiet sound and a large-amplitude wave for a loud sound; and a wave with a low frequency for a low pitch and a wave with a high frequency for a high pitch.", "Pitch and loudness", "Loudness depends on the amplitude of the sound wave; pitch depends on its frequency (Oak KS1-KS4 'pitch', 'loudness').", { h: 178, requires: ["sound", "sounds", "frequency", "hertz", "vibration", "vibrations", "loud", "quiet", "high", "low", "amplitude"], avoid: ["football pitch", "pitch angle", "perfect pitch", "pitch of a roof", "pitch of the screw", "pitch black", "sales pitch", "baseball", "cricket"], doesNotShow: "the units (hertz, decibels); the range of hearing; real waveforms" }),
  mk("x3-wave-frequency", "Frequency and period", ["frequency", "frequencies", "hertz", "wave frequency", "period of a wave", "wave period", "time period"], freq, "A wave drawn against time with one full wave marked as the period T; frequency is the number of waves per second, measured in hertz (Hz).", "Frequency and period of a wave", "Frequency = number of waves passing a point each second, in hertz (Hz); the period is the time for one complete wave (Oak KS3/KS4 'frequency').", { requires: ["wave", "waves", "hertz", "vibrations", "oscillation", "oscillations", "sound", "per second"], avoid: ["allele", "relative frequency", "frequency table", "frequency density", "cumulative frequency", "histogram", "tally", "data", "mean", "median", "carrier", "gene", "genetic", "population", "bar chart", "probability"], doesNotShow: "the equation period = 1 / frequency; wavelength; amplitude" }),
  mk("x3-radiation-penetration", "Alpha, beta and gamma radiation", ["alpha radiation", "beta radiation", "gamma radiation", "alpha particle", "alpha particles", "beta particle", "beta particles", "gamma ray", "gamma rays", "penetrating power", "ionising radiation", "types of radiation", "nuclear radiation", "alpha", "beta", "gamma"], radiation, "Three kinds of radiation from a source and what stops them: alpha particles are stopped by a sheet of paper, beta particles pass through paper but are stopped by a few millimetres of aluminium, and gamma rays pass through both and are only reduced by thick lead.", "Alpha, beta and gamma radiation", "Penetrating power: alpha is stopped by paper (or a few centimetres of air), beta by a few millimetres of aluminium, gamma is reduced by thick lead or concrete (Oak KS4 'alpha particle', 'gamma radiation').", { h: 176, requires: ["radiation", "radioactive", "radioactivity", "decay", "nuclear", "particle", "particles", "ray", "rays", "ionising", "penetrating"], avoid: ["alpha helix", "beta carotene", "electromagnetic spectrum", "em spectrum", "beta blocker", "alpha level", "gamma globulin", "x-ray", "x-rays"], doesNotShow: "what each radiation is made of; how far each travels in air; ionising strength" }),
  mk("x3-half-life", "Half-life", ["half life", "half-life", "half lives", "half-lives", "radioactive half-life", "radioactive decay"], halflife, "A graph of a radioactive source's activity falling with time in a curve: it drops to a half after one half-life, a quarter after two half-lives and an eighth after three half-lives.", "Half-life", "Half-life: the time for the activity (or the number of radioactive nuclei) to halve; the decay curve falls by half in each equal half-life interval (Oak KS4 'radioactive half-life').", { avoid: ["fraction", "half life of a", "biological half"], doesNotShow: "a particular isotope or values; the calculation; random decay" }),
  mk("x3-fission", "Nuclear fission", ["nuclear fission", "fission", "chain reaction", "chain reactions"], fission, "Nuclear fission: a neutron hits a large nucleus which splits into two smaller nuclei, releasing energy and more neutrons; the extra neutrons can split more large nuclei, making a chain reaction.", "Nuclear fission and a chain reaction", "Fission: a neutron is absorbed by a large unstable nucleus (e.g. uranium-235) which splits into two smaller nuclei releasing energy and 2-3 neutrons; these can cause a chain reaction (Oak KS4 'nuclear fission').", { avoid: ["binary fission", "fusion", "nuclear fusion", "bacteria", "cell division"], doesNotShow: "the particular nucleus; control rods or a reactor; the fission products' names" }),
  mk("x3-fusion", "Nuclear fusion", ["nuclear fusion", "fusion reaction", "fusion reactions", "hydrogen fusion"], fusion, "Nuclear fusion: two small hydrogen nuclei join to make a larger helium nucleus, releasing a neutron and energy; it happens in the core of stars at very high temperature and pressure.", "Nuclear fusion", "Fusion: two light nuclei (isotopes of hydrogen) join to form a heavier nucleus (helium), releasing energy; occurs in the cores of stars at very high temperature and pressure (Oak KS4 'nuclear fusion').", { avoid: ["fission", "nuclear fission", "chain reaction"], doesNotShow: "which hydrogen isotopes; the mass defect; fusion reactors" }),
  mk("x3-atom-models", "Models of the atom", ["plum pudding", "plum pudding model", "models of the atom", "atomic model", "atomic models", "nuclear model", "nuclear model of the atom", "bohr model", "rutherford", "history of the atom"], atomModels, "Three models of the atom: the plum pudding model with electrons embedded in a ball of positive charge; the nuclear model with a tiny positive nucleus and electrons far away in mostly empty space; and the shell model with electrons in energy levels around the nucleus.", "Models of the atom", "Models of the atom: plum pudding (Thomson), nuclear model (Rutherford: tiny dense positive nucleus, mostly empty space), Bohr shell model; each replaced the previous when new evidence appeared (Oak KS4 'plum pudding model').", { doesNotShow: "the alpha scattering experiment; neutrons; quantum models" }),
  mk("x3-national-grid", "The National Grid", ["national grid", "transformer", "transformers", "step-up transformer", "step-down transformer", "step up transformer", "step down transformer"], grid, "The National Grid as a chain: a power station, a step-up transformer, high-voltage cables, a step-down transformer, then homes and factories; high voltage means a low current so less energy is wasted as heat.", "The National Grid", "National Grid: power station -> step-up transformer -> high-voltage transmission cables -> step-down transformer -> consumers; high voltage lowers the current and so reduces energy wasted as heat (Oak KS4 'national grid').", { avoid: ["induction", "coil", "turns ratio", "primary coil", "secondary coil", "power station", "generator"], doesNotShow: "the voltages; how a transformer works; pylons; the number of transformers" }),
  mk("x3-ac-dc", "Direct and alternating current", ["alternating current", "direct current", "a.c.", "d.c.", "alternating potential difference"], acdc, "Two graphs against time: direct current stays constant and flows one way only; alternating current swings up and down as it changes direction again and again.", "Direct and alternating current", "Direct current flows in one direction (constant); alternating current continuously reverses direction (Oak KS4 'alternating current').", { avoid: ["generator", "dynamo", "transformer"], doesNotShow: "the frequency or voltage of the mains; how each is produced" }),
  mk("x3-mains-wires", "Mains wires: live, neutral and earth", ["live wire", "neutral wire", "earth wire", "mains electricity", "three pin plug", "three-pin plug", "mains supply", "mains wiring"], mains, "The three wires in a mains cable: the brown live wire carries the current to the appliance, the blue neutral wire completes the circuit and the green and yellow earth wire is a safety wire; a fuse in the live wire melts if the current is too big.", "Live, neutral and earth wires", "UK mains cable: brown = live, blue = neutral, green-and-yellow = earth; a fuse in the live wire protects the appliance and the earth wire stops the metal case becoming live (Oak KS4 'mains electricity').", { doesNotShow: "how the wires are connected in a plug; the voltage; a circuit breaker" }),
  mk("x3-conductors-insulators", "Electrical conductors and insulators", ["electrical conductor", "electrical conductors", "electrical insulator", "electrical insulators", "conductors and insulators", "conductor and insulator"], conductors, "Conductors let electricity pass through (for example the metals copper and iron) so a lamp in the circuit lights; insulators do not let electricity through (plastic, rubber, glass and wood) so the lamp stays off.", "Electrical conductors and insulators", "Electrical conductors (metals such as copper and iron) let current flow; insulators (plastic, rubber, glass, dry wood) do not (Oak KS2/KS3 'electrical conductor', 'electrical insulator').", { avoid: ["thermal", "heat", "semiconductor", "superconductor", "graphite", "salt water", "solution"], doesNotShow: "thermal conductors; semiconductors; why metals conduct" }),
];
void [thick, plate, poly, ell, put, box];
