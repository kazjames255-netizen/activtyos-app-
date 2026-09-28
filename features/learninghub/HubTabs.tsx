"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FOCUS, Icon, PANEL_ICON } from "./kit";
import type { PanelMeta } from "./panelTypes";
import { useT } from "@/lib/i18n/provider";
import { useLbl } from "./hubLabel";
import { keepInView } from "./rtl";

// The hub's tab strip: one horizontally scrollable row (never a wall of wrapped
// pills on a phone) with a sliding pill under the active tab, edge fades that
// only appear where there's more to scroll to, and the active tab scrolled to
// the centre. WAI-ARIA tabs with roving tabindex and ←/→/Home/End. "Soon" tabs
// stay readable and clickable — they open a preview of what's coming — but say
// so in words, not just opacity. A pulsing green dot marks Live lessons only
// while a lesson is actually running.

export interface HubTab {
  meta: PanelMeta; /** Unsaved-work marker (the notes editor). */ badge?: string;
  /** Grouped tutor strip: the tab's own id (a top-tab or sub-tab id) when it is not the panel key. */ id?: string;
  emoji?: string; /** Show the live pulse (a lesson is running). */ dot?: boolean;
  /** Sub-tab pill that opens an existing create flow rather than a plain view. */ action?: boolean;
  /** Extra accessible text after the label (e.g. "3 to mark"). */ sr?: string;
  /** This tab's own colour when it's the ACTIVE tab (a `var(--cat-N)` CSS custom-property NAME, e.g. "--cat-1") —
   *  only ever read for `variant === "top"` (tabGroups.ts's `TopDef.accent`); every other variant ignores it and
   *  keeps the shared brand-gradient pill. */
  accent?: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HubTabs({ tabs, active, onSelect, liveNow = false, label, variant = "flat", idPrefix = "hub-tab-", controls, className = "mb-4", listId, bleed = true }: {
  tabs: HubTab[]; active: string; onSelect: (k: string, how?: "arrow") => void; liveNow?: boolean; label?: string;
  /** "flat": the parent / child strip (unchanged). "top" / "sub": the grouped tutor strip and the row of sub-tabs under it. */
  variant?: "flat" | "top" | "sub"; idPrefix?: string;
  /** id of the element the ACTIVE tab controls (defaults to its tabpanel). */ controls?: (id: string) => string | undefined;
  className?: string; listId?: string;
  /** Pull the scroller out to the page edge (default). Off when the strip sits beside something else in a row. */ bleed?: boolean;
}) {
  const t = useT(); const lbl = useLbl();
  const groupLabel = label ?? t("hubshell.sections");
  const idOf = (x: HubTab) => x.id ?? x.meta.key;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const firstScroll = useRef(true);
  const [edges, setEdges] = useState({ l: false, r: false });

  const measure = useCallback(() => {
    const el = refs.current.get(active);
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight });
  }, [active]);
  const readEdges = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    // scrollLeft runs 0 → negative in RTL: measure the distance from the start edge, not the left edge.
    const at = Math.abs(s.scrollLeft), l = at > 4, r = at + s.clientWidth < s.scrollWidth - 4;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);

  // Re-measure whenever a tab can change width: the live dot appearing on "Live lessons" or the "Unsaved" badge on Lessons shifts
  // every tab to its right, and the list itself (min-w-full) doesn't resize on a wide screen, so the ResizeObserver stays quiet.
  const badges = tabs.map((x) => x.badge ?? "").join("|");
  useLayoutEffect(() => { measure(); readEdges(); }, [measure, readEdges, tabs.length, liveNow, badges]);
  // The pill slides only after its first placement (no swoosh on page load).
  useEffect(() => { const t = requestAnimationFrame(() => setAnimate(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => {
    const l = list.current;
    if (!l || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { measure(); readEdges(); });
    ro.observe(l);
    if (scroller.current) ro.observe(scroller.current);
    for (const el of refs.current.values()) ro.observe(el); // a tab that grows (web font landing, a badge) moves the pill too
    return () => ro.disconnect();
  }, [measure, readEdges, tabs.length]);

  // Keep the selected tab in view (scrolling only the strip — never the page).
  useEffect(() => {
    const s = scroller.current, el = refs.current.get(active);
    if (!s || !el) return;
    // Only move when the tab is actually clipped (then bring it just into view, with a little
    // context either side) — always centring pushed Home off the edge on a wide strip.
        const first = firstScroll.current; firstScroll.current = false;
    // Leave room for the edge fade (56px) so the active tab is never sitting under it.
    // (bounding-box based, so it is right in RTL where scrollLeft runs negative)
    keepInView(s, el, 60, !(first || reducedMotion()));
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    const keys = tabs.map(idOf);
    const i = keys.indexOf(active);
    let n = -1;
    const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) n = (i + 1) % keys.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) n = (i - 1 + keys.length) % keys.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = keys.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onSelect(keys[n], "arrow");
    refs.current.get(keys[n])?.focus();
  };

  const fade = { "--hub-fade-l": edges.l ? "56px" : "0px", "--hub-fade-r": edges.r ? "56px" : "0px" } as CSSProperties;
  // Top-level tutor strip only: the active tab's own accent colours the sliding pill instead of the shared brand
  // gradient (Kaz: Students needs "a distinctive colour"; the rest of the row follows suit). Every other variant,
  // and any top tab with no accent set, keeps the exact brand-gradient pill it always had.
  const activeAccent = variant === "top" ? tabs.find((x) => idOf(x) === active)?.accent : undefined;
  const pillBg = activeAccent
    ? `linear-gradient(180deg, color-mix(in srgb, var(${activeAccent}) 78%, white), var(${activeAccent}))`
    : "linear-gradient(180deg, var(--brand-2), var(--brand))";
  const pillShadow = activeAccent
    ? `0 6px 16px -6px color-mix(in srgb, var(${activeAccent}) 70%, transparent)`
    : "0 6px 16px -6px color-mix(in srgb, var(--brand) 70%, transparent)";

  return (
    <div className={`relative ${className}`}>
      <div ref={scroller} onScroll={readEdges} style={fade}
        className={`hub-fade-x snap-x snap-proximity overflow-x-auto scroll-px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${bleed ? "-mx-3 px-3 sm:-mx-5 sm:px-5" : ""}`}>
        <div ref={list} role="tablist" id={listId} aria-label={groupLabel} onKeyDown={onKey} className="relative flex w-max min-w-full gap-1 pb-2 pt-1">
          <span aria-hidden="true" className={`pointer-events-none absolute left-0 top-1 rounded-full motion-reduce:transition-none ${animate ? "transition-[transform,width] duration-300 ease-[cubic-bezier(.3,.7,.2,1)]" : ""}`}
            style={{
              width: pill?.w ?? 0, height: pill?.h ?? 0, transform: `translateX(${pill?.x ?? 0}px)`, opacity: pill ? 1 : 0,
              background: pillBg,
              boxShadow: pillShadow,
            }} />
          {tabs.map((tab) => {
            const { meta, badge, emoji } = tab;
            const id = idOf(tab);
            const on = id === active;
            const soon = meta.status === "soon";
            const main = variant === "flat" && meta.key === "live" && !soon; // the headline function (Live lessons) gets presence
            const dot = tab.dot ?? (variant === "flat" && meta.key === "live" && liveNow);
            const style: CSSProperties = on
              ? { background: "transparent", color: "var(--on-brand, #fff)", borderColor: "transparent" }
              : soon
                ? { background: "var(--panel)", color: "var(--ink)", borderColor: "var(--ink-3)", borderStyle: "dashed" }
                : main
                  ? { background: "var(--brand-soft)", color: "var(--brand-strong)", borderColor: "var(--brand-line)" }
                  : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" };
            return (
              <button key={id} ref={(el) => { if (el) refs.current.set(id, el); else refs.current.delete(id); }}
                type="button" role="tab" id={`${idPrefix}${id}`} aria-selected={on} aria-controls={on ? (controls ? controls(id) : `hub-tabpanel-${meta.key}`) : undefined}
                aria-disabled={soon || undefined} tabIndex={on ? 0 : -1}
                data-panel={variant === "top" ? undefined : meta.key} data-top={variant === "top" ? id : undefined} data-sub={variant === "sub" ? id : undefined} data-status={meta.status} data-action={tab.action ? "1" : undefined}
                onClick={() => onSelect(id)}
                className={`relative z-10 motion-safe:active:scale-[.97] inline-flex min-h-[44px] ${variant === "sub" ? "lg:min-h-[38px] px-3 text-[12.5px]" : "px-2.5 text-[13px]"} flex-none snap-start items-center gap-1.5 whitespace-nowrap rounded-full border transition-[color,background-color,border-color,transform] duration-200 ${on ? "" : "hover:border-[var(--ink-3)] motion-safe:hover:-translate-y-px"} ${main || on ? "font-extrabold" : "font-bold"} ${FOCUS}`}
                style={style}>
                {emoji ? <span aria-hidden="true" className="text-[18px] leading-none" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{emoji}</span>
                  : <span className="hidden 2xl:inline-flex"><Icon name={PANEL_ICON[meta.key] ?? "sparkle"} size={16} /></span>}
                {lbl(meta.label)}
                {tab.sr && <span className="sr-only"> ({lbl(tab.sr)})</span>}
                {dot && (
                  <span className="relative ms-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="hub-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "var(--green)" }} />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2" style={{ background: "var(--green)", ["--tw-ring-color" as string]: on ? "rgba(255,255,255,.55)" : "var(--surface)" }} />
                  </span>
                )}
                {dot && <span className="sr-only"> ({t("hubshell.liveNow")})</span>}
                {soon && <span className="rounded-full border px-2 py-px text-[11px] font-extrabold uppercase tracking-wide" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)", color: "var(--hub-gold-ink, #7a5300)" }}>{t("hubshell.soon")}</span>}
                {badge && <span className="rounded-full px-1.5 py-px text-[11px] font-extrabold uppercase" style={{ background: "var(--gold)", color: "var(--on-gold, #3a2a05)" }}>{lbl(badge)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
