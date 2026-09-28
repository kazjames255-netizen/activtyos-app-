import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { openTab } from "../helpers/hubTabs";
import { buildFixture, ctxFor, gotoHubPage, settle, handOver, type Fx } from "./fixture";

// Product-critic follow-up (docs/reviews/critic-product.md): the journeys the critic could not finish. Throwaway accounts only
// (own @activityos-test.com pair from buildFixture), never the locked standing queue or a real tenant.
const OUT = path.join(ROOT, "docs/reviews/shots/product-fix");
const CACHE = path.join(ROOT, "e2e/review/.pj-fixture.json");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(500_000);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  if (fs.existsSync(CACHE) && !process.env.PJ_REBUILD) { fx = JSON.parse(fs.readFileSync(CACHE, "utf8")); return; }
  fx = await buildFixture(3, true, undefined, 1);
  fs.writeFileSync(CACHE, JSON.stringify(fx));
});

test("KS1 kid: Play & learn has no dead cards; quiz loop", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
  await page.getByRole("radio", { name: new RegExp(fx.kids[0].name) }).or(page.getByRole("button", { name: new RegExp(fx.kids[0].name) })).first().click({ timeout: 40_000 }).catch(() => undefined);
  await handOver(page, fx.kids[0].id);
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "k1-home.png"), fullPage: true });
  console.log("KID HOME:", (await page.locator("#learning-hub").innerText()).replace(/\s+/g, " ").slice(0, 600));
  const tabs = await page.getByRole("tab").allInnerTexts();
  console.log("TABS", JSON.stringify(tabs));
  await page.getByRole("tab", { name: /Play/ }).click();
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "k2-play.png"), fullPage: true });
  console.log("PLAY:", (await page.locator("#learning-hub").innerText()).replace(/\s+/g, " ").slice(0, 900));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log("PAGE OVERFLOW", overflow);
  const lessonBtns = page.getByTestId("hub-quiz-start-lesson");
  console.log("LESSON-FIRST CARDS", await lessonBtns.count());
  if (await lessonBtns.count()) { await lessonBtns.first().click(); await page.waitForTimeout(2500); console.log("AFTER LESSON CLICK:", (await page.locator("#learning-hub").innerText()).replace(/\s+/g, " ").slice(0, 400)); await page.screenshot({ path: path.join(OUT, "k3-lesson-click.png") }); }
  // Quiz loop: a normal (non-lesson) quiz card -> start -> answer every question -> review -> hand in -> result.
  const card = page.locator("[id^='hub-assess-']").filter({ hasText: /Fractions quiz/ }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "k4-quiz-card.png"), fullPage: true });
  await card.getByRole("button").first().click();
  await page.getByTestId("hub-start").click({ timeout: 20_000 }).catch(() => undefined);
  const runner = page.getByTestId("hub-runner");
  await expect(runner).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 6; i++) {
    const right = runner.getByText("Right", { exact: true }).first();
    if (await right.isVisible().catch(() => false)) await right.click();
    await page.screenshot({ path: path.join(OUT, `k5-q${i + 1}.png`) });
    const next = page.getByTestId("hub-next");
    if (await next.isVisible().catch(() => false)) { await next.click(); continue; }
    break;
  }
  await page.getByTestId("hub-review").click().catch(() => undefined);
  await page.getByTestId("hub-handin").click({ timeout: 20_000 });
  await page.getByTestId("hub-confirm-submit").click();
  await expect(page.getByTestId("hub-result-banner")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, "k6-result.png"), fullPage: true });
  console.log("RESULT:", (await page.getByTestId("hub-result").innerText()).replace(/\s+/g, " ").slice(0, 500));
  await ctx.close();
});

