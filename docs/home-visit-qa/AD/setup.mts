// AD setup: throwaway provider (1 venue listing) + 1 parent on the isolated stack (API :4021). Everything @activityos-test.com.
// run (from this worktree): NEXT_PUBLIC_API_URL=http://localhost:4021 server/node_modules/.bin/tsx docs/home-visit-qa/AD/setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../../../e2e/helpers/accounts";

const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-ad-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const out: any = { ts, password: TEST_PASSWORD, parent: {} };
const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AD Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", "server", "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: `QA AD`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title: `HVQA AD Venue ${ts}`, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], bookingType: "auto", venueId: "hvqa-venue", status: "live", visibility: "public" });
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listingId = l.id;
const s = await fbSignUp(em("par"));
await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: "Adparent", lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
await apiPost("/api/my/children", s.idToken, { name: "Ad Kid", dob: "2018-05-14" });
out.parent = { email: em("par") };
fs.writeFileSync(new URL("./accounts.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("done", out.parent.email);
