// Lesson PLAN CLI (no Firestore, no network): derive + validate the step-by-step plan of every in-scope Oak lesson.
//   cd server
//   npx tsx src/oak/factory/plancli.ts check  [--subject Maths] [--keystage ks2] [--unit s] [--lesson s] [--limit N]   (stats + every invalid plan)
//   npx tsx src/oak/factory/plancli.ts show   <lesson-slug-substring> [--n 3]                                          (readable plan, tutor + student view)
//   npx tsx src/oak/factory/plancli.ts sample <N> [--seed 1] [--subject ..]                                            (N random plans, for reading)
//   npx tsx src/oak/factory/plancli.ts plans                                                                            (validate hand-written + curated plans)
// Same lesson set + dedupe as the importer (subject|keystage|unit|lesson).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertMath } from "../math";
import { planFor, curatedFor, slideTextFor } from "./index";
import { PLANS_BY_LESSON } from "../plans";
import type { LessonPlan } from "../../../../features/learninghub/lesson/plan";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../../scratch/oak-raw");
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const cm = (s: string) => convertMath(s).text;
const HUB_SUBJECT: Record<string, string> = { maths: "Maths", english: "English", science: "Science", french: "French", spanish: "Spanish", german: "German", biology: "Science", chemistry: "Science", physics: "Science", "combined science": "Science" };

