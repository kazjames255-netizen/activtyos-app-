import { fbSignIn, apiFetch } from "../helpers/accounts";
import { chromium, newCtx, go, shot, body, check, loadState } from "./st4-lib";
(async () => {
  const st = loadState();
  const tok = (await fbSignIn(st.emails.co)).idToken;
  // publish L2 and L3 via the API (the go-live gate is covered elsewhere)
  for (const id of [st.listings.L2, st.listings.L3]) { const r = await fetch(`http://localhost:4000/api/listings/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ status: "live" }) }); console.log("publish", id, r.status); }
  const b = await chromium.launch(); const ctx = await newCtx(b); const p = await ctx.newPage();
  await go(p, `/book/${st.listings.L2}`, 6000);
  // open the team section if collapsed
  const opener = p.getByText(/Meet|team|Who.?s running|Your coaches/i).first();
  let s = await shot(p, "03-parent-page-L2");
  let t = await body(p);
  const hasNames = t.includes("Sam Helper") || t.includes("Sam");
  console.log("body mentions: Sam", t.includes("Sam Helper"), "Priya", t.includes("Priya Coach"), "Tom", t.includes("Tom Lead"), "Olive", t.includes("Olive"), "handle", t.includes("e2e-st4-co"));
  // find any expander for the team
  const btns = await p.locator("button").allInnerTexts();
  console.log("buttons:", btns.filter((x) => /team|staff|coach|meet|show/i.test(x)).slice(0, 8));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
