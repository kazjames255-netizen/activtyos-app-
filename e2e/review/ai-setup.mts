// AI setup: throwaway provider + listing (£15 / child-day) + one parent; 14 bookings back-dated across the last 12 months so the money charts have real data.
// run: NEXT_PUBLIC_API_URL=http://localhost:4026 server/node_modules/.bin/tsx e2e/review/ai-setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";
import { db } from "../../server/src/firebase";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-ai-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const API = "http://localhost:4026";
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); return { status: r.status, j: await r.json().catch(() => ({})) as any }; };
const out: any = { ts, password: TEST_PASSWORD };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AI Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: `QA AI`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 15, calcOn: true });
const title = `HVQA AI Camp ${ts}`;
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "40", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 15, days: 1 }], venueId: "hvqa-venue", bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listing = { id: l.id, title };

const pe = await fbSignUp(em("par"));
await apiPost("/api/register-role", pe.idToken, { role: "parent", firstName: "Familyai", lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
const kids = ["amy ai", "ben ai"];
for (const k of kids) await apiPost("/api/my/children", pe.idToken, { name: k, dob: "2018-05-14" });
const P = (await fbSignIn(em("par"))).idToken;
const listing = await call(`/api/listings/${l.id}`, P); const block = listing.j.blocks[0]; const days: string[] = (block.sessions ?? []).map((s: any) => s.date);
// [monthsAgo, paid?]: 10 bookings, 5 days x 2 children
const plan: [number, boolean][] = [[11, true], [9, true], [9, true], [5, true], [3, true], [3, true], [2, true], [0, true], [0, true], [0, false]];
const refs: string[] = [];
for (let i = 0; i < plan.length; i++) {
  const r = await call("/api/my/bookings", P, { method: "POST", body: JSON.stringify({ listingId: l.id, blockId: block.id, method: "cash", items: [{ pass: "Day pass", dates: [days[Math.floor(i / 2)]], child: kids[i % 2], age: 7 }] }) });
  const ref = r.j?.bookings?.[0]?.ref; if (!ref) { console.log("booking failed", i, r.status, JSON.stringify(r.j).slice(0, 200)); continue; }
  refs.push(ref);
}
// back-date createdAt and mark paid directly (read-only demo data for the chart)
const now = new Date();
for (let i = 0; i < refs.length; i++) {
  const [ago, paid] = plan[i];
  const d = new Date(now.getFullYear(), now.getMonth() - ago, ago === 0 ? Math.max(1, now.getDate() - 1) : 14, 11, 0, 0);
  const ref = db.collection("bookings").doc(`${reg.tenantId}_${refs[i]}`);
  const snap = await ref.get(); const b = snap.data() as any;
  await ref.update({ createdAt: d.toISOString(), pay: paid ? "Paid" : "Unpaid", amountPaid: paid ? b.amount : 0, status: "Confirmed" });
}
out.refs = refs;
fs.writeFileSync(`${WT}/docs/home-visit-qa/AI/accounts.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ refs: refs.length, plan: plan.length }));
process.exit(0);
