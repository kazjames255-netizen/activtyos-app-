// Independent re-computation of every K4 (pos, stats) answer from the SAME data the images are drawn from.
//   cd server && npx tsx src/curriculum/ks2maths/_check_k4.ts
import { statSync } from "node:fs";
import path from "node:path";
import { POS, ST, tr, refV, refH, mid, fmt, type Pt } from "./_k4data";
import { TOPIC as pos } from "./pos";
import { TOPIC as stats } from "./stats";
import type { CQuestion } from "../types";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => sum(a) / a.length;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const P = POS, S = ST;

const E: Record<string, () => string | number | string[]> = {
  // ─ POS Y4 ─
  "pos-y4-01": () => fmt(P.y4grid.B),
  "pos-y4-02": () => "How many squares to go across",
  "pos-y4-03": () => Object.entries(P.y4map).find(([, p]) => p[0] === 3 && p[1] === 6)![0],
  "pos-y4-04": () => fmt([P.y4rect.A[0], P.y4rect.C[1]]),
  "pos-y4-05": () => { const dx = P.y4move.Q[0] - P.y4move.P[0], dy = P.y4move.Q[1] - P.y4move.P[1]; return `${dx} right and ${dy} up`; },
  "pos-y4-06": () => ["(2, 4)", "(4, 2)", "(7, 4)", "(4, 7)"].filter((s) => s.endsWith(", 4)")),
  "pos-y4-07": () => { const pts: Pt[] = [[1, 1], [4, 1], [4, 4], [1, 4]]; const s = [pts[1][0] - pts[0][0], pts[2][1] - pts[1][1], pts[2][0] - pts[3][0], pts[3][1] - pts[0][1]]; return s.every((x) => x === s[0]) ? `A square with sides of ${s[0]} squares` : "?"; },
  "pos-y4-08": () => 7 - 2,
  "pos-y4-09": () => fmt(tr(tr([2, 1], 4, 3), -1, -2)),
  "pos-y4-10": () => fmt(tr(P.y4tri.T, ...P.y4tri.move)),
  // ─ POS Y5 ─
  "pos-y5-01": () => fmt(refV(P.y5mirror1.P, P.y5mirror1.line)),
  "pos-y5-02": () => "Its size and shape",
  "pos-y5-03": () => "A translation",
  "pos-y4-x": () => "",
  "pos-y5-04": () => { const a = P.y5shapeA[0], b = tr(a, ...P.y5shift); return `${b[0] - a[0]} right and ${a[1] - b[1]} down`; },
  "pos-y5-05": () => { // the panel whose candidate equals the true reflection: the picture draws C = reflect(orig)
    const truth = P.y5tri.map((p) => refV(p, P.y5panelMirror)).map(fmt).sort().join("|");
    const cands: Record<string, Pt[]> = { A: P.y5tri.map((p) => tr(p, 4, 0)), B: [[6, 1], [8, 1], [8, 4]], C: P.y5tri.map((p) => refV(p, P.y5panelMirror)), D: [[7, 1], [7, 4], [5, 4]] };
    const ok = Object.entries(cands).filter(([, c]) => c.map(fmt).sort().join("|") === truth).map(([k]) => k);
    if (ok.length !== 1) throw new Error("panels: " + ok);
    return `Picture ${ok[0]}`;
  },
  "pos-y5-06": () => fmt(refH(P.y5hmirror.X, P.y5hmirror.line)),
  "pos-y5-07": () => fmt(tr([5, 3], 4, 2)),
  "pos-y5-08": () => fmt(refV(tr([1, 2], 3, 4), 6)),
  "pos-y5-09": () => { const t = P.y5touch.tri, r = t.map((p) => refV(p, P.y5touch.line)); const xs = [...t, ...r].map((p) => p[0]), all = [...t, ...r]; const apex = all.reduce((a, p) => (p[1] > a[1] ? p : a)); const base = all.filter((p) => p[1] === Math.min(...all.map((q) => q[1]))); const xl = Math.min(...base.map((p) => p[0])), xr = Math.max(...base.map((p) => p[0])); const eq = Math.hypot(apex[0] - xl, apex[1] - 1) === Math.hypot(apex[0] - xr, apex[1] - 1); void xs; return eq && apex[0] === (xl + xr) / 2 ? "An isosceles triangle" : "?"; },
  "pos-y5-10": () => ["Each corner is the same distance from the mirror line as its image", "The image is a mirror picture on the opposite side of the mirror line"],
  // ─ POS Y6 ─
  "pos-y6-01": () => fmt(P.y6grid.B),
  "pos-y6-02": () => `Point ${Object.entries(P.y6grid).find(([, p]) => p[0] < 0 && p[1] < 0)![0]}`,
  "pos-y6-03": () => ["(−4, 0)", "(4, 4)", "(−4, −4)", "(0, −4)"].find((s) => s.startsWith("(0,"))!,
  "pos-y6-04": () => fmt(tr(P.y6tri.R, ...P.y6tri.move)),
  "pos-y6-05": () => fmt(refH(P.y6reflX.P, 0)),
  "pos-y6-06": () => fmt([P.y6rect.A[0], P.y6rect.C[1]]),
  "pos-y6-07": () => { const [x, y] = [-2, 5]; return `${Math.abs(x)} ${x < 0 ? "left" : "right"} and ${Math.abs(y)} ${y > 0 ? "up" : "down"}`; },
  "pos-y6-08": () => { const dx = P.y6move.Q[0] - P.y6move.P[0], dy = P.y6move.Q[1] - P.y6move.P[1]; return `${Math.abs(dx)} ${dx > 0 ? "right" : "left"} and ${Math.abs(dy)} ${dy < 0 ? "down" : "up"}`; },
  "pos-y6-09": () => fmt(tr(refV([4, 2], 0), 0, -2)),
  "pos-y6-10": () => fmt(mid(P.y6mid.E, P.y6mid.F)),
  // ─ STATS Y3 ─
  "stats-y3-01": () => S.y3pict.rows.find((r) => r[0] === "Cats")![1],
  "stats-y3-02": () => S.y3pict.rows.find((r) => r[0] === "Dogs")![1],
  "stats-y3-03": () => S.y3bar.values[S.y3bar.cats.indexOf("Wed")],
  "stats-y3-04": () => S.y3bar.values[4] - S.y3bar.values[0],
  "stats-y3-05": () => S.y3tally.rows.find((r) => r[0] === "Football")![1],
  "stats-y3-06": () => { const r = S.y3table.rows.find((x) => x[0] === "Rubbers")!; return r[1] + r[2]; },
  "stats-y3-07": () => 6 * 5,
  "stats-y3-08": () => (20 + 30) / 2,
  "stats-y3-09": () => 160 - sum(S.y3bar.values),
  "stats-y3-10": () => { const t = (n: string) => { const r = S.y3table.rows.find((x) => x[0] === n)!; return r[1] + r[2]; }; return t("Pencils") - t("Rulers"); },
  // ─ STATS Y4 ─
  "stats-y4-01": () => S.y4bar.values[3],
  "stats-y4-02": () => S.y4bar.values[1] - S.y4bar.values[2],
  "stats-y4-03": () => S.y4bar.values[0] + S.y4bar.values[4],
  "stats-y4-04": () => `${S.y4time.values[S.y4time.xs.indexOf("12 noon")]} °C`,
  "stats-y4-05": () => S.y4time.values[S.y4time.xs.indexOf("2 pm")] - S.y4time.values[S.y4time.xs.indexOf("8 am")],
  "stats-y4-06": () => { const v = S.y4time.values, x = S.y4time.xs; let best = 0; for (let i = 1; i < v.length; i++) if (v[i] - v[i - 1] > v[best + 1] - v[best]) best = i - 1; return `${x[best]} and ${x[best + 1]}`; },
  "stats-y4-07": () => { const d = S.y4dbl; const m = ["January", "February", "March", "April"]; const w = d.cats.map((_, i) => i).filter((i) => d.b.values[i] > d.a.values[i]); if (w.length !== 1) throw new Error("7"); return m[w[0]]; },
  "stats-y4-08": () => sum(S.y4dbl.a.values) - sum(S.y4dbl.b.values),
  "stats-y4-09": () => "The temperature of a room measured every hour",
  "stats-y4-10": () => (60 + 80) / 2 + 30,
  // ─ STATS Y5 ─
  "stats-y5-01": () => `${S.y5line.values[3]} cm`,
  "stats-y5-02": () => { const v = S.y5line.values; const g = v.slice(1).map((x, i) => x - v[i]); const mx = Math.max(...g); if (g.filter((x) => x === mx).length !== 1) throw new Error("tie"); const i = g.indexOf(mx); return `Weeks ${i} and ${i + 1}`; },
  "stats-y5-03": () => { let m = 9 * 60 + 48 + 60 + 27; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; },
  "stats-y5-04": () => "The amount is decreasing",
  "stats-y5-05": () => { const d = S.y5two; const mn = ["January", "February", "March", "April", "May", "June"]; return mn.filter((_, i) => d.a.values[i] > d.b.values[i]).filter((m) => ["January", "March", "April", "June"].includes(m)); },
  "stats-y5-06": () => { const d = S.y5two; const g = d.a.values.map((a, i) => Math.abs(a - d.b.values[i])); const mx = Math.max(...g); if (g.filter((x) => x === mx).length !== 1) throw new Error("tie"); return ["January", "February", "March", "April", "May", "June"][g.indexOf(mx)]; },
  "stats-y5-07": () => S.y5timetable.rows.find((r) => r[0] === "Library")![2],
  "stats-y5-08": () => { const r0 = S.y5timetable.rows[0][3], r4 = S.y5timetable.rows[4][3]; const m = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3); return m(r4) - m(r0); },
  "stats-y5-09": () => { const t = S.y5timetable.rows; const m = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3); const mk = t.find((r) => r[0] === "Market Square")!, pg = t.find((r) => r[0] === "Park Gates")!; for (let c = 1; c <= 4; c++) if (m(mk[c] as string) >= 8 * 60 + 30) return pg[c] as string; return "?"; },
  "stats-y5-10": () => { const d = S.y5table; const r = d.rows[d.hidden[0]]; const byRow = Number(r[4]) - Number(r[1]) - Number(r[2]); const byCol = Number(d.totals[3]) - d.rows.filter((_, i) => i !== d.hidden[0]).reduce((a, x) => a + Number(x[3]), 0); if (byRow !== byCol) throw new Error("table rows/cols disagree"); return byRow; },
  // ─ STATS Y6 ─
  "stats-y6-01": () => { const d = S.y6pie1; const per = 360 / d.total; return S.y6pie1.slices.find((s) => s[0] === "Football")![1] / per; },
  "stats-y6-02": () => { const d = S.y6pie1.slices.find((s) => s[0] === "Swimming")![1] / 360; return d === 0.25 ? "¼" : "?"; },
  "stats-y6-03": () => `${360 - sum(S.y6pie2.slices.filter((s) => s[0] !== S.y6pie2.hidden).map((s) => s[1]))}°`,
  "stats-y6-04": () => S.y6pie2.slices.find((s) => s[0] === "Walk")![1] * 72 / 360,
  "stats-y6-05": () => { const v = S.y6line.values; let n = 0; for (let i = 1; i < v.length; i++) if (v[i] === v[i - 1]) n += 10; return `${n} minutes`; },
  "stats-y6-06": () => { const v = S.y6line.values; return (v[6] - v[4]) - (v[2] - v[0]); },
  "stats-y6-07": () => String(mean(S.y6goals.values)),
  "stats-y6-08": () => (360 / 30) * 5,
  "stats-y6-09": () => 5 * 7 - (4 + 6 + 9 + 10),
  "stats-y6-10": () => "Add them all up and divide by how many numbers there are",
};
delete E["pos-y4-x"];

