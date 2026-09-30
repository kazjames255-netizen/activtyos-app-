// Server-side (Admin SDK) arrange/inspect helper for e2e/payroll-security.spec.ts. Run from server/:
//   npx tsx ../e2e/helpers/payrollAdmin.ts seed-owner <uid> <email> <tenantId>   → a 2nd company owner on the tenant (no invite-an-owner API exists)
//   npx tsx ../e2e/helpers/payrollAdmin.ts audit <payKey>                        → @@JSON@@[payrollAuditLog entries, oldest first]@@END@@
//   npx tsx ../e2e/helpers/payrollAdmin.ts rawconfig <payKey>                    → @@JSON@@{payrollConfig doc}@@END@@ (what is really stored)
//   npx tsx ../e2e/helpers/payrollAdmin.ts wipe <tenantId>                       → deletes every payroll doc the spec created (only for @activityos-test.com tenants)
// Refuses to touch a tenant whose owner isn't an @activityos-test.com account.
import "../../server/node_modules/dotenv/config";
import { auth, db } from "../../server/src/firebase";

const [cmd, a, b, c] = process.argv.slice(2);
const out = (v: unknown) => console.log(`@@JSON@@${JSON.stringify(v)}@@END@@`);
const scopeOf = (payKey: string) => payKey.split("__fr__")[0];

async function assertTestTenant(tenantId: string) {
  const owners = await db.collection("users").where("tenantId", "==", tenantId).get();
  if (!owners.docs.length || !owners.docs.every((d) => /@activityos-test\.com$/.test(String(d.get("email") ?? "")))) throw new Error(`refusing: ${tenantId} is not an all-@activityos-test.com tenant`);
}

(async () => {
  if (cmd === "seed-owner") {
    await assertTestTenant(c);
    await db.collection("users").doc(a).set({ email: b, role: "company", tenantId: c, franchiseId: null, name: "Second Owner" });
    out({ ok: true });
  } else if (cmd === "audit") {
    const snap = await db.collection("payrollAuditLog").where("tenantId", "==", scopeOf(a)).get();
    out(snap.docs.map((d) => d.data()).sort((x, y) => String(x.at).localeCompare(String(y.at))));
  } else if (cmd === "rawconfig") {
    out((await db.collection("payrollConfig").doc(a.replace(/\//g, "_")).get()).data() ?? null);
  } else if (cmd === "wipe") {
    await assertTestTenant(a);
    let n = 0;
    for (const col of ["payrollRuns", "payslipPdfs", "payrollYtd", "payrollAuditLog", "accountingMappings"]) {
      const snap = await db.collection(col).where("tenantId", "==", a).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete())); n += snap.size;
    }
    const cfg = await db.collection("payrollConfig").where("tenantId", "==", a).get();
    await Promise.all(cfg.docs.map((d) => d.ref.delete())); n += cfg.size;
    const emails = await db.collection("emails").where("tenantId", "==", a).get();
    await Promise.all(emails.docs.map((d) => d.ref.delete())); n += emails.size;
    // second owners seeded by this helper (Firebase auth users are removed by e2e:cleanup via the test-domain sweep)
    const seeded = await db.collection("users").where("tenantId", "==", a).where("name", "==", "Second Owner").get();
    for (const d of seeded.docs) { await d.ref.delete(); await auth.deleteUser(d.id).catch(() => {}); n++; }
    out({ deleted: n });
  } else throw new Error("unknown command");
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
