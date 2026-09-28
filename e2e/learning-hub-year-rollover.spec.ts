import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Learning Hub — automatic September rollover of year groups (replaces the old "New school year — Review year groups" card).
//  • a hand-set year moves up by itself along the tenant's own list (anchored to the academic year it was set in);
//  • a child can be held back (frozen where they are, and stays there), then released;
//  • past the last year in the list they stay put and show "May have left";
//  • the tenant default (Setup → Teaching Hub) can be switched off, and a child's own choice still wins;
//  • an automatic (date-of-birth) child pinned by "hold back" becomes hand-set and stays;
//  • the yellow reminder card is gone from Home and Students even in September; the toggle lives in the child's profile + Setup.
// The server's clock can't be moved from here, so "September rolls round" = backdating the student's `yearAnchor` via the Admin SDK
// (e2e/helpers/enrolmentDoc.ts). Every assertion is anchored to THIS run's children (stamped names).
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
type Row = { childId: string; childName: string; yearGroup: string | null; yearGroupAuto: boolean; yearMoveUp: boolean | null; mayHaveLeft: boolean };
let accounts: AccountManifest["accounts"];
let tenantId = "", tutor = "";
const kids: Record<"hand" | "hold" | "left" | "auto", { id: string; name: string }> = {
  hand: { id: "", name: `Rollhand ${stamp}` }, hold: { id: "", name: `Rollhold ${stamp}` }, left: { id: "", name: `Rollleft ${stamp}` }, auto: { id: "", name: `Rollauto ${stamp}` },
};

const anchorNow = () => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; };
const doc = (id: string, patch?: object): Record<string, unknown> =>
  JSON.parse(execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/enrolmentDoc.ts"), tenantId, id, ...(patch ? [JSON.stringify(patch)] : [])], { cwd: path.join(ROOT, "server"), stdio: "pipe" }).toString().trim().split("\n").pop()!);
// The dev API hot-reloads whenever anyone saves a server file — ride out a restart (network failures only).
async function retryNet<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 8 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}
const rows = () => retryNet(() => apiFetch<Row[]>(`${HUB}/students`, tutor));
const row = async (id: string) => (await rows()).find((r) => r.childId === id)!;
const put = (id: string, body: object) => retryNet(() => apiFetch<Row>(`${HUB}/students/${id}`, tutor, { method: "PUT", body: JSON.stringify(body) }));
/** Backdate the anchor behind the API's back, then send an empty PUT so the API forgets its cached roster (it re-reads the doc from Firestore). */
const backdate = async (id: string, years: number) => { doc(id, { yearAnchor: anchorNow() - years }); await put(id, {}); };

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(on: boolean) {
  const s = await fbSignIn(accounts.freelancer.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } } }) });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Rollover ${stamp}`, price: 0 });
  tutor = (await fbSignIn(accounts.freelancer.email)).idToken;
  await apiPost("/api/my/providers/follow", (await fbSignIn(accounts.parent.email)).idToken, { tenantId });
  await markParentWelcomed(accounts.parent);
  for (const k of Object.values(kids)) k.id = await createParentChild(accounts.parent, { name: k.name, dob: "2016-03-14" });
  await apiFetch(`${HUB}/config`, tutor, { method: "PUT", body: JSON.stringify({ hub: { yearAutoAdvance: true } }) });
  for (const k of [kids.hand, kids.hold, kids.left]) expect((await apiPost<Row>(`${HUB}/students`, tutor, { childId: k.id, subjects: [], yearGroup: "Year 4" })).yearGroup).toBe("Year 4");
  await apiPost(`${HUB}/students`, tutor, { childId: kids.auto.id, subjects: [] }); // no year given → automatic, from the dob
});
test.afterAll(async () => {
  await apiFetch(`${HUB}/config`, tutor, { method: "PUT", body: JSON.stringify({ hub: { yearAutoAdvance: true } }) }).catch(() => undefined);
  await setHub(false);
});

test("a hand-set year is anchored to the academic year it was set in and moves up when Septembers pass", async () => {
  const d = doc(kids.hand.id);
  expect(d.yearAnchor).toBe(anchorNow());
  expect(d.yearGroup).toBe("Year 4");
  expect(await row(kids.hand.id)).toMatchObject({ yearGroup: "Year 4", yearGroupAuto: false, yearMoveUp: null, mayHaveLeft: false });
  await backdate(kids.hand.id, 2); // as if set two Septembers ago
  expect(await row(kids.hand.id)).toMatchObject({ yearGroup: "Year 6", mayHaveLeft: false });
  await backdate(kids.hand.id, 1);
  expect((await row(kids.hand.id)).yearGroup).toBe("Year 5");
});

test("an automatic child follows the date of birth (and never needs an anchor)", async () => {
  const r = await row(kids.auto.id);
  expect(r.yearGroupAuto).toBe(true);
  expect(r.yearGroup).toMatch(/^Year \d+$/);
  expect(doc(kids.auto.id).yearAnchor).toBeUndefined();
});

test("hold a child back: frozen where they are now, and it stays through later Septembers; release resumes from there", async () => {
  await backdate(kids.hold.id, 2);
  expect((await row(kids.hold.id)).yearGroup).toBe("Year 6");
  const held = await put(kids.hold.id, { yearMoveUp: false });
  expect(held).toMatchObject({ yearGroup: "Year 6", yearMoveUp: false });
  expect(doc(kids.hold.id).yearAnchor).toBe(anchorNow());
  await backdate(kids.hold.id, 5); // five more Septembers go by
  expect(await row(kids.hold.id)).toMatchObject({ yearGroup: "Year 6", yearMoveUp: false });
  const freed = await put(kids.hold.id, { yearMoveUp: true }); // resumes from Year 6 NOW, no jump
  expect(freed).toMatchObject({ yearGroup: "Year 6", yearMoveUp: true });
  await backdate(kids.hold.id, 1);
  expect((await row(kids.hold.id)).yearGroup).toBe("Year 7");
});

test("holding back an automatic child pins the year they are in as hand-set", async () => {
  const before = (await row(kids.auto.id)).yearGroup;
  const r = await put(kids.auto.id, { yearMoveUp: false });
  expect(r).toMatchObject({ yearGroup: before, yearGroupAuto: false, yearMoveUp: false });
  const back = await put(kids.auto.id, { yearGroupAuto: true }); // "set to automatic" hands control back to the date of birth
  expect(back).toMatchObject({ yearGroupAuto: true, yearMoveUp: null });
});

test("past the last year in the list a student stays put and is flagged may-have-left", async () => {
  await backdate(kids.left.id, 12); // Year 4 + 12 → beyond Year 13
  expect(await row(kids.left.id)).toMatchObject({ yearGroup: "Year 13", mayHaveLeft: true });
  await backdate(kids.left.id, 9); // exactly Year 13 → not left yet
  expect(await row(kids.left.id)).toMatchObject({ yearGroup: "Year 13", mayHaveLeft: false });
  await backdate(kids.left.id, 12);
});

test("the tenant default can be switched off; a child's own choice still wins; the setting must be a boolean", async () => {
  expect((await fetch(`${API_URL}${HUB}/config`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tutor}` }, body: JSON.stringify({ hub: { yearAutoAdvance: "no" } }) })).status).toBe(400);
  await backdate(kids.hand.id, 2); await backdate(kids.hold.id, 2);
  await apiFetch(`${HUB}/config`, tutor, { method: "PUT", body: JSON.stringify({ hub: { yearAutoAdvance: false } }) });
  expect((await row(kids.hand.id)).yearGroup).toBe("Year 4"); // follows the tenant default (off): pinned
  expect((await row(kids.hold.id)).yearGroup).toBe("Year 8"); // its own yearMoveUp:true beats the default (frozen Year 6 + 2)
  await apiFetch(`${HUB}/config`, tutor, { method: "PUT", body: JSON.stringify({ hub: { yearAutoAdvance: true } }) });
  expect((await row(kids.hand.id)).yearGroup).toBe("Year 6");
});

