// Learning Hub follow-ups (10 Oct 2026, from the independent verifier's ledger). Children's data. PURE tests, no Firestore.
//   1  every hub* collection named anywhere in server/src is in HUB_COLLECTION_PRIVACY (and child-keyed ones are erased + exported)
//   2  staff with a missing / unknown role, or an invalid cap level, get NO Teaching Hub access; PUT /api/library validation helper
//   3  provenance links (source.url) never leave the API
//   4  a bare "Oak" (child, class, provider) is not the publisher
// The behaviour against real data is in tests/emulator/hub-followups.test.mts.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { capLevel, isCapLevel, resolveCaps } from "../lib/accessMap";
import { scrubNotice } from "../server/src/lib/hubNotify";
import { mentionsOak, scrubPayload, scrubText } from "../server/src/oak/noOak";

const SRC = join(import.meta.dirname, "../server/src");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });

describe("privacy registry covers every hub collection used in code", () => {
  const registry = readFileSync(join(SRC, "lib/hubPrivacy.ts"), "utf8");
  const regBody = registry.slice(registry.indexOf("HUB_COLLECTION_PRIVACY"), registry.indexOf("HUB_RELATED_COLLECTIONS"));
  const registered = new Set([...regBody.matchAll(/^\s*(hub[A-Za-z]+):\s*\{/gm)].map((m) => m[1]!));
  const used = new Map<string, string>();
  for (const f of walk(SRC).filter((p) => !/SelfTest|hubLoadTest|e2eCleanup|hubPrivacy\.ts$/.test(p))) {
    const t = readFileSync(f, "utf8");
    // collection("hubX"), and the realtime pings that name a collection ("hubX" passed to pingHub)
    for (const m of t.matchAll(/(?:collection|pingHub)\(\s*(?:[A-Za-z.]+,\s*)?["'](hub[A-Za-z]+)["']/g)) used.set(m[1]!, f);
  }
  it("finds the collections it should (sanity)", () => { assert.ok(used.size > 25 && used.has("hubAttempts") && used.has("hubQuizProfile")); });
  it("no hub collection is missing from HUB_COLLECTION_PRIVACY", () => {
    const missing = [...used.keys()].filter((c) => !registered.has(c));
    assert.deepEqual(missing, [], `add to HUB_COLLECTION_PRIVACY (and erase/export if child data): ${missing.join(", ")}`);
  });
  it("the 11 game / quiz / lesson-view collections are child-keyed deletes, erased and exported", () => {
    const eleven = ["hubAppliedSessions", "hubAppliedState", "hubBotPuzzleState", "hubMiniGameProfile", "hubSortRoundState", "hubTrainingItemState", "hubQuizItemState", "hubQuizProfile", "hubQuizArcadeMastery", "hubQuizArcadeProfile", "hubLessonViews"];
    const erase = registry.slice(registry.indexOf("export async function eraseChildLearning"));
    const exp = registry.slice(registry.indexOf("export async function exportChildLearning"), registry.indexOf("export async function eraseChildLearning"));
    for (const c of eleven) {
      assert.match(regBody, new RegExp(`${c}:\\s*\\{ how: "delete"`), `${c} must be registered as a child-keyed delete`);
      assert.ok(erase.includes(`"${c}"`), `${c} not erased`);
      assert.ok(exp.includes(`"${c}"`), `${c} not exported`);
    }
  });
});

describe("staff access fails CLOSED for children's learning data", () => {
  const settings = (roles: unknown[]) => ({ rolesSetAt: "2026-10-01", roles });
  it("role id missing from the matrix: no Teaching Hub, other areas unchanged", () => {
    const caps = resolveCaps(settings([{ id: "r1", caps: { learninghub: "edit" } }]), "deleted-role");
    assert.equal(capLevel(caps, "learninghub"), "none");
    assert.equal(capLevel(caps, "bookings"), "edit");
  });
  it("staff with no role at all (matrix in force): no Teaching Hub", () => {
    for (const none of [undefined, null, ""]) assert.equal(capLevel(resolveCaps(settings([{ id: "r1", caps: {} }]), none), "learninghub"), "none");
  });
  it("no matrix in force: still unrestricted (today's behaviour)", () => {
    assert.equal(resolveCaps({ roles: [] }, "x"), null);
    assert.equal(capLevel(resolveCaps({}, undefined), "learninghub"), "edit");
  });
  it("owner role stays unrestricted", () => { assert.equal(resolveCaps(settings([{ id: "o", owner: true }]), "o"), null); });
  it("an invalid cap level grants nothing", () => {
    for (const bad of ["NONE", "None ", "bogus", "EDIT", 0, 1, true, {}, []]) assert.equal(capLevel({ learninghub: bad as never, bookings: bad as never }, "learninghub"), "none", JSON.stringify(bad));
    assert.equal(capLevel({ bookings: "bogus" as never }, "bookings"), "none");
  });
  it("valid levels are unchanged", () => {
    for (const l of ["none", "view", "edit"] as const) assert.equal(capLevel({ learninghub: l }, "learninghub"), l);
    assert.equal(capLevel({}, "learninghub"), "none");
    assert.equal(capLevel({}, "bookings"), "edit");
    assert.ok(isCapLevel("view") && !isCapLevel("VIEW") && !isCapLevel(undefined));
  });
});

describe("provenance links never leave the API", () => {
  it("lesson.source.url (publisher link) is dropped; the rest of the lesson is kept", () => {
    const out = scrubPayload({ title: "Fractions", lesson: { source: { provider: "oak", url: "https://www.thenational.academy/teachers/lessons/x" }, year: "5" } });
    assert.ok(!JSON.stringify(out).includes("thenational"));
    assert.equal(out.title, "Fractions");
    assert.equal((out.lesson as any).year, "5");
  });
  it("an unrelated url key is left alone", () => {
    const out = scrubPayload({ source: { url: "https://example.org/a" }, note: "oak tree" });
    assert.equal((out.source as any).url, "https://example.org/a");
  });
});

describe("a bare 'Oak' is not the publisher", () => {
  const names = ["Oak", "Oak Class", "Oak Lane Tutors", "Oakley", "Oakwood Primary", "an oak tree", "Oak Lane Tutors: Oak joined Oak Class"];
  it("names and trees are not flagged", () => { for (const n of names) assert.equal(mentionsOak(n), false, n); });
  it("real publisher names, links and credits still are", () => {
    for (const n of ["Oak National Academy", "Oak Academy", "oaknational.academy", "Oak's slides", "Oak lessons", "How to use Oak", "Made by Oak.", "Source: Oak", "https://teachers.thenational.academy/x", "Open Government Licence"]) assert.equal(mentionsOak(n), true, n);
  });
  it("bell text keeps a class / provider / child called Oak", () => {
    const c = scrubNotice({ title: "Oak Class has a new lesson", body: "Oak Lane Tutors set homework for Oak." });
    assert.equal(c.title, "Oak Class has a new lesson");
    assert.equal(c.body, "Oak Lane Tutors set homework for Oak.");
  });
  it("bell text still drops the publisher", () => {
    const c = scrubNotice({ title: "Fractions", body: "A lesson by Oak National Academy. Please read it." });
    assert.ok(!/oak/i.test(c.body));
    assert.equal(scrubText("Oak lessons are structured around learning cycles."), "");
  });
});
