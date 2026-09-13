// Plan-2 Day 1 — Money 1: settlement without the browser, invoices, wallet
// ledger (p2-m1 … p2-m20). Throwaway freelancer tenants A + B, company C with
// franchise F1 + staff; all deleted at the end.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day1.mts
// Results → /tmp/p2h_day1.json
import fs from "node:fs";
import { execSync } from "node:child_process";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { creditWallet, walletBalance } from "../../src/lib/wallet";
import { owedNow } from "../../../features/bookings/helpers";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const j = (r: { json: any }) => JSON.stringify(r.json)?.slice(0, 160);

await start();
const A = await mkTenant("freelancer", "P2H Money A"); const OA = A.owner; const TA = A.tenantId;
const B = await mkTenant("freelancer", "P2H Money B"); const OB = B.owner; const TB = B.tenantId;
const SA = await mkStaff(TA, { franchiseId: null, name: "Money Staff", staffRole: "Coach", jobTitle: "Coach" });
const C = await mkTenant("company", "P2H Money HO"); const HO = C.owner; const TC = C.tenantId;
const F1 = await mkFranchise(TC, "P2H Money F1");
const SC = await mkStaff(TC, { franchiseId: null, name: "HO Staff", staffRole: "Coach" });
const P = await mkParent("Money Parent"); const P2 = await mkParent("Money Parent Two"); const P3 = await mkParent("Money Parent Three");
origLog("world", { TA, TB, TC, F1: F1.franchiseId });

