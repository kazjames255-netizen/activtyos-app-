"use client";

import type { CSSProperties, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────
// The light palette every operator screen sits on.
//
// This block was copy-pasted into six files (Listings, Blocks, Bookings,
// Customers, ListingWizard, TakeBookingModal) before this existed. Setup was
// going to be the seventh. Those six still carry their own copies — migrating
// them is mechanical but touches a lot of layout, so it is deliberately not
// bundled with a settings change.
//
// The negative margin cancels the shell's own padding so the page background
// reaches the edges, then puts it back inside.
// ─────────────────────────────────────────────────────────────────────────

export const LIGHT_PALETTE = {
  background: "var(--bg)",
  color: "var(--ink)",
  "--bg": "#f5f8fd",
  "--surface": "#ffffff",
  "--panel": "#fbf8fc",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#ece6f1",
} as CSSProperties;

export function OperatorPage({
  title,
  lede,
  actions,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] p-5" style={LIGHT_PALETTE}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {title}
          </h2>
          {lede && <p className="text-[13px] text-[var(--ink-3)]">{lede}</p>}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** The pill tab strip used across the operator screens. */
export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: [T, string][];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap gap-1.5">
      {tabs.map(([key, label]) => {
        const on = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={
              on
                ? { borderColor: "transparent", background: "var(--brand-soft)", color: "var(--brand-ink)" }
                : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-3)" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
