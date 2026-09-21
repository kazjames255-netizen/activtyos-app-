// X3 Science extension, biology part 1: the human body. Every diagram is generic (labels only, no numbers) so it cannot contradict a slide on the same concept.
import type { Pic } from "./types";
import { mk, thick, put, box, plate, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, cap, range, pt } from "./ext-science-kit";

type P = [number, number];
const R = "l f4", B = "l f1", G = "l f2", Y = "l f3", V = "l f5", N = "l f0", GR = "l f6";

// ── skeleton ────────────────────────────────────────────────────────────────
const skeleton = (() => {
  let s = "";
  s += ell(120, 19, 13, 15, GR) + rect(114, 33, 12, 6, GR, 2);                                                   // skull + jaw
  s += rect(116, 40, 8, 52, "l f0", 3) + range(9).map((i) => ln(116, 45 + i * 5.5, 124, 45 + i * 5.5, "th")).join(""); // spine (backbone)
  s += ln(100, 46, 140, 46, "l");                                                                              // collar bones
  s += path("M120 48 C98 48 96 80 108 90 L132 90 C144 80 142 48 120 48 Z", "l f0") + range(4).map((i) => path(`M120 ${54 + i * 8} C108 ${52 + i * 8} 102 ${58 + i * 8} 104 ${66 + i * 8}`, "th2") + path(`M120 ${54 + i * 8} C132 ${52 + i * 8} 138 ${58 + i * 8} 136 ${66 + i * 8}`, "th2")).join("");
  s += rect(117, 50, 6, 30, "th2 f6", 2);                                                                     // breastbone
  s += path("M103 92 C102 112 112 116 120 108 C128 116 138 112 137 92 Z", GR);                                 // pelvis
  for (const m of [-1, 1]) {
    const x = 120 + m * 22;
    s += rect(x - 3.5 + m * 0, 47, 7, 34, "l f0", 3).replace(`x="${x - 3.5}"`, `x="${x + m * 4 - 3.5}"`);       // humerus
    s += rect(x + m * 6 - 2.5 + 0, 83, 4, 28, "l f0", 2).replace(`x="${x + m * 6 - 2.5}"`, `x="${x + m * 6 - 3.5}"`);
    s += rect(120 + m * 11 - 4, 108, 8, 36, "l f0", 3);                                                       // femur
    s += circ(120 + m * 11, 146, 3.4, "th2 f0");                                                               // knee cap
    s += rect(120 + m * 11 - 3, 150, 6, 16, "l f0", 2);                                                       // shin bone
  }
  return s + tag("skull", 70, 16, 108, 18, "r") + tag("ribs", 70, 66, 106, 66, "r") + tag("pelvis", 70, 100, 106, 100, "r") + tag("femur", 70, 126, 108, 126, "r")
    + tag("spine", 168, 62, 121, 62) + tag("humerus", 168, 82, 148, 80) + tag("shin bone", 168, 156, 135, 158);
})();

// ── digestive system ────────────────────────────────────────────────────────
const digestive = (() => {
  let s = "";
  s += ell(120, 14, 11, 7, R);                                                                                  // mouth
  s += rect(117, 21, 6, 36, "l f4", 3);                                                                          // oesophagus
  s += path("M84 56 C100 47 118 55 116 70 C110 84 90 84 80 70 Z", "l f2");                                       // liver
  s += path("M120 56 C142 50 152 66 144 80 C136 92 120 86 120 72 Z", R);                                         // stomach
  s += path("M100 122 V90 H140 V124 L132 138", "l") + path("M100 122 V90 H140 V124 L132 138", "ao").replace('class="ao"', 'class="ao" stroke-width="6" opacity=".55"'); // large intestine
  s += path("M106 96 H134 V103 H106 V110 H134 V117 H106", "l").replace('class="l"', 'class="l" stroke-width="4"');     // small intestine (coiled)
  return s + tag("mouth", 172, 14, 132, 14) + tag("oesophagus", 172, 36, 124, 38) + tag("stomach", 172, 64, 146, 66) + tag("small intestine", 162, 108, 135, 107) + tag("rectum", 172, 138, 134, 136)
    + tag("liver", 66, 66, 88, 68, "r") + tag("large intestine", 84, 100, 100, 100, "r");
})();

