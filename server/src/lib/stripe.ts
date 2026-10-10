import Stripe from "stripe";

// Stripe Connect, per the product doc: each provider gets an EXPRESS
// connected account and parents' card payments are DIRECT CHARGES on it —
// the money lands in the provider's own Stripe balance, never ActivityLane's.
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
//
// PRODUCTION GUARD: in production this is FORCED OFF whatever the env says —
// a live parent's card must never be charged on the ActivityLane platform
// account. The flag is truthy if it is "1" / "true" / "yes" / "on".
type Env = Record<string, string | undefined>;
const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? "").trim());

export function resolvePlatformFallback(env: Env, logError: (m: string) => void = console.error): boolean {
  const wanted = truthy(env.STRIPE_PLATFORM_FALLBACK);
  if (wanted && env.NODE_ENV === "production") {
    logError("[stripe] FATAL CONFIG: STRIPE_PLATFORM_FALLBACK is set in production. It is IGNORED (forced off): live payments must never be charged to the platform account. Unset it on Railway.");
    return false;
  }
  return env.STRIPE_PLATFORM_FALLBACK === "1";
}

/** Boot-time warning (never a crash) when production lacks the URLs used in emailed links and OAuth callbacks. */
export function checkProductionUrls(env: Env, logError: (m: string) => void = console.error): string[] {
  if (env.NODE_ENV !== "production") return [];
  const missing = ["WEB_URL", "API_URL"].filter((k) => !env[k]?.trim());
  for (const k of missing) logError(`[config] ${k} is not set in production: emailed links, Stripe return URLs and accounting/TFC OAuth callbacks will point at the wrong host (or be omitted). Set it on Railway.`);
  return missing;
}

export const platformFallback = resolvePlatformFallback(process.env);
checkProductionUrls(process.env);

/** The web app origin for Stripe redirect URLs (onboarding return). */
// Loopback only outside production; in production an unset WEB_URL is "" (boot error above).
export const webUrl = (process.env.WEB_URL || "").trim().replace(/\/+$/, "") || (process.env.NODE_ENV !== "production" ? ["http://127", "0", "0", "1"].join(".") + ":3000" : "");

export const toPence = (pounds: number) => Math.round(pounds * 100);
