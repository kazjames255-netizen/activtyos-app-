import { randomUUID } from "node:crypto";
import type { TfcFailure } from "../../../lib/tfc";

// ─────────────────────────────────────────────────────────────────────────
// HMRC Tax-Free Childcare Payments API — the real client (v1.2).
//
// Spec: developer.service.hmrc.gov.uk/api-documentation/docs/api/service/
//       tax-free-childcare-payments/1.2 (OpenAPI: …/1.2/oas/resolved).
// Three POST endpoints, all user-restricted OAuth 2.0 with the single scope
// `tax-free-childcare-payments`:
//   /individuals/tax-free-childcare/payments/link      → child_full_name
//   /individuals/tax-free-childcare/payments/balance   → the account balance
//   /individuals/tax-free-childcare/payments/          → a payment request
//
// TWO RULES THIS FILE KEEPS:
//  1. It NEVER throws for a documented failure. Every call returns a result —
//     ok, or one of the five TfcFailure states the checkout has a designed
//     screen for (features/listings/tfc.ts). A thrown error would take the
//     parent to a blank error state; a returned failure takes them to the
//     manual path, which is what HMRC's own flow falls back to.
//  2. It never logs a token, an authorisation code or a client secret. What
//     goes in the log is the correlation id and HMRC's errorCode — enough to
//     raise a ticket with HMRC, useless to anyone who reads the log.
//
// Everything is env-gated: with no credentials `tfcConfig()` is null and the
// routes answer "not-connected", which is exactly the pre-integration
// behaviour (a manual reference typed at checkout).
// ─────────────────────────────────────────────────────────────────────────

/** Money as HMRC sends and takes it: whole pence. */
const toPence = (pounds: number) => Math.round(pounds * 100);
const toPounds = (pence: number) => Math.round(pence) / 100;

export interface TfcConfig {
  /** Sandbox https://test-api.service.hmrc.gov.uk, production https://api.service.hmrc.gov.uk. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Must match the redirect URI registered on the Developer Hub application. */
  redirectUri: string;
  /** NS&I-issued, numeric, starts with 1 (sandbox: any 11 digits). */
  eppUniqueCustomerId: string;
  /** HMRC-issued, "HMRC" + 6 digits + "A" (sandbox: any alphanumeric ≤20). */
  eppRegReference: string;
}

const env = (k: string) => (process.env[k] ?? "").trim();

/**
 * The configured HMRC integration, or null when it isn't set up.
 *
 * Read on every call rather than cached at import, so a test (and `tsx`) can
 * set the vars after the module loads.
 */
export function tfcConfig(): TfcConfig | null {
  const clientId = env("HMRC_TFC_CLIENT_ID");
  const clientSecret = env("HMRC_TFC_CLIENT_SECRET");
  const eppUniqueCustomerId = env("HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID");
  const eppRegReference = env("HMRC_TFC_EPP_REG_REFERENCE");
  // All four are needed: the two OAuth halves identify OUR software to HMRC,
  // the two EPP identifiers identify us as the payment provider on every call.
  // Half a configuration is not a configuration — it would fail per request
  // with E0002/E0004 instead of degrading cleanly to the manual path.
  if (!clientId || !clientSecret || !eppUniqueCustomerId || !eppRegReference) return null;
  const baseUrl = (env("HMRC_TFC_BASE_URL") || "https://test-api.service.hmrc.gov.uk").replace(/\/+$/, "");
  const redirectUri = env("HMRC_TFC_REDIRECT_URI") || `${(env("API_URL") || "http://localhost:4000").replace(/\/+$/, "")}/api/tfc/callback`;
  return { baseUrl, clientId, clientSecret, redirectUri, eppUniqueCustomerId, eppRegReference };
}

/** True when HMRC is wired up (credentials present). */
export const tfcConfigured = () => tfcConfig() !== null;

// ── Results ──────────────────────────────────────────────────────────────

export type TfcResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: TfcFailure; code?: string; message?: string };

