import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { statePath, ROOT } from "../helpers/env";

// Teaching Hub shell in ro / ar (RTL) / cy / pl: screenshot each screen and list visible text still English.
// Reuses the standing e2e freelancer + parent sessions (read-only browsing; nothing is written).
const OUT = path.join(ROOT, "docs/i18n-hub-screenshots/hubshell");
const LOCALES = (process.env.HUB_LOCALES ?? "ro,ar,cy,pl").split(",");
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|a|an|it|no|not|yet|will|can|have|has)\b/i;

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
  for (const role of ["freelancer", "parent"] as const) {
    test(`hub shell ${role} in ${loc}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await browser.newContext({ storageState: statePath(role), viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
      const page = await ctx.newPage();
      fs.mkdirSync(OUT, { recursive: true });
      const base = role === "parent" ? "/custdash" : "/freelancer";
      const seen: string[] = [];
      const shot = async (name: string) => {
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(OUT, `${role}-${loc}-${name}.png`), fullPage: false });
        for (const s of await leftovers(page)) seen.push(`[${name}] ${s}`);
      };
      await page.goto(`${base}/learninghub`, { waitUntil: "load" });
      await page.waitForSelector("#learning-hub, #learning-hub-off", { timeout: 60_000 });
      await shot("home");
      if (role === "freelancer") {
        for (const top of ["lessons", "students", "quizzes", "homework", "messages", "progress"]) {
          const b = page.locator(`[data-top="${top}"]`).first();
          if (await b.count()) { await b.click(); await shot(`top-${top}`); }
        }
        for (const sub of ["live", "schedule", "tools", "flashcards", "enrol", "inbox"]) {
          const b = page.locator(`[data-sub="${sub}"]`).first();
          if (await b.count()) { await b.click().catch(() => undefined); await shot(`sub-${sub}`); await page.keyboard.press("Escape"); }
        }
        await page.goto(`${base}/setup?tab=hub`, { waitUntil: "load" });
        await shot("setup-hub");
      } else {
        for (const k of ["live", "quizzes", "homework", "notes", "flashcards", "dashboard", "questions"]) {
          const b = page.locator(`[data-panel="${k}"]`).first();
          if (await b.count()) { await b.click().catch(() => undefined); await shot(`tab-${k}`); }
        }
      }
      fs.writeFileSync(path.join(OUT, `${role}-${loc}-leftovers.txt`), seen.join("\n"));
      console.log(`${role}/${loc}: ${seen.length} possibly-English strings`);
      await ctx.close();
    });
  }
}
