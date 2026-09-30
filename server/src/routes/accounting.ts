import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import {
  PROVIDERS, MAPPING_BUCKETS, BUCKET_LABEL, type Provider, type AccountMapping,
  computeTotals, idempotencyKey, newState, newCodeVerifier, codeChallengeS256,
  qboConfig, qboConfigured, qboAuthorizeUrl, qboExchangeCode, qboRefresh, qboRevoke, qboJournalBody, qboPostJournal, qboAccounts, type QboTokens,
  xeroConfig, xeroConfigured, xeroAuthorizeUrl, xeroExchangeCode, xeroRefresh, xeroConnections, xeroRevoke, xeroJournalBody, xeroPostJournal, xeroAccounts, type XeroTokens,
  sageConfig, sageConfigured, sageAuthorizeUrl, sageExchangeCode, sageRefresh, sageBusinesses, sageJournalBody, sagePostJournal, sageAccounts, type SageTokens,
} from "../lib/accounting";

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

function manager(req: Request, res: Response): { key: string; tenantId: string; franchiseId: string | null } | null {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager or owner can manage accounting integrations" }); return null; }
  return { key: keyOf(auth.tenantId, auth.franchiseId), tenantId: auth.tenantId, franchiseId: auth.franchiseId };
}

// ── Connection status (no secrets) ─────────────────────────────────────────
// GET /api/accounting/connections — { quickbooks: {configured, connected, connectedAt, companyName?}, xero: {...}, sage: {...} }
accounting.get("/connections", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const configured: Record<Provider, boolean> = { quickbooks: qboConfigured(), xero: xeroConfigured(), sage: sageConfigured() };
  const out: Record<string, unknown> = {};
  await Promise.all(PROVIDERS.map(async (p) => {
    const snap = await connections.doc(docKey(scope.key, p)).get();
    out[p] = snap.exists
      ? { configured: configured[p], connected: true, connectedAt: snap.get("connectedAt") ?? null, connectedBy: snap.get("connectedBy") ?? null, label: snap.get("label") ?? null }
      : { configured: configured[p], connected: false };
  }));
  res.json(out);
});

// ── Connect: build the provider's authorize URL ─────────────────────────────
// GET /api/accounting/:provider/connect
accounting.get("/:provider/connect", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }

  const state = newState();
  const base = { tenantId: scope.tenantId, franchiseId: scope.franchiseId, key: scope.key, provider, createdBy: req.user?.email ?? null, createdAt: new Date().toISOString(), expiresAt: Date.now() + STATE_TTL_MS, status: "pending" as const };

  if (provider === "quickbooks") {
    const cfg = qboConfig();
    if (!cfg) { res.status(503).json({ error: "QuickBooks isn't configured on this server (QBO_CLIENT_ID/QBO_CLIENT_SECRET)" }); return; }
    await states.doc(state).set(base);
    res.json({ url: qboAuthorizeUrl(cfg, state) });
    return;
  }
  if (provider === "xero") {
    const cfg = xeroConfig();
    if (!cfg) { res.status(503).json({ error: "Xero isn't configured on this server (XERO_CLIENT_ID/XERO_CLIENT_SECRET)" }); return; }
    const codeVerifier = newCodeVerifier();
    await states.doc(state).set({ ...base, codeVerifier });
    res.json({ url: xeroAuthorizeUrl(cfg, state, codeChallengeS256(codeVerifier)) });
    return;
  }
  const cfg = sageConfig();
  if (!cfg) { res.status(503).json({ error: "Sage isn't configured on this server (SAGE_CLIENT_ID/SAGE_CLIENT_SECRET)" }); return; }
  await states.doc(state).set(base);
  res.json({ url: sageAuthorizeUrl(cfg, state) });
});

// ── Disconnect ───────────────────────────────────────────────────────────
// POST /api/accounting/:provider/disconnect
accounting.post("/:provider/disconnect", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
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
  }
  res.json({ ok: true });
});

