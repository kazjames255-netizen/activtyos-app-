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
const apiUrl = () => (env("API_URL") || "http://localhost:4000").replace(/\/+$/, "");

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
export type AccountMapping = Partial<Record<MappingBucket, string>>;

export const BUCKET_LABEL: Record<MappingBucket, string> = {
  grossWages: "Gross wages (expense)",
  employerNi: "Employer NI (expense)",
  employerPension: "Employer pension (expense)",
  payeNicLiability: "HMRC PAYE/NIC liability",
  pensionPayable: "Pension payable",
  netWagesBank: "Net wages / bank",
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
  /** Cr Net wages / bank — the balancing line */
  totalNet: number;
}

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

/** Build the period totals from a PayRun's `lines[]` (grossM/payeM/eeNiM/erNiM/eePenM/erPenM/netM — all already pounds, 2dp). */
export function computeTotals(lines: Array<{ grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number }>): PeriodTotals {
  const sum = (f: (l: (typeof lines)[number]) => number) => r2(lines.reduce((a, l) => a + (f(l) || 0), 0));
  const totalGross = sum((l) => l.grossM ?? 0);
  const totalPaye = sum((l) => l.payeM ?? 0);
  const eeNi = sum((l) => l.eeNiM ?? 0);
  const erNi = sum((l) => l.erNiM ?? 0);
  const eePen = sum((l) => l.eePenM ?? 0);
  const erPen = sum((l) => l.erPenM ?? 0);
  const totalNet = sum((l) => l.netM ?? 0);
  return {
    totalGross,
    erNi,
    erPen,
    payeNicLiability: r2(totalPaye + eeNi + erNi),
    pensionPayable: r2(eePen + erPen),
    totalNet,
  };
}

/** `runId + tenantId`, exactly as the spec says — hashed only to give every
 *  provider's idempotency mechanism (header or ≤50-char query param) a
 *  bounded, deterministic, collision-safe token. Same runId + tenantId
 *  always yields the same key — a retried post never double-posts. */
