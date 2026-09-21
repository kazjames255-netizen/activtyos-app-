"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colorFor } from "@/features/money/finance-kit";
import { inkForBase, subjectSwatch } from "./subjectColour";
import type { PanelMeta } from "./panelTypes";

// Shared pieces for every hub panel: icons, empty / loading / coming-soon
// states, a modal + bottom sheet, a switch. Panels import from here rather than
// re-inventing them, so the whole hub reads as one product.

// ── colour helpers ─────────────────────────────────────────────────────────
/** A soft wash of `c` over the card surface — chip / tile backgrounds. */
export const tint = (c: string, pct = 12) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;
/** The accent a subject wears everywhere (dot, rail, chip): the tutor's chosen colour, else its default — see subjectColour.ts (the only place subject colours live). */
export const subjectColor = (subject: string) => subjectSwatch(subject).base;
/** The same accent as TEXT ink (always >= 4.5:1 on a wash of the colour). Works on any accent from `subjectColor`; other colours (theme vars, hex) pass through. */
export const inkOf = (c: string) => inkForBase(c) ?? c;
export const subjectInk = (subject: string) => subjectSwatch(subject).fg;

/** Focus ring used on every interactive element in the hub. */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]";

// ── icons (stroke = currentColor) ──────────────────────────────────────────
const PATHS: Record<string, ReactNode> = {
  video: <><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10.5 5-3v9l-5-3z" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  quiz: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 9 1.5 1.5L12 8M8 15h8" /></>,
  homework: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  notes: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7" /></>,
  cards: <><rect x="3" y="6" width="14" height="14" rx="3" /><path d="M7 3h11a3 3 0 0 1 3 3v11" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  print: <><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  warning: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  arrowLeft: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>,
  play: <><path d="m7 4 13 8-13 8z" /></>,
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-9" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
};
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 18, className = "", strokeWidth = 1.8 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
      {PATHS[name]}
    </svg>
  );
}
/** The tab icon for each hub panel (PanelMeta.key). */
export const PANEL_ICON: Record<string, IconName> = { home: "home", live: "video", students: "users", dashboard: "chart", diagnostic: "compass", quizzes: "quiz", homework: "homework", notes: "notes", flashcards: "cards" };

// ── responsive hook ────────────────────────────────────────────────────────
/** True at the `lg` breakpoint and up (server / first paint: false). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia("(min-width: 1024px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

// ── shared styles ──────────────────────────────────────────────────────────
/** Keyframes + helper classes the hub's polish relies on. Rendered once by the
 *  shell; every animation is switched off under prefers-reduced-motion. */
