// Purge of the publisher's brand from STORED hubNotes bodies (all tenants). DRY-RUN BY DEFAULT and READ-ONLY.
//
//   cd server
//   npx tsx src/oak/purgeOakNoteBodies.ts                         # dry run: lists tenant / note id / field / exact removed text
//   npx tsx src/oak/purgeOakNoteBodies.ts --report ../docs/oak-purge-dry-run.md
//   npx tsx src/oak/purgeOakNoteBodies.ts --tenants a,b           # restrict
//   --fields body,title   which top-level fields to look at (default: body = the note text; the 68-note finding in critic-product.md).
//   --all-fields          also every other user-visible field, incl. lesson.* slide text (a far larger set: thousands of slides)
//   npx tsx src/oak/purgeOakNoteBodies.ts --apply --approved-by-kaz   # REAL WRITE: only after Kaz approves the dry-run report
//
// Uses noOak.scrubDeep, the same rules the read-time filter (noOakResponse.ts) applies, so what is listed as "removed" is exactly what
// users are already NOT seeing today. Writes only the changed top-level / lesson.<k> fields; ids and provenance are never touched.
// Without BOTH --apply and --approved-by-kaz this file contains no code path that writes.
import "dotenv/config";
import fs from "node:fs";
import { db } from "../firebase";
import { shardedTenantRead } from "../lib/hubIndex";
import { scrubDeep, scrubText, findOakDeep, mentionsOak, isInternalString } from "./noOak";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(`--${n}`);
const APPLY = has("apply");
if (APPLY && !has("approved-by-kaz")) { console.error("refusing to write: --apply also needs --approved-by-kaz (Kaz must approve docs/oak-purge-dry-run.md first)"); process.exit(1); }
const FIELDS = new Set((arg("fields") ?? "body").split(",").filter(Boolean));
const ALL = has("all-fields");
const ONLY = new Set((arg("tenants") ?? "").split(",").filter(Boolean));
const SENT = /(?<=[.!?…])(\s+)|(\n+)/;

/** The exact spans scrubText would remove from one string: sentences (or link markup) present before and absent after. */
function removedSpans(before: string): string[] {
  const after = scrubText(before);
  if (after === before) return [];
  if (after === "") return [before];
  const spans: string[] = [];
  for (const p of before.split(SENT)) { if (p && !/^\s+$/.test(p) && !after.includes(p.trim()) && (mentionsOak(p) || /thenational\.academy|oaknational/i.test(p))) spans.push(p); }
  if (!spans.length) spans.push(`(link/markup rewrite) ${before.slice(0, 200)}`);
  return spans;
}
interface Change { path: string; spans: string[] }
function diffStrings(a: unknown, b: unknown, p: string, out: Change[]) {
  if (typeof a === "string") { if (typeof b === "string" && a !== b && !isInternalString(a)) out.push({ path: p, spans: removedSpans(a) }); else if (typeof b !== "string" && !isInternalString(a)) out.push({ path: p, spans: [a] }); return; }
  if (Array.isArray(a)) { // slides / list entries may have been dropped whole, so compare by index when lengths match, else report the dropped ones
    const bb = Array.isArray(b) ? b : [];
    if (bb.length === a.length) a.forEach((x, i) => diffStrings(x, bb[i], `${p}[${i}]`, out));
    else { const rest = [...bb]; a.forEach((x, i) => { const j = rest.findIndex((y) => JSON.stringify(y) === JSON.stringify(x)); if (j >= 0) { rest.splice(j, 1); return; } const hits = findOakDeep(x, 3); out.push({ path: `${p}[${i}] (dropped or rewritten entry)`, spans: hits.length ? hits.map((h) => h.sample) : [JSON.stringify(x).slice(0, 160)] }); }); }
    return;
  }
  if (a && typeof a === "object" && b && typeof b === "object") for (const [k, v] of Object.entries(a)) diffStrings(v, (b as Record<string, unknown>)[k], p ? `${p}.${k}` : k, out);
}

