"use client";

import { openHowItWorks } from "./open";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { HowBand, HowRole } from "./types";
import { useT } from "@/lib/i18n/provider";

// The window itself is lazy and fenced: if it ever fails to load or throws, the hub carries on and only this window is missing.
const HowItWorksHost = dynamic(() => import("./HowItWorksHost"), { ssr: false, loading: () => null });
class Fence extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch() { /* the hub must never be taken down by this window */ }
  render() { return this.state.bad ? null : this.props.children; }
}

// A clearly visible "How it works" entry. `hero` = the white pill on the hub's blue banner; `link` = a quiet text link for empty states
// and dialogs (with an optional scene to jump to). Mounting a button also mounts the (lazy, initially empty) host that answers it.
export default function HowItWorksButton({ role, variant = "hero", scene, topic, label, band, autoplay }: { role?: HowRole; variant?: "hero" | "link" | "card" | "kid"; scene?: string; topic?: string; label?: string; band?: HowBand; /** A page's own Watch button: open the video and start playing at once (no second play press). */ autoplay?: boolean }) {
  const r: HowRole = role ?? "tutor";
  const tr = useT();
  const text = label ?? tr("hubhow.btn");
  const click = () => openHowItWorks({ role: r, scene, topic, band, autoplay });
  return (
    <>
      {variant === "hero" && (
        <button type="button" onClick={click} data-testid="hiw-open" aria-label={tr("hubhow.heroAria", { label: text })} title={tr("hubhow.heroTitle")}
          className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/95 px-3.5 text-[12.5px] font-extrabold text-[#16306e] shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><circle cx="12" cy="12" r="11" fill="#f5b81f" /><path d="M9.5 7.5v9l7-4.5z" fill="#2a1d00" /></svg>
          <span>{text}</span>
        </button>
      )}
      {variant === "link" && (
        <button type="button" onClick={click} data-testid="hiw-open-link" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-extrabold text-[var(--brand,#1d3a8f)] underline decoration-[1.5px] underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)]">
          <span aria-hidden>▶</span>{text}
        </button>
      )}
      {variant === "kid" && (
        <button type="button" onClick={click} data-testid="hiw-open-kid" aria-label={tr("hubhow.kidAria", { label: text })}
          className="flex min-h-[72px] w-full items-center gap-4 rounded-3xl border-2 border-[var(--brand-line,#cdddf7)] bg-[var(--surface,#fff)] px-5 py-3 text-start shadow-sm transition hover:border-[var(--brand,#1d3a8f)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)]">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[#f5b81f] text-[28px] text-[#2a1d00]" aria-hidden>▶</span>
          <span className="min-w-0"><b className="block text-[22px] font-extrabold leading-tight text-[var(--ink,#0e1f4a)]">{text}</b><span className="block text-[14px] font-semibold text-[var(--ink-2,#4a5677)]">{tr("hubhow.kidSub")}</span></span>
        </button>
      )}
      {variant === "card" && (
        <button type="button" onClick={click} data-testid="hiw-open-card" className="group inline-flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[var(--line,#d6e0f4)] bg-[var(--surface,#fff)] px-4 py-2.5 text-start shadow-sm transition hover:border-[var(--brand,#1d3a8f)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)]">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#f5b81f] text-[#2a1d00]" aria-hidden>▶</span>
          <span className="min-w-0"><b className="block text-[14px] text-[var(--ink,#0e1f4a)]">{text}</b><span className="block text-[12px] text-[var(--ink-2,#4a5677)]">{tr("hubhow.cardSub")}</span></span>
        </button>
      )}
      <Fence><HowItWorksHost defaultRole={r} band={band} /></Fence>
    </>
  );
}
