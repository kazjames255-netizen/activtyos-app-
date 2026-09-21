// Independent answer-key checker for the maths-ks3 pack (agent M2). Every key is recomputed from the question's own
// numbers (exact rationals, formula evaluation, or the shared picture data in _m2data.ts) and, for single/multi, we assert
// that NO other option is numerically equal to the right one.
// Run: cd server && npx tsx src/curriculum/maths-ks3/_check_m2.ts   (leading underscore: validate.ts skips it)
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CTopic, CQuestion } from "../types";
import { val, eq, num, opts, type EMap, type Exp } from "./_m2lib";

const HERE = path.resolve(process.cwd(), "src/curriculum/maths-ks3");
const KEYS = ["num", "alg", "rp", "geo", "prob", "stats"];
let errors = 0, checked = 0, written = 0;
const unitOf = (s: string) => String(s).replace(/^[£\-−\d.,\/ %]+/, "").trim();
const bad = (m: string) => { console.error("FAIL " + m); errors++; };

(async () => {
  for (const k of KEYS) {
    if (!existsSync(path.join(HERE, `${k}.ts`))) { console.log(`(skip ${k}: file not written yet)`); continue; }
    const T: CTopic = (await import(pathToFileURL(path.join(HERE, `${k}.ts`)).href)).TOPIC;
    const E: EMap = (await import(pathToFileURL(path.join(HERE, `_e_${k}.ts`)).href)).E;
    for (const y of Object.values(T.years)) {
      if (!y) continue;
      const qs = y.quiz.questions;
      if (qs.length !== 10) bad(`${T.key} Y${y.year}: ${qs.length} questions`);
      const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
      if (d.join("/") !== "3/5/2") bad(`${T.key} Y${y.year}: difficulty spread ${d.join("/")} (want 3/5/2)`);
      if (qs.filter((q) => q.diagnostic).length !== 2) bad(`${T.key} Y${y.year}: need exactly 2 diagnostic`);
      const positions = new Set<number>();
      for (const q of qs) {
        if (q.kind === "written") { written++; if (q.explanation.split(/\s+/).length < 25) bad(`${q.key}: written needs a mark scheme in explanation`); continue; }
        const f = E[q.key];
        if (!f) { bad(`${q.key}: no expectation defined`); continue; }
        checked++;
        let exp: Exp;
        try { exp = f(q as CQuestion); } catch (e) { bad(String((e as Error).message ?? e)); continue; }
        if (q.kind === "single") positions.add(opts(q).indexOf(String(q.answer)));
        if ("set" in exp) {
          const got = [...(q.answer as string[])].sort().join("|"), want = [...exp.set].sort().join("|");
          if (got !== want) bad(`${q.key}: multi answer [${got}] != computed [${want}]`);
          continue;
        }
        if ("s" in exp) {
          if (String(q.answer) !== exp.s) bad(`${q.key}: answer "${q.answer}" != computed "${exp.s}"`);
          const rv = val(exp.s);
          if (rv && q.kind === "single" && !/^-?\d+[a-z]$/.test(exp.s)) { const dup = opts(q).filter((o) => { const v = val(o); return v && eq(v, rv) && unitOf(o) === unitOf(exp.s); }); if (dup.length !== 1) bad(`${q.key}: ${dup.length} options equal the right value`); }
          continue;
        }
        const a = val(q.answer as string | number);
        if (!a) { bad(`${q.key}: cannot parse answer "${q.answer}"`); continue; }
        if (!eq(a, exp.v)) bad(`${q.key}: answer "${q.answer}" (${num(a)}) != computed ${num(exp.v)}`);
        if (q.kind === "single") { const dup = opts(q).filter((o) => { const v = val(o); return v && eq(v, exp.v) && unitOf(o) === unitOf(String(q.answer)); }); if (dup.length !== 1) bad(`${q.key}: ${dup.length} options equal the computed value ${num(exp.v)}`); }
        if (q.kind === "short") for (const ac of q.accepted ?? []) { const v = val(ac); if (v && !eq(v, exp.v)) bad(`${q.key}: accepted "${ac}" != computed`); }
        if (q.kind === "number" && (q.tolerance ?? 0) > 2) bad(`${q.key}: tolerance too loose`);
      }
      console.log(`${T.key} Y${y.year}: ${qs.length} q, positions [${[...positions].sort().join(",")}], diff ${d.join("/")}, note words ${y.note.body.split(/\s+/).length}, cards ${y.flashcards.length}`);
    }
  }
  console.log(`\nchecked ${checked} questions (+${written} written), ${errors} failure(s)`);
  process.exit(errors ? 1 : 0);
})();
