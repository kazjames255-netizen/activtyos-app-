// A tiny, SAFE expression evaluator for the function plotter (no eval / Function):
// numbers, x, + - * / ^, unary minus, parentheses, implicit multiplication (2x, 3(x+1), x(x-2)),
// constants pi/e and one-argument functions. Pure — self-tested.

export type Fn = (x: number) => number;
const FUNCS: Record<string, (n: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const CONST: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: "n"; v: number } | { t: "x" } | { t: "op"; v: string } | { t: "(" } | { t: ")" } | { t: "f"; v: string };

function tokenize(src: string): Tok[] | null {
  const s = src.toLowerCase().replace(/\s+/g, "").replace(/^y=|^f\(x\)=/, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/[0-9.]/.test(ch)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j]!)) j++; const v = Number(s.slice(i, j)); if (!Number.isFinite(v)) return null; out.push({ t: "n", v }); i = j; }
    else if (/[a-z]/.test(ch)) {
      let j = i; while (j < s.length && /[a-z]/.test(s[j]!)) j++;
      const w = s.slice(i, j);
      if (w === "x") out.push({ t: "x" });
      else if (w in FUNCS) out.push({ t: "f", v: w });
      else if (w in CONST) out.push({ t: "n", v: CONST[w]! });
      else if (/^[xe]+$/.test(w) || w.split("").every((c) => c === "x")) { for (const c of w) out.push(c === "x" ? { t: "x" } : { t: "n", v: Math.E }); }
      else return null;
      i = j;
    }
    else if ("+-*/^".includes(ch)) { out.push({ t: "op", v: ch }); i++; }
    else if (ch === "(") { out.push({ t: "(" }); i++; }
    else if (ch === ")") { out.push({ t: ")" }); i++; }
    else return null;
  }
  // implicit multiplication: 2x, 2(x), )(, )x, x(, x x, 2sin(x)
  const res: Tok[] = [];
  for (let k = 0; k < out.length; k++) {
    const a = out[k - 1], b = out[k]!;
    if (a && (a.t === "n" || a.t === "x" || a.t === ")") && (b.t === "n" || b.t === "x" || b.t === "(" || b.t === "f")) res.push({ t: "op", v: "*" });
    res.push(b);
  }
  return res;
}

/** Compile to a function of x, or null if it isn't a valid expression. */
export function compile(src: string): Fn | null {
  const toks = tokenize(src);
  if (!toks || !toks.length) return null;
  let pos = 0;
  type Node = (x: number) => number;
  const peek = () => toks[pos];
  const parseExpr = (): Node | null => {
    let l = parseTerm(); if (!l) return null;
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "+" || (peek() as { v: string }).v === "-")) {
      const op = (toks[pos++] as { v: string }).v; const r = parseTerm(); if (!r) return null;
      const a: Node = l; l = op === "+" ? (x: number) => a(x) + r(x) : (x: number) => a(x) - r(x);
    }
    return l;
  };
  const parseTerm = (): Node | null => {
    let l = parseUnary(); if (!l) return null;
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "*" || (peek() as { v: string }).v === "/")) {
      const op = (toks[pos++] as { v: string }).v; const r = parseUnary(); if (!r) return null;
      const a: Node = l; l = op === "*" ? (x: number) => a(x) * r(x) : (x: number) => a(x) / r(x);
    }
    return l;
  };
  const parseUnary = (): Node | null => {
    const p = peek();
    if (p?.t === "op" && (p.v === "-" || p.v === "+")) { pos++; const r = parseUnary(); if (!r) return null; return p.v === "-" ? (x) => -r(x) : r; }
    return parsePow();
  };
  const parsePow = (): Node | null => {
    const base = parseAtom(); if (!base) return null;
    if (peek()?.t === "op" && (peek() as { v: string }).v === "^") { pos++; const e = parseUnary(); if (!e) return null; return (x) => Math.pow(base(x), e(x)); }
    return base;
  };
  const parseAtom = (): Node | null => {
    const p = toks[pos++];
    if (!p) return null;
    if (p.t === "n") { const v = p.v; return () => v; }
    if (p.t === "x") return (x) => x;
    if (p.t === "(") { const e = parseExpr(); if (!e || toks[pos++]?.t !== ")") return null; return e; }
    if (p.t === "f") { const fn = FUNCS[p.v]!; if (toks[pos]?.t !== "(") return null; const arg = parseAtom(); if (!arg) return null; return (x) => fn(arg(x)); }
    return null;
  };
  const node = parseExpr();
  if (!node || pos !== toks.length) return null;
  return node;
}

/** Sample f over [x0, x1] into polyline segments, breaking at jumps/non-finite values (asymptotes). */
export function sample(f: Fn, x0: number, x1: number, y0: number, y1: number, n = 500): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  let prev = NaN;
  const span = y1 - y0;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = f(x);
    const ok = Number.isFinite(y) && Math.abs(y - (y0 + y1) / 2) < span * 20;
    if (!ok || (Number.isFinite(prev) && Math.abs(y - prev) > span * 1.5)) { if (cur.length > 1) out.push(cur); cur = []; }
    if (ok) cur.push({ x, y });
    prev = ok ? y : NaN;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
