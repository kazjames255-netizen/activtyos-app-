// Behaviour tests (npm run test:emu): the WORDING of the bells for a family's request to change / cancel an extra (owner feedback, 9 Oct).
// Real API + Firestore emulator. Synthetic data only. The provider's bell says what is asked, for whom, which day, with no price on a plain
// change; the family's bell says what happened in the choice names; both carry key + data so the browser shows them in the viewer's language.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });

before(async () => { await seedAddons({}); });

async function mk(tag: string, o: { paid?: boolean } = {}) {
  await (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`).set({ balance: 0 }, { merge: true });
  const child = `${tag} ${uniq()}`;
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons: [SHIRT("M")] }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const ref = b.refs[0];
  if (o.paid) assert.equal((await operatorAction(ref, "paid")).status, 200);
  return { ref, child };
}
const keyOf = async (ref: string) => {
  const r = await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`);
  const l = r.json.lines.find((x: any) => x.name === "T-shirt");
  assert.ok(l, "no T-shirt line");
  return l.key as string;
};
const req = (ref: string, body: unknown) => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, body);
const bells = async (ref: string, audience: "tenant" | "parent") => {
  const db = await adminDb();
  const s = await db.collection("notifications").where("ref", "==", ref).get();
  return s.docs.map((d) => d.data() as any).filter((n) => n.audience === audience && /addon-request|booking/.test(String(n.key ?? n.category ?? ""))).sort((a, b) => String(a.at ?? a.createdAt ?? "").localeCompare(String(b.at ?? b.createdAt ?? "")));
};
// (the API raises a bell without waiting for it, so look for a few seconds)
const waitBell = async (ref: string, audience: "tenant" | "parent", re: RegExp) => {
  for (let i = 0; i < 40; i++) {
    const n = (await bells(ref, audience)).filter((b) => re.test(b.title));
    if (n.length) return n[n.length - 1];
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.fail(`no ${audience} bell matching ${re}`);
};
const providerBell = (ref: string, re: RegExp) => waitBell(ref, "tenant", re);
const parentBell = (ref: string, re: RegExp) => waitBell(ref, "parent", re);

// (mail is sent without the API waiting for it, so look for a few seconds)
const mailsFor = async (pick: (m: any) => boolean) => {
  const db = await adminDb();
  for (let i = 0; i < 40; i++) {
    const hit = (await db.collection("mailLog").get()).docs.map((d) => d.data() as any).filter(pick);
    if (hit.length) return hit;
    await new Promise((r) => setTimeout(r, 150));
  }
  return [];
};

describe("the provider's bell for a NEW request", () => {
  it("a size change: names the extra, the child and the choices; no price; key + data stored", async () => {
    const { ref, child } = await mk("wsz", { paid: true });
    const r = await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "L" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.deepEqual(r.json.from, { Size: "M" });
    const n = await providerBell(ref, /^Change request/);
    assert.equal(n.title, "Change request: T-shirt");
    assert.equal(n.body, `${child} asked to change T-shirt Size from M to L (booking ${ref}). Approve or decline.`);
    assert.ok(!/£|×/.test(`${n.title} ${n.body}`), "no price and no raw label");
    assert.equal(n.i18n.tk, "p7shell.xrTReqChange");
    assert.equal(n.i18n.bk, "p7shell.xrReqChange");
    assert.deepEqual([n.i18n.bv.c1q, n.i18n.bv.c1from, n.i18n.bv.c1to], ["Size", "M", "L"]);
    assert.ok(!/£/.test(JSON.stringify(n.i18n)));
  });

  it("a cancel of a PAID extra says what can be refunded; an unpaid one shows no money", async () => {
    const paid = await mk("wcp", { paid: true });
    assert.equal((await req(paid.ref, { kind: "cancel", targets: [{ key: await keyOf(paid.ref) }] })).status, 201);
    const n = await providerBell(paid.ref, /^Cancel request/);
    assert.equal(n.title, "Cancel request: T-shirt");
    assert.match(n.body, new RegExp(`^${paid.child} asked to cancel T-shirt( on [A-Z][a-z]{2} \\d{1,2} [A-Z][a-z]{2})? \\(booking ${paid.ref}\\)\\. £8\\.00 can be refunded\\. Approve or decline\\.$`));
    const unpaid = await mk("wcu");
    assert.equal((await req(unpaid.ref, { kind: "cancel", targets: [{ key: await keyOf(unpaid.ref) }] })).status, 201);
    const u = await providerBell(unpaid.ref, /^Cancel request/);
    assert.ok(!/£/.test(u.body), u.body);
    assert.match(u.body, /Approve or decline\.$/);
  });

  it("the provider's email uses the same sentence", async () => {
    const { ref, child } = await mk("wem");
    assert.equal((await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "S" } })).status, 201);
    const mails = await mailsFor((x) => String(x.subject ?? "").includes(ref) && /Change request: T-shirt/.test(x.subject));
    const m = mails[0];
    assert.ok(m, `no provider email`);
    assert.ok(String(m.html ?? "").includes(`${child} asked to change T-shirt Size from M to S`), "email carries the plain sentence");
    assert.ok(!/£/.test(String(m.html)), "a plain change shows no price");
  });
});

