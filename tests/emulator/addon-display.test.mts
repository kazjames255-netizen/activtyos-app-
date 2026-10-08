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
let LE: { id: string; blockId: string; dates: string[] }; // run Sun 31 Jan - Sat 6 Feb 2027: split at the month end (Monday 1 Feb)
let L3: { id: string; blockId: string; dates: string[] }; // three weekly blocks
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
  LE = await makeListing(`LE month-end ${uniq()}`, { mode: "weekly", start: "2027-01-31", days: 7 });
  { const d3 = new Date(`${ukDay(30)}T00:00:00Z`); while (d3.getUTCDay() !== 0) d3.setUTCDate(d3.getUTCDate() + 1);
    L3 = await makeListing(`L3 three weeks ${uniq()}`, { mode: "weekly", start: d3.toISOString().slice(0, 10), days: 15 }); }
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

// ══════════════════════════════ ROUND 2 ══════════════════════════════
// V05: a ONE-OFF add-on is stored on the FIRST reference of a split checkout. When that reference is cancelled or emptied while the child still attends the
// other one, the paid T-shirt must show on the first day of the earliest REMAINING part. Money is not touched: the price stays on the original line.
async function split(l: { id: string; blockId: string; dates: string[] }, kids: { name: string; tshirt?: boolean; bottle?: boolean }[]) {
  const items = kids.map((k) => ({
    pass: `${l.dates.length}-day pass`, child: k.name, age: 8, dates: l.dates,
    addons: [
      ...(k.tshirt ? [{ id: ADDON_DEFS.AT.id, answers: { [qid().Size]: "M" } }] : []),
      ...(k.bottle ? [{ id: ADDON_DEFS.AW.id, answers: { [qid().Colour]: "Blue" } }] : []),
    ],
  }));
  const s = await login("parent-a@emu.test");
  const r = await call("POST", "/api/my/bookings", s.token, { listingId: l.id, blockId: l.blockId, method: "Bank transfer", items });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list: any[] = Array.isArray(r.json) ? r.json : r.json?.bookings ?? [r.json];
  assert.equal(list.length, 2, `setup: the checkout split into two references: ${list.map((b) => b.ref)}`);
  const sorted = [...list].sort((a, b) => String(a.days[0]).localeCompare(String(b.days[0])));
  return { first: sorted[0].ref as string, second: sorted[1].ref as string };
}
/** Which days of the run show this child's T-shirt in Add-on orders / the register. */
async function teeDays(l: { id: string; dates: string[] }, child: string, listingKey = "") {
  const kit: string[] = [], reg: string[] = [];
  for (const d of l.dates) {
    if ((await kitRows(d)).some((k) => k.child === child && k.item.startsWith("T-shirt"))) kit.push(d);
    const att = ((await registerDay(d)).json as any[]).filter((s) => s.listingId === l.id).flatMap((s) => s.attendees).filter((a: any) => a.children[0].name === child);
    if (att.some((a: any) => a.addons.some((x: string) => /T-shirt/.test(x)))) reg.push(d);
  }
  void listingKey;
  return { kit, reg };
}
const dayAfterFirst = (l: { dates: string[] }) => l.dates[1];


