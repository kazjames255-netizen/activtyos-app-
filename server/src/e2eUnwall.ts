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
  const ids = process.argv.slice(2).filter(Boolean);
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
