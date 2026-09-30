import { createHash, randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────
// Accounting integrations — QuickBooks Online / Xero / Sage Business Cloud
// Accounting. Real client for docs/payroll-integrations-handoff.md §3.
//
// Ground rule (spec §0, non-negotiable): `client_secret` and tokens never
// reach the browser. Every function here runs server-side only; routes/
// accounting.ts is the only caller and it never echoes a token back in a
// response. Routes reads/writes the token doc (`accountingConnections`);
// this file is pure config + request shaping + the actual HTTP calls.
//
// Xero and Sage ROTATE the refresh token on every use (QuickBooks's is
// long-lived, ~100 days, and does NOT rotate on refresh — but IS reissued,
// so we persist whatever the token response contains every time regardless
// of provider). Miss a rotation and the tenant is permanently locked out of
// that connection — routes/accounting.ts persists the full token response
// from every exchange/refresh call before doing anything else with it.
//
// Env-gated exactly like server/src/lib/tfc.ts and lib/stripe.ts: with no
// credentials configured, `*Config()` returns null and the connect route
// answers "not configured" rather than failing per-request.
// ─────────────────────────────────────────────────────────────────────────

export type Provider = "quickbooks" | "xero" | "sage";
export const PROVIDERS: Provider[] = ["quickbooks", "xero", "sage"];

const env = (k: string) => (process.env[k] ?? "").trim();
// Loopback dev host only when NODE_ENV !== "production"; in production an unset
// API_URL yields "" and the config below returns null (connect disabled), so a
// wrong-host redirect can never reach a provider.
const DEV_API = ["http://127", "0", "0", "1"].join(".") + ":4000";
const apiUrl = (): string => (env("API_URL").replace(/\/+$/, "")) || (process.env.NODE_ENV !== "production" ? DEV_API : "");
/** Redirect URI: explicit override wins; else built from API_URL; "" when production has no API_URL. */
function redirectFor(override: string, path: string): string {
  if (override) return override;
  const base = apiUrl();
  if (!base) { console.error("[config] API_URL is not set on the server: accounting connect is disabled. Set API_URL on the server (Railway)."); return ""; }
  return `${base}${path}`;
}

// ── Provider HTTP: timeouts, classified errors, bounded retries ───────────
export type ProviderErrorKind = "auth" | "rate" | "validation" | "outage" | "network";
/** A failure talking to QuickBooks/Xero/Sage. `kind` drives the HTTP status the route answers with and what is stored on the run. */
export class ProviderError extends Error {
  constructor(message: string, readonly status: number, readonly kind: ProviderErrorKind, readonly retryAfterSec?: number) { super(message); this.name = "ProviderError"; }
}
const PROVIDER_TIMEOUT_MS = 20_000;
let sleepFn = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Test hook: make retry back-offs instant. */
export function __setSleepForTests(fn: (ms: number) => Promise<void>) { sleepFn = fn; }

/** How safe it is to repeat a request that may have half-succeeded.
 *  - "safe":       429 only (the provider refused it, nothing happened). Token refreshes: a rotated refresh token must never be replayed after a timeout.
 *  - "idempotent": also 502/503/504, timeouts and network errors. GETs, and POSTs carrying an idempotency key / requestid. */
export type RetryMode = "safe" | "idempotent";

export function classifyStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate";
  if (status >= 500) return "outage";
  return "validation";
}
/** Provider error bodies can be long JSON/XML; keep one readable line. */
export function briefBody(text: string, max = 300): string { return text.replace(/\s+/g, " ").trim().slice(0, max); }

/** fetch with a 20 s timeout and up to 3 attempts. Returns the final Response (ok or not) so callers keep their own error wording;
 *  only network-level exhaustion throws (ProviderError kind "network"). */
