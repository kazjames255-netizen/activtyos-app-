import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Learning Hub — the tutor-flow fixes from audit A1 (docs/hub-review/A1-tutor-flow.md):
//  F1  /providers reports the caller's real level (+ franchise, business name) — regression for owner and default-caps staff
//  F3  homework for a quiz the child can never open: /homework/reach lists them, POST is refused (400 quiz_unreachable), the form warns
//  F4  a draft exit quiz / draft lesson attached to homework: the form says so and offers to publish
//  F8  the homework form's quiz picker searches on the server
//  F9/F10  a student card opens that student's Progress, in third person
//  F13 the enrol dialog explains how a family who never booked gets in (a page link)
//  F19 publishing many flashcards is ONE request
//  G1  (leftovers) F11 per-tutor scoping (tutors list, staff-default assignment, ?mine=1), F13 family invite links
//      (staff invites → the parent enrols their OWN child), F14 weekly repeat / log a lesson already held / attach lessons at
//      creation, F18 the dashboard "Turn on the Learning Hub" card. Assertions are made on the SERVER first, screens second.
// Every state assertion is anchored to THIS run's entities (stamped names).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const maths = `TF Maths ${stamp}`;
const french = `TF French ${stamp}`;
const childName = `Flowkid ${stamp}`;
const quizA = `TF Maths quiz ${stamp}`;
const quizB = `TF French quiz ${stamp}`;
const quizDraft = `TF Draft maths quiz ${stamp}`;
const draftLesson = `TF Draft lesson ${stamp}`;

let accounts: AccountManifest["accounts"];
let tutor = "", staff = "";
let tenantId = "";
let childId = "";
let ids: Record<string, string> = {};

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  // The dev API hot-reloads whenever anyone saves a server file — ride out a restart (network failures only).
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
type Body = Record<string, unknown> & { error?: unknown; code?: string };
async function retryNet<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 5 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
async function raw(p: string, idToken: string, init?: RequestInit) {
  const res = await retryNet(() => fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }));
  const text = await res.text();
  let body: unknown = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: body as Body };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function tutorPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return { ctx, page: await ctx.newPage() };
}
async function gotoHub(page: Page, tab: string) {
  const heading = page.getByRole("tablist").first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(`/freelancer/learninghub?tab=${tab}`);
    if (await page.getByRole("tab").first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId });
  await markParentWelcomed(accounts.parent);
  tutor = await token(accounts.freelancer);
  staff = await token(accounts.staff);
  // The child is enrolled for MATHS ONLY.
  const topic = async (subject: string, name: string) => (await apiPost<{ id: string }>(`${HUB}/topics`, tutor, { subject, topic: name })).id;
  ids.tMaths = await topic(maths, "Number");
  ids.tFrench = await topic(french, "Verbs");
  expect((await send("POST", `${HUB}/students`, tutor, { childId, subjects: [maths] })).status).toBe(201);
  const q = async (topicId: string, prompt: string) => (await apiPost<{ id: string }>(`${HUB}/questions`, tutor, { topicId, kind: "short", prompt, answer: "yes", marks: 1 })).id;
  const qm = await q(ids.tMaths, `Maths q ${stamp}`);
  const qf = await q(ids.tFrench, `French q ${stamp}`);
  const mk = async (title: string, subject: string, topicId: string, questionId: string, published: boolean) =>
    (await apiPost<{ id: string }>(`${HUB}/assessments`, tutor, { type: "quiz", title, subject, topicIds: [topicId], questionIds: [questionId], timeLimitMins: null, published })).id;
  ids.quizA = await mk(quizA, maths, ids.tMaths, qm, true);
  ids.quizB = await mk(quizB, french, ids.tFrench, qf, true);
  ids.quizDraft = await mk(quizDraft, maths, ids.tMaths, qm, false);
  ids.note = (await apiPost<{ id: string }>(`${HUB}/notes`, tutor, { topicId: ids.tMaths, title: draftLesson, body: `Body ${stamp}`, published: false })).id;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); await setHub(accounts.company, true); });
test.afterAll(async () => { await setHub(accounts.freelancer, false); await setHub(accounts.company, false); });

