import { Router, raw } from "express";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { notifyBilling, syncFromStripe, tenantForCustomer } from "../lib/billing";
import { clearSubscriptionCache } from "../middleware/subscription";

// ─────────────────────────────────────────────────────────────────────────
// Stripe Billing webhook — keeps tenants' subscription records in lock-step
// with Stripe: trial → charged → active, payment failed → past_due, cancel
// at period end → canceled. Mounted BEFORE express.json (signature
// verification needs the raw body). The subscription-sync sweep backstops
// this for dev (no public URL) and missed deliveries.
//
// Local setup: stripe listen --forward-to localhost:4000/api/stripe/webhook
// and put the printed whsec_… in server/.env as STRIPE_WEBHOOK_SECRET.
// ─────────────────────────────────────────────────────────────────────────
export const stripeWebhook = Router();

function tenantOf(obj: { metadata?: Record<string, string> | null }): string | null {
  return obj.metadata?.tenantId || null;
}

stripeWebhook.post("/", raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) { res.status(503).json({ error: "Webhook not configured" }); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, secret);
  } catch {
    res.status(400).json({ error: "Bad signature" });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const s = event.data.object;
        const tenantId = tenantOf(s) ?? (await tenantForCustomer(String(s.customer)));
        if (tenantId) {
          const before = event.data.previous_attributes as { status?: string } | undefined;
          const status = await syncFromStripe(tenantId, s);
          clearSubscriptionCache(tenantId);
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
          await syncFromStripe(tenantId, s);
          clearSubscriptionCache(tenantId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const tenantId = (await tenantForCustomer(String(inv.customer))) ?? tenantOf(inv);
        if (tenantId) {
          const { db } = await import("../firebase");
          await db.collection("tenants").doc(tenantId).set({ subscription: { status: "past_due" } }, { merge: true });
          clearSubscriptionCache(tenantId);
          await notifyBilling(
            tenantId,
            "Your ActivityOS payment failed",
            "We couldn't charge your card. Update it in Money → Subscription — access pauses until a payment goes through.",
          );
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} failed:`, (e as Error).message);
    res.status(500).json({ error: "handler failed" }); // Stripe retries
  }
});
