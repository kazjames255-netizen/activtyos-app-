// Validates every content file in ./ks2maths against types.ts + house rules. Run:
//   cd server && npx tsx src/curriculum/validate.ts            # all topics
//   cd server && npx tsx src/curriculum/validate.ts npv frac   # just these topic keys
// Exit code 1 on any error. Also importable: `validateTopic(topic)` returns string[] of problems.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic, CYear } from "./types";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // server is "type":"module": no __dirname
const IMG_ROOT = path.resolve(HERE, "../../../scratch/curriculum-images");
let IMAGES = path.join(IMG_ROOT, "ks2maths"); // per-pack folder; set per file below
/** Point image-file checks at scratch/curriculum-images/<pack>/ (the seeder validates pack by pack). */
export function setImagePack(pack: string) { IMAGES = path.join(IMG_ROOT, pack); }
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function checkQuestion(q: CQuestion, year: number, where: string, seen: Set<string>, out: string[]) {
  const at = `${where} ${q.key}`;
  if (!/^[a-z0-9]+-y(1[0-3]|[1-9])-\d{2,3}$/.test(q.key)) out.push(`${at}: key must look like "npv-y6-03" (year 1–13)`);
  if (!q.key.includes(`-y${year}-`)) out.push(`${at}: key year doesn't match the year it's filed under (${year})`);
  if (seen.has(q.key)) out.push(`${at}: duplicate key`);
  seen.add(q.key);
  if (q.prompt.trim().length < 8) out.push(`${at}: prompt too short`);
  if (/<[a-z][^>]*>|\$\$|\\\(|\\frac/i.test(q.prompt + (q.options ?? []).join(" ") + q.explanation)) out.push(`${at}: no HTML/LaTeX — plain text with unicode maths`);
  if (words(q.explanation) < 6) out.push(`${at}: explanation must state the method (≥6 words)`);
  if (![1, 2, 3].includes(q.difficulty)) out.push(`${at}: difficulty must be 1, 2 or 3`);
  if (q.image && !q.image.alt?.trim()) out.push(`${at}: image needs alt text`);
  if (q.image && !existsSync(path.join(IMAGES, q.image.file))) out.push(`${at}: image file missing: ${path.relative(path.resolve(HERE, "../../.."), path.join(IMAGES, q.image.file))}`);
  if (q.kind === "single" || q.kind === "multi") {
    const o = q.options ?? [];
    if (o.length < 3 || o.length > 5) out.push(`${at}: ${q.kind} needs 3–5 options`);
    if (new Set(o.map(norm)).size !== o.length) out.push(`${at}: duplicate options`);
    const a = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (q.kind === "single" && (Array.isArray(q.answer) || typeof q.answer !== "string")) out.push(`${at}: single answer must be one option text`);
    if (q.kind === "multi" && (!Array.isArray(q.answer) || q.answer.length < 2 || q.answer.length >= o.length)) out.push(`${at}: multi answer must be an array of ≥2 (and not all) option texts`);
    for (const x of a) if (typeof x !== "string" || !o.some((op) => op === x)) out.push(`${at}: answer "${String(x)}" is not exactly one of the options`);
  }
  if (q.kind === "written" && (year < 7)) out.push(`${at}: "written" (tutor-marked) is for Year 7+ only`);
  if (q.kind === "short" && (typeof q.answer !== "string" || !q.answer.trim())) out.push(`${at}: short needs a text answer`);
  if (q.kind === "number" && (typeof q.answer !== "number" || !Number.isFinite(q.answer))) out.push(`${at}: number needs a numeric answer`);
  if (q.kind === "number" && q.tolerance !== undefined && q.tolerance < 0) out.push(`${at}: tolerance ≥ 0`);
}

export function validateYear(y: CYear, topicKey: string, seen: Set<string>): string[] {
  const out: string[] = [];
  const where = `[${topicKey} Y${y.year}]`;
  if (!y.objectives.length) out.push(`${where}: objectives missing`);
  if (words(y.note.body) < 120) out.push(`${where}: note needs ≥120 words (has ${words(y.note.body)})`);
  if (!y.note.title.trim() || !y.quiz.title.trim()) out.push(`${where}: note/quiz title missing`);
  const qs = y.quiz.questions;
  if (qs.length < 8 || qs.length > 14) out.push(`${where}: quiz needs 8–14 questions (has ${qs.length})`);
  for (const q of qs) checkQuestion(q, y.year, where, seen, out);
  if (qs.filter((q) => q.kind === "written").length > 1) out.push(`${where}: at most 1 "written" question per quiz`);
  const diag = qs.filter((q) => q.diagnostic).length;
  if (diag < 2) out.push(`${where}: mark ≥2 questions diagnostic:true (has ${diag})`);
  const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
  if (d[0] < 1 || d[2] < 1) out.push(`${where}: spread difficulty (needs at least one of level 1 and level 3; has ${d.join("/")})`);
  const answers = qs.filter((q) => q.kind === "single").map((q) => String(q.answer));
  if (answers.length >= 6 && new Set(qs.filter((q) => q.kind === "single").map((q) => q.options!.indexOf(String(q.answer)))).size < 3) out.push(`${where}: correct answers sit in too few positions — shuffle the options`);
  if (new Set(qs.map((q) => norm(q.prompt))).size !== qs.length) out.push(`${where}: two questions have the same prompt`);
  if (y.flashcards.length < 8 || y.flashcards.length > 12) out.push(`${where}: 8–12 flashcards (has ${y.flashcards.length})`);
  for (const f of y.flashcards) if (!f.front.trim() || !f.back.trim()) out.push(`${where}: empty flashcard side`);
  return out;
}

export function validateTopic(t: CTopic, seen = new Set<string>()): string[] {
  const out: string[] = [];
  if (!t.key || !/^[a-z0-9]{2,10}$/.test(t.key)) out.push(`[${t.key}] key must be 2–10 lowercase letters/digits`);
  if (!["Maths", "English", "Science", "French", "Spanish", "German"].includes(t.subject)) out.push(`[${t.key}] subject must be one of Maths/English/Science/French/Spanish/German`);
  for (const [yr, y] of Object.entries(t.years)) { if (y) { if (String(y.year) !== yr) out.push(`[${t.key}] year mismatch under ${yr}`); out.push(...validateYear(y, t.key, seen)); } }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const only = process.argv.slice(2);
    // Every folder under curriculum/ that holds topic files is a PACK (ks2maths, maths-ks3, english-ks1, …).
    const root = HERE;
    const packs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const seen = new Set<string>();
    let problems = 0, topics = 0, years = 0, questions = 0;
    for (const pack of packs) {
      IMAGES = path.join(IMG_ROOT, pack);
      const dir = path.join(root, pack);
      const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
      for (const f of files) {
        const mod = await import(pathToFileURL(path.join(dir, f)).href);
        const t: CTopic | undefined = mod.TOPIC ?? mod.default;
        if (!t) { console.error(`${pack}/${f}: export TOPIC (a CTopic)`); problems++; continue; }
        if (only.length && !only.includes(t.key) && !only.includes(pack)) continue;
        const errs = validateTopic(t, seen);
        topics++; years += Object.keys(t.years).length; questions += Object.values(t.years).reduce((n, y) => n + (y?.quiz.questions.length ?? 0), 0);
        for (const e of errs) console.error(`${pack}/${e}`);
        problems += errs.length;
        console.log(`${errs.length ? "✗" : "✓"} ${pack.padEnd(14)} ${t.key.padEnd(8)} ${t.subject}: ${t.topic} — years ${Object.keys(t.years).join(",") || "none"}`);
      }
    }
    console.log(`\n${topics} topics · ${years} topic-years · ${questions} quiz questions · ${problems} problem(s)`);
    process.exit(problems ? 1 : 0);
  })();
}
