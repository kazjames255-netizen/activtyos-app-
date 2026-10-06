import fs from "node:fs";
import { fbSignIn, apiFetch, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "../helpers/accounts";
import { API_URL } from "../helpers/env";
import { chromium, check, shot, go, body, newCtx, login, db, saveAcc } from "./onbtest-lib";
import { FieldValue } from "../../server/node_modules/firebase-admin/lib/firestore";

async function call(tok: string, method: string, url: string, b?: unknown) {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: b === undefined ? undefined : JSON.stringify(b) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const stamp = Date.now().toString(36);
(async () => {
  const b = await chromium.launch(); const ctx = await newCtx(b); const page = await ctx.newPage();
  // ---- company sign-up through the UI
  const email = `e2e-ob-co-${stamp}@${TEST_EMAIL_DOMAIN}`;
  await go(page, "/signup?plan=company");
  await shot(page, "K1-company-type");
  const moneyRe = /sort code|account number|stripe|bank details|card payments/i;
  check("K1 ?plan=company preselects Company", /Company/.test(await body(page)));
  await page.getByRole("button", { name: /Company/ }).first().click();
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(1200);
  await page.locator("#b-name").fill("Onboard Company Ltd"); await page.locator("#b-addr").fill("2 Park Road, Leeds"); await page.locator("#b-pc").fill("LS1 1AA"); await page.locator("#b-email").fill(email);
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(1000);
  await page.locator("button:has(span.text-\\[22px\\])").first().click();
  await page.getByRole("button", { name: /Continue/ }).last().click(); await page.waitForTimeout(1000);
  check("K2 company wizard reaches the login step with no money step in between", (await page.locator("#l-email").count()) > 0 && !moneyRe.test(await body(page)));
  await page.locator("#l-pw").fill(TEST_PASSWORD); await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Create account/ }).click();
  await page.waitForURL((u: URL) => /\/company/.test(u.pathname), { timeout: 60_000 }).catch(() => {}); await page.waitForTimeout(5000);
  check("K3 company sign-up lands in /company", /\/company/.test(page.url()), page.url());
  const tok = (await fbSignIn(email)).idToken;
  const me = await apiFetch<any>("/api/me", tok); saveAcc({ email, tenantId: me.tenantId, kind: "company-ui" });
  const lib0 = (await call(tok, "GET", "/api/library")).json;
  check("K3b login/contact email seeded as the reply-to (settings.billing.email)", (lib0?.settings?.billing?.email ?? "") === email, String(lib0?.settings?.billing?.email));
  let txt = await body(page);
  check("K4 company checklist has 6 steps incl. 'Invite your team'", /0 of 6 done/.test(txt) && /Invite your team/.test(txt), (txt.match(/\d of \d done/) ?? [""])[0]);
  await shot(page, "K4-company-checklist");
  // ---- server gates for the company tenant
  const venueId = "co-venue";
  await call(tok, "PUT", "/api/library", { venues: [{ id: venueId, name: "Leeds Hall", address: "2 Park Road", city: "Leeds" }], settings: lib0?.settings ?? {} });
  const period = (await call(tok, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" })).json;
  const pass = (await call(tok, "POST", "/api/passes", { name: "Day pass", days: 1 })).json;
  const bundle = (await call(tok, "POST", "/api/block-bundles", { name: "Block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true })).json;
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e2 = new Date(d); e2.setDate(e2.getDate() + 11);
  const mk = async (title: string, status: string) => (await call(tok, "POST", "/api/listings", { title, venueId, runFrom: iso(d), runTo: iso(e2), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "Day pass", price: 12, days: 1 }], bookingType: "auto", status, visibility: "public" }));
  const tref = db.collection("tenants").doc(me.tenantId);
  // new provider (status none)
  let r = await mk("Draft A", "draft"); const A = r.json.id;
  r = await call(tok, "PUT", `/api/listings/${A}`, { status: "live" });
  check("L1 new provider, no plan: publish refused (402 go_live_requirements)", r.status === 402 && r.json?.code === "go_live_requirements", `${r.status}`);
  r = await mk("Direct live A", "live");
  check("L1b creating a listing straight as live is also refused for a new provider", r.status === 402, `${r.status}`);
  // trial started, no bank
  await tref.set({ subscription: { status: "trialing", plan: "company" } }, { merge: true });
  r = await call(tok, "PUT", `/api/listings/${A}`, { status: "live" });
  check("L2 trial started but no bank details: publish refused with the bank message", r.status === 402 && /bank details/i.test(r.json?.error ?? ""), `${r.status} ${(r.json?.error ?? "").slice(0, 80)}`);
  // bank saved -> allowed
  const lib1 = (await call(tok, "GET", "/api/library")).json; const st = { ...(lib1.settings ?? {}) }; st.billing = { ...(st.billing ?? {}), bankName: "Barclays", sortCode: "20-57-44", accountNumber: "63437582" };
  await call(tok, "PUT", "/api/library", { settings: st });
  r = await call(tok, "PUT", `/api/listings/${A}`, { status: "live" });
  check("L3 with trial + bank details the listing publishes (200)", r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  // already-live edit never refused even if bank later removed
  const st2 = { ...st, billing: { ...st.billing, sortCode: "", accountNumber: "" } };
  await call(tok, "PUT", "/api/library", { settings: st2 });
  const cur = (await call(tok, "GET", `/api/listings/${A}`)).json;
  r = await call(tok, "PUT", `/api/listings/${A}`, { title: "Draft A renamed", status: "live", updatedAt: cur.updatedAt });
  check("L4 editing an ALREADY-live listing is never refused (even with no bank details)", r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  // legacy tenant: no subscription field, no bank
  await tref.update({ subscription: FieldValue.delete() });
  r = await mk("Legacy live", "live");
  check("L5 legacy tenant (no subscription record, no bank) can still publish", r.status === 201 || r.status === 200, `${r.status}`);
  // restore plan flow for UI checks
  await tref.set({ subscription: { status: "trialing", plan: "company" } }, { merge: true });
  await call(tok, "PUT", "/api/library", { settings: st });
  // ---- company prompts: venue -> block ... team
  const ctx2 = await newCtx(b); const p2 = await ctx2.newPage(); await login(p2, email);
  await go(p2, "/company/billing?tab=paid"); txt = await body(p2); await shot(p2, "K5-company-billing-paid");
  check("K5 company Billing > Get paid: bank details Required and 'Bank details saved.' prompt", /Required/.test(txt) && /Bank details saved\./.test(txt), (txt.match(/Ready for the next step[^\n]*/) ?? [""])[0]);
  // franchise invite
  const inv = await call(tok, "POST", "/api/invites", { role: "franchise", franchiseName: "Onboard North", franchiseArea: "Leeds" });
  console.log("invite", inv.status, JSON.stringify(inv.json).slice(0, 120));
  check("M1 head office can create a franchise invite", inv.status < 300 && !!inv.json?.token, `${inv.status}`);
  const fEmail = `e2e-ob-fr-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const ctx3 = await newCtx(b); const p3 = await ctx3.newPage();
  await go(p3, `/signup?invite=${inv.json.token}`, 5000); await shot(p3, "M2-franchise-invite");
  txt = await body(p3);
  check("M2 franchise invite page shows the granted name/area and no money questions", /Onboard North/.test(txt) && /Leeds/.test(txt) && !moneyRe.test(txt));
  await p3.locator("#iv-name").fill("Fran Chisee"); await p3.locator("#iv-email").fill(fEmail); await p3.locator("#iv-pw").fill(TEST_PASSWORD);
  await p3.getByRole("button", { name: /Join|Create/ }).last().click();
  await p3.waitForURL((u: URL) => /\/franchise/.test(u.pathname), { timeout: 60_000 }).catch(() => {}); await p3.waitForTimeout(5000);
  check("M3 franchise invite sign-up lands in /franchise", /\/franchise/.test(p3.url()), p3.url());
  await shot(p3, "M3-franchise-landing");
  saveAcc({ email: fEmail, tenantId: me.tenantId, kind: "franchise-invite" });
  txt = await body(p3);
  check("M4 franchise portal does not show a broken page", !/Something went wrong|Application error/i.test(txt));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
