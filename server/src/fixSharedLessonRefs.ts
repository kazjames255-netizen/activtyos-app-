// Repairs embedded old-tenant doc-id references left inside promoted shared-library lesson blobs.
//
// `promoteToSharedLibrary.ts` remapped every doc's own id and its OBVIOUS top-level cross-refs
// (a note/question/flashcard's topicId, a question's image.id) to the shared-library scope — but
// never touched ids embedded deep inside a note's `lesson` field itself (slide image ids, warm-up
// question ids, etc., baked into that JSON blob as plain strings). Those still point at the
// SOURCE tenant's original doc ids, which don't exist under those ids in the shared scope, so
// slide images/interactive elements referencing them break (confirmed live: broken image icons,
// scrambled slide layout on a real promoted lesson).
//
//   npx tsx src/fixSharedLessonRefs.ts [--dry]
//
// SAFETY
//  · READ-ONLY on the source tenant (7jG2XO3cOD3VtoL8YfFY) — only ever `.get()`s its docs.
//  · Only ever writes the `lesson` FIELD of shared-library hubNotes docs, via `.update({lesson})`
//    — never touches any other field, never a full-document overwrite.
//  · A note is only written if a real, confirmed old→new id substitution was made in it.
import "dotenv/config";
import { db } from "./firebase";
import { shardedTenantRead } from "./lib/hubIndex";

const DRY = process.argv.includes("--dry");
const SRC = "7jG2XO3cOD3VtoL8YfFY";
const SHARED = "shared-library";
const COLS = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubFlashcards"] as const;
const newId = (col: string, oldId: string) => `shared-${col}-${oldId}`;

async function run() {
  console.log("Pass 1/3 — inventory the source tenant's own doc ids (sharded, light reads)…");
  const oldToNew = new Map<string, string>();
  for (const col of COLS) {
    const docs = await shardedTenantRead(db.collection(col), SRC, []);
    for (const d of docs) oldToNew.set(d.id, newId(col, d.id));
    console.log(`  ${col}: ${docs.length}`);
  }
  const imgDocs = await shardedTenantRead(db.collection("images"), SRC, []);
  for (const d of imgDocs) oldToNew.set(d.id, newId("images", d.id));
  console.log(`  images: ${imgDocs.length}`);
  console.log(`  total old ids indexed: ${oldToNew.size}`);

  console.log("Pass 2/3 — listing shared-library notes to check…");
  const noteIds = (await shardedTenantRead(db.collection("hubNotes"), SHARED, [])).map((d) => d.id);
  console.log(`  ${noteIds.length} shared-library notes`);

  console.log(`Pass 3/3 — scanning + ${DRY ? "(dry run) would fix" : "fixing"} each note's lesson field…`);
  let scanned = 0, fixed = 0, refsFixed = 0, badJson = 0;
  const CHUNK = 150;
  // Oak-style doc ids look like `oak-<tenant>-<rest>`; also catch the bare `<tenant>-<rest>` form
  // (seen once for real with the `oak-` prefix missing from the embedded string).
  const idPattern = new RegExp(`(?:oak-)?${SRC}-[A-Za-z0-9-]+`, "g");

  for (let i = 0; i < noteIds.length; i += CHUNK) {
    const ids = noteIds.slice(i, i + CHUNK);
    const snaps = await db.getAll(...ids.map((id) => db.collection("hubNotes").doc(id)), { fieldMask: ["lesson"] });
    for (const s of snaps) {
      scanned++;
      const lesson = s.get("lesson");
      if (!lesson) continue;
      let str = JSON.stringify(lesson);
      const candidates = [...new Set([...str.matchAll(idPattern)].map((m) => m[0]))].sort((a, b) => b.length - a.length);
      let localFixes = 0;
      for (const cand of candidates) {
        let hit = oldToNew.get(cand);
        if (!hit) {
          const alt = cand.startsWith("oak-") ? cand.slice(4) : `oak-${cand}`;
          hit = oldToNew.get(alt);
        }
        if (hit && str.includes(cand)) {
          const before = str;
          str = str.split(cand).join(hit);
          if (str !== before) localFixes++;
        }
      }
      if (localFixes > 0) {
        let parsed: unknown;
        try { parsed = JSON.parse(str); }
        catch (e) { badJson++; console.error(`  SKIP ${s.id}: fix produced invalid JSON (${(e as Error).message})`); continue; }
        fixed++; refsFixed += localFixes;
        if (!DRY) await s.ref.update({ lesson: parsed });
      }
    }
    console.log(`  ${Math.min(i + CHUNK, noteIds.length)}/${noteIds.length} scanned — fixed so far: ${fixed} (${refsFixed} references)`);
  }
  console.log(`${DRY ? "DRY RUN — nothing written. " : ""}Done. Scanned ${scanned} notes · fixed ${fixed} · ${refsFixed} references repaired${badJson ? ` · ${badJson} skipped (bad JSON after fix)` : ""}.`);
}
run().catch((e) => { console.error(e); process.exit(1); });
