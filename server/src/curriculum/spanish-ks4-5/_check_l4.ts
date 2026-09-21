// Structural + linguistic sanity checks for the Spanish KS4–5 pack (leading underscore = skipped by validate.ts).
//   cd server && npx tsx src/curriculum/spanish-ks4-5/_check_l4.ts [--dump]
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zñ0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const dump = process.argv.includes("--dump");
const EXPECT = ["eside", "esloc", "eswork", "esgram4", "essoc", "esart", "esgram5", "esfilm"];
const YEARS: Record<string, number[]> = { eside: [10, 11], esloc: [10, 11], eswork: [10, 11], esgram4: [10, 11], essoc: [12, 13], esart: [12, 13], esgram5: [12, 13], esfilm: [12, 13] };
const NAMES: Record<string, string> = { eside: "Identity & Culture", esloc: "Local, National & Global Areas of Interest", eswork: "Current & Future Study and Employment", esgram4: "Grammar — Advanced Verbs & Structures", essoc: "Aspects of Society", esart: "Artistic Culture", esgram5: "Grammar & Structures", esfilm: "Film & Literature" };

let errors = 0, warns = 0;
const err = (m: string) => { errors++; console.log("ERROR " + m); };
const warn = (m: string) => { warns++; console.log("warn  " + m); };

