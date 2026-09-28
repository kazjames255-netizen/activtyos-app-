// Renders each mascot pose to a static PNG (email-safe) into public/mascot/. Needs the dev server: npm run dev
// Usage: node scripts/render-mascot.mjs [baseUrl]   (sizes 96/192/384 px; transparent background)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000";
const poses = ["wave","celebrate","think","read","point","cheer","encourage","sleep","peek","dance","speak","icon"];
mkdirSync("public/mascot", { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
for (const size of [96, 192, 384]) for (const pose of poses) {
  await p.setViewportSize({ width: size + 20, height: size + 20 });
  await p.goto(`${base}/dev/mascot?only=${pose}&size=${size}`, { waitUntil: "load" });
  const el = await p.waitForSelector("[data-export] svg");
  await el.screenshot({ path: `public/mascot/${pose}-${size}.png`, omitBackground: true });
}
await b.close();
