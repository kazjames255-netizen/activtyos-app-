import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — the two arrange-it question kinds, `match` and `order`.
//  1. the tutor authors a match and an order question in the bank form (validation, live
//     preview), then builds and publishes a quiz from them in the UI;
//  2. the API contract: a student is never sent the key, the shuffle is stable across a
//     resume, and marking is exact (whitespace / case ignored, one swap or a repeated pair
//     fails);
//  3. a parent sits the quiz doing REAL mouse drags (definitions onto terms, cards into
//     sequence, plus the arrow buttons) and gets it all right;
//  4. a second quiz answered wrongly (tap-to-select, an unmoved shuffle): "Not quite", and
//     the tutor's Results view shows the child's arrangement and the correct one.
// Every state assertion is anchored to THIS run's prompts / titles (cardWith, run-unique text).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Fractions ${stamp}`;
const childName = `Kindkid ${stamp}`;
const quizA = `Arrange quiz ${stamp}`;
const quizB = `Arrange retry ${stamp}`;
// ResultView renders each pair as `term →` + a screen-reader-only "matched with" + the match.
const pairText = ([t, d]: string[]) => new RegExp(`${t}\\s*→\\s*(matched with\\s*)?${d}`);
const MATCH_Q = `Match each fraction word to its meaning (${stamp})`;
const ORDER_Q = `Put the steps of adding fractions in order (${stamp})`;
const PAIRS: [string, string][] = [
  ["Numerator", "The top number"],
  ["Denominator", "The bottom number"],
  ["Equivalent", "Same value, different look"],
  ["Improper", "Top is bigger than the bottom"],
];
const STEPS = ["Find a common denominator", "Rewrite each fraction", "Add the numerators", "Simplify the answer"];

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let accounts: AccountManifest["accounts"];
let childId = "";
let tid = "";
let topicId = "";
let matchId = "";
let orderId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
import { tabOf, openTab } from "./helpers/hubTabs";

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent") {
  const ctx = await browser.newContext({ storageState: statePath(role) });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return ctx;
}

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openParentHub(page: Page, tab: RegExp) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(accounts.freelancer.tenantId!);
  const select = page.getByRole("combobox", { name: "Child" });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
  else {
    const radio = page.getByRole("radio", { name: childName });
    if (await radio.isVisible().catch(() => false)) await radio.click();
  }
  await openTab(page, tab);
}
async function openTutorHub(page: Page, tab: RegExp) {
  await gotoHub(page, "/freelancer/learninghub");
  await openTab(page, tab);
}

