// Behaviour tests (npm run test:emu): how add-ons are SHOWN - Add-on orders, the register, the two emails and Finance Insights.
// Cases AD09, AD13, AD18, AD19, AD21, AM01 of ~/ActivityOS-QA/runs/addons-2026-10-08/CASES-v2.md, with AD12, AD14, AD17 as regressions.
// Real API + Firestore emulator; every booking goes through POST /api/my/bookings, every move/cancel through the real operator routes.
// Expected values are worked by hand from the owner's rules (see CASES-v2), not from what the code does.
//   - a PER-DAY add-on shows on every day it was bought for; a ONE-OFF add-on (T-shirt) shows ONCE, on the child's first day;
//   - unpaid / awaiting-approval bookings DO show, flagged "not-paid" / "awaiting-approval"; cancelled, declined, waitlisted never show;
//   - the family email of a split booking shows the add-on once, for all its days, with the total across the references;
//   - the provider's new-booking email lists each child's extras WITH their days;
//   - Finance Insights counts add-ons by quantity (a per-day add-on counts its days).
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, ADDON_DEFS, as, bookWithAddons, call, day, ids, kitDay, login, operatorAction, registerDay, seedAddons, ukDay } from "../../scripts/emu/addons-helpers.mts";
import { addonFigures } from "../../features/money/addonFigures.ts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-18" -> "18 Oct" (the day phrase an email must contain, whatever weekday prefix it uses). */
const short = (iso: string) => `${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}`;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// ── readers (what the provider's screens would get) ────────────────────────────────────────────────
interface KitRow { item: string; child: string; ref: string; flag?: string }
async function kitRows(d: string | number, who = "P"): Promise<KitRow[]> {
  const r = await kitDay(d, {}, who);
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 300));
  return (r.json.groups as any[]).flatMap((g) => g.children.map((c: any) => ({ item: `${g.name}${g.choiceValue ? ` (${g.choiceValue})` : ""}`, child: c.child, ref: c.ref, flag: c.flag })));
}
const kitFor = async (d: string | number, child: string) => (await kitRows(d)).filter((k) => k.child === child);
interface RegRow { addons: string[]; flag?: string; status: string }
async function regRows(d: string | number, child: string, listing = "LK"): Promise<RegRow[]> {
  const r = await registerDay(d);
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 300));
  const lid = ids().listings[listing].id;
  return (r.json as any[]).filter((s) => s.listingId === lid).flatMap((s) => s.attendees as any[])
    .filter((a) => a.children?.[0]?.name === child).map((a) => ({ addons: a.addons ?? [], flag: a.addonFlag, status: a.bookingStatus }));
}
/** Every register line for this child on this day, flattened. */
const regLines = async (d: string | number, child: string, listing = "LK") => (await regRows(d, child, listing)).flatMap((r) => r.addons);

