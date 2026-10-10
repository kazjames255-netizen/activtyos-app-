// Parent-portal fixes (QA run areas-10oct/parent-portal, cases P08 P09 P20 P25 P34 P37 P40). Real API + Firestore emulator (npm run test:emu).
// Each test is a BEHAVIOUR test: it fails on main c2eee176 and passes on parent-fixes-10oct. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { book, call, db, login, makeListing, makeParent, makeProvider, ok, sleep, uniq, type Listing, type Parent, type Provider } from "./helpers.mts";

let P: Provider, L: Listing, A: Parent, B: Parent;
let avaId = "", benId = "";
const NAME_B = `Ben${uniq()}`;
const today = () => new Date().toISOString().slice(0, 10);

async function mkChild(p: Parent, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await ok("POST", "/api/my/children", p.token, { name, dob: "2018-03-04", ...extra });
  return r.id as string;
}
async function bookChild(p: Parent, childId: string, name: string, method = "Bank transfer") {
  return call("POST", "/api/my/bookings", p.token, { listingId: L.id, blockId: L.blockId, method, items: [{ pass: "Day pass", child: name, childId, age: 8 }] });
}
const refOf = (r: { json: any }) => (Array.isArray(r.json) ? r.json[0]?.ref : (r.json?.bookings?.[0]?.ref ?? r.json?.ref));
const uidOf = async (email: string) => (await login(email)).uid;
const bells = async (ref: string) => (await db.collection("notifications").where("ref", "==", ref).get()).docs.map((d) => d.data() as Record<string, any>);

before(async () => {
  P = await makeProvider("pfix");
  L = await makeListing(P, `PFix ${uniq()}`, false);
  A = await makeParent("pfixa", P);
  B = await makeParent("pfixb", P);
  avaId = await mkChild(A, `Ava${uniq()}`, { allergies: "nut allergy" });
  benId = await mkChild(B, NAME_B);
});

describe("P40: booking numbers are found whatever the case or spacing", () => {
  it("cancel with a lower-case, padded number cancels the family's own booking", async () => {
    const ref = await book(A, L);
    const r = await call("POST", `/api/my/bookings/${encodeURIComponent(`  ${ref.toLowerCase()} `)}/cancel`, A.token, {});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const snap = await db.collection("bookings").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get();
    assert.equal(snap.docs[0].get("status"), "Cancelled");
  });
  it("another family's number in any case is still not found", async () => {
    const ref = await book(B, L);
    const r = await call("POST", `/api/my/bookings/${encodeURIComponent(ref.toLowerCase())}/cancel`, A.token, {});
    assert.equal(r.status, 404);
    assert.equal((await db.collection("bookings").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get()).docs[0].get("status"), "Confirmed");
  });
});

describe("P37: two simultaneous identical bookings make one booking", () => {
  it("same child, listing, day: one 201 and one 409", async () => {
    const id = await mkChild(A, `Twin${uniq()}`);
    const nm = (await db.collection("children").doc(id).get()).get("name") as string;
    const rs = await Promise.all([bookChild(A, id, nm), bookChild(A, id, nm)]);
    const st = rs.map((r) => r.status).sort();
    assert.deepEqual(st, [201, 409], JSON.stringify(rs.map((r) => r.json)).slice(0, 400));
    const n = (await db.collection("bookings").where("childId", "==", id).get()).docs.filter((d) => d.get("status") !== "Cancelled").length;
    assert.equal(n, 1);
  });
});

describe("P20: one review per booking, and only for a place the family actually holds", () => {
  it("sending it twice replaces the first; a cancelled booking can't be reviewed", async () => {
    const ref = await book(A, L);
    const body = { tenantId: P.tenantId, rating: 4, comment: "first", ref };
    const r1 = await call("POST", "/api/my/feedback", A.token, body);
    const r2 = await call("POST", "/api/my/feedback", A.token, { ...body, rating: 2, comment: "second" });
    assert.ok(r1.status < 300 && r2.status < 300, `${r1.status} ${r2.status}`);
    assert.equal(r1.json.id, r2.json.id, "same review id");
    const rows = (await db.collection("feedback").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get()).docs;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].get("rating"), 2);
    assert.equal(rows[0].get("comment"), "second");
    // cancelled place
    const ref2 = await book(A, L);
    assert.equal((await call("POST", `/api/my/bookings/${ref2}/cancel`, A.token, {})).status, 200);
    const r3 = await call("POST", "/api/my/feedback", A.token, { tenantId: P.tenantId, rating: 5, ref: ref2 });
    assert.equal(r3.status, 403, JSON.stringify(r3.json));
  });
});

