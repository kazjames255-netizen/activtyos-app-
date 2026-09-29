import fs from "node:fs";
import { test } from "@playwright/test";
import { NAV_GROUPS, PORTALS, type PortalKey } from "../../lib/nav/config";
import { statePath, type Role } from "../helpers/env";

// P7 per-page i18n sweep: every nav view of every portal in the chosen locales. Read-only browsing.
// Reports (a) visible text still English, (b) raw catalogue keys, (c) RTL horizontal overflow, (d) page errors.
// P7_LOCALES=ar,ur P7_PORTALS=company,parent P7_OUT=/tmp/p7
const ROLE: Record<PortalKey, Role> = { company: "company", franchise: "franchise", freelancer: "freelancer", staff: "staff", custdash: "parent", platform: "platform" };
const LOCALES = (process.env.P7_LOCALES ?? "ar").split(",");
const ONLY = (process.env.P7_PORTALS ?? PORTALS.join(",")).split(",") as PortalKey[];
const OUT = process.env.P7_OUT ?? "/tmp/p7";
const NON_LATIN = new Set(["ur", "pa", "bn", "ar"]);
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|no|not|yet|will|can|have|has|all|new|add|edit|delete|save|cancel|view|search|select)\b/i;

for (const loc of LOCALES) for (const portal of ONLY) {
  test(`p7 ${portal} ${loc}`, async ({ browser }) => {
    test.setTimeout(1_800_000);
    const ctx = await browser.newContext({ storageState: statePath(ROLE[portal]), viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, loc);
    const page = await ctx.newPage();
    let errs: string[] = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 150)));
    const res: any[] = [];
    const views = NAV_GROUPS[portal].flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view);
    for (const v of views) {
      errs = [];
      await page.goto(`/${portal}/${v}`, { waitUntil: "load" }).catch(() => undefined);
      await page.waitForTimeout(3000);
      const r = await page.evaluate(({ nonLatin, stop }) => {
        const re = new RegExp(stop, "i"); const eng = new Set<string>(); const keys = new Set<string>();
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const el = n.parentElement; const s = (n.textContent ?? "").trim();
          if (!el || !s || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
          const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
          if (/^[a-z]+[A-Za-z]*\.[a-zA-Z_]+(\.[a-zA-Z_]+)*$/.test(s) && !/\s/.test(s) && !/\.(com|co|uk|org)$/.test(s)) keys.add(s);
          if (!/[A-Za-z]{3}/.test(s)) continue;
          const words = s.split(/\s+/);
          if (nonLatin) { if (/\b[A-Za-z]{4,}\b/.test(s)) eng.add(s.slice(0, 100)); }
          else if (words.length >= 2 && re.test(s)) eng.add(s.slice(0, 100));
        }
        const de = document.documentElement;
        return { eng: [...eng], keys: [...keys], dir: de.dir, lang: de.lang, overflow: de.scrollWidth - de.clientWidth, iframe: !!document.querySelector("main iframe, iframe"), main: (document.querySelector("main")?.textContent ?? "").trim().length };
      }, { nonLatin: NON_LATIN.has(loc), stop: STOP.source });
      res.push({ view: v, ...r, errs });
      if (process.env.P7_SHOTS) await page.screenshot({ path: `${OUT}/${portal}-${loc}-${v}.png` });
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/${portal}-${loc}.json`, JSON.stringify(res, null, 1));
    await ctx.close();
  });
}
