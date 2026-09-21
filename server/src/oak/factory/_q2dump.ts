// Q2 scratch dump (delete when done)
import fs from "node:fs";
import path from "node:path";
import { convertMath } from "../math";
import { deckFor, factsFromRaw, planFor, slideTextFor } from "./index";
import { SLIDES_BY_LESSON } from "../slides";
import { LANG_SUBJECTS } from "./clozeGuard";
if (process.env.Q2_NOSTRICT) LANG_SUBJECTS.clear();
const ONLY = process.env.Q2_ONLY ? process.env.Q2_ONLY.split("|") : null;
const RAW = path.resolve("/Users/kazjames/Downloads/activtyos-app-/scratch/oak-raw");
const cm = (s: string) => convertMath(s).text;
const SUBJ = new Set(["english", "french", "spanish", "german"]);
const seen = new Set<string>();
const all: Record<string, unknown>[] = [];
for (const prog of fs.readdirSync(RAW).sort()) {
  const dp = path.join(RAW, prog); if (!fs.statSync(dp).isDirectory()) continue;
  for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json")).sort()) {
    let o: any; try { o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); } catch { continue; }
    if (!SUBJ.has(String(o.subjectTitle).toLowerCase())) continue;
    const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}|${o.lessonSlug}`;
    if (seen.has(key)) continue; seen.add(key); all.push(o);
  }
}
const pools = new Map<string, { k: string; d: string }[]>();
for (const o of all) { const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}`; const a = pools.get(key) ?? []; for (const k of factsFromRaw(o, cm).keywords) if (k.d && !a.some((x) => x.k.toLowerCase() === k.k.toLowerCase())) a.push(k); pools.set(key, a); }
const out: any[] = [];
for (const o of all as any[]) {
  const cur = fs.existsSync(`/Users/kazjames/Downloads/activtyos-app-/server/src/oak/curated/${o.unitSlug}__${o.lessonSlug}.json`);
  if (cur || SLIDES_BY_LESSON[o.lessonSlug]) continue;
  if (ONLY && !(ONLY[0] === o.subjectTitle && ONLY[1] === o.keyStageSlug)) continue;
  const pool = pools.get(`${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}`) ?? [];
  const r = deckFor(o, { cm, subject: String(o.subjectTitle), unitTitle: cm(String(o.unitTitle)), lessonTitle: cm(String(o.lessonTitle)), pool, seed: `${o.unitSlug}|${o.lessonSlug}`, unitSlug: o.unitSlug, lessonSlug: o.lessonSlug });
  const p = planFor(o, { cm, unitSlug: o.unitSlug, lessonSlug: o.lessonSlug, hasWarmup: true, slideText: () => slideTextFor(o) });
  out.push({ subject: o.subjectTitle, ks: o.keyStageSlug, year: o.year, unit: o.unitTitle, unitSlug: o.unitSlug, lesson: o.lessonTitle, slug: o.lessonSlug, facts: factsFromRaw(o, cm), slides: r.slides, plan: p.plan, problems: [...r.problems, ...p.problems] });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log(all.length, out.length);
