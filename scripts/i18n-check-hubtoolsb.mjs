// Checks the hubtoolsb namespace: keys used in code exist in en, every locale complete, {placeholders} match, no empties;
// and the legacy-widget tables (hubtoolsb-legacy/<locale>.json): keys exist in source.json, placeholders/inline tags survive, no empty/identical values.
import fs from "fs"; import path from "path";
const root = process.cwd();
const scope = ["features/learninghub/tools", "features/learninghub/lesson/ToolPicker.tsx", "features/learninghub/lesson/widgets/LegacyWidget.tsx"];
const files = []; const walk = (p) => { if (!fs.existsSync(p)) return; const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else if (/\.tsx?$/.test(p)) files.push(p); };
scope.forEach((s) => walk(path.join(root, s)));
const used = new Set(); const dyn = [];
for (const f of files) { const src = fs.readFileSync(f, "utf8"); for (const m of src.matchAll(/hubtoolsb\.([A-Za-z0-9_]+)/g)) used.add(m[1]); for (const m of src.matchAll(/hubtoolsb\.\$\{|["'`]hubtoolsb\.["'`]\s*\+/g)) dyn.push(f); }
const ts = (await import("typescript")).default; const cache = {};
const load = (rel) => { if (cache[rel]) return cache[rel]; const src = fs.readFileSync(path.join(root, rel), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} }; new Function("module", "exports", "require", js)(m, m.exports, (p) => load(path.join(path.dirname(rel), p).replace(/$/, ".ts")).default ? { default: load(path.join(path.dirname(rel), p) + ".ts").default } : {});
  return (cache[rel] = m.exports); };
used.delete("subj_"); for (const x of ["maths","english","science","languages","humanities","cross"]) used.add("subj_" + x); used.add("tp_tabLabel"); used.add("tp_tabBlurb"); // dynamic / consumed by the hub shell tab bar
const cat = load("lib/i18n/messages/areas/hubtoolsb.ts").default;
let bad = 0; const err = (m) => { bad++; console.log(m); };
const en = cat.en;
for (const k of used) if (!(k in en) && !Object.keys(en).some((e) => e.startsWith(k))) err("used but missing in en: " + k);
const ph = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
for (const l of Object.keys(cat)) for (const k of Object.keys(en)) {
  if (!(k in cat[l])) { err(`${l} missing ${k}`); continue; }
  if (!cat[l][k].trim()) err(`${l} empty ${k}`);
  if (ph(cat[l][k]) !== ph(en[k])) err(`${l} placeholder mismatch ${k}`);
}
for (const k of Object.keys(en)) if (!used.has(k)) console.log("unused (warn): " + k);
// legacy tables
const dir = path.join(root, "lib/i18n/messages/areas/hubtoolsb-legacy");
const source = JSON.parse(fs.readFileSync(path.join(dir, "source.json"), "utf8"));
const tags = (s) => (s.match(/<\/?[a-z]+>/g) || []).join("");
const phn = (s) => [...new Set(s.match(/\{\d+\}/g) || [])].sort().join(",");
const summary = [];
for (const l of Object.keys(cat).filter((x) => x !== "en")) {
  const f = path.join(dir, l + ".json"); if (!fs.existsSync(f)) { err(`legacy ${l}.json missing`); continue; }
  const t = JSON.parse(fs.readFileSync(f, "utf8")); let n = 0;
  for (const [k, v] of Object.entries(t)) { n++;
    if (!(k in source)) { err(`legacy ${l}: key not in source: ${k.slice(0, 60)}`); continue; }
    if (typeof v !== "string" || !v.trim()) err(`legacy ${l}: empty ${k.slice(0, 60)}`);
    else if (v === k) err(`legacy ${l}: same as English ${k.slice(0, 60)}`);
    else { if (tags(v) !== tags(k)) err(`legacy ${l}: tag mismatch ${k.slice(0, 60)}`); for (const p of phn(v).split(",").filter(Boolean)) if (!phn(k).includes(p)) err(`legacy ${l}: unknown placeholder ${p} in ${k.slice(0, 60)}`); } }
  summary.push(`${l}:${n}`);
}
console.log(`keys=${Object.keys(en).length} used=${used.size} dynamic=${dyn.length} legacy-source=${Object.keys(source).length} legacy[${summary.join(" ")}] problems=${bad}`); process.exit(bad ? 1 : 0);
