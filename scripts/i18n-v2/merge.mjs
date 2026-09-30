// Merge translated chunk files into public/v2/i18n/<lang>.json with validation.
//   node scripts/i18n-v2/merge.mjs <lang> <chunkDir> <outDir> [--dry]
// chunkDir has cNN.json (English source chunks), outDir/<lang>/cNN.json the translations. Missing keys fall back to English when --fill.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './convert.mjs';
const [lang, chunkDir, outDir] = process.argv.slice(2, 5);
const dry = process.argv.includes('--dry'), fill = process.argv.includes('--fill');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
const sig = (s) => (s.match(/<\/?\d+\/?>|<br\s*\/?>/g) || []).map((t) => (/^<br/.test(t) ? '<br>' : t.replace(/\s/g, ''))).sort().join('');
const res = {}; let problems = 0;
for (const cf of fs.readdirSync(chunkDir).filter((f) => /^c\d+\.json$/.test(f)).sort()) {
  const src = JSON.parse(fs.readFileSync(path.join(chunkDir, cf), 'utf8'));
  const tf = path.join(outDir, lang, cf);
  if (!fs.existsSync(tf)) { console.log(cf, 'NOT TRANSLATED YET'); problems += Object.keys(src).length; continue; }
  let tr; try { tr = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch (e) { console.log(cf, 'INVALID JSON:', e.message); problems++; continue; }
  for (const k of Object.keys(src)) {
    const v = tr[k];
    if (typeof v !== 'string' || !v.trim()) { console.log(cf, 'missing/empty', k); problems++; continue; }
    if (sig(v) !== sig(src[k])) { console.log(cf, 'TAG MISMATCH', k, '\n  EN:', src[k].slice(0, 200), '\n  ' + lang + ':', v.slice(0, 200)); problems++; continue; }
    if (src[k].includes('{brand}') !== v.includes('{brand}')) { console.log(cf, 'BRAND TOKEN', k); problems++; continue; }
    res[k] = v;
  }
  for (const k of Object.keys(tr)) if (!(k in src)) console.log(cf, 'unknown key', k);
}
console.log(lang, 'valid translations:', Object.keys(res).length, 'of', Object.keys(en).length, 'problems:', problems);
if (!dry) {
  const outj = {};
  for (const k of Object.keys(en)) { if (k in res) outj[k] = res[k]; else if (fill) outj[k] = en[k]; }
  fs.writeFileSync(path.join(ROOT, 'i18n', lang + '.json'), JSON.stringify(outj, null, 1) + '\n');
  console.log('wrote', lang + '.json', Object.keys(outj).length, 'keys');
}
