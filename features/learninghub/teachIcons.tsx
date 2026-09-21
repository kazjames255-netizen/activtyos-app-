"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./kit";

// Extra stroke icons for the teaching panels, drawn on the same 24px grid and
// stroke rules as kit.tsx's Icon set (so they sit side by side without a visual
// seam). `Ico` renders one of these, or falls back to the shared kit icon.

const EXTRA: Record<string, ReactNode> = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  micOff: <><path d="M15 9.3V6a3 3 0 0 0-5.9-.8M9 9v2a3 3 0 0 0 4.5 2.6" /><path d="M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3M4 4l16 16" /></>,
  camOff: <><path d="M10.5 6H13a3 3 0 0 1 3 3v2.5M16 15v.5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3" /><path d="m16 10.5 5-3v9l-3.6-2.1M4 4l16 16" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" /></>,
  paperclip: <><path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14 7.5" /></>,
  hourglass: <><path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 2 4l3 2-3 2a5 5 0 0 0-2 4v3M17 3v3a5 5 0 0 1-2 4l-3 2 3 2a5 5 0 0 1 2 4v3" /></>,
  bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15 10.5" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5l1.5-3h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4.5" height="6.5" rx="2" /><rect x="16.5" y="14" width="4.5" height="6.5" rx="2" /></>,
  wave: <><path d="M4 12h2M8 8v8M12 4v16M16 8v8M20 12h-2" /></>,
  send: <><path d="m21 3-9 18-2.5-7.5L3 11z" /><path d="m21 3-11.5 10.5" /></>,
  hand: <><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13M8 12l-1.6-2a1.5 1.5 0 0 0-2.4 1.8L7 17a6 6 0 0 0 5 3h1.5a5.5 5.5 0 0 0 5.5-5.5V13" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.4 6.5C3.9 8.2 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2.5" /><path d="M8 20h8M12 16v4" /></>,
  panelRight: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M14.5 4v16" /></>,
  maximize: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>,
  type: <><path d="M5 6V4h14v2M12 4v16M9 20h6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};
export type ExtraIconName = keyof typeof EXTRA;
export type IcoName = IconName | ExtraIconName;

export function Ico({ name, size = 18, className = "", strokeWidth = 1.8 }: { name: IcoName; size?: number; className?: string; strokeWidth?: number }) {
  if (name in EXTRA) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
        {EXTRA[name]}
      </svg>
    );
  }
  return <Icon name={name as IconName} size={size} className={className} strokeWidth={strokeWidth} />;
}

/** A rounded gradient tile holding an icon — the "hero" mark for a feature (brand-aware). */
export function GradientTile({ icon, size = 48, className = "", tone = "brand" }: { icon: IcoName; size?: number; className?: string; tone?: "brand" | "glass" }) {
  return (
    <span aria-hidden className={`grid flex-none place-items-center rounded-2xl ${className}`}
      style={{
        width: size, height: size,
        background: tone === "glass" ? "linear-gradient(145deg, rgba(255,255,255,.34), rgba(255,255,255,.1))" : "linear-gradient(140deg, var(--brand-2), var(--brand))",
        color: "#fff",
        boxShadow: tone === "glass" ? "inset 0 0 0 1px rgba(255,255,255,.28), 0 6px 16px -6px rgba(0,0,0,.35)" : "0 8px 18px -8px color-mix(in srgb, var(--brand) 80%, transparent)",
      }}>
      <Ico name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}
