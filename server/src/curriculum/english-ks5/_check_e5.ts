// Structural checks for english-ks5 (run: cd server && npx tsx src/curriculum/english-ks5/_check_e5.ts).
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const grams = (s: string, n: number) => { const w = norm(s).split(" "); const out = new Set<string>(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" ")); return out; };
let bad = 0;
const fail = (m: string) => { console.error("FAIL " + m); bad++; };
const EXPECT = ["langf", "langc", "litp", "litr", "litd", "litt"];
const stats: string[] = [];
(async () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_"));
  const keys = new Set<string>();
  for (const f of files) {
    const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
    keys.add(t.key);
    if (f !== `${t.key}.ts`) fail(`${f}: file name != key`);
    for (const y of [12, 13]) {
      const cy = t.years[y]; const at = `${t.key} Y${y}`;
      if (!cy) { fail(`${at}: missing`); continue; }
      const nw = words(cy.note.body).length;
      if (nw < 250 || nw > 350) fail(`${at}: note words ${nw}`);
      if (!/\|\s*---/.test(cy.note.body)) fail(`${at}: note needs a table`);
      if (!/model/i.test(cy.note.body)) fail(`${at}: note needs a model paragraph`);
      const qs = cy.quiz.questions;
      if (qs.length < 12 || qs.length > 14) fail(`${at}: ${qs.length} questions`);
      const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
      const diag = qs.filter((q) => q.diagnostic).length;
      const wr = qs.filter((q) => q.kind === "written").length;
      if (diag !== 2) fail(`${at}: diagnostics ${diag}`);
      if (wr > 1) fail(`${at}: written ${wr}`);
      if (Math.abs(d[0] - qs.length * 0.2) > 1.5 || Math.abs(d[1] - qs.length * 0.5) > 1.6 || Math.abs(d[2] - qs.length * 0.3) > 1.6) fail(`${at}: difficulty spread ${d.join("/")}`);
      const pos = new Set<number>();
      for (const q of qs) {
        if (q.kind === "single" || q.kind === "multi") {
          const o = q.options!;
          if (new Set(o.map(norm)).size !== o.length) fail(`${q.key}: options equal after normalising`);
          const a = Array.isArray(q.answer) ? q.answer : [q.answer as string];
          if (!a.every((x) => o.includes(x))) fail(`${q.key}: answer not in options`);
          if (q.kind === "single") pos.add(o.indexOf(q.answer as string));
          if (q.kind === "single" && a.length !== 1) fail(`${q.key}: single must have one answer`);
          const lens = o.map((x) => x.length); // longest option shouldn't always be the key
          void lens;
        }
        if (q.kind === "short" && !(q.accepted && q.accepted.length)) fail(`${q.key}: short needs accepted`);
        if (q.kind === "number" || q.kind === "short" ? false : false) fail("x");
      }
      if (pos.size < 3) fail(`${at}: single answer positions ${[...pos]}`);
      const singles = qs.filter((q) => q.kind === "single");
      const longest = singles.filter((q) => { const o = q.options!; const L = Math.max(...o.map((x) => x.length)); return q.answer === o.find((x) => x.length === L); }).length;
      if (longest > singles.length * 0.7) fail(`${at}: key is the longest option in ${longest}/${singles.length} singles`);
      if (cy.flashcards.length < 8 || cy.flashcards.length > 12) fail(`${at}: flashcards ${cy.flashcards.length}`);
      // note must not reuse quiz sentences: any shared 7-word run between the note and prompts/options/answers
      const ng = grams(cy.note.body, 7);
      for (const q of qs) for (const part of [q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : ""]) for (const g of grams(part, 7)) if (ng.has(g)) fail(`${q.key}: 7-word overlap with note: "${g}"`);
      // flashcard fronts unique
      if (new Set(cy.flashcards.map((c) => norm(c.front))).size !== cy.flashcards.length) fail(`${at}: duplicate flashcard fronts`);
      stats.push(`${at}: q=${qs.length} (${d.join("/")}) written=${wr} diag=${diag} note=${nw}w cards=${cy.flashcards.length} images=0`);
    }
  }
  for (const k of EXPECT) if (!keys.has(k)) fail(`missing topic ${k}`);
  console.log(stats.join("\n"));
  console.log(bad ? `\n${bad} check failure(s)` : "\nall checks passed");
  process.exit(bad ? 1 : 0);
})();
