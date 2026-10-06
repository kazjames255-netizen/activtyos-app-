import { fbSignUp, apiPost, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/stripe");
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/dotenv").config({ path: "/Users/kazjames/Downloads/activtyos-app-/server/.env" });
const API = "http://localhost:4000";
(async () => {
  const email = `e2e-repro-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await fetch("http://localhost:4000/api/register-role", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: JSON.stringify({ role: "freelancer", businessName: "Repro", providerName: "Repro", providerNameMode: "business" }) });
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` };
  const c = await (await fetch(`${API}/api/subscription/checkout`, { method: "POST", headers: h, body: "{}" })).json();
  console.log("checkout", Object.keys(c));
  const id = c.clientSecret.split("_secret_")[0];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const si = await stripe.setupIntents.confirm(id, { payment_method: "pm_card_visa" });
  console.log("si", si.status);
  const r = await fetch(`${API}/api/subscription/start`, { method: "POST", headers: h, body: JSON.stringify({ plan: "freelancer", cadence: "month", setupIntentId: id }) });
  console.log("start", r.status, (await r.text()).slice(0, 300));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
