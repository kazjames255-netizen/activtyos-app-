import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";

// A tenant's stored stripeAccountId can point at an account Stripe no longer
// knows: the provider deleted it, revoked the platform's access, or it's a
// test-mode id left over after the switch to live keys. Every lookup used to
// throw "does not have access to account …" — a 500 at checkout and a raw
// Stripe error on Finance, fixable only by editing the database.

/** True when Stripe says the connected account is gone or no longer ours. */
export function isGoneAccount(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "account_invalid" || code === "resource_missing";
}

/**
 * Retrieve the tenant's connected account. If it's gone, forget it on the
 * tenant (only if the tenant still points at that same id) and return null,
 * so the provider simply sees "not connected" and can connect again.
 */
export async function retrieveConnected(s: Stripe, tenantId: string, accountId: string): Promise<Stripe.Account | null> {
  try {
    return await s.accounts.retrieve(accountId);
  } catch (e) {
    if (!isGoneAccount(e)) throw e;
    console.warn(`[stripe] tenant ${tenantId}: stored account ${accountId} is gone (${e instanceof Error ? e.message : e}); clearing it so they can reconnect`);
    const ref = db.collection("tenants").doc(tenantId);
    await db
      .runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.get("stripeAccountId") === accountId) tx.update(ref, { stripeAccountId: FieldValue.delete() });
      })
      .catch((err) => console.error(`[stripe] tenant ${tenantId}: couldn't clear stale account`, err));
    return null;
  }
}
