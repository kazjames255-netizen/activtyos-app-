import fs from "node:fs";
import { fbSignIn, apiFetch, apiPost } from "../helpers/accounts";
import { WEB_URL } from "../helpers/env";
import { chromium, check, shot, go, body, newCtx, login, db } from "./onbtest-lib";

(async () => {
  const { email, tenantId } = JSON.parse(fs.readFileSync("/tmp/onb-fl.json", "utf8"));
  const tok = (await fbSignIn(email)).idToken;
  const b = await chromium.launch();
  const ctx = await newCtx(b);
  const page = await ctx.newPage();
  await login(page, email);
  // C: Add your venue -> opens add form
  await go(page, "/freelancer");
  await shot(page, "C0-dashboard");
  await page.getByTestId("first-run-step-venue").getByRole("button").click();
  await page.waitForTimeout(4000);
  check("C1 'Add a venue' lands on Locations tab with add form open", /tab=locations/.test(page.url()) && /add=1/.test(page.url()) && (await page.getByPlaceholder("e.g. Riverside Sports Hall").count()) > 0, page.url());
  await shot(page, "C1-add-venue-open");
  // address finder prefill
  const finder = page.getByPlaceholder(/Postcode or address/i).first();
  const nameBox = page.getByPlaceholder("e.g. Riverside Sports Hall");
  const hits = page.locator("div.max-h-\\[132px\\] button");
  await finder.fill("NN1 1AA");
  await page.getByRole("button", { name: "Find", exact: true }).first().click();
  await page.waitForTimeout(5000);
  await shot(page, "C2-address-results");
  if (await hits.count()) { await hits.first().click(); await page.waitForTimeout(800); }
  const afterPc = await nameBox.inputValue();
  check("C2 a postcode-only search does not put the postcode/town in the venue name", afterPc === "" || !/NN1/.test(afterPc), JSON.stringify(afterPc));
  await finder.fill("Stantonbury Leisure Centre Milton Keynes");
  await page.getByRole("button", { name: "Find", exact: true }).first().click();
  await page.waitForTimeout(5000);
  const nh = await hits.count();
  console.log("named-place hits", nh);
  if (nh > 0) {
    const label = (await hits.first().innerText()).trim();
    await hits.first().click(); await page.waitForTimeout(800);
    const nm = await nameBox.inputValue();
    const ad = await page.getByPlaceholder(/Street, town, postcode/i).inputValue();
    console.log("label:", label, "| name:", nm, "| addr:", ad);
    check("C3 a found named place pre-fills the venue name", nm.length > 1 && label.startsWith(nm), nm);
    check("C3b address box filled too", ad.length > 5, ad);
    await shot(page, "C3-name-prefilled");
    await nameBox.fill("Northampton Sports Hall");
    check("C3c venue name stays editable", (await nameBox.inputValue()) === "Northampton Sports Hall");
  } else {
    check("C3 a found named place pre-fills the venue name", false, "geocoder returned no hits for a named place");
    await nameBox.fill("Northampton Sports Hall");
    await page.getByPlaceholder(/Street, town, postcode/i).fill("1 High Street, Northampton");
  }
  // name typed first -> not overwritten by a later find
  await page.getByPlaceholder(/Postcode or address/i).first().fill("NN5 7EA");
  await page.getByRole("button", { name: "Find", exact: true }).first().click(); await page.waitForTimeout(4500);
  if (await hits.count()) { await hits.first().click(); await page.waitForTimeout(600); }
  check("C4 a later Find never overwrites a typed venue name", (await page.getByPlaceholder("e.g. Riverside Sports Hall").inputValue()) === "Northampton Sports Hall");
  await page.getByRole("button", { name: "Add", exact: true }).click(); await page.waitForTimeout(3500);
  await shot(page, "D1-venue-added");
  let txt = await body(page);
  check("D1 venue added shows green 'Venue added.' prompt", /Venue added\./.test(txt));
  check("D1b prompt offers next step 'Create a block'", /Ready for the next step: Create a block\?/.test(txt));
  // Not yet
  await page.getByRole("button", { name: /Not yet/ }).click(); await page.waitForTimeout(600);
  check("D2 'Not yet' hides the prompt", !/Venue added\./.test(await body(page)));
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(4000);
  check("D2b stays hidden on reload in the same session", !/Venue added\./.test(await body(page)));
  const ctx2 = await newCtx(b); const p2 = await ctx2.newPage(); await login(p2, email); await go(p2, "/freelancer/listings?tab=locations");
  check("D2c comes back in a new session", /Venue added\./.test(await body(p2)));
  await shot(p2, "D2c-prompt-new-session");
  // Next step button
  await p2.getByRole("button", { name: /Create a block/ }).first().click(); await p2.waitForTimeout(4000);
  check("D3 'Create a block' goes to the block step", /blocks/.test(p2.url()), p2.url());
  await shot(p2, "D3-blocks");
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
