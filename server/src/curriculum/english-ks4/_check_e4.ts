// Structural checks for the english-ks4 pack. Run: cd server && npx tsx src/curriculum/english-ks4/_check_e4.ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const WANT: Record<string, string> = { lang4: "Language Analysis", wr4: "Writing — Creative & Transactional", poet4: "Poetry", shak4: "Shakespeare & Drama", nov4: "19th-Century Novel", mod4: "Modern Prose & Drama", unseen4: "Unseen Poetry" };
let bad = 0;
const fail = (m: string) => { bad++; console.error("FAIL " + m); };
const keys = new Set<string>();
let total = 0, ty = 0;
for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
  const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
  if (WANT[t.key] !== t.topic) fail(`${f}: topic name/key mismatch`);
  if (t.subject !== "English") fail(`${f}: subject`);
  for (const y of [10, 11]) {
    const cy = t.years[y]; if (!cy) { fail(`${t.key} missing Y${y}`); continue; }
    ty++;
    const qs = cy.quiz.questions; total += qs.length;
    const w = words(cy.note.body);
    if (w < 200 || w > 350) fail(`${t.key} Y${y}: note ${w} words`);
    if (!/\|.*\|/.test(cy.note.body)) fail(`${t.key} Y${y}: note has no table`);
    if (!/PEEL|Point/.test(cy.note.body)) fail(`${t.key} Y${y}: note lacks PEEL/analysis method`);
    if (qs.length < 12 || qs.length > 14) fail(`${t.key} Y${y}: ${qs.length} questions`);
    const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
    if (d[0] < 2 || d[1] < 4 || d[2] < 3) fail(`${t.key} Y${y}: difficulty spread ${d}`);
    const wr = qs.filter((q) => q.kind === "written");
    if (wr.length > 1) fail(`${t.key} Y${y}: ${wr.length} written`);
    for (const q of wr) if (!/Mark scheme/.test(q.explanation) || (q.marks ?? 0) < 4) fail(`${q.key}: written lacks mark scheme/marks`);
    const diag = qs.filter((q) => q.diagnostic).length;
    if (diag !== 2) fail(`${t.key} Y${y}: ${diag} diagnostics`);
    // keys sequential + unique
    qs.forEach((q, i) => { const want = `${t.key}-y${y}-${String(i + 1).padStart(2, "0")}`; if (q.key !== want) fail(`${q.key} expected ${want}`); if (keys.has(q.key)) fail(`dup ${q.key}`); keys.add(q.key); });
    // answer integrity
    const pos = [0, 0, 0, 0, 0]; let longest = 0, singles = 0;
    for (const q of qs) {
      if (q.kind === "single" || q.kind === "multi") {
        const opts = q.options!; const ans = Array.isArray(q.answer) ? q.answer : [q.answer as string];
        for (const a of ans) if (!opts.includes(a)) fail(`${q.key}: answer not in options`);
        if (new Set(opts.map((o) => o.toLowerCase().trim())).size !== opts.length) fail(`${q.key}: near-duplicate options`);
        if (q.kind === "single") { singles++; pos[opts.indexOf(q.answer as string)]++; const others = opts.filter((o) => o !== q.answer).map((o) => o.length); if ((q.answer as string).length > Math.max(...others)) longest++; }
        if (q.kind === "multi" && (ans.length < 2 || ans.length >= opts.length)) fail(`${q.key}: multi size`);
      }
      // unseen extract length (≤250 words) — the extract is the text before the final question paragraph
      const ext = q.prompt.split("\n\n").slice(0, -1).join(" ");
      if (words(ext) > 250 && !/Poem A[\s\S]*Poem B|Poem C[\s\S]*Poem D/.test(q.prompt)) fail(`${q.key}: extract ${words(ext)} words`);
      if (/[\u{1F300}-\u{1FAFF}]/u.test(q.prompt)) fail(`${q.key}: emoji`);
    }
    if (singles >= 5 && longest / singles > 0.45) fail(`${t.key} Y${y}: correct option is longest in ${longest}/${singles} singles`);
    // note worked example must not reuse quoted quiz sentences: any quoted string of ≥5 words in the note shouldn't appear in quiz text
    const quizText = qs.map((q) => q.prompt + " " + (q.options ?? []).join(" ")).join(" ").toLowerCase();
    for (const m of cy.note.body.matchAll(/[“"]([^”"]{40,})[”"]/g)) if (quizText.includes(m[1].toLowerCase())) fail(`${t.key} Y${y}: note quotation reused in quiz: ${m[1].slice(0, 40)}`);
    const nf = cy.flashcards.length; if (nf < 8 || nf > 12) fail(`${t.key} Y${y}: flashcards ${nf}`);
    console.log(`${t.key.padEnd(8)} Y${y}: q=${qs.length} d=${d.join("/")} written=${wr.length} note=${w}w cards=${nf} pos=${pos.slice(0, 4)} longest=${longest}/${singles}`);
  }
}
console.log(`\n${ty} topic-years, ${total} questions, ${bad} failure(s)`);
process.exit(bad ? 1 : 0);