describe("P08/P09: incident bells never carry the staff free text; the other child's name warns staff; one acknowledgement bell", () => {
  it("neutral bell + warning + single staff bell on a double click", async () => {
    const a = await bookChild(A, avaId, (await db.collection("children").doc(avaId).get()).get("name") as string);
    assert.ok(a.status < 300 || a.status === 409, JSON.stringify(a.json));
    const b = await bookChild(B, benId, NAME_B);
    assert.ok(b.status < 300 || b.status === 409, JSON.stringify(b.json));
    const avaName = (await db.collection("children").doc(avaId).get()).get("name") as string;
    const desc = `Collision on the pitch: ${NAME_B} fell on ${avaName} and had a bruise. SECRETWORDS`;
    const inc = await call("POST", "/api/incidents", P.token, { kind: "accident", date: today(), childId: avaId, childName: avaName, description: desc, severity: "minor" });
    assert.equal(inc.status, 201, JSON.stringify(inc.json));
    assert.equal(inc.json.warning?.code, "names_other_child", "staff are warned");
    assert.ok(String(inc.json.warning.names.join()).includes(NAME_B));
    const id = inc.json.id as string;
    await sleep(1500);
    const mine = (await bells(id)).filter((n) => n.email === A.email);
    assert.ok(mine.length >= 1, "the family was told");
    for (const n of mine) { const t = JSON.stringify(n); assert.ok(!t.includes("SECRETWORDS") && !t.includes(NAME_B), `bell carries free text: ${t.slice(0, 300)}`); }
    // a write-up that names nobody else carries no warning
    const clean = await call("POST", "/api/incidents", P.token, { kind: "accident", date: today(), childId: avaId, childName: avaName, description: "Grazed a knee", severity: "minor" });
    assert.equal(clean.json.warning, undefined);
  });
  it("two simultaneous acknowledgements make one staff bell; another family's record is not found", async () => {
    const avaName = (await db.collection("children").doc(avaId).get()).get("name") as string;
    const inc = await call("POST", "/api/incidents", P.token, { kind: "accident", date: today(), childId: avaId, childName: avaName, description: "Grazed a knee", severity: "minor" });
    assert.equal(inc.status, 201, JSON.stringify(inc.json));
    const id = inc.json.id as string;
    await sleep(800);
    const acks = await Promise.all([call("POST", `/api/incidents/${id}/acknowledge`, A.token, {}), call("POST", `/api/incidents/${id}/acknowledge`, A.token, {})]);
    assert.deepEqual(acks.map((r) => r.status), [200, 200]);
    await sleep(2000);
    const staffBells = (await bells(id)).filter((n) => /acknowledged/i.test(String(n.title)));
    assert.equal(staffBells.length, 1, `staff bells: ${staffBells.length}`);
    // another family's record id is not found
    const other = await call("POST", `/api/incidents/${id}/acknowledge`, B.token, {});
    assert.equal(other.status, 404);
  });
});

