import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, ROOT } from "./helpers/env";
import { dismissParentWelcome } from "./helpers/ui";

// OWNER RULE: the publisher's name (and its licence credit / links) must never be visible anywhere. Two layers:
//  1. static: scripts/check-no-oak.mjs over app/ features/ lib/ components/ public/
//  2. live: crawl every hub tab as tutor and as parent and assert no visible text / aria-label / title / alt / placeholder / href
//     contains the word. Run: scripts/e2e-locked.sh e2e/no-oak.spec.ts
const RE = /\boak\b|oaknational|thenational\.academy|open government licen[cs]e/i;

test("static guard: no user-visible mention in the source tree", () => {
  expect(() => execFileSync("node", [path.join(ROOT, "scripts/check-no-oak.mjs")], { cwd: ROOT, stdio: "pipe" })).not.toThrow();
});

async function leaks(page: Page): Promise<string[]> {
  return page.evaluate((src) => {
    const re = new RegExp(src, "i"); const out: string[] = [];
    const t = document.body.innerText; if (re.test(t)) out.push("text: " + (t.match(new RegExp(".{0,40}(" + src + ").{0,40}", "i"))?.[0] ?? ""));
    for (const el of Array.from(document.querySelectorAll("*"))) for (const a of ["aria-label", "title", "alt", "placeholder", "href", "src", "aria-description", "aria-roledescription"]) {
      const v = el.getAttribute(a); if (v && re.test(v)) out.push(`${el.tagName}[${a}]=${v.slice(0, 80)}`);
    }
    return out;
  }, RE.source);
}
async function crawl(page: Page, url: string, label: string) {
  await page.goto(url);
  await page.getByRole("tab").first().waitFor({ state: "visible", timeout: 45_000 });
  const found: string[] = [];
  const grouped = (await page.locator('[role="tab"][data-top]').count()) > 0;
  const tabs = grouped ? page.locator('[role="tab"][data-top]') : page.getByRole("tab");
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = ((await tab.textContent()) ?? `tab${i}`).trim();
    await tab.click().catch(() => {});
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(400);
    for (const l of await leaks(page)) found.push(`${label} / ${name}: ${l}`);
    // sub-tabs of this top tab
    const subs = grouped ? page.locator('[role="tab"][data-sub]') : page.locator("#__none__");
    const sc = await subs.count();
    for (let j = 0; j < sc; j++) {
      const s = subs.nth(j);
      if (!(await s.isVisible().catch(() => false))) continue;
      await s.click().catch(() => {}); await page.waitForTimeout(300);
      for (const l of await leaks(page)) found.push(`${label} / ${name} / ${(await s.textContent())?.trim()}: ${l}`);
    }
  }
  expect(found, found.join("\n")).toEqual([]);
}

test("hub crawl (tutor): no Oak anywhere", async ({ browser }) => {
  test.setTimeout(600_000);
  loadAccounts();
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
  const page = await ctx.newPage();
  await crawl(page, "/freelancer/learninghub", "tutor");
  await ctx.close();
});

test("hub crawl (parent): no Oak anywhere", async ({ browser }) => {
  test.setTimeout(600_000);
  loadAccounts();
  const ctx = await browser.newContext({ storageState: statePath("parent") });
  const page = await ctx.newPage();
  await page.goto("/custdash");
  await dismissParentWelcome(page);
  await crawl(page, "/custdash/learninghub", "parent");
  await ctx.close();
});
