// Targeted cleanup for the day-14 harness run (server/scripts/plan2/p2H_day14.mts).
// Verified before writing this: the run's two throwaway tenants
// (nDM5b9d9sP0ArQZmNQBv "P2H Rob A", CSon5dMI76iuaQflMZE2 "P2H Rob HO") and
// all their tenant-scoped data (bookings/blocks/listings/customers/children/
// incidents/posts/notifications/memberships/expenseClaims/timeclock/
// registers/documents/docFiles/tasks/images/libraries) were ALREADY deleted —
// the harness's own generic cleanup() had in fact finished (checked via a
// read-only scan, no stray tenant-scoped docs found) even though the process
// looked hung and was killed. The one thing left behind: a single Firestore
// `users` doc this script created by hand (not through mkParent, so the
// harness's uid-tracking never saw it) for the real-inbox mail-arrival test
// (p2-r13) — role parent, name "Rob Real Parent", email is the allowlisted
// test address. Confirmed throwaway: uid follows the p2h-<test> naming
// convention used everywhere in this session's test scripts, isn't linked to
// any tenant/booking (all already gone), and isn't a real family.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/cleanup_day14.mts
import { db } from "../../src/firebase";

const TARGET_UID = "p2h-r13-parent";

const doc = await db.collection("users").doc(TARGET_UID).get();
if (!doc.exists) {
  console.log(`users/${TARGET_UID} already gone — nothing to do.`);
} else {
  const data = doc.data();
  console.log(`Deleting users/${TARGET_UID}:`, JSON.stringify(data));
  await doc.ref.delete();
  console.log("Deleted.");
}
process.exit(0);