for (const which of ["LW", "LE"] as const) {
  const L = () => (which === "LW" ? LW : LE);
  describe(`V05 (${which}): the one-off follows the earliest remaining part of a split checkout`, () => {
    it("setup shows the T-shirt once, on the first day only", async () => {
      const c = `V05s ${uniq()}`;
      await split(L(), [{ name: c, tshirt: true }]);
      const t = await teeDays(L(), c);
      assert.deepEqual(t.kit, [L().dates[0]]);
      assert.deepEqual(t.reg, [L().dates[0]]);
    });
    it("cancel-day of the first reference's only day: the T-shirt moves to the next attended day, once", async () => {
      const c = `V05a ${uniq()}`;
      const r = await split(L(), [{ name: c, tshirt: true, bottle: true }]);
      const res = await operatorAction(r.first, "cancel-day", { ki: 0, date: L().dates[0], resolution: "none" });
      assert.ok(res.status < 300, `cancel-day ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`);
      const t = await teeDays(L(), c);
      assert.deepEqual(t.kit, [dayAfterFirst(L())], "Add-on orders");
      assert.deepEqual(t.reg, [dayAfterFirst(L())], "register");
    });
    it("cancelling the whole first reference: same", async () => {
      const c = `V05b ${uniq()}`;
      const r = await split(L(), [{ name: c, tshirt: true }]);
      const res = await operatorAction(r.first, "cancel", { refund: "none" });
      assert.ok(res.status < 300);
      const t = await teeDays(L(), c);
      assert.deepEqual(t.kit, [dayAfterFirst(L())]);
      assert.deepEqual(t.reg, [dayAfterFirst(L())]);
    });
    it("cancelling only the SECOND reference: the T-shirt stays on the first day", async () => {
      const c = `V05c ${uniq()}`;
      const r = await split(L(), [{ name: c, tshirt: true }]);
      assert.ok((await operatorAction(r.second, "cancel", { refund: "none" })).status < 300);
      const t = await teeDays(L(), c);
      assert.deepEqual(t.kit, [L().dates[0]]);
      assert.deepEqual(t.reg, [L().dates[0]]);
    });
    it("two children: cancelling the first reference moves BOTH T-shirts, once each; cancelling one child moves only that child's", async () => {
      const a = `V05d1 ${uniq()}`, b = `V05d2 ${uniq()}`;
      const r = await split(L(), [{ name: a, tshirt: true }, { name: b, tshirt: true }]);
      assert.ok((await operatorAction(r.first, "cancel", { refund: "none" })).status < 300);
      for (const c of [a, b]) {
        const t = await teeDays(L(), c);
        assert.deepEqual(t.kit, [dayAfterFirst(L())], `${c} Add-on orders`);
        assert.deepEqual(t.reg, [dayAfterFirst(L())], `${c} register`);
      }
      const x = `V05e1 ${uniq()}`, y = `V05e2 ${uniq()}`;
      const r2 = await split(L(), [{ name: x, tshirt: true }, { name: y, tshirt: true }]);
      const bk = (await as("P", "GET", `/api/bookings/${encodeURIComponent(r2.first)}`)).json;
      const ki = (bk.kids as any[]).findIndex((k) => k.name === x);
      assert.ok(ki >= 0, "setup: kid index");
      assert.ok((await operatorAction(r2.first, "cancel-child", { ki, resolution: "none" })).status < 300);
      assert.deepEqual((await teeDays(L(), x)).kit, [dayAfterFirst(L())], "cancelled child's T-shirt moves");
      assert.deepEqual((await teeDays(L(), y)).kit, [L().dates[0]], "the other child's stays");
    });
  });
}

describe("V05 money: the one-off's price is still counted once", () => {
  it("booking amounts and Finance units are unchanged by the cancellation", async () => {
    const c = `V05m ${uniq()}`;
    const r = await split(LW, [{ name: c, tshirt: true }]);
    await operatorAction(r.first, "cancel-day", { ki: 0, date: LW.dates[0], resolution: "none" });
    const all: any[] = (await as("P", "GET", "/api/bookings")).json;
    const mine = all.filter((x) => x.ref === r.first || x.ref === r.second);
    const f = addonFigures(mine);
    assert.equal(f.addonUnits, 1, "one T-shirt, counted once");
    assert.equal(f.addonRevenue, 8);
  });
});

// Register: a per-day add-on's line shows THAT DAY's own quantity (and day-share price), not the whole booking's.
describe("Register: a per-day add-on shows the day's own quantity", () => {
  it("bottle x 7 for £21.00 reads x 1 for £3.00 on each day", async () => {
    const child = `Reg ${uniq()}`;
    const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
    assert.ok(b.status < 300);
    for (const n of [1, 4, 7]) {
      const lines = await regLines(n, child);
      assert.equal(lines.length, 1);
      assert.match(lines[0], /Water bottle × 1\b/, `D${n}: ${lines[0]}`);
      assert.ok(!/× 7/.test(lines[0]) && !/£21\.00/.test(lines[0]), `D${n} shows the whole-booking figure: ${lines[0]}`);
      assert.match(lines[0], /£3\.00/);
    }
  });
});

