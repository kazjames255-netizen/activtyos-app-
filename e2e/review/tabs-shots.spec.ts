import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, settle, gotoHubPage, shootFull, VIEWPORTS, type Fx } from "./fixture";

// AFTER screenshots of the grouped tutor tabs: every top tab (and each Lessons / Quizzes / Homework / Students sub-section) at 390 / 768 / 1440.
//   npx playwright test -c playwright.review.config.ts e2e/review/tabs-shots.spec.ts --workers=1
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/tabs");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

const VIEWS: [string, string][] = [
  ["home", "home"], ["lessons", "notes"], ["lessons-live", "live"], ["lessons-tools", "tools"], ["students", "students"], ["progress", "dashboard"],
  ["quizzes", "quizzes"], ["quizzes-starting", "diagnostic"], ["homework", "homework&sub=inbox"], ["homework-tomark", "homework&sub=mark"], ["messages", "questions"],
];
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test(`tab shots @${vpName}`, async ({ browser }) => {
    test.setTimeout(900_000);
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await ctxFor(browser, "freelancer", vp);
    const page = await ctx.newPage();
    for (const [name, q] of VIEWS) {
      await gotoHubPage(page, `/freelancer/learninghub?tab=${q}`, fx);
      await settle(page); await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(OUT, `${name}-${vpName}-fold.png`) }).catch(() => undefined);
      await shootFull(page, path.join(OUT, `${name}-${vpName}.png`));
    }
    await ctx.close();
  });
}
