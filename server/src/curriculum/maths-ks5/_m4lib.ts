// Shared verification toolkit for the maths-ks5 pack (agent M4). No external packages.
//  - parse(): a small expression parser for the unicode maths used in option texts / answers
//    ("3x² + 4", "2√3", "e^(2x)", "sin(2x)", "(x−1)(x+2)", "|x−1|", "ln x", "3/4", "π/6" ...).
//  - numeric tools: derivative, integral, roots, binomial / normal distributions, rationals, vectors.
//  - check harness: recompute each keyed answer independently and make sure EXACTLY ONE option is right.
// Leading underscore: skipped by validate.ts.
import type { CQuestion, CTopic } from "../types";

// ───────────────────────── expression parser ─────────────────────────
export type Env = Record<string, number>;
export type Fn = (e: Env) => number;
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: (v) => 1 / Math.cos(v), cosec: (v) => 1 / Math.sin(v), csc: (v) => 1 / Math.sin(v), cot: (v) => 1 / Math.tan(v),
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, lg: Math.log10, log: Math.log10, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
};
const FNAMES = Object.keys(FUNCS).sort((a, b) => b.length - a.length);
type Tok = { t: "num" | "id" | "op" | "sup" | "end"; v: string };

function tokenise(src: string): Tok[] {
  const s = src.replace(/−|–|—/g, "-").replace(/×|·|⋅/g, "*").replace(/÷/g, "/").replace(/½/g, "(1/2)").replace(/¼/g, "(1/4)").replace(/¾/g, "(3/4)").replace(/⅓/g, "(1/3)").replace(/⅔/g, "(2/3)").replace(/\s+/g, " ").trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: "num", v: s.slice(i, j) }); i = j; continue; }
    if (c in SUP) { let j = i, str = ""; while (j < s.length && s[j] in SUP) { str += SUP[s[j]]; j++; } out.push({ t: "sup", v: str }); i = j; continue; }
    if (c === "π") { out.push({ t: "id", v: "π" }); i++; continue; }
    if (/\p{L}/u.test(c)) {
      const rest = s.slice(i);
      const f = FNAMES.find((n) => rest.startsWith(n));
      if (f) { out.push({ t: "id", v: f }); i += f.length; continue; }
      out.push({ t: "id", v: c }); i++; continue;
    }
    if ("+-*/^()|,=".includes(c) || c === "√") { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`parse: unexpected character "${c}" in "${src}"`);
  }
  out.push({ t: "end", v: "" });
  return out;
}

