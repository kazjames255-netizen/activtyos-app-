import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { isPayrollAdmin } from "./payroll";
import { auditPayroll } from "../lib/payrollAudit";
import {
  PROVIDERS, MAPPING_BUCKETS, BUCKET_LABEL, type Provider, type AccountMapping,
  computeTotals, idempotencyKey, newState, newCodeVerifier, codeChallengeS256,
  qboConfig, qboConfigured, qboAuthorizeUrl, qboExchangeCode, qboRefresh, qboRevoke, qboJournalBody, qboPostJournal, qboAccounts, type QboTokens,
  xeroConfig, xeroConfigured, xeroAuthorizeUrl, xeroExchangeCode, xeroRefresh, xeroConnections, xeroRevoke, xeroJournalBody, xeroPostJournal, xeroAccounts, type XeroTokens,
  sageConfig, sageConfigured, sageAuthorizeUrl, sageExchangeCode, sageRefresh, sageBusinesses, sageJournalBody, sagePostJournal, sageAccounts, type SageTokens,
  pfetch, ProviderError, type ProviderErrorKind, bodyFingerprint, EXTRA_BUCKETS, validatePayLines, requiredBuckets, journalRefs,
} from "../lib/accounting";
import { BRAND } from "../lib/brand";

// ─────────────────────────────────────────────────────────────────────────
// Accounting integrations — QuickBooks Online / Xero / Sage Business Cloud
// Accounting. Backend for docs/payroll-integrations-handoff.md §3 (build
// item #39's accounting piece). See server/src/lib/accounting.ts for the
// provider clients (config, OAuth, journal request shapes).
//
// GROUND RULE (spec §0, non-negotiable): `client_secret` and every token are
// backend-only. Nothing in this file ever puts a token, refresh token or
// client secret in a res.json() body — every endpoint below returns only
// booleans/timestamps/ids. The browser calls US; we hold the tokens and talk
// to the provider.
//
// Collections (new, additive — nothing here touches payrollRuns except a
// merge write of `accounting.*` in POST /post/:runId, and that's a plain
// Firestore .set(..., {merge:true}) on a doc routes/payroll.ts already owns
// and reads elsewhere — never a call into that file):
//   accountingConnections/{key}__{provider}  — tokens + provider ids (NEVER served to the browser)
//   accountingOAuthStates/{state}            — short-lived OAuth handshake state (PKCE verifier for Xero)
//   accountingMappings/{key}__{provider}     — the 6-bucket account-code mapping (no secrets, but still manager-gated)
//
// `key` is the same tenant/franchise pay-scope payroll.ts uses
// (`tenantId` or `tenantId__fr__franchiseId`) — duplicated here (canManage/
// keyOf) rather than imported, since payroll.ts is owned by another agent
// tonight and this file must not touch it.
// ─────────────────────────────────────────────────────────────────────────

export const accounting = Router();
/** Provider's OAuth redirect — mounted PUBLIC at /api/accounting/callback/:provider (see index.ts), above requireAuth: it arrives as a plain browser navigation with no Authorization header. The unguessable, single-use `state` is what ties it back to the tenant that started it. */
export const accountingCallback = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const docKey = (key: string, provider: string) => `${key}__${provider}`.replace(/\//g, "_");

const connections = db.collection("accountingConnections");
const states = db.collection("accountingOAuthStates");
const mappings = db.collection("accountingMappings");
const runsCol = db.collection("payrollRuns");

const STATE_TTL_MS = 15 * 60_000;
const isProvider = (p: string): p is Provider => (PROVIDERS as string[]).includes(p);

async function manager(req: Request, res: Response): Promise<{ key: string; tenantId: string; franchiseId: string | null } | null> {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager or owner can manage accounting integrations" }); return null; }
  // Wages journals and payroll account mappings are payroll data: the same payrollAdmins allow-list as /api/payroll applies.
  if (!(await isPayrollAdmin(req))) { res.status(403).json({ error: "Only a payroll administrator can manage accounting integrations. Ask an owner to add you in Setup." }); return null; }
  return { key: keyOf(auth.tenantId, auth.franchiseId), tenantId: auth.tenantId, franchiseId: auth.franchiseId };
}

// ── Connection status (no secrets) ─────────────────────────────────────────
// GET /api/accounting/connections — { quickbooks: {configured, connected, connectedAt, companyName?}, xero: {...}, sage: {...} }
accounting.get("/connections", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const configured: Record<Provider, boolean> = { quickbooks: qboConfigured(), xero: xeroConfigured(), sage: sageConfigured() };
  const out: Record<string, unknown> = {};
  await Promise.all(PROVIDERS.map(async (p) => {
    const snap = await connections.doc(docKey(scope.key, p)).get();
    out[p] = snap.exists
      ? { configured: configured[p], connected: true, connectedAt: snap.get("connectedAt") ?? null, connectedBy: snap.get("connectedBy") ?? null, label: snap.get("label") ?? null, needsReconnect: snap.get("needsReconnect") === true }
      : { configured: configured[p], connected: false };
  }));
  res.json(out);
});