// ── Fresh tokens: read the stored connection, refresh if needed, and — the
// non-negotiable part — PERSIST the (possibly rotated) tokens BEFORE doing
// anything else with them. Xero and Sage rotate the refresh token on every
// single use; missing that persist once means the tenant is locked out of
// the connection for good. ──────────────────────────────────────────────
async function freshQbo(key: string): Promise<QboTokens | null> {
  const cfg = qboConfig(); if (!cfg) return null;
  const ref = connections.doc(docKey(key, "quickbooks"));
  const snap = await ref.get(); if (!snap.exists) return null;
  const d = snap.data()!;
  let tokens: QboTokens = { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresAt: d.expiresAt, realmId: d.realmId };
  if (Date.now() > tokens.expiresAt - 60_000) {
    tokens = await qboRefresh(cfg, tokens.refreshToken, tokens.realmId);
    await ref.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return tokens;
}
async function freshXero(key: string): Promise<XeroTokens | null> {
  const cfg = xeroConfig(); if (!cfg) return null;
  const ref = connections.doc(docKey(key, "xero"));
  const snap = await ref.get(); if (!snap.exists) return null;
  const d = snap.data()!;
  let t = { accessToken: d.accessToken as string, refreshToken: d.refreshToken as string, expiresAt: d.expiresAt as number };
  if (Date.now() > t.expiresAt - 60_000) {
    t = await xeroRefresh(cfg, t.refreshToken);
    // Persist the rotated refresh token immediately — this is the exact
    // failure mode the spec calls out: skip this and the NEXT refresh 400s
    // forever because the old refresh token was already burned by Xero.
    await ref.set({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, xeroTenantId: d.xeroTenantId };
}
async function freshSage(key: string): Promise<SageTokens | null> {
  const cfg = sageConfig(); if (!cfg) return null;
  const ref = connections.doc(docKey(key, "sage"));
  const snap = await ref.get(); if (!snap.exists) return null;
  const d = snap.data()!;
  let t = { accessToken: d.accessToken as string, refreshToken: d.refreshToken as string, expiresAt: d.expiresAt as number };
  if (Date.now() > t.expiresAt - 30_000) {
    t = await sageRefresh(cfg, t.refreshToken);
    await ref.set({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, businessId: d.businessId };
}

// ── Chart-of-accounts list, for the mapping dropdowns ───────────────────────
// GET /api/accounting/:provider/accounts
accounting.get("/:provider/accounts", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const provider = String(req.params.provider);
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }
  try {
    if (provider === "quickbooks") {
      const cfg = qboConfig(); const tokens = await freshQbo(scope.key);
      if (!cfg || !tokens) { res.status(409).json({ error: "QuickBooks isn't connected" }); return; }
      res.json((await qboAccounts(cfg, tokens)).map((a) => ({ id: a.id, name: `${a.name} (${a.type})` })));
      return;
    }
    if (provider === "xero") {
      const tokens = await freshXero(scope.key);
      if (!tokens) { res.status(409).json({ error: "Xero isn't connected" }); return; }
      const [expense, liability] = await Promise.all([xeroAccounts(tokens, "EXPENSE"), xeroAccounts(tokens, "LIABILITY")]);
      res.json([...expense, ...liability].map((a) => ({ id: a.code, name: `${a.name} (${a.class})` })));
      return;
    }
    const tokens = await freshSage(scope.key);
    if (!tokens) { res.status(409).json({ error: "Sage isn't connected" }); return; }
    res.json((await sageAccounts(tokens)).map((a) => ({ id: a.id, name: a.name })));
  } catch (e) {
    console.error(`[accounting] ${provider} accounts fetch failed:`, (e as Error).message);
    res.status(502).json({ error: `Couldn't fetch the chart of accounts from ${provider}. Try reconnecting.` });
  }
});

// ── Account mapping (the 6 buckets) ─────────────────────────────────────────
const mappingSchema = z.object({
  provider: z.enum(["quickbooks", "xero", "sage"]),
  mapping: z.object({
    grossWages: z.string().max(120).optional(),
    employerNi: z.string().max(120).optional(),
    employerPension: z.string().max(120).optional(),
    payeNicLiability: z.string().max(120).optional(),
    pensionPayable: z.string().max(120).optional(),
    netWagesBank: z.string().max(120).optional(),
  }),
});

// GET /api/accounting/mapping?provider=xero
accounting.get("/mapping", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const provider = String(req.query.provider ?? "");
  if (!isProvider(provider)) { res.status(400).json({ error: "provider is required" }); return; }
  const snap = await mappings.doc(docKey(scope.key, provider)).get();
  res.json({ buckets: MAPPING_BUCKETS.map((b) => ({ key: b, label: BUCKET_LABEL[b] })), mapping: (snap.get("mapping") as AccountMapping | undefined) ?? {} });
});

// PUT /api/accounting/mapping {provider, mapping}
accounting.put("/mapping", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await mappings.doc(docKey(scope.key, parsed.data.provider)).set(
    { mapping: parsed.data.mapping, tenantId: scope.tenantId, franchiseId: scope.franchiseId, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null },
    { merge: true },
  );
  res.json({ ok: true });
});

// ── Journal posting ─────────────────────────────────────────────────────────
type PayLine = { grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number };

// POST /api/accounting/post/:runId?provider=xero — reads the payrollRuns doc
// (read-only; the same doc payroll.ts writes and reads, never modified by
// that file), posts the wages journal, and records the result back onto it.
accounting.post("/post/:runId", async (req, res) => {
  const scope = manager(req, res); if (!scope) return;
  const runId = String(req.params.runId);
  const provider = String(req.query.provider ?? "");
  if (!isProvider(provider)) { res.status(400).json({ error: "?provider=quickbooks|xero|sage is required" }); return; }

  const runRef = runsCol.doc(`${scope.key}_${runId}`.replace(/\//g, "_"));
  const runSnap = await runRef.get();
  if (!runSnap.exists || runSnap.get("payKey") !== scope.key) { res.status(404).json({ error: "Pay run not found" }); return; }
  const run = runSnap.data()!;
  // Segregation of duties (routes/payroll.ts, item #39): a run starts as
  // "draft" and only becomes "approved" once a DIFFERENT person confirms it.
  // Posting a draft's figures as a real wages journal in QuickBooks/Xero/Sage
  // would defeat that entirely — found in review while integrating this
  // route with the approval work landing the same night.
  if (run.status !== "approved") { res.status(409).json({ error: "This pay run hasn't been approved yet — approve it before posting to accounting" }); return; }
  // Idempotent re-post: a run already posted to THIS provider returns its stored result rather than creating a second journal
  // (Xero's Idempotency-Key only replays for a limited window, and QBO/Sage differ — the run doc is the durable record).
  const prior = run.accounting as { provider?: string; status?: string; journalId?: string } | undefined;
  if (prior?.status === "posted" && prior.provider === provider && prior.journalId) { res.json({ ok: true, ...prior, alreadyPosted: true }); return; }
  const lines = (run.lines ?? []) as PayLine[];
  if (!lines.length) { res.status(400).json({ error: "This pay run has no lines to post" }); return; }
  const totals = computeTotals(lines);
  const paidOn = String(run.paidOn ?? "");
  const period = String(run.period ?? "");
  const idemKey = idempotencyKey(runId, scope.tenantId);
  const [yyyy, mm] = paidOn.split("-");
  const docNumber = `AOS-PAYROLL-${yyyy ?? "0000"}-${mm ?? "00"}`;

  const mapSnap = await mappings.doc(docKey(scope.key, provider)).get();
  const mapping = (mapSnap.get("mapping") as AccountMapping | undefined) ?? {};
  const missing = MAPPING_BUCKETS.filter((b) => !mapping[b]);
  if (missing.length) { res.status(400).json({ error: `Map all 6 accounts before posting (missing: ${missing.map((b) => BUCKET_LABEL[b]).join(", ")})` }); return; }

  try {
    let posted: { id: string };
    if (provider === "quickbooks") {
      const cfg = qboConfig(); const tokens = await freshQbo(scope.key);
      if (!cfg || !tokens) { res.status(409).json({ error: "QuickBooks isn't connected" }); return; }
      const body = qboJournalBody(mapping, totals, { paidOn, docNumber });
      posted = await qboPostJournal(cfg, tokens, idemKey, body);
    } else if (provider === "xero") {
      const tokens = await freshXero(scope.key);
      if (!tokens) { res.status(409).json({ error: "Xero isn't connected" }); return; }
      const body = xeroJournalBody(mapping, totals, { paidOn, narration: `ActivityOS payroll — ${period}` });
      posted = await xeroPostJournal(tokens, idemKey, body);
    } else {
      const tokens = await freshSage(scope.key);
      if (!tokens) { res.status(409).json({ error: "Sage isn't connected" }); return; }
      const body = sageJournalBody(mapping, totals, { paidOn, reference: `PAYROLL-${yyyy ?? "0000"}-${mm ?? "00"}`, details: `ActivityOS payroll — ${period}` });
      posted = await sagePostJournal(tokens, idemKey, body);
    }
    const accountingResult = { provider, journalId: posted.id, status: "posted", postedAt: new Date().toISOString(), postedBy: req.user?.email ?? null, idempotencyKey: idemKey, totals };
    // Additive merge write onto the SAME payrollRuns doc other code already
    // reads — not a call into routes/payroll.ts, just a direct Firestore
    // write of a new field, per the spec's "store the returned journal id +
    // status on each PayRun".
    await runRef.set({ accounting: accountingResult }, { merge: true });
    res.json({ ok: true, ...accountingResult });
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[accounting] ${provider} journal post failed for run ${runId}:`, message);
    await runRef.set({ accounting: { provider, status: "failed", error: message, attemptedAt: new Date().toISOString(), attemptedBy: req.user?.email ?? null, idempotencyKey: idemKey } }, { merge: true }).catch(() => {});
    res.status(502).json({ error: `Couldn't post to ${provider}: ${message}` });
  }
});

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
