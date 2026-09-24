import { test, expect, type Page } from "@playwright/test";
import { buildFixture, ctxFor, gotoHubPage, VIEWPORTS, type Fx } from "./fixture";

// Grouped tutor tabs (docs/teaching-hub-review/07-changes/N-grouped-tabs.md): seven top tabs with sub-tabs; the six Home quick-action tiles
// are gone; every old ?tab= deep link lands on the right top tab + sub-tab; parents and children keep their flat strips.
//   npx playwright test -c playwright.review.config.ts e2e/review/tabs-subtabs.spec.ts --workers=1
const KIDKEY = "aos.hub.kid";
test.describe.configure({ mode: "default" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(300_000); fx = await buildFixture(2, false); });

const top = (page: Page) => page.locator('[role="tab"][data-top][aria-selected="true"]');
const sub = (page: Page) => page.locator('[role="tab"][data-sub][aria-selected="true"]');
async function open(page: Page, url: string) { await page.goto(url, { waitUntil: "domcontentloaded" }); await page.locator('[role="tab"][aria-selected="true"]').first().waitFor({ timeout: 120_000 }); }
const clickTop = (page: Page, id: string) => page.locator(`[role="tab"][data-top="${id}"]`).click();
const clickSub = (page: Page, id: string) => page.locator(`[role="tab"][data-sub="${id}"]`).click();
/** Reach a sub-view: its sub-tab (side card or pill row), clicking the top tab first when that tab's sub-sections aren't showing. */
async function goSub(page: Page, topId: string, subId: string) {
  const s = page.locator(`[role="tab"][data-sub="${subId}"]`);
  if (!(await s.isVisible().catch(() => false))) { await clickTop(page, topId); await s.waitFor({ timeout: 20_000 }); }
  return s.click();
}

const LINKS: [string, string, string | null][] = [
  ["tab=home", "home", null],
  ["tab=notes", "lessons", "lessons"],
  ["tab=live", "lessons", "live"],
  ["tab=tools", "lessons", "tools"],
  ["tab=flashcards", "lessons", "flashcards"],
  ["tab=students", "students", "students"],
  ["tab=dashboard", "progress", null],
  ["tab=quizzes", "quizzes", "quizzes"],
  ["tab=diagnostic", "quizzes", "starting"],
  ["tab=placement", "quizzes", "starting"],
  ["tab=homework", "homework", "mark"],
  ["tab=questions&open=doubt:x", "messages", null],
  ["tab=messages", "messages", null],
  ["tab=lessons", "lessons", "lessons"],
  ["tab=progress", "progress", null],
  ["tab=live&sub=schedule", "lessons", "schedule"],
  ["tab=homework&sub=inbox", "homework", "inbox"],
  ["tab=quizzes&sub=newquiz", "quizzes", "newquiz"],
  ["tab=nonsense", "home", null],
];

