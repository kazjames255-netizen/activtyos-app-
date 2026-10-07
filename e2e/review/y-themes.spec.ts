import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, apiFetch, apiPost, fbSignUp, fbSignIn } from "../helpers/accounts";
import { provisionLiveListing } from "../helpers/tenantData";
import { execFileSync } from "node:child_process";
import { ROOT, WEB_URL } from "../helpers/env";

// Theme typography + photo-overlay audit: every booking-page theme with a LONG title (no photo) and with a real photo.
//   TAG=before|after E2E_BASE_URL=http://localhost:3015 NEXT_PUBLIC_API_URL=http://localhost:4015 npx playwright test -c pw-y.config.ts
const TAG = process.env.TAG || "after";
const OUT = path.join(ROOT, "docs/home-visit-qa/Y", TAG);
const THEMES = (process.env.THEME_LIST || "playful,sport,emerald,teal,royal,aubergine,burgundy,terracotta,slate,crimson,lagoon,arcade,aurora,sherbet,varsity,plum,halftone,wildwood,pirouette,riso,brite,pitch,frost,mint,poster").split(",");
const LONG = "Holiday multi-activity camp for curious kids aged 5 to 11 with football, art and drama";

test("theme typography audit", async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const runId = "y" + Date.now().toString(36);
  const email = `hvqa-y-${runId}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const tenantName = `HVQA Y ${runId}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  const acct = { role: "freelancer" as const, email, uid: s.uid, tenantId: r.tenantId, tenantName };
  const plain = await provisionLiveListing(acct, { title: LONG, price: 35 });
  const photo = await provisionLiveListing(acct, { title: "Paintball party", price: 35 });
  const tok = (await fbSignIn(email)).idToken;
  const img = fs.readFileSync(process.env.PHOTO || path.join(ROOT, "e2e/review/y-photo.jpg"));
  const up = await apiPost<{ url: string }>("/api/uploads", tok, { dataUrl: `data:image/jpeg;base64,${img.toString("base64")}` });
  await apiFetch(`/api/listings/${photo.id}`, tok, { method: "PUT", body: JSON.stringify({ images: [{ src: up.url, x: 50, y: 50, zoom: 100 }] }) });
  if (process.env.TITLE) await apiFetch(`/api/listings/${plain.id}`, tok, { method: "PUT", body: JSON.stringify({ title: process.env.TITLE }) });
  fs.writeFileSync(path.join(OUT, "_run.json"), JSON.stringify({ email, plain: plain.id, photo: photo.id, photoUrl: up.url }, null, 2));
  for (const th of THEMES) {
    for (const l of [plain, photo]) await apiFetch(`/api/listings/${l.id}`, tok, { method: "PUT", body: JSON.stringify({ pageStyle: th }) });
    const shots: [string, string, { width: number; height: number }][] = [["plain", plain.id, { width: 1280, height: 900 }], ["plain-phone", plain.id, { width: 390, height: 844 }], ["photo", photo.id, { width: 1280, height: 900 }]];
    for (const [label, id, vp] of shots) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(`${WEB_URL}/book/${id}`);
      await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 30_000 }).catch(() => page.waitForTimeout(3000));
      await page.getByText("Keep looking").click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(1400);
      await page.screenshot({ path: path.join(OUT, `${th}-${label}.png`), clip: { x: 0, y: 0, width: vp.width, height: label === "photo" ? 760 : 620 } });
      await ctx.close();
    }
  }
});
