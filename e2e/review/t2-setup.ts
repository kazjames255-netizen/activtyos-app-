import { apiFetch, apiPost, fbSignIn, fbSignUp, em, iso, saveState, stamp, unwall } from "./t2-lib";
(async () => {
  const s = await fbSignUp(em("op"));
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: `T2 Camps ${stamp}`, providerName: `T2 Camps ${stamp}`, providerNameMode: "business", ownerName: "T2 Owner" });
  const tenantId = r.tenantId; unwall(tenantId);
  const op = (await fbSignIn(em("op"))).idToken;
  const parents: Record<string, { email: string; tok: string }> = {};
  for (const k of ["a", "b", "c", "d"]) {
    const ps = await fbSignUp(em(k));
    await apiPost("/api/register-role", ps.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "Parent", lastName: k.toUpperCase() });
    await apiPost("/api/me/welcome", ps.idToken, {});
    parents[k] = { email: em(k), tok: ps.idToken };
  }
  const lib = ((await apiFetch<any>("/api/library", op)) ?? {}) as any;
  await apiFetch("/api/library", op, { method: "PUT", body: JSON.stringify({ venues: [{ id: "t2-venue", name: "T2 Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), billing: { ...(lib.settings?.billing ?? {}), bankName: "Test Bank", sortCode: "20-57-44", accountNumber: "63437582", email: em("op") } } }) });
  const period = await apiPost<{ id: string }>("/api/periods", op, { title: "Full day", start: "09:00", finish: "15:00" });
  const defs = [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]] as const;
  const passIds: string[] = []; const passFlat: Record<string, number> = {}; const passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) { const p = await apiPost<{ id: string }>("/api/passes", op, { name, days }); passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat"; }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", op, { name: `T2 block ${stamp}`, periodIds: [period.id], passIds, priced: true, masterPrice: 90, calcOn: true, passFlat, passMode, periodPrice: {} });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 7); const end = new Date(start); end.setDate(end.getDate() + 18);
  const base = { venueId: "t2-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], showSpaces: true, blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", status: "live", visibility: "public", waitlist: true, waitlistMode: "manual", waitlistSize: "20" };
  const mk = async (title: string, extra: Record<string, unknown>) => {
    const L = await apiPost<{ id: string }>("/api/listings", op, { ...base, title: `${title} ${stamp}`, ...extra });
    await apiFetch(`/api/block-bundles/${bundle.id}/listings`, op, { method: "PUT", body: JSON.stringify({ listingIds: [...(await apiFetch<any>(`/api/block-bundles`, op)).find((b: any) => b.id === bundle.id).listingIds, L.id] }) });
    return L.id;
  };
  const L = {
    day: await mk("T2 PerDay", { maxAttendees: "10", capacityScope: "day", ageFrom: "5", ageTo: "11", allowOutOfRange: false }),
    whole: await mk("T2 Whole", { maxAttendees: "6", capacityScope: "listing", ageFrom: "5", ageTo: "11", allowOutOfRange: false }),
    oor: await mk("T2 OutOfRange", { maxAttendees: "10", capacityScope: "day", ageFrom: "5", ageTo: "11", allowOutOfRange: true }),
    disc: await mk("T2 Discounts", { maxAttendees: "30", capacityScope: "day", ageFrom: "3", ageTo: "16", allowOutOfRange: false }),
    hide: await mk("T2 NoSpaces", { maxAttendees: "10", capacityScope: "day", ageFrom: "5", ageTo: "11", showSpaces: false }),
  };
  saveState({ tenantId, op, opEmail: em("op"), parents, L, bundleId: bundle.id, stamp });
  console.log("setup ok", tenantId, JSON.stringify(L));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
