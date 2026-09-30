import { test, expect } from "@playwright/test";

// The public language selector: visible on public pages, switches text + direction at once, survives a reload (cookie read by the server, so the
// first paint is already right) and never shows a raw catalogue key. Read-only.
for (const path of ["/login", "/signup", "/how-it-works", "/demo"]) {
  test(`public language selector ${path}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    await page.goto(path, { waitUntil: "load" });
    const picker = page.locator('[data-ui="public-language-picker"] button').first();
    await expect(picker).toBeVisible();
    const enText = (await page.locator("body").innerText()).slice(0, 400);
    await picker.click();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await page.waitForTimeout(1500);
    expect((await page.locator("body").innerText()).slice(0, 400)).not.toEqual(enText);
    await page.reload({ waitUntil: "load" });
    // server-rendered from the cookie: direction and language are right before any script runs
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\b(p7|p8)[a-z]*\.[A-Za-z]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('[data-ui="public-language-picker"] button').first().click();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    expect(errs).toEqual([]);
    await ctx.close();
  });
}