export function parse(src: string): Fn {
  const toks = tokenise(src);
  let p = 0;
  let absDepth = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek().t === "op" && peek().v === v;
  const atomStart = () => {
    const k = peek();
    if (k.t === "num" || k.t === "id") return true;
    if (k.t === "op" && (k.v === "(" || k.v === "√")) return true;
    if (k.t === "op" && k.v === "|" && absDepth === 0) return true;
    return false;
  };
  function expr(): Fn {
    let l = term();
    while (isOp("+") || isOp("-")) { const op = toks[p++].v; const r = term(); const a = l; l = op === "+" ? (e) => a(e) + r(e) : (e) => a(e) - r(e); }
    return l;
  }
  function term(): Fn {
    let l = unary();
    for (;;) {
      if (isOp("*")) { p++; const r = unary(); const a = l; l = (e) => a(e) * r(e); }
      else if (isOp("/")) { p++; const r = unary(); const a = l; l = (e) => a(e) / r(e); }
      else if (atomStart()) { const r = unary(); const a = l; l = (e) => a(e) * r(e); } // implicit multiplication
      else break;
    }
    return l;
  }
  function unary(): Fn {
    if (isOp("-")) { p++; const a = unary(); return (e) => -a(e); }
    if (isOp("+")) { p++; return unary(); }
    return power();
  }
  function power(): Fn {
    const base = postfix();
    if (isOp("^")) {
      p++;
      let neg = false;
      if (isOp("-")) { p++; neg = true; } else if (isOp("+")) p++;
      const ex = expAtom();
      return (e) => Math.pow(base(e), neg ? -ex(e) : ex(e));
    }
    return base;
  }
  function expAtom(): Fn {
    const k = peek();
    if (k.t === "num") { p++; const v = Number(k.v); return () => v; }
    if (k.t === "id") { p++; return idVal(k.v); }
    if (isOp("(")) { p++; const x = expr(); if (!isOp(")")) throw new Error("parse: missing )"); p++; return x; }
    throw new Error(`parse: bad exponent in "${src}"`);
  }
  function idVal(name: string): Fn {
    if (name === "π") return () => Math.PI;
    if (name === "e") return () => Math.E;
    return (env) => { if (!(name in env)) throw new Error(`parse: variable ${name} undefined in "${src}"`); return env[name]; };
  }
  function postfix(): Fn {
    const a = atom();
    if (peek().t === "sup") { const n = Number(toks[p++].v); return (e) => Math.pow(a(e), n); }
    return a;
  }
  function funcArg(): Fn {
    // f(...) | f|...| | f <number>? <var|const>? [sup or ^power]
    if (isOp("(")) { p++; const x = expr(); if (!isOp(")")) throw new Error("parse: missing )"); p++; return x; }
    if (isOp("|")) return atom();
    let coef: Fn = () => 1;
    let have = false;
    if (peek().t === "num") { const v = Number(toks[p++].v); coef = () => v; have = true; }
    if (peek().t === "id" && !FNAMES.includes(peek().v)) { const iv = idVal(toks[p++].v); let val: Fn = iv; if (peek().t === "sup") { const n = Number(toks[p++].v); const b = iv; val = (e) => Math.pow(b(e), n); } else if (isOp("^")) { p++; let neg = false; if (isOp("-")) { p++; neg = true; } const ex = expAtom(); const b = iv; val = (e) => Math.pow(b(e), neg ? -ex(e) : ex(e)); } const c = coef; return (e) => c(e) * val(e); }
    if (have) { const c = coef; return (e) => c(e); }
    throw new Error(`parse: function argument missing in "${src}"`);
  }
  function atom(): Fn {
    const k = peek();
    if (k.t === "num") { p++; const v = Number(k.v); if (Number.isNaN(v)) throw new Error(`parse: bad number ${k.v}`); return () => v; }
    if (k.t === "id") {
      p++;
      if (FNAMES.includes(k.v)) {
        let pw = 1;
        if (peek().t === "sup") pw = Number(toks[p++].v);
        const a = funcArg();
        const f = FUNCS[k.v];
        return (e) => Math.pow(f(a(e)), pw);
      }
      return idVal(k.v);
    }
    if (k.t === "op") {
      if (k.v === "(") { p++; const x = expr(); if (!isOp(")")) throw new Error(`parse: missing ) in "${src}"`); p++; return x; }
      if (k.v === "√") { p++; let a: Fn; if (isOp("(")) { p++; a = expr(); if (!isOp(")")) throw new Error("parse: missing )"); p++; } else if (peek().t === "num") { const v = Number(toks[p++].v); a = () => v; } else if (peek().t === "id") { a = idVal(toks[p++].v); } else throw new Error(`parse: bad √ in "${src}"`); const b = a; return (e) => Math.sqrt(b(e)); }
      if (k.v === "|") { p++; absDepth++; const x = expr(); absDepth--; if (!isOp("|")) throw new Error(`parse: missing | in "${src}"`); p++; return (e) => Math.abs(x(e)); }
    }
    throw new Error(`parse: unexpected "${k.v}" in "${src}"`);
  }
  const r = expr();
  if (peek().t !== "end") throw new Error(`parse: trailing "${peek().v}" in "${src}"`);
  return r;
}

