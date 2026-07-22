import type { CSSProperties } from "react";

// Auth screens (sign in / create account) run the same light palette as the
// operator workspace — never the default dark shell — so they read as a clean,
// branded provider sign-in rather than a black system screen.
export const AUTH_LIGHT: CSSProperties = {
  "--bg": "#eef2fb",
  "--surface": "#ffffff",
  "--panel": "#f6f8fd",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#e4e9f4",
} as CSSProperties;

// The ActivityOS mark — blue rounded square + white paper-plane.
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

export function AosWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={className} style={{ fontFamily: "var(--ff-display)" }}>
      <span style={{ color: "#171534" }}>Activity</span>
      <span style={{ color: "#EE1F63" }}>OS</span>
    </span>
  );
}
