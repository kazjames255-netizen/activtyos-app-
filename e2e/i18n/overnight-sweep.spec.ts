import fs from "node:fs";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { NAV_GROUPS, PORTALS, type PortalKey } from "../../lib/nav/config";
import { CATALOGS } from "../../lib/i18n/messages";
import { lazyCatalog } from "../../lib/i18n/messages/lazy";
import { loadAccounts, statePath, type Role } from "../helpers/env";

// Overnight full-site i18n sweep. For every public page and every nav view of every portal, in each chosen locale, it asserts:
//   - no raw catalogue keys on screen           - no uncaught page errors           - no horizontal overflow (checked in every locale, it matters most in RTL)
// and REPORTS (per page, to OVERNIGHT_OUT/<name>.json + summary.csv) two leftover-English measures:
//   cat  = visible text that equals an English catalogue value exactly (a key is wired but the locale still shows English)
//   heur = visible text that reads as English (stop-word heuristic for Latin locales; any 4+ letter Latin word for ur/pa/bn/ar)
// Set OVERNIGHT_STRICT=1 to also fail a page when cat > 0.
//   OVERNIGHT_LOCALES=ar,ur,ro,es  OVERNIGHT_PORTALS=company,parent,public  OVERNIGHT_OUT=/tmp/overnight  scripts/e2e-locked.sh e2e/i18n/overnight-sweep.spec.ts
const ROLE: Record<PortalKey, Role> = { company: "company", franchise: "franchise", freelancer: "freelancer", staff: "staff", custdash: "parent", platform: "platform" };
const LOCALES = (process.env.OVERNIGHT_LOCALES ?? "ar,ur,ro,es").split(",");
const ONLY = (process.env.OVERNIGHT_PORTALS ?? `public,${PORTALS.join(",")}`).split(",");
const OUT = process.env.OVERNIGHT_OUT ?? "/tmp/overnight";
const STRICT = process.env.OVERNIGHT_STRICT === "1";
const NON_LATIN = new Set(["ur", "pa", "bn", "ar"]);
// Text the detector must not count as "untranslated English": this run's own test data, product/brand and official UK terms.
const DATA = /\bE2E\b|\bmun[a-z0-9]{4,}\b|@activityos-test/;
const ALLOW = /\b(Activ|ActivityLane|ActivityLane|Stripe|HMRC|DBS|Ofsted|PayPal|Xero|Sage|QuickBooks|WhatsApp|Google|Gmail|Trustpilot|PAYE|Tax-Free Childcare|KCSIE|SEND|EHCP|VAT|PDF|CSV|Excel|Word|Zoom|Meta|Facebook|Instagram|Canva|Teaching Hub|My Classroom)\b/g;
// Next.js dev-server / dev-tools noise that is not an application error.
const NOISE = /Failed to execute 'measure' on 'Performance'|Router action dispatched before initialization|ResizeObserver loop/;
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|no|not|yet|will|can|have|has|all|new|add|edit|delete|save|cancel|view|search|select)\b/i;
const PUBLIC_PATHS = ["/login", "/signup", "/how-it-works", "/how-it-works/parent", "/how-it-works/operator", "/demo", "/no-such-page-xyz", "/pay/invalid-token", "/book/invalid-id", "/plan/invalid-id", "/reference/invalid-token", "/v/invalid-ref", "/store/invalid-tenant", "/call-ended"];

// English catalogue values (2+ words, no placeholders) -> exact-match set, used by the page detector.
function englishValues(): string[] {
  const out = new Set<string>();
  for (const ns of [...Object.values(CATALOGS.en as Record<string, Record<string, string>>), ...Object.values(lazyCatalog("en"))]) for (const v of Object.values(ns)) {
    if (typeof v !== "string" || v.includes("{")) continue;
    const s = v.replace(/\s+/g, " ").trim();
    if (s.split(" ").length >= 2 && /[A-Za-z]{3}/.test(s) && s.length < 160) out.add(s);
  }
  return [...out];
}
const EN = englishValues();

async function measure(page: Page, loc: string) {
  return page.evaluate(({ nonLatin, stop, en, allow, data }) => {
    const enSet = new Set<string>(en); const re = new RegExp(stop, "i");
    const cat = new Set<string>(), heur = new Set<string>(), keys = new Set<string>();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement; const s0 = (n.textContent ?? "").replace(/\s+/g, " ").trim(); const s = (new RegExp(data).test(s0) ? "" : s0).replace(new RegExp(allow, "g"), " ").replace(/\s+/g, " ").trim();
      if (!el || !s || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
      const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
      if (/^[a-z]+[A-Za-z0-9]*\.[a-zA-Z_0-9]+(\.[a-zA-Z_0-9]+)*$/.test(s) && !/\s/.test(s) && !/\.(com|co|uk|org|io|net)$/.test(s)) keys.add(s);
      if (!/[A-Za-z]{3}/.test(s)) continue;
      if (enSet.has(s)) cat.add(s.slice(0, 100));
      const words = s.split(/\s+/);
      if (nonLatin) { if (/\b[A-Za-z]{4,}\b/.test(s)) heur.add(s.slice(0, 100)); }
      else if (words.length >= 2 && re.test(s)) heur.add(s.slice(0, 100));
    }
    // <option> labels (closed selects have no box, so the walker above skips them): same checks.
    for (const o of Array.from(document.querySelectorAll("option"))) {
      const s0 = (o.textContent ?? "").replace(/\s+/g, " ").trim(); const s = (new RegExp(data).test(s0) ? "" : s0).replace(new RegExp(allow, "g"), " ").replace(/\s+/g, " ").trim();
      if (!s || !/[A-Za-z]{3}/.test(s)) continue;
      if (enSet.has(s)) cat.add("[option] " + s.slice(0, 90));
      if (nonLatin ? /\b[A-Za-z]{4,}\b/.test(s) : (s.split(/\s+/).length >= 2 && re.test(s))) heur.add("[option] " + s.slice(0, 90));
    }
    const de = document.documentElement;
    return { cat: [...cat], heur: [...heur], keys: [...keys], dir: de.dir, lang: de.lang, overflow: de.scrollWidth - de.clientWidth };
  }, { nonLatin: NON_LATIN.has(loc), stop: STOP.source, en: EN, allow: ALLOW.source, data: DATA.source });
}

