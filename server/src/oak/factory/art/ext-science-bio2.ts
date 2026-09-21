// X3 Science extension, biology part 2: reproduction, teeth, plant structure and transport, life cycles.
import type { Pic } from "./types";
import { mk, thick, box, ln, path, circ, ell, rect, txt, dot, arrow, poly, tag, cap, range, cycle } from "./ext-science-kit";

const R = "l f4", B = "l f1", G = "l f2", Y = "l f3", V = "l f5", N = "l f0", GR = "l f6";

// ── sperm cell and egg cell ─────────────────────────────────────────────────
const gametes = (() => {
  let s = "";
  s += ell(52, 34, 24, 14, "l f1") + path("M28 34 C28 22 42 20 46 34 C42 48 28 46 28 34 Z", "l f5").replace("f5", "f3") + ell(58, 34, 10, 8, "l f5");
  s += rect(76, 30, 30, 8, "l f2", 3) + range(4).map((i) => ln(80 + i * 7, 30, 80 + i * 7, 38, "th")).join("");
  let w = ""; for (let x = 106; x <= 226; x += 4) w += `${x},${(34 + 5 * Math.sin((x - 106) / 7)).toFixed(1)} `;
  s += `<polyline points="${w.trim()}" class="l"/>`;
  s += circ(70, 122, 34, "l f4") + circ(70, 122, 27, "th f0").replace("f0", "f4") + circ(72, 122, 10, "l f5");
  return s + tag("acrosome", 8, 70, 33, 36, "l") + tag("nucleus", 50, 12, 58, 32) + tag("mitochondria", 84, 62, 92, 37, "l") + tag("tail", 196, 62, 190, 36)
    + tag("cell membrane", 116, 106, 100, 108) + tag("cytoplasm", 116, 128, 90, 128) + tag("nucleus", 116, 148, 78, 124) + txt(232, 84, "sperm cell", "tx te tm") + txt(232, 166, "egg cell (much bigger)", "tx te tm");
})();

// ── female reproductive system ──────────────────────────────────────────────
const female = (() => {
  let s = "";
  s += path("M96 52 Q120 42 144 52 L130 106 L110 106 Z", "l f4") + rect(112, 106, 16, 10, "l f3", 2) + rect(110, 116, 20, 40, "l f4", 6);
  s += path("M98 54 C76 40 58 46 52 62", "l").replace('class="l"', 'class="l" stroke-width="3"') + path("M142 54 C164 40 182 46 188 62", "l").replace('class="l"', 'class="l" stroke-width="3"');
  s += ell(50, 70, 11, 8, "l f3") + ell(190, 70, 11, 8, "l f3");
  return s + tag("oviduct", 30, 24, 76, 46, "l") + tag("ovary", 30, 100, 44, 74, "l") + tag("uterus", 176, 24, 132, 72) + tag("cervix", 168, 116, 130, 111) + tag("vagina", 160, 148, 130, 140) + tag("ovary", 186, 100, 192, 78, "l").replace(/^/, "");
})();

// ── male reproductive system ────────────────────────────────────────────────
const male = (() => {
  let s = "";
  s += ell(120, 22, 18, 11, "l f3");
  s += path("M74 88 H166 V134 Q120 154 74 134 Z", "th f6").replace("th f6", "l f6") + ell(96, 116, 12, 17, "l f5") + ell(144, 116, 12, 17, "l f5");
  s += rect(114, 84, 12, 56, "l f4", 5) + ln(120, 33, 120, 136, "th2"); // the penis is drawn AFTER the scrotum so it is visible in front of it (it used to be hidden, leaving its label pointing at nothing)
  s += path("M96 100 C92 70 108 46 118 34", "l").replace('class="l"', 'class="l" stroke-width="3"') + path("M144 100 C148 70 132 46 122 34", "l").replace('class="l"', 'class="l" stroke-width="3"');
  return s + tag("bladder", 176, 20, 136, 22) + tag("sperm duct", 176, 56, 143, 62) + tag("urethra", 176, 86, 121, 86) + tag("testis", 60, 116, 84, 116, "r") + tag("scrotum", 60, 150, 80, 132, "r") + tag("penis", 176, 118, 126, 118);
})();

