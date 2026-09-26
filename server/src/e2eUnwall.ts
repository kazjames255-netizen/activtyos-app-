import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";

// Strip the signup-seeded `subscription` field from e2e tenants so they read
// as pre-existing (never walled by the plan gate). The subscription-billing
// spec deliberately mints its OWN fresh account to test the gate — the
// standing suite accounts must sail past it, exactly like the original
// pre-gate accounts did before a full cleanup re-provisioned them.
//
// Usage: npm --prefix server run e2e-unwall -- <tenantId> [<tenantId>…]

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  // `--2fa=<uid>`: mark a throwaway platform (HQ) user as having passed the emailed-code step, so the UI login lands on /platform.
  // Refuses anything that is not an @activityos-test.com account.
  for (const a of args.filter((x) => x.startsWith("--2fa="))) {
    const ref = db.collection("users").doc(a.slice(6));
    const email = String((await ref.get()).data()?.email ?? "");
    if (!/@activityos-test\.com$/.test(email)) { console.error(`[e2e-unwall] ${a.slice(6)}: not a test account — refused`); process.exit(1); }
    await ref.set({ twoFaVerifiedAt: Date.now() }, { merge: true });
    console.log(`[e2e-unwall] ${a.slice(6)}: 2FA marked verified`);
  }
  const ids = args.filter((x) => !x.startsWith("--2fa="));
  if (!ids.length && args.some((x) => x.startsWith("--2fa="))) return;
  if (!ids.length) {
    console.error("Pass at least one tenantId");
    process.exit(1);
  }
  for (const id of ids) {
    const ref = db.collection("tenants").doc(id);
    if (!(await ref.get()).exists) {
      // A vanished tenant is the suite's re-provisioning problem, not ours —
      // don't fail setup over it.
      console.warn(`[e2e-unwall] ${id}: tenant doc missing — skipped`);
      continue;
    }
    await ref.update({ subscription: FieldValue.delete() });
    console.log(`[e2e-unwall] ${id}: subscription field removed`);
  }
}

void main();
