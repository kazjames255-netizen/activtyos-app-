// Shared DATA for the science-ks2 pack. Both the picture generator (scratch/curriculum-images/gen-s2.ts) and the
// answer-key checker (_check_s2.ts) read this file, so the pictures and the keys cannot disagree.
// (Leading underscore = skipped by validate.ts.)

export interface BarData { title: string; ylabel: string; cats: string[]; vals: number[]; ymax: number; step: number; xlabel?: string }

export const PLANTS_G: BarData = { title: "Healthy green leaves on bean plants after 2 weeks", ylabel: "Number of healthy leaves", xlabel: "Where the plant was kept", cats: ["Light +\nwater", "Light,\nno water", "Dark +\nwater", "Dark,\nno water"], vals: [12, 3, 4, 1], ymax: 14, step: 2 };
export const ROCKS_G: BarData = { title: "Water soaked up by 100 g rock samples in 1 hour", ylabel: "Water soaked up (ml)", xlabel: "Rock", cats: ["Chalk", "Sandstone", "Slate", "Granite"], vals: [9, 7, 2, 1], ymax: 10, step: 2 };
/** Y3 light: torch-to-screen distance D, object height H, object positions d (cm from torch). Shadow height = H×D/d. */
export const SHADOW3 = { D: 60, H: 10, d: [15, 20, 30, 40, 50] };
export const shadowH = (H: number, D: number, d: number) => (H * D) / d;
export const FRICTION_G: BarData = { title: "How far a toy car rolled after leaving a ramp", ylabel: "Distance rolled (cm)", xlabel: "Surface", cats: ["Sandpaper", "Carpet", "Wood", "Smooth\nplastic"], vals: [20, 45, 110, 150], ymax: 160, step: 20 };
export const SOUND_G: BarData = { title: "Distance at which a ticking clock could no longer be heard", ylabel: "Distance (m)", xlabel: "Clock wrapped in…", cats: ["Nothing", "Newspaper", "Bubble\nwrap", "Woolly\nhat", "Foam"], vals: [18, 12, 9, 5, 3], ymax: 20, step: 4 };
export const GEST_G: BarData = { title: "About how long baby mammals grow before birth", ylabel: "Number of days", xlabel: "Mammal", cats: ["Mouse", "Cat", "Sheep", "Human", "Elephant"], vals: [20, 65, 150, 270, 660], ymax: 700, step: 100 };
export const DISS_G: BarData = { title: "Spoonfuls of sugar that dissolved in 100 ml of water", ylabel: "Spoonfuls dissolved", xlabel: "Water temperature (°C)", cats: ["10", "30", "50", "70"], vals: [8, 10, 13, 17], ymax: 18, step: 2 };
export const MOTH_G: BarData = { title: "Moths still alive after 2 days on pale birch bark (40 of each kind released)", ylabel: "Number of moths", xlabel: "Kind of moth", cats: ["Pale moths", "Dark moths"], vals: [30, 10], ymax: 40, step: 10 };

/** Y4 states: heating a beaker of ice, temperature (°C) against time (minutes); straight lines between the points. */
export const HEAT: [number, number][] = [[0, -10], [2, 0], [6, 0], [14, 100], [24, 100]];
export const interp = (pts: [number, number][], x: number) => {
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return NaN;
};
/** Y5 animals: typical height (cm) against age (years). */
export const GROWTH: [number, number][] = [[0, 50], [2, 87], [4, 102], [6, 115], [8, 128], [10, 138], [12, 149], [14, 163], [16, 171], [18, 173]];
/** Y6 animals: pulse (beats per minute) each minute; exercise from minute 2 to 6. */
export const PULSE: [number, number][] = [[0, 70], [1, 70], [2, 72], [3, 110], [4, 130], [5, 140], [6, 140], [7, 118], [8, 95], [9, 80], [10, 72]];
/** Y5 forces: parachute drop times (s), 3 trials each. */
export const PARA = { widths: [10, 20, 30], trials: [[1.1, 1.3, 1.2], [1.9, 2.1, 2.0], [2.7, 2.9, 2.8]] };
export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
/** Y5 forces: three meshing gears in a row, teeth per gear (A turns clockwise). */
export const GEARS = { A: 12, B: 24, C: 12 };
/** Y6 light: point source, object, screen (cm along the bench). */
export const SHADOW6 = { obj: 4, d: 8, D: 24 };

