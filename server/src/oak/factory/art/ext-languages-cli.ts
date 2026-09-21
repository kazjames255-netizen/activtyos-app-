// X5 tooling.  cd server && npx tsx src/oak/factory/art/ext-languages-cli.ts langcheck|coverage|words
//   langcheck : spelling / accent second read. Every word drawn inside any French/Spanish/German picture (all <text> content of the svg) is looked up in the
//               vocabulary of Oak's own raw lesson text for THAT language (scratch/oak-raw: key words, learning points, outline, transcripts, quizzes).
//               A word Oak never uses in that language is listed for a manual second read (a misspelling / missing accent would show up here).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXT_LANG_PICS } from "./ext-languages";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../../../scratch/oak-raw");
const LANGDIRS: Record<string, string> = { French: "french", Spanish: "spanish", German: "german" };
const words = (s: string) => s.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [];

function vocab(lang: string): Set<string> {
  const v = new Set<string>();
  for (const d of fs.readdirSync(RAW).filter((x) => x.startsWith(LANGDIRS[lang]))) {
    const dp = path.join(RAW, d); if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json"))) {
      const t = fs.readFileSync(path.join(dp, f), "utf8");
      for (const w of words(t.replace(/\\n|\\u[0-9a-f]{4}/g, " "))) { v.add(w); v.add(w.replace(/[’'-]/g, "")); for (const p of w.split(/[’'-]/)) if (p) v.add(p); }
    }
  }
  return v;
}
const svgTexts = (svg: string) => [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));

const cmd = process.argv[2];
if (cmd === "langcheck") {
  let unknown = 0, total = 0;
  for (const lang of Object.keys(LANGDIRS)) {
    const V = vocab(lang);
    console.log(`\n=== ${lang}: vocabulary ${V.size} words`);
    for (const p of EXT_LANG_PICS.filter((x) => (x.subjects as string[]).includes(lang))) {
      const toks = [...new Set(svgTexts(p.svg).flatMap((t) => words(t)))];
      const miss = toks.filter((w) => w.length > 1 && !V.has(w) && !V.has(w.replace(/[’'-]/g, "")));
      total += toks.length; unknown += miss.length;
      if (miss.length) console.log(`  ${p.id}: not in Oak ${lang} text -> ${miss.join(", ")}`);
    }
  }
  console.log(`\n${total} distinct words checked, ${unknown} not found in Oak text (review each by hand; English labels in a picture also appear here when Oak never uses them)`);
} else if (cmd === "words") {
  for (const p of EXT_LANG_PICS) console.log(`${p.id}\t${svgTexts(p.svg).join(" | ")}`);
} else { console.error("usage: ext-languages-cli.ts langcheck|words"); process.exit(1); }
