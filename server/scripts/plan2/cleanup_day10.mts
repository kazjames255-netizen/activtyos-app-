// One-off manual cleanup for the day-10 harness run that hung in its own
// cleanup() (db.listCollections() + 9 field-queries per collection is slow
// against this project's full collection list). Targeted delete instead:
// known tenant ids (from the run's logged `world`) + the run's uid prefix.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/cleanup_day10.mts
import { db } from "../../src/firebase";

const TENANTS = ["qE3ad0XvSVgUIUTN462r", "Z40P5pFgrT8TWqGwO623", "za1CVx886b1HNFpHcNv4"];
const RUN_PREFIX = "p2hmu1i3x2f-";

const TENANT_SCOPED = [
  "bookings", "blocks", "listings", "customers", "children", "payments",
  "discountCodes", "threads", "periods", "messages", "blockBundles",
  "referrals", "passes", "mealOrders", "discountRedemptions", "timetables",
  "ratioGroups", "ratioBoards", "posts", "moments", "medications",
  "mealOptions", "trips", "tasks", "shifts", "registers", "purchaseOrders",
  "menus", "medicationAdmin", "invoices", "invites", "incidents", "expenses",
  "emails", "documents", "deletionRequests", "certifications",
  "supportMessages", "messageTemplates", "messageFolders", "images",
  "customerGroups", "childFiles", "broadcasts", "wallet", "walletEntries",
  "notifications", "schedulerFired", "calendarEvents", "inventory",
  "emailMessages", "scheduledEmails", "emailSuppressions", "suppliers",
  "expenseClaims", "income", "memberships", "leave", "leaveRequests", "availabilityRequests",
  "timeclock", "payrollRuns", "appraisals", "locationStaff", "franchises", "ratios",
  "mealMenus", "libraries",
];

async function del(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  for (let i = 0; i < docs.length; i += 400) {
    const b = db.batch();
    docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  return docs.length;
}

let n = 0;
for (const col of TENANT_SCOPED) {
  for (let i = 0; i < TENANTS.length; i += 10) {
    const chunk = TENANTS.slice(i, i + 10);
    try { n += await del((await db.collection(col).where("tenantId", "in", chunk).get()).docs); } catch (e) { console.warn(col, (e as Error).message); }
  }
}
// franchise-lib docs use `${tenantId}__fr__${franchiseId}` ids
for (const lib of await db.collection("libraries").listDocuments()) {
  if (TENANTS.some((t) => lib.id === t || lib.id.startsWith(`${t}__fr__`))) { await db.recursiveDelete(lib); n++; }
}
for (const t of TENANTS) { await db.recursiveDelete(db.collection("tenants").doc(t)); n++; }

// users/uids created under this run's prefix (owners, staff, franchise, parents, HQ)
const usersSnap = await db.collection("users").get();
const userDocs = usersSnap.docs.filter((d) => d.id.startsWith(RUN_PREFIX));
n += await del(userDocs);

// children/threads/wallets keyed by parentUid rather than tenantId
for (const [col, field] of [["children", "parentUid"], ["childFiles", "ownerUid"], ["threads", "parentUid"], ["referrals", "referrerUid"], ["notifications", "uid"], ["wallets", "uid"]] as const) {
  const uids = userDocs.map((d) => d.id);
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    if (!chunk.length) continue;
    try { n += await del((await db.collection(col).where(field, "in", chunk).get()).docs); } catch { /* */ }
  }
}

console.log("deleted", n, "docs");
process.exit(0);
