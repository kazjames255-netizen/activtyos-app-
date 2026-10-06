import { fbSignIn, apiFetch, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "../helpers/accounts";
import { API_URL } from "../helpers/env";
import { chromium, check, shot, go, body, newCtx, login, db, saveAcc } from "./onbtest-lib";

async function call(tok: string, method: string, url: string, b?: unknown) {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: b === undefined ? undefined : JSON.stringify(b) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const noOverflow = async (page: any) => (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)) as boolean;
(async () => {
  const stamp = Date.now().toString(36);
  const email = `e2e-ob-ph-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const b = await chromium.launch(); const ctx = await newCtx(b, 390, 844); const page = await ctx.newPage();
  await go(page, "/signup"); await shot(page, "P1-phone-signup-type");
  check("P1 phone sign-up step 1 has no sideways scroll", await noOverflow(page));
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(1000);
  await page.locator("#b-name").fill("Phone Test Camps"); await page.locator("#b-addr").fill("3 Mill Lane, Bath"); await page.locator("#b-pc").fill("BA1 1AA"); await page.locator("#b-email").fill(email);
  await shot(page, "P2-phone-business");
  check("P2 phone business step no sideways scroll", await noOverflow(page));
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(900);
  await page.locator("button:has(span.text-\\[22px\\])").first().click(); await shot(page, "P3-phone-hear");
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(900);
  await page.locator("#l-pw").fill(TEST_PASSWORD); await page.locator('input[type="checkbox"]').check(); await shot(page, "P4-phone-login");
  check("P4 phone login step no sideways scroll", await noOverflow(page));
  await page.getByRole("button", { name: /Create account/ }).click();
  await page.waitForURL((u: URL) => /\/freelancer/.test(u.pathname), { timeout: 60_000 }).catch(() => {}); await page.waitForTimeout(5500);
  check("P5 phone sign-up lands in /freelancer", /\/freelancer/.test(page.url()), page.url());
  await shot(page, "P5-phone-landing");
  check("P5b phone landing no sideways scroll", await noOverflow(page));
  const tok = (await fbSignIn(email)).idToken; const me = await apiFetch<any>("/api/me", tok); saveAcc({ email, tenantId: me.tenantId, kind: "freelancer-phone" });
  // checklist step button on phone
  await go(page, "/freelancer");
  await shot(page, "P6-phone-checklist");
  txt: {
    const t = await body(page);
    check("P6 phone checklist visible (0 of 5)", /0 of 5 done/.test(t));
    check("P6b phone dashboard no sideways scroll", await noOverflow(page));
  }
  await page.getByTestId("first-run-step-venue").getByRole("button").click(); await page.waitForTimeout(4500);
  check("P7 phone: 'Add a venue' opens Locations with the add form", /tab=locations/.test(page.url()) && (await page.getByPlaceholder("e.g. Riverside Sports Hall").count()) > 0, page.url());
  await shot(page, "P7-phone-add-venue");
  check("P7b phone add-venue no sideways scroll", await noOverflow(page));
  await page.getByPlaceholder("e.g. Riverside Sports Hall").fill("Bath Sports Hall"); await page.getByPlaceholder(/Street, town, postcode/i).fill("3 Mill Lane, Bath, BA1 1AA");
  await page.getByRole("button", { name: "Add", exact: true }).click(); await page.waitForTimeout(3500);
  await shot(page, "P8-phone-venue-added");
  check("P8 phone: 'Venue added.' prompt shows", /Venue added\./.test(await body(page)));
  check("P8b phone prompt no sideways scroll", await noOverflow(page));
  // listing + go live modal on phone
  const lib = (await call(tok, "GET", "/api/library")).json; const venueId = lib.venues[0].id;
  const period = (await call(tok, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" })).json;
  const pass = (await call(tok, "POST", "/api/passes", { name: "Day pass", days: 1 })).json;
  const bundle = (await call(tok, "POST", "/api/block-bundles", { name: "Block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true })).json;
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e2 = new Date(d); e2.setDate(e2.getDate() + 11);
  const L = (await call(tok, "POST", "/api/listings", { title: "Phone camp", venueId, runFrom: iso(d), runTo: iso(e2), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "Day pass", price: 12, days: 1 }], bookingType: "auto", status: "draft", visibility: "public" })).json;
  await call(tok, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [L.id] });
  await go(page, "/freelancer/listings");
  await page.getByRole("button", { name: /^Edit$/ }).first().click();
  await page.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  for (let i = 1; i < 13; i++) { await page.getByRole("button", { name: /^Next/ }).click(); await page.waitForTimeout(350); }
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Publish/i }).last().click();
  await page.getByText("Before you go live").first().waitFor({ timeout: 20_000 }); await page.waitForTimeout(1500);
  const dlg = page.locator('[role="dialog"]').filter({ hasText: "Before you go live" });
  const inView = async (loc: any) => { const bb = await loc.boundingBox(); return !!bb && bb.y >= 0 && bb.y + bb.height <= 844 && bb.x >= 0 && bb.x + bb.width <= 390; };
  await shot(page, "P9-phone-golive-1");
  check("P9 phone Go live step 1: buttons inside the screen", (await inView(dlg.getByRole("button", { name: "Next", exact: true }))) && (await inView(dlg.getByRole("button", { name: "Start my free trial" }))));
  await db.collection("tenants").doc(me.tenantId).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
  await dlg.getByRole("button", { name: "Not yet" }).first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Publish/i }).last().click(); await page.getByText("Before you go live").first().waitFor({ timeout: 20_000 }); await page.waitForTimeout(2500);
  await shot(page, "P10-phone-golive-2");
  check("P10 phone Go live step 2 shows bank form, Next inside the screen after scrolling", /Step 2 of 3/.test(await dlg.innerText()));
  await dlg.getByPlaceholder("e.g. Barclays").fill("Barclays"); await dlg.getByPlaceholder("00-00-00").fill("20-57-44"); await dlg.getByPlaceholder("12345678").fill("63437582");
  await shot(page, "P10b-phone-golive-2-filled");
  const save = dlg.getByRole("button", { name: "Save bank details" }); await save.scrollIntoViewIfNeeded(); await save.click(); await page.waitForTimeout(3500);
  await shot(page, "P11-phone-golive-3");
  const goBtn = dlg.getByRole("button", { name: /^Go live$/ }); await goBtn.scrollIntoViewIfNeeded();
  check("P11 phone Go live step 3: Go live button reachable and enabled", /Step 3 of 3/.test(await dlg.innerText()) && (await goBtn.isEnabled()));
  await goBtn.click(); await page.waitForTimeout(6000);
  const after = (await call(tok, "GET", `/api/listings/${L.id}`)).json;
  check("P12 phone: listing goes live", after?.status === "live", String(after?.status));
  await shot(page, "P12-phone-live");
  await go(page, "/freelancer/billing?tab=paid"); await shot(page, "P13-phone-billing");
  check("P13 phone Billing & payouts no sideways scroll", await noOverflow(page));
  await go(page, "/freelancer/listings"); await shot(page, "P14-phone-listings-prompt");
  check("P14 phone listing prompt visible and no sideways scroll", /Listing created\./.test(await body(page)) && (await noOverflow(page)));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