function* rawLessons(): Generator<{ o: Record<string, unknown>; subject: string; ks: string; key: string }> {
  const seen = new Set<string>();
  for (const prog of fs.readdirSync(RAW).sort()) {
    const dp = path.join(RAW, prog);
    if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json")).sort()) {
      let o: Record<string, unknown>;
      try { o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); } catch { continue; }
      const subject = HUB_SUBJECT[lc(o.subjectTitle)];
      if (!subject || !o.unitSlug || !o.lessonSlug) continue;
      const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}|${o.lessonSlug}`;
      if (seen.has(key)) continue; seen.add(key);
      yield { o, subject, ks: String(o.keyStageSlug), key };
    }
  }
}
function inScope(o: Record<string, unknown>): boolean {
  const S = opt("--subject"), K = opt("--keystage"), U = opt("--unit"), L = opt("--lesson"), Y = opt("--year");
  if (S && lc(S) !== lc(HUB_SUBJECT[lc(o.subjectTitle)]) && lc(S) !== lc(o.subjectTitle)) return false;
  if (K && lc(K) !== lc(o.keyStageSlug)) return false;
  if (Y && Number(Y) !== Number(o.year)) return false;
  if (U && !(lc(o.unitSlug).includes(lc(U)) || lc(o.unitTitle).includes(lc(U)))) return false;
  if (L && !(lc(o.lessonSlug).includes(lc(L)) || lc(o.lessonTitle).includes(lc(L)))) return false;
  return true;
}
const planOf = (o: Record<string, unknown>) => planFor(o, { cm, unitSlug: String(o.unitSlug), lessonSlug: String(o.lessonSlug), hasWarmup: true, slideText: () => slideTextFor(o) });

export function readablePlan(p: LessonPlan): string {
  const L: string[] = [];
  p.steps.forEach((s, i) => {
    L.push(`${i + 1}. [${s.kind}] ${s.title}${s.minutes ? ` (~${s.minutes} min)` : ""}`);
    s.doThis.forEach((d) => L.push(`     do: ${d}`));
    if (s.say) L.push(`     say: “${s.say}”`);
    (s.keyIdeas ?? []).forEach((k) => L.push(`     idea: ${k}`));
    if (s.keywords?.length) L.push(`     words: ${s.keywords.map((k) => (k.meaning ? `${k.term} = ${k.meaning}` : k.term)).join(" | ")}`);
    (s.examples ?? []).forEach((e) => L.push(`     example: ${e}`));
    if (s.checkFor) L.push(`     check: ${s.checkFor.ask}${s.checkFor.lookFor ? `  -> ${s.checkFor.lookFor}` : ""}`);
    L.push(`     kid recap: ${s.recap.join(" / ")}`);
  });
  p.commonMistakes.forEach((m) => L.push(`  MISTAKE: ${m.mistake}${m.fix ? `  => ${m.fix}` : ""}`));
  p.watchOut.forEach((w) => L.push(`  WATCH OUT: ${w}`));
  return L.join("\n");
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function main() {
  const t0 = Date.now();
  if (cmd === "plans") {
    let bad = 0, n = 0;
    const byKey = new Map<string, Record<string, unknown>>();
    for (const l of rawLessons()) byKey.set(`${l.o.unitSlug}__${l.o.lessonSlug}`, l.o);
    const files = fs.readdirSync(path.resolve(here, "../curated")).filter((x) => x.endsWith(".json"));
    for (const f of files) { const key = f.replace(/\.json$/, ""); const c = curatedFor(key.split("__")[0], key.split("__")[1]); if (!c?.plan) continue; n++; const o = byKey.get(key); if (!o) { bad++; console.log(`FAIL ${f}: unknown lesson`); continue; } const r = planOf(o); if (!r.plan) { bad++; console.log(`FAIL ${f}\n   ${r.problems.join("\n   ")}`); } else console.log(`ok   ${f} (${r.plan.steps.length} steps, ${r.source})`); }
    for (const slug of Object.keys(PLANS_BY_LESSON)) { n++; const o = [...byKey.values()].find((x) => x.lessonSlug === slug); if (!o) { bad++; console.log(`FAIL hand ${slug}: unknown lesson`); continue; } const r = planOf(o); if (!r.plan) { bad++; console.log(`FAIL hand ${slug}\n   ${r.problems.join("\n   ")}`); } else console.log(`ok   hand ${slug} (${r.plan.steps.length} steps)`); }
    console.log(`${n} hand-written plans, ${bad} invalid`);
    process.exit(bad ? 1 : 0);
  }
  if (cmd === "show") {
    const q = lc(args[1]); const max = Number(opt("--n") ?? 1); let shown = 0;
    for (const l of rawLessons()) {
      if (!lc(l.o.lessonSlug).includes(q)) continue;
      const r = planOf(l.o);
      console.log(`## ${l.subject} ${l.ks} — ${l.o.unitTitle} — ${l.o.lessonTitle}  [${r.source}] problems: ${r.problems.length ? r.problems.join(" / ") : "none"}`);
      if (r.plan) console.log(readablePlan(r.plan));
      if (++shown >= max) break;
    }
    return;
  }
  if (cmd === "sample") {
    const n = Number(args[1] ?? 20); const rand = rng(Number(opt("--seed") ?? 1));
    const keep: { o: Record<string, unknown>; subject: string; ks: string }[] = [];
    for (const l of rawLessons()) if (inScope(l.o)) keep.push(l);
    const picked = new Set<number>(); while (picked.size < Math.min(n, keep.length)) picked.add(Math.floor(rand() * keep.length));
    for (const i of [...picked].sort((a, b) => a - b)) {
      const l = keep[i]; const r = planOf(l.o);
      console.log(`\n## ${l.subject} ${l.ks} — ${l.o.unitTitle} — ${l.o.lessonTitle}  [${r.source}] problems: ${r.problems.length ? r.problems.join(" / ") : "none"}`);
      console.log(`   OUTCOME: ${l.o.pupilLessonOutcome}`);
      if (r.plan) console.log(readablePlan(r.plan));
    }
    return;
  }
  if (cmd !== "check") { console.error("usage: plancli.ts check|show|sample|plans"); process.exit(1); }
  const limit = opt("--limit") ? Number(opt("--limit")) : Infinity;
  const by: Record<string, { lessons: number; plans: number; none: number; invalid: number; steps: number; examples: number; mistakes: number; tips: number }> = {};
  const problems: { lesson: string; p: string[] }[] = []; const reasons: Record<string, number> = {}; let count = 0;
  for (const l of rawLessons()) {
    if (!inScope(l.o)) continue;
    if (++count > limit) break;
    const s = (by[`${l.subject} ${l.ks}`] ??= { lessons: 0, plans: 0, none: 0, invalid: 0, steps: 0, examples: 0, mistakes: 0, tips: 0 });
    s.lessons++;
    const r = planOf(l.o);
    if (r.plan) { s.plans++; s.steps += r.plan.steps.length; s.examples += r.plan.steps.reduce((a, x) => a + (x.examples?.length ?? 0), 0); s.mistakes += r.plan.commonMistakes.length; s.tips += r.plan.watchOut.length; }
    else if (/not enough source facts/.test(r.problems[0] ?? "")) { s.none++; reasons[r.problems[0]] = (reasons[r.problems[0]] ?? 0) + 1; }
    else { s.invalid++; problems.push({ lesson: `${l.subject} ${l.ks} ${l.o.unitSlug}/${l.o.lessonSlug}`, p: r.problems }); }
  }
  const tot = { lessons: 0, plans: 0, none: 0, invalid: 0, steps: 0, examples: 0, mistakes: 0, tips: 0 };
  for (const [k, v] of Object.entries(by).sort()) {
    console.log(`${k.padEnd(22)} lessons ${String(v.lessons).padStart(5)}  plans ${String(v.plans).padStart(5)}  avg steps ${(v.steps / Math.max(1, v.plans)).toFixed(1)}  no-plan ${v.none}  INVALID ${v.invalid}  worked-examples ${v.examples}  mistakes ${v.mistakes}  tips ${v.tips}`);
    for (const x of Object.keys(tot) as (keyof typeof tot)[]) tot[x] += v[x];
  }
  console.log(`TOTAL lessons ${tot.lessons}  plans ${tot.plans}  no-plan ${tot.none}  INVALID ${tot.invalid}  arithmetic examples ${tot.examples}  common-mistakes ${tot.mistakes}  tips ${tot.tips}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (Object.keys(reasons).length) console.log(`no-plan reasons: ${JSON.stringify(reasons)}`);
  for (const p of problems.slice(0, 40)) console.log(`INVALID ${p.lesson}\n   ${p.p.slice(0, 5).join("\n   ")}`);
  process.exit(tot.invalid ? 1 : 0);
}
main();
