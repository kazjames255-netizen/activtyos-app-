import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, handOver, settle, HUB, type Fx } from "./fixture";
import { openTab } from "../helpers/hubTabs";

// Tools are ASSIGNED to questions by the selection rules: the tutor writing a maths question sees which tools pupils will be offered, and the
// child answering it gets a button that opens the tool. Throwaway accounts only.
//   npx playwright test e2e/review/tool-assign.spec.ts --project=e2e --workers=1 -c playwright.review.config.ts
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/tools");
const PROMPT = "Use a protractor to measure the size of the angle in the triangle.";
test.describe.configure({ mode: "serial" });
let fx: Fx; let title = "";

test.beforeAll(async () => {
  test.setTimeout(400_000);
  fx = await buildFixture(1, false);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topic = topics.find((x) => /^Maths/.test(x.subject))!;
  const stamp = Date.now().toString(36);
  title = `Angles with tools ${stamp}`;
  const q = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "short", prompt: PROMPT, answer: "60", marks: 1 });
  await apiPost(`${HUB}/assessments`, t, { type: "quiz", title, subject: topic.subject, topicIds: [topic.id], questionIds: [q.id], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" });
});

test("the tutor form suggests a tool for the question", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await ctxFor(browser, "freelancer", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=quizzes", fx);
  await settle(page);
  await page.getByRole("radio", { name: "Question bank" }).click();
  await page.getByTestId("hub-new-question").click();
  const qf = page.locator("#hub-question-form");
  await expect(qf).toBeVisible();
  await qf.getByTestId("hq-topic-subjects").getByRole("button", { name: /^Maths/ }).first().click();
  await qf.getByTestId("hq-topic-list").getByRole("option").first().click();
  await qf.getByRole("radio", { name: /Short answer/ }).click();
  await qf.getByLabel("Question", { exact: true }).fill(PROMPT);
  const box = qf.getByTestId("form-tools");
  await expect(box).toBeVisible({ timeout: 15_000 });
  await expect(box.locator("[data-testid^='form-tool-']").first()).toBeVisible();
  await expect(box.locator("[data-testid^='form-tool-why-']").first()).toContainText(/Suggested because/);
  await box.scrollIntoViewIfNeeded();
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, "assign-tutor-390.png") });
  await ctx.close();
});

test("the child sees the tool button and it opens the tool", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=quizzes&child=${fx.kids[0].id}`, fx);
  await page.locator("[data-testid='hub-hand-over'],[data-testid='hub-hand-over-toggle']").first().waitFor({ timeout: 40_000 });
  await handOver(page, fx.kids[0].id);
  await openTab(page, /^Quizzes/);
  const card = page.locator("[id^='hub-assess-']").filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByTestId("hub-open-assessment").click();
  await page.getByTestId("hub-start").click();
  const runner = page.getByTestId("hub-runner");
  await expect(runner).toBeVisible({ timeout: 30_000 });
  const tools = runner.getByTestId("question-tools");
  await expect(tools).toBeVisible({ timeout: 20_000 });
  const btn = tools.locator("[data-testid^='question-tool-']").first();
  await expect(btn).toBeVisible();
  await tools.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "assign-child-390.png") });
  await btn.click();
  const dlg = page.getByRole("dialog").last();
  await expect(dlg).toBeVisible({ timeout: 15_000 });
  await expect(dlg.getByRole("alert").filter({ hasText: /ran into a problem/ })).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "assign-child-tool-open-390.png") });
  await ctx.close();
});
