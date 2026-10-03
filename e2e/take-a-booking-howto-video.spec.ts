import { test, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAccounts } from "./helpers/env";
import { TEST_PASSWORD } from "./helpers/accounts";

// Records the "Take a booking for a family" how-to video (about 90 seconds) against the REAL company portal of the standing e2e company
// account (Riverside demo data). It only navigates, fills the form and explains: it NEVER presses the final button, so no booking, no account
// and no email is created. The demo parent uses an @activityos-test.com address (the mailer never sends to that domain).
// Voice-over: macOS `say`; captions burned into the page; mp4 via ffmpeg. Run only with RECORD_VIDEOS=1.
// Output: ~/Downloads/ActivityOS how-to videos/take-a-booking.mp4
const OUT = process.env.VIDEO_OUT || path.join(os.homedir(), "Downloads/ActivityOS how-to videos");
test.skip(!process.env.RECORD_VIDEOS, "video recording only runs with RECORD_VIDEOS=1");

type Ev = { t: number; file: string };
class Rec {
  t0 = 0; cut = 0; evs: Ev[] = []; n = 0;
  constructor(public page: Page, public dir: string) {}
  start() { this.t0 = Date.now(); }
  now() { return (Date.now() - this.t0) / 1000; }
  private speak(text: string) {
    const f = path.join(this.dir, `vo-${this.n++}.aiff`);
    execFileSync("say", ["-v", "Daniel", "-r", "185", "-o", f, text]);
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
    return { f, dur };
  }
  /** Caption bar (+ optional highlighted element), spoken; holds long enough for the voice-over to finish. */
  async cap(text: string, spoken: string, o: { step?: string; hl?: Locator; min?: number } = {}) {
    const { f, dur } = this.speak(spoken);
    if (o.hl) {
      await o.hl.scrollIntoViewIfNeeded().catch(() => {});
      await o.hl.evaluate((e) => { (e as HTMLElement).style.outline = "4px solid #ffb703"; (e as HTMLElement).style.outlineOffset = "4px"; }).catch(() => {});
    }
    await this.page.evaluate(({ text, step }) => {
      let d = document.getElementById("__cap"); if (!d) { d = document.createElement("div"); d.id = "__cap"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(10,18,50,.94);color:#fff;font:600 26px/1.35 system-ui,-apple-system,sans-serif;padding:22px 48px;display:flex;gap:18px;align-items:center;pointer-events:none");
      d.innerHTML = (step ? `<span style="flex:none;background:#ffb703;color:#111;border-radius:999px;padding:4px 16px;font-size:20px;font-weight:800">${step}</span>` : "") + `<span>${text}</span>`;
    }, { text, step: o.step ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 2500, dur * 1000 + 700));
    if (o.hl) await o.hl.evaluate((e) => { (e as HTMLElement).style.outline = ""; }).catch(() => {});
  }
  /** Full-screen title / explainer card. */
  async card(title: string, lines: string[], spoken: string, o: { tag?: string; min?: number } = {}) {
    const { f, dur } = this.speak(spoken);
    await this.page.evaluate(({ title, lines, tag }) => {
      document.getElementById("__cap")?.remove();
      let d = document.getElementById("__card"); if (!d) { d = document.createElement("div"); d.id = "__card"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483600;background:linear-gradient(135deg,#1d3a8f,#10195a);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 140px");
      d.innerHTML = (tag ? `<div style="align-self:flex-start;background:#ffb703;color:#111;font-weight:800;font-size:22px;border-radius:999px;padding:6px 20px;margin-bottom:28px">${tag}</div>` : "")
        + `<div style="font-size:54px;font-weight:800;line-height:1.15;margin-bottom:26px">${title}</div>`
        + lines.map((l) => `<div style="font-size:30px;line-height:1.5;opacity:.95">${l}</div>`).join("");
    }, { title, lines, tag: o.tag ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 4000, dur * 1000 + 900));
  }
  async hideCard() { await this.page.evaluate(() => document.getElementById("__card")?.remove()); }
}

/** Click through a caption bar that may sit over the button. */
async function jsClick(l: Locator) {
  await l.waitFor({ timeout: 20_000 });
  await l.evaluate((e) => { (e as HTMLElement).scrollIntoView({ block: "center" }); (e as HTMLElement).click(); });
}

/** webm -> mp4 with the voice-over lines placed at their recorded times. */
function finish(rec: Rec, webm: string, out: string) {
  const args = ["-y", "-ss", String(rec.cut), "-i", webm];
  rec.evs.forEach((e) => args.push("-i", e.file));
  const filt = rec.evs.map((e, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round((e.t - rec.cut) * 1000))}|${Math.max(0, Math.round((e.t - rec.cut) * 1000))}[a${i}]`).join(";")
    + `;${rec.evs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${rec.evs.length}:normalize=0[aout]`;
  args.push("-filter_complex", filt, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "25", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", out);
  execFileSync("ffmpeg", args, { stdio: "pipe" });
}

/** Sign the throwaway e2e company account in once (local dev web, test password from the e2e helpers) and keep the session. */
async function session(browser: import("@playwright/test").Browser, email: string) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto("/login");
  await p.getByPlaceholder("you@example.com").fill(email);
  await p.locator('input[type="password"]').fill(TEST_PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/company/, { timeout: 90_000 });
  const state = await c.storageState({ indexedDB: true });
  await c.close();
  return state;
}

test("record the Take a booking how-to video", async ({ browser }) => {
  test.setTimeout(1_500_000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-vid-takebooking-"));
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  const rec = new Rec(page, dir);
  let webm = "";
  try {
    rec.start();
    // Sign in inside the recording (the saved-session reload hangs on "Checking access" against the live site); the login is trimmed off the cut.
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(loadAccounts().accounts.company.email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/company/, { timeout: 90_000 });
    await page.goto("/company/bookings");
    await page.getByRole("button", { name: /Take a booking/ }).first().waitFor({ timeout: 90_000 });
    await page.waitForTimeout(2500);
    rec.cut = rec.now();
    await rec.card("Take a booking for a family", ["For phone and walk-in bookings.", "About 90 seconds."],
      "How to take a booking for a family. Use this for phone calls and walk-ins, when you are doing the booking for them.", { tag: "ActivityOS how-to" });
    await rec.hideCard();

    await rec.cap("Open Bookings and press Take a booking.", "Open Bookings, and press Take a booking.", { step: "1", hl: page.getByRole("button", { name: /Take a booking/ }).first() });
    await page.getByRole("button", { name: /Take a booking/ }).first().click();
    const dlg = page.getByRole("heading", { name: "Take a booking" });
    await dlg.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    // listing + pass + date
    await page.waitForTimeout(3000);
    await rec.cap("Choose the activity, the pass and the days.", "Choose the activity, the pass, and the days. It is the same price the family would pay online.", { step: "2" });
    const day = page.locator("button").filter({ hasText: /^\s*(MON|TUE)\s*\d+/i }).first();
    await day.click({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Add .* basket/i }).first().click({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await jsClick(page.getByRole("button", { name: /Checkout \(\d+\)/ }).first());
    await page.waitForTimeout(2000);

    // parent step
    await rec.cap("A returning family? Search and pick them. A new family? Use the box below.", "Is it a family you already have? Search for them and pick them. For a new family, use the box below.", { step: "3" });
    const how = page.getByText(/How it works/).first();
    await how.click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await rec.cap("Not the same as sending a sign-up link: you enter the booking, they just pay.", "This is not the same as sending a parent a sign-up link. You enter the booking for them. They only have to pay.", { step: "3", hl: how, min: 4000 });
    await how.click({ timeout: 8000 }).catch(() => {});

    const fieldAfter = (label: RegExp) => page.getByText(label).first().locator("xpath=following::input[1]");
    await fieldAfter(/^Parent.s full name$/).fill("Sam Parent (demo)", { timeout: 10_000 });
    await fieldAfter(/^Email$/).fill("sam.parent.demo@activityos-test.com", { timeout: 10_000 });
    await fieldAfter(/^Phone$/).fill("07700 900123", { timeout: 10_000 });
    await rec.cap("Only three things: name, email and phone. No address needed.", "Just three things. Their name, email, and phone number. No address is needed.", { step: "3", min: 3500 });
    await page.getByRole("button", { name: /Set up Sam/ }).click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Book for Sam/ }).click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // children
    await rec.cap("Add the child: name and date of birth are required.", "Now add the child. Their name and date of birth are required. Everything else, like allergies and emergency contact, the parent can add later.", { step: "4", min: 3500 });
    await page.getByRole("button", { name: /Add a new child/ }).click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByPlaceholder(/first and last name/i).first().fill("Alex Parent").catch(() => {});
    await page.locator('input[type="date"]').first().fill("2018-03-14").catch(() => {});
    await rec.cap("Name and date of birth are marked with a red star.", "Name and date of birth carry a red star, so you cannot miss them.", { step: "4", min: 3000 });

    await rec.card("What the family gets", [
      "One email with the booking.",
      "A Pay button that needs no log in.",
      "A link to set a password and add allergies, emergency contact and address.",
    ], "When you finish, the family gets one email. It has a Pay button that needs no login, and a link to set a password and add the rest of their details.", { tag: "5", min: 5000 });
    await rec.hideCard();
    await rec.card("Want the parent to fill everything in?", [
      "Send them the activity's own booking link instead.",
      "Blocks and listings, then the Link button.",
    ], "If you would rather the parent fills everything in themselves, send them the activity's own booking link instead. You find it in Blocks and listings, under Link.", { tag: "Tip", min: 5000 });
    await rec.hideCard();
    webm = (await page.video()?.path()) ?? "";
  } finally {
    await ctx.close();
  }
  const out = path.join(OUT, "take-a-booking.mp4");
  finish(rec, webm || fs.readdirSync(dir).filter((f) => f.endsWith(".webm")).map((f) => path.join(dir, f))[0], out);
  console.log("VIDEO WRITTEN:", out);
});
