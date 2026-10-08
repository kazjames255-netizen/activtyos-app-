// Screenshot pass for Moments + Newsfeed. Run with E2E_AUTH_DIR=e2e/review/.auth-suite E2E_BASE_URL=http://localhost:3012 NEXT_PUBLIC_API_URL=http://localhost:4012
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { statePath } from "../helpers/env";

const out = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const pages: [string, "parent" | "freelancer" | "staff" | "company", string][] = [
  ["parent-moments", "parent", "/custdash/moments"], ["parent-news", "parent", "/custdash/newsfeed"],
  ["op-moments", "freelancer", "/freelancer/moments"], ["op-news", "freelancer", "/freelancer/newsfeed"],
  ["staff-moments", "staff", "/staff/moments"],
];
const b = await chromium.launch();
for (const [name, role, url] of pages) for (const w of [1440, 390]) {
  const ctx = await b.newContext({ storageState: statePath(role), viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3012${url}`);
  await p.waitForTimeout(6000);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, w, "horizontal overflow px:", over);
  await p.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
