import { test } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
test.use({ storageState: statePath("company") });
test.describe.configure({ timeout: 300_000 });
test("header layout in franchise scope", async ({ page }) => {
  const fr = await page.request.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/franchises`).catch(() => null);
  const fid = loadAccounts().accounts.franchise.uid as string;
  await page.goto("/company/listings");
  await page.evaluate((id) => localStorage.setItem("aos.ho.scope", id), fid);
  const id = await page.evaluate(() => localStorage.getItem("aos.ho.scope"));
  console.log("scope in storage:", id);
  for (const w of [1280, 1366, 1440, 1024]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto("/company/admin-registers");
    await page.waitForTimeout(6000);
    const m = await page.evaluate(() => {
      const nav = document.querySelector("header nav") as HTMLElement | null;
      const scroll = nav?.querySelector(":scope > div") as HTMLElement | null;
      return { nav: nav && Math.round(nav.getBoundingClientRect().width), scroll: scroll && [Math.round(scroll.getBoundingClientRect().width), scroll.scrollWidth], tabs: scroll ? Array.from(scroll.querySelectorAll("a")).map((a) => (a as HTMLElement).innerText.trim() + "@" + Math.round(a.getBoundingClientRect().width)) : null };
    });
    console.log("W", w, JSON.stringify(m));
    await page.screenshot({ path: `/tmp/p1/hdr-${w}.png`, clip: { x: 0, y: 0, width: w, height: 60 } });
  }
});


