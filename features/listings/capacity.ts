// ─────────────────────────────────────────────────────────────────────────
// How full a listing is, and how that reads to a parent. Pure functions over
// the run's blocks — no React — so the calendar, the summary tile and the
// booking engine all answer the question the same way.
// ─────────────────────────────────────────────────────────────────────────

import type { RunBlock, WizardDraft } from "./ListingWizard";

export const LOW_LEFT = 5;
export function lowAt(capacity: number | null): number {
  if (!capacity || capacity <= 0) return 1;
  return Math.max(1, Math.min(LOW_LEFT, Math.ceil(capacity / 3)));
}
import { pickPlural } from "@/lib/i18n/plural";

type TFn = (k: string, v?: Record<string, string | number>) => string;
export function capacityNote(d: WizardDraft, left: number | null, tr?: TFn, locale?: string): { text: string; tone: "calm" | "low" | "gone" } | null {
  const cap = parseInt(d.maxAttendees, 10);
  if (!Number.isFinite(cap) || !d.showSpaces) return null;
  const remaining = left ?? cap;
  if (remaining <= 0) return { text: tr ? tr("p7be.soldOutNote") : "Sold out", tone: "gone" };
  if (remaining <= lowAt(cap)) return { text: tr ? pickPlural(tr, locale ?? "en", "p7be.onlyPlaces", remaining) : `Only ${remaining} place${remaining === 1 ? "" : "s"} left that day`, tone: "low" };
  return { text: tr ? tr("p7be.lotsOfSpace") : "Lots of space left", tone: "calm" };
}
/** Places left on a date BEFORE this basket's own seats (server truth where a
 * dated run exists; day-scope uses that date's own session count, not the
 * block's busiest day). null = unlimited/unknown. */
export function rawLeftOn(
  blocks: RunBlock[] | undefined,
  iso: string,
  capacity: number | null,
  perDay: boolean,
  basketSize: number,
): number | null {
  const blk = blockOn(blocks, iso);
  if (blk) {
    const own = blk.capacityScope === "day" ? blk.sessions?.find((x) => x.date === iso)?.spotsLeft : undefined;
    return Math.max(0, own ?? blk.spotsLeft);
  }
  return capacity === null ? null : perDay ? capacity : Math.max(0, capacity - basketSize);
}
export function blockOn(blocks: RunBlock[] | undefined, iso: string): RunBlock | null {
  return blocks?.find((b) => b.startDate <= iso && iso <= b.endDate) ?? null;
}
