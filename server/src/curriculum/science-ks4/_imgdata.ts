// Data behind every science-ks4 diagram. The images are DRAWN from this data (_gen_images.ts) and the answer keys are
// re-computed from it (_check_s4.ts), so picture and key cannot disagree.
export const OSMOSIS = { conc: [0, 0.2, 0.4, 0.6, 0.8, 1.0], pct: [16, 8, 0, -7, -12, -15] }; // sucrose mol/dm³ → % change in mass of potato cylinders
export const ENZYME = { temp: [10, 20, 30, 40, 50, 60], rate: [2, 5, 10, 16, 6, 0] }; // amylase: rate (mg starch broken down per min) vs °C
export const ZONES = { A: 12, B: 20, C: 0 }; // zone-of-inhibition diameters, mm
export const PHOTO = { light: [0, 1, 2, 3, 4, 5, 6], rate: [0, 6, 12, 18, 20, 20, 20] }; // bubbles/min vs light intensity (arbitrary units)
export const GLUC = { time: [0, 30, 60, 90, 120, 150, 180], A: [5.0, 7.5, 6.0, 5.2, 5.0, 5.0, 5.0], B: [9, 14, 17, 18, 17, 16, 15] }; // mmol/dm³
export const PUNNETT = { p1: ["C", "c"], p2: ["C", "c"] };
// pedigree: id, sex, affected, parents
export interface Ped { id: string; sex: "M" | "F"; aff: boolean; gen: number; x: number; parents?: [string, string] }
export const PEDIGREE: Ped[] = [
  { id: "I-1", sex: "M", aff: false, gen: 1, x: 1 }, { id: "I-2", sex: "F", aff: false, gen: 1, x: 2 },
  { id: "II-1", sex: "F", aff: true, gen: 2, x: 0.5, parents: ["I-1", "I-2"] }, { id: "II-2", sex: "M", aff: false, gen: 2, x: 1.5, parents: ["I-1", "I-2"] },
  { id: "II-3", sex: "M", aff: false, gen: 2, x: 2.5, parents: ["I-1", "I-2"] },
];
export const WEB: [string, string][] = [["Grass", "Rabbit"], ["Grass", "Mouse"], ["Grass", "Grasshopper"], ["Grasshopper", "Frog"], ["Mouse", "Owl"], ["Mouse", "Fox"], ["Rabbit", "Fox"], ["Frog", "Owl"]];
export const SHELLS = { protons: 17, neutrons: 18, shells: [2, 8, 7] };
export const TITRATION = { vAcid: 22.5, cAcid: 0.1, vAlk: 25.0 };
export const PROFILE = { reactants: 400, peak: 600, products: 250 }; // kJ/mol
export const RATE = { t: [0, 20, 40, 60, 80, 100, 120], v1: [0, 28, 44, 54, 58, 60, 60], v2: [0, 40, 54, 59, 60, 60, 60] }; // cm³ H₂ vs s
export const CHROM = { front: 10.0, spots: { A: 3.2, B: 6.4, C: 8.0 } as Record<string, number>, sample: [3.2, 8.0] };
export const CO2 = { year: [1960, 1980, 2000, 2020], ppm: [317, 339, 369, 414] };
export const SANKEY = { input: 250, thermal: 60, sound: 15 }; // J; useful = input − thermal − sound
export const CIRC_SERIES = { V: 12, R1: 4, R2: 8 };
export const CIRC_PARALLEL = { V: 12, R1: 6, R2: 3 };
export const IV = { V: [0, 1, 2, 3, 4, 5, 6], lamp: [0, 0.3, 0.5, 0.62, 0.7, 0.73, 0.75], resistor: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] };
export const HEAT = { pts: [[0, 20], [4, 60], [9, 60], [17, 140], [26, 140], [30, 180]] as [number, number][] }; // (min, °C)
export const DECAY = { N0: 800, half: 6 }; // counts per minute, hours
export const VT = { pts: [[0, 0], [10, 20], [30, 20], [35, 0]] as [number, number][] }; // (s, m/s)
export const WAVE = { lambda: 8, amp: 3, len: 20 }; // cm
export const TRANSFORMER = { Np: 460, Ns: 40, Vp: 230 };
export const ALLOY = { rows: 4, cols: 6 };

// helpers used by the checker
export const interpX = (xs: number[], ys: number[], y0: number) => {
  for (let i = 0; i < xs.length - 1; i++) if ((ys[i] - y0) * (ys[i + 1] - y0) <= 0 && ys[i] !== ys[i + 1]) return xs[i] + ((y0 - ys[i]) * (xs[i + 1] - xs[i])) / (ys[i + 1] - ys[i]);
  return NaN;
};
export const interpY = (xs: number[], ys: number[], x0: number) => {
  for (let i = 0; i < xs.length - 1; i++) if (x0 >= xs[i] && x0 <= xs[i + 1]) return ys[i] + ((x0 - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]);
  return NaN;
};

// Punnett-square helper: gametes of each parent (one allele per gamete) → the offspring genotypes (dominant first).
export const punnett = (p1: string, p2: string): string[] => {
  const out: string[] = [];
  for (const a of p1) for (const b of p2) out.push([a, b].sort((x, y) => (x === x.toUpperCase() ? 0 : 1) - (y === y.toUpperCase() ? 0 : 1)).join(""));
  return out;
};
export const fracRecessive = (p1: string, p2: string) => { const g = punnett(p1, p2); return g.filter((x) => x === x.toLowerCase()).length / g.length; };
