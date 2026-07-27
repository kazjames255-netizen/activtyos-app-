import type Stripe from "stripe";
import { db } from "../firebase";
import { stripe, toPence } from "./stripe";
import { notify } from "./notify";

// ─────────────────────────────────────────────────────────────────────────
// Stripe Billing helpers — the platform's OWN revenue (the plan fee a
// provider pays ActivityOS), entirely separate from Stripe Connect in
// payments.ts (parents paying providers). One Product; every subscription
// gets its own inline Price at the amount snapshotted from the live
// catalogue at start — which is what makes grandfathering trivial: a later
// catalogue edit never touches an existing subscriber's Price.
//
// Metered extras ride as additional subscription items, keyed by metadata:
//   kind "staff-over"  — the 76+ band's +£1/staff above the included 75
//   kind "locations"   — franchise: +{perLocationPct}% of band per accepted
//                        franchisee location (the base band covers site #1)
// Quantities are pushed on invite accept and self-healed by the sync sweep.
// ─────────────────────────────────────────────────────────────────────────

export interface SubRecord {
  plan?: string; band?: string | null; cadence?: string; status?: string;
  price?: number; staffLimit?: number | null; locationLimit?: number | null;
  staffUsed?: number; locationsUsed?: number;
  trialEndsAt?: string | null; currentPeriodEnd?: string | null; cancelAt?: string | null;
  since?: string | null; canceledAt?: string | null;
  stripeCustomerId?: string; stripeSubscriptionId?: string; stripePriceId?: string;
  cardLast4?: string; cardBrand?: string;
  perStaffOver?: number; perLocationPct?: number;
}

const tenants = () => db.collection("tenants");

export async function subOf(tenantId: string): Promise<SubRecord | null> {
  const t = await tenants().doc(tenantId).get();
  return (t.exists && (t.data()!.subscription as SubRecord)) || null;
}

export async function saveSub(tenantId: string, patch: Partial<SubRecord>): Promise<void> {
  await tenants().doc(tenantId).set({ subscription: patch }, { merge: true });
}

/** The single Stripe Product all plan Prices hang off. Its id is kept in
 *  platform/billing so restarts don't create duplicates. */
export async function ensureProduct(): Promise<string> {
  const ref = db.collection("platform").doc("billing");
  const snap = await ref.get();
  const existing = snap.exists ? (snap.get("productId") as string | undefined) : undefined;
  if (existing) return existing;
  const product = await stripe!.products.create({
    name: "ActivityOS subscription",
    metadata: { aos: "subscription" },
  });
  await ref.set({ productId: product.id }, { merge: true });
  return product.id;
}

/** Annual bills 10 months in one yearly charge (2 free). */
export function priceData(monthly: number, cadence: string): Stripe.SubscriptionCreateParams.Item.PriceData {
  const year = cadence === "year";
  return {
    currency: "gbp",
    product: "", // filled by caller with ensureProduct()
    recurring: { interval: year ? "year" : "month" },
    unit_amount: toPence(year ? monthly * 10 : monthly),
  };
}

/** Get or create the tenant's Stripe Customer, persisting the id. Safe
 *  under concurrent calls (React StrictMode double-fires /checkout in dev):
 *  the Firestore transaction picks one winner; a losing duplicate Customer
 *  is deleted rather than left to split the tenant's billing history. */
export async function ensureCustomer(tenantId: string, email?: string | null): Promise<string> {
  const sub = await subOf(tenantId);
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const t = await tenants().doc(tenantId).get();
  const created = await stripe!.customers.create({
    name: (t.get("name") as string) || tenantId,
    ...(email ? { email } : {}),
    metadata: { tenantId },
  });
  const winner = await db.runTransaction(async (tx) => {
    const snap = await tx.get(tenants().doc(tenantId));
    const existing = (snap.get("subscription") as SubRecord | undefined)?.stripeCustomerId;
    if (existing) return existing; // someone else won the race
    tx.set(tenants().doc(tenantId), { subscription: { stripeCustomerId: created.id } }, { merge: true });
    return created.id;
  });
  if (winner !== created.id) await stripe!.customers.del(created.id).catch(() => {});
  return winner;
}

/** Team size that counts against the band cap (staff + franchise members). */
export async function staffCount(tenantId: string): Promise<number> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.filter((d) => {
    const r = d.get("role") as string;
    return r === "staff" || r === "franchise";
  }).length;
}

/** Accepted franchisee invites = extra locations (base band covers site #1). */
export async function locationCount(tenantId: string): Promise<number> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.filter((d) => (d.get("role") as string) === "franchise").length;
}

