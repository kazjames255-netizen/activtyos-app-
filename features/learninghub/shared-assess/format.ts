import type { HubSettings } from "@/lib/hubConfig";

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDateShort = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDateShort(iso);
}

export interface Tone { fill: string; soft: string; ink: string }

// Band colours: the lowest band is warm (gold — "keep going", never alarm-red),
// the middle takes the tenant's brand, the top is green. Position in the
// tenant's own band list picks the tone, so renamed / extra bands still work.
// Every tone is paired with the band's LABEL, so colour is never the only cue.
const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };
const GREEN: Tone = { fill: "var(--green)", soft: "var(--green-soft)", ink: "color-mix(in srgb, var(--green) 50%, var(--ink))" };
export const NEUTRAL: Tone = { fill: "var(--ink-3)", soft: "var(--panel)", ink: "var(--ink-2)" };
export const RED: Tone = { fill: "var(--red)", soft: "var(--red-soft)", ink: "color-mix(in srgb, var(--red) 75%, var(--ink))" };
export const OK: Tone = GREEN;

/** A tone for position `i` of `n` levels: the lowest is warm gold ("keep going"), the top green,
 *  and everything between is the tenant's brand in steps from a soft tint to full strength, so any
 *  number of levels (2–8) stays ordered and distinct without muddy in-between hues. Three levels
 *  are exactly gold / brand / green. Every tone is paired with the level's NAME wherever it shows. */
export function toneAt(i: number, n: number): Tone {
  if (n <= 1) return BRAND;
  if (i <= 0) return GOLD;
  if (i >= n - 1) return GREEN;
  const k = (i) / (n - 2);                 // 0 < k <= 1 across the middle levels
  if (k >= 0.999) return BRAND;
  return {
    fill: `color-mix(in srgb, var(--brand) ${Math.round(48 + 52 * k)}%, var(--surface))`,
    soft: `color-mix(in srgb, var(--brand) ${Math.round(8 + 8 * k)}%, var(--surface))`,
    ink: "var(--brand-strong)",
  };
}

export function bandTone(bands: HubSettings["masteryBands"], label: string | null | undefined): Tone {
  if (!label) return NEUTRAL;
  const i = bands.findIndex((b) => b.label === label);
  if (i < 0) return NEUTRAL;
  return toneAt(i, bands.length);
}

/** "Algebra › Quadratics" (no subject). */
export const topicShort = (t: { subject: string; topic: string; subtopic: string | null }) => [t.topic, t.subtopic].filter(Boolean).join(" › ") || t.subject;
