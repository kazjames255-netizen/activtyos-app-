// e2e helper: temporarily BREAK a stored accounting connection's tokens (to prove the "expired/revoked" failure path), and restore them exactly.
// Never prints token values. Refuses unless it is the standing test connection (Xero label 'ActivityLane Test' / QBO sandbox realm).
//   npx tsx ../e2e/helpers/connTokens.ts <tenantId> <xero|quickbooks> break|stale|restore|status     (run from server/)
// break   : saves the real tokens under `e2eBackup` on the same doc, then sets an expired access token + a garbage refresh token.
// stale   : like break, but keeps the REAL refresh token and gives a garbage access token that looks unexpired (forces the 401 -> forced-refresh self-heal path).
// restore : copies the backup back verbatim, clears needsReconnect/lastAuthError, nulls the backup. Safe to run repeatedly.
import { db } from "../../server/src/firebase";

const [tenantId, provider, cmd] = process.argv.slice(2);
(async () => {
  if (!tenantId || !["xero", "quickbooks"].includes(provider)) throw new Error("usage: connTokens <tenantId> <xero|quickbooks> break|restore|status");
  const ref = db.collection("accountingConnections").doc(`${tenantId}__${provider}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("no such connection");
  if (provider === "xero" && snap.get("label") !== "ActivityLane Test") throw new Error("refusing: xero org label is not 'ActivityLane Test'");
  if (provider === "quickbooks" && String(snap.get("realmId")) !== "9341458202792641") throw new Error("refusing: not the QBO sandbox realm");
  const out = (o: unknown) => process.stdout.write(`@@JSON@@${JSON.stringify(o)}@@END@@\n`);
  const backup = snap.get("e2eBackup");
  if (cmd === "status") out({ broken: !!backup, needsReconnect: snap.get("needsReconnect") === true });
  else if (cmd === "break" || cmd === "stale") {
    if (backup) throw new Error("already broken (a backup exists) - run restore first");
    await ref.update({ e2eBackup: { accessToken: snap.get("accessToken"), refreshToken: snap.get("refreshToken"), expiresAt: snap.get("expiresAt") }, accessToken: "e2e-expired-access-token", ...(cmd === "break" ? { refreshToken: "e2e-invalid-refresh-token", expiresAt: 1 } : { expiresAt: Date.now() + 3600_000 }) });
    out({ broken: true });
  } else if (cmd === "restore") {
    if (!backup) { out({ restored: false, note: "no backup (not broken)" }); process.exit(0); }
    // Providers that ROTATE refresh tokens (Xero) consume the old one the moment it is used. If a real refresh happened while the connection was
    // "broken" (the stale-access-token self-heal path), the stored refresh token is now a NEW, valid one: overwriting it with the backup would
    // put a used-up token back and kill the standing connection. Only restore the backup when the stored token is still our placeholder/garbage.
    const cur = snap.get("refreshToken");
    const rotated = cur !== "e2e-invalid-refresh-token" && cur !== backup.refreshToken;
    await ref.update({ ...(rotated ? {} : { accessToken: backup.accessToken, refreshToken: backup.refreshToken, expiresAt: backup.expiresAt }), e2eBackup: null, needsReconnect: false, lastAuthError: null, lastAuthErrorAt: null });
    out({ restored: true, keptRotatedTokens: rotated });
  } else throw new Error("cmd break|stale|restore|status");
  process.exit(0);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
