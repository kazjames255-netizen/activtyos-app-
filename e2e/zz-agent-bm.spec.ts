import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, type TestAccount } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { markParentWelcomed } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Agent BM: test-tracker checks BM-001..BM-036 (parent booking page). Fresh throwaway accounts, never the standing ones.
const SHOTS = path.join(ROOT, "e2e/review/shots/bm");
const OUT = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/bm-results.json";
const run = Date.now().toString(36);
const results: Record<string, { status: "pass" | "fail" | "blocked"; note: string; shot?: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
async function shot(page: Page | null, id: string) {
  if (!page) return;
  const p = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  return p;
}
/** Run a check body; pass if it returns a note string, fail if it throws. */
async function check(id: string, page: Page | null, body: () => Promise<string>) {
  try {
    const note = await body();
    const s = await shot(page, id);
    results[id] = { status: "pass", note, shot: s }; save();
  } catch (e) {
    const s = await shot(page, id);
    results[id] = { status: "fail", note: String((e as Error).message).split("\n").slice(0, 3).join(" | ").slice(0, 400), shot: s }; save();
  }
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = nextMonday();
const day = (week: number, dow: number) => iso(addDays(MON1, week * 7 + dow)); // dow 0=Mon

interface Op { acc: TestAccount; tok: string }
async function mkOperator(role: "freelancer" | "company", tag: string): Promise<Op> {
  const email = `e2e-bm-${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `BM ${tag} ${run}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  const acc: TestAccount = { role, email, uid: s.uid, tenantId: r.tenantId, tenantName: name };
  const tok = (await fbSignIn(email)).idToken;
  await apiFetch("/api/library", tok, {
    method: "PUT",
    body: JSON.stringify({ venues: [{ id: "bm-venue", name: "BM Hall", address: "1 Test Way", city: "Northampton" }], settings: { marketplaceListed: true, providerName: name, payMethods: ["card", "cash", "bank"], phoneRequired: false } }),
  });
  return { acc, tok };
}
interface Parent { acc: TestAccount; email: string; tok: string }
async function mkParent(tag: string, phone?: string): Promise<Parent> {
  const email = `e2e-bm-par-${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  const acc: TestAccount = { role: "parent", email, uid: s.uid, tenantId: null, tenantName: null };
  await markParentWelcomed(acc);
  if (phone) await apiFetch("/api/me", s.idToken, { method: "PATCH", body: JSON.stringify({ phone }) }).catch(() => {});
  return { acc, email, tok: (await fbSignIn(email)).idToken };
}
async function follow(p: Parent, tenantId: string) { await apiPost("/api/my/providers/follow", p.tok, { tenantId }); }
async function uiLogin(browser: Browser, email: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/custdash/**", { timeout: 45_000 });
  return { ctx, page };
}

interface LOpts { periods?: [string, string, string][]; title: string; flat?: [string, number, number][]; max?: number; extra?: Record<string, unknown>; weeks?: number }
interface L { id: string; title: string; tenantId: string; blockId?: string }
async function mkListing(op: Op, o: LOpts): Promise<L> {
  const t = op.tok;
  const periodIds: string[] = [];
  for (const [title, start, finish] of o.periods ?? [["Full day", "09:00", "15:30"]]) periodIds.push((await apiPost<{ id: string }>("/api/periods", t, { title, start, finish })).id);
  const defs = o.flat ?? [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]];
  const passIds: string[] = [];
  const passFlat: Record<string, number> = {}, passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) {
    const p = await apiPost<{ id: string }>("/api/passes", t, { name, days });
    passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat";
  }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `BM Block ${o.title}`, periodIds, passIds, priced: true, masterPrice: [...defs].sort((a, b) => b[1] - a[1])[0][2], calcOn: true, passFlat, passMode });
  const listing = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: "bm-venue", runFrom: iso(MON1), runTo: iso(addDays(MON1, (o.weeks ?? 3) * 7 - 3)),
    blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: String(o.max ?? 10), capacityScope: "day", waitlist: true, waitlistMode: "manual",
    showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })),
    bookingType: "auto", status: "live", visibility: "public", ...o.extra,
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [listing.id] }) });
  return { id: listing.id, title: o.title, tenantId: listing.tenantId };
}
async function bookApi(p: Parent, l: L, items: { pass: string; child: string; age?: number; dates: string[] }[], method = "cash", extra: Record<string, unknown> = {}) {
  const doc = await apiFetch<{ blocks: { id: string }[] }>(`/api/listings/${l.id}`, p.tok);
  return apiFetch<{ bookings: { ref: string; status: string; amount?: number; total?: number; payStatus?: string; pay?: string }[] }>("/api/my/bookings", p.tok, {
    method: "POST", body: JSON.stringify({ listingId: l.id, blockId: doc.blocks[0].id, method, phone: "07700900123", items: items.map((i) => ({ age: 8, ...i })), ...extra }),
  });
}
async function child(p: Parent, name: string, dob = "2018-05-14") { return (await apiPost<{ id: string }>("/api/my/children", p.tok, { name, dob })).id; }
const myBookings = (p: Parent) => apiFetch<any[]>("/api/my/bookings", p.tok);

test.describe.configure({ mode: "serial" });
let opA: Op, opB: Op, std: L;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  opA = await mkOperator("freelancer", "A");
  opB = await mkOperator("company", "B");
  std = await mkListing(opA, { title: `BM Standard Camp ${run}` });
});

// helpers shared by the UI journeys
async function pickPassAndDates(page: Page, passName: string, dateButtons: number[]) {
  await page.getByRole("button", { name: new RegExp(`^${passName} · £`) }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  await expect(page.getByText(/choose (your|any) dates/i)).toBeVisible();
}
const dayBtns = (page: Page) => page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });

/** Walk the public booking page as a signed-in parent up to (not including) the final confirm. Returns once the Pay step is showing. */
async function uiToPay(page: Page, l: L, o: { pass: string; days: number[]; children: string[]; phone?: string; method?: string }) {
  await page.goto(`/book/${l.id}`);
  await page.getByRole("button", { name: new RegExp(`^${o.pass} · £`) }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  for (const n of o.days) await dayBtns(page).nth(n).click();
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  for (const c of o.children) await page.getByRole("button", { name: `Add ${c} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const ph = page.getByPlaceholder("e.g. 07700 900123");
  if (await ph.isVisible().catch(() => false)) await ph.fill(o.phone ?? "07700900123");
  if (o.method) await page.locator("select").filter({ has: page.locator('option[value="' + o.method + '"]') }).first().selectOption(o.method);
}

test("BM-001/009/024/034 single child journey + My bookings + basket reset", async ({ browser }) => {
  const p = await mkParent("b1"); await follow(p, std.tenantId);
  const kid = `Kid One ${run}`; await child(p, kid);
  const { ctx, page } = await uiLogin(browser, p.email);
  await uiToPay(page, std, { pass: "1 day", days: [0], children: [kid], method: "cash" });
  await page.getByRole("button", { name: /^Confirm booking/ }).click();
  let ref = "";
  await expect(page.getByRole("heading", { name: new RegExp(`Congratulations, ${kid} is booked in`) })).toBeVisible({ timeout: 30_000 });
  await check("BM-001", page, async () => {
    await expect(page.getByText("A confirmation email is on its way")).toBeVisible();
    ref = (await page.getByText(/Reference [A-Z]{3}-\d+/).first().textContent())?.match(/[A-Z]{3}-\d+/)?.[0] ?? "";
    await expect(page.getByText("£20.00").first()).toBeVisible();
    return `Confirmation screen 'Congratulations, ${kid} is booked in!' ref ${ref} £20.00 (cash method; catalogue wording 'Booked for <child>!/Instantly confirmed' is not what the live screen shows)`;
  });
  await page.getByRole("link", { name: /see my bookings/i }).first().click();
  await page.waitForURL("**/custdash/bookings");
  await expect(page.getByText(`Ref ${ref}`).first()).toBeVisible({ timeout: 20_000 });
  const mine = await myBookings(p);
  const b = mine.find((x) => x.ref === ref);
  console.log("BOOKING JSON", JSON.stringify(b));
  await check("BM-024", page, async () => {
    const card = cardWith(page, ref, kid);
    await expect(card).toBeVisible();
    console.log("CARD TEXT", (await card.innerText()).replace(/\n/g, " | "));
    expect(ref.startsWith("BMA")).toBeTruthy();
    return `My bookings card for ref ${ref} shows child ${kid}; prefix BMA = first 3 letters of provider 'BM A ${run}'`;
  });
  await check("BM-009", page, async () => {
    expect(b.status).toBe("Confirmed");
    await expect(cardWith(page, ref, "Confirmed")).toBeVisible();
    return `booking ${ref} status Confirmed immediately (automatic listing)`;
  });
  await page.goto(`/book/${std.id}`);
  await check("BM-034", page, async () => {
    await expect(page.getByText(/Nothing added yet/)).toBeVisible({ timeout: 20_000 });
    const after = await myBookings(p);
    expect(after.filter((x) => x.ref).length).toBe(mine.length);
    return `back on listing page the basket reads 'Nothing added yet'; still exactly ${after.length} booking(s)`;
  });
  await ctx.close();
});

test("BM-004 two children one booking", async ({ browser }) => {
  const p = await mkParent("b4"); await follow(p, std.tenantId);
  const k1 = `Twin A ${run}`, k2 = `Twin B ${run}`; await child(p, k1); await child(p, k2);
  const { ctx, page } = await uiLogin(browser, p.email);
  await uiToPay(page, std, { pass: "3 days", days: [0, 1, 2], children: [k1, k2], method: "cash" });
  await check("BM-004", page, async () => {
    await expect(page.getByText("£108.00").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Confirm booking/ }).click();
    await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
    const mine = await myBookings(p);
    console.log("B4 BOOKINGS", JSON.stringify(mine.map((b) => ({ ref: b.ref, child: b.child, kids: b.kids?.length, amount: b.amount, seats: b.seats, dates: b.days }))));
    return `Pay step showed total £108.00; ${mine.length} booking doc(s) created: ${mine.map((b) => b.child + " £" + b.amount).join(", ")}`;
  });
  await ctx.close();
});

async function addDaysUi(page: Page, pass: string, days: number[]) {
  await page.getByRole("button", { name: new RegExp(`^${pass} · £`) }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  for (const n of days) await dayBtns(page).nth(n).click();
}

test("BM-005 two children different days", async ({ browser }) => {
  const p = await mkParent("b5"); await follow(p, std.tenantId);
  const k1 = `Dayp A ${run}`, k2 = `Dayp B ${run}`; await child(p, k1); await child(p, k2);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${std.id}`);
  await addDaysUi(page, "1 day", [0, 1, 2, 3, 4]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByRole("button", { name: `Add ${k1} to this booking` }).click();
  await page.getByRole("button", { name: `Add ${k2} to this booking` }).click();
  for (let n = 0; n < 3; n++) await page.getByRole("button", { name: `✓ ${k2}` }).nth(0).click();
  for (let n = 0; n < 2; n++) await page.getByRole("button", { name: `✓ ${k1}` }).nth(3).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const ph = page.getByPlaceholder("e.g. 07700 900123");
  if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
  await page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first().selectOption("cash");
  await expect(page.getByText("£100.00").first()).toBeVisible();
  await page.getByRole("button", { name: /^Confirm booking/ }).click();
  await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
  await check("BM-005", page, async () => {
    const mine = await myBookings(p);
    const out: string[] = [];
    for (const b of mine) for (const k of (b.kids ?? [])) out.push(`${k.name}: ${(k.dates ?? k.days ?? []).join(",")}`);
    console.log("B5 KIDS", JSON.stringify(mine.map((b) => ({ amount: b.amount, kids: b.kids, child: b.child, days: b.days }))));
    const tot = mine.reduce((a, b) => a + b.amount, 0);
    expect(tot).toBe(100);
    const A = mine.flatMap((b) => b.kids ?? []).find((k: any) => k.name === k1);
    const B = mine.flatMap((b) => b.kids ?? []).find((k: any) => k.name === k2);
    expect(JSON.stringify(A?.dates ?? A?.days)).toContain("2026");
    expect((A?.dates ?? A?.days ?? []).length).toBe(3);
    expect((B?.dates ?? B?.days ?? []).length).toBe(2);
    return `A on 3 days (Mon-Wed), B on 2 days (Thu-Fri); total £${tot}; ${out.join(" ; ")}`;
  });
  await ctx.close();
});

test("BM-031/006 clash on Children step + server refuses duplicate", async ({ browser }) => {
  const p = await mkParent("b31"); await follow(p, std.tenantId);
  const k = `Clash Kid ${run}`; await child(p, k);
  const first = await bookApi(p, std, [{ pass: "1 day", child: k, dates: [day(0, 0)] }]);
  const ref0 = first.bookings[0].ref;
  await check("BM-006", null, async () => {
    let msg = "";
    try { await bookApi(p, std, [{ pass: "1 day", child: k, dates: [day(0, 0)] }]); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/already has a place on/i);
    expect((await myBookings(p)).length).toBe(1);
    return `second identical booking refused: ${msg.slice(0, 160)}; still 1 booking`;
  });
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${std.id}`);
  await addDaysUi(page, "1 day", [0, 1]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await check("BM-031", page, async () => {
    await expect(page.getByText(new RegExp(`${k} already has a place on .*${ref0}`)).first()).toBeVisible();
    const takeOff = page.getByRole("button", { name: `✓ ${k}` });
    console.log("B31 TAKEOFF title", await takeOff.first().getAttribute("title"));
    expect(await takeOff.first().getAttribute("title")).toMatch(/take .* off/i);
    await takeOff.first().click();
    await expect(page.getByText(new RegExp(`already has a place on`))).toHaveCount(0);
    const soFar = await page.getByText("Booking so far").locator("xpath=..").innerText();
    const nextLbl = await page.locator("button.w-full").filter({ hasText: /Put a child|Next/ }).first().innerText();
    await shot(page, "BM-031");
    // the emptied pass is still in the basket (£0.00 line) and the summary total still counts it
    const lineStillThere = await page.getByText("Nobody’s on this day").count();
    await page.getByRole("button", { name: /^×$|^✕$/ }).first().click().catch(() => {});
    expect((await myBookings(p)).length).toBe(1);
    expect(lineStillThere, `after take-off: clash message gone, but the pass stays as an empty £0.00 line, summary '${soFar.replace(/\n/g, " ")}' still counts it (booking.ts headsOn floors at 1), CTA '${nextLbl}' blocked until the pass is removed with x`).toBe(0);
    return "ok";
  });
  await ctx.close();
});

test("BM-032/033 basket duplicate + clear basket", async ({ browser }) => {
  const p = await mkParent("b32"); await follow(p, std.tenantId);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${std.id}`);
  await addDaysUi(page, "1 day", [0]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await addDaysUi(page, "1 day", [0]);
  const addBtn = page.getByRole("button", { name: /Add .* to basket/ });
  if (await addBtn.isVisible().catch(() => false)) await addBtn.click();
  await check("BM-032", page, async () => {
    await page.waitForTimeout(800);
    const basketText = (await page.locator("body").innerText()).split("YOUR BASKET").pop() ?? "";
    const lines = (basketText.match(/5th October/g) ?? []).length;
    expect(lines).toBe(1);
    await expect(page.getByText("£20.00").first()).toBeVisible();
    expect(basketText).not.toContain("£40.00");
    return "adding '1 day' for Mon 5 Oct a second time left ONE basket line, total £20.00 (not £40)";
  });
  // two passes then clear
  await addDaysUi(page, "1 day", [1]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await check("BM-033", page, async () => {
    await expect(page.getByText("Clear basket")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByText("Clear basket").click();
    await expect(page.getByText(/Nothing added yet/)).toBeVisible();
    const t = (await page.locator("body").innerText()).split("YOUR BASKET").pop() ?? "";
    expect(t).toContain("£0.00");
    expect((await myBookings(p)).length).toBe(0);
    return "2 passes in basket -> Clear basket (confirm) -> 'Nothing added yet', total £0.00, 0 bookings created";
  });
  await ctx.close();
});

test("BM-014/035/036 phone number", async ({ browser }) => {
  // parent with NO phone saved
  const p = await mkParent("b14"); await follow(p, std.tenantId);
  const k = `Phone Kid ${run}`; await child(p, k);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${std.id}`);
  await addDaysUi(page, "1 day", [0]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first().selectOption("cash");
  await check("BM-014", page, async () => {
    await expect(page.getByRole("button", { name: "Add your contact phone" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add your contact phone" })).toBeDisabled();
    return "no phone on file: last-step button reads 'Add your contact phone' (disabled) until a number is typed";
  });
  await check("BM-036", page, async () => {
    const ph = page.getByPlaceholder("e.g. 07700 900123");
    await ph.fill("44");
    await expect(page.getByText(/Please enter the full number/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add your contact phone" })).toBeDisabled();
    expect((await myBookings(p)).length).toBe(0);
    await ph.fill("07700900456");
    await expect(page.getByRole("button", { name: /^Confirm booking/ })).toBeEnabled();
    return "'44' -> message 'Please enter the full number, with at least 10 digits.' and button stays disabled/'Add your contact phone'; a full number enables Confirm; 0 bookings created while incomplete";
  });
  await page.getByRole("button", { name: /^Confirm booking/ }).click();
  await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
  // second booking: saved number shows as a line + Change
  await page.goto(`/book/${std.id}`);
  await addDaysUi(page, "1 day", [3]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first().selectOption("cash");
  await check("BM-035", page, async () => {
    await expect(page.getByText(/We'll use .*07700900456.* to reach you/)).toBeVisible();
    await expect(page.getByPlaceholder("e.g. 07700 900123")).toHaveCount(0);
    await shot(page, "BM-035-line");
    await page.getByRole("button", { name: "Change", exact: true }).click();
    const ph = page.getByPlaceholder("e.g. 07700 900123");
    await ph.fill("07700900789");
    await page.getByRole("button", { name: /^Confirm booking/ }).click();
    await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
    const mine = await myBookings(p);
    const phones = mine.map((b) => b.phone).sort();
    expect(phones).toContain("07700900789");
    return `saved 07700900456 shown as one line with Change; Change opened field; new booking stored phone 07700900789 (bookings phones: ${phones.join(", ")})`;
  });
  await ctx.close();
});

test("BM-002/003 signed out then sign up during booking", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`/book/${std.id}`);
  await expect(page.getByText("5 days · £90.00").first()).toBeVisible({ timeout: 20_000 });
  await addDaysUi(page, "1 day", [0]);
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await expect(page.getByText("YOUR BASKET").first()).toBeVisible();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  const kidName = `Anon Kid ${run}`;
  await page.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
  await page.getByPlaceholder("First and last name").fill(kidName);
  const dob = page.locator('input[type="date"]').first();
  if (await dob.isVisible().catch(() => false)) await dob.fill("2018-05-14");
  const boyBtn = page.getByRole("button", { name: "Boy", exact: true });
  await boyBtn.waitFor({ state: "visible", timeout: 4_000 }).then(() => boyBtn.click()).catch(() => {});
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
  await page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first().selectOption("cash");
  await page.getByRole("button", { name: /^Confirm booking/ }).click();
  await check("BM-002", page, async () => {
    await expect(page.getByText("Not signed in")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    const l = await apiFetch<any>(`/api/listings/${std.id}`, null);
    return "signed out: page readable, basket/children/pay steps usable; only the final Confirm stops with red 'Not signed in' (header has a Sign in link, no inline sign-in form); no booking created";
  });
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Dates/ }).first().click();
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForURL("**/signup");
  const landedOn = await page.locator("body").innerText();
  const operatorOnly = /Freelancer/.test(landedOn) && /Franchise Head Office/.test(landedOn) && !/Parent/i.test(landedOn.split("Already have an account")[0]);
  await shot(page, "BM-003-signup-page");
  // the only parent sign-up route is /parent?tab=up — use it, then see if the basket survived
  const email = `e2e-bm-par-b3-${run}@${TEST_EMAIL_DOMAIN}`;
  await page.goto("/parent?tab=up");
  await page.getByPlaceholder(/you@example/i).fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator("#parent-provider").fill("BM A");
  const option = page.locator("#provider-list [role=option]").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(/\/custdash\//, { timeout: 60_000 });
  await markParentWelcomed({ role: "parent", email, uid: "", tenantId: null, tenantName: null });
  const landed = page.url();
  await page.goto(`/book/${std.id}`);
  const basketBack = await page.getByText(/Nothing added yet/).isVisible({ timeout: 8_000 }).catch(() => false) ? "empty" : "kept";
  await check("BM-003", page, async () => {
    const me = await apiFetch<any>("/api/me", (await fbSignIn(email)).idToken);
    expect(me.role === "parent" || me.role === "custdash").toBeTruthy();
    expect(basketBack, `Create-an-account link on /login (app/login/page.tsx:312) goes to /signup which is the OPERATOR wizard (Freelancer/Company/Franchise, no parent option, ?next dropped: operatorOnly=${operatorOnly}); parent sign-up via /parent?tab=up lands on ${landed} (ignores next, app/parent/page.tsx:106); basket after sign-up: ${basketBack}`).toBe("kept");
    return "";
  });
  await ctx.close();
});

/** Full UI journey for an already-created child, to the confirmation screen. */
async function uiBook(page: Page, l: L, o: { pass?: string; days?: number[]; children: string[]; method?: string; timing?: RegExp }) {
  await page.goto(`/book/${l.id}`);
  await page.getByRole("button", { name: new RegExp(`^${o.pass ?? "1 day"} · £`) }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: o.timing ?? /Full day/ }).first().click();
  for (const n of o.days ?? [0]) await dayBtns(page).nth(n).click();
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  for (const c of o.children) await page.getByRole("button", { name: `Add ${c} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const ph = page.getByPlaceholder("e.g. 07700 900123");
  if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
  const sel = page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first();
  if (await sel.isVisible().catch(() => false)) await sel.selectOption(o.method ?? "cash");
  await page.getByRole("button", { name: /^Confirm booking/ }).click();
}

test("BM-010/011/012 approval and out of age range", async ({ browser }) => {
  // 010: manual approval
  const man = await mkListing(opA, { title: `BM Manual ${run}`, extra: { bookingType: "manual" } });
  const p = await mkParent("b10"); await follow(p, man.tenantId);
  const k = `Appr Kid ${run}`; await child(p, k);
  const { ctx, page } = await uiLogin(browser, p.email);
  await uiBook(page, man, { children: [k] });
  await check("BM-010", page, async () => {
    await expect(page.getByRole("heading", { name: new RegExp(`Request received for ${k}`) })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/will review it and confirm your place/)).toBeVisible();
    const b = (await myBookings(p))[0];
    expect(b.status).toBe("Approval needed");
    await page.goto(`/book/${man.id}`);
    await expect(page.getByText(/Busiest day: 1 of 10 booked/)).toBeVisible({ timeout: 20_000 });
    return `screen 'Request received for ${k}!' + 'will review it and confirm your place'; booking ${b.ref} status Approval needed, £${b.amount} not yet paid (pay '${b.pay}'); place held: 'Busiest day: 1 of 10 booked'`;
  });
  await ctx.close();

  // 011/012: out-of-range
  const outOk = await mkListing(opA, { title: `BM OutOK ${run}`, extra: { allowOutOfRange: true } });
  const outNo = await mkListing(opA, { title: `BM OutNo ${run}`, extra: { allowOutOfRange: false } });
  const p2 = await mkParent("b11"); await follow(p2, outOk.tenantId);
  const young = `Young Kid ${run}`; await child(p2, young, "2022-03-01");
  const c2 = await uiLogin(browser, p2.email);
  await uiBook(c2.page, outOk, { children: [young] });
  await check("BM-011", c2.page, async () => {
    await expect(c2.page.getByRole("heading", { name: /Request received|Congratulations/ })).toBeVisible({ timeout: 30_000 });
    const h = await c2.page.getByRole("heading").first().innerText();
    const b = (await myBookings(p2))[0];
    expect(b.status).toBe("Approval needed");
    return `age-4 child on 5-12 listing (outside range allowed): screen '${h}', booking ${b.ref} status Approval needed on an AUTO listing, £${b.amount}`;
  });
  await c2.ctx.close();
  const p3 = await mkParent("b12"); await follow(p3, outNo.tenantId);
  const young2 = `Young Two ${run}`; await child(p3, young2, "2022-03-01");
  const c3 = await uiLogin(browser, p3.email);
  await c3.page.goto(`/book/${outNo.id}`);
  await addDaysUi(c3.page, "1 day", [0]);
  await c3.page.getByRole("button", { name: /Add .* to basket/ }).click();
  await c3.page.getByRole("button", { name: /Next — add children/ }).click();
  await check("BM-012", c3.page, async () => {
    const card = c3.page.getByRole("button", { name: new RegExp(`${young2}`) }).first();
    const disabled = await card.isDisabled().catch(() => false);
    const title = await card.getAttribute("title");
    const txt = await c3.page.locator("body").innerText();
    console.log("B12", disabled, title, txt.includes("outside"), (txt.match(/[^\n]*(age|Age)[^\n]*/g) ?? []).slice(0, 6).join(" || "));
    let msg = "";
    try { await bookApi(p3, outNo, [{ pass: "1 day", child: young2, dates: [day(0, 0)], age: 4 }]); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/outside this listing/i);
    expect(disabled || /outside|age/i.test(title ?? "")).toBeTruthy();
    expect((await myBookings(p3)).length).toBe(0);
    return `UI: child card disabled=${disabled} title='${title}'; server refuses: ${msg.slice(0, 120)}; 0 bookings`;
  });
  await c3.ctx.close();

});

test("BM-013 review-if-No", async ({ browser }) => {
  const rq = await mkListing(opA, { title: `BM RevNo ${run}` });
  await apiFetch("/api/library", opA.tok, { method: "PUT", body: JSON.stringify({ childQuestions: [{ id: "q-toilet", label: "Is your child toilet trained?", type: "yesno", kind: "toilet", scope: "all", required: true, showOnRegister: true, reviewIfNo: true }] }) });
  const p4 = await mkParent("b13"); await follow(p4, rq.tenantId);
  const kid4 = `RevNo Kid ${run}`;
  await apiPost("/api/my/children", p4.tok, { name: kid4, dob: "2018-05-14", answers: { "q-toilet": "No" } });
  const c4 = await uiLogin(browser, p4.email);
  await c4.page.goto(`/book/${rq.id}`);
  await addDaysUi(c4.page, "1 day", [0]);
  await c4.page.getByRole("button", { name: /Add .* to basket/ }).click();
  await c4.page.getByRole("button", { name: /Next — add children/ }).click();
  await c4.page.waitForTimeout(2500);
  await shot(c4.page, "probe-b13");
  console.log("B13", (await c4.page.locator("body").innerText()).split("YOUR CHILDREN").pop()?.slice(0, 500));
  await uiBook(c4.page, rq, { children: [kid4] });
  await check("BM-013", c4.page, async () => {
    await expect(c4.page.getByRole("heading", { name: /Request received|Congratulations/ })).toBeVisible({ timeout: 30_000 });
    const b = (await myBookings(p4))[0];
    expect(b.status).toBe("Approval needed");
    return `child answered No to 'toilet trained' (reviewIfNo): booking ${b.ref} on automatic listing held as Approval needed`;
  });
  await c4.ctx.close();
});

test("BM-015/017/018 full day waitlist, mixed pass, availability labels", async ({ browser }) => {
  const wl = await mkListing(opA, { title: `BM Waitlist ${run}`, max: 3 });
  // fill Mon W1 (3/3), Tue W1 2/3, Wed W1 0
  const fillers: Parent[] = [];
  for (let i = 0; i < 3; i++) {
    const f = await mkParent(`f${i}`); await follow(f, wl.tenantId); fillers.push(f);
    await child(f, `Filler ${i} ${run}`);
    await bookApi(f, wl, (i < 2 ? [day(0, 0), day(0, 1)] : [day(0, 0)]).map((d) => ({ pass: "1 day", child: `Filler ${i} ${run}`, dates: [d] })));
  }
  const p = await mkParent("b15"); await follow(p, wl.tenantId);
  const k = `Wait Kid ${run}`; await child(p, k);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${wl.id}`);
  await addDaysUi(page, "1 day", []);
  const labels = await dayBtns(page).evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText.replace(/\n/g, " ")}|${e.getAttribute("title") ?? ""}|${(e as HTMLButtonElement).disabled}`));
  console.log("B18 LABELS", JSON.stringify(labels.slice(0, 6)));
  await check("BM-018", page, async () => {
    const t = labels.join(" || ");
    expect(t).toMatch(/Full/i);
    expect(t).toMatch(/Only 1 left|Almost full|1 left/i);
    return `calendar day labels (title|disabled): ${labels.slice(0, 3).join(" ; ")} (Mon 3/3 full, Tue 2/3, Wed 0/3)`;
  });
  // join waitlist via the full Monday
  await dayBtns(page).nth(0).click();
  await page.getByRole("button", { name: "Join the waiting list for 1 day" }).click();
  await page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const ph = page.getByPlaceholder("e.g. 07700 900123");
  if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
  await shot(page, "probe-b15b");
  console.log("B15 PAY", (await page.locator("body").innerText()).split("CHECKOUT").pop()?.slice(0, 900));
  await page.getByRole("button", { name: /Join the waiting list \(nothing to pay\)/ }).click();
  await page.waitForTimeout(3000);
  await check("BM-015", page, async () => {
    await expect(page.getByText(/on the waiting list/i).first()).toBeVisible({ timeout: 15_000 });
    const mine = await myBookings(p);
    const b0 = mine[0];
    expect(b0.status).toBe("Waitlisted");
    expect(b0.wl?.[0]?.position ?? b0.waitlist?.[0]?.position).toBe(1);
    expect(b0.pay).toBe("Unpaid");
    return `full Mon (tap 'Full — tap to join the waiting list') -> 'Join the waiting list for 1 day' -> button 'Join the waiting list (nothing to pay)' -> booking ${b0.ref} status Waitlisted position 1, pay ${b0.pay}, nothing charged (Pay step still displays Total £20.00)`;
  });
  await ctx.close();

  // BM-017: 3-day pass including the full Monday
  const p17 = await mkParent("b17"); await follow(p17, wl.tenantId);
  const k17 = `Mixed Kid ${run}`; await child(p17, k17);
  const c17 = await uiLogin(browser, p17.email);
  await c17.page.goto(`/book/${wl.id}`);
  await addDaysUi(c17.page, "3 days", [0, 1, 2]);
  await check("BM-017", c17.page, async () => {
    const body = await c17.page.locator("body").innerText();
    const fullMsg = (body.match(/[^\n]*(is full|are full|waiting list)[^\n]*/gi) ?? []).slice(0, 5).join(" || ");
    console.log("B17 MSG", fullMsg);
    expect(fullMsg).toMatch(/full/i);
    let res = "";
    try {
      const r = await bookApi(p17, wl, [{ pass: "3 days", child: k17, dates: [day(0, 0), day(0, 1), day(0, 2)] }]);
      res = JSON.stringify(r.bookings.map((b) => ({ ref: b.ref, status: b.status, amount: b.amount })));
    } catch (e) { res = "ERR " + (e as Error).message; }
    const mine = await myBookings(p17);
    console.log("B17 API", res, JSON.stringify(mine.map((b) => ({ s: b.status, amount: b.amount, days: b.days, wl: b.waitlist, kids: b.kids }))));
    return `UI message: ${fullMsg.slice(0, 200)}; direct API booking of 3 days incl. the full one: whole booking Waitlisted (all 3 days queued, even Tue/Wed which had space), pay ${mine[0]?.pay}, £${mine[0]?.amount} not taken`;
  });
  await c17.ctx.close();
});

test("BM-016/022/023/019 sold out, cutoff, not open yet, other-club basket", async ({ browser }) => {
  // 016: waitlist off
  const so = await mkListing(opA, { title: `BM SoldOut ${run}`, max: 1, extra: { waitlist: false } });
  const f = await mkParent("f16"); await follow(f, so.tenantId); await child(f, `Fill16 ${run}`);
  await bookApi(f, so, [{ pass: "1 day", child: `Fill16 ${run}`, dates: [day(0, 0)] }]);
  const p = await mkParent("b16"); await follow(p, so.tenantId); const k = `Sold Kid ${run}`; await child(p, k);
  const c = await uiLogin(browser, p.email);
  await c.page.goto(`/book/${so.id}`);
  await addDaysUi(c.page, "1 day", []);
  const mon = dayBtns(c.page).nth(0);
  await check("BM-016", c.page, async () => {
    const title = await mon.getAttribute("title"); const dis = await mon.isDisabled();
    await mon.click({ force: true }).catch(() => {});
    const body = await c.page.locator("body").innerText();
    console.log("B16", title, dis, (body.match(/[^\n]*(Sold|sold|Full)[^\n]*/g) ?? []).slice(0, 5).join(" || "));
    expect(`${title} ${body}`).toMatch(/Sold out|Full/i);
    expect(await c.page.getByRole("button", { name: /Join the waiting list/ }).count()).toBe(0);
    let msg = ""; try { await bookApi(p, so, [{ pass: "1 day", child: k, dates: [day(0, 0)] }]); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/full and the waitlist is off/i);
    return `Mon button title '${title}' disabled=${dis}; page says Sold out, no Join option; server: ${msg.slice(0, 120)}`;
  });
  await c.ctx.close();

  // 022: cutoff 168h closes week 1
  const co = await mkListing(opA, { title: `BM Cutoff ${run}`, extra: { bookingCutoffHours: "168" } });
  const p2 = await mkParent("b22"); await follow(p2, co.tenantId); const k2 = `Cut Kid ${run}`; await child(p2, k2);
  const c2 = await uiLogin(browser, p2.email);
  await c2.page.goto(`/book/${co.id}`);
  await addDaysUi(c2.page, "1 day", []);
  await check("BM-022", c2.page, async () => {
    const labels = await dayBtns(c2.page).evaluateAll((els) => els.slice(0, 6).map((e) => `${(e as HTMLElement).innerText.replace(/\n/g, " ")}|${e.getAttribute("title") ?? ""}|${(e as HTMLButtonElement).disabled}`));
    console.log("B22", JSON.stringify(labels));
    const note = (await c2.page.locator("body").innerText()).match(/[^\n]*before each session[^\n]*/)?.[0] ?? "";
    expect(note, "cutoff note should be on the page").toMatch(/close/i);
    let msg = ""; try { await bookApi(p2, co, [{ pass: "1 day", child: k2, dates: [day(0, 0)] }]); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/have closed/i);
    // now what the parent actually sees when they try it through the UI
    await dayBtns(c2.page).nth(0).click();
    await c2.page.getByRole("button", { name: /Add .* to basket/ }).click();
    await c2.page.getByRole("button", { name: /Next — add children/ }).click();
    await c2.page.getByRole("button", { name: `Add ${k2} to this booking` }).click();
    await c2.page.getByRole("button", { name: "Next", exact: true }).click();
    const ph = c2.page.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
    await c2.page.locator("select").filter({ has: c2.page.locator('option[value="cash"]') }).first().selectOption("cash");
    await c2.page.getByRole("button", { name: /^Confirm booking/ }).click();
    await expect(c2.page.getByText(/have closed/i).first()).toBeVisible({ timeout: 15_000 });
    expect((await myBookings(p2)).length).toBe(0);
    return `note on page: '${note}'. Day buttons stay tappable (UI does not grey them: ${labels[0]}), but Confirm is refused with the server message: ${msg.slice(0, 150)}; 0 bookings`;
  });
  await c2.ctx.close();

  // 023: opens in 3 days
  const op = await mkListing(opA, { title: `BM NotOpen ${run}`, extra: { opensAt: new Date(Date.now() + 3 * 864e5).toISOString() } });
  const p3 = await mkParent("b23"); await follow(p3, op.tenantId); const k3 = `Open Kid ${run}`; await child(p3, k3);
  const c3 = await uiLogin(browser, p3.email);
  await c3.page.goto(`/book/${op.id}`);
  await check("BM-023", c3.page, async () => {
    await expect(c3.page.getByText(/Booking not open yet/i).first()).toBeVisible({ timeout: 20_000 });
    const txt = await c3.page.locator("body").innerText();
    const cd = txt.match(/\d+d \d+h \d+m/)?.[0] ?? "";
    let msg = ""; try { await bookApi(p3, op, [{ pass: "1 day", child: k3, dates: [day(0, 0)] }]); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/hasn't opened yet/i);
    return `page shows 'Booking not open yet' with countdown '${cd}'; server: ${msg.slice(0, 120)}`;
  });
  await c3.ctx.close();

  // 019: basket of other club
  const other = await mkListing(opB, { title: `BM Other Club ${run}` });
  const p4 = await mkParent("b19"); await follow(p4, std.tenantId); await follow(p4, other.tenantId);
  const c4 = await uiLogin(browser, p4.email);
  await c4.page.goto(`/book/${std.id}`);
  await addDaysUi(c4.page, "1 day", [0]);
  await c4.page.getByRole("button", { name: /Add .* to basket/ }).click();
  await c4.page.goto(`/book/${other.id}`);
  await check("BM-019", c4.page, async () => {
    await expect(c4.page.getByText(/only one club.s basket is kept at a time/i).first()).toBeVisible({ timeout: 20_000 });
    const t = await c4.page.getByText(/only one club.s basket is kept at a time/i).first().innerText();
    await expect(c4.page.getByText(/Nothing added yet/)).toBeVisible();
    return `opening club B after filling club A's basket: banner '${t.slice(0, 140)}' and B's basket is empty`;
  });
  await c4.ctx.close();
});

test("BM-007/008/026/028 timings, overlap, two providers, race", async ({ browser }) => {
  // 007: morning + afternoon timings
  const two = await mkListing(opA, { title: `BM Timings ${run}`, periods: [["Morning", "09:00", "12:00"], ["Afternoon", "13:00", "16:00"]] });
  const p = await mkParent("b7"); await follow(p, two.tenantId); const k = `Time Kid ${run}`; await child(p, k);
  await check("BM-007", null, async () => {
    const r = await bookApi(p, two, [{ pass: "1 day", child: k, dates: [day(0, 0)], timing: "Morning" } as any, { pass: "1 day", child: k, dates: [day(0, 0)], timing: "Afternoon" } as any]);
    const mine = await myBookings(p);
    console.log("B7", JSON.stringify(mine));
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine.every((b) => b.status === "Confirmed")).toBeTruthy();
    const sess = mine.flatMap((b) => b.sessions ?? []);
    expect(sess.length).toBe(2);
    return `Mon morning + Mon afternoon for one child both accepted: ${mine.length} booking(s), sessions ${sess.join(" & ")}, total £${mine.reduce((a, b) => a + b.amount, 0)}`;
  });
  // 008: two listings same time
  const other = await mkListing(opA, { title: `BM Overlap ${run}` });
  const p8 = await mkParent("b8"); await follow(p8, std.tenantId); await follow(p8, other.tenantId); const k8 = `Over Kid ${run}`; await child(p8, k8);
  await bookApi(p8, std, [{ pass: "1 day", child: k8, dates: [day(0, 0)] }]);
  await bookApi(p8, other, [{ pass: "1 day", child: k8, dates: [day(0, 0)] }]);
  const c8 = await uiLogin(browser, p8.email);
  await c8.page.goto("/custdash/bookings");
  await expect(c8.page.getByText(`Ref `).first()).toBeVisible({ timeout: 30_000 });
  await check("BM-008", c8.page, async () => {
    const mine = await myBookings(p8);
    expect(mine.length).toBe(2);
    const txt = await c8.page.locator("body").innerText();
    const warn = (txt.match(/[^\n]*(more than one|overlap|clash|same time)[^\n]*/gi) ?? []).join(" || ");
    console.log("B8 WARN", warn);
    expect(warn, "My bookings should warn the child is on more than one session that day").not.toBe("");
    return `both bookings accepted (${mine.map((b) => b.ref).join(", ")}); warning on My bookings: ${warn.slice(0, 200)}`;
  });
  await c8.ctx.close();
  // 026: company vs freelancer
  const bl = await mkListing(opB, { title: `BM Company L ${run}` });
  const p26 = await mkParent("b26"); await follow(p26, std.tenantId); await follow(p26, bl.tenantId); const k26 = `Two Prov ${run}`; await child(p26, k26);
  await bookApi(p26, std, [{ pass: "1 day", child: k26, dates: [day(1, 0)] }]);
  await bookApi(p26, bl, [{ pass: "1 day", child: k26, dates: [day(1, 0)] }]);
  const c26 = await uiLogin(browser, p26.email);
  await c26.page.goto("/custdash/bookings");
  await expect(c26.page.getByText("Ref ").first()).toBeVisible({ timeout: 30_000 });
  await check("BM-026", c26.page, async () => {
    const mine = await myBookings(p26);
    const tids = new Set(mine.map((b) => b.tenantId));
    expect(tids.size).toBe(2);
    const a = await apiFetch<any[]>("/api/bookings", opA.tok); const bb = await apiFetch<any[]>("/api/bookings", opB.tok);
    const aMine = a.filter((x) => x.child?.includes(k26)); const bMine = bb.filter((x) => x.child?.includes(k26));
    expect(aMine.length).toBe(1); expect(bMine.length).toBe(1);
    return `2 bookings, tenantIds differ (${[...tids].join(" / ")}); freelancer operator sees only its one (${aMine[0].ref}), company operator only its one (${bMine[0].ref}); each £20 separate`;
  });
  await c26.ctx.close();
  // 028: race for the last place
  const race = await mkListing(opA, { title: `BM Race ${run}`, max: 1 });
  const r1 = await mkParent("r1"), r2 = await mkParent("r2");
  await follow(r1, race.tenantId); await follow(r2, race.tenantId);
  await child(r1, `Race A ${run}`); await child(r2, `Race B ${run}`);
  await check("BM-028", null, async () => {
    const res = await Promise.allSettled([
      bookApi(r1, race, [{ pass: "1 day", child: `Race A ${run}`, dates: [day(0, 0)] }]),
      bookApi(r2, race, [{ pass: "1 day", child: `Race B ${run}`, dates: [day(0, 0)] }]),
    ]);
    const out = res.map((x) => (x.status === "fulfilled" ? x.value.bookings[0].status : "REFUSED " + (x.reason as Error).message.slice(0, 60)));
    const confirmed = out.filter((o) => o === "Confirmed").length;
    expect(confirmed).toBe(1);
    return `simultaneous bookings for the single place: ${out.join(" | ")}`;
  });
});

test("BM-025 franchise listing", async ({ browser }) => {
  const mkFr = async (tag: string): Promise<Op> => {
    const inv = await apiPost<{ token: string }>("/api/invites", opB.tok, { role: "franchise" });
    const email = `e2e-bm-fr${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
    const s = await fbSignUp(email);
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    const tok = (await fbSignIn(email)).idToken;
    return { acc: { role: "franchise", email, uid: s.uid, tenantId: opB.acc.tenantId, tenantName: opB.acc.tenantName }, tok };
  };
  const f1 = await mkFr("1"), f2 = await mkFr("2");
  await apiFetch("/api/library", f1.tok, { method: "PUT", body: JSON.stringify({ venues: [{ id: "bm-venue", name: "BM Hall", address: "1 Test Way", city: "Northampton" }], settings: { marketplaceListed: true, payMethods: ["card", "cash", "bank"] } }) });
  const fl = await mkListing(f1, { title: `BM Franchise ${run}` });
  const p = await mkParent("b25"); await follow(p, fl.tenantId); const k = `Fran Kid ${run}`; await child(p, k);
  const c = await uiLogin(browser, p.email);
  await uiBook(c.page, fl, { children: [k] });
  await expect(c.page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
  await check("BM-025", c.page, async () => {
    const mine = await myBookings(p);
    console.log("B25", JSON.stringify({ fid: mine[0].franchiseId, tid: mine[0].tenantId }));
    const b1 = await apiFetch<any[]>("/api/bookings", f1.tok);
    const b2 = await apiFetch<any[]>("/api/bookings", f2.tok);
    const hq = await apiFetch<any[]>("/api/bookings", opB.tok);
    expect(b1.some((x) => x.child?.includes(k))).toBeTruthy();
    expect(b2.some((x) => x.child?.includes(k))).toBeFalsy();
    expect(mine[0].franchiseId).toBeTruthy();
    return `booking ${mine[0].ref} via franchise-1 listing: franchiseId ${mine[0].franchiseId}; visible to franchise 1 (${b1.length} row), NOT to sibling franchise 2 (${b2.length}); head office sees ${hq.filter((x) => x.child?.includes(k)).length}`;
  });
  await c.ctx.close();
});

test("BM-030 quick book panel", async ({ browser }) => {
  const p = await mkParent("b30"); await follow(p, std.tenantId); const k = `Quick Kid ${run}`; await child(p, k);
  const c = await uiLogin(browser, p.email);
  await c.page.goto("/custdash/browse");
  await c.page.getByPlaceholder("Search by name or venue…").fill(std.title);
  await c.page.waitForTimeout(1500);
  const qb = c.page.getByRole("button", { name: /quick book/i }).first();
  console.log("B30 BTNS", (await c.page.getByRole("button").allInnerTexts()).slice(0, 25).join(" / "));
  await check("BM-030", c.page, async () => {
    await expect(qb).toBeVisible({ timeout: 20_000 });
    await qb.click();
    await expect(c.page.getByText(/choose your pass|Choose your pass/i).first()).toBeVisible({ timeout: 20_000 });
    await c.page.getByRole("button", { name: /^1 day · £/ }).first().click().catch(() => {});
    const body = await c.page.locator("body").innerText();
    await dayBtns(c.page).first().click();
    await c.page.getByRole("button", { name: /Add .* to basket/ }).click();
    const tail = (await c.page.locator("body").innerText()).split("Your basket").pop() ?? "";
    expect(tail).toContain("£20.00");
    await shot(c.page, "BM-030");
    return "Quick book slides over the browse grid with the same pass list (5 days £90 / 3 days £54 / 1 day £20), timing, calendar; adding Mon 5 Oct gives basket total £20.00, same as full page";
  });
  await c.ctx.close();
});

test("BM-020 home-visit address required", async ({ browser }) => {
  const hv = await mkListing(opA, { title: `BM HomeVisit ${run}`, extra: { deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["NN"] } } });
  const email = `e2e-bm-par-b20-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent" });
  const p: Parent = { acc: { role: "parent", email, uid: s.uid, tenantId: null, tenantName: null }, email, tok: (await fbSignIn(email)).idToken };
  await markParentWelcomed(p.acc); await follow(p, hv.tenantId);
  const k = `Visit Kid ${run}`; await child(p, k);
  const c = await uiLogin(browser, p.email);
  await c.page.goto(`/book/${hv.id}`);
  await addDaysUi(c.page, "1 day", [0]);
  await c.page.getByRole("button", { name: /Add .* to basket/ }).click();
  await c.page.getByRole("button", { name: /Next — add children/ }).click();
  await c.page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await c.page.getByRole("button", { name: "Next", exact: true }).click();
  const ph = c.page.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
  await check("BM-020", c.page, async () => {
    const btn = c.page.locator("button.w-full").filter({ hasText: /postcode|address|Confirm/i }).last();
    const label = await btn.innerText();
    console.log("B20", label, await btn.isDisabled());
    let msg = ""; try { await bookApi(p, hv, [{ pass: "1 day", child: k, dates: [day(0, 0)] }]); } catch (e) { msg = (e as Error).message; }
    expect(await btn.isDisabled()).toBeTruthy();
    expect(msg).toMatch(/postcode|address/i);
    return `no postcode on account: Pay-step button '${label}' disabled; server refuses: ${msg.slice(0, 120)}`;
  });
  await c.ctx.close();
});
