import { mkTenant, mkParent, api, cleanupRun, RUN, log } from "./p2_lib.mjs";
log("RUN", RUN);
const A = await mkTenant("a", "freelancer");
const P = await mkParent("p");
log("tenant", A.tenantId);
const me = await api(A.token, "GET", "/api/me"); log("me", me.status, me.text.slice(0, 200));
const pm = await api(P.token, "GET", "/api/me"); log("parent me", pm.status, pm.text.slice(0, 200));
await cleanupRun();
