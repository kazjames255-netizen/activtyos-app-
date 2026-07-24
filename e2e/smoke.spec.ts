import { test, expect, type Page } from "@playwright/test";
import { NAV_GROUPS, PORTALS, type PortalKey } from "../lib/nav/config";
import { statePath, type Role } from "./helpers/env";

// Every nav item in every portal must render a real view: no 404, no
// uncaught client exception, no forever-loading shell. One test per portal keeps
// the run fast; all failing views in a portal are reported together.

const PORTAL_ROLE: Record<PortalKey, Role> = {
  company: "company",
  franchise: "franchise",
  freelancer: "freelancer",
  staff: "staff",
  custdash: "parent",
  platform: "platform",
};

// "auth" is the sign-out button, not a view (the route 404s by design).
const viewsFor = (portal: PortalKey) =>
  NAV_GROUPS[portal]
    .flatMap((g) => g.items)
    .filter((i) => i.view !== "auth")
    .map((i) => ({ view: i.view, label: i.label }));

async function checkView(page: Page, portal: PortalKey, view: string, pageErrors: string[]): Promise<string | null> {
  pageErrors.length = 0;
  await page.goto(`/${portal}/${view}`);

  if (await page.getByText("This page could not be found").isVisible().catch(() => false)) {
    return "404 — slug not registered in lib/view-registry.tsx";
  }

  // Wait for the view to produce real content: anything beyond the loading /
  // guard placeholders. API timeouts are 15s, so allow a little beyond that.
  try {
    await expect(page.locator("main")).not.toHaveText(/^\s*(Loading…?|Checking access…?)?\s*$/, {
      timeout: 20_000,
    });
  } catch {
    const text = (await page.locator("main").textContent().catch(() => "")) ?? "";
    return `stuck on "${text.trim().slice(0, 60) || "(empty)"}"`;
  }

  if (pageErrors.length) return `uncaught exception: ${pageErrors.join(" | ").slice(0, 200)}`;
  return null;
}

for (const portal of PORTALS) {
  test.describe(`${portal} portal`, () => {
    test.use({ storageState: statePath(PORTAL_ROLE[portal]) });
    test.describe.configure({ timeout: 600_000 });

    test(`every nav view renders (${viewsFor(portal).length} views)`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      const failures: string[] = [];
      for (const { view, label } of viewsFor(portal)) {
        const problem = await checkView(page, portal, view, pageErrors);
        if (problem) failures.push(`/${portal}/${view} (${label}): ${problem}`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  });
}
