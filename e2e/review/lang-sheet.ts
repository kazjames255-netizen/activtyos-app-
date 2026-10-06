const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
import fs from "node:fs";
(async () => {
  const [loc, names, out] = process.argv.slice(2);
  const imgs = names.split(",").map((n) => `<img src="file:///Users/kazjames/Downloads/activtyos-app-/e2e/review/shots/lang/${loc}-${n}.png" style="height:844px;margin-right:6px">`).join("");
  fs.writeFileSync("/tmp/sheet.html", `<body style="margin:0;background:#888;display:flex;width:max-content">${imgs}</body>`);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400 * names.split(",").length, height: 844 } });
  await p.goto("file:///tmp/sheet.html"); await p.waitForTimeout(800); await p.screenshot({ path: out }); await b.close(); process.exit(0);
})();
