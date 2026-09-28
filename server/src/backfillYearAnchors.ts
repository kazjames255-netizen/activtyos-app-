// Automatic September rollover — one-off anchoring of year groups that were typed in by hand.
//   npx tsx src/backfillYearAnchors.ts <tenantId>[,<tenantId>…]            (dry run — counts only, writes nothing)
//   npx tsx src/backfillYearAnchors.ts <tenantId>[,…] --apply              (writes)
//   add --real to include the two real tenants (never done unprompted: they need the owner's OK)
// A student whose year group was set by hand (yearGroupAuto !== true, a non-empty yearGroup) and has no `yearAnchor` yet is stamped with
// the CURRENT academic start year, so from now on their year moves up each 1 Sept by itself (server/src/lib/hubRules.ts yearStatus).
// Additive only: the year they show today is unchanged, nothing else on the enrolment is touched, and students already anchored, automatic
// (dob-derived), unknown (yearGroup null) or with no year are skipped. Idempotent — a second run finds nothing to do.
import { db } from "./firebase";
import { academicStartYear } from "./lib/hubRules";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const ids = (process.argv[2] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const APPLY = process.argv.includes("--apply");
const REAL_OK = process.argv.includes("--real");
if (!ids.length || ids[0].startsWith("--")) { console.error("Usage: npx tsx src/backfillYearAnchors.ts <tenantId>[,<tenantId>…] [--apply] [--real]"); process.exit(1); }

(async () => {
  const anchor = academicStartYear();
  let total = 0;
  for (const tid of ids) {
    if (REAL.has(tid) && !REAL_OK) { console.log(`${tid}: REAL tenant — skipped (needs --real and the owner's approval)`); continue; }
    const snap = await db.collection("hubEnrolments").where("tenantId", "==", tid).select("yearGroup", "yearGroupAuto", "yearAnchor").get();
    const todo = snap.docs.filter((d) => d.get("yearGroupAuto") !== true && typeof d.get("yearGroup") === "string" && String(d.get("yearGroup")).trim() && typeof d.get("yearAnchor") !== "number");
    console.log(`${tid}: ${snap.size} enrolments · to anchor at ${anchor}: ${todo.length}${APPLY ? "" : " (dry run — pass --apply to write)"}`);
    if (APPLY && todo.length) {
      const w = db.bulkWriter();
      for (const d of todo) void w.update(d.ref, { yearAnchor: anchor });
      await w.close();
    }
    total += todo.length;
  }
  console.log(`${APPLY ? "anchored" : "would anchor"} ${total} student(s)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