// ── Connect: build the provider's authorize URL ─────────────────────────────
// GET /api/accounting/:provider/connect
accounting.get("/:provider/connect", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }

  const state = newState();
  const base = { tenantId: scope.tenantId, franchiseId: scope.franchiseId, key: scope.key, provider, createdBy: req.user?.email ?? null, createdAt: new Date().toISOString(), expiresAt: Date.now() + STATE_TTL_MS, status: "pending" as const };

  if (provider === "quickbooks") {
    const cfg = qboConfig();
    if (!cfg) { res.status(503).json({ error: "QuickBooks isn't configured on this server (QBO_CLIENT_ID/QBO_CLIENT_SECRET)" }); return; }
    await states.doc(state).set(base);
    auditPayroll(req, scope.key, "accounting-connect", { provider });
    res.json({ url: qboAuthorizeUrl(cfg, state) });
    return;
  }
  if (provider === "xero") {
    const cfg = xeroConfig();
    if (!cfg) { res.status(503).json({ error: "Xero isn't configured on this server (XERO_CLIENT_ID/XERO_CLIENT_SECRET)" }); return; }
    const codeVerifier = newCodeVerifier();
    await states.doc(state).set({ ...base, codeVerifier });
    auditPayroll(req, scope.key, "accounting-connect", { provider });
    res.json({ url: xeroAuthorizeUrl(cfg, state, codeChallengeS256(codeVerifier)) });
    return;
  }
  const cfg = sageConfig();
  if (!cfg) { res.status(503).json({ error: "Sage isn't configured on this server (SAGE_CLIENT_ID/SAGE_CLIENT_SECRET)" }); return; }
  await states.doc(state).set(base);
  auditPayroll(req, scope.key, "accounting-connect", { provider });
  res.json({ url: sageAuthorizeUrl(cfg, state) });
});

// ── Disconnect ───────────────────────────────────────────────────────────
// POST /api/accounting/:provider/disconnect
accounting.post("/:provider/disconnect", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }
  const ref = connections.doc(docKey(scope.key, provider));
  const snap = await ref.get();
  if (snap.exists) {
    try {
      if (provider === "quickbooks") { const cfg = qboConfig(); if (cfg) await qboRevoke(cfg, String(snap.get("refreshToken") ?? "")); }
      if (provider === "xero") { const cfg = xeroConfig(); if (cfg) await xeroRevoke(cfg, String(snap.get("refreshToken") ?? "")); }
      // Sage has no documented revoke endpoint on Business Cloud Accounting — the token simply expires (access ~5min, refresh ~31 days).
    } catch (e) { console.warn(`[accounting] ${provider} revoke failed (deleting the local connection anyway):`, (e as Error).message); }
    await ref.delete();
    auditPayroll(req, scope.key, "accounting-disconnect", { provider });
  }
  res.json({ ok: true });
});

// ── Fresh tokens: read the stored connection, refresh if needed, and - the
// non-negotiable part - PERSIST the (possibly rotated) tokens BEFORE doing
// anything else with them. Xero and Sage rotate the refresh token on every
// single use; missing that persist once means the tenant is locked out of
// the connection for good.
//
// Concurrency: two simultaneous requests for one expired connection must not
// both spend the same rotating refresh token (the loser would get invalid_grant
// and wrongly look "disconnected"). Refreshes are single-flighted per
// connection in this process, and re-check the stored doc first so a rotation
// done moments ago is reused rather than repeated.
//
// A dead refresh token (expired / revoked / already rotated) surfaces as a
// ProviderError kind "auth": the connection is flagged `needsReconnect` and the
// callers answer 409 "reconnect", never a 500. ───────────────────────────────
type ConnData = FirebaseFirestore.DocumentData;
type Refreshed = { accessToken: string; refreshToken: string; expiresAt: number };
const refreshing = new Map<string, Promise<ConnData>>();
const PROVIDER_NAME: Record<Provider, string> = { quickbooks: "QuickBooks", xero: "Xero", sage: "Sage" };

