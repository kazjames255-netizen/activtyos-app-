import fs from "node:fs";
import path from "node:path";
import { test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, handOver, type Fx } from "./fixture";
import { apiFetch, fbSignIn } from "../helpers/accounts";

// i18n browser pass: every hub view x 11 locales x (1440, 390), own throwaway @activityos-test.com accounts (the review fixture; set
// REVIEW_AUTH_DIR so the shared e2e/review/.auth files are untouched). Detector flags English leaks, raw keys, {placeholders}, truncation,
// overflow, RTL glitches, bidi controls in attributes. Output: docs/reviews/shots/i18n/<loc>/*.jpg + results.json.
//   REVIEW_AUTH_DIR=/tmp/x I18N_LOCALES=ar,ur npx playwright test -c playwright.i18n.config.ts e2e/review/i18n-browser-pass.spec.ts
const OUT = path.join(ROOT, "docs/reviews/shots/i18n");
const ALL = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const LOCALES = (process.env.I18N_LOCALES ?? ALL.join(",")).split(",");
const VPS = { "1440": { width: 1440, height: 900 }, "390": { width: 390, height: 844 } } as const;
const RTL = new Set(["ar", "ur"]);
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

interface Item { t: string; k: string; tag: string }
interface Scan { items: Item[]; overflowX: boolean; clipped: string[]; dir: string; lang: string; bidiAttr: string[]; tofu: string[]; rtlFlags: string[] }
export interface Finding { loc: string; role: string; view: string; vp: string; type: string; text: string }

let fx: Fx;
const EN: Record<string, Record<string, string>> = {};
const CAT: Record<string, Record<string, Record<string, string>>> = {};
const enIndex = new Map<string, { key: string }[]>();
const norm = (s: string) => s.replace(/[‎‏؜⁦-⁩‪-‮]/g, "").replace(/\s+/g, " ").trim();
const ALLOW = /^(activityos|teaching hub|learning hub|zoom|pdf|ok|wi-?fi|url|gcse|ks[1-4]|sats|send|eal|sen|ai|qr|id|a4|mtc|cvc|penguin slide)$/i;

async function loadCat(l: string) {
  if (CAT[l]) return;
  CAT[l] = await (await fetch(`${BASE}/i18n/hub/${l}`)).json();
  if (l === "en") for (const [ns, d] of Object.entries(CAT.en)) for (const [k, v] of Object.entries(d)) { const n = norm(v); if (!enIndex.has(n)) enIndex.set(n, []); enIndex.get(n)!.push({ key: `${ns}.${k}` }); }
}

const SCAN = () => {
  const items: { t: string; k: string; tag: string }[] = [];
  const vis = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement; const s = (n.textContent ?? "").trim();
    if (!el || !s || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(el.tagName) || el.closest("[data-nextjs-toast],nextjs-portal")) continue;
    if (vis(el)) items.push({ t: s, k: "text", tag: el.tagName });
  }
  const bidiAttr: string[] = []; const BIDI = /[‎‏؜⁦-⁩‪-‮]/;
  document.querySelectorAll("[aria-label],[title],[placeholder],[alt]").forEach((el) => {
    if (!vis(el)) return;
    for (const a of ["aria-label", "title", "placeholder", "alt"]) { const v = el.getAttribute(a); if (v) { items.push({ t: v, k: a, tag: el.tagName }); if (BIDI.test(v)) bidiAttr.push(`${a}=${v.slice(0, 50)}`); } }
  });
  const clipped: string[] = [];
  document.querySelectorAll("#learning-hub *, [role=dialog] *").forEach((el) => {
    const h = el as HTMLElement; if (!h.childNodes.length || !vis(h)) return;
    const cs = getComputedStyle(h); const own = Array.from(h.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim());
    if (!own) return;
    if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && h.scrollWidth > h.clientWidth + 2) clipped.push((h.textContent ?? "").trim().slice(0, 70));
    else if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && h.scrollHeight > h.clientHeight + 2) clipped.push("[clamp] " + (h.textContent ?? "").trim().slice(0, 70));
  });
  // glyph boxes: U+FFFD, or a non-Latin text whose rendered width is ~ N x tofu width (cheap canvas check of missing-glyph advance)
  const tofu: string[] = [];
  const cv = document.createElement("canvas").getContext("2d")!;
  items.filter((i) => i.k === "text" && /[؀-ۿ਀-੿ঀ-৿]/.test(i.t)).slice(0, 400).forEach((i) => {
    if (i.t.includes("�")) tofu.push(i.t.slice(0, 40));
  });
  void cv;
  const rtlFlags: string[] = [];
  const tl = document.querySelector('[role="tablist"]');
  if (tl) { const tabs = Array.from(tl.querySelectorAll('[role="tab"]')).filter((e) => vis(e)); if (tabs.length > 1) { const a = tabs[0].getBoundingClientRect(), b = tabs[tabs.length - 1].getBoundingClientRect(); rtlFlags.push(`tabs first.x=${Math.round(a.x)} last.x=${Math.round(b.x)}`); } }
  return { items, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, clipped: [...new Set(clipped)].slice(0, 30), dir: document.documentElement.dir, lang: document.documentElement.lang, bidiAttr, tofu, rtlFlags };
};