// Library add-on (per-day £4) on tenant A, then a listing + 5-day block per tenant.
await db.collection("libraries").doc(TA).set({ addons: [{ id: "lunch", name: "Lunch", type: "perday", price: 4 }] }, { merge: true });
async function listingAndBlock(actor: Actor, title: string, extra: Record<string, unknown> = {}) {
  const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }], ...extra });
  if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} wk1`, startDate: ymd(daysFromNow(30)), endDate: ymd(daysFromNow(34)), capacity: 50, schedule: { startTime: "09:00", endTime: "15:30" } });
  if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  await db.collection("listings").doc(l.json.id).set({ status: "live" }, { merge: true });
  const days = [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(30 + n)));
  return { listingId: l.json.id as string, blockId: b.json.id as string, title, days };
}
const LA = await listingAndBlock(OA, "P2H A Camp", { addonIds: ["lunch"] });
const LB = await listingAndBlock(OB, "P2H B Camp");
const LH = await listingAndBlock(HO, "P2H HO Camp");
async function opBook(actor: Actor, L: { blockId: string; title: string }, parent: Actor, child: string, amount: number) {
  const r = await api(actor, "POST", "/api/bookings", { booker: parent.name, email: parent.email, child, age: 7, listing: L.title, pass: "Day", blockId: L.blockId, amount, method: "Bank transfer" });
  if (r.status !== 201) throw new Error(`booking ${r.status} ${r.text}`);
  return r.json as { ref: string };
}
async function parentBook(parent: Actor, L: { listingId: string; blockId: string; days: string[] }, item: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return api(parent, "POST", "/api/my/bookings", { listingId: L.listingId, blockId: L.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "Kid " + Math.random().toString(36).slice(2, 5), age: 7, ...item }], ...extra });
}

// ── p2-m1 (code): webhook event types ─────────────────────────────────────
await step("p2-m1", async () => {
  const src = fs.readFileSync("src/routes/stripeWebhook.ts", "utf8");
  const cases = [...src.matchAll(/case "([a-z_.]+)"/g)].map((m) => m[1]);
  const hasPI = cases.some((c) => c.startsWith("payment_intent"));
  results["p2-m1"] = { verdict: hasPI ? "pass" : "fail", actual: `stripeWebhook.ts handles: ${cases.join(", ")}. payment_intent.* handler: ${hasPI ? "present" : "ABSENT"}`, notes: hasPI ? undefined : "As the plan predicts: a booking paid with the tab closed is settled only by the browser's confirm call (backlog b7 / Amir). Fix needed: add payment_intent.succeeded → settle booking(s) in refs by paymentIntentId." };
});

// ── p2-m2..m4: Stripe ────────────────────────────────────────────────────
const stripeOn = !!process.env.STRIPE_SECRET_KEY;
const BA = await opBook(OA, LA, P, "Kid Card", 40);
await step("p2-m2", async () => {
  const r = await api(P, "POST", "/api/payments/checkout", { refs: [BA.ref], tenantId: TA });
  results["p2-m2"] = { verdict: "blocked", actual: `STRIPE_SECRET_KEY ${stripeOn ? "set" : "not set"} in server/.env; POST /api/payments/checkout → ${r.status} ${j(r)}`, notes: "Needs Stripe test keys (prereq q4, Amir). Also depends on p2-m1 (no payment_intent webhook) — even with keys this would fail today." };
});
await step("p2-m3", async () => {
  const r = await api(P, "POST", "/api/payments/checkout/nope/confirm", {});
  results["p2-m3"] = { verdict: "blocked", actual: `confirm without Stripe → ${r.status} ${j(r)}`, notes: "Needs Stripe test keys (q4). Code read: confirm is idempotent by design — payments doc status 'succeeded' short-circuits the second write (payments.ts:370-420), but the 'paid' notification/email path was not observable." };
});
await step("p2-m4", async () => {
  // Even with Stripe off, the ownership check runs before Stripe is needed? (needStripe is first.) Create a payments doc by hand and confirm it as P2.
  const pref = await db.collection("payments").add({ tenantId: TA, refs: [BA.ref], email: P.email.toLowerCase(), amount: 40, currency: "gbp", paymentIntentId: "pi_test_none", stripeAccount: null, status: "created", createdAt: new Date().toISOString() });
  const r = await api(P2, "POST", `/api/payments/checkout/${pref.id}/confirm`, {});
  const b = await api(OA, "GET", `/api/bookings/${BA.ref}`);
  const untouched = b.json?.pay !== "Paid";
  results["p2-m4"] = { verdict: stripeOn ? (r.status === 404 && untouched ? "pass" : "fail") : "blocked", actual: `P2 confirms P's payment doc → ${r.status} ${j(r)}; A's booking pay=${b.json?.pay}`, notes: stripeOn ? undefined : "Stripe not configured so needStripe() answers first (503). Code read: the email check (snap.data().email !== req.user.email → 404) sits before any Stripe call, so with keys this passes. Re-run with q4." };
  await pref.delete();
});

// ── p2-m5: same manual payment twice ──────────────────────────────────────
await step("p2-m5", async () => {
  const B5 = await opBook(OA, LA, P, "Kid Dup", 50);
  const body = { amount: 50, method: "bank", reference: "BACS-1" };
  const [r1, r2] = await Promise.all([api(OA, "POST", `/api/bookings/${B5.ref}/record-payment`, body), api(OA, "POST", `/api/bookings/${B5.ref}/record-payment`, body)]);
  const codes = [r1.status, r2.status].sort();
  const rec = await api(OA, "GET", "/api/reconciliation");
  const row = (rec.json?.items ?? []).find((x: any) => x.ref === B5.ref);
  const b = await api(OA, "GET", `/api/bookings/${B5.ref}`);
  const ok = codes.join() === "200,409" && b.json?.amountPaid === 50;
  results["p2-m5"] = { verdict: ok ? "pass" : "fail", actual: `two simultaneous record-payment £50 BACS-1 → ${codes.join("/")}; booking amountPaid=${b.json?.amountPaid} pay=${b.json?.pay}; reconciliation row paid=${row?.paid ?? row?.amountPaid ?? "?"} outstanding=${row?.outstanding}`, notes: r2.status === 409 || r1.status === 409 ? `409 body: ${(r1.json?.error ?? r2.json?.error ?? "").slice(0, 120)}` : undefined };
});

// ── p2-m6: record-payment input edges ─────────────────────────────────────
await step("p2-m6", async () => {
  const B6 = await opBook(OA, LA, P, "Kid Edge", 40);
  const before = (await api(OA, "GET", `/api/bookings/${B6.ref}`)).json?.amountPaid ?? 0;
  const neg = await api(OA, "POST", `/api/bookings/${B6.ref}/record-payment`, { amount: -10 });
  const huge = await api(OA, "POST", `/api/bookings/${B6.ref}/record-payment`, { amount: 99999 });
  const str = await api(OA, "POST", `/api/bookings/${B6.ref}/record-payment`, { amount: "ten" });
  const after = (await api(OA, "GET", `/api/bookings/${B6.ref}`)).json;
  const ok = neg.status === 400 && huge.status === 400 && str.status === 400 && (after?.amountPaid ?? 0) === before;
  results["p2-m6"] = { verdict: ok ? "pass" : "fail", actual: `amount -10 → ${neg.status}; amount 99999 on £40 → ${huge.status} ${huge.status === 200 ? `(accepted; amountPaid now ${after?.amountPaid}, overpaid=${huge.json?.overpaid})` : ""}; amount "ten" → ${str.status}; amountPaid before ${before} after ${after?.amountPaid}`, notes: huge.status === 200 ? "Fix needed (minor): record-payment accepts any positive amount — £99,999 on a £40 booking is stored (flagged as overpaid in the response, not refused). Plan expects a 400 with a readable message. Also the 400 bodies are raw zod issue arrays, not a sentence." : undefined };
});

// ── p2-m7: refund-approve with nothing pending / as staff ─────────────────
await step("p2-m7", async () => {
  const B7 = await opBook(OA, LA, P, "Kid Refund", 40);
  const none = await api(OA, "POST", `/api/bookings/${B7.ref}/actions`, { type: "refund-approve" });
  // make a pending refund: pay it, then the parent cancels
  await api(OA, "POST", `/api/bookings/${B7.ref}/record-payment`, { amount: 40, method: "bank" });
  const c = await api(P, "POST", `/api/my/bookings/${B7.ref}/cancel`, { msg: "can't make it", refundPref: "card" });
  const b = (await api(OA, "GET", `/api/bookings/${B7.ref}`)).json;
  const staff = await api(SA, "POST", `/api/bookings/${B7.ref}/actions`, { type: "refund-approve" });
  const pays = await db.collection("payments").where("refs", "array-contains", B7.ref).get();
  const refundDocs = pays.docs.filter((d) => d.data().type === "refund").length;
  const ok = none.status === 409 && staff.status === 403 && refundDocs === 0;
  results["p2-m7"] = { verdict: ok ? "pass" : "fail", actual: `refund-approve with no cancellation → ${none.status} ${(none.json?.error ?? "").slice(0, 60)}; parent cancel → ${c.status} (cancel.refund=${b?.cancel?.refund}, amount=${b?.cancel?.amount}); staff refund-approve on it → ${staff.status} ${(staff.json?.error ?? "").slice(0, 60)}; refund payment docs written: ${refundDocs}` };
});

// ── p2-m8: part-cancel with a per-day add-on ──────────────────────────────
await step("p2-m8", async () => {
  await setSettings(TA, null, { allowDateChanges: true });
  const r = await parentBook(P, LA, { child: "Kid Addon", dates: LA.days.slice(0, 3), addons: [{ id: "lunch", days: LA.days.slice(0, 3) }] });
  if (r.status !== 201) { results["p2-m8"] = { verdict: "blocked", actual: `parent basket booking → ${r.status} ${j(r)}` }; return; }
  const ref = r.json.ref ?? r.json.bookings?.[0]?.ref ?? r.json.refs?.[0];
  const b0 = (await api(OA, "GET", `/api/bookings/${ref}`)).json;
  await api(OA, "POST", `/api/bookings/${ref}/record-payment`, { amount: b0.amount, method: "bank" });
  const pc = await api(P, "POST", `/api/my/bookings/${ref}/cancel`, { days: [LA.days[0]], resolution: "refund" });
  const b1 = (await api(OA, "GET", `/api/bookings/${ref}`)).json;
  const quoted = pc.json?.refund?.amount ?? pc.json?.cancel?.amount ?? pc.json?.released?.amount ?? b1?.cancel?.amount ?? b1?.partial?.amount;
  const perDay = b0.amount / 3; // pass £10 + add-on £4 per day = £14 if per-day priced
  results["p2-m8"] = { verdict: typeof quoted === "number" && Math.abs(quoted - perDay) < 0.01 ? "pass" : (typeof quoted === "number" ? "fail" : "blocked"), actual: `3-day booking with £4/day add-on: amount £${b0.amount} (addons stored as ${JSON.stringify(b0.addons ?? b0.kids?.[0]?.addons ?? null)?.slice(0, 120)}); cancel one day (3 weeks' notice) → ${pc.status} ${j(pc)}; quoted refund=${quoted} vs one day's share £${perDay.toFixed(2)}`, notes: typeof quoted === "number" && Math.abs(quoted - perDay) >= 0.01 ? "Fix needed: the per-day add-on is not (or not fully) in the released day's value — Amir item 12 (add-ons flattened to strings)." : undefined };
});

// ── p2-m9 / m10 / m11: invoices ───────────────────────────────────────────
const invBody = (extra: Record<string, unknown> = {}) => ({ customerName: "Money Parent", customerEmail: P.email, description: "Term fees", amount: 25, date: ymd(new Date()), dueDate: ymd(daysFromNow(14)), status: "sent", ...extra });
await step("p2-m9", async () => {
  const inv = await api(OA, "POST", "/api/invoices", invBody());
  if (inv.status !== 201) throw new Error(`invoice ${inv.status} ${inv.text}`);
  const old = ymd(daysFromNow(-120)); const due = ymd(daysFromNow(-100));
  await db.collection("invoices").doc(inv.json.id).set({ createdAt: `${old}T10:00:00.000Z`, date: old, dueDate: due, emailedAt: `${old}T10:00:00.000Z` }, { merge: true });
  const g = await api(null, "GET", `/api/public/invoice/${inv.json.payToken}`);
  const co = await api(null, "POST", `/api/public/invoice/${inv.json.payToken}/checkout`, {});
  const ok = g.status === 410 && g.json?.code === "link_expired" && co.status !== 201;
  results["p2-m9"] = { verdict: ok ? "pass" : "fail", actual: `invoice aged to 100 days past due: GET public → ${g.status} ${j(g)}; POST checkout → ${co.status} ${j(co)}`, notes: "/pay/<token> page not opened (browser); the API it renders from answers 410 link_expired. Checkout refuses with 503 here because Stripe isn't configured — the 410 branch sits right after it in invoices.ts." };
});
await step("p2-m10", async () => {
  const inv = await api(OA, "POST", "/api/invoices", invBody());
  const del = await api(OA, "DELETE", `/api/invoices/${inv.json.id}`);
  const g = await api(null, "GET", `/api/public/invoice/${inv.json.payToken}`);
  const co = await api(null, "POST", `/api/public/invoice/${inv.json.payToken}/checkout`, {});
  const ok = del.status === 200 && g.status === 404 && (co.status === 404 || co.status === 503);
  results["p2-m10"] = { verdict: ok ? "pass" : "fail", actual: `DELETE → ${del.status}; GET public → ${g.status}; POST checkout (no account) → ${co.status} ${(co.json?.error ?? "").slice(0, 50)}` };
});
await step("p2-m11", async () => {
  const inv = await api(HO, "POST", "/api/invoices", invBody({ customerEmail: P3.email }));
  const fr = await api(F1.actor, "POST", `/api/invoices/${inv.json.id}/email`, {});
  const st = await api(SC, "POST", `/api/invoices/${inv.json.id}/email`, {});
  const ok = fr.status === 404 && st.status === 403;
  results["p2-m11"] = { verdict: ok ? "pass" : "fail", actual: `HO invoice ${inv.status}; F1 emails it → ${fr.status} ${(fr.json?.error ?? "").slice(0, 40)}; staff → ${st.status} ${(st.json?.error ?? "").slice(0, 40)}` };
});

// ── p2-m12..m15: wallet ───────────────────────────────────────────────────
await step("p2-m12", async () => {
  await creditWallet(TA, P.email, 10, "test credit");
  await creditWallet(TA, P2.email, 7.5, "test credit");
  await creditWallet(TB, P.email, 3, "test credit at B");
  const s = await api(OA, "GET", "/api/wallet/summary");
  let sum = 0; const parts: string[] = [];
  for (const par of [P, P2, P3]) { const w = await api(par, "GET", "/api/my/wallet"); const bal = (w.json?.balances ?? []).filter((x: any) => x.tenantId === TA).reduce((a: number, x: any) => a + (x.balance ?? 0), 0); sum += bal; parts.push(`${par.name}=${bal}`); }
  const ok = Math.abs((s.json?.outstanding ?? -1) - sum) < 0.005;
  results["p2-m12"] = { verdict: ok ? "pass" : "fail", actual: `wallet/summary.outstanding=${s.json?.outstanding}; sum of family balances at A: ${sum} (${parts.join(", ")}); B's £3 for P excluded` };
});
await step("p2-m13", async () => {
  // The Day pass is £10 flat per child, so three children = a £30 basket.
  const r = await api(P, "POST", "/api/my/bookings", { listingId: LA.listingId, blockId: LA.blockId, method: "Bank transfer", walletCap: 500, items: ["Cap One", "Cap Two", "Cap Three"].map((child) => ({ pass: "Day", child, age: 7, dates: LA.days.slice(0, 3) })) });
  const bal = await walletBalance(TA, P.email);
  const ref = r.json?.ref ?? r.json?.bookings?.[0]?.ref; const b = ref ? (await api(OA, "GET", `/api/bookings/${ref}`)).json : null;
  const applied = b?.walletApplied ?? r.json?.walletApplied;
  const refs: string[] = r.json?.refs ?? (r.json?.bookings ?? []).map((x: any) => x.ref) ?? (ref ? [ref] : []);
  let amountSum = 0, appliedSum = 0; for (const rf of refs) { const bb = (await api(OA, "GET", `/api/bookings/${rf}`)).json; amountSum += bb?.amount ?? 0; appliedSum += bb?.walletApplied ?? 0; }
  const ok = r.status === 201 && appliedSum === 10 && bal === 0 && Math.abs(amountSum + appliedSum - 30) < 0.01;
  results["p2-m13"] = { verdict: ok ? "pass" : "fail", actual: `£30 basket (3 × £10 pass) with £10 credit and walletCap 500 → ${r.status}; ${refs.length} booking(s); walletApplied total=${appliedSum}; amounts still to pay=${amountSum}; first booking pay=${b?.pay}; balance after=${bal}`, notes: ok ? "walletCap is clamped to the real balance (my.ts:1303)." : undefined };
});
await step("p2-m14", async () => {
  await creditWallet(TA, P2.email, 2.5, "top-up"); // P2 now £10 at A, nothing at B
  const r = await parentBook(P2, LB, { child: "Kid B", dates: LB.days.slice(0, 2) }, { walletCap: 10 });
  const balA = await walletBalance(TA, P2.email); const balB = await walletBalance(TB, P2.email);
  const ref = r.json?.ref ?? r.json?.bookings?.[0]?.ref; const b = ref ? (await api(OB, "GET", `/api/bookings/${ref}`)).json : null;
  const ok = r.status === 201 && !(b?.walletApplied > 0) && balA === 10 && b?.amount === 10;
  results["p2-m14"] = { verdict: ok ? "pass" : "fail", actual: `P2 (£10 at A) books at B with walletCap 10 → ${r.status}; walletApplied=${b?.walletApplied ?? 0}; B booking amount=${b?.amount}; balances after A=${balA} B=${balB}` };
});
await step("p2-m15", async () => {
  await creditWallet(TA, P3.email, 20, "race credit");
  const [r1, r2] = await Promise.all([parentBook(P3, LA, { child: "Kid Race1", dates: LA.days.slice(0, 2) }, { walletCap: 20 }), parentBook(P3, LA, { child: "Kid Race2", dates: LA.days.slice(2, 4) }, { walletCap: 20 })]);
  const bal = await walletBalance(TA, P3.email);
  const refs = [r1, r2].map((r) => r.json?.ref ?? r.json?.bookings?.[0]?.ref).filter(Boolean);
  let applied = 0; for (const ref of refs) { const b = (await api(OA, "GET", `/api/bookings/${ref}`)).json; applied += b?.walletApplied ?? 0; }
  const entries = await db.collection("walletEntries").where("tenantId", "==", TA).where("email", "==", P3.email.toLowerCase()).get();
  const spent = entries.docs.map((d) => d.data().delta as number).filter((x) => x < 0).reduce((a, x) => a + x, 0);
  const ok = r1.status === 201 && r2.status === 201 && applied <= 20.005 && bal >= -0.005 && -spent <= 20.005;
  results["p2-m15"] = { verdict: ok ? "pass" : "fail", actual: `two simultaneous £20 baskets, £20 credit → ${r1.status}/${r2.status}; walletApplied total=${applied}; ledger spent=${-spent}; balance after=${bal}` };
});