// ── teeth ───────────────────────────────────────────────────────────────────
const teeth = (() => {
  let s = ln(12, 44, 228, 44, "l").replace('class="l"', 'class="l" stroke-width="4"') + rect(12, 30, 216, 14, "l f4", 4);
  const incisor = (x: number) => path(`M${x} 44 V84 Q${x + 7} 88 ${x + 14} 84 V44 Z`, "l f0");
  const canine = (x: number) => path(`M${x} 44 V72 L${x + 8} 92 L${x + 16} 72 V44 Z`, "l f0");
  const molar = (x: number, w: number) => path(`M${x} 44 V76 L${x + 3} 82 L${x + w / 2} 78 L${x + w - 3} 82 L${x + w} 76 V44 Z`, "l f0");
  s += incisor(16) + incisor(32) + canine(50) + molar(70, 20) + molar(92, 20) + molar(116, 28) + molar(146, 28) + molar(176, 28) + molar(206, 20).replace(/^/, "").replace("206", "206");
  return s + tag("incisors: cut food", 10, 112, 40, 88, "l") + tag("canine: tears food", 10, 134, 58, 94, "l") + tag("premolars and molars: crush and grind", 10, 156, 140, 84, "l");
})();

// ── tooth structure ─────────────────────────────────────────────────────────
const tooth = (() => {
  let s = "";
  s += rect(14, 90, 212, 70, "l f4", 0) + path("M84 92 V60 C80 28 96 14 120 14 C144 14 160 28 156 60 V92 Z", "l f0");
  s += path("M84 92 V60 C80 28 96 14 120 14 C144 14 160 28 156 60 V92 Z", "l f0");
  s += path("M92 92 V62 C90 38 102 24 120 24 C138 24 150 38 148 62 V92 Z", "l f3");
  s += path("M98 92 V66 C98 46 108 36 120 36 C132 36 142 46 142 66 V92 Z", "l f4").replace("f4", "f4");
  s += path("M92 92 C92 120 100 150 108 160 H132 C140 150 148 120 148 92 Z", "l f3") + path("M104 92 C104 120 112 148 118 156 M136 92 C136 120 128 148 122 156", "th");
  // (image QA: "pulp cavity" above the gum line (y = 90) and its note below it, so no label sits on the line)
  return s + tag("enamel", 176, 24, 150, 38) + tag("dentine", 176, 58, 148, 66) + tag("pulp cavity", 170, 80, 134, 74) + txt(170, 101, "nerves and", "tt tm tl") + txt(170, 109, "blood vessels", "tt tm tl") + tag("gum", 40, 84, 60, 100, "r").replace(/^/, "") + tag("root", 176, 140, 146, 130);
})();

// ── leaf cross-section ──────────────────────────────────────────────────────
const leaf = (() => {
  let s = "";
  s += ln(12, 22, 152, 22, "l").replace('class="l"', 'class="l" stroke-width="3"');
  s += range(7).map((i) => rect(12 + i * 20, 24, 20, 12, "th2 f0")).join("");
  s += range(7).map((i) => rect(12 + i * 20, 36, 20, 38, "th2 f2") + [0, 1, 2].map((k) => circ(17 + i * 20 + (k % 2) * 8, 42 + k * 6, 2.2, "th f2".replace("f2", "f2")).replace("th f2", "th2 f2")).join("")).join("");
  s += [[22, 92], [50, 88], [82, 94], [112, 88], [140, 92], [36, 108], [66, 106], [98, 108], [128, 106]].map((p) => ell(p[0], p[1], 12, 9, "th2 f2")).join("");
  s += circ(66, 90, 8, "l f0") + path("M60 90 A6 6 0 0 1 72 90 Z", "th2 f1") + path("M60 90 A6 6 0 0 0 72 90 Z", "th2 f3");
  s += range(7).map((i) => (i === 4 ? "" : rect(12 + i * 20, 120, 20, 12, "th2 f0"))).join("");
  s += path("M92 120 q4 -4 8 0 v12 q-4 4 -8 0 Z", "l f2").replace("M92 120", "M92 120") + path("M112 120 q-4 -4 -8 0 v12 q4 4 8 0 Z", "l f2");
  s += ln(12, 134, 152, 134, "l").replace('class="l"', 'class="l" stroke-width="3"');
  return s + tag("waxy cuticle", 158, 14, 130, 22) + tag("upper epidermis", 158, 34, 140, 30) + tag("palisade layer", 158, 58, 146, 56) + tag("spongy layer", 158, 100, 140, 98) + tag("vein", 158, 78, 74, 90) + tag("guard cell", 158, 122, 114, 126) + tag("stoma (gap)", 158, 146, 102, 128).replace(/^/, "") + tag("lower epidermis", 158, 160, 30, 128);
})();

