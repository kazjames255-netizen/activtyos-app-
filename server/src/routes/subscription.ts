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

// Mirrors the public pricing page (activityos.uk/pricing). A flat monthly fee
// per tier; annual billing bills 10 months (i.e. saves 2). Company is priced by
// team-size band. Card processing is the operator's own provider — this fee is
// what they pay ActivityOS.
// The DEFAULT catalogue — the seed. The live catalogue is whatever the platform
// admin has saved in `platform/pricing` (editable in the HQ area); changing it
// there auto-applies to NEW signups (prices, limits AND the descriptions they
// read). Existing subscribers are grandfathered — their price/limits are
// snapshotted onto their own `subscription` record at trial-start, so a later
// price change never moves an existing customer.
export const DEFAULT_PLANS = [
  {
    id: "freelancer", name: "Freelancer", price: 29, cadence: "month",
    blurb: "For solo coaches & instructors — your own branding.",
    features: ["Branded booking page & basket", "Payments to your own account", "Blocks & smart listings", "Registers on any device", "Parent app & messaging", "Dashboard & finance analytics", "150 SMS a month included"],
  },
  {
    id: "company", name: "Company", price: 49, cadence: "month",
    blurb: "For established companies — priced by team size, never a cut of bookings.",
    features: ["Everything in Freelancer, plus:", "Staff scheduling, timetable & payroll", "Learning Centre & recruitment", "Multi-staff dashboard & team performance", "500 SMS a month included"],
    // staffMax = hard cap for the band; over it they must upgrade. The 76+ tier
    // has no fixed band — it meters at +£1/staff (staffMax: null).
    bands: [
      { id: "starter", label: "Starter · up to 10 staff", price: 49, staffMax: 10 },
      { id: "growth", label: "Growth · 11–30 staff", price: 69, staffMax: 30 },
      { id: "scale", label: "Scale · 31–75 staff", price: 89, staffMax: 75 },
      { id: "enterprise", label: "76+ staff · +£1/staff", price: 89, staffMax: null, perStaffOver: 1 },
    ],
  },
  {
    id: "franchise", name: "Franchise", price: 86, cadence: "month",
    blurb: "For franchises & multi-venue groups — branded per franchisee.",
    features: ["Everything in Company, plus:", "Multi-venue & franchise scoping", "White-label per franchisee", "Split fees & royalty collection", "Network-wide reporting", "Priority onboarding & support"],
    // Priced off a Company band, then +75% of that band per extra franchisee
    // location. `locations` (accepted franchisee invites) is metered by Amir.
    bands: [
      { id: "starter", label: "Starter · up to 10 staff / site", price: 49, staffMax: 10 },
      { id: "growth", label: "Growth · 11–30 staff / site", price: 69, staffMax: 30 },
      { id: "scale", label: "Scale · 31–75 staff / site", price: 89, staffMax: 75 },
    ],
    perLocationPct: 75,
  },
] as const;

const putSchema = z.object({
  plan: z.enum(["freelancer", "company", "franchise"]),
  cadence: z.enum(["month", "year"]).optional(),
  band: z.string().trim().max(40).optional(),
});

// The editable pricing catalogue (platform HQ). Shape mirrors DEFAULT_PLANS.
const bandSchema = z.object({
  id: z.string().max(40), label: z.string().max(80), price: z.number().nonnegative(),
  staffMax: z.number().int().nonnegative().nullable().optional(),
  perStaffOver: z.number().nonnegative().optional(),
});
const planSchema = z.object({
  id: z.string().max(40), name: z.string().max(60), price: z.number().nonnegative(),
  cadence: z.string().max(10), blurb: z.string().max(400),
  features: z.array(z.string().max(160)).max(24),
  bands: z.array(bandSchema).max(8).optional(),
  perLocationPct: z.number().nonnegative().optional(),
});
const pricingSchema = z.object({ plans: z.array(planSchema).min(1).max(12) });

type PlanRec = Record<string, unknown> & { id: string };
// The LIVE catalogue: the admin-saved config if present, else the seed. New
// signups read this (prices, limits, descriptions), so an HQ edit auto-applies.
async function getPlans(): Promise<PlanRec[]> {
  const doc = await db.collection("platform").doc("pricing").get();
  const stored = doc.exists ? (doc.data()?.plans as PlanRec[] | undefined) : undefined;
  return Array.isArray(stored) && stored.length ? stored : (DEFAULT_PLANS as unknown as PlanRec[]);
}

const TRIAL_DAYS = 7;
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString(); };

