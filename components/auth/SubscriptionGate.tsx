"use client";

import { useEffect, useState, type ReactNode } from "react";
import { get as apiGet } from "@/lib/api";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";

// Signup account types that own a tenant and must be subscribed. Franchise and
// staff join an existing tenant by invite, so they inherit its subscription and
// are never walled here.
const GATED_PORTALS = new Set(["freelancer", "company"]);

/**
 * Walls a fresh operator behind the plan picker until they start a trial. A
 * pre-existing tenant (no `subscription` field) reports "active" and passes
 * straight through — only signups seeded `status:"none"` are gated.
 */
export function SubscriptionGate({ portal, children }: { portal: string; children: ReactNode }) {
  const gates = GATED_PORTALS.has(portal);
  const [state, setState] = useState<"loading" | "ok" | "gated">(gates ? "loading" : "ok");

  useEffect(() => {
    if (!gates) return;
    let cancelled = false;
    apiGet<{ current: { status: string } }>("/api/subscription")
      .then((d) => {
        if (cancelled) return;
        // Only a BRAND-NEW signup (status "none" — never picked a plan / gave a
        // card) is walled behind the plan picker. Once they've started a trial
        // the card is already captured and the subscription exists, so we never
        // re-wall them with the full pick-a-plan screen — a lapsed/cancelled/
        // past-due state is surfaced by the TrialBanner, not a hard gate.
        const s = d.current?.status;
        setState(!s || s === "none" ? "gated" : "ok");
      })
      .catch(() => { if (!cancelled) setState("ok"); }); // API unreachable — don't lock the shell
    return () => { cancelled = true; };
  }, [gates]);

  if (state === "loading") return <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">Loading…</div>;
  if (state === "gated") return <SubscriptionApp gate onStarted={() => setState("ok")} />;
  return <>{children}</>;
}