export function HubStyles() {
  return (
    <style>{`
      /* Warm-paper tokens for every overlay (dialogs, sheets, menus, toasts). Overlays are portalled INTO
         #learning-hub, so these inherit the page's light palette (and the tenant's --brand) instead of the
         app's dark :root fallback. Tokens only — no hex. */
      #learning-hub {
        /* Helper text: the app's --ink-3 (#8a86a3) is only 3.3:1 on the hub's light surfaces. Hub-only override (5.0+:1); the app-wide token is untouched. */
        --ink-3: #6b6788;
        --hub-green-ink: #0a6b3a; --hub-green-fill: #0b7a44; --hub-red-ink: #b3131c; /* AA-safe text / white-on-fill versions of --green and --red */
        --hub-warm: color-mix(in srgb, var(--gold) 6%, var(--surface));
        --hub-warm-2: color-mix(in srgb, var(--gold) 12%, var(--surface));
        --hub-field: color-mix(in srgb, var(--gold) 9%, var(--surface));
        --hub-warm-line: color-mix(in srgb, var(--gold) 28%, var(--line));
        --hub-scrim: color-mix(in srgb, color-mix(in srgb, var(--ink) 70%, var(--gold)) 42%, transparent);
        --hub-warm-shadow: 0 30px 70px -24px color-mix(in srgb, color-mix(in srgb, var(--ink) 55%, var(--gold)) 55%, transparent), 0 3px 12px -4px color-mix(in srgb, color-mix(in srgb, var(--ink) 40%, var(--gold)) 22%, transparent);
      }
      .hub-layer { background: var(--hub-scrim); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); color: var(--ink) }
      .hub-sheet { background: var(--hub-warm); border: 1px solid var(--hub-warm-line); box-shadow: var(--hub-warm-shadow); color: var(--ink) }
      .hub-sheet-head { background: var(--hub-warm); border-bottom: 1px solid var(--hub-warm-line) }
      .hub-sheet-foot { background: var(--hub-warm-2); border-top: 1px solid var(--hub-warm-line) }
      .hub-pop { background: var(--hub-warm); border: 1px solid var(--hub-warm-line); box-shadow: var(--hub-warm-shadow); color: var(--ink) }
      .hub-sheet input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), .hub-sheet textarea, .hub-sheet select {
        background-color: var(--hub-field); border-color: var(--hub-warm-line); color: var(--ink); color-scheme: light;
      }
      .hub-sheet input::placeholder, .hub-sheet textarea::placeholder { color: var(--ink-3) }
      .hub-sheet input:not([type="checkbox"]):not([type="radio"]):focus, .hub-sheet textarea:focus, .hub-sheet select:focus {
        border-color: var(--brand); background-color: var(--surface); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
      }
      /* A one-column grid inside a sheet must be allowed to shrink (min-width:auto would let a wide child push the sheet sideways). */
      .hub-sheet .grid:not([class*="grid-cols"]):not([class*="grid-flow"]) { grid-template-columns: minmax(0, 1fr) }
      .hub-sheet code { background: var(--hub-warm-2) !important }
      .hub-sheet, .hub-pop { --panel: color-mix(in srgb, var(--gold) 9%, var(--surface)); --line: var(--hub-warm-line) }
      .hub-warm { background: var(--hub-warm); border: 1px solid var(--hub-warm-line) }
      @keyframes hub-sheet-in { from { opacity: 0; transform: translateY(14px) scale(.985) } to { opacity: 1; transform: none } }
      .hub-sheet { animation: hub-sheet-in .22s cubic-bezier(.2,.7,.2,1) both }
      @keyframes hub-rise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      @keyframes hub-ping { 0% { transform: scale(1); opacity: .65 } 80%, 100% { transform: scale(2.6); opacity: 0 } }
      @keyframes hub-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
      @keyframes hub-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
      .hub-rise { animation: hub-rise .38s cubic-bezier(.2,.7,.2,1) both }
      .hub-ping { animation: hub-ping 1.6s cubic-bezier(0,0,.2,1) infinite }
      .hub-grow { transform-origin: left center; animation: hub-grow .7s cubic-bezier(.2,.7,.2,1) both }
      .hub-float { animation: hub-float 4s ease-in-out infinite }
      .hub-lift { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease }
      .hub-lift:hover { transform: translateY(-2px); box-shadow: var(--shadow) }
      .hub-press { transition: transform .12s ease }
      .hub-press:active { transform: scale(.97) }
      .hub-fade-x { --hub-fade-l: 0px; --hub-fade-r: 0px; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 var(--hub-fade-l), #000 calc(100% - var(--hub-fade-r)), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 var(--hub-fade-l), #000 calc(100% - var(--hub-fade-r)), transparent 100%) }
      @media (prefers-reduced-motion: reduce) {
        .hub-rise, .hub-ping, .hub-grow, .hub-float, .hub-sheet { animation: none !important }
        .hub-lift, .hub-press { transition: none !important }
        .hub-lift:hover, .hub-press:active { transform: none !important }
      }
    `}</style>
  );
}

// ── loading ────────────────────────────────────────────────────────────────
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`rounded-lg bg-[var(--panel)] motion-safe:animate-pulse ${className}`} style={{ backgroundImage: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--line) 55%, transparent), transparent)", ...style }} />;
}

/** Card-shaped skeletons that mirror the real cards (title, chip, ring) rather
 *  than grey bars; announces itself to assistive tech.
 *  variant: "row" (default) = list row with a tile + ring; "card" = cover band
 *  card; "roster" = avatar + ring student card. `grid` lays cards in columns. */
