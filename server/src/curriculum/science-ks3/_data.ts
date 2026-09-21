// Shared DATA for the science-ks3 pack: the SAME arrays draw the diagrams (_gen.ts) and are used by _check_s3.ts
// to recompute the answer keys, so picture and key cannot disagree. Leading underscore = skipped by validate.ts.

// ── Biology ──────────────────────────────────────────────────────────────────
export const ANIMAL_CELL = { A: "cell membrane", B: "nucleus", C: "mitochondrion", D: "cytoplasm" };
export const PLANT_CELL = { P: "cell wall", Q: "chloroplast", R: "permanent vacuole", S: "nucleus" };
export const DIGESTIVE = { A: "oesophagus", B: "stomach", C: "small intestine", D: "large intestine", E: "liver" };
export const FLOWER = { A: "stigma", B: "anther", C: "petal", D: "ovary", E: "sepal" };
// vaccination: % of children vaccinated -> cases per 100 000 people (invented data for a study of 6 towns)
export const VACC: [number, number][] = [[50, 90], [60, 70], [70, 50], [80, 30], [90, 10], [95, 4]];
// rate of photosynthesis (arbitrary units) against light intensity (arbitrary units)
export const PHOTO: [number, number][] = [[0, 0], [1, 2], [2, 4], [3, 6], [4, 8], [5, 8], [6, 8], [8, 8], [10, 8]];
// heights of 30 students: class start (cm) -> frequency; classes are 5 cm wide (135 ≤ h < 140, ...)
export const HEIGHTS: [number, number][] = [[135, 2], [140, 5], [145, 9], [150, 8], [155, 4], [160, 2]];
export const FOODWEB = {
  nodes: { Grass: [330, 470], Rabbit: [110, 320], Mouse: [340, 320], Grasshopper: [570, 350], Frog: [680, 210], Fox: [200, 130], Owl: [490, 90] } as Record<string, [number, number]>,
  edges: [["Grass", "Rabbit"], ["Grass", "Mouse"], ["Grass", "Grasshopper"], ["Rabbit", "Fox"], ["Mouse", "Fox"], ["Mouse", "Owl"], ["Grasshopper", "Frog"], ["Frog", "Owl"]] as [string, string][], // food -> eater
};

// ── Chemistry ────────────────────────────────────────────────────────────────
export const STATES_PANELS: { letter: string; state: "solid" | "liquid" | "gas" }[] = [{ letter: "A", state: "gas" }, { letter: "B", state: "solid" }, { letter: "C", state: "liquid" }];
// heating curve for "substance Y": [time min, temperature °C]
export const HEATING: [number, number][] = [[0, 20], [3, 80], [6, 80], [9, 140], [13, 140], [15, 180]];
// particle boxes: X = blue atoms, Y = orange atoms; "single" atoms, "pair" = two atoms joined by a bond
export const MIXBOXES: { letter: string; kind: "element-atoms" | "compound" | "mixture" | "element-molecules" }[] = [
  { letter: "A", kind: "element-atoms" }, { letter: "B", kind: "compound" }, { letter: "C", kind: "mixture" }, { letter: "D", kind: "element-molecules" }];
// first 20 elements: [symbol, group label, period]; hidden cells replaced by letters in the picture
export const PT: [string, string, number][] = [
  ["H", "1", 1], ["He", "0", 1],
  ["Li", "1", 2], ["Be", "2", 2], ["B", "3", 2], ["C", "4", 2], ["N", "5", 2], ["O", "6", 2], ["F", "7", 2], ["Ne", "0", 2],
  ["Na", "1", 3], ["Mg", "2", 3], ["Al", "3", 3], ["Si", "4", 3], ["P", "5", 3], ["S", "6", 3], ["Cl", "7", 3], ["Ar", "0", 3],
  ["K", "1", 4], ["Ca", "2", 4]];
export const PT_HIDDEN: Record<string, string> = { A: "Li", B: "Cl", C: "Na", D: "Ne" };
export const PH_MARKS: Record<string, number> = { A: 2, B: 7, C: 10, D: 13 };
// mass of flask + contents (g) against time (min), open flask, marble chips + acid
export const MASSLOSS: [number, number][] = [[0, 150.0], [1, 149.2], [2, 148.6], [3, 148.2], [4, 148.0], [5, 148.0], [6, 148.0]];
export const ATMOS = { A: ["nitrogen", 78], B: ["oxygen", 21], C: ["all other gases together", 1] } as Record<string, [string, number]>;

// ── Physics ──────────────────────────────────────────────────────────────────
// distance–time graph (t seconds, d metres) for a cyclist on a straight path
export const DT: [number, number][] = [[0, 0], [20, 100], [40, 100], [60, 300], [100, 0]];
export const MOMENT = { leftForce: 40, leftDist: 0.3, rightDist: 0.6 }; // N, m, m — balanced; right force is the unknown
export const FORCES = { drive: 500, drag: 200, weight: 800, reaction: 800 }; // newtons, box on a road
export const SPRING: [number, number][] = [[0, 0], [2, 1], [4, 2], [6, 3], [8, 4], [10, 5], [12, 7.5]]; // [force N, extension cm]
export const MIRROR_ANGLE = 35; // angle of incidence, degrees from the normal
export const TRACES = { A: { amp: 1.0, cycles: 2 }, B: { amp: 0.5, cycles: 4 } }; // amplitude (cm) and cycles shown in the same time window
export const SANKEY = { input: 250, useful: 175 }; // joules
export const SERIES = { a1: 0.4 }; // amps
export const PARALLEL = { a1: 0.9, a2: 0.5 }; // amps (A3 unknown)
export const VIR = { V: 6.0, I: 0.3 };
export const SYMBOLS: Record<string, string> = { A: "cell", B: "lamp", C: "switch", D: "ammeter", E: "voltmeter", F: "resistor" };
export const SEASONS = { tilt: 23.5, positions: { A: [150, 270], B: [400, 100], C: [650, 270], D: [400, 440] } as Record<string, [number, number]>, sun: [400, 270] as [number, number] };
