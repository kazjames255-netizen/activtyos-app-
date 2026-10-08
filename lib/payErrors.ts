// Pure rules for what a parent sees after a card payment fails. No React, no network: unit-tested in tests/regression/pay-errors.test.mts.
//
// Stripe's own error text is only fine for card-entry mistakes ("Your card number is incomplete") and real declines. Everything else
// ("A processing error occurred", payment_intent_unexpected_state ...) says nothing a parent can act on, and the usual cause is that the
// booking changed while the card form was open (cancelled, paid by someone else). So after ANY failure the screen re-reads the
// booking's real state from the server and shows the truthful message; Stripe's wording is used only when the state is still "open".

/** What the server says about the payment the screen is paying (GET /api/payments/checkout/:id/state). */
export type PayState = "open" | "cancelled" | "paid" | "released" | "refunded" | "refunding";

/** The fields of a Stripe.js / API error we look at. */
export interface StripeErrorLike { type?: string; code?: string; decline_code?: string; message?: string }

/** Sentinel key: the text to show is params.text, not a catalogue entry. */
export const RAW = "raw";

export interface PayMessage {
  /** i18n key (area p8lst), or RAW = show params.text (Stripe's own card-entry / decline wording) */
  key: string;
  /** Values for {placeholders} in the key's text */
  params?: Record<string, string>;
  /** Append the "nothing was charged, try another card" line (p7ck.declineRetry) */
  retryNote?: boolean;
  /** The state means the booking can no longer be paid: disable the Pay button */
  final?: boolean;
}

/** Card-entry mistakes: Stripe's text is clear and in the parent's language, so it is shown as is. */
const ENTRY_CODES = new Set([
  "incomplete_number", "incomplete_cvc", "incomplete_expiry", "incomplete_zip", "incomplete_postal_code",
  "invalid_number", "invalid_expiry_month", "invalid_expiry_year", "invalid_expiry_month_past", "invalid_expiry_year_past", "invalid_cvc",
  "incorrect_number", "incorrect_cvc", "incorrect_zip", "invalid_postal_code", "postal_code_invalid", "email_invalid", "invalid_characters",
]);

/** Real bank/card refusals: Stripe's reason + "nothing charged, try another card". */
const DECLINE_CODES = new Set([
  "card_declined", "expired_card", "insufficient_funds", "lost_card", "stolen_card", "do_not_honor", "generic_decline", "fraudulent",
  "card_velocity_exceeded", "withdrawal_count_limit_exceeded", "card_not_supported", "currency_not_supported", "invalid_account",
  "pickup_card", "restricted_card", "security_violation", "service_not_allowed", "transaction_not_allowed", "try_again_later",
  "new_account_information_available", "not_permitted", "testmode_decline", "call_issuer", "duplicate_transaction",
  "invalid_amount", "issuer_not_available", "reenter_transaction", "stop_payment_order", "revocation_of_authorization",
  "approve_with_id", "no_action_taken", "offline_pin_required", "online_or_offline_pin_required", "pin_try_exceeded",
]);

const CONNECTION_CODES = new Set(["api_connection_error", "network_error"]);
const RATE_CODES = new Set(["rate_limit", "rate_limit_error"]);
const AUTH_CODES = new Set(["payment_intent_authentication_failure", "payment_method_authentication_failure", "setup_intent_authentication_failure", "authentication_required"]);

/** The server's verdict on the booking → the message to show, or null when the booking is still payable. */
export function messageForState(state: PayState | null | undefined): PayMessage | null {
  switch (state) {
    case "cancelled": return { key: "p8lst.peCancelled", final: true };
    case "paid": return { key: "p8lst.peAlreadyPaid", final: true };
    case "released": return { key: "p8lst.peReleased", final: true };
    case "refunded": return { key: "p8lst.pmRefunded", final: true };
    case "refunding": return { key: "p8lst.pmRefunding", final: true };
    default: return null;
  }
}

/** The message after a failed confirmPayment. `state` is what the server says now (null = could not be checked). */
export function payErrorMessage(err: StripeErrorLike | null | undefined, state: PayState | null | undefined): PayMessage {
  const fromState = messageForState(state);
  if (fromState) return fromState;
  const code = err?.code ?? "";
  const text = (err?.message ?? "").trim();
  if (CONNECTION_CODES.has(code) || err?.type === "api_connection_error") return { key: "p8lst.peConnection" };
  if (RATE_CODES.has(code) || err?.type === "rate_limit_error") return { key: "p8lst.peRateLimit" };
  if (AUTH_CODES.has(code)) return { key: "p8lst.peAuthFailed" };
  if (err?.type === "validation_error" || ENTRY_CODES.has(code)) {
    return text ? { key: RAW, params: { text } } : { key: "p8lst.peGeneric" };
  }
  // processing_error is a card_error to Stripe but carries no reason; payment_intent_unexpected_state is the "booking changed" case.
  const refused = DECLINE_CODES.has(code) || !!err?.decline_code || (err?.type === "card_error" && code !== "processing_error");
  if (refused && text) return { key: RAW, params: { text }, retryNote: true };
  if (refused) return { key: "p8lst.peDeclined" };
  return { key: "p8lst.peGeneric" };
}
