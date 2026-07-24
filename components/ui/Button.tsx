"use client";

import type { ButtonHTMLAttributes } from "react";

// Shared button primitive. "default" | "primary" | "danger" | "cta" reproduce
// the original bookings Btn exactly (fixed-height, optional `sm` size);
// "ghost" | "solid" reproduce the original timetable TBtn exactly (loose
// padding, no fixed height). Kept as distinct variant families rather than a
// single shared size scheme so neither feature's look changes.
export type ButtonVariant = "default" | "primary" | "danger" | "cta" | "ghost" | "solid";

const DENSE_VARIANTS = new Set<ButtonVariant>(["default", "primary", "danger", "cta"]);

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]",
  primary: "border border-transparent bg-[#f0b100] text-[#241a00] hover:brightness-105",
  danger:
    "border border-[#f3c0bb] bg-[var(--surface)] text-[var(--red,#e21d27)] hover:bg-[var(--red-soft,#fdebec)]",
  cta: "border border-[#e0a500] bg-[var(--surface)] text-[#a56d00] hover:bg-[var(--brand-soft)]",
  ghost:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]",
  solid: "bg-[var(--brand)] text-white border border-[var(--brand)] hover:brightness-110",
};

export function Button({
  variant = "default",
  sm,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; sm?: boolean }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const dense = DENSE_VARIANTS.has(variant);
  const size = dense
    ? sm
      ? "h-[28px] px-3 text-[11.5px]"
      : "h-[34px] px-[15px] text-[12.5px]"
    : "justify-center px-4 py-2 text-[12.5px]";
  return (
    <button className={`${base} ${size} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />
  );
}
