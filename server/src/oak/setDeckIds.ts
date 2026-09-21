// Set `lesson.oakDeck` (the id of Oak's real Google Slides deck) on every imported Oak lesson of ONE tenant, without a re-import.
//   cd server && npx tsx src/oak/setDeckIds.ts <tenantId> [--apply]      (dry run without --apply)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../scratch/oak-raw");
const tenantId = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!tenantId) { console.error("usage: setDeckIds.ts <tenantId> [--apply]"); process.exit(1); }

const decks = new Map<string, string>(); // `${unitSlug}|${lessonSlug}` → Google Slides id
for (const dir of fs.readdirSync(RAW)) {
  if (dir.startsWith("_")) continue;
  const full = path.join(RAW, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith(".json")) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(full, f), "utf8")) as Record<string, unknown>;
      const id = String(o.presentationUrl ?? "").match(/\/presentation\/d\/([A-Za-z0-9_-]{20,80})/)?.[1];
      if (id && o.unitSlug && o.lessonSlug) decks.set(`${o.unitSlug}|${o.lessonSlug}`, id);
    } catch { /* skip unreadable */ }
  }
}
console.log(`raw lessons with a deck: ${decks.size}`);

(async () => {
  const snap = await db.collection("hubNotes").where("tenantId", "==", tenantId).select("lesson.unitSlug", "lesson.lessonSlug", "lesson.oakDeck", "imported").get();
  let match = 0, already = 0, missing = 0, batchN = 0;
  let batch = db.batch();
  for (const d of snap.docs) {
    const u = d.get("lesson.unitSlug"), l = d.get("lesson.lessonSlug");
    if (!u || !l) continue;
    const id = decks.get(`${u}|${l}`);
    if (!id) { missing++; continue; }
    if (d.get("lesson.oakDeck") === id) { already++; continue; }
    match++;
    if (APPLY) { batch.update(d.ref, { "lesson.oakDeck": id }); if (++batchN % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  }
  if (APPLY && batchN % 400 !== 0) await batch.commit();
  console.log(`${APPLY ? "set" : "would set"} ${match} · already set ${already} · lessons with no deck ${missing} · notes scanned ${snap.size}`);
})().catch((e) => { console.error(e); process.exit(1); });
