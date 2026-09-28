import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";
import { dismissParentWelcome } from "./helpers/ui";
import fs from "node:fs";
import path from "node:path";
import { CLIPS, TOURS, TAB_CLIP, collectScenes, seconds } from "../features/learninghub/howitworks/scripts/clips";
import { hubCatalog } from "../lib/i18n/messages/hub";
import { LOCALES } from "../lib/i18n/config";
import { ROOT } from "./helpers/env";

// Teaching Hub "How it works" extras:
//  • "Show me" clips: a few scenes of the existing films (~15 s), one button per Hub area next to its "Watch:" link;
//  • a first-visit tour offered once per person per role (never auto-plays), replayable from a small link;
//  • the parent's WATCH ALONG: the child's own lesson, view-only (nothing is started, answered or saved).
// Every state assertion is anchored to THIS run's child / lesson / homework.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Watch Lab ${stamp}`;
const avaName = `Ava${stamp}`;
const HW_TITLE = `Watch homework ${stamp}`;
const HUB = "/api/learning-hub";
let accounts: AccountManifest["accounts"];
let tenantId = "";
let avaId = "";
let L: SeededLesson;

async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
const splash = async (page: Page) => {
  const sp = page.getByRole("dialog", { name: /Welcome to the Teaching and Learning Hub/ });
  if (await sp.isVisible({ timeout: 2500 }).catch(() => false)) { await page.waitForTimeout(1100); await page.keyboard.press("Shift"); await sp.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined); }
};
/** No untranslated message key may ever be painted ("hubhow.showMe"). */
const RAW_KEY = /\bhub[a-z]+\.[a-zA-Z_]+\b/;
const noRawKeys = async (page: Page, where: string) => {
  const text = await page.locator("body").innerText();
  expect(text.match(new RegExp(RAW_KEY, "g")) ?? [], `raw i18n keys on screen (${where})`).toEqual([]);
};
const ctxFor = (browser: Browser, who: "freelancer" | "parent") => browser.newContext({ storageState: statePath(who), viewport: { width: 1440, height: 900 } });

