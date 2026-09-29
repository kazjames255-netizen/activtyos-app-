// Live proof for docs/amir-backend-outstanding.md item 43: a listing whose
// every dated run (block) has ended never flips out of "live" on its own,
// so counts/exports/HQ analytics keep treating it as current forever.
//
// Seeds three real listings under one throwaway tenant, directly via the
// Admin SDK (same convention as childLeakTest.mts):
//   A — one block, endDate in the past          -> should flip to "ended"
//   B — one block, endDate in the future         -> should stay "live"
//   C — no blocks at all (never scheduled)       -> should stay "live"
//       (a listing with nothing scheduled yet is "not published", not "expired")
// Then calls the real exported listingAutoExpire() sweep function directly
// (not through the scheduler's claimSweep lock — that's just an
// exactly-once-across-instances guard, irrelevant to correctness here) and
// re-reads all three listings afterward.
//
// Run against a live Firestore project (server/.env or .env must point at
// one — no separate API server needs to be running, this calls Firestore
// directly via the Admin SDK):
//   cd server && node_modules/.bin/tsx src/listingAutoExpireTest.mts

import "dotenv/config";
import { db } from "./firebase";
import { listingAutoExpire } from "./lib/sweeps";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`, JSON.stringify(detail ?? "").slice(0, 500));
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  const tenantId = `t43test_${stamp}`;
  await db.collection("tenants").doc(tenantId).set({ name: "Listing Expire Test", createdAt: new Date().toISOString() });

  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const listingA = db.collection("listings").doc(`la_${stamp}`);
  const listingB = db.collection("listings").doc(`lb_${stamp}`);
  const listingC = db.collection("listings").doc(`lc_${stamp}`);
  await Promise.all([
    listingA.set({ tenantId, title: "A — all dates passed", status: "live", archived: false }),
    listingB.set({ tenantId, title: "B — still has a future date", status: "live", archived: false }),
    listingC.set({ tenantId, title: "C — never scheduled", status: "live", archived: false }),
  ]);
  await Promise.all([
    db.collection("blocks").doc(`blkA_${stamp}`).set({ tenantId, listingId: listingA.id, endDate: past, sessions: [] }),
    db.collection("blocks").doc(`blkB_${stamp}`).set({ tenantId, listingId: listingB.id, endDate: future, sessions: [] }),
    // C deliberately gets no block at all.
  ]);

  console.log(`Seeded tenant ${tenantId} (today=${today}), running listingAutoExpire()...`);
  await listingAutoExpire();

  const [a, b, c] = await Promise.all([listingA.get(), listingB.get(), listingC.get()]);
  check("A (all dates passed) flipped to ended", a.get("status") === "ended", { status: a.get("status") });
  check("B (future date) stayed live", b.get("status") === "live", { status: b.get("status") });
  check("C (never scheduled) stayed live", c.get("status") === "live", { status: c.get("status") });

  // Idempotency: a second run must not error and must not un-flip anything or double-fire the notify.
  await listingAutoExpire();
  const a2 = await listingA.get();
  check("A stays ended after a second run (idempotent)", a2.get("status") === "ended");

  const notif = await db.collection("notifications").where("tenantId", "==", tenantId).where("category", "==", "listing").get();
  check("exactly one 'listing ended' notification fired for A (fireOnce held across both runs)", notif.size === 1, { count: notif.size });

  // Cleanup — this test provisions its own throwaway tenant/listings/blocks, nothing shared.
  const cleanup = [listingA, listingB, listingC, db.collection("blocks").doc(`blkA_${stamp}`), db.collection("blocks").doc(`blkB_${stamp}`), db.collection("tenants").doc(tenantId), ...notif.docs.map((n) => n.ref)];
  await Promise.all(cleanup.map((r) => r.delete()));
  console.log("Cleaned up test tenant/listings/blocks/notifications.");

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