const fail = (failure: TfcFailure, code?: string, message?: string): TfcResult<never> => ({ ok: false, failure, code, message });

/** OAuth tokens as we store them. Sensitive — see routes/tfc.ts. */
export interface TfcTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. HMRC's access tokens last 4 hours; the refresh token 18 months. */
  expiresAt: number;
}

// ── Error mapping ────────────────────────────────────────────────────────
// HMRC's documented codes → the five states the checkout can actually show.
// Anything not named here is a "connection-failed", which is the honest
// answer: we could not complete it, try again or pay manually.
//
//   E0033  the TFC account has insufficient funds                  → insufficient-funds
//   E0027  the CCP is not linked to the parent's TFC account       → provider-not-added
//   E0030  OUR EPP record is inactive on the TFC system (sign-up
//          incomplete) — nothing the parent can do                 → not-connected
//   ETFC2  "Bearer Token did not return a valid record"            → connection-expired
//   E0401  auth failure behind HMRC's 500                          → connection-expired
//   E0043  the parent has no TFC account at all. No designed
//          screen exists for it; the link-failure screen is the
//          closest and its "try again" is harmless.                → connection-failed
const CODE_FAILURES: Record<string, TfcFailure> = {
  E0033: "insufficient-funds",
  E0027: "provider-not-added",
  E0030: "not-connected",
  ETFC2: "connection-expired",
  E0401: "connection-expired",
};

/** Map one HMRC error body onto a designed failure screen. */
export function failureForCode(code: string | undefined, status: number): TfcFailure {
  if (code && CODE_FAILURES[code]) return CODE_FAILURES[code];
  // A 401/403 from the gateway is the token, not the request — the same state
  // the spec calls "connection expired".
  if (status === 401 || status === 403) return "connection-expired";
  return "connection-failed";
}

// ── HTTP ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 20_000;
const ACCEPT = "application/vnd.hmrc.1.2+json";

/** What HMRC returned, parsed as far as it can be. */
type HmrcError = { errorCode?: string; errorDescription?: string };

async function callHmrc<T>(
  cfg: TfcConfig,
  tokens: TfcTokens,
  path: string,
  body: Record<string, unknown>,
  what: string,
): Promise<TfcResult<T>> {
  // A unique key per request, shared with HMRC for tracing. Logged on failure
  // — it is the thing HMRC asks for when you raise a ticket.
  const correlationId = randomUUID();
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: ACCEPT,
        "Content-Type": "application/json",
        "Correlation-ID": correlationId,
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Network/timeout: never a documented failure, so it is a connection
    // failure and the parent goes to the manual path.
    console.error(`[tfc] ${what} network error (correlation ${correlationId}):`, (e as Error).message);
    return fail("connection-failed", undefined, "We couldn't reach HMRC.");
  }
  const text = await res.text().catch(() => "");
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* HMRC sent something that isn't JSON */ }
  if (res.ok) {
    if (!parsed || typeof parsed !== "object") {
      console.error(`[tfc] ${what} returned ${res.status} with an unreadable body (correlation ${correlationId})`);
      return fail("connection-failed");
    }
    return { ok: true, data: parsed as T };
  }
  const err = (parsed ?? {}) as HmrcError;
  const failure = failureForCode(err.errorCode, res.status);
  // errorCode + correlation id only: the body is HMRC's own wording and the
  // request carried a bearer token, so nothing else from this exchange is
  // safe to put in a log line.
  console.warn(`[tfc] ${what} failed: HTTP ${res.status} ${err.errorCode ?? "(no code)"} → ${failure} (correlation ${correlationId})`);
  return fail(failure, err.errorCode, err.errorDescription);
}

// ── OAuth 2.0 (authorization code) ───────────────────────────────────────

/**
 * Where to send the parent to sign in at GOV.UK.
 *
 * `state` is ours: an unguessable, single-use, short-lived id that ties the
 * callback back to the parent and the child who started it. The callback
 * itself can't be authenticated — it's a redirect from HMRC — so the state is
 * the only proof, and it must be treated as one (see routes/tfc.ts).
 *
 * The authorize endpoint on the API host redirects on to the Government
 * Gateway sign-in journey; the parent never types their credentials on a
 * screen of ours.
 */
