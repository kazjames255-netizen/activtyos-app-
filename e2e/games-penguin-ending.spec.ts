import { test, expect, type Page } from "@playwright/test";
import { STAGES } from "../features/learninghub/games/penguin/config";
import { newProfileLite } from "../features/learninghub/games/penguin/record";

// Penguin Slide: the ENDING. Demo mode (no account, nothing leaves this browser), so it needs no accounts and cannot touch a real tenant.
//  1. beating the last boss and leaving by ANY button (here: "Map") plays the 5-panel finale, and it is marked seen only when it ENDS (a closed tab must not lose it);
//  2. once the last boss has stars, the map offers "Watch the ending again", which replays the finale without touching the saved progress or the stage's stars.
// Every state assertion is anchored to THIS run's browser storage (a fresh context per test), never to a stale row.
test.describe.configure({ mode: "serial" });

const PREFS = "aos.games.penguin.prefs.v1";
const DB = "aos.games.penguin.demo.v3";
const URL = "/dev/games/penguin-slide?unlock=all&debugAnswers=1";
const seenStory = (page: Page) => page.evaluate((k) => { try { return (JSON.parse(localStorage.getItem(k) ?? "{}").story ?? []) as string[]; } catch { return []; } }, PREFS);

/** A demo child who has cleared everything before the last boss (3 stars each), has seen the prologue and every chapter card, and has NOT seen the ending. */
async function freshChild(page: Page, opts: { cleared: boolean }) {
  const prof = newProfileLite(); prof.unlockAll = true;
  prof.journey = Object.fromEntries(STAGES.filter((s) => opts.cleared || s.id !== "b5s4").map((s) => [s.id, 3]));
  const db = JSON.stringify({ facts: {}, profile: prof, sessions: {} });
  const prefs = JSON.stringify({ story: opts.cleared ? ["prologue", "finale"] : ["prologue"], chapters: [1, 2, 3, 4, 5], coached: ["fish", "sky", "drift", "rock", "ball", "pad", "ramp", "crystal", "ring", "bag", "wind", "span", "star", "hint", "shield", "friend"] });
  await page.addInitScript(([d, p, dk, pk]) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(dk!, d!); localStorage.setItem(pk!, p!); sessionStorage.setItem("seeded", "1"); } } catch { /* blocked */ } }, [db, prefs, DB, PREFS]);
  await page.goto(URL);
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 60_000 });
}

test("beating the last boss and leaving by Map plays the finale, marked seen only when it ends", async ({ page }) => {
  test.setTimeout(300_000);
  await freshChild(page, { cleared: false });
  expect(await seenStory(page)).not.toContain("finale");
  await expect(page.getByTestId("ps-replay-finale")).toHaveCount(0); // nothing to replay yet: b5s4 has no stars
  await page.getByTestId("ps-stage-b5s4").click();
  await page.getByTestId("ps-stage-start").click();
  const root = page.getByTestId("penguin-slide");
  // The last stage's blocks DRIFT until Percy reaches the ledge (shoals), so a fixed lane read early would be stale: wait for the ledge, read the debug hook's live answer lane, then tap that pad.
  const atLedge = () => page.evaluate(() => { const s = (window as unknown as { __psGame?: { sim?: { phase: string; gate: { serial: number; gd: number; locked: boolean; correctLane: number; perm: number[] } | null } } }).__psGame?.sim; const g = s?.gate; return g && s!.phase === "approach" && g.gd <= 9.6 && !g.locked ? { serial: g.serial, lane: g.perm.indexOf(g.correctLane) } : null; });
  let lastSerial = -1, n = 0;
  for (let i = 0; i < 2400 && (await root.getAttribute("data-screen")) === "playing"; i++) {
    const at = await atLedge().catch(() => null);
    if (at && at.serial !== lastSerial) {
      lastSerial = at.serial; n++;
      await page.waitForTimeout(400); // he is standing still on the ledge: read, then tap the chosen answer
      await page.getByTestId(`ps-pad-${at.lane}`).click({ timeout: 4000 }).catch(() => undefined); // a deliberate press: the penguin glides there and it locks in
    }
    await page.waitForTimeout(100);
  }
  for (let k = 0; k < 8 && (await page.getByTestId("ps-reveal").count()) > 0; k++) { await page.getByTestId("ps-reveal-next").click(); await page.waitForTimeout(150); }
  await expect(page.getByTestId("ps-summary")).toBeVisible({ timeout: 60_000 });
  expect(n).toBeGreaterThanOrEqual(10); // the boss stage asks 12 questions; a right answer for each one is tapped
  await expect(page.getByTestId("ps-stars")).toHaveAttribute("data-stars", /[1-3]/);
  // the summary says the boss is beaten, and offers the ending as the next step
  await expect(page.getByTestId("ps-next")).toBeVisible();
  // leave by MAP, not by the finale button: the ending must still play
  await page.getByTestId("ps-map-btn").click();
  await expect(page.getByTestId("ps-story")).toBeVisible({ timeout: 10_000 });
  await expect(root).toHaveAttribute("data-screen", "story");
  expect(await seenStory(page)).not.toContain("finale"); // marked when it ENDS, so a closed tab does not lose it
  for (let panel = 1; panel < 5; panel++) { await expect(page.getByTestId("ps-story-text")).not.toHaveText(""); await page.getByTestId("ps-story-next").click(); }
  await page.getByTestId("ps-story-next").click(); // the last panel's button ends it
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 10_000 });
  expect(await seenStory(page)).toContain("finale");
  await expect(page.getByTestId("ps-replay-finale")).toBeVisible(); // and it can be watched again
});

test("the map's replay button plays the ending again and leaves progress alone", async ({ page }) => {
  await freshChild(page, { cleared: true });
  const before = await page.evaluate((k) => localStorage.getItem(k), DB);
  await expect(page.getByTestId("ps-replay-finale")).toBeVisible();
  await page.getByTestId("ps-replay-finale").click();
  await expect(page.getByTestId("ps-story")).toBeVisible();
  const first = await page.getByTestId("ps-story-text").textContent();
  await page.getByTestId("ps-story-next").click();
  await expect(page.getByTestId("ps-story-text")).not.toHaveText(first ?? "");
  await page.getByTestId("ps-story-skip").click(); // skip is offered on every panel but the last
  await expect(page.getByTestId("ps-map")).toBeVisible();
  expect(await seenStory(page)).toContain("finale");
  expect(await page.evaluate((k) => localStorage.getItem(k), DB)).toBe(before); // watching the ending never changes stars or facts
  await expect(page.getByTestId("ps-replay-finale")).toBeVisible();
  // and a second time, all the way to the last panel
  await page.getByTestId("ps-replay-finale").click();
  for (let i = 0; i < 5; i++) await page.getByTestId("ps-story-next").click();
  await expect(page.getByTestId("ps-map")).toBeVisible();
});
