import { chromium } from "@playwright/test";
const OUT = "e2e/review/qa-c-shots";
const A = "e2e/.auth";
const views = [
  ["company", "/company/messages", "co-messages"], ["company", "/company/trips", "co-trips"],
  ["staff", "/staff/trips", "st-trips"], ["staff", "/staff/messages", "st-messages"],
  ["parent", "/custdash/messages", "pa-messages"], ["parent", "/custdash/trips", "pa-trips"],
];
const b = await chromium.launch();
for (const [role, url, name] of views) for (const w of [1440, 390]) for (const scheme of ["light", "dark"]) {
  try {
    const ctx = await b.newContext({ storageState: `${A}/${role}.json`, viewport: { width: w, height: 900 }, colorScheme: scheme, baseURL: "http://localhost:3013" });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(4000);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    console.log(name, w, scheme, ov ? "OVERFLOW" : "ok");
    await p.screenshot({ path: `${OUT}/${name}-${w}-${scheme}.png`, timeout: 20000 });
    await ctx.close();
  } catch (e) { console.log("ERR", name, w, scheme, String(e).slice(0, 120)); }
}
await b.close();