// ── respiratory system ──────────────────────────────────────────────────────
const respiratory = (() => {
  let s = "";
  s += path("M84 62 Q70 82 84 104", "th2") + path("M78 58 Q60 82 78 108", "th2") + path("M156 62 Q170 82 156 104", "th2") + path("M162 58 Q180 82 162 108", "th2"); // ribs
  s += path("M112 48 C86 50 76 90 82 122 C86 134 106 134 114 122 L114 62 Z", "l f4") + path("M128 48 C154 50 164 90 158 122 C154 134 134 134 126 122 L126 62 Z", "l f4");   // lungs
  s += rect(116, 14, 8, 48, "l f0", 3) + range(6).map((i) => ln(116, 20 + i * 7, 124, 20 + i * 7, "th")).join("");                                       // trachea
  s += path("M120 60 L102 76 L98 96", "l").replace('class="l"', 'class="l" stroke-width="3"') + path("M120 60 L138 76 L142 96", "l").replace('class="l"', 'class="l" stroke-width="3"');
  s += range(5).map((i) => { const y = 74 + i * 6; return ln(102 - (y - 74) * 0.15, y, 92, y + 4, "th2") + ln(138 + (y - 74) * 0.15, y, 148, y + 4, "th2"); }).join("");   // bronchioles
  s += path("M66 138 Q120 116 174 138", "l").replace('class="l"', 'class="l" stroke-width="4"');                                                                 // diaphragm
  return s + tag("trachea", 176, 26, 124, 30) + tag("bronchus", 176, 62, 132, 68) + tag("lung", 176, 92, 150, 92) + tag("ribs", 66, 44, 82, 66, "r") + tag("diaphragm", 176, 150, 150, 134);
})();

// ── alveoli ─────────────────────────────────────────────────────────────────
const alveoli = (() => {
  let s = "";
  s += thick("M148 30 C196 56 196 112 148 140", "red", 14, 0.32) + path("M148 30 C196 56 196 112 148 140", "th");
  s += circ(84, 86, 40, "l f0") + circ(84, 86, 34, "th f1").replace("f1", "f0");
  s += thick("M14 30 L52 54", "ink", 10, 0.16) + path("M14 24 L54 50", "th") + path("M20 38 L58 60", "th");
  s += arrow(22, 44, 52, 62, "a", 6) + arrow(58, 50, 28, 34, "a", 6);                                          // air in / out along the bronchiole
  s += arrow(60, 66, 176, 66, "ag", 7) + arrow(176, 112, 60, 112, "ar", 7);                                    // oxygen into blood; carbon dioxide into the alveolus
  return s + txt(84, 60, "oxygen", "tx tg") + txt(84, 106, "carbon dioxide", "tt tr") + txt(84, 84, "alveolus", "ts") + txt(84, 95, "(air sac)", "tx tm")
    + txt(196, 36, "capillary", "tx te").replace('x="196"', 'x="236"') + txt(236, 47, "(blood)", "tx te tm") + txt(4, 74, "air in", "tx tl") + txt(4, 86, "and out", "tx tl") + cap("gas exchange in the alveoli", 164, 44);
})();

// ── heart ───────────────────────────────────────────────────────────────────
const heart = (() => {
  let s = "";
  s += thick("M88 20 V60", "brand-2", 10, 0.5) + thick("M152 20 V60", "red", 10, 0.5) + thick("M108 98 V30", "brand-2", 10, 0.5) + thick("M132 98 V30", "red", 10, 0.5);
  s += path("M72 64 H106 V94 H72 Z", "l f1") + path("M134 64 H168 V94 H134 Z", "l f4");
  s += path("M72 98 H120 V138 Q96 154 72 130 Z", "l f1") + path("M122 98 H168 V130 Q146 154 122 138 Z", "l f4").replace('class="l f4"', 'class="l f4" stroke-width="4"');
  s += ln(121, 98, 121, 140, "l") + poly([[88, 64], [83, 55], [93, 55]], "hd") + poly([[152, 64], [147, 55], [157, 55]], "hd") + poly([[108, 24], [103, 34], [113, 34]], "hd") + poly([[132, 24], [127, 34], [137, 34]], "hd");
  return s + tag("vena cava", 60, 36, 86, 36, "r") + txt(176, 34, "pulmonary", "tx tl") + txt(176, 45, "vein", "tx tl") + ln(174, 38, 155, 38, "th") + tag("right atrium", 62, 82, 74, 82, "r") + tag("left atrium", 176, 82, 166, 82)
    + txt(62, 120, "right", "tx te") + txt(62, 131, "ventricle", "tx te") + ln(64, 124, 76, 124, "th") + txt(176, 120, "left", "tx tl") + txt(176, 131, "ventricle", "tx tl") + ln(174, 124, 164, 124, "th")
    + txt(108, 12, "pulmonary artery", "tx te").replace('x="108"', 'x="114"') + txt(126, 12, "aorta", "tx tl") + txt(120, 160, "blue: oxygen-poor blood", "tx tm") + txt(120, 171, "red: oxygen-rich blood", "tx tm");
})();

