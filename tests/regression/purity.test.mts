/** Guard: regression tests must stay pure. No test (or anything it imports) may reach Firestore/firebase.ts, which throws without credentials in CI. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const exts = ["", ".ts", ".tsx", ".mts", "/index.ts"];
const resolveImp = (from: string, spec: string) => exts.map((e) => resolve(dirname(from), spec + e)).find((p) => existsSync(p) && !p.endsWith(spec) || (existsSync(p) && /\.[mt]sx?$/.test(p)));

function walk(entry: string, seen = new Set<string>(), bad: string[] = []) {
  if (seen.has(entry)) return bad;
  seen.add(entry);
  const src = readFileSync(entry, "utf8");
  for (const m of src.matchAll(/(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g)) {
    const spec = m[1] ?? m[2];
    if (!spec.startsWith(".")) { if (/^firebase-admin|^stripe$/.test(spec)) bad.push(`${entry} -> ${spec}`); continue; }
    if (/(^|\/)firebase(\.ts)?$/.test(spec)) { bad.push(`${entry} -> ${spec}`); continue; }
    const p = resolveImp(entry, spec);
    if (p) walk(p, seen, bad);
  }
  return bad;
}

test("no regression test imports firebase.ts or firebase-admin, directly or transitively", () => {
  const files = readdirSync(here).filter((f) => f.endsWith(".test.mts") && f !== "purity.test.mts");
  assert.ok(files.length >= 1);
  const bad: string[] = [];
  for (const f of files) walk(join(here, f), new Set(), bad);
  assert.deepEqual(bad, []);
});
