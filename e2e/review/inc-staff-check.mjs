// INC: staff must not see Edit on a record they did not log. node e2e/review/inc-staff-check.mjs <acc.json>
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const b = await chromium.launch();
for (const [who, email] of [["staff2", A.staff2.email], ["staff1", A.staff1.email]]) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.setDefaultTimeout(90000);
  await p.goto("http://localhost:3011/login", { waitUntil: "load" });
  await p.getByPlaceholder("you@example.com").fill(email);
  await p.locator('input[type="password"]').fill(A.password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => !/login/.test(u.pathname));
  await p.goto("http://localhost:3011/staff/accidents", { waitUntil: "load" });
  await p.waitForTimeout(6000);
  console.log(who, "cards", await p.locator('[data-ui="card"]').count(), "Edit buttons", await p.getByRole("button", { name: "Edit", exact: true }).count());
}
await b.close();
process.exit(0);
