// One-off: schedule the 30-day photo erasure for children deleted BEFORE the rule existed, and put existing plan files into the 90-day review.
// Both are irreversible in effect (the next daily sweep deletes photos / ends provider access), so:
//   DRY RUN by default: counts only.
//   npx tsx src/childRetentionBackfill.ts
//   CONFIRM_PROJECT=<firebase project id> npx tsx src/childRetentionBackfill.ts --apply
// --apply refuses unless CONFIRM_PROJECT equals the project this process is connected to. Idempotent.
import { getApps } from "firebase-admin/app";
import "./firebase";
import { backfillAccessReviews, backfillErasureDates } from "./lib/childRetention";

(async () => {
  const apply = process.argv.includes("--apply");
  const project = String(getApps()[0]?.options.projectId ?? "");
  console.log(`project: ${project || "(unknown)"}  mode: ${apply ? "APPLY" : "dry run (add --apply to write)"}`);
  if (apply && (!project || process.env.CONFIRM_PROJECT !== project)) {
    console.error(`Refusing: set CONFIRM_PROJECT=${project || "<project id>"} to write.`);
    process.exit(1);
  }
  const kids = await backfillErasureDates(apply);
  const files = await backfillAccessReviews(apply);
  console.log(`deleted children without an erasure date: ${kids.candidates} (${kids.alreadyPastDue} already past 30 days: their photos go on the next sweep)`);
  console.log(`plan files with provider grants not yet in the 90-day review: ${files.candidates}`);
  if (!apply) console.log("Nothing was written.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
