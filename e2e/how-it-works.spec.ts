import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { ROOT } from "./helpers/env";
import { apiPost, fbSignIn } from "./helpers/accounts";
import { SCRIPT_LIST, TUTOR_LIBRARY, PARENT_LIBRARY, EXTRA_TOPICS, scriptFor } from "../features/learninghub/howitworks/scripts";
import { KID_KS1 } from "../features/learninghub/howitworks/scripts/kidKs1";
import { unresolved, sceneShots, type RectMap } from "../features/learninghub/howitworks/rects";
import { shotExists } from "../features/learninghub/howitworks/shot";
import { keyParts, posIn, type HowScript } from "../features/learninghub/howitworks/types";
import { buildFixture, ensureFixture, ctxFor, gotoHubPage, handOver, settle, type Fx } from "./review/fixture";

// Teaching Hub "How it works": three narrated explainers (tutors / parents / children, plus the extra-simple Reception-Year 2 child one).
// The public pages need no sign-in; the in-app entry points use throwaway @activityos-test.com accounts (the review fixture, cached in
// scratch/hiw-fx.json by the screenshot spec). Speech is faked so the run is silent and fast:  scripts/e2e-locked.sh e2e/how-it-works.spec.ts
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/how-it-works");
const FXF = path.join(ROOT, "scratch/hiw-fx.json");

/** A silent speechSynthesis: fires start / word boundaries / end so the player's voice-sync path runs, and records what it was asked to say. */
const FAKE_SPEECH = () => {
  const w = window as unknown as { __spoken: string[]; speechSynthesis: unknown; SpeechSynthesisUtterance: unknown };
  w.__spoken = [];
  class U { text: string; rate = 1; pitch = 1; lang = ""; voice: unknown = null; onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: ((e: unknown) => void) | null = null; onboundary: ((e: { charIndex: number; charLength: number }) => void) | null = null; constructor(t: string) { this.text = t; } }
  w.SpeechSynthesisUtterance = U;
  let gen = 0;
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, pause() {}, resume() {}, cancel() { gen++; },
    speak(u: U) {
      w.__spoken.push(u.text); const my = ++gen; let i = 0; const words = [...u.text.matchAll(/\S+/g)];
      setTimeout(function tick() {
        if (my !== gen) return;
        if (i === 0) u.onstart?.();
        if (i < words.length) { u.onboundary?.({ charIndex: words[i].index ?? 0, charLength: words[i][0].length }); i++; setTimeout(tick, 25); } else u.onend?.();
      }, 20);
    },
  } });
};
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length);
const seek = (page: Page, scene: number | string, at = 0) => page.evaluate(([s, a]) => window.dispatchEvent(new CustomEvent("hiw:seek", { detail: { scene: s, at: a } })), [scene, at] as const);

