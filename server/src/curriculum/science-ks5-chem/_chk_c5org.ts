import { TOPIC as T } from "./c5org";
import { Mr } from "./_atoms";
import { expect, ok, same } from "./_ck";

/** Count structural isomers of CnH2n+2 = trees on n nodes with max degree 4 (up to isomorphism), by brute-force generation + canonical form. */
function countAlkanes(n: number): number {
  const canon = (adj: number[][]): string => {
    const nodes = adj.length;
    // find centres by leaf stripping
    let deg = adj.map((a) => a.length); let leaves = deg.map((d, i) => (d <= 1 ? i : -1)).filter((i) => i >= 0); let remaining = nodes;
    while (remaining > 2) { const next: number[] = []; for (const l of leaves) { remaining--; for (const v of adj[l]) { deg[v]--; if (deg[v] === 1) next.push(v); } deg[l] = 0; } leaves = next; }
    const centres = leaves.length ? leaves : [0];
    const enc = (v: number, p: number): string => "(" + adj[v].filter((w) => w !== p).map((w) => enc(w, v)).sort().join("") + ")";
    return centres.map((c) => enc(c, -1)).sort()[0] + (centres.length === 2 ? enc(centres[1], -1) : "");
  };
  // more robust: use two-centre handling by rooting at each centre then taking min
  const canon2 = (adj: number[][]) => { const cs = new Set<string>(); for (let r = 0; r < adj.length; r++) { /* try every root, take min string: exact for small n */ const enc = (v: number, p: number): string => "(" + adj[v].filter((w) => w !== p).map((w) => enc(w, v)).sort().join("") + ")"; cs.add(enc(r, -1)); } return [...cs].sort()[0]; };
  void canon;
  let level = new Map<string, number[][]>([[canon2([[]]), [[]]]]);
  for (let size = 2; size <= n; size++) {
    const nxt = new Map<string, number[][]>();
    for (const adj of level.values()) for (let v = 0; v < adj.length; v++) {
      if (adj[v].length >= 4) continue;
      const a2 = adj.map((x) => [...x]); a2.push([v]); a2[v].push(a2.length - 1);
      const k = canon2(a2); if (!nxt.has(k)) nxt.set(k, a2);
    }
    level = nxt;
  }
  return level.size;
}

export function run() {
  const k = (n: number) => `c5org-y12-${String(n).padStart(2, "0")}`;
  ok(countAlkanes(4) === 2 && countAlkanes(5) === 3 && countAlkanes(6) === 5 && countAlkanes(7) === 9, "isomer counter reproduces 2,3,5,9");
  expect(T, k(11), countAlkanes(6), 0);
  ok(2 * 8 + 2 === 18, "C8H18");
  // Q10 yield
  const th = (5.0 / Mr("C6H12O")) * Mr("C6H10"); same("Mr cyclohexanol", Mr("C6H12O"), 100.0); same("Mr cyclohexene", Mr("C6H10"), 82.0); same("theoretical", th, 4.10, 0.001); expect(T, k(10), (2.87 / th) * 100, 0.003);
  // note yield example
  const nth = (4.6 / Mr("C2H5OH")) * Mr("C2H4"); same("note theoretical", nth, 2.80, 0.002); same("note yield", (2.1 / nth) * 100, 75.0, 0.003);
}
