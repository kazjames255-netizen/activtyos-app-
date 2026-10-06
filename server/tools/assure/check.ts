// Run every invariant over real (test) tenants, read-only.
//   tsx server/tools/assure/check.ts <tenantId> [<tenantId> ...]      specific tenants
//   tsx server/tools/assure/check.ts --recent 40                       the 40 newest tenants that belong to @activityos-test.com accounts
// Tenants owned by a real account are skipped (takeSnapshot refuses them).
import { db } from "../../src/firebase";
import { takeSnapshot } from "./snapshot";
import { checkAll } from "./invariants";

(async () => {
  const args = process.argv.slice(2);
  let ids = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const ri = args.indexOf("--recent");
  if (ri >= 0) {
    const n = Number(args[ri + 1]) || 40;
    const snap = await db.collection("tenants").orderBy("createdAt", "desc").limit(n * 3).get();
    ids = snap.docs.map((d) => d.id);
  }
  const byRule = new Map<string, { n: number; sample: string[]; sev: string }>();
  let scanned = 0, skipped = 0, withData = 0;
  for (const id of ids) {
    let s;
    try { s = await takeSnapshot(id); } catch { skipped++; continue; }
    scanned++;
    if (!s.bookings.length) continue;
    withData++;
    for (const v of checkAll(s)) {
      const e = byRule.get(v.rule) ?? { n: 0, sample: [], sev: v.severity };
      e.n++; if (e.sample.length < 3) e.sample.push(`[${id}] ${v.message}`); byRule.set(v.rule, e);
    }
    if (ri >= 0 && withData >= (Number(args[ri + 1]) || 40)) break;
  }
  console.log(`scanned ${scanned} test tenants with data=${withData} (skipped ${skipped} real/unknown)`);
  if (!byRule.size) console.log("NO VIOLATIONS");
  for (const [rule, e] of [...byRule.entries()].sort((a, b) => b[1].n - a[1].n)) { console.log(`\n${e.sev.toUpperCase()}  ${rule}  x${e.n}`); for (const x of e.sample) console.log("   " + x); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