test.describe("scripts are internally consistent", () => {
  
  for (const s of [...SCRIPT_LIST.filter((x) => x.role === "kid"), ...TUTOR_LIBRARY, ...PARENT_LIBRARY, ...EXTRA_TOPICS.kid, KID_KS1] as HowScript[]) {
    test(`${s.slug}${s.topic ? "/" + s.topic : ""}${s.band ? "/" + s.band : ""}: every cue phrase is in the narration and every screen exists`, () => {
      const ids = new Set<string>();
      for (const sc of s.scenes) {
        expect(ids.has(sc.id), `duplicate scene id ${sc.id}`).toBe(false); ids.add(sc.id);
        expect(sc.say.length, `${sc.id} narration length`).toBeLessThan(430);
        expect(sc.keys.length, `${sc.id} has key words`).toBeGreaterThan(0);
        for (const k of sc.keys) { expect(posIn(sc.say, keyParts(k)[1]) >= 0, `${sc.id}: key "${k}" is not timed by anything in the narration`).toBe(true); expect(keyParts(k)[0].split(/\s+/).length, `${sc.id}: key "${k}" is too long for the screen`).toBeLessThanOrEqual(6); }
        const phrases = [...(sc.cam ?? []), ...(sc.rings ?? []), ...(sc.cursor ?? []), ...(sc.callouts ?? []), ...(sc.nodes ?? []), ...(sc.shots ?? [])].flatMap((c) => [c.on, "off" in c ? (c as { off?: string }).off ?? "" : ""]).filter(Boolean);
        for (const p of phrases) expect(posIn(sc.say, p) >= 0, `${sc.id}: cue "${p}" not in narration`).toBe(true);
        for (const sh of [sc.shot, ...(sc.shots ?? [])].filter(Boolean)) {
          expect(sh!.src, `${sc.id}: a screen is missing (run the screenshot spec, then node scripts/hiw-optimise.mjs)`).not.toBe("");
          expect(fs.existsSync(path.join(ROOT, "public", sh!.src)), `${sc.id}: ${sh!.src} not on disk`).toBe(true);
        }
      }
      // every cue that names an element must find it on that screen (a ring never floats over the wrong spot)
      const maps: RectMap = {};
      for (const sc of s.scenes) for (const sh of sceneShots(sc)) { const f = path.join(ROOT, "public", sh.src.replace(/\.webp$/, ".rects.json")); if (sh.src && fs.existsSync(f)) maps[sh.src] = JSON.parse(fs.readFileSync(f, "utf8")); }
      const bad = s.scenes.flatMap((sc) => unresolved(sc, maps));
      expect.soft(bad, `cues that name an element that is not on their screen:\n${bad.join("\n")}`).toEqual([]);
      expect(scriptFor(s.role, s.band, s.topic).scenes.length).toBe(s.scenes.length);
      if (s.topic) { expect(s.blurb, "topic blurb").toBeTruthy(); const words = s.scenes.reduce((a, x) => a + x.say.split(/\s+/).length, 0); expect(words / 2.4, `${s.topic} runs about ${Math.round(words / 2.4)}s`).toBeLessThan(230); }
      void shotExists;
    });
  }
});

const PAGES: [string, string, string][] = [["tutors/families", "tutor", "fam-ways"], ["tutors/homework", "tutor", "homework"], ["parents/start", "parent", "getting-in"], ["parents/homework", "parent", "homework"], ["children", "kid", "hello"], ["children/homework", "kid", "homework"], ["children?band=ks1", "kid", "hello"]];
test.describe("the tutor library", () => {
  
  test("/how-it-works/tutors is a chooser with one card per short video; each card opens its own video; old ?scene= links still land", async ({ page }) => {
    await page.goto("/how-it-works/tutors");
    const chooser = page.getByTestId("hiw-chooser");
    await expect(chooser).toBeVisible({ timeout: 90_000 });
    for (const t of TUTOR_LIBRARY) await expect(chooser.getByTestId(`hiw-topic-${t.topic}`)).toBeVisible();
    expect(TUTOR_LIBRARY.map((t) => t.topic)).toEqual(["home", "families", "students", "lessons", "live", "tools", "quizzes", "homework", "progress", "messages"]);
    await chooser.getByTestId("hiw-topic-homework").click();
    await expect(page).toHaveURL(/\/how-it-works\/tutors\/homework/);
    await expect(page.getByTestId("hiw")).toHaveAttribute("data-scene", TUTOR_LIBRARY.find((t) => t.topic === "homework")!.scenes[0].id, { timeout: 60_000 });
    await page.getByTestId("hiw-all-videos").click();
    await expect(page.getByTestId("hiw-chooser")).toBeVisible();
    await page.goto("/how-it-works/tutors?scene=fam-ways");
    await expect(page.getByTestId("hiw")).toHaveAttribute("data-scene", "fam-ways", { timeout: 60_000 });
  });
});

