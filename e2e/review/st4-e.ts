import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, saveState, db, openWizard } from "./st4-lib";
const API = "http://localhost:4000";
(async () => {
  const st = loadState(); const stamp = st.stamp;
  let tok = (await fbSignIn(st.emails.co)).idToken;
  // ---- E1 staff added later: raise plan cap, invite + accept Nina, see her in step 11 ----
  await db.collection("tenants").doc(st.tenantId).set({ subscription: { staffLimit: 5 } }, { merge: true });
  if (!st.staff.s4) {
    const inv = await apiPost<any>("/api/invites", tok, { role: "staff", name: "Nina New", jobTitle: "Assistant", staffRole: "coach" });
    const token = inv.token ?? inv.id; const e4 = `e2e-st4-s4-${stamp}@${TEST_EMAIL_DOMAIN}`; const su = await fbSignUp(e4);
    const acc = await fetch(`${API}/api/invites/${token}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${su.idToken}` }, body: "{}" });
    st.staff.s4 = { email: e4, name: "Nina New", uid: (await db.collection("users").where("email", "==", e4).get()).docs[0]?.id, accept: acc.status }; saveState(st);
  }
  const b = await chromium.launch(); const ctx = await newCtx(b); const p = await ctx.newPage();
  await login(p, st.emails.co);
  await openWizard(p, "/company", "St4 One Staff Camp", 11);
  let t = await body(p); let s = await shot(p, "06-step11-after-late-hire");
  check("S11-06 staff added later (Nina) appears in step 11 un-assigned, existing assignments kept", t.includes("Nina New") && (t.match(/Onsite/g) ?? []).length === 2, "", s);
  // preview step (12) matches
  await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(3500);
  t = await body(p); s = await shot(p, "07-step12-preview");
  check("S11-07 step 12 preview shows exactly the 2 assigned staff and the bio (matches parent page)", t.includes("Sam Helper") && t.includes("Priya Coach") && t.includes("Level 3 coaching award") && !t.includes("Nina New") && !t.includes("Tom Lead"), "", s);
  await ctx.close();
  // ---- E4 staff portal: roster Sam + Priya on L2's first date ----
  const day = (await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok)).runFrom;
  const shiftsMade: any[] = [];
  for (const [nm, role] of [["Sam Helper", "Coach"], ["Priya Coach", "Lead coach"]]) {
    const r = await fetch(`${API}/api/shifts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ staffName: nm, date: day, start: "08:30", end: "16:00", role, listingId: st.listings.L2 }) });
    shiftsMade.push(r.status);
  }
  console.log("shifts", shiftsMade, day);
  const c2 = await newCtx(b); const sp = await c2.newPage();
  await login(sp, st.staff.s1.email);
  await go(sp, "/staff/schedule");
  t = await body(sp); s = await shot(sp, "08-staff-portal-sam-shifts");
  check("STF-01 staff portal: Sam sees his own shift for the listing's date and not Priya's", shiftsMade.every((x) => x === 201) && /Sam Helper|08:30/.test(t) && !t.includes("Priya Coach"), `shifts=${shiftsMade} text has 08:30=${t.includes("08:30")}`, s);
  await go(sp, "/staff/ratios"); t = await body(sp); s = await shot(sp, "09-staff-portal-ratios");
  check("STF-02 staff portal opens Ratios & groups without error", !/error|not found|forbidden/i.test(t.slice(0, 600)), t.slice(0, 120).replace(/\n/g, " "), s);
  await c2.close();
  // ---- E3 company schedule + ratios ----
  const c3 = await newCtx(b); const cp = await c3.newPage(); await login(cp, st.emails.co);
  await go(cp, "/company/schedule", 6000); t = await body(cp); s = await shot(cp, "10-company-schedule");
  check("ROTA-01 company staff schedule shows Sam and Priya rostered on the listing's date", t.includes("Sam Helper") && t.includes("Priya Coach"), "", s);
  await go(cp, "/company/ratios", 6000); t = await body(cp); s = await shot(cp, "11-company-ratios");
  check("RAT-01 Ratios & groups 'Your team' lists the staff adopted in step 11 (Sam, Priya)", t.includes("Sam") && t.includes("Priya"), "", s);
  console.log("ratios page has Tom:", t.includes("Tom Lead"), "Nina:", t.includes("Nina New"));
  await c3.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
