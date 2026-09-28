// Checks hubfam namespace: keys used in code exist in en, all locales complete, placeholders match, no empties, plural sets sane.
import fs from "fs"; import path from "path";
const root = process.cwd();
const scope = ["features/learninghub/family","features/learninghub/quiz","features/learninghub/shared-assess","features/learninghub/progress","features/learninghub/ProgressPanel.tsx","features/learninghub/QuizzesPanel.tsx","features/learninghub/QuestionsPanel.tsx","features/learninghub/DiagnosticPanel.tsx"];
const files = []; const walk = (p) => { const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else if (/\.tsx?$/.test(p)) files.push(p); };
scope.forEach((s) => walk(path.join(root, s)));
const used = new Set(); const dyn = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");
  for (const m of src.matchAll(/["'`]hubfam\.([A-Za-z0-9_]+)["'`]/g)) used.add(m[1]);
  for (const m of src.matchAll(/hubfam\.\$\{/g)) dyn.push(f);
  if (/parentCopy\.ts$/.test(f)) for (const m of src.matchAll(/\bT\("([A-Za-z0-9_]+)"/g)) used.add(m[1]);
}
// esbuild/tsx can be broken on this machine, so load the catalogue with the TypeScript compiler API instead.
import { createRequire } from "module"; import vm from "vm";
const req = createRequire(import.meta.url); const ts = req("typescript");
const load = (file) => {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: (r) => load(path.join(path.dirname(file), r) + ".ts") });
  return mod.exports.default ?? mod.exports;
};
const cat = load(path.join(root, "lib/i18n/messages/areas/hubfam.ts"));
let bad = 0; const err = (m) => { bad++; console.log(m); };
const en = cat.en;
const PL = /_(zero|one|two|few|many|other)$/;
for (const k of used) if (!(k in en) && !(`${k}_other` in en)) err("used but missing in en: " + k);
const ph = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
for (const l of Object.keys(cat)) {
  for (const k of Object.keys(en)) {
    if (!(k in cat[l])) { err(`${l} missing ${k}`); continue; }
    if (!cat[l][k].trim()) err(`${l} empty ${k}`);
    { const a = new Set(ph(en[k]).split(",")); for (const x of (cat[l][k].match(/\{[a-zA-Z0-9_]+\}/g) || [])) if (!a.has(x)) err(`${l} placeholder mismatch ${k}`); } // dropping a repeated/singular {x} is allowed, adding one is not
  }
  for (const k of Object.keys(cat[l])) {
    if (k in en) continue;
    const m = PL.exec(k);
    if (!m || !(`${k.replace(PL, "")}_other` in en)) { err(`${l} has extra key not in en: ${k}`); continue; }
    { const allowed = new Set(ph(en[`${k.replace(PL, "")}_other`]).split(",")); // dual/zero forms may drop {n} (e.g. Arabic "سؤالان"), never add others
      for (const x of (cat[l][k].match(/\{[a-zA-Z0-9_]+\}/g) || [])) if (!allowed.has(x)) err(`${l} plural placeholder mismatch ${k}`); }
  }
  for (const [k, v] of Object.entries(cat[l])) if (l !== "en" && v === en[k] && /[A-Za-z]{4,}/.test(v) && !["fr","es","pt","ro","cy","pl"].includes(l) && !/^[{}\s\d%A-Za-z…·.-]*$/.test("")) err(`${l} identical to en: ${k}`);
}
if (dyn.length) console.log("note: dynamic hubfam.${...} keys in", [...new Set(dyn)].join(", "), "(not statically checked)");
console.log(`locales=${Object.keys(cat).length} keys=${Object.keys(en).length} used=${used.size} problems=${bad}`); process.exit(bad ? 1 : 0);
