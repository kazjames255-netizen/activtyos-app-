import fs from "node:fs"; import path from "node:path";
import { fbSignUp, apiPost, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed"); const H = "http://127.0.0.1:5055"; // different SITE from localhost:3000 = a real third-party frame
const sd = JSON.parse(fs.readFileSync(path.join(OUT, "seed.json"), "utf8"));
const ck = (id: string, ok: boolean, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`);
(async () => {
  const email = `e2e-embedpar-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: "Pat", lastName: "Parent", providerId: sd.tenantId });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  const p = await ctx.newPage();
  await p.goto(`${H}/inline-listing.html`); await p.waitForTimeout(7000);
  const fr = () => p.frames().find((f: any) => f !== p.mainFrame() && /localhost:3000/.test(f.url()))!;
  await p.screenshot({ path: path.join(OUT, "pay-1-inline-listing.png") });
  // Signed out: the sign-in link inside the frame
  await fr().getByText(/sign in/i).first().click().catch(() => {}); await p.waitForTimeout(4000);
  console.log("frame url after sign-in click:", fr()?.url().slice(0, 100));
  await fr().getByPlaceholder("you@example.com").fill(email); await fr().locator('input[type="password"]').fill(TEST_PASSWORD);
  await fr().getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForTimeout(8000);
  console.log("frame url after login:", fr()?.url().slice(0, 100));
  await p.screenshot({ path: path.join(OUT, "pay-2-after-login-in-frame.png") });
  const txt = (await fr().locator("body").innerText().catch(() => "")) as string;
  ck("signed in inside the third-party frame", /embed live camp/i.test(txt) && !/sign in/i.test(txt.split("\n").slice(0, 3).join(" ")), txt.slice(0, 120).replace(/\n/g, " | "));
  // add a child, then walk the widget to the pay step INSIDE the frame
  const f = fr();
  const kidName = "Robin" + Date.now().toString(36).slice(-4);
  await fetch("http://localhost:4000/api/my/children", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await (await import("../helpers/accounts")).fbSignIn(email)).idToken}` }, body: JSON.stringify({ name: kidName, dob: "2017-03-04", sex: "boy" }) }).then((r) => console.log("child create", r.status)).catch(() => {});
  await p.reload(); await p.waitForTimeout(7000);
  const g = fr();
  try {
    await g.getByText(/Tap a week/).first().waitFor({ timeout: 30000 });
    await g.getByRole("button", { name: /^(mon|monday)?.*\d/i }).first().click().catch(() => {});
    await p.screenshot({ path: path.join(OUT, "pay-3-widget.png") });
    const btns = await g.locator("button:visible").allInnerTexts(); console.log("BTNS", JSON.stringify(btns.map((x: string) => x.replace(/\s+/g, " ").slice(0, 40))).slice(0, 700));
  } catch (e) { console.log("widget walk stopped:", (e as Error).message.slice(0, 120)); await p.screenshot({ path: path.join(OUT, "pay-3-stopped.png") }); }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
