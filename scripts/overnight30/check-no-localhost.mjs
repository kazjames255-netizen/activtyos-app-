// node check-no-localhost.mjs <files...> | --selftest : code (non-comment) lines must not contain the literal "localhost".
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, read, fail, pathExists } from "./_lib.mjs";
const codeHits = (text) => text.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => /localhost/.test(l) && !/^\s*(\/\/|\*|\/\*|#)/.test(l));
if (process.argv[2] === "--selftest") {
  const d = mkdtempSync(join(tmpdir(), "nl-")); const f = join(d, "bad.ts"); const g = join(d, "ok.ts");
  writeFileSync(f, 'const a = process.env.WEB_URL || "http://localhost:3000";\n'); writeFileSync(g, "// dev uses localhost\nconst a = process.env.WEB_URL ?? '';\n");
  if (codeHits(read(f)).length !== 1 || codeHits(read(g)).length !== 0) fail("selftest");
  console.log("check-no-localhost selftest passed");
} else {
  const files = process.argv.slice(2); if (!files.length) fail("no files given");
  const bad = [];
  for (const f of files) { if (!pathExists(f)) { bad.push("missing " + f); continue; } for (const [n, l] of codeHits(read(join(ROOT, f)))) bad.push(`${f}:${n}: ${l.trim().slice(0, 90)}`); }
  if (bad.length) fail(bad.join("\n"));
  console.log(`no localhost defaults in ${files.length} files`);
}
