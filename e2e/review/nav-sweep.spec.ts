import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { NAV_GROUPS, PORTALS, type PortalKey } from "../../lib/nav/config";
import { statePath, type Role } from "../helpers/env";

// Overnight nav sweep (read-only). Run with:
//   npx playwright test e2e/review/nav-sweep.spec.ts --project=e2e --no-deps --workers=6
// --no-deps skips global.setup (which wipes the test accounts' data). Writes results to e2e/review/shots/nav-sweep/.
const OUT = path.join(__dirname, "shots", "nav-sweep");
fs.mkdirSync(OUT, { recursive: true });
const ROLE: Record<PortalKey, Role> = { company: "company", franchise: "franchise", freelancer: "freelancer", staff: "staff", custdash: "parent", platform: "platform" };
const VPS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const views = (p: PortalKey) => [...new Set(NAV_GROUPS[p].flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view))];

async function settle(page: Page, ms: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => {
      const m = document.querySelector("main");
      const t = (m?.textContent || "").trim();
      const sk = document.querySelectorAll('[class*="skeleton" i],[class*="animate-pulse"]').length;
      return { t: t.length, loading: /^(Loading…?|Checking access…?)?$/.test(t), sk };
    }).catch(() => ({ t: 0, loading: true, sk: 0 }));
    if (!s.loading && s.sk === 0) return Date.now() - t0;
    await page.waitForTimeout(500);
  }
  return null;
}

const CHECKS = () => {
  const out: string[] = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 2) out.push(`h-scroll: page ${document.documentElement.scrollWidth}px > ${vw}px`);
  const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c: { r: number; g: number; b: number }) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return null; const b = parse(cs.backgroundColor); if (b && b.a > 0.95) return b; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const seen = new Set<string>(); let low = 0, clip = 0, over = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = (n.textContent || "").trim(); const el = n.parentElement;
    if (!txt || !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.3) continue;
    if (r.bottom < 0 || r.top > 20000) continue;
    const fg = parse(cs.color), bg = bgOf(el);
    if (fg && bg && fg.a > 0.5) { const a = lum(fg), b = lum(bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (cr < 1.4 && low++ < 6) out.push(`low-contrast ${cr.toFixed(2)}: "${txt.slice(0, 40)}" color ${cs.color} on ${bg.r},${bg.g},${bg.b}`); }
    if (r.right > vw + 4 && over++ < 4 && !el.closest('[style*="overflow-x"],.overflow-x-auto,.overflow-auto')) out.push(`off-screen-right: "${txt.slice(0, 40)}" right=${Math.round(r.right)}`);
    if (/^[a-z][a-z0-9]{1,12}\.[A-Za-z][A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/.test(txt) && !/\.(com|co|uk|org|net|io|app|pdf|png|jpg|csv)$/i.test(txt) && !seen.has(txt)) { seen.add(txt); out.push(`raw-i18n-key?: "${txt}"`); }
    if (/\{\{.*\}\}|\bundefined\b|\[object Object\]|\bNaN\b/.test(txt) && !seen.has(txt)) { seen.add(txt); out.push(`bad-text: "${txt.slice(0, 60)}"`); }
  }
  for (const el of Array.from(document.querySelectorAll("button,a,h1,h2,h3,td,th,label,span,p,div")).slice(0, 6000)) {
    const cs = getComputedStyle(el); if (el.children.length || !(el.textContent || "").trim()) continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== "ellipsis" && clip++ < 4) out.push(`clipped-text: "${(el.textContent || "").trim().slice(0, 40)}" (${el.scrollWidth}>${el.clientWidth})`);
  }
  return out;
};

for (const portal of PORTALS) {
  for (const vp of ["desktop", "phone"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`${portal} ${vp} ${theme}`, async ({ browser }) => {
        test.setTimeout(3_600_000);
        const ctx = await browser.newContext({ storageState: statePath(ROLE[portal]), viewport: VPS[vp], colorScheme: theme });
        if (theme === "dark") {
          // "ActivityLane" is the app's dark surface theme; also nudge any per-surface theme key.
          await ctx.addInitScript(() => {
            const g = Storage.prototype.getItem;
            Storage.prototype.getItem = function (k: string) { return /theme/i.test(k) && !/lang/i.test(k) ? "classic" : g.call(this, k); };
          });
        }
        const page = await ctx.newPage();
        let cons: string[] = [], perr: string[] = [], bad: string[] = [];
        page.on("console", (m) => { if (m.type() === "error") cons.push(m.text().slice(0, 160)); });
        page.on("pageerror", (e) => perr.push(e.message.slice(0, 160)));
        page.on("response", (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 80)}`); });
        const lines: string[] = [];
        for (const view of views(portal)) {
          cons = []; perr = []; bad = [];
          const probs: string[] = [];
          const tag = `${portal}-${view}-${vp}-${theme}`;
          const t0 = Date.now();
          try {
            await page.goto(`/${portal}/${view}`, { waitUntil: "load", timeout: 60_000 });
            if (await page.getByText("This page could not be found").isVisible().catch(() => false)) probs.push("404 not registered");
            if (!/\/(login|signup)/.test(page.url()) === false) probs.push(`redirected to ${page.url()}`);
            else if (new URL(page.url()).pathname !== `/${portal}/${view}`) probs.push(`redirected to ${new URL(page.url()).pathname}`);
            const st = await settle(page, 45_000);
            if (st === null) probs.push("45s: still loading/skeletons");
            const main = ((await page.locator("main").first().textContent({ timeout: 3000 }).catch(() => "")) || "").trim();
            if (!main) probs.push("blank main");
            if (/something went wrong|application error|unexpected error|could(n'|n’)t load|failed to load|try again later/i.test(main)) probs.push(`error text: ${(main.match(/(something went wrong|application error|unexpected error|could(n'|n’)t load|failed to load|try again later)/i) || [])[0]}`);
            await page.waitForTimeout(400);
            probs.push(...(await page.evaluate(CHECKS).catch((e) => [`check-failed ${e}`])));
          } catch (e) { probs.push(`nav error ${String(e).slice(0, 100)}`); }
          const ce = [...new Set(cons)].filter((c) => !/favicon|Download the React DevTools|ERR_BLOCKED|net::ERR_ABORTED|Failed to load resource: the server responded with a status of (401|403|404)/i.test(c));
          if (ce.length) probs.push(`console: ${ce.slice(0, 3).join(" || ")}`);
          if (perr.length) probs.push(`pageerror: ${[...new Set(perr)].slice(0, 2).join(" || ")}`);
          if (bad.length) probs.push(`5xx: ${[...new Set(bad)].slice(0, 3).join(", ")}`);
          const ms = Date.now() - t0;
          if (probs.length) { await page.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: false }).catch(() => {}); }
          lines.push(JSON.stringify({ portal, view, vp, theme, ms, probs, shot: probs.length ? `e2e/review/shots/nav-sweep/${tag}.png` : null }));
          fs.appendFileSync(path.join(OUT, "results.jsonl"), lines[lines.length - 1] + "\n");
        }
        await ctx.close();
      });
    }
  }
}
