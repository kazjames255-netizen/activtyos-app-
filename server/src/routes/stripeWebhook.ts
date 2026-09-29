import { Router, raw } from "express";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { db } from "../firebase";
import { markPastDue, notifyBilling, syncFromStripe, tenantForCustomer } from "../lib/billing";
import { markCardFailed, paymentForIntent, settleInvoicePayment, settlePaymentRecord } from "../lib/settlePayment";
import { clearSubscriptionCache } from "../middleware/subscription";

// ─────────────────────────────────────────────────────────────────────────
// Stripe webhook — two jobs.
//
// 1. BILLING (platform account): keeps tenants' subscription records in
//    lock-step with Stripe — trial → charged → active, payment failed →
//    past_due, cancel at period end → canceled. Each of those transitions is
//    also APPENDED to the immutable lifecycle log (lib/subscriptionEvents.ts,
//    via syncFromStripe) — that's what HQ's churn figures are computed from,
//    so they stop moving once a month is over. The event.id claim below keeps
//    a retried delivery from appending a second row.
// 2. CONNECT (providers' connected accounts): settles parents' card payments
//    server-side. Direct charges live on the provider's account, so these
//    events arrive with `event.account` set — the endpoint must have "listen
//    to events on connected accounts" enabled in the Stripe dashboard.
//    Without this, a payment was only recorded if the payer's browser came
//    back from the card confirmation (backlog b7): close the tab at the wrong
//    moment and the money was taken with nothing marked paid.
//
// Mounted BEFORE express.json (signature verification needs the raw body).
// The subscription-sync sweep backstops billing for dev (no public URL) and
// missed deliveries; the Connect half has no such backstop, so the endpoint
// must be reachable in production.
//
// Local setup: stripe listen --forward-to localhost:4000/api/stripe/webhook
// and put the printed whsec_… in server/.env as STRIPE_WEBHOOK_SECRET.
// ─────────────────────────────────────────────────────────────────────────
export const stripeWebhook = Router();

function tenantOf(obj: { metadata?: Record<string, string> | null }): string | null {
  return obj.metadata?.tenantId || null;
}

stripeWebhook.post("/", raw({ type: "application/json" }), async (req, res) => {
  // One endpoint may carry both sets of events. If Connect events are
  // configured as their OWN endpoint in Stripe they get their own secret, so
  // try both before rejecting.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!stripe || !secrets.length) { res.status(503).json({ error: "Webhook not configured" }); return; }

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, secret);
      break;
    } catch { /* try the next secret */ }
  }
  if (!event) {
    res.status(400).json({ error: "Bad signature" });
    return;
  }

  // Stripe retries deliveries, and a retry used to re-run the whole handler:
  // the money path is idempotent, but notifyBilling is not, so an operator was
  // told twice that their payment failed. Claim event.id first — one row per
  // delivered event, in a transaction, so only the first claim proceeds.
  const seen = db.collection("stripeEvents").doc(event.id);
  try {
    const fresh = await db.runTransaction(async (tx) => {
      if ((await tx.get(seen)).exists) return false;
      tx.set(seen, { type: event!.type, at: new Date().toISOString(), account: event!.account ?? null });
      return true;
    });
    if (!fresh) {
      console.log(`[stripe-webhook] ${event.type} ${event.id} already handled — ignoring the retry`);
      res.json({ received: true, duplicate: true });
      return;
    }
  } catch (e) {
    // Firestore unavailable: better to handle the event (money first) than to
    // drop it, accepting that a retry may re-notify.
    console.error(`[stripe-webhook] could not claim ${event.id}:`, (e as Error).message);
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const s = event.data.object;
        const tenantId = tenantOf(s) ?? (await tenantForCustomer(String(s.customer)));
        if (tenantId) {
          const before = event.data.previous_attributes as { status?: string } | undefined;
          const status = await syncFromStripe(tenantId, s, "webhook");
          clearSubscriptionCache(tenantId);
          // Every retry failed and Stripe is set to "mark unpaid": the tenant
          // is locked but RECOVERABLE — updating the card settles the open
          // invoice straight away (lib/billing.ts settleOpenInvoice).
          if (status === "unpaid" && before?.status !== "unpaid") {
            await notifyBilling(
              tenantId,
              "Your ActivityOS account is paused",
              "Every retry on your card has failed, so saving is paused — registers, incidents, first aid and medication still work. Update your card in Money → Subscription and we'll settle the outstanding invoice straight away.",
            );
          }
          if (status === "canceled" && before?.status !== "canceled") {
            await notifyBilling(tenantId, "Your ActivityOS subscription has ended", "Reactivate any time from Money → Subscription — your data is all still here.");
          }
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        const s = event.data.object;
        const tenantId = tenantOf(s) ?? (await tenantForCustomer(String(s.customer)));
        if (tenantId) {
          await notifyBilling(
            tenantId,
            "Your free trial ends in 3 days",
            "Your card will be charged when the trial ends. Cancel before then in Money → Subscription if it's not for you.",
          );
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const inv = event.data.object;
        const tenantId = (await tenantForCustomer(String(inv.customer))) ?? tenantOf(inv);
        // Re-pull the subscription so status/period land from the source.
        const subId = (inv as unknown as { subscription?: string }).subscription
          ?? inv.parent?.subscription_details?.subscription;
        if (tenantId && subId) {
          const s = await stripe.subscriptions.retrieve(typeof subId === "string" ? subId : subId.id);
          await syncFromStripe(tenantId, s, "webhook");
          clearSubscriptionCache(tenantId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const tenantId = (await tenantForCustomer(String(inv.customer))) ?? tenantOf(inv);
        if (tenantId) {
          // Stamps pastDueSince — the start of the 14-day grace period
          // (middleware/subscription.ts).
          await markPastDue(tenantId);
          clearSubscriptionCache(tenantId);
          await notifyBilling(
            tenantId,
            "Your ActivityOS payment failed",
            "We couldn't charge your card. Update it in Money → Subscription within 14 days to keep full access — after that ActivityOS goes read-only (registers, incidents, first aid and medication keep working).",
          );
        }
        break;
      }
      // ── Connect: a parent's card payment on a provider's account ────────
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const found = await paymentForIntent(pi.id);
        // Not one of ours (a charge made outside ActivityOS) — nothing to do.
        if (!found) break;
        const { id, rec } = found;
        // Settled without the payer's browser: stamped auto, so Reconciliation
        // reads "Auto-reconciled" rather than naming a person (backlog cc5).
        const by = { auto: true, by: "Stripe" };
        const result = rec.invoiceId
          ? await settleInvoicePayment(id, rec.invoiceId, pi.id, by)
          : await settlePaymentRecord(id, by);
        if (result === "settled") console.log(`[stripe-webhook] settled payment ${id} (${pi.id}) from the webhook — the payer's browser never confirmed`);
        break;
      }
      case "payment_intent.payment_failed": {
        // The `cardFailed` banner had nothing to set it: a failure the payer's
        // browser never reported was invisible to the provider.
        await markCardFailed(event.data.object.id, true);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} failed:`, (e as Error).message);
    // Release the claim, or the retry we just asked Stripe for would be
    // discarded as a duplicate and the event would never be handled.
    await seen.delete().catch(() => {});
    res.status(500).json({ error: "handler failed" }); // Stripe retries
  }
});
