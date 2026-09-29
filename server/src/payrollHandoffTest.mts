// Regression/acceptance test for docs/payroll-integrations-handoff.md item
// #39 (Payroll): employee data model additions, NI-number encryption at
// rest, per-employee-per-tax-year YTD, payroll-admin RBAC, the audit log,
// and create/approve segregation of duties.
//
// Real throwaway accounts on the live dev API (same *@activityos-test.com
// convention as server/src/childLeakTest.mts); a second "co-owner" on the
// same tenant is seeded directly via the Admin SDK (writing users/{uid}) —
// there's no invite-a-second-owner API, and that's not what's under test
// here, same precedent childLeakTest.mts uses for unrelated seeding.
//
// Run against the live dev API (must already be running, e.g. npm run dev:all):
//   cd server && node_modules/.bin/tsx src/payrollHandoffTest.mts
// This script cleans up everything it created itself (see bottom) — no
// npm run e2e:cleanup needed (payroll's collections aren't in its scope yet).

import "dotenv/config";
import { auth, db } from "./firebase";
import { decryptField } from "./lib/fieldCrypto";

const API = process.env.API_URL || "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyBRuvgODaTPQPvbFNRQbVYn1yJKmJ6ugys";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures++; console.error(`  ✗ ${label}`, JSON.stringify(detail ?? "").slice(0, 800)); }
}

async function signUp(email: string): Promise<{ token: string; uid: string }> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test1234!", returnSecureToken: true }),
  });
  const d = (await r.json()) as { idToken?: string; localId?: string; error?: { message: string } };
  if (!d.idToken || !d.localId) throw new Error(`signUp failed for ${email}: ${d.error?.message}`);
  return { token: d.idToken, uid: d.localId };
}

