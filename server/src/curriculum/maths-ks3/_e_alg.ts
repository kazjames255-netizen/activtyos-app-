// Independent expectations for alg.ts (Years 7–9). See _check_m2.ts.
import { D } from "./_m2data";
import { R, V, S, val, toFn, algEq, only, setOf, opts, nums, type EMap } from "./_m2lib";

/** Solve a linear equation lhs = rhs in one variable by evaluating both sides (linear => two points fix it). */
const solve = (lhs: string, rhs: string, v = "x") => {
  const f = toFn(lhs, [v]), g = toFn(rhs, [v]);
  const h = (x: number) => f(x) - g(x);
  const x = -h(0) / (h(1) - h(0));
  if (Math.abs(h(x)) > 1e-9) throw new Error(`not linear: ${lhs} = ${rhs}`);
  return x;
};
const at = (e: string, x: number, v = "x") => toFn(e, [v])(x);
/** integer pairs (x, y) in [-30, 30] satisfying both equations a1x + b1y = c1 and a2x + b2y = c2 */
const pairs = (e1: [number, number, number], e2: [number, number, number]) => { const out: [number, number][] = []; for (let x = -30; x <= 30; x++) for (let y = -30; y <= 30; y++) if (e1[0] * x + e1[1] * y === e1[2] && e2[0] * x + e2[1] * y === e2[2]) out.push([x, y]); if (out.length !== 1) throw new Error("expected 1 solution"); return out[0]; };

export const E: EMap = {
  // ---- Y7
  "alg-y7-01": (q) => only(q, (o) => algEq(o.replace(/^(\d*)a$/, "$1*a").replace(/a²/, "a**2"), "3*a+4*a", ["a"])),
  "alg-y7-02": () => V(at("3x + 2", 4)), "alg-y7-03": () => V(solve("x + 9", "15")),
  "alg-y7-04": (q) => only(q, (o) => algEq(o, "5x + 3y − 2x + y", ["x", "y"])),
  "alg-y7-05": () => V(solve("4x − 7", "21")),
  "alg-y7-06": (q) => only(q, (o) => algEq(o.replace(/^(\d) \+ p \+ (\d) \+ r$/, "$1 + p + $2 + r"), "3p + 2r", ["p", "r"])),
  "alg-y7-07": (q) => setOf(q, (o) => algEq(o, "3x + 5x − 2x")),
  "alg-y7-08": () => V(solve("3n + 2", "20", "n")),
  "alg-y7-09": () => V(solve("x + (x + 10) + (x + 20)", "180")),
  "alg-y7-10": () => V(at("x² + 3", -2)),
  // ---- Y8
  "alg-y8-01": (q) => only(q, (o) => algEq(o, "3(x + 4)")),
  "alg-y8-02": () => { const t = (n: number) => 3 * n + 1; if ([1, 2, 3, 4].map(t).join() !== "4,7,10,13") throw new Error("seq"); return V(t(10)); },
  "alg-y8-03": (q) => only(q, (o) => algEq(o, "6x + 9") && /^3\(/.test(o)),
  "alg-y8-04": () => V(solve("5x + 3", "2x + 18")),
  "alg-y8-05": (q) => only(q, (o) => [5, 9, 13, 17].every((t, i) => at(o, i + 1, "n") === t)),
  "alg-y8-06": (q) => only(q, (o) => algEq(o, "2(x + 5) + 3(x − 1)")),
  "alg-y8-07": () => V(5 + 3 * 4), "alg-y8-08": () => V(solve("3(2x − 1)", "21")),
  "alg-y8-09": (q) => only(q, (o) => [20, 17, 14, 11].every((t, i) => at(o, i + 1, "n") === t)),
  "alg-y8-10": (q) => setOf(q, (o) => { for (let n = 1; n <= 100; n++) if (3 * n + 2 === nums(o)) return true; return false; }),
  // ---- Y9
  "alg-y9-01": () => V(D.line.m),
  "alg-y9-02": () => V(at("3x + 5", 0)),
  "alg-y9-03": (q) => only(q, (o) => o === `x < ${solve("2x + 3", "11")}`),
  "alg-y9-04": () => V(pairs([1, 1, 10], [1, -1, 4])[0]),
  "alg-y9-05": (q) => only(q, (o) => algEq(o, "(x + 4)(x + 3)")),
  "alg-y9-06": (q) => only(q, (o) => algEq(o, "x² + 5x + 6")),
  "alg-y9-07": (q) => setOf(q, (o) => nums(o) > -2 && nums(o) <= 3),
  "alg-y9-08": (q) => { const m = (10 - 2) / 4; return only(q, (o) => algEq(o.replace(/^y = /, ""), `${m}x + 2`)); },
  "alg-y9-09": () => { const [x, y] = pairs([3, 2, 19], [1, 2, 9]); return V(x + y); },
};
void R; void S; void val; void opts;
