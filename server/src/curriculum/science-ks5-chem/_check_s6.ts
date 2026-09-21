// Recomputes every calculable key in the science-ks5-chem pack. Run: cd server && npx tsx src/curriculum/science-ks5-chem/_check_s6.ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checks, problems } from "./_ck";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  for (const f of readdirSync(HERE).filter((f) => /^_chk_.*\.ts$/.test(f)).sort()) {
    const m = await import(pathToFileURL(path.join(HERE, f)).href);
    try { m.run(); } catch (e) { problems.push(`${f}: threw ${(e as Error).message}`); }
  }
  // Structural sanity on notes + quizzes (note length 250–350 words, 12–14 questions, difficulty mix)
  let ty = 0;
  for (const f of readdirSync(HERE).filter((f) => /^c5[a-z0-9]+\.ts$/.test(f)).sort()) {
    const t = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
    for (const y of Object.values(t.years) as any[]) {
      ty++;
      const w = words(y.note.body), n = y.quiz.questions.length;
      const d = [1, 2, 3].map((k) => y.quiz.questions.filter((q: any) => q.difficulty === k).length);
      const dg = y.quiz.questions.filter((q: any) => q.diagnostic).length;
      const wr = y.quiz.questions.filter((q: any) => q.kind === "written").length;
      const flag = (w < 250 || w > 350 ? " NOTE-WORDS!" : "") + (n < 12 || n > 14 ? " QCOUNT!" : "") + (dg !== 2 ? " DIAG!" : "") + (wr > 1 ? " WRITTEN!" : "");
      console.log(`${t.key.padEnd(7)} Y${y.year}  note ${w}w  q=${n} d=${d.join("/")} diag=${dg} written=${wr} cards=${y.flashcards.length} imgs=${y.quiz.questions.filter((q: any) => q.image).length}${flag}`);
      if (flag) problems.push(`${t.key} Y${y.year}:${flag}`);
    }
  }
  console.log(`\n${ty} topic-years, ${checks} checks, ${problems.length} problem(s)`);
  for (const p of problems) console.error("✗ " + p);
  process.exit(problems.length ? 1 : 0);
})();