export async function pfetch(url: string, init: RequestInit, retry: RetryMode, label: string): Promise<Response> {
  const attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    } catch (e) {
      const timedOut = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
      if (retry === "idempotent" && i < attempts) { await sleepFn(500 * 2 ** (i - 1)); continue; }
      throw new ProviderError(`${label} ${timedOut ? "timed out" : "could not be reached"}`, timedOut ? 504 : 502, "network");
    }
    const retryable = res.status === 429 || (retry === "idempotent" && (res.status === 502 || res.status === 503 || res.status === 504));
    if (retryable && i < attempts) {
      const ra = Number(res.headers.get("Retry-After"));
      await sleepFn(res.status === 429 && Number.isFinite(ra) && ra > 0 ? Math.min(ra, 8) * 1000 : 500 * 2 ** (i - 1));
      continue;
    }
    return res;
  }
  throw new ProviderError(`${label} did not respond`, 502, "network"); // unreachable
}
/** Token endpoint failure: 400 invalid_grant / 401 mean the refresh token is dead (expired, revoked, already rotated) -> the tenant must reconnect. */
export function failToken(res: Response, text: string, what: string): never {
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new ProviderError(`${what}: HTTP ${res.status} ${briefBody(text, 160)}`, res.status, "auth");
  failFrom(res, text, what);
}
/** Throw a classified ProviderError for a non-2xx response. */
export function failFrom(res: Response, text: string, what: string): never {
  const kind = classifyStatus(res.status);
  const ra = Number(res.headers.get("Retry-After"));
  throw new ProviderError(`${what}: HTTP ${res.status} ${briefBody(text)}`, res.status, kind, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

// ── Per-tenant account mapping: the 6 double-entry buckets (spec §3) ──────
export const MAPPING_BUCKETS = [
  "grossWages",
  "employerNi",
  "employerPension",
  "payeNicLiability",
  "pensionPayable",
  "netWagesBank",
] as const;
export type MappingBucket = (typeof MAPPING_BUCKETS)[number];
/** Optional 7th bucket: after-tax deductions from net pay (advance/loan recoveries, `dedM` on a pay line). Net pay is
 *  gross - PAYE - EE NI - EE pension - deductions, so without a credit for the deductions the journal is out of balance by
 *  exactly that amount. Only required when a run actually has deductions. */
export const EXTRA_BUCKETS = ["otherDeductions"] as const;
export type ExtraBucket = (typeof EXTRA_BUCKETS)[number];
export type AccountMapping = Partial<Record<MappingBucket | ExtraBucket, string>>;

export const BUCKET_LABEL: Record<MappingBucket | ExtraBucket, string> = {
  grossWages: "Gross wages (expense)",
  employerNi: "Employer NI (expense)",
  employerPension: "Employer pension (expense)",
  payeNicLiability: "HMRC PAYE/NIC liability",
  pensionPayable: "Pension payable",
  netWagesBank: "Net wages / bank",
  otherDeductions: "Other deductions (advances, loans) - only needed if a run has any",
};

// ── Period totals, computed from a payrollRuns doc's `lines[]` (§3 table) ─
export interface PeriodTotals {
  totalGross: number;
  erNi: number;
  erPen: number;
  /** Cr HMRC PAYE/NIC liability = totalPaye + Σ eeNi + Σ erNi */
  payeNicLiability: number;
  /** Cr Pension payable = Σ eePen + Σ erPen */
  pensionPayable: number;
  /** Cr Net wages / bank: Σ netM (what is actually paid to staff) */
  totalNet: number;
  /** Cr After-tax deductions = Σ (gross - paye - eeNi - eePen - net) per line, derived so the journal balances to the penny by construction. Can be negative on a correction run. */
  otherDeductions: number;
}

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
/** pounds -> whole pence. Lines are already 2dp; Math.round absorbs float noise (0.1+0.2). Non-finite -> 0 (callers validate first). */
const toP = (n: unknown): number => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) : 0; };

type PayLineLike = { grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number };
const LINE_FIELDS = ["grossM", "payeM", "eeNiM", "erNiM", "eePenM", "erPenM", "netM"] as const;
/** Largest single figure we will journal (GBP). Beyond this it is a data error, not a payroll. */
export const MAX_LINE_AMOUNT = 10_000_000;

