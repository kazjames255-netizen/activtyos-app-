import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { ROOT, API_URL } from "./helpers/env";
import { openTab } from "./helpers/hubTabs";

// Lesson-factory visual check (dev tool): signs in as the Oak STAGING tutor (scratch/oak-staging.json), opens sample lessons in the
// Lessons tab, plays the Preview, and screenshots the slide deck into scratch/factory-shots/. Asserts each deck renders every
// slide, has no page errors and no horizontal overflow. Samples: FACTORY_SAMPLES='["Lesson title", ...]' or scratch/factory-samples.json.
// Run ONLY via scripts/e2e-locked.sh e2e/factory-shots.spec.ts

const staging = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-staging.json"), "utf8")) as { tutor: { email: string; password: string } }; } catch { return null; } })();
const samples: { title: string; tag?: string }[] = (() => {
  try { if (process.env.FACTORY_SAMPLES) return JSON.parse(process.env.FACTORY_SAMPLES); return JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/factory-samples.json"), "utf8")); } catch { return []; }
})();
const OUT = path.join(ROOT, "scratch/factory-shots");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(staging!.tutor.email);
  await page.locator('input[type="password"]').fill(staging!.tutor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000, waitUntil: "commit" });
}

test.describe.configure({ mode: "serial" });
test.skip(!staging || !samples.length, "needs scratch/oak-staging.json and scratch/factory-samples.json");

test("factory decks render in the tutor preview", async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  // If .env.local points the web app at a tunnel that isn't up, send its API calls to the local API instead (same trick as learning-hub-lessons.spec.ts).
  const envApi = (() => { try { return fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; } })();
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const openLessons = async () => {
    await page.goto("/freelancer/learninghub");
    await openTab(page, /^Lessons/);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 60_000 });
  };
  for (const [n, s] of samples.entries()) {
    await openLessons();
    const tag = (s.tag ?? `s${n}`).replace(/[^a-z0-9-]+/gi, "-");
    await page.getByLabel("Search lessons").fill(s.title);
    const btn = page.getByRole("button", { name: s.title, exact: true }).first();
    await btn.waitFor({ timeout: 30_000 }).catch(async () => { await page.screenshot({ path: path.join(OUT, `debug-${tag}.png`) }); });
    await expect(btn).toBeVisible({ timeout: 1_000 });
    await btn.click({ timeout: 15_000 });
    // The lesson PLAN (step by step) replaced Oak's raw video script: it renders, and no script/transcript text exists in the reader.
    const plan = page.getByTestId("lesson-plan");
    await expect(plan).toBeVisible({ timeout: 15_000 });
    expect(await plan.getByTestId("plan-step").count(), `plan steps of ${s.title}`).toBeGreaterThanOrEqual(5);
    await expect(page.getByText(/lesson script|lesson transcript/i)).toHaveCount(0);
    await plan.screenshot({ path: path.join(OUT, `plan-${tag}.png`) }).catch(() => {});
    await page.getByTestId("lesson-preview").click({ timeout: 30_000 });
    await expect(page.getByTestId("lesson-player")).toBeVisible();
    await page.getByTestId("preview-jump-slides").click({ force: true, timeout: 15_000 });
    const total = Number(((await page.getByRole("progressbar", { name: "Slides" }).getAttribute("aria-valuemax")) ?? "0"));
    expect(total).toBeGreaterThan(2);
    for (let i = 0; i < total; i++) {
      await expect(page.getByTestId("slide")).toHaveAttribute("data-slide", String(i));
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(over, `horizontal overflow on slide ${i + 1} of ${s.title}`).toBe(false);
      await page.getByTestId("slide").screenshot({ path: path.join(OUT, `${tag}-${String(i + 1).padStart(2, "0")}.png`) });
      if (i < total - 1) await page.getByTestId("lesson-next").click({ timeout: 15_000 });
    }
    await page.screenshot({ path: path.join(OUT, `after-${tag}.png`) }).catch(() => {});
    // (the next sample re-opens the hub from scratch)
  }
  expect(errors, errors.join("\n")).toEqual([]);
  await ctx.close();
});
