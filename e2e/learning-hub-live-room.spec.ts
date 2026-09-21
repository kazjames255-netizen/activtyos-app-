import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadAccounts, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — live-room leftovers (G3). API-level on purpose (the UI suite is a long queue): who may join as which child, a RUNNING lesson
// can be lengthened but never pushed into the future, the Daily room's capacity follows the roster (read back from Daily itself), and a
// whiteboard snapshot is a distinct "board" note that never rings the family's bell as a new lesson. Every assertion is anchored to THIS
// run's stamped lesson / children / note.

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const subject = `LiveRoom Lab ${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "";
let tutor = "", parent = "";
let childA = "", childB = "";
let topicId = "";

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

async function setHub(op: TestAccount, on: boolean) {
  for (let i = 0; ; i++) {
    try {
      const s = await fbSignIn(op.email);
      const lib = (await apiFetch<{ settings?: Record<string, unknown> & { features?: Record<string, boolean> } } | null>("/api/library", s.idToken)) ?? {};
      const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
      await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
      return;
    } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

/** The Daily room's own record of itself (read with the server's key — the only way to see what the API really set). */
async function dailyRoom(name: string): Promise<{ config?: { max_participants?: number; exp?: number } } | null> {
  let key = "";
  try { key = fs.readFileSync(path.join(ROOT, "server", ".env"), "utf8").match(/^DAILY_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { /* no env */ }
  if (!key) return null;
  const r = await fetch(`https://api.daily.co/v1/rooms/${name}`, { headers: { Authorization: `Bearer ${key}` } });
  return r.ok ? ((await r.json()) as { config?: { max_participants?: number; exp?: number } }) : null;
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  tutor = await token(accounts.freelancer);
  parent = await token(accounts.parent);
  await provisionLiveListing(accounts.freelancer, { title: `E2E LiveRoom Tuition ${stamp}`, price: 0 });
  childA = await createParentChild(accounts.parent, { name: `Lra ${stamp}` });
  childB = await createParentChild(accounts.parent, { name: `Lrb ${stamp}` });
  await apiPost("/api/my/providers/follow", parent, { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, tutor, { subject, topic: "Rooms" });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, tutor);
  topicId = topics.find((x) => x.subject === subject)!.id;
  for (const c of [childA, childB]) expect((await send("POST", `${HUB}/students`, tutor, { childId: c, subjects: [subject] })).status).toBe(201);
});
test.afterAll(async () => { await setHub(accounts.freelancer, false); });

test("a parent must say which child is joining when two of theirs are in the lesson (and cannot join as a child who is not)", async () => {
  const startsAt = new Date(Date.now() - 2 * 60_000).toISOString();
  const both = await send("POST", `${HUB}/lessons`, tutor, { title: `Both kids ${stamp}`, topicId, startsAt, durationMins: 30, childIds: [childA, childB] });
  expect(both.status, both.text).toBe(201);
  const ambiguous = await send("POST", `${HUB}/lessons/${both.body.id}/join?tenantId=${tenantId}`, parent, {});
  expect(ambiguous.status, ambiguous.text).toBe(400);
  expect(ambiguous.body.code).toBe("child_required");
  // …and the answer lists exactly the children the lobby / stage picker offers.
  expect((ambiguous.body.children as { childId: string }[]).map((c) => c.childId).sort()).toEqual([childA, childB].sort());
  // The family's un-narrowed list names both (the lobby picker reads this).
  const list = await send("GET", `${HUB}/lessons?tenantId=${tenantId}`, parent);
  const row = (list.body as unknown as { id: string; students: { childId: string }[] }[]).find((l) => l.id === both.body.id)!;
  expect(row.students.map((s) => s.childId).sort()).toEqual([childA, childB].sort());
  // A lesson for A alone: joining as B is refused with a stable code (the stage shows "isn't linked to your account").
  const solo = await send("POST", `${HUB}/lessons`, tutor, { title: `Solo ${stamp}`, topicId, startsAt, durationMins: 30, childIds: [childA] });
  const wrong = await send("POST", `${HUB}/lessons/${solo.body.id}/join?tenantId=${tenantId}&childId=${childB}`, parent, { childId: childB });
  expect(wrong.status).toBe(404);
  expect(wrong.body.code).toBe("not_your_lesson");
});

