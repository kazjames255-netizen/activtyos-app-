import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loadAccounts, statePath, ROOT, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { seedOakLesson } from "./helpers/lessonFixture";
import { openTab } from "./helpers/hubTabs";

// Scratch verification of the shared LessonPicker on a throwaway tenant (E2E_AUTH_DIR=/tmp/pickerauth).
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const shots = path.join(ROOT, "docs/lesson-picker-shots");
fs.mkdirSync(shots, { recursive: true });
const acc = loadAccounts().accounts;
const tenantId = acc.freelancer.tenantId!;
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
let T = "";
const ids: Record<string, string> = {};
const MATHS = `Maths ${stamp}`, SCI = `Science ${stamp}`;
const RE = process.env.PK_STAMP; // reuse a seeded run

async function setHub(on: boolean) {
  const s = await fbSignIn(acc.freelancer.email);
  const lib = (await apiFetch<{ settings?: Record<string, unknown> & { features?: Record<string, boolean> } } | null>("/api/library", s.idToken)) ?? {};
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } } }) });
}
async function ctxPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
  return { ctx, page: await ctx.newPage() };
}
async function goHub(page: Page) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let i = 0; i < 3; i++) {
    await setHub(true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
}
const overflow = (page: Page, sel: string) => page.evaluate((s) => {
  const root = document.querySelector(s) as HTMLElement | null;
  if (!root) return { missing: true };
  const vw = document.documentElement.clientWidth;
  const bad: string[] = [];
  root.querySelectorAll("input,button,[role=tab],[data-ui=card]").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) bad.push(`${e.tagName}:${(e.textContent ?? "").slice(0, 15)}:${Math.round(r.left)}-${Math.round(r.right)}`); });
  return { docScroll: document.documentElement.scrollWidth - vw, bodyScroll: document.body.scrollWidth - vw, bad: bad.slice(0, 6) };
}, sel);
const small = (page: Page, sel: string) => page.evaluate((s) => {
  const out: string[] = [];
  document.querySelectorAll(`${s} button, ${s} input, ${s} [role=tab]`).forEach((e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); if (r.width > 0 && st.visibility !== "hidden" && (r.height < 43.5 || r.width < 43.5)) out.push(`${e.tagName}:${(e.getAttribute("aria-label") || e.textContent || "").slice(0, 25)}:${Math.round(r.width)}x${Math.round(r.height)}`); });
  return out;
}, sel);

test("seed", async () => {
  test.setTimeout(400_000);
  await setHub(true);
  T = await token(acc.freelancer);
  for (const s of [MATHS, SCI]) await apiPost("/api/learning-hub/topics", T, { subject: s, topic: "Unit" });
  const parents = await apiFetch<{ id: string; subject: string; subtopic?: string | null }[]>("/api/learning-hub/topics", T);
  for (const [s, y] of [[MATHS, "Year 4"], [MATHS, "Year 5"], [SCI, "Year 4"]] as const) await apiPost("/api/learning-hub/topics", T, { parentTopicId: parents.find((x) => x.subject === s && !x.subtopic)!.id, subtopic: y });
  const topics = await apiFetch<{ id: string; subject: string; subtopic?: string }[]>("/api/learning-hub/topics", T);
  const tid = (s: string, y: string) => topics.find((x) => x.subject === s && x.subtopic === y)!.id;
  const mk = async (key: string, title: string, topicId: string) => { ids[key] = (await apiPost<{ id: string }>("/api/learning-hub/notes", T, { topicId, title: `${title} ${stamp}`, body: `${title} body`, published: true })).id; };
  await mk("m4a", "Fractions sheet A", tid(MATHS, "Year 4")); await mk("m4b", "Fractions sheet B", tid(MATHS, "Year 4"));
  await mk("m5", "Decimals sheet", tid(MATHS, "Year 5")); await mk("s4", "Plants sheet", tid(SCI, "Year 4")); await mk("plain", "Plain note without sheet", tid(MATHS, "Year 4"));
  const L = await seedOakLesson(T, { stamp, subject: SCI, topicId: tid(SCI, "Year 4"), widget: null });
  ids.lesson = L.noteId; ids.quiz = L.quizId; ids.lessonTitle = L.title;
  for (const [k, q] of [["m4a", L.quizId], ["m4b", L.quizId], ["m5", L.quizId], ["s4", L.quizId], ["lesson", L.quizId]] as const)
    execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/seedWorksheet.ts"), tenantId, ids[k]!, q], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
  for (const k of ["m4a", "m4b", "m5", "s4", "lesson"]) {
    const n = await apiFetch<{ topicId: string; title: string; body: string }>(`/api/learning-hub/notes/${ids[k]}`, T);
    await apiFetch(`/api/learning-hub/notes/${ids[k]}`, T, { method: "PUT", body: JSON.stringify({ topicId: n.topicId, title: n.title, body: n.body ?? "", published: true }) });
  }
  const counts = await apiFetch<Record<string, unknown>>("/api/learning-hub/notes/counts", T);
  console.log("COUNTS", JSON.stringify({ w: counts.worksheets, y: counts.worksheetsByYear, s: counts.worksheetsBySubject }));
  expect(Number(counts.worksheets)).toBeGreaterThanOrEqual(5);
});

