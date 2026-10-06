import { chromium, login, shot, go, rec, results, load } from "./hv-ui-lib";
import fs from "node:fs";
(async () => {
  const S = load(); const L = S.listings; const b = await chromium.launch();
  const { page: pp } = await login(b, S.accts.p1.email);
  await go(pp, `/book/${L.online.id}`);
  await pp.getByText(/Location/).first().click().catch(() => {}); await pp.waitForTimeout(1200);
  const pre = await pp.locator("body").innerText();
  rec("ONLINE public listing page (Location section opened): 'How to join' + join text, no map/address", /How to join/i.test(pre) && /zoom\.example/i.test(pre), "how-to-join=" + /How to join/i.test(pre) + " zoom=" + /zoom\.example/i.test(pre), await shot(pp, "hv-online-listing-open", true));
  await go(pp, "/custdash/bookings");
  await pp.waitForTimeout(5000);
  const card = pp.locator('[id^="booking-"]').filter({ hasText: "HV Online Tutoring" }).first();
  await card.getByRole("button", { name: /Details/ }).first().click(); await pp.waitForTimeout(5000);
  const t = await card.innerText();
  rec("ONLINE My bookings details: 'How to join' box with the joining text, no address/map", /How to join/i.test(t) && /zoom\.example/i.test(t) && !/come to you/i.test(t), "join=" + /zoom\.example/i.test(t), await shot(pp, "hv-online-mybookings2", true));
  // other parent cannot see p1's bookings or addresses
  const { page: p2 } = await login(b, S.accts.p2.email);
  await go(p2, "/custdash/bookings");
  const t2 = await p2.locator("body").innerText();
  rec("PRIVACY other parent (p2) My bookings shows none of p1's bookings/addresses", !/HVF-/.test(t2) && !/5 Home Road|NN5 7EA/.test(t2), "p1 refs/address absent: " + (!/HVF-/.test(t2) && !/5 Home Road/.test(t2)), await shot(p2, "hv-p2-mybookings", true));
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-ui-d.json", JSON.stringify(results, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
