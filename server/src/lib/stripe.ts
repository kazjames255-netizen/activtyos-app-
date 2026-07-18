import Stripe from "stripe";

// Stripe Connect, per the product doc: each provider gets an EXPRESS
// connected account and parents' card payments are DIRECT CHARGES on it —
// the money lands in the provider's own Stripe balance, never ActivityOS's.
// The platform account (these keys) only orchestrates and records.
//
// Keys live in server/.env (test keys in dev — currently Amir's account;
// production swaps in Kaz's platform account keys, nothing else changes).

const key = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = key ? new Stripe(key) : null;

// DEV ONLY (STRIPE_PLATFORM_FALLBACK=1): a provider who hasn't finished
// Express onboarding can't take direct charges, which would block all
// payment testing. With the flag, such payments are created on the
// PLATFORM account instead (flagged on the payment record). Remove the
// flag in production: unfinished providers must not take money.
export const platformFallback = process.env.STRIPE_PLATFORM_FALLBACK === "1";

/** The web app origin for Stripe redirect URLs (onboarding return). */
export const webUrl = process.env.WEB_URL || "http://localhost:3000";

export const toPence = (pounds: number) => Math.round(pounds * 100);
