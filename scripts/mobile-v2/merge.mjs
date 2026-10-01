// node merge.mjs out.json a.json b.json ...
import fs from 'fs';
const [out, ...ins] = process.argv.slice(2);
const m = {};
for (const f of ins) Object.assign(m, JSON.parse(fs.readFileSync(f)));
fs.writeFileSync(out, JSON.stringify(m));
console.log(Object.keys(m).length, 'entries');
