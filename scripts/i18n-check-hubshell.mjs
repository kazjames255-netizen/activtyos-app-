// Checks the hubshell namespace: keys used in code exist in en, all locales complete, placeholders match, no empties.
// Dynamic keys (hubshell.lbl_${..}, short_, su_mark_, ...) are covered by prefix; usePlural bases need their _one/_other set.
import fs from "fs"; import path from "path";
const root = process.cwd();
const files = [];
const walk = (p, deep = true) => { const s = fs.statSync(p); if (s.isDirectory()) { if (deep) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); } else if (/\.tsx?$/.test(p)) files.push(p); };
const L = "features/learninghub/";
["LearningHubApp.tsx","HubTabs.tsx","SubMenuCard.tsx","HubWelcomeSplash.tsx","panels.tsx","panelTypes.ts","kit.tsx","teachKit.tsx","mineKit.tsx","videoKit.tsx","speak.tsx","SupportSection.tsx","SubjectColourPicker.tsx","TopicFilter.tsx","TopicPicker.tsx","NewTopicInline.tsx","YearGroupPicker.tsx","StudentsPanel.tsx","GroupsSection.tsx","groupKit.tsx","groupStatus.ts","HubHero.tsx","HomePanel.tsx","hubLabel.ts","students","home","mark","../setup/SetupApp.tsx"].forEach((f) => walk(path.join(root, L + f)));
const used = new Set(), prefixes = new Set();
for (const f of files) { const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/["'`]hubshell\.([A-Za-z0-9_]+)(\$\{)?/g)) (m[2] ? prefixes : used).add(m[1]); }
const ts = (await import("typescript")).default; const cat = {};
for (const part of ["shell", "kit", "students", "home"]) {
  const src = fs.readFileSync(path.join(root, `lib/i18n/messages/areas/hubshell-parts/${part}.ts`), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} }; new Function("module", "exports", js)(m, m.exports);
  for (const [l, o] of Object.entries(m.exports.default)) { cat[l] ??= {}; for (const k of Object.keys(o)) if (k in cat[l]) console.log(`dup key across parts: ${part}.${k}`); Object.assign(cat[l], o); }
}
let bad = 0; const err = (m) => { bad++; console.log(m); };
const en = cat.en;
for (const k of used) if (!(k in en) && !(`${k}_other` in en)) err("used but missing in en: " + k);
const ph = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
for (const l of Object.keys(cat)) for (const k of Object.keys(en)) {
  if (!(k in cat[l])) { err(`${l} missing ${k}`); continue; }
  if (!cat[l][k].trim()) err(`${l} empty ${k}`);
  if (ph(cat[l][k]) !== ph(en[k]) && !/_(zero|one|two)$/.test(k)) err(`${l} placeholder mismatch ${k}`);
}
for (const k of Object.keys(en)) if (!used.has(k) && ![...prefixes].some((p) => k.startsWith(p)) && !/_(one|two|few|many|zero|other)$/.test(k)) console.log("unused (warn): " + k);
console.log(`keys=${Object.keys(en).length} used=${used.size} problems=${bad}`); process.exit(bad ? 1 : 0);
