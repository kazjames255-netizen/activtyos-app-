import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, settle, gotoHubPage, type Fx } from "./fixture";

// R-12 + parent verdict/plain language: the fixture parent sees a one-line verdict (tap goes to homework), no teaching jargon on
// Home/Progress, and a printable report that names only the chosen child. Throwaway accounts only; nothing here sends mail.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/parent");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

for (const [vpName, vp] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`verdict + report @${vpName}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await ctxFor(browser, "parent", vp);
    const page = await ctx.newPage();
    fs.mkdirSync(OUT, { recursive: true });
    const shot = (n: string, full = true) => page.screenshot({ path: path.join(OUT, `${n}-${vpName}.png`), fullPage: full });
    const kid = fx.kids[0];
    await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx);
    await settle(page);
    const verdict = page.getByTestId("hub-parent-verdict");
    await expect(verdict).toBeVisible({ timeout: 30_000 });
    await expect(verdict).toContainText(/1 homework overdue/);
    expect(((await page.locator("#learning-hub").innerText()).match(/diagnostic|mastery|placement test/gi)) ?? []).toHaveLength(0);
    await shot("home-verdict");
    await verdict.click();
    await expect(page).toHaveURL(/tab=homework/);

    await page.goto(`/custdash/learninghub?tab=dashboard&child=${kid.id}`);
    await settle(page);
    expect(((await page.locator("#learning-hub").innerText()).match(/diagnostic|mastery|placement/gi)) ?? []).toHaveLength(0);
    await page.getByTestId("hub-report-open").click();
    const report = page.getByTestId("hub-report");
    await expect(report.getByTestId("hub-report-homework")).toBeVisible({ timeout: 30_000 });
    const text = await report.innerText();
    expect(text).toContain(kid.name);
    for (const other of fx.kids.slice(1)) expect(text).not.toContain(other.name);
    expect(text).toMatch(/Subjects/);
    expect(text).toMatch(/Next steps/);
    await shot("report-screen", false);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("hub-report-print")).toBeHidden();
    await shot("report-print", false);
    await page.emulateMedia({ media: "screen" });
    await ctx.close();
  });
}
