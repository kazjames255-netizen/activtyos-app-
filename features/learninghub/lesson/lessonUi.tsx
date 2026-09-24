"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { FOCUS } from "../kit";
import { useSupport } from "../family/FamilyContext";

// Small presentational pieces shared by the lesson steps. Colours are the hub's CSS variables only.

export const display = { fontFamily: "var(--ff-display)" } as const;

/** Keyframes for the lesson; every animation is off under prefers-reduced-motion (the flip becomes an instant swap). */
export function LessonStyles() {
  return (
    <style>{`
@keyframes ls-enter{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes ls-shake{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@keyframes ls-pulse{40%{transform:scale(1.04)}}
@keyframes ls-float{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-8px) rotate(var(--r,0deg))}}
.ls-float{animation:ls-float 4.5s ease-in-out infinite}
.ls-enter{animation:ls-enter .45s cubic-bezier(.2,.8,.2,1) both}
.ls-shake{animation:ls-shake .45s}
.ls-pulse{animation:ls-pulse .5s}
.ls-flip{perspective:800px}
.ls-flip .ls-in{position:relative;width:100%;height:100%;transition:transform .55s cubic-bezier(.3,.7,.2,1);transform-style:preserve-3d}
.ls-flip[aria-pressed="true"] .ls-in{transform:rotateY(180deg)}
.ls-flip .ls-f,.ls-flip .ls-b{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.ls-flip .ls-b{transform:rotateY(180deg)}
.ls-kw{background:linear-gradient(transparent 62%,color-mix(in srgb,var(--gold) 55%,transparent) 62%)}
@media (prefers-reduced-motion:reduce){.ls-enter,.ls-shake,.ls-pulse,.ls-float{animation:none}.ls-flip .ls-in{transition:none}}
`}</style>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "solid" | "ghost" | "good" };
/** The lesson's chunky button: 48px tall, brand-blue solid, or an outlined ghost. */
export function Btn({ tone = "solid", className = "", ...p }: BtnProps) {
  const look = tone === "ghost"
    ? "border-2 border-[var(--line)] bg-[var(--surface)] text-[var(--brand)] hover:border-[var(--brand-2)]"
    : tone === "good"
      ? "border-2 border-[var(--green)] bg-[var(--green)] text-white hover:brightness-105"
      : "border-2 border-[var(--brand)] bg-[var(--brand)] text-white hover:brightness-110";
  return <button type="button" {...p} className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-extrabold transition disabled:pointer-events-none disabled:opacity-40 motion-safe:active:translate-y-px ${look} ${FOCUS} ${className}`} />;
}

export function Tag({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "brand" }) {
  return <span className="inline-block rounded-full px-2.5 py-[3px] text-[11px] font-black uppercase tracking-[0.06em]" style={tone === "green" ? { background: "var(--green-soft)", color: "var(--hub-green-ink)" } : { background: "var(--brand-soft)", color: "var(--brand)" }}>{children}</span>;
}

/** A lesson step's white card. */
export function StepCard({ children, className = "", hero }: { children: ReactNode; className?: string; hero?: boolean }) {
  return (
    <section className={`ls-enter relative overflow-hidden rounded-2xl border p-4 shadow-[var(--shadow-sm)] sm:p-6 ${hero ? "border-transparent text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"} ${className}`}
      style={hero ? { background: "linear-gradient(135deg, var(--brand-strong), var(--brand) 55%, var(--brand-2))" } : undefined}>
      {children}
    </section>
  );
}

/** Confetti burst on a canvas. `fire` bumps → a burst of `scale` (0–1). Skipped entirely for reduced motion. */
export function Confetti({ fire, scale = 1 }: { fire: number; scale?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const parts = useRef<{ x: number; y: number; vx: number; vy: number; s: number; c: string; r: number; vr: number; l: number }[]>([]);
  const raf = useRef(0);
  const calm = useSupport().calm; // R-5: no confetti for a child whose tutor set Calm

  useEffect(() => {
    if (!fire || calm || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = cv.current;
    if (!c) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const n = Math.round(140 * scale);
    for (let i = 0; i < n; i++) parts.current.push({ x: window.innerWidth / 2 + (Math.random() - 0.5) * 200, y: window.innerHeight * 0.35, vx: (Math.random() - 0.5) * 12 * (scale > 0.5 ? 1 : 0.6), vy: -Math.random() * 13 - 3, s: 5 + Math.random() * 7, c: `hsl(${(Math.random() * 360) | 0} 85% 58%)`, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, l: 110 + Math.random() * 60 });
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.current = parts.current.filter((p) => p.l-- > 0 && p.y < c.height + 20);
      for (const p of parts.current) {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.l / 40); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); ctx.restore();
      }
      raf.current = parts.current.length ? requestAnimationFrame(tick) : 0;
    };
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [fire, scale]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); parts.current = []; }, []);

  return <canvas ref={cv} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]" />;
}