// X07r: an Offered (waiting-list, not yet accepted) booking is not a sale.
describe("X07r: Finance add-on figures leave out Offered, Declined, Waitlisted and Cancelled bookings", () => {
  it("only the confirmed booking counts", () => {
    const line = [{ child: "x", label: "T-shirt (Size: M)", price: 8, perDay: false, qty: 1 }];
    const mk = (status: string) => ({ status, addons: ["T-shirt (Size: M) — £8.00"], addonLines: line });
    const f = addonFigures([mk("Confirmed"), mk("Offered"), mk("Declined"), mk("Waitlisted"), mk("Cancelled")] as never);
    assert.equal(f.addonUnits, 1);
    assert.equal(f.addonRevenue, 8);
    assert.equal(f.bookingsWithAddon, 1);
  });
});

// Bell: a bottle split over two references is ONE extra, not two.
describe("Bell: the new-booking bell counts extras across the split references", () => {
  it("1 bottle over 2 references says 1 extra", async () => {
    const child = `Bell ${uniq()}`;
    const r = await split(LW, [{ name: child, bottle: true }]);
    const db = await adminDb();
    const until = Date.now() + 8000;
    let body = "";
    while (Date.now() < until && !body) {
      const snap = await db.collection("notifications").get().catch(() => null);
      const hit = snap?.docs.map((d) => d.data()).find((n: any) => String(n.title ?? "").includes(r.first) || String(n.ref ?? "") === r.first);
      body = String((hit as any)?.body ?? "");
      if (!body) await new Promise((x) => setTimeout(x, 250));
    }
    assert.ok(body, "the bell exists");
    assert.match(body, /\b1 extra\b/, body);
  });
});

// ══════════════════════════════ ROUND 3: a checkout id on every booking ══════════════════════════════
// One id per checkout REQUEST, stamped on every booking that request creates. Providers see it; families never do. Siblings are found by it.
const docOf = async (ref: string) => (await as("P", "GET", `/api/bookings/${encodeURIComponent(ref)}`)).json as any;
async function bookMany(l: { id: string; blockId: string; dates: string[] }, child: string, o: { tshirt?: boolean } = {}) {
  const s = await login("parent-a@emu.test");
  const items = [{ pass: `${l.dates.length}-day pass`, child, age: 8, dates: l.dates, ...(o.tshirt ? { addons: [{ id: ADDON_DEFS.AT.id, answers: { [qid().Size]: "M" } }] } : {}) }];
  const r = await call("POST", "/api/my/bookings", s.token, { listingId: l.id, blockId: l.blockId, method: "Bank transfer", items });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list: any[] = Array.isArray(r.json) ? r.json : r.json?.bookings ?? [r.json];
  return { refs: list.map((b) => b.ref as string), raw: r };
}

