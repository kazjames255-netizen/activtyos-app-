import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";
import { openTab } from "./helpers/hubTabs";

type Level = "early" | "standard" | "advanced";

// Learning Hub — the live whiteboard in the call room (features/learninghub/live/board):
// the tutor opens the Board tab, draws with the mouse, the stroke is autosaved and survives a
// reload, and "Save to lesson notes" files the page as a note attached to the lesson. A second
// browser (the family) joins the same Daily room to check the live layer end to end: it sees
// the tutor's drawing, is read-only until the tutor lets that student write, and its private
// "My workings" page reaches the tutor's "Student work" grid (and nobody else).
//
// Headless Chromium runs with fake camera/microphone devices so Daily's prebuilt frame can join.

test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.describe.configure({ mode: "serial" });

const stamp = "zzs" + Date.now().toString(36);
const subject = `Board ${stamp}`;
const childName = `Wbkid ${stamp}`;
const lessonTitle = `Board lesson ${stamp}`;
const shotsDir = process.env.BOARD_SHOTS ?? "";

let accounts: AccountManifest["accounts"];
let childId = "", topicId = "", lessonId = "";

/** The dev API hot-reloads whenever anyone saves a server file — ride out a restart (network errors only). */
async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 8 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
const setHub = (op: TestAccount, on: boolean) => net(() => setHubOnce(op, on));
async function setHubOnce(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = (a: TestAccount) => net(async () => (await fbSignIn(a.email)).idToken);
const shot = async (page: Page, name: string) => { if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${name}.png`) }); } };

const envApi = (() => {
  try { return fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent", extra: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext({ storageState: statePath(role), permissions: ["camera", "microphone"], ...extra });
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

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await net(async () => {
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Board ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  await bookViaApi(accounts.parent, listing, { child: childName }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Fractions" });
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  const l = await apiPost<{ id: string }>("/api/learning-hub/lessons", t, { title: lessonTitle, topicId, startsAt: new Date(Date.now() + 3 * 60_000).toISOString(), durationMins: 90, childIds: [childId], notes: `Board notes ${stamp}` });
  lessonId = l.id;
  });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); }); // other specs toggle the hub on this shared account

async function gotoHub(page: Page, url: string, who: "tutor" | "family") {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (who === "family") {
      const provider = page.getByLabel("Provider");
      if (await provider.isVisible().catch(() => false)) await provider.selectOption(accounts.freelancer.tenantId!);
      const select = page.getByRole("combobox", { name: "Child" });
      if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
    }
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

/** Lobby → Join → the call room, then open the Board tab. */
async function enterBoard(page: Page, who: "tutor" | "family") {
  if (who === "family") await dismissParentWelcome(page);
  await gotoHub(page, who === "tutor" ? "/freelancer/learninghub" : "/custdash/learninghub", who);
  await openTab(page, /Live lessons/);
  const row = page.locator(`[data-lesson-id="${lessonId}"] [data-action="join"], #hub-next-lesson[data-lesson-id="${lessonId}"] #hub-join-btn`).first();
  await expect(row).toBeVisible({ timeout: 40_000 });
  await row.click();
  await page.locator("#hub-lobby-join").click();
  await expect(page.locator("#hub-call-room")).toBeVisible({ timeout: 30_000 });
  // Daily's frame may be slow (or unreachable from this machine): the board works locally either way, so wait for it but don't fail on it.
  await page.locator("[data-testid=hub-daily-frame] iframe").waitFor({ state: "attached", timeout: 40_000 }).catch(() => undefined);
  const ws = page.getByTestId("hub-workspace");
  await expect(ws).toBeVisible({ timeout: 20_000 });
  // make the workspace the wide main stage so the board is comfortable
  await page.locator('#hub-call-room [data-preset="work"]').click();
  await ws.locator('[data-tab="board"]').click();
  await expect(page.getByTestId("lesson-board")).toBeVisible({ timeout: 20_000 });
}

const boardOf = (page: Page) => page.getByTestId("lesson-board");
const surface = (page: Page) => page.getByTestId("board-surface");
const tool = (page: Page, t: string) => page.locator(`button[data-tool="${t}"]:visible`).first();
async function drag(page: Page, from: [number, number], to: [number, number], steps = 12) {
  const b = (await surface(page).boundingBox())!;
  await page.mouse.move(b.x + from[0], b.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + to[0], b.y + to[1], { steps });
  await page.mouse.up();
}
const elements = async (page: Page) => Number(await boardOf(page).getAttribute("data-elements"));


const SHAPES = ["line", "arrow", "darrow", "rect", "ellipse", "triangle", "diamond", "rtriangle", "pentagon", "hexagon", "star", "heart", "bubble"] as const;
const log: string[] = [];
const note = (s: string) => { log.push(s); console.log("NOTE " + s); };
const OUT = process.env.BOARD_SHOTS!;

async function savedBoard(page: Page) {
  await expect(page.getByTestId("board-save-status").first()).toHaveAttribute("data-state", "saved", { timeout: 40_000 });
  await page.waitForTimeout(300);
  return apiFetch<{ pages: { id: string; elements: any[] }[] }>(`/api/learning-hub/lessons/${lessonId}/board`, await token(accounts.freelancer));
}
const curPageId = async (page: Page) => boardOf(page).getAttribute("data-page");
async function els(page: Page) {
  const b = await savedBoard(page); const id = await curPageId(page);
  return b.pages.find((p) => p.id === id)!.elements;
}
const toolNow = (page: Page) => surface(page).getAttribute("data-tool");
const clip = async (page: Page, name: string, x = 0, y = 0, w = 1000, h = 700) => {
  const b = (await surface(page).boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: b.x + x, y: b.y + y, width: Math.min(w, b.width - x), height: Math.min(h, b.height - y) } });
};
async function newPage(page: Page) { await page.locator('[data-action="add-page"]:visible').first().click(); await page.waitForTimeout(200); }
async function pickShape(page: Page, s: string) { await tool(page, "shapes").click(); await page.locator(`[data-shape="${s}"]`).click(); }
const rel = async (page: Page, x: number, y: number) => { const b = (await surface(page).boundingBox())!; return { x: b.x + x, y: b.y + y }; };
async function click(page: Page, x: number, y: number) { const p = await rel(page, x, y); await page.mouse.click(p.x, p.y); }

test.describe.configure({ mode: "serial" });
test.describe("shapes review", () => {
  let page: Page; let ctx: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    ctx = await ctxFor(browser, "freelancer");
    page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
  });
  test.afterAll(async () => { fs.writeFileSync(path.join(OUT, "log.txt"), log.join("\n")); await ctx?.close(); });

  test("00 chrome", async () => {
    await page.screenshot({ path: path.join(OUT, "00-full.png") });
    await tool(page, "shapes").click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "01-shapes-pop.png") });
    await page.keyboard.press("Escape");
    // titles of every tool button
    const titles = await page.locator('[data-testid="board-tools"]:visible button').evaluateAll((bs) => bs.map((b) => (b as HTMLElement).getAttribute("title")));
    note("RAIL: " + JSON.stringify(titles));
    // video panel?
    const vp = await page.locator('[data-testid="hub-daily-frame"]').first().boundingBox().catch(() => null);
    note("VIDEO BOX: " + JSON.stringify(vp));
  });
});
