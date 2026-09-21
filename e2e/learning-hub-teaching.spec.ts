import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — the teaching side: homework & marking, flashcards & spaced
// repetition, live lessons (private Daily rooms), family notifications, tenant
// isolation and the privacy export / child-delete cascade. API level (like
// learning-hub.spec.ts): the freelancer is the tutor, the standing parent the
// family, the company account a DIFFERENT provider.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let tutor = "", parent = "", other = "";
let tenantId = "";
let child1 = "", child2 = "";
let topicId = "";
const q = () => `?tenantId=${tenantId}`;
const qc = (c: string) => `?tenantId=${tenantId}&childId=${c}`;
const HUB = "/api/learning-hub";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type Body = Record<string, unknown> & { error?: unknown; code?: string };
/** The dev API hot-reloads (tsx watch) whenever anyone saves a server file — ride out a restart. */
async function retryNet<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 5 || !(e instanceof TypeError)) throw e; // only network failures ("fetch failed"), never an HTTP answer
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
async function raw(p: string, idToken: string, init?: RequestInit) {
  const res = await retryNet(() => fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }));
  const text = await res.text();
  let body: unknown = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: body as Body, text };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const get = async <T,>(p: string, t: string) => retryNet(() => apiFetch<T>(p, t));

interface Notif { title: string; category: string; body: string }
async function bell(idToken: string) { return (await get<{ notifications: Notif[] }>("/api/notifications", idToken)).notifications; }
/** The family's bell should get a `learning` alert with this title (it is raised in the background, so poll). */
async function expectBell(title: string, containing?: string) {
  await expect.poll(async () => (await bell(parent)).some((n) => n.category === "learning" && n.title === title && (!containing || n.body.includes(containing))), { timeout: 20_000 }).toBe(true);
}

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const FAKE_PNG = `data:image/png;base64,${Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").toString("base64")}`;
const FAKE_PDF = `data:application/pdf;base64,${Buffer.from("<html>not a pdf</html>").toString("base64")}`;
const GOOD_PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n").toString("base64")}`;

const dailyKey = () => {
  const p = path.join(ROOT, "server", ".env");
  const line = fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").find((l) => l.startsWith("DAILY_API_KEY=")) : undefined;
  return (process.env.DAILY_API_KEY || line?.slice("DAILY_API_KEY=".length).trim().replace(/^["']|["']$/g, "")) ?? "";
};
const dailyRoom = (name: string) => fetch(`https://api.daily.co/v1/rooms/${name}`, { headers: { Authorization: `Bearer ${dailyKey()}` } });

interface Hw { id: string; title: string; assignedChildIds: string[]; counts: { assigned: number; submitted: number; marked: number } }
interface FamilyHw { id: string; childId: string; title: string; submission: { id: string; status: string; text: string; attachments: { id: string; url: string }[]; mark: Record<string, unknown> | null; attemptId: string | null } }
interface Lesson { id: string; status: string; joinable: boolean; roomName?: string | null; attendance?: Record<string, string>; students: { childId: string }[]; childIds: string[] }

let hw1 = "", hw2 = "";
let cardA = "", cardB = "", cardDraft = "";
let l1 = "", l2 = "";

test.beforeAll(async () => {
  test.setTimeout(180_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 }); // "follow" needs the provider to publish something
  child1 = await createParentChild(accounts.parent, { name: `Teachkid ${stamp}` });
  child2 = await createParentChild(accounts.parent, { name: `Teachsib ${stamp}` });
  // The family reaches a provider by following it (no booking needed — and a booking would
  // clash with the standing parent's other sessions); an enrolment then opens the hub.
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId });
  await markParentWelcomed(accounts.parent);
  [tutor, parent, other] = await Promise.all([token(accounts.freelancer), token(accounts.parent), token(accounts.company)]);
  for (const c of [child1, child2]) expect((await send("POST", `${HUB}/students`, tutor, { childId: c })).status).toBe(201);
  const t = await send("POST", `${HUB}/topics`, tutor, { subject: `Teach ${stamp}`, topic: "Fractions" });
  expect(t.status).toBe(201);
  topicId = t.body.id as string;
});
// Other Learning Hub specs flip the same standing accounts' hub switch while they run;
// make sure it is on before each test rather than trusting the start of the file.
test.beforeEach(async () => {
  for (const a of [accounts.freelancer, accounts.company]) {
    const lib = await get<Lib | null>("/api/library", (await fbSignIn(a.email)).idToken);
    if (lib?.settings?.features?.learninghub !== true) await setHub(a, true);
  }
});
test.afterAll(async () => {
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});

