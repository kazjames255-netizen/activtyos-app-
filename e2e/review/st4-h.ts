import { fbSignIn, apiFetch } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, db, openWizard } from "./st4-lib";
const API = "http://localhost:4000";
(async () => {
  const st = loadState(); let tok = (await fbSignIn(st.emails.co)).idToken;
  const b = await chromium.launch();
  // ---- duplicate keeps staff (UI) ----
  const c = await newCtx(b); const p = await c.newPage(); await login(p, st.emails.co);
  await go(p, "/company/listings");
  const card = p.locator('[data-ui="card"]').filter({ hasText: "St4 One Staff Camp" }).last();
  await card.getByRole("button", { name: "⋯" }).click(); await p.waitForTimeout(400);
  await p.getByText(/Duplicate/).first().click(); await p.waitForTimeout(4500);
  const listAll = (await apiFetch<any[]>("/api/listings?mine=1", tok)) ?? [];
  const copy = listAll.find((l) => /St4 One Staff Camp \(copy\)/.test(l.title ?? l.name));
  const src = listAll.find((l) => l.id === st.listings.L2);
  let s = await shot(p, "12-after-duplicate");
  check("DUP-01 duplicate keeps the same staff assignments (staffIds identical, drafted)", !!copy && JSON.stringify([...(copy.staffIds ?? [])].sort()) === JSON.stringify([...(src.staffIds ?? [])].sort()) && (copy.staffIds ?? []).length === 2 && copy.status !== "live", JSON.stringify(copy?.staffIds), s);
  if (copy) { st.listings.L2copy = copy.id; require("fs").writeFileSync(require("./st4-lib").STATE, JSON.stringify(st, null, 1)); }
  // duplicate opens in the wizard at step 11 showing the same Onsite staff
  await openWizard(p, "/company", "St4 One Staff Camp (copy)", 11);
  const t11 = await body(p); s = await shot(p, "13-duplicate-step11");
  check("DUP-02 the copy's step 11 shows the same two staff 'Onsite' with the bio", (t11.match(/Onsite/g) ?? []).length === 2 && t11.includes("Level 3 coaching award"), "", s);
  await c.close();
  // ---- deactivate Sam after assignment ----
  const inv = await db.collection("invites").where("usedBy", "==", st.staff.s1.uid).get();
  const token = inv.docs[0].id;
  const rr = await fetch(`${API}/api/invites/${token}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ status: "deactivated" }) });
  console.log("deactivate Sam", rr.status);
  const c2 = await newCtx(b); const pp = await c2.newPage();
  await go(pp, `/book/${st.listings.L2}`, 6000);
  const pt = await body(pp); s = await shot(pp, "14-parent-page-after-sam-deactivated");
  check("DEACT-01 parent page stops showing a staff member whose account was switched off", rr.status === 200 && !pt.includes("Sam Helper"), `status=${rr.status}, parents still see Sam=${pt.includes("Sam Helper")}`, s);
  await c2.close();
  // wizard step 11 for the staff member
  const c3 = await newCtx(b); const wp = await c3.newPage(); await login(wp, st.emails.co);
  await openWizard(wp, "/company", "St4 One Staff Camp", 11);
  const wt = await body(wp); s = await shot(wp, "15-step11-after-sam-deactivated");
  check("DEACT-02 step 11 marks a switched-off person as inactive / not selectable", !wt.includes("Sam Helper") || /inactive|switched off|left the team/i.test(wt), `Sam still shown: ${wt.includes("Sam Helper")}`, s);
  await c3.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
