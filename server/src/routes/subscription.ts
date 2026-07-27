import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { stripe } from "../lib/stripe";
import {
  ensureCustomer, ensureProduct, priceData, saveSub, subOf, syncFromStripe,
  staffCount, locationCount, updateMeteredQuantities, type SubRecord,
} from "../lib/billing";
import { clearSubscriptionCache } from "../middleware/subscription";

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
  // Metering rates, snapshotted alongside price (grandfathering covers them too).
  const perStaffOver = band?.perStaffOver ?? 0;
  const perLocationPct = (p?.perLocationPct as number | undefined) ?? 0;
  return { price, staffLimit, locationLimit, perStaffOver, perLocationPct };
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
      cardLast4: (sub as SubRecord | null)?.cardLast4 ?? null, cardBrand: (sub as SubRecord | null)?.cardBrand ?? null,
      details: plans.find((p) => p.id === planId) ?? plans[0],
    },
    plans,
    trialDays: TRIAL_DAYS,
    // Stripe Billing is live when the key is configured; without it (bare dev
    // checkout) starting a trial records intent only.
    billingConfigured: !!stripe,
  });
});

// ── Stripe Billing: card capture + real subscription ─────────────────────
// POST /checkout — a SetupIntent for the client's PaymentElement to capture
// the card. Plan choice isn't needed yet: the card is captured against the
// tenant's Customer; /start attaches it to the actual subscription.
subscription.post("/checkout", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  if (!stripe) { res.status(503).json({ error: "Card billing isn't configured on this server yet." }); return; }
  const customer = await ensureCustomer(auth.tenantId, req.user?.email);
  const si = await stripe.setupIntents.create({
    customer,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { tenantId: auth.tenantId },
  });
  res.json({ clientSecret: si.client_secret });
});

const startSchema = putSchema.extend({ setupIntentId: z.string().max(80) });

// POST /start — the card is on file (SetupIntent succeeded); create the real
// Stripe Subscription. First-ever start gets the 7-day trial with the card
// charged automatically on day 7; a lapsed tenant restarting is charged now.
// Price + limits + metering rates are snapshotted from the live catalogue
// (grandfathering — later HQ pricing edits never move this subscriber).
subscription.post("/start", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  if (!stripe) { res.status(503).json({ error: "Card billing isn't configured on this server yet." }); return; }
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const tenantId = auth.tenantId;

  const si = await stripe.setupIntents.retrieve(parsed.data.setupIntentId);
  if (si.status !== "succeeded" || !si.payment_method) {
    res.status(400).json({ error: "Your card wasn't confirmed — try again." });
    return;
  }
  // The SetupIntent was minted by /checkout with this tenant stamped on it —
  // that stamp is the ownership check. The subscription is then created on
  // the SI's own customer (the one actually holding the card), and that id
  // becomes the tenant's customer of record — so a concurrent /checkout
  // race can never strand the card on a different customer than we bill.
  if (si.metadata?.tenantId !== tenantId || !si.customer) {
    res.status(403).json({ error: "That card capture belongs to a different account." });
    return;
  }
  const customer = typeof si.customer === "string" ? si.customer : si.customer.id;
  await saveSub(tenantId, { stripeCustomerId: customer });
  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method.id;
  await stripe.customers.update(customer, { invoice_settings: { default_payment_method: pmId } });
  const pm = await stripe.paymentMethods.retrieve(pmId);

  const prior = await subOf(tenantId);
  // Only the first-ever start is a free trial; win-backs pay from day one.
  const trialDays = prior?.since ? 0 : TRIAL_DAYS;
  // A live subscription being replaced (e.g. restart after cancel) must not
  // double-bill — end it now, the new one takes over.
  if (prior?.stripeSubscriptionId && prior.status !== "canceled") {
    await stripe.subscriptions.cancel(prior.stripeSubscriptionId, { prorate: false }).catch(() => {});
  }

  const plans = await getPlans();
  const lim = limitsFor(plans, parsed.data.plan, parsed.data.band);
  const cadence = parsed.data.cadence ?? "month";
  const price = { ...priceData(lim.price, cadence), product: await ensureProduct() };

  const created = await stripe.subscriptions.create({
    customer,
    items: [{ price_data: price }],
    ...(trialDays ? { trial_period_days: trialDays } : {}),
    default_payment_method: pmId,
    // No trial → the first invoice charges now; fail fast on a bad card
    // rather than parking the subscription in "incomplete".
    ...(trialDays ? {} : { payment_behavior: "error_if_incomplete" as const }),
    metadata: { tenantId, plan: parsed.data.plan, band: parsed.data.band ?? "" },
  });

  const now = new Date().toISOString();
  const record: SubRecord = {
    plan: parsed.data.plan,
    band: parsed.data.band ?? null,
    cadence,
    status: "trialing", // syncFromStripe corrects to the live status below
    price: lim.price,
    staffLimit: lim.staffLimit,
    locationLimit: lim.locationLimit,
    perStaffOver: lim.perStaffOver,
    perLocationPct: lim.perLocationPct,
    since: (prior?.since as string | undefined) ?? now,
    canceledAt: null,
    cancelAt: null,
    stripeCustomerId: customer,
    stripeSubscriptionId: created.id,
    stripePriceId: created.items.data[0]?.price?.id,
    cardLast4: pm.card?.last4,
    cardBrand: pm.card?.brand,
  };
  await saveSub(tenantId, record);
  const status = await syncFromStripe(tenantId, created);
  await updateMeteredQuantities(tenantId);
  clearSubscriptionCache(tenantId);
  res.json({ ok: true, status, current: { ...record, status, details: plans.find((p) => p.id === record.plan) } });
});