type Band = { id: string; price?: number; staffMax?: number | null; perStaffOver?: number };
// The staff/location caps + price for a plan+band, from the live (or snapshot)
// catalogue. Amir snapshots these onto the tenant at trial-start (grandfathering).
function limitsFor(plans: PlanRec[], planId: string, bandId?: string | null) {
  const p = plans.find((x) => x.id === planId);
  const bands = (p?.bands as Band[] | undefined) ?? [];
  const band = bands.find((b) => b.id === bandId) ?? bands[0];
  const price = (band?.price ?? (p?.price as number | undefined)) ?? 0;
  // staffMax null (the 76+ tier) = metered, no hard cap. No band = no staff mgmt.
  const staffLimit = band ? (band.staffMax === undefined ? null : band.staffMax) : null;
  const locationLimit = p?.perLocationPct ? null : null; // franchise location cap TBD with Kaz
  return { price, staffLimit, locationLimit };
}

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
  const sub = (t.exists && (t.data()!.subscription as Record<string, unknown> & { plan?: string; status?: string; band?: string })) || null;
  // No subscription field at all = a pre-existing tenant → treat as active (we
  // don't retro-gate them). A seeded `status:"none"` = a fresh signup that must
  // still choose a plan → gated.
  const status = sub?.status ?? "active";
  const planId = sub?.plan ?? (t.data()?.type === "company" ? "company" : "freelancer");
  const plans = await getPlans();
  const lim = limitsFor(plans, planId, sub?.band);
  res.json({
    current: {
      plan: planId, status, band: sub?.band ?? null, cadence: (sub?.cadence as string) ?? "month",
      since: sub?.since ?? null, trialEndsAt: sub?.trialEndsAt ?? null, currentPeriodEnd: sub?.currentPeriodEnd ?? null, cancelAt: sub?.cancelAt ?? null,
      // Existing customers keep their snapshot; new/preview reads fall back to live config.
      price: sub?.price ?? lim.price, staffLimit: sub?.staffLimit ?? lim.staffLimit, locationLimit: sub?.locationLimit ?? lim.locationLimit,
      staffUsed: sub?.staffUsed ?? null, locationsUsed: sub?.locationsUsed ?? null,
      details: plans.find((p) => p.id === planId) ?? plans[0],
    },
    plans,
    trialDays: TRIAL_DAYS,
    billingConfigured: false, // no Stripe Billing yet — starting a trial records intent, it doesn't charge
  });
});

// PUT /api/subscription — choose a plan (records it; does not charge).
subscription.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  // Starting a plan begins a 7-day free trial — no card is charged yet (Stripe
  // Billing is Amir's milestone). Status flips off "none", which lifts the gate.
  // Price + limits are snapshotted now (grandfathering) from the live catalogue.
  const plans = await getPlans();
  const lim = limitsFor(plans, parsed.data.plan, parsed.data.band);
  const now = new Date().toISOString();
  const trialEndsAt = addDays(now, TRIAL_DAYS);
  const sub = {
    plan: parsed.data.plan,
    cadence: parsed.data.cadence ?? "month",
    band: parsed.data.band ?? null,
    status: "trialing",
    since: now,
    trialEndsAt,
    currentPeriodEnd: trialEndsAt,
    cancelAt: null,
    price: lim.price,
    staffLimit: lim.staffLimit,
    locationLimit: lim.locationLimit,
  };
  await db.collection("tenants").doc(auth.tenantId).set({ subscription: sub }, { merge: true });
  res.json({ current: { ...sub, details: plans.find((p) => p.id === sub.plan) }, plans, billingConfigured: false });
});

// POST /api/subscription/cancel — access stays until the period end, then locked.
subscription.post("/cancel", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const ref = db.collection("tenants").doc(auth.tenantId);
  const sub = (await ref.get()).data()?.subscription as Record<string, unknown> | undefined;
  if (!sub || sub.status === "none") { res.status(400).json({ error: "No active subscription to cancel" }); return; }
  const cancelAt = (sub.currentPeriodEnd as string) ?? (sub.trialEndsAt as string) ?? new Date().toISOString();
  await ref.set({ subscription: { status: "canceling", cancelAt } }, { merge: true });
  res.json({ ok: true, status: "canceling", cancelAt });
});

// POST /api/subscription/reactivate — resume; on real billing this re-charges.
subscription.post("/reactivate", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const ref = db.collection("tenants").doc(auth.tenantId);
  const sub = (await ref.get()).data()?.subscription as Record<string, unknown> | undefined;
  if (!sub) { res.status(400).json({ error: "No subscription to reactivate" }); return; }
  const now = new Date().toISOString();
  await ref.set({ subscription: { status: "active", cancelAt: null, currentPeriodEnd: addDays(now, 30), since: sub.since ?? now } }, { merge: true });
  res.json({ ok: true, status: "active" });
});

// ── Platform HQ: edit the pricing catalogue ──────────────────────────────
// GET the editable catalogue (+ the seed defaults, so the HQ editor can offer
// "reset"). PUT saves it — from then on new signups read the new prices,
// limits AND descriptions. Existing subscribers keep their snapshot (grandfathered).
subscription.get("/pricing", async (req, res) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  const doc = await db.collection("platform").doc("pricing").get();
  res.json({
    plans: doc.exists && doc.data()?.plans ? doc.data()!.plans : DEFAULT_PLANS,
    defaults: DEFAULT_PLANS,
    isDefault: !doc.exists,
    updatedAt: doc.data()?.updatedAt ?? null,
  });
});

subscription.put("/pricing", async (req, res) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  const parsed = pricingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("platform").doc("pricing").set({ plans: parsed.data.plans, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? "platform" });
  res.json({ ok: true, plans: parsed.data.plans });
});