/** May this tenant add another team member? No subscription record
 *  (pre-billing tenant) or a metered band (staffLimit null) → always yes. */
export async function staffHeadroom(tenantId: string): Promise<{ ok: boolean; reason?: string }> {
  const sub = await subOf(tenantId);
  if (!sub || sub.staffLimit === null || sub.staffLimit === undefined) return { ok: true };
  const used = await staffCount(tenantId);
  if (used < sub.staffLimit) return { ok: true };
  return {
    ok: false,
    reason: `Your plan covers ${sub.staffLimit} team member${sub.staffLimit === 1 ? "" : "s"} and you already have ${used} — upgrade your band in Money → Subscription to invite more.`,
  };
}

/** Included staff on the metered 76+ band — the largest capped band's max. */
const METERED_INCLUDED_STAFF = 75;

/** Push the metered extras (staff overage / franchise locations) onto the
 *  Stripe subscription as quantity items. Safe to call any time — it
 *  reconciles to the current counts and records them on the tenant. */
export async function updateMeteredQuantities(tenantId: string): Promise<void> {
  const sub = await subOf(tenantId);
  if (!sub) return;
  const [staff, locations] = await Promise.all([staffCount(tenantId), locationCount(tenantId)]);
  await saveSub(tenantId, { staffUsed: staff, locationsUsed: locations });
  if (!stripe || !sub.stripeSubscriptionId) return;

  const wanted: { kind: string; unit: number; qty: number }[] = [];
  if (sub.staffLimit === null && (sub.perStaffOver ?? 0) > 0) {
    wanted.push({ kind: "staff-over", unit: sub.perStaffOver!, qty: Math.max(0, staff - METERED_INCLUDED_STAFF) });
  }
  if ((sub.perLocationPct ?? 0) > 0 && (sub.price ?? 0) > 0) {
    wanted.push({ kind: "locations", unit: (sub.price! * sub.perLocationPct!) / 100, qty: locations });
  }
  if (!wanted.length) return;

  const s = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const product = await ensureProduct();
  const interval = sub.cadence === "year" ? "year" as const : "month" as const;
  const mult = sub.cadence === "year" ? 10 : 1;
  for (const w of wanted) {
    const item = s.items.data.find((i) => i.metadata?.kind === w.kind);
    if (!item && w.qty > 0) {
      await stripe.subscriptionItems.create({
        subscription: s.id, quantity: w.qty, metadata: { kind: w.kind },
        price_data: { currency: "gbp", product, recurring: { interval }, unit_amount: toPence(w.unit * mult) },
        proration_behavior: "create_prorations",
      });
    } else if (item && item.quantity !== w.qty) {
      if (w.qty === 0) await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
      else await stripe.subscriptionItems.update(item.id, { quantity: w.qty, proration_behavior: "create_prorations" });
    }
  }
}

const iso = (unixSeconds: number | null | undefined): string | null =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;

/** Newer Stripe API versions keep the period on the items. */
function periodEnd(s: Stripe.Subscription): string | null {
  const onSub = (s as unknown as { current_period_end?: number }).current_period_end;
  return iso(onSub ?? s.items?.data?.[0]?.current_period_end);
}

/** Map a live Stripe subscription onto the tenant record. The one status we
 *  invent locally is "canceling" (Stripe says active + cancel_at_period_end). */
export async function syncFromStripe(tenantId: string, s: Stripe.Subscription): Promise<string> {
  const status =
    s.status === "trialing" ? (s.cancel_at_period_end ? "canceling" : "trialing")
    : s.status === "active" ? (s.cancel_at_period_end ? "canceling" : "active")
    : s.status === "past_due" || s.status === "unpaid" ? "past_due"
    : s.status === "canceled" || s.status === "incomplete_expired" ? "canceled"
    : "past_due"; // incomplete/paused — treat as needing attention
  await saveSub(tenantId, {
    status,
    trialEndsAt: iso(s.trial_end),
    currentPeriodEnd: periodEnd(s),
    cancelAt: s.cancel_at_period_end ? (iso(s.cancel_at) ?? periodEnd(s)) : null,
    ...(status === "canceled" ? { canceledAt: iso(s.canceled_at) ?? new Date().toISOString() } : {}),
  });
  return status;
}

/** Find the tenant a Stripe customer belongs to (webhook lookups). */
export async function tenantForCustomer(customerId: string): Promise<string | null> {
  const snap = await tenants().where("subscription.stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Billing notifications go to the whole team bell + provider email. */
export function notifyBilling(tenantId: string, title: string, body: string): Promise<void> {
  return notify({
    tenantId, to: { kind: "tenant" }, category: "billing",
    title, body, href: "/company/subscription",
  });
}
