import type { CSSProperties } from "react";
import { BrandMark, BrandWordmark } from "@/components/ui/Logo";

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

// The logo (person + three lane lines): one artwork in components/ui/Logo.tsx. These names are kept so the auth screens keep their imports.
export function AosMark({ size = 30 }: { size?: number }) {
  return <BrandMark size={size} />;
}

// Wordmark in the display font, themed ink.
export function AosWordmark({ className = "" }: { className?: string }) {
  return <BrandWordmark className={className} tone="auto" />;
}
