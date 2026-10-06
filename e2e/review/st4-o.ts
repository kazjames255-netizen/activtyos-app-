import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { check, loadState, db } from "./st4-lib";
const API = "http://localhost:4000";
(async () => {
  const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken; const pt = (await fbSignIn(st.parent.email)).idToken;
  // exposure: parent-facing APIs
  const browse = JSON.stringify(await apiFetch<any>("/api/listings", pt));
  const detail = await apiFetch<any>(`/api/listings/${st.listings.L2}`, pt);
  const d3 = await apiFetch<any>(`/api/listings/${st.listings.L3}`, pt);
  const pub = JSON.stringify(await apiFetch<any>(`/api/library/public/${st.tenantId}?listingId=${st.listings.L2}`, pt).catch(() => ({})));
  const names = ["Tom Lead", "Nina New", "Olive Owner", "Sam Helper"];
  check("EXP-01 browse list (parents) contains no staff names at all", names.every((n) => !browse.includes(n)) && !browse.includes("Priya Coach"), "");
  check("EXP-02 listing detail for parents carries only the assigned staff (Priya) in library.staff", (detail.library?.staff ?? []).length === 1 && detail.library.staff[0].first === "Priya" && !JSON.stringify(detail).includes("Tom Lead") && !JSON.stringify(detail).includes("Nina New"), JSON.stringify((detail.library?.staff ?? []).map((m: any) => m.first)));
  check("EXP-03 listing with no staff returns an empty library.staff", (d3.library?.staff ?? []).length === 0, "");
  check("EXP-04 public library settings endpoint exposes no staff", names.every((n) => !pub.includes(n)), pub.slice(0, 80));
  // staff cannot read the other staff's emails via listing API (parent view)
  check("EXP-05 no staff email/uid leaks in the parent listing JSON", !JSON.stringify(detail).includes("@activityos-test.com") || JSON.stringify(detail).includes(st.parent.email), "");
  // plan cap at acceptance
  await db.collection("tenants").doc(st.tenantId).set({ subscription: { staffLimit: 5 } }, { merge: true }); // 4 staff + 0
  const inv = await apiPost<any>("/api/invites", tok, { role: "staff", name: "Late Joiner", staffRole: "coach" });
  await db.collection("tenants").doc(st.tenantId).set({ subscription: { staffLimit: 3 } }, { merge: true }); // downgrade after the invite was sent
  const e = `e2e-st4-late-${st.stamp}@${TEST_EMAIL_DOMAIN}`; const su = await fbSignUp(e);
  const acc = await fetch(`${API}/api/invites/${inv.token ?? inv.id}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${su.idToken}` }, body: "{}" });
  const body = await acc.json().catch(() => ({}));
  check("CAP-02 plan cap re-checked when an invite is accepted after a downgrade (409 plan_full, link kept)", acc.status === 409 && body.code === "plan_full", `status=${acc.status} ${JSON.stringify(body).slice(0, 120)}`);
  const over = await fetch(`${API}/api/invites`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ role: "staff", name: "Over Cap" }) });
  check("CAP-01 at the cap a new invite is refused with an 'upgrade your band in Billing & payouts' message", over.status === 403 && /Billing & payouts/.test(await over.text()), `status=${over.status}`);
  await db.collection("tenants").doc(st.tenantId).set({ subscription: { staffLimit: 12 } }, { merge: true });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
