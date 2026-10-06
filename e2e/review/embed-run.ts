import fs from "node:fs"; import path from "node:path";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed"); const H = "http://localhost:5055";
const sd = JSON.parse(fs.readFileSync(path.join(OUT, "seed.json"), "utf8"));
const res: string[] = []; const ck = (id: string, ok: boolean, note = "") => { res.push(`${ok ? "PASS" : "FAIL"} ${id} ${note}`); console.log(res[res.length - 1]); };
const frameText = async (page: any, pick = 0) => { const fr = page.frames().filter((f: any) => f !== page.mainFrame()); return fr[pick] ? ((await fr[pick].locator("body").innerText().catch(() => "")) as string) : ""; };
(async () => {
  const b = await chromium.launch();
  for (const [tag, w, h] of [["desk", 1280, 900], ["phone", 390, 800]] as const) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 120)));
    // (a) per-listing button
    await p.goto(`${H}/listing.html`); await p.waitForTimeout(1500);
    const btn = p.getByRole("button", { name: "Book now" }); ck(`${tag} listing button renders`, (await btn.count()) === 1);
    await p.screenshot({ path: path.join(OUT, `${tag}-1-host-listing-button.png`) });
    await btn.click(); await p.waitForTimeout(6000);
    const ifr = p.locator("iframe"); const src = (await ifr.first().getAttribute("src")) ?? ""; const allow = (await ifr.first().getAttribute("allow")) ?? "";
    ck(`${tag} overlay iframe src is /book/<id>?embed=1`, src.includes(`/book/${sd.live}`) && src.includes("embed=1"), src);
    ck(`${tag} iframe allow has payment`, /payment/.test(allow), allow);
    const t1 = await frameText(p); ck(`${tag} listing renders inside iframe`, /embed live camp/i.test(t1), t1.slice(0, 80).replace(/\n/g, " "));
    await p.screenshot({ path: path.join(OUT, `${tag}-2-overlay-listing.png`) });
    await p.keyboard.press("Escape"); await p.waitForTimeout(500); ck(`${tag} Escape closes overlay`, (await p.locator("iframe").count()) === 0);
    // (b) store button
    await p.goto(`${H}/store.html`); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Book activities" }).click(); await p.waitForTimeout(6000);
    const t2 = await frameText(p); ck(`${tag} store lists the LIVE listing`, /Embed Live Camp/.test(t2)); ck(`${tag} store hides the DRAFT listing`, !/Embed Draft Camp/.test(t2));
    await p.screenshot({ path: path.join(OUT, `${tag}-3-overlay-store.png`) });
    await p.locator("button[aria-label='Close booking']").click(); await p.waitForTimeout(400); ck(`${tag} close button closes`, (await p.locator("iframe").count()) === 0);
    // (c) inline
    for (const pg of ["inline-listing", "inline-store"]) {
      await p.goto(`${H}/${pg}.html`); await p.waitForTimeout(7000);
      const hgt = await p.locator("iframe").first().evaluate((e: HTMLElement) => e.getBoundingClientRect().height);
      ck(`${tag} ${pg} auto-sizes (height != initial 900)`, hgt > 100 && hgt !== 900, String(Math.round(hgt)));
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ck(`${tag} ${pg} no sideways scroll`, sw <= 1, String(sw));
      await p.screenshot({ path: path.join(OUT, `${tag}-4-${pg}.png`), fullPage: false });
    }
    // react-style mount + custom label/colour
    await p.goto(`${H}/react.html`); await p.waitForTimeout(2000);
    ck(`${tag} mount-div form renders custom label`, (await p.getByRole("button", { name: "Book the camp" }).count()) === 1);
    ck(`${tag} store mount-div renders`, (await p.getByRole("button", { name: "Book activities" }).count()) === 1);
    await p.screenshot({ path: path.join(OUT, `${tag}-5-react-mounts.png`) });
    // draft listing in embed
    await p.goto(`${H}/draft.html`); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Book now" }).click(); await p.waitForTimeout(5000);
    const t3 = await frameText(p); ck(`${tag} draft shows the friendly message`, /isn.t open right now/i.test(t3) && !/home/i.test(t3) && !/not found/i.test(t3), t3.slice(0, 160).replace(/\n/g, " | "));
    await p.screenshot({ path: path.join(OUT, `${tag}-6-draft-overlay.png`) });
    ck(`${tag} no page errors`, errs.length === 0, errs.join(";"));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "results.txt"), res.join("\n"));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