test("a running lesson can be lengthened but not moved to later; its Daily room capacity follows the roster", async () => {
  const startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const made = await send("POST", `${HUB}/lessons`, tutor, { title: `Running ${stamp}`, topicId, startsAt, durationMins: 30, childIds: [childA] });
  expect(made.status, made.text).toBe(201);
  const id = made.body.id as string;
  const joined = await send("POST", `${HUB}/lessons/${id}/join`, tutor, {});
  expect(joined.status, joined.text).toBe(200);
  expect(joined.body.isOwner).toBe(true);

  // Capacity: 1 student → the floor of 8 (every device counts: child + guardian + tutor + spare) — NOT the old flat 12.
  const room = await dailyRoom(joined.body.roomName as string);
  if (room) expect(room.config?.max_participants).toBe(8);

  // Lengthen: fine, and the room's expiry stays in the future.
  const longer = await send("PUT", `${HUB}/lessons/${id}`, tutor, { durationMins: 60 });
  expect(longer.status, longer.text).toBe(200);
  // Pushing a running lesson into the future would shut its own join window on the people in it.
  const later = await send("PUT", `${HUB}/lessons/${id}`, tutor, { startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString() });
  expect(later.status, later.text).toBe(409);
  expect(later.body.code).toBe("lesson_running");
  // Nudging it earlier (still finishing in the future) is fine, and the room never gets an expiry that has already passed.
  const earlier = await send("PUT", `${HUB}/lessons/${id}`, tutor, { startsAt: new Date(Date.now() - 20 * 60_000).toISOString() });
  expect(earlier.status, earlier.text).toBe(200);
  await new Promise((r) => setTimeout(r, 2500)); // the room update is fire-and-forget
  const after = await dailyRoom(joined.body.roomName as string);
  if (after) expect((after.config?.exp ?? 0) * 1000).toBeGreaterThan(Date.now());
  // B5's Stay rule, unchanged: with the lesson live and the tutor in, a family whose child is in it may press Stay (or hit the 4 h cap)…
  const stay = await send("POST", `${HUB}/lessons/${id}/extend?tenantId=${tenantId}&childId=${childA}`, parent, { childId: childA });
  expect([200, 409]).toContain(stay.status);
  // …but a family whose child is NOT in the lesson gets nothing.
  const stranger = await send("POST", `${HUB}/lessons/${id}/extend?tenantId=${tenantId}&childId=${childB}`, parent, { childId: childB });
  expect(stranger.status).toBe(404);
});

test("a whiteboard snapshot is a distinct 'board' note and does not announce a new lesson to families", async () => {
  const title = `Board — Snapshot ${stamp}`;
  const made = await send("POST", `${HUB}/notes`, tutor, { topicId, title, body: "Saved from the live lesson whiteboard.", published: true, kind: "board", attachments: [] });
  expect(made.status, made.text).toBe(201);
  expect(made.body.kind).toBe("board");
  const list = await send("GET", `${HUB}/notes`, tutor);
  const rows = (Array.isArray(list.body) ? list.body : (list.body as J).items ?? []) as { id: string; kind?: string }[];
  const row = rows.find((n) => n.id === made.body.id);
  expect(row, `note ${made.body.id} missing from the ${rows.length}-row list: ${list.text.slice(0, 200)}`).toBeTruthy();
  expect(row?.kind).toBe("board");
  const ordinary = await send("POST", `${HUB}/notes`, tutor, { topicId, title: `Ordinary ${stamp}`, body: "Real text.", published: true, attachments: [] });
  expect(ordinary.status).toBe(201);
  expect(ordinary.body.kind).toBeUndefined();
  // Editing keeps the kind.
  const edited = await send("PUT", `${HUB}/notes/${made.body.id}`, tutor, { topicId, title, body: "Saved from the live lesson whiteboard.", published: true, attachments: [] });
  expect(edited.status, edited.text).toBe(200);
  const back = await send("GET", `${HUB}/notes/${made.body.id}?tenantId=${tenantId}`, tutor);
  expect(back.body.kind).toBe("board");
  // The family's bell rang for the ordinary lesson only.
  await new Promise((r) => setTimeout(r, 2000));
  const bell = (await send("GET", "/api/notifications", parent)).body.notifications as { title: string; body: string }[];
  const said = (t: string) => bell.some((n) => `${n.title} ${n.body}`.includes(t));
  expect(said(`Ordinary ${stamp}`)).toBe(true);
  expect(said(`Snapshot ${stamp}`)).toBe(false);
});