export function SkeletonRows({ rows = 3, label = "Loading", variant = "row", grid }: { rows?: number; label?: string; variant?: "row" | "card" | "roster"; grid?: boolean }) {
  const cell = (i: number) => {
    if (variant === "card") {
      return (
        <div key={i} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <Skeleton className="h-[64px] w-full !rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="flex gap-2 pt-1"><Skeleton className="h-5 w-16 !rounded-full" /><Skeleton className="h-5 w-12 !rounded-full" /></div>
          </div>
        </div>
      );
    }
    if (variant === "roster") {
      return (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <Skeleton className="h-11 w-11 flex-none !rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex gap-2"><Skeleton className="h-5 w-14 !rounded-full" /><Skeleton className="h-5 w-16 !rounded-full" /></div>
          </div>
          <Skeleton className="h-14 w-14 flex-none !rounded-full" />
        </div>
      );
    }
    return (
      <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
        <Skeleton className="h-11 w-11 flex-none !rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-14 !rounded-full" /></div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="hidden h-12 w-12 flex-none !rounded-full sm:block" />
      </div>
    );
  };
  return (
    <div role="status" aria-busy="true" aria-label={label} className={grid ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
      {Array.from({ length: rows }, (_, i) => cell(i))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

// ── empty states ───────────────────────────────────────────────────────────
/** Illustrated empty state: layered tiles + sparkles around a gradient icon
 *  tile, a title, one line and an optional CTA. */
export function EmptyState({ icon, title, body, action, color = "var(--brand)", id }: { icon: IconName; title: string; body?: ReactNode; action?: ReactNode; color?: string; id?: string }) {
  return (
    <div id={id} data-ui="card" className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 pb-9 pt-8 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: `radial-gradient(60% 100% at 50% 0%, ${tint(color, 14)}, transparent)` }} />
      <div className="relative mx-auto h-[104px] w-[132px]" aria-hidden="true">
        <span className="absolute left-2 top-7 h-14 w-14 -rotate-12 rounded-2xl" style={{ background: tint(color, 10), border: `1px solid ${tint(color, 22)}` }} />
        <span className="absolute right-2 top-4 h-12 w-12 rotate-12 rounded-2xl" style={{ background: tint(color, 18), border: `1px solid ${tint(color, 28)}` }} />
        <span className="hub-float absolute inset-x-0 top-4 mx-auto grid h-[76px] w-[76px] place-items-center rounded-3xl text-white shadow-[0_14px_28px_-10px_rgba(16,26,56,.35)]" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 78%, white), ${color})` }}>
          <Icon name={icon} size={34} strokeWidth={1.7} />
        </span>
        <span className="absolute left-0 top-2 text-[var(--ink-3)]"><Icon name="sparkle" size={14} /></span>
        <span className="absolute bottom-3 right-0" style={{ color }}><Icon name="sparkle" size={18} /></span>
        <span className="absolute bottom-6 left-3 h-2 w-2 rounded-full" style={{ background: tint(color, 40) }} />
      </div>
      <h3 className="relative mt-3 text-[17px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</h3>
      {body && <p className="relative mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-[var(--ink-2)]">{body}</p>}
      {action && <div className="relative mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** A panel that isn't built yet: honest, tinted, never hidden. */
export function ComingSoon({ meta }: { meta: PanelMeta }) {
  const icon = PANEL_ICON[meta.key] ?? "sparkle";
  const ghost = [["w-[72%]", "w-[40%]"], ["w-[58%]", "w-[52%]"], ["w-[66%]", "w-[30%]"]];
  return (
    <div id={`hub-soon-${meta.key}`} data-ui="card" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="relative px-6 pb-6 pt-7 sm:px-8" style={{ background: "linear-gradient(180deg, var(--brand-soft), var(--surface))" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[var(--shadow-sm)]" style={{ background: "linear-gradient(135deg, var(--brand-2), var(--brand))" }}>
            <Icon name={icon} size={24} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[19px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{meta.label}</h3>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)", color: "#7a5300" }}>
                <Icon name="sparkle" size={11} /> Coming soon
              </span>
            </div>
            <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-[var(--ink-2)]">{meta.blurb}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2.5 px-6 pb-7 pt-1 sm:px-8" aria-hidden="true">
        {ghost.map(([a, b], i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
            <span className="h-8 w-8 flex-none rounded-lg" style={{ background: tint("var(--brand)", 14) }} />
            <div className="flex-1 space-y-2"><div className={`h-2.5 rounded-full bg-[var(--line)] ${a}`} /><div className={`h-2 rounded-full bg-[var(--line)] opacity-70 ${b}`} /></div>
            <span className="h-6 w-14 flex-none rounded-full bg-[var(--line)] opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── small atoms ────────────────────────────────────────────────────────────
/** A tinted pill in a subject's colour. */
export function SubjectChip({ subject, children, className = "" }: { subject: string; children?: ReactNode; className?: string }) {
  const c = subjectColor(subject);
  const ink = subjectInk(subject);
  return (
    <span data-subject-chip={subject} className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-[3px] text-[11px] font-bold ${className}`} style={{ background: tint(c, 13), color: ink }}>
      {children ?? subject}
    </span>
  );
}

