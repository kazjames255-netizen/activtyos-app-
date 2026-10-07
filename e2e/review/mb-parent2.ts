import { apiPost } from "../helpers/accounts";
import { call, ok, em, save, load, fbSignUp } from "./mb-lib";
(async () => {
  const S = load();
  const par = await fbSignUp(em("parent2"));
  await apiPost("/api/register-role", par.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "Quinn", lastName: "Second" });
  await call(par.idToken, "POST", "/api/me/welcome", {});
  S.accts.parent2 = { email: em("parent2"), uid: par.uid };
  S.kids2 = {};
  for (const [name, dob] of [["Ava Second", "2020-04-10"], ["Ben Second", "2017-04-10"]]) {
    const c = await ok(par.idToken, "POST", "/api/my/children", { name, dob });
    S.kids2[name.split(" ")[0]] = { id: c.id, name, age: c.age };
  }
  // drop the failed attempts so they re-run
  for (const k of Object.keys(S.bookings ?? {})) if (S.bookings[k].status >= 300) delete S.bookings[k];
  save(S); console.log("ok", Object.keys(S.bookings)); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
