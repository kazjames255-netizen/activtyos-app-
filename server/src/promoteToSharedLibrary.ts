// Copies one REAL tenant's already-amended Learning Hub content (topics, notes, questions,
// assessments, flashcards, images) into the platform-wide SHARED LIBRARY (lib/hubCore.ts
// SHARED_LIBRARY_TENANT_ID = "shared-library"), which every tenant reads merged with their own
// content (lib/hubIndex.ts). Use this — not seedCurriculum.ts — when the goal is "make what we
// already built/edited for tenant X available everywhere", not "regenerate fresh from source".
//
//   npx tsx src/promoteToSharedLibrary.ts <sourceTenantId> [--dry]
//
// SAFETY
//  · READ-ONLY on the source tenant: only ever `.get()`s its docs, never writes, edits or
//    deletes anything there. The source tenant keeps its own copy exactly as it was.
//  · Every doc this WRITES is a brand-new document with a remapped id (`shared-<col>-<old id>`)
//    in the shared-library scope — it never reuses the source's own doc ids (which would just
//    retag their real documents into the shared tenant, corrupting their data).
//  · Idempotent: re-running with the same source recomputes the same new ids and overwrites only
//    its own earlier copies of THIS source's promotion, never another source's or a tenant's own.
//  · All internal cross-references are rewritten to the new ids: a note/question/flashcard's
//    topicId, a topic's parentTopicId, an assessment's topicIds/questionIds, a question's
//    image.id — so the copy is fully self-contained and never points back at the source tenant.
//
// SCALE — two passes, both bounded, mirroring how lib/hubIndex.ts itself reads this tenant:
//  1) an ID-MAP pass reads every doc with a LIGHT field mask (just the reference fields — never
//     a note's body, a question's prompt/options/explanation, or an image's base64) so building
//     the full old→new id map never holds heavy content in memory or times out a query the way
//     an unmasked read over ~90k questions / thousands of full lesson bodies does (see
//     lib/hubIndex.ts's own comment on exactly this).
//  2) a CONTENT pass re-fetches full docs in small `db.getAll` chunks per collection and writes
//     them immediately, so at most a few hundred full documents are ever in memory at once.
import "dotenv/config";
import { db } from "./firebase";
import { SHARED_LIBRARY_TENANT_ID } from "./lib/hubCore";
import { shardedTenantRead } from "./lib/hubIndex";

const DRY = process.argv.includes("--dry");
const SRC = process.argv[2];
if (!SRC || SRC.startsWith("-") || SRC === SHARED_LIBRARY_TENANT_ID) {
  console.error("Usage: npx tsx src/promoteToSharedLibrary.ts <sourceTenantId> [--dry]");
  process.exit(1);
}

const newId = (col: string, oldId: string) => `shared-${col}-${oldId}`;
// The only fields the id-map pass needs per collection — everything else is heavy content,
// fetched later in small chunks (step 2) and never held for the whole tenant at once.
const REF_FIELDS: Record<string, string[]> = {
  hubTopics: ["parentTopicId"],
  hubNotes: ["topicId"],
  hubQuestions: ["topicId", "image"],
  hubAssessments: ["topicIds", "questionIds"],
  hubFlashcards: ["topicId"],
};
const COLS = Object.keys(REF_FIELDS);

