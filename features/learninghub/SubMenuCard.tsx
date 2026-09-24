"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { DISPLAY, HERO_BG } from "./teachKit";
import { FOCUS } from "./kit";
import type { SubDef, TopDef } from "./tabGroups";

// The grouped tutor hub's ONE card per top tab: a full-width, hero-styled gradient card with every sub-section of the tab laid across it
// in a row (emoji, title, one short line, a live count where the hub already has one). The chosen sub-section's page sits directly
// underneath, full width. At phone width the row scrolls sideways (edge fade, active item scrolled into view); from tablet up the items
// share the width and only wrap to a second row when they truly cannot fit. Horizontal WAI-ARIA tabs: roving tabindex, ←/→ Home/End;
// the selected item is a filled white tile with a check and bold type (not colour alone).

/** Real colour emoji glyphs on a solid white tile (never a monochrome icon on the dark card). */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export interface ItemInfo { count?: string; live?: boolean }

export function SubMenuCard({ top, subs, active, info, onSelect, listId, controls }: {
  top: TopDef; subs: SubDef[]; active: string; info: Record<string, ItemInfo | undefined>;
  onSelect: (d: SubDef, how?: "arrow") => void; listId: string; controls: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const readEdges = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    const l = s.scrollLeft > 4, r = s.scrollLeft + s.clientWidth < s.scrollWidth - 4;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);
  useLayoutEffect(() => { readEdges(); }, [readEdges, subs.length]);
  useEffect(() => {
    const s = scroller.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(readEdges); ro.observe(s);
    return () => ro.disconnect();
  }, [readEdges]);
  // Keep the chosen item in view (scrolling only the row, never the page), clear of the edge fade.
  useEffect(() => {
    const s = scroller.current, el = document.getElementById(`hub-subtab-${active}`);
    if (!s || !el || s.scrollWidth <= s.clientWidth + 1) return;
    const from = el.offsetLeft - 60, to = el.offsetLeft + el.offsetWidth + 60;
    if (from >= s.scrollLeft && to <= s.scrollLeft + s.clientWidth) return;
    const left = from < s.scrollLeft ? Math.max(0, from) : to - s.clientWidth;
    s.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  const onKey = (e: KeyboardEvent) => {
    const i = subs.findIndex((d) => d.id === active);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % subs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + subs.length) % subs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = subs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onSelect(subs[n], "arrow");
    document.getElementById(`hub-subtab-${subs[n].id}`)?.focus();
  };
  const fade = { "--hub-fade-l": edges.l ? "48px" : "0px", "--hub-fade-r": edges.r ? "48px" : "0px" } as CSSProperties;
  return (
    <section aria-label={`${top.label} sections`} data-testid="hub-submenu" className="relative mb-4 overflow-hidden rounded-3xl px-3.5 pb-3.5 pt-3 shadow-[var(--shadow-sm)]" style={{ ...HERO_BG, color: "var(--on-brand, #fff)" }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-5 select-none text-[104px] leading-none opacity-[0.12]" style={{ fontFamily: EMOJI_FONT }}>{top.emoji}</span>
      <div className="relative px-1 pb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-80">{top.emoji} {top.label}</div>
      <div ref={scroller} onScroll={readEdges} style={fade} className="hub-fade-x relative -mx-3.5 overflow-x-auto px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" id={listId} aria-label={`${top.label} sections`} onKeyDown={onKey}
          className="flex w-max min-w-full gap-2 md:grid md:w-auto md:min-w-0 md:[grid-template-columns:repeat(auto-fill,minmax(min(100%,156px),1fr))]">
          {subs.map((d) => {
            const on = d.id === active, i = info[d.id];
            return (
              <button key={d.id} type="button" role="tab" id={`hub-subtab-${d.id}`} data-sub={d.id} data-panel={d.key} data-action={d.action ? "1" : undefined}
                aria-selected={on} aria-controls={on ? controls : undefined} tabIndex={on ? 0 : -1} onClick={() => onSelect(d)}
                className={`flex min-h-[64px] w-[196px] flex-none items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-colors motion-reduce:transition-none md:w-auto ${FOCUS} ${on ? "border-transparent bg-white shadow-md" : "border-white/25 bg-white/10 hover:bg-white/20"}`}
                style={on ? { color: "var(--brand-strong)" } : undefined}>
                <span aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white text-[26px] leading-none shadow-sm ring-1 ring-black/10" style={{ fontFamily: EMOJI_FONT }}>{d.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] leading-tight ${on ? "font-extrabold" : "font-bold"}`} style={DISPLAY}>{d.label}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] font-semibold opacity-80">{d.short}</span>
                  {i?.count && (
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-extrabold ${on ? "" : "border border-white/25 bg-white/15"}`} style={on ? { background: "var(--brand-soft)", color: "var(--brand-strong)" } : undefined}>
                      {i.live && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: "var(--green)" }} />}{i.count}
                    </span>
                  )}
                </span>
                {on && <span aria-hidden="true" className="flex-none text-[15px] font-extrabold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