test("homework worksheet picker", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await ctxPage(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await goHub(page);
  await openTab(page, /^Homework/);
  await page.locator("#hub-new-homework").first().click();
  const dlg = page.locator("#hub-homework-form");
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  const wp = dlg.getByTestId("hub-hw-ws-picker");
  await expect(wp).toBeVisible();
  // browsable at once, no search needed
  await expect(wp.locator("[data-ui=card]").first()).toBeVisible({ timeout: 30_000 });
  console.log("WS cards", await wp.locator("[data-ui=card]").count(), "count text", await wp.getByTestId("hub-hw-ws-count").innerText());
  await wp.scrollIntoViewIfNeeded();
  console.log("HW ul", JSON.stringify(await page.evaluate(() => { const u = document.querySelector("[data-testid=hub-hw-ws-cards]") as HTMLElement; const chain: string[] = []; let e: HTMLElement | null = u; while (e && chain.length < 8) { chain.push(`${e.tagName}.${(e.className || "").toString().slice(0, 60)}|${Math.round(e.getBoundingClientRect().width)}|${getComputedStyle(e).display}`); e = e.parentElement; } let hits: string[] = []; for (const ss of Array.from(document.styleSheets)) { try { for (const r of Array.from(ss.cssRules)) { const walk = (rr: CSSRule) => { if ((rr as CSSStyleRule).selectorText && u.matches((rr as CSSStyleRule).selectorText) && /grid-template/.test(rr.cssText)) hits.push(rr.cssText.slice(0, 160)); (rr as CSSGroupingRule).cssRules && Array.from((rr as CSSGroupingRule).cssRules).forEach(walk); }; walk(r); } } catch {} } return { cls: u.className, cols: getComputedStyle(u).gridTemplateColumns, hits, chain: chain.slice(0,1) }; })));
  await page.screenshot({ path: path.join(shots, "hw-worksheets-1440.png") });
  console.log("WS chips:", await wp.getByTestId("hub-hw-ws-subject-chips").innerText().catch(() => "none"));
  console.log("WS years:", (await wp.getByRole("tablist").innerText()).replace(/\n/g, " "));
  await wp.getByLabel(/Search worksheets/).fill(stamp);
  await expect(wp.locator("[data-ui=card]")).toHaveCount(5, { timeout: 15_000 });
  // badges
  await expect(wp.locator("[data-ui=card]", { hasText: ids.lessonTitle! })).toContainText("Interactive");
  await expect(wp.locator("[data-ui=card]", { hasText: `Plants sheet ${stamp}` })).toContainText("Interactive");
  await expect(wp.locator("[data-ui=card]", { hasText: "Plain note without sheet" })).toHaveCount(0);
  // filter year 5
  await wp.getByRole("tab", { name: /^Year 5/ }).click();
  await page.waitForTimeout(800);
  await expect(wp.locator("[data-ui=card]", { hasText: stamp })).toHaveCount(1);
  await page.screenshot({ path: path.join(shots, "hw-worksheets-year5-1440.png") });
  // subject + year with no results -> empty state
  await wp.getByRole("button", { name: new RegExp(`^${SCI}`) }).first().click();
  await expect(wp.getByTestId("lesson-picker-empty")).toBeVisible();
  console.log("EMPTY text:", await wp.getByTestId("lesson-picker-empty").innerText());
  await page.screenshot({ path: path.join(shots, "hw-worksheets-empty-1440.png") });
  await wp.getByRole("button", { name: /clear filters/i }).click();
  await wp.getByLabel(/Search worksheets/).fill(stamp);
  await expect(wp.locator("[data-ui=card]", { hasText: stamp })).toHaveCount(5, { timeout: 15_000 });
  // search no-match
  await wp.getByLabel(/Search worksheets/).fill("zzzznothing");
  await expect(wp.getByTestId("lesson-picker-empty")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(shots, "hw-worksheets-nomatch-1440.png") });
  await wp.getByLabel(/Search worksheets/).fill(stamp);
  await expect(wp.locator("[data-ui=card]", { hasText: stamp })).toHaveCount(5, { timeout: 10_000 });
  // multi-select + keyboard
  const a = wp.locator("[data-ui=card]", { hasText: `Fractions sheet A ${stamp}` });
  await a.locator("[data-pick]").click();
  await expect(a.locator("[data-pick]")).toHaveAttribute("aria-pressed", "true");
  await wp.locator("[data-ui=card]", { hasText: `Decimals sheet ${stamp}` }).locator("[data-pick]").focus();
  await page.keyboard.press("Space");
  await expect(dlg.getByTestId("hub-hw-attached-worksheets")).toContainText(`Fractions sheet A ${stamp}`);
  await expect(dlg.getByTestId("hub-hw-attached-worksheets")).toContainText(`Decimals sheet ${stamp}`);
  await expect(wp.getByTestId("hub-hw-ws-chosen")).toContainText("2");
  await wp.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "hw-worksheets-selected-1440.png") });
  // Preview from a card and from a chip
  await a.getByTestId("hub-hw-ws-preview-btn").click();
  const pv = page.locator("#hub-hw-quiz-preview");
  await expect(pv).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(shots, "hw-worksheets-preview-1440.png") });
  await page.keyboard.press("Escape");
  await expect(pv).toHaveCount(0);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByTestId("hub-hw-attached-worksheets")).toContainText(`Fractions sheet A ${stamp}`);
  // deselect via chip ×
  await dlg.getByRole("button", { name: `Remove Decimals sheet ${stamp}` }).click();
  await expect(dlg.getByTestId("hub-hw-attached-worksheets")).not.toContainText("Decimals sheet");
  console.log("HW 44px violations:", JSON.stringify(await small(page, "#hub-homework-form [data-testid=hub-hw-worksheets]")));
  for (const [w, h] of [[768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await wp.scrollIntoViewIfNeeded();
    console.log(`HW overflow ${w}:`, JSON.stringify(await overflow(page, "[data-testid=hub-hw-ws-picker]")));
    await page.screenshot({ path: path.join(shots, `hw-worksheets-${w}.png`) });
  }
  await ctx.close();
});

