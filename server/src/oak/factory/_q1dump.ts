// Q1 scratch harness (delete when done): dump generated decks + plans + facts for Maths/Science as JSONL.
import fs from "node:fs";
import path from "node:path";
import { convertMath } from "../math";
import { deckFor, factsFromRaw, planFor, slideTextFor } from "./index";
import { SLIDES_BY_LESSON } from "../slides";
const RAW = "/Users/kazjames/Downloads/activtyos-app-/scratch/oak-raw";
const OUT = process.argv[2];
const cm = (s: string) => convertMath(s).text;
const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const SUBJ: Record<string, string> = { maths: "Maths", science: "Science", biology: "Science", chemistry: "Science", physics: "Science", "combined science": "Science" };
const rows: Record<string, unknown>[] = []; const seen = new Set<string>();
const pools = new Map<string, { k: string; d: string }[]>();
const all: Record<string, unknown>[] = [];
for (const prog of fs.readdirSync(RAW).sort()) {
  const dp = path.join(RAW, prog); if (!fs.statSync(dp).isDirectory()) continue;
  for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json")).sort()) {
    let o: Record<string, unknown>; try { o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); } catch { continue; }
    if (!SUBJ[lc(o.subjectTitle)] || !o.unitSlug || !o.lessonSlug) continue;
    const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}|${o.lessonSlug}`; if (seen.has(key)) continue; seen.add(key);
    all.push(o);
  }
}
for (const o of all) { const pk = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}`; const a = pools.get(pk) ?? []; for (const k of factsFromRaw(o, cm).keywords) if (k.d && !a.some((x) => x.k.toLowerCase() === k.k.toLowerCase())) a.push(k); pools.set(pk, a); }
const w = fs.createWriteStream(OUT);
for (const o of all) {
  const lessonSlug = String(o.lessonSlug), unitSlug = String(o.unitSlug);
  if (SLIDES_BY_LESSON[lessonSlug]) continue;
  const pool = pools.get(`${o.subjectTitle}|${o.keyStageSlug}|${unitSlug}`) ?? [];
  const r = deckFor(o, { cm, subject: SUBJ[lc(o.subjectTitle)], unitTitle: cm(String(o.unitTitle ?? "")), lessonTitle: cm(String(o.lessonTitle ?? "")), pool, seed: `${unitSlug}|${lessonSlug}`, unitSlug, lessonSlug });
  const p = planFor(o, { cm, unitSlug, lessonSlug, hasWarmup: true, slideText: () => slideTextFor(o) });
  const facts = factsFromRaw(o, cm);
  const mis = ((o.misconceptionsAndCommonMistakes as any[]) ?? []).map((m) => ({ m: cm(String(m.misconception ?? "")), r: cm(String(m.response ?? "")) }));
  const tips = ((o.teacherTips as any[]) ?? []).map((t) => cm(String(t.teacherTip ?? "")));
  w.write(JSON.stringify({ key: `${unitSlug}__${lessonSlug}`, subject: SUBJ[lc(o.subjectTitle)], subjectTitle: o.subjectTitle, ks: o.keyStageSlug, year: o.year, unit: o.unitTitle, lesson: o.lessonTitle, source: r.source, problems: r.problems, deck: r.slides, plan: p.plan, planSource: p.source, planProblems: p.problems, facts, mis, tips }) + "\n");
}
w.end();
