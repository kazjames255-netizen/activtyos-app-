// Fixes broken canvas-slide pictures in shared-library lessons.
//
// promoteToSharedLibrary.ts copies a source tenant's hubTopics/hubNotes/hubQuestions/hubAssessments/
// hubFlashcards/images Firestore docs into the shared-library tenant scope — but a real slide deck's
// pictures (Oak's native canvas format) don't live in Firestore at all: they're objects in Firebase
// Storage at hubSlides/<tenantId>/<sha256>.webp (lib/slideStorage.ts), referenced from the lesson JSON
// by a bare `sid`, never a tenant path. promoteToSharedLibrary.ts never copied those objects, so a
// promoted note's deckSlides still carry sids that only exist under the SOURCE tenant's folder — but
// every read now signs them under the note's new tenantId, "shared-library", which has no such object.
// The signed URL is generated fine (GCS doesn't check existence when signing) and then 404s in the
// browser: an empty/broken image tile, on every deck-format lesson that was ever promoted.
//
// This copies every object under hubSlides/<sourceTenantId>/ to hubSlides/shared-library/ (skipping
// ones that already exist there — content-addressed by sha256, so a name collision means identical
// bytes and copying is always safe/idempotent). Source objects are left exactly as they are: this is
// an additive copy, never a move, so the source tenant's own lessons keep working unchanged.
//
//   npx tsx src/copySlideObjectsToSharedLibrary.ts <sourceTenantId> [--dry]
import "dotenv/config";
import { slideBucket } from "./lib/slideStorage";
import { SHARED_LIBRARY_TENANT_ID } from "./lib/hubCore";

const DRY = process.argv.includes("--dry");
const SRC = process.argv[2];
if (!SRC || SRC.startsWith("-") || SRC === SHARED_LIBRARY_TENANT_ID) {
  console.error("Usage: npx tsx src/copySlideObjectsToSharedLibrary.ts <sourceTenantId> [--dry]");
  process.exit(1);
}

async function run() {
  const bucket = slideBucket();
  const srcPrefix = `hubSlides/${SRC}/`;
  const dstPrefix = `hubSlides/${SHARED_LIBRARY_TENANT_ID}/`;
  console.log(`Listing ${srcPrefix}…`);
  const [files] = await bucket.getFiles({ prefix: srcPrefix });
  console.log(`  ${files.length} objects under the source tenant's folder`);
  if (!files.length) { console.log("Nothing to copy."); return; }

  console.log(`Listing ${dstPrefix} (to skip ones already copied)…`);
  const [existing] = await bucket.getFiles({ prefix: dstPrefix });
  const already = new Set(existing.map((f) => f.name.slice(dstPrefix.length)));
  console.log(`  ${already.size} already present in shared-library`);

  const todo = files.filter((f) => !already.has(f.name.slice(srcPrefix.length)));
  console.log(`${DRY ? "DRY RUN — " : ""}${todo.length} objects to copy`);
  if (DRY || !todo.length) return;

  let done = 0;
  const CONCURRENCY = 10;
  const copyOne = async (f: (typeof todo)[number]) => {
    const name = f.name.slice(srcPrefix.length);
    for (let attempt = 1; ; attempt++) {
      try { await f.copy(bucket.file(dstPrefix + name)); return; }
      catch (e) {
        if (attempt >= 5) throw e;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(copyOne));
    done += Math.min(CONCURRENCY, todo.length - i);
    if (done % 200 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
  }
  console.log(`Done. Copied ${todo.length} objects into hubSlides/${SHARED_LIBRARY_TENANT_ID}/.`);
}
run().catch((e) => { console.error(e); process.exit(1); });