for (const vpName of ["390", "1440"] as const) {
  test(`tutor: old deep links land on the right top + sub tab @${vpName}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const ctx = await ctxFor(browser, "freelancer", VIEWPORTS[vpName]);
    const page = await ctx.newPage();
    await gotoHubPage(page, "/freelancer/learninghub?tab=home", fx);
    for (const [q, wantTop, wantSub] of LINKS) {
      await open(page, `/freelancer/learninghub?${q}`);
      await expect(top(page), `?${q} top`).toHaveAttribute("data-top", wantTop, { timeout: 60_000 });
      if (wantSub) await expect(sub(page), `?${q} sub`).toHaveAttribute("data-sub", wantSub, { timeout: 60_000 });
      else await expect(sub(page), `?${q} has no sub row`).toHaveCount(0);
    }
    await ctx.close();
  });

  test(`tutor: Home has no quick-action tiles; sub-tabs open the existing flows @${vpName}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const ctx = await ctxFor(browser, "freelancer", VIEWPORTS[vpName]);
    const page = await ctx.newPage();
    await gotoHubPage(page, "/freelancer/learninghub?tab=home", fx);
    await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("navigation", { name: "Quick actions" })).toHaveCount(0);
    await expect(page.locator("#hub-home-tutor").getByRole("button", { name: /^(New lesson|New quiz|Set homework|Schedule video lesson|Enrol student|Teach in person)\b/ })).toHaveCount(0);
    // seven top tabs, each with an emoji, Home first
    const tops = page.locator('[role="tab"][data-top]');
    await expect(tops).toHaveText([/🏠 ?Home/, /📚 ?Lessons/, /🧑‍🎓 ?Students/, /📈 ?Progress/, /📝 ?Quizzes/, /📓 ?Homework/, /💬 ?Messages/]);
    await expect(page.locator('[role="tab"][data-sub]')).toHaveCount(0); // Home has no sub-row

    // Lessons: opening the top tab shows its sub-sections AND the default page at once (no extra tap, no separate landing page).
    await clickTop(page, "lessons");
    await expect(page.locator('[role="tab"][data-sub]')).toHaveText([/Lessons & curriculum/, /Live lessons/, /Schedule video lesson/, /Teach in person/, /Tools/, /Flashcards/]);
    await expect(sub(page)).toHaveAttribute("data-sub", "lessons");
    await expect(page.locator("#hub-tabpanel-notes")).toBeVisible({ timeout: 30_000 });
    // Layout: ONE full-width gradient card at the top with the sub-sections across it in a row, the live page directly underneath (every width).
    const panel = (await page.locator("#hub-tabpanel-notes").boundingBox())!;
    const card = page.getByTestId("hub-submenu");
    await expect(card).toBeVisible();
    await expect(page.locator('[role="tablist"][aria-orientation="vertical"]')).toHaveCount(0);
    const cb = (await card.boundingBox())!;
    expect(panel.y, "page sits under the card").toBeGreaterThanOrEqual(cb.y + cb.height - 1);
    const strip = (await page.locator('[role="tab"][data-top]').first().locator("xpath=ancestor::div[@role=\"tablist\"]/../..").boundingBox())!;
    expect(cb.width, "card spans the page content width").toBeGreaterThan(strip.width * 0.9);
    const items = page.locator('[data-testid="hub-submenu"] [role="tab"]');
    for (const r of await items.all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const t of await page.locator('[data-testid="hub-submenu"] [role="tab"] > span[aria-hidden]:first-child').all()) { const b = (await t.boundingBox())!; expect(b.width, "emoji tile size").toBeGreaterThanOrEqual(40); }
    const boxes = await Promise.all((await items.all()).map((r) => r.boundingBox()));
    if (vpName === "1440") expect(new Set(boxes.map((b) => Math.round(b!.y))).size, "all six items in one row").toBe(1);
    else {
      const sc = await page.locator('[data-testid="hub-submenu"] [role="tablist"]').evaluate((el) => ({ sw: (el.parentElement as HTMLElement).scrollWidth, cw: (el.parentElement as HTMLElement).clientWidth }));
      expect(sc.sw, "the row scrolls sideways at phone width").toBeGreaterThan(sc.cw);
    }
    await clickSub(page, "schedule"); // an action item opens the existing dialog over the page
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await clickSub(page, "teach");
    await expect(page.getByTestId("inperson-app")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("inperson-app").getByRole("button", { name: /close|exit|back|cancel/i }).first().click();
    await expect(page.getByTestId("inperson-app")).toHaveCount(0);
    await expect(sub(page)).toHaveAttribute("data-sub", "lessons");

    // Students -> Enrol a student opens the existing form
    await clickTop(page, "students");
    await expect(page.locator('[role="tab"][data-sub]')).toHaveText([/Students/, /Enrol a student/]);
    await clickSub(page, "enrol");
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");

    // Quizzes: three items; New quiz opens the builder. Homework: To mark straight away when anything waits, else Inbox; Set homework opens the form.
    await clickTop(page, "quizzes");
    await expect(page.locator('[role="tab"][data-sub]')).toHaveText([/Quizzes/, /Starting quizzes/, /New quiz/]);
    await clickSub(page, "newquiz");
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await clickTop(page, "homework");
    await expect(page.locator('[role="tab"][data-sub]')).toHaveText([/To mark/, /Inbox/, /Set homework/]);
    await expect(sub(page)).toHaveAttribute("data-sub", /^(mark|inbox)$/);
    await clickSub(page, "set");
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(sub(page)).toHaveAttribute("data-sub", "set");
    await clickSub(page, "inbox");
    await expect(sub(page)).toHaveAttribute("data-sub", "inbox");

    // The last plain sub-section per top tab is reopened (an action item never is); the URL carries tab + sub.
    await clickTop(page, "lessons");
    await clickSub(page, "tools");
    await expect(page).toHaveURL(/tab=tools&sub=tools|sub=tools&tab=tools/);
    await clickTop(page, "home");
    await clickTop(page, "lessons");
    await expect(sub(page)).toHaveAttribute("data-sub", "tools");
    await clickSub(page, "schedule"); await page.keyboard.press("Escape");
    await clickTop(page, "home");
    await clickTop(page, "lessons");
    await expect(sub(page)).toHaveAttribute("data-sub", "tools"); // not "schedule"

    // Arrow keys move along the sub-row and keep focus in it; the active sub-tab stays in view.
    await page.locator('[role="tab"][data-sub="tools"]').focus();
    await page.keyboard.press("ArrowRight");
    await expect(sub(page)).toHaveAttribute("data-sub", "flashcards");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-sub"))).toBe("flashcards");
    const vp = page.viewportSize()!;
    await expect.poll(async () => { const b = await page.locator('[role="tab"][data-sub="flashcards"]').boundingBox(); return !!b && b.x >= 0 && b.x + b.width <= vp.width + 1; }, { message: "active sub-tab scrolled into view" }).toBe(true);
    if (vpName === "390") { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }
    await ctx.close();
  });
}

test("parent + kid keep the flat strip", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await ctxFor(browser, "parent", VIEWPORTS["390"]);
  const page = await ctx.newPage();
  const base = `/custdash/learninghub?child=${fx.kids[0].id}`;
  await open(page, `${base}&tab=home`);
  await expect(page.locator('[role="tab"][data-top], [role="tab"][data-sub]')).toHaveCount(0);
  await expect(page.locator('[role="tab"][data-panel="home"]')).toBeVisible();
  expect((await page.getByRole("tab").allInnerTexts()).join("|")).not.toMatch(/[📚🏠🧑📈📝📓💬]/u);
  await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [KIDKEY, JSON.stringify({ t: fx.tenantId, c: fx.kids[0].id })]);
  await open(page, `${base}&tab=home`);
  await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 60_000 });
  await expect(page.locator('[role="tab"][data-top], [role="tab"][data-sub]')).toHaveCount(0);
  await open(page, `${base}&tab=students`); // a tutor-only tab still falls back to Home for a child
  await expect(page.locator('[role="tab"][aria-selected="true"]').first()).toHaveAttribute("data-panel", "home");
  await ctx.close();
});
