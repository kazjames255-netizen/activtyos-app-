import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub UX audit, round 2 (dev tool, screenshots only): mobile 390×844 + tablet 820×1180 of every tutor / parent tab, kid
// mode, quiz taking → results, flashcard review, roster detail, groups, live lobby, in-person capture grid and the lesson player
// (learn / words / warm-up / quiz / done + a slide deck with a picture). Shots land in docs/hub-review/ux-round4-shots/r2/.
// Run ONLY via scripts/e2e-locked.sh e2e/ux-r2-shots.spec.ts

const OUT = process.env.UX_OUT || path.join(ROOT, "docs/hub-review/ux-round4-shots/r2");
const HUB = "/api/learning-hub";
const stamp = Date.now().toString(36);
const subject = `UX Lab ${stamp}`;
const avaName = `Ava${stamp}`, benName = `Ben${stamp}`;
const MIXED = `Shapes check ${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "", avaId = "", benId = "", topicId = "", mixedId = "", slideNoteId = "";
let L: SeededLesson;

const VPS = { mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 } } as const;
type Vp = keyof typeof VPS;
const ONLY = (process.env.UX_VPS?.split(",") as Vp[] | undefined) ?? (Object.keys(VPS) as Vp[]);

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const envApi = (() => { try { return fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; } })();
const viaLocalApi = (url: string) => (envApi && envApi !== API_URL ? url.replace(new URL(envApi).origin, API_URL) : url);

async function ctxFor(browser: Browser, role: "freelancer" | "parent", vp: Vp): Promise<BrowserContext> {
  const ctx = await browser.newContext({ storageState: statePath(role), viewport: VPS[vp], deviceScaleFactor: 1, isMobile: vp === "mobile", hasTouch: true, reducedMotion: "reduce" });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = viaLocalApi(route.request().url());
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  if (role === "parent") {
    // A clean two-child family whatever else the shared parent account has accumulated.
    await ctx.route(/\/api\/learning-hub\/providers(\?|$)/, async (route) => {
      const res = await route.fetch({ url: viaLocalApi(route.request().url()) });
      const list = (await res.json()) as { tenantId: string; children?: { childId: string }[] }[];
      const kids = [avaId, benId];
      await route.fulfill({ response: res, json: list.map((p) => (p.tenantId === tenantId ? { ...p, children: (p.children ?? []).filter((c) => kids.includes(c.childId)).sort((a, b) => kids.indexOf(a.childId) - kids.indexOf(b.childId)) } : p)) });
    });
  }
  return ctx;
}

const shot = async (page: Page, name: string, full = false) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full }).catch(() => {});
  // Horizontal overflow is the #1 mobile defect; log it next to the shot.
  const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })).catch(() => null);
  if (over && over.sw > over.iw + 2) fs.appendFileSync(path.join(OUT, "overflow.log"), `${name}: scrollWidth ${over.sw} > ${over.iw}\n`);
};
/** Tap targets under 44px among visible buttons / links / inputs, logged per shot. */
const tapAudit = async (page: Page, name: string) => {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('#learning-hub button, #learning-hub a[href], #learning-hub input:not([type=hidden]), #learning-hub [role=tab], #learning-hub [role=radio], [role=dialog] button'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      if (r.height < 40 || r.width < 40) out.push(`${Math.round(r.width)}×${Math.round(r.height)} ${(el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().slice(0, 40)}`);
    }
    return out;
  }).catch(() => [] as string[]);
  if (small.length) fs.appendFileSync(path.join(OUT, "tap.log"), `${name}:\n  ${small.join("\n  ")}\n`);
};

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url, { waitUntil: "commit" }).catch(() => {});
    if (await heading.isVisible({ timeout: 40_000 }).catch(() => false)) return;
  }
  await expect(heading).toBeVisible({ timeout: 30_000 });
}
const tutorUrl = (tab: string, extra = "") => `/freelancer/learninghub?tab=${tab}${extra}`;
const parentUrl = (tab: string, extra = "") => `/custdash/learninghub?tab=${tab}&child=${avaId}${extra}`;
/** Wait until no skeleton is busy (best effort). */
const settled = async (page: Page) => { await page.locator("#learning-hub [aria-busy=true]").first().waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {}); };

/** Answer whatever the runner shows: first option, a typed answer, a number, or a sentence. */
async function answerCurrent(scope: Page | ReturnType<Page["locator"]>) {
  const radio = scope.getByRole("radio").first();
  if (await radio.isVisible().catch(() => false)) { await radio.click(); return; }
  const num = scope.locator('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]').first();
  if (await num.isVisible().catch(() => false)) { await num.fill("42"); return; }
  const text = scope.getByPlaceholder("Type your answer").first();
  if (await text.isVisible().catch(() => false)) { await text.fill("triangle"); return; }
  const area = scope.locator("textarea").first();
  if (await area.isVisible().catch(() => false)) { await area.fill("A shape with three straight sides and three corners."); return; }
}

test.beforeAll(async () => {
  test.setTimeout(400_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E UX Tuition ${stamp}`, price: 0 });
  avaId = await createParentChild(accounts.parent, { name: avaName });
  benId = await createParentChild(accounts.parent, { name: benName });
  for (const n of [avaName, benName]) await bookViaApi(accounts.parent, listing, { child: n, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  const p = await token(accounts.parent);
  await apiPost("/api/my/providers/follow", p, { tenantId }).catch(() => {});
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Shapes" });
  for (const c of [avaId, benId]) await apiPost(`${HUB}/students`, t, { childId: c, subjects: [subject] });
  topicId = (await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t)).find((x) => x.subject === subject)!.id;
  // A real picture (a triangle) for the picture question + a slide.
  const b64 = fs.readFileSync(path.join(process.env.UX_FIXTURES || "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/140c4a06-d595-4252-872f-8f0b25947538/scratchpad", "triangle.b64"), "utf8").trim();
  const pic = await apiPost<{ id: string }>("/api/uploads", t, { dataUrl: `data:image/png;base64,${b64}`, purpose: "private", kind: "hub" });
  const opts = ["Square", "Triangle", "Circle", "Hexagon"].map((text, i) => ({ id: `o${i}`, text }));
  const qs: string[] = [];
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "single", prompt: `Which shape is drawn here? (${stamp})`, options: opts, answer: "o1", marks: 1, explanation: "Three straight sides make a triangle.", image: { id: pic.id, alt: "An orange triangle on a pale blue background" } })).id);
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "short", prompt: `Name the three-sided shape (${stamp})`, answer: "triangle", marks: 1, explanation: "Tri means three." })).id);
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "number", prompt: `How many degrees are inside a triangle? (${stamp})`, answer: 180, tolerance: 0, marks: 1 })).id);
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "order", prompt: `Put these shapes in order of how many sides they have, fewest first (${stamp})`, items: ["Triangle", "Square", "Pentagon", "Hexagon"], marks: 1 })).id);
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "match", prompt: `Match each shape to its number of sides (${stamp})`, pairs: [{ term: "Triangle", definition: "3" }, { term: "Square", definition: "4" }, { term: "Pentagon", definition: "5" }], marks: 1 })).id);
  qs.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "written", prompt: `Explain what makes a shape a triangle (${stamp})`, marks: 4 })).id);
  mixedId = (await apiPost<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: MIXED, subject, topicIds: [topicId], questionIds: qs, timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" })).id;
  // Ben has one marked attempt so the roster / progress / results carry data.
  const st = await apiPost<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${mixedId}/attempts?tenantId=${tenantId}&childId=${benId}`, p, {});
  await apiPost(`${HUB}/attempts/${st.attemptId}/submit?tenantId=${tenantId}&childId=${benId}`, p, { answers: st.questions.map((q, i) => ({ questionId: q.id, response: i === 1 ? "triangle" : "o1" })) }).catch(() => {});
  // Flashcards, a group, a live lesson running now + one tomorrow, homework.
  const cards = [["triangle", "A shape with three straight sides"], ["square", "Four equal sides and four right angles"], ["vertex", "A corner where two sides meet"], ["parallel", "Lines that never meet, like train tracks"], ["perimeter", "The distance all the way round a shape"], ["acute angle", "An angle smaller than 90°"]];
  for (const [front, back] of cards) await apiPost(`${HUB}/flashcards`, t, { topicId, front, back, published: true });
  await apiPost(`${HUB}/groups`, t, { name: `Year 5 shapes ${stamp}`, colour: "teal", childIds: [avaId, benId] });
  await apiPost(`${HUB}/lessons`, t, { title: `Shapes live ${stamp}`, topicId, startsAt: new Date(Date.now() - 2 * 60_000).toISOString(), durationMins: 45, childIds: [avaId, benId] });
  await apiPost(`${HUB}/lessons`, t, { title: `Angles next ${stamp}`, topicId, startsAt: new Date(Date.now() + 26 * 3_600_000).toISOString(), durationMins: 45, childIds: [avaId] });
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: "neurone" });
  await apiPost(`${HUB}/homework`, t, { title: `Shapes homework ${stamp}`, instructions: "Do the shapes check, then look over your flashcards.", assessmentId: mixedId, assignedChildIds: [avaId, benId], dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
  // A slide-deck lesson with a picture and emoji art, plus the picture quiz as its exit quiz.
  const slideQuiz = (await apiPost<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: `Slides quiz ${stamp}`, subject, topicIds: [topicId], questionIds: [qs[0], qs[1]], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" })).id;
  slideNoteId = (await apiPost<{ id: string }>(`${HUB}/notes`, t, {
    topicId, title: `Triangles ${stamp}`, body: "**I can name the three kinds of triangle.**", published: true,
    lesson: {
      v: 1, subject: "Maths", keyStage: "Key Stage 2", year: "5", unit: "Shapes", outcome: "I can name the three kinds of triangle.",
      steps: [], outline: [], keywords: [{ keyword: "equilateral", description: "All three sides the same length." }, { keyword: "isosceles", description: "Two sides the same length." }],
      misconceptions: [], teacherTips: [], warmupQuestionIds: [qs[1]], quizId: slideQuiz, widget: null,
      slides: [
        { kind: "intro", title: "Triangles", art: ["📐"], blocks: [{ t: "lead", text: "A **triangle** has three straight sides and three corners." }, { t: "chips", items: ["3 sides", "3 corners", "180° inside"] }] },
        { kind: "explain", title: "Three kinds of triangle", image: { id: pic.id, alt: "An orange triangle on a pale blue background" }, blocks: [{ t: "define", items: [{ term: "Equilateral", def: "All three sides the same length." }, { term: "Isosceles", def: "Two sides the same length." }, { term: "Scalene", def: "No sides the same length." }] }, { t: "callout", text: "Tap each word to see what it means." }] },
        { kind: "practice", title: "Sort the shapes", blocks: [{ t: "sort", q: "Is it a triangle?", columns: ["Triangle", "Not a triangle"], items: [{ text: "3 sides, 3 corners", col: 0 }, { text: "4 equal sides", col: 1 }, { text: "A slice of pizza", col: 0 }] }] },
        { kind: "check", title: "Quick check", blocks: [{ t: "choice", q: "How many corners does a triangle have?", options: ["2", "3", "4"], answer: 1, why: "Tri means three." }] },
        { kind: "summary", title: "What we learned", blocks: [{ t: "list", items: ["A triangle has three sides.", "Equilateral, isosceles and scalene are the three kinds.", "The angles inside add up to 180°."] }] },
      ],
    },
  })).id;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

const TUTOR_TABS = ["home", "live", "students", "dashboard", "diagnostic", "quizzes", "homework", "notes", "flashcards"];
const PARENT_TABS = ["home", "live", "dashboard", "diagnostic", "quizzes", "homework", "notes", "flashcards"];

for (const vp of ONLY) {
  test.describe(`${vp}`, () => {
    test(`tutor tabs (${vp})`, async ({ browser }) => {
      test.setTimeout(900_000);
      const ctx = await ctxFor(browser, "freelancer", vp);
      const page = await ctx.newPage();
      for (const tab of TUTOR_TABS) {
        await gotoHub(page, tutorUrl(tab));
        await settled(page);
        await shot(page, `tutor-${vp}-${tab}`);
        await tapAudit(page, `tutor-${vp}-${tab}`);
        await shot(page, `tutor-${vp}-${tab}-full`, true);
      }
      await ctx.close();
    });

    test(`parent tabs (${vp})`, async ({ browser }) => {
      test.setTimeout(900_000);
      const ctx = await ctxFor(browser, "parent", vp);
      const page = await ctx.newPage();
      await dismissParentWelcome(page);
      for (const tab of PARENT_TABS) {
        await gotoHub(page, parentUrl(tab));
        await settled(page);
        await shot(page, `parent-${vp}-${tab}`);
        await tapAudit(page, `parent-${vp}-${tab}`);
        await shot(page, `parent-${vp}-${tab}-full`, true);
      }
      await ctx.close();
    });

    test(`kid mode (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "parent", vp);
      const page = await ctx.newPage();
      await dismissParentWelcome(page);
      await gotoHub(page, parentUrl("home"));
      await settled(page);
      const toggle = page.getByTestId("hub-hand-over-toggle");
      if (await toggle.isVisible({ timeout: 5_000 }).catch(() => false)) { await toggle.click(); await shot(page, `kid-${vp}-handover-list`); }
      await page.locator(`[data-testid="hub-hand-over"][data-child-id="${avaId}"]`).click();
      await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1", { timeout: 20_000 });
      await settled(page);
      await shot(page, `kid-${vp}-home`); await tapAudit(page, `kid-${vp}-home`);
      await shot(page, `kid-${vp}-home-full`, true);
      for (const t of [/^Lessons/, /^Quizzes/, /Starting quiz/, /^Homework/, /^Flashcards/]) {
        const tab = page.getByRole("tab", { name: t });
        if (!(await tab.isVisible().catch(() => false))) continue;
        await tab.click(); await settled(page);
        const key = String(t).replace(/[^a-z]/gi, "").toLowerCase();
        await shot(page, `kid-${vp}-${key}`); await tapAudit(page, `kid-${vp}-${key}`);
      }
      await page.getByTestId("kid-exit").click();
      await shot(page, `kid-${vp}-gate`); await tapAudit(page, `kid-${vp}-gate`);
      await page.locator("#kid-gate-answer").fill("1");
      await page.getByTestId("kid-gate-unlock").click();
      await shot(page, `kid-${vp}-gate-wrong`);
      await ctx.close();
    });

    test(`quiz taking → results → review (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "parent", vp);
      const page = await ctx.newPage();
      await dismissParentWelcome(page);
      await gotoHub(page, parentUrl("quizzes"));
      await settled(page);
      const card = cardWith(page, MIXED);
      await expect(card).toBeVisible({ timeout: 40_000 });
      await card.getByTestId("hub-open-assessment").click();
      await shot(page, `quiz-${vp}-intro`); await tapAudit(page, `quiz-${vp}-intro`);
      const who = page.getByTestId("hub-who-kid").filter({ hasText: avaName });
      if (await who.isVisible({ timeout: 3_000 }).catch(() => false)) await who.click();
      await expect(page.getByTestId("hub-start")).toBeEnabled({ timeout: 20_000 });
      await page.getByTestId("hub-start").click();
      const runner = page.getByTestId("hub-runner");
      await expect(runner).toBeVisible({ timeout: 40_000 });
      for (let i = 0; i < 8; i++) {
        await shot(page, `quiz-${vp}-q${i + 1}-blank`);
        await answerCurrent(runner);
        await shot(page, `quiz-${vp}-q${i + 1}`); await tapAudit(page, `quiz-${vp}-q${i + 1}`);
        if (i === 0) await shot(page, `quiz-${vp}-q1-full`, true);
        const next = runner.getByTestId("hub-next");
        if (await next.isVisible().catch(() => false)) { await next.click(); continue; }
        break;
      }
      await runner.getByTestId("hub-review").click();
      await shot(page, `quiz-${vp}-review`); await tapAudit(page, `quiz-${vp}-review`);
      await shot(page, `quiz-${vp}-review-full`, true);
      await page.getByTestId("hub-handin").click();
      await shot(page, `quiz-${vp}-confirm`);
      await page.getByTestId("hub-confirm-submit").click();
      await expect(page.getByTestId("hub-result")).toBeVisible({ timeout: 40_000 });
      await shot(page, `quiz-${vp}-result`); await tapAudit(page, `quiz-${vp}-result`);
      await shot(page, `quiz-${vp}-result-full`, true);
      const item = page.getByTestId("hub-review-item").first();
      if (await item.isVisible().catch(() => false)) { await item.scrollIntoViewIfNeeded(); await shot(page, `quiz-${vp}-result-items`); }
      await ctx.close();
    });

    test(`flashcard review (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "parent", vp);
      const page = await ctx.newPage();
      await dismissParentWelcome(page);
      await gotoHub(page, parentUrl("flashcards"));
      await settled(page);
      await shot(page, `fc-${vp}-start`); await tapAudit(page, `fc-${vp}-start`);
      const start = page.locator("#hub-fc-start");
      await expect(start).toBeVisible({ timeout: 40_000 });
      await start.click();
      const session = page.getByTestId("hub-fc-session");
      await expect(session).toBeVisible({ timeout: 20_000 });
      await shot(page, `fc-${vp}-card-front`); await tapAudit(page, `fc-${vp}-card-front`);
      await page.getByTestId("hub-flashcard").getByRole("button").first().click();
      await shot(page, `fc-${vp}-card-back`); await tapAudit(page, `fc-${vp}-card-back`);
      const rate = page.getByRole("group", { name: "How well did you know it?" });
      for (let i = 0; i < 8; i++) {
        const btns = rate.getByRole("button");
        if (!(await btns.first().isVisible().catch(() => false))) break;
        await btns.nth(i % 4).click();
        if (await page.getByTestId("hub-fc-summary").isVisible({ timeout: 1_500 }).catch(() => false)) break;
        const flip = page.getByTestId("hub-flashcard").getByRole("button").first();
        if (await flip.isVisible().catch(() => false)) await flip.click();
      }
      await shot(page, `fc-${vp}-summary`); await tapAudit(page, `fc-${vp}-summary`);
      await ctx.close();
    });

    test(`roster detail + groups (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "freelancer", vp);
      const page = await ctx.newPage();
      await gotoHub(page, tutorUrl("students"));
      await settled(page);
      const groups = page.locator("#hub-groups");
      await groups.scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, `roster-${vp}-groups`); await tapAudit(page, `roster-${vp}-groups`);
      const gcard = page.locator(`[data-group-card="Year 5 shapes ${stamp}"]`);
      if (await gcard.isVisible().catch(() => false)) {
        const edit = gcard.getByRole("button", { name: /Edit|Rename|Members/ }).first();
        if (await edit.isVisible().catch(() => false)) { await edit.click(); await shot(page, `roster-${vp}-group-edit`); await tapAudit(page, `roster-${vp}-group-edit`); await page.keyboard.press("Escape"); }
      }
      await page.locator("#hub-new-group").click();
      await shot(page, `roster-${vp}-group-new`); await tapAudit(page, `roster-${vp}-group-new`);
      await page.keyboard.press("Escape");
      const row = cardWith(page, benName);
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, `roster-${vp}-row`);
      await row.getByTestId("hub-student-progress").click();
      await settled(page);
      await shot(page, `roster-${vp}-student-progress`); await tapAudit(page, `roster-${vp}-student-progress`);
      await shot(page, `roster-${vp}-student-progress-full`, true);
      await ctx.close();
    });

    test(`live lobby (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      for (const role of ["freelancer", "parent"] as const) {
        const ctx = await ctxFor(browser, role, vp);
        const page = await ctx.newPage();
        if (role === "parent") await dismissParentWelcome(page);
        await gotoHub(page, role === "parent" ? parentUrl("live") : tutorUrl("live"));
        await settled(page);
        const hero = page.locator("#hub-next-lesson");
        await expect(hero).toBeVisible({ timeout: 40_000 });
        await shot(page, `live-${vp}-${role}-panel`); await tapAudit(page, `live-${vp}-${role}-panel`);
        const join = hero.getByRole("button", { name: /Join|Rejoin|Get ready|Open/ }).first();
        if (await join.isVisible().catch(() => false) && (await join.isEnabled())) {
          await join.click();
          const lobby = page.locator("#hub-lobby");
          if (await lobby.isVisible({ timeout: 20_000 }).catch(() => false)) {
            await page.waitForTimeout(2_500);
            await shot(page, `live-${vp}-${role}-lobby`); await tapAudit(page, `live-${vp}-${role}-lobby`);
            await shot(page, `live-${vp}-${role}-lobby-full`, true);
          } else await shot(page, `live-${vp}-${role}-after-join`);
        }
        await ctx.close();
      }
    });

    test(`in-person capture grid (${vp})`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "freelancer", vp);
      const page = await ctx.newPage();
      await gotoHub(page, tutorUrl("notes"));
      await settled(page);
      await page.getByLabel("Search lessons").fill(L.title);
      await page.getByRole("button", { name: L.title, exact: true }).first().click({ timeout: 40_000 });
      await settled(page);
      await shot(page, `lesson-${vp}-tutor-reader`); await tapAudit(page, `lesson-${vp}-tutor-reader`);
      await shot(page, `lesson-${vp}-tutor-reader-full`, true);
      await page.getByTestId("lesson-open").click();
      await expect(page.getByTestId("lesson-one-room")).toBeVisible({ timeout: 40_000 });
      await page.getByTestId("lesson-one-room").click();
      await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 40_000 });
      await shot(page, `ip-${vp}-setup`); await tapAudit(page, `ip-${vp}-setup`);
      await page.getByRole("button", { name: avaName, exact: true }).click();
      await page.getByRole("button", { name: benName, exact: true }).click();
      await shot(page, `ip-${vp}-setup-picked`);
      await page.getByTestId("golive-start").click();
      await expect(page.getByTestId("inperson-run")).toBeVisible({ timeout: 40_000 });
      await shot(page, `ip-${vp}-run-start`); await tapAudit(page, `ip-${vp}-run-start`);
      await page.getByTestId("ip-who-btn").click().catch(() => {});
      await shot(page, `ip-${vp}-who`); await page.keyboard.press("Escape").catch(() => {});
      await page.getByTestId("preview-jump-warm").click({ force: true });
      await expect(page.getByTestId("ip-warm-extra")).toBeVisible({ timeout: 20_000 });
      await shot(page, `ip-${vp}-warmup`); await tapAudit(page, `ip-${vp}-warmup`);
      await page.getByTestId("ip-warm-reveal").click();
      await shot(page, `ip-${vp}-warmup-revealed`);
      await page.getByTestId("preview-jump-quiz").click({ force: true });
      await expect(page.getByTestId("ip-answered")).toBeVisible({ timeout: 20_000 });
      await shot(page, `ip-${vp}-grid`); await tapAudit(page, `ip-${vp}-grid`);
      await shot(page, `ip-${vp}-grid-full`, true);
      // Answer the first question for both, next, then the tutor's-call kind.
      const q = L.quiz[0];
      const optA = page.getByRole("button", { name: new RegExp(`${avaName}: option [A-J], `) }).first();
      if (await optA.isVisible().catch(() => false)) await optA.click();
      await shot(page, `ip-${vp}-grid-answered`);
      await page.getByTestId("ip-show-answer").click().catch(() => {});
      await shot(page, `ip-${vp}-grid-key`);
      void q;
      await page.getByTestId("ip-mark-class").click();
      await shot(page, `ip-${vp}-mark-confirm`); await tapAudit(page, `ip-${vp}-mark-confirm`);
      await page.getByTestId("ip-confirm-mark").click();
      await expect(page.getByTestId("ip-results")).toBeVisible({ timeout: 40_000 });
      await shot(page, `ip-${vp}-results`); await tapAudit(page, `ip-${vp}-results`);
      await shot(page, `ip-${vp}-results-full`, true);
      await ctx.close();
    });

    test(`lesson player (${vp})`, async ({ browser }) => {
      test.setTimeout(900_000);
      const ctx = await ctxFor(browser, "parent", vp);
      const page = await ctx.newPage();
      await dismissParentWelcome(page);
      // 1) the Oak-shaped lesson: start → learn → words → warm → quiz → done
      await gotoHub(page, parentUrl("notes", `&open=lesson:${L.noteId}`));
      const player = page.getByTestId("lesson-player");
      await expect(player).toBeVisible({ timeout: 40_000 });
      await shot(page, `player-${vp}-start`); await tapAudit(page, `player-${vp}-start`);
      await shot(page, `player-${vp}-start-full`, true);
      await expect(page.getByTestId("lesson-start")).toBeEnabled({ timeout: 40_000 });
      await page.getByTestId("lesson-start").click();
      let seen = new Map<string, number>();
      for (let i = 0; i < 40; i++) {
        const step = (await player.getAttribute("data-step")) ?? "?";
        const n = (seen.get(step) ?? 0) + 1; seen.set(step, n);
        if (n <= 4) { await shot(page, `player-${vp}-${step}-${n}`); await tapAudit(page, `player-${vp}-${step}-${n}`); }
        if (step === "done") { await shot(page, `player-${vp}-done-full`, true); break; }
        if (step === "words") { const all = page.getByRole("button", { name: "Show me all" }); if (await all.isVisible().catch(() => false)) { await all.click(); await shot(page, `player-${vp}-words-all`); } }
        if (step === "warm") {
          await answerCurrent(player);
          const check = page.getByTestId("lesson-check");
          if (await check.isVisible().catch(() => false) && (await check.isEnabled())) { await check.click(); await page.waitForTimeout(800); await shot(page, `player-${vp}-warm-${n}-checked`); }
          else { const skip = page.getByTestId("lesson-skip"); if (await skip.isVisible().catch(() => false)) { await skip.click(); continue; } }
        }
        if (step === "quiz") {
          await answerCurrent(player);
          const fin = page.getByTestId("lesson-finish");
          if (await fin.isVisible().catch(() => false)) { await fin.click(); await page.getByTestId("lesson-finish").click({ timeout: 3_000 }).catch(() => {}); await page.waitForTimeout(1_500); continue; }
        }
        const next = page.getByTestId("lesson-next");
        if (await next.isVisible().catch(() => false) && (await next.isEnabled())) { await next.click(); await page.waitForTimeout(500); continue; }
        break;
      }
      // 2) the slide-deck lesson with a picture
      await gotoHub(page, parentUrl("notes", `&open=lesson:${slideNoteId}`));
      await expect(player).toBeVisible({ timeout: 40_000 });
      await expect(page.getByTestId("lesson-start")).toBeEnabled({ timeout: 40_000 });
      await shot(page, `slides-${vp}-start`);
      await page.getByTestId("lesson-start").click();
      seen = new Map();
      for (let i = 0; i < 30; i++) {
        const step = (await player.getAttribute("data-step")) ?? "?";
        const n = (seen.get(step) ?? 0) + 1; seen.set(step, n);
        const slide = page.getByTestId("slide");
        const idx = step === "slides" ? await slide.getAttribute("data-slide").catch(() => null) : null;
        const name = idx !== null ? `slides-${vp}-slide-${Number(idx) + 1}` : `slides-${vp}-${step}-${n}`;
        if (n <= 8) { await shot(page, name); await tapAudit(page, name); if (idx !== null) await shot(page, `${name}-full`, true); }
        if (step === "done") break;
        if (step === "warm") {
          await answerCurrent(player);
          const check = page.getByTestId("lesson-check");
          if (await check.isVisible().catch(() => false) && (await check.isEnabled())) { await check.click(); await page.waitForTimeout(800); }
          else { const skip = page.getByTestId("lesson-skip"); if (await skip.isVisible().catch(() => false)) { await skip.click(); continue; } }
        }
        if (step === "quiz") {
          await answerCurrent(player);
          await shot(page, `slides-${vp}-quiz-picture-${n}`);
          const fin = page.getByTestId("lesson-finish");
          if (await fin.isVisible().catch(() => false)) { await fin.click(); await page.getByTestId("lesson-finish").click({ timeout: 3_000 }).catch(() => {}); await page.waitForTimeout(1_500); continue; }
        }
        const next = page.getByTestId("lesson-next");
        if (await next.isVisible().catch(() => false) && (await next.isEnabled())) { await next.click(); await page.waitForTimeout(500); continue; }
        break;
      }
      await ctx.close();
    });
  });
}