describe("P34: a meal-option order warns about the child's allergies (one rule for every path)", () => {
  const order = (optionId: string, childId: string, name: string) => call("POST", "/api/meal-orders", A.token, { tenantId: P.tenantId, date: "2030-01-07", childName: name, childId, items: [{ optionId, qty: 1 }] });
  it("nuts, dairy, gluten, egg and 'allergens not listed'", async () => {
    await book(A, L); // the family holds a booking with the provider
    const opt = async (name: string, allergens?: string[]) => (await ok("POST", "/api/meal-options", P.token, { name, price: 3.5, ...(allergens ? { allergens } : {}) })).id as string;
    const satay = await opt(`Satay ${uniq()}`, ["peanuts"]);
    const yoghurt = await opt(`Yoghurt ${uniq()}`, ["Dairy"]);
    const pasta = await opt(`Pasta ${uniq()}`, ["gluten"]);
    const omelette = await opt(`Omelette ${uniq()}`, ["eggs"]);
    const mystery = await opt(`Mystery ${uniq()}`);
    const plain = await opt(`Rice ${uniq()}`, []);
    const kid = await mkChild(A, `Allergic${uniq()}`);
    const nm = (await db.collection("children").doc(kid).get()).get("name") as string;
    const setAllergy = (a: string) => db.collection("children").doc(kid).set({ allergies: a }, { merge: true });
    const warns = async (o: string) => (await order(o, kid, nm)).json.warnings as string[] | undefined;
    await setAllergy("nut allergy");
    assert.ok((await warns(satay))?.[0]?.includes("peanuts"), "nut allergy meets peanuts");
    assert.equal(await warns(plain), undefined, "a dish declared allergen-free is quiet");
    assert.ok(/allergens not listed/i.test((await warns(mystery))?.[0] ?? ""), "no allergen data is never silent");
    await setAllergy("dairy");
    assert.ok((await warns(yoghurt))?.length, "dairy meets milk/dairy");
    await setAllergy("wheat intolerance");
    assert.ok((await warns(pasta))?.length, "wheat meets gluten");
    await setAllergy("Egg");
    assert.ok((await warns(omelette))?.length, "egg meets eggs");
    const stored = (await db.collection("mealOrders").where("childId", "==", kid).get()).docs.filter((d) => d.get("allergenWarning")?.length);
    assert.ok(stored.length >= 4, "the order itself carries the flag for the provider");
  });
});

describe("P25: the family's data export holds only this family's data", () => {
  it("no other child, other family's reply or uid, provider notes or staff email", async () => {
    // Fresh children (the incident test above wrote a shareable accident that names Ben: that free text is the safeguarding branch's allow-list).
    const NAME_B = `Eli${uniq()}`;
    const avaName = `Dee${uniq()}`;
    const avaId = await mkChild(A, avaName);
    const benId = await mkChild(B, NAME_B);
    assert.ok((await bookChild(A, avaId, avaName)).status < 300);
    assert.ok((await bookChild(B, benId, NAME_B)).status < 300);
    const m = await call("POST", "/api/moments", P.token, { caption: "Group shot", photoType: "work", childIds: [avaId, benId], date: today() });
    assert.equal(m.status, 201, JSON.stringify(m.json));
    const mid = m.json.id as string;
    assert.equal((await call("POST", `/api/moments/${mid}/comment`, B.token, { text: "B-REPLY-BEN" })).status, 200);
    assert.equal((await call("POST", `/api/moments/${mid}/comment`, A.token, { text: "A-OWN-REPLY" })).status, 200);
    // provider-internal notes on A's own booking and payment
    const bk = (await db.collection("bookings").where("email", "==", A.email).get()).docs[0];
    await bk.ref.set({ recon: { note: "RECON-SECRET" }, reconNotes: [{ at: "x", by: P.email, text: "RECONNOTE-SECRET" }] }, { merge: true });
    await db.collection("payments").add({ tenantId: P.tenantId, refs: [bk.get("ref")], email: A.email, type: "refund", amount: 5, status: "to-reimburse", note: "PAYNOTE-SECRET", createdAt: new Date().toISOString() });
    await db.collection("medicationAdmin").add({ childId: avaId, tenantId: P.tenantId, name: "Calpol", at: new Date().toISOString(), by: P.email });
    const exp = await call("GET", "/api/privacy/export", A.token);
    assert.equal(exp.status, 200);
    const text = JSON.stringify(exp.json);
    const bUid = await uidOf(B.email);
    for (const bad of [NAME_B, benId, bUid, B.email, "B-REPLY-BEN", "RECON-SECRET", "RECONNOTE-SECRET", "PAYNOTE-SECRET", P.email]) assert.ok(!text.includes(bad), `export leaks ${bad}`);
    // deep-key scan: no forbidden key at any depth
    const forbidden = /^(recon|reconNotes|reconciledBy|postedBy|senderUid|staffJoined|stripeAccount|checkoutId)$/i;
    const hits: string[] = [];
    (function walk(v: unknown, path: string) {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (forbidden.test(k)) hits.push(`${path}.${k}`); walk(x, `${path}.${k}`); }
    })(exp.json, "$");
    assert.deepEqual(hits, []);
    // what IS theirs is still there
    assert.ok(text.includes("A-OWN-REPLY"));
    assert.ok(text.includes(avaName));
    const mo = exp.json.moments.find((x: any) => x.id === mid);
    assert.deepEqual(mo.childIds, [avaId]);
  });
});
