// Counts GET /api/listings (the Browse feed) on a cold load of /custdash/browse. usage: node measure.mjs <label>
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const DIR = new URL(".", import.meta.url).pathname;
const A = JSON.parse(fs.readFileSync(DIR + "accounts.json", "utf8"));
const label = process.argv[2] || "run";
const WEB = "http://localhost:3021";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage(); page.setDefaultTimeout(90000);
await page.goto(`${WEB}/parent`, { waitUntil: "load", timeout: 180000 });
await page.locator("#parent-email").fill(A.parent.email); await page.locator("#parent-password").fill(A.password);
await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
await page.waitForURL(/custdash/, { timeout: 180000 }); await page.waitForTimeout(8000);
const hits = []; const all = {};
page.on("request", (r) => { { const u0 = new URL(r.url()); if (u0.port === "4021") { const k = r.method() + " " + u0.pathname; all[k] = (all[k] || 0) + 1; } } const u = new URL(r.url()); if (r.method() === "GET" && u.port === "4021" && u.pathname === "/api/listings") hits.push({ t: Date.now() - t0, url: u.pathname + u.search }); });
const t0 = Date.now();
await page.goto(`${WEB}/custdash/browse`, { waitUntil: "load", timeout: 180000 });
// realtime churn: other providers editing listings/blocks while Browse is open (4 touches, 2.5 s apart, starting after the page has loaded)
if (process.argv[3] === "churn") { const { spawn } = await import("node:child_process"); spawn("../../../server/node_modules/.bin/tsx", [DIR + "churn.mts", "4"], { cwd: DIR, stdio: "ignore", detached: false }); }
await page.waitForTimeout(18000);
if (!/custdash\/browse/.test(page.url())) throw new Error("not on browse: " + page.url());
await page.screenshot({ path: DIR + `browse-${label}.png` });
const out = { label, count: hits.length, hits, allApi: all };
fs.writeFileSync(DIR + `requests-${label}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
await browser.close();
