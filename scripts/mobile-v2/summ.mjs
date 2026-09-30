// node summ.mjs <json> [vpfilter]  -> per page x viewport counts
import fs from 'fs';
const r = JSON.parse(fs.readFileSync(process.argv[2]));
const vf = process.argv[3] ? process.argv[3].split(',') : null;
const rows = {};
for (const [k, v] of Object.entries(r)) {
  const [p, vp] = k.split('|'); if (vf && !vf.includes(vp)) continue;
  rows[p] ??= {};
  rows[p][vp] = v.error ? 'ERR' : `${v.overflowX > 0 ? 'OVF' + v.overflowX + ' ' : ''}w${v.wide.length} s${v.smallText} t${v.tap} i${v.inputSmall}`;
}
console.table(rows);
