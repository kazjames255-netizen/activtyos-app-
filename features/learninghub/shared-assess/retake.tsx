"use client";

import { useEffect, useState } from "react";
import type { Assessment, RetakePolicy } from "./api";
import { hubLocale, hubT, tp } from "../family/hubT";

// Retake control, as the server reports it. The browser never decides whether a
// retake is allowed — it words the answer the API sent (Assessment.retake) and
// counts down to `nextAvailableAt` so a waiting child sees when to come back.

/** Re-renders every `ms` so countdowns stay honest. */
export function useTick(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** 200 min → "3h 20m", 26h → "1 day 2h", 40 s → "under a minute". */
export function fmtWait(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins <= 1) return hubT("hubfam.asWaitUnderMin");
  if (mins < 60) return hubT("hubfam.asWaitMin", { m: mins });
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? hubT("hubfam.asWaitHM", { h, m }) : hubT("hubfam.asWaitH", { h });
  const d = Math.floor(h / 24), hh = h % 24;
  const days = tp(hubT, hubLocale(), "hubfam.asDays", d);
  return hh ? hubT("hubfam.asWaitDaysH", { days, h: hh }) : days;
}

export type RetakeState =
  | { kind: "open" }
  | { kind: "wait"; label: string; until: string; why?: "break" }
  | { kind: "once"; label: string };

/** What the child can do about sitting `a` again right now. Only meaningful once a paper has been handed in. */
export function retakeState(a: Assessment, now: number): RetakeState {
  const r = a.retake;
  if (!r || r.allowed) return { kind: "open" };
  if (r.reason === "break" && r.nextAvailableAt) {
    const left = Date.parse(r.nextAvailableAt) - now;
    if (left <= 0) return { kind: "open" };
    return { kind: "wait", label: hubT("hubfam.asRetakeBreak", { wait: fmtWait(left) }), until: r.nextAvailableAt, why: "break" };
  }
  if (r.reason === "cooldown" && r.nextAvailableAt) {
    const left = Date.parse(r.nextAvailableAt) - now;
    if (left <= 0) return { kind: "open" };   // the wait is over; the server has the final say on Start
    return { kind: "wait", label: hubT("hubfam.asRetakeIn", { wait: fmtWait(left) }), until: r.nextAvailableAt };
  }
  return { kind: "once", label: hubT("hubfam.asOnceOnly") };
}

/** Friendly copy for the 409 `retake_blocked` reply to starting an attempt. */
export function retakeBlockedMessage(reason: string | undefined, nextAvailableAt: string | null | undefined): string {
  if (reason === "cooldown" && nextAvailableAt) {
    const left = Date.parse(nextAvailableAt) - Date.now();
    return left > 0 ? hubT("hubfam.asBlockedCooldown", { wait: fmtWait(left) }) : hubT("hubfam.asBlockedNow");
  }
  return hubT("hubfam.asBlockedOnce");
}

/** The 409 `retake_blocked` reply worded for a child, given its `reason`. A "break" is the short pause after a few tries that didn't pass. */
export function retakeBlockedFor(reason: string | undefined, nextAvailableAt: string | null | undefined): string {
  if (reason === "break") {
    const left = nextAvailableAt ? Date.parse(nextAvailableAt) - Date.now() : 0;
    return left > 0 ? hubT("hubfam.asBlockedBreak", { wait: fmtWait(left) }) : hubT("hubfam.asBlockedBreakDone");
  }
  return retakeBlockedMessage(reason, nextAvailableAt);
}

export interface BlockedInfo { reason?: string; nextAvailableAt?: string | null }

/** The policy that applies to `a`: its own override, else the tenant's setting. Display only; the server enforces it. */
export function effectivePolicy(a: Pick<Assessment, "retakePolicy" | "retakeCooldownHours">, cfg: { retakePolicy: RetakePolicy; retakeCooldownHours: number }): { policy: RetakePolicy; hours: number } {
  const o = a.retakePolicy;
  const policy: RetakePolicy = !o || o === "inherit" ? cfg.retakePolicy : o;
  return { policy, hours: a.retakeCooldownHours ?? cfg.retakeCooldownHours };
}

export const policyLabel = (p: RetakePolicy, hours: number) =>
  p === "unlimited" ? hubT("hubfam.asPolicyUnlimited") : p === "once" ? hubT("hubfam.asPolicyOnce") : hubT("hubfam.asPolicyAfter", { h: hours });