/** An accessible on/off switch with a visible label. */
export function Switch({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-50 ${FOCUS}`}
      style={{ background: checked ? "linear-gradient(180deg, var(--brand-2), var(--brand))" : "var(--line)" }}>
      <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: checked ? 22 : 2 }} />
    </button>
  );
}

/** Round avatar with the person's initial in a stable colour. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const c = colorFor(name);
  return (
    <span className="grid flex-none place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, background: c, fontSize: size * 0.4 }} aria-hidden="true">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

// ── modal / bottom sheet ───────────────────────────────────────────────────
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Centred dialog on desktop, bottom sheet on phones. Esc / backdrop close it,
 *  Tab stays inside, focus returns to whatever opened it. */
export function Modal({ open, onClose, title, children, footer, wide, id }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", key, true);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key, true); document.body.style.overflow = scroll; prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  // Portalled to the hub root: the tab panel animates in with a transform, which would otherwise
  // become the containing block for this `fixed` layer and squash it into the panel.
  const host = typeof document !== "undefined" ? document.getElementById("learning-hub") : null;
  const layer = (
    <div className="hub-layer fixed inset-0 z-[400] flex items-end justify-center sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} id={id} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`hub-sheet relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl outline-none sm:rounded-3xl ${wide ? "sm:max-w-[640px]" : "sm:max-w-[480px]"}`}>
        <div className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--hub-warm-line)] sm:hidden" aria-hidden="true" />
        <div className="hub-sheet-head flex items-center gap-3 px-5 pb-3 pt-4 sm:py-3.5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[var(--ink-2)] hover:bg-[var(--hub-warm-2)] ${FOCUS}`}><Icon name="close" size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="hub-sheet-foot flex flex-wrap items-center justify-end gap-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
  return host ? createPortal(layer, host) : layer;
}

/** Own-state confirm: a destructive button that first asks, cancels itself
 *  after a few seconds, on blur-out and on Esc. */
