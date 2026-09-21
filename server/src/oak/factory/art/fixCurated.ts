// One-off / repeatable: rewrite the `art` of every curated deck (server/src/oak/curated/*.json) through the verified-picture policy
// (authors' emoji are dropped; verified pictures / literal emoji are set; card emoji that do not depict their title are removed).
//   cd server && npx tsx src/oak/factory/art/fixCurated.ts [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyArtPolicy, verifyArt } from "./select";
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const CUR = path.resolve(here, "../../curated");
const RAW = path.resolve(here, "../../../../../scratch/oak-raw");
const HUB: Record<string, string> = { maths: "Maths", english: "English", science: "Science", french: "French", spanish: "Spanish", german: "German", biology: "Science", chemistry: "Science", physics: "Science", "combined science": "Science" };
const dry = process.argv.includes("--dry");

const index = new Map<string, Record<string, unknown>>();
for (const prog of fs.readdirSync(RAW)) { const dp = path.join(RAW, prog); if (!fs.statSync(dp).isDirectory()) continue; for (const f of fs.readdirSync(dp)) { const o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); const k = `${o.unitSlug}__${o.lessonSlug}`; if (!index.has(k)) index.set(k, o); } }

let files = 0, slides = 0, before = { art: 0, cards: 0 }, after = { pics: 0, art: 0, cards: 0 }, problems = 0;
for (const f of fs.readdirSync(CUR).filter((x) => x.endsWith(".json"))) {
  const key = f.replace(/\.json$/, ""); const o = index.get(key); if (!o) { console.log("no raw lesson for", key); continue; }
  const j = JSON.parse(fs.readFileSync(path.join(CUR, f), "utf8")) as { slides?: Slide[] };
  if (!j.slides) continue;
  files++; slides += j.slides.length;
  for (const s of j.slides) { before.art += s.art?.length ?? 0; for (const b of s.blocks) if (b.t === "cards") before.cards += b.items.filter((x) => x.emoji).length; }
  const ctx = { subject: HUB[String(o.subjectTitle).toLowerCase()] ?? "Science", discipline: String(o.subjectTitle), keyStage: String(o.keyStageSlug), lessonTitle: String(o.lessonTitle), unitTitle: String(o.unitTitle) };
  const fixed = applyArtPolicy(j.slides, ctx);
  const p = verifyArt(fixed, ctx); if (p.length) { problems += p.length; console.log("VERIFY", key, p.slice(0, 3)); }
  for (const s of fixed) { after.pics += s.pics?.length ?? 0; after.art += s.art?.length ?? 0; for (const b of s.blocks) if (b.t === "cards") after.cards += b.items.filter((x) => x.emoji).length; }
  if (!dry) fs.writeFileSync(path.join(CUR, f), JSON.stringify({ ...j, slides: fixed }, null, 2) + "\n");
}
console.log(JSON.stringify({ files, slides, before, after, problems, dry }));
