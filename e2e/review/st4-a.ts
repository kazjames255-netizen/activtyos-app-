import { fbSignIn, apiFetch } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, db } from "./st4-lib";
(async () => {
  const st = loadState();
  const b = await chromium.launch(); const ctx = await newCtx(b); const p = await ctx.newPage();
  await login(p, st.emails.co);
  await go(p, "/company/listings");
  await p.getByText("St4 One Staff Camp").first().waitFor({ timeout: 60000 });
  const card = p.locator('[data-ui="card"]').filter({ hasText: "St4 One Staff Camp" }).last();
  await card.getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
  await p.getByText(/^Step 1 of 13/).waitFor({ timeout: 45000 });
  for (let n = 1; n < 11; n++) { await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(450); }
  await p.waitForTimeout(2500);
  const hdr = await p.locator("text=/Step \\d+ of 13/").first().innerText();
  const s1 = await shot(p, "01-step11-initial");
  const txt = await body(p);
  check("S11-01 step 11 lists the real team (3 joined staff, no manual typing)", hdr.includes("Staff") && ["Sam Helper","Priya Coach","Tom Lead"].every((n) => txt.includes(n)), hdr, s1);
  check("S11-02 owner not listed as staff", !txt.includes("Olive Owner"), "", s1);
  // tick Sam and Priya
  for (const nm of ["Sam Helper", "Priya Coach"]) {
    const c = p.locator("div.rounded-xl.border").filter({ hasText: nm }).filter({ has: p.getByRole("button", { name: /Assign|On site/ }) }).last();
    await c.getByRole("button", { name: /^Assign/ }).click(); await p.waitForTimeout(500);
  }
  // bio for Priya
  const pc = p.locator("div.rounded-xl.border").filter({ hasText: "Priya Coach" }).last();
  await pc.locator("textarea").fill("Priya has coached for 8 years and holds a Level 3 coaching award.");
  await p.waitForTimeout(2500);
  const s2 = await shot(p, "02-step11-assigned");
  const t2 = await body(p);
  check("S11-03 assigned count shows 2 and buttons read On site", /2/.test(t2) && (t2.match(/On site/gi) ?? []).length >= 2, "", s2);
  // reload wizard to confirm persisted
  await p.waitForTimeout(3000);
  const tok = (await fbSignIn(st.emails.co)).idToken;
  const l = await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok);
  check("S11-04 listing saved staffIds [u_S1,u_S2] (autosave)", JSON.stringify([...(l.staffIds ?? [])].sort()) === JSON.stringify([`u_${st.staff.s1.uid}`, `u_${st.staff.s2.uid}`].sort()), JSON.stringify(l.staffIds));
  check("S11-05 library now holds the two adopted staff with the typed bio (what parents read)", (l.library?.staff ?? []).length === 2 && (l.library.staff.find((m: any) => m.first === "Priya")?.bio ?? "").includes("Level 3"), JSON.stringify((l.library?.staff ?? []).map((m: any) => `${m.first} ${m.last}:${(m.bio||"").slice(0,20)}`)));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
