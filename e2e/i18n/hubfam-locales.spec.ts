import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ensureFixture, ctxFor, settle, gotoHubPage, handOver, pickChild, VIEWPORTS, type Fx } from "../review/fixture";

// hubfam locale pass: parent / kid / tutor x quizzes, dashboard(progress), diagnostic, questions in ro, ar (RTL), cy, pl.
// Screenshots + a leftover detector (visible text that is still English). Throwaway test accounts only.
const OUT = path.join(ROOT, "docs/i18n-hubfam-screenshots");
const STOP = /\b(the|your|and|with|you|for|this|that|quiz|quizzes|progress|start|homework|results|question|questions|level|take|score|marks?)\b/i;
let fx: Fx;
test.beforeAll(async ({ browser }) => { test.setTimeout(500_000); fx = await buildFixture(8, true, browser); });

for (const loc of ["ro", "ar", "cy", "pl"]) for (const role of ["parent", "kid", "tutor"] as const) {
  test(`${role} ${loc}`, async ({ browser }) => {
    test.setTimeout(400_000);
    fx = await ensureFixture(browser, fx, 8, true);
    const ctx = await ctxFor(browser, role === "tutor" ? "freelancer" : "parent", VIEWPORTS["390"] ? VIEWPORTS["390"] : Object.values(VIEWPORTS)[0]);
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch {} }, loc);
    const page = await ctx.newPage();
    const dir = path.join(OUT, loc); fs.mkdirSync(dir, { recursive: true });
    const base = role === "tutor" ? "/freelancer/learninghub" : "/custdash/learninghub";
    const q = role === "tutor" ? "" : `&child=${fx.kids[0].id}`;
    const report: string[] = [];
    for (const tab of ["quizzes", "dashboard", "diagnostic", "questions", "home"]) {
      await gotoHubPage(page, `${base}?tab=${tab}${q}`, fx);
      if (role !== "tutor") await pickChild(page, fx).catch(() => undefined);
      if (role === "kid" && tab === "quizzes") await handOver(page, fx.kids[0].id).catch(() => undefined);
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${role}-${tab}.png`), fullPage: true });
      const left = await page.evaluate((re) => {
        const r = new RegExp(re, "i"); const out: string[] = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const t = (n.textContent || "").trim(); const el = n.parentElement; if (t.length > 3 && el && el.offsetParent && !/SCRIPT|STYLE/.test(el.tagName) && r.test(t)) out.push(t.slice(0, 90)); }
        return [...new Set(out)].slice(0, 40);
      }, STOP.source);
      report.push(`## ${tab}\n${left.map((x) => "- " + x).join("\n")}`);
    }
    fs.writeFileSync(path.join(dir, `${role}-leftovers.md`), report.join("\n\n"));
  });
}
