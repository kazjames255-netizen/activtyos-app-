import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { API_URL } from "../helpers/env";
import { chromium, check, shot, go, body, newCtx, login, db, saveAcc } from "./onbtest-lib";

async function call(tok: string, method: string, url: string, b?: unknown) {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: b === undefined ? undefined : JSON.stringify(b) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
(async () => {
  const { email, tenantId, listingId } = JSON.parse(fs.readFileSync("/tmp/onb-fl2.json", "utf8"));
  const tok = (await fbSignIn(email)).idToken;
  const b = await chromium.launch(); const ctx = await newCtx(b); const page = await ctx.newPage(); await login(page, email);
  // Listings tab prompt (listing done)
  await go(page, "/freelancer/listings");
  let txt = await body(page);
  check("H1 Listings tab shows 'Listing created.' prompt after publishing", /Listing created\./.test(txt));
  check("H1b it points at the cancellation policy next", /Ready for the next step: Set your cancellation policy\?/.test(txt), (txt.match(/Ready for the next step[^\n]*/) ?? [""])[0]);
  await shot(page, "H1-listing-prompt");
  // Billing paid tab
  await go(page, "/freelancer/billing?tab=paid");
  txt = await body(page);
  check("H2 Billing > Get paid shows 'Your bank details' with Required", /Your bank details/.test(txt) && /Required/.test(txt));
  check("H2b payments step prompt shows ('Payments set up.')", /Payments set up\./.test(txt));
  check("H2c bank details prefilled from what was saved", (await page.locator("#bp-sort").inputValue()) === "20-57-44", await page.locator("#bp-sort").inputValue());
  await shot(page, "H2-billing-paid");
  // invalid save on billing page
  await page.locator("#bp-sort").fill("12"); await page.getByRole("button", { name: "Save bank details" }).click(); await page.waitForTimeout(1200);
  check("H3 Billing page also rejects a short sort code", /6 digits/.test(await body(page)));
  await page.locator("#bp-sort").fill("20-57-44"); await page.getByRole("button", { name: "Save bank details" }).click(); await page.waitForTimeout(1800);
  check("H3b valid details save ('Saved')", /Saved/.test(await body(page)));
  await page.getByRole("button", { name: /Your Activly plan|Your .* plan/ }).first().click(); await page.waitForTimeout(3000);
  await shot(page, "H4-billing-plan");
  txt = await body(page);
  check("H4 Billing > Your plan tab renders", /plan/i.test(txt) && !/Something went wrong/.test(txt));
  // cancellation page
  await go(page, "/freelancer/setup?tab=cancel");
  await shot(page, "H5-cancel-before");
  check("H5 cancellation step shows no 'done' prompt before it is done", !/Cancellation policy saved\./.test(await body(page)));
  const lib = (await call(tok, "GET", "/api/library")).json ?? {};
  const st = { ...(lib.settings ?? {}) }; st.cancellationPolicies = [{ id: "pol1", name: "Standard", rules: [{ daysBefore: 7, refundPercent: 100 }, { daysBefore: 0, refundPercent: 0 }] }];
  await call(tok, "PUT", "/api/library", { settings: st });
  await go(page, "/freelancer");
  txt = await body(page);
  check("H6 checklist shows 5 of 5 and the all-set message", /5 of 5 done/.test(txt) && /You're all set up/.test(txt), (txt.match(/\d of 5 done/) ?? [""])[0]);
  await shot(page, "H6-checklist-5of5");
  // booking -> established -> checklist hides
  const pEmail = `e2e-ob-par-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
  const ps = await fbSignUp(pEmail);
  await apiPost("/api/register-role", ps.idToken, { role: "parent" });
  saveAcc({ email: pEmail, kind: "parent" });
  const L = (await call(tok, "GET", `/api/listings/${listingId}`)).json;
  const blocks = (L.blocks ?? []).sort((a: any, c: any) => (a.startDate < c.startDate ? -1 : 1));
  const blk = blocks[0];
  const day = (blk?.sessions?.[0]?.date) ?? blk?.startDate;
  console.log("block", blk?.id, "day", day, "status", L.status);
  const bk = await call(ps.idToken, "POST", "/api/my/bookings", { listingId, blockId: blk?.id, method: "bank", items: [{ pass: "Day pass", child: "Test Child", age: 8, dates: [day] }] });
  console.log("booking", bk.status, JSON.stringify(bk.json).slice(0, 200));
  check("H7 a parent can book the newly live listing", bk.status < 300, `${bk.status}`);
  const ctx2 = await newCtx(b); const p2 = await ctx2.newPage(); await login(p2, email); await go(p2, "/freelancer");
  txt = await body(p2);
  await shot(p2, "H8-dashboard-established");
  check("H8 checklist hidden once a listing is published and a booking exists", !/Get set up to take bookings/.test(txt));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
