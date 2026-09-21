// Checker for the KS1 Science pack. Run: cd server && npx tsx src/curriculum/science-ks1/_check_s1.ts
// Recomputes what is computable (chart questions from data.json, animal-group questions from a fact table) and checks structure
// (answers are options, key numbering, positions, difficulty spread, diagnostics, prompt length, images + alt text).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.resolve(HERE, "../../../../scratch/curriculum-images/science-ks1");
const data = JSON.parse(readFileSync(path.join(IMG_DIR, "data.json"), "utf8")) as { pictogram: Record<string, number>; daylight: Record<string, number> };
const manifest = JSON.parse(readFileSync(path.join(IMG_DIR, "manifest.json"), "utf8")) as Record<string, { alt: string; bytes: number }>;

let bad = 0;
const fail = (m: string) => { console.error("FAIL " + m); bad++; };
const ok = (c: boolean, m: string) => { if (!c) fail(m); };

// ── fact table (KS1 level; checked by a teacher's eye) ───────────────────────────────────────────
const group: Record<string, string> = {
  salmon: "fish", goldfish: "fish", cod: "fish",
  frog: "amphibian", newt: "amphibian", toad: "amphibian",
  snake: "reptile", tortoise: "reptile", crocodile: "reptile",
  owl: "bird", robin: "bird", duck: "bird", penguin: "bird", sparrow: "bird",
  bat: "mammal", cow: "mammal", lion: "mammal", rabbit: "mammal", horse: "mammal", hedgehog: "mammal",
  moth: "insect", butterfly: "insect",
};
const diet: Record<string, string> = { cow: "herbivore", rabbit: "herbivore", horse: "herbivore", lion: "carnivore", crocodile: "carnivore" };
const name = (s: string) => s.toLowerCase().replace(/^(an?|the) /, "").trim();

const load = async (f: string): Promise<CTopic> => (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
const topics: CTopic[] = [];
for (const f of files) topics.push(await load(f));
const allQ = new Map<string, CQuestion>();

let nq = 0, nn = 0, nf = 0, ni = 0;
for (const t of topics) {
  ok(t.subject === "Science", `${t.key}: subject`);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    const at = `${t.key} Y${yr}`;
    ok(y.year === Number(yr) && (y.year === 1 || y.year === 2), `${at}: year 1 or 2`);
    const qs = y.quiz.questions;
    ok(qs.length === 10, `${at}: needs 10 questions (has ${qs.length})`);
    ok(y.flashcards.length >= 8 && y.flashcards.length <= 12, `${at}: flashcards ${y.flashcards.length}`);
    nq += qs.length; nn++; nf += y.flashcards.length;
    qs.forEach((q, i) => {
      allQ.set(q.key, q);
      const qat = `${at} ${q.key}`;
      ok(q.key === `${t.key}-y${yr}-${String(i + 1).padStart(2, "0")}`, `${qat}: key must be sequential`);
      ok(q.kind !== "written", `${qat}: no written at KS1`);
      const lines = q.prompt.split("\n");
      ok(lines.length <= 2, `${qat}: prompt is ${lines.length} lines`);
      ok(lines.every((l) => l.length <= 90), `${qat}: a prompt line is too long (${Math.max(...lines.map((l) => l.length))} chars)`);
      if (q.kind === "single" || q.kind === "multi") {
        const o = q.options!;
        ok(o.length >= 3 && o.length <= 4, `${qat}: options ${o.length}`);
        ok(new Set(o).size === o.length, `${qat}: duplicate options`);
        const a = Array.isArray(q.answer) ? q.answer : [q.answer as string];
        ok(a.every((x) => o.includes(x)), `${qat}: answer text is not one of the options`);
        if (q.kind === "single") ok(a.length === 1, `${qat}: single has one answer`);
        else ok(a.length >= 2 && a.length < o.length && new Set(a).size === a.length, `${qat}: multi answer shape`);
      }
      if (q.kind === "short") ok(!!q.accepted?.length, `${qat}: short should list accepted variants`);
      if (q.image) {
        ni++;
        const p = path.join(IMG_DIR, q.image.file);
        ok(existsSync(p) && statSync(p).size <= 200_000, `${qat}: image missing or >200KB`);
        ok(manifest[q.image.file.replace(/\.png$/, "")]?.alt === q.image.alt, `${qat}: image alt differs from manifest`);
      }
    });
    ok(qs.filter((q) => q.diagnostic).length === 2, `${at}: exactly 2 diagnostic (has ${qs.filter((q) => q.diagnostic).length})`);
    const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
    ok(d.join("/") === "3/5/2", `${at}: difficulty spread ${d.join("/")} (want 3/5/2)`);
    ok(qs.filter((q) => q.diagnostic).every((q) => q.difficulty === 2), `${at}: diagnostics should be mid difficulty`);
    const pos = qs.filter((q) => q.kind === "single").map((q) => q.options!.indexOf(q.answer as string));
    const counts = [0, 1, 2, 3].map((n) => pos.filter((p) => p === n).length);
    ok(counts.filter((c) => c > 0).length >= 3 && Math.max(...counts) <= 3, `${at}: answer positions ${counts.join("/")} (want ≥3 positions used, none >3 times)`);
    ok(y.note.body.split(/\s+/).length >= 120, `${at}: note too short`);
    console.log(`${at.padEnd(16)} positions ${counts.join("/")}  difficulty ${d.join("/")}  diag ${qs.filter((q) => q.diagnostic).length}`);
  }
}