export function idempotencyKey(runId: string, tenantId: string): string {
  return createHash("sha256").update(`${runId}:${tenantId}`).digest("hex").slice(0, 40);
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
  const redirectUri = env("QBO_REDIRECT_URI") || `${apiUrl()}/api/accounting/callback/quickbooks`;
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
  const res = await fetch(QBO_TOKEN_URL, { method: "POST", headers: { Authorization: qboBasicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString() });
  const text = await res.text();
  if (!res.ok) throw new Error(`QuickBooks token exchange failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
export async function qboRevoke(cfg: QboConfig, token: string): Promise<void> {
  await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/revoke", {
    method: "POST",
    headers: { Authorization: qboBasicAuth(cfg), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

/** JournalEntry body — spec §3a. Debit lines first, credit lines balance it (net pay last, balancing). */
export function qboJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; docNumber: string }) {
  const line = (amount: number, postingType: "Debit" | "Credit", accountValue: string | undefined, description: string) => ({
    Amount: r2(amount),
    DetailType: "JournalEntryLineDetail",
    Description: description,
    JournalEntryLineDetail: { PostingType: postingType, AccountRef: { value: accountValue ?? "" } },
  });
  return {
    TxnDate: meta.paidOn,
    DocNumber: meta.docNumber,
    Line: [
      line(totals.totalGross, "Debit", mapping.grossWages, "Gross wages"),
      line(totals.erNi, "Debit", mapping.employerNi, "Employer NI"),
      line(totals.erPen, "Debit", mapping.employerPension, "Employer pension"),
      line(totals.payeNicLiability, "Credit", mapping.payeNicLiability, "HMRC PAYE/NIC liability"),
      line(totals.pensionPayable, "Credit", mapping.pensionPayable, "Pension payable"),
      line(totals.totalNet, "Credit", mapping.netWagesBank, "Net wages"),
    ],
  };
}
export function qboJournalUrl(cfg: QboConfig, realmId: string, runId: string): string {
  return `${cfg.apiBase}/v3/company/${realmId}/journalentry?minorversion=75&requestid=${encodeURIComponent(runId)}`;
}
export async function qboPostJournal(cfg: QboConfig, tokens: QboTokens, runId: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  const res = await fetch(qboJournalUrl(cfg, tokens.realmId, runId), {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QuickBooks journal post failed: HTTP ${res.status} ${text.slice(0, 500)}`);
  const json = JSON.parse(text) as { JournalEntry?: { Id?: string } };
  return { id: json.JournalEntry?.Id ?? "", raw: json };
}
export async function qboAccounts(cfg: QboConfig, tokens: QboTokens): Promise<Array<{ id: string; name: string; type: string }>> {
  const q = encodeURIComponent("select * from Account maxresults 1000");
  const res = await fetch(`${cfg.apiBase}/v3/company/${tokens.realmId}/query?query=${q}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QuickBooks accounts query failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { QueryResponse?: { Account?: Array<{ Id: string; Name: string; AccountType: string }> } };
  return (json.QueryResponse?.Account ?? []).map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType }));
}

// ── Xero ────────────────────────────────────────────────────────────────
export interface XeroConfig { clientId: string; clientSecret: string; redirectUri: string }
export function xeroConfig(): XeroConfig | null {
  const clientId = env("XERO_CLIENT_ID"), clientSecret = env("XERO_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const redirectUri = env("XERO_REDIRECT_URI") || `${apiUrl()}/api/accounting/callback/xero`;
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
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: xeroBasicAuth(cfg), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero token exchange failed: HTTP ${res.status} ${text.slice(0, 300)}`);
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
  const res = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero /connections failed: HTTP ${res.status} ${text.slice(0, 300)}`);
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

/** ManualJournal body — spec §3b. LineAmount +ve = Debit, −ve = Credit; must net to zero. */
export function xeroJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; narration: string }) {
  const line = (amount: number, accountCode: string | undefined, description: string) => ({
    LineAmount: r2(amount),
    AccountCode: accountCode ?? "",
    Description: description,
    TaxType: "NONE",
  });
  return {
    ManualJournals: [
      {
        Narration: meta.narration,
        Date: meta.paidOn,
        Status: "DRAFT",
        LineAmountTypes: "NoTax",
        JournalLines: [
          line(totals.totalGross, mapping.grossWages, "Gross wages"),
          line(totals.erNi, mapping.employerNi, "Employer NI"),
          line(totals.erPen, mapping.employerPension, "Employer pension"),
          line(-totals.payeNicLiability, mapping.payeNicLiability, "HMRC PAYE/NIC liability"),
          line(-totals.pensionPayable, mapping.pensionPayable, "Pension payable"),
          line(-totals.totalNet, mapping.netWagesBank, "Net wages"),
        ],
      },
    ],
  };
}
export async function xeroPostJournal(tokens: XeroTokens, idemKey: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  const res = await fetch("https://api.xero.com/api.xro/2.0/ManualJournals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "xero-tenant-id": tokens.xeroTenantId,
      "Idempotency-Key": idemKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) throw new Error(`Xero rate-limited (429); Retry-After ${res.headers.get("Retry-After") ?? "?"}s`);
    throw new Error(`Xero journal post failed: HTTP ${res.status} ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text) as { ManualJournals?: Array<{ ManualJournalID?: string }> };
  return { id: json.ManualJournals?.[0]?.ManualJournalID ?? "", raw: json };
}
export async function xeroAccounts(tokens: XeroTokens, klass: "EXPENSE" | "LIABILITY"): Promise<Array<{ code: string; name: string; class: string }>> {
  const where = encodeURIComponent(`Class=="${klass}"`);
  const res = await fetch(`https://api.xero.com/api.xro/2.0/Accounts?where=${where}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "xero-tenant-id": tokens.xeroTenantId, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero accounts fetch failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { Accounts?: Array<{ Code: string; Name: string; Class: string }> };
  return (json.Accounts ?? []).map((a) => ({ code: a.Code, name: a.Name, class: a.Class }));
}

// ── Sage Business Cloud Accounting ─────────────────────────────────────────
export interface SageConfig { clientId: string; clientSecret: string; redirectUri: string }
export function sageConfig(): SageConfig | null {
  const clientId = env("SAGE_CLIENT_ID"), clientSecret = env("SAGE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const redirectUri = env("SAGE_REDIRECT_URI") || `${apiUrl()}/api/accounting/callback/sage`;
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
  const res = await fetch("https://oauth.accounting.sage.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sage token exchange failed: HTTP ${res.status} ${text.slice(0, 300)}`);
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
  const res = await fetch("https://api.accounting.sage.com/v3.1/businesses", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sage /businesses failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { $items?: Array<{ id: string; business_name?: string; display_name?: string }> };
  return (json.$items ?? []).map((b) => ({ id: b.id, name: b.business_name || b.display_name || b.id }));
}

/** Sage `/journals` body — spec §3c. Debits must equal credits to the penny or 422. */
export function sageJournalBody(mapping: AccountMapping, totals: PeriodTotals, meta: { paidOn: string; reference: string; details: string }) {
  const line = (accountId: string | undefined, details: string, debit: number, credit: number) => ({
    ledger_account_id: accountId ?? "",
    details,
    debit: r2(debit),
    credit: r2(credit),
  });
  return {
    journal: {
      date: meta.paidOn,
      reference: meta.reference,
      details: meta.details,
      journal_lines: [
        line(mapping.grossWages, "Gross wages", totals.totalGross, 0),
        line(mapping.employerNi, "Employer NI", totals.erNi, 0),
        line(mapping.employerPension, "Employer pension", totals.erPen, 0),
        line(mapping.payeNicLiability, "HMRC PAYE/NIC liability", 0, totals.payeNicLiability),
        line(mapping.pensionPayable, "Pension payable", 0, totals.pensionPayable),
        line(mapping.netWagesBank, "Net wages", 0, totals.totalNet),
      ],
    },
  };
}
export async function sagePostJournal(tokens: SageTokens, idemKey: string, body: unknown): Promise<{ id: string; raw: unknown }> {
  const res = await fetch("https://api.accounting.sage.com/v3.1/journals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "X-Business": tokens.businessId,
      "Idempotency-Key": idemKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sage journal post failed: HTTP ${res.status} ${text.slice(0, 500)}`);
  const json = JSON.parse(text) as { id?: string };
  return { id: json.id ?? "", raw: json };
}
export async function sageAccounts(tokens: SageTokens): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("https://api.accounting.sage.com/v3.1/ledger_accounts?items_per_page=200", {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "X-Business": tokens.businessId, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sage ledger_accounts failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { $items?: Array<{ id: string; displayed_as?: string; nominal_code?: string }> };
  return (json.$items ?? []).map((a) => ({ id: a.id, name: a.displayed_as || a.nominal_code || a.id }));
}

export function providerConfigured(p: Provider): boolean {
  if (p === "quickbooks") return qboConfigured();
  if (p === "xero") return xeroConfigured();
  return sageConfigured();
}