// sample environments
export const SAMPLES: Env[] = [0.37, 0.81, 1.3, 1.9, 2.4, 3.1, 4.3].map((x, i) => ({ x, y: 1.1 + 0.53 * i, t: 0.4 + 0.7 * i, θ: 0.3 + 0.21 * i, n: 2 + i, k: 1.5 + i * 0.5, a: 0.9 + 0.4 * i, b: 1.7 + 0.3 * i, u: 1 + 0.6 * i, v: 2 + 0.9 * i, s: 3 + i, m: 1.2 + 0.7 * i, r: 0.8 + 0.6 * i, c: 2.2 + 0.3 * i, p: 0.25 + 0.05 * i, q: 0.15 + 0.07 * i, h: 1 + 0.2 * i, A: 0.5 + 0.3 * i, B: 1.9 - 0.2 * i, λ: 0.7 + 0.3 * i, μ: 1 + 0.4 * i, α: 0.3 + 0.1 * i, β: 0.6 + 0.1 * i }));
/** Do two expression texts / functions agree on the sample environments? */
export function sameFn(a: Fn, b: Fn, tol = 1e-7): boolean {
  let n = 0;
  for (const env of SAMPLES) {
    let x: number, y: number;
    try { x = a(env); y = b(env); } catch { continue; }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    n++;
    if (Math.abs(x - y) > tol * Math.max(1, Math.abs(x), Math.abs(y))) return false;
  }
  return n >= 3;
}
export const val = (s: string): number => parse(s)({});

// ───────────────────────── numerics ─────────────────────────
export const D = (f: (x: number) => number, x: number, h = 1e-3): number => {
  const d = (h: number) => (f(x + h) - f(x - h)) / (2 * h);
  const a = d(h), b = d(h / 2), c = d(h / 4);
  const r1 = (4 * b - a) / 3, r2 = (4 * c - b) / 3;
  return (16 * r2 - r1) / 15;
};
const GL_X = [0.1488743389816312, 0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717];
const GL_W = [0.2955242247147529, 0.2692667193099963, 0.2190863625159820, 0.1494513491505806, 0.0666713443086881];
export const I = (f: (x: number) => number, a: number, b: number, n = 64): number => {
  let sum = 0; const w = (b - a) / n;
  for (let k = 0; k < n; k++) { const m = a + (k + 0.5) * w, hh = w / 2; for (let j = 0; j < 5; j++) sum += GL_W[j] * hh * (f(m - hh * GL_X[j]) + f(m + hh * GL_X[j])); }
  return sum;
};
export const root = (f: (x: number) => number, a: number, b: number): number => {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) throw new Error(`root: no sign change on [${a}, ${b}]`);
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } }
  void fb; return (a + b) / 2;
};
/** All roots of f in [a,b] found by scanning for sign changes. */
export const roots = (f: (x: number) => number, a: number, b: number, n = 4000): number[] => {
  const out: number[] = []; let px = a, pf = f(a);
  for (let i = 1; i <= n; i++) { const x = a + ((b - a) * i) / n, fx = f(x); if (pf === 0) out.push(px); else if (pf * fx < 0) out.push(root(f, px, x)); px = x; pf = fx; }
  return out;
};
export const round = (v: number, dp: number) => Math.round(v * 10 ** dp + Number.EPSILON * Math.sign(v)) / 10 ** dp;
export const sf = (v: number, n: number) => (v === 0 ? 0 : Number(v.toPrecision(n)));
export const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
export const nCr = (n: number, r: number): number => { if (r < 0 || r > n) return 0; let x = 1; for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i; return Math.round(x); };
export const binPmf = (n: number, p: number, k: number) => nCr(n, k) * p ** k * (1 - p) ** (n - k);
export const binCdf = (n: number, p: number, k: number) => { let s = 0; for (let i = 0; i <= k; i++) s += binPmf(n, p, i); return s; };
export function erf(x: number): number { // Abramowitz-Stegun 7.1.26 is too coarse; use series/continued fraction
  const ax = Math.abs(x);
  let r: number;
  if (ax < 3) { let sum = ax, term = ax; for (let n = 1; n < 200; n++) { term *= (-ax * ax) / n; sum += term / (2 * n + 1); } r = (2 / Math.sqrt(Math.PI)) * sum; }
  else { let f = 0; for (let k = 60; k >= 1; k--) f = k / 2 / (ax + f); r = 1 - Math.exp(-ax * ax) / Math.sqrt(Math.PI) / (ax + f); }
  return x < 0 ? -r : r;
}
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export const normCdf = (x: number, mu = 0, sd = 1) => Phi((x - mu) / sd);
export const normPdf = (x: number, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
export const normInv = (p: number, mu = 0, sd = 1) => mu + sd * root((z) => Phi(z) - p, -10, 10);
export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
export const sxx = (a: number[]) => a.reduce((s, v) => s + v * v, 0) - a.length * mean(a) ** 2;
export const sd = (a: number[]) => Math.sqrt(sxx(a) / a.length); // population
export const sdS = (a: number[]) => Math.sqrt(sxx(a) / (a.length - 1)); // sample
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function regress(xs: number[], ys: number[]) { const mx = mean(xs), my = mean(ys); const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0); const sxxv = sxx(xs), syy = sxx(ys); const b = sxy / sxxv; return { b, a: my - b * mx, r: sxy / Math.sqrt(sxxv * syy) }; }