// ── p2-m16 / m17: income + expense series ─────────────────────────────────
await step("p2-m16", async () => {
  const startD = new Date(); startD.setUTCMonth(startD.getUTCMonth() - 3); const start = ymd(startD);
  const until = ymd(daysFromNow(120));
  const r = await api(OA, "POST", "/api/income", { date: start, amount: 100, category: "Retainer", description: "Monthly retainer", repeat: "monthly", repeatUntil: until });
  if (r.status !== 201) throw new Error(`income ${r.status} ${r.text}`);
  const today = ymd(new Date());
  const past = (r.json.items as any[]).filter((i) => i.date <= today).length;
  const del = await api(OA, "DELETE", `/api/income/series/${r.json.seriesId}`);
  const after = (await api(OA, "GET", "/api/income")).json;
  const list: any[] = after?.items ?? after ?? [];
  const left = list.filter((i) => i.seriesId === r.json.seriesId);
  const ok = left.length === past && left.every((i) => i.date <= today);
  results["p2-m16"] = { verdict: ok ? "pass" : "fail", actual: `monthly series from ${start}: ${r.json.created} rows (${past} past); DELETE series → ${del.status} deleted=${del.json?.deleted}; rows of the series left: ${left.length}`, notes: ok ? undefined : "Fix needed: DELETE /api/income/series/:id removes every occurrence including past ones (income.ts:102-110 deletes the whole query). Plan expects past receipts to survive. Same shape in expenses.ts:113." };
});
await step("p2-m17", async () => {
  const start = ymd(daysFromNow(1)); const until = ymd(daysFromNow(29));
  const r = await api(OA, "POST", "/api/expenses", { date: start, amount: 30, category: "Venue hire", description: "Hall", repeat: "weekly", repeatUntil: until });
  if (r.status !== 201) throw new Error(`expense ${r.status} ${r.text}`);
  const items: any[] = r.json.items; const target = items[1];
  const put = await api(OA, "PUT", `/api/expenses/${target.id}`, { amount: 45 });
  const mid = (await api(OA, "GET", "/api/expenses")).json; const midList: any[] = mid?.items ?? mid ?? [];
  const series = midList.filter((i) => i.seriesId === r.json.seriesId);
  const changed = series.filter((i) => i.amount === 45).length; const same = series.filter((i) => i.amount === 30).length;
  const del = await api(OA, "DELETE", `/api/expenses/series/${r.json.seriesId}`);
  const endList: any[] = ((await api(OA, "GET", "/api/expenses")).json?.items ?? []) as any[];
  const left = endList.filter((i) => i.seriesId === r.json.seriesId).length;
  const ok = put.status === 200 && changed === 1 && same === items.length - 1 && del.status === 200 && left === 0;
  results["p2-m17"] = { verdict: ok ? "pass" : "fail", actual: `weekly series ${items.length} rows; PUT one → ${put.status}; rows at £45: ${changed}, still £30: ${same}; DELETE series → ${del.status} deleted=${del.json?.deleted}; left=${left}` };
});

