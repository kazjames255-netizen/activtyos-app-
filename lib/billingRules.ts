// PURE bank-details and go-live rules shared by the web app and the API (extracted, behaviour unchanged). See tests/regression/.

/** A UK sort code and account number each need at least 6 digits before they can be saved (the form refuses anything shorter). */
export function bankDetailsValid(sortCode: string, accountNumber: string): boolean {
  return sortCode.replace(/\D/g, "").length >= 6 && accountNumber.replace(/\D/g, "").length >= 6;
}

/** The checklist's "Choose how you get paid" step is done ONLY when bank details are saved (Stripe alone does not count: bank transfer,
 *  Tax-Free Childcare and vouchers pay into the bank details). */
export function payStepDone(billing: { bankAccount?: string; iban?: string; sortCode?: string; accountNumber?: string } | undefined | null): boolean {
  return !!billing?.bankAccount || !!billing?.iban || !!billing?.accountNumber;
}

/** Bank details saved, as the server judges it for go-live and the set-up emails. */
export function bankSaved(billing: { sortCode?: string; accountNumber?: string } | undefined | null): boolean {
  return !!(billing?.sortCode?.trim() && billing?.accountNumber?.trim());
}

export const PLAN_STARTED = new Set(["trialing", "active", "past_due", "unpaid", "canceling", "canceled"]);

export interface GoLiveFacts { planStarted: boolean; payChosen: boolean; bank: boolean; cashOnly: boolean }

/** What the go-live gate sees. `sub` is the tenant's subscription record. A tenant WITHOUT a subscription status predates the plan flow and is
 *  never held up (planStarted and payChosen both true); only a tenant whose plan is still "none" is. */
export function goLiveFacts(sub: { status?: string } | undefined, billing: { sortCode?: string; accountNumber?: string } | undefined, cashOnly: boolean): GoLiveFacts {
  const hasPlanFlow = !!sub?.status;
  const planStarted = !sub || !sub.status || PLAN_STARTED.has(sub.status);
  const bank = bankSaved(billing);
  return { planStarted, payChosen: hasPlanFlow ? bank : true, bank, cashOnly };
}

/** The reason a listing may not go live, or null. */
export function goLiveRefusalFrom(f: Pick<GoLiveFacts, "planStarted" | "payChosen">): string | null {
  if (!f.planStarted) return "Start your free trial before you go live. Open Billing & payouts to add your card. You are not charged until the trial ends.";
  if (!f.payChosen) return "Add your bank details before you go live, so parents can book and pay you. Open Billing & payouts, then Get paid by parents.";
  return null;
}

/** Publishing is only gated at the moment a listing GOES live: editing one that is already live must never be refused. */
export const gateAppliesOnPublish = (currentStatus: string | undefined, wantsLive: boolean): boolean => wantsLive && currentStatus !== "live";
