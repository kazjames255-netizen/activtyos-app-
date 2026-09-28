import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeedQ, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";
import { openTab } from "./helpers/hubTabs";

// Learning Hub — SCHEDULE an IN-PERSON lesson for later (POST /lessons {mode:"in_person"} → POST /in-person/sessions/:id/start).
// New session → In person → Schedule for later: a lesson with no video room that families see as "In person" (nothing to join), that the
// tutor starts from Upcoming when the children are with them, and that then becomes an ordinary in-person session.
// Every assertion is anchored to THIS run's stamped lesson titles / children / ids.

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const subject = `IpSched Lab ${stamp}`;
const nameA = `Ips ${stamp}`;

let accounts: AccountManifest["accounts"];
let tenantId = "";
let tutor = "", parent = "", other = "";
let childA = "";
let topicId = "";
let L: SeededLesson;

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
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function raw(p: string, idToken: string, init?: RequestInit): Promise<{ status: number; body: J; text: string }> {
  let res: Response | null = null;
  for (let i = 0; i < 6 && !res; i++) {
    try { res = await fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }); }
    catch (e) { if (!(e instanceof TypeError) || i === 5) throw e; await new Promise((r) => setTimeout(r, 3000)); } // the dev API hot-reloads
  }
  const text = await res!.text();
  let body: J = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res!.status, body, text };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
/** POST that must create something — through the retrying `raw` (the dev API restarts whenever a server file is saved). */
const create = async (p: string, t: string, body: unknown) => { const r = await send("POST", p, t, body); expect(r.status, r.text).toBe(201); return r.body.id as string; };
const bell = async (t: string) => (await raw("/api/notifications", t)).body.notifications as { title: string; body: string; category: string }[];

// If .env.local points the web app at a tunnel that isn't up, send its API calls to the local API instead.
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent") {
  const ctx = await browser.newContext({ storageState: statePath(role), reducedMotion: "reduce" });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return ctx;
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
  await provisionLiveListing(accounts.freelancer, { title: `E2E IpSched Tuition ${stamp}`, price: 0 });
  childA = await createParentChild(accounts.parent, { name: nameA });
  await apiPost("/api/my/providers/follow", parent, { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, tutor, { subject, topic: "Nerves" });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, tutor);
  topicId = topics.find((x) => x.subject === subject)!.id;
  expect((await send("POST", `${HUB}/students`, tutor, { childId: childA, subjects: [subject] })).status).toBe(201);
  L = await seedOakLesson(tutor, { stamp, subject, topicId, widget: null, warmupMax: 2, quizMax: 3, skipKinds: ["order", "match"] });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });
test.afterAll(async () => { await setHub(accounts.freelancer, false); });

const inDays = (d: number, hour = 15) => { const t = new Date(Date.now() + d * 86_400_000); t.setHours(hour, 0, 0, 0); return t.toISOString(); };
const titleA = `IP scheduled ${stamp}`;
const titleB = `IP cancelled ${stamp}`;
let lessonId = "";

