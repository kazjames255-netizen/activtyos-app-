// One-off: remove head office's private data from franchise Setup docs that were seeded as a FULL copy (before 10 Oct 2026, F12): bank details
// (sort code, account number, bank name, account name) and payroll administrators WHATEVER their value, plus copies of head office's venues and staff
// (matched by id / name), then stamp the doc (seedVersion 2) and its `overrides` map (a policy that differs from head office's is kept as the franchise's own).
// Note: a franchise's OWN bank details typed into a legacy doc are removed too (it can't be told apart from a copy); it re-enters them.
//   DRY RUN by default (prints what it would change, writes nothing):   npx tsx src/scrubFranchiseLibraries.ts [tenantId]
//   Apply:                                                              npx tsx src/scrubFranchiseLibraries.ts [tenantId] --apply
// Not run against live by this change - Kaz runs it, dry run first. Idempotent. Refuses to --apply unless told which project via CONFIRM_PROJECT.
import { db } from "./firebase";
import { scrubLegacyDoc } from "./lib/franchiseLibrary";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const only = args.find((a) => !a.startsWith("--"));
const SECRET = ["sortCode", "accountNumber", "bankName", "accountName"] as const;

async function run() {
  if (apply && process.env.CONFIRM_PROJECT !== (process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT)) {
    console.error("Refusing --apply: set CONFIRM_PROJECT to the project id you mean to change.");
    process.exit(2);
  }
  const snap = await db.collection("libraries").get();
  const hoByTenant = new Map(snap.docs.filter((d) => !d.id.includes("__fr__")).map((d) => [d.id, d.data()]));
  let touched = 0, scanned = 0;
  for (const d of snap.docs) {
    if (!d.id.includes("__fr__")) continue;
    const tenantId = d.id.split("__fr__")[0];
    if (only && tenantId !== only) continue;
    scanned++;
    const fr = d.data();
    if (fr.seedVersion === 2) continue; // already allow-list seeded / cleaned
    const clean = scrubLegacyDoc(fr, hoByTenant.get(tenantId));
    const bs = (fr.settings ?? {}) as Record<string, unknown>;
    const removed = [
      ...(bs.payrollAdmins !== undefined ? ["payrollAdmins"] : []),
      ...SECRET.filter((k) => (bs.billing as Record<string, unknown> | undefined)?.[k] !== undefined).map((k) => `billing.${k}`),
      ...(Array.isArray(fr.venues) && Array.isArray(clean.venues) && fr.venues.length !== clean.venues.length ? [`${fr.venues.length - clean.venues.length} copied venue(s)`] : []),
      ...(Array.isArray(fr.staff) && Array.isArray(clean.staff) && fr.staff.length !== clean.staff.length ? [`${fr.staff.length - clean.staff.length} copied staff`] : []),
    ];
    touched++;
    console.log(`${apply ? "SCRUB" : "would scrub"} ${d.id}: ${removed.join(", ") || "(nothing private found; stamping only)"}`);
    if (apply) await d.ref.set(clean);
  }
  console.log(`${apply ? "Changed" : "Would change"} ${touched} of ${scanned} franchise doc(s)${apply ? "" : " (dry run - pass --apply to write)"}.`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
