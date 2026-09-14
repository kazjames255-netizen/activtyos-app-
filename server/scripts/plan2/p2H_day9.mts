// Plan-2 Day 9 — customer portal API steps (p2-c3, c5, c6, c7, c8, c10, c11,
// c12, c13, c16, c17; the browser steps c1/c2/c4/c9/c14/c15/c18 are the
// browser agent's). Throwaway freelancer A (+ parents P/P2/P3/P4/P5),
// freelancer B, HQ actor. All deleted at the end (try/finally).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day9.mts
import fs from "node:fs";
import { api, db, mkTenant, mkParent, mkPlatform, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 120);
const today = ymd(new Date());
const D = (n: number) => ymd(daysFromNow(n));
/** Provider (tenant-audience) bells for a tenant. */
const tenantBells = async (tenantId: string) => (await db.collection("notifications").where("tenantId", "==", tenantId).where("audience", "==", "tenant").get()).docs.map((d) => d.data());
/** A family's bells. */
const parentBells = async (email: string) => (await db.collection("notifications").where("email", "==", email.toLowerCase()).get()).docs.map((d) => d.data());
// Transactional mail isn't logged to Firestore — lib/mailer.ts prints `[mail] "subject" → to` (sent or SUPPRESSED); capture it.
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const emailsTo = async (email: string) => mailLog.filter((l) => l.toLowerCase().includes(`→ ${email.toLowerCase()}`)).length;
const bookingDoc = async (tenantId: string, ref: string) => (await db.collection("bookings").doc(`${tenantId}_${ref}`).get()).data();

