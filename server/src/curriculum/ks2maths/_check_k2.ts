// Independent answer-key checker for md.ts and frac.ts (agent K2). Recomputes each answer from the question's
// own numbers using exact rational arithmetic, then asserts (a) the keyed answer equals the computed one and
// (b) for single/multi questions, NO other option is numerically equal (so exactly one right option exists).
// Run: cd server && npx tsx src/curriculum/ks2maths/_check_k2.ts   (leading underscore: validate.ts skips it)
import { TOPIC as MD } from "./md";
import { TOPIC as FRAC } from "./frac";
import type { CQuestion } from "../types";

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
type R = { n: number; d: number };
const R = (n: number, d = 1): R => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
const add = (a: R, b: R) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: R, b: R) => R(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: R, b: R) => R(a.n * b.n, a.d * b.d);
const div = (a: R, b: R) => R(a.n * b.d, a.d * b.n);
const eq = (a: R, b: R) => a.n === b.n && a.d === b.d;
const num = (r: R) => r.n / r.d;
const simp = (n: number, d: number) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
const mixed = (r: R) => { const w = Math.floor(r.n / r.d); const rem = r.n - w * r.d; return rem === 0 ? `${w}` : w === 0 ? `${rem}/${r.d}` : `${w} ${rem}/${r.d}`; };
const dec = (s: string): R => { const [i, f = ""] = s.split("."); return R(parseInt(i + f, 10), 10 ** f.length); };

/** Parse an option/answer text into an exact rational, or null if it isn't a plain quantity. */
function val(s0: string | number): R | null {
  let s = String(s0).trim().replace(/,/g, "").replace(/^£/, "").replace(/(p| litres|C)$/, "");
  let pct = false;
  if (s.endsWith("%")) { pct = true; s = s.slice(0, -1); }
  let r: R | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) r = add(R(+m[1]), R(+m[2], +m[3]));
  else if ((m = s.match(/^(\d+)\/(\d+)$/))) r = R(+m[1], +m[2]);
  else if (/^\d*\.?\d+$/.test(s)) r = s.includes(".") ? dec(s) : R(+s);
  if (!r) return null;
  return pct ? div(r, R(100)) : r;
}
const ev = (e: string) => Function(`return (${e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")})`)() as number;
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));
const factors = (n: number) => { const f: number[] = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; };

type Exp = { v: R } | { s: string } | { set: string[] };
const V = (n: number | R): Exp => ({ v: typeof n === "number" ? R(n) : n });
const S = (s: string): Exp => ({ s });
const opts = (q: CQuestion) => q.options ?? [];
const only = (q: CQuestion, pred: (o: string) => boolean): Exp => {
  const hit = opts(q).filter(pred);
  if (hit.length !== 1) throw new Error(`${q.key}: expected exactly one matching option, got ${hit.length}`);
  return S(hit[0]);
};
const setOf = (q: CQuestion, pred: (o: string) => boolean): Exp => ({ set: opts(q).filter(pred) });
const nums = (o: string) => Number(o.replace(/,/g, ""));