test.describe("homework: assign → hand in → mark", () => {
  test("only enrolled students can be assigned; bad references are refused", async () => {
    const body = { title: `Bad ${stamp}`, instructions: "x", noteIds: [], assignedChildIds: [child1, "not-a-real-child"] };
    expect((await send("POST", `${HUB}/homework`, tutor, body)).status).toBe(404);
    expect((await send("POST", `${HUB}/homework`, tutor, { ...body, assignedChildIds: [child1], assessmentId: "nope" })).status).toBe(404);
    expect((await send("POST", `${HUB}/homework`, tutor, { ...body, assignedChildIds: [child1], noteIds: ["nope"] })).status).toBe(404);
    expect((await send("POST", `${HUB}/homework`, tutor, { ...body, assignedChildIds: [child1], dueAt: "not a date" })).status).toBe(400);
    expect((await send("POST", `${HUB}/homework`, tutor, { ...body, assignedChildIds: [] })).status).toBe(400);
    // …and a family can't set homework.
    expect((await send("POST", `${HUB}/homework${q()}`, parent, { ...body, assignedChildIds: [child1] })).status).toBe(403);
    // Nothing above left a stray row behind.
    expect((await get<Hw[]>(`${HUB}/homework`, tutor)).some((h) => h.title === `Bad ${stamp}`)).toBe(false);
  });

  test("assigning creates one submission per child, and the family is told", async () => {
    const r = await send("POST", `${HUB}/homework`, tutor, { title: `Fractions sheet ${stamp}`, instructions: "Do questions 1-10", assignedChildIds: [child1], dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
    expect(r.status).toBe(201);
    hw1 = r.body.id as string;
    expect((r.body.counts as Hw["counts"]).assigned).toBe(1);
    await expectBell("New homework", `Fractions sheet ${stamp}`);
    const inbox = await get<{ homeworkId: string; status: string; childName: string }[]>(`${HUB}/homework/inbox?status=assigned`, tutor);
    expect(inbox.find((x) => x.homeworkId === hw1)).toMatchObject({ status: "assigned", childName: `Teachkid ${stamp}` });
  });

  test("a family sees ONLY their own enrolled child's rows, never an email", async () => {
    const rows = await get<FamilyHw[]>(`${HUB}/homework${qc(child1)}`, parent);
    const mine = rows.find((x) => x.id === hw1)!;
    expect(mine.childId).toBe(child1);
    expect(mine.submission.status).toBe("assigned");
    // The sibling wasn't assigned this — filtering to them shows nothing of it…
    expect((await get<FamilyHw[]>(`${HUB}/homework${qc(child2)}`, parent)).some((x) => x.id === hw1)).toBe(false);
    // …a child that isn't theirs / isn't enrolled is a 404, not an empty list…
    expect((await raw(`${HUB}/homework${qc("someone-elses-child")}`, parent)).status).toBe(404);
    // …and no parent email leaks anywhere in what the family receives.
    const all = await raw(`${HUB}/homework${q()}`, parent);
    expect(all.text.toLowerCase()).not.toContain(accounts.parent.email.toLowerCase());
    expect(all.text).not.toContain("@");
  });

  test("uploads: the same validation as /api/uploads, and only for the family's own hand-in", async () => {
    const sid = `${hw1}__${child1}`;
    const up = (dataUrl: string, name = "work") => send("POST", `${HUB}/submissions/${sid}/files${qc(child1)}`, parent, { dataUrl, name });
    expect((await up(FAKE_PNG)).status).toBe(400);                        // magic bytes don't match the declared image type
    expect((await up(FAKE_PDF)).status).toBe(400);                        // not really a PDF
    expect((await up("data:text/html;base64,PGI+")).status).toBe(400);    // wrong type altogether
    expect((await send("POST", `${HUB}/submissions/${sid}/files${qc(child1)}`, parent, { dataUrl: PNG_1PX })).status).toBe(400); // no name
    expect((await send("POST", `${HUB}/submissions/${sid}/files`, tutor, { dataUrl: PNG_1PX, name: "x" })).status).toBe(403);      // tutors use /api/uploads
    expect((await send("POST", `${HUB}/submissions/${hw1}__${child2}/files${qc(child2)}`, parent, { dataUrl: PNG_1PX, name: "x" })).status).toBe(404); // no submission for that child
    expect((await send("POST", `${HUB}/submissions/${sid}/files${qc(child2)}`, parent, { dataUrl: PNG_1PX, name: "x" })).status).toBe(404); // someone else's submission id
    const ok = await up(PNG_1PX, "photo.png");
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ name: "photo.png", contentType: "image/png" });
    expect((await up(GOOD_PDF, "sheet.pdf")).status).toBe(201);
  });

  test("hand-in: needs content, verifies files and the linked attempt, then lands in the inbox", async () => {
    const sid = `${hw1}__${child1}`;
    const submit = (b: unknown) => send("POST", `${HUB}/submissions/${sid}/submit${qc(child1)}`, parent, b);
    expect((await submit({})).status).toBe(400);                                  // nothing to hand in
    expect((await submit({ attemptId: "nope" })).status).toBe(404);               // not an attempt of this child
    // A private hub file the TUTOR uploaded isn't the family's to attach…
    const tutorFile = await send("POST", "/api/uploads", tutor, { dataUrl: PNG_1PX, purpose: "private", kind: "hub" });
    expect((await submit({ text: "x", attachments: [{ id: tutorFile.body.id, name: "resource.png" }] })).status).toBe(400);
    // …nor is an arbitrary id.
    expect((await submit({ text: "x", attachments: [{ id: "does-not-exist", name: "f" }] })).status).toBe(400);

    const files = (await get<FamilyHw[]>(`${HUB}/homework${qc(child1)}`, parent)).find((x) => x.id === hw1)!;
    expect(files.submission.attachments).toHaveLength(0); // uploads alone attach nothing
    const up = await send("POST", `${HUB}/submissions/${sid}/files${qc(child1)}`, parent, { dataUrl: PNG_1PX, name: "working.png" });
    const done = await submit({ text: "Q1 = 1/2, Q2 = 3/4", attachments: [{ id: up.body.id, name: "working.png" }] });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("submitted");
    const mine = (await get<FamilyHw[]>(`${HUB}/homework${qc(child1)}`, parent)).find((x) => x.id === hw1)!;
    expect(mine.submission.text).toContain("Q2 = 3/4");
    expect(mine.submission.attachments).toHaveLength(1);
    expect(mine.submission.attachments[0].url).toMatch(/\/api\/images\/.+sig=/); // a signed, expiring link
    // Tutor side.
    const inbox = await get<{ homeworkId: string; status: string; text: string; submittedAt: string; attemptPending: boolean }[]>(`${HUB}/homework/inbox?status=submitted`, tutor);
    const row = inbox.find((x) => x.homeworkId === hw1)!;
    expect(row).toMatchObject({ status: "submitted", attemptPending: false });
    expect(row.text).toContain("Q1 = 1/2");
    // Only a family hands in.
    expect((await send("POST", `${HUB}/submissions/${sid}/submit`, tutor, { text: "x" })).status).toBe(403);
  });

  test("marking: validated, tutor-only, tenant-scoped; the family sees the result and is told", async () => {
    const sid = `${hw1}__${child1}`;
    expect((await send("PUT", `${HUB}/submissions/${sid}/mark`, tutor, { score: 11, max: 10, feedback: "" })).status).toBe(400);
    expect((await send("PUT", `${HUB}/submissions/${sid}/mark`, tutor, { score: 5, max: 0 })).status).toBe(400);
    expect((await send("PUT", `${HUB}/submissions/${sid}/mark${qc(child1)}`, parent, { score: 10, max: 10 })).status).toBe(403);
    expect((await send("PUT", `${HUB}/submissions/${sid}/mark`, other, { score: 10, max: 10 })).status).toBe(404); // another provider's tutor
    const r = await send("PUT", `${HUB}/submissions/${sid}/mark`, tutor, { score: 8, max: 10, feedback: "Nice — check Q4" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("marked");
    const mine = (await get<FamilyHw[]>(`${HUB}/homework${qc(child1)}`, parent)).find((x) => x.id === hw1)!;
    expect(mine.submission.status).toBe("marked");
    expect(mine.submission.mark).toMatchObject({ score: 8, max: 10, feedback: "Nice — check Q4" });
    expect(mine.submission.mark).not.toHaveProperty("markedBy"); // no tutor uid to the family
    await expectBell("Homework marked", `Fractions sheet ${stamp}`);
    expect((await get<{ homeworkId: string }[]>(`${HUB}/homework/inbox?status=marked`, tutor)).some((x) => x.homeworkId === hw1)).toBe(true);
    // Marked = final for the family.
    expect((await send("POST", `${HUB}/submissions/${sid}/submit${qc(child1)}`, parent, { text: "changed my mind" })).status).toBe(409);
    expect((await send("POST", `${HUB}/submissions/${sid}/files${qc(child1)}`, parent, { dataUrl: PNG_1PX, name: "late.png" })).status).toBe(409);
  });

  test("editing the assignment: add a child, drop an untouched one, keep a handed-in one", async () => {
    const put = (ids: string[]) => send("PUT", `${HUB}/homework/${hw1}`, tutor, { assignedChildIds: ids });
    expect((await put([child1, child2])).status).toBe(200);
    expect((await get<FamilyHw[]>(`${HUB}/homework${qc(child2)}`, parent)).some((x) => x.id === hw1 && x.submission.status === "assigned")).toBe(true);
    // Asking for ONLY child2 can't take child1's marked work away…
    const swapped = await put([child2]);
    expect(swapped.status).toBe(200);
    expect((swapped.body.assignedChildIds as string[]).sort()).toEqual([child1, child2].sort());
    expect((await get<FamilyHw[]>(`${HUB}/homework${qc(child1)}`, parent)).find((x) => x.id === hw1)!.submission.status).toBe("marked");
    // …while dropping child2 (still just "assigned") removes their row.
    const dropped = await put([child1]);
    expect(dropped.status).toBe(200);
    expect(dropped.body.assignedChildIds).toEqual([child1]);
    expect((await get<FamilyHw[]>(`${HUB}/homework${qc(child2)}`, parent)).some((x) => x.id === hw1)).toBe(false);
    expect((await send("PUT", `${HUB}/homework/${hw1}`, tutor, { assignedChildIds: [] })).status).toBe(400);
    expect((await send("PUT", `${HUB}/homework/${hw1}`, tutor, { assignedChildIds: [child1, "stranger"] })).status).toBe(404);
    // The sibling gets homework of their own (used by the delete-cascade test below).
    const r = await send("POST", `${HUB}/homework`, tutor, { title: `Sibling sheet ${stamp}`, assignedChildIds: [child2] });
    expect(r.status).toBe(201);
    hw2 = r.body.id as string;
    // Default due date came from settings.hub.homeworkDueDays.
    expect(new Date(r.body.dueAt as string).getTime()).toBeGreaterThan(Date.now() + 86_400_000);
  });
});

test.describe("flashcards: SM-2 spaced repetition", () => {
  test("tutor writes cards; a family's queue is published + new only", async () => {
    const mk = async (front: string, published = true) => (await send("POST", `${HUB}/flashcards`, tutor, { topicId, front, back: `${front} — answer`, published })).body.id as string;
    cardA = await mk(`1/2 + 1/4 ${stamp}`);
    cardB = await mk(`1/3 + 1/6 ${stamp}`);
    cardDraft = await mk(`draft card ${stamp}`, false);
    expect((await send("POST", `${HUB}/flashcards`, tutor, { topicId: "nope", front: "x", back: "y" })).status).toBe(404);
    expect((await send("POST", `${HUB}/flashcards${q()}`, parent, { topicId, front: "x", back: "y" })).status).toBe(403);
    const due = await get<{ due: { id: string; front: string; back: string; isNew: boolean }[]; dueCount: number; newCount: number; upcoming: number }>(`${HUB}/flashcards/due${qc(child1)}&topicId=${topicId}`, parent);
    expect(due.due.map((c) => c.id).sort()).toEqual([cardA, cardB].sort());
    expect(due.due.every((c) => c.isNew && c.back)).toBe(true);
    expect(due).toMatchObject({ dueCount: 0, newCount: 2, upcoming: 0 });
    expect(due.due.some((c) => c.id === cardDraft)).toBe(false);
    // Several enrolled children and no ?childId → the server asks which.
    expect((await raw(`${HUB}/flashcards/due${q()}`, parent)).status).toBe(400);
    // A tutor's deck listing includes the draft; a family can't read it.
    expect((await get<{ id: string }[]>(`${HUB}/flashcards?topicId=${topicId}`, tutor)).map((c) => c.id)).toContain(cardDraft);
    expect((await raw(`${HUB}/flashcards${q()}`, parent)).status).toBe(403);
  });

  test("first review sets a 1-day interval; reviewing a card that is not due yet changes nothing; the queue reflects it", async () => {
    const review = (card: string, quality: unknown, child = child1) => send("POST", `${HUB}/flashcards/${card}/review${qc(child)}`, parent, { childId: child, quality });
    expect((await review(cardA, 2)).status).toBe(400);
    expect((await review(cardA, "4")).status).toBe(400);
    expect((await review(cardA, 0)).status).toBe(400);
    expect((await review(cardDraft, 4)).status).toBe(404);                                       // a draft isn't the family's to review
    expect((await send("POST", `${HUB}/flashcards/${cardA}/review${q()}`, parent, { childId: "someone-elses-child", quality: 4 })).status).toBe(404);
    expect((await send("POST", `${HUB}/flashcards/${cardA}/review${qc(child1)}`, parent, { childId: child2, quality: 4 })).status).toBe(400); // two students named
    expect((await send("POST", `${HUB}/flashcards/${cardA}/review`, tutor, { childId: child1, quality: 4 })).status).toBe(403);
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await review(cardA, 4);
      expect(r.status).toBe(200);
      seen.push(r.body.intervalDays as number);
      const days = (new Date(r.body.nextDueAt as string).getTime() - Date.now()) / 86_400_000;
      expect(Math.abs(days - (r.body.intervalDays as number))).toBeLessThan(0.05);
    }
    // Only the FIRST review counts: a card that isn't due yet keeps its schedule, so double-taps and
    // cramming can't stretch an interval or inflate "mastered" (the 1→6→15 progression itself is
    // covered by the pure SM-2 self-test, server/src/hubSelfTest2.ts — it needs the clock to move).
    expect(seen).toEqual([1, 1, 1]);
    const again = await review(cardA, 1);
    expect(again.body).toMatchObject({ intervalDays: 1, repetitions: 1 });
    const easy = await review(cardB, 5);
    expect(easy.body).toMatchObject({ intervalDays: 1, easeFactor: 2.6 });

    // Both reviewed for tomorrow → nothing due today, both counted as upcoming.
    const due = await get<{ due: unknown[]; dueCount: number; newCount: number; upcoming: number }>(`${HUB}/flashcards/due${qc(child1)}&topicId=${topicId}`, parent);
    expect(due).toMatchObject({ due: [], dueCount: 0, newCount: 0, upcoming: 2 });
    // The sibling's queue is untouched by child1's reviews.
    const sib = await get<{ newCount: number }>(`${HUB}/flashcards/due${qc(child2)}&topicId=${topicId}`, parent);
    expect(sib.newCount).toBe(2);
    expect((await review(cardB, 4, child2)).status).toBe(200); // (child2 has learning data now, for the delete-cascade test)
  });

  test("tutor stats show each student's progress", async () => {
    const s = await get<{ totalCards: number; publishedCards: number; students: { childId: string; reviewed: number; new: number; due: number }[]; topics: { topicId: string; cards: number }[] }>(`${HUB}/flashcards/stats`, tutor);
    expect(s.topics.find((t) => t.topicId === topicId)!.cards).toBe(3);
    expect(s.totalCards).toBeGreaterThanOrEqual(3);
    expect(s.students.find((x) => x.childId === child1)).toMatchObject({ reviewed: 2, due: 0 }); // (`new` also counts the standing tutor's cards from earlier runs)
    expect((await raw(`${HUB}/flashcards/stats${q()}`, parent)).status).toBe(403);
  });
});

test.describe("live lessons", () => {
  test("scheduling is validated; enrolled students only; families are told", async () => {
    const body = { title: `Fractions live ${stamp}`, topicId, durationMins: 60, childIds: [child1], notes: "Bring your sheet" };
    const now = Date.now();
    expect((await send("POST", `${HUB}/lessons`, tutor, { ...body, startsAt: "2026-03-10" })).status).toBe(400);                         // a date without a time
    expect((await send("POST", `${HUB}/lessons`, tutor, { ...body, startsAt: new Date(now - 5 * 3600_000).toISOString() })).status).toBe(400); // already finished
    expect((await send("POST", `${HUB}/lessons`, tutor, { ...body, startsAt: new Date(now).toISOString(), childIds: ["stranger"] })).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons`, tutor, { ...body, startsAt: new Date(now).toISOString(), topicId: "nope" })).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons${q()}`, parent, { ...body, startsAt: new Date(now).toISOString() })).status).toBe(403);
    const a = await send("POST", `${HUB}/lessons`, tutor, { ...body, startsAt: new Date(now - 5 * 60_000).toISOString() });
    expect(a.status).toBe(201);
    l1 = a.body.id as string;
    expect(a.body).toMatchObject({ status: "scheduled", joinable: true });
    const b = await send("POST", `${HUB}/lessons`, tutor, { ...body, title: `Later ${stamp}`, startsAt: new Date(now + 3 * 86_400_000).toISOString() });
    expect(b.status).toBe(201);
    l2 = b.body.id as string;
    expect(b.body.joinable).toBe(false);
    await expectBell("Live lesson scheduled", `Fractions live ${stamp}`);
  });

  test("the join window is enforced for tutor and family alike", async () => {
    for (const [who, t, query] of [["tutor", tutor, ""], ["family", parent, qc(child1)]] as const) {
      const r = await send("POST", `${HUB}/lessons/${l2}/join${query}`, t, {});
      expect(r.status, who).toBe(409);
      expect(r.body.code, who).toBe("outside_join_window");
      expect(r.body.state, who).toBe("early");
      expect(new Date(r.body.opensAt as string).getTime()).toBeLessThan(new Date(r.body.closesAt as string).getTime());
      expect(r.body).not.toHaveProperty("token");
    }
  });

  test("inside the window: tokens for the tutor (owner) and the enrolled family only", async () => {
    // Not the family's lesson (child2 isn't in it), not this provider's (other tenant) → 404 — no token.
    expect((await send("POST", `${HUB}/lessons/${l1}/join${qc(child2)}`, parent, {})).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${l1}/join`, other, {})).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${l1}/join?tenantId=not-a-tenant`, parent, {})).status).toBe(404);

    const fam = await send("POST", `${HUB}/lessons/${l1}/join${qc(child1)}`, parent, {});
    expect(fam.status, JSON.stringify(fam.body)).toBe(200);
    expect(fam.body.isOwner).toBe(false);
    expect(fam.body.userName).toBe("Teachkid");             // first name only on the call
    expect(String(fam.body.token).split(".")).toHaveLength(3);
    const tut = await send("POST", `${HUB}/lessons/${l1}/join`, tutor, {});
    expect(tut.status, JSON.stringify(tut.body)).toBe(200);
    expect(tut.body.isOwner).toBe(true);
    expect(tut.body.token).not.toBe(fam.body.token);
    expect(tut.body.roomName).toBe(fam.body.roomName);       // one shared room
    expect(String(tut.body.url)).toContain(String(tut.body.roomName));
    expect(String(tut.body.url)).not.toContain(String(tut.body.token)); // the URL alone carries no credential

    // The room really is private and expiring — asked of Daily itself.
    if (dailyKey()) {
      const room = (await (await dailyRoom(tut.body.roomName as string)).json()) as { privacy: string; config: { exp?: number } };
      expect(room.privacy).toBe("private");
      expect(room.config.exp).toBeGreaterThan(Date.now() / 1000);
    }
    // Live for the tutor. A minted token is NOT attendance (nobody has connected yet)…
    const before = (await get<Lesson[]>(`${HUB}/lessons`, tutor)).find((x) => x.id === l1)!;
    expect(before.status).toBe("live");
    expect(Object.keys(before.attendance ?? {})).toEqual([]);
    // …the family's client confirms it once Daily says it joined; recorded against THEIR child only, idempotent, and not for a stranger's child.
    expect((await send("POST", `${HUB}/lessons/${l1}/attended${qc(child2)}`, parent, {})).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${l1}/attended${qc(child1)}`, parent, {})).status).toBe(200);
    expect((await send("POST", `${HUB}/lessons/${l1}/attended${qc(child1)}`, parent, {})).status).toBe(200);
    const mine = (await get<Lesson[]>(`${HUB}/lessons`, tutor)).find((x) => x.id === l1)!;
    expect(Object.keys(mine.attendance ?? {})).toEqual([child1]);
    expect(mine.roomName).toBe(tut.body.roomName);
  });

  test("what a family sees of a lesson: their own child, no room, no other family's data", async () => {
    const rows = await get<Lesson[]>(`${HUB}/lessons${q()}`, parent);
    const row = rows.find((x) => x.id === l1)!;
    expect(row.childIds).toEqual([child1]);
    expect(row).not.toHaveProperty("roomName");
    expect(row).not.toHaveProperty("attendance");
    expect(row).toMatchObject({ attended: true });
    // Filtering to the sibling (not in either lesson) shows neither.
    expect(await get<Lesson[]>(`${HUB}/lessons${qc(child2)}`, parent)).toEqual([]);
    // Another provider's tutor sees none of this provider's lessons.
    expect((await get<Lesson[]>(`${HUB}/lessons`, other)).some((x) => x.id === l1 || x.id === l2)).toBe(false);
  });

  test("End disconnects everyone but locks nobody out; 'stay on the call' extends the room; cancelling closes it for good", async () => {
    const room = (await get<Lesson[]>(`${HUB}/lessons`, tutor)).find((x) => x.id === l1)!.roomName!;
    const ended = await send("POST", `${HUB}/lessons/${l1}/end`, tutor);
    expect(ended.status).toBe(200);
    expect(ended.body.status).toBe("ended");
    if (dailyKey()) await expect.poll(async () => (await dailyRoom(room)).status, { timeout: 20_000 }).toBe(404); // the room is torn down…

    // …but "ended" is not a lock-out for the TUTOR, who can come straight back in until the window closes. Safeguarding: a FAMILY can
    // neither recreate the room nor "Stay" while no tutor is in it (children must never be left in a room with no tutor)…
    const famBlocked = await send("POST", `${HUB}/lessons/${l1}/join${qc(child1)}`, parent, {});
    expect(famBlocked.status, JSON.stringify(famBlocked.body)).toBe(409);
    expect(famBlocked.body.code).toBe("waiting_for_tutor");
    expect(famBlocked.body).not.toHaveProperty("token");
    expect((await send("POST", `${HUB}/lessons/${l1}/extend${qc(child1)}`, parent, {})).body.code).toBe("waiting_for_tutor");
    expect((await get<Lesson[]>(`${HUB}/lessons${q()}`, parent)).find((x) => x.id === l1)).toMatchObject({ waitingForTutor: true });
    if (dailyKey()) expect((await dailyRoom(room)).status).toBe(404); // and no room came back
    const tutBack = await send("POST", `${HUB}/lessons/${l1}/join`, tutor, {});
    expect(tutBack.status, JSON.stringify(tutBack.body)).toBe(200);
    // …once the tutor is back the family walks straight in again.
    const famBack = await send("POST", `${HUB}/lessons/${l1}/join${qc(child1)}`, parent, {});
    expect(famBack.status, JSON.stringify(famBack.body)).toBe(200);
    expect((await get<Lesson[]>(`${HUB}/lessons${q()}`, parent)).find((x) => x.id === l1)).toMatchObject({ waitingForTutor: false });
    expect(typeof tutBack.body.roomExpiresAt).toBe("string");
    expect(tutBack.body.promptSeconds).toBe(120);
    expect((await get<Lesson[]>(`${HUB}/lessons`, tutor)).find((x) => x.id === l1)!.status).toBe("live"); // re-entering re-opened it

    // "Stay on the call": either side can push the room's closing time on by 15 minutes for everyone.
    const before = new Date(tutBack.body.roomExpiresAt as string).getTime();
    const stay = await send("POST", `${HUB}/lessons/${l1}/extend${qc(child1)}`, parent, {});
    expect(stay.status, JSON.stringify(stay.body)).toBe(200);
    const after = new Date(stay.body.roomExpiresAt as string).getTime();
    expect(after).toBeGreaterThan(before);
    expect((await send("POST", `${HUB}/lessons/${l1}/extend`, tutor, {})).status).toBe(200);
    // Not your lesson → 404, whichever side you're on.
    expect((await send("POST", `${HUB}/lessons/${l1}/extend${qc(child2)}`, parent, {})).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${l1}/extend`, other, {})).status).toBe(404);

    const cancelled = await send("PUT", `${HUB}/lessons/${l2}`, tutor, { status: "cancelled" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    expect((await send("POST", `${HUB}/lessons/${l2}/join${qc(child1)}`, parent, {})).body.code).toBe("lesson_closed");
    await expectBell("Live lesson cancelled", `Later ${stamp}`);
    expect((await send("DELETE", `${HUB}/lessons/${l2}`, tutor)).status).toBe(200);
  });
});

