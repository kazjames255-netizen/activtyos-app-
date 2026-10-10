import type { CSSProperties } from "react";
import { BRAND } from "@/lib/i18n/config";

/**
 * The ActivityLane logo: a person with arms raised above three coloured lane lines
 * (children #ff6f91, sessions #18b9a4, staff #8a6cf2).
 *
 * Two forms:
 *  - TILE  = the mark on a deep-blue rounded square. ONLY for things that need a background of their own:
 *            app icon, favicon, apple-touch-icon, PWA icons, og image (public/brand/mark.svg, scripts/gen-brand-assets.mjs).
 *  - BARE  = the lockup used on every surface: no tile, figure + three lanes + two-tone wordmark.
 *            variant "onDark"  (blue site bar, dark sidebars, blue hero headers): white figure, "Activity" white, "Lane" amber #ffb02e.
 *            variant "onLight" (login/auth cards, light pages, emails on white): navy #14378f figure, "Activity" navy, "Lane" deep amber
 *                              #c77700 (3.46:1 on white, passes for large/bold text), lanes unchanged.
 * Choose the variant by the background the logo sits on. Artwork twin: public/brand/*.svg (keep the paths identical).
 */
export const LANE_COLOURS = { children: "#ff6f91", sessions: "#18b9a4", staff: "#8a6cf2" } as const;
export const MARK_BLUE = "#14378f";
export const LOGO_TONES = {
  onDark: { figure: "#ffffff", activity: "#ffffff", lane: "#ffb02e" },
  onLight: { figure: "#14378f", activity: "#14378f", lane: "#c77700" },
} as const;
export type LogoVariant = keyof typeof LOGO_TONES;

/** The tile mark (blue rounded square). Icons only; use BrandLogo / BrandMark variant on pages. */
export function BrandMark({ size = 30, title, className, style, variant = "tile" }: { size?: number; title?: string; className?: string; style?: CSSProperties; variant?: "tile" | LogoVariant }) {
  const a11y = { role: title ? "img" : undefined, "aria-label": title, "aria-hidden": title ? undefined : true } as const;
  if (variant === "tile") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={{ flexShrink: 0, ...style }} {...a11y}>
        <rect width="100" height="100" rx="24" fill={MARK_BLUE} />
        <circle cx="50" cy="19" r="9" fill="#fff" />
        <path d="M50 41v10M50 41 37 30M50 41 63 30" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M16 62H52Q70 62 82 52" stroke={LANE_COLOURS.children} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M16 76H60Q76 76 86 66" stroke={LANE_COLOURS.sessions} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M16 90H68Q82 90 90 80" stroke={LANE_COLOURS.staff} strokeWidth="9" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  // Bare: viewBox crops to the artwork (about 0.98 : 1), `size` is the HEIGHT.
  const f = LOGO_TONES[variant].figure;
  return (
    <svg viewBox="9 7 88 90" width={Math.round(size * 0.98)} height={size} className={className} style={{ flexShrink: 0, ...style }} {...a11y}>
      <circle cx="50" cy="19" r="9" fill={f} />
      <path d="M50 41v10M50 41 37 30M50 41 63 30" stroke={f} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M16 62H52Q70 62 82 52" stroke={LANE_COLOURS.children} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M16 76H60Q76 76 86 66" stroke={LANE_COLOURS.sessions} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M16 90H68Q82 90 90 80" stroke={LANE_COLOURS.staff} strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Two-tone wordmark: "Activity" + "Lane". Font size inherits unless `size` is given. */
export function BrandWordmark({ size, variant = "onLight", className = "" }: { size?: number; variant?: LogoVariant; className?: string }) {
  const t = LOGO_TONES[variant];
  const cut = BRAND.length - 4; // "Activity" | "Lane"
  return (
    <span className={className} style={{ fontFamily: "var(--ff-display)", fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap", ...(size ? { fontSize: size } : {}), lineHeight: 1 }}>
      <span style={{ color: t.activity }}>{BRAND.slice(0, cut)}</span><span style={{ color: t.lane }}>{BRAND.slice(cut)}</span>
    </span>
  );
}

/** Bare mark + two-tone wordmark. `markOnly` shows just the mark. `size` = mark height in px. */
export function BrandLogo({ size = 30, variant = "onLight", markOnly = false, className = "" }: { size?: number; variant?: LogoVariant; markOnly?: boolean; className?: string }) {
  if (markOnly) return <BrandMark size={size} variant={variant} title={BRAND} className={className} />;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28), whiteSpace: "nowrap" }} aria-label={BRAND} role="img">
      <BrandMark size={size} variant={variant} />
      <BrandWordmark size={Math.round(size * 0.62)} variant={variant} />
    </span>
  );
}
