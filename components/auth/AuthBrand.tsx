import type { CSSProperties } from "react";

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

// The mark — blue rounded square + white paper-plane (matches the site logo).
export function AosMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#aosAuth)" />
      <path d="M26.5 6 L5.5 13.7 L13 16.2 L15.6 24 L18.7 17 Z" fill="#fff" />
      <path d="M13 16.2 L26.5 6 L18.7 17 Z" fill="#fff" opacity=".5" />
      <defs>
        <linearGradient id="aosAuth" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f6bd8" />
          <stop offset="1" stopColor="#1d3a8f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Wordmark — Wigglekit.
export function AosWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={className} style={{ fontFamily: "var(--ff-display)" }}>
      <span style={{ color: "var(--ink, #171534)" }}>Wiggle</span>
      <span style={{ color: "var(--gold, #f5b81f)" }}>kit</span>
    </span>
  );
}
