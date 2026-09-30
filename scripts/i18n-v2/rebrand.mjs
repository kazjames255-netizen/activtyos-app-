// Rename the product everywhere on the marketing site in one go.   node scripts/i18n-v2/rebrand.mjs NewName [--dry]
//  - BRAND + HTML_BRAND constants in public/v2/i18n.js (dictionaries use the {brand} token, so every translation follows)
//  - the literal English brand in public/v2/*.html (capitalised "Activly" only; file names/URLs like activly.html are untouched)
//  - the two-tone wordmarks  Activ<span class="os">ly</span>  and the SVG  Activ<tspan>ly</tspan>  become the plain new name
//    (re-style the logo by hand if the new name should keep a two-tone look)
// Then rebuilds en.json. Review with git diff before committing.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGES } from './convert.mjs';
const name = process.argv[2]; const dry = process.argv.includes('--dry');
if (!name || name.startsWith('--')) { console.error('usage: rebrand.mjs NewName'); process.exit(1); }
const OLD = (fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8').match(/var HTML_BRAND = '([^']+)'/) || [])[1] || 'Activly';
let n = 0;
for (const p of PAGES) {
  const f = path.join(ROOT, p + '.html'); let s = fs.readFileSync(f, 'utf8'); const before = s;
  s = s.replace(/Activ<span class="os">ly<\/span>/g, name).replace(/Activ<tspan[^>]*>ly<\/tspan>/g, name);
  s = s.split(OLD).join(name);
  if (s !== before) { n++; if (!dry) fs.writeFileSync(f, s); }
}
let js = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
js = js.replace(/var BRAND = '[^']*'/, `var BRAND = '${name}'`).replace(/var HTML_BRAND = '[^']*'/, `var HTML_BRAND = '${name}'`);
if (!dry) fs.writeFileSync(path.join(ROOT, 'i18n.js'), js);
console.log(`rebranded ${OLD} -> ${name} in ${n} pages${dry ? ' (dry run)' : ''}. Now run: node scripts/i18n-v2/convert.mjs && node scripts/i18n-v2/check.mjs`);
