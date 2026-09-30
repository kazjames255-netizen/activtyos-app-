import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { test, expect, type BrowserContext } from "@playwright/test";
import { API_URL, ROOT, loadAccounts } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";
import { startHmrcStub, startTfcHarness, type HmrcStub, type TfcHarness } from "./helpers/hmrcStub";

// ─────────────────────────────────────────────────────────────────────────────
// Tax-Free Childcare, end to end, against a LOCAL stub of HMRC. No credentials
// and no real HMRC / GOV.UK host is ever contacted (see helpers/hmrcStub.ts).
//
//   Part 1 (route + client layer): the REAL routes (server/src/routes/tfc.ts) and
//     HMRC client (server/src/lib/tfc.ts) in a separate throwaway node process,
//     pointed at the stub. Link over a real OAuth redirect, balance, pay, every
//     failure state, expiry, and double-click idempotency (ONE HMRC payment).
//   Part 2 (checkout screen): the real parent checkout (features/listings/
//     checkout.tsx + TfcConnect.tsx) in a SECOND Next dev server built with
//     NEXT_PUBLIC_HMRC_TFC=1 (the dev web on :3000 has the flag off and is left
//     alone). The browser's /api/my/tfc/* calls are proxied to the harness, so
//     the screen runs the same routes against the stub.
//
// Why two parts: checkout.tsx never calls pay() today (recorded defect: the
// confirm button books with the HMRC scheme name and the parent pays in HMRC
// later), so "pay" is proven at the route/client layer, where it exists.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const uid = `tfcstub-${run}-uid`; // part 1 parent: a synthetic uid, no Firebase account involved
const tenantId = `tfcstub-${run}-tenant`;
let stub: HmrcStub;
let api: TfcHarness;
const childIds: string[] = [];
let seq = 0;
const nextRef = () => `STUB${String(10000 + ++seq * 7 + (parseInt(run.slice(-3), 36) % 1000)).slice(-5)}TFC`;

/** A throwaway linked child + reference, owned by the synthetic parent. */
async function linkedChild(tag: string) {
  const id = `tfcstub-${run}-${tag}`;
  const reference = nextRef();
  await api.seedChild({ id, uid, name: `Stub ${tag}`, dob: "2018-05-14", tfcReference: reference });
  await api.seedLink({ childId: id, uid, name: `Stub ${tag}`, reference });
  childIds.push(id);
  return { id, reference };
}
const pay = (reference: string, key: string, amount = 12.5, extra: Record<string, unknown> = { tenantId }) =>
  api.post("/api/my/tfc/pay", api.as(uid), { reference, amount, idempotencyKey: key, ...extra });

