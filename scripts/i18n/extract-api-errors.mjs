// Lists the English error messages the API returns to clients (res.status(n).json({ error: "..." })), as stable keys for lib/i18n/apiErrors.ts.
//   node scripts/i18n/extract-api-errors.mjs [--json] [--missing]    (--missing: only those not yet in p8api.ts)
import fs from "node:fs"; import path from "node:path";
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|scratch|dist/.test(e.name)) walk(p, o); } else if (/\.ts$/.test(e.name)) o.push(p); } return o; };
import { apiErrorKey } from "../../lib/i18n/apiErrorKey.ts";
export const slug = apiErrorKey;
export function extract() {
  const out = new Map();
  for (const f of walk("server/src")) {
    const src = fs.readFileSync(f, "utf8");
    const re = /error:\s*(?:"((?:[^"\\]|\\.)+)"|'((?:[^'\\]|\\.)+)'|`((?:[^`\\]|\\.)+)`)/g; let m;
    while ((m = re.exec(src))) {
      let s = m[1] ?? m[2] ?? m[3]; if (!s || s.length < 4 || !/[A-Za-z]{3}/.test(s)) continue;
      s = s.replace(/\\(["'`])/g, "$1").replace(/\\u2019/g, "’");
      let vars = 0; s = s.replace(/\$\{[^}]*\}/g, () => (vars++, "{v" + vars + "}"));
      if (/^[a-z_]+$/.test(s)) continue; // bare codes, not prose
      if (!out.has(s)) out.set(s, f);
    }
  }
  return out;
}
if (process.argv[1].endsWith("extract-api-errors.mjs")) { const r = extract(); if (process.argv.includes("--json")) console.log(JSON.stringify([...r.keys()], null, 1)); else { for (const [s, f] of r) console.log(`${slug(s)}\t${s}\t${f}`); console.log(r.size + " messages"); } }
