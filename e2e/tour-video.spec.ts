import { test, type Locator, type Page } from "@playwright/test";
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
// Output: ~/Downloads/ActivityOS tour video/activly-tour.mp4 (no voice-over: captions burned into the page, a visible cursor doing real actions, and a synthesised music bed; MUSIC_FILE=path overrides the music).
const OUT = process.env.VIDEO_OUT || path.join(os.homedir(), "Downloads/ActivityOS tour video");
const PROBE = !!process.env.TOUR_PROBE;
const W = 1440, H = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const holdFor = (text: string) => 3000 + 300 * text.trim().split(/\s+/).length; // readable caption hold: about 3 s + 0.3 s per word
const DEMO_DRAFT = { id: "cdraft-demo", name: "Autumn term reminder (draft)", subtitle: "Plain email", audienceName: "All families", recipients: 12, status: "draft", subject: "Autumn term: what is coming up at Riverside", body: "Hi there, a quick look at what is coming up this term. See you soon!" };

class Rec {
  t0 = 0; spans: [number, number][] = []; open = -1;
  cues: { t: number; step: string; text: string }[] = [];
  constructor(public page: Page) {}
  now() { return (Date.now() - this.t0) / 1000; }
  start() { this.t0 = Date.now(); }
  /** the screen is on show from now (covers/loading stay OUT of the final cut) */
  show() { if (this.open < 0) this.open = this.now() + 0.2; }
  hide() { if (this.open >= 0) { const e = this.now() - 0.1; if (e > this.open + 0.5) this.spans.push([this.open, e]); this.open = -1; } }
  async cap(text: string, o: { step?: string } = {}) {
    this.cues.push({ t: this.now(), step: o.step ?? "", text });
    if (process.env.BURN_CAPTIONS !== "1") return; // the tour page shows captions in a panel beside the video (activly-tour-cues.json)
    await this.page.evaluate(({ text, step }) => {
      let d = document.getElementById("__cap"); if (!d) { d = document.createElement("div"); d.id = "__cap"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(10,18,50,.94);color:#fff;font:600 26px/1.35 system-ui,-apple-system,sans-serif;padding:20px 48px 20px 48px;display:flex;gap:20px;align-items:center;");
      d.innerHTML = (step ? `<span style="flex:none;background:#ffb703;color:#111;border-radius:999px;padding:4px 16px;font-size:20px;font-weight:800">${step}</span>` : "") + `<span>${text}</span>`;
    }, { text, step: o.step ?? "" });
  }
  async card(title: string, lines: string[], o: { tag?: string; ms: number }) {
    await this.page.evaluate(({ title, lines, tag }) => {
      document.getElementById("__cap")?.remove();
      let d = document.getElementById("__card"); if (!d) { d = document.createElement("div"); d.id = "__card"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483600;background:linear-gradient(135deg,#1d3a8f,#10195a);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 140px;");
      d.innerHTML = (tag ? `<div style="align-self:flex-start;background:#ffb703;color:#111;font-weight:800;font-size:22px;border-radius:999px;padding:6px 20px;margin-bottom:28px">${tag}</div>` : "") + `<div style="font-size:60px;font-weight:800;line-height:1.15;margin-bottom:30px">${title}</div>` + lines.map((l) => `<div style="font-size:30px;line-height:1.5;margin:6px 0;color:#dfe7ff">${l}</div>`).join("");
    }, { title, lines, tag: o.tag ?? "" });
    this.cues.push({ t: this.now(), step: o.tag ?? "", text: [title, ...lines].join(" ") });
    this.show();
    await this.page.waitForTimeout(PROBE ? 300 : o.ms);
    this.hide();
  }
}

/** Glide the visible cursor to the middle of a locator (or a point) and wait for it to arrive. */
async function moveTo(page: Page, target: Locator | { x: number; y: number }, wait = 800) {
  let pt: { x: number; y: number };
  if ("x" in target) pt = target;
  else {
    await target.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    const b = await target.boundingBox({ timeout: 4000 });
    if (!b) throw new Error("no box");
    pt = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 40) };
  }
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(PROBE ? 100 : wait);
}
async function clickAt(page: Page, target: Locator) {
  await moveTo(page, target);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  await page.waitForTimeout(PROBE ? 200 : 700);
}
const first = (page: Page, re: RegExp) => page.getByText(re).first();
const btn = (page: Page, re: RegExp) => page.getByRole("button", { name: re }).first();
async function safe(label: string, fn: () => Promise<void>) { try { await fn(); } catch (e) { console.warn(`  action failed [${label}]: ${String(e).split("\n")[0].slice(0, 150)}`); } }
/** Show text in a panel on top of the page (used for the browser alert that the Embed button raises, which a screen recording cannot capture). */
async function panel(page: Page, title: string, text: string) {
  await page.evaluate(({ title, text }) => {
    document.getElementById("__panel")?.remove();
    const d = document.createElement("div"); d.id = "__panel";
    d.setAttribute("style", "position:fixed;left:50%;top:50%;transform:translate(-50%,-56%);width:860px;max-width:90vw;z-index:2147482000;background:#fff;color:#111;border-radius:16px;box-shadow:0 20px 70px rgba(0,0,0,.45);padding:26px 32px;font:500 17px/1.5 system-ui,sans-serif");
    d.innerHTML = `<div style="font-weight:800;font-size:22px;margin-bottom:12px">${title}</div><pre style="white-space:pre-wrap;word-break:break-all;margin:0;font:500 15px/1.5 ui-monospace,Menlo,monospace;background:#f1f4fb;border-radius:10px;padding:14px">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
    document.documentElement.appendChild(d);
  }, { title, text });
}
const hidePanel = (page: Page) => page.evaluate(() => document.getElementById("__panel")?.remove());

// ── music bed: synthesised here (no downloads). Calm-upbeat C - Am - F - G loop at 96 bpm: soft triangle/sine pad, a gentle plucked arpeggio and a quiet pulse.
function makeMusic(dir: string, seconds: number): string {
  if (process.env.MUSIC_FILE) return process.env.MUSIC_FILE; // drop in a licensed track; it is looped/trimmed/faded in finish()
  const SR = 44100, n = Math.ceil(seconds * SR), beat = 60 / 96;
  const chords = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
  const buf = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR, bar = Math.floor(t / (beat * 4)), ch = chords[Math.floor(bar / 2) % 4];
    let pad = 0;
    for (const f of ch) { pad += Math.sin(2 * Math.PI * f * t) * 0.5 + (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * 0.5 * t)) * 0.45 + Math.sin(2 * Math.PI * f * 1.003 * t) * 0.25; }
    pad *= 0.12 * (0.8 + 0.2 * Math.sin((2 * Math.PI * t) / (beat * 8)));
    const step = Math.floor(t / (beat / 2)), st = t - step * (beat / 2);
    const note = [0, 1, 2, 1, 2, 1, 0, 1][step % 8] === undefined ? 0 : [0, 1, 2, 1, 2, 1, 0, 1][step % 8];
    const af = ch[note] * 2, arp = (Math.sin(2 * Math.PI * af * st) + 0.3 * Math.sin(2 * Math.PI * af * 2 * st)) * Math.exp(-st * 7) * 0.16 * Math.min(1, st * 400);
    const bt = t % beat, pulse = Math.sin(2 * Math.PI * (55 + 40 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 9) * 0.22 * (Math.floor(t / beat) % 2 === 0 ? 1 : 0.55);
    const root = Math.sin(2 * Math.PI * (ch[0] / 2) * t) * 0.1;
    const v = Math.max(-1, Math.min(1, pad + arp + pulse + root));
    const l = Math.round(v * 30000), r = Math.round((v * 0.92 + arp * 0.25) * 30000);
    buf.writeInt16LE(l, i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, r)), i * 4 + 2);
  }
  const hdr = Buffer.alloc(44); hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + buf.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(buf.length, 40);
  const f = path.join(dir, "music.wav"); fs.writeFileSync(f, Buffer.concat([hdr, buf])); return f;
}

/** Cut the cover/loading frames out (keep only the spans the recorder marked as on show), then lay captions' music bed under it. */
function finish(rec: Rec, webm: string, out: string, dir: string) {
  const spans = rec.spans;
  const total = spans.reduce((a, [s, e]) => a + (e - s), 0);
  const music = makeMusic(dir, total + 5);
  const vf = spans.map(([s, e], i) => `[0:v]trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},setpts=PTS-STARTPTS,fps=25[v${i}]`).join(";") + `;${spans.map((_, i) => `[v${i}]`).join("")}concat=n=${spans.length}:v=1:a=0[vout]`;
  const af = `[1:a]atrim=0:${(total + 0.2).toFixed(2)},lowpass=f=3200,aecho=0.8:0.55:380:0.22,loudnorm=I=-22:TP=-3:LRA=7,afade=t=in:st=0:d=2.5,afade=t=out:st=${Math.max(0, total - 3.5).toFixed(2)}:d=3.5[aout]`;
  const args = ["-y", "-i", webm, ...(process.env.MUSIC_FILE ? ["-stream_loop", "-1"] : []), "-i", music, "-filter_complex", `${vf};${af}`, "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "25", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out];
  execFileSync("ffmpeg", args, { stdio: "pipe" });
  // caption cues on the FINAL timeline (the cut-out cover frames shift everything), for the side panel on the tour page
  const mapT = (t: number) => { let off = 0; for (const [a, b] of spans) { if (t < a) return off; if (t <= b) return off + (t - a); off += b - a; } return off; };
  const starts = rec.cues.map((c) => ({ ...c, t: +mapT(c.t).toFixed(2) })).sort((x, y) => x.t - y.t);
  const cues = starts.map((c, i) => ({ start: c.t, end: +(i + 1 < starts.length ? starts[i + 1].t : total).toFixed(2), step: c.step, text: c.text })).filter((c) => c.end - c.start > 0.4);
  fs.writeFileSync(path.join(path.dirname(out), "activly-tour-cues.json"), JSON.stringify(cues, null, 1));
  const webDir = path.join(ROOT, "public/v2/video"); if (fs.existsSync(webDir)) fs.writeFileSync(path.join(webDir, "activly-tour-cues.json"), JSON.stringify(cues));
  console.log(`final length ${total.toFixed(1)} s from ${spans.length} spans`);
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
  const mkCursor = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div"); c.id = "__cur";
    c.setAttribute("style", "position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(" + (window.__curX ?? 720) + "px," + (window.__curY ?? 460) + "px);transition:transform .7s cubic-bezier(.45,.05,.2,1);filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))");
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M2 1.5 L2 19 L6.6 14.6 L9.8 21.8 L13 20.4 L9.9 13.4 L16.2 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
  };
  document.addEventListener("mousemove", (e) => { window.__curX = e.clientX; window.__curY = e.clientY; mkCursor(); const c = document.getElementById("__cur"); if (c) c.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
  document.addEventListener("mousedown", (e) => {
    mkCursor();
    const r = document.createElement("div");
    r.setAttribute("style", "position:fixed;left:" + (e.clientX - 22) + "px;top:" + (e.clientY - 22) + "px;width:44px;height:44px;border-radius:50%;border:4px solid #ffb703;background:rgba(255,183,3,.25);z-index:2147483646;pointer-events:none");
    document.documentElement.appendChild(r);
    r.animate([{ transform: "scale(.3)", opacity: 1 }, { transform: "scale(1.9)", opacity: 0 }], { duration: 650, easing: "ease-out" }).onfinish = () => r.remove();
  }, true);
  const tick = () => {
    mkCursor();
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

type Ctx = { page: Page; dialogs: string[] };
type Beat = { cap: string; act?: (c: Ctx) => Promise<void> };
type Scene = { view: string; path?: string; step: string; expect: RegExp; beats: Beat[]; prep?: (p: Page) => Promise<void> };
const wander = async (p: Page, pts: [number, number][]) => { for (const [x, y] of pts) await moveTo(p, { x, y }, 700); };

// view slug, step label, captions (kept to things the product really does today, each checked against the real screen/route), the demo data that must be on screen
const ALL_SCENES: Scene[] = [
  { view: "dashboard", step: "Dashboard", expect: /Riverside|Half-Term|Whitfield|£\s?\d/, beats: [
    { cap: "Your dashboard: income, bookings and spaces left at a glance, updating live as parents book.", act: async ({ page }) => wander(page, [[420, 300], [760, 300], [1100, 320], [700, 560]]) },
  ] },
  { view: "listings", step: "Listings", expect: /Half-Term Multi-Activity Camp/, beats: [
    { cap: "Listings: every camp and club with its own cover photo, price, dates and places left.", act: async ({ page }) => wander(page, [[330, 430], [700, 430], [1080, 430]]) },
    { cap: "Share a booking link or QR code for any listing, so parents can book and pay online.", act: async ({ page }) => { await safe("link", async () => { await clickAt(page, btn(page, /\blink\b/i)); }); } },
    { cap: "Embed puts a Book now button on your own website with one line of code.", act: async ({ page }) => {
      // The Embed button now opens the "Add booking to your website" panel (code box + Copy), not a browser alert.
      await safe("embed", async () => { await clickAt(page, btn(page, /embed/i)); await page.waitForTimeout(1200); await wander(page, [[640, 300], [640, 520]]); await page.keyboard.press("Escape"); });
    } },
  ] },
  { view: "setup", path: "/company/setup?tab=cancel", step: "Cancellations", expect: /Cancellation|refund/i, beats: [
    { cap: "Cancellations: pick a policy per listing, with refunds back to the parent's card or wallet.", act: async ({ page }) => wander(page, [[500, 330], [800, 450], [600, 600]]) },
  ] },
  { view: "marketing", step: "Discount codes", expect: /HALFTERM10/, beats: [
    { cap: "Discount codes and vouchers: percentage or fixed-amount codes with limits and expiry dates.", act: async ({ page }) => { await safe("row", async () => { await moveTo(page, first(page, /HALFTERM10/)); }); await wander(page, [[800, 420], [600, 520]]); } },
  ] },
  { view: "setup", path: "/company/setup?tab=memberships", step: "Memberships", expect: /Riverside Silver/, beats: [
    { cap: "Memberships for parents: tiers that give wallet credit or a standing discount at checkout.", act: async ({ page }) => {
      // this screen is the setup form; the monthly-price field and the "every month" wording belong to billing that is not live yet, so they are hidden for the recording
      await page.evaluate(() => {
        document.querySelectorAll("label").forEach((l) => { if (/^\s*price/i.test(l.textContent || "")) (l as HTMLElement).style.visibility = "hidden"; });
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const v = n.nodeValue || ""; if (/monthly plan|Each tier|Recurring billing/i.test(v)) n.nodeValue = "Offer families membership tiers. Each tier gives parents wallet credit or a standing discount at checkout."; else if (/\/\s*month|every month/i.test(v)) n.nodeValue = v.replace(/\s*\/\s*month/gi, "").replace(/\s*every month/gi, ""); }
      });
      await wander(page, [[500, 350], [800, 450], [600, 600]]);
    } },
  ] },
  { view: "bookings", step: "Bookings", expect: /Whitfield/, beats: [
    { cap: "Bookings: who, what, when and whether it is paid, with waitlists and capacity handled for you.", act: async ({ page }) => { await safe("open", async () => { await clickAt(page, first(page, /Whitfield/)); }); } },
  ] },
  { view: "admin-registers", step: "Registers", expect: /Football|Ballet|register/i, beats: [
    { cap: "Registers: on the day, sign children in and see medical notes and collection details.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "email", step: "Email campaigns", expect: /Half-term camp|campaign/i, beats: [
    { cap: "Email campaigns: send to the right families, with every sent campaign and its open rate kept on file.", act: async ({ page }) => { await safe("campaigns", async () => { await clickAt(page, first(page, /^Campaigns$/)); await page.waitForTimeout(900); }); await wander(page, [[600, 520], [900, 620]]); } },
    { cap: "Compose from a template, choose an audience, then send now or schedule for later.", act: async ({ page }) => {
      await safe("compose", async () => {
        await clickAt(page, first(page, /^Compose$/));
        const subj = page.getByText(/^subject$/i).first().locator("xpath=following::input[1]");
        await clickAt(page, subj); await subj.pressSequentially("Autumn term: what is coming up at Riverside", { delay: 45 });
      });
    } },
  ] },
  { view: "newsfeed", step: "Newsfeed", expect: /what to bring|Tennis/i, beats: [
    { cap: "Newsfeed: post news and event updates for all your families.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "moments", step: "Moments", expect: /Sack race|Rally/i, beats: [
    { cap: "Moments: share photos and highlights from the day with parents.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "incidents", step: "Log concern", expect: /concern|incident|Behaviour/i, beats: [
    { cap: "Log a concern or incident, with who was involved, what happened and what was done.", act: async ({ page }) => { await safe("new", async () => { await clickAt(page, btn(page, /log.*concern/i)); }); } },
  ] },
  { view: "accidents", step: "First aid", expect: /Poppy|Alfie|first aid/i, beats: [
    { cap: "First aid: accident records with treatment given and who the first aider was.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "medication", step: "Medication", expect: /Salbutamol|EpiPen/i, beats: [
    { cap: "Medication: parental consent, dose and storage on record, and a log of every dose given.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "tasks", step: "Task manager", expect: /Task manager/i, beats: [
    { cap: "Task manager: hand jobs to your team with due dates and priorities, and tick them off.", act: async ({ page }) => { await safe("board", async () => { await clickAt(page, btn(page, /^Board$/)); await page.waitForTimeout(900); }); await wander(page, [[500, 520], [900, 560]]); } },
  ] },
  { view: "purchasing", step: "Money in", expect: /Whitfield|Holiday Activities|Grant/, beats: [
    { cap: "Money in: parents pay into your own Stripe account, and Tax-Free Childcare and childcare vouchers are recorded against the booking by reference.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "schedule", step: "Rota", expect: /Hannah/, beats: [
    { cap: "Staff schedule: build the rota by week, by area or by team member, with the wage cost worked out as you roster.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
    { cap: "Availability: ask your team when they can work. They answer from their own portal and you roster from their replies.", act: async ({ page }) => { await safe("availability", async () => { await clickAt(page, btn(page, /^availability$/i)); await page.waitForTimeout(1200); }); await wander(page, [[600, 420], [820, 520]]); } },
    { cap: "Staff checks as you roster: lapsed DBS, first aid and training are flagged on the rota before anyone is put on a session.", act: async ({ page }) => { await safe("rota tab", async () => { await clickAt(page, btn(page, /^rota$/i)); await page.waitForTimeout(1200); }); await wander(page, [[520, 400], [900, 470], [700, 560]]); } },
    { cap: "Happy with the week? Publish the rota to your team in one click.", act: async ({ page }) => wander(page, [[1180, 330], [900, 470]]) },
  ] },
  { view: "payroll", step: "Payroll", expect: /October 2026|Run payroll/, beats: [
    { cap: "Payroll: tax, National Insurance and pension, payslips, and journals you can post to Xero or QuickBooks.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "learning", step: "Learning", expect: /Safeguarding/, beats: [
    { cap: "The Learning Centre: assign courses to roles, and every completion is filed against the staff record.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "credentials", step: "Compliance", expect: /Hannah|Danny/, beats: [
    { cap: "Compliance: DBS checks and certificates in one place, with reminders before anything lapses.", act: async ({ page }) => wander(page, [[500, 350], [800, 450], [600, 600]]) },
  ] },
  { view: "messages", step: "Messages", expect: /Whitfield|Rahman|Hargreaves/, beats: [
    { cap: "Messages: talk to families in one place, one to one or in groups.", act: async ({ page }) => { await safe("thread", async () => { await clickAt(page, first(page, /Hargreaves/)); await page.waitForTimeout(2500); }); } },
  ] },
];

// Families and Setup are left out to hold the tour to about three minutes
const SCENES = process.env.TOUR_ONLY ? ALL_SCENES.filter((s) => process.env.TOUR_ONLY!.split(",").includes(s.view)) : ALL_SCENES;

/** Navigate and wait (up to 20 s per attempt) until the screen is genuinely ready; reload and retry on an API-error banner. Returns the last reason if never ready. */
async function openReady(page: Page, sc: Scene): Promise<string> {
  let why = "not tried";
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(sc.path ?? `/company/${sc.view}`).catch(() => {});
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
  }
  await cw.close();
  if (problems.length) console.warn("SCENES NOT READY:", problems.join("; "));

  // recorded at double pixel density (2x): Playwright's built-in capture is low-bitrate, and 2x keeps the text crisp after compression
  const ctx = await browser.newContext({ storageState: state, viewport: { width: W, height: H }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"], ...(PROBE ? {} : { recordVideo: { dir, size: { width: W * 2, height: H * 2 } } }) });
  await ctx.addInitScript({ content: INIT_JS });
  // a seeded email DRAFT for the Email view (drafts live in the browser); nothing is ever sent
  await ctx.addInitScript({ content: `try { if (!localStorage.getItem("aos.email.campaigns.v1")) localStorage.setItem("aos.email.campaigns.v1", ${JSON.stringify(JSON.stringify([DEMO_DRAFT]))}); } catch (e) {}` });
  const page = await ctx.newPage();
  const dialogs: string[] = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); d.accept().catch(() => {}); });
  const rec = new Rec(page);
  rec.start(); // the video clock starts with the page
  await page.setContent('<html><body style="margin:0;background:#10195a"></body></html>');
  await rec.card("A three-minute tour of Activly", ["Bookings, staff, money and safeguarding", "in one login."], { tag: "PRODUCT TOUR", ms: 4200 });
  const skipped: string[] = [];
  let sceneNo = 0;
  for (const sc of SCENES) {
    sceneNo++;
    // the cover stays up while the next screen loads and settles; those frames are cut from the final video
    const why = await openReady(page, sc);
    if (why) { skipped.push(`${sc.view} (${why})`); console.warn(`DROPPED scene ${sc.view}: ${why}`); continue; }
    await page.evaluate(() => { document.getElementById("__card")?.remove(); (window as unknown as { __coverOn: boolean }).__coverOn = false; });
    await page.waitForTimeout(450);
    await page.mouse.move(720, 470); // cursor starts mid-screen on every new page
    rec.show();
    let bi = 0;
    for (const b of sc.beats) {
      bi++;
      const t1 = Date.now();
      await rec.cap(b.cap, { step: sc.step });
      if (b.act) await b.act({ page, dialogs }).catch((e) => console.warn(`  beat failed ${sc.view}#${bi}: ${String(e).slice(0, 120)}`));
      const left = holdFor(b.cap) - (Date.now() - t1);
      await page.waitForTimeout(PROBE ? 300 : Math.max(500, left));
      if (PROBE) await page.screenshot({ path: path.join(probeDir, `${String(sceneNo).padStart(2, "0")}-${sc.view}-b${bi}.jpg`), type: "jpeg", quality: 60 });
      await hidePanel(page);
    }
    rec.hide();
    await page.evaluate(() => { document.getElementById("__cap")?.remove(); (window as unknown as { __coverOn: boolean }).__coverOn = true; });
  }
  await page.evaluate(() => { (window as unknown as { __coverOn: boolean }).__coverOn = false; document.getElementById("__cur")?.remove(); });
  await rec.card("Ready when you are", ["Book a demo, or start free for 7 days.", "A flat monthly fee. Never a cut of your bookings.", "Also built in: meals, trips and consent, ratios, calendar, timetable, referrals and reviews."], { tag: "NEXT STEP", ms: 5500 });
  if (PROBE) { console.log("PROBE DONE; dropped:", skipped.join(", ") || "none"); return; }
  const v = page.video()!;
  await ctx.close();
  const webm = await v.path();
  finish(rec, webm, path.join(OUT, "activly-tour.mp4"), dir);
  console.log("TOUR DONE; dropped:", skipped.join(", ") || "none");
});
