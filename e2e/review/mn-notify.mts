// Newsfeed bell/email notification check. Needs e2e/review/.mn-fixture.json from mn-api.mts. Run:
//   E2E_AUTH_DIR=e2e/review/.auth-suite NEXT_PUBLIC_API_URL=http://localhost:4012 server/node_modules/.bin/tsx e2e/review/mn-notify.mts
import fs from "node:fs";
import { loadAccounts } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";

const fx = JSON.parse(fs.readFileSync(new URL("./.mn-fixture.json", import.meta.url), "utf8"));
const { accounts } = loadAccounts();
const f = await fbSignIn(accounts.freelancer.email), p1 = await fbSignIn(accounts.parent.email), p2 = await fbSignIn(fx.P2.email), p3 = await fbSignIn(fx.P3.email);
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const bell = async (tok: string) => (await apiFetch<{ items?: any[]; notifications?: any[] }>("/api/notifications", tok)) as any;
const items = async (tok: string, ref: string) => { const r = await bell(tok); return (r.items ?? r.notifications ?? r).filter((n: any) => n.ref === ref); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString(36);

const all = await apiPost<any>("/api/posts", f.idToken, { title: `Notify all ${tag}`, body: "hello everyone" });
const a2 = await apiPost<any>("/api/posts", f.idToken, { title: `Notify A2 ${tag}`, body: "chosen", audience: "listing", audIds: [fx.LA2.id] });
const draft = await apiPost<any>("/api/posts", f.idToken, { title: `Notify draft ${tag}`, body: "later", status: "draft" });
const sched = await apiPost<any>("/api/posts", f.idToken, { title: `Notify sched ${tag}`, body: "soon", status: "scheduled", publishAt: "2099-01-01T09:00" });
await wait(4000);
ok((await items(p1.idToken, all.id)).length === 1 && (await items(p2.idToken, all.id)).length === 1, "all-families post: P1 and P2 each get one bell");
ok((await items(p3.idToken, all.id)).length === 0, "family of another provider gets nothing");
ok((await items(p1.idToken, a2.id)).length === 1 && (await items(p2.idToken, a2.id)).length === 0, "chosen-families post: only the family booked on that listing");
ok((await items(p1.idToken, draft.id)).length === 0 && (await items(p1.idToken, sched.id)).length === 0, "draft / future-scheduled: no notification yet");
const n = (await items(p1.idToken, all.id))[0];
ok(n?.category === "newsfeed" && n?.href === "/custdash/newsfeed", `bell shape ok (${n?.title} / ${n?.body})`);
await apiFetch(`/api/posts/${draft.id}`, f.idToken, { method: "PUT", body: JSON.stringify({ status: "published" }) });
await wait(3000);
ok((await items(p1.idToken, draft.id)).length === 1, "draft published -> bell");
await apiFetch(`/api/posts/${draft.id}`, f.idToken, { method: "PUT", body: JSON.stringify({ status: "published", title: "edited" }) });
await wait(2000);
ok((await items(p1.idToken, draft.id)).length === 1, "editing a live post does not notify again");
await apiFetch(`/api/posts/${sched.id}`, f.idToken, { method: "PUT", body: JSON.stringify({ publishAt: "2020-01-01T09:00" }) });
console.log("waiting 75s for the scheduled sweep...");
await wait(75_000);
ok((await items(p1.idToken, sched.id)).length === 1, "scheduled post notifies when it goes live");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
