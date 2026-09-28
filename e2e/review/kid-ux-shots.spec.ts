import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, settle, HUB, type Fx } from "./fixture";

// Throwaway screenshot pass for the kids' UX review (Learn, Games, Flashcards, Progress) — three age bands x phone/desktop.
// Output: scratch/kid-ux/<tag>/<band>-<tab>-<width>.png (git-ignored). Not an assertion suite.
const OUT = path.join(ROOT, "scratch/kid-ux", process.env.KID_UX_TAG || "before");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(400_000);
  fx = await buildFixture(3, false);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const years = ["Year 1", "Year 4", "Year 9"];
  for (const [i, k] of fx.kids.entries()) await apiFetch(`${HUB}/students/${k.id}`, t, { method: "PUT", body: JSON.stringify({ yearGroup: years[i] }) });
});

const BANDS = ["ks1", "ks2", "teen"] as const;
const TABS = ["notes", "games", "flashcards", "dashboard"] as const;
const WIDTHS = [390, 1440] as const;

async function shot(page: Page, file: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
}

for (const [i, band] of BANDS.entries()) {
  for (const w of WIDTHS) {
    test(`${band} @${w}`, async ({ browser }) => {
      test.setTimeout(400_000);
      fs.mkdirSync(OUT, { recursive: true });
      const ctx = await ctxFor(browser, "parent", { width: w, height: w === 390 ? 844 : 900 });
      const page = await ctx.newPage();
      const kid = fx.kids[i];
      // The "Hand over" strip was removed from the hub; child mode is a sessionStorage flag ({t: tenantId, c: childId}).
      await page.addInitScript(([t, c]) => { try { sessionStorage.setItem("aos.hub.kid", JSON.stringify({ t, c })); } catch { /* ignore */ } }, [fx.tenantId, kid.id]);
      await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx);
      await settle(page);
      await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 60_000 });
      await shot(page, `${band}-home-${w}.png`);
      for (const tab of TABS) {
        await page.goto(`/custdash/learninghub?tab=${tab}&child=${kid.id}`);
        await settle(page).catch(() => undefined);
        await shot(page, `${band}-${tab}-${w}.png`);
      }
      await ctx.close();
    });
  }
}
