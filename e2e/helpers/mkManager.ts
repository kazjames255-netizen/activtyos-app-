// Arrange helper: makes an EXISTING Firebase test user a second owner-tier (role "company") account on a test tenant, so specs can exercise
// segregation of duties (the creator of a pay run cannot approve it; a different manager can). Run from server/:
//   npx tsx ../e2e/helpers/mkManager.ts <uid> <email> <name> <tenantId>
// Refuses the two real tenants and any non-test email. The account (and its users doc) is removed by `npm run e2e:cleanup` like every
// other @activityos-test.com user.
import { db } from "../../server/src/firebase";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const [uid, email, name, tenantId] = process.argv.slice(2);
if (!uid || !email || !name || !tenantId) { console.error("usage: mkManager <uid> <email> <name> <tenantId>"); process.exit(2); }
if (REAL.has(tenantId) || !email.endsWith("@activityos-test.com")) { console.error("refusing: not a test tenant/email"); process.exit(4); }
(async () => {
  const t = await db.collection("tenants").doc(tenantId).get();
  if (!t.exists) { console.error("no such tenant"); process.exit(3); }
  await db.collection("users").doc(uid).set({ email, name, role: "company", tenantId, franchiseId: null, e2e: true }, { merge: true });
  process.stdout.write("ok\n");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
