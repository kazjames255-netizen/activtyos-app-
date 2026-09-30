// Marketing-site (public/v2) language switching: lang/dir, selector, persistence, dictionary coverage, leftover-English detector,
// RTL overflow, English-unchanged diff. Static pages only: no accounts, no API, no writes.
// Run via: scripts/e2e-locked.sh e2e/v2-i18n.spec.ts     (env V2_SHOTS=<dir> also saves a full-page screenshot per page/lang)
// English-unchanged diff compares /v2/<page>.html with the pristine copy at /v2/_orig/<page>.html when that folder exists.
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PAGES = ["activly", "parents", "companies", "franchises", "freelancers", "schools", "pricing", "tour", "safeguarding", "security", "dpa", "privacy", "terms", "platform-bookings", "platform-comms", "platform-finance", "platform-safeguarding", "platform-staff"];
const LEGAL = ["privacy", "terms", "dpa", "security", "safeguarding"];
const LANGS: Record<string, { dir: "rtl" | "ltr" }> = { ar: { dir: "rtl" }, ur: { dir: "rtl" }, ro: { dir: "ltr" }, es: { dir: "ltr" }, ...(process.env.V2_MORE ? Object.fromEntries(process.env.V2_MORE.split(",").map((l) => [l, { dir: (l === "ar" || l === "ur" ? "rtl" : "ltr") as "rtl" | "ltr" }])) : {}) };
const V2 = path.join(process.cwd(), "public/v2");
const SHOTS = process.env.V2_SHOTS;
const ORIG = fs.existsSync(path.join(V2, "_orig"));
const dict = (l: string): Record<string, string> => JSON.parse(fs.readFileSync(path.join(V2, "i18n", `${l}.json`), "utf8"));
const EN = dict("en");
const brand = (s: string) => s.split("{brand}").join("Activly");
const plain = (s: string) => brand(s).replace(/<br\s*\/?>/g, " ").replace(/<\/?\d+\/?>/g, "").replace(/&lt;/g, "<").replace(/\s+/g, " ").trim();
// strings that legitimately stay identical in every language (brand/proper nouns, acronyms, numbers)

test.use({ reducedMotion: "reduce" });

async function open(page: Page, p: string, lang: string | null, w = 1440) {
  await page.addInitScript((l) => { try { if (!sessionStorage.getItem("v2seed")) { sessionStorage.setItem("v2seed", "1"); localStorage.setItem("aos-lang", l || "en"); } } catch {} }, lang);
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`/v2/${p}.html`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("i18n-wait"), null, { timeout: 8000 });
  await page.waitForTimeout(400);
}

// Returns counts of translatable elements still showing English although the dictionary has a different string.
async function leftovers(page: Page, l: string) {
  const d = dict(l);
  return page.evaluate(({ d, EN }) => {
    const norm = (s: string) => s.replace(/<br\s*\/?>/g, " ").replace(/<\/?\d+\/?>/g, "").replace(/&lt;/g, "<").replace(/\s+/g, " ").trim().split("{brand}").join("Activly");
    const out: string[] = []; let hooked = 0, missing: string[] = [];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n")!; hooked++;
      if (!(k in d)) { missing.push(k); return; }
      const want = norm(d[k]), en = norm(EN[k]);
      if (want === en) return; // intentionally identical
      const got = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (got === en && got !== want) out.push(k);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      (el.getAttribute("data-i18n-attr") || "").split(";").forEach((pr) => {
        const [a, k] = pr.split(":"); if (!(k in d)) { missing.push(k); return; }
        const want = norm(d[k]), en = norm(EN[k]);
        if (want !== en && (el.getAttribute(a) || "").trim() === en) out.push(k + "@" + a);
      });
    });
    return { hooked, left: out, missing };
  }, { d, EN });
}

