import { db, load } from "./hv-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/dotenv").config({ path: "/Users/kazjames/Downloads/activtyos-app-/server/.env", quiet: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/stripe");
(async () => {
  const key = process.env.STRIPE_SECRET_KEY ?? ""; if (!key.startsWith("sk_test_")) { console.log("not a test key, stopping"); process.exit(1); }
  const s = new Stripe(key); const S = load();
  const a = await s.accounts.create({
    type: "custom", country: "GB", email: "hv-test@activityos-test.com",
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_type: "individual",
    business_profile: { mcc: "8299", product_description: "Test camps" },
    individual: { first_name: "Test", last_name: "Provider", dob: { day: 1, month: 1, year: 1990 }, email: "hv-test@activityos-test.com", phone: "+447700900123", address: { line1: "1 Test Street", city: "London", postal_code: "SW1A 1AA", country: "GB" } },
    external_account: { object: "bank_account", country: "GB", currency: "gbp", routing_number: "108800", account_number: "00012345" },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
  });
  console.log("acct", a.id, "charges", a.charges_enabled, "req", JSON.stringify(a.requirements?.currently_due));
  await new Promise((r) => setTimeout(r, 4000));
  const b = await s.accounts.retrieve(a.id);
  console.log("after", b.charges_enabled, b.capabilities, JSON.stringify(b.requirements?.currently_due));
  if (b.charges_enabled) await db.collection("tenants").doc(S.accts.fa.tenantId).set({ stripeAccountId: a.id }, { merge: true });
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