async function mailTo(to: string, match: (subject: string, body: string) => boolean): Promise<{ subject: string; text: string }[]> {
  const db = await adminDb();
  const until = Date.now() + 10_000;
  for (;;) {
    const snap = await db.collection("mailLog").where("to", "==", to).get();
    const hits = snap.docs.map((d) => d.data() as { subject: string; html?: string }).map((m) => ({ subject: m.subject, text: text(m.html ?? "") })).filter((m) => match(m.subject, m.text));
    if (hits.length || Date.now() > until) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ── set-up ────────────────────────────────────────────────────────────────────────────────────────
const D = (n: number) => day(n);
let LW: { id: string; blockId: string; dates: string[] };
let LM: { id: string; blockId: string; dates: string[] }; // manual approval (awaiting approval / decline)

async function makeListing(title: string, o: { mode: "custom" | "weekly"; approval?: boolean; start: string; days: number }) {
  const P = (await login("provider-p@emu.test")).token;
  const must = async (m: string, p: string, b?: unknown) => { const r = await call(m, p, P, b); assert.ok(r.ok, `${m} ${p} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
  const end = new Date(`${o.start}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + o.days - 1);
  const period = await must("POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const passes: any[] = [];
  for (let n = 1; n <= o.days; n++) passes.push(await must("POST", "/api/passes", { name: `${n}-day pass`, days: n }));
  const bundle = await must("POST", "/api/block-bundles", { name: `Emu block ${title}`, periodIds: [period.id], passIds: passes.map((p) => p.id), priced: true, masterPrice: 20 * o.days, calcOn: true });
  const listing = await must("POST", "/api/listings", {
    title, venueId: "emu-venue", runFrom: o.start, runTo: end.toISOString().slice(0, 10), blockMode: o.mode, days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: passes.map((p, i) => ({ name: p.name, price: 20 * (i + 1), days: i + 1 })),
    ...(o.approval ? {} : { bookingType: "auto" }), addonIds: [ADDON_DEFS.AW.id, ADDON_DEFS.AT.id], status: "live", visibility: "public",
  });
  await must("PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const db = await adminDb();
  const blocks = (await db.collection("blocks").where("listingId", "==", listing.id).get()).docs.sort((a, b) => String(a.data().sessions[0].date).localeCompare(String(b.data().sessions[0].date)));
  assert.ok(blocks.length >= 1, "the listing has blocks");
  return { id: listing.id as string, blockId: blocks[0].id, dates: blocks.flatMap((b) => (b.data().sessions as { date: string }[]).map((s) => s.date)).sort() };
}
const qid = () => ids().questionIds;
/** A booking straight on POST /api/my/bookings for a listing that is not in the seed (LM / LW). */
async function bookOn(l: { id: string; blockId: string; dates: string[] }, child: string, o: { addons?: "bottle" | "tshirt" | "both"; dates?: string[]; method?: string } = {}) {
  const dates = o.dates ?? l.dates;
  const addons = [
    ...(o.addons === "bottle" || o.addons === "both" ? [{ id: ADDON_DEFS.AW.id, answers: { [qid().Colour]: "Blue" } }] : []),
    ...(o.addons === "tshirt" || o.addons === "both" ? [{ id: ADDON_DEFS.AT.id, answers: { [qid().Size]: "M" } }] : []),
  ];
  const s = await login("parent-a@emu.test");
  const r = await call("POST", "/api/my/bookings", s.token, { listingId: l.id, blockId: l.blockId, method: o.method ?? "Bank transfer", items: [{ pass: `${dates.length}-day pass`, child, age: 8, dates, ...(addons.length ? { addons } : {}) }] });
  assert.ok(r.status < 300, `book ${child} -> ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`);
  const list: any[] = Array.isArray(r.json) ? r.json : r.json?.bookings ?? [r.json];
  return { refs: list.map((b) => b.ref as string), list, status: list[0]?.status as string };
}

before(async () => {
  await seedAddons();
  // Sunday on or after D1 + 3 so a 7-day run starting there crosses a Monday (weekly mode splits it into 1 + 6 days).
  const d = new Date(`${ukDay(12)}T00:00:00Z`); while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  LW = await makeListing(`LW weekly ${uniq()}`, { mode: "weekly", start: d.toISOString().slice(0, 10), days: 7 });
  LM = await makeListing(`LM approval ${uniq()}`, { mode: "custom", approval: true, start: ids().listings.LK.dates[0], days: 3 });
});

// ── AD13 / AD12 / AD14 ──────────────────────────────────────────────────────────────────────────────
describe("AD13: the register shows a daily add-on every day and a one-off add-on once", () => {
  it("bottle (per day) on D1-D7 and T-shirt (one-off) on D1 only, in the register AND in Add-on orders", async () => {
    const child = `Ad13 ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }, { id: "AT", answers: { Size: "M" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    for (let n = 1; n <= 7; n++) {
      const reg = await regLines(n, child);
      assert.equal(reg.filter((l) => /Water bottle/.test(l)).length, 1, `D${n} register has the bottle once: ${JSON.stringify(reg)}`);
      assert.equal(reg.filter((l) => /T-shirt/.test(l)).length, n === 1 ? 1 : 0, `D${n} register T-shirt count: ${JSON.stringify(reg)}`);
      const kit = (await kitFor(n, child)).map((k) => k.item).sort();
      assert.deepEqual(kit, n === 1 ? ["T-shirt (M)", "Water bottle (Blue)"] : ["Water bottle (Blue)"], `D${n} Add-on orders`);
    }
  });
});
describe("AD12 (regression): a one-off T-shirt is in Add-on orders on D1 only", () => {
  it("T-shirt D1 only, none on D2-D7", async () => {
    const child = `Ad12 ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons: [{ id: "AT", answers: { Size: "M" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    for (let n = 1; n <= 7; n++) assert.deepEqual((await kitFor(n, child)).map((k) => k.item), n === 1 ? ["T-shirt (M)"] : [], `D${n}`);
  });
});
describe("AD14 (regression): a bottle bought for D1, D3, D5 shows on those days only", () => {
  it("kit and register agree", async () => {
    const child = `Ad14 ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons: [{ id: "AW", days: [1, 3, 5], answers: { Colour: "Red" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    for (let n = 1; n <= 7; n++) {
      const want = [1, 3, 5].includes(n);
      assert.equal((await kitFor(n, child)).length, want ? 1 : 0, `D${n} kit`);
      assert.equal((await regLines(n, child)).length, want ? 1 : 0, `D${n} register`);
    }
  });
});

// ── AD17 regression and AD18 ────────────────────────────────────────────────────────────────────────
describe("AD17 (regression): the family moves D3 to D6 with approval - the bottle follows the day", () => {
  it("bottle on D1, D2, D6; not on D3", async () => {
    const P = await login("provider-p@emu.test");
    const lib = (await call("GET", "/api/library", P.token)).json;
    await call("PUT", "/api/library", P.token, { settings: { ...(lib.settings ?? {}), allowDateChanges: true } });
    const child = `Ad17 ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1, 2, 3], addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    const am = await as("A", "POST", `/api/my/bookings/${b.refs[0]}/amend`, { moves: [{ childName: child, from: D(3), to: D(6) }], message: "AD17" });
    assert.ok(am.status < 300, `amend ${am.status} ${JSON.stringify(am.json).slice(0, 300)}`);
    const ap = await operatorAction(b.refs[0], "move-approve", {});
    assert.ok(ap.status < 300, `approve ${ap.status} ${JSON.stringify(ap.json).slice(0, 300)}`);
    for (let n = 1; n <= 7; n++) {
      const want = [1, 2, 6].includes(n);
      assert.equal((await kitFor(n, child)).length, want ? 1 : 0, `D${n} kit`);
      assert.equal((await regLines(n, child)).length, want ? 1 : 0, `D${n} register`);
    }
  });
});
describe("AD18: the first day of a booking with a one-off T-shirt is moved", () => {
  it("the T-shirt follows the new first day in Add-on orders and the register (change-day route)", async () => {
    const child = `Ad18 ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1, 2, 3], addons: [{ id: "AT", answers: { Size: "M" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    assert.deepEqual((await kitFor(1, child)).map((k) => k.item), ["T-shirt (M)"], "setup: T-shirt starts on D1");
    const ch = await operatorAction(b.refs[0], "change-day", { ki: 0, oldDate: D(1), newDate: D(5) }); // booking is now D2, D3, D5
    assert.ok(ch.status < 300, `change-day ${ch.status} ${JSON.stringify(ch.json).slice(0, 300)}`);
    for (let n = 1; n <= 7; n++) {
      const want = n === 2;
      assert.equal((await kitFor(n, child)).length, want ? 1 : 0, `D${n} kit`);
      assert.equal((await regLines(n, child)).length, want ? 1 : 0, `D${n} register`);
    }
  });
  it("the T-shirt follows the new first day when the family's date change is approved (amend route)", async () => {
    const P = await login("provider-p@emu.test");
    const lib = (await call("GET", "/api/library", P.token)).json;
    await call("PUT", "/api/library", P.token, { settings: { ...(lib.settings ?? {}), allowDateChanges: true } });
    const child = `Ad18b ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1, 2, 3], addons: [{ id: "AT", answers: { Size: "L" } }] }] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    const am = await as("A", "POST", `/api/my/bookings/${b.refs[0]}/amend`, { moves: [{ childName: child, from: D(1), to: D(5) }], message: "AD18" });
    assert.ok(am.status < 300, `amend ${am.status} ${JSON.stringify(am.json).slice(0, 300)}`);
    assert.ok((await operatorAction(b.refs[0], "move-approve", {})).status < 300);
    for (let n = 1; n <= 7; n++) {
      const want = n === 2;
      assert.equal((await kitFor(n, child)).length, want ? 1 : 0, `D${n} kit`);
      assert.equal((await regLines(n, child)).length, want ? 1 : 0, `D${n} register`);
    }
  });
});

// ── AD19 ────────────────────────────────────────────────────────────────────────────────────────────
describe("AD19: unpaid and awaiting-approval bookings show, flagged; cancelled, declined and waitlisted never show", () => {
  it("unpaid bank transfer: in Add-on orders and the register, flagged not-paid", async () => {
    const child = `Ad19bank ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1, 2], addons: [{ id: "AW", answers: { Colour: "Blue" } }] }], method: "Bank transfer" });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    const k = await kitFor(1, child);
    assert.equal(k.length, 1);
    assert.equal(k[0].flag, "not-paid", "Add-on orders flag");
    const r = await regRows(1, child);
    assert.equal(r.length, 1);
    assert.equal(r[0].addons.length, 1);
    assert.equal(r[0].flag, "not-paid", "register flag");
  });
  it("unpaid card booking: in Add-on orders and the register, flagged not-paid", async () => {
    const child = `Ad19card ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1, 2], addons: [{ id: "AW", answers: { Colour: "Blue" } }] }], method: "Card" });
    assert.ok(b.status < 300, `card booking ${b.status} ${JSON.stringify(b.json).slice(0, 300)}`);
    const bk = (await as("P", "GET", `/api/bookings/${encodeURIComponent(b.refs[0])}`)).json;
    assert.equal(bk.pay, "Unpaid", "setup: the card booking is unpaid");
    const k = await kitFor(1, child);
    assert.equal(k.length, 1, `status ${bk.status}`);
    assert.equal(k[0].flag, "not-paid");
    assert.equal((await regRows(1, child))[0]?.flag, "not-paid");
  });
  it("a PAID booking carries no flag", async () => {
    const child = `Ad19paid ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: [1], addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
    const pr = await as("P", "POST", `/api/bookings/${encodeURIComponent(b.refs[0])}/record-payment`, { amount: b.total!, method: "Bank transfer", reference: `AD19-${uniq()}` });
    assert.ok(pr.status < 300, `record-payment ${pr.status} ${JSON.stringify(pr.json).slice(0, 200)}`);
    const k = await kitFor(1, child);
    assert.equal(k.length, 1);
    assert.equal(k[0].flag, undefined);
    assert.equal((await regRows(1, child))[0]?.flag, undefined);
  });
  it("awaiting approval: in Add-on orders and the register, flagged awaiting-approval", async () => {
    const child = `Ad19appr ${uniq()}`;
    const b = await bookOn(LM, child, { addons: "bottle", dates: LM.dates.slice(0, 2) });
    assert.equal(b.status, "Approval needed", "setup: manual-approval listing");
    const k = (await kitRows(LM.dates[0])).filter((x) => x.child === child);
    assert.equal(k.length, 1, "shows in Add-on orders");
    assert.equal(k[0].flag, "awaiting-approval");
    const r = (await registerDay(LM.dates[0])).json as any[];
    const att = r.filter((s) => s.listingId === LM.id).flatMap((s) => s.attendees).filter((a: any) => a.children[0].name === child);
    assert.equal(att.length, 1, "shows on the register");
    assert.equal(att[0].addons.length, 1);
    assert.equal(att[0].addonFlag, "awaiting-approval");
  });
  it("cancelled, declined and waitlisted bookings never show", async () => {
    // cancelled (operator cancel of a confirmed unpaid booking)
    const cc = `Ad19canc ${uniq()}`;
    const bc = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: cc, days: [1], addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
    assert.equal((await kitFor(1, cc)).length, 1, "setup: shows before cancelling");
    assert.ok((await operatorAction(bc.refs[0], "cancel", { refund: "none" })).status < 300);
    assert.equal((await kitFor(1, cc)).length, 0, "cancelled: kit");
    assert.equal((await regLines(1, cc)).length, 0, "cancelled: register");
    // declined (manual-approval request declined)
    const cd = `Ad19decl ${uniq()}`;
    const bd = await bookOn(LM, cd, { addons: "bottle", dates: LM.dates.slice(0, 2) });
    assert.equal((await kitRows(LM.dates[0])).filter((x) => x.child === cd).length, 1, "setup: shows while awaiting approval");
    const dec = await operatorAction(bd.refs[0], "decline", { reason: "Full" });
    assert.ok(dec.status < 300, `decline ${dec.status} ${JSON.stringify(dec.json).slice(0, 200)}`);
    assert.equal((await kitRows(LM.dates[0])).filter((x) => x.child === cd).length, 0, "declined: kit");
    const rd = ((await registerDay(LM.dates[0])).json as any[]).flatMap((s) => s.attendees).filter((a: any) => a.children[0].name === cd);
    assert.equal(rd.filter((a: any) => a.addons.length).length, 0, "declined: register shows no add-ons");
    // waitlisted (operator moves an approval request to the waiting list)
    const cw = `Ad19wait ${uniq()}`;
    const bw = await bookOn(LM, cw, { addons: "bottle", dates: LM.dates.slice(0, 2) });
    const wl = await call("POST", "/api/bookings/bulk", (await login("provider-p@emu.test")).token, { refs: [bw.refs[0]], action: "waitlist" });
    assert.ok(wl.status < 300, `waitlist ${wl.status} ${JSON.stringify(wl.json).slice(0, 200)}`);
    assert.equal(((await as("P", "GET", `/api/bookings/${encodeURIComponent(bw.refs[0])}`)).json as any).status, "Waitlisted", "setup: waitlisted");
    assert.equal((await kitRows(LM.dates[0])).filter((x) => x.child === cw).length, 0, "waitlisted: kit");
    const rw = ((await registerDay(LM.dates[0])).json as any[]).flatMap((s) => s.attendees).filter((a: any) => a.children[0].name === cw);
    assert.equal(rw.filter((a: any) => a.addons.length).length, 0, "waitlisted: register shows no add-ons");
  });
});

// ── AD09 and AD21: the emails ───────────────────────────────────────────────────────────────────────
describe("AD09: the provider's new-booking email lists each child's extras with their days", () => {
  it("child 1 bottle on 7 days, child 2 bottle on 3 days", async () => {
    const c1 = `Ad09one ${uniq()}`, c2 = `Ad09two ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [
      { name: c1, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] },
      { name: c2, days: [1, 2, 3], addons: [{ id: "AW", answers: { Colour: "Blue" } }] },
    ] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    const mails = await mailTo("provider-p@emu.test", (s, t) => s.includes(b.refs[0]) && t.includes(c1));
    assert.equal(mails.length, 1, "one new-booking email to the provider");
    const t = mails[0].text;
    const s1 = t.slice(t.indexOf(c1), t.indexOf(c2));
    const s2 = t.slice(t.indexOf(c2), t.indexOf(c2) + 700);
    assert.match(s1, /Water bottle \(Blue\)/);
    assert.match(s1, /7 days/, `child 1 section: ${s1.slice(0, 400)}`);
    assert.ok(s1.includes(short(D(1))) && s1.includes(short(D(7))), `child 1 days named: ${s1.slice(0, 400)}`);
    assert.match(s2, /Water bottle \(Blue\)/);
    assert.match(s2, /3 days/, `child 2 section: ${s2.slice(0, 400)}`);
    assert.ok(s2.includes(short(D(1))) && s2.includes(short(D(3))), `child 2 days named: ${s2.slice(0, 400)}`);
  });
  it("a one-off T-shirt names its day", async () => {
    const c = `Ad09tee ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: c, days: [2, 3, 4], addons: [{ id: "AT", answers: { Size: "M" } }] }] });
    const mails = await mailTo("provider-p@emu.test", (s, t) => s.includes(b.refs[0]) && t.includes(c));
    assert.equal(mails.length, 1);
    const sec = mails[0].text.slice(mails[0].text.indexOf(c), mails[0].text.indexOf(c) + 500);
    assert.match(sec, /T-shirt \(M\)/);
    assert.ok(sec.includes(short(D(2))), `T-shirt day named: ${sec}`);
  });
});

describe("AD21: a 7-day bottle over a Monday makes two bookings - one clear picture for the family and the provider", () => {
  let refs: string[]; let child: string;
  before(async () => {
    child = `Ad21 ${uniq()}`;
    const b = await bookOn(LW, child, { addons: "bottle" });
    refs = b.refs;
  });
  it("setup: the checkout made two references (1 + 6 days)", () => { assert.equal(refs.length, 2, JSON.stringify(refs)); });
  it("the family confirmation email shows the bottle ONCE, for 7 days, with the £21.00 total across the references", async () => {
    const mails = await mailTo("parent-a@emu.test", (s, t) => t.includes(child) && refs.every((r) => t.includes(r)));
    assert.equal(mails.length, 1, `one confirmation covering both references (got ${mails.length})`);
    const t = mails[0].text;
    const extras = t.slice(t.indexOf("Extras"), t.indexOf("Dates"));
    assert.equal((extras.match(/Water bottle/g) ?? []).length, 1, `bottle listed once: ${extras}`);
    assert.match(extras, /7 days/);
    assert.match(extras, /£21\.00/);
    assert.ok(!/£3\.00/.test(extras) && !/£18\.00/.test(extras), `no per-reference amounts: ${extras}`);
  });
  it("Add-on orders and the register show the bottle ONCE on each of the 7 days", async () => {
    for (let i = 0; i < 7; i++) {
      const d = LW.dates[i];
      const kit = (await kitRows(d)).filter((k) => k.child === child);
      assert.equal(kit.length, 1, `${d} Add-on orders: ${JSON.stringify(kit)}`);
      const att = ((await registerDay(d)).json as any[]).filter((s) => s.listingId === LW.id).flatMap((s) => s.attendees).filter((a: any) => a.children[0].name === child);
      assert.equal(att.flatMap((a: any) => a.addons).length, 1, `${d} register`);
    }
  });
});

describe("AD21: the month tally counts the 7 bottles once each, not once per reference", () => {
  it("7 more bottles over the 7 days (the tally spans both weekly blocks)", async () => {
    const child = `Ad21tally ${uniq()}`;
    const r0 = await as("P", "GET", `/api/kit/days?from=${LW.dates[0]}&to=${LW.dates[6]}`);
    const before = Number(r0.json.totals?.["Water bottle"] ?? 0);
    await bookOn(LW, child, { addons: "bottle" });
    const r1 = await as("P", "GET", `/api/kit/days?from=${LW.dates[0]}&to=${LW.dates[6]}&name=Water%20bottle`); // different cache key from r0
    assert.equal(Number(r1.json.totals?.["Water bottle"] ?? 0) - before, 7);
  });
});

// ── AM01 ────────────────────────────────────────────────────────────────────────────────────────────
describe("AM01: Finance Insights counts add-ons by quantity", () => {
  it("child 1 bottle x 7 days + child 2 bottle x 3 days = 10 units, revenue £30.00, 1 booking with add-ons", async () => {
    const c1 = `Am01one ${uniq()}`, c2 = `Am01two ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [
      { name: c1, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] },
      { name: c2, days: [1, 2, 3], addons: [{ id: "AW", answers: { Colour: "Blue" } }] },
    ] });
    assert.ok(b.status < 300, JSON.stringify(b.json).slice(0, 300));
    assert.equal(b.total, 230, "setup: AD03 total");
    const pr = await as("P", "POST", `/api/bookings/${encodeURIComponent(b.refs[0])}/record-payment`, { amount: 230, method: "Bank transfer", reference: `AM01-${uniq()}` });
    assert.ok(pr.status < 300);
    const all: any[] = (await as("P", "GET", "/api/bookings")).json;
    const mine = all.filter((x) => b.refs.includes(x.ref));
    assert.equal(mine.length, 1);
    const f = addonFigures(mine);
    assert.equal(f.addonUnits, 10, "units counted by quantity");
    assert.equal(Math.round(f.addonRevenue * 100) / 100, 30);
    assert.equal(f.bookingsWithAddon, 1);
    assert.equal(f.byName.get("Water bottle")?.count, 10, "per add-on name too");
  });
  it("a one-off T-shirt counts as 1 unit; a quantity-2 line counts 2", () => {
    const f = addonFigures([
      { addons: ["T-shirt (Size: M) — £8.00"], addonLines: [{ child: "x", label: "T-shirt (Size: M)", price: 8, perDay: false, qty: 1 }] },
      { addons: ["Hoodie × 2 — £20.00"], addonLines: [{ child: "y", label: "Hoodie × 2", price: 20, perDay: false, qty: 2 }] },
    ] as never);
    assert.equal(f.addonUnits, 3);
    assert.equal(f.addonRevenue, 28);
    assert.equal(f.bookingsWithAddon, 2);
  });
});
