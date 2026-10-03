// Progress through the whole catalogue, using the same rule as the Test tracker page. Read-only.
//   server/node_modules/.bin/tsx scripts/testTracker/progress.ts
import { db } from "../../server/src/firebase";
import { CATALOGUE } from "../../lib/testTracker/catalogue";

(async () => {
  const res = new Map((await db.collection("testTrackerResults").get()).docs.map((d) => [d.id, d.data() as Record<string, any>]));
  let pass = 0, fail = 0, part = 0, todo = 0, ticks = 0, slots = 0;
  const failing: string[] = [], parts: string[] = [];
  for (const c of CATALOGUE) {
    const accts = c.accounts.filter((a) => a !== "platform");
    const by = (res.get(c.id)?.byAccount ?? {}) as Record<string, string>;
    const passed = accts.filter((a) => by[a] === "pass" || by[a] === "na").length;
    slots += accts.length; ticks += passed;
    const anyFail = accts.some((a) => by[a] === "fail") || res.get(c.id)?.status === "fail";
    if (anyFail) { fail++; failing.push(c.id); }
    else if (accts.length && passed === accts.length) pass++;
    else if (passed > 0) { part++; parts.push(c.id); }
    else todo++;
  }
  const n = CATALOGUE.length;
  console.log(`PROGRESS ${n} checks: fully passed ${pass} | part done ${part} | failed ${fail} | not started ${todo}`);
  console.log(`account ticks: ${ticks} of ${slots} (${Math.round((ticks / slots) * 1000) / 10}%) | fully passed = ${Math.round((pass / n) * 1000) / 10}% of checks`);
  console.log(`part done: ${parts.join(" ")}\nfailing: ${failing.join(" ")}`);
  process.exit(0);
})();
