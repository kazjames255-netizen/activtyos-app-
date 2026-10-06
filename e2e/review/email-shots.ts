import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const DIR = "/Users/kazjames/Downloads/activtyos-app-/e2e/review/shots/emails";
(async () => {
  const b = await chromium.launch();
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".html"))) {
    for (const [tag, w] of [["desktop", 760], ["phone", 390]] as const) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      await p.goto("file://" + path.join(DIR, f)); await p.waitForTimeout(500);
      const box = await p.locator("body > div").boundingBox(); await p.screenshot({ path: path.join(DIR, f.replace(".html", `-${tag}.png`)), clip: { x: 0, y: 0, width: w, height: Math.ceil((box?.y ?? 0) + (box?.height ?? 900) + 14) }, fullPage: true });
      await ctx.close();
    }
  }
  await b.close();
})();