test.describe("public pages: play, pause, keyboard, captions, phone width", () => {
  
  for (const [slug, role] of PAGES) {
    test(`/how-it-works/${slug}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript(FAKE_SPEECH);
      await page.goto(`/how-it-works/${slug}`);
      const root = page.getByTestId("hiw");
      await expect(page.getByTestId("hiw-poster")).toBeVisible({ timeout: 90_000 });
      await expect(root).toHaveAttribute("data-role", role);
      expect(await spoken(page), "no sound before a click").toBe(0);
      // play: the voice starts only after the click, the key word and captions appear, the scene list is there
      await page.getByTestId("hiw-start").click();
      await expect(root).toHaveAttribute("data-playing", "1");
      await expect.poll(() => spoken(page), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.getByTestId("hiw-key")).not.toBeEmpty();
      await expect(page.getByTestId("hiw-caption")).toContainText(/\w{3}/);
      const first = await root.getAttribute("data-scene");
      await expect.poll(() => root.getAttribute("data-scene"), { message: "the film moves on to scene 2 by itself", timeout: 60_000 }).not.toBe(first);
      // pause / play with the space bar, next / previous with the arrows
      await page.keyboard.press("Space");
      await expect(root).toHaveAttribute("data-playing", "0");
      const paused = await root.getAttribute("data-scene");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => root.getAttribute("data-scene")).not.toBe(paused);
      await page.keyboard.press("ArrowLeft");
      await page.getByTestId("hiw-play").click();
      await expect(root).toHaveAttribute("data-playing", "1");
      await page.getByTestId("hiw-play").click();
      await expect(root).toHaveAttribute("data-playing", "0");
      // captions can be switched off and on; a scene can be jumped to from the list
      await page.keyboard.press("c");
      await expect(page.getByTestId("hiw-caption")).toHaveCount(0);
      await page.keyboard.press("c");
      await expect(page.getByTestId("hiw-caption")).toBeVisible();
      const slugOnly = slug.split("?")[0].split("/");
      const target = slug.includes("ks1") ? KID_KS1 : scriptFor(role as "tutor" | "parent" | "kid", null, slugOnly[1] ?? null);
      const sceneId = target.scenes[Math.min(2, target.scenes.length - 1)].id;
      await page.getByTestId(`hiw-scene-${sceneId}`).click();
      await expect(root).toHaveAttribute("data-scene", sceneId);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("phone width: no sideways scroll, controls usable; dark scheme and reduced motion are respected", async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.addInitScript(FAKE_SPEECH);
    await page.goto("/how-it-works/tutors/families?scene=fam-invite");
    await expect(page.getByTestId("hiw-poster")).toBeVisible({ timeout: 90_000 });
    await page.getByTestId("hiw-start").click();
    await expect(page.getByTestId("hiw")).toHaveAttribute("data-scene", "fam-invite");
    await seek(page, "fam-invite", 0.9);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // reduced motion: the camera does not glide
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".hiw-cam")!).transitionDuration))).toBeLessThan(0.01);
    await page.screenshot({ path: path.join(OUT, "player-phone-dark.png") });
    await ctx.close();
  });
});

// ---- inside the app -------------------------------------------------------------------------------------------------
test.describe("in the app", () => {
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(600_000);
  try { const saved = JSON.parse(fs.readFileSync(FXF, "utf8")) as { fx: Fx }; fx = await ensureFixture(browser, saved.fx, 3, true); } catch { fx = await buildFixture(3, true, browser); }
});
const splash = async (page: Page) => {
  const sp = page.getByRole("dialog", { name: /Welcome to the Teaching and Learning Hub/ });
  if (await sp.isVisible({ timeout: 2500 }).catch(() => false)) { await page.waitForTimeout(1100); await page.keyboard.press("Shift"); await sp.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined); }
};

test("tutor: the hero button opens THEIR explainer only; it plays, pauses and closes with Escape", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await page.addInitScript(FAKE_SPEECH);
  await gotoHubPage(page, "/freelancer/learninghub?tab=students", fx); await splash(page); await settle(page);
  await page.getByTestId("hiw-open").click();
  const modal = page.getByTestId("hiw-modal");
  await expect(modal).toBeVisible({ timeout: 60_000 });
  await expect(modal.getByTestId("hiw-chooser")).toBeVisible();     // the hero pill opens the library
  await modal.getByTestId("hiw-topic-home").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "tutor");
  await expect(modal.getByRole("tab")).toHaveCount(0);            // a tutor is only offered the tutor video
  await modal.getByTestId("hiw-start").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-playing", "1");
  await modal.getByTestId("hiw-play").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-playing", "0");
  await page.screenshot({ path: path.join(OUT, "app-tutor-modal.png") });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  // the Students area has its own link, straight to the students video
  await page.getByTestId("hiw-tab-link").getByTestId("hiw-showme").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "tutor", { timeout: 60_000 });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  // the Enrol dialog's link jumps straight to the "three ways" scene, and Escape closes only the window on top
  await page.getByRole("button", { name: /Enrol a student/ }).first().click();
  await page.locator("#hub-enrol-modal").getByTestId("hiw-open-link").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", "fam-ways");
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page.locator("#hub-enrol-modal")).toBeVisible();
  await ctx.close();
});

test("parent: the Learning Hub has a How it works button (parent video + 'what your child sees'), and the invite page points to it", async ({ browser }) => {
  test.setTimeout(300_000);
  const kid = fx.kids[0];
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await page.addInitScript(FAKE_SPEECH);
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx); await splash(page); await settle(page);
  await page.getByTestId("hiw-open").click();
  const modal = page.getByTestId("hiw-modal");
  await expect(modal.getByTestId("hiw-chooser")).toBeVisible({ timeout: 60_000 });   // the parent library: start, homework, week, hand over
  await modal.getByTestId("hiw-topic-start").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "parent", { timeout: 60_000 });
  await expect(modal.getByTestId("hiw-role-kid")).toBeVisible();  // "What your child sees"
  await expect(modal.getByTestId("hiw-role-tutor")).toHaveCount(0); // never the tutor video
  await page.screenshot({ path: path.join(OUT, "app-parent-modal.png") });
  await modal.getByTestId("hiw-role-kid").click();
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "kid");
  await page.keyboard.press("Escape");
  // the progress area has it too (the banner is on every tab)
  await page.goto(`/custdash/learninghub?tab=dashboard&child=${kid.id}`); await splash(page);
  await expect(page.getByTestId("hiw-open")).toBeVisible({ timeout: 60_000 });
  // the Homework tab has its own link, straight to the parent homework video
  await page.goto(`/custdash/learninghub?tab=homework&child=${kid.id}`); await splash(page);
  await page.getByTestId("hiw-tab-link").getByTestId("hiw-showme").click({ timeout: 60_000 });
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", "hw-list", { timeout: 60_000 });
  await page.keyboard.press("Escape");
  // invite-claim page: a short "How this works" pointer opening the parent video
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const inv = await apiPost<{ token: string }>("/api/learning-hub/family-invites", t, { forName: "How-it-works spec" });
  await page.goto(`/custdash/learninghub?invite=${inv.token}`);
  await page.getByTestId("hiw-open-link").click({ timeout: 60_000 });
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "parent");
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-scene", "invite");   // it opens on the invite scene
  await page.keyboard.press("Escape");
  await ctx.close();
});

test("child: a big How it works button on the child's Home, the child video, voice on by default, no grown-up tabs, nothing leaves the child area", async ({ browser }) => {
  test.setTimeout(300_000);
  const kid = fx.kids[0];
  const ctx = await browser.newContext({ storageState: path.join(process.env.REVIEW_AUTH_DIR ? path.resolve(process.env.REVIEW_AUTH_DIR) : path.join(ROOT, "e2e/review/.auth"), "parent.json"), viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(FAKE_SPEECH);
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${kid.id}`, fx); await splash(page); await settle(page);
  await handOver(page, kid.id); await settle(page);
  await expect(page.getByTestId("hiw-open")).toHaveCount(0);      // the parent's banner button is not on a child's screen
  const btn = page.getByTestId("hiw-open-kid").or(page.getByTestId("hiw-open-link")).first();
  await expect(btn).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(OUT, "app-kid-home.png") });
  await btn.click();
  const modal = page.getByTestId("hiw-modal");
  await expect(modal.getByTestId("hiw")).toHaveAttribute("data-role", "kid", { timeout: 60_000 });
  await expect(modal.getByRole("tab")).toHaveCount(0);            // no role switcher for a child
  await expect(modal.getByTestId("hiw-speed")).toHaveCount(0);    // no grown-up controls
  await modal.getByTestId("hiw-start").click();
  await expect.poll(() => spoken(page), { timeout: 15_000 }).toBeGreaterThan(0); // voice is on after the first tap
  await expect(modal.getByRole("link")).toHaveCount(0);           // nothing that leaves the child area
  await page.screenshot({ path: path.join(OUT, "app-kid-modal.png") });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await ctx.close();
});

});
