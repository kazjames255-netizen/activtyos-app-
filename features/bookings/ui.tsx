"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// Shared presentational primitives for the Bookings view. Styled with Tailwind
// utilities that consume the legacy theme tokens (var(--…)) so the migrated
// view tracks whatever theme the surrounding app has active.

export function Badge({
  tone,
  children,
}: {
  tone: { bg: string; fg: string };
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-[3px] text-[11px] font-bold leading-[1.4]"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {children}
    </span>
  );
}

type BtnVariant = "default" | "primary" | "danger" | "cta";

export function Btn({
  variant = "default",
  sm,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; sm?: boolean }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const size = sm ? "h-[28px] px-3 text-[11.5px]" : "h-[34px] px-[15px] text-[12.5px]";
  const variants: Record<BtnVariant, string> = {
    default:
      "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]",
    primary:
      "border border-transparent bg-[var(--cta,#e22295)] text-white hover:brightness-105",
    danger: "border border-[#f3c0bb] bg-[var(--surface)] text-[var(--red,#e21d27)] hover:bg-[var(--red-soft,#fdebec)]",
    cta: "border border-[var(--cta,#e22295)] bg-[var(--surface)] text-[var(--cta,#e22295)] hover:bg-[var(--brand-soft)]",
  };
  return <button className={`${base} ${size} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-3.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
      {children}
    </div>
  );
}

export function DefRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-[var(--line)] py-[5px] text-[12.5px]">
      <span className="shrink-0 text-[var(--ink-3)]">{label}</span>
      <span className="break-words text-right font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}
