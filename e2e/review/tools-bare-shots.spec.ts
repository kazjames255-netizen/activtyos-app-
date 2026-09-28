import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildFixture, ctxFor, settle, gotoHubPage, VIEWPORTS, type Fx } from "./fixture";

// "Just the tool" pass: opens every live tool from the Tools tab, switches the floating window to "Just the tool", screenshots it at 1440 and
// counts what interactive chrome is still visible inside the window body.
//   scripts/e2e-locked.sh e2e/review/tools-bare-shots.spec.ts     (BARE_ONLY=M-01,S-02 limits it)
test.describe.configure({ mode: "serial" });
let fx: Fx;
const OUT = path.join(process.cwd(), "docs/teaching-hub-review/screenshots/tools-bare");
test.beforeAll(async () => { test.setTimeout(300_000); fx = await buildFixture(1, false); });

test("bare mode screenshots", async ({ browser }) => {
  test.setTimeout(1_500_000);
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await ctxFor(browser, "freelancer", VIEWPORTS["1440"]);
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=tools", fx);
  await settle(page);
  await page.locator("#hub-tools").waitFor({ timeout: 30_000 });
  let ids = await page.locator("[data-testid^='tool-']").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid!.slice(5)));
  if (process.env.BARE_ONLY) ids = ids.filter((i) => process.env.BARE_ONLY!.split(",").includes(i));
  const rows: string[] = [];
  for (const id of ids) {
    await page.getByTestId(`tool-${id}`).scrollIntoViewIfNeeded();
    await page.getByTestId(`tool-${id}`).click();
    const dlg = page.getByRole("dialog");
    try {
      await dlg.waitFor({ timeout: 10_000 });
      await page.waitForTimeout(600);
      await page.getByTestId("floating-panel-bare").click();
      await page.waitForTimeout(400);
      const stats = await page.getByTestId("floating-panel-body").evaluate((b) => {
        const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(e as HTMLElement); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
        const q = (s: string) => [...b.querySelectorAll(s)].filter(vis).length;
        return { buttons: q("button"), inputs: q("input,textarea"), selects: q("select"), text: (b as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 90) };
      });
      rows.push(`${id}\tbtn=${stats.buttons}\tin=${stats.inputs}\tsel=${stats.selects}\t${stats.text}`);
      await dlg.screenshot({ path: path.join(OUT, `${id.replace(/[^\w.-]/g, "_")}.png`) });
    } catch (e) { rows.push(`${id}\tERR ${String(e).slice(0, 80)}`); }
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
  }
  fs.writeFileSync(path.join(OUT, "_report.tsv"), rows.join("\n"));
  console.log(rows.join("\n"));
  await ctx.close();
});