describe("R3: every reference of one checkout carries the SAME checkoutId; separate checkouts differ", () => {
  for (const [name, get, n] of [["Monday split", () => LW, 2], ["month-end split", () => LE, 2], ["three weeks", () => L3, 3]] as const) {
    it(`${name}: ${n} references, one id`, async () => {
      const b = await bookMany(get(), `R3 ${name} ${uniq()}`);
      assert.equal(b.refs.length, n);
      const ids = await Promise.all(b.refs.map(async (r) => (await docOf(r)).checkoutId));
      assert.ok(ids[0] && typeof ids[0] === "string", `stamped: ${ids}`);
      assert.equal(new Set(ids).size, 1, `one id on all references: ${ids}`);
    });
  }
  it("two checkouts by the same family submitted back to back carry DIFFERENT ids (two references each)", async () => {
    const [a, b] = await Promise.all([bookMany(LW, `R3 back ${uniq()}`), bookMany(LW, `R3 back ${uniq()}`)]);
    const ida = await Promise.all(a.refs.map(async (r) => (await docOf(r)).checkoutId));
    const idb = await Promise.all(b.refs.map(async (r) => (await docOf(r)).checkoutId));
    assert.equal(new Set(ida).size, 1);
    assert.equal(new Set(idb).size, 1);
    assert.notEqual(ida[0], idb[0]);
    assert.ok(ida[0] && idb[0]);
  });
  it("a booking the operator takes (POST /api/bookings) is stamped too", async () => {
    const r = await as("P", "POST", "/api/bookings", { booker: "Op Family", email: "op-family@emu.test", child: `R3 op ${uniq()}`, age: 8, listing: "LW", pass: "1-day pass", blockId: LW.blockId, amount: 20, method: "Cash" });
    assert.ok(r.status < 300, `operator booking -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    const ref = r.json.ref ?? r.json.booking?.ref;
    assert.ok((await docOf(ref)).checkoutId, "operator-taken booking has a checkoutId");
  });
});

describe("R3: a family never sees a checkoutId", () => {
  it("not in their own bookings list, nor in the booking response; another family sees none of it either", async () => {
    const child = `R3 priv ${uniq()}`;
    const b = await bookMany(LW, child);
    assert.ok(!JSON.stringify(b.raw.json).includes("checkoutId"), "the checkout response");
    assert.ok((await docOf(b.refs[0])).checkoutId, "setup: the provider's copy has one");
    const mine = await as("A", "GET", "/api/my/bookings");
    assert.equal(mine.status, 200);
    assert.ok(JSON.stringify(mine.json).includes(b.refs[0]), "setup: it is in A's list");
    assert.ok(!JSON.stringify(mine.json).includes("checkoutId"), "A's list");
    const theirs = await as("B", "GET", "/api/my/bookings");
    assert.ok(!JSON.stringify(theirs.json).includes("checkoutId") && !JSON.stringify(theirs.json).includes(b.refs[0]), "B's list");
  });
});

describe("R3: V05 through the checkoutId", () => {
  it("cancel-day of the first reference's only day moves the T-shirt (stamped bookings)", async () => {
    const c = `R3v ${uniq()}`;
    const b = await bookMany(LW, c, { tshirt: true });
    assert.ok((await docOf(b.refs[0])).checkoutId, "setup: stamped");
    const first = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0] })))).sort((x, y) => x.d.localeCompare(y.d))[0].r;
    assert.ok((await operatorAction(first, "cancel-day", { ki: 0, date: LW.dates[0], resolution: "none" })).status < 300);
    const t = await teeDays(LW, c);
    assert.deepEqual(t.kit, [LW.dates[1]]);
    assert.deepEqual(t.reg, [LW.dates[1]]);
  });
  it("an OLD booking with no checkoutId still works through the 3 ms fallback", async () => {
    const c = `R3old ${uniq()}`;
    const b = await bookMany(LW, c, { tshirt: true });
    const db = await adminDb();
    const P = ids().tenants.P;
    for (const r of b.refs) { const ref = db.collection("bookings").doc(`${P}_${r}`); const d = (await ref.get()).data() as Record<string, unknown>; delete d.checkoutId; await ref.set(d); }
    for (const r of b.refs) assert.equal((await docOf(r)).checkoutId, undefined, "setup: unstamped");
    const first = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0] })))).sort((x, y) => x.d.localeCompare(y.d))[0].r;
    assert.ok((await operatorAction(first, "cancel", { refund: "none" })).status < 300);
    const t = await teeDays(LW, c);
    assert.deepEqual(t.kit, [LW.dates[1]]);
    assert.deepEqual(t.reg, [LW.dates[1]]);
  });
  it("back-to-back checkouts for the SAME child name on different runs are not mixed up: the sibling is chosen by checkoutId, not by timing", async () => {
    // Two checkouts at the same instant by the same family for the same listing: only the id can tell which reference belongs to which.
    const c1 = `R3x ${uniq()}`, c2 = `R3x ${uniq()}`;
    const [a, b] = await Promise.all([bookMany(LW, c1, { tshirt: true }), bookMany(LW, c2, { tshirt: true })]);
    const firstOf = async (refs: string[]) => (await Promise.all(refs.map(async (r) => ({ r, d: (await docOf(r)).days[0] })))).sort((x, y) => x.d.localeCompare(y.d))[0].r;
    assert.ok((await operatorAction(await firstOf(a.refs), "cancel", { refund: "none" })).status < 300);
    assert.deepEqual((await teeDays(LW, c1)).kit, [LW.dates[1]], "the cancelled checkout's T-shirt moved to its own Monday reference");
    assert.deepEqual((await teeDays(LW, c2)).kit, [LW.dates[0]], "the other checkout is untouched");
  });
});

// ══════════════════════════════ ROUND 4 ══════════════════════════════
describe("Q08: holder emptied AND a cancel-day on the surviving reference - the T-shirt still shows, once, on the first remaining day", () => {
  for (const which of ["LW", "LE"] as const) {
    it(`${which}: cancel the first reference, then cancel-day the survivor's first day`, async () => {
      const l = which === "LW" ? LW : LE;
      const c = `Q08 ${which} ${uniq()}`;
      const b = await bookMany(l, c, { tshirt: true });
      const sorted = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0] })))).sort((x, y) => x.d.localeCompare(y.d));
      assert.ok((await operatorAction(sorted[0].r, "cancel", { refund: "none" })).status < 300);
      assert.ok((await operatorAction(sorted[1].r, "cancel-day", { ki: 0, date: l.dates[1], resolution: "none" })).status < 300);
      const t = await teeDays(l, c);
      assert.deepEqual(t.kit, [l.dates[2]], "Add-on orders");
      assert.deepEqual(t.reg, [l.dates[2]], "register");
    });
  }
});