// ── raw API (tutor / parent) ─────────────────────────────────────────────────
const HUB = "/api/learning-hub";
const kidQ = () => `?tenantId=${tid}&childId=${childId}`;
const start = async (parent: string, assessmentId: string) => apiFetch<J>(`${HUB}/assessments/${assessmentId}/attempts${kidQ()}`, parent, { method: "POST", body: JSON.stringify({ childId }) });
const submit = async (parent: string, attemptId: string, answers: { questionId: string; response: unknown }[]) => apiFetch<J>(`${HUB}/attempts/${attemptId}/submit${kidQ()}`, parent, { method: "POST", body: JSON.stringify({ answers }) });
const publish = async (tutor: string, title: string, questionIds: string[]) =>
  apiPost<{ id: string }>(`${HUB}/assessments`, tutor, { type: "quiz", title, subject, topicIds: [topicId], questionIds, timeLimitMins: null, passMarkPct: 50, published: true });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tid = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Kinds Tuition ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Vocabulary" });
  await apiPost(`${HUB}/students`, t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  topicId = topics.find((x) => x.subject === subject)!.id;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

// ── real pointer gestures ────────────────────────────────────────────────────
async function centre(l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw new Error("not on screen");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
/** Press on `from`, wiggle past the drag threshold, glide to (x, y) in steps, release. */
async function dragTo(page: Page, from: Locator, x: number, y: number) {
  const a = await centre(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 3 });
  await page.mouse.move(x, y, { steps: 14 });
  await page.mouse.up();
}
const orderTexts = (runner: Locator) => runner.locator('[data-testid="hub-order-item"]').evaluateAll((els) => els.map((e) => e.querySelector("span:nth-child(2)")!.textContent!.trim()));

test.describe("the tutor authors in the UI", () => {
  test("writes a matching and an ordering question, previews them, builds and publishes a quiz", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Quizzes/);
    await page.getByRole("radio", { name: "Question bank" }).click();

    // ── match ──
    await page.locator('[data-testid="hub-new-question"]').click();
    const qf = page.locator("#hub-question-form");
    await expect(qf).toBeVisible();
    await qf.getByTestId("hq-topic-subjects").getByRole("button", { name: subject, exact: true }).click();
    await qf.getByTestId("hq-topic-list").getByRole("option", { name: "Vocabulary", exact: true }).click();
    await qf.getByRole("radio", { name: /Matching pairs/ }).click();
    await qf.getByLabel("Question", { exact: true }).fill(MATCH_Q);
    // Three blank rows to start; saving with none filled is refused in words.
    await expect(qf.locator('[data-testid="hub-match-editor"]').getByLabel(/^Pair \d term$/)).toHaveCount(3);
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf.getByText("Add at least 3 pairs.").first()).toBeVisible();
    // A half-filled row is refused too.
    await qf.getByLabel("Pair 1 term").fill("Numerator");
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf.getByText("Every pair needs both a term and its match.").first()).toBeVisible();
    await qf.getByLabel("Pair 1 match").fill(PAIRS[0][1]);
    for (let i = 1; i < 3; i++) {
      await qf.getByLabel(`Pair ${i + 1} term`).fill(PAIRS[i][0]);
      await qf.getByLabel(`Pair ${i + 1} match`).fill(PAIRS[i][1]);
    }
    await qf.getByRole("button", { name: "+ Add a pair" }).click();
    await qf.getByLabel("Pair 4 term").fill(PAIRS[3][0]);
    await qf.getByLabel("Pair 4 match").fill(PAIRS[3][1]);
    // The live preview is the very component a child answers with.
    const preview = qf.getByRole("complementary", { name: "Student preview" });
    await expect(preview.locator('[data-testid="hub-match-term"]')).toHaveCount(4);
    await expect(preview.locator('[data-testid="hub-match-tile"]')).toHaveCount(4);
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf).toHaveCount(0);
    await page.getByPlaceholder("Search questions…").fill(stamp); // the bank is paged (40) and grows across specs — narrow to THIS run
    await expect(cardWith(page, MATCH_Q, "Matching pairs", "Published")).toBeVisible({ timeout: 60_000 });

    // ── order ──
    await page.locator('[data-testid="hub-new-question"]').click();
    await expect(qf).toBeVisible();
    await qf.getByTestId("hq-topic-subjects").getByRole("button", { name: subject, exact: true }).click();
    await qf.getByTestId("hq-topic-list").getByRole("option", { name: "Vocabulary", exact: true }).click();
    await qf.getByRole("radio", { name: /Put in order/ }).click();
    await qf.getByLabel("Question", { exact: true }).fill(ORDER_Q);
    await qf.locator("#hq-marks").fill("2");
    await qf.getByLabel("Item 1", { exact: true }).fill(STEPS[0]);
    await qf.getByLabel("Item 2", { exact: true }).fill(STEPS[2]); // deliberately wrong way round…
    await qf.getByLabel("Item 3", { exact: true }).fill(STEPS[1]);
    await qf.getByRole("button", { name: "+ Add an item" }).click();
    await qf.getByLabel("Item 4", { exact: true }).fill(STEPS[3]);
    await qf.getByRole("button", { name: "Move item 3 up" }).click(); // …then fixed with the arrows
    await expect(qf.getByLabel("Item 2", { exact: true })).toHaveValue(STEPS[1]);
    await expect(qf.getByLabel("Item 3", { exact: true })).toHaveValue(STEPS[2]);
    await expect(qf.getByRole("complementary", { name: "Student preview" }).locator('[data-testid="hub-order-item"]')).toHaveCount(4);
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf).toHaveCount(0);
    await page.getByPlaceholder("Search questions…").fill(stamp);
    await expect(cardWith(page, ORDER_Q, "Put in order", "Published")).toBeVisible({ timeout: 60_000 });

    // ── the quiz ──
    await page.getByRole("radio", { name: "Quizzes" }).click();
    await page.locator('[data-testid="hub-new-assessment"]').click();
    const dlg = page.locator("#hub-assessment-builder");
    await expect(dlg).toBeVisible();
    await dlg.getByLabel("Title").fill(quizA);
    await dlg.getByLabel("Subject").selectOption({ label: subject });
    await dlg.getByLabel("Pass mark %").fill("50");
    for (let i = 0; i < 2; i++) await dlg.getByRole("button", { name: /^Add “/ }).first().click();
    await expect(dlg.getByText("2 questions, 3 marks").first()).toBeVisible();
    await dlg.getByRole("switch").last().click(); // publish
    const saved = page.waitForResponse((r) => r.url().includes(`${HUB}/assessments`) && r.request().method() === "POST");
    await dlg.locator('[data-testid="hub-save-assessment"]').click();
    expect((await saved).status()).toBe(201);
    // The list groups by subject and collapses the groups (the standing tutor has many by now) — narrow to THIS run's.
    await page.getByRole("group", { name: "Filter by subject" }).getByRole("button", { name: subject }).click();
    await expect(cardWith(page, quizA, "Published", "2 questions")).toBeVisible({ timeout: 30_000 });
    await ctx.close();

    // The bank now holds both, with their keys, for the API tests below.
    const t = await token(accounts.freelancer);
    const rows = await apiFetch<J[]>(`${HUB}/questions?topicId=${topicId}`, t);
    matchId = rows.find((r) => r.prompt === MATCH_Q)!.id;
    orderId = rows.find((r) => r.prompt === ORDER_Q)!.id;
    const mq = rows.find((r) => r.id === matchId)!, oq = rows.find((r) => r.id === orderId)!;
    expect(mq).toMatchObject({ kind: "match", answer: null, marks: 1 });
    expect(mq.pairs.map((p: J) => [p.term, p.definition])).toEqual(PAIRS);
    expect(oq).toMatchObject({ kind: "order", answer: null, marks: 2, items: STEPS });
    await publish(t, quizB, [matchId, orderId]);
  });
});

