import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — the live whiteboard's saved copy (Round 4): GET/PUT /lessons/:id/board.
// API level, like learning-hub-teaching.spec.ts: the freelancer is the tutor, the standing
// parent the family (enrolled child), the company account a DIFFERENT provider.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let tutor = "", parent = "", other = "";
let tenantId = "", child = "", topicId = "", lessonId = "", lessonB = "";
const HUB = "/api/learning-hub";
const q = () => `?tenantId=${tenantId}`;
const qc = () => `?tenantId=${tenantId}&childId=${child}`;

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
type Body = Record<string, unknown> & { error?: unknown; code?: string };
/** The dev API hot-reloads (tsx watch) whenever anyone saves a server file — ride out a restart. */
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
  let json: unknown = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json as Body };
}
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const stroke = (id: string, pts = 6, extra: Record<string, unknown> = {}) => ({ id, k: "stroke", own: "T", z: 1, v: 1, c: "#1b1f2a", w: 6, pts: Array.from({ length: pts * 3 }, (_, i) => (i % 3 === 2 ? 50 : i)), ...extra });
const page1 = (elements: unknown[], background = "blank") => ({ id: "p1", background, elements });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Board API ${stamp}`, price: 0 });
  child = await createParentChild(accounts.parent, { name: `Boardkid ${stamp}` });
  await apiPost("/api/my/providers/follow", (await fbSignIn(accounts.parent.email)).idToken, { tenantId });
  await markParentWelcomed(accounts.parent);
  [tutor, parent, other] = await Promise.all([accounts.freelancer, accounts.parent, accounts.company].map(async (a) => (await fbSignIn(a.email)).idToken));
  expect((await send("POST", `${HUB}/students`, tutor, { childId: child })).status).toBe(201);
  const t = await send("POST", `${HUB}/topics`, tutor, { subject: `Board ${stamp}`, topic: "Shapes" });
  topicId = t.body.id as string;
  const mk = async (title: string) => (await send("POST", `${HUB}/lessons`, tutor, { title, topicId, startsAt: new Date(Date.now() + 86_400_000).toISOString(), durationMins: 45, childIds: [child] })).body.id as string;
  lessonId = await mk(`Board lesson ${stamp}`);
  lessonB = await mk(`Board lesson B ${stamp}`);
  expect(lessonId && lessonB).toBeTruthy();
});
// Other Learning Hub specs flip these standing accounts' hub switch: make sure it is on before each test.
test.beforeEach(async () => {
  for (const a of [accounts.freelancer, accounts.company]) {
    const lib = await apiFetch<Lib | null>("/api/library", (await fbSignIn(a.email)).idToken);
    if (lib?.settings?.features?.learninghub !== true) await setHub(a, true);
  }
});

test.describe("whiteboard: saved copy", () => {
  test("a lesson with nothing saved has an empty one-page board", async () => {
    const r = await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor);
    expect(r.status).toBe(200);
    expect(r.body.pages).toEqual([{ id: "p1", background: "blank", elements: [] }]);
    expect(r.body.updatedAt).toBeNull();
    expect(r.body.readOnly).toBe(false);
  });

  let imageId = "";
  test("the tutor saves a board (pages, backgrounds, text, a hub picture) and reads it back", async () => {
    const up = await send("POST", "/api/uploads", tutor, { dataUrl: PNG_1PX, purpose: "private", kind: "hub" });
    expect(up.status).toBe(201);
    imageId = up.body.id as string;
    const body = { pages: [
      page1([stroke("s1"), { id: "t1", k: "text", own: "T", z: 2, v: 2, x: 10, y: 20, text: "3/4", size: 28, bold: true, c: "#000" },
        { id: "i1", k: "image", own: "T", z: 3, v: 3, imageId, url: "https://evil.example/x.png", x: 0, y: 0, w: 120, h: 90 },
        { id: "st1", k: "stamp", own: "T", z: 4, v: 4, stamp: "fractions", x: 0, y: 200, w: 640, h: 70, opts: { parts: 4, mask: 5 } }], "squared"),
      { id: "p2", background: "graph", elements: [] },
    ] };
    const put = await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, body);
    expect(put.status).toBe(200);
    expect(put.body.ok).toBe(true);
    const got = await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor);
    expect(got.status).toBe(200);
    const pages = got.body.pages as { id: string; background: string; elements: Record<string, unknown>[] }[];
    expect(pages.map((p) => [p.id, p.background])).toEqual([["p1", "squared"], ["p2", "graph"]]);
    expect(pages[0]!.elements).toHaveLength(4);
    expect(got.body.updatedAt).toBeTruthy();
    const img = pages[0]!.elements.find((e) => e.id === "i1")!;
    // a picture is a REFERENCE: the id is stored; the link is re-signed by the server, whatever the client sent
    expect(img.imageId).toBe(imageId);
    expect(String(img.url)).toContain(`/api/images/${imageId}?exp=`);
    expect(String(img.url)).not.toContain("evil.example");
  });

  test("the family reads it (read-only) and can't save", async () => {
    const got = await send("GET", `${HUB}/lessons/${lessonId}/board${qc()}`, parent);
    expect(got.status).toBe(200);
    expect(got.body.readOnly).toBe(true);
    expect((got.body.pages as unknown[]).length).toBe(2);
    const put = await send("PUT", `${HUB}/lessons/${lessonId}/board${qc()}`, parent, { pages: [page1([])] });
    expect(put.status).toBe(403);
    // …and the tutor's copy is untouched
    expect(((await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor)).body.pages as unknown[]).length).toBe(2);
  });

  test("another provider — and an unknown lesson — get 404, never a hint the lesson exists", async () => {
    expect((await send("GET", `${HUB}/lessons/${lessonId}/board`, other)).status).toBe(404);
    expect((await send("PUT", `${HUB}/lessons/${lessonId}/board`, other, { pages: [page1([])] })).status).toBe(404);
    expect((await send("GET", `${HUB}/lessons/nope-${stamp}/board`, tutor)).status).toBe(404);
    expect((await send("PUT", `${HUB}/lessons/nope-${stamp}/board`, tutor, { pages: [page1([])] })).status).toBe(404);
    // a family not enrolled with this provider has no way in either
    expect((await send("GET", `${HUB}/lessons/${lessonId}/board?tenantId=${accounts.company.tenantId}&childId=${child}`, parent)).status).toBe(404);
  });

  test("hopeless boards are refused with 400 and change nothing; bad ELEMENTS are repaired or dropped, never a reason to lose the whole board", async () => {
    const before = JSON.stringify((await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor)).body.pages);
    for (const b of [{ pages: [] }, { nope: true }, { pages: "x" }, {}]) expect((await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, b)).status, JSON.stringify(b).slice(0, 80)).toBe(400);
    expect(JSON.stringify((await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor)).body.pages)).toBe(before);

    // one poisoned board: a good stroke plus every kind of bad element — the save SUCCEEDS with only the good/repairable ones
    const mixed = await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, { pages: [
      page1([
        stroke("good", 3),
        { id: "long-text", k: "text", own: "T", z: 1, v: 1, x: 0, y: 0, text: "x".repeat(5000), size: 28 },
        { id: "long-cid", k: "text", own: "c:x", z: 1, v: 1, x: 0, y: 0, text: "hi", cid: "c".repeat(300), by: "b".repeat(200) },
        { id: "v".repeat(300), k: "text", own: "T", z: 1, v: 1, text: "id too long" },
        { id: "vid", k: "video", own: "T", z: 1, v: 1 },
        stroke("bad-pts", 3, { pts: ["x"] }),
        { id: "im", k: "image", own: "T", z: 1, v: 1, imageId: "not-a-real-image", x: 0, y: 0, w: 5, h: 5 }, // must be a real hub upload of THIS tenant
      ], "sparkly"),
      page1([]), // duplicate page id
    ] });
    expect(mixed.status).toBe(200);
    expect(mixed.body.dropped).toBe(5);
    const got = ((await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor)).body.pages as { id: string; background: string; elements: { id: string; text?: string; cid?: string; by?: string }[] }[]);
    expect(got.length).toBe(1);
    expect(got[0]!.background).toBe("blank"); // an unknown background falls back to blank
    expect(got[0]!.elements.map((e) => e.id).sort()).toEqual(["good", "long-cid", "long-text"]);
    expect(got[0]!.elements.find((e) => e.id === "long-text")!.text!.length).toBe(2000);
    expect(got[0]!.elements.find((e) => e.id === "long-cid")!.cid).toBeUndefined();
    expect(got[0]!.elements.find((e) => e.id === "long-cid")!.by!.length).toBe(40);
  });

  test("an oversize board is a friendly 413; last write wins otherwise", async () => {
    const huge = { pages: [page1(Array.from({ length: 22 }, (_, i) => stroke(`big${i}`, 3000)))] };
    const r = await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, huge);
    expect(r.status).toBe(413);
    expect(r.body.code).toBe("board_too_large");
    expect(String(r.body.error)).toMatch(/too big to save/i);
    // a board just under the cap saves
    const ok = await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, { pages: [page1(Array.from({ length: 3 }, (_, i) => stroke(`ok${i}`, 3000)))] });
    expect(ok.status).toBe(200);
    // last write wins: a later PUT replaces it
    expect((await send("PUT", `${HUB}/lessons/${lessonId}/board`, tutor, { pages: [page1([stroke("last")])] })).status).toBe(200);
    const got = await send("GET", `${HUB}/lessons/${lessonId}/board`, tutor);
    expect((got.body.pages as { elements: { id: string }[] }[])[0]!.elements.map((e) => e.id)).toEqual(["last"]);
  });

  test("student drawings carry only childId + first name; unknown children are dropped", async () => {
    const put = await send("PUT", `${HUB}/lessons/${lessonB}/board`, tutor, { pages: [page1([
      stroke("k1", 4, { own: `c:${child}`, by: "Boardkid", cid: child }),
      stroke("k2", 4, { own: "c:someone-else", by: "Zed", cid: "someone-else" }),
    ])] });
    expect(put.status).toBe(200);
    const els = ((await send("GET", `${HUB}/lessons/${lessonB}/board`, tutor)).body.pages as { elements: { id: string; cid?: string }[] }[])[0]!.elements;
    expect(els.find((e) => e.id === "k1")!.cid).toBe(child);
    expect(els.find((e) => e.id === "k2")!.cid).toBeUndefined(); // not a child of this lesson
    // deleting the lesson deletes its board
    expect((await send("DELETE", `${HUB}/lessons/${lessonB}${q()}`, tutor)).status).toBe(200);
    expect((await send("GET", `${HUB}/lessons/${lessonB}/board`, tutor)).status).toBe(404);
  });

  test("My templates: tutors save / list / delete; families and other providers can't; a child's work never goes in", async () => {
    const els = [stroke("a", 4), { id: "t", k: "text", own: "T", z: 2, v: 2, x: 0, y: 0, text: "Hello", size: 28, c: "#000" }, stroke("kid", 4, { own: `c:${child}`, by: "Kid", cid: child })];
    const made = await send("POST", `${HUB}/board-templates`, tutor, { name: `Warm-up ${stamp}`, background: "squared", elements: els });
    expect(made.status).toBe(201);
    const list = await send("GET", `${HUB}/board-templates`, tutor);
    const mine = (list.body as unknown as { id: string; name: string; elements: { id: string }[] }[]).find((t) => t.id === made.body.id)!;
    expect(mine.name).toBe(`Warm-up ${stamp}`);
    expect(mine.elements.map((e) => e.id).sort()).toEqual(["a", "t"]); // the student's drawing was dropped
    expect((await send("GET", `${HUB}/board-templates${qc()}`, parent)).status).toBe(403);
    expect((await send("POST", `${HUB}/board-templates${qc()}`, parent, { name: "x", elements: els })).status).toBe(403);
    expect(((await send("GET", `${HUB}/board-templates`, other)).body as unknown as { id: string }[]).some((t) => t.id === made.body.id)).toBe(false);
    expect((await send("DELETE", `${HUB}/board-templates/${made.body.id}`, other)).status).toBe(404);
    expect((await send("POST", `${HUB}/board-templates`, tutor, { name: "", elements: els })).status).toBe(400);
    expect((await send("POST", `${HUB}/board-templates`, tutor, { name: "only kids", elements: [els[2]] })).status).toBe(400);
    expect((await send("DELETE", `${HUB}/board-templates/${made.body.id}`, tutor)).status).toBe(200);
    expect(((await send("GET", `${HUB}/board-templates`, tutor)).body as unknown as { id: string }[]).some((t) => t.id === made.body.id)).toBe(false);
  });
});