// Visible text that has NO data-i18n hook at all (would stay English in every language).
async function unhooked(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const t = (n.nodeValue || "").replace(/\s+/g, " ").trim();
      if (!/\p{L}{2,}/u.test(t)) continue;
      const el = n.parentElement!; if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(el.tagName)) continue;
      if (el.closest("[data-i18n],.lang-sw,#aosLegalNote,canvas,svg defs")) continue;
      if (el.closest("option[lang]")) continue;
      if (/^(Activ|ly|Activly|TFC|[A-Z]{1,3}|English|Polski|Română|Português|Español|Français|Cymraeg|العربية|اردو|বাংলা|ਪੰਜਾਬੀ)$/.test(t)) continue; // brand/logo, initials, native language names
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (!r.width && !r.height) continue;
      out.push(t.slice(0, 60));
    }
    return out;
  });
}

test.describe("v2 site i18n", () => {
  test("selector switches language, persists across pages and reloads, and restores English", async ({ page }) => {
    await open(page, "activly", "en");
    const h1en = (await page.locator("h1").first().innerText()).trim();
    expect(await page.locator("html").getAttribute("lang")).toBe("en");
    const sel = page.locator("#aosLang");
    await expect(sel).toBeVisible();
    await sel.selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect.poll(async () => (await page.locator("h1").first().innerText()).trim()).not.toBe(h1en);
    const h1ar = (await page.locator("h1").first().innerText()).trim();
    // persists across navigation (client navigation via a nav link) and reload
    await page.locator('a[href="/v2/pricing.html"]').first().click();
    await page.waitForLoadState("load");
    await page.waitForFunction(() => !document.documentElement.classList.contains("i18n-wait"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#aosLang")).toHaveValue("ar");
    await page.goto("/v2/activly.html", { waitUntil: "load" });
    await page.waitForFunction(() => !document.documentElement.classList.contains("i18n-wait"));
    expect((await page.locator("h1").first().innerText()).trim()).toBe(h1ar);
    // back to English in place restores the literal English
    await page.locator("#aosLang").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect.poll(async () => (await page.locator("h1").first().innerText()).trim()).toBe(h1en);
  });

  test("default language follows navigator.language when nothing is saved, else English", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "pl-PL" });
    const pg = await ctx.newPage();
    await pg.goto("/v2/tour.html", { waitUntil: "load" });
    await pg.waitForFunction(() => !document.documentElement.classList.contains("i18n-wait"));
    expect(await pg.locator("html").getAttribute("lang")).toBe("pl");
    await ctx.close();
    const ctx2 = await browser.newContext({ locale: "ja-JP" });
    const p2 = await ctx2.newPage();
    await p2.goto("/v2/tour.html", { waitUntil: "load" });
    expect(await p2.locator("html").getAttribute("lang")).toBe("en");
    await ctx2.close();
  });

  test("selector is keyboard operable and labelled", async ({ page }) => {
    await open(page, "tour", "en");
    const sel = page.locator("#aosLang");
    expect(await sel.getAttribute("aria-label")).toBeTruthy();
    await sel.focus();
    await expect(sel).toBeFocused();
    const opts = await sel.locator("option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    expect(opts).toEqual(["en", "ar", "ur", "pl", "ro", "cy", "bn", "pa", "pt", "es", "fr"]);
  });

  for (const p of PAGES) {
    for (const l of Object.keys(LANGS).filter((x) => fs.existsSync(path.join(V2, "i18n", `${x}.json`)))) {
      test(`${p} in ${l}: lang/dir, no leftover English, no missing keys, no overflow`, async ({ page }, info) => {
        test.setTimeout(90_000);
        const d = dict(l);
        await open(page, p, l, 1440);
        expect(await page.locator("html").getAttribute("lang")).toBe(l);
        expect(await page.locator("html").getAttribute("dir")).toBe(LANGS[l].dir);
        await expect(page.locator("#aosLang")).toHaveValue(l);
        const r = await leftovers(page, l);
        const un = await unhooked(page);
        info.annotations.push({ type: "counts", description: `hooked=${r.hooked} leftover=${r.left.length} missingKeys=${r.missing.length} unhookedText=${un.length}` });
        if (r.left.length) console.log(`[${p}/${l}] leftover English in ${r.left.length} elements e.g.`, r.left.slice(0, 8).join(", "));
        if (un.length) console.log(`[${p}/${l}] unhooked text e.g.`, un.slice(0, 6).join(" | "));
        expect.soft(r.missing, `keys missing from ${l}.json`).toEqual([]);
        expect.soft(r.left, `elements still English in ${l}`).toEqual([]);
        expect.soft(un.length, "visible text with no data-i18n hook").toBe(0);
        // the page title changed too (unless identical in the dictionary)
        const tk = await page.locator("title").getAttribute("data-i18n");
        if (tk && d[tk] && plain(d[tk]) !== plain(EN[tk])) expect(await page.title()).toBe(plain(d[tk]));
        if (LEGAL.includes(p) && d["js.legal-notice"]) await expect(page.locator("#aosLegalNote")).toBeVisible();
        if (p === "pricing" && d["js.pricing-notice"]) await expect(page.locator("#aosLegalNote")).toBeVisible();
        if (SHOTS && ["ar", "es"].includes(l)) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${p}-${l}-1440.png`), fullPage: true }); }
        for (const w of [1440, 390]) {
          if (w !== 1440) { await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(300); }
          const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
          expect.soft(ov.sw, `horizontal overflow at ${w}px in ${l}`).toBeLessThanOrEqual(ov.iw + 1);
          if (SHOTS && w === 390 && ["ar", "es"].includes(l)) await page.screenshot({ path: path.join(SHOTS, `${p}-${l}-390.png`), fullPage: true });
        }
      });
    }
  }

  test.describe("English unchanged vs pristine copy", () => {
    test.skip(!ORIG, "public/v2/_orig not present");
    for (const p of PAGES) {
      test(`${p}: English text and pixels match the pre-conversion page`, async ({ page }) => {
        test.setTimeout(90_000);
        const grab = async (url: string, w: number) => {
          await page.addInitScript(() => { try { localStorage.setItem("aos-lang", "en"); } catch {} });
          await page.setViewportSize({ width: w, height: 900 });
          await page.goto(url, { waitUntil: "load" });
          await page.waitForTimeout(1200);
          await page.addStyleTag({ content: ".lang-sw{display:none!important}canvas{visibility:hidden!important}*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
          await page.waitForTimeout(300);
          const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
          const shot = await page.screenshot({ fullPage: true });
          return { text, shot };
        };
        const a = await grab(`/v2/_orig/${p}.html`, 1440), b = await grab(`/v2/${p}.html`, 1440);
        // two deliberate source fixes: the parents page language strip had Urdu in Devanagari and a garbled Punjabi
        const fixA = a.text.replace("\u0909\u0930\u094d\u0926\u0942", "\u0627\u0631\u062f\u0648").replace("\u092a\u0a70\u0a1c\u093e\u092c\u0940", "\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40");
        expect(b.text).toBe(fixA);
        for (const w of [1440, 390]) {
          const x = w === 1440 ? a : await grab(`/v2/_orig/${p}.html`, w), y = w === 1440 ? b : await grab(`/v2/${p}.html`, w);
          const ia = await sharp(x.shot).raw().toBuffer({ resolveWithObject: true }), ib = await sharp(y.shot).raw().toBuffer({ resolveWithObject: true });
          expect.soft(ib.info.height, `page height at ${w}`).toBe(ia.info.height);
          if (ia.info.width === ib.info.width && ia.info.height === ib.info.height) {
            let diff = 0; const n = ia.data.length, ch = ia.info.channels;
            for (let i = 0; i < n; i += ch) { if (Math.abs(ia.data[i] - ib.data[i]) + Math.abs(ia.data[i + 1] - ib.data[i + 1]) + Math.abs(ia.data[i + 2] - ib.data[i + 2]) > 40) diff++; }
            const ratio = diff / (n / ch);
            console.log(`[${p}] pixel diff at ${w}px: ${(ratio * 100).toFixed(3)}%`);
            expect.soft(ratio, `pixel diff ratio at ${w}`).toBeLessThan(0.004);
          }
        }
      });
    }
  });
});
