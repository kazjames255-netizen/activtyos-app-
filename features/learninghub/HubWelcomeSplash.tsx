"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Mascot, useMascotEnabled } from "./mascot";

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

// Product review (docs/reviews/critic-product.md C2): the splash used to cost ~5 s on EVERY hard load / deep link and its
// baked-in artwork is tutor-oriented copy. Now: tutors only (parents and kids go straight to their content), at most once
// per browser session, ~1.5 s in total (0.3 s min + 0.8 s hold + 0.5 s feathered dissolve), any tap / key skips it.
const SEEN_KEY = "hubSplashSeen";
const MIN_MS = 300;
const AUTO_MS = 800;
const EXIT_MS = 500;
// Sparkles that drift up as the splash dissolves: [left %, top %, delay ms, size px].
const SPARKS: [number, number, number, number][] = [[12, 62, 0, 18], [24, 40, 120, 12], [36, 70, 220, 22], [48, 30, 60, 14], [58, 66, 300, 20], [68, 44, 160, 16], [78, 60, 40, 24], [88, 36, 260, 12], [18, 24, 340, 14], [82, 22, 100, 18], [42, 52, 380, 10], [64, 26, 200, 12]];

export function HubWelcomeSplash({ tutor = false }: { tutor?: boolean }) {
  if (!tutor) return null;
  return <HubWelcomeSplashInner />;
}

function HubWelcomeSplashInner() {
  const t = useT();
  const mascotOn = useMascotEnabled();
  const [show, setShow] = useState(() => {
    try { if (typeof window !== "undefined" && window.sessionStorage.getItem(SEEN_KEY)) return false; } catch { /* storage blocked: just show it */ }
    return true;
  });
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
    if (!show) return;
    try { window.sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
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
      aria-label={t("hubshell.hm_splashAria")}
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

        /* Exit is a soft dissolve: the panel melts away through a FEATHERED circular window (animated mask radius, so there
           is no hard edge anywhere) revealing the real dashboard, while the artwork lifts, blurs and glows out and sparkles
           drift up. Reduced motion gets a plain fade (below). */
        @property --hub-r { syntax: "<percentage>"; inherits: false; initial-value: 160%; }
        @keyframes hub-welcome-out-bg {
          0% { --hub-r: 160%; opacity: 1; }
          80% { opacity: 1; }
          100% { --hub-r: 0%; opacity: 0; }
        }
        @keyframes hub-welcome-out-img {
          0% { transform: scale(1) translateY(0); filter: brightness(1) blur(0); opacity: 1; }
          45% { transform: scale(1.04) translateY(-6px); filter: brightness(1.25) blur(0.5px); opacity: 1; }
          100% { transform: scale(1.14) translateY(-26px); filter: brightness(1.7) blur(10px); opacity: 0; }
        }
        @keyframes hub-welcome-spark {
          0% { transform: translateY(0) scale(0.4) rotate(0deg); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.25) rotate(90deg); opacity: 0; }
        }
        .hub-welcome-out-bg {
          animation: hub-welcome-out-bg ${EXIT_MS}ms cubic-bezier(.4,0,.2,1) both;
          -webkit-mask-image: radial-gradient(circle at 50% 46%, #000 calc(var(--hub-r) - 28%), transparent var(--hub-r));
          mask-image: radial-gradient(circle at 50% 46%, #000 calc(var(--hub-r) - 28%), transparent var(--hub-r));
        }
        .hub-welcome-out-img { animation: hub-welcome-out-img ${EXIT_MS}ms cubic-bezier(.4,0,.2,1) both; }
        .hub-welcome-spark { animation: hub-welcome-spark 1100ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .hub-welcome-out-bg, .hub-welcome-out-img { animation: hub-welcome-out-bg-reduced ${EXIT_MS}ms linear both; }
        }
        @keyframes hub-welcome-out-bg-reduced { from { opacity: 1; } to { opacity: 0; } }
      `}</style>

      {/* Text-free scene (public/images/hub-welcome-scene.svg): the words are live, translated text below, so no name is ever
          baked into an image. Decorative, hence the empty alt. */}
      <img src="/images/hub-welcome-scene.svg" alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover ${leaving ? "hub-welcome-out-img" : ""}`} />
      <div className={`relative z-[1] flex flex-col items-center gap-3 px-6 text-center ${leaving ? "hub-welcome-out-img" : ""}`}>
        {mascotOn && <Mascot pose="wave" size={190} />}
        <p className="text-[17px] font-medium sm:text-[20px]" style={{ color: "rgba(255,255,255,.85)" }}>{t("hubshell.hm_splashWelcome")}</p>
        <h1 className="text-[40px] font-extrabold leading-tight tracking-tight text-white sm:text-[64px]" style={{ color: "#fff", textShadow: "0 4px 30px rgba(255,215,106,.35)" }}>{t("hubshell.hm_hubName")}</h1>
      </div>
      {leaving && SPARKS.map(([l, t, d, z], i) => (
        <span key={i} aria-hidden className="hub-welcome-spark pointer-events-none absolute text-[#ffe08a]" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}ms`, fontSize: z, textShadow: "0 0 10px rgba(255,224,138,.9)" }}>✦</span>
      ))}
      <span
        className={`pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white/60 ${leaving ? "hub-welcome-out-img" : ""}`}
      >
        {t("hubshell.hm_tapContinue")}
      </span>
    </div>
  );
}
