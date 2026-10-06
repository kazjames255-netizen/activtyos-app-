import { chromium, newCtx, login, check, loadState, openWizard } from "./st4-lib";
(async () => {
  const st = loadState(); const b = await chromium.launch(); const c = await newCtx(b); const p = await c.newPage(); await login(p, st.emails.co);
  await openWizard(p, "/company", "St4 No Staff Camp", 11);
  const row = p.locator("div.rounded-xl.border").filter({ hasText: "Tom Lead" }).last();
  const outs: string[] = [];
  await row.locator("textarea").fill("football, patient"); 
  for (let i = 0; i < 3; i++) { await row.getByRole("button", { name: /Write with AI/ }).click(); await p.waitForTimeout(700); outs.push(await row.locator("textarea").inputValue()); }
  console.log(outs.join("\n"));
  check("S11-08b AI bios no longer claim 'DBS-checked', 'first-aid trained' or 'qualified' (unverified claims about a real person shown to parents)", outs.every((o) => o.length > 20 && !/DBS|first-aid|qualified/i.test(o)), outs[0].slice(0, 100));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
