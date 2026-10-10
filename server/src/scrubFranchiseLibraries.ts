// One-off: remove head office's private data from franchise Setup docs that were seeded as a FULL copy (before 10 Oct 2026, F12): bank details
// (sort code, account number, bank name, account name) and payroll administrators that are still identical to head office's, and stamp the
// `overrides` map so un-edited policies follow head office from now on (a policy that still differs from head office's is kept as the franchise's own).
//   DRY RUN by default (prints what it would change, writes nothing):   npx tsx src/scrubFranchiseLibraries.ts [tenantId]
//   Apply:                                                              npx tsx src/scrubFranchiseLibraries.ts [tenantId] --apply
// Not run against live by this change - Kaz runs it, dry run first. Idempotent. Refuses to --apply unless told which project via CONFIRM_PROJECT.
import { db } from "./firebase";
import { overridesOf, scrubSeededSettings } from "./lib/franchiseLibrary";

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
    const hoSettings = (hoByTenant.get(tenantId)?.settings ?? {}) as Record<string, unknown>;
    const before = (fr.settings ?? {}) as Record<string, unknown>;
    const after = scrubSeededSettings(before, hoSettings);
    const leaked = [
      ...(before.payrollAdmins !== undefined && after.payrollAdmins === undefined ? ["payrollAdmins"] : []),
      ...SECRET.filter((k) => (before.billing as Record<string, unknown> | undefined)?.[k] !== undefined && (after.billing as Record<string, unknown> | undefined)?.[k] === undefined).map((k) => `billing.${k}`),
    ];
    const needsOverrides = fr.overrides === undefined;
    if (!leaked.length && !needsOverrides) continue;
    touched++;
    console.log(`${apply ? "SCRUB" : "would scrub"} ${d.id}: ${leaked.join(", ") || "(no secrets)"}${needsOverrides ? `; overrides ${JSON.stringify(overridesOf(fr, hoSettings))}` : ""}`);
    if (apply) await d.ref.set({ ...fr, settings: after, overrides: fr.overrides ?? overridesOf(fr, hoSettings) });
  }
  console.log(`${apply ? "Changed" : "Would change"} ${touched} of ${scanned} franchise doc(s)${apply ? "" : " (dry run - pass --apply to write)"}.`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
