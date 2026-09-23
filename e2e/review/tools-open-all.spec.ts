import { test, expect } from "@playwright/test";
import { buildFixture, ctxFor, probe, settle, gotoHubPage, VIEWPORTS, type Fx } from "./fixture";

// (429s from the fire-and-forget open-event log are ignored: 100 opens in a burst trips the API rate limit, a person never would.)
// Opens EVERY live tool from the Tools tab grid as a tutor, at desktop and phone, and fails on a crash card or a console/page error.
//   npx playwright test e2e/review/tools-open-all.spec.ts --project=e2e --workers=1
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(300_000); fx = await buildFixture(1, false); });

for (const vp of ["1440", "390"] as const) {
  test(`open every live tool @${vp}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const ctx = await ctxFor(browser, "freelancer", VIEWPORTS[vp]);
    const page = await ctx.newPage();
    const pr = probe(page);
    await gotoHubPage(page, "/freelancer/learninghub?tab=tools", fx);
    await settle(page);
    await page.locator("#hub-tools").waitFor({ timeout: 30_000 });
    const ids = await page.locator("[data-testid^='tool-']").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid!.slice(5)));
    console.log(`tools listed: ${ids.length}`);
    expect(ids.length).toBeGreaterThan(0);
    expect(await page.locator("#hub-tools [data-status]:not([data-status='live'])").count(), "no unreleased tiles").toBe(0);
    const fails: string[] = [];
    for (const id of ids) {
      pr.reset();
      await page.getByTestId(`tool-${id}`).scrollIntoViewIfNeeded();
      await page.getByTestId(`tool-${id}`).click();
      const dlg = page.getByRole("dialog");
      const problems: string[] = [];
      try {
        await dlg.waitFor({ timeout: 10_000 });
        await expect(dlg.locator("[aria-label='Loading the tool'],[aria-busy='true']")).toHaveCount(0, { timeout: 15_000 });
        await page.waitForTimeout(250);
        if (await dlg.getByRole("alert").filter({ hasText: /ran into a problem/ }).count()) problems.push("crash card");
        if (((await dlg.innerText()).trim().length) < 20) problems.push("empty body");
      } catch (e) { problems.push(`no dialog/timeout: ${String(e).slice(0, 80)}`); }
      const errs = [...pr.pageErrors, ...pr.console.filter((c) => c.startsWith("error") && !/status of 429/.test(c))];
      if (errs.length) problems.push(errs[0]!);
      if (problems.length) fails.push(`${id}: ${problems.join("; ")}`);
      await page.keyboard.press("Escape");
      await dlg.waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
    }
    console.log(fails.length ? `FAILURES\n${fails.join("\n")}` : `all ${ids.length} tools opened cleanly @${vp}`);
    await ctx.close();
    expect(fails, fails.join("\n")).toEqual([]);
  });
}
