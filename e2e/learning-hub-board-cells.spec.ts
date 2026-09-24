import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";
import { openTab } from "./helpers/hubTabs";

type Level = "early" | "standard" | "advanced";

// Learning Hub — whiteboard editing core: templates are typeable cells (the population pyramid is not an
// empty box), the new element fields survive the server's schema, keyboard shortcuts keep working after
// a toolbar click, the eraser leaves templates alone by default, and a template scales / ungroups.
//
// Headless Chromium runs with fake camera/microphone devices so Daily's prebuilt frame can join.

test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Cells ${stamp}`;
const childName = `Cellkid ${stamp}`;
const lessonTitle = `Cells lesson ${stamp}`;
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
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Cells ${stamp}`, price: 0 });
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


interface SavedEl { id: string; k: string; shape?: string; text?: string; cell?: boolean; fa?: number; ns?: boolean; n?: number; grp?: string; x1?: number; x2?: number; y1?: number; y2?: number; dash?: boolean }
async function savedElements(): Promise<SavedEl[]> {
  const t = await token(accounts.freelancer);
  const b = await net(() => apiFetch<{ pages: { elements: SavedEl[] }[] }>(`/api/learning-hub/lessons/${lessonId}/board`, t));
  return b.pages.flatMap((p) => p.elements);
}

interface SavedPageRow { id: string; background: string; elements: SavedEl[] }
async function savedPages(): Promise<SavedPageRow[]> {
  const t = await token(accounts.freelancer);
  return (await net(() => apiFetch<{ pages: SavedPageRow[] }>(`/api/learning-hub/lessons/${lessonId}/board`, t))).pages;
}
const savedState = (page: Page) => expect(page.getByTestId("board-save-status").first()).toHaveAttribute("data-state", "saved", { timeout: 45_000 });

// (first in the file: it needs the lesson's board UNTOUCHED — every lesson gets a blank board with nothing to set up)
test.describe("whiteboard: blank board per lesson, tables and subject frames", () => {
  test("a new lesson's Board tab is a blank board ready to draw; a table grows and shrinks by row / column and its cells are typeable; subject frames become the page background", async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");

    // ── a blank board exists for the lesson without any setup: one blank page, nothing on it, the tutor can draw straight away
    await expect(boardOf(page)).toHaveAttribute("data-can-draw", "1");
    expect(await elements(page)).toBe(0);
    await savedState(page);
    const fresh = await savedPages();
    expect(fresh.length).toBe(1); expect(fresh[0]!.background).toBe("blank"); expect(fresh[0]!.elements.length).toBe(0);
    await tool(page, "pen").click();
    await drag(page, [200, 150], [330, 210]);
    await expect.poll(() => elements(page)).toBe(1);
    await expect.poll(async () => (await savedPages())[0]!.elements.length, { timeout: 45_000 }).toBe(1);

    // ── a table: 2 columns × (heading + 2 rows) from the General pack
    await page.locator('[data-action="add-page"]').click();
    await expect.poll(() => elements(page)).toBe(0);
    await tool(page, "insert").click();
    const pop = page.getByTestId("board-toolkit");
    await pop.locator('[data-pack="general"]').click();
    await pop.locator('[data-item="g-table"]').click();
    await pop.getByLabel("Columns", { exact: true }).fill("2");
    await pop.getByLabel("Rows", { exact: true }).fill("2");
    await pop.locator('[data-action="place-template"]').click();
    await expect.poll(() => elements(page), { timeout: 15_000 }).toBe(6);
    const opts = page.getByTestId("table-options").locator("visible=true").first();
    await expect(opts).toHaveAttribute("data-rows", "3");
    await expect(opts).toHaveAttribute("data-cols", "2");
    await page.locator('[data-action="table-add-row"]:visible').first().click();
    await expect.poll(() => elements(page)).toBe(8);
    await expect(opts).toHaveAttribute("data-rows", "4");
    await page.locator('[data-action="table-add-col"]:visible').first().click();
    await expect.poll(() => elements(page)).toBe(12);
    await expect(opts).toHaveAttribute("data-cols", "3");
    await page.locator('[data-action="table-remove-col"]:visible').first().click();
    await expect.poll(() => elements(page)).toBe(8);
    await page.locator('[data-action="table-remove-row"]:visible').first().click();
    await expect.poll(() => elements(page)).toBe(6);
    // …every cell is typeable: the table is centred in the view, so a double-click just LEFT of the middle lands in a body cell (right of it the floating video tile, bottom-right, sits over the table)
    const run = `Tbl${stamp}`;
    const b = (await surface(page).boundingBox())!;
    await tool(page, "select").click();
    await page.mouse.dblclick(b.x + b.width / 2 - 40, b.y + b.height / 2);
    const input = page.getByTestId("board-text-input");
    await expect(input).toBeVisible();
    await page.keyboard.type(run);
    await page.keyboard.press("Escape");
    await expect(input).toHaveCount(0);
    expect(await elements(page)).toBe(6);
    await savedState(page);
    await expect.poll(async () => (await savedElements()).find((e) => e.text === run)?.cell ?? false, { timeout: 45_000 }).toBe(true);
    expect((await savedElements()).filter((e) => e.cell && e.grp).length).toBeGreaterThanOrEqual(6);

    // ── subject frames: a Science diagram frame from the toolkit, then a Languages vocabulary grid and an English story map from the background menu
    const pageId = await boardOf(page).getAttribute("data-page");
    const bgOf = async () => (await savedPages()).find((p) => p.id === pageId)?.background ?? "";
    await tool(page, "insert").click();
    await pop.locator('[data-pack="science"]').click();
    await pop.locator('[data-item="s-diagram"]').click();
    await expect.poll(bgOf, { timeout: 45_000 }).toBe("diagram");
    for (const bg of ["vocab", "storymap", "graph"]) {
      await page.getByTestId("board-more").click();
      await page.locator(`[data-bg="${bg}"]`).click();
      await page.keyboard.press("Escape");
      await expect.poll(bgOf, { timeout: 45_000 }).toBe(bg);
    }
    expect(await elements(page)).toBe(6); // a frame is background: it adds nothing that could be moved or rubbed out
    await ctx.close();
  });
});

