"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { DISPLAY, HERO_BG } from "./teachKit";
import { FOCUS } from "./kit";
import type { SubDef, TopDef } from "./tabGroups";
import { useT } from "@/lib/i18n/provider";
import { useLbl } from "./hubLabel";
import { keepInView } from "./rtl";

// The grouped tutor hub's ONE card per top tab: a full-width, hero-styled gradient card with every sub-section of the tab laid across it
// in a row (emoji, title, one short line, a live count where the hub already has one). The chosen sub-section's page sits directly
// underneath, full width. At phone width the row scrolls sideways (edge fade, active item scrolled into view); from tablet up the items
// share the width and only wrap to a second row when they truly cannot fit. Horizontal WAI-ARIA tabs: roving tabindex, ←/→ Home/End;
// the selected item is a filled white tile with a check and bold type (not colour alone).

/** Real colour emoji glyphs on a colour-washed tile (never a flat white tile, never a monochrome icon). */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** Each sub-section gets its own accent (à la subject tiles), stable per id — independent of a tutor's subject-colour
 *  settings (these aren't subjects), just a fixed curated palette so the row reads as colourful and consistent. */
const ICON_ACCENTS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#db2777", "#0d9488", "#d97706", "#4f46e5", "#dc2626", "#0891b2"];
const hashId = (id: string) => [...id].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
const iconAccent = (id: string) => ICON_ACCENTS[hashId(id) % ICON_ACCENTS.length]!;
/** A soft colour-washed gradient tile behind the emoji glyph (the same visual language as the Lessons area's subject tiles). */
const iconTileStyle = (accent: string): CSSProperties => ({
  fontFamily: EMOJI_FONT,
  background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 32%, #fff) 0%, color-mix(in srgb, ${accent} 10%, #fff) 100%)`,
  boxShadow: `0 1px 2px rgba(0,0,0,.08), inset 0 0 0 1.5px color-mix(in srgb, ${accent} 38%, transparent)`,
});

export interface ItemInfo { count?: string; live?: boolean }

export function SubMenuCard({ top, subs, active, info, onSelect, listId, controls }: {
  top: TopDef; subs: SubDef[]; active: string; info: Record<string, ItemInfo | undefined>;
  onSelect: (d: SubDef, how?: "arrow") => void; listId: string; controls: string;
}) {
  const t = useT(); const lbl = useLbl();
  const shortOf = (d: SubDef): string => { if (!d.short) return ""; const k = `hubshell.short_${d.id}`; const v = t(k); return v === k ? d.short : v; };
  const topLabel = lbl(top.label);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const readEdges = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    const at = Math.abs(s.scrollLeft), l = at > 4, r = at + s.clientWidth < s.scrollWidth - 4;
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
    keepInView(s, el, 60, !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [active]);

  const onKey = (e: KeyboardEvent) => {
    const i = subs.findIndex((d) => d.id === active);
    let n = -1;
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) n = (i + 1) % subs.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) n = (i - 1 + subs.length) % subs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = subs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onSelect(subs[n], "arrow");
    document.getElementById(`hub-subtab-${subs[n].id}`)?.focus();
  };
  const fade = { "--hub-fade-l": edges.l ? "48px" : "0px", "--hub-fade-r": edges.r ? "48px" : "0px" } as CSSProperties;
  return (
    <section aria-label={t("hubshell.topSections", { name: topLabel })} data-testid="hub-submenu" className="relative mb-4 overflow-hidden rounded-3xl px-3.5 pb-3.5 pt-3 shadow-[var(--shadow-sm)]" style={{ ...HERO_BG, color: "var(--on-brand, #fff)" }}>
      <span aria-hidden="true" className="pointer-events-none absolute -end-2 -top-5 select-none text-[104px] leading-none opacity-[0.12]" style={{ fontFamily: EMOJI_FONT }}>{top.emoji}</span>
      <div className="relative px-1 pb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-80">{top.emoji} {topLabel}</div>
      <div ref={scroller} onScroll={readEdges} style={fade} className="hub-fade-x relative -mx-3.5 overflow-x-auto px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" id={listId} aria-label={t("hubshell.topSections", { name: topLabel })} onKeyDown={onKey}
          className="flex w-max min-w-full flex-wrap gap-2 md:w-auto md:min-w-0">
          {subs.map((d) => {
            const on = d.id === active, i = info[d.id], accent = iconAccent(d.id);
            const minor = !!d.minor;
            return (
              <button key={d.id} type="button" role="tab" id={`hub-subtab-${d.id}`} data-sub={d.id} data-panel={d.key} data-action={d.action ? "1" : undefined} data-minor={minor ? "1" : undefined}
                aria-selected={on} aria-controls={on ? controls : undefined} tabIndex={on ? 0 : -1} onClick={() => onSelect(d)}
                className={`flex flex-none items-center gap-2.5 rounded-2xl border text-start transition-colors motion-reduce:transition-none ${FOCUS} ${
                  minor
                    ? "ms-auto min-h-[48px] w-auto self-center px-2 py-1.5"
                    : "min-h-[64px] w-[196px] px-2.5 py-2 md:w-auto md:flex-1 md:basis-[156px]"
                } ${on ? "border-transparent bg-white shadow-md" : "border-white/25 bg-white/10 hover:bg-white/20"}`}
                style={{ ...(on ? { color: "var(--brand-strong)" } : undefined), order: minor ? 1 : 0 }}>
                <span aria-hidden="true" className={`grid flex-none place-items-center rounded-xl text-[26px] leading-none ${minor ? "h-8 w-8 text-[18px]" : "h-11 w-11"}`} style={iconTileStyle(accent)}>{d.emoji}</span>
                {minor ? (
                  <span className={`text-[12.5px] leading-tight ${on ? "font-extrabold" : "font-bold"}`} style={DISPLAY}>{lbl(d.label)}</span>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13.5px] leading-tight ${on ? "font-extrabold" : "font-bold"}`} style={DISPLAY}>{lbl(d.label)}</span>
                    {/* `t()` returns the raw key itself when no translation exists (see useLbl's own `v === k ? s : v`
                        check) — this manually-built `short_<id>` key has no fallback of its own, so a sub-tab whose id
                        has no catalogue entry yet (e.g. "progress" freshly moved into this group) rendered the literal
                        key "hubshell.short_progress" on screen instead of its English short text. Found 28 Sep 2026. */}
                    <span className="mt-0.5 line-clamp-3 block text-[11.5px] font-semibold leading-snug opacity-80" title={shortOf(d)}>{shortOf(d)}</span>
                    {i?.count && (
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-extrabold ${on ? "" : "border border-white/25 bg-white/15"}`} style={on ? { background: "var(--brand-soft)", color: "var(--brand-strong)" } : undefined}>
                        {i.live && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: "var(--green)" }} />}{i.count}
                      </span>
                    )}
                  </span>
                )}
                {on && <span aria-hidden="true" className="flex-none text-[15px] font-extrabold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