/** Y4 living things: a branching (dichotomous) key. Each node is a yes/no question or an animal. */
export type KeyNode = { q: string; yes: KeyNode | string; no: KeyNode | string };
export const KEY: KeyNode = {
  q: "Does it have legs?",
  no: { q: "Does it have a shell?", yes: "Snail", no: "Earthworm" },
  yes: {
    q: "Does it have 6 legs?",
    yes: { q: "Does it have wings?", yes: "Ladybird", no: "Ant" },
    no: { q: "Does it have 8 legs?", yes: "Spider", no: "Woodlouse" },
  },
};
export function runKey(node: KeyNode | string, answers: boolean[]): string {
  let n: KeyNode | string = node; let i = 0;
  while (typeof n !== "string") { n = answers[i++] ? n.yes : n.no; }
  return n;
}

/** Y5 earth & space: eight Moon views, drawn from the phase angle (0 = new, 180 = full). Lit on the right while waxing. */
export const MOONS: { letter: string; angle: number; name: string }[] = [
  { letter: "A", angle: 135, name: "waxing gibbous" },
  { letter: "B", angle: 0, name: "new" },
  { letter: "C", angle: 180, name: "full" },
  { letter: "D", angle: 90, name: "first quarter" },
  { letter: "E", angle: 315, name: "waning crescent" },
  { letter: "F", angle: 270, name: "last quarter" },
  { letter: "G", angle: 45, name: "waxing crescent" },
  { letter: "H", angle: 225, name: "waning gibbous" },
];
export const litFraction = (angle: number) => (1 - Math.cos((angle * Math.PI) / 180)) / 2;

/** Circuits. Each side of the rectangular loop holds a list of components. Symbols: cell, bulb, sw1 (closed switch), sw0 (open switch), gap (broken wire). */
export type Comp = "cell" | "bulb" | "sw1" | "sw0" | "gap";
export interface Circuit { id: string; left: Comp[]; top: Comp[]; right: Comp[]; bottom: Comp[] }
export const CIRC4: Circuit[] = [
  { id: "A", left: ["cell"], top: ["bulb"], right: [], bottom: ["sw1"] },
  { id: "B", left: ["cell"], top: ["bulb"], right: [], bottom: ["sw0"] },
  { id: "C", left: ["cell"], top: ["bulb"], right: ["gap"], bottom: [] },
  { id: "D", left: ["cell"], top: ["bulb", "bulb"], right: [], bottom: ["sw1"] },
];
export const CIRC6: Circuit[] = [
  { id: "A", left: ["cell"], top: ["bulb"], right: [], bottom: ["sw1"] },
  { id: "B", left: ["cell", "cell"], top: ["bulb"], right: [], bottom: ["sw1"] },
  { id: "C", left: ["cell"], top: ["bulb", "bulb"], right: [], bottom: ["sw1"] },
  { id: "D", left: ["cell", "cell", "cell"], top: ["bulb"], right: [], bottom: ["sw1"] },
];
export const all = (c: Circuit) => [...c.left, ...c.top, ...c.right, ...c.bottom];
/** A circuit lights its bulbs only if it has a cell and every component in the single loop is closed. */
export const lights = (c: Circuit) => all(c).includes("cell") && !all(c).some((x) => x === "sw0" || x === "gap");
/** Relative brightness of each bulb: more cells → brighter, more bulbs sharing → dimmer. */
export const brightness = (c: Circuit) => (lights(c) ? all(c).filter((x) => x === "cell").length / all(c).filter((x) => x === "bulb").length : 0);

/** Y3 animals skeleton labels and Y4 digestive labels (letter → part). */
export const SKEL: Record<string, string> = { A: "skull", B: "ribs", C: "thigh bone (femur)", D: "backbone (spine)" };
export const DIGEST: Record<string, string> = { A: "mouth", B: "food pipe (oesophagus)", C: "stomach", D: "large intestine", E: "small intestine" };
export const PLANTPARTS: Record<string, string> = { A: "leaf", B: "flower", C: "roots", D: "stem" };
export const CYCLE: Record<string, string> = { A: "evaporation", B: "condensation", C: "precipitation", D: "collection" };
export const FILTER: Record<string, string> = { A: "mixture poured in", B: "filter paper", C: "sand trapped (residue)", D: "clear water (filtrate)" };

/** Y6 living things: animal characteristics table. */
export const GROUPS_COLS = ["Backbone", "Feathers", "Hair or fur", "Damp, smooth skin", "Scales", "Gills as an adult", "Feeds babies milk"];
export const GROUPS_ROWS: { id: string; group: string; v: boolean[] }[] = [
  { id: "P", group: "bird", v: [true, true, false, false, false, false, false] },
  { id: "Q", group: "mammal", v: [true, false, true, false, false, false, true] },
  { id: "R", group: "amphibian", v: [true, false, false, true, false, false, false] },
  { id: "S", group: "fish", v: [true, false, false, false, true, true, false] },
  { id: "T", group: "reptile", v: [true, false, false, false, true, false, false] },
];
