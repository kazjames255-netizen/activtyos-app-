import { toMinutes, ukNow } from "./scheduler";

// ─────────────────────────────────────────────────────────────────────────
// Meal ordering cut-offs. A provider decides how late a family may still
// order a meal for a given day (mealConfig.cutoffWhen/cutoffTime), falling
// back to the tenant's central default (settings.meals), and finally to
// "off" (order any time up to the day itself). Shared by the parent
// meal-days feed (to show the window + gate the button) and the order
// endpoint (to enforce it) so the two never disagree.
// ─────────────────────────────────────────────────────────────────────────

export type CutoffWhen = "off" | "same" | "prev" | "2days";

const OFFSET_DAYS: Record<Exclude<CutoffWhen, "off">, number> = { same: 0, prev: 1, "2days": 2 };
const DAY_MS = 86_400_000;

export function normaliseWhen(v: unknown): CutoffWhen {
  return v === "same" || v === "prev" || v === "2days" ? v : "off";
}

// Resolve a listing's effective cut-off: its own mealConfig, else the tenant
// default, else anytime.
export function resolveCutoff(
  listing: { cutoffWhen?: unknown; cutoffTime?: unknown } | undefined,
  fallback: { cutoffWhen?: unknown; cutoffTime?: unknown } | undefined,
): { when: CutoffWhen; time: string } {
  const rawWhen = listing?.cutoffWhen ?? fallback?.cutoffWhen;
  const when = normaliseWhen(rawWhen);
  const time = (typeof listing?.cutoffTime === "string" && listing.cutoffTime) || (typeof fallback?.cutoffTime === "string" && fallback.cutoffTime) || "08:00";
  return { when, time };
}

// The absolute deadline (ms) after which ordering for `date` is closed, or
// null when there is no timed cut-off ("off" = order any time before the day).
export function deadlineMs(when: CutoffWhen, time: string, date: string): number | null {
  if (when === "off") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const mins = toMinutes(time) ?? 8 * 60;
  return Date.parse(`${date}T00:00:00Z`) - OFFSET_DAYS[when] * DAY_MS + mins * 60_000;
}

// Can a family still order a meal for `date` under this cut-off, as of now?
// Past days are always closed; "off" allows any not-yet-past day.
export function canOrderMeal(when: CutoffWhen, time: string, date: string, now = ukNow()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (date < now.date) return false;
  const dl = deadlineMs(when, time, date);
  if (dl === null) return true;
  const nowAbs = Date.parse(`${now.date}T00:00:00Z`) + now.minutes * 60_000;
  return nowAbs < dl;
}

// A short human label for the ordering window, shown to parents.
export function cutoffLabel(when: CutoffWhen, time: string): string {
  switch (when) {
    case "same": return `Order by ${time} on the day`;
    case "prev": return `Order by ${time} the day before`;
    case "2days": return `Order by ${time}, 2 days before`;
    default: return "Order any time before the day";
  }
}
