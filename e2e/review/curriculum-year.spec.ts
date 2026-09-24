import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, gotoHubPage, settle, VIEWPORTS, type Fx } from "./fixture";

// Year-first curriculum map (tutor). The curriculum API is mocked with a fixed maths dataset so the assertions are deterministic;
// the tutor is a throwaway review account. Run: npx playwright test -c playwright.review.config.ts e2e/review/curriculum-year.spec.ts
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/curriculum");
const y = (o: Record<number, number>) => Array.from({ length: 11 }, (_, i) => o[i + 1] ?? 0);
const area = (id: string, strand: string, name: string, ys: Record<number, number>) => ({ id, subject: "maths", group: "maths", strand, area: `${strand} – ${name}`, code: null, y: y(ys) });
const areas = [
  area("frac", "Number", "fractions", { 3: 4, 4: 4, 5: 4, 6: 4 }), area("shape", "Geometry", "shapes", { 5: 2 }), area("peri", "Geometry", "perimeter", {}),
  area("eq", "Algebra", "equations", { 8: 6 }), area("seq", "Algebra", "sequences", {}), area("stray", "Number", "place value", { 8: 3 }),
  area("gcse", "Algebra", "quadratics", {}),
];
const rows = [
  { areaId: "frac", from: 3, to: 6, lessons: 16, status: "covered" }, { areaId: "shape", from: 3, to: 6, lessons: 2, status: "thin" }, { areaId: "peri", from: 3, to: 6, lessons: 0, status: "gap" },
  { areaId: "eq", from: 7, to: 9, lessons: 6, status: "covered" }, { areaId: "seq", from: 7, to: 9, lessons: 0, status: "gap" }, { areaId: "gcse", from: 10, to: 11, lessons: 0, status: "gap" },
];
const map = {
  mode: "tutor", framework: { id: "nc2014", label: "NC 2014", version: "test", note: "" }, frameworks: [{ id: "nc2014", label: "NC 2014" }, { id: "gcse-aqa", label: "GCSE AQA" }],
  areas, rows, summary: { checked: 6, covered: 2, thin: 1, gaps: 3 }, lessons: 25, unplaced: 0, autoMapped: { high: 20, medium: 3, low: 2 },
};
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(2, false); });

for (const [vpName, vp] of [["390", VIEWPORTS["390"]], ["1440", VIEWPORTS["1440"]]] as const) {
  test(`year-first curriculum @${vpName}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer", vp);
    const page = await ctx.newPage();
    await page.route("**/api/learning-hub/curriculum/lessons**", (r) => r.fulfill({ json: { area: { id: "frac", area: "Fractions", strand: "Number" }, total: 1, lessons: [{ id: "l1", title: "Adding fractions", year: 5, confidence: 1, corrected: false, done: false, canCorrect: true }] } }));
    await page.route(/\/api\/learning-hub\/curriculum(\?|$)/, (r) => r.fulfill({ json: map }));
    await gotoHubPage(page, "/freelancer/learninghub?tab=notes", fx);
    await settle(page);
    const card = page.getByTestId("curriculum-card");
    await expect(card).toBeVisible({ timeout: 30_000 });
    if ((await card.getByRole("button").first().getAttribute("aria-expanded")) !== "true") await card.getByRole("button").first().click();
    const list = page.getByTestId("curriculum-year-list");

    await card.getByRole("tab", { name: "Year 5" }).click();
    await expect(card.getByText("1 of 3 areas covered in Maths · Year 5")).toBeVisible();
    await expect(list).toContainText("Fractions");
    await expect(list).not.toContainText("Equations");
    await expect(list).not.toContainText("Algebra");
    expect(await list.locator("[data-kind]").count()).toBe(3);
    await page.screenshot({ path: path.join(OUT, `year5-${vpName}.png`), fullPage: true });

    await card.getByRole("tab", { name: "Year 8" }).click();
    await expect(list).toContainText("Algebra");
    await expect(list).toContainText("Equations");
    await expect(card.getByTestId("curriculum-extra")).toContainText("3 extra lessons");
    await page.screenshot({ path: path.join(OUT, `year8-${vpName}.png`), fullPage: true });

    await card.getByLabel("Show only gaps & thin spots").check();
    await expect(list).toContainText("Sequences");
    await expect(list).not.toContainText("Equations");
    await page.screenshot({ path: path.join(OUT, `year8-gaps-${vpName}.png`), fullPage: true });
    await card.getByLabel("Show only gaps & thin spots").uncheck();

    // No blank cells: every row is a real, labelled area with a count.
    expect(await card.locator("table").count()).toBe(0);
    for (const b of await list.locator("[data-kind]").all()) expect(await b.getAttribute("data-count")).not.toBeNull();
    // 390: no sideways page scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await card.getByRole("tab", { name: "Year 5" }).click();
    await list.getByRole("button", { name: /Fractions/ }).click();
    await expect(page.getByText("Adding fractions")).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `drawer-${vpName}.png`) });
    await ctx.close();
  });
}