test.describe("the API: no key, stable shuffle, exact marking", () => {
  test("a student is never sent the answer, and the shuffle survives a resume", async () => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    const parent = await token(accounts.parent);
    const quiz = await publish(t, `Leak check ${stamp}`, [matchId, orderId]);
    const s1 = await start(parent, quiz.id);
    const wire = JSON.stringify(s1);
    const m = s1.questions.find((q: J) => q.id === matchId), o = s1.questions.find((q: J) => q.id === orderId);
    // What a student gets: terms as written, definitions and items shuffled — and nothing that says which goes with which.
    expect(m.terms.map((x: J) => x.text)).toEqual(PAIRS.map((p) => p[0]));
    expect(m.definitions.map((x: J) => x.text).sort()).toEqual(PAIRS.map((p) => p[1]).sort());
    expect(m.definitions.map((x: J) => x.text)).not.toEqual(PAIRS.map((p) => p[1]));
    expect([...o.items].sort()).toEqual([...STEPS].sort());
    expect(o.items).not.toEqual(STEPS);
    for (const q of [m, o]) for (const k of ["pairs", "answer", "correctAnswer", "correct", "acceptedAnswers"]) expect(q, `${k} leaked`).not.toHaveProperty(k);
    expect(wire).not.toMatch(/"pairs"|"correctAnswer"|"answer"\s*:/);
    // A refresh / resume does not reshuffle.
    const s2 = await start(parent, quiz.id);
    expect(s2.resumed).toBe(true);
    expect(s2.attemptId).toBe(s1.attemptId);
    expect(s2.questions.find((q: J) => q.id === matchId).definitions).toEqual(m.definitions);
    expect(s2.questions.find((q: J) => q.id === orderId).items).toEqual(o.items);
    // The same running attempt read back through GET also carries no key.
    const running = await apiFetch<J>(`${HUB}/attempts/${s1.attemptId}${kidQ()}`, parent);
    expect(JSON.stringify(running)).not.toMatch(/"pairs"|"correctAnswer"/);

    // Right answers with stray spaces (case is exact — EE / Ee / ee are different answers): both correct, full marks.
    const good = await submit(parent, s1.attemptId, [
      { questionId: matchId, response: { kind: "match", pairs: [...PAIRS].reverse().map(([term, definition]) => ({ term: `  ${term} `, definition: definition })) } },
      { questionId: orderId, response: { kind: "order", items: STEPS.map((x) => `  ${x} `) } },
    ]);
    expect(good).toMatchObject({ status: "marked", scoreMarks: 3, maxMarks: 3, pct: 100, passed: true });
    expect(good.answers.find((a: J) => a.questionId === matchId)).toMatchObject({ correct: true, marksAwarded: 1 });
    expect(good.answers.find((a: J) => a.questionId === orderId)).toMatchObject({ correct: true, marksAwarded: 2 });
  });

  test("one pair swapped, a repeated pair, a reordered sequence and blanks all fail", async () => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    const parent = await token(accounts.parent);
    const pair = ([term, definition]: [string, string]) => ({ term, definition });
    const swapped = [{ term: PAIRS[0][0], definition: PAIRS[1][1] }, { term: PAIRS[1][0], definition: PAIRS[0][1] }, pair(PAIRS[2]), pair(PAIRS[3])];
    const repeated = [pair(PAIRS[0]), pair(PAIRS[0]), pair(PAIRS[1]), pair(PAIRS[2])];
    const twoSwapped = [STEPS[1], STEPS[0], STEPS[2], STEPS[3]];
    const cases: { name: string; match: unknown; order: unknown }[] = [
      { name: "swap / reordered", match: { kind: "match", pairs: swapped }, order: { kind: "order", items: twoSwapped } },
      { name: "repeated / reversed", match: { kind: "match", pairs: repeated }, order: { kind: "order", items: [...STEPS].reverse() } },
      { name: "partial / short", match: { kind: "match", pairs: PAIRS.slice(0, 3).map(pair) }, order: { kind: "order", items: STEPS.slice(0, 3) } },
      { name: "blank", match: { kind: "match", pairs: [] }, order: null },
    ];
    for (const c of cases) {
      const quiz = await publish(t, `Wrong ${c.name} ${stamp}`, [matchId, orderId]);
      const s = await start(parent, quiz.id);
      const r = await submit(parent, s.attemptId, [{ questionId: matchId, response: c.match }, { questionId: orderId, response: c.order }]);
      expect(r, c.name).toMatchObject({ status: "marked", scoreMarks: 0, pct: 0 });
      for (const a of r.answers) expect(a, c.name).toMatchObject({ correct: false, marksAwarded: 0 });
    }
  });
});

