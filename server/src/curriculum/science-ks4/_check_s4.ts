// Independent re-computation of every computable science-ks4 answer key, plus structure checks.
//   cd server && npx tsx src/curriculum/science-ks4/_check_s4.ts
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REG } from "./_h";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(HERE, "../../../../scratch/curriculum-images/science-ks4");
let bad = 0;
const fail = (m: string) => { bad++; console.error("✗ " + m); };
const dp = (n: number) => { const s = String(n); return s.includes(".") ? s.split(".")[1].length : 0; };

const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
const topics: CTopic[] = [];
for (const f of files) topics.push((await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC);

// 1. recompute keys
let checked = 0;
for (const r of REG) {
  checked++;
  let v: number | string | string[];
  try { v = r.chk(); } catch (e) { fail(`${r.key}: chk threw ${e}`); continue; }
  if (r.kind === "number") {
    const ans = r.answer as number, tol = r.tol ?? 0;
    const allow = Math.max(tol, 0.5 * 10 ** -dp(ans)) + 1e-9;
    if (typeof v !== "number" || !(Math.abs(v - ans) <= allow)) fail(`${r.key}: typed ${ans} but recomputed ${v} (allow ±${allow})`);
  } else if (Array.isArray(r.answer)) {
    const a = [...r.answer].sort().join("|"), b = (Array.isArray(v) ? [...v] : [String(v)]).sort().join("|");
    if (a !== b) fail(`${r.key}: multi answer ${a} vs recomputed ${b}`);
  } else if (typeof v === "number") {
    const m = String(r.answer).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    const n = m ? Number(m[0]) : NaN; const d = m && m[1] ? m[1].length - 1 : 0;
    if (!(Math.abs(Math.round(v * 10 ** d) / 10 ** d - n) < 1e-9)) fail(`${r.key}: text answer "${r.answer}" vs recomputed ${v}`);
  } else if (String(v) !== String(r.answer)) fail(`${r.key}: answer "${r.answer}" vs recomputed "${v}"`);
}

// 2. structure + coverage checks
const numsIn = (s: string) => (s.replace(/[₀-₉⁰-⁹]/g, "").match(/\d+(\.\d+)?/g) ?? []).filter((x) => x.length >= 2 || x.includes("."));
let years = 0, qs = 0, cards = 0, imgs = 0, uncheckedNums = 0;
const summary: string[] = [];
for (const t of topics) for (const [yk, y] of Object.entries(t.years)) {
  if (!y) continue; years++;
  const q = y.quiz.questions; qs += q.length; cards += y.flashcards.length;
  const nImg = q.filter((x) => x.image).length; imgs += new Set(q.filter((x) => x.image).map((x) => x.image!.file)).size;
  const words = y.note.body.trim().split(/\s+/).length;
  if (words < 200 || words > 350) fail(`${t.key} Y${yk}: note ${words} words (need 200–350)`);
  if (q.length < 12 || q.length > 14) fail(`${t.key} Y${yk}: ${q.length} questions`);
  for (const x of q) {
    if (x.image) { const p = path.join(IMG, x.image.file); if (!existsSync(p)) fail(`${x.key}: missing ${x.image.file}`); else if (statSync(p).size > 200_000) fail(`${x.key}: ${x.image.file} > 200KB`); }
    if (x.kind === "number" && !REG.some((r) => r.key === x.key)) { uncheckedNums++; fail(`${x.key}: number question has no recompute`); }
    // note must not reuse the quiz item's numbers (QA_LOG rule)
    const noteW = y.note.body.slice(Math.max(0, y.note.body.search(/orked example/i))); const n = numsIn(x.prompt);
    const constOnly = /\(Ar|Avogadro|g = 9\.8|c = 4200|latent heat|speed of sound/.test(x.prompt);
    if (!constOnly && n.length >= 2 && n.every((k) => numsIn(noteW).includes(k)) && x.kind !== "single" ) fail(`${x.key}: all prompt numbers (${n.join(",")}) appear in the note — re-number the note example`);
    if (n.length >= 2 && n.every((k) => numsIn(noteW).includes(k)) && x.kind === "single") console.warn(`  warn ${x.key}: single prompt numbers ${n.join(",")} all in note`);
  }
  const d = [1, 2, 3].map((k) => q.filter((x) => x.difficulty === k).length);
  const kinds = ["single", "number", "short", "multi", "written"].map((k) => q.filter((x) => x.kind === k).length);
  summary.push(`${t.key.padEnd(9)} Y${yk}: ${q.length}q (d ${d.join("/")}; single/number/short/multi/written ${kinds.join("/")}; img q ${nImg}) note ${words}w cards ${y.flashcards.length} diag ${q.filter((x) => x.diagnostic).length}`);
}
console.log(summary.join("\n"));
console.log(`\n${topics.length} topics · ${years} topic-years · ${qs} questions · ${cards} flashcards · ${imgs} images · ${checked} recomputed keys · ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
