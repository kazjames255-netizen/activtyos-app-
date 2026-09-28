import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch as _f, apiPost as _p, fbSignIn as _s } from "../helpers/accounts";
import { seedOakLesson } from "../helpers/lessonFixture";
import { buildFixture, ctxFor, gotoHubPage, settle, HUB, type Fx } from "./fixture";

// Product review H1, reproduced properly: a KS1 (Year 1) child whose tutor has NOT opened a published lesson to them (the tenant default,
// `lessonAccess: "assigned"`). The lesson's exit quiz is still a published quiz that fits the child, so it used to be offered as a
// "Finish a lesson to unlock" card whose button led to a lesson the family may not read: red "Lesson not found".
//   A. root cause, at the API: the family cannot read that lesson (404 "Lesson not found")
//   B. the fix: the quiz for that locked lesson is NOT offered (no dead card)
//   C. once the tutor assigns the lesson the card appears and its lesson opens (no false "hidden" state)
// Throwaway @activityos-test.com accounts only (own fixture, .auth-pj), never the locked queue or a real tenant.
const OUT = path.join(ROOT, "docs/reviews/shots/product-fix");
const CACHE = path.join(ROOT, "e2e/review/.ks1-fixture.json");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => {
  test.setTimeout(500_000);
  fs.mkdirSync(OUT, { recursive: true });
  if (fs.existsSync(CACHE) && !process.env.PJ_REBUILD) { fx = JSON.parse(fs.readFileSync(CACHE, "utf8")); return; }
  fx = await buildFixture(2, false, undefined, 1); // kid 0 is Year 1 (KS1), kid 1 is Year 5
  fs.writeFileSync(CACHE, JSON.stringify(fx));
});

// The shared dev API sometimes drops sockets under load: retry transient network errors only (same rule as fixture.ts).
async function R<T>(fn: () => Promise<T>): Promise<T> {
  for (let a = 0; ; a++) {
    try { return await fn(); } catch (e) {
      if (a < 5 && /fetch failed|other side closed|ECONNRESET|timeout/i.test(String(e) + String((e as { cause?: unknown }).cause))) { await new Promise((r) => setTimeout(r, 3000 * (a + 1))); continue; }
      throw e;
    }
  }
}
const apiFetch: typeof _f = (...a) => R(() => _f(...a));
const apiPost: typeof _p = (...a) => R(() => _p(...a));
const fbSignIn: typeof _s = (...a) => R(() => _s(...a));
const rawGet = (url: string, token: string) => R(() => fetch(url, { headers: { Authorization: `Bearer ${token}` } }));

interface NoteRow { id: string; title: string; lessonQuizId?: string | null; lesson?: { quizId?: string | null } | null }
const qs = () => `?tenantId=${fx.tenantId}&childId=${fx.kids[0].id}`;

