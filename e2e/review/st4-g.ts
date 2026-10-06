import { fbSignIn, apiFetch } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, db } from "./st4-lib";
const API = "http://localhost:4000";
(async () => {
  const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken;
  const day = (await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok)).runFrom;
  const put = await fetch(`${API}/api/rota`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({
    staff: [{ id: "r_sam", name: "Sam Helper", role: "Coach", rate: 12 }, { id: "r_priya", name: "Priya Coach", role: "Lead coach", rate: 15 }], sites: ["Riverside Hall"],
    shifts: [
      { id: "sh_sam", staffId: "r_sam", site: "Riverside Hall", listing: st.listings.L2, role: "Coach", date: day, start: "08:30", end: "16:00", locked: true },
      { id: "sh_priya", staffId: "r_priya", site: "Riverside Hall", listing: st.listings.L2, role: "Lead coach", date: day, start: "08:30", end: "16:00", locked: true },
    ] }) });
  console.log("rota put", put.status, (await put.text()).slice(0, 120));
  const b = await chromium.launch(); const c = await newCtx(b); const sp = await c.newPage();
  await login(sp, st.staff.s1.email);
  await go(sp, "/staff/schedule", 5000);
  await sp.getByRole("button", { name: /Skip for now/ }).click().catch(() => {}); await sp.waitForTimeout(800);
  let t = await body(sp); let s = await shot(sp, "08b-staff-portal-sam-shifts");
  check("STF-01 staff portal: Sam sees HIS rostered shift (08:30 Mon, Riverside Hall) and not Priya's", /08:30/.test(t) && t.includes("Riverside Hall") && !t.includes("Priya Coach"), `08:30=${/08:30/.test(t)}`, s);
  await c.close();
  const c2 = await newCtx(b); const pp = await c2.newPage(); await login(pp, st.staff.s2.email);
  await go(pp, "/staff/schedule", 5000); await pp.getByRole("button", { name: /Skip for now/ }).click().catch(() => {}); await pp.waitForTimeout(800);
  t = await body(pp); s = await shot(pp, "08c-staff-portal-priya-shifts");
  check("STF-03 staff portal: Priya sees her own shift; Tom (no shift) sees none", /08:30/.test(t) && !t.includes("Sam Helper"), "", s);
  await c2.close();
  const c3 = await newCtx(b); const tp = await c3.newPage(); await login(tp, st.staff.s3.email);
  await go(tp, "/staff/schedule", 5000); await tp.getByRole("button", { name: /Skip for now/ }).click().catch(() => {}); await tp.waitForTimeout(800);
  t = await body(tp); s = await shot(tp, "08d-staff-portal-tom-none");
  check("STF-04 staff member never assigned (Tom) sees no shifts from other people", !/08:30/.test(t) && !t.includes("Priya Coach") && !t.includes("Sam Helper"), "", s);
  await c3.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
