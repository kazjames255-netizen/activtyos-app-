// Checks the `hubtoolsa` i18n namespace: every key used in code exists in `en`, every locale has every key,
// {placeholders} match across locales, no empty strings, every catalogue tool has a title_<id> key.
// Run: node scripts/i18n-check-hubtoolsa.mjs
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url); const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = fs.readFileSync(path.join(root, "lib/i18n/messages/areas/hubtoolsa.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: "commonjs" } }).outputText;
const m = { exports: {} }; new Function("module", "exports", js)(m, m.exports);
const cat = m.exports.default; const en = cat.en; const errs = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const scope = ["maths", "calc", "compass", "fractions", "numberline", "engine", "selection", "common"].map((d) => path.join(root, "features/learninghub/tools", d)).filter(fs.existsSync);
const files = [...scope.flatMap(walk), path.join(root, "features/learninghub/tools/toolText.ts")].filter((f) => /\.tsx?$/.test(f));
const used = new Set();
for (const f of files) { const t = fs.readFileSync(f, "utf8"); for (const x of t.matchAll(/["'`]hubtoolsa\.([A-Za-z0-9_]+)["'`]/g)) used.add(x[1]); for (const x of t.matchAll(/"((?:pr|f|n)_[A-Za-z0-9]+|s_hint[A-Za-z0-9]+)"/g)) used.add(x[1]); }
for (const k of used) if (!(k in en)) errs.push(`used but missing in en: ${k}`);
const ph = (s) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");
for (const [loc, msgs] of Object.entries(cat)) {
  for (const k of Object.keys(en)) { if (!(k in msgs)) errs.push(`${loc}: missing ${k}`); else { if (!msgs[k].trim()) errs.push(`${loc}: empty ${k}`); if (ph(msgs[k]) !== ph(en[k])) errs.push(`${loc}: placeholder mismatch ${k}`); } }
  for (const k of Object.keys(msgs)) if (!(k in en)) errs.push(`${loc}: extra ${k}`);
}
const reg = fs.readFileSync(path.join(root, "features/learninghub/tools/registryData.ts"), "utf8");
for (const l of reg.split("\n")) { const mm = l.match(/^([A-Z]-?[A-Z0-9]+|D\.[a-z]+)\|/); if (mm && !(`title_${mm[1].replace(/[^A-Za-z0-9]/g, "_")}` in en)) errs.push(`no title key for tool ${mm[1]}`); }
console.log(`keys: ${Object.keys(en).length}, used in code: ${used.size}, locales: ${Object.keys(cat).length}`);
if (errs.length) { console.log(errs.slice(0, 60).join("\n")); process.exit(1); } else console.log("OK");
