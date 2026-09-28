import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — a STARTED in-person lesson can be renamed / its notes fixed (PUT /in-person/sessions/:id {title?, notes?}, nothing else),
// and the tutor's Home "Next lesson" card leads with an in-person session that is still open ("Resume in-person session").
// Every assertion is anchored to THIS run's stamped title / child / session id.

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const subject = `IpEdit Lab ${stamp}`;
const nameA = `Ipe ${stamp}`;
const titleA = `IP open ${stamp}`;
const titleB = `IP renamed ${stamp}`;

let accounts: AccountManifest["accounts"];
let tenantId = "";
let tutor = "", parent = "", other = "";
let childA = "";
let sessionId = "";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  for (let i = 0; ; i++) {
    try {
      const s = await fbSignIn(op.email);
      const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
      const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
      await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
      return;
    } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}
async function raw(p: string, idToken: string, init?: RequestInit): Promise<{ status: number; body: J; text: string }> {
  let res: Response | null = null;
  for (let i = 0; i < 6 && !res; i++) {
    try { res = await fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }); }
    catch (e) { if (!(e instanceof TypeError) || i === 5) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
  const text = await res!.text();
  let body: J = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res!.status, body, text };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function tutorPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: statePath("freelancer"), reducedMotion: "reduce" });
  return ctx.newPage();
}
async function gotoHub(page: Page, url: string) {
  const tabs = page.getByRole("tablist").first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await tabs.isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(tabs).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  tutor = await token(accounts.freelancer);
  parent = await token(accounts.parent);
  other = await token(accounts.company);
  await provisionLiveListing(accounts.freelancer, { title: `E2E IpEdit Tuition ${stamp}`, price: 0 });
  childA = await createParentChild(accounts.parent, { name: nameA });
  await apiPost("/api/my/providers/follow", parent, { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, tutor, { subject, topic: "Nerves" });
  expect((await send("POST", `${HUB}/students`, tutor, { childId: childA, subjects: [subject] })).status).toBe(201);
  const made = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childA], title: titleA, key: `ipe-${stamp}` });
  expect([200, 201], made.text).toContain(made.status);
  sessionId = made.body.id as string;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });
test.afterAll(async () => { await setHub(accounts.freelancer, false); });

test.describe("edit a started in-person lesson (server rules)", () => {
  test("title and notes can change; students, time and anything else are refused; tutor-only", async () => {
    const before = await send("GET", `${HUB}/in-person/sessions/${sessionId}`, tutor);
    expect(before.status, before.text).toBe(200);
    expect(before.body).toMatchObject({ id: sessionId, title: titleA, status: "live" });

    const ok = await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, { title: titleB, notes: `Bring pencils ${stamp}` });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.body).toMatchObject({ id: sessionId, title: titleB, notes: `Bring pencils ${stamp}`, status: "live", startsAt: before.body.startsAt });
    expect(ok.body.childIds).toEqual(before.body.childIds);

    // Only the two fields: students, start time or status are a 400, and so is an empty edit / blank title.
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, { childIds: [] })).status).toBe(400);
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, { title: "x", startsAt: new Date().toISOString() })).status).toBe(400);
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, { status: "ended" })).status).toBe(400);
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, {})).status).toBe(400);
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, tutor, { title: "   " })).status).toBe(400);

    // A family and another business's tutor can't touch it.
    expect((await send("PUT", `${HUB}/in-person/sessions/${sessionId}?tenantId=${tenantId}`, parent, { title: "hijack" })).status).toBe(403);
    expect([403, 404]).toContain((await send("PUT", `${HUB}/in-person/sessions/${sessionId}`, other, { title: "hijack" })).status);

    // Nothing above changed it beyond the one good edit.
    const after = await send("GET", `${HUB}/in-person/sessions/${sessionId}`, tutor);
    expect(after.body).toMatchObject({ title: titleB, notes: `Bring pencils ${stamp}` });
    expect(after.body.childIds).toEqual(before.body.childIds);
  });
});

test.describe("tutor UI", () => {
  test("Home leads with the open in-person session (Resume), and the Live lessons row has an Edit pencil that renames it", async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await tutorPage(browser);
    await gotoHub(page, "/freelancer/learninghub");
    // Home: the card names THIS run's session, says it is in person, and offers Resume — never "Nothing on the calendar yet".
    const card = page.locator("#hub-home-tutor section").filter({ hasText: titleB }).first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(card.getByTestId("hub-next-inperson")).toBeVisible();
    await expect(card.getByRole("button", { name: /Resume in-person session/i })).toBeVisible();
    await expect(page.getByText(/Nothing on the calendar yet/i)).toHaveCount(0);

    // Live lessons: the still-open row has the pencil; rename through the dialog.
    await gotoHub(page, "/freelancer/learninghub?tab=live");
    const row = page.locator(`[data-ip-session-id="${sessionId}"]`);
    await expect(row).toBeVisible({ timeout: 45_000 });
    await row.getByTestId(`ip-edit-row-${sessionId}`).click();
    const dlg = page.locator("#hub-ip-edit");
    await expect(dlg).toBeVisible();
    const renamed = `IP final ${stamp}`;
    await dlg.locator("#hub-ip-edit-title").fill(renamed);
    await dlg.getByTestId("hub-ip-edit-save").click();
    await expect(dlg).toBeHidden({ timeout: 20_000 });
    await expect(page.locator(`[data-ip-session-id="${sessionId}"]`)).toContainText(renamed, { timeout: 20_000 });
    // The change is on the server, and the started lesson's students are untouched.
    const got = await send("GET", `${HUB}/in-person/sessions/${sessionId}`, tutor);
    expect(got.body).toMatchObject({ title: renamed });
    expect((got.body.students as J[]).map((s) => s.childId)).toEqual([childA]);
    await page.context().close();
  });
});
