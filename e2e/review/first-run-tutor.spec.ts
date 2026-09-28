import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { provisionOwn, ctxFor } from "./fixture";

// Product review H5 / M9: a brand-new tutor (no bookings, no listings, Teaching Hub OFF) lands on a dashboard that leads with the hub card;
// turning it on goes straight into the hub and the dashboard then offers "Open Teaching Hub". Also M9: an enrolled parent gets the hub in
// the top bar. Own throwaway pair only (run with REVIEW_AUTH_DIR=e2e/review/.auth-fr so it never overwrites another spec's sign-in).
const OUT = path.join(ROOT, "docs/reviews/shots/product-fix");
test.setTimeout(400_000);

test("first-run tutor: hub card leads the dashboard, turn on lands in the hub, dashboard then offers Open", async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await provisionOwn(browser);
  const ctx = await ctxFor(browser, "freelancer", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto("/freelancer/dash");
  const card = page.getByTestId("enable-hub-card");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card).toContainText(/Are you a tutor/i);
  // It leads the page: nothing from the camps dashboard sits above it.
  const cardTop = (await card.boundingBox())!.y;
  const heroTop = await page.getByText(/On site today/i).first().boundingBox().then((b) => b?.y ?? 9999).catch(() => 9999);
  console.log("CARD TOP", cardTop, "CAMPS HERO TOP", heroTop);
  expect(cardTop).toBeLessThan(heroTop);
  await page.screenshot({ path: path.join(OUT, "fr1-dashboard-hub-off.png"), fullPage: true });
  await page.getByTestId("enable-hub-turn-on").click();
  await page.waitForURL(/\/freelancer\/learninghub/, { timeout: 90_000 });
  await page.goBack();
  await expect(page.getByTestId("open-hub-card")).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: path.join(OUT, "fr2-dashboard-hub-on.png"), fullPage: true });
  await page.getByTestId("open-hub-go").click();
  await page.waitForURL(/\/freelancer\/learninghub/, { timeout: 90_000 });
  await ctx.close();
});