test.describe("notifications", () => {
  test("a published note tells the family; a draft doesn't; the category can be muted", async () => {
    const pub = await send("POST", `${HUB}/notes`, tutor, { topicId, title: `Adding fractions ${stamp}`, body: "…", published: true, attachments: [] });
    expect(pub.status).toBe(201);
    await send("POST", `${HUB}/notes`, tutor, { topicId, title: `Secret draft ${stamp}`, body: "…", published: false, attachments: [] });
    await expectBell("New lesson shared", `Adding fractions ${stamp}`);
    await new Promise((r) => setTimeout(r, 2500)); // give a (wrongly) fired draft alert time to appear
    expect((await bell(parent)).some((n) => n.body.includes(`Secret draft ${stamp}`))).toBe(false);
    // Parents can mute the new `learning` category (bell stays, email stops).
    const on = await send("PUT", "/api/notifications/prefs", parent, { category: "learning", muted: true });
    expect(on.status).toBe(200);
    expect((on.body.muted as Record<string, boolean>).learning).toBe(true);
    expect((await send("PUT", "/api/notifications/prefs", parent, { category: "learning", muted: false })).status).toBe(200);
    // Every alert carries the deep link into the family's hub.
    const n = (await bell(parent)).find((x) => x.category === "learning") as (Notif & { href?: string }) | undefined;
    expect(n?.href).toMatch(/^\/custdash\/learninghub(\?|$)/); // may carry ?tab=…&child=…&open=… (family/link.ts)
  });
});

