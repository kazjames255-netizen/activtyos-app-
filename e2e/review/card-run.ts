import fs from "node:fs"; import path from "node:path";
import { fbSignUp, apiPost, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
const OUT = path.join(ROOT, "e2e/review/shots/cards"); fs.mkdirSync(OUT, { recursive: true });
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const CARDS: [string, string][] = [["ok-4242", "4242424242424242"], ["declined-0002", "4000000000000002"], ["3ds-3155", "4000002500003155"]];
const only = process.env.CARD_ONLY;
(async () => {
  const b = await chromium.launch();
  for (const [name, num] of CARDS) {
    if (only && only !== name) continue;
    const email = `e2e-card-${name}-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
    const s = await fbSignUp(email);
    const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: "Card Test Camps", providerName: "Card Test Camps", providerNameMode: "business" });
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("console", (m: any) => { if (/stripe|elements|IntegrationError|Invalid|secret/i.test(m.text())) console.log("CONSOLE", m.type(), m.text().slice(0, 300)); }); p.on("requestfailed", (r: any) => console.log("REQFAIL", r.url().slice(0, 100), r.failure()?.errorText)); p.on("response", (r: any) => { if (/stripe\.com|payments\/|subscription\/checkout/.test(r.url()) && r.status() >= 300) console.log("RESP", r.status(), r.url().slice(0, 110)); }); p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 150)));
    await p.goto(`${WEB_URL}/login`, { waitUntil: "load" }); await p.waitForTimeout(3000);
    await p.getByPlaceholder("you@example.com").fill(email); await p.locator('input[type="password"]').fill(TEST_PASSWORD);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(3000);
    await p.goto(`${WEB_URL}/freelancer/billing?tab=plan`, { waitUntil: "load" }); await p.waitForTimeout(4000);
    await p.getByRole("button", { name: /Start free trial/ }).first().click();
    await p.waitForTimeout(15000);
    console.log("FRAMES", p.frames().map((f: any) => f.url().replace(/\?.*/, "").slice(0, 90)).join(" | "));
    await p.screenshot({ path: path.join(OUT, `${name}-1-form.png`) });
    const frames = p.frames().filter((f: any) => /elements-inner|payment/.test(f.url()) || f.name().startsWith("__privateStripeFrame"));
    console.log(name, "stripe frames:", p.frames().map((f: any) => f.url().split("?")[0].slice(-40)).filter((u: string) => /stripe/.test(u)).join(" | "));
    const fl = p.frameLocator('iframe[title="Secure payment input frame"]').first();
    await fl.getByPlaceholder("1234 1234 1234 1234").fill(num);
    await fl.getByPlaceholder("MM / YY").fill("1234");
    await fl.getByPlaceholder("CVC").fill("123");
    await fl.locator('input[name="postalCode"], input[placeholder*="ost"]').first().fill("NN1 1AA").catch(() => {});
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, `${name}-2-filled.png`) });
    await p.getByRole("button", { name: /Start 7-day free trial/ }).click();
    await p.waitForTimeout(name.startsWith("3ds") ? 8000 : 9000);
    await p.screenshot({ path: path.join(OUT, `${name}-3-after.png`) });
    if (name.startsWith("3ds")) {
      let clicked = false;
      for (const f of p.frames()) { const btn = f.getByRole("button", { name: /^complete$/i }); if (await btn.count().catch(() => 0)) { await btn.first().click().catch(() => {}); clicked = true; break; } }
      if (!clicked) console.log("no 3ds button found");
      await p.waitForTimeout(8000); await p.screenshot({ path: path.join(OUT, `${name}-4-3ds-done.png`) });
    }
    const t = await admin.firestore().collection("tenants").doc(r.tenantId).get();
    const sub = t.get("subscription") ?? {};
    console.log(name, "RESULT", JSON.stringify({ status: sub.status, last4: sub.cardLast4, brand: sub.cardBrand, subId: !!sub.stripeSubscriptionId, trialEnd: sub.trialEnd ?? sub.trialEndsAt, errs }));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