test.describe("Part 1: real routes against the HMRC stub", () => {
  test.beforeAll(async () => {
    stub = await startHmrcStub();
    api = await startTfcHarness(stub.url);
    await api.seedTenant(tenantId);
  });
  test.afterAll(async () => {
    await api?.cleanup({ uid, childIds, tenantIds: [tenantId] }).catch((e) => console.error("cleanup", e));
    await api?.stop();
    await stub?.close();
  });
  test.beforeEach(() => stub.reset());

  test("link over a real OAuth redirect, then the live balance", async () => {
    const id = `tfcstub-${run}-oauth`;
    const reference = nextRef();
    await api.seedChild({ id, uid, name: "Stub Oauth", dob: "2018-05-14" });
    childIds.push(id);

    const start = await api.post("/api/my/tfc/link/start", api.as(uid), { childName: "Stub Oauth", reference });
    expect(start.body.configured).toBe(true);
    // The hand-off URL points at the STUB's authorize endpoint, never a GOV.UK host.
    expect(start.body.url).toMatch(new RegExp(`^${stub.url}/oauth/authorize\\?`));
    expect((await api.get(`/api/my/tfc/link/status?state=${start.body.state}`, api.as(uid))).body).toEqual({ done: false });

    // "Sign in at GOV.UK": the stub redirects the browser to our callback with a code.
    const hop = await fetch(start.body.url, { redirect: "manual" });
    expect(hop.status).toBe(302);
    const cb = await api.get(new URL(hop.headers.get("location")!).pathname + new URL(hop.headers.get("location")!).search);
    expect(cb.status).toBe(200);
    expect(cb.body).toContain("Account linked");

    // The status the checkout polls now reads linked, with the name HMRC holds.
    const status = await api.get(`/api/my/tfc/link/status?state=${start.body.state}`, api.as(uid));
    expect(status.body).toMatchObject({ done: true, linked: true, reference, childFullName: "Stub Childname" });
    // A state is single use: a second read 404s and a replayed callback is refused.
    expect((await api.get(`/api/my/tfc/link/status?state=${start.body.state}`, api.as(uid))).status).toBe(404);
    expect((await api.get(new URL(hop.headers.get("location")!).pathname + new URL(hop.headers.get("location")!).search)).status).toBe(400);
    // Another parent cannot read this state or this link.
    expect(await api.link(id)).toMatchObject({ linked: true, reference, hasTokens: true });

    // What reached the stub: the code exchange, then the link call with the reference + DOB.
    const link = stub.calls.find((c) => c.path.endsWith("/payments/link"))!;
    expect(link.body).toMatchObject({ outbound_child_payment_ref: reference, child_date_of_birth: "2018-05-14" });
    expect(link.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(stub.calls.some((c) => c.path === "/oauth/token" && c.body?.grant_type === "authorization_code")).toBe(true);

    // Balance: HMRC's cleared funds, converted pence -> pounds.
    stub.setBalance({ clearedFundsPence: 18_750, totalBalancePence: 20_000 });
    const bal = await api.post("/api/my/tfc/balance", api.as(uid), { reference });
    expect(bal.body).toMatchObject({ ok: true, amount: 187.5, totalBalance: 200, status: "ACTIVE" });
    // A reference that is not this parent's gets the same answer as "no link".
    const other = await api.post("/api/my/tfc/balance", api.as("someone-else"), { reference });
    expect(other.body).toEqual({ ok: false, failure: "not-connected" });
  });

  test("pay succeeds once, and a double-click sends ONE payment to HMRC", async () => {
    const { id, reference } = await linkedChild("dbl");
    // Slow HMRC so the two requests genuinely overlap (a real double-click).
    stub.set("pay", { delayMs: 700 });
    const [a, b] = await Promise.all([pay(reference, "dblclick-key-1"), pay(reference, "dblclick-key-1")]);
    const oks = [a, b].filter((r) => r.status === 200 && r.body.ok === true);
    expect(oks).toHaveLength(1);
    // The loser is refused while the first is in flight (409) or replays its outcome: never a second send.
    const loser = [a, b].find((r) => r !== oks[0])!;
    expect([200, 409]).toContain(loser.status);
    expect(stub.payments()).toHaveLength(1);

    // Retrying the SAME key later replays the first outcome and still does not re-send.
    const replay = await pay(reference, "dblclick-key-1");
    expect(replay.body).toMatchObject({ ok: true, paymentReference: oks[0].body.paymentReference });
    expect(stub.payments()).toHaveLength(1);

    // What went to HMRC: whole pence, payee CCP, and the PROVIDER's identity from the tenant's Setup, not from the request.
    const sent = stub.payments()[0];
    expect(sent.body).toMatchObject({ payment_amount: 1250, payee_type: "CCP", ccp_reg_reference: "EY123456", ccp_postcode: "AB1 2CD", outbound_child_payment_ref: reference });
    expect(sent.bearer).toMatch(/^stub-(seed|access)-/);
    expect((await api.payRecords(id)).map((r) => ({ s: r.status, a: r.amount }))).toEqual([{ s: "ok", a: 12.5 }]);

    // A genuinely new payment (new key) is a second payment: idempotency is per intent, not per child.
    const second = await pay(reference, "dblclick-key-2", 3);
    expect(second.body.ok).toBe(true);
    expect(stub.payments()).toHaveLength(2);
  });

  test("insufficient funds and provider-not-added come back as their designed failures", async () => {
    const { reference } = await linkedChild("fail");
    stub.set("pay", { status: 400, body: { errorCode: "E0033", errorDescription: "insufficient funds" } });
    const low = await pay(reference, "insuf-key-0001");
    expect(low.body).toEqual({ ok: false, failure: "insufficient-funds" });
    // The same key replays the recorded refusal instead of asking HMRC again.
    expect((await pay(reference, "insuf-key-0001")).body).toEqual({ ok: false, failure: "insufficient-funds" });
    expect(stub.payments()).toHaveLength(1);

    stub.set("pay", { status: 400, body: { errorCode: "E0027" } });
    expect((await pay(reference, "notadded-key-01")).body).toEqual({ ok: false, failure: "provider-not-added" });

    stub.set("pay", { status: 400, body: { errorCode: "E0030" } });
    expect((await pay(reference, "inactive-key-01")).body).toEqual({ ok: false, failure: "not-connected" });
  });

  test("HMRC unavailable (5xx / dropped connection) is flagged uncertain and never blindly re-sent", async () => {
    const { id, reference } = await linkedChild("down");
    stub.set("pay", { status: 503, body: { code: "SERVER_ERROR" } });
    const r = await pay(reference, "down-key-000001");
    expect(r.body).toEqual({ ok: false, failure: "connection-failed", uncertain: true });
    // The parent may retry with the same key, but that must NOT reach HMRC again: the first attempt may have been paid.
    stub.set("pay", "ok");
    const again = await pay(reference, "down-key-000001");
    expect(again.body.ok).toBe(false);
    expect(again.body.uncertain).toBe(true);
    expect(stub.payments()).toHaveLength(1);
    expect((await api.payRecords(id))[0].status).toBe("uncertain");

    // A socket dropped after the request arrived is the same: uncertain, and the link survives.
    stub.set("pay", { drop: true });
    const dropped = await pay(reference, "drop-key-000001");
    expect(dropped.body).toMatchObject({ ok: false, failure: "connection-failed", uncertain: true });
    expect(await api.link(id)).toMatchObject({ linked: true });

    // The 5xx on a balance read is just "no balance line", with no false number.
    stub.set("balance", { status: 502 });
    expect((await api.post("/api/my/tfc/balance", api.as(uid), { reference })).body).toMatchObject({ ok: false, failure: "connection-failed" });
  });

  test("expired authorisation: refresh refused -> connection-expired, link marked dead, no further payment attempts", async () => {
    const { id, reference } = await linkedChild("exp");
    stub.set("pay", { status: 401, body: { code: "INVALID_CREDENTIALS" } });
    stub.set("token", { status: 400, body: { error: "invalid_grant" } });
    const r = await pay(reference, "exp-key-0000001");
    expect(r.body).toEqual({ ok: false, failure: "connection-expired" });
    expect(stub.calls.some((c) => c.path === "/oauth/token" && c.body?.grant_type === "refresh_token")).toBe(true);
    expect(await api.link(id)).toMatchObject({ linked: false, failure: "connection-expired" });

    // With the link dead, a NEW payment never even reaches HMRC: straight to the re-authorise screen.
    stub.reset();
    const after = await pay(reference, "exp-key-0000002");
    expect(after.body).toEqual({ ok: false, failure: "connection-expired" });
    expect(stub.payments()).toHaveLength(0);
  });

  test("not linked / unknown reference / provider without registration -> not-connected, HMRC never called", async () => {
    const { reference } = await linkedChild("nl");
    expect((await pay("NOPE12345TFC", "nolink-key-0001")).body).toEqual({ ok: false, failure: "not-connected" });
    // Provider whose Setup has no childcare registration: we cannot name ourselves to HMRC.
    const noReg = await pay(reference, "noreg-key-0001", 5, { tenantId: `tfcstub-${run}-no-such-tenant` });
    expect(noReg.body).toEqual({ ok: false, failure: "not-connected" });
    // Not a parent account.
    expect((await api.post("/api/my/tfc/pay", { ...api.as(uid), "x-stub-role": "company" }, { reference, amount: 5 })).status).toBe(403);
    expect(stub.calls).toHaveLength(0);
  });

  test("link failures from HMRC (provider not added, 5xx, refused sign-in) are designed failures", async () => {
    const id = `tfcstub-${run}-lf`;
    const reference = nextRef();
    await api.seedChild({ id, uid, name: "Stub Lf", dob: "2018-05-14", tfcReference: reference });
    childIds.push(id);
    const start = () => api.post("/api/my/tfc/link/start", api.as(uid), { childName: "Stub Lf", reference });
    const signIn = async (s: { body: { url: string; state: string } }) => {
      const hop = await fetch(s.body.url, { redirect: "manual" });
      const loc = new URL(hop.headers.get("location")!);
      await api.get(loc.pathname + loc.search);
      return (await api.get(`/api/my/tfc/link/status?state=${s.body.state}`, api.as(uid))).body;
    };
    // Parent refuses consent at GOV.UK.
    stub.set("authorize", { status: 400 });
    expect(await signIn(await start())).toMatchObject({ done: true, linked: false, failure: "connection-failed" });
    // Signed in, but HMRC says this provider is not on their account.
    stub.reset();
    stub.set("link", { status: 400, body: { errorCode: "E0027" } });
    expect(await signIn(await start())).toMatchObject({ done: true, linked: false, failure: "provider-not-added" });
    // Tokens are kept, so a retry skips GOV.UK and answers straight away. HMRC down -> connection-failed.
    stub.set("link", { status: 503 });
    const down = await start();
    expect(down.body).toMatchObject({ configured: true, linked: false, failure: "connection-failed" });
    expect(down.body.url).toBeUndefined();
    // HMRC recovers: the same retry now links without a second sign-in.
    stub.set("link", "ok");
    expect((await start()).body).toMatchObject({ configured: true, linked: true, reference, childFullName: "Stub Childname" });
  });
});

// ─── Part 2: the real checkout screen ───────────────────────────────────────

const freePort = () => new Promise<number>((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); });
  s.on("error", reject);
});