// vectors
export type V3 = number[];
export const vadd = (a: V3, b: V3) => a.map((x, i) => x + b[i]);
export const vsub = (a: V3, b: V3) => a.map((x, i) => x - b[i]);
export const vscale = (a: V3, k: number) => a.map((x) => x * k);
export const dot = (a: V3, b: V3) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3) => Math.sqrt(dot(a, a));
export const angleDeg = (a: V3, b: V3) => (Math.acos(dot(a, b) / (norm(a) * norm(b))) * 180) / Math.PI;
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

// exact rationals
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export type Q = { n: number; d: number };
export const Q = (n: number, d = 1): Q => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
export const qadd = (a: Q, b: Q) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qsub = (a: Q, b: Q) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qmul = (a: Q, b: Q) => Q(a.n * b.n, a.d * b.d);
export const qdiv = (a: Q, b: Q) => Q(a.n * b.d, a.d * b.n);
export const qnum = (a: Q) => a.n / a.d;
export const qstr = (a: Q) => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);

// SUVAT: pass exactly three of {s,u,v,a,t}; returns all five (constant acceleration, one dimension)
export function suvat(k: Partial<Record<"s" | "u" | "v" | "a" | "t", number>>): Record<"s" | "u" | "v" | "a" | "t", number> {
  let { s, u, v, a, t } = k;
  const has = (x: number | undefined): x is number => x !== undefined;
  for (let i = 0; i < 4; i++) {
    if (!has(v) && has(u) && has(a) && has(t)) v = u + a * t;
    if (!has(u) && has(v) && has(a) && has(t)) u = v - a * t;
    if (!has(a) && has(u) && has(v) && has(t)) a = (v - u) / t;
    if (!has(t) && has(u) && has(v) && has(a) && a !== 0) t = (v - u) / a;
    if (!has(s) && has(u) && has(t) && has(a)) s = u * t + 0.5 * a * t * t;
    if (!has(s) && has(u) && has(v) && has(t)) s = ((u + v) / 2) * t;
    if (!has(v) && has(u) && has(a) && has(s)) v = Math.sqrt(u * u + 2 * a * s); // positive root: caller checks direction
    if (!has(a) && has(u) && has(v) && has(s) && s !== 0) a = (v * v - u * u) / (2 * s);
    if (!has(u) && has(v) && has(a) && has(s)) u = Math.sqrt(v * v - 2 * a * s);
    if (!has(u) && has(s) && has(t) && has(v)) u = (2 * s) / t - v;
    if (!has(v) && has(s) && has(t) && has(u)) v = (2 * s) / t - u;
    if (!has(a) && has(s) && has(u) && has(t)) a = (2 * (s - u * t)) / (t * t);
    if (!has(u) && has(s) && has(a) && has(t)) u = (s - 0.5 * a * t * t) / t;
    if (!has(t) && has(s) && has(u) && has(a)) { const disc = u * u + 2 * a * s; if (disc >= 0 && a !== 0) t = (-u + Math.sqrt(disc)) / a; }
  }
  return { s: s!, u: u!, v: v!, a: a!, t: t! };
}

