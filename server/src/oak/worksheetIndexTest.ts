// Staging check: a worksheetFile written by the Admin SDK becomes visible in GET /notes?worksheet=1 after refreshNotesIndex (no re-save).
//   cd server && npx tsx src/oak/worksheetIndexTest.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { refreshNotesIndex } from "./refreshNotesIndex";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-staging.json"), "utf8")) as { tenantId: string; tutor: { email: string; password: string } };
const key = () => { for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = l.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); } throw new Error("no key"); };
(async () => {
  const j = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: S.tutor.email, password: S.tutor.password, returnSecureToken: true }) })).json()) as { idToken: string };
  const list = async () => { const r = await fetch(`http://localhost:4000/api/learning-hub/notes?tenantId=${S.tenantId}&worksheet=1&limit=200`, { headers: { Authorization: `Bearer ${j.idToken}` } }); assert.equal(r.status, 200); const b = await r.json() as { items: { id: string; hasWorksheet?: boolean; worksheetQuizId?: string }[] }; return b.items; };
  const done = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(ROOT, "scratch/oak-worksheets/state.json"), "utf8")) as { done: Record<string, unknown> }).done));
  console.log('  finding note…'); const snap = await db.collection("hubNotes").where("tenantId", "==", S.tenantId).limit(300).get();
  const d = snap.docs.find((x) => !done.has(x.id) && !x.get("worksheetFile") && x.get("lesson"))!;
  console.log('  warming index…'); const t0 = Date.now(); await list(); console.log(`  index warm in ${Date.now() - t0}ms`);
  await d.ref.update({ worksheetFile: { name: "index test", size: 1234 }, worksheetQuizId: "quiz-x" });
  try {
    assert.ok(!(await list()).some((i) => i.id === d.id), "stale before refresh (expected: cache is per-process)"); console.log("  ok  before refresh: not visible (cached index)");
    assert.ok(await refreshNotesIndex(S.tenantId, [d.id])); const row = (await list()).find((i) => i.id === d.id);
    assert.ok(row?.hasWorksheet && row.worksheetQuizId === "quiz-x"); console.log("  ok  after refresh(ids): visible with hasWorksheet + worksheetQuizId");
  } finally {
    await d.ref.update({ worksheetFile: FieldValue.delete(), worksheetQuizId: FieldValue.delete() });
    assert.ok(await refreshNotesIndex(S.tenantId)); await list();
  }
  assert.ok(!(await list()).some((i) => i.id === d.id)); console.log("  ok  after full drop: reverted\n3 passed"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
