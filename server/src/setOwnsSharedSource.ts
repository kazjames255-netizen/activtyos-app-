// Learning Hub — mark the owner tenant(s) the shared curriculum library was promoted FROM, so their content is not merged with its own copy.
//   npx tsx src/setOwnsSharedSource.ts <tenantId>[,<tenantId>…]            (dry run: says what it would do, writes nothing)
//   npx tsx src/setOwnsSharedSource.ts <tenantId>[,…] --apply              (writes tenants/{id}.ownsSharedSource = true)
//   npx tsx src/setOwnsSharedSource.ts <tenantId>[,…] --clear --apply      (sets it back to false)
// This replaces the two tenant ids that used to be hardcoded in lib/hubCore.ts (OWNER_SOURCE_TENANT_IDS). It MUST be run for both owner
// tenants (against the live project, by the owner's go-ahead) in the same release that ships the flag, or those tenants would read every lesson,
// question and flashcard twice. Idempotent: a tenant that already has the value is reported and left alone. A tenant that does not exist is
// never created. The API caches the flag for up to ten minutes per process (restart, or wait, for it to take effect).
// To check afterwards: the tenant's lesson / question counts in the Teaching Hub should equal its own rows, not own + shared (double).
import { db } from "./firebase";

const ids = (process.argv[2] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const APPLY = process.argv.includes("--apply");
const VALUE = !process.argv.includes("--clear");
if (!ids.length || ids[0].startsWith("--")) { console.error("Usage: npx tsx src/setOwnsSharedSource.ts <tenantId>[,<tenantId>…] [--apply] [--clear]"); process.exit(1); }

(async () => {
  let changed = 0;
  for (const id of ids) {
    const ref = db.collection("tenants").doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`${id}: no such tenant - skipped`); continue; }
    const cur = snap.get("ownsSharedSource") === true;
    if (cur === VALUE) { console.log(`${id}: already ${VALUE} - nothing to do`); continue; }
    console.log(`${id}: ownsSharedSource ${cur} -> ${VALUE}${APPLY ? "" : " (dry run, pass --apply to write)"}`);
    if (APPLY) { await ref.set({ ownsSharedSource: VALUE }, { merge: true }); changed++; }
  }
  console.log(`${APPLY ? "updated" : "would update"} ${APPLY ? changed : "the tenants above"}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
