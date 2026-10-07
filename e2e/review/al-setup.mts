// AL setup: throwaway provider + venue listing, 1 parent, 5 bookings for the Reconciliation refund filters. API :4029. Everything @activityos-test.com.
// run (from the worktree root): NEXT_PUBLIC_API_URL=http://localhost:4029 server/node_modules/.bin/tsx e2e/review/al-setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";
import { db } from "../../server/src/firebase";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-al-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const API = "http://localhost:4029";
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); let j: any = null; try { j = await r.json(); } catch { /* none */ } return { status: r.status, j }; };
const out: any = { ts, password: TEST_PASSWORD, bookings: {} };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AL Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: "QA AL", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const title = `HVQA AL Camp ${ts}`;
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], venueId: "hvqa-venue", bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listing = { id: l.id, title };

const par = await fbSignUp(em("par"));
await apiPost("/api/register-role", par.idToken, { role: "parent", firstName: "Reconparent", lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
for (const k of ["sally james", "paul james"]) await apiPost("/api/my/children", par.idToken, { name: k, dob: "2018-05-14" });
const P = (await fbSignIn(em("par"))).idToken;
const listing = await call(`/api/listings/${l.id}`, P); const block = listing.j.blocks[0]; const days: string[] = (block.sessions ?? []).map((s: any) => s.date);
const book = async (key: string, method: string, child: string, day: string, kids2?: string) => {
  const items = [{ pass: "Day pass", dates: [day], child, age: 7 }, ...(kids2 ? [{ pass: "Day pass", dates: [day], child: kids2, age: 9 }] : [])];
  const r = await call("/api/my/bookings", P, { method: "POST", body: JSON.stringify({ listingId: l.id, blockId: block.id, method, items }) });
  const ref = r.j?.bookings?.[0]?.ref; out.bookings[key] = { status: r.status, ref, err: r.status >= 300 ? r.j : undefined }; return ref as string;
};
const refA = await book("A-bank-paid", "bank", "sally james", days[0]);
const refB = await book("B-bank-owes", "bank", "paul james", days[1]);
const refC = await book("C-card-refunded", "card", "sally james", days[2]);
const refD = await book("D-bank-refund-awaiting", "bank", "paul james", days[3]);
const refE = await book("E-bank-part-refund", "bank", "sally james", days[4], "paul james");
const rec = async (ref: string, amount: number) => call(`/api/bookings/${encodeURIComponent(ref)}/record-payment`, ps.idToken, { method: "POST", body: JSON.stringify({ amount, method: "Bank transfer" }) });
for (const [ref, amt] of [[refA, 0.3], [refD, 0.3], [refE, 0.6]] as [string, number][]) out.bookings[`rec-${ref}`] = (await rec(ref, amt)).status;
// The refund states the real flows leave behind (card: Stripe sent it; bank: only recorded; part: one day released), written straight onto the throwaway tenant's docs.
const today = iso(new Date());
const patch = async (ref: string, p: Record<string, unknown>) => { const id = `${reg.tenantId}_${ref}`; await db.collection("bookings").doc(id).set(p, { merge: true }); };
await patch(refC, { pay: "Refunded", status: "Cancelled", amountPaid: 0.3, cardPaid: 0.3, paymentIntentId: "pi_hvqa_al", refundedApproved: 0.3, cancel: { on: today, by: "Provider", refund: "approved", amount: 0.3, refundVia: "card", refundedAt: today }, refundLog: [{ label: "Refund approved", amount: 0.3, on: today, by: "Provider", source: "Card" }] });
await patch(refD, { pay: "Refunded", status: "Cancelled", amountPaid: 0.3, refundedApproved: 0.3, cancel: { on: today, by: "Provider", refund: "approved", amount: 0.3, refundVia: "offline", refundedAt: today }, refundLog: [{ label: "Refund approved", amount: 0.3, on: today, by: "Provider", source: "Offline" }] });
await patch(refE, { pay: "Partially refunded", refundLog: [{ label: "Day released", amount: 0.3, on: today, by: "Provider", source: "Offline" }] });
fs.writeFileSync(`${WT}/docs/home-visit-qa/AL/accounts.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
process.exit(0);
