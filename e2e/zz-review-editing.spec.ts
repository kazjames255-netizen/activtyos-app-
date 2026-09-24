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

const stamp = Date.now().toString(36);
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

const SHOTS = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/2237c9d9-5a2d-4908-8f3e-b7f7a9c5c1f2/scratchpad/review-editing";
const snap = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const log = (...a: unknown[]) => { const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "); console.log("REVIEW: " + s); fs.appendFileSync(path.join(SHOTS, "log.txt"), s + "\n"); };

async function hook(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="board-surface"]') as HTMLElement;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"))!;
    let f = (el as unknown as Record<string, { return: unknown; memoizedProps: { ctrl?: unknown } }>)[key] as { return: unknown; memoizedProps: { ctrl?: unknown } } | null;
    while (f) { if (f.memoizedProps?.ctrl) { (window as unknown as { __c: unknown }).__c = f.memoizedProps.ctrl; break; } f = f.return as typeof f; }
  });
}
/** Evaluate against the controller; fn receives (ctrl, arg). */
async function C<T>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(([f, a]) => { const c = (window as unknown as { __c: unknown }).__c; return (new Function("c", "a", `return (${f})(c,a)`))(c, a); }, [fn, arg] as [string, unknown]) as Promise<T>;
}
const w2s = async (page: Page, x: number, y: number) => { const b = (await surface(page).boundingBox())!; const v = await C<{ x: number; y: number; k: number }>(page, "c=>c.view"); return { x: b.x + v.x + x * v.k, y: b.y + v.y + y * v.k }; };
async function dragW(page: Page, from: [number, number], to: [number, number], o: { shift?: boolean; steps?: number } = {}) {
  const a = await w2s(page, ...from), b = await w2s(page, ...to);
  if (o.shift) await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: o.steps ?? 10 }); await page.mouse.up();
  if (o.shift) await page.keyboard.up("Shift");
}
async function clickW(page: Page, x: number, y: number, o: { shift?: boolean; button?: "left" | "right"; count?: number } = {}) {
  const a = await w2s(page, x, y);
  if (o.shift) await page.keyboard.down("Shift");
  await page.mouse.click(a.x, a.y, { button: o.button ?? "left", clickCount: o.count ?? 1, delay: 20 });
  if (o.shift) await page.keyboard.up("Shift");
}
const state = (page: Page) => C<{ n: number; sel: string[]; k: number; page: string; tool: string; els: { id: string; k: string; shape?: string; stamp?: string; x?: number; y?: number; w?: number; h?: number; x1?: number; y1?: number; x2?: number; y2?: number; text?: string; z: number; rot?: number; grp?: string; size?: number; bold?: boolean }[] }>(page,
  "c=>({n:c.curPage.els.size,sel:[...c.selection],k:c.view.k,page:c.page,tool:c.ui.tool,els:[...c.curPage.els.values()].map(e=>({id:e.id,k:e.k,shape:e.shape,stamp:e.stamp,x:e.x,y:e.y,w:e.w,h:e.h,x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2,text:e.text,z:e.z,rot:e.rot,grp:e.grp,size:e.size,bold:e.bold}))})");

test.describe("review editing", () => {
  test("smoke", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
    await hook(page);
    await snap(page, "00-empty");
    log("state", await state(page));
  });
});
