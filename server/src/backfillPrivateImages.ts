// One-off: mark every image that is a child's photo or an injury/safeguarding
// attachment as PRIVATE, so /api/images serves it only on a signed, expiring
// link (routes/uploads.ts). Uploads since 12 Sept are flagged when they're made;
// this catches the ones before that, which are still reachable by bare id.
//
// Dry run by default — prints what it would change. Add --apply to write.
//   npx tsx src/backfillPrivateImages.ts            (dry run)
//   npx tsx src/backfillPrivateImages.ts --apply
//
// Idempotent. Touches only the `private` flag on `images` docs.
import { db } from "./firebase";

const APPLY = process.argv.includes("--apply");
const idOf = (u: unknown): string | null => {
  if (typeof u !== "string") return null;
  const m = u.match(/\/api\/images\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};

async function run() {
  const ids = new Set<string>();
  const [moments, incidents] = await Promise.all([
    db.collection("moments").get(),
    db.collection("incidents").get(),
  ]);
  for (const d of moments.docs) {
    const m = d.data() as { photoUrl?: string; photoType?: string };
    const id = idOf(m.photoUrl);
    if (id) ids.add(id);
  }
  for (const d of incidents.docs) {
    const r = d.data() as { photoUrl?: string; attachments?: string[] };
    for (const u of [r.photoUrl, ...(r.attachments ?? [])]) {
      const id = idOf(u);
      if (id) ids.add(id);
    }
  }
  console.log(`${ids.size} image(s) referenced by moments/incidents.`);

  let already = 0, missing = 0, toMark = 0;
  const list = [...ids];
  for (let i = 0; i < list.length; i += 300) {
    const snaps = await db.getAll(...list.slice(i, i + 300).map((id) => db.collection("images").doc(id)));
    const batch = db.batch();
    let n = 0;
    for (const s of snaps) {
      if (!s.exists) { missing++; continue; }
      if (s.get("private") === true) { already++; continue; }
      toMark++;
      if (APPLY) { batch.update(s.ref, { private: true }); n++; }
    }
    if (APPLY && n) await batch.commit();
  }
  console.log(`${already} already private, ${missing} missing, ${toMark} ${APPLY ? "marked private" : "WOULD be marked private (re-run with --apply)"}.`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
