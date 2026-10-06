import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { ROOT } from "./helpers/env";
import { apiFetch, apiPost } from "./helpers/accounts";
import { mkParent, mkOp, setAccts, setSettings, mkListing, setPolicy, book, opBooking, opAct, markPaid, pCancel, wallet, oracle, plus, POLICIES, stamp, type Acct } from "./helpers/polKit";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/pol");
const OUT = path.join(SHOTS, "results4.json");
const RES: Record<string, { status: string; note: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, status: "pass" | "fail" | "info", note: string) => { RES[id] = { status, note }; fs.writeFileSync(OUT, JSON.stringify(RES, null, 1)); console.log(`RESULT ${id} ${status} :: ${note}`); };
async function check(id: string, fn: () => Promise<string>) {
  try { rec(id, "pass", await fn()); } catch (e) { rec(id, "fail", String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 800)); }
}
const API_LOG = "/tmp/aos-api-dev.log";
const mails = (to: string, re: RegExp) => { try { return fs.readFileSync(API_LOG, "utf8").split("\n").filter((l) => l.includes("[mail]") && l.includes(to) && re.test(l)).map((l) => l.slice(0, 160)); } catch { return []; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let parent: Acct, op: Acct;
const STD = DEFAULT_POLICIES[0].bands;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  parent = await mkParent("p"); op = await mkOp(); setAccts(parent, op);
  await setSettings(op, { cancellationPolicies: POLICIES, allowCardRefund: true, refundLetCustomerChoose: false, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true, allowDateChanges: true, amendSelfService: false, amendNoticeHours: 48, amendLimit: 2, amendFee: 0 });
  console.log("ACCOUNTS", parent.email, op.email, op.tenantId);
});

