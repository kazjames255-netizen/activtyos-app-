// Pure scientific-calculator engine (no DOM, no eval). Recursive-descent parser over a small, safe grammar:
//   + − × ÷ ^ ( ) ² ³ %  π  ANS  sin cos tan asin acos atan sqrt cbrt ln log abs  ×10^n  and implicit multiplication (2(3+4), 2π, 3sin30).
// School-calculator rules: −3² = −9 (unary minus binds looser than ^), 2^−3 works, % is "divide by 100", angles are DEGREES unless `deg` is false.

export interface EvalOpts { ans?: number; deg?: boolean }
export class CalcError extends Error {}

type Tok = { t: "num"; v: number } | { t: "op"; v: string } | { t: "fn"; v: string } | { t: "const"; v: "pi" | "ans" };
const FNS = ["asin", "acos", "atan", "sin", "cos", "tan", "sqrt", "cbrt", "ln", "log", "abs"];

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "").replace(/−/g, "-").replace(/×|·|\*/g, "×").replace(/÷|\//g, "÷").replace(/sin⁻¹/g, "asin").replace(/cos⁻¹/g, "acos").replace(/tan⁻¹/g, "atan").replace(/√/g, "sqrt").replace(/∛/g, "cbrt");
  const out: Tok[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new CalcError("Bad number");
      out.push({ t: "num", v: Number(m[0]) }); i += m[0].length; continue;
    }
    if (c === "π") { out.push({ t: "const", v: "pi" }); i++; continue; }
    if (/^ans/i.test(s.slice(i))) { out.push({ t: "const", v: "ans" }); i += 3; continue; }
    const fn = FNS.find((f) => s.startsWith(f, i));
    if (fn) { out.push({ t: "fn", v: fn }); i += fn.length; continue; }
    if (s.startsWith("pi", i)) { out.push({ t: "const", v: "pi" }); i += 2; continue; }
    if ("+-×÷^()%²³".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new CalcError(`Unexpected "${c}"`);
  }
  return out;
}

/** Evaluate an expression string. Throws CalcError on anything malformed / undefined (divide by zero, √ of a negative, tan 90°…). */
export function evaluate(src: string, opts: EvalOpts = {}): number {
  const toks = tokenize(src);
  if (!toks.length) return 0;
  const deg = opts.deg !== false;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = peek(); return !!t && t.t === "op" && t.v === v; };
  const take = () => toks[p++];
  const rad = (x: number) => (deg ? (x * Math.PI) / 180 : x);
  const deg2 = (x: number) => (deg ? (x * 180) / Math.PI : x);

  function expr(): number {
    let v = term();
    for (;;) {
      if (isOp("+")) { take(); v += term(); } else if (isOp("-")) { take(); v -= term(); } else break;
    }
    return v;
  }
  function startsPrimary(): boolean {
    const t = peek();
    return !!t && (t.t === "num" || t.t === "fn" || t.t === "const" || (t.t === "op" && t.v === "("));
  }
  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp("×")) { take(); v *= unary(); }
      else if (isOp("÷")) { take(); const d = unary(); if (d === 0) throw new CalcError("Divide by zero"); v /= d; }
      else if (startsPrimary()) { v *= unary(); } // implicit multiplication: 2(3+4), 2π, 3sin30
      else break;
    }
    return v;
  }
  function unary(): number {
    if (isOp("-")) { take(); return -unary(); }
    if (isOp("+")) { take(); return unary(); }
    return power();
  }
  function power(): number {
    const base = postfix();
    if (isOp("^")) { take(); const e = unary(); const r = Math.pow(base, e); if (!Number.isFinite(r)) throw new CalcError("Maths error"); return r; }
    return base;
  }
  function postfix(): number {
    let v = primary();
    for (;;) {
      if (isOp("²")) { take(); v = v * v; }
      else if (isOp("³")) { take(); v = v * v * v; }
      else if (isOp("%")) { take(); v = v / 100; }
      else break;
    }
    return v;
  }
  function primary(): number {
    const t = take();
    if (!t) throw new CalcError("Incomplete");
    if (t.t === "num") return t.v;
    if (t.t === "const") return t.v === "pi" ? Math.PI : (opts.ans ?? 0);
    if (t.t === "op" && t.v === "(") { const v = expr(); if (!isOp(")")) throw new CalcError("Missing )"); take(); return v; }
    if (t.t === "fn") {
      // sin30 or sin(30): a function takes the next primary (so sin30 works like a real calculator, sin(30+15) too)
      const a = isOp("(") ? primary() : unaryArg();
      switch (t.v) {
        case "sin": return Math.sin(rad(a));
        case "cos": return Math.cos(rad(a));
        case "tan": { const c = Math.cos(rad(a)); if (Math.abs(c) < 1e-12) throw new CalcError("Undefined"); return Math.tan(rad(a)); }
        case "asin": if (a < -1 || a > 1) throw new CalcError("Out of range"); return deg2(Math.asin(a));
        case "acos": if (a < -1 || a > 1) throw new CalcError("Out of range"); return deg2(Math.acos(a));
        case "atan": return deg2(Math.atan(a));
        case "sqrt": if (a < 0) throw new CalcError("Square root of a negative"); return Math.sqrt(a);
        case "cbrt": return Math.cbrt(a);
        case "ln": if (a <= 0) throw new CalcError("Out of range"); return Math.log(a);
        case "log": if (a <= 0) throw new CalcError("Out of range"); return Math.log10(a);
        case "abs": return Math.abs(a);
      }
    }
    throw new CalcError(`Unexpected ${t.v}`);
  }
  function unaryArg(): number { return isOp("-") ? (take(), -unaryArg()) : postfixNumberOnly(); }
  function postfixNumberOnly(): number { return postfix(); }

  const v = expr();
  if (p < toks.length) throw new CalcError("Unexpected " + JSON.stringify((toks[p] as { v: unknown }).v));
  if (!Number.isFinite(v)) throw new CalcError("Maths error");
  // Tidy floating-point noise (sin 30 = 0.49999999999999994 → 0.5) without hiding real digits.
  return Number(v.toPrecision(12));
}

/** Show a result the way a scientific calculator does: up to 10 significant figures, standard form for very large / small values. */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e10 || a < 1e-4) {
    const [m, e] = n.toExponential(9).split("e");
    return `${Number(m).toString()}×10^${Number(e)}`;
  }
  return String(Number(n.toPrecision(10)));
}

/** Decimal → simplest fraction (S⇔D key): continued fractions, denominator ≤ maxDen, or null when there isn't a tidy one. */
export function toFraction(x: number, maxDen = 10000): { n: number; d: number } | null {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1, y = Math.abs(x);
  if (Number.isInteger(y)) return { n: sign * y, d: 1 };
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = y;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    [h1, h0] = [a * h1 + h0, h1];
    [k1, k0] = [a * k1 + k0, k1];
    if (k1 > maxDen) return null;
    if (Math.abs(y - h1 / k1) < 1e-9 * Math.max(1, y)) return { n: sign * h1, d: k1 };
    const f = b - a;
    if (f < 1e-12) break;
    b = 1 / f;
  }
  return null;
}
