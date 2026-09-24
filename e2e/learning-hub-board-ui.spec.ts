import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
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
      if (i >= 20 || !(e instanceof TypeError)) throw e; // (a dev API restart under load can take a minute)
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

/** Locator.isVisible() does NOT wait (its timeout option is ignored) — on a loaded dev stack that made this helper skip the provider / child pickers. */
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
      // (a parent with a few children gets a radio group instead of a select)
      const select = page.getByRole("combobox", { name: "Child" });
      const radio = page.getByRole("radiogroup", { name: "Child" }).getByRole("radio", { name: childName });
      if (await appears(select, 20_000)) await select.selectOption({ label: childName });
      else if (await appears(radio, 10_000)) await radio.click();
      await expect(page.getByText(childName).first()).toBeVisible({ timeout: 20_000 });
    }
    if (shown) return;
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
/** The video tile docks beside the workspace (and the board reflows to a smaller pane) when the tool options change what it has to keep clear of:
 *  wait until the surface has stopped resizing (the tile re-checks its free spot every 400 ms) before measuring anything. */
async function settle(page: Page) {
  let last = "", still = 0;
  for (let i = 0; i < 40 && still < 4; i++) {
    const b = await surface(page).boundingBox();
    const k = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}` : "";
    still = k === last ? still + 1 : 0; last = k;
    await page.waitForTimeout(400);
  }
}
/** drag in FRACTIONS of the surface (the pane's size depends on whether the video tile is floating or docked) */
async function dragF(page: Page, from: [number, number], to: [number, number], steps = 12) {
  const b = (await surface(page).boundingBox())!;
  await drag(page, [from[0] * b.width, from[1] * b.height], [to[0] * b.width, to[1] * b.height], steps);
}
const elements = async (page: Page) => Number(await boardOf(page).getAttribute("data-elements"));

test.describe("the whiteboard", () => {
  test("the tutor draws, it autosaves and survives a reload, and can be saved to the lesson notes", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
    await expect(page.getByTestId("board-tools").first()).toBeVisible();
    await expect(tool(page, "pen")).toBeVisible();
    await shot(page, "01-empty-board");

    // pen
    await tool(page, "pen").click();
    await settle(page);
    await dragF(page, [0.2, 0.4], [0.5, 0.6], 20);
    await expect.poll(() => elements(page)).toBe(1);
    // a rectangle and text
    await tool(page, "shapes").click();
    await page.locator('[data-shape="rect"]').click();
    await settle(page);
    await dragF(page, [0.15, 0.6], [0.35, 0.8]);
    await expect.poll(() => elements(page)).toBe(2);
    await tool(page, "text").click();
    await settle(page);
    const b = (await surface(page).boundingBox())!;
    await page.mouse.click(b.x + b.width * 0.55, b.y + b.height * 0.4); // clear of the top bar and of the video tile
    await page.getByTestId("board-text-input").fill("3/4 + 1/8 = 7/8");
    await page.keyboard.press("Control+Enter");
    await expect.poll(() => elements(page)).toBe(3);
    // undo / redo
    await page.locator('[data-action="undo"]').click();
    await expect.poll(() => elements(page)).toBe(2);
    await page.locator('[data-action="redo"]').click();
    await expect.poll(() => elements(page)).toBe(3);
    // a teaching aid: a fraction bar
    await tool(page, "insert").click();
    await page.getByTestId("board-toolkit").locator('[data-pack="maths"]').click();
    await page.getByTestId("board-toolkit").locator('[data-item="m-fractions"]').click();
    await expect.poll(() => elements(page)).toBe(4);
    await shot(page, "02-drawn");

    // autosave → reload → still there
    await expect(page.getByTestId("board-save-status").first()).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
    const saved = await apiFetch<{ pages: { elements: unknown[] }[] }>(`/api/learning-hub/lessons/${lessonId}/board`, await token(accounts.freelancer));
    expect(saved.pages[0]!.elements.length).toBe(4);
    await page.reload();
    await enterBoard(page, "tutor");
    await expect.poll(() => elements(page), { timeout: 20_000 }).toBe(4);

    // Save to lesson notes → a note attached to the lesson, with the picture
    await page.getByTestId("board-more").click();
    await page.locator('[data-action="save-notes"]').click();
    await expect(page.getByTestId("board-toast")).toContainText(/Saved to your lessons/, { timeout: 60_000 });
    const t = await token(accounts.freelancer);
    const lessons = await apiFetch<{ id: string; noteIds: string[] }[]>("/api/learning-hub/lessons", t);
    const mine = lessons.find((l) => l.id === lessonId)!;
    const notes = await apiFetch<{ id: string; title: string; attachments: { contentType: string }[] }[]>("/api/learning-hub/notes", t);
    const note = notes.find((n) => mine.noteIds.includes(n.id) && n.title.startsWith("Board — "));
    expect(note?.title).toContain(lessonTitle);
    expect(note?.attachments[0]?.contentType).toMatch(/^image\//);
    await ctx.close();
  });

  test("live: the family sees the tutor's drawing, is read-only until allowed, and its private page reaches only the tutor", async ({ browser }) => {
    test.setTimeout(360_000);
    const tctx = await ctxFor(browser, "freelancer");
    const fctx = await ctxFor(browser, "parent");
    const tutor = await tctx.newPage(), fam = await fctx.newPage();
    await tutor.setViewportSize({ width: 1280, height: 800 });
    await fam.setViewportSize({ width: 1100, height: 760 });
    await enterBoard(tutor, "tutor");
    await enterBoard(fam, "family");
    await expect(boardOf(fam)).toHaveAttribute("data-can-draw", "0");
    await expect(fam.getByTestId("board-write-status").first()).toContainText("Tutor is drawing");

    // (the lesson's board is shared with the first test, which left its own drawings on it: count relative to what is already there)
    await expect.poll(() => elements(fam), { timeout: 60_000 }).toBe(await elements(tutor));
    const base = await elements(tutor);
    // the tutor draws: the family sees it live (peers must have found each other through Daily)
    await tool(tutor, "pen").click();
    await settle(tutor);
    await dragF(tutor, [0.3, 0.45], [0.55, 0.7], 24);
    await expect.poll(() => elements(fam), { timeout: 60_000 }).toBe(base + 1);
    await shot(fam, "10-family-watching");
    // the student can't draw: a drag on the family's board changes nothing
    await settle(fam);
    await dragF(fam, [0.3, 0.5], [0.5, 0.7]);
    await expect.poll(() => elements(fam)).toBe(base + 1);

    // the tutor lets THIS student write (per-student switch)
    await tutor.getByTestId("board-students-switch").click();
    await expect(tutor.getByTestId("board-students-pop")).toBeVisible();
    await shot(tutor, "11-students-picker");
    await tutor.locator(`[data-switch="${childId}"]`).click();
    await expect(fam.getByTestId("board-write-status").first()).toContainText("You can write", { timeout: 30_000 });
    await expect(boardOf(fam)).toHaveAttribute("data-can-draw", "1");
    await tutor.keyboard.press("Escape");
    await tool(fam, "pen").click();
    await settle(fam);
    await dragF(fam, [0.3, 0.55], [0.55, 0.75], 16);
    await expect.poll(() => elements(fam)).toBe(base + 2);
    await expect.poll(() => elements(tutor), { timeout: 60_000 }).toBe(base + 2);
    // …and the tutor takes control back: the family is read-only again
    await tutor.getByTestId("board-students-switch").click();
    await tutor.locator('[data-action="allow-none"]').click();
    await expect(boardOf(fam)).toHaveAttribute("data-can-draw", "0", { timeout: 30_000 });
    await tutor.keyboard.press("Escape");

    // ── the student's private page ──
    await fam.locator('[data-view-tab="work"]').click();
    await expect(fam.getByTestId("pad-board")).toBeVisible();
    await tool(fam, "pen").click();
    await settle(fam);
    await dragF(fam, [0.3, 0.5], [0.6, 0.7], 20);
    await expect.poll(async () => Number(await fam.getByTestId("pad-board").getAttribute("data-elements"))).toBe(1);
    await tutor.locator('[data-view-tab="work"]').click();
    const tile = tutor.locator(`[data-testid="pad-tile"][data-student="${childId}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => tile.getAttribute("data-done")).toBe("0");
    await shot(tutor, "12-student-work");
    // Set a question: it lands at the top of the student's page
    await tutor.locator('[data-action="set-question"]').click();
    await tutor.getByTestId("question-text").fill("What is 3/4 + 1/8?");
    await tutor.locator('[data-action="send-question"]').click();
    await expect.poll(async () => Number(await fam.getByTestId("pad-board").getAttribute("data-elements")), { timeout: 60_000 }).toBe(2);
    await shot(fam, "13-family-workings");
    // the student presses Done: the tutor sees the tick
    await fam.locator('[data-action="pad-done"]').click();
    await expect(tile).toHaveAttribute("data-done", "1", { timeout: 30_000 });
    // the tutor opens the page, marks over it, and shows it to the class
    await tile.locator('button[data-action="open-pad"]').first().click();
    await expect(tutor.getByTestId("pad-board")).toHaveAttribute("data-role", "tutor");
    await expect.poll(async () => Number(await tutor.getByTestId("pad-board").getAttribute("data-elements"))).toBe(2);
    await tool(tutor, "pen").click();
    await settle(tutor);
    await dragF(tutor, [0.3, 0.5], [0.55, 0.7], 12);
    await expect.poll(async () => Number(await fam.getByTestId("pad-board").getAttribute("data-elements")), { timeout: 60_000 }).toBe(3);
    await shot(tutor, "14-tutor-marking");
    await tutor.locator('[data-action="show-to-class"]').first().click();
    await expect(boardOf(tutor)).toHaveAttribute("data-view", "board");
    await fam.locator('[data-view-tab="board"]').click();
    await expect.poll(() => fam.locator('[data-testid="board-pages"] [role="tab"]').count(), { timeout: 60_000 }).toBe(2);
    await shot(fam, "15-family-shown-page");
    await tctx.close(); await fctx.close();
  });

  test("the toolkit: a template from every subject pack, in Early / Standard / Advanced style", async ({ browser }) => {
    test.setTimeout(process.env.BOARD_N ? 200_000 : 1_500_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
    const examples: [string, Level, string, string][] = [
      ["english", "early", "e-phonics", "20-ks1-phonics"], ["english", "early", "e-mountain", "21-ks2-story-mountain"],
      ["languages", "standard", "l-conj", "22-ks3-french-conjugation"], ["science", "advanced", "s-bohr", "23-ks4-bohr-atom"],
      ["maths", "advanced", "m-plot", "24-ks5-graph-plot"], ["geography", "standard", "geo-grid4", "25-geography-grid-reference"],
      ["geography", "standard", "geo-map", "26-geography-outline-map"], ["history", "standard", "h-timeline", "27-history-timeline"],
      ["science", "advanced", "s-periodic", "28-chemistry-periodic-table"], ["science", "advanced", "s-circuit-set", "29-physics-circuit-symbols"],
      ["science", "standard", "s-apparatus-all", "30-chemistry-apparatus"], ["general", "standard", "g-mind", "31-general-mind-map"],
      ["english", "advanced", "e-peel", "32-english-peel"], ["geography", "advanced", "geo-climate", "33-geography-climate-graph"],
    ];
    for (const [pack, level, item, name] of examples.slice(0, Number(process.env.BOARD_N ?? examples.length))) {
      // The shared dev stack hot-reloads (other people saving files): if the call room was reset, walk back in and carry on.
      for (let attempt = 0; ; attempt++) {
        try {
          if (!(await boardOf(page).isVisible().catch(() => false))) await enterBoard(page, "tutor");
          await page.locator('[data-action="add-page"]').click();
          await tool(page, "insert").click();
          const pop = page.getByTestId("board-toolkit");
          await expect(pop).toBeVisible();
          await pop.locator(`[data-pack="${pack}"]`).click();
          await pop.locator(`[data-level="${level}"]`).click();
          await pop.getByLabel("Show items for every style").check();
          await pop.locator(`[data-item="${item}"]`).click();
          if (await pop.getByTestId("toolkit-form").isVisible().catch(() => false)) await pop.locator('[data-action="place-template"]').click();
          await expect.poll(() => elements(page), { timeout: 15_000 }).toBeGreaterThan(0);
          await page.getByTestId("board-more").click();
          await page.getByRole("menuitem", { name: /Fit the view/ }).click();
          await page.waitForTimeout(600);
          await shot(page, name);
          break;
        } catch (e) { if (attempt >= 2) throw e; await page.waitForTimeout(3000); }
      }
    }
    // the accent palette types into the text being edited
    await page.locator('[data-action="add-page"]').click();
    await tool(page, "text").click();
    const b = (await surface(page).boundingBox())!;
    await page.mouse.click(b.x + 400, b.y + 300);
    await tool(page, "insert").click();
    await page.getByTestId("board-toolkit").locator('[data-pack="languages"]').click();
    await page.getByTestId("board-toolkit").locator('[data-mode="chars"]').click();
    await page.getByRole("button", { name: "Insert é" }).first().click();
    await page.getByRole("button", { name: "Insert ç" }).first().click();
    await expect(page.getByTestId("board-text-input")).toHaveValue("éç");
    await ctx.close();
  });

  test("text and sticky notes: click → type → visible; click-away and Esc commit; drag moves; double-click edits; undo removes", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    // a roomy window: at 1280x800 picking a tool with a wide options bar makes the video tile dock, and the board then reflows to a phone-sized pane
    // (a different thing to test) — these tests use fixed positions on the board
    await page.setViewportSize({ width: 1600, height: 1000 });
    await enterBoard(page, "tutor");
    // the lesson's board is shared by the tests in this file: work on a clean page of our own
    await page.locator('[data-action="add-page"]').click();
    await expect.poll(() => elements(page)).toBe(0);
    const b = (await surface(page).boundingBox())!;
    const input = page.getByTestId("board-text-input");

    // Text tool: the tool switches, a click opens a focused box, typing works, clicking away commits
    await tool(page, "text").click();
    await expect(tool(page, "text")).toHaveAttribute("aria-pressed", "true");
    await page.mouse.click(b.x + 380, b.y + 260);
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.type("Hello board 3/4");
    await expect(input).toHaveValue("Hello board 3/4");
    await page.mouse.click(b.x + 600, b.y + 120); // click away (opens a new empty box, committing the first)
    await expect.poll(() => elements(page)).toBe(1);
    await page.keyboard.press("Escape");           // Esc commits/cancels the empty second box
    await expect(input).toHaveCount(0);
    await expect.poll(() => elements(page)).toBe(1);
    await shot(page, "40-text-tool");

    // …Esc commits typed text
    await tool(page, "text").click();
    await page.mouse.click(b.x + 380, b.y + 380);
    await expect(input).toBeFocused();
    await page.keyboard.type("Second line");
    await page.keyboard.press("Escape");
    await expect.poll(() => elements(page)).toBe(2);

    // Sticky note: click → typeable note
    await tool(page, "sticky").click();
    await page.mouse.click(b.x + 520, b.y + 150); // (the floating video tile sits bottom-right: stay clear of it)
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.type("Remember the fractions");
    await page.keyboard.press("Control+Enter");
    await expect.poll(() => elements(page)).toBe(3);
    await shot(page, "41-sticky");

    // drag the sticky with the select tool (it is centred ~ (700,300))
    await tool(page, "select").click();
    const before = await page.evaluate(() => document.querySelector('[data-testid="lesson-board"]')?.getAttribute("data-elements"));
    await drag(page, [520, 150], [430, 260], 10);
    // double-click a text to edit it
    await shot(page, "42-before-dblclick");
    await page.mouse.dblclick(b.x + 400, b.y + 395); // "Second line" (clear of the moved sticky)
    await shot(page, "43-after-dblclick");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("Second line");
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await page.keyboard.press("Escape");
    expect(before).toBe("3");
    await expect.poll(() => elements(page)).toBe(3);

    // undo removes the last thing added / edits step back
    await page.locator('[data-action="undo"]').click(); // the edit
    await page.locator('[data-action="undo"]').click(); // the move
    await page.locator('[data-action="undo"]').click(); // the sticky
    await expect.poll(() => elements(page)).toBe(2);

    // a touch / pen tap opens the box too
    await tool(page, "text").click();
    await surface(page).dispatchEvent("pointerdown", { pointerId: 7, pointerType: "pen", clientX: b.x + 500, clientY: b.y + 440, pressure: 0.5, button: 0, buttons: 1, isPrimary: true, bubbles: true });
    await surface(page).dispatchEvent("pointerup", { pointerId: 7, pointerType: "pen", clientX: b.x + 500, clientY: b.y + 440, pressure: 0, button: 0, buttons: 0, isPrimary: true, bubbles: true });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await ctx.close();
  });
  test("more tools: shapes (star, speech bubble), pen styles, and the classroom widgets (dice, spinner, score counter)", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    // a roomy window: at 1280x800 picking a tool with a wide options bar makes the video tile dock, and the board then reflows to a phone-sized pane
    // (a different thing to test) — these tests use fixed positions on the board
    await page.setViewportSize({ width: 1600, height: 1000 });
    await enterBoard(page, "tutor");
    // a clean page of our own, so every count below is this run's
    await page.locator('[data-action="add-page"]').click();
    await expect.poll(() => elements(page)).toBe(0);
    type SavedBoard = { pages: { elements: { k: string; shape?: string; sty?: string; stamp?: string; opts?: Record<string, number | string> }[] }[] };
    const saved = async () => (await apiFetch<SavedBoard>(`/api/learning-hub/lessons/${lessonId}/board`, await token(accounts.freelancer))).pages.flatMap((pg) => pg.elements);

    // shapes: the popover offers the new ones; a star and a speech bubble each draw as ONE element
    await tool(page, "shapes").click();
    const shapes = page.getByTestId("board-shapes");
    for (const k of ["star", "hexagon", "heart", "bubble", "diamond", "pentagon", "rtriangle", "darrow"]) await expect(shapes.locator(`[data-shape="${k}"]`)).toBeVisible();
    await shapes.locator('[data-shape="star"]').click();
    await drag(page, [230, 120], [380, 260]);
    await expect.poll(() => elements(page)).toBe(1);
    await tool(page, "shapes").click();
    await page.getByTestId("board-shapes").locator('[data-shape="bubble"]').click();
    await page.locator('[data-action="dashed"]:visible').first().dispatchEvent("click"); // (the floating video panel can sit over the far end of the options bar) // dashed outline is offered for closed shapes
    await drag(page, [430, 120], [600, 250]);
    await expect.poll(() => elements(page)).toBe(2);

    // pen styles: neon + rainbow strokes keep their look
    await tool(page, "pen").click();
    await page.locator('[data-pen-style="neon"]:visible').first().dispatchEvent("click"); // (the floating video panel can sit over the far end of the options bar)
    await drag(page, [230, 320], [420, 380], 16);
    await page.locator('[data-pen-style="rainbow"]:visible').first().dispatchEvent("click"); // (the floating video panel can sit over the far end of the options bar)
    await drag(page, [230, 420], [420, 470], 16);
    await expect.poll(() => elements(page)).toBe(4);
    await shot(page, "50-shapes-and-pens");

    // classroom widgets from the General toolkit: place, then click to operate
    const centre = async () => { const b = (await surface(page).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    for (const [item, stamp, ready] of [["g-dice", "dice", (o?: Record<string, number | string>) => Number(o?.rolls) >= 1], ["g-spinner", "spinner", (o?: Record<string, number | string>) => Number(o?.spin) >= 360 && Number(o?.pick) >= 0], ["g-tally", "tally", (o?: Record<string, number | string>) => Number(o?.n) === 1]] as const) {
      await tool(page, "insert").click();
      const pop = page.getByTestId("board-toolkit");
      await pop.locator('[data-pack="general"]').click();
      await pop.locator(`[data-item="${item}"]`).click();
      await pop.locator('[data-action="place-template"]').click();
      const before = await elements(page);
      const c = await centre();
      await page.mouse.click(c.x, c.y); // a click (no drag) on the widget at the middle of the view
      await shot(page, `51-${stamp}`);
      await expect.poll(async () => ready((await saved()).find((e) => e.stamp === stamp)?.opts), { timeout: 45_000, message: `${stamp} state saved after the click` }).toBe(true);
      expect(await elements(page)).toBe(before);
    }

    // shapes + pen styles reached the saved copy (the server did not strip the new fields)
    const all = await saved();
    expect(all.some((e) => e.k === "shape" && e.shape === "star")).toBe(true);
    expect(all.some((e) => e.k === "shape" && e.shape === "bubble")).toBe(true);
    expect(all.some((e) => e.k === "stroke" && e.sty === "neon")).toBe(true);
    expect(all.some((e) => e.k === "stroke" && e.sty === "rainbow")).toBe(true);
    await ctx.close();
  });
});
