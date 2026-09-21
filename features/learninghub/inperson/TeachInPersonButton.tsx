"use client";

import { useState } from "react";
import { HUB_DEFAULTS, type HubSettings } from "@/lib/hubConfig";
import { Icon } from "../kit";
import { FOCUS } from "../teachKit";
import { InPersonApp, type InPersonPreset } from "./InPersonApp";

// The entry point every "Teach in person" button uses: a button that opens the full-screen in-person mode (InPersonApp) on top of the
// hub. Drop it wherever a tutor might start one — the Lessons area (a lesson's own button pre-selects it), Live lessons, Home.
// Nothing renders for a view-only account (the server refuses every write anyway).

export function TeachInPersonButton({ qs, config, preset, goTo, readOnly, label = "Teach in person", variant = "solid", className = "", testId = "teach-in-person" }: {
  qs: string; config?: HubSettings; preset?: InPersonPreset; goTo?: (key: "homework") => void; readOnly?: boolean;
  label?: string; variant?: "solid" | "outline"; className?: string; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (readOnly) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testId} title="Run this with the children beside you: no video call, and every child's answers are recorded"
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold transition ${FOCUS} ${variant === "solid" ? "border border-[var(--brand)] bg-[var(--brand)] text-white hover:brightness-110" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"} ${className}`}>
        <Icon name="users" size={16} />{label}
      </button>
      {open && <InPersonApp qs={qs} config={config ?? HUB_DEFAULTS} preset={preset} goTo={goTo} onClose={() => setOpen(false)} />}
    </>
  );
}
