// Live API test for the worksheet PDF feature on the OakStaging tenant (needs API :4000 + a pilot run of worksheetBulk.ts):
//   cd server && npx tsx src/oak/worksheetApiTest.ts
// Tutor: GET /notes/:id/worksheet → signed URL → real PDF. Throwaway parent + child (created here, deleted at the end):
// 404 before homework; homework with worksheetNoteIds → 200 for that note only, other worksheet 404; rows carry worksheets[];
// the note.worksheetQuizId path (attempt start via worksheet homework) is exercised when a note has one.
import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, db } from "../firebase";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-staging.json"), "utf8")) as { tenantId: string; tutor: { email: string; password: string } };
const API = process.env.OAK_API || "http://localhost:4000", H = "/api/learning-hub", PW = "E2etest!123";
const key = () => { for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = l.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); } throw new Error("no key"); };
async function idt(ep: string, body: unknown) { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${ep}?key=${key()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = (await r.json()) as { idToken?: string; localId?: string }; assert.ok(j.idToken, ep); return { token: j.idToken!, uid: j.localId! }; }
const call = async (p: string, tok: string, init?: RequestInit) => { const r = await fetch(`${API}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j: unknown = t; try { j = JSON.parse(t); } catch { /* */ } return { status: r.status, j: j as any }; };
let n = 0; const ok = (name: string) => { n++; console.log(`  ok  ${name}`); };

(async () => {
  const tid = S.tenantId, q = `?tenantId=${tid}`;
  const tutor = await idt("accounts:signInWithPassword", { email: S.tutor.email, password: S.tutor.password, returnSecureToken: true });
  const done = Object.keys((JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-worksheets/state.json"), "utf8")) as { done: Record<string, unknown> }).done).filter((id) => id.includes(tid)).slice(0, 2);
  const withWs = await Promise.all(done.map((id) => db.collection("hubNotes").doc(id).get()));
  assert.ok(withWs.length >= 2, "run the pilot first");
  const [a, b] = withWs as [typeof withWs[0], typeof withWs[0]];
  const t1 = await call(`${H}/notes/${a.id}/worksheet${q}`, tutor.token);
  assert.equal(t1.status, 200); assert.ok(t1.j.url && t1.j.size > 1000 && t1.j.name); ok("tutor GET worksheet → 200 {url,name,size}");
  const buf = Buffer.from(await (await fetch(t1.j.url)).arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-"); assert.equal(buf.length, t1.j.size); ok(`signed URL serves the real PDF (${buf.length} bytes, ${t1.j.pages ?? "?"} pages)`);
  assert.equal((await call(`${H}/notes/nope-nope/worksheet${q}`, tutor.token)).status, 404); ok("unknown note → 404");
  const noWs = (await db.collection("hubNotes").where("tenantId", "==", tid).limit(400).get()).docs.find((d) => !d.get("worksheetFile"));
  if (noWs) { assert.equal((await call(`${H}/notes/${noWs.id}/worksheet${q}`, tutor.token)).status, 404); ok("note without worksheetFile → 404"); }

  // throwaway family
  const run = Date.now().toString(36), pEmail = `oakws-parent-${run}@example.com`;
  const p = await idt("accounts:signUp", { email: pEmail, password: PW, returnSecureToken: true });
  await call("/api/register-role", p.token, { method: "POST", body: JSON.stringify({ role: "parent", postcode: "NN5 7EA" }) });
  const child = await db.collection("children").add({ parentUid: p.uid, name: "Worksheet Kid", dob: "2016-11-03", createdAt: new Date().toISOString() });
  const now = new Date().toISOString(), tutorUid = (await auth.getUserByEmail(S.tutor.email)).uid;
  await db.collection("hubEnrolments").doc(`${tid}__${child.id}`).set({ tenantId: tid, franchiseId: null, childId: child.id, childName: "Worksheet Kid", parentUid: p.uid, parentEmail: pEmail, subjects: [], tutorUid, tutorName: "Oak tutor", active: true, yearGroup: "Year 5", yearGroupAuto: false, createdBy: tutorUid, createdAt: now, updatedAt: now });
  let hwId = "";
  try {
    const fq = `${q}&childId=${child.id}`;
    assert.equal((await call(`${H}/notes/${a.id}/worksheet${fq}`, p.token)).status, 404); ok("family, not assigned → 404");
    const bad = await call(`${H}/homework${q}`, tutor.token, { method: "POST", body: JSON.stringify({ title: "WS hw", assignedChildIds: [child.id], worksheetNoteIds: [noWs?.id ?? "nope"] }) });
    assert.equal(bad.status, 404); ok("homework with a note lacking a worksheet → 404");
    const hw = await call(`${H}/homework${q}`, tutor.token, { method: "POST", body: JSON.stringify({ title: "WS hw", assignedChildIds: [child.id], worksheetNoteIds: [a.id] }) });
    assert.equal(hw.status, 201, JSON.stringify(hw.j)); hwId = hw.j.id;
    assert.deepEqual(hw.j.worksheetNoteIds, [a.id]); assert.equal(hw.j.worksheets[0].noteId, a.id); assert.ok(hw.j.worksheets[0].size > 0); ok("POST homework returns worksheetNoteIds + worksheets[]");
    const tl = await call(`${H}/homework${q}`, tutor.token); assert.equal(tl.j.find((h: any) => h.id === hwId).worksheets.length, 1); ok("tutor list rows carry worksheets[]");
    const pl = await call(`${H}/homework${fq}`, p.token); const row = pl.j.find((h: any) => h.id === hwId); assert.equal(row.worksheets[0].noteId, a.id); ok("student row carries worksheets[{noteId,title,size}]");
    const f1 = await call(`${H}/notes/${a.id}/worksheet${fq}`, p.token); assert.equal(f1.status, 200); assert.equal(Buffer.from(await (await fetch(f1.j.url)).arrayBuffer()).subarray(0, 5).toString(), "%PDF-"); ok("family, assigned worksheet → 200 + PDF");
    assert.equal((await call(`${H}/notes/${b.id}/worksheet${fq}`, p.token)).status, 404); ok("family, someone else's worksheet → 404");
    const put = await call(`${H}/homework/${hwId}${q}`, tutor.token, { method: "PUT", body: JSON.stringify({ worksheetNoteIds: [b.id] }) });
    assert.equal(put.status, 200); assert.deepEqual(put.j.worksheetNoteIds, [b.id]); ok("PUT replaces worksheetNoteIds");
    assert.equal((await call(`${H}/notes/${a.id}/worksheet${fq}`, p.token)).status, 404); assert.equal((await call(`${H}/notes/${b.id}/worksheet${fq}`, p.token)).status, 200); ok("family access follows the homework edit");
  } finally {
    if (hwId) { await call(`${H}/homework/${hwId}${q}`, tutor.token, { method: "DELETE" }); await db.collection("hubSubmissions").doc(`${hwId}__${child.id}`).delete(); }
    await db.collection("hubEnrolments").doc(`${tid}__${child.id}`).delete(); await child.delete();
    await db.recursiveDelete(db.collection("users").doc(p.uid)); await auth.deleteUser(p.uid);
  }
  console.log(`\n${n} passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
