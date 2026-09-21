"use client";

import { useEffect, useState } from "react";
import type { Assessment, RetakePolicy } from "./api";

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
  if (mins <= 1) return "under a minute";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return `${d} ${d === 1 ? "day" : "days"}${hh ? ` ${hh}h` : ""}`;
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
    return { kind: "wait", label: `Have a break and look back at the lesson. Try again in ${fmtWait(left)}`, until: r.nextAvailableAt, why: "break" };
  }
  if (r.reason === "cooldown" && r.nextAvailableAt) {
    const left = Date.parse(r.nextAvailableAt) - now;
    if (left <= 0) return { kind: "open" };   // the wait is over; the server has the final say on Start
    return { kind: "wait", label: `Retake available in ${fmtWait(left)}`, until: r.nextAvailableAt };
  }
  return { kind: "once", label: "One attempt only. Ask your tutor if you need another go." };
}

/** Friendly copy for the 409 `retake_blocked` reply to starting an attempt. */
export function retakeBlockedMessage(reason: string | undefined, nextAvailableAt: string | null | undefined): string {
  if (reason === "cooldown" && nextAvailableAt) {
    const left = Date.parse(nextAvailableAt) - Date.now();
    return left > 0 ? `You can retake this in ${fmtWait(left)}. Your tutor set a short wait between attempts.` : "You can retake this now. Please try again.";
  }
  return "This one can only be sat once. Ask your tutor if you'd like another go.";
}

/** The 409 `retake_blocked` reply worded for a child, given its `reason`. A "break" is the short pause after a few tries that didn't pass. */
export function retakeBlockedFor(reason: string | undefined, nextAvailableAt: string | null | undefined): string {
  if (reason === "break") {
    const left = nextAvailableAt ? Date.parse(nextAvailableAt) - Date.now() : 0;
    return left > 0 ? `Time for a little break. Look back over the lesson, then have another go in ${fmtWait(left)}.` : "You can have another go now. Please try again.";
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
  p === "unlimited" ? "Retakes: unlimited" : p === "once" ? "One attempt only" : `Retake after ${hours}h`;