async function freshConn(key: string, provider: Provider, skewMs: number, refresh: (cur: ConnData) => Promise<Refreshed>, opts: { force?: boolean; staleAccessToken?: string } = {}): Promise<ConnData | null> {
  const dk = docKey(key, provider);
  const ref = connections.doc(dk);
  const snap = await ref.get(); if (!snap.exists) return null;
  const d = snap.data()!;
  if (!opts.force && Date.now() <= (d.expiresAt as number) - skewMs) return d;
  const inflight = refreshing.get(dk);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const cur = (await ref.get()).data() ?? d; // someone may have rotated it while we queued
      const stillFresh = Date.now() <= (cur.expiresAt as number) - skewMs;
      if (stillFresh && (!opts.force || (opts.staleAccessToken && cur.accessToken !== opts.staleAccessToken))) return cur;
      const t = await refresh(cur);
      await ref.set({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, updatedAt: new Date().toISOString(), needsReconnect: false }, { merge: true });
      return { ...cur, ...t };
    } catch (e) {
      if (e instanceof ProviderError && e.kind === "auth") {
        await ref.set({ needsReconnect: true, lastAuthError: e.message.slice(0, 200), lastAuthErrorAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        throw new ProviderError(`${PROVIDER_NAME[provider]} rejected our saved sign-in (it expired or was revoked). Reconnect ${PROVIDER_NAME[provider]} under Payroll > Accounting.`, 401, "auth");
      }
      throw e;
    } finally { refreshing.delete(dk); }
  })();
  refreshing.set(dk, p);
  return p;
}
async function freshQbo(key: string, opts?: { force?: boolean; staleAccessToken?: string }): Promise<QboTokens | null> {
  const cfg = qboConfig(); if (!cfg) return null;
  const d = await freshConn(key, "quickbooks", 60_000, (c) => qboRefresh(cfg, c.refreshToken, c.realmId), opts);
  return d ? { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresAt: d.expiresAt, realmId: d.realmId } : null;
}
async function freshXero(key: string, opts?: { force?: boolean; staleAccessToken?: string }): Promise<XeroTokens | null> {
  const cfg = xeroConfig(); if (!cfg) return null;
  const d = await freshConn(key, "xero", 60_000, (c) => xeroRefresh(cfg, c.refreshToken), opts);
  return d ? { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresAt: d.expiresAt, xeroTenantId: d.xeroTenantId } : null;
}
async function freshSage(key: string, opts?: { force?: boolean; staleAccessToken?: string }): Promise<SageTokens | null> {
  const cfg = sageConfig(); if (!cfg) return null;
  const d = await freshConn(key, "sage", 30_000, (c) => sageRefresh(cfg, c.refreshToken), opts);
  return d ? { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresAt: d.expiresAt, businessId: d.businessId } : null;
}
/** Run `fn` with fresh tokens; on a 401 (token revoked/rotated behind our back) force ONE refresh and retry once. */
async function withTokens<T>(tokensOf: (o?: { force?: boolean; staleAccessToken?: string }) => Promise<{ accessToken: string } | null>, fn: (t: any) => Promise<T>): Promise<T | null> {
  const t = await tokensOf(); if (!t) return null;
  try { return await fn(t); }
  catch (e) {
    if (!(e instanceof ProviderError) || e.status !== 401) throw e;
    const t2 = await tokensOf({ force: true, staleAccessToken: t.accessToken }); if (!t2) return null;
    return fn(t2);
  }
}
/** Maps any failure from the provider layer to a clean HTTP answer + a stable kind stored on the run. */
function providerFailure(provider: Provider, e: unknown): { status: number; kind: ProviderErrorKind | "internal"; message: string; retryAfterSec?: number } {
  const name = PROVIDER_NAME[provider];
  if (e instanceof ProviderError) {
    if (e.kind === "auth") return { status: 409, kind: "auth", message: e.message.startsWith(name) && /Reconnect/.test(e.message) ? e.message : `${name} refused our credentials. Reconnect ${name} under Payroll > Accounting, then retry.` };
    if (e.kind === "rate") return { status: 429, kind: "rate", message: `${name} is rate-limiting us right now. Wait a minute and retry.`, retryAfterSec: e.retryAfterSec ?? 30 };
    if (e.kind === "validation") return { status: 422, kind: "validation", message: `${name} rejected the journal: ${e.message}` };
    if (e.kind === "network") return { status: e.status === 504 ? 504 : 502, kind: "network", message: `${e.message}. Nothing was posted; retry shortly.` };
    return { status: 502, kind: "outage", message: `${name} is having problems (${e.message}). Retry shortly.` };
  }
  return { status: 502, kind: "internal", message: `Couldn't post to ${name}: ${(e as Error).message}` };
}

// ── Chart-of-accounts list, for the mapping dropdowns ───────────────────────
// GET /api/accounting/:provider/accounts
type AcctRow = { id: string; name: string; group: string };
/** The provider's chart of accounts, normalised. `group`: "expense" | "liability" | "bank" | "asset" | "receivable-payable" | "other". */
async function loadAccounts(provider: Provider, key: string): Promise<AcctRow[] | null> {
  if (provider === "quickbooks") {
    const cfg = qboConfig(); if (!cfg) return null;
    const rows = await withTokens((o) => freshQbo(key, o), (t: QboTokens) => qboAccounts(cfg, t));
    if (!rows) return null;
    const group = (t: string) => (["Expense", "Other Expense", "Cost of Goods Sold"].includes(t) ? "expense" : ["Other Current Liability", "Long Term Liability", "Credit Card"].includes(t) ? "liability" : t === "Bank" ? "bank" : ["Other Current Asset", "Fixed Asset", "Other Asset"].includes(t) ? "asset" : ["Accounts Receivable", "Accounts Payable"].includes(t) ? "receivable-payable" : "other");
    return rows.map((a) => ({ id: a.id, name: `${a.name} (${a.type})`, group: group(a.type) }));
  }
  if (provider === "xero") {
    const rows = await withTokens((o) => freshXero(key, o), async (t: XeroTokens) => { const [e, l] = await Promise.all([xeroAccounts(t, "EXPENSE"), xeroAccounts(t, "LIABILITY")]); return [...e, ...l]; });
    return rows ? rows.filter((a) => a.code).map((a) => ({ id: a.code, name: `${a.name} (${a.class})`, group: a.system ? "system" : a.class === "EXPENSE" ? "expense" : "liability" })) : null;
  }
  const rows = await withTokens((o) => freshSage(key, o), (t: SageTokens) => sageAccounts(t));
  return rows ? rows.map((a) => ({ id: a.id, name: a.name, group: "other" })) : null;
}