const rows: string[] = [];
function record(name: string, loc: string, r: Awaited<ReturnType<typeof measure>>, errs: string[]) {
  fs.mkdirSync(OUT, { recursive: true });
  rows.push(`${name},${loc},${r.cat.length},${r.heur.length},${r.keys.length},${r.overflow},${errs.length}`);
  fs.appendFileSync(`${OUT}/summary.csv`, rows[rows.length - 1] + "\n");
}

async function visit(page: Page, ctx: { name: string; url: string; loc: string }, errs: string[], out: any[]) {
  errs.length = 0;
  await page.goto(ctx.url, { waitUntil: "load" }).catch(() => undefined);
  await page.waitForTimeout(ctx.url.includes("/how-it-works") || ctx.url.startsWith("/demo") ? 2500 : 3000);
  const r = await measure(page, ctx.loc);
  record(ctx.name, ctx.loc, r, errs);
  out.push({ view: ctx.name, ...r, errs: [...errs] });
  expect(r.keys, `raw catalogue keys on ${ctx.name} (${ctx.loc})`).toEqual([]);
  expect(errs, `page errors on ${ctx.name} (${ctx.loc})`).toEqual([]);
  expect(r.overflow, `horizontal overflow on ${ctx.name} (${ctx.loc})`).toBeLessThanOrEqual(1);
  expect(r.lang).toBe(ctx.loc);
  expect(r.dir).toBe(["ar", "ur"].includes(ctx.loc) ? "rtl" : "ltr");
  if (STRICT) expect(r.cat, `English catalogue text on ${ctx.name} (${ctx.loc})`).toEqual([]);
}

async function newCtx(browser: import("@playwright/test").Browser, loc: string, state?: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
  await ctx.addCookies([{ name: "aos.locale", value: loc, url: process.env.E2E_BASE_URL || "http://localhost:3000" }]);
  return ctx;
}

for (const loc of LOCALES) {
  if (ONLY.includes("public")) test(`overnight public ${loc}`, async ({ browser }) => {
    test.setTimeout(1_800_000);
    const ctx = await newCtx(browser, loc); const page = await ctx.newPage();
    const errs: string[] = []; page.on("pageerror", (e) => { if (!NOISE.test(e.message)) errs.push(e.message.slice(0, 150)); });
    const res: any[] = []; const fails: string[] = [];
    for (const p of PUBLIC_PATHS) { try { await visit(page, { name: `public${p}`, url: p, loc }, errs, res); } catch (e) { fails.push(String((e as Error).message).split("\n")[0]); } }
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/public-${loc}.json`, JSON.stringify(res, null, 1));
    expect(fails).toEqual([]); await ctx.close();
  });
  for (const portal of PORTALS) {
    if (!ONLY.includes(portal)) continue;
    test(`overnight ${portal} ${loc}`, async ({ browser }) => {
      test.setTimeout(2_400_000);
      const ctx = await newCtx(browser, loc, statePath(ROLE[portal])); const page = await ctx.newPage();
      const errs: string[] = []; page.on("pageerror", (e) => { if (!NOISE.test(e.message)) errs.push(e.message.slice(0, 150)); });
      // A stored state that has gone signed out (freelancer, 30 Sep): sign in through the real form with the manifest account.
      await page.goto(`/${portal}`, { waitUntil: "load" }).catch(() => undefined); await page.waitForTimeout(2500);
      if (/\/login/.test(page.url())) {
        const acc = loadAccounts(); const a = acc.accounts[ROLE[portal]];
        await page.locator('input[type="email"]').first().fill(a.email); await page.locator('input[type="password"]').first().fill(acc.password);
        await page.locator('button[type="submit"]').first().click(); await page.waitForTimeout(6000);
      }
      const views = NAV_GROUPS[portal].flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view);
      const res: any[] = []; const fails: string[] = [];
      for (const v of views) { try { await visit(page, { name: `${portal}/${v}`, url: `/${portal}/${v}`, loc }, errs, res); } catch (e) { fails.push(String((e as Error).message).split("\n")[0]); } }
      fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/${portal}-${loc}.json`, JSON.stringify(res, null, 1));
      expect(fails).toEqual([]); await ctx.close();
    });
  }
}
