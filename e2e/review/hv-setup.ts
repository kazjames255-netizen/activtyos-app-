import { call, ok, db, provider, parent, em, save, iso, nextMonday, addDays, tokFor } from "./hv-lib";
(async () => {
  const S: any = { accts: {}, listings: {} };
  S.accts.fa = await provider("fa", "freelancer", "HV Freelance Tutors");
  S.accts.cb = await provider("cb", "company", "HV Company Camps");
  S.accts.p1 = await parent("p1");
  S.accts.p2 = await parent("p2", "SW1A 1AA");
  for (const k of ["p1", "p2"]) { await db.collection("users").doc(S.accts[k].uid).set({ phone: "07700900999", address: "5 Home Road", postcode: k === "p1" ? "NN5 7EA" : "SW1A 1AA" }, { merge: true }); }
  const tok = await tokFor(S.accts.fa.email);
  const per = await ok(tok, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" });
  const pass = await ok(tok, "POST", "/api/passes", { name: "1 day", days: 1 });
  const bundle = await ok(tok, "POST", "/api/block-bundles", { name: "HV bundle", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: false, passFlat: { [pass.id]: 20 }, periodPrice: { [`${pass.id}_${per.id}`]: 20 } });
  S.bundle = bundle.id;
  const mk = async (key: string, title: string, extra: Record<string, unknown>) => {
    const l = await ok(tok, "POST", "/api/listings", { title, runFrom: iso(nextMonday), runTo: iso(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "1 day", price: 20, days: 1 }], bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public", cancellation: "Cancel at least 48 hours before the start to receive a full refund.", ...extra });
    await ok(tok, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [...(S.ids ?? []), l.id] });
    (S.ids ??= []).push(l.id);
    const full = await ok(tok, "GET", `/api/listings/${l.id}`);
    S.listings[key] = { id: l.id, title, blockId: (full.blocks ?? []).sort((a: any, b: any) => (a.startDate < b.startDate ? -1 : 1))[0]?.id, firstDate: iso(nextMonday) };
  };
  await mk("hvpc", "HV Postcode Visits", { deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["NN5", "NN1"] } });
  await mk("hvrad", "HV Radius Visits", { deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "radius", basePostcode: "NN5 7EA", radiusMiles: 5 } });
  await mk("both", "HV Both Venue And Home", { deliveryMode: "both", venueId: "hv-venue", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["NN5"] } });
  await mk("venue", "HV Venue Only", { deliveryMode: "venue", venueId: "hv-venue" });
  await mk("online", "HV Online Tutoring", { deliveryMode: "venue", venueId: "hv-online" });
  await call(await tokFor(S.accts.p1.email), "POST", "/api/my/providers/follow", { tenantId: S.accts.fa.tenantId });
  await call(await tokFor(S.accts.p2.email), "POST", "/api/my/providers/follow", { tenantId: S.accts.fa.tenantId });
  save(S); console.log(JSON.stringify(S, null, 1)); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
