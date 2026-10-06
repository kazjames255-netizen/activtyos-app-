import { db } from "../firebase";
import { cardReady } from "./cardReady";
import { goLiveFacts, goLiveRefusalFrom } from "../../../lib/billingRules";

// "Go live" requirements for a NEW provider. Before a listing can be published they must have (1) started their plan (the free trial),
// and (2) saved their bank details (compulsory: bank transfer, Tax-Free Childcare and vouchers pay into it, and invoices show it; card payments via Stripe are an optional extra). The first is
// enforced by the API (so no screen can bypass it); the second is asked for by the Go live pop-up. Accounts that already exist, and any
// franchise (which rides on head office's plan), are never held up: only a tenant whose plan is still "none" is.

export interface GoLiveStatus {
  planStarted: boolean;
  payChosen: boolean;
  pay: { stripe: boolean; bank: boolean; cashOnly: boolean };
  replyTo: string;
}

export async function goLiveStatus(tenantId: string): Promise<GoLiveStatus> {
  const [t, lib] = await Promise.all([db.collection("tenants").doc(tenantId).get(), db.collection("libraries").doc(tenantId).get()]);
  const sub = t.get("subscription") as { status?: string } | undefined;
  const settings = ((lib.data()?.settings ?? {}) as { cashOnly?: boolean; billing?: { sortCode?: string; accountNumber?: string; email?: string } });
  const facts = goLiveFacts(sub, settings.billing, settings.cashOnly === true);
  const stripe = !!t.get("stripeAccountId") && (await cardReady(tenantId));
  return { planStarted: facts.planStarted, payChosen: facts.payChosen, pay: { stripe, bank: facts.bank, cashOnly: facts.cashOnly }, replyTo: settings.billing?.email ?? "" };
}

/** The reason a listing may not go live yet, or null. Only the plan is enforced here (see the note at the top). */
export async function goLiveRefusal(tenantId: string): Promise<string | null> {
  return goLiveRefusalFrom(await goLiveStatus(tenantId));
}
