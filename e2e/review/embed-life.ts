import fs from "node:fs"; import path from "node:path";
import { fbSignIn, apiFetch } from "../helpers/accounts";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed"); const H = "http://localhost:5055";
const sd = JSON.parse(fs.readFileSync(path.join(OUT, "seed.json"), "utf8"));
const ck = (id: string, ok: boolean, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`);
const frameText = async (page: any) => { const fr = page.frames().filter((f: any) => f !== page.mainFrame()); return fr[0] ? ((await fr[0].locator("body").innerText().catch(() => "")) as string) : ""; };
(async () => {
  const tok = (await fbSignIn(sd.email)).idToken;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const store = async () => { await p.goto(`${H}/inline-store.html`); await p.waitForTimeout(6000); return frameText(p); };
  const one = async (id: string) => { await p.setContent(`<body><script src="http://localhost:3000/embed.js" data-listing="${id}" data-mode="inline" async></script></body>`, { waitUntil: "load" }).catch(() => {}); await p.goto(`${H}/draft.html`); await p.waitForTimeout(500); return ""; };
  let t = await store(); ck("store: draft hidden before publish", /embed live camp/i.test(t) && !/embed draft camp/i.test(t));
  // draft -> live
  await apiFetch(`/api/listings/${sd.draft}`, tok, { method: "PUT", body: JSON.stringify({ status: "live" }) });
  t = await store(); ck("store: listing appears by itself when it goes live (no re-paste)", /embed draft camp/i.test(t));
  await p.goto(`${H}/draft.html`); await p.waitForTimeout(500); await p.getByRole("button", { name: "Book now" }).click(); await p.waitForTimeout(5000);
  t = await frameText(p); ck("per-listing snippet works the moment it is live", /embed draft camp/i.test(t), t.slice(0, 80).replace(/\n/g, " "));
  await p.screenshot({ path: path.join(OUT, "life-1-now-live.png") });
  // live -> draft (unpublish)
  await apiFetch(`/api/listings/${sd.draft}`, tok, { method: "PUT", body: JSON.stringify({ status: "draft" }) });
  t = await store(); ck("store: unpublished listing drops out by itself", !/embed draft camp/i.test(t));
  await p.goto(`${H}/draft.html`); await p.waitForTimeout(500); await p.getByRole("button", { name: "Book now" }).click(); await p.waitForTimeout(5000);
  t = await frameText(p); ck("per-listing snippet shows friendly message when unpublished", /isn.t open right now/i.test(t), t.slice(0, 100).replace(/\n/g, " "));
  // archive/ended-like: archived
  await apiFetch(`/api/listings/${sd.draft}`, tok, { method: "PUT", body: JSON.stringify({ status: "live" }) });
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
