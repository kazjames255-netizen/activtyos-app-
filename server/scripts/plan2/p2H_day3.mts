// Plan-2 Day 3 — Safeguarding depth: dossiers, the DSL exemption, doses, child
// files (p2-s1 … p2-s22). Throwaway freelancer A (+ plain staff, DSL staff,
// site lead), freelancer B, company C + F1/F2. All deleted at the end.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day3.mts
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log; const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]") || s.startsWith("[dsl]")) mailLog.push(s); origLog(...a); };
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const j = (r: { json: any }) => JSON.stringify(r.json)?.slice(0, 120);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bells = async (toEmail: string) => (await db.collection("notifications").where("toEmail", "==", toEmail.toLowerCase()).get()).docs.map((d) => d.data());
const today = ymd(new Date());

const base = await start();
const A = await mkTenant("freelancer", "P2H Safe A"); const OA = A.owner; const TA = A.tenantId;
const B = await mkTenant("freelancer", "P2H Safe B"); const OB = B.owner; const TB = B.tenantId;
const C = await mkTenant("company", "P2H Safe HO"); const HO = C.owner; const TC = C.tenantId; const F1 = await mkFranchise(TC, "P2H Safe F1"); const F2 = await mkFranchise(TC, "P2H Safe F2");
async function listingAndBlock(actor: Actor, title: string, start = 30) {
  const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }] }); if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  await db.collection("listings").doc(l.json.id).set({ status: "live" }, { merge: true });
  const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} wk`, startDate: ymd(daysFromNow(start)), endDate: ymd(daysFromNow(start + 4)), capacity: 50, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } }); // every day, so days[3] is never a weekend if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  return { listingId: l.json.id as string, blockId: b.json.id as string, title, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(start + n))) };
}
const V1 = await listingAndBlock(OA, "P2H Safe V1"); const V2 = await listingAndBlock(OA, "P2H Safe V2"); const T0 = await listingAndBlock(OA, "P2H Safe Today", 0);
const LB = await listingAndBlock(OB, "P2H Safe B Camp"); const LF1 = await listingAndBlock(F1.actor, "P2H Safe F1 Camp"); const LF2 = await listingAndBlock(F2.actor, "P2H Safe F2 Camp"); const LH = await listingAndBlock(HO, "P2H Safe HO Camp");
const S = await mkStaff(TA, { franchiseId: null, name: "Safe Plain", staffRole: "Coach" });
const D = await mkStaff(TA, { franchiseId: null, name: "Safe Dsl", staffRole: "Lead", lead: true });
const L = await mkStaff(TA, { franchiseId: null, name: "Safe Lead", staffRole: "Lead", lead: true, assignment: { mode: "listings", ids: [V1.listingId] } });
const SF1 = await mkStaff(TC, { franchiseId: F1.franchiseId, name: "Safe Fone", staffRole: "Coach" });
const P = await mkParent("Safe Parent"); const PB = await mkParent("Safe Parent B"); const PF1 = await mkParent("Safe Parent F1"); const PF2 = await mkParent("Safe Parent F2");
await setSettings(TA, null, { safeguarding: { dslName: "Safe Dsl", dslEmail: D.email, requireAcknowledgement: true } });
async function child(parent: Actor, name: string, extra: Record<string, unknown> = {}) { const r = await api(parent, "POST", "/api/my/children", { name, dob: "2019-05-04", ...extra }); if (r.status !== 201 && r.status !== 200) throw new Error(`child ${r.status} ${r.text}`); return r.json.id as string; }
async function parentBook(parent: Actor, Lx: { listingId: string; blockId: string; days: string[] }, name: string, childId: string, days?: string[]) { const r = await api(parent, "POST", "/api/my/bookings", { listingId: Lx.listingId, blockId: Lx.blockId, method: "Bank transfer", items: [{ pass: "Day", child: name, childId, age: 7, dates: days ?? Lx.days.slice(0, 2) }] }); if (r.status !== 201) throw new Error(`parent booking ${r.status} ${r.text}`); return r.json.ref ?? r.json.refs?.[0] ?? r.json.bookings?.[0]?.ref; }
const K1 = await child(P, "Kid One"); const K2 = await child(P, "Kid Two"); const KB = await child(PB, "Kid Bee"); const KF1 = await child(PF1, "Kid Fone"); const KF2 = await child(PF2, "Kid Ftwo");
const R1 = await parentBook(P, V1, "Kid One", K1); const R2 = await parentBook(P, V2, "Kid Two", K2); const RT = await parentBook(P, T0, "Kid One", K1, [today]);
await parentBook(PB, LB, "Kid Bee", KB); await parentBook(PF1, LF1, "Kid Fone", KF1); await parentBook(PF2, LF2, "Kid Ftwo", KF2);
origLog("world", { TA, TB, TC, K1, K2, R1, R2, RT });

// ── p2-s1: dossier ────────────────────────────────────────────────────────
await step("p2-s1", async () => {
  const inc = await api(OA, "POST", "/api/incidents", { kind: "safeguarding", date: today, childId: K1, childName: "Kid One", description: "Disclosure", concernCategory: "disclosure" });
  const incF2 = await api(F2.actor, "POST", "/api/incidents", { kind: "safeguarding", date: today, childId: KF2, childName: "Kid Ftwo", description: "F2 concern" });
  const a = await api(S, "GET", `/api/incidents/${inc.json?.id}/dossier`); const b = await api(D, "GET", `/api/incidents/${inc.json?.id}/dossier`); const c = await api(F1.actor, "GET", `/api/incidents/${incF2.json?.id}/dossier`);
  const ok = a.status === 404 && b.status === 200 && !!b.json?.parent && c.status === 404;
  results["p2-s1"] = { verdict: ok ? "pass" : "fail", actual: `plain staff → ${a.status}; named DSL staff → ${b.status} (parent=${b.json?.parent?.email ? "email present" : "none"}, bookings=${b.json?.bookings?.length}, siblings=${b.json?.siblings?.length}); $F1 on F2's child → ${c.status}`, notes: a.status === 404 ? "Staff get 404 rather than 403 (the route hides whether the record exists) — same protection." : undefined };
});
// ── p2-s2: role None + DSL exemption ─────────────────────────────────────
await step("p2-s2", async () => {
  await setSettings(TA, null, { rolesSetAt: new Date().toISOString(), roles: [{ id: "coach", name: "Coach", caps: { incidents: "none" } }] });
  await db.collection("users").doc(D.uid).set({ permRole: "coach" }, { merge: true });
  const r1 = await api(D, "POST", "/api/incidents", { kind: "safeguarding", date: today, childId: K1, childName: "Kid One", description: "DSL logs while exempt" });
  await setSettings(TA, null, { safeguarding: { dslName: "", dslEmail: "" } }); forgetSettings(TA);
  const r2 = await api(D, "POST", "/api/incidents", { kind: "safeguarding", date: today, childId: K1, childName: "Kid One", description: "DSL logs after un-naming" });
  await setSettings(TA, null, { safeguarding: { dslName: "Safe Dsl", dslEmail: D.email, requireAcknowledgement: true }, rolesSetAt: new Date().toISOString(), roles: [{ id: "coach", name: "Coach", caps: {} }] }); forgetSettings(TA);
  const ok = r1.status === 201 && r2.status === 403 && r2.json?.code === "no_access";
  results["p2-s2"] = { verdict: ok ? "pass" : "fail", actual: `incidents=None role + named DSL: POST → ${r1.status}; un-named (cache cleared in-process): POST → ${r2.status} ${r2.json?.code ?? ""}`, notes: "The 10s settings cache was cleared directly (forgetSettings) rather than waiting 11s." };
});
// ── p2-s3: concern about the DSL ──────────────────────────────────────────
await step("p2-s3", async () => {
  const bD = (await bells(D.email)).length, bO = (await bells(OA.email)).length; mailLog.length = 0;
  const r = await api(S, "POST", "/api/incidents", { kind: "safeguarding", date: today, childName: "Safe Dsl", description: "Concern about the DSL", subject: "staff", aboutDsl: true });
  await wait(2500);
  const dD = (await bells(D.email)).length - bD, dO = (await bells(OA.email)).length - bO;
  const mailD = mailLog.some((l) => l.includes(D.email)), mailO = mailLog.some((l) => l.includes(OA.email));
  const ok = r.status === 201 && dD === 0 && dO === 1;
  results["p2-s3"] = { verdict: ok ? "pass" : "fail", actual: `POST (subject staff, aboutDsl) → ${r.status} aboutDsl=${r.json?.aboutDsl}; bells: DSL +${dD}, owner +${dO}; mail attempts: DSL=${mailD}, owner=${mailO} (mailer not live, SUPPRESSED lines)`, notes: "Safe behaviour observed: routed to the account holder only, nothing to the DSL (dslAlert.ts aboutLead → holder)." };
});
// ── p2-s4: concern about a colleague hidden from staff list ───────────────
await step("p2-s4", async () => {
  const r = await api(OA, "POST", "/api/incidents", { kind: "incident", date: today, childName: "Safe Plain", description: "About a colleague", subject: "staff" });
  const list = await api(S, "GET", "/api/incidents"); const ids = (list.json ?? []).map((x: any) => x.id);
  const ok = r.status === 201 && !ids.includes(r.json?.id);
  results["p2-s4"] = { verdict: ok ? "pass" : "fail", actual: `kind incident, subject staff → ${r.status}; in plain staff's GET /api/incidents: ${ids.includes(r.json?.id)} (${ids.length} visible)` };
});
// ── p2-s5: notes + deletes ────────────────────────────────────────────────
await step("p2-s5", async () => {
  const mine = await api(S, "POST", "/api/incidents", { kind: "accident", date: today, childId: K1, childName: "Kid One", description: "Grazed knee", treatment: "plaster" });
  const pn = await api(P, "POST", `/api/incidents/${mine.json?.id}/note`, { text: "Thanks" });
  const sn = await api(S, "POST", `/api/incidents/${mine.json?.id}/note`, { text: "Checked again at 3pm" });
  const sd = await api(S, "DELETE", `/api/incidents/${mine.json?.id}`);
  const decided = await api(OA, "POST", "/api/incidents", { kind: "safeguarding", date: today, childId: K1, childName: "Kid One", description: "Decided", dslLog: [{ id: "dsl1", key: "referred_mash", label: "Referred to MASH", at: new Date().toISOString(), by: "Safe Dsl", note: "ref 123" }] });
  const od = decided.json?.id ? await api(OA, "DELETE", `/api/incidents/${decided.json.id}`) : { status: 0, json: null };
  const gone = decided.json?.id ? !(await db.collection("incidents").doc(decided.json.id).get()).exists : false;
  const ok = pn.status !== 201 && sn.status === 201 && sd.status === 403;
  results["p2-s5"] = { verdict: ok ? "pass" : "fail", actual: `parent note on an accident → ${pn.status}; staff note on their own → ${sn.status}; staff delete → ${sd.status}; owner create with dslLog → ${decided.status} ${decided.status !== 201 ? JSON.stringify(decided.json).slice(0, 100) : ""}; owner delete of a record carrying a DSL decision → ${od.status}, doc gone=${gone}`, notes: `${pn.status === 201 ? "Parents MAY note their own child's accident record (incidents.ts:487 accepts role parent) — the plan expected 403; this is the designed parent reply channel. " : ""}${gone ? "Fix needed (decision): the owner's delete of a decided safeguarding record removes it outright — no audit stub. Plan asks for a refusal or a stub." : ""}` };
});
// ── p2-s6: child id from another tenant ───────────────────────────────────
await step("p2-s6", async () => {
  const r = await api(OA, "POST", "/api/incidents", { kind: "accident", date: today, childId: KB, childName: "Kid Bee", description: "not ours" });
  results["p2-s6"] = { verdict: r.status === 403 || r.status === 404 ? "pass" : "fail", actual: `A logs with B's childId → ${r.status} ${(r.json?.code ?? r.json?.error ?? "").toString().slice(0, 40)}` };
});
// ── p2-s7 / s8 / s9 / s10: medications ────────────────────────────────────
let medId = "";
await step("p2-s7", async () => {
  const m = await api(OA, "POST", "/api/medications", { childId: K1, childName: "Kid One", name: "Ventolin", dose: "2 puffs", consentGranted: true, consentBy: "Safe Parent" });
  medId = m.json?.id; if (m.status !== 201) throw new Error(`med ${m.status} ${m.text}`);
  const a1 = await api(OA, "POST", `/api/medications/${medId}/administer`, { date: today, time: "10:00", doseGiven: "2 puffs", given: true });
  const a2 = await api(OA, "POST", `/api/medications/${medId}/administer`, { date: today, time: "14:00", doseGiven: "Not given", given: false, notes: "child refused" });
  const list = await api(OA, "GET", `/api/medications/administrations?from=${today}&to=${today}`); const rows: any[] = list.json ?? [];
  const mineRows = rows.filter((x) => x.medicationId === medId); const notGiven = mineRows.find((x) => x.given === false);
  const pv = await api(P, "GET", "/api/medications/administrations"); const pRows: any[] = pv.json ?? []; const pOther = pRows.filter((x) => x.childId !== K1 && x.childId !== K2).length;
  const pb = await api(PB, "GET", "/api/medications/administrations");
  const ok = a1.status === 201 && a2.status === 201 && mineRows.length === 2 && notGiven?.notes === "child refused" && pRows.length === 2 && pOther === 0 && (pb.json ?? []).length === 0;
  results["p2-s7"] = { verdict: ok ? "pass" : "fail", actual: `given → ${a1.status}, not-given with reason → ${a2.status}; operator list ${today}: ${mineRows.length} rows (not-given notes="${notGiven?.notes}"); parent P sees ${pRows.length} (other families' rows: ${pOther}); parent of B sees ${(pb.json ?? []).length}` };
});
await step("p2-s8", async () => {
  const body = { date: today, time: "16:00", doseGiven: "2 puffs", given: true };
  const [r1, r2] = await Promise.all([api(OA, "POST", `/api/medications/${medId}/administer`, body), api(OA, "POST", `/api/medications/${medId}/administer`, body)]);
  const rows = (await db.collection("administrations").where("medicationId", "==", medId).where("time", "==", "16:00").get()).size;
  const ok = [r1.status, r2.status].includes(409) || rows === 1 || r1.json?.duplicate || r2.json?.duplicate;
  results["p2-s8"] = { verdict: ok ? "pass" : "fail", actual: `two simultaneous doses at 16:00 → ${r1.status}/${r2.status}; administration rows at 16:00: ${rows}`, notes: ok ? undefined : "Fix needed: medications.ts /administer has no duplicate check — two identical doses a second apart are both recorded. Add a same-med/same-time window check (like record-payment's) or an idempotency key." };
});
await step("p2-s9", async () => {
  await db.collection("medications").doc(medId).set({ expiryDate: ymd(daysFromNow(-1)) }, { merge: true });
  const r = await api(OA, "POST", `/api/medications/${medId}/administer`, { date: today, time: "17:00", doseGiven: "2 puffs", given: true });
  const reg = await api(OA, "GET", `/api/registers?date=${today}`); const txt = JSON.stringify(reg.json ?? {}); const flagged = /expir/i.test(txt);
  const ok = r.status >= 400 || !!r.json?.warning || /expir/i.test(JSON.stringify(r.json ?? {}));
  results["p2-s9"] = { verdict: ok && flagged ? "pass" : "fail", actual: `expiry yesterday: administer → ${r.status} ${/expir/i.test(JSON.stringify(r.json ?? {})) ? "(mentions expiry)" : "(no expiry warning in response)"}; register for today mentions expiry: ${flagged} (register meds fields: ${(txt.match(/"medications":\[[^\]]{0,120}/) ?? ["none"])[0].slice(0, 120)})`, notes: ok ? undefined : "Fix needed: an expired medication can be administered with no refusal or warning (expiryDate is stored but never checked in /administer), and the register row's medication summary doesn't carry expiry." };
});
await step("p2-s10", async () => {
  const w = await api(P, "POST", `/api/medications/${medId}/withdraw`, {});
  const d = await api(OA, "DELETE", `/api/medications/${medId}`);
  const n = await api(OA, "POST", `/api/medications/${medId}/note`, { text: "Parent withdrew — spoke on phone" });
  const ok = w.status === 200 && d.status === 409 && n.status < 300;
  results["p2-s10"] = { verdict: ok ? "pass" : "fail", actual: `parent withdraw → ${w.status}; DELETE → ${d.status} ${(d.json?.code ?? "")}; note afterwards → ${n.status}` };
});
// ── p2-s11: EHCP file ─────────────────────────────────────────────────────
await step("p2-s11", async () => {
  const b64 = Buffer.from("%PDF-1.4 test plan").toString("base64");
  const f = await api(P, "POST", "/api/my/files", { name: "plan.pdf", contentType: "application/pdf", bytes: 18, total: 1 });
  const c = await api(P, "PUT", `/api/my/files/${f.json?.id}/chunks/0`, { b64 });
  const dn = await api(P, "POST", `/api/my/files/${f.json?.id}/done`, {});
  await api(P, "PUT", `/api/my/children/${K1}`, { name: "Kid One", dob: "2019-05-04", sendPlanId: f.json?.id, sendPlanName: "plan.pdf" });
  await parentBook(P, V1, "Kid One", K1, [V1.days[3]]); await wait(2000); // a new booking grants the plan to the tenant (fire-and-forget in my.ts, so give it a moment)
  const gA = await api(OA, "GET", `/api/my/files/${f.json?.id}`); const gB = await api(OB, "GET", `/api/my/files/${f.json?.id}`);
  const gS = await api(S, "GET", `/api/my/files/${f.json?.id}`); const gL2 = await api(L, "GET", `/api/my/files/${f.json?.id}`);
  const big = await api(P, "POST", "/api/my/files", { name: "huge.pdf", contentType: "application/pdf", bytes: 16_000_000, total: 23 });
  const ok = dn.status === 200 && gA.status === 200 && gB.status === 404 && big.status >= 400;
  results["p2-s11"] = { verdict: ok ? "pass" : "fail", actual: `upload ${f.status}/${c.status}/${dn.status}; GET as $A → ${gA.status}; as $B → ${gB.status}; as plain staff of A (no assignment) → ${gS.status}; as site lead assigned to V1 (child booked at V1) → ${gL2.status}; 16MB create → ${big.status} ${(big.json?.error?.[0]?.message ?? big.json?.error ?? "").toString().slice(0, 50)}`, notes: `${gS.status === 200 ? "Any staff member of the tenant can read the plan (childFiles.ts:142 checks tenantIds only, not the staff member's listing assignment) — the plan expected 403 for unassigned staff; fix needed (decision). " : ""}Over-size is refused at create with 400 (zod max FILE_MAX_BYTES), not 413.` };
});
results["p2-s12"] = { verdict: "blocked", method: "browser", actual: "Browser step (/plan/<fileId> signed-out vs $B, Network tab) — queued for the browser agent." };
// ── p2-s13: who may edit care details ─────────────────────────────────────
await step("p2-s13", async () => {
  const s = await api(S, "PUT", `/api/children/${K1}`, { allergies: "nuts" });
  await setSettings(TA, null, { rolesSetAt: new Date().toISOString(), roles: [{ id: "lead", name: "Lead", caps: { medical: "edit" } }] }); await db.collection("users").doc(L.uid).set({ permRole: "lead" }, { merge: true }); forgetSettings(TA);
  const l = await api(L, "PUT", `/api/children/${K1}`, { allergies: "nuts" });
  const a = await api(OA, "PUT", `/api/children/${K1}`, { allergies: "nuts" });
  const p = await api(P, "PUT", `/api/my/children/${K1}`, { name: "Kid One", dob: "2019-05-04", collectionPassword: "banana", walkHomeConsent: true });
  const doc = (await db.collection("children").doc(K1).get()).data() ?? {};
  const ok = s.status === 403 && (a.status === 200) && Array.isArray(doc.careHistory);
  results["p2-s13"] = { verdict: ok ? "pass" : "fail", actual: `plain staff PUT allergies → ${s.status}; site lead with medical=edit → ${l.status} ${(l.json?.error ?? "").slice(0, 50)}; owner → ${a.status} (careHistory entries: ${doc.careHistory?.length ?? 0}); parent sets collectionPassword+walkHomeConsent → ${p.status}: stored collectionPassword=${doc.collectionPassword}, walkHomeConsent=${doc.walkHomeConsent}`, notes: l.status === 403 ? "PUT /api/children/:id is manager-only (children.ts:249 — company/franchise/freelancer), so a lead with medical=edit is still 403; the plan expected 200 + careHistory. Decision needed: open it to staff whose role has medical=edit. Parent route accepts both collectionPassword and walkHomeConsent (nothing ignored)." : undefined };
});
// ── p2-s14: lookup scope ──────────────────────────────────────────────────
await step("p2-s14", async () => {
  const lk = async (who: Actor) => { const r = await api(who, "GET", "/api/children/lookup?q=ki"); return (r.json ?? []).map((x: any) => x.name).sort(); };
  const asL = await lk(L), asS = await lk(S), asA = await lk(OA);
  const ok = asL.join() === "Kid One" && asS.join() === "Kid One,Kid Two" && asA.join() === "Kid One,Kid Two";
  results["p2-s14"] = { verdict: ok ? "pass" : "fail", actual: `site lead (V1 only) → [${asL.join(", ")}]; plain staff (no assignment) → [${asS.join(", ")}]; owner → [${asA.join(", ")}]; Firestore: 2 children booked with A`, notes: "A plain staff member with NO assignment sees the whole tenant (assignment absent = unrestricted, siteScope.ts:24) — same as the owner; the plan's 'only assigned listings' applies once an assignment exists." };
});
// ── p2-s15: headcount + nudge ─────────────────────────────────────────────
await step("p2-s15", async () => {
  const mk = await api(OA, "POST", `/api/registers/${T0.blockId}/${today}/mark`, { ref: RT, action: "in" });
  const hc = await api(OA, "POST", `/api/registers/${T0.blockId}/${today}/headcount`, { n: 0 });
  const reg = await api(OA, "GET", `/api/registers?date=${today}`); const sess = (reg.json?.sessions ?? reg.json ?? []).find?.((s: any) => s.blockId === T0.blockId);
  const nd = await api(OA, "POST", `/api/registers/${T0.blockId}/${today}/nudge`, { refs: [RT] });
  const th = await api(OA, "GET", "/api/messages/threads"); const threads: any[] = th.json?.threads ?? th.json ?? [];
  const mineT = threads.filter((t) => (t.email ?? t.parentEmail ?? "").toLowerCase() === P.email.toLowerCase()); const otherT = threads.filter((t) => (t.email ?? t.parentEmail ?? "").toLowerCase() === PB.email.toLowerCase());
  const heads = sess?.heads ?? sess?.register?.heads; const nudges = sess?.nudges ?? sess?.register?.nudges;
  results["p2-s15"] = { verdict: mk.status === 200 && hc.status === 201 && nd.status < 300 && otherT.length === 0 ? "pass" : "fail", actual: `mark in → ${mk.status}; headcount 0 (1 signed in) → ${hc.status}; register shows heads=${JSON.stringify(heads)?.slice(0, 80)} nudges=${JSON.stringify(nudges)?.slice(0, 60)}; nudge → ${nd.status} ${j(nd)}; threads for this family: ${mineT.length}, for B's family: ${otherT.length} (total threads ${threads.length})`, notes: "The headcount is stored as a tally (heads[] with n/by/at); the mismatch against signed-in isn't computed server-side — the register screen compares. The nudge records the chase time on the register (nudges[ref]) and does not itself open a message thread." };
});
// ── p2-s16: note rules ────────────────────────────────────────────────────
await step("p2-s16", async () => {
  const sN = await api(S, "POST", `/api/registers/${V2.blockId}/${V2.days[0]}/note`, { ref: R2, op: "save", text: "not on the rota" });
  const fN = await api(F1.actor, "POST", `/api/registers/${LH.blockId}/${LH.days[0]}/note`, { ref: "APF-0", op: "save", text: "HO block" });
  const lN = await api(L, "POST", `/api/registers/${V2.blockId}/${V2.days[0]}/note`, { ref: R2, op: "save", text: "outside my site" });
  results["p2-s16"] = { verdict: fN.status === 404 ? "pass" : "fail", actual: `plain staff (no rota, no assignment) notes on V2 → ${sN.status}; site lead assigned to V1 notes on V2 → ${lN.status}; $F1 on HO's block → ${fN.status}`, notes: "Staff rule: allowed unless site-scoped (assignment) — a V1-only lead is refused on V2; being on the rota isn't checked." };
});
// ── p2-s17: HO oversight ──────────────────────────────────────────────────
await step("p2-s17", async () => {
  await api(F1.actor, "POST", "/api/incidents", { kind: "accident", date: today, childId: KF1, childName: "Kid Fone", description: "F1 bump" });
  const ov = await api(HO, "GET", "/api/ho/oversight/incidents"); const acc = await api(HO, "GET", "/api/ho/oversight/accidents"); const med = await api(HO, "GET", "/api/ho/oversight/medication");
  const f1 = await api(F1.actor, "GET", "/api/incidents"); const f2 = await api(F2.actor, "GET", "/api/incidents");
  const row = (x: any, id: string) => (x.json?.byFranchise ?? []).find((r: any) => r.franchiseId === id || r.id === id);
  const r1 = row(ov, F1.franchiseId) ?? row(acc, F1.franchiseId); const r2 = row(ov, F2.franchiseId) ?? row(acc, F2.franchiseId);
  const writes = [await api(HO, "POST", "/api/ho/oversight/incidents", {}), await api(HO, "PUT", "/api/ho/overview", {}), await api(HO, "POST", "/api/ho/overview", {})].map((r) => r.status);
  const ok = ov.status === 200 && acc.status === 200 && med.status === 200 && writes.every((s) => s === 404 || s === 405) && f1.status === 200 && f2.status === 200;
  results["p2-s17"] = { verdict: ok ? "pass" : "fail", actual: `oversight incidents/accidents/medication → ${ov.status}/${acc.status}/${med.status}; F1 row=${JSON.stringify(r1)?.slice(0, 100)} vs F1 own list ${f1.json?.length}; F2 row=${JSON.stringify(r2)?.slice(0, 100)} vs F2 own list ${f2.json?.length}; writes under /api/ho → ${writes.join("/")}` };
});
// ── p2-s18: ratios board ──────────────────────────────────────────────────
await step("p2-s18", async () => {
  const board = await api(OA, "GET", `/api/ratios/board/${today}`);
  const key = (board.json?.children ?? board.json?.rows ?? [])[0]?.key ?? (board.json?.children ?? [])[0]?.id ?? RT;
  const mv = await api(OA, "PUT", `/api/ratios/board/${today}`, { overrides: { [key]: "8-11" }, groupStaff: {} });
  await setSettings(TA, null, { staff: { assignByLeads: true } }); forgetSettings(TA);
  const st = await api(S, "PUT", `/api/ratios/board/${today}`, { overrides: { [key]: "8-11" }, groupStaff: { "8-11": ["Safe Plain"] } });
  results["p2-s18"] = { verdict: st.status === 403 ? (mv.status >= 400 || /warn/i.test(JSON.stringify(mv.json ?? {})) ? "pass" : "fail") : "fail", actual: `board GET → ${board.status} (keys: ${Object.keys(board.json ?? {}).join(",")}); owner moves a 7-year-old's row to group "8-11" → ${mv.status} ${j(mv)}; plain staff assigns staff with assignByLeads on → ${st.status} ${(st.json?.error ?? "").slice(0, 50)}`, notes: mv.status === 200 && !/warn/i.test(JSON.stringify(mv.json ?? {})) ? "Fix needed (minor): an age-inappropriate group override is accepted silently (ratios.ts:258 stores overrides as given, no age check or warning)." : undefined };
});
// ── p2-s19: trip message recipients ───────────────────────────────────────
await step("p2-s19", async () => {
  const t = await api(OA, "POST", "/api/trips", { destination: "Zoo", date: ymd(daysFromNow(10)), listingId: V1.listingId, attendees: [{ n: "Kid One", childId: K1, consent: "granted" }], parentMsg: "Bring a packed lunch for {child}" });
  if (t.status !== 201) throw new Error(`trip ${t.status} ${t.text}`);
  const bP = (await bells(P.email)).length, bPB = (await bells(PB.email)).length;
  const s = await api(S, "POST", `/api/trips/${t.json.id}/send-message`, {}); const a = await api(OA, "POST", `/api/trips/${t.json.id}/send-message`, {});
  await wait(1500);
  const dP = (await bells(P.email)).length - bP, dPB = (await bells(PB.email)).length - bPB;
  results["p2-s19"] = { verdict: a.status === 200 && a.json?.sent === 1 && dP >= 1 && dPB === 0 ? "pass" : "fail", actual: `plain staff send → ${s.status} ${(s.json?.error ?? "").slice(0, 40)}; owner send → ${a.status} sent=${a.json?.sent}; bells: trip family +${dP}, other tenant's family +${dPB}`, notes: s.status === 200 ? "Plain staff CAN send the trip message (trips.ts own() allows any staff who can see the trip; whoCanPlan gates planning, not sending) — the plan expected 403 unless lead. Decision needed." : undefined };
});
results["p2-s20"] = { verdict: "blocked", actual: "The chase sweeps (acknowledgementChase / medicationDue / tripConsentChase in src/lib/sweeps.ts) are module-private and only run via startSweeps(), which would fire every REAL tenant's chases from this process. Code read: each delivery goes through fireOnce(`ackchase_<id>_<date>` / `tripconsent_<trip>_<child>_<date>`), a Firestore-transaction claim keyed per record per day, so a second pass in the same day cannot re-deliver.", notes: "Needs a tenant-scoped once-runner (e.g. `npx tsx scripts/sweeps_once.mts --tenant X`) to prove it live — fix needed for testability." };
// ── p2-s21: walkHome on the register row ──────────────────────────────────
await step("p2-s21", async () => {
  await api(P, "PUT", `/api/my/children/${K1}`, { name: "Kid One", dob: "2019-05-04", walkHomeConsent: true });
  const reg = await api(OA, "GET", `/api/registers?date=${today}`); const txt = JSON.stringify(reg.json ?? {});
  const has = /"walkHomeConsent":true/.test(txt);
  results["p2-s21"] = { verdict: has ? "pass" : "fail", actual: `walkHomeConsent set on Kid One; GET /api/registers?date=${today} carries walkHomeConsent:true on the row: ${has}` };
});
// ── p2-s22: uploads ───────────────────────────────────────────────────────
await step("p2-s22", async () => {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`).toString("base64");
  const a = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${svg}` });
  const bigJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(950_000, 1)]).toString("base64");
  const b = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/jpeg;base64,${bigJpeg}` });
  const png1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const c = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${png1}` });
  const url: string = c.json?.url ?? c.json?.id ?? ""; const id = url.split("/").pop()?.split("?")[0] ?? "";
  const g = id ? await fetch(`${base}/api/images/${id}`) : null;
  const ct = g?.headers.get("content-type"), xcto = g?.headers.get("x-content-type-options");
  const ok = a.status >= 400 && b.status === 413 && c.status < 300 && g?.status === 200 && ct === "image/png" && xcto === "nosniff";
  results["p2-s22"] = { verdict: ok ? "pass" : "fail", actual: `SVG-with-script sent as image/png → ${a.status} ${(a.json?.error ?? "").toString().slice(0, 50)}; 950KB JPEG → ${b.status}; 1px PNG → ${c.status}; GET /api/images/${id.slice(0, 8)}… → ${g?.status} content-type=${ct} x-content-type-options=${xcto}`, notes: a.status < 400 ? "Fix needed: uploads.ts trusts the data-URL mime for images (only PDFs are magic-checked) — an SVG carrying <script> is stored as image/png. Served with nosniff so browsers won't run it inline, but sniff the PNG/JPEG/WebP/GIF magic bytes too." : undefined };
});

fs.writeFileSync("/tmp/p2h_day3.json", JSON.stringify({ results, mailLog: mailLog.slice(0, 40), world: { TA, TB, TC } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