test.describe("tenant isolation", () => {
  test("another provider can neither see nor touch any of it — foreign ids are 404", async () => {
    const t2 = other;
    for (const list of ["homework", "homework/inbox", "flashcards", "lessons"]) {
      const rows = await get<{ id?: string; homeworkId?: string; title?: string }[]>(`${HUB}/${list}`, t2);
      expect(JSON.stringify(rows)).not.toContain(stamp);
    }
    expect((await send("PUT", `${HUB}/homework/${hw1}`, t2, { title: "hijack" })).status).toBe(404);
    expect((await send("DELETE", `${HUB}/homework/${hw1}`, t2)).status).toBe(404);
    expect((await send("PUT", `${HUB}/flashcards/${cardA}`, t2, { front: "hijack" })).status).toBe(404);
    expect((await send("DELETE", `${HUB}/flashcards/${cardA}`, t2)).status).toBe(404);
    expect((await send("PUT", `${HUB}/lessons/${l1}`, t2, { title: "hijack" })).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons/${l1}/end`, t2)).status).toBe(404);
    expect((await send("DELETE", `${HUB}/lessons/${l1}`, t2)).status).toBe(404);
    expect((await send("PUT", `${HUB}/submissions/${hw1}__${child1}/mark`, t2, { score: 1, max: 1 })).status).toBe(404);
    // …and can't assign its own homework to, or schedule a lesson for, this provider's child or topic.
    expect((await send("POST", `${HUB}/homework`, t2, { title: "x", assignedChildIds: [child1] })).status).toBe(404);
    expect((await send("POST", `${HUB}/lessons`, t2, { title: "x", startsAt: new Date().toISOString(), durationMins: 30, childIds: [child1] })).status).toBe(404);
    expect((await send("POST", `${HUB}/flashcards`, t2, { topicId, front: "x", back: "y" })).status).toBe(404);
    // A family with no enrolment at the other provider gets nothing there.
    // (The standing parent may HAVE been enrolled at the company by an earlier spec — tutor-flow's invite test does that and
    // the data isn't wiped between spec files — so the 404 only applies when there is no enrolment; either way none of THIS
    // provider's data may show up there.)
    const exp = await get<Record<string, Record<string, unknown>[]>>("/api/privacy/export", parent);
    const enrolledAtCompany = (exp.learningEnrolments ?? []).some((e) => e.tenantId === accounts.company.tenantId);
    const atCompany = await raw(`${HUB}/homework?tenantId=${accounts.company.tenantId}`, parent);
    if (enrolledAtCompany) { expect(atCompany.status).toBe(200); expect(JSON.stringify(atCompany.body)).not.toContain(stamp); }
    else expect(atCompany.status).toBe(404);
    expect((await raw(`${HUB}/homework?tenantId=no-such-provider-${stamp}`, parent)).status).toBe(404);
    // Untouched for the owner.
    expect((await get<Hw[]>(`${HUB}/homework`, tutor)).find((h) => h.id === hw1)?.title).toBe(`Fractions sheet ${stamp}`);
  });
});

test.describe("privacy: export and the child-delete cascade", () => {
  test("the family's data export includes their child's learning data — and only theirs", async () => {
    const x = await get<Record<string, Record<string, unknown>[]>>("/api/privacy/export", parent);
    const enrolled = (x.learningEnrolments ?? []).filter((e) => e.tenantId === tenantId).map((e) => e.childId);
    expect(enrolled).toEqual(expect.arrayContaining([child1, child2]));
    const hwRow = x.learningHomework.find((h) => h.homeworkId === hw1 && h.childId === child1)!;
    expect(hwRow).toMatchObject({ status: "marked", text: expect.stringContaining("Q2 = 3/4") });
    expect(hwRow.mark).toMatchObject({ score: 8, max: 10 });
    expect(hwRow.attachments).toEqual([{ name: "working.png", contentType: "image/png", size: expect.any(Number) }]); // metadata only, never the bytes
    expect(x.learningFlashcardReviews.filter((r) => r.childId === child1).length).toBe(2);
    const lesson = x.learningLessons.find((l) => l.id === l1)!;
    expect(lesson.attendance).toEqual([{ childId: child1, joinedAt: expect.any(String) }]);
    expect(x).toHaveProperty("learningAttempts");
    expect(x).toHaveProperty("learningMastery");
    // The summary endpoint counts them too.
    expect(((await get<{ summary: Record<string, number> }>("/api/privacy", parent)).summary.learningHomework ?? 0)).toBeGreaterThan(0);
  });

  test("deleting a child removes their learning data everywhere", async () => {
    // child2 has: an enrolment, a homework submission (hw2) and a card review.
    const del = await send("DELETE", `/api/my/children/${child2}`, parent);
    expect(del.status, JSON.stringify(del.body)).toBe(200);

    const x = await get<Record<string, Record<string, unknown>[]>>("/api/privacy/export", parent);
    expect(x.learningEnrolments.some((e) => e.childId === child2)).toBe(false);
    expect(x.learningHomework.some((h) => h.childId === child2)).toBe(false);
    expect(x.learningFlashcardReviews.some((r) => r.childId === child2)).toBe(false);
    // …while their sibling's record is intact.
    expect(x.learningEnrolments.some((e) => e.childId === child1 && e.tenantId === tenantId)).toBe(true);
    expect(x.learningFlashcardReviews.filter((r) => r.childId === child1).length).toBe(2);

    // The tutor's side no longer knows the child either.
    expect((await get<{ childId: string }[]>(`${HUB}/students`, tutor)).some((s) => s.childId === child2)).toBe(false);
    expect((await get<{ homeworkId: string; childId: string }[]>(`${HUB}/homework/inbox`, tutor)).some((s) => s.childId === child2)).toBe(false);
    const h2 = (await get<Hw[]>(`${HUB}/homework`, tutor)).find((h) => h.id === hw2)!;
    expect(h2.assignedChildIds).not.toContain(child2);
    expect((await raw(`${HUB}/homework${qc(child2)}`, parent)).status).toBe(404); // no longer an enrolled child
  });
});