test.describe("Part 2: the parent checkout screen with the HMRC link switched on", () => {
  let web: ChildProcess | null = null;
  let webUrl = "";
  let ownStub: HmrcStub;
  let ownApi: TfcHarness;
  let listing: ProvisionedListing | null = null;
  let ctx: BrowserContext | null = null;
  const parent = () => loadAccounts().accounts.parent;
  const company = () => loadAccounts().accounts.company;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ownStub = await startHmrcStub();
    ownApi = await startTfcHarness(ownStub.url);
    // A SECOND web dev server (own build dir .next-test, flag on). The dev web on :3000 is never touched. It needs the isolated-stack
    // build dir, so refuse to start if that stack (:3001) is running rather than fight it over .next-test/dev/lock.
    if (await fetch("http://localhost:3001/", { signal: AbortSignal.timeout(2_000) }).then(() => true, () => false)) {
      throw new Error("the isolated stack (web :3001) is running and owns .next-test; stop `npm run dev:test` or run this spec later");
    }
    const port = await freePort();
    webUrl = `http://localhost:${port}`;
    web = spawn(path.join(ROOT, "node_modules/.bin/next"), ["dev", "-p", String(port)], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, NEXT_DIST_DIR: ".next-test", NEXT_PUBLIC_HMRC_TFC: "1", NEXT_PUBLIC_API_URL: API_URL },
    });
    const deadline = Date.now() + 200_000;
    for (;;) {
      if (await fetch(`${webUrl}/login`, { signal: AbortSignal.timeout(60_000) }).then((r) => r.ok, () => false)) break;
      if (Date.now() > deadline) throw new Error("the flag-on web dev server did not come up");
      await new Promise((r) => setTimeout(r, 2_000));
    }
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await ctx?.close().catch(() => {});
    // Throwaway data: the child(ren) the checkout saved + their HMRC link rows, then the listing and its block bundle.
    try {
      const p = await fbSignIn(parent().email);
      const kids = await apiFetch<{ id: string; name: string }[]>("/api/my/children", p.idToken);
      const mine = kids.filter((k) => k.name.startsWith(`E2E Tfc ${run}`)).map((k) => k.id);
      const out = await ownApi.cleanup({ uid: parent().uid, childIds: mine });
      console.log("tfc-stub cleanup (children/links/payments):", JSON.stringify(out));
    } catch (e) { console.error("child cleanup failed", e); }
    try {
      if (listing) {
        const op = await fbSignIn(company().email);
        await apiFetch(`/api/listings/${listing.id}`, op.idToken, { method: "DELETE" });
        const bundles = await apiFetch<{ id: string; name: string }[]>("/api/block-bundles", op.idToken);
        for (const b of bundles.filter((x) => x.name === `E2E Block ${listing!.title}`)) await apiFetch(`/api/block-bundles/${b.id}`, op.idToken, { method: "DELETE" });
      }
    } catch (e) { console.error("listing cleanup failed", e); }
    if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch { /* already gone */ } }
    await ownApi?.stop();
    await ownStub?.close();
  });

  test("link -> balance -> short-by, and every failure shows the manual reference fallback", async ({ browser }) => {
    test.setTimeout(600_000);
    const title = `E2E Tfc Camp ${run}`;
    const childName = `E2E Tfc ${run}`;
    const reference = "TFCS" + String(10000 + (parseInt(run.slice(-3), 36) % 80000)) + "TFC";
    listing = await provisionLiveListing(company(), { title, price: 40 });
    await markParentWelcomed(parent());
    await createParentChild(parent(), { name: childName, dob: "2018-05-14" });
    const ps = await fbSignIn(parent().email);
    await apiFetch("/api/my/providers/follow", ps.idToken, { method: "POST", body: JSON.stringify({ tenantId: listing.tenantId }) });

    ctx = await browser.newContext();
    // The checkout's HMRC calls go to the harness (the real routes, wired to the stub), as the signed-in parent.
    const tfcHits: string[] = [];
    await ctx.route("**/api/my/tfc/**", async (route) => {
      const req = route.request();
      const cors = { "access-control-allow-origin": webUrl, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const u = new URL(req.url());
      tfcHits.push(`${req.method()} ${u.pathname}`);
      const r = await fetch(ownApi.url + u.pathname + u.search, {
        method: req.method(),
        headers: { "content-type": "application/json", "x-stub-uid": parent().uid },
        body: req.method() === "GET" ? undefined : (req.postData() ?? "{}"),
      });
      await route.fulfill({ status: r.status, headers: { ...cors, "content-type": "application/json" }, body: await r.text() });
    });
    const page = await ctx.newPage();
    // Sign in on the second web origin (Firebase sessions are per origin).
    await page.goto(`${webUrl}/login`, { timeout: 120_000 });
    await page.getByPlaceholder("you@example.com").fill(parent().email);
    await page.locator('input[type="password"]').fill("E2etest!123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/custdash/browse", { timeout: 120_000 });

    // Browse -> this run's listing -> pass, date, basket, add a child (saved on the parent's account).
    await page.getByPlaceholder("Search by name or venue…").fill(title);
    await page.getByRole("button", { name: /^More details/ }).first().click();
    await page.waitForURL(`**/book/${listing.id}`, { timeout: 120_000 });
    await page.getByRole("button", { name: /Day pass · £/ }).first().click();
    if (await page.getByText(/choose a timing/i).isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
    await page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
    await page.getByRole("button", { name: /Next — add children/ }).click();
    // A child added through the checkout's own form is only saved when the booking is placed, and HMRC linking needs a saved child
    // (link/start 404s otherwise -> "connection failed"). So this run's child already exists on the account (with a DOB) and is picked here.
    await page.getByRole("button", { name: `+ ${childName}`, exact: true }).click();
    const boy = page.getByRole("button", { name: "Boy", exact: true });
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    for (let guard = 0; !(await nextBtn.isVisible().catch(() => false)); guard++) {
      if (guard > 20) throw new Error("Children step never reached 'Next'");
      for (const box of await page.getByRole("textbox").all()) if (await box.isVisible().catch(() => false) && !(await box.inputValue().catch(() => "x"))) await box.fill("N/A").catch(() => {});
      for (const sel of await page.locator("select:visible").all()) {
        if (!(await sel.inputValue().catch(() => "x"))) { const v = await sel.locator("option").nth(1).getAttribute("value").catch(() => null); if (v) await sel.selectOption(v).catch(() => {}); }
      }
      for (const yes of await page.getByRole("button", { name: "Yes", exact: true }).all()) if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
      if (await boy.isVisible().catch(() => false)) await boy.click().catch(() => {});
      const add = page.getByRole("button", { name: "Add child", exact: true });
      if (await add.isVisible().catch(() => false)) await add.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await nextBtn.click();

    // Payment step: choose Tax-Free Childcare.
    const phone = page.getByPlaceholder("e.g. 07700 900123");
    if (await phone.isVisible().catch(() => false)) await phone.fill("07700900123");
    await page.locator("select").filter({ has: page.locator("option", { hasText: "Tax-Free Childcare" }) }).first().selectOption({ label: "Tax-Free Childcare" });
    const refInput = page.getByLabel(`Payment reference for ${childName}`);
    await expect(refInput).toBeVisible({ timeout: 20_000 });
    await refInput.fill(reference);
    const confirm = page.getByRole("button", { name: /^Confirm/ });

    const dialog = page.locator(".fixed").filter({ hasText: "GOV.UK — HMRC" });
    const openHandOff = async () => {
      // The previous GOV.UK window closes itself ~1.2s after its callback page loads. window.open() reuses a same-named window, so
      // starting the next hand-off in that gap hands linkAccount() a window that is about to die (a human cannot click that fast).
      await expect.poll(() => ctx!.pages().length, { timeout: 15_000 }).toBe(1);
      await page.getByRole("button", { name: "Login with HMRC" }).click();
      await expect(dialog.getByText("Allow your software to connect with HMRC")).toBeVisible();
      await dialog.getByRole("button", { name: "Continue to sign in" }).click();
    };
    /** Every failure must land on its designed screen AND leave the manual path usable: typed reference kept, booking still confirmable. */
    const expectFallback = async (title: string, detail: RegExp) => {
      await expect(dialog.getByText(title, { exact: true })).toBeVisible({ timeout: 45_000 });
      await expect(dialog.getByText(detail)).toBeVisible();
      await dialog.getByRole("button", { name: "Pay from HMRC instead" }).click();
      await expect(dialog).toBeHidden();
      await expect(refInput).toHaveValue(reference);
      await expect(page.getByRole("button", { name: "Login with HMRC" })).toBeVisible();  // still unlinked
      await expect(confirm).toBeEnabled();                                                 // manual reference is enough to book
    };

    // 1. The parent declines at GOV.UK -> "HMRC connection failed".
    ownStub.set("authorize", { status: 400 });
    await openHandOff();
    await expectFallback("HMRC connection failed", /Login with HMRC/);
    // 2. Signed in, but this provider is not on their HMRC account.
    ownStub.reset();
    ownStub.set("link", { status: 400, body: { errorCode: "E0027" } });
    await openHandOff();
    await expectFallback("HMRC payment failed", /not added to your HMRC account/);
    // 3. HMRC unavailable (5xx).
    ownStub.set("link", { status: 503 });
    await openHandOff();
    await expectFallback("HMRC connection failed", /Login with HMRC/);
    // 4. Authorisation expired: HMRC rejects the token and the refresh is refused.
    ownStub.reset();
    ownStub.set("link", { status: 401, body: { code: "INVALID_CREDENTIALS" } });
    ownStub.set("token", { status: 400, body: { error: "invalid_grant" } });
    await openHandOff();
    await expectFallback("HMRC connection expired", /sign in again to reconnect/);

    // 5. Everything healthy: link succeeds and the real balance appears, unlabelled as an example.
    ownStub.reset();
    ownStub.setBalance({ clearedFundsPence: 2_500, totalBalancePence: 3_000 });
    await openHandOff();
    await expect(dialog.getByText("✓ Account linked")).toBeVisible({ timeout: 45_000 });
    await dialog.getByRole("button", { name: "Back to your booking" }).click();
    await expect(page.getByText("✓ linked").first()).toBeVisible();
    const amount = page.getByLabel("Amount from Tax-Free Childcare");
    await amount.fill("10");
    await expect(page.getByText(/Balance\s*£25\.00/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/example figure/)).toHaveCount(0);
    // More than the account holds: short by the difference, with the one-tap split.
    // The wallet credit this standing parent holds is applied first, so the amount due is £30 of the £40 pass.
    await amount.fill("30");
    await expect(page.getByText(/£5\.00 short/)).toBeVisible();
    await page.getByRole("button", { name: "Split it" }).click();
    await expect(amount).toHaveValue("25.00");

    // The checkout really talked to the routes (not the simulated path), and the stub saw the link success + balance reads.
    expect(tfcHits.filter((h) => h === "POST /api/my/tfc/link/start").length).toBeGreaterThanOrEqual(5);
    expect(tfcHits).toContain("POST /api/my/tfc/balance");
    // (>=1, not ==1: the balance effect in checkout.tsx re-runs when tfcBalances lands and reads HMRC a second time.)
    expect(ownStub.calls.filter((c) => c.path.endsWith("/payments/balance")).length).toBeGreaterThanOrEqual(1);
    // The saved child now carries the reference, so the next booking starts linked.
    const kid = (await apiFetch<{ id: string; name: string; tfcReference?: string }[]>("/api/my/children", ps.idToken)).find((k) => k.name === childName);
    await expect.poll(async () => (await apiFetch<{ name: string; tfcReference?: string }[]>("/api/my/children", (await fbSignIn(parent().email)).idToken)).find((k) => k.name === childName)?.tfcReference, { timeout: 15_000 }).toBe(reference);
    expect(kid).toBeTruthy();
    // No real booking was made and no payment was sent from this screen (it never calls pay()).
    expect(ownStub.payments()).toHaveLength(0);
  });
});
