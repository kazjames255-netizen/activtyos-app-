// Mass-bookings QA: provision provider + parent, 9 listings (the 8 asked for, plus a separate sibling and multi-day), a discount code.
import { execFileSync } from "node:child_process";
import { ROOT } from "../helpers/env";
import path from "node:path";
import { apiPost } from "../helpers/accounts";
import { call, ok, em, save, tokFor, fbSignUp } from "./mb-lib";

const D = (s: string) => s; // ISO day

(async () => {
  const S: any = { listings: {}, passes: {}, accts: {} };
  const prov = await fbSignUp(em("prov"));
  const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "company", businessName: "QA Fork F Camps", providerName: "QA Fork F Camps", providerNameMode: "business", ownerName: "Fiona Provider", address: "12 Corris Court", postcode: "MK10 9NR", contactEmail: em("prov"), phone: "07700900123" });
  S.accts.prov = { email: em("prov"), uid: prov.uid, tenantId: reg.tenantId };
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
  const tok = await tokFor(em("prov"));

  const lib0 = (await ok(tok, "GET", "/api/library")) ?? {};
  await ok(tok, "PUT", "/api/library", {
    venues: [
      { id: "v-hall", name: "QA Sports Hall", address: "1 Venue Way, Northampton NN1 2AB", city: "Northampton", kind: "venue" },
      { id: "v-online", name: "Online (Zoom)", address: "", kind: "online", directions: "Join on Zoom: https://zoom.example/j/123456. Have a pencil ready." },
    ],
    addons: [
      { id: "ao-tshirt", name: "Camp T-shirt", type: "once", price: 10, questions: [{ id: "q-size", label: "Size", type: "choice", options: ["S", "M", "L"], required: true }] },
      { id: "ao-lunch", name: "Hot lunch", type: "perday", price: 4.5 },
    ],
    settings: { ...(lib0.settings ?? {}), billing: { ...((lib0.settings ?? {}).billing ?? {}), bankName: "Test Bank", sortCode: "20-57-44", accountNumber: "63437582", accountName: "QA Fork F Camps", email: em("prov") }, providerName: "QA Fork F Camps" },
  });

  const per = await ok(tok, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" });
  S.period = per.id;
  const passCache: Record<string, any> = {};
  const mkPass = async (name: string, days: number) => (passCache[`${name}|${days}`] ??= await ok(tok, "POST", "/api/passes", { name, days }));

  type P = [string, number, number]; // name, days, price
  const mk = async (key: string, title: string, passes: P[], extra: Record<string, unknown>) => {
    const docs = []; for (const [n, d] of passes) docs.push(await mkPass(n, d));
    const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {};
    passes.forEach(([, , price], i) => { passFlat[docs[i].id] = price; periodPrice[`${docs[i].id}_${per.id}`] = price; });
    const longest = Math.max(...passes.map((p) => p[2]));
    const bundle = await ok(tok, "POST", "/api/block-bundles", { name: `QA ${title}`, periodIds: [per.id], passIds: docs.map((d) => d.id), priced: true, masterPrice: longest, calcOn: false, passFlat, periodPrice });
    const l = await ok(tok, "POST", "/api/listings", {
      title, blockMode: "weekly", maxAttendees: "12", capacityScope: "day", showSpaces: true, ageFrom: "4", ageTo: "12", blockId: bundle.id,
      passes: passes.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", status: "live", visibility: "public",
      cancellation: "Cancel at least 48 hours before the start to receive a full refund.", deliveryMode: "venue", venueId: "v-hall", ...extra,
    });
    await ok(tok, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [l.id] });
    const full = await ok(tok, "GET", `/api/listings/${l.id}`);
    S.listings[key] = { id: l.id, title, passes: passes.map(([name, days, price]) => ({ name, days, price })), blocks: (full.blocks ?? []).map((b: any) => ({ id: b.id, startDate: b.startDate, endDate: b.endDate, n: (b.sessions ?? []).length })) };
    console.log(key, l.id, S.listings[key].blocks.length, "blocks");
  };

  await mk("oneoff", "QA One-off Taster", [["Single session", 1, 12]], { runFrom: D("2026-10-28"), runTo: D("2026-10-28"), days: [3] });
  await mk("camp", "QA 5-day Camp", [["Full week", 5, 150], ["Single day", 1, 35]], { runFrom: D("2026-10-26"), runTo: D("2026-10-30"), days: [1, 2, 3, 4, 5] });
  await mk("term", "QA 6-week Term", [["Full term", 6, 84], ["Single week", 1, 16]], { runFrom: D("2026-11-04"), runTo: D("2026-12-09"), days: [3] });
  await mk("passes", "QA Pass Club", [["3-day pass", 3, 54], ["5-day pass", 5, 85], ["10-day pass", 10, 150]], { runFrom: D("2026-11-02"), runTo: D("2026-11-20"), days: [1, 2, 3, 4, 5] });
  await mk("addons", "QA Camp With Extras", [["Full week", 5, 140], ["Single day", 1, 32]], { runFrom: D("2026-11-09"), runTo: D("2026-11-13"), days: [1, 2, 3, 4, 5], addonIds: ["ao-tshirt", "ao-lunch"] });
  await mk("sibling", "QA Sibling Club", [["Single week", 1, 20], ["Full month", 4, 70]], {
    runFrom: D("2026-11-03"), runTo: D("2026-11-24"), days: [2],
    discounts: [{ id: "d-sib", kind: "person", name: "Sibling discount", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" }],
  });
  await mk("multiday", "QA Multi-day Camp", [["Single day", 1, 30], ["Full week", 5, 150]], {
    runFrom: D("2026-11-16"), runTo: D("2026-11-20"), days: [1, 2, 3, 4, 5],
    discounts: [{ id: "d-multi", kind: "session", name: "Book 3+ days and save", passNames: [], enabled: true, moreThan: 2, appliesTo: "all", method: "percent", value: 15, beforeDate: "" }],
  });
  await mk("online", "QA Online Tutoring", [["Single session", 1, 25], ["4-session course", 4, 90]], { runFrom: D("2026-11-02"), runTo: D("2026-11-23"), days: [1], venueId: "v-online" });
  await mk("home", "QA Home Visit Coaching", [["Single visit", 1, 40]], { runFrom: D("2026-11-05"), runTo: D("2026-11-26"), days: [4], deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["NN5", "NN1"] } });

  const code = await ok(tok, "POST", "/api/discounts", { code: "QAF5OFF", type: "amount", value: 5, listingId: S.listings.camp.id, perCustomerLimit: true, usageLimit: 5, active: true });
  S.code = { code: "QAF5OFF", id: code.id, listing: "camp", value: 5 };

  // Parent + 2 children
  const par = await fbSignUp(em("parent"));
  await apiPost("/api/register-role", par.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "Pat", lastName: "Parent" });
  await call(par.idToken, "POST", "/api/me/welcome", {});
  S.accts.parent = { email: em("parent"), uid: par.uid };
  S.kids = {};
  for (const [name, dob] of [["Ava Parent", "2020-04-10"], ["Ben Parent", "2017-04-10"]]) {
    const c = await ok(par.idToken, "POST", "/api/my/children", { name, dob });
    S.kids[name.split(" ")[0]] = { id: c.id, name, age: c.age };
    console.log("child", name, c.age);
  }
  save(S); console.log("DONE"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
