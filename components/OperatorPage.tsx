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

/**
 * Money-section style hero — a blue gradient banner with the page title, an
 * optional lede, an optional icon and an actions slot. Shared so every operator
 * page reads like the Money in / out screens.
 */
export function PageHero({
  title,
  lede,
  actions,
  icon,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]"
      style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#ffffff 100%)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* A real heading, not a div — screen readers (and tests) navigate by
              page headings, and the migration to PageHero silently removed them. */}
          <h2 className="m-0 flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {icon && <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20 text-[17px]">{icon}</span>}
            {title}
          </h2>
          {lede && <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">{lede}</p>}
        </div>
        {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * MASTER card — the house card style: a navy→blue gradient header band with an
 * all-white body. `header` renders on the gradient (white text); `children` is
 * the body. Use everywhere a card should read like the Money "at a glance" /
 * Blocks cards.
 */
export function MasterCard({
  header,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)] ${className}`}>
      <div className="px-4 py-2.5 text-white" style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
        {header}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function OperatorPage({
  title,
  lede,
  actions,
  icon,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={title} lede={lede} actions={actions} icon={icon} />
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
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={
              on
                ? { borderColor: "transparent", background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.55)" }
                : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
