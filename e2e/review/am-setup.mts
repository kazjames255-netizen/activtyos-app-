// AM setup: throwaway provider + venue listing WITH add-ons (T-shirt: size, Water bottle: colour, Snack: per day) + 2 parents + bookings. API :4030.
// run: NEXT_PUBLIC_API_URL=http://localhost:4030 server/node_modules/.bin/tsx docs/home-visit-qa/AM/setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-am-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const out: any = { ts, password: TEST_PASSWORD, parents: {}, bookings: {} };
const API = "http://localhost:4030";
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AM Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), uid: prov.uid, tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
const addons = [
  { id: "am-tee", name: "T-shirt", type: "once", price: 10, emoji: "👕", questions: [{ id: "q-size", label: "size", type: "choice", options: ["S", "M", "L"], required: true }] },
  { id: "am-snack", name: "Snack pack", type: "perday", price: 2, emoji: "🍎" },
];
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({
  venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }],
  addons: [...(lib.addons ?? []), ...addons],
  settings: { ...(lib.settings ?? {}), marketplaceListed: true },
}) });

const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const pass5 = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Week pass", days: 5 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: `QA AM`, periodIds: [period.id], passIds: [pass.id, pass5.id], priced: true, masterPrice: 0.3, calcOn: true });
const title = `HVQA AM Camp ${ts}`;
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], venueId: "hvqa-venue", addonIds: ["am-tee", "am-bottle", "am-snack"], bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listing = { id: l.id, title };

async function parent(key: string, first: string, kids: string[]) {
  const s = await fbSignUp(em(key));
  await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: first, lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
  for (const k of kids) await apiPost("/api/my/children", s.idToken, { name: k, dob: "2018-05-14" });
  out.parents[key] = { email: em(key), uid: s.uid };
}
await parent("one", "Familyone", ["sally james"]);
await parent("two", "Familytwo", ["marnie kelson"]);

const pTok = async (k: string) => (await fbSignIn(out.parents[k].email)).idToken;
const P1 = await pTok("one"), P2 = await pTok("two");
const listing = await call(`/api/listings/${l.id}`, P1); const block = listing.j.blocks[0]; const days: string[] = (block.sessions ?? []).map((s: any) => s.date);
out.day = days[0]; out.day2 = days[1];
const body = (items: any[]) => JSON.stringify({ listingId: l.id, blockId: block.id, method: "cash", items });
const r1 = await call("/api/my/bookings", P1, { method: "POST", body: body([
  { pass: "Week pass", dates: days.slice(0, 5), child: "sally james", age: 7, addons: [{ id: "am-tee", answers: { "q-size": "M" } }, { id: "am-snack" }] },
]) });
out.bookings.one = r1;
const r2 = await call("/api/my/bookings", P2, { method: "POST", body: body([
  { pass: "Day pass", dates: [days[1]], child: "marnie kelson", age: 8, addons: [{ id: "am-tee", answers: { "q-size": "L" } }, { id: "am-snack" }] },
]) });
out.bookings.two = r2;
fs.writeFileSync(`${WT}/docs/home-visit-qa/AM/accounts.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ day: out.day, r1: r1.status, r2: r2.status, refs1: r1.j?.bookings?.map((b: any) => b.ref), refs2: r2.j?.bookings?.map((b: any) => b.ref), err1: r1.status >= 300 ? r1.j : undefined, err2: r2.status >= 300 ? r2.j : undefined }, null, 1));
process.exit(0);
