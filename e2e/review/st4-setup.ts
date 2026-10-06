import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { admin, db, saveState, loadState } from "./st4-lib";
const stamp = Date.now().toString(36);
const em = (n: string) => `e2e-st4-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const iso = (x: Date) => x.toISOString().slice(0, 10);
(async () => {
  const st: any = { stamp, emails: {} };
  // company owner
  st.emails.co = em("co");
  const co = await fbSignUp(st.emails.co);
  const r = await apiPost<{ tenantId: string }>("/api/register-role", co.idToken, { role: "company", businessName: "Staff Test Camps", providerName: "Staff Test Camps", providerNameMode: "business", ownerName: "Olive Owner" });
  st.tenantId = r.tenantId;
  await db.collection("tenants").doc(r.tenantId).set({ subscription: { status: "trialing", plan: "company", band: "starter", since: new Date().toISOString(), staffLimit: 3, locationLimit: null } }, { merge: true });
  await db.collection("libraries").doc(r.tenantId).set({ venues: [{ id: "st4-venue", name: "Riverside Hall", address: "1 Test Way, Northampton", city: "Northampton" }], settings: { billing: { sortCode: "20-57-44", accountNumber: "63437582", bankName: "Barclays", email: st.emails.co } } }, { merge: true });
  let tok = (await fbSignIn(st.emails.co)).idToken;
  // staff via invites
  const staff = [["s1", "Sam Helper", "Coach"], ["s2", "Priya Coach", "Lead coach"], ["s3", "Tom Lead", "Supervisor"]];
  st.staff = {};
  for (const [k, name, job] of staff) {
    const inv = await apiPost<{ token?: string; id?: string }>("/api/invites", tok, { role: "staff", name, jobTitle: job, staffRole: "coach" });
    const token = (inv as any).token ?? (inv as any).id;
    const e = em(k); const su = await fbSignUp(e);
    const acc = await fetch("http://localhost:4000/api/invites/" + token + "/accept", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${su.idToken}` }, body: "{}" });
    st.staff[k] = { email: e, name, uid: (await db.collection("users").where("email", "==", e).get()).docs[0]?.id, accept: acc.status };
    console.log("staff", k, acc.status);
  }
  // plan cap: 4th invite should be refused (limit 3)
  const over = await fetch("http://localhost:4000/api/invites", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ role: "staff", name: "Extra Person" }) });
  st.capStatus = over.status; st.capBody = (await over.text()).slice(0, 200);
  console.log("cap 4th invite", st.capStatus, st.capBody);
  // block + listings
  tok = (await fbSignIn(st.emails.co)).idToken;
  const per = await apiPost<{ id: string }>("/api/periods", tok, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", tok, { name: "Day pass", days: 1 });
  const bund = await apiPost<{ id: string }>("/api/block-bundles", tok, { name: "St4 block", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: true });
  st.bundle = bund.id;
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e2 = new Date(d); e2.setDate(e2.getDate() + 4);
  const mk = async (title: string, staffIds: string[], status: string) => {
    const l = await apiPost<{ id: string }>("/api/listings", tok, { title, venueId: "st4-venue", runFrom: iso(d), runTo: iso(e2), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bund.id, passes: [{ name: "Day pass", price: 20, days: 1 }], bookingType: "auto", staffIds, status, visibility: "public" });
    await apiFetch(`/api/block-bundles/${bund.id}/listings`, tok, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) }).catch(() => {});
    return l.id;
  };
  // library staff entries are what the parent page reads: add via the same shape the wizard writes
  const lib = (await db.collection("libraries").doc(r.tenantId).get()).data() ?? {};
  st.listings = {};
  st.listings.L2 = await mk("St4 One Staff Camp", [], "draft"); // staff added by UI later
  st.listings.L3 = await mk("St4 No Staff Camp", [], "live");
  saveState(st);
  console.log(JSON.stringify(st, null, 1).slice(0, 900));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
