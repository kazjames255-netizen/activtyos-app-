import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — homework extras (API level, like learning-hub-teaching.spec.ts):
//   · SWAP an item on a set homework (everyone still to do it, or chosen students) without deleting it; anyone who already
//     handed in keeps the original; the families still to do it are told;
//   · a child's BADGES (GET /badges — derived, read-only, a parent sees the same);
//   · a tutor's saved FEEDBACK BANK (private list, capped, de-duplicated).
// The freelancer is the tutor, the standing parent the family, the company account a DIFFERENT provider.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let tutor = "", parent = "", other = "";
let tenantId = "";
let child1 = "", child2 = "";
let topicId = "";
let lessonA = "", lessonB = "", hw = "";
const HUB = "/api/learning-hub";
const qc = (c: string) => `?tenantId=${tenantId}&childId=${c}`;
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type Body = Record<string, unknown> & { error?: unknown; code?: string };

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
/** Ride out an API restart: only network failures are retried, never an HTTP answer. */
async function retryNet<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 5 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
async function send(method: string, p: string, idToken: string, body?: unknown) {
  const res = await retryNet(() => fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await res.text();
  let parsed: unknown = {};
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: parsed as Body };
}
const get = async <T,>(p: string, t: string) => retryNet(() => apiFetch<T>(p, t));

interface FamilyHw { id: string; childId: string; notes: { id: string; title: string }[]; submission: { status: string; mark: unknown } }
const rowFor = async (c: string) => (await get<FamilyHw[]>(`${HUB}/homework${qc(c)}`, parent)).find((r) => r.id === hw)!;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 });
  child1 = await createParentChild(accounts.parent, { name: `Swapkid ${stamp}` });
  child2 = await createParentChild(accounts.parent, { name: `Swapsib ${stamp}` });
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId });
  await markParentWelcomed(accounts.parent);
  [tutor, parent, other] = await Promise.all([token(accounts.freelancer), token(accounts.parent), token(accounts.company)]);
  for (const c of [child1, child2]) expect((await send("POST", `${HUB}/students`, tutor, { childId: c })).status).toBe(201);
  const t = await send("POST", `${HUB}/topics`, tutor, { subject: `Swap ${stamp}`, topic: "Fractions" });
  expect(t.status).toBe(201);
  topicId = t.body.id as string;
  const a = await send("POST", `${HUB}/notes`, tutor, { topicId, title: `Lesson A ${stamp}`, body: "…", published: true, attachments: [] });
  const b = await send("POST", `${HUB}/notes`, tutor, { topicId, title: `Lesson B ${stamp}`, body: "…", published: true, attachments: [] });
  expect(a.status).toBe(201); expect(b.status).toBe(201);
  lessonA = a.body.id as string; lessonB = b.body.id as string;
  const r = await send("POST", `${HUB}/homework`, tutor, { title: `Swap me ${stamp}`, instructions: "x", noteIds: [lessonA], assignedChildIds: [child1, child2] });
  expect(r.status).toBe(201);
  hw = r.body.id as string;
});
test.afterAll(async () => {
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});