test("G. date change rules and the cancellation policy", async () => {
  test.setTimeout(900_000);
  const L = await mkListing(op, { title: `POL G ${stamp}`, offset: 3, policy: "standard", runDays: 16 });
  const mv = async (ref: string, from: string, to: string) => apiPost<Record<string, any>>(`/api/my/bookings/${ref}/amend`, await parent.token(), { moves: [{ from, to }], message: "pol" });
  await check("G1 notice rule (48h): move a day that is too close is refused", async () => {
    const l = await mkListing(op, { title: `POL G1 ${stamp}`, offset: 1, policy: "standard", runDays: 16 });
    const [b] = await book(parent, l, { child: `g1 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    let err = "";
    try { await mv(b.ref, l.sessions[0], l.sessions[8]); } catch (e) { err = String((e as Error).message); }
    expect(err).toMatch(/notice|hours|too close|48/i);
    return `moving a day that starts in ~1 day refused: ${err.replace(/^.*→ /, "").slice(0, 160)}`;
  });
  const mvAll = async (ref: string, pairs: [string, string][]) => apiPost<Record<string, any>>(`/api/my/bookings/${ref}/amend`, await parent.token(), { moves: pairs.map(([from, to]) => ({ from, to })), message: "pol" });
  await check("G2 move ALL days far out (provider approves), then cancel: refund uses the NEW first date", async () => {
    await setSettings(op, { amendLimit: 10 });
    const l = await mkListing(op, { title: `POL G2 ${stamp}`, offset: 3, policy: "standard", runDays: 20 });
    const [b] = await book(parent, l, { child: `g2 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    const pairs: [string, string][] = [[l.sessions[0], l.sessions[12]], [l.sessions[1], l.sessions[13]], [l.sessions[2], l.sessions[14]]];
    try { await mvAll(b.ref, pairs); } catch (e) { throw new Error(`amend refused: ${String((e as Error).message).slice(0, 200)}`); }
    const mid = await opBooking(b.ref);
    expect(mid.dateChangeRequest?.status).toBe("pending");
    await opAct(b.ref, { type: "move-approve" });
    const after = await opBooking(b.ref);
    const newFirst = (after.days ?? []).slice().sort()[0];
    const now = Date.now();
    await pCancel(parent, b.ref, {});
    const x = await opBooking(b.ref);
    await setSettings(op, { amendLimit: 2 });
    const e = oracle(STD, newFirst, 54, now), was = oracle(STD, l.sessions[0], 54, now);
    expect(x.cancel.amount).toBe(e.amount);
    return `all 3 days moved ${l.sessions[0]}.. -> ${newFirst}.. (provider approved); cancel worked out from the NEW first date ${newFirst}: ${e.pct}% = £${x.cancel.amount} (on the original date it would have been ${was.pct}%).`;
  });
  await check("G3 SELF-SERVICE move of all days far out then cancel (loophole probe)", async () => {
    await setSettings(op, { amendSelfService: true, amendNoticeHours: 0, amendLimit: 10, amendFee: 0 });
    const l = await mkListing(op, { title: `POL G3 ${stamp}`, offset: 1, policy: "standard", runDays: 20 });
    const [b] = await book(parent, l, { child: `g3 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    const before = oracle(STD, l.sessions[0], 54).amount;
    let applied = false, msg = "";
    try { const r = await mvAll(b.ref, [[l.sessions[0], l.sessions[12]], [l.sessions[1], l.sessions[13]], [l.sessions[2], l.sessions[14]]]); applied = !!r.amendApplied; } catch (e) { msg = String((e as Error).message).slice(0, 200); }
    await setSettings(op, { amendSelfService: false, amendNoticeHours: 48, amendLimit: 2 });
    if (!applied) return `no immediate self-service move (${msg || "queued as a request"}): no loophole`;
    const mid = await opBooking(b.ref);
    const first = (mid.days ?? []).slice().sort()[0];
    const now = Date.now(); await pCancel(parent, b.ref, {}); const x = await opBooking(b.ref);
    const e = oracle(STD, first, 54, now);
    expect(x.cancel.amount).toBe(e.amount);
    return `LOOPHOLE (only if the provider switched notice off): booked 1 day out (policy would give £${before}); moved all days to ${first}.. instantly with no approval, then cancelled for £${x.cancel.amount}. Default Setup notice rule is 48h which blocks this.`;
  });
  await check("G5 DEFAULT rules (self-service on, 48h notice, 2 moves): 1-day booking moved later then cancelled", async () => {
    await setSettings(op, { allowDateChanges: true, amendSelfService: true, amendNoticeHours: 48, amendLimit: 2, amendFee: 0 });
    const l = await mkListing(op, { title: `POL G5 ${stamp}`, offset: 3, policy: "standard", runDays: 20, passName: "1 day", passDays: 1, price: 18 });
    const [b] = await book(parent, l, { child: `g5 ${stamp}`, passName: "1 day", dates: l.sessions.slice(0, 1) }); await markPaid(b.ref);
    const before = oracle(STD, l.sessions[0], 18);
    let applied = false, msg = "";
    try { const r = await mvAll(b.ref, [[l.sessions[0], l.sessions[14]]]); applied = !!r.amendApplied; } catch (e) { msg = String((e as Error).message).replace(/^.*→ /, "").slice(0, 200); }
    await setSettings(op, { amendSelfService: false });
    if (!applied) return `move was ${msg ? "refused: " + msg : "only queued for the provider (no instant move)"}; no automatic loophole under default rules`;
    const mid = await opBooking(b.ref); const first = (mid.days ?? []).slice().sort()[0];
    const now = Date.now(); await pCancel(parent, b.ref, {}); const x = await opBooking(b.ref);
    const e = oracle(STD, first, 18, now); expect(x.cancel.amount).toBe(e.amount);
    return `RISK under DEFAULT rules: £18 day 3 days out (policy ${before.pct}% = £${before.amount}); family moved it themselves to ${first} (no approval needed, one move) then cancelled: ${e.pct}% = £${x.cancel.amount}.`;
  });
  await check("G4 date changes switched off", async () => {
    await setSettings(op, { allowDateChanges: false });
    const [b] = await book(parent, L, { child: `g4 ${stamp}`, dates: L.sessions.slice(4, 7) }); await markPaid(b.ref);
    let err = ""; try { await mv(b.ref, L.sessions[4], L.sessions[12]); } catch (e) { err = String((e as Error).message); }
    await setSettings(op, { allowDateChanges: true });
    expect(err).toMatch(/doesn't offer date changes/);
    return `refused: ${err.replace(/^.*→ /, "")}`;
  });
});

test("H. provider-initiated, accumulation, per-child/day actions", async () => {
  test.setTimeout(900_000);
  await check("H1 provider cancels one DAY (refund) inside the no-refund window", async () => {
    const l = await mkListing(op, { title: `POL H1 ${stamp}`, offset: 1, policy: "none" });
    const [b] = await book(parent, l, { child: `h1 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    await opAct(b.ref, { type: "cancel-day", ki: 0, date: l.sessions[1], resolution: "refund" });
    const x = await opBooking(b.ref);
    const log = (x.refundLog ?? []).map((r: any) => `${r.label}:${r.amount}`).join("; ");
    const owed = x.cancel?.amount;
    expect(owed ?? (x.refundLog ?? []).reduce((a: number, r: any) => a + r.amount, 0)).toBe(18);
    return `policy 'No refunds'; provider cancelled one of 3 days (£18 share): refundOwed £${owed} refundLog=[${log}] status=${x.status}`;
  });
  await check("H2 provider cancels one CHILD (wallet) under Standard 1 day out", async () => {
    const l = await mkListing(op, { title: `POL H2 ${stamp}`, offset: 1, policy: "standard" });
    const bs = await book(parent, l, { child: `h2a ${stamp}`, dates: l.sessions.slice(0, 3), extraItems: [{ pass: "3 days", child: `h2b ${stamp}`, age: 7, dates: l.sessions.slice(0, 3) }] });
    const ref = bs[0].ref; await markPaid(ref);
    const w0 = await wallet(parent);
    await opAct(ref, { type: "cancel-child", ki: 0, resolution: "wallet" });
    await sleep(1200);
    const x = await opBooking(ref); const w1 = await wallet(parent);
    expect(w1 - w0).toBe(54);
    return `booking £${x.amount} two kids; provider cancelled kid 1 to wallet: wallet +£${w1 - w0} (full £54 share, provider-initiated so policy ignored)`;
  });
  await check("H3 release a day (refund pending) THEN cancel the rest: amounts add up, never above paid", async () => {
    const l = await mkListing(op, { title: `POL H3 ${stamp}`, offset: 6, policy: "standard" });
    const [b] = await book(parent, l, { child: `h3 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    const day = l.sessions[2];
    const n0 = Date.now();
    await pCancel(parent, b.ref, { days: [day], resolution: "refund" });
    const m1 = await opBooking(b.ref);
    const pend = m1.cancel?.amount;
    const expDay = oracle(STD, day, 18, n0).amount;
    expect(pend).toBe(expDay);
    const n1 = Date.now();
    await pCancel(parent, b.ref, {});
    const x = await opBooking(b.ref);
    const first = l.sessions[0];
    const restPaid = 54 - pend;
    const frac = oracle(STD, first, 54, n1).pct / 100;
    const expTotal = Math.min(54, Math.round((pend + restPaid * frac) * 100) / 100);
    expect(x.cancel.amount).toBe(expTotal);
    expect(x.cancel.amount).toBeLessThanOrEqual(54);
    return `day ${day} released first -> pending £${pend}; then the whole booking cancelled: total owed £${x.cancel.amount} (= £${pend} + ${Math.round(frac * 100)}% of the remaining £${restPaid}); never above the £54 paid`;
  });
  await check("H4 release the same day twice is refused", async () => {
    const l = await mkListing(op, { title: `POL H4 ${stamp}`, offset: 6, policy: "standard" });
    const [b] = await book(parent, l, { child: `h4 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    await pCancel(parent, b.ref, { days: [l.sessions[2]], resolution: "refund" });
    let err = ""; try { await apiPost(`/api/my/bookings/${b.ref}/cancel`, await parent.token(), { days: [l.sessions[2]], resolution: "refund" }); } catch (e) { err = String((e as Error).message); }
    expect(err).toMatch(/already cancelled|isn't booked/i);
    return `second release of the same day refused: ${err.replace(/^.*→ /, "")}`;
  });
  await check("H5 provider declines the refund request", async () => {
    const l = await mkListing(op, { title: `POL H5 ${stamp}`, offset: 6, policy: "standard" });
    const [b] = await book(parent, l, { child: `h5 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    await pCancel(parent, b.ref, {});
    await opAct(b.ref, { type: "refund-decline" });
    const x = await opBooking(b.ref);
    expect(x.cancel.refund).toBe("declined");
    let again = ""; try { await opAct(b.ref, { type: "refund-approve" }); } catch (e) { again = String((e as Error).message).replace(/^.*→ /, ""); }
    return `declined: cancel.refund=${x.cancel.refund} pay=${x.pay}; approving it afterwards: ${again || "ALLOWED"}`;
  });
  await check("H6 approve twice does not refund twice", async () => {
    const l = await mkListing(op, { title: `POL H6 ${stamp}`, offset: 12, policy: "standard" });
    const [b] = await book(parent, l, { child: `h6 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    await pCancel(parent, b.ref, { refundPref: "wallet" });
    const w0 = await wallet(parent);
    await opAct(b.ref, { type: "refund-approve" });
    let second = ""; try { await opAct(b.ref, { type: "refund-approve" }); } catch (e) { second = String((e as Error).message).replace(/^.*→ /, ""); }
    await sleep(800);
    const w1 = await wallet(parent);
    expect(w1 - w0).toBe(54);
    return `first approve +£${w1 - w0}; second approve: ${second || "ALLOWED"}; wallet total +£${w1 - w0}`;
  });
});

test("I. emails sent per cancellation, then reconcile", async () => {
  test.setTimeout(600_000);
  await check("I1 emails for one cancel + one approval", async () => {
    const l = await mkListing(op, { title: `POL I ${stamp}`, offset: 12, policy: "standard" });
    const [b] = await book(parent, l, { child: `i1 ${stamp}`, dates: l.sessions.slice(0, 3) }); await markPaid(b.ref);
    await sleep(1500);
    const pre = { p: mails(parent.email, /./).length, o: mails(op.email, /./).length };
    await pCancel(parent, b.ref, {}); await sleep(2500);
    const afterCancel = { p: mails(parent.email, /./), o: mails(op.email, /./) };
    await opAct(b.ref, { type: "refund-approve" }); await sleep(2500);
    const afterApprove = { p: mails(parent.email, /./), o: mails(op.email, /./) };
    const newP = afterApprove.p.slice(pre.p), newO = afterApprove.o.slice(pre.o);
    return `to provider: ${newO.length} email(s): ${newO.map((x) => x.replace(/^\\[mail\\] /, "").split(" → ")[0]).join(" | ")}; to parent: ${newP.length} email(s): ${newP.map((x) => x.replace(/^\\[mail\\] /, "").split(" → ")[0]).join(" | ")}`;
  });
});