test.describe("whiteboard: typeable templates and editing", () => {
  test("the pyramid is typeable cells: double-click, type, it saves with the cell fields; Tab moves on; keyboard shortcuts survive a toolbar click; the eraser spares the template", async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
    await page.locator('[data-action="add-page"]').click();
    await expect.poll(() => elements(page)).toBe(0);
    const run = `Cell${stamp}`;

    // place the population pyramid from the Geography pack (Standard style), with its default example numbers
    await tool(page, "insert").click();
    const pop = page.getByTestId("board-toolkit");
    await pop.locator('[data-pack="geography"]').click();
    await pop.locator('[data-level="standard"]').click();
    await pop.locator('[data-item="geo-pyramid"]').click();
    await pop.locator('[data-action="place-template"]').click();
    await expect.poll(() => elements(page), { timeout: 15_000 }).toBeGreaterThan(60);
    const placed = await elements(page);
    await page.getByTestId("board-more").click();
    await page.getByRole("menuitem", { name: /Fit the view/ }).click();
    await page.waitForTimeout(500);
    await shot(page, "50-pyramid");

    // a template's colours are deliberate: the whole-template selection offers no colour swatches, but does offer Ungroup
    await expect(page.locator('[data-action="ungroup"]:visible').first()).toBeVisible();

    // double-click a cell of the pyramid: it opens for typing
    await tool(page, "select").click();
    await settle(page);
    // the view was just fitted, so the pyramid's bottom male bar (the 0–4 band) sits at a known spot in the surface (43 % across, 73 % down),
    // clear of the floating video tile: double-click inside it
    const b = (await surface(page).boundingBox())!;
    await page.mouse.dblclick(b.x + b.width * 0.434, b.y + b.height * 0.729);
    const input = page.getByTestId("board-text-input");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A"); // (on macOS Ctrl+A in a text box means "start of line", which prepended the words to the example number)
    await page.keyboard.type(run);
    // Tab saves this cell and opens the next one in the same template
    await page.keyboard.press("Tab");
    await expect(input).toBeVisible();
    await expect(input).not.toHaveValue(run);
    await page.keyboard.press("Escape");
    await expect(input).toHaveCount(0);
    expect(await elements(page)).toBe(placed);

    // …the words are saved ON the cell, and the new element fields survive the server's schema
    await expect(page.getByTestId("board-save-status").first()).toHaveAttribute("data-state", "saved", { timeout: 45_000 }); // (the pill says why if it is "error"; the pill is rendered once per layout, wide + phone)
    await expect.poll(async () => (await savedElements()).find((e) => e.text === run)?.id ?? "", { timeout: 45_000 }).not.toBe("");
    const saved = await savedElements();
    const mine = saved.find((e) => e.text === run)!;
    expect(mine.k).toBe("shape"); expect(mine.shape).toBe("rect"); expect(mine.cell).toBe(true); expect(mine.grp).toBeTruthy();
    expect(saved.some((e) => e.cell && e.fa === 1 && e.k === "shape")).toBe(true);   // solid bars
    expect(saved.some((e) => e.cell && e.ns === true)).toBe(true);                    // borderless age labels

    // keyboard shortcuts keep working after a toolbar click (they used to die until you clicked the canvas again)
    await tool(page, "pen").click();
    await drag(page, [200, 150], [330, 210]);
    await expect.poll(() => elements(page)).toBe(placed + 1);
    await tool(page, "select").click();           // focus is now on a toolbar button
    await page.keyboard.press("Control+z");        // …and Ctrl+Z still undoes
    await expect.poll(() => elements(page)).toBe(placed);

    // the eraser rubs out drawings only by default: sweeping it across the template removes nothing
    await tool(page, "eraser").click();
    await expect(page.locator('[data-eraser-mode="ink"]:visible').first()).toHaveAttribute("aria-pressed", "true");
    await settle(page);
    await dragF(page, [0.25, 0.55], [0.75, 0.55], 25);
    expect(await elements(page)).toBe(placed);

    // a regular polygon: 6 sides, saved with its side count
    await page.locator('button[data-tool="shapes"]:visible').first().click();
    await page.locator('[data-shape="ngon"]').click();
    // (on a narrow pane — the video docked beside the board — the options strip scrolls sideways: bring the stepper into view first)
    const more = page.getByRole("button", { name: "More sides" }).locator('visible=true').first();
    await more.evaluate((el) => el.scrollIntoView({ inline: "center", block: "nearest" }));
    await more.click();
    await settle(page);
    await dragF(page, [0.16, 0.5], [0.3, 0.8]);
    await expect.poll(() => savedElements().then((l) => l.find((e) => e.shape === "ngon")?.n ?? 0), { timeout: 45_000 }).toBe(6);

    // Ungroup: after it, a single cell can be selected on its own (the count of selected things is one)
    await tool(page, "select").click();
    await page.keyboard.press("Control+a");
    await page.locator('[data-action="ungroup"]:visible').first().click();
    // (this page only: the first test of the file left a grouped table on another page of the same lesson board)
    const thisPage = await boardOf(page).getAttribute("data-page");
    await expect.poll(async () => (await savedPages()).find((p) => p.id === thisPage)?.elements.filter((e) => e.grp).length ?? -1, { timeout: 45_000 }).toBe(0);
    await ctx.close();
  });
});

