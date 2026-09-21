"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FOCUS, Icon, PANEL_ICON } from "./kit";
import type { PanelMeta } from "./panelTypes";

// The hub's tab strip: one horizontally scrollable row (never a wall of wrapped
// pills on a phone) with a sliding pill under the active tab, edge fades that
// only appear where there's more to scroll to, and the active tab scrolled to
// the centre. WAI-ARIA tabs with roving tabindex and ←/→/Home/End. "Soon" tabs
// stay readable and clickable — they open a preview of what's coming — but say
// so in words, not just opacity. A pulsing green dot marks Live lessons only
// while a lesson is actually running.

export interface HubTab { meta: PanelMeta; /** Unsaved-work marker (the notes editor). */ badge?: string }

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HubTabs({ tabs, active, onSelect, liveNow = false, label = "Sections" }: { tabs: HubTab[]; active: PanelMeta["key"]; onSelect: (k: PanelMeta["key"]) => void; liveNow?: boolean; label?: string }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const [edges, setEdges] = useState({ l: false, r: false });

  const measure = useCallback(() => {
    const el = refs.current.get(active);
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight });
  }, [active]);
  const readEdges = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    const l = s.scrollLeft > 4, r = s.scrollLeft + s.clientWidth < s.scrollWidth - 4;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);

  // Re-measure whenever a tab can change width: the live dot appearing on "Live lessons" or the "Unsaved" badge on Lessons shifts
  // every tab to its right, and the list itself (min-w-full) doesn't resize on a wide screen, so the ResizeObserver stays quiet.
  const badges = tabs.map((t) => t.badge ?? "").join("|");
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
    const pad = 28, from = el.offsetLeft - pad, to = el.offsetLeft + el.offsetWidth + pad;
    if (from >= s.scrollLeft && to <= s.scrollLeft + s.clientWidth) return;
    const left = from < s.scrollLeft ? Math.max(0, from) : to - s.clientWidth;
    s.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    const keys = tabs.map((t) => t.meta.key);
    const i = keys.indexOf(active);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + keys.length) % keys.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = keys.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onSelect(keys[n]);
    refs.current.get(keys[n])?.focus();
  };

  const fade = { "--hub-fade-l": edges.l ? "36px" : "0px", "--hub-fade-r": edges.r ? "36px" : "0px" } as CSSProperties;

  return (
    <div className="relative mb-4">
      <div ref={scroller} onScroll={readEdges} style={fade}
        className="hub-fade-x -mx-3 snap-x snap-proximity overflow-x-auto scroll-px-10 px-3 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
        <div ref={list} role="tablist" aria-label={label} onKeyDown={onKey} className="relative flex w-max min-w-full gap-1 pb-2 pt-1">
          <span aria-hidden="true" className={`pointer-events-none absolute left-0 top-1 rounded-full motion-reduce:transition-none ${animate ? "transition-[transform,width] duration-300 ease-[cubic-bezier(.3,.7,.2,1)]" : ""}`}
            style={{
              width: pill?.w ?? 0, height: pill?.h ?? 0, transform: `translateX(${pill?.x ?? 0}px)`, opacity: pill ? 1 : 0,
              background: "linear-gradient(180deg, var(--brand-2), var(--brand))",
              boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--brand) 70%, transparent)",
            }} />
          {tabs.map(({ meta, badge }) => {
            const on = meta.key === active;
            const soon = meta.status === "soon";
            const main = meta.key === "live" && !soon; // the headline function (Live lessons) gets presence
            const dot = meta.key === "live" && liveNow;
            const style: CSSProperties = on
              ? { background: "transparent", color: "#fff", borderColor: "transparent" }
              : soon
                ? { background: "var(--panel)", color: "var(--ink)", borderColor: "var(--ink-3)", borderStyle: "dashed" }
                : main
                  ? { background: "var(--brand-soft)", color: "var(--brand-strong)", borderColor: "var(--brand-line)" }
                  : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" };
            return (
              <button key={meta.key} ref={(el) => { if (el) refs.current.set(meta.key, el); else refs.current.delete(meta.key); }}
                type="button" role="tab" id={`hub-tab-${meta.key}`} aria-selected={on} aria-controls={on ? `hub-tabpanel-${meta.key}` : undefined}
                aria-disabled={soon || undefined} tabIndex={on ? 0 : -1}
                data-panel={meta.key} data-status={meta.status}
                onClick={() => onSelect(meta.key)}
                className={`relative z-10 motion-safe:active:scale-[.97] inline-flex min-h-[44px] flex-none snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[13px] lg:px-3 transition-[color,background-color,border-color,transform] duration-200 ${on ? "" : "hover:border-[var(--ink-3)] motion-safe:hover:-translate-y-px"} ${main || on ? "font-extrabold" : "font-bold"} ${FOCUS}`}
                style={style}>
                <span className="hidden lg:inline-flex"><Icon name={PANEL_ICON[meta.key] ?? "sparkle"} size={16} /></span>
                {meta.label}
                {dot && (
                  <span className="relative ml-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="hub-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "var(--green)" }} />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2" style={{ background: "var(--green)", ["--tw-ring-color" as string]: on ? "rgba(255,255,255,.55)" : "var(--surface)" }} />
                  </span>
                )}
                {dot && <span className="sr-only"> (live now)</span>}
                {soon && <span className="rounded-full border px-2 py-px text-[11px] font-extrabold uppercase tracking-wide" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)", color: "#7a5300" }}>Soon</span>}
                {badge && <span className="rounded-full px-1.5 py-px text-[11px] font-extrabold uppercase" style={{ background: "var(--gold)", color: "#3a2a05" }}>{badge}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
