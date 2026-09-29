// Regression test for docs/amir-backend-outstanding.md item 64: the rota's
// DBS/compliance gate (lib/staffPolicy.staffRosterBlock) used to switch on
// tenant-wide — the moment ANY staff member had a certificate on file, every
// OTHER staff member with no certificate record at all got blocked from
// rostering too, because the code only checked "does this tenant's
// `certifications` collection have anything at all" before applying
// requireDBS/requireCompliance to each individual.
//
// Proves the fix: enforcement is now judged per staff member.
//   - Staff A: no certificate record at all → NOT blocked, even though a
//     colleague in the same tenant has certs on file.
//   - Staff B: an expired DBS on file → IS blocked (unchanged behaviour).
//   - Staff C: a valid, in-date DBS on file → NOT blocked (unchanged
//     behaviour).
//
// Goes through the real POST /api/shifts endpoint (which calls
// staffRosterBlock exactly as the live rota does) against the live dev API;
// certifications are seeded directly via the Admin SDK, same as
// childLeakTest.mts's convention.
//
// Run against the live dev API (must already be running, e.g. npm run dev:all):
//   cd server && node_modules/.bin/tsx src/rosterBlockScopeTest.mts
// Cleanup: npm --prefix server run e2e-cleanup

import "dotenv/config";
import { db } from "./firebase";

const API = process.env.API_URL || "http://localhost:4000";
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
const em = (n: string) => `rosterblock-${run}-${n}@activityos-test.com`;

console.log("Provisioning a tenant (company)…");
const owner = await signUp(em("owner"));
const prov = await api(owner.token, "POST", "/api/register-role", { role: "company", businessName: `Roster Block Scope Test ${run}` });
check("tenant provisioned", prov.status === 201, prov);
const tenantId = (prov.json as { tenantId: string }).tenantId;

const staffA = `Staff NoCert ${run}`; // no cert record at all
const staffB = `Staff BadDBS ${run}`; // expired DBS on file
const staffC = `Staff GoodDBS ${run}`; // valid DBS on file

console.log("\nSeeding: Settings → Staff & workforce with requireDBS on (default), and certifications for B and C only (A gets none)…");
// requireDBS/requireCompliance default true (staffPolicy.ts DEFAULTS) so no
// explicit settings write is needed — confirm the tenant has no settings
// override that would turn it off.
const past = "2000-01-01";
const future = "2099-01-01";
const certBRef = db.collection("certifications").doc(`rbtest_${run}_b`);
await certBRef.set({
  tenantId, staffName: staffB, type: "DBS", expiry: past, source: "roster-block-scope-test", createdAt: new Date().toISOString(),
});
const certCRef = db.collection("certifications").doc(`rbtest_${run}_c`);
await certCRef.set({
  tenantId, staffName: staffC, type: "DBS", expiry: future, source: "roster-block-scope-test", createdAt: new Date().toISOString(),
});
// Staff A deliberately gets NO certifications document at all — the case
// under test.

console.log("\nRostering all three via the real POST /api/shifts (the live rota's own gate)…");
const shiftBody = (staffName: string) => ({
  staffName, date: "2026-10-01", start: "09:00", end: "17:00",
});

const resA = await api(owner.token, "POST", "/api/shifts", shiftBody(staffA));
check(
  "Staff A (no certificate record at all) is NOT blocked, even though B and C have certs on file in the same tenant",
  resA.status === 201,
  resA,
);

const resB = await api(owner.token, "POST", "/api/shifts", shiftBody(staffB));
check(
  "SAFETY: Staff B (expired DBS on file) IS blocked",
  resB.status === 409 && /DBS/i.test(String((resB.json as { error?: string }).error ?? "")),
  resB,
);

const resC = await api(owner.token, "POST", "/api/shifts", shiftBody(staffC));
check(
  "Staff C (valid, in-date DBS on file) is NOT blocked",
  resC.status === 201,
  resC,
);

console.log(failures === 0 ? "\nALL CHECKS PASSED — item 64: staffRosterBlock is scoped per staff member." : `\n${failures} FAILURE(S)`);

console.log("\nCleaning up seeded certifications…");
await certBRef.delete().catch(() => {});
await certCRef.delete().catch(() => {});
if (resA.status === 201) await db.collection("shifts").doc((resA.json as { id: string }).id).delete().catch(() => {});
if (resC.status === 201) await db.collection("shifts").doc((resC.json as { id: string }).id).delete().catch(() => {});

process.exit(failures === 0 ? 0 : 1);
