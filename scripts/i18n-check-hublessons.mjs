// Checks the hublessons namespace: keys used in code exist in en, every locale has every key, placeholders match, no empties, dynamic keys flagged.
import fs from "fs"; import path from "path";
const root = process.cwd();
const scope = ["features/learninghub/NotesPanel.tsx","features/learninghub/EditExisting.tsx","features/learninghub/lesson","features/learninghub/curriculum","features/learninghub/flashcards","features/learninghub/FlashcardsPanel.tsx"];
const files = []; const walk = (p) => { if (!fs.existsSync(p)) return; const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else if (/\.tsx?$/.test(p)) files.push(p); };
scope.forEach((s) => walk(path.join(root, s)));
const used = new Set();
for (const f of files) { const src = fs.readFileSync(f, "utf8"); for (const m of src.matchAll(/["'`]hublessons\.([A-Za-z0-9_]+)["'`]/g)) used.add(m[1]); for (const m of src.matchAll(/hublessons\.\$\{/g)) console.log("dynamic key in", f); }
const ts = (await import("typescript")).default;
const src = fs.readFileSync(path.join(root, "lib/i18n/messages/areas/hublessons.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} }; new Function("module", "exports", js)(m, m.exports); const cat = m.exports.default;
let bad = 0; const err = (s) => { bad++; console.log(s); };
const en = cat.en; for (const k of used) if (!(k in en) && !(`${k}_other` in en)) err("used but missing in en: " + k);
const ph = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
for (const l of Object.keys(cat)) for (const k of Object.keys(en)) {
  if (!(k in cat[l])) { err(`${l} missing ${k}`); continue; }
  if (!cat[l][k].trim()) err(`${l} empty ${k}`);
  if (ph(cat[l][k]) !== ph(en[k])) err(`${l} placeholder mismatch ${k}: ${ph(cat[l][k])} vs ${ph(en[k])}`);
  if (l !== "en" && cat[l][k] === en[k] && /[a-z]{4,}/i.test(en[k]) && !/^[^a-z]*$/i.test(en[k]) && en[k].length > 12) console.log(`warn ${l} identical to en: ${k}`);
}
const SCRIPT = { ur: /[\u0600-\u06FF]/, ar: /[\u0600-\u06FF]/, pa: /[\u0A00-\u0A7F]/, bn: /[\u0980-\u09FF]/ };
for (const l of Object.keys(SCRIPT)) for (const k of Object.keys(en)) {
  const v = cat[l][k].replace(/\{[a-zA-Z0-9_]+\}/g, ""); if (/[A-Za-z]{4,}/.test(en[k].replace(/\{[a-zA-Z0-9_]+\}/g, "")) && !SCRIPT[l].test(v)) err(`${l} value has no ${l} script: ${k}: ${v.slice(0, 40)}`);
}
for (const k of Object.keys(en)) if (!used.has(k)) console.log("unused (warn): " + k);
console.log(`keys=${Object.keys(en).length} used=${used.size} problems=${bad}`); process.exit(bad ? 1 : 0);