export function authorizeUrl(cfg: TfcConfig, state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: "tax-free-childcare-payments",
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `${cfg.baseUrl}/oauth/authorize?${q.toString()}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

async function tokenRequest(cfg: TfcConfig, form: Record<string, string>, what: string): Promise<TfcResult<TfcTokens>> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[tfc] ${what} network error:`, (e as Error).message);
    return fail("connection-failed");
  }
  const text = await res.text().catch(() => "");
  let body: TokenResponse = {};
  try { body = text ? (JSON.parse(text) as TokenResponse) : {}; } catch { /* not JSON */ }
  if (!res.ok || !body.access_token || !body.refresh_token) {
    // `body.error` is an OAuth error name ("invalid_grant"), never a secret.
    console.warn(`[tfc] ${what} failed: HTTP ${res.status} ${body.error ?? "(no error field)"}`);
    // A refresh that is refused means the link is over, not that HMRC is down:
    // the parent has to re-authorise, which is the "connection expired" state.
    return fail(what === "token refresh" ? "connection-expired" : "connection-failed");
  }
  return {
    ok: true,
    data: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      // HMRC returns 14400 (4 hours). Default conservatively if it's missing.
      expiresAt: Date.now() + (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000,
    },
  };
}

/** Swap the ?code from the GOV.UK redirect for tokens. */
export function exchangeCode(cfg: TfcConfig, code: string): Promise<TfcResult<TfcTokens>> {
  return tokenRequest(cfg, {
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code,
  }, "token exchange");
}

/** Trade the refresh token for a new access token (and a new refresh token). */
export function refreshTokens(cfg: TfcConfig, refreshToken: string): Promise<TfcResult<TfcTokens>> {
  return tokenRequest(cfg, {
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
  }, "token refresh");
}

/** Refresh a minute before expiry, so a call never starts on a token that
 *  dies mid-flight. */
const EXPIRY_SKEW_MS = 60_000;
export const tokensExpired = (t: TfcTokens) => t.expiresAt - EXPIRY_SKEW_MS <= Date.now();

/**
 * Run `call` with a live access token, refreshing first if the stored one has
 * aged out and retrying ONCE if HMRC rejects the token anyway.
 *
 * `onRefresh` is how the caller persists the new tokens — HMRC rotates the
 * refresh token on every use, so failing to save it means the next refresh is
 * the parent re-authorising.
 */
export async function withFreshTokens<T>(
  cfg: TfcConfig,
  stored: TfcTokens,
  onRefresh: (t: TfcTokens) => Promise<void> | void,
  call: (t: TfcTokens) => Promise<TfcResult<T>>,
): Promise<TfcResult<T>> {
  let tokens = stored;
  let refreshed = false;
  if (tokensExpired(tokens)) {
    const r = await refreshTokens(cfg, tokens.refreshToken);
    if (!r.ok) return r;
    tokens = r.data;
    refreshed = true;
    await onRefresh(tokens);
  }
  const first = await call(tokens);
  // The stored expiry said the token was good and HMRC disagreed (a revoked
  // token, a clock difference, ETFC2). One refresh, one retry — then it really
  // is expired and the parent re-authorises.
  if (first.ok || first.failure !== "connection-expired" || refreshed) return first;
  const r = await refreshTokens(cfg, tokens.refreshToken);
  if (!r.ok) return r;
  await onRefresh(r.data);
  return call(r.data);
}

// ── The three calls ──────────────────────────────────────────────────────

const LINK_PATH = "/individuals/tax-free-childcare/payments/link";
const BALANCE_PATH = "/individuals/tax-free-childcare/payments/balance";
const PAYMENT_PATH = "/individuals/tax-free-childcare/payments/";