async function main() {
  const rows: { tenant: string; id: string; title: string; changes: Change[]; upd: Record<string, unknown>; hits: string[] }[] = [];
  let scanned = 0;
  // A whole-collection stream times out at this size, so read the way purgeOakText.ts does: per tenant, ids via the sharded reader, then
  // documents by id in chunks (getAll). Read-only calls only.
  const tenants = ONLY.size ? [...ONLY] : [...new Set([...(await db.collection("tenants").select().get()).docs.map((d) => d.id), "shared-library"])];
  const retry = async <T,>(f: () => Promise<T>): Promise<T> => { for (let a = 1; ; a++) { try { return await f(); } catch (e) { if (a >= 6) throw e; await new Promise((r) => setTimeout(r, 1500 * a)); } } };
  const unreadable: string[] = [];
  for (const tenant of tenants) {
    const ids = (await retry(() => shardedTenantRead(db.collection("hubNotes"), tenant, []))).map((d) => d.id).sort();
    if (!ids.length) continue;
    for (let i = 0; i < ids.length; i += 25) {
      const chunk = ids.slice(i, i + 25);
      let snaps: FirebaseFirestore.DocumentSnapshot[] = [];
      try { snaps = await Promise.race([db.getAll(...chunk.map((id) => db.collection("hubNotes").doc(id)), ...(ALL ? [] : [{ fieldMask: ["title", ...FIELDS] }])), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 60_000))]); }
      catch { for (const id of chunk) { try { snaps.push(await retry(() => db.collection("hubNotes").doc(id).get())); } catch { unreadable.push(`${tenant}/${id}`); } } }
      for (const snap of snaps) {
        if (!snap.exists) continue;
        scanned++;
        const data = snap.data() as Record<string, unknown>;
        const scope: Record<string, unknown> = ALL ? data : Object.fromEntries(Object.entries(data).filter(([k]) => FIELDS.has(k)));
        if (!findOakDeep(scope, 1).length) continue;
        const upd: Record<string, unknown> = {}; const changes: Change[] = [];
        const one = (key: string, val: unknown) => { const r = scrubDeep(val, key.split(".").pop()); if (r.changed) { upd[key] = r.value; diffStrings(val, r.value, key, changes); } };
        for (const [k, v] of Object.entries(scope)) {
          if (ALL && k === "lesson" && v && typeof v === "object") { for (const [lk, lv] of Object.entries(v as Record<string, unknown>)) if (lk !== "source" && lk !== "oakDeck") one(`lesson.${lk}`, lv); }
          else if (!["source", "id", "tenantId", "createdBy"].includes(k)) one(k, v);
        }
        rows.push({ tenant, id: snap.id, title: String(data.title ?? "").slice(0, 80), changes, upd, hits: findOakDeep(scope, 3).map((h) => `${h.path}: ${h.sample}`) });
      }
    }
    console.error(`  ${tenant}: ${ids.length} notes (scanned so far ${scanned}, with brand ${rows.length})`);
  }
  if (unreadable.length) console.error("UNREADABLE:", unreadable.join(", "));
  const byTenant = new Map<string, typeof rows>();
  for (const r of rows) (byTenant.get(r.tenant) ?? byTenant.set(r.tenant, []).get(r.tenant)!).push(r);
  const md: string[] = [];
  md.push(`# Oak purge, dry run (hubNotes bodies)`, "", `Generated ${new Date().toISOString()} by \`server/src/oak/purgeOakNoteBodies.ts\` in DRY-RUN mode. Read-only: nothing was written.`, "",
    `Scanned ${scanned} hubNotes docs across ${tenants.length} tenants${unreadable.length ? ` (${unreadable.length} unreadable: ${unreadable.join(", ")})` : ""}. ${rows.length} contain the brand, across ${byTenant.size} tenants. Unchanged by scrub (would remain, needs a look): ${rows.filter((r) => !r.changes.length).length}.`,
    "", "These strings are already hidden from every user at read time (`noOakResponse.ts`); the purge would remove them from storage. Exact removed text is quoted per field.", "");
  for (const [t, rs] of [...byTenant.entries()].sort((a, b) => b[1].length - a[1].length)) {
    md.push(`## Tenant \`${t}\` (${rs.length} note${rs.length > 1 ? "s" : ""})`, "");
    for (const r of rs) {
      md.push(`- note \`${r.id}\` "${r.title.replace(/\n/g, " ")}"`);
      if (!r.changes.length) md.push(`  - NOT CHANGED by scrub: ${r.hits.join(" | ")}`);
      for (const c of r.changes) for (const s of c.spans) md.push(`  - \`${c.path}\` remove: "${s.replace(/\s+/g, " ").slice(0, 300)}"`);
    }
    md.push("");
  }
  const text = md.join("\n");
  const out = arg("report"); if (out) fs.writeFileSync(out, text); else console.log(text);
  console.error(`dry run: ${rows.length} notes / ${byTenant.size} tenants`);
  if (APPLY) {
    let batch = db.batch(), n = 0;
    for (const r of rows) { if (!Object.keys(r.upd).length) continue; batch.update(db.collection("hubNotes").doc(r.id), r.upd); if (++n >= 25) { await batch.commit(); batch = db.batch(); n = 0; } }
    if (n) await batch.commit();
    console.error("APPLIED");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
