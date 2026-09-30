import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { NAV_GROUPS } from "../lib/nav/config";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

// Franchise portal + head-office / sibling-franchise DATA ISOLATION.
//
// Provisions its OWN throwaway company (head office "HO") with two franchises
// (A and B) and one staff member of A, seeds one record of every kind under each,
// then proves — over the API and in the signed-in franchise-A browser — that A
// (and A's staff) can neither READ nor WRITE what belongs to HO or B.
//
// Every assertion is anchored to THIS run's markers (the stamp is in every name), so a
// stale row from an earlier run can't make it pass. Two accounts of the same
// tenant is exactly the case a tenant-only check gets wrong: everything below
// shares one tenantId.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const M = { ho: `ISOHO${stamp}`, fa: `ISOFA${stamp}`, fb: `ISOFB${stamp}` } as const;
type Who = keyof typeof M;
const todayUk = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()); // yyyy-mm-dd
const email = (n: string) => `e2e-iso-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;

const text = (v: unknown) => JSON.stringify(v ?? null);
const tokens: Record<string, string> = {};
const seeded: Record<Who, Record<string, string>> = { ho: {}, fa: {}, fb: {} };
let tenantId = "";
let ownUidStaff = "";

// The dev API restarts whenever a server file is saved (tsx watch), so a request can hit a dead socket: retry those.
const call = async (who: string | null, method: string, url: string, body?: unknown, token?: string) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${url}`, {
        method,
        headers: { "Content-Type": "application/json", ...(who || token ? { Authorization: `Bearer ${token ?? tokens[who!]}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: unknown = null;
      try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) {
      if (attempt >= 12) throw e;
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }
};

test.beforeAll(async () => {
  test.setTimeout(240_000);
  // Head office (a company) + two franchises + A's staff member.
  const ho = await fbSignUp(email("ho"));
  const reg = await call(null, "POST", "/api/register-role", {
    role: "company", businessName: `Iso Co ${stamp}`, providerName: `Iso Co ${stamp}`, providerNameMode: "business",
  }, ho.idToken);
  expect(reg.status, text(reg.json)).toBe(201);
  tenantId = (reg.json as { tenantId: string }).tenantId;
  tokens.ho = ho.idToken;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });

  const join = async (who: string, inviter: string, body: Record<string, unknown>) => {
    const inv = await call(inviter, "POST", "/api/invites", body);
    expect(inv.status, text(inv.json)).toBe(201);
    const s = await fbSignUp(email(who));
    const acc = await call(null, "POST", `/api/invites/${(inv.json as { token: string }).token}/accept`, {}, s.idToken);
    expect(acc.status, text(acc.json)).toBe(200);
    tokens[who] = s.idToken;
    return s;
  };
  await join("fa", "ho", { role: "franchise", franchiseName: `Iso Alpha ${stamp}` });
  await join("fb", "ho", { role: "franchise", franchiseName: `Iso Beta ${stamp}` });
  const staff = await join("sfa", "fa", { role: "staff", name: `Staff ${M.fa}`, staffRole: "Manager", assignment: { mode: "all", ids: [] } });
  ownUidStaff = staff.uid;

  // One of everything under each of HO / A / B.
  for (const w of ["ho", "fa", "fb"] as const) {
    const m = M[w];
    const ok = async (label: string, r: Promise<{ status: number; json: unknown }>) => {
      const x = await r;
      expect(x.status, `seed ${label} as ${w}: ${text(x.json)}`).toBeLessThan(300);
      return x.json as Record<string, string>;
    };
    seeded[w].listing = (await ok("listing", call(w, "POST", "/api/listings", { name: `${m} Listing`, description: "x" }))).id;
    seeded[w].block = (await ok("block", call(w, "POST", "/api/blocks", {
      listingId: seeded[w].listing, name: `${m} Block`, startDate: "2027-03-01", endDate: "2027-03-05", capacity: 12, schedule: { startTime: "09:00", endTime: "15:00" },
    }))).id;
    const b = await ok("booking", call(w, "POST", "/api/bookings", {
      booker: `${m} Parent`, email: `${m.toLowerCase()}-fam@${TEST_EMAIL_DOMAIN}`, child: `${m} Child`, age: 7,
      listing: `${m} Listing`, pass: "Full", blockId: seeded[w].block, amount: 40, method: "cash",
    }));
    seeded[w].booking = b.ref;
    seeded[w].customer = (await ok("customer", call(w, "POST", "/api/customers", { name: `${m} Family`, email: `${m.toLowerCase()}-cust@${TEST_EMAIL_DOMAIN}` }))).id;
    seeded[w].task = (await ok("task", call(w, "POST", "/api/tasks", { t: `${m} task`, prio: "med", due: todayUk }))).id;
    seeded[w].discount = (await ok("discount", call(w, "POST", "/api/discounts", { code: `${m}CODE`, type: "percent", value: 10 }))).id;
    seeded[w].post = (await ok("post", call(w, "POST", "/api/posts", { title: `${m} post`, body: `${m} post body`, status: "published" }))).id;
    seeded[w].cert = (await ok("cert", call(w, "POST", "/api/compliance", { staffName: `${m} Person`, type: "DBS", expiry: "2028-01-01" }))).id;
    seeded[w].folder = (await ok("folder", call(w, "POST", "/api/messages/folders", { name: `${m} folder` }))).id;
    seeded[w].moment = (await ok("moment", call(w, "POST", "/api/moments", { caption: `${m} moment`, photoType: "work" }))).id;
    seeded[w].mail = (await ok("mail", call(w, "POST", "/api/emails/send", { subject: `${m} campaign`, body: "x", audience: "one", to: `${m.toLowerCase()}-mail@${TEST_EMAIL_DOMAIN}` }))).id;
    seeded[w].expense = (await ok("expense", call(w, "POST", "/api/expenses", { date: "2027-03-01", category: "Supplies", amount: 5, supplier: `${m} supplier` }))).id;
  }
});

test.describe("API — franchise A cannot read or write head office's or franchise B's records", () => {
  test("lists show only A's own rows (and A's staff the same)", async () => {
    const lists = ["/api/bookings", "/api/customers", "/api/blocks", "/api/listings?mine=1", "/api/tasks", "/api/discounts", "/api/expenses",
      "/api/compliance", "/api/moments", "/api/emails", "/api/messages/folders", "/api/emails/recipients"];
    for (const who of ["fa", "sfa"]) {
      for (const url of lists) {
        const r = await call(who, "GET", url);
        if (r.status === 403) continue; // e.g. staff can't open Email / Discounts — closed is fine
        expect(r.status, `${who} ${url}`).toBe(200);
        const body = text(r.json);
        expect(body, `${who} ${url} leaked head office`).not.toContain(M.ho);
        expect(body, `${who} ${url} leaked franchise B`).not.toContain(M.fb);
      }
    }
    // positive control: A does see its own things
    expect(text((await call("fa", "GET", "/api/listings?mine=1")).json)).toContain(M.fa);
    expect(text((await call("fa", "GET", "/api/customers")).json)).toContain(M.fa);
  });

  test("head office's network posts DO reach A (by design) but B's own posts don't", async () => {
    const body = text((await call("fa", "GET", "/api/posts")).json);
    expect(body).toContain(`${M.ho} post`);
    expect(body).toContain(`${M.fa} post`);
    expect(body).not.toContain(`${M.fb} post`);
  });

  test("A cannot edit / delete / invite a family or post that belongs to HO or B", async () => {
    for (const victim of ["ho", "fb"] as const) {
      const s = seeded[victim];
      const blocked = async (label: string, r: Promise<{ status: number }>) => expect((await r).status, `${label} on ${victim}`).toBe(404);
      await blocked("PUT customer", call("fa", "PUT", `/api/customers/${s.customer}`, { name: "HACK" }));
      await blocked("invite customer", call("fa", "POST", `/api/customers/${s.customer}/invite`, {}));
      await blocked("DELETE customer", call("fa", "DELETE", `/api/customers/${s.customer}`));
      await blocked("PUT post", call("fa", "PUT", `/api/posts/${s.post}`, { title: "HACK" }));
      await blocked("DELETE post", call("fa", "DELETE", `/api/posts/${s.post}`));
      await blocked("PUT cert", call("fa", "PUT", `/api/compliance/${s.cert}`, { notes: "HACK" }));
      await blocked("DELETE cert", call("fa", "DELETE", `/api/compliance/${s.cert}`));
      await blocked("PUT moment", call("fa", "PUT", `/api/moments/${s.moment}`, { caption: "HACK" }));
      await blocked("DELETE moment", call("fa", "DELETE", `/api/moments/${s.moment}`));
      await blocked("PUT folder", call("fa", "PUT", `/api/messages/folders/${s.folder}`, { name: "HACK" }));
      await blocked("DELETE folder", call("fa", "DELETE", `/api/messages/folders/${s.folder}`));
      await blocked("PUT task", call("fa", "PUT", `/api/tasks/${s.task}`, { t: "HACK" }));
      await blocked("DELETE block", call("fa", "DELETE", `/api/blocks/${s.block}`));
      await blocked("PUT listing", call("fa", "PUT", `/api/listings/${s.listing}`, { name: "HACK" }));
      await blocked("GET draft listing", call("fa", "GET", `/api/listings/${s.listing}`));
      await blocked("PUT ratio groups", call("fa", "PUT", `/api/ratios/${s.block}/2027-03-01`, { groups: [{ id: "a", name: "A", childIds: [], staffIds: [] }] }));
    }
    // ...and the same actions on A's OWN records work (so the guards aren't just closing everything).
    expect((await call("fa", "PUT", `/api/customers/${seeded.fa.customer}`, { phone: "0123" })).status).toBe(200);
    expect((await call("fa", "PUT", `/api/posts/${seeded.fa.post}`, { title: `${M.fa} post edited` })).status).toBe(200);
    expect((await call("fa", "PUT", `/api/compliance/${seeded.fa.cert}`, { notes: "ok" })).status).toBe(200);
  });

  test("a franchise can't re-aim its post at the whole network, and a family it adds stays its own", async () => {
    await call("fa", "PUT", `/api/posts/${seeded.fa.post}`, { franchiseId: null });
    const mine = ((await call("fa", "GET", "/api/posts")).json as { id: string; franchiseId?: string | null }[]).find((p) => p.id === seeded.fa.post);
    expect(mine?.franchiseId, "post keeps A's franchise scope").toBeTruthy();
    const fam = await call("fa", "POST", "/api/customers", { name: `${M.fa} NewFam`, email: `${M.fa.toLowerCase()}-new@${TEST_EMAIL_DOMAIN}` });
    expect(fam.status).toBe(201);
    expect(text((await call("fa", "GET", "/api/customers")).json)).toContain(`${M.fa} NewFam`);
    expect(text((await call("fb", "GET", "/api/customers")).json)).not.toContain(`${M.fa} NewFam`);
    expect(text((await call("ho", "GET", "/api/customers?franchiseId=__ho__")).json)).not.toContain(`${M.fa} NewFam`);
  });

  test("email history, scheduled queue and inbox are per franchise", async () => {
    const hist = text((await call("fa", "GET", "/api/emails")).json);
    expect(hist).toContain(`${M.fa} campaign`);
    expect(hist).not.toContain(`${M.ho} campaign`);
    expect(hist).not.toContain(`${M.fb} campaign`);
    const at = "2027-06-01T10:00";
    const sched = await call("ho", "POST", "/api/emails/schedule", { subject: `${M.ho} later`, body: "x", audience: "one", to: `${M.ho.toLowerCase()}-later@${TEST_EMAIL_DOMAIN}`, sendAt: at });
    expect(sched.status).toBe(201);
    const id = (sched.json as { id: string }).id;
    expect(text((await call("fa", "GET", "/api/emails/scheduled")).json)).not.toContain(`${M.ho} later`);
    expect((await call("fa", "DELETE", `/api/emails/scheduled/${id}`)).status).toBe(404);
    expect((await call("ho", "DELETE", `/api/emails/scheduled/${id}`)).status).toBe(200);
    expect(text((await call("ho", "GET", "/api/emails")).json)).toContain(`${M.fb} campaign`); // head office still sees the network
  });

  test("each franchise keeps its own Ratios day board", async () => {
    const d = "2027-03-02";
    expect((await call("ho", "PUT", `/api/ratios/board/${d}`, { overrides: { HOK: "g1" }, groupStaff: { g1: ["hoStaff"] } })).status).toBe(200);
    expect((await call("fa", "PUT", `/api/ratios/board/${d}`, { overrides: { FAK: "g1" }, groupStaff: { g1: ["faStaff"] } })).status).toBe(200);
    expect(text((await call("ho", "GET", `/api/ratios/board/${d}`)).json)).toContain("HOK");
    const fa = text((await call("fa", "GET", `/api/ratios/board/${d}`)).json);
    expect(fa).toContain("FAK");
    expect(fa).not.toContain("HOK");
    expect(text((await call("fb", "GET", `/api/ratios/board/${d}`)).json)).not.toContain("FAK");
  });

  test("head-office-only endpoints are closed to a franchise and its staff", async () => {
    for (const who of ["fa", "sfa"]) {
      for (const [m, u, b] of [
        ["GET", "/api/ho/overview"], ["GET", "/api/franchises/features"], ["GET", "/api/splitfees"],
        ["PUT", "/api/franchises/x/territory", { status: "agreed" }], ["PUT", "/api/franchises/__all__/features", { view: "meals", on: false }],
        ["POST", "/api/invites", { role: "franchise" }],
      ] as [string, string, unknown?][]) {
        expect((await call(who, m, u, b)).status, `${who} ${m} ${u}`).toBe(403);
      }
    }
  });

  test("franchise staff scope = their franchise (documents library team listing)", async () => {
    const lib = text((await call("sfa", "GET", "/api/documents/library")).json);
    expect(lib).not.toContain(M.ho);
    expect(lib).not.toContain(M.fb);
    expect(ownUidStaff).toBeTruthy();
  });
});

// ── The signed-in franchise A browser ─────────────────────────────────────────
async function uiLogin(page: Page, who: string) {
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email(who));
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/franchise/**", { timeout: 45_000 });
}

test.describe("UI — franchise A's portal renders every view and never shows HO's or B's data", () => {
  test("every franchise nav view loads for A with no HO / B data on screen", async ({ page }) => {
    test.setTimeout(900_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await uiLogin(page, "fa");

    const views = NAV_GROUPS.franchise.flatMap((g) => g.items).filter((i) => i.view !== "auth" && !i.hidden).map((i) => i.view);
    // Views that list A's own rows must show A's marker (proves the page really loaded its data).
    const showsOwn: Record<string, string> = { bookings: M.fa, customers: M.fa, listings: M.fa, tasks: M.fa };
    const problems: string[] = [];
    for (const view of new Set([...views, "bookings", "blocks", "getpaid"])) {
      errors.length = 0;
      await page.goto(`${WEB_URL}/franchise/${view}`);
      if (await page.getByText("This page could not be found").isVisible().catch(() => false)) { problems.push(`/franchise/${view}: 404`); continue; }
      try {
        await expect(page.locator("main")).not.toHaveText(/^\s*(Loading…?|Checking access…?)?\s*$/, { timeout: 30_000 });
      } catch { problems.push(`/franchise/${view}: stuck loading`); continue; }
      if (showsOwn[view]) {
        // visible=true: the first DOM match on Bookings is a hidden <option> in the listing filter
        await expect(page.getByText(showsOwn[view]).locator("visible=true").first(), `/franchise/${view} shows A's own data`).toBeVisible({ timeout: 60_000 }).catch(() => problems.push(`/franchise/${view}: own data (${showsOwn[view]}) never appeared`));
      }
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      for (const foreign of [M.ho, M.fb]) if (body.includes(foreign)) problems.push(`/franchise/${view}: shows ${foreign}`);
      if (errors.length) problems.push(`/franchise/${view}: uncaught ${errors.join(" | ").slice(0, 160)}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

test.describe("UI — franchise A is never offered head-office-only actions", () => {
  test("Team has no plan tile / Manage plan link, and Get paid says head office owns the payout account", async ({ page }) => {
    test.setTimeout(240_000);
    await uiLogin(page, "fa");
    await page.goto(`${WEB_URL}/franchise/staff`);
    await expect(page.getByText("Team members").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Manage plan")).toHaveCount(0);
    await expect(page.getByText("On your plan")).toHaveCount(0);
    await page.goto(`${WEB_URL}/franchise/getpaid`);
    await expect(page.getByText("Your head office manages the payout account").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Connect Stripe/ })).toHaveCount(0);
    await page.goto(`${WEB_URL}/franchise/royalties`);
    await expect(page.getByText("Royalty owed", { exact: false }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Set up Get paid")).toHaveCount(0);
  });
});

test.describe("UI — joining as a franchise through head office's invite link", () => {
  test("the invite page shows the locked name/area, sign-up lands in the franchise portal, head office sees the new franchise", async ({ page }) => {
    test.setTimeout(240_000);
    const gName = `Iso Gamma ${stamp}`;
    const inv = await call("ho", "POST", "/api/invites", { role: "franchise", franchiseName: gName, franchiseArea: "Testville" });
    expect(inv.status, text(inv.json)).toBe(201);
    const token = (inv.json as { token: string }).token;
    await page.goto(`${WEB_URL}/signup?invite=${token}`);
    await expect(page.getByRole("heading", { name: `Join Iso Co ${stamp}` }).or(page.getByText(`Join Iso Co ${stamp}`).first())).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(gName).first()).toBeVisible();
    await expect(page.getByText("Set by head office")).toBeVisible();
    await page.locator("#iv-name").fill("Gamma Owner");
    await page.locator("#iv-email").fill(email("fg"));
    await page.locator("#iv-pw").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /^Join / }).click();
    await page.waitForURL("**/franchise/**", { timeout: 60_000 });
    // head office now lists the franchise under the name it granted
    const list = await call("ho", "GET", "/api/franchises");
    expect(text(list.json)).toContain(gName);
    // the new franchise starts with NOTHING of head office's or a sibling's
    const s = await fbSignIn(email("fg"));
    tokens.fg = s.idToken;
    for (const url of ["/api/bookings", "/api/customers", "/api/listings?mine=1", "/api/tasks", "/api/posts", "/api/discounts"]) {
      const body = text((await call("fg", "GET", url)).json);
      expect(body, `new franchise ${url}`).not.toContain(M.fa);
      expect(body, `new franchise ${url}`).not.toContain(M.fb);
      if (url !== "/api/posts") expect(body, `new franchise ${url}`).not.toContain(M.ho);
    }
  });
});

// The tenant + accounts are @activityos-test.com, swept by `npm run e2e:cleanup`.