// ── stomata open and closed ─────────────────────────────────────────────────
const stomata = (() => {
  const pair = (cx: number, open: boolean) => {
    const gap = open ? 9 : 0;
    const left = `M${cx - gap} 44 C${cx - 30} 44 ${cx - 30} 100 ${cx - gap} 100 C${cx - gap + (open ? 0 : 6)} 84 ${cx - gap + (open ? 0 : 6)} 60 ${cx - gap} 44 Z`;
    const right = `M${cx + gap} 44 C${cx + 30} 44 ${cx + 30} 100 ${cx + gap} 100 C${cx + gap - (open ? 0 : 6)} 84 ${cx + gap - (open ? 0 : 6)} 60 ${cx + gap} 44 Z`;
    return path(left, "l f2") + path(right, "l f2") + [[-22, 58], [-22, 84], [22, 58], [22, 84]].map((d) => circ(cx + d[0], d[1], 2.6, "th2 f4")).join("");
  };
  return pair(64, true) + pair(176, false) + txt(64, 26, "stoma open", "ts") + txt(176, 26, "stoma closed", "ts") + txt(64, 118, "guard cells swell", "tx") + txt(64, 129, "with water", "tx") + txt(176, 118, "guard cells lose", "tx") + txt(176, 129, "water and go limp", "tx")
    + tag("guard cell", 20, 152, 46, 84, "l") + tag("stoma (pore)", 120, 152, 64, 72, "l") + txt(120, 22, "", "tx");
})();

// ── root hair cell ──────────────────────────────────────────────────────────
const roothair = (() => {
  let s = "";
  // (image QA: soil particles placed clear of the "root hair" / "vacuole" labels and of the caption at y = 168)
  s += [[30, 40], [50, 120], [90, 150], [150, 146], [200, 120], [222, 96], [180, 30], [16, 78]].map((p) => circ(p[0], p[1], 7, "th f6")).join("");
  s += path("M96 20 H176 V80 H144 V138 Q140 150 136 138 V138 H124 V80 H96 Z", "l f2").replace("V138 Q140 150 136 138 V138 H124", "L134 140 Q130 152 126 140 L124").replace("H144 L134", "H144 L134");
  s += rect(96, 20, 80, 60, "l f2", 4) + path("M124 80 Q130 152 136 80", "l f2") + ell(146, 42, 10, 8, "l f5") + ell(120, 52, 12, 10, "l f1").replace("f1", "f0");
  s += arrow(60, 140, 118, 112, "a", 6) + txt(36, 168, "water and minerals from the soil", "tx tl tm");
  return s + tag("root hair", 30, 100, 122, 110, "l") + tag("nucleus", 184, 44, 155, 42) + tag("vacuole", 184, 72, 122, 54) + tag("cell wall", 178, 14, 168, 24);
})();

// ── xylem and phloem ────────────────────────────────────────────────────────
const vascular = (() => {
  let s = "";
  s += rect(52, 22, 36, 106, "l f1", 4) + range(8).map((i) => ln(52, 30 + i * 13, 88, 30 + i * 13, "th2")).join("");
  s += rect(150, 22, 36, 106, "l f2", 4) + range(6).map((i) => ln(150, 34 + i * 18, 186, 34 + i * 18, "th2")).join("");
  s += arrow(70, 122, 70, 30, "a", 7) + arrow(160, 34, 160, 122, "ag", 7) + arrow(176, 122, 176, 34, "ag", 7);
  return s + txt(70, 14, "xylem", "ts") + txt(168, 14, "phloem", "ts") + txt(62, 142, "water and", "tx") + txt(62, 153, "minerals go up", "tx") + txt(62, 164, "(dead, hollow)", "tx tm") + txt(176, 142, "sugars go to where", "tx") + txt(176, 153, "they are needed", "tx") + txt(176, 164, "(up and down)", "tx tm");
})();