// SKIPPED: there is no "Teach in person" tab any more — in-person is started from the "New session" chooser (Let's Teach), so this screenshot walk
// through the old tab cannot reach the in-person setup page. (Covered functionally by learning-hub-inperson*.spec.ts.)
test.skip("in-person setup shots + overflow; teach page RTL", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await ctxPage(browser);
  await goHub(page);
  await openTab(page, /Teach in person/);
  const app = page.getByTestId("inperson-app");
  await expect(app).toBeVisible();
  const picker = app.getByTestId("ip-filters");
  await expect(picker.getByTestId("ip-lesson-subjects")).toBeVisible({ timeout: 30_000 });
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await picker.scrollIntoViewIfNeeded();
    console.log(`SETUP landing overflow ${w}:`, JSON.stringify(await overflow(page, "[data-testid=ip-filters]")));
    await page.screenshot({ path: path.join(shots, `setup-landing-${w}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await picker.getByTestId("ip-lesson-all").click();
  await expect(picker.locator("[data-ui=card]").first()).toBeVisible({ timeout: 20_000 });
  await picker.getByTestId("ip-lesson-search").fill(ids.lessonTitle!);
  await picker.locator("[data-ui=card]", { hasText: ids.lessonTitle! }).locator("[data-pick]").click();
  await expect(app.getByTestId("ip-chosen")).toBeVisible();
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await picker.scrollIntoViewIfNeeded();
    console.log(`SETUP selected overflow ${w}:`, JSON.stringify(await overflow(page, "[data-testid=ip-filters]")));
    await page.screenshot({ path: path.join(shots, `setup-selected-${w}.png`), fullPage: true });
  }
  console.log("SETUP 44px violations:", JSON.stringify(await small(page, "[data-testid=ip-filters]")));
  // keyboard: radio semantics
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = picker.locator("[data-pick]").nth(0);
  await first.focus(); await page.keyboard.press("Enter");
  console.log("aria-checked after Enter:", await first.getAttribute("aria-checked"), "role", await first.getAttribute("role"));
  // RTL
  await page.evaluate(() => localStorage.setItem("aos.locale", "ar"));
  await page.reload();
  await expect(page.getByTestId("inperson-app").getByTestId("ip-filters")).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(6000); // welcome splash
  console.log("dir:", await page.evaluate(() => document.documentElement.dir));
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.getByTestId("ip-filters").scrollIntoViewIfNeeded();
    console.log(`RTL overflow ${w}:`, JSON.stringify(await overflow(page, "[data-testid=ip-filters]")));
    await page.screenshot({ path: path.join(shots, `setup-rtl-${w}.png`), fullPage: true });
  }
  await page.evaluate(() => localStorage.removeItem("aos.locale"));
  await ctx.close();
});

// SKIPPED: an ad-hoc screenshot walk of the old schedule dialog ("New session" now asks how/when first and the form's attach field was redesigned).
test.skip("schedule video lesson attach + live-lessons attach dialog", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await ctxPage(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await goHub(page);
  await openTab(page, /Live lessons/);
  await page.locator("#hub-schedule-lesson").first().click();
  const dlg = page.locator("#hub-lesson-form");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: /Attach|Change/ }).first().click();
  const at = page.locator("#ws-attach-dialog");
  await expect(at).toBeVisible();
  await expect(at.getByTestId("ws-attach-picker")).toBeVisible();
  await expect(at.getByTestId("ws-attach-subjects")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(shots, "attach-schedule-1440.png") });
  await at.getByTestId("ws-attach-all").click();
  await at.getByLabel("Search lessons").fill(`Fractions sheet A ${stamp}`);
  const card = at.locator("[data-ui=card]", { hasText: `Fractions sheet A ${stamp}` });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.locator("[data-pick]").click();
  await page.screenshot({ path: path.join(shots, "attach-schedule-selected-1440.png") });
  console.log("ATTACH 44px:", JSON.stringify(await small(page, "#ws-attach-dialog")));
  await at.getByRole("button", { name: /Save · 1|Save/ }).last().click();
  await expect(at).toHaveCount(0);
  await expect(dlg.getByTestId(/attach/).first()).toContainText(`Fractions sheet A ${stamp}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await dlg.getByRole("button", { name: /Change/ }).first().click();
  await expect(at).toBeVisible();
  await at.getByTestId("ws-attach-all").click();
  console.log("ATTACH overflow 390:", JSON.stringify(await overflow(page, "#ws-attach-dialog")));
  await page.screenshot({ path: path.join(shots, "attach-schedule-390.png") });
  await ctx.close();
});

test("in-call Lessons tab: browse library + attach dialog", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ storageState: statePath("freelancer"), permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const t = await token(acc.freelancer);
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  const { createParentChild, provisionLiveListing } = await import("./helpers/tenantData");
  await provisionLiveListing(acc.freelancer, { title: `Picker Tutoring ${stamp}`, price: 0 });
  const kid = await createParentChild(acc.parent, { name: `Pickerkid ${stamp}` });
  await apiPost("/api/my/providers/follow", await token(acc.parent), { tenantId });
  await apiPost("/api/learning-hub/students", t, { childId: kid, subjects: [MATHS] });
  const title = `Picker call ${stamp}`;
  const lid = (await apiPost<{ id: string }>("/api/learning-hub/lessons", t, { title, topicId: topics.find((x) => x.subject === MATHS)!.id, startsAt: new Date(Date.now() - 2 * 60_000).toISOString(), durationMins: 60, childIds: [kid] })).id;
  await goHub(page);
  await openTab(page, /Live lessons/);
  const row = page.locator(`[data-lesson-id="${lid}"]`).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await page.locator(`[data-lesson-id="${lid}"] [data-action="join"], #hub-next-lesson[data-lesson-id="${lid}"] #hub-join-btn`).first().click();
  await page.locator("#hub-lobby-join").click();
  const ws = page.getByTestId("hub-workspace");
  await expect(ws).toBeVisible({ timeout: 30_000 });
  await ws.getByRole("tab", { name: /Lessons/ }).click();
  await ws.locator("#ws-browse-library").click();
  const dlg = page.locator("#ws-teach-picker");
  await expect(dlg.getByTestId("ws-teach-picker-body")).toBeVisible();
  await expect(dlg.getByTestId("ws-teach-subjects")).toBeVisible({ timeout: 30_000 });
  console.log("TEACH cols:", await dlg.getByTestId("ws-teach-subjects").evaluate((e) => getComputedStyle(e).gridTemplateColumns));
  await page.screenshot({ path: path.join(shots, "teach-browse-1440.png") });
  console.log("TEACH 44px:", JSON.stringify(await small(page, "#ws-teach-picker")));
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await ws.locator("#ws-attach-notes").click();
  const at = page.locator("#ws-attach-dialog");
  await expect(at.getByTestId("ws-attach-subjects")).toBeVisible({ timeout: 30_000 });
  await at.getByTestId("ws-attach-all").click();
  await at.getByLabel("Search lessons").fill(`Fractions sheet A ${stamp}`);
  await at.locator("[data-ui=card]", { hasText: `Fractions sheet A ${stamp}` }).locator("[data-pick]").click();
  await page.screenshot({ path: path.join(shots, "attach-incall-1440.png") });
  await at.getByRole("button", { name: /Save/ }).last().click();
  await expect(at).toHaveCount(0, { timeout: 20_000 });
  await expect(ws.getByTestId("attached-notes")).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});
