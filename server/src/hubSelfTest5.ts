// P-11 privacy coverage self-test: FAILS if a Learning Hub collection is missing from the child-data manifest, or a
// child-keyed one is not wired into BOTH erase and export. No Firestore:
//   cd server && npx tsx src/hubSelfTest5.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import { HUB_COLLECTION_PRIVACY, HUB_RELATED_COLLECTIONS, eraseChildLearning, exportChildLearning } from "./lib/hubPrivacy";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const files = walk(join(__dirname)).filter((p) => !/hubSelfTest|hubLoadTest|e2eCleanup|hubPrivacy\.ts$/.test(p));
const used = new Set<string>();
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/collection\(\s*["'](hub[A-Za-z]+)["']\s*\)/g)) used.add(m[1]!);
const src = readFileSync(join(__dirname, "lib/hubPrivacy.ts"), "utf8");
const eraseSrc = src.slice(src.indexOf("export async function eraseChildLearning"));
const exportSrc = src.slice(src.indexOf("export async function exportChildLearning"), src.indexOf("export async function eraseChildLearning"));

console.log("child-data coverage");
t("every hub* collection used in server/src has a privacy decision", () => {
  const missing = [...used].filter((c) => !(c in HUB_COLLECTION_PRIVACY));
  assert.deepEqual(missing, [], `Add these to HUB_COLLECTION_PRIVACY (and erase/export if they hold child data): ${missing.join(", ")}`);
});
t("no stale manifest entries", () => {
  const stale = Object.keys(HUB_COLLECTION_PRIVACY).filter((c) => !used.has(c) && c !== "hubPings");
  assert.deepEqual(stale, []);
});
t("every child-keyed collection is erased", () => {
  const delList = /for \(const col of \[([^\]]*)\]\) await del/.exec(eraseSrc)?.[1] ?? "";
  const gaps = Object.entries(HUB_COLLECTION_PRIVACY).filter(([, v]) => v.how !== "none")
    // "delete" collections must be in the del() list; scrubbed/other ones must be touched by their own query.
    .filter(([c, v]) => (c === "hubToolStates" || v.how === "scrub" ? !eraseSrc.includes(`collection("${c}")`) : !delList.includes(`"${c}"`))).map(([c]) => c);
  assert.deepEqual(gaps, [], `not erased: ${gaps.join(", ")}`);
});
t("every child-keyed collection is exported", () => {
  const gaps = Object.entries(HUB_COLLECTION_PRIVACY).filter(([, v]) => v.how !== "none").map(([c]) => c).filter((c) => !exportSrc.includes(`"${c}"`));
  assert.deepEqual(gaps, [], `not exported: ${gaps.join(", ")}`);
});
t("related collections (images, notifications) and liveAnswers are handled", () => {
  for (const c of HUB_RELATED_COLLECTIONS) assert.ok(eraseSrc.includes(`"${c}"`), `${c} not erased`);
  assert.ok(eraseSrc.includes("liveAnswers.") && exportSrc.includes("liveAnswers"), "liveAnswers not covered");
});
t("exports are functions", () => { assert.equal(typeof eraseChildLearning, "function"); assert.equal(typeof exportChildLearning, "function"); });
console.log(`\n${n} passed`);
process.exit(0);
