import type { CSSProperties } from "react";
import { BrandLogo } from "@/components/ui/Logo";

// Auth screens run the marketing-site palette so the hand-off from the website
// into sign-up feels like one product. That palette is the blue + gold one —
// this file was still carrying the dark-navy/pink retheme that was reverted,
// which is why sign-in looked nothing like the site.
export const AUTH_LIGHT: CSSProperties = {
  "--bg": "#1d3a8f",
  "--surface": "#ffffff",
  "--panel": "#f5f8fd",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#ece6f1",
  "--brand": "#2f6bd8",
  "--brand-soft": "#e8f0fe",
  "--brand-ink": "#ffffff",
  "--brand-strong": "#1d3a8f",
  "--gold": "#f5b81f",
} as CSSProperties;

// The logo lives in components/ui/Logo.tsx (bare mark + two-tone wordmark). Auth cards are light, so the default is onLight.
export function AuthLogo({ size = 36, variant = "onLight" }: { size?: number; variant?: "onLight" | "onDark" }) {
  return <BrandLogo size={size} variant={variant} />;
}
