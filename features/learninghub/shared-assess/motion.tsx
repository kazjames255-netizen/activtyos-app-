"use client";

// Motion helpers for the quiz / placement / progress screens. Everything here
// honours prefers-reduced-motion: with it on, hooks return the FINAL value on the
// first render (no tween, no delay) and callers switch their CSS transitions off.
import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const snapshot = () => (typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches);

/** True when the user asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Count from 0 up to `target` over `ms` (after `delay`). Reduced motion: the target, immediately. */
export function useCountUp(target: number, ms = 700, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0, t0 = 0;
    const timer = setTimeout(() => {
      const step = (now: number) => {
        if (!t0) t0 = now;
        const k = Math.min(1, (now - t0) / ms);
        setV(target * easeOutCubic(k));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, ms, delay, reduced]);
  return reduced ? target : v;
}

/** 0 on first paint, then `target` on the next frame — drives CSS width/offset transitions
 *  so bars and rings "grow in". Reduced motion: the target straight away. */
export function useGrow(target: number, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const timer = setTimeout(() => { raf = requestAnimationFrame(() => setV(target)); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, delay, reduced]);
  return reduced ? target : v;
}

/** Tailwind classes for the hover-lift used on every card in these panels. */
export const LIFT = "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow)] motion-reduce:transform-none motion-reduce:transition-none";
