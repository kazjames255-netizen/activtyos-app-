/**
 * How the plan gate behaves given the server's billing state.
 *  · "card"   - Stripe is configured: capture a card through the PaymentElement.
 *  · "dummy"  - no Stripe keys AND not production: the record-only trial, so local dev stays usable.
 *  · "closed" - no Stripe keys in production: fail CLOSED. Nobody gets a free trial because billing is misconfigured.
 */
export type GateMode = "card" | "dummy" | "closed";
export function gateMode(billingConfigured: boolean | undefined, nodeEnv: string | undefined): GateMode {
  if (billingConfigured) return "card";
  return nodeEnv === "production" ? "closed" : "dummy";
}
