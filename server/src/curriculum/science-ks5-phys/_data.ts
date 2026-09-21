// Data shared by the image generator (scratch/curriculum-images/gen-s7.ts) and the checkers: pictures are drawn FROM these arrays.
export const PEND = { L: [0.2, 0.4, 0.6, 0.8, 1.0], T2: [0.79, 1.65, 2.4, 3.25, 4.01], A: [0.2, 0.8] as [number, number], B: [0.9, 3.62] as [number, number] };

export const PE = { f0: 6.0e14, fmax: 12e14 }; // photoelectric graph: KEmax = h(f − f0)/e
/** Atomic masses in u (H-1 and neutron for the mass-defect calculation); BE/A curve is computed from these. */
export const mH = 1.00782503, mn = 1.00866492, uMeV = 931.494;
export const NUCL: { s: string; Z: number; A: number; M: number; label?: boolean }[] = [
  { s: "²H", Z: 1, A: 2, M: 2.01410178, label: true }, { s: "⁴He", Z: 2, A: 4, M: 4.00260325, label: true }, { s: "⁷Li", Z: 3, A: 7, M: 7.01600344 },
  { s: "¹²C", Z: 6, A: 12, M: 12.0, label: true }, { s: "¹⁶O", Z: 8, A: 16, M: 15.99491462 }, { s: "²⁰Ne", Z: 10, A: 20, M: 19.99244018 },
  { s: "⁴⁰Ca", Z: 20, A: 40, M: 39.96259098 }, { s: "⁵⁶Fe", Z: 26, A: 56, M: 55.9349375, label: true }, { s: "⁸⁴Kr", Z: 36, A: 84, M: 83.9114977 },
  { s: "¹²⁰Sn", Z: 50, A: 120, M: 119.9022016, label: true }, { s: "¹⁹⁷Au", Z: 79, A: 197, M: 196.9665687 }, { s: "²³⁵U", Z: 92, A: 235, M: 235.0439299, label: true },
];
export const beA = (n: { Z: number; A: number; M: number }) => ((n.Z * mH + (n.A - n.Z) * mn - n.M) * uMeV) / n.A;

/** Young's double-slit intensity pattern (fringe spacing DS.w mm); position y in mm across the screen. */
export const DS = { w: 2.4, y0: -8, y1: 8, I: (y: number) => Math.cos((Math.PI * y) / 2.4) ** 2 / (1 + (y / 7) ** 2) };
/** Stationary wave on a string of length STAND.L metres with STAND.n loops. */
export const STAND = { L: 1.8, n: 3 };

/** Velocity–time graph (t/s, v/m s⁻¹) for p5mech-y12-06; distance = area under it. */
export const VT: [number, number][] = [[0, 0], [6, 9], [14, 9], [18, 0]];
/** Block on a rough slope for p5mech-y12-10. */
export const INCL = { theta: 25, m: 6.0, fr: 10 };

/** p5elec-y12-05: series–parallel circuit (12 V cell; R1 in series with Ra ∥ Rb). */
export const CIRC = { V: 12, r1: 7.0, ra: 18, rb: 9.0 };
/** p5elec-y12-07: I–V characteristics (V in volts, I in amps). A resistor, B filament lamp, C diode, D NTC thermistor. */
export const IV = {
  A: (v: number) => 0.15 * v,
  B: (v: number) => Math.sign(v) * 0.7 * Math.abs(v) ** 0.6,
  C: (v: number) => (v < 0.6 ? 0 : 0.01 * (Math.exp(5 * (v - 0.6)) - 1)),
  D: (v: number) => Math.sign(v) * 0.02 * (Math.exp(0.9 * Math.abs(v)) - 1) + 0.05 * v,
};
/** p5elec-y12-09: terminal p.d. against current for a cell (emf 6.0 V, r = 1.5 Ω) with a little scatter. */
export const CELL = { I: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0], noise: [0.0, 0.03, -0.03, 0.02, -0.02, 0.03, -0.03], emf: 6.0, r: 1.5 };
/** p5elec-y13: capacitor circuit for Q5 and the discharge graph for Q8. */
export const RC = { C: 1000e-6, R: 22e3, V0: 12 };
export const DIS = { V0: 9.0, tau: 3.0 };

/** SHM displacement–time graph for p5circ-y13-07: x = A cos(2πt/T), A in cm, T in s. */
export const SHM = { A: 6.0, T: 2.4 };

/** Constant-volume gas: pressure (10⁵ Pa) against Celsius temperature, p = 1.05 (θ + 273.15) / 293.15. */
export const PT = { theta: [20, 40, 60, 80, 100], p: (th: number) => (1.05 * (th + 273.15)) / 293.15 };

/** Flux linkage NΦ (Wb turns) against time (s) for p5field-y13-09. */
export const FLUX: [number, number][] = [[0, 0], [0.2, 0.6], [0.6, 0.6], [1.0, 0]];

/** Measured count rate (counts per minute) against time (min): background BG plus a source of initial corrected rate R0 and half-life HL. */
export const DEC = { bg: 20, r0: 180, hl: 8.0 };
export const decRate = (t: number) => DEC.bg + DEC.r0 * 2 ** (-t / DEC.hl);

/** H–R diagram for p5astro-y13-01 (T in K, L in solar luminosities). The lettered stars are drawn; the faint band is the main sequence. */
export const HR = {
  stars: [{ n: "V", T: 25000, L: 1e4 }, { n: "Y", T: 5800, L: 1 }, { n: "Z", T: 3200, L: 1e-3 }, { n: "X", T: 3500, L: 1e5 }, { n: "W", T: 12000, L: 1e-2 }],
  mainSeq: [[40000, 1e5], [25000, 1e4], [10000, 50], [5800, 1], [4000, 0.1], [3200, 1e-3], [2500, 1e-4]] as [number, number][],
};
