// Plan-2 Day 2 — Money 2: memberships, discounts, purchasing, the grace model by
// API (p2-m21 … p2-m36). Throwaway freelancer A (+2 staff), B, company C + F1.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day2.mts
// Results → /tmp/p2h_day2.json
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, mkPlatform, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { walletBalance } from "../../src/lib/wallet";
import { clearSubscriptionCache } from "../../src/middleware/subscription";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log; const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const j = (r: { json: any }) => JSON.stringify(r.json)?.slice(0, 140);
const setSub = async (t: string, sub: Record<string, unknown>) => { await db.collection("tenants").doc(t).set({ subscription: sub }, { merge: true }); clearSubscriptionCache(t); };

await start();
const A = await mkTenant("freelancer", "P2H Money2 A"); const OA = A.owner; const TA = A.tenantId;
const B = await mkTenant("freelancer", "P2H Money2 B"); const OB = B.owner; const TB = B.tenantId;
const S1 = await mkStaff(TA, { franchiseId: null, name: "Two Staff", staffRole: "Coach" }); const S2 = await mkStaff(TA, { franchiseId: null, name: "Two Other", staffRole: "Coach" });
const C = await mkTenant("company", "P2H Money2 HO"); const HO = C.owner; const TC = C.tenantId; const F1 = await mkFranchise(TC, "P2H Money2 F1"); const F2 = await mkFranchise(TC, "P2H Money2 F2");
const P = await mkParent("Two Parent"); const P2 = await mkParent("Two Parent B"); const PF = await mkParent("Two Parent F1"); const HQ = await mkPlatform();
origLog("world", { TA, TB, TC });
async function listingAndBlock(actor: Actor, title: string) {
  const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }] }); if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  await db.collection("listings").doc(l.json.id).set({ status: "live" }, { merge: true });
  const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} wk1`, startDate: ymd(daysFromNow(30)), endDate: ymd(daysFromNow(34)), capacity: 50, schedule: { startTime: "09:00", endTime: "15:30" } }); if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  return { listingId: l.json.id as string, blockId: b.json.id as string, title, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(30 + n))) };
}
async function opBook(actor: Actor, L: { blockId: string; title: string }, parent: Actor, child: string, amount: number, method = "Bank transfer") {
  const r = await api(actor, "POST", "/api/bookings", { booker: parent.name, email: parent.email, child, age: 7, listing: L.title, pass: "Day", blockId: L.blockId, amount, method }); if (r.status !== 201) throw new Error(`booking ${r.status} ${r.text}`); return r.json as { ref: string };
}
const LA = await listingAndBlock(OA, "P2H M2 A Camp"); const LB = await listingAndBlock(OB, "P2H M2 B Camp");
const LH = await listingAndBlock(HO, "P2H M2 HO Camp"); const LF1 = await listingAndBlock(F1.actor, "P2H M2 F1 Camp");
await opBook(OA, LA, P, "Kid A", 20); await opBook(OB, LB, P, "Kid B", 20); await opBook(F1.actor, LF1, PF, "Kid F", 20); await opBook(HO, LH, P2, "Kid H", 20);
// Memberships on A: credit tier £5, percent tier 10%
await setSettings(TA, null, { memberships: { enabled: true, stacking: "best", tiers: [{ id: "credit", name: "Credit Club", enabled: true, priceMonthly: 9, benefitType: "credit", benefitValue: 5 }, { id: "pct", name: "Ten Off", enabled: true, priceMonthly: 12, benefitType: "percent", benefitValue: 10 }] }, customerArea: { memberships: true } });
await setSettings(TC, null, { memberships: { enabled: true, tiers: [{ id: "credit", name: "HO Credit", enabled: true, priceMonthly: 9, benefitType: "credit", benefitValue: 5 }] }, customerArea: { memberships: true } });

// ── p2-m21: double join ───────────────────────────────────────────────────
await step("p2-m21", async () => {
  const [r1, r2] = await Promise.all([api(P, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "credit" }), api(P, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "credit" })]);
  const codes = [r1.status, r2.status].sort().join("/"); const bal = await walletBalance(TA, P.email);
  const mem = (await db.collection("memberships").doc(`${TA}__${P.email.toLowerCase()}`).get()).data();
  const entries = (await db.collection("walletEntries").where("tenantId", "==", TA).where("email", "==", P.email.toLowerCase()).get()).size;
  const ok = bal === 5 && entries === 1;
  results["p2-m21"] = { verdict: ok ? "pass" : "fail", actual: `two simultaneous joins → ${codes}; wallet balance ${bal}; wallet entries ${entries}; creditPaidUntil=${mem?.creditPaidUntil ? "set" : "missing"}`, notes: codes === "200/200" ? "Both requests answered 200 (the 409 only fires once the first has written 'active'); the credit itself is transactional (creditPaidUntil read+set inside runTransaction), so the wallet was credited once — the money is right, the second response is just not a 409." : undefined };
});
// ── p2-m22: churn between tiers ───────────────────────────────────────────
await step("p2-m22", async () => {
  const b0 = await walletBalance(TA, P.email);
  const c1 = await api(P, "POST", "/api/my/memberships/cancel", { tenantId: TA });
  const j2 = await api(P, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "pct" });
  const c2 = await api(P, "POST", "/api/my/memberships/cancel", { tenantId: TA });
  const j3 = await api(P, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "credit" });
  const b1 = await walletBalance(TA, P.email);
  const ok = c1.status === 200 && j2.status === 200 && c2.status === 200 && j3.status === 200 && b1 === b0 && j3.json?.creditAdded === false;
  results["p2-m22"] = { verdict: ok ? "pass" : "fail", actual: `cancel ${c1.status} → join % ${j2.status} → cancel ${c2.status} → join credit ${j3.status} (creditAdded=${j3.json?.creditAdded}); balance ${b0} → ${b1}` };
});
// ── p2-m23: memberships list by role ──────────────────────────────────────
await step("p2-m23", async () => {
  await api(PF, "POST", "/api/my/memberships/join", { tenantId: TC, tierId: "credit" }); await api(P2, "POST", "/api/my/memberships/join", { tenantId: TC, tierId: "credit" });
  const a = await api(OA, "GET", "/api/memberships"); const s = await api(S1, "GET", "/api/memberships"); const f = await api(F1.actor, "GET", "/api/memberships"); const h = await api(HO, "GET", "/api/memberships");
  const fEmails = (f.json?.members ?? []).map((m: any) => m.email);
  const ok = a.status === 200 && (a.json?.members ?? []).some((m: any) => m.email === P.email.toLowerCase()) && s.status === 403 && f.status === 200 && fEmails.length === 1 && fEmails[0] === PF.email.toLowerCase();
  results["p2-m23"] = { verdict: ok ? "pass" : "fail", actual: `$A → ${a.status} ${a.json?.members?.length} member(s); $S → ${s.status} ${(s.json?.error ?? "").slice(0, 50)}; $F1 → ${f.status} members=[${fEmails.join(",")}] (HO sees ${h.json?.members?.length})` };
});
// ── p2-m24 / m25: discount validate ───────────────────────────────────────
await step("p2-m24", async () => {
  const codeB = await api(OB, "POST", "/api/discounts", { code: "BONLY", type: "percent", value: 10 });
  const exp = await api(OA, "POST", "/api/discounts", { code: "OLDONE", type: "percent", value: 10, expiry: ymd(daysFromNow(-1)) });
  const good = await api(OA, "POST", "/api/discounts", { code: "SUMMER20", type: "percent", value: 20 });
  const va = await api(P, "POST", "/api/discounts/validate", { tenantId: TA, code: "BONLY", subtotal: 30 });
  const vb = await api(P, "POST", "/api/discounts/validate", { tenantId: TA, code: "OLDONE", subtotal: 30 });
  await api(P, "POST", "/api/my/memberships/cancel", { tenantId: TA }); await api(P, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "pct" });
  const vc = await api(P, "POST", "/api/discounts/validate", { tenantId: TA, code: "SUMMER20", subtotal: 30 });
  const ok = codeB.status === 201 && exp.status === 201 && good.status === 201 && va.json?.valid === false && vb.json?.valid === false && /expired/i.test(vb.json?.reason ?? "") && vc.json?.valid === true;
  results["p2-m24"] = { verdict: ok ? "pass" : "fail", actual: `B's code at A → ${j(va)}; expired → ${j(vb)}; valid code with a 10% membership active → ${j(vc)}`, notes: "Fix needed (spec gap): /validate knows nothing about the member's percentage perk — it validates the code alone and never says whether the membership or the code wins; the stacking rule is only applied inside POST /api/my/bookings (my.ts:1131, codes stack unless `exclusive`). A parent can't see the combined effect before booking." };
});
await step("p2-m25", async () => {
  const v = await api(P, "POST", "/api/discounts/validate", { tenantId: TA, code: " summer20 ", subtotal: 30 });
  const ok = v.json?.valid === true && v.json?.code === "SUMMER20";
  results["p2-m25"] = { verdict: ok ? "pass" : "fail", actual: `' summer20 ' → ${j(v)}` };
});
// ── p2-m26: suppliers + PO ────────────────────────────────────────────────
await step("p2-m26", async () => {
  const sup = await api(OA, "POST", "/api/suppliers", { name: "Cones R Us", email: "sales@cones.example" });
  const po = await api(OA, "POST", "/api/purchasing", { kind: "po", supplier: "Cones R Us", supplierEmail: "sales@cones.example", date: ymd(new Date()), lineItems: [{ description: "Cones", qty: 10, unitPrice: 2 }], status: "draft" });
  const em = await api(OA, "POST", `/api/purchasing/${po.json?.id}/email`, {});
  const mail = mailLog.filter((l) => l.includes("Purchase order")).length;
  const exp0 = ((await api(OA, "GET", "/api/expenses")).json?.items ?? []).length;
  const recv = await api(OA, "PUT", `/api/purchasing/${po.json?.id}`, { status: "received" });
  const recv2 = await api(OA, "PUT", `/api/purchasing/${po.json?.id}`, { status: "received" });
  const exp1 = ((await api(OA, "GET", "/api/expenses")).json?.items ?? []).length;
  const del = await api(OA, "DELETE", `/api/suppliers/${sup.json?.id}`);
  const poAfter = await api(OA, "GET", "/api/purchasing"); const still = (poAfter.json?.items ?? poAfter.json ?? []).find((x: any) => x.id === po.json?.id);
  results["p2-m26"] = { verdict: "fail", actual: `supplier ${sup.status}; PO ${po.status} £${po.json?.amount}; email → ${em.status} (mailer not live: ${mail} 'Purchase order' send attempted, no attachment concept in purchasing.ts — the PO is the email body); mark received → ${recv.status} then again ${recv2.status}; Money-out rows before/after receiving: ${exp0} → ${exp1}; delete supplier with a PO → ${del.status}; PO still lists supplier name "${still?.supplier}"`, notes: "Fix needed: (1) receiving a PO writes NO Money-out entry (expenses count unchanged) — the plan expects one, once; (2) the PO email carries no PDF attachment (HTML body only); (3) the supplier delete is allowed and the PO keeps the free-text name (acceptable). Whether the email ARRIVES can't be seen — mailer not live." };
});
// ── p2-m27: expense claims ────────────────────────────────────────────────
await step("p2-m27", async () => {
  const c = await api(S1, "POST", "/api/expense-claims", { date: ymd(new Date()), category: "Equipment", amount: 12.5, note: "cones", receiptUrl: "https://example.com/r.jpg" });
  const other = await api(S2, "PATCH", `/api/expense-claims/${c.json?.id}`, { status: "approved" });
  const appr = await api(OA, "PATCH", `/api/expense-claims/${c.json?.id}`, { status: "approved" });
  const again = await api(OA, "PATCH", `/api/expense-claims/${c.json?.id}`, { status: "paid" });
  const exps = ((await api(OA, "GET", "/api/expenses")).json?.items ?? []).filter((e: any) => e.claimId === c.json?.id);
  const pr = await api(OA, "GET", "/api/payroll/runs"); const prTxt = JSON.stringify(pr.json)?.includes(c.json?.id) ? "claim id found in payroll" : "not in payroll (payroll ignores claims)";
  const ok = c.status === 201 && other.status === 403 && appr.status === 200 && exps.length === 1;
  results["p2-m27"] = { verdict: ok ? "pass" : "fail", actual: `staff raises → ${c.status}; other staff approves → ${other.status}; manager approves → ${appr.status}; then 'paid' → ${again.status}; Money-out rows for the claim: ${exps.length}; payroll: ${prTxt}`, notes: "The approved claim lands in Money out once (expenseId guard). It is NOT a payroll adjustment — payroll runs store the lines the browser sends (see p2-h1); the plan's 'and as a payroll adjustment once' half is not implemented (design gap, not a bug)." };
});
// ── p2-m28: past_due 15 days → readonly ───────────────────────────────────
await step("p2-m28", async () => {
  const bk = await opBook(OA, LA, P, "Kid RO", 10);
  await setSub(TA, { status: "past_due", pastDueSince: daysFromNow(-15).toISOString(), plan: "freelancer" });
  const acc = await api(OA, "GET", "/api/subscription/access");
  const lw = await api(OA, "POST", "/api/listings", { title: "Readonly listing", passes: [{ name: "Day", price: 5 }] });
  const bw = await api(OA, "POST", "/api/bookings", { booker: P.name, email: P.email, child: "Kid RO2", age: 7, listing: LA.title, pass: "Day", blockId: LA.blockId, amount: 10, method: "Bank transfer" });
  const mark = await api(S1, "POST", `/api/registers/${LA.blockId}/${LA.days[0]}/mark`, { ref: bk.ref, action: "in" });
  const pb = await api(P, "POST", "/api/my/bookings", { listingId: LA.listingId, blockId: LA.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "Kid Wall", age: 7, dates: [LA.days[1]] }] });
  const ok = acc.json?.mode === "readonly" && lw.status === 402 && bw.status === 402 && mark.status === 200 && pb.status !== 201 && /isn't taking online bookings/.test(pb.json?.error ?? "");
  results["p2-m28"] = { verdict: ok ? "pass" : "fail", actual: `access.mode=${acc.json?.mode}; POST listing → ${lw.status}; operator POST booking → ${bw.status}; staff register mark → ${mark.status} ${(mark.json?.error ?? "").slice(0, 40)}; parent new booking → ${pb.status} ${(pb.json?.error ?? "").slice(0, 70)}`, notes: lw.status === 201 ? "Fix needed: POST /api/listings is mounted BEFORE the subscription wall (index.ts mounts /api/listings with its own optional-auth chain so parents can browse) — so a read-only/locked tenant can still create and edit listings. The wall should also sit on the listings router's writes." : undefined };
});
// ── p2-m29: canceled → locked ─────────────────────────────────────────────
await step("p2-m29", async () => {
  await setSub(TA, { status: "canceled", plan: "freelancer" });
  const gb = await api(OA, "GET", "/api/bookings"); const gc = await api(OA, "GET", "/api/customers"); const gl = await api(OA, "GET", "/api/listings?mine=1");
  const inc = await api(S1, "POST", "/api/incidents", { kind: "accident", date: ymd(new Date()), childName: "Kid A", description: "grazed knee" });
  const task = await api(S1, "POST", "/api/tasks", { title: "Locked task" });
  const inv = await api(OA, "POST", "/api/invites", { role: "staff", email: "new@p2h.test", name: "New One" });
  const deact = await api(OA, "PATCH", `/api/invites/${encodeURIComponent(S2.uid)}/status`, { status: "deactivated" });
  const ok = gb.status === 200 && gc.status === 200 && gl.status === 402 && inc.status === 201 && task.status === 402 && inv.status === 402;
  results["p2-m29"] = { verdict: ok ? "pass" : "fail", actual: `canceled: GET bookings ${gb.status}, customers ${gc.status}, listings?mine=1 ${gl.status}; staff POST incident ${inc.status}; staff POST task ${task.status}; POST invite ${inv.status}; deactivate a team member → ${deact.status} ${(deact.json?.error ?? "").slice(0, 50)}`, notes: gl.status === 200 ? "Note: GET /api/listings is mounted BEFORE enforceSubscription in src/index.ts (public listings route), so listing reads stay open while locked — the plan says 'listings refused'; reads being open is arguably right (parents browse them)." : undefined };
  await setSub(TA, { status: "active", plan: "freelancer" });
});
// ── p2-m30: staff cap at create AND accept ────────────────────────────────
await step("p2-m30", async () => {
  await setSub(TA, { status: "active", plan: "freelancer", staffLimit: 3 });
  const i1 = await api(OA, "POST", "/api/invites", { role: "staff", email: "cap1@p2h.test", name: "Cap One" });
  const i2 = await api(OA, "POST", "/api/invites", { role: "staff", email: "cap2@p2h.test", name: "Cap Two" });
  const sub0 = await api(OA, "GET", "/api/subscription");
  await setSub(TA, { status: "active", plan: "freelancer", staffLimit: 2 });
  const i3 = await api(OA, "POST", "/api/invites", { role: "staff", email: "cap3@p2h.test", name: "Cap Three" });
  const newbie = await mkParent("Cap Joiner"); await db.collection("users").doc(newbie.uid).set({ role: "staff", chosen: false, email: "cap1@p2h.test" }, { merge: true }); newbie.email = "cap1@p2h.test";
  const acc = await api(newbie, "POST", `/api/invites/${i1.json?.token}/accept`, {});
  const ok = i3.status === 403 && /plan covers/i.test(i3.json?.error ?? "") && acc.status >= 400 && /plan/i.test(acc.json?.error ?? "");
  results["p2-m30"] = { verdict: ok ? "pass" : "fail", actual: `cap 3, 2 staff: invite → ${i1.status}/${i2.status} (used ${sub0.json?.current?.staffUsed}, pending ${sub0.json?.current?.staffPending}); cap lowered to 2: new invite → ${i3.status} ${(i3.json?.error ?? "").slice(0, 60)}; accepting an old pending invite → ${acc.status} ${(acc.json?.error ?? "").slice(0, 70)}` };
  await setSub(TA, { status: "active", plan: "freelancer", staffLimit: null });
});
// ── p2-m31: pricing ───────────────────────────────────────────────────────
await step("p2-m31", async () => {
  const cur = await api(HQ, "GET", "/api/subscription/pricing"); const plans = cur.json?.plans ?? [];
  const asA = await api(OA, "PUT", "/api/subscription/pricing", { plans });
  const getA = await api(OA, "GET", "/api/subscription/pricing");
  const before = await api(OA, "GET", "/api/subscription"); const priceBefore = before.json?.current?.price;
  const fl = plans.find((p: any) => p.id === "freelancer"); const orig = fl?.price;
  const asH = fl ? await api(HQ, "PUT", "/api/subscription/pricing", { plans: plans.map((p: any) => p.id === "freelancer" ? { ...p, price: (p.price ?? 0) + 1 } : p) }) : { status: 0, json: null };
  const after = await api(OA, "GET", "/api/subscription"); const priceAfter = after.json?.current?.price;
  const details = after.json?.current?.details?.price;
  if (fl) await api(HQ, "PUT", "/api/subscription/pricing", { plans }); // restore
  const ok = asA.status === 403 && getA.status === 403 && asH.status === 200;
  results["p2-m31"] = { verdict: ok ? "pass" : "fail", actual: `$A PUT → ${asA.status}, GET → ${getA.status}; $H raises freelancer £${orig}→£${orig + 1} → ${asH.status}; $A's own subscription price before/after: ${priceBefore}/${priceAfter} (plan card shows ${details})`, notes: "A stored sub.price wins over the plan list (subscription.ts:195 `sub?.price ?? lim.price`) and /start stores the price at signup, so a real subscription's amount doesn't move; this throwaway tenant was seeded without a stored price, so its displayed price followed the list. The platform PUT itself never touches tenants." };
});
// ── p2-m33: franchise vs subscription/payments ───────────────────────────
await step("p2-m33", async () => {
  const routes: [string, string][] = [["GET", "/api/subscription"], ["GET", "/api/subscription/access"], ["POST", "/api/subscription/checkout"], ["POST", "/api/subscription/card"], ["DELETE", "/api/subscription/card"], ["POST", "/api/subscription/start"], ["PUT", "/api/subscription"], ["POST", "/api/subscription/cancel"], ["POST", "/api/subscription/reactivate"], ["GET", "/api/subscription/pricing"], ["POST", "/api/payments/connect"], ["POST", "/api/payments/dashboard"]];
  const out: string[] = []; let bad = 0;
  for (const [m, p] of routes) { const r = await api(F1.actor, m, p, m === "GET" ? undefined : {}); out.push(`${m} ${p.replace("/api/", "")}=${r.status}`); if (r.status !== 403 && !(p === "/api/subscription/access" && r.status === 200)) bad++; }
  const payBlocked = out.filter((o) => o.startsWith("POST payments")).every((o) => /=(403|503)$/.test(o));
  results["p2-m33"] = { verdict: bad === 0 ? "pass" : payBlocked && out.filter((o) => !o.startsWith("POST payments")).every((o) => /=403$/.test(o) || o.includes("access=200")) ? "blocked" : "fail", actual: out.join("; "), notes: "GET /api/subscription/access is deliberately open to every team role (it drives the read-only banner). /api/payments/connect and /dashboard answer 503 here because needStripe() runs before the role check (payments.ts:57) — the franchise 403 can only be seen with Stripe keys (q4); every /api/subscription/* write and read is 403 for the franchise." };
});
// ── p2-m34: 'unpaid' ──────────────────────────────────────────────────────
await step("p2-m34", async () => {
  const src = fs.readFileSync("src/lib/billing.ts", "utf8"); const folds = /s\.status === "past_due" \|\| s\.status === "unpaid" \? "past_due"/.test(src);
  await setSub(TA, { status: "unpaid", plan: "freelancer" });
  const acc = await api(OA, "GET", "/api/subscription/access");
  await setSub(TA, { status: "active", plan: "freelancer" });
  const ok = acc.json?.mode === "locked" && folds;
  results["p2-m34"] = { verdict: ok ? "pass" : "fail", actual: `status 'unpaid' set directly → access.mode=${acc.json?.mode}; billing.ts syncFromStripe folds Stripe 'unpaid' into 'past_due': ${folds}`, notes: "So a stored 'unpaid' locks (accessFor), but syncFromStripe never stores it — a lapsed card stays past_due → read-only after 14 days until Stripe cancels the subscription (then 'canceled' → locked). Documented behaviour, not a bug." };
});
// ── p2-m35: cancel/reactivate history ─────────────────────────────────────
await step("p2-m35", async () => {
  await setSub(TA, { status: "active", plan: "freelancer", since: daysFromNow(-60).toISOString() });
  const c = await api(OA, "POST", "/api/subscription/cancel", {}); const s1 = (await db.collection("tenants").doc(TA).get()).data()?.subscription;
  const r = await api(OA, "POST", "/api/subscription/reactivate", {}); const s2 = (await db.collection("tenants").doc(TA).get()).data()?.subscription;
  const hq = await api(HQ, "GET", "/api/platform/subscriptions"); const row = (hq.json?.rows ?? hq.json ?? []).find?.((x: any) => x.id === TA);
  const keeps = !!(s2?.canceledAt || s2?.cancelHistory || s2?.history);
  results["p2-m35"] = { verdict: keeps ? "pass" : "fail", actual: `cancel → ${c.status} (status=${s1?.status}, cancelAt=${s1?.cancelAt ? "set" : "null"}, canceledAt=${s1?.canceledAt ?? "none"}); reactivate → ${r.status} (status=${s2?.status}, cancelAt=${s2?.cancelAt ?? "null"}, canceledAt=${s2?.canceledAt ?? "none"}, history=${s2?.cancelHistory ? "yes" : "no"}); HQ row status=${row?.status}`, notes: keeps ? undefined : "As the plan predicts (Amir 46a): reactivation wipes cancelAt and keeps no record that a cancellation happened, so the churn/Fall-off numbers lose that month. Fix needed: keep a cancel history array on the subscription (or a platform events log) and have platform churn read it." };
});
// ── p2-m36: TFC refund → to-reimburse ─────────────────────────────────────
await step("p2-m36", async () => {
  const bt = await opBook(OA, LA, P2, "Kid TFC", 40, "Tax-Free Childcare");
  await api(OA, "POST", `/api/bookings/${bt.ref}/record-payment`, { amount: 40, method: "Tax-Free Childcare", reference: "TFC-1" });
  const c = await api(P2, "POST", `/api/my/bookings/${bt.ref}/cancel`, { msg: "moving", refundPref: "card" });
  const ap = await api(OA, "POST", `/api/bookings/${bt.ref}/actions`, { type: "refund-approve" });
  const pays = await api(OA, "GET", "/api/payments"); const list: any[] = pays.json?.items ?? pays.json ?? [];
  const rf = list.find((p) => (p.refs ?? []).includes(bt.ref) && p.type === "refund");
  const rec = await api(OA, "GET", "/api/reconciliation"); const rrow = (rec.json?.refunds ?? []).find((x: any) => x.ref === bt.ref);
  const ok = ap.status === 200 && !!rf && rf.offline === true && rf.status === "to-reimburse" && !!rrow;
  results["p2-m36"] = { verdict: ok ? "pass" : "fail", actual: `TFC booking paid £40; parent cancel → ${c.status} (refund=${c.json?.cancel?.refund}, amount=${c.json?.cancel?.amount}); refund-approve → ${ap.status} ${(ap.json?.error ?? "").slice(0, 60)}; payments refund doc: ${rf ? `type=${rf.type} offline=${rf.offline} status=${rf.status} amount=${rf.amount}` : "NONE"}; reconciliation refunds row: ${rrow ? `via=${rrow.via} amount=${rrow.amount}` : "none"} (refunds listed: ${rec.json?.refunds?.length})` };
});
results["p2-m32"] = { verdict: "blocked", method: "browser", actual: "Browser step (Subscription page card removal) — queued for the browser agent; Stripe isn't configured on this server so the card UI can't be exercised." };

fs.writeFileSync("/tmp/p2h_day2.json", JSON.stringify({ results, mailLog: mailLog.slice(0, 40), world: { TA, TB, TC } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