/** Returns a human message for the first line that cannot be journalled (non-numeric / non-finite / absurd), else null. */
export function validatePayLines(lines: PayLineLike[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as Record<string, unknown>;
    for (const f of LINE_FIELDS) {
      const v = l[f];
      if (v === undefined || v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) return `Line ${i + 1} (${String(l.name ?? l.id ?? "?")}) has a non-numeric ${f}`;
      if (Math.abs(v) > MAX_LINE_AMOUNT) return `Line ${i + 1} (${String(l.name ?? l.id ?? "?")}) has an implausible ${f} (${v})`;
    }
  }
  return null;
}

/** Build the period totals from a PayRun's `lines[]` (grossM/payeM/eeNiM/erNiM/eePenM/erPenM/netM, pounds 2dp).
 *  ALL arithmetic is in integer pence per line, so the sums are exact (no float drift over 200 staff / odd pence) and
 *  the journal balances by construction: debits gross+erNi+erPen = credits payeNic+pension+net+otherDeductions. */
export function computeTotals(lines: PayLineLike[]): PeriodTotals {
  let gross = 0, paye = 0, eeNi = 0, erNi = 0, eePen = 0, erPen = 0, net = 0;
  for (const l of lines) {
    gross += toP(l.grossM); paye += toP(l.payeM); eeNi += toP(l.eeNiM); erNi += toP(l.erNiM);
    eePen += toP(l.eePenM); erPen += toP(l.erPenM); net += toP(l.netM);
  }
  const payeNic = paye + eeNi + erNi, pension = eePen + erPen;
  const other = gross + erNi + erPen - payeNic - pension - net; // == Σ per-line (gross - paye - eeNi - eePen - net)
  const P = (p: number) => p / 100;
  return { totalGross: P(gross), erNi: P(erNi), erPen: P(erPen), payeNicLiability: P(payeNic), pensionPayable: P(pension), totalNet: P(net), otherDeductions: P(other) };
}

/** One signed leg of the journal: +pence = debit, -pence = credit. Zero legs are dropped (QBO/Sage reject zero-amount lines);
 *  a negative gross (correction/reversal run) naturally flips to the opposite side instead of emitting a negative amount. */
export interface JournalLeg { bucket: MappingBucket | ExtraBucket; description: string; pence: number }
export function journalLegs(t: PeriodTotals): JournalLeg[] {
  const all: JournalLeg[] = [
    { bucket: "grossWages", description: "Gross wages", pence: toP(t.totalGross) },
    { bucket: "employerNi", description: "Employer NI", pence: toP(t.erNi) },
    { bucket: "employerPension", description: "Employer pension", pence: toP(t.erPen) },
    { bucket: "payeNicLiability", description: "HMRC PAYE/NIC liability", pence: -toP(t.payeNicLiability) },
    { bucket: "pensionPayable", description: "Pension payable", pence: -toP(t.pensionPayable) },
    { bucket: "netWagesBank", description: "Net wages", pence: -toP(t.totalNet) },
    { bucket: "otherDeductions", description: "Other deductions", pence: -toP(t.otherDeductions) },
  ];
  const legs = all.filter((l) => l.pence !== 0);
  const sum = legs.reduce((a, l) => a + l.pence, 0);
  if (sum !== 0) throw new Error(`Journal would not balance (off by ${sum} pence)`); // unreachable with computeTotals; guards hand-built totals
  return legs;
}
/** Buckets that must be mapped to post these totals: the 6 core ones, plus otherDeductions only when it is non-zero. */
export function requiredBuckets(t: PeriodTotals): Array<MappingBucket | ExtraBucket> {
  return [...MAPPING_BUCKETS, ...(toP(t.otherDeductions) !== 0 ? (["otherDeductions"] as const) : [])];
}