// ── circulation ─────────────────────────────────────────────────────────────
const circulation = (() => {
  let s = "";
  s += ell(120, 26, 28, 15, R) + txt(120, 30, "lungs", "ts") + ell(120, 144, 34, 14, GR) + txt(120, 148, "body", "ts");
  s += rect(92, 70, 56, 40, "l f0", 8) + rect(92, 70, 28, 40, "l f1", 8) + rect(120, 70, 28, 40, "l f4", 8) + txt(106, 94, "heart", "tx").replace("heart", "right").replace('y="94"', 'y="94"') + txt(134, 94, "left", "tx");
  s += arrow(100, 68, 104, 42, "a", 7) + arrow(136, 42, 140, 68, "ar", 7) + arrow(140, 112, 136, 130, "ar", 7) + arrow(104, 130, 100, 112, "a", 7);
  return s + txt(92, 56, "to the lungs", "tx te tm").replace('x="92"', 'x="90"') + txt(150, 56, "from the lungs", "tx tl tm") + txt(150, 124, "to the body", "tx tl tm") + txt(90, 124, "from the body", "tx te tm")
    + txt(120, 168, "blue: oxygen-poor blood", "tx tm") + txt(120, 179, "red: oxygen-rich blood", "tx tm");
})();

// ── blood vessels ───────────────────────────────────────────────────────────
const vessels = (() => {
  let s = "";
  s += rect(62, 8, 150, 34, "l f4", 4) + rect(62, 18, 150, 14, "th f0") + arrow(90, 25, 150, 25, "ar", 6);
  s += rect(62, 60, 150, 34, "l f1", 4).replace('height="34"', 'height="34"') + rect(62, 64, 150, 26, "th f0") + arrow(150, 77, 90, 77, "a", 6) + poly([[110, 64], [124, 70], [110, 76]], "th2 f1") + poly([[110, 90], [124, 84], [110, 78]], "th2 f1").replace("110,78", "110,80");
  s += rect(62, 116, 150, 10, "l f2", 4) + rect(62, 119, 150, 4, "th f0") + arrow(100, 121, 170, 121, "ar", 5);
  return s + txt(56, 29, "artery", "ts te") + txt(56, 81, "vein", "ts te") + txt(56, 124, "capillary", "ts te")
    + txt(137, 52, "thick wall; blood flows away from the heart", "tt tm") + txt(137, 104, "thin wall, valves; blood flows to the heart", "tt tm") + txt(137, 138, "wall one cell thick; exchange with cells", "tt tm");
})();

// ── blood ───────────────────────────────────────────────────────────────────
const blood = (() => {
  let s = rect(8, 8, 224, 120, "l f3", 12);
  const rbc = (x: number, y: number) => circ(x, y, 13, "l f4") + ell(x, y, 5.5, 4, "th f0");
  [[40, 30], [76, 52], [40, 84], [92, 100], [30, 110], [150, 26], [186, 62], [176, 100], [140, 108]].forEach((p) => { s += rbc(p[0], p[1]); });
  s += circ(134, 70, 22, "l f0") + path("M124 62 q6-8 14-2 q8 4 2 12 q-2 8-12 6 q-8-4-4-16 Z", "l f5");            // white blood cell with a lobed nucleus
  s += [[114, 30], [64, 118], [110, 116], [206, 30], [214, 96]].map((p) => `<ellipse cx="${p[0]}" cy="${p[1]}" rx="4" ry="2.6" class="l f5" transform="rotate(${p[0] % 60} ${p[0]} ${p[1]})"/>`).join("");
  return s + tag("red blood cell", 8, 160, 30, 84, "l") + tag("white blood cell", 84, 160, 136, 92, "l") + tag("platelet", 186, 160, 207, 32, "l") + txt(120, 143, "the yellow liquid is plasma", "tx tm");
})();

