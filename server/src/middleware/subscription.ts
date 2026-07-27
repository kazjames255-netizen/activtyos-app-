import type { NextFunction, Request, Response } from "express";
import { db } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────
// The real subscription wall. The client's SubscriptionGate is UX; this is
// the API refusing to serve a tenant whose subscription has ENDED. Scope
// mirrors the gate exactly:
//   · Only owner roles are walled (freelancer / company own the tenant and
//     the bill). Staff/franchise inherit access; parents and platform are
//     never gated.
//   · Blocked statuses: canceled, past_due, and canceling PAST its cancelAt
//     (cancel = access until period end, decision #3). "none" stays allowed
//     API-side — the gate walls the UI while they pick a plan, and blocking
//     it here would brick the plan-choosing endpoints' siblings (and e2e).
//   · Pre-existing tenants with no subscription record are never gated.
// ─────────────────────────────────────────────────────────────────────────

// Paths (under /api) a lapsed tenant must still reach: seeing/fixing their
// subscription, their own account, and the shell around those screens.
const OPEN_PREFIXES = ["/subscription", "/me", "/account", "/notifications", "/tenants", "/register-role", "/invites"];

// One Firestore read per tenant per minute, not per request — Spark quota is
// a hard cap. Mutating endpoints clear their tenant's entry immediately.
const TTL_MS = 60_000;
const cache = new Map<string, { status: string; cancelAt: string | null; at: number }>();

export function clearSubscriptionCache(tenantId: string): void {
  cache.delete(tenantId);
}

async function subscriptionState(tenantId: string): Promise<{ status: string; cancelAt: string | null }> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const t = await db.collection("tenants").doc(tenantId).get();
  const sub = t.exists ? (t.data()!.subscription as { status?: string; cancelAt?: string } | undefined) : undefined;
  const state = { status: sub?.status ?? "active", cancelAt: sub?.cancelAt ?? null, at: Date.now() };
  cache.set(tenantId, state);
  return state;
}

export async function enforceSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.auth;
  if (!auth || (auth.role !== "freelancer" && auth.role !== "company") || !auth.tenantId) {
    next();
    return;
  }
  if (OPEN_PREFIXES.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }
  const { status, cancelAt } = await subscriptionState(auth.tenantId);
  const lapsed =
    status === "canceled" ||
    status === "past_due" ||
    (status === "canceling" && !!cancelAt && cancelAt < new Date().toISOString());
  if (lapsed) {
    res.status(402).json({
      error:
        status === "past_due"
          ? "Your last payment failed — update your card in Money → Subscription to keep using ActivityOS."
          : "Your ActivityOS subscription has ended — reactivate it in Money → Subscription to continue.",
    });
    return;
  }
  next();
}
