import { fbSignIn, apiFetch } from "../helpers/accounts";
import { check, loadState } from "./st4-lib";
(async () => {
  const st = loadState(); const tok = (await fbSignIn(st.emails.co)).idToken;
  const day = (await apiFetch<any>(`/api/listings/${st.listings.L2}`, tok)).runFrom;
  const r: any = await apiFetch<any>(`/api/ratios?date=${day}`, tok);
  const sess = (r.sessions ?? r)[0] ?? r;
  const mine = (Array.isArray(r) ? r : r.sessions ?? []).find((x: any) => x.listingId === st.listings.L2);
  console.log("ratio session:", JSON.stringify({ children: mine?.totalChildren, required: mine?.requiredStaff, assigned: mine?.staffAssigned, met: mine?.met, keys: Object.keys(mine ?? {}).slice(0, 25) }));
  check("RAT-03 ratios API for the booked day counts 5 children and needs the right staff (4 under-3s need 2 at 1:3 + 1 child)", !!mine && mine.totalChildren === 5 && (mine.requiredStaff ?? 0) >= 2, JSON.stringify({ total: mine?.totalChildren, required: mine?.requiredStaff }));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
