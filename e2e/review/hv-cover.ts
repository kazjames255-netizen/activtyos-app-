import fs from "node:fs";
import { call, ok, db, load, save, tokFor, iso, nextMonday, addDays } from "./hv-lib";
const R: { id: string; ok: boolean; note: string }[] = [];
const rec = (id: string, ok_: boolean, note: string) => { R.push({ id, ok: ok_, note }); console.log(`${ok_ ? "PASS" : "FAIL"} ${id} ${note}`); };
(async () => {
  const S = load(); const L = S.listings;
  const fa = await tokFor(S.accts.fa.email), p1 = await tokFor(S.accts.p1.email);
  const kid = (await ok(p1, "POST", "/api/my/children", { name: "Hv Kid One", dob: "2017-03-04" }));
  const wd: string[] = []; for (let w = 0; w < 3; w++) for (let d = 0; d < 5; d++) wd.push(iso(addDays(nextMonday, w * 7 + d)));
  const used: Record<string, number> = {};
  const nextDate = (key = "x") => wd[(used[key] = (used[key] ?? -1) + 1)] ;
  const book = (key: string, sa: any, d = nextDate(key)) => call(p1, "POST", "/api/my/bookings", { listingId: L[key].id, blockId: L[key].blockId, method: "bank", ...(sa ? { serviceAddress: sa } : {}), items: [{ pass: "1 day", child: "Hv Kid One", childId: kid.id, age: 8, dates: [d] }] });
  const count = async (key: string) => (await db.collection("bookings").where("listingId", "==", L[key].id).get()).size;
  // (c) coverage, postcode list
  const cases: [string, any, boolean][] = [
    ["inside NN5 7EA", { address: "5 Home Road", postcode: "NN5 7EA" }, true],
    ["lowercase+extra spaces ' nn5   7ea '", { address: "5 Home Road", postcode: " nn5   7ea " }, true],
    ["no space NN57EA", { address: "5 Home Road", postcode: "NN57EA" }, true],
    ["second prefix NN1 1AA", { address: "9 Other St", postcode: "NN1 1AA" }, true],
    ["outside NN2 1AA", { address: "1 Far St", postcode: "NN2 1AA" }, false],
    ["outside London SW1A 1AA", { address: "Palace", postcode: "SW1A 1AA" }, false],
    ["lookalike district NN50 1AA (should NOT match NN5)", { address: "2 Odd St", postcode: "NN50 1AA" }, false],
    ["missing postcode", { address: "5 Home Road", postcode: "" }, false],
  ];
  for (const [name, sa, expectOk] of cases) {
    const before = await count("hvpc"); const r = await book("hvpc", sa);
    const after = await count("hvpc"); const okd = expectOk ? r.status < 300 : r.status >= 400;
    rec(`COV postcode: ${name}`, okd && (expectOk || after === before), `HTTP ${r.status}${r.status >= 400 ? " msg=" + JSON.stringify(r.json?.error ?? r.json).slice(0, 140) : ""}; bookings ${before}->${after}`);
  }
  // no serviceAddress at all on home-visit: falls back to account address (p1 has NN5 7EA)
  { const r = await book("hvpc", undefined); rec("COV: no address sent -> uses parent's saved account address", r.status < 300, `HTTP ${r.status} ${r.status >= 400 ? JSON.stringify(r.json).slice(0, 120) : "served using account postcode"}`); }
  // radius: geocoding
  const geo = async (pc: string, miles: number) => { await ok(fa, "PUT", `/api/listings/${L.hvrad.id}`, { coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: miles } }); return; };
  const r0 = await book("hvrad", { address: "5 Home Road", postcode: "NN5 7EA" });
  rec("COV radius: base postcode itself (0 miles) inside 5-mile radius", r0.status < 300, `HTTP ${r0.status} ${JSON.stringify(r0.json?.error ?? "").slice(0, 160)}`);
  const rFar = await book("hvrad", { address: "Palace", postcode: "SW1A 1AA" });
  rec("COV radius: SW1A 1AA far outside", rFar.status === 409, `HTTP ${rFar.status} msg=${JSON.stringify(rFar.json?.error ?? "").slice(0, 200)}`);
  const mi = /about ([\d.]+) miles/.exec(rFar.json?.error ?? "");
  // find a mid-distance postcode, then straddle the boundary
  const probe = await book("hvrad", { address: "x", postcode: "NN3 5AA" });
  rec("COV radius: NN3 5AA (Northampton NN3) result", probe.status < 300 || probe.status === 409, `HTTP ${probe.status} ${JSON.stringify(probe.json?.error ?? "ok").slice(0, 200)}`);
  // exact-ish edge: use the server's own distance message for NN3 5AA at radius 1, then raise radius above it
  await ok(fa, "PUT", `/api/listings/${L.hvrad.id}`, { coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: 1 } });
  const tight = await book("hvrad", { address: "x", postcode: "NN3 5AA" });
  const d = /about ([\d.]+) miles/.exec(tight.json?.error ?? "");
  rec("COV radius: tight 1-mile radius refuses NN3 5AA and names the distance", tight.status === 409 && !!d, `HTTP ${tight.status} msg=${JSON.stringify(tight.json?.error ?? "").slice(0, 200)}`);
  if (d) {
    const miles = parseFloat(d[1]);
    await ok(fa, "PUT", `/api/listings/${L.hvrad.id}`, { coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: Math.ceil(miles + 0.5) } });
    const inEdge = await book("hvrad", { address: "x", postcode: "NN3 5AA" });
    rec(`COV radius edge: radius ${Math.ceil(miles + 0.5)} (> ${miles} mi) accepts NN3 5AA`, inEdge.status < 300, `HTTP ${inEdge.status} ${JSON.stringify(inEdge.json?.error ?? "ok").slice(0, 160)}`);
    await ok(fa, "PUT", `/api/listings/${L.hvrad.id}`, { coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: Math.max(0.1, Math.floor(miles * 10) / 10 - 0.1) } });
    const outEdge = await book("hvrad", { address: "x", postcode: "NN3 5AA" });
    rec(`COV radius edge: radius just under ${miles} mi refuses NN3 5AA`, outEdge.status === 409, `HTTP ${outEdge.status}`);
  }
  { const un = await book("hvrad", { address: "x", postcode: "NN2 1AA" }); rec("COV radius: postcode the geocoder cannot find gives a clear 'couldn't check' refusal", un.status === 409 && /check|full address/i.test(un.json?.error ?? ""), `HTTP ${un.status} msg=${JSON.stringify(un.json?.error ?? "").slice(0, 180)}`); }
  await ok(fa, "PUT", `/api/listings/${L.hvrad.id}`, { coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: 5 } });
  // venue-only listing never carries a service address
  const rv = await book("venue", { address: "should be ignored", postcode: "SW1A 1AA" });
  rec("venue-only booking ignores a sent address (booking has none)", rv.status < 300, `HTTP ${rv.status}`);
  if (rv.status < 300) { const b = rv.json.bookings?.[0]; const doc = (await db.collection("bookings").where("listingId", "==", L.venue.id).get()).docs[0]?.data(); rec("venue-only booking doc has NO serviceAddress", !doc?.serviceAddress, JSON.stringify(doc?.serviceAddress ?? null)); }
  const rb = await book("both", { address: "5 Home Road", postcode: "NN5 7EA" });
  rec("'both' listing accepts a covered home address", rb.status < 300, `HTTP ${rb.status} ${JSON.stringify(rb.json?.error ?? "").slice(0, 200)}`);
  const rbo = await book("both", { address: "Far", postcode: "SW1A 1AA" });
  rec("'both' listing refuses an uncovered address", rbo.status === 409, `HTTP ${rbo.status}`);
  const ro = await book("online", { address: "ignored", postcode: "SW1A 1AA" });
  rec("online listing books with no address needed (and ignores one)", ro.status < 300, `HTTP ${ro.status} ${JSON.stringify(ro.json?.error ?? "").slice(0, 200)}`);
  const od = (await db.collection("bookings").where("listingId", "==", L.online.id).get()).docs[0]?.data();
  rec("online booking doc has NO serviceAddress", !!od && !od.serviceAddress, JSON.stringify(od?.serviceAddress ?? null));
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-cover-results.json", JSON.stringify(R, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
