// Grant a role (and optionally a tenant) to a Firebase user by email:
//
//   npm run set-role -- someone@example.com platform
//   npm run set-role -- someone@example.com company apf-demo
//   npm run set-role -- someone@example.com staff <tenantId>

import "dotenv/config";
import { auth, db } from "./firebase";
import { ALL_ROLES } from "./middleware/role";

const [email, role, tenantId] = process.argv.slice(2).filter((a) => a !== "--");

if (!email || !ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
  console.error(`Usage: npm run set-role -- <email> <${ALL_ROLES.join("|")}> [tenantId]`);
  process.exit(1);
}

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`No Firebase user with email ${email} — create the account first.`);
  process.exit(1);
}

if (tenantId) {
  const tenant = await db.collection("tenants").doc(tenantId).get();
  if (!tenant.exists) {
    console.error(`No tenant with id ${tenantId}.`);
    process.exit(1);
  }
}

await db
  .collection("users")
  .doc(user.uid)
  .set(
    {
      email,
      role,
      chosen: true,
      tenantId: tenantId ?? null,
      // A franchise account is its own franchise scope within the tenant.
      franchiseId: role === "franchise" ? user.uid : null,
    },
    { merge: true },
  );
console.log(`${email} (${user.uid}) → role: ${role}${tenantId ? `, tenant: ${tenantId}` : ""}`);
process.exit(0);
