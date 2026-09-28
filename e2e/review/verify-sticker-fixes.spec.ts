import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch as _f, apiPost as _p, fbSignIn as _s } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, settle, HUB, type Fx } from "./fixture";

// Adhoc verification for the sticker-book fixes (colour, title, year switcher, browse-topics removal, search bar).
// Throwaway @activityos-test.com accounts only, own fixture cache — never a real tenant.
const OUT = path.join(ROOT, "docs/reviews/shots/sticker-fixes");
const CACHE = path.join(ROOT, "e2e/review/.sticker-fixture.json");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(500_000);
  fs.mkdirSync(OUT, { recursive: true });
  if (fs.existsSync(CACHE) && !process.env.PJ_REBUILD) { fx = JSON.parse(fs.readFileSync(CACHE, "utf8")); }
  else { fx = await buildFixture(1, false, undefined, 3); fs.writeFileSync(CACHE, JSON.stringify(fx)); }
  // The owner-confirmed repro: Setup -> Teaching Hub "Lessons students can open" = every lesson in the library.
  const t = (await _s(fx.accounts.freelancer.email)).idToken;
  await _p(`${HUB}/config`, t, { hub: { lessonAccess: "all" } });
});

test("sticker book: colour, title, year switcher, family search", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
  await page.getByRole("button", { name: new RegExp(`Hand over to ${fx.kids[0].name}`) }).click({ timeout: 60_000 });
  await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 30_000 });
  await settle(page);
  await page.getByRole("tab", { name: /Lessons|Learn/ }).first().click().catch(() => undefined);
  await settle(page);
  await page.locator('[data-testid="curriculum-card"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  // 1) colour: no fully-desaturated "next" tiles.
  await page.screenshot({ path: path.join(OUT, "1-sticker-colour.png"), fullPage: true });

  // 2) title: must be real translated text, never a raw dotted i18n key.
  const titleText = await page.locator('[data-testid="curriculum-sticker-book"] h3').first().innerText();
  console.log("STICKER TITLE:", titleText);
  expect(titleText).not.toMatch(/hublessons\./);
  expect(titleText.toLowerCase()).toContain("all year group");

  // 3) year switcher actually changes the grid.
  const years = page.getByTestId("curriculum-years").getByRole("tab");
  const n = await years.count();
  console.log("YEAR PILLS:", n);
  const namesFor = () => page.locator('[data-testid="curriculum-sticker-book"] ul li span.font-extrabold').allInnerTexts();
  const before = await namesFor();
  console.log("YEAR", await years.nth(0).innerText(), "AREAS:", before);
  await page.screenshot({ path: path.join(OUT, "2-year-before.png"), fullPage: true });
  // click a topic tile open (a drawer) before switching year, to check it doesn't stay stale
  await page.locator('[data-testid="curriculum-sticker-book"] ul li button').first().click();
  await page.waitForTimeout(600);
  const drawerOpenBefore = await page.locator('[id^="hub-area-drawer-"]').count();
  console.log("DRAWER OPEN BEFORE SWITCH:", drawerOpenBefore);

  let changed = false;
  for (let i = 1; i < n && i < 6; i++) {
    await years.nth(i).click();
    await page.waitForTimeout(700);
    const label = await years.nth(i).innerText();
    const after = await namesFor();
    console.log("YEAR", label, "AREAS:", after);
    if (JSON.stringify(after) !== JSON.stringify(before)) changed = true;
    await page.screenshot({ path: path.join(OUT, `2-year-${i}-${label.replace(/\W+/g, "")}.png`), fullPage: true });
  }
  const drawerOpenAfter = await page.locator('[id^="hub-area-drawer-"]').count();
  console.log("DRAWER OPEN AFTER SWITCH:", drawerOpenAfter);
  expect(changed).toBe(true);
  expect(drawerOpenAfter).toBe(0); // switching year should not leave a stale drawer from the old year

  // 4) family "chips" TopicFilter: no "Browse topics" button, and a plain search bar exists.
  await page.getByRole("tab", { name: /Quizzes|Starting quizzes/ }).first().click().catch(() => undefined);
  await settle(page);
  await expect(page.getByText("Browse topics")).toHaveCount(0);
  const search = page.getByTestId("hub-topic-search");
  await expect(search).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "3-quizzes-search-bar.png"), fullPage: true });
  await ctx.close();
});