test.describe("F1 — /providers reports the caller's real level", () => {
  test("owner: canEdit, no franchise, the business name (not the generic label)", async () => {
    const r = await raw(`${HUB}/providers`, tutor);
    expect(r.status).toBe(200);
    const p = (r.body as unknown as Record<string, unknown>[])[0]!;
    expect(p.tenantId).toBe(tenantId);
    expect(p.canEdit).toBe(true);
    expect(p.franchiseId).toBeNull();
    expect(p.name).not.toBe("Your Learning Hub");
  });
  test("staff with no permission matrix in force keeps full access (regression: default caps allow edit)", async () => {
    const r = await raw(`${HUB}/providers`, staff);
    expect(r.status).toBe(200);
    expect((r.body as unknown as Record<string, unknown>[])[0]!.canEdit).toBe(true);
  });
});

test.describe("F3 — homework a child can never open", () => {
  test("/homework/reach names the student a quiz can't reach, and why", async () => {
    const bad = (await raw(`${HUB}/homework/reach?assessmentId=${ids.quizB}`, tutor)).body as unknown as { unreachable: { childId: string; reason: string }[] };
    const mine = bad.unreachable.find((u) => u.childId === childId);
    expect(mine?.reason).toContain(french);
    const ok = (await raw(`${HUB}/homework/reach?assessmentId=${ids.quizA}`, tutor)).body as unknown as { unreachable: { childId: string }[] };
    expect(ok.unreachable.some((u) => u.childId === childId)).toBe(false);
  });
  test("POST /homework for the wrong-subject quiz is refused with the list; the right subject is accepted", async () => {
    const refused = await send("POST", `${HUB}/homework`, tutor, { title: `TF bad ${stamp}`, assessmentId: ids.quizB, assignedChildIds: [childId] });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe("quiz_unreachable");
    expect((refused.body.unreachable as { childId: string }[])[0]!.childId).toBe(childId);
    const good = await send("POST", `${HUB}/homework`, tutor, { title: `TF good ${stamp}`, assessmentId: ids.quizA, assignedChildIds: [childId] });
    expect(good.status).toBe(201);
    // …and nothing was created for the refused one.
    const list = (await raw(`${HUB}/homework`, tutor)).body as unknown as { title: string }[];
    expect(list.some((h) => h.title === `TF bad ${stamp}`)).toBe(false);
  });
});

test.describe("F19 — publishing many flashcards is one request", () => {
  test("POST /flashcards/publish flips every draft at once", async () => {
    const mk = async (n: number) => (await apiPost<{ id: string }>(`${HUB}/flashcards`, tutor, { topicId: ids.tMaths, front: `TF front ${n} ${stamp}`, back: "b", published: false })).id;
    const cards = [await mk(1), await mk(2), await mk(3)];
    const r = await send("POST", `${HUB}/flashcards/publish`, tutor, { ids: [...cards, "does-not-exist"], published: true });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ updated: 3, skipped: 1 });
    const list = (await raw(`${HUB}/flashcards?topicId=${ids.tMaths}&limit=200`, tutor)).body as unknown as { items: { id: string; published: boolean }[] };
    for (const id of cards) expect(list.items.find((c) => c.id === id)?.published).toBe(true);
  });
});

