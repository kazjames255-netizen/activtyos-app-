// Data that both the images (scratch/curriculum-images/gen-s6.ts) and the checkers use, so picture and key cannot disagree.
import { R } from "./_atoms";

// ── c5atom ──
export const MS_MG = [{ mz: 24, pct: 78.6 }, { mz: 25, pct: 10.1 }, { mz: 26, pct: 11.3 }];
export const IE_X = [578, 1817, 2745, 11577, 14842, 18379]; // kJ mol-1, successive ionisation energies of "element X"

// ── c5energy ──
export const HESS_PROPANE = { dHc_C: -393.5, dHc_H2: -285.8, dHc_C3H8: -2219.2 }; // kJ mol-1
export const BH_NACL = { dHf: -411, atNa: 107, ie1Na: 496, halfCl2: 122, eaCl: -349 }; // lattice enthalpy of formation = dHf - (others)

// ── c5kin ──
/** Maxwell–Boltzmann shape f(E) ∝ sqrt(E) exp(-E/kT), plotted in arbitrary units against E in units of kT(300). */
export const MB = { T1: 300, T2: 400, Ea: 3.0 }; // Ea in units of k*T1 (arbitrary scale)
export const ARR = { lnA: 22.0, Ea: 60000 }; // ln k = lnA - Ea/(R T); Ea in J mol-1
export const arrLnK = (invT: number) => ARR.lnA - (ARR.Ea / R) * invT;
export const HL = { A0: 0.80, tHalf: 50 }; // first-order decay: [A] = A0 * 2^(-t/tHalf)

// ── c5eq ──
export const TITR = { Ca: 0.100, Va: 25.0, Cb: 0.100, Ka: 1.75e-5 }; // 25.0 cm3 of 0.100 mol dm-3 CH3COOH titrated with 0.100 mol dm-3 NaOH
/** pH after adding vb cm3 of NaOH: exact solution of the charge balance. */
export function titrPH(vb: number): number {
  const { Ca, Va, Cb, Ka } = TITR;
  const V = (Va + vb) / 1000; const cA = (Ca * Va) / 1000 / V; const cNa = (Cb * vb) / 1000 / V;
  const f = (h: number) => cNa + h - 1e-14 / h - (cA * Ka) / (Ka + h); // charge balance: [Na+]+[H+] = [OH-]+[A-]
  let lo = 1e-14, hi = 1; for (let i = 0; i < 200; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > 0) hi = mid; else lo = mid; }
  return -Math.log10(Math.sqrt(lo * hi));
}

// ── c5anal ──
export const IR_PEAKS = [{ wn: 2950, depth: 0.3, w: 50 }, { wn: 1710, depth: 0.85, w: 22 }, { wn: 1300, depth: 0.45, w: 30 }, { wn: 2900, depth: 0.6, w: 320 }]; // broad 2500–3300 (acid O–H) + C=O
export const MS_PENTANONE = [{ mz: 86, pct: 22 }, { mz: 57, pct: 100 }, { mz: 29, pct: 42 }, { mz: 27, pct: 14 }, { mz: 28, pct: 8 }];
export const NMR_ETOAC = [ { d: 1.26, h: 3, m: "t" }, { d: 2.04, h: 3, m: "s" }, { d: 4.12, h: 2, m: "q" } ];
export const TLC = { front: 8.0, spots: [{ name: "A", d: 2.4 }, { name: "B", d: 5.2 }, { name: "Sample", d: 5.2 }, { name: "C", d: 6.4 }] };

export const PROFILE = { Ea: 85, dH: -120 }; // kJ mol-1: exothermic reaction profile (forward Ea 85, ΔH −120)
