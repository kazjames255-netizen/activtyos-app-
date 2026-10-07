// AK setup: throwaway provider + venue listing + 1 parent (5 children) + bookings in every refund state for the All income list. API :4028.
// run: NEXT_PUBLIC_API_URL=http://localhost:4028 server/node_modules/.bin/tsx e2e/review/ak-setup.mts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";
import { db } from "../../server/src/firebase";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-ak-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const API = "http://localhost:4028";
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };
const out: any = { ts, password: TEST_PASSWORD, bookings: {} };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AK Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: "QA AK", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title: `HVQA AK Camp ${ts}`, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], venueId: "hvqa-venue", bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listing = { id: l.id };

const par = await fbSignUp(em("par"));
await apiPost("/api/register-role", par.idToken, { role: "parent", firstName: "Familyak", lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
const kids = ["paid kid", "refunded kid", "sent kid", "part kid one", "part kid two", "owed kid", "unpaid kid"];
for (const k of kids) await apiPost("/api/my/children", par.idToken, { name: k, dob: "2018-05-14" });
const P = (await fbSignIn(em("par"))).idToken;
out.parent = { email: em("par") };
const listing = await call(`/api/listings/${l.id}`, P); const block = listing.j.blocks[0]; const days: string[] = (block.sessions ?? []).map((s: any) => s.date);
const book = async (key: string, items: any[], d = 0) => { const r = await call("/api/my/bookings", P, { method: "POST", body: JSON.stringify({ listingId: l.id, blockId: block.id, method: "bank", items: items.map((c) => ({ pass: "Day pass", dates: [days[d]], child: c, age: 7 })) }) }); const ref = r.j?.bookings?.[0]?.ref; out.bookings[key] = { ref, status: r.status, err: r.status >= 300 ? r.j : undefined }; return ref as string; };
const act = (ref: string, body: any) => call(`/api/bookings/${encodeURIComponent(ref)}/actions`, ps.idToken, { method: "POST", body: JSON.stringify(body) });
const A = await book("paid", ["paid kid"], 0), B = await book("refundedOffline", ["refunded kid"], 1), C = await book("refundedSent", ["sent kid"], 2), D = await book("part", ["part kid one", "part kid two"], 3), E = await book("owed", ["owed kid"], 4), F = await book("unpaid", ["unpaid kid"], 5);
for (const r of [A, B, C, D, E]) out.bookings["paid_" + r] = (await act(r, { type: "paid" })).status;
for (const r of [B, C]) { out.bookings["cancel_" + r] = (await act(r, { type: "cancel", refund: "full", amount: 0.3, reason: "ak" })).status; out.bookings["approve_" + r] = (await act(r, { type: "refund-approve" })).status; }
out.bookings.partCancel = (await act(D, { type: "cancel-child", ki: 1, resolution: "refund", amount: 0.3 })).status;
out.bookings.partApprove = (await act(D, { type: "refund-approve" })).status;
out.bookings.owedCancel = (await act(E, { type: "cancel", refund: "full", amount: 0.3, reason: "ak" })).status;
// a logged income entry
out.income = (await call("/api/income", ps.idToken, { method: "POST", body: JSON.stringify({ date: iso(new Date()), category: "Grants", amount: 2.5, source: "AK grant" }) })).status;
// make two of them look like real card refunds / a sent bank refund (the app cannot send a bank refund itself)
const snap = async (ref: string) => (await db.collection("bookings").where("tenantId", "==", reg.tenantId).where("ref", "==", ref).get()).docs[0];
const sd = await snap(C); await sd.ref.update({ "cancel.refundSentAt": new Date().toISOString() });
const pd = await snap(D); await pd.ref.update({ "cancel.refundVia": "card" });
fs.writeFileSync(`${WT}/docs/home-visit-qa/AK/accounts.json`, JSON.stringify({ ...out, refs: { A, B, C, D, E, F } }, null, 2));
console.log(JSON.stringify({ refs: { A, B, C, D, E, F }, results: out.bookings }, null, 1));
process.exit(0);