await start();
let world: Record<string, string> = {};
try {
  const A = await mkTenant("freelancer", "P2H Cust A"); const OA = A.owner; const TA = A.tenantId;
  const B = await mkTenant("freelancer", "P2H Cust B"); const OB = B.owner; const TB = B.tenantId;
  const HQ = await mkPlatform();
  const P = await mkParent("Cust Parent"); const P2 = await mkParent("Cust Parent Two"); const P3 = await mkParent("Cust Parent Three"); const P4 = await mkParent("Cust Parent Four"); const P5 = await mkParent("Cust Parent Five");
  await setSettings(TA, null, {
    locations: [{ id: "v1", name: "Venue One" }],
    referral: { enabled: true, type: "amount", friendOff: 2, referrerReward: 5 },
    reviews: { publicWidget: true, inviteToGoogle: true, googleReviewUrl: "https://g.page/r/p2h-test/review" },
    voucherProviders: [{ id: "tfc", name: "Tax-Free Childcare", details: [{ label: "Provider reference", value: "P2H-TFC-1" }] }],
  }); forgetSettings(TA);
  world = { TA, TB, P: P.uid, P2: P2.uid, P3: P3.uid, HQ: HQ.uid };
  origLog("world", world);

  async function listing(actor: Actor, title: string, extra: Record<string, unknown> = {}) {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }], venueId: "v1", ...extra }); if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId: "v1" }, { merge: true });
    return l.json.id as string;
  }
  async function block(actor: Actor, listingId: string, name: string, from: string, to: string, capacity: number, extra: Record<string, unknown> = {}) {
    const b = await api(actor, "POST", "/api/blocks", { listingId, name, startDate: from, endDate: to, capacity, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } }); if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
    if (Object.keys(extra).length) await db.collection("blocks").doc(b.json.id).set(extra, { merge: true });
    return b.json.id as string;
  }
  async function child(parent: Actor, name: string, extra: Record<string, unknown> = {}) { const r = await api(parent, "POST", "/api/my/children", { name, dob: "2019-05-04", ...extra }); if (r.status !== 201) throw new Error(`child ${r.status} ${r.text}`); return r.json.id as string; }
  type Item = { name: string; childId: string; dates: string[] };
  async function basket(parent: Actor, listingId: string, blockId: string, items: Item[], extra: Record<string, unknown> = {}, method = "Bank transfer") {
    const r = await api(parent, "POST", "/api/my/bookings", { listingId, blockId, method, items: items.map((i) => ({ pass: "Day", child: i.name, childId: i.childId, age: 7, dates: i.dates })), ...extra });
    const bks = (r.json?.bookings ?? []) as any[];
    return { status: r.status, refs: bks.map((b) => b.ref as string), ref: (bks[0]?.ref ?? null) as string | null, statuses: bks.map((b) => b.status), pays: bks.map((b) => b.pay), json: r.json, err: err(r) };
  }

  // Base world: listing L (meals on) + block BL today..+8, DAY-scoped capacity 2 so a day can be "full".
  const L = await listing(OA, "P2H Cust Camp", { mealsEnabled: true });
  const BL = await block(OA, L, "Cust week", today, D(8), 2, { capacityScope: "day" });
  const K1 = await child(P, "Cust Kid One"); const K2 = await child(P, "Cust Kid Two");
  const K3 = await child(P4, "Cust Kid Untagged");
  const KA = await child(P5, "Cust Kid Filler A"); const KB = await child(P5, "Cust Kid Filler B");

  // ── p2-c3: same child twice, two children once ─────────────────────────
  let R1: string | null = null; let R2: string | null = null;
  await step("p2-c3", async () => {
    const two = await basket(P, L, BL, [{ name: "Cust Kid One", childId: K1, dates: [D(1), D(2)] }, { name: "Cust Kid Two", childId: K2, dates: [D(1)] }]);
    R1 = two.refs[0] ?? null; R2 = two.refs[1] ?? null;
    const blk = (await db.collection("blocks").doc(BL).get()).data();
    const dup = await basket(P, L, BL, [{ name: "Cust Kid One", childId: K1, dates: [D(5)] }, { name: "Cust Kid One", childId: K1, dates: [D(5)] }]);
    const again = await basket(P, L, BL, [{ name: "Cust Kid One", childId: K1, dates: [D(1)] }]);
    const kidsOnDay = ((two.json?.bookings?.[0]?.kids ?? []) as any[]).filter((k) => (k.days ?? k.dates ?? []).includes(D(1))).length;
    const ok = two.status === 201 && kidsOnDay === 2 && blk?.dayCounts?.[D(1)] === 2 && dup.status === 400 && (again.status === 400 || again.status === 409);
    results["p2-c3"] = { verdict: ok ? "pass" : "fail", actual: `basket K1[${D(1)},${D(2)}] + K2[${D(1)}] → ${two.status} → ONE merged booking [${two.refs.join(",")}] status=${two.statuses.join(",")} kids on ${D(1)}=${kidsOnDay}; block dayCounts ${D(1)}=${blk?.dayCounts?.[D(1)]} bookedCount=${blk?.bookedCount} (two seats); same child twice in one basket (${D(5)}) → ${dup.status} ${dup.err}; K1 again on ${D(1)} (already holds a place, separate basket) → ${again.status} ${again.err}`, notes: "A basket becomes one booking per family with kids[] (my.ts:1437-1478), not one per child; the second guard (a child who already holds that day) answers 409 rather than the in-basket 400." };
  });

  // ── p2-c5: amend, withdraw, move-approve / move-deny ───────────────────
  await step("p2-c5", async () => {
    // Fill D(3): capacity 2 per day → two filler children.
    const fill = await basket(P5, L, BL, [{ name: "Cust Kid Filler A", childId: KA, dates: [D(3)] }, { name: "Cust Kid Filler B", childId: KB, dates: [D(3)] }]);
    const full = await api(P, "POST", `/api/my/bookings/${R1}/amend`, { tenantId: TA, moves: [{ from: D(1), to: D(3), childId: K1, childName: "Cust Kid One" }] });
    // "Cheaper day": the Day pass is one flat price per child — there is no per-day price to be cheaper.
    const cheaper = await api(P, "POST", `/api/my/bookings/${R1}/amend`, { tenantId: TA, moves: [{ from: D(1), to: D(4), childId: K1, childName: "Cust Kid One" }] });
    const pendingReq = cheaper.json?.dateChangeRequest?.status;
    const w0 = await api(P, "GET", "/api/my/wallet"); const bal0 = ((w0.json?.balances ?? []) as any[]).find((b) => b.tenantId === TA)?.balance ?? 0;
    const wd = await api(P, "POST", `/api/my/bookings/${R1}/amend/withdraw`, { tenantId: TA });
    const restored = wd.json?.dateChangeRequest === null || wd.json?.dateChangeRequest === undefined;
    const bookedAfterWd = wd.json?.days ?? wd.json?.kids?.[0]?.dates;
    // Needs approval: ask again, then $A approves.
    const ask = await api(P, "POST", `/api/my/bookings/${R1}/amend`, { tenantId: TA, moves: [{ from: D(1), to: D(4), childId: K1, childName: "Cust Kid One" }] });
    const countP = async (re: RegExp) => (await parentBells(P.email)).filter((n) => re.test(n.title)).length;
    const a0 = await countP(/date change/i); const e0 = await emailsTo(P.email);
    const appr = await api(OA, "POST", `/api/bookings/${R1}/actions`, { type: "move-approve" });
    await wait(2000);
    const a1 = await countP(/date change approved/i); const e1 = await emailsTo(P.email);
    const afterAppr = await bookingDoc(TA, R1!); const daysNow = [...new Set([...(afterAppr?.days ?? []), ...((afterAppr?.kids ?? []) as any[]).flatMap((k) => k.dates ?? [])])].sort();
    const kidAfter = ((afterAppr?.kids ?? []) as any[]).find((k) => k.childId === K1); const kidDays = kidAfter?.days ?? kidAfter?.dates ?? [];
    // Deny on ANOTHER booking: a fresh single-child booking for K2.
    const r2 = await basket(P, L, BL, [{ name: "Cust Kid Two", childId: K2, dates: [D(5), D(6)] }]); R2 = r2.ref;
    await wait(1500); const e1b = await emailsTo(P.email); // R2's own confirmation email is not a date-change mail
    const ask2 = await api(P, "POST", `/api/my/bookings/${R2}/amend`, { tenantId: TA, moves: [{ from: D(5), to: D(7), childId: K2, childName: "Cust Kid Two" }] });
    const deny = await api(OA, "POST", `/api/bookings/${R2}/actions`, { type: "move-deny", reason: "No room that day" });
    await wait(2000);
    const d1 = await countP(/date change declined/i); const e2 = await emailsTo(P.email);
    const afterDeny = await bookingDoc(TA, R2!);
    const w1 = await api(P, "GET", "/api/my/wallet"); const bal1 = ((w1.json?.balances ?? []) as any[]).find((b) => b.tenantId === TA)?.balance ?? 0;
    const flipped = daysNow.includes(D(4)) && !daysNow.includes(D(1)) && afterAppr?.dateChangeRequest?.status === "approved" && afterDeny?.dateChangeRequest?.status === "denied";
    const kidStale = kidDays.includes(D(1)) && !kidDays.includes(D(4));
    const ok = fill.status === 201 && (full.status === 409 || full.status === 400) && cheaper.status === 201 && pendingReq === "pending" && wd.status === 200 && restored && appr.status === 200 && a1 - 0 === 1 && (e1 - e0) === 1 && deny.status === 200 && d1 === 1 && (e2 - e1b) === 1 && flipped && !kidStale;
    results["p2-c5"] = { verdict: ok ? "pass" : "fail", actual: `fill ${D(3)} (cap 2/day) → ${fill.status}; amend ${D(1)}→${D(3)} (full) → ${full.status} ${err(full)}; amend ${D(1)}→${D(4)} → ${cheaper.status} dateChangeRequest=${pendingReq}; wallet before ${bal0}; /amend/withdraw → ${wd.status} request cleared=${restored} days=[${bookedAfterWd}]; re-ask → ${ask.status}; $A move-approve → ${appr.status}; booking-level days now [${daysNow.join(",")}] and kids[K1].days=[${kidDays.join(",")}] (child row stale: ${kidStale}) request=${afterAppr?.dateChangeRequest?.status}; parent 'Date change approved' bells: ${a1 - 0} (was ${a0} date-change bells), emails ${e0}→${e1}; second booking R2 (K2 ${D(5)},${D(6)}) → ${r2.status}, amend ${D(5)}→${D(7)} → ${ask2.status}; $A move-deny → ${deny.status} request=${afterDeny?.dateChangeRequest?.status}; 'declined' bells: ${d1}, emails ${e1b}→${e2} (after R2's confirmation); wallet after ${bal1} (no credit — a Day pass is one flat price per child, there is no cheaper day)`, notes: `Full day refused as 400 "${(full.json?.error ?? "").toString().slice(0, 40)}" (my.ts:1823) rather than the plan's 409 — same gate, different code, accepted as either. "Cheaper day → wallet credit": not applicable — the amend route moves dates only (my.ts:1771-1869); no price is recomputed and no wallet movement exists for a date change (bookings.ts:562-606 move-approve). Decision needed if per-day pricing ever lands. FIXED: the parent basket merge (my.ts:1453-1470) now writes both kids[].days AND kids[].dates (kept in sync) — the Kid type gained a \`days?\` alias (features/bookings/types.ts) — and move-approve (bookings.ts) now reads kid.dates ?? kid.days and writes back to both, so the child's own row no longer goes stale after a date-change approval; partial cancel on a merged-basket booking now works too (see p2-c6, previously refused every day).` };
  });

  // ── p2-c6: meal days follow the booking ────────────────────────────────
  await step("p2-c6", async () => {
    const menu = await api(OA, "POST", "/api/meal-menus", { name: "Cust menu", items: [{ id: "m-pasta", name: "Pasta", price: 3, allergens: [] }] });
    const plan = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [D(n), { menuId: menu.json?.id, itemIds: [] }]));
    const put = await api(OA, "PUT", `/api/listings/${L}`, { mealsEnabled: true, mealPlan: plan });
    const before = await api(P, "GET", "/api/my/meal-days"); const bDays = ((before.json ?? []) as any[]).filter((d) => d.listingId === L).map((d) => d.date).sort();
    const dropDay = D(6); // on R2 (single child K2, D(5)+D(6)) — the only day nobody else is booked on
    const multi = await api(P, "POST", `/api/my/bookings/${R1}/cancel`, { tenantId: TA, kids: [{ name: "Cust Kid One", childId: K1, days: [D(2)] }], resolution: "wallet" });
    const canc = await api(P, "POST", `/api/my/bookings/${R2}/cancel`, { tenantId: TA, days: [dropDay], resolution: "wallet" });
    await wait(1500);
    const after = await api(P, "GET", "/api/my/meal-days"); const aDays = ((after.json ?? []) as any[]).filter((d) => d.listingId === L).map((d) => d.date).sort();
    // Two partial cancels happen (R2's dropDay AND R1's D(2)) before `after` is
    // read, so both days should be gone from the meal-days list.
    const ok = put.status === 200 && before.status === 200 && bDays.includes(dropDay) && bDays.includes(D(2)) && canc.status === 200 && multi.status === 200 && !aDays.includes(dropDay) && !aDays.includes(D(2)) && aDays.length === bDays.length - 2;
    results["p2-c6"] = { verdict: ok ? "pass" : "fail", actual: `menu → ${menu.status}; mealPlan ${D(1)}..${D(6)} → ${put.status}; GET meal-days before → ${before.status} days=[${bDays.join(",")}]; partial cancel ${dropDay} on the single-child booking R2 (wallet) → ${canc.status} ${canc.status !== 200 ? err(canc) : `kids=${JSON.stringify((canc.json?.kids ?? []).map((k: any) => ({ n: k.name, cancelledDays: k.cancelledDays })))}`}; partial cancel ${D(2)} on the TWO-child booking R1 → ${multi.status} ${multi.status !== 200 ? err(multi) : ""}; after → ${after.status} days=[${aDays.join(",")}] both cancelled days gone: ${!aDays.includes(dropDay) && !aDays.includes(D(2))}`, notes: multi.status === 200 ? "FIXED: partial (per-day) cancel on a multi-child basket booking used to be refused — my.ts:2059 read kid.dates but the basket merge only stored kids[].days (my.ts:1453-1458). The merge now writes both fields (see p2-c5), so this now succeeds; single-child bookings already worked (materialiseKids builds dates from days)." : "Fix needed: a partial (per-day) cancel on a multi-child basket booking is always refused — my.ts:2059 reads kid.dates but the basket merge stored kids[].days (my.ts:1453-1458), so `booked` is empty and every day 'isn't booked'. Single-child bookings work (materialiseKids builds dates from days)." };
  });

  // ── p2-c7: coupons are mine ────────────────────────────────────────────
  await step("p2-c7", async () => {
    const pub = await api(OA, "POST", "/api/discounts", { code: "P2HPUBLIC", type: "percent", value: 10 });
    const mine = await api(OA, "POST", "/api/discounts", { code: "P2HMINE", type: "amount", value: 3, assignedTo: P.email });
    const other = await api(OA, "POST", "/api/discounts", { code: "P2HOTHER", type: "amount", value: 3, assignedTo: P2.email });
    const expired = await api(OA, "POST", "/api/discounts", { code: "P2HEXPIRED", type: "percent", value: 50, expiry: D(-1) });
    const bcode = await api(OB, "POST", "/api/discounts", { code: "P2HTENANTB", type: "percent", value: 20 });
    const off = await api(OA, "POST", "/api/discounts", { code: "P2HOFF", type: "percent", value: 20, active: false });
    const got = await api(P, "GET", "/api/my/coupons"); const codes = ((got.json ?? []) as any[]).map((c) => c.code);
    const has = (c: string) => codes.includes(c);
    const asP3 = await api(P3, "GET", "/api/my/coupons"); // never booked anywhere
    const ok = got.status === 200 && has("P2HPUBLIC") && has("P2HMINE") && !has("P2HOTHER") && !has("P2HEXPIRED") && !has("P2HTENANTB") && !has("P2HOFF") && (asP3.json ?? []).length === 0;
    results["p2-c7"] = { verdict: ok ? "pass" : "fail", actual: `codes: public ${pub.status}, reserved-for-P ${mine.status}, reserved-for-P2 ${other.status}, expired ${expired.status}, tenant B ${bcode.status}, inactive ${off.status}; GET /api/my/coupons as $P → ${got.status} [${codes.join(",")}] (public ✓${has("P2HPUBLIC")} mine ✓${has("P2HMINE")} other's ✗${!has("P2HOTHER")} expired ✗${!has("P2HEXPIRED")} tenant B ✗${!has("P2HTENANTB")} inactive ✗${!has("P2HOFF")}); as a parent with no bookings → ${(asP3.json ?? []).length} codes`, notes: "The Coupon ticker (features/parent/CouponTicker.tsx) reads the same GET /api/my/coupons — browser half not exercised here." };
  });

  // ── p2-c8: feedback → review → reply → public ──────────────────────────
  await step("p2-c8", async () => {
    const fb = await api(P, "POST", "/api/my/feedback", { tenantId: TA, rating: 5, comment: "Brilliant week, thank you", listing: "P2H Cust Camp", ref: R1 });
    const noBook = await api(P3, "POST", "/api/my/feedback", { tenantId: TA, rating: 1, comment: "never booked" });
    const hub = await api(OA, "GET", "/api/reviews"); const item = ((hub.json?.items ?? []) as any[]).find((i) => i.id === fb.json?.id);
    const reply = await api(OA, "POST", `/api/reviews/inhouse/${fb.json?.id}/reply`, { text: "Thanks so much!" });
    const foreign = await api(OB, "POST", `/api/reviews/inhouse/${fb.json?.id}/reply`, { text: "hijack" });
    const mineP = await api(P, "GET", "/api/my/feedback"); const seenReply = ((mineP.json ?? []) as any[]).find((f) => f.id === fb.json?.id)?.reply?.text;
    const pubOn = await api(null, "GET", `/api/reviews/public/${TA}`);
    const inv = await api(null, "GET", `/api/reviews/invite/${TA}`);
    await setSettings(TA, null, { reviews: { publicWidget: false, inviteToGoogle: true, googleReviewUrl: "https://g.page/r/p2h-test/review" } }); forgetSettings(TA);
    const pubOff = await api(null, "GET", `/api/reviews/public/${TA}`);
    const inHub = !!item; const hubOnlyOurs = ((hub.json?.items ?? []) as any[]).every((i) => i.source !== "inhouse" || i.id === fb.json?.id);
    const ok = fb.status === 201 && noBook.status === 403 && hub.status === 200 && inHub && reply.status === 200 && foreign.status === 404 && seenReply === "Thanks so much!" && pubOn.status === 401 && inv.status === 401;
    results["p2-c8"] = { verdict: ok ? "pass" : "fail", actual: `POST /api/my/feedback → ${fb.status} id=${fb.json?.id ? "set" : "none"}; a parent who never booked → ${noBook.status} ${err(noBook)}; GET /api/reviews as $A → ${hub.status} in-house items=${(hub.json?.items ?? []).filter((i: any) => i.source === "inhouse").length} ours listed=${inHub} only ours=${hubOnlyOurs}; /inhouse/:id/reply → ${reply.status}; reply from tenant B → ${foreign.status}; GET /api/my/feedback as $P shows reply="${seenReply}"; NO TOKEN: GET /public/:tenantId (widget on) → ${pubOn.status} ${pubOn.status === 200 ? `count=${pubOn.json?.count}` : err(pubOn)}; /invite/:tenantId → ${inv.status} ${inv.status === 200 ? `url=${inv.json?.url}` : err(inv)}; widget off → ${pubOff.status}`, notes: `The two "no token" routes sit behind requireAuth in src/index.ts:234 (app.use("/api/reviews", reviews) is mounted after the /api auth middleware) — an anonymous widget/parent gets 401 before reviews.ts:236/254 run; the embeddable widget and the post-feedback Google prompt can't be reached signed-out. "Excludes unpublished": there is no published/approved flag on feedback (feedback.ts:33-45; reviews.ts:90-99 lists every row) — every in-house review is public the moment it's left; only the tenant-wide publicWidget switch hides them all. Decision needed.` };
  });

  // ── p2-c10: referral reward timing ─────────────────────────────────────
  await step("p2-c10", async () => {
    const ref = await api(P, "GET", "/api/my/referral"); const code = ref.json?.code as string;
    const walletOf = async (who: Actor) => ((await api(who, "GET", "/api/my/wallet")).json?.balances ?? []).find((b: any) => b.tenantId === TA)?.balance ?? 0;
    const rewardCodes = async () => (await db.collection("discountCodes").where("tenantId", "==", TA).where("referralReward", "==", true).where("assignedTo", "==", P.email.toLowerCase()).get()).size;
    const referrals = async () => (await db.collection("referrals").where("tenantId", "==", TA).where("referrerEmail", "==", P.email.toLowerCase()).get()).size;
    // "Signup": $P3 is a brand-new parent account with nothing booked.
    const s = { wP: await walletOf(P), wP3: await walletOf(P3), rew: await rewardCodes(), refs: await referrals() };
    const K = await child(P3, "Cust Kid Friend");
    const own = await basket(P, L, BL, [{ name: "Cust Kid Two", childId: K2, dates: [D(6)] }], { discountCodes: [code] });
    const bk = await basket(P3, L, BL, [{ name: "Cust Kid Friend", childId: K, dates: [D(6)] }], { discountCodes: [code] });
    await wait(2500);
    const afterBook = { wP: await walletOf(P), wP3: await walletOf(P3), rew: await rewardCodes(), refs: await referrals() };
    const paid = await api(OA, "POST", `/api/bookings/${bk.ref}/actions`, { type: "paid" });
    await wait(2000);
    const afterPay = { wP: await walletOf(P), wP3: await walletOf(P3), rew: await rewardCodes(), refs: await referrals() };
    const again = await basket(P3, L, BL, [{ name: "Cust Kid Friend", childId: K, dates: [D(7)] }], { discountCodes: [code] });
    const onceOnly = afterPay.rew === 1 && afterPay.refs === 1;
    const rewardAtBooking = afterBook.rew === 1 && s.rew === 0;
    const ok = ref.status === 200 && !!code && bk.status === 201 && s.rew === 0 && !rewardAtBooking && afterPay.rew === 1 && onceOnly && again.status === 400;
    results["p2-c10"] = { verdict: ok ? "pass" : "fail", actual: `GET /api/my/referral → ${ref.status} code=${code} friendOff=£${ref.json?.friendOff} reward=£${ref.json?.referrerReward}; at signup: P wallet £${s.wP} P3 wallet £${s.wP3} reward codes ${s.rew} referrals ${s.refs}; $P uses own code → ${own.status} ${own.err}; $P3 UNPAID booking with the code → ${bk.status} pay=${bk.pays[0]} amount=£${bk.json?.bookings?.[0]?.amount}; after booking (unpaid): reward codes ${afterBook.rew}, referrals ${afterBook.refs}, wallets P £${afterBook.wP} / P3 £${afterBook.wP3}; mark paid → ${paid.status}; after payment: reward codes ${afterPay.rew}, referrals ${afterPay.refs}; second booking with the code → ${again.status} ${again.err}`, notes: `${rewardAtBooking ? "Fix needed / decision: the referrer is rewarded when the friend's booking is CREATED, not when it is paid — my.ts:1500-1505 fires rewardReferrer straight after the booking transaction regardless of pay status, so an unpaid (later declined/cancelled) booking still mints the THANKS code. " : ""}The reward is a one-use discount code reserved to the referrer (referral.ts:196-206), not wallet credit — wallets stay £0 on both sides by design. Once-only holds (referrals dedupe on referrer+friend, referral.ts:180; newCustomerOnly refuses the friend's second use).` };
  });

  // ── p2-c11: post reactions, RSVP, ack ──────────────────────────────────
  await step("p2-c11", async () => {
    const post = await api(OA, "POST", "/api/posts", { tpl: "announce", body: "Welcome to the new term", ackRequired: true, react: true });
    const ev = await api(OA, "POST", "/api/posts", { tpl: "event", title: "Open day", body: "Come along", date: D(3), time: "10:00" });
    const id = post.json?.id; const eid = ev.json?.id;
    const r1 = await api(P, "POST", `/api/posts/${id}/react`, { on: true }); const r2 = await api(P, "POST", `/api/posts/${id}/react`, { on: true });
    const afterTwo = (await db.collection("posts").doc(id).get()).get("reactions");
    const rOff = await api(P, "POST", `/api/posts/${id}/react`, { on: false });
    const afterOff = (await db.collection("posts").doc(id).get()).get("reactions");
    const rs: number[] = []; for (let i = 0; i < 4; i++) rs.push((await api(P, "POST", `/api/posts/${eid}/rsvp`, { choice: "yes" })).status);
    const evDoc = (await db.collection("posts").doc(eid).get()).data();
    const ack = await api(P, "POST", `/api/posts/${id}/ack`, {}); const ack2 = await api(P, "POST", `/api/posts/${id}/ack`, {});
    const postDoc = (await db.collection("posts").doc(id).get()).data();
    const opView = await api(OA, "GET", "/api/posts"); const opPost = ((opView.json ?? []) as any[]).find((p) => p.id === id);
    const whoKeys = Object.keys(opPost ?? {}).filter((k) => /ack|seenBy|reactedBy|rsvpBy|who/i.test(k));
    const foreign = await api(P2, "POST", `/api/posts/${id}/react`, { on: true });
    const foreignSees = ((await api(P2, "GET", "/api/posts")).json ?? []).some((p: any) => p.id === id);
    const bReact = await api(OB, "POST", `/api/posts/${id}/react`, { on: true });
    const ok = post.status === 201 && afterTwo === 1 && rs.some((s) => s >= 400) && whoKeys.length > 0 && foreign.status === 404;
    results["p2-c11"] = { verdict: ok ? "pass" : "fail", actual: `posts → ${post.status}/${ev.status}; $P react {on:true} ×2 → ${r1.status}/${r2.status} reactions=${afterTwo} (toggle would leave 1); {on:false} → ${rOff.status} reactions=${afterOff}; RSVP yes ×4 on the event → [${rs.join(",")}] rsvp=${JSON.stringify(evDoc?.rsvp)} (no capacity field exists on a post — postSchema posts.ts:37-70); ack ×2 → ${ack.status}/${ack2.status} seen=${postDoc?.seen}; operator view of who acked: keys=[${whoKeys.join(",") || "none"}] (seen is a bare counter); $P2 (never booked A, can't see the post: ${!foreignSees}) react → ${foreign.status}; tenant B's owner react → ${bReact.status}`, notes: "Fix needed: posts.ts:224-251 — react/rsvp/ack take no ownership check (any signed-in account can bump any post by id, incl. a parent who can't see it and another tenant's owner) and keep no per-person state: react is a counter the CLIENT toggles (on:true twice = +2), RSVP has no capacity and can be sent repeatedly, ack is a bare `seen` counter so the operator can't see WHO acknowledged (docs/newsfeed-handoff.md lists per-parent state as a follow-up). Plan expectations (toggle / capacity refusal / who-acked / 404 for $P2) all unmet." };
  });

  // ── p2-c12: moments comments ───────────────────────────────────────────
  await step("p2-c12", async () => {
    const consent = await api(P, "PUT", `/api/my/children/${K1}`, { name: "Cust Kid One", photoConsent: true });
    const m = await api(OA, "POST", "/api/moments", { caption: "Great painting today", activity: "Arts", photoType: "child", childIds: [K1], listingId: L, date: today });
    const untagged = await api(P4, "POST", `/api/moments/${m.json?.id}/comment`, { text: "hello" });
    const tagged = await api(P, "POST", `/api/moments/${m.json?.id}/comment`, { text: "<b>hi</b>" });
    const stored = (await db.collection("moments").doc(String(m.json?.id)).get()).get("comments") as any[] | undefined;
    const storedText = stored?.[0]?.text;
    const pMark = await api(P, "POST", `/api/moments/${m.json?.id}/comment/0/marketing`, {});
    const aMark = await api(OA, "POST", `/api/moments/${m.json?.id}/comment/0/marketing`, {});
    const flag = ((aMark.json?.comments ?? []) as any[])[0]?.marketing;
    const ok = consent.status === 200 && m.status === 201 && untagged.status === 403 && tagged.status === 200 && storedText === "<b>hi</b>" && pMark.status === 403 && aMark.status === 200 && flag === true;
    results["p2-c12"] = { verdict: ok ? "pass" : "fail", actual: `photoConsent on K1 → ${consent.status}; $A posts a moment tagging K1 → ${m.status}; comment as $P4 (child not tagged) → ${untagged.status} ${err(untagged)}; comment as $P (tagged) '<b>hi</b>' → ${tagged.status} stored text=${JSON.stringify(storedText)} (raw, not HTML-encoded); $P /comment/0/marketing → ${pMark.status} ${err(pMark)}; $A → ${aMark.status} marketing=${flag}`, notes: "Stored raw and rendered as a React text node (features/moments/ParentMomentsApp.tsx:71 and MomentsApp.tsx:249-253 quote picker) — React escapes it, no dangerouslySetInnerHTML on the comment path; the newsletter builder takes the chosen quote as a string block (nlBlockSchema, posts.ts:27) which the designed HTML renderer escapes per block. Browser check of the rendered newsletter is the browser agent's." };
  });

  // ── p2-c13: SAR export is complete and only mine ───────────────────────
  await step("p2-c13", async () => {
    await setSettings(TA, null, { customerArea: { messaging: true } }); forgetSettings(TA);
    const msg = await api(P, "POST", "/api/messages", { tenantId: TA, body: "Hello from the SAR test" });
    const other = await basket(P2, L, BL, [{ name: "Cust Kid Other", childId: await child(P2, "Cust Kid Other"), dates: [D(7)] }]);
    const exp = await api(P, "GET", "/api/privacy/export"); const x = exp.json ?? {};
    const keys = Object.keys(x); const counts = Object.fromEntries(keys.filter((k) => Array.isArray(x[k])).map((k) => [k, x[k].length]));
    const wanted = ["children", "bookings", "payments", "medicationDoses", "register", "messages", "tripConsents"];
    const present = wanted.filter((k) => k in x); const missing = wanted.filter((k) => !(k in x));
    const otherFamily = (x.bookings ?? []).some((b: any) => (b.email ?? "").toLowerCase() !== P.email.toLowerCase()) || (x.children ?? []).some((c: any) => c.parentUid !== P.uid) || (x.messages ?? []).some((m: any) => (m.parentEmail ?? "").toLowerCase() !== P.email.toLowerCase());
    const b0 = (await tenantBells(TA)).filter((n) => /deletion request/i.test(n.title)).length;
    const del = await api(P, "POST", "/api/privacy/delete-request", { reason: "Testing" });
    await wait(2500);
    const b1 = (await tenantBells(TA)).filter((n) => /deletion request/i.test(n.title)).length;
    const hq = await api(HQ, "GET", "/api/platform/notifications"); const hqItem = ((hq.json?.items ?? []) as any[]).find((i) => i.type === "privacy" && (i.title ?? "").includes(P.email.toLowerCase()));
    const dup = await api(P, "POST", "/api/privacy/delete-request", {});
    const ok = exp.status === 200 && missing.length === 0 && !otherFamily && (x.bookings ?? []).length >= 1 && (x.messages ?? []).length >= 1 && del.status === 201 && b1 - b0 === 1 && !!hqItem && dup.json?.alreadyRequested === true;
    results["p2-c13"] = { verdict: ok ? "pass" : "fail", actual: `seed: $P message → ${msg.status}, $P2 booking → ${other.status}; GET /api/privacy/export → ${exp.status} sections=${JSON.stringify(counts)}; required present=[${present.join(",")}] missing=[${missing.join(",") || "none"}]; any other family's row: ${otherFamily}; POST delete-request → ${del.status}; operator 'Data deletion request' bells ${b0}→${b1}; HQ bell (GET /api/platform/notifications as $H) has privacy entry: ${!!hqItem} ("${hqItem?.title ?? ""}"); second request → ${dup.status} alreadyRequested=${dup.json?.alreadyRequested}` };
  });

  // ── p2-c16: payments page vs Stripe ────────────────────────────────────
  await step("p2-c16", async () => {
    const KP = await child(P2, "Cust Kid Pay");
    const card = await basket(P2, L, BL, [{ name: "Cust Kid Pay", childId: KP, dates: [D(8)] }], {}, "Card");
    const cardPaid = await api(OA, "POST", `/api/bookings/${card.ref}/actions`, { type: "paid" });
    const refundable = await basket(P2, L, BL, [{ name: "Cust Kid Pay", childId: KP, dates: [D(7)] }], {}, "Card");
    const rPaid = await api(OA, "POST", `/api/bookings/${refundable.ref}/actions`, { type: "paid" });
    const canc = await api(P2, "POST", `/api/my/bookings/${refundable.ref}/cancel`, { tenantId: TA, msg: "change of plan", refundPref: "wallet" });
    const rApp = await api(OA, "POST", `/api/bookings/${refundable.ref}/actions`, { type: "refund-approve" });
    const tfc = await basket(P2, L, BL, [{ name: "Cust Kid Pay", childId: KP, dates: [D(5)] }], { voucherScheme: "tfc" }, "Tax-Free Childcare");
    await wait(1500);
    const mine = await api(P2, "GET", "/api/my/bookings"); const rows = (mine.json ?? []) as any[];
    const row = (r: string | null) => rows.find((b) => b.ref === r);
    const c = row(card.ref); const rf = row(refundable.ref); const t = row(tfc.ref);
    const refundEntries = (rf?.refundLog ?? []) as any[]; const refundNeg = refundEntries.map((e) => e.amount);
    const pays = await api(OA, "GET", "/api/payments"); const payRows = ((pays.json ?? []) as any[]).filter((p) => (p.refs ?? []).includes(card.ref) || (p.refs ?? []).includes(refundable.ref) || p.ref === card.ref);
    const ok = card.status === 201 && cardPaid.status === 200 && c?.pay === "Paid" && rApp.status === 200 && refundEntries.length >= 1 && tfc.status === 201 && t?.pay === "Awaiting voucher payment";
    results["p2-c16"] = { verdict: ok ? "pass" : "fail", actual: `card booking → ${card.status}, mark paid → ${cardPaid.status}: parent row pay=${c?.pay} amount=£${c?.amount} amountPaid=£${c?.amountPaid ?? "-"} paidAt=${c?.paidAt ?? c?.paidDate ?? "-"} paymentRef=${c?.paymentRef ?? "-"}; second card booking paid → ${rPaid.status}, parent cancel → ${canc.status} cancel.amount=£${canc.json?.cancel?.amount} refund=${canc.json?.cancel?.refund}, $A refund-approve → ${rApp.status} ${rApp.status !== 200 ? err(rApp) : ""}: parent row pay=${rf?.pay} status=${rf?.status} refundLog=${JSON.stringify(refundEntries).slice(0, 160)} (amounts ${refundNeg.join(",") || "none"}); TFC booking (voucherScheme tfc) → ${tfc.status} pay=${t?.pay} voucherScheme=${t?.voucherScheme} sendBy=${t?.voucherSendBy ?? "-"}; operator GET /api/payments rows for these refs: ${payRows.length}`, notes: `${refundEntries.length === 0 && rApp.status === 200 ? "Fix needed: an APPROVED whole-booking refund never appears on the parent's Payments page — refund-approve writes cancel.refundedAt/refundedApproved/walletRefunded (bookings.ts:684-689) but no refundLog entry, and PaymentsApp.tsx:145 builds its Refunds list (and refundTotal, paidTotal) from refundLog only; only per-day releases (my.ts:2120) show. " : ""}Receipts are generated client-side from the booking row (features/parent/paymentReceipt.ts, jsPDF) for every pay=Paid/Funded row — there is no per-payment receipt URL from Stripe on the booking. Refunds show from booking.refundLog (PaymentsApp.tsx:145) as POSITIVE amounts under a "Refunds" heading, not negative rows. Mail/Stripe are not live so the card path here is "mark paid", not a Stripe charge; the refund-approve moved £${rApp.json?.cancel?.amount ?? "?"} to ${rApp.json?.cancel?.refundTo ?? "?"}.` };
  });

  // ── p2-c17: account name edges ─────────────────────────────────────────
  await step("p2-c17", async () => {
    const long = "L".repeat(300);
    const r300 = await api(P, "PUT", "/api/account", { name: long });
    const stored300 = (await db.collection("users").doc(P.uid).get()).get("name");
    const emoji = "Cust 🎉 Parent 👨‍👩‍👧";
    const rEmoji = await api(P, "PUT", "/api/account", { name: emoji });
    const rtl = "والدة الاختبار";
    const rRtl = await api(P, "PUT", "/api/account", { name: rtl });
    const acct = await api(P, "GET", "/api/account");
    const fams = await api(OA, "GET", "/api/customers"); const fam = ((fams.json ?? []) as any[]).find((c) => (c.email ?? "").toLowerCase() === P.email.toLowerCase());
    const bkRow = ((await api(OA, "GET", "/api/bookings")).json ?? []).find((b: any) => b.ref === R1);
    await api(P, "PUT", "/api/account", { name: "Cust Parent" });
    const ok = r300.status === 400 && rEmoji.status === 200 && rEmoji.json?.name === emoji && rRtl.status === 200 && acct.json?.name === rtl;
    results["p2-c17"] = { verdict: ok ? "pass" : "fail", actual: `PUT name ×300 chars → ${r300.status} ${r300.status === 400 ? "(zod max 120 — refused, not trimmed)" : `stored length ${String(stored300 ?? "").length}`}; emoji name → ${rEmoji.status} stored="${rEmoji.json?.name}"; RTL name → ${rRtl.status}; GET /api/account name="${acct.json?.name}"; Families as $A: row name="${fam?.name}" (customer record) — booking R1 booker="${bkRow?.booker}"`, notes: `A 300-char name is refused with a 400 validation error (account.ts:15 z.string().max(120)), not trimmed to the limit as the plan expects — decision (trim vs refuse); the UI's field should cap at 120. Families and bookings keep the name the family had when they BOOKED (booker from the token at checkout, customerUpsert) — renaming the account does not rename the customer record or past bookings, so an emoji/RTL account name only reaches Families on the next booking. Emails escape names (notify.ts escapeHtml; emailSend.ts escMerge).` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day9.json", JSON.stringify({ results, world }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
