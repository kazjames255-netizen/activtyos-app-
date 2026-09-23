import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, settle, gotoHubPage, handOver, pickChild, VIEWPORTS, type Fx } from "./fixture";

// AFTER screenshots for the redesign: tutor Home / Lessons / Tools, parent Home, kid Home at 390/768/1440. Throwaway accounts only.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test(`after shots @${vpName}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const shot = async (page: import("@playwright/test").Page, dir: string, name: string) => { fs.mkdirSync(path.join(OUT, dir), { recursive: true }); await page.screenshot({ path: path.join(OUT, dir, `${name}-${vpName}.png`), fullPage: true }); };
    const t = await (await ctxFor(browser, "freelancer", vp)).newPage();
    for (const [tab, name] of [["home", "home"], ["notes", "lessons"], ["tools", "tools"]] as const) {
      await gotoHubPage(t, `/freelancer/learninghub?tab=${tab}`, fx);
      await settle(t); await t.waitForTimeout(2000);
      await shot(t, "tutor", name);
    }
    const p = await (await ctxFor(browser, "parent", vp)).newPage();
    await gotoHubPage(p, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
    await pickChild(p, fx).catch(() => undefined);
    await settle(p); await p.waitForTimeout(2000);
    await shot(p, "parent", "home");
    await handOver(p, fx.kids[0].id).catch(() => undefined);
    await settle(p); await p.waitForTimeout(2000);
    await shot(p, "kid", "home");
  });
}