// ── p2-m18: split fees both sides ─────────────────────────────────────────
await step("p2-m18", async () => {
  const LF = await listingAndBlock(F1.actor, "P2H F1 Camp");
  await opBook(F1.actor, LF, P3, "Kid F1a", 60); await opBook(F1.actor, LF, P3, "Kid F1b", 40);
  await opBook(HO, LH, P3, "Kid HO", 100);
  const ho = await api(HO, "GET", "/api/splitfees?period=all"); const mine = await api(F1.actor, "GET", "/api/splitfees/mine?period=all");
  const row = (ho.json?.franchises ?? []).find((x: any) => x.franchiseId === F1.franchiseId);
  const put = await api(F1.actor, "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 50, perBookingFee: 0 });
  const ok = !!row && row.revenue === mine.json?.revenue && row.count === mine.json?.count && (row.fee ?? row.royalty) === mine.json?.fee && put.status === 403;
  results["p2-m18"] = { verdict: ok ? "pass" : "fail", actual: `HO row for F1: ${JSON.stringify(row)?.slice(0, 160)}; F1 /mine: revenue=${mine.json?.revenue} count=${mine.json?.count} fee=${mine.json?.fee}; F1 PUT settings → ${put.status}`, notes: row ? undefined : `HO response keys: ${Object.keys(ho.json ?? {}).join(",")}` };
});

// ── p2-m20: one outstanding figure ────────────────────────────────────────
await step("p2-m20", async () => {
  await api(OA, "POST", `/api/bookings/${BA.ref}/record-payment`, { amount: 15, method: "bank", reference: "PART" });
  const [d, g, rc, bk] = await Promise.all([api(OA, "GET", "/api/dashboard"), api(OA, "GET", "/api/growth"), api(OA, "GET", "/api/reconciliation"), api(OA, "GET", "/api/bookings")]);
  const list: any[] = bk.json?.items ?? bk.json ?? [];
  const fromBookings = Math.round(list.reduce((s, b) => s + owedNow(b), 0) * 100) / 100;
  const dash = d.json?.money?.outstanding; const recon = rc.json?.summary?.outstanding ?? rc.json?.totals?.outstanding;
  const growthKeys = Object.keys(g.json ?? {}).filter((k) => /owed|outstanding|unpaid/i.test(k));
  const ok = dash === fromBookings && recon === fromBookings;
  results["p2-m20"] = { verdict: ok ? "pass" : "fail", actual: `dashboard.money.outstanding=${dash}; reconciliation summary.outstanding=${recon}; Σ owedNow(bookings)=${fromBookings} over ${list.length} bookings; growth has no outstanding field (keys matching owed/outstanding: ${growthKeys.join(",") || "none"})`, notes: ok ? "Reconciliation and Dashboard agree with financeFigures owedNow. /api/growth reports revenue/bookings only — nothing to compare." : "Fix needed: the three figures disagree — see actual." };
});

fs.writeFileSync("/tmp/p2h_day1.json", JSON.stringify({ results, world: { TA, TB, TC } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
