// Independent image-QA gates for the Science pictures (review of generated Oak decks). Each entry TIGHTENS the picture's own gates after a wrong or
// off-topic match was found by running chooseArt over every generated Science slide (KS1-KS4). Applied once, at load, by library.ts.
//   avoid     = extra phrases that veto the picture (other meaning of the word / a topic the picture would contradict)
//   requires  = at least one of these must also be in the slide (only added to pictures that had no `requires`)
//   keyStages = the picture is refused for any other key stage (a diagram beyond the level of the lesson)
//   concepts  = extra exact phrases the picture is valid for
import type { Pic } from "./types";

interface Gate { avoid?: string[]; requires?: string[]; keyStages?: string[]; concepts?: string[] }
/** "=aa", "=cc", ... "=zz" (whole words; every letter but b): a genotype written with other letters than the pictures' B / b */
export const OTHER_ALLELE_PAIRS: string[] = [..."acdefghijklmnopqrstuvwxyz"].map((c) => `=${c}${c}`);
export const QA_GATES: Record<string, Gate> = {
  // "antagonistic effects" of hormones / thermoregulation are not muscle pairs
  "x3-antagonistic-muscles": { requires: ["muscle", "muscles", "biceps", "triceps", "joint", "joints", "bone", "bones", "tendon", "tendons", "limb", "limbs", "arm", "arms"], avoid: ["hormone", "hormones", "insulin", "glucagon", "thermoregulation", "homeostasis", "negative feedback", "hypothalamus", "sweat", "shivering", "blood glucose", "blood sugar"] },
  // "diffuse reflection" is light, not particle diffusion
  "x3-diffusion": { avoid: ["diffuse reflection", "diffuse reflector", "specular", "reflection", "reflected", "reflect", "ray", "rays"] },
  // "larva" / "metamorphosis" on an amphibian lesson must not draw a butterfly
  "x3-butterfly-cycle": { requires: ["insect", "insects", "butterfly", "butterflies", "moth", "moths", "caterpillar", "caterpillars", "chrysalis", "pupa"], avoid: ["amphibian", "toad", "toads", "newt", "salamander", "fish", "mammal", "reptile"] },
  // non-infectious / lifestyle diseases are NOT caused by pathogens
  "x3-pathogens": { avoid: ["non infectious", "noninfectious", "not infectious", "lifestyle"] },
  // crystals in rocks / minerals are not crystals grown from a solution
  "x3-crystallisation": { avoid: ["mineral", "minerals", "grain", "grains", "rock", "rocks", "interlocking", "texture", "textures"] },
  // solvent abuse / alcohols are not the dissolving diagram
  "x3-dissolving": { avoid: ["solvent abuse", "inhal", "alcohol", "alcohols", "drug", "drugs"] },
  // the law-of-reflection ray diagram (normal, i = r) is KS3+; scattering / diffuse reflection is not drawn
  "reflection-of-light": { keyStages: ["ks3", "ks4"], avoid: ["scatter", "scattered", "diffuse", "diffuse reflection"] },
  // moment = force x distance and the predator-prey population graph are KS3+
  "x3-moments": { keyStages: ["ks3", "ks4"] },
  "x3-predator-prey": { keyStages: ["ks3", "ks4"], requires: ["population", "populations", "number", "numbers", "cycle", "cycles", "graph", "graphs", "abundance"] },
  // a diet chart is not the picture for micro-organisms / mould feeding on food
  "x3-balanced-diet": { avoid: ["mould", "moulds", "fungi", "fungus", "micro organism", "microorganism", "micro organisms", "microorganisms", "bacteria", "yeast"] },
  // a small flowering plant is not a tree or a bulb
  "plant-parts": { avoid: ["tree", "trees", "evergreen", "deciduous", "bulb", "bulbs"] },
  // slides on BOTH balanced and unbalanced forces show neither (one picture would only cover half)
  "unbalanced-forces": { avoid: ["balanced and unbalanced", "unbalanced and balanced"] },
  "balanced-forces": { avoid: ["balanced and unbalanced", "unbalanced and balanced"] },
  // "EM spectrum" is the electromagnetic spectrum, not the prism
  "em-spectrum": { concepts: ["em spectrum"] },
  "x3-prism": { avoid: ["em spectrum"] },
  // Rutherford scattering is not the penetration diagram
  "x3-radiation-penetration": { avoid: ["scatter", "scattering", "scattered", "gold foil", "rutherford"] },
  // gas pressure from the particle model is not pressure = force / area
  "x3-pressure-triangle": { avoid: ["particle model", "=gas", "=gases"] },
  // ── round 2 (leftovers of the science image QA) ──
  // a slide whose subject is population growth / human impacts / biodiversity only MENTIONS greenhouse gases: the greenhouse-effect diagram is off-topic there
  "x3-greenhouse": { avoid: ["population", "life expectancy", "urbanisation", "deforestation", "biodiversity", "habitat loss"] },
  // "evolution" on a time-scales / fossil-evidence slide is not the five steps of natural selection
  "x3-natural-selection": { avoid: ["time scale", "timescale", "billion", "million", "thousand", "fossil", "geological"] },
  // the pictures are drawn with the alleles B / b: a slide that uses other letters (PP, Pp, pp; EE, Ee, ee; Tt ...) would contradict them, so any doubled
  // letter other than bb vetoes both (norm() lower-cases, so PP, Pp and pp all become the whole word "pp")
  "x3-alleles": { avoid: OTHER_ALLELE_PAIRS },
  "x3-punnett-square": { avoid: OTHER_ALLELE_PAIRS },
  // KS3+ diagrams that had reached KS2 slides: the prokaryote (plasmids, flagellum) and the human reproductive systems
  "x3-bacterial-cell": { keyStages: ["ks3", "ks4"] },
  "x3-female-repro": { keyStages: ["ks3", "ks4"] },
  "x3-male-repro": { keyStages: ["ks3", "ks4"] },
};

export function applyQaGates(pics: Pic[]): void {
  for (const [id, g] of Object.entries(QA_GATES)) {
    const p = pics.find((x) => x.id === id);
    if (!p) throw new Error(`qaGates: unknown picture ${id}`);
    if (g.avoid) p.avoid = [...new Set([...(p.avoid ?? []), ...g.avoid])];
    if (g.requires) p.requires = [...new Set([...(p.requires ?? []), ...g.requires])];
    if (g.keyStages) p.keyStages = g.keyStages;
    if (g.concepts) p.concepts = [...new Set([...p.concepts, ...g.concepts])];
  }
}
