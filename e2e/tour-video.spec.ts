import { test, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAccounts } from "./helpers/env";
import { TEST_PASSWORD } from "./helpers/accounts";

// Records the ~2 minute product tour (about 10 seconds on each key screen) against the REAL company portal of the standing e2e company account.
// Read-only: it only navigates and highlights; nothing is created, edited or sent. Run only with RECORD_VIDEOS=1.
// Output: ~/Downloads/ActivityOS tour video/activly-tour.mp4 (British voice-over via macOS `say`, captions burned into the page).
const OUT = process.env.VIDEO_OUT || path.join(os.homedir(), "Downloads/ActivityOS tour video");

type Ev = { t: number; file: string };
class Rec {
  t0 = 0; evs: Ev[] = []; n = 0;
  constructor(public page: Page, public dir: string) {}
  start() { this.t0 = Date.now(); }
  private speak(text: string) {
    const f = path.join(this.dir, `vo-${this.n++}.aiff`);
    execFileSync("say", ["-v", "Daniel", "-r", "185", "-o", f, text]);
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
    return { f, dur };
  }
  async cap(text: string, o: { step?: string; min?: number } = {}) {
    const { f, dur } = this.speak(text);
    await this.page.evaluate(({ text, step }) => {
      let d = document.getElementById("__cap"); if (!d) { d = document.createElement("div"); d.id = "__cap"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(10,18,50,.94);color:#fff;font:600 26px/1.35 system-ui,-apple-system,sans-serif;padding:22px 48px 22px 96px;display:flex;gap:20px;align-items:center;");
      d.innerHTML = (step ? `<span style="flex:none;background:#ffb703;color:#111;border-radius:999px;padding:4px 16px;font-size:20px;font-weight:800">${step}</span>` : "") + `<span>${text}</span>`;
    }, { text, step: o.step ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 9000, dur * 1000 + 700));
  }
  async card(title: string, lines: string[], spoken: string, o: { tag?: string; min?: number } = {}) {
    const { f, dur } = this.speak(spoken);
    await this.page.evaluate(({ title, lines, tag }) => {
      document.getElementById("__cap")?.remove();
      let d = document.getElementById("__card"); if (!d) { d = document.createElement("div"); d.id = "__card"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483600;background:linear-gradient(135deg,#1d3a8f,#10195a);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 140px;");
      d.innerHTML = (tag ? `<div style="align-self:flex-start;background:#ffb703;color:#111;font-weight:800;font-size:22px;border-radius:999px;padding:6px 20px;margin-bottom:28px">${tag}</div>` : "") + `<div style="font-size:60px;font-weight:800;line-height:1.15;margin-bottom:30px">${title}</div>` + lines.map((l) => `<div style="font-size:30px;line-height:1.5;margin:6px 0;color:#dfe7ff">${l}</div>`).join("");
    }, { title, lines, tag: o.tag ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 5000, dur * 1000 + 900));
  }
  async hideCard() { await this.page.evaluate(() => document.getElementById("__card")?.remove()); }
}

function finish(rec: Rec, webm: string, out: string) {
  const args = ["-y", "-i", webm];
  rec.evs.forEach((e) => args.push("-i", e.file));
  const filt = rec.evs.map((e, i) => `[${i + 1}:a]adelay=${Math.round(e.t * 1000)}|${Math.round(e.t * 1000)}[a${i}]`).join(";") + `;${rec.evs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${rec.evs.length}:normalize=0[aout]`;
  args.push("-filter_complex", filt, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "25", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", out);
  execFileSync("ffmpeg", args, { stdio: "pipe" });
}

test.skip(!process.env.RECORD_VIDEOS, "video recording only runs with RECORD_VIDEOS=1");

// view slug, step label, narration (kept to things the product really does today)
const SCENES: [string, string, string][] = [
  ["dashboard", "1 Dashboard", "Your dashboard: income collected, bookings and families at a glance, and it updates live as parents book."],
  ["listings", "2 Listings", "Blocks and listings. Build a camp, a club or a term block once, with dates, prices, capacity and ratios, and choose which sites it runs at."],
  ["bookings", "3 Bookings", "Bookings. Every booking in one place: who, what, when and whether it is paid. Waitlists and capacity are handled for you."],
  ["customers", "4 Families", "Families. Each family, their children, their bookings and their messages, kept together."],
  ["admin-registers", "5 Registers", "Registers. On the day, mark attendance, see medical notes and collection details, and keep your ratios right."],
  ["purchasing", "6 Money in", "Money in. Parents pay by card straight into your own Stripe account. Tax-Free Childcare payments are recorded against the booking by reference."],
  ["schedule", "7 Rota", "Staff schedule. Build the rota, and see who is available, who is on leave and who is compliant to work."],
  ["payroll", "8 Payroll", "Payroll. UK tax, National Insurance and pension worked out per employee, payslips for staff, and journals you can post to Xero or QuickBooks."],
  ["learning", "9 Learning", "The Learning Centre. Assign courses to roles, and every completion is filed against the staff record."],
  ["credentials", "10 Compliance", "Compliance. DBS checks and certificates in one place, with reminders before anything lapses."],
  ["messages", "11 Messages", "Messages. Talk to families in one place, by session, by group or one to one."],
  ["setup", "12 Setup", "Setup. Your branding, your policies, which features are on, and who gets notified about what."],
];

test("record the product tour video", async ({ browser }) => {
  test.setTimeout(900_000);
  const { accounts } = loadAccounts();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-tour-"));
  fs.mkdirSync(OUT, { recursive: true });
  // sign in once, reuse the state for the recorded context
  const c0 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p0 = await c0.newPage();
  await p0.goto("/login");
  await p0.getByPlaceholder("you@example.com").fill(accounts.company.email);
  await p0.locator('input[type="password"]').fill(TEST_PASSWORD);
  await p0.getByRole("button", { name: "Sign in", exact: true }).click();
  await p0.waitForURL(/\/company/, { timeout: 60_000 });
  const state = await c0.storageState({ indexedDB: true });
  await c0.close();

  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const rec = new Rec(page, dir);
  await page.goto("/company/dashboard");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);
  rec.start();
  await rec.card("A two-minute tour of Activly", ["Bookings, staff, money and safeguarding", "in one login."], "Welcome to Activly. Here is a two minute tour of the screens you will use every day.", { tag: "PRODUCT TOUR", min: 6000 });
  await rec.hideCard();
  for (const [view, step, line] of SCENES) {
    await page.goto(`/company/${view}`).catch(() => {});
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(2200); // let the screen fill with data before the caption goes up
    await rec.cap(line, { step, min: 9500 });
  }
  await rec.card("Ready when you are", ["Book a demo, or start free for 7 days.", "A flat monthly fee. Never a cut of your bookings."], "That is Activly. Book a demo, or start your seven day trial. One flat monthly fee, and never a cut of your bookings.", { tag: "NEXT STEP", min: 6000 });
  const v = page.video()!;
  await ctx.close();
  const webm = await v.path();
  finish(rec, webm, path.join(OUT, "activly-tour.mp4"));
});
