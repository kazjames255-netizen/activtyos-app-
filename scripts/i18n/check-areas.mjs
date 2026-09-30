// Area catalogue checker (overnight i18n sweep).  server/node_modules/.bin/tsx scripts/i18n/check-areas.mjs [p8set p8em ...]   (default: every p8* area)
// For each area: (1) every locale has every English key, (2) {placeholder} sets match English in every locale, (3) no empty strings,
// (4) non-Latin locales (ur pa bn ar) holding an English sentence (same as en, 3+ words), (5) keys referenced in code but missing ("t('p8x.key')"),
// (6) keys defined but never referenced (only reported; dynamic template keys make this advisory).
import fs from "node:fs"; import path from "node:path";
const dir = "lib/i18n/messages/areas";
const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const names = want.length ? want : fs.readdirSync(dir).filter((f) => /^p8.*\.ts$/.test(f)).map((f) => f.replace(/\.ts$/, ""));
const LOC = ["pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]; const NONLAT = new Set(["ur", "pa", "bn", "ar"]);
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next|\.git|test-results|playwright-report/.test(e.name)) walk(p, o); } else if (/\.(tsx?|mjs)$/.test(e.name)) o.push(p); } return o; };
const files = ["app", "components", "features", "lib", "scripts"].filter(fs.existsSync).flatMap((d) => walk(d)).filter((f) => !f.startsWith("lib/i18n/messages"));
const code = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const ph = (s) => [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g) || [])].sort().join(",");
let bad = 0;
for (const n of names) {
  const mod = (await import(path.resolve(dir, n + ".ts"))).default; const en = mod.en; const keys = Object.keys(en); const probs = [];
  for (const l of LOC) for (const k of keys) {
    const v = mod[l]?.[k];
    if (v === undefined) { probs.push(`missing ${l}.${k}`); continue; }
    if (!String(v).trim()) probs.push(`empty ${l}.${k}`);
    if (ph(v) !== ph(en[k])) probs.push(`placeholders ${l}.${k}: en[${ph(en[k])}] vs [${ph(v)}]`);
    if (NONLAT.has(l) && v === en[k] && en[k].replace(/\{[^}]+\}/g, "").split(/\s+/).filter((w) => /[A-Za-z]{4,}/.test(w)).length >= 1 && !/^[A-Z0-9 .,£%&/+–—-]+$/.test(en[k])) probs.push(`english-in-${l}.${k}: ${en[k].slice(0, 50)}`);
  }
  const re = new RegExp(`["'\`]${n}\\.([A-Za-z0-9_]+)`, "g"); const used = new Set(); let m; while ((m = re.exec(code))) used.add(m[1]);
  const missingRef = [...used].filter((k) => !(k in en)); const unused = keys.filter((k) => !used.has(k));
  console.log(`${n}: ${keys.length} keys, ${probs.length} problems, ${missingRef.length} referenced-but-undefined, ${unused.length} unreferenced (advisory)`);
  for (const p of probs.slice(0, 30)) console.log("  ! " + p); for (const k of missingRef.slice(0, 30)) console.log("  ? undefined key " + n + "." + k);
  if (process.argv.includes("--unused")) for (const k of unused) console.log("  - unused " + k);
  bad += probs.length + missingRef.length;
}
process.exit(bad ? 1 : 0);