/**
 * Link the parent's TFC account to their account with us, for one child.
 *
 * `outboundChildPaymentRef` is the parent's own 12-character reference from
 * the TFC portal (4 letters + 5 digits + "TFC"); `childDateOfBirth` is the
 * cross-check HMRC makes against it. Returns the child's full name as HMRC
 * holds it — that IS the confirmation the link was established.
 */
export function linkAccount(
  cfg: TfcConfig,
  tokens: TfcTokens,
  args: { outboundChildPaymentRef: string; childDateOfBirth: string },
): Promise<TfcResult<{ child_full_name?: string }>> {
  return callHmrc(cfg, tokens, LINK_PATH, {
    epp_unique_customer_id: cfg.eppUniqueCustomerId,
    epp_reg_reference: cfg.eppRegReference,
    outbound_child_payment_ref: args.outboundChildPaymentRef,
    child_date_of_birth: args.childDateOfBirth,
  }, "link");
}

/** One child's TFC account balance, in POUNDS (HMRC sends pence). */
export interface TfcBalanceRead {
  status: "ACTIVE" | "INACTIVE" | string;
  paidInByYou: number;
  governmentTopUp: number;
  totalBalance: number;
  /** What can actually be spent today — "requested payments can not exceed
   *  this amount". This is the figure the checkout shows and warns against. */
  clearedFunds: number;
  topUpAllowance: number;
}

export async function accountBalance(
  cfg: TfcConfig,
  tokens: TfcTokens,
  args: { outboundChildPaymentRef: string },
): Promise<TfcResult<TfcBalanceRead>> {
  type Raw = {
    tfc_account_status?: string;
    paid_in_by_you?: number;
    government_top_up?: number;
    total_balance?: number;
    cleared_funds?: number;
    top_up_allowance?: number;
  };
  const r = await callHmrc<Raw>(cfg, tokens, BALANCE_PATH, {
    epp_unique_customer_id: cfg.eppUniqueCustomerId,
    epp_reg_reference: cfg.eppRegReference,
    outbound_child_payment_ref: args.outboundChildPaymentRef,
  }, "balance");
  if (!r.ok) return r;
  const d = r.data;
  return {
    ok: true,
    data: {
      status: d.tfc_account_status ?? "",
      paidInByYou: toPounds(d.paid_in_by_you ?? 0),
      governmentTopUp: toPounds(d.government_top_up ?? 0),
      totalBalance: toPounds(d.total_balance ?? 0),
      clearedFunds: toPounds(d.cleared_funds ?? 0),
      topUpAllowance: toPounds(d.top_up_allowance ?? 0),
    },
  };
}

/**
 * Ask HMRC to pay the childcare provider from the child's TFC account.
 *
 * `amount` is in pounds here and converted to pence on the wire. The provider
 * identity (`ccpRegReference` / `ccpPostcode`) is the regulator's registration
 * number and the postcode registered with it — from the tenant's
 * `settings.childcare`, never from the browser.
 */
export async function submitPayment(
  cfg: TfcConfig,
  tokens: TfcTokens,
  args: { outboundChildPaymentRef: string; amount: number; ccpRegReference: string; ccpPostcode: string },
): Promise<TfcResult<{ paymentReference: string; estimatedPaymentDate: string }>> {
  const r = await callHmrc<{ payment_reference?: string; estimated_payment_date?: string }>(
    cfg,
    tokens,
    PAYMENT_PATH,
    {
      outbound_child_payment_ref: args.outboundChildPaymentRef,
      epp_unique_customer_id: cfg.eppUniqueCustomerId,
      epp_reg_reference: cfg.eppRegReference,
      payment_amount: toPence(args.amount),
      ccp_reg_reference: args.ccpRegReference,
      ccp_postcode: args.ccpPostcode,
      // The only value the API accepts: funds go straight to the childcare
      // provider, never to us.
      payee_type: "CCP",
    },
    "payment",
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      paymentReference: r.data.payment_reference ?? "",
      estimatedPaymentDate: r.data.estimated_payment_date ?? "",
    },
  };
}
