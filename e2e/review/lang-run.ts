import fs from "node:fs"; import path from "node:path";
import { TEST_PASSWORD, fbSignIn, apiPost, apiFetch } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const TID = "Pq5HFBwVVD6bsTPeSQHL";
const setSub = (status: string) => admin.firestore().collection("tenants").doc(TID).set({ subscription: { status, plan: "freelancer" } }, { merge: true });
async function setBank(on: boolean) {
  const ref = admin.firestore().collection("libraries").doc(TID); const cur = (await ref.get()).data() ?? {}; const st = { ...(cur.settings ?? {}) }; delete st.cashOnly;
  st.billing = { ...(st.billing ?? {}), bankName: on ? "Barclays" : "", sortCode: on ? "20-57-44" : "", accountNumber: on ? "63437582" : "" };
  await ref.set({ settings: st }, { merge: true });
}
const OUT = path.join(ROOT, "e2e/review/shots/lang"); fs.mkdirSync(OUT, { recursive: true });
const LOCS = (process.env.LOCS ?? "pl,ro,ur,pa,bn,ar,pt,es,fr,cy").split(",");
const PROV = "e2e-lta-gl-muvh3jh3@activityos-test.com", PAR = "e2e-lta-p1-muvh083e@activityos-test.com";
const PHONE = { width: 390, height: 844 };
async function ctxFor(b: any, loc: string, vp: any) {
  const ctx = await b.newContext({ viewport: vp, locale: loc === "cy" ? "cy-GB" : loc });
  await ctx.addCookies([{ name: "aos.locale", value: loc, url: WEB_URL }]);
  await ctx.addInitScript((l: string) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); }, loc);
  return ctx;
}
async function login(page: any, email: string) {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load" }); await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, `${page.__loc}-00-login.png`) });
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(1200); await page.locator('input[type="email"], input[placeholder*="@"]').first().fill(email); await page.locator('input[type="password"]').first().fill(TEST_PASSWORD); }
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await page.waitForTimeout(3500);
}
const shot = async (page: any, name: string, wait = 3500) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(OUT, `${page.__loc}-${name}.png`) }); };
async function ensureDraft() {
  const t = (await fbSignIn(PROV)).idToken;
  const ls = ((await apiFetch<any[]>("/api/listings?mine=1", t)) ?? []);
  const livePass = ls.find((l) => l.status === "live" && (l.passes ?? []).some((p: any) => p.name === "Day pass"));
  if (livePass) { await apiFetch(`/api/listings/${livePass.id}`, t, { method: "PUT", body: JSON.stringify({ status: "draft" }) }); return; }
  if (ls.some((l) => l.status !== "live" && (l.passes ?? []).some((p: any) => p.name === "Day pass"))) return;
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any; const venueId = lib.venues?.[0]?.id;
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e = new Date(d); e.setDate(e.getDate() + 20); const iso = (x: Date) => x.toISOString().slice(0, 10);
  const period = await apiPost<any>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<any>("/api/passes", t, { name: "Day pass", days: 1 });
  const bundle = await apiPost<any>("/api/block-bundles", t, { name: "Camp block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: false, passFlat: { [pass.id]: 20 }, periodPrice: { [`${pass.id}_${period.id}`]: 20 } });
  const l = await apiPost<any>("/api/listings", t, { title: "Half term camp", venueId, runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "Day pass", price: 20, days: 1 }], bookingType: "auto", waitlist: true, status: "draft", visibility: "public" });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
}
(async () => {
  await ensureDraft();
  const b = await chromium.launch();
  for (const loc of LOCS) {
    console.log("==", loc);
    // PROVIDER (phone)
    let ctx = await ctxFor(b, loc, PHONE); let page = await ctx.newPage(); page.__loc = loc;
    await page.goto(`${WEB_URL}/signup`, { waitUntil: "load" }); await shot(page, "01-signup");
    await login(page, PROV);
    await page.goto(`${WEB_URL}/freelancer`, { waitUntil: "load" }); await shot(page, "02-dash", 5000);
    await page.goto(`${WEB_URL}/freelancer/listings?tab=locations`, { waitUntil: "load" }); await shot(page, "03-venue", 5000);
    await page.goto(`${WEB_URL}/freelancer/billing?tab=plan`, { waitUntil: "load" }); await shot(page, "04-plan", 5000);
    await page.goto(`${WEB_URL}/freelancer/billing?tab=paid`, { waitUntil: "load" }); await shot(page, "05-paid", 5000);
    try {
      await page.goto(`${WEB_URL}/freelancer/listings`, { waitUntil: "load" }); await page.waitForTimeout(5000);
      await page.locator('[data-ui="card"]').filter({ hasText: "Day pass" }).first().locator("button").filter({ hasText: /^(Edit|Edytuj|Editează|ترمیم|ਸੋਧ|ਸੰਪਾਦਨ|সম্পাদনা|تعديل|Editar|Modifier|Golygu)$/ }).first().click();
      await page.waitForTimeout(4000);
      const USE: Record<string, string> = { pl: "Użyj tego bloku", ro: "Folosește acest bloc", ur: "یہ بلاک استعمال کریں", pa: "ਇਹ ਬਲਾਕ ਵਰਤੋ", bn: "এই ব্লকটি ব্যবহার করুন", ar: "استخدم هذه الكتلة", pt: "Usar este bloco", es: "Usar este bloque", fr: "Utiliser ce bloc", cy: "Defnyddio’r bloc hwn" };
      let picked = false;
      for (let i = 1; i < 13; i++) {
        const use = page.getByRole("button", { name: USE[loc] ?? "Use this block", exact: true });
        if (!picked && await use.count()) { await use.first().click().catch(() => {}); picked = true; await page.waitForTimeout(800); }
        await page.locator("button").filter({ hasText: /^(Next|Dalej|Următorul|اگلا|ਅਗਲਾ|পরবর্তী|التالي|Seguinte|Siguiente|Suivant|Nesaf)/ }).last().click({ timeout: 8000 }); await page.waitForTimeout(350);
      }
      await page.waitForTimeout(1200); await shot(page, "06-wizard-last", 500);
      await setSub("none"); await setBank(false);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.locator("button").filter({ hasText: /Publish|Opublikuj|Publică|شائع|ਪ੍ਰਕਾਸ਼|প্রকাশ|نشر|Publicar|Publier|Cyhoeddi/ }).last().click({ timeout: 8000 });
      await page.waitForTimeout(3500); await shot(page, "07-golive-1", 300);
      const NEXT = /^(Next|Dalej|Następny|Următorul|اگلا|ਅਗਲਾ|পরবর্তী|التالي|Seguinte|Siguiente|Suivant|Nesaf)$/;
      const PUB = /Publish|Opublikuj|Publică|شائع|ਪ੍ਰਕਾਸ਼|প্রকাশ|نشر|Publicar|Publier|Cyhoeddi/;
      const NOTYET = /(Not yet|Jeszcze nie|Încă nu|ابھی نہیں|ਅਜੇ ਨਹੀਂ|এখনই নয়|ليس بعد|Ainda não|Todavía no|Pas encore|Ddim eto)/;
      const reopen = async () => {
        await page.locator('[role="dialog"] button').filter({ hasText: NOTYET }).first().click({ timeout: 8000 }); await page.waitForTimeout(800);
        await page.locator("button").filter({ hasText: PUB }).last().click({ timeout: 8000 }); await page.waitForTimeout(3500);
      };
      const nextWhenReady = async () => { await page.waitForTimeout(9500); await reopen(); const nb = page.locator('[role="dialog"] button').filter({ hasText: NEXT }).last(); await nb.click({ timeout: 8000 }); };
      await setSub("trialing"); await page.waitForTimeout(9500); await reopen(); await shot(page, "08-golive-2", 300);
      await setBank(true); await page.waitForTimeout(9500);
      for (let k = 0; k < 6; k++) { await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); }); await page.waitForTimeout(1500); const nb = page.locator('[role="dialog"] button').filter({ hasText: NEXT }).last(); if (await nb.isEnabled().catch(() => false)) { await nb.click(); break; } }
      await page.waitForTimeout(1500); await shot(page, "09-golive-3", 300);
    } catch (e) { console.log("modal flow failed", loc, (e as Error).message.slice(0, 120)); }
    await ctx.close();
    // PARENT (phone)
    ctx = await ctxFor(b, loc, PHONE); page = await ctx.newPage(); page.__loc = loc;
    await login(page, PAR);
    await page.goto(`${WEB_URL}/custdash`, { waitUntil: "load" }); await shot(page, "10-parent-home", 5000);
    await page.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await shot(page, "11-parent-bookings", 5000);
    await page.goto(`${WEB_URL}/custdash/browse`, { waitUntil: "load" }); await shot(page, "12-parent-browse", 5000);
    await page.goto(`${WEB_URL}/book/0FcHqQHPy8arkS4OdZRe`, { waitUntil: "load" }); await shot(page, "13-book", 6000);
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
