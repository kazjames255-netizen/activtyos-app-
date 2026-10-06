import { chromium, newCtx, login, go, shot, body, check, loadState } from "./st4-lib";
(async () => {
  const st = loadState(); const b = await chromium.launch(); const c = await newCtx(b, 1440, 1400); const p = await c.newPage(); await login(p, st.emails.co);
  await go(p, "/company/ratios", 5000);
  const sel = p.locator("select").filter({ has: p.locator("option", { hasText: "St4 One Staff Camp" }) }).first(); const opt = await sel.locator("option", { hasText: "St4 One Staff Camp" }).first().getAttribute("value"); await sel.selectOption(opt); await p.waitForTimeout(1500);
  const next = p.locator("text=/Tue 6 Oct/").last().locator("xpath=ancestor::div[2]").locator("button").last();
  for (let i = 0; i < 6; i++) { await next.click(); await p.waitForTimeout(500); }
  await p.waitForTimeout(3000);
  let t = await body(p); const s = await shot(p, "19-ratios-12oct");
  const m = t.replace(/\n/g, " ");
  console.log(m.slice(m.indexOf("CHILDREN ON SITE") - 20, m.indexOf("CHILDREN ON SITE") + 330));
  check("RAT-03 ratios on the booked day: 4 under-3s + 1 other need 2 staff (1:3 ratio) and the page says so", /staff needed|STAFF ON DUTY/i.test(t) && /\b2\b/.test(m.slice(m.indexOf("STAFF ON DUTY"), m.indexOf("STAFF ON DUTY") + 60)), m.slice(m.indexOf("STAFF ON DUTY"), m.indexOf("STAFF ON DUTY") + 80), s);
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
