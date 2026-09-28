import { test, expect } from "@playwright/test";
import { loadAccounts, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";

// A lesson brings its flashcards with it: assigning a lesson to a child (through homework) makes the cards of that lesson's topic appear in THAT child's
// flashcards, with no separate "assign flashcards" step, and a sibling who was not given the lesson does not get them.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Cards Lab ${stamp}`;
const HUB = "/api/learning-hub";
let accounts: AccountManifest["accounts"];
let tenantId = "", withId = "", withoutId = "", cardId = "";
let L: SeededLesson;
const token = async (a: { email: string }) => (await fbSignIn(a.email)).idToken;
const due = async (childId: string) => apiFetch<{ due: { id: string }[]; dueCount: number; newCount: number }>(`${HUB}/flashcards/due?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent));

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  const t = await token(accounts.freelancer);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", t)) ?? {};
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: true } } }) });
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Cards ${stamp}`, price: 0 });
  withId = await createParentChild(accounts.parent, { name: `Cy${stamp}`, dob: "2016-05-14" });
  withoutId = await createParentChild(accounts.parent, { name: `Di${stamp}`, dob: "2016-05-14" });
  for (const n of [`Cy${stamp}`, `Di${stamp}`]) await bookViaApi(accounts.parent, listing, { child: n, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Key words" });
  // enrolled with NO subjects, so the only way a card can reach a child is through the lesson
  for (const c of [withId, withoutId]) await apiPost(`${HUB}/students`, t, { childId: c, subjects: [] });
  const topicId = ((await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t)).find((x) => x.subject === subject))!.id;
  cardId = (await apiPost<{ id: string }>(`${HUB}/flashcards`, t, { topicId, front: `Front ${stamp}`, back: `Back ${stamp}`, published: true })).id;
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: null });
});

test("before the lesson is assigned nobody has the card", async () => {
  expect((await due(withId)).due.map((c) => c.id)).not.toContain(cardId);
});

test("assigning the lesson to one child gives THAT child its topic's flashcards, and not their sibling", async () => {
  const t = await token(accounts.freelancer);
  await apiPost(`${HUB}/homework`, t, { title: `Cards hw ${stamp}`, instructions: "Do the lesson.", noteIds: [L.noteId], assignedChildIds: [withId], dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  await expect.poll(async () => (await due(withId)).due.map((c) => c.id), { timeout: 30_000 }).toContain(cardId);
  expect((await due(withoutId)).due.map((c) => c.id)).not.toContain(cardId);
});

test("the tutor's student-progress stats count the cards ASSIGNED to each child (the ring's denominator), not the library", async () => {
  const t = await token(accounts.freelancer);
  type Row = { childId: string; cardsAvailable: number; reviewed: number; assigned?: number; assignedReviewed?: number };
  const stats = () => apiFetch<{ students: Row[] }>(`${HUB}/flashcards/stats?tenantId=${tenantId}`, t);
  // The assignment map is cached for 20s server-side, so poll.
  await expect.poll(async () => (await stats()).students.find((s) => s.childId === withId)?.assigned ?? 0, { timeout: 45_000 }).toBeGreaterThanOrEqual(1);
  const s = await stats();
  const a = s.students.find((r) => r.childId === withId)!, b = s.students.find((r) => r.childId === withoutId)!;
  expect(a.assignedReviewed).toBe(0);
  expect(a.assigned!).toBeLessThanOrEqual(a.cardsAvailable);
  expect(b.assigned ?? 0).toBe(0);
});

test("the tutor's card library can be narrowed by school year (and subject) on the server", async () => {
  const t = await token(accounts.freelancer);
  await apiPost(`${HUB}/topics`, t, { subject, topic: `Poems ${stamp}`, subtopic: "Year 5" });
  await apiPost(`${HUB}/topics`, t, { subject, topic: `Poems ${stamp}`, subtopic: "Year 6" });
  const topics = await apiFetch<{ id: string; subject: string; topic: string; subtopic: string | null }[]>(`${HUB}/topics`, t);
  const y5 = topics.find((x) => x.topic === `Poems ${stamp}` && x.subtopic === "Year 5")!.id;
  const y6 = topics.find((x) => x.topic === `Poems ${stamp}` && x.subtopic === "Year 6")!.id;
  const c5 = (await apiPost<{ id: string }>(`${HUB}/flashcards`, t, { topicId: y5, front: `Y5 ${stamp}`, back: "b", published: true })).id;
  const c6 = (await apiPost<{ id: string }>(`${HUB}/flashcards`, t, { topicId: y6, front: `Y6 ${stamp}`, back: "b", published: true })).id;
  const ids = async (q: string) => (await apiFetch<{ items: { id: string }[] }>(`${HUB}/flashcards?limit=200&subject=${encodeURIComponent(subject)}${q}`, t)).items.map((c) => c.id);
  const only5 = await ids("&year=5");
  expect(only5).toContain(c5); expect(only5).not.toContain(c6);
  const both = await ids("&year=5,6");
  expect(both).toContain(c5); expect(both).toContain(c6);
  expect(await ids("&year=9")).toEqual([]);
});
