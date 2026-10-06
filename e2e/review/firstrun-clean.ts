import fs from "node:fs";
import path from "node:path";
import { TEST_PASSWORD } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const SHOTS = path.join(ROOT, "e2e/review/shots/firstrun");
const acc = JSON.parse(fs.readFileSync(path.join(SHOTS, "accounts.json"), "utf8"));
async function run(email: string, role: string, pages: [string, string][]) {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load" }); await page.waitForTimeout(3000);
  await page.getByPlaceholder("you@example.com").fill(email); await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(new RegExp(`/${role}/`), { timeout: 90000 });
  for (const [u, n] of pages) {
    await page.goto(`${WEB_URL}${u}`, { waitUntil: "load", timeout: 120000 }).catch(() => {}); await page.waitForTimeout(6000);
    const txt = await page.locator("body").innerText();
    console.log(n, "|", ["Alex Rivera", "Sam Carter", "Milton Keynes", "Northampton", "Bedford", "enforced by the backend", "Enforcement: backend", "Mentor", "Amir", "STRIPE_SECRET"].filter((w) => txt.includes(w)).join(",") || "clean");
    await page.screenshot({ path: path.join(SHOTS, `clean-${n}.png`) });
  }
  await b.close();
}
(async () => {
  await run(acc.fe, "franchise", [["/franchise/milestones", "franchise-milestones"], ["/franchise/setup?tab=staff", "franchise-setup-staff"], ["/franchise/getpaid", "franchise-getpaid"]]);
  await run(acc.co.email, "company", [["/company/credentials", "company-credentials"], ["/company/setup?tab=staff", "company-setup-staff"], ["/company/setup?tab=trips", "company-setup-trips"]]);
})();