const E: Record<string, (q: CQuestion) => Exp> = {
  // ---- md Y3
  "md-y3-01": () => V(4 * 7), "md-y3-02": () => V(24 / 3), "md-y3-03": () => V(8 * 6), "md-y3-04": () => V(23 * 4),
  "md-y3-05": () => V(7 * 8), "md-y3-06": (q) => setOf(q, (o) => nums(o) % 4 === 0), "md-y3-07": () => V(4 * 8),
  "md-y3-08": () => V(27 / 3), "md-y3-09": () => V(3 * 4), "md-y3-10": () => V(34 * 6),
  // ---- md Y4
  "md-y4-01": () => V(9 * 12), "md-y4-02": () => V(63 / 9), "md-y4-03": () => V(12 * 12), "md-y4-04": () => V(245 * 3),
  "md-y4-05": () => S(factors(12).join(", ")), "md-y4-06": () => V(24 * 6),
  "md-y4-07": (q) => setOf(q, (o) => (/^\d+ [×+] \d+$/.test(o) || /[−×+]/.test(o)) && ev(o) === 54),
  "md-y4-08": () => V((7 * 14 - 7 * 10) / 7), "md-y4-09": () => V(125 * 8), "md-y4-10": () => V(7 * 12 - 19),
  // ---- md Y5
  "md-y5-01": () => V(4500 / 100), "md-y5-02": (q) => only(q, (o) => isSquare(nums(o))), "md-y5-03": () => V(dec("0.6").n * 100 / dec("0.6").d),
  "md-y5-04": (q) => only(q, (o) => isPrime(nums(o))), "md-y5-05": () => V(34 * 26), "md-y5-06": () => V(1284 / 6),
  "md-y5-07": (q) => setOf(q, (o) => 12 % nums(o) === 0 && 18 % nums(o) === 0), "md-y5-08": () => V(5 ** 3),
  "md-y5-09": () => V(45 * 128), "md-y5-10": () => S(`${Math.floor(196 / 8)} full bags, ${196 % 8} left over`),
  // ---- md Y6
  "md-y6-01": () => V(ev("3+4*2")), "md-y6-02": (q) => only(q, (o) => !isPrime(nums(o))), "md-y6-03": () => V(12 * 15),
  "md-y6-04": () => V(ev("20-(3+2)*3")), "md-y6-05": () => V(236 * 34), "md-y6-06": () => V(972 / 12),
  "md-y6-07": (q) => setOf(q, (o) => nums(o) % 4 === 0 && nums(o) % 6 === 0), "md-y6-08": () => V(gcd(24, 36)),
  "md-y6-09": () => V(Math.ceil(200 / 15)), "md-y6-10": () => V(ev("4**2+(18/3)*2-5")),
  // ---- frac Y3
  "frac-y3-01": () => V(R(4, 10)), "frac-y3-02": () => V(20 / 4), "frac-y3-03": (q) => only(q, (o) => eq(val(o)!, R(1, 2))),
  "frac-y3-04": () => V(add(R(3, 8), R(2, 8))), "frac-y3-05": () => V(mul(R(3, 5), R(30))), "frac-y3-06": () => V(7 - 3),
  "frac-y3-07": (q) => setOf(q, (o) => eq(val(o)!, R(1, 2))), "frac-y3-08": () => V(10),
  "frac-y3-09": () => V(sub(R(1), R(3 + 2, 8))), "frac-y3-10": () => V(sub(R(24), mul(R(3, 8), R(24)))),
  // ---- frac Y4
  "frac-y4-01": () => V(R(1, 2)), "frac-y4-02": () => V(R(36, 10)), "frac-y4-03": () => V(100 / 10),
  "frac-y4-04": (q) => only(q, (o) => eq(val(o)!, R(2, 3))), "frac-y4-05": () => V(dec("6.5")), // round 6.47 -> 1dp: 65/10
  "frac-y4-06": (q) => { const best = opts(q).reduce((a, b) => (num(val(b)!) > num(val(a)!) ? b : a)); return S(best); },
  "frac-y4-07": (q) => setOf(q, (o) => eq(val(o)!, R(3, 4))), "frac-y4-08": () => S(simp(25, 100)),
  "frac-y4-09": () => V(sub(R(60), mul(R(3, 5), R(60)))),
  "frac-y4-10": (q) => { if (!(0.3 > 0.25)) throw new Error("arith"); return only(q, (o) => o.startsWith("Ella is wrong: 0.3 is 30 hundredths")); },
  // ---- frac Y5
  "frac-y5-01": () => V(R(1, 2)), "frac-y5-02": () => S("3 hundredths"), "frac-y5-03": () => V(mul(R(4, 5), R(100))),
  "frac-y5-04": () => S(mixed(R(17, 5))), "frac-y5-05": () => S(mixed(add(R(3, 4), R(5, 8)))),
  "frac-y5-06": (q) => { const items = ["1/2", "5/8", "3/4"]; const sorted = [...items].sort((a, b) => num(val(a)!) - num(val(b)!)).join(", "); return S(sorted); },
  "frac-y5-07": (q) => setOf(q, (o) => eq(val(o)!, R(2, 5))), "frac-y5-08": () => V(add(R(6, 10), R(2, 1000))),
  "frac-y5-09": () => V(mul(add(R(2), R(1, 3)), R(3))), "frac-y5-10": () => S(`${mixed(mul(R(3, 4), R(5)))} litres`), "frac-y5-11": () => V(dec("0.054")),
  // ---- frac Y6
  "frac-y6-01": () => S(simp(...((r) => [r.n, r.d] as [number, number])(add(R(2, 3), R(1, 6))))),
  "frac-y6-02": () => S(simp(...((r) => [r.n, r.d] as [number, number])(div(R(1, 4), R(2))))),
  "frac-y6-03": () => V(dec("0.375")), "frac-y6-04": () => S(simp(75, 100)), "frac-y6-05": () => S(simp(8, 12)),
  "frac-y6-06": () => V(mul(R(3, 10), R(100))), "frac-y6-07": () => S(simp(...((r) => [r.n, r.d] as [number, number])(mul(R(2, 3), R(3, 5))))),
  "frac-y6-08": (q) => setOf(q, (o) => eq(val(o)!, R(3, 5))),
  "frac-y6-09": () => S(simp(...((r) => [r.n, r.d] as [number, number])(sub(R(3, 4), R(1, 6))))), "frac-y6-10": () => V(R(5, 8)), "frac-y6-11": () => S(mixed(add(R(3, 2), R(11, 4)))),
};

let errors = 0, checked = 0;
const bad = (m: string) => { console.error("FAIL " + m); errors++; };