const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_"));
const tops: CTopic[] = [];
for (const f of files) tops.push((await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC);
const nQ = { total: 0, single: 0, short: 0, multi: 0, written: 0 } as Record<string, number>;
const seenKeys = new Set<string>();

// accent slips: common endings that always need an accent in Spanish
const ACCENT_SLIPS = /\b(?!permission|impression|discussion|conclusion|expression|version|television|decision|revision|division|precision|occasion)[a-zñ]{3,}(cion|sion)\b/i;

for (const key of EXPECT) if (!tops.find((t) => t.key === key)) err(`missing topic ${key}`);
for (const t of tops) {
  if (t.subject !== "Spanish") err(`${t.key}: subject`);
  if (NAMES[t.key] !== t.topic) err(`${t.key}: topic name "${t.topic}" != taxonomy`);
  const yrs = Object.keys(t.years).map(Number).sort();
  if (JSON.stringify(yrs) !== JSON.stringify(YEARS[t.key])) err(`${t.key}: years ${yrs}`);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    const w = `${t.key} Y${yr}`;
    const nw = words(y.note.body);
    if (nw < 200 || nw > 350) err(`${w}: note ${nw} words (need 200–350)`);
    const qs = y.quiz.questions;
    if (qs.length < 12 || qs.length > 14) err(`${w}: ${qs.length} questions (need 12–14)`);
    const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
    if (d[0] < 1 || d[2] < 3 || d[1] < 5) warn(`${w}: difficulty spread ${d.join("/")}`);
    if (qs.filter((q) => q.diagnostic).length !== 2) err(`${w}: diagnostics != 2`);
    if (qs.filter((q) => q.kind === "written").length > 1) err(`${w}: >1 written`);
    if (y.flashcards.length < 8 || y.flashcards.length > 12) err(`${w}: flashcards ${y.flashcards.length}`);
    const fcFold = y.flashcards.map((c) => fold(c.front));
    if (new Set(fcFold).size !== fcFold.length) err(`${w}: duplicate flashcard front`);
    // both directions: some fronts should be English (heuristic: no Spanish-only markers) — report counts
    const noteText = y.note.body;
    // note sentences vs quiz items: flag shared 5-word shingles between note bullets/examples and quiz text
    const shingles = (s: string) => { const ws = fold(s).split(" ").filter(Boolean); const out = new Set<string>(); for (let i = 0; i + 5 <= ws.length; i++) out.add(ws.slice(i, i + 5).join(" ")); return out; };
    const noteSh = shingles(noteText);
    let singleLongest = 0, singles = 0;
    for (const q of qs) {
      nQ.total++; nQ[q.kind] = (nQ[q.kind] ?? 0) + 1;
      if (seenKeys.has(q.key)) err(`${q.key}: dup key`); seenKeys.add(q.key);
      if (!q.key.startsWith(`${t.key}-y${yr}-`)) err(`${q.key}: key prefix`);
      const all = [q.prompt, q.explanation, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : Array.isArray(q.answer) ? q.answer.join(" ") : ""].join(" ");
      if (ACCENT_SLIPS.test(all.replace(/[A-Z]{2,}/g, ""))) warn(`${q.key}: possible missing accent: ${all.match(ACCENT_SLIPS)![0]}`);
      // passages
      for (const m of q.prompt.matchAll(/«([^»]{200,})»/g)) if (words(m[1]) > 120) err(`${q.key}: passage ${words(m[1])} words > 120`);
      // leakage: note ↔ quiz shingles (prompt + options + answer)
      const qsh = shingles([q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : ""].join(" "));
      for (const s of qsh) if (noteSh.has(s)) { warn(`${q.key}: 5-gram shared with note: "${s}"`); break; }
      if (q.kind === "single" || q.kind === "multi") {
        const o = q.options!;
        if (new Set(o.map((x) => fold(x))).size !== o.length) err(`${q.key}: options collide after folding case/accents`);
        if (q.kind === "single") {
          singles++;
          const a = String(q.answer);
          const others = o.filter((x) => x !== a);
          if (a.length > Math.max(...others.map((x) => x.length))) singleLongest++;
          if (a.length > 1.6 * (others.reduce((s, x) => s + x.length, 0) / others.length) && a.length > 25) warn(`${q.key}: correct option much longer than distractors (${a.length} vs avg ${(others.reduce((s, x) => s + x.length, 0) / others.length).toFixed(0)})`);
        }
      }
      if (q.kind === "short") {
        const acc = q.accepted ?? [];
        if (new Set([q.answer as string, ...acc].map((x) => x.trim().toLowerCase())).size !== acc.length + 1) warn(`${q.key}: duplicate entries in accepted`);
        if (acc.some((x) => !x.trim())) err(`${q.key}: empty accepted`);
      }
      if (q.kind === "written" && (typeof q.answer !== "string" || words(q.answer as string) < 25)) err(`${q.key}: written model answer too short`);
      if (q.kind === "written" && !/mark scheme/i.test(q.explanation)) err(`${q.key}: written needs mark scheme`);
      if (q.kind === "written") { const mw = words(q.answer as string); if (dump) console.log(`   ${q.key} model answer ${mw} words`); }
    }
    if (singles >= 5 && singleLongest / singles > 0.5) warn(`${w}: correct option is the longest in ${singleLongest}/${singles} single questions`);
    const esLike = (t: string) => /[áéíóúñ¿¡]/.test(t) || /^(el|la|los|las|un|una|me|se|te|hay|voy|vale|está|es|no|si|para|por|sin|cada|a|de|en|hace|llueve|nieva|soler|tengo|hablar|ser|estar|hecha|dímelo|le|fui|preterite|pluperfect)\b/i.test(t);
    const cardFrontEn = y.flashcards.filter((c) => !esLike(c.front) && esLike(c.back)).length;
    if (cardFrontEn < 3) warn(`${w}: only ${cardFrontEn} flashcards with an English front (aim for both directions)`);
    if (dump) {
      console.log(`\n=== ${w} (${nw} words note; d ${d.join("/")}; cards ${y.flashcards.length}; EN-front cards ${cardFrontEn})`);
      for (const q of qs) console.log(`${q.key} [${q.kind} d${q.difficulty}${q.diagnostic ? " DIAG" : ""}] ${(q.prompt.split("\n").pop() ?? "").slice(0, 110)}  => ${Array.isArray(q.answer) ? q.answer.join(" | ") : q.answer}`);
    }
  }
}
console.log(`\n${tops.length} topics · ${nQ.total} questions (single ${nQ.single}, short ${nQ.short}, multi ${nQ.multi}, written ${nQ.written}) · ${errors} error(s) · ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
