// INC setup: throwaway company A (+2 staff), company B, parent with 2 kids (one booked with A today). API :4011.
// run: NEXT_PUBLIC_API_URL=http://localhost:4011 server/node_modules/.bin/tsx e2e/review/inc-setup.mts <outfile.json>
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fbSignUp, fbSignIn, apiPost, TEST_PASSWORD } from "../helpers/accounts";
import { provisionLiveListing, bookViaApi, createParentChild, markParentWelcomed, ensureVenue } from "../helpers/tenantData";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `qa-inc-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const out: any = { ts, password: TEST_PASSWORD };

const reg = async (n: string, role: "company" | "freelancer") => {
  const s = await fbSignUp(em(n));
  const bn = `QA Inc ${n} ${ts}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: bn, providerName: bn, providerNameMode: "business" });
  return { role, email: em(n), uid: s.uid, tenantId: r.tenantId, tenantName: bn };
};
const A = await reg("coA", "company");
const B = await reg("coB", "company");
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", A.tenantId, B.tenantId], { stdio: "inherit" });
out.A = A;
out.B = B;
const as = await fbSignIn(A.email);
for (const n of ["staff1", "staff2"]) {
  const inv = await apiPost<{ token: string }>("/api/invites", as.idToken, { role: "staff" });
  const s = await fbSignUp(em(n));
  await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
  out[n] = { role: "staff", email: em(n), uid: s.uid, tenantId: A.tenantId };
}
const ps = await fbSignUp(em("par"));
await apiPost("/api/register-role", ps.idToken, { role: "parent", firstName: "Pat", lastName: "Parentqa", postcode: "NN5 7EA" });
out.parent = { role: "parent", email: em("par"), uid: ps.uid, tenantId: null, tenantName: null };
await markParentWelcomed(out.parent);
out.kids = { booked: `Ivy Booked ${ts}`, other: `Otto Unbooked ${ts}` };
out.kidIds = { booked: await createParentChild(out.parent, { name: out.kids.booked }), other: await createParentChild(out.parent, { name: out.kids.other }) };
await ensureVenue(A);
const listing = await provisionLiveListing(A, { title: `QA Inc Camp ${ts}`, price: 0, startToday: true });
await bookViaApi(out.parent, listing, { child: out.kids.booked, dates: [iso(new Date())] });
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
process.exit(0);
