// AH: API-level check of "Refund recorded - awaiting your transfer" on an isolated stack (API :4025). Throwaway @activityos-test.com accounts only.
// run (from the worktree): NEXT_PUBLIC_API_URL=http://localhost:4025 server/node_modules/.bin/tsx e2e/review/ah-api.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";

const WT = process.cwd();
const API = "http://localhost:4025";
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-ah-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const results: { ok: boolean; name: string; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => { results.push({ ok, name, detail }); console.log(ok ? "PASS" : "FAIL", name, detail); };
const out: any = { ts, password: TEST_PASSWORD, provider: {}, parents: {}, refs: {} };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-AH Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "hvqa-venue", name: "HVQA Hall", address: "1 Test Way", city: "Milton Keynes" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: `QA AH`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title: `HVQA AH Camp ${ts}`, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], venueId: "hvqa-venue", bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listingId = l.id;

async function parent(key: string, first: string, kid: string) {
  const s = await fbSignUp(em(key));
  await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: first, lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
  await apiPost("/api/my/children", s.idToken, { name: kid, dob: "2018-05-14" });
  out.parents[key] = { email: em(key) };
}
await parent("one", "Familyone", "sally james");
await parent("two", "Familytwo", "paul james");
const tok = async (k: string) => (await fbSignIn(out.parents[k].email)).idToken;
const P1 = await tok("one"), P2 = await tok("two");
const listing = await call(`/api/listings/${l.id}`, P1); const block = listing.j.blocks[0]; const days: string[] = (block.sessions ?? []).map((s: any) => s.date);
const book = async (P: string, kid: string, day: string) => {
  const r = await call("/api/my/bookings", P, { method: "POST", body: JSON.stringify({ listingId: l.id, blockId: block.id, method: "bank", items: [{ pass: "Day pass", dates: [day], child: kid, age: 7 }] }) });
  return r.j.bookings?.[0]?.ref as string;
};
const refA = await book(P1, "sally james", days[0]); const refB = await book(P2, "paul james", days[1]);
out.refs = { refA, refB };
check("two bank-transfer bookings created", !!refA && !!refB, `${refA} ${refB}`);

const act = (ref: string, body: any) => call(`/api/bookings/${encodeURIComponent(ref)}/actions`, ps.idToken, { method: "POST", body: JSON.stringify(body) });
const getB = async (ref: string) => { const r = await call("/api/bookings", ps.idToken); return (r.j as any[]).find((b) => b.ref === ref); };
const payments = async () => (await call("/api/payments", ps.idToken)).j as any[];
const cancelP = (P: string, ref: string) => call(`/api/my/bookings/${encodeURIComponent(ref)}/cancel`, P, { method: "POST", body: JSON.stringify({ msg: "AH test", refundBank: { accountName: "Test Parent", sortCode: "12-34-56", accountNumber: "12345678" } }) });
const bells = async (P: string) => ((await call("/api/notifications", P)).j as any)?.items ?? (await call("/api/notifications", P)).j;

for (const [ref, P] of [[refA, P1], [refB, P2]] as const) {
  const paid = await act(ref, { type: "paid" }); check(`${ref}: provider marks bank transfer paid`, paid.s === 200 && paid.j.pay === "Paid", `${paid.s}`);
  const c = await cancelP(P, ref); check(`${ref}: parent cancels with bank details`, c.s === 200, `${c.s} ${JSON.stringify(c.j).slice(0, 120)}`);
}

// A: approve (record) then confirm sent
let a = await act(refA, { type: "refund-approve" });
check("A: approve an offline refund -> 200", a.s === 200, `${a.s} ${typeof a.j === "string" ? a.j : ""}`);
let ba = await getB(refA);
check("A: refundTransfer = awaiting, refundVia = offline, pay is (Partially) refunded as before", ba?.cancel?.refundTransfer === "awaiting" && ba?.cancel?.refundVia === "offline" && /efunded/.test(ba?.pay ?? ""), JSON.stringify({ rt: ba?.cancel?.refundTransfer, via: ba?.cancel?.refundVia, pay: ba?.pay }));
check("A: bank details marker kept until the money is sent (refundBank last4)", !!ba?.cancel?.refundBank?.last4, JSON.stringify(ba?.cancel?.refundBank));
let pays = (await payments()).filter((p) => p.type === "refund" && (p.refs ?? []).includes(refA));
check("A: ledger row is 'to-reimburse'", pays.length === 1 && pays[0].status === "to-reimburse", JSON.stringify(pays.map((p) => p.status)));
const approveDouble = await act(refA, { type: "refund-approve" });
check("A: approving twice is refused (409)", approveDouble.s === 409, `${approveDouble.s}`);
const premature = await act(refB, { type: "refund-sent" });
check("B: 'refund-sent' before approving is refused (409)", premature.s === 409, `${premature.s}`);

