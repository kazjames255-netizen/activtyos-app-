// Regression test for docs/amir-backend-outstanding.md item 65: a real
// cross-tenant child-data leak in server/src/routes/customers.ts.
//
// Proves the exact scenario from the write-up: a parent books with TWO
// different providers on the same email. Before the fix, EVERY child on
// that parent's global `children` roster (keyed only by parentUid) leaked
// into BOTH providers' Families views (GET /api/customers and
// GET /api/customers/:id/family), because the merge only checked
// parentUid, never whether the child had a real booking with the reading
// tenant. This proves the leak is closed AND that legitimate access (a
// child who really is booked with a tenant, including a since-cancelled
// booking) still works.
//
// Real accounts/tenants are provisioned through the live API (so the auth +
// tenant plumbing is real); the booking/children/customer DATA is seeded
// directly via the Admin SDK (bypassing the parent checkout's listing/block
// wizard, which is unrelated to what's under test here) — same "seed two
// fake tenants" instruction the dispatch gave, and the same *@activityos-test.com
// throwaway-account convention the e2e suite uses (npm run e2e-cleanup wipes
// it after).
//
// Run against the live dev API (must already be running, e.g. npm run dev:all):
//   cd server && node_modules/.bin/tsx src/childLeakTest.mts
// Cleanup: npm --prefix server run e2e-cleanup

import "dotenv/config";
import { db } from "./firebase";

const API = process.env.API_URL || "http://localhost:4000";
// Real project's web API key (public, client-side — same one lib/firebase/client.ts
// ships), used only to mint throwaway @activityos-test.com sessions.
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyBRuvgODaTPQPvbFNRQbVYn1yJKmJ6ugys";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`, JSON.stringify(detail ?? "").slice(0, 500));
  }
}

async function signUp(email: string): Promise<{ token: string; uid: string }> {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test1234!", returnSecureToken: true }),
    },
  );
  const d = (await r.json()) as { idToken?: string; localId?: string; error?: { message: string } };
  if (!d.idToken || !d.localId) throw new Error(`signUp failed for ${email}: ${d.error?.message}`);
  return { token: d.idToken, uid: d.localId };
}

async function api(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try { json = await r.json(); } catch { /* empty body */ }
  return { status: r.status, json };
}

const run = Date.now();
const em = (n: string) => `leak-${run}-${n}@activityos-test.com`;

console.log("Provisioning tenants A and B, and a parent…");
const ownerA = await signUp(em("owner-a"));
const ownerB = await signUp(em("owner-b"));
const parentEmail = em("parent");
const parent = await signUp(parentEmail);

const provA = await api(ownerA.token, "POST", "/api/register-role", { role: "company", businessName: `Leak Test A ${run}` });
const provB = await api(ownerB.token, "POST", "/api/register-role", { role: "freelancer", businessName: `Leak Test B ${run}` });
await api(parent.token, "POST", "/api/register-role", { role: "parent" });
check("tenant A provisioned", provA.status === 201, provA);
check("tenant B provisioned", provB.status === 201, provB);
const tenantA = (provA.json as { tenantId: string }).tenantId;
const tenantB = (provB.json as { tenantId: string }).tenantId;

console.log("\nSeeding: a parent with two children, one genuinely booked with each tenant…");
// The global, tenant-less roster (this is the collection with no tenant
// boundary at all — GET /api/my/children reads it the same way).
const kidLeak = await db.collection("children").add({ name: `Kid Leak ${run}`, age: 8, parentUid: parent.uid });
const kidOther = await db.collection("children").add({ name: `Kid Other ${run}`, age: 6, parentUid: parent.uid });

// A REAL booking linking Kid Leak to tenant A only (childId set, exactly as
// the parent checkout stamps it — server/src/routes/my.ts resolveChild()).
const bookARef = db.collection("bookings").doc(`${tenantA}_LEAK-A1`);
await bookARef.set({
  tenantId: tenantA, ref: "LEAK-A1", booker: "Leak Parent", email: parentEmail,
  child: `Kid Leak ${run}`, childId: kidLeak.id, age: 8, status: "Confirmed",
  listing: "A Camp", pass: "Day", amount: 10, pay: "Paid", method: "Card",
  createdAt: new Date().toISOString(),
});
// A REAL booking linking Kid Other to tenant B only.
const bookBRef = db.collection("bookings").doc(`${tenantB}_LEAK-B1`);
await bookBRef.set({
  tenantId: tenantB, ref: "LEAK-B1", booker: "Leak Parent", email: parentEmail,
  child: `Kid Other ${run}`, childId: kidOther.id, age: 6, status: "Confirmed",
  listing: "B Camp", pass: "Day", amount: 10, pay: "Paid", method: "Card",
  createdAt: new Date().toISOString(),
});
// The customer record each tenant would normally get from
// upsertCustomerFromBooking — same shape, written directly here since we
// skipped the checkout path.
const custARef = await db.collection("customers").add({
  tenantId: tenantA, name: "Leak Parent", email: parentEmail, uid: parent.uid,
  children: [{ name: `Kid Leak ${run}`, childId: kidLeak.id, age: 8 }],
});
const custBRef = await db.collection("customers").add({
  tenantId: tenantB, name: "Leak Parent", email: parentEmail, uid: parent.uid,
  children: [{ name: `Kid Other ${run}`, childId: kidOther.id, age: 6 }],
});