let bad = 0, checked = 0;
const fail = (m: string) => { console.error("✗ " + m); bad++; };
const stripUnit = (s: string) => s;
for (const T of [pos, stats]) {
  for (const y of Object.values(T.years)) {
    for (const q of y!.quiz.questions as CQuestion[]) {
      checked++;
      const ex = E[q.key];
      if (!ex) { fail(`${q.key}: no expectation written`); continue; }
      const want = ex();
      if (q.kind === "number") {
        if (typeof q.answer !== "number" || !near(q.answer, want as number)) fail(`${q.key}: key ${q.answer} but recomputed ${want}`);
      } else if (q.kind === "short") {
        const norm = (s: string) => s.replace(/[\s()]/g, "");
        if (norm(String(q.answer)) !== norm(String(want))) fail(`${q.key}: key ${q.answer} but recomputed ${want}`);
        for (const a of q.accepted ?? []) if (norm(a) !== norm(String(want))) fail(`${q.key}: accepted "${a}" differs from ${want}`);
      } else if (q.kind === "single") {
        const o = q.options!;
        const hits = o.filter((x) => stripUnit(x) === String(want));
        if (hits.length !== 1) fail(`${q.key}: recomputed "${want}" matches ${hits.length} options`);
        else if (q.answer !== hits[0]) fail(`${q.key}: key "${q.answer}" but recomputed "${want}"`);
      } else if (q.kind === "multi") {
        const w = (want as string[]).slice().sort(), a = (q.answer as string[]).slice().sort();
        if (JSON.stringify(w) !== JSON.stringify(a)) fail(`${q.key}: key ${JSON.stringify(a)} but recomputed ${JSON.stringify(w)}`);
        const nonAns = q.options!.filter((x) => !a.includes(x));
        if (nonAns.some((x) => (want as string[]).includes(x))) fail(`${q.key}: a distractor is also correct`);
      }
      if (q.image) { const f = path.resolve(process.cwd(), "../scratch/curriculum-images/ks2maths", q.image.file); try { const b = statSync(f).size; if (b > 200_000) fail(`${q.key}: image ${b} bytes > 200KB`); } catch { fail(`${q.key}: image missing ${q.image.file}`); } }
    }
  }
}
// key coverage
const seen = new Set<string>();
for (const T of [pos, stats]) for (const y of Object.values(T.years)) for (const q of y!.quiz.questions) seen.add(q.key);
for (const k of Object.keys(E)) if (!seen.has(k)) fail(`expectation for unknown key ${k}`);
console.log(`${checked} questions re-computed, ${bad} mismatch(es)`);
process.exit(bad ? 1 : 0);
