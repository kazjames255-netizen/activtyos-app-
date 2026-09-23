import { test, expect } from "@playwright/test";
import { buildFixture, ensureFixture, ctxFor, probe, settle, bannerText, tabStrip, gotoHubPage, handOver, pickChild, VIEWPORTS, type Fx } from "./fixture";

// Fast reusable smoke: every hub tab renders for tutor/parent/kid at phone + desktop. Throwaway accounts only.
//   npx playwright test e2e/review/hub-smoke.spec.ts --project=e2e --workers=1
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async ({ browser }) => { test.setTimeout(400_000); fx = await buildFixture(2, false, browser); });

for (const role of ["tutor", "parent", "kid"] as const) {
  for (const vpName of ["390", "1440"] as const) {
    test(`smoke ${role} @${vpName}`, async ({ browser }) => {
      test.setTimeout(150_000);
      fx = await ensureFixture(browser, fx, 2, false);
      const ctx = await ctxFor(browser, role === "tutor" ? "freelancer" : "parent", VIEWPORTS[vpName]);
      const page = await ctx.newPage();
      const pr = probe(page);
      await gotoHubPage(page, role === "tutor" ? "/freelancer/learninghub?tab=home" : `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
      if (role !== "tutor") await pickChild(page, fx);
      if (role === "kid") await handOver(page, fx.kids[0].id);
      await settle(page);
      const { labels, keys } = await tabStrip(page);
      expect(labels.length, "tabs found").toBeGreaterThanOrEqual(role === "tutor" ? 10 : 5);
      const fails: string[] = [];
      for (let i = 0; i < labels.length; i++) {
        pr.reset();
        if (i > 0) await page.getByRole("tablist").first().getByRole("tab").nth(i).click();
        const tm = await settle(page, 30_000);
        const ms = tm.content;
        const banners = (await bannerText(page)).filter((b) => /reach Teaching Hub|didn.?t respond/i.test(b));
        const problems: string[] = [];
        if (ms === null) problems.push("no content in 30s");
        else if (tm.settled === null) console.log(`WARN ${role}@${vpName} ${labels[i]}: skeletons still showing after 30s`);
        if (banners.length) problems.push(`banner: ${banners[0]}`);
        if (pr.pageErrors.length) problems.push(`pageerror: ${pr.pageErrors[0]}`);
        console.log(`${problems.length ? "FAIL" : "PASS"} ${role}@${vpName} ${keys[i]} ${ms === null ? "" : (ms / 1000).toFixed(1) + "s"} ${problems.join("; ")}`);
        if (problems.length) fails.push(`${labels[i]}: ${problems.join("; ")}`);
      }
      await ctx.close();
      expect(fails, fails.join("\n")).toEqual([]);
    });
  }
}