test.describe("whiteboard: reworked templates render", () => {
  test("gallery: the reworked templates land on the board (screenshots with BOARD_SHOTS)", async ({ browser }) => {
    test.setTimeout(500_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await enterBoard(page, "tutor");
    const items: [string, string, string, string, Record<string, string>?][] = [
      ["geography", "standard", "geo-water", "60-water-cycle"], ["geography", "standard", "geo-rock", "61-rock-cycle"], ["geography", "standard", "geo-pyramid", "62-pyramid-blank", { Bars: "Blank bars for students" }],
      ["maths", "standard", "m-nets", "63-net-cuboid", { Shape: "Cuboid" }], ["maths", "standard", "m-nets", "64-net-prism", { Shape: "Triangular prism" }], ["maths", "standard", "m-nets", "65-net-pyramid", { Shape: "Square-based pyramid" }],
      ["maths", "standard", "m-bar", "66-bar-model"], ["english", "standard", "e-peel", "67-peel"], ["languages", "standard", "l-flash", "68-flashcards"], ["science", "standard", "s-punnett", "69-punnett"],
      ["general", "standard", "g-flow", "70-flowchart"], ["history", "standard", "h-source", "71-source"],
    ];
    for (const [pack, level, item, name, params] of items) {
      for (let attempt = 0; ; attempt++) {
        try {
          if (!(await boardOf(page).isVisible().catch(() => false))) await enterBoard(page, "tutor");
          await page.locator('[data-action="add-page"]').click();
          await tool(page, "insert").click();
          const pop = page.getByTestId("board-toolkit");
          await pop.locator(`[data-pack="${pack}"]`).click();
          await pop.locator(`[data-level="${level}"]`).click();
          await pop.getByLabel("Show items for every style").check();
          await pop.locator(`[data-item="${item}"]`).click();
          if (await pop.getByTestId("toolkit-form").isVisible().catch(() => false)) {
            for (const [label, val] of Object.entries(params ?? {})) await pop.getByLabel(label, { exact: true }).selectOption(val);
            await pop.locator('[data-action="place-template"]').click();
          }
          await expect.poll(() => elements(page), { timeout: 15_000 }).toBeGreaterThan(2);
          await page.getByTestId("board-more").click();
          await page.getByRole("menuitem", { name: /Fit the view/ }).click();
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
          await shot(page, name);
          break;
        } catch (e) { if (attempt >= 2) throw e; await page.waitForTimeout(3000); }
      }
    }
    await ctx.close();
  });
});
