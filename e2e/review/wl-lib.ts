import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { API_URL, ROOT, WEB_URL } from "../helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "../helpers/accounts";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
export { WEB_URL, ROOT };
export const SHOTS = path.join(ROOT, "e2e/review/shots/wl");
fs.mkdirSync(SHOTS, { recursive: true });
const CACHE = path.join(SHOTS, "accounts.json");
const RES = path.join(SHOTS, "results.json");

export interface Acct { email: string; uid: string; tenantId: string | null; tok: string; tokAt: number }
export let A: Record<string, Acct> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
export const saveA = () => fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
export const stamp = (A as any).__stamp?.email ?? Date.now().toString(36);
if (!(A as any).__stamp) { (A as any).__stamp = { email: stamp }; saveA(); }
export const email = (n: string) => `e2e-wl-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;

export async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      let t = tok ?? null;
      if (!t && k) { const a = A[k]; if (Date.now() - a.tokAt > 35 * 60_000) { a.tok = (await fbSignIn(a.email)).idToken; a.tokAt = Date.now(); saveA(); } t = a.tok; }
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 10) throw e; await new Promise((r) => setTimeout(r, 2000)); }
  }
}
export const ok = async (k: string, method: string, url: string, body?: unknown) => {
  const r = await call(k, method, url, body);
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json;
};
export async function signupOperator(key: string, name: string) {
  if (A[key]) return;
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role: "freelancer", businessName: name, providerName: name, providerNameMode: "business", ownerName: "Wendy Test" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  A[key] = { email: email(key), uid: s.uid, tenantId: r.json.tenantId, tok: s.idToken, tokAt: Date.now() };
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.json.tenantId], { stdio: "pipe" });
  saveA();
}
export async function signupParent(key: string) {
  if (A[key]) return;
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role: "parent", postcode: "NN5 7EA", firstName: key.toUpperCase(), lastName: "Parent" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  await call(null, "POST", "/api/me/welcome", {}, s.idToken);
  A[key] = { email: email(key), uid: s.uid, tenantId: null, tok: s.idToken, tokAt: Date.now() };
  saveA();
}
// dates
const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
export const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
export const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));

export interface Listing { id: string; title: string; blockId: string; blocks: { id: string; startDate: string }[]; tenantId: string }
export interface PassDef { name: string; days: number; price: number }
export const STD_PASSES: PassDef[] = [{ name: "5 days", days: 5, price: 90 }, { name: "3 days", days: 3, price: 54 }, { name: "1 day", days: 1, price: 20 }];
const passIdCache: Record<string, string> = {};
const periodCache: Record<string, string> = {};
export async function ensureVenue(k: string) {
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  if (!venues.some((v) => v.id === "wl-venue")) await ok(k, "PUT", "/api/library", { venues: [...venues, { id: "wl-venue", name: "WL Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}) } });
  return "wl-venue";
}
async function ensurePass(k: string, name: string, days: number) { return (passIdCache[`${k}|${name}|${days}`] ??= (await ok(k, "POST", "/api/passes", { name, days })).id); }
async function ensurePeriod(k: string) { return (periodCache[k] ??= (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id); }
export async function mkListing(k: string, title: string, extra: Record<string, unknown> = {}, o: { passes?: PassDef[]; weeks?: number } = {}): Promise<Listing> {
  const passes = o.passes ?? STD_PASSES;
  const venueId = await ensureVenue(k);
  const period = await ensurePeriod(k);
  const ids = await Promise.all(passes.map((p) => ensurePass(k, p.name, p.days)));
  const master = [...passes].sort((a, c) => c.days - a.days)[0];
  const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {};
  passes.forEach((p, i) => { passFlat[ids[i]] = p.price; periodPrice[`${ids[i]}_${period}`] = p.price; });
  const bundle = await ok(k, "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [period], passIds: ids, priced: true, masterPrice: master.price, calcOn: false, passFlat, periodPrice });
  const listing = await ok(k, "POST", "/api/listings", {
    title, venueId, runFrom: sd(0, 0), runTo: sd((o.weeks ?? 3) - 1, 4), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "2", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: passes.map((p) => ({ name: p.name, price: p.price, days: p.days })),
    bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public", ...extra,
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0]?.id, blocks, tenantId: listing.tenantId };
}
let childN = 0;
const runTok = Date.now().toString(36).slice(-4);
export const kid = (tag = "Kid") => `${tag}${runTok}x${++childN}`;
export async function book(parent: string, L: Listing, dates: string[], pass: string, extra: Record<string, unknown> = {}, child = kid(), blockId?: string, age = 8) {
  return call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: blockId ?? L.blockId, method: "card", items: [{ pass, child, age, dates }], ...extra });
}
export const firstBooking = (r: { status: number; json: any }) => (r.json?.bookings ?? [])[0];
export const opAction = (k: string, ref: string, body: Record<string, unknown>) => call(k, "POST", `/api/bookings/${encodeURIComponent(ref)}/actions`, body);
export const opBooking = async (k: string, ref: string) => (await call(k, "GET", `/api/bookings/${encodeURIComponent(ref)}`)).json;
export const myBooking = async (k: string, ref: string) => ((await call(k, "GET", "/api/my/bookings")).json ?? []).find((b: any) => b.ref === ref);
export const blockDoc = async (k: string, listingId: string, blockId: string) => (((await call(k, "GET", `/api/listings/${listingId}`)).json?.blocks) ?? []).find((b: any) => b.id === blockId);

// results
export interface Res { id: string; area: string; ok: boolean; note: string; shots: string[] }
export const results: Res[] = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, "utf8")) : [];
export async function check(id: string, area: string, fn: (shots: string[]) => Promise<string>) {
  const only = process.env.WL_ONLY ? process.env.WL_ONLY.split(",") : null;
  if (only && !only.some((o) => id.startsWith(o))) return;
  const shots: string[] = [];
  let r: Res;
  try { r = { id, area, ok: true, note: await fn(shots), shots }; }
  catch (e) { r = { id, area, ok: false, note: (e as Error).message.slice(0, 600), shots }; }
  const i = results.findIndex((x) => x.id === id); if (i >= 0) results.splice(i, 1);
  results.push(r); fs.writeFileSync(RES, JSON.stringify(results, null, 2));
  console.log(`${r.ok ? "PASS" : "FAIL"} ${id} ${r.note}`);
}
export const eq = (a: unknown, b: unknown, label: string) => { if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
export const must = (v: unknown, label: string) => { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); };

// browser
let browser: any = null;
const ctxs: Record<string, any> = {};
export async function pageFor(k: string, url: string, w = 1440) {
  if (!browser) browser = await chromium.launch();
  const ck = `${k}@${w}`;
  if (!ctxs[ck]) {
    for (let attempt = 0; ; attempt++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 1000 } });
      await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
      const page = await ctx.newPage();
      try {
        await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        for (let i = 0; i < 8; i++) {
          await page.waitForTimeout(1500);
          await page.getByPlaceholder("you@example.com").fill(A[k].email);
          await page.locator('input[type="password"]').fill(TEST_PASSWORD);
          await page.waitForTimeout(400);
          if ((await page.getByPlaceholder("you@example.com").inputValue()) === A[k].email && (await page.locator('input[type="password"]').inputValue()) === TEST_PASSWORD) break;
        }
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
        await page.close(); ctxs[ck] = ctx; break;
      } catch (e) { await ctx.close().catch(() => {}); if (attempt >= 4) throw e; }
    }
  }
  const page = await ctxs[ck].newPage();
  await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 120_000 });
  return page;
}
export async function snap(page: any, name: string, wait: (string | RegExp)[] = [], full = true) {
  for (const w of wait) await page.getByText(w).first().waitFor({ state: "visible", timeout: 40_000 });
  await page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const f = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: f, fullPage: full });
  return path.relative(ROOT, f);
}
export async function closeAll() { if (browser) await browser.close(); }
export const mailLog = (needle: string) => {
  try { return fs.readFileSync("/tmp/aos-api-dev.log", "utf8").split("\n").filter((l) => l.includes("[mail]") && l.includes(needle)); } catch { return []; }
};

export const mailCount = (needle: string, sub?: RegExp) => mailLog(needle).filter((l) => !sub || sub.test(l)).length;