describe("the family's bell for the ANSWER", () => {
  it("approved size change: 'Your T-shirt change was approved' with from/to in the choice names", async () => {
    const { ref, child } = await mk("wok");
    const r = await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "L" } });
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id })).status, 200);
    const n = await parentBell(ref, /change was approved/);
    assert.equal(n.title, "Your T-shirt change was approved");
    assert.match(n.body, new RegExp(`^${child}'s T-shirt changed from Size M to Size L \\(.+, ${ref}\\)\\.$`));
    assert.ok(!/×/.test(n.body));
    assert.equal(n.i18n.tk, "p7shell.xrTOkChange");
    assert.equal(n.i18n.bk, "p7shell.xrBOkChange");
    assert.equal(n.i18n.bv.c1to, "L");
  });

  it("declined with a reason: title says declined, the reason is its own sentence", async () => {
    const { ref } = await mk("wno");
    const r = await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "S" } });
    assert.equal((await operatorAction(ref, "addon-decline", { requestId: r.json.id, reason: "Sold out in S." })).status, 200);
    const n = await parentBell(ref, /was declined/);
    assert.equal(n.title, "Your request to change T-shirt was declined");
    assert.match(n.body, /^Your T-shirt stays as it was \(.+\)\. Reason: Sold out in S\.$/);
    assert.equal(n.i18n.more[0].k, "p7shell.xrReason");
  });

  it("approved cancel follows the REAL money outcome: wallet, refund, nothing", async () => {
    const w = await mk("wcw", { paid: true });
    const rw = await req(w.ref, { kind: "cancel", targets: [{ key: await keyOf(w.ref) }] });
    assert.equal((await operatorAction(w.ref, "addon-approve", { requestId: rw.json.id, resolution: "wallet", amount: 8 })).status, 200);
    const nw = await parentBell(w.ref, /cancellation was approved/);
    assert.equal(nw.title, "Your T-shirt cancellation was approved");
    assert.match(nw.body, /was cancelled \(.+\)\. £8\.00 was added to your wallet\.$/);

    const none = await mk("wcn");
    const rn = await req(none.ref, { kind: "cancel", targets: [{ key: await keyOf(none.ref) }] });
    assert.equal((await operatorAction(none.ref, "addon-approve", { requestId: rn.json.id })).status, 200);
    const nn = await parentBell(none.ref, /cancellation was approved/);
    assert.match(nn.body, /was cancelled \(.+\)\. Nothing to refund\.$/);
  });

  it("a bank-transfer refund is only RECORDED: bell and email never say 'on its way' before the provider sends it", async () => {
    const { ref } = await mk("wrr", { paid: true });
    const r = await req(ref, { kind: "cancel", targets: [{ key: await keyOf(ref) }] });
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id, resolution: "refund", amount: 8 })).status, 200);
    const n = await parentBell(ref, /cancellation was approved/);
    assert.match(n.body, /Refund recorded: .+ will send your £8\.00 bank transfer refund$/);
    assert.ok(!/on its way/.test(n.body));
    const mails = await mailsFor((m) => m.to === "parent-a@emu.test" && /cancellation was approved/.test(String(m.subject)) && String(m.html ?? "").includes(ref));
    assert.ok(mails.length, "no family email");
    assert.match(String(mails[0].html), /Refund recorded: .+ will send your £8\.00 bank transfer refund/);
    assert.ok(!/on its way/.test(String(mails[0].html)));
  });

  it("the family's email says the same", async () => {
    const { ref } = await mk("wfe");
    const r = await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "L" } });
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id })).status, 200);
    const mails = await mailsFor((m) => m.to === "parent-a@emu.test" && /Your T-shirt change was approved/.test(String(m.subject)) && String(m.html ?? "").includes(ref));
    assert.ok(mails.length, "no family email");
    assert.match(String(mails[0].html), /changed from Size M to Size L/);
  });
});

describe("withdrawn, and what staff may see", () => {
  it("withdrawing tells the provider in plain words", async () => {
    const { ref, child } = await mk("wwd");
    const r = await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "S" } });
    const w = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests/${encodeURIComponent(r.json.id)}/withdraw`, {});
    assert.equal(w.status, 200, JSON.stringify(w.json));
    const n = await providerBell(ref, /^Request withdrawn/);
    assert.equal(n.title, "Request withdrawn: T-shirt");
    assert.equal(n.body, `${child} withdrew their request to change T-shirt (booking ${ref}).`);
  });

  it("staff never receive these bells (booking alerts are not in their team bell) and no price reaches them in any bell text", async () => {
    const { ref } = await mk("wst", { paid: true });
    assert.equal((await req(ref, { key: await keyOf(ref), kind: "change", answers: { Size: "L" } })).status, 201);
    await providerBell(ref, /^Change request/);
    const r = await as("S2", "GET", "/api/notifications");
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    const mine = (r.json.notifications as any[]).filter((n) => String(n.body).includes(ref));
    assert.equal(mine.length, 0, "a request bell is a booking alert: staff do not get it");
    for (const n of r.json.notifications as any[]) assert.ok(!/£\s?\d/.test(`${n.title} ${n.body}`), `a price reached staff: ${n.body}`);
  });
});
