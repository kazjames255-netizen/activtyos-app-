import { chromium, login, shot, go, rec, results, load } from "./hv-ui-lib";
import { call, db, tokFor } from "./hv-lib";
import fs from "node:fs";
(async () => {
  const S = load(); const L = S.listings; const b = await chromium.launch();
  const fa = await tokFor(S.accts.fa.email);
  const { page: pf } = await login(b, S.accts.fa.email);
  const skip = new Set(["id", "title", "name", "status", "createdAt", "updatedAt", "blocks", "bundle", "library", "mealMenus", "tenantName", "tenantId", "archived", "spotsLeft", "offers", "bestOfferPercent", "acceptsTFC", "acceptsVouchers", "timings", "location", "season", "categories", "visibility", "slug"]);
  for (const [key, title] of [["hvpc", "HV Postcode Visits"], ["hvrad", "HV Radius Visits"], ["online", "HV Online Tutoring"]] as const) {
    await go(pf, "/freelancer/listings");
    const card = pf.locator('[data-ui="card"]').filter({ hasText: title }).filter({ hasNotText: "(copy)" }).first();
    await card.getByRole("button", { name: "⋯" }).click(); await pf.waitForTimeout(500);
    await pf.getByText(/Duplicate/).first().click(); await pf.waitForTimeout(4500);
    const mine = ((await call(fa, "GET", "/api/listings?mine=1")).json ?? []) as any[];
    const src = (await call(fa, "GET", `/api/listings/${L[key].id}`)).json; const cp0 = mine.filter((l) => (l.title ?? l.name) === `${title} (copy)`).sort((a, b2) => (b2.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    const cp = cp0 ? (await call(fa, "GET", `/api/listings/${cp0.id}`)).json : null;
    const diffs: string[] = [];
    if (cp) for (const k of new Set([...Object.keys(src), ...Object.keys(cp)])) { if (skip.has(k) || src[k] === undefined || src[k] === null) continue; const x = JSON.stringify(src[k]), y = JSON.stringify(cp[k]); if (x !== y) diffs.push(`${k}`); }
    rec(`DUP ${title}: copy exists, is an unpublished draft, every setting identical`, !!cp && cp.status === "draft" && diffs.length === 0, `copy=${!!cp}; status=${cp?.status}; fields the source set that differ in the copy: ${diffs.join(", ") || "none"}; delivery=${cp?.deliveryMode} coverage=${JSON.stringify(cp?.coverageArea)} venue=${cp?.venueId}`);
    // open the copy in the wizard, change something on step 2 and save
    await go(pf, "/freelancer/listings");
    const cc = pf.locator('[data-ui="card"]').filter({ hasText: `${title} (copy)` }).first();
    await cc.getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
    await pf.getByText(/^Step 1 of 13/).waitFor({ timeout: 45000 });
    await pf.waitForTimeout(5000);
    const tfield = pf.getByPlaceholder(/Summer Multi-Activity/);
    await tfield.fill(`${title} (edited copy)`); await pf.waitForTimeout(800);
    await pf.getByRole("button", { name: /Next/ }).last().click(); await pf.waitForTimeout(2500);
    const s2 = await shot(pf, `hv-dup-${key}-step2`);
    const t2 = await pf.locator("body").innerText();
    const expectTxt = key === "online" ? /Sessions run online/ : /Coverage area/;
    rec(`DUP ${title}: copy opens in the wizard (step 2 shows ${key === "online" ? "the Online card" : "coverage area"}) and a title edit saves`, expectTxt.test(t2), "step 2 content ok: " + expectTxt.test(t2), s2);
    await pf.getByRole("button", { name: /Save draft/ }).first().click(); await pf.waitForTimeout(6000);
    const after = ((await call(fa, "GET", "/api/listings?mine=1")).json ?? []) as any[];
    rec(`DUP ${title}: edited copy title persisted; original untouched`, after.some((l) => (l.title ?? l.name) === `${title} (edited copy)`) && after.some((l) => (l.title ?? l.name) === title), "titles: " + after.filter((l) => (l.title ?? l.name).startsWith(title)).map((l) => l.title ?? l.name).join(" / "));
  }
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-ui-f.json", JSON.stringify(results, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
