// Copy a harness run's verdicts into the Testing page's results file.
//   node scripts/plan2/record.mjs /tmp/p2h_day6.json H "server/scripts/plan2/p2H_day6.mts"
import fs from "fs";
const [,, src, letter, evidence] = process.argv;
const file = `../lib/testing/agent-results/plan2-agent-${letter}.json`;
const cur = JSON.parse(fs.readFileSync(file, "utf8") || "{}");
const run = JSON.parse(fs.readFileSync(src, "utf8"));
const at = new Date().toISOString(); let n = 0;
for (const [id, r] of Object.entries(run.results)) { cur[id] = { verdict: r.verdict, method: r.method ?? "api", actual: r.actual, ...(r.notes ? { notes: r.notes } : {}), evidence: evidence || src, at, agent: `plan2-${letter}` }; n++; }
fs.writeFileSync(file, JSON.stringify(cur, null, 2) + "\n");
console.log(`recorded ${n} → ${file}`);
