import "dotenv/config";
import { db } from "./firebase";
import { shardedTenantRead } from "./lib/hubIndex";

const SHARED = "shared-library";

async function run() {
  console.log("Collecting shared-library images/questions/flashcards/topics ids…");
  const [images, questions, flashcards, topics] = await Promise.all([
    shardedTenantRead(db.collection("images"), SHARED, []),
    shardedTenantRead(db.collection("hubQuestions"), SHARED, []),
    shardedTenantRead(db.collection("hubFlashcards"), SHARED, []),
    shardedTenantRead(db.collection("hubTopics"), SHARED, []),
  ]);
  const imgIds = new Set(images.map((d) => d.id));
  const qIds = new Set(questions.map((d) => d.id));
  const fcIds = new Set(flashcards.map((d) => d.id));
  const topicIds = new Set(topics.map((d) => d.id));
  console.log(`  images ${imgIds.size} · questions ${qIds.size} · flashcards ${fcIds.size} · topics ${topicIds.size}`);

  const noteIds = (await shardedTenantRead(db.collection("hubNotes"), SHARED, [])).map((d) => d.id);
  console.log(`Scanning ${noteIds.length} shared notes for dangling refs / malformed slides…`);

  let scanned = 0, badTopic = 0, brokenImgRefs = 0, brokenQRefs = 0, malformedSlides = 0, emptyBlocks = 0, badJsonNotes = 0;
  const CHUNK = 150;
  const idPattern = /(?:oak-)?[A-Za-z0-9]{20}-[A-Za-z0-9-]+/g; // generic-ish leftover-id shape, informational only
  const samples: string[] = [];

  for (let i = 0; i < noteIds.length; i += CHUNK) {
    const ids = noteIds.slice(i, i + CHUNK);
    const snaps = await db.getAll(...ids.map((id) => db.collection("hubNotes").doc(id)), { fieldMask: ["lesson", "topicId", "title"] });
    for (const s of snaps) {
      scanned++;
      const topicId = s.get("topicId");
      if (topicId && !topicIds.has(topicId)) badTopic++;
      const lesson = s.get("lesson");
      if (!lesson || typeof lesson !== "object") continue;
      let str: string;
      try { str = JSON.stringify(lesson); } catch { badJsonNotes++; continue; }
      const slides = (lesson as any).slides;
      if (Array.isArray(slides)) {
        for (const sl of slides) {
          if (!sl || typeof sl !== "object") { malformedSlides++; continue; }
          if (!Array.isArray(sl.blocks) || sl.blocks.length === 0) emptyBlocks++;
          const img = sl.image;
          if (img && typeof img === "object" && typeof img.id === "string" && !imgIds.has(img.id)) {
            brokenImgRefs++;
            if (samples.length < 25) samples.push(`${s.id} slide image ${img.id}`);
          }
        }
      }
      const wids: unknown = (lesson as any).warmupQuestionIds;
      if (Array.isArray(wids)) {
        for (const qid of wids) {
          if (typeof qid === "string" && !qIds.has(qid)) {
            brokenQRefs++;
            if (samples.length < 25) samples.push(`${s.id} warmup question ${qid}`);
          }
        }
      }
    }
    if ((i / CHUNK) % 10 === 0) console.log(`  ${Math.min(i + CHUNK, noteIds.length)}/${noteIds.length} scanned…`);
  }
  console.log("\n=== RESULTS ===");
  console.log(`scanned ${scanned} notes`);
  console.log(`bad topicId refs: ${badTopic}`);
  console.log(`malformed slide objects: ${malformedSlides}`);
  console.log(`slides with empty/missing blocks: ${emptyBlocks}`);
  console.log(`slide image refs pointing at nonexistent images: ${brokenImgRefs}`);
  console.log(`warmup question refs pointing at nonexistent questions: ${brokenQRefs}`);
  console.log(`notes whose lesson field failed to stringify: ${badJsonNotes}`);
  console.log("\nsamples:", samples.slice(0, 25));
}
run().catch((e) => { console.error(e); process.exit(1); });
