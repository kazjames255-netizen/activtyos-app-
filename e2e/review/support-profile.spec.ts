import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, handOver, settle, HUB, type Fx } from "./fixture";

// R-5 support profile: the tutor sets Calm + No timer in the Students "Details" dialog; the child's Home has no streak and a timed
// quiz shows no countdown; extra time is applied server-side; a family account can never change the profile. Throwaway accounts only.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/support");
test.describe.configure({ mode: "serial" });
let fx: Fx;
let quizId = "";
test.beforeAll(async () => {
  test.setTimeout(400_000);
  fx = await buildFixture(2, false);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const qs = await apiFetch<{ id: string; topicId: string }[]>(`${HUB}/questions`, t);
  const tid = qs[0].topicId;
  const same = qs.filter((q) => q.topicId === tid);
  const a = await apiPost<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: `Timed support quiz ${Date.now().toString(36)}`, subject: topics.find((x) => x.id === tid)!.subject, topicIds: [tid], questionIds: same.slice(0, 2).map((q) => q.id), timeLimitMins: 15, passMarkPct: 50, published: true, retakePolicy: "unlimited" });
  quizId = a.id;
});

test("tutor sets support in the UI @390", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "freelancer", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=students", fx);
  await settle(page);
  const kid = fx.kids[0];
  await page.getByRole("button", { name: `Actions for ${kid.name}` }).click();
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  const sec = page.getByTestId("hub-support-section");
  await expect(sec).toBeVisible();
  await sec.getByTestId("support-calm").check();
  await sec.getByTestId("support-notimer").check();
  await sec.scrollIntoViewIfNeeded();
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, "tutor-support-section-390.png") });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#hub-subjects-modal")).toBeHidden({ timeout: 20_000 });
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const row = (await apiFetch<{ childId: string; support?: { calm: boolean; noTimer: boolean } }[]>(`${HUB}/students`, t)).find((s) => s.childId === kid.id);
  expect(row?.support?.calm).toBe(true);
  expect(row?.support?.noTimer).toBe(true);
  await ctx.close();
});

test("server: extra time applied, family cannot edit @api", async () => {
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(fx.accounts.parent.email)).idToken;
  const [k0, k1] = fx.kids;
  await apiFetch(`${HUB}/students/${k1.id}`, t, { method: "PUT", body: JSON.stringify({ support: { extraTimePercent: 50 } }) });
  const start = (kid: string) => apiPost<{ attemptId: string; timeLimitMins: number | null }>(`${HUB}/assessments/${quizId}/attempts?tenantId=${fx.tenantId}&childId=${kid}`, p, {});
  expect((await start(k0.id)).timeLimitMins).toBeNull(); // noTimer
  expect((await start(k1.id)).timeLimitMins).toBe(23); // 15 min +50%, rounded up
  // a family (parent) account is refused, and sees the profile read-only
  await expect(apiFetch(`${HUB}/students/${k0.id}?tenantId=${fx.tenantId}`, p, { method: "PUT", body: JSON.stringify({ support: { calm: false, noTimer: false } }) })).rejects.toThrow(/403|Only tutors/);
  const mine = await apiFetch<{ childId: string; support?: { calm: boolean } }[]>(`${HUB}/students?tenantId=${fx.tenantId}&childId=${k0.id}`, p);
  expect(mine.find((s) => s.childId === k0.id)?.support?.calm).toBe(true);
});

test("child: calm Home, read-aloud, untimed quiz @390", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { // headless Chromium may lack speech: make the button testable without producing sound
    Object.defineProperty(window, "speechSynthesis", { value: { speak() {}, cancel() {}, getVoices: () => [] }, configurable: true });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (this: { text: string }, t: string) { this.text = t; };
  });
  const kid = fx.kids[0];
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx);
  await settle(page);
  await handOver(page, kid.id);
  await settle(page);
  await expect(page.locator("#learning-hub")).toHaveAttribute("data-calm", "1");
  await expect(page.getByTestId("hub-kid-next")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/streak/i)).toHaveCount(0);
  const speak = page.getByTestId("hub-read-next");
  await expect(speak).toBeVisible();
  const box = (await speak.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(speak).toHaveAttribute("aria-label", /aloud/i);
  await page.screenshot({ path: path.join(OUT, "kid-card-speaker-390.png") });
  // the timed (15 min) quiz shows no timer for this child
  await page.goto(`/custdash/learninghub?tab=quizzes&child=${kid.id}`);
  await settle(page);
  const card = page.locator('[data-ui="card"]').filter({ hasText: /Timed support quiz/ }).first();
  await expect(card).toBeVisible({ timeout: 40_000 });
  await expect(card).not.toContainText("15 min"); // shown untimed for this child
  await card.getByRole("button", { name: /^(Start|Retake)$/ }).click();
  await page.getByRole("button", { name: /^(Start|Retake)$/ }).last().click(); // the intro's own Start
  await expect(page.getByTestId("hub-read-question")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("[role=timer]")).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "kid-quiz-untimed-390.png") });
  await ctx.close();
});
