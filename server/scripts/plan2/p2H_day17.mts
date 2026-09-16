// Plan-2 Day 17 — three features built the night of 15/16 Sept with zero
// prior test coverage, plus a fresh untested-surface sweep (cross-tenant
// isolation / multi-role permission edges / basic attack-surface checks).
// No browser: every step here is an API call through the harness or a
// source-code grep/read.
//
//   cd server && npx tsx scripts/plan2/p2H_day17.mts
import fs from "node:fs";
import {
  api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop,
  ymd, daysFromNow, type Actor,
} from "./p2H_harness.mts";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const origErr = console.error;
console.error = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(`ERR:${s}`); origErr(...a); };
const step = async (id: string, fn: () => Promise<void>) => {
  try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); }
  origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`);
};
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 200);

const base = await start();

try {
  // ── World ────────────────────────────────────────────────────────────────
  const A = await mkTenant("freelancer", "P2H17 Freelancer A");
  const B = await mkTenant("freelancer", "P2H17 Freelancer B");
  const C = await mkTenant("company", "P2H17 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H17 F1");
  const P = await mkParent("P2H17 Parent");
  await setSettings(A.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(C.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });

  async function venueListingAndBlock(actor: Actor, title: string, startOffset = 20, venueId = "v1") {
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

  // ══════════════════════ Feature 1 — trip whoCanSend ═══════════════════════

  await step("p2-d17-t1", async () => {
    // Default (no setting written): whoCanSend defaults to "all" — plain
    // staff, not organiser, not lead, can send.
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "T1 Plain Staff", staffRole: "Coach" });
    const l = await venueListingAndBlock(A.owner, "P2H17 T1 Trip Camp", 30);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "T1 Trip", listingId: l.listingId, date: l.days[0], destination: "Zoo", parentMsg: "See you at {destination}" });
    const send = await api(S1, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am at {destination}" });
    const ok = send.status === 200;
    results["p2-d17-t1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `whoCanSend unset (defaults "all"); plain staff (not organiser, not lead) POST send-message → ${send.status} ${send.status !== 200 ? err(send) : JSON.stringify(send.json).slice(0, 150)}` };
  });

  let t2TripId = "";
  await step("p2-d17-t2", async () => {
    // whoCanSend: "lead" — the SAME kind of plain staff member is now refused.
    await setSettings(A.tenantId, null, { trips: { whoCanSend: "lead" } });
    const S2 = await mkStaff(A.tenantId, { franchiseId: null, name: "T2 Plain Staff", staffRole: "Coach" });
    const l = await venueListingAndBlock(A.owner, "P2H17 T2 Trip Camp", 31);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "T2 Trip", listingId: l.listingId, date: l.days[0], destination: "Museum", parentMsg: "See you at {destination}" });
    t2TripId = trip.json.id;
    const send = await api(S2, "POST", `/api/trips/${t2TripId}/send-message`, { message: "Meet at 9am" });
    const ok = send.status === 403 && /trip lead|organiser/i.test(err(send));
    results["p2-d17-t2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `whoCanSend:"lead"; plain staff (not organiser, not named lead) POST send-message → ${send.status} ${err(send)}` };
  });

  await step("p2-d17-t3", async () => {
    // Same "lead" setting, still active from t2 — the trip's OWN organiser
    // (createdBy) is exempt even though they're plain staff.
    const S3 = await mkStaff(A.tenantId, { franchiseId: null, name: "T3 Organiser Staff", staffRole: "Coach" });
    const l = await venueListingAndBlock(A.owner, "P2H17 T3 Trip Camp", 32);
    const trip = await api(S3, "POST", "/api/trips", { title: "T3 Trip", listingId: l.listingId, date: l.days[0], destination: "Farm", parentMsg: "See you at {destination}" });
    const createOk = trip.status === 201 && trip.json.createdBy === S3.email;
    const send = await api(S3, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" });
    const ok = createOk && send.status === 200;
    results["p2-d17-t3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `whoCanSend:"lead"; the trip's own organiser (createdBy=${trip.json.createdBy}, matches actor: ${createOk}) POST send-message → ${send.status} ${send.status !== 200 ? err(send) : "sent"}` };
  });

  await step("p2-d17-t4", async () => {
    // Still "lead" — a staff member named as the trip's lead (trip.staff /
    // "lead" field set to their name) is also exempt, even if they didn't
    // create the trip.
    const S4 = await mkStaff(A.tenantId, { franchiseId: null, name: "T4 Named Lead", staffRole: "Coach" });
    const l = await venueListingAndBlock(A.owner, "P2H17 T4 Trip Camp", 33);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "T4 Trip", listingId: l.listingId, date: l.days[0], destination: "Beach", parentMsg: "See you at {destination}" });
    // Trip's lead field is set via PUT (the schema's tripSchema doesn't list a
    // top-level `lead` field in POST's own literal keys we've grepped — write
    // it directly the same way trips.ts reads it: `trip.lead`).
    await db.collection("trips").doc(trip.json.id).set({ lead: "T4 Named Lead" }, { merge: true });
    const send = await api(S4, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" });
    const ok = send.status === 200;
    results["p2-d17-t4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `whoCanSend:"lead"; staff named as trip.lead (not organiser) POST send-message → ${send.status} ${send.status !== 200 ? err(send) : "sent"}`, notes: send.status !== 200 ? "trip.lead matching is a direct doc write in this test (no dedicated 'set lead' UI field found on tripSchema) — worth QA confirming there IS a real way to name a trip lead from the product, otherwise this carve-out is unreachable in practice." : undefined };
    await setSettings(A.tenantId, null, { trips: { whoCanSend: "all" } }); // reset for tidiness
  });

  await step("p2-d17-t5", async () => {
    // Owner/manager (canManage) can always send regardless of the setting.
    await setSettings(A.tenantId, null, { trips: { whoCanSend: "lead" } });
    const l = await venueListingAndBlock(A.owner, "P2H17 T5 Trip Camp", 34);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "T5 Trip", listingId: l.listingId, date: l.days[0], destination: "Park", parentMsg: "See you at {destination}" });
    const send = await api(A.owner, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" });
    const ok = send.status === 200;
    results["p2-d17-t5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `whoCanSend:"lead"; the tenant OWNER (canManage) POST send-message → ${send.status} ${send.status !== 200 ? err(send) : "sent"}` };
    await setSettings(A.tenantId, null, { trips: { whoCanSend: "all" } });
  });

  await step("p2-d17-t6", async () => {
    // SetupApp.tsx really exposes the toggle.
    const src = fs.readFileSync(new URL("../../../features/setup/SetupApp.tsx", import.meta.url), "utf8");
    const hasSelect = /trips\?\.whoCanSend/.test(src) && /"lead"/.test(src);
    results["p2-d17-t6"] = { verdict: hasSelect ? "pass" : "fail", method: "code", actual: `features/setup/SetupApp.tsx references settings.trips?.whoCanSend and offers a "lead" option: ${hasSelect}` };
  });

  // ══════════════════════ Feature 2 — rota leave / needs-cover ══════════════

  await step("p2-d17-r1", async () => {
    // Company (no franchise) tenant: a rostered staff member with approved
    // leave that day should come back flagged staffOnLeave/needsCover; a
    // shift OUTSIDE the leave range must NOT be flagged.
    const key = C.tenantId;
    await db.collection("rotas").doc(key).set({ tenantId: C.tenantId, staff: [{ id: "sam", name: "R1 Sam" }], sites: ["v1"], updatedAt: new Date().toISOString() });
    const onId = "d17r1-on", offId = "d17r1-off";
    const onDate = ymd(daysFromNow(45));
    const offDate = ymd(daysFromNow(50)); // well outside the 1-day leave below
    await db.collection("rotaShifts").doc(`${key}_${onId}`).set({ id: onId, rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "sam", site: "v1", role: "Coach", date: onDate, start: "09:00", end: "15:00" });
    await db.collection("rotaShifts").doc(`${key}_${offId}`).set({ id: offId, rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "sam", site: "v1", role: "Coach", date: offDate, start: "09:00", end: "15:00" });
    const leave = await api(C.owner, "POST", "/api/leave/absences", { name: "R1 Sam", kind: "annual", start: onDate, end: onDate, days: 1, status: "approved" });
    const rota = await api(C.owner, "GET", "/api/rota");
    const shifts = (rota.json?.shifts ?? []) as { id: string; staffOnLeave?: boolean; needsCover?: boolean }[];
    const onShift = shifts.find((s) => s.id === onId);
    const offShift = shifts.find((s) => s.id === offId);
    const ok = leave.status === 201 && onShift?.staffOnLeave === true && onShift?.needsCover === true && !offShift?.staffOnLeave && !offShift?.needsCover;
    results["p2-d17-r1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `approve leave for Sam on ${onDate} → ${leave.status}; GET /api/rota: shift ON leave date → ${JSON.stringify(onShift)}; shift OUTSIDE leave range (${offDate}) → ${JSON.stringify(offShift)}` };
  });

  await step("p2-d17-r2", async () => {
    // ScheduleApp.tsx / MyScheduleApp.tsx actually render the flag, not just
    // silently ignore it.
    const sched = fs.readFileSync(new URL("../../../features/schedule/ScheduleApp.tsx", import.meta.url), "utf8");
    const my = fs.readFileSync(new URL("../../../features/schedule/MyScheduleApp.tsx", import.meta.url), "utf8");
    const schedHit = /needsCover|staffOnLeave/.test(sched);
    const myHit = /needsCover|staffOnLeave/.test(my);
    const ok = schedHit && myHit;
    results["p2-d17-r2"] = { verdict: ok ? "pass" : "fail", method: "code", actual: `ScheduleApp.tsx reads needsCover/staffOnLeave: ${schedHit}; MyScheduleApp.tsx reads needsCover/staffOnLeave: ${myHit}` };
  });

  await step("p2-d17-r3", async () => {
    // Pending (not yet approved) leave must NOT flag the shift — only
    // approved leave should.
    const key = C.tenantId;
    const pendId = "d17r3-pending";
    const pendDate = ymd(daysFromNow(46));
    await db.collection("rotaShifts").doc(`${key}_${pendId}`).set({ id: pendId, rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "sam", site: "v1", role: "Coach", date: pendDate, start: "09:00", end: "15:00" });
    const staffActor = await mkStaff(C.tenantId, { franchiseId: null, name: "R1 Sam" });
    const leave = await api(staffActor, "POST", "/api/leave/absences", { kind: "annual", start: pendDate, end: pendDate, days: 1 }); // no status → defaults to pending for a self-request
    const rota = await api(C.owner, "GET", "/api/rota");
    const shifts = (rota.json?.shifts ?? []) as { id: string; staffOnLeave?: boolean; needsCover?: boolean }[];
    const shift = shifts.find((s) => s.id === pendId);
    const ok = leave.status === 201 && leave.json?.status === "pending" && !shift?.staffOnLeave && !shift?.needsCover;
    results["p2-d17-r3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `self-requested (pending) leave for Sam on ${pendDate} → ${leave.status} status=${leave.json?.status}; GET /api/rota shift row → ${JSON.stringify(shift)} (expect NOT flagged — only approved leave should flag)` };
  });

  // ══════════════════════ Feature 3 — provider welcome email ════════════════

  async function signupFresh(role: "company" | "freelancer", businessName: string, firstName: string) {
    const uid = `d17-signup-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${uid}@p2h.test`;
    const actor: Actor = { uid, email, name: `${firstName} Test` };
    const before = mailLog.length;
    const r = await api(actor, "POST", "/api/register-role", { role, businessName, contactEmail: email });
    await new Promise((res2) => setTimeout(res2, 1200)); // let the fire-and-forget emailProviderWelcome/sendMail settle
    const newLines = mailLog.slice(before);
    return { r, actor, newLines };
  }

  await step("p2-d17-e1", async () => {
    const { r, actor, newLines } = await signupFresh("company", "P2H17 Fresh Co", "Robin");
    const welcomeLine = newLines.find((l) => l.includes("Welcome to ActivityOS"));
    const rightRecipient = !!welcomeLine && welcomeLine.includes(actor.email);
    const rightSubject = !!welcomeLine && welcomeLine.includes("Welcome to ActivityOS — let's get you set up");
    const ok = r.status === 201 && !!welcomeLine && rightRecipient && rightSubject;
    results["p2-d17-e1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/register-role {role:'company'} → ${r.status} tenantId=${r.json?.tenantId}; [mail] line seen: ${welcomeLine ?? "NONE"}; recipient matches signup email (${actor.email}): ${rightRecipient}; subject matches "Welcome to ActivityOS — let's get you set up": ${rightSubject}`, notes: "MAIL_LIVE is off so the send is SUPPRESSED, but the attempt (and its subject/recipient) is what's being confirmed here, same evidence pattern as p2-hv9." };
    if (r.json?.tenantId) await db.collection("tenants").doc(r.json.tenantId).update({ _p2h: "d17cleanup" });
  });

  await step("p2-d17-e2", async () => {
    const { r, actor, newLines } = await signupFresh("freelancer", "P2H17 Fresh Freelancer", "Jamie");
    const welcomeLine = newLines.find((l) => l.includes("Welcome to ActivityOS"));
    const rightRecipient = !!welcomeLine && welcomeLine.includes(actor.email);
    const ok = r.status === 201 && !!welcomeLine && rightRecipient;
    results["p2-d17-e2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/register-role {role:'freelancer'} → ${r.status} tenantId=${r.json?.tenantId}; [mail] line seen: ${welcomeLine ?? "NONE"}; recipient matches (${actor.email}): ${rightRecipient}`, notes: "MAIL_LIVE off → SUPPRESSED, attempt confirmed via the [mail] log line." };
    if (r.json?.tenantId) await db.collection("tenants").doc(r.json.tenantId).update({ _p2h: "d17cleanup" });
  });

  await step("p2-d17-e3", async () => {
    // A SECOND register-role call on an already-chosen account must be
    // refused (409) and must NOT fire a second welcome email.
    const { actor } = await signupFresh("company", "P2H17 Double Signup Co", "Alex");
    const before = mailLog.length;
    const again = await api(actor, "POST", "/api/register-role", { role: "company", businessName: "P2H17 Double Signup Co Take2" });
    await new Promise((res2) => setTimeout(res2, 300));
    const secondWelcome = mailLog.slice(before).some((l) => l.includes("Welcome to ActivityOS"));
    const ok = again.status === 409 && !secondWelcome;
    results["p2-d17-e3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `re-POST /api/register-role on an already-chosen account → ${again.status} ${err(again)}; a second welcome email attempt fired: ${secondWelcome}` };
  });

  await step("p2-d17-e4", async () => {
    // firstName greeting: emails.ts falls back to the business/provider name
    // when firstName is empty. Confirm both source paths exist.
    const src = fs.readFileSync(new URL("../../src/lib/emails.ts", import.meta.url), "utf8");
    const greetingFallback = src.includes("p.firstName?.trim() || p.providerName");
    const registerRoleSrc = fs.readFileSync(new URL("../../src/routes/registerRole.ts", import.meta.url), "utf8");
    const firstNameFromName = registerRoleSrc.includes('user.name?.split(" ")[0]');
    const ungated = /Ungated by Setup.*Email|ungated by the.*Setup.*Email/is.test(src) || src.includes("ungated by Setup");
    results["p2-d17-e4"] = { verdict: greetingFallback && firstNameFromName ? "pass" : "fail", method: "code", actual: `emails.ts greeting falls back to providerName when firstName is blank: ${greetingFallback}; registerRole.ts derives firstName from user.name.split(' ')[0]: ${firstNameFromName}; comment confirms the welcome mail is NOT gated by Setup → Email automatic-email toggles: ${ungated}` };
  });

  // ══════════════════ Part B — untested-surface sweep ════════════════════

  await step("p2-d17-b1", async () => {
    // Client-supplied tenantId in the body must never override the auth
    // tenant on a write — a classic IDOR/tenant-escalation shape.
    const inc = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childName: "B1 Kid", description: "test", concernCategory: "other", date: ymd(new Date()), tenantId: B.tenantId });
    const stored = inc.status === 201 ? await db.collection("incidents").doc(inc.json.id).get() : null;
    const storedTenantId = stored?.get("tenantId");
    const ok = inc.status === 201 && storedTenantId === A.tenantId && storedTenantId !== B.tenantId;
    results["p2-d17-b1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/incidents as A's owner with body.tenantId forged to B's tenant id → ${inc.status}; stored doc's real tenantId = ${storedTenantId} (A=${A.tenantId}, forged B=${B.tenantId})` };
  });

  await step("p2-d17-b2", async () => {
    // Cross-tenant IDOR: PUT a customer record that belongs to a DIFFERENT
    // tenant entirely (not franchise-vs-franchise — a wholly separate one).
    const cust = await api(B.owner, "POST", "/api/customers", { name: "B2 Customer", email: "b2cust@p2h.test" });
    const steal = await api(A.owner, "PUT", `/api/customers/${cust.json.id}`, { name: "STOLEN BY A" });
    const check = await db.collection("customers").doc(cust.json.id).get();
    const ok = cust.status === 201 && steal.status === 404 && check.get("name") === "B2 Customer";
    results["p2-d17-b2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `B creates a customer (${cust.status}); A's owner PUT /api/customers/${cust.json.id} (a DIFFERENT tenant's record) → ${steal.status} ${err(steal)}; record's name after the attempt: "${check.get("name")}"` };
  });

  await step("p2-d17-b3", async () => {
    // Cross-tenant IDOR on tasks (PUT and DELETE).
    const task = await api(B.owner, "POST", "/api/tasks", { t: "B3 Task", who: "someone" });
    if (task.status !== 201) throw new Error(`task create ${task.status} ${err(task)}`);
    const putSteal = await api(A.owner, "PUT", `/api/tasks/${task.json.id}`, { t: "STOLEN" });
    const delSteal = await api(A.owner, "DELETE", `/api/tasks/${task.json.id}`);
    const check = await db.collection("tasks").doc(task.json.id).get();
    const ok = putSteal.status === 404 && delSteal.status === 404 && check.exists && check.get("t") === "B3 Task";
    results["p2-d17-b3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `B creates a task (${task.status}); A's owner PUT another tenant's task → ${putSteal.status}; DELETE it → ${delSteal.status}; task still exists with original title "B3 Task": ${check.exists && check.get("t") === "B3 Task"}` };
  });

  await step("p2-d17-b4", async () => {
    // Multi-role edge: a franchise token hitting a company/HQ-only route.
    const feats = await api(F1.actor, "GET", "/api/franchises/features");
    const list = await api(F1.actor, "GET", "/api/franchises");
    const ok = feats.status === 403 && list.status === 403;
    results["p2-d17-b4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `franchise token GET /api/franchises/features → ${feats.status} ${err(feats)}; GET /api/franchises (the whole franchise list) → ${list.status} ${err(list)}` };
  });

  await step("p2-d17-b5", async () => {
    // Multi-role edge: a parent token hitting the operator-only bookings list
    // (not /api/my/bookings).
    const list = await api(P, "GET", "/api/bookings");
    const ok = list.status === 403;
    results["p2-d17-b5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `parent token GET /api/bookings (operator route, not /api/my/bookings) → ${list.status} ${err(list)}` };
  });

  await step("p2-d17-b6", async () => {
    // Malformed JSON body: raw invalid JSON with a correct Content-Type header
    // must 400, not 500.
    const r = await fetch(`${base}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-uid": A.owner.uid, "x-test-email": A.owner.email },
      body: "{ this is not valid json ",
    });
    const ok = r.status === 400;
    let bodyText = "";
    try { bodyText = (await r.text()).slice(0, 150); } catch { /* ignore */ }
    results["p2-d17-b6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/bookings with syntactically-broken JSON body ("{ this is not valid json ") → ${r.status} ${bodyText}` };
  });

  await step("p2-d17-b7", async () => {
    // Oversized input at the zod-declared boundary: incidents.description is
    // capped at max(4_000). 4,000 chars must succeed; 4,001 must be refused
    // cleanly (400), not silently truncated and not a 500.
    const at = "A".repeat(4_000);
    const over = "A".repeat(4_001);
    const okReq = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childName: "B7 Kid OK", description: at, concernCategory: "other", date: ymd(new Date()) });
    const overReq = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childName: "B7 Kid Over", description: over, concernCategory: "other", date: ymd(new Date()) });
    const massiveReq = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childName: "B7 Kid Huge", description: "A".repeat(200_000), concernCategory: "other", date: ymd(new Date()) });
    const ok = okReq.status === 201 && overReq.status === 400 && massiveReq.status === 400;
    results["p2-d17-b7"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/incidents description at exactly 4,000 chars (the schema's max) → ${okReq.status}; at 4,001 chars → ${overReq.status} ${overReq.status !== 400 ? err(overReq) : "(refused cleanly)"}; at 200,000 chars → ${massiveReq.status} ${massiveReq.status !== 400 ? err(massiveReq) : "(refused cleanly)"}` };
  });

  await step("p2-d17-b8", async () => {
    // Type-confusion / NoSQL-injection-shaped field: an object instead of a
    // string for a required string field must be rejected by zod, not stored
    // as a weird nested object or crash the handler.
    const inc = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childName: { $ne: null } as unknown as string, description: "test", concernCategory: "other", date: ymd(new Date()) });
    const ok = inc.status === 400;
    results["p2-d17-b8"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST /api/incidents with childName sent as an object ({"$ne":null}) instead of a string → ${inc.status} ${err(inc)}` };
  });

  await step("p2-d17-b9", async () => {
    // Self-escalation via the shared PUT /api/account/ profile route: extra
    // fields like role/tenantId/permRole aren't in putSchema, so zod's
    // default (strip unknown keys) should drop them silently rather than
    // writing them.
    const before = await db.collection("users").doc(A.owner.uid).get();
    const beforeRole = before.get("role");
    const put = await api(A.owner, "PUT", "/api/account", { name: "B9 Name", role: "platform", tenantId: "someone-elses-tenant", permRole: "full-access" } as Record<string, unknown>);
    const after = await db.collection("users").doc(A.owner.uid).get();
    const ok = put.status === 200 && after.get("role") === beforeRole && !("permRole" in after.data()!) === !("permRole" in before.data()!);
    results["p2-d17-b9"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `PUT /api/account with extra fields role:"platform", tenantId:"someone-elses-tenant", permRole:"full-access" (none are in putSchema) → ${put.status}; users doc role before/after: ${beforeRole}/${after.get("role")}; permRole present in doc after: ${"permRole" in (after.data() ?? {})}` };
  });

  await step("p2-d17-b10", async () => {
    // Pagination/limit abuse on a list route: negative and absurdly large
    // limit query params shouldn't 500 or return something nonsensical.
    const neg = await api(A.owner, "GET", "/api/bookings?limit=-1");
    const huge2 = await api(A.owner, "GET", "/api/bookings?limit=999999999");
    const ok = neg.status !== 500 && huge2.status !== 500;
    results["p2-d17-b10"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `GET /api/bookings?limit=-1 → ${neg.status} (${Array.isArray(neg.json) ? neg.json.length + " rows" : JSON.stringify(neg.json).slice(0, 80)}); GET /api/bookings?limit=999999999 → ${huge2.status} (${Array.isArray(huge2.json) ? huge2.json.length + " rows" : JSON.stringify(huge2.json).slice(0, 80)})`, notes: "bookings.ts list route doesn't appear to read a `limit` query param at all (grep found none) — both calls just return the tenant's normal full list, ignoring the param entirely rather than erroring or crashing." };
  });

  await step("p2-d17-b11", async () => {
    // Franchise token attempting to alter another franchise's territory
    // (head-office-only route) under the SAME company — franchise-vs-
    // franchise, not franchise-vs-outside-tenant.
    const F2 = await mkFranchise(C.tenantId, "P2H17 F2");
    const terr = await api(F1.actor, "PUT", `/api/franchises/${F2.franchiseId}/territory`, { areas: [] });
    const ok = terr.status === 403;
    results["p2-d17-b11"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1's token PUT /api/franchises/<F2's id>/territory (head-office-only route, F1 is not head office) → ${terr.status} ${err(terr)}` };
  });

  await step("p2-d17-b12", async () => {
    // A staff token (not an operator) attempting to read the franchise list —
    // covers the staff role specifically, distinct from b4's franchise-role check.
    const S = await mkStaff(A.tenantId, { franchiseId: null, name: "B12 Staff" });
    const list = await api(S, "GET", "/api/franchises");
    const ok = list.status === 403;
    results["p2-d17-b12"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `plain staff token GET /api/franchises → ${list.status} ${err(list)}` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day17.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