describe("C05: no family-callable GET ever returns a checkoutId", () => {
  it("scans every parameterless GET route a parent can reach, and the privacy export", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../server/src/routes");
    const prefix: Record<string, string> = { account: "/api/account", children: "/api/children", customers: "/api/customers", payments: "/api/payments", events: "/api/events", feedback: "/api/my/feedback", growth: "/api/growth", posts: "/api/posts", referral: "/api/my/referral", trips: "/api/trips", listings: "/api/listings", privacy: "/api/privacy", memberships: "/api/my/memberships", moments: "/api/moments", messages: "/api/messages", invoices: "/api/invoices", notifications: "/api/notifications", tfc: "/api/my/tfc", mealsShop: "/api/meals-shop", meals: "/api/meals", timetables: "/api/timetables", onlineSessions: "/api/online-sessions", my: "/api/my" };
    const b = await bookMany(LW, `C05 ${uniq()}`);
    assert.ok((await docOf(b.refs[0])).checkoutId, "setup: a stamped booking exists");
    const db = await adminDb();
    const stored = [...new Set((await db.collection("bookings").get()).docs.map((d) => d.get("checkoutId")).filter(Boolean))] as string[];
    const tok = (await login("parent-a@emu.test")).token;
    const leaks: string[] = []; let n = 0;
    const paths = new Set<string>(["/api/privacy/export", "/api/my/bookings"]);
    for (const f of readdirSync(dir)) {
      const name = f.replace(/\.ts$/, "");
      if (!prefix[name]) continue;
      for (const m of readFileSync(resolve(dir, f), "utf8").matchAll(/\b\w+\.get\("(\/[^":]*)"/g)) paths.add(prefix[name] + (m[1] === "/" ? "" : m[1]));
    }
    for (const p of paths) {
      const g = await call("GET", p, tok); n++;
      const t = typeof g.json === "string" ? g.json : JSON.stringify(g.json);
      if (/checkoutId/i.test(t) || stored.some((c) => t.includes(c))) leaks.push(p);
    }
    assert.ok(n > 20, `scanned ${n} routes`);
    assert.deepEqual(leaks, [], "routes that leak a checkoutId");
  });
});

