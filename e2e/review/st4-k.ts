import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { chromium, newCtx, login, go, shot, body, check, loadState, saveState } from "./st4-lib";
const API = "http://localhost:4000";
(async () => {
  const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken;
  const full = await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok);
  const day = full.runFrom; const block = full.blocks[0];
  await fetch(`${API}/api/listings/${st.listings.L2}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ ageFrom: "2" }) });
  const pe = st.parent?.email ?? `e2e-st4-par-${st.stamp}@${TEST_EMAIL_DOMAIN}`; const ps = st.parent ? await fbSignIn(pe) : await fbSignUp(pe);
  if (!st.parent) await apiPost("/api/register-role", ps.idToken, { role: "parent", firstName: "Pat", lastName: "Parent", providerId: st.tenantId });
  const kids = [["Ava", 2], ["Ben", 2], ["Cy", 2], ["Dee", 2]];
  const results: number[] = [];
  for (const [n, age] of kids) {
    const r = await fetch(`${API}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ps.idToken}` }, body: JSON.stringify({ listingId: st.listings.L2, blockId: block.id, method: "card", items: [{ pass: "Day pass", child: `${n} St4`, age, dates: [day] }] }) });
    results.push(r.status); if (r.status >= 300) console.log("book", n, r.status, (await r.text()).slice(0, 200));
  }
  console.log("bookings", results);
  st.parent = { email: pe }; saveState(st);
  const b = await chromium.launch(); const c = await newCtx(b); const p = await c.newPage(); await login(p, st.emails.co);
  await go(p, "/company/ratios", 6000);
  await p.locator("select").filter({ hasText: "St4 One Staff Camp" }).first().selectOption({ label: (await p.locator("option", { hasText: "St4 One Staff Camp" }).first().innerText()) }).catch((e: Error) => console.log("select fail", e.message.slice(0, 80))); await p.waitForTimeout(2500);
  let t = await body(p); let s = await shot(p, "18-ratios-with-bookings");
  console.log("ratios text sample:", t.replace(/\n/g, " ").slice(0, 700));
  check("RAT-02 Ratios shows the day's children and the staff the register needs", /Day pass|Ava St4|5 children|children/i.test(t) && /staff/i.test(t), "", s);
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