export function ConfirmButton({ label, confirmLabel = "Confirm", onConfirm, disabled, ariaLabel, children, className = "", roomy }: { label?: ReactNode; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; ariaLabel: string; children?: ReactNode; className?: string; /** 44px tap targets (touch-first cards). */ roomy?: boolean }) {
  const mh = roomy ? "min-h-[44px] min-w-[44px] justify-center" : "min-h-[44px] min-w-[44px] justify-center lg:min-h-[34px] lg:min-w-[34px]";
  const [asking, setAsking] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 6000);
    return () => clearTimeout(t);
  }, [asking]);
  return (
    <span ref={wrap} className="relative z-10 inline-flex items-center gap-1"
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setAsking(false); }}
      onKeyDown={(e) => { if (e.key === "Escape" && asking) { e.stopPropagation(); setAsking(false); } }}>
      {asking ? (
        <>
          <button type="button" autoFocus disabled={disabled} onClick={() => { setAsking(false); onConfirm(); }} aria-label={`${confirmLabel}: ${ariaLabel}`}
            className={`inline-flex ${mh} items-center rounded-full border px-3 text-[11.5px] font-extrabold ${FOCUS} ${className}`} style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }}>{confirmLabel}</button>
          <button type="button" onClick={() => setAsking(false)} className={`inline-flex ${mh} items-center rounded-full px-2.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>Keep</button>
        </>
      ) : (
        <button type="button" disabled={disabled} onClick={() => setAsking(true)} aria-label={ariaLabel}
          className={`inline-flex ${mh} items-center gap-1 rounded-full px-2.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS} ${className}`}>
          {children ?? <Icon name="trash" size={15} />}{label}
        </button>
      )}
    </span>
  );
}

/** Error banner: dismissible, tokens only. */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12.5px] font-semibold" style={{ background: "var(--red-soft)", borderColor: "var(--red-line)", color: "var(--red)" }}>
      <Icon name="warning" size={16} className="mt-px" />
      <span className="min-w-0 flex-1 break-words text-[var(--ink)]">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className={`-my-1 -mr-1.5 grid h-8 w-8 flex-none place-items-center rounded-full hover:bg-black/5 ${FOCUS}`} style={{ color: "var(--red)" }}><Icon name="close" size={15} /></button>
    </div>
  );
}

// ── ⋯ menu ─────────────────────────────────────────────────────────────────
export interface MenuItem { label: string; icon: IconName; onSelect: () => void; danger?: boolean; /** Shown on the second tap of a danger item. */ confirmText?: string; disabled?: boolean }

/** A ⋯ button opening a small menu. Fixed-positioned so a scrolling card or
 *  sidebar can't clip it; closes on Esc, outside click, scroll and after 8s.
 *  Danger items ask twice. `tone="glass"` suits a button sitting on a cover. */
export function RowMenu({ label, items, roomy, tone }: { label: string; items: MenuItem[]; roomy?: boolean; tone?: "glass" }) {
  const [pos, setPos] = useState<{ left: number; top: number; host: HTMLElement } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = (refocus = false) => { setPos(null); setConfirm(null); if (refocus) btn.current?.focus(); };

  const place = () => {
    const b = btn.current;
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return null; // scrolled out of sight
    const w = 208, h = items.length * 44 + 12;
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    return { left: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), top, host: b.closest<HTMLElement>("#learning-hub") ?? document.body };
  };
  const isOpen = !!pos;
  useEffect(() => {
    if (!isOpen) return;
    const first = menu.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus({ preventScroll: true });
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close(); };
    // Layout shifts and scrolls move the button: follow it (close only if it left the screen).
    const follow = () => { const p = place(); if (p) setPos(p); else close(); };
    document.addEventListener("mousedown", away);
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    const t = setTimeout(() => close(), 8000);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("resize", follow); window.removeEventListener("scroll", follow, true); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const open = () => { const p = place(); if (p) setPos(p); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); close(true); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const els = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = els.indexOf(document.activeElement as HTMLElement);
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    }
    if (e.key === "Tab") close();
  };

  return (
    <>
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={!!pos} aria-controls={pos ? menuId : undefined}
        onClick={() => (pos ? close() : open())}
        className={`relative z-10 grid flex-none place-items-center rounded-lg transition ${tone === "glass" ? "bg-white/70 text-[var(--ink)] backdrop-blur hover:bg-white" : "text-[var(--ink-2)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"} ${roomy ? "h-11 w-11" : "h-9 w-9 lg:h-8 lg:w-8"} ${FOCUS}`}>
        <Icon name="more" size={18} />
      </button>
      {pos && createPortal(
        <div ref={menu} id={menuId} role="menu" aria-label={label} onKeyDown={onKey}
          className="hub-pop fixed z-[500] w-[208px] rounded-xl p-1.5" style={{ left: pos.left, top: pos.top }}>
          {items.map((it) => {
            const asking = confirm === it.label;
            return (
              <button key={it.label} type="button" role="menuitem" tabIndex={-1} disabled={it.disabled}
                onClick={() => { if (it.danger && !asking) { setConfirm(it.label); return; } close(); it.onSelect(); }}
                className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-bold transition hover:bg-[var(--hub-warm-2)] disabled:opacity-50 lg:min-h-[40px] ${FOCUS} ${it.danger ? "text-[var(--red)] hover:bg-[var(--red-soft)]" : "text-[var(--ink)]"}`}
                style={asking ? { background: "var(--red)", color: "#fff" } : undefined}>
                <Icon name={it.icon} size={16} />{asking ? (it.confirmText ?? "Tap again to delete") : it.label}
              </button>
            );
          })}
        </div>,
        // Portalled (a hovering card is `transform`ed, which would re-anchor a
        // fixed menu) but into the hub root, so the page's colour tokens apply.
        pos.host,
      )}
    </>
  );
}

// ── progress ring ──────────────────────────────────────────────────────────
/** A small progress ring with a centred label. `pct` null = "no data yet"
 *  (dashed empty ring). The stroke fills in on mount (skipped when the user
 *  prefers reduced motion — CSS transition, so the final value just shows). */
export function MiniRing({ pct, size = 52, stroke = 5, color = "var(--brand)", label, sub }: { pct: number | null; size?: number; stroke?: number; color?: string; label?: ReactNode; sub?: string }) {
  const r = size / 2 - stroke / 2, c = 2 * Math.PI * r;
  const v = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(v)); return () => cancelAnimationFrame(t); }, [v]);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={pct == null ? "No mastery data yet" : `${Math.round(v)}% mastery`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel)" strokeWidth={stroke} strokeDasharray={pct == null ? "3 5" : undefined} style={pct == null ? { stroke: "var(--line)" } : undefined} />
        {pct != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out" />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className="block text-[13px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{label ?? (pct == null ? "–" : `${Math.round(v)}%`)}</span>
          {sub && <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{sub}</span>}
        </span>
      </div>
    </div>
  );
}
