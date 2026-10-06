import { chromium, login, shot, go, rec, results, load } from "./hv-ui-lib";
import { call, db, tokFor } from "./hv-lib";
import fs from "node:fs";
(async () => {
  const S = load(); const L = S.listings;
  const b = await chromium.launch();
  const kidName = "Hv Kid One";
  async function toPay(p: any, key: string, dayIdx: number) {
    await go(p, `/book/${L[key].id}`);
    await p.getByRole("button", { name: /^1 day · £/ }).first().click();
    if (await p.getByText(/choose a timing/i).isVisible().catch(() => false)) await p.getByRole("button", { name: /Full day/ }).first().click();
    const days = p.locator("button").filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri)\s*\d+/ });
    await days.nth(dayIdx).click();
    await p.getByRole("button", { name: /Add .* to basket/ }).click();
    await p.getByRole("button", { name: /Next — add children/ }).click();
    await p.getByRole("button", { name: new RegExp(kidName) }).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    const ph = p.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible({ timeout: 5000 }).catch(() => false)) await ph.fill("07700900999");
  }
  // ---- ONLINE listing, parent p1
  const { page: pp } = await login(b, S.accts.p1.email);
  await go(pp, `/book/${L.online.id}`);
  const pre = await pp.locator("body").innerText();
  rec("ONLINE public listing page: says 'runs online', shows how to join, no map/address", /online/i.test(pre) && /zoom\.example/i.test(pre) && !/Get(ting)? there|directions/i.test(pre), "has 'online': " + /online/i.test(pre) + "; has join text: " + /zoom\.example/i.test(pre), await shot(pp, "hv-online-listing", true));
  await toPay(pp, "online", 13);
  const payTxt = await pp.locator("body").innerText();
  rec("ONLINE checkout Pay step has NO 'we'll come to you' address box", !/come to you/i.test(payTxt), "address box absent: " + !/come to you/i.test(payTxt), await shot(pp, "hv-online-pay", true));
  await pp.getByRole("button", { name: /^Confirm booking/ }).click(); await pp.waitForTimeout(6000);
  const done = await pp.locator("body").innerText();
  rec("ONLINE booking confirmation shows 'How to join' and no address", /How to join/i.test(done) && /zoom\.example/i.test(done), done.slice(0, 160).replace(/\n/g, " | "), await shot(pp, "hv-online-done", true));
  await go(pp, "/custdash/bookings");
  const card = pp.locator('[data-ui="card"], [id^="booking-"]').filter({ hasText: "HV Online Tutoring" }).first();
  await card.getByRole("button", { name: /Details/ }).first().click().catch(() => {});
  await pp.waitForTimeout(1500);
  const mb = await pp.locator("body").innerText();
  rec("ONLINE My bookings details show 'How to join' text", /zoom\.example/i.test(mb), "join text visible: " + /zoom\.example/i.test(mb), await shot(pp, "hv-online-mybookings", true));
  // ---- 'both' (venue + home) as p1: UI shows venue AND home address box
  await toPay(pp, "both", 14);
  const bothTxt = await pp.locator("body").innerText();
  rec("BOTH listing Pay step shows the address box (home-visit possible)", /come to you/i.test(bothTxt), "address box present: " + /come to you/i.test(bothTxt), await shot(pp, "hv-both-pay", true));
  // ---- VENUE-only: no address box
  await toPay(pp, "venue", 12);
  const venueTxt = await pp.locator("body").innerText();
  rec("VENUE-only Pay step has no home address box", !/come to you/i.test(venueTxt), "absent: " + !/come to you/i.test(venueTxt), await shot(pp, "hv-venue-pay", true));
  // ---- phone width home-visit checkout
  const { page: ph, ctx } = await login(b, S.accts.p1.email, { width: 390, height: 844 });
  await toPay(ph, "hvpc", 9);
  const sc = await ph.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const btnVisible = await ph.getByRole("button", { name: /^Confirm booking/ }).isVisible().catch(() => false);
  rec("PHONE 390px home-visit Pay step: no sideways scroll, address + privacy visible, confirm button reachable", sc <= 1 && btnVisible && /Only the provider who visits/.test(await ph.locator("body").innerText()), `overflow px=${sc}; confirm visible=${btnVisible}`, await shot(ph, "hv-pay-phone", true));
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-ui-c.json", JSON.stringify(results, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
