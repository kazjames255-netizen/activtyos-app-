// Latin-script locales (pl ro pt es fr cy): catalogue entries IDENTICAL to English with 2+ words (stricter-looser complement of find-untranslated.mjs, which only flags sentences).
//   server/node_modules/.bin/tsx scripts/i18n/find-same-as-english.mts [--json=/tmp/out.json]   (run from the repo root)
import fs from "node:fs"; import path from "node:path";
const dir = "lib/i18n/messages/areas";
const LOC = ["pl", "ro", "pt", "es", "fr", "cy"]; const tot: Record<string, number> = {}; const out: any = {}; const keys: Record<string, string[]> = {};
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith(".ts")&&!/^hub/.test(x))) {
  const n=f.slice(0,-3); let m:any; try{ m=(await import(path.join(dir,f))).default;}catch{continue}
  const en=m?.en; if(!en) continue;
  for (const l of LOC){ const d=m[l]??{}; for (const [k,v] of Object.entries(en)) { if(typeof v!=="string") continue; if(d[k]===v && v.trim().split(/\s+/).length>=2 && v.replace(/\{[^}]+\}/g,"").replace(/[^A-Za-z ]/g,"").trim().length>=10 && /[a-z]{3}/.test(v)) { (out[l] ??= {})[n] = ((out[l] ??= {})[n] ?? 0) + 1; tot[l] = (tot[l] ?? 0) + 1; (keys[n + "." + k] ??= []).push(l); } } }
}
console.log(JSON.stringify(tot)); for (const l of LOC) console.log(l, JSON.stringify(out[l]));

if (process.argv.includes("--json")) fs.writeFileSync(process.argv.find((a) => a.startsWith("--json="))?.slice(7) ?? "/tmp/same-en.json", JSON.stringify(keys));
