// QA for the marketing-site dictionaries.   node scripts/i18n-v2/check.mjs [--strict]
//  - every data-i18n / data-i18n-attr key used in the HTML exists in en.json (and en.json == the literal English in the HTML)
//  - every <lang>.json has every key of en.json, identical indexed-tag structure (<n>, </n>, <n/>, <br>) and {brand} use
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGES, readHooks } from './convert.mjs';
import { parse } from './html.mjs';
const LANGS = ['ar', 'ur', 'pl', 'ro', 'cy', 'bn', 'pa', 'pt', 'es', 'fr'];
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
let bad = 0;
const hooks = {};
for (const p of PAGES) { const src = fs.readFileSync(path.join(ROOT, p + '.html'), 'utf8'); readHooks({ tree: parse(src) }, hooks, new Map()); }
for (const k of Object.keys(hooks)) { if (!(k in en)) { console.log('HTML key missing from en.json:', k); bad++; } else if (en[k] !== hooks[k]) { console.log('en.json differs from HTML for', k); bad++; } }
const sig = (s) => (s.match(/<\/?\d+\/?>|<br\s*\/?>/g) || []).map((t) => (/^<br/.test(t) ? '<br>' : t.replace(/\s/g, ''))).sort().join('');
const out = {};
for (const l of LANGS) {
  const f = path.join(ROOT, 'i18n', l + '.json'); if (!fs.existsSync(f)) { out[l] = 'no file'; continue; }
  const d = JSON.parse(fs.readFileSync(f, 'utf8')); let missing = 0, tok = 0, brand = 0, same = 0, empty = 0;
  for (const k of Object.keys(en)) {
    const v = d[k];
    if (v == null) { missing++; if (process.argv.includes('-v')) console.log(l, 'missing', k); continue; }
    if (v === '') { empty++; continue; }
    if (sig(v) !== sig(en[k])) { tok++; console.log(l, 'TOKEN MISMATCH', k, '\n  en:', en[k].slice(0, 160), '\n  ' + l + ':', v.slice(0, 160)); }
    if (en[k].includes('{brand}') !== v.includes('{brand}')) { brand++; console.log(l, 'BRAND', k); }
    if (v === en[k]) same++;
  }
  const extra = Object.keys(d).filter((k) => !(k in en)).length;
  out[l] = { keys: Object.keys(d).length, missing, tokenMismatch: tok, brandMismatch: brand, empty, identicalToEnglish: same, extra };
  bad += tok + brand;
}
console.table(out);
console.log('en keys:', Object.keys(en).length);
process.exit(bad && process.argv.includes('--strict') ? 1 : 0);
