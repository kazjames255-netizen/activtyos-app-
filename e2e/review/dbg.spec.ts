import { loadAccounts } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { test } from "@playwright/test"; test("dbg", async () => {
  const a = loadAccounts().accounts;
  const t = (await fbSignIn(a.freelancer.email)).idToken;
  const p = (await fbSignIn(a.parent.email)).idToken;
  console.log(JSON.stringify(await apiFetch("/api/learning-hub/config", t)).match(/"requireDiagnostic":[a-z]+/)?.[0]);
  await apiFetch("/api/learning-hub/config", t, { method: "PUT", body: JSON.stringify({ hub: { requireDiagnostic: true } }) });
  const st: any[] = await apiFetch("/api/learning-hub/students", t);
  const kid = st.find((s) => (s.subjects||[]).some((x: string) => /G2 Kid/.test(x)));
  console.log(kid?.childId, kid?.subjects);
  const list: any[] = await apiFetch(`/api/learning-hub/assessments?childId=${kid.childId}&tenantId=${a.freelancer.tenantId}`, p);
  console.log(list.filter((x) => /G2 kid/.test(x.title)).map((x) => ({ t: x.title, type: x.type, locked: x.locked, aud: x.audience })));
});
