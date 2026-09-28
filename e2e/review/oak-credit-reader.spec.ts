import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { seedOakLesson } from "../helpers/lessonFixture";
import { buildFixture, ctxFor, gotoHubPage, settle, HUB, type Fx } from "./fixture";

// Product review C1, driven in the real UI: a plain note whose STORED body carries the publisher's credit line, opened in the tutor's
// lesson reader (and the print view) must never show it. Throwaway accounts only; reuses the KS1 spec's fixture when present.
const OUT = path.join(ROOT, "docs/reviews/shots/product-fix");
const CACHE = path.join(ROOT, "e2e/review/.ks1-fixture.json");
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(500_000);
  fs.mkdirSync(OUT, { recursive: true });
  if (fs.existsSync(CACHE) && !process.env.PJ_REBUILD) { fx = JSON.parse(fs.readFileSync(CACHE, "utf8")); return; }
  fx = await buildFixture(2, false, undefined, 1);
  fs.writeFileSync(CACHE, JSON.stringify(fx));
});

const BRAND = /oak national|open government|\bOGL\b|thenational\.academy|oaknational/i;

test("tutor lesson reader never shows the credit stored in a note body", async ({ browser }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topic = topics.find((x) => /^Maths [a-z0-9]+$/.test(x.subject) && !x.id.startsWith("shared-"))!;
  // The lesson the critic opened: an interactive lesson (has the `lesson` field) whose STORED body ends with the publisher's credit line.
  const seeded = await seedOakLesson(t, { stamp, subject: topic.subject, topicId: topic.id, widget: "neurone" });
  const title = seeded.title;
  const credit = "A Maths lesson by Oak National Academy licensed under Open Government Licence (OGL). See https://www.thenational.academy/lessons/x";
  const cur = await apiFetch<{ body?: string }>(`${HUB}/notes/${seeded.noteId}`, t);
  await apiFetch(`${HUB}/notes/${seeded.noteId}`, t, { method: "PUT", body: JSON.stringify({ topicId: topic.id, title: seeded.title, published: true, body: `${cur.body ?? ""}\n\n${credit}` }) });
  const served = await apiFetch<{ body?: string; lesson?: unknown }>(`${HUB}/notes/${seeded.noteId}`, t);
  expect(served.lesson, "still an interactive lesson").toBeTruthy();
  expect(BRAND.test(served.body ?? ""), "API response is already scrubbed").toBe(false);
  // Place it on the curriculum map so the Lessons tab can reach it (what "Find a lesson to place here" does in the area drawer).
  const map = await apiFetch<{ framework: { id: string }; areas: { id: string; area: string }[] }>(`${HUB}/curriculum`, t);
  const area = map.areas.find((x) => /fraction/i.test(x.area)) ?? map.areas[0];
  await apiFetch(`${HUB}/curriculum/tags/${seeded.noteId}`, t, { method: "PUT", body: JSON.stringify({ framework: map.framework.id, areaId: area.id, year: 6 }) });
  console.log("SEEDED + PLACED:", title, "in", area.area);

  const ctx = await ctxFor(browser, "freelancer", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/freelancer/learninghub?tab=notes`, fx);
  await settle(page);
  // Reach the note the way a tutor does: the curriculum card (Maths, all years), the area tile, then the lesson row.
  await page.reload();
  await page.getByRole("button", { name: /All years/ }).or(page.getByText("All years", { exact: true })).first().click({ timeout: 90_000 });
  const tile = page.locator("#hub-notes button").filter({ hasText: /NUMBER\s*Fractions\s*\d+/i }).first();
  await tile.click({ timeout: 60_000 });
  await page.waitForTimeout(6000);
  const dtxt = (await page.locator("#hub-notes").innerText()).replace(/\s+/g, " ");
  console.log("DRAWER:", dtxt.slice(dtxt.indexOf("Number – fractions"), dtxt.indexOf("Number – fractions") + 900));
  await page.screenshot({ path: path.join(OUT, "c1-area.png"), fullPage: true });
  const row = page.getByText(title, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  const reader = page.locator("#hub-reader");
  await expect(reader).toBeVisible({ timeout: 30_000 });
  await expect(reader).toContainText(seeded.points[0].slice(0, 30));
  const text = await reader.innerText();
  console.log("READER TEXT:", text.replace(/\s+/g, " ").slice(0, 500));
  expect(BRAND.test(text)).toBe(false);
  expect(BRAND.test(await reader.innerHTML())).toBe(false);
  await page.screenshot({ path: path.join(OUT, "c1-tutor-reader.png"), fullPage: true });
  // The whole page (sidebar, header, toasts) too.
  expect(BRAND.test(await page.locator("body").innerText())).toBe(false);
  await ctx.close();
});