/** `runId + tenantId`, exactly as the spec says — hashed only to give every
 *  provider's idempotency mechanism (header or ≤50-char query param) a
 *  bounded, deterministic, collision-safe token. Same runId + tenantId
 *  always yields the same key — a retried post never double-posts. */
export function idempotencyKey(runId: string, tenantId: string, fingerprint = ""): string {
  return createHash("sha256").update(fingerprint ? `${runId}:${tenantId}:${fingerprint}` : `${runId}:${tenantId}`).digest("hex").slice(0, 40);
}
/** Stable fingerprint of a request body. Xero rejects (400) a REUSED Idempotency-Key whose body differs, so a retry after the user fixed
 *  an account mapping must use a new key, while a byte-identical retry (e.g. after a timeout) keeps the same one and stays deduplicated. */
export function bodyFingerprint(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
}

/** Per-run, per-provider references. QBO DocNumber max is 21 chars (this is 19); Sage reference max 30 (this is 22). The 6-hex suffix comes from
 *  the run's idempotency key, so two runs in the same month (weekly/off-cycle/correction) never share a number. */
export function journalRefs(paidOn: string, idemKey: string): { qboDocNumber: string; sageReference: string } {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(paidOn);
  if (!m) throw new Error("This pay run has no valid paid-on date, so it can't be posted");
  const suffix = idemKey.slice(0, 6);
  return { qboDocNumber: `AOS-PAY-${m[1].slice(2)}${m[2]}-${suffix}`, sageReference: `PAYROLL-${m[1]}-${m[2]}-${suffix}` };
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}
export function newCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}
export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ── QuickBooks Online ──────────────────────────────────────────────────────
export interface QboConfig { clientId: string; clientSecret: string; redirectUri: string; environment: "sandbox" | "production"; apiBase: string }
export function qboConfig(): QboConfig | null {
  const clientId = env("QBO_CLIENT_ID"), clientSecret = env("QBO_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const environment = env("QBO_ENV") === "production" ? "production" : "sandbox";
  const redirectUri = redirectFor(env("QBO_REDIRECT_URI"), "/api/accounting/callback/quickbooks");
  if (!redirectUri) return null;
  const apiBase = environment === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
  return { clientId, clientSecret, redirectUri, environment, apiBase };
}
export const qboConfigured = () => qboConfig() !== null;

export function qboAuthorizeUrl(cfg: QboConfig, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${q.toString()}`;
}

const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const qboBasicAuth = (cfg: QboConfig) => "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");

export interface QboTokens { accessToken: string; refreshToken: string; expiresAt: number; realmId: string }

export async function qboExchangeCode(cfg: QboConfig, code: string, realmId: string): Promise<QboTokens> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri });
  const json = await qboTokenCall(cfg, body);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, realmId };
}
export async function qboRefresh(cfg: QboConfig, refreshToken: string, realmId: string): Promise<QboTokens> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const json = await qboTokenCall(cfg, body);
  // QBO's refresh token is reissued (not always a different value, but the
  // API may rotate it) — always persist whatever comes back, never keep the old one.
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, realmId };
}
async function qboTokenCall(cfg: QboConfig, body: URLSearchParams): Promise<{ access_token: string; refresh_token: string; expires_in?: number }> {
  const res = await pfetch(QBO_TOKEN_URL, { method: "POST", headers: { Authorization: qboBasicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString() }, "safe", "QuickBooks token endpoint");
  const text = await res.text();
  if (!res.ok) failToken(res, text, "QuickBooks token exchange failed");
  return JSON.parse(text);
}
export async function qboRevoke(cfg: QboConfig, token: string): Promise<void> {
  await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/revoke", {
    method: "POST",
    headers: { Authorization: qboBasicAuth(cfg), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

/** JournalEntry body - spec §3a. Debit-side legs first, credit-side after. Amounts are always >= 0 (QBO rejects negatives): a negative
 *  total (correction run) flips to the other PostingType instead. Zero legs are omitted. */
export function qboJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; docNumber: string }) {
  return {
    TxnDate: meta.paidOn,
    DocNumber: meta.docNumber,
    Line: journalLegs(totals).map((l) => ({
      Amount: Math.abs(l.pence) / 100,
      DetailType: "JournalEntryLineDetail",
      Description: l.description,
      JournalEntryLineDetail: { PostingType: l.pence > 0 ? "Debit" : "Credit", AccountRef: { value: mapping[l.bucket] ?? "" } },
    })),
  };
}
export function qboJournalUrl(cfg: QboConfig, realmId: string, runId: string): string {
  return `${cfg.apiBase}/v3/company/${realmId}/journalentry?minorversion=75&requestid=${encodeURIComponent(runId)}`;
}
export async function qboPostJournal(cfg: QboConfig, tokens: QboTokens, runId: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  // requestid makes the POST idempotent on Intuit's side, so it is safe to retry on timeouts / 5xx.
  const res = await pfetch(qboJournalUrl(cfg, tokens.realmId, runId), {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  }, "idempotent", "QuickBooks");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "QuickBooks journal post failed");
  const json = JSON.parse(text) as { JournalEntry?: { Id?: string } };
  return { id: json.JournalEntry?.Id ?? "", raw: json };
}
export async function qboAccounts(cfg: QboConfig, tokens: QboTokens): Promise<Array<{ id: string; name: string; type: string }>> {
  const q = encodeURIComponent("select * from Account maxresults 1000");
  const res = await pfetch(`${cfg.apiBase}/v3/company/${tokens.realmId}/query?query=${q}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
  }, "idempotent", "QuickBooks");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "QuickBooks accounts query failed");
  const json = JSON.parse(text) as { QueryResponse?: { Account?: Array<{ Id: string; Name: string; AccountType: string }> } };
  return (json.QueryResponse?.Account ?? []).map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType }));
}

