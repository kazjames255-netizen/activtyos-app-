import path from "node:path";
import { apiFetch, apiPost, check, fbSignUp, iso, loadState, OUT, stamp, TEST_PASSWORD, WEB_URL } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState(); const OP = S.op as string; let LID = (S.L as Record<string, string>).disc;
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const ukPlus = (n: number) => { const d = new Date(ukToday() + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const rule = (r: any) => ({ id: `r${Math.random().toString(36).slice(2, 8)}`, name: "", passNames: [], enabled: true, appliesTo: "all", moreThan: 1, beforeDate: "", ...r });
const setRules = (rs: any[]) => apiFetch(`/api/listings/${LID}`, OP, { method: "PUT", body: JSON.stringify({ discounts: rs.map(rule) }) });
let n = 1000 + (Date.now() % 9000);
async function fam(nk: number) { const email = `e2e-t2-u${++n}-${stamp}@activityos-test.com`; const s = await fbSignUp(email); await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "U", lastName: String(n) }); await apiPost("/api/me/welcome", s.idToken, {}); const kids: any[] = []; for (let k = 0; k < nk; k++) { const name = `T2 U${n}k${k} ${stamp}`; kids.push({ ...(await apiPost<{ id: string }>("/api/my/children", s.idToken, { name, dob: "2018-05-14" })), name }); } return { tok: s.idToken, kids, email }; }
const dayBtns = (page: any) => page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });
async function run(b: any, id: string, f: any, o: { pass: string; ndays: number; code?: string; expect: number }) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await page.getByPlaceholder("you@example.com").fill(f.email); await page.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await page.getByPlaceholder("you@example.com").inputValue()) === f.email) break; }
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60000 }); await page.waitForTimeout(2000);
  let due = NaN, line = "", ref = "";
  await check(id, async () => {
    await page.goto(`${WEB_URL}/book/${LID}`, { waitUntil: "load" }); await page.waitForTimeout(3500);
    await page.getByRole("button", { name: new RegExp(`^${o.pass} · £`) }).first().click();
    const timing = page.getByText(/choose a timing/i); if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
    for (let i = 0; i < o.ndays; i++) await dayBtns(page).nth(i).click();
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
    await page.getByRole("button", { name: /Next — add children/ }).click();
    for (const k of f.kids) await page.getByText(k.name, { exact: false }).first().click({ timeout: 30000 });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const ph = page.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
    await page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first().selectOption("cash").catch(() => {});
    if (o.code) { await page.getByPlaceholder("Type a code…").fill(o.code); await page.getByRole("button", { name: "Apply", exact: true }).click(); await page.waitForTimeout(2000); }
    await page.waitForTimeout(1500);
    due = Number(((await page.getByRole("button", { name: /^Confirm booking/ }).innerText()).match(/£([\d.]+)/) ?? [])[1]);
    line = ((await page.locator("body").innerText()).match(/[^\n]*(discount|Early bird)[^\n]*/i)?.[0] ?? "").trim();
    await page.screenshot({ path: path.join(OUT, `ui-${id}-checkout.png`) });
    if (Math.abs(due - o.expect) > 0.011) throw new Error(`checkout shows Due now £${due}, expected £${o.expect}`);
    await page.getByRole("button", { name: /^Confirm booking/ }).click(); await page.waitForTimeout(5000);
    const mine = await apiFetch<any[]>("/api/my/bookings", f.tok);
    const total = Math.round(mine.reduce((s, r) => s + Number(r.amount ?? 0), 0) * 100) / 100; ref = mine[0]?.ref;
    if (Math.abs(total - due) > 0.011) throw new Error(`UI said Due now £${due} but the booking record is £${total}`);
    return `checkout Due now £${due} = booking record £${total}; checkout wording: "${line.slice(0, 90)}"`;
  }, async () => { const fpath = path.join(OUT, `ui-${id}-after.png`); await page.screenshot({ path: fpath }); return fpath; });
  if (ref) { await page.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await page.waitForTimeout(5000); await page.getByRole("button", { name: "Details" }).first().click().catch(() => {}); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, `ui-${id}-mybookings.png`) }); const t = await page.locator("body").innerText(); console.log(`   My bookings text mentions discount: ${/discount/i.test(t)} ; "${(t.match(/[^\n]*discount[^\n]*/i)?.[0] ?? "").slice(0, 90)}"`); }
  await ctx.close();
}
(async () => {
  // a fresh, empty listing so no day is already full (earlier sweeps filled some days of the shared one)
  const src = await apiFetch<any>(`/api/listings/${LID}`, OP);
  const keep = ["venueId","runFrom","runTo","blockMode","days","showSpaces","blockId","passes","bookingType","visibility","waitlist","waitlistMode","waitlistSize","ageFrom","ageTo","capacityScope","maxAttendees","allowOutOfRange"];
  const body: any = { status: "live" }; for (const k of keep) body[k] = src[k]; body.title = `T2 UI Clean ${stamp}`;
  const mk = await apiPost<{ id: string }>("/api/listings", OP, body); LID = mk.id;
  const bl = await apiFetch<any[]>("/api/block-bundles", OP); const bun = bl.find((x) => x.id === S.bundleId);
  await apiFetch(`/api/block-bundles/${S.bundleId}/listings`, OP, { method: "PUT", body: JSON.stringify({ listingIds: [...bun.listingIds, LID] }) });
  const b = await chromium.launch();
  await setRules([{ kind: "person", method: "percent", value: 10 }]);
  await run(b, "UI-DISC-siblings", await fam(2), { pass: "3 days", ndays: 3, expect: 97.2 });
  await setRules([{ kind: "early", method: "subtract", value: 10, beforeDate: ukPlus(30) }]);
  await run(b, "UI-DISC-earlyfixed", await fam(1), { pass: "1 day", ndays: 1, expect: 10 });
  await setRules([{ kind: "person", method: "percent", value: 10 }]);
  const code = `T2PCT${stamp}`.slice(0, 14).toUpperCase();
  await run(b, "UI-DISC-code-after-rule", await fam(2), { pass: "3 days", ndays: 3, code, expect: 87.48 });
  await setRules([]);
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
