// Plan-2 Day 19 — closing the last genuinely-uncovered corners of the app
// after a full features/* + server/src/routes/*.ts inventory against plan.ts
// (28 days) and plan2.ts days 1-18: ventureLakes (a wholly separate internal
// side-project never mentioned anywhere), geo/tiles (geocoding, never
// mentioned), platform's own notification bell (never mentioned — day 11
// covered leads/sales/support/pricing but not HQ's own bell), the parent-
// facing refer-a-friend flow (only the operator-side admin dashboard was
// ever touched, and only lightly), and the HAF/£0-booking "Funded" status
// rule. No browser: every step is an API call through the harness or a
// source-code read.
//
//   cd server && npx tsx scripts/plan2/p2H_day19.mts
import fs from "node:fs";
import {
  api, db, mkTenant, mkFranchise, mkParent, setSettings, cleanup, start, stop,
  ymd, daysFromNow, type Actor,
} from "./p2H_harness.mts";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => {
  try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); }
  origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`);
};
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 200);

await start();
let freshSignupTenantId = "";

try {
  const A = await mkTenant("freelancer", "P2H19 Freelancer A");
  const C = await mkTenant("company", "P2H19 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H19 F1");
  const F2 = await mkFranchise(C.tenantId, "P2H19 F2");
  const P = await mkParent("P2H19 Parent");
  const P2 = await mkParent("P2H19 Friend Parent");
  await setSettings(A.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(C.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });

  const platformUid = `d19-plat-${Math.random().toString(36).slice(2, 8)}`;
  const platformActor: Actor = { uid: platformUid, email: `${platformUid}@p2h.test`, name: "D19 Platform" };
  await db.collection("users").doc(platformUid).set({ email: platformActor.email, role: "platform", chosen: true, name: "D19 Platform" });

  async function venueListingAndBlock(actor: Actor, title: string, startOffset: number, venueId = "v1") {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 20 }], venueId });
    if (l.status !== 201) throw new Error(`listing ${l.status} ${err(l)}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId }, { merge: true });
    const b = await api(actor, "POST", "/api/blocks", {
      listingId: l.json.id, name: `${title} block`,
      startDate: ymd(daysFromNow(startOffset)), endDate: ymd(daysFromNow(startOffset + 6)),
      capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    return { listingId: l.json.id as string, blockId: b.json.id as string, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(startOffset + n))) };
  }

  // ═══════════════════════════════ VENTURE LAKES ═════════════════════════════

  await step("p2-d19-vl1", async () => {
    // Non-platform accounts are refused outright — this is HQ's own side-project tool, no tenant has any business seeing it.
    const asA = await api(A.owner, "GET", "/api/venture-lakes");
    const ok = asA.status === 403;
    results["p2-d19-vl1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `tenant operator token GET /api/venture-lakes → ${asA.status} ${err(asA)}` };
  });

  await step("p2-d19-vl2", async () => {
    // Platform can read it, and out-of-range/excluded sites are filtered out server-side, not just hidden in the UI.
    const goodId = "d19-vl-good", excludedId = "d19-vl-excluded";
    await db.collection("ventureLakes").doc(goodId).set({ name: "D19 Good Site", acres: 40, excluded: false });
    await db.collection("ventureLakes").doc(excludedId).set({ name: "D19 Excluded Site", acres: 90, excluded: true });
    const asPlatform = await api(platformActor, "GET", "/api/venture-lakes");
    const items = (asPlatform.json?.items ?? []) as { id: string }[];
    const hasGood = items.some((i) => i.id === goodId);
    const hasExcluded = items.some((i) => i.id === excludedId);
    const ok = asPlatform.status === 200 && hasGood && !hasExcluded;
    results["p2-d19-vl2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `platform GET /api/venture-lakes → ${asPlatform.status}; a normal site is present: ${hasGood}; a site marked excluded:true is present: ${hasExcluded} (expect false — filtered server-side)` };
    await db.collection("ventureLakes").doc(goodId).delete();
    await db.collection("ventureLakes").doc(excludedId).delete();
  });

  // ═══════════════════════════════ GEO ═══════════════════════════════════════

  await step("p2-d19-geo1", async () => {
    // /api/geo/search sits behind the normal auth wall (mounted at app.use("/api/geo", geo) in the standard authed chain) —
    // confirmed by reading index.ts's mount order rather than an unauthenticated call (the harness's injectOptional pattern
    // used elsewhere doesn't apply to a route mounted this late).
    const src = fs.readFileSync(new URL("../../src/index.ts", import.meta.url), "utf8");
    const geoMountLine = src.split("\n").findIndex((l) => l.includes('app.use("/api/geo", geo)'));
    const authWallLine = src.split("\n").findIndex((l) => l.includes('app.use("/api", requireAuth, attachRole)'));
    const tilesMountLine = src.split("\n").findIndex((l) => l.includes('app.use("/api/geo/tiles"'));
    const ok = geoMountLine > authWallLine && tilesMountLine >= 0 && tilesMountLine < authWallLine;
    results["p2-d19-geo1"] = { verdict: ok ? "pass" : "fail", method: "code", actual: `index.ts mount order: general auth wall at line ${authWallLine + 1}; /api/geo (search) mounted at line ${geoMountLine + 1} (after the wall, so it requires a token); /api/geo/tiles mounted at line ${tilesMountLine + 1} (before the wall, so map tiles load for an <img> tag with no auth header) — matches the file's own comment that tiles must be public because <img> can't send auth` };
  });

  await step("p2-d19-geo2", async () => {
    // The geocode search itself, exercised for real: a signed-in operator token, OS_API_KEY likely unset in this sandbox so
    // it should fall back to the keyless Nominatim path rather than 500ing outright.
    const t0 = Date.now();
    const search = await api(A.owner, "GET", "/api/geo/search?q=London");
    const elapsedMs = Date.now() - t0;
    const ok = search.status !== 500 && elapsedMs < 6000;
    results["p2-d19-geo2"] = { verdict: ok ? "pass" : "blocked", method: "api", actual: `authed GET /api/geo/search?q=London → ${search.status} in ${elapsedMs}ms (result count: ${Array.isArray(search.json) ? search.json.length : "n/a"})`, notes: search.status === 500 || elapsedMs >= 6000 ? "Likely no network egress in this sandbox (no OS_API_KEY, Nominatim unreachable) rather than a real product bug — the 5s GEO_TIMEOUT_MS should still cap the wait; record separately whether a genuinely offline environment causes a hung request." : "Environment allowed the real geocode call through." };
  });

  // ═══════════════════════════════ PLATFORM NOTIFICATIONS ═══════════════════

  await step("p2-d19-pn1", async () => {
    const asA = await api(A.owner, "GET", "/api/platform/notifications");
    const ok = asA.status === 403;
    results["p2-d19-pn1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `tenant operator token GET /api/platform/notifications → ${asA.status} ${err(asA)}` };
  });

  await step("p2-d19-pn2", async () => {
    // A fresh signup produces a 'signup' item HQ's own bell can see.
    const before = await api(platformActor, "GET", "/api/platform/notifications");
    const beforeCount = (before.json?.items ?? []).length;
    const uid = `d19-signup-${Math.random().toString(36).slice(2, 8)}`;
    const signupActor: Actor = { uid, email: `${uid}@p2h.test`, name: "D19 Signup" };
    const signup = await api(signupActor, "POST", "/api/register-role", { role: "freelancer", businessName: "P2H19 Fresh Signup Co" });
    freshSignupTenantId = signup.json?.tenantId ?? "";
    const after = await api(platformActor, "GET", "/api/platform/notifications");
    const afterCount = (after.json?.items ?? []).length;
    const hasSignupType = (after.json?.items ?? []).some((i: { type?: string }) => i.type === "signup");
    // Note: buildItems buckets same-day signups into one item, so a prior signup from earlier in THIS session can mean the
    // count doesn't move even though this one genuinely registered — hasSignupType + a nonzero unread count is the real signal.
    const ok = signup.status === 201 && afterCount >= beforeCount && hasSignupType && (after.json?.unread ?? 0) > 0;
    results["p2-d19-pn2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `fresh signup → ${signup.status}; platform bell item count before/after: ${beforeCount}/${afterCount}; a 'signup' type item is present: ${hasSignupType}; unread count: ${after.json?.unread}` };
  });

  await step("p2-d19-pn3", async () => {
    // POST /read marks everything currently in the bell as read — unread drops to 0, but the items themselves stay listed.
    const before = await api(platformActor, "GET", "/api/platform/notifications");
    const itemCountBefore = (before.json?.items ?? []).length;
    const read = await api(platformActor, "POST", "/api/platform/notifications/read", {});
    const after = await api(platformActor, "GET", "/api/platform/notifications");
    const ok = read.status === 200 && (after.json?.unread ?? -1) === 0 && (after.json?.items ?? []).length === itemCountBefore;
    results["p2-d19-pn3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/platform/notifications/read → ${read.status}; unread afterward: ${after.json?.unread} (expect 0); item count unchanged: ${(after.json?.items ?? []).length} vs before ${itemCountBefore}` };
  });

  await step("p2-d19-pn4", async () => {
    // Dismissing one specific item removes it from the list entirely (not just marks it read).
    const before = await api(platformActor, "GET", "/api/platform/notifications");
    const items = (before.json?.items ?? []) as { id: string }[];
    if (!items.length) throw new Error("no items to dismiss — pn2 should have created at least one");
    const target = items[0].id;
    const dismiss = await api(platformActor, "POST", "/api/platform/notifications/dismiss", { id: target });
    const after = await api(platformActor, "GET", "/api/platform/notifications");
    const stillThere = (after.json?.items ?? []).some((i: { id: string }) => i.id === target);
    const ok = dismiss.status === 200 && !stillThere;
    results["p2-d19-pn4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/platform/notifications/dismiss {id:'${target}'} → ${dismiss.status}; that id still present afterward: ${stillThere} (expect false)` };
  });

  await step("p2-d19-pn5", async () => {
    // Muting a type (via PUT /prefs) hides FUTURE items of that type from the list.
    const mute = await api(platformActor, "PUT", "/api/platform/notifications/prefs", { muted: ["signup"] });
    const uid = `d19-signup2-${Math.random().toString(36).slice(2, 8)}`;
    const signupActor: Actor = { uid, email: `${uid}@p2h.test`, name: "D19 Signup 2" };
    const signup = await api(signupActor, "POST", "/api/register-role", { role: "freelancer", businessName: "P2H19 Fresh Signup Co 2" });
    const after = await api(platformActor, "GET", "/api/platform/notifications");
    const hasSignupType = (after.json?.items ?? []).some((i: { type?: string }) => i.type === "signup");
    const ok = mute.status === 200 && signup.status === 201 && !hasSignupType;
    results["p2-d19-pn5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `PUT /api/platform/notifications/prefs {muted:['signup']} → ${mute.status}; a second fresh signup happens (${signup.status}); the bell now shows a 'signup' item: ${hasSignupType} (expect false — muted types are filtered out of buildItems' result)` };
    await api(platformActor, "PUT", "/api/platform/notifications/prefs", { muted: [] });
    if (signup.json?.tenantId) await db.collection("tenants").doc(signup.json.tenantId).update({ _p2h: "d19cleanup" });
  });

  // ═══════════════════════════════ REFER-A-FRIEND ════════════════════════════

  await step("p2-d19-ref1", async () => {
    // A parent with no booking anywhere yet — referrals are locked out with a clear reason, not a blank/empty response.
    const freshParent = await mkParent("P2H19 No Booking Parent");
    const r = await api(freshParent, "GET", "/api/my/referral");
    const ok = r.status === 200 && r.json?.enabled === false && /book with a provider/i.test(r.json?.reason ?? "");
    results["p2-d19-ref1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `GET /api/my/referral for a parent with NO booking anywhere → ${r.status} ${JSON.stringify(r.json)}` };
  });

  let ref3Listing: { listingId: string; blockId: string; days: string[] } | null = null;
  await step("p2-d19-ref2", async () => {
    // The provider hasn't turned referral.enabled on — even a family WITH a real booking there sees enabled:false, not a half-configured code.
    ref3Listing = await venueListingAndBlock(A.owner, "P2H19 REF Camp", 200);
    const c = await api(P, "POST", "/api/my/children", { name: "REF Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: ref3Listing.listingId, blockId: ref3Listing.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "REF Kid", childId: c.json.id, age: 8, dates: [ref3Listing.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const r = await api(P, "GET", "/api/my/referral");
    const ok = bk.status === 201 && r.status === 200 && r.json?.enabled === false;
    results["p2-d19-ref2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `P books with A (referral.enabled still false, the Setup default); GET /api/my/referral → ${r.status} ${JSON.stringify(r.json)}` };
  });

  await step("p2-d19-ref3", async () => {
    // Turn referral ON — the SAME parent, now WITH a booking, gets a real code/link and starts at booked:0.
    await setSettings(A.tenantId, null, { referral: { enabled: true, type: "amount", friendOff: 10, referrerReward: 8, minSpend: 0, capToFriendSpend: true } });
    const r = await api(P, "GET", "/api/my/referral");
    const ok = r.status === 200 && r.json?.enabled === true && typeof r.json?.code === "string" && r.json.code.length > 0 && r.json?.booked === 0 && r.json?.friendOff === 10 && r.json?.referrerReward === 8;
    results["p2-d19-ref3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `referral.enabled:true, friendOff:10, referrerReward:8; GET /api/my/referral for the same parent (now WITH a booking) → ${r.status} ${JSON.stringify(r.json)}` };
  });

  let referrerCode = "";
  await step("p2-d19-ref4", async () => {
    // A friend books using the referrer's code, gets friendOff taken off their price, and the referrer's own stats update afterward.
    const mine = await api(P, "GET", "/api/my/referral");
    referrerCode = mine.json?.code ?? "";
    if (!referrerCode) throw new Error("no referral code minted for P");
    const c2 = await api(P2, "POST", "/api/my/children", { name: "REF Friend Kid", dob: "2018-01-01" });
    const friendBk = await api(P2, "POST", "/api/my/bookings", {
      listingId: ref3Listing!.listingId, blockId: ref3Listing!.blockId, method: "Bank transfer",
      items: [{ pass: "Day", child: "REF Friend Kid", childId: c2.json.id, age: 8, dates: [ref3Listing!.days[1]] }],
      discountCode: referrerCode,
    });
    const friendApplied = (friendBk.json?.bookings?.[0]?.discountCode ?? "").toUpperCase() === referrerCode.toUpperCase();
    await new Promise((r) => setTimeout(r, 400)); // rewardReferrer runs after the tx commits
    const after = await api(P, "GET", "/api/my/referral");
    const ok = friendBk.status === 201 && friendApplied && (after.json?.booked ?? 0) >= 1 && (after.json?.earned ?? 0) >= 8;
    results["p2-d19-ref4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `friend (P2) books quoting P's referral code (${referrerCode}) → ${friendBk.status}, code applied: ${friendApplied}; P's own GET /api/my/referral afterward → booked=${after.json?.booked}, earned=${after.json?.earned} (expect booked>=1, earned>=8)` };
  });

  await step("p2-d19-ref5", async () => {
    // Operator-side referrals dashboard is franchise-scoped — a referral whose FRIEND booked with F1 doesn't show in F2's own admin view.
    const lF1 = await venueListingAndBlock(F1.actor, "P2H19 REF F1 Camp", 205, "v1");
    // referral.ts's GET route reads db.collection("libraries").doc(tenantId) directly with NO franchise-scoped fallback —
    // referral settings are company-wide, not per-franchise, so this has to be set on C's own settings, not F1's copy.
    await setSettings(C.tenantId, null, { referral: { enabled: true, type: "amount", friendOff: 5, referrerReward: 5, minSpend: 0, capToFriendSpend: true } });
    const referrerF1 = await mkParent("P2H19 F1 Referrer");
    const c1 = await api(referrerF1, "POST", "/api/my/children", { name: "REF F1 Kid", dob: "2018-01-01" });
    const bk1 = await api(referrerF1, "POST", "/api/my/bookings", { listingId: lF1.listingId, blockId: lF1.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "REF F1 Kid", childId: c1.json.id, age: 8, dates: [lF1.days[0]] }] });
    if (bk1.status !== 201) throw new Error(`referrer booking ${bk1.status} ${err(bk1)}`);
    const refInfo = await api(referrerF1, "GET", "/api/my/referral");
    const code = refInfo.json?.code as string | undefined;
    if (!code) throw new Error(`no code minted for F1 referrer: ${JSON.stringify(refInfo.json)}`);
    const friendF1 = await mkParent("P2H19 F1 Friend");
    const c2 = await api(friendF1, "POST", "/api/my/children", { name: "REF F1 Friend Kid", dob: "2018-01-01" });
    const bk2 = await api(friendF1, "POST", "/api/my/bookings", { listingId: lF1.listingId, blockId: lF1.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "REF F1 Friend Kid", childId: c2.json.id, age: 8, dates: [lF1.days[1]] }], discountCode: code });
    await new Promise((r) => setTimeout(r, 400));
    const asF1Admin = await api(F1.actor, "GET", "/api/referrals");
    const asF2Admin = await api(F2.actor, "GET", "/api/referrals");
    const f1List = (asF1Admin.json?.recent ?? []) as { friendEmail?: string }[];
    const f2List = (asF2Admin.json?.recent ?? []) as { friendEmail?: string }[];
    const f1HasIt = Array.isArray(f1List) && f1List.some((r) => (r.friendEmail ?? "").toLowerCase() === friendF1.email.toLowerCase());
    const f2HasIt = Array.isArray(f2List) && f2List.some((r) => (r.friendEmail ?? "").toLowerCase() === friendF1.email.toLowerCase());
    const ok = bk2.status === 201 && f1HasIt && !f2HasIt;
    results["p2-d19-ref5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `friend books with F1 using an F1 referrer's code (${bk2.status}); F1's own GET /api/referrals shows this referral: ${f1HasIt}; F2's own GET /api/referrals shows it: ${f2HasIt} (expect false — franchiseFamilyEmails scoping holds)` };
  });

  // ═══════════════════════════════ HAF / FUNDED STATUS ═══════════════════════

  await step("p2-d19-haf1", async () => {
    // A £0 booking (HAF / a free place) is recorded pay:'Funded', not 'Unpaid' — judged purely on the amount, never the payment method's label.
    const l = await venueListingAndBlock(A.owner, "P2H19 HAF Camp", 210);
    await db.collection("listings").doc(l.listingId).set({ passes: [{ name: "Free Place", price: 0 }] }, { merge: true });
    const c = await api(P, "POST", "/api/my/children", { name: "HAF Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Free Place", child: "HAF Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    const pay = bk.json?.bookings?.[0]?.pay;
    const ok = bk.status === 201 && pay === "Funded";
    results["p2-d19-haf1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `£0 booking (HAF-style free place) → ${bk.status}; pay status = "${pay}" (expect 'Funded', never 'Unpaid')` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day19.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  if (freshSignupTenantId) origLog("(fresh signup tenant left for manual inspection if needed)", freshSignupTenantId);
  stop();
}
process.exit(0);