describe("Q13: after the T-shirt's holder is cancelled with a refund, the T-shirt follows unless the refund recorded YES for add-ons", () => {
  const cases: [string, Record<string, unknown>, boolean][] = [
    ["full refund (default: add-on refunded): drops off", { refund: "full" }, false],
    ["full refund with refundsAddons false: follows", { refund: "full", refundsAddons: false }, true],
    ["cancelled without refund: follows", { refund: "none" }, true],
    ["partial refund of £5: follows", { refund: "partial", amount: 5 }, true],
    ["partial refund of £10 (more than the add-on price): still follows, amounts are not linked to add-ons", { refund: "partial", amount: 10 }, true],
    ["partial refund with refundsAddons true: drops off", { refund: "partial", amount: 10, refundsAddons: true }, false],
  ];
  for (const [name, action, follows] of cases) {
    it(name, async () => {
      const c = `Q13 ${uniq()}`;
      const b = await bookMany(LW, c, { tshirt: true });
      const sorted = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0], amt: (await docOf(r)).amount })))).sort((x, y) => x.d.localeCompare(y.d));
      const pr = await as("P", "POST", `/api/bookings/${encodeURIComponent(sorted[0].r)}/record-payment`, { amount: sorted[0].amt, method: "Bank transfer", reference: `Q13-${uniq()}` });
      assert.ok(pr.status < 300, `pay ${pr.status}`);
      assert.ok((await operatorAction(sorted[0].r, "cancel", action)).status < 300);
      if (action.refundsAddons !== undefined) assert.equal((await docOf(sorted[0].r)).cancel?.refundsAddons, action.refundsAddons, "the choice is recorded on the cancel record");
      const t = await teeDays(LW, c);
      assert.deepEqual(t.kit, follows ? [LW.dates[1]] : [], "Add-on orders");
      assert.deepEqual(t.reg, follows ? [LW.dates[1]] : [], "register");
    });
  }
});

describe("Q13k (real API): a one-day refund of £20 from cancel-day on the holder's only day keeps the paid £8 T-shirt, in Add-on orders, the register and Finance", () => {
  it("cancel-day with a pending refund: T-shirt follows; Finance still counts it once", async () => {
    const c = `Q13k ${uniq()}`;
    const b = await bookMany(LW, c, { tshirt: true });
    const sorted = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0], amt: (await docOf(r)).amount })))).sort((x, y) => x.d.localeCompare(y.d));
    assert.ok((await as("P", "POST", `/api/bookings/${encodeURIComponent(sorted[0].r)}/record-payment`, { amount: sorted[0].amt, method: "Bank transfer", reference: `Q13k-${uniq()}` })).status < 300);
    assert.ok((await operatorAction(sorted[0].r, "cancel-day", { ki: 0, date: LW.dates[0], resolution: "refund" })).status < 300);
    const t = await teeDays(LW, c);
    assert.deepEqual(t.kit, [LW.dates[1]], "Add-on orders");
    assert.deepEqual(t.reg, [LW.dates[1]], "register");
    const all: any[] = (await as("P", "GET", "/api/bookings")).json;
    assert.equal(addonFigures(all.filter((x) => b.refs.includes(x.ref))).addonUnits, 1, "Finance counts the T-shirt once");
  });
  it("cancel-day with a refund AND refundsAddons true: the T-shirt drops off", async () => {
    const c = `Q13kt ${uniq()}`;
    const b = await bookMany(LW, c, { tshirt: true });
    const sorted = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0], amt: (await docOf(r)).amount })))).sort((x, y) => x.d.localeCompare(y.d));
    assert.ok((await as("P", "POST", `/api/bookings/${encodeURIComponent(sorted[0].r)}/record-payment`, { amount: sorted[0].amt, method: "Bank transfer", reference: `Q13kt-${uniq()}` })).status < 300);
    assert.ok((await operatorAction(sorted[0].r, "cancel-day", { ki: 0, date: LW.dates[0], resolution: "refund", refundsAddons: true })).status < 300);
    const t = await teeDays(LW, c);
    assert.deepEqual(t.kit, []);
    assert.deepEqual(t.reg, []);
  });
  it("cancel-day settled as wallet credit: the T-shirt follows", async () => {
    const c = `Q13kw ${uniq()}`;
    const b = await bookMany(LW, c, { tshirt: true });
    const sorted = (await Promise.all(b.refs.map(async (r) => ({ r, d: (await docOf(r)).days[0], amt: (await docOf(r)).amount })))).sort((x, y) => x.d.localeCompare(y.d));
    assert.ok((await as("P", "POST", `/api/bookings/${encodeURIComponent(sorted[0].r)}/record-payment`, { amount: sorted[0].amt, method: "Bank transfer", reference: `Q13kw-${uniq()}` })).status < 300);
    assert.ok((await operatorAction(sorted[0].r, "cancel-day", { ki: 0, date: LW.dates[0], resolution: "wallet" })).status < 300);
    const t = await teeDays(LW, c);
    assert.deepEqual(t.kit, [LW.dates[1]]);
    assert.deepEqual(t.reg, [LW.dates[1]]);
  });
});
