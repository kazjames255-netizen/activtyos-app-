// Checks hublive namespace: keys used in code exist in en, all locales complete, placeholders match, no empties.
import fs from "fs"; import path from "path";
const root = process.cwd();
const scope = ["features/learninghub/LiveLessonsPanel.tsx","features/learninghub/live","features/learninghub/inperson","features/learninghub/remotesync"];
const files = []; const walk = (p) => { const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else if (/\.tsx?$/.test(p)) files.push(p); };
scope.forEach((s) => walk(path.join(root, s)));
const used = new Set();
for (const f of files) { const src = fs.readFileSync(f, "utf8"); for (const m of src.matchAll(/["'`]hublive\.([A-Za-z0-9_]+)["'`]/g)) used.add(m[1]); for (const m of src.matchAll(/hublive\.\$\{/g)) console.log("dynamic key in", f); }
const { execSync } = await import("child_process");
const ts = (await import("typescript")).default; const cat = {};
for (const part of "abcde") {
  const src = fs.readFileSync(path.join(root, `lib/i18n/messages/areas/hublive_${part}.ts`), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} }; new Function("module", "exports", js)(m, m.exports);
  for (const [l, o] of Object.entries(m.exports.default)) Object.assign((cat[l] ??= {}), o);
}
let bad = 0; const err = (m) => { bad++; console.log(m); };
const en = cat.en; for (const k of used) if (!(k in en)) err("used but missing in en: " + k);
const ph = (s) => [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g) || [])].sort().join(",");
for (const l of Object.keys(cat)) for (const k of Object.keys(en)) {
  if (!(k in cat[l])) { err(`${l} missing ${k}`); continue; }
  if (!cat[l][k].trim()) err(`${l} empty ${k}`);
  if (ph(cat[l][k]) !== ph(en[k])) err(`${l} placeholder mismatch ${k}`);
}
for (const k of Object.keys(en)) if (!used.has(k) && !files.some((f) => fs.readFileSync(f, "utf8").includes(k))) console.log("unused (warn): " + k);
console.log(`keys=${Object.keys(en).length} used=${used.size} problems=${bad}`); process.exit(bad ? 1 : 0);
