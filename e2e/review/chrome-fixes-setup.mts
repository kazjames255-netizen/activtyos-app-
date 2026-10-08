// Throwaway provider for the chrome-fixes QA stack (API :4014).
// run: NEXT_PUBLIC_API_URL=http://localhost:4014 server/node_modules/.bin/tsx e2e/review/chrome-fixes-setup.mts --unwall
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";

const ts = Date.now().toString(36);
const email = `cfix-${ts}@activityos-test.com`;
const prov = await fbSignUp(email);
const bn = `CFix Biz ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: "Personal Person", providerNameMode: "business" });
if (process.argv.includes("--unwall")) execFileSync("npm", ["--prefix", `${process.cwd()}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(email);
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "cfix-venue", name: "CFix Hall", address: "1 Test Way", city: "Milton Keynes", postcode: "MK1 1AA" }], settings: { ...(lib.settings ?? {}) } }) });
fs.writeFileSync(`${process.cwd()}/e2e/review/chrome-fixes-accounts.json`, JSON.stringify({ email, password: TEST_PASSWORD, tenantId: reg.tenantId, bn }, null, 1));
console.log({ email, tenantId: reg.tenantId });
