// Independent expectations for stats.ts (Years 7–9), computed from the data (and the picture data in _m2data.ts). See _check_m2.ts.
import { D } from "./_m2data";
import { V, S, only, setOf, mean, median, mode, range, type EMap } from "./_m2lib";

const expand = (vals: number[], freq: number[]) => vals.flatMap((v, i) => Array(freq[i]).fill(v) as number[]);
const cls = (o: string) => { const m = o.match(/^(\d+) < [tx] ≤ (\d+)$/); return m ? [+m[1], +m[2]] : null; };
const pearson = (p: [number, number][]) => { const mx = mean(p.map((a) => a[0])), my = mean(p.map((a) => a[1])); let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const bar = (name: string) => D.bar7.values[D.bar7.cats.indexOf(name)];
const sector = (name: string) => D.pie.slices.find((s) => s[0] === name)![1];
const corr: Record<string, number> = { "Height and arm length": 1, "Age of a used car and its value": -1, "Hours of sunshine and sales of sun cream": 1, "Hours of TV watched and shoe size": 0, "Speed of a car and the time taken to travel 100 km": -1 };
const ages = [[0, 10, 4], [10, 20, 9], [20, 30, 12], [30, 40, 5]];
const groupedMean = (t: number[][]) => t.reduce((s, [a, b, f]) => s + ((a + b) / 2) * f, 0) / t.reduce((s, r) => s + r[2], 0);

export const E: EMap = {
  // ---- Y7
  "stats-y7-01": () => V(mean([4, 7, 9, 12, 8])), "stats-y7-02": () => V(median([3, 9, 4, 7, 12])),
  "stats-y7-03": () => { const m = mode([2, 5, 5, 7, 9, 5, 2]); if (m.length !== 1) throw new Error("mode"); return V(m[0]); },
  "stats-y7-04": () => V(bar("Banana") - bar("Orange")),
  "stats-y7-05": () => V(D.bar7.values.reduce((a, b) => a + b, 0)),
  "stats-y7-06": () => V(range([14, 9, 22, 17, 6])),
  "stats-y7-07": () => V(6 * 5 - (3 + 5 + 7 + 8)),
  "stats-y7-08": () => S("Mode"),
  "stats-y7-09": () => V(median([6, 2, 9, 4, 10, 8])),
  "stats-y7-10": () => V((10 * 62 + 73) / 11),
  // ---- Y8
  "stats-y8-01": () => { const r = pearson(D.scat.pts); return S(r > 0.7 ? "Positive" : r < -0.7 ? "Negative" : "No correlation"); },
  "stats-y8-02": () => { if (D.pie.slices.reduce((a, s) => a + s[1], 0) !== 360) throw new Error("pie != 360"); return V((sector("Cycle") / 360) * D.pie.total); },
  "stats-y8-03": () => S("Pie chart"),
  "stats-y8-04": () => { const d = expand([0, 1, 2, 3], [5, 8, 4, 3]); if (d.length !== 20) throw new Error("n"); return V(mean(d)); },
  "stats-y8-05": () => V(D.scat.line.c + D.scat.line.m * 5),
  "stats-y8-06": () => V(((sector("Walk") - sector("Car")) / 360) * D.pie.total),
  "stats-y8-07": (q) => { const d = [12, 14, 13, 15, 41, 12]; const md = median(d); return only(q, (o) => d.includes(Number(o)) && Math.abs(Number(o) - md) > 3 * (range(d.filter((x) => x !== Number(o))) || 1)); },
  "stats-y8-08": (q) => setOf(q, (o) => { if (!(o in corr)) throw new Error("unknown pair " + o); return corr[o] === 1; }),
  "stats-y8-09": () => { const d = expand([1, 2, 3, 4], [3, 5, 6, 2]); if (d.length !== 16) throw new Error("n"); return V(median(d)); },
  "stats-y8-10": () => V(9 * 7 - 8 * 6),
  // ---- Y9
  "stats-y9-01": (q) => { const t = [[0, 5, 3], [5, 10, 11], [10, 15, 7], [15, 20, 4]]; if (t.reduce((s, r) => s + r[2], 0) !== 25) throw new Error("n"); const m = t.reduce((a, b) => (b[2] > a[2] ? b : a)); return only(q, (o) => { const c = cls(o); return !!c && c[0] === m[0] && c[1] === m[1]; }); },
  "stats-y9-02": () => S("An estimate"),
  "stats-y9-03": () => S(12 < 7 ? "Team A" : "Team B"),
  "stats-y9-04": () => { if (ages.reduce((s, r) => s + r[2], 0) !== 30) throw new Error("n"); return V(groupedMean(ages)); },
  "stats-y9-05": () => { if (D.misl.axisMin === 0) throw new Error("chart not misleading"); return S("The vertical axis does not start at zero"); },
  "stats-y9-06": (q) => { let cum = 0, hit: number[] = []; for (const r of ages) { cum += r[2]; if (!hit.length && cum >= 15) hit = r; } return only(q, (o) => { const c = cls(o); return !!c && c[0] === hit[0] && c[1] === hit[1]; }); },
  "stats-y9-07": () => { const A = { mean: 24, range: 30 }, B = { mean: 22, range: 8 }; const hi = A.mean > B.mean ? "A" : "B", cons = A.range < B.range ? "A" : "B"; return S(`Team ${hi} has the higher mean ${hi === cons ? "and is" : `but Team ${cons} is`} more consistent`); },
  "stats-y9-08": () => { const d = [22, 23, 24, 24, 24, 25, 26, 27, 400]; const m = { Mean: mean(d), Median: median(d), Mode: mode(d)[0] }; const top = Object.entries(m).sort((a, b) => b[1] - a[1]); if (top[0][1] === top[1][1]) throw new Error("tie"); return S(top[0][0]); },
  "stats-y9-09": () => V(8 * 12 - 7 * 11),
};
