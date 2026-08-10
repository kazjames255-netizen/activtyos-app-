"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Gmail-style bright backgrounds for an operator surface (Messages, Email, …).
// Each theme sets the page wash (shows around the white cards) and a matching
// hero band; the cards stay opaque white so text always reads. "Classic" is
// the original blue/pink wash. The choice is per-browser (localStorage), keyed
// per-surface so each area can have its own look.
// ─────────────────────────────────────────────────────────────────────────
export interface SurfaceTheme { id: string; name: string; swatch: string; page: string; hero: string }

export const SURFACE_THEMES: SurfaceTheme[] = [
  {
    id: "classic", name: "Classic",
    swatch: "linear-gradient(135deg,#16306e,#3f78d8 60%,#f7f4fb)",
    page: "radial-gradient(130% 85% at 0% 0%, rgba(63,120,216,.14) 0%, transparent 52%), radial-gradient(115% 80% at 100% 0%, rgba(238,31,99,.07) 0%, transparent 46%), linear-gradient(180deg,#eaf1fc 0%,#f5f8fd 42%,#f7f4fb 100%)",
    hero: "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#ffffff 100%)",
  },
  {
    id: "ocean", name: "Ocean",
    swatch: "linear-gradient(135deg,#0b4a86,#2f9fe0 55%,#a8e4ff)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.6) 0%, transparent 55%), linear-gradient(165deg,#7fd0ff 0%,#3aa0ea 45%,#1f73c7 100%)",
    hero: "linear-gradient(120deg,#0b4a86 0%,#2f9fe0 58%,#a8e4ff 100%)",
  },
  {
    id: "sunset", name: "Sunset",
    swatch: "linear-gradient(135deg,#7a1e57,#e0537a 55%,#ffb27a)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#ffd39e 0%,#ff9a76 45%,#f16d9a 100%)",
    hero: "linear-gradient(120deg,#7a1e57 0%,#e0537a 55%,#ffb27a 100%)",
  },
  {
    id: "aurora", name: "Aurora",
    swatch: "linear-gradient(135deg,#0d3b52,#1f9b8a 50%,#8ef0c8)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#b6ffd9 0%,#57d1c0 40%,#7b7bf0 100%)",
    hero: "linear-gradient(120deg,#0d3b52 0%,#1f9b8a 52%,#8ef0c8 100%)",
  },
  {
    id: "candy", name: "Candy",
    swatch: "linear-gradient(135deg,#6d1f7a,#c74bd0 55%,#ffb3e6)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#ffc6f0 0%,#e98ce0 45%,#a86be6 100%)",
    hero: "linear-gradient(120deg,#6d1f7a 0%,#c74bd0 55%,#ffb3e6 100%)",
  },
  {
    id: "citrus", name: "Citrus",
    swatch: "linear-gradient(135deg,#7a5200,#f2a71e 55%,#fff07a)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#fff29e 0%,#ffd447 45%,#9ede4a 100%)",
    hero: "linear-gradient(120deg,#7a5200 0%,#f2a71e 55%,#fff07a 100%)",
  },
  {
    id: "lagoon", name: "Lagoon",
    swatch: "linear-gradient(135deg,#064f52,#12a4a0 55%,#8ff0e6)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#a9fff0 0%,#43d6c8 45%,#1f9bb0 100%)",
    hero: "linear-gradient(120deg,#064f52 0%,#12a4a0 55%,#8ff0e6 100%)",
  },
  {
    id: "bubblegum", name: "Bubblegum",
    swatch: "linear-gradient(135deg,#7a1f56,#ff6fae 50%,#7fb0ff)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#ffc2e0 0%,#ff8fc4 40%,#8fb8ff 100%)",
    hero: "linear-gradient(120deg,#7a1f56 0%,#ff6fae 52%,#7fb0ff 100%)",
  },
  {
    id: "coral", name: "Coral Reef",
    swatch: "linear-gradient(135deg,#8a2f2a,#ff7a66 50%,#7fe6d8)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#ffc1b3 0%,#ff8f7a 45%,#4fd6c4 100%)",
    hero: "linear-gradient(120deg,#8a2f2a 0%,#ff7a66 52%,#7fe6d8 100%)",
  },
  {
    id: "meadow", name: "Meadow",
    swatch: "linear-gradient(135deg,#1f5a2a,#4caf50 55%,#c6f57a)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#d6ff9e 0%,#8ede5a 45%,#3fb87a 100%)",
    hero: "linear-gradient(120deg,#1f5a2a 0%,#4caf50 55%,#c6f57a 100%)",
  },
  {
    id: "grape", name: "Grape Soda",
    swatch: "linear-gradient(135deg,#3a1a6e,#7b3ff0 55%,#d06bff)",
    page: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.55) 0%, transparent 55%), linear-gradient(160deg,#e0c6ff 0%,#b07bff 45%,#7b4fe0 100%)",
    hero: "linear-gradient(120deg,#3a1a6e 0%,#7b3ff0 55%,#d06bff 100%)",
  },
];