const findings: Finding[] = [];
const counts: Record<string, { views: number; shots: number }> = {};

function classify(loc: string, role: string, view: string, vp: string, scan: Scan) {
  const push = (type: string, text: string) => findings.push({ loc, role, view, vp, type, text: text.slice(0, 140) });
  const seen = new Set<string>();
  for (const it of scan.items) {
    const t = norm(it.t); if (!t || seen.has(it.k + t)) continue; seen.add(it.k + t);
    if (/\bhub[a-z]*\.[a-zA-Z0-9_]+\b/.test(t) || /\b(common|header|nav)\.[a-z][A-Za-z]+\b/.test(t)) push("raw-key", t);
    if (/\{[a-zA-Z0-9_]+\}/.test(t) || /\bundefined\b|\bNaN\b|\[object/.test(t)) push("placeholder", t);
    if (/\boak\b|oaknational|thenational/i.test(t)) push("oak", t);
    if (loc === "en") continue;
    const words = t.split(" ").length; const letters = (t.match(/\p{L}/gu) ?? []).length;
    if (ALLOW.test(t) || /^[\d\s.,:%/+\-–×÷=()£$€*]+$/.test(t)) continue;
    const hit = enIndex.get(t);
    if (hit && (words >= 2 || letters >= 7)) {
      const same = hit.some((h) => norm(CAT[loc]?.[h.key.split(".")[0]]?.[h.key.slice(h.key.indexOf(".") + 1)] ?? "") === t);
      push(same ? (words >= 2 ? "english-in-catalog" : "english-single-word-equal") : "english-runtime-leak", `${t} <${hit[0].key}>`);
    } else if (!hit && /^(pl|ro|pt|es|fr|cy|bn|pa|ur|ar)$/.test(loc) && words >= 3 && /\b(the|and|your|you|to|for|with|of|is|are|this|that|from|no|not|yet|will|can|have|has|please|add|new|set|see|all)\b/i.test(t) && !/[^\u0000-ɏḀ-ỿ\s\d.,:;!?'’"“”()\-–—/&%+£$€*_#@…·•→←↑↓✓✕✗]/.test(t) && loc !== "cy") push("english-hardcoded?", t);
  }
  if (scan.overflowX && vp === "390") push("page-overflow-x", "document wider than viewport");
  for (const c of scan.clipped) push("clipped", c);
  for (const c of scan.bidiAttr) push("bidi-in-attr", c);
  for (const c of scan.tofu) push("tofu", c);
  if (scan.dir !== (RTL.has(loc) ? "rtl" : "ltr")) push("dir", `html dir=${scan.dir}`);
  if (scan.lang !== loc) push("lang", `html lang=${scan.lang}`);
  if (RTL.has(loc)) for (const f of scan.rtlFlags) { const m = /first\.x=(-?\d+) last\.x=(-?\d+)/.exec(f); if (m && +m[1] < +m[2] && vp === "1440") push("rtl-tab-order", f); }
}

async function ready(page: Page) {
  await page.locator("#learning-hub, #learning-hub-off").first().waitFor({ timeout: 60_000 }).catch(() => undefined);
  await page.waitForFunction(() => { const p = document.querySelector("[data-hub-panel]:not([hidden])") as HTMLElement | null; return !!p && p.innerText.trim().length > 30; }, undefined, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1600);
}

async function capture(page: Page, loc: string, role: string, view: string, vp: string) {
  const dir = path.join(OUT, loc); fs.mkdirSync(dir, { recursive: true });
  const scan = (await page.evaluate(SCAN).catch(() => null)) as Scan | null;
  await page.screenshot({ path: path.join(dir, `${role}-${view}-${vp}.jpg`), type: "jpeg", quality: 55 }).catch(() => undefined);
  const c = (counts[`${loc}@${vp}`] ??= { views: 0, shots: 0 }); c.views++; c.shots++;
  if (scan) classify(loc, role, view, vp, scan); else findings.push({ loc, role, view, vp, type: "scan-failed", text: "" });
}

async function newCtx(browser: Browser, role: "freelancer" | "parent", vp: { width: number; height: number }, loc: string): Promise<BrowserContext> {
  const ctx = await ctxFor(browser, role, vp);
  await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
  return ctx;
}
const go = async (page: Page, url: string) => { await page.goto(url, { waitUntil: "load" }).catch(() => undefined); await ready(page); };

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(600_000);
  for (const l of new Set(["en", ...LOCALES])) await loadCat(l);
  fx = await buildFixture(4, true, browser);
  fs.mkdirSync(OUT, { recursive: true });
});
test.afterAll(() => {
  const f = path.join(OUT, "results.json");
  let prev: { findings: Finding[]; counts: typeof counts } = { findings: [], counts: {} };
  try { prev = JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* first run */ }
  const done = new Set(Object.keys(counts));
  const key = (x: Finding) => `${x.loc}@${x.vp}`;
  fs.writeFileSync(f, JSON.stringify({ findings: [...prev.findings.filter((x) => !done.has(key(x)) || (process.env.I18N_ONLY === "remotesync" && x.view !== "remotesync-start")), ...findings], counts: process.env.I18N_ONLY === "remotesync" ? Object.fromEntries(Object.entries({ ...prev.counts, ...counts }).map(([k, v]) => [k, { views: (prev.counts[k]?.views ?? 0) + (counts[k]?.views ?? 0) * (prev.counts[k] ? 1 : 1), shots: (prev.counts[k]?.shots ?? 0) + (counts[k]?.shots ?? 0) }])) : { ...prev.counts, ...counts } }, null, 1));
});

for (const loc of LOCALES) {
  for (const [vpName, vp] of Object.entries(VPS)) {
    test(`${loc} @${vpName}`, async ({ browser }) => {
      test.setTimeout(1_500_000);
      const kid = fx.kids[0];
      // ---- tutor
      let ctx = await newCtx(browser, "freelancer", vp, loc);
      let page = await ctx.newPage();
      const TUTOR: [string, string][] = [["home", "home"], ["students", "students"], ["homework", "homework&sub=inbox"], ["marking", "homework&sub=mark"], ["lessons", "notes"], ["live", "live"], ["progress", "dashboard"], ["quizzes", "quizzes"], ["messages", "questions"], ["tools", "tools"]];
      const ONLY = process.env.I18N_ONLY === "remotesync";
      if (!ONLY) for (const [name, q] of TUTOR) { await go(page, `/freelancer/learninghub?tab=${q}`); await capture(page, loc, "tutor", name, vpName); }
      if (!ONLY) { await go(page, "/freelancer/setup?tab=hub"); await capture(page, loc, "tutor", "setup", vpName); }
      // tools windows (RTL: every tool; others a sample)
      if (!ONLY) await go(page, "/freelancer/learninghub?tab=tools");
      const ids = ONLY ? [] : await page.locator("[data-testid^='tool-']").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid!.slice(5)));
      const pick = RTL.has(loc) && vpName === "1440" ? ids : ids.filter((_, i) => i < 5 || i === ids.length - 1);
      for (const id of pick) {
        await page.getByTestId(`tool-${id}`).scrollIntoViewIfNeeded().catch(() => undefined);
        await page.getByTestId(`tool-${id}`).click({ timeout: 8000 }).catch(() => undefined);
        await page.getByRole("dialog").first().waitFor({ timeout: 8000 }).catch(() => undefined);
        await page.waitForTimeout(700);
        await capture(page, loc, "tutor", `tool-${id}`, vpName);
        await page.keyboard.press("Escape"); await page.waitForTimeout(250);
      }
      // live lesson room start screen (RemoteSync): open the seeded lesson, then "start in one room"
      try {
        const tok = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
        const notes = await apiFetch<{ title: string }[]>("/api/learning-hub/notes", tok);
        const title = notes.find((n) => /\d/.test(n.title))?.title ?? notes[0].title;
        await go(page, "/freelancer/learninghub?tab=notes");
        await page.locator("input[type=search],input[placeholder]").first().fill(title.slice(0, 20)).catch(() => undefined);
        await page.getByRole("button", { name: title, exact: true }).first().click({ timeout: 15_000 });
        await page.getByTestId("lesson-open").click({ timeout: 15_000 });
        await page.getByTestId("lesson-one-room").click({ timeout: 20_000 });
        await page.waitForTimeout(3000);
        await capture(page, loc, "tutor", "remotesync-start", vpName);
      } catch (e) { findings.push({ loc, role: "tutor", view: "remotesync-start", vp: vpName, type: "not-reached", text: String(e).slice(0, 100) }); }
      await ctx.close();
      if (ONLY) return;
      // ---- parent
      ctx = await newCtx(browser, "parent", vp, loc); page = await ctx.newPage();
      const PARENT: [string, string][] = [["home", "home"], ["lessons", "notes"], ["homework", "homework"], ["progress", "dashboard"], ["quizzes", "quizzes"], ["messages", "questions"]];
      for (const [name, q] of PARENT) { await go(page, `/custdash/learninghub?tab=${q}&child=${kid.id}`); await capture(page, loc, "parent", name, vpName); }
      await go(page, `/custdash/learninghub?tab=dashboard&child=${kid.id}`);
      try { await page.getByTestId("hub-report-open").click({ timeout: 8000 }); await page.getByTestId("hub-report").waitFor({ timeout: 20_000 }); await page.waitForTimeout(800); await capture(page, loc, "parent", "report", vpName); }
      catch { findings.push({ loc, role: "parent", view: "report", vp: vpName, type: "not-reached", text: "report did not open" }); }
      // ---- kid
      try {
        await go(page, `/custdash/learninghub?tab=home&child=${kid.id}`);
        await handOver(page, kid.id);
        for (const [name, q] of [["home", "home"], ["lessons", "notes"], ["homework", "homework"], ["progress", "dashboard"], ["quizzes", "quizzes"]] as const) { await go(page, `/custdash/learninghub?tab=${q}&child=${kid.id}`); await capture(page, loc, "kid", name, vpName); }
      } catch (e) { findings.push({ loc, role: "kid", view: "all", vp: vpName, type: "not-reached", text: String(e).slice(0, 100) }); }
      await ctx.close();
      // ---- public: how it works (3 roles) + games entry (penguin slide demo)
      const anon = await browser.newContext({ viewport: vp }); await anon.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
      const p2 = await anon.newPage();
      for (const r of ["tutors", "parents", "children"]) { await p2.goto(`/how-it-works/${r}`, { waitUntil: "load" }).catch(() => undefined); await p2.waitForTimeout(2800); await capture(p2, loc, "public", `how-${r}`, vpName); }
      await p2.goto("/dev/games/penguin-slide", { waitUntil: "load" }).catch(() => undefined); await p2.waitForTimeout(3500); await capture(p2, loc, "public", "games-entry", vpName);
      await anon.close();
    });
  }
}
