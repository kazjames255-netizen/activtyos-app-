import fs from "node:fs"; import path from "node:path";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed/manual"); fs.mkdirSync(OUT, { recursive: true }); const H = "http://localhost:5055";
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); const p = await ctx.newPage();
  const hide = async () => { for (const f of p.frames()) await f.addStyleTag({ content: "nextjs-portal,[data-nextjs-dev-tools-button]{display:none!important}" }).catch(() => {}); };
  const snap = async (name: string, clip?: { x: number; y: number; width: number; height: number }) => { await hide(); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, name + ".png"), ...(clip ? { clip } : {}) }); };
  await p.goto(`${H}/listing.html`); await p.waitForTimeout(1500); await snap("host-button", { x: 0, y: 0, width: 1280, height: 330 });
  await p.getByRole("button", { name: "Book now" }).click(); await p.waitForTimeout(7000); await snap("overlay-listing");
  await p.keyboard.press("Escape");
  await p.goto(`${H}/store.html`); await p.waitForTimeout(1200); await p.getByRole("button", { name: "Book activities" }).click(); await p.waitForTimeout(6500); await snap("overlay-store", { x: 0, y: 0, width: 1280, height: 480 });
  await p.keyboard.press("Escape");
  await p.goto(`${H}/inline-store.html`); await p.waitForTimeout(7000); await snap("inline-store", { x: 0, y: 0, width: 1280, height: 600 });
  await p.goto(`${H}/draft.html`); await p.waitForTimeout(1200); await p.getByRole("button", { name: "Book now" }).click(); await p.waitForTimeout(5000); await snap("not-open", { x: 0, y: 0, width: 1280, height: 190 });
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
