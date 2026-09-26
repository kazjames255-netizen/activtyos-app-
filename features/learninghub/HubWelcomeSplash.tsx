"use client";

import { useEffect, useRef, useState } from "react";

// Welcome splash for the Teaching Hub — shown every time the sidebar nav
// takes someone into the Hub, then dissolves to reveal the real dashboard
// underneath.
//
// Trigger rule: the Hub's view component (registered per-slug in
// lib/view-registry.tsx, routed by app/[portal]/[view]/page.tsx) is a
// distinct component per sidebar destination, so React unmounts/remounts it
// on every client-side navigation between views — including navigating away
// from the Hub and back via the sidebar. That mount is a reliable 1:1 proxy
// for "the user just landed on the Hub", confirmed by manual testing
// (console-logged mount timestamps against repeated sidebar clicks: a fresh
// mount fired on first load, on a hard reload, AND on Dashboard → Teaching
// Hub via the sidebar link — every time, no missed or duplicate mounts).
// Switching the Hub's own internal tabs (Home/Lessons/Students/…) is just
// local state, not a route change, so it does NOT remount this and does NOT
// re-trigger the splash — matching "only when I click the sidebar tab".
//
// There used to be a sessionStorage flag suppressing all but the first
// mount per browser tab. That's what made this look "random": reusing a
// tab across visits silently swallowed the splash, while a fresh tab or a
// hard refresh always showed it. Intent is for it to play every time the
// Hub is reached from the sidebar, so the suppression is gone — a fresh
// mount already means a fresh visit, nothing more to gate on.
//
// Dismiss: a minimum show time so it never feels like a flash of nothing,
// then either an auto-hide timer or the user's first click/key — whichever
// comes first. A pure timer alone would be too rigid; click-only risks
// nobody ever noticing it can be dismissed.

const MIN_MS = 900;
const AUTO_MS = 3400;
const EXIT_MS = 900;

export function HubWelcomeSplash() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard, not state: dismiss() can legitimately be called twice in quick succession (the auto-hide
  // timer firing right as the user also taps) — a state-based guard reads the still-stale "not leaving yet" value
  // in that window, so BOTH calls would schedule their own exitTimer, and the later one could call setShow(false)
  // before the first's animation actually finished, cutting the vanish off partway through (looked like it never
  // played). A ref flips the instant the first call runs, so every call after it is a true no-op.
  const dismissing = useRef(false);

  useEffect(() => {
    shownAt.current = Date.now();
    const auto = setTimeout(dismiss, AUTO_MS);
    return () => {
      clearTimeout(auto);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only
  }, []);

  const dismiss = () => {
    if (dismissing.current) return;
    dismissing.current = true;
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, MIN_MS - elapsed);
    exitTimer.current = setTimeout(() => {
      setLeaving(true);
      exitTimer.current = setTimeout(() => setShow(false), EXIT_MS);
    }, wait);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to the Teaching and Learning Hub"
      onClick={dismiss}
      onKeyDown={dismiss}
      tabIndex={-1}
      className={`fixed inset-0 z-[500] flex cursor-pointer items-center justify-center overflow-hidden ${leaving ? "hub-welcome-out-bg" : "hub-welcome-in"}`}
      style={{
        background: "var(--side-bg)",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), var(--side-bg)",
        backgroundSize: "18px 18px, cover",
        backgroundRepeat: "repeat, no-repeat",
      }}
    >
      <style>{`
        @keyframes hub-welcome-in { from { opacity: 0; } to { opacity: 1; } }
        .hub-welcome-in { animation: hub-welcome-in .5s cubic-bezier(.2,.8,.2,1) both; }

        /* Exit is an iris-close, not a fade: the whole panel (background + artwork) shrinks away through a
           shrinking circular window centred on the artwork, so the real Hub dashboard underneath is visibly
           revealed as it closes — an unmistakable "vanish", not a flat dissolve. A brief brightness flash on the
           artwork right before the window fully closes reads as a flourish rather than a mechanical wipe. Applied
           to the whole outer panel (class hub-welcome-out-bg) via clip-path so the reveal is real geometry, not opacity. */
        @keyframes hub-welcome-out-bg {
          0% { clip-path: circle(150% at 50% 46%); }
          70% { clip-path: circle(38% at 50% 46%); }
          100% { clip-path: circle(0% at 50% 46%); }
        }
        @keyframes hub-welcome-out-img {
          0% { transform: scale(1); filter: brightness(1) blur(0); }
          62% { transform: scale(1.05); filter: brightness(1) blur(0); }
          82% { transform: scale(1.14); filter: brightness(1.9) blur(1px); }
          100% { transform: scale(1.22); filter: brightness(2.6) blur(2px); opacity: 0; }
        }
        .hub-welcome-out-bg { animation: hub-welcome-out-bg ${EXIT_MS}ms cubic-bezier(.55,0,.2,1) both; }
        .hub-welcome-out-img { animation: hub-welcome-out-img ${EXIT_MS}ms cubic-bezier(.55,0,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .hub-welcome-out-bg, .hub-welcome-out-img { animation: hub-welcome-out-bg-reduced ${EXIT_MS}ms linear both; }
        }
        @keyframes hub-welcome-out-bg-reduced { from { opacity: 1; } to { opacity: 0; } }
      `}</style>

      {/* The whole image — welcome copy and subject tiles are already part of the artwork, so nothing is overlaid or
          cropped; `contain` guarantees none of that baked-in content is ever cut off on any screen size. */}
      <img
        src="/images/hub-welcome.png"
        alt="Welcome to the Teaching and Learning Hub — engaging lessons, activities and resources across all subjects to support teaching and learning."
        className={`max-h-[92vh] max-w-[94vw] object-contain sm:max-h-[85vh] sm:max-w-[90vw] ${leaving ? "hub-welcome-out-img" : ""}`}
      />
      <span
        className={`pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white/60 ${leaving ? "hub-welcome-out-img" : ""}`}
      >
        Tap anywhere to continue
      </span>
    </div>
  );
}