console.log("\nThe leak: GET /api/customers…");
const listAtA = await api(ownerA.token, "GET", "/api/customers");
const custAAtA = (listAtA.json as { email?: string; children?: { name?: string }[] }[]).find((c) => c.email === parentEmail);
check("tenant A's /api/customers list has the parent", !!custAAtA, listAtA.json);
check("tenant A sees Kid Leak (real booking with A)", !!custAAtA?.children?.some((k) => k.name === `Kid Leak ${run}`), custAAtA);
check("tenant A does NOT see Kid Other (that's B's child, never booked with A)", !custAAtA?.children?.some((k) => k.name === `Kid Other ${run}`), custAAtA);

const listAtB = await api(ownerB.token, "GET", "/api/customers");
const custBAtB = (listAtB.json as { email?: string; children?: { name?: string }[] }[]).find((c) => c.email === parentEmail);
check("tenant B's /api/customers list has the parent", !!custBAtB, listAtB.json);
check("tenant B sees Kid Other (real booking with B)", !!custBAtB?.children?.some((k) => k.name === `Kid Other ${run}`), custBAtB);
check(
  "SECURITY: tenant B does NOT see Kid Leak (that child only ever booked with A) — LEAK CLOSED",
  !custBAtB?.children?.some((k) => k.name === `Kid Leak ${run}`),
  custBAtB,
);

console.log("\nThe leak: GET /api/customers/:id/family…");
const famA = await api(ownerA.token, "GET", `/api/customers/${custARef.id}/family`);
const famB = await api(ownerB.token, "GET", `/api/customers/${custBRef.id}/family`);
check("tenant A's /family gate passes (real booking)", famA.status === 200, famA);
check("tenant B's /family gate passes (real booking)", famB.status === 200, famB);
const famAKids = (famA.json as { children?: { name?: string }[] }).children ?? [];
const famBKids = (famB.json as { children?: { name?: string }[] }).children ?? [];
check("tenant A's /family shows Kid Leak", famAKids.some((k) => k.name === `Kid Leak ${run}`), famAKids);
check("tenant A's /family does NOT show Kid Other", !famAKids.some((k) => k.name === `Kid Other ${run}`), famAKids);
check("tenant B's /family shows Kid Other", famBKids.some((k) => k.name === `Kid Other ${run}`), famBKids);
check(
  "SECURITY: tenant B's /family does NOT show Kid Leak — LEAK CLOSED (endpoint's own comment's promise now holds)",
  !famBKids.some((k) => k.name === `Kid Leak ${run}`),
  famBKids,
);

console.log("\nEdge case: a CANCELLED booking still counts as \"belongs to this tenant\" (matches children.ts's own gate, which doesn't filter on status)…");
await bookARef.set({ status: "Cancelled" }, { merge: true });
const listAtAAfterCancel = await api(ownerA.token, "GET", "/api/customers");
const custAAfter = (listAtAAfterCancel.json as { email?: string; children?: { name?: string }[] }[]).find((c) => c.email === parentEmail);
check(
  "tenant A STILL sees Kid Leak after cancellation (past relationship, matches children.ts's own 'has' check)",
  !!custAAfter?.children?.some((k) => k.name === `Kid Leak ${run}`),
  custAAfter,
);
const famAAfterCancel = await api(ownerA.token, "GET", `/api/customers/${custARef.id}/family`);
const famAAfterKids = (famAAfterCancel.json as { children?: { name?: string }[] }).children ?? [];
check(
  "tenant A's /family STILL shows Kid Leak after cancellation",
  famAAfterKids.some((k) => k.name === `Kid Leak ${run}`),
  famAAfterKids,
);

console.log(failures === 0 ? "\nALL CHECKS PASSED — item 65 leak closed, legitimate access intact." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
