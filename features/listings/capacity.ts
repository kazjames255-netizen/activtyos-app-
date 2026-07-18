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
export function capacityNote(d: WizardDraft, left: number | null): { text: string; tone: "calm" | "low" | "gone" } | null {
  const cap = parseInt(d.maxAttendees, 10);
  if (!Number.isFinite(cap) || !d.showSpaces) return null;
  const remaining = left ?? cap;
  if (remaining <= 0) return { text: "Sold out", tone: "gone" };
  if (remaining <= lowAt(cap)) return { text: `Only ${remaining} place${remaining === 1 ? "" : "s"} left that day`, tone: "low" };
  return { text: "Lots of space left", tone: "calm" };
}
export function blockOn(blocks: RunBlock[] | undefined, iso: string): RunBlock | null {
  return blocks?.find((b) => b.startDate <= iso && iso <= b.endDate) ?? null;
}
