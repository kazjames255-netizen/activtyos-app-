// Independent answer-key checker for the maths-ks4 pack (agent M3). Every key is RECOMPUTED here from the question's own
// numbers (or from the same data that draws the pictures: _m3data.ts). For single-choice items it also proves that exactly ONE
// option satisfies the computed condition. Run: cd server && npx tsx src/curriculum/maths-ks4/_check_m3.ts
import { TOPIC as NUM } from "./num";
import { TOPIC as ALG } from "./alg";
import { TOPIC as RP } from "./rp";
import { TOPIC as GEO } from "./geo";
import { TOPIC as PROB } from "./prob";
import { TOPIC as STATS } from "./stats";
import { TRIG, CIRC, COS, LINE, QUAD, VENN10, TREE, VENN11, SCATTER, HIST, BOX, CF } from "./_m3data";
import type { CQuestion } from "../types";

let errors = 0, checked = 0;
const bad = (m: string) => { errors++; console.error("FAIL " + m); };
const assert = (c: boolean, m: string) => { if (!c) throw new Error(m); };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const rd = (x: number, dp: number) => Math.round(x * 10 ** dp + 1e-9 * Math.sign(x)) / 10 ** dp;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d)), cos = (d: number) => Math.cos(rad(d)), tan = (d: number) => Math.tan(rad(d));
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const unsup = (s: string) => s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""));
const opts = (q: CQuestion) => q.options ?? [];
const pick = (q: CQuestion, pred: (o: string) => boolean): string => {
  const hit = opts(q).filter(pred);
  assert(hit.length === 1, `${q.key}: ${hit.length} options satisfy the computed condition (${hit.join(" | ")})`);
  return hit[0];
};
/** number from "12", "0.62", "5/14", "4 1/10" */
const pn = (s: string): number => {
  const t = s.trim().replace(/−/g, "-").replace(/,/g, "");
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(-?\d+) (\d+)\/(\d+)$/))) return +m[1] + +m[2] / +m[3];
  if ((m = t.match(/^(-?\d+)\/(\d+)$/))) return +m[1] / +m[2];
  const v = Number(t); assert(Number.isFinite(v), `cannot parse "${s}"`); return v;
};
const byNum = (q: CQuestion, v: number, e = 1e-9) => pick(q, (o) => { try { return near(pn(o), v, e); } catch { return false; } });
/** algebra expression -> function (implicit multiplication, unicode maths) */
const ex = (s: string, vars: string[] = ["x"]): ((...a: number[]) => number) => {
  let e = s.replace(/^[a-z] = /, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/½/g, "(1/2)").replace(/²/g, "**2").replace(/³/g, "**3");
  e = e.replace(/(\d)([a-z(])/g, "$1*$2").replace(/\)([a-z(\d])/g, ")*$1").replace(/([a-z])\(/g, "$1*(");
  return Function(...vars, `return (${e})`) as (...a: number[]) => number;
};
const XS = [2.3, 3.7, 5.1, -1.7, 7.9];
const sameFn = (o: string, f: (x: number) => number) => { try { const g = ex(o); return XS.every((x) => near(g(x), f(x), 1e-7)); } catch { return false; } };
/** surd expression a√b ... -> number */
const evs = (o: string) => Function(`return (${o.replace(/−/g, "-").replace(/×/g, "*").replace(/(\d)√/g, "$1*√").replace(/√(\d+)/g, "Math.sqrt($1)").replace(/\)(\d)/g, ")*$1")})`)() as number;
const roots = (a: number, b: number, c: number) => { const d = b * b - 4 * a * c; return [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)]; };
const nums = (o: string) => (o.replace(/−/g, "-").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const pairs = (o: string) => [...o.replace(/−/g, "-").matchAll(/\((-?[\d.]+), (-?[\d.]+)\)/g)].map((m) => [+m[1], +m[2]] as [number, number]);
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const cfAt = (x: number) => { const i = CF.findIndex((p) => p[0] === x); assert(i >= 0, "cf point"); return CF[i][1]; };
const xAtCf = (y: number) => { const i = CF.findIndex((p) => p[1] === y); assert(i >= 0, `cf ${y} is not a plotted point`); return CF[i][0]; };
const combos = <T,>(a: T[], k: number): T[][] => (k === 0 ? [[]] : a.flatMap((v, i) => combos(a.slice(i + 1), k - 1).map((r) => [v, ...r])));

type Exp = number | string;
const E: Record<string, (q: CQuestion) => Exp> = {
  // ───────────── NUM Y10
  "num-y10-01": (q) => pick(q, (o) => { const t = o.split(" × "); return t.every((x) => /^\d+[²³]?$/.test(x) && isPrime(parseInt(x, 10))) && t.reduce((p, x) => p * parseInt(x, 10) ** (x.endsWith("²") ? 2 : x.endsWith("³") ? 3 : 1), 1) === 84; }),
  "num-y10-02": () => gcd(36, 60),
  "num-y10-03": () => lcm(12, 18),
  "num-y10-04": (q) => byNum(q, 2 + 3 / 5 + 1 + 1 / 2),
  "num-y10-05": (q) => pick(q, (o) => { const [a, p] = unsup(o).split(" × 10^").map(Number); return near(a * 10 ** p, 0.00045, 1e-12) && a >= 1 && a < 10; }),
  "num-y10-06": () => 5 + 3 - 4,
  "num-y10-07": () => { const r1 = (x: number) => Number(x.toPrecision(1)); return (r1(4.87) * r1(19.6)) / r1(0.52); },
  "num-y10-08": (q) => { const want = (0.03047).toPrecision(2); return pick(q, (o) => o === want); },
  "num-y10-09": () => rd(3.2e5 * 2.5e-2, 6),
  "num-y10-10": (q) => byNum(q, 3 / 4 / (2 / 3), 1e-12),
  "num-y10-11": () => 16 ** (-3 / 4),
  "num-y10-12": () => Math.round(Math.log10((6e9 / 1.5e-3) / 4)),
  "num-y10-13": () => { const n = 2 ** 3 * 3 ** 2 * 5; let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return c; },
  // ───────────── NUM Y11
  "num-y11-01": (q) => pick(q, (o) => near(evs(o), Math.sqrt(50), 1e-9) && /^\d+√(2|3|5|6|7|10)$/.test(o)),
  "num-y11-02": (q) => pick(q, (o) => { const m = o.match(/^√(\d+)$/); return !!m && !Number.isInteger(Math.sqrt(+m[1])); }),
  "num-y11-03": () => rd(Math.sqrt(12) * Math.sqrt(3), 9),
  "num-y11-04": () => rd((3 + Math.SQRT2) * (3 - Math.SQRT2), 9),
  "num-y11-05": () => { const x = 27 / 99; let dec = 0; for (let i = 1; i <= 30; i++) dec += (i % 2 ? 2 : 7) / 10 ** i; assert(near(3 / 11, dec, 1e-12) && gcd(3, 11) === 1 && near(x, 3 / 11), "0.2727.. = 3/11"); return 3 / 11; },
  "num-y11-06": (q) => pick(q, (o) => near(evs(o), 6 / Math.sqrt(3), 1e-9) && /^\d√\d$/.test(o)),
  "num-y11-07": (q) => { const lo = 12.35, hi = 12.45; assert(near(lo, 12.4 - 0.05) && near(hi, 12.4 + 0.05), "bounds"); return pick(q, (o) => o === `${lo} ≤ L < ${hi}`); },
  "num-y11-08": () => 8.5 * 5.5,
  "num-y11-09": () => rd((2 * Math.sqrt(3)) ** 2, 9),
  "num-y11-10": (q) => pick(q, (o) => near(evs(o), Math.sqrt(18) + Math.sqrt(50) - Math.sqrt(8), 1e-9)),
  "num-y11-11": (q) => pick(q, (o) => near(evs(o), 1 / (2 - Math.sqrt(3)), 1e-9)),
  "num-y11-12": () => rd(115 / 15.5, 2),
  "num-y11-13": () => { const a = 3 + Math.sqrt(5), b = 3 - Math.sqrt(5); assert(near(a * b, 4, 1e-9) && near(2 * (a + b), 12, 1e-9), "area 4, perimeter 12"); return "ok"; },
  // ───────────── ALG Y10
  "alg-y10-01": () => (25 - 7) / 3,
  "alg-y10-02": (q) => pick(q, (o) => sameFn(o, (x) => 3 * (x - 4))),
  "alg-y10-03": () => { [5, 8, 11, 14].forEach((v, i) => assert(3 * (i + 1) + 2 === v, "seq")); return 3 * 20 + 2; },
  "alg-y10-04": (q) => pick(q, (o) => sameFn(o, (x) => (x + 3) * (x + 5))),
  "alg-y10-05": (q) => pick(q, (o) => sameFn(o, (x) => x * x + 7 * x + 12)),
  "alg-y10-06": () => { const x = (16 + 5) / (10 - 3); assert(near(5 * (2 * x - 1), 3 * x + 16), "sub"); return x; },
  "alg-y10-07": (q) => pick(q, (o) => { const m = o.match(/^x (>|<) ([\d.]+)$/)!; const k = +m[2]; return Array.from({ length: 81 }, (_, i) => -10 + i * 0.5).every((x) => (m[1] === ">" ? x > k : x < k) === (4 * x - 3 > 13)); }),
  "alg-y10-08": (q) => pick(q, (o) => sameFn(o, (x) => LINE.m * x + LINE.c)),
  "alg-y10-09": (q) => { const f = (v: number, u: number, a: number) => (v - u) / a; return pick(q, (o) => { try { const g = ex(o, ["v", "u", "a"]); return [[10, 4, 2], [7, 1, 3], [20, 5, 4]].every(([v, u, a]) => near(g(v, u, a), f(v, u, a), 1e-9)); } catch { return false; } }); },
  "alg-y10-10": () => { const x = (-3 - 20) / (5 - 6); assert(near((x + 4) / 3, (2 * x - 1) / 5), "sub"); return x; },
  "alg-y10-11": (q) => pick(q, (o) => { const g = ex(o); return near(g(2), 4, 1e-9) && near(g(1) - g(0), 3, 1e-9); }),
  "alg-y10-12": () => { for (let n = 1; n < 100; n++) if (23 - 3 * n < 0) return n; throw new Error("none"); },
  "alg-y10-13": () => { for (const x of [-3, 0, 2, 5.5]) { assert(near((x + 3) ** 2, x * x + 6 * x + 9), "expand"); assert(!near((x + 3) ** 2, x * x + 9) || x === 0, "wrong claim"); } return "ok"; },
  // ───────────── ALG Y11
  "alg-y11-01": (q) => { const r = roots(1, -5, 6); return pick(q, (o) => { const n = nums(o); return n.length === 2 && near(Math.min(...n), r[0], 1e-9) && near(Math.max(...n), r[1], 1e-9); }); },
  "alg-y11-02": () => 3 * 4 - 2,
  "alg-y11-03": () => { const det = 2 * -1 - 1 * 1; const x = (10 * -1 - 1 * 2) / det, y = (2 * 2 - 1 * 10) / det; assert(near(2 * x + y, 10) && near(x - y, 2), "sub"); return x; },
  "alg-y11-04": (q) => { const r = roots(1, 2, -15); return pick(q, (o) => { const n = nums(o); return near(Math.min(...n), r[0]) && near(Math.max(...n), r[1]) && n.length === 2; }); },
  "alg-y11-05": (q) => { const r = roots(1, -3, -5).map((v) => rd(v, 2)); return pick(q, (o) => { const n = nums(o); return n.length === 2 && near(Math.min(...n), r[0]) && near(Math.max(...n), r[1]); }); },
  "alg-y11-06": (q) => pick(q, (o) => { const g = ex(o); return [2.5, 4, 6.5, -5.5].every((x) => near(g(x), (x * x - 9) / (x * x + 3 * x), 1e-9)); }),
  "alg-y11-07": (q) => pick(q, (o) => sameFn(o, (x) => x * x + 6 * x + 1)),
  "alg-y11-08": (q) => pick(q, (o) => sameFn(o, (x) => 2 * (x * x) + 1)),
  "alg-y11-09": () => { const f = (x: number) => (x + 5) / 3; assert(near(f(7), 4), "f(7)=4"); return 7; },
  "alg-y11-10": (q) => { const sol = roots(2, 2, -24).map((x) => [x, x + 1]); return pick(q, (o) => { const p = pairs(o); return p.length === 2 && p.every(([x, y]) => near(y, x + 1) && near(x * x + y * y, 25)) && sol.every(([x, y]) => p.some(([a, b]) => near(a, x) && near(b, y))); }); },
  "alg-y11-11": () => { const g = (x: number) => 3 - 4 / x; return g(g(4)); },
  "alg-y11-12": (q) => pick(q, (o) => { const g = ex(o); return [3.3, 4.2, 5.7, -4.1].every((x) => near(g(x), 2 / (x + 1) + 3 / (x - 2), 1e-9)); }),
  "alg-y11-13": () => { for (let n = -5; n <= 10; n++) assert((2 * n + 1) ** 2 - (2 * n - 1) ** 2 === 8 * n, "8n"); return "ok"; },
  "alg-y11-14": (q) => { const xv = -QUAD.b / (2 * QUAD.a), yv = QUAD.a * xv * xv + QUAD.b * xv + QUAD.c; const r = roots(QUAD.a, QUAD.b, QUAD.c); assert(near(r[0], -1) && near(r[1], 3), "roots -1, 3"); return pick(q, (o) => { const p = pairs(o); return p.length === 1 && near(p[0][0], xv) && near(p[0][1], yv); }); },
  // ───────────── RP Y10
  "rp-y10-01": (q) => { const g = gcd(24, 36); return pick(q, (o) => o === `${24 / g} : ${36 / g}`); },
  "rp-y10-02": () => (150 / (2 + 3)) * 3,
  "rp-y10-03": () => rd(80 * 1.15, 9),
  "rp-y10-04": () => 156 / (2 + 30 / 60),
  "rp-y10-05": () => 450 / 60,
  "rp-y10-06": () => ((250 - 205) / 250) * 100,
  "rp-y10-07": (q) => { const per = (o: string) => { const m = o.match(/^([\d.]+) (g|kg) for £([\d.]+)$/); if (!m) return Infinity; const kg = m[2] === "g" ? +m[1] / 1000 : +m[1]; return +m[3] / kg; }; const best = Math.min(...opts(q).map(per)); const ties = opts(q).filter((o) => near(per(o), best, 1e-9)); assert(ties.length === 1, "tie"); return ties[0]; },
  "rp-y10-08": () => (24 / 3) * 5,
  "rp-y10-09": () => rd((3.2 / 5) * 8, 9),
  "rp-y10-10": () => rd(68 / 0.8, 9),
  "rp-y10-11": () => { const ann = 2 * 4, ben = 3 * 4, cat = 5 * 3; assert(ben / 3 === 4 && ben / 12 * 12 === 12, "ben"); return (175 / (ann + ben + cat)) * cat; },
  "rp-y10-12": () => ((18 * 1000) / 3600) * 40,
  "rp-y10-13": () => { assert(near(60 * 0.75, 45) && near(75 * (1 - 1 / 3), 50) && near(50 - 45, 5), "shops"); return "ok"; },
  // ───────────── RP Y11
  "rp-y11-01": () => rd(1 + 8 / 100, 9),
  "rp-y11-02": () => rd(1 - 15 / 100, 9),
  "rp-y11-03": () => 20 / 4,
  "rp-y11-04": () => Math.round(2500 * 1.03 ** 4),
  "rp-y11-05": () => Math.round(14000 * 0.88 ** 3),
  "rp-y11-06": () => (6 * 10) / 4,
  "rp-y11-07": (q) => { const k = 50 / 25; return pick(q, (o) => sameFn(o, (x) => k * x * x)); },
  "rp-y11-08": () => rd((1.1 * 0.9 - 1) * 100, 9),
  "rp-y11-09": () => (120 - 30) / (3.5 - 2),
  "rp-y11-10": () => { assert(near(rd(1000 * 1.05 ** 3, 2), 1157.63), "1157.63"); return rd(1157.63 / 1.05 ** 3, 0); },
  "rp-y11-11": () => { const k = 4 * 3 ** 2; return k / 6 ** 2; },
  "rp-y11-12": () => { for (let n = 1; n < 100; n++) if (1000 * 1.06 ** n > 1500) return n; throw new Error("none"); },
  "rp-y11-13": () => {
    assert(near(1200 * 0.85 ** 2, 867, 1e-9), "867");
    let n = 0; while (1200 * 0.85 ** n >= 500) n++;
    assert(n === 6, `first year below 500 is ${n}`);
    const t = RP.years[11]!.quiz.questions.find((z) => z.key === "rp-y11-13")!;
    assert(t.answer.toString().includes(rd(1200 * 0.85 ** 5, 2).toFixed(2)) && t.answer.toString().includes(rd(1200 * 0.85 ** 6, 2).toFixed(2)), "quoted values 532.45 / 452.58");
    return "ok";
  },
  // ───────────── GEO Y10
  "geo-y10-01": () => (6 - 2) * 180,
  "geo-y10-02": () => 360 / 5,
  "geo-y10-03": () => Math.hypot(9, 12),
  "geo-y10-04": () => rd(TRIG.hyp * sin(TRIG.angle), 2),
  "geo-y10-05": () => rd(Math.PI * 49, 1),
  "geo-y10-06": () => rd(Math.PI * 25 * 12, 1),
  "geo-y10-07": () => rd(deg(Math.atan(9 / 14)), 1),
  "geo-y10-08": (q) => pick(q, (o) => { const p = pairs(o); return p.length === 1 && near(p[0][0], 8 * 0.5) && near(p[0][1], -6 * 0.5); }),
  "geo-y10-09": (q) => pick(q, (o) => { const p = pairs(o); return p.length === 1 && near(p[0][0], 2 * 3 - 1) && near(p[0][1], 4); }),
  "geo-y10-10": () => { const h = Math.sqrt(13 ** 2 - 5 ** 2); return 0.5 * 10 * h; },
  "geo-y10-11": () => rd((1 / 3) * Math.PI * 9 * 4, 1),
  "geo-y10-12": () => 360 / (180 - 156),
  "geo-y10-13": () => { assert(20 ** 2 + 21 ** 2 === 29 ** 2 && 0.5 * 20 * 21 === 210, "20-21-29"); return "ok"; },
  // ───────────── GEO Y11
  "geo-y11-01": () => { const t = 1.1, A = [-1, 0], B = [1, 0], C = [Math.cos(t), Math.sin(t)]; const u = [A[0] - C[0], A[1] - C[1]], v = [B[0] - C[0], B[1] - C[1]]; return rd(deg(Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v)))), 6); },
  "geo-y11-02": (q) => pick(q, (o) => { const p = pairs(o); return p.length === 1 && near(p[0][0], 3 + 1) && near(p[0][1], 2 + -4); }),
  "geo-y11-03": () => 6 * 2.5,
  "geo-y11-04": () => { const pt = (d: number) => [Math.cos(rad(d)), Math.sin(rad(d))]; const h = CIRC.centreAngle / 2, A = pt(90 + h), B = pt(90 - h), C = pt(270); const u = [A[0] - C[0], A[1] - C[1]], v = [B[0] - C[0], B[1] - C[1]]; return rd(deg(Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v)))), 6); },
  "geo-y11-05": () => rd(Math.sqrt(COS.p ** 2 + COS.q ** 2 - 2 * COS.p * COS.q * cos(COS.angle)), 2),
  "geo-y11-06": () => { const b = (9 * sin(65)) / sin(40); const C = 180 - 40 - 65; assert(near(9 / sin(40), b / sin(65), 1e-9) && C === 75, "sine rule"); return rd(b, 2); },
  "geo-y11-07": () => rd((60 / 360) * 2 * Math.PI * 6, 2),
  "geo-y11-08": () => rd((45 / 360) * Math.PI * 64, 1),
  "geo-y11-09": () => 0.5 * 10 * 13 * sin(30),
  "geo-y11-10": () => rd(400 * (15 / 10) ** 3, 6),
  "geo-y11-11": () => Math.sqrt(2 ** 2 + 3 ** 2 + 6 ** 2),
  "geo-y11-12": () => rd(deg(Math.atan(5 / Math.hypot(6, 8))), 1),
  "geo-y11-13": () => { const a = [2, 5], b = [7, -1]; const AB = [b[0] - a[0], b[1] - a[1]]; const M = [a[0] + AB[0] / 2, a[1] + AB[1] / 2]; assert(near(M[0], (a[0] + b[0]) / 2) && near(M[1], (a[1] + b[1]) / 2), "OM = (a+b)/2"); return "ok"; },
  "geo-y11-14": () => 5 * 3 ** 2,
  // ───────────── PROB Y10
  "prob-y10-01": (q) => { const n = [1, 2, 3, 4, 5, 6, 7, 8].filter(isPrime).length; return byNum(q, n / 8, 1e-12); },
  "prob-y10-02": () => rd(124 / 200, 9),
  "prob-y10-03": () => rd(0.05 * 400, 9),
  "prob-y10-04": (q) => { const V = VENN10; assert(V.frenchOnly + V.both + V.spanishOnly + V.neither === V.total, "venn total"); return byNum(q, V.both / V.total, 1e-12); },
  "prob-y10-05": () => { const p = TREE.pGreen; let s = 0; for (const a of [1, 0]) for (const b of [1, 0]) if (a + b === 1) s += (a ? p : 1 - p) * (b ? p : 1 - p); return rd(s, 9); },
  "prob-y10-06": (q) => { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a === 6 && b === 6) c++; return byNum(q, c / 36, 1e-12); },
  "prob-y10-07": (q) => { const bag = ["R", "R", "R", "R", "R", "B", "B", "B"]; let c = 0, n = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (i !== j) { n++; if (bag[i] === "R" && bag[j] === "R") c++; } return byNum(q, c / n, 1e-12); },
  "prob-y10-08": (q) => { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if ((a * b) % 2 === 0) c++; return byNum(q, c / 36, 1e-12); },
  "prob-y10-09": () => rd((1 - 0.2 - 0.3) / 2, 9),
  "prob-y10-10": () => 28 + 20 - (50 - 6),
  "prob-y10-11": () => rd((210 / 1000) * 300, 9),
  "prob-y10-12": (q) => { let c = 0; for (let m = 0; m < 8; m++) if (m > 0) c++; return byNum(q, c / 8, 1e-12); },
  "prob-y10-13": (q) => { const bag = [..."RRRRBBBBBB"]; let c = 0, n = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (i !== j) { n++; if (bag[i] !== bag[j]) c++; } return byNum(q, c / n, 1e-12); },
  // ───────────── PROB Y11
  "prob-y11-01": (q) => { const inter = VENN11.U.filter((n) => VENN11.inA(n) && VENN11.inB(n)); assert(inter.join() === "6,12,18", "A∩B"); return pick(q, (o) => o === "Elements in both A and B"); },
  "prob-y11-02": () => rd(0.3 * 0.5, 9),
  "prob-y11-03": () => { const V = VENN11; assert(V.aOnly.length + V.both.length + V.bOnly.length + V.neither.length === 20, "partition"); return V.U.filter((n) => n % 2 !== 0 && n % 3 !== 0).length; },
  "prob-y11-04": (q) => byNum(q, VENN11.U.filter((n) => VENN11.inA(n) || VENN11.inB(n)).length / 20, 1e-12),
  "prob-y11-05": (q) => { const A = VENN11.U.filter(VENN11.inA); return byNum(q, A.filter(VENN11.inB).length / A.length, 1e-12); },
  "prob-y11-06": (q) => { const bag = [..."GGGGGGYYYY"]; let c = 0, n = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (i !== j) { n++; if (bag[i] === "Y" && bag[j] === "Y") c++; } return byNum(q, c / n, 1e-12); },
  "prob-y11-07": () => rd(0.4 * 0.3 + 0.6 * 0.1, 9),
  "prob-y11-08": () => rd(0.5 * 0.4, 9),
  "prob-y11-09": (q) => byNum(q, 12 / (12 + 16), 1e-12),
  "prob-y11-10": () => rd(1 - (5 / 6) ** 3, 3),
  "prob-y11-11": () => rd(0.6 + 0.5 - 0.8, 9),
  "prob-y11-12": (q) => { const bag = [..."MMMMMTTTTTTT"]; const all = combos([...bag.keys()], 3); const c = all.filter((t) => t.every((i) => bag[i] === "M")).length; return byNum(q, c / all.length, 1e-12); },
  "prob-y11-13": () => { const bag = [..."RRRRRRRRBB"]; let c = 0, n = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (i !== j) { n++; if (bag[i] === bag[j]) c++; } assert(58 / 90 === c / n && near(c / n, 29 / 45, 1e-12), "29/45"); return "ok"; },
  // ───────────── STATS Y10
  "stats-y10-01": () => { const a = sorted([7, 3, 9, 4, 12, 5, 8]); return a[(a.length - 1) / 2]; },
  "stats-y10-02": () => mean([12, 15, 9, 20, 14]),
  "stats-y10-03": (q) => { const sun = [2, 3, 5, 6, 8], ice = [20, 26, 41, 50, 71]; const mx = mean(sun), my = mean(ice); const r = sun.reduce((s, x, i) => s + (x - mx) * (ice[i] - my), 0); assert(r > 0, "positive"); return pick(q, (o) => o === "Positive correlation"); },
  "stats-y10-04": () => { const xs = [1, 2, 3, 4, 5], fs = [4, 7, 9, 6, 4]; assert(fs.reduce((a, b) => a + b) === 30, "n=30"); return rd(xs.reduce((s, x, i) => s + x * fs[i], 0) / 30, 2); },
  "stats-y10-05": () => { const mids = [5, 15, 25, 35], fs = [5, 12, 8, 5]; assert(fs.reduce((a, b) => a + b) === 30, "n=30"); return rd(mids.reduce((s, m, i) => s + m * fs[i], 0) / 30, 1); },
  "stats-y10-06": () => (24 / 90) * 360,
  "stats-y10-07": () => { const y = SCATTER.line.m * 7 + SCATTER.line.c; const pt = SCATTER.points.find((p) => p[0] === 7)!; assert(Math.abs(pt[1] - y) > 2, "point at 7 lies outside tolerance of the line reading"); return y; },
  "stats-y10-08": () => (360 / (200 + 240 + 360)) * 80,
  "stats-y10-09": () => 5 * 8 - (5 + 7 + 9 + 10),
  "stats-y10-10": () => (12 * 150 + 18 * 160) / 30,
  "stats-y10-11": (q) => pick(q, (o) => o === "The people surveyed are not representative of the whole town"),
  "stats-y10-12": () => { for (let f = 0; f <= 60; f++) { const n = 5 + f + 7 + 3, s = 5 + 2 * f + 21 + 12; if (Math.abs(s / n - 2.4) < 1e-12) return f; } throw new Error("no f"); },
  "stats-y10-13": () => { assert(11.8 < 12.4 && 3.1 < 6.5, "B lower mean, A smaller range"); return "ok"; },
  // ───────────── STATS Y11
  "stats-y11-01": () => 50 / (30 - 10),
  "stats-y11-02": () => 42 - 18,
  "stats-y11-03": () => 80 / 2,
  "stats-y11-04": () => { const total = HIST.reduce((s, [, , f]) => s + f, 0); assert(total === 100, "n=100"); return HIST.filter(([lo]) => lo >= 30).reduce((s, [, , f]) => s + f, 0); },
  "stats-y11-05": () => BOX.A.q3 - BOX.A.q1,
  "stats-y11-06": (q) => pick(q, (o) => o === (BOX.A.med > BOX.B.med ? "Class A" : BOX.B.med > BOX.A.med ? "Class B" : "They have the same median")),
  "stats-y11-07": () => xAtCf(CF[CF.length - 1][1] / 2),
  "stats-y11-08": () => CF[CF.length - 1][1] - cfAt(190),
  "stats-y11-09": () => rd(3.2 * 5, 9),
  "stats-y11-10": () => rd(HIST.reduce((s, [lo, hi, f]) => { const ov = Math.max(0, Math.min(hi, 30) - Math.max(lo, 15)); return s + (f / (hi - lo)) * ov; }, 0), 9),
  "stats-y11-11": () => { const g = [[0, 10, 4], [10, 30, 12], [30, 60, 4]]; const n = g.reduce((s, x) => s + x[2], 0); return g.reduce((s, [a, b, f]) => s + ((a + b) / 2) * f, 0) / n; },
  "stats-y11-12": () => { const n = CF[CF.length - 1][1]; return xAtCf(0.75 * n) - xAtCf(0.25 * n); },
  "stats-y11-13": () => { assert(BOX.B.med > BOX.A.med && BOX.A.q3 - BOX.A.q1 === 35 && BOX.B.q3 - BOX.B.q1 === 20 && BOX.A.max - BOX.A.min === 70 && BOX.B.max - BOX.B.min === 50, "box facts in the mark scheme"); return "ok"; },
};

