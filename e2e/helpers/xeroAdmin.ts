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
    const t = await r.text(); if (!r.ok) { let msgs = ""; try { msgs = JSON.stringify((JSON.parse(t).Elements ?? []).flatMap((e: any) => (e.ValidationErrors ?? []).map((v: any) => v.Message))); } catch { /* */ } throw new Error(`set ${Status} ${r.status} ${msgs || t.slice(0, 300)}`); }
  };
  if (cmd === "currency") {
    const r = await fetch("https://api.xero.com/api.xro/2.0/Organisation", { headers: h }); const t = await r.text();
    if (!r.ok) throw new Error(`org ${r.status} ${t.slice(0, 200)}`);
    const o = JSON.parse(t).Organisations?.[0] ?? {};
    process.stdout.write(`@@JSON@@${JSON.stringify({ base: o.BaseCurrency ?? null, country: o.CountryCode ?? null })}@@END@@\n`); process.exit(0);
  }
  // DRAFT journals whose lines have no usable account (Xero blanks unknown/system codes) can't be POSTED; those are DELETED instead. Returns the final status.
  const dispose = async (id: string, status: string): Promise<string> => {
    const post = async (Status: string) => { const r = await fetch(base, { method: "POST", headers: h, body: JSON.stringify({ ManualJournals: [{ ManualJournalID: id, Status }] }) }); return r.ok; };
    if (status === "DRAFT") { if (await post("POSTED")) status = "POSTED"; else { return (await post("DELETED")) ? "DELETED" : "DRAFT"; } }
    if (status === "POSTED") return (await post("VOIDED")) ? "VOIDED" : "POSTED";
    return status;
  };
  if (cmd === "sweep") {
    // Lists (arg = "list") or voids (arg = "void") every non-voided manual journal whose narration contains "E2E " (our test runs' periods) in the test org.
    const found: { id: string; status: string; narration: string }[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`https://api.xero.com/api.xro/2.0/ManualJournals?page=${page}`, { headers: h }); const t = await r.text();
      if (!r.ok) throw new Error(`list ${r.status} ${t.slice(0, 200)}`);
      const list = JSON.parse(t).ManualJournals ?? [];
      for (const j of list) if (/E2E /.test(j.Narration ?? "") && !["VOIDED", "DELETED"].includes(j.Status)) found.push({ id: j.ManualJournalID, status: j.Status, narration: j.Narration });
      if (list.length < 100) break;
    }
    const results: string[] = [];
    if (jid === "void") for (const f of found) results.push(`${f.id.slice(0, 8)}:${await dispose(f.id, f.status)}`);
    process.stdout.write(`@@JSON@@${JSON.stringify({ found: found.length, voided: jid === "void", results, items: found })}@@END@@\n`); process.exit(0);
  }
  if (cmd === "get") { process.stdout.write(`@@JSON@@${JSON.stringify(await getJ())}@@END@@\n`); }
  else if (cmd === "void") {
    let j = await getJ();
    await dispose(jid, j.Status); j = await getJ();
    process.stdout.write(`@@JSON@@${JSON.stringify({ Status: j.Status })}@@END@@\n`);
  } else throw new Error("cmd get|void|currency|sweep");
  process.exit(0);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