test("tutor: lesson-level tool add, teach-in-person layout", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "freelancer", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=notes", fx);
  await settle(page);
  // first splash visit is skippable and short
  await page.screenshot({ path: path.join(OUT, "t1-lessons.png") });
  const tok = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const notes = await apiFetch<{ items?: { title: string; isLesson?: boolean }[] } | { title: string; isLesson?: boolean }[]>(`/api/learning-hub/notes?limit=20`, tok);
  const list = Array.isArray(notes) ? notes : (notes.items ?? []);
  const title = (list.find((n) => n.isLesson) ?? list[0]).title;
  console.log("LESSON TITLE", title);
  await page.getByLabel("Search lessons").fill(title);
  const card = page.locator("[data-ui='card']").filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 40_000 });
  await card.getByRole("button", { name: title, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "t2-reader.png"), fullPage: true });
  const body = await page.locator("#learning-hub").innerText();
  console.log("READER HAS OAK/OGL:", /oak national|open government|\bOGL\b/i.test(body));
  await page.getByRole("button", { name: /Preview lesson/i }).first().click();
  await page.getByRole("button", { name: /^Start/i }).first().click({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "t3-preview.png") });
  for (let i = 0; i < 10; i++) {
    const dockText = (await page.getByTestId("preview-tool-dock-open").or(page.getByTestId("preview-tool-dock")).first().innerText().catch(() => "")) || "";
    if (/this lesson/i.test(dockText)) break;
    const skip = page.getByRole("button", { name: /^Skip/ }).first();
    if (await skip.isVisible().catch(() => false)) await skip.click(); else { const c = page.getByRole("button", { name: /^(Continue|Next|Start|Let.s go)/i }).first(); if (await c.isVisible().catch(() => false)) await c.click(); else break; }
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(OUT, "t3b-lesson-step.png") });
  const dockBtn = page.getByTestId("preview-tool-dock-open");
  if (await dockBtn.isVisible().catch(() => false)) await dockBtn.click();
  const add = page.getByTestId("preview-tool-add").first();
  await expect(add).toBeVisible({ timeout: 20_000 });
  console.log("ADD BUTTON:", await add.innerText(), "| PANEL:", (await page.getByTestId("preview-question-tool").first().innerText()).replace(/\s+/g, " "));
  await add.click();
  await page.screenshot({ path: path.join(OUT, "t4-picker.png") });
  await page.getByTestId("tool-picker").getByRole("button").filter({ hasText: /Maths/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "t5-picker-card.png") });
  const first = page.locator("[data-testid^='tool-picker-item-']").first();
  console.log("PICKER CARD FIRST BTN:", await first.innerText().catch(() => "none"));
  await first.click().catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "t6-tool-added.png") });
  console.log("PANEL AFTER:", (await page.getByTestId("preview-question-tool").first().innerText()).replace(/\s+/g, " "));
  await ctx.close();
});

test("tutor: mark a hand-in with a score; teach-in-person fits", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "freelancer", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=homework", fx);
  await settle(page);
  const row = page.locator('[data-testid="hub-mark-row"][data-kind="homework"]').first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  await row.click();
  const dlg = page.locator("#hub-mark-dialog");
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("mark-need-score").or(dlg.getByText(/Fill in a score/))).toBeVisible().catch(() => console.log("NO SCORE HINT (score prefilled?)"));
  await page.screenshot({ path: path.join(OUT, "m1-mark-dialog.png") });
  const save = dlg.getByRole("button", { name: /Save mark|Update mark/ });
  console.log("SAVE DISABLED BEFORE SCORE:", await save.isDisabled());
  const inputs = dlg.locator("input[type='number'], input[inputmode='numeric'], input[inputmode='decimal']");
  console.log("NUM INPUTS", await inputs.count());
  await inputs.first().fill("7");
  await dlg.getByRole("textbox").last().fill("Good work, check Q2.").catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, "m2-mark-scored.png") });
  console.log("SAVE DISABLED AFTER SCORE:", await save.isDisabled());
  await save.click();
  await expect(dlg).toBeHidden({ timeout: 20_000 });
  await page.screenshot({ path: path.join(OUT, "m3-after-mark.png") });
  await ctx.close();
  // parent sees it
  const pctx = await ctxFor(browser, "parent", { width: 1440, height: 900 });
  const pp = await pctx.newPage();
  await gotoHubPage(pp, `/custdash/learninghub?tab=homework&child=${fx.kids[0].id}`, fx);
  await settle(pp);
  await pp.screenshot({ path: path.join(OUT, "m4-parent-homework.png"), fullPage: true });
  console.log("PARENT HOMEWORK:", (await pp.locator("#learning-hub").innerText()).replace(/\s+/g, " ").slice(0, 700));
  await pctx.close();
});

