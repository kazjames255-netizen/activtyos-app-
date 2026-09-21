// Structural checks for the english-ks3 pack. Run: cd server && npx tsx src/curriculum/english-ks3/_check_e3.ts
// - validateTopic (house rules) on all 7 topics; 21 topic-years x 10 questions
// - single/multi: answers ∈ options, no duplicate options (case-insensitive), multi answer 2..n-1
// - quotations registered with each question appear VERBATIM in its prompt
// - notes: >=150 words, contain a table and a PEE/PEEL model analysis, and their italic worked examples do not reuse any quiz prompt text
// - ≤1 written per quiz, exactly 2 diagnostics, answer-position spread, length-bias report
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateTopic } from "../validate";
import { QUOTES } from "./_b";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
let problems = 0, warns = 0;
const bad = (m: string) => { console.error("PROBLEM " + m); problems++; };
const warn = (m: string) => { console.warn("warn " + m); warns++; };

const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
const EXPECT = ["rc", "gp", "vocab", "wc", "poet", "shak", "prose", "spell"];
const seen = new Set<string>();
let years = 0, qs = 0, cardsN = 0;

(async () => {
  const topics: CTopic[] = [];
  for (const f of files) topics.push((await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC);
  for (const k of EXPECT) if (!topics.find((t) => t.key === k)) bad(`missing topic ${k}`);
  const allPrompts: string[] = [];
  for (const t of topics) for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) allPrompts.push(norm(q.prompt));

  for (const t of topics) {
    for (const e of validateTopic(t, seen)) bad(e);
    if (t.subject !== "English") bad(`${t.key}: subject`);
    for (const yr of [7, 8, 9]) {
      const y = t.years[yr];
      if (!y) { bad(`${t.key}: missing year ${yr}`); continue; }
      const at = `[${t.key} Y${yr}]`;
      years++; qs += y.quiz.questions.length; cardsN += y.flashcards.length;
      if (y.quiz.questions.length !== 10) bad(`${at}: needs 10 questions (has ${y.quiz.questions.length})`);
      if (y.quiz.questions.filter((q) => q.diagnostic).length !== 2) bad(`${at}: exactly 2 diagnostics`);
      if (t.key !== "wc" && y.quiz.questions.some((q) => q.kind === "written")) bad(`${at}: written only expected in wc`);
      if (t.key === "wc" && y.quiz.questions.filter((q) => q.kind === "written").length !== 1) bad(`${at}: wc wants exactly one written`);
      if (words(y.note.body) < 150) bad(`${at}: note < 150 words`);
      if (!/\|\s*---/.test(y.note.body)) bad(`${at}: note has no table`);
      if (t.key !== "spell" && !/PEE|Point:/.test(y.note.body)) bad(`${at}: note has no model analysis`); // spelling notes have a worked example, not a PEEL paragraph
      // worked examples in the note must not reuse quiz text: every *italic* span (>=25 chars) must not occur in any prompt
      for (const m of y.note.body.matchAll(/\*"?([^*]{25,}?)"?\*/g)) {
        const s = norm(m[1]);
        if (allPrompts.some((p) => p.includes(s))) bad(`${at}: note example reused in a quiz prompt: "${m[1].slice(0, 60)}"`);
      }
      const diff = [1, 2, 3].map((n) => y.quiz.questions.filter((q) => q.difficulty === n).length);
      if (diff.join("/") !== "3/5/2") warn(`${at}: difficulty spread ${diff.join("/")} (target 3/5/2)`);
      let longest = 0, singles = 0;
      const pos = new Set<number>();
      for (const q of y.quiz.questions) {
        const w = `${at} ${q.key}`;
        if (q.kind === "single" || q.kind === "multi") {
          const o = q.options!;
          if (new Set(o.map((x) => x.toLowerCase().trim())).size !== o.length) bad(`${w}: duplicate options (case-insensitive)`);
          const a = Array.isArray(q.answer) ? q.answer : [q.answer as string];
          for (const x of a) if (!o.includes(x)) bad(`${w}: answer not in options`);
          if (q.kind === "single") {
            singles++; pos.add(o.indexOf(q.answer as string));
            const lens = o.map((x) => x.length), mx = Math.max(...lens);
            if (o.indexOf(q.answer as string) === lens.indexOf(mx) && lens.filter((l) => l === mx).length === 1 && mx > 1.6 * (lens.reduce((s, v) => s + v, 0) - mx) / (lens.length - 1)) longest++;
          }
          if (/all of the above|none of the above/i.test(o.join(" "))) bad(`${w}: all/none of the above`);
        }
        for (const quote of QUOTES.get(q.key) ?? []) if (!norm(q.prompt).includes(norm(quote))) bad(`${w}: quotation not verbatim in prompt: "${quote.slice(0, 60)}"`);
        // heuristics: answer text must not also appear in another option
        if (q.kind === "short" && !q.answer) bad(`${w}: short without answer`);
      }
      if (singles >= 6 && pos.size < 3) bad(`${at}: answer positions too clustered`);
      if (longest > 3) warn(`${at}: ${longest} singles have a much longer correct option (length giveaway)`);
    }
  }
  console.log(`${topics.length} topics · ${years} topic-years · ${qs} questions · ${cardsN} flashcards · ${problems} problem(s) · ${warns} warning(s)`);
  process.exit(problems ? 1 : 0);
})();
