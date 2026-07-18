import { db } from "../firebase";
import { periodHours, type PeriodDoc } from "./bundlePricing";
import type { BlockDoc, Session } from "./blockDomain";

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

export interface RunRecipe {
  runFrom?: string;
  runTo?: string;
  blockMode?: "weekly" | "custom";
  days?: number[]; // 0=Sun … 6=Sat
  datesOff?: string[];
  maxAttendees?: string | number;
  blockId?: string | null; // block bundle → session times come from its periods
}

const UNLIMITED = 9999;

function genDates(from: string, to: string, days: number[], datesOff: string[]): string[] {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return [];
  const off = new Set(datesOff);
  const out: string[] = [];
  let guard = 0;
  while (d <= end && guard++ < 400) {
    const iso = d.toISOString().slice(0, 10);
    if (days.includes(d.getUTCDay()) && !off.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

// "2026-07-20", "2026-07-24" → "20 – 24 Jul 2026" / "28 Jul – 1 Aug 2026".
function rangeLabel(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const yr = t.getUTCFullYear();
  if (from === to) return `${day(f)} ${mon(f)} ${yr}`;
  if (mon(f) === mon(t) && f.getUTCFullYear() === t.getUTCFullYear())
    return `${day(f)} – ${day(t)} ${mon(t)} ${yr}`;
  return `${day(f)} ${mon(f)} – ${day(t)} ${mon(t)} ${yr}`;
}

export interface DesiredRun {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  sessions: Session[];
}

/** The dated runs a listing's recipe describes (empty when it has none). */
export function desiredRuns(recipe: RunRecipe, times: { start: string; end: string }): DesiredRun[] {
  const { runFrom, runTo } = recipe;
  if (!runFrom || !runTo) return [];
  const days = recipe.days?.length ? recipe.days : [1, 2, 3, 4, 5];
  const dates = genDates(runFrom, runTo, days, recipe.datesOff ?? []);
  if (!dates.length) return [];
  const capacity =
    Math.floor(Number(recipe.maxAttendees)) > 0 ? Math.floor(Number(recipe.maxAttendees)) : UNLIMITED;
  const toRun = (ds: string[], name: string): DesiredRun => ({
    name,
    startDate: ds[0],
    endDate: ds[ds.length - 1],
    capacity,
    sessions: ds.map((date) => ({ date, start: times.start, end: times.end })),
  });

  if (recipe.blockMode === "custom") return [toRun(dates, rangeLabel(dates[0], dates[dates.length - 1]))];

  // Weekly: one block per calendar week (Monday-keyed), numbered in order.
  const weeks = new Map<string, string[]>();
  for (const iso of dates) {
    const k = mondayOf(iso);
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k)!.push(iso);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, ds], i) => toRun(ds, `Week ${i + 1} · ${rangeLabel(ds[0], ds[ds.length - 1])}`));
}

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
  const byStart = new Map(existingAuto.map((d) => [d.data().startDate as string, d]));

  const batch = db.batch();
  const seen = new Set<string>();
  for (const run of desired) {
    const match = byStart.get(run.startDate);
    if (match) {
      seen.add(match.id);
      batch.update(match.ref, {
        name: run.name,
        endDate: run.endDate,
        capacity: run.capacity,
        sessions: run.sessions,
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
        bookedCount: 0,
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
