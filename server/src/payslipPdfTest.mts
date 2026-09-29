// Verification for docs/payroll-integrations-handoff.md item #4 (Payslips):
// real PDF generation + persistence + email/bulk-send + staff-portal scoped
// access (server/src/routes/payslips.ts, server/src/lib/payslipPdf.ts).
//
// Real throwaway accounts are provisioned through the live API (auth +
// tenant plumbing is real, same as childLeakTest.mts); the pay RUN is seeded
// directly via the Admin SDK in the exact shape server/src/routes/payroll.ts's
// POST /runs writes (read-only reference — that file is owned by another
// agent tonight and was never edited here).
//
// Run against the live dev API (must already be running, e.g. npm run dev:all):
//   cd server && node_modules/.bin/tsx src/payslipPdfTest.mts
// Cleans up every doc it created itself at the end (does NOT run the shared
// e2e-cleanup sweep, which would also touch other agents' data tonight).

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
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test1234!", returnSecureToken: true }),
  });
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
  try { json = await r.json(); } catch { /* empty/binary body */ }
  return { status: r.status, json };
}

/** Raw fetch (not JSON) — for the PDF endpoint. */
async function apiRaw(token: string, path: string): Promise<{ status: number; buf: Buffer; contentType: string | null }> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buf, contentType: r.headers.get("content-type") };
}

const run = Date.now();
const em = (n: string) => `payslip-${run}-${n}@activityos-test.com`;
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

console.log(`Run ${run}: provisioning a company tenant + two staff + an unrelated parent…`);
const owner = await signUp(em("owner"));
const staffOne = await signUp(em("staff-one"));
const staffTwo = await signUp(em("staff-two"));
const outsider = await signUp(em("outsider")); // a parent — no tenant relation at all

const provOwner = await api(owner.token, "POST", "/api/register-role", { role: "company", businessName: `Payslip Test ${run}` });
check("tenant provisioned", provOwner.status === 201 || provOwner.status === 200, provOwner);
const tenantId = (provOwner.json as { tenantId?: string }).tenantId;
if (!tenantId) throw new Error("no tenantId returned");
await api(outsider.token, "POST", "/api/register-role", { role: "parent" });

// Staff accounts: seeded directly (same shortcut childLeakTest.mts uses for
// data setup) — invite-link redemption is a separate, already-tested flow.
const NAME_ONE = `Staff One ${run}`;
const NAME_TWO = `Staff Two ${run}`;
await db.collection("users").doc(staffOne.uid).set({ email: em("staff-one"), name: NAME_ONE, role: "staff", tenantId, franchiseId: null, chosen: true });
await db.collection("users").doc(staffTwo.uid).set({ email: em("staff-two"), name: NAME_TWO, role: "staff", tenantId, franchiseId: null, chosen: true });

const idOne = slug(NAME_ONE), idTwo = slug(NAME_TWO);
const payKey = tenantId; // keyOf(tenantId, null) with no franchise
const runId = "pr_" + run.toString(36);
const paidOn = "2026-09-25"; // this UK tax year (2026/27): 2026-04-06 .. 2027-04-05

function makeLine(id: string, name: string, netM: number) {
  return {
    id, name, role: "Coach", op: "Main site", basis: "hour" as const, rate: 12.5, hpw: 16, weeks: 52,
    taxCode: "1257L", niCat: "A", freqLabel: "Monthly", hoursM: 64, hoursFrom: "contracted" as const,
    basePayM: 800, additions: [], deductions: [],
    grossM: 800, payeM: 60, eeNiM: 40, erNiM: 45, eePenM: 24, erPenM: 24, netM,
  };
}
const lines = [makeLine(idOne, NAME_ONE, 676), makeLine(idTwo, NAME_TWO, 676)];