// ── Xero ────────────────────────────────────────────────────────────────
export interface XeroConfig { clientId: string; clientSecret: string; redirectUri: string }
export function xeroConfig(): XeroConfig | null {
  const clientId = env("XERO_CLIENT_ID"), clientSecret = env("XERO_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const redirectUri = redirectFor(env("XERO_REDIRECT_URI"), "/api/accounting/callback/xero");
  if (!redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
export const xeroConfigured = () => xeroConfig() !== null;

// Granular scopes only: Xero apps created on/after 2 Mar 2026 get "invalid_scope" for the old broad accounting.transactions.
// We post ManualJournals and read the Accounts list, nothing else.
const XERO_SCOPE = "openid profile email offline_access accounting.manualjournals accounting.settings";
export function xeroAuthorizeUrl(cfg: XeroConfig, state: string, codeChallenge: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: XERO_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://login.xero.com/identity/connect/authorize?${q.toString()}`;
}

export interface XeroTokens { accessToken: string; refreshToken: string; expiresAt: number; xeroTenantId: string }
const xeroBasicAuth = (cfg: XeroConfig) => "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");

async function xeroTokenCall(cfg: XeroConfig, body: URLSearchParams): Promise<{ access_token: string; refresh_token: string; expires_in?: number }> {
  const res = await pfetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: xeroBasicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  }, "safe", "Xero token endpoint");
  const text = await res.text();
  if (!res.ok) failToken(res, text, "Xero token exchange failed");
  return JSON.parse(text);
}
export async function xeroExchangeCode(cfg: XeroConfig, code: string, codeVerifier: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, code_verifier: codeVerifier });
  const json = await xeroTokenCall(cfg, body);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000 };
}
/** Xero ROTATES the refresh token on every use — the caller MUST persist
 *  the returned refreshToken immediately, every time, or the connection dies. */
