// OPT-IN fix: rewrites `children` on customers of a tenant whose list has a joined name or duplicates
// (same cleaning as tools/childDuplicates.ts). DRY RUN unless --apply is passed.
// Run from the repo root:  server/node_modules/.bin/tsx server/tools/fixChildDuplicates.ts [tenantId] [--apply]
import { db } from "../src/firebase";
import { tidyChildren, type KidEntry } from "../src/lib/tidyChildren";
import { idNamesFor } from "./_childIdNames";

const APPLY = process.argv.includes("--apply");
const TENANT = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? process.env.TENANT_ID ?? "VOiiaTnDNd03MLbZaVcM";

(async () => {
  const snap = await db.collection("customers").where("tenantId", "==", TENANT).get();
  const idNames = await idNamesFor(snap.docs.map((d) => d.data()));
  let changed = 0;
  for (const d of snap.docs) {
    const before: KidEntry[] = Array.isArray(d.data().children) ? d.data().children : [];
    const after = tidyChildren(before, idNames);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changed++;
    console.log(`${APPLY ? "FIX " : "WOULD FIX "}${d.id}: ${before.map((k) => k.name).join(" | ")}  ->  ${after.map((k) => k.name).join(" | ")}`);
    if (APPLY) await d.ref.update({ children: after });
  }
  console.log(`\n${changed} of ${snap.size} customers ${APPLY ? "updated" : "would be updated (dry run — pass --apply to write)"}.`);
  process.exit(0);
})();
