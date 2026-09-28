// Builds lib/i18n/messages/areas/hublessons.ts from scripts/i18n-src/hublessons/*.txt
// Line format: key ¦ en ¦ pl ¦ ro ¦ ur ¦ pa ¦ bn ¦ ar ¦ pt ¦ es ¦ fr ¦ cy   ("#" lines = comments; "\n" is not used)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "hublessons");
const L = ["en","pl","ro","ur","pa","bn","ar","pt","es","fr","cy"];
const out = Object.fromEntries(L.map((l) => [l, []]));
const seen = new Set(); let bad = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
  for (const [i, line] of fs.readFileSync(path.join(dir, f), "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    if (line.startsWith("#")) { for (const l of L) out[l].push("  // " + line.slice(1).trim()); continue; }
    const p = line.split(" ¦ ");
    if (p.length !== 12) { console.error(`${f}:${i + 1} has ${p.length} fields: ${line.slice(0, 60)}`); bad++; continue; }
    const key = p[0].trim(); if (seen.has(key)) { console.error(`dup key ${key}`); bad++; continue; } seen.add(key);
    L.forEach((l, j) => out[l].push(`  ${JSON.stringify(key)}: ${JSON.stringify(p[j + 1].replace(/\\n/g, "\n"))},`));
  }
}
if (bad) process.exit(1);
const body = L.map((l) => `  ${l}: {\n${out[l].map((s) => "  " + s).join("\n")}\n  },`).join("\n");
fs.writeFileSync(path.join(here, "../../lib/i18n/messages/areas/hublessons.ts"),
`// Translations for the \`hublessons.\` area (Teaching / Learning Hub: lessons, notes, curriculum map, flashcards).
// GENERATED from scripts/i18n-src/hublessons/*.txt by scripts/i18n-src/gen-hublessons.mjs — edit the sources, not this file.
// Every locale holds the SAME flat keys (no "hublessons." prefix). {placeholders}, emoji and numbers are shared across languages.
const hublessons: Record<string, Record<string, string>> = {
${body}
};
export default hublessons;
`);
console.log("ok", seen.size, "keys");
