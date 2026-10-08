// A franchise PUT /api/customers/:id on a family it doesn't own adds a child it typed (or a name-only match of a hidden child) as an id-less
// entry. Re-saving the same set must be idempotent: before, every save stacked another copy the franchise could not see (1MB document cap).
// Id-less entries a franchise adds carry their provenance (the adding franchise), so the franchise sees and replaces ITS OWN copies, never
// another franchise's, and hidden children with ids stay byte-identical. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const HIDDEN = `HidC ${u()}`, SEEN = `SeenC ${u()}`, NEWK = `NewKid ${u()}`, NEWK2 = `NewKid2 ${u()}`;
const A_EMAIL = "parent-a@emu.test";
let custA = "";

async function kid(parent: string, name: string, listing: string) {
  assert.ok((await as(parent, "POST", "/api/my/children", { name, dob: "2016-05-06" })).ok);
  const b = await bookWithAddons({ parent, listing, children: [{ name, days: [1] }] });
  assert.ok(b.ok, JSON.stringify(b.json).slice(0, 200));
}
const stored = async () => (((await (await adminDb()).collection("customers").doc(custA).get()).data()!.children ?? []) as any[]);
const count = async (name: string) => (await stored()).filter((k) => k.name === name).length;
const fSees = async () => (await as("F", "GET", "/api/customers")).json.find((c: any) => c.email === A_EMAIL);
const save = async (extra: any[]) => {
  const seen = (await fSees()).children as any[];
  const r = await as("F", "PUT", `/api/customers/${custA}`, { children: [...seen.filter((k) => !extra.some((e) => e.name === k.name)), ...extra] });
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
};
let hiddenBefore: any;

before(async () => {
  await seedAddons();
  await kid("A", HIDDEN, "LK"); await kid("A", SEEN, "FL");
  custA = (await as("P", "GET", "/api/customers")).json.find((c: any) => c.email === A_EMAIL)?.id;
  assert.ok(custA);
  hiddenBefore = (await stored()).find((k) => k.name === HIDDEN);
  assert.ok(hiddenBefore?.childId, "hidden child has an id");
});

describe("franchise saves are idempotent for children it adds", () => {
  it("saving the same new child three times leaves exactly one copy, and the franchise sees it", async () => {
    for (let i = 0; i < 3; i++) await save([{ name: NEWK, age: 5 }]);
    assert.equal(await count(NEWK), 1);
    assert.equal(((await fSees()).children as any[]).filter((k) => k.name === NEWK).length, 1);
  });
  it("an entry matching a hidden child only by name: three saves leave one extra copy, and the hidden child is byte-identical", async () => {
    for (let i = 0; i < 3; i++) await save([{ name: HIDDEN, age: 3 }]);
    const all = await stored();
    assert.equal(all.filter((k) => k.name === HIDDEN).length, 2, JSON.stringify(all.filter((k) => k.name === HIDDEN)));
    assert.deepEqual(all.find((k) => k.name === HIDDEN && k.childId), hiddenBefore);
  });
  it("a genuinely different child still adds", async () => {
    await save([{ name: NEWK2 }]);
    assert.equal(await count(NEWK2), 1);
    assert.equal(await count(NEWK), 1);
  });
  it("another franchise's copy of the same name is kept, not shown, and not replaced", async () => {
    const db = await adminDb();
    const cur = await stored();
    await db.collection("customers").doc(custA).set({ children: [...cur, { name: NEWK, age: 99, addedByFranchise: "other-franchise" }] }, { merge: true });
    assert.equal(((await fSees()).children as any[]).filter((k) => k.name === NEWK).length, 1, "F sees only its own copy");
    await save([{ name: NEWK, age: 6 }]);
    const mine = (await stored()).filter((k) => k.name === NEWK);
    assert.equal(mine.length, 2, JSON.stringify(mine));
    assert.ok(mine.some((k) => k.addedByFranchise === "other-franchise" && k.age === 99), "the other franchise's entry changed");
    assert.ok(mine.some((k) => k.addedByFranchise !== "other-franchise" && k.age === 6), "F's own copy was not updated");
  });
  it("the owner's save still replaces the whole list", async () => {
    const r = await as("P", "PUT", `/api/customers/${custA}`, { children: [{ name: HIDDEN, age: 10 }] });
    assert.equal(r.status, 200);
    const all = await stored();
    assert.equal(all.length, 1);
    assert.equal(all[0].age, 10);
  });
});
