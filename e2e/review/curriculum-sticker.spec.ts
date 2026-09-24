import path from "node:path";
import { expect, test } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, gotoHubPage, pickChild, settle, VIEWPORTS, type Fx } from "./fixture";

// Child view of the curriculum map: sticker book for KS1/KS2, plain checklist for Year 7+. The child map API is mocked (a fixed maths dataset);
// the family and children are throwaway review accounts (kids are Years 3..8, so index 0 = Year 3 and the last = Year 8).
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/curriculum");
const y = (o: Record<number, number>) => Array.from({ length: 11 }, (_, i) => o[i + 1] ?? 0);
const area = (id: string, strand: string, name: string, ys: Record<number, number>, done: Record<number, number> = {}) => ({ id, subject: "maths", group: "maths", strand, area: `${strand} – ${name}`, code: null, y: y(ys), done: y(done) });
const map = {
  mode: "child", framework: { id: "nc2014", label: "NC 2014", version: "test", note: "" }, frameworks: [{ id: "nc2014", label: "NC 2014" }],
  areas: [area("frac", "Number", "fractions", { 3: 2, 4: 2 }, { 3: 1 }), area("shape", "Geometry", "shapes", { 3: 1 }), area("meas", "Measurement", "measures", {}), area("stat", "Statistics", "statistics", {}),
    area("eq", "Algebra", "equations", { 8: 2 }, { 8: 1 }), area("seq", "Algebra", "sequences", { 8: 1 })],
  rows: ([
    { areaId: "frac", from: 3, to: 6, lessons: 4, status: "covered" }, { areaId: "shape", from: 3, to: 6, lessons: 1, status: "thin" }, { areaId: "meas", from: 3, to: 6, lessons: 0, status: "gap" }, { areaId: "stat", from: 3, to: 6, lessons: 0, status: "gap" },
    { areaId: "eq", from: 7, to: 9, lessons: 2, status: "covered" }, { areaId: "seq", from: 7, to: 9, lessons: 1, status: "thin" },
  ] as never[]),
  summary: { checked: 6, covered: 2, thin: 2, gaps: 2 }, lessons: 5, unplaced: 0, autoMapped: { high: 5, medium: 0, low: 0 },
};
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(500_000); fx = await buildFixture(6, false); });

for (const [vpName, vp] of [["390", VIEWPORTS["390"]], ["1440", VIEWPORTS["1440"]]] as const) {
  test(`sticker book + teen checklist @${vpName}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await ctxFor(browser, "parent", vp);
    const page = await ctx.newPage();
    await page.route("**/api/learning-hub/curriculum/lessons**", (r) => r.fulfill({ json: { area: { id: "frac", area: "Fractions", strand: "Number" }, total: 1, lessons: [{ id: "l1", title: "Adding fractions", year: 3, confidence: 1, corrected: false, done: true, canCorrect: false }] } }));
    await page.route(/\/api\/learning-hub\/curriculum(\?|$)/, (r) => r.fulfill({ json: map }));
    for (const [idx, kind] of [[0, "sticker"], [5, "teen"]] as const) {
      await gotoHubPage(page, `/custdash/learninghub?tab=notes&child=${fx.kids[idx].id}`, fx);
      await pickChild(page, fx, idx).catch(() => undefined);
      await settle(page);
      const card = page.getByTestId("curriculum-card");
      await expect(card).toBeVisible({ timeout: 30_000 });
      if ((await card.getByRole("button").first().getAttribute("aria-expanded")) !== "true") await card.getByRole("button").first().click();
      const body = card.locator("[role=tabpanel]");
      if (kind === "sticker") {
        const book = card.getByTestId("curriculum-sticker-book");
        await expect(book).toBeVisible({ timeout: 30_000 });
        await expect(book.locator('[data-sticker="got"]')).toHaveCount(1);
        await expect(book.locator('[data-sticker="next"]')).toHaveCount(3);
        await expect(book).toContainText("Got it!");
        await expect(book).toContainText("Next up");
        await expect(body).not.toContainText(/%|overdue|gap|behind/i);
        await expect(book.locator("[data-count]")).toHaveCount(0);
        const box = await book.locator("[data-sticker]").first().boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(96);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.screenshot({ path: path.join(OUT, `sticker-${vpName}.png`), fullPage: true });
        await book.locator("[data-sticker]").first().click();
        await expect(page.getByText("Adding fractions")).toBeVisible();
        await page.screenshot({ path: path.join(OUT, `sticker-drawer-${vpName}.png`) });
        await page.keyboard.press("Escape");
      } else {
        const list = card.getByTestId("curriculum-progress-list");
        await expect(list).toBeVisible({ timeout: 30_000 });
        await expect(list).toContainText("My progress by topic");
        await expect(list).toContainText("Equations");
        await expect(card.getByTestId("curriculum-sticker-book")).toHaveCount(0);
        await page.screenshot({ path: path.join(OUT, `teen-${vpName}.png`), fullPage: true });
      }
    }
    await ctx.close();
  });
}