// ───────────────────────── check harness ─────────────────────────
export type Spec =
  | { k: "num"; v: number; tol?: number }        // number answer, or single/short whose options parse to numbers
  | { k: "fn"; f: Fn; tol?: number }                            // option/answer texts are expressions equal (as functions) to f
  | { k: "opt"; pred: (o: string, i: number) => boolean }   // exactly one option satisfies pred; it must be the keyed one
  | { k: "set"; pred: (o: string, i: number) => boolean }   // multi: the set of options satisfying pred == keyed set
  | { k: "str"; v: string | string[] }            // short: answer or accepted contains each of these (normalised)
  | { k: "written"; note: string };               // tutor-marked (mark scheme verified by hand; note says how)
export const N = (v: number, tol?: number): Spec => ({ k: "num", v, tol });
export const F = (f: (x: number) => number, tol?: number): Spec => ({ k: "fn", f: (e) => f(e.x), tol });
export const FE = (f: Fn, tol?: number): Spec => ({ k: "fn", f, tol });
export const P = (pred: (o: string, i: number) => boolean): Spec => ({ k: "opt", pred });
export const SET = (pred: (o: string, i: number) => boolean): Spec => ({ k: "set", pred });
export const STR = (v: string | string[]): Spec => ({ k: "str", v });
export const W = (note: string): Spec => ({ k: "written", note });

