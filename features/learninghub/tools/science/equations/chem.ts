// Equation balancer logic (plan S-05). Pure: no React, no DOM.

export type Counts = Record<string, number>;
export interface Equation { left: string[]; right: string[] }

const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** Strip state symbols such as (aq) and tidy whitespace. */
function clean(f: string): string {
  return f.replace(/\s+/g, "").replace(/\((s|l|g|aq)\)$/i, "");
}

/** Count atoms in one formula; supports nested brackets and hydrates (CuSO4.5H2O). Throws on bad input. */
export function parseFormula(input: string): Counts {
  const src = clean(input);
  if (!src) throw new Error("Empty formula");
  const total: Counts = {};
  src.split(/[.·•*]/).forEach((part, idx) => {
    let mult = 1, body = part;
    const m = /^(\d+)(.*)$/.exec(part);
    if (idx > 0 && m) { mult = Number(m[1]); body = m[2]!; }
    if (!body) throw new Error("Empty hydrate part");
    const c = parseGroup(body);
    for (const [el, n] of Object.entries(c)) total[el] = (total[el] ?? 0) + n * mult;
  });
  return total;
}

function parseGroup(s: string): Counts {
  const stack: Counts[] = [{}];
  const closers: string[] = [];
  let i = 0;
  const num = (): number => {
    let j = i;
    while (j < s.length && s[j]! >= "0" && s[j]! <= "9") j++;
    if (j === i) return 1;
    const n = Number(s.slice(i, j)); i = j; return n;
  };
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "(" || ch === "[") { closers.push(ch === "(" ? ")" : "]"); stack.push({}); i++; }
    else if (ch === ")" || ch === "]") {
      if (closers.pop() !== ch) throw new Error("Unbalanced brackets");
      i++;
      const n = num(), inner = stack.pop()!, top = stack[stack.length - 1]!;
      for (const [el, k] of Object.entries(inner)) top[el] = (top[el] ?? 0) + k * n;
    } else if (ch >= "A" && ch <= "Z") {
      let el = ch; i++;
      while (i < s.length && s[i]! >= "a" && s[i]! <= "z") { el += s[i]; i++; }
      const n = num(), top = stack[stack.length - 1]!;
      top[el] = (top[el] ?? 0) + n;
    } else throw new Error(`Unexpected "${ch}"`);
  }
  if (closers.length) throw new Error("Unbalanced brackets");
  return stack[0]!;
}

/** Parse "CH4 + O2 -> CO2 + H2O" (also → or =). */
export function parseEquation(s: string): Equation {
  const sides = s.split(/->|→|=>|⟶|=/);
  if (sides.length !== 2) throw new Error("Need exactly one arrow");
  const side = (t: string) => t.split("+").map((x) => x.trim()).filter(Boolean);
  const left = side(sides[0]!), right = side(sides[1]!);
  if (!left.length || !right.length) throw new Error("Both sides need a substance");
  for (const f of [...left, ...right]) parseFormula(f);
  return { left, right };
}

const eqOf = (e: Equation | string): Equation => (typeof e === "string" ? parseEquation(e) : e);

export function equationString(eq: Equation, coeffs?: number[]): string {
  const all = [...eq.left, ...eq.right];
  const t = (f: string, i: number) => `${coeffs && coeffs[i]! > 1 ? coeffs[i] : ""}${f}`;
  const l = eq.left.map((f, i) => t(f, i)).join(" + ");
  const r = eq.right.map((f, i) => t(f, eq.left.length + i)).join(" + ");
  void all;
  return `${l} -> ${r}`;
}

/** Atom totals for each side given coefficients (missing/negative treated as 0). */
export function atomTotals(e: Equation | string, coeffs: number[]): { left: Counts; right: Counts } {
  const eq = eqOf(e);
  const sum = (fs: string[], off: number): Counts => {
    const out: Counts = {};
    fs.forEach((f, i) => {
      const k = Math.max(0, coeffs[off + i] ?? 0);
      for (const [el, n] of Object.entries(parseFormula(f))) out[el] = (out[el] ?? 0) + n * k;
    });
    return out;
  };
  return { left: sum(eq.left, 0), right: sum(eq.right, eq.left.length) };
}

/** Elements (sorted) whose counts differ between sides. */
export function unbalancedElements(e: Equation | string, coeffs: number[]): string[] {
  const { left, right } = atomTotals(e, coeffs);
  const els = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...els].filter((el) => (left[el] ?? 0) !== (right[el] ?? 0)).sort();
}