// ── nervous system ──────────────────────────────────────────────────────────
const nervous = (() => {
  let s = "";
  s += circ(120, 22, 14, GR) + rect(104, 38, 32, 62, "l f6", 12);
  s += thick("M98 46 L84 90 L80 122", "ink", 8, 0.15) + thick("M142 46 L156 90 L160 122", "ink", 8, 0.15) + thick("M112 96 L108 152", "ink", 9, 0.15) + thick("M128 96 L132 152", "ink", 9, 0.15);
  s += ell(120, 19, 9, 7, "l f4") + ln(120, 30, 120, 96, "ag").replace('class="ag"', 'class="ag" stroke-width="3.6"');
  s += path("M120 52 L104 48 L90 84 L84 116", "ao") + path("M120 52 L136 48 L150 84 L156 116", "ao") + path("M120 96 L112 120 L110 150", "ao") + path("M120 96 L128 120 L130 150", "ao");
  return s + tag("brain", 172, 16, 130, 18) + tag("spinal cord", 172, 62, 122, 62) + tag("nerves", 66, 96, 88, 96, "r") + txt(120, 165, "brain + spinal cord = central nervous system", "tx tm");
})();

// ── reflex arc ──────────────────────────────────────────────────────────────
const reflex = (() => {
  const bw = 66, bh = 30;
  const b = (x: number, y: number, l: string[], c = "l f1") => box(x, y, bw, bh, l, c);
  return b(6, 16, ["stimulus"], "l f3") + b(87, 16, ["receptor"]) + b(168, 16, ["sensory", "neurone"], "l f2")
    + b(168, 70, ["coordinator", "(CNS)"], "l f5") + b(168, 124, ["motor", "neurone"], "l f2") + b(87, 124, ["effector"]) + b(6, 124, ["response"], "l f3")
    + arrow(72, 31, 85, 31, "l", 6) + arrow(153, 31, 166, 31, "l", 6) + arrow(201, 46, 201, 68, "l", 6) + arrow(201, 100, 201, 122, "l", 6) + arrow(166, 139, 155, 139, "l", 6) + arrow(85, 139, 74, 139, "l", 6)
    + txt(90, 84, "the CNS is the brain", "tx tl tm").replace('x="90"', 'x="8"') + txt(8, 96, "and spinal cord", "tx tl tm") + txt(8, 62, "the nerve impulse follows the arrows", "tx tl tm").replace('y="62"', 'y="66"');
})();

// ── neurone ─────────────────────────────────────────────────────────────────
const neurone = (() => {
  let s = "";
  s += path("M6 40 L34 66", "l") + path("M6 70 L34 74", "l") + path("M8 100 L34 82", "l") + path("M6 40 l-4 6 M6 40 l6 -1", "th") + path("M6 70 l-4 4 M6 70 l4 -4", "th") + path("M8 100 l-4 -6 M8 100 l6 2", "th"); // dendrites
  s += ell(48, 74, 18, 14, "l f2") + circ(46, 74, 6, "l f5");                                                 // cell body + nucleus
  s += ln(66, 74, 214, 74, "l");                                                                              // axon
  s += range(5).map((i) => rect(76 + i * 26, 68, 20, 12, "l f3", 5)).join("");                                // myelin sheath segments
  s += path("M214 74 L230 52 M214 74 L232 74 M214 74 L230 96", "l") + range(3).map((i) => circ([230, 232, 230][i], [52, 74, 96][i], 3, "l f4")).join("");
  s += arrow(70, 118, 208, 118, "ag", 7);
  return s + tag("dendrites", 24, 20, 12, 44) + tag("cell body", 24, 146, 42, 84).replace(/^/, "") + tag("nucleus", 70, 30, 48, 68).replace("70", "70") + tag("axon", 120, 28, 120, 73).replace('class="t tx tl"', 'class="t tx tl"') + tag("myelin sheath", 140, 50, 140, 66)
    + tag("axon terminals", 226, 30, 230, 50, "r") + txt(140, 132, "the impulse travels along the axon", "tx tg");
})();

