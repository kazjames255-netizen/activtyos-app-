// Run with tsx from server/: read or patch one hubEnrolments doc with the Admin SDK (the e2e can't move the server's clock, so a
// hand-set student's `yearAnchor` is backdated to simulate September rolling round).
//   npx tsx ../e2e/helpers/enrolmentDoc.ts <tenantId> <childId>                       → prints the doc as JSON
//   npx tsx ../e2e/helpers/enrolmentDoc.ts <tenantId> <childId> '{"yearAnchor":2024}' → merges the patch, then prints it
import { db } from "../../server/src/firebase";

const [tenantId, childId, patch] = process.argv.slice(2);
if (!tenantId || !childId) { console.error("usage: enrolmentDoc <tenantId> <childId> [jsonPatch]"); process.exit(2); }
(async () => {
  const ref = db.collection("hubEnrolments").doc(`${tenantId}__${childId}`);
  if (patch) await ref.update(JSON.parse(patch));
  console.log(JSON.stringify((await ref.get()).data() ?? null));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
