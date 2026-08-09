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
/** The server's own lapsed test (server/src/middleware/subscription.ts). Kept
 *  identical on purpose: when the two drift, the API blocks every request while
 *  the UI carries on, and each screen renders its EMPTY state — a lapsed
 *  operator is told "0 bookings", which reads as data loss rather than a
 *  billing problem. Whatever the server refuses to serve, the shell must
 *  explain up front. */
function isLapsed(status?: string, cancelAt?: string | null): boolean {
  return status === "canceled"
    || status === "past_due"
    || (status === "canceling" && !!cancelAt && cancelAt < new Date().toISOString());
}

export function SubscriptionGate({ portal, children }: { portal: string; children: ReactNode }) {
  const gates = GATED_PORTALS.has(portal);
  const [state, setState] = useState<"loading" | "ok" | "gated">(gates ? "loading" : "ok");

  useEffect(() => {
    if (!gates) return;
    let cancelled = false;
    apiGet<{ current: { status: string; cancelAt?: string | null } }>("/api/subscription")
      .then((d) => {
        if (cancelled) return;
        // A BRAND-NEW signup (status "none" — never picked a plan / gave a card)
        // is walled behind the plan picker. A pre-existing tenant with no
        // subscription field reports "active" and passes straight through.
        //
        // A LAPSED tenant is walled too. It used to be left to the TrialBanner,
        // on the reasoning that re-walling someone who already gave a card is
        // heavy-handed — but the API gates them regardless (402 on everything
        // outside /subscription, /me, /account, /notifications, /tenants), so
        // "soft" only meant every screen showed zeros with no working action.
        const s = d.current?.status;
        setState(!s || s === "none" || isLapsed(s, d.current?.cancelAt) ? "gated" : "ok");
      })
      .catch(() => { if (!cancelled) setState("ok"); }); // API unreachable — don't lock the shell
    return () => { cancelled = true; };
  }, [gates]);

  if (state === "loading") return <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">Loading…</div>;
  if (state === "gated") return <SubscriptionApp gate onStarted={() => setState("ok")} />;
  return <>{children}</>;
}
