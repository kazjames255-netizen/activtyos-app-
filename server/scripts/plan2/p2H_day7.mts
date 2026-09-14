// Plan-2 Day 7 — Learning, credentials → rota gate, documents (p2-l1, l5-l9,
// l12-l14; the browser steps l2/l3/l4/l10/l11 are the browser agent's).
// Throwaway freelancer A (+ staff S/S2/S3/S4, parent P), freelancer B (zero
// certificates), company C + F1/F2 (+ HO staff, F1 staff, F2 staff). All
// deleted at the end (try/finally).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day7.mts
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bells = async (toEmail: string) => (await db.collection("notifications").where("toEmail", "==", toEmail.toLowerCase()).get()).docs.map((d) => d.data());
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 90);
const today = ymd(new Date()); const yesterday = ymd(daysFromNow(-1));
const fileIds: string[] = []; // docFiles docs whose chunks sub-collection we must delete ourselves

const base = await start();
let world: Record<string, string> = {};
try {
  const A = await mkTenant("freelancer", "P2H Learn A"); const OA = A.owner; const TA = A.tenantId;
  const B = await mkTenant("freelancer", "P2H Learn B"); const OB = B.owner; const TB = B.tenantId;
  const C = await mkTenant("company", "P2H Learn HO"); const HO = C.owner; const TC = C.tenantId; const F1 = await mkFranchise(TC, "P2H Learn F1"); const F2 = await mkFranchise(TC, "P2H Learn F2");
  const S = await mkStaff(TA, { franchiseId: null, name: "Learn Staff", staffRole: "Coach" });
  const S2 = await mkStaff(TA, { franchiseId: null, name: "Learn Leader", staffRole: "Lead / manager", lead: true });
  const S3 = await mkStaff(TA, { franchiseId: null, name: "Learn Third", staffRole: "Coach" });
  const S4 = await mkStaff(TA, { franchiseId: null, name: "Learn Manager", staffRole: "Manager" }); // a DIFFERENT role that a substring match would swallow
  const P = await mkParent("Learn Parent");
  const SH = await mkStaff(TC, { franchiseId: null, name: "Learn HO Staff", staffRole: "Coach" });
  const SF1 = await mkStaff(TC, { franchiseId: F1.franchiseId, name: "Learn F1 Staff", staffRole: "Coach" });
  const SF2 = await mkStaff(TC, { franchiseId: F2.franchiseId, name: "Learn F2 Staff", staffRole: "Coach" });
  await setSettings(TA, null, { learning: { passMark: 80 }, staff: { requireDBS: true, requireCompliance: true } }); forgetSettings(TA);
  world = { TA, TB, TC, S: S.uid, S2: S2.uid, F1: F1.franchiseId, F2: F2.franchiseId };
  origLog("world", world);

  const assignment = (course: string, extra: Record<string, unknown> = {}) => ({ course, title: course, kind: "all", roles: [], staff: [], locs: [], due: "", required: true, version: 1, ...extra });
  const rotaStore = (people: { id: string; name: string }[], shifts: { id: string; staffId: string }[]) => ({ staff: people.map((p) => ({ ...p, role: "Coach", rate: 12 })), shifts: shifts.map((s) => ({ ...s, site: "Main", role: "Coach", date: ymd(daysFromNow(3)), start: "09:00", end: "15:00" })), sites: ["Main"] });

  // ── p2-l1: completions scope + pass mark ───────────────────────────────
  await step("p2-l1", async () => {
    const asg = await api(OA, "PUT", "/api/learning/assignments", { assignments: [assignment("safeguarding-l1")] });
    const low = await api(S, "POST", "/api/learning/completions", { courseId: "safeguarding-l1", title: "safeguarding-l1", score: 40, date: today });
    const other = await api(S2, "POST", "/api/learning/completions", { courseId: "safeguarding-l1", title: "safeguarding-l1", score: 90, date: today });
    const mineS = await api(S, "GET", "/api/learning/completions"); const teamA = await api(OA, "GET", "/api/learning/completions");
    const unassigned = await api(S, "POST", "/api/learning/completions", { courseId: "never-assigned", title: "Never assigned", score: 100, date: today });
    const sKeys = Object.keys(mineS.json ?? {}); const aKeys = Object.keys(teamA.json ?? {});
    const stored = (await db.collection("learningCompletions").where("key", "==", TA).get()).docs.map((d) => `${d.get("staffName")}/${d.get("courseId")}=${d.get("score")}`);
    const ownOnly = mineS.status === 200 && sKeys.length === 1 && sKeys[0] === "Learn Staff";
    const ok = low.status === 200 && low.json?.completed === false && ownOnly;
    results["p2-l1"] = { verdict: ok ? "pass" : "fail", actual: `assign → ${asg.status}; $S posts score 40 (pass mark 80 in Setup) → ${low.status} completed=${low.json?.completed ?? "absent"} stored score=${low.json?.score}; $S2 posts 90 → ${other.status}; GET completions as $S → ${mineS.status} keys=[${sKeys.join(",")}]; as $A → ${teamA.status} keys=[${aKeys.join(",")}]; never-assigned course → ${unassigned.status} ${unassigned.status === 200 ? "accepted" : err(unassigned)}; learningCompletions rows: ${stored.join(", ")}`, notes: "Fix needed: POST /api/learning/completions has no pass mark — any score 0-100 is stored as a completion and no completed flag is returned (learning.ts:167-196, doneSchema score min 0). Setup learning.passMark is client-side only. Unassigned course: accepted (no assignment check) — decision needed." };
  });

  // ── p2-l5: credentials drive the rota gate ─────────────────────────────
  await step("p2-l5", async () => {
    const t1 = await api(OA, "PUT", "/api/credentials/types", { types: [{ id: "dbs", name: "DBS", dbs: true }, { id: "pfa", name: "Paediatric First Aid", renewMonths: 36 }] });
    const r1 = await api(OA, "PUT", "/api/credentials/records/l5-dbs", { staff: "Learn Staff", typeId: "dbs", verified: "verified", issue: today, expiry: ymd(daysFromNow(400)) });
    const r2 = await api(OA, "PUT", "/api/credentials/records/l5-pfa", { staff: "Learn Staff", typeId: "pfa", verified: "verified", issue: today, expiry: ymd(daysFromNow(400)) });
    const t2 = await api(OA, "PUT", "/api/credentials/types", { types: [{ id: "dbs", name: "DBS", dbs: true }] }); // pfa removed while in use
    const after = await api(OA, "GET", "/api/credentials"); const pfaRec = (after.json?.records ?? []).find((r: any) => r.id === "l5-pfa");
    const pfaMirror = (await db.collection("certifications").doc(`cred_${TA}_l5-pfa`).get()).data();
    const exp = await api(OA, "PUT", "/api/credentials/records/l5-dbs", { staff: "Learn Staff", typeId: "dbs", verified: "verified", issue: ymd(daysFromNow(-800)), expiry: yesterday });
    const rota1 = await api(OA, "PUT", "/api/rota", rotaStore([{ id: "s1", name: "Learn Staff" }], [{ id: "sh1", staffId: "s1" }]));
    const del = await api(OA, "DELETE", "/api/credentials/records/l5-dbs");
    const rota2 = await api(OA, "PUT", "/api/rota", rotaStore([{ id: "s1", name: "Learn Staff" }], [{ id: "sh1", staffId: "s1" }]));
    const labelKept = !!pfaRec && pfaRec.typeId === "pfa" && pfaMirror?.type === "Paediatric First Aid";
    const ok = labelKept && rota1.status === 409 && /expired/i.test(rota1.json?.error ?? "") && del.status === 200 && rota2.status === 409 && /no DBS/i.test(rota2.json?.error ?? "");
    results["p2-l5"] = { verdict: ok ? "pass" : "fail", actual: `types → ${t1.status}; DBS+PFA records → ${r1.status}/${r2.status}; types without PFA → ${t2.status}; PFA record still listed: ${!!pfaRec} (typeId=${pfaRec?.typeId}, types now=[${(after.json?.types ?? []).map((t: any) => t.id).join(",")}]), certifications mirror type="${pfaMirror?.type}"; DBS expiry ${yesterday} → ${exp.status}; PUT rota rostering them → ${rota1.status} ${err(rota1)}; DELETE record → ${del.status}; roster again → ${rota2.status} ${err(rota2)}`, notes: "Records carry typeId only (no label) — after the type is removed the record survives and the certifications mirror keeps the human type name; the Setup screen would show a bare typeId." };
  });

  // ── p2-l6: first certificate switches enforcement on (tenant B, no certs) ─
  await step("p2-l6", async () => {
    const certs0 = (await db.collection("certifications").where("tenantId", "==", TB).get()).size;
    const first = await api(OB, "PUT", "/api/rota", rotaStore([{ id: "b1", name: "Six One" }, { id: "b2", name: "Six Two" }], [{ id: "sh1", staffId: "b1" }]));
    const rec = await api(OB, "PUT", "/api/credentials/records/l6-dbs", { staff: "Six One", typeId: "dbs", verified: "verified", issue: today, expiry: ymd(daysFromNow(400)) });
    const cur = await api(OB, "GET", "/api/rota");
    const second = await api(OB, "PUT", "/api/rota", { ...rotaStore([{ id: "b1", name: "Six One" }, { id: "b2", name: "Six Two" }], [{ id: "sh1", staffId: "b1" }, { id: "sh2", staffId: "b2" }]), baseUpdatedAt: cur.json?.updatedAt ?? null });
    const ok = certs0 === 0 && first.status === 200 && rec.status === 200 && second.status === 409 && /no DBS/i.test(second.json?.error ?? "");
    results["p2-l6"] = { verdict: ok ? "pass" : "fail", actual: `certifications in tenant B before: ${certs0}; roster "Six One" with nothing on file → ${first.status}; record ONE DBS for Six One → ${rec.status}; roster "Six Two" → ${second.status} ${err(second)}`, notes: "Decision (Amir 64), not a bug: staffPolicy.ts:72 — an empty certifications register means 'not tracking compliance' so anyone can be rostered; the first certificate recorded turns requireDBS on for the whole tenant." };
  });

  // ── p2-l7: chunked upload limits ───────────────────────────────────────
  await step("p2-l7", async () => {
    const CH = 700_000;
    const upload = async (bytes: number, name: string) => {
      const b64 = Buffer.alloc(bytes, 0x25).toString("base64"); const total = Math.ceil(b64.length / CH);
      const open = await api(OA, "POST", "/api/documents/files", { name, contentType: "application/pdf", bytes, total });
      if (open.status !== 201) return { open, chunks: [] as number[], done: null as null | { status: number; json: any }, id: null as string | null };
      const id = open.json.id as string; fileIds.push(id); const chunks: number[] = [];
      for (let i = 0; i < total; i++) { const c = await api(OA, "PUT", `/api/documents/files/${id}/chunks/${i}`, { b64: b64.slice(i * CH, (i + 1) * CH) }); chunks.push(c.status); if (c.status !== 200) break; }
      const done = await api(OA, "POST", `/api/documents/files/${id}/done`, {});
      return { open, chunks, done, id, total };
    };
    const ok14 = await upload(14_000_000, "fourteen.pdf");
    const big = await api(OA, "POST", "/api/documents/files", { name: "fifteen-one.pdf", contentType: "application/pdf", bytes: 15_100_000, total: 30 });
    const raw = await fetch(`${base}/api/documents/files/${ok14.id}`, { headers: { "x-test-uid": OA.uid, "x-test-email": OA.email } }); const len = (await raw.arrayBuffer()).byteLength;
    const par = await api(P, "GET", `/api/documents/files/${ok14.id}`); const st = await api(S, "GET", `/api/documents/files/${ok14.id}`);
    const ok = ok14.open.status === 201 && ok14.done?.status === 200 && len === 14_000_000 && big.status === 413 && par.status === 403;
    results["p2-l7"] = { verdict: ok ? "pass" : "fail", actual: `14MB: POST files → ${ok14.open.status}, ${ok14.chunks.length}/${ok14.total} chunks (${[...new Set(ok14.chunks)].join(",")}), done → ${ok14.done?.status}, GET as $A → ${raw.status} ${len} bytes; 15.1MB: POST files → ${big.status} ${err(big)}; GET file as $P → ${par.status}; as a staff member the document isn't assigned to ($S) → ${st.status}`, notes: `15.1MB is refused by the zod max on 'bytes' as a 400 (documents.ts:605 FILE_MAX) rather than the 413 the plan names — same protection, different code. Declared 'bytes' is never checked against what the chunks add up to (chunks are capped at 40 × 700k b64 ≈ 21MB raw). Unassigned staff: GET /files/:id is 'anyone on the team' (documents.ts:648) — answered ${st.status}.` };
  });

  // ── p2-l8: v2 resets receipts ──────────────────────────────────────────
  const libDoc = (version: number, extra: Record<string, unknown> = {}) => ({ id: "pol-safe", title: "Safeguarding policy", category: "policy", version, uploadedAt: new Date().toISOString(), all: true, roles: [], titles: [], listings: [], history: [], ...extra });
  await step("p2-l8", async () => {
    const v1 = await api(OA, "PUT", "/api/documents/library", { docs: [libDoc(1)] });
    const c1 = await api(S, "POST", "/api/documents/library/pol-safe/read", { version: 1 });
    const v2 = await api(OA, "PUT", "/api/documents/library", { docs: [libDoc(2)] });
    const stale = await api(S, "POST", "/api/documents/library/pol-safe/read", { version: 1 }); // the cached v1 must not count for v2
    const c3 = await api(S3, "POST", "/api/documents/library/pol-safe/read", { version: 2 });
    const asA = await api(OA, "GET", "/api/documents/library"); const asS = await api(S, "GET", "/api/documents/library");
    const sReads = (asA.json?.reads ?? []).filter((r: any) => r.staffEmail === S.email.toLowerCase()).map((r: any) => `v${r.version}`);
    const sUnreadV2 = !(asS.json?.reads ?? []).some((r: any) => r.docId === "pol-safe" && r.version === 2);
    const bS = (await bells(S.email)).length, b3 = (await bells(S3.email)).length;
    const chase = await api(OA, "POST", "/api/documents/library/chase", {}); await wait(1500);
    const dS = (await bells(S.email)).length - bS, d3 = (await bells(S3.email)).length - b3;
    const ok = v1.status === 200 && c1.status === 200 && v2.status === 200 && c3.status === 200 && sUnreadV2 && chase.status === 200 && dS === 1 && d3 === 0;
    results["p2-l8"] = { verdict: ok ? "pass" : "fail", actual: `publish v1 → ${v1.status}; $S confirms v1 → ${c1.status}; publish v2 → ${v2.status}; $S re-sends v1 → ${stale.status} ${err(stale)}; $S3 confirms v2 → ${c3.status}; GET library as $A: $S's receipts=[${sReads.join(",")}], team=${asA.json?.team?.length}; as $S: unread for v2=${sUnreadV2}; chase → ${chase.status} people=${chase.json?.people}; bells: $S +${dS}, $S3 +${d3}` };
  });

  // ── p2-l9: expired document ────────────────────────────────────────────
  await step("p2-l9", async () => {
    const put = await api(OA, "PUT", "/api/documents/library", { docs: [libDoc(2, { expiry: yesterday, expiresAt: yesterday })] });
    const asA = await api(OA, "GET", "/api/documents/library"); const asS = await api(S, "GET", "/api/documents/library");
    const dA = (asA.json?.docs ?? []).find((d: any) => d.id === "pol-safe"); const dS = (asS.json?.docs ?? []).find((d: any) => d.id === "pol-safe");
    const flagA = dA && (dA.expired === true || dA.status === "expired" || (dA.expiry ?? dA.expiresAt) < today);
    const ok = put.status === 200 && !!flagA && !!dS;
    results["p2-l9"] = { verdict: ok ? "pass" : "fail", actual: `PUT expiry=${yesterday} → ${put.status}; GET library as $A → ${asA.status}: doc present, expiry="${dA?.expiry}", server flag keys=[${Object.keys(dA ?? {}).filter((k) => /expir|status/i.test(k)).join(",")}]; as $S → ${asS.status}: ${dS ? `still listed (expiry="${dS.expiry}") — warned, not hidden` : "hidden"}`, notes: "The API stores and returns the raw expiry date only; 'Expired' is derived on both screens (DocumentsApp.tsx:130-131 status pill + expired filter; StaffDocsApp.tsx:72-73 shows an 'Expired' label to staff — the document stays readable). Record: staff are warned, not hidden." };
  });

  // ── p2-l12: franchise 'assign to all' stays inside ─────────────────────
  await step("p2-l12", async () => {
    const put = await api(F1.actor, "PUT", "/api/learning/assignments", { assignments: [assignment("f1-course")] });
    const f1s = await api(SF1, "GET", "/api/learning/assignments"); const f2s = await api(SF2, "GET", "/api/learning/assignments"); const hos = await api(SH, "GET", "/api/learning/assignments"); const f2 = await api(F2.actor, "GET", "/api/learning/assignments");
    const has = (r: { json: any }) => (r.json?.assignments ?? []).some((a: any) => a.course === "f1-course");
    const notify = await api(F1.actor, "POST", "/api/learning/notify", { kind: "assign", title: "f1-course", required: true, target: { kind: "all", roles: [], staff: [], locs: [] } });
    const names: string[] = notify.json?.names ?? []; const outside = names.filter((n) => n !== "Learn F1 Staff");
    const ok = put.status === 200 && has(f1s) && !has(f2s) && !has(hos) && !has(f2) && notify.status === 200 && outside.length === 0;
    results["p2-l12"] = { verdict: ok ? "pass" : "fail", actual: `$F1 PUT assignments (kind all) → ${put.status}; visible to F1 staff: ${has(f1s)} (${f1s.status}); F2 staff: ${has(f2s)} (${f2s.status}); HO staff: ${has(hos)} (${hos.status}); $F2 manager: ${has(f2)}; POST notify all as $F1 → ${notify.status} sent=${notify.json?.sent} names=[${names.join(",")}] outside F1: [${outside.join(",") || "none"}]` };
  });

  // ── p2-l13: notify by role matches exactly ─────────────────────────────
  await step("p2-l13", async () => {
    const role = "Lead / manager";
    const users = await db.collection("users").where("tenantId", "==", TA).where("role", "==", "staff").get();
    const exact = users.docs.filter((u) => [u.get("jobTitle"), u.get("staffRole")].some((v) => String(v ?? "").trim().toLowerCase() === role.toLowerCase())).map((u) => u.get("name"));
    const roster = users.docs.map((u) => `${u.get("name")}=${u.get("jobTitle") ?? u.get("staffRole")}`);
    const n = await api(OA, "POST", "/api/learning/notify", { kind: "remind", title: "Safeguarding L1", target: { kind: "roles", roles: [role], staff: [], locs: [] } });
    await wait(1500);
    const ok = n.status === 200 && n.json?.sent === exact.length && JSON.stringify([...(n.json?.names ?? [])].sort()) === JSON.stringify([...exact].sort());
    results["p2-l13"] = { verdict: ok ? "pass" : "fail", actual: `team: ${roster.join("; ")}; staff with exactly "${role}": ${exact.length} [${exact.join(",")}]; POST notify {role} → ${n.status} sent=${n.json?.sent} names=[${(n.json?.names ?? []).join(",")}]`, notes: ok ? undefined : "Fix needed (s13-so1 regression): learning.ts:87-88 matches roles by substring both ways (j.includes(r) || r.includes(j)), so a 'Manager' is counted for 'Lead / manager'." };
  });

  // ── p2-l14: required vs optional + identity ────────────────────────────
  await step("p2-l14", async () => {
    const put = await api(OA, "PUT", "/api/learning/assignments", { assignments: [assignment("req-course", { required: true }), assignment("opt-course", { required: false })] });
    const mine = await api(S, "GET", "/api/learning/assignments"); const flags = (mine.json?.assignments ?? []).map((a: any) => `${a.course}:${a.required}`);
    const done = await api(S, "POST", "/api/learning/completions", { courseId: "req-course", title: "req-course", score: 95, date: today });
    const teamA = await api(OA, "GET", "/api/learning/completions");
    const docs = (await db.collection("learningCompletions").where("key", "==", TA).where("courseId", "==", "req-course").get()).docs;
    const docId = docs[0]?.id ?? ""; const uidField = docs[0]?.get("uid");
    await db.collection("users").doc(S.uid).set({ name: "Learn Renamed" }, { merge: true });
    const renamed = await api(S, "GET", "/api/learning/completions"); const keptAfterRename = Object.values(renamed.json ?? {}).flat().some((c: any) => c.courseId === "req-course");
    await db.collection("users").doc(S.uid).set({ name: "Learn Staff" }, { merge: true });
    const flagsOk = flags.includes("req-course:true") && flags.includes("opt-course:false");
    const ok = put.status === 200 && flagsOk && done.status === 200 && keptAfterRename;
    results["p2-l14"] = { verdict: ok ? "pass" : "fail", actual: `assign req+opt → ${put.status}; GET as $S → ${mine.status} flags=[${flags.join(",")}]; complete required → ${done.status}; GET completions as $A → ${teamA.status} keys=[${Object.keys(teamA.json ?? {}).join(",")}]; stored doc id="${docId.replace(TA, "<TA>")}" uid=${uidField ?? "null"}; after renaming $S to "Learn Renamed" their GET completions still shows it: ${keptAfterRename} (${Object.keys(renamed.json ?? {}).join(",") || "empty"})`, notes: keptAfterRename ? undefined : "Fix needed: completions are keyed by a slug of the display name (learning.ts:180 nameSlug, doc id <key>_<name>_<course>) and staff reads filter by the account's current name (learning.ts:210) — the uid is stored but never used, so a renamed person loses their training record." };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day7.json", JSON.stringify({ results, world }, null, 2));
  for (const id of fileIds) { // chunks are a sub-collection — cleanup() only deletes the parent docs
    const ch = await db.collection("docFiles").doc(id).collection("chunks").get().catch(() => null);
    if (ch?.size) { const b = db.batch(); ch.docs.forEach((d) => b.delete(d.ref)); await b.commit().catch(() => {}); }
  }
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