const ntext = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/** Strip a leading "y =", "dy/dx =", "f(x) =", "x =" and trailing units so an option parses as a bare expression. */
export const bare = (s: string) => s.replace(/^\s*(?:[a-zA-Zθ]+(?:\([a-z]\))?'?\s*(?:\/d[a-z])?\s*=\s*)/, "").replace(/\s*(?:cm²|cm³|cm|m²|m³|m\/s²|m\/s|ms⁻¹|ms⁻²|m s⁻¹|m s⁻²|N|kg|s|°|%|J|W|units²|units|£)\s*$/i, "").replace(/^£/, "").replace(/,(?=\d{3}\b)/g, "");
const plain = (s: string) => bare(s).replace(/\s/g, "");

export interface Report { failures: string[]; checked: number; byKind: Record<string, number> }
export function checkTopics(topics: CTopic[], table: Record<string, (q: CQuestion) => Spec>): Report {
  const failures: string[] = []; let checked = 0; const byKind: Record<string, number> = {};
  const seenKeys = new Set<string>();
  for (const t of topics) for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) {
    seenKeys.add(q.key);
    const fn = table[q.key];
    if (!fn) { failures.push(`${q.key}: NO CHECK DEFINED`); continue; }
    try {
      const spec = fn(q); checked++; byKind[spec.k] = (byKind[spec.k] ?? 0) + 1;
      failures.push(...verify(q, spec).map((m) => `${q.key}: ${m}`));
    } catch (e) { failures.push(`${q.key}: checker threw — ${(e as Error).message}`); }
  }
  for (const k of Object.keys(table)) if (!seenKeys.has(k)) failures.push(`${k}: check defined but no such question`);
  return { failures, checked, byKind };
}

const numMatch = (o: string, v: number, tol: number) => { try { const x = val(bare(o)); return Math.abs(x - v) <= tol + 1e-9 * Math.max(1, Math.abs(v)); } catch { return false; } };
function verify(q: CQuestion, s: Spec): string[] {
  const bad: string[] = [];
  const opts = q.options ?? [];
  if (s.k === "written") { if (q.kind !== "written") bad.push("spec says written but kind isn't"); return bad; }
  if (q.kind === "written") return ["kind written but a computed spec was supplied"];
  if (s.k === "num") {
    const tol = s.tol ?? 0;
    if (q.kind === "number") {
      if (typeof q.answer !== "number") return ["number answer missing"];
      if (Math.abs(q.answer - s.v) > Math.max(tol, 1e-9)) bad.push(`keyed ${q.answer} but computed ${s.v} (tol ${tol})`);
      // tolerance must be small relative to the answer's stated precision
      if (q.tolerance !== undefined && q.tolerance < tol - 1e-12) bad.push(`tolerance ${q.tolerance} smaller than rounding ${tol}`);
    } else if (q.kind === "single") {
      const hit = opts.filter((o) => numMatch(o, s.v, tol));
      if (hit.length !== 1) bad.push(`${hit.length} options equal ${s.v}: ${JSON.stringify(hit)}`);
      else if (hit[0] !== q.answer) bad.push(`keyed "${q.answer}" but the option equal to ${s.v} is "${hit[0]}"`);
    } else if (q.kind === "short") {
      const all = [String(q.answer), ...(q.accepted ?? [])];
      for (const a of all) if (!numMatch(a, s.v, tol)) bad.push(`short form "${a}" != ${s.v}`);
    } else bad.push(`num spec on kind ${q.kind}`);
    return bad;
  }
  if (s.k === "fn") {
    const eq = (txt: string) => { try { return sameFn(parse(bare(txt)), s.f, s.tol); } catch (e) { bad.push(`unparseable "${txt}": ${(e as Error).message}`); return false; } };
    if (q.kind === "single") {
      const hit = opts.filter(eq);
      if (hit.length !== 1) bad.push(`${hit.length} options match the computed expression: ${JSON.stringify(hit)}`);
      else if (hit[0] !== q.answer) bad.push(`keyed "${q.answer}" but the matching option is "${hit[0]}"`);
    } else if (q.kind === "short") {
      for (const a of [String(q.answer), ...(q.accepted ?? [])]) if (!eq(a)) bad.push(`short form "${a}" differs from computed`);
    } else bad.push(`fn spec on kind ${q.kind}`);
    return bad;
  }
  if (s.k === "opt") {
    if (q.kind !== "single") return [`opt spec on kind ${q.kind}`];
    const hit = opts.filter((o, i) => s.pred(o, i));
    if (hit.length !== 1) bad.push(`${hit.length} options satisfy the predicate: ${JSON.stringify(hit)}`);
    else if (hit[0] !== q.answer) bad.push(`keyed "${q.answer}" but predicate selects "${hit[0]}"`);
    return bad;
  }
  if (s.k === "set") {
    if (q.kind !== "multi") return [`set spec on kind ${q.kind}`];
    const want = opts.filter((o, i) => s.pred(o, i)).sort(); const got = [...(q.answer as string[])].sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) bad.push(`keyed ${JSON.stringify(got)} but computed ${JSON.stringify(want)}`);
    return bad;
  }
  if (s.k === "str") {
    if (q.kind !== "short") return [`str spec on kind ${q.kind}`];
    const all = [String(q.answer), ...(q.accepted ?? [])].map(ntext);
    for (const w of Array.isArray(s.v) ? s.v : [s.v]) if (!all.includes(ntext(w))) bad.push(`expected "${w}" among accepted answers`);
    return bad;
  }
  return bad;
}
export { plain };

/** Standard footer: print the report, exit 1 on failure. */
export function finish(name: string, r: Report) {
  console.log(`${name}: ${r.checked} questions verified — ${Object.entries(r.byKind).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  if (r.failures.length) { for (const f of r.failures) console.error("FAIL " + f); console.error(`${r.failures.length} failure(s)`); process.exitCode = 1; } else console.log("OK — no failures");
}
/** Generate the space-variants a typed short answer might have: "(2, 3)" / "(2,3)". */
export const spaced = (s: string) => Array.from(new Set([s, s.replace(/, /g, ","), s.replace(/,(?! )/g, ", "), s.replace(/ /g, "")]));
