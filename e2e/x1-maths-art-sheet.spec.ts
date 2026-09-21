import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { ROOT, API_URL } from "./helpers/env";

// Slide-picture review sheet for the Maths KS1-KS2 pictures (X1; copy of f1-art-sheet.spec.ts with its own sample list scratch/x1/samples.json)
// (original header follows) Slide-picture review sheet (F1): signs in as the Oak STAGING tutor (scratch/oak-staging.json), opens sampled lessons in the Lessons tab,
// plays the Preview and, for every sampled slide, asserts the PICTURE POLICY as rendered and screenshots the slide into scratch/f1-art-shots/.
//   · a slide the generator gave N library pictures renders exactly N <figure data-testid="slide-pic"> with alt text (role=img aria-label) and an inline <svg>
//   · a slide with no art renders NO art panel at all (no empty box) and its content fills the width
//   · no horizontal overflow, no page errors
// Samples: scratch/x1/samples.json (made from the factory check output by /tmp scripts; see docs/hub-review/F1-images.md).
// Run ONLY via scripts/e2e-locked.sh e2e/x1-maths-art-sheet.spec.ts   (X1_LIMIT=n limits the number of lessons; X1_THEME=light|dark; X1_WIDTH=390 for a phone)

const staging = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-staging.json"), "utf8")) as { tutor: { email: string; password: string } }; } catch { return null; } })();
type Sample = { title: string; tag: string; key: string; slides: { i: number; title: string; pics: string[]; art: string[] }[] };
const samples: Sample[] = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/x1/samples.json"), "utf8")); } catch { return []; } })().slice(0, Number(process.env.X1_LIMIT ?? 999));
const OUT = path.join(ROOT, `scratch/x1/shots${process.env.X1_THEME === "light" ? "-light" : ""}${process.env.X1_WIDTH ? `-w${process.env.X1_WIDTH}` : ""}`);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(staging!.tutor.email);
  await page.locator('input[type="password"]').fill(staging!.tutor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000, waitUntil: "commit" });
}

test.describe.configure({ mode: "serial" });
test.skip(!staging || !samples.length, "needs scratch/oak-staging.json and scratch/x1/samples.json");

test("sampled slides render exactly their verified pictures (or no art panel)", async ({ browser }) => {
  test.setTimeout(90 * 60_000);
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.X1_WIDTH ?? 1100), height: 900 }, colorScheme: process.env.X1_THEME === "light" ? "light" : "dark" });
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
  const results: Record<string, unknown>[] = [];
  const problems: string[] = [];
  for (const [n, s] of samples.entries()) {
    try {
      await page.goto("/freelancer/learninghub");
      await page.getByRole("tab", { name: /^Lessons/ }).click({ timeout: 60_000 });
      await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 60_000 });
      await page.getByLabel("Search lessons").fill(s.title);
      const btn = page.getByRole("button", { name: s.title, exact: true }).first();
      await btn.waitFor({ timeout: 30_000 });
      await btn.click({ timeout: 15_000 });
      await page.getByTestId("lesson-preview").click({ timeout: 30_000 });
      await expect(page.getByTestId("lesson-player")).toBeVisible();
      await page.getByTestId("preview-jump-slides").click({ force: true, timeout: 15_000 });
      const total = Number((await page.getByRole("progressbar", { name: "Slides" }).getAttribute("aria-valuemax")) ?? "0");
      const want = new Map(s.slides.map((x) => [x.i, x]));
      for (let i = 0; i < total; i++) {
        await expect(page.getByTestId("slide")).toHaveAttribute("data-slide", String(i));
        const w = want.get(i);
        if (w) {
          const tag = `${s.tag}-${n}-${String(i + 1).padStart(2, "0")}`;
          const h2 = ((await page.getByTestId("slide").locator("h2").first().textContent().catch(() => "")) ?? "").trim();
          const figs = page.getByTestId("slide").getByTestId("slide-pic");
          const panel = await page.getByTestId("slide").getByTestId("slide-art").count();
          await page.waitForTimeout(w.pics.length ? 600 : 100); // the library loads on demand
          const ids = await figs.evaluateAll((els) => els.map((e) => e.getAttribute("data-pic")));
          const alts = await figs.evaluateAll((els) => els.map((e) => e.querySelector("[role=img]")?.getAttribute("aria-label") ?? ""));
          const svgs = await figs.evaluateAll((els) => els.map((e) => !!e.querySelector("svg")));
          const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
          const row = { tag, lesson: s.title, slide: i + 1, title: h2, expectedTitle: w.title, expectedPics: w.pics, expectedEmoji: w.art, renderedPics: ids, panel };
          results.push(row);
          if (h2 !== w.title.trim()) { problems.push(`${tag}: slide title "${h2}" != expected "${w.title}" (a different lesson with the same title?)`); }
          else {
            if (JSON.stringify(ids) !== JSON.stringify(w.pics)) problems.push(`${tag}: rendered pictures ${JSON.stringify(ids)} != expected ${JSON.stringify(w.pics)}`);
            if (alts.some((a) => a.trim().length < 20)) problems.push(`${tag}: a picture has no alt text`);
            if (svgs.some((x) => !x)) problems.push(`${tag}: a picture has no inline svg`);
            if (!w.pics.length && !w.art.length && panel !== 0) problems.push(`${tag}: slide without art still renders an art panel (empty box)`);
            if (w.art.length && !w.pics.length && panel !== 1) problems.push(`${tag}: emoji slide has no art panel`);
          }
          if (over) problems.push(`${tag}: horizontal overflow`);
          await page.getByTestId("slide").screenshot({ path: path.join(OUT, `${tag}.png`) });
        }
        if (i < total - 1 && [...want.keys()].some((k) => k > i)) await page.getByTestId("lesson-next").click({ timeout: 15_000 });
        else if ([...want.keys()].every((k) => k <= i)) break;
      }
    } catch (e) { problems.push(`${s.tag}-${n} "${s.title}": ${(e as Error).message.split("\n")[0]}`); }
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, problems, errors }, null, 1));
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, problems, errors }, null, 1));
  expect(errors, errors.join("\n")).toEqual([]);
  expect(problems, problems.join("\n")).toEqual([]);
  await ctx.close();
});
