// N6 setup + API checks: throwaway freelancer (account name is a login word) with a listing running TODAY, one cash booking, then:
//  (A) the register can be taken with no staff record, and the stamp is a real name (never the email); /api/me asks for a real name once.
//  (B) Tax-Free Childcare provider details are saved and read back; the public library (what checkout reads) carries them.
// run: NEXT_PUBLIC_API_URL=http://localhost:4044 server/node_modules/.bin/tsx e2e/review/n6-setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD } from "../helpers/accounts";

const WT = process.cwd();
const ts = Date.now().toString(36);
const em = (n: string) => `hvqa-n6-${ts}-${n}@activityos-test.com`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const API = "http://localhost:4044";
const out: any = { ts, password: TEST_PASSWORD, checks: [] as any[] };
const check = (name: string, ok: boolean, detail?: unknown) => { out.checks.push({ name, ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail ?? ""); };
const call = async (path: string, tok: string, init?: RequestInit) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* */ } return { status: r.status, j }; };

const prov = await fbSignUp(em("prov"));
const bn = `HVQA-N6 Camps ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
out.provider = { email: em("prov"), uid: prov.uid, tenantId: reg.tenantId, name: bn };
execFileSync("npm", ["--prefix", `${WT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const ps = await fbSignIn(em("prov"));
const lib = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
await apiFetch("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({
  venues: [...(lib.venues ?? []), { id: "n6-venue", name: "N6 Hall", address: "1 Test Way", city: "Milton Keynes" }],
  settings: { ...(lib.settings ?? {}), marketplaceListed: true, payMethods: ["Card", "Cash", "Tax-Free Childcare"] },
}) });

const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 6);
const period = await apiPost<{ id: string }>("/api/periods", ps.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
const pass = await apiPost<{ id: string }>("/api/passes", ps.idToken, { name: "Day pass", days: 1 });
const bundle = await apiPost<{ id: string }>("/api/block-bundles", ps.idToken, { name: "QA N6", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
const title = `HVQA N6 Camp ${ts}`;
const l = await apiPost<{ id: string }>("/api/listings", ps.idToken, { title, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Day pass", price: 0.3, days: 1 }], venueId: "n6-venue", bookingType: "auto", status: "live", visibility: "public" } as any);
await apiFetch(`/api/block-bundles/${bundle.id}/listings`, ps.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
out.listing = { id: l.id, title };

const par = await fbSignUp(em("par"));
await apiPost("/api/register-role", par.idToken, { role: "parent", firstName: "Familyone", lastName: "QA", address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR" });
await apiPost("/api/my/children", par.idToken, { name: "sally james", dob: "2018-05-14" });
out.parent = { email: em("par"), uid: par.uid };
const P = (await fbSignIn(em("par"))).idToken;
const listing = await call(`/api/listings/${l.id}`, P);
const sessionDays: string[] = (listing.j?.blocks ?? []).flatMap((b: any) => (b.sessions ?? []).map((s: any) => s.date));
const today = iso(new Date());
const block = (listing.j?.blocks ?? []).find((b: any) => (b.sessions ?? []).some((s: any) => s.date === today)) ?? listing.j?.blocks?.[0];
const day = sessionDays.includes(today) ? today : block.sessions[0].date;
out.day = day; out.blockId = block.id;
const bk = await call("/api/my/bookings", P, { method: "POST", body: JSON.stringify({ listingId: l.id, blockId: block.id, method: "cash", items: [{ pass: "Day pass", dates: [day], child: "sally james", age: 7 }] }) });
const ref = bk.j?.bookings?.[0]?.ref; out.ref = ref;
check("parent booking created", bk.status === 201 && !!ref, { status: bk.status, ref });
if (process.env.N6_STOP) { fs.writeFileSync(`${WT}/docs/home-visit-qa/N6/accounts2.json`, JSON.stringify(out, null, 2)); process.exit(0); } // screenshots run: stop before the name / details are saved

// (A) the owner is asked for a real name; takes a register as themselves; stamp is never the email
const me1 = await call("/api/me", ps.idToken);
check("A1 /api/me asks a nameless freelancer for a real name", me1.j?.nameIsPlaceholder === true, { name: me1.j?.name, flag: me1.j?.nameIsPlaceholder });
const mk = await call(`/api/registers/${block.id}/${day}/mark`, ps.idToken, { method: "POST", body: JSON.stringify({ ref, action: "in" }) });
check("A2 the freelancer (no staff record, no assignment, no rota) can sign a child in", mk.status === 200 || mk.status === 201, { status: mk.status, body: mk.j && JSON.stringify(mk.j).slice(0, 140) });
const rg1 = await call(`/api/registers?date=${day}`, ps.idToken);
const sess1 = (rg1.j ?? []).find((s: any) => s.blockId === block.id) ?? (rg1.j ?? [])[0];
const taken1 = sess1?.takenBy?.name;
check("A3 the register is stamped with the provider's public name, not an email or 'support'", !!taken1 && !String(taken1).includes("@") && !/^support$/i.test(taken1), { takenBy: taken1 });
const nm = await call("/api/account", ps.idToken, { method: "PUT", body: JSON.stringify({ name: "Kaz Tester" }) });
check("A4 saving a real name works", nm.status === 200, { status: nm.status });
const me2 = await call("/api/me", ps.idToken);
check("A5 the prompt flag is gone after a real name is saved", me2.j?.nameIsPlaceholder === false, { flag: me2.j?.nameIsPlaceholder });
const mk2 = await call(`/api/registers/${block.id}/${day}/mark`, ps.idToken, { method: "POST", body: JSON.stringify({ ref, action: "collect", collectedBy: "Parent" }) });
const rg2 = await call(`/api/registers?date=${day}`, ps.idToken);
const sess2 = (rg2.j ?? []).find((s: any) => s.blockId === block.id) ?? (rg2.j ?? [])[0];
check("A6 the next register entry is stamped with the real name", mk2.status < 300 && sess2?.takenBy?.name === "Kaz Tester", { status: mk2.status, takenBy: sess2?.takenBy?.name });

// (B) Tax-Free Childcare provider details
const pubBefore = await call(`/api/public/library/${reg.tenantId}`, P);
check("B1 before details: public library has no registration number", !pubBefore.j?.settings?.childcare?.registrationNumber, pubBefore.j?.settings?.childcare ?? null);
const lib2 = ((await apiFetch<any>("/api/library", ps.idToken)) ?? {}) as any;
const put = await call("/api/library", ps.idToken, { method: "PUT", body: JSON.stringify({ settings: { ...(lib2.settings ?? {}), childcare: { settingName: bn, regulator: "Ofsted", registrationNumber: "EY 123456", postcode: "mk45 4jz" } } }) });
check("B2 saving the details works", put.status === 200, { status: put.status });
const pubAfter = await call(`/api/public/library/${reg.tenantId}`, P);
const cc = pubAfter.j?.settings?.childcare;
check("B3 saved + tidied: regulator kept, registration has no spaces, postcode upper-cased with a space", cc?.regulator === "Ofsted" && cc?.registrationNumber === "EY123456" && cc?.postcode === "MK45 4JZ", cc);
fs.writeFileSync(`${WT}/docs/home-visit-qa/N6/accounts.json`, JSON.stringify(out, null, 2));
console.log("SUMMARY", out.checks.filter((c: any) => c.ok).length, "pass", out.checks.filter((c: any) => !c.ok).length, "fail");
process.exit(0);
