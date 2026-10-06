import fs from "node:fs";
import { fbSignIn, apiFetch, apiPost } from "../helpers/accounts";
import { API_URL } from "../helpers/env";
import { chromium, check, shot, go, body, newCtx, login, db } from "./onbtest-lib";

async function call(tok: string, method: string, url: string, b?: unknown) {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: b === undefined ? undefined : JSON.stringify(b) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
(async () => {
  const { email, tenantId } = JSON.parse(fs.readFileSync("/tmp/onb-fl.json", "utf8"));
  const tok = (await fbSignIn(email)).idToken;
  // reset state so the script can be re-run: no plan, no bank details
  await db.collection("tenants").doc(tenantId).set({ subscription: { status: "none", plan: "freelancer" } }, { merge: true });
  { const ref = db.collection("libraries").doc(tenantId); const cur = (await ref.get()).data() ?? {}; const st = { ...(cur.settings ?? {}) }; st.billing = { ...(st.billing ?? {}), sortCode: "", accountNumber: "", bankName: "", email: "" }; await ref.set({ settings: st }, { merge: true }); }
  const lib = (await call(tok, "GET", "/api/library")).json ?? {};
  const venueId = lib.venues?.[0]?.id;
  console.log("venue", venueId);
  // block via API
  const period = (await call(tok, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" })).json;
  const pass = (await call(tok, "POST", "/api/passes", { name: "Day pass", days: 1 })).json;
  const bundle = (await call(tok, "POST", "/api/block-bundles", { name: "Half term camp block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true })).json;
  const b = await chromium.launch();
  const ctx = await newCtx(b); const page = await ctx.newPage(); await login(page, email);
  await go(page, "/freelancer/listings?tab=blocks");
  let txt = await body(page);
  check("E1 block created shows 'Block created.' prompt on Blocks tab", /Block created\./.test(txt));
  check("E1b prompt offers 'Create and publish your first listing'", /Ready for the next step: Create and publish your first listing\?/.test(txt));
  await shot(page, "E1-block-prompt");
  await page.getByRole("button", { name: /Not yet/ }).click(); await page.waitForTimeout(500);
  check("E2 Not yet hides block prompt", !/Block created\./.test(await body(page)));
  // New listing wizard opens
  await go(page, "/freelancer/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click(); await page.waitForTimeout(3500);
  check("E3 'New listing' opens the 13-step wizard", /Step 1 of 13/.test(await body(page)));
  await shot(page, "E3-wizard-step1");
  await page.getByRole("button", { name: "×", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(800);
  // draft listing by API
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e = new Date(d); e.setDate(e.getDate() + 11);
  const L = (await call(tok, "POST", "/api/listings", { title: "Half term multi-activity camp", venueId, runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "Day pass", price: 12, days: 1 }], bookingType: "auto", status: "draft", visibility: "public" })).json;
  await call(tok, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [L.id] });
  console.log("listing", L.id);
  // server gate: status none
  let r = await call(tok, "PUT", `/api/listings/${L.id}`, { status: "live" });
  check("G1 server refuses publish before the free trial (402 go_live_requirements)", r.status === 402 && r.json?.code === "go_live_requirements" && /free trial/i.test(r.json?.error ?? ""), `${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
  // open wizard -> publish -> modal step 1
  await go(page, "/freelancer/listings");
  await page.getByRole("button", { name: /^Edit$/ }).first().click();
  await page.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  for (let i = 1; i < 13; i++) { await page.getByRole("button", { name: /^Next/ }).click(); await page.waitForTimeout(350); }
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Publish/i }).last().click();
  await page.getByText("Before you go live").first().waitFor({ timeout: 20_000 }); await page.waitForTimeout(1500);
  const dlg = page.locator('[role="dialog"]');
  txt = await dlg.innerText();
  check("G2 Go live pop-up shows 'Step 1 of 3' with the free trial", /Step 1 of 3/.test(txt) && /free trial/i.test(txt));
  check("G2b Next is disabled until the trial has started", await dlg.getByRole("button", { name: "Next", exact: true }).isDisabled());
  check("G2c Go live is not offered on step 1", (await dlg.getByRole("button", { name: /^Go live$/ }).count()) === 0);
  await shot(page, "G2-golive-step1");
  // trial started (seed) -> reopen
  await db.collection("tenants").doc(tenantId).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
  r = await call(tok, "PUT", `/api/listings/${L.id}`, { status: "live" });
  check("G3 server refuses publish without bank details once trial started (402 bank message)", r.status === 402 && /bank details/i.test(r.json?.error ?? ""), `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  await dlg.getByRole("button", { name: "Not yet" }).first().click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Publish/i }).last().click();
  await page.getByText("Before you go live").first().waitFor({ timeout: 20_000 }); await page.waitForTimeout(2500);
  txt = await dlg.innerText();
  check("G4 once the trial has started the pop-up opens on step 2 (bank details)", /Step 2 of 3/.test(txt) && /Your bank details/.test(txt) && /Required/.test(txt), txt.slice(0, 120).replace(/\n/g, " | "));
  check("G4b Next disabled while bank details are missing", await dlg.getByRole("button", { name: "Next", exact: true }).isDisabled());
  check("G4c card payments shown as optional", /optional/i.test(txt) && /Connect Stripe/.test(txt));
  check("G4d no cash-only option any more", !/only take cash/i.test(txt));
  await shot(page, "G4-golive-step2-empty");
  // validation: short sort code
  await dlg.getByPlaceholder("e.g. Barclays").fill("Barclays");
  await dlg.getByPlaceholder("00-00-00").fill("12");
  await dlg.getByPlaceholder("12345678").fill("99");
  await dlg.getByRole("button", { name: "Save bank details" }).click(); await page.waitForTimeout(1500);
  txt = await dlg.innerText();
  check("G5 short sort code / account number rejected with a message", /6 digits/.test(txt) && (await dlg.getByRole("button", { name: "Next", exact: true }).isDisabled()), txt.slice(0, 200).replace(/\n/g, " | "));
  await shot(page, "G5-golive-bank-invalid");
  await dlg.getByPlaceholder("00-00-00").fill("20-57-44");
  await dlg.getByPlaceholder("12345678").fill("63437582");
  await dlg.getByRole("button", { name: "Save bank details" }).click(); await page.waitForTimeout(3500);
  txt = await dlg.innerText();
  check("G6 saving valid bank details moves on to step 3 by itself", /Step 3 of 3/.test(txt), txt.slice(0, 160).replace(/\n/g, " | "));
  await shot(page, "G6-golive-after-bank-saved");
  txt = await dlg.innerText();
  check("G7 step 3 asks where replies go, prefilled with the login email", /Step 3 of 3/.test(txt) && (await dlg.getByLabel("Reply-to email").inputValue()) === email);
  await shot(page, "G7-golive-step3");
  await dlg.getByLabel("Reply-to email").fill("not-an-email");
  check("G7b Go live disabled with an invalid reply-to", await dlg.getByRole("button", { name: /Go live/ }).isDisabled());
  await dlg.getByLabel("Reply-to email").fill("support@onboard-test-camps.co.uk");
  await dlg.getByRole("button", { name: "Back" }).click(); await page.waitForTimeout(800);
  check("G8 Back returns to step 2 with the bank tick kept", /Step 2 of 3/.test(await dlg.innerText()) && /Bank details saved/.test(await dlg.innerText()));
  await dlg.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(800);
  await dlg.getByRole("button", { name: /^Go live$/ }).click(); await page.waitForTimeout(6000);
  const after = (await call(tok, "GET", `/api/listings/${L.id}`)).json;
  check("G9 Go live publishes the listing", after?.status === "live", String(after?.status));
  const lib2 = (await call(tok, "GET", "/api/library")).json;
  check("G9b reply-to saved to settings.billing.email", lib2?.settings?.billing?.email === "support@onboard-test-camps.co.uk", String(lib2?.settings?.billing?.email));
  check("G9c pop-up closed after going live", (await page.locator('[role="dialog"]').filter({ hasText: "Before you go live" }).count()) === 0);
  await shot(page, "G9-after-golive");
  fs.writeFileSync("/tmp/onb-fl2.json", JSON.stringify({ email, tenantId, listingId: L.id, bundleId: bundle.id, venueId }));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