const sent = await act(refA, { type: "refund-sent" });
check("A: 'I've sent the refund' -> 200", sent.s === 200, `${sent.s}`);
ba = await getB(refA);
check("A: refundTransfer = sent, with sentAt and sentBy", ba?.cancel?.refundTransfer === "sent" && !!ba?.cancel?.refundSentAt && !!ba?.cancel?.refundSentBy, JSON.stringify({ at: ba?.cancel?.refundSentAt, by: ba?.cancel?.refundSentBy }));
check("A: bank details marker deleted once sent", !ba?.cancel?.refundBank, JSON.stringify(ba?.cancel?.refundBank));
pays = (await payments()).filter((p) => p.type === "refund" && (p.refs ?? []).includes(refA));
check("A: ledger row flipped to 'succeeded' with sentAt (totals unchanged)", pays.length === 1 && pays[0].status === "succeeded" && !!pays[0].sentAt, JSON.stringify(pays.map((p) => [p.status, p.amount])));
const sentTwice = await act(refA, { type: "refund-sent" });
check("A: marking sent twice is refused (409), nothing re-sent", sentTwice.s === 409, `${sentTwice.s}`);

// B: approve with alreadySent
const b2 = await act(refB, { type: "refund-approve", alreadySent: true });
check("B: approve with 'I've already sent it' -> 200", b2.s === 200, `${b2.s}`);
const bb = await getB(refB);
check("B: recorded AND sent in one step", bb?.cancel?.refundTransfer === "sent" && !!bb?.cancel?.refundSentAt, JSON.stringify({ rt: bb?.cancel?.refundTransfer }));
const pb = (await payments()).filter((p) => p.type === "refund" && (p.refs ?? []).includes(refB));
check("B: ledger row is 'succeeded' straight away", pb.length === 1 && pb[0].status === "succeeded", JSON.stringify(pb.map((p) => p.status)));

// C: a third booking left in the "awaiting your transfer" state (for the screenshots)
const refC = await book(P2, "paul james", days[2]); out.refs.refC = refC;
await act(refC, { type: "paid" }); await cancelP(P2, refC);
const cc = await act(refC, { type: "refund-approve" });
const bc = await getB(refC);
check("C: left awaiting your transfer (for screenshots)", cc.s === 200 && bc?.cancel?.refundTransfer === "awaiting", `${cc.s} ${bc?.cancel?.refundTransfer}`);

// D: paid, cancelled by the parent, refund still PENDING approval (for the approve-confirm screenshot)
const refD = await book(P1, "sally james", days[3]); out.refs.refD = refD;
await act(refD, { type: "paid" }); await cancelP(P1, refD);

// bells for the family (A): approved, then sent
await new Promise((r) => setTimeout(r, 2500));
const titles = ((await call("/api/notifications", P1)).j as any);
const list = Array.isArray(titles) ? titles : titles?.items ?? titles?.notifications ?? [];
const tt = list.map((n: any) => n.title);
check("A parent bell: 'Refund approved · ref' (will be sent by bank transfer wording)", list.some((n: any) => /Refund approved/.test(n.title) && n.title.includes(refA) && /bank transfer/i.test(n.body ?? "")), JSON.stringify(tt));
check("A parent bell: 'Refund sent · ref'", list.some((n: any) => /Refund sent/.test(n.title) && n.title.includes(refA)), JSON.stringify(tt));
fs.writeFileSync(new URL("../../docs/home-visit-qa/AH/api-results.md", import.meta.url), `# AH API results (isolated stack :4025)\n\n${results.map((r) => `- ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.detail ? ` (${r.detail.replace(/\|/g, "/")})` : ""}`).join("\n")}\n`);
fs.writeFileSync(new URL("./ah-accounts.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