accounting.get("/:provider/accounts", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }
  try {
    const rows = await loadAccounts(provider, scope.key);
    if (!rows) { res.status(409).json({ error: `${PROVIDER_NAME[provider]} isn't connected` }); return; }
    // System accounts (Xero: Accounts Payable, VAT, Unpaid Expense Claims, Rounding...) and AR/AP control accounts can't take a manual journal line: don't offer them.
    res.json(rows.filter((a) => a.group !== "system" && a.group !== "receivable-payable").map((a) => ({ id: a.id, name: a.name })));
  } catch (e) {
    console.error(`[accounting] ${provider} accounts fetch failed:`, (e as Error).message);
    const f = providerFailure(provider, e);
    if (f.retryAfterSec) res.setHeader("Retry-After", String(f.retryAfterSec));
    res.status(f.status).json({ error: f.kind === "auth" || f.kind === "rate" ? f.message : `Couldn't fetch the chart of accounts from ${PROVIDER_NAME[provider]}. ${f.kind === "outage" || f.kind === "network" ? "Try again shortly." : "Try reconnecting."}` });
  }
});

// ── Account mapping (the 6 buckets) ─────────────────────────────────────────
const acct = z.string().trim().max(120).optional();
const mappingSchema = z.object({
  provider: z.enum(["quickbooks", "xero", "sage"]),
  mapping: z.object({
    grossWages: acct, employerNi: acct, employerPension: acct, payeNicLiability: acct, pensionPayable: acct, netWagesBank: acct, otherDeductions: acct,
  }),
});

// GET /api/accounting/mapping?provider=xero
accounting.get("/mapping", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const provider = String(req.query.provider ?? "");
  if (!isProvider(provider)) { res.status(400).json({ error: "provider is required" }); return; }
  const snap = await mappings.doc(docKey(scope.key, provider)).get();
  res.json({ buckets: [...MAPPING_BUCKETS, ...EXTRA_BUCKETS].map((b) => ({ key: b, label: BUCKET_LABEL[b] })), mapping: (snap.get("mapping") as AccountMapping | undefined) ?? {} });
});

/** Which chart-of-accounts groups each bucket may use. Debits need expense accounts; the HMRC/pension credits need liabilities; net pay can also be a bank account
 *  (QBO). Accounts Receivable/Payable are refused everywhere (QBO requires a customer/vendor on those journal lines). Xero cannot journal to bank accounts at all. */
const BUCKET_GROUPS: Record<string, string[]> = {
  grossWages: ["expense"], employerNi: ["expense"], employerPension: ["expense"],
  payeNicLiability: ["liability"], pensionPayable: ["liability"],
  netWagesBank: ["bank", "liability"],
  otherDeductions: ["liability", "asset", "bank", "expense"],
};

