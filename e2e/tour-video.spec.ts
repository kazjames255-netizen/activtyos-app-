import { test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAccounts, ROOT } from "./helpers/env";
import { TEST_PASSWORD } from "./helpers/accounts";

// Records the ~2 minute product tour (about 9 seconds on each key screen) against the REAL company portal of the standing e2e company account.
// It first (re)seeds that throwaway tenant with the "Riverside Sports Club" demo data (e2e/helpers/seedRiversideDemo.ts; TOUR_NO_SEED=1 skips),
// then only navigates and highlights. Every screen is waited on until genuinely ready (no Loading text / spinners / skeletons, the expected demo
// data on screen, no API-error banner) before its caption goes up, and a branded cover hides page loads so no half-loaded frame is ever recorded.
// Run only with RECORD_VIDEOS=1. TOUR_PROBE=1 = no audio/video, just a screenshot of every scene into $TOUR_PROBE_DIR (default scratch dir).
// Output: ~/Downloads/ActivityOS tour video/activly-tour.mp4 (British voice-over via macOS `say`, captions burned into the page).
const OUT = process.env.VIDEO_OUT || path.join(os.homedir(), "Downloads/ActivityOS tour video");
const PROBE = !!process.env.TOUR_PROBE;
const W = 1440, H = 900;

type Ev = { t: number; file: string };
class Rec {
  t0 = 0; evs: Ev[] = []; n = 0;
  constructor(public page: Page, public dir: string) {}
  start() { this.t0 = Date.now(); }
  private speak(text: string) {
    const f = path.join(this.dir, `vo-${this.n++}.aiff`);
    if (PROBE) return { f, dur: 0 };
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
    await this.page.waitForTimeout(PROBE ? 300 : Math.max(o.min ?? 8000, dur * 1000 + 700));
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
    await this.page.waitForTimeout(PROBE ? 300 : Math.max(o.min ?? 5000, dur * 1000 + 900));
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

// Runs inside every page BEFORE it renders: hides the Next dev badge/overlay and toasts, starts the head-office scope on "own operation" (not the
// all-franchises comparison board), and puts a branded cover over the page until the recorder says the screen is ready.
const INIT_JS = String.raw`(() => { try {
  try { localStorage.setItem("aos.ho.scope", "__ho__"); } catch (e) {}
  const boot = () => {
  const fix = (s) => s.replace(/e2e-[\w.-]+@activityos-test\.com/gi, "manager@example.com").replace(/e2e\s+company\s+\w+/gi, "Riverside Sports Club").replace(/e2e[ -][a-z]+[ -]\w{6,9}/gi, "Riverside");
  const sweep = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const v = n.nodeValue || ""; if (/e2e/i.test(v)) n.nodeValue = fix(v); } };
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") { const v = m.target.nodeValue || ""; if (/e2e/i.test(v)) m.target.nodeValue = fix(v); } m.addedNodes.forEach((a) => { if (a.nodeType === 3) { const v = a.nodeValue || ""; if (/e2e/i.test(v)) a.nodeValue = fix(v); } else sweep(a); }); } }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.__coverOn = true;
  const tick = () => {
    if (!document.getElementById("__aosstyle")) {
      const css = document.createElement("style");
      css.id = "__aosstyle";
      css.textContent = "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],#__next-build-watcher,[data-nextjs-dev-tools-button],[data-sonner-toaster],.Toastify{display:none!important}";
      (document.head || document.documentElement).appendChild(css);
    }
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
    sweep(document.documentElement);
    const c = document.getElementById("__cover");
    if (window.__coverOn) {
      if (!c) { const d = document.createElement("div"); d.id = "__cover"; d.setAttribute("style", "position:fixed;inset:0;z-index:2147483500;background:linear-gradient(135deg,#1d3a8f,#10195a);"); document.documentElement.appendChild(d); }
    } else if (c) c.remove();
  };
  setInterval(tick, 100);
  tick();
  };
  if (document.documentElement) boot(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); boot(); } }).observe(document, { childList: true });
} catch (e) { window.__initErr = String(e); } })();`;

/** True when the visible page has finished loading real content. Returns "" when ready, else the reason it is not. */
async function notReady(page: Page, expect: RegExp | null): Promise<string> {
  return page.evaluate((expectSrc) => {
    const body = document.body;
    if (!body) return "no body";
    const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(e as HTMLElement); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.top < innerHeight; };
    const text = (body as HTMLElement).innerText || "";
    if (/Couldn.t reach the server|Is the API running/i.test(text)) return "api-error";
    { const m = text.match(/.{0,25}e2e.{0,25}/i); if (m) { let where = ""; const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/e2e/i.test(n.nodeValue ?? "")) { where = `<${n.parentElement?.tagName}> "${(n.nodeValue ?? "").slice(0, 70)}" init=${typeof (window as unknown as { __coverOn?: boolean }).__coverOn}/${(window as unknown as { __initErr?: string }).__initErr ?? ""}`; break; } return `e2e wording on screen: ${m[0].replace(/\s+/g, " ")} @ ${where}`; } }
    if (/This page hit a problem|Application error/i.test(text)) return "app error page";
    if (/We couldn.t find that page/i.test(text)) return "api-error"; // transient dev-server 404 while a route compiles: reload (reuses the api-error retry)
    if (/\b(loading|please wait)\b/i.test(text) || /Loading[.…]/.test(text)) return "loading-text";
    const busy = Array.from(document.querySelectorAll('[aria-busy="true"],[role="progressbar"],.animate-spin,.animate-pulse,[class*="skeleton" i],[class*="spinner" i],[data-loading="true"]')).filter(vis);
    if (busy.length) return "spinner/skeleton";
    if (text.replace(/\s+/g, " ").length < 300) return "too little content";
    if (expectSrc && !new RegExp(expectSrc, "i").test(text)) return `waiting for /${expectSrc}/`;
    return "";
  }, expect ? expect.source : null);
}