test.describe("swap an item on a set homework", () => {
  test("rules: same item, missing item, foreign item, and a family can't swap", async () => {
    const swap = (t: string, body: unknown, id = hw) => send("POST", `${HUB}/homework/${id}/swap`, t, body);
    expect((await swap(tutor, { kind: "lesson", fromId: lessonA, toId: lessonA })).status).toBe(400);
    expect((await swap(tutor, { kind: "lesson", fromId: lessonB, toId: lessonA })).status).toBe(400);          // B isn't on it
    expect((await swap(tutor, { kind: "lesson", fromId: lessonA, toId: "no-such-lesson" })).status).toBe(404);
    expect((await swap(tutor, { kind: "quiz", fromId: "x", toId: "y" })).status).toBe(404);                   // no such quiz to point at
    expect((await swap(parent, { kind: "lesson", fromId: lessonA, toId: lessonB })).status).toBe(403);
    expect([403, 404]).toContain((await swap(other, { kind: "lesson", fromId: lessonA, toId: lessonB })).status); // another provider can't see it
    expect((await swap(tutor, { kind: "nonsense", fromId: lessonA, toId: lessonB })).status).toBe(400);
    // …and nothing above changed anything.
    expect((await rowFor(child1)).notes.map((n) => n.id)).toEqual([lessonA]);
  });

  test("swapping for ONE student changes only their version; the family is told", async () => {
    const r = await send("POST", `${HUB}/homework/${hw}/swap`, tutor, { kind: "lesson", fromId: lessonA, toId: lessonB, childIds: [child2] });
    expect(r.status).toBe(200);
    expect(r.body.changed).toBe(1);
    expect((await rowFor(child2)).notes.map((n) => n.id)).toEqual([lessonB]);
    expect((await rowFor(child1)).notes.map((n) => n.id)).toEqual([lessonA]);
    await expect.poll(async () => (await get<{ notifications: { title: string; body: string }[] }>("/api/notifications", parent)).notifications
      .some((n) => n.title === "Homework updated" && n.body.includes(`Swap me ${stamp}`)), { timeout: 20_000 }).toBe(true);
    // Swapping the same thing again for that student is refused: they no longer have the old item.
    expect((await send("POST", `${HUB}/homework/${hw}/swap`, tutor, { kind: "lesson", fromId: lessonA, toId: lessonB, childIds: [child2] })).status).toBe(400);
  });

  test("a student who already handed in keeps the original when everyone else is swapped", async () => {
    const sid = `${hw}__${child1}`;
    const sub = await send("POST", `${HUB}/submissions/${sid}/submit${qc(child1)}`, parent, { text: "my answer" });
    expect(sub.status).toBe(200);
    // A partial swap for someone who handed in is refused (their work stays as it was).
    expect((await send("POST", `${HUB}/homework/${hw}/swap`, tutor, { kind: "lesson", fromId: lessonA, toId: lessonB, childIds: [child1] })).status).toBe(400);
    // Swap for everyone still to do it: the homework moves to B, but child1's hand-in keeps A.
    const r = await send("POST", `${HUB}/homework/${hw}/swap`, tutor, { kind: "lesson", fromId: lessonA, toId: lessonB });
    expect(r.status).toBe(200);
    expect((r.body.homework as { noteIds: string[] }).noteIds).toEqual([lessonB]);
    expect(r.body.kept).toBe(1);
    const mine = await rowFor(child1);
    expect(mine.notes.map((n) => n.id)).toEqual([lessonA]);
    expect(mine.submission.status).toBe("submitted");
    expect((await rowFor(child2)).notes.map((n) => n.id)).toEqual([lessonB]);
  });
});

test.describe("badges", () => {
  test("a parent reads their own child's badges (derived, read-only); others can't", async () => {
    const r = await send("GET", `${HUB}/badges${qc(child2)}`, parent);
    expect(r.status).toBe(200);
    const badges = r.body.badges as { id: string; earned: boolean }[];
    expect(badges.map((b) => b.id)).toEqual(["first_quiz", "streak3", "streak7", "homework5", "cards50", "perfect", "comeback"]);
    expect(badges.every((b) => b.earned === false)).toBe(true);        // a brand-new child has none
    expect(r.body.total).toBe(7);
    expect([403, 404]).toContain((await send("GET", `${HUB}/badges${qc(child2)}`, other)).status); // another provider: no such student
    expect((await send("GET", `${HUB}/badges?tenantId=${tenantId}`, tutor)).status).toBe(400); // a tutor must name the student
    expect((await send("GET", `${HUB}/badges${qc(child1)}`, tutor)).status).toBe(200);
  });
});

test.describe("feedback bank", () => {
  test("saves a tidy private list, in order; capped; a family has none", async () => {
    const put = (t: string, snippets: string[]) => send("PUT", `${HUB}/feedback-bank`, t, { snippets });
    const saved = await put(tutor, ["  Great   work  ", "great work", "", "Try again"]);
    expect(saved.status).toBe(200);
    expect(saved.body.snippets).toEqual(["Great work", "Try again"]);         // trimmed, repeats and blanks dropped
    expect((await send("GET", `${HUB}/feedback-bank`, tutor)).body.snippets).toEqual(["Great work", "Try again"]);
    expect((await put(tutor, ["Try again", "Great work"])).body.snippets).toEqual(["Try again", "Great work"]); // reorder persists
    expect((await send("GET", `${HUB}/feedback-bank`, tutor)).body.snippets).toEqual(["Try again", "Great work"]);
    expect((await put(tutor, ["x".repeat(201)])).status).toBe(400);
    expect((await put(tutor, Array.from({ length: 31 }, (_, i) => `Comment ${i}`))).status).toBe(400);
    expect((await put(tutor, Array.from({ length: 30 }, (_, i) => `Comment ${i}`))).status).toBe(200);
    // Private to the tutor: another provider's tutor sees their own (empty) list; a family can't use it at all.
    expect((await send("GET", `${HUB}/feedback-bank`, other)).body.snippets).not.toContain("Comment 0");
    expect((await send("GET", `${HUB}/feedback-bank`, parent)).status).toBe(403);
    expect((await put(parent, ["nope"])).status).toBe(403);
    await put(tutor, []);                                                     // leave the shared tutor account clean
  });
});
