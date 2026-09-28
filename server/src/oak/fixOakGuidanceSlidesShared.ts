// Real fix for the shared-library scope, reusing fixOakGuidanceSlides.ts's exact detection logic (body-text patterns,
// not slide.title — the title varies or is blank, which is why an earlier title-only filter in learningHub.ts never
// caught these). That script's own tenant-scoped query only matches note ids `oak-<tenantId>-...` with `tenantId ==
// <that tenant>`; shared-library notes have `tenantId == "shared-library"` but keep their ORIGINAL id shape
// (`shared-hubNotes-oak-<sourceTenantId>-n-...`), so that script's id-prefix range never matches them, and — a real
// bug in that script's own query — the range was `>= P` AND `< P` (the same string), which matches zero documents
// even for its own original-tenant target (missing the usual `+ ""` high-sentinel on the upper bound).
//
// This uses shardedTenantRead (safe at this tenant's ~7,900-doc scale — a plain `.get()` here times out, hit
// repeatedly this session) to get every shared-library note id, then rewrites `lesson.deckSlides` in bounded chunks.
//
//   npx tsx src/oak/fixOakGuidanceSlidesShared.ts [--dry]
import "dotenv/config";
import { db } from "../firebase";
import { shardedTenantRead } from "../lib/hubIndex";
import { SHARED_LIBRARY_TENANT_ID } from "../lib/hubCore";

const DRY = process.argv.includes("--dry");

// Identical patterns to fixOakGuidanceSlides.ts.
const isOakTeacherGuidance = (t: string) => /oak.?s lessons? (?:are|is) structured around/i.test(t) || /oak.?s lesson structure/i.test(t);
const isOakClipsGuidance = (t: string) => /teacher guidance/i.test(t) && /to help you teach this lesson, we/i.test(t);
const isOakAttribution = (t: string) => /oak national academy/i.test(t) && /©|open government licen[cs]e|licensed under/i.test(t);
const isHowToUseOak = (t: string) => /how to use oak lessons/i.test(t);

function slideText(slide: unknown): string {
  const s = slide as { blocks?: { els?: { k?: string; paras?: { runs?: { t?: string }[] }[] }[] }[] } | null | undefined;
  const texts: string[] = [];
  for (const b of s?.blocks ?? []) for (const e of b.els ?? []) if (e.k === "text") for (const p of e.paras ?? []) for (const r of p.runs ?? []) if (r.t) texts.push(r.t);
  return texts.join(" ").replace(/\s+/g, " ").trim();
}
function isOakGuidanceSlide(slide: unknown): { drop: boolean; why?: string } {
  const t = slideText(slide);
  if (!t) return { drop: false };
  if (isHowToUseOak(t)) return { drop: true, why: "how-to-use-oak-lessons" };
  if (isOakTeacherGuidance(t)) return { drop: true, why: "oak-teacher-guidance" };
  if (isOakClipsGuidance(t)) return { drop: true, why: "oak-clips-guidance" };
  if (isOakAttribution(t)) return { drop: true, why: "attribution" };
  return { drop: false };
}

async function run() {
  console.log("Getting shared-library note ids (light, sharded)...");
  const idDocs = await shardedTenantRead(db.collection("hubNotes"), SHARED_LIBRARY_TENANT_ID, []);
  const ids = idDocs.map((d) => d.id);
  console.log(`  ${ids.length} notes`);

  let scanned = 0, withDeck = 0, docsFixed = 0, slidesRemoved = 0;
  const byWhy: Record<string, number> = {};
  const CHUNK = 150;
  let batch = db.batch();
  let inBatch = 0;
  // Retry-with-backoff, AWAITED before moving on — the previous version pushed `batch.commit()` into an array and only
  // awaited it later via `Promise.all`, so a rejection (a transient DEADLINE_EXCEEDED under this session's heavy
  // concurrent Firestore load) became an unhandled-rejection crash well before that final await ever ran. Matches
  // promoteToSharedLibrary.ts's own commit-retry pattern.
  const flushBatch = async () => {
    if (!inBatch) return;
    const b = batch; batch = db.batch(); inBatch = 0;
    for (let attempt = 1; ; attempt++) {
      try { await b.commit(); return; }
      catch (e) {
        if (attempt >= 6) throw e;
        const ms = 1500 * attempt;
        console.warn(`  batch commit failed (${(e as Error).message.slice(0, 100)}) — retry ${attempt}/5 in ${ms}ms`);
        await new Promise((r) => setTimeout(r, ms));
      }
    }
  };

  for (let i = 0; i < ids.length; i += CHUNK) {
    const refs = ids.slice(i, i + CHUNK).map((id) => db.collection("hubNotes").doc(id));
    const snaps = await db.getAll(...refs, { fieldMask: ["lesson.deckSlides"] } as never);
    for (const d of snaps) {
      if (!d.exists) continue;
      scanned++;
      const slides = (d.get("lesson")?.deckSlides ?? []) as unknown[];
      if (!Array.isArray(slides) || !slides.length) continue;
      withDeck++;
      const kept: unknown[] = [];
      let removedHere = 0;
      for (const s of slides) {
        const verdict = isOakGuidanceSlide(s);
        if (verdict.drop) { removedHere++; byWhy[verdict.why!] = (byWhy[verdict.why!] ?? 0) + 1; }
        else kept.push(s);
      }
      if (!removedHere) continue;
      docsFixed++; slidesRemoved += removedHere;
      console.log(`  fix ${d.id} · removed ${removedHere} slide(s) (${slides.length} -> ${kept.length})`);
      if (!DRY) {
        batch.update(d.ref, { "lesson.deckSlides": kept });
        inBatch++;
        if (inBatch >= 100) await flushBatch();
      }
    }
    if (i % 1500 < CHUNK) console.log(`  ${Math.min(i + CHUNK, ids.length)}/${ids.length} scanned...`);
  }
  await flushBatch();
  console.log(`\n${DRY ? "DRY RUN — " : ""}scanned ${scanned} · with deck ${withDeck} · docs fixed ${docsFixed} · slides removed ${slidesRemoved}`);
  console.log(`by reason: ${JSON.stringify(byWhy)}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
