import fs from "node:fs";
import { call, ok, db, load, save, tokFor, API_URL } from "./hv-lib";
const R: { id: string; ok: boolean; note: string }[] = [];
const rec = (id: string, ok_: boolean, note: string) => { R.push({ id, ok: ok_, note }); console.log(`${ok_ ? "PASS" : "FAIL"} ${id} ${note}`); };
(async () => {
  const S = load(); const L = S.listings;
  const fa = await tokFor(S.accts.fa.email), p1 = await tokFor(S.accts.p1.email), p2 = await tokFor(S.accts.p2.email);
  // ---- (b) PRIVACY: base postcode / provider home address in parent-facing responses
  const secrets = ["NN5 7EA", "NN57EA", "12 Corris Court"]; // MK10 9NR is Amir Coaching's own public venue, so it is not a secret here
  const leaks = (txt: string) => secrets.filter((x) => txt.includes(x));
  const surfaces: [string, () => Promise<string>][] = [
    ["GET /api/listings anon", async () => JSON.stringify((await call(null, "GET", "/api/listings")).json)],
    ["GET /api/listings parent", async () => JSON.stringify((await call(p1, "GET", "/api/listings")).json)],
    ...(Object.keys(L) as string[]).flatMap((k) => [
      [`GET /api/listings/${k} anon`, async () => JSON.stringify((await call(null, "GET", `/api/listings/${L[k].id}`)).json)] as [string, () => Promise<string>],
      [`GET /api/listings/${k} parent`, async () => JSON.stringify((await call(p1, "GET", `/api/listings/${L[k].id}`)).json)] as [string, () => Promise<string>],
    ]),
    ["GET /api/public/library anon", async () => JSON.stringify((await call(null, "GET", `/api/public/library/${S.accts.fa.tenantId}`)).json)],
    ["GET /api/public/library parent", async () => JSON.stringify((await call(p1, "GET", `/api/public/library/${S.accts.fa.tenantId}`)).json)],
    ["GET /api/providers anon", async () => JSON.stringify((await call(null, "GET", `/api/providers`)).json)],
    ["GET /api/providers parent", async () => JSON.stringify((await call(p1, "GET", `/api/providers`)).json)],
  ];
  for (const [name, fn] of surfaces) {
    const t = await fn(); const lk = leaks(t);
    // radius listing owner view is allowed to contain base postcode; parents are not.
    rec(`PRIV ${name}`, lk.length === 0, lk.length ? `LEAK ${lk.join(", ")} (len ${t.length})` : `no provider address/base postcode (len ${t.length})`);
  }
  const owner = JSON.stringify((await call(fa, "GET", `/api/listings/${L.hvrad.id}`)).json);
  rec("PRIV owner still sees base postcode (editing needs it)", owner.includes("NN5 7EA"), owner.includes("NN5 7EA") ? "owner response keeps basePostcode (needed to edit)" : "owner cannot see base postcode: editing broken");
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-api-results.json", JSON.stringify(R, null, 1));
  save(S); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
