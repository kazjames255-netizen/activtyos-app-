import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed } from "./helpers/tenantData";
import { seedOakLesson, type SeedQ, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — the COMPLETE journey of one Oak-style lesson, as every hat, on a fixture (helpers/lessonFixture.ts) so it
// never depends on staging content:
//  1. Tutor: finds the lesson (search + subject sidebar), previews it, edits a slide's text, changes its picture (upload → library
//     pick → remove → upload again), sets it for a child as homework, attaches it to a live lesson.
//  2. Parent: sees the homework and can start the lesson for the child.
//  3. Child (kid mode): Start → Warm-up (a picture question with picture options — the pictures really render) → Lesson slides
//     (the tutor's uploaded picture is shown) → Quiz (incl. a written answer) → Done; XP / streak move; the "once" retake rule.
//  4. Tutor: marks the written answer from the queue; the Progress overview updates over SSE without a reload; the homework
//     inbox shows the hand-in.
//  5. Flashcards made from the lesson's key words: a review session, spaced repetition scheduled server-side.
// Every state assertion is anchored to THIS run's lesson / quiz / child (run-unique titles, the child's id).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Oak Lab ${stamp}`;
const childName = `Oakkid ${stamp}`;
const PIC_Q = `Which picture shows a neurone? (${stamp})`;
const PIC_ALT = `A tiny dot standing in for a neurone (${stamp})`;
const WRITTEN_Q = `In your own words, what does a synapse do? (${stamp})`;
const SLIDE_TITLE = `Neurones carry messages ${stamp}`;
const SLIDE_TITLE_EDITED = `Neurones carry electrical messages ${stamp}`;
const SLIDE_PIC_ALT = `A tutor's own picture of a neurone (${stamp})`;
const LIVE_TITLE = `Oak live ${stamp}`;
const FEEDBACK = `Lovely explanation ${stamp}`;
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pngDataUrl = `data:image/png;base64,${PNG_B64}`;

let accounts: AccountManifest["accounts"];
let childId = "";
let tenantId = "";
let topicId = "";
let L: SeededLesson;
let picQ: SeedQ;
let writtenQ: SeedQ;
let liveId = "";
let hwId = "";
let cardIds: string[] = [];

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
const setHub = (op: TestAccount, on: boolean) => retry(async () => {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
});
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });
const HUB = "/api/learning-hub";