// ── eye ─────────────────────────────────────────────────────────────────────
const eye = (() => {
  let s = "";
  const cx = 135, cy = 85, r = 45;
  s += path("M108 49 A45 45 0 1 1 108 121", "l f4".replace("f4", "f0")) + path("M108 49 C78 60 78 110 108 121", "l f0") + path("M108 49 L108 121", "th");
  s += thick(`M${pt(cx, cy, 41, 50)[0]} ${pt(cx, cy, 41, 50)[1]} A41 41 0 0 1 ${pt(cx, cy, 41, -50)[0]} ${pt(cx, cy, 41, -50)[1]}`, "red", 6, 0.55);
  s += rect(111, 50, 6, 24, "l f5") + rect(111, 96, 6, 25, "l f5") + ell(124, 85, 7, 17, "l f3") + ln(120, 68, 116, 54, "th") + ln(120, 102, 116, 116, "th");
  s += thick("M176 90 L214 100", "gold", 8, 0.7);
  return s + tag("cornea", 8, 40, 88, 64, "l") + tag("iris", 112, 26, 114, 56) + tag("pupil", 40, 150, 112, 86) + tag("lens", 124, 150, 124, 100) + tag("retina", 190, 30, 165, 60) + tag("optic nerve", 176, 130, 208, 98);
})();

// ── ear ─────────────────────────────────────────────────────────────────────
const ear = (() => {
  let s = "";
  s += path("M42 56 C16 46 2 92 24 112 C30 118 38 116 44 108 C32 100 32 84 42 76 Z", "l f4");                        // pinna
  s += rect(42, 78, 50, 14, "l f0") + ln(92, 66, 92, 104, "l").replace('class="l"', 'class="l" stroke-width="3.4"');   // ear canal + ear drum
  s += rect(96, 80, 12, 8, "l f3", 3) + rect(110, 76, 12, 12, "l f3", 3) + rect(124, 82, 12, 8, "l f3", 3) + ln(108, 84, 110, 82, "th2") + ln(122, 82, 124, 84, "th2"); // ossicles
  s += ell(140, 44, 15, 7, "l f0") + ell(140, 44, 15, 7, "l f0").replace("<ellipse", '<ellipse transform="rotate(60 140 44)"') + ell(140, 44, 15, 7, "l f0").replace("<ellipse", '<ellipse transform="rotate(-60 140 44)"');
  let sp = ""; for (let t = 0; t <= 4.6; t += 0.15) { const rr = 24 - t * 4, a = t * 1.35; sp += `${(154 + rr * Math.cos(a)).toFixed(1)},${(116 + rr * Math.sin(a)).toFixed(1)} `; }
  s += `<polyline points="${sp.trim()}" class="l" stroke-width="4.5" style="fill:none"/>` + ln(136, 90, 142, 100, "l") + thick("M172 102 C184 96 194 88 206 78", "gold", 6, 0.75);
  return s + tag("pinna", 10, 20, 20, 62, "l") + tag("ear canal", 8, 140, 64, 92, "l") + tag("ear drum", 72, 26, 92, 70) + tag("ossicles", 84, 156, 112, 90) + tag("cochlea", 148, 160, 152, 140) + tag("semicircular canals", 236, 16, 150, 40, "r") + tag("auditory nerve", 236, 66, 204, 80, "r");
})();

// ── kidneys / urinary system ────────────────────────────────────────────────
const urinary = (() => {
  let s = "";
  s += path("M88 26 C66 24 60 52 70 68 C74 74 86 70 84 60 C82 50 96 40 88 26 Z", "l f4") + path("M152 26 C174 24 180 52 170 68 C166 74 154 70 156 60 C158 50 144 40 152 26 Z", "l f4");
  s += path("M82 66 C88 92 110 104 116 118", "l").replace('class="l"', 'class="l" stroke-width="3.2"') + path("M158 66 C152 92 130 104 124 118", "l").replace('class="l"', 'class="l" stroke-width="3.2"');
  s += path("M106 118 C104 138 114 148 120 148 C126 148 136 138 134 118 C126 112 114 112 106 118 Z", "l f3") + rect(117, 148, 6, 18, "l f3", 2);
  return s + tag("kidney", 40, 28, 68, 40, "r") + tag("kidney", 200, 28, 172, 40, "l") + tag("ureter", 190, 88, 144, 92) + tag("bladder", 190, 130, 134, 130) + tag("urethra", 190, 160, 124, 160);
})();