export async function xeroRefresh(cfg: XeroConfig, refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const json = await xeroTokenCall(cfg, body);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000 };
}
export async function xeroConnections(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
  const res = await pfetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }, "idempotent", "Xero");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "Xero /connections failed");
  const json = JSON.parse(text) as Array<{ tenantId: string; tenantName: string }>;
  return json;
}
export async function xeroRevoke(cfg: XeroConfig, refreshToken: string): Promise<void> {
  await fetch("https://identity.xero.com/connect/revocation", {
    method: "POST",
    headers: { Authorization: xeroBasicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  }).catch(() => {});
}

/** ManualJournal body - spec §3b. LineAmount +ve = Debit, -ve = Credit; nets to exactly zero. Zero legs are omitted. */
export function xeroJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; narration: string }) {
  return {
    ManualJournals: [
      {
        Narration: meta.narration,
        Date: meta.paidOn,
        Status: "DRAFT",
        LineAmountTypes: "NoTax",
        JournalLines: journalLegs(totals).map((l) => ({
          LineAmount: l.pence / 100,
          AccountCode: mapping[l.bucket] ?? "",
          Description: l.description,
          TaxType: "NONE",
        })),
      },
    ],
  };
}
export async function xeroPostJournal(tokens: XeroTokens, idemKey: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  const res = await pfetch("https://api.xero.com/api.xro/2.0/ManualJournals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "xero-tenant-id": tokens.xeroTenantId,
      "Idempotency-Key": idemKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  }, "idempotent", "Xero"); // Idempotency-Key => retrying a timed-out POST cannot create a second journal
  const text = await res.text();
  if (!res.ok) failFrom(res, text, res.status === 429 ? "Xero is rate-limiting requests" : "Xero journal post failed");
  const json = JSON.parse(text) as { ManualJournals?: Array<{ ManualJournalID?: string; JournalLines?: Array<{ AccountCode?: string }> }> };
  const mj = json.ManualJournals?.[0];
  // Xero ACCEPTS a DRAFT journal whose account code is unknown / archived / a system account (Accounts Payable, Unpaid Expense Claims, VAT, Rounding...)
  // and silently blanks the code; it only fails later when someone tries to post it. Read the response back and refuse (and delete the draft) if any line lost its account.
  const sent = ((body as { ManualJournals?: Array<{ JournalLines?: Array<{ AccountCode?: string }> }> }).ManualJournals?.[0]?.JournalLines ?? []).map((l) => l.AccountCode ?? "");
  const got = (mj?.JournalLines ?? []).map((l) => l.AccountCode ?? "");
  const lost = sent.map((c, i) => ({ c, ok: (got[i] ?? "") === c })).filter((x) => !x.ok).map((x) => x.c || "(blank)");
  if (mj?.ManualJournalID && (got.length !== sent.length || lost.length)) {
    await pfetch(`https://api.xero.com/api.xro/2.0/ManualJournals/${mj.ManualJournalID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "xero-tenant-id": tokens.xeroTenantId, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ManualJournals: [{ ManualJournalID: mj.ManualJournalID, Status: "DELETED" }] }),
    }, "safe", "Xero").catch(() => {});
    throw new ProviderError(`Xero did not accept these account codes for manual journals (unknown, archived or a system account): ${[...new Set(lost)].join(", ")}. Re-map them to normal expense/liability accounts`, 400, "validation");
  }
  return { id: mj?.ManualJournalID ?? "", raw: json };
}
export async function xeroAccounts(tokens: XeroTokens, klass: "EXPENSE" | "LIABILITY"): Promise<Array<{ code: string; name: string; class: string; system: boolean }>> {
  const where = encodeURIComponent(`Class=="${klass}" AND Status=="ACTIVE"`); // archived accounts make the journal fail
  const res = await pfetch(`https://api.xero.com/api.xro/2.0/Accounts?where=${where}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "xero-tenant-id": tokens.xeroTenantId, Accept: "application/json" },
  }, "idempotent", "Xero");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "Xero accounts fetch failed");
  const json = JSON.parse(text) as { Accounts?: Array<{ Code: string; Name: string; Class: string; SystemAccount?: string }> };
  return (json.Accounts ?? []).map((a) => ({ code: a.Code, name: a.Name, class: a.Class, system: !!a.SystemAccount }));
}