for (const T of [MD, FRAC]) {
  for (const y of Object.values(T.years)) {
    if (!y) continue;
    if (y.quiz.questions.length < 10 || y.quiz.questions.length > 12) bad(`${T.key} Y${y.year}: ${y.quiz.questions.length} questions`);
    const positions = new Set<number>();
    for (const q of y.quiz.questions) {
      const f = E[q.key];
      if (!f) { bad(`${q.key}: no expectation defined`); continue; }
      checked++;
      let exp: Exp;
      try { exp = f(q); } catch (e) { bad(String(e)); continue; }
      if (q.kind === "single") positions.add(opts(q).indexOf(String(q.answer)));
      if ("set" in exp) {
        const got = [...(q.answer as string[])].sort().join("|"), want = [...exp.set].sort().join("|");
        if (got !== want) bad(`${q.key}: multi answer [${got}] != computed [${want}]`);
        continue;
      }
      if ("s" in exp) {
        if (q.answer !== exp.s) bad(`${q.key}: answer "${q.answer}" != computed "${exp.s}"`);
        // for numeric options also ensure uniqueness of the right value
        const rv = val(exp.s);
        if (rv && q.kind === "single") { const dup = opts(q).filter((o) => { const v = val(o); if (!v || !eq(v, rv)) return false; const fm = o.match(/^(\d+)\/(\d+)$/); return !(fm && gcd(+fm[1], +fm[2]) > 1 && o !== exp.s); }); /* unsimplified equal fractions are deliberate "not simplest form" distractors */ if (dup.length !== 1) bad(`${q.key}: ${dup.length} options equal the right value`); }
        continue;
      }
      const a = val(q.answer as string | number);
      if (!a) { bad(`${q.key}: cannot parse answer "${q.answer}"`); continue; }
      if (!eq(a, exp.v)) bad(`${q.key}: answer "${q.answer}" (${num(a)}) != computed ${num(exp.v)}`);
      if (q.kind === "single") {
        const dup = opts(q).filter((o) => { const v = val(o); return v && eq(v, exp.v); });
        if (dup.length !== 1) bad(`${q.key}: ${dup.length} options equal the computed value ${num(exp.v)}`);
      }
      if (q.kind === "number" && (q.tolerance ?? 0) !== 0) bad(`${q.key}: unexpected tolerance`);
    }
    console.log(`${T.key} Y${y.year}: ${y.quiz.questions.length} q, answer positions used [${[...positions].sort().join(",")}], diag ${y.quiz.questions.filter((q) => q.diagnostic).length}, diff ${[1, 2, 3].map((d) => y.quiz.questions.filter((q) => q.difficulty === d).length).join("/")}, notes words ${y.note.body.split(/\s+/).length}, cards ${y.flashcards.length}`);
  }
}

// Spec section 3 verbatim samples (frac Y6)
const y6 = FRAC.years[6]!.quiz.questions;
const spec = [
  ["Work out 2/3 + 1/6. Give your answer in its simplest form.", ["3/9", "5/6", "3/6", "1/2"], "5/6", "Convert 2/3 to 4/6, then 4/6 + 1/6 = 5/6, already in simplest form."],
  ["What is 1/4 divided by 2?", ["1/2", "1/6", "1/8", "2/4"], "1/8", "Dividing a fraction by a whole number multiplies the denominator: 1/4 divided by 2 = 1/8."],
  ["Which decimal is equivalent to 3/8?", ["0.38", "0.375", "0.3", "0.83"], "0.375", "3 divided by 8 = 0.375."],
] as const;
for (const [p, o, a, x] of spec) {
  const q = y6.find((z) => z.prompt === p);
  if (!q || JSON.stringify(q.options) !== JSON.stringify(o) || q.answer !== a || q.explanation !== x) bad(`spec sample missing/altered: ${p}`);
}

// Flashcards: mechanical spot-checks of arithmetic facts stated as "a × b" / "a ÷ b" on the front.
for (const T of [MD]) for (const y of Object.values(T.years)) for (const c of y!.flashcards) {
  const m = c.front.match(/^(\d+) ([×÷]) (\d+)$/);
  if (m) { const want = m[2] === "×" ? +m[1] * +m[3] : +m[1] / +m[3]; if (String(want) !== c.back.trim()) bad(`flashcard "${c.front}" back "${c.back}" != ${want}`); }
}
// Fact tables on cards / notes
const primesTo50 = [23, 29, 31, 37, 41, 43, 47];
if (JSON.stringify(Array.from({ length: 29 }, (_, i) => i + 21).filter(isPrime)) !== JSON.stringify(primesTo50)) bad("primes 20-50");
if (![1, 8, 27, 64, 125, 216, 343, 512, 729, 1000].every((n, i) => n === (i + 1) ** 3)) bad("cubes");
if (0.375 !== 3 / 8 || 0.125 !== 1 / 8) bad("decimal facts");

console.log(`\nchecked ${checked} questions, ${errors} failure(s)`);
process.exit(errors ? 1 : 0);
