// Server-side Xero helper for e2e (Admin SDK; never prints tokens). Run from server/:
//   npx tsx ../e2e/helpers/xeroAdmin.ts <tenantId> get <journalId>      → prints @@JSON@@{...}@@END@@
//   npx tsx ../e2e/helpers/xeroAdmin.ts <tenantId> void <journalId>     → DRAFT->POSTED->VOIDED (or leaves as VOIDED)
// Uses the stored (already refreshed by the API) access token; refuses unless the connection label is 'ActivityOS Test'.
import { db } from "../../server/src/firebase";

const [tenantId, cmd, jid] = process.argv.slice(2);
(async () => {
  const snap = await db.collection("accountingConnections").doc(`${tenantId}__xero`).get();
  if (!snap.exists) throw new Error("no xero connection");
  if (snap.get("label") !== "ActivityOS Test") throw new Error(`refusing: xero org label is not 'ActivityOS Test'`);
  const h = { Authorization: `Bearer ${snap.get("accessToken")}`, "xero-tenant-id": snap.get("xeroTenantId"), Accept: "application/json", "Content-Type": "application/json" };
  const base = "https://api.xero.com/api.xro/2.0/ManualJournals";
  const getJ = async () => { const r = await fetch(`${base}/${jid}`, { headers: h }); const t = await r.text(); if (!r.ok) throw new Error(`GET ${r.status} ${t.slice(0, 200)}`); return JSON.parse(t).ManualJournals[0]; };
  const setStatus = async (Status: string) => {
    const r = await fetch(base, { method: "POST", headers: h, body: JSON.stringify({ ManualJournals: [{ ManualJournalID: jid, Status }] }) });
    const t = await r.text(); if (!r.ok) throw new Error(`set ${Status} ${r.status} ${t.slice(0, 300)}`);
  };
  if (cmd === "get") { process.stdout.write(`@@JSON@@${JSON.stringify(await getJ())}@@END@@\n`); }
  else if (cmd === "void") {
    let j = await getJ();
    if (j.Status === "DRAFT") { await setStatus("POSTED"); j = await getJ(); }
    if (j.Status === "POSTED") { await setStatus("VOIDED"); j = await getJ(); }
    process.stdout.write(`@@JSON@@${JSON.stringify({ Status: j.Status })}@@END@@\n`);
  } else throw new Error("cmd get|void");
  process.exit(0);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