test.describe("clips and tour are made of real scenes", () => {
  test("every hubhow.* message the How-it-works code uses exists in English and in all 10 other hub locales", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
    const used = new Set<string>();
    for (const f of walk(path.join(ROOT, "features/learninghub"))) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/hubhow\.([A-Za-z_]\w*)/g)) used.add(m[1]);
      if (f.endsWith("TabHowTo.tsx")) for (const m of src.matchAll(/label: "(w_\w+)"/g)) used.add(m[1]);   // built at run time as hubhow.${label}
    }
    expect(used.size, "found the keys").toBeGreaterThan(20);
    for (const l of LOCALES) {
      const cat = hubCatalog(l.code).hubhow ?? {};
      expect([...used].filter((k) => !(k in cat)), `hubhow keys missing in ${l.code}`).toEqual([]);
    }
  });

  test("every clip / tour / tab-clip names scenes that exist in its role's library; a clip is about 15 seconds", () => {
    const same = <T,>(x: T) => x;
    for (const [id, c] of Object.entries(CLIPS)) {
      const got = collectScenes(c.role, c.scenes, same);
      expect(got.map((s) => s.id), `clip ${id}: every scene id must exist`).toEqual(c.scenes);
      expect(seconds(got), `clip ${id} runs about ${seconds(got)}s`).toBeLessThanOrEqual(20);
    }
    for (const role of ["tutor", "parent"] as const) {
      const ids = TOURS[role]!;
      expect(collectScenes(role, ids, same).map((s) => s.id), `${role} tour: every scene id must exist`).toEqual(ids);
      for (const clip of Object.values(TAB_CLIP[role])) expect(CLIPS[clip], `tab clip ${clip}`).toBeTruthy();
    }
    expect(TOURS.kid, "a child's tour is their own short film, not a composed one").toBeNull();
  });
});

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Watch Tuition ${stamp}`, price: 0 });
  avaId = await createParentChild(accounts.parent, { name: avaName });
  await bookViaApi(accounts.parent, listing, { child: avaName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Shapes" });
  await apiPost(`${HUB}/students`, t, { childId: avaId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topicId = topics.find((x) => x.subject === subject)!.id;
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: "neurone" });
  await apiPost(`${HUB}/homework`, t, { title: HW_TITLE, instructions: "Watch and do the lesson.", noteIds: [L.noteId], assignedChildIds: [avaId], dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

test("tutor: the tour is offered once on Home, never plays by itself, is remembered, and can be replayed", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await gotoHub(page, "/freelancer/learninghub?tab=home"); await splash(page);
  const card = page.getByTestId("hiw-tour-card");
  await expect(card).toBeVisible({ timeout: 45_000 });
  await noRawKeys(page, "tutor Home");
  await expect(page.getByTestId("hiw-modal")).toHaveCount(0);            // an offer, never an ambush
  await page.getByTestId("hiw-tour-start").click();
  const modal = page.getByTestId("hiw-modal");
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "tutor", { timeout: 60_000 });
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", TOURS.tutor![0]);
  await expect(modal.getByRole("heading", { name: "A quick tour" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(card).toHaveCount(0);                                      // remembered for this person + role
  await page.reload(); await splash(page);
  await expect(page.getByTestId("hiw-tour-replay")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("hiw-tour-card")).toHaveCount(0);
  await page.getByTestId("hiw-tour-replay").getByTestId("hiw-open-link").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", TOURS.tutor![0], { timeout: 60_000 });
  await ctx.close();
});

test("tutor: 'Show me' plays a ~15 second slice of that area's video, and links on to the full one", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await gotoHub(page, "/freelancer/learninghub?tab=students"); await splash(page);
  await expect(page.getByTestId("hiw-showme")).toBeVisible({ timeout: 45_000 });
  await noRawKeys(page, "tutor Students");
  await page.getByTestId("hiw-showme").click();
  const modal = page.getByTestId("hiw-modal");
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "tutor", { timeout: 60_000 });
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", CLIPS["t-students"].scenes[0]);
  await expect(modal.getByRole("button", { name: /Watch the full video/ }).first()).toBeVisible({ timeout: 30_000 });   // only a clip offers it
  await noRawKeys(page, "the clip window");
  await modal.getByRole("button", { name: /Watch the full video/ }).first().click();
  await expect(modal.getByTestId("hiw-all-videos")).toBeVisible({ timeout: 30_000 });   // now inside the full topic video
  await page.keyboard.press("Escape");
  await ctx.close();
});

test("parent: Watch along is view-only: the child's own lesson, a clear banner, and nothing saved", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await dismissParentWelcome(page);
  await gotoHub(page, `/custdash/learninghub?tab=home&child=${avaId}`);
  const attemptsBefore = (await apiFetch<unknown[]>(`${HUB}/attempts?tenantId=${tenantId}&childId=${avaId}`, await token(accounts.parent))).length;
  // Home: the homework row that carries an interactive lesson offers Watch along
  const row = page.getByTestId("hub-watchalong").first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  await row.click();
  await expect(page).toHaveURL(/watch=1/);
  expect(decodeURIComponent(page.url())).toContain(`open=lesson:${L.noteId}`);
  await expect(page.getByTestId("hub-watchalong-banner")).toContainText(avaName, { timeout: 30_000 });
  await noRawKeys(page, "parent watch-along");
  const player = page.getByTestId("lesson-player");
  await expect(player).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("lesson-start").click().catch(() => undefined);
  const attemptsAfter = (await apiFetch<unknown[]>(`${HUB}/attempts?tenantId=${tenantId}&childId=${avaId}`, await token(accounts.parent))).length;
  expect(attemptsAfter, "watching along must not start or record anything for the child").toBe(attemptsBefore);
  // a plain link to the same lesson (no watch=1) is the normal lesson: no banner
  await gotoHub(page, `/custdash/learninghub?tab=notes&child=${avaId}&open=lesson:${L.noteId}`);
  await expect(page.getByTestId("lesson-player")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("hub-watchalong-banner")).toHaveCount(0);
  // and the email-style link lands straight on the banner
  await gotoHub(page, `/custdash/learninghub?tab=notes&child=${avaId}&open=lesson:${L.noteId}&watch=1`);
  await expect(page.getByTestId("hub-watchalong-banner")).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});