test("C1: a note that STORES the credit never renders it (tutor reader, list, search, homework)", async ({ browser }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);
  const credit = "A Biology lesson by Oak National Academy licensed under Open Government Licence (OGL).";
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(fx.accounts.parent.email)).idToken;
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  const topic = topics.find((x) => /^Maths/.test(x.subject))!;
  const title = `Credit probe ${stamp}`;
  const note = await apiFetch<{ id: string }>("/api/learning-hub/notes", t, { method: "POST", body: JSON.stringify({ topicId: topic.id, title, body: `Cells are small.\n\n${credit}`, published: true }) });
  const seen: string[] = [];
  const bad = (label: string, v: unknown) => { if (/oak national|open government|\bOGL\b/i.test(JSON.stringify(v))) seen.push(label); };
  bad("tutor GET note", await apiFetch(`/api/learning-hub/notes/${note.id}`, t));
  bad("tutor list full", await apiFetch(`/api/learning-hub/notes?full=1&q=${encodeURIComponent(title)}`, t));
  bad("tutor list light", await apiFetch(`/api/learning-hub/notes?q=${encodeURIComponent(title)}`, t));
  const hw = await apiFetch<{ id: string }>("/api/learning-hub/homework", t, { method: "POST", body: JSON.stringify({ title: `Credit hw ${stamp}`, instructions: credit, assignedChildIds: [fx.kids[0].id], dueAt: new Date(Date.now() + 86_400_000).toISOString(), noteIds: [note.id] }) });
  bad("tutor homework list", await apiFetch("/api/learning-hub/homework", t));
  bad("parent homework list", await apiFetch(`/api/learning-hub/homework?tenantId=${fx.tenantId}&childId=${fx.kids[0].id}`, p).catch(() => ({})));
  bad("parent GET note", await apiFetch(`/api/learning-hub/notes/${note.id}?tenantId=${fx.tenantId}&childId=${fx.kids[0].id}`, p).catch(() => ({})));
  void hw;
  console.log("C1 API LEAKS:", JSON.stringify(seen));
  expect(seen).toEqual([]);
  const got = await apiFetch<{ body: string }>(`/api/learning-hub/notes/${note.id}`, t);
  expect(got.body).toContain("Cells are small.");
  expect(got.body).not.toMatch(/oak|OGL|Government/i);
});

test("teach-in-person setup: nothing pokes out of its card at 1440 and 390", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await ctxFor(browser, "freelancer", vp);
    const page = await ctx.newPage();
    await gotoHubPage(page, "/freelancer/learninghub?tab=notes", fx);
    await openTab(page, "Teach in person");
    const app = page.getByTestId("inperson-app");
    await expect(app).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `ip-${vp.width}.png`) });
    const clipped = await app.evaluate((root) => {
      const card = root.querySelector("h2")?.closest("div[class*='max-w'], section, div") as HTMLElement | null;
      const box = (card ?? root).getBoundingClientRect();
      const out: string[] = [];
      root.querySelectorAll("input, button").forEach((e) => { const r = (e as HTMLElement).getBoundingClientRect(); if (r.width && r.right > box.right + 1) out.push(`${e.tagName}:${(e as HTMLElement).innerText?.slice(0, 20) || (e as HTMLInputElement).placeholder} right=${Math.round(r.right)} card=${Math.round(box.right)}`); });
      return out.slice(0, 8);
    });
    console.log(`IP CLIP @${vp.width}:`, JSON.stringify(clipped));
    await ctx.close();
  }
});

test("parent: verdict line, progress, printable report", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  const kid = fx.kids[1];
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx);
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "p1-home.png"), fullPage: true });
  console.log("PARENT SPLASH VISIBLE:", await page.locator('img[src="/images/hub-welcome-scene.svg"]').isVisible().catch(() => false));
  const verdict = page.getByTestId("hub-parent-verdict");
  console.log("VERDICT:", await verdict.innerText({ timeout: 30_000 }).catch(() => "none"));
  await page.goto(`/custdash/learninghub?tab=dashboard&child=${kid.id}`);
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "p2-progress.png"), fullPage: true });
  await page.getByTestId("hub-report-open").click({ timeout: 30_000 });
  const report = page.getByTestId("hub-report");
  await expect(report).toBeVisible({ timeout: 30_000 });
  const text = await report.innerText();
  console.log("REPORT:", text.replace(/\s+/g, " ").slice(0, 500));
  expect(text).toContain(kid.name);
  for (const other of fx.kids.filter((k) => k.id !== kid.id)) expect(text).not.toContain(other.name);
  expect(text).not.toMatch(/oak national|open government|\bOGL\b/i);
  await page.screenshot({ path: path.join(OUT, "p3-report.png"), fullPage: false });
  await ctx.close();
});
