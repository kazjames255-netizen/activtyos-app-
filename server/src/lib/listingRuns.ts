import { db } from "../firebase";
import { periodHours, type PeriodDoc } from "./bundlePricing";
import type { BlockDoc } from "./blockDomain";

// ─────────────────────────────────────────────────────────────────────────
// Listing runs → dated blocks.
//
// The listing builder describes WHEN a listing runs as a recipe — runFrom /
// runTo, weekdays, dates off — but bookings attach to a dated run (a `blocks`
// doc) because that's where capacity and the waitlist are enforced. This
// module turns the recipe into real blocks on every listing save (the answer
// to the handoff's §0 Q1: yes, the server generates them).
//
// Sync rules:
// - generated blocks carry `auto: true`; blocks created by hand through
//   POST /api/blocks are never touched.
// - matched by startDate: existing auto blocks are updated in place, so
//   `bookedCount` and an operator's open/closed toggle survive a re-save.
// - a run that disappears from the recipe is deleted if nothing was booked,
//   otherwise closed (open=false) — bookings are never orphaned.
// - capacity comes from maxAttendees; blank/invalid means effectively
//   unlimited (9999). capacityScope "day" vs "listing" both enforce per
//   block for now — per-session counts are a later refinement.
// ─────────────────────────────────────────────────────────────────────────

export { desiredRuns, type RunRecipe, type DesiredRun } from "./listingRunsPure";
import { desiredRuns, type RunRecipe, type DesiredRun } from "./listingRunsPure";

/** Session times for a listing: its bundle's longest period, else 09:00–15:30. */
export async function sessionTimes(tenantId: string, bundleId?: string | null): Promise<{ start: string; end: string }> {
  const fallback = { start: "09:00", end: "15:30" };
  if (!bundleId) return fallback;
  const bundle = await db.collection("blockBundles").doc(bundleId).get();
  if (!bundle.exists || bundle.data()!.tenantId !== tenantId) return fallback;
  const periodIds: string[] = bundle.data()!.periodIds ?? [];
  if (!periodIds.length) return fallback;
  const snaps = await Promise.all(periodIds.map((id) => db.collection("periods").doc(id).get()));
  const periods = snaps
    .filter((s) => s.exists && s.data()!.tenantId === tenantId)
    .map((s) => s.data() as PeriodDoc);
  if (!periods.length) return fallback;
  const base = periods.reduce((a, b) => (periodHours(b) > periodHours(a) ? b : a));
  return { start: base.start, end: base.finish };
}

/** Pair each desired run with the existing auto block it continues: the block
 *  sharing the most session dates (so taking out a week's FIRST day, which
 *  moves its start date, still finds the same block), else one with the same
 *  start date. Matching by start date alone closed the booked block and opened
 *  an identical empty one — the same days sold twice (acceptance d6s8/d6s12). */
function matchRuns<T extends { id: string; data(): FirebaseFirestore.DocumentData }>(existing: T[], desired: { startDate: string; sessions: { date: string }[] }[]): Map<number, T> {
  const used = new Set<string>();
  const out = new Map<number, T>();
  desired.forEach((run, i) => {
    const want = new Set(run.sessions.map((x) => x.date));
    let best: T | undefined, bestN = 0;
    for (const d of existing) {
      if (used.has(d.id)) continue;
      const n = ((d.data().sessions ?? []) as { date: string }[]).filter((x) => want.has(x.date)).length;
      if (n > bestN) { best = d; bestN = n; }
    }
    best ??= existing.find((d) => !used.has(d.id) && d.data().startDate === run.startDate);
    if (best) { used.add(best.id); out.set(i, best); }
  });
  return out;
}

/** Dates a re-save would take off a block while children are booked on them.
 *  Saving used to replace the block's sessions outright: that day's register
 *  vanished (and its attendance marks with it — the record of who was in your
 *  care), while the bookings still listed the date. The caller refuses the
 *  save with this list, so the operator moves or cancels those bookings first. */
export async function bookedDatesDropped(
  listingId: string,
  tenantId: string,
  recipe: RunRecipe,
): Promise<{ date: string; booked: number }[]> {
  const times = await sessionTimes(tenantId, recipe.blockId);
  const desired = desiredRuns(recipe, times);
  const snap = await db.collection("blocks").where("listingId", "==", listingId).where("tenantId", "==", tenantId).get();
  const auto = snap.docs.filter((d) => d.data().auto === true);
  const matched = matchRuns(auto, desired);
  const keepOf = new Map<string, Set<string>>();
  for (const [i, d] of matched) keepOf.set(d.id, new Set(desired[i].sessions.map((x) => x.date)));
  const out: { date: string; booked: number }[] = [];
  for (const d of auto) {
    const b = d.data() as BlockDoc & { auto?: boolean };
    // A booked block left with no run would be closed while a new, empty block
    // sells its days again — so every booked date on it counts as dropped.
    const keep = keepOf.get(d.id) ?? new Set<string>();
    for (const s of b.sessions ?? []) {
      const n = Number((b.dayCounts ?? {})[s.date] ?? 0);
      if (n > 0 && !keep.has(s.date)) out.push({ date: s.date, booked: n });
    }
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** Bring the listing's auto blocks in line with its recipe. */
export async function syncListingBlocks(
  listingId: string,
  tenantId: string,
  recipe: RunRecipe,
): Promise<void> {
  const times = await sessionTimes(tenantId, recipe.blockId);
  const desired = desiredRuns(recipe, times);

  const existingSnap = await db
    .collection("blocks")
    .where("listingId", "==", listingId)
    .where("tenantId", "==", tenantId)
    .get();
  const existingAuto = existingSnap.docs.filter((d) => d.data().auto === true);
  const matched = matchRuns(existingAuto, desired);

  const batch = db.batch();
  const seen = new Set<string>();
  for (const [i, run] of desired.entries()) {
    const match = matched.get(i);
    if (match) {
      seen.add(match.id);
      batch.update(match.ref, {
        name: run.name,
        startDate: run.startDate,
        endDate: run.endDate,
        capacity: run.capacity,
        capacityScope: recipe.capacityScope ?? "listing",
        sessions: run.sessions,
        // dayCounts intentionally untouched — booked seats survive a re-save.
      });
    } else {
      const doc: BlockDoc & { auto: true } = {
        tenantId,
        listingId,
        auto: true,
        name: run.name,
        startDate: run.startDate,
        endDate: run.endDate,
        capacity: run.capacity,
        capacityScope: recipe.capacityScope ?? "listing",
        bookedCount: 0,
        dayCounts: {},
        open: true,
        sessions: run.sessions,
      };
      batch.set(db.collection("blocks").doc(), doc);
    }
  }
  for (const d of existingAuto) {
    if (seen.has(d.id)) continue;
    if ((d.data().bookedCount ?? 0) > 0) batch.update(d.ref, { open: false });
    else batch.delete(d.ref);
  }
  await batch.commit();
}
