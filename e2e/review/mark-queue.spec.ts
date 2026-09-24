import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";
import { buildFixture, ctxFor, gotoHubPage, settle, HUB, type Fx } from "./fixture";
import { openTab } from "../helpers/hubTabs";

// R-2 One Mark queue: the Homework tab's first view lists hand-ins, written quiz answers and written starting-quiz answers together;
// marking one advances to the next row (whatever its kind); the old entry points still open. Throwaway accounts only.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/mark");
test.describe.configure({ mode: "serial" });
let fx: Fx;

test.beforeAll(async () => {
  test.setTimeout(500_000);
  fx = await buildFixture(3, true); // 3 homework hand-ins waiting
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(fx.accounts.parent.email)).idToken;
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topic = topics.find((x) => /^Maths/.test(x.subject))!;
  const stamp = Date.now().toString(36);
  const q = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "written", prompt: `Explain a fraction ${stamp}`, marks: 4 });
  // the fixture already holds a Maths starting quiz (one per subject), so the written one is English
  const eng = topics.find((x) => /^English/.test(x.subject))!;
  const q2 = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId: eng.id, kind: "written", prompt: `Describe the story ${stamp}`, marks: 4 });
  const mk = (type: "quiz" | "diagnostic", title: string) => apiPost<{ id: string }>(`${HUB}/assessments`, t, { type, title, subject: type === "quiz" ? topic.subject : eng.subject, topicIds: [type === "quiz" ? topic.id : eng.id], questionIds: [type === "quiz" ? q.id : q2.id], timeLimitMins: null, passMarkPct: 50, published: true, ...(type === "quiz" ? { retakePolicy: "unlimited" } : {}) });
  const quiz = await mk("quiz", `Written quiz ${stamp}`);
  const start = await mk("diagnostic", `Written starting quiz ${stamp}`);
  for (const [a, kid] of [[quiz, fx.kids[0]], [start, fx.kids[1]]] as const) {
    const qp = `?tenantId=${fx.tenantId}&childId=${kid.id}`;
    const s = await apiPost<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${a.id}/attempts${qp}`, p, {});
    await apiPost(`${HUB}/attempts/${s.attemptId}/submit${qp}`, p, { answers: s.questions.map((x) => ({ questionId: x.id, response: "A part of a whole." })) });
  }
});

test("one list shows all three kinds, marking advances, old links still open", async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await ctxFor(browser, "freelancer", { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await gotoHubPage(page, "/freelancer/learninghub?tab=homework", fx);
  await settle(page);
  const rows = page.getByTestId("hub-mark-row");
  await expect(rows.first()).toBeVisible({ timeout: 45_000 });
  for (const kind of ["homework", "quiz", "starting"]) await expect(page.locator(`[data-testid="hub-mark-row"][data-kind="${kind}"]`).first()).toBeVisible();
  await expect(page.locator("#hub-tab-homework")).toContainText(/\d/); // tab badge counts the queue
  const before = await rows.count();
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, "queue-1440.png"), fullPage: true });

  // mark the first (homework) row, then "Mark & next" lands on the next row in place
  await page.getByTestId("hub-mark-next").click();
  const dlg = page.locator("#hub-mark-dialog");
  await expect(dlg).toBeVisible();
  const first = (await dlg.locator("h2, [role=heading]").first().innerText()) + (await dlg.getByText(/handed in/).first().innerText());
  await dlg.locator("#hub-mark-score").fill("8");
  await dlg.getByRole("button", { name: /Mark & next/ }).click();
  // the dialog moves on to a DIFFERENT hand-in (or, once hand-ins run out, to the next row's own form)
  await expect(async () => { expect((await dlg.locator("h2, [role=heading]").first().innerText().catch(() => "")) + (await dlg.getByText(/handed in/).first().innerText().catch(() => ""))).not.toBe(first); }).toPass({ timeout: 20_000 });
  await page.screenshot({ path: path.join(OUT, "next-1440.png") });
  await dlg.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(dlg).toBeHidden();
  await expect(async () => { expect(await rows.count()).toBeLessThan(before); }).toPass({ timeout: 30_000 });

  // a written quiz answer opens the existing mark form from the same list and Save-and-next stays in the queue
  await page.locator('[data-testid="hub-mark-row"][data-kind="quiz"]').first().click();
  await expect(page.getByTestId("hub-mark-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("hub-marks-input").first().fill("3");
  await page.getByTestId("hub-save-marks").click();
  await expect(page.getByTestId("hub-mark-form").or(page.getByTestId("hub-mark-queue")).or(page.getByTestId("hub-mark-empty"))).toBeVisible({ timeout: 20_000 });

  // the old entry points: notification / bookmark deep links still land where they did
  await page.goto("/freelancer/learninghub?tab=diagnostic");
  await expect(page.getByRole("radio", { name: /^Marking/ })).toBeVisible({ timeout: 45_000 });
  await page.goto("/freelancer/learninghub?tab=quizzes");
  await expect(page.getByRole("radio", { name: /^Marking/ })).toBeVisible({ timeout: 45_000 });
  await page.goto("/freelancer/learninghub?tab=homework");
  await openTab(page, /^Inbox/);
  await expect(page.locator("#hub-inbox, #hub-homework").first()).toBeVisible();
  await ctx.close();

  const m = await ctxFor(browser, "freelancer", { width: 390, height: 844 });
  const mp = await m.newPage();
  await gotoHubPage(mp, "/freelancer/learninghub?tab=homework", fx);
  await settle(mp);
  await mp.screenshot({ path: path.join(OUT, "queue-390.png"), fullPage: true });
  await m.close();
});