test.describe("the family sits it, dragging", () => {
  test("real mouse drags and the arrow buttons; everything marked right", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, quizA);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("2 questions");
    await card.locator('[data-testid="hub-open-assessment"]').click();
    await page.locator('[data-testid="hub-start"]').click();
    const runner = page.locator('[data-testid="hub-runner"]');
    await expect(runner).toBeVisible({ timeout: 20_000 });

    for (let i = 0; i < 2; i++) {
      const legend = (await runner.locator("legend").innerText()).trim();
      if (legend.includes(MATCH_Q)) {
        const slots = runner.locator('[data-testid="hub-match-slot"]');
        await expect(slots).toHaveCount(4);
        await expect(runner.locator('[data-testid="hub-match-term"]').first()).toContainText(PAIRS[0][0]);
        for (let k = 0; k < PAIRS.length; k++) {
          const tile = runner.locator('[data-testid="hub-match-tile"][data-where="pool"]').filter({ hasText: PAIRS[k][1] });
          const to = await centre(slots.nth(k));
          await dragTo(page, tile, to.x, to.y);
          await expect(slots.nth(k)).toContainText(PAIRS[k][1]);
        }
        // Everything is placed: nothing left in the pool but the hint.
        await expect(runner.locator('[data-testid="hub-match-tile"][data-where="pool"]')).toHaveCount(0);
        // Forgiving drop: lift one tile back out to the pool, then release it just outside its box.
        const slot2 = slots.nth(2);
        await dragTo(page, slot2.locator('[data-testid="hub-match-tile"]'), (await centre(runner.locator('[data-testid="hub-match-pool"]'))).x, (await centre(runner.locator('[data-testid="hub-match-pool"]'))).y);
        await expect(slot2).not.toContainText(PAIRS[2][1]);
        // Released 20px to the LEFT of the box (over the term, not the box): the nearest box within 48px still takes it.
        const box = (await slot2.boundingBox())!;
        await dragTo(page, runner.locator('[data-testid="hub-match-tile"][data-where="pool"]').filter({ hasText: PAIRS[2][1] }), box.x - 20, box.y + box.height / 2);
        await expect(slot2).toContainText(PAIRS[2][1]);
      } else if (legend.includes(ORDER_Q)) {
        const items = runner.locator('[data-testid="hub-order-item"]');
        await expect(items).toHaveCount(4);
        // The arrow buttons move a card, and say so.
        const first = (await orderTexts(runner))[0];
        await runner.getByRole("button", { name: `Move ${first} down` }).click();
        expect((await orderTexts(runner))[1]).toBe(first);
        await runner.getByRole("button", { name: `Move ${first} up` }).click();
        expect((await orderTexts(runner))[0]).toBe(first);
        // Drags: fix position 0, then 1, then 2 (a selection sort with the mouse).
        for (let pass = 0; pass < 3 && JSON.stringify(await orderTexts(runner)) !== JSON.stringify(STEPS); pass++) {
          for (let k = 0; k < STEPS.length - 1; k++) {
            const now = await orderTexts(runner);
            if (now[k] === STEPS[k]) continue;
            const j = now.indexOf(STEPS[k]);
            const target = await centre(items.nth(k));
            await dragTo(page, items.nth(j), target.x, target.y - 8);
          }
        }
        expect(await orderTexts(runner)).toEqual(STEPS);
        await expect(items.first()).toContainText(STEPS[0]);
      } else throw new Error(`unexpected question: ${legend}`);
      if (i < 1) await runner.locator('[data-testid="hub-next"]').click();
      else await runner.locator('[data-testid="hub-review"]').click();
    }
    await expect(page.getByText("Ready to hand in?")).toBeVisible();
    await page.locator('[data-testid="hub-handin"]').click();
    await page.locator('[data-testid="hub-confirm-submit"]').click();

    const result = page.locator('[data-testid="hub-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result.locator('[data-testid="hub-result-banner"]')).toHaveAttribute("data-kind", "passed");
    const m = result.locator('[data-testid="hub-review-item"]').filter({ hasText: MATCH_Q });
    await expect(m).toContainText("Correct");
    await expect(m).toContainText("1 / 1 marks");
    await expect(m.locator('[data-testid="hub-answer-match"]')).toContainText(pairText(PAIRS[3]));
    const o = result.locator('[data-testid="hub-review-item"]').filter({ hasText: ORDER_Q });
    await expect(o).toContainText("Correct");
    await expect(o).toContainText("2 / 2 marks");
    await expect(o.locator('[data-testid="hub-answer-order"] li')).toHaveCount(4);
    await ctx.close();
  });

  test("tap-to-select and an unchanged shuffle: marked wrong, the tutor sees both arrangements", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, quizB);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.locator('[data-testid="hub-open-assessment"]').click();
    await page.locator('[data-testid="hub-start"]').click();
    const runner = page.locator('[data-testid="hub-runner"]');
    await expect(runner).toBeVisible({ timeout: 20_000 });

    for (let i = 0; i < 2; i++) {
      const legend = (await runner.locator("legend").innerText()).trim();
      if (legend.includes(MATCH_Q)) {
        const slots = runner.locator('[data-testid="hub-match-slot"]');
        // Tap an answer, then tap a box — each definition into the NEXT term's box (all wrong).
        for (let k = 0; k < PAIRS.length; k++) {
          const tile = runner.locator('[data-testid="hub-match-tile"][data-where="pool"]').filter({ hasText: PAIRS[k][1] });
          await tile.click();
          await expect(tile).toHaveAttribute("aria-pressed", "true");
          await slots.nth((k + 1) % PAIRS.length).click();
          await expect(slots.nth((k + 1) % PAIRS.length)).toContainText(PAIRS[k][1]);
        }
      } else if (legend.includes(ORDER_Q)) {
        // Nothing moved: "This order looks right" keeps the shuffle, which is never the answer.
        await runner.locator('[data-testid="hub-order-keep"]').click();
        await expect(runner.locator('[data-testid="hub-order-keep"]')).toHaveCount(0);
        expect(await orderTexts(runner)).not.toEqual(STEPS);
      } else throw new Error(`unexpected question: ${legend}`);
      if (i < 1) await runner.locator('[data-testid="hub-next"]').click();
      else await runner.locator('[data-testid="hub-review"]').click();
    }
    await page.locator('[data-testid="hub-handin"]').click();
    await page.locator('[data-testid="hub-confirm-submit"]').click();
    const result = page.locator('[data-testid="hub-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result.locator('[data-testid="hub-result-banner"]')).toHaveAttribute("data-kind", "missed");
    await expect(result.locator('[data-testid="hub-review-item"]').filter({ hasText: MATCH_Q })).toContainText("Not quite");
    await expect(result.locator('[data-testid="hub-review-item"]').filter({ hasText: ORDER_Q })).toContainText("Not quite");
    await ctx.close();

    // The tutor's Results view: the child's arrangement AND the correct one, for each question.
    const tctx = await ctxFor(browser, "freelancer");
    const tp = await tctx.newPage();
    await openTutorHub(tp, /Quizzes/);
    await tp.getByRole("radio", { name: "Results" }).click();
    const line = tp.locator('[data-testid="hub-results"]').getByRole("button").filter({ hasText: childName }).filter({ hasText: quizB });
    await expect(line).toBeVisible({ timeout: 30_000 });
    await line.click();
    const detail = tp.locator('[data-testid="hub-result"]');
    await expect(detail).toBeVisible({ timeout: 30_000 });
    const tm = detail.locator('[data-testid="hub-review-item"]').filter({ hasText: MATCH_Q });
    await expect(tm).toContainText("Not quite");
    await expect(tm.locator('[data-testid="hub-answer-match"]')).toHaveCount(2); // yours, then the correct pairing
    await expect(tm).toContainText("Correct answer");
    await expect(tm.locator('[data-testid="hub-answer-match"]').last()).toContainText(pairText(PAIRS[0]));
    const to = detail.locator('[data-testid="hub-review-item"]').filter({ hasText: ORDER_Q });
    await expect(to.locator('[data-testid="hub-answer-order"]').last().locator("li").first()).toContainText(STEPS[0]);
    await tctx.close();
  });
});