const ACCENT = "#ee1f63"; // brand pink — active ring + tick

// The saved theme id is external state (localStorage), read via
// useSyncExternalStore so it's SSR-safe (server → "classic", client re-reads
// after hydration) without a setState-in-effect. Same-tab writes notify these
// listeners directly; cross-tab writes arrive via the "storage" event.
const themeListeners = new Set<() => void>();
function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  if (typeof window !== "undefined") window.addEventListener("storage", cb);
  return () => { themeListeners.delete(cb); if (typeof window !== "undefined") window.removeEventListener("storage", cb); };
}
function readThemeId(storageKey: string): string {
  try { const s = localStorage.getItem(storageKey); return s && SURFACE_THEMES.some((t) => t.id === s) ? s : "classic"; } catch { return "classic"; }
}

/**
 * Theme state + a ready-to-render 🎨 Theme control (button + popover) for an
 * operator surface. Drop `control` into a hero's actions slot and apply
 * `theme.page` / `theme.hero` to the page container + hero band.
 *
 * The popover is positioned `fixed` from the button's rect so it escapes the
 * hero's `overflow-hidden` clip; it closes on scroll/resize so it can't hang
 * detached. Starts on "classic" for a stable first render, then hydrates the
 * saved pick from localStorage (no SSR mismatch).
 */
export function useSurfaceTheme(storageKey: string): { theme: SurfaceTheme; control: React.ReactNode } {
  const themeId = useSyncExternalStore(subscribeTheme, () => readThemeId(storageKey), () => "classic");
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const theme = SURFACE_THEMES.find((t) => t.id === themeId) ?? SURFACE_THEMES[0];

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    try { localStorage.setItem(storageKey, id); } catch { /* private mode */ }
    themeListeners.forEach((l) => l()); // re-read snapshot in this tab
  };
  const toggle = () => setOpen((o) => {
    const next = !o;
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    return next;
  });

  const control = (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="true" aria-expanded={open} title="Change the background theme"
        className="rounded-full border border-white/70 bg-white/10 px-4 py-2 text-[13px] font-bold text-white backdrop-blur-sm transition hover:bg-white/20">🎨 Theme</button>
      {open && (
        <>
          {/* click-away backdrop */}
          <button type="button" aria-label="Close theme picker" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div style={{ position: "fixed", top: pos.top, right: pos.right }} className="z-50 w-[280px] rounded-2xl border border-[var(--line)] bg-white p-3 text-left shadow-[0_18px_40px_-12px_rgba(20,20,60,.4)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-[var(--ink)]">Pick a theme</span>
              <span className="text-[10.5px] text-[var(--ink-3)]">Saved on this device</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SURFACE_THEMES.map((t) => {
                const on = t.id === themeId;
                return (
                  <button key={t.id} type="button" onClick={() => pick(t.id)} className="group flex flex-col gap-1 rounded-xl p-1 text-left transition-colors hover:bg-[var(--panel)]">
                    <span className="relative block h-11 w-full overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background: t.swatch, boxShadow: on ? `0 0 0 2px ${ACCENT}` : undefined }}>
                      {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-extrabold shadow" style={{ color: ACCENT }}>✓</span>}
                    </span>
                    <span className={`px-0.5 text-[11px] ${on ? "font-extrabold text-[var(--ink)]" : "font-semibold text-[var(--ink-2)]"}`}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return { theme, control };
}
