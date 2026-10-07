import fs from "node:fs";
import { call, load, tokFor, mails, SCRATCH } from "./mb-lib";
(async () => {
  const S = load();
  const pt = await tokFor(S.accts.prov.email);
  const out: any = {};
  for (const u of ["/api/dashboard", "/api/income", "/api/reconciliation", "/api/notifications", "/api/registers?date=2026-10-28", "/api/bookings"]) {
    const r = await call(pt, "GET", u); out[u] = { status: r.status, json: r.json };
  }
  fs.writeFileSync(`${SCRATCH}/peek.json`, JSON.stringify(out, null, 1));
  for (const [u, v] of Object.entries(out) as any) console.log(u, v.status, Array.isArray(v.json) ? `array(${v.json.length})` : Object.keys(v.json ?? {}).join(","));
  const m = mails(); console.log("mails", m.length); for (const x of m) console.log(" -", x.to, "|", x.subject);
  process.exit(0);
})();
