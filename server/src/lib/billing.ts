import type Stripe from "stripe";
import { db } from "../firebase";
import { stripe, toPence } from "./stripe";
import { notify } from "./notify";
import { recordSubscriptionEvent, type SubEventSource } from "./subscriptionEvents";

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
  /** When the tenant first went past_due (null otherwise) — starts the grace period. */
  pastDueSince?: string | null;
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

/** Does this users doc take a seat on the band? Active STAFF only: a
 *  switched-off account (Team → Deactivate) frees its place, and a franchisee
 *  login is billed as a location (locationCount), not a staff seat
 *  (acceptance test d19s6). */
export const takesStaffSeat = (d: FirebaseFirestore.DocumentSnapshot): boolean =>
  d.get("role") === "staff" && d.get("disabled") !== true;

/** Team size that counts against the band cap — the real team, as Team &
 *  invites shows it. */
export async function staffCount(tenantId: string): Promise<number> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.filter(takesStaffSeat).length;
}

/** Staff invites sent but not yet accepted (withdrawn ones excluded). Each is
 *  a place spoken for — without counting them, ten invites could go out
 *  against a plan with one place left and all ten be accepted. */
export async function pendingStaffInvites(tenantId: string): Promise<number> {
  const snap = await db.collection("invites").where("tenantId", "==", tenantId).get();
  return snap.docs.filter((d) => d.get("role") === "staff" && !d.get("usedBy") && d.get("status") !== "deactivated").length;
}

/** Accepted franchisee invites = extra locations (base band covers site #1). */
export async function locationCount(tenantId: string): Promise<number> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.filter((d) => (d.get("role") as string) === "franchise").length;
}

/** May this tenant invite another team member? Active staff + invites still
 *  waiting to be accepted must stay under the cap. No subscription record
 *  (pre-billing tenant) or a metered band (staffLimit null) → always yes.
 *  Acceptance re-checks the cap itself (routes/invites.ts). */