/** The dev API restarts (tsx watch) whenever a server file is saved: retry a dropped connection instead of failing the test. */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 16 || !/fetch failed|ECONNRESET|socket|other side closed/i.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 5_000)); }
  }
}

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
const viaLocalApi = (url: string) => (envApi && envApi !== API_URL ? url.replace(new URL(envApi).origin, API_URL) : url);
async function ctxFor(browser: Browser, role: "freelancer" | "parent", extra: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext({ storageState: statePath(role), ...extra });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = viaLocalApi(route.request().url());
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  if (role === "parent") {
    // The shared parent account has children from every other spec: narrow the family to THIS run's child (API untouched).
    await ctx.route(/\/api\/learning-hub\/providers(\?|$)/, async (route) => {
      const res = await route.fetch({ url: viaLocalApi(route.request().url()) });
      const list = (await res.json()) as { tenantId: string; children?: { childId: string }[] }[];
      await route.fulfill({ response: res, json: list.map((p) => (p.tenantId === tenantId ? { ...p, children: (p.children ?? []).filter((c) => c.childId === childId) } : p)) });
    });
  }
  return ctx;
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  childId = await createParentChild(accounts.parent, { name: childName });
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Coordination and control" });
  await apiPost(`${HUB}/students`, t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string; topic: string }[]>(`${HUB}/topics`, t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await setHub(accounts.freelancer, true);
  // Pictures on a warm-up question: the question's own picture + two picture options (the same private hub upload path a tutor uses).
  const up = async () => (await apiPost<{ id: string }>("/api/uploads", t, { dataUrl: pngDataUrl, purpose: "private", kind: "hub" })).id;
  const [qPic, oPic1, oPic2] = [await up(), await up(), await up()];
  L = await seedOakLesson(t, {
    stamp, subject, topicId, widget: null, retakePolicy: "once",
    extraWarmup: [{
      body: { kind: "single", prompt: PIC_Q, image: { id: qPic, alt: PIC_ALT }, options: [{ id: "a", text: "Neurone", image: { id: oPic1 } }, { id: "b", text: "Heart", image: { id: oPic2 } }], answer: "a", marks: 1, explanation: "A neurone is a nerve cell." },
      meta: { kind: "single", prompt: PIC_Q, explanation: "A neurone is a nerve cell.", right: "Neurone", wrong: "Heart" },
    }],
    extraQuiz: [{ body: { kind: "written", prompt: WRITTEN_Q, marks: 2 }, meta: { kind: "written", prompt: WRITTEN_Q, explanation: "", right: `It passes the message across the gap ${stamp}`, wrong: "" } }],
    slides: [
      { kind: "intro", title: SLIDE_TITLE, blocks: [{ t: "lead", text: "A {neurone} is a nerve cell that carries electrical impulses." }, { t: "list", items: ["The axon carries the impulse", "Myelin speeds it up"] }] },
      { kind: "check", title: `Quick check ${stamp}`, blocks: [{ t: "choice", q: "What covers an axon to speed the impulse up?", options: ["Myelin", "Bone"], answer: 0, why: "Myelin is a fatty sheath." }] },
    ],
  });
  picQ = L.warmup[0];
  writtenQ = L.quiz[0];
  // "Flashcards from the lesson": one card per key word, published, filed under the lesson's topic.
  cardIds = [];
  for (const k of L.keywords) cardIds.push((await apiPost<{ id: string }>(`${HUB}/flashcards`, t, { topicId, front: `${k.keyword} (${stamp})`, back: k.description, published: true })).id);
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openTutorTab(page: Page, tab: RegExp) {
  await gotoHub(page, "/freelancer/learninghub");
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}
async function openParentHub(page: Page, tab: RegExp) {
  await dismissParentWelcome(page);
  await gotoHub(page, `/custdash/learninghub?child=${childId}`);
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(tenantId);
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}
async function searchLesson(page: Page, title: string) {
  await page.getByLabel("Search lessons").fill(title);
  const card = cardWith(page, title);
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

// ── driving the question UIs ──────────────────────────────────────────────────────────────────────────────────────
const player = (page: Page) => page.getByTestId("lesson-player");
async function answer(page: Page, q: SeedQ, how: "right" | "wrong") {
  const root = player(page);
  await expect(
    q.kind === "match" ? root.getByTestId("hub-match-term").first()
    : q.kind === "order" ? root.getByTestId("hub-order-item").first()
    : q.kind === "short" ? root.getByPlaceholder("Type your answer")
    : q.kind === "written" ? root.getByPlaceholder(/Write your answer here/)
    : root.getByText(q.right, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  if (q.kind === "single") {
    await root.getByText(how === "right" ? q.right : q.wrong, { exact: true }).click();
  } else if (q.kind === "short") {
    await root.getByPlaceholder("Type your answer").fill(how === "right" ? q.right : q.wrong);
  } else if (q.kind === "written") {
    await root.getByPlaceholder(/Write your answer here/).fill(q.right);
  } else if (q.kind === "order") {
    if (how === "right") {
      const want = q.items!;
      for (let target = 0; target < want.length; target++) {
        for (let guard = 0; guard < 12; guard++) {
          const texts = (await root.getByTestId("hub-order-item").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim());
          const at = texts.findIndex((s) => s.includes(want[target]));
          if (at <= target) break;
          await root.getByRole("button", { name: `Move ${want[target]} up` }).click();
        }
      }
    }
    await root.getByTestId("hub-order-keep").click();
  } else if (q.kind === "match") {
    const terms = (await root.getByTestId("hub-match-term").allInnerTexts()).map((s) => s.trim());
    const defOf = terms.map((t) => q.pairs!.find((p) => p.term === t)!.definition);
    const put = how === "right" ? defOf : defOf.map((d, i) => (i === 0 ? defOf[1] : i === 1 ? defOf[0] : d));
    for (let i = 0; i < terms.length; i++) {
      const exact = new RegExp(`^\\s*${put[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
      await root.getByTestId("hub-match-tile").filter({ hasText: exact }).first().click();
      await root.locator(`[data-match-slot="${i}"]`).click();
    }
  }
}
const xpOf = async (page: Page) => Number(((await page.getByTestId("lesson-xp").innerText()).match(/\d+/) ?? ["0"])[0]);
const streakOf = async (page: Page) => Number(((await page.getByTestId("lesson-streak").innerText()).match(/\d+/) ?? ["0"])[0]);
const stepIs = (page: Page, s: string) => expect(player(page)).toHaveAttribute("data-step", s, { timeout: 20_000 });
/** Every <img> under `root` has really loaded (a broken picture has naturalWidth 0). */
async function picturesLoaded(page: Page, selector: string, atLeast: number) {
  await expect.poll(async () => page.evaluate((sel) => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>(`${sel} img`)];
    return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : 0;
  }, selector), { timeout: 20_000 }).toBeGreaterThanOrEqual(atLeast);
}

type NoteLesson = { lesson?: { slides?: { title: string; image?: { id: string; alt: string; url?: string }; pics?: { id: string }[]; artLock?: boolean }[] } };
const tutorNote = () => retry(async () => apiFetch<NoteLesson>(`${HUB}/notes/${L.noteId}`, await token(accounts.freelancer)));
interface HwRow { id: string; title: string; noteIds: string[]; assessmentId: string | null; assignedChildIds: string[] }
const tutorHomework = (title: string) => retry(async () => (await apiFetch<HwRow[]>(`${HUB}/homework`, await token(accounts.freelancer))).find((h) => h.title === title));
interface AttemptRow { id: string; assessmentId: string; status: string; homeworkId: string | null; scoreMarks: number; maxMarks: number; writtenPending?: number }
const childAttempts = async () => retry(async () => (await apiFetch<AttemptRow[]>(`${HUB}/attempts?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent))).filter((a) => a.assessmentId === L.quizId));

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe("1. tutor: find, preview, edit a slide, change its picture", () => {
  test("search + subject sidebar find the lesson; the reader shows it as an interactive slide lesson", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorTab(page, /^Lessons/);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    // Search by title (server-side).
    const card = await searchLesson(page, L.title);
    await expect(card).toContainText("Interactive");
    // …and by subject in the sidebar (Oak lessons file under subject › unit): picking THIS run's subject keeps the lesson listed.
    await page.getByLabel("Search lessons").fill("");
    const subjectBtn = page.getByRole("button", { name: new RegExp(`^${subject}\\b`) }).first();
    await expect(subjectBtn).toBeVisible({ timeout: 20_000 });
    await subjectBtn.click();
    await expect(subjectBtn).toHaveAttribute("aria-current", "true");
    await expect(cardWith(page, L.title)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("region", { name: /Coordination and control/ }).first()).toBeVisible();
    // Open it: the tutor panel describes what students get.
    await cardWith(page, L.title).getByRole("button", { name: L.title, exact: true }).click();
    const panel = page.getByTestId("lesson-tutor-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toContainText("2 interactive slides");
    await expect(panel).toContainText(`${L.warmup.length} warm-up questions`);
    await expect(panel).toContainText("exit quiz");
    await expect(page.getByTestId("lesson-set-for-children")).toHaveCount(1);
    await ctx.close();
  });

  test("Preview: edit a slide's text; Change picture: upload → library → remove → upload (each saved and shown)", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer", { reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await openTutorTab(page, /^Lessons/);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    const card = await searchLesson(page, L.title);
    await card.getByRole("button", { name: L.title, exact: true }).click();
    await page.getByTestId("lesson-preview").click();
    await expect(page.getByText(/Preview — this is what students see/)).toBeVisible();
    await page.getByTestId("preview-jump-slides").click();
    await stepIs(page, "slides");
    const slide = page.getByTestId("slide");
    await expect(slide).toContainText(SLIDE_TITLE);
    await expect(page.getByTestId("slide-art")).toHaveCount(0); // no picture yet → no empty panel

    // Edit text: the title field is the first one; the right answers of the check slide are never offered as fields.
    await page.getByTestId("slide-edit").click();
    const ed = page.getByRole("dialog", { name: "Edit this slide" });
    await expect(ed).toBeVisible();
    await ed.getByLabel(/Slide · Title/).fill(SLIDE_TITLE_EDITED);
    let saved = page.waitForResponse((r) => r.url().includes(`/notes/${L.noteId}`) && r.request().method() === "PATCH");
    await ed.getByTestId("slide-edit-save").click();
    expect((await saved).status()).toBe(200);
    await expect(ed).toHaveCount(0);
    await expect(page.getByTestId("slide")).toContainText(SLIDE_TITLE_EDITED);
    expect((await tutorNote()).lesson?.slides?.[0].title).toBe(SLIDE_TITLE_EDITED);

    // Change picture (1): add the tutor's own picture — alt text is mandatory.
    await expect(page.getByTestId("slide-picture")).toContainText("Add picture");
    await page.getByTestId("slide-picture").click();
    const dlg = page.locator("#slide-picture");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("No picture");
    await dlg.getByTestId("slide-picture-upload").click();
    await dlg.getByTestId("hub-image-input").setInputFiles({ name: "neurone.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
    await expect(dlg.getByTestId("hub-image-alt")).toBeVisible({ timeout: 30_000 }); // uploaded → the alt field appears
    await dlg.getByTestId("slide-picture-save-upload").click();
    await expect(dlg.getByRole("alert")).toContainText(/Describe the picture/); // refused without alt text
    await dlg.getByTestId("hub-image-alt").fill(SLIDE_PIC_ALT);
    saved = page.waitForResponse((r) => r.url().includes(`/notes/${L.noteId}`) && r.request().method() === "PATCH");
    await dlg.getByTestId("slide-picture-save-upload").click();
    expect((await saved).status()).toBe(200);
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId("slide-image")).toBeVisible({ timeout: 20_000 });
    await picturesLoaded(page, '[data-testid="slide-image"]', 1);
    await expect(page.getByTestId("slide-image").getByRole("img")).toHaveAttribute("alt", SLIDE_PIC_ALT);
    let n = await tutorNote();
    expect(n.lesson?.slides?.[0].image?.alt).toBe(SLIDE_PIC_ALT);
    expect(n.lesson?.slides?.[0].image?.url).toMatch(/\/api\/images\/.+sig=/); // a signed link, never a bare id
    expect(n.lesson?.slides?.[0].artLock).toBe(true);
    const uploadedId = n.lesson!.slides![0].image!.id;

    // Change picture (2): replace it from the verified library.
    await expect(page.getByTestId("slide-picture")).toContainText("Change picture");
    await page.getByTestId("slide-picture").click();
    await expect(dlg).toContainText(`Your picture: “${SLIDE_PIC_ALT}”`);
    await dlg.getByTestId("slide-picture-library").click();
    await dlg.getByTestId("slide-picture-search").fill("cell");
    const libPic = dlg.getByTestId("slide-picture-lib-pic").first();
    await expect(libPic).toBeVisible({ timeout: 20_000 });
    const libId = await libPic.getAttribute("data-pic");
    await libPic.click();
    await expect(libPic).toHaveAttribute("aria-pressed", "true");
    saved = page.waitForResponse((r) => r.url().includes(`/notes/${L.noteId}`) && r.request().method() === "PATCH");
    await dlg.getByTestId("slide-picture-save-library").click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(`[data-testid="slide-pic"][data-pic="${libId}"]`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("slide-image")).toHaveCount(0);
    n = await tutorNote();
    expect(n.lesson?.slides?.[0].pics).toEqual([{ id: libId }]);
    expect(n.lesson?.slides?.[0].image).toBeUndefined();

    // Change picture (3): remove it.
    await page.getByTestId("slide-picture").click();
    await expect(dlg).toContainText("A library picture");
    await dlg.getByTestId("slide-picture-remove").click();
    await expect(dlg).toContainText("will be removed when you save");
    saved = page.waitForResponse((r) => r.url().includes(`/notes/${L.noteId}`) && r.request().method() === "PATCH");
    await dlg.getByTestId("slide-picture-save").click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId("slide-art")).toHaveCount(0);
    n = await tutorNote();
    expect(n.lesson?.slides?.[0].pics).toBeUndefined();
    expect(n.lesson?.slides?.[0].artLock).toBe(true);

    // Change picture (4): upload again so the student test sees a tutor picture on the slide.
    await page.getByTestId("slide-picture").click();
    await dlg.getByTestId("slide-picture-upload").click();
    await dlg.getByTestId("hub-image-input").setInputFiles({ name: "neurone2.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
    await expect(dlg.getByTestId("hub-image-alt")).toBeVisible({ timeout: 30_000 });
    await dlg.getByTestId("hub-image-alt").fill(SLIDE_PIC_ALT);
    saved = page.waitForResponse((r) => r.url().includes(`/notes/${L.noteId}`) && r.request().method() === "PATCH");
    await dlg.getByTestId("slide-picture-save-upload").click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId("slide-image")).toBeVisible({ timeout: 20_000 });
    n = await tutorNote();
    expect(n.lesson?.slides?.[0].image?.id).toBeTruthy();
    expect(n.lesson?.slides?.[0].image?.id).not.toBe(uploadedId); // a fresh upload, not the removed one
    // The second slide (the check) was never touched by any of this.
    expect(n.lesson?.slides?.[1].title).toBe(`Quick check ${stamp}`);
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(page.getByTestId("lesson-tutor-panel")).toBeVisible();
    await ctx.close();
  });

  test("API: a lesson can't borrow another file as a slide picture on create / edit (the same checks as PATCH)", async () => {
    const t = await token(accounts.freelancer);
    const raw = async (method: string, p: string, body: unknown) => fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
    // A private upload of another KIND (not a hub picture) — the kind of file the hub must never sign for families.
    const other = await apiPost<{ id: string }>("/api/uploads", t, { dataUrl: pngDataUrl, purpose: "private" });
    const bad = { topicId, title: `Borrowed picture ${stamp}`, body: "", published: false, lesson: { steps: ["x"], slides: [{ kind: "explain", title: "s", blocks: [{ t: "text", text: "t" }], image: { id: other.id, alt: "borrowed" } }] } };
    expect((await raw("POST", `${HUB}/notes`, bad)).status).toBe(400);
    expect((await raw("POST", `${HUB}/notes`, { ...bad, lesson: { ...bad.lesson, slides: [{ ...bad.lesson.slides[0], image: { id: "does-not-exist", alt: "x" } }] } })).status).toBe(400);
    expect((await raw("PUT", `${HUB}/notes/${L.noteId}`, { topicId, title: L.title, body: "", published: true, lesson: bad.lesson })).status).toBe(400);
    // A missing alt text is refused too; a deck without pictures is fine and the note's slides stay intact after it.
    expect((await raw("POST", `${HUB}/notes`, { ...bad, lesson: { ...bad.lesson, slides: [{ ...bad.lesson.slides[0], image: { id: other.id } }] } })).status).toBe(400);
    const n = await tutorNote();
    expect(n.lesson?.slides?.[0].title).toBe(SLIDE_TITLE_EDITED);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe("1b. tutor: set for children (homework) and add to a live lesson", () => {
  test("Set for children → homework for this child with the lesson + its exit quiz", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorTab(page, /^Lessons/);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    const card = await searchLesson(page, L.title);
    await card.getByRole("button", { name: L.title, exact: true }).click();
    await expect(page.getByTestId("lesson-tutor-panel")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("lesson-set-for-children").click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByLabel("Title")).toHaveValue(L.title);
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).toContainText("interactive");
    await expect(dlg.locator("#hub-hw-quiz")).toHaveValue(L.quizId, { timeout: 20_000 });
    await dlg.getByRole("button", { name: childName, exact: true }).click();
    await expect(dlg.getByRole("button", { name: childName, exact: true })).toHaveAttribute("aria-pressed", "true");
    const due = new Date(Date.now() + 3 * 86_400_000);
    await dlg.locator("#hub-hw-due").fill(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`);
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    expect((await saved).status()).toBe(201);
    await expect(dlg).toHaveCount(0);
    const hw = await tutorHomework(L.title);
    expect(hw, "homework row for this run's lesson").toBeTruthy();
    expect(hw!.noteIds).toEqual([L.noteId]);
    expect(hw!.assessmentId).toBe(L.quizId);
    expect(hw!.assignedChildIds).toEqual([childId]);
    hwId = hw!.id;
    await expect(page.getByRole("tab", { name: /Set homework/ })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: /Set homework/ }).click();
    await expect(cardWith(page, L.title, "Hand-ins (0/1)")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("Live lessons → Attach lessons from my library → the lesson is on the live lesson", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    liveId = (await retry(() => apiPost<{ id: string }>(`${HUB}/lessons`, t, { title: LIVE_TITLE, topicId, startsAt: new Date(Date.now() + 60 * 60_000).toISOString(), durationMins: 30, childIds: [childId] }))).id;
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorTab(page, /Live lessons/);
    const row = cardWith(page, LIVE_TITLE);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator('[data-action="add-notes"]').click();
    const dlg = page.locator("#hub-lesson-notes-dialog");
    await expect(dlg).toBeVisible({ timeout: 20_000 });
    await dlg.locator("#ws-attach-notes").click();
    const pick = page.locator("#ws-attach-dialog");
    await expect(pick).toBeVisible({ timeout: 20_000 });
    await pick.getByLabel("Search lessons").fill(L.title);
    const box = pick.getByRole("checkbox").first();
    await expect(pick.locator("label").filter({ hasText: L.title })).toBeVisible({ timeout: 20_000 });
    await box.check();
    const saved = page.waitForResponse((r) => r.url().includes(`/lessons/${liveId}`) && r.request().method() === "PUT");
    await pick.getByRole("button", { name: /Save · 1 attached/ }).click();
    expect((await saved).status()).toBe(200);
    await expect(pick).toHaveCount(0);
    await expect(dlg.getByRole("list", { name: "Attached lessons" })).toContainText(L.title);
    const live = await retry(async () => (await apiFetch<{ id: string; noteIds?: string[] }[]>(`${HUB}/lessons`, await token(accounts.freelancer))).find((x) => x.id === liveId));
    expect(live?.noteIds).toEqual([L.noteId]);
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe("2 + 3. parent sees the homework; the child does the whole lesson in kid mode", () => {
  test("parent: the homework lists the lesson and its quiz, 'Start the lesson' opens the player for this child", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Homework/);
    const row = cardWith(page, L.title);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(/Due/);
    await row.click();
    const detail = page.locator("#hub-homework-detail");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Lessons to do first")).toBeVisible();
    await expect(detail.getByTestId("hub-hw-quiz")).toContainText("Take the quiz");
    await detail.getByTestId("hub-hw-start-lesson").click();
    await expect(player(page)).toBeVisible({ timeout: 30_000 });
    await expect(player(page).getByTestId("hub-child-chip").first()).toHaveAttribute("data-child-id", childId);
    await expect(page.getByTestId("lesson-start")).toBeEnabled({ timeout: 20_000 });
    await player(page).getByRole("button", { name: "Leave this lesson" }).click();
    await expect(page.locator("#hub-homework-detail")).toContainText(L.title, { timeout: 20_000 });
    await ctx.close();
  });

  test("kid mode: Start → warm-up with pictures → slides (tutor's picture) → quiz (written) → done; XP + streak; hand-in; 'once' retake", async ({ browser }) => {
    test.setTimeout(420_000);
    const ctx = await ctxFor(browser, "parent", { reducedMotion: "reduce" });
    const page = await ctx.newPage();
    // No answer key may reach the browser before an answer is committed.
    const leaks: string[] = [];
    page.on("response", async (r) => {
      const url = r.url();
      const isWarm = /\/notes\/[^/]+\/lesson-questions/.test(url);
      const isStart = /\/assessments\/[^/]+\/attempts/.test(url) && r.request().method() === "POST";
      if (!isWarm && !isStart) return;
      const body = await r.text().catch(() => "");
      if (/"correctAnswer"|"explanation"|"acceptedAnswers"|"answer":|"pairs"/.test(body)) leaks.push(`${isWarm ? "lesson-questions" : "attempt start"}: ${body.slice(0, 200)}`);
    });
    await openParentHub(page, /Homework/);
    // Hand the device over: full-screen, this child only, no adult tabs.
    await page.locator(`[data-testid="hub-hand-over"][data-child-id="${childId}"]`).click();
    await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1", { timeout: 20_000 });
    await expect(page.getByTestId("hub-kid-bar")).toContainText(childName.split(" ")[0]);
    expect((await page.getByRole("tab").allInnerTexts()).join("|")).not.toMatch(/Progress|Live lessons/);
    await tabOf(page, /Homework/).click();
    await cardWith(page, L.title).click();
    await page.locator("#hub-homework-detail").getByTestId("hub-hw-start-lesson").click();
    await expect(player(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: L.title })).toBeVisible();
    await expect(page.getByText(/2 slides/)).toBeVisible();
    await expect(page.getByTestId("lesson-xp")).toContainText("0 XP");
    await page.getByTestId("lesson-start").click();

    // Warm-up. Q1 = the picture question: its picture AND both picture options really render.
    await stepIs(page, "warm");
    await expect(player(page).getByText(PIC_Q)).toBeVisible({ timeout: 20_000 });
    await expect(player(page).getByTestId("hub-question-image")).toBeVisible();
    await picturesLoaded(page, '[data-testid="hub-question-image"]', 1);
    await expect(player(page).getByTestId("hub-question-image").getByRole("img")).toHaveAttribute("alt", PIC_ALT);
    await expect(player(page).getByTestId("hub-picture-options")).toBeVisible();
    await picturesLoaded(page, '[data-testid="hub-picture-options"]', 2);
    await answer(page, picQ, "wrong");
    await page.getByTestId("lesson-check").click();
    const fb = player(page).getByRole("status").filter({ hasText: "Not quite" });
    await expect(fb).toBeVisible();
    expect(await streakOf(page)).toBe(0);
    await page.getByTestId("lesson-next").click();
    for (let i = 1; i < L.warmup.length; i++) {
      await answer(page, L.warmup[i], "right");
      await page.getByTestId("lesson-check").click();
      await expect(player(page).getByRole("status").filter({ hasText: /Yes!|Spot on!|Nice one!|Correct!/ })).toBeVisible();
      await expect.poll(() => streakOf(page)).toBe(i);
      await page.getByTestId("lesson-next").click();
    }
    const xpAfterWarm = await xpOf(page);
    expect(xpAfterWarm).toBeGreaterThan(0);

    // Slides: the edited title, the tutor's uploaded picture (a signed link the child can load), the check slide.
    await stepIs(page, "slides");
    await expect(page.getByTestId("slide")).toContainText(SLIDE_TITLE_EDITED);
    await expect(page.getByTestId("slide-image")).toBeVisible({ timeout: 20_000 });
    await picturesLoaded(page, '[data-testid="slide-image"]', 1);
    await expect(page.getByTestId("slide-image").getByRole("img")).toHaveAttribute("alt", SLIDE_PIC_ALT);
    await expect(page.getByTestId("slide-edit")).toHaveCount(0); // a child never sees the tutor's editing tools
    await page.getByTestId("lesson-next").click();
    await expect(page.getByTestId("slide")).toContainText(`Quick check ${stamp}`);
    await page.getByTestId("slide").getByRole("button", { name: "Myelin" }).click();
    await expect(page.getByTestId("slide")).toContainText("Myelin is a fatty sheath.");
    await page.getByTestId("lesson-next").click(); // "Continue →"

    // Quiz: a REAL attempt for this homework. The written answer first, the rest right.
    await stepIs(page, "quiz");
    for (let i = 0; i < L.quiz.length; i++) {
      await answer(page, L.quiz[i], "right");
      if (i < L.quiz.length - 1) await page.getByTestId("lesson-next").click();
    }
    await page.getByTestId("lesson-finish").click();
    await stepIs(page, "done");
    const auto = L.quiz.length - 1;
    await expect(player(page)).toContainText(`Auto-marked ${auto}/${auto} · 1 written answer being reviewed`);
    expect(await xpOf(page)).toBeGreaterThan(xpAfterWarm);
    await expect(player(page).getByText(/Your progress is updated/)).toBeVisible();
    await expect(player(page).getByRole("button", { name: /key words are in your flashcards/ })).toBeVisible();
    expect(leaks, leaks.join("\n")).toEqual([]);
    // Server truth: one attempt, pending the tutor, recorded against THIS homework.
    const att = await childAttempts();
    expect(att).toHaveLength(1);
    expect(att[0]).toMatchObject({ status: "pending_marking", homeworkId: hwId, writtenPending: 1 });

    // Retake rule ("once"): trying the lesson again reaches the quiz and is told politely — nothing is started.
    await player(page).getByRole("button", { name: /Try the lesson again/ }).click();
    await stepIs(page, "start");
    await expect(page.getByTestId("lesson-xp")).toContainText("0 XP");
    await page.getByTestId("lesson-start").click();
    await stepIs(page, "warm");
    // Skip through quickly: answer every warm-up right, walk the slides, and the quiz step refuses.
    for (let i = 0; i < L.warmup.length; i++) {
      await answer(page, L.warmup[i], "right");
      await page.getByTestId("lesson-check").click();
      await page.getByTestId("lesson-next").click();
    }
    await stepIs(page, "slides");
    await page.getByTestId("lesson-next").click();
    await page.getByTestId("lesson-next").click();
    await stepIs(page, "done");
    await expect(page.getByTestId("lesson-noquiz")).toContainText("This one can only be sat once");
    expect(await childAttempts()).toHaveLength(1);

    // Back to the homework: the quiz is done, hand it in (the attempt is attached automatically).
    await page.getByTestId("lesson-exit").click();
    const detail = page.locator("#hub-homework-detail");
    await expect(detail).toContainText(L.title, { timeout: 20_000 });
    await expect(detail.getByTestId("hub-hw-quiz")).toContainText("Quiz done", { timeout: 20_000 });
    await expect(detail.getByTestId("hub-hw-quiz")).toContainText("waiting for your tutor to mark");
    const handed = page.waitForResponse((r) => /\/submissions\/[^/]+\/submit/.test(r.url()) && r.request().method() === "POST");
    await detail.locator("#hub-hw-submit").click();
    expect((await handed).status()).toBe(200);
    const fam = await retry(async () => (await apiFetch<{ id: string; submission: { status: string; attemptId: string | null } }[]>(`${HUB}/homework?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent))).find((h) => h.id === hwId));
    expect(fam?.submission).toMatchObject({ status: "submitted", attemptId: att[0].id });
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe("4. tutor: results, marking, live progress", () => {
  test("the hand-in is in the inbox; the written answer is marked from the queue; the family gets the mark", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorTab(page, /Set homework/);
    await expect(cardWith(page, L.title, "Hand-ins (1/1)")).toBeVisible({ timeout: 30_000 });
    await tabOf(page, /Quizzes/).click();
    await page.getByRole("radio", { name: /^Marking/ }).click();
    const row = page.locator('[data-testid="hub-marking-row"]').filter({ hasText: L.quizTitle }).filter({ hasText: childName });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    const form = page.locator('[data-testid="hub-mark-form"]');
    await expect(form).toContainText(WRITTEN_Q);
    await expect(form).toContainText(writtenQ.right); // the child's own words
    await form.locator('[data-testid="hub-marks-input"]').fill("2");
    await form.getByLabel(/^Feedback/).fill(FEEDBACK);
    const saved = page.waitForResponse((r) => /\/attempts\/[^/]+\/mark/.test(r.url()) && r.request().method() === "PUT");
    await form.locator('[data-testid="hub-save-marks"]').click();
    expect((await saved).status()).toBe(200);
    const back = page.getByRole("button", { name: /← Queue/ });
    if (await back.isVisible().catch(() => false)) await back.click();
    await expect(page.locator('[data-testid="hub-marking-row"]').filter({ hasText: L.quizTitle }).filter({ hasText: childName })).toHaveCount(0, { timeout: 20_000 });
    const att = await childAttempts();
    expect(att[0]).toMatchObject({ status: "marked", scoreMarks: L.quiz.length + 1, maxMarks: L.quiz.length + 1 }); // written = 2 marks
    await ctx.close();
  });

  test("Progress overview shows the student; a new result arrives over SSE without a reload", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorTab(page, /Progress/);
    const row = page.locator('[data-testid="hub-overview"] tbody tr').filter({ hasText: childName });
    await expect(row).toContainText("100%", { timeout: 30_000 });
    // A second, weaker attempt made on the child's behalf (the tutor's one-more-go, then a paper with the written answer left blank).
    const t = await token(accounts.freelancer);
    await retry(() => apiPost(`${HUB}/assessments/${L.quizId}/allow-retake`, t, { childId }));
    const start = await retry(() => apiPost<{ attemptId: string; questions: { id: string; kind: string; options?: { id: string; text: string }[] }[] }>(`${HUB}/assessments/${L.quizId}/attempts`, t, { childId }));
    const answers = start.questions.flatMap((q) => {
      const meta = L.quiz.find((x) => x.id === q.id);
      if (!meta || meta.kind !== "single") return [];
      const o = q.options?.find((x) => x.text === meta.wrong);
      return o ? [{ questionId: q.id, response: o.id }] : [];
    });
    await retry(() => apiPost(`${HUB}/attempts/${start.attemptId}/submit`, t, { answers }));
    // The overview re-reads on the hubAttempts / hubMastery pings: the mean drops below 100% with no navigation.
    await expect(row).not.toContainText("100%", { timeout: 60_000 });
    await expect(row).toContainText("%");
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe("5. flashcards from the lesson, spaced repetition", () => {
  test("the child reviews the key-word cards; SM-2 schedules them server-side; then nothing is due", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Flashcards/);
    const start = page.getByTestId("hub-fc-start");
    await expect(start).toContainText("card", { timeout: 30_000 });
    await expect(start).toContainText("Coordination and control"); // this run's topic is in today's review
    const reviews: Promise<{ cardId?: string; intervalDays: number; nextDueAt: string }>[] = [];
    page.on("response", (r) => { if (/\/flashcards\/[^/]+\/review/.test(r.url()) && r.request().method() === "POST") reviews.push(r.json()); });
    await page.locator("#hub-fc-start").click();
    const card = page.getByTestId("hub-flashcard");
    await expect(card).toBeVisible();
    await expect(card).toContainText(`(${stamp})`); // one of THIS lesson's key words
    await expect(card).toHaveAttribute("data-flipped", "false");
    await page.keyboard.press("Space");
    await expect(card).toHaveAttribute("data-flipped", "true");
    await page.keyboard.press("1"); // Again — comes back inside the session
    for (let i = 0; i < 20 && !(await page.getByTestId("hub-fc-summary").isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Space");
      await page.keyboard.press("3"); // Good
      await page.waitForTimeout(250);
    }
    await expect(page.getByTestId("hub-fc-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("hub-fc-summary")).toContainText("Session complete");
    await expect.poll(() => reviews.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(cardIds.length + 1);
    const first = await reviews[0];
    expect(first.intervalDays).toBeGreaterThanOrEqual(1);
    expect(Date.parse(first.nextDueAt)).toBeGreaterThan(Date.now());
    await page.getByRole("button", { name: "Done for now" }).click();
    await expect(page.getByTestId("hub-fc-caughtup")).toBeVisible({ timeout: 30_000 });
    // Server truth: every card of this lesson is scheduled for later, none due now.
    const due = await retry(async () => apiFetch<{ due: { id: string }[]; dueCount: number; newCount: number; upcoming: number }>(`${HUB}/flashcards/due?tenantId=${tenantId}&childId=${childId}&topicId=${topicId}`, await token(accounts.parent)));
    expect(due.due.filter((d) => cardIds.includes(d.id))).toEqual([]);
    expect(due.upcoming).toBeGreaterThanOrEqual(cardIds.length);
    await ctx.close();
  });
});
