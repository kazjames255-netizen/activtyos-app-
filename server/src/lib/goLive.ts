import { db } from "../firebase";
import { cardReady } from "./cardReady";

// "Go live" requirements for a NEW provider. Before a listing can be published they must have (1) started their plan (the free trial),
// and (2) chosen how parents will pay: Stripe cards, bank details for transfers, or an explicit "I only take cash". The first is
// enforced by the API (so no screen can bypass it); the second is asked for by the Go live pop-up. Accounts that already exist, and any
// franchise (which rides on head office's plan), are never held up: only a tenant whose plan is still "none" is.
const PLAN_STARTED = new Set(["trialing", "active", "past_due", "unpaid", "canceling", "canceled"]);

export interface GoLiveStatus {
  planStarted: boolean;
  payChosen: boolean;
  pay: { stripe: boolean; bank: boolean; cashOnly: boolean };
  replyTo: string;
}

export async function goLiveStatus(tenantId: string): Promise<GoLiveStatus> {
  const [t, lib] = await Promise.all([db.collection("tenants").doc(tenantId).get(), db.collection("libraries").doc(tenantId).get()]);
  const sub = t.get("subscription") as { status?: string } | undefined;
  const planStarted = !sub || !sub.status || PLAN_STARTED.has(sub.status);
  const settings = ((lib.data()?.settings ?? {}) as { cashOnly?: boolean; billing?: { sortCode?: string; accountNumber?: string; email?: string } });
  const bank = !!(settings.billing?.sortCode?.trim() && settings.billing?.accountNumber?.trim());
  const stripe = !!t.get("stripeAccountId") && (await cardReady(tenantId));
  const cashOnly = settings.cashOnly === true;
  return { planStarted, payChosen: bank || stripe || cashOnly, pay: { stripe, bank, cashOnly }, replyTo: settings.billing?.email ?? "" };
}

/** The reason a listing may not go live yet, or null. Only the plan is enforced here (see the note at the top). */
export async function goLiveRefusal(tenantId: string): Promise<string | null> {
  const s = await goLiveStatus(tenantId);
  return s.planStarted ? null : "Start your free trial before you go live. Open Billing & payouts to add your card. You are not charged until the trial ends.";
}