// ── transpiration ───────────────────────────────────────────────────────────
const transpiration = (() => {
  let s = ln(8, 128, 232, 128, "th") + rect(8, 128, 224, 34, "l f6", 0);
  s += thick("M96 128 V62", "green", 8, 0.7) + path("M96 62 C60 62 48 40 46 26 C72 26 90 40 96 58 Z", "l f2") + path("M96 74 C132 74 144 52 146 38 C120 38 102 52 96 70 Z", "l f2");
  s += path("M96 128 C86 140 80 148 74 158 M96 128 C96 142 96 150 96 160 M96 128 C106 140 112 148 120 158", "l");
  s += arrow(150, 132, 150, 150, "a", 0.1) + arrow(70, 152, 88, 136, "a", 6) + arrow(112, 110, 112, 82, "a", 6) + [0, 1, 2].map((i) => arrow(36 + i * 10, 30, 30 + i * 10, 12, "ao", 5)).join("") + [0, 1, 2].map((i) => arrow(132 + i * 10, 42, 138 + i * 10, 24, "ao", 5)).join("");
  return s + txt(122, 100, "water moves up", "tx tl") + txt(122, 111, "the xylem", "tx tl") + txt(232, 60, "water vapour", "tx te") + txt(232, 71, "leaves through", "tx te") + txt(232, 82, "the stomata", "tx te") + txt(122, 152, "roots take in water", "tx tl");
})();

// ── seed structure ──────────────────────────────────────────────────────────
const seed = (() => {
  let s = "";
  s += path("M50 84 C50 40 130 30 160 50 C186 66 176 118 140 126 C96 136 50 124 50 84 Z", "l f3") + path("M60 84 C60 48 126 40 152 58 C172 72 166 108 136 116 C96 124 60 112 60 84 Z", "l f0");
  s += path("M60 84 C60 48 126 40 152 58", "l").replace('class="l"', 'class="l" stroke-width="0"');
  s += path("M74 86 C74 66 110 58 130 70 C144 80 140 100 118 104 C92 108 74 102 74 86 Z", "l f2").replace("f2", "f3") + path("M100 74 C92 58 96 44 104 38", "l").replace('class="l"', 'class="l" stroke-width="3"') + path("M86 98 C74 108 70 116 66 122", "l").replace('class="l"', 'class="l" stroke-width="4.5"');
  // (image QA: the plumule label is centred top-left with its leader leaving from BELOW the text, so the line no longer crosses "(baby shoot)")
  return s + tag("testa", 190, 30, 172, 58) + tag("cotyledon", 178, 96, 140, 92) + txt(50, 12, "plumule", "tx") + txt(50, 23, "(baby shoot)", "tx tm") + ln(56, 26, 102, 40, "th") + dot(102, 40, 1.8, "dot") + tag("radicle", 12, 150, 68, 120, "l") + txt(178, 108, "(food store)", "tx tl tm") + txt(12, 162, "(baby root)", "tx tl tm");
})();

// ── germination ─────────────────────────────────────────────────────────────
const germination = (() => {
  let s = ln(6, 100, 234, 100, "th") + rect(6, 100, 228, 56, "l f6", 0);
  s += ell(36, 116, 12, 8, "l f3");
  s += ell(112, 118, 12, 8, "l f3") + path("M102 122 C98 132 98 140 100 150", "l").replace('class="l"', 'class="l" stroke-width="3"');
  s += ell(188, 112, 10, 7, "l f3") + path("M180 116 C176 130 176 140 178 152", "l").replace('class="l"', 'class="l" stroke-width="3"') + path("M190 108 C192 90 194 74 192 60", "ag") + path("M192 62 C176 56 172 48 172 40 C184 42 192 50 192 62 Z", "l f2") + path("M192 66 C208 60 212 52 212 44 C200 46 192 54 192 66 Z", "l f2");
  return s + txt(36, 84, "seed takes in", "tx") + txt(36, 95, "water", "tx") + txt(112, 84, "root (radicle)", "tx") + txt(112, 95, "grows down first", "tx") + txt(188, 26, "shoot grows up", "tx") + txt(188, 37, "and leaves open", "tx")
    + txt(120, 14, "a seed starts to grow into a new plant", "tx tm") + txt(120, 166, "needs water, oxygen and warmth", "tx tm");
})();

