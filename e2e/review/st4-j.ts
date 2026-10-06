import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, saveState, db, openWizard } from "./st4-lib";
const API = "http://localhost:4000"; const iso = (x: Date) => x.toISOString().slice(0, 10);
(async () => {
  const st = loadState(); const stamp = st.stamp;
  let tok = (await fbSignIn(st.emails.co)).idToken;
  if (!st.fr) {
    await db.collection("tenants").doc(st.tenantId).set({ subscription: { staffLimit: 12 } }, { merge: true });
    const inv = await apiPost<any>("/api/invites", tok, { role: "franchise", franchiseName: "North Branch", franchiseArea: "Northampton" });
    const fe = `e2e-st4-fr-${stamp}@${TEST_EMAIL_DOMAIN}`; const fu = await fbSignUp(fe);
    const acc = await fetch(`${API}/api/invites/${inv.token ?? inv.id}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${fu.idToken}` }, body: "{}" });
    const fuid = (await db.collection("users").where("email", "==", fe).get()).docs[0].id;
    st.fr = { email: fe, uid: fuid, accept: acc.status };
    const ftok = (await fbSignIn(fe)).idToken;
    const sinv = await apiPost<any>("/api/invites", ftok, { role: "staff", name: "Fran Franchise", jobTitle: "Franchise coach", staffRole: "coach" });
    const se = `e2e-st4-frs-${stamp}@${TEST_EMAIL_DOMAIN}`; const su = await fbSignUp(se);
    const sacc = await fetch(`${API}/api/invites/${sinv.token ?? sinv.id}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${su.idToken}` }, body: "{}" });
    st.fr.staff = { email: se, name: "Fran Franchise", uid: (await db.collection("users").where("email", "==", se).get()).docs[0].id, accept: sacc.status };
    await db.collection("libraries").doc(`${st.tenantId}__fr__${fuid}`).set({ venues: [{ id: "st4-frvenue", name: "North Hall", address: "2 North Rd, Northampton", city: "Northampton" }], settings: { billing: { sortCode: "20-57-44", accountNumber: "63437582", email: fe } } }, { merge: true });
    // a franchise listing, live, with no staff yet (staff assigned via the UI)
    const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e2 = new Date(d); e2.setDate(e2.getDate() + 4);
    const per = await apiPost<{ id: string }>("/api/periods", ftok, { title: "Full day", start: "09:00", finish: "15:30" });
    const pass = await apiPost<{ id: string }>("/api/passes", ftok, { name: "Day pass", days: 1 });
    const bund = await apiPost<{ id: string }>("/api/block-bundles", ftok, { name: "Fr block", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: true });
    const l = await apiPost<{ id: string }>("/api/listings", ftok, { title: "St4 Franchise Camp", venueId: "st4-frvenue", runFrom: iso(d), runTo: iso(e2), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bund.id, passes: [{ name: "Day pass", price: 20, days: 1 }], bookingType: "auto", staffIds: [], status: "draft", visibility: "public" });
    st.fr.listing = l.id; saveState(st);
  }
  console.log("franchise", JSON.stringify(st.fr));
  const ftok = (await fbSignIn(st.fr.email)).idToken;
  const team = await apiFetch<any>("/api/location-staff", ftok);
  check("FR-01 franchise's deployable team = its own staff only (no head-office Sam/Priya/Tom/Nina)", (team.team ?? []).length === 1 && team.team[0].name === "Fran Franchise", JSON.stringify((team.team ?? []).map((t: any) => t.name)));
  const hoteam = await apiFetch<any>("/api/location-staff", tok);
  check("FR-02 head office's team does not include the franchise's staff", !(hoteam.team ?? []).some((t: any) => t.name === "Fran Franchise"), JSON.stringify((hoteam.team ?? []).map((t: any) => t.name)));
  const b = await chromium.launch(); const c = await newCtx(b); const p = await c.newPage(); await login(p, st.fr.email);
  await openWizard(p, "/franchise", "St4 Franchise Camp", 11);
  let t = await body(p); let s = await shot(p, "16-franchise-step11");
  check("FR-03 franchise wizard step 11 lists only the franchise's own staff", t.includes("Fran Franchise") && !t.includes("Sam Helper") && !t.includes("Priya Coach") && !t.includes("Tom Lead") && !t.includes("Nina New"), "", s);
  await p.locator("div.rounded-xl.border").filter({ hasText: "Fran Franchise" }).last().getByRole("button", { name: /^Assign/ }).click(); await p.waitForTimeout(3500);
  await fetch(`${API}/api/listings/${st.fr.listing}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ftok}` }, body: JSON.stringify({ status: "live" }) });
  await c.close();
  const c2 = await newCtx(b); const pp = await c2.newPage(); await go(pp, `/book/${st.fr.listing}`, 6000);
  t = await body(pp); s = await shot(pp, "17-franchise-parent-page");
  check("FR-04 parent page of the franchise listing shows the franchise's chosen staff only", t.includes("Fran Franchise") && !t.includes("Sam Helper") && !t.includes("Priya Coach"), "", s);
  await c2.close();
  // head-office listing never shows franchise staff
  const c3 = await newCtx(b); const hp = await c3.newPage(); await go(hp, `/book/${st.listings.L2}`, 6000);
  t = await body(hp); check("FR-05 head-office listing page does not show franchise staff", !t.includes("Fran Franchise"), "");
  await c3.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