test.describe("server rules", () => {
  test("a tutor schedules an in-person lesson: no room, families see it as in person, nothing to join", async () => {
    test.setTimeout(240_000);
    // Rejected shapes: video links on an in-person lesson, "log a held lesson" in person, a stranger's tutor, a family.
    expect((await send("POST", `${HUB}/lessons`, tutor, { mode: "in_person", title: `${titleA} bad`, startsAt: inDays(2), durationMins: 45, childIds: [childA], videos: [{ url: "https://youtu.be/dQw4w9WgXcQ" }] })).status).toBe(400);
    expect((await send("POST", `${HUB}/lessons`, tutor, { mode: "in_person", held: true, title: `${titleA} held`, startsAt: inDays(-1), durationMins: 30, childIds: [childA] })).status).toBe(400);
    expect([403, 404]).toContain((await send("POST", `${HUB}/lessons`, other, { mode: "in_person", title: `${titleA} x`, startsAt: inDays(2), durationMins: 45, childIds: [childA] })).status);
    expect((await send("POST", `${HUB}/lessons?tenantId=${tenantId}`, parent, { mode: "in_person", title: `${titleA} p`, startsAt: inDays(2), durationMins: 45, childIds: [childA] })).status).toBe(403);
    expect((await send("POST", `${HUB}/lessons`, tutor, { mode: "in_person", title: `${titleA} nostudent`, startsAt: inDays(2), durationMins: 45, childIds: [] })).status).toBe(400);
    expect((await send("POST", `${HUB}/lessons`, tutor, { mode: "in_person", title: `${titleA} quiz`, startsAt: inDays(2), durationMins: 45, childIds: [childA], assessmentId: "nope/../x" })).status).toBe(404);

    const made = await send("POST", `${HUB}/lessons`, tutor, { mode: "in_person", title: titleA, startsAt: inDays(2), durationMins: 45, childIds: [childA], noteIds: [L.noteId], assessmentId: L.quizId, notes: `Bring a pencil ${stamp}` });
    expect(made.status, made.text).toBe(201);
    lessonId = made.body.id as string;
    expect(made.body).toMatchObject({ mode: "in_person", status: "scheduled", roomName: null, joinable: false, title: titleA });
    // The family sees it, marked in person, never joinable; its join endpoint refuses it.
    const fam = await send("GET", `${HUB}/lessons?tenantId=${tenantId}&childId=${childA}`, parent);
    const mine = (fam.body as J[]).find((l) => l.id === lessonId);
    expect(mine, fam.text).toMatchObject({ mode: "in_person", joinable: false, title: titleA });
    expect((await send("POST", `${HUB}/lessons/${lessonId}/join?tenantId=${tenantId}&childId=${childA}`, parent, { childId: childA })).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${lessonId}/join`, tutor, {})).status).toBe(404);
    // The family is told, in person wording (no "join" instruction).
    const n = (await bell(parent)).find((x) => x.body.includes(titleA));
    expect(n, "the family is notified").toBeTruthy();
    expect(n!.title).toBe("In-person lesson scheduled");
    expect(n!.body).toContain("in person");
    expect(n!.body).not.toContain("join");
  });

  test("scheduled ≠ started: not in the in-person session list, can't be used until Start, Start is tutor-only and idempotent", async () => {
    test.setTimeout(240_000);
    const list = await send("GET", `${HUB}/in-person/sessions`, tutor);
    expect((list.body as J[]).some((s) => s.id === lessonId), "a scheduled lesson is not a session yet").toBe(false);
    const early = await send("PUT", `${HUB}/in-person/sessions/${lessonId}/attendance`, tutor, { present: { [childA]: true } });
    expect(early.status, early.text).toBe(409);
    expect(early.body.code).toBe("not_started");
    expect((await send("POST", `${HUB}/in-person/sessions/${lessonId}/start?tenantId=${tenantId}`, parent, {})).status).toBe(403);
    expect([403, 404]).toContain((await send("POST", `${HUB}/in-person/sessions/${lessonId}/start`, other, {})).status);
    const start = await send("POST", `${HUB}/in-person/sessions/${lessonId}/start`, tutor, {});
    expect(start.status, start.text).toBe(200);
    expect(start.body).toMatchObject({ id: lessonId, status: "live", mode: "in_person", noteId: L.noteId, assessmentId: L.quizId });
    expect(start.body.students).toEqual([expect.objectContaining({ childId: childA, present: true })]);
    // Idempotent (a double tap / second device): the same live session, not an error and not a second one.
    const again = await send("POST", `${HUB}/in-person/sessions/${lessonId}/start`, tutor, {});
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(lessonId);
    // Now it is an ordinary in-person session: listed there, and gone from the scheduled-lessons list.
    const live = await send("GET", `${HUB}/in-person/sessions?status=live`, tutor);
    expect((live.body as J[]).some((s) => s.id === lessonId)).toBe(true);
    const lessons = await send("GET", `${HUB}/lessons`, tutor);
    expect((lessons.body as J[]).some((l) => l.id === lessonId)).toBe(false);
    expect((await send("POST", `${HUB}/in-person/sessions/${lessonId}/end`, tutor, {})).body.status).toBe("ended");
  });

  test("edit / move / cancel a scheduled in-person lesson; a cancelled one can't be started; families hear about the cancellation", async () => {
    test.setTimeout(240_000);
    const id = await create(`${HUB}/lessons`, tutor, { mode: "in_person", title: titleB, startsAt: inDays(3), durationMins: 30, childIds: [childA] });
    const moved = await send("PUT", `${HUB}/lessons/${id}`, tutor, { startsAt: inDays(4), title: `${titleB} v2` });
    expect(moved.status, moved.text).toBe(200);
    expect(moved.body).toMatchObject({ title: `${titleB} v2`, mode: "in_person", status: "scheduled" });
    expect((await bell(parent)).some((x) => x.title === "In-person lesson time changed" && x.body.includes(`${titleB} v2`))).toBe(true);
    const cancelled = await send("PUT", `${HUB}/lessons/${id}`, tutor, { status: "cancelled" });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect((await bell(parent)).some((x) => x.title === "In-person lesson cancelled" && x.body.includes(`${titleB} v2`))).toBe(true);
    const start = await send("POST", `${HUB}/in-person/sessions/${id}/start`, tutor, {});
    expect(start.status).toBe(409);
    expect(start.body.code).toBe("lesson_closed");
    // The mode can't be flipped by an edit, and once STARTED the video-lessons endpoints no longer touch it.
    expect((await send("PUT", `${HUB}/lessons/${lessonId}`, tutor, { title: "started" })).status).toBe(404);
  });
});

test.describe("tutor + family UI", () => {
  test("New session → In person → Schedule for later → form → Upcoming card → Start in-person session", async ({ browser }) => {
    test.setTimeout(360_000);
    const uiTitle = `IP ui ${stamp}`;
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub?tab=live");
    await expect(page.locator("#hub-live-lessons")).toBeVisible({ timeout: 30_000 });
    await page.locator("#hub-schedule-lesson, [data-testid=hub-schedule-lesson]").first().click();
    const chooser = page.locator("#hub-new-session");
    await expect(chooser).toBeVisible();
    await chooser.getByRole("radio", { name: "In person" }).or(chooser.getByRole("button", { name: "In person", exact: true })).first().click();
    // The old "in-person can't be scheduled" note is gone and BOTH When options are offered.
    await expect(page.getByTestId("hub-new-inperson-now-note")).toHaveCount(0);
    await expect(chooser).not.toContainText("nothing to schedule ahead");
    await chooser.getByRole("radio", { name: "Schedule for later" }).or(chooser.getByRole("button", { name: "Schedule for later", exact: true })).first().click();
    await page.getByTestId("hub-new-session-continue").click();

    const form = page.locator("#hub-lesson-form");
    await expect(form).toBeVisible();
    await expect(form.getByRole("heading", { name: "Schedule an in-person lesson" })).toBeVisible();
    await expect(form.locator("#hub-lesson-video-link")).toHaveCount(0); // no video links for an in-person lesson
    await expect(form.getByTestId("hub-lesson-mode-held")).toHaveCount(0); // "log a held lesson" is video-only
    await form.locator("#hub-lesson-title").fill(uiTitle);
    await form.getByRole("button", { name: nameA }).or(form.getByText(nameA, { exact: true })).first().click();
    await form.getByRole("button", { name: "Schedule in-person lesson" }).click();

    // Upcoming shows it as an in-person card with a Start button (not a video Join).
    const card = cardWith(page, uiTitle, "In person");
    await expect(card).toBeVisible({ timeout: 25_000 });
    await expect(card.getByRole("button", { name: /join/i })).toHaveCount(0);
    await card.getByRole("button", { name: "Start in-person session" }).click();
    await expect(page.getByTestId("inperson-run")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("a parent sees the lesson as In person with nothing to join", async ({ browser }) => {
    test.setTimeout(240_000);
    // A fresh one, still scheduled (the tutor UI test above started its own).
    const t3 = `IP family ${stamp}`;
    await create(`${HUB}/lessons`, tutor, { mode: "in_person", title: t3, startsAt: inDays(1), durationMins: 30, childIds: [childA] });
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await page.goto("/custdash/learninghub?tab=live");
    await dismissParentWelcome(page).catch(() => undefined);
    await expect(page.locator("#hub-live-lessons")).toBeVisible({ timeout: 40_000 });
    const card = cardWith(page, t3, "In person");
    await expect(card).toBeVisible({ timeout: 25_000 });
    await expect(card).toContainText("nothing to join online");
    await expect(card.getByRole("button", { name: /join|start/i })).toHaveCount(0);
    await ctx.close();
  });
});
