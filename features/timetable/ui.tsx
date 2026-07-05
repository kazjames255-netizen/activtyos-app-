"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

// Tailwind primitives for the timetable, consuming the legacy theme tokens.

export const inputCls =
  "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]";

export function TInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function TSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ""}`} />;
}

type Variant = "solid" | "ghost";
export function TBtn({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold cursor-pointer transition-colors disabled:opacity-50";
  const v =
    variant === "solid"
      ? "bg-[var(--brand)] text-white border border-[var(--brand)] hover:brightness-110"
      : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <h3 className="m-0 font-[var(--ff-display)] text-[15px] font-extrabold text-[var(--ink)]">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