export async function staffHeadroom(tenantId: string): Promise<{ ok: boolean; reason?: string }> {
  const sub = await subOf(tenantId);
  if (!sub || sub.staffLimit === null || sub.staffLimit === undefined) return { ok: true };
  const [used, pending] = await Promise.all([staffCount(tenantId), pendingStaffInvites(tenantId)]);
  if (used + pending < sub.staffLimit) return { ok: true };
  const cap = `Your plan covers ${sub.staffLimit} team member${sub.staffLimit === 1 ? "" : "s"}`;
  return {
    ok: false,
    reason: pending
      ? `${cap} — you have ${used} and ${pending} invite${pending === 1 ? "" : "s"} still waiting to be accepted. Withdraw an unused invite in Team & invites, or upgrade your band in Money → Subscription.`
      : `${cap} and you already have ${used} — upgrade your band in Money → Subscription to invite more.`,
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

/** Local statuses that carry a pastDueSince stamp — the grace clock runs in
 *  past_due and the stamp is kept (not restarted, not dropped) once dunning
 *  has exhausted into "unpaid". */
const OVERDUE = new Set(["past_due", "unpaid"]);

/** Map a live Stripe subscription onto the tenant record. The one status we
 *  invent locally is "canceling" (Stripe says active + cancel_at_period_end).
 *  "unpaid" is kept as itself, NOT folded into past_due: it's Stripe's
 *  end-of-dunning state (every retry spent), so the grace period is already
 *  over and accessFor() locks it — see middleware/subscription.ts.
 *
 *  This is also where the lifecycle gets WRITTEN DOWN. Every Stripe-driven
 *  change funnels through here — the webhook, each subscription route, the
 *  sync sweep — so appending the transition here records it once, at the
 *  moment it happens, from whichever of those noticed first (`source` says
 *  which). lib/subscriptionEvents.ts refuses a repeat, so the webhook's
 *  retry and the sweep can't add a second row for the same transition. */
export async function syncFromStripe(
  tenantId: string,
  s: Stripe.Subscription,
  source: SubEventSource = "route",
): Promise<string> {
  const status =
    s.status === "trialing" ? (s.cancel_at_period_end ? "canceling" : "trialing")
    : s.status === "active" ? (s.cancel_at_period_end ? "canceling" : "active")
    : s.status === "unpaid" ? "unpaid"
    : s.status === "past_due" ? "past_due"
    : s.status === "canceled" || s.status === "incomplete_expired" ? "canceled"
    : "past_due"; // incomplete/paused — treat as needing attention
  // When it FIRST went past_due — the start of the 14-day grace period
  // (middleware/subscription.ts). Kept across re-syncs (including the
  // past_due → unpaid step), cleared once paid.
  const prior = OVERDUE.has(status) ? await subOf(tenantId) : null;
  await saveSub(tenantId, {
    status,
    pastDueSince: OVERDUE.has(status)
      ? (prior && OVERDUE.has(prior.status ?? "") && prior.pastDueSince) || new Date().toISOString()
      : null,
    trialEndsAt: iso(s.trial_end),
    currentPeriodEnd: periodEnd(s),
    cancelAt: s.cancel_at_period_end ? (iso(s.cancel_at) ?? periodEnd(s)) : null,
    ...(status === "canceled" ? { canceledAt: iso(s.canceled_at) ?? new Date().toISOString() } : {}),
  });
  // History (append-only, immutable) — the tenant record above is current
  // state and gets overwritten; this doesn't. Stripe's own clock where it has
  // one: a trial started when the subscription did, a trial converted when it
  // ended, a subscription ended when Stripe says it was canceled.
  const happenedAt =
    status === "canceled" ? iso(s.canceled_at)
    : status === "trialing" ? iso(s.start_date)
    : status === "active" ? ((s.trial_end && s.trial_end * 1000 <= Date.now() ? iso(s.trial_end) : null) ?? iso(s.start_date))
    : null; // "canceling" — Stripe records no "notice given at", so: now.
  await recordSubscriptionEvent({ tenantId, status, at: happenedAt, subscriptionId: s.id, source });
  return status;
}

/** A renewal failed (invoice.payment_failed): past_due, stamped with when it
 *  started. A later retry failing again doesn't restart the grace period —
 *  and it must not UN-lock a tenant Stripe has already given up on: once the
 *  record says "unpaid", a further failed retry leaves it unpaid. */
export async function markPastDue(tenantId: string): Promise<void> {
  const prior = await subOf(tenantId);
  const wasOverdue = OVERDUE.has(prior?.status ?? "");
  await saveSub(tenantId, {
    status: prior?.status === "unpaid" ? "unpaid" : "past_due",
    pastDueSince: (wasOverdue && prior?.pastDueSince) || new Date().toISOString(),
  });
}

// ── Settling an overdue subscription ─────────────────────────────────────
// Stripe leaves the failed renewal's invoice OPEN and retries it on its own
// schedule (Smart Retries — up to four days out). When the operator has just
// handed us a working card there's no reason to make them wait: charge the
// open invoice there and then. Everything here believes Stripe rather than
// the attempt — the tenant record is re-synced from the live subscription
// whether the charge worked or not, so a decline leaves them past_due.

/** Stripe statuses with an open invoice worth attempting now. */
const NEEDS_PAYMENT: ReadonlySet<Stripe.Subscription.Status> =
  new Set<Stripe.Subscription.Status>(["past_due", "unpaid", "incomplete"]);

export interface SettleResult {
  /** Did we actually put a charge to Stripe? (false = nothing was owed.) */
  attempted: boolean;
  paid: boolean;
  /** The tenant's status after re-syncing from Stripe. */
  status: string;
  /** Set whenever the money didn't move — safe to show the operator. */
  error?: string;
}

/** A decline message an operator can act on. Stripe's own card-error text
 *  ("Your card was declined.", "Your card has insufficient funds.") is
 *  written for exactly this, so pass it through; anything else gets a plain
 *  fallback rather than an API diagnostic. */
function declineMessage(e: unknown): string {
  const err = e as { type?: string; message?: string; code?: string };
  const base = "We couldn't take the outstanding payment with that card.";
  if (err?.type === "StripeCardError" && err.message) return `${base} ${err.message}`;
  if (err?.code === "invoice_payment_intent_requires_action") {
    return `${base} Your bank wants to confirm it — try paying the invoice from the emailed link.`;
  }
  if (err?.type === "StripeInvalidRequestError" && /payment method|source/i.test(err.message ?? "")) {
    return "There's no usable card on file — add one in Money → Subscription.";
  }
  return base;
}

/** Pay the subscription's open invoice NOW, then re-sync the tenant from
 *  Stripe. Safe to call on any subscription: one that owes nothing returns
 *  `attempted: false` having only refreshed the record. */
export async function settleOpenInvoice(
  tenantId: string,
  subscriptionId: string,
  paymentMethodId?: string,
): Promise<SettleResult> {
  if (!stripe) return { attempted: false, paid: false, status: (await subOf(tenantId))?.status ?? "none" };
  const s = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
  if (!NEEDS_PAYMENT.has(s.status)) {
    return { attempted: false, paid: false, status: await syncFromStripe(tenantId, s) };
  }
  const invoice = typeof s.latest_invoice === "string"
    ? await stripe.invoices.retrieve(s.latest_invoice)
    : s.latest_invoice;
  // Only an OPEN invoice is collectable — draft/void/uncollectible aren't, and
  // a paid one means Stripe's own retry beat us to it.
  if (!invoice?.id || invoice.status !== "open") {
    return { attempted: false, paid: false, status: await syncFromStripe(tenantId, s) };
  }

  let paid = false;
  let error: string | undefined;
  try {
    const result = await stripe.invoices.pay(invoice.id, {
      ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
      // The card was captured by a SetupIntent with usage "off_session", so
      // its mandate covers this; on-session would risk a 3DS prompt we have
      // no way to show from here.
      off_session: true,
    });
    paid = result.status === "paid";
    if (!paid) error = "The payment hasn't gone through yet — we'll keep trying.";
  } catch (e) {
    error = declineMessage(e);
  }
  // Re-read the subscription: Stripe decides the status, not the call above.
  // (A decline therefore lands the tenant back on past_due/unpaid with their
  // original pastDueSince — the grace clock is never restarted by a retry.)
  const after = await stripe.subscriptions.retrieve(subscriptionId);
  const status = await syncFromStripe(tenantId, after);
  return { attempted: true, paid, status, error: paid ? undefined : error };
}

/** Find the tenant a Stripe customer belongs to (webhook lookups). */
export async function tenantForCustomer(customerId: string): Promise<string | null> {
  const snap = await tenants().where("subscription.stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Billing notifications go to the whole team bell + provider email. */
export function notifyBilling(tenantId: string, title: string, body: string): Promise<void> {
  return notify({
    tenantId, to: { kind: "tenant" }, category: "billing", key: "billing",
    title, body, href: "/company/subscription",
  });
}