export const BIO1: Pic[] = [
  mk("x3-skeleton", "Human skeleton", ["skeleton", "human skeleton", "skeletal system"], skeleton, "The human skeleton: the skull, the spine (backbone), the ribs, the pelvis, the humerus in the arm, the femur in the thigh and the shin bone, each labelled.", "The human skeleton", "Human skeleton: skull, vertebral column (spine), rib cage, pelvis, humerus, femur, tibia (Oak KS1-KS3 'skeleton'). Long bones drawn as simple bars; counts of bones are not shown.", { requires: ["human", "humans", "body", "bones", "bone", "muscle", "muscles", "joint", "joints"], avoid: ["different animals", "animal skeletons", "endoskeleton", "comparing skeletons", "fish", "bird", "birds", "insect", "exoskeleton", "vertebrate", "invertebrate"], doesNotShow: "individual bones, joints or bone counts; animal skeletons" }),
  mk("x3-digestive-system", "Digestive system", ["digestive system", "digestive tract", "alimentary canal", "gut", "oesophagus", "gullet", "small intestine", "large intestine", "stomach"], digestive, "The human digestive system: mouth, oesophagus, stomach, liver, small intestine (coiled) and large intestine, ending at the rectum, each labelled.", "The digestive system", "Food passes mouth -> oesophagus -> stomach -> small intestine -> large intestine -> rectum; liver on the person's right (viewer's left), stomach on the left (Oak KS2/KS3 'digestive system').", { requires: ["digest", "digestion", "digestive", "food", "gut", "intestine", "stomach", "nutrients", "enzyme", "enzymes", "human", "body"], avoid: ["cow", "ruminant", "bird", "plant", "plants"], doesNotShow: "the pancreas, gall bladder, salivary glands or enzymes; animals other than humans" }),
  mk("x3-respiratory-system", "Breathing system", ["respiratory system", "breathing system", "trachea", "windpipe", "bronchus", "bronchi", "bronchiole", "lungs", "lung", "diaphragm", "ventilation", "breathing"], respiratory, "The human breathing system: the trachea (windpipe) splitting into two bronchi that branch into bronchioles inside the two lungs, with the ribs around them and the diaphragm underneath.", "The breathing system", "Air passes trachea -> bronchi -> bronchioles -> alveoli in the lungs, protected by the rib cage; the diaphragm is the muscle beneath the lungs (Oak KS3/KS4 'breathing system').", { requires: ["breathe", "breathing", "respiratory", "lungs", "lung", "trachea", "windpipe", "bronchus", "ventilation", "human", "body", "oxygen", "air"], avoid: ["fish", "gills", "insect", "plant", "plants", "leaf", "stomata", "camera", "cell respiration", "cellular respiration", "aerobic respiration", "anaerobic"], doesNotShow: "how breathing in and out works (ribs and diaphragm movement); the alveoli; animals other than humans" }),
  mk("x3-alveoli", "Gas exchange in the alveoli", ["alveoli", "alveolus", "air sac", "air sacs"], alveoli, "An alveolus (air sac) with a capillary wrapped round it. Oxygen moves from the air in the alveolus into the blood; carbon dioxide moves from the blood into the alveolus. Air goes in and out along the bronchiole.", "Gas exchange in an alveolus", "Alveoli: oxygen diffuses from the alveolus into the blood in the capillary; carbon dioxide diffuses from the blood into the alveolus (Oak KS3/KS4 'alveoli').", { doesNotShow: "the thin wall or the number of alveoli; the mechanism of breathing" }),
  mk("x3-heart", "The human heart", ["human heart", "chambers of the heart", "atrium", "atria", "ventricle", "ventricles", "vena cava", "aorta", "pulmonary artery", "pulmonary vein", "heart"], heart, "The human heart drawn as a diagram with four chambers: right atrium and right ventricle on the left of the picture (blue, oxygen-poor blood), left atrium and left ventricle on the right (red, oxygen-rich blood), with the vena cava, pulmonary vein, pulmonary artery and aorta labelled.", "The human heart", "Right atrium receives blood from the vena cava; right ventricle pumps to the lungs via the pulmonary artery; left atrium receives blood from the pulmonary vein; left ventricle (thicker wall) pumps to the body via the aorta (Oak KS3/KS4 'heart'). Drawn as seen facing the person, so their right side is on the left of the picture.", { h: 178, requires: ["blood", "atrium", "atria", "ventricle", "ventricles", "chamber", "chambers", "circulatory", "pump", "valve", "valves", "aorta", "vena cava", "artery", "arteries"], avoid: ["heart rate", "heartbeat", "heart disease", "heart attack", "heart failure", "coronary", "pulse", "fish", "amphibian", "reptile", "earthworm", "insect"], doesNotShow: "valves, the coronary arteries, heart muscle or the blood flow inside the chambers" }),
  mk("x3-circulation", "Double circulatory system", ["double circulatory system", "circulatory system", "double circulation", "blood circulation", "circulation"], circulation, "The double circulatory system: the right side of the heart pumps oxygen-poor blood (blue) to the lungs and oxygen-rich blood (red) returns to the left side; the left side pumps oxygen-rich blood to the body and oxygen-poor blood returns to the right side.", "The double circulatory system", "Double circulation: heart -> lungs -> heart -> body -> heart. Right side pumps deoxygenated blood to the lungs; left side pumps oxygenated blood to the body (Oak KS3/KS4 'circulatory system').", { h: 184, avoid: ["single circulatory", "single circulation", "fish", "amphibian", "insect", "open circulatory"], doesNotShow: "the names of the blood vessels; the heart chambers" }),
  mk("x3-blood-vessels", "Artery, vein and capillary", ["blood vessel", "artery", "arteries", "vein", "veins", "capillary", "capillaries"], vessels, "Three blood vessels drawn lengthways: an artery with a thick muscular wall and blood flowing away from the heart, a vein with a thin wall and valves and blood flowing back to the heart, and a capillary with a wall one cell thick.", "Arteries, veins and capillaries", "Artery: thick muscular wall, carries blood away from the heart. Vein: thinner wall, valves, carries blood to the heart. Capillary: wall one cell thick, exchange with cells (Oak KS3/KS4 'blood vessels').", { requires: ["blood", "heart", "circulatory", "vessel", "vessels", "capillary", "capillaries", "artery", "arteries"], avoid: ["leaf", "leaves", "insect", "wing", "ore", "mineral", "rock", "varicose", "pulmonary"], doesNotShow: "which vessel is which in the body; pulse or blood pressure; the oxygen content of the blood" }),
  mk("x3-blood", "Blood: cells and plasma", ["red blood cell", "white blood cell", "platelet", "platelets", "blood plasma", "components of blood", "blood cell", "blood cells", "blood"], blood, "Blood as seen under a microscope: many red blood cells with a dip in the middle and no nucleus, a larger white blood cell with a nucleus, small platelets, all in the yellow liquid plasma.", "The parts of blood", "Blood = plasma (liquid) + red blood cells (carry oxygen, no nucleus) + white blood cells (defence, have a nucleus) + platelets (cell fragments that help blood clot) (Oak KS3/KS4 'blood').", { requires: ["red blood cell", "white blood cell", "platelet", "platelets", "plasma", "blood cell", "blood cells", "cells"], avoid: ["blood sugar", "blood glucose", "blood vessel", "blood pressure", "blood group", "blood donor", "blood test"], doesNotShow: "how many of each cell there are; the sizes drawn are not to scale" }),
  mk("x3-nervous-system", "Nervous system", ["nervous system", "central nervous system", "cns", "spinal cord", "nerves"], nervous, "A person outlined with the brain in the head, the spinal cord running down the middle of the body and nerves branching out to the arms and legs.", "The nervous system", "Nervous system: the brain and spinal cord form the central nervous system (CNS); nerves carry impulses between the CNS and the rest of the body (Oak KS3/KS4 'nervous system').", { avoid: ["nervous system of", "insect", "earthworm", "autonomic", "sympathetic"], doesNotShow: "the parts of the brain; the types of neurone; the sense organs" }),
  mk("x3-reflex-arc", "Reflex arc", ["reflex arc", "reflex action", "reflex response", "reflex", "reflexes", "stimulus and response"], reflex, "The path of a reflex: stimulus, receptor, sensory neurone, coordinator (the brain or spinal cord, the CNS), motor neurone, effector, then the response, joined by arrows.", "A reflex arc", "Reflex arc: stimulus -> receptor -> sensory neurone -> coordinator (CNS) -> motor neurone -> effector -> response; reflexes are automatic and fast (Oak KS4 'reflex response').", { avoid: ["reflex angle", "conditioned", "voluntary", "reflection"], doesNotShow: "the relay neurone, the synapse or the parts of the spinal cord" }),
  mk("x3-neurone", "A neurone (motor neurone)", ["neurone", "neurones", "neuron", "neurons", "nerve cell", "nerve cells", "motor neurone", "motor neuron"], neurone, "A motor neurone: dendrites and a cell body with a nucleus at the left, a long axon covered by a fatty myelin sheath, and axon terminals at the right. An arrow shows the impulse travelling along the axon away from the cell body.", "A neurone (nerve cell)", "Neurone: cell body with nucleus, dendrites, long axon, myelin sheath (insulation, speeds impulses), axon terminals; a motor neurone carries impulses away from the CNS to an effector (Oak KS3/KS4 'neurone').", { avoid: ["sensory neurone", "sensory neuron", "relay neurone", "relay neuron", "relay neurons", "sensory neurones", "sensory neurons", "synapse"], doesNotShow: "sensory or relay neurones (their cell bodies are in different places); synapses" }),
  mk("x3-eye", "The human eye", ["human eye", "structure of the eye", "parts of the eye", "retina", "cornea", "optic nerve", "pupil", "iris"], eye, "A cross-section of the human eye: the cornea at the front, the iris with the pupil in the middle, the lens behind it, the retina lining the back and the optic nerve leaving the back.", "The human eye", "Eye: cornea and lens refract light, iris controls the size of the pupil, the retina contains the light-sensitive cells, the optic nerve carries impulses to the brain (Oak KS3 'the eye').", { requires: ["eye", "eyes", "retina", "cornea", "vision", "sight", "see", "light"], avoid: ["compound eye", "insect", "camera", "flower", "pupils will", "students", "children"], doesNotShow: "how the eye focuses on near and far objects; the ciliary muscles; eye defects" }),
  mk("x3-ear", "The human ear", ["human ear", "structure of the ear", "parts of the ear", "ear drum", "eardrum", "cochlea", "ossicles", "auditory nerve", "pinna", "ear canal"], ear, "The human ear: the pinna, the ear canal, the ear drum, three small bones called ossicles, the semicircular canals, the spiral-shaped cochlea and the auditory nerve going to the brain.", "The human ear", "Ear: sound waves collected by the pinna travel down the ear canal and make the ear drum vibrate; the ossicles pass the vibrations on to the cochlea, which sends impulses along the auditory nerve (Oak KS3/KS4 'the ear').", { requires: ["ear", "ears", "hearing", "hear", "sound", "cochlea", "drum"], avoid: ["ear of wheat", "ear of corn", "drum kit", "musical"], doesNotShow: "the semicircular canal labels, balance, or how the cochlea detects pitch" }),
  mk("x3-urinary-system", "Kidneys and urinary system", ["kidney", "kidneys", "urinary system", "ureter", "ureters", "bladder", "urethra", "excretory system"], urinary, "The human urinary system: two kidneys, a tube called a ureter from each kidney down to the bladder, and the urethra leaving the bladder.", "The kidneys and urinary system", "Urinary system: kidneys filter the blood and make urine; ureters carry urine to the bladder where it is stored; urethra carries it out of the body (Oak KS3/KS4 'kidney').", { requires: ["kidney", "kidneys", "urine", "urinary", "bladder", "ureter", "excretion", "excrete", "waste", "dialysis", "blood", "human", "body"], avoid: ["kidney bean", "kidney bean", "swim bladder", "gall bladder", "kidney disease", "kidney stones"], doesNotShow: "the inside of a kidney (nephrons); the blood vessels" }),
];
void [B, G, Y, V, N, put, plate, txt, dot];
