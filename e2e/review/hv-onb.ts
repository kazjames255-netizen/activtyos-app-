import { call, load, tokFor, SHOTS } from "./hv-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
(async () => {
  const S = load(); const fa = await tokFor(S.accts.fa.email);
  const r = await call(fa, "POST", "/api/payments/connect", {});
  console.log("connect", r.status, JSON.stringify(r.json).slice(0, 200));
  if (!r.json?.url) process.exit(1);
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await p.goto(r.json.url, { waitUntil: "load" }); await p.waitForTimeout(5000);
  await p.screenshot({ path: SHOTS + "/stripe-onb-1.png" });
  console.log((await p.locator("body").innerText()).slice(0, 600));
  await b.close(); process.exit(0);
})();
