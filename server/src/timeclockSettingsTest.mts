// Verification for docs/amir-backend-outstanding.md item 63: clock
// pay-policy settings (grace minutes, rounding, pay basis) move from
// per-device localStorage to a real tenant-scoped server endpoint.
//
// Checks, against the live dev API:
//  - GET /api/timeclock/settings returns sane defaults for a fresh tenant
//  - a manager PUT persists, and a subsequent GET (any manager on the same
//    tenant) sees the new value — the whole point of the fix
//  - a staff account CAN read it (their own timesheet needs it) but CANNOT
//    write it (403)
//  - a second, unrelated tenant is NOT affected by tenant A's PUT — this is
//    a tenant setting, not a global one
//  - a bad payload is rejected (400)
//
// Run against the live dev API (must already be running, e.g. npm run dev:all):
//   cd server && node_modules/.bin/tsx src/timeclockSettingsTest.mts
// Cleanup: npm --prefix server run e2e-cleanup (throwaway @activityos-test.com accounts)

import "dotenv/config";

const API = process.env.API_URL || "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyBRuvgODaTPQPvbFNRQbVYn1yJKmJ6ugys";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures++; console.error(`  ✗ ${label}`, JSON.stringify(detail ?? "").slice(0, 500)); }
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
  try { json = await r.json(); } catch { /* empty body */ }
  return { status: r.status, json };
}

const run = Date.now();
const em = (n: string) => `tc-${run}-${n}@activityos-test.com`;

console.log("Provisioning tenant A (owner + invited staff) and unrelated tenant B…");
const ownerA = await signUp(em("owner-a"));
const staffAEmail = em("staff-a");
const staffA = await signUp(staffAEmail);
const ownerB = await signUp(em("owner-b"));

const provA = await api(ownerA.token, "POST", "/api/register-role", { role: "company", businessName: `TC Settings Test A ${run}` });
const provB = await api(ownerB.token, "POST", "/api/register-role", { role: "freelancer", businessName: `TC Settings Test B ${run}` });
check("tenant A provisioned", provA.status === 201, provA);
check("tenant B provisioned", provB.status === 201, provB);

// Invite the staff account into tenant A via the real invite flow.
const inv = await api(ownerA.token, "POST", "/api/invites", { role: "staff", name: "TC Staff", email: staffAEmail });
check("invite created", inv.status === 201 || inv.status === 200, inv);
const inviteToken = (inv.json as { token?: string })?.token;
if (inviteToken) {
  const accept = await api(staffA.token, "POST", `/api/invites/${inviteToken}/accept`, {});
  check("staff accepted invite", accept.status === 200, accept);
} else {
  console.error("  ! could not find invite token in response — dumping:", JSON.stringify(inv.json));
}

console.log("\nGET defaults for a fresh tenant…");
const defA = await api(ownerA.token, "GET", "/api/timeclock/settings");
check("GET 200", defA.status === 200, defA);
const defBody = defA.json as { payPolicy?: string; graceMin?: number; rounding?: number; leadLabel?: string };
check("default payPolicy is 'actual'", defBody.payPolicy === "actual", defBody);
check("default graceMin is 5", defBody.graceMin === 5, defBody);
check("default leadLabel is 'Lead'", defBody.leadLabel === "Lead", defBody);

console.log("\nManager PUT persists (the actual fix)…");
const newSettings = { payPolicy: "scheduled-less-late", autoPayOvertime: true, graceMin: 15, rounding: 15, leadLabel: "Site lead" };
const put1 = await api(ownerA.token, "PUT", "/api/timeclock/settings", newSettings);
check("PUT 200", put1.status === 200, put1);
const reGet = await api(ownerA.token, "GET", "/api/timeclock/settings");
check("re-GET reflects the PUT (same tenant, any manager)", JSON.stringify(reGet.json) === JSON.stringify(newSettings), { got: reGet.json, want: newSettings });

console.log("\nStaff can read but not write…");
const staffGet = await api(staffA.token, "GET", "/api/timeclock/settings");
check("staff GET 200", staffGet.status === 200, staffGet);
check("staff sees the same tenant-wide value", JSON.stringify(staffGet.json) === JSON.stringify(newSettings), staffGet.json);
const staffPut = await api(staffA.token, "PUT", "/api/timeclock/settings", { ...newSettings, graceMin: 99 });
check("staff PUT is 403 (manager-only write)", staffPut.status === 403, staffPut);
const afterStaffAttempt = await api(ownerA.token, "GET", "/api/timeclock/settings");
check("staff's rejected PUT did not change the value", JSON.stringify(afterStaffAttempt.json) === JSON.stringify(newSettings), afterStaffAttempt.json);

console.log("\nTenant isolation — tenant B is untouched by tenant A's PUT…");
const bGet = await api(ownerB.token, "GET", "/api/timeclock/settings");
const bBody = bGet.json as { payPolicy?: string; graceMin?: number };
check("tenant B still has DEFAULT payPolicy ('actual'), not A's 'scheduled-less-late'", bBody.payPolicy === "actual", bBody);
check("tenant B still has DEFAULT graceMin (5), not A's 15", bBody.graceMin === 5, bBody);

console.log("\nValidation rejects a bad payload…");
const bad = await api(ownerA.token, "PUT", "/api/timeclock/settings", { payPolicy: "nonsense", autoPayOvertime: true, graceMin: -5, rounding: 7, leadLabel: "" });
check("bad payload is 400", bad.status === 400, bad);
const stillGood = await api(ownerA.token, "GET", "/api/timeclock/settings");
check("bad PUT did not corrupt the stored value", JSON.stringify(stillGood.json) === JSON.stringify(newSettings), stillGood.json);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
