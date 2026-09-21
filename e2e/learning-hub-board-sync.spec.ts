import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";

// Learning Hub whiteboard — call-room behaviour that only shows with a real Daily room:
//   • a family that JOINS LATE, while the tutor is presenting, lands on the board (layout + page + board + permission are re-sent),
//     and is known to the tutor ("In the call") without ever opening the Board tab (the link is mounted when the call starts);
//   • the video tile never covers the board's controls (desktop, iPad landscape / portrait, phone).
// (The pure protocol — spoofed identity, hostile input, rejoin merge, heartbeat — is in board/sync.selftest.ts.)

test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
// (not serial: each test stands alone, so one flaky join on a loaded dev stack does not skip the rest)

const stamp = Date.now().toString(36);
const subject = `BoardSync ${stamp}`;
const childName = `Syncid ${stamp}`;
const lessonTitle = `Board sync ${stamp}`;
let accounts: AccountManifest["accounts"];
let childId = "", lessonId = "";

async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 20 || !(e instanceof TypeError)) throw e; // (a dev API restart under load can take a minute)
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
const setHub = (op: TestAccount, on: boolean) => net(async () => {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
});
const envApi = (() => {
  try { return fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent") {
  const ctx = await browser.newContext({ storageState: statePath(role), permissions: ["camera", "microphone"] });
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
    const t = (await fbSignIn(accounts.freelancer.email)).idToken;
    const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E BoardSync ${stamp}`, price: 0 });
    childId = await createParentChild(accounts.parent, { name: childName });
    await bookViaApi(accounts.parent, listing, { child: childName }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
    await markParentWelcomed(accounts.parent);
    await apiPost("/api/learning-hub/topics", t, { subject, topic: "Fractions" });
    await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
    const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
    const topicId = topics.find((x) => x.subject === subject)!.id;
    const l = await apiPost<{ id: string }>("/api/learning-hub/lessons", t, { title: lessonTitle, topicId, startsAt: new Date(Date.now() + 3 * 60_000).toISOString(), durationMins: 90, childIds: [childId] });
    lessonId = l.id;
  });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

/** Locator.isVisible() does NOT wait (its timeout option is ignored) — on a loaded dev stack that made these helpers skip the provider / child pickers. */
const appears = (l: Locator, timeout: number) => l.waitFor({ state: "visible", timeout }).then(() => true, () => false);

async function gotoHub(page: Page, url: string, who: "tutor" | "family") {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    const shown = await appears(heading.first(), 25_000);
    if (shown && who === "family") {
      // the standing parent has many children (one per spec run): pick THIS run's explicitly, once the picker has rendered
      const provider = page.getByLabel("Provider");
      if (await appears(provider, 10_000)) await provider.selectOption(accounts.freelancer.tenantId!);
      // (Locator.isVisible() does not wait — waitFor does; a parent with a few children gets a radio group instead of a select)
      const select = page.getByRole("combobox", { name: "Child" });
      const radio = page.getByRole("radiogroup", { name: "Child" }).getByRole("radio", { name: childName });
      if (await select.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) await select.selectOption({ label: childName });
      else if (await appears(radio, 10_000)) await radio.click();
      await expect(page.getByText(childName).first()).toBeVisible({ timeout: 20_000 });
    }
    if (shown) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
/** Lobby → Join → the call room. Does NOT open the board. */
async function joinRoom(page: Page, who: "tutor" | "family") {
  if (who === "family") await dismissParentWelcome(page);
  await gotoHub(page, who === "tutor" ? "/freelancer/learninghub" : `/custdash/learninghub?child=${childId}`, who);
  const row = page.locator(`[data-lesson-id="${lessonId}"] [data-action="join"], #hub-next-lesson[data-lesson-id="${lessonId}"] #hub-join-btn`).first();
  // the dev API can be slow while other work hot-reloads it: give the list a generous wait, and one fresh reload
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("tab", { name: /Live lessons/ }).click();
    if (await appears(row, 150_000)) break;
    if (attempt === 0) await gotoHub(page, who === "tutor" ? "/freelancer/learninghub" : `/custdash/learninghub?child=${childId}`, who);
  }
  if (!(await appears(row, 20_000))) {
    await page.screenshot({ path: `/tmp/board-sync-${who}-no-row.png`, fullPage: true }).catch(() => undefined);
    console.log(`[${who}] no join row. Page text: ${(await page.locator("main").innerText().catch(() => "")).slice(0, 1500)}`);
  }
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await page.locator("#hub-lobby-join").click();
  await expect(page.locator("#hub-call-room")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-testid=hub-daily-frame] iframe").waitFor({ state: "attached", timeout: 40_000 }).catch(() => undefined);
}
const boardOf = (page: Page) => page.getByTestId("lesson-board");
const surface = (page: Page) => page.getByTestId("board-surface");
async function openBoardWide(page: Page) {
  await page.locator('#hub-call-room [data-preset="work"]').click();
  await page.getByTestId("hub-workspace").locator('[data-tab="board"]').click();
  await expect(boardOf(page)).toBeVisible({ timeout: 20_000 });
}

test.describe("whiteboard in the call room", () => {
  test("a family joining LATE while the tutor is presenting lands on the board, and the tutor knows they are there", async ({ browser }) => {
    test.setTimeout(900_000);
    const tctx = await ctxFor(browser, "freelancer");
    const fctx = await ctxFor(browser, "parent");
    const tutor = await tctx.newPage(), fam = await fctx.newPage();
    await tutor.setViewportSize({ width: 1280, height: 800 });
    await fam.setViewportSize({ width: 1100, height: 760 });
    await joinRoom(tutor, "tutor");
    await openBoardWide(tutor);
    // the tutor draws, lets everyone write, and presents — all BEFORE the family is in the call
    await tutor.locator('button[data-tool="pen"]:visible').first().click();
    const b = (await surface(tutor).boundingBox())!;
    await tutor.mouse.move(b.x + 300, b.y + 220); await tutor.mouse.down(); await tutor.mouse.move(b.x + 520, b.y + 320, { steps: 20 }); await tutor.mouse.up();
    await expect.poll(async () => Number(await boardOf(tutor).getAttribute("data-elements"))).toBe(1);
    await tutor.getByTestId("board-students-switch").click();
    await tutor.locator('[data-action="allow-all"]').click();
    await tutor.keyboard.press("Escape");
    await tutor.locator('[data-action="present-board-top"]').click();
    await expect(tutor.locator("#hub-call-room")).toHaveAttribute("data-layout", "work");

    // the family joins now and touches NOTHING
    await joinRoom(fam, "family");
    // the tutor's link knows them straight away (the family never opened the Board tab)
    await tutor.getByTestId("board-students-switch").click();
    await expect(tutor.getByTestId("board-students-pop").locator(`[data-student="${childId}"]`)).toContainText("In the call", { timeout: 60_000 });
    await tutor.keyboard.press("Escape");
    // …and their room went to the board on its own, with the tutor's drawing and the write permission
    await expect(fam.locator("#hub-call-room")).toHaveAttribute("data-layout", "work", { timeout: 60_000 });
    await expect(boardOf(fam)).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Number(await boardOf(fam).getAttribute("data-elements")), { timeout: 60_000 }).toBe(1);
    await expect(fam.getByTestId("board-write-status").first()).toContainText("You can write", { timeout: 30_000 });
    await tctx.close(); await fctx.close();
  });

  for (const vp of [{ name: "laptop", w: 1280, h: 800 }, { name: "iPad landscape", w: 1024, h: 768 }, { name: "iPad portrait", w: 820, h: 1180 }, { name: "phone", w: 390, h: 844 }]) {
    test(`the video tile never covers the board's controls — ${vp.name} ${vp.w}x${vp.h}`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await ctxFor(browser, "freelancer");
      const page = await ctx.newPage();
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await joinRoom(page, "tutor");
      // "Workspace only": the video becomes a tile
      await page.locator('#hub-call-room [data-preset="work"]').click().catch(async () => {
        // narrow rooms hide the preset row's labels but the buttons stay; if it is not reachable, the phone nav opens the board
        await page.locator('[data-open-tab="board"]').click();
      });
      await page.getByTestId("hub-workspace").locator('[data-tab="board"]').click();
      await expect(boardOf(page)).toBeVisible({ timeout: 20_000 });
      const pane = page.getByTestId("hub-video-pane");
      await expect(pane).toBeVisible();
      await page.waitForTimeout(1200); // let the tile settle (the free spot is re-checked every 400 ms)
      const overlap = await page.evaluate(() => {
        const tile = document.querySelector('[data-testid="hub-video-pane"]')!.getBoundingClientRect();
        const hits: string[] = [];
        document.querySelectorAll<HTMLElement>('[data-board-avoid], [data-testid="board-tools"] button, [data-testid="board-options"] button').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          if (r.left < tile.right && r.right > tile.left && r.top < tile.bottom && r.bottom > tile.top) hits.push(el.getAttribute("data-testid") ?? el.getAttribute("data-tool") ?? el.className.slice(0, 40));
        });
        return { hits, docked: document.querySelector('[data-testid="hub-video-pane"]')!.getAttribute("data-tile-docked") };
      });
      expect(overlap.hits, `tile (docked=${overlap.docked}) overlaps: ${overlap.hits.join(", ")}`).toEqual([]);
      // and no tool button has the VIDEO on top of it (a tool scrolled out of its own tray is a different matter)
      await page.screenshot({ path: `/tmp/board-sync-tile-${vp.w}x${vp.h}.png` }).catch(() => undefined);
      const blocked = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll<HTMLElement>('[data-testid="board-tools"] button[data-tool], [data-testid="board-options"] button, [data-board-avoid] button').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
          const top = document.elementFromPoint(cx, cy);
          if (top && top.closest('[data-testid="hub-video-pane"]')) bad.push(el.getAttribute("data-tool") ?? el.getAttribute("aria-label") ?? "?");
        });
        return bad;
      });
      expect(blocked, `covered by the video: ${blocked.join(",")}`).toEqual([]);
      await ctx.close();
    });
  }

  test("phone room: the workspace gets most of the screen by default, nothing is clipped by its edge, toolbar buttons are >= 44px", async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await joinRoom(page, "tutor");
    const ws = page.getByTestId("ws-pane");
    await expect(ws).toBeVisible({ timeout: 30_000 }); // opens by itself: no hunting for the bottom nav
    await page.waitForTimeout(800);
    await page.screenshot({ path: "/tmp/board-sync-phone-room.png" }).catch(() => undefined);
    const m = await page.evaluate(() => {
      const pane = document.querySelector('[data-testid="ws-pane"]')!.getBoundingClientRect();
      const main = pane.height + document.querySelector('[data-testid="hub-video-pane"]')!.getBoundingClientRect().height;
      const clipped: string[] = [];
      document.querySelectorAll<HTMLElement>('[data-testid="ws-pane"] button, [data-testid="ws-pane"] a').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.top >= pane.bottom || r.bottom <= pane.top) return;
        if (el.closest('[role="tablist"]')) return; // a scrollable tab strip is meant to run past the edge
        if (r.right > pane.right + 1 || r.left < pane.left - 1) clipped.push((el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30));
      });
      const small: string[] = [];
      document.querySelectorAll<HTMLElement>("#hub-call-room header button").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4) return;
        if (r.width < 43.5 || r.height < 43.5) small.push(`${(el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.textContent ?? "").trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return { share: pane.height / main, paneH: pane.height, clipped, small };
    });
    expect(m.share, `workspace is ${Math.round(m.paneH)}px tall (${Math.round(m.share * 100)}% of the stage)`).toBeGreaterThan(0.55);
    expect(m.paneH).toBeGreaterThan(330);
    expect(m.clipped, `clipped by the pane edge: ${m.clipped.join(", ")}`).toEqual([]);
    expect(m.small, `under 44px: ${m.small.join(", ")}`).toEqual([]);
    await ctx.close();
  });
});
