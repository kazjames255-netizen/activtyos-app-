import { chromium, login, shot, go, rec, results, load } from "./hv-ui-lib";
import { call, ok, db, tokFor } from "./hv-lib";
import fs from "node:fs";
(async () => {
  const S = load(); const L = S.listings;
  const b = await chromium.launch();
  // --- parent p1: home-visit checkout, desktop
  const { page: pp } = await login(b, S.accts.p1.email);
  const kidName = "Hv Kid One";
  async function toPay(p: any, key: string, vp?: boolean) {
    await go(p, `/book/${L[key].id}`);
    await p.getByRole("button", { name: /^1 day · £/ }).first().click();
    if (await p.getByText(/choose a timing/i).isVisible().catch(() => false)) await p.getByRole("button", { name: /Full day/ }).first().click();
    const days = p.locator("button").filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri)\s*\d+/ });
    await days.nth(11).click();
    await p.getByRole("button", { name: /Add .* to basket/ }).click();
    await p.getByRole("button", { name: /Next — add children/ }).click();
    await p.getByRole("button", { name: new RegExp(kidName) }).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    const ph = p.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible({ timeout: 5000 }).catch(() => false)) await ph.fill("07700900999");
  }
  await toPay(pp, "hvpc");
  rec("UI hvpc checkout Pay step (desktop): address box + privacy line", await pp.getByText(/Only the provider who visits sees this address/).isVisible().catch(() => false), "home-visit listing shows the 'we come to you' address box with the privacy line", await shot(pp, "hv-pay-desktop", true));
  // uncovered postcode -> refusal message in the UI, nothing booked
  const before = (await db.collection("bookings").where("listingId", "==", L.hvpc.id).get()).size;
  const pc = pp.getByPlaceholder(/postcode/i).first();
  await pc.fill("NN2 1AA");
  await pp.getByRole("button", { name: /^Confirm booking/ }).click();
  await pp.waitForTimeout(3500);
  const refused = await pp.getByText(/outside this provider's home-visit coverage area/).isVisible().catch(() => false);
  const afterRef = (await db.collection("bookings").where("listingId", "==", L.hvpc.id).get()).size;
  rec("UI uncovered postcode NN2 1AA shows a clear refusal and books nothing", refused && afterRef === before, `message visible=${refused}; bookings ${before}->${afterRef}`, await shot(pp, "hv-refused-desktop", true));
  // covered postcode -> success
  await pc.fill("nn5 7ea");
  await pp.getByRole("button", { name: /^Confirm booking/ }).click();
  await pp.waitForTimeout(6000);
  const doneTxt = (await pp.locator("body").innerText()).slice(0, 1200).replace(/\n/g, " | ");
  rec("UI covered postcode confirms the booking (bank transfer)", /confirmed|booked|reference|thank/i.test(doneTxt), doneTxt.slice(0, 260), await shot(pp, "hv-done-desktop", true));
  // my bookings
  await go(pp, "/custdash/bookings");
  const mb = await pp.locator("body").innerText();
  rec("UI My bookings shows the parent's own address ('comes to you')", /5 Home Road|NN5 7EA/i.test(mb), "address line visible on the booking card: " + (/NN5 7EA/i.test(mb)), await shot(pp, "hv-mybookings", true));
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-ui-a.json", JSON.stringify(results, null, 1));
  console.log("body sample:", (await pp.locator("body").innerText()).slice(0, 200).replace(/\n/g, " | "));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
