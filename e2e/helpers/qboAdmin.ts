// Server-side QuickBooks (SANDBOX) helper for e2e (Admin SDK; never prints tokens). Run from server/:
//   npx tsx ../e2e/helpers/qboAdmin.ts <tenantId> get <journalId>      → prints @@JSON@@{JournalEntry}@@END@@
//   npx tsx ../e2e/helpers/qboAdmin.ts <tenantId> delete <journalId>   → deletes (Id+SyncToken, operation=delete); prints {deleted}
//   npx tsx ../e2e/helpers/qboAdmin.ts <tenantId> exists <journalId>   → prints {exists:boolean}
//   npx tsx ../e2e/helpers/qboAdmin.ts <tenantId> find <docNumber>     → prints {ids:[...]} of journal entries with that DocNumber
//   npx tsx ../e2e/helpers/qboAdmin.ts <tenantId> currency             → prints {home, multi} from Preferences
// Refuses unless QBO_ENV=sandbox AND the connection's realm is the Intuit sandbox company 9341458202792641.
import "../../server/node_modules/dotenv/config";
import { db } from "../../server/src/firebase";
import { qboConfig, qboRefresh } from "../../server/src/lib/accounting";

const SANDBOX_REALM = "9341458202792641";
const [tenantId, cmd, jid] = process.argv.slice(2);
(async () => {
  const cfg = qboConfig();
  if (!cfg || cfg.environment !== "sandbox") throw new Error("refusing: QBO_ENV is not sandbox");
  const ref = db.collection("accountingConnections").doc(`${tenantId}__quickbooks`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("no quickbooks connection");
  const realm = String(snap.get("realmId"));
  if (realm !== SANDBOX_REALM) throw new Error(`refusing: realm is not the sandbox company ${SANDBOX_REALM}`);
  let accessToken = snap.get("accessToken") as string;
  if (Date.now() > (snap.get("expiresAt") as number) - 60_000) {
    const t = await qboRefresh(cfg, snap.get("refreshToken"), realm);
    await ref.set({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
    accessToken = t.accessToken;
  }
  const h = { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" };
  const base = `${cfg.apiBase}/v3/company/${realm}`;
  const getJ = async () => {
    const r = await fetch(`${base}/journalentry/${encodeURIComponent(jid)}?minorversion=75`, { headers: h });
    const t = await r.text();
    if (r.status === 404 || (r.status === 400 && /object not found|not found/i.test(t))) return null;
    if (!r.ok) throw new Error(`GET ${r.status} ${t.slice(0, 300)}`);
    return JSON.parse(t).JournalEntry;
  };
  const out = (o: unknown) => process.stdout.write(`@@JSON@@${JSON.stringify(o)}@@END@@\n`);
  if (cmd === "find") {
    const q = encodeURIComponent(`select Id from JournalEntry where DocNumber = '${jid.replace(/'/g, "")}'`);
    const r = await fetch(`${base}/query?query=${q}&minorversion=75`, { headers: h }); const t = await r.text();
    if (!r.ok) throw new Error(`find ${r.status} ${t.slice(0, 200)}`);
    out({ ids: (JSON.parse(t).QueryResponse?.JournalEntry ?? []).map((j: { Id: string }) => j.Id) });
  } else if (cmd === "currency") {
    const r = await fetch(`${base}/preferences?minorversion=75`, { headers: h }); const t = await r.text();
    if (!r.ok) throw new Error(`prefs ${r.status} ${t.slice(0, 200)}`);
    const c = JSON.parse(t).Preferences?.CurrencyPrefs ?? {};
    out({ home: c.HomeCurrency?.value ?? null, multi: !!c.MultiCurrencyEnabled });
  } else if (cmd === "get") { const j = await getJ(); if (!j) throw new Error("not found"); out(j); }
  else if (cmd === "exists") out({ exists: !!(await getJ()) });
  else if (cmd === "delete") {
    const j = await getJ();
    if (!j) { out({ deleted: true, note: "already absent" }); }
    else {
      const r = await fetch(`${base}/journalentry?operation=delete&minorversion=75`, { method: "POST", headers: h, body: JSON.stringify({ Id: j.Id, SyncToken: j.SyncToken }) });
      const t = await r.text(); if (!r.ok) throw new Error(`delete ${r.status} ${t.slice(0, 300)}`);
      out({ deleted: JSON.parse(t).JournalEntry?.status === "Deleted", status: JSON.parse(t).JournalEntry?.status, exists: !!(await getJ()) });
    }
  } else throw new Error("cmd get|exists|delete");
  process.exit(0);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