// PUT /api/subscription — choose or change a plan.
//  · Live Stripe subscription → swap the Price (proration), re-snapshot
//    limits; status and dates stay whatever Stripe says they are.
//  · No Stripe subscription (billing unconfigured, or pre-billing tenants)
//    → records the plan and starts the record-only trial, as before.
subscription.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const plans = await getPlans();
  const lim = limitsFor(plans, parsed.data.plan, parsed.data.band);
  const prior = await subOf(auth.tenantId);

  if (stripe && prior?.stripeSubscriptionId && prior.status !== "canceled") {
    const s = await stripe.subscriptions.retrieve(prior.stripeSubscriptionId);
    const cadence = parsed.data.cadence ?? prior.cadence ?? "month";
    const base = s.items.data.find((i) => !i.metadata?.kind) ?? s.items.data[0];
    await stripe.subscriptions.update(s.id, {
      items: [{ id: base.id, price_data: { ...priceData(lim.price, cadence), product: await ensureProduct() } }],
      proration_behavior: "create_prorations",
      metadata: { tenantId: auth.tenantId, plan: parsed.data.plan, band: parsed.data.band ?? "" },
    });
    const patch: Partial<SubRecord> = {
      plan: parsed.data.plan, band: parsed.data.band ?? null, cadence,
      price: lim.price, staffLimit: lim.staffLimit, locationLimit: lim.locationLimit,
      perStaffOver: lim.perStaffOver, perLocationPct: lim.perLocationPct,
    };
    await saveSub(auth.tenantId, patch);
    await updateMeteredQuantities(auth.tenantId);
    clearSubscriptionCache(auth.tenantId);
    res.json({ current: { ...prior, ...patch, details: plans.find((p) => p.id === parsed.data.plan) }, plans, billingConfigured: true });
    return;
  }

  // Record-only path: starting a plan begins a 7-day trial without a card.
  // With billing configured the client goes through /checkout + /start
  // instead; this stays for dev-without-keys and pre-billing tenants.
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
    perStaffOver: lim.perStaffOver,
    perLocationPct: lim.perLocationPct,
  };
  await db.collection("tenants").doc(auth.tenantId).set({ subscription: sub }, { merge: true });
  clearSubscriptionCache(auth.tenantId);
  res.json({ current: { ...sub, details: plans.find((p) => p.id === sub.plan) }, plans, billingConfigured: !!stripe });
});

// POST /api/subscription/cancel — access stays until the period end, then
// locked (Stripe cancel_at_period_end; no refund — the locked decision).
subscription.post("/cancel", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const sub = await subOf(auth.tenantId);
  if (!sub || sub.status === "none") { res.status(400).json({ error: "No active subscription to cancel" }); return; }

  if (stripe && sub.stripeSubscriptionId && sub.status !== "canceled") {
    const s = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    const status = await syncFromStripe(auth.tenantId, s);
    clearSubscriptionCache(auth.tenantId);
    res.json({ ok: true, status, cancelAt: (await subOf(auth.tenantId))?.cancelAt ?? null });
    return;
  }

  const cancelAt = sub.currentPeriodEnd ?? sub.trialEndsAt ?? new Date().toISOString();
  await saveSub(auth.tenantId, { status: "canceling", cancelAt });
  clearSubscriptionCache(auth.tenantId);
  res.json({ ok: true, status: "canceling", cancelAt });
});

// POST /api/subscription/reactivate —
//  · still in the paid period ("canceling") → un-cancel, nothing to pay;
//  · lapsed (canceled / past_due) with a card on file → new subscription,
//    charged now, no second trial;
//  · no card on file → 402 so the client runs the /checkout + /start flow.
subscription.post("/reactivate", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const sub = await subOf(auth.tenantId);
  if (!sub) { res.status(400).json({ error: "No subscription to reactivate" }); return; }

  if (stripe && sub.stripeSubscriptionId) {
    if (sub.status === "canceling") {
      const s = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
      const status = await syncFromStripe(auth.tenantId, s);
      clearSubscriptionCache(auth.tenantId);
      res.json({ ok: true, status });
      return;
    }
    const customer = sub.stripeCustomerId;
    const cust = customer ? await stripe.customers.retrieve(customer) : null;
    const pm = cust && !cust.deleted ? cust.invoice_settings?.default_payment_method : null;
    if (!customer || !pm) {
      res.status(402).json({ error: "Add a card to reactivate — your saved card is no longer available." });
      return;
    }
    const plans = await getPlans();
    const lim = limitsFor(plans, sub.plan ?? "freelancer", sub.band);
    const created = await stripe.subscriptions.create({
      customer,
      items: [{ price_data: { ...priceData(lim.price, sub.cadence ?? "month"), product: await ensureProduct() } }],
      default_payment_method: typeof pm === "string" ? pm : pm.id,
      payment_behavior: "error_if_incomplete",
      metadata: { tenantId: auth.tenantId, plan: sub.plan ?? "", band: sub.band ?? "" },
    });
    await saveSub(auth.tenantId, {
      stripeSubscriptionId: created.id,
      stripePriceId: created.items.data[0]?.price?.id,
      price: lim.price, staffLimit: lim.staffLimit, locationLimit: lim.locationLimit,
      perStaffOver: lim.perStaffOver, perLocationPct: lim.perLocationPct,
      canceledAt: null,
    });
    const status = await syncFromStripe(auth.tenantId, created);
    await updateMeteredQuantities(auth.tenantId);
    clearSubscriptionCache(auth.tenantId);
    res.json({ ok: true, status });
    return;
  }

  const now = new Date().toISOString();
  await saveSub(auth.tenantId, { status: "active", cancelAt: null, currentPeriodEnd: addDays(now, 30), since: sub.since ?? now });
  clearSubscriptionCache(auth.tenantId);
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