test.describe("UI", () => {
  const open = async (page: Page, url: string) => { await setHub(true); await page.goto(url); await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 30_000 }); };

  test("no yellow reminder card on Home or Students — even in September", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: statePath("freelancer") });
    const page = await ctx.newPage();
    // (No fake clock: pinning the date before the sign-in token was issued breaks Firebase auth, so the hub never loads. Real September — the old
    // reminder's 1 Aug–31 Oct window — is when this runs; outside it the "no card" assertions are simply still true.)
    await open(page, "/freelancer/learninghub?tab=home");
    await expect(page.getByTestId("year-reminder")).toHaveCount(0);
    await expect(page.getByText("New school year")).toHaveCount(0);
    await page.goto("/freelancer/learninghub?tab=students");
    await expect(cardWith(page, kids.hand.name, "Year")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("year-reminder")).toHaveCount(0);
    await expect(page.getByText("Review year groups")).toHaveCount(0);
    await ctx.close();
  });

  test("Students: the profile has 'Move up each September'; toggling it saves; may-have-left shows on the card", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: statePath("freelancer") });
    const page = await ctx.newPage();
    await open(page, "/freelancer/learninghub?tab=students");
    await expect(cardWith(page, kids.left.name, "May have left")).toBeVisible({ timeout: 30_000 });
    const card = cardWith(page, kids.hand.name, "Year");
    await card.getByRole("button", { name: `Actions for ${kids.hand.name}` }).click();
    await page.getByRole("menuitem", { name: "Edit details" }).click();
    const box = page.getByTestId("hub-edit-moveup");
    await expect(box).toBeChecked();
    await box.uncheck();
    const saved = page.waitForResponse((r) => r.url().includes(`/students/${kids.hand.id}`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    expect((await saved).status()).toBe(200);
    expect((await row(kids.hand.id)).yearMoveUp).toBe(false);
    await ctx.close();
  });

  test("Setup → Teaching Hub carries the tenant default with its explanation (and no reminder card)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: statePath("freelancer") });
    const page = await ctx.newPage();
    await setHub(true);
    await page.goto("/freelancer/setup?tab=hub");
    await expect(page.getByTestId("setup-year-advance")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/every student's year group moves up by itself on 1 September/i)).toBeVisible();
    await expect(page.getByText("Year group reminder")).toHaveCount(0);
    await expect(page.getByText(/Students who may have left: \d+/)).toBeVisible();
    await ctx.close();
  });
});
