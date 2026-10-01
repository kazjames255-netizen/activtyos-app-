// Second finder: English labels held in object properties / tuples (module-level tables, option lists, config objects), which find-english.mjs does not see.
//   node scripts/i18n/find-english-props.mjs [dir ...] [--show=file]
import fs from "node:fs"; import path from "node:path";
const args = process.argv.slice(2); const show = (args.find((a) => a.startsWith("--show=")) || "").slice(7); const dirs = args.filter((a) => !a.startsWith("--")); if (!dirs.length) dirs.push("app", "features", "components");
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next|testing|learninghub/.test(e.name)) walk(p, o); } else if (/\.tsx?$/.test(e.name) && !/generated|fixtures|\.d\.ts/.test(e.name)) o.push(p); } return o; };
const PROP = /\b(label|title|name|text|desc|description|hint|placeholder|heading|sub|subtitle|blurb|caption|tooltip|tip|summary|msg|message|empty|cta|help|note|body|lede)\s*:\s*(?:"([A-Z][A-Za-z][^"\\]{3,})"|'([A-Z][A-Za-z][^'\\]{3,})')/g;
const TUPLE = /\[\s*"[a-z0-9_:\-]{1,24}"\s*,\s*"([A-Z][A-Za-z][^"\\]{2,})"\s*\]/g;
export function scan(f) { const src = fs.readFileSync(f, "utf8"); const out = []; const lineOf = (i) => src.slice(0, i).split("\n").length; let m;
  for (const re of [PROP, TUPLE]) { re.lastIndex = 0; while ((m = re.exec(src))) { const s = m[2] ?? m[3] ?? m[1] ?? ""; const line = src.split("\n")[lineOf(m.index) - 1]; if (/\bt\(|\btr\(|tNow\(|hq\(|tx\(/.test(line.slice(Math.max(0, m.index - 0)))) { /* may be wrapped */ } if (/^[A-Z][A-Za-z0-9]*$/.test(s) && !/\s/.test(s) && s.length < 5) continue; if (/[{}=<>]|\bhttps?:|\.(png|jpg|svg|webp)\b/.test(s)) continue; out.push([lineOf(m.index), s.slice(0, 90)]); } } return out; }
if (process.argv[1].endsWith("find-english-props.mjs")) {
  if (show) for (const [l, s] of scan(show)) console.log(`${l}\t${s}`);
  else { const rows = []; for (const d of dirs) for (const f of walk(d)) { const r = scan(f); if (r.length) rows.push([r.length, f]); } rows.sort((a, b) => b[0] - a[0]); let t = 0; for (const [n, f] of rows.slice(0, 60)) console.log(`${n}\t${f}`); for (const [n] of rows) t += n; console.log(`TOTAL\t${t}\t${rows.length} files`); }
}
