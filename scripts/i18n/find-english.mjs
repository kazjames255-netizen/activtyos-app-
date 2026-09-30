// Heuristic finder of hard-coded user-facing English in TSX (JSX text, placeholder/title/aria-label/alt/label attrs, toast/alert/confirm strings).
// usage: node scripts/i18n/find-english.mjs [--files] [--show=path] [dir ...]
import fs from "node:fs"; import path from "node:path";
const args = process.argv.slice(2);
const show = (args.find((a) => a.startsWith("--show=")) || "").slice(7);
const dirs = args.filter((a) => !a.startsWith("--")); if (!dirs.length) dirs.push("app", "features", "components");
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next|testing/.test(e.name)) walk(p, o); } else if (/\.tsx$/.test(e.name)) o.push(p); } return o; };
const WORD = /[A-Za-z]{3,}/;
const okText = (s) => { s = s.replace(/\s+/g, " ").trim(); if (!s || !WORD.test(s)) return false; if (/^[\w.\-/:#@?=&%]+$/.test(s) && !/\s/.test(s) && !/^[A-Z][a-z]+$/.test(s)) return false; if (/[{};=]|=>|\bconst\b|\breturn\b/.test(s)) return false; return true; };
export function scan(file) {
  const src = fs.readFileSync(file, "utf8"); const out = [];
  const lineOf = (i) => src.slice(0, i).split("\n").length;
  let m;
  const jsx = />([^<>{}\n][^<>{}]*)</g;
  while ((m = jsx.exec(src))) { const s = m[1]; if (okText(s) && !/^\s*[-•·|/—–:]+\s*$/.test(s)) out.push([lineOf(m.index), "jsx", s.replace(/\s+/g, " ").trim()]); }
  const jsxb = />\s*\n\s*([A-Z][^<>{}\n]{2,})\n/g;
  while ((m = jsxb.exec(src))) if (okText(m[1])) out.push([lineOf(m.index), "jsx", m[1].trim()]);
  const attr = /\b(placeholder|title|aria-label|alt|label|description|hint|subtitle|heading|emptyText|text)=(?:"([^"]+)"|\{"([^"]+)"\}|\{`([^`]+)`\})/g;
  while ((m = attr.exec(src))) { const s = m[2] ?? m[3] ?? m[4]; if (okText(s) && /[A-Za-z]{3,}.*\s|^[A-Z][a-z]{3,}/.test(s)) out.push([lineOf(m.index), "attr", s]); }
  const call = /\b(toast|alert|confirm|setErr|setError|setMsg|setNote|setToast|notify|flash|throw new Error)\w*\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  while ((m = call.exec(src))) { const s = m[2] ?? m[3] ?? m[4]; if (okText(s)) out.push([lineOf(m.index), "call", s]); }
  return out;
}
if (process.argv[1].endsWith("find-english.mjs")) {
  if (show) { for (const [l, k, s] of scan(show)) console.log(`${l}\t${k}\t${s}`); }
  else { const rows = []; for (const d of dirs) for (const f of walk(d)) { const r = scan(f); if (r.length) rows.push([r.length, f]); } rows.sort((a, b) => b[0] - a[0]); let tot = 0; for (const [n, f] of rows) { tot += n; console.log(`${n}\t${f}`); } console.log(`TOTAL\t${tot}\t${rows.length} files`); }
}
