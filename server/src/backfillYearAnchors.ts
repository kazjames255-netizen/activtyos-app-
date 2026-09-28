// Automatic September rollover — one-off anchoring of year groups that were typed in by hand.
//   npx tsx src/backfillYearAnchors.ts <tenantId>[,<tenantId>…]            (dry run — counts only, writes nothing)
//   npx tsx src/backfillYearAnchors.ts <tenantId>[,…] --apply              (writes)
//   add --real to include the two real tenants (never done unprompted: they need the owner's OK)
//   add --basis=created to anchor from the row's createdAt instead of its updatedAt (default: updatedAt ?? createdAt)
// A student whose year group was set by hand (yearGroupAuto !== true, a non-empty yearGroup) and has no `yearAnchor` yet is stamped with the
// academic start year of the DATE THE ROW WAS LAST SET (updatedAt, falling back to createdAt) — not "now". Stamping "now" would leave a year set
// last August one year behind for good (it would never move up this September). From then on their year moves up each 1 Sept by itself
// (server/src/lib/hubRules.ts yearStatus).
// updatedAt is imperfect (it also moves on unrelated edits, which makes a child look "set this year" and stay put), so the DRY RUN prints how many
// rows would anchor to an EARLIER academic year (they will move up this September) vs the CURRENT one (they will not) — review that before --apply.
// Additive only: the year they show today is unchanged, nothing else on the enrolment is touched, and students already anchored, automatic
// (dob-derived), unknown (yearGroup null) or with no year are skipped. Idempotent — a second run finds nothing to do.
import { db } from "./firebase";
import { academicStartYear, anchorFor } from "./lib/hubRules";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const ids = (process.argv[2] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const APPLY = process.argv.includes("--apply");
const REAL_OK = process.argv.includes("--real");
const BASIS = process.argv.includes("--basis=created") ? "created" : "updated";
if (!ids.length || ids[0].startsWith("--")) { console.error("Usage: npx tsx src/backfillYearAnchors.ts <tenantId>[,<tenantId>…] [--apply] [--real] [--basis=created]"); process.exit(1); }

(async () => {
  const current = academicStartYear();
  let total = 0, totalEarlier = 0;
  for (const tid of ids) {
    if (REAL.has(tid) && !REAL_OK) { console.log(`${tid}: REAL tenant — skipped (needs --real and the owner's approval)`); continue; }
    const snap = await db.collection("hubEnrolments").where("tenantId", "==", tid).select("yearGroup", "yearGroupAuto", "yearAnchor", "createdAt", "updatedAt").get();
    const todo = snap.docs.filter((d) => d.get("yearGroupAuto") !== true && typeof d.get("yearGroup") === "string" && String(d.get("yearGroup")).trim() && typeof d.get("yearAnchor") !== "number");
    const planned = todo.map((d) => ({ d, anchor: anchorFor({ createdAt: d.get("createdAt"), updatedAt: d.get("updatedAt") }, new Date(), BASIS) }));
    const byAnchor = new Map<number, number>();
    for (const p of planned) byAnchor.set(p.anchor, (byAnchor.get(p.anchor) ?? 0) + 1);
    const earlier = planned.filter((p) => p.anchor < current).length;
    console.log(`${tid}: ${snap.size} enrolments · to anchor: ${todo.length} (basis ${BASIS}${APPLY ? "" : " — dry run, pass --apply to write"})`);
    console.log(`   would anchor to an EARLIER academic year (moves up this September): ${earlier} · to the CURRENT one ${current} (stays put): ${todo.length - earlier}`);
    console.log(`   by anchor year: ${[...byAnchor.entries()].sort((a, b) => a[0] - b[0]).map(([y, n]) => `${y}: ${n}`).join(" · ") || "—"}`);
    if (APPLY && planned.length) {
      const w = db.bulkWriter();
      for (const p of planned) void w.update(p.d.ref, { yearAnchor: p.anchor });
      await w.close();
    }
    total += todo.length; totalEarlier += earlier;
  }
  console.log(`${APPLY ? "anchored" : "would anchor"} ${total} student(s) (${totalEarlier} to an earlier academic year)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