test.describe("the tutor's screens", () => {
  test("F8/F3/F4: homework form — search the quiz, see who can't open it, publish a draft quiz", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "homework");
    await page.getByRole("button", { name: /Set homework|Set your first/ }).first().click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    // F8: the quiz picker searches on the server — typing this run's stamp finds exactly this run's quizzes, grouped by subject.
    await dlg.locator("#hub-hw-quiz-search").fill(quizB);
    await expect(dlg.locator("#hub-hw-quiz").locator(`option[value="${ids.quizB}"]`)).toHaveCount(1, { timeout: 20_000 });
    await dlg.locator("#hub-hw-quiz").selectOption(ids.quizB);
    // F3: tick this run's child → the form says French isn't in their subjects, and Assign is blocked.
    await dlg.locator(`#hub-hw-student-${childId}`).click();
    const warn = dlg.getByTestId("hub-hw-unreachable");
    await expect(warn).toBeVisible({ timeout: 20_000 });
    await expect(warn).toContainText(french);
    await expect(dlg.getByRole("button", { name: "Assign homework" })).toBeDisabled();
    // Removing them clears the warning.
    await warn.getByRole("button", { name: /Remove/ }).click();
    await expect(warn).toHaveCount(0);
    await ctx.close();
  });

  test("F4: a draft quiz handed over from a quiz card is flagged and can be published in the form", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "quizzes");
    // Narrow the tab to this run's subject (a big library is collapsed by subject).
    await page.getByRole("button", { name: new RegExp(maths) }).first().click().catch(() => undefined);
    const card = page.locator(`#hub-assessment-${ids.quizDraft}`);
    await expect(card).toBeVisible({ timeout: 40_000 });
    await expect(cardWith(page, quizDraft, "Draft")).toBeVisible();
    await card.getByTestId("hub-assessment-assign").click(); // F7: quiz cards can be set for children
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.locator("#hub-hw-title")).toHaveValue(quizDraft);
    const note = dlg.getByTestId("hub-hw-draft-quiz");
    await expect(note).toBeVisible({ timeout: 20_000 });
    await note.getByRole("button", { name: /Publish the quiz/ }).click();
    await expect(note).toHaveCount(0, { timeout: 20_000 });
    const a = (await raw(`${HUB}/assessments/${ids.quizDraft}`, tutor)).body;
    expect(a.published).toBe(true);
    await ctx.close();
  });

  test("F4: attaching a draft lesson warns and can publish it", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "homework");
    await page.getByRole("button", { name: /Set homework|Set your first/ }).first().click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await dlg.locator("#hub-hw-note-search").fill(draftLesson);
    const row = dlg.locator("label", { hasText: draftLesson });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator("input[type=checkbox]").check();
    const warn = dlg.getByTestId("hub-hw-draft-lesson");
    await expect(warn).toContainText(draftLesson, { timeout: 20_000 });
    await warn.getByRole("button", { name: /Publish it/ }).click();
    await expect(warn).toHaveCount(0, { timeout: 20_000 });
    const n = (await raw(`${HUB}/notes/${ids.note}`, tutor)).body;
    expect(n.published).toBe(true);
    await ctx.close();
  });

  test("F9/F10/F13: a student card opens their Progress (third person); the enrol dialog explains how to bring in a new family", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "students");
    const card = cardWith(page, childName);
    await expect(card).toBeVisible({ timeout: 40_000 });
    await card.getByTestId("hub-student-progress").click();
    await expect(page.getByText(`${childName} hasn't taken a quiz yet`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Your progress starts with the first quiz")).toHaveCount(0);
    // F13 — no match in the enrol list → the page link for families who never booked.
    await page.getByRole("tab", { name: /^Students/ }).click();
    await page.getByRole("button", { name: /Enrol a student|Enrol your first student/ }).first().click();
    await page.getByLabel("Search children").fill(`zzz-nobody-${stamp}`);
    const link = page.getByTestId("hub-family-link");
    await expect(link).toBeVisible({ timeout: 20_000 });
    await expect(link.getByLabel("Your page link")).toHaveValue(new RegExp(`/store/${tenantId}$`));
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// G1 — the leftovers
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const inviteKid = `Invitekid ${stamp}`;
const uiKid = `Uikid ${stamp}`;
const repTitle = `TF weekly ${stamp}`;
const heldTitle = `TF held ${stamp}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const londonHM = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
type LessonRow = { id: string; title: string; status: string; startsAt: string; tutorUid: string; seriesId: string | null; seriesIndex: number | null; seriesCount: number | null; held: boolean; attendance: Record<string, string>; noteIds: string[]; roomName: string | null };
const lessonsOf = async (t: string, q = "") => ((await raw(`${HUB}/lessons${q}`, t)).body as unknown as LessonRow[]);

test.describe("G1 F11/F13 — tutors, per-tutor scoping and family invites (company owner + its staff)", () => {
  let owner = "", parentTok = "", ownerUid = "", staffUid = "", kid = "", invite = "";

  test.beforeAll(async () => {
    owner = await token(accounts.company);
    parentTok = await token(accounts.parent);
    ownerUid = ((await raw(`${HUB}/providers`, owner)).body as unknown as { uid: string }[])[0]!.uid;
    staffUid = ((await raw(`${HUB}/providers`, staff)).body as unknown as { uid: string }[])[0]!.uid;
    kid = await createParentChild(accounts.parent, { name: inviteKid });
  });

  test("/tutors lists the owner and the staff member, and flags the caller", async () => {
    const r = await raw(`${HUB}/tutors`, staff);
    expect(r.status).toBe(200);
    const list = r.body as unknown as { uid: string; me: boolean }[];
    expect(list.find((t) => t.uid === staffUid)?.me).toBe(true);
    expect(list.some((t) => t.uid === ownerUid && !t.me)).toBe(true);
    // a family may not read the team list
    expect([400, 403]).toContain((await raw(`${HUB}/tutors`, parentTok)).status); // (no ?tenantId → 400; with one → 403)
  });

  test("a staff tutor's invite link → the PARENT enrols their own child → the student is that tutor's", async () => {
    const made = await send("POST", `${HUB}/family-invites`, staff, { forName: `Fam ${stamp}`, subjects: [maths] });
    expect(made.status).toBe(201);
    invite = made.body.token as string;
    expect(String(made.body.url)).toContain(`/custdash/learninghub?invite=${invite}`);
    // the parent previews it
    const pv = await send("GET", `${HUB}/family-invites/${invite}`, parentTok);
    expect(pv.status).toBe(200);
    expect(pv.body.forName).toBe(`Fam ${stamp}`);
    // a tutor can't accept it; nobody can enrol a child that isn't theirs
    expect((await send("POST", `${HUB}/family-invites/${invite}/accept`, staff, { childId: kid })).status).toBe(403);
    expect((await send("POST", `${HUB}/family-invites/${invite}/accept`, parentTok, { childId: `not-mine-${stamp}` })).status).toBe(404);
    expect((await send("POST", `${HUB}/family-invites/${"0".repeat(32)}/accept`, parentTok, { childId: kid })).status).toBe(404);
    const ok = await send("POST", `${HUB}/family-invites/${invite}/accept`, parentTok, { childId: kid });
    expect(ok.status).toBe(201);
    const row = ((await raw(`${HUB}/students`, owner)).body as unknown as { childId: string; tutorUid: string | null; tutorName: string; subjects: string[]; active: boolean }[]).find((r) => r.childId === kid);
    expect(row?.active).toBe(true);
    expect(row?.subjects).toEqual([maths]);
    expect(row?.tutorUid).toBe(staffUid); // a staff tutor's invite assigns the family to them
    expect(row?.tutorName).not.toBe("");
    // …and the hub is now the family's: their providers list carries the company.
    const prov = (await raw(`${HUB}/providers`, parentTok)).body as unknown as { tenantId: string; children: { childId: string }[] }[];
    expect(prov.find((p) => p.tenantId === accounts.company.tenantId)?.children.some((c) => c.childId === kid)).toBe(true);
    // the used link no longer hands its token back, and is bound to that parent
    const list = (await raw(`${HUB}/family-invites`, owner)).body as unknown as { id: string; token: string | null; status: string; childNames: string[] }[];
    const mine = list.find((i) => i.id === invite)!;
    expect(mine.status).toBe("claimed");
    expect(mine.token).toBeNull();
    expect(mine.childNames).toContain(inviteKid);
  });

  test("a withdrawn invite (and a made-up one) is refused; a used one can't be withdrawn", async () => {
    const made = await send("POST", `${HUB}/family-invites`, owner, { forName: `Gone ${stamp}` });
    const tok = made.body.token as string;
    expect((await send("DELETE", `${HUB}/family-invites/${tok}`, owner)).status).toBe(200);
    const pv = await send("GET", `${HUB}/family-invites/${tok}`, parentTok);
    expect(pv.status).toBe(410);
    expect(pv.body.code).toBe("invite_revoked");
    expect((await send("GET", `${HUB}/family-invites/${"f".repeat(32)}`, parentTok)).status).toBe(404);
    expect((await send("DELETE", `${HUB}/family-invites/${invite}`, owner)).status).toBe(409);
    // another business's tutor can't see or withdraw this business's invite
    expect((await send("DELETE", `${HUB}/family-invites/${tok}`, tutor)).status).toBe(404);
    expect(((await raw(`${HUB}/family-invites`, tutor)).body as unknown as { id: string }[]).some((i) => i.id === invite)).toBe(false);
  });

  test("the owner reassigns the student; someone not on the team is refused", async () => {
    expect((await send("PUT", `${HUB}/students/${kid}`, owner, { tutorUid: ownerUid })).body.tutorUid).toBe(ownerUid);
    const bad = await send("PUT", `${HUB}/students/${kid}`, owner, { tutorUid: "some-stranger" });
    expect(bad.status).toBe(400);
    expect((await send("PUT", `${HUB}/students/${kid}`, owner, { tutorUid: staffUid })).body.tutorUid).toBe(staffUid);
    expect((await send("PUT", `${HUB}/students/${kid}`, owner, { tutorUid: null })).body.tutorUid).toBeNull();
  });

  test("?mine=1 returns only the lessons the caller scheduled; the owner still sees everyone's", async () => {
    const at = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
    const a = await send("POST", `${HUB}/lessons`, staff, { title: `TF staff lesson ${stamp}`, startsAt: at(3), durationMins: 30, childIds: [kid] });
    const b = await send("POST", `${HUB}/lessons`, owner, { title: `TF owner lesson ${stamp}`, startsAt: at(4), durationMins: 30, childIds: [kid] });
    expect([a.status, b.status]).toEqual([201, 201]);
    const staffMine = await lessonsOf(staff, "?mine=1");
    expect(staffMine.some((l) => l.id === a.body.id)).toBe(true);
    expect(staffMine.some((l) => l.id === b.body.id)).toBe(false);
    const ownerMine = await lessonsOf(owner, "?mine=1");
    expect(ownerMine.some((l) => l.id === b.body.id)).toBe(true);
    expect(ownerMine.some((l) => l.id === a.body.id)).toBe(false);
    const ownerAll = await lessonsOf(owner);
    expect(ownerAll.some((l) => l.id === a.body.id) && ownerAll.some((l) => l.id === b.body.id)).toBe(true);
    expect(staffMine.find((l) => l.id === a.body.id)?.tutorUid).toBe(staffUid);
  });
});

test.describe("G1 F14 — weekly repeat, log a lesson already held, attach lessons at creation", () => {
  test("repeatWeeks makes N lessons a week apart at the SAME London wall-clock time across the clocks changing; each cancels on its own", async () => {
    const now = new Date();
    let y = now.getUTCFullYear();
    if (Date.UTC(y, 9, 15, 17, 0) < Date.now() + 86_400_000) y += 1; // 15 Oct 17:00Z: 18:00 BST, and 4 weeks on the clocks have gone back
    const start = new Date(Date.UTC(y, 9, 15, 17, 0)).toISOString();
    const made = await send("POST", `${HUB}/lessons`, tutor, { title: `TF api-weekly ${stamp}`, startsAt: start, durationMins: 45, childIds: [childId], repeatWeeks: 4, timeZone: "Europe/London" });
    expect(made.status).toBe(201);
    const ids = made.body.seriesIds as string[];
    expect(ids).toHaveLength(4);
    const rows = (await lessonsOf(tutor)).filter((l) => l.seriesId && ids.includes(l.id)).sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0));
    expect(rows.map((r) => r.seriesIndex)).toEqual([0, 1, 2, 3]);
    expect(new Set(rows.map((r) => r.seriesId)).size).toBe(1);
    expect(rows.every((r) => r.seriesCount === 4 && r.status === "scheduled")).toBe(true);
    expect(new Set(rows.map((r) => londonHM(r.startsAt)))).toEqual(new Set(["18:00"]));
    expect(rows.map((r) => ymd(new Date(r.startsAt)))).toEqual([0, 7, 14, 21].map((d) => ymd(new Date(Date.parse(start) + d * 86_400_000))));
    // cancel ONE instance → the others are untouched
    expect((await send("PUT", `${HUB}/lessons/${ids[1]}`, tutor, { status: "cancelled" })).status).toBe(200);
    // cancel "this and every later week" from the third
    expect((await send("PUT", `${HUB}/lessons/${ids[2]}`, tutor, { status: "cancelled", applyTo: "following" })).status).toBe(200);
    const after = new Map((await lessonsOf(tutor)).filter((l) => ids.includes(l.id)).map((l) => [l.id, l.status]));
    expect([ids[0], ids[1], ids[2], ids[3]].map((i) => after.get(i!))).toEqual(["scheduled", "cancelled", "cancelled", "cancelled"]);
    // bounds
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: start, durationMins: 45, childIds: [childId], repeatWeeks: 27 })).status).toBe(400);
  });

  test("held: a past lesson is logged with who attended, no room, and can't be joined or reopened", async () => {
    const start = new Date(Date.now() - 26 * 3_600_000).toISOString();
    const made = await send("POST", `${HUB}/lessons`, tutor, { title: `TF api-held ${stamp}`, startsAt: start, durationMins: 60, childIds: [childId], held: true, attendedChildIds: [childId] });
    expect(made.status).toBe(201);
    const row = (await lessonsOf(tutor)).find((l) => l.id === made.body.id)!;
    expect(row.held).toBe(true);
    expect(row.status).toBe("ended");
    expect(row.roomName).toBeNull();
    expect(Object.keys(row.attendance)).toEqual([childId]);
    expect((await send("POST", `${HUB}/lessons/${row.id}/join`, tutor, {})).status).toBe(409);
    expect((await send("POST", `${HUB}/lessons/${row.id}/reopen`, tutor, {})).status).toBe(409);
    // an absent student is not marked present
    const absent = await send("POST", `${HUB}/lessons`, tutor, { title: `TF api-absent ${stamp}`, startsAt: start, durationMins: 60, childIds: [childId], held: true, attendedChildIds: [] });
    expect(Object.keys((await lessonsOf(tutor)).find((l) => l.id === absent.body.id)!.attendance)).toEqual([]);
    // guards: it must be over, not weekly, name only its own students; and an ordinary past lesson is still refused
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: future, durationMins: 60, childIds: [childId], held: true })).status).toBe(400);
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: start, durationMins: 60, childIds: [childId], held: true, repeatWeeks: 3 })).status).toBe(400);
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: start, durationMins: 60, childIds: [childId], held: true, attendedChildIds: ["someone-else"] })).status).toBe(400);
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: start, durationMins: 60, childIds: [childId] })).status).toBe(400);
  });

  test("noteIds attach lessons at creation (and a foreign / unknown lesson is refused)", async () => {
    const note = (await apiPost<{ id: string }>(`${HUB}/notes`, tutor, { topicId: ids.tMaths, title: `TF attach ${stamp}`, body: "b", published: true })).id;
    const start = new Date(Date.now() + 6 * 86_400_000).toISOString();
    const made = await send("POST", `${HUB}/lessons`, tutor, { title: `TF attach lesson ${stamp}`, startsAt: start, durationMins: 30, childIds: [childId], noteIds: [note] });
    expect(made.status).toBe(201);
    expect((await lessonsOf(tutor)).find((l) => l.id === made.body.id)?.noteIds).toEqual([note]);
    expect((await send("POST", `${HUB}/lessons`, tutor, { title: "x", startsAt: start, durationMins: 30, childIds: [childId], noteIds: ["not-a-note"] })).status).toBe(404);
  });
});

test.describe("G1 screens — schedule weekly, log a held lesson, invite a family, the enable card", () => {
  async function pageAs(browser: Browser, role: "freelancer" | "parent") {
    const ctx = await browser.newContext({ storageState: statePath(role) });
    if (envApi && envApi !== API_URL) {
      const origin = new URL(envApi).origin;
      await ctx.route((u) => u.origin === origin, async (route) => {
        const url = route.request().url().replace(origin, API_URL);
        if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
        try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
      });
    }
    return { ctx, page: await ctx.newPage() };
  }

  test("F14: the form schedules a weekly series and logs a lesson already held (Past, with attendance)", async ({ browser }) => {
    test.setTimeout(300_000);
    const { ctx, page } = await pageAs(browser, "freelancer");
    await gotoHub(page, "live");
    // ── weekly repeat ──
    await page.locator("#hub-schedule-lesson").click();
    let dlg = page.locator("#hub-lesson-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await dlg.locator("#hub-lesson-title").fill(repTitle);
    await dlg.locator(`#hub-lesson-student-${childId}`).click();
    await dlg.locator("#hub-lesson-repeat").check();
    await dlg.locator("#hub-lesson-weeks").fill("3");
    await expect(dlg.getByTestId("hub-lesson-repeat-summary")).toBeVisible();
    await dlg.getByRole("button", { name: "Schedule 3 weekly lessons" }).click();
    await expect(dlg).toHaveCount(0, { timeout: 30_000 });
    const series = (await lessonsOf(tutor)).filter((l) => l.title === repTitle);
    expect(series).toHaveLength(3); // the server made them, one week apart
    await expect(cardWith(page, repTitle, "Weekly 2 of 3")).toBeVisible({ timeout: 30_000 });
    await expect(cardWith(page, repTitle, "Weekly 3 of 3")).toBeVisible();
    // ── log a lesson already held ──
    await page.locator("#hub-schedule-lesson").click();
    dlg = page.locator("#hub-lesson-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await dlg.getByTestId("hub-lesson-mode-held").click();
    await dlg.locator("#hub-lesson-title").fill(heldTitle);
    await dlg.locator(`#hub-lesson-student-${childId}`).click();
    await expect(dlg.getByTestId(`hub-lesson-attended-${childId}`)).toHaveAttribute("aria-pressed", "true");
    await dlg.getByRole("button", { name: "Log lesson" }).click();
    await expect(dlg).toHaveCount(0, { timeout: 30_000 });
    const held = (await lessonsOf(tutor)).find((l) => l.title === heldTitle)!;
    expect(held.held).toBe(true);
    expect(Object.keys(held.attendance)).toEqual([childId]);
    await page.getByRole("tab", { name: /^Past/ }).click();
    const card = cardWith(page, heldTitle, "Logged after the fact");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("Attended 1 of 1");
    await expect(card.getByRole("button", { name: /Reopen/ })).toHaveCount(0);
    await ctx.close();
  });

  test("F13: the tutor makes an invite link; the parent opens it and enrols their own child (through the screens)", async ({ browser }) => {
    test.setTimeout(300_000);
    const kid2 = await createParentChild(accounts.parent, { name: uiKid });
    const t = await pageAs(browser, "freelancer");
    await gotoHub(t.page, "students");
    await t.page.getByRole("button", { name: /Enrol a student|Enrol your first student/ }).first().click();
    const box = t.page.getByTestId("hub-family-invite");
    await expect(box).toBeVisible({ timeout: 30_000 });
    await box.getByLabel("Who is it for (optional)").fill(`UI Fam ${stamp}`);
    await box.getByTestId("hub-family-invite-create").click();
    const url = await box.getByTestId("hub-family-invite-link").getByLabel("Invite link").inputValue();
    expect(url).toContain("/custdash/learninghub?invite=");
    const invites = (await raw(`${HUB}/family-invites`, tutor)).body as unknown as { forName: string; status: string }[];
    expect(invites.find((i) => i.forName === `UI Fam ${stamp}`)?.status).toBe("pending");
    await t.ctx.close();

    const p = await pageAs(browser, "parent");
    const u = new URL(url);
    await p.page.goto(`${u.pathname}${u.search}`);
    const claim = p.page.locator("#hub-family-invite-claim");
    await expect(claim).toBeVisible({ timeout: 60_000 });
    await p.page.getByTestId(`hub-invite-enrol-${kid2}`).click();
    await expect(p.page.getByTestId(`hub-invite-enrolled-${kid2}`)).toBeVisible({ timeout: 30_000 });
    const row = ((await raw(`${HUB}/students`, tutor)).body as unknown as { childId: string; active: boolean }[]).find((r) => r.childId === kid2);
    expect(row?.active).toBe(true);
    await p.ctx.close();
  });

  test("F18: while the Learning Hub is off the dashboard offers to turn it on — and that turns it on", async ({ browser }) => {
    test.setTimeout(240_000);
    await setHub(accounts.freelancer, false);
    const { ctx, page } = await pageAs(browser, "freelancer");
    await page.goto("/freelancer/dash");
    const card = page.getByTestId("enable-hub-card");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.getByTestId("enable-hub-turn-on").click();
    await expect(card).toHaveCount(0, { timeout: 30_000 });
    // The card hides optimistically; useSettings then debounces the PUT (~500ms) — so poll the stored value, don't read it once.
    await expect.poll(async () => ((await apiFetch<Lib | null>("/api/library", tutor)) ?? {}).settings?.features?.learninghub, { timeout: 15_000 }).toBe(true);
    await ctx.close();
  });
});
