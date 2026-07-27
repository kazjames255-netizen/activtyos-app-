// Delete every e2e throwaway account (*@activityos-test.com) and all data it
// owns — auth user, users doc, owned tenants, libraries doc, and every
// tenant-scoped doc — per the repo's verification convention. Safe to run any
// time; it only ever touches the test-email domain.
//
//   npm --prefix server run e2e-cleanup
//
// With --data-only the accounts, tenants and library docs survive and only the
// data they own (bookings, listings, children, threads…) is wiped. The e2e
// global setup runs this before every suite run so tests start on clean pages —
// stale rows from earlier runs are how weak assertions false-pass.
import "dotenv/config";
import { auth, db } from "./firebase";

const DOMAIN = "@activityos-test.com";
const DATA_ONLY = process.argv.includes("--data-only");

// Every collection whose docs carry a tenantId field (from a grep of
// server/src). recursiveDelete also clears subcollections (childFiles chunks).
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
  "notifications", "schedulerFired",
  "calendarEvents", "inventory",
];

// Collections owned by a USER (parents have no tenant): field → collection.
const USER_SCOPED: [collection: string, field: string][] = [
  ["children", "parentUid"],
  ["childFiles", "ownerUid"],
  ["threads", "parentUid"],
  ["referrals", "referrerUid"],
];

async function deleteSnap(label: string, docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  if (!docs.length) return;
  await Promise.all(docs.map((d) => db.recursiveDelete(d.ref)));
  console.log(`  ${label}: ${docs.length} deleted`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  // 1. Find all test auth users.
  const users: { uid: string; email: string }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.email?.endsWith(DOMAIN)) users.push({ uid: u.uid, email: u.email });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`${users.length} test auth users`);
  const uids = users.map((u) => u.uid);

  // 2. Collect the tenants they own or belong to.
  const tenantIds = new Set<string>();
  for (const uid of uids) {
    const doc = await db.collection("users").doc(uid).get();
    const tid = doc.data()?.tenantId as string | undefined;
    if (tid) tenantIds.add(tid);
  }
  for (const uidChunk of chunk(uids, 10)) {
    if (!uidChunk.length) continue;
    const owned = await db.collection("tenants").where("ownerUid", "in", uidChunk).get();
    owned.docs.forEach((d) => tenantIds.add(d.id));
  }
  // Only tenants actually owned by a test account are deleted — a test staff
  // account invited onto a REAL tenant must not nuke that tenant.
  const deletableTenants: string[] = [];
  for (const tid of tenantIds) {
    const t = await db.collection("tenants").doc(tid).get();
    if (!t.exists) continue;
    const ownerUid = t.data()!.ownerUid as string | undefined;
    if (ownerUid && uids.includes(ownerUid)) deletableTenants.push(tid);
  }
  console.log(`${deletableTenants.length} test tenants: ${deletableTenants.join(", ") || "—"}`);

  // 3. Tenant-scoped data.
  for (const tid of deletableTenants) {
    console.log(`tenant ${tid}:`);
    for (const col of TENANT_SCOPED) {
      const snap = await db.collection(col).where("tenantId", "==", tid).get();
      await deleteSnap(col, snap.docs);
    }
    if (!DATA_ONLY) {
      await db.recursiveDelete(db.collection("libraries").doc(tid));
      await db.recursiveDelete(db.collection("tenants").doc(tid));
      console.log(`  tenant + libraries doc deleted`);
    }
  }

  // 4. User-scoped data (parents' children etc.).
  for (const [col, field] of USER_SCOPED) {
    for (const uidChunk of chunk(uids, 10)) {
      if (!uidChunk.length) continue;
      const snap = await db.collection(col).where(field, "in", uidChunk).get();
      await deleteSnap(`${col} (${field})`, snap.docs);
    }
  }

  // 4b. Docs keyed by the account's EMAIL rather than a uid or tenant.
  for (const u of users) {
    const em = u.email.toLowerCase();
    await db.collection("notificationPrefs").doc(em).delete();
    for (const col of ["wallet", "walletEntries", "notifications"]) {
      const snap = await db.collection(col).where("email", "==", em).get();
      await deleteSnap(`${col} (${em})`, snap.docs);
    }
  }

  // 5. users docs + auth accounts (kept in --data-only mode).
  if (!DATA_ONLY) {
    for (const uid of uids) await db.recursiveDelete(db.collection("users").doc(uid));
    for (const uidChunk of chunk(uids, 1000)) {
      if (!uidChunk.length) continue;
      const res = await auth.deleteUsers(uidChunk);
      console.log(`auth users deleted: ${res.successCount}, failed: ${res.failureCount}`);
    }
  }
  console.log("done");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
