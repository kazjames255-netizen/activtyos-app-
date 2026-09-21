"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../kit";
import type { Pic } from "./api";
import { display, FOCUS } from "./ui";

// A question's picture, everywhere a question shows. Signed URLs expire, so a
// failed load asks the caller to refetch (`onRefresh`) ONCE and retries; if it
// still fails the child sees a calm "couldn't load" tile with a Try again button
// instead of a broken-image icon. Tap/click opens a lightbox (focus-trapped, Esc
// closes, the alt text is shown under the picture).

type Fit = "wide" | "thumb" | "tile";

export function QImage({ pic, alt, fit = "wide", onRefresh, className = "", zoom = true, caption }: {
  pic: Pic | null | undefined; alt?: string; fit?: Fit; onRefresh?: () => Promise<unknown> | void; className?: string; zoom?: boolean; caption?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const refreshing = useRef(false);
  const url = pic?.url;
  const text = alt ?? pic?.alt ?? "";

  useEffect(() => { setState("loading"); }, [url]);

  const retry = useCallback(async (manual: boolean) => {
    if (refreshing.current) return;
    refreshing.current = true;
    setState("loading");
    try { await onRefresh?.(); } catch { /* the retry below decides */ }
    refreshing.current = false;
    setAttempt((n) => (manual ? 0 : n) + 1);
  }, [onRefresh]);

  if (!url) return <div className={`grid place-items-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] text-[var(--ink-3)] ${fit === "thumb" ? "h-14 w-14" : "h-28"} ${className}`} role="img" aria-label={text || "Picture"}><Icon name="image" size={fit === "thumb" ? 20 : 28} strokeWidth={1.5} /></div>;

  const box = fit === "thumb" ? "h-14 w-14 rounded-lg" : fit === "tile" ? "aspect-[4/3] w-full rounded-t-[10px]" : "max-h-[340px] min-h-[120px] w-full rounded-2xl";

  if (state === "failed") {
    return (
      <div role="group" aria-label="Picture couldn't load" className={`flex flex-col items-center justify-center gap-1.5 border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-center ${fit === "thumb" ? "h-14 w-14 rounded-lg" : `min-h-[120px] w-full ${fit === "tile" ? "rounded-t-[10px]" : "rounded-2xl"}`} ${className}`}>
        <Icon name="image" size={fit === "thumb" ? 16 : 22} strokeWidth={1.5} className="text-[var(--ink-3)]" />
        {fit !== "thumb" && <span className="text-[12px] font-semibold text-[var(--ink-2)]">The picture didn&apos;t load</span>}
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void retry(true); }} className={`${fit === "thumb" ? "text-[11px]" : "min-h-[44px] px-3 text-[12px]"} rounded-lg font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>Try again</button>
      </div>
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={`${url}#${attempt}`} src={url} alt={text} loading="lazy" draggable={false}
      onLoad={() => setState("ok")}
      onError={() => { if (attempt === 0) void retry(false); else setState("failed"); }}
      className={`${box} bg-[var(--panel)] object-contain transition-opacity duration-300 motion-reduce:transition-none ${state === "ok" ? "opacity-100" : "opacity-0"}`} />
  );

  return (
    <>
      <div className={`relative ${fit === "thumb" ? "h-14 w-14 flex-none" : fit === "tile" ? "w-full" : "w-full"} ${className}`}>
        {state === "loading" && <div aria-hidden className={`absolute inset-0 animate-pulse bg-[var(--line)] ${fit === "thumb" ? "rounded-lg" : "rounded-2xl"}`} />}
        {zoom ? (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} aria-label={`Enlarge picture${text ? `: ${text}` : ""}`}
            className={`group relative block w-full cursor-zoom-in overflow-hidden ${fit === "thumb" ? "h-14 w-14 rounded-lg" : fit === "tile" ? "rounded-t-[10px]" : "rounded-2xl border border-[var(--line)]"} ${FOCUS}`}>
            {img}
            {fit !== "thumb" && state === "ok" && <span aria-hidden className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)]/90 text-[var(--ink)] opacity-90 shadow-[var(--shadow-sm)] transition-opacity group-hover:opacity-100"><Icon name="search" size={15} strokeWidth={2.2} /></span>}
          </button>
        ) : img}
        {caption && state === "ok" && <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{caption}</div>}
      </div>
      {open && <Lightbox url={url} alt={text} onClose={() => setOpen(false)} />}
    </>
  );
}

const SCALES = [1, 1.6, 2.4, 3.5];

/** Full-screen viewer: focus trapped, Esc closes (without closing a dialog underneath), zoom in / out. */
export function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zi, setZi] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []);

  const scale = SCALES[zi];
  if (typeof document === "undefined") return null;
  const btn = `grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow)] hover:bg-[var(--panel)] disabled:opacity-40 ${FOCUS}`;
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={alt ? `Picture: ${alt}` : "Picture"} className="fixed inset-0 z-[500] flex flex-col bg-[color-mix(in_srgb,var(--ink)_82%,transparent)]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex items-center justify-end gap-2 p-3" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Zoom out" disabled={zi === 0} onClick={() => setZi((z) => Math.max(0, z - 1))} className={btn}><span aria-hidden className="text-[22px] font-bold leading-none">−</span></button>
        <span className="min-w-[44px] text-center text-[12px] font-extrabold tabular-nums text-white" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zi === SCALES.length - 1} onClick={() => setZi((z) => Math.min(SCALES.length - 1, z + 1))} className={btn}><span aria-hidden className="text-[22px] font-bold leading-none">+</span></button>
        <button type="button" aria-label="Close picture" data-autofocus onClick={onClose} className={btn}><Icon name="close" size={20} strokeWidth={2.2} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex min-h-full items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} onClick={() => setZi((z) => (z + 1) % SCALES.length)} draggable={false}
            className={`select-none rounded-xl bg-[var(--surface)] object-contain shadow-[var(--shadow-pop)] ${zi === 0 ? "max-h-[calc(100dvh-160px)] max-w-full cursor-zoom-in" : "max-w-none cursor-zoom-out"}`}
            style={zi === 0 ? undefined : { width: `${scale * 100}%` }} />
        </div>
      </div>
      {alt && (
        <div className="px-4 pb-4 pt-1 text-center" onMouseDown={(e) => e.stopPropagation()}>
          <p className="mx-auto m-0 max-w-[640px] rounded-xl bg-[var(--surface)]/95 px-4 py-2.5 text-[13px] leading-snug text-[var(--ink)]" style={display}><span className="mr-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Picture description</span>{alt}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
