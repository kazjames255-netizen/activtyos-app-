// Delete throwaway "P2H …" worlds a crashed harness run left behind (tenants tagged _p2h + users with the p2h uid prefix).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/cleanup_orphans.mts
import { db, created, cleanup } from "./p2H_harness.mts";
const tenants = await db.collection("tenants").where("_p2h", ">", "").get();
for (const d of tenants.docs) created.tenants.push(d.id);
const users = await db.collection("users").where("__name__", ">=", db.collection("users").doc("p2h")).where("__name__", "<", db.collection("users").doc("p2i")).get();
for (const d of users.docs) { created.uids.push(d.id); const e = d.get("email"); if (e) created.emails.push(String(e)); }
console.log("orphans:", { tenants: created.tenants.length, users: created.uids.length });
if (created.tenants.length || created.uids.length) console.log("deleted", await cleanup());
process.exit(0);
