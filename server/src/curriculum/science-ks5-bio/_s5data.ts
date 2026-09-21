// Shared data for the science-ks5-bio pack: every picture is drawn FROM this data
// (scratch/curriculum-images/gen-s5.ts) and _check_s5.ts recomputes answers from it.
export const MOL = {
  front: 10.0,
  known: { P: 6.5, Q: 3.9, R: 8.2, S: 2.1 } as Record<string, number>,
  mixture: [3.9, 8.2],
};
export const MITO = { imageMm: 45, mag: 15000 }; // actual = 45 mm / 15000 = 3 µm
export const TRANS = { Vmax: 10, K: 4, slope: 0.5 };
export const ENZ = {
  Vmax: 20, tau: 25, // V(t) = Vmax (1 - exp(-t/tau)) cm³ ; initial rate = Vmax/tau
  tangent: [[0, 0], [25, 20]] as [number, number][],
  sub: { ctrl: { V: 10, K: 2 }, A: { V: 10, K: 6 }, B: { V: 5, K: 2 } },
};
export const HB = { n: 2.7, adult: 3.5, highCO2: 5.0, foetal: 2.5 };
export const TREE = {
  names: ["W", "X", "Y", "Z"],
  d: { WX: 2, WY: 9, WZ: 15, XY: 10, XZ: 16, YZ: 14 } as Record<string, number>,
};
export const IMM = { primaryPeak: 100, secondaryPeak: 1000 }; // arbitrary units, log axis
export const PLATE = { disc: 6, zones: { A: 12, B: 24, C: 6, D: 18 } as Record<string, number> }; // mm; C = no zone (disc only)
export const PHOTO = { low: { R: 6, K: 25 }, high: { R: 12, K: 25 }, X: 80 };
export const PED = {
  // [id, sex, affected, x, y]
  people: [
    ["I-1", "M", false, 1.5, 0], ["I-2", "F", false, 3.5, 0],
    ["II-1", "F", true, 0.5, 1], ["II-2", "M", false, 2.5, 1], ["II-5", "F", false, 3.5, 1], ["II-3", "F", false, 5.0, 1], ["II-4", "M", false, 6.0, 1],
    ["III-1", "M", false, 5.0, 2], ["III-2", "F", false, 6.0, 2], ["III-3", "M", true, 3.0, 2],
  ] as [string, "M" | "F", boolean, number, number][],
};
export const AP = { rest: -70, threshold: -55, peak: 40, hyper: -80 };
export const GLU = {
  t: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4],
  healthy: [4.8, 5.4, 6.4, 6.9, 6.6, 5.9, 5.2, 4.8, 4.7, 4.8],
  diabetic: [9.0, 10.5, 13.0, 15.0, 16.0, 16.0, 14.8, 13.4, 12.0, 10.5],
};
export const WEB = {
  nodes: { grass: 0, grasshopper: 1, rabbit: 1, frog: 2, fox: 2, snake: 3, hawk: 4 } as Record<string, number>,
  edges: [["grass", "grasshopper"], ["grass", "rabbit"], ["grasshopper", "frog"], ["frog", "snake"], ["rabbit", "fox"], ["rabbit", "hawk"], ["snake", "hawk"]] as [string, string][],
};
export const PYR = { levels: [["Producers", 25000], ["Primary consumers", 2900], ["Secondary consumers", 270]] as [string, number][] };
export const GEL = {
  ladder: [1000, 800, 600, 400, 200],
  lanes: { CS: [800, 400], S1: [1000, 600, 200], S2: [800, 400], S3: [800, 200] } as Record<string, number[]>,
  d0: 1.5, k: 4.29, // migration (cm) = d0 + k (3 - log10 size)
};
export const STAT = {
  control: [12.1, 13.4, 12.8, 14.0, 13.2],
  treated: [14.9, 15.8, 15.3, 15.6, 14.4],
};
export const migr = (bp: number) => GEL.d0 + GEL.k * (3 - Math.log10(bp));
export const hill = (p: number, p50: number, n = HB.n) => (100 * p ** n) / (p50 ** n + p ** n);
export const mm = (s: number, V: number, K: number) => (V * s) / (K + s);