test("KS1 locked lesson: no dead card, and it opens once assigned", async ({ browser }) => {
  test.setTimeout(400_000);
  console.log("STEP signin");
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(fx.accounts.parent.email)).idToken;
  console.log("STEP notes");
  // A brand-new lesson (+ exit quiz) every run, so the "not yet assigned" state is real each time (assigning is permanent).
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  // The fixture's OWN topic (the child is enrolled in that subject); a shared-library Maths topic is outside the child's enrolment, which is a second, different 404.
  const topic = topics.find((x) => /^Maths [a-z0-9]+$/.test(x.subject) && !x.id.startsWith("shared-"))!;
  const seeded = await R(() => seedOakLesson(t, { stamp: Date.now().toString(36), subject: topic.subject, topicId: topic.id, widget: "neurone" }));
  const lesson: NoteRow = { id: seeded.noteId, title: seeded.title, lessonQuizId: seeded.quizId };
  console.log("SEEDED LESSON:", lesson.id, "quiz", seeded.quizId);
  const quizId = seeded.quizId;

  // The tenant default must be "assigned" (only what the tutor set), otherwise this is not the situation under test.
  const cfg = await apiFetch<{ lessonAccess?: string }>(`${HUB}/config`, t).catch(() => ({} as { lessonAccess?: string }));
  console.log("LESSON ACCESS MODE:", cfg.lessonAccess ?? "(default)");

  // A. root cause: the family cannot read the lesson.
  const dead = await rawGet(`${process.env.API_URL ?? "http://localhost:4000"}${HUB}/notes/${lesson.id}${qs()}`, p);
  const deadBody = await dead.json().catch(() => ({}));
  console.log("FAMILY GET LOCKED LESSON:", dead.status, JSON.stringify(deadBody));
  expect(dead.status).toBe(404);
  expect(JSON.stringify(deadBody)).toContain("Lesson not found");

  // B. the fix: the quiz that belongs to that locked lesson is not offered.
  const list = await apiFetch<{ id: string; lessonNoteId?: string | null }[] | { items: { id: string; lessonNoteId?: string | null }[] }>(`${HUB}/assessments${qs()}`, p);
  const items = Array.isArray(list) ? list : list.items;
  console.log("ASSESSMENTS OFFERED:", items.length, "lesson-quiz cards for the locked lesson:", items.filter((a) => a.id === quizId).length);
  expect(items.some((a) => a.id === quizId)).toBe(false);
  expect(items.every((a) => !a.lessonNoteId || a.lessonNoteId !== lesson.id)).toBe(true);

  // UI: the KS1 kid's Play & learn has no lesson-first card and no "Lesson not found".
  const ctx = await ctxFor(browser, "parent", { width: 390, height: 844 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
  await page.getByRole("button", { name: new RegExp(`Hand over to ${fx.kids[0].name}`) }).click({ timeout: 60_000 });
  await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 30_000 });
  await settle(page);
  await page.getByRole("tab", { name: /Play/ }).click();
  await settle(page);
  await expect(page.locator("#learning-hub").getByText(seeded.quizTitle)).toHaveCount(0); // this run's locked lesson has no card (an earlier run's ASSIGNED lesson may, correctly)
  await expect(page.getByText("Lesson not found")).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "ks1-locked-before-assign.png"), fullPage: true });

  // C. the tutor opens the lesson to this child (homework with the lesson attached) -> the card appears and the lesson opens.
  await apiPost(`${HUB}/homework`, t, { title: `Read the lesson ${Date.now().toString(36)}`, instructions: "Have a go.", assignedChildIds: [fx.kids[0].id], noteIds: [lesson.id], dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
  // The family's assigned-lesson set is cached server-side for a short while: poll rather than assume it is instant.
  await expect.poll(async () => (await rawGet(`${process.env.API_URL ?? "http://localhost:4000"}${HUB}/notes/${lesson.id}${qs()}`, p)).status, { timeout: 120_000, intervals: [3_000] }).toBe(200);
  console.log("FAMILY GET ASSIGNED LESSON: 200");
  await expect.poll(async () => {
    const after = await apiFetch<{ id: string; lessonNoteId?: string | null }[] | { items: { id: string; lessonNoteId?: string | null }[] }>(`${HUB}/assessments${qs()}`, p);
    return (Array.isArray(after) ? after : after.items).some((a) => a.id === quizId && a.lessonNoteId === lesson.id);
  }, { timeout: 120_000, intervals: [3_000] }).toBe(true);
  await page.reload();
  // Kid mode survives a reload; only hand over again if it did not.
  const handBtn = page.getByRole("button", { name: new RegExp(`Hand over to ${fx.kids[0].name}`) });
  if (await handBtn.first().isVisible({ timeout: 15_000 }).catch(() => false)) await handBtn.first().click();
  await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 60_000 });
  await settle(page);
  await page.getByRole("tab", { name: /Play/ }).click();
  await settle(page);
  const card = page.locator(`[data-lesson-quiz="${seeded.quizId}"]`);
  const start = card.getByTestId("hub-quiz-start-lesson");
  await expect(start.first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, "ks1-locked-after-assign.png"), fullPage: true });
  await start.first().click();
  await page.waitForTimeout(3000);
  await expect(page.getByText("Lesson not found")).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "ks1-locked-lesson-opened.png"), fullPage: true });
  await ctx.close();
});