type Scene = { view: string; step: string; line: string; expect: RegExp; prep?: (p: Page) => Promise<void> };
// view slug, step label, narration (kept to things the product really does today), the demo data that must be on screen
const ALL_SCENES: Scene[] = [
  { view: "dashboard", step: "1 Dashboard", expect: /Riverside|Half-Term|Whitfield|£\s?\d/, line: "Your dashboard: income, bookings and spaces left at a glance, updating live as parents book." },
  { view: "listings", step: "2 Listings", expect: /Half-Term Multi-Activity Camp/, line: "Listings. Build a camp or club once, with dates, prices and capacity, and see how full each one is." },
  { view: "bookings", step: "3 Bookings", expect: /Whitfield/, line: "Bookings. Who, what, when and whether it is paid, with waitlists and capacity handled for you." },
  { view: "customers", step: "4 Families", expect: /Whitfield/, line: "Families. Each family, their children, their bookings and their messages, kept together." },
  { view: "admin-registers", step: "5 Registers", expect: /Football|Ballet|register/i, line: "Registers. On the day, sign children in, see medical notes and collection details." },
  { view: "purchasing", step: "6 Money in", expect: /Whitfield|Holiday Activities|Grant/, line: "Money in. Parents pay into your own Stripe account, and Tax-Free Childcare is recorded against the booking by reference." },
  { view: "schedule", step: "7 Rota", expect: /Hannah/, line: "Staff schedule. Build the rota and publish it to your team." },
  { view: "payroll", step: "8 Payroll", expect: /October 2026|Run payroll/, line: "Payroll. Tax, National Insurance and pension per employee, payslips, and journals you can post to Xero or QuickBooks." },
  { view: "learning", step: "9 Learning", expect: /Safeguarding/, line: "The Learning Centre. Assign courses to roles, and every completion is filed against the staff record." },
  { view: "credentials", step: "10 Compliance", expect: /Hannah|Danny/, line: "Compliance. DBS checks and certificates in one place, with reminders before anything lapses." },
  { view: "messages", step: "11 Messages", expect: /Whitfield|Rahman|Hargreaves/, prep: async (p) => { await p.getByText(/Hargreaves/).first().click({ timeout: 8000 }); }, line: "Messages. Talk to families in one place, one to one or in groups." },
  { view: "setup", step: "12 Setup", expect: /Riverside/, line: "Setup. Your branding, your policies, which features are on, and who gets notified about what." },
];

// Families and Setup are left out to hold the tour to about two minutes
const SCENES = process.env.TOUR_ONLY ? ALL_SCENES.filter((s) => process.env.TOUR_ONLY!.split(",").includes(s.view)) : ALL_SCENES.filter((s) => !["customers", "setup"].includes(s.view));

/** Navigate and wait (up to 20 s per attempt) until the screen is genuinely ready; reload and retry on an API-error banner. Returns the last reason if never ready. */
async function openReady(page: Page, sc: Scene): Promise<string> {
  let why = "not tried";
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`/company/${sc.view}`).catch(() => {});
    await page.waitForLoadState("load").catch(() => {});
    if (sc.prep) await sc.prep(page).catch(() => {});
    const t0 = Date.now();
    let stable = 0;
    while (Date.now() - t0 < 20_000) {
      why = await notReady(page, sc.expect).catch(() => "evaluate failed");
      if (!why) { if (++stable >= 3) return ""; } else stable = 0; // ready on 3 consecutive checks (~1.2 s) so late-arriving rows can't slip past
      if (why === "api-error") break;
      await page.waitForTimeout(400);
    }
    if (why !== "api-error") return why; // only an API-error banner is worth a reload; anything else already had its 20 s
  }
  return why;
}

