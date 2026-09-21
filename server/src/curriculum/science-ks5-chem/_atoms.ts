// Atomic masses used everywhere in this pack (A-level data-sheet style, 1 d.p.) + a formula parser + constants.
export const AR: Record<string, number> = {
  H: 1.0, Li: 6.9, B: 10.8, C: 12.0, N: 14.0, O: 16.0, F: 19.0, Na: 23.0, Mg: 24.3, Al: 27.0, Si: 28.1, P: 31.0, S: 32.1, Cl: 35.5,
  K: 39.1, Ca: 40.1, Mn: 54.9, Fe: 55.8, Cu: 63.5, Zn: 65.4, Br: 79.9, Ag: 107.9, I: 126.9, Ba: 137.3, Pb: 207.2,
};
export const R = 8.31; // J K^-1 mol^-1
export const NA = 6.02e23;
export const KW = 1.0e-14;
/** Mr of a formula such as "Ca(OH)2", "CuSO4.5H2O", "C2H5OH" (no charges). */
export function Mr(formula: string): number {
  return formula.split(".").reduce((sum, part) => {
    const m = part.match(/^(\d+)(.*)$/); const mult = m ? Number(m[1]) : 1; const f = m ? m[2] : part;
    return sum + mult * parseGroup(f);
  }, 0);
}
function parseGroup(f: string): number {
  let i = 0;
  const grp = (): number => {
    let tot = 0;
    while (i < f.length && f[i] !== ")") {
      let sub = 0;
      if (f[i] === "(") { i++; sub = grp(); i++; }
      else { const m = f.slice(i).match(/^[A-Z][a-z]?/); if (!m) throw new Error("bad formula " + f); if (!(m[0] in AR)) throw new Error("no Ar for " + m[0]); sub = AR[m[0]]; i += m[0].length; }
      const n = f.slice(i).match(/^\d+/); if (n) { sub *= Number(n[0]); i += n[0].length; }
      tot += sub;
    }
    return tot;
  };
  return grp();
}
