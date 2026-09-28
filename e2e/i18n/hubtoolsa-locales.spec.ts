import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { statePath, ROOT } from "../helpers/env";

// Teaching Hub maths-side tools (geometry board, angle facts, coordinate grid, card sort / Venn / sequencer) in ro / ar (RTL) / cy / pl.
// a legacy prototype widget) opened in their floating window — screenshot each and list visible text still English.
// Reuses the standing e2e freelancer session (read-only browsing; nothing is written).
const OUT = path.join(ROOT, "docs/i18n-hub-screenshots/hubtoolsa");
const LOCALES = (process.env.HUB_LOCALES ?? "ro,ar,cy,pl").split(",");
const TOOLS = (process.env.HUB_TOOLS ?? "M-02,M-04,M-09,M-21,M-01,X-05,X-07,S-16,H-H02").split(",");
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|a|an|it|no|not|yet|will|can|have|has|click|drag|tap|then)\b/i;

async function leftovers(page: Page): Promise<string[]> {
  return page.evaluate((stop) => {
    const re = new RegExp(stop, "i"); const out = new Set<string>();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement; const s = (n.textContent ?? "").trim();
      if (!el || !s || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !/[A-Za-z]{3}/.test(s)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const words = s.split(/\s+/); if (words.length >= 2 && re.test(s)) out.add(s.slice(0, 110));
    }
    return [...out];
  }, STOP.source);
}

for (const loc of LOCALES) {
  test(`hub tools in ${loc}`, async ({ browser }) => {
    test.setTimeout(420_000);
    const ctx = await browser.newContext({ storageState: statePath("freelancer"), viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
    const page = await ctx.newPage();
    fs.mkdirSync(OUT, { recursive: true });
    const seen: string[] = [];
    const shot = async (name: string) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `${loc}-${name}.png`), fullPage: false });
      for (const s of await leftovers(page)) seen.push(`[${name}] ${s}`);
    };
    await page.goto("/freelancer/learninghub", { waitUntil: "load" });
    await page.waitForSelector("#learning-hub, #learning-hub-off", { timeout: 60_000 });
    const b = page.locator(`[data-sub="tools"]`).first();
    await b.click(); await page.waitForSelector("#hub-tools", { timeout: 30_000 });
    await shot("catalogue");
    for (const id of TOOLS) {
      const card = page.getByTestId(`tool-${id}`).first();
      if (!(await card.count())) { seen.push(`[${id}] tool card not found`); continue; }
      await card.scrollIntoViewIfNeeded(); await card.click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await shot(`tool-${id}`);
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      const close = page.getByRole("button", { name: /^(Close|Cerrar|Închide|Zamknij|Cau|إغلاق|بند|ਬੰਦ|বন্ধ|Fermer|Fechar).*/i }).last();
      if (await page.locator("[data-tool-chrome], .aos-light").first().isVisible().catch(() => false)) await close.click({ timeout: 2000 }).catch(() => undefined);
    }
    fs.writeFileSync(path.join(OUT, `${loc}-leftovers.txt`), seen.join("\n"));
    console.log(`tools/${loc}: ${seen.length} possibly-English strings`);
    await ctx.close();
  });
}