/** Balanced means every coefficient is a positive integer and all atoms match. */
export function isBalanced(e: Equation | string, coeffs: number[]): boolean {
  const eq = eqOf(e);
  if (coeffs.length !== eq.left.length + eq.right.length) return false;
  if (!coeffs.every((c) => Number.isInteger(c) && c > 0)) return false;
  return unbalancedElements(eq, coeffs).length === 0;
}

const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/** Smallest positive integer coefficients, or null when there is no unique solution. */
export function solveBalance(e: Equation | string): number[] | null {
  const eq = eqOf(e);
  const species = [...eq.left, ...eq.right], n = species.length;
  const counts = species.map(parseFormula);
  const els = [...new Set(counts.flatMap((c) => Object.keys(c)))];
  // Integer matrix rows = elements, columns = species (right side negated).
  const M: number[][] = els.map((el) => counts.map((c, j) => (c[el] ?? 0) * (j < eq.left.length ? 1 : -1)));
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < M.length; c++) {
    let p = -1;
    for (let i = r; i < M.length; i++) if (M[i]![c] !== 0) { p = i; break; }
    if (p < 0) continue;
    [M[r], M[p]] = [M[p]!, M[r]!];
    for (let i = 0; i < M.length; i++) {
      if (i === r || M[i]![c] === 0) continue;
      const a = M[r]![c]!, b = M[i]![c]!;
      M[i] = M[i]!.map((v, k) => v * a - M[r]![k]! * b);
      const g = M[i]!.reduce((x, y) => gcd(x, y), 0);
      if (g > 1) M[i] = M[i]!.map((v) => v / g);
    }
    pivotCol.push(c); r++;
  }
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !pivotCol.includes(i));
  if (free.length !== 1) return null;
  const f = free[0]!;
  // x_f = L; each pivot row: a*x_p + b*x_f = 0 => x_p = -b/a * x_f
  const num: number[] = new Array(n).fill(0), den: number[] = new Array(n).fill(1);
  num[f] = 1;
  pivotCol.forEach((pc, row) => {
    const a = M[row]![pc]!, b = M[row]![f]!;
    const s = a < 0 ? -1 : 1;
    num[pc] = -b * s; den[pc] = Math.abs(a);
  });
  let L = 1;
  for (const d of den) L = (L * d) / gcd(L, d);
  const out = num.map((v, i) => (v * L) / den[i]!);
  const g = out.reduce((x, y) => gcd(x, y), 0);
  const res = out.map((v) => v / g);
  return res.every((v) => Number.isInteger(v) && v > 0) ? res : null;
}

/** Display formula with real subscripts: Ca(OH)2 -> Ca(OH)₂, CuSO4.5H2O -> CuSO₄·5H₂O. */
export function formatFormula(input: string): string {
  const s = clean(input).replace(/[.*•]/g, "·");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!, prev = out.slice(-1);
    if (ch >= "0" && ch <= "9" && /[A-Za-z)\]₀-₉]/.test(prev)) out += SUB[Number(ch)];
    else out += ch;
  }
  return out;
}

export interface EquationCheck { ok: boolean; unbalanced: string[]; message: string }
const ELEMENT_NAMES: Record<string, string> = { H: "Hydrogen", O: "Oxygen", C: "Carbon", N: "Nitrogen", Na: "Sodium", K: "Potassium", Ca: "Calcium", Mg: "Magnesium", Al: "Aluminium", Fe: "Iron", Cu: "Copper", Zn: "Zinc", Cl: "Chlorine", S: "Sulfur", Pb: "Lead", Ag: "Silver", Ba: "Barium", Li: "Lithium", Br: "Bromine", I: "Iodine", Mn: "Manganese", P: "Phosphorus", Si: "Silicon", F: "Fluorine" };
export const elementName = (el: string): string => ELEMENT_NAMES[el] ?? el;

/** Pure checker (reusable for server marking). Never reveals numbers. */
export function equationChecker(e: Equation | string, coeffs: number[]): EquationCheck {
  const eq = eqOf(e);
  if (coeffs.length !== eq.left.length + eq.right.length || !coeffs.every((c) => Number.isInteger(c) && c >= 1))
    return { ok: false, unbalanced: [], message: "Every substance needs a whole-number coefficient of 1 or more." };
  const bad = unbalancedElements(eq, coeffs);
  if (bad.length) return { ok: false, unbalanced: bad, message: `${elementName(bad[0]!)} isn't balanced yet.` };
  const sol = solveBalance(eq);
  if (sol && sol.some((v, i) => v !== coeffs[i])) return { ok: false, unbalanced: [], message: "The atoms match, but can you use smaller whole numbers?" };
  return { ok: true, unbalanced: [], message: "Balanced. Every atom is accounted for." };
}
