import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, ROOT, type AccountManifest, type TestAccount } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";
import { seedOakLesson, type SeededLesson } from "../helpers/lessonFixture";

// Teaching Hub — LESSONS / curriculum / flashcards area (namespace `hublessons`) in ro / ar (RTL) / cy / pl.
// Seeds a throwaway Oak-shaped lesson on the standing e2e freelancer tenant, opens the tutor's lesson screens (curriculum map,
// reader + lesson plan, preview player step by step, editor, flashcards) and the parent's flashcards, screenshots each, and lists
// visible text that still looks English. Nothing real is touched (throwaway @activityos-test.com accounts only).
test.describe.configure({ mode: "serial" });

const OUT = path.join(ROOT, "docs/i18n-hub-screenshots/hublessons");
const LOCALES = (process.env.HUB_LOCALES ?? "ro,ar,cy,pl").split(",");
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|a|an|it|no|not|yet|will|can|have|has)\b/i;
const stamp = Date.now().toString(36);
const subject = `Lessons Lab ${stamp}`;

let accounts: AccountManifest["accounts"];
let L: SeededLesson;

async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = (await fbSignIn(accounts.freelancer.email)).idToken;
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Neurones" });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  const topicId = topics.find((x) => x.subject === subject)!.id;
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: "neurone" });
});

async function leftovers(page: Page): Promise<string[]> {
  return page.evaluate((stop) => {
    const re = new RegExp(stop, "i"); const out = new Set<string>();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement; const s = (n.textContent ?? "").trim();
      if (!el || !s || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !/[A-Za-z]{3}/.test(s)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const words = s.split(/\s+/); if (words.length >= 2 && re.test(s)) out.add(s.slice(0, 110));
    }
    return [...out];
  }, STOP.source);
}

async function hub(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url, { waitUntil: "load" });
    if (await page.locator("#learning-hub").first().waitFor({ timeout: 30_000 }).then(() => true).catch(() => false)) return;
  }
}

for (const loc of LOCALES) {
  test(`hub lessons area (tutor) in ${loc}`, async ({ browser }) => {
    test.setTimeout(420_000);
    const ctx = await browser.newContext({ storageState: statePath("freelancer"), viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
    const page = await ctx.newPage();
    fs.mkdirSync(OUT, { recursive: true });
    const seen: string[] = [];
    const shot = async (name: string) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `tutor-${loc}-${name}.png`), fullPage: false });
      for (const s of await leftovers(page)) seen.push(`[${name}] ${s}`);
    };
    await hub(page, "/freelancer/learninghub");
    await page.locator('[data-top="lessons"]').first().click();
    await page.locator("#hub-notes").waitFor({ timeout: 30_000 });
    await shot("curriculum");

    // find THIS run's lesson: the map's search surfaces a lesson that isn't placed on the map as a link
    const search = page.locator('#hub-notes input[type="search"]').first();
    await search.fill(L.title);
    const hit = page.getByRole("button", { name: L.title, exact: true }).first();
    await hit.waitFor({ timeout: 30_000 });
    await shot("curriculum-search");
    await hit.click();
    await page.getByTestId("lesson-tutor-panel").waitFor({ timeout: 30_000 });
    await shot("reader");
    await page.getByTestId("lesson-plan").scrollIntoViewIfNeeded().catch(() => undefined);
    await shot("reader-plan");

    // preview player, step by step
    await page.getByTestId("lesson-preview").click();
    await page.getByTestId("lesson-player").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await shot("player-start");
    for (const step of ["learn", "words", "warm", "quiz", "done"]) {
      const b = page.getByTestId(`preview-jump-${step}`);
      if (await b.count()) { await b.click({ force: true }).catch(() => undefined); await page.waitForTimeout(900); await shot(`player-${step}`); }
    }
    await page.getByTestId("lesson-leave").first().click().catch(() => undefined);

    // editor (new lesson) + flashcards
    await page.goto("/freelancer/learninghub", { waitUntil: "load" });
    await page.locator('[data-top="lessons"]').first().click();
    await page.locator("#hub-notes").waitFor({ timeout: 30_000 });
    const create = page.locator("#hub-notes button", { hasText: /\+|Create|Creează|Utwórz|Creu|إنشاء/ }).first();
    if (await create.count()) { await create.click().catch(() => undefined); await page.locator("#hub-note-editor").waitFor({ timeout: 15_000 }).catch(() => undefined); await shot("editor"); }
    await page.goto("/freelancer/learninghub", { waitUntil: "load" });
    await page.locator('[data-top="lessons"]').first().click();
    const fc = page.locator('[data-sub="flashcards"]').first();
    if (await fc.count()) { await fc.click().catch(() => undefined); await page.locator("#hub-flashcards").waitFor({ timeout: 20_000 }).catch(() => undefined); await shot("flashcards"); }

    fs.writeFileSync(path.join(OUT, `tutor-${loc}-leftovers.txt`), seen.join("\n"));
    console.log(`tutor/${loc}: ${seen.length} possibly-English strings`);
    await ctx.close();
    expect(true).toBe(true);
  });

  test(`hub lessons area (parent flashcards) in ${loc}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ storageState: statePath("parent"), viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
    const page = await ctx.newPage();
    fs.mkdirSync(OUT, { recursive: true });
    const seen: string[] = [];
    await page.goto("/custdash/learninghub", { waitUntil: "load" });
    await page.locator("#learning-hub, #learning-hub-off").first().waitFor({ timeout: 60_000 });
    for (const k of ["notes", "flashcards"]) {
      const b = page.locator(`[data-panel="${k}"]`).first();
      if (await b.count()) { await b.click().catch(() => undefined); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `parent-${loc}-${k}.png`) }); for (const s of await leftovers(page)) seen.push(`[${k}] ${s}`); }
    }
    fs.writeFileSync(path.join(OUT, `parent-${loc}-leftovers.txt`), seen.join("\n"));
    console.log(`parent/${loc}: ${seen.length} possibly-English strings`);
    await ctx.close();
  });
}