// ── life cycle of a flowering plant ─────────────────────────────────────────
const plantCycle = cycle([["seed"], ["germination"], ["young plant", "grows"], ["flowers:", "pollination"], ["fertilisation", "seeds form"], ["seed", "dispersal"]], 120, 84, 76, 56, 72, 26, 90, "l f2");
// ── butterfly and frog life cycles ──────────────────────────────────────────
const butterfly = cycle([["egg"], ["caterpillar", "(larva)"], ["chrysalis", "(pupa)"], ["adult", "butterfly"]], 120, 84, 78, 54, 76, 30, 90, "l f3") + txt(120, 84, "life cycle", "tx tm");
const frog = cycle([["egg", "(frogspawn)"], ["tadpole"], ["tadpole with", "legs"], ["adult frog"]], 120, 84, 78, 54, 76, 30, 90, "l f2") + txt(120, 84, "life cycle", "tx tm") + txt(120, 95, "of a frog", "tx tm");

export const BIO2: Pic[] = [
  mk("x3-sperm-egg", "Sperm cell and egg cell", ["sperm cell", "sperm cells", "sperm", "egg cell", "egg cells", "ovum", "gamete", "gametes", "sex cell", "sex cells", "male gamete", "female gamete"], gametes, "A sperm cell with a head containing a nucleus and an acrosome, a middle piece full of mitochondria and a long tail; and a much larger egg cell with a cell membrane, cytoplasm and a nucleus.", "A sperm cell and an egg cell", "Sperm: nucleus, acrosome (enzymes), mitochondria, tail (flagellum); egg cell: nucleus, cytoplasm, cell membrane, much larger than a sperm (Oak KS3/KS4 'specialised cells').", { avoid: ["pollen", "ovule", "anther", "plant", "plants", "flower", "flowers", "stigma", "fern", "moss"], doesNotShow: "fertilisation; the jelly coat of the egg; plant gametes" }),
  mk("x3-female-repro", "Female reproductive system", ["female reproductive system", "female reproductive", "ovary", "ovaries", "oviduct", "oviducts", "fallopian tube", "uterus", "womb", "cervix"], female, "The human female reproductive system: two ovaries, an oviduct (egg tube) from each ovary to the uterus (womb), the cervix at the bottom of the uterus and the vagina.", "The female reproductive system", "Female system: ovaries release eggs, the oviduct (fallopian tube) carries them to the uterus, the cervix is the ring of muscle at the bottom of the uterus, the vagina leads outside (Oak KS3 'reproductive system').", { avoid: ["flower", "flowers", "plant", "plants", "ovary of a flower", "carpel", "stigma", "pollen", "ovule"], doesNotShow: "the menstrual cycle, pregnancy or the male system" }),
  mk("x3-male-repro", "Male reproductive system", ["male reproductive system", "male reproductive", "testis", "testes", "testicle", "sperm duct", "scrotum"], male, "The human male reproductive system: two testes inside the scrotum, a sperm duct from each testis, the bladder and the urethra running through the penis.", "The male reproductive system", "Male system: testes make sperm, sperm ducts carry sperm to the urethra which passes through the penis; the scrotum holds the testes (Oak KS3 'reproductive system').", { avoid: ["flower", "flowers", "plant", "plants", "anther", "pollen", "stamen"], doesNotShow: "glands that add fluid to the sperm; fertilisation; the female system" }),
  mk("x3-teeth", "Types of teeth", ["types of teeth", "types of tooth", "incisor", "incisors", "canine tooth", "canine teeth", "premolar", "premolars", "molars", "molar"], teeth, "A row of human teeth from the front: incisors that cut food, a canine that tears food, and premolars and molars that crush and grind food.", "The types of teeth", "Human teeth: incisors (cutting), canines (tearing), premolars and molars (crushing and grinding) (Oak KS2/KS3 'teeth').", { requires: ["teeth", "tooth"], avoid: ["molar mass", "molar volume", "molar gas", "molar concentration", "=mole", "=moles", "dog", "dogs", "carnivore", "herbivore", "omnivore", "shark", "crocodile"], doesNotShow: "the number of each type of tooth; animal teeth; tooth structure" }),
  mk("x3-tooth-structure", "Structure of a tooth", ["tooth structure", "structure of a tooth", "enamel", "dentine", "pulp cavity"], tooth, "A tooth cut in half: hard white enamel on the outside of the crown, dentine underneath, a pulp cavity in the middle with nerves and blood vessels, the root fixed in the jaw below the gum.", "The structure of a tooth", "Tooth: enamel (hardest outer layer), dentine (bone-like layer), pulp cavity (nerves and blood vessels), root in the jaw under the gum (Oak KS2/KS3 'teeth').", { requires: ["tooth", "teeth"], avoid: ["enamel paint", "shark"], doesNotShow: "the cement layer; tooth decay; gum disease" }),
  mk("x3-leaf-structure", "Inside a leaf", ["leaf structure", "structure of a leaf", "inside a leaf", "palisade", "palisade cell", "palisade mesophyll", "spongy mesophyll", "mesophyll", "epidermis", "waxy cuticle", "cuticle"], leaf, "A cross-section of a leaf showing the waxy cuticle, the upper epidermis, tall palisade cells full of chloroplasts, a spongy layer with air spaces, a vein, and the lower epidermis with a stoma between two guard cells.", "Inside a leaf", "Leaf: waxy cuticle and epidermis (protection), palisade layer (most photosynthesis, packed with chloroplasts), spongy layer (air spaces for gas exchange), veins (xylem and phloem), stomata with guard cells in the lower epidermis (Oak KS3/KS4 'leaf').", { requires: ["leaf", "leaves", "plant", "plants", "photosynthesis"], avoid: ["skin"], doesNotShow: "the contents of the vein; the movement of gases; cell numbers" }),
  mk("x3-stomata", "Stomata and guard cells", ["stomata", "stoma", "guard cell", "guard cells"], stomata, "Two stomata seen from above: on the left the guard cells have swelled with water and bent apart, so the pore is open; on the right they have lost water and gone limp, so the pore is closed.", "Stomata: open and closed", "Guard cells swell with water (turgid) and bend apart, opening the stoma; when they lose water (flaccid) they close it (Oak KS3/KS4 'stomata').", { doesNotShow: "the conditions that open or close the stomata; the gases moving; the cell walls' thickness" }),
  mk("x3-root-hair-cell", "Root hair cell", ["root hair cell", "root hair cells", "root hair", "root hairs"], roothair, "A root hair cell in soil: a plant root cell with a long thin hair reaching between soil particles, with a nucleus, a large vacuole and a cell wall; water and minerals move in from the soil.", "A root hair cell", "Root hair cell: long hair increases the surface area for absorbing water (by osmosis) and mineral ions (by active transport) from the soil; has a thin cell wall and a large vacuole (Oak KS3/KS4 'root hair cell').", { doesNotShow: "chloroplasts (there are none in root cells); how water moves in; the xylem" }),
  mk("x3-xylem-phloem", "Xylem and phloem", ["xylem", "phloem", "translocation", "transport in plants", "vascular bundle"], vascular, "Two plant transport tubes: xylem (dead hollow tubes strengthened with rings) carrying water and minerals up from the roots, and phloem carrying sugars to where they are needed, up and down the plant.", "Xylem and phloem", "Xylem: dead, hollow, lignin-strengthened tubes carrying water and mineral ions upwards. Phloem: living cells carrying sugars (sucrose) made in the leaves in both directions to where they are needed (Oak KS3/KS4 'xylem, phloem').", { doesNotShow: "the cell types (sieve plates, companion cells); the position of the vascular bundles; how much material moves" }),
  mk("x3-transpiration", "Transpiration", ["transpiration", "transpiration stream"], transpiration, "A plant with roots in soil: roots take in water, the water moves up the xylem in the stem, and water vapour leaves through the stomata in the leaves.", "Transpiration", "Transpiration: water is taken up by the roots, moves up the xylem and evaporates from the leaves through the stomata (Oak KS4 'transpiration').", { avoid: ["potometer", "rate of transpiration", "humidity"], doesNotShow: "the factors that change the rate; the potometer" }),
  mk("x3-seed", "Structure of a seed", ["seed structure", "structure of a seed", "parts of a seed", "cotyledon", "plumule", "radicle", "testa", "seed coat"], seed, "A cut-open bean seed: the testa (seed coat) on the outside, the cotyledon that stores food, the plumule (baby shoot) and the radicle (baby root).", "The parts of a seed", "Seed: testa protects; cotyledons store food; plumule = embryo shoot, radicle = embryo root (Oak KS3 'seeds').", { requires: ["seed", "seeds"], avoid: ["monocot", "wheat", "maize", "grain"], doesNotShow: "the micropyle or the seed of a grass (monocot); seed dispersal; germination stages" }),
  mk("x3-germination", "Germination", ["germination", "germinate", "germinates", "germinating", "conditions for germination"], germination, "A seed germinating in three steps: a seed takes in water, the root grows down first, then the shoot grows up and the leaves open. Germination needs water, oxygen and a suitable temperature.", "Germination", "Germination: the seed takes in water, the radicle (root) emerges first and grows down, then the shoot grows up (Oak KS1-KS3 'germination'). Needs water, oxygen and a suitable temperature (light is not needed until leaves form).", { doesNotShow: "the seed dispersal or the plant's later growth" }),
  mk("x3-plant-life-cycle", "Life cycle of a flowering plant", ["plant life cycle", "life cycle of a plant", "life cycle of a flowering plant", "life cycle of flowering plants", "life cycle of plants"], plantCycle, "The life cycle of a flowering plant drawn as a circle: seed, germination, young plant grows, flowers with pollination, fertilisation and seeds forming, seed dispersal, and back to seed.", "The life cycle of a flowering plant", "Flowering plant life cycle: seed -> germination -> growth -> flowers: pollination -> fertilisation -> seeds form in fruit -> seed dispersal -> new seeds germinate (Oak KS2 'life cycles of plants').", { avoid: ["fern", "moss", "conifer", "animal", "animals"], doesNotShow: "the length of time each stage takes; how the seeds are dispersed" }),
  mk("x3-butterfly-cycle", "Life cycle of a butterfly", ["life cycle of a butterfly", "butterfly life cycle", "complete metamorphosis", "chrysalis", "pupa", "caterpillar", "larva"], butterfly, "The life cycle of a butterfly as a circle: egg, caterpillar (larva), chrysalis (pupa), adult butterfly, and back to egg.", "The life cycle of a butterfly", "Butterfly: complete metamorphosis egg -> larva (caterpillar) -> pupa (chrysalis) -> adult (Oak KS2 'life cycles').", { avoid: ["frog", "tadpole", "grasshopper", "incomplete", "human", "bird", "plant"], doesNotShow: "how long each stage lasts; other insects with incomplete metamorphosis" }),
  mk("x3-frog-cycle", "Life cycle of a frog", ["life cycle of a frog", "frog life cycle", "tadpole", "tadpoles", "frogspawn"], frog, "The life cycle of a frog as a circle: egg (frogspawn), tadpole, tadpole with legs, adult frog, and back to egg.", "The life cycle of a frog", "Frog (amphibian): egg (frogspawn) laid in water -> tadpole (gills, tail) -> tadpole growing legs -> adult frog (lungs) (Oak KS2 'life cycles').", { avoid: ["butterfly", "caterpillar", "human", "bird", "plant"], doesNotShow: "how long each stage lasts; other amphibians" }),
];
void [B, G, Y, V, N, GR, R, box, dot, poly, cap];
