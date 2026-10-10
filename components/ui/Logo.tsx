import type { CSSProperties } from "react";
import { BRAND } from "@/lib/i18n/config";

/**
 * The ActivityLane logo: a person with arms raised above three coloured lane lines
 * (children #ff6f91, sessions #18b9a4, staff #8a6cf2) on a deep-blue rounded square.
 * Source of truth for the artwork is public/brand/mark.svg (same paths); regenerate the
 * raster icons with `node scripts/gen-brand-assets.mjs` after any change.
 * The mark keeps its fixed brand colours on every theme; the wordmark follows the theme ink.
 */
export const LANE_COLOURS = { children: "#ff6f91", sessions: "#18b9a4", staff: "#8a6cf2" } as const;
export const MARK_BLUE = "#14378f";

export function BrandMark({ size = 30, title, className, style }: { size?: number; title?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={{ flexShrink: 0, ...style }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="100" height="100" rx="24" fill={MARK_BLUE} />
      <circle cx="50" cy="19" r="9" fill="#fff" />
      <path d="M50 41v10M50 41 37 30M50 41 63 30" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M16 62H52Q70 62 82 52" stroke={LANE_COLOURS.children} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M16 76H60Q76 76 86 66" stroke={LANE_COLOURS.sessions} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M16 90H68Q82 90 90 80" stroke={LANE_COLOURS.staff} strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** The wordmark alone, in the display font. `tone` "auto" follows the theme (var(--ink)); "light" = white for dark grounds; "dark" = fixed navy. */
export function BrandWordmark({ size, tone = "auto", className = "" }: { size?: number; tone?: "auto" | "light" | "dark"; className?: string }) {
  const color = tone === "light" ? "#ffffff" : tone === "dark" ? "#0e1b3d" : "var(--ink, #0e1b3d)";
  return (
    <span className={className} style={{ fontFamily: "var(--ff-display)", fontWeight: 800, letterSpacing: "-0.02em", ...(size ? { fontSize: size } : {}), color, lineHeight: 1 }}>
      {BRAND}
    </span>
  );
}

/** Mark + wordmark lockup. `markOnly` shows just the mark (collapsed sidebar, favicons). */
export function BrandLogo({ size = 30, tone = "auto", markOnly = false, className = "" }: { size?: number; tone?: "auto" | "light" | "dark"; markOnly?: boolean; className?: string }) {
  if (markOnly) return <BrandMark size={size} title={BRAND} className={className} />;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.32) }} aria-label={BRAND} role="img">
      <BrandMark size={size} />
      <BrandWordmark size={Math.round(size * 0.64)} tone={tone} />
    </span>
  );
}