const runDocId = `${payKey}_${runId}`.replace(/\//g, "_");
await db.collection("payrollRuns").doc(runDocId).set({
  id: runId, period: "September 2026", paidOn, freq: "monthly", hoursBasis: "contracted",
  lines, status: "approved", createdAt: new Date().toISOString(), createdBy: owner.token ? em("owner") : null,
  publishedAt: new Date().toISOString(), publishedBy: em("owner"),
  payKey, tenantId, franchiseId: null,
});
console.log(`Seeded pay run ${runId} for tenant ${tenantId} with lines [${idOne}, ${idTwo}]`);

// ── 1. Manager can download either employee's real PDF ─────────────────────
const mgrPdf1 = await apiRaw(owner.token, `/api/payroll/runs/${runId}/payslip/${idOne}/pdf`);
check("manager → staff-one PDF: 200", mgrPdf1.status === 200, mgrPdf1.status);
check("manager → staff-one PDF: content-type application/pdf", mgrPdf1.contentType === "application/pdf", mgrPdf1.contentType);
check("manager → staff-one PDF: real PDF magic bytes", mgrPdf1.buf.subarray(0, 5).toString("latin1") === "%PDF-", mgrPdf1.buf.subarray(0, 20).toString("latin1"));
check("manager → staff-one PDF: plausible size (>1KB)", mgrPdf1.buf.length > 1000, mgrPdf1.buf.length);
console.log(`    staff-one PDF: ${mgrPdf1.buf.length} bytes`);

const mgrPdf2 = await apiRaw(owner.token, `/api/payroll/runs/${runId}/payslip/${idTwo}/pdf`);
check("manager → staff-two PDF: 200 + real PDF", mgrPdf2.status === 200 && mgrPdf2.buf.subarray(0, 5).toString("latin1") === "%PDF-", mgrPdf2.status);

// ── 2. Persistence: cached, byte-identical on re-fetch ──────────────────────
const pdfDocId = `${payKey}_${runId}_${idOne}`.replace(/\//g, "_");
const cached = await db.collection("payslipPdfs").doc(pdfDocId).get();
check("PDF was persisted to payslipPdfs", cached.exists, pdfDocId);
check("persisted doc carries a tax-year-end retention marker", cached.get("taxYearEnd") === "2027-04-05", cached.get("taxYearEnd"));
const mgrPdf1Again = await apiRaw(owner.token, `/api/payroll/runs/${runId}/payslip/${idOne}/pdf`);
check("re-fetch returns byte-identical PDF (served from cache, not regenerated)", mgrPdf1Again.buf.equals(mgrPdf1.buf), { len1: mgrPdf1.buf.length, len2: mgrPdf1Again.buf.length });

// ── 3. Staff-portal scoped access ───────────────────────────────────────────
const ownPdf = await apiRaw(staffOne.token, `/api/payroll/runs/${runId}/payslip/${idOne}/pdf`);
check("staff-one → own PDF: 200", ownPdf.status === 200, ownPdf.status);
check("staff-one → own PDF: matches the manager's copy", ownPdf.buf.equals(mgrPdf1.buf));

const crossPdf = await apiRaw(staffOne.token, `/api/payroll/runs/${runId}/payslip/${idTwo}/pdf`);
check("staff-one → staff-two's PDF: REFUSED (403/404)", crossPdf.status === 403 || crossPdf.status === 404, crossPdf.status);

const outsiderPdf = await apiRaw(outsider.token, `/api/payroll/runs/${runId}/payslip/${idOne}/pdf`);
check("unrelated parent account → any payslip: REFUSED (403)", outsiderPdf.status === 403, outsiderPdf.status);

// ── 4. Email / bulk-send ────────────────────────────────────────────────────
const emailOne = await api(owner.token, "POST", `/api/payroll/runs/${runId}/payslip/email`, { employeeId: idOne });
check("manager emails one payslip: 200 ok", emailOne.status === 200 && (emailOne.json as { ok?: boolean }).ok === true, emailOne);
check("that one send reports 'sent'", (emailOne.json as { sent?: number }).sent === 1, emailOne.json);

const emailAll = await api(owner.token, "POST", `/api/payroll/runs/${runId}/payslip/email`, {});
check("manager bulk-emails the whole run: 200 ok, both sent", emailAll.status === 200 && (emailAll.json as { sent?: number }).sent === 2, emailAll.json);

// performEmailSend really ran: it writes an `emails` history doc per call
// (same mechanism the Email page / scheduled sweeps use) — confirm those
// landed, with the dev-mode "not live" outcome every other agent saw tonight
// (MAIL_LIVE isn't set against @activityos-test.com addresses).
await new Promise((r) => setTimeout(r, 800)); // delivery recording is fire-and-forget
const emailHistory = await db.collection("emails").where("tenantId", "==", tenantId).get();
check("performEmailSend wrote history docs (engine really ran)", emailHistory.size === 3, emailHistory.size);
const outcomes = emailHistory.docs.map((d) => ({ status: d.get("status"), suppressed: d.get("suppressed"), delivered: d.get("delivered"), subject: d.get("subject") }));
console.log("    email history:", JSON.stringify(outcomes));
check("sends were recorded as suppressed (dev/no MAIL_LIVE) or sent — never silently dropped", outcomes.every((o) => o.status === "sent" && ((o.suppressed ?? 0) + (o.delivered ?? 0)) >= 1), outcomes);

const staffEmailAttempt = await api(staffOne.token, "POST", `/api/payroll/runs/${runId}/payslip/email`, {});
check("staff cannot trigger the email/bulk-send endpoint: 403", staffEmailAttempt.status === 403, staffEmailAttempt.status);

// ── Cleanup — only what this run created ────────────────────────────────────
console.log("Cleaning up…");
await db.collection("payrollRuns").doc(runDocId).delete();
await db.collection("payslipPdfs").doc(`${payKey}_${runId}_${idOne}`.replace(/\//g, "_")).delete();
await db.collection("payslipPdfs").doc(`${payKey}_${runId}_${idTwo}`.replace(/\//g, "_")).delete();
for (const d of emailHistory.docs) await d.ref.delete();
await db.collection("users").doc(staffOne.uid).delete();
await db.collection("users").doc(staffTwo.uid).delete();
await db.collection("users").doc(owner.uid).delete();
await db.collection("users").doc(outsider.uid).delete();
await db.collection("libraries").doc(tenantId).delete().catch(() => {});
await db.collection("tenants").doc(tenantId).delete().catch(() => {});
console.log("Done.");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
