// node env-names-exist.mjs <doc> [--min N] : every `UPPER_SNAKE` token in backticks in the doc must appear in the codebase (catches invented variable names).
import { join } from "node:path";
import { ROOT, read, fail, gitGrepHas, pathExists } from "./_lib.mjs";
const file = process.argv[2]; const mi = process.argv.indexOf("--min"); const min = mi > 0 ? Number(process.argv[mi + 1]) : 1;
if (!file || !pathExists(file)) fail("doc missing: " + file);
const names = [...new Set([...read(join(ROOT, file)).matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]))];
const unknown = names.filter((n) => !gitGrepHas(n));
if (unknown.length) fail("variable names not found in the code: " + unknown.join(", "));
if (names.length < min) fail(`only ${names.length} variable names documented, need ${min}`);
console.log(`env names verified (${names.length})`);
