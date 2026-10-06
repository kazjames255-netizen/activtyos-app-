import fs from "node:fs"; import path from "node:path";
import { TEST_PASSWORD } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed");
const sd = JSON.parse(fs.readFileSync(path.join(OUT, "seed.json"), "utf8"));
const ck = (id: string, ok: boolean, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`);
(async () => {
  const b = await chromium.launch();
  for (const [tag, w, h] of [["desk", 1440, 1000], ["phone", 390, 844]] as const) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 100))); p.on("dialog", (d: any) => { errs.push("ALERT " + d.message().slice(0, 40)); d.dismiss(); });
    await p.goto(`${WEB_URL}/login`, { waitUntil: "load" }); await p.waitForTimeout(3000);
    await p.getByPlaceholder("you@example.com").fill(sd.email); await p.locator('input[type="password"]').fill(TEST_PASSWORD);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(3000);
    await p.goto(`${WEB_URL}/freelancer/listings`, { waitUntil: "load" }); await p.waitForTimeout(5000);
    await p.getByRole("button", { name: "</> Embed" }).first().click(); await p.waitForTimeout(1200);
    const dlg = p.getByRole("dialog");
    ck(`${tag} panel opens as a dialog`, (await dlg.count()) === 1);
    const txt = (await dlg.innerText()) as string;
    ck(`${tag} shows the live listing only`, /embed live camp/i.test(txt) && !/embed draft camp/i.test(txt));
    ck(`${tag} storefront code visible in full`, txt.includes(`data-store="${sd.tenantId}"`));
    await p.screenshot({ path: path.join(OUT, `panel-${tag}-1-open.png`) });
    await dlg.getByRole("button", { name: "Copy code" }).first().click(); await p.waitForTimeout(500);
    const clip = (await p.evaluate(() => navigator.clipboard.readText())) as string;
    ck(`${tag} Copy puts the storefront code on the clipboard`, clip.includes(`/embed.js`) && clip.includes(`data-store="${sd.tenantId}"`), clip.slice(0, 80));
    ck(`${tag} Copy shows 'Copied'`, /copied/i.test((await dlg.innerText()) as string));
    // options rewrite the code
    await dlg.getByRole("radio", { name: /Show|Booking shown/i }).first().click().catch(() => {}); await p.waitForTimeout(300);
    ck(`${tag} inline option rewrites the code`, /data-mode="inline"/.test((await dlg.innerText()) as string));
    await dlg.getByRole("radio", { name: /Button that opens/i }).first().click(); await p.waitForTimeout(200);
    await dlg.getByPlaceholder("Book activities").fill('Book "now"'); await p.waitForTimeout(300);
    ck(`${tag} custom button text escaped in code`, /data-label="Book &quot;now&quot;"/.test((await dlg.innerText()) as string));
    await p.screenshot({ path: path.join(OUT, `panel-${tag}-2-options.png`) });
    // Escape closes, focus returns
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    ck(`${tag} Escape closes`, (await p.getByRole("dialog").count()) === 0);
    // per-listing: card's menu -> Embed on my website
    const card = p.locator('[data-ui="card"]').filter({ hasText: "Embed Live Camp" }).last();
    await card.locator("button", { hasText: "⋯" }).click(); await p.getByText("</> Embed on my website").click(); await p.waitForTimeout(1000);
    const t2 = (await p.getByRole("dialog").innerText()) as string;
    ck(`${tag} listing's own Embed opens the panel`, /embed live camp/i.test(t2));
    const focused = await p.evaluate(() => document.activeElement?.textContent ?? ""); ck(`${tag} focus lands in that listing row`, /copy code/i.test(focused), focused.slice(0, 30));
    await p.screenshot({ path: path.join(OUT, `panel-${tag}-3-listing.png`), fullPage: false });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ck(`${tag} no sideways scroll`, sw <= 1, String(sw));
    // Tab stays inside
    for (let i = 0; i < 25; i++) await p.keyboard.press("Tab");
    ck(`${tag} Tab stays inside the dialog`, await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
    // Test it link opens the sample page with a working embed
    const [pop] = await Promise.all([ctx.waitForEvent("page"), p.getByRole("dialog").getByRole("link", { name: "Test it on a sample page" }).nth(1).click()]);
    await pop.waitForLoadState("load"); await pop.waitForTimeout(2500);
    ck(`${tag} 'Test it' page renders the Book now button`, (await pop.getByRole("button", { name: /Book now|Book activities/ }).count()) >= 1);
    await pop.screenshot({ path: path.join(OUT, `panel-${tag}-4-testpage.png`) }); await pop.close();
    ck(`${tag} no alerts or page errors`, errs.length === 0, errs.join(";"));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