test("record the product tour video", async ({ browser }) => {
  test.setTimeout(1_500_000);
  const { accounts } = loadAccounts();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-tour-"));
  const probeDir = process.env.TOUR_PROBE_DIR || path.join(dir, "probe");
  fs.mkdirSync(OUT, { recursive: true });
  if (PROBE) fs.mkdirSync(probeDir, { recursive: true });

  if (!process.env.TOUR_NO_SEED) {
    console.log("seeding Riverside Sports Club demo data...");
    execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/seedRiversideDemo.ts")], { cwd: path.join(ROOT, "server"), stdio: "inherit", timeout: 600_000 });
  }

  // sign in once, reuse the state for the recorded context
  const c0 = await browser.newContext({ viewport: { width: W, height: H } });
  const p0 = await c0.newPage();
  await p0.goto("/login");
  await p0.getByPlaceholder("you@example.com").fill(accounts.company.email);
  await p0.locator('input[type="password"]').fill(TEST_PASSWORD);
  await p0.getByRole("button", { name: "Sign in", exact: true }).click();
  await p0.waitForURL(/\/company/, { timeout: 60_000 });
  const state = await c0.storageState({ indexedDB: true });
  await c0.close();

  // warm-up pass (not recorded): compiles every dev route and fills caches, so the recorded pass loads fast; also reports any scene that never gets ready
  const cw = await browser.newContext({ storageState: state, viewport: { width: W, height: H } });
  await cw.addInitScript({ content: INIT_JS });
  const pw = await cw.newPage();
  const problems: string[] = [];
  for (const sc of SCENES) {
    const why = await openReady(pw, sc);
    console.log(`warm ${sc.view}: ${why || "ready"}`);
    if (why) problems.push(`${sc.view}: ${why}`);
    if (PROBE) { await pw.evaluate(() => { (window as unknown as { __coverOn: boolean }).__coverOn = false; }); await pw.waitForTimeout(400); await pw.screenshot({ path: path.join(probeDir, `${sc.step.replace(/\W+/g, "_")}.png`) }); }
  }
  if (PROBE) console.log("BADGE:", await pw.evaluate(() => document.elementsFromPoint(38, 862).map((e) => `${e.tagName.toLowerCase()}#${e.id}.${String(e.className).slice(0, 40)}[${Array.from(e.attributes).map((a) => a.name).join(",")}]`).join(" > ")));
  if (PROBE) console.log("SHADOW HOSTS:", await pw.evaluate(() => Array.from(document.querySelectorAll("*")).filter((e) => e.shadowRoot).map((e) => `${e.tagName.toLowerCase()}#${e.id}.${e.className}@${e.parentElement?.tagName}`).join(" | ")));
  await cw.close();
  if (problems.length) console.warn("SCENES NOT READY:", problems.join("; "));
  if (PROBE) return;

  const ctx = await browser.newContext({ storageState: state, viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
  await ctx.addInitScript({ content: INIT_JS });
  const page = await ctx.newPage();
  const rec = new Rec(page, dir);
  rec.start(); // the video clock starts with the page
  await page.setContent('<html><body style="margin:0;background:#10195a"></body></html>');
  await rec.card("A two-minute tour of Activly", ["Bookings, staff, money and safeguarding", "in one login."], "Welcome to Activly. Here is a two minute tour.", { tag: "PRODUCT TOUR", min: 4500 });
  const skipped: string[] = [];
  for (const sc of SCENES) {
    // the intro card/cover stays up while the next screen loads and settles, so a half-loaded frame is never recorded
    const why = await openReady(page, sc);
    if (why) { skipped.push(`${sc.view} (${why})`); console.warn(`DROPPED scene ${sc.view}: ${why}`); continue; }
    await page.evaluate(() => { document.getElementById("__card")?.remove(); (window as unknown as { __coverOn: boolean }).__coverOn = false; });
    await page.waitForTimeout(500);
    await rec.cap(sc.line, { step: sc.step, min: 6500 });
    await page.evaluate(() => { document.getElementById("__cap")?.remove(); (window as unknown as { __coverOn: boolean }).__coverOn = true; });
  }
  await rec.card("Ready when you are", ["Book a demo, or start free for 7 days.", "A flat monthly fee. Never a cut of your bookings."], "That is Activly. Book a demo, or start your seven day trial.", { tag: "NEXT STEP", min: 5000 });
  const v = page.video()!;
  await ctx.close();
  const webm = await v.path();
  finish(rec, webm, path.join(OUT, "activly-tour.mp4"));
  console.log("TOUR DONE; dropped:", skipped.join(", ") || "none");
});