// ── recompute chart answers from data.json (same numbers that drew the picture) ─────────────────
const P = data.pictogram, D = data.daylight;
const argmax = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
const get = (k: string) => allQ.get(k)!;
ok(get("mats-y1-04").answer === argmax(P)[0] && Object.values(P).filter((v) => v === argmax(P)[1]).length === 1, "mats-y1-04: most-common material (unique max)");
ok(get("mats-y1-05").answer === P.Plastic - P.Glass, `mats-y1-05: expected ${P.Plastic - P.Glass}`);
ok(get("seasons-y1-05").answer === argmax(D)[0] && Object.values(D).filter((v) => v === argmax(D)[1]).length === 1, "seasons-y1-05: longest day month");
ok(get("seasons-y1-06").answer === D.June - D.December, `seasons-y1-06: expected ${D.June - D.December}`);
for (const [k, v] of Object.entries(P)) ok(new RegExp(`${k}[^.]*?\\b${v}\\b`).test(manifest.pictogram.alt), `pictogram alt should say ${k} ${v}`);
for (const [k, v] of Object.entries(D)) ok(new RegExp(`${k}[^.]*?\\b${v}\\b`).test(manifest.daylight.alt), `daylight alt should say ${k} ${v}`);

// ── animal facts from the table ────────────────────────────────────────────────────────────────
const opt = (k: string) => get(k).options!;
const ans = (k: string) => get(k).answer as string;
ok(group[name(ans("animals-y1-01"))] === "fish" && opt("animals-y1-01").filter((o) => group[name(o)] === "fish").length === 1, "animals-y1-01: exactly one fish");
ok(diet[name(ans("animals-y1-03"))] === "carnivore" && opt("animals-y1-03").filter((o) => diet[name(o)] === "carnivore").length === 1, "animals-y1-03: exactly one carnivore");
ok(opt("animals-y1-07").filter((o) => group[name(o)] === "reptile").length === 1 && group[name(ans("animals-y1-07"))] === "reptile", "animals-y1-07: exactly one reptile");
{
  const q = get("animals-y1-08"); const a = q.answer as string[];
  ok(q.options!.filter((o) => diet[name(o)] === "herbivore").sort().join() === [...a].sort().join(), "animals-y1-08: herbivores");
}
{
  const q = get("animals-y1-10");
  const allBirds = q.options!.filter((o) => o.split(", ").every((x) => group[name(x)] === "bird"));
  ok(allBirds.length === 1 && allBirds[0] === q.answer, "animals-y1-10: exactly one all-bird group");
}
ok(group.newt === "amphibian" && ans("animals-y1-05") === "Amphibians", "animals-y1-05: frog");
ok(group.bat === "mammal" && ans("animals-y1-09") === "A mammal", "animals-y1-09: bat");
ok(ans("animals-y2-10") === "Egg, chick, hen", "animals-y2-10: life-cycle order");
ok(ans("living-y2-09") === "Leaf → caterpillar → blue tit", "living-y2-09: food chain direction");
// labelled-picture keys (letters match gen-s1.mjs: plantparts A stem B flower C roots D leaf; facesenses B nose; trees B winter C autumn)
ok(ans("plants-y1-02") === "C" && ans("plants-y1-04") === "A", "plants-y1: plant-part letters");
ok(ans("animals-y1-04") === "B", "animals-y1-04: nose is B");
ok(ans("seasons-y1-02") === "B" && ans("seasons-y1-04") === "C", "seasons-y1: tree letters");

// quiz-wide: no two questions in one topic-year share the same answer AND the same prompt words (cheap giveaway guard)
for (const t of topics) for (const y of Object.values(t.years)) {
  const single = y!.quiz.questions.filter((q) => q.kind === "single").map((q) => String(q.answer));
  const dup = single.filter((a, i) => single.indexOf(a) !== i && !/^[A-D]$/.test(a));
  ok(dup.length === 0, `${t.key} Y${y!.year}: repeated single answers ${dup.join("|")}`);
}

console.log(`\n${topics.length} topics · ${nn} topic-years · ${nq} questions · ${nf} flashcards · ${ni} image questions · ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
