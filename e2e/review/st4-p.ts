import { fbSignIn, apiFetch } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, openWizard } from "./st4-lib";
(async () => {
  const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken;
  const b = await chromium.launch(); const c = await newCtx(b); const p = await c.newPage(); await login(p, st.emails.co);
  await openWizard(p, "/company", "St4 No Staff Camp", 11);
  const row = (n: string) => p.locator("div.rounded-xl.border").filter({ hasText: n }).last();
  await row("Priya Coach").getByRole("button", { name: /^Assign/ }).click(); await p.waitForTimeout(600);
  await row("Nina New").getByRole("button", { name: /^Assign/ }).click(); await p.waitForTimeout(600);
  // typed words then Write with AI
  await row("Nina New").locator("textarea").fill("friendly, patient, 3 years"); await p.waitForTimeout(400);
  await row("Nina New").getByRole("button", { name: /Write with AI/ }).click(); await p.waitForTimeout(1500);
  const nina = await row("Nina New").locator("textarea").inputValue();
  const s = await shot(p, "20-L3-step11-two-assigned");
  check("S11-08 'Write with AI' turns a few typed words into a parent-facing bio", nina.length > 25 && /Nina/.test(nina), nina.slice(0, 90), s);
  await p.waitForTimeout(3000); await c.close();
  const l3 = await apiFetch<any>(`/api/listings/${st.listings.L3}`, tok); const l2 = await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok);
  check("S11-09 same person on several listings: Priya on L2 and L3, Nina only on L3", (l3.staffIds ?? []).length === 2 && (l2.staffIds ?? []).length === 1 && l3.staffIds.includes(l2.staffIds[0]), JSON.stringify({ L2: l2.staffIds?.length, L3: l3.staffIds?.length }));
  const c2 = await newCtx(b); const pp = await c2.newPage();
  await go(pp, `/book/${st.listings.L3}`, 6000); let t = await body(pp); const s3 = await shot(pp, "21-parent-L3-two-staff");
  await go(pp, `/book/${st.listings.L2}`, 6000); const t2 = await body(pp);
  check("S11-10 parent pages: L3 shows Priya + Nina; L2 still shows only Priya", t.includes("Priya Coach") && t.includes("Nina New") && t2.includes("Priya Coach") && !t2.includes("Nina New"), "", s3);
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
