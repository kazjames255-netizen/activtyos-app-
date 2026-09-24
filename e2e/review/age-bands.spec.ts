import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, handOver, settle, HUB, type Fx } from "./fixture";

// R-6 age bands: the child's enrolment yearGroup picks the layout. Year 1 = KS1 (three big icon tabs), Year 4 = KS2 (unchanged strip),
// Year 9 = teen (grown-up Home, no kid wording). No adult tab (Progress, Students, Tools, Live lessons list) may leak in any band.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/bands");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(400_000);
  fx = await buildFixture(3, false);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const years = ["Year 1", "Year 4", "Year 9"];
  for (const [i, k] of fx.kids.entries()) await apiFetch(`${HUB}/students/${k.id}`, t, { method: "PUT", body: JSON.stringify({ yearGroup: years[i] }) });
});

async function asChild(page: Page, i: number) {
  const kid = fx.kids[i];
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx);
  await settle(page);
  await handOver(page, kid.id);
  await settle(page);
  await expect(page.getByTestId("hub-home-kid")).toBeVisible({ timeout: 40_000 });
}
const ADULT = [/^Progress$/, /^Students$/, /^Tools$/, /^Live lessons$/];
async function noAdultTabs(page: Page) {
  for (const n of ADULT) await expect(page.getByRole("tab", { name: n })).toHaveCount(0);
  await expect(page.getByTestId("hub-parent-summary")).toHaveCount(0);
}

test("KS1 Year 1: three icon tabs, deep links keep working @390", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await asChild(page, 0);
  await expect(page.getByTestId("hub-home-kid")).toHaveAttribute("data-band", "ks1");
  await expect(page.getByTestId("kid-icon-tabs").getByRole("tab")).toHaveText(["Today", "Play & learn", "Stars"]);
  await expect(page.getByRole("tab", { name: "Notes" })).toHaveCount(0);
  await noAdultTabs(page);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, "ks1-home-390.png") });
  await page.getByTestId("kid-tab-play").click();
  await expect(page).toHaveURL(/tab=quizzes/);
  await expect(page.getByTestId("kid-tab-play")).toHaveAttribute("aria-selected", "true");
  await page.goto(`/custdash/learninghub?tab=flashcards&child=${fx.kids[0].id}`); // a deep link stays on the allow-list
  await expect(page.getByTestId("kid-tab-play")).toHaveAttribute("aria-selected", "true", { timeout: 40_000 });
  await page.goto(`/custdash/learninghub?tab=students&child=${fx.kids[0].id}`); // a tutor-only tab falls back to Today
  await expect(page.getByTestId("kid-tab-today")).toHaveAttribute("aria-selected", "true", { timeout: 40_000 });
  await ctx.close();
});

test("KS2 Year 4: the normal kid strip and Home @390", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await asChild(page, 1);
  await expect(page.getByTestId("hub-home-kid")).toHaveAttribute("data-band", "ks2");
  await expect(page.getByTestId("kid-icon-tabs")).toHaveCount(0);
  for (const n of ["Home", "Quizzes", "Homework", "Flashcards"]) await expect(page.getByRole("tab", { name: n, exact: true })).toBeVisible();
  await noAdultTabs(page);
  await page.screenshot({ path: path.join(OUT, "ks2-home-390.png") });
  await ctx.close();
});

for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`Teen Year 9: grown-up Home @${vp.width}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await ctxFor(browser, "parent", vp);
    const page = await ctx.newPage();
    await asChild(page, 2);
    await expect(page.getByTestId("hub-home-kid")).toHaveAttribute("data-band", "ks3");
    await expect(page.getByTestId("kid-icon-tabs")).toHaveCount(0);
    await expect(page.getByTestId("hub-kid-next")).toHaveCount(0); // no big next-step card
    await expect(page.getByTestId("hub-teen-due")).toBeVisible();
    const rows = page.getByTestId("hub-teen-row");
    expect(await rows.count()).toBeGreaterThan(0);
    for (let i = 0; i < await rows.count(); i++) await expect(rows.nth(i).getByRole("button", { name: /^Start/ })).toHaveCount(1);
    const body = await page.locator("#learning-hub").innerText();
    expect(body).not.toMatch(/Waiting for you|Getting there|Nearly there|streak|Well done/i);
    await noAdultTabs(page);
    await page.screenshot({ path: path.join(OUT, `teen-home-${vp.width}.png`) });
    await ctx.close();
  });
}