// ── run ──────────────────────────────────────────────────────────────────────
const TOPICS = [NUM, ALG, RP, GEO, PROB, STATS];
const numTokens = (s: string) => (s.replace(/,/g, "").match(/\d+(\.\d+)?/g) ?? []);
for (const T of TOPICS) for (const y of Object.values(T.years)) {
  if (!y) continue;
  const positions = new Set<number>();
  const noteNums = new Set(numTokens(y.note.body));
  for (const q of y.quiz.questions) {
    const f = E[q.key];
    if (!f) { bad(`${q.key}: no expectation defined`); continue; }
    checked++;
    let exp: Exp;
    try { exp = f(q); } catch (e) { bad(String(e instanceof Error ? e.message : e)); continue; }
    if (q.kind === "single") positions.add(opts(q).indexOf(String(q.answer)));
    if (q.kind === "number") { if (typeof exp !== "number" || !near(q.answer as number, exp, 1e-9)) bad(`${q.key}: number answer ${q.answer} != computed ${exp}`); }
    else if (q.kind === "short") {
      const ok = (s: string) => { try { return near(pn(s), exp as number, 1e-9); } catch { return false; } };
      if (typeof exp !== "number" || !ok(String(q.answer))) bad(`${q.key}: short answer "${q.answer}" != computed ${exp}`);
      for (const a of q.accepted ?? []) if (/[\d]/.test(a) && !ok(a.replace(/ /g, ""))) bad(`${q.key}: accepted "${a}" != computed ${exp}`);
    } else if (q.kind === "single") { if (q.answer !== exp) bad(`${q.key}: answer "${q.answer}" != computed "${exp}"`); }
    else if (q.kind === "written") { if (exp !== "ok") bad(`${q.key}: written check did not confirm`); }
    // the quiz must not merely repeat the note's worked numbers (diagnostics especially)
    const pn2 = numTokens(q.prompt);
    const big = pn2.filter((n) => Number(n) >= 5 || n.includes("."));
    if (big.length >= 2 && big.every((n) => noteNums.has(n))) console.warn(`WARN ${q.key}: every number in the prompt also appears in the note (${pn2.join(", ")})`);
    if (q.tolerance !== undefined && q.kind === "number") { /* declared tolerance is for rounding/graph reading: fine */ }
  }
  console.log(`${T.key} Y${y.year}: ${y.quiz.questions.length} q, single answer positions [${[...positions].sort().join(",")}], diag ${y.quiz.questions.filter((q) => q.diagnostic).length}, diff ${[1, 2, 3].map((d) => y.quiz.questions.filter((q) => q.difficulty === d).length).join("/")}, written ${y.quiz.questions.filter((q) => q.kind === "written").length}, note words ${y.note.body.trim().split(/\s+/).length}, cards ${y.flashcards.length}, images ${y.quiz.questions.filter((q) => q.image).length}`);
}

