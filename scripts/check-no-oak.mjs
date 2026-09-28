#!/usr/bin/env node
// PERMANENT GUARD (owner rule): the publisher's name must never be user-visible. Fails on any /\boak\b/i in
// app/ features/ lib/ components/ public/ that is not (a) a comment, or (b) an allowlisted INTERNAL identifier.
//   node scripts/check-no-oak.mjs [--list]
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "features", "lib", "components", "public"];
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".svg", ".css", ".txt", ".md", ".yaml", ".yml"]);
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SKIP_FILES = [/^lib\/testing\/agent-results\//]; // internal QA transcripts, never served
// Internal identifiers that are allowed to contain the word (never rendered): import paths, test ids, DB id prefixes, data keys.
const ALLOW = [
  /(?:from|import\()\s*["'][^"']*\/oak\/[^"']*["']/,          // import "…/server/src/oak/…"
  /data-testid=["'{`][^"'`]*oak-[^"'`]*["'}`]/, /getByTestId\(["'`]oak-/,
  /["']oak-q-[\w-]+["']/,                                   // question-id keys
  /["'`]oak-(?:<|\$\{|[A-Za-z0-9]{6,})/,                       // doc id prefixes  oak-<tenant>-…
  /\(curr\|oak\)|\$1-/,                                        // id normaliser regex
  /["']v-oak["']/,                                             // tour fixture venue id
  /provider\s*[=!]==?\s*["']oak["']|provider:\s*["']oak["']/,  // provenance flag
];
const list = process.argv.includes("--list");
const hits = [];
function stripComment(line, state) {
  // crude: drop block comments and // tails (not inside URLs "://")
  let l = line;
  if (state.block) { const e = l.indexOf("*/"); if (e < 0) return ""; l = l.slice(e + 2); state.block = false; }
  for (;;) { const s = l.indexOf("/*"); if (s < 0) break; const e = l.indexOf("*/", s + 2); if (e < 0) { l = l.slice(0, s); state.block = true; break; } l = l.slice(0, s) + l.slice(e + 2); }
  l = l.replace(/(^|[^:"'`\w])\/\/.*$/, "$1");
  return l;
}
function scan(file) {
  const rel = file.split(path.sep).join("/");
  if (SKIP_FILES.some((r) => r.test(rel))) return;
  const ext = path.extname(file);
  if (!EXT.has(ext)) { if (/oak/i.test(path.basename(file))) hits.push({ rel, n: 0, text: "(file NAME contains the word — shown in downloads/URLs)" }); return; }
  const raw = fs.readFileSync(file, "utf8");
  const code = ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".mjs";
  const st = { block: false };
  raw.split("\n").forEach((line, i) => {
    const l = code ? stripComment(line, st) : line;
    if (!/\boak\b/i.test(l)) return;
    if (ALLOW.some((r) => r.test(l))) { const rest = ALLOW.reduce((a, r) => a.replace(new RegExp(r.source, "g" + (r.flags.includes("i") ? "i" : "")), " "), l); if (!/\boak\b/i.test(rest)) return; }
    hits.push({ rel, n: i + 1, text: line.trim().slice(0, 160) });
  });
}
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (SKIP_DIRS.has(e.name)) continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p) : scan(p); } }
for (const r of ROOTS) if (fs.existsSync(r)) walk(r);
if (hits.length) { console.error(`check-no-oak: ${hits.length} user-visible hit(s)`); for (const h of hits.slice(0, list ? 1e9 : 60)) console.error(`  ${h.rel}:${h.n}  ${h.text}`); process.exit(1); }
console.log("check-no-oak: clean");
