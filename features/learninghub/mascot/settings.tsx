"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

// Mascot visibility + motion, resolved by whoever owns the data and injected once near the top of a hub tree:
//   enabled — hub setting (tutor can switch the mascot off for their students; default ON)
//   calm    — the child's support profile `calm` flag (features/learninghub/support.ts): mascot stays, but STILL
// Without a provider the defaults apply (enabled, not calm), so the component works anywhere (showcase, tests).
export interface MascotSettings {
  enabled: boolean;
  calm: boolean;
}

const DEFAULTS: MascotSettings = { enabled: true, calm: false };
const Ctx = createContext<MascotSettings>(DEFAULTS);

export function MascotSettingsProvider({ enabled = true, calm = false, children }: Partial<MascotSettings> & { children: ReactNode }) {
  const value = useMemo(() => ({ enabled, calm }), [enabled, calm]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** False when the tutor/hub has switched the mascot off — callers render nothing (or their non-mascot fallback). */
export function useMascotEnabled(): boolean {
  return useContext(Ctx).enabled;
}

/** True when animation is allowed (not Calm). CSS additionally honours prefers-reduced-motion. */
export function useMascotMotion(): boolean {
  return !useContext(Ctx).calm;
}

/** Internal: Mascot reads calm straight from context so callers cannot forget it. */
export function useMascotSettingsCalm(): boolean {
  return useContext(Ctx).calm;
}