// ── facts quoted in notes / flashcards ───────────────────────────────────────
const fact = (c: boolean, m: string) => { if (!c) bad("note fact: " + m); };
fact(near(10 * sin(40), 6.428, 1e-3) && near(deg(Math.atan(5 / 8)), 32.005, 1e-3) && near(Math.PI * 90, 282.74, 5e-3), "geo Y10 note examples");
fact(near(Math.sqrt(49 + 81 - 2 * 7 * 9 * 0.5), 8.185, 1e-3) && near((72 / 360) * Math.PI * 100, 62.83, 5e-3) && Math.sqrt(16 + 16 + 49) === 9, "geo Y11 note examples");
fact(rd(2000 * 1.04 ** 3, 2) === 2249.73, "rp Y11 compound example 2249.73");
fact(near(1.2 * 0.8, 0.96) && near(1.04, 1 + 0.04) && near(0.93, 1 - 0.07), "rp multipliers");
fact(near(27 ** (2 / 3), 9, 1e-9) && near((4e5 * 3e-2 * 1) / 1, 12000) && 2 ** 3 * 2 ** 4 === 2 ** 7 && near(5 ** -2, 1 / 25) && near(64 ** (1 / 3), 4), "num Y10 note");
fact(gcd(60, 84) === 12 && lcm(60, 84) === 420 && near(evs("5√3"), Math.sqrt(75)) && near(evs("2√5"), 10 / Math.sqrt(5)), "num note HCF/LCM/surds");
fact(near((5 + Math.sqrt(3)) * (5 - Math.sqrt(3)), 22) && near(1 / (3 - Math.sqrt(2)), (3 + Math.sqrt(2)) / 7) && near(0.4545454545454545, 5 / 11, 1e-12), "num Y11 note");
fact(near(7.8 - 0.05, 7.75) && near(6 - 0.5, 5.5), "error interval examples");
fact(near((x2 => x2 * x2 + 8 * x2 + 3)(1.7), (1.7 + 4) ** 2 - 13) && near((5.3 * 5.3 - 16) / (5.3 * 5.3 + 4 * 5.3), (5.3 - 4) / 5.3), "alg Y11 note");
{ const r = roots(1, -4, -21); fact(near(r[0], -3) && near(r[1], 7), "x²−4x−21 roots"); const s = roots(2, 4, -16); fact(near(s[0], -4) && near(s[1], 2), "y = x+2 with x²+y²=20 → x = 2 or −4"); }
fact((x => (x + 2) * (x + 7) - (x * x + 9 * x + 14))(3.3) < 1e-9, "alg Y10 note");
fact(near(0.4 * 0.6, 0.24) && near((3 / 10) * (2 / 9), 1 / 15, 1e-12) && near(600 * 0.03, 18) && near(0.7 + 0.35 - 0.15, 0.9), "prob notes");
fact(near((4 / 10) * (3 / 9) * (2 / 8), 1 / 30, 1e-12), "prob Y11 hearts 1/30");
fact(near((1 * 2 + 2 * 5 + 3 * 3) / 10, 2.1) && near((6 * 10 + 4 * 30) / 10, 18) && near((150 / 500) * 50, 15), "stats Y10 note");
fact(near(12 / 4, 3) && near(120 / 2, 60), "stats Y11 note");
fact(near(deg(Math.atan(0.5)), 26.565, 1e-3) && near(0.5 * 10 * 13 * sin(30), 32.5), "misc");

console.log(`\nchecked ${checked} questions, ${errors} failure(s)`);
process.exit(errors ? 1 : 0);