// PUT /api/accounting/mapping {provider, mapping} - REPLACES the whole mapping (a cleared dropdown really clears it). When the provider is
// connected the ids are checked against its live chart of accounts: unknown / wrong-type accounts are refused with a per-bucket message.
accounting.put("/mapping", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { provider } = parsed.data;
  const mapping = Object.fromEntries(Object.entries(parsed.data.mapping).filter(([, v]) => !!v)) as AccountMapping;
  let validated = false;
  if (provider !== "sage" && Object.keys(mapping).length) {
    try {
      const rows = await loadAccounts(provider, scope.key);
      if (rows) {
        const byId = new Map(rows.map((a) => [a.id, a]));
        const problems: Record<string, string> = {};
        for (const [bucket, id] of Object.entries(mapping)) {
          const a = byId.get(id!);
          if (!a) { problems[bucket] = `Account "${id}" doesn't exist (or is archived) in ${PROVIDER_NAME[provider]}`; continue; }
          if (a.group === "system") { problems[bucket] = `${a.name} is a Xero system account and can't be used in manual journals. Pick another`; continue; }
          if (a.group === "receivable-payable") { problems[bucket] = `${a.name} is a receivable/payable control account; journals to it need a customer/supplier. Pick another`; continue; }
          const allowed = BUCKET_GROUPS[bucket] ?? [];
          if (!allowed.includes(a.group)) problems[bucket] = `${a.name} is the wrong kind of account for "${BUCKET_LABEL[bucket as keyof typeof BUCKET_LABEL]}" (needs ${allowed.join(" or ")})`;
        }
        if (Object.keys(problems).length) { res.status(400).json({ error: `Some accounts can't be used: ${Object.values(problems).join("; ")}`, problems }); return; }
        validated = true;
      }
    } catch (e) {
      // Provider unreachable / reconnect needed: don't block saving a mapping, but say it wasn't verified. The post still re-validates via the provider's own 4xx.
      console.warn(`[accounting] mapping validation skipped for ${provider}:`, (e as Error).message);
    }
  }
  const prevMap = (await mappings.doc(docKey(scope.key, provider)).get()).get("mapping") ?? null;
  auditPayroll(req, scope.key, "accounting-mapping", { provider, before: prevMap, after: mapping });
  await mappings.doc(docKey(scope.key, provider)).set(
    { mapping, tenantId: scope.tenantId, franchiseId: scope.franchiseId, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null },
    { mergeFields: ["mapping", "tenantId", "franchiseId", "updatedAt", "updatedBy"] },
  );
  res.json({ ok: true, validated });
});

// ── Journal posting ─────────────────────────────────────────────────────────
type PayLine = { grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number };

// POST /api/accounting/post/:runId?provider=xero - reads the payrollRuns doc
// (read-only; the same doc payroll.ts writes and reads, never modified by
// that file), posts the wages journal, and records the result back onto it.
//
// Double-post protection, in layers: (1) a Firestore-transaction CLAIM
// (accounting.status "posting" + claimToken) so two concurrent requests cannot
// both call the provider; the loser waits for the winner's result. A claim
// older than CLAIM_TTL_MS is treated as a crashed request and may be retaken.
// (2) the provider-side idempotency key (Xero/Sage header, QBO requestid).
// (3) a run already "posted" to this provider returns the stored journal id.
// A run posted to a DIFFERENT provider is refused (409): overwriting
// `accounting` would lose the id of a live journal in the other system.
const CLAIM_TTL_MS = 3 * 60_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
type Acct = { provider?: string; status?: string; journalId?: string; claimToken?: string; claimedAt?: string };

