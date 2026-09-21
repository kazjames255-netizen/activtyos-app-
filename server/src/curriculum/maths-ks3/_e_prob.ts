// Independent expectations for prob.ts (Years 7–9). Exact rational arithmetic. See _check_m2.ts.
import { D } from "./_m2data";
import { R, V, S, add, sub, mul, only, setOf, opts, nums, isPrime, type EMap } from "./_m2lib";

const die = [1, 2, 3, 4, 5, 6];
const pairs = (a: number[], b: number[]) => a.flatMap((x) => b.map((y) => [x, y] as [number, number]));
const EVENTS: Record<string, (n: number) => boolean> = {
  "Rolling a 2": (n) => n === 2, "rolling a 5": (n) => n === 5, "Rolling an even number": (n) => n % 2 === 0, "rolling a 4": (n) => n === 4,
  "Rolling a 6": (n) => n === 6, "rolling a prime number": (n) => isPrime(n), "Rolling a number less than 3": (n) => n < 3, "rolling an odd number": (n) => n % 2 === 1,
  "Rolling a 1": (n) => n === 1, "rolling an even number": (n) => n % 2 === 0,
};
const exclusive = (o: string) => { const [a, b] = o.split(" and "); const fa = EVENTS[a], fb = EVENTS[b]; if (!fa || !fb) throw new Error("event text: " + o); return !die.some((n) => fa(n) && fb(n)); };

export const E: EMap = {
  // ---- Y7
  "prob-y7-01": () => { const p = die.filter((x) => x === 7).length / 6; if (p !== 0) throw new Error("not impossible"); return S("Impossible"); },
  "prob-y7-02": () => V(R(["H", "T"].filter((x) => x === "H").length, 2)),
  "prob-y7-03": (q) => only(q, (o) => { const v = nums(o.includes("/") ? String(eval(o)) : o); return v > 1 || v < 0; }),
  "prob-y7-04": () => V(R(D.spin.sections.filter((c) => c === "blue").length, D.spin.sections.length)),
  "prob-y7-05": () => V(1 - 0.35), "prob-y7-06": () => V(R(4, 4 + 6)),
  "prob-y7-07": () => V(R(die.length && Array.from({ length: 12 }, (_, i) => i + 1).filter(isPrime).length, 12)),
  "prob-y7-08": (q) => setOf(q, exclusive),
  "prob-y7-09": () => V((1 - 0.3 - 0.5) * 40),
  // ---- Y8
  "prob-y8-01": () => V(28 / 50), "prob-y8-02": () => V(pairs(["H", "T"] as any, ["H", "T"] as any).length),
  "prob-y8-03": () => V(0.2 * 30),
  "prob-y8-04": () => V(pairs(die, die).filter(([a, b]) => a + b === 7).length),
  "prob-y8-05": () => V(R(pairs(die, die).filter(([a, b]) => a + b === 10).length, 36)),
  "prob-y8-06": () => V(48 / 200), "prob-y8-07": () => V(0.25 * 80),
  "prob-y8-08": (q) => { const trials = opts(q).map((o) => ({ o, n: /^Flip it/.test(o) ? nums(o) : -1 })); const mx = Math.max(...trials.map((t) => t.n)); return S(trials.find((t) => t.n === mx)!.o); },
  "prob-y8-09": () => { const all = pairs([1, 2, 3], [1, 2, 3, 4]); return V(R(all.filter(([a, b]) => a + b > 5).length, all.length)); },
  "prob-y8-10": () => V(R(pairs(die, die).filter(([a, b]) => a === 6 || b === 6).length, 36)),
  // ---- Y9
  "prob-y9-01": () => V(0.3 * 0.5),
  "prob-y9-02": (q) => only(q, (o) => o.startsWith("The outcome of one")),
  "prob-y9-03": () => V(mul(R(1, 2), R(1, 2))),
  "prob-y9-04": () => { const v = D.venn; if (v.total !== 25 || v.football !== 8 || v.both !== 4 || v.tennis !== 5) throw new Error("data"); return V(v.total - (v.football + v.both + v.tennis)); },
  "prob-y9-05": () => V(R(D.venn.football + D.venn.both, D.venn.total)),
  "prob-y9-06": () => { const r = R(D.tree.red, D.tree.red + D.tree.blue); return V(mul(r, r)); },
  "prob-y9-07": () => { const t = D.tree.red + D.tree.blue, r = R(D.tree.red, t), b = R(D.tree.blue, t); return V(add(mul(r, b), mul(b, r))); },
  "prob-y9-08": () => V(mul(R(3, 7), R(2, 6))),
  "prob-y9-09": () => { const b = R(D.tree.blue, D.tree.red + D.tree.blue); return V(sub(R(1), mul(b, b))); },
  "prob-y9-10": () => V(0.4 * 0.7 + 0.6 * 0.3),
};
