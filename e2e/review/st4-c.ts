import { chromium, newCtx, go, shot, body, check, loadState } from "./st4-lib";
(async () => {
  const st = loadState();
  const b = await chromium.launch();
  for (const [tag, w] of [["desktop", 1440], ["phone", 390]] as const) {
    const ctx = await newCtx(b, w, tag === "phone" ? 844 : 900); const p = await ctx.newPage();
    await go(p, `/book/${st.listings.L2}`, 6000);
    await p.waitForTimeout(800);
    await p.getByText("Level 3 coaching award").first().scrollIntoViewIfNeeded().catch(() => {});
    const s = await shot(p, `04-parent-team-${tag}`);
    const t = await body(p);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    check(`PAR-0${tag === "phone" ? 2 : 1} parent page ${tag}: shows the 2 assigned staff + bio, not Tom (unassigned), not owner`, t.includes("Sam Helper") && t.includes("Priya Coach") && t.includes("Level 3 coaching award") && !t.includes("Tom Lead") && !t.includes("Olive") && !overflow, `overflow=${overflow}`, s);
    await ctx.close();
  }
  const ctx = await newCtx(b); const p = await ctx.newPage();
  await go(p, `/book/${st.listings.L3}`, 6000);
  const t = await body(p); const s = await shot(p, "05-parent-L3-nostaff");
  check("PAR-03 listing with no staff shows no team section / no staff names", !/THE TEAM/i.test(t) && !t.includes("Sam Helper") && !t.includes("Priya") && !t.includes("Tom Lead"), "", s);
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
