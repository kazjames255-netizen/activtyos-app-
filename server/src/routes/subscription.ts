import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Subscription (Money) — which plan the provider is on. There is no billing
// integration yet (no Stripe Billing), so this records the chosen plan on the
// tenant and reports it; actually charging for it is a later milestone. Kept
// deliberately small and honest about that.
export const subscription = Router();
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

export const PLANS = [
  { id: "starter", name: "Starter", price: 0, cadence: "free", blurb: "Take bookings, run the day, one venue.", features: ["Listings & bookings", "Registers & ratios", "Up to 1 venue"] },
  { id: "pro", name: "Pro", price: 39, cadence: "month", blurb: "The full toolkit for a growing provider.", features: ["Everything in Starter", "Unlimited venues", "Reconciliation & finance", "Newsfeed & messaging"] },
  { id: "premium", name: "Premium", price: 89, cadence: "month", blurb: "Multi-site with priority support.", features: ["Everything in Pro", "Franchise & multi-site", "Priority support", "Advanced analytics"] },
] as const;

const putSchema = z.object({ plan: z.enum(["starter", "pro", "premium"]) });

function tenantScope(req: import("express").Request, res: import("express").Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

// GET /api/subscription — the tenant's current plan + the catalogue.
subscription.get("/", async (req, res) => {
  const tenantId = tenantScope(req, res);
  if (!tenantId) return;
  const t = await db.collection("tenants").doc(tenantId).get();
  const sub = (t.exists && (t.data()!.subscription as { plan?: string; status?: string; since?: string })) || null;
  const planId = sub?.plan ?? "starter";
  res.json({
    current: { plan: planId, status: sub?.status ?? "active", since: sub?.since ?? null, details: PLANS.find((p) => p.id === planId) ?? PLANS[0] },
    plans: PLANS,
    billingConfigured: false, // no Stripe Billing yet — selecting a plan records intent, it doesn't charge
  });
});

// PUT /api/subscription — choose a plan (records it; does not charge).
subscription.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const sub = { plan: parsed.data.plan, status: "active", since: new Date().toISOString() };
  await db.collection("tenants").doc(auth.tenantId).set({ subscription: sub }, { merge: true });
  res.json({ current: { ...sub, details: PLANS.find((p) => p.id === sub.plan) }, plans: PLANS, billingConfigured: false });
});
