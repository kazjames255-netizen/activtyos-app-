"use client";
// Shared right-to-left helpers for the Teaching / Learning Hub (ar, ur). The <html dir> is set by lib/i18n/provider.tsx; everything here
// reads it so a component never hard-codes a direction. Layout uses logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/
// border-s/e, see docs/i18n-glossary.md "RTL"); this file covers what CSS alone cannot: scroll maths, mirrored glyphs, isolated Latin runs.
import type { ReactNode } from "react";

/** True when the document is laid out right-to-left (safe during SSR: false). */
export const isRtlDoc = (): boolean => typeof document !== "undefined" && document.documentElement.dir === "rtl";

/** Physical "more content" flags for a horizontal scroller. `scrollLeft` is 0 at the start edge and runs NEGATIVE towards the end in RTL, so a
 *  naive `scrollLeft > 4` reports the wrong side. `left`/`right` are physical (for a fade painted on the left/right edge). */
export function scrollEdges(s: HTMLElement): { left: boolean; right: boolean } {
  const max = s.scrollWidth - s.clientWidth;
  if (max <= 4) return { left: false, right: false };
  const sl = s.scrollLeft;
  if (isRtlDoc()) return { left: max + sl > 4, right: -sl > 4 };
  return { left: sl > 4, right: sl + s.clientWidth < s.scrollWidth - 4 };
}

/** Scroll a horizontal strip just enough to bring `el` fully into view (with `pad` px of context), in either direction, without ever
 *  scrolling the page. Uses bounding boxes + scrollBy so it does not depend on the RTL scrollLeft sign convention. */
export function keepInView(strip: HTMLElement, el: HTMLElement, pad = 60, smooth = true): void {
  const sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
  const behind = sr.left + pad - er.left;   // > 0: the item starts left of the visible band
  const ahead = er.right - (sr.right - pad); // > 0: the item ends right of the visible band
  const delta = behind > 0 ? -behind : ahead > 0 ? ahead : 0;
  if (delta) strip.scrollBy({ left: delta, behavior: smooth ? "smooth" : "auto" });
}

/** A directional glyph that mirrors in RTL: `dir="forward"` → (→ in LTR, ← in RTL), `dir="back"` the opposite. Use for text arrows and
 *  chevrons (›, ▶) that mean "next / back"; NOT for chemistry/maths arrows, which stay left-to-right. */
export function DirArrow({ dir = "forward", children, className = "" }: { dir?: "forward" | "back"; children?: ReactNode; className?: string }) {
  const glyph = children ?? (dir === "forward" ? "→" : "←");
  return <span aria-hidden className={`inline-block rtl:-scale-x-100 ${className}`}>{glyph}</span>;
}

/** Keep an inline Latin/number run (a name, a code, a percentage) from re-ordering the surrounding RTL sentence. */
export function Bidi({ children }: { children: ReactNode }) {
  return <bdi>{children}</bdi>;
}

/** The same isolation for plain-string templates (aria-labels, titles) where JSX is not available: FSI … PDI. */
export const isolate = (s: string | number): string => `⁨${s}⁩`;
