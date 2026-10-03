// READ-ONLY audit: customers of a tenant whose `children` array has a joined name ("A, B") or duplicates,
// and what the cleaned array would be. Prints only; never writes.
// Run from the repo root:  server/node_modules/.bin/tsx server/tools/childDuplicates.ts [tenantId]
import { db } from "../src/firebase";
import { tidyChildren, type KidEntry } from "../src/lib/tidyChildren";
import { idNamesFor } from "./_childIdNames";

const TENANT = process.argv[2] ?? process.env.TENANT_ID ?? "VOiiaTnDNd03MLbZaVcM"; // Amir Coaching
const show = (k: KidEntry[]) => k.map((c) => `${c.name}${c.childId ? ` [${c.childId}]` : ""}${c.dob ? ` (${c.dob})` : ""}`).join(" | ");

(async () => {
  const snap = await db.collection("customers").where("tenantId", "==", TENANT).get();
  const idNames = await idNamesFor(snap.docs.map((d) => d.data()));
  let bad = 0;
  for (const d of snap.docs) {
    const c = d.data() as { name?: string; email?: string; children?: KidEntry[] };
    const before = Array.isArray(c.children) ? c.children : [];
    const after = tidyChildren(before, idNames);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    bad++;
    console.log(`\n${d.id}  ${c.name ?? ""} <${c.email ?? ""}>`);
    console.log(`  now  (${before.length}): ${show(before)}`);
    console.log(`  tidy (${after.length}): ${show(after)}`);
  }
  console.log(`\n${bad} of ${snap.size} customers in ${TENANT} would change. (read-only, nothing written)`);
  process.exit(0);
})();