async function api(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${API}${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try { json = await r.json(); } catch { /* empty body */ }
  return { status: r.status, json };
}

const run = Date.now();
const em = (n: string) => `payroll-${run}-${n}@activityos-test.com`;

console.log("Provisioning owner A (tenant owner + run creator) and owner B (seeded co-owner + approver)...");
const ownerA = await signUp(em("owner-a"));
const ownerB = await signUp(em("owner-b"));

const provA = await api(ownerA.token, "POST", "/api/register-role", { role: "company", businessName: `Payroll Handoff Test ${run}` });
check("tenant A provisioned", provA.status === 201, provA);
const tenantId = (provA.json as { tenantId: string }).tenantId;

// Seed B as a co-owner of the SAME tenant directly — no invite-a-second-owner
// API exists, and building one is out of scope for this task.
await db.collection("users").doc(ownerB.uid).set({ email: em("owner-b"), role: "company", tenantId, franchiseId: null });
check("owner B seeded onto tenant A", true);

const payKey = tenantId; // no franchise in play
const empId = `emp-${run}`;
const niPlain = "AB123456C";

console.log("\n[1] Employee data model additions + NI encryption at rest...");
const putEmp = await api(ownerA.token, "PUT", "/api/payroll/employees", {
  employees: [{
    id: empId, name: `Payroll Test Person ${run}`, role: "Coach", op: "", basis: "year", rate: 30000, hpw: 0, weeks: 52,
    taxCode: "1257L", niCat: "A", pension: false, niNumber: niPlain, startDate: "2024-01-01", leaveDate: null,
    studentLoanPlan: "plan2", director: false, taxRegime: "uk",
  }],
});
check("PUT /employees with new fields + NI number accepted", putEmp.status === 200, putEmp);

const getList = await api(ownerA.token, "GET", "/api/payroll");
const emps = (getList.json as { employees?: Record<string, unknown>[] }).employees ?? [];
const empInList = emps.find((e) => e.id === empId);
check("employee round-trips with new additive fields", !!empInList && empInList.studentLoanPlan === "plan2" && empInList.director === false && empInList.taxRegime === "uk" && empInList.startDate === "2024-01-01", empInList);
check("SECURITY: niNumber never returned plaintext in the listing", !("niNumber" in (empInList ?? {})), empInList);
check("SECURITY: raw niNumberEnc blob never returned to the client either", !("niNumberEnc" in (empInList ?? {})), empInList);
check("hasNiNumber flag is true (present, just masked)", empInList?.hasNiNumber === true, empInList);

// Confirm what's actually IN FIRESTORE is ciphertext, not the plaintext NI.
const cfgSnap = await db.collection("payrollConfig").doc(payKey.replace(/\//g, "_")).get();
const storedEmp = ((cfgSnap.get("employees") as Record<string, unknown>[] | undefined) ?? []).find((e) => e.id === empId);
const storedEnc = storedEmp?.niNumberEnc as string | undefined;
check("stored record has an encrypted niNumberEnc, not plaintext", typeof storedEnc === "string" && storedEnc.length > 0 && !storedEnc.includes(niPlain), storedEmp);
check("the encrypted value decrypts back to the real NI number (round-trip)", !!storedEnc && decryptField(storedEnc) === niPlain);

const revealWrong = await api(ownerA.token, "GET", `/api/payroll/employees/nonexistent-${run}/ni`);
check("reveal endpoint 404s for an unknown employee", revealWrong.status === 404, revealWrong);
const reveal = await api(ownerA.token, "GET", `/api/payroll/employees/${empId}/ni`);
check("payroll admin CAN explicitly reveal the NI number via the dedicated endpoint", reveal.status === 200 && (reveal.json as { niNumber?: string }).niNumber === niPlain, reveal);

// A second PUT that edits another field but doesn't send niNumber (exactly
// what the current front end does — it never collects this field) must NOT
// wipe the encrypted value already on file.
const putAgain = await api(ownerA.token, "PUT", "/api/payroll/employees", {
  employees: [{ id: empId, name: `Payroll Test Person ${run}`, role: "Senior Coach", op: "", basis: "year", rate: 31000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false }],
});
check("PUT without niNumber (edit of an unrelated field) succeeds", putAgain.status === 200, putAgain);
const revealAfter = await api(ownerA.token, "GET", `/api/payroll/employees/${empId}/ni`);
check("NI number SURVIVES an edit that didn't resend it (not silently wiped)", revealAfter.status === 200 && (revealAfter.json as { niNumber?: string }).niNumber === niPlain, revealAfter);

console.log("\n[2] Payroll-admin RBAC...");
const bListBefore = await api(ownerB.token, "GET", "/api/payroll");
check("unset payrollAdmins → falls back to today's rule (any owner-tier role can access)", bListBefore.status === 200, bListBefore);

await db.collection("libraries").doc(tenantId).set({ settings: { payrollAdmins: [em("owner-a")] } }, { merge: true });
const bListAfter = await api(ownerB.token, "GET", "/api/payroll");
check("configured payrollAdmins excluding B → B is refused", bListAfter.status === 403, bListAfter);
check("refusal names it as a payroll-admin restriction", /payroll administrator/i.test(String((bListAfter.json as { error?: string }).error ?? "")), bListAfter);
const aListStill = await api(ownerA.token, "GET", "/api/payroll");
check("A (on the allowlist) still has access", aListStill.status === 200, aListStill);

// Add B back in for the run/approve tests below (both need router access).
await db.collection("libraries").doc(tenantId).set({ settings: { payrollAdmins: [em("owner-a"), em("owner-b")] } }, { merge: true });
const bListRestored = await api(ownerB.token, "GET", "/api/payroll");
check("B restored to the allowlist → access again", bListRestored.status === 200, bListRestored);

console.log("\n[3] Create/approve segregation of duties + YTD...");
const line = { id: empId, name: `Payroll Test Person ${run}`, grossM: 2583.33, payeM: 210.5, eeNiM: 120.3, erNiM: 145.2, eePenM: 0, erPenM: 0, netM: 2252.53 };
const paidOn = new Date().toISOString().slice(0, 10);
const createRun = await api(ownerA.token, "POST", "/api/payroll/runs", { period: `Test period ${run}`, paidOn, freq: "monthly", lines: [line] });
check("POST /runs creates a DRAFT, not an approved run", createRun.status === 201 && (createRun.json as { status?: string }).status === "draft", createRun);
const runId = (createRun.json as { id: string }).id;

const publishDraft = await api(ownerA.token, "POST", `/api/payroll/runs/${runId}/publish`, { published: true });
check("publishing a DRAFT run is refused", publishDraft.status === 400, publishDraft);

const selfApprove = await api(ownerA.token, "POST", `/api/payroll/runs/${runId}/approve`, {});
check("SECURITY: the run's own creator cannot approve it (segregation of duties)", selfApprove.status === 403, selfApprove);

const ytdBefore = await api(ownerA.token, "GET", `/api/payroll/ytd/${empId}`);
check("YTD is zero/absent before approval", (ytdBefore.json as { gross?: number }).gross === 0, ytdBefore);

const otherApprove = await api(ownerB.token, "POST", `/api/payroll/runs/${runId}/approve`, {});
check("a DIFFERENT person approving succeeds", otherApprove.status === 200 && (otherApprove.json as { status?: string }).status === "approved", otherApprove);
check("approve records who approved it (not the creator)", (otherApprove.json as { approvedBy?: string }).approvedBy === em("owner-b"), otherApprove);

const reApprove = await api(ownerB.token, "POST", `/api/payroll/runs/${runId}/approve`, {});
check("re-approving an already-approved run is refused", reApprove.status === 400, reApprove);

const ytdAfter = await api(ownerA.token, "GET", `/api/payroll/ytd/${empId}`);
const yj = ytdAfter.json as { gross?: number; paye?: number; eeNi?: number; erNi?: number; net?: number; runs?: number };
check("YTD gross updated correctly after approval", yj.gross === line.grossM, ytdAfter);
check("YTD PAYE/NI/net updated correctly after approval", yj.paye === line.payeM && yj.eeNi === line.eeNiM && yj.erNi === line.erNiM && yj.net === line.netM, ytdAfter);
check("YTD run count incremented", yj.runs === 1, ytdAfter);

const publishNow = await api(ownerA.token, "POST", `/api/payroll/runs/${runId}/publish`, { published: true });
check("publishing an APPROVED run succeeds", publishNow.status === 200 && (publishNow.json as { publishedAt: string | null }).publishedAt, publishNow);

// A second run to prove YTD ACCUMULATES rather than overwrites.
const line2 = { ...line, grossM: 2583.33, netM: 2252.53 };
const createRun2 = await api(ownerB.token, "POST", "/api/payroll/runs", { period: `Test period 2 ${run}`, paidOn, freq: "monthly", lines: [line2] });
const runId2 = (createRun2.json as { id: string }).id;
const approveRun2 = await api(ownerA.token, "POST", `/api/payroll/runs/${runId2}/approve`, {}); // A approves B's run — different creator again
check("second run (created by B) approved by A", approveRun2.status === 200, approveRun2);
const ytdAccum = await api(ownerA.token, "GET", `/api/payroll/ytd/${empId}`);
check("YTD ACCUMULATES across two approved runs (2x gross)", (ytdAccum.json as { gross?: number }).gross === Math.round(line.grossM * 2 * 100) / 100, ytdAccum);

console.log("\n[4] Audit log...");
const auditSnap = await db.collection("payrollAuditLog").where("payKey", "==", payKey).where("actor", "in", [em("owner-a"), em("owner-b")]).get();
const actions = new Set(auditSnap.docs.map((d) => d.get("action")));
check("audit log has a view-employees entry", actions.has("view-employees"), [...actions]);
check("audit log has an edit-employees entry", actions.has("edit-employees"), [...actions]);
check("audit log has a create-run entry", actions.has("create-run"), [...actions]);
check("audit log has an approve-run entry", actions.has("approve-run"), [...actions]);
check("audit log has a publish-run entry", actions.has("publish-run"), [...actions]);
check("audit log has a view-ni entry", actions.has("view-ni"), [...actions]);
check("at least 2 distinct actions audited (task's minimum)", actions.size >= 2, [...actions]);

console.log(failures === 0 ? "\nALL CHECKS PASSED." : `\n${failures} FAILURE(S)`);

console.log("\nCleaning up test data...");
await db.collection("payrollConfig").doc(payKey.replace(/\//g, "_")).delete().catch(() => {});
for (const id of [runId, runId2]) if (id) await db.collection("payrollRuns").doc(`${payKey}_${id}`.replace(/\//g, "_")).delete().catch(() => {});
const ytdQ = await db.collection("payrollYtd").where("payKey", "==", payKey).get();
await Promise.all(ytdQ.docs.map((d) => d.ref.delete()));
const auditQ = await db.collection("payrollAuditLog").where("payKey", "==", payKey).get();
await Promise.all(auditQ.docs.map((d) => d.ref.delete()));
await db.collection("libraries").doc(tenantId).delete().catch(() => {});
await db.collection("users").doc(ownerB.uid).delete().catch(() => {});
await db.collection("users").doc(ownerA.uid).delete().catch(() => {});
await db.collection("tenants").doc(tenantId).delete().catch(() => {});
await auth.deleteUser(ownerA.uid).catch(() => {});
await auth.deleteUser(ownerB.uid).catch(() => {});
console.log("Cleanup done.");

process.exit(failures === 0 ? 0 : 1);
