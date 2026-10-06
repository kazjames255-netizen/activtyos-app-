import { chromium, newCtx, go, body, loadState } from "./st4-lib";
(async () => {
  const st = loadState(); const b = await chromium.launch(); const ctx = await newCtx(b); const p = await ctx.newPage();
  await go(p, `/book/${st.listings.L2}`, 6000);
  const has = async (l: string) => { const t = await body(p); return `bio:${t.includes("Level 3")} sam:${t.includes("Sam Helper")}`; };
  console.log("initial", await has(""));
  const btn = p.locator("button", { hasText: "YOUR CHILD" }).first();
  console.log("btn count", await btn.count(), (await btn.innerText()).replace(/\n/g, " | "));
  await btn.click(); await p.waitForTimeout(800);
  console.log("after click 1", await has(""));
  await btn.click(); await p.waitForTimeout(800);
  console.log("after click 2", await has(""));
  await b.close(); process.exit(0);
})();
