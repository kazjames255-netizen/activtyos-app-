// Stripe's developer-facing error wording ("Stripe no longer recommends Accounts v1 ... POST /v2/core/accounts ... npx ...") must never reach a provider
// or parent. The friendly sentence below has a row in the p8api catalogue (scripts/i18n/api-errors/chrome-fixes.json), so it shows in all 11 languages.
export const STRIPE_FRIENDLY_FAIL = "We couldn't reach Stripe to set up your payments just now. Nothing has been charged and your details are safe. Please try again shortly, and contact support if it keeps happening.";

export function looksLikeStripeDevText(msg: string): boolean {
  return /https?:\/\/|npx |\/v[12]\/|api[- ]version|api key|dashboard\.stripe|no longer recommends|recommend|compatibility scenario|accounts v[12]|best-practices/i.test(msg) || msg.length > 220;
}

/** The text to send to the browser for a Stripe failure: Stripe's own words when they are plain and actionable, otherwise the friendly sentence. */
export function stripeUserMessage(e: unknown, fallback = "Stripe error"): string {
  const msg = e instanceof Error ? e.message : fallback;
  return looksLikeStripeDevText(msg) ? STRIPE_FRIENDLY_FAIL : msg;
}
