import { db } from "../firebase";
import { platformFallback, stripe } from "./stripe";
import { ensurePayDomains } from "./payDomains";

// Can THIS provider take a card payment right now? The booking page used to offer "Card" to every parent, so a provider who had
// not finished Stripe got bookings that then failed at "Pay now". Cached for a minute per tenant: the public library is read on
// every booking-page load and asking Stripe each time would be slow.
const cache = new Map<string, { at: number; ok: boolean }>();
const TTL = 60_000;

export async function cardReady(tenantId: string): Promise<boolean> {
  // No Stripe configured at all (local dev) or the dev platform-fallback: nothing to gate on, leave Card offered as before.
  if (!stripe || platformFallback) return true;
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.ok;
  let ok = false;
  try {
    const accountId = (await db.collection("tenants").doc(tenantId).get()).get("stripeAccountId") as string | undefined;
    if (accountId) {
      const a = await stripe.accounts.retrieve(accountId);
      ok = !!a.charges_enabled && a.capabilities?.card_payments === "active";
      // Ready to take cards: make sure Apple Pay / Google Pay work on this provider's checkout (fire and forget, idempotent).
      if (ok) void ensurePayDomains(tenantId, accountId);
    }
  } catch (e) {
    // The saved account does not exist for the keys in use (a test-mode account after going live): it cannot take cards.
    // Anything else (Stripe unreachable): do not hide Card on a guess.
    const err = e as { code?: string; statusCode?: number };
    ok = !(err?.code === "resource_missing" || err?.code === "account_invalid" || err?.statusCode === 404 || err?.statusCode === 403);
  }
  cache.set(tenantId, { at: Date.now(), ok });
  return ok;
}
