import { test, expect, type Page } from "@playwright/test";
import { buildFixture, ctxFor, VIEWPORTS, type Fx } from "./fixture";

// Builder A verification (P-05/P-07/P-10): deep links + aliases, focus after tab switch, Escape (topmost only), friendly offline error, on-brand token.
//   npx playwright test e2e/review/hub-shell-a11y-links.spec.ts --project=e2e --workers=1
const KIDKEY = "aos.hub.kid";
test.describe.configure({ mode: "default" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(300_000); fx = await buildFixture(2, false); });

// The panel key on screen. Tutors: the selected sub-tab's panel, or (top tabs with no sub-row) the top tab's panel; parents / kids: the flat tab's.
const selected = async (page: Page) => {
  const t = page.locator('[role="tab"][aria-selected="true"]').first();
  await t.waitFor({ timeout: 120_000 });
  const sub = page.locator('[role="tab"][data-sub][aria-selected="true"]');
  if (await sub.count()) return sub.first().getAttribute("data-panel");
  const top = await page.locator('[role="tab"][data-top][aria-selected="true"]').first().getAttribute("data-top").catch(() => null);
  if (top) return ({ progress: "dashboard", messages: "questions" } as Record<string, string>)[top] ?? top;
  return t.getAttribute("data-panel");
};
// Cheap navigation (the shared dev server is busy): no per-link feature toggle, just wait for the tab strip.
async function open(page: Page, url: string) { await page.goto(url, { waitUntil: "domcontentloaded" }); await page.locator('[role="tab"][aria-selected="true"]').first().waitFor({ timeout: 120_000 }); }

for (const vpName of ["390", "1440"] as const) {
  test(`tutor links + focus + escape @${vpName}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await ctxFor(browser, "freelancer", VIEWPORTS[vpName]);
    const page = await ctx.newPage();
    for (const [q, want] of [["diagnostic", "diagnostic"], ["tools", "tools"], ["questions", "questions"], ["starting-quizzes", "diagnostic"], ["messages", "questions"], ["nonsense", "home"]] as const) {
      await open(page, `/freelancer/learninghub?tab=${q}`);
      expect(await selected(page), `?tab=${q}`).toBe(want);
    }
    const lab = async (sel: string) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();
    await open(page, "/freelancer/learninghub?tab=diagnostic");
    expect(await lab('[role="tab"][data-sub="starting"]')).toMatch(/Starting quizzes/);
    expect(await lab('[role="tab"][data-top="messages"]')).toMatch(/Messages/);
    // focus moves into the panel after a click, page does not jump, title follows
    await open(page, "/freelancer/learninghub?tab=home");
    await page.locator('[role="tab"][data-top="quizzes"]').click();
    await page.locator('[role="tab"][data-sub="quizzes"]').click();
    await page.waitForTimeout(1500);
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("#hub-tabpanel-quizzes"))).toBe(true);
    expect(await page.title()).toMatch(/^Quizzes - Teaching Hub/);
    // arrow keys keep focus on the strip
    await page.locator('[role="tab"][aria-selected="true"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("tab");
    // Escape closes the dialog only
    await open(page, "/freelancer/learninghub?tab=home");
    await page.locator('[role="tab"][data-top="homework"]').click();
    await page.locator('[role="tab"][data-sub="set"]').click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // on-brand token present and a readable value
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("learning-hub")!).getPropertyValue("--on-brand").trim())).toMatch(/^#(fff|ffffff|171534)$/i);
    await ctx.close();
  });

  test(`parent + kid links @${vpName}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await ctxFor(browser, "parent", VIEWPORTS[vpName]);
    const page = await ctx.newPage();
    const base = `/custdash/learninghub?child=${fx.kids[0].id}`;
    await open(page, `${base}&tab=diagnostic`);
    expect(await selected(page)).toBe("diagnostic");
    expect((await page.locator('[role="tab"][data-panel="diagnostic"]').innerText()).trim()).toMatch(/^Starting quizzes/);
    await open(page, `${base}&tab=questions`);
    expect(await selected(page)).toBe("questions");
    // Kid mode set the way "Hand over" stores it (sessionStorage), so this checks routing, not the hand-over button.
    await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [KIDKEY, JSON.stringify({ t: fx.tenantId, c: fx.kids[0].id })]);
    await open(page, `${base}&tab=home`);
    await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 60_000 });
    for (const [q, want] of [["diagnostic", "diagnostic"], ["placement", "diagnostic"], ["tools", "home"]] as const) {
      await open(page, `${base}&tab=${q}`);
      expect(await selected(page), `kid ?tab=${q}`).toBe(want);
    }
    expect((await page.locator('[role="tab"][data-panel="diagnostic"]').innerText()).trim()).toMatch(/^Starting quiz$/);
    await ctx.close();
  });
}

test("offline error is friendly with Try again (parent)", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", VIEWPORTS["390"]);
  const page = await ctx.newPage();
  await open(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`);
  await page.route("**/api/learning-hub/**", (r) => r.abort());
  await page.locator('[role="tab"][data-panel="notes"]').click();
  const alert = page.locator("#learning-hub [role=alert]").filter({ hasText: /\S/ }).first();
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const t = await alert.innerText();
  console.log("ALERT:", t.replace(/\s+/g, " "));
  expect(t).not.toMatch(/localhost|Is the API running|15s/);
  await ctx.close();
});