// ── GBP guard ───────────────────────────────────────────────────────────────
// Payroll figures are pounds and the journal body carries no currency, so a provider company whose HOME currency is not GBP would book them as
// that currency (the QuickBooks sandbox company is USD). Before posting we read the provider's base currency and refuse with 409 unless it is GBP.
//   · ACCOUNTING_ALLOW_NON_GBP=1 turns the guard off (deliberate override).
//   · QuickBooks SANDBOX realm 9341458202792641 is allowed without the env var, but ONLY while QBO_ENV is not "production" (qboConfig().environment
//     === "sandbox"), so the e2e specs keep running against the USD sandbox company.
//   · FAIL OPEN: if the currency can't be read (network, 4xx/5xx, unexpected shape, not connected) we log and carry on - the guard must never
//     stop a real GBP customer's post because a read-only lookup hiccuped. Only a currency we positively READ and that is not GBP blocks.
const QBO_SANDBOX_REALM = "9341458202792641";
type CurrencyRead = { currency: string | null; source: string; allowedByOverride?: boolean };
async function providerBaseCurrency(provider: Provider, key: string): Promise<CurrencyRead> {
  if (provider === "quickbooks") {
    const cfg = qboConfig(); if (!cfg) return { currency: null, source: "quickbooks:not-configured" };
    const r = await withTokens((o) => freshQbo(key, o), async (t: QboTokens): Promise<CurrencyRead> => {
      if (cfg.environment === "sandbox" && t.realmId === QBO_SANDBOX_REALM) return { currency: null, source: "quickbooks:sandbox-realm", allowedByOverride: true };
      const res = await pfetch(`${cfg.apiBase}/v3/company/${t.realmId}/preferences?minorversion=75`, { headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" } }, "idempotent", "QuickBooks");
      if (!res.ok) return { currency: null, source: `quickbooks:http-${res.status}` };
      const j = JSON.parse(await res.text()) as { Preferences?: { CurrencyPrefs?: { HomeCurrency?: { value?: string } } } };
      return { currency: j.Preferences?.CurrencyPrefs?.HomeCurrency?.value ?? null, source: "quickbooks:preferences" };
    });
    return r ?? { currency: null, source: "quickbooks:not-connected" };
  }
  if (provider === "xero") {
    const r = await withTokens((o) => freshXero(key, o), async (t: XeroTokens): Promise<CurrencyRead> => {
      const res = await pfetch("https://api.xero.com/api.xro/2.0/Organisation", { headers: { Authorization: `Bearer ${t.accessToken}`, "xero-tenant-id": t.xeroTenantId, Accept: "application/json" } }, "idempotent", "Xero");
      if (!res.ok) return { currency: null, source: `xero:http-${res.status}` };
      const j = JSON.parse(await res.text()) as { Organisations?: Array<{ BaseCurrency?: string }> };
      return { currency: j.Organisations?.[0]?.BaseCurrency ?? null, source: "xero:organisation" };
    });
    return r ?? { currency: null, source: "xero:not-connected" };
  }
  const r = await withTokens((o) => freshSage(key, o), async (t: SageTokens): Promise<CurrencyRead> => {
    const res = await pfetch("https://api.accounting.sage.com/v3.1/business", { headers: { Authorization: `Bearer ${t.accessToken}`, "X-Business": t.businessId, Accept: "application/json" } }, "idempotent", "Sage");
    if (!res.ok) return { currency: null, source: `sage:http-${res.status}` };
    const j = JSON.parse(await res.text()) as { base_currency?: { id?: string } | string; currency?: { id?: string } | string };
    const c = j.base_currency ?? j.currency;
    return { currency: typeof c === "string" ? c : c?.id ?? null, source: "sage:business" };
  });
  return r ?? { currency: null, source: "sage:not-connected" };
}
/** The guard's decision, separated from the fetch so it reads plainly: block only on a positively-read non-GBP currency with no override. */
function gbpGuardBlocks(read: CurrencyRead, allowEnv: string | undefined): boolean {
  if (allowEnv === "1") return false;
  if (read.allowedByOverride) return false;
  return !!read.currency && read.currency.trim().toUpperCase() !== "GBP";
}

accounting.post("/post/:runId", async (req, res) => {
  const scope = await manager(req, res); if (!scope) return;
  const runId = String(req.params.runId);
  const provider = String(req.query.provider ?? "");
  if (!isProvider(provider)) { res.status(400).json({ error: "?provider=quickbooks|xero|sage is required" }); return; }

  const runRef = runsCol.doc(`${scope.key}_${runId}`.replace(/\//g, "_"));
  const runSnap = await runRef.get();
  if (!runSnap.exists || runSnap.get("payKey") !== scope.key) { res.status(404).json({ error: "Pay run not found" }); return; }
  const run = runSnap.data()!;
  // Segregation of duties (routes/payroll.ts, item #39): a run starts as
  // "draft" and only becomes "approved" once a DIFFERENT person confirms it.
  if (run.status !== "approved") { res.status(409).json({ error: "This pay run hasn't been approved yet - approve it before posting to accounting" }); return; }
  const prior = run.accounting as Acct | undefined;
  if (prior?.status === "posted" && prior.provider === provider && prior.journalId) { res.json({ ok: true, ...prior, alreadyPosted: true }); return; }
  if (prior?.status === "posted" && prior.journalId && prior.provider !== provider) {
    res.status(409).json({ error: `This run is already posted to ${PROVIDER_NAME[prior.provider as Provider] ?? prior.provider} (journal ${prior.journalId}). Void/delete that journal there before posting the run somewhere else.` });
    return;
  }
  const lines = (run.lines ?? []) as PayLine[];
  if (!lines.length) { res.status(400).json({ error: "This pay run has no lines to post" }); return; }
  const bad = validatePayLines(lines);
  if (bad) { res.status(400).json({ error: `Can't post this run: ${bad}` }); return; }
  const totals = computeTotals(lines);
  const paidOn = String(run.paidOn ?? "");
  const period = String(run.period ?? "");
  const stableKey = idempotencyKey(runId, scope.tenantId); // per run: stable across retries, used for the human-visible references
  let refs: ReturnType<typeof journalRefs>;
  try { refs = journalRefs(paidOn, stableKey); } catch (e) { res.status(400).json({ error: (e as Error).message }); return; }

  const mapSnap = await mappings.doc(docKey(scope.key, provider)).get();
  const mapping = (mapSnap.get("mapping") as AccountMapping | undefined) ?? {};
  const missing = requiredBuckets(totals).filter((b) => !mapping[b]);
  if (missing.length) { res.status(400).json({ error: `Map all the accounts before posting (missing: ${missing.map((b) => BUCKET_LABEL[b]).join(", ")})` }); return; }

  // The exact request body, built once: its fingerprint is part of the provider idempotency key (see bodyFingerprint).
  const narration = `${BRAND} payroll \u2014 ${period}`.slice(0, 250);
  const body = provider === "quickbooks" ? qboJournalBody(mapping, totals, { paidOn, docNumber: refs.qboDocNumber })
    : provider === "xero" ? xeroJournalBody(mapping, totals, { paidOn, narration })
    : sageJournalBody(mapping, totals, { paidOn, reference: refs.sageReference, details: narration });
  const idemKey = idempotencyKey(runId, scope.tenantId, bodyFingerprint(body));

  // ── GBP guard (before the claim, so a refusal leaves the run untouched and retryable) ──
  if (process.env.ACCOUNTING_ALLOW_NON_GBP !== "1") {
    let read: CurrencyRead = { currency: null, source: "unread" };
    try { read = await providerBaseCurrency(provider, scope.key); }
    catch (e) { console.warn(`[accounting] ${provider} base-currency lookup failed, posting anyway (fail open): ${(e as Error).message}`); }
    if (gbpGuardBlocks(read, process.env.ACCOUNTING_ALLOW_NON_GBP)) {
      console.warn(`[accounting] refused post of run ${runId} to ${provider}: base currency ${read.currency} is not GBP`);
      res.status(409).json({ error: `${PROVIDER_NAME[provider]} is set up in ${read.currency}, not GBP. Payroll figures are in pounds, so posting them would book the wrong amounts. Connect a company whose home currency is GBP, then retry.`, code: "non_gbp_provider", currency: read.currency });
      return;
    }
  }

  // ── claim the run ──
  const claimToken = newState();
  const claim = await db.runTransaction(async (tx) => {
    const cur = ((await tx.get(runRef)).get("accounting") ?? undefined) as Acct | undefined;
    if (cur?.status === "posted" && cur.journalId) return { kind: cur.provider === provider ? "done" : "other", cur } as const;
    if (cur?.status === "posting" && cur.claimedAt && Date.now() - Date.parse(cur.claimedAt) < CLAIM_TTL_MS) return { kind: "busy", cur } as const;
    tx.set(runRef, { accounting: { provider, status: "posting", claimToken, claimedAt: new Date().toISOString(), claimedBy: req.user?.email ?? null, error: null, errorKind: null, idempotencyKey: idemKey } }, { merge: true });
    return { kind: "won", cur } as const;
  });
  if (claim.kind === "other") { res.status(409).json({ error: "This run has just been posted to another accounting system" }); return; }
  if (claim.kind === "done") { res.json({ ok: true, ...claim.cur, alreadyPosted: true }); return; }
  if (claim.kind === "busy") {
    // Another request is posting this exact run right now: wait for its outcome instead of racing it.
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const a = (await runRef.get()).get("accounting") as Acct | undefined;
      if (a?.status === "posted" && a.journalId && a.provider === provider) { res.json({ ok: true, ...a, alreadyPosted: true }); return; }
      if (a?.status !== "posting") break;
    }
    res.status(409).json({ error: "This run is already being posted - check its accounting status in a moment before retrying" });
    return;
  }

  try {
    let posted: { id: string } | null;
    if (provider === "quickbooks") {
      const cfg = qboConfig();
      posted = cfg ? await withTokens((o) => freshQbo(scope.key, o), (t: QboTokens) => qboPostJournal(cfg, t, idemKey, body)) : null;
    } else if (provider === "xero") {
      posted = await withTokens((o) => freshXero(scope.key, o), (t: XeroTokens) => xeroPostJournal(t, idemKey, body));
    } else {
      posted = await withTokens((o) => freshSage(scope.key, o), (t: SageTokens) => sagePostJournal(t, idemKey, body));
    }
    if (!posted) {
      await releaseClaim(runRef, claimToken, { provider, status: "failed", error: `${PROVIDER_NAME[provider]} isn't connected`, errorKind: "not-connected", attemptedAt: new Date().toISOString(), attemptedBy: req.user?.email ?? null, idempotencyKey: idemKey });
      res.status(409).json({ error: `${PROVIDER_NAME[provider]} isn't connected` });
      return;
    }
    // The journal EXISTS at the provider now; never leave the run looking unposted even if the response carried no id.
    const accountingResult = { provider, journalId: posted.id || "unknown-see-provider", status: "posted", postedAt: new Date().toISOString(), postedBy: req.user?.email ?? null, idempotencyKey: idemKey, docRef: provider === "quickbooks" ? refs.qboDocNumber : provider === "sage" ? refs.sageReference : null, totals, error: null, errorKind: null, claimToken: null };
    await runRef.set({ accounting: accountingResult }, { merge: true });
    auditPayroll(req, scope.key, "accounting-post", { runId, provider, journalId: accountingResult.journalId, totals });
    const { claimToken: _c, ...pub } = accountingResult;
    res.json({ ok: true, ...pub });
  } catch (e) {
    const f = providerFailure(provider, e);
    console.error(`[accounting] ${provider} journal post failed for run ${runId} (${f.kind}):`, (e as Error).message);
    await releaseClaim(runRef, claimToken, { provider, status: "failed", error: f.message.slice(0, 600), errorKind: f.kind, attemptedAt: new Date().toISOString(), attemptedBy: req.user?.email ?? null, idempotencyKey: idemKey }).catch(() => {});
    if (f.retryAfterSec) res.setHeader("Retry-After", String(f.retryAfterSec));
    res.status(f.status).json({ error: f.message, kind: f.kind });
  }
});

/** Record a failed attempt, but ONLY while we still hold the claim and the run hasn't been posted meanwhile - a slow loser must never overwrite a winner's "posted". */
async function releaseClaim(runRef: FirebaseFirestore.DocumentReference, claimToken: string, failed: Record<string, unknown>): Promise<void> {
  await db.runTransaction(async (tx) => {
    const cur = ((await tx.get(runRef)).get("accounting") ?? undefined) as Acct | undefined;
    if (cur?.status === "posted") return;
    if (cur?.claimToken && cur.claimToken !== claimToken) return;
    tx.set(runRef, { accounting: { ...failed, claimToken: null } }, { merge: true });
  });
}

// ── OAuth callback (public — see accountingCallback export) ───────────────
const callbackPage = (title: string, message: string, ok: boolean) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="font-family:system-ui,-apple-system,Arial,sans-serif;background:#f4f7fc;margin:0;padding:44px 16px"><div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;padding:30px;text-align:center;box-shadow:0 16px 44px -22px rgba(20,33,58,.5)"><div style="font-size:42px">${ok ? "✅" : "⚠️"}</div><h1 style="font-size:21px;color:#16306e;margin:10px 0 8px">${esc(title)}</h1><p style="font-size:14px;color:#5b6472;line-height:1.55;margin:0">${esc(message)}</p></div><script>try{window.opener&&window.opener.postMessage({source:"aos-accounting",ok:${ok ? "true" : "false"}},"*");}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},1200);</script></body></html>`;
const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

accountingCallback.get("/:provider", async (req, res) => {
  const html = (title: string, message: string, ok: boolean, status = 200) => res.status(status).set("Content-Type", "text/html").send(callbackPage(title, message, ok));
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { html("Unknown provider", "Close this window and try again.", false, 404); return; }

  const state = String(req.query.state ?? "").trim();
  const code = String(req.query.code ?? "").trim();
  const oauthError = String(req.query.error ?? "").trim();
  const snap = state ? await states.doc(state).get() : null;
  if (!snap?.exists || snap.get("status") !== "pending" || (snap.get("expiresAt") as number) <= Date.now()) {
    html("That link has expired", "Close this window and press Connect again.", false, 400);
    return;
  }
  await snap.ref.set({ status: "used" }, { merge: true }); // single-use, claimed before anything replayable
  const d = snap.data()!;
  const key = String(d.key);

  if (oauthError || !code) { html(`${provider} sign-in didn't complete`, "Close this window and press Connect again.", false); return; }

  try {
    if (provider === "quickbooks") {
      const cfg = qboConfig();
      const realmId = String(req.query.realmId ?? "").trim(); // spec: capture realmId (company id) from the callback query — used in every path
      if (!cfg || !realmId) { html("QuickBooks connection failed", "Close this window and try again.", false, 400); return; }
      const tokens = await qboExchangeCode(cfg, code, realmId);
      await connections.doc(docKey(key, "quickbooks")).set({
        tenantId: d.tenantId, franchiseId: d.franchiseId ?? null, provider: "quickbooks",
        accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, realmId: tokens.realmId,
        connectedAt: new Date().toISOString(), connectedBy: d.createdBy ?? null, label: `Company ${realmId}`,
      });
    } else if (provider === "xero") {
      const cfg = xeroConfig();
      const codeVerifier = String(d.codeVerifier ?? "");
      if (!cfg || !codeVerifier) { html("Xero connection failed", "Close this window and try again.", false, 400); return; }
      const tokens = await xeroExchangeCode(cfg, code, codeVerifier);
      const conns = await xeroConnections(tokens.accessToken);
      const first = conns[0];
      if (!first) { html("Xero connection failed", "No Xero organisation was authorised. Close this window and try again.", false, 400); return; }
      await connections.doc(docKey(key, "xero")).set({
        tenantId: d.tenantId, franchiseId: d.franchiseId ?? null, provider: "xero",
        accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, xeroTenantId: first.tenantId,
        connectedAt: new Date().toISOString(), connectedBy: d.createdBy ?? null, label: first.tenantName ?? null,
      });
    } else {
      const cfg = sageConfig();
      if (!cfg) { html("Sage connection failed", "Close this window and try again.", false, 400); return; }
      const tokens = await sageExchangeCode(cfg, code);
      const bizs = await sageBusinesses(tokens.accessToken);
      const first = bizs[0];
      if (!first) { html("Sage connection failed", "No Sage business was authorised. Close this window and try again.", false, 400); return; }
      await connections.doc(docKey(key, "sage")).set({
        tenantId: d.tenantId, franchiseId: d.franchiseId ?? null, provider: "sage",
        accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, businessId: first.id,
        connectedAt: new Date().toISOString(), connectedBy: d.createdBy ?? null, label: first.name ?? null,
      });
    }
    html("Connected", `${provider[0].toUpperCase()}${provider.slice(1)} is now connected. You can close this window.`, true);
  } catch (e) {
    console.error(`[accounting] ${provider} callback failed:`, (e as Error).message);
    html(`${provider} connection failed`, "Close this window and press Connect again.", false, 502);
  }
});
