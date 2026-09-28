// Exhaustive verification for the shared-library slide-picture fix (copySlideObjectsToSharedLibrary.ts).
// Doesn't sample or spot-check: reads every shared-library note's slides/deckSlides, collects every
// canvas `img` element's `sid`, and checks EACH ONE actually exists at hubSlides/shared-library/<sid> —
// the exact thing the browser needs to render it. Reports any note that still has a dangling reference,
// by id and title, so each one can be opened and looked at directly if any turn up.
//
// Reads in bounded chunks (mirroring promoteToSharedLibrary.ts's own "content pass"), never holding more
// than CHUNK full lesson bodies in memory at once — the first version of this script held all ~7,900 full
// docs (some with large deckSlides) in memory simultaneously and OOM'd a 4GB heap.
import "dotenv/config";
import { db } from "./firebase";
import { slideBucket, SID } from "./lib/slideStorage";
import { SHARED_LIBRARY_TENANT_ID } from "./lib/hubCore";
import { shardedTenantRead } from "./lib/hubIndex";

type Slides = Record<string, unknown>[];
function collectSids(slides: unknown, into: Set<string>) {
  if (!Array.isArray(slides)) return;
  for (const s of slides as Slides) {
    if (!s || typeof s !== "object") continue;
    const blocks = (s as { blocks?: unknown }).blocks;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      const o = b as { t?: unknown; els?: unknown };
      if (o?.t !== "canvas" || !Array.isArray(o.els)) continue;
      for (const e of o.els) {
        const x = e as { k?: unknown; sid?: unknown };
        if (x?.k === "img" && typeof x.sid === "string" && SID.test(x.sid)) into.add(x.sid);
      }
    }
  }
}

async function run() {
  console.log(`Listing hubSlides/${SHARED_LIBRARY_TENANT_ID}/ (the copy's destination)…`);
  const bucket = slideBucket();
  const dstPrefix = `hubSlides/${SHARED_LIBRARY_TENANT_ID}/`;
  const [files] = await bucket.getFiles({ prefix: dstPrefix });
  const present = new Set(files.map((f) => f.name.slice(dstPrefix.length)));
  console.log(`  ${present.size} objects present`);

  console.log("Getting shared-library note ids (light read, sharded)…");
  const idDocs = await shardedTenantRead(db.collection("hubNotes"), SHARED_LIBRARY_TENANT_ID, []);
  const ids = idDocs.map((d) => d.id);
  console.log(`  ${ids.length} notes`);

  let notesWithPics = 0, totalRefs = 0, danglingRefs = 0, scanned = 0;
  const badNotes: { id: string; title: string; dangling: string[] }[] = [];
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const refs = ids.slice(i, i + CHUNK).map((id) => db.collection("hubNotes").doc(id));
    const snaps = await db.getAll(...refs, { fieldMask: ["title", "lesson"] } as never);
    for (const s of snaps) {
      if (!s.exists) continue;
      scanned++;
      const lesson = s.get("lesson");
      if (!lesson || typeof lesson !== "object") continue;
      const sids = new Set<string>();
      collectSids((lesson as { slides?: unknown }).slides, sids);
      collectSids((lesson as { deckSlides?: unknown }).deckSlides, sids);
      if (!sids.size) continue;
      notesWithPics++;
      totalRefs += sids.size;
      const dangling = [...sids].filter((sid) => !present.has(sid));
      if (dangling.length) { danglingRefs += dangling.length; badNotes.push({ id: s.id, title: String(s.get("title") ?? ""), dangling }); }
    }
    if (scanned % 1000 < CHUNK) console.log(`  ${Math.min(i + CHUNK, ids.length)}/${ids.length} fetched…`);
  }

  console.log("\n=== RESULTS ===");
  console.log(`notes scanned: ${scanned}`);
  console.log(`notes with at least one slide picture: ${notesWithPics}`);
  console.log(`total picture references: ${totalRefs}`);
  console.log(`dangling references (sid with no object in hubSlides/${SHARED_LIBRARY_TENANT_ID}/): ${danglingRefs}`);
  console.log(`notes affected: ${badNotes.length}`);
  if (badNotes.length) {
    console.log("\nAffected notes (first 30):");
    for (const b of badNotes.slice(0, 30)) console.log(` - ${b.id} | ${b.title} | ${b.dangling.length} dangling`);
  }
}
run().catch((e) => { console.error(e); process.exit(1); });
