// AE setup: throwaway provider + 1 venue listing (4 weekly Mon-Fri blocks) on the isolated stack (API :4022). Everything @activityos-test.com.
// run (from this worktree): NEXT_PUBLIC_API_URL=http://localhost:4022 server/node_modules/.bin/tsx e2e/review/AE/setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dir = path.dirname(fileURLToPath(import.meta.url));
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../../helpers/accounts";

const ROOT = path.resolve(__dir, "../../..");
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-ae-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const out: any = { ts, password: TEST_PASSWORD, listings: {} };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AE Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${ROOT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({
  venues: [...(lib.venues ?? []), { id: "ae-venue", name: "AE Hall", address: "1 Test Way", city: "Milton Keynes" }],
  settings: { ...(lib.settings ?? {}), marketplaceListed: true },
}) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 25);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: `AE bundle`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title: "Holiday multi-activity camp for curious kids", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", venueId: "ae-venue", showSpaces: true, blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], status: "live", visibility: "public", bookingType: "auto", ageFrom: "4", ageTo: "12" });
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listings.venue = l.id;
fs.writeFileSync(path.join(__dir, "ids.json"), JSON.stringify(out, null, 2));
console.log("listing", l.id);
process.exit(0);