async function run() {
  const t = await db.collection("tenants").doc(SRC).get();
  if (!t.exists) { console.error(`No tenant ${SRC}.`); process.exit(1); }

  // ── pass 1: id map (light fields only) ──────────────────────────────────────
  console.log("Pass 1/2 — building the id map (light reads only)…");
  const refIds = new Map<string, string[]>(); // col -> ordered doc ids (drives pass 2's chunked fetch)
  const remap = new Map<string, string>(); // `${col}/${oldId}` -> newId
  for (const col of COLS) {
    const docs = await shardedTenantRead(db.collection(col), SRC, REF_FIELDS[col]);
    refIds.set(col, docs.map((d) => d.id));
    for (const d of docs) remap.set(`${col}/${d.id}`, newId(col, d.id));
    console.log(`  ${col}: ${docs.length}`);
  }
  const imgDocs = await shardedTenantRead(db.collection("images"), SRC, []);
  refIds.set("images", imgDocs.map((d) => d.id));
  for (const d of imgDocs) remap.set(`images/${d.id}`, newId("images", d.id));
  console.log(`  images: ${imgDocs.length}`);
  const mapRef = (col: string, id: unknown): unknown => (typeof id === "string" && id ? remap.get(`${col}/${id}`) ?? id : id);

  const total = [...refIds.values()].reduce((n, ids) => n + ids.length, 0);
  console.log(`${DRY ? "DRY RUN — " : ""}Promoting "${t.get("name") ?? SRC}" (${SRC}) → shared library "${SHARED_LIBRARY_TENANT_ID}": ${total} docs`, Object.fromEntries([...refIds].map(([c, ids]) => [c, ids.length])));
  if (DRY) { process.exit(0); }

  // ── pass 2: content, in small chunks, written as each chunk is fetched ──────
  console.log("Pass 2/2 — copying content…");
  let batch: { col: string; id: string; data: FirebaseFirestore.DocumentData }[] = [], bytes = 0, done = 0;
  const flush = async () => {
    if (!batch.length) return;
    const chunk = batch; batch = []; bytes = 0;
    for (let attempt = 1; ; attempt++) {
      try {
        const b = db.batch();
        for (const w of chunk) b.set(db.collection(w.col).doc(w.id), w.data);
        await b.commit();
        break;
      } catch (e) {
        if (attempt >= 5) throw e;
        const ms = 1500 * attempt;
        console.warn(`  batch commit failed (${(e as Error).message.slice(0, 100)}) — retry ${attempt}/4 in ${ms}ms`);
        await new Promise((r) => setTimeout(r, ms));
      }
    }
    done += chunk.length;
    console.log(`  ${done}/${total}`);
  };
  const push = async (col: string, id: string, data: FirebaseFirestore.DocumentData, size: number) => {
    if (batch.length >= 400 || bytes + size > 4_000_000) await flush();
    batch.push({ col, id: newId(col, id), data }); bytes += size;
  };

  const CHUNK = 200;
  const forEachChunk = async (col: string, fn: (snap: FirebaseFirestore.DocumentSnapshot) => Promise<void>) => {
    const ids = refIds.get(col)!;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const refs = ids.slice(i, i + CHUNK).map((id) => db.collection(col).doc(id));
      for (const s of await db.getAll(...refs)) if (s.exists) await fn(s);
    }
  };

  await forEachChunk("hubTopics", async (s) => {
    const x = s.data()!;
    await push("hubTopics", s.id, { ...x, tenantId: SHARED_LIBRARY_TENANT_ID, franchiseId: null, parentTopicId: mapRef("hubTopics", x.parentTopicId) }, 500);
  });
  await forEachChunk("hubNotes", async (s) => {
    const x = s.data()!;
    await push("hubNotes", s.id, { ...x, tenantId: SHARED_LIBRARY_TENANT_ID, franchiseId: null, topicId: mapRef("hubTopics", x.topicId) }, Buffer.byteLength(JSON.stringify(x)));
  });
  await forEachChunk("hubQuestions", async (s) => {
    const x = s.data()!;
    const image = x.image && typeof x.image === "object" && x.image.id ? { ...x.image, id: mapRef("images", x.image.id) } : (x.image ?? null);
    await push("hubQuestions", s.id, { ...x, tenantId: SHARED_LIBRARY_TENANT_ID, franchiseId: null, topicId: mapRef("hubTopics", x.topicId), image }, 800);
  });
  await forEachChunk("hubAssessments", async (s) => {
    const x = s.data()!;
    await push("hubAssessments", s.id, {
      ...x, tenantId: SHARED_LIBRARY_TENANT_ID, franchiseId: null,
      topicIds: ((x.topicIds ?? []) as string[]).map((tid) => mapRef("hubTopics", tid)), questionIds: ((x.questionIds ?? []) as string[]).map((qid) => mapRef("hubQuestions", qid)),
    }, 1500);
  });
  await forEachChunk("hubFlashcards", async (s) => {
    const x = s.data()!;
    await push("hubFlashcards", s.id, { ...x, tenantId: SHARED_LIBRARY_TENANT_ID, franchiseId: null, topicId: mapRef("hubTopics", x.topicId) }, 500);
  });
  await forEachChunk("images", async (s) => {
    const x = s.data()!;
    await push("images", s.id, { ...x, tenantId: SHARED_LIBRARY_TENANT_ID }, String(x.b64 ?? "").length);
  });
  await flush();
  console.log(`Done. Verify with: npx tsx -e "import('./src/lib/hubIndex.ts').then(async m => console.log((await m.tenantTopics('${SHARED_LIBRARY_TENANT_ID}')).length))"`);
}
run().catch((e) => { console.error(e); process.exit(1); });