// ── Sage Business Cloud Accounting ─────────────────────────────────────────
export interface SageConfig { clientId: string; clientSecret: string; redirectUri: string }
export function sageConfig(): SageConfig | null {
  const clientId = env("SAGE_CLIENT_ID"), clientSecret = env("SAGE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const redirectUri = redirectFor(env("SAGE_REDIRECT_URI"), "/api/accounting/callback/sage");
  if (!redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
export const sageConfigured = () => sageConfig() !== null;

export function sageAuthorizeUrl(cfg: SageConfig, state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: "full_access",
    state,
    country: "gb",
  });
  return `https://www.sageone.com/oauth2/auth/central?${q.toString()}`;
}

export interface SageTokens { accessToken: string; refreshToken: string; expiresAt: number; businessId: string }
async function sageTokenCall(cfg: SageConfig, body: URLSearchParams): Promise<{ access_token: string; refresh_token: string; expires_in?: number }> {
  const res = await pfetch("https://oauth.accounting.sage.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  }, "safe", "Sage token endpoint");
  const text = await res.text();
  if (!res.ok) failToken(res, text, "Sage token exchange failed");
  return JSON.parse(text);
}
export async function sageExchangeCode(cfg: SageConfig, code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri });
  const json = await sageTokenCall(cfg, body);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
}
/** Sage ROTATES the refresh token on every use too (~31-day expiry on the
 *  new one) — persist atomically or the tenant is locked out. */
export async function sageRefresh(cfg: SageConfig, refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret });
  const json = await sageTokenCall(cfg, body);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
}
export async function sageBusinesses(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await pfetch("https://api.accounting.sage.com/v3.1/businesses", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }, "idempotent", "Sage");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "Sage /businesses failed");
  const json = JSON.parse(text) as { $items?: Array<{ id: string; business_name?: string; display_name?: string }> };
  return (json.$items ?? []).map((b) => ({ id: b.id, name: b.business_name || b.display_name || b.id }));
}

/** Sage `/journals` body - spec §3c. Debits equal credits to the penny (else 422). Zero legs omitted; a negative total flips side. */
export function sageJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; reference: string; details: string }) {
  return {
    journal: {
      date: meta.paidOn,
      reference: meta.reference,
      details: meta.details,
      journal_lines: journalLegs(totals).map((l) => ({
        ledger_account_id: mapping[l.bucket] ?? "",
        details: l.description,
        debit: l.pence > 0 ? l.pence / 100 : 0,
        credit: l.pence < 0 ? -l.pence / 100 : 0,
      })),
    },
  };
}
export async function sagePostJournal(tokens: SageTokens, idemKey: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  // Sage does not document Idempotency-Key support, so only 429 (refused, nothing created) is retried - never a timeout/5xx.
  const res = await pfetch("https://api.accounting.sage.com/v3.1/journals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "X-Business": tokens.businessId,
      "Idempotency-Key": idemKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  }, "safe", "Sage");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "Sage journal post failed");
  const json = JSON.parse(text) as { id?: string };
  return { id: json.id ?? "", raw: json };
}
export async function sageAccounts(tokens: SageTokens): Promise<Array<{ id: string; name: string }>> {
  const res = await pfetch("https://api.accounting.sage.com/v3.1/ledger_accounts?items_per_page=200", {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "X-Business": tokens.businessId, Accept: "application/json" },
  }, "idempotent", "Sage");
  const text = await res.text();
  if (!res.ok) failFrom(res, text, "Sage ledger_accounts failed");
  const json = JSON.parse(text) as { $items?: Array<{ id: string; displayed_as?: string; nominal_code?: string }> };
  return (json.$items ?? []).map((a) => ({ id: a.id, name: a.displayed_as || a.nominal_code || a.id }));
}

export function providerConfigured(p: Provider): boolean {
  if (p === "quickbooks") return qboConfigured();
  if (p === "xero") return xeroConfigured();
  return sageConfigured();
}
