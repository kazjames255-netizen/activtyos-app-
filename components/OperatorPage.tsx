"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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
  background,
  stats,
  collapseId,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  /** Optional themed hero gradient; defaults to the house navy→blue band. */
  background?: string;
  /** Optional summary content (stat tiles) rendered on the banner and hidden
   *  by the collapse toggle. Pass the tile grid here to make the hero foldable. */
  stats?: ReactNode;
  /** Stable id used to remember the open/closed choice per page. Defaults to
   *  a slug of the title when `stats` is present. */
  collapseId?: string;
}) {
  const foldable = !!stats;
  const key = foldable ? `aos.hero.${collapseId ?? slug(title)}` : "";
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!key) return;
    try { if (localStorage.getItem(key) === "0") setOpen(false); } catch { /* ignore */ }
  }, [key]);
  const toggle = () => setOpen((o) => {
    const n = !o;
    try { if (key) localStorage.setItem(key, n ? "1" : "0"); } catch { /* ignore */ }
    return n;
  });
  return (
    <>
      <div
        className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]"
        style={{
          // A white 18px dot grid layered over the gradient — matches the sidebar
          // and register header so every title card reads as the same surface.
          backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${background ?? "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#ffffff 100%)"}`,
          backgroundSize: "18px 18px, cover, cover, cover, cover",
          backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
        }}
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
          <div className="flex flex-none flex-wrap items-center gap-2">
            {actions}
            {foldable && (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                title={open ? "Collapse cards" : "Show cards"}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:text-white"
                style={{ background: "rgba(12,26,68,.42)" }}
              >
                <span className="text-[10px] leading-none">{open ? "▾" : "▸"}</span>{open ? "Hide" : "Show"}
              </button>
            )}
          </div>
        </div>
      </div>
      {foldable && open && <div className="mb-3.5">{stats}</div>}
    </>
  );
}

/** Slug a ReactNode title down to a stable-ish storage key. */
function slug(title: ReactNode): string {
  return typeof title === "string" ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "hero";
}

/**
 * Wrap a stat-tile grid (or any summary block) to make it collapsible, with a
 * small "Hide / Show" chip and the choice remembered per `id`. Use this where
 * the summary can't live in the PageHero `stats` slot — e.g. tiles that only
 * appear on one tab, or several summary blocks on a page.
 */
export function CollapsibleStats({
  id,
  children,
  label = "Overview",
  className = "mb-4",
}: {
  id: string;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const key = `aos.hero.${id}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(key) === "0") setOpen(false); } catch { /* ignore */ }
  }, [key]);
  const toggle = () => setOpen((o) => {
    const n = !o;
    try { localStorage.setItem(key, n ? "1" : "0"); } catch { /* ignore */ }
    return n;
  });
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">{label}</span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="ml-auto rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]"
        >
          {open ? "▴ Hide" : "▾ Show"}
        </button>
      </div>
      {open && children}
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
  background,
  heroBackground,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** Optional themed page wash; defaults to the flat light --bg. */
  background?: string;
  /** Optional themed hero gradient; defaults to the house navy→blue band. */
  heroBackground?: string;
}) {
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ ...LIGHT_PALETTE, ...(background ? { background } : {}) }}>
      <PageHero title={title} lede={lede} actions={actions} icon={icon} background={heroBackground} />
      {children}
    </div>
  );
}

/** The pill tab strip used across the operator screens. */
export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  accent,
}: {
  tabs: [T, string][];
  value: T;
  onChange: (t: T) => void;
  /** A tab to highlight (coloured) even when it isn't the active one. */
  accent?: T;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap gap-1.5">
      {tabs.map(([key, label]) => {
        const on = key === value;
        const isAccent = key === accent && !on;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={
              on
                ? { borderColor: "transparent", background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.55)" }
                : isAccent
                  ? { borderColor: "transparent", background: "linear-gradient(180deg,#f7c948,#eda100)", color: "#4a2f00", boxShadow: "0 3px 10px -2px rgba(237,161,0,.5)" }
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
