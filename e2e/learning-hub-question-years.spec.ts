import { test, expect } from "@playwright/test";
import { loadAccounts, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";

// Learning Hub — questions are year-group specific: a question carries `yearGroups`, the bank filters by year
// (GET /questions?yearGroup=Year 5 | Year 5,Year 6 | none), and an edit that doesn't mention years keeps them.
// Anchored to this run's run-unique subject and question prompts.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Qy Subject ${stamp}`;
const p5 = `Qy Y5 question ${stamp}`;
const p6 = `Qy Y6 question ${stamp}`;
const pNone = `Qy untagged question ${stamp}`;

let accounts: AccountManifest["accounts"];
let token = "";
let topicId = "";
const ids: Record<string, string> = {};

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const choice = (prompt: string, yearGroups?: string[]) => ({
  topicId, kind: "single", prompt, options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], answer: "a", marks: 1, explanation: "", published: true, ...(yearGroups ? { yearGroups } : {}),
});
const list = (qs: string) => apiFetch<{ id: string; prompt: string; yearGroups: string[] }[]>(`/api/learning-hub/questions?light=1&subject=${encodeURIComponent(subject)}${qs}`, token);

test.beforeAll(async () => {
  test.setTimeout(120_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  token = (await fbSignIn(accounts.freelancer.email)).idToken;
  topicId = (await apiPost<{ id: string }>("/api/learning-hub/topics", token, { subject, topic: "Numbers" })).id;
  ids.p5 = (await apiPost<{ id: string }>("/api/learning-hub/questions", token, choice(p5, ["Year 5"]))).id;
  ids.p6 = (await apiPost<{ id: string }>("/api/learning-hub/questions", token, choice(p6, ["Year 6"]))).id;
  ids.none = (await apiPost<{ id: string }>("/api/learning-hub/questions", token, choice(pNone))).id;
});

test("the bank filters by year group; 'none' finds untagged questions", async () => {
  const y5 = (await list("&yearGroup=Year%205")).map((q) => q.prompt);
  expect(y5).toEqual([p5]);
  const both = (await list(`&yearGroup=${encodeURIComponent("Year 5,Year 6")}`)).map((q) => q.prompt).sort();
  expect(both).toEqual([p5, p6].sort());
  expect((await list("&yearGroup=none")).map((q) => q.prompt)).toEqual([pNone]);
  expect((await list("")).length).toBe(3);
});

test("an edit that doesn't mention years keeps them; sending years replaces them", async () => {
  const { yearGroups: _drop, ...noYears } = choice(`${p5} (edited)`, ["Year 5"]);
  void _drop;
  await apiFetch(`/api/learning-hub/questions/${ids.p5}`, token, { method: "PUT", body: JSON.stringify(noYears) });
  const kept = await apiFetch<{ yearGroups: string[] }>(`/api/learning-hub/questions/${ids.p5}`, token);
  expect(kept.yearGroups).toEqual(["Year 5"]);
  await apiFetch(`/api/learning-hub/questions/${ids.p5}`, token, { method: "PUT", body: JSON.stringify(choice(`${p5} (edited)`, ["Year 5", "Year 6"])) });
  const both = await apiFetch<{ yearGroups: string[] }>(`/api/learning-hub/questions/${ids.p5}`, token);
  expect(both.yearGroups.sort()).toEqual(["Year 5", "Year 6"]);
});
